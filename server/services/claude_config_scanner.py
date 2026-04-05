"""
Claude 설정 스캐너 — 프로젝트/글로벌 범위의 .claude/ 설정을 스캔한다.

스캔 대상:
  - settings.local.json / settings.json (permissions, hooks, plugins)
  - rules/ (코딩 규칙 .md 파일)
  - agents/ (커스텀 에이전트 .md 파일)
  - skills/ (슬래시 커맨드 SKILL.md)
  - hooks/ (Hook 스크립트 .sh)
  - CLAUDE.md (프로젝트 지침)
  - .mcp.json (MCP 서버 설정)
"""
import json
import os
from pathlib import Path
from datetime import datetime

from services.log_store import AIOPS_MODE

PROJECT_REPO = os.getenv("PROJECT_REPO", "")
GOVERNANCE_REPO = os.getenv("GOVERNANCE_REPO", "")
CLAUDE_HOME = os.path.expanduser("~/.claude")


def _read_json(path: str) -> dict | None:
    """JSON 파일을 읽어 dict로 반환. 실패 시 None."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _read_text(path: str) -> str | None:
    """텍스트 파일을 읽어 반환. 실패 시 None."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return None


def _file_info(path: str) -> dict:
    """파일 기본 정보 반환."""
    try:
        stat = os.stat(path)
        return {
            "size": stat.st_size,
            "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        }
    except Exception:
        return {"size": 0, "modified": ""}


def _scan_md_dir(dir_path: str) -> list[dict]:
    """디렉토리 내 .md 파일 목록과 내용 반환."""
    results = []
    if not dir_path or not os.path.isdir(dir_path):
        return results

    for fname in sorted(os.listdir(dir_path)):
        fpath = os.path.join(dir_path, fname)
        if not os.path.isfile(fpath) or not fname.endswith(".md"):
            continue
        content = _read_text(fpath)
        info = _file_info(fpath)
        results.append({
            "name": fname,
            "content": content or "",
            **info,
        })
    return results


def _scan_skills(dir_path: str) -> list[dict]:
    """skills/ 디렉토리에서 SKILL.md 기반 스킬 목록 반환."""
    results = []
    if not dir_path or not os.path.isdir(dir_path):
        return results

    for skill_name in sorted(os.listdir(dir_path)):
        skill_dir = os.path.join(dir_path, skill_name)
        if not os.path.isdir(skill_dir):
            continue
        skill_md = os.path.join(skill_dir, "SKILL.md")
        if not os.path.isfile(skill_md):
            continue
        content = _read_text(skill_md)
        info = _file_info(skill_md)

        # SKILL.md frontmatter에서 description 추출
        description = ""
        if content:
            lines = content.split("\n")
            in_frontmatter = False
            for line in lines:
                if line.strip() == "---":
                    if in_frontmatter:
                        break
                    in_frontmatter = True
                    continue
                if in_frontmatter and line.startswith("description:"):
                    description = line.split(":", 1)[1].strip().strip('"').strip("'")

        results.append({
            "name": skill_name,
            "description": description,
            **info,
        })
    return results


def _scan_hooks_scripts(dir_path: str) -> list[dict]:
    """hooks/ 디렉토리에서 .sh 스크립트 목록 반환."""
    results = []
    if not dir_path or not os.path.isdir(dir_path):
        return results

    for fname in sorted(os.listdir(dir_path)):
        fpath = os.path.join(dir_path, fname)
        if not os.path.isfile(fpath) or not fname.endswith(".sh"):
            continue
        info = _file_info(fpath)
        results.append({
            "name": fname,
            **info,
        })
    return results


def _extract_hooks_from_settings(settings: dict | None) -> list[dict]:
    """settings.json의 hooks 설정에서 hook 목록 추출."""
    if not settings or "hooks" not in settings:
        return []

    hooks = []
    for event_type, hook_list in settings["hooks"].items():
        if not isinstance(hook_list, list):
            continue
        for hook in hook_list:
            matcher = hook.get("matcher", "")
            cmd = hook.get("command", "")
            hooks.append({
                "event": event_type,
                "matcher": matcher,
                "command": cmd if len(cmd) <= 120 else cmd[:120] + "...",
            })
    return hooks


def _extract_permissions(settings: dict | None) -> dict:
    """settings에서 permissions 추출."""
    if not settings:
        return {}
    perms = settings.get("permissions", {})
    return {
        "allow": perms.get("allow", []),
        "deny": perms.get("deny", []),
    }


def _extract_plugins(settings: dict | None) -> list[str]:
    """settings에서 enabledPlugins 추출."""
    if not settings:
        return []
    return settings.get("enabledPlugins", [])


def scan_project_config() -> dict:
    """활성 프로젝트 레포의 Claude 설정을 스캔한다."""
    if AIOPS_MODE == "saas" or not PROJECT_REPO:
        return _empty_config("project")

    repo = PROJECT_REPO
    claude_dir = os.path.join(repo, ".claude")
    has_claude_dir = os.path.isdir(claude_dir)

    # settings.local.json
    settings_path = os.path.join(claude_dir, "settings.local.json")
    settings = _read_json(settings_path) if has_claude_dir else None

    # CLAUDE.md (프로젝트 루트)
    claude_md_path = os.path.join(repo, "CLAUDE.md")
    claude_md = _read_text(claude_md_path)

    # rules/
    rules = _scan_md_dir(os.path.join(claude_dir, "rules")) if has_claude_dir else []

    # agents/
    agents = _scan_md_dir(os.path.join(claude_dir, "agents")) if has_claude_dir else []

    # skills/ (프로젝트 레벨)
    skills = _scan_skills(os.path.join(claude_dir, "skills")) if has_claude_dir else []

    # .mcp.json (프로젝트 루트)
    mcp_path = os.path.join(repo, ".mcp.json")
    mcp_config = _read_json(mcp_path)

    return {
        "scope": "project",
        "repoPath": repo,
        "repoName": os.path.basename(repo),
        "hasClaude": has_claude_dir,
        "settings": {
            "exists": settings is not None,
            "permissions": _extract_permissions(settings),
            "plugins": _extract_plugins(settings),
            "raw": settings,
        },
        "claudeMd": {
            "exists": claude_md is not None,
            "content": claude_md or "",
            "info": _file_info(claude_md_path) if claude_md else {},
        },
        "rules": rules,
        "agents": agents,
        "skills": skills,
        "hooks": _extract_hooks_from_settings(settings),
        "mcp": {
            "exists": mcp_config is not None,
            "servers": list(mcp_config.get("mcpServers", {}).keys()) if mcp_config else [],
            "raw": mcp_config,
        },
        "summary": {
            "totalItems": (
                (1 if settings else 0)
                + (1 if claude_md else 0)
                + len(rules)
                + len(agents)
                + len(skills)
                + (1 if mcp_config else 0)
            ),
        },
    }


def scan_global_config() -> dict:
    """글로벌(거버넌스) 범위의 Claude 설정을 스캔한다."""
    if AIOPS_MODE == "saas":
        return _empty_config("global")

    # 글로벌 settings.json
    settings_path = os.path.join(CLAUDE_HOME, "settings.json")
    settings = _read_json(settings_path)

    # 글로벌 CLAUDE.md
    claude_md_path = os.path.join(CLAUDE_HOME, "CLAUDE.md")
    claude_md = _read_text(claude_md_path)

    # 글로벌 rules/
    rules = _scan_md_dir(os.path.join(CLAUDE_HOME, "rules"))

    # 글로벌 agents/
    agents = _scan_md_dir(os.path.join(CLAUDE_HOME, "agents"))

    # 글로벌 skills/
    skills = _scan_skills(os.path.join(CLAUDE_HOME, "skills"))

    # 글로벌 hooks (스크립트 파일 + settings.json 설정)
    hook_scripts = _scan_hooks_scripts(os.path.join(CLAUDE_HOME, "hooks"))
    hook_settings = _extract_hooks_from_settings(settings)

    return {
        "scope": "global",
        "sourcePath": CLAUDE_HOME,
        "governancePath": GOVERNANCE_REPO or "",
        "settings": {
            "exists": settings is not None,
            "permissions": _extract_permissions(settings),
            "plugins": _extract_plugins(settings),
            "raw": settings,
        },
        "claudeMd": {
            "exists": claude_md is not None,
            "content": claude_md or "",
            "info": _file_info(claude_md_path) if claude_md else {},
        },
        "rules": rules,
        "agents": agents,
        "skills": skills,
        "hooks": hook_settings,
        "hookScripts": hook_scripts,
        "summary": {
            "totalItems": (
                (1 if settings else 0)
                + (1 if claude_md else 0)
                + len(rules)
                + len(agents)
                + len(skills)
                + len(hook_scripts)
            ),
        },
    }


def _empty_config(scope: str) -> dict:
    return {
        "scope": scope,
        "repoPath": "" if scope == "project" else CLAUDE_HOME,
        "hasClaude": False,
        "settings": {"exists": False, "permissions": {}, "plugins": [], "raw": None},
        "claudeMd": {"exists": False, "content": "", "info": {}},
        "rules": [],
        "agents": [],
        "skills": [],
        "hooks": [],
        "mcp": {"exists": False, "servers": [], "raw": None} if scope == "project" else None,
        "summary": {"totalItems": 0},
    }
