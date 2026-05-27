import { C } from '../constants/colors';
import { T } from '../constants/design';
import { TABS } from '../constants/repos';

interface TabBarProps {
  tab: string;
  setTab: (key: string) => void;
}

export function TabBar({ tab, setTab }: TabBarProps) {
  return (
    <div style={{
      display: "flex", gap: 0,
      padding: "0 var(--s-lg, 16px)",
      borderBottom: `1px solid ${C.border}`, overflow: "auto",
      background: C.surface,
    }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          padding: "var(--s-sm, 8px) var(--s-md, 12px)",
          fontSize: T.body,
          cursor: "pointer",
          background: "transparent",
          color: tab === t.key ? C.accent : C.dim,
          border: "none",
          borderBottom: `2px solid ${tab === t.key ? C.accent : "transparent"}`,
          fontWeight: tab === t.key ? 600 : 400,
          transition: "all 0.15s",
          fontFamily: "inherit",
          whiteSpace: "nowrap",
        }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
