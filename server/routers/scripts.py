"""
설치 스크립트 서빙 — 사용자가 본인 레포에서 curl로 받아 실행할 수 있게 정적 텍스트 응답
+ 통합 install.sh — API 키만 있으면 .env 패치 + 레포 등록 + Hook 설치 + 연결 테스트까지 1줄로
"""
import io
import os
import tarfile
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse, Response
from services.auth import verify_api_key, verify_api_key_db
from routers.health import resolve_public_url

router = APIRouter()

SCRIPTS_DIR = Path(os.path.dirname(os.path.dirname(__file__))) / "scripts"
SKILLS_DIR = SCRIPTS_DIR / "skills"


@router.get("/skills.tar")
async def skills_bundle():
    """프로젝트에 설치할 지식 문서 생성 skill 번들 (tar).
    install.sh가 .claude/skills/ 로 풀어 넣는다. 인증 불필요(공개 정적 자산)."""
    if not SKILLS_DIR.is_dir():
        raise HTTPException(status_code=404, detail="스킬 번들을 찾을 수 없습니다")
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w") as tar:
        for p in sorted(SKILLS_DIR.rglob("*")):
            if p.is_file():
                tar.add(str(p), arcname=str(p.relative_to(SKILLS_DIR)))
    return Response(content=buf.getvalue(), media_type="application/x-tar")


@router.get("/install-hook.sh", response_class=PlainTextResponse)
async def install_hook():
    path = SCRIPTS_DIR / "install-hook.sh"
    if not path.exists():
        raise HTTPException(status_code=404, detail="설치 스크립트를 찾을 수 없습니다")
    return path.read_text(encoding="utf-8")


@router.get("/aiops-log-hook.sh", response_class=PlainTextResponse)
async def log_hook_script():
    path = SCRIPTS_DIR / "hooks" / "aiops-log-hook.sh"
    if not path.exists():
        raise HTTPException(status_code=404)
    return path.read_text(encoding="utf-8")


@router.get("/aiops-log-prompt.sh", response_class=PlainTextResponse)
async def log_prompt_script():
    path = SCRIPTS_DIR / "hooks" / "aiops-log-prompt.sh"
    if not path.exists():
        raise HTTPException(status_code=404)
    return path.read_text(encoding="utf-8")


@router.get("/aiops-log-event.sh", response_class=PlainTextResponse)
async def log_event_script():
    path = SCRIPTS_DIR / "hooks" / "aiops-log-event.sh"
    if not path.exists():
        raise HTTPException(status_code=404)
    return path.read_text(encoding="utf-8")


def _resolve_api_base(request: Request, override: str | None) -> str:
    """install.sh 명령용 베이스 URL. ?base= 쿼리가 있으면 그 값을, 없으면
    AIOPS_PUBLIC_URL 또는 요청 헤더로 추론 (health.resolve_public_url와 통일)."""
    if override:
        return override.rstrip("/")
    return resolve_public_url(request)


@router.get("/install.sh")
async def integrated_installer(
    request: Request,
    token: str = "",
    base: str = "",
    download: int = 0,
):
    """통합 설치 스크립트.

    사용 옵션:
      A) curl 한 줄:
         bash -c "$(curl -fsSL https://<dashboard>/api/scripts/install.sh?token=<API_KEY>)"
      B) 다운로드 후 실행 (download=1):
         curl -o nova-install.sh "...?token=...&download=1"
         bash nova-install.sh

    동작:
      1) ~/.claude/.env 에 AIOPS_REMOTE_URL/AIOPS_API_KEY/AIOPS_TENANT_ID 추가 (idempotent)
      2) 현재 디렉토리(또는 git toplevel)를 활성 프로젝트로 자동 등록
      3) .claude/hooks/ + .aiops/ 디렉토리 생성, Hook 스크립트 3종 다운로드, settings.json 패치
      4) 지식 문서 생성 skill 번들 설치 (.claude/skills/) — 개발자가 문서를 만들면 자산 sync로 되먹임
      5) 프로젝트 .md 자산 초기 push (Hermes 위키/RAG 입력)
      6) 테스트 ping 전송으로 연결 확인
    """
    if not token:
        raise HTTPException(status_code=400, detail="token 파라미터가 필요합니다")

    tenant_id = await verify_api_key_db(token)
    if not tenant_id:
        tenant_id = verify_api_key(token)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")

    api_base = _resolve_api_base(request, base or None)
    body = _build_integrated_script(api_base, token, tenant_id)

    headers = {}
    if download:
        # 브라우저가 .sh로 파일 저장하도록 강제. inline 표시(텍스트)는 차단.
        headers["Content-Disposition"] = 'attachment; filename="nova-install.sh"'
    return PlainTextResponse(body, headers=headers)


