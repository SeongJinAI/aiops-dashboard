// 오해 추적 — 패턴별 분포 + 감지 로그 + Coach 비전.
// /repos/misunderstandings · /repos/misunderstandings/stats + WS(category: misunderstandings).
import { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { Icon } from '../ui/Icon';
import { Box, Chip, StatCard, EmptyState, type StatItem, type Tone } from '../ui/primitives';
import { fmtNum, hhmm } from '../lib/format';

interface Misunderstanding {
  ts: string; prompt: string; prev_prompt: string; pattern: string;
  keywords: string[]; repo: string; session: string;
}
interface MisStats {
  total: number; today: number; byPattern: { pattern: string; cnt: number }[];
}

const DEFAULT_STATS: MisStats = { total: 0, today: 0, byPattern: [] };

const PATTERN: Record<string, { label: string; tone: Tone }> = {
  rejection: { label: '거부', tone: 'danger' },
  correction: { label: '수정', tone: 'warning' },
  retry: { label: '재시도', tone: 'info' },
};
const patternMeta = (p: string) => PATTERN[p] || { label: p, tone: 'neutral' as Tone };

export function Misunderstandings({ onNavigate }: { onNavigate?: (p: string) => void }) {
  const { data: apiLogs } = useApi<Misunderstanding[]>('/repos/misunderstandings', []);
  const { data: stats } = useApi<MisStats>('/repos/misunderstandings/stats', DEFAULT_STATS);
  const [wsLogs, setWsLogs] = useState<Misunderstanding[]>([]);

  const handle = useCallback((data: Record<string, unknown>) => {
    setWsLogs((prev) => [data as unknown as Misunderstanding, ...prev]);
  }, []);
  useWebSocket({ misunderstandings: handle });

  const logs = [...wsLogs, ...apiLogs].slice(0, 100);
  const top = stats.byPattern[0];

  const statCards: StatItem[] = [
    { id: 'total', label: '전체 오해', value: fmtNum(stats.total) },
    { id: 'today', label: '오늘', value: fmtNum(stats.today) },
    { id: 'top', label: '최다 패턴', value: top ? patternMeta(top.pattern).label : '—' },
    { id: 'kinds', label: '패턴 수', value: `${stats.byPattern.length}종` },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="alert-circle" size={18} />오해 추적</h1>
          <div className="page-sub">AI가 잘못 이해한 패턴 자동 감지 · 누적 {fmtNum(stats.total)}건</div>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map((s) => <StatCard stat={s} key={s.id} />)}
      </div>

      <Box
        title="패턴별 분포"
        action={<Chip tone="warning" dot>{stats.byPattern.length} active patterns</Chip>}
      >
        {stats.byPattern.length === 0 ? (
          <div className="empty-inline">감지된 패턴이 없습니다.</div>
        ) : stats.byPattern.map((p) => {
          const meta = patternMeta(p.pattern);
          const pct = stats.total > 0 ? Math.round((p.cnt / stats.total) * 100) : 0;
          return (
            <div className="distrow" key={p.pattern}>
              <div className="distrow-head">
                <span style={{ fontWeight: 500 }}>{meta.label}</span>
                <span className="muted mono">{fmtNum(p.cnt)}건 · {pct}%</span>
              </div>
              <div className="meter"><div className={`meter-fill ${meta.tone}`} style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </Box>

      <Box title="감지 로그" padding={false}>
        {logs.length === 0 ? (
          <div className="empty-inline">오해 감지 데이터가 없습니다.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 64 }}>TIME</th>
                <th style={{ width: 90 }}>PATTERN</th>
                <th style={{ width: 96 }}>REPO</th>
                <th>PROMPT</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((m, i) => {
                const meta = patternMeta(m.pattern);
                return (
                  <tr key={i}>
                    <td className="mono">{hhmm(m.ts)}</td>
                    <td><Chip tone={meta.tone} dot>{meta.label}</Chip></td>
                    <td className="mono">{m.repo}</td>
                    <td><div className="cell-clamp">{m.prompt}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Box>

      <EmptyState
        icon="lightbulb"
        title="이 패턴, 코치가 개선 제안으로 바꿔줍니다"
        desc="축적된 오해 패턴을 기반으로 '이 규칙을 .claude/CLAUDE.md에 추가하면 같은 실수가 줄어듭니다' 같은 능동 제안을 코치 페이지에서 확인하세요."
        primary={onNavigate ? { label: '코치 열기', icon: 'lightbulb', onClick: () => onNavigate('/coach') } : undefined}
      />
    </>
  );
}
