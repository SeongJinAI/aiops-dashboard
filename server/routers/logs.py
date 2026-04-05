from datetime import date
from fastapi import APIRouter, Query
from services.log_store import read_log_file

router = APIRouter()


@router.get("/hooks")
async def get_hook_logs(target_date: str = Query(default=None)):
    d = target_date or date.today().isoformat()
    return await read_log_file("hooks", d)


@router.get("/prompts")
async def get_prompt_logs(target_date: str = Query(default=None)):
    d = target_date or date.today().isoformat()
    return await read_log_file("prompts", d)


@router.get("/workflow")
async def get_workflow_logs(target_date: str = Query(default=None)):
    d = target_date or date.today().isoformat()
    return await read_log_file("workflow", d)
