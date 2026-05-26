import { useState, useEffect, useCallback } from 'react';
import { C } from './constants/colors';
import { TopBar } from './components/TopBar';
import { TabBar } from './components/TabBar';
import { ChatBot } from './components/ChatBot';
import { RepoMap } from './pages/RepoMap';
import { ProjectSwap } from './pages/ProjectSwap';
import { SystemStatus } from './pages/SystemStatus';
import { HookMonitor } from './pages/HookMonitor';
import { WorkflowTracker } from './pages/WorkflowTracker';
import { PromptHistory } from './pages/PromptHistory';
import { MisunderstandingTracker } from './pages/MisunderstandingTracker';
import { ClaudeConfig } from './pages/ClaudeConfig';
import { Agent } from './pages/Agent';
import { Connections } from './pages/Connections';
import { OnboardingWizard } from './pages/OnboardingWizard';
import { Login } from './pages/Login';
import { useAuth } from './hooks/useAuth';
import { apiPost } from './hooks/useApi';
import type { Project } from './types';

const DEFAULT_PROJECT: Project = { name: "-", url: "", domain: "", status: "ready" };
const NEW_KEY_SESSION = 'aiops_new_api_key';
const ONBOARDED_FLAG = 'aiops_onboarded';

export default function App() {
  const [tab, setTab] = useState("repo-map");
  const [activeProject, setActiveProject] = useState<Project>(DEFAULT_PROJECT);
  const { auth, login, register, logout, isAuthenticated } = useAuth();
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardApiKey, setWizardApiKey] = useState<string | null>(null);

  // 서버 운영 모드 확인 — saas 모드면 인증 필요 (공개 엔드포인트)
  useEffect(() => {
    fetch('/api/mode')
      .then(res => res.json())
      .then(data => setNeedsAuth(!!data.auth_required))
      .catch(() => setNeedsAuth(false));
  }, []);

  useEffect(() => {
    const headers: Record<string, string> = {};
    const token = auth.token;
    if (token) headers['Authorization'] = `Bearer ${token}`;

    fetch('/api/projects/active', { headers })
      .then(res => res.json())
      .then(data => { if (data && data.name) setActiveProject(data); })
      .catch(() => {});
  }, [auth.token]);

  // 신규 가입자 자동 위저드 트리거
  useEffect(() => {
    if (!isAuthenticated) return;
    const freshKey = sessionStorage.getItem(NEW_KEY_SESSION);
    const onboarded = localStorage.getItem(ONBOARDED_FLAG) === '1';
    if (freshKey && !onboarded) {
      setWizardApiKey(freshKey);
      setShowWizard(true);
      sessionStorage.removeItem(NEW_KEY_SESSION);
    }
  }, [isAuthenticated]);

  const handleWizardClose = useCallback(() => {
    setShowWizard(false);
  }, []);

  const handleWizardComplete = useCallback(() => {
    localStorage.setItem(ONBOARDED_FLAG, '1');
    setShowWizard(false);
    setWizardApiKey(null);
    setTab('main');
    // 활성 프로젝트 재조회
    const headers: Record<string, string> = {};
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
    fetch('/api/projects/active', { headers })
      .then(res => res.json())
      .then(data => { if (data && data.name) setActiveProject(data); })
      .catch(() => {});
  }, [auth.token]);

  const handleReopenWizard = useCallback(() => {
    setWizardApiKey(null); // 평문 키 없음 → 재발급 안내 모드
    setShowWizard(true);
  }, []);

  const handleRegenerate = useCallback(async () => {
    const res = await apiPost<{ api_key: string }>('/auth/api-key/regenerate', {});
    return res.api_key;
  }, []);

  // 인증 확인 중
  if (needsAuth === null) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: C.dim }}>로딩 중...</div>;
  }

  // SaaS 모드에서 미인증 상태
  if (needsAuth && !isAuthenticated) {
    return <Login onLogin={login} onRegister={register} />;
  }

  const apiBase = window.location.origin;

  return (
    <div style={{ fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 3px; }
        input:focus { outline: none; border-color: ${C.accent} !important; }
        button { font-family: inherit; }
      `}</style>

      <TopBar activeProject={activeProject} onLogout={needsAuth ? logout : undefined} email={auth.email} />
      <TabBar tab={tab} setTab={setTab} />

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {tab === "repo-map" && <RepoMap activeProject={activeProject} />}
        {tab === "swap" && <ProjectSwap activeProject={activeProject} setActiveProject={setActiveProject} />}
        {tab === "main" && <SystemStatus activeProject={activeProject} />}
        {tab === "hooks" && <HookMonitor />}
        {tab === "workflow" && <WorkflowTracker />}
        {tab === "prompts" && <PromptHistory />}
        {tab === "misunderstandings" && <MisunderstandingTracker />}
        {tab === "claude-config" && <ClaudeConfig />}
        {tab === "agent" && <Agent />}
        {tab === "connections" && <Connections onReopenWizard={handleReopenWizard} />}
      </div>

      <ChatBot activeProject={activeProject} />

      {showWizard && (
        <OnboardingWizard
          apiKey={wizardApiKey}
          tenantId={auth.tenantId || ''}
          apiBase={apiBase}
          onClose={handleWizardClose}
          onComplete={handleWizardComplete}
          onRegenerate={handleRegenerate}
        />
      )}
    </div>
  );
}
