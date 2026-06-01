"""
Hermes Agent API — 프로젝트 위키 자동 생성기.

엔드포인트:
  POST /api/hermes/catalog        - 자산 카탈로그 스캔 (LLM 미사용)
  POST /api/hermes/wiki/update    - 3 perspective 위키 생성 (LLM 호출, 백그라운드)
  GET  /api/hermes/wiki/latest    - 활성 프로젝트의 최신 위키
  GET  /api/hermes/runs           - 위키 생성 실행 히스토리
"""
import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import desc, func, select, update as _update

from middleware.auth import get_current_user
from services.errors import E, err
from models.db_models import HermesWiki, HermesWikiRun, Project
from services.database import session_scope
from services.db import list_assets
from services.llm import PROVIDER_NAMES
from services.log_store import AIOPS_MODE
from services.hermes.catalog import (
    AssetEntry,
    catalog_assets,
    group_by_perspective,
    summarize,
)
from services.hermes.wiki_builder import build_all_perspectives
from services.hermes.llm_client import LLMNotConfigured
from services.hermes.diff import compute_chapter_diff, compose_run_summary

router = APIRouter()


async def _load_assets(tenant_id: str, project_name: str, repo_path: str) -> list[AssetEntry]:
    """모드별 자산 소스 분기.
    - SaaS: DB의 assets 테이블(install.sh가 초기 push + Hook이 변경분 push)
    - local: 서버 파일시스템 rglob (기존 동작)
    """
    if AIOPS_MODE == "saas":
        rows = await list_assets(tenant_id, project_name)
        result: list[AssetEntry] = []
        for r in rows:
            content = r["content"] or ""
            size = r["size_bytes"] or len(content.encode("utf-8"))
            result.append(AssetEntry(
                path=r["path"],
                perspective=r["perspective"] or "developer",
                size_bytes=size,
                preview=content[:240],
                bucket=r["bucket"] or "misc",
                content=content,
            ))
        return result
    return catalog_assets(repo_path)


async def _get_active_project_path(tenant_id: str) -> tuple[str, str]:
    """tenant의 활성 프로젝트 (name, repo_path) 반환."""
    async with session_scope() as s:
        row = (await s.execute(
            select(Project.name, Project.repo_path)
            .where(Project.tenant_id == tenant_id, Project.status == "active")
            .limit(1)
        )).first()
    if not row:
        return "", ""
    return row.name or "", row.repo_path or ""


@router.post("/catalog")
async def hermes_catalog(user: dict = Depends(get_current_user)):
    """활성 프로젝트의 .md 자산을 스캔하여 perspective별로 분류된 카탈로그 반환.

    LLM 호출 없음. 로컬 파일 시스템 read-only.
    """
    tenant_id = user["tenant_id"]
    project_name, repo_path = await _get_active_project_path(tenant_id)
    if not project_name:
        raise err(E.NO_ACTIVE_PROJECT)
    if AIOPS_MODE == "local" and not repo_path:
        raise err(E.LOCAL_NO_REPO_PATH)

    assets = await _load_assets(tenant_id, project_name, repo_path)
    return {
        "project": project_name,
        "repoPath": repo_path,
        "summary": summarize(assets),
        "assets": group_by_perspective(assets),
    }


