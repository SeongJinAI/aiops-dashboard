# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

5개 레포(거버넌스, 테스트, 지식, 프로젝트, RAG)로 구성된 AI 개발 자동화 시스템의 **운영 대시보드**.
Hook 실행 로그, 워크플로우 준수, 프롬프트 히스토리를 JSONL 파일에서 읽어 시각화한다.

## 기술 스택

- **백엔드:** Python 3.11+ / FastAPI + Uvicorn + WebSocket + SQLite
- **프론트엔드:** Vite + React 19 + TypeScript
- **데이터:** JSONL 파일 (1차 소스) → SQLite (영구 저장, `data/aiops.db`)
- **실시간:** watchfiles로 JSONL 감시 → WebSocket push

## 5-레포 경로

| 레포 | 경로 | 역할 |
|------|------|------|
| **거버넌스** | `/mnt/c/MyProject/seongjinAI/claude-config-template` | 글로벌 규칙, Hook, 설정 중앙 관리 |
| **테스트** | `/mnt/c/MyProject/seongjinAI/claude-api-test-template` | AI 코드 테스트 + 결과 관리 |
| **지식** | `/mnt/c/MyProject/seongjinAI/knowledge-repo` | 문서화 — AI의 장기 기억 |
| **프로젝트** | `/mnt/c/Inconus/inconus-api-erp-v2` (현재 활성) | 실제 서비스 코드 (도메인 교체 시 이것만 변경) |
| **RAG** | (미착수) | 지식 레포 기반 Q&A 챗봇 |
| **대시보드 (이 레포)** | `/mnt/c/MyProject/seongjinAI/aiops-dashboard` | 운영 모니터링 |

## JSONL 로그 형식

| 카테고리 | 경로 | 주요 필드 |
|---------|------|----------|
| Hook 실행 | `logs/hooks/{날짜}.jsonl` | ts, hook, script, exit(0=성공/2=차단), ms, repo |
| 프롬프트 | `logs/prompts/{날짜}.jsonl` | ts, prompt, repo, tokens |
| 워크플로우 | `logs/workflow/{날짜}.jsonl` | ts, workflow, step, stepNum, total, repo |

## 참고 문서

- `dashboard-구현-가이드.md` — 상세 구현 명세 (API, 데이터 형식, 컴포넌트 분리 가이드)
- `dashboard-architecture.jsx` — UI 프로토타입 (디자인 원본)
- `5-레포-아키텍처.md` — 5개 레포 전체 설계
