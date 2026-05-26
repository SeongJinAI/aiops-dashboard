from fastapi import APIRouter, Depends, Header, HTTPException, Request
from middleware.auth import get_current_user
from models.schemas import SwapRequest
from services.auth import verify_api_key, verify_api_key_db
from services.project_swap import (
    get_projects,
    get_active_project,
    swap_project,
    get_projects_async,
    get_active_project_async,
    swap_project_async,
)
from services.log_store import AIOPS_MODE
from services.rate_limit import limiter

router = APIRouter()


@router.get("/")
async def list_projects(user: dict = Depends(get_current_user)):
    if AIOPS_MODE == "saas":
        return await get_projects_async(tenant_id=user["tenant_id"])
    return get_projects()


@router.get("/active")
async def active_project(user: dict = Depends(get_current_user)):
    if AIOPS_MODE == "saas":
        project = await get_active_project_async(tenant_id=user["tenant_id"])
    else:
        project = get_active_project()

    if project:
        return project
    return {"error": "No active project"}


@router.post("/swap")
async def swap(req: SwapRequest, user: dict = Depends(get_current_user)):
    if AIOPS_MODE == "saas":
        result = await swap_project_async(req.name, req.repoPath, req.gitUrl, tenant_id=user["tenant_id"])
    else:
        result = swap_project(req.name, req.repoPath, req.gitUrl)
        from main import restart_watcher
        restart_watcher()

    return result


@router.post("/register")
@limiter.limit("30/minute")
async def register_by_apikey(
    request: Request,
    req: SwapRequest,
    x_api_key: str = Header(..., alias="X-API-Key"),
):
    """X-API-Key 인증으로 프로젝트를 등록(활성화)한다. 통합 install.sh 스크립트 전용.

    swap과 달리 Bearer JWT 대신 API 키를 받아 사용자 PC의 설치 스크립트가
    별도 로그인 절차 없이 활성 프로젝트를 지정할 수 있게 한다.
    """
    tenant_id = await verify_api_key_db(x_api_key)
    if not tenant_id:
        tenant_id = verify_api_key(x_api_key)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")

    if AIOPS_MODE == "saas":
        return await swap_project_async(req.name, req.repoPath, req.gitUrl, tenant_id=tenant_id)

    result = swap_project(req.name, req.repoPath, req.gitUrl)
    try:
        from main import restart_watcher
        restart_watcher()
    except Exception:
        pass
    return result
