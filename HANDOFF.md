# HANDOFF.md

## 2026.05.26 — SaaS 상용화 진단 + 원클릭 install 통합

### 한 줄 요약

> 사용자가 종합 개선 보고서를 컨텍스트로 공유 → 코드 실측으로 검증한 결과 보고서의 보안 항목 절반은 **이미 구현됨**, 실제 병목은 설치 마찰 → **GET /api/scripts/install.sh** 통합 엔드포인트로 위저드 5단계를 4단계로 단축.

### 보고서 vs 실측 검증 결과

| 보고서 주장 | 실측 | 위치 |
|---|---|---|
| "bcrypt 미적용" | ✅ 적용됨 (cost=12) + 로그인 시 SHA256 자동 업그레이드 | `services/auth.py:74-97` |
| "JWT_SECRET dev 기본값 방치" | ✅ `AIOPS_ENV=prod`에서 기동 거부 | `services/env_check.py:30-34` |
| "HERMES_MASTER_KEY 미설정 방치" | ✅ prod에서 기동 거부 | `services/crypto.py:31-35` |
| "Rate Limit secrets에만" | ✅ login 10/min, register 5/min, ingest 300/min, batch 60/min, default 120/min 전역 | 여러 라우터 |
| "시크릿 마스킹 없음" | ✅ 서버 ingest에서 11종 패턴 자동 마스킹 (GitHub/Anthropic/OpenAI/Notion/Slack/AWS/Google/JWT/Bearer) | `services/secret_masker.py` |

진짜 미구현 (보고서 옳음): 결제 인프라, 원클릭 GitHub 연결, 인라인 스타일/탭 10개 UI, LLM 재시도 로직, 클라이언트 사이드 마스킹.

### 보고서 #1 사양의 결함 발견

보고서는 "GitHub Webhook 등록 → push 이벤트 수집"을 제안했으나 **이 프로젝트의 핵심 수집 대상은 Claude Code Hook 로그(로컬 PC 활동)**. GitHub Webhook으로는 물리적으로 수집 불가. 사용자와 합의 후 **방안 A: 통합 install 1줄 명령**으로 재설계.

### 이번 세션 완료한 작업

**통합 install.sh 엔드포인트** ✅
- `server/routers/scripts.py`에 `GET /api/scripts/install.sh?token=<API_KEY>` 신설
- 토큰 검증 후 동적으로 4단계 통합 bash 스크립트 생성 (4,191 bytes)
- 단계: ① `~/.claude/.env` idempotent 패치 → ② 현재 디렉토리 활성 프로젝트 자동 등록 → ③ Hook 스크립트 3종 + `settings.json` 갱신 → ④ 테스트 ping
- `Host`/`X-Forwarded-Proto` 헤더로 api_base 자동 추론

**X-API-Key 인증 register 라우트** ✅
- `server/routers/projects.py`에 `POST /api/projects/register` 신설
- swap과 달리 Bearer JWT 대신 API 키 인증 (install.sh가 호출용)
- saas/local 모드 모두 처리, rate-limit 30/min

**verify_api_key_db 안정성 보강** ✅
- `services/auth.py`: DB 미초기화 시 `OperationalError` 처리 → None 반환 (env 폴백으로 자연 넘어감)

**프론트엔드 envCommands 확장** ✅
- `frontend/src/constants/onboarding.ts`: `oneLineInstall` 필드 추가
- mac/linux/wsl/windows 모두 `bash -c "$(curl -fsSL .../install.sh?token=...)"` 단일 형식

**OnboardingWizard 단축** ✅
- 5단계 → 4단계 (`STEP_LABELS = ['환경', 'API 키', '원클릭 설치', '연결 확인']`)
- 기존 Step 3(env패치) + Step 4(레포+Hook) → 단일 Step 3 "원클릭 설치"
- "고급: 2단계 수동 방식" 접힌 옵션으로 기존 방식 보존
- 연결 확인 폴링 간격 30s→10s, 타임아웃 안내 5분→2분

