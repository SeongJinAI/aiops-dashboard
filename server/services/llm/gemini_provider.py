"""
Google Gemini provider — google-genai SDK 사용 (신 SDK).

키 발급: https://aistudio.google.com/apikey
"""
from __future__ import annotations

import asyncio

from .base import LLMProvider, OnRetryCallback


_RETRY_DELAYS = (1.0, 4.0, 16.0)

_VERIFY_MODELS = (
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
)


def _is_retryable_gemini(exc: BaseException) -> tuple[bool, str]:
    """Gemini는 google.api_core.exceptions를 사용하는데, 표준이라기보단 메시지 패턴 매칭."""
    msg = str(exc)
    if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
        return True, "429/Resource Exhausted"
    if "500" in msg or "INTERNAL" in msg:
        return True, "500 Internal"
    if "503" in msg or "UNAVAILABLE" in msg:
        return True, "503 Unavailable"
    if "DeadlineExceeded" in msg or "timeout" in msg.lower():
        return True, "타임아웃"
    if "ConnectionError" in msg or "ConnectError" in msg:
        return True, "네트워크"
    return False, ""


class GeminiProvider(LLMProvider):
    name = "gemini"  # type: ignore
    label = "Google Gemini"
    default_model = "gemini-2.0-flash"
    env_key_var = "GEMINI_API_KEY"
    settings_url = "https://aistudio.google.com/apikey"

    async def complete(
        self,
        prompt: str,
        system: str = "",
        model: str | None = None,
        max_tokens: int = 8000,
        on_retry: OnRetryCallback | None = None,
    ) -> str:
        key = self.require_key()
        try:
            from google import genai  # type: ignore
            from google.genai import types  # type: ignore
        except ImportError:
            raise RuntimeError(
                "google-genai SDK가 설치되지 않았습니다. requirements.txt에 google-genai>=0.3 추가 필요."
            )

        client = genai.Client(api_key=key)
        model_id = model or self.default_model

        config_kwargs = {"max_output_tokens": max_tokens}
        if system:
            config_kwargs["system_instruction"] = system
        config = types.GenerateContentConfig(**config_kwargs)

        max_attempts = len(_RETRY_DELAYS) + 1
        last_exc: BaseException | None = None
        for attempt in range(1, max_attempts + 1):
            try:
                # 동기 SDK라 비동기 thread offload
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=model_id,
                    contents=prompt,
                    config=config,
                )
                text = getattr(resp, "text", None)
                if text is None and getattr(resp, "candidates", None):
                    # fallback: parts에서 직접 추출
                    parts = []
                    for cand in resp.candidates:
                        for p in getattr(getattr(cand, "content", None), "parts", []) or []:
                            t = getattr(p, "text", None)
                            if t:
                                parts.append(t)
                    text = "".join(parts)
                return (text or "").strip()
            except Exception as e:
                retryable, reason = _is_retryable_gemini(e)
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
        raise RuntimeError("Gemini complete() 실패 (원인 미상)")

    @classmethod
    async def verify_key(cls, key: str) -> tuple[bool, str]:
        if not key or not key.strip():
            return False, "키가 비어있습니다."
        try:
            from google import genai  # type: ignore
            from google.genai import types  # type: ignore
        except ImportError:
            return False, "google-genai SDK가 설치되지 않았습니다. 서버 requirements를 갱신하세요."

        client = genai.Client(api_key=key.strip())
        last_error = ""
        for model in _VERIFY_MODELS:
            try:
                resp = await asyncio.to_thread(
                    client.models.generate_content,
                    model=model,
                    contents="ok",
                    config=types.GenerateContentConfig(max_output_tokens=8),
                )
                _ = getattr(resp, "text", "")
                return True, f"유효한 키입니다 (검증 모델: {model})."
            except Exception as e:
                msg = str(e)
                last_error = f"{type(e).__name__}: {msg}"
                low = msg.lower()
                if "api key not valid" in low or "api_key" in low and "invalid" in low or "permission" in low and "denied" in low:
                    return False, f"인증 실패 — 키가 잘못되었거나 권한이 없습니다. ({msg[:140]})"
                if "429" in msg or "resource_exhausted" in low or "quota" in low:
                    return False, (
                        "Rate limit / 할당량 초과 — Google AI Studio 무료 티어 한도를 확인하거나 잠시 후 재시도하세요."
                    )
                if "not found" in low and "model" in low:
                    continue  # 다음 모델 시도
                continue
        return False, f"검증 실패 — 시도한 모델: {', '.join(_VERIFY_MODELS)}. 마지막 에러: {last_error[:200]}"
