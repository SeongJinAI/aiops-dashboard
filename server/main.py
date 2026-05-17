import asyncio
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# 프로젝트 루트의 .env 로드
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

# server/ 디렉토리를 모듈 경로에 추가
sys.path.insert(0, os.path.dirname(__file__))

from routers import logs, projects, health, repos, ingest, auth, claude_config, scripts
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


@app.websocket("/ws/logs")
async def websocket_logs(ws: WebSocket):
    await ws.accept()

    if AIOPS_MODE == "local":
        # Local 모드: 기존 watchfiles 기반 (connected_clients로 broadcast)
        connected_clients.append(ws)
        try:
            while True:
                await ws.receive_text()
        except WebSocketDisconnect:
            connected_clients.remove(ws)
    else:
        # SaaS 모드: EventBus 구독 (tenant별 격리)
        from services.event_bus import event_bus

        # JWT에서 tenant_id 추출 (쿼리 파라미터 token 또는 tenant_id 폴백)
        from services.auth import verify_jwt
        token = ws.query_params.get("token", "")
        if token:
            jwt_payload = verify_jwt(token)
            tenant_id = jwt_payload["tenant_id"] if jwt_payload else "local"
        else:
            tenant_id = ws.query_params.get("tenant_id", "local")
        queue = await event_bus.subscribe(tenant_id)
        try:
            while True:
                msg = await queue.get()
                await ws.send_json(msg)
        except WebSocketDisconnect:
            pass
        finally:
            event_bus.unsubscribe(tenant_id, queue)
