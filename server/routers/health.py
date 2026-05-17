from datetime import date
from fastapi import APIRouter, Depends
from middleware.auth import get_current_user
from services.log_store import read_log_file, AIOPS_MODE
from services.project_swap import get_active_project, get_active_project_async

router = APIRouter()


@router.get("/mode")
async def mode():
    """현재 운영 모드를 반환한다 (공개 엔드포인트 — 인증 불필요).
    프론트엔드 부트스트랩이 로그인 화면 표시 여부를 결정할 때 사용한다."""
    return {"mode": AIOPS_MODE, "auth_required": AIOPS_MODE == "saas"}


@router.get("/health")
async def health(user: dict = Depends(get_current_user)):
    tenant_id = user["tenant_id"]
    today = date.today().isoformat()
    hooks = await read_log_file("hooks", today, tenant_id=tenant_id)
    prompts = await read_log_file("prompts", today, tenant_id=tenant_id)
    workflow = await read_log_file("workflow", today, tenant_id=tenant_id)

    total_hooks = len(hooks)
    success_hooks = sum(1 for h in hooks if h.get("exit") == 0)
    failed_hooks = total_hooks - success_hooks
    success_rate = round((success_hooks / total_hooks * 100), 1) if total_hooks > 0 else 0

    if AIOPS_MODE == "saas":
        active_project = await get_active_project_async(tenant_id=tenant_id)
    else:
        active_project = get_active_project()

    # 워크플로우 준수율 계산
    workflow_steps = {}
    for w in workflow:
        wf_name = w.get("workflow", "")
        if wf_name not in workflow_steps:
            workflow_steps[wf_name] = {"completed": 0, "total": w.get("total", 1)}
        workflow_steps[wf_name]["completed"] = max(
            workflow_steps[wf_name]["completed"], w.get("stepNum", 0)
        )

    workflow_compliance = 0
    if workflow_steps:
        rates = [s["completed"] / s["total"] * 100 for s in workflow_steps.values() if s["total"] > 0]
        workflow_compliance = round(sum(rates) / len(rates), 1) if rates else 0

    return {
        "status": "ok",
        "activeProject": active_project,
        "hooks": {
            "total": total_hooks,
            "success": success_hooks,
            "failed": failed_hooks,
            "successRate": success_rate,
        },
        "prompts": {
            "total": len(prompts),
            "avgTokens": round(sum(p.get("tokens", 0) for p in prompts) / len(prompts), 1) if prompts else 0,
        },
        "workflow": {
            "compliance": workflow_compliance,
        },
        "recentActivity": hooks[-5:][::-1] if hooks else [],
    }
