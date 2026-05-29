"""
인증 API — 로그인, 회원가입, 사용자 정보 조회, API 키 관리.
모든 DB 접근은 SQLAlchemy ORM 세션 경유 (raw SQL 제거).
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from middleware.auth import get_current_user
from models.db_models import Tenant, User
from services.auth import (
    create_jwt,
    generate_api_key,
    hash_api_key,
    hash_password,
    needs_rehash,
    verify_password,
)
from services.database import get_session
from services.rate_limit import limiter

router = APIRouter()


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    tenant_name: str
    email: str
    password: str


class TokenResponse(BaseModel):
    token: str
    tenant_id: str
    email: str


class RegisterResponse(BaseModel):
    token: str
    tenant_id: str
    email: str
    api_key: str  # 가입 시에만 평문 반환


class ApiKeyResponse(BaseModel):
    api_key: str  # 재발급 시에만 평문 반환


class ApiKeyStatus(BaseModel):
    has_key: bool


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request, req: LoginRequest, db: AsyncSession = Depends(get_session),
):
    user = (await db.execute(select(User).where(User.email == req.email))).scalar_one_or_none()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    # 레거시 SHA256 → bcrypt 자동 업그레이드 (트랜잭션 안에서 함께 commit)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(req.password)

    token = create_jwt(user.tenant_id, user.email)
    return TokenResponse(token=token, tenant_id=user.tenant_id, email=user.email)


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/minute")
async def register(
    request: Request, req: RegisterRequest, db: AsyncSession = Depends(get_session),
):
    # 이메일 중복 검사
    exists = (await db.execute(select(User.id).where(User.email == req.email))).first()
    if exists:
        raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다")

    tenant_id = str(uuid.uuid4())[:8]
    api_key = generate_api_key()
    db.add(Tenant(id=tenant_id, name=req.tenant_name, api_key_hash=hash_api_key(api_key)))
    db.add(User(tenant_id=tenant_id, email=req.email, password_hash=hash_password(req.password)))

    token = create_jwt(tenant_id, req.email)
    return RegisterResponse(token=token, tenant_id=tenant_id, email=req.email, api_key=api_key)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"tenant_id": user["tenant_id"], "email": user["sub"]}


@router.get("/api-key", response_model=ApiKeyStatus)
async def api_key_status(
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_session),
):
    """현재 API 키 발급 여부 — 평문 키는 반환하지 않는다 (해시만 저장)."""
    h = (
        await db.execute(select(Tenant.api_key_hash).where(Tenant.id == user["tenant_id"]))
    ).scalar_one_or_none()
    return ApiKeyStatus(has_key=bool(h))


@router.post("/api-key/regenerate", response_model=ApiKeyResponse)
@limiter.limit("5/minute")
async def regenerate_api_key(
    request: Request,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """API 키 재발급. 이전 키는 즉시 무효화."""
    new_key = generate_api_key()
    tenant = (
        await db.execute(select(Tenant).where(Tenant.id == user["tenant_id"]))
    ).scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="tenant not found")
    tenant.api_key_hash = hash_api_key(new_key)
    return ApiKeyResponse(api_key=new_key)
