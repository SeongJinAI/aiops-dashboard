"""
레포 데이터 API — LogStore를 통한 모드별 분기 (local: JSONL 직접 읽기 / saas: DB 조회)
"""
from fastapi import APIRouter, Query
from services.log_store import read_all_logs_async, get_prompt_stats, get_hook_stats, get_misunderstanding_stats
from services.repo_scanner import get_git_log, get_git_stats, scan_docs, scan_test_results

router = APIRouter()


# --- 프로젝트 레포 ---

@router.get("/project/commits")
async def project_commits(limit: int = Query(default=30)):
    return get_git_log(limit)


@router.get("/project/stats")
async def project_stats():
    return get_git_stats()


@router.get("/project/docs")
async def project_docs():
    return scan_docs()


# --- 테스트 레포 ---

@router.get("/test/results")
async def test_results():
    return scan_test_results()


# --- 프롬프트 ---

SYSTEM_PREFIXES = ("<task-notification>", "<system-reminder>", "<command-name>", "<local-command")


@router.get("/prompts")
async def prompts(limit: int = Query(default=100)):
    raw = await read_all_logs_async("prompts", days=90, limit=limit)
    for p in raw:
        p["is_system"] = p.get("prompt", "").lstrip().startswith(SYSTEM_PREFIXES)
    return raw


@router.get("/prompts/stats")
async def prompt_stats():
    return await get_prompt_stats()


# --- Hook 로그 ---

@router.get("/hooks")
async def hooks(limit: int = Query(default=100)):
    return await read_all_logs_async("hooks", days=7, limit=limit)


@router.get("/hooks/stats")
async def hook_stats():
    return await get_hook_stats()


# --- 오해 감지 ---

@router.get("/misunderstandings")
async def misunderstandings(limit: int = Query(default=100)):
    return await read_all_logs_async("misunderstandings", days=30, limit=limit)


@router.get("/misunderstandings/stats")
async def misunderstanding_stats():
    return await get_misunderstanding_stats()
