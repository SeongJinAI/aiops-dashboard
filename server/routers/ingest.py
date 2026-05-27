"""
로그 수집 API — SaaS 모드에서 외부 Hook이 HTTP로 로그를 전송하는 엔드포인트
"""
from fastapi import APIRouter, Header, HTTPException, Request
from pydantic import BaseModel
from services.auth import verify_api_key, verify_api_key_db
from services.db import insert_log, insert_logs_batch, DB_PATH
from services.secret_masker import mask_payload
from services.rate_limit import limiter
from services.misunderstanding_detector import detect_from_prompt, detect_from_hook

router = APIRouter()


async def _maybe_record_misunderstanding(tenant_id: str, category: str, payload: dict) -> None:
    """prompts/hooks 카테고리는 오해 감지 후 misunderstandings로 자동 기록.

    실패해도 ingest 자체는 영향 없도록 모든 예외를 삼킨다.
    """
    try:
        detected: dict | None = None
        if category == "prompts":
            detected = await detect_from_prompt(tenant_id, payload, str(DB_PATH))
        elif category == "hooks":
            detected = await detect_from_hook(tenant_id, payload, str(DB_PATH))
        if not detected:
            return
        await insert_log(tenant_id, "misunderstandings", detected)
        try:
            from services.event_bus import event_bus
            await event_bus.publish(tenant_id, "misunderstandings", detected)
        except Exception:
            pass
    except Exception:
        # 감지 실패는 노이즈 — 본 ingest를 막지 않는다
        pass


class IngestRequest(BaseModel):
    tenant_id: str | None = None  # 명시하지 않으면 API 키에서 추출
    category: str
    payload: dict


class IngestBatchRequest(BaseModel):
    tenant_id: str | None = None
    logs: list[dict]  # 각 항목: {"category": str, "payload": dict}


async def _authenticate(api_key: str, requested_tenant: str | None) -> str:
    """API 키를 검증하고 tenant_id를 반환한다. DB 우선, env 폴백."""
    tenant_id = await verify_api_key_db(api_key)
    if not tenant_id:
        tenant_id = verify_api_key(api_key)  # env 기반 폴백
    if not tenant_id:
        raise HTTPException(status_code=401, detail="유효하지 않은 API 키입니다")
    if requested_tenant and tenant_id != requested_tenant:
        raise HTTPException(status_code=403, detail="API 키와 tenant_id가 일치하지 않습니다")
    return tenant_id


@router.post("/ingest")
@limiter.limit("300/minute")
async def ingest_log(request: Request, req: IngestRequest, x_api_key: str = Header()):
    tenant_id = await _authenticate(x_api_key, req.tenant_id)

    # 시크릿 마스킹 (DB 저장 전, EventBus publish 전)
    safe_payload, found = mask_payload(req.payload)
    if found:
        safe_payload = {**safe_payload, "_masked_secrets": found}

    await insert_log(tenant_id, req.category, safe_payload)

    try:
        from services.event_bus import event_bus
        await event_bus.publish(tenant_id, req.category, safe_payload)
    except (ImportError, AttributeError):
        pass

    # 오해 자동 감지 (prompts/hooks만)
    await _maybe_record_misunderstanding(tenant_id, req.category, safe_payload)

    return {"status": "ok", "count": 1, "masked": found}


@router.post("/ingest/batch")
@limiter.limit("60/minute")
async def ingest_batch(request: Request, req: IngestBatchRequest, x_api_key: str = Header()):
    tenant_id = await _authenticate(x_api_key, req.tenant_id)

    # 각 로그 payload 마스킹
    safe_logs = []
    all_masked: set[str] = set()
    for log in req.logs:
        safe_p, found = mask_payload(log.get("payload", {}))
        if found:
            safe_p = {**safe_p, "_masked_secrets": found}
            all_masked.update(found)
        safe_logs.append({**log, "payload": safe_p})

    await insert_logs_batch(tenant_id, safe_logs)

    try:
        from services.event_bus import event_bus
        for log in safe_logs:
            await event_bus.publish(tenant_id, log["category"], log["payload"])
    except (ImportError, AttributeError):
        pass

    # 오해 자동 감지 (prompts/hooks만)
    for log in safe_logs:
        await _maybe_record_misunderstanding(tenant_id, log["category"], log["payload"])

    return {"status": "ok", "count": len(safe_logs), "masked": sorted(all_masked)}
