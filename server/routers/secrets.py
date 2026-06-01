"""
사용자별 외부 API 키(BYOK) 관리 라우터 — 멀티 프로바이더.

엔드포인트 (path parameter로 일반화):
  POST   /api/secrets/{kind}   - 키 등록 + 검증
  GET    /api/secrets/{kind}   - 등록 상태
  DELETE /api/secrets/{kind}   - 키 삭제
  GET    /api/secrets/         - 모든 provider 등록 상태 (대시보드용)
  GET    /api/secrets/providers - 사용 가능한 provider 메타데이터

kind: anthropic | openai | gemini

하위 호환: /api/secrets/anthropic 그대로 동작.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from middleware.auth import get_current_user
from services.rate_limit import limiter
from services.secret_store import (
    store_secret,
    get_secret_status,
    delete_secret,
    verify_provider_key,
)
from services.llm import PROVIDER_NAMES, list_available_providers

router = APIRouter()


_VALID_KINDS = set(PROVIDER_NAMES)


class RegisterRequest(BaseModel):
    key: str
    skip_verification: bool = False


class RegisterResponse(BaseModel):
    has_key: bool
    preview: str
    verified: bool
    message: str


def _check_kind(kind: str) -> str:
    kind = (kind or "").lower()
    if kind not in _VALID_KINDS:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 provider: {kind!r}. 사용 가능: {sorted(_VALID_KINDS)}",
        )
    return kind


@router.get("/providers")
async def get_providers(user: dict = Depends(get_current_user)):
    """사용 가능한 provider 메타데이터 (이름, 라벨, 발급 URL 등)."""
    return list_available_providers()


@router.get("")
@router.get("/")
async def get_all_status(user: dict = Depends(get_current_user)):
    """tenant의 모든 provider 등록 상태 — 드롭다운 채우기용."""
    out = []
    for kind in PROVIDER_NAMES:
        st = await get_secret_status(user["tenant_id"], kind)
        out.append({"kind": kind, **st})
    return out


@router.get("/{kind}")
async def provider_status(kind: str, user: dict = Depends(get_current_user)):
    kind = _check_kind(kind)
    return await get_secret_status(user["tenant_id"], kind)


@router.post("/{kind}", response_model=RegisterResponse)
@limiter.limit("10/minute")
async def provider_register(
    kind: str,
    request: Request,
    req: RegisterRequest,
    user: dict = Depends(get_current_user),
):
    kind = _check_kind(kind)
    plain = req.key.strip()
    if not plain:
        raise HTTPException(status_code=400, detail="키가 비어있습니다.")

    verified = False
    message = "검증 생략 — 사용 시점에 유효성이 판명됩니다."
    if not req.skip_verification:
        ok, msg = await verify_provider_key(kind, plain)
        if not ok:
            # 400(요청검증) — 중앙 예외 핸들러가 warning으로 로깅한다.
            raise HTTPException(status_code=400, detail=msg)
        verified = True
        message = msg

    result = await store_secret(user["tenant_id"], kind, plain)
    plain = ""
    req.key = ""

    return RegisterResponse(
        has_key=True,
        preview=result["preview"],
        verified=verified,
        message=message,
    )


@router.delete("/{kind}")
async def provider_delete(kind: str, user: dict = Depends(get_current_user)):
    kind = _check_kind(kind)
    removed = await delete_secret(user["tenant_id"], kind)
    return {"removed": removed}
