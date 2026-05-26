"""
AES-256-GCM 기반 시크릿 암복호화.

저장 형식: base64(nonce(12B) + ciphertext + tag(16B))
마스터 키: 환경변수 HERMES_MASTER_KEY (base64로 인코딩된 32바이트)
  - 미설정 시 dev용 deterministic 키 생성 + 경고 (운영에서는 실패)
"""
import base64
import os
import sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


_KEY_ENV = "HERMES_MASTER_KEY"
_DEV_FALLBACK_SEED = b"aiops-dev-master-key-not-for-production-use-please"


def _get_master_key() -> bytes:
    """환경변수에서 마스터 키(32바이트) 로드. 없으면 dev 폴백."""
    raw = os.getenv(_KEY_ENV, "").strip()
    if raw:
        try:
            key = base64.b64decode(raw)
            if len(key) != 32:
                raise ValueError(f"HERMES_MASTER_KEY는 base64 디코딩 시 32바이트여야 합니다 (현재 {len(key)})")
            return key
        except Exception as e:
            raise RuntimeError(f"HERMES_MASTER_KEY 파싱 실패: {e}")

    # dev 폴백
    if os.getenv("AIOPS_ENV", "dev") == "prod":
        raise RuntimeError(
            "운영 환경에서는 HERMES_MASTER_KEY 가 필수입니다. "
            "예: export HERMES_MASTER_KEY=$(openssl rand -base64 32)"
        )
    # 첫 호출 시에만 경고
    if not getattr(_get_master_key, "_warned", False):
        print(f"[crypto] WARN: {_KEY_ENV} 미설정 — dev fallback 키 사용. 운영 배포 전 반드시 설정.", file=sys.stderr)
        _get_master_key._warned = True  # type: ignore
    # SHA256으로 32바이트 키 생성 (dev 한정)
    import hashlib
    return hashlib.sha256(_DEV_FALLBACK_SEED).digest()


def encrypt_str(plaintext: str) -> str:
    """문자열을 암호화하여 base64 토큰으로 반환."""
    if not plaintext:
        raise ValueError("빈 문자열은 암호화하지 않습니다.")
    key = _get_master_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ct).decode("ascii")


def decrypt_str(token: str) -> str:
    """encrypt_str로 만든 토큰을 평문으로 복호화."""
    if not token:
        raise ValueError("빈 토큰은 복호화할 수 없습니다.")
    blob = base64.b64decode(token)
    if len(blob) < 13:
        raise ValueError("암호문이 너무 짧습니다.")
    nonce, ct = blob[:12], blob[12:]
    key = _get_master_key()
    aesgcm = AESGCM(key)
    plain = aesgcm.decrypt(nonce, ct, None)
    return plain.decode("utf-8")


def mask_preview(plaintext: str) -> str:
    """평문 키를 화면 표시용으로 마스킹 (`sk-ant-...***xyz`)."""
    if not plaintext:
        return ""
    if len(plaintext) <= 12:
        return "***"
    return f"{plaintext[:8]}...***{plaintext[-4:]}"
