import { useCallback, useEffect, useState } from 'react';
import { ToastProvider } from './ui/toast';
import { AppShell } from './app/AppShell';
import { useAuth } from './hooks/useAuth';
import { apiPost } from './hooks/useApi';
import type { Project } from './types';
import { Home } from './pages/Home';
import { RepoMap } from './pages/RepoMap';
import { ProjectSwap } from './pages/ProjectSwap';
import { HookMonitor } from './pages/HookMonitor';
import { WorkflowTracker } from './pages/WorkflowTracker';
import { Prompts } from './pages/Prompts';
import { Misunderstandings } from './pages/Misunderstandings';
import { ClaudeConfig } from './pages/ClaudeConfig';
import { Agent } from './pages/Agent';
import { Coach } from './pages/Coach';
import { Library } from './pages/Library';
import { Subscribe } from './pages/Subscribe';
import { Connections } from './pages/Connections';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { Login } from './pages/Login';
import { Landing } from './pages/Landing';

const DEFAULT_PROJECT: Project = { name: '-', url: '', domain: '', status: 'ready' };
const NEW_KEY_SESSION = 'aiops_new_api_key';
const ONBOARDED_FLAG = 'aiops_onboarded';

/** Vite dev 포트면 백엔드 포트로 보정. /api/mode 응답이 오면 최종 값으로 갱신된다. */
function inferInitialApiBase(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  try {
    const u = new URL(origin);
    if (u.port === '5173' || u.port === '5174') {
      u.port = '8000';
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    // ignore — origin 그대로
  }
  return origin;
}

export default function App() {
  const [path, setPath] = useState('/');
  const [activeProject, setActiveProject] = useState<Project>(DEFAULT_PROJECT);
  const [projects, setProjects] = useState<Project[]>([]);
  const { auth, login, register, logout, isAuthenticated } = useAuth();
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  // 대시보드의 공개 URL — Hook 설치 명령에 박힐 baseUrl. 백엔드가 단일 진실의 원천.
  // 초기값은 정확한 값이 도착하기 전까지의 fallback. Vite dev 포트(5173/5174)는
  // 백엔드(8000)로 즉시 보정 — fetch 응답 전 짧은 렌더 시점에도 잘못된 URL이 표시되지 않게.
  const [apiBase, setApiBase] = useState<string>(() => inferInitialApiBase());
  const [showWizard, setShowWizard] = useState(false);
  const [wizardApiKey, setWizardApiKey] = useState<string | null>(null);
  // 미인증 퍼널: 랜딩 → 인증(로그인/회원가입)
  const [authView, setAuthView] = useState<'landing' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // 운영 모드 확인 — saas면 인증 필요. public_url도 동시에 받아 apiBase로 채택.
  useEffect(() => {
    fetch('/api/mode')
      .then((r) => r.json())
      .then((d) => {
        setNeedsAuth(!!d.auth_required);
        if (typeof d.public_url === 'string' && d.public_url) setApiBase(d.public_url);
      })
      .catch(() => setNeedsAuth(false));
  }, []);

  // 활성 프로젝트 + 프로젝트 목록
  useEffect(() => {
    const headers: Record<string, string> = {};
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    fetch('/api/projects/active', { headers })
      .then((r) => r.json())
      .then((d) => { if (d && d.name) setActiveProject(d); })
      .catch(() => {});
    fetch('/api/projects/', { headers })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setProjects(d); })
      .catch(() => {});
  }, [auth.token]);

  // 신규 가입자 자동 위저드 트리거
  useEffect(() => {
    if (!isAuthenticated) return;
    const freshKey = sessionStorage.getItem(NEW_KEY_SESSION);
    const onboarded = localStorage.getItem(ONBOARDED_FLAG) === '1';
    if (freshKey && !onboarded) {
      sessionStorage.removeItem(NEW_KEY_SESSION);
      // 가입 직후 1회성 위저드 트리거 — 외부(sessionStorage) 상태를 React로 동기화
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWizardApiKey(freshKey);
      setShowWizard(true);
    }
  }, [isAuthenticated]);

  const navigate = useCallback((p: string) => setPath(p), []);

  const handleWizardComplete = useCallback(() => {
    localStorage.setItem(ONBOARDED_FLAG, '1');
    setShowWizard(false);
    setWizardApiKey(null);
    setPath('/');
    const headers: Record<string, string> = {};
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    fetch('/api/projects/active', { headers })
      .then((r) => r.json())
      .then((d) => { if (d && d.name) setActiveProject(d); })
      .catch(() => {});
  }, [auth.token]);

  const handleReopenWizard = useCallback(() => {
    setWizardApiKey(null);
    setShowWizard(true);
  }, []);

  const handleRegenerate = useCallback(async () => {
    const res = await apiPost<{ api_key: string }>('/auth/api-key/regenerate', {});
    return res.api_key;
  }, []);

  if (needsAuth === null) {
    return <div className="boot-screen">로딩 중…</div>;
  }

  if (needsAuth && !isAuthenticated) {
    return (
      <ToastProvider>
        {authView === 'landing' ? (
          <Landing
            onLogin={() => { setAuthMode('login'); setAuthView('auth'); }}
            onGetStarted={() => { setAuthMode('register'); setAuthView('auth'); }}
          />
        ) : (
          <Login
            onLogin={login}
            onRegister={register}
            initialMode={authMode}
            onBack={() => setAuthView('landing')}
          />
        )}
      </ToastProvider>
    );
  }

  let page;
  switch (path) {
    case '/': page = <Home onNavigate={navigate} activeProjectName={activeProject.name} />; break;
    case '/repo-map': page = <RepoMap activeProject={activeProject} />; break;
    case '/project-swap': page = <ProjectSwap activeProject={activeProject} setActiveProject={setActiveProject} />; break;
    case '/hooks': page = <HookMonitor />; break;
    case '/workflow': page = <WorkflowTracker />; break;
    case '/prompts': page = <Prompts />; break;
    case '/misunderstandings': page = <Misunderstandings onNavigate={navigate} />; break;
    case '/claude-config': page = <ClaudeConfig />; break;
    case '/agent': page = <Agent />; break;
    case '/coach': page = <Coach />; break;
    case '/library': page = <Library onNavigate={navigate} />; break;
    case '/subscribe': page = <Subscribe />; break;
    case '/connections': page = <Connections onReopenWizard={handleReopenWizard} apiBase={apiBase} />; break;
    default: page = <Home onNavigate={navigate} activeProjectName={activeProject.name} />;
  }

  return (
    <ToastProvider>
      <AppShell
        path={path}
        onNavigate={navigate}
        projects={projects}
        activeProjectName={activeProject.name}
        onSwitchProject={() => navigate('/project-swap')}
        email={auth.email}
        onLogout={needsAuth ? logout : undefined}
      >
        {page}
      </AppShell>

      {showWizard && (
        <OnboardingWizard
          apiKey={wizardApiKey}
          tenantId={auth.tenantId || ''}
          apiBase={apiBase}
          onClose={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
          onRegenerate={handleRegenerate}
        />
      )}
    </ToastProvider>
  );
}
