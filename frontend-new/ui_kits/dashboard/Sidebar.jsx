// Sidebar — project switcher + 3 nav groups (10 items total), collapsible.
const { useState: _useState_sb } = React;

function Sidebar({ path, onNavigate, collapsed, activeProject, onSwitchProject }) {
  const data = window.NOVA_DATA;
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="../../assets/logo-mark.svg" alt=""/>
        <span className="sidebar-brand-text">Nova</span>
      </div>

      <div className="sidebar-grp">
        <div className="sidebar-grp-label sidebar-grp-label-row">
          <span>프로젝트 · {data.repos.length}</span>
          <button className="sidebar-grp-add" title="레포 추가">
            <Icon name="plus" size={11}/>
          </button>
        </div>
        {data.repos.map((r) => {
          const active = r.id === activeProject;
          return (
            <button
              key={r.id}
              className={`sidebar-proj ${active ? 'active' : ''}`}
              onClick={() => onSwitchProject(r.id)}
              title={collapsed ? r.name : `${r.name} · ${r.branch}`}
            >
              <span className="sidebar-proj-dot"/>
              <span className="sidebar-proj-name">{r.name}</span>
              {r.dirty && <span className="sidebar-proj-dirty" title="uncommitted changes"/>}
            </button>
          );
        })}
      </div>

      {data.sidebar.map((group) => (
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
              >
                <Icon name={item.icon} size={15}/>
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

window.Sidebar = Sidebar;