**Connections.tsx 가이드 단순화** ✅
- "Hook 설치 가이드" 섹션을 `HookInstallSection` 컴포넌트로 분리
- 단일 명령 우선 노출 + 고급 토글로 2단계 방식 보존

### 검증

- Python syntax: `routers/scripts.py`, `routers/projects.py`, `services/auth.py` 모두 OK
- TypeScript: `tsc --noEmit` 클린
- 엔드포인트 동작: TestClient로 토큰 없음(400) / 잘못된 토큰(401) / 정상 토큰(200, text/plain, 4191 bytes) 검증 통과

### 다음 세션이 즉시 해야 할 것

1. 백엔드/프론트 살아있나 확인:
   ```bash
   curl -s http://localhost:8000/api/mode
   ```
   안 떠 있으면:
   ```bash
   cd /mnt/c/Personal/aiops-dashboard/server && uvicorn main:app --host 0.0.0.0 --port 8000 &
   cd /mnt/c/Personal/aiops-dashboard/frontend && npm run dev -- --host 0.0.0.0 &
   ```
2. **실 사용자 환경에서 원클릭 install 동작 검증**:
   - 본인 API 키로 `curl -fsSL http://localhost:8000/api/scripts/install.sh?token=<KEY>` 출력 확인
   - 빈 디렉토리에서 `bash -c "$(curl -fsSL ...)"` 실행 → 4단계 모두 성공하는지
   - 첫 ping 도착 시 위저드 Step 4가 ✅ 표시되는지

### 다음 작업 백로그 (보고서 기반 재정렬)

| 순위 | 작업 | 보고서 매핑 |
|---|---|---|
| 1 | Hermes LLM 재시도 로직 (Exponential Backoff) | 프롬프트 #4 |
| 2 | Tailwind+Shadcn 디자인 시스템 전환 + 탭→사이드바 | 프롬프트 #2 |
| 3 | 결제 인프라 (Lemon Squeezy + 구독 티어) | 프롬프트 #5 |
| 4 | 클라이언트 사이드(훅 스크립트) 시크릿 마스킹 | 프롬프트 #3 잔여 |
| 5 | PostgreSQL + Alembic 전환 | Phase A-3 |

### 주의사항

- **통합 install.sh 보안 모델**: 토큰을 URL 파라미터로 받음 → curl 옵션 history와 webserver access log에 남을 가능성. 첫 호출에서만 사용하고 키 재발급으로 무효화 가능. 운영에서는 HTTPS 필수.
- **register 엔드포인트는 X-API-Key 전용** — Bearer JWT는 받지 않음. swap과 책임 분리.
- **register는 swap_project_async 호출** → saas 모드에서 활성 상태 토글 + 신규 INSERT 둘 다 처리.
- 이전 세션 주의사항(Vite hot reload, --reload 미사용, DB 경로, JWT/MASTER_KEY dev 값 등) 그대로 유효.

### 관련 파일

**이번 세션 수정/생성**:
- `server/routers/scripts.py` (통합 install.sh + _build_integrated_script)
- `server/routers/projects.py` (register 엔드포인트 추가)
- `server/services/auth.py` (verify_api_key_db OperationalError 처리)
- `frontend/src/constants/onboarding.ts` (oneLineInstall 필드)
- `frontend/src/pages/OnboardingWizard.tsx` (5→4 단계 통합)
- `frontend/src/pages/Connections.tsx` (HookInstallSection 컴포넌트화)

**메모리에 저장됨** (다음 세션 자동 로드):
- `~/.claude/projects/-mnt-c-Personal-aiops-dashboard/memory/project_identity.md`
- `~/.claude/projects/-mnt-c-Personal-aiops-dashboard/memory/saas_improvement_report.md`

---

## 2026.05.21 (현재 — Phase 3 BYOK 완료, 위키 첫 호출 대기)

### 한 줄 요약

