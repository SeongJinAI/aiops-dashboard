"""
오해 감지 — Claude가 사용자 의도를 잘못 이해한 순간을 룰 기반으로 자동 감지한다.

감지 패턴:
  - rejection: 직전 사용자 prompt 직후 부정/거부 표현이 등장
  - correction: "그게 아니", "다시", "잘못" 등 수정 요구
  - retry:      이전과 유사한 의도가 짧은 시간 내 반복

또는 hooks 측에서:
  - 도구 사용 차단 (PreToolUse exit != 0 등) — 거버넌스 규칙 위반 = AI가 규칙을 미숙지

감지 결과는 misunderstandings 카테고리로 별도 저장하여 MisunderstandingTracker에서 시각화한다.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select

from models.db_models import Log
from services.database import session_scope


# 패턴 키워드 (한국어 위주 — 영어도 일부)
_REJECTION_PATTERNS = [
    r"\b아니야\b", r"\b아니에요\b", r"\b아닌데\b", r"\b아냐\b",
    r"\b그게 아니", r"\b잘못", r"\b틀렸", r"\b틀려",
    r"\b원하는 게 아니", r"\b의도가 아니", r"\b의도한 게 아니",
    r"\bno,?\s+", r"\bnot\s+what", r"\bwrong\b",
]
_CORRECTION_PATTERNS = [
    r"\b다시\b", r"\b수정", r"\b고쳐", r"\b바꿔",
    r"\b이렇게 말고\b", r"\b그거 말고\b",
    r"\bfix\b", r"\bchange\b", r"\bcorrect\b",
]
_RETRY_PATTERNS = [
    r"\b다른 방법", r"\b다른 방식", r"\b다른 식",
    r"\b또\b", r"\b또한\b",
    r"\btry again\b", r"\banother\s+way\b",
]


def _matches(text: str, patterns: list[str]) -> list[str]:
    """패턴에 매칭된 키워드를 반환 (대소문자 무시)."""
    if not text:
        return []
    out: list[str] = []
    low = text.lower()
    for p in patterns:
        m = re.search(p, low, flags=re.IGNORECASE)
        if m:
            out.append(m.group(0).strip())
    return out


def classify_prompt(text: str) -> tuple[str | None, list[str]]:
    """프롬프트 텍스트의 패턴 분류.

    반환: (pattern_name 또는 None, matched_keywords)
    rejection > correction > retry 우선순위.
    """
    if not text:
        return None, []
    text = text.strip()
    if len(text) < 2:
        return None, []

    rj = _matches(text, _REJECTION_PATTERNS)
    if rj:
        return "rejection", rj
    cr = _matches(text, _CORRECTION_PATTERNS)
    if cr:
        return "correction", cr
    rt = _matches(text, _RETRY_PATTERNS)
    if rt:
        return "retry", rt
    return None, []


_TIME_WINDOW = timedelta(minutes=10)  # 직전 prompt와의 최대 시간 간격


def _parse_iso(ts: str) -> datetime | None:
    if not ts:
        return None
    try:
        # Z suffix 또는 +00:00 둘 다 지원
        if ts.endswith("Z"):
            ts = ts[:-1] + "+00:00"
        return datetime.fromisoformat(ts)
    except Exception:
        return None


async def detect_from_prompt(
    tenant_id: str,
    current_payload: dict,
    db_path: str | None = None,  # 하위 호환 (사용 안 함 — SQLAlchemy 엔진 사용)
) -> dict | None:
    """방금 들어온 prompt를 분석하여 오해 감지 시 misunderstanding payload를 반환.

    감지 안 되면 None.
    """
    text = current_payload.get("prompt", "")
    if not text:
        return None
    # 시스템 메시지(<system-reminder> 등)는 분석 대상 아님
    sys_prefixes = ("<task-notification>", "<system-reminder>", "<command-name>", "<local-command")
    if text.lstrip().startswith(sys_prefixes):
        return None

    pattern, keywords = classify_prompt(text)
    if not pattern:
        return None

    # 직전 사용자 prompt 조회 (같은 tenant, 최근 10분 내)
    curr_ts = _parse_iso(current_payload.get("ts", ""))
    prev_prompt = ""
    prev_session = current_payload.get("session", "")
    try:
        async with session_scope() as s:
            payloads = (await s.execute(
                select(Log.payload)
                .where(Log.tenant_id == tenant_id, Log.category == "prompts")
                .order_by(Log.ts.desc())
                .limit(5)
            )).scalars().all()

        for raw in payloads:
            try:
                p = json.loads(raw)
            except Exception:
                continue
            ptext = (p.get("prompt") or "").lstrip()
            if not ptext or ptext.startswith(sys_prefixes):
                continue
            if p.get("ts") == current_payload.get("ts") and ptext == text:
                continue
            pts = _parse_iso(p.get("ts", ""))
            if curr_ts and pts and (curr_ts - pts) > _TIME_WINDOW:
                continue
            prev_prompt = ptext[:500]
            if not prev_session:
                prev_session = p.get("session", "")
            break
    except Exception:
        pass

    if not prev_prompt:
        # 직전 prompt가 없으면 오해 판단 불가 — 노이즈 방지
        return None

    return {
        "ts": current_payload.get("ts") or datetime.now(timezone.utc).isoformat(),
        "prompt": text[:500],
        "prev_prompt": prev_prompt,
        "pattern": pattern,
        "keywords": keywords[:5],
        "repo": current_payload.get("repo", ""),
        "session": prev_session,
    }


async def detect_from_hook(
    tenant_id: str,
    hook_payload: dict,
    db_path: str | None = None,  # 하위 호환 (사용 안 함)
) -> dict | None:
    """Hook 차단(exit != 0)을 미숙지 사례로 기록.

    PreToolUse / PostToolUse exit=2 는 거버넌스 규칙 위반 → AI가 규칙을 모른 채 시도.
    """
    exit_code = hook_payload.get("exit")
    if exit_code is None or exit_code == 0:
        return None
    hook_name = hook_payload.get("hook", "")
    script = hook_payload.get("script", "")

    # 직전 사용자 prompt 가져오기 (컨텍스트용)
    prev_prompt = ""
    try:
        async with session_scope() as s:
            raw = (await s.execute(
                select(Log.payload)
                .where(Log.tenant_id == tenant_id, Log.category == "prompts")
                .order_by(Log.ts.desc())
                .limit(1)
            )).scalar_one_or_none()
        if raw:
            try:
                p = json.loads(raw)
                prev_prompt = (p.get("prompt") or "")[:500]
            except Exception:
                pass
    except Exception:
        pass

    return {
        "ts": hook_payload.get("ts") or datetime.now(timezone.utc).isoformat(),
        "prompt": f"[Hook 차단] {hook_name} (exit={exit_code}, script={script})",
        "prev_prompt": prev_prompt,
        "pattern": "rejection",  # 거버넌스 차단 = AI 의도와 규칙 불일치
        "keywords": [f"exit={exit_code}", hook_name],
        "repo": hook_payload.get("repo", ""),
        "session": hook_payload.get("session", ""),
    }
