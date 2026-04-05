"""
로그 수집 API — SaaS 모드에서 외부 Hook이 HTTP로 로그를 전송하는 엔드포인트
"""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from services.auth import verify_api_key
from services.db import insert_log, insert_logs_batch

router = APIRouter()


class IngestRequest(BaseModel):
    tenant_id: str
    category: str
    payload: dict


class IngestBatchRequest(BaseModel):
    tenant_id: str
    logs: list[dict]  # 각 항목: {"category": str, "payload": dict}


def _authenticate(api_key: str, requested_tenant: str) -> str:
    """API 키를 검증하고 tenant_id가 일치하는지 확인한다."""
    tenant_id = verify_api_key(api_key)
    if not tenant_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")
    if tenant_id != requested_tenant:
        raise HTTPException(status_code=403, detail="API 키와 tenant_id가 일치하지 않습니다")
    return tenant_id


@router.post("/ingest")
async def ingest_log(req: IngestRequest, x_api_key: str = Header()):
    tenant_id = _authenticate(x_api_key, req.tenant_id)

    await insert_log(tenant_id, req.category, req.payload)

    # EventBus가 있으면 publish (Phase 3에서 연결)
    try:
        from services.event_bus import event_bus
        await event_bus.publish(tenant_id, req.category, req.payload)
    except (ImportError, AttributeError):
        pass

    return {"status": "ok", "count": 1}


@router.post("/ingest/batch")
async def ingest_batch(req: IngestBatchRequest, x_api_key: str = Header()):
    tenant_id = _authenticate(x_api_key, req.tenant_id)

    await insert_logs_batch(tenant_id, req.logs)

    # EventBus가 있으면 각 로그를 publish
    try:
        from services.event_bus import event_bus
        for log in req.logs:
            await event_bus.publish(tenant_id, log["category"], log["payload"])
    except (ImportError, AttributeError):
        pass

    return {"status": "ok", "count": len(req.logs)}
