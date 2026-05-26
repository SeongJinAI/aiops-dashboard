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
from middleware.auth import get_current_user
from services.db import DB_PATH
from services.hermes.catalog import (
    catalog_assets,
    group_by_perspective,
    summarize,
)
from services.hermes.wiki_builder import build_all_perspectives
from services.hermes.llm_client import LLMNotConfigured

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


async def _run_wiki_update(tenant_id: str, project_name: str, repo_path: str, run_id: int):
    """백그라운드 작업: 카탈로그 스캔 → 3 perspective 빌드 → DB 저장."""
    try:
        assets = catalog_assets(repo_path)
        if not assets:
            _finish_run(run_id, status="failed", error="자산을 찾을 수 없습니다.")
            return

        grouped = {persp: [] for persp in ("planner", "developer", "user")}
        for a in assets:
            if a.perspective in grouped:
                grouped[a.perspective].append(a)

        chapters = await build_all_perspectives(project_name, repo_path, grouped, tenant_id=tenant_id)

        # DB 저장 — perspective별 새 version 부여
        conn = sqlite3.connect(str(DB_PATH))
        try:
            total_chars = 0
            for perspective, result in chapters.items():
                content = result["content"]
                total_chars += len(content)
                row = conn.execute(
                    "SELECT MAX(version) FROM hermes_wikis WHERE tenant_id=? AND project_name=? AND perspective=?",
                    (tenant_id, project_name, perspective),
                ).fetchone()
                prev_version = row[0] if row and row[0] else 0
                conn.execute(
                    """INSERT INTO hermes_wikis
                       (tenant_id, project_name, perspective, content, version)
                       VALUES (?, ?, ?, ?, ?)""",
                    (tenant_id, project_name, perspective, content, prev_version + 1),
                )

            # diff summary 간단 버전
            diff_summary = "; ".join(
                f"{persp}: {chapters[persp]['input_count']}개 자산 반영"
                for persp in ("planner", "developer", "user")
            )
            conn.execute(
                """UPDATE hermes_wiki_runs
                   SET status='success', finished_at=datetime('now'),
                       input_count=?, output_chars=?, diff_summary=?
                   WHERE id=?""",
                (len(assets), total_chars, diff_summary, run_id),
            )
            conn.commit()
        finally:
            conn.close()
    except LLMNotConfigured as e:
        _finish_run(run_id, status="failed", error=str(e))
    except Exception as e:
        _finish_run(run_id, status="failed", error=f"{type(e).__name__}: {e}")


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


@router.post("/wiki/update")
async def hermes_wiki_update(
    background: BackgroundTasks,
    user: dict = Depends(get_current_user),
):
    """활성 프로젝트의 3 perspective 위키를 비동기로 생성한다.

    즉시 run_id 반환. 진행 상황은 GET /runs 로 폴링.
    """
    tenant_id = user["tenant_id"]
    project_name, repo_path = _get_active_project_path(tenant_id)
    if not repo_path:
        raise HTTPException(status_code=400, detail="활성 프로젝트가 없습니다.")

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
    background.add_task(_run_wiki_update, tenant_id, project_name, repo_path, run_id)
    return {"run_id": run_id, "status": "running", "project": project_name}


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
