---
name: nova-recall
description: 작업 전 프로젝트 지식 회상 — Nova 지식 베이스(생성된 docs/*.md)에서 현재 작업과 관련된 기존 문서를 검색해 컨텍스트로 가져온다. "관련 문서 찾아서 시작해줘", "이 작업 전에 기존 지식 확인"에서 사용. nova-feature-spec/architecture 등으로 만든 문서를 다음 작업에 되먹이는 루프의 소비 측.
---

# 지식 회상 (nova-recall)

비자명한 작업을 시작하기 전에, **이미 만들어 둔 지식 문서**(기능명세서·아키텍처·ERD·도메인 인사이트 등)에서 관련 내용을 먼저 찾아 컨텍스트로 삼는다. 같은 맥락을 처음부터 다시 발견하지 않게 한다.

## 절차

1. 현재 작업의 핵심 질문/주제를 한 문장으로 정한다.
2. `~/.claude/.env`에서 `AIOPS_REMOTE_URL`·`AIOPS_API_KEY`를 읽어 Nova 지식 베이스를 조회한다:
```bash
ENV="$HOME/.claude/.env"
URL=$(grep -E '^AIOPS_REMOTE_URL=' "$ENV" | cut -d= -f2-)
KEY=$(grep -E '^AIOPS_API_KEY=' "$ENV" | cut -d= -f2-)
curl -s -X POST "$URL/api/chat/query" \
  -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"question":"<작업 주제>"}'
```
3. 응답의 `sources[]`(관련 문서 경로 + 발췌)를 확인한다.
4. 관련도 높은 문서는 **로컬 파일을 직접 Read**해서 전체 맥락을 확보한다(snippet은 포인터일 뿐).
5. 회상한 내용을 1~3줄로 요약해 사용자에게 알리고 작업을 시작한다.

## 규칙

- 검색은 키 없이도 동작(어휘 검색). 응답에 `answer`가 있으면 요약으로 참고하되, **근거는 sources의 실제 문서**.
- 관련 문서가 없으면("색인 없음"/"매칭 없음") 그대로 보고하고, 필요시 `nova-domain-insight`로 새로 정리할 것을 제안.
- Nova 미설치(env 변수 없음)면 조용히 건너뛰고 일반 절차로 진행.
- 비밀/키를 출력에 노출하지 않는다.
