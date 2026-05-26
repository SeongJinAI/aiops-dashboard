"""
시크릿 마스킹 서비스 — Ingest payload에서 토큰/키 패턴을 자동 감지하고 마스킹한다.

목적: 사용자가 Claude 작업 중 입력하거나 도구가 반환한 시크릿이 DB에 평문으로 저장되지 않게 한다.

마스킹 규칙: 패턴 매칭된 토큰을 `{prefix}***{last4}` 형태로 치환.
예) ghp_1234567890abcdef → ghp_***cdef
    sk-ant-api-fooBARbaz123 → sk-ant-***z123
"""
import re
from typing import Any

# 패턴 정의 — (이름, 정규식, 표시용 prefix)
# 최소 길이 12자 이상부터 토큰으로 간주
SECRET_PATTERNS: list[tuple[str, re.Pattern, str]] = [
    # GitHub
    ("github_pat", re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"), "ghp_"),
    ("github_oauth", re.compile(r"\bgho_[A-Za-z0-9]{30,}\b"), "gho_"),
    ("github_fine_grained", re.compile(r"\bgithub_pat_[A-Za-z0-9_]{60,}\b"), "github_pat_"),
    ("github_app", re.compile(r"\b(ghu_|ghs_|ghr_)[A-Za-z0-9]{30,}\b"), "ghX_"),
    # Anthropic / OpenAI
    ("anthropic_key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{30,}\b"), "sk-ant-"),
    ("openai_key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), "sk-"),
    # Notion
    ("notion_secret", re.compile(r"\bsecret_[A-Za-z0-9]{40,}\b"), "secret_"),
    ("notion_ntn", re.compile(r"\bntn_[A-Za-z0-9]{40,}\b"), "ntn_"),
    # Slack
    ("slack_token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"), "xox?-"),
    # AWS
    ("aws_access", re.compile(r"\b(AKIA|ASIA)[A-Z0-9]{16}\b"), "AKIA"),
    # Google
    ("google_api", re.compile(r"\bAIza[A-Za-z0-9_-]{30,}\b"), "AIza"),
    # AIOps 자체 키 (실수로 본인 키가 prompt로 들어갈 가능성)
    ("aiops_key", re.compile(r"\baiops_[A-Za-z0-9_-]{20,}\b"), "aiops_"),
    # JWT 토큰 (Header.Payload.Signature)
    ("jwt", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b"), "eyJ"),
    # Generic Bearer ... 형식
    ("bearer", re.compile(r"(?i)\bBearer\s+([A-Za-z0-9_.\-]{20,})\b"), "Bearer "),
]


def _mask_token(match_text: str, prefix: str) -> str:
    """매칭된 토큰을 prefix***last4 형태로 마스킹."""
    last4 = match_text[-4:] if len(match_text) >= 8 else "****"
    return f"{prefix}***{last4}"


def mask_text(text: str) -> tuple[str, list[str]]:
    """문자열 안의 시크릿을 마스킹하고, 발견된 시크릿 종류 리스트를 함께 반환."""
    if not isinstance(text, str) or len(text) < 12:
        return text, []

    found: set[str] = set()
    result = text
    for name, pattern, prefix in SECRET_PATTERNS:
        def _repl(m: re.Match) -> str:
            found.add(name)
            # Bearer는 그룹 1만 마스킹, 나머지는 전체
            if name == "bearer":
                return f"{prefix}***{m.group(1)[-4:]}"
            return _mask_token(m.group(0), prefix)

        result = pattern.sub(_repl, result)

    return result, sorted(found)


def mask_payload(payload: Any) -> tuple[Any, list[str]]:
    """payload를 재귀적으로 순회하며 모든 문자열 값을 마스킹.

    반환: (마스킹된 payload, 발견된 시크릿 종류 리스트)
    """
    found_all: set[str] = set()

    def _walk(v: Any) -> Any:
        if isinstance(v, str):
            masked, found = mask_text(v)
            found_all.update(found)
            return masked
        if isinstance(v, dict):
            return {k: _walk(item) for k, item in v.items()}
        if isinstance(v, list):
            return [_walk(item) for item in v]
        return v

    masked = _walk(payload)
    return masked, sorted(found_all)
