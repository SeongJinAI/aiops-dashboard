"""
OpenAI (GPT) provider.

키 발급: https://platform.openai.com/api-keys
"""
from __future__ import annotations

import asyncio

from .base import LLMProvider, OnRetryCallback


_RETRY_DELAYS = (1.0, 4.0, 16.0)

_VERIFY_MODELS = (
    "gpt-4o-mini",
    "gpt-4.1-mini",
    "gpt-3.5-turbo",
)


def _is_retryable_openai(exc: BaseException) -> tuple[bool, str]:
    try:
        from openai import RateLimitError, APIConnectionError, APITimeoutError, InternalServerError, APIStatusError  # type: ignore
    except Exception:
        return False, ""
    if isinstance(exc, RateLimitError):
        return True, "429 Rate Limit"
    if isinstance(exc, InternalServerError):
        return True, "500 Internal Server"
    if isinstance(exc, (APIConnectionError, APITimeoutError)):
        return True, "네트워크/타임아웃"
    if isinstance(exc, APIStatusError):
        status = getattr(exc, "status_code", None)
        if status in (502, 503, 504, 529):
            return True, f"{status} Status"
    return False, ""


class OpenAIProvider(LLMProvider):
    name = "openai"  # type: ignore
    label = "OpenAI GPT"
    default_model = "gpt-4o"
    env_key_var = "OPENAI_API_KEY"
    settings_url = "https://platform.openai.com/api-keys"

    async def complete(
        self,
        prompt: str,
        system: str = "",
        model: str | None = None,
        max_tokens: int = 8000,
        on_retry: OnRetryCallback | None = None,
    ) -> str:
        key = self.require_key()
        from openai import AsyncOpenAI  # type: ignore

        client = AsyncOpenAI(api_key=key)
        model = model or self.default_model

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        max_attempts = len(_RETRY_DELAYS) + 1
        last_exc: BaseException | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    max_tokens=max_tokens,
                    messages=messages,
                )
                choice = resp.choices[0] if resp.choices else None
                content = choice.message.content if choice and choice.message else ""
                return (content or "").strip()
            except Exception as e:
                retryable, reason = _is_retryable_openai(e)
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
        raise RuntimeError("OpenAI complete() 실패 (원인 미상)")

    @classmethod
    async def verify_key(cls, key: str) -> tuple[bool, str]:
        if not key or not key.strip():
            return False, "키가 비어있습니다."
        try:
            from openai import AsyncOpenAI  # type: ignore
        except ImportError:
            return False, "openai SDK가 설치되지 않았습니다. 서버 requirements를 갱신하세요."

        client = AsyncOpenAI(api_key=key.strip())
        last_error = ""
        for model in _VERIFY_MODELS:
            try:
                resp = await client.chat.completions.create(
                    model=model, max_tokens=8,
                    messages=[{"role": "user", "content": "ok"}],
                )
                _ = resp.choices
                return True, f"유효한 키입니다 (검증 모델: {model})."
            except Exception as e:
                msg = str(e)
                last_error = f"{type(e).__name__}: {msg}"
                if "401" in msg or "invalid_api_key" in msg.lower() or "incorrect api key" in msg.lower():
                    return False, f"인증 실패 — 키가 잘못되었거나 폐기되었습니다. ({msg[:140]})"
                if "insufficient_quota" in msg.lower() or "quota" in msg.lower() and "exceeded" in msg.lower():
                    return False, (
                        "키는 유효하지만 OpenAI 계정 한도(quota)가 부족합니다. "
                        "https://platform.openai.com/account/billing/overview 에서 확인."
                    )
                if "429" in msg:
                    return False, "Rate limit 초과 — 잠시 후 재시도하세요."
                continue
        return False, f"검증 실패 — 시도한 모델: {', '.join(_VERIFY_MODELS)}. 마지막 에러: {last_error[:200]}"
