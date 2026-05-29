# Hermes Agent — Design Brief

> **목적**: 이 문서는 모든 디자인 작업(frontend-design 스킬, v0.dev, Lovable, Cursor, Figma 등)에 단일 진실의 원천(Single Source of Truth)으로 첨부된다. 프로젝트의 정체성·정보구조·비주얼 스타일·인터랙션 원칙을 한 문서에서 확인할 수 있도록 한다.
>
> 마지막 갱신: 2026-05-28
> 작성: 헤르메스 에이전트 개발팀
> 형식: 한국어 본문 + 영문 키워드 병기 (디자인 도구 친화)

---

## 1. 프로젝트 정체성 (Identity)

### 한 줄 정의

> **"AI 바이브코딩으로 만들어진 흩어진 개인 데이터를 자동 수집·자산화·코칭하여 개인 AI 협업 능력을 데이터로 키우는 SaaS 학습 대시보드"**

### 영문 정의

> **Hermes Agent — AI Collaboration Learning Dashboard**
> Track every trace of AI-assisted coding (prompts, hooks, configs, .md assets),
> wikify them into 3-perspective project documentation,
> and coach the developer with data-driven suggestions.

### 핵심 가치 사슬 (Value Chain)

```
Track  ──►  Wikify  ──►  Coach
수집        자산화          코칭
```

| 단계 | 영문 | 의미 | 구현 상태 |
|---|---|---|---|
| **Track** | Track | Claude Code / Cursor / Antigravity 등 모든 AI 도구의 활동(프롬프트, Hook, 도구 호출, 세션) 자동 수집 | ✅ 완료 |
| **Wikify** | Wikify | 흩어진 `.md` 자산 + 활동 로그를 LLM이 **3-perspective(기획자 / 개발자 / 사용자)** 위키 챕터로 자동 빌드. 버전 관리 + diff 자동 작성 | 🟡 80% |
| **Coach** | Coach | 위키 + 활동 패턴 + 오해 감지 데이터를 기반으로 능동적인 개선 제안 (프롬프트 개선, 규칙 추가, 워크플로우 보정) | ⬜ 미구현 (비전) |

---

## 2. 타겟 사용자 (Personas)

### Primary Persona — "AI 바이브 개발자"

- **누구**: 1인 ~ 소규모 팀 개발자. Claude Code / Cursor / Windsurf를 매일 사용
- **고통점**:
  - "프롬프트가 어디 갔는지 모르겠다"
  - "AI에게 같은 설명을 매번 반복한다"
  - "내 작업 패턴을 객관적으로 보고 싶다"
  - ".claude/ 설정과 규칙이 흩어져 관리가 안 된다"
- **목표**: AI 협업 효율을 객관 데이터로 측정·개선. 컨텍스트를 자산화하여 재사용
- **나이/배경**: 25~45세, 10년 이내 경력, 영어/한국어 혼용 환경
- **결제 의사**: $19/월 (Pro), $49/월 (Team) — BYOK이라 LLM 사용료 별도

### Secondary Persona — "AI 도입 PM"

- 팀에 AI 코딩 도구 도입 후 ROI를 보고해야 하는 PM/CTO
- 대시보드로 팀 전체의 AI 활용 패턴을 한눈에 보고 싶음
- 결제: Team 티어, 5명 단위

---

## 3. 비즈니스 모델 (SaaS / BYOK)

### 구독 티어 (계획, 미구현)

| 티어 | 가격 | 프로젝트 수 | 데이터 보존 | Hermes 위키 | Coach |
|---|---|---|---|---|---|
| **Free** | $0 | 1개 | 7일 | 월 3회 | 없음 |
| **Pro** | $19/월 | 5개 | 무제한 | 무제한 | 주간 이메일 |
| **Team** | $49/월 | 무제한 | 무제한 | 무제한 | + 팀 공유 + 슬랙/Teams 연동 |

### BYOK (Bring Your Own Key)

- 사용자가 직접 등록: **Anthropic Claude / OpenAI GPT / Google Gemini**
- 평문 키는 절대 저장 안 함 — AES-GCM 암호화 후 DB 저장
- LLM 호출 비용은 사용자 본인 계정 청구
- 결제 게이트웨이는 Lemon Squeezy (1인 SaaS 글로벌 세금 자동 처리) 검토 중