> 사용자가 **Anthropic 크레딧을 충전**하고 **연결 설정에서 키 등록 → 에이전트 탭에서 [Hermes 업데이트]** 누르면 첫 위키가 생성된다. 거기서부터 다음 세션 시작.

### 다음 세션이 즉시 해야 할 것

1. 백엔드/프론트 살아있나 확인:
   ```bash
   curl -s http://localhost:8000/api/mode    # {"mode":"saas","auth_required":true}
   curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/    # 200
   ```
   안 떠 있으면:
   ```bash
   cd /mnt/c/Personal/aiops-dashboard/server && uvicorn main:app --host 0.0.0.0 --port 8000 &
   cd /mnt/c/Personal/aiops-dashboard/frontend && npm run dev -- --host 0.0.0.0 &
   ```
2. 사용자에게 **크레딧 충전 완료했는지** 확인. 안 했으면 https://console.anthropic.com/settings/billing 안내
3. 사용자가 연결 설정 → Anthropic 키 등록 → 에이전트 탭 [Hermes 업데이트] 클릭 → 결과 같이 보기
4. 결과 분기:
   - **만족** → **Phase 4 (버전 관리 + diff 자동 작성)** 진행
   - **분류 이슈** → `server/services/hermes/catalog.py`의 `_classify()` 룰 조정
   - **품질 부족** → `server/services/hermes/wiki_builder.py`의 `PERSPECTIVE_BRIEF` 프롬프트 튜닝

### 이번 세션 완료한 작업

**Phase 3 — BYOK (Bring Your Own Key) 구조** ✅
- DB: `tenant_secrets` 테이블 신설 (tenant_id, kind, ciphertext, preview, last_used_at)
- AES-256-GCM 암복호화 (`services/crypto.py`, 마스터키는 env `HERMES_MASTER_KEY`)
- `/api/secrets/anthropic` POST/GET/DELETE 라우터 (rate-limit 10/min)
- `services/secret_store.py` — 등록·조회·삭제·검증
- `services/hermes/llm_client.py` 리팩 — DB(BYOK) 우선 → env 폴백
- 프론트 `Connections.tsx`에 "Anthropic API 키" 섹션 (등록·교체·삭제·미리보기)
- "검증 건너뛰기" 옵션 (verify 실패 우회용)

**진행 중 버그 수정** ✅
- `apiPost`(useApi.ts): `HTTP 400`만 던지던 것을 백엔드 `detail` 그대로 throw하도록 변경 — 사용자가 진짜 에러 사유 볼 수 있음
- `verify_anthropic_key`: `sk-ant-` prefix 강제 제거 (Anthropic 키 형식 변화 견고). 모델 ID도 fallback 체인(`claude-haiku-4-5` → `claude-3-5-haiku-latest` → `claude-3-haiku-20240307`)
- "credit balance too low" 패턴 잡아서 한국어 안내 ("크레딧 잔액 부족 — billing 페이지 안내")

**기획서 갱신** ✅
- `프로젝트-기획서.md`: 비전을 "Track / Wikify / Coach 3단계"로 진화 + Hermes 백로그 #6 추가
- `헤르메스-도입-설계.md`: 13장 — 핵심을 "프로젝트 위키 자동 생성기"로 재정의 + ERP 자산 카탈로그 사례 + Phase 1~6 분할

**Phase 1 (자산 카탈로그) + Phase 2 (위키 생성 API) 이미 완료**
- ERP 프로젝트 252개 .md 자산 분류: planner 56 / developer 147 / user 49
- POST /api/hermes/catalog → 룰 기반 분류 (LLM 없음, 즉시 응답)
- POST /api/hermes/wiki/update → 백그라운드로 Claude API 3회 호출 후 hermes_wikis에 version+1로 저장
- GET /api/hermes/runs/{id} → 진행 상태 폴링

### 현재 막힌 지점

사용자가 키 등록 시도 → Anthropic API가 응답:
```
"Your credit balance is too low to access the Anthropic API"
```

