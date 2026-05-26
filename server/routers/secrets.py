"""
사용자별 외부 API 키(BYOK) 관리 라우터.

엔드포인트:
  POST   /api/secrets/anthropic   - 키 등록 + 검증 (필수)
  GET    /api/secrets/anthropic   - 등록 상태 (평문 노출 안 함)
  DELETE /api/secrets/anthropic   - 키 삭제
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from middleware.auth import get_current_user
from services.rate_limit import limiter
from services.secret_store import (
    store_secret,
    get_secret_status,
    delete_secret,
    verify_anthropic_key,
)

router = APIRouter()


class RegisterRequest(BaseModel):
    key: str
    skip_verification: bool = False  # 위급 시 검증 건너뛰기 옵션 (기본 검증함)


class RegisterResponse(BaseModel):
    has_key: bool
    preview: str
    verified: bool
    message: str


@router.get("/anthropic")
async def anthropic_status(user: dict = Depends(get_current_user)):
    return get_secret_status(user["tenant_id"], "anthropic")


@router.post("/anthropic", response_model=RegisterResponse)
@limiter.limit("10/minute")
async def anthropic_register(request: Request, req: RegisterRequest, user: dict = Depends(get_current_user)):
    plain = req.key.strip()
    if not plain:
        raise HTTPException(status_code=400, detail="키가 비어있습니다.")

    verified = False
    message = "검증 생략 — 사용 시점에 유효성이 판명됩니다."
    if not req.skip_verification:
        ok, msg = await verify_anthropic_key(plain)
        if not ok:
            # 디버깅을 위해 stderr에도 기록
            import sys
            print(f"[anthropic-verify] {msg}", file=sys.stderr)
            raise HTTPException(status_code=400, detail=msg)
        verified = True
        message = msg

    result = store_secret(user["tenant_id"], "anthropic", plain)
    # 메모리에서 평문 즉시 제거 노력 (Python은 완전 보장 X)
    plain = ""
    req.key = ""

    return RegisterResponse(
        has_key=True,
        preview=result["preview"],
        verified=verified,
        message=message,
    )


@router.delete("/anthropic")
async def anthropic_delete(user: dict = Depends(get_current_user)):
    removed = delete_secret(user["tenant_id"], "anthropic")
    return {"removed": removed}
