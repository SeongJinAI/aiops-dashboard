"""
관리형 LLM 사용량 미터링 — 테넌트·기간(월)별 요청 수 + plan 쿼터.

- 관리형(Nova 키) 호출만 집계. BYOK(본인 키) 호출은 미집계.
- 쿼터 기준: 요청 수(MVP). plan별 월 한도.
- try_consume은 조건부 UPDATE로 원자적 증가(count < quota).
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from sqlalchemy import select, update as _update

from models.db_models import LLMUsage
from services.database import session_scope

# plan별 월 관리형 호출 한도 (env로 조정 가능). free는 체험용 소량.
_QUOTAS = {
    "free": int(os.getenv("NOVA_QUOTA_FREE", "5")),
    "pro": int(os.getenv("NOVA_QUOTA_PRO", "500")),
}


class QuotaExceeded(RuntimeError):
    """관리형 LLM 월 쿼터 초과."""


def quota_for(plan: str) -> int:
    return _QUOTAS.get(plan, _QUOTAS["free"])


def current_period() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")


async def get_usage(tenant_id: str, plan: str) -> dict:
    period = current_period()
    async with session_scope() as s:
        count = (await s.execute(
            select(LLMUsage.count).where(
                LLMUsage.tenant_id == tenant_id, LLMUsage.period == period)
        )).scalar_one_or_none()
    used = int(count or 0)
    quota = quota_for(plan)
    return {"period": period, "used": used, "quota": quota, "remaining": max(0, quota - used)}


async def try_consume(tenant_id: str, quota: int) -> bool:
    """관리형 호출 1회 소비 시도. 한도 내면 True(증가), 초과면 False."""
    if quota <= 0:
        return False
    period = current_period()
    now = datetime.now(timezone.utc)
    async with session_scope() as s:
        # 1) 조건부 원자 증가 (count < quota)
        res = await s.execute(
            _update(LLMUsage)
            .where(
                LLMUsage.tenant_id == tenant_id,
                LLMUsage.period == period,
                LLMUsage.count < quota,
            )
            .values(count=LLMUsage.count + 1, updated_at=now)
        )
        if (res.rowcount or 0) > 0:
            return True
        # 2) row가 없으면 신규 생성(count=1), 있으면 한도 초과
        existing = (await s.execute(
            select(LLMUsage.count).where(
                LLMUsage.tenant_id == tenant_id, LLMUsage.period == period)
        )).scalar_one_or_none()
        if existing is None:
            s.add(LLMUsage(tenant_id=tenant_id, period=period, count=1))
            return True
        return False
