"""
tenant_secrets 테이블 CRUD + provider별 키 검증.

평문 키는 메모리에서만 다루고, DB에는 항상 암호문만 저장.
지원 provider: anthropic / openai / gemini (services.llm 추상 레이어와 동일).
"""
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import delete as _delete, select, update as _update

from models.db_models import TenantSecret
from services.crypto import decrypt_str, encrypt_str, mask_preview
from services.database import engine, session_scope


SecretKind = Literal["anthropic", "openai", "gemini"]


def _upsert_stmt(values: dict):
    """dialect별 INSERT ... ON CONFLICT DO UPDATE — (tenant_id, kind) UNIQUE 기준."""
    if engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _ins
    else:
        from sqlalchemy.dialects.sqlite import insert as _ins
    stmt = _ins(TenantSecret).values(**values)
    return stmt.on_conflict_do_update(
        index_elements=[TenantSecret.tenant_id, TenantSecret.kind],
        set_={
            "ciphertext": stmt.excluded.ciphertext,
            "preview": stmt.excluded.preview,
            "created_at": stmt.excluded.created_at,
            "last_used_at": None,
        },
    )


async def store_secret(tenant_id: str, kind: SecretKind, plaintext: str) -> dict:
    """평문 키를 받아 암호화 후 저장 (또는 기존 row 덮어쓰기). 미리보기 반환."""
    if not plaintext or not plaintext.strip():
        raise ValueError("키가 비어있습니다.")
    plaintext = plaintext.strip()
    cipher = encrypt_str(plaintext)
    preview = mask_preview(plaintext)

    stmt = _upsert_stmt({
        "tenant_id": tenant_id,
        "kind": kind,
        "ciphertext": cipher,
        "preview": preview,
        "created_at": datetime.now(timezone.utc),
    })
    async with session_scope() as s:
        await s.execute(stmt)
    return {"kind": kind, "preview": preview, "has_key": True}


async def get_secret_plain(tenant_id: str, kind: SecretKind) -> str | None:
    """LLM 호출 시점에 사용. 복호화된 평문 반환, 없으면 None."""
    async with session_scope() as s:
        cipher = (await s.execute(
            select(TenantSecret.ciphertext).where(
                TenantSecret.tenant_id == tenant_id,
                TenantSecret.kind == kind,
            )
        )).scalar_one_or_none()
        if not cipher:
            return None
        plain = decrypt_str(cipher)
        await s.execute(
            _update(TenantSecret)
            .where(TenantSecret.tenant_id == tenant_id, TenantSecret.kind == kind)
            .values(last_used_at=datetime.now(timezone.utc))
        )
    return plain


async def get_secret_status(tenant_id: str, kind: SecretKind) -> dict:
    """평문 노출 없이 상태만 반환 (UI용)."""
    async with session_scope() as s:
        row = (await s.execute(
            select(
                TenantSecret.preview, TenantSecret.created_at, TenantSecret.last_used_at,
            ).where(
                TenantSecret.tenant_id == tenant_id, TenantSecret.kind == kind,
            )
        )).first()
    if not row:
        return {"kind": kind, "has_key": False, "preview": None, "createdAt": None, "lastUsedAt": None}
    return {
        "kind": kind,
        "has_key": True,
        "preview": row.preview,
        "createdAt": row.created_at.isoformat() if row.created_at else None,
        "lastUsedAt": row.last_used_at.isoformat() if row.last_used_at else None,
    }


async def delete_secret(tenant_id: str, kind: SecretKind) -> bool:
    """키 삭제. 삭제됐는지 여부 반환."""
    async with session_scope() as s:
        result = await s.execute(
            _delete(TenantSecret).where(
                TenantSecret.tenant_id == tenant_id, TenantSecret.kind == kind,
            )
        )
    return (result.rowcount or 0) > 0


async def verify_provider_key(kind: SecretKind, plaintext: str) -> tuple[bool, str]:
    """provider별 단일 진입점 — services.llm.verify_key로 위임."""
    from services.llm import verify_key as _verify
    return await _verify(kind, plaintext)


async def verify_anthropic_key(plaintext: str) -> tuple[bool, str]:
    """하위 호환 — 기존 코드(routers/secrets.py 이전 버전)가 이름으로 import할 수 있음."""
    return await verify_provider_key("anthropic", plaintext)
