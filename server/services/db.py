"""DB CRUD 함수 — SQLAlchemy + PostgreSQL/SQLite.

기존 인터페이스를 유지: 라우터들이 `from services.db import insert_log, ...`
그대로 동작한다. 내부만 raw sqlite3/aiosqlite → SQLAlchemy ORM/Core로 교체.

- 엔진/세션: services.database 모듈
- upsert: PostgreSQL/SQLite 모두 `INSERT ... ON CONFLICT ... DO UPDATE` 지원 → dialect별 insert() 사용
- 기존 호환을 위해 DB_PATH 상수는 services.database.DATABASE_URL과 별개로 유지
"""
import json
import os
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import select

from models.db_models import Asset, Log
from services.database import engine, init_db, session_scope


# ─── 기존 호환: 일부 라우터가 from services.db import DB_PATH 사용 ────────────
DB_PATH = Path(os.getenv("DB_PATH", os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "aiops.db",
)))


__all__ = [
    "DB_PATH",
    "init_db",  # services.database.init_db를 re-export
    "insert_log",
    "insert_logs_batch",
    "query_logs",
    "query_logs_by_date",
    "compute_prompt_stats",
    "compute_hook_stats",
    "compute_misunderstanding_stats",
    "upsert_asset",
    "upsert_assets_batch",
    "list_assets",
    "delete_asset",
]


_SYSTEM_PREFIXES = (
    "<task-notification>", "<system-reminder>", "<command-name>", "<local-command",
)


# ─── Logs ────────────────────────────────────────────────────────────────────


async def insert_log(tenant_id: str, category: str, payload: dict) -> None:
    ts = payload.get("ts", "")
    async with session_scope() as s:
        s.add(Log(
            tenant_id=tenant_id,
            category=category,
            ts=ts,
            payload=json.dumps(payload, ensure_ascii=False),
        ))


async def insert_logs_batch(tenant_id: str, logs: list[dict]) -> None:
    if not logs:
        return
    rows = [
        Log(
            tenant_id=tenant_id,
            category=log["category"],
            ts=log["payload"].get("ts", ""),
            payload=json.dumps(log["payload"], ensure_ascii=False),
        )
        for log in logs
    ]
    async with session_scope() as s:
        s.add_all(rows)


async def query_logs(
    tenant_id: str, category: str, days: int = 7, limit: int = 100,
) -> list[dict]:
    since = (date.today() - timedelta(days=days)).isoformat()
    stmt = (
        select(Log.payload)
        .where(
            Log.tenant_id == tenant_id,
            Log.category == category,
            Log.ts >= since,
        )
        .order_by(Log.ts.desc())
        .limit(limit)
    )
    async with session_scope() as s:
        rows = (await s.execute(stmt)).scalars().all()
    return [json.loads(p) for p in rows]


async def query_logs_by_date(
    tenant_id: str, category: str, target_date: str,
) -> list[dict]:
    next_date = (date.fromisoformat(target_date) + timedelta(days=1)).isoformat()
    stmt = (
        select(Log.payload)
        .where(
            Log.tenant_id == tenant_id,
            Log.category == category,
            Log.ts >= target_date,
            Log.ts < next_date,
        )
        .order_by(Log.ts)
    )
    async with session_scope() as s:
        rows = (await s.execute(stmt)).scalars().all()
    return [json.loads(p) for p in rows]


# ─── Stats — query_logs 위에서 동작, raw SQL 없음 (그대로 옮김) ──────────────


async def compute_prompt_stats(tenant_id: str) -> dict:
    raw = await query_logs(tenant_id, "prompts", days=90, limit=10000)
    user_prompts = [p for p in raw if not p.get("prompt", "").lstrip().startswith(_SYSTEM_PREFIXES)]
    system_prompts = [p for p in raw if p.get("prompt", "").lstrip().startswith(_SYSTEM_PREFIXES)]
    today_str = date.today().isoformat()

    total = len(raw)
    user_total = len(user_prompts)
    system_total = len(system_prompts)
    today_count = sum(1 for p in user_prompts if p.get("ts", "").startswith(today_str))
    avg_tokens = round(sum(p.get("tokens", 0) for p in user_prompts) / user_total, 1) if user_total > 0 else 0

    repo_counts: dict[str, int] = {}
    for p in user_prompts:
        repo = p.get("repo", "unknown")
        repo_counts[repo] = repo_counts.get(repo, 0) + 1
    by_repo = sorted(
        [{"repo": k, "cnt": v} for k, v in repo_counts.items()],
        key=lambda x: -x["cnt"],
    )

    hourly = [0] * 24
    for p in user_prompts:
        ts = p.get("ts", "")
        if len(ts) >= 13 and ts[10] in ("T", " "):
            try:
                h = int(ts[11:13])
                if 0 <= h < 24:
                    hourly[h] += 1
            except ValueError:
                pass

    days_window = 30
    today_date = date.today()
    daily_counts: dict[str, int] = {}
    for i in range(days_window):
        d = (today_date - timedelta(days=days_window - 1 - i)).isoformat()
        daily_counts[d] = 0
    for p in user_prompts:
        ts = p.get("ts", "")[:10]
        if ts in daily_counts:
            daily_counts[ts] += 1
    daily = [{"date": d, "cnt": c} for d, c in daily_counts.items()]

    length_buckets = [
        {"label": "≤100", "max": 100, "cnt": 0},
        {"label": "100-300", "max": 300, "cnt": 0},
        {"label": "300-1k", "max": 1000, "cnt": 0},
        {"label": "1k-3k", "max": 3000, "cnt": 0},
        {"label": "3k+", "max": None, "cnt": 0},
    ]
    for p in user_prompts:
        tok = p.get("tokens", 0) or 0
        for b in length_buckets:
            mx = b["max"]
            if mx is None or tok <= mx:
                b["cnt"] += 1
                break

    return {
        "total": total,
        "userTotal": user_total,
        "systemTotal": system_total,
        "today": today_count,
        "avgTokens": avg_tokens,
        "byRepo": by_repo,
        "hourly": hourly,
        "daily": daily,
        "lengthBuckets": [{"label": b["label"], "cnt": b["cnt"]} for b in length_buckets],
    }


