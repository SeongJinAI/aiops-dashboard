"""
tenant_secrets 테이블 CRUD + provider별 키 검증.

평문 키는 메모리에서만 다루고, DB에는 항상 암호문만 저장.
지원 provider: anthropic / openai / gemini (services.llm 추상 레이어와 동일).
"""
import sqlite3
from datetime import datetime
from typing import Literal

from services.crypto import encrypt_str, decrypt_str, mask_preview
from services.db import DB_PATH


SecretKind = Literal["anthropic", "openai", "gemini"]


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


async def verify_provider_key(kind: SecretKind, plaintext: str) -> tuple[bool, str]:
    """provider별 단일 진입점 — services.llm.verify_key로 위임."""
    from services.llm import verify_key as _verify
    return await _verify(kind, plaintext)


# 하위 호환 — 기존 코드(routers/secrets.py 이전 버전)가 이름으로 import할 수 있음
async def verify_anthropic_key(plaintext: str) -> tuple[bool, str]:
    return await verify_provider_key("anthropic", plaintext)
