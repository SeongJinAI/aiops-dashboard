#!/usr/bin/env python3
"""테스트용 JSONL 모의 로그 생성 스크립트"""
import json
import os
import random
from datetime import datetime, timedelta
from pathlib import Path

LOG_DIR = Path(os.getenv("LOG_DIR", os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")))
TODAY = datetime.now().strftime("%Y-%m-%d")

HOOKS = [
    ("PreCompact", "generate_handoff.py"),
    ("PreToolUse", "check-docs.sh"),
    ("PromptLog", "log-prompt.sh"),
    ("PreToolUse", "validate-permissions.sh"),
    ("Stop", "save-session.sh"),
]

PROMPTS = [
    ("UserService에 페이지네이션 추가해", "project", 12),
    ("local 환경에서 사용자관리 테스트해줘", "test", 18),
    ("CLAUDE.md 참고해서 관련 문서 생성해", "project", 15),
    ("직원 목록 조회 API 만들어", "project", 8),
    ("부서별 통계 API 만들어줘", "project", 10),
    ("에러 핸들링 미들웨어 추가해", "project", 14),
    ("Swagger 테스트 실행해", "test", 6),
    ("로그인 API 테스트해줘", "test", 9),
    ("기능명세서 업데이트해", "project", 11),
    ("인증 토큰 만료 처리 추가해", "project", 16),
]

WORKFLOW_STEPS = [
    ("code-written", "코드 작성"),
    ("docs-generated", "문서 생성 (7종)"),
    ("handoff-created", "인수인계 (HANDOFF.md)"),
    ("tests-running", "테스트 (3 시나리오)"),
    ("feedback-applied", "테스트 피드백 반영"),
    ("user-verified", "사용자 검증"),
    ("pr-review", "PR → Codex 리뷰"),
    ("security-merge", "보안 리뷰 → 머지"),
]


def generate_hooks(count=30):
    lines = []
    base_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)

    for i in range(count):
        hook, script = random.choice(HOOKS)
        exit_code = 0 if random.random() > 0.08 else 2
        ts = base_time + timedelta(minutes=i * 3, seconds=random.randint(0, 59))
        entry = {
            "ts": ts.isoformat(),
            "hook": hook,
            "script": script,
            "exit": exit_code,
            "ms": random.randint(5, 500),
            "repo": random.choice(["project", "test", "knowledge"]),
            "session": f"sess_{random.randint(1000, 9999)}",
        }
        if exit_code != 0:
            entry["error"] = random.choice(["문서 누락", "권한 위반", "스크립트 타임아웃"])
        lines.append(json.dumps(entry, ensure_ascii=False))

    return lines


def generate_prompts(count=15):
    lines = []
    base_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0)

    for i in range(count):
        prompt_text, repo, tokens = random.choice(PROMPTS)
        ts = base_time + timedelta(minutes=i * 5, seconds=random.randint(0, 59))
        entry = {
            "ts": ts.isoformat(),
            "prompt": prompt_text,
            "repo": repo,
            "tokens": tokens + random.randint(-3, 10),
            "session": f"sess_{random.randint(1000, 9999)}",
        }
        lines.append(json.dumps(entry, ensure_ascii=False))

    return lines


def generate_workflow():
    lines = []
    base_time = datetime.now().replace(hour=9, minute=30, second=0, microsecond=0)
    current_step = random.randint(3, 5)

    for i in range(current_step):
        step_id, step_name = WORKFLOW_STEPS[i]
        ts = base_time + timedelta(minutes=i * 8)
        entry = {
            "ts": ts.isoformat(),
            "workflow": "feature-dev",
            "step": step_id,
            "stepNum": i + 1,
            "total": len(WORKFLOW_STEPS),
            "repo": "project",
            "session": f"sess_{random.randint(1000, 9999)}",
        }
        lines.append(json.dumps(entry, ensure_ascii=False))

    return lines


def main():
    for cat in ["hooks", "prompts", "workflow"]:
        (LOG_DIR / cat).mkdir(parents=True, exist_ok=True)

    # Hook 로그
    hook_file = LOG_DIR / "hooks" / f"{TODAY}.jsonl"
    hook_lines = generate_hooks(30)
    with open(hook_file, "w", encoding="utf-8") as f:
        f.write("\n".join(hook_lines) + "\n")
    print(f"Generated {len(hook_lines)} hook logs -> {hook_file}")

    # 프롬프트 로그
    prompt_file = LOG_DIR / "prompts" / f"{TODAY}.jsonl"
    prompt_lines = generate_prompts(15)
    with open(prompt_file, "w", encoding="utf-8") as f:
        f.write("\n".join(prompt_lines) + "\n")
    print(f"Generated {len(prompt_lines)} prompt logs -> {prompt_file}")

    # 워크플로우 로그
    workflow_file = LOG_DIR / "workflow" / f"{TODAY}.jsonl"
    workflow_lines = generate_workflow()
    with open(workflow_file, "w", encoding="utf-8") as f:
        f.write("\n".join(workflow_lines) + "\n")
    print(f"Generated {len(workflow_lines)} workflow logs -> {workflow_file}")

    print("\nDone! Mock logs generated successfully.")


if __name__ == "__main__":
    main()