async def compute_hook_stats(tenant_id: str) -> dict:
    all_hooks = await query_logs(tenant_id, "hooks", days=30, limit=10000)
    total = len(all_hooks)
    success = sum(1 for h in all_hooks if h.get("exit", -1) == 0)
    failed = total - success
    success_rate = round(success / total * 100, 1) if total > 0 else 0
    return {
        "total": total,
        "success": success,
        "failed": failed,
        "successRate": success_rate,
    }


async def compute_misunderstanding_stats(tenant_id: str) -> dict:
    all_logs = await query_logs(tenant_id, "misunderstandings", days=30, limit=10000)
    today_str = date.today().isoformat()

    total = len(all_logs)
    today_count = sum(1 for m in all_logs if m.get("ts", "").startswith(today_str))

    pattern_counts: dict[str, int] = {}
    for m in all_logs:
        p = m.get("pattern", "unknown")
        pattern_counts[p] = pattern_counts.get(p, 0) + 1
    by_pattern = sorted(
        [{"pattern": k, "cnt": v} for k, v in pattern_counts.items()],
        key=lambda x: -x["cnt"],
    )

    return {"total": total, "today": today_count, "byPattern": by_pattern}


# ─── Assets — dialect별 upsert ────────────────────────────────────────────────


def _asset_upsert(values: list[dict]):
    """dialect별 INSERT ... ON CONFLICT DO UPDATE 문 생성.
    PostgreSQL/SQLite 모두 (tenant_id, project_name, path) UNIQUE에 대응."""
    update_cols = ("perspective", "bucket", "content", "size_bytes", "modified_at")
    if engine.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as _ins
    else:
        from sqlalchemy.dialects.sqlite import insert as _ins
    stmt = _ins(Asset).values(values)
    set_ = {c: getattr(stmt.excluded, c) for c in update_cols}
    return stmt.on_conflict_do_update(
        index_elements=[Asset.tenant_id, Asset.project_name, Asset.path],
        set_=set_,
    )


async def upsert_asset(
    tenant_id: str,
    project_name: str,
    path: str,
    content: str,
    size_bytes: int = 0,
    modified_at: str | None = None,
    perspective: str | None = None,
    bucket: str | None = None,
) -> None:
    stmt = _asset_upsert([{
        "tenant_id": tenant_id, "project_name": project_name, "path": path,
        "perspective": perspective, "bucket": bucket,
        "content": content, "size_bytes": size_bytes, "modified_at": modified_at,
    }])
    async with session_scope() as s:
        await s.execute(stmt)


async def upsert_assets_batch(
    tenant_id: str,
    project_name: str,
    items: list[dict],
) -> int:
    if not items:
        return 0
    values = [
        {
            "tenant_id": tenant_id,
            "project_name": project_name,
            "path": it["path"],
            "perspective": it.get("perspective"),
            "bucket": it.get("bucket"),
            "content": it.get("content", ""),
            "size_bytes": it.get("size_bytes", 0),
            "modified_at": it.get("modified_at"),
        }
        for it in items
    ]
    stmt = _asset_upsert(values)
    async with session_scope() as s:
        await s.execute(stmt)
    return len(values)


async def list_assets(tenant_id: str, project_name: str) -> list[dict]:
    stmt = (
        select(
            Asset.path, Asset.perspective, Asset.bucket,
            Asset.content, Asset.size_bytes, Asset.modified_at,
        )
        .where(Asset.tenant_id == tenant_id, Asset.project_name == project_name)
        .order_by(Asset.path)
    )
    async with session_scope() as s:
        rows = (await s.execute(stmt)).all()
    return [
        {
            "path": r.path, "perspective": r.perspective, "bucket": r.bucket,
            "content": r.content, "size_bytes": r.size_bytes, "modified_at": r.modified_at,
        }
        for r in rows
    ]


async def delete_asset(tenant_id: str, project_name: str, path: str) -> None:
    from sqlalchemy import delete as _delete
    stmt = _delete(Asset).where(
        Asset.tenant_id == tenant_id,
        Asset.project_name == project_name,
        Asset.path == path,
    )
    async with session_scope() as s:
        await s.execute(stmt)
