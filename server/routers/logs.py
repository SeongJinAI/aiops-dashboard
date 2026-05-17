from datetime import date
from fastapi import APIRouter, Depends, Query
from middleware.auth import get_current_user
from services.log_store import read_log_file

router = APIRouter()


@router.get("/hooks")
async def get_hook_logs(target_date: str = Query(default=None), user: dict = Depends(get_current_user)):
    d = target_date or date.today().isoformat()
    return await read_log_file("hooks", d, tenant_id=user["tenant_id"])


@router.get("/prompts")
async def get_prompt_logs(target_date: str = Query(default=None), user: dict = Depends(get_current_user)):
    d = target_date or date.today().isoformat()
    return await read_log_file("prompts", d, tenant_id=user["tenant_id"])


@router.get("/workflow")
async def get_workflow_logs(target_date: str = Query(default=None), user: dict = Depends(get_current_user)):
    d = target_date or date.today().isoformat()
    return await read_log_file("workflow", d, tenant_id=user["tenant_id"])
