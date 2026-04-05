# AI OPS Dashboard — Claude Code 구현 가이드

> 이 문서를 Claude Code 세션에서 CLAUDE.md와 함께 참고하여 프로젝트를 구현합니다.
> UI 프로토타입은 `dashboard-architecture.jsx`에 이미 완성되어 있습니다.

---

## 프로젝트 개요

5개 레포로 구성된 AI 개발 자동화 시스템의 **운영 대시보드**.
터미널(Claude Code)에서의 작업은 그대로 유지하면서, Hook 실행 여부 / 워크플로우 준수 / 레포 접근을 모니터링한다.

**핵심 문제:** 결과는 나왔는데 과정을 모른다. Hook이 실행됐는지, 정해진 흐름을 따랐는지 확인할 방법이 없다.
**해결:** Hook에 로그 1줄 추가 → JSONL 파일에 쌓임 → 대시보드가 읽어서 시각화.

---

## 기술 스택

```
프론트엔드:  Vite + React + TypeScript
스타일링:    Tailwind CSS (또는 인라인 스타일 유지)
백엔드:      Python 3.11+ / FastAPI + Uvicorn
실시간:      WebSocket (FastAPI 내장)
데이터:      JSONL 파일 (DB 없음)
패키지매니저: 프론트 pnpm (또는 npm) / 백엔드 pip + venv
```

**DB를 안 쓰는 이유:** 로그가 JSONL 파일로 쌓이는 구조이므로, 파일을 직접 읽는 게 가장 단순하다.
나중에 규모가 커지면 SQLite → PostgreSQL로 전환 가능.

---

## 프로젝트 구조

```
ai-ops-dashboard/
├── .env                          ← 로그 디렉토리 경로, 포트 등
├── .env.example
│
├── server/                       ← 백엔드 (Python FastAPI)
│   ├── main.py                   ← FastAPI 앱 진입점 + WebSocket
│   ├── requirements.txt          ← 의존성
│   ├── routers/
│   │   ├── logs.py               ← GET /api/logs/hooks, /api/logs/prompts 등
│   │   ├── projects.py           ← GET/POST /api/projects (교체, 목록)
│   │   └── health.py             ← GET /api/health (시스템 상태)
│   ├── services/
│   │   ├── log_reader.py         ← JSONL 파일 파싱 + 파일 감시
│   │   ├── project_swap.py       ← .env 수정 + setup.sh 실행
│   │   └── github_api.py         ← GitHub API (커밋, PR 상태) — Phase 2
│   └── models/
│       └── schemas.py            ← Pydantic 스키마 정의
│
├── frontend/                     ← 프론트엔드 (Vite + React)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx               ← 탭 라우팅 + 레이아웃
│   │   ├── components/
│   │   │   ├── TopBar.tsx
│   │   │   ├── TabBar.tsx
│   │   │   ├── ChatBot.tsx       ← RAG 챗봇 플로팅 위젯
│   │   │   └── shared/
│   │   │       └── Box.tsx       ← 공통 카드 컴포넌트
│   │   ├── pages/
│   │   │   ├── RepoMap.tsx       ← 레포 관계도 (SVG)
│   │   │   ├── ProjectSwap.tsx   ← 프로젝트 교체
│   │   │   ├── SystemStatus.tsx  ← 시스템 상태 메인
│   │   │   ├── HookMonitor.tsx   ← Hook 실행 로그
│   │   │   ├── WorkflowTracker.tsx ← 워크플로우 체크포인트
│   │   │   └── PromptHistory.tsx ← 프롬프트 히스토리
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts   ← WebSocket 연결 + 실시간 데이터
│   │   │   └── useApi.ts        ← REST API fetch wrapper
│   │   ├── types/
│   │   │   └── index.ts          ← TypeScript 타입 정의
│   │   └── constants/
│   │       ├── colors.ts         ← 컬러 팔레트 (C 객체)
│   │       └── repos.ts          ← REPOS, CONNECTIONS 상수
│   └── public/
│
└── scripts/
    └── generate_mock_logs.py     ← 테스트용 JSONL 파일 생성
```

---

## 데이터 소스: JSONL 로그 형식

### Hook 실행 로그 (`logs/hooks/{YYYY-MM-DD}.jsonl`)

