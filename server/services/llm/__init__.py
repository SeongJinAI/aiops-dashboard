"""
LLM Provider 추상 레이어 — BYOK 멀티 프로바이더(Anthropic / OpenAI / Gemini) 지원.

사용:
  from services.llm import get_provider, list_available_providers, ProviderName

  provider = get_provider("anthropic", tenant_id="abc")
  text = await provider.complete(prompt="...", system="...", max_tokens=8000)

키 로드 순서 (각 provider):
  1. tenant_secrets DB (BYOK)
  2. 환경변수 ({NAME}_API_KEY)
  3. ~/.claude/.env
"""
from .base import LLMProvider, LLMNotConfigured, ProviderName, PROVIDER_NAMES
from .registry import get_provider, list_available_providers, verify_key

__all__ = [
    "LLMProvider",
    "LLMNotConfigured",
    "ProviderName",
    "PROVIDER_NAMES",
    "get_provider",
    "list_available_providers",
    "verify_key",
]
