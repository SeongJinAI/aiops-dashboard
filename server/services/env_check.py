"""
환경변수 검증 — 시작 시 호출. 부족하거나 위험한 기본값 사용 시 경고/실패.
"""
import os
import sys


def validate_env() -> list[str]:
    """검증 결과를 경고/에러 리스트로 반환. 치명적 문제는 raise."""
    warnings: list[str] = []

    mode = os.getenv("AIOPS_MODE", "local")

    if mode == "saas":
        if not os.getenv("HERMES_MASTER_KEY"):
            if os.getenv("AIOPS_ENV", "dev") == "prod":
                raise RuntimeError(
                    "HERMES_MASTER_KEY 미설정. 운영에서는 필수입니다. "
                    "예: export HERMES_MASTER_KEY=$(openssl rand -base64 32)"
                )
            warnings.append("HERMES_MASTER_KEY 미설정 — dev fallback 키 사용. 운영 배포 시 필수.")

        jwt_secret = os.getenv("JWT_SECRET", "")
        if not jwt_secret or jwt_secret in (
            "dev-secret-change-in-production",
            "local-dev-secret-do-not-use-in-prod",
            "change-this-to-a-secure-random-string",
        ):
            # 개발 환경(localhost)에서는 경고만, 운영 환경에서는 거부
            if os.getenv("AIOPS_ENV", "dev") == "prod":
                raise RuntimeError(
                    "JWT_SECRET이 기본값입니다. 운영(AIOPS_ENV=prod)에서는 안전한 랜덤 시크릿이 필요합니다. "
                    "예: export JWT_SECRET=$(openssl rand -base64 48)"
                )
            warnings.append(
                "JWT_SECRET이 개발용 기본값입니다. 운영 배포 시 안전한 랜덤 값으로 교체하세요."
            )

        cors = os.getenv("AIOPS_CORS_ORIGINS", "")
        if "*" in cors:
            warnings.append("AIOPS_CORS_ORIGINS에 와일드카드(*)가 있습니다. 운영에서는 명시적 origin만 허용하세요.")

    # 공통: PATH 등 일반 환경
    if mode not in ("local", "saas"):
        raise RuntimeError(f"AIOPS_MODE는 'local' 또는 'saas'만 허용됩니다. 현재 값: {mode!r}")

    return warnings


def print_validation():
    """시작 시 호출하여 결과를 표준 에러로 출력."""
    try:
        warnings = validate_env()
        for w in warnings:
            print(f"[env-check] WARN: {w}", file=sys.stderr)
        print(f"[env-check] AIOPS_MODE={os.getenv('AIOPS_MODE','local')} AIOPS_ENV={os.getenv('AIOPS_ENV','dev')}", file=sys.stderr)
    except RuntimeError as e:
        print(f"[env-check] FATAL: {e}", file=sys.stderr)
        sys.exit(1)