```json
{"ts":"2026-03-07T10:35:12+09:00","hook":"PreCompact","script":"generate_handoff.py","exit":0,"ms":420,"repo":"project","session":"abc123"}
{"ts":"2026-03-07T10:34:58+09:00","hook":"PreToolUse","script":"check-docs.sh","exit":2,"ms":85,"repo":"project","error":"문서 누락","session":"abc123"}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| ts | ISO 8601 | 실행 시각 |
| hook | string | Hook 이벤트 (PreToolUse, PreCompact, Stop 등) |
| script | string | 실행된 스크립트 |
| exit | number | 종료 코드 (0=성공, 2=차단) |
| ms | number | 실행 시간 (밀리초) |
| repo | string | 실행된 레포 (project, test, knowledge 등) |
| error | string? | 실패 시 에러 메시지 |
| session | string? | Claude Code 세션 ID |

### 프롬프트 로그 (`logs/prompts/{YYYY-MM-DD}.jsonl`)

```json
{"ts":"2026-03-07T10:35:00+09:00","prompt":"UserService에 페이지네이션 추가해","repo":"project","tokens":12,"session":"abc123"}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| ts | ISO 8601 | 입력 시각 |
| prompt | string | 사용자가 입력한 프롬프트 |
| repo | string | 입력된 레포 |
| tokens | number | 대략적 토큰 수 |
| session | string? | 세션 ID |

### 워크플로우 체크포인트 (`logs/workflow/{YYYY-MM-DD}.jsonl`)

```json
{"ts":"2026-03-07T10:28:00+09:00","workflow":"feature-dev","step":"docs-generated","stepNum":2,"total":8,"repo":"project","session":"abc123"}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| workflow | string | 워크플로우 이름 |
| step | string | 체크포인트 ID |
| stepNum | number | 현재 단계 번호 |
| total | number | 전체 단계 수 |

### 레포 접근 로그 (`logs/access/{YYYY-MM-DD}.jsonl`) — Phase 2

```json
{"ts":"2026-03-07T10:34:00+09:00","action":"READ","path":"src/docs/기능명세서.md","sourceRepo":"test","targetRepo":"knowledge"}
```

---

## API 엔드포인트

### Phase 1 (MVP)

```
GET  /api/health                          → 시스템 상태 요약
GET  /api/logs/hooks?target_date=2026-03-07  → Hook 실행 로그
GET  /api/logs/prompts?target_date=2026-03-07 → 프롬프트 로그
GET  /api/logs/workflow?target_date=2026-03-07 → 워크플로우 체크포인트
GET  /api/projects                        → 등록된 프로젝트 목록
GET  /api/projects/active                 → 현재 활성 프로젝트
POST /api/projects/swap                   → 프로젝트 교체 실행
     body: { "name": "new-project", "repoPath": "/path/to/repo", "gitUrl": "https://..." }
WS   /ws/logs                             → 실시간 로그 스트림 (FastAPI 내장 WebSocket)
```

### Phase 2

```
GET  /api/logs/access?target_date=2026-03-07 → 레포 접근 로그
GET  /api/github/commits?repo=project → 최근 커밋 (httpx)
GET  /api/github/prs?repo=project     → PR 상태 (httpx)
POST /api/chat                        → RAG 챗봇 (anthropic 패키지)
     body: { "message": "...", "project": "..." }
```

---

## 백엔드 핵심 로직

### 0. requirements.txt

```
fastapi==0.115.*
uvicorn[standard]==0.34.*
python-dotenv==1.1.*
watchfiles==1.0.*
aiofiles==24.*
pydantic==2.*
```

### 1. main.py — FastAPI 앱 + WebSocket

```python
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from routers import logs, projects, health
from services.log_reader import watch_log_files

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: 로그 감시 시작
    task = asyncio.create_task(watch_log_files(connected_clients))
    yield
    # shutdown: 정리
    task.cancel()

