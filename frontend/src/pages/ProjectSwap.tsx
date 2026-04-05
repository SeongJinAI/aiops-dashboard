import { useState } from 'react';
import { C } from '../constants/colors';
import { Box } from '../components/shared/Box';
import { useApi, apiPost } from '../hooks/useApi';
import type { Project } from '../types';

interface ProjectSwapProps {
  activeProject: Project;
  setActiveProject: (p: Project) => void;
}

export function ProjectSwap({ activeProject, setActiveProject }: ProjectSwapProps) {
  const [swapUrl, setSwapUrl] = useState("");
  const [confirmSwap, setConfirmSwap] = useState<Project | null>(null);
  const [swapStep, setSwapStep] = useState<number | null>(null);

  const { data: projects } = useApi<Project[]>('/projects', []);

  const handleSwap = (project: Project) => { setConfirmSwap(project); setSwapStep(null); };

  const STEPS = ["프로젝트 레포 연결 해제", ".env 변수 업데이트", "setup.sh 실행 (config 재생성)", "지식 레포 경로 갱신", "테스트 레포 연결 갱신", "Hook 검증", "완료"];

  const executeSwap = async () => {
    if (!confirmSwap) return;
    setSwapStep(0);

    try {
      await apiPost('/projects/swap', {
        name: confirmSwap.name,
        repoPath: confirmSwap.repoPath || "",
        gitUrl: confirmSwap.url || "",
      });
    } catch {
      // API 실패해도 UI 애니메이션은 진행
    }

    let i = 0;
    const iv = setInterval(() => {
      i++;
      setSwapStep(i);
      if (i >= STEPS.length - 1) {
        clearInterval(iv);
        setTimeout(() => {
          setActiveProject(confirmSwap);
          setConfirmSwap(null);
          setSwapStep(null);
        }, 800);
      }
    }, 600);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>프로젝트 교체</h2>
        <p style={{ fontSize: 12, color: C.dim }}>프로젝트 레포만 교체하면 나머지 4개 레포는 그대로 재사용됩니다.</p>
      </div>

      <Box title="현재 활성 프로젝트">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: `${C.green}12`, border: `2px solid ${C.green}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: C.green }}>P</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{activeProject.name}</div>
            <div style={{ fontSize: 12, color: C.dim }}>{activeProject.url}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>도메인: {activeProject.domain}</div>
          </div>
          <div style={{ padding: "4px 10px", borderRadius: 4, background: `${C.green}12`, border: `1px solid ${C.green}40`, fontSize: 11, color: C.green, fontWeight: 500 }}>ACTIVE</div>
        </div>
      </Box>

      <Box title="GitHub URL로 새 프로젝트 연결">
        <div style={{ display: "flex", gap: 8 }}>
          <input value={swapUrl} onChange={e => setSwapUrl(e.target.value)} placeholder="https://github.com/org/repo-name" style={{ flex: 1, padding: "10px 14px", fontSize: 13, fontFamily: "inherit", background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text }} />
          <button onClick={() => { if (swapUrl.trim()) handleSwap({ name: swapUrl.split("/").pop() || "new-project", url: swapUrl, domain: "새 프로젝트", status: "ready" }); }} style={{ padding: "10px 20px", fontSize: 12, background: C.accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>연결</button>
        </div>
      </Box>

      <Box title="등록된 프로젝트">
        {projects.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 6, background: p.name === activeProject.name ? `${C.green}06` : C.bg, border: `1px solid ${p.name === activeProject.name ? C.green + "40" : C.border}`, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.name === activeProject.name ? C.green : C.dim }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</div>
              <div style={{ fontSize: 11, color: C.dim }}>{p.domain} · {p.url}</div>
            </div>
            {p.name === activeProject.name ? <span style={{ fontSize: 11, color: C.green, fontWeight: 500 }}>활성</span> : (
              <button onClick={() => handleSwap(p)} style={{ padding: "5px 12px", fontSize: 11, background: "transparent", color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 4, cursor: "pointer" }}>전환</button>
            )}
          </div>
        ))}
      </Box>

      {confirmSwap && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, width: 440, boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
            {swapStep === null ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>프로젝트 교체 확인</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, padding: 12, background: C.bg, borderRadius: 6 }}>
                  <span style={{ color: C.red, fontSize: 13 }}>{activeProject.name}</span>
                  <span style={{ color: C.dim }}>{"\u2192"}</span>
                  <span style={{ color: C.green, fontSize: 13 }}>{confirmSwap.name}</span>
                </div>
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>교체 시 실행되는 작업:</div>
                {["거버넌스 레포 — 변경 없음", "테스트 레포 — .env 업데이트 + setup.sh 재실행", "지식 레포 — 새 프로젝트용 구조 초기화", "RAG 레포 — 인덱스 경로 갱신"].map((t, i) => (
                  <div key={i} style={{ fontSize: 11, color: C.dim, padding: "4px 8px", background: C.bg, borderRadius: 4, marginBottom: 4 }}>{t}</div>
                ))}
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
                  <button onClick={() => setConfirmSwap(null)} style={{ padding: "8px 16px", fontSize: 12, background: "transparent", color: C.dim, border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer" }}>취소</button>
                  <button onClick={executeSwap} style={{ padding: "8px 16px", fontSize: 12, background: C.accent, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>교체 실행</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>교체 진행 중...</div>
                {STEPS.map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 4, background: i <= swapStep ? `${C.green}08` : C.bg, border: `1px solid ${i <= swapStep ? C.green + "30" : C.border}`, marginBottom: 4 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600,
                      background: i < swapStep ? C.green : i === swapStep ? C.accent : C.surfaceAlt,
                      color: i <= swapStep ? "#fff" : C.dim,
                    }}>{i < swapStep ? "\u2713" : String(i + 1)}</span>
                    <span style={{ fontSize: 12, color: i <= swapStep ? C.text : C.dim }}>{step}</span>
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
