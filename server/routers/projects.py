from fastapi import APIRouter, Depends
from middleware.auth import get_current_user
from models.schemas import SwapRequest
from services.project_swap import (
    get_projects,
    get_active_project,
    swap_project,
    get_projects_async,
    get_active_project_async,
    swap_project_async,
)
from services.log_store import AIOPS_MODE

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
