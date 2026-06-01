"""
RAG — 지식 문서(assets) → 청크 색인 → 어휘 검색 → BYOK LLM 합성.

설계:
- 검색은 **어휘 기반(TF-IDF)** 이라 임베딩/키/벡터 확장 없이 항상 동작(데모 신뢰성, SQLite/PG 공통).
- LLM 합성(answer)만 BYOK 키 필요 — 없으면 검색 결과(출처)만 반환.
- 청크는 assets에서 재색인으로 생성. 추후 DocChunk에 embedding 컬럼 추가 시 벡터 검색으로 슬롯인.

목적: 생성된 지식 문서를 "AI가 다음 작업에 읽는 컨텍스트"로 되먹이는 루프의 검색 계층.
"""
from __future__ import annotations

import math
import re
from collections import Counter

from sqlalchemy import delete, func, select

from models.db_models import DocChunk
from services.database import session_scope
from services.db import list_assets

_WORD = re.compile(r"[a-z0-9_]+", re.IGNORECASE)
_HANGUL = re.compile(r"[가-힣]+")
_TARGET = 900   # 청크 목표 길이(문자)
_MIN = 40       # 너무 짧은 조각 버림


def _tokenize(text: str) -> list[str]:
    """검색 토큰: 영문/숫자/식별자는 단어 단위, 한글은 char-bigram.
    한글 조사 문제(예: '프로젝트는' vs '프로젝트')를 bigram 중첩으로 흡수한다."""
    text = text.lower()
    out = _WORD.findall(text)
    for run in _HANGUL.findall(text):
        if len(run) <= 2:
            out.append(run)
        else:
            out.extend(run[i:i + 2] for i in range(len(run) - 1))
    return out


def _chunk_markdown(text: str) -> list[tuple[str, str]]:
    """마크다운을 헤딩/문단 경계로 ~_TARGET 길이 청크로 분할. (heading, content) 리스트."""
    chunks: list[tuple[str, str]] = []
    cur_heading = ""
    buf: list[str] = []
    buflen = 0

    def flush():
        nonlocal buf, buflen
        if buf:
            c = "\n".join(buf).strip()
            if len(c) >= _MIN or not chunks:
                chunks.append((cur_heading, c))
        buf = []
        buflen = 0

    for line in text.splitlines():
        if re.match(r"^#{1,6}\s", line):
            flush()
            cur_heading = line.lstrip("#").strip()
            buf = [line]
            buflen = len(line)
            continue
        buf.append(line)
        buflen += len(line) + 1
        if buflen >= _TARGET and line.strip() == "":
            flush()
    flush()
    return chunks


async def reindex(tenant_id: str, project_name: str) -> dict:
    """활성 프로젝트의 assets(.md)를 청크로 재색인. 기존 청크 교체."""
    assets = await list_assets(tenant_id, project_name)
    rows = []
    for a in assets:
        content = (a.get("content") or "").strip()
        path = a.get("path") or ""
        if not content:
            continue
        for i, (heading, chunk) in enumerate(_chunk_markdown(content)):
            rows.append({
                "tenant_id": tenant_id, "project_name": project_name, "path": path,
                "heading": heading or None, "chunk_index": i, "content": chunk,
            })
    async with session_scope() as s:
        await s.execute(delete(DocChunk).where(
            DocChunk.tenant_id == tenant_id, DocChunk.project_name == project_name))
        for r in rows:
            s.add(DocChunk(**r))
    return {"chunks": len(rows), "assets": len(assets), "project": project_name}


async def count_chunks(tenant_id: str, project_name: str) -> int:
    async with session_scope() as s:
        n = (await s.execute(
            select(func.count()).select_from(DocChunk).where(
                DocChunk.tenant_id == tenant_id, DocChunk.project_name == project_name)
        )).scalar_one()
    return int(n or 0)


async def _load_chunks(tenant_id: str, project_name: str) -> list[dict]:
    async with session_scope() as s:
        rows = (await s.execute(
            select(DocChunk).where(
                DocChunk.tenant_id == tenant_id, DocChunk.project_name == project_name)
        )).scalars().all()
    return [{"path": r.path, "heading": r.heading, "content": r.content} for r in rows]


async def retrieve(tenant_id: str, project_name: str, query: str, k: int = 6) -> list[dict]:
    """어휘 TF-IDF 검색. top-K 청크 반환(키 불필요)."""
    chunks = await _load_chunks(tenant_id, project_name)
    if not chunks:
        return []
    docs_tokens = [_tokenize(c["content"] + " " + (c["heading"] or "")) for c in chunks]
    n_docs = len(chunks)
    df: Counter = Counter()
    for toks in docs_tokens:
        for t in set(toks):
            df[t] += 1

    qset = set(_tokenize(query))
    qlow = query.lower().strip()
    scored = []
    for c, toks in zip(chunks, docs_tokens):
        if not toks:
            continue
        tf = Counter(toks)
        score = 0.0
        for t in qset:
            if t in tf:
                idf = math.log((n_docs + 1) / (df[t] + 0.5))
                score += (1 + math.log(tf[t])) * idf
        if len(qlow) >= 4 and qlow in c["content"].lower():
            score += 2.0  # 정확 구절 보너스
        if score > 0:
            scored.append((score, c))
    scored.sort(key=lambda x: -x[0])

    out = []
    for score, c in scored[:k]:
        snippet = re.sub(r"\s+", " ", c["content"]).strip()
        out.append({
            "path": c["path"], "heading": c["heading"],
            "snippet": snippet[:300], "content": c["content"], "score": round(score, 3),
        })
    return out


def _strip_content(sources: list[dict]) -> list[dict]:
    return [{k: v for k, v in s.items() if k != "content"} for s in sources]


_SYS = (
    "당신은 프로젝트 지식 베이스 도우미입니다. 아래 '문서 발췌'만을 근거로 한국어로 답하세요. "
    "발췌에 답이 없으면 '문서에서 찾지 못했습니다'라고 정직하게 말하세요. 추측 금지. "
    "근거가 된 발췌를 문장 끝에 [번호]로 표기하세요."
)


async def answer(tenant_id: str, project_name: str, query: str,
                 provider_name: str = "anthropic", k: int = 6) -> dict:
    """검색 + BYOK LLM 합성. 키 없으면 LLMNotConfigured (라우터가 검색결과만 반환)."""
    sources = await retrieve(tenant_id, project_name, query, k)
    if not sources:
        total = await count_chunks(tenant_id, project_name)
        msg = ("색인된 문서가 없습니다. '색인 갱신'을 먼저 실행하세요." if total == 0
               else f"질문과 관련된 내용을 문서에서 찾지 못했습니다. (색인 {total}개 청크)")
        return {"answer": None, "sources": [], "message": msg}
    from services import managed_llm

    ctx = "\n\n".join(
        f"[{i+1}] ({s['path']}{' · ' + s['heading'] if s['heading'] else ''})\n{s['content']}"
        for i, s in enumerate(sources)
    )
    prompt = f"질문: {query}\n\n문서 발췌:\n{ctx}"
    text = await managed_llm.complete(
        tenant_id, prompt, system=_SYS, max_tokens=1200, provider_pref=provider_name)
    return {"answer": text.strip(), "sources": _strip_content(sources),
            "provider": managed_llm.MANAGED_PROVIDER}
