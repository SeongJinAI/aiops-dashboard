#!/bin/bash
# AIOps Hook 설치 스크립트 — 현재 디렉토리(레포 루트)에서 실행
# 사용법:
#   AIOPS_REMOTE_URL=https://<dashboard-host> bash -c "$(curl -fsSL .../api/scripts/install-hook.sh)"
#
# 동작:
#   1) .claude/hooks/ 에 Hook 스크립트 3종 다운로드 (log-hook, log-prompt, log-event)
#   2) .claude/settings.json 에 6종 Hook 이벤트 등록 (기존 aiops-* 항목은 제거 후 재등록)
#   3) .aiops/{hooks, prompts, sessions, agents, slash_commands, mcp_calls, workflow} 폴더 생성

set -e

SCRIPT_URL="${AIOPS_REMOTE_URL:-}"
if [ -z "$SCRIPT_URL" ]; then
    echo "ERROR: AIOPS_REMOTE_URL 환경변수가 필요합니다."
    echo "  export AIOPS_REMOTE_URL=https://your-dashboard.example.com"
    exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "==> 레포: $REPO_ROOT"
echo "==> 대시보드: $SCRIPT_URL"

mkdir -p .claude/hooks \
    .aiops/hooks .aiops/prompts \
    .aiops/sessions .aiops/agents .aiops/slash_commands .aiops/mcp_calls \
    .aiops/workflow

echo "==> Hook 스크립트 3종 다운로드"
curl -fsSL "$SCRIPT_URL/api/scripts/aiops-log-hook.sh" -o .claude/hooks/aiops-log-hook.sh
curl -fsSL "$SCRIPT_URL/api/scripts/aiops-log-prompt.sh" -o .claude/hooks/aiops-log-prompt.sh
curl -fsSL "$SCRIPT_URL/api/scripts/aiops-log-event.sh" -o .claude/hooks/aiops-log-event.sh
chmod +x .claude/hooks/aiops-log-hook.sh .claude/hooks/aiops-log-prompt.sh .claude/hooks/aiops-log-event.sh

echo "==> settings.json 갱신 (기존 aiops-* 등록 정리 후 재등록)"
SETTINGS=".claude/settings.json"
if [ ! -f "$SETTINGS" ]; then echo '{}' > "$SETTINGS"; fi

python3 - "$SETTINGS" <<'PYEOF'
import json, sys, re
path = sys.argv[1]
with open(path) as f:
    cfg = json.load(f)

hooks = cfg.setdefault("hooks", {})

# 1) 기존 aiops-* 경로의 hook 모두 제거 (idempotent 보장)
AIOPS_PATTERN = re.compile(r"\.claude/hooks/aiops-log-")
for cat, entries in list(hooks.items()):
    new_entries = []
    for entry in entries:
        kept_hooks = [h for h in entry.get("hooks", []) if not AIOPS_PATTERN.search(h.get("command", ""))]
        if kept_hooks:
            new_entries.append({**entry, "hooks": kept_hooks})
    if new_entries:
        hooks[cat] = new_entries
    else:
        # 빈 카테고리는 삭제
        del hooks[cat]

# 2) 새 등록
def register(category, matcher, command):
    arr = hooks.setdefault(category, [])
    arr.append({
        "matcher": matcher,
        "hooks": [{"type": "command", "command": command}],
    })

register("PostToolUse", "", ".claude/hooks/aiops-log-hook.sh")
register("UserPromptSubmit", "", ".claude/hooks/aiops-log-prompt.sh")
register("SessionStart", "", ".claude/hooks/aiops-log-event.sh SessionStart sessions")
register("Stop", "", ".claude/hooks/aiops-log-event.sh Stop sessions")
register("SubagentStop", "", ".claude/hooks/aiops-log-event.sh SubagentStop agents")
register("PreCompact", "", ".claude/hooks/aiops-log-event.sh PreCompact sessions")

with open(path, "w") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
PYEOF

echo ""
echo "Hook 설치 완료. 등록된 이벤트:"
echo "  - PostToolUse (모든 도구) → hooks + mcp_calls(자동)"
echo "  - UserPromptSubmit → prompts + slash_commands(자동)"
echo "  - SessionStart → sessions"
echo "  - Stop (SessionEnd) → sessions"
echo "  - SubagentStop → agents"
echo "  - PreCompact → sessions"
echo ""
echo "환경변수 확인: ~/.claude/.env 에 AIOPS_REMOTE_URL/API_KEY/TENANT_ID 가 있어야 원격 전송됩니다."
