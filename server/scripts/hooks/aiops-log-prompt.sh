#!/bin/bash
# AIOps 대시보드용 UserPromptSubmit Hook
# 모든 프롬프트를 prompts 카테고리에 기록.
# 프롬프트가 슬래시 명령(/foo)으로 시작하면 slash_commands 카테고리에 추가 기록.

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel 2>/dev/null)"
REPO_ROOT="${REPO_ROOT:-$(pwd)}"
REPO_NAME="$(basename "$REPO_ROOT")"
PROMPTS_DIR="${REPO_ROOT}/.aiops/prompts"
SLASH_DIR="${REPO_ROOT}/.aiops/slash_commands"
DATE="$(date +%Y-%m-%d)"

mkdir -p "$PROMPTS_DIR" "$SLASH_DIR"

[ -f "$HOME/.claude/.env" ] && set -a && . "$HOME/.claude/.env" && set +a

TMP_INPUT="$(mktemp)"
dd bs=65536 count=1 > "$TMP_INPUT" 2>/dev/null

PARSED="$(python3 - "$TMP_INPUT" "$REPO_NAME" <<'PYEOF'
import sys, json, datetime, re
input_file, repo = sys.argv[1], sys.argv[2]
try:
    with open(input_file) as f:
        raw = f.read().strip()
    d = json.loads(raw) if raw else {}
except Exception:
    d = {}

prompt = d.get('prompt', '') or d.get('user_prompt', '')
prompt_short = prompt[:200]

slash_match = re.match(r'^/([A-Za-z][\w:-]*)', prompt.lstrip())
slash_cmd = slash_match.group(1) if slash_match else ''

entry = {
    "ts": datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(timespec="seconds"),
    "prompt": prompt_short,
    "repo": repo,
    "tokens": len(prompt),
    "session_id": d.get('session_id', ''),
}
if slash_cmd:
    entry["slash_command"] = slash_cmd

print(json.dumps(entry, ensure_ascii=False))
PYEOF
)"

rm -f "$TMP_INPUT"

[ -z "$PARSED" ] && exit 0

# 1) prompts 카테고리에 무조건 기록
( echo "$PARSED" >> "$PROMPTS_DIR/$DATE.jsonl" ) &

# 2) 슬래시 명령이면 slash_commands 카테고리에도 추가 기록
SLASH="$(echo "$PARSED" | python3 -c "import sys,json;print(json.loads(sys.stdin.read()).get('slash_command', ''))")"
if [ -n "$SLASH" ]; then
    ( echo "$PARSED" >> "$SLASH_DIR/$DATE.jsonl" ) &
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

send_remote "prompts"
[ -n "$SLASH" ] && send_remote "slash_commands"

exit 0
