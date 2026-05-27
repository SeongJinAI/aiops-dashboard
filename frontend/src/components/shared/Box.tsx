import { C } from '../../constants/colors';
import { R, T } from '../../constants/design';
import type { ReactNode } from 'react';

interface BoxProps {
  title: string;
  children: ReactNode;
  /** 우측 상단에 표시할 액션 (버튼, 토글 등) */
  action?: ReactNode;
}

export function Box({ title, children, action }: BoxProps) {
  return (
    <div style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: R.md,
      padding: 'var(--s-md, 12px)',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 'var(--s-sm, 8px)',
      }}>
        <div style={{ fontSize: T.h3, fontWeight: 600, color: C.text }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}
