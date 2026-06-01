"""에러 레지스트리 — ERR_* 코드 + HTTP 상태 + 사용자 메시지를 한곳에서 중앙 관리(SSOT).

문자열 리터럴을 라우터에 직접 박지 말고 여기서 정의한 항목으로 raise한다.
  raise err(E.NO_ACTIVE_PROJECT)
  raise err(E.LLM_PROVIDER, f"...: {e}")   # 메시지 보강 시

상태코드는 예외 4계층 원칙을 따른다: 요청검증 400 / 인증·인가 401·402·403 /
비즈니스 404·409 / 외부의존·시스템 503·500.
"""
from fastapi import HTTPException


class E:
    # 요청 검증 (400)
    NO_ACTIVE_PROJECT = ("ERR_NO_ACTIVE_PROJECT", 400,
                         "활성 프로젝트가 없습니다. 사용자 머신에서 install.sh를 실행하면 자동 등록됩니다.")
    LOCAL_NO_REPO_PATH = ("ERR_LOCAL_NO_REPO_PATH", 400, "로컬 모드: repoPath가 비어 있습니다.")
    INVALID_PERSPECTIVE = ("ERR_INVALID_PERSPECTIVE", 400,
                           "perspective는 planner/developer/user 중 하나여야 합니다.")
    EMPTY_QUESTION = ("ERR_EMPTY_QUESTION", 400, "질문이 비어 있습니다.")
    # 인증 / 인가
    UNAUTHORIZED = ("ERR_UNAUTHORIZED", 401, "인증이 필요합니다 (JWT 또는 X-API-Key).")
    PREMIUM_REQUIRED = ("ERR_PREMIUM_REQUIRED", 402, "프리미엄(Pro) 구독이 필요한 기능입니다.")
    QUOTA_EXCEEDED = ("ERR_QUOTA_EXCEEDED", 429,
                      "이번 달 AI 사용량을 모두 사용했습니다. Pro로 업그레이드하거나 본인 LLM 키를 등록하세요.")
    # 비즈니스 / 상태
    NOT_FOUND_RUN = ("ERR_NOT_FOUND_RUN", 404, "해당 실행(run)을 찾을 수 없습니다.")
    NOT_FOUND_WIKI_VERSION = ("ERR_NOT_FOUND_WIKI_VERSION", 404, "해당 버전을 찾을 수 없습니다.")
    RUN_IN_PROGRESS = ("ERR_RUN_IN_PROGRESS", 409, "이미 진행 중인 업데이트가 있습니다.")
    # 외부 의존 / 시스템
    LLM_NOT_CONFIGURED = ("ERR_LLM_NOT_CONFIGURED", 400,
                          "LLM API 키가 설정되지 않았습니다. 연결 설정에서 키를 등록하세요.")
    LLM_PROVIDER = ("ERR_LLM_PROVIDER", 503, "LLM 제공자 호출에 실패했습니다 (재시도 가능).")


def err(entry: tuple, detail: str | None = None) -> HTTPException:
    """레지스트리 항목으로 HTTPException 생성. detail로 사용자 메시지 보강 가능."""
    _code, status, msg = entry
    return HTTPException(status_code=status, detail=detail or msg)
