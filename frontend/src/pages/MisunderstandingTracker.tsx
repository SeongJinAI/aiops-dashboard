import { useState, useCallback } from 'react';
import { C } from '../constants/colors';
import { T } from '../constants/design';
import { Box } from '../components/shared/Box';
import { StatCard, StatGrid } from '../components/shared/StatCard';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

interface Misunderstanding {
  ts: string;
  prompt: string;
  prev_prompt: string;
  pattern: string;
  keywords: string[];
  repo: string;
  session: string;
}

interface MisunderstandingStats {
  total: number;
  today: number;
  byPattern: { pattern: string; cnt: number }[];
}

const PATTERN_COLORS: Record<string, string> = {
  rejection: C.red,
  correction: C.orange,
  retry: C.cyan,
};

const PATTERN_LABELS: Record<string, string> = {
  rejection: "거부",
  correction: "수정",
  retry: "재시도",
};

const DEFAULT_STATS: MisunderstandingStats = { total: 0, today: 0, byPattern: [] };

export function MisunderstandingTracker() {
  const { data: apiLogs } = useApi<Misunderstanding[]>('/repos/misunderstandings', []);
  const { data: stats } = useApi<MisunderstandingStats>('/repos/misunderstandings/stats', DEFAULT_STATS);
  const [wsLogs, setWsLogs] = useState<Misunderstanding[]>([]);

  const handleMessage = useCallback((data: Record<string, unknown>) => {
    setWsLogs(prev => [data as unknown as Misunderstanding, ...prev]);
  }, []);

  useWebSocket({ misunderstandings: handleMessage });

  const allLogs = [...wsLogs, ...apiLogs].slice(0, 100);
  const topPattern = stats.byPattern.length > 0 ? stats.byPattern[0] : null;

  const statCards = [
    { l: "전체 오해", v: `${stats.total}건`, c: C.red },
    { l: "오늘", v: `${stats.today}건`, c: C.orange },
    { l: "최다 패턴", v: topPattern ? `${PATTERN_LABELS[topPattern.pattern] || topPattern.pattern}` : "-", c: C.cyan },
    { l: "패턴 수", v: `${stats.byPattern.length}종`, c: C.text },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 'var(--s-md, 10px)' }}>
      <StatGrid columns={4}>
        {statCards.map((m, i) => (
          <StatCard key={i} label={m.l} value={m.v} color={m.c} />
        ))}
      </StatGrid>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 'var(--s-sm, 8px)' }}>
        <Box title="오해 감지 로그">
          {allLogs.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>오해 감지 데이터가 없습니다</div>
          ) : (
            allLogs.map((m, i) => {
              const time = new Date(m.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
              const date = new Date(m.ts).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' });
              const color = PATTERN_COLORS[m.pattern] || C.dim;
              const label = PATTERN_LABELS[m.pattern] || m.pattern;
              return (
                <div key={i} style={{ padding: "10px 0", borderBottom: `1px solid ${C.surfaceAlt}` }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: C.dim, minWidth: 70 }}>{date} {time}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: `${color}12`, color, fontWeight: 500 }}>{label}</span>
                    <span style={{ fontSize: 10, color: C.dim }}>{m.repo}</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text, marginBottom: 4 }}>{m.prompt}</div>
                  {m.prev_prompt && (
                    <div style={{ fontSize: 11, color: C.dim, paddingLeft: 12, borderLeft: `2px solid ${C.border}` }}>
                      이전: {m.prev_prompt}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </Box>

        <div style={{ display: "flex", flexDirection: "column", gap: 'var(--s-sm, 8px)' }}>
          <Box title="패턴별 분포">
            {stats.byPattern.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>데이터 없음</div>
            ) : (
              stats.byPattern.map((p, i) => {
                const color = PATTERN_COLORS[p.pattern] || C.dim;
                const pct = stats.total > 0 ? Math.round(p.cnt / stats.total * 100) : 0;
                return (
                  <div key={i} style={{ padding: "6px 0", borderBottom: `1px solid ${C.surfaceAlt}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color }}>{PATTERN_LABELS[p.pattern] || p.pattern}</span>
                      <span style={{ fontSize: 11, color: C.dim }}>{p.cnt}건 ({pct}%)</span>
                    </div>
                    <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2 }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })
            )}
          </Box>
          <Box title="AI 성능 개선 목적">
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
              이 데이터는 Claude가 요구사항을 오해한 순간을 추적합니다.
              축적된 데이터로 어떤 유형의 요청에서 오해가 자주 발생하는지 분석하여
              프롬프트 작성 방법이나 규칙을 개선할 수 있습니다.
            </div>
          </Box>
        </div>
      </div>
    </div>
  );
}
