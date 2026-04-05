import os
import json
from datetime import date, timedelta
from pathlib import Path
from fastapi import WebSocket
from watchfiles import awatch


def get_log_dir() -> Path:
    """활성 프로젝트의 .aiops/ 경로를 반환. 없으면 폴백."""
    from services.project_swap import get_active_project

    active = get_active_project()
    if active and active.get("repoPath"):
        aiops_dir = Path(active["repoPath"]) / ".aiops"
        if aiops_dir.exists() or active["repoPath"]:
            return aiops_dir

    return Path(os.getenv("LOG_DIR", os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")))


def get_categories() -> list[str]:
    """활성 프로젝트의 .aiops/ 하위 디렉토리를 동적 스캔"""
    log_dir = get_log_dir()
    if not log_dir.exists():
        return []
    return [d.name for d in log_dir.iterdir() if d.is_dir()]


async def read_log_file(category: str, target_date: str) -> list[dict]:
    """특정 날짜의 JSONL 파일 읽기"""
    log_dir = get_log_dir()
    file_path = log_dir / category / f"{target_date}.jsonl"

    if not file_path.exists():
        return []

    lines = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                try:
                    lines.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return lines


def read_all_logs(category: str, days: int = 7, limit: int = 100) -> list[dict]:
    """최근 N일간 전체 로그 읽기 (최신순, limit 적용)"""
    log_dir = get_log_dir()
    cat_dir = log_dir / category

    if not cat_dir.exists():
        return []

    lines = []
    today = date.today()
    for i in range(days):
        d = today - timedelta(days=i)
        file_path = cat_dir / f"{d.isoformat()}.jsonl"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            lines.append(json.loads(line))
                        except json.JSONDecodeError:
                            pass

    lines.sort(key=lambda x: x.get("ts", ""), reverse=True)
    return lines[:limit]


_SYSTEM_PREFIXES = ("<task-notification>", "<system-reminder>", "<command-name>", "<local-command")


def compute_prompt_stats() -> dict:
    """프롬프트 통계를 메모리에서 계산 (전체 + 사용자만 구분)"""
    raw = read_all_logs("prompts", days=90, limit=10000)
    user_prompts = [p for p in raw if not p.get("prompt", "").lstrip().startswith(_SYSTEM_PREFIXES)]
    system_prompts = [p for p in raw if p.get("prompt", "").lstrip().startswith(_SYSTEM_PREFIXES)]
    today_str = date.today().isoformat()

    total = len(raw)
    user_total = len(user_prompts)
    system_total = len(system_prompts)
    today_count = sum(1 for p in user_prompts if p.get("ts", "").startswith(today_str))
    avg_tokens = round(sum(p.get("tokens", 0) for p in user_prompts) / user_total, 1) if user_total > 0 else 0

    repo_counts: dict[str, int] = {}
    for p in user_prompts:
        repo = p.get("repo", "unknown")
        repo_counts[repo] = repo_counts.get(repo, 0) + 1

    by_repo = sorted([{"repo": k, "cnt": v} for k, v in repo_counts.items()], key=lambda x: -x["cnt"])

    return {
        "total": total,
        "userTotal": user_total,
        "systemTotal": system_total,
        "today": today_count,
        "avgTokens": avg_tokens,
        "byRepo": by_repo,
    }


def compute_hook_stats() -> dict:
    """Hook 통계를 메모리에서 계산"""
    all_hooks = read_all_logs("hooks", days=30, limit=10000)

    total = len(all_hooks)
    success = sum(1 for h in all_hooks if h.get("exit", -1) == 0)
    failed = total - success
    success_rate = round(success / total * 100, 1) if total > 0 else 0

    return {
        "total": total,
        "success": success,
        "failed": failed,
        "successRate": success_rate,
    }


async def watch_log_files(clients: list[WebSocket]):
    """로그 디렉토리를 감시하고, 새 줄이 추가되면 WebSocket으로 push"""
    log_dir = get_log_dir()

    # 동적 카테고리 디렉토리 생성
    for cat in ["hooks", "prompts", "workflow"]:
        (log_dir / cat).mkdir(parents=True, exist_ok=True)

    file_sizes: dict[str, int] = {}

    today = date.today().isoformat()
    for cat_dir in log_dir.iterdir():
        if cat_dir.is_dir():
            for jsonl_file in cat_dir.glob("*.jsonl"):
                file_sizes[str(jsonl_file)] = jsonl_file.stat().st_size

    async for changes in awatch(log_dir):
        for change_type, changed_path in changes:
            changed_path = str(changed_path)

            if not changed_path.endswith(".jsonl"):
                continue

            prev_size = file_sizes.get(changed_path, 0)
            try:
                current_size = os.path.getsize(changed_path)
            except OSError:
                continue

            if current_size > prev_size:
                with open(changed_path, "r", encoding="utf-8") as f:
                    f.seek(prev_size)
                    new_lines = f.read()

                file_sizes[changed_path] = current_size
                category = Path(changed_path).parent.name

                for line in new_lines.strip().split("\n"):
                    if line:
                        try:
                            data = json.loads(line)
                            msg = json.dumps({"category": category, **data}, ensure_ascii=False)
                            for ws in clients.copy():
                                try:
                                    await ws.send_text(msg)
                                except Exception:
                                    clients.remove(ws)
                        except json.JSONDecodeError:
                            pass
