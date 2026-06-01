"""
지식 챗 (RAG) API — 생성된 지식 문서를 검색해 AI가 답하는 "프로젝트 작업 메모리".

- GET  /api/chat/status : 활성 프로젝트의 색인 청크 수
- POST /api/chat/index  : assets(.md) → 청크 재색인
- POST /api/chat/query  : 질문 → 검색(어휘) + BYOK LLM 합성(선택, 키 없으면 검색결과만)

JWT(대시보드) 또는 X-API-Key(로컬 skill) 둘 다 허용.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth import get_tenant_flexible
from services import rag
from services.errors import E, err
from services.llm.base import LLMNotConfigured
from services.usage import QuotaExceeded
from services.project_swap import get_active_project_async
from services.rate_limit import limiter

router = APIRouter()


async def _active_project(tenant_id: str) -> str:
    proj = await get_active_project_async(tenant_id)
    name = (proj or {}).get("name") if proj else None
    if not name:
        raise err(E.NO_ACTIVE_PROJECT)
    return name


@router.get("/status")
async def status(user: dict = Depends(get_tenant_flexible)):
    proj = await get_active_project_async(user["tenant_id"])
    name = (proj or {}).get("name") if proj else None
    chunks = await rag.count_chunks(user["tenant_id"], name) if name else 0
    return {"project": name, "chunks": chunks}


@router.post("/index")
@limiter.limit("10/minute")
async def index(request: Request, user: dict = Depends(get_tenant_flexible)):
    name = await _active_project(user["tenant_id"])
    return await rag.reindex(user["tenant_id"], name)


class QueryRequest(BaseModel):
    question: str
    provider: str = "anthropic"


@router.post("/query")
@limiter.limit("30/minute")
async def query(request: Request, body: QueryRequest,
                user: dict = Depends(get_tenant_flexible)):
    name = await _active_project(user["tenant_id"])
    q = (body.question or "").strip()
    if not q:
        raise err(E.EMPTY_QUESTION)
    try:
        return await rag.answer(user["tenant_id"], name, q, body.provider or "anthropic")
    except LLMNotConfigured:
        # 키 없으면 검색 결과만 (합성 생략) — 핵심 검색은 키 없이도 동작
        sources = await rag.retrieve(user["tenant_id"], name, q)
        return {
            "answer": None,
            "sources": rag._strip_content(sources),
            "message": "LLM 키가 없어 검색 결과만 표시합니다. 연결 설정에서 키를 등록하면 요약 답변을 생성합니다.",
        }
    except QuotaExceeded as e:
        # 쿼터 초과 — 검색 결과는 그대로 제공(합성만 생략)
        sources = await rag.retrieve(user["tenant_id"], name, q)
        return {"answer": None, "sources": rag._strip_content(sources), "message": str(e)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise err(E.LLM_PROVIDER, f"LLM 제공자 호출에 실패했습니다 (재시도 가능): {e}")
