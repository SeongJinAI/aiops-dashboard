"""
인증 API — 로그인, 회원가입, 사용자 정보 조회, API 키 관리
"""
import aiosqlite
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from services.auth import (
    hash_password,
    verify_password,
    create_jwt,
    generate_api_key,
    hash_api_key,
    needs_rehash,
)
from services.db import DB_PATH
from services.rate_limit import limiter
from middleware.auth import get_current_user

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
async def login(request: Request, req: LoginRequest):
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT u.*, t.id as tid FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = ?",
            (req.email,),
        )
        user = await cursor.fetchone()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    # 레거시 SHA256 해시면 bcrypt로 자동 업그레이드
    if needs_rehash(user["password_hash"]):
        new_hash = hash_password(req.password)
        async with aiosqlite.connect(str(DB_PATH)) as conn:
            await conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?",
                (new_hash, user["id"]),
            )
            await conn.commit()

    token = create_jwt(user["tenant_id"], user["email"])
    return TokenResponse(token=token, tenant_id=user["tenant_id"], email=user["email"])


@router.post("/register", response_model=RegisterResponse)
@limiter.limit("5/minute")
async def register(request: Request, req: RegisterRequest):
    import uuid
    tenant_id = str(uuid.uuid4())[:8]
    pw_hash = hash_password(req.password)
    api_key = generate_api_key()
    key_hash = hash_api_key(api_key)

    async with aiosqlite.connect(str(DB_PATH)) as conn:
        cursor = await conn.execute("SELECT id FROM users WHERE email = ?", (req.email,))
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다")

        await conn.execute(
            "INSERT INTO tenants (id, name, api_key_hash) VALUES (?, ?, ?)",
            (tenant_id, req.tenant_name, key_hash),
        )
        await conn.execute(
            "INSERT INTO users (tenant_id, email, password_hash) VALUES (?, ?, ?)",
            (tenant_id, req.email, pw_hash),
        )
        await conn.commit()

    token = create_jwt(tenant_id, req.email)
    return RegisterResponse(token=token, tenant_id=tenant_id, email=req.email, api_key=api_key)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"tenant_id": user["tenant_id"], "email": user["sub"]}


@router.get("/api-key", response_model=ApiKeyStatus)
async def api_key_status(user: dict = Depends(get_current_user)):
    """현재 API 키 발급 여부를 반환한다 (평문 키는 반환하지 않음 — 해시만 저장하기 때문)."""
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT api_key_hash FROM tenants WHERE id = ?", (user["tenant_id"],)
        )
        row = await cursor.fetchone()
    has_key = bool(row and row["api_key_hash"])
    return ApiKeyStatus(has_key=has_key)


@router.post("/api-key/regenerate", response_model=ApiKeyResponse)
@limiter.limit("5/minute")
async def regenerate_api_key(request: Request, user: dict = Depends(get_current_user)):
    """API 키를 재발급한다. 이전 키는 즉시 무효화된다."""
    new_key = generate_api_key()
    new_hash = hash_api_key(new_key)
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        await conn.execute(
            "UPDATE tenants SET api_key_hash = ? WHERE id = ?",
            (new_hash, user["tenant_id"]),
        )
        await conn.commit()
    return ApiKeyResponse(api_key=new_key)
