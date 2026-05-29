"""
레포 데이터 API — LogStore를 통한 모드별 분기 (local: JSONL 직접 읽기 / saas: DB 조회)
"""
from fastapi import APIRouter, Depends, Query
from middleware.auth import get_current_user
from services.log_store import read_all_logs_async, get_prompt_stats, get_hook_stats, get_misunderstanding_stats
from services.repo_scanner import get_git_log, get_git_stats, scan_docs, scan_test_results

router = APIRouter()


# --- 프로젝트 레포 ---

@router.get("/project/commits")
async def project_commits(limit: int = Query(default=30), user: dict = Depends(get_current_user)):
    return get_git_log(limit)


@router.get("/project/stats")
async def project_stats(user: dict = Depends(get_current_user)):
    return get_git_stats()


@router.get("/project/docs")
async def project_docs(user: dict = Depends(get_current_user)):
    return scan_docs()


# --- 테스트 레포 ---

@router.get("/test/results")
async def test_results(user: dict = Depends(get_current_user)):
    return scan_test_results()


# --- 프롬프트 ---

SYSTEM_PREFIXES = ("<task-notification>", "<system-reminder>", "<command-name>", "<local-command")


@router.get("/prompts")
async def prompts(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    raw = await read_all_logs_async("prompts", days=90, limit=limit, tenant_id=user["tenant_id"])
    for p in raw:
        p["is_system"] = p.get("prompt", "").lstrip().startswith(SYSTEM_PREFIXES)
    return raw


@router.get("/prompts/stats")
async def prompt_stats(user: dict = Depends(get_current_user)):
    return await get_prompt_stats(tenant_id=user["tenant_id"])


# --- Hook 로그 ---

@router.get("/hooks")
async def hooks(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    return await read_all_logs_async("hooks", days=7, limit=limit, tenant_id=user["tenant_id"])


@router.get("/hooks/stats")
async def hook_stats(user: dict = Depends(get_current_user)):
    return await get_hook_stats(tenant_id=user["tenant_id"])


# --- 오해 감지 ---

@router.get("/misunderstandings")
async def misunderstandings(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    return await read_all_logs_async("misunderstandings", days=30, limit=limit, tenant_id=user["tenant_id"])


@router.get("/misunderstandings/stats")
async def misunderstanding_stats(user: dict = Depends(get_current_user)):
    return await get_misunderstanding_stats(tenant_id=user["tenant_id"])


# --- 확장 카테고리 (Phase A 추적 확장) ---

@router.get("/sessions")
async def sessions(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    """세션 이벤트 (SessionStart, Stop, PreCompact)"""
    return await read_all_logs_async("sessions", days=30, limit=limit, tenant_id=user["tenant_id"])


@router.get("/agents")
async def agents(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    """서브에이전트 호출 (SubagentStop)"""
    return await read_all_logs_async("agents", days=30, limit=limit, tenant_id=user["tenant_id"])


@router.get("/slash_commands")
async def slash_commands(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    """슬래시 명령 호출 (/clear, /notion 등)"""
    return await read_all_logs_async("slash_commands", days=30, limit=limit, tenant_id=user["tenant_id"])


@router.get("/mcp_calls")
async def mcp_calls(limit: int = Query(default=100), user: dict = Depends(get_current_user)):
    """MCP 도구 호출 (mcp__* 도구)"""
    return await read_all_logs_async("mcp_calls", days=30, limit=limit, tenant_id=user["tenant_id"])


@router.get("/categories/summary")
async def categories_summary(user: dict = Depends(get_current_user)):
    """tenant별 카테고리별 로그 건수 요약 (최근 30일)"""
    from datetime import date, timedelta
    from sqlalchemy import func, select
    from models.db_models import Log
    from services.database import session_scope

    since = (date.today() - timedelta(days=30)).isoformat()
    async with session_scope() as s:
        rows = (await s.execute(
            select(Log.category, func.count().label("cnt"))
            .where(Log.tenant_id == user["tenant_id"], Log.ts >= since)
            .group_by(Log.category)
            .order_by(func.count().desc())
        )).all()
    return [{"category": r.category, "count": r.cnt} for r in rows]
