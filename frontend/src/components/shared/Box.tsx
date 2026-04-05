import { C } from '../../constants/colors';
import type { ReactNode } from 'react';

interface BoxProps {
  title: string;
  children: ReactNode;
}

export function Box({ title, children }: BoxProps) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
