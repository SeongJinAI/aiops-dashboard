import { C } from '../constants/colors';
import { Box } from '../components/shared/Box';
import { useApi } from '../hooks/useApi';
import type { WorkflowCheckpoint } from '../types';

const WORKFLOW_STEPS = [
  { step: "1. 코드 작성", id: "code-written" },
  { step: "2. 문서 생성 (7종)", id: "docs-generated" },
  { step: "3. 인수인계 (HANDOFF.md)", id: "handoff-created" },
  { step: "4. 테스트 (3 시나리오)", id: "tests-running" },
  { step: "5. 테스트 피드백 반영", id: "feedback-applied" },
  { step: "6. 사용자 검증", id: "user-verified" },
  { step: "7. PR → Codex 리뷰", id: "pr-review" },
  { step: "8. 보안 리뷰 → 머지", id: "security-merge" },
];

export function WorkflowTracker() {
  const { data: checkpoints } = useApi<WorkflowCheckpoint[]>('/logs/workflow', []);

  const completedSteps = new Set(checkpoints.map(c => c.step));
  const maxStep = checkpoints.length > 0
    ? Math.max(...checkpoints.map(c => c.stepNum))
    : 0;

  const steps = WORKFLOW_STEPS.map((ws, i) => {
    const stepNum = i + 1;
    let status: "done" | "active" | "pending" = "pending";

    if (completedSteps.has(ws.id)) {
      status = "done";
    } else if (checkpoints.length > 0 && stepNum === maxStep + 1) {
      status = "active";
    }

    const checkpoint = checkpoints.find(c => c.step === ws.id);
    const time = checkpoint
      ? new Date(checkpoint.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : "-";

    return { ...ws, status, time };
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Box title="현재 워크플로우: 기능 개발">
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: s.status === "active" ? `${C.accent}08` : "transparent", border: `1px solid ${s.status === "active" ? C.accent + "40" : C.border}`, borderRadius: 6, marginBottom: 4 }}>
            <span style={{
              width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600,
              background: s.status === "done" ? C.green : s.status === "active" ? C.accent : C.surfaceAlt,
              color: s.status === "pending" ? C.dim : "#fff",
            }}>{s.status === "done" ? "\u2713" : s.status === "active" ? "\u25B6" : String(i + 1)}</span>
            <span style={{ fontSize: 13, flex: 1, color: s.status === "pending" ? C.dim : C.text }}>{s.step}</span>
            <span style={{ fontSize: 11, color: C.dim }}>{s.time}</span>
          </div>
        ))}
      </Box>
      <div style={{ background: `${C.orange}08`, border: `1px solid ${C.orange}30`, borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.orange, marginBottom: 6 }}>단계 건너뜀 감지</div>
        <div style={{ fontSize: 12, color: C.dim }}>문서 생성 없이 테스트로 넘어가거나, 테스트 없이 PR을 만들면 여기 경고가 표시됩니다.</div>
      </div>
    </div>
  );
}
