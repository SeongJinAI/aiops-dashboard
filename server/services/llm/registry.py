"""
Provider registry — 이름으로 provider 인스턴스를 가져온다.
"""
from __future__ import annotations

from .base import LLMProvider, ProviderName, PROVIDER_NAMES


def get_provider(name: str, tenant_id: str | None = None,
                 allow_claude_env_fallback: bool = True) -> LLMProvider:
    """name으로 provider 인스턴스 생성. 알 수 없으면 ValueError.

    allow_claude_env_fallback=False면 ~/.claude/.env 폴백을 끈다(관리형 경로 전용).
    """
    name = (name or "").lower()
    if name not in PROVIDER_NAMES:
        raise ValueError(f"알 수 없는 provider: {name!r}. 사용 가능: {PROVIDER_NAMES}")

    if name == "anthropic":
        from .anthropic_provider import AnthropicProvider
        return AnthropicProvider(tenant_id=tenant_id, allow_claude_env_fallback=allow_claude_env_fallback)
    if name == "openai":
        from .openai_provider import OpenAIProvider
        return OpenAIProvider(tenant_id=tenant_id, allow_claude_env_fallback=allow_claude_env_fallback)
    if name == "gemini":
        from .gemini_provider import GeminiProvider
        return GeminiProvider(tenant_id=tenant_id, allow_claude_env_fallback=allow_claude_env_fallback)
    raise ValueError(f"provider 매핑 누락: {name}")


def list_available_providers() -> list[dict]:
    """클라이언트에 보여줄 메타데이터 — 등록 UI와 드롭다운에 사용."""
    out = []
    for n in PROVIDER_NAMES:
        try:
            p = get_provider(n)
            out.append({
                "name": p.name,
                "label": p.label,
                "defaultModel": p.default_model,
                "envKeyVar": p.env_key_var,
                "settingsUrl": p.settings_url,
            })
        except Exception:
            continue
    return out


async def verify_key(provider_name: str, key: str) -> tuple[bool, str]:
    """provider별 key 검증의 단일 진입점."""
    p = get_provider(provider_name)
    return await type(p).verify_key(key)
