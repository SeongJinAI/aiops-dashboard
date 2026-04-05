import { useState } from 'react';
import { C } from '../constants/colors';
import { Box } from '../components/shared/Box';
import { useApi } from '../hooks/useApi';

const REPO_COLORS: Record<string, string> = {
  project: C.green,
  test: C.cyan,
  knowledge: C.orange,
  governance: C.purple,
  rag: C.pink,
};

const REPO_LABELS: Record<string, string> = {
  project: "프로젝트",
  test: "테스트",
  knowledge: "지식",
  governance: "거버넌스",
  rag: "RAG",
};

interface Prompt {
  ts: string;
  prompt: string;
  repo: string;
  tokens: number;
  session: string;
  is_system: boolean;
}

interface Stats {
  total: number;
  userTotal: number;
  systemTotal: number;
  today: number;
  avgTokens: number;
  byRepo: { repo: string; cnt: number }[];
}

const DEFAULT_STATS: Stats = { total: 0, userTotal: 0, systemTotal: 0, today: 0, avgTokens: 0, byRepo: [] };

export function PromptHistory() {
  const { data: prompts } = useApi<Prompt[]>('/repos/prompts', []);
  const { data: stats } = useApi<Stats>('/repos/prompts/stats', DEFAULT_STATS);
  const [showSystem, setShowSystem] = useState(false);

  const filtered = showSystem ? prompts : prompts.filter(p => !p.is_system);

  const statCards = [
    { l: "사용자 프롬프트", v: `${stats.userTotal}개`, c: C.purple },
    { l: "시스템 메시지", v: `${stats.systemTotal}개`, c: C.dim },
    { l: "오늘", v: `${stats.today}개`, c: C.cyan },
    { l: "평균 토큰", v: `${stats.avgTokens}`, c: C.text },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {statCards.map((m, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{m.l}</div>
          </div>
        ))}
      </div>

      <Box title={`프롬프트 로그 (${filtered.length}건)`}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <label style={{ fontSize: 11, color: C.dim, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} />
            시스템 메시지 표시
          </label>
        </div>
        <div style={{ maxHeight: 600, overflowY: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>프롬프트 로그가 없습니다</div>
          ) : (
            filtered.map((p, i) => {
              const time = new Date(p.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              const date = new Date(p.ts).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
              const color = REPO_COLORS[p.repo] || C.dim;
              const label = REPO_LABELS[p.repo] || p.repo;
              return (
                <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.surfaceAlt}`, opacity: p.is_system ? 0.5 : 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: C.dim }}>{date} {time}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${color}12`, color, fontWeight: 500 }}>{label}</span>
                    {p.is_system && <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: `${C.dim}15`, color: C.dim }}>시스템</span>}
                    <span style={{ fontSize: 11, color: C.dim, marginLeft: "auto" }}>{p.tokens}tok</span>
                  </div>
                  <div style={{ fontSize: 12, color: p.is_system ? C.dim : C.text, lineHeight: 1.6, wordBreak: "break-all", overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{p.prompt}</div>
                </div>
              );
            })
          )}
        </div>
      </Box>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Box title="레포별 프롬프트">
          {stats.byRepo.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>데이터 없음</div>
          ) : (
            stats.byRepo.map((r, i) => {
              const color = REPO_COLORS[r.repo] || C.dim;
              const pct = stats.userTotal > 0 ? Math.round(r.cnt / stats.userTotal * 100) : 0;
              return (
                <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${C.surfaceAlt}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color }}>{REPO_LABELS[r.repo] || r.repo}</span>
                    <span style={{ fontSize: 11, color: C.dim }}>{r.cnt}회 ({pct}%)</span>
                  </div>
                  <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
                  </div>
                </div>
              );
            })
          )}
        </Box>
        <Box title="반복 패턴 감지">
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>데이터가 충분히 쌓이면 반복 패턴이 표시됩니다</div>
        </Box>
      </div>
    </div>
  );
}
