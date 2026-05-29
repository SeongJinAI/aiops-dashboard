// Command Palette — ⌘K. 페이지 이동 + 테마/사이드바 액션.
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { KbdChip } from '../ui/primitives';
import type { Theme } from './AppShell';

interface PaletteAction {
  kind: 'page' | 'action';
  icon: string;
  label: string;
  keys: string;
  run: () => void;
}

interface CommandPaletteProps {
  onClose: () => void;
  onNavigate: (p: string) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
}

// AppShell이 paletteOpen일 때만 마운트한다 — 열릴 때마다 query가 초기화되고 입력에 포커스된다.
export function CommandPalette({
  onClose, onNavigate, theme, setTheme, sidebarCollapsed, setSidebarCollapsed,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  const allActions: PaletteAction[] = [
    { kind: 'page', icon: 'home', label: '홈', keys: 'G · H', run: () => onNavigate('/') },
    { kind: 'page', icon: 'message-square', label: '프롬프트', keys: 'G · P', run: () => onNavigate('/prompts') },
    { kind: 'page', icon: 'activity', label: 'Hook 모니터', keys: '', run: () => onNavigate('/hooks') },
    { kind: 'page', icon: 'alert-circle', label: '오해 추적', keys: '', run: () => onNavigate('/misunderstandings') },
    { kind: 'page', icon: 'sparkles', label: '에이전트', keys: 'G · A', run: () => onNavigate('/agent') },
    { kind: 'page', icon: 'plug', label: '연결', keys: '', run: () => onNavigate('/connections') },
    { kind: 'page', icon: 'git-branch', label: '레포 관계도', keys: '', run: () => onNavigate('/repo-map') },
    { kind: 'page', icon: 'settings', label: 'Claude 설정', keys: '', run: () => onNavigate('/claude-config') },
    { kind: 'action', icon: theme === 'dark' ? 'sun' : 'moon', label: '다크 모드 토글', keys: '⌘ D', run: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
    { kind: 'action', icon: 'panel-left', label: '사이드바 접기/펼치기', keys: '⌘ B', run: () => setSidebarCollapsed(!sidebarCollapsed) },
  ];

  const q = query.toLowerCase();
  const filtered = query
    ? allActions.filter((a) => a.label.toLowerCase().includes(q) || a.kind.includes(q))
    : allActions;

  const pages = filtered.filter((a) => a.kind === 'page');
  const actions = filtered.filter((a) => a.kind === 'action');

  const fire = (a: PaletteAction) => { a.run(); onClose(); };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <div className="top">
          <Icon name="search" size={14} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="명령, 페이지, 프롬프트 검색…"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'Enter' && filtered[0]) fire(filtered[0]);
            }}
          />
          <KbdChip>Esc</KbdChip>
        </div>

        {pages.length > 0 && (
          <div className="palette-group">
            <div className="palette-ghdr">페이지</div>
            {pages.map((a, i) => (
              <button key={a.label} className="palette-row" data-active={i === 0} onClick={() => fire(a)} type="button">
                <Icon name={a.icon} size={14} />
                <span className="palette-name">{a.label}</span>
                {a.keys && <span className="palette-meta">{a.keys}</span>}
              </button>
            ))}
          </div>
        )}

        {actions.length > 0 && (
          <div className="palette-group">
            <div className="palette-ghdr">액션</div>
            {actions.map((a) => (
              <button key={a.label} className="palette-row" onClick={() => fire(a)} type="button">
                <Icon name={a.icon} size={14} />
                <span className="palette-name">{a.label}</span>
                {a.keys && <span className="palette-meta">{a.keys}</span>}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <div className="palette-empty">‘{query}’에 대한 결과가 없습니다.</div>
        )}
      </div>
    </div>
  );
}
