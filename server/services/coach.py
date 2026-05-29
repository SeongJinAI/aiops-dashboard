"""
Coach — Track(수집) → Wikify(자산화) → Coach(코칭) 가치 사슬의 3번째 단계.

축적된 AI 협업 데이터(프롬프트 · Hook · 오해)를 분석해 실행 가능한 개선 제안과
협업 점수를 룰 기반(결정적, LLM 불필요)으로 생성한다. BYOK 키가 등록돼 있으면
LLM이 인사이트를 한국어 '코치 브리핑'으로 요약한다(선택, synthesize).

설계 의도:
- 핵심 가치(점수 + 인사이트)는 LLM 키 없이도 항상 동작한다 → 데모/무료 티어 신뢰성.
- 모든 제안은 "다음에 무엇을 하라"는 구체 액션을 포함한다 (능동 코칭).
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone

from services.log_store import (
    get_hook_stats,
    get_misunderstanding_stats,
    get_prompt_stats,
    read_all_logs_async,
)

# severity 우선순위 — 높을수록 먼저 노출
_SEVERITY_RANK = {"warn": 0, "suggest": 1, "good": 2, "info": 3}

_PATTERN_LABEL = {"rejection": "거부", "correction": "수정", "retry": "재시도"}


def _clamp(v: float, lo: float = 0, hi: float = 100) -> int:
    return int(max(lo, min(hi, round(v))))


def _grade(score: int) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 55:
        return "D"
    return "E"


def _insight(severity, category, title, detail, evidence="", action=None):
    return {
        "severity": severity,
        "category": category,
        "title": title,
        "detail": detail,
        "evidence": evidence,
        "action": action,
    }


async def generate_report(tenant_id: str) -> dict:
    """룰 기반 협업 리포트 — 점수 3종 + 인사이트 목록. LLM 호출 없음."""
    prompt_stats = await get_prompt_stats(tenant_id)
    hook_stats = await get_hook_stats(tenant_id)
    mis_stats = await get_misunderstanding_stats(tenant_id)
    mis_logs = await read_all_logs_async("misunderstandings", days=30, limit=2000, tenant_id=tenant_id)
    hook_logs = await read_all_logs_async("hooks", days=30, limit=2000, tenant_id=tenant_id)

    user_total = prompt_stats.get("userTotal", prompt_stats.get("total", 0)) or 0
    hook_total = hook_stats.get("total", 0) or 0
    mis_total = mis_stats.get("total", 0) or 0
    data_points = user_total + hook_total + mis_total

    # ── 점수 3종 (데이터 없는 항목은 overall 평균에서 제외) ──────────────────
    metrics = []

    # 1) 명확성 — 오해 빈도가 낮을수록 높음
    mis_rate_pct = (mis_total / user_total * 100) if user_total else 0
    if user_total >= 3:
        clarity = _clamp(100 - mis_rate_pct * 2)
        metrics.append({
            "key": "clarity", "label": "명확성", "value": clarity,
            "hint": "AI가 의도를 한 번에 이해한 정도 (오해 빈도 역산)",
        })

    # 2) 거버넌스 — Hook 통과율
    if hook_total > 0:
        gov = _clamp(hook_stats.get("successRate", 0))
        metrics.append({
            "key": "governance", "label": "거버넌스", "value": gov,
            "hint": "Hook(규칙) 통과율 — 차단 없이 진행한 비율",
        })

    # 3) 꾸준함 — 최근 14일 중 활동한 날의 비율
    daily = prompt_stats.get("daily", []) or []
    last14 = daily[-14:] if len(daily) >= 14 else daily
    active_days = sum(1 for d in last14 if (d.get("cnt", 0) or 0) > 0)
    window = len(last14) or 1
    if user_total >= 1:
        consistency = _clamp(active_days / window * 100)
        metrics.append({
            "key": "consistency", "label": "꾸준함", "value": consistency,
            "hint": f"최근 {window}일 중 {active_days}일 활동",
        })

    score = _clamp(sum(m["value"] for m in metrics) / len(metrics)) if metrics else 0
    low_data = data_points < 5

    # ── 인사이트 (조건부) ────────────────────────────────────────────────────
    insights: list[dict] = []

    # A. 오해/명확성
    if mis_total > 0:
        kw = Counter()
        for m in mis_logs:
            for k in (m.get("keywords") or []):
                if isinstance(k, str) and k.strip():
                    kw[k.strip()] += 1
        top_kw = ", ".join(f"'{k}'" for k, _ in kw.most_common(3))
        top_pat = mis_stats.get("byPattern", [{}])[0].get("pattern", "") if mis_stats.get("byPattern") else ""
        pat_label = _PATTERN_LABEL.get(top_pat, top_pat)
        if mis_rate_pct >= 12:
            sev = "warn"
        elif mis_rate_pct >= 5:
            sev = "suggest"
        else:
            sev = "info"
        insights.append(_insight(
            sev, "명확성",
            "AI에게 같은 의도를 반복 설명하고 있어요",
            f"최근 30일간 '{pat_label}' 등 오해가 {mis_total}건 감지됐습니다. "
            f"AI가 한 번에 이해하지 못해 다시 설명한 흔적입니다."
            + (f" 자주 등장한 신호: {top_kw}." if top_kw else ""),
            evidence=f"오해 {mis_total}건 · 사용자 프롬프트 {user_total}건 ({mis_rate_pct:.0f}%)",
            action="반복해서 막히는 규칙을 `.claude/CLAUDE.md` 또는 `.claude/rules/`에 명시하세요. "
                   "프로젝트 위키(Nova 에이전트)를 만들어 컨텍스트를 자산화하면 같은 설명을 다시 할 필요가 줄어듭니다.",
        ))
    elif user_total >= 10:
        insights.append(_insight(
            "good", "명확성",
            "AI가 의도를 잘 이해하고 있어요",
            f"사용자 프롬프트 {user_total}건 동안 오해로 분류된 재설명이 감지되지 않았습니다. "
            "지시가 명확하거나, 컨텍스트가 잘 갖춰져 있다는 신호입니다.",
            evidence=f"오해 0건 · 프롬프트 {user_total}건",
        ))

    # B. Hook 반복 차단 핫스팟
    blocked = Counter()
    for h in hook_logs:
        if (h.get("exit", 0) or 0) != 0:
            label = h.get("script") or h.get("hook") or "unknown"
            blocked[label] += 1
    if blocked:
        top_script, cnt = blocked.most_common(1)[0]
        if cnt >= 2:
            insights.append(_insight(
                "suggest", "거버넌스",
                "특정 Hook이 반복해서 차단되고 있어요",
                f"`{top_script}`가 {cnt}회 차단(exit≠0)됐습니다. 거버넌스 규칙을 AI가 모른 채 "
                "시도했다는 뜻입니다 — 규칙을 사전에 알려주면 막힘이 줄어듭니다.",
                evidence=f"{top_script} · {cnt}회 차단",
                action="해당 규칙의 핵심을 `CLAUDE.md` 상단이나 슬래시 명령 설명에 노출해, "
                       "AI가 시도 전에 규칙을 인지하도록 만드세요.",
            ))

    # C. Hook 통과율 평가
    if hook_total > 0:
        sr = hook_stats.get("successRate", 0)
        if sr >= 95:
            insights.append(_insight(
                "good", "거버넌스",
                f"Hook 통과율 {sr:.0f}% — 거버넌스가 안정적입니다",
                f"{hook_total}건의 Hook 실행 중 대부분이 차단 없이 통과했습니다. "
                "규칙과 실제 작업 흐름이 잘 정렬돼 있다는 신호입니다.",
                evidence=f"성공 {hook_stats.get('success', 0)} / 전체 {hook_total}",
            ))
        elif sr < 80:
            insights.append(_insight(
                "warn", "거버넌스",
                f"Hook 통과율이 {sr:.0f}%로 낮습니다",
                "차단이 잦다는 것은 AI의 시도와 거버넌스 규칙이 자주 충돌한다는 뜻입니다. "
                "규칙이 과하거나, AI가 규칙을 모르고 있을 수 있습니다.",
                evidence=f"실패 {hook_stats.get('failed', 0)} / 전체 {hook_total}",
                action="차단 로그(Hook 모니터)에서 가장 잦은 차단 사유를 확인하고, "
                       "규칙을 조정하거나 사전 컨텍스트로 노출하세요.",
            ))

    # D. 긴 프롬프트 비중
    buckets = {b.get("label"): b.get("cnt", 0) for b in (prompt_stats.get("lengthBuckets") or [])}
    long_cnt = buckets.get("1k-3k", 0) + buckets.get("3k+", 0)
    if user_total >= 5:
        long_pct = long_cnt / user_total * 100
        if long_pct >= 25:
            insights.append(_insight(
                "suggest", "효율",
                "긴 프롬프트 비중이 높아요",
                f"전체 프롬프트의 {long_pct:.0f}%가 1k 토큰 이상입니다(평균 {prompt_stats.get('avgTokens', 0)} 토큰). "
                "매번 비슷한 긴 맥락을 다시 설명하고 있을 가능성이 큽니다.",
                evidence=f"1k+ 프롬프트 {long_cnt}건 · 평균 {prompt_stats.get('avgTokens', 0)} 토큰",
                action="반복되는 지시는 슬래시 명령 · `CLAUDE.md` · 스니펫으로 정형화하세요. "
                       "토큰을 아끼고 결과 일관성이 올라갑니다.",
            ))

    # E. 주 활동 시간대 (자기 패턴 인식)
    hourly = prompt_stats.get("hourly", []) or []
    if hourly and sum(hourly) > 0:
        peak = max(range(len(hourly)), key=lambda i: hourly[i])
        band = hourly[peak] + (hourly[peak + 1] if peak + 1 < len(hourly) else 0)
        band_pct = band / sum(hourly) * 100
        insights.append(_insight(
            "info", "패턴",
            f"주 활동 시간대는 {peak:02d}시 전후입니다",
            f"전체 프롬프트의 {band_pct:.0f}%가 {peak:02d}~{(peak + 1) % 24:02d}시에 집중됩니다. "
            "집중이 잘 되는 시간대를 알면 어려운 작업을 이 시간에 배치할 수 있습니다.",
            evidence=f"피크 {peak:02d}시 · {hourly[peak]}건",
        ))

    # F. 최근 활동 추세
    if len(daily) >= 14:
        recent7 = sum(d.get("cnt", 0) for d in daily[-7:])
        prev7 = sum(d.get("cnt", 0) for d in daily[-14:-7])
        if prev7 > 0:
            delta = (recent7 - prev7) / prev7 * 100
            if abs(delta) >= 15:
                up = delta > 0
                insights.append(_insight(
                    "info", "패턴",
                    f"최근 7일 활동이 {'증가' if up else '감소'}했어요 ({delta:+.0f}%)",
                    f"직전 7일 {prev7}건 → 최근 7일 {recent7}건. "
                    + ("작업량이 늘고 있습니다." if up else "작업량이 줄었습니다 — 휴식이거나 다른 도구로 이동했을 수 있습니다."),
                    evidence=f"{prev7} → {recent7}건",
                ))

    insights.sort(key=lambda x: _SEVERITY_RANK.get(x["severity"], 9))

    # 헤드라인 — 가장 우선순위 높은 액션형 인사이트
    headline = "데이터가 더 쌓이면 맞춤 코칭이 정확해집니다."
    for ins in insights:
        if ins["severity"] in ("warn", "suggest") and ins.get("action"):
            headline = f"이번 주 가장 큰 개선 기회: {ins['title']}"
            break
    else:
        if score >= 80 and not low_data:
            headline = "지금 협업 흐름이 안정적입니다 — 자산화로 영향력을 키울 차례입니다."

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "score": score,
        "grade": _grade(score),
        "metrics": metrics,
        "insights": insights,
        "headline": headline,
        "dataPoints": data_points,
        "lowData": low_data,
        "counts": {
            "prompts": user_total,
            "hooks": hook_total,
            "misunderstandings": mis_total,
        },
    }


def _build_summary_prompt(report: dict) -> tuple[str, str]:
    """리포트 → (system, user_prompt). LLM 코치 브리핑용."""
    lines = [
        f"협업 점수: {report['score']}/100 (등급 {report['grade']})",
        f"데이터: 프롬프트 {report['counts']['prompts']}건 · "
        f"Hook {report['counts']['hooks']}건 · 오해 {report['counts']['misunderstandings']}건",
        "",
        "감지된 인사이트:",
    ]
    for i, ins in enumerate(report["insights"], 1):
        lines.append(f"{i}. [{ins['severity']}/{ins['category']}] {ins['title']}")
        lines.append(f"   - {ins['detail']}")
        if ins.get("evidence"):
            lines.append(f"   - 근거: {ins['evidence']}")
        if ins.get("action"):
            lines.append(f"   - 제안 액션: {ins['action']}")

    system = (
        "당신은 개발자의 AI 협업 코치입니다. 아래는 한 개발자의 AI 도구 사용 데이터에서 "
        "추출한 객관적 인사이트입니다. 이를 바탕으로 따뜻하지만 단도직입적인 한국어 코치 브리핑을 "
        "작성하세요. 칭찬할 점은 칭찬하고, 가장 중요한 개선 1~2가지에 집중해 '다음 한 걸음'을 "
        "구체적으로 제시하세요. 마크다운으로 5~8문장. 데이터에 없는 내용은 지어내지 마세요."
    )
    return system, "\n".join(lines)


async def synthesize(tenant_id: str, provider_name: str = "anthropic") -> dict:
    """등록된 BYOK provider로 코치 브리핑을 생성한다. 키 없으면 LLMNotConfigured."""
    from services.llm.registry import get_provider

    report = await generate_report(tenant_id)
    system, prompt = _build_summary_prompt(report)
    provider = get_provider(provider_name, tenant_id=tenant_id)
    text = await provider.complete(prompt, system=system, max_tokens=1200)
    return {
        "summary": text.strip(),
        "provider": provider.name,
        "model": provider.default_model,
        "score": report["score"],
        "generatedAt": report["generatedAt"],
    }
