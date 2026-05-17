#!/bin/bash
# AIOps 대시보드용 PostToolUse Hook
# 모든 도구 호출을 hooks 카테고리에 기록.
# tool_name이 mcp__* 패턴이면 mcp_calls 카테고리에 추가 기록.

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
REPO_NAME="$(basename "$REPO_ROOT")"
LOG_DIR="${REPO_ROOT}/.aiops/hooks"
MCP_DIR="${REPO_ROOT}/.aiops/mcp_calls"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$LOG_DIR" "$MCP_DIR"

[ -f "$HOME/.claude/.env" ] && set -a && . "$HOME/.claude/.env" && set +a

TMP_INPUT="$(mktemp)"
dd bs=65536 count=1 > "$TMP_INPUT" 2>/dev/null

PARSED="$(python3 - "$TMP_INPUT" "$REPO_NAME" <<'PYEOF'
import sys, json, datetime
input_file, repo = sys.argv[1], sys.argv[2]
try:
    with open(input_file) as f:
        raw = f.read().strip()
    d = json.loads(raw) if raw else {}
except Exception:
    d = {}

tool_name = d.get('tool_name', '') or 'Unknown'
tool_input = d.get('tool_input', {}) or {}
resp = d.get('tool_response', {}) or {}

# script 추출: Bash면 command 첫 단어, 그 외는 도구명
cmd = tool_input.get('command', '') if isinstance(tool_input, dict) else ''
if cmd:
    tokens = cmd.strip().split()
    script = tokens[0] if tokens else tool_name.lower()
else:
    script = tool_name.lower()

try: exit_c = int(resp.get('exit_code', 0))
except: exit_c = 0
try: ms = int(d.get('duration_ms', 0))
except: ms = 0

is_mcp = tool_name.startswith('mcp__')

entry = {
    "ts": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="seconds"),
    "hook": "PostToolUse",
    "tool_name": tool_name,
    "script": script,
    "exit": exit_c,
    "ms": ms,
    "repo": repo,
    "session_id": d.get('session_id', ''),
    "is_mcp": is_mcp,
}
print(json.dumps(entry, ensure_ascii=False))
PYEOF
)"

rm -f "$TMP_INPUT"

[ -z "$PARSED" ] && exit 0

# 1) hooks 카테고리에 무조건 기록
echo "$PARSED" >> "$LOG_DIR/$DATE.jsonl"

# 2) MCP 도구면 mcp_calls 카테고리에도 추가 기록
IS_MCP="$(echo "$PARSED" | python3 -c "import sys,json;print(json.loads(sys.stdin.read()).get('is_mcp', False))")"
if [ "$IS_MCP" = "True" ]; then
    echo "$PARSED" >> "$MCP_DIR/$DATE.jsonl"
fi

send_remote() {
    local CAT="$1"
    if [ -n "$AIOPS_REMOTE_URL" ] && [ -n "$AIOPS_API_KEY" ] && [ -n "$AIOPS_TENANT_ID" ]; then
        PAYLOAD="$(python3 -c "
import json, sys
entry = json.loads(sys.argv[1])
print(json.dumps({'tenant_id': sys.argv[2], 'category': sys.argv[3], 'payload': entry}))
" "$PARSED" "$AIOPS_TENANT_ID" "$CAT")"

        curl -fsS --max-time 3 \
            -H "Content-Type: application/json" \
            -H "X-API-Key: $AIOPS_API_KEY" \
            -d "$PAYLOAD" \
            "$AIOPS_REMOTE_URL/api/ingest" \
            > /dev/null 2>&1 &
    fi
}

send_remote "hooks"
[ "$IS_MCP" = "True" ] && send_remote "mcp_calls"

exit 0
