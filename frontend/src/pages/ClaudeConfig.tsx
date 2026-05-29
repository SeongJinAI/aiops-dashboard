import { useState } from 'react';
import { C } from '../constants/colors';
import { Box } from '../ui/primitives';
import { useApi } from '../hooks/useApi';
import type { ClaudeConfigData } from '../types';

const EMPTY: ClaudeConfigData = {
  scope: "", hasClaude: false,
  settings: { exists: false, permissions: {}, plugins: [], raw: null },
  claudeMd: { exists: false, content: "", info: {} },
  rules: [], agents: [], skills: [], hooks: [],
  summary: { totalItems: 0 },
};

type ScopeTab = "project" | "global";

// 카테고리 뱃지 색상
const CAT_COLORS: Record<string, string> = {
  settings: C.accent,
  rules: C.orange,
  agents: C.cyan,
  skills: C.pink,
  hooks: C.purple,
  claudeMd: C.green,
  mcp: C.red,
};

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11, padding: "2px 8px", borderRadius: 4,
      background: `${color}15`, color, fontWeight: 500,
    }}>{label}</span>
  );
}

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: 14, textAlign: "center", flex: 1, minWidth: 0,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>{message}</div>;
}

function CodeBlock({ content, maxHeight = 200 }: { content: string; maxHeight?: number }) {
  return (
    <pre style={{
      background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6,
      padding: 12, fontSize: 12, lineHeight: 1.5, overflow: "auto",
      maxHeight, whiteSpace: "pre-wrap", wordBreak: "break-all",
      color: C.text, margin: 0,
    }}>{content}</pre>
  );
}

function ExpandableItem({ title, badge, children, defaultOpen = false }: {
  title: string; badge?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 8 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          padding: "10px 14px", cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "space-between",
          background: open ? C.surfaceAlt : C.surface, borderRadius: open ? "6px 6px 0 0" : 6,
          transition: "background 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace" }}>{open ? "v" : ">"}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{title}</span>
          {badge && <Badge label={badge} color={CAT_COLORS.settings} />}
        </div>
      </div>
      {open && (
        <div style={{ padding: 14, borderTop: `1px solid ${C.border}` }}>
          {children}
        </div>
      )}
    </div>
  );
}

// --- 서브 섹션 컴포넌트 ---

function SettingsSection({ data }: { data: ClaudeConfigData }) {
  const { settings } = data;
  if (!settings.exists) return <EmptyState message="settings 파일이 없습니다" />;

  const allowCount = settings.permissions.allow?.length ?? 0;
  const denyCount = settings.permissions.deny?.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge label={`허용 권한: ${allowCount}개`} color={C.green} />
        <Badge label={`거부 권한: ${denyCount}개`} color={C.red} />
        <Badge label={`플러그인: ${settings.plugins.length}개`} color={C.accent} />
      </div>

      {settings.plugins.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}>플러그인</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {settings.plugins.map((p, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 12,
                background: `${C.accent}12`, color: C.accent, fontFamily: "monospace",
              }}>{p}</span>
            ))}
          </div>
        </div>
      )}

      {allowCount > 0 && (
        <ExpandableItem title={`허용 권한 (${allowCount}개)`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {settings.permissions.allow!.map((p, i) => (
              <div key={i} style={{
                fontSize: 12, fontFamily: "monospace", padding: "4px 8px",
                background: `${C.green}08`, borderRadius: 4, color: C.text,
              }}>{p}</div>
            ))}
          </div>
        </ExpandableItem>
      )}

      {denyCount > 0 && (
        <ExpandableItem title={`거부 권한 (${denyCount}개)`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {settings.permissions.deny!.map((p, i) => (
              <div key={i} style={{
                fontSize: 12, fontFamily: "monospace", padding: "4px 8px",
                background: `${C.red}08`, borderRadius: 4, color: C.text,
              }}>{p}</div>
            ))}
          </div>
        </ExpandableItem>
      )}
    </div>
  );
}

function RulesSection({ data }: { data: ClaudeConfigData }) {
  if (data.rules.length === 0) return <EmptyState message="규칙 파일이 없습니다" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {data.rules.map((r, i) => (
        <ExpandableItem key={i} title={r.name} badge={`${(r.size / 1024).toFixed(1)}KB`}>
          <CodeBlock content={r.content} maxHeight={300} />
        </ExpandableItem>
      ))}
    </div>
  );
}

function AgentsSection({ data }: { data: ClaudeConfigData }) {
  if (data.agents.length === 0) return <EmptyState message="에이전트가 없습니다" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {data.agents.map((a, i) => (
        <ExpandableItem key={i} title={a.name} badge={`${(a.size / 1024).toFixed(1)}KB`}>
          <CodeBlock content={a.content} maxHeight={300} />
        </ExpandableItem>
      ))}
    </div>
  );
}

