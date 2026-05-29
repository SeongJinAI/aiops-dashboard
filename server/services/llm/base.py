"""
LLM Provider 추상 베이스.

각 provider 구현은 이 클래스를 상속하여 complete / verify_key 만 구현하면 된다.
재시도 로직은 provider 내부에서 자체 처리한다 (각 SDK의 예외 클래스가 달라서 일반화 어려움).
"""
from __future__ import annotations

import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Awaitable, Callable, Literal


ProviderName = Literal["anthropic", "openai", "gemini"]
PROVIDER_NAMES: tuple[ProviderName, ...] = ("anthropic", "openai", "gemini")


OnRetryCallback = Callable[[int, int, str], Awaitable[None]]


class LLMNotConfigured(RuntimeError):
    """API 키가 어디에서도 발견되지 않음."""


class LLMProvider(ABC):
    """모든 LLM provider의 추상 베이스."""

    # 서브클래스에서 오버라이드
    name: ProviderName = "anthropic"  # type: ignore
    label: str = "Anthropic"
    default_model: str = ""
    env_key_var: str = ""
    settings_url: str = ""

    def __init__(self, tenant_id: str | None = None) -> None:
        self.tenant_id = tenant_id

    # --- 공통 키 로드 ---

    async def load_key(self) -> str | None:
        """tenant_id 우선 → env → ~/.claude/.env 순으로 키 로드.
        DB 조회가 async라 메소드 자체를 async로 유지 (호출처는 모두 async 컨텍스트)."""
        if self.tenant_id:
            try:
                from services.secret_store import get_secret_plain
                key = await get_secret_plain(self.tenant_id, self.name)
                if key:
                    return key
            except Exception:
                pass
        env_val = os.getenv(self.env_key_var) if self.env_key_var else None
        if env_val:
            return env_val.strip() or None
        return self._from_claude_env_file()

    def _from_claude_env_file(self) -> str | None:
        """~/.claude/.env 에서 {ENV_KEY_VAR}= 라인을 찾는다."""
        if not self.env_key_var:
            return None
        env_path = Path.home() / ".claude" / ".env"
        if not env_path.exists():
            return None
        try:
            prefix = f"{self.env_key_var}="
            for line in env_path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line.startswith(prefix):
                    return line.split("=", 1)[1].strip().strip('"').strip("'") or None
        except Exception:
            return None
        return None

    async def require_key(self) -> str:
        """키를 반환하거나 LLMNotConfigured raise."""
        key = await self.load_key()
        if not key:
            raise LLMNotConfigured(
                f"{self.label} API 키가 설정되지 않았습니다. "
                f"대시보드의 '연결 설정 > {self.label} 키'에서 본인 키를 등록하세요. "
                f"({self.settings_url} 에서 발급)"
            )
        return key

    # --- 서브클래스 구현 ---

    @abstractmethod
    async def complete(
        self,
        prompt: str,
        system: str = "",
        model: str | None = None,
        max_tokens: int = 8000,
        on_retry: OnRetryCallback | None = None,
    ) -> str:
        """단일 프롬프트 호출. 재시도 포함. on_retry는 진행 상태 push에 사용."""

    @classmethod
    @abstractmethod
    async def verify_key(cls, key: str) -> tuple[bool, str]:
        """키 유효성 검증 (짧은 호출). (ok, message) 반환."""
