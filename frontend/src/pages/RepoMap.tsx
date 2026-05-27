import { useState } from 'react';
import { C } from '../constants/colors';
import { REPOS, CONNECTIONS } from '../constants/repos';
import { Box } from '../components/shared/Box';
import { useApi } from '../hooks/useApi';
import type { Project, RepoConnection } from '../types';

interface ProjectStructure {
  repoPath: string;
  exists: boolean;
  saasMode?: boolean;
  message?: string;
  claude?: {
    exists: boolean;
    rules?: number;
    agents?: number;
    hooks?: number;
    skills?: number;
    hasSettings?: boolean;
  };
  aiops?: {
    exists: boolean;
    categories: { name: string; fileCount: number }[];
  };
  code?: { name: string; fileCount: number }[];
  docs?: { name: string; fileCount: number }[];
  tests?: { name: string; fileCount: number }[];
  rootMd?: number;
}

interface RepoMapProps {
  activeProject: Project;
}

const NODE_W = 80;
const NODE_H = 70;

export function RepoMap({ activeProject }: RepoMapProps) {
  const [hoveredConn, setHoveredConn] = useState<RepoConnection | null>(null);
  const [hoveredRepo, setHoveredRepo] = useState<string | null>(null);
  const { data: structure } = useApi<ProjectStructure>('/projects/structure', { repoPath: '', exists: false });

  const pos: Record<string, { x: number; y: number }> = {
    governance: { x: 300, y: 30 },
    test: { x: 80, y: 200 },
    knowledge: { x: 300, y: 200 },
    project: { x: 520, y: 200 },
    rag: { x: 300, y: 370 },
  };

  const center = (id: string) => ({
    x: pos[id].x + NODE_W / 2,
    y: pos[id].y + NODE_H / 2,
  });

  const isHL = (conn: RepoConnection) => {
    if (hoveredConn) return conn === hoveredConn;
    if (hoveredRepo) return conn.from === hoveredRepo || conn.to === hoveredRepo;
    return true;
  };

  const isRepoHL = (id: string) => {
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
          <p style={{ fontSize: 12, color: C.dim }}>레포 또는 연결선에 마우스를 올리면 관계가 강조됩니다</p>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 11, color: C.dim, flexWrap: "wrap" }}>
          <span><span style={{ color: C.green }}>-</span> 쓰기</span>
          <span><span style={{ color: C.cyan }}>-</span> 읽기</span>
          <span><span style={{ color: C.purple }}>- -</span> 규칙</span>
          <span style={{ padding: "2px 8px", border: `1px dashed ${C.green}`, borderRadius: 4, color: C.green }}>교체 가능</span>
        </div>
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, position: "relative", width: 680, height: 460, overflow: "hidden", margin: "0 auto" }}>
        <svg width={680} height={460} style={{ position: "absolute", top: 0, left: 0 }}>
          <defs>
            {(["read", "write", "config"] as const).map(t => (
              <marker key={t} id={`a-${t}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={t === "read" ? C.cyan : t === "write" ? C.green : C.purple} />
              </marker>
            ))}
          </defs>
          {CONNECTIONS.map((conn, i) => {
            const f = center(conn.from), t = center(conn.to);
            const hl = isHL(conn);
            const mx = (f.x + t.x) / 2, my = (f.y + t.y) / 2;
            const dx = t.x - f.x, dy = t.y - f.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const px = (-dy / len) * 15, py = (dx / len) * 15;
            return (
              <g key={i} onMouseEnter={() => setHoveredConn(conn)} onMouseLeave={() => setHoveredConn(null)} style={{ cursor: "pointer" }}>
                <line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke={conn.color} strokeWidth={hl ? 2 : 1} strokeDasharray={conn.type === "config" ? "4 3" : "none"} opacity={hl ? 0.8 : 0.15} markerEnd={`url(#a-${conn.type})`} />
                <line x1={f.x} y1={f.y} x2={t.x} y2={t.y} stroke="transparent" strokeWidth={16} />
                {hl && (hoveredConn === conn || hoveredRepo) && (
                  <text x={mx + px} y={my + py} textAnchor="middle" fontSize="10" fill={conn.color} style={{ pointerEvents: "none" }}>{conn.label}</text>
                )}
              </g>
            );
          })}
        </svg>
        {REPOS.map(repo => {
          const p = pos[repo.id]; const hl = isRepoHL(repo.id); const isPrj = repo.id === "project";
          return (
            <div key={repo.id} onMouseEnter={() => setHoveredRepo(repo.id)} onMouseLeave={() => setHoveredRepo(null)} style={{
              position: "absolute", left: p.x, top: p.y, width: NODE_W, padding: "10px 0",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              background: hl ? C.surface : C.surfaceAlt,
              border: `${isPrj ? "2px dashed" : "1px solid"} ${hl ? repo.color : C.border}`,
              borderRadius: 8, opacity: hl ? 1 : 0.4, transition: "all 0.2s", cursor: "pointer", zIndex: 2,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: `${repo.color}15`, color: repo.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
              }}>{repo.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: hl ? C.text : C.dim }}>{repo.name}</div>
              <div style={{ fontSize: 9, color: isPrj ? C.green : C.dim, background: isPrj ? `${C.green}10` : "transparent", padding: "1px 6px", borderRadius: 3, border: isPrj ? `1px solid ${C.green}30` : "none" }}>
                {isPrj ? "교체 가능" : "고정"}
              </div>
            </div>
          );
        })}
        <div style={{ position: "absolute", left: pos.project.x - 20, top: pos.project.y + 85, width: 120, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: C.green, marginBottom: 2 }}>현재 연결:</div>
          <div style={{ fontSize: 11, color: C.text, background: `${C.green}08`, padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.green}30` }}>{activeProject.name}</div>
        </div>
      </div>

      <ActiveProjectStructure structure={structure} projectName={activeProject.name} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }} key="permission-row">
        <Box title="권한 매트릭스">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead><tr><td style={{ padding: 6, color: C.dim }}>from → to</td>{["프로젝트", "지식", "테스트"].map(h => <td key={h} style={{ padding: 6, color: C.dim, textAlign: "center" }}>{h}</td>)}</tr></thead>
            <tbody>
              {[{ from: "프로젝트", perms: ["-", "쓰기", "읽기"] }, { from: "테스트", perms: ["읽기", "읽기", "-"] }, { from: "RAG", perms: ["-", "읽기", "-"] }].map(row => (
                <tr key={row.from}><td style={{ padding: 6, color: C.text, fontWeight: 500 }}>{row.from}</td>
                  {row.perms.map((p, i) => <td key={i} style={{ padding: 6, textAlign: "center", color: p === "쓰기" ? C.green : p === "읽기" ? C.cyan : C.dim, fontWeight: p !== "-" ? 500 : 400 }}>{p === "-" ? "\u2014" : p}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
        <Box title="프로젝트 교체 시 영향">
          {[{ label: "프로젝트 교체 시", items: [".env 수정 → setup.sh → 끝"], color: C.green }, { label: "나머지 4개 레포", items: ["변경 없음 — 전부 재사용"], color: C.dim }].map((g, i) => (
            <div key={i} style={{ padding: 10, background: `${g.color}06`, borderRadius: 6, border: `1px solid ${g.color}20`, marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: g.color, marginBottom: 4 }}>{g.label}</div>
              {g.items.map((t, j) => <div key={j} style={{ fontSize: 12, color: C.dim }}>{i === 0 ? "\u2192" : "="} {t}</div>)}
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}


function ActiveProjectStructure({
  structure,
  projectName,
}: { structure: ProjectStructure; projectName: string }) {
  if (!structure) return null;

  if (structure.saasMode) {
    return (
      <Box title={`활성 프로젝트 구조 — ${projectName}`}>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
          {structure.message || 'SaaS 모드에서는 사용자 로컬 디렉토리를 서버가 직접 스캔할 수 없습니다.'}
          <br />
          repoPath: <code style={{ color: C.text, fontFamily: 'monospace' }}>
            {structure.repoPath || '(미설정)'}
          </code>
        </div>
      </Box>
    );
  }

  if (!structure.exists) {
    return (
      <Box title={`활성 프로젝트 구조 — ${projectName}`}>
        <div style={{ fontSize: 12, color: C.dim, textAlign: 'center', padding: 16 }}>
          repoPath가 존재하지 않습니다 — "프로젝트 교체" 탭에서 경로를 등록하세요.
        </div>
      </Box>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
      <Box title=".claude/ — Claude Code 설정">
        {structure.claude?.exists ? (
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8 }}>
            <StructRow k="rules (규칙)" v={structure.claude.rules ?? 0} color={C.purple} />
            <StructRow k="agents (서브에이전트)" v={structure.claude.agents ?? 0} color={C.cyan} />
            <StructRow k="hooks (스크립트)" v={structure.claude.hooks ?? 0} color={C.green} />
            <StructRow k="skills (스킬)" v={structure.claude.skills ?? 0} color={C.orange} />
            <StructRow k="settings.json" v={structure.claude.hasSettings ? '✓' : '–'} color={structure.claude.hasSettings ? C.green : C.dim} />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.dim, textAlign: 'center', padding: 12 }}>
            .claude/ 디렉토리 없음
          </div>
        )}
      </Box>

      <Box title=".aiops/ — Track 수집 데이터">
        {structure.aiops?.exists && structure.aiops.categories.length > 0 ? (
          <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8 }}>
            {structure.aiops.categories.map((c) => (
              <StructRow key={c.name} k={c.name} v={`${c.fileCount}일치`} color={C.cyan} />
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.dim, textAlign: 'center', padding: 12 }}>
            .aiops/ 디렉토리 없음 — install.sh 실행 후 첫 Hook 발생 시 자동 생성
          </div>
        )}
      </Box>

      <Box title="코드 / 문서 / 테스트">
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>코드 디렉토리</div>
        {(structure.code || []).map((c) => (
          <StructRow key={c.name} k={c.name} v={`${c.fileCount}개`} color={C.green} />
        ))}
        {(!structure.code || structure.code.length === 0) && <StructEmpty />}

        <div style={{ fontSize: 11, color: C.dim, marginTop: 8, marginBottom: 4 }}>문서</div>
        {(structure.docs || []).map((d) => (
          <StructRow key={d.name} k={d.name} v={`${d.fileCount}.md`} color={C.orange} />
        ))}
        {structure.rootMd !== undefined && structure.rootMd > 0 && (
          <StructRow k="루트 *.md" v={`${structure.rootMd}개`} color={C.orange} />
        )}
        {(!structure.docs || structure.docs.length === 0) && (structure.rootMd ?? 0) === 0 && <StructEmpty />}

        {(structure.tests || []).length > 0 && (
          <>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 8, marginBottom: 4 }}>테스트</div>
            {(structure.tests || []).map((t) => (
              <StructRow key={t.name} k={t.name} v={`${t.fileCount}개`} color={C.cyan} />
            ))}
          </>
        )}
      </Box>
    </div>
  );
}

function StructRow({ k, v, color }: { k: string; v: number | string; color: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: C.dim, fontSize: 11 }}>{k}</span>
      <span style={{ color, fontWeight: 600, fontSize: 12, fontFamily: 'monospace' }}>{v}</span>
    </div>
  );
}

function StructEmpty() {
  return (
    <div style={{ fontSize: 11, color: C.dim, fontStyle: 'italic' }}>(없음)</div>
  );
}
