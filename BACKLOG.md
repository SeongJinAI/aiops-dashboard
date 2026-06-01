# Nova 코드 감사 백로그 (2026-05-29)

> 5렌즈(버그/컨벤션/스타일·데드코드/UI·UX/보안) 병렬 감사 + 적대적 검증 결과.
> 59개 발견 → 27개 확정 / 8개 기각 / 24개 minor. **결제(Lemon Squeezy 실연동)는 맨 마지막.**

## 검증에서 걸러낸 것 (대응 불필요)

- **Coach 프리미엄 게이팅 "누락"** — 오답. Coach는 **설계상 Free 기능**(가격표·랜딩 명시), Library만 Pro. `coach/report`가 `get_current_user`만 쓰는 건 정상.
- mock checkout BLOCKER — 사용자가 의도적으로 선택한 MVP 목 결제. "취약점"이 아니라 결제 후순위 항목. (단, 실결제 붙일 때 prod 가드 필요)

---

## Tier 1 — 지금 고칠 것: 버그·정합성 (고신뢰·저위험)

| # | 파일 | 문제 | 수정 |
|---|------|------|------|
| 1 | `Library.tsx:16-17` + `useApi.ts:30-34` | billing/status와 templates 병렬 fetch → 프리미엄인데도 초기 `premium=false`로 "Pro 전용" 잠금이 깜박이고 불필요한 402 발생 | billing 로딩 상태 추가 → premium 확정 후 templates 노출. 402는 useApi에서 특수 처리(또는 Library에서 billing.premium 확정 전 templates 미호출) |
| 2 | `Library.tsx:28-37` | distill 후 무조건 refetch → 그 사이 권한 회수 시 402인데 silent fail | catch에서 402 감지 → billing 갱신/업셀 CTA |
| 3 | `coach.py:42` (`library.py:43`) | LLM/네트워크 오류를 catch-all로 **502**(인프라)로 변환 → 모니터링 거짓 알람. 예외 4계층 위반 | provider 오류 분류: timeout→504, ratelimit→429, 그 외→503. `_parse_templates` 실패는 비즈니스(422/400) |
| 4 | `coach.py:116` | `byPattern[0]` 접근 시 빈 리스트 가드는 있으나 None 방어 미흡 | 방어적 가드 |
| 5 | `useApi.ts:35` | `res.json()` try-catch 없음 → 빈/깨진 body면 throw | try-catch로 감싸기 |
| 6 | `App.tsx:119-122`, `Coach.tsx:64-76` | handleRegenerate try-catch 없음 / 브리핑 에러 400 vs 502 구분 없음 | 에러 핸들링 보강 |

## Tier 2 — 정리: 데드코드·중복·일관성

| 파일 | 문제 | 수정 |
|------|------|------|
| `constants/repos.ts:23-34` | `TABS` 상수 미사용(구 탭 네비 잔재) | 삭제 |
| `src/assets-logo-mark.svg` | 어디서도 import 안 되는 고아 파일(이름도 비표준) | 삭제 |
| `App.tsx:25` ↔ `Connections.tsx:26` | `NEW_KEY_SESSION` 중복 정의 | 공용 상수로 통합 |
| `colors.ts:6` | `borderActive` 미사용 | 삭제 |
| `ui.css:1155-1171` (steprow) | WorkflowTracker/ProjectSwap(off-nav) 전용 | off-nav 결정에 따라 |
| `types/index.ts:192` | `hookScripts` non-null 미검증 | 옵셔널 가드 |

## Tier 3 — UI 다크모드/토큰 일관성 (사용자가 말한 "중구난방")

**활성(퍼널 노출) 우선:**
- `OnboardingWizard.tsx` (#fffbeb/#f0fdf4/#fff5f5, C.* 인라인, 모달 오버레이, @keyframes 인라인) — 신규 가입자가 보는 화면. 토큰화 필요.
- `components/onboarding/Snippets.tsx` (#fff, 인라인 다수) — CodeBlock/EnvSelector 클래스화.
- `ui.css` switch-thumb/stepnum `#fff`, Landing 인라인 meter width, Home 인라인 fontSize — 토큰화.

**off-nav 페이지 (피벗으로 nav에서 제거됨 — 삭제 vs 다크모드 수정 결정 필요):**
- `RepoMap.tsx` (SVG 하드코딩 색·고정 680×460 비반응형·tabular-nums 누락·빈 상태)
- `ClaudeConfig.tsx` (C.* 인라인 전반)

## Tier 4 — 보안 하드닝

| 파일 | 문제 | 수정 |
|------|------|------|
| `auth.py:19` + `env_check.py` | JWT_SECRET dev 기본값. AIOPS_ENV 미설정 시 강제 안 됨 | saas 모드면 ENV 무관하게 JWT_SECRET 필수화 |
| `library.py:32`, `coach.py:27` | 비용 드는 LLM 엔드포인트 rate limit이 글로벌/느슨 | tenant별 엄격화(distill 2/h, summary 5/day 등) |
| `logs.py` (`log_reader.py`) | `target_date` path traversal 가능성(`../`) | `^\d{4}-\d{2}-\d{2}$` 검증 + Path.resolve 체크 |
| `secrets.py:86-99` | 키 검증 실패 메시지가 클라이언트에 상세 노출 | 클라이언트엔 일반 메시지, 상세는 서버 로그만 |
| `main.py:82-87` | CORS `allow_methods=["*"], allow_headers=["*"]` | 필요한 메서드/헤더로 제한 |
| `billing.py:29-39` | mock checkout (결제 후순위) | 실결제 붙일 때 webhook HMAC 검증 + prod 가드 |

## Tier 5 — 컨벤션 인프라

- **구조화 로깅 부재**: 4xx=warn / 5xx=error / DB정합성=error 격상 규칙 미적용. `logging` 도입.
- **에러코드 중앙관리**: `hermes.py:81/318/436`에서 "활성 프로젝트 없음"이 3가지 다른 메시지+상태코드(400/404). `ERR_*` 상수 모듈로 통일.
- `secrets.py:97` print 로깅 → 구조화 로깅. `projects.py:96-104` silent except pass.

## (보류) 결제 — Lemon Squeezy 실연동

맨 마지막. checkout이 redirect URL 반환 + webhook(HMAC)으로 plan 갱신, prod 가드.
