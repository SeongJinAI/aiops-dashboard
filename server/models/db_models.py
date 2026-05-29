"""SQLAlchemy ORM 모델 — 전 테이블 정의.

기존 services/db.py의 _SCHEMA와 1:1 매핑. Alembic이 이 모델을 기준으로
마이그레이션을 생성한다. PostgreSQL과 SQLite 모두 호환.

주의:
- `ts` 컬럼은 ISO8601 문자열 (기존 코드 호환을 위해 String 유지).
  새 코드는 가능하면 application 레벨에서 ISO 포맷팅하고 String으로 저장.
- `created_at`/`updated_at`은 DB server default(NOW())로 자동 채워진다.
- `id` int + autoincrement는 PostgreSQL에선 SERIAL/IDENTITY로 자동 변환.
"""
from datetime import datetime
from sqlalchemy import (
    String, Integer, Text, DateTime, Boolean, ForeignKey, UniqueConstraint, Index, func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """모든 ORM 모델의 베이스. Alembic env.py가 이 metadata를 사용."""
    pass


class Tenant(Base):
    __tablename__ = "tenants"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    api_key_hash: Mapped[str] = mapped_column(String, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(
        String, ForeignKey("tenants.id"), nullable=False,
    )
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )


class Log(Base):
    __tablename__ = "logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    ts: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    __table_args__ = (
        Index("idx_logs_tenant_cat_ts", "tenant_id", "category", "ts"),
    )


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    url: Mapped[str] = mapped_column(String, default="")
    domain: Mapped[str] = mapped_column(String, default="")
    repo_path: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="ready")
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_projects_tenant_name"),
    )


class HermesWiki(Base):
    __tablename__ = "hermes_wikis"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    perspective: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "project_name", "perspective", "version",
            name="uq_hermes_wikis",
        ),
        Index(
            "idx_hermes_wikis_lookup",
            "tenant_id", "project_name", "perspective", "version",
        ),
    )


class HermesWikiRun(Base):
    __tablename__ = "hermes_wiki_runs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    input_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    output_chars: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    diff_summary: Mapped[str | None] = mapped_column(Text, nullable=True)


class TenantSecret(Base):
    """사용자별 외부 API 키 (BYOK) — AES-GCM 암호화 ciphertext만 저장. 평문 X."""
    __tablename__ = "tenant_secrets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)
    ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    preview: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True,
    )
    __table_args__ = (
        UniqueConstraint("tenant_id", "kind", name="uq_tenant_secrets"),
    )


class HermesSoul(Base):
    __tablename__ = "hermes_souls"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    soul: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    __table_args__ = (
        UniqueConstraint("tenant_id", "project_name", name="uq_hermes_souls"),
    )


class Asset(Base):
    """프로젝트 .md 자산 — Hermes 위키 빌더 입력, RAG 인덱싱 대상."""
    __tablename__ = "assets"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    project_name: Mapped[str] = mapped_column(String, nullable=False)
    path: Mapped[str] = mapped_column(String, nullable=False)
    perspective: Mapped[str | None] = mapped_column(String, nullable=True)
    bucket: Mapped[str | None] = mapped_column(String, nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    modified_at: Mapped[str | None] = mapped_column(String, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    __table_args__ = (
        UniqueConstraint("tenant_id", "project_name", "path", name="uq_assets_path"),
        Index("idx_assets_lookup", "tenant_id", "project_name"),
    )


class Subscription(Base):
    """테넌트 구독 상태 + 공유 풀 기여 동의. plan: free | pro."""
    __tablename__ = "subscriptions"
    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    plan: Mapped[str] = mapped_column(String, default="free", nullable=False)
    share_opt_in: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )


class PromptTemplate(Base):
    """LLM이 기여 프롬프트(opt-in)를 증류해 만든 주제별 공유 템플릿 (커뮤니티 라이브러리).
    개인 원본 프롬프트는 저장하지 않는다 — 익명·일반화된 템플릿만."""
    __tablename__ = "prompt_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[str] = mapped_column(String, default="", nullable=False)
    example_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False,
    )
    __table_args__ = (
        Index("idx_prompt_templates_topic", "topic"),
    )
