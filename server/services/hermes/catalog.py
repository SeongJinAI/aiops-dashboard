"""
Hermes — 자산 카탈로그 모듈.

활성 프로젝트의 repoPath 아래에서 .md 파일을 재귀 스캔하여
기획자/개발자/사용자 3-perspective 중 하나로 분류한다.

분류 규칙은 `_classify()`에서 단순 룰 기반 (경로 패턴 + 파일명 휴리스틱).
LLM 호출 없이 빠르게 동작하도록 설계.
"""
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Literal

Perspective = Literal["planner", "developer", "user", "skipped"]

# 스캔에서 제외할 디렉토리
SKIP_DIRS = {
    ".git", ".idea", ".vscode", ".gradle", ".run",
    "node_modules", "build", "out", "dist", "target",
    "logs", "__pycache__", ".aiops", "venv", ".venv",
    "worktrees",  # 임시 작업 브랜치 (.claude/worktrees/) — 본 자산 중복
}

# 최대 스캔 깊이 (성능 보호)
MAX_DEPTH = 6
# 한 파일당 최대 미리보기 글자 (Phase 1은 메타만)
PREVIEW_CHARS = 240


@dataclass
class AssetEntry:
    path: str            # repoPath 기준 상대 경로
    perspective: Perspective
    size_bytes: int
    preview: str         # 앞쪽 미리보기 텍스트
    bucket: str          # 분류 버킷 라벨 (UI 그룹핑용)


def _classify(rel_path: str, filename: str) -> tuple[Perspective, str]:
    """경로 + 파일명으로 perspective와 버킷을 판정.

    버킷은 UI에서 그룹핑용 라벨 (예: '루트 메타', 'rules', 'agents', 'skills', 'handoff' ...).
    """
    p = rel_path.replace("\\", "/").lower()
    name = filename.lower()

    # 1) .claude/* 자산 (개발자 영역의 노하우)
    if p.startswith(".claude/rules/"):
        return "developer", "rules"
    if p.startswith(".claude/agents/"):
        return "developer", "agents"
    if p.startswith(".claude/skills/") or p.startswith(".claude/commands/"):
        return "user", "skills/commands"
    if p.startswith(".claude/"):
        return "developer", "claude-config"

    # 2) handoff/* (시점별 진행 상황 — 기획자가 가장 자주 봄)
    if p.startswith("handoff/"):
        if "hotfix" in name:
            return "developer", "handoff/hotfix"
        if "infra" in name:
            return "developer", "handoff/infra"
        return "planner", "handoff"

    # 3) docs/ 하위 (혼합) — 최상위 docs/ 폴더 (있는 경우)
    if p.startswith("docs/"):
        if "user" in name or "manual" in name or "guide" in name or "사용자" in rel_path:
            return "user", "docs/user"
        if "arch" in name or "tech" in name or "api" in name or "schema" in name:
            return "developer", "docs/dev"
        return "planner", "docs/general"

    # 4) src/docs 하위 — 가장 세분화. 폴더 이름으로 perspective 결정
    if "src/docs/" in p or p.startswith("src/docs/"):
        # 사용자 매뉴얼 영역
        if "/user-guide/" in p or "사용자매뉴얼" in name or "업무가이드" in name:
            return "user", "user-guide"
        if "용어사전" in name or "자주묻는질문" in name or "faq" in name:
            return "user", "user-guide/faq"
        # 기획자 영역 (기능명세서, 보고서)
        if "/specs/" in p or "기능명세서" in name or "_명세" in name:
            return "planner", "specs"
        if "/reports/" in p or "보고서" in name:
            return "planner", "reports"
        # 개발자 영역
        if "/architecture/" in p or "아키텍처" in name or "_설명서" in name:
            return "developer", "architecture"
        if "/insights/" in p or "인사이트" in name:
            return "developer", "insights"
        if "/issues/" in p or p.startswith("src/docs/issues") or "issue" in name:
            return "developer", "issues"
        if "/test-scenarios/" in p or "테스트시나리오" in name or "테스트프롬프트" in name:
            return "developer", "test-scenarios"
        if "/etc/" in p:
            return "developer", "etc"
        if "error" in name or "exception" in name:
            return "developer", "src/error-catalog"
        if "readme" in name:
            return "developer", "src/readme"
        return "developer", "src/docs/misc"

    # 5) src/ 안의 그 외 .md
    if p.startswith("src/") and p.endswith(".md"):
        if "error" in name or "exception" in name:
            return "developer", "src/error-catalog"
        if "readme" in name:
            return "developer", "src/readme"
        return "developer", "src/misc"

    # 6) 루트 메타 파일
    if "/" not in rel_path:
        if name == "readme.md":
            return "planner", "root/readme"
        if name == "claude.md":
            return "planner", "root/claude"
        if "handoff" in name:
            return "planner", "root/handoff"
        if name in ("help.md", "usage.md", "getting-started.md"):
            return "user", "root/help"
        if name == "changelog.md":
            return "user", "root/changelog"
        return "planner", "root/meta"

    # 7) 기본값
    return "developer", "misc"


def _preview(path: Path, max_chars: int = PREVIEW_CHARS) -> str:
    """파일 앞 부분 미리보기 추출 (인코딩 안전)."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read(max_chars * 2)
        text = text.strip()
        if len(text) > max_chars:
            text = text[:max_chars] + "..."
        return text.replace("\r\n", "\n")
    except Exception:
        return ""


def catalog_assets(repo_path: str) -> list[AssetEntry]:
    """repo_path 아래의 .md 자산을 재귀 스캔하여 분류된 카탈로그를 반환."""
    if not repo_path:
        return []
    root = Path(repo_path)
    if not root.exists() or not root.is_dir():
        return []

    results: list[AssetEntry] = []

    def _walk(d: Path, depth: int):
        if depth > MAX_DEPTH:
            return
        try:
            entries = list(d.iterdir())
        except (PermissionError, OSError):
            return
        for entry in entries:
            if entry.name in SKIP_DIRS:
                continue
            if entry.is_dir():
                _walk(entry, depth + 1)
                continue
            if not entry.is_file():
                continue
            if not entry.name.lower().endswith(".md"):
                continue

            try:
                size = entry.stat().st_size
            except OSError:
                continue

            rel = str(entry.relative_to(root)).replace("\\", "/")
            persp, bucket = _classify(rel, entry.name)
            preview = _preview(entry)
            results.append(AssetEntry(
                path=rel,
                perspective=persp,
                size_bytes=size,
                preview=preview,
                bucket=bucket,
            ))

    _walk(root, 0)
    results.sort(key=lambda a: a.path)
    return results


def group_by_perspective(assets: list[AssetEntry]) -> dict[str, list[dict]]:
    """API 응답 편의용: perspective별로 그룹핑."""
    out: dict[str, list[dict]] = {"planner": [], "developer": [], "user": []}
    for a in assets:
        if a.perspective in out:
            out[a.perspective].append(asdict(a))
    return out


def summarize(assets: list[AssetEntry]) -> dict:
    """총계 + 버킷별 카운트."""
    total = len(assets)
    by_persp: dict[str, int] = {}
    by_bucket: dict[str, int] = {}
    total_bytes = 0
    for a in assets:
        by_persp[a.perspective] = by_persp.get(a.perspective, 0) + 1
        by_bucket[a.bucket] = by_bucket.get(a.bucket, 0) + 1
        total_bytes += a.size_bytes
    return {
        "total": total,
        "totalBytes": total_bytes,
        "byPerspective": by_persp,
        "byBucket": dict(sorted(by_bucket.items(), key=lambda x: -x[1])),
    }
