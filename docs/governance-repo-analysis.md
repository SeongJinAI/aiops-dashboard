# 거버넌스 레포 (claude-config-template) 상세 분석

> 분석일: 2026-03-08
> 경로: C:\MyProject\seongjinAI\claude-config-template

---

## 1. 레포 목적

Claude Code의 **dotfiles 템플릿**. 개발 워크플로우 자동화를 위한 설정, Hook, 커맨드, 프로젝트 템플릿을 관리한다.
`install.sh`로 `~/.claude/`에 설치하면 모든 프로젝트에 글로벌로 적용된다.

---

## 2. 디렉토리 구조

```
claude-config-template/
├── global/
│   ├── settings.json          ← 글로벌 설정 (권한, Hook 등록, 언어)
│   ├── CLAUDE.md              ← 글로벌 코딩 규칙
│   └── commands/              ← 슬래시 커맨드 정의
│       ├── clear.md           ← /clear: HANDOFF.md 갱신 후 컨텍스트 초기화
│       ├── gen-spec.md        ← /gen-spec: 코드 분석 → 기능명세서 자동 생성
│       ├── verify-docs.md     ← /verify-docs: 문서-코드 동기화 검증
│       ├── feedback-to-pr.md  ← /feedback-to-pr: 피드백 → PR 자동 생성
│       └── project-chat.md    ← /project-chat: 문서 기반 Q&A
│
├── hooks/                     ← Hook 스크립트 7개
│   ├── on-commit-quality-check.sh
│   ├── on-commit-doc-sync-check.sh
│   ├── on-push-signature-check.sh
│   ├── on-compact-handoff-save.sh
│   ├── on-prompt-handoff-remind.sh
│   ├── on-prompt-api-dev-guide.sh
│   └── on-prompt-test-feedback.sh
│
├── templates/                 ← 프로젝트별 CLAUDE.md 템플릿
│   ├── spring-boot/CLAUDE.md
│   ├── fastapi/CLAUDE.md
│   └── nextjs/CLAUDE.md
│
├── docs/templates/            ← 문서 템플릿
│   ├── SPEC_TEMPLATE.md       ← 기능명세서 양식
│   ├── MANUAL_TEMPLATE.md     ← 사용자매뉴얼 양식
│   ├── FEEDBACK_TEMPLATE.md   ← 피드백 기록 양식
│   └── STORYBOARD_WORKFLOW.md ← 스토리보드 기반 개발 워크플로
│
├── scripts/
│   ├── init-project.sh        ← 프로젝트 템플릿 적용
│   └── sync.sh                ← 설정 동기화 (push/pull)
│
├── install.sh                 ← 설치 (심볼릭 링크 또는 다운로드)
└── README.md
```

---

## 3. global/settings.json — Hook 등록 구조

```json
{
  "permissions": {
    "allow": ["Bash(cat:*)", "Bash(rm:*)", "Bash(grep:*)", "Bash(git branch:*)", "Bash(git merge:*)"],
    "deny": ["Bash(rm -rf /)", "Bash(git push --force origin main)", "Bash(git reset --hard)"],
    "defaultMode": "plan"
  },
  "language": "Korean",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "command": "~/.claude/hooks/on-commit-quality-check.sh" },
          { "command": "~/.claude/hooks/on-push-signature-check.sh" }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "hooks": [
          { "command": "~/.claude/hooks/on-prompt-handoff-remind.sh" },
          { "command": "~/.claude/hooks/on-prompt-api-dev-guide.sh" },
          { "command": "~/.claude/hooks/on-prompt-test-feedback.sh" }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          { "command": "~/.claude/hooks/on-compact-handoff-save.sh" }
        ]
      }
    ]
  }
}
```

### Hook 이벤트별 입력 데이터 (stdin JSON)

| 이벤트 | 입력 필드 | 설명 |
|--------|----------|------|
| PreToolUse | `tool_input.command`, `cwd` | Claude가 실행하려는 도구/명령 |
| UserPromptSubmit | `prompt`, `cwd`, `permission_mode` | 사용자가 입력한 프롬프트 전문 |
| PreCompact | `session_id`, `trigger`(manual/auto), `cwd` | compact 발생 전 |

### 중요: UserPromptSubmit에서 `prompt` 필드로 사용자 프롬프트 전문을 받을 수 있음

---

## 4. Hook 스크립트 상세 분석

### 4.1 on-commit-quality-check.sh (PreToolUse)

