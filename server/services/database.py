"""SQLAlchemy 비동기 엔진/세션 + 메타데이터 부트스트랩.

DATABASE_URL 우선순위:
  1. 환경변수 `DATABASE_URL` (운영 표준 — postgresql+asyncpg://user:pass@host:5432/db)
  2. `DB_PATH` 폴백 (기존 호환 — SQLite)

운영: PostgreSQL 강력 권장. dev에서 PostgreSQL 띄우기 부담스러우면 SQLite도 정상 동작.

사용:
  - FastAPI 라우터: `db: AsyncSession = Depends(get_session)`
  - 서비스 함수 (라우터 밖): `async with session_scope() as s: ...`
"""
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncSession, async_sessionmaker, create_async_engine,
)

from models.db_models import Base


def _build_database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if url:
        return url
    # 폴백: 기존 dev 호환 — SQLite 파일
    db_path = os.getenv("DB_PATH", "./data/aiops_saas.db").strip()
    return f"sqlite+aiosqlite:///{db_path}"


DATABASE_URL = _build_database_url()
_echo = os.getenv("DB_ECHO", "").lower() in ("1", "true", "yes")

# create_async_engine 옵션:
# - pool_pre_ping: 죽은 connection 자동 감지 (PostgreSQL idle timeout 대응)
# - SQLite는 pool 옵션 일부 무시 — 무관
engine = create_async_engine(
    DATABASE_URL,
    echo=_echo,
    pool_pre_ping=True,
    future=True,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI Depends 의존성. 라우터 종료 시 자동 commit, 예외 시 rollback."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """라우터 외부(서비스/스크립트)에서 사용. with block 종료 시 자동 commit/rollback."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """Alembic 미적용 dev 환경 안전망 — 모델 metadata 기반 자동 생성.

    운영에선 `alembic upgrade head`로 마이그레이션 관리. 이 함수는 멱등이라
    이미 만들어진 테이블에는 영향 없음.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
