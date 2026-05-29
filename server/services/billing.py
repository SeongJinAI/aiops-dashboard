"""
구독/플랜 서비스 — Subscription 테이블 기반.

MVP: 실결제(Lemon Squeezy) 없이 plan 플래그로 프리미엄을 게이팅한다.
checkout은 라우터에서 목으로 즉시 plan을 'pro'로 올린다(추후 webhook으로 대체).
plan은 JWT가 아닌 DB에서 읽어, 구독 변경이 재로그인 없이 즉시 반영된다.
"""
from __future__ import annotations

from sqlalchemy import select

from models.db_models import Subscription
from services.database import session_scope

# 가격 티어 (프론트 가격표 + 게이팅의 단일 진실)
PLANS = [
    {
        "id": "free",
        "name": "Free",
        "price": 0,
        "features": [
            "내 AI 활동 자동 수집 (Track)",
            "협업 점수 + 개선 인사이트 (Coach)",
            "프로젝트 위키 자동 생성 (Wikify)",
        ],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": 19,
        "features": [
            "Free의 모든 기능",
            "프롬프트 라이브러리 — 주제별 공유 템플릿 열람·복사",
            "내 프롬프트를 공유 풀에 기여(옵트인)하고 증류 결과 활용",
            "무제한 코치 브리핑",
        ],
    },
]
_VALID_PLANS = {p["id"] for p in PLANS}


async def get_subscription(tenant_id: str) -> dict:
    """구독 상태 조회. 행이 없으면 free 기본값."""
    async with session_scope() as s:
        row = (await s.execute(
            select(Subscription).where(Subscription.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if row is None:
            return {"plan": "free", "premium": False, "share_opt_in": False}
        return {
            "plan": row.plan,
            "premium": row.plan != "free",
            "share_opt_in": bool(row.share_opt_in),
        }


async def is_premium(tenant_id: str) -> bool:
    sub = await get_subscription(tenant_id)
    return sub["premium"]


async def _upsert(tenant_id: str, **fields) -> dict:
    async with session_scope() as s:
        row = (await s.execute(
            select(Subscription).where(Subscription.tenant_id == tenant_id)
        )).scalar_one_or_none()
        if row is None:
            row = Subscription(tenant_id=tenant_id, plan="free", share_opt_in=False)
            s.add(row)
        for k, v in fields.items():
            setattr(row, k, v)
    return await get_subscription(tenant_id)


async def set_plan(tenant_id: str, plan: str) -> dict:
    if plan not in _VALID_PLANS:
        raise ValueError(f"알 수 없는 플랜: {plan}")
    return await _upsert(tenant_id, plan=plan)


async def set_share_opt_in(tenant_id: str, enabled: bool) -> dict:
    return await _upsert(tenant_id, share_opt_in=bool(enabled))