**트리거 조건:** `git commit` 명령 감지
**동작:**
1. stdin에서 `tool_input.command` 파싱 → `git commit`이 아니면 즉시 exit 0
2. 프로젝트 타입 자동 감지 (build.gradle → spring-boot, requirements.txt → fastapi, package.json → nextjs)
3. 3가지 검사 수행:
   - 주석 존재 검사: staged 파일에서 `//`, `/* */`, `#` 감지
   - 사용하지 않는 코드: ruff(Python만), Java/Next.js는 시간 문제로 생략
   - 코드 컨벤션: ruff format(Python만), Spotless/Prettier 생략
4. 경고만 출력, **차단하지 않음** (exit 0)

**로깅:** 없음 (stderr로 경고만 출력)

---

### 4.2 on-commit-doc-sync-check.sh (PreToolUse)

**트리거 조건:** `git commit` 명령 감지
**동작:**
1. `docs/` 디렉토리 존재 확인
2. staged 파일을 코드 파일(*.java, *.py 등)과 문서 파일(docs/*.md)로 분리
3. 코드 변경 O + 문서 변경 X → 경고 출력
4. Controller/Router 변경 감지 → 기능명세서 업데이트 추가 경고
5. 파일명에서 모듈명 추출 (예: OrderController.java → order) → `docs/specs/`에서 관련 문서 탐색

**로깅:** 없음

---

### 4.3 on-push-signature-check.sh (PreToolUse)

**트리거 조건:** `git push` 명령 감지
**동작:**
1. 보호된 브랜치(main, master, production) 직접 push 경고
2. "Co-Authored-By: Claude" 서명 포함 커밋 탐색
3. 서명 발견 시 커밋 해시/메시지 표시 + rebase 안내

**로깅:** 없음

---

### 4.4 on-compact-handoff-save.sh (PreCompact)

**트리거 조건:** compact 발생 전 (수동/자동)
**입력:** `trigger` 필드로 manual/auto 구분
**동작:**
1. HANDOFF.md 존재 및 최근 수정 시간 확인
2. 10분(600초) 이상 지났으면 업데이트 경고
3. 필수 포함 내용 안내: 완료 작업, 다음 작업, 주의사항, 관련 파일

**로깅:** `/tmp/claude-hooks.log`에 텍스트 기록
```
[2026-03-07 10:35:12] PreCompact hook 실행됨
[2026-03-07 10:35:12] INPUT: {"session_id":"...","trigger":"manual",...}
```

---

### 4.5 on-prompt-handoff-remind.sh (UserPromptSubmit)

**트리거 조건:** 프롬프트가 `/clear` 또는 `/compact`로 시작
**동작:**
1. `prompt` 필드에서 명령어 감지
2. HANDOFF.md 수정 시간 확인 (10분 기준)
3. **stdout로 `<user-prompt-submit-hook>` 태그 출력 → Claude 컨텍스트에 주입**
4. HANDOFF.md 업데이트 지시 사항 포함

**핵심:** stdout 출력이 Claude의 컨텍스트에 자동 삽입됨. 이 메커니즘이 중요.

**로깅:** `/tmp/claude-hooks.log`에 텍스트 기록

---

### 4.6 on-prompt-api-dev-guide.sh (UserPromptSubmit)

**트리거 조건:** 4개 가드 조건을 모두 통과해야 동작
1. 시스템 명령(`/`로 시작) 아님
2. permission_mode가 "plan"
3. 프롬프트에 키워드 매칭: `신규.*개발|API.*개발|기능개발|스토리보드|implement|develop.*new|new.*feature`
4. 프로젝트 CLAUDE.md에 "Inconus ERP" 문자열 존재

**동작:**
1. `src/docs/기획문서/` 디렉토리에서 PDF 목록 수집
2. 6단계 개발 파이프라인 가이드를 `<api-dev-guide-hook>` 태그로 출력
3. Claude 컨텍스트에 주입

**로깅:** `/tmp/claude-hooks.log`에 트리거 로그

**문제점:** Inconus ERP 하드코딩으로 범용성 없음

---

### 4.7 on-prompt-test-feedback.sh (UserPromptSubmit)

**트리거 조건:** 프롬프트에 "테스트 결과 피드백 반영" 키워드 존재
**동작:**
1. 프로젝트 루트에서 `{프로젝트명}-test/results/local/` 경로 탐색
2. 최신 날짜 디렉토리 찾기 (예: `2026-02-27/`)
3. .md 테스트 결과 파일 전체 내용을 `<test-feedback-hook>` 태그로 stdout 출력
4. Claude에게 분석 → 계획 → 승인 → 수정 순서 지시

**로깅:** `/tmp/claude-hooks.log`에 트리거 로그 + 파일 수

---

## 5. 현재 로깅 방식의 한계

| 항목 | 현재 | 문제 |
|------|------|------|
| 로그 위치 | `/tmp/claude-hooks.log` | 재부팅 시 삭제, 모든 Hook이 같은 파일에 섞임 |
| 로그 형식 | 텍스트 (`[날짜] 메시지`) | 파싱 불가, 구조화되지 않음 |
| 로그 내용 | Hook 실행 여부 + stdin JSON | 성공/실패, 소요시간 미기록 |
| 프롬프트 | `/clear`, `/compact` 등 특정 키워드만 감지 | **일반 프롬프트는 기록하지 않음** |
| 워크플로우 | 체크포인트 기록 메커니즘 없음 | 워크플로우 진행 상태 추적 불가 |

---

## 6. 대시보드 연동을 위한 GAP 분석

### 대시보드가 필요한 것 vs 거버넌스 레포가 제공하는 것

| 대시보드 요구사항 | 거버넌스 레포 현재 상태 | GAP |
|-------------------|----------------------|-----|
| Hook 실행 로그 (JSONL) | /tmp에 텍스트 로깅 (3개 Hook만) | 형식 변환 + 전체 Hook 로깅 필요 |
| 프롬프트 로그 (JSONL) | UserPromptSubmit에서 prompt 텍스트 접근 가능 | **전용 로깅 Hook 신규 추가 필요** |
| 워크플로우 체크포인트 (JSONL) | 없음 | **체크포인트 기록 메커니즘 설계 필요** |
| 실시간 감지 | watchfiles로 파일 감시 (대시보드 쪽 완료) | 로그 파일 경로 통일 필요 |

### 핵심 발견: UserPromptSubmit Hook의 stdin JSON에 `prompt` 필드 존재

- `on-prompt-handoff-remind.sh`에서 `get_prompt()` 함수로 추출하는 것 확인
- `on-prompt-test-feedback.sh`에서도 동일하게 사용
- **즉, 모든 사용자 프롬프트를 캡처하는 전용 Hook을 추가하면 프롬프트 로깅 가능**

### 구현 방향

1. **공통 로깅 함수 추출**: 모든 Hook에서 JSONL append하는 공통 함수
2. **프롬프트 로깅 전용 Hook 추가**: UserPromptSubmit에 등록, 모든 프롬프트 기록
3. **기존 Hook에 JSONL 로깅 추가**: 실행 시각, Hook 이름, exit code, 소요시간
4. **로그 경로 설정**: `.env`나 환경변수로 LOG_DIR 지정
5. **워크플로우 체크포인트**: 특정 파일 생성/커밋 감지 시 자동 기록 (또는 CLAUDE.md 규칙으로 지시)

---

## 7. 커맨드 정의 요약

| 커맨드 | 파일 | 용도 | 상태 |
|--------|------|------|------|
| /clear | clear.md | HANDOFF.md 갱신 후 컨텍스트 초기화 | 정의됨, 테스트 안 됨 |
| /gen-spec | gen-spec.md | 코드 분석 → 기능명세서 자동 생성 | 정의됨, 테스트 안 됨 |
| /verify-docs | verify-docs.md | 문서-코드 동기화 검증 | 정의됨, 테스트 안 됨 |
| /feedback-to-pr | feedback-to-pr.md | 피드백 → PR 자동 생성 | 정의됨, 테스트 안 됨 |
| /project-chat | project-chat.md | 프로젝트 문서 기반 Q&A | 정의됨, 테스트 안 됨 |

---

## 8. 프로젝트 템플릿 요약

| 템플릿 | 기술 스택 | 주요 내용 |
|--------|----------|----------|
| spring-boot/CLAUDE.md | Java 21, Spring Boot 3.x, JPA, QueryDSL | DDD 패키지 구조, 페이지네이션, JWT, 에러코드 |
| fastapi/CLAUDE.md | Python 3.11+, SQLAlchemy 2.0 async, Pydantic v2 | 비동기 패턴, DI, 마이그레이션, pytest |
| nextjs/CLAUDE.md | Next.js 14 App Router, React 18, Zustand | 서버/클라이언트 컴포넌트, Axios, Zod |

---

## 9. 설치/동기화 스크립트

### install.sh
- `--link` 모드: 심볼릭 링크 (개발용, 변경 즉시 반영)
- 일반 모드: GitHub에서 다운로드
- `~/.claude/` 디렉토리에 settings.json, hooks/ 배치

### scripts/sync.sh
- `push`: 로컬 → 레포 (개인 커스텀을 팀에 공유)
- `pull`: 레포 → 로컬 (팀 설정을 개인에 적용)

### scripts/init-project.sh
- 프로젝트에 프레임워크별 CLAUDE.md 템플릿 적용
- HANDOFF.md 초기 생성
