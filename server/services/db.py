"""
SQLite 데이터베이스 — SaaS 모드용 로그 저장/조회
local 모드에서는 사용하지 않는다.
"""
import json
import aiosqlite
import os
from datetime import date, timedelta
from pathlib import Path

DB_PATH = Path(os.getenv("DB_PATH", os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "aiops.db"
)))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_key_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    category TEXT NOT NULL,
    ts TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_tenant_cat_ts
    ON logs(tenant_id, category, ts DESC);

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    url TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    repo_path TEXT DEFAULT '',
    status TEXT DEFAULT 'ready',
    UNIQUE(tenant_id, name)
);

-- Hermes Agent: 프로젝트 위키 자동 생성기
CREATE TABLE IF NOT EXISTS hermes_wikis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id    TEXT NOT NULL,
    project_name TEXT NOT NULL,
    perspective  TEXT NOT NULL,   -- 'planner' | 'developer' | 'user'
    content      TEXT NOT NULL,
    version      INTEGER DEFAULT 1,
    updated_at   TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, project_name, perspective, version)
);

CREATE INDEX IF NOT EXISTS idx_hermes_wikis_lookup
    ON hermes_wikis(tenant_id, project_name, perspective, version DESC);

CREATE TABLE IF NOT EXISTS hermes_wiki_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id    TEXT NOT NULL,
    project_name TEXT NOT NULL,
    status       TEXT NOT NULL,   -- 'running' | 'success' | 'failed'
    started_at   TEXT DEFAULT (datetime('now')),
    finished_at  TEXT,
    input_count  INTEGER DEFAULT 0,
    output_chars INTEGER DEFAULT 0,
    error        TEXT,
    diff_summary TEXT
);

-- 사용자별 외부 API 키 (BYOK) — 평문 X, AES-GCM 암호화 후 저장
CREATE TABLE IF NOT EXISTS tenant_secrets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id   TEXT NOT NULL,
    kind        TEXT NOT NULL,   -- 'anthropic' | (향후) 'openai' | 'github' ...
    ciphertext  TEXT NOT NULL,   -- base64(nonce + AES-GCM ciphertext)
    preview     TEXT,            -- 마스킹된 미리보기 ('sk-ant-...***xyz')
    created_at  TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    UNIQUE(tenant_id, kind)
);

CREATE TABLE IF NOT EXISTS hermes_souls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id    TEXT NOT NULL,
    project_name TEXT NOT NULL,
    soul         TEXT,
    updated_at   TEXT DEFAULT (datetime('now')),
    UNIQUE(tenant_id, project_name)
);
"""

_SYSTEM_PREFIXES = ("<task-notification>", "<system-reminder>", "<command-name>", "<local-command")


async def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        await conn.executescript(_SCHEMA)
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.commit()


async def _get_conn() -> aiosqlite.Connection:
    return await aiosqlite.connect(str(DB_PATH))


async def insert_log(tenant_id: str, category: str, payload: dict):
    ts = payload.get("ts", "")
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        await conn.execute(
            "INSERT INTO logs (tenant_id, category, ts, payload) VALUES (?, ?, ?, ?)",
            (tenant_id, category, ts, json.dumps(payload, ensure_ascii=False)),
        )
        await conn.commit()


async def insert_logs_batch(tenant_id: str, logs: list[dict]):
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        await conn.executemany(
            "INSERT INTO logs (tenant_id, category, ts, payload) VALUES (?, ?, ?, ?)",
            [
                (tenant_id, log["category"], log["payload"].get("ts", ""),
                 json.dumps(log["payload"], ensure_ascii=False))
                for log in logs
            ],
        )
        await conn.commit()


async def query_logs(
    tenant_id: str, category: str, days: int = 7, limit: int = 100
) -> list[dict]:
    since = (date.today() - timedelta(days=days)).isoformat()
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT payload FROM logs WHERE tenant_id = ? AND category = ? AND ts >= ? ORDER BY ts DESC LIMIT ?",
            (tenant_id, category, since, limit),
        )
        rows = await cursor.fetchall()
    return [json.loads(row["payload"]) for row in rows]


async def query_logs_by_date(
    tenant_id: str, category: str, target_date: str
) -> list[dict]:
    next_date = str(date.fromisoformat(target_date) + timedelta(days=1))
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT payload FROM logs WHERE tenant_id = ? AND category = ? AND ts >= ? AND ts < ? ORDER BY ts",
            (tenant_id, category, target_date, next_date),
        )
        rows = await cursor.fetchall()
    return [json.loads(row["payload"]) for row in rows]


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

    by_repo = sorted([{"repo": k, "cnt": v} for k, v in repo_counts.items()], key=lambda x: -x["cnt"])

    return {
        "total": total,
        "userTotal": user_total,
        "systemTotal": system_total,
        "today": today_count,
        "avgTokens": avg_tokens,
        "byRepo": by_repo,
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

    by_pattern = sorted([{"pattern": k, "cnt": v} for k, v in pattern_counts.items()], key=lambda x: -x["cnt"])

    return {
        "total": total,
        "today": today_count,
        "byPattern": by_pattern,
    }
