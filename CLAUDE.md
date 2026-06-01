# CLAUDE.md

이 파일은 새 세션에 자동 로드된다. **현재 제품 상태의 단일 진실의 원천.** 더 자세한 세션별 기록은 `HANDOFF.md`.

> ⚠️ 메모리(`~/.claude/.../memory/`)·DB(`server/data/*.db`)·`.env`·`node_modules`는 **git에 없고 머신-로컬**이다. 새 머신에서는 이 문서 + HANDOFF가 출발점. (아래 "새 머신 시작" 참조)

## 프로젝트 개요 — Nova

**비개발자 바이브코더(Cursor·Claude Code 사용자)를 위한 개인 AI 코칭 SaaS.** AI와 일한 흔적(프롬프트·Hook·세션·도구호출)을 자동 수집(Track)하고, 문서로 자산화하고 그 지식을 다음 작업에 되먹이며(Wikify+RAG), 협업을 점수·인사이트로 코칭한다(Coach).

> 과거엔 "5-레포 운영 대시보드"였으나 **개인 AI 코칭 SaaS로 피벗**됨(2026-05~06). 5-레포/레포맵 프레이밍은 제거됨. 브랜드 = **Nova**(과거 Hermes는 내부 위키 에이전트 모듈명으로만 잔존).

## 가치 사슬

| 단계 | 의미 | 핵심 구현 |
|------|------|----------|
| **Track** | AI 활동 자동 수집 | Hook → JSONL/원격 → SQLite `logs`. 카테고리 10종(prompts·tool-use·hooks·mcp_calls·slash_commands·sessions·agents·misunderstandings·claude-config-*) |
| **Wikify** | 지식 자산화 + 되먹임 | install.sh가 **문서 생성 skill 7종**을 프로젝트 `.claude/skills/`에 설치 → `docs/*.md` 생성 → 자산 sync → **RAG 지식 챗**으로 다음 작업에 주입(`/nova-recall`) |
| **Coach** | 데이터 기반 코칭 | 협업 점수(명확성/거버넌스/꾸준함) + 인사이트(룰 기반, 키 불필요) + 관리형 LLM 브리핑 |

## 기술 스택

- **백엔드:** Python 3.11+ / FastAPI · SQLAlchemy(async) · PostgreSQL(운영)/SQLite(dev 폴백) · WebSocket
- **프론트:** Vite · React 19 · TypeScript · 자체 oklch 디자인 토큰(`styles/tokens.css`)
- **LLM:** BYOK 멀티 프로바이더(Anthropic/OpenAI/Gemini) + **관리형(Nova 제공)**

## 비즈니스 모델

- **Free / Pro $19** (목 결제 — `services/billing.py`, `/api/billing/checkout` 즉시 pro. 실결제 Lemon Squeezy는 **남은 유일한 작업**).
- **관리형 AI**: 비개발자가 키 없이 바로 사용. plan별 월 **요청 수 쿼터**(free 5 / pro 500, `services/usage.py`·`LLMUsage`). 비용은 우리가 부담 → 쿼터로 통제.
- **BYOK**: 본인 키 등록 시 무제한(미터링 X). `services/managed_llm.py`가 BYOK 우선 → 없으면 관리형+쿼터.
- 운영 키: `NOVA_LLM_PROVIDER`(기본 anthropic) + provider env 키(예: `ANTHROPIC_API_KEY`=관리형 키).

## 코드 지도

**백엔드(`server/`)**
- `main.py` — 앱·라우터 등록·중앙 예외 로깅(4xx warn/5xx error)·lifespan(DB init, watcher)
- `services/` — `coach`·`rag`·`prompt_library`·`managed_llm`·`usage`·`billing`·`secret_store`(AES-256-GCM)·`crypto`·`errors`(ERR_* 레지스트리)·`db`·`database`·`hermes/`(위키)
- `routers/` — `coach`·`chat`(RAG)·`library`·`billing`·`hermes`·`secrets`·`projects`·`repos`·`ingest`·`scripts`(install.sh+skill 번들)·`auth`
- `middleware/auth.py` — `get_current_user`(JWT)·`get_tenant_flexible`(JWT|X-API-Key)·`require_premium`(402)
- `scripts/hooks/*.sh`(수집), `scripts/skills/*/SKILL.md`(문서 생성 skill 번들)

**프론트(`frontend/src/`)**
- `pages/` — Landing·Login·Home·Coach·Chat(지식챗)·Prompts·Misunderstandings·HookMonitor·Library·Subscribe·Agent·Connections·ProjectSwap·OnboardingWizard
- `app/` AppShell·Sidebar·TopBar·CommandPalette / `ui/` primitives·Icon·toast / `constants/nav.ts`(IA)

## 핵심 규칙 (전역 + 프로젝트)

- **예외 4계층**: 요청검증 400 / 인증인가 401·402·403 / 비즈니스 404·409 / 외부의존·시스템 503·500. **에러는 `services/errors.py`의 `E`/`err`로** raise(문자열 리터럴 금지). 로깅 4xx=warn/5xx=error(중앙 핸들러 자동).
- **프론트**: 인라인 `style={{}}`·하드코딩 색(#hex)·이모지 UI 금지 → `ui/primitives` + CSS 토큰(`var(--…)`). 숫자 tabular-nums. 빈 상태 정직하게. (`DESIGN-BRIEF.md`)
- **계층 아키텍처**: 라우터는 얇게, 비즈니스는 service. 과도한 엔지니어링 지양, 요청된 변경만.
- **커밋**: 사용자 요청 시에만. 한글 메시지 + `Co-Authored-By`.

## 새 머신 시작 (Fresh Clone)

```bash
# 1) .env 생성 (git에 없음)
cp .env.example .env          # dev는 기본값으로 충분. 운영 키는 위 "비즈니스 모델" 참조

# 2) 백엔드
cd server && pip install -r requirements.txt
AIOPS_MODE=saas DB_PATH=./data/aiops_saas.db python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
#   → DB 없으면 create_all로 자동 생성(빈 상태). 데이터는 git에 없음(아래 주의)

# 3) 프론트 (별도 터미널)
cd frontend && npm install && npm run dev -- --host 0.0.0.0 --port 5173
#   → http://localhost:5173 (랜딩은 로그아웃 상태에서만)
```

- **DB 데이터는 전송 안 됨**: `server/data/aiops_saas.db`(이전 머신의 실데이터·tenant edf0aee3 1,056 프롬프트 등)는 gitignore. 새 머신은 **빈 DB로 시작**. 데이터가 필요하면 이전 머신에서 그 `.db` 파일을 수동 복사하거나, 실제 프로젝트에서 install.sh로 재수집.
- **--reload 미사용**(WebSocket graceful shutdown 이슈). vite는 `usePolling` 설정으로 WSL HMR 자동 반영.
- 재시작 안전: `pkill -9 -f "uvicorn main:app"`.

## 참고 문서 (현행)

- `HANDOFF.md` — 세션별 상세 기록(최신 상단). **새 세션은 여기부터 읽을 것.**
- `DESIGN-BRIEF.md` — UI 디자인 SSOT(oklch 토큰·IA·안티패턴)
- `BACKLOG.md` — 코드 감사 백로그(Tier 4 보안·5 컨벤션 일부 잔여)
- `docs/바이브코딩-산출물-정의.md` — 산출물 5계층 정의
- (historical: `5-레포-아키텍처.md`·`dashboard-*` — 피벗 전 자료)
