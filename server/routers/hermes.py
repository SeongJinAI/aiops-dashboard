"""
Hermes Agent API — 프로젝트 위키 자동 생성기.

엔드포인트:
  POST /api/hermes/catalog        - 자산 카탈로그 스캔 (LLM 미사용)
  POST /api/hermes/wiki/update    - 3 perspective 위키 생성 (LLM 호출, 백그라운드)
  GET  /api/hermes/wiki/latest    - 활성 프로젝트의 최신 위키
  GET  /api/hermes/runs           - 위키 생성 실행 히스토리
"""
import asyncio
import sqlite3
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from middleware.auth import get_current_user
from services.db import DB_PATH
from services.llm import PROVIDER_NAMES
from services.hermes.catalog import (
    catalog_assets,
    group_by_perspective,
    summarize,
)
from services.hermes.wiki_builder import build_all_perspectives
from services.hermes.llm_client import LLMNotConfigured
from services.hermes.diff import compute_chapter_diff, compose_run_summary

router = APIRouter()


def _get_active_project_path(tenant_id: str) -> tuple[str, str]:
    """tenant의 활성 프로젝트 (name, repo_path) 반환."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT name, repo_path FROM projects WHERE tenant_id = ? AND status = 'active' LIMIT 1",
        (tenant_id,),
    ).fetchone()
    conn.close()
    if not row:
        return "", ""
    return row["name"] or "", row["repo_path"] or ""


@router.post("/catalog")
async def hermes_catalog(user: dict = Depends(get_current_user)):
    """활성 프로젝트의 .md 자산을 스캔하여 perspective별로 분류된 카탈로그 반환.

    LLM 호출 없음. 로컬 파일 시스템 read-only.
    """
    tenant_id = user["tenant_id"]
    project_name, repo_path = _get_active_project_path(tenant_id)
    if not repo_path:
        raise HTTPException(
            status_code=400,
            detail="활성 프로젝트가 없거나 repoPath가 비어있습니다. '프로젝트 교체' 탭에서 등록해주세요.",
        )

    assets = catalog_assets(repo_path)
    return {
        "project": project_name,
        "repoPath": repo_path,
        "summary": summarize(assets),
        "assets": group_by_perspective(assets),
    }


@router.get("/wiki/latest")
async def hermes_wiki_latest(user: dict = Depends(get_current_user)):
    """활성 프로젝트의 최신 위키 3챕터 반환. Phase 2 구현 전까지는 빈 결과."""
    tenant_id = user["tenant_id"]
    project_name, _ = _get_active_project_path(tenant_id)
    if not project_name:
        return {"project": "", "perspectives": {}, "version": 0, "updatedAt": None}

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT perspective, content, version, updated_at
        FROM hermes_wikis
        WHERE tenant_id = ? AND project_name = ?
          AND (tenant_id, project_name, perspective, version) IN (
              SELECT tenant_id, project_name, perspective, MAX(version)
              FROM hermes_wikis
              WHERE tenant_id = ? AND project_name = ?
              GROUP BY perspective
          )
        """,
        (tenant_id, project_name, tenant_id, project_name),
    ).fetchall()
    conn.close()

    perspectives = {r["perspective"]: {
        "content": r["content"],
        "version": r["version"],
        "updatedAt": r["updated_at"],
    } for r in rows}
    max_version = max((p["version"] for p in perspectives.values()), default=0)
    return {
        "project": project_name,
        "perspectives": perspectives,
        "version": max_version,
        "updatedAt": max((p["updatedAt"] for p in perspectives.values()), default=None),
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
        assets = catalog_assets(repo_path)
        if not assets:
            await _publish_progress(tenant_id, run_id, "failed", "자산을 찾을 수 없습니다.", 100)
            _finish_run(run_id, status="failed", error="자산을 찾을 수 없습니다.")
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

        # DB 저장 — 성공한 perspective만 새 version으로 기록 + diff 계산
        conn = sqlite3.connect(str(DB_PATH))
        try:
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

                # 이전 버전 가져와서 diff 계산
                prev_row = conn.execute(
                    """SELECT content, version FROM hermes_wikis
                       WHERE tenant_id=? AND project_name=? AND perspective=?
                       ORDER BY version DESC LIMIT 1""",
                    (tenant_id, project_name, perspective),
                ).fetchone()
                prev_content = prev_row[0] if prev_row else ""
                prev_version = prev_row[1] if prev_row else 0
                diff_info = compute_chapter_diff(prev_content, content)
                diffs_per_persp[perspective] = diff_info

                conn.execute(
                    """INSERT INTO hermes_wikis
                       (tenant_id, project_name, perspective, content, version)
                       VALUES (?, ?, ?, ?, ?)""",
                    (tenant_id, project_name, perspective, content, prev_version + 1),
                )

            full_summary = compose_run_summary(diffs_per_persp)
            if failure_msgs:
                full_summary += "  /  실패: " + "; ".join(failure_msgs)

            if success_persps:
                status = "success" if not failure_msgs else "partial_success"
                conn.execute(
                    """UPDATE hermes_wiki_runs
                       SET status=?, finished_at=datetime('now'),
                           input_count=?, output_chars=?, diff_summary=?,
                           error=?
                       WHERE id=?""",
                    (status, len(assets), total_chars, full_summary,
                     "; ".join(failure_msgs) if failure_msgs else None,
                     run_id),
                )
                await _publish_progress(
                    tenant_id, run_id, "complete",
                    f"완료 — {len(success_persps)}개 챕터 생성",
                    100,
                )
            else:
                conn.execute(
                    """UPDATE hermes_wiki_runs
                       SET status='failed', finished_at=datetime('now'),
                           input_count=?, output_chars=0, error=?
                       WHERE id=?""",
                    (len(assets), "; ".join(failure_msgs) or "모든 챕터 실패", run_id),
                )
                await _publish_progress(
                    tenant_id, run_id, "failed",
                    "모든 챕터 생성 실패: " + "; ".join(failure_msgs),
                    100,
                )
            conn.commit()
        finally:
            conn.close()
    except LLMNotConfigured as e:
        await _publish_progress(tenant_id, run_id, "failed", str(e), 100)
        _finish_run(run_id, status="failed", error=str(e))
    except Exception as e:
        err = f"{type(e).__name__}: {e}"
        await _publish_progress(tenant_id, run_id, "failed", err, 100)
        _finish_run(run_id, status="failed", error=err)


def _finish_run(run_id: int, status: str, error: str | None = None):
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute(
            "UPDATE hermes_wiki_runs SET status=?, finished_at=datetime('now'), error=? WHERE id=?",
            (status, error, run_id),
        )
        conn.commit()
    finally:
        conn.close()


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
    project_name, repo_path = _get_active_project_path(tenant_id)
    if not repo_path:
        raise HTTPException(status_code=400, detail="활성 프로젝트가 없습니다.")

    provider = (req.provider if req else None) or None
    if provider and provider not in PROVIDER_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 provider: {provider!r}. 사용 가능: {sorted(PROVIDER_NAMES)}",
        )

    # 이미 진행 중인 run이 있으면 거부 (간단 락)
    conn = sqlite3.connect(str(DB_PATH))
    try:
        row = conn.execute(
            "SELECT id FROM hermes_wiki_runs WHERE tenant_id=? AND project_name=? AND status='running'",
            (tenant_id, project_name),
        ).fetchone()
        if row:
            raise HTTPException(status_code=409, detail="이미 진행 중인 업데이트가 있습니다.")
        cursor = conn.execute(
            "INSERT INTO hermes_wiki_runs (tenant_id, project_name, status) VALUES (?, ?, 'running')",
            (tenant_id, project_name),
        )
        run_id = cursor.lastrowid
        conn.commit()
    finally:
        conn.close()

    # 백그라운드로 실제 실행
    background.add_task(_run_wiki_update, tenant_id, project_name, repo_path, run_id, provider)
    return {"run_id": run_id, "status": "running", "project": project_name, "provider": provider or "anthropic"}


