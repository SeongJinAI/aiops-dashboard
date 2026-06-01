# HANDOFF.md

## 2026.06.01 (이어서 3) — 관리형 AI + 요청 수 쿼터 (판매 모델) + BYOK 보안 점검

### 한 줄 요약

> 타겟이 **비개발자 바이브코더**라, BYOK 대신 **개발자가 커스텀한 관리형 AI(Nova 키)를 제공 + 월 요청 수 쿼터**로 비용 통제. 결제만 붙이면 판매 가능한 형태. BYOK는 파워유저 오버라이드로 유지. BYOK 키 보관은 이미 견고(AES-256-GCM, 암호문만, prod 마스터키 강제) — 보강 포인트는 보관 방식이 아니라 마스터키/관리형키 custody(prod는 KMS).

### 사용자 결정 (AskUserQuestion)

- 키 모델: **관리형(Nova가 LLM 제공, 비용 부담)** — 비개발자 대상이라 개발자가 시스템 프롬프트 커스텀해 제공. · 쿼터 기준: **요청 수(MVP)**.

### 이번 세션 완료 작업

**#1 관리형 LLM + 쿼터 (백엔드)** ✅
- `LLMUsage` 테이블(tenant·period(YYYY-MM)·count, create_all 자동). `services/usage.py`: `quota_for`·`try_consume`(조건부 UPDATE 원자 증가)·`get_usage`·`QuotaExceeded`. 쿼터 env(`NOVA_QUOTA_FREE`=5/`NOVA_QUOTA_PRO`=500).
- `services/managed_llm.py`: **BYOK 우선(미터링 없음) → 없으면 관리형 키(env) + plan 쿼터 차감**. 관리형 provider 고정(`NOVA_LLM_PROVIDER`, 기본 anthropic). 관리형 키 미설정+BYOK 없음 → `LLMNotConfigured`.
- `coach.synthesize`·`prompt_library.distill`·`rag.answer`를 `managed_llm.complete`로 라우팅(시스템 프롬프트는 그대로 = 개발자 커스텀).
- 라우터: coach/library `/summary`·`/distill`에 `QuotaExceeded`→429(`E.QUOTA_EXCEEDED`), chat `/query`는 쿼터초과 시 검색결과로 degrade. `GET /api/billing/usage`. PLANS에 관리형 쿼터 문구.
- 검증: try_consume(quota=3)×4=[T,T,T,F], /usage shape, 키없음→400, 쿼터초과→429, 라이브 /billing/usage {used:0,quota:5}.

**#2 프론트** ✅
- `Subscribe.tsx`에 "이번 달 관리형 AI 사용량" 카드(used/quota meter + 안내). 쿼터초과 429는 기존 apiPost 토스트가 메시지 노출, chat은 degrade 메시지.
- 빌드 통과(1944 모듈, tsc 0).

### 운영 설정 (판매 전 필수)

- 관리형 키: `NOVA_LLM_PROVIDER=anthropic` + 해당 provider env 키(예: `ANTHROPIC_API_KEY=<관리형 키>`). **이 키도 critical secret** — 누출 시 우리 비용 폭주. prod는 KMS/Secrets Manager.
- `HERMES_MASTER_KEY`(BYOK 복호화) + `JWT_SECRET`: prod(`AIOPS_ENV=prod`)에서 기동 거부로 강제됨. **배포 시 `AIOPS_ENV=prod` 설정 필수**(미설정 시 dev 기본값 silent).
- 쿼터 조정: `NOVA_QUOTA_FREE`/`NOVA_QUOTA_PRO`.

### 다음 세션에 할 작업

- **결제 실연동(Lemon Squeezy)** — 이거 하나면 판매 가능. webhook→plan 갱신, prod 가드.
- 남은 보안 하드닝(Tier 4): CORS 메서드/헤더 제한, logs target_date path traversal 검증, rate limit 미세조정.
- 토큰 기준 쿼터(비용 정확) 업그레이드 — 현재 요청 수.

### 주의사항

- **BYOK 있으면 미터링 안 함**(본인 비용). 관리형(env 키)일 때만 쿼터 차감.
- 쿼터는 월 단위(period=UTC YYYY-MM). 월 바뀌면 자동 리셋(새 row).
- 백엔드 재시작해야 반영(완료). vite 폴링 자동.

### 관련 파일

**신규**: `server/services/usage.py`, `server/services/managed_llm.py`
**변경(백엔드)**: `models/db_models.py`(LLMUsage), `services/{coach,prompt_library,rag,billing,errors}.py`, `routers/{coach,library,chat,billing}.py`
**변경(프론트)**: `pages/Subscribe.tsx`

---

## 2026.06.01 (이어서 2) — 컨벤션 정리(로깅/에러코드) + 발표 자료 업데이트

### 한 줄 요약

> 감사 Tier 5 컨벤션 적용: **중앙 에러 레지스트리**(`services/errors.py`의 `E`/`err`)로 ERR_* 코드+메시지 SSOT화, **중앙 로깅 핸들러**(main.py)로 4xx=warning·5xx=error 자동 로깅, print/silent-except 제거. 발표 덱을 진화한 제품(지식 문서 생성 skill + RAG 지식 챗 되먹임, 코칭 SaaS, 퍼널/프리미엄)에 맞춰 갱신.

### 이번 세션 완료 작업

**#1 컨벤션 — 로깅 레벨 + 에러코드 중앙관리** ✅
- `services/errors.py` 신규: `class E`(ERR_* 코드 + HTTP 상태 + 메시지) + `err(entry, detail?)`. 예외 4계층 매핑. 문자열 리터럴 직접 사용 제거의 SSOT.
- `main.py`: `StarletteHTTPException` 핸들러로 **4xx=warning / 5xx=error** 중앙 로깅(`logging` 설정), `Exception` 핸들러로 미처리 예외 error 로깅+500. (라이브 확인: `WARNING nova: 401/402 METHOD path → detail`.)
- 적용: `hermes.py`(활성프로젝트 3중 메시지/상태 불일치 → `E.NO_ACTIVE_PROJECT` 통일, local-repo·perspective·run·version·in-progress도 `E`로), `secrets.py`(print 제거 — 중앙 핸들러가 로깅), `projects.py`(silent except → logger.warning), `middleware/auth.py`(require_premium/flexible 401 → `E`), `chat.py`·`coach.py`·`library.py`(LLM 503 → `E.LLM_PROVIDER`).
- 검증: 전 라우터 import OK, TestClient로 401/402 응답·로그 확인.