키 자체는 유효하지만 **잔액 0**. 크레딧 충전이 사용자 액션으로 필요. 코드는 이 응답을 잡아서 한국어로 친절하게 안내하도록 보강 완료.

### 다음 작업 백로그 (우선순위)

| 순위 | 작업 | 트리거 |
|---|---|---|
| **0** | 사용자 크레딧 충전 → 위키 첫 호출 결과 확인 | 사용자 액션 |
| 1 | Phase 4 — 위키 버전 관리 + diff 자동 작성 | 위키 첫 호출 만족 시 |
| 2 | Phase 5 — Notion/README export + SQLite FTS 검색 | Phase 4 후 |
| 3 | Phase 6+ — 능동 코치, 슬래시명령 자동화 제안, ChatBot을 Hermes로 격상 | 장기 |
| - | A-4 위저드 검증 (사용자 행동 미진행 상태로 펜딩) | 외부 공개 직전 |

### 주의사항

- **Vite dev server 패턴**: 며칠 돌고 있으면 새 파일 못 잡음 → 재시작 필요. 사용자가 "탭 안 나온다", "입력란 없다" 등 보고하면 우선 Vite 재시작 확인
- **백엔드 --reload 미사용**: WebSocket이 graceful shutdown 막아서 hang. 수동 재시작이 안전
- **DB 위치**: `server/data/aiops_saas.db` (서버 cwd 기준). 루트의 `data/aiops_saas.db`는 빈 파일
- **HERMES_MASTER_KEY 미설정** → dev fallback 키 사용 중. 운영 배포 전 `openssl rand -base64 32`로 생성하여 env 설정 필수
- **JWT_SECRET도 dev 기본값**. 운영 전 교체
- **Anthropic SDK 모델 ID** `claude-sonnet-4-5` (위키 생성), `claude-haiku-4-5` 외 fallback (검증). 변경 시 `wiki_builder.py:DEFAULT_MODEL`, `secret_store.py:_VERIFY_MODELS`
- **사용자 활성 프로젝트**: `inconus-api-erp-v2` (tenant=edf0aee3, repoPath=/mnt/c/project/inconus-api-erp-v2)
- **DB 시크릿 보호**: ingest payload는 secret_masker로 자동 마스킹됨 (Phase A-1 완료). 위키 corpus는 미적용 — Phase 4+에서 추가 검토 권장

### 관련 파일

**Phase 3 신규**:
- `server/services/crypto.py`
- `server/services/secret_store.py`
- `server/routers/secrets.py`

**Hermes 모듈 (Phase 1·2·3)**:
- `server/services/hermes/__init__.py`
- `server/services/hermes/catalog.py`
- `server/services/hermes/wiki_builder.py`
- `server/services/hermes/llm_client.py`
- `server/routers/hermes.py`
- `frontend/src/pages/Agent.tsx`

**수정**:
- `server/services/db.py` (tenant_secrets + hermes_* 4테이블)
- `server/services/env_check.py` (HERMES_MASTER_KEY 검증)
- `server/main.py` (hermes, secrets 라우터 등록)
- `server/requirements.txt` (anthropic, cryptography 추가)
- `frontend/src/pages/Connections.tsx` (AnthropicKeySection)
- `frontend/src/hooks/useApi.ts` (apiPost detail 그대로 throw)
- `frontend/package.json` (react-markdown)

