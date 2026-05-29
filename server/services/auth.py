"""
인증 서비스 — API 키 검증 (Phase 2) + JWT (Phase 4)
"""
import hashlib
import os
import secrets
import time
import json
import base64
import hmac

# API 키 설정 (env 폴백): "tenant1:key1,tenant2:key2" 형식
_RAW_KEYS = os.getenv("AIOPS_API_KEYS", "")

# API 키 prefix (사용자가 한 눈에 알아볼 수 있게)
API_KEY_PREFIX = "aiops_"

# JWT 설정
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "24"))


def _parse_api_keys() -> dict[str, str]:
    """환경변수에서 tenant_id:api_key 매핑을 파싱한다."""
    if not _RAW_KEYS:
        return {}
    result = {}
    for pair in _RAW_KEYS.split(","):
        pair = pair.strip()
        if ":" in pair:
            tenant_id, key = pair.split(":", 1)
            result[tenant_id.strip()] = key.strip()
    return result


_API_KEYS = _parse_api_keys()


def verify_api_key(api_key: str) -> str | None:
    """[Deprecated] 환경변수 기반 API 키 검증. saas 모드에서는 verify_api_key_db 사용."""
    for tenant_id, key in _API_KEYS.items():
        if key == api_key:
            return tenant_id
    return None


async def verify_api_key_db(api_key: str) -> str | None:
    """DB에서 API 키 해시를 조회하여 tenant_id를 반환한다.

    DB가 초기화되지 않은 local 모드 등에서는 None을 반환하여 env 폴백으로 넘어간다.
    """
    from sqlalchemy import select
    from models.db_models import Tenant
    from services.database import session_scope

    key_hash = hash_api_key(api_key)
    try:
        async with session_scope() as s:
            tenant_id = (
                await s.execute(select(Tenant.id).where(Tenant.api_key_hash == key_hash))
            ).scalar_one_or_none()
        return tenant_id
    except Exception:
        return None


def hash_api_key(key: str) -> str:
    """API 키를 SHA256으로 해싱한다."""
    return hashlib.sha256(key.encode()).hexdigest()


def generate_api_key() -> str:
    """안전한 랜덤 API 키를 생성한다. 형식: aiops_{32자 토큰}"""
    return f"{API_KEY_PREFIX}{secrets.token_urlsafe(24)}"


def hash_password(password: str) -> str:
    """비밀번호를 bcrypt로 해싱한다 (cost factor 12)."""
    import bcrypt
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _is_bcrypt(h: str) -> bool:
    return h.startswith("$2a$") or h.startswith("$2b$") or h.startswith("$2y$")


def verify_password(password: str, password_hash: str) -> bool:
    """비밀번호 검증. bcrypt와 레거시 SHA256을 모두 지원한다."""
    import bcrypt
    if _is_bcrypt(password_hash):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
        except Exception:
            return False
    # 레거시: SHA256
    return hashlib.sha256(password.encode()).hexdigest() == password_hash


def needs_rehash(password_hash: str) -> bool:
    """저장된 해시가 bcrypt 형식이 아니면 재해싱 권장."""
    return not _is_bcrypt(password_hash)


# --- JWT (외부 라이브러리 없이 구현) ---

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64url_decode(s: str) -> bytes:
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def create_jwt(tenant_id: str, email: str) -> str:
    """JWT 토큰을 생성한다."""
    header = _b64url_encode(json.dumps({"alg": JWT_ALGORITHM, "typ": "JWT"}).encode())
    payload_data = {
        "tenant_id": tenant_id,
        "sub": email,
        "exp": int(time.time()) + JWT_EXPIRE_HOURS * 3600,
        "iat": int(time.time()),
    }
    payload = _b64url_encode(json.dumps(payload_data).encode())
    signature = hmac.new(JWT_SECRET.encode(), f"{header}.{payload}".encode(), "sha256").digest()
    sig = _b64url_encode(signature)
    return f"{header}.{payload}.{sig}"


def verify_jwt(token: str) -> dict | None:
    """JWT 토큰을 검증하고 payload를 반환한다. 실패 시 None."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None

        header_b64, payload_b64, sig_b64 = parts
        expected_sig = hmac.new(
            JWT_SECRET.encode(), f"{header_b64}.{payload_b64}".encode(), "sha256"
        ).digest()
        actual_sig = _b64url_decode(sig_b64)

        if not hmac.compare_digest(expected_sig, actual_sig):
            return None

        payload_data = json.loads(_b64url_decode(payload_b64))

        if payload_data.get("exp", 0) < time.time():
            return None

        return payload_data
    except Exception:
        return None
