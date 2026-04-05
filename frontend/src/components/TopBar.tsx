import { C } from '../constants/colors';
import type { Project } from '../types';

interface TopBarProps {
  activeProject: Project;
  onLogout?: () => void;
  email?: string | null;
}

export function TopBar({ activeProject, onLogout, email }: TopBarProps) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "12px 24px", borderBottom: `1px solid ${C.border}`,
      background: C.surface,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>AI OPS</div>
        <div style={{ fontSize: 11, color: C.dim, padding: "2px 8px", border: `1px solid ${C.border}`, borderRadius: 4 }}>
          v0.1
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 11, color: C.dim }}>활성:</span>
          <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{activeProject.name}</span>
        </div>
        {onLogout && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 12, paddingLeft: 12, borderLeft: `1px solid ${C.border}` }}>
            {email && <span style={{ fontSize: 11, color: C.dim }}>{email}</span>}
            <button
              onClick={onLogout}
              style={{
                fontSize: 11, color: C.dim, background: 'none', border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '3px 10px', cursor: 'pointer',
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
