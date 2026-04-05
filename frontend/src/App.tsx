import { useState, useEffect } from 'react';
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
import { Login } from './pages/Login';
import { useAuth } from './hooks/useAuth';
import type { Project } from './types';

const DEFAULT_PROJECT: Project = { name: "-", url: "", domain: "", status: "ready" };

export default function App() {
  const [tab, setTab] = useState("repo-map");
  const [activeProject, setActiveProject] = useState<Project>(DEFAULT_PROJECT);
  const { auth, login, register, logout, isAuthenticated } = useAuth();
  const [needsAuth, setNeedsAuth] = useState<boolean | null>(null);

  // 서버가 인증을 요구하는지 확인 (local 모드면 인증 불필요)
  useEffect(() => {
    fetch('/api/health')
      .then(res => {
        if (res.status === 401) {
          setNeedsAuth(true);
        } else {
          setNeedsAuth(false);
        }
      })
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

  // 인증 확인 중
  if (needsAuth === null) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: C.dim }}>로딩 중...</div>;
  }

  // SaaS 모드에서 미인증 상태
  if (needsAuth && !isAuthenticated) {
    return <Login onLogin={login} onRegister={register} />;
  }

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
      </div>

      <ChatBot activeProject={activeProject} />
    </div>
  );
}
