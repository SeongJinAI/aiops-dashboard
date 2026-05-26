"""
tenant_secrets 테이블 CRUD + Anthropic 키 검증.

평문 키는 메모리에서만 다루고, DB에는 항상 암호문만 저장.
"""
import sqlite3
from datetime import datetime
from typing import Literal

from services.crypto import encrypt_str, decrypt_str, mask_preview
from services.db import DB_PATH


SecretKind = Literal["anthropic"]


def store_secret(tenant_id: str, kind: SecretKind, plaintext: str) -> dict:
    """평문 키를 받아 암호화 후 저장 (또는 기존 row 덮어쓰기). 미리보기 반환."""
    if not plaintext or not plaintext.strip():
        raise ValueError("키가 비어있습니다.")
    plaintext = plaintext.strip()
    cipher = encrypt_str(plaintext)
    preview = mask_preview(plaintext)

    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute(
            """
            INSERT INTO tenant_secrets (tenant_id, kind, ciphertext, preview)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(tenant_id, kind) DO UPDATE SET
              ciphertext = excluded.ciphertext,
              preview    = excluded.preview,
              created_at = datetime('now'),
              last_used_at = NULL
            """,
            (tenant_id, kind, cipher, preview),
        )
        conn.commit()
    finally:
        conn.close()

    return {"kind": kind, "preview": preview, "has_key": True}


def get_secret_plain(tenant_id: str, kind: SecretKind) -> str | None:
    """LLM 호출 시점에 사용. 복호화된 평문 반환, 없으면 None."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT ciphertext FROM tenant_secrets WHERE tenant_id=? AND kind=?",
            (tenant_id, kind),
        ).fetchone()
        if not row:
            return None
        plain = decrypt_str(row["ciphertext"])
        # last_used_at 갱신
        conn.execute(
            "UPDATE tenant_secrets SET last_used_at=datetime('now') WHERE tenant_id=? AND kind=?",
            (tenant_id, kind),
        )
        conn.commit()
        return plain
    finally:
        conn.close()


def get_secret_status(tenant_id: str, kind: SecretKind) -> dict:
    """평문 노출 없이 상태만 반환 (UI용)."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        row = conn.execute(
            "SELECT preview, created_at, last_used_at FROM tenant_secrets WHERE tenant_id=? AND kind=?",
            (tenant_id, kind),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return {"kind": kind, "has_key": False, "preview": None, "createdAt": None, "lastUsedAt": None}
    return {
        "kind": kind,
        "has_key": True,
        "preview": row["preview"],
        "createdAt": row["created_at"],
        "lastUsedAt": row["last_used_at"],
    }


def delete_secret(tenant_id: str, kind: SecretKind) -> bool:
    """키 삭제. 삭제됐는지 여부 반환."""
    conn = sqlite3.connect(str(DB_PATH))
    try:
        cursor = conn.execute(
            "DELETE FROM tenant_secrets WHERE tenant_id=? AND kind=?",
            (tenant_id, kind),
        )
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


_VERIFY_MODELS = (
    "claude-haiku-4-5",
    "claude-3-5-haiku-latest",
    "claude-3-haiku-20240307",
)


async def verify_anthropic_key(plaintext: str) -> tuple[bool, str]:
    """간단한 호출로 Anthropic 키 유효성 검사. (ok, message).

    prefix 체크는 하지 않고 실제 API 호출로 판정한다 (키 형식 변경에 견고).
    여러 모델 ID를 순서대로 시도하여 사용자 계정에서 접근 가능한 첫 모델로 검증.
    """
    if not plaintext or not plaintext.strip():
        return False, "키가 비어있습니다."

    from anthropic import AsyncAnthropic
    client = AsyncAnthropic(api_key=plaintext)

    last_error: str = ""
    for model in _VERIFY_MODELS:
        try:
            resp = await client.messages.create(
                model=model,
                max_tokens=8,
                messages=[{"role": "user", "content": "ok"}],
            )
            _ = resp.content
            return True, f"유효한 키입니다 (검증 모델: {model})."
        except Exception as e:
            msg = str(e)
            last_error = f"{type(e).__name__}: {msg}"
            # 인증 실패는 다음 모델도 안 됨 — 즉시 중단
            if "401" in msg or "authentication" in msg.lower() or "invalid" in msg.lower() and "key" in msg.lower():
                return False, f"인증 실패 — 키가 잘못되었거나 폐기되었습니다. ({msg[:140]})"
            # 크레딧 부족 (계정은 정상, 잔액 0)
            if "credit balance" in msg.lower() or "credit_balance" in msg.lower():
                return False, (
                    "키는 유효하지만 Anthropic 계정의 크레딧 잔액이 부족합니다. "
                    "https://console.anthropic.com/settings/billing 에서 충전 후 다시 등록하세요."
                )
            # rate limit도 즉시 중단
            if "429" in msg:
                return False, "Rate limit 초과 — 잠시 후 재시도하세요."
            # 그 외(예: 모델 미접근 권한)는 다음 모델 시도
            continue

    # 모든 모델 실패
    return False, f"검증 실패 — 시도한 모델: {', '.join(_VERIFY_MODELS)}. 마지막 에러: {last_error[:200]}"