@router.get("/wiki/latest")
async def hermes_wiki_latest(user: dict = Depends(get_current_user)):
    """활성 프로젝트의 최신 위키 3챕터 반환."""
    tenant_id = user["tenant_id"]
    project_name, _ = await _get_active_project_path(tenant_id)
    if not project_name:
        return {"project": "", "perspectives": {}, "version": 0, "updatedAt": None}

    # perspective별 MAX(version) 서브쿼리
    sub = (
        select(
            HermesWiki.perspective,
            func.max(HermesWiki.version).label("max_v"),
        )
        .where(HermesWiki.tenant_id == tenant_id, HermesWiki.project_name == project_name)
        .group_by(HermesWiki.perspective)
        .subquery()
    )
    stmt = (
        select(
            HermesWiki.perspective, HermesWiki.content,
            HermesWiki.version, HermesWiki.updated_at,
        )
        .join(
            sub,
            (HermesWiki.perspective == sub.c.perspective)
            & (HermesWiki.version == sub.c.max_v),
        )
        .where(HermesWiki.tenant_id == tenant_id, HermesWiki.project_name == project_name)
    )
    async with session_scope() as s:
        rows = (await s.execute(stmt)).all()

    perspectives = {
        r.perspective: {
            "content": r.content,
            "version": r.version,
            "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    }
    max_version = max((p["version"] for p in perspectives.values()), default=0)
    return {
        "project": project_name,
        "perspectives": perspectives,
        "version": max_version,
        "updatedAt": max(
            (p["updatedAt"] for p in perspectives.values() if p["updatedAt"]),
            default=None,
        ),
    }


async def _publish_progress(tenant_id: str, run_id: int, stage: str, message: str, progress: int):
    """진행 상태를 EventBus로 push. WebSocket 구독자가 즉시 받음."""
    try:
        from services.event_bus import event_bus
        await event_bus.publish(tenant_id, "hermes_progress", {
            "run_id": run_id,
            "stage": stage,
            "message": message,
            "progress": progress,
            "ts": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        })
    except Exception:
        pass


async def _run_wiki_update(tenant_id: str, project_name: str, repo_path: str, run_id: int, provider: str | None = None):
    """백그라운드 작업: 카탈로그 스캔 → 3 perspective 빌드 → DB 저장.

    부분 실패 허용: 1~2개 챕터만 성공해도 success로 마무리하고 실패한 챕터의 error는
    diff_summary에 함께 기록한다. 모두 실패하면 failed.
    """
    try:
        await _publish_progress(tenant_id, run_id, "catalog", "자산 카탈로그 스캔 중...", 5)
        assets = await _load_assets(tenant_id, project_name, repo_path)
        if not assets:
            msg = (
                "자산을 찾을 수 없습니다. install.sh 또는 PostToolUse Hook으로 .md를 sync했는지 확인하세요."
                if AIOPS_MODE == "saas"
                else "자산을 찾을 수 없습니다."
            )
            await _publish_progress(tenant_id, run_id, "failed", msg, 100)
            await _finish_run(run_id, status="failed", error=msg)
            return

        await _publish_progress(tenant_id, run_id, "catalog", f"자산 {len(assets)}개 분류 완료", 15)

        grouped = {persp: [] for persp in ("planner", "developer", "user")}
        for a in assets:
            if a.perspective in grouped:
                grouped[a.perspective].append(a)

        async def _progress_cb(stage: str, message: str, progress: int) -> None:
            # progress == -1 은 재시도 알림이라 퍼센트를 바꾸지 않음
            await _publish_progress(
                tenant_id, run_id, stage, message,
                progress if progress >= 0 else 0,
            )

        chapters = await build_all_perspectives(
            project_name, repo_path, grouped,
            tenant_id=tenant_id, progress_cb=_progress_cb,
            provider=provider,
        )

        # DB 저장 — 성공한 perspective만 새 version으로 기록 + diff 계산 (단일 트랜잭션)
        from datetime import datetime as _dt, timezone as _tz
        async with session_scope() as s:
            total_chars = 0
            success_persps: list[str] = []
            failure_msgs: list[str] = []
            diffs_per_persp: dict[str, dict] = {}
            for perspective, result in chapters.items():
                if result.get("error"):
                    failure_msgs.append(f"{perspective}: {result['error']}")
                    continue
                content = result["content"]
                if not content:
                    failure_msgs.append(f"{perspective}: 빈 내용")
                    continue
                total_chars += len(content)
                success_persps.append(perspective)

                # 이전 버전 — diff 계산
                prev = (await s.execute(
                    select(HermesWiki.content, HermesWiki.version)
                    .where(
                        HermesWiki.tenant_id == tenant_id,
                        HermesWiki.project_name == project_name,
                        HermesWiki.perspective == perspective,
                    )
                    .order_by(desc(HermesWiki.version))
                    .limit(1)
                )).first()
                prev_content = prev.content if prev else ""
                prev_version = prev.version if prev else 0
                diffs_per_persp[perspective] = compute_chapter_diff(prev_content, content)

                s.add(HermesWiki(
                    tenant_id=tenant_id, project_name=project_name,
                    perspective=perspective, content=content,
                    version=prev_version + 1,
                ))

            full_summary = compose_run_summary(diffs_per_persp)
            if failure_msgs:
                full_summary += "  /  실패: " + "; ".join(failure_msgs)

            if success_persps:
                status = "success" if not failure_msgs else "partial_success"
                await s.execute(
                    _update(HermesWikiRun)
                    .where(HermesWikiRun.id == run_id)
                    .values(
                        status=status,
                        finished_at=_dt.now(_tz.utc),
                        input_count=len(assets),
                        output_chars=total_chars,
                        diff_summary=full_summary,
                        error="; ".join(failure_msgs) if failure_msgs else None,
                    )
                )
                await _publish_progress(
                    tenant_id, run_id, "complete",
                    f"완료 — {len(success_persps)}개 챕터 생성",
                    100,
                )
            else:
                await s.execute(
                    _update(HermesWikiRun)
                    .where(HermesWikiRun.id == run_id)
                    .values(
                        status="failed",
                        finished_at=_dt.now(_tz.utc),
                        input_count=len(assets),
                        output_chars=0,
                        error="; ".join(failure_msgs) or "모든 챕터 실패",
                    )
                )
                await _publish_progress(
                    tenant_id, run_id, "failed",
                    "모든 챕터 생성 실패: " + "; ".join(failure_msgs),
                    100,
                )
    except LLMNotConfigured as e:
        await _publish_progress(tenant_id, run_id, "failed", str(e), 100)
        await _finish_run(run_id, status="failed", error=str(e))
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        await _publish_progress(tenant_id, run_id, "failed", err, 100)
        await _finish_run(run_id, status="failed", error=err)


async def _finish_run(run_id: int, status: str, error: str | None = None):
    from datetime import datetime as _dt, timezone as _tz
    async with session_scope() as s:
        await s.execute(
            _update(HermesWikiRun)
            .where(HermesWikiRun.id == run_id)
            .values(status=status, finished_at=_dt.now(_tz.utc), error=error)
        )


class WikiUpdateRequest(BaseModel):
    provider: str | None = None  # 'anthropic' | 'openai' | 'gemini'. None이면 anthropic 기본.


@router.post("/wiki/update")
async def hermes_wiki_update(
    background: BackgroundTasks,
    req: WikiUpdateRequest | None = None,
    user: dict = Depends(get_current_user),
):
    """활성 프로젝트의 3 perspective 위키를 비동기로 생성한다.

    body: { "provider": "openai" }  — 선택. 미지정 시 anthropic 기본.
    즉시 run_id 반환. 진행 상황은 WebSocket /ws/logs 의 hermes_progress 카테고리 또는 GET /runs 폴링.
    """
    tenant_id = user["tenant_id"]
    project_name, repo_path = await _get_active_project_path(tenant_id)
    if not project_name:
        raise err(E.NO_ACTIVE_PROJECT)
    if AIOPS_MODE == "local" and not repo_path:
        raise err(E.LOCAL_NO_REPO_PATH)

    provider = (req.provider if req else None) or None
    if provider and provider not in PROVIDER_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 provider: {provider!r}. 사용 가능: {sorted(PROVIDER_NAMES)}",
        )

    # 이미 진행 중인 run이 있으면 거부 + 새 run row 생성 (한 트랜잭션)
    async with session_scope() as s:
        running = (await s.execute(
            select(HermesWikiRun.id).where(
                HermesWikiRun.tenant_id == tenant_id,
                HermesWikiRun.project_name == project_name,
                HermesWikiRun.status == "running",
            )
        )).first()
        if running:
            raise err(E.RUN_IN_PROGRESS)
        new_run = HermesWikiRun(
            tenant_id=tenant_id, project_name=project_name, status="running",
        )
        s.add(new_run)
        await s.flush()
        run_id = new_run.id

    background.add_task(_run_wiki_update, tenant_id, project_name, repo_path, run_id, provider)
    return {"run_id": run_id, "status": "running", "project": project_name, "provider": provider or "anthropic"}


def _run_to_dict(r: HermesWikiRun) -> dict:
    return {
        "id": r.id,
        "tenant_id": r.tenant_id,
        "project_name": r.project_name,
        "status": r.status,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        "input_count": r.input_count,
        "output_chars": r.output_chars,
        "error": r.error,
        "diff_summary": r.diff_summary,
    }


@router.get("/runs/{run_id}")
async def hermes_run_get(run_id: int, user: dict = Depends(get_current_user)):
    """단일 run의 현재 상태 조회 (폴링용)."""
    tenant_id = user["tenant_id"]
    async with session_scope() as s:
        run = (await s.execute(
            select(HermesWikiRun).where(
                HermesWikiRun.id == run_id, HermesWikiRun.tenant_id == tenant_id,
            )
        )).scalar_one_or_none()
    if not run:
        raise err(E.NOT_FOUND_RUN)
    return _run_to_dict(run)


@router.get("/wiki/versions")
async def hermes_wiki_versions(
    perspective: str,
    user: dict = Depends(get_current_user),
):
    """활성 프로젝트의 특정 perspective 버전 히스토리.

    응답: [{version, updatedAt, chars, diffFromPrev: {summary, added, removed, char_delta}}]
    최신 버전이 먼저.
    """
    if perspective not in ("planner", "developer", "user"):
        raise err(E.INVALID_PERSPECTIVE)

    tenant_id = user["tenant_id"]
    project_name, _ = await _get_active_project_path(tenant_id)
    if not project_name:
        return []

    async with session_scope() as s:
        rows = (await s.execute(
            select(HermesWiki.version, HermesWiki.content, HermesWiki.updated_at)
            .where(
                HermesWiki.tenant_id == tenant_id,
                HermesWiki.project_name == project_name,
                HermesWiki.perspective == perspective,
            )
            .order_by(HermesWiki.version.asc())
        )).all()

    result: list[dict] = []
    prev_content = ""
    for r in rows:
        d = compute_chapter_diff(prev_content, r.content)
        result.append({
            "version": r.version,
            "updatedAt": r.updated_at.isoformat() if r.updated_at else None,
            "chars": len(r.content or ""),
            "diffFromPrev": d,
        })
        prev_content = r.content
    return list(reversed(result))


@router.get("/wiki/version")
async def hermes_wiki_version_get(
    perspective: str,
    version: int,
    user: dict = Depends(get_current_user),
):
    """활성 프로젝트의 특정 버전 본문."""
    if perspective not in ("planner", "developer", "user"):
        raise err(E.INVALID_PERSPECTIVE)
    tenant_id = user["tenant_id"]
    project_name, _ = await _get_active_project_path(tenant_id)
    if not project_name:
        raise err(E.NO_ACTIVE_PROJECT)

    async with session_scope() as s:
        row = (await s.execute(
            select(HermesWiki.version, HermesWiki.content, HermesWiki.updated_at)
            .where(
                HermesWiki.tenant_id == tenant_id,
                HermesWiki.project_name == project_name,
                HermesWiki.perspective == perspective,
                HermesWiki.version == version,
            )
        )).first()
    if not row:
        raise err(E.NOT_FOUND_WIKI_VERSION)
    return {
        "perspective": perspective,
        "version": row.version,
        "content": row.content,
        "updatedAt": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.get("/runs")
async def hermes_runs(limit: int = 20, user: dict = Depends(get_current_user)):
    """위키 생성 실행 히스토리."""
    tenant_id = user["tenant_id"]
    async with session_scope() as s:
        runs = (await s.execute(
            select(HermesWikiRun)
            .where(HermesWikiRun.tenant_id == tenant_id)
            .order_by(desc(HermesWikiRun.id))
            .limit(limit)
        )).scalars().all()
    return [_run_to_dict(r) for r in runs]
