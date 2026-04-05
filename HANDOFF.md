# HANDOFF.md

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
