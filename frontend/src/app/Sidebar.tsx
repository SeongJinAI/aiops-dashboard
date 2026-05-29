// Sidebar — 프로젝트 스위처 + 3섹션 네비 (10항목), collapsible.
import logoMark from '../brand-assets/logo-mark.svg';
import { SIDEBAR_GROUPS } from '../constants/nav';
import { Icon } from '../ui/Icon';
import type { Project } from '../types';

interface SidebarProps {
  path: string;
  onNavigate: (p: string) => void;
  collapsed: boolean;
  projects: Project[];
  activeProjectName: string;
  onSwitchProject: (name: string) => void;
}

export function Sidebar({
  path, onNavigate, collapsed, projects, activeProjectName, onSwitchProject,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src={logoMark} alt="" />
        <span className="sidebar-brand-text">Nova</span>
      </div>

      {projects.length > 0 && (
        <div className="sidebar-grp">
          <div className="sidebar-grp-label sidebar-grp-label-row">
            <span>프로젝트 · {projects.length}</span>
            <button
              className="sidebar-grp-add"
              title="프로젝트 관리"
              onClick={() => onNavigate('/project-swap')}
              type="button"
            >
              <Icon name="plus" size={11} />
            </button>
          </div>
          {projects.map((p) => {
            const active = p.name === activeProjectName;
            return (
              <button
                key={p.name}
                className={`sidebar-proj ${active ? 'active' : ''}`}
                onClick={() => onSwitchProject(p.name)}
                title={collapsed ? p.name : `${p.name}${p.domain ? ' · ' + p.domain : ''}`}
                type="button"
              >
                <span className="sidebar-proj-dot" />
                <span className="sidebar-proj-name">{p.name}</span>
                {p.status === 'active' && <span className="sidebar-proj-dirty" title="활성" />}
              </button>
            );
          })}
        </div>
      )}

      {SIDEBAR_GROUPS.map((group) => (
        <div className="sidebar-grp" key={group.label}>
          <div className="sidebar-grp-label">{group.label}</div>
          {group.items.map((item) => {
            const active = item.path === path;
            return (
              <button
                key={item.id}
                className={`sidebar-item ${active ? 'active' : ''}`}
                onClick={() => onNavigate(item.path)}
                title={collapsed ? item.label : undefined}
                type="button"
              >
                <Icon name={item.icon} size={15} />
                <span className="sidebar-item-label">{item.label}</span>
                {item.count != null && <span className="sidebar-item-count">{item.count}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </aside>
  );
}
