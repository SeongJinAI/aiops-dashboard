"""
Hermes — 위키 챕터간 변경 요약 (LLM 없이 룰 기반).

목표: 한국어 한 줄 요약 + 헤딩 변화 + 글자수 변화. 발표 데모 시 "v1→v2 무엇이 바뀌었나"
시각화에 사용.
"""
import re

_HEADING_RE = re.compile(r"^(#{1,3})\s+(.+?)\s*$", re.MULTILINE)


def _extract_headings(md: str) -> list[tuple[int, str]]:
    """(level, text) 목록. 챕터 내부 H2/H3 위주."""
    if not md:
        return []
    return [(len(m.group(1)), m.group(2).strip()) for m in _HEADING_RE.finditer(md)]


def _normalize(t: str) -> str:
    """비교용 정규화 — 공백/구두점 무시."""
    return re.sub(r"[\s\W_]+", "", t).lower()


def compute_chapter_diff(old: str, new: str) -> dict:
    """챕터 마크다운 두 버전의 차이를 분석한다.

    반환 dict:
      - char_delta: int   (new - old 글자수)
      - added: list[str]  (새로 등장한 H2/H3 제목)
      - removed: list[str] (사라진 H2/H3 제목)
      - kept: int          (양쪽에 공통으로 있는 헤딩 수)
      - summary: str       (한국어 요약 한 줄)
    """
    old_headings = _extract_headings(old)
    new_headings = _extract_headings(new)

    old_norm = {_normalize(t): t for _, t in old_headings if t}
    new_norm = {_normalize(t): t for _, t in new_headings if t}

    added = [new_norm[k] for k in new_norm if k not in old_norm]
    removed = [old_norm[k] for k in old_norm if k not in new_norm]
    kept = len(set(old_norm.keys()) & set(new_norm.keys()))

    char_delta = len(new) - len(old)

    parts: list[str] = []
    if not old:
        parts.append("최초 생성")
    else:
        if char_delta > 0:
            parts.append(f"+{char_delta:,}자")
        elif char_delta < 0:
            parts.append(f"{char_delta:,}자")
        if added:
            parts.append(f"+{len(added)}개 섹션")
        if removed:
            parts.append(f"-{len(removed)}개 섹션")
        if not added and not removed and char_delta == 0:
            parts.append("변동 없음")
        elif not added and not removed:
            parts.append("내용만 갱신")

    return {
        "char_delta": char_delta,
        "added": added[:10],
        "removed": removed[:10],
        "kept": kept,
        "summary": " · ".join(parts) if parts else "변경 없음",
    }


def compose_run_summary(per_persp: dict[str, dict]) -> str:
    """run 전체의 diff_summary 문자열 — perspective별 한 줄씩."""
    lines: list[str] = []
    for persp in ("planner", "developer", "user"):
        d = per_persp.get(persp)
        if not d:
            continue
        lines.append(f"{persp}: {d.get('summary', '')}")
    return " | ".join(lines)