**#2 발표 자료 업데이트** ✅
- `발표/발표자료.html`(14슬라이드 유지): **Wikify를 "지식 루프"로 강화** — "AI가 만든 지식을 AI가 다시 읽는다"(문서생성 skill→색인→RAG 되먹임 loop 다이어그램), 비주얼은 **지식 챗(RAG) 목업**(질문→답변+출처). 로드맵 갱신(지금 되는 것: 지식문서 skill+RAG·Coach·라이브러리·퍼널 / 만드는 중: 임베딩·결제 실연동). Nova 인트로 Wikify 노드·데모 슬라이드 문구 갱신. 구식 잔재(252개·RAG 챗봇 pgvector·위키 빌드) 제거.
- `발표/데모-스크립트.md`: Wikify 데모 섹션을 지식 챗(색인→질문→출처)+/nova-recall 되먹임으로 재작성, 동선 표 갱신.

### 다음 세션에 할 작업

- 미룬 **Tier 4(보안 하드닝)**: JWT_SECRET saas 강제, rate limit 테넌트별, path traversal(logs target_date) 검증, CORS 제한, 키 에러메시지 일반화.
- 임베딩 벡터 검색(RAG 업그레이드), 결제 실연동(맨 마지막).
- 에러 레지스트리를 나머지 라우터(repos/assets/scripts 등)에도 점진 확대(현재는 신규/플래그 지점 위주).

### 주의사항

- **중앙 로깅**: 모든 HTTPException이 status별로 로깅됨(4xx warn/5xx error). `AIOPS_LOG_LEVEL` env로 레벨 조정.
- **에러 추가 시**: `services/errors.py`의 `E`에 항목 추가 후 `raise err(E.X)`. 문자열 리터럴 직접 raise 지양.
- 백엔드 재시작해야 반영(완료). vite는 폴링이라 자동.

### 관련 파일

**신규**: `server/services/errors.py`
**변경(백엔드)**: `server/main.py`(로깅+핸들러), `routers/{hermes,secrets,projects,chat,coach,library}.py`, `middleware/auth.py`
**변경(발표)**: `발표/발표자료.html`, `발표/데모-스크립트.md`

---

## 2026.06.01 (이어서) — RAG 지식 챗 (되먹임 루프 완성) + vite 폴링 fix

### 한 줄 요약

> 지식 문서 생성(skill)의 나머지 반쪽 — **생성된 docs → 색인 → 검색 → AI 답변**으로 되먹이는 RAG 루프. 검색은 **어휘 TF-IDF(키/임베딩/pgvector 불필요, 한글 char-bigram으로 조사 문제 해결)**라 항상 동작, 합성 답변만 BYOK. 대시보드 **지식 챗 페이지** + 로컬 **nova-recall skill**(작업 전 지식 회상)로 양쪽 소비. WSL stale-vite 근본 원인(파일 감시 미동작) 폴링으로 영구 해결.

### 이번 세션 완료 작업

**#1 RAG 백엔드** ✅
- `DocChunk` 테이블(create_all 자동). `services/rag.py`: 마크다운 청킹(헤딩/문단 ~900자) + **어휘 검색**(TF-IDF, 한글 bigram + 영문 단어 토큰, 정확구절 보너스) + BYOK LLM 합성(출처 [번호] 인용).
- `routers/chat.py`: `GET /status`·`POST /index`·`POST /query`. **JWT 또는 X-API-Key 둘 다 허용**(`middleware/auth.py:get_tenant_flexible` — 대시보드+로컬 skill 공용). 키 없으면 검색결과만 반환(검색은 키리스).
- 검증: 실자산 3건 색인→검색 정확("로그인 인증 흐름"→login.md, "PostgreSQL 스키마"→db.md, "시작하기 가이드"→start.md). 무인증 401. 토크나이저 조사문제 해결 확인.

**#2 RAG 프론트** ✅
- `pages/Chat.tsx`: 질문→답변(markdown)+출처 카드+색인 갱신. nav 코칭 섹션에 **지식 챗**(`/chat`, search 아이콘) 3번째. 빈 상태=색인 안내.

**#3 nova-recall skill** ✅
- 번들에 추가(이제 **7종**). 작업 전 `~/.claude/.env`의 키로 `/api/chat/query` 조회→관련 docs를 컨텍스트로. install.sh 안내 갱신.

**#4 vite 폴링 fix** ✅
- `vite.config.ts`에 `server.watch.usePolling`. WSL `/mnt/c`는 fs.watch 미동작 → HMR이 변경을 놓쳐 이번 세션 내내 "stale vite"였음. 폴링으로 해결.

### 검증

- `npm run build` 통과(1944 모듈, tsc 0). 백엔드 import OK. skills.tar 7종. install.sh /nova-recall 포함. 라이브: chat/status 401, 프론트 App.tsx Chat 반영 확인.

### 다음 세션에 할 작업

- **임베딩 벡터 검색**(선택 업그레이드): DocChunk에 embedding 컬럼 + BYOK 임베딩(OpenAI/Gemini) → 어휘+벡터 하이브리드. 지금은 어휘만.
- 더 풍부한 자산으로 RAG 데모(install.sh를 실제 프로젝트에 돌려 docs 채우기).
- 앞서 미룬 Tier 4(보안)·Tier 5(컨벤션). 결제(맨 마지막).

### 주의사항

- **RAG 검색은 키 없이 동작**(어휘). 합성 답변만 BYOK. 데모 안전.
- 색인은 활성 프로젝트의 `assets`(.md) 대상. assets가 비면 색인 0 → "색인 갱신" 후에도 0이면 install.sh로 .md를 push해야 함.
- `get_tenant_flexible`는 JWT/X-API-Key 둘 다 — nova-recall이 X-API-Key로 호출.
- 백엔드 재시작해야 새 라우트 반영. **vite는 이제 폴링이라 자동 반영**(이전 stale 문제 해소).

### 관련 파일

**백엔드 신규**: `services/rag.py`, `routers/chat.py`, `server/scripts/skills/nova-recall/SKILL.md`
**백엔드 변경**: `models/db_models.py`(DocChunk), `middleware/auth.py`(get_tenant_flexible), `main.py`(chat 등록), `routers/scripts.py`(recall 안내)
**프론트 신규/변경**: `pages/Chat.tsx`, `constants/nav.ts`, `App.tsx`, `styles/ui.css`(chat), `vite.config.ts`(폴링)

---

## 2026.06.01 — 지식 문서 생성 skill 번들 + install.sh 설치 (신규 프로젝트 프로비저닝)

### 한 줄 요약

