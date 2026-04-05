"""
프로젝트 교체 서비스

local 모드: data/projects.json 파일 기반 (기존)
saas 모드: SQLite DB 기반 (멀티테넌트)
"""
import json
import os
from pathlib import Path

from services.log_store import AIOPS_MODE, LOCAL_TENANT

PROJECTS_FILE = Path(os.getenv("PROJECTS_FILE", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "projects.json")))

DEFAULT_PROJECTS = [
    {"name": "inconus-api-erp-v2", "url": "github.com/inconus/api-erp-v2", "domain": "건설 ERP", "repoPath": "", "status": "active"},
    {"name": "inconus-hr-system", "url": "github.com/inconus/hr-system", "domain": "인사관리", "repoPath": "", "status": "ready"},
    {"name": "ecommerce-api", "url": "github.com/myorg/ecommerce-api", "domain": "이커머스", "repoPath": "", "status": "ready"},
]


# --- 파일 기반 (local 모드) ---

def _load_projects() -> list[dict]:
    if PROJECTS_FILE.exists():
        with open(PROJECTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return DEFAULT_PROJECTS.copy()


def _save_projects(projects: list[dict]):
    PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(PROJECTS_FILE, "w", encoding="utf-8") as f:
        json.dump(projects, f, ensure_ascii=False, indent=2)


# --- DB 기반 (saas 모드) ---

async def _db_get_projects(tenant_id: str) -> list[dict]:
    import aiosqlite
    from services.db import DB_PATH
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT name, url, domain, repo_path, status FROM projects WHERE tenant_id = ?",
            (tenant_id,),
        )
        rows = await cursor.fetchall()
    return [{"name": r["name"], "url": r["url"], "domain": r["domain"], "repoPath": r["repo_path"], "status": r["status"]} for r in rows]


async def _db_swap_project(tenant_id: str, name: str, repo_path: str = "", git_url: str = "") -> dict:
    import aiosqlite
    from services.db import DB_PATH
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        await conn.execute(
            "UPDATE projects SET status = 'ready' WHERE tenant_id = ? AND status = 'active'",
            (tenant_id,),
        )
        cursor = await conn.execute(
            "SELECT id FROM projects WHERE tenant_id = ? AND name = ?",
            (tenant_id, name),
        )
        row = await cursor.fetchone()
        if row:
            await conn.execute(
                "UPDATE projects SET status = 'active', repo_path = CASE WHEN ? != '' THEN ? ELSE repo_path END, url = CASE WHEN ? != '' THEN ? ELSE url END WHERE tenant_id = ? AND name = ?",
                (repo_path, repo_path, git_url, git_url, tenant_id, name),
            )
        else:
            await conn.execute(
                "INSERT INTO projects (tenant_id, name, url, domain, repo_path, status) VALUES (?, ?, ?, '새 프로젝트', ?, 'active')",
                (tenant_id, name, git_url or "", repo_path),
            )
        await conn.commit()
    return {"success": True, "active": name}


# --- 통합 인터페이스 ---

def get_projects(tenant_id: str = LOCAL_TENANT) -> list[dict]:
    """프로젝트 목록 반환 (local 모드 전용, 동기)"""
    if AIOPS_MODE == "saas":
        return []  # saas 모드에서는 async 버전 사용
    return _load_projects()


async def get_projects_async(tenant_id: str = LOCAL_TENANT) -> list[dict]:
    if AIOPS_MODE == "saas":
        return await _db_get_projects(tenant_id)
    return _load_projects()


def get_active_project(tenant_id: str = LOCAL_TENANT) -> dict | None:
    """활성 프로젝트 반환 (local 모드 전용, 동기)"""
    if AIOPS_MODE == "saas":
        return None  # saas 모드에서는 async 버전 사용
    projects = _load_projects()
    for p in projects:
        if p.get("status") == "active":
            return p
    return projects[0] if projects else None


async def get_active_project_async(tenant_id: str = LOCAL_TENANT) -> dict | None:
    if AIOPS_MODE == "saas":
        projects = await _db_get_projects(tenant_id)
        for p in projects:
            if p.get("status") == "active":
                return p
        return projects[0] if projects else None
    return get_active_project()


def swap_project(name: str, repo_path: str = "", git_url: str = "", tenant_id: str = LOCAL_TENANT) -> dict:
    """프로젝트 교체 (local 모드 전용, 동기)"""
    projects = _load_projects()
    for p in projects:
        if p.get("status") == "active":
            p["status"] = "ready"
    found = False
    for p in projects:
        if p["name"] == name:
            p["status"] = "active"
            if repo_path:
                p["repoPath"] = repo_path
            if git_url:
                p["url"] = git_url
            found = True
            break
    if not found:
        projects.append({
            "name": name, "url": git_url or "", "domain": "새 프로젝트",
            "repoPath": repo_path, "status": "active",
        })
    _save_projects(projects)
    return {"success": True, "active": name}


async def swap_project_async(name: str, repo_path: str = "", git_url: str = "", tenant_id: str = LOCAL_TENANT) -> dict:
    if AIOPS_MODE == "saas":
        return await _db_swap_project(tenant_id, name, repo_path, git_url)
    return swap_project(name, repo_path, git_url)
