"""
프롬프트 라이브러리 — 공유 풀 기여(opt-in) 프롬프트를 LLM이 주제별 템플릿으로 증류.

프라이버시 원칙:
- 개인 원본 프롬프트는 타인에게 노출하지 않는다. 저장하는 건 익명·일반화된 템플릿뿐.
- 수집 corpus는 secret_masker로 자동 마스킹 후 LLM에 전달.
- share_opt_in=True 인 테넌트의 프롬프트만 corpus에 포함.
"""
from __future__ import annotations

import json

from sqlalchemy import delete, select

from models.db_models import Log, PromptTemplate, Subscription
from services.database import session_scope
from services.secret_masker import mask_text

_SYSTEM_PREFIXES = (
    "<task-notification>", "<system-reminder>", "<command-name>", "<local-command",
)
_MAX_CORPUS = 250          # LLM에 보낼 최대 프롬프트 수
_MAX_PROMPT_LEN = 400      # 프롬프트당 최대 길이


async def _opted_in_tenants() -> list[str]:
    async with session_scope() as s:
        rows = (await s.execute(
            select(Subscription.tenant_id).where(Subscription.share_opt_in.is_(True))
        )).scalars().all()
    return list(rows)


async def collect_corpus(extra_tenant_id: str | None = None) -> list[str]:
    """공유 동의한 테넌트의 사용자 프롬프트를 마스킹해 수집.
    extra_tenant_id: 호출자(아직 opt-in 행이 없을 수 있는)를 항상 포함."""
    tenants = set(await _opted_in_tenants())
    if extra_tenant_id:
        tenants.add(extra_tenant_id)
    if not tenants:
        return []

    async with session_scope() as s:
        rows = (await s.execute(
            select(Log.payload)
            .where(Log.tenant_id.in_(tenants), Log.category == "prompts")
            .order_by(Log.id.desc())
            .limit(4000)
        )).scalars().all()

    seen: set[str] = set()
    corpus: list[str] = []
    for raw in rows:
        try:
            text = (json.loads(raw).get("prompt") or "").strip()
        except Exception:
            continue
        if not text or text.startswith(_SYSTEM_PREFIXES) or len(text) < 12:
            continue
        masked, _ = mask_text(text)
        masked = masked[:_MAX_PROMPT_LEN].strip()
        key = masked[:80].lower()
        if key in seen:
            continue
        seen.add(key)
        corpus.append(masked)
        if len(corpus) >= _MAX_CORPUS:
            break
    return corpus


_SYSTEM = (
    "당신은 개발자들이 AI 코딩 어시스턴트에게 보낸 프롬프트들을 분석해, 누구나 재사용할 수 있는 "
    "고품질 프롬프트 템플릿을 만드는 큐레이터입니다. 입력은 여러 개발자의 익명·마스킹된 프롬프트 모음입니다. "
    "이를 주제별로 군집화하고, 각 주제에서 가장 효과적인 패턴을 뽑아 일반화된 템플릿으로 재작성하세요.\n"
    "규칙:\n"
    "- 특정 프로젝트명·인명·비밀값은 [프로젝트], [파일명], [언어] 같은 placeholder로 일반화.\n"
    "- 템플릿 body는 바로 복사해 쓸 수 있는 완성형 프롬프트. 한국어.\n"
    "- 8~12개. 반드시 JSON 배열로만 응답. 다른 텍스트 금지.\n"
    '- 각 항목: {"topic": "주제(짧게)", "title": "한 줄 제목", "body": "재사용 프롬프트 본문", "tags": ["태그1","태그2"]}'
)


def _parse_templates(text: str) -> list[dict]:
    """LLM 응답에서 JSON 배열을 견고하게 추출."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("```", 2)[1] if "```" in t[3:] else t.lstrip("`")
        t = t.removeprefix("json").strip()
    start, end = t.find("["), t.rfind("]")
    if start == -1 or end == -1 or end <= start:
        return []
    try:
        items = json.loads(t[start:end + 1])
    except Exception:
        return []
    out = []
    for it in items:
        if not isinstance(it, dict):
            continue
        body = (it.get("body") or "").strip()
        title = (it.get("title") or "").strip()
        if not body or not title:
            continue
        tags = it.get("tags") or []
        if isinstance(tags, list):
            tags = ",".join(str(x).strip() for x in tags if str(x).strip())
        out.append({
            "topic": (it.get("topic") or "기타").strip()[:60],
            "title": title[:120],
            "body": body,
            "tags": str(tags)[:200],
        })
    return out


async def distill(tenant_id: str, provider_name: str = "anthropic") -> dict:
    """기여 corpus → LLM 증류 → 글로벌 템플릿 교체. BYOK 키 필요."""
    from services.llm.registry import get_provider

    corpus = await collect_corpus(extra_tenant_id=tenant_id)
    if len(corpus) < 5:
        return {"count": 0, "corpus": len(corpus),
                "message": "증류할 프롬프트가 부족합니다. 공유 풀 기여(opt-in)를 켜고 활동이 쌓이면 다시 시도하세요."}

    provider = get_provider(provider_name, tenant_id=tenant_id)
    numbered = "\n".join(f"{i+1}. {p}" for i, p in enumerate(corpus))
    prompt = f"다음은 {len(corpus)}개의 익명 프롬프트입니다.\n\n{numbered}"
    text = await provider.complete(prompt, system=_SYSTEM, max_tokens=4000)
    templates = _parse_templates(text)
    if not templates:
        return {"count": 0, "corpus": len(corpus), "message": "템플릿 생성에 실패했습니다(LLM 응답 파싱 불가). 다시 시도하세요."}

    async with session_scope() as s:
        await s.execute(delete(PromptTemplate))
        for t in templates:
            s.add(PromptTemplate(
                topic=t["topic"], title=t["title"], body=t["body"],
                tags=t["tags"], example_count=len(corpus),
            ))
    return {"count": len(templates), "corpus": len(corpus)}


async def list_templates(topic: str | None = None) -> list[dict]:
    stmt = select(PromptTemplate).order_by(PromptTemplate.topic, PromptTemplate.id)
    if topic:
        stmt = stmt.where(PromptTemplate.topic == topic)
    async with session_scope() as s:
        rows = (await s.execute(stmt)).scalars().all()
    return [
        {
            "id": r.id, "topic": r.topic, "title": r.title, "body": r.body,
            "tags": [t for t in r.tags.split(",") if t], "exampleCount": r.example_count,
        }
        for r in rows
    ]
