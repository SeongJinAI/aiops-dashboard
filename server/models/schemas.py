from pydantic import BaseModel
from typing import Optional


class HookLog(BaseModel):
    ts: str
    hook: str
    script: str
    exit: int
    ms: int
    repo: str
    error: Optional[str] = None
    session: Optional[str] = None


class PromptLog(BaseModel):
    ts: str
    prompt: str
    repo: str
    tokens: int
    session: Optional[str] = None


class WorkflowCheckpoint(BaseModel):
    ts: str
    workflow: str
    step: str
    stepNum: int
    total: int
    repo: str
    session: Optional[str] = None


class Project(BaseModel):
    name: str
    url: str
    domain: str
    repoPath: str = ""
    status: str = "ready"


class SwapRequest(BaseModel):
    name: str
    repoPath: str
    gitUrl: str = ""


# --- SaaS 수집 모델 ---

class IngestRequest(BaseModel):
    tenant_id: str
    category: str
    payload: dict


class IngestBatchRequest(BaseModel):
    tenant_id: str
    logs: list[dict]
