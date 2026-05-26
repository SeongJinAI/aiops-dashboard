"""
Rate limiting 서비스 — slowapi 래퍼.

키 함수: 인증된 요청은 tenant_id, 비인증은 client IP 기반.
기본 한도: 외부 노출 가능성이 있는 ingest/auth는 좀 더 엄격하게.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def _key_func(request: Request) -> str:
    """tenant 우선, 없으면 IP 기반."""
    # JWT에서 tenant_id 시도
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            from services.auth import verify_jwt
            payload = verify_jwt(auth[7:])
            if payload and payload.get("tenant_id"):
                return f"tenant:{payload['tenant_id']}"
        except Exception:
            pass
    # API 키
    api_key = request.headers.get("X-API-Key", "")
    if api_key:
        return f"apikey:{api_key[:12]}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_key_func, default_limits=["120/minute"])