---

## 4. 정보 구조 (Information Architecture)

### 사이드바 — 3 섹션 그룹핑

```
─ Dashboard
  ├─ Home          (홈/시스템 상태)
  ├─ RepoMap       (5-레포 관계도)
  └─ ProjectSwap   (프로젝트 교체)

─ Insights
  ├─ HookMonitor             (실시간 Hook 로그)
  ├─ WorkflowTracker         (워크플로우 추적)
  ├─ PromptHistory           (프롬프트 분석/차트)
  └─ MisunderstandingTracker (AI 오해 감지)

─ Hermes
  ├─ Agent         (위키 자동 생성)
  ├─ ClaudeConfig  (.claude/ 스캐너)
  └─ Connections   (API 키, BYOK, Hook 설치)
```

### 페이지별 핵심 요소

| 페이지 | 핵심 컴포넌트 | 주요 데이터 |
|---|---|---|
| **Home** | 5 stat cards · 5 repo cards · 최근 활동 timeline | health, gitStats, promptStats |
| **RepoMap** | SVG 그래프 + 활성 프로젝트 디렉토리 카드 | repos, projectStructure |
| **ProjectSwap** | 프로젝트 목록 + 활성 표시 | projects |
| **HookMonitor** | 실시간 테이블 (WebSocket) | hooks |
| **WorkflowTracker** | 워크플로우 단계별 진행도 | workflow |
| **PromptHistory** | 일별 라인 차트 · 시간대 히트맵 · 길이 분포 · 피크 인사이트 · 로그 리스트 | promptStats, prompts |
| **MisunderstandingTracker** | 패턴별 분포 + 감지 로그 | misunderstandings |
| **Agent (Hermes)** | 위키 본문 + perspective 탭 + 진행률 바 + provider 드롭다운 + 버전 히스토리/diff | wikiLatest, runStatus, wikiVersions |
| **ClaudeConfig** | .claude/ 디렉토리 트리 + 파일별 메타 | claudeConfigScan |
| **Connections** | API 키 발급/재발급 · BYOK 3 카드 · 원클릭 install 가이드 | apiKey, secrets[] |

---

## 5. 디자인 원칙 (Design Principles)

### 5-1. 데이터 밀도 우선 (Density-First)

- **데이터를 한눈에**: 사용자는 매일 자기 데이터를 빠르게 훑는다. 여백보다 정보가 우선.
- Compact / Normal / Roomy 3단계 사용자 선택 토글 제공 (CSS 변수 기반)
- 기본값: **Compact**

### 5-2. 객관 데이터로 말한다 (Data-Driven Storytelling)

- 모든 숫자는 `tabular-nums`로 정렬
- 시간 시리즈는 SVG line chart로 직접 그리기 (외부 라이브러리 의존 최소화)
- 카드마다 "전주 대비 +N%" 같은 델타 정보 권장

### 5-3. 단축키와 키보드 우선 (Keyboard-First)

- `⌘K` 명령 팔레트 (Command Palette)
- `⌘B` 사이드바 토글
- `⌘D` 다크 모드 토글
- `⌘/` 단축키 모음 도움말

### 5-4. 실시간성 (Realtime)

- Hook 실행, Hermes 위키 빌드 진행, 오해 감지 모두 WebSocket으로 즉시 push
- Skeleton loading 사용. 스피너 X (정보 위치를 미리 알려야)

### 5-5. 진행감 (Sense of Progress)

- 백그라운드 작업(Hermes 위키 빌드)은 progress bar + 단계 라벨 + 재시도 알림
- "지금 무엇이 일어나는지" 항상 보여줌

### 5-6. 점진적 공개 (Progressive Disclosure)

- 모든 카드는 기본 요약. 클릭/확장으로 디테일
- "고급: 2단계 수동 방식 보기" 같은 토글로 복잡성 숨김

### 5-7. 정직한 빈 상태 (Honest Empty States)

