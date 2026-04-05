import { C } from '../constants/colors';
import { TABS } from '../constants/repos';

interface TabBarProps {
  tab: string;
  setTab: (key: string) => void;
}

export function TabBar({ tab, setTab }: TabBarProps) {
  return (
    <div style={{
      display: "flex", gap: 0, padding: "0 24px",
      borderBottom: `1px solid ${C.border}`, overflow: "auto",
      background: C.surface,
    }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          padding: "10px 16px", fontSize: 13, cursor: "pointer",
          background: "transparent", color: tab === t.key ? C.accent : C.dim,
          border: "none", borderBottom: `2px solid ${tab === t.key ? C.accent : "transparent"}`,
          fontWeight: tab === t.key ? 600 : 400,
          transition: "all 0.15s", fontFamily: "inherit",
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
