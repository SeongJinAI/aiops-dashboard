import { C } from '../../constants/colors';
import { R, T } from '../../constants/design';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}

export function StatCard({ label, value, color = C.text, sub }: StatCardProps) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: R.md,
      padding: 'var(--s-sm, 8px) var(--s-md, 10px)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: T.h1, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: T.sm, color: C.dim, marginTop: 2 }}>{label}</div>
      {sub !== undefined && (
        <div style={{ fontSize: T.xs, color: C.dim, marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}


interface StatGridProps {
  columns?: number;
  children: React.ReactNode;
}

export function StatGrid({ columns = 4, children }: StatGridProps) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
      gap: 'var(--s-sm, 6px)',
    }}>
      {children}
    </div>
  );
}
