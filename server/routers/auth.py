"""
인증 API — 로그인, 회원가입, 사용자 정보 조회
"""
import aiosqlite
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from services.auth import hash_password, verify_password, create_jwt
from services.db import DB_PATH, init_db
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


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest):
    async with aiosqlite.connect(str(DB_PATH)) as conn:
        conn.row_factory = aiosqlite.Row
        cursor = await conn.execute(
            "SELECT u.*, t.id as tid FROM users u JOIN tenants t ON u.tenant_id = t.id WHERE u.email = ?",
            (req.email,),
        )
        user = await cursor.fetchone()

    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")

    token = create_jwt(user["tenant_id"], user["email"])
    return TokenResponse(token=token, tenant_id=user["tenant_id"], email=user["email"])


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest):
    import uuid
    tenant_id = str(uuid.uuid4())[:8]
    pw_hash = hash_password(req.password)

    async with aiosqlite.connect(str(DB_PATH)) as conn:
        # 이메일 중복 체크
        cursor = await conn.execute("SELECT id FROM users WHERE email = ?", (req.email,))
        if await cursor.fetchone():
            raise HTTPException(status_code=409, detail="이미 등록된 이메일입니다")

        # 테넌트 생성
        await conn.execute(
            "INSERT INTO tenants (id, name, api_key_hash) VALUES (?, ?, '')",
            (tenant_id, req.tenant_name),
        )
        # 사용자 생성
        await conn.execute(
            "INSERT INTO users (tenant_id, email, password_hash) VALUES (?, ?, ?)",
            (tenant_id, req.email, pw_hash),
        )
        await conn.commit()

    token = create_jwt(tenant_id, req.email)
    return TokenResponse(token=token, tenant_id=tenant_id, email=req.email)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"tenant_id": user["tenant_id"], "email": user["sub"]}
