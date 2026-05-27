"""
활성 프로젝트의 실제 디렉토리 구조를 스캔하여 RepoMap에 동적 정보를 제공한다.

스캔 대상:
  - .claude/         (rules, agents, hooks, skills, settings.json)
  - .aiops/          (hooks, prompts, sessions, agents, slash_commands, mcp_calls, workflow)
  - src/, server/, frontend/, app/  (코드 디렉토리)
  - docs/, knowledge/, .knowledge/  (문서)
  - tests/, test/                    (테스트)
  - 기타 루트 *.md 파일

SaaS 모드에서 사용자 서버는 사용자 PC의 파일을 읽을 수 없다. 따라서:
  - local 모드: 활성 프로젝트의 repoPath 스캔
  - saas 모드: 빈 결과 반환 (사용자 PC에서 install.sh가 카탈로그 ingest로 보내야 함 — 향후)
"""
from __future__ import annotations

import os
from pathlib import Path


_CODE_DIRS = ("src", "server", "frontend", "app", "backend", "client", "lib", "packages")
_DOC_DIRS = ("docs", "knowledge", ".knowledge", "documentation")
_TEST_DIRS = ("tests", "test", "spec", "specs", "e2e", "__tests__")


def _count_files(directory: Path, pattern: str = "*", recursive: bool = True) -> int:
    if not directory.exists():
        return 0
    try:
        if recursive:
            return sum(1 for _ in directory.rglob(pattern) if _.is_file())
        return sum(1 for _ in directory.glob(pattern) if _.is_file())
    except Exception:
        return 0


def _exists(directory: Path) -> bool:
    return directory.exists() and directory.is_dir()


def scan_project_structure(repo_path: str) -> dict:
    """활성 프로젝트의 실제 디렉토리/파일 통계를 반환.

    반환:
      {
        "repoPath": str,
        "exists": bool,
        "claude": { exists, rules, agents, hooks, skills, hasSettings },
        "aiops": { exists, categories: [{name, fileCount}] },
        "code": [{ name, fileCount }],
        "docs": [{ name, fileCount }],
        "tests": [{ name, fileCount }],
        "rootMd": int   (루트의 .md 파일 수)
      }
    """
    if not repo_path:
        return {"repoPath": "", "exists": False}
    root = Path(repo_path)
    if not _exists(root):
        return {"repoPath": repo_path, "exists": False}

    # .claude/
    claude_root = root / ".claude"
    claude_info = {"exists": _exists(claude_root)}
    if claude_info["exists"]:
        claude_info["rules"] = _count_files(claude_root / "rules", "*.md")
        claude_info["agents"] = _count_files(claude_root / "agents", "*.md")
        claude_info["hooks"] = _count_files(claude_root / "hooks", "*.sh") + _count_files(claude_root / "hooks", "*.py")
        claude_info["skills"] = sum(
            1 for _ in (claude_root / "skills").iterdir()
            if (claude_root / "skills").exists() and _.is_dir()
        ) if (claude_root / "skills").exists() else 0
        claude_info["hasSettings"] = (claude_root / "settings.json").exists()

    # .aiops/
    aiops_root = root / ".aiops"
    aiops_info = {"exists": _exists(aiops_root), "categories": []}
    if aiops_info["exists"]:
        for sub in sorted(aiops_root.iterdir()):
            if sub.is_dir():
                aiops_info["categories"].append({
                    "name": sub.name,
                    "fileCount": _count_files(sub, "*.jsonl", recursive=False),
                })

    # code / docs / tests
    code_dirs = []
    for name in _CODE_DIRS:
        d = root / name
        if _exists(d):
            code_dirs.append({"name": name, "fileCount": _count_files(d)})

    doc_dirs = []
    for name in _DOC_DIRS:
        d = root / name
        if _exists(d):
            doc_dirs.append({"name": name, "fileCount": _count_files(d, "*.md")})

    test_dirs = []
    for name in _TEST_DIRS:
        d = root / name
        if _exists(d):
            test_dirs.append({"name": name, "fileCount": _count_files(d)})

    # 루트 .md 파일
    root_md = _count_files(root, "*.md", recursive=False)

    return {
        "repoPath": repo_path,
        "exists": True,
        "claude": claude_info,
        "aiops": aiops_info,
        "code": code_dirs,
        "docs": doc_dirs,
        "tests": test_dirs,
        "rootMd": root_md,
    }
