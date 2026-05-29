import os
from datetime import date
from fastapi import APIRouter, Depends, Request
from middleware.auth import get_current_user
from services.log_store import read_log_file, AIOPS_MODE
from services.project_swap import get_active_project, get_active_project_async

router = APIRouter()


def resolve_public_url(request: Request) -> str:
    """대시보드의 공개 URL을 도출한다.

    우선순위:
      1) AIOPS_PUBLIC_URL 환경변수 (운영 배포 시 명시)
      2) X-Forwarded-Proto + X-Forwarded-Host (리버스 프록시 뒤)
      3) request.url.scheme + Host 헤더 (로컬/직접 접속)

    hook 설치 명령에 박힐 URL이므로 사용자 머신의 curl이 도달 가능해야 한다.
    Vite dev origin(localhost:5173)이 아니라 백엔드 자신의 공개 주소가 들어가야
    프론트가 안 떠 있어도 hook이 동작한다.
    """
    override = os.getenv("AIOPS_PUBLIC_URL", "").strip().rstrip("/")
    if override:
        return override
    scheme = request.headers.get("X-Forwarded-Proto") or request.url.scheme
    host = (
        request.headers.get("X-Forwarded-Host")
        or request.headers.get("Host")
        or request.url.netloc
    )
    return f"{scheme}://{host}"


@router.get("/mode")
async def mode(request: Request):
    """현재 운영 모드 + 공개 URL을 반환한다 (인증 불필요).
    프론트엔드 부트스트랩이 로그인 분기와 Hook 설치 명령의 baseUrl로 사용한다."""
    return {
        "mode": AIOPS_MODE,
        "auth_required": AIOPS_MODE == "saas",
        "public_url": resolve_public_url(request),
    }


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