> Nova는 신규 프로젝트 모니터링 도구 → install.sh가 모니터링 Hook뿐 아니라 **지식 문서 생성 skill 6종을 프로젝트의 `.claude/skills/`에 설치**한다. 개발자의 Claude Code가 그 skill을 실행해 `docs/*.md`를 생성(서버 LLM 비용 0) → 기존 자산 sync로 Nova에 되먹임 → Wikify/RAG 입력. "지식 문서 생성"(#1)과 "프롬프트 관리"(#3)를 로컬 skill로 실현.

### 이번 세션 완료 작업

**#1 지식 문서 생성 skill 6종** ✅ (`server/scripts/skills/<name>/SKILL.md`)
- `nova-feature-spec`(기능명세서: API명세+검증흐름도+체크리스트), `nova-architecture`(BigPicture+시퀀스+Entity+테스트+권한), `nova-db-erd`(Mermaid ERD+테이블사전), `nova-api-flow`(엔드포인트 처리 플로우+에러분기), `nova-domain-insight`(도메인 규칙/용어/엣지/결정로그 — "다음 작업용 컨텍스트"), `nova-prompt-vault`(개인 프롬프트 금고: 저장/분류/검색/재사용 — #3).
- 전역 원칙(기능명세서·아키텍처 포맷, 예외 4계층, 계층 아키텍처) 반영. 출력은 `docs/<category>/*.md` → REPO_ROOT 안이라 자산 sync 대상.

**#2 백엔드 번들 서빙 + install.sh 단계** ✅
- `routers/scripts.py`: `GET /api/scripts/skills.tar` — `server/scripts/skills/`를 tar로 스트리밍(인증 불필요, 공개 정적). io/tarfile 사용.
- install.sh `_build_integrated_script`: 5단계 → **6단계**. 신규 `[4/6] skill 설치`(skills.tar 다운로드 → `.claude/skills/`에 `tar -xf`), 완료 안내에 6개 슬래시 명령 표시.

### 검증

- TestClient: skills.tar 200(30,720B, 6 SKILL.md, `nova-*/SKILL.md` 구조), 6 skill name 파싱 OK.
- install.sh 생성물: `[4/6]`·skills.tar 다운로드·`.claude/skills` 추출·`[6/6]`·완료안내 포함, 잔존 `[n/5]` 없음.
- 라이브: 백엔드 재기동 후 `curl skills.tar | tar -xf` → `.claude/skills/nova-*/SKILL.md` 6종 정확히 추출.

### 다음 세션에 할 작업

- **되먹임 루프 완성(RAG)**: 생성된 docs/*.md → pgvector 색인 → AI 다음 작업에 자동 주입(#2 방향, 이번엔 미착수). "지식 문서 = AI 작업 메모리"의 핵심 루프.
- 더 많은 유용한 skill 번들에 추가(코드리뷰/테스트/리팩토링 등).
- 앞서 미룬 Tier 4(보안 하드닝)·Tier 5(로깅/에러코드).
- 결제 실연동(맨 마지막).

### 주의사항

- skill 번들은 **공개 엔드포인트**(인증 불필요) — 민감정보 없음(skill 정의는 공개 가능). install.sh 본문엔 API_KEY가 변수로 박힘(기존 보안 모델 동일).
- skill 출력 디렉토리 `docs/`는 자산 push의 SKIP 목록(.aiops/node_modules 등)에 없음 → 정상 sync. `.aiops/`에 쓰면 sync 안 되니 docs/ 유지.
- 백엔드 재시작해야 새 라우트 반영(--reload 미사용). 프론트 vite는 자동.

### 관련 파일

**신규**: `server/scripts/skills/{nova-feature-spec,nova-architecture,nova-db-erd,nova-api-flow,nova-domain-insight,nova-prompt-vault}/SKILL.md`
**변경**: `server/routers/scripts.py`(skills.tar 엔드포인트 + install.sh 6단계)

---

## 2026.05.29 16:30 — 제품 피벗: 랜딩/퍼널 + 프리미엄(프롬프트 라이브러리) + 코칭 중심 IA

### 한 줄 요약

> "5-레포 운영 대시보드"에서 **완전 개인화된 AI 코칭 SaaS**로 방향 전환. 덱 스타일을 제품에 연결한 **공개 랜딩 → 회원가입 → 로그인 → 프리미엄 구독** 퍼널. 프리미엄 핵심 = **프롬프트 라이브러리**(opt-in한 사용자 프롬프트를 LLM이 주제별 익명 템플릿으로 증류, 원본 비공개·secret 마스킹). 결제는 목(플래그). IA를 코칭 중심으로 재편(레포맵/5-레포 nav 제거).

### 사용자 결정 (AskUserQuestion)

- 공유 모델: **증류 템플릿만**(원본 비공개) · 결제: **프리미엄 플래그+목 체크아웃** · 소비: **대시보드 라이브러리(복사)** · IA: **개인 코칭 중심 전면 재편**

### 이번 세션 완료 작업

**#1 백엔드 기반** ✅
- 모델 2종(`models/db_models.py`): `Subscription(tenant_id PK, plan, share_opt_in)`, `PromptTemplate(topic,title,body,tags,example_count)`. **새 테이블이라 create_all이 자동 생성 — 마이그레이션 불필요**.
- `services/billing.py`: get/set plan·share_opt_in, is_premium, PLANS(가격표 단일 진실). plan은 JWT 아닌 DB에서 읽음(재로그인 없이 즉시 반영).
- `services/prompt_library.py`: opt-in 테넌트 프롬프트 수집(secret_masker 마스킹·중복 제거·최대 250) → BYOK LLM 증류 → 글로벌 템플릿 교체. 원본 미저장.
- `routers/billing.py`(status/checkout-mock/cancel/share-opt-in), `routers/library.py`(templates/distill, 둘 다 `require_premium`). `middleware/auth.py`에 `require_premium`(402) 추가. `main.py` 등록.
- 검증: TestClient + HTTP — 비프리미엄 402 / 목 checkout→pro→200 / corpus 250개 마스킹 수집 / distill 키없음 400. 테넌트는 **free로 리셋**(사용자 퍼널 직접 체험용).

**#2 랜딩 + 퍼널** ✅
- `pages/Landing.tsx` + `styles/landing.css`: 덱 미학(oklch 토큰, 라이트 기본+다크 자동). 히어로(코치 카드 목업)+Track/Wikify/Coach+프롬프트 라이브러리 Pro 티저+가격표(Free/Pro)+CTA.
- `App.tsx`: 미인증 시 `authView: landing|auth` → Landing(로그인/시작하기) → `Login`. `Login.tsx`에 `initialMode`/`onBack` 추가.

**#3 라이브러리/구독 페이지** ✅
- `pages/Subscribe.tsx`: 플랜 카드 + 목 업그레이드/취소 + 공유 opt-in 토글(스위치).
- `pages/Library.tsx`: 비프리미엄=잠금+업그레이드 CTA / 프리미엄=주제 필터+템플릿 카드+복사+증류(BYOK provider select). opt-in 안내.
- `ui.css`에 plan/switch/library 클래스 추가.

**#4 IA 코칭 중심 재편** ✅
- `nav.ts`: `코칭`(홈·코치·프롬프트·프롬프트 라이브러리[Pro]·오해 추적·Hook 활동) + `에이전트·계정`(위키 에이전트·연결·구독). **레포맵·프로젝트·워크플로우·Claude설정 nav에서 제거**(라우트는 유지, breadcrumb는 OFF_NAV_LABELS로 보정).
- `Home.tsx` 재작성: 5-레포 "레포 아키텍처" 섹션 제거 → 협업 점수 요약(`/coach/report`) + 바로가기(코치·라이브러리·위키).
- 검증: `npm run build` 통과(1947 모듈, tsc 0 error).

### 다음 세션에 할 작업

- **라이브러리 증류 실제 1회 실행**(BYOK 키+크레딧): 사용자가 구독 opt-in → 라이브러리 갱신 → 실제 템플릿 확인.
- **실결제(Lemon Squeezy)**: checkout이 redirect URL 반환 + webhook으로 plan 갱신. 지금은 목.
- 자동완성(에디터 연동) — 추후 API/슬래시 명령으로 라이브러리 노출.
- 랜딩 카피/비주얼 다듬기, 다크 히어로 옵션 검토.
- off-nav 페이지(레포맵 등) 완전 제거 여부 결정.

### 주의사항

- **퍼널 확인은 로그아웃 상태에서**: 이미 로그인된 세션은 랜딩을 건너뜀. 랜딩→가입→구독 흐름은 로그아웃(또는 새 시크릿 창)으로 확인. vite HMR이 새 파일 못 잡으면 하드 새로고침.
- **plan은 DB(Subscription) 기반**: 목 checkout은 즉시 pro. 실제 청구 없음. 테넌트 edf0aee3는 현재 free로 리셋됨.
- **프라이버시**: 라이브러리 corpus는 share_opt_in=True 테넌트 + 호출자만, secret_masker 적용. 원본 프롬프트는 PromptTemplate에 저장 안 함(증류 결과만).
- **JWT 서명**: 테스트 토큰 생성 시 반드시 .env 로드(JWT_SECRET 일치). 안 그러면 401.
- 백엔드는 재시작해야 새 라우터 반영(--reload 미사용). 프론트 vite는 자동.

### 관련 파일 (이번 세션)

**백엔드 신규**: `services/billing.py`, `services/prompt_library.py`, `routers/billing.py`, `routers/library.py`
**백엔드 변경**: `models/db_models.py`(Subscription·PromptTemplate), `middleware/auth.py`(require_premium), `main.py`(라우터 등록)
**프론트 신규**: `pages/Landing.tsx`, `pages/Subscribe.tsx`, `pages/Library.tsx`, `styles/landing.css`
**프론트 변경**: `App.tsx`(퍼널+라우트), `pages/Login.tsx`(initialMode/onBack), `pages/Home.tsx`(코칭 중심 재작성), `constants/nav.ts`(IA 재편), `styles/ui.css`(plan/switch/library)

---

## 2026.05.29 15:00 — Coach(3단계) 구현 + Nova 브랜드 통일 + 발표자료

### 한 줄 요약

> Track/Wikify는 완성, **Coach(가치사슬 3번째 다리)만 미구현**이던 빈 자리를 채웠다. 축적된 프롬프트·Hook·오해 데이터 → **룰 기반 협업 점수(명확성/거버넌스/꾸준함) + 실행 가능한 인사이트**(LLM 불필요, 항상 동작) + 선택적 BYOK LLM 코치 브리핑. 브랜드를 **Nova로 통일**(섹션명·잔재 정리). **부산 AI 카르텔 발표용 단일 HTML 덱**(20슬라이드) + 데모 스크립트 작성, 3-렌즈 적대적 리뷰 후 수정.

### 이번 세션 완료 작업

**#1 Coach 백엔드** ✅
- `server/services/coach.py` 신규: `generate_report(tenant_id)` — 룰 기반. 점수 3종(명확성=오해율 역산 / 거버넌스=Hook 통과율 / 꾸준함=최근14일 활동일), 인사이트 6종(오해 반복·Hook 핫스팟·통과율·긴 프롬프트·피크 시간대·활동 추세), 헤드라인, lowData/정직한 빈 상태. `synthesize()` — BYOK provider로 한국어 코치 브리핑(선택).
- `server/routers/coach.py` 신규: `GET /api/coach/report`(전역 120/min), `POST /api/coach/summary`(20/min, LLMNotConfigured→400). `main.py`에 `/api/coach` 등록.
- **핵심 설계**: 점수+인사이트는 LLM 키 없이도 동작 → 데모/무료 티어 신뢰성. (과거 Anthropic 크레딧 0 블로커 회피)
- 검증: 실데이터(tenant edf0aee3) TestClient E2E — 무인증 401 / 인증 200 (**점수 85·B**, 명확성99·거버넌스100·꾸준함57, 인사이트 4) / 키없음 summary 400.

**#2 Coach 프론트 + 네비/라우팅 + 브랜드** ✅
- `frontend/src/pages/Coach.tsx` 신규: 토큰 기반(인라인스타일 없음, 다크모드 안전). 점수 카드 + 메트릭 바 + 인사이트 카드(severity 좌측 보더) + BYOK 브리핑(provider select + react-markdown).
- `nav.ts`: 3번째 섹션 `Nova`→`Agent`, **코치** 항목 추가(`/coach`, lightbulb). `App.tsx` 라우트 + import.
- `Misunderstandings.tsx`: "Coach 비전(미구현)" 빈 상태 → 실제 **코치 열기** 버튼.
- `ui.css`: `.insight*`, `.coach-*` 클래스 추가(meter tone 변형은 기존 재사용).
- 브랜드 정리: `repos.ts` TABS `"에이전트 (Hermes)"`→`"에이전트"`, `projects.py` 안내 메시지 `Hermes 자산 카탈로그`→`자산 카탈로그`.
- 검증: `npm run build` 통과(1943 모듈, tsc 0 error).

**#3 발표자료 (부산 AI 카르텔)** ✅
- `발표/발표자료.html` — 단일 자가완결 HTML 덱(**14슬라이드**). 제품과 동일 oklch 토큰·다크 기본(T 라이트 토글, F 풀스크린, ←→/Space 네비, 진행바/카운터). 외부 의존=Pretendard CDN 폰트뿐.
- **방향(중요)**: 발표자는 "커뮤니티를 설명하는 사람"이 아니라 "모임에서 **프로젝트(Nova)를 발표**하는 사람". 커뮤니티(부산 AI 카르텔)는 **맥락·청중**이지 주제가 아님 → 매니페스토 선언/커뮤니티 비전("부산 AI 하면 떠올리는 이름", 엔진 루프) **덜어냄**. 커뮤니티는 오프닝 1장("가져오는 자리니까 가져왔다")·연결 1장("닮았더라고요")으로 가볍게만.
- 서사: 오프닝(가벼운 모임 맥락) → 문제 → Nova(Track/Wikify/Coach) → 실데이터 → **Coach 클라이맥스** → 라이브 데모 → build in public/로드맵 → 연결(Track≈가져온다/Wikify≈나눈다/Coach≈끌어올린다, 겸손) → CTA(같이 써볼 사람).
- `발표/데모-스크립트.md` — Track→Wikify→Coach 단계별 라이브 데모 스크립트(5~6분) + 사전 점검 + 실패 대비.
- **3-렌즈 적대적 리뷰**(workflow): 사실/서사/디자인. 적용: SVG `fill="var()"` 블로커 수정(`.mk-bg`/`.mk-fg` CSS), 매핑 순서/의미 재배치, "양이 아닌 질" 카피, CTA 액션, 메타 강화, 시제. **기각**: fact-check의 "피크 16→07시" 오판(배열 174는 index 16이 맞음, python 검증).

### 다음 세션에 할 작업

- **Coach 고도화**: 추세/시간대 인사이트에 차트 추가, wiki 신선도 인사이트(hermes 결합), 코치 점수 추이(시계열 저장).
- **첫 Alembic 마이그레이션**(이전 세션 펜딩, PG 켠 상태 필요).
- **RAG 챗봇**(pgvector) — 다음 Phase.
- **보조 페이지 다크모드**: RepoMap/ClaudeConfig/OnboardingWizard (구식 인라인+colors.ts, 데모 라이트모드면 무방).
- 발표 당일: 재로그인(JWT 24h), 코치/프롬프트 페이지 사전 로드, 디스플레이 세로 해상도에서 14번 슬라이드 잘림 점검.

### 주의사항

- **Coach 점수는 실데이터가 좋을수록 warn/suggest가 적게 뜬다**(현재 tenant는 점수 85·통과율100%라 good/info 위주). 데모에서 경고 카드를 보이려면 지저분한 프로젝트 필요 — 데모 스크립트에 이 점 명시.
- **Track 수치는 라이브 데이터**(계속 증가) → 덱의 1,056/2,283은 "현재 기준"이며 제품 화면(userTotal·30일 윈도우)과 일치하도록 맞춤. 발표 당일엔 라이브 화면이 최신.
- **타임존**: 시간대 분포는 로그 ts의 hour 필드 그대로(UTC/local 여부 미확정). 피크 index 16은 데이터상 사실. 데모 전 한 번 확인 권장.
- 이전 세션 주의사항(uvicorn graceful shutdown, secret_store async, SQLAlchemy upsert, 백그라운드 기동은 포그라운드로) 그대로 유효.

### 관련 파일 (이번 세션)

**백엔드 신규/변경**: `server/services/coach.py`(신규), `server/routers/coach.py`(신규), `server/main.py`(coach 등록), `server/routers/projects.py`(브랜드 메시지)
**프론트 신규/변경**: `frontend/src/pages/Coach.tsx`(신규), `frontend/src/App.tsx`, `frontend/src/constants/nav.ts`, `frontend/src/pages/Misunderstandings.tsx`, `frontend/src/styles/ui.css`, `frontend/src/constants/repos.ts`
**발표**: `발표/발표자료.html`(신규), `발표/데모-스크립트.md`(신규)

---

## 2026.05.29 — UI 교체 + 자산 sync + PostgreSQL/SQLAlchemy + nginx

### 한 줄 요약

> Nova 디자인 시스템으로 프론트 전면 교체 → SaaS 시나리오 정합성(공개 URL, 자산 sync) → DB를 SQLite raw SQL에서 SQLAlchemy(PostgreSQL 우선/SQLite 폴백)로 전환 → Caddy 대신 nginx 운영 리버스 프록시. 직접 SQL 호출 10개 파일을 모두 ORM으로 마이그레이션.

### 이번 세션 완료 작업

**#1 UI 전면 교체 — Nova 디자인 시스템** ✅
- `frontend-new/` (frontend-design 산출물, 자체 CSS 디자인 시스템) → 기존 React 19 + Vite + TS에 통합.
- `styles/tokens.css`+`styles/ui.css` 이식 (oklch, density compact/normal/roomy, light/dark).
- `ui/Icon.tsx` (lucide-react name 매핑), `ui/primitives.tsx` (Box/StatCard/Chip/Btn/EmptyState/Skeleton/Avatar), `ui/toast.tsx` (ToastProvider/useToast).
- `app/AppShell.tsx`: Sidebar(3섹션 10항목) + TopBar + CommandPalette(⌘K/B/D) + Toast. localStorage로 theme/density 영속.
- `App.tsx`: TabBar(평면 10) → path 기반 switch 라우팅. 인증/모드 분기·OnboardingWizard 보존.
- 새 디자인 + 실데이터 페이지: Home/HookMonitor/Prompts/Misunderstandings/Agent/Connections/ProjectSwap/WorkflowTracker/Login.
- 구 파일 정리: TabBar/ChatBot/ConnectionStatus/shared/* + 구 SystemStatus/PromptHistory/MisunderstandingTracker + `constants/design.ts` 삭제.

**#2 페이지 이동 시 강제 로그아웃 버그 fix** ✅
- 원인: `/api/projects` (slash 없음) → FastAPI 307 → `/api/projects/` → fetch redirect 시 Authorization 헤더 드롭 → 401 → `useApi.handleUnauthorized()`가 localStorage 정리 + reload.
- fix: `routers/projects.py`에 `@router.get("")` 추가(secrets와 동일 패턴) + 프론트 호출에 trailing slash 명시.

**#3 install.sh URL이 vite dev origin(5173)으로 박히는 버그 fix** ✅
- 원인 1: 백엔드 `resolve_public_url`이 vite proxy의 Host(5173)를 봄 → `vite.config.ts`에 `changeOrigin: true` 추가.
- 원인 2: `App.tsx`의 `apiBase` 초기값이 `window.location.origin`(=5173) → `inferInitialApiBase()` 추가 (5173/5174면 8000으로 즉시 보정).
- 추가 UX: install.sh에 `?download=1` 쿼리 → `Content-Disposition: attachment` 응답. Connections/OnboardingWizard에 **"install.sh 다운로드"** 버튼.

**#4 자산 sync 메커니즘 — SaaS에서 Hermes 위키 빌더 동작 복구** ✅
- 신규 테이블 `assets(tenant_id, project_name, path, perspective, bucket, content, size_bytes, modified_at)`.
- 신규 라우터 `routers/assets.py`: `POST /api/assets/sync`(배치 200개), `/sync-one`, `/delete`, `/list`. path traversal 차단, `.md`만 허용, 1MB 제한, project 등록 검증.
- `services/hermes/catalog.py`: `classify_asset()` public alias + `AssetEntry.content` 옵션 필드.
- `services/hermes/wiki_builder.py`: `_asset_text()` — SaaS는 `asset.content` 사용, local은 파일에서 읽음.
- `routers/hermes.py`: `_load_assets()` 분기 — SaaS면 DB의 `list_assets`, local이면 `catalog_assets`.
- `install.sh` `[4/5]` 단계 추가: `python3 -c`로 REPO_ROOT 안 `.md` 전수 수집 → 100개씩 배치 push.
- PostToolUse Hook(`aiops-log-hook.sh`): Edit/Write/MultiEdit이 `.md`를 만지면 `/api/assets/sync-one`으로 자동 push (REPO_ROOT 안만).
- 검증: 가짜 자산 3개 INSERT → `_load_assets()` 반환 정확 + `group_by_perspective`/`summarize` 정상.

**#5 PostgreSQL + SQLAlchemy 전면 전환** ✅
- 의존성: `sqlalchemy[asyncio]>=2.0`, `asyncpg>=0.29`, `alembic>=1.13` 추가.
- `models/db_models.py`: 전 9테이블 ORM 모델 (Tenant/User/Log/Project/HermesWiki/HermesWikiRun/TenantSecret/HermesSoul/Asset).
- `services/database.py`: async engine + `session_scope`(context) + `get_session`(Depends) + `init_db`(dev 폴백). `DATABASE_URL` 환경변수 우선, 없으면 `DB_PATH`로 SQLite 폴백.
- `services/db.py` 전면 재작성 (시그니처 유지): `insert_log`/`query_logs`/`compute_*_stats`/`upsert_asset`/`list_assets` 등. PG/SQLite 모두 `INSERT ... ON CONFLICT DO UPDATE` 지원(dialect별 `_ins.on_conflict_do_update`).
- **라우터/서비스 10개 파일의 직접 SQL 모두 제거** (검증: grep `sqlite3.connect|aiosqlite.connect` 0건):
  - `routers/{auth,assets,hermes,repos,secrets}.py`
  - `services/{auth,project_swap,secret_store,misunderstanding_detector,claude_config_scanner}.py`
- `secret_store` + `LLMProvider.load_key/require_key` async 통일. 각 provider(anthropic/openai/gemini)의 `complete()`에서 `await self.require_key()`.
- Alembic: `server/alembic.ini` + `alembic/env.py`(async) + `script.py.mako`. 첫 마이그레이션은 다음 세션에서 (PostgreSQL 띄운 상태 필요).

**#7 Coach 페이지 신설 — Track → Wikify → Coach 가치 사슬 완성** ✅ (세션 막판)
- 백엔드 `services/coach.py` + `routers/coach.py`:
  - `GET /api/coach/report` — 룰 기반 협업 점수(score/grade) + metrics + insights(severity별: warn/suggest/good/info). LLM 불필요, 항상 동작.
  - `POST /api/coach/summary` — 등록된 BYOK provider로 코치 브리핑 마크다운 생성 (선택).
- `main.py`에 라우터 등록: `prefix="/api/coach"`.
- 프론트 `pages/Coach.tsx` (182줄): CoachReport 표시 — score/grade/metrics 미터 + insights 카드 + headline. `react-markdown`으로 LLM 브리핑 렌더.
- `App.tsx`에 `/coach` 라우팅 추가, `pages/Coach` import.
- 사이드바 그룹명 **'Nova' → 'Agent'** 로 변경 (`constants/nav.ts`), `coach`(lightbulb) 항목 추가.
- `pages/Misunderstandings.tsx`: 하단 EmptyState가 "코치 열기" 버튼으로 `/coach` 진입 (onNavigate prop).
- `routers/projects.py`: `/structure` SaaS 모드 분기 — 사용자 로컬 디렉토리 스캔 불가 안내 메시지 + repoPath만 반환.

**#6 docker-compose + nginx 운영 설정** ✅
- `docker-compose.yml` (dev): postgres 서비스 추가 + healthcheck + `command: alembic upgrade head && uvicorn`.
- `docker-compose.cloud.yml` (운영): **Caddy 제거 → nginx 도입** + certbot 옵션 프로파일.
- `deploy/nginx/nova.conf`: `/api`/`/ws`/`/`(SPA) 분기, `X-Forwarded-Proto/Host` 전달, gzip, 보안 헤더, HTTPS 블록 주석 처리(certbot 발급 후 활성화).
- `deploy/README.md`: 첫 배포·SSL·마이그레이션·백업 가이드.
- `.env.example`: `DATABASE_URL`/`POSTGRES_*`/`AIOPS_PUBLIC_URL` 추가.

### 검증

- 전 모듈 import (10개) 통과
- `npm run build` 통과 (1942 모듈, lint 0 error)
- 백엔드 부팅 1초, `/api/mode` 정상 (`public_url=http://localhost:8000`)
- SQLAlchemy `create_all`로 `assets` 포함 10개 테이블 자동 생성 (server/data/aiops_saas.db)
- 가짜 자산 sync → `_load_assets` 정상 (DB→AssetEntry 변환 + content 채워짐)
- `grep "sqlite3\.connect|aiosqlite\.connect"` → 0건

### 다음 세션에 할 작업 (우선순위 순)

**A. Coach 검증 + 확장 (방금 추가됨)**
- `services/coach.py` 룰 정확도 점검 (실데이터로 score/grade가 합리적인지)
- Coach 페이지 빈 상태(데이터 0건) UX, summary 호출 실패 시 사용자 친절도
- BYOK 미등록 상태에서 summary 버튼 비활성화 처리 확인
- 룰 추가 후보: "오해 패턴 상위 3개 → CLAUDE.md 룰 제안", "워크플로 단계 건너뜀 빈도"

**B. 첫 Alembic 마이그레이션 생성 (운영 배포 전 필수)**
- 로컬 PostgreSQL 띄움: `docker compose up -d postgres`
- `cd server && DATABASE_URL=postgresql+asyncpg://nova:nova@localhost:5432/nova alembic revision --autogenerate -m "initial schema"`
- 생성된 `alembic/versions/*.py` 검토 + commit. 이후 backend 컨테이너 시작 시 자동 upgrade.

**C. RAG 챗봇 구현 (다음 Phase)**
- 사이드바 `Chat` 페이지 자리(현재 ChatBot stub 비어있음)
- DB가 PostgreSQL이라 **pgvector 확장** 자연스러움. `assets` 본문 → 청크 → 임베딩 → `pg_vector` 컬럼.
- 신규 라우터 `/api/chat/{search,query}` — BYOK provider로 LLM 답변.
- 의존성: pgvector 확장 (postgres image에 추가), `sentence-transformers` 또는 OpenAI embeddings API.

**D. 보조 페이지 새 디자인 마이그레이션 (다크모드 미대응)**
- `RepoMap.tsx` (274줄), `ClaudeConfig.tsx` (483줄), `OnboardingWizard.tsx` (521줄)
- 현재 `constants/colors.ts`(hex) + 인라인 스타일 → ui/primitives + 토큰 기반으로
- colors.ts 의존도 줄여 다크모드 일관성 확보

**E. `useApi.handleUnauthorized()` 보수화 (false 401 방어)**
- 현재: 401 시 무조건 localStorage 정리 + `window.location.reload()`
- 개선: 토스트 + 1회 retry → 그래도 401이면 정리, reload 대신 `useAuth.logout()` (탭 상태 유지)

**F. 정리/결정 필요**
- `Caddyfile` — 더 이상 docker-compose에서 안 쓰임. 삭제? 보관?
- Lemon Squeezy 결제 인프라 (saas-improvement-report Phase A)
- 운영 배포 실행 (도메인 결정 후) — `deploy/README.md` 가이드대로
- karpathy-guidelines 스킬 설치됨(`./.agents/skills/karpathy-guidelines`) — 다음 세션 코드 작성/리뷰 시 활용 권장

### 주의사항

- **dev 환경**: 사용자 `.env`에 `DATABASE_URL`이 없어 SQLite 폴백 (`server/data/aiops_saas.db`). 운영 배포 시 반드시 PostgreSQL.
- **uvicorn graceful shutdown 멈춤**: lifespan의 watcher task cancel이 늦어 reload 시 종종 멈춤. `pkill -9 -f "uvicorn main:app"`로 강제 재시작 필요.
- **secret_store/load_key는 모두 async**: 새 코드 작성 시 `await get_secret_plain(...)`, `await provider.require_key()` 잊지 말 것.
- **SQLAlchemy upsert**: PG/SQLite 둘 다 `INSERT ... ON CONFLICT DO UPDATE`를 dialect별 `insert()`로 처리. 새 테이블 추가 시 `_asset_upsert()` 같은 헬퍼 패턴 참조.
- **첫 alembic revision은 PG 켠 상태에서**: SQLite로 generate하면 PG와 SQL이 달라질 수 있음. 반드시 PostgreSQL을 켜고 `alembic revision --autogenerate`.

### 관련 파일 (신규/변경)

**백엔드 신규**
- `server/models/db_models.py` (전 ORM 모델)
- `server/services/database.py` (engine/session)
- `server/routers/assets.py` (자산 sync API)
- `server/routers/coach.py` + `server/services/coach.py` (Coach 가치 사슬 — 막판 추가)
- `server/alembic.ini`, `server/alembic/{env.py,script.py.mako,versions/.keep}`
- `deploy/nginx/nova.conf`, `deploy/README.md`

**백엔드 변경**
- `server/requirements.txt` (sqlalchemy/asyncpg/alembic 추가)
- `server/services/db.py` (SQLAlchemy 재작성, 시그니처 유지)
- `server/services/{secret_store,project_swap,misunderstanding_detector,claude_config_scanner,auth}.py` (async + SQLAlchemy)
- `server/services/llm/{base,anthropic_provider,gemini_provider,openai_provider}.py` (load_key/require_key async)
- `server/services/hermes/{catalog,wiki_builder,llm_client}.py` (catalog content 필드 + classify_asset public + load_anthropic_key async)
- `server/routers/{auth,assets,hermes,repos,secrets,projects,scripts,health,claude_config}.py` (모두 SQLAlchemy)
- `server/scripts/hooks/aiops-log-hook.sh` (.md 자동 sync)
- `docker-compose.yml`, `docker-compose.cloud.yml`, `.env.example`

**프론트엔드 신규/주요 변경**
- `frontend/src/styles/{tokens.css,ui.css}`, `frontend/src/ui/{Icon.tsx,primitives.tsx,toast.tsx}`
- `frontend/src/app/{AppShell.tsx,Sidebar.tsx,TopBar.tsx,CommandPalette.tsx}`
- `frontend/src/pages/{Home,HookMonitor,Prompts,Misunderstandings,Agent,Connections,ProjectSwap,WorkflowTracker,Login,Coach}.tsx`
- `frontend/src/App.tsx` (/coach 라우팅), `frontend/src/main.tsx`
- `frontend/src/constants/nav.ts` ('Nova' → 'Agent' 그룹명 + coach 항목)
- `frontend/vite.config.ts` (changeOrigin)
- `frontend/src/brand-assets/{logo-mark,logo-wordmark}.svg`

**참조 보관**
- `frontend-new/` (frontend-design 산출물 — UI 키트 원본, 참조용)
- `Caddyfile` (사용 안 함 — 삭제 여부 결정 대기)

---

## 2026.05.27 — MVP 90% 마감 (발표 준비용)

### 한 줄 요약

> AI 모임 발표("AI 바이브코딩 데이터 개인화 관리")용 MVP 마무리 라운드. Hermes 안정성+버전관리, 프롬프트 시각화 차트, 오해 자동 감지, WebSocket 인증 보강, 레포맵 동적 구조 — 총 6개 작업 완료. +1078줄 / -106줄 (11개 파일).

### 이번 세션 완료 작업

**#7 Hermes LLM 재시도 + 진행 상태 세분화** ✅
- `services/hermes/llm_client.py`: 429/500/503/529/Connection/Timeout 에러 시 Exponential Backoff (1s→4s→16s, 최대 3회). `on_retry` 콜백 인자.
- `services/hermes/wiki_builder.py`: `progress_cb` 인자 전 함수에 전파. 부분 실패 허용 — 한 perspective 실패해도 나머지 진행.
- `routers/hermes.py`: `_publish_progress`가 EventBus로 `hermes_progress` 이벤트 push. 단계별 진행률(5/15/20/45/50/75/80/95/100).
- `pages/Agent.tsx`: WebSocket으로 `hermes_progress` 수신 → 진행률 바 + 단계명 실시간 표시. 폴링 보조(5초).

**#8 Hermes Phase 4 — 버전 관리 + diff 자동 작성** ✅
- `services/hermes/diff.py` 신설: 룰 기반 챕터 diff (헤딩 추가/제거, 글자수 변화, 한국어 한 줄 요약). LLM 호출 없음.
- `routers/hermes.py`: 위키 저장 시 이전 버전 가져와 자동 diff 계산. `status='partial_success'` 분기.
- 신규 라우트: `GET /api/hermes/wiki/versions?perspective=X` (전체 히스토리), `GET /api/hermes/wiki/version?perspective=X&version=N` (특정 버전 본문).
- `pages/Agent.tsx`: HistoryList 컴포넌트 추가. 버전별 diff 요약 + 클릭으로 이전 버전 본문 비교 가능.

**#9 프롬프트 분석 시각화 강화** ✅
- `services/db.py` + `services/log_reader.py`: `compute_prompt_stats`에 `hourly`(24시간 분포), `daily`(30일 추세), `lengthBuckets`(토큰 길이 5단계) 필드 추가.
- `pages/PromptHistory.tsx` 전면 개편: 일별 추세 SVG line chart, 시간대별 막대, 길이 분포 막대, 피크 인사이트 박스. 외부 차트 라이브러리 없이 SVG 직접.

**#10 오해 추적 자동 감지/분류 백엔드** ✅
- `services/misunderstanding_detector.py` 신설: 룰 기반 패턴 감지 (rejection / correction / retry). 한국어+영어 키워드.
- `detect_from_prompt`: 직전 사용자 prompt(10분 윈도우 내) 컨텍스트와 함께 분류.
- `detect_from_hook`: Hook exit≠0(거버넌스 차단)을 rejection으로 자동 기록.
- `routers/ingest.py`: prompts/hooks ingest 후 `_maybe_record_misunderstanding`이 자동으로 `misunderstandings` 카테고리에 자동 ingest + EventBus publish.

**#11 Hook 모니터 다중 테넌트 안정성** ✅
- `main.py` WebSocket 보안 구멍 차단: `?tenant_id=xxx` 폴백으로 인증 우회 가능했던 부분 제거.
- saas 모드에서 JWT 없거나 검증 실패 시 1008(Policy Violation)로 즉시 close. accept 전 검증.
- EventBus 자체는 이미 tenant 격리 되어있음 (수정 불요).

**#12 레포맵 동적 반영** ✅
- `services/project_structure.py` 신설: 활성 프로젝트의 `.claude/`, `.aiops/`, `code/docs/tests` 디렉토리 동적 스캔.
- 신규 라우트: `GET /api/projects/structure`. saas 모드는 사용자 로컬 접근 불가하므로 안내 메시지만.
- `pages/RepoMap.tsx`: `ActiveProjectStructure` 컴포넌트 추가. 3-column 박스로 .claude/.aiops/code-docs 통계 표시.

### 검증

- Python syntax: 9개 변경/신규 파일 모두 OK
- TypeScript: `tsc --noEmit` 클린
- diff 모듈 단위 테스트: 최초 생성/섹션 추가/제거 케이스 모두 정상
- 패턴 분류기 테스트: 한국어/영어 7개 케이스 정상 분류
- project_structure 실측: aiops-dashboard 자체 스캔 → .claude/rules 2개, server 82파일, frontend 6949파일, 루트 .md 7개
- 백엔드 재시작 + WebSocket JWT 인증 동작 확인

### 발표용 데모 시나리오 (제안)

**Track**:
1. PromptHistory 탭 → 일별 추세 line + 시간대 막대 + 피크 인사이트
2. HookMonitor 탭 → 실시간 Hook 로그 (성공/실패 표시)
3. RepoMap 탭 → .claude/.aiops 카운트 실측 시각화

**Wikify**:
4. Agent 탭 → [Hermes 업데이트] 클릭 → 단계별 progress bar (catalog→planner→developer→user) 실시간 표시
5. 완료 후 위키 본문 + [버전 히스토리] 클릭 → v1→v2 diff 요약 확인

**Coach (예고)**:
6. MisunderstandingTracker 탭 → "다시", "아니" 등 자동 감지된 오해 사례 → "이런 패턴을 알기에 다음 프롬프트에서 어떻게 개선 제안할지" 미래 비전

### 다음 세션이 즉시 해야 할 것

1. 서버 살아있는지 확인 — 백엔드는 `bsgujngxr` 백그라운드로 실행 중. 죽었으면 재시작:
   ```bash
   cd /mnt/c/Personal/aiops-dashboard/server && uvicorn main:app --host 0.0.0.0 --port 8000 &
   ```
2. 사용자가 발표 자료 준비 도움 요청 시:
   - 슬라이드 골격 (Track/Wikify/Coach 3단계)
   - 데모 시나리오 단계별 스크립트
   - 약점 솔직히 인정 + "building in public" 포지셔닝
3. 발표 후 우선순위 백로그:
   - 결제 인프라 (Lemon Squeezy + 티어)
   - 클라이언트 사이드 시크릿 마스킹
   - PostgreSQL 전환
   - Tailwind+Shadcn 디자인 시스템

### 주의사항

- **백엔드 재시작 후 WebSocket 인증 변경 사항**: query_params에 `?tenant_id=xxx`만 주고 토큰 없이 연결하면 즉시 disconnect됨. 프론트엔드 `useWebSocket.ts`는 이미 token을 항상 보내므로 영향 없음.
- **오해 자동 감지 노이즈 가능성**: "다시 해줘"가 흔하므로 모임 데모 전에 misunderstandings 테이블 검토 권장. 노이즈가 너무 많으면 `misunderstanding_detector.py`의 패턴 정밀도를 높여야 함.
- **버전 히스토리 UI**: Agent 탭에서 [버전 히스토리] 버튼은 wiki가 1번 이상 생성된 후에만 보임.
- **RepoMap 동적 구조**: saas 모드면 메시지만 표시 (로컬 파일 접근 불가). local 모드에서 데모하면 더 보기 좋음.
- 이전 세션 주의사항(Vite hot reload, --reload 미사용, JWT/MASTER_KEY dev 값, install.sh 보안 모델) 그대로 유효.

### 관련 파일 (신규/수정)

**신규**:
- `server/services/hermes/diff.py`
- `server/services/misunderstanding_detector.py`
- `server/services/project_structure.py`

**수정 (백엔드)**:
- `server/main.py` (WebSocket 인증 강화)
- `server/routers/hermes.py` (진행 push + 버전 라우트)
- `server/routers/ingest.py` (오해 자동 감지)
- `server/routers/projects.py` (structure 라우트)
- `server/services/db.py` (시간대/일별/길이 분포)
- `server/services/log_reader.py` (local 모드 동일 통계)
- `server/services/hermes/llm_client.py` (재시도)
- `server/services/hermes/wiki_builder.py` (progress_cb)

**수정 (프론트엔드)**:
- `frontend/src/pages/Agent.tsx` (진행률, 히스토리)
- `frontend/src/pages/PromptHistory.tsx` (차트)
- `frontend/src/pages/RepoMap.tsx` (동적 구조)

---

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
