"""
구독/결제 API (MVP — 목 체크아웃).

- GET  /api/billing/status      : 현재 플랜·프리미엄 여부·공유 동의 + 가격표
- POST /api/billing/checkout    : (목) 즉시 pro로 업그레이드. 추후 Lemon Squeezy webhook으로 대체.
- POST /api/billing/cancel      : free로 다운그레이드
- POST /api/billing/share-opt-in: 공유 풀 기여 동의 토글
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth import get_current_user
from services import billing, usage
from services.rate_limit import limiter

router = APIRouter()


@router.get("/status")
async def status(user: dict = Depends(get_current_user)):
    sub = await billing.get_subscription(user["tenant_id"])
    return {**sub, "plans": billing.PLANS}


@router.get("/usage")
async def usage_status(user: dict = Depends(get_current_user)):
    """이번 달 관리형 AI 사용량 + 남은 한도."""
    sub = await billing.get_subscription(user["tenant_id"])
    return await usage.get_usage(user["tenant_id"], sub["plan"])


class CheckoutRequest(BaseModel):
    plan: str = "pro"


@router.post("/checkout")
@limiter.limit("20/minute")
async def checkout(request: Request, body: CheckoutRequest | None = None,
                   user: dict = Depends(get_current_user)):
    plan = (body.plan if body else "pro") or "pro"
    try:
        # MVP: 실결제 없이 즉시 반영 (mock). 운영에서는 결제 게이트웨이 redirect URL 반환.
        sub = await billing.set_plan(user["tenant_id"], plan)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "mock": True, **sub}


@router.post("/cancel")
async def cancel(user: dict = Depends(get_current_user)):
    return {"ok": True, **(await billing.set_plan(user["tenant_id"], "free"))}


class ShareRequest(BaseModel):
    enabled: bool


@router.post("/share-opt-in")
async def share_opt_in(body: ShareRequest, user: dict = Depends(get_current_user)):
    return {"ok": True, **(await billing.set_share_opt_in(user["tenant_id"], body.enabled))}
