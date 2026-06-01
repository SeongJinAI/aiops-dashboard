"""
인증 미들웨어 — FastAPI dependency

local 모드: no-op (기본 tenant 반환)
saas 모드: JWT 토큰 검증 + tenant_id 추출
"""
from fastapi import Request, HTTPException, Depends
from services.auth import verify_jwt, verify_api_key, verify_api_key_db
from services.errors import E, err
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


async def require_premium(user: dict = Depends(get_current_user)) -> dict:
    """프리미엄(Pro) 전용 라우트 게이팅. 비프리미엄이면 402."""
    from services.billing import is_premium
    if not await is_premium(user["tenant_id"]):
        raise err(E.PREMIUM_REQUIRED)
    return user


async def get_tenant_flexible(request: Request) -> dict:
    """JWT(Authorization Bearer) 또는 X-API-Key 둘 다 허용 → {tenant_id}.
    대시보드(JWT)와 로컬 skill/스크립트(X-API-Key)가 같은 엔드포인트를 쓸 수 있게 한다."""
    if AIOPS_MODE == "local":
        return {"tenant_id": LOCAL_TENANT, "sub": "local@localhost"}

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        payload = verify_jwt(auth_header[7:])
        if payload and payload.get("tenant_id"):
            return payload

    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        tenant_id = await verify_api_key_db(api_key) or verify_api_key(api_key)
        if tenant_id:
            return {"tenant_id": tenant_id, "sub": "apikey"}

    raise err(E.UNAUTHORIZED)