function SkillsSection({ data }: { data: ClaudeConfigData }) {
  if (data.skills.length === 0) return <EmptyState message="스킬이 없습니다" />;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${C.border}` }}>
          {["스킬명", "설명", "수정일"].map(h => (
            <td key={h} style={{ padding: "8px 10px", fontSize: 11, color: C.dim, fontWeight: 500 }}>{h}</td>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.skills.map((s, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${C.surfaceAlt}` }}>
            <td style={{ padding: "8px 10px", fontSize: 12, fontWeight: 500, fontFamily: "monospace", color: C.text }}>
              /{s.name}
            </td>
            <td style={{ padding: "8px 10px", fontSize: 12, color: C.dim }}>
              {s.description || "-"}
            </td>
            <td style={{ padding: "8px 10px", fontSize: 11, color: C.dim }}>
              {s.modified ? new Date(s.modified).toLocaleDateString("ko-KR") : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HooksSection({ data }: { data: ClaudeConfigData }) {
  if (data.hooks.length === 0) return <EmptyState message="Hook 설정이 없습니다" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.hookScripts && data.hookScripts.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.dim, marginBottom: 6 }}>스크립트 파일 ({data.hookScripts.length}개)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {data.hookScripts.map((h, i) => (
              <span key={i} style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 12,
                background: `${C.purple}12`, color: C.purple, fontFamily: "monospace",
              }}>{h.name}</span>
            ))}
          </div>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {["이벤트", "매처", "커맨드"].map(h => (
              <td key={h} style={{ padding: "8px 10px", fontSize: 11, color: C.dim, fontWeight: 500 }}>{h}</td>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.hooks.map((h, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${C.surfaceAlt}` }}>
              <td style={{ padding: "8px 10px" }}>
                <Badge label={h.event} color={CAT_COLORS.hooks} />
              </td>
              <td style={{ padding: "8px 10px", fontSize: 12, fontFamily: "monospace", color: C.text }}>
                {h.matcher || "*"}
              </td>
              <td style={{ padding: "8px 10px", fontSize: 11, fontFamily: "monospace", color: C.dim, maxWidth: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.command}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaudeMdSection({ data }: { data: ClaudeConfigData }) {
  if (!data.claudeMd.exists) return <EmptyState message="CLAUDE.md 파일이 없습니다" />;

  return (
    <div>
      {data.claudeMd.info.modified && (
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 8 }}>
          최종 수정: {new Date(data.claudeMd.info.modified).toLocaleString("ko-KR")}
          {data.claudeMd.info.size && ` | ${(data.claudeMd.info.size / 1024).toFixed(1)}KB`}
        </div>
      )}
      <CodeBlock content={data.claudeMd.content} maxHeight={400} />
    </div>
  );
}

function McpSection({ data }: { data: ClaudeConfigData }) {
  if (!data.mcp || !data.mcp.exists) return <EmptyState message="MCP 설정이 없습니다" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {data.mcp.servers.map((s, i) => (
          <span key={i} style={{
            fontSize: 12, padding: "4px 12px", borderRadius: 12,
            background: `${C.red}12`, color: C.red, fontFamily: "monospace",
          }}>{s}</span>
        ))}
      </div>
      {data.mcp.raw && (
        <ExpandableItem title="전체 설정 보기">
          <CodeBlock content={JSON.stringify(data.mcp.raw, null, 2)} maxHeight={300} />
        </ExpandableItem>
      )}
    </div>
  );
}

// --- 비교 매트릭스 ---

function ComparisonMatrix({ project, global: glob }: { project: ClaudeConfigData; global: ClaudeConfigData }) {
  const rows = [
    { label: "Settings", icon: "S", projectVal: project.settings.exists, globalVal: glob.settings.exists, pCount: (project.settings.permissions.allow?.length ?? 0) + project.settings.plugins.length, gCount: (glob.settings.permissions.allow?.length ?? 0) + glob.settings.plugins.length },
    { label: "Rules", icon: "R", projectVal: project.rules.length > 0, globalVal: glob.rules.length > 0, pCount: project.rules.length, gCount: glob.rules.length },
    { label: "Agents", icon: "A", projectVal: project.agents.length > 0, globalVal: glob.agents.length > 0, pCount: project.agents.length, gCount: glob.agents.length },
    { label: "Skills", icon: "K", projectVal: project.skills.length > 0, globalVal: glob.skills.length > 0, pCount: project.skills.length, gCount: glob.skills.length },
    { label: "Hooks", icon: "H", projectVal: project.hooks.length > 0, globalVal: glob.hooks.length > 0, pCount: project.hooks.length, gCount: glob.hooks.length },
    { label: "CLAUDE.md", icon: "C", projectVal: project.claudeMd.exists, globalVal: glob.claudeMd.exists, pCount: project.claudeMd.exists ? 1 : 0, gCount: glob.claudeMd.exists ? 1 : 0 },
    { label: "MCP", icon: "M", projectVal: !!project.mcp?.exists, globalVal: false, pCount: project.mcp?.servers.length ?? 0, gCount: 0 },
  ];

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${C.border}` }}>
          {["설정 항목", "프로젝트", "글로벌", "마이그레이션"].map(h => (
            <td key={h} style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: C.dim, textAlign: "center" }}>{h}</td>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          // 프로젝트에만 있고 글로벌에 없으면 마이그레이션 후보
          const migratable = r.projectVal && !r.globalVal && r.label !== "MCP" && r.label !== "CLAUDE.md";
          return (
            <tr key={i} style={{ borderBottom: `1px solid ${C.surfaceAlt}` }}>
              <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 500, color: C.text, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 24, height: 24, borderRadius: 6, display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                  background: `${C.accent}15`, color: C.accent,
                }}>{r.icon}</span>
                {r.label}
              </td>
              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                {r.projectVal
                  ? <span style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{r.pCount}개</span>
                  : <span style={{ fontSize: 12, color: C.dim }}>-</span>
                }
              </td>
              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                {r.globalVal
                  ? <span style={{ fontSize: 12, fontWeight: 600, color: C.purple }}>{r.gCount}개</span>
                  : <span style={{ fontSize: 12, color: C.dim }}>-</span>
                }
              </td>
              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                {migratable && <Badge label="마이그레이션 가능" color={C.orange} />}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- 메인 컴포넌트 ---

export function ClaudeConfig() {
  const { data: allData, loading } = useApi<{ project: ClaudeConfigData; global: ClaudeConfigData }>(
    '/claude-config/all',
    { project: EMPTY, global: EMPTY },
  );
  const [scopeTab, setScopeTab] = useState<ScopeTab>("project");

  const project = allData.project;
  const glob = allData.global;
  const current = scopeTab === "project" ? project : glob;

  if (loading) {
    return <div style={{ padding: 40, textAlign: "center", color: C.dim }}>설정 스캔 중...</div>;
  }

  const projectStats = [
    { l: "전체 항목", v: project.summary.totalItems, c: C.text },
    { l: "Rules", v: project.rules.length, c: C.orange },
    { l: "Agents", v: project.agents.length, c: C.cyan },
    { l: "Skills", v: project.skills.length, c: C.pink },
  ];

  const globalStats = [
    { l: "전체 항목", v: glob.summary.totalItems, c: C.text },
    { l: "Rules", v: glob.rules.length, c: C.orange },
    { l: "Skills", v: glob.skills.length, c: C.pink },
    { l: "Hooks", v: glob.hooks.length, c: C.purple },
  ];

  const stats = scopeTab === "project" ? projectStats : globalStats;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 헤더: 프로젝트 정보 + 범위 토글 */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px",
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {scopeTab === "project" ? (project.repoName || "프로젝트") : "글로벌 (거버넌스)"}
          </div>
          <div style={{ fontSize: 11, color: C.dim, marginTop: 2, fontFamily: "monospace" }}>
            {scopeTab === "project" ? (project.repoPath || "-") : (glob.sourcePath || "-")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, background: C.surfaceAlt, borderRadius: 6, padding: 3 }}>
          {(["project", "global"] as ScopeTab[]).map(t => (
            <button
              key={t}
              onClick={() => setScopeTab(t)}
              style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 4, border: "none", cursor: "pointer",
                fontWeight: scopeTab === t ? 600 : 400,
                background: scopeTab === t ? C.surface : "transparent",
                color: scopeTab === t ? C.accent : C.dim,
                boxShadow: scopeTab === t ? `0 1px 3px ${C.border}` : "none",
                transition: "all 0.15s",
              }}
            >
              {t === "project" ? "프로젝트" : "글로벌"}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {stats.map((m, i) => (
          <StatCard key={i} label={m.l} value={m.v} color={m.c} />
        ))}
      </div>

      {/* 비교 매트릭스 */}
      <Box title="프로젝트 vs 글로벌 설정 비교">
        <ComparisonMatrix project={project} global={glob} />
      </Box>

      {/* 상세 섹션 */}
      {scopeTab === "project" && !project.hasClaude && (
        <div style={{
          background: `${C.orange}08`, border: `1px solid ${C.orange}30`, borderRadius: 8,
          padding: 16, fontSize: 13, color: C.orange, textAlign: "center",
        }}>
          이 프로젝트에 .claude/ 디렉토리가 없습니다. 프로젝트 범위 설정을 추가하려면 .claude/ 디렉토리를 생성하세요.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Box title={`Settings ${current.settings.exists ? "" : "(없음)"}`}>
          <SettingsSection data={current} />
        </Box>

        <Box title={`CLAUDE.md ${current.claudeMd.exists ? "" : "(없음)"}`}>
          <ClaudeMdSection data={current} />
        </Box>
      </div>

      <Box title={`Rules (${current.rules.length}개)`}>
        <RulesSection data={current} />
      </Box>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Box title={`Agents (${current.agents.length}개)`}>
          <AgentsSection data={current} />
        </Box>

        <Box title={`Skills (${current.skills.length}개)`}>
          <SkillsSection data={current} />
        </Box>
      </div>

      <Box title={`Hooks (${current.hooks.length}개)`}>
        <HooksSection data={current} />
      </Box>

      {scopeTab === "project" && (
        <Box title={`MCP 서버 ${current.mcp?.exists ? `(${current.mcp.servers.length}개)` : "(없음)"}`}>
          <McpSection data={current} />
        </Box>
      )}
    </div>
  );
}