def _build_integrated_script(api_base: str, api_key: str, tenant_id: str) -> str:
    """동적으로 생성된 통합 설치 스크립트 본문.

    토큰은 URL이 아닌 스크립트 변수에만 박혀나간다 (curl 출력은 보이지만 ps 등에는 노출되지 않음).
    """
    return f"""#!/usr/bin/env bash
# AIOps Dashboard 통합 설치 스크립트 (자동 생성)
# tenant_id={tenant_id}
set -e

API_BASE="{api_base}"
API_KEY="{api_key}"
TENANT_ID="{tenant_id}"

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
REPO_NAME="$(basename "$REPO_ROOT")"

echo "==> AIOps Dashboard 통합 설치"
echo "    레포    : $REPO_ROOT"
echo "    대시보드: $API_BASE"
echo "    tenant  : $TENANT_ID"
echo ""

# 1) ~/.claude/.env 패치 (idempotent)
echo "[1/6] ~/.claude/.env 환경변수 설정"
mkdir -p ~/.claude
ENV_FILE="$HOME/.claude/.env"
touch "$ENV_FILE"

set_env_var() {{
    local key="$1"
    local value="$2"
    if grep -q "^${{key}}=" "$ENV_FILE" 2>/dev/null; then
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s|^${{key}}=.*|${{key}}=${{value}}|" "$ENV_FILE"
        else
            sed -i "s|^${{key}}=.*|${{key}}=${{value}}|" "$ENV_FILE"
        fi
    else
        echo "${{key}}=${{value}}" >> "$ENV_FILE"
    fi
}}

set_env_var "AIOPS_REMOTE_URL" "$API_BASE"
set_env_var "AIOPS_API_KEY"    "$API_KEY"
set_env_var "AIOPS_TENANT_ID"  "$TENANT_ID"
echo "    완료"

# 2) 레포를 백엔드에 자동 등록 (활성 프로젝트로 설정됨)
echo "[2/6] 레포 자동 등록 → $REPO_NAME"
REG_BODY=$(cat <<JSON
{{"name": "$REPO_NAME", "repoPath": "$REPO_ROOT", "gitUrl": ""}}
JSON
)
REG_CODE=$(curl -s -o /tmp/aiops_reg.out -w "%{{http_code}}" \\
    -X POST "$API_BASE/api/projects/register" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: $API_KEY" \\
    -d "$REG_BODY")
if [ "$REG_CODE" = "200" ] || [ "$REG_CODE" = "201" ] || [ "$REG_CODE" = "409" ]; then
    echo "    완료"
else
    echo "    경고: HTTP $REG_CODE — Connections 탭에서 수동 등록이 필요할 수 있습니다"
    cat /tmp/aiops_reg.out 2>/dev/null || true
    echo ""
fi

# 3) Claude Code Hook 설치
echo "[3/6] Claude Code Hook 설치"
cd "$REPO_ROOT"
mkdir -p .claude/hooks \\
    .aiops/hooks .aiops/prompts \\
    .aiops/sessions .aiops/agents .aiops/slash_commands .aiops/mcp_calls \\
    .aiops/workflow

for hook in aiops-log-hook.sh aiops-log-prompt.sh aiops-log-event.sh; do
    curl -fsSL "$API_BASE/api/scripts/$hook" -o ".claude/hooks/$hook"
done
chmod +x .claude/hooks/aiops-log-*.sh

SETTINGS=".claude/settings.json"
if [ ! -f "$SETTINGS" ]; then echo '{{}}' > "$SETTINGS"; fi

python3 - "$SETTINGS" <<'PYEOF'
import json, sys, re
path = sys.argv[1]
with open(path) as f:
    cfg = json.load(f)

hooks = cfg.setdefault("hooks", {{}})

AIOPS_PATTERN = re.compile(r"\\.claude/hooks/aiops-log-")
for cat, entries in list(hooks.items()):
    new_entries = []
    for entry in entries:
        kept = [h for h in entry.get("hooks", []) if not AIOPS_PATTERN.search(h.get("command", ""))]
        if kept:
            new_entries.append({{**entry, "hooks": kept}})
    if new_entries:
        hooks[cat] = new_entries
    else:
        del hooks[cat]

def register(category, matcher, command):
    arr = hooks.setdefault(category, [])
    arr.append({{"matcher": matcher, "hooks": [{{"type": "command", "command": command}}]}})

register("PostToolUse",      "", ".claude/hooks/aiops-log-hook.sh")
register("UserPromptSubmit", "", ".claude/hooks/aiops-log-prompt.sh")
register("SessionStart",     "", ".claude/hooks/aiops-log-event.sh SessionStart sessions")
register("Stop",             "", ".claude/hooks/aiops-log-event.sh Stop sessions")
register("SubagentStop",     "", ".claude/hooks/aiops-log-event.sh SubagentStop agents")
register("PreCompact",       "", ".claude/hooks/aiops-log-event.sh PreCompact sessions")

with open(path, "w") as f:
    json.dump(cfg, f, indent=2, ensure_ascii=False)
PYEOF
echo "    완료 (settings.json 갱신)"

# 4) 지식 문서 생성 skill 설치 → .claude/skills/
#    개발자가 이 skill로 만든 docs/*.md 는 자산 sync로 Nova에 되먹임된다.
echo "[4/6] 지식 문서 생성 skill 설치"
mkdir -p .claude/skills
if curl -fsSL "$API_BASE/api/scripts/skills.tar" -o /tmp/nova-skills.tar; then
    tar -xf /tmp/nova-skills.tar -C .claude/skills
    rm -f /tmp/nova-skills.tar
    echo "    완료 — /nova-feature-spec /nova-architecture /nova-db-erd /nova-api-flow /nova-domain-insight /nova-prompt-vault /nova-recall"
else
    echo "    경고: skill 번들 다운로드 실패 — 건너뜀"
fi

# 5) 초기 .md 자산 push — Hermes 위키 빌더와 RAG 입력이 된다.
#    이후 변경분은 PostToolUse Hook이 자동 sync.
echo "[5/6] 프로젝트 .md 자산 push"
REPO_ROOT="$REPO_ROOT" API_BASE="$API_BASE" API_KEY="$API_KEY" PROJECT_NAME="$REPO_NAME" \
python3 - <<'PYEOF'
import json, os, urllib.request, urllib.error
REPO_ROOT = os.environ["REPO_ROOT"]
API_BASE  = os.environ["API_BASE"]
API_KEY   = os.environ["API_KEY"]
PROJECT   = os.environ["PROJECT_NAME"]

SKIP = {{".git", "node_modules", ".aiops", "venv", ".venv",
        "__pycache__", "build", "dist", "out", "target",
        ".idea", ".vscode", ".gradle", ".run"}}
MAX_BYTES = 900_000  # 서버 1MB 제한 안전 마진
BATCH = 100

items = []
for root, dirs, files in os.walk(REPO_ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP]
    for fn in files:
        if not fn.lower().endswith(".md"):
            continue
        full = os.path.join(root, fn)
        rel = os.path.relpath(full, REPO_ROOT).replace(os.sep, "/")
        try:
            text = open(full, "r", encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        size = len(text.encode("utf-8"))
        if size > MAX_BYTES:
            print("    skip(>900KB): " + rel)
            continue
        items.append({{"path": rel, "content": text, "size_bytes": size}})

def send(batch):
    body = json.dumps({{"project_name": PROJECT, "items": batch}}).encode("utf-8")
    req = urllib.request.Request(
        API_BASE + "/api/assets/sync", data=body, method="POST",
        headers={{"Content-Type": "application/json", "X-API-Key": API_KEY}},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, ""
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "ignore")[:200]
    except Exception as e:
        return 0, str(e)[:200]

sent, total = 0, len(items)
for i in range(0, total, BATCH):
    code, err = send(items[i:i+BATCH])
    if code == 200:
        sent += len(items[i:i+BATCH])
    else:
        print("    경고: HTTP " + str(code) + " " + err)

print("    " + str(sent) + "/" + str(total) + " .md 자산 push 완료")
PYEOF

# 6) 연결 테스트 ping
echo "[6/6] 연결 테스트 ping 전송"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
PING_BODY=$(cat <<JSON
{{"category":"hooks","payload":{{"ts":"$TS","hook":"install_test","script":"install.sh","exit":0,"ms":0,"repo":"$REPO_NAME"}}}}
JSON
)
PING_CODE=$(curl -s -o /dev/null -w "%{{http_code}}" \\
    -X POST "$API_BASE/api/ingest" \\
    -H "Content-Type: application/json" \\
    -H "X-API-Key: $API_KEY" \\
    -d "$PING_BODY")
if [ "$PING_CODE" = "200" ]; then
    echo "    완료 — 대시보드의 Hook 모니터에서 'install_test' 이벤트가 보입니다"
else
    echo "    경고: ping 실패 (HTTP $PING_CODE) — .env 또는 네트워크 확인 필요"
fi

echo ""
echo "✅ 설치 완료. 이제 이 레포에서 Claude Code 작업이 자동으로 대시보드에 수집됩니다."
echo "   대시보드: $API_BASE"
echo ""
echo "📚 지식 문서 생성 skill이 설치되었습니다. Claude Code에서 사용하세요:"
echo "   /nova-feature-spec   기능명세서      /nova-architecture   아키텍처 설명서"
echo "   /nova-db-erd         DB 관계도(ERD)  /nova-api-flow       API 플로우"
echo "   /nova-domain-insight 도메인 인사이트  /nova-prompt-vault   프롬프트 금고"
echo "   /nova-recall         작업 전 지식 회상 (지식 베이스 검색 → 컨텍스트)"
echo "   → 생성된 docs/*.md 는 자동으로 대시보드에 수집되고, /nova-recall 로 다음 작업에 되먹임됩니다."
"""
