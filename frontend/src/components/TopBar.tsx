import { C } from '../constants/colors';
import { R, T, type Density } from '../constants/design';
import type { Project } from '../types';
import { ConnectionStatus } from './ConnectionStatus';

interface TopBarProps {
  activeProject: Project;
  onLogout?: () => void;
  email?: string | null;
  density: Density;
  onDensityChange: (d: Density) => void;
}

const DENSITY_LABELS: Record<Density, string> = {
  compact: '콤팩트',
  normal: '일반',
  roomy: '넓게',
};

export function TopBar({ activeProject, onLogout, email, density, onDensityChange }: TopBarProps) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "var(--s-sm, 8px) var(--s-lg, 16px)",
      borderBottom: `1px solid ${C.border}`,
      background: C.surface,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 'var(--s-md, 12px)' }}>
        <div style={{ fontSize: T.h2, fontWeight: 700, color: C.accent, letterSpacing: -0.3 }}>AI OPS</div>
        <div style={{ fontSize: T.xs, color: C.dim, padding: "1px 6px", border: `1px solid ${C.border}`, borderRadius: R.sm }}>
          v0.1
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 'var(--s-md, 12px)' }}>
        <ConnectionStatus />

        <DensityToggle density={density} onChange={onDensityChange} />

        <div style={{ display: "flex", alignItems: "center", gap: 'var(--s-sm, 6px)' }}>
          <span style={{ fontSize: T.xs, color: C.dim }}>활성:</span>
          <span style={{ fontSize: T.body, color: C.text, fontWeight: 600 }}>{activeProject.name}</span>
        </div>
        {onLogout && (
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--s-sm, 6px)', marginLeft: 'var(--s-sm, 8px)', paddingLeft: 'var(--s-sm, 8px)', borderLeft: `1px solid ${C.border}` }}>
            {email && <span style={{ fontSize: T.xs, color: C.dim }}>{email}</span>}
            <button
              onClick={onLogout}
              style={{
                fontSize: T.xs, color: C.dim, background: 'none', border: `1px solid ${C.border}`,
                borderRadius: R.sm, padding: '2px 8px', cursor: 'pointer',
              }}
            >
              로그아웃
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


function DensityToggle({ density, onChange }: { density: Density; onChange: (d: Density) => void }) {
  const opts: Density[] = ['compact', 'normal', 'roomy'];
  return (
    <div style={{
      display: 'flex',
      border: `1px solid ${C.border}`,
      borderRadius: R.sm,
      overflow: 'hidden',
    }} title="화면 밀도 조절">
      {opts.map((d) => {
        const active = d === density;
        return (
          <button
            key={d}
            onClick={() => onChange(d)}
            style={{
              padding: '2px 8px',
              fontSize: T.xs,
              background: active ? C.accent : 'transparent',
              color: active ? '#fff' : C.dim,
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: active ? 600 : 400,
            }}
          >
            {DENSITY_LABELS[d]}
          </button>
        );
      })}
    </div>
  );
}