@router.get("/runs/{run_id}")
async def hermes_run_get(run_id: int, user: dict = Depends(get_current_user)):
    """단일 run의 현재 상태 조회 (폴링용)."""
    tenant_id = user["tenant_id"]
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT * FROM hermes_wiki_runs WHERE id=? AND tenant_id=?",
            (run_id, tenant_id),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="run not found")
    return dict(row)


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
        raise HTTPException(status_code=400, detail="perspective는 planner/developer/user 중 하나")

    tenant_id = user["tenant_id"]
    project_name, _ = _get_active_project_path(tenant_id)
    if not project_name:
        return []

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """SELECT version, content, updated_at FROM hermes_wikis
               WHERE tenant_id=? AND project_name=? AND perspective=?
               ORDER BY version ASC""",
            (tenant_id, project_name, perspective),
        ).fetchall()
    finally:
        conn.close()

    result: list[dict] = []
    prev_content = ""
    for r in rows:
        d = compute_chapter_diff(prev_content, r["content"])
        result.append({
            "version": r["version"],
            "updatedAt": r["updated_at"],
            "chars": len(r["content"] or ""),
            "diffFromPrev": d,
        })
        prev_content = r["content"]
    return list(reversed(result))


@router.get("/wiki/version")
async def hermes_wiki_version_get(
    perspective: str,
    version: int,
    user: dict = Depends(get_current_user),
):
    """활성 프로젝트의 특정 버전 본문."""
    if perspective not in ("planner", "developer", "user"):
        raise HTTPException(status_code=400, detail="perspective는 planner/developer/user 중 하나")
    tenant_id = user["tenant_id"]
    project_name, _ = _get_active_project_path(tenant_id)
    if not project_name:
        raise HTTPException(status_code=404, detail="활성 프로젝트가 없습니다")

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            """SELECT version, content, updated_at FROM hermes_wikis
               WHERE tenant_id=? AND project_name=? AND perspective=? AND version=?""",
            (tenant_id, project_name, perspective, version),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="해당 버전을 찾을 수 없습니다")
    return {
        "perspective": perspective,
        "version": row["version"],
        "content": row["content"],
        "updatedAt": row["updated_at"],
    }


@router.get("/runs")
async def hermes_runs(limit: int = 20, user: dict = Depends(get_current_user)):
    """위키 생성 실행 히스토리 (Phase 2 이후 채워짐)."""
    tenant_id = user["tenant_id"]
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT id, project_name, status, started_at, finished_at,
               input_count, output_chars, error, diff_summary
        FROM hermes_wiki_runs
        WHERE tenant_id = ?
        ORDER BY id DESC
        LIMIT ?
        """,
        (tenant_id, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
