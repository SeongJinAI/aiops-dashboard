"""
인증 서비스 — API 키 검증 (Phase 2) + JWT (Phase 4)
"""
import hashlib
import os
import time
import json
import base64
import hmac

# API 키 설정: "tenant1:key1,tenant2:key2" 형식
_RAW_KEYS = os.getenv("AIOPS_API_KEYS", "")

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
    """API 키를 검증하고 tenant_id를 반환한다. 실패 시 None."""
    for tenant_id, key in _API_KEYS.items():
        if key == api_key:
            return tenant_id
    return None


def hash_api_key(key: str) -> str:
    """API 키를 SHA256으로 해싱한다."""
    return hashlib.sha256(key.encode()).hexdigest()


def hash_password(password: str) -> str:
    """비밀번호를 SHA256으로 해싱한다."""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


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
