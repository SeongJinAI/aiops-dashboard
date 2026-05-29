"""
Coach API — Track → Wikify → Coach 가치 사슬의 3번째 단계.

- GET  /api/coach/report   : 룰 기반 협업 점수 + 인사이트 (LLM 불필요, 항상 동작)
- POST /api/coach/summary  : 등록된 BYOK provider로 코치 브리핑 생성 (선택)
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from middleware.auth import get_current_user
from services import coach as coach_svc
from services.llm.base import LLMNotConfigured
from services.rate_limit import limiter

router = APIRouter()


@router.get("/report")
async def coach_report(user: dict = Depends(get_current_user)):
    return await coach_svc.generate_report(user["tenant_id"])


class SummaryRequest(BaseModel):
    provider: str = "anthropic"


@router.post("/summary")
@limiter.limit("20/minute")
async def coach_summary(
    request: Request,
    body: SummaryRequest | None = None,
    user: dict = Depends(get_current_user),
):
    provider = (body.provider if body else "anthropic") or "anthropic"
    try:
        return await coach_svc.synthesize(user["tenant_id"], provider)
    except LLMNotConfigured as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # provider/네트워크 오류 — 사용자에게 사유 전달
        raise HTTPException(status_code=502, detail=f"코치 브리핑 생성 실패: {e}")
