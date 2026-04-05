import { C } from '../constants/colors';
import { REPOS } from '../constants/repos';
import { Box } from '../components/shared/Box';
import { useApi } from '../hooks/useApi';
import type { Project, HealthData, GitStats, DocsData, TestData, PromptStats } from '../types';

interface SystemStatusProps {
  activeProject: Project;
}

const DEFAULT_HEALTH: HealthData = {
  status: "ok",
  activeProject: null,
  hooks: { total: 0, success: 0, failed: 0, successRate: 0 },
  prompts: { total: 0, avgTokens: 0 },
  workflow: { compliance: 0 },
  recentActivity: [],
};

const DEFAULT_GIT: GitStats = { totalCommits: 0, currentBranch: "-", last7days: 0, hotspots: [] };
const DEFAULT_DOCS: DocsData = { total: 0, categories: {}, files: [] };
const DEFAULT_TEST: TestData = { total: 0, passCount: 0, passRate: 0, environments: {}, results: [] };
const DEFAULT_PROMPT: PromptStats = { total: 0, today: 0, avgTokens: 0, byRepo: [] };

export function SystemStatus({ activeProject }: SystemStatusProps) {
  const { data: health } = useApi<HealthData>('/health', DEFAULT_HEALTH);
  const { data: gitStats } = useApi<GitStats>('/repos/project/stats', DEFAULT_GIT);
  const { data: docs } = useApi<DocsData>('/repos/project/docs', DEFAULT_DOCS);
  const { data: tests } = useApi<TestData>('/repos/test/results', DEFAULT_TEST);
  const { data: promptStats } = useApi<PromptStats>('/repos/prompts/stats', DEFAULT_PROMPT);

  const recentActivity = health.recentActivity.map(a => ({
    t: new Date(a.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    msg: `${a.hook} → ${a.script}${a.error ? ` (${a.error})` : ''}`,
    ok: a.exit === 0,
  }));

  const repoStatus: Record<string, string> = {
    project: `${gitStats.currentBranch} · ${gitStats.last7days}commits/7d`,
    test: tests.total > 0 ? `${tests.passRate}% pass (${tests.total})` : "대기",
    knowledge: docs.total > 0 ? `문서 ${docs.total}개` : "대기",
    governance: "정상",
    rag: "대기",
  };

  const summaryCards = [
    { l: "총 커밋", v: String(gitStats.totalCommits), c: C.green, sub: `최근 7일: ${gitStats.last7days}` },
    { l: "문서", v: `${docs.total}개`, c: C.orange, sub: `${Object.keys(docs.categories).length}개 카테고리` },
    { l: "테스트", v: tests.total > 0 ? `${tests.passRate}%` : "-", c: C.cyan, sub: `${tests.passCount}/${tests.total} pass` },
    { l: "프롬프트", v: `${promptStats.today}개`, c: C.purple, sub: `총 ${promptStats.total} · avg ${promptStats.avgTokens}tok` },
    { l: "Hook 성공률", v: health.hooks.total > 0 ? `${health.hooks.successRate}%` : "-", c: health.hooks.successRate >= 90 ? C.green : C.orange, sub: `${health.hooks.success}/${health.hooks.total}` },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {REPOS.map(r => (
          <div key={r.id} style={{ background: C.surface, border: `1px solid ${r.id === "project" ? C.green + "60" : C.border}`, borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", margin: "0 auto 8px",
              background: `${r.color}15`, color: r.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700,
            }}>{r.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{r.name}</div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{r.id === "project" ? activeProject.name : repoStatus[r.id]}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {summaryCards.map((m, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 2 }}>{m.l}</div>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Box title="최근 Hook 활동">
          {recentActivity.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>활동 기록이 없습니다</div>
          ) : (
            recentActivity.map((e, i) => (
              <div key={i} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: `1px solid ${C.surfaceAlt}` }}>
                <span style={{ fontSize: 11, color: C.dim, minWidth: 40 }}>{e.t}</span>
                <span style={{ fontSize: 11, color: e.ok ? C.dim : C.orange }}>{e.msg}</span>
              </div>
            ))
          )}
        </Box>

        <Box title="변경 빈도 Top 파일 (30일)">
          {gitStats.hotspots.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>데이터 없음</div>
          ) : (
            gitStats.hotspots.slice(0, 8).map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${C.surfaceAlt}` }}>
                <span style={{ fontSize: 11, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{h.file}</span>
                <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>{h.changes}</span>
              </div>
            ))
          )}
        </Box>

        <Box title="프롬프트 레포 분포">
          {promptStats.byRepo.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>데이터 없음</div>
          ) : (
            promptStats.byRepo.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.surfaceAlt}` }}>
                <span style={{ fontSize: 11, color: C.text }}>{r.repo}</span>
                <span style={{ fontSize: 11, color: C.cyan, fontWeight: 600 }}>{r.cnt}회</span>
              </div>
            ))
          )}
        </Box>
      </div>
    </div>
  );
}
