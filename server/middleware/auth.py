"""
인증 미들웨어 — FastAPI dependency

local 모드: no-op (기본 tenant 반환)
saas 모드: JWT 토큰 검증 + tenant_id 추출
"""
from fastapi import Request, HTTPException
from services.auth import verify_jwt
from services.log_store import AIOPS_MODE, LOCAL_TENANT


async def get_current_user(request: Request) -> dict:
    """현재 사용자 정보를 반환한다. saas 모드에서는 JWT 필수."""
    if AIOPS_MODE == "local":
        return {"tenant_id": LOCAL_TENANT, "sub": "local@localhost"}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증 토큰이 필요합니다")

    token = auth_header[7:]
    payload = verify_jwt(token)
    if not payload:
        raise HTTPException(status_code=401, detail="유효하지 않거나 만료된 토큰입니다")

    return payload
