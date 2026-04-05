"""
LogStore — local/saas 모드 통합 데이터 접근 레이어

AIOPS_MODE 환경변수:
  - "local" (기본값): 기존 log_reader.py의 JSONL 직접 읽기
  - "saas": SQLite DB 조회 (db.py)
"""
import os

AIOPS_MODE = os.getenv("AIOPS_MODE", "local")

# 기본 tenant_id (local 모드 또는 미지정 시)
LOCAL_TENANT = "local"


async def read_log_file(category: str, target_date: str, tenant_id: str = LOCAL_TENANT) -> list[dict]:
    if AIOPS_MODE == "saas":
        from services.db import query_logs_by_date
        return await query_logs_by_date(tenant_id, category, target_date)

    from services.log_reader import read_log_file as _read
    return await _read(category, target_date)


def read_all_logs(category: str, days: int = 7, limit: int = 100, tenant_id: str = LOCAL_TENANT) -> list[dict]:
    """동기 버전 (local 모드 호환). saas 모드에서는 read_all_logs_async 사용 권장."""
    if AIOPS_MODE == "saas":
        # saas 모드에서 동기 호출 시 빈 배열 반환 (async 버전 사용 필요)
        return []

    from services.log_reader import read_all_logs as _read
    return _read(category, days, limit)


async def read_all_logs_async(category: str, days: int = 7, limit: int = 100, tenant_id: str = LOCAL_TENANT) -> list[dict]:
    if AIOPS_MODE == "saas":
        from services.db import query_logs
        return await query_logs(tenant_id, category, days, limit)

    from services.log_reader import read_all_logs as _read
    return _read(category, days, limit)


async def get_prompt_stats(tenant_id: str = LOCAL_TENANT) -> dict:
    if AIOPS_MODE == "saas":
        from services.db import compute_prompt_stats
        return await compute_prompt_stats(tenant_id)

    from services.log_reader import compute_prompt_stats as _compute
    return _compute()


async def get_hook_stats(tenant_id: str = LOCAL_TENANT) -> dict:
    if AIOPS_MODE == "saas":
        from services.db import compute_hook_stats
        return await compute_hook_stats(tenant_id)

    from services.log_reader import compute_hook_stats as _compute
    return _compute()


async def get_misunderstanding_stats(tenant_id: str = LOCAL_TENANT) -> dict:
    if AIOPS_MODE == "saas":
        from services.db import compute_misunderstanding_stats
        return await compute_misunderstanding_stats(tenant_id)

    from services.log_reader import read_all_logs as _read
    from datetime import date
    all_logs = _read("misunderstandings", days=30, limit=10000)
    today_str = date.today().isoformat()

    total = len(all_logs)
    today_count = sum(1 for m in all_logs if m.get("ts", "").startswith(today_str))

    pattern_counts: dict[str, int] = {}
    for m in all_logs:
        p = m.get("pattern", "unknown")
        pattern_counts[p] = pattern_counts.get(p, 0) + 1

    by_pattern = sorted([{"pattern": k, "cnt": v} for k, v in pattern_counts.items()], key=lambda x: -x["cnt"])

    return {
        "total": total,
        "today": today_count,
        "byPattern": by_pattern,
    }
