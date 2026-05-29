"""
Hermes의 LLM 호출 facade.

이전에는 Anthropic 전용이었으나 services.llm 추상 레이어 도입 이후 모든 provider로 위임된다.
하위 호환을 위해 같은 함수 시그니처(complete) 유지.
"""
from __future__ import annotations

from typing import Awaitable, Callable

from services.llm import LLMNotConfigured, ProviderName, get_provider


DEFAULT_PROVIDER: ProviderName = "anthropic"
DEFAULT_MODEL = "claude-sonnet-4-5"  # 하위 호환 (사용처에서 직접 참조)

OnRetryCallback = Callable[[int, int, str], Awaitable[None]]


async def complete(
    prompt: str,
    system: str = "",
    model: str | None = None,
    max_tokens: int = 8000,
    tenant_id: str | None = None,
    on_retry: OnRetryCallback | None = None,
    provider: ProviderName | None = None,
) -> str:
    """단일 프롬프트 호출. provider 미지정 시 anthropic 기본.

    재시도 + on_retry 콜백은 각 provider 내부에서 처리.
    """
    p = get_provider(provider or DEFAULT_PROVIDER, tenant_id=tenant_id)
    return await p.complete(
        prompt=prompt,
        system=system,
        model=model,
        max_tokens=max_tokens,
        on_retry=on_retry,
    )


# 하위 호환 별칭
async def load_anthropic_key(tenant_id: str | None = None) -> str | None:
    """[Deprecated] Anthropic 키만 로드. 일반화된 services.llm 추천."""
    p = get_provider("anthropic", tenant_id=tenant_id)
    return await p.load_key()


__all__ = ["complete", "LLMNotConfigured", "DEFAULT_MODEL", "load_anthropic_key"]
