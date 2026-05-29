// Primitive components for Nova UI kit
// All styling lives in ui.css (sibling). These wrap markup + behaviour.

const { useState, useEffect, useRef } = React;

function Btn({ children, variant = 'secondary', size = 'md', icon, onClick, disabled, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size === 'sm' ? 'btn-sm' : '', className].filter(Boolean).join(' ');
  return (
    <button className={cls} onClick={onClick} disabled={disabled} {...rest}>
      {icon && <Icon name={icon} size={14}/>}
      {children}
    </button>
  );
}

function IconBtn({ icon, ariaLabel, onClick, size = 14, className = '' }) {
  return (
    <button className={`btn btn-ghost btn-icon ${className}`} onClick={onClick} aria-label={ariaLabel}>
      <Icon name={icon} size={size}/>
    </button>
  );
}

function Chip({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`chip chip-${tone} ${dot ? 'chip-dot' : ''} ${className}`}>{children}</span>
  );
}

function Box({ title, action, children, padding = true, className = '' }) {
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

function KbdChip({ children }) {
  return <span className="kbd">{children}</span>;
}

function Keys({ children }) {
  // children: array like ['⌘', 'K'] or ['G', '·', 'P']
  return (
    <span className="keys">
      {children.map((k, i) =>
        k === '·' || k === '+' ? <span className="keys-sep" key={i}>{k}</span>
        : <KbdChip key={i}>{k}</KbdChip>
      )}
    </span>
  );
}

function StatusDot({ tone = 'neutral' }) {
  return <span className={`statusdot statusdot-${tone}`} />;
}

function StatCard({ stat }) {
  const delta = stat.delta;
  const isUp = stat.trend === 'up';
  const isDown = stat.trend === 'down';
  return (
    <div className="stat">
      <div className="stat-top">
        <div className="stat-lab">{stat.label}</div>
      </div>
      <div className="stat-num">
        {stat.dot && <StatusDot tone={stat.dot} />}
        {stat.value}
      </div>
      {stat.spark && (
        <svg className="stat-spark" viewBox="0 0 120 22" preserveAspectRatio="none" width="100%" height="22">
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            points={stat.spark.map((y, i) => `${(i/(stat.spark.length-1))*120},${y+2}`).join(' ')}
          />
        </svg>
      )}
      <div className="stat-bot">
        <span className={`stat-delta ${isUp ? 'up' : isDown ? 'dn' : ''}`}>{delta}</span>
        <span className="stat-sub">vs prev 24h</span>
      </div>
    </div>
  );
}

function EmptyState({ icon = 'info', title, desc, primary, secondary }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon name={icon} size={22}/></div>
      <div className="empty-body">
        <div className="empty-title">{title}</div>
        <div className="empty-desc">{desc}</div>
        {(primary || secondary) && (
          <div className="empty-actions">
            {primary  && <Btn variant="primary"   icon={primary.icon}>{primary.label}</Btn>}
            {secondary && <Btn variant="secondary" icon={secondary.icon}>{secondary.label}</Btn>}
          </div>
        )}
      </div>
    </div>
  );
}

function Skeleton({ width = '100%', height = 10, className = '' }) {
  return <div className={`skeleton ${className}`} style={{ width, height }} />;
}

function Avatar({ initials = 'YJ', tone = 'accent' }) {
  return <span className={`avatar avatar-${tone}`}>{initials}</span>;
}

Object.assign(window, {
  Btn, IconBtn, Chip, Box, KbdChip, Keys, StatusDot, StatCard, EmptyState, Skeleton, Avatar,
});
