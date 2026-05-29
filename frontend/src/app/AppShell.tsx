// AppShell — Sidebar + TopBar + Main 레이아웃. 테마/밀도/사이드바/팔레트 UI 상태와 키보드 단축키를 관리.
import { useEffect, useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import type { Project } from '../types';

export type Theme = 'light' | 'dark';
export type Density = 'compact' | 'normal' | 'roomy';

const THEME_KEY = 'nova.theme';
const DENSITY_KEY = 'nova.density';

interface AppShellProps {
  path: string;
  onNavigate: (p: string) => void;
  projects: Project[];
  activeProjectName: string;
  onSwitchProject: (name: string) => void;
  email?: string | null;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppShell({
  path, onNavigate, projects, activeProjectName, onSwitchProject, email, onLogout, children,
}: AppShellProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme) || 'light'
  );
  const [density, setDensity] = useState<Density>(
    () => (localStorage.getItem(DENSITY_KEY) as Density) || 'compact'
  );
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') { e.preventDefault(); setPaletteOpen((p) => !p); }
      else if (mod && k === 'b') { e.preventDefault(); setCollapsed((c) => !c); }
      else if (mod && k === 'd') { e.preventDefault(); setTheme((t) => (t === 'dark' ? 'light' : 'dark')); }
      else if (e.key === 'Escape') { setPaletteOpen(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app" data-sidebar={collapsed ? 'collapsed' : 'expanded'}>
      <Sidebar
        path={path}
        onNavigate={onNavigate}
        collapsed={collapsed}
        projects={projects}
        activeProjectName={activeProjectName}
        onSwitchProject={onSwitchProject}
      />
      <div className="app-main">
        <TopBar
          path={path}
          projectName={activeProjectName || 'nova'}
          density={density}
          setDensity={setDensity}
          theme={theme}
          setTheme={setTheme}
          onSidebarToggle={() => setCollapsed((c) => !c)}
          onPaletteOpen={() => setPaletteOpen(true)}
          email={email}
          onLogout={onLogout}
        />
        <main className="content">{children}</main>
      </div>

      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onNavigate={onNavigate}
          theme={theme}
          setTheme={setTheme}
          sidebarCollapsed={collapsed}
          setSidebarCollapsed={setCollapsed}
        />
      )}
    </div>
  );
}
