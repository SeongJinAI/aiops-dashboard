// TopBar — breadcrumb · search · density · theme · user
function TopBar({ path, activeRepo, density, setDensity, theme, setTheme, onSidebarToggle, onPaletteOpen }) {
  const data = window.NOVA_DATA;
  let crumbLabel = '홈';
  for (const g of data.sidebar) {
    for (const it of g.items) {
      if (it.path === path) crumbLabel = it.label;
    }
  }
  const projName = activeRepo ? activeRepo.name : 'nova';

  return (
    <header className="topbar">
      <IconBtn icon="panel-left" ariaLabel="sidebar" onClick={onSidebarToggle}/>

      <div className="crumbs">
        <span>{projName}</span>
        <span className="sep">/</span>
        <span className="here">{crumbLabel}</span>
      </div>

      <button className="topbar-search" onClick={onPaletteOpen}>
        <Icon name="search" size={12}/>
        <span className="ph">명령, 페이지, 프롬프트 검색…</span>
        <Keys>{['⌘', 'K']}</Keys>
      </button>

      <div className="density-toggle" role="radiogroup" aria-label="density">
        {['compact','normal','roomy'].map((d) => (
          <button
            key={d}
            className={`seg ${density === d ? 'active' : ''}`}
            onClick={() => setDensity(d)}
          >
            {d[0].toUpperCase() + d.slice(1)}
          </button>
        ))}
      </div>

      <IconBtn
        icon={theme === 'dark' ? 'sun' : 'moon'}
        ariaLabel="theme"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      />

      <Avatar initials="YJ"/>
    </header>
  );
}

window.TopBar = TopBar;