- 데이터가 없으면 명확히 표시. 가짜 데이터 X
- 빈 상태에는 "어떻게 데이터 만들 수 있는지" 안내 카드 표시

---

## 6. 비주얼 스타일 (Visual Style)

### 6-1. 컬러 팔레트 — Light Mode (기본)

`oklch` 색공간 기반 — Linear/Vercel과 유사한 톤.

| Role | Color | 사용 |
|---|---|---|
| `bg` | `zinc-50` (#fafafa) | 페이지 배경 |
| `surface` | `white` | 카드 표면 |
| `surfaceAlt` | `zinc-100` | 보조 표면 (호버, 비활성) |
| `border` | `zinc-200` | 카드 테두리, 구분선 |
| `borderActive` | `zinc-400` | 활성/포커스 |
| `text` | `zinc-900` | 본문 |
| `textDim` | `zinc-500` | 라벨, 메타 |
| `accent` | `indigo-600` | 액션, 활성 탭, 액센트 |
| `success` | `emerald-600` | 성공, 정상 |
| `warning` | `amber-600` | 경고, 부분 실패 |
| `danger` | `rose-600` | 에러, 실패 |
| `info` | `sky-600` | 정보, 보조 |
| `purple` | `violet-600` | 기획자 perspective |
| `cyan` | `cyan-600` | 보조 차별 |

### 6-2. 컬러 팔레트 — Dark Mode

| Role | Color |
|---|---|
| `bg` | `zinc-950` (#09090b) |
| `surface` | `zinc-900` |
| `surfaceAlt` | `zinc-800` |
| `border` | `zinc-800` |
| `borderActive` | `zinc-600` |
| `text` | `zinc-100` |
| `textDim` | `zinc-400` |
| `accent` | `indigo-500` |
| (status colors는 1단계 밝게) |

### 6-3. 타이포그래피

- **본문 폰트**: Pretendard (한국어 + 영문 모두 자연스럽게)
- **숫자/코드**: 시스템 monospace (`ui-monospace`, `SF Mono`, `Menlo`)
- **숫자 정렬**: `tabular-nums` 필수 (대시보드 숫자 정렬용)

| Token | Size | 사용 |
|---|---|---|
| `T.h1` | 18px / 1.3 / 700 | 페이지 헤더 |
| `T.h2` | 15px / 1.3 / 700 | 섹션 제목 |
| `T.h3` | 13px / 1.4 / 600 | 카드 제목 |
| `T.body` | 12px / 1.5 / 400 | 본문 |
| `T.sm` | 11px / 1.5 / 400 | 라벨, 메타 |
| `T.xs` | 10px / 1.4 / 400 | 칩, 배지 |
| `T.bignum` | 18~22px / 1.2 / 700 / tabular-nums | 통계 카드 큰 숫자 |

### 6-4. 스페이싱 (Density-Aware)

CSS 변수 기반. density 모드에 따라 동적 전환.

| Token | Compact | Normal | Roomy |
|---|---|---|---|
| `--s-xs` | 3px | 4px | 5px |
| `--s-sm` | 6px | 8px | 10px |
| `--s-md` | 9px | 12px | 15px |
| `--s-lg` | 12px | 16px | 20px |
| `--s-xl` | 18px | 24px | 30px |
| `--s-xxl` | 24px | 32px | 40px |

### 6-5. Radius / Shadow

- `R.sm` 4px (작은 칩, 배지, 작은 버튼)
- `R.md` 6px (카드, 입력 필드, 버튼) — **기본**
- `R.lg` 8px (모달, 큰 카드)
- 그림자: 최소 사용. 카드는 `border-only` 기본. 호버 시 `shadow-sm` 추가
- 다크 모드: 그림자 거의 안 보임. border가 hierarchy 표현

### 6-6. 아이콘

- **lucide-react** 사용 (24px 기본, 색은 currentColor)
- 크기: `12`, `14`, `16`, `20`px (목적에 따라)
- 사이드바 아이콘 16px, 버튼 내부 아이콘 14px

### 6-7. 이모지 사용

- **UI에 이모지 추가 금지** (단, 사용자가 명시적으로 요청 시 예외)
- 빈 상태 아이콘은 lucide 아이콘으로 처리

---

## 7. 인터랙션 패턴 (Interaction Patterns)

### 7-1. 마이크로 애니메이션

- **탭/페이지 전환**: opacity + translate-y 4px, 150ms ease-out (Framer Motion)
- **카드 호버**: scale 1.01 + border highlight, 120ms
- **버튼 클릭**: scale 0.98, 80ms
- **데이터 로딩**: Skeleton (Shadcn `Skeleton`) — 스피너 사용 금지
- **숫자 카운팅**: 큰 숫자는 0→타겟 500ms count-up (선택적)
- **WebSocket 신규 이벤트**: 슬라이드 인 + 잠시 highlight

### 7-2. 키보드 단축키 (Command Palette)

| Key | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Command Palette 열기 |
| `⌘B` | Sidebar collapse 토글 |
| `⌘D` | Dark mode 토글 |
| `⌘/` | 단축키 도움말 |
| `G then H` | Home으로 이동 |
| `G then A` | Agent로 이동 |
| `G then P` | PromptHistory로 이동 |
| `Esc` | 모달/팔레트 닫기 |

### 7-3. Density 토글

- TopBar 우측에 `[Compact] [Normal] [Roomy]` 토글
- 선택 즉시 모든 페이지 spacing 변경 (CSS 변수)
- localStorage 저장 (`hermes.density`)

### 7-4. 빈 상태 (Empty States)

- 데이터 없음 → "어떻게 데이터를 생성할 수 있나요?" 안내 카드
- 미설치 기능 → "Hook 설치 가이드 보기" 버튼
- 미등록 키 → "Anthropic / OpenAI / Gemini 중 하나 등록" 안내

### 7-5. 토스트 (Notifications)

- **Sonner** 사용 (Shadcn 통합)
- 우측 하단 stacking
- 성공: emerald, 에러: rose, 정보: sky
- API 키 등록, 위키 빌드 완료, 레포 등록 등 모든 mutation에 토스트

### 7-6. 키 등록 / 민감 데이터 입력

- `<input type="password">` 사용
- 등록 즉시 평문 비우기
- "검증 건너뛰기" 옵션 (외부 verify 실패 시 우회)
- 등록 후 미리보기는 마스킹 형식: `sk-ant-1***xyz9`

---

## 8. 컴포넌트 시스템 (Component Library)

### 권장 라이브러리

- **Tailwind CSS v4** — utility-first styling
- **shadcn/ui** — Radix UI 기반 컴포넌트 (Sidebar, Command, Toggle, Dialog, Sheet, DropdownMenu, Toast, Skeleton, Badge, Button, Card, Tabs, Progress, ScrollArea)
- **Framer Motion** — 마이크로 애니메이션
- **TanStack Router** — 사이드바 라우팅
- **lucide-react** — 아이콘
- **sonner** — 토스트

### 핵심 자체 컴포넌트

| 컴포넌트 | 책임 |
|---|---|
| `<AppShell>` | Sidebar + TopBar + Main 레이아웃 |
| `<Sidebar>` | 3 섹션 + 10 항목 + collapsible |
| `<TopBar>` | breadcrumb + 연결 상태 + density + theme + user menu |
| `<StatCard>` | 큰 숫자 + 라벨 + sub + delta chip + sparkline |
| `<StatGrid>` | StatCard 그리드 (columns 가변) |
| `<Box>` | 제목 + action + 본문 카드 |
| `<RepoCard>` | 5-레포 카드 (아이콘, 이름, 상태) |
| `<DataTable>` | 콤팩트 테이블, 정렬, 상태 칩 |
| `<ProgressBar>` | Hermes 빌드 진행률 (stage label + retry) |
| `<ProviderDropdown>` | Anthropic / OpenAI / Gemini 선택 |
| `<VersionTimeline>` | 위키 버전 히스토리 + diff 요약 |
| `<EmptyState>` | 안내 카드 (제목, 설명, 액션 버튼) |
| `<Skeleton>` | 로딩 자리표시 |
| `<KbdChip>` | 키보드 단축키 표시 (`⌘K`) |
| `<StatusDot>` | 작은 색 점 (running/success/failed/idle) |

---

## 9. 참조 디자인 (Design References)

### 9-1. Linear (linear.app) — **메인 참조**

참고 요소:
- 사이드바 (3 섹션 + 항목별 우측 카운트 배지)
- Command palette (`⌘K`)
- 키보드 우선 인터랙션
- 콤팩트한 spacing
- 다크 모드 디폴트 (우리는 라이트가 기본이라 다른 점)

### 9-2. Vercel Dashboard (vercel.com/dashboard)

참고 요소:
- 데이터 카드 디자인 (border-only, 큰 숫자, 작은 라벨)
- 그래프 스타일 (선 얇음, area fill 가벼움)
- 깔끔한 타이포그래피
- 헤더 + breadcrumb

### 9-3. Notion 데이터베이스 뷰

참고 요소:
- 콤팩트 테이블
- 인라인 편집감
- 상태 칩 (Status property)
- 필터 / 정렬 UI

### 9-4. Mintlify Docs (mintlify.com)

참고 요소:
- 위키/문서 본문 타이포그래피 (Agent 페이지의 마크다운 렌더링)
- 코드 블록 스타일
- 사이드 TOC

### 9-5. Resend Dashboard (resend.com)

참고 요소:
- 데이터 시각화 (Hook 모니터, 시간대 분포)
- 빈 상태 디자인
- BYOK 키 등록 UX (등록 즉시 마스킹)

---

## 10. 금지 사항 (Anti-Patterns)

| 금지 | 이유 |
|---|---|
| **인라인 스타일** (`style={{...}}`) | 유지보수 불가, 다크 모드 토글 불가, 디자인 일관성 깨짐 |
| **이모지 UI** | 한국 SaaS 톤에 부적합. 대신 lucide 아이콘 |
| **스피너 로딩** | Skeleton으로 대체 (정보 위치 미리 알리기) |
| **하드코딩 색상** (`#abc123`) | 토큰(`var(--color-...)`) 또는 Tailwind 색상만 사용 |
| **고정 폭 레이아웃** (`width: 1200px`) | 반응형 (`max-w-screen-xl` 등)으로 |
| **불필요한 그림자** | flat + border 기반이 톤에 맞음. 호버 시에만 미세 shadow |
| **알림 모달** | 토스트로 처리. 모달은 확정 액션(삭제, 결제)에만 |
| **자동 새로고침 카운트다운** | 사용자 컨트롤 우선. polling 간격은 최소 3초 |
| **첫 로그인 시 메일 모달** | 위저드는 inline으로 첫 페이지에서 |
| **그라디언트 남발** | accent 색상에만 매우 미세하게 (subtle) |

---

## 11. 기술 스택 제약 (Technical Constraints)

### 11-1. 프론트엔드

- **React 19** (기존)
- **TypeScript** (strict)
- **Vite** (dev server, 빌드)
- **Tailwind v4** — 디자인 시스템 메인
- **shadcn/ui** — 컴포넌트 라이브러리
- **TanStack Router** — 사이드바 라우팅 (path-based)
- **Framer Motion** — 애니메이션
- **Sonner** — 토스트
- **lucide-react** — 아이콘
- **react-markdown** — 위키 본문 렌더링 (이미 사용 중)

### 11-2. 백엔드 (변경 없음)

- FastAPI + SQLite + WebSocket
- JWT 인증 (24h)
- BYOK 멀티 프로바이더 (Anthropic / OpenAI / Gemini)
- 모든 API는 `/api/*` 경로, WebSocket은 `/ws/logs?token=<JWT>`

### 11-3. 빌드 / 배포

- 패키지 매니저: **npm** (Lovable이 bun을 권장해도 npm 호환 명시 권장)
- 빌드: `npm run build` → `frontend/dist`
- Docker 패키징 이미 구현됨

### 11-4. 인증 흐름

- `/api/mode` 응답이 `{"mode": "saas", "auth_required": true}`이면 Login 페이지로 분기
- JWT를 `Authorization: Bearer <token>` 헤더에 첨부
- WebSocket은 `?token=<JWT>` 쿼리 파라미터
- 토큰은 `localStorage` (`hermes.token`)에 저장

---

## 12. 다국어 / 콘텐츠 (Localization)

- **UI 기본 언어**: 한국어
- **기술 용어**: 영문 그대로 (Hook, Workflow, Prompt, Agent, Hermes)
- **숫자/날짜**: ko-KR locale (`"3,124회"`, `"5월 28일"`)
- **에러 메시지**: 한국어 (사용자 친화)
- **개발자 콘솔/로그**: 영문 또는 혼용 OK
- 향후 i18n: 영문 추가 예정. 지금은 한국어 하드코딩 OK

---

## 13. 발표 / 데모 시나리오 (Demo Context)

UI는 다음 데모 흐름을 자연스럽게 지원해야 한다.

### 시나리오 1 — Track (5분)

1. Home → 통계 카드 5개로 한 주 활동 요약
2. PromptHistory → 일별 라인 차트 + 시간대 히트맵으로 "내가 새벽에 일하는구나" 발견
3. HookMonitor → 실시간 Hook 흐름 시연

### 시나리오 2 — Wikify (5분)

1. Agent 탭 → 자산 카탈로그 보기 (252개 .md 파일이 어떻게 분류됐는지)
2. Provider 드롭다운 → Anthropic/OpenAI/Gemini 선택
3. [Hermes 업데이트] → progress bar 단계별 (catalog → planner → developer → user → complete)
4. 완료 후 위키 본문 표시 → [버전 히스토리] → v1 ↔ v2 diff

### 시나리오 3 — Coach (1분, 비전)

1. MisunderstandingTracker → 자동 감지된 오해 패턴
2. "다음 단계: 이 패턴을 줄이려면 ~ 규칙을 추가하면 좋겠습니다" (미구현 비전)

---

## 14. 현재 약점 & 개선 우선순위 (Pain Points)

### P0 — 디자인 차원 차단 이슈

- **인라인 스타일 의존**: `index.css` 64bytes, 모든 스타일이 `style={{...}}`로 박혀있어 다크 모드, 반응형, 일관성 불가
- **단조 컬러 팔레트**: 단색만 사용, 깊이감(depth) 부재
- **마이크로 애니메이션 전무**: 탭 전환, 카드 호버, 데이터 로딩 모두 정적
- **반응형 부재**: 모바일/태블릿 깨짐 (`maxWidth: 1200, margin: 0 auto` 고정)
- **탭 10개 평면 나열**: TabBar에 가로로 다 박혀있어 IA 혼란

### P1 — 콘텐츠 차원

- **빈 상태 안내 부족**: "데이터 없음" 외에 가이드 부재
- **첫 사용자 온보딩 마찰**: 위저드는 있으나 5단계 → 최근 4단계로 줄였으나 여전히 마찰
- **ChatBot stub**: 우측 하단 플로팅 버튼 클릭하면 "Phase 3에서 구현 예정" — 발표 시 황당

### P2 — 정보 시각화

- **차트 다양성 부족**: 막대 + 라인만. 히트맵, 분포도 추가 필요
- **숫자 정렬**: `tabular-nums` 미적용으로 카드 숫자가 흔들림

---

## 15. 빠른 시작 — Lovable / v0 / frontend-design용 메타 프롬프트

이 섹션은 디자인 도구에 한 문장으로 던질 때 사용한다.

### 한 문장 요약

> "Build a compact, data-dense SaaS dashboard for AI-assisted developers, inspired by Linear and Vercel, with a 3-section sidebar (Dashboard / Insights / Hermes), light/dark mode, density toggle (compact/normal/roomy), Tailwind v4 + shadcn/ui + TanStack Router + Framer Motion. Light mode default, indigo accent, tabular-nums for all numbers, skeleton loading, command palette (⌘K)."

### 페이지 우선순위 (구현 순서)

1. **Shell** (Sidebar + TopBar + Theme/Density providers)
2. **Home** (SystemStatus)
3. **PromptHistory** (차트 풍부 — 발표 데모 핵심)
4. **Agent (Hermes)** (위키 + progress bar + provider dropdown — 발표 메인)
5. **HookMonitor** (실시간 테이블 — Track 데모)
6. **MisunderstandingTracker** (자동 감지 결과)
7. **Connections** (BYOK 키 등록)
8. **RepoMap / ProjectSwap / WorkflowTracker / ClaudeConfig** (보조)

### 데이터 형상 (TypeScript)

API 응답 shape는 `frontend/src/lib/api-types.ts` 또는 본 문서 부록 참조. 핵심 타입:

- `HealthData`, `GitStats`, `PromptStats`
- `Prompt`, `HookLog`, `Misunderstanding`
- `WikiLatest`, `WikiVersionEntry`, `RunStatus`, `HermesProgressEvent`
- `ProviderMeta`, `SecretStatus`
- `ProjectStructure`

전체 정의는 별도 첨부 (Lovable / v0에 함께 보낼 것).

---

## 16. 변경 이력 (Changelog)

| 날짜 | 변경 |
|---|---|
| 2026-05-28 | 초기 작성. Track/Wikify/Coach 정체성, IA, Visual Style, Interaction, Anti-Patterns 정립 |

---

## 부록 A — 색상 토큰 매핑 (Tailwind 기준)

```
/* tailwind.config.ts extend.colors */
{
  bg:            { DEFAULT: 'oklch(0.985 0 0)',  dark: 'oklch(0.145 0 0)' },
  surface:       { DEFAULT: 'oklch(1 0 0)',      dark: 'oklch(0.205 0 0)' },
  surfaceAlt:    { DEFAULT: 'oklch(0.96 0 0)',   dark: 'oklch(0.27 0 0)' },
  border:        { DEFAULT: 'oklch(0.92 0 0)',   dark: 'oklch(0.27 0 0)' },
  text:          { DEFAULT: 'oklch(0.205 0 0)',  dark: 'oklch(0.985 0 0)' },
  textDim:       { DEFAULT: 'oklch(0.55 0 0)',   dark: 'oklch(0.7 0 0)' },
  accent:        { DEFAULT: 'oklch(0.50 0.20 270)', dark: 'oklch(0.62 0.20 270)' }, /* indigo-600 / 500 */
  success:       'oklch(0.60 0.16 145)',   /* emerald-600 */
  warning:       'oklch(0.70 0.17 75)',    /* amber-600 */
  danger:        'oklch(0.58 0.20 25)',    /* rose-600 */
  info:          'oklch(0.65 0.16 235)',   /* sky-600 */
  purple:        'oklch(0.55 0.22 295)',   /* violet-600 — 기획자 */
  cyan:          'oklch(0.65 0.13 215)',   /* cyan-600 */
}
```

## 부록 B — 사이드바 메뉴 데이터 (TypeScript)

```typescript
export const SIDEBAR_GROUPS = [
  {
    label: 'Dashboard',
    items: [
      { id: 'home',         label: '홈',           icon: 'home',           path: '/' },
      { id: 'repo-map',     label: '레포 관계도',  icon: 'git-branch',     path: '/repo-map' },
      { id: 'project-swap', label: '프로젝트',     icon: 'folder',         path: '/project-swap' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { id: 'hooks',           label: 'Hook 모니터',  icon: 'activity',  path: '/hooks' },
      { id: 'workflow',        label: '워크플로우',   icon: 'workflow',  path: '/workflow' },
      { id: 'prompts',         label: '프롬프트',     icon: 'message-square', path: '/prompts' },
      { id: 'misunderstandings', label: '오해 추적', icon: 'alert-circle', path: '/misunderstandings' },
    ],
  },
  {
    label: 'Hermes',
    items: [
      { id: 'agent',          label: '에이전트',     icon: 'sparkles',     path: '/agent' },
      { id: 'claude-config',  label: 'Claude 설정',  icon: 'settings',     path: '/claude-config' },
      { id: 'connections',    label: '연결',         icon: 'plug',         path: '/connections' },
    ],
  },
] as const;
```

---

**끝.** 이 문서를 frontend-design 스킬 또는 다른 디자인 도구에 첨부하면 일관된 결과를 받을 수 있습니다.
