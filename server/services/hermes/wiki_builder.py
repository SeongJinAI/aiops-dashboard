"""
Hermes — 위키 빌더.

입력: catalog (perspective별 자산 리스트)
처리: perspective별로 자산 내용 요약 묶음을 만들고 Claude API에 챕터 작성 요청
출력: {planner, developer, user} 각각 마크다운 챕터

자산 본문은 토큰 절약을 위해 각 파일당 PER_FILE_PREVIEW_CHARS만 포함.
한 perspective의 총 입력이 MAX_PROMPT_CHARS를 초과하면 자산을 잘라낸다 (중요도 = bucket 우선).
"""
import os
from pathlib import Path
from typing import Iterable

from .catalog import AssetEntry
from .llm_client import complete


# 한 파일당 본문에서 추출할 최대 글자 (앞부분)
PER_FILE_PREVIEW_CHARS = 2000

# 한 perspective의 최종 프롬프트가 가질 수 있는 최대 글자 (대략)
MAX_PROMPT_CHARS = 90_000

# perspective별 시스템 프롬프트 + 챕터 템플릿
PERSPECTIVE_BRIEF: dict[str, dict[str, str]] = {
    "planner": {
        "title": "기획자 챕터",
        "audience": "프로젝트 PM·기획자",
        "sections": (
            "1. 프로젝트 한 줄 정의\n"
            "2. 비전과 도메인 맥락\n"
            "3. 핵심 사용자 시나리오 Top 3\n"
            "4. 주요 의사결정 기록\n"
            "5. 진행 상황 (로드맵 / 마일스톤)\n"
            "6. 성공 지표 (있으면)"
        ),
    },
    "developer": {
        "title": "개발자 챕터",
        "audience": "이 코드베이스에 합류하는 개발자",
        "sections": (
            "1. 기술 스택 (한 표)\n"
            "2. 시스템 아키텍처 / 핵심 도메인\n"
            "3. 도메인 규칙 요약 (예외처리·코드스타일·테스트·워크플로우)\n"
            "4. 에이전트·스킬 활용 가이드\n"
            "5. 주요 이슈 / 아키텍처 의사결정 (insights)\n"
            "6. 알려진 트러블슈팅 (issues, hotfix)\n"
            "7. 인프라 / 배포 / 데이터 흐름"
        ),
    },
    "user": {
        "title": "사용자 챕터",
        "audience": "이 시스템의 최종 사용자(또는 기능 활용자)",
        "sections": (
            "1. 빠른 시작 (가장 짧은 경로)\n"
            "2. 핵심 기능 사용법 (도메인별)\n"
            "3. 자주 묻는 질문 (FAQ)\n"
            "4. 슬래시 명령·도구 활용 가이드\n"
            "5. 트러블슈팅 매트릭스"
        ),
    },
}


def _read_file_preview(repo_path: str, rel_path: str) -> str:
    """파일 앞 PER_FILE_PREVIEW_CHARS만 읽기. 실패 시 빈 문자열."""
    full = Path(repo_path) / rel_path
    try:
        with open(full, "r", encoding="utf-8", errors="ignore") as f:
            return f.read(PER_FILE_PREVIEW_CHARS)
    except Exception:
        return ""


def _build_corpus(repo_path: str, assets: list[AssetEntry], budget: int) -> tuple[str, int]:
    """자산들의 본문을 모아 corpus 문자열로. 토큰 budget(char 기준) 초과 시 잘라냄.

    반환: (corpus, 실제 포함된 파일 수)
    """
    lines: list[str] = []
    total = 0
    included = 0
    for a in assets:
        body = _read_file_preview(repo_path, a.path)
        if not body:
            continue
        block = f"\n\n---\n## {a.path}  (bucket={a.bucket})\n\n{body.strip()}\n"
        if total + len(block) > budget:
            # 다음 자산은 너무 길면 스킵
            continue
        lines.append(block)
        total += len(block)
        included += 1
    return "".join(lines), included


def _build_prompt(
    project_name: str,
    perspective: str,
    corpus: str,
) -> tuple[str, str]:
    """perspective에 맞는 system + user 프롬프트 생성."""
    brief = PERSPECTIVE_BRIEF[perspective]
    system = (
        f"당신은 프로젝트 '{project_name}'의 위키를 작성하는 Hermes Agent입니다. "
        f"독자: {brief['audience']}. "
        "제공된 마크다운 자산들을 종합하여 한국어로 명료하고 구조적인 한 챕터를 작성하세요. "
        "추측하지 말고 자산 안에 있는 근거만 사용하세요. 자료가 부족하면 해당 섹션은 비워두거나 '(자료 없음)'으로 표시하세요. "
        "출력은 순수 마크다운만, 코드펜스(```) 감싸지 마세요."
    )
    user = (
        f"# {brief['title']} 작성 요청\n\n"
        f"## 목표 챕터 구조\n{brief['sections']}\n\n"
        f"## 작성 지침\n"
        f"- 각 섹션 제목은 H2(`##`)로 시작\n"
        f"- 표·목록 적극 활용\n"
        f"- 출처가 되는 파일명을 각 항목 끝에 `(출처: 파일경로)`로 표기\n"
        f"- 최대 길이 약 6000자 (긴 인용 대신 요약)\n"
        f"- 결론·총평 같은 빈 섹션 추가 금지\n\n"
        f"## 자산\n{corpus}"
    )
    return system, user


async def build_chapter(
    project_name: str,
    perspective: str,
    repo_path: str,
    assets: list[AssetEntry],
    tenant_id: str | None = None,
) -> tuple[str, int]:
    """한 perspective의 챕터 마크다운을 생성.

    반환: (마크다운 본문, 입력에 실제 포함된 파일 수)
    """
    if perspective not in PERSPECTIVE_BRIEF:
        raise ValueError(f"unknown perspective: {perspective}")

    if not assets:
        return f"## (자료 없음)\n\n해당 관점의 자산이 발견되지 않았습니다.", 0

    corpus, included = _build_corpus(repo_path, assets, budget=MAX_PROMPT_CHARS)
    if not corpus:
        return f"## (자료 없음)\n\n자산은 있으나 본문을 읽을 수 없었습니다.", 0

    system, user = _build_prompt(project_name, perspective, corpus)
    md = await complete(prompt=user, system=system, max_tokens=8000, tenant_id=tenant_id)
    return md, included


async def build_all_perspectives(
    project_name: str,
    repo_path: str,
    grouped_assets: dict[str, list[AssetEntry]],
    tenant_id: str | None = None,
) -> dict[str, dict]:
    """3 perspective 위키를 모두 생성. 직렬 호출 (rate limit 안전).

    반환: {"planner": {"content": ..., "input_count": N}, ...}
    """
    out: dict[str, dict] = {}
    for persp in ("planner", "developer", "user"):
        assets = grouped_assets.get(persp, [])
        content, included = await build_chapter(project_name, persp, repo_path, assets, tenant_id=tenant_id)
        out[persp] = {"content": content, "input_count": included}
    return out
