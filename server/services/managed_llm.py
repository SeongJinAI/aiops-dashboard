"""
관리형 LLM 접근 — 비개발자 유저에게 '개발자가 커스텀한 AI'를 제공한다.

타겟이 비개발자 바이브코더라, 시스템 프롬프트(Coach/Chat/Library의 _SYS 등)는
개발자가 작성해 두고, 유저는 본인 키 없이 결과만 받는다.

흐름:
  1) BYOK: 사용자가 등록한 키가 있으면 그 키로 호출(미터링 없음 — 본인 비용).
  2) 관리형: 없으면 Nova 키(env)로 호출하되 plan별 월 쿼터를 차감.
     쿼터 초과 → QuotaExceeded. 관리형 키 미설정 + BYOK 없음 → LLMNotConfigured.

관리형 키는 provider 표준 env(예: ANTHROPIC_API_KEY)로 설정. 관리형 provider/모델은
NOVA_LLM_PROVIDER(기본 anthropic)로 고정 — 유저가 고르지 않는다(개발자가 커스텀).
"""
from __future__ import annotations

import os

from services.llm.base import LLMNotConfigured, PROVIDER_NAMES
from services.llm.registry import get_provider
from services.secret_store import get_secret_plain

MANAGED_PROVIDER = os.getenv("NOVA_LLM_PROVIDER", "anthropic")


async def complete(tenant_id: str, prompt: str, system: str = "",
                   max_tokens: int = 1200, provider_pref: str | None = None) -> str:
    """관리형 우선 정책으로 LLM 호출. BYOK가 있으면 그것을 우선한다."""
    from services import billing, usage  # 지연 import (순환 회피)

    pref = (provider_pref or MANAGED_PROVIDER).lower()

    # 1) BYOK 우선 — 사용자가 등록한 키가 있으면 그 키로(미터링 없음)
    if pref in PROVIDER_NAMES:
        byok = await get_secret_plain(tenant_id, pref)
        if byok:
            return await get_provider(pref, tenant_id=tenant_id).complete(
                prompt, system=system, max_tokens=max_tokens)

    # 2) 관리형 — Nova 키(명시적 env만, 예: ANTHROPIC_API_KEY) + plan 쿼터
    #    allow_claude_env_fallback=False: 호스트 ~/.claude/.env 개인 키로 폴백 차단(H2)
    managed = get_provider(MANAGED_PROVIDER, allow_claude_env_fallback=False)
    if not await managed.load_key():
        raise LLMNotConfigured(
            "AI가 아직 설정되지 않았습니다. 연결 설정에서 본인 LLM 키를 등록하면 바로 사용할 수 있습니다.")

    sub = await billing.get_subscription(tenant_id)
    quota = usage.quota_for(sub["plan"])
    if not await usage.try_consume(tenant_id, quota):
        raise usage.QuotaExceeded(
            f"이번 달 AI 사용량({quota}회)을 모두 사용했습니다. "
            "Pro로 업그레이드하거나 연결 설정에서 본인 LLM 키를 등록하세요.")

    return await managed.complete(prompt, system=system, max_tokens=max_tokens)