app = FastAPI(title="AI OPS Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(logs.router, prefix="/api/logs")
app.include_router(projects.router, prefix="/api/projects")
app.include_router(health.router, prefix="/api")

# WebSocket 연결 관리
connected_clients: list[WebSocket] = []

@app.websocket("/ws/logs")
async def websocket_logs(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)
    try:
        while True:
            await ws.receive_text()  # 연결 유지
    except WebSocketDisconnect:
        connected_clients.remove(ws)
```

### 2. services/log_reader.py — JSONL 파일 읽기 + 감시

```python
import os
import json
import asyncio
from datetime import date
from pathlib import Path
from fastapi import WebSocket
from watchfiles import awatch

LOG_DIR = Path(os.getenv("LOG_DIR", "./logs"))


async def read_log_file(category: str, target_date: str) -> list[dict]:
    """JSONL 파일을 읽어서 dict 리스트로 반환"""
    file_path = LOG_DIR / category / f"{target_date}.jsonl"

    if not file_path.exists():
        return []

    lines = []
    async with asyncio.Lock():
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        lines.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    return lines


async def watch_log_files(clients: list[WebSocket]):
    """로그 디렉토리를 감시하고, 새 줄이 추가되면 WebSocket으로 push"""
    today = date.today().isoformat()
    categories = ["hooks", "prompts", "workflow"]

    # 각 파일의 현재 크기 추적
    file_sizes: dict[str, int] = {}
    for cat in categories:
        fp = LOG_DIR / cat / f"{today}.jsonl"
        file_sizes[str(fp)] = fp.stat().st_size if fp.exists() else 0

    async for changes in awatch(LOG_DIR):
        for change_type, changed_path in changes:
            changed_path = str(changed_path)

            if not changed_path.endswith(".jsonl"):
                continue

            prev_size = file_sizes.get(changed_path, 0)
            current_size = os.path.getsize(changed_path)

            if current_size > prev_size:
                # 새로 추가된 부분만 읽기
                with open(changed_path, "r", encoding="utf-8") as f:
                    f.seek(prev_size)
                    new_lines = f.read()

                file_sizes[changed_path] = current_size

                # 카테고리 추출
                category = Path(changed_path).parent.name

                for line in new_lines.strip().split("\n"):
                    if line:
                        try:
                            data = json.loads(line)
                            msg = json.dumps({"category": category, **data}, ensure_ascii=False)
                            # 연결된 모든 클라이언트에게 전송
                            for ws in clients.copy():
                                try:
                                    await ws.send_text(msg)
                                except:
                                    clients.remove(ws)
                        except json.JSONDecodeError:
                            pass
```

### 3. routers/logs.py — 로그 API

```python
from datetime import date
from fastapi import APIRouter, Query
from services.log_reader import read_log_file

router = APIRouter()


@router.get("/hooks")
async def get_hook_logs(target_date: str = Query(default=None)):
    d = target_date or date.today().isoformat()
    return await read_log_file("hooks", d)


@router.get("/prompts")
async def get_prompt_logs(target_date: str = Query(default=None)):
    d = target_date or date.today().isoformat()
    return await read_log_file("prompts", d)


@router.get("/workflow")
async def get_workflow_logs(target_date: str = Query(default=None)):
    d = target_date or date.today().isoformat()
    return await read_log_file("workflow", d)
```

### 4. services/project_swap.py — 프로젝트 교체

```python
import os
import asyncio
from pathlib import Path


async def swap_project(name: str, repo_path: str, git_url: str = "") -> dict:
    """테스트 레포의 .env를 수정하고 setup.sh를 실행"""
    test_repo = Path(os.getenv("TEST_REPO_PATH", ""))
    env_path = test_repo / ".env"

    if not env_path.exists():
        return {"success": False, "error": ".env 파일 없음"}

    # 1. .env 업데이트
    content = env_path.read_text(encoding="utf-8")
    replacements = {
        "PROJECT_NAME": name,
        "DEV_REPO_PATH": repo_path,
    }
    for key, value in replacements.items():
        import re
        content = re.sub(
            rf'^{key}=.*$',
            f'{key}="{value}"',
            content,
            flags=re.MULTILINE,
        )
    env_path.write_text(content, encoding="utf-8")

    # 2. setup.sh 실행
    proc = await asyncio.create_subprocess_exec(
        "bash", "setup.sh",
        cwd=str(test_repo),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate()

    return {
        "success": proc.returncode == 0,
        "stdout": stdout.decode(),
        "stderr": stderr.decode(),
    }
```

### 5. models/schemas.py — Pydantic 스키마

```python
from pydantic import BaseModel
from typing import Optional


class HookLog(BaseModel):
    ts: str
    hook: str
    script: str
    exit: int
    ms: int
    repo: str
    error: Optional[str] = None
    session: Optional[str] = None


class PromptLog(BaseModel):
    ts: str
    prompt: str
    repo: str
    tokens: int
    session: Optional[str] = None


class WorkflowCheckpoint(BaseModel):
    ts: str
    workflow: str
    step: str
    stepNum: int
    total: int
    repo: str
    session: Optional[str] = None


class Project(BaseModel):
    name: str
    url: str
    domain: str
    repoPath: str
    status: str = "ready"  # active | ready | archived


class SwapRequest(BaseModel):
    name: str
    repoPath: str
    gitUrl: str = ""
```

---

## 프론트엔드: JSX → 컴포넌트 분리 가이드

`dashboard-architecture.jsx`의 코드를 아래와 같이 분리한다.

| JSX 내 함수 | → 파일 | 변경 사항 |
|-------------|--------|----------|
| `Dashboard` (메인) | `App.tsx` | 상태를 Context 또는 zustand로 전역 관리 |
| `RepoMap` | `pages/RepoMap.tsx` | 그대로 |
| `ProjectSwap` | `pages/ProjectSwap.tsx` | POST /api/projects/swap 호출 추가 |
| `SystemStatus` | `pages/SystemStatus.tsx` | GET /api/health 연동 |
| `HookMonitor` | `pages/HookMonitor.tsx` | WebSocket 실시간 + GET /api/logs/hooks 연동 |
| `WorkflowTracker` | `pages/WorkflowTracker.tsx` | GET /api/logs/workflow 연동 |
| `PromptHistory` | `pages/PromptHistory.tsx` | GET /api/logs/prompts 연동 |
| 챗봇 위젯 | `components/ChatBot.tsx` | Phase 2에서 POST /api/chat 연동 |
| `Box` | `components/shared/Box.tsx` | 그대로 |
| `C` (컬러) | `constants/colors.ts` | export |
| `REPOS`, `CONNECTIONS` | `constants/repos.ts` | export |

### 컬러 팔레트 (constants/colors.ts)

```typescript
export const C = {
  bg: "#08080d", surface: "#101018", surfaceAlt: "#161620",
  border: "#252535", borderActive: "#4a4a6a",
  text: "#e0e0e8", dim: "#6a6a80", accent: "#6366f1",
  green: "#22c55e", red: "#ef4444", orange: "#f59e0b",
  cyan: "#06b6d4", purple: "#a855f7", pink: "#ec4899",
} as const;
```

### 타입 정의 (types/index.ts)

```typescript
export interface HookLog {
  ts: string;
  hook: string;
  script: string;
  exit: number;
  ms: number;
  repo: string;
  error?: string;
  session?: string;
}

export interface PromptLog {
  ts: string;
  prompt: string;
  repo: string;
  tokens: number;
  session?: string;
}

export interface WorkflowCheckpoint {
  ts: string;
  workflow: string;
  step: string;
  stepNum: number;
  total: number;
  repo: string;
  session?: string;
}

export interface Project {
  name: string;
  url: string;
  domain: string;
  repoPath: string;
  status: "active" | "ready" | "archived";
}

export interface RepoNode {
  id: string;
  name: string;
  icon: string;
  color: string;
  desc: string;
  fixed: boolean;
}

export interface RepoConnection {
  from: string;
  to: string;
  label: string;
  type: "read" | "write" | "config";
  color: string;
}
```

---

## .env 설정

```bash
# 서버
PORT=8000
HOST=0.0.0.0

# 로그 디렉토리 (거버넌스 레포의 logs/)
LOG_DIR=/path/to/governance-repo/logs

# 테스트 레포 경로 (프로젝트 교체 시 .env 수정 대상)
TEST_REPO_PATH=/path/to/test-repo

# 프로젝트 목록 파일
PROJECTS_FILE=./data/projects.json

# Phase 2: GitHub
# GITHUB_TOKEN=ghp_...
# Phase 2: RAG
# ANTHROPIC_API_KEY=sk-ant-...
```

---

## 구현 순서

### Phase 1: MVP (Hook 모니터링)

```
1. 프로젝트 스캐폴딩
   [ ] 프론트: cd frontend && pnpm create vite . --template react-ts
   [ ] 백엔드: cd server && python -m venv venv && pip install -r requirements.txt
   [ ] Vite proxy 설정 (개발 시 /api → localhost:8000)

2. 백엔드 (FastAPI)   [ ] main.py — FastAPI 앱 + CORS + WebSocket
   [ ] services/log_reader.py — JSONL 읽기 + watchfiles 감시
   [ ] routers/logs.py — GET /api/logs/hooks, prompts, workflow
   [ ] routers/health.py — GET /api/health
   [ ] models/schemas.py — Pydantic 스키마
   [ ] uvicorn main:app --reload --port 8000 으로 실행

3. 프론트엔드
   [ ] dashboard-architecture.jsx를 컴포넌트로 분리
   [ ] 모의 데이터 → useApi / useWebSocket으로 교체
   [ ] HookMonitor: 실시간 로그 테이블
   [ ] WorkflowTracker: 체크포인트 표시
   [ ] PromptHistory: 프롬프트 로그 표시
   [ ] SystemStatus: /api/health 데이터 표시

4. 테스트용 모의 로그 생성
   [ ] scripts/generate_mock_logs.py — 테스트용 JSONL 파일 생성
   [ ] 실제 로그 없이도 대시보드 동작 확인 가능
```

### Phase 2: 프로젝트 교체 + 레포 관계도

```
5. 프로젝트 교체
   [ ] routers/projects.py — GET /api/projects, POST /api/projects/swap
   [ ] services/project_swap.py — .env 수정 + setup.sh 실행
   [ ] ProjectSwap 페이지 API 연동

6. 레포 관계도
   [ ] RepoMap은 이미 완성 — 활성 프로젝트명만 API에서 가져오기
```

### Phase 3: RAG 챗봇 + GitHub 연동

```
7. RAG 챗봇
   [ ] POST /api/chat — Anthropic API 호출 (anthropic 패키지)
   [ ] 지식 레포 문서를 context로 전달
   [ ] ChatBot 컴포넌트 API 연동

8. GitHub 연동
   [ ] services/github_api.py — httpx로 GitHub API 호출
   [ ] GET /api/github/commits
   [ ] GET /api/github/prs
   [ ] SystemStatus에 PR 상태 표시
```

---

## Claude Code 세션 시작 시 프롬프트

```
이 프로젝트를 구현해. 

참고 파일:
- dashboard-architecture.jsx: UI 프로토타입 (React 컴포넌트, 모의 데이터 포함)
- 이 기획문서: 프로젝트 구조, API, 데이터 형식, 구현 순서

기술 스택:
- 백엔드: Python FastAPI + Uvicorn + WebSocket
- 프론트엔드: Vite + React + TypeScript

Phase 1부터 시작해:
1. server/ 에 FastAPI 프로젝트 생성 (main.py, requirements.txt)
2. frontend/ 에 Vite + React + TypeScript 프로젝트 생성
3. dashboard-architecture.jsx를 frontend/src/ 아래 컴포넌트로 분리
4. JSONL 로그 읽기 API 구현 (routers/logs.py, services/log_reader.py)
5. WebSocket 실시간 로그 (main.py에 내장)
6. scripts/generate_mock_logs.py로 테스트용 모의 로그 생성

UI 디자인은 dashboard-architecture.jsx를 그대로 따라. 컬러, 레이아웃, 컴포넌트 구조 변경하지 마.
```

---

## 참고: 기존 산출물 목록

| 파일 | 역할 |
|------|------|
| `dashboard-architecture.jsx` | UI 프로토타입 (이 문서의 구현 대상) |
| `5-레포-아키텍처.md` | 5개 레포 전체 설계 |
| `test-repo-template.zip` | 테스트 레포 범용 템플릿 (.env + envsubst) |
| `post1_settings.md` | 노션 글 1 수정본 |
| `post2_pipeline.md` | 노션 글 2 수정본 |
| `실행_기획서.md` | 실행 순서 (STEP 0~6) |
