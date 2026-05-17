"""
Claude 설정 조회 API — 프로젝트/글로벌 범위의 Claude 설정을 반환한다.
"""
from fastapi import APIRouter, Depends
from middleware.auth import get_current_user
from services.claude_config_scanner import scan_project_config, scan_global_config

router = APIRouter()


@router.get("/project")
async def project_config(user: dict = Depends(get_current_user)):
    """활성 프로젝트의 Claude 설정 반환."""
    return scan_project_config(tenant_id=user.get("tenant_id"))


@router.get("/global")
async def global_config(user: dict = Depends(get_current_user)):
    """글로벌(거버넌스) Claude 설정 반환."""
    return scan_global_config()


@router.get("/all")
async def all_config(user: dict = Depends(get_current_user)):
    """프로젝트 + 글로벌 설정을 한번에 반환."""
    return {
        "project": scan_project_config(tenant_id=user.get("tenant_id")),
        "global": scan_global_config(),
    }
