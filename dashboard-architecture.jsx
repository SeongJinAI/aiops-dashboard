import { useState } from "react";

const C = {
  bg: "#08080d", surface: "#101018", surfaceAlt: "#161620",
  border: "#252535", borderActive: "#4a4a6a",
  text: "#e0e0e8", dim: "#6a6a80", accent: "#6366f1",
  green: "#22c55e", red: "#ef4444", orange: "#f59e0b",
  cyan: "#06b6d4", purple: "#a855f7", pink: "#ec4899",
};

const REPOS = [
  { id: "governance", name: "거버넌스", icon: "🏛", color: C.purple, desc: "규칙 / Hook / 설정 / 권한", fixed: true },
  { id: "test", name: "테스트", icon: "🧪", color: C.cyan, desc: "테스트 실행 / 결과 관리", fixed: true },
  { id: "knowledge", name: "지식", icon: "📚", color: C.orange, desc: "기능명세서 / 아키텍처 / 인사이트", fixed: true },
  { id: "project", name: "프로젝트", icon: "⚙️", color: C.green, desc: "API 서버 / 프론트 코드", fixed: false },
  { id: "rag", name: "RAG 챗봇", icon: "💬", color: C.pink, desc: "지식 기반 Q&A 서비스", fixed: true },
];

const CONNECTIONS = [
  { from: "project", to: "knowledge", label: "문서 자동 생성", type: "write", color: C.green },
  { from: "test", to: "project", label: "코드 읽기", type: "read", color: C.cyan },
  { from: "test", to: "knowledge", label: "명세서 읽기", type: "read", color: C.cyan },
  { from: "project", to: "test", label: "테스트 결과 읽기", type: "read", color: C.green },
  { from: "rag", to: "knowledge", label: "문서 인덱싱", type: "read", color: C.pink },
  { from: "governance", to: "project", label: "규칙 적용", type: "config", color: C.purple },
  { from: "governance", to: "test", label: "규칙 적용", type: "config", color: C.purple },
  { from: "governance", to: "knowledge", label: "규칙 적용", type: "config", color: C.purple },
];

const SAMPLE_PROJECTS = [
  { name: "inconus-api-erp-v2", url: "github.com/inconus/api-erp-v2", domain: "건설 ERP", status: "active" },
  { name: "inconus-hr-system", url: "github.com/inconus/hr-system", domain: "인사관리", status: "ready" },
  { name: "ecommerce-api", url: "github.com/myorg/ecommerce-api", domain: "이커머스", status: "ready" },
];

const tabs = [
  { key: "repo-map", label: "레포 관계도" },
  { key: "swap", label: "프로젝트 교체" },
  { key: "main", label: "시스템 상태" },
  { key: "hooks", label: "Hook 모니터링" },
  { key: "workflow", label: "워크플로우" },
  { key: "prompts", label: "프롬프트" },
];

