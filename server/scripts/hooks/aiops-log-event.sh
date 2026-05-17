#!/bin/bash
# AIOps 범용 Hook 로깅 스크립트
#
# 사용법 (settings.json의 hook command에 인자로 지정):
#   .claude/hooks/aiops-log-event.sh <event_name> [category]
#
# 예:
#   .claude/hooks/aiops-log-event.sh SessionStart sessions
#   .claude/hooks/aiops-log-event.sh Stop sessions
#   .claude/hooks/aiops-log-event.sh SubagentStop agents
#   .claude/hooks/aiops-log-event.sh PreCompact sessions
#   .claude/hooks/aiops-log-event.sh PreToolUse hooks
#
# 동작:
#   1) stdin으로 들어온 JSON을 파싱
#   2) {ts, event, category, session_id, repo, ...추가 필드} 형식으로 정규화
#   3) 로컬 .aiops/{category}/{date}.jsonl 에 기록
#   4) ~/.claude/.env 의 AIOPS_REMOTE_URL 설정 시 원격 /api/ingest 전송

EVENT="${1:-Unknown}"
CATEGORY="${2:-hooks}"

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
REPO_NAME="$(basename "$REPO_ROOT")"
LOG_DIR="${REPO_ROOT}/.aiops/${CATEGORY}"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$LOG_DIR"

[ -f "$HOME/.claude/.env" ] && set -a && . "$HOME/.claude/.env" && set +a

TMP_INPUT="$(mktemp)"
dd bs=65536 count=1 > "$TMP_INPUT" 2>/dev/null

PARSED="$(python3 - "$TMP_INPUT" "$REPO_NAME" "$EVENT" <<'PYEOF'
import sys, json, datetime
input_file, repo, event = sys.argv[1], sys.argv[2], sys.argv[3]
try:
    with open(input_file) as f:
        raw = f.read().strip()
    d = json.loads(raw) if raw else {}
except Exception:
    d = {}

# 공통 필드 추출 (Claude Code Hook payload 표준)
session_id = d.get('session_id', '')
tool_name = d.get('tool_name', '')
subagent_type = ''
if event == 'SubagentStop':
    subagent_type = d.get('subagent_type', '') or d.get('agent_type', '')

# SubagentStop 등 일부는 tool_response/usage 정보가 들어옴
usage = d.get('usage') or d.get('tool_response', {}).get('usage') or {}

entry = {
    "ts": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="seconds"),
    "event": event,
    "repo": repo,
    "session_id": session_id,
}
if tool_name:
    entry["tool_name"] = tool_name
if subagent_type:
    entry["subagent_type"] = subagent_type
if usage:
    entry["usage"] = usage

# PreCompact 의 경우 trigger 정보
if event == 'PreCompact':
    entry["trigger"] = d.get('trigger', '')

print(json.dumps(entry, ensure_ascii=False))
PYEOF
)"

rm -f "$TMP_INPUT"

[ -z "$PARSED" ] && exit 0

# 로컬 기록 (async)
( echo "$PARSED" >> "$LOG_DIR/$DATE.jsonl" ) &

# 원격 전송 (env 설정 시)
if [ -n "$AIOPS_REMOTE_URL" ] && [ -n "$AIOPS_API_KEY" ] && [ -n "$AIOPS_TENANT_ID" ]; then
    PAYLOAD="$(python3 -c "
import json, sys
entry = json.loads(sys.argv[1])
print(json.dumps({'tenant_id': sys.argv[2], 'category': sys.argv[3], 'payload': entry}))
" "$PARSED" "$AIOPS_TENANT_ID" "$CATEGORY")"

    curl -fsS --max-time 3 \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $AIOPS_API_KEY" \
        -d "$PAYLOAD" \
        "$AIOPS_REMOTE_URL/api/ingest" \
        > /dev/null 2>&1 &
fi

exit 0
