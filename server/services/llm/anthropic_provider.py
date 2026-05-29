"""
Anthropic (Claude) provider. 기존 hermes/llm_client.py의 로직을 이전.
"""
from __future__ import annotations

import asyncio
from typing import Awaitable, Callable

from anthropic import AsyncAnthropic
from anthropic import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    InternalServerError,
    RateLimitError,
)

try:
    from anthropic import OverloadedError  # type: ignore
except Exception:  # pragma: no cover
    OverloadedError = None  # type: ignore

from .base import LLMProvider, OnRetryCallback


_RETRY_DELAYS = (1.0, 4.0, 16.0)

_VERIFY_MODELS = (
    "claude-haiku-4-5",
    "claude-3-5-haiku-latest",
    "claude-3-haiku-20240307",
)


def _is_retryable(exc: BaseException) -> tuple[bool, str]:
    if isinstance(exc, RateLimitError):
        return True, "429 Rate Limit"
    if isinstance(exc, InternalServerError):
        return True, "500 Internal Server"
    if OverloadedError is not None and isinstance(exc, OverloadedError):
        return True, "529 Overloaded"
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return True, "네트워크/타임아웃"
    if isinstance(exc, APIStatusError):
        status = getattr(exc, "status_code", None)
        if status in (502, 503, 504, 529):
            return True, f"{status} Status"
    return False, ""


class AnthropicProvider(LLMProvider):
    name = "anthropic"  # type: ignore
    label = "Anthropic Claude"
    default_model = "claude-sonnet-4-5"
    env_key_var = "ANTHROPIC_API_KEY"
    settings_url = "https://console.anthropic.com/settings/keys"

    async def complete(
        self,
        prompt: str,
        system: str = "",
        model: str | None = None,
        max_tokens: int = 8000,
        on_retry: OnRetryCallback | None = None,
    ) -> str:
        key = await self.require_key()
        client = AsyncAnthropic(api_key=key)
        model = model or self.default_model

        kwargs = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            kwargs["system"] = system

        max_attempts = len(_RETRY_DELAYS) + 1
        last_exc: BaseException | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                response = await client.messages.create(**kwargs)
                parts = [b.text for b in response.content if getattr(b, "type", None) == "text"]
                return "".join(parts).strip()
            except Exception as e:
                retryable, reason = _is_retryable(e)
                last_exc = e
                if not retryable or attempt >= max_attempts:
                    raise
                delay = _RETRY_DELAYS[attempt - 1]
                if on_retry:
                    try:
                        await on_retry(attempt, max_attempts, f"{reason} — {delay:.0f}초 후 재시도")
                    except Exception:
                        pass
                await asyncio.sleep(delay)
        if last_exc:
            raise last_exc
        raise RuntimeError("Anthropic complete() 실패 (원인 미상)")

    @classmethod
    async def verify_key(cls, key: str) -> tuple[bool, str]:
        if not key or not key.strip():
            return False, "키가 비어있습니다."
        client = AsyncAnthropic(api_key=key.strip())
        last_error = ""
        for model in _VERIFY_MODELS:
            try:
                resp = await client.messages.create(
                    model=model, max_tokens=8,
                    messages=[{"role": "user", "content": "ok"}],
                )
                _ = resp.content
                return True, f"유효한 키입니다 (검증 모델: {model})."
            except Exception as e:
                msg = str(e)
                last_error = f"{type(e).__name__}: {msg}"
                if "401" in msg or "authentication" in msg.lower() or ("invalid" in msg.lower() and "key" in msg.lower()):
                    return False, f"인증 실패 — 키가 잘못되었거나 폐기되었습니다. ({msg[:140]})"
                if "credit balance" in msg.lower() or "credit_balance" in msg.lower():
                    return False, (
                        "키는 유효하지만 Anthropic 계정의 크레딧 잔액이 부족합니다. "
                        "https://console.anthropic.com/settings/billing 에서 충전 후 다시 등록하세요."
                    )
                if "429" in msg:
                    return False, "Rate limit 초과 — 잠시 후 재시도하세요."
                continue
        return False, f"검증 실패 — 시도한 모델: {', '.join(_VERIFY_MODELS)}. 마지막 에러: {last_error[:200]}"
