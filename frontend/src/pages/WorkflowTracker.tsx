// 워크플로우 — /logs/workflow 체크포인트로 8단계 진행도 표시.
import { useApi } from '../hooks/useApi';
import { Icon } from '../ui/Icon';
import { Box, EmptyState } from '../ui/primitives';
import { hhmm } from '../lib/format';
import type { WorkflowCheckpoint } from '../types';

const WORKFLOW_STEPS = [
  { step: '1. 코드 작성', id: 'code-written' },
  { step: '2. 문서 생성 (7종)', id: 'docs-generated' },
  { step: '3. 인수인계 (HANDOFF.md)', id: 'handoff-created' },
  { step: '4. 테스트 (3 시나리오)', id: 'tests-running' },
  { step: '5. 테스트 피드백 반영', id: 'feedback-applied' },
  { step: '6. 사용자 검증', id: 'user-verified' },
  { step: '7. PR → Codex 리뷰', id: 'pr-review' },
  { step: '8. 보안 리뷰 → 머지', id: 'security-merge' },
];

export function WorkflowTracker() {
  const { data: checkpoints } = useApi<WorkflowCheckpoint[]>('/logs/workflow', []);

  const completed = new Set(checkpoints.map((c) => c.step));
  const maxStep = checkpoints.length > 0 ? Math.max(...checkpoints.map((c) => c.stepNum)) : 0;

  const steps = WORKFLOW_STEPS.map((ws, i) => {
    const stepNum = i + 1;
    let status: 'done' | 'active' | 'pending' = 'pending';
    if (completed.has(ws.id)) status = 'done';
    else if (checkpoints.length > 0 && stepNum === maxStep + 1) status = 'active';
    const cp = checkpoints.find((c) => c.step === ws.id);
    return { ...ws, status, time: cp ? hhmm(cp.ts) : '—' };
  });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="workflow" size={18} />워크플로우</h1>
          <div className="page-sub">기능 개발 8단계 진행도 · {completed.size}/{WORKFLOW_STEPS.length} 완료</div>
        </div>
      </div>

      <Box title="현재 워크플로우: 기능 개발">
        {steps.map((s, i) => (
          <div key={s.id} className={`steprow ${s.status === 'active' ? 'active' : ''}`}>
            <span className={`stepnum ${s.status === 'done' ? 'done' : s.status === 'active' ? 'active' : ''}`}>
              {s.status === 'done' ? '✓' : s.status === 'active' ? '▶' : String(i + 1)}
            </span>
            <span className="steprow-label" style={{ color: s.status === 'pending' ? 'var(--text-dim)' : 'var(--text)' }}>{s.step}</span>
            <span className="steprow-time">{s.time}</span>
          </div>
        ))}
      </Box>

      {checkpoints.length === 0 ? (
        <EmptyState
          icon="workflow"
          title="아직 워크플로우 체크포인트가 없습니다"
          desc="Hook이 워크플로우 단계를 기록하면 여기에 진행도가 표시됩니다."
        />
      ) : (
        <div className="alert alert-warning">
          <strong>단계 건너뜀 감지</strong> — 문서 생성 없이 테스트로 넘어가거나, 테스트 없이 PR을 만들면 여기 경고가 표시됩니다.
        </div>
      )}
    </>
  );
}
