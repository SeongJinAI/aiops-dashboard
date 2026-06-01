import asyncio
import logging
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exception_handlers import http_exception_handler
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from dotenv import load_dotenv

# 구조화 로깅 — 로깅 레벨 컨벤션: 4xx=warning, 5xx=error (중앙 핸들러에서 처리)
logging.basicConfig(
    level=os.getenv("AIOPS_LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
log = logging.getLogger("nova")

# 프로젝트 루트의 .env 로드
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# server/ 디렉토리를 모듈 경로에 추가
sys.path.insert(0, os.path.dirname(__file__))

# 환경변수 검증 (위험한 기본값이면 운영 시 종료)
from services.env_check import print_validation
print_validation()

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from services.rate_limit import limiter

from routers import logs, projects, health, repos, ingest, auth, claude_config, scripts, hermes, secrets as secrets_router, assets as assets_router, coach, billing, library, chat
from services.log_reader import get_log_dir, watch_log_files
from services.log_store import AIOPS_MODE

connected_clients: list[WebSocket] = []

# watcher 태스크 관리 (프로젝트 전환 시 재시작용)
_watcher_task: asyncio.Task | None = None
_current_watch_dir: str = ""


async def watch_and_push(clients: list[WebSocket]):
    """JSONL 감시 + WebSocket push (DB 저장 없음 — Pure Reader)"""
    await watch_log_files(clients)


def restart_watcher():
    """프로젝트 전환 시 watcher를 재시작한다."""
    global _watcher_task, _current_watch_dir

    new_dir = str(get_log_dir())
    if new_dir == _current_watch_dir and _watcher_task and not _watcher_task.done():
        return

    if _watcher_task and not _watcher_task.done():
        _watcher_task.cancel()

    _current_watch_dir = new_dir
    _watcher_task = asyncio.create_task(watch_and_push(connected_clients))


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _watcher_task, _current_watch_dir

    # SaaS 모드: DB 초기화
    if AIOPS_MODE == "saas":
        from services.db import init_db
        await init_db()

    # Local 모드: 파일 감시 시작
    if AIOPS_MODE == "local":
        _current_watch_dir = str(get_log_dir())
        _watcher_task = asyncio.create_task(watch_and_push(connected_clients))

    yield

    if _watcher_task:
        _watcher_task.cancel()


app = FastAPI(title="AI OPS Dashboard", lifespan=lifespan)

# Rate limit 등록
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# 중앙 에러 로깅 — 4xx는 warning(클라이언트 원인), 5xx는 error(서버 원인).
@app.exception_handler(StarletteHTTPException)
async def _log_http_exception(request, exc: StarletteHTTPException):
    if exc.status_code >= 500:
        log.error("%s %s %s → %s", exc.status_code, request.method, request.url.path, exc.detail)
    elif exc.status_code >= 400:
        log.warning("%s %s %s → %s", exc.status_code, request.method, request.url.path, exc.detail)
    return await http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def _log_unhandled_exception(request, exc: Exception):
    log.exception("500 %s %s (미처리 예외)", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "내부 서버 오류가 발생했습니다."})

# CORS: 환경변수로 origins 설정 가능
_cors_origins = os.getenv("AIOPS_CORS_ORIGINS", "http://localhost:5173,http://localhost:5174")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(logs.router, prefix="/api/logs")
app.include_router(projects.router, prefix="/api/projects")
app.include_router(health.router, prefix="/api")
app.include_router(repos.router, prefix="/api/repos")
app.include_router(ingest.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(claude_config.router, prefix="/api/claude-config")
app.include_router(scripts.router, prefix="/api/scripts")
app.include_router(hermes.router, prefix="/api/hermes")
app.include_router(secrets_router.router, prefix="/api/secrets")
app.include_router(assets_router.router, prefix="/api/assets")
app.include_router(coach.router, prefix="/api/coach")
app.include_router(billing.router, prefix="/api/billing")
app.include_router(library.router, prefix="/api/library")
app.include_router(chat.router, prefix="/api/chat")


@app.websocket("/ws/logs")
async def websocket_logs(ws: WebSocket):
    if AIOPS_MODE == "saas":
        # SaaS 모드: JWT 필수. 토큰 없거나 검증 실패 시 즉시 close (정책 위반 1008).
        # query_params 의 tenant_id 폴백은 인증 우회 위험이 있어 제거됨.
        from services.auth import verify_jwt
        from services.event_bus import event_bus

        token = ws.query_params.get("token", "")
        jwt_payload = verify_jwt(token) if token else None
        if not jwt_payload or not jwt_payload.get("tenant_id"):
            await ws.close(code=1008, reason="Unauthorized — JWT 토큰이 필요합니다")
            return

        tenant_id = jwt_payload["tenant_id"]
        await ws.accept()
        queue = await event_bus.subscribe(tenant_id)
        try:
            while True:
                msg = await queue.get()
                await ws.send_json(msg)
        except WebSocketDisconnect:
            pass
        finally:
            event_bus.unsubscribe(tenant_id, queue)
        return

    # Local 모드: 단일 사용자라 broadcast로 충분 (watchfiles 기반)
    await ws.accept()
    connected_clients.append(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        if ws in connected_clients:
            connected_clients.remove(ws)
