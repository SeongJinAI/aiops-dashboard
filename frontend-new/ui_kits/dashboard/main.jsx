// Nova Dashboard — top-level app

const { useState: _useState_app, useEffect: _useEffect_app, useCallback: _useCallback_app } = React;

function App() {
  const [path, setPath] = _useState_app('/');
  const [activeProject, setActiveProject] = _useState_app('nova');
  const [theme, setTheme] = _useState_app(() => localStorage.getItem('nova.theme') || 'light');
  const [density, setDensity] = _useState_app(() => localStorage.getItem('nova.density') || 'compact');
  const [sidebarCollapsed, setSidebarCollapsed] = _useState_app(false);
  const [paletteOpen, setPaletteOpen] = _useState_app(false);
  const [toasts, setToasts] = _useState_app([]);

  _useEffect_app(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nova.theme', theme);
  }, [theme]);

  _useEffect_app(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem('nova.density', density);
  }, [density]);

  const pushToast = _useCallback_app((t) => {
    const id = `t-${Date.now()}-${Math.random()}`;
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4500);
  }, []);

  _useEffect_app(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((p) => !p); }
      else if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); setSidebarCollapsed((c) => !c); }
      else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); setTheme((t) => t === 'dark' ? 'light' : 'dark'); }
      else if (e.key === 'Escape') { setPaletteOpen(false); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function navigate(p) {
    setPath(p);
    setPaletteOpen(false);
  }

  function switchProject(id) {
    setActiveProject(id);
    const data = window.NOVA_DATA;
    const r = data.repos.find((x) => x.id === id);
    pushToast({ tone: 'info', title: `프로젝트 전환됨 — ${r ? r.name : id}`, desc: 'Hook 카운트, 프롬프트, 위키가 이 프로젝트 기준으로 다시 계산됩니다.' });
  }

  let page;
  switch (path) {
    case '/':                   page = <Home onNavigate={navigate}/>; break;
    case '/prompts':            page = <Prompts/>; break;
    case '/hooks':              page = <HookMonitor/>; break;
    case '/agent':              page = <Agent pushToast={pushToast}/>; break;
    case '/connections':        page = <Connections pushToast={pushToast}/>; break;
    case '/misunderstandings':  page = <Misunderstandings/>; break;
    case '/repo-map':           page = <Placeholder title="레포 관계도" icon="git-branch" desc="현재 활성 프로젝트의 의존성 그래프 + 디렉토리 트리. 프로젝트마다 별도로 표시됩니다."/>; break;
    case '/workflow':           page = <Placeholder title="워크플로우" icon="workflow"/>; break;
    case '/claude-config':      page = <Placeholder title="Claude 설정" icon="settings" desc=".claude/ 디렉토리 트리와 각 파일의 메타데이터."/>; break;
    default:                    page = <Placeholder title="찾을 수 없음"/>;
  }

  const activeRepo = window.NOVA_DATA.repos.find((r) => r.id === activeProject);

  return (
    <div className="app" data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
      <Sidebar
        path={path}
        onNavigate={navigate}
        collapsed={sidebarCollapsed}
        activeProject={activeProject}
        onSwitchProject={switchProject}
      />
      <div className="app-main">
        <TopBar
          path={path}
          activeRepo={activeRepo}
          density={density} setDensity={setDensity}
          theme={theme} setTheme={setTheme}
          onSidebarToggle={() => setSidebarCollapsed((c) => !c)}
          onPaletteOpen={() => setPaletteOpen(true)}
        />
        <main className="content">{page}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={navigate}
        setTheme={setTheme}
        theme={theme}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarCollapsed={sidebarCollapsed}
      />

      <div className="toast-stack">
        {toasts.map((t) => (
          <div className={`toast ${t.tone || 'info'}`} key={t.id}>
            <Icon className="toast-ico" name={t.tone === 'success' ? 'check-circle' : t.tone === 'danger' ? 'x-circle' : 'info'} size={14}/>
            <div className="toast-title">{t.title}</div>
            <button className="toast-x" onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} aria-label="close">
              <Icon name="x" size={12}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
