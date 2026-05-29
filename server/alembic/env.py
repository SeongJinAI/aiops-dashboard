"""Alembic env — async SQLAlchemy + 모델 metadata 기반 autogenerate."""
import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# server/ 디렉토리를 import path에 추가
_HERE = os.path.dirname(__file__)
_SERVER = os.path.dirname(_HERE)
sys.path.insert(0, _SERVER)

# .env 로드 (alembic 명령 단독 실행 시 DATABASE_URL 등 필요)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(_SERVER), ".env"))
except ImportError:
    pass

from models.db_models import Base  # noqa: E402
from services.database import DATABASE_URL  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """`alembic upgrade --sql` 같은 오프라인 모드 — connection 없이 SQL만 출력."""
    context.configure(
        url=DATABASE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    cfg = config.get_section(config.config_ini_section, {}) or {}
    cfg["sqlalchemy.url"] = DATABASE_URL
    engine = async_engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    async with engine.connect() as conn:
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
