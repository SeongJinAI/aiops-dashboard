"""
설치 스크립트 서빙 — 사용자가 본인 레포에서 curl로 받아 실행할 수 있게 정적 텍스트 응답
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

router = APIRouter()

SCRIPTS_DIR = Path(os.path.dirname(os.path.dirname(__file__))) / "scripts"


@router.get("/install-hook.sh", response_class=PlainTextResponse)
async def install_hook():
    path = SCRIPTS_DIR / "install-hook.sh"
    if not path.exists():
        raise HTTPException(status_code=404, detail="설치 스크립트를 찾을 수 없습니다")
    return path.read_text(encoding="utf-8")


@router.get("/aiops-log-hook.sh", response_class=PlainTextResponse)
async def log_hook_script():
    path = SCRIPTS_DIR / "hooks" / "aiops-log-hook.sh"
    if not path.exists():
        raise HTTPException(status_code=404)
    return path.read_text(encoding="utf-8")


@router.get("/aiops-log-prompt.sh", response_class=PlainTextResponse)
async def log_prompt_script():
    path = SCRIPTS_DIR / "hooks" / "aiops-log-prompt.sh"
    if not path.exists():
        raise HTTPException(status_code=404)
    return path.read_text(encoding="utf-8")


@router.get("/aiops-log-event.sh", response_class=PlainTextResponse)
async def log_event_script():
    path = SCRIPTS_DIR / "hooks" / "aiops-log-event.sh"
    if not path.exists():
        raise HTTPException(status_code=404)
    return path.read_text(encoding="utf-8")
