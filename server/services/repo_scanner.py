"""
레포 스캐너 — 프로젝트/테스트/지식 레포에서 데이터를 직접 읽는다.
SaaS 모드에서는 로컬 파일시스템 접근이 불가하므로 빈 결과를 반환한다.
"""
import os
import subprocess
from pathlib import Path
from datetime import datetime
from services.log_store import AIOPS_MODE


PROJECT_REPO = os.getenv("PROJECT_REPO", "")
TEST_REPO = os.getenv("TEST_REPO", "")
GOVERNANCE_REPO = os.getenv("GOVERNANCE_REPO", "")
KNOWLEDGE_REPO = os.getenv("KNOWLEDGE_REPO", "")

_EMPTY_GIT_LOG: list[dict] = []
_EMPTY_GIT_STATS = {"totalCommits": 0, "currentBranch": "", "last7days": 0, "hotspots": []}
_EMPTY_DOCS = {"total": 0, "categories": {}, "files": []}
_EMPTY_TEST_RESULTS = {"total": 0, "passCount": 0, "passRate": 0, "environments": {}, "results": []}


def _run_git(repo_path: str, args: list[str]) -> str:
    """git 명령 실행 후 stdout 반환"""
    if not repo_path or not os.path.isdir(repo_path):
        return ""
    try:
        result = subprocess.run(
            ["git"] + args,
            cwd=repo_path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.stdout.strip()
    except Exception:
        return ""


# --- 프로젝트 레포: git log ---

def get_git_log(limit: int = 30) -> list[dict]:
    """최근 커밋 목록"""
    if AIOPS_MODE == "saas":
        return _EMPTY_GIT_LOG
    raw = _run_git(PROJECT_REPO, [
        "log", f"-{limit}",
        "--format=%H|%h|%s|%an|%ai|%D",
        "--no-merges"
    ])
    if not raw:
        return []

    commits = []
    for line in raw.split("\n"):
        parts = line.split("|", 5)
        if len(parts) >= 5:
            commits.append({
                "hash": parts[0],
                "short": parts[1],
                "message": parts[2],
                "author": parts[3],
                "date": parts[4],
                "refs": parts[5] if len(parts) > 5 else "",
            })
    return commits


def get_git_stats() -> dict:
    """커밋 통계"""
    if AIOPS_MODE == "saas":
        return _EMPTY_GIT_STATS
    total = _run_git(PROJECT_REPO, ["rev-list", "--count", "HEAD"])
    branch = _run_git(PROJECT_REPO, ["rev-parse", "--abbrev-ref", "HEAD"])

    # 최근 7일 커밋 수
    recent = _run_git(PROJECT_REPO, [
        "rev-list", "--count", "--since=7 days ago", "HEAD"
    ])

    # 변경이 많은 파일 top 10
    hotspot_raw = _run_git(PROJECT_REPO, [
        "log", "--since=30 days ago", "--format=", "--name-only"
    ])
    file_counts = {}
    for f in hotspot_raw.split("\n"):
        f = f.strip()
        if f:
            file_counts[f] = file_counts.get(f, 0) + 1
    hotspots = sorted(file_counts.items(), key=lambda x: -x[1])[:10]

    return {
        "totalCommits": int(total) if total.isdigit() else 0,
        "currentBranch": branch,
        "last7days": int(recent) if recent.isdigit() else 0,
        "hotspots": [{"file": f, "changes": c} for f, c in hotspots],
    }


# --- 문서 스캔 (지식 레포 + 프로젝트 레포) ---

# 디렉토리명 → 카테고리 매핑 (지식 레포 구조)
_DIR_CATEGORY = {
    "specs": "기능명세서",
    "architecture": "아키텍처",
    "manuals": "사용자매뉴얼",
    "errors": "에러코드",
    "troubleshooting": "트러블슈팅",
    "insights": "인사이트",
}


def _classify_doc(fname: str, parent_dir: str) -> str:
    """파일명 또는 상위 디렉토리로 카테고리 분류"""
    dir_name = os.path.basename(parent_dir)
    if dir_name in _DIR_CATEGORY:
        return _DIR_CATEGORY[dir_name]
    if "기능명세서" in fname:
        return "기능명세서"
    if "아키텍처" in fname:
        return "아키텍처"
    if "매뉴얼" in fname:
        return "사용자매뉴얼"
    if "ERROR" in fname or "에러" in fname:
        return "에러코드"
    if "트러블슈팅" in fname or "ISSUE" in fname:
        return "트러블슈팅"
    if "인사이트" in fname:
        return "인사이트"
    return "기타"


def _scan_dir(base_dir: str) -> list[dict]:
    """디렉토리 내 .md 파일 목록 반환"""
    if not base_dir or not os.path.isdir(base_dir):
        return []

    result = []
    for root, dirs, filenames in os.walk(base_dir):
        for fname in filenames:
            if not fname.endswith(".md") or fname == "README.md":
                continue

            fpath = os.path.join(root, fname)
            stat = os.stat(fpath)
            cat = _classify_doc(fname, root)

            result.append({
                "name": fname,
                "path": os.path.relpath(fpath, base_dir),
                "category": cat,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "size": stat.st_size,
            })
    return result


def scan_docs() -> dict:
    """지식 레포 + 프로젝트 레포의 문서 목록"""
    if AIOPS_MODE == "saas":
        return _EMPTY_DOCS
    files = []

    # 1) 지식 레포 스캔 (우선)
    if KNOWLEDGE_REPO:
        files.extend(_scan_dir(KNOWLEDGE_REPO))

    # 2) 프로젝트 레포 docs/ 스캔 (보조)
    if PROJECT_REPO:
        for candidate in ["src/docs", "docs"]:
            docs_dir = os.path.join(PROJECT_REPO, candidate)
            if os.path.isdir(docs_dir):
                files.extend(_scan_dir(docs_dir))
                break

    files.sort(key=lambda x: x["modified"], reverse=True)

    categories: dict[str, int] = {}
    for f in files:
        categories[f["category"]] = categories.get(f["category"], 0) + 1

    return {
        "total": len(files),
        "categories": categories,
        "files": files,
    }


# --- 테스트 레포: 결과 스캔 ---

def scan_test_results() -> dict:
    """테스트 레포의 results/ 디렉토리에서 테스트 결과 읽기"""
    if AIOPS_MODE == "saas":
        return _EMPTY_TEST_RESULTS
    results_dir = os.path.join(TEST_REPO, "results") if TEST_REPO else ""

    if not results_dir or not os.path.isdir(results_dir):
        return {"total": 0, "environments": {}, "results": []}

    results = []
    environments = {}

    for env_name in ["local", "dev", "prod"]:
        env_dir = os.path.join(results_dir, env_name)
        if not os.path.isdir(env_dir):
            continue

        date_dirs = sorted(
            [d for d in os.listdir(env_dir) if os.path.isdir(os.path.join(env_dir, d)) and d.startswith("20")],
            reverse=True
        )

        env_count = 0
        for date_dir in date_dirs:
            date_path = os.path.join(env_dir, date_dir)
            for fname in os.listdir(date_path):
                if not fname.endswith(".md"):
                    continue

                fpath = os.path.join(date_path, fname)
                stat = os.stat(fpath)

                # [완료] 태그로 성공/실패 판단
                status = "pass" if "[완료]" in fname else "unknown"

                results.append({
                    "name": fname.replace("[완료] ", ""),
                    "environment": env_name,
                    "date": date_dir,
                    "status": status,
                    "size": stat.st_size,
                    "path": os.path.relpath(fpath, results_dir),
                })
                env_count += 1

        environments[env_name] = env_count

    results.sort(key=lambda x: x["date"], reverse=True)

    total_pass = sum(1 for r in results if r["status"] == "pass")
    return {
        "total": len(results),
        "passCount": total_pass,
        "passRate": round(total_pass / len(results) * 100, 1) if results else 0,
        "environments": environments,
        "results": results,
    }
