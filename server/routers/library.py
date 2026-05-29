"""
프롬프트 라이브러리 API (프리미엄 전용).

- GET  /api/library/templates : 주제별 공유 템플릿 열람 (프리미엄)
- POST /api/library/distill    : 기여 corpus를 LLM으로 증류해 템플릿 갱신 (프리미엄 + BYOK)

브라우징(list)은 LLM 불필요. 증류(distill)만 BYOK 키 필요.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth import require_premium
from services import prompt_library
from services.llm.base import LLMNotConfigured
from services.rate_limit import limiter

router = APIRouter()


@router.get("/templates")
async def templates(topic: str | None = None, user: dict = Depends(require_premium)):
    items = await prompt_library.list_templates(topic)
    topics = sorted({t["topic"] for t in items})
    return {"templates": items, "topics": topics, "count": len(items)}


class DistillRequest(BaseModel):
    provider: str = "anthropic"


@router.post("/distill")
@limiter.limit("6/minute")
async def distill(request: Request, body: DistillRequest | None = None,
                  user: dict = Depends(require_premium)):
    provider = (body.provider if body else "anthropic") or "anthropic"
    try:
        return await prompt_library.distill(user["tenant_id"], provider)
    except LLMNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"라이브러리 증류 실패: {e}")
