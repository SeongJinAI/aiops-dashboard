// Nova UI 키트 primitives — 산출물 primitives.jsx를 TSX로 포팅.
// 모든 스타일은 styles/ui.css에 있고, 여기서는 마크업 + 동작만 담는다.
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

export type Tone =
  | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'purple' | 'cyan';
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

/* ---------- Button ---------- */

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: string;
}

export function Btn({
  children, variant = 'secondary', size = 'md', icon, className = '', type = 'button', ...rest
}: BtnProps) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className]
    .filter(Boolean).join(' ');
  return (
    <button className={cls} type={type} {...rest}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </button>
  );
}

interface IconBtnProps {
  icon: string;
  ariaLabel: string;
  onClick?: () => void;
  size?: number;
  className?: string;
  title?: string;
}

export function IconBtn({ icon, ariaLabel, onClick, size = 14, className = '', title }: IconBtnProps) {
  return (
    <button
      className={`btn btn-ghost btn-icon ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      type="button"
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/* ---------- Chip / StatusDot ---------- */

export function Chip({ children, tone = 'neutral', dot = false, className = '' }: {
  children: ReactNode; tone?: Tone; dot?: boolean; className?: string;
}) {
  return (
    <span className={`chip chip-${tone} ${dot ? 'chip-dot' : ''} ${className}`}>{children}</span>
  );
}

export function StatusDot({ tone = 'neutral' }: { tone?: StatusTone }) {
  return <span className={`statusdot statusdot-${tone}`} />;
}

/* ---------- Box (card) ---------- */

export function Box({ title, action, children, padding = true, className = '' }: {
  title?: ReactNode; action?: ReactNode; children?: ReactNode; padding?: boolean; className?: string;
}) {
  return (
    <section className={`box ${className}`}>
      {(title || action) && (
        <header className="box-head">
          {title && <h3 className="box-title">{title}</h3>}
          {action && <div className="box-action">{action}</div>}
        </header>
      )}
      <div className={padding ? 'box-body' : 'box-body box-body-flush'}>{children}</div>
    </section>
  );
}

/* ---------- Keyboard chips ---------- */

export function KbdChip({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Keys({ children }: { children: string[] }) {
  return (
    <span className="keys">
      {children.map((k, i) =>
        k === '·' || k === '+'
          ? <span className="keys-sep" key={i}>{k}</span>
          : <KbdChip key={i}>{k}</KbdChip>
      )}
    </span>
  );
}

/* ---------- Stat card ---------- */

export interface StatItem {
  id: string;
  label: string;
  value: string;
  delta?: string;
  trend?: 'up' | 'down' | 'neutral';
  spark?: number[] | null;
  dot?: StatusTone;
  sub?: string;
}

export function StatCard({ stat }: { stat: StatItem }) {
  const isUp = stat.trend === 'up';
  const isDown = stat.trend === 'down';
  const spark = stat.spark;
  return (
    <div className="stat">
      <div className="stat-top">
        <div className="stat-lab">{stat.label}</div>
      </div>
      <div className="stat-num">
        {stat.dot && <StatusDot tone={stat.dot} />}
        {stat.value}
      </div>
      {spark && spark.length > 1 && (
        <svg className="stat-spark" viewBox="0 0 120 22" preserveAspectRatio="none" width="100%" height={22}>
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth={1.5}
            points={spark.map((y, i) => `${(i / (spark.length - 1)) * 120},${y + 2}`).join(' ')}
          />
        </svg>
      )}
      {(stat.delta || stat.sub) && (
        <div className="stat-bot">
          <span className={`stat-delta ${isUp ? 'up' : isDown ? 'dn' : ''}`}>{stat.delta}</span>
          <span className="stat-sub">{stat.sub ?? 'vs prev 24h'}</span>
        </div>
      )}
    </div>
  );
}

/* ---------- Empty state ---------- */

interface EmptyAction { label: string; icon?: string; onClick?: () => void; }

export function EmptyState({ icon = 'info', title, desc, primary, secondary }: {
  icon?: string; title: ReactNode; desc?: ReactNode; primary?: EmptyAction; secondary?: EmptyAction;
}) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={22} /></div>
      <div className="empty-body">
        <div className="empty-title">{title}</div>
        {desc && <div className="empty-desc">{desc}</div>}
        {(primary || secondary) && (
          <div className="empty-actions">
            {primary && <Btn variant="primary" icon={primary.icon} onClick={primary.onClick}>{primary.label}</Btn>}
            {secondary && <Btn variant="secondary" icon={secondary.icon} onClick={secondary.onClick}>{secondary.label}</Btn>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Skeleton / Avatar ---------- */

export function Skeleton({ width = '100%', height = 10, className = '' }: {
  width?: number | string; height?: number | string; className?: string;
}) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />;
}

export function Avatar({ initials = 'YJ', tone = 'accent' }: {
  initials?: string; tone?: 'accent' | 'purple' | 'cyan';
}) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>;
}
