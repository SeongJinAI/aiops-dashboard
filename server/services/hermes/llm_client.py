"""
Hermes — Claude API 클라이언트 래퍼 (BYOK 우선).

키 로드 순서:
  1. tenant_secrets DB (BYOK) — tenant_id가 주어졌을 때
  2. 환경변수 ANTHROPIC_API_KEY
  3. ~/.claude/.env

운영(SaaS)에서는 1번만 사용. 2/3은 개발자 본인 머신용 폴백.
"""
import os
from pathlib import Path
from anthropic import AsyncAnthropic


DEFAULT_MODEL = "claude-sonnet-4-5"


def _from_claude_env_file() -> str | None:
    env_path = Path.home() / ".claude" / ".env"
    if not env_path.exists():
        return None
    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'") or None
    except Exception:
        return None
    return None


def load_anthropic_key(tenant_id: str | None = None) -> str | None:
    """tenant_id 우선 → env → ~/.claude/.env 순으로 로드."""
    if tenant_id:
        try:
            from services.secret_store import get_secret_plain
            key = get_secret_plain(tenant_id, "anthropic")
            if key:
                return key
        except Exception:
            pass
    env_key = os.getenv("ANTHROPIC_API_KEY")
    if env_key:
        return env_key.strip() or None
    return _from_claude_env_file()


class LLMNotConfigured(RuntimeError):
    """ANTHROPIC_API_KEY가 설정되지 않은 경우."""


def get_async_client(tenant_id: str | None = None) -> AsyncAnthropic:
    """AsyncAnthropic 인스턴스를 반환. 키가 없으면 LLMNotConfigured raise."""
    key = load_anthropic_key(tenant_id)
    if not key:
        raise LLMNotConfigured(
            "Anthropic API 키가 설정되지 않았습니다. "
            "대시보드의 '연결 설정 > Anthropic 키' 에서 본인 키를 등록하세요. "
            "(https://console.anthropic.com/settings/keys 에서 발급)"
        )
    return AsyncAnthropic(api_key=key)


async def complete(
    prompt: str,
    system: str = "",
    model: str = DEFAULT_MODEL,
    max_tokens: int = 8000,
    tenant_id: str | None = None,
) -> str:
    """단일 프롬프트 호출. tenant_id가 주어지면 그 tenant의 키를 우선 사용."""
    client = get_async_client(tenant_id)
    messages = [{"role": "user", "content": prompt}]
    kwargs = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system:
        kwargs["system"] = system
    response = await client.messages.create(**kwargs)
    parts = [block.text for block in response.content if getattr(block, "type", None) == "text"]
    return "".join(parts).strip()