export default function Dashboard() {
  const [tab, setTab] = useState("repo-map");
  const [activeProject, setActiveProject] = useState(SAMPLE_PROJECTS[0]);
  const [swapUrl, setSwapUrl] = useState("");
  const [hoveredConn, setHoveredConn] = useState(null);
  const [hoveredRepo, setHoveredRepo] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { role: "system", text: "RAG 챗봇이 초기화되었습니다. 지식 레포의 문서를 기반으로 답변합니다." },
    { role: "user", text: "직원정보관리 API의 인증 방식이 뭐야?" },
    { role: "assistant", text: "기능명세서에 따르면 직원정보관리 API는 JWT Bearer 토큰 기반 인증을 사용합니다. 로그인 시 /v2/auth/login 엔드포인트에서 토큰을 발급받고, 이후 모든 요청 헤더에 Authorization: Bearer {token}을 포함해야 합니다." },
  ]);

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", background: C.bg, color: C.text, minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
        input:focus { outline: none; border-color: ${C.accent} !important; }
        button { font-family: inherit; }
      `}</style>

      {/* Top Bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "12px 24px", borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>AI OPS</div>
          <div style={{ fontSize: 10, color: C.dim, padding: "2px 8px", border: `1px solid ${C.border}`, borderRadius: 3 }}>
            v0.1 — 아키텍처 검증
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
          <span style={{ fontSize: 10, color: C.dim }}>활성 프로젝트:</span>
          <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{activeProject.name}</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: "flex", gap: 0, padding: "0 24px",
        borderBottom: `1px solid ${C.border}`, overflow: "auto",
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: "10px 16px", fontSize: 11, cursor: "pointer",
            background: "transparent", color: tab === t.key ? C.text : C.dim,
            border: "none", borderBottom: `2px solid ${tab === t.key ? C.accent : "transparent"}`,
            transition: "all 0.15s",
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: 24 }}>
        {tab === "repo-map" && <RepoMap activeProject={activeProject} hoveredConn={hoveredConn} setHoveredConn={setHoveredConn} hoveredRepo={hoveredRepo} setHoveredRepo={setHoveredRepo} />}
        {tab === "swap" && <ProjectSwap activeProject={activeProject} setActiveProject={setActiveProject} swapUrl={swapUrl} setSwapUrl={setSwapUrl} />}
        {tab === "main" && <SystemStatus activeProject={activeProject} />}
        {tab === "hooks" && <HookMonitor />}
        {tab === "workflow" && <WorkflowTracker />}
        {tab === "prompts" && <PromptHistory />}
      </div>

      {/* RAG Chatbot Floating Button */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: "50%",
          background: chatOpen ? C.dim : `linear-gradient(135deg, ${C.pink}, ${C.purple})`,
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: chatOpen ? "none" : `0 4px 20px ${C.pink}40`,
          transition: "all 0.3s",
          zIndex: 200,
        }}
      >
        <span style={{ fontSize: 24, lineHeight: 1 }}>{chatOpen ? "✕" : "💬"}</span>
      </button>

      {/* RAG Chat Panel */}
      {chatOpen && (
        <div style={{
          position: "fixed", bottom: 92, right: 24,
          width: 380, height: 520,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, overflow: "hidden",
          display: "flex", flexDirection: "column",
          boxShadow: `0 8px 32px rgba(0,0,0,0.5)`,
          zIndex: 199,
        }}>
          {/* Chat Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: `1px solid ${C.border}`,
            background: `linear-gradient(135deg, ${C.pink}15, ${C.purple}15)`,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>💬</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>RAG 챗봇</div>
              <div style={{ fontSize: 9, color: C.dim }}>지식 레포 기반 Q&A · {activeProject.name}</div>
            </div>
            <div style={{
              padding: "3px 8px", borderRadius: 3,
              background: `${C.orange}20`, border: `1px solid ${C.orange}30`,
              fontSize: 9, color: C.orange,
            }}>
              PREVIEW
            </div>
          </div>

          {/* Knowledge Source Indicator */}
          <div style={{
            padding: "8px 16px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", gap: 6,
            background: `${C.orange}08`,
          }}>
            <span style={{ fontSize: 10 }}>📚</span>
            <span style={{ fontSize: 9, color: C.dim }}>연결된 지식:</span>
            <span style={{ fontSize: 9, color: C.orange }}>기능명세서 12건 · 아키텍처 5건 · 인사이트 8건</span>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflow: "auto", padding: 16,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            {chatMessages.map((msg, i) => (
              <div key={i} style={{
                display: "flex", flexDirection: "column",
                alignItems: msg.role === "user" ? "flex-end" : "flex-start",
              }}>
                {msg.role === "system" ? (
                  <div style={{
                    fontSize: 9, color: C.dim, textAlign: "center",
                    padding: "6px 12px", background: `${C.dim}10`,
                    borderRadius: 4, alignSelf: "center",
                  }}>{msg.text}</div>
                ) : (
                  <>
                    <div style={{
                      fontSize: 9, color: C.dim, marginBottom: 4,
                      paddingLeft: msg.role === "user" ? 0 : 4,
                      paddingRight: msg.role === "user" ? 4 : 0,
                    }}>
                      {msg.role === "user" ? "나" : "RAG 챗봇"}
                    </div>
                    <div style={{
                      maxWidth: "85%", padding: "10px 14px",
                      borderRadius: msg.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      background: msg.role === "user" ? `${C.accent}30` : C.surfaceAlt,
                      border: `1px solid ${msg.role === "user" ? C.accent + "40" : C.border}`,
                      fontSize: 11, lineHeight: 1.6, color: C.text,
                    }}>{msg.text}</div>
                    {msg.role === "assistant" && msg.text.indexOf("⏳") === -1 && (
                      <div style={{ fontSize: 8, color: C.dim, marginTop: 4, paddingLeft: 4, display: "flex", gap: 6 }}>
                        <span>📄 참조: 기능명세서.md</span>
                        <span style={{ color: C.border }}>|</span>
                        <span>신뢰도 92%</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && chatInput.trim()) {
                  setChatMessages(prev => [...prev,
                    { role: "user", text: chatInput },
                    { role: "assistant", text: "⏳ RAG 기능 구현 예정입니다. 현재는 UI 프리뷰입니다." },
                  ]);
                  setChatInput("");
                }
              }}
              placeholder="지식 레포에 질문하기..."
              style={{
                flex: 1, padding: "10px 14px", fontSize: 11,
                fontFamily: "inherit", background: C.bg,
                border: `1px solid ${C.border}`, borderRadius: 8, color: C.text,
              }}
            />
            <button
              onClick={() => {
                if (chatInput.trim()) {
                  setChatMessages(prev => [...prev,
                    { role: "user", text: chatInput },
                    { role: "assistant", text: "⏳ RAG 기능 구현 예정입니다. 현재는 UI 프리뷰입니다." },
                  ]);
                  setChatInput("");
                }
              }}
              style={{
                padding: "10px 14px", fontSize: 13,
                background: `linear-gradient(135deg, ${C.pink}, ${C.purple})`,
                color: "#fff", border: "none", borderRadius: 8, cursor: "pointer",
              }}
            >↑</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RepoMap({ activeProject, hoveredConn, setHoveredConn, hoveredRepo, setHoveredRepo }) {
  const pos = { governance: { x: 300, y: 30 }, test: { x: 80, y: 200 }, knowledge: { x: 300, y: 200 }, project: { x: 520, y: 200 }, rag: { x: 300, y: 370 } };

  const isHL = (conn) => {
    if (hoveredConn) return conn === hoveredConn;
    if (hoveredRepo) return conn.from === hoveredRepo || conn.to === hoveredRepo;
    return true;
  };
  const isRepoHL = (id) => {
    if (!hoveredRepo && !hoveredConn) return true;
    if (hoveredRepo === id) return true;
    if (hoveredConn) return hoveredConn.from === id || hoveredConn.to === id;
    if (hoveredRepo) return CONNECTIONS.some(c => (c.from === hoveredRepo && c.to === id) || (c.to === hoveredRepo && c.from === id)) || hoveredRepo === id;
    return false;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>레포 관계도</h2>
          <p style={{ fontSize: 11, color: C.dim }}>레포 또는 연결선에 마우스를 올리면 관계가 강조됩니다</p>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 10, color: C.dim, flexWrap: "wrap" }}>
          <span><span style={{ color: C.green }}>→</span> 쓰기</span>
          <span><span style={{ color: C.cyan }}>→</span> 읽기</span>
          <span><span style={{ color: C.purple }}>- -</span> 규칙</span>
          <span style={{ padding: "2px 8px", border: `1px dashed ${C.green}`, borderRadius: 3, color: C.green }}>교체 가능</span>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, position: "relative", height: 460, overflow: "hidden" }}>
        <svg width="100%" height="100%" viewBox="0 0 680 460" style={{ position: "absolute", top: 0, left: 0 }}>
          <defs>
            {["read","write","config"].map(t => (
              <marker key={t} id={`a-${t}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={t === "read" ? C.cyan : t === "write" ? C.green : C.purple} />
              </marker>
            ))}
          </defs>
          {CONNECTIONS.map((conn, i) => {
            const f = pos[conn.from], t = pos[conn.to];
            const hl = isHL(conn);
            const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
            const dx = t.x - f.x, dy = t.y - f.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = (-dy / len) * 15, py = (dx / len) * 15;
            return (
              <g key={i} onMouseEnter={() => setHoveredConn(conn)} onMouseLeave={() => setHoveredConn(null)} style={{ cursor: "pointer" }}>
                <line x1={f.x+40} y1={f.y+25} x2={t.x+40} y2={t.y+25} stroke={conn.color} strokeWidth={hl ? 2 : 1} strokeDasharray={conn.type === "config" ? "4 3" : "none"} opacity={hl ? 0.8 : 0.12} markerEnd={`url(#a-${conn.type})`} />
                <line x1={f.x+40} y1={f.y+25} x2={t.x+40} y2={t.y+25} stroke="transparent" strokeWidth={16} />
                {hl && (hoveredConn === conn || hoveredRepo) && (
                  <text x={mx+40+px} y={my+25+py} textAnchor="middle" fontSize="9" fill={conn.color} fontFamily="JetBrains Mono" style={{ pointerEvents: "none" }}>{conn.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        {REPOS.map(repo => {
          const p = pos[repo.id]; const hl = isRepoHL(repo.id); const isPrj = repo.id === "project";
          return (
            <div key={repo.id} onMouseEnter={() => setHoveredRepo(repo.id)} onMouseLeave={() => setHoveredRepo(null)} style={{
              position: "absolute", left: p.x, top: p.y, width: 80, padding: "10px 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: hl ? C.surfaceAlt : C.surface,
              border: `${isPrj ? "2px dashed" : "1px solid"} ${hl ? repo.color : C.border}`,
              borderRadius: 8, opacity: hl ? 1 : 0.35, transition: "all 0.2s", cursor: "pointer", zIndex: 2,
            }}>
              <div style={{ fontSize: 20 }}>{repo.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color: hl ? repo.color : C.dim }}>{repo.name}</div>
              <div style={{ fontSize: 8, color: isPrj ? C.green : C.dim, background: isPrj ? `${C.green}15` : "transparent", padding: "1px 6px", borderRadius: 3, border: isPrj ? `1px solid ${C.green}30` : "none" }}>
                {isPrj ? "교체 가능" : "고정"}
              </div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: pos.project.x - 20, top: pos.project.y + 85, width: 120, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: C.green, marginBottom: 2 }}>현재 연결:</div>
          <div style={{ fontSize: 10, color: C.text, background: `${C.green}10`, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.green}30` }}>{activeProject.name}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Box title="권한 매트릭스">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
            <thead><tr><td style={{ padding: 6, color: C.dim }}>from → to</td>{["프로젝트", "지식", "테스트"].map(h => <td key={h} style={{ padding: 6, color: C.dim, textAlign: "center" }}>{h}</td>)}</tr></thead>
            <tbody>
              {[{ from: "프로젝트", perms: ["-", "쓰기", "읽기"] }, { from: "테스트", perms: ["읽기", "읽기", "-"] }, { from: "RAG", perms: ["-", "읽기", "-"] }].map(row => (
                <tr key={row.from}><td style={{ padding: 6, color: C.text, fontWeight: 500 }}>{row.from}</td>
                  {row.perms.map((p, i) => <td key={i} style={{ padding: 6, textAlign: "center", color: p === "쓰기" ? C.green : p === "읽기" ? C.cyan : C.dim }}>{p === "쓰기" ? "✏️ 쓰기" : p === "읽기" ? "👁 읽기" : "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
        <Box title="프로젝트 교체 시 영향">
          {[{ label: "프로젝트 교체 시", items: [".env 수정 → setup.sh → 끝"], color: C.green }, { label: "나머지 4개 레포", items: ["변경 없음 — 전부 재사용"], color: C.dim }].map((g, i) => (
            <div key={i} style={{ padding: 8, background: `${g.color}08`, borderRadius: 4, border: `1px solid ${g.color}20`, marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: g.color, marginBottom: 4 }}>{g.label}</div>
              {g.items.map((t, j) => <div key={j} style={{ fontSize: 10, color: C.dim }}>{i === 0 ? "→" : "="} {t}</div>)}
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}

function ProjectSwap({ activeProject, setActiveProject, swapUrl, setSwapUrl }) {
  const [confirmSwap, setConfirmSwap] = useState(null);
  const [swapStep, setSwapStep] = useState(null);

  const handleSwap = (project) => { setConfirmSwap(project); setSwapStep(null); };
  const STEPS = ["프로젝트 레포 연결 해제", ".env 변수 업데이트", "setup.sh 실행 (config 재생성)", "지식 레포 경로 갱신", "테스트 레포 연결 갱신", "Hook 검증", "완료!"];

  const executeSwap = () => {
    setSwapStep(0);
    let i = 0;
    const iv = setInterval(() => { i++; setSwapStep(i); if (i >= STEPS.length - 1) { clearInterval(iv); setTimeout(() => { setActiveProject(confirmSwap); setConfirmSwap(null); setSwapStep(null); }, 800); } }, 600);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>프로젝트 교체</h2>
        <p style={{ fontSize: 11, color: C.dim }}>프로젝트 레포만 교체하면 나머지 4개 레포는 그대로 재사용됩니다.</p>
      </div>

      <Box title="현재 활성 프로젝트">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: `${C.green}20`, border: `2px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚙️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>{activeProject.name}</div>
            <div style={{ fontSize: 11, color: C.dim }}>{activeProject.url}</div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>도메인: {activeProject.domain}</div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 4, background: `${C.green}20`, border: `1px solid ${C.green}40`, fontSize: 10, color: C.green }}>ACTIVE</div>
        </div>
      </Box>

      <Box title="GitHub URL로 새 프로젝트 연결">
        <div style={{ display: "flex", gap: 8 }}>
          <input value={swapUrl} onChange={e => setSwapUrl(e.target.value)} placeholder="https://github.com/org/repo-name" style={{ flex: 1, padding: "10px 14px", fontSize: 12, fontFamily: "inherit", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }} />
          <button onClick={() => { if (swapUrl.trim()) handleSwap({ name: swapUrl.split("/").pop() || "new-project", url: swapUrl, domain: "새 프로젝트", status: "ready" }); }} style={{ padding: "10px 20px", fontSize: 11, background: C.accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>연결</button>
        </div>
      </Box>

      <Box title="등록된 프로젝트">
        {SAMPLE_PROJECTS.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 6, background: p.name === activeProject.name ? `${C.green}08` : C.bg, border: `1px solid ${p.name === activeProject.name ? C.green + "40" : C.border}`, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.name === activeProject.name ? C.green : C.dim }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{p.name}</div>
              <div style={{ fontSize: 10, color: C.dim }}>{p.domain} · {p.url}</div>
            </div>
            {p.name === activeProject.name ? <span style={{ fontSize: 10, color: C.green }}>활성</span> : (
              <button onClick={() => handleSwap(p)} style={{ padding: "5px 12px", fontSize: 10, background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, cursor: "pointer" }}>전환</button>
            )}
          </div>
        ))}
      </Box>

      {confirmSwap && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, width: 440 }}>
            {swapStep === null ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>프로젝트 교체 확인</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: 12, background: C.bg, borderRadius: 6 }}>
                  <span style={{ color: C.red, fontSize: 12 }}>{activeProject.name}</span>
                  <span style={{ color: C.dim }}>→</span>
                  <span style={{ color: C.green, fontSize: 12 }}>{confirmSwap.name}</span>
                </div>
                <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>교체 시 실행되는 작업:</div>
                {["거버넌스 레포 → 변경 없음", "테스트 레포 → .env 업데이트 + setup.sh 재실행", "지식 레포 → 새 프로젝트용 구조 초기화", "RAG 레포 → 인덱스 경로 갱신"].map((t, i) => (
                  <div key={i} style={{ fontSize: 10, color: C.dim, padding: "4px 8px", background: C.bg, borderRadius: 3, marginBottom: 4 }}>{t}</div>
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <button onClick={() => setConfirmSwap(null)} style={{ padding: "8px 16px", fontSize: 11, background: "transparent", color: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>취소</button>
                  <button onClick={executeSwap} style={{ padding: "8px 16px", fontSize: 11, background: C.accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>교체 실행</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>교체 진행 중...</div>
                {STEPS.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 4, background: i <= swapStep ? `${C.green}10` : C.bg, border: `1px solid ${i <= swapStep ? C.green + "30" : C.border}`, marginBottom: 4 }}>
                    <span style={{ fontSize: 12 }}>{i < swapStep ? "✅" : i === swapStep ? "⏳" : "○"}</span>
                    <span style={{ fontSize: 11, color: i <= swapStep ? C.text : C.dim }}>{step}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SystemStatus({ activeProject }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {REPOS.map(r => (
          <div key={r.id} style={{ background: C.surface, border: `1px solid ${r.id === "project" ? C.green + "60" : C.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{r.icon}</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: r.color }}>{r.name}</div>
            <div style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>{r.id === "project" ? activeProject.name : "정상"}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <Box title="최근 활동">
          {[{ t: "10:35", msg: "PreCompact → HANDOFF.md 생성", ok: true }, { t: "10:34", msg: "check-docs.sh → 문서 누락, 커밋 차단", ok: false }, { t: "10:33", msg: "테스트 피드백 반영 Hook 실행", ok: true }, { t: "10:28", msg: "기능명세서 3건 자동 생성", ok: true }, { t: "10:20", msg: "UserService.java 개발 시작", ok: true }].map((e, i) => (
            <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 10, color: C.dim, minWidth: 40 }}>{e.t}</span>
              <span style={{ fontSize: 10, color: e.ok ? C.dim : C.orange }}>{e.msg}</span>
            </div>
          ))}
        </Box>
        <Box title="건강도">
          {[{ l: "Hook 성공률", v: "94%", c: C.green }, { l: "워크플로우 준수", v: "87%", c: C.orange }, { l: "금일 프롬프트", v: "23개", c: C.cyan }, { l: "권한 위반", v: "0건", c: C.green }].map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 10, color: C.dim }}>{m.l}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: m.c }}>{m.v}</span>
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}

function HookMonitor() {
  const logs = [
    { t: "10:35:12", hook: "PreCompact", script: "generate_handoff.py", exit: 0, ms: 420 },
    { t: "10:34:58", hook: "PreToolUse", script: "check-docs.sh", exit: 2, ms: 85 },
    { t: "10:34:01", hook: "PromptLog", script: "log-prompt.sh", exit: 0, ms: 12 },
    { t: "10:33:45", hook: "PreToolUse", script: "check-docs.sh", exit: 0, ms: 78 },
    { t: "10:32:10", hook: "PromptLog", script: "log-prompt.sh", exit: 0, ms: 8 },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {[{ l: "전체", v: "247", c: C.text }, { l: "성공", v: "232", c: C.green }, { l: "실패", v: "15", c: C.red }, { l: "성공률", v: "93.9%", c: C.green }].map((m, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 10, color: C.dim }}>{m.l}</div>
          </div>
        ))}
      </div>
      <Box title="실시간 Hook 로그">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["시각", "Hook", "스크립트", "Exit", "소요"].map(h => <td key={h} style={{ padding: "6px 8px", fontSize: 9, color: C.dim }}>{h}</td>)}</tr></thead>
          <tbody>{logs.map((l, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: 8, fontSize: 10, color: C.dim }}>{l.t}</td>
              <td style={{ padding: 8, fontSize: 10, color: C.text }}>{l.hook}</td>
              <td style={{ padding: 8, fontSize: 10, color: C.dim }}>{l.script}</td>
              <td style={{ padding: 8 }}><span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, background: l.exit === 0 ? `${C.green}20` : `${C.red}20`, color: l.exit === 0 ? C.green : C.red }}>{l.exit === 0 ? "✅ 0" : "❌ " + l.exit}</span></td>
              <td style={{ padding: 8, fontSize: 10, color: C.dim }}>{l.ms}ms</td>
            </tr>
          ))}</tbody>
        </table>
      </Box>
    </div>
  );
}

function WorkflowTracker() {
  const steps = [
    { step: "1. 코드 작성", status: "done", time: "10:20" },
    { step: "2. 문서 생성 (7종)", status: "done", time: "10:28" },
    { step: "3. 인수인계 (HANDOFF.md)", status: "done", time: "10:30" },
    { step: "4. 테스트 (3 시나리오)", status: "active", time: "10:33~" },
    { step: "5. 테스트 피드백 반영", status: "pending", time: "-" },
    { step: "6. 사용자 검증", status: "pending", time: "-" },
    { step: "7. PR → Codex 리뷰", status: "pending", time: "-" },
    { step: "8. 보안 리뷰 → 머지", status: "pending", time: "-" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Box title="현재 워크플로우: 기능 개발">
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: s.status === "active" ? `${C.accent}15` : "transparent", border: `1px solid ${s.status === "active" ? C.accent : C.border}`, borderRadius: 4, marginBottom: 4 }}>
            <span style={{ fontSize: 14, width: 20, color: s.status === "done" ? C.green : s.status === "active" ? C.accent : C.dim }}>{s.status === "done" ? "✅" : s.status === "active" ? "▶" : "○"}</span>
            <span style={{ fontSize: 12, flex: 1, color: s.status === "pending" ? C.dim : C.text }}>{s.step}</span>
            <span style={{ fontSize: 10, color: C.dim }}>{s.time}</span>
          </div>
        ))}
      </Box>
      <div style={{ background: `${C.orange}10`, border: `1px solid ${C.orange}30`, borderRadius: 6, padding: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.orange, marginBottom: 6 }}>⚠️ 단계 건너뜀 감지</div>
        <div style={{ fontSize: 10, color: C.dim }}>문서 생성 없이 테스트로 넘어가거나, 테스트 없이 PR을 만들면 여기 경고가 표시됩니다.</div>
      </div>
    </div>
  );
}

function PromptHistory() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
        {[{ l: "오늘 프롬프트", v: "23개", c: C.cyan }, { l: "평균 길이", v: "45 tokens", c: C.text }, { l: "발생 레포", v: "프로젝트:18 / 테스트:5", c: C.dim }].map((m, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{m.l}</div>
          </div>
        ))}
      </div>
      <Box title="프롬프트 로그">
        {[{ t: "10:35", repo: "프로젝트", prompt: "UserService에 페이지네이션 추가해", c: C.green }, { t: "10:33", repo: "테스트", prompt: "local 환경에서 사용자관리 테스트해줘", c: C.cyan }, { t: "10:28", repo: "프로젝트", prompt: "CLAUDE.md 참고해서 관련 문서 생성해", c: C.green }, { t: "10:20", repo: "프로젝트", prompt: "직원 목록 조회 API 만들어", c: C.green }].map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 10, color: C.dim, minWidth: 36 }}>{p.t}</span>
            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, background: `${p.c}15`, color: p.c, border: `1px solid ${p.c}30` }}>{p.repo}</span>
            <span style={{ fontSize: 11, color: C.text }}>{p.prompt}</span>
          </div>
        ))}
      </Box>
      <Box title="반복 패턴 감지">
        {[{ p: '"문서 생성해"', cnt: "7회/주", s: "Hook 자동화 권장" }, { p: '"테스트해줘"', cnt: "12회/주", s: "자동 트리거 검토" }].map((r, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: 11, color: C.text }}>{r.p}</span>
            <span style={{ fontSize: 10, color: C.orange }}>{r.cnt}</span>
            <span style={{ fontSize: 10, color: C.accent }}>{r.s}</span>
          </div>
        ))}
      </Box>
    </div>
  );
}

function Box({ title, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.dim, marginBottom: 10, letterSpacing: 0.5 }}>{title}</div>
      {children}
    </div>
  );
}
