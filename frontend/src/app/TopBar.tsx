// TopBar — sidebar toggle · breadcrumb · 검색(⌘K) · density · theme · user
import { labelForPath } from '../constants/nav';
import { Icon } from '../ui/Icon';
import { IconBtn, Keys, Avatar } from '../ui/primitives';
import type { Theme, Density } from './AppShell';

interface TopBarProps {
  path: string;
  projectName: string;
  density: Density;
  setDensity: (d: Density) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onSidebarToggle: () => void;
  onPaletteOpen: () => void;
  email?: string | null;
  onLogout?: () => void;
}

const DENSITIES: Density[] = ['compact', 'normal', 'roomy'];

function initialsOf(email?: string | null): string {
  if (!email) return 'YJ';
  const name = email.split('@')[0];
  return name.slice(0, 2).toUpperCase();
}

export function TopBar({
  path, projectName, density, setDensity, theme, setTheme,
  onSidebarToggle, onPaletteOpen, email, onLogout,
}: TopBarProps) {
  return (
    <header className="topbar">
      <IconBtn icon="panel-left" ariaLabel="사이드바 토글" onClick={onSidebarToggle} title="사이드바 (⌘B)" />

      <div className="crumbs">
        <span>{projectName}</span>
        <span className="sep">/</span>
        <span className="here">{labelForPath(path)}</span>
      </div>

      <button className="topbar-search" onClick={onPaletteOpen} type="button">
        <Icon name="search" size={12} />
        <span className="ph">명령, 페이지, 프롬프트 검색…</span>
        <Keys>{['⌘', 'K']}</Keys>
      </button>

      <div className="density-toggle" role="radiogroup" aria-label="화면 밀도">
        {DENSITIES.map((d) => (
          <button
            key={d}
            className={`seg ${density === d ? 'active' : ''}`}
            onClick={() => setDensity(d)}
            type="button"
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <IconBtn
        icon={theme === 'dark' ? 'sun' : 'moon'}
        ariaLabel="테마 토글"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title="다크 모드 (⌘D)"
      />

      <Avatar initials={initialsOf(email)} />

      {onLogout && (
        <IconBtn icon="log-out" ariaLabel="로그아웃" onClick={onLogout} title="로그아웃" />
      )}
    </header>
  );
}
