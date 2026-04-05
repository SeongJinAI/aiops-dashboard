from fastapi import APIRouter
from models.schemas import SwapRequest
from services.project_swap import get_projects, get_active_project, swap_project
from services.log_store import AIOPS_MODE

router = APIRouter()


@router.get("/")
async def list_projects():
    if AIOPS_MODE == "saas":
        from services.project_swap import get_projects_async
        return await get_projects_async()
    return get_projects()


@router.get("/active")
async def active_project():
    if AIOPS_MODE == "saas":
        from services.project_swap import get_active_project_async
        project = await get_active_project_async()
    else:
        project = get_active_project()

    if project:
        return project
    return {"error": "No active project"}


@router.post("/swap")
async def swap(req: SwapRequest):
    if AIOPS_MODE == "saas":
        from services.project_swap import swap_project_async
        result = await swap_project_async(req.name, req.repoPath, req.gitUrl)
    else:
        result = swap_project(req.name, req.repoPath, req.gitUrl)
        from main import restart_watcher
        restart_watcher()

    return result