**기획 문서**:
- `프로젝트-기획서.md` (비전 진화, 백로그 #6)
- `헤르메스-도입-설계.md` (13장 — 위키 생성기 중심 재정의)

### Task 상태

- #25~#47: 모두 completed (위저드 검증 #31만 사용자 액션 펜딩)
- 다음 세션에서 새 task ID 시리즈 (#48~)로 Phase 4 시작 권장

---

## 2026.03.30 12:00

### 완료된 작업

**대시보드 레포 (aiops-dashboard)**
- [x] Phase 1 MVP: 6개 페이지 (레포맵, 프로젝트교체, 시스템상태, Hook모니터링, 워크플로우, 프롬프트)
- [x] UI 라이트모드 전환 (Pretendard 폰트, 이모지 제거)
- [x] Pure Reader 리팩토링 — SQLite 제거, JSONL 직접 읽기
- [x] 프로젝트별 로그(.aiops/) 동적 읽기 + 프로젝트 전환 시 watcher 재시작
- [x] 오해 추적 탭 추가 (MisunderstandingTracker.tsx)
- [x] Docker 패키징 (Dockerfile, docker-compose.yml, nginx.conf)
- [x] ESLint 에러 수정 (useWebSocket.ts)

**거버넌스 레포 (claude-config-template)**
- [x] commands/ → skills/ 전환 (6개 skill + misunderstanding-report)
- [x] Hook 9개 (오해 감지 Hook 추가)
- [x] install.sh: --full 모드, URL 교체 (SeongJinAI), react 템플릿 지원
- [x] init-project.sh: .aiops/ 생성 + .gitignore 추가, react 템플릿 지원
- [x] log-utils.sh: 프로젝트/.aiops/ 우선 저장으로 변경
- [x] Hook 범용화: ERP 하드코딩 제거, 테스트레포 경로 환경변수화
- [x] React 프로젝트 템플릿 + 프론트엔드 프레임워크 선택 가이드
- [x] README.md Quick Start 정비
- [x] doc-formats/README.md skills 관계 명시

**지식 레포 (knowledge-repo)**
- [x] 디렉토리 구조 생성 (specs, architecture, manuals, errors, troubleshooting, insights)
- [x] bodylogic-ai 기능명세서 + 아키텍처 설명서 2종 생성됨

**bodylogic-ai 프로젝트**
- [x] Phase 1 개발 완료 (FastAPI + React + 팀에이전트 3개)
- [x] 거버넌스 연동 검증 완료 (Hook 로그 .aiops/에 정상 기록)

### 현재 상태

```
5-repo 시스템:
  거버넌스 ✅ — skills 7개, hooks 9개, rules 3개, 템플릿 4개
  대시보드 ✅ — Pure Reader, 7개 탭, Docker 패키징
  지식     ✅ — 구조 생성, bodylogic-ai 문서 2종
  테스트   ⚠️ — CLAUDE.md placeholder 교체 완료, 실사용 미검증
  프로젝트 ✅ — bodylogic-ai Phase 1 완료 (RAG 스텁 상태)

활성 프로젝트: bodylogic-ai
대시보드 접속: http://localhost:5173 (서버 실행 필요)
```

### 다음 작업
- [ ] 전체 시스템 E2E 테스트 (새 환경에서 install.sh --full → 프로젝트 → 대시보드)
- [ ] 거버넌스 레포 GitHub push (로컬 변경사항 반영)
- [ ] bodylogic-ai Phase 2: RAG 엔진 구현 (pgvector + LangChain)
- [ ] 대시보드 UI 개선 (실사용 피드백 반영)

### 주의사항
- 프로젝트 레포(inconus-api-erp-v2 등)는 이 컨텍스트에서 수정 금지
- 대시보드는 Pure Reader — 자체 데이터 저장 없음 (SQLite 삭제됨)
- Hook 로그는 프로젝트/.aiops/에 저장 (대시보드가 동적으로 읽음)
- CLAUDE.md에는 포괄적 내용만, 세부 규칙은 .claude/rules/에 분리

### 관련 파일
- `CLAUDE.md`, `.claude/rules/프론트엔드.md`, `.claude/rules/백엔드.md`
- `server/services/log_reader.py` — Pure Reader 핵심 (get_log_dir, read_all_logs)
- `server/main.py` — watcher 동적 전환 (restart_watcher)
- `docker-compose.yml`, `server/Dockerfile`, `frontend/Dockerfile`
