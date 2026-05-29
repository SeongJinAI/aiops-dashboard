// Command Palette — opened by ⌘K
const { useState: _useState_cp, useEffect: _useEffect_cp, useRef: _useRef_cp } = React;

function CommandPalette({ open, onClose, onNavigate, setTheme, theme, setSidebarCollapsed, sidebarCollapsed }) {
  const [query, setQuery] = _useState_cp('');
  const inputRef = _useRef_cp();

  _useEffect_cp(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
    }
  }, [open]);

  const allActions = [
    { kind: 'page', icon: 'home',           label: '홈',          keys: 'G · H', do: () => onNavigate('/') },
    { kind: 'page', icon: 'message-square', label: '프롬프트',     keys: 'G · P', do: () => onNavigate('/prompts') },
    { kind: 'page', icon: 'activity',       label: 'Hook 모니터',  keys: '',      do: () => onNavigate('/hooks') },
    { kind: 'page', icon: 'alert-circle',   label: '오해 추적',    keys: '',      do: () => onNavigate('/misunderstandings') },
    { kind: 'page', icon: 'sparkles',       label: '에이전트',     keys: 'G · A', do: () => onNavigate('/agent') },
    { kind: 'page', icon: 'plug',           label: '연결',         keys: '',      do: () => onNavigate('/connections') },
    { kind: 'action', icon: theme === 'dark' ? 'sun' : 'moon', label: '다크 모드 토글', keys: '⌘ D', do: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { kind: 'action', icon: 'panel-left',   label: '사이드바 접기/펼치기', keys: '⌘ B', do: () => setSidebarCollapsed(!sidebarCollapsed) },
  ];

  const filtered = query
    ? allActions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()) || a.kind.includes(query.toLowerCase()))
    : allActions;

  const pages = filtered.filter((a) => a.kind === 'page');
  const actions = filtered.filter((a) => a.kind === 'action');

  if (!open) return null;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="top">
          <Icon name="search" size={14}/>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="명령, 페이지, 프롬프트 검색…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) { filtered[0].do(); onClose(); }
            }}
          />
          <KbdChip>Esc</KbdChip>
        </div>

        {pages.length > 0 && (
          <div className="palette-group">
            <div className="palette-ghdr">페이지</div>
            {pages.map((a, i) => (
              <button key={i} className="palette-row" data-active={i === 0} onClick={() => { a.do(); onClose(); }}>
                <Icon name={a.icon} size={14}/>
                <span className="palette-name">{a.label}</span>
                {a.keys && <span className="palette-meta">{a.keys}</span>}
              </button>
            ))}
          </div>
        )}

        {actions.length > 0 && (
          <div className="palette-group">
            <div className="palette-ghdr">액션</div>
            {actions.map((a, i) => (
              <button key={i} className="palette-row" onClick={() => { a.do(); onClose(); }}>
                <Icon name={a.icon} size={14}/>
                <span className="palette-name">{a.label}</span>
                {a.keys && <span className="palette-meta">{a.keys}</span>}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            ‘{query}’에 대한 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}

window.CommandPalette = CommandPalette;
