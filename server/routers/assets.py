"""
프로젝트 자산(.md) sync API — SaaS 모드의 핵심.

흐름:
  1. install.sh 초기 일괄 push      → POST /api/assets/sync (batch)
  2. PostToolUse Hook 변경분 push   → POST /api/assets/sync-one
  3. Hermes 위키 빌더 / RAG          ← list_assets() 로 DB에서 입력 로드

보안 원칙:
  - path는 repoRoot 기준 상대경로만 허용. 절대/`..`/non-.md는 거부.
  - project_name은 본 tenant의 등록된 프로젝트여야 함 (임의 이름 차단).
  - 자산당 1MB, 배치 200개 상한.
"""
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select

from models.db_models import Project
from services.auth import verify_api_key, verify_api_key_db
from services.database import session_scope
from services.db import (
    upsert_asset, upsert_assets_batch, list_assets,
    delete_asset as db_delete_asset,
)
from services.hermes.catalog import classify_asset
from services.rate_limit import limiter

router = APIRouter()

MAX_CONTENT_BYTES = 1_000_000  # 자산당 1MB
MAX_BATCH_ITEMS = 200


class AssetItem(BaseModel):
    path: str
    content: str
    size_bytes: int = 0
    modified_at: str | None = None


class SyncBatchRequest(BaseModel):
    tenant_id: str | None = None
    project_name: str
    items: list[AssetItem]


class SyncOneRequest(BaseModel):
    tenant_id: str | None = None
    project_name: str
    item: AssetItem


def _validate_path(rel: str) -> str:
    """repoRoot 기준 상대경로 검증.
    - 빈 문자열 / 절대경로 / Windows 드라이브(`C:`) / `..` 포함 거부
    - .md 확장자만 허용
    """
    p = rel.replace("\\", "/").strip()
    if not p:
        raise HTTPException(status_code=400, detail="빈 경로")
    if p.startswith("/"):
        raise HTTPException(status_code=400, detail=f"절대경로 금지: {rel}")
    first_seg = p.split("/", 1)[0]
    if len(first_seg) >= 2 and first_seg[1] == ":":
        raise HTTPException(status_code=400, detail=f"Windows 드라이브 경로 금지: {rel}")
    parts = p.split("/")
    if ".." in parts:
        raise HTTPException(status_code=400, detail=f"경로에 ..가 포함됨: {rel}")
    if not p.lower().endswith(".md"):
        raise HTTPException(status_code=400, detail=f".md 파일만 허용: {rel}")
    return p


async def _verify_project(tenant_id: str, project_name: str) -> None:
    async with session_scope() as s:
        exists = (await s.execute(
            select(Project.id).where(
                Project.tenant_id == tenant_id, Project.name == project_name,
            ).limit(1)
        )).first()
    if not exists:
        raise HTTPException(status_code=404, detail=f"등록되지 않은 프로젝트: {project_name}")


async def _authenticate(api_key: str, requested_tenant: str | None) -> str:
    tenant_id = await verify_api_key_db(api_key)
    if not tenant_id:
        tenant_id = verify_api_key(api_key)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")
    if requested_tenant and tenant_id != requested_tenant:
        raise HTTPException(status_code=403, detail="API 키와 tenant_id가 일치하지 않습니다")
    return tenant_id


def _prepare(it: AssetItem) -> tuple[dict | None, str | None]:
    """검증 + 분류. 통과하면 (row_dict, None), 거부면 (None, 사유)."""
    try:
        path = _validate_path(it.path)
    except HTTPException as e:
        return None, f"{it.path}: {e.detail}"
    if len(it.content.encode("utf-8")) > MAX_CONTENT_BYTES:
        return None, f"{it.path}: 크기 초과 (>1MB)"
    filename = path.rsplit("/", 1)[-1]
    perspective, bucket = classify_asset(path, filename)
    return {
        "path": path,
        "content": it.content,
        "size_bytes": it.size_bytes or len(it.content.encode("utf-8")),
        "modified_at": it.modified_at,
        "perspective": perspective,
        "bucket": bucket,
    }, None


@router.post("/sync")
@limiter.limit("60/minute")
async def sync_batch(request: Request, req: SyncBatchRequest, x_api_key: str = Header()):
    """install.sh 초기 일괄 push용. 한 번에 최대 200개."""
    tenant_id = await _authenticate(x_api_key, req.tenant_id)
    await _verify_project(tenant_id, req.project_name)

    if len(req.items) > MAX_BATCH_ITEMS:
        raise HTTPException(status_code=413, detail=f"배치 최대 {MAX_BATCH_ITEMS}개 (받은 {len(req.items)}개)")

    prepared: list[dict] = []
    skipped: list[str] = []
    for it in req.items:
        row, err = _prepare(it)
        if err:
            skipped.append(err)
        elif row:
            prepared.append(row)

    count = await upsert_assets_batch(tenant_id, req.project_name, prepared)
    return {"status": "ok", "count": count, "skipped": skipped}


@router.post("/sync-one")
@limiter.limit("300/minute")
async def sync_one(request: Request, req: SyncOneRequest, x_api_key: str = Header()):
    """PostToolUse Hook 변경분 push용."""
    tenant_id = await _authenticate(x_api_key, req.tenant_id)
    await _verify_project(tenant_id, req.project_name)

    row, err = _prepare(req.item)
    if err:
        raise HTTPException(status_code=400, detail=err)
    assert row is not None
    await upsert_asset(
        tenant_id, req.project_name,
        path=row["path"], content=row["content"],
        size_bytes=row["size_bytes"], modified_at=row["modified_at"],
        perspective=row["perspective"], bucket=row["bucket"],
    )
    return {"status": "ok", "path": row["path"]}


class DeleteRequest(BaseModel):
    tenant_id: str | None = None
    project_name: str
    path: str


@router.post("/delete")
async def delete_one(request: Request, req: DeleteRequest, x_api_key: str = Header()):
    """파일이 삭제된 경우 (Hook에서 호출)."""
    tenant_id = await _authenticate(x_api_key, req.tenant_id)
    await _verify_project(tenant_id, req.project_name)
    path = _validate_path(req.path)
    await db_delete_asset(tenant_id, req.project_name, path)
    return {"status": "ok"}


@router.get("/list")
async def list_(project_name: str, x_api_key: str = Header()):
    """본 tenant의 프로젝트 자산 메타 — 디버그/UI용. content 제외."""
    tenant_id = await _authenticate(x_api_key, None)
    await _verify_project(tenant_id, project_name)
    rows = await list_assets(tenant_id, project_name)
    return [{k: v for k, v in r.items() if k != "content"} for r in rows]
