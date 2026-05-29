// 프롬프트 — 일별 라인차트 + 시간대 막대 + 길이 분포 + 레포 분포 + 로그 테이블.
// /repos/prompts · /repos/prompts/stats (기존 PromptHistory 데이터 계약 유지).
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip, StatCard, type StatItem } from '../ui/primitives';
import { fmtNum, hhmm } from '../lib/format';

interface Prompt {
  ts: string; prompt: string; repo: string; tokens: number; session: string; is_system: boolean;
}
interface DailyEntry { date: string; cnt: number; }
interface LengthBucket { label: string; cnt: number; }
interface Stats {
  total: number; userTotal: number; systemTotal: number; today: number; avgTokens: number;
  byRepo: { repo: string; cnt: number }[];
  hourly?: number[]; daily?: DailyEntry[]; lengthBuckets?: LengthBucket[];
}

const DEFAULT_STATS: Stats = {
  total: 0, userTotal: 0, systemTotal: 0, today: 0, avgTokens: 0,
  byRepo: [], hourly: [], daily: [], lengthBuckets: [],
};

const REPO_LABELS: Record<string, string> = {
  project: '프로젝트', test: '테스트', knowledge: '지식', governance: '거버넌스', rag: 'RAG',
};

export function Prompts() {
  const { data: prompts } = useApi<Prompt[]>('/repos/prompts', []);
  const { data: stats } = useApi<Stats>('/repos/prompts/stats', DEFAULT_STATS);
  const [showSystem, setShowSystem] = useState(false);

  const filtered = showSystem ? prompts : prompts.filter((p) => !p.is_system);
  const daily = stats.daily || [];
  const hourly = stats.hourly || [];
  const buckets = stats.lengthBuckets || [];

  // 라인차트 좌표
  const w = 720, h = 160, pad = 28;
  const max = Math.max(1, ...daily.map((d) => d.cnt));
  const min = Math.min(0, ...daily.map((d) => d.cnt));
  const range = max - min || 1;
  const pts: [number, number][] = daily.map((d, i) => {
    const x = pad + (daily.length <= 1 ? 0 : i / (daily.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (d.cnt - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const yTicks = [0, 0.5, 1].map((t) => ({ y: pad + (1 - t) * (h - pad * 2), v: Math.round(min + range * t) }));

  const hMax = Math.max(1, ...hourly);
  const bTotal = buckets.reduce((s, b) => s + b.cnt, 0);

  const statCards: StatItem[] = [
    { id: 'user', label: '사용자 프롬프트', value: fmtNum(stats.userTotal) },
    { id: 'sys', label: '시스템 메시지', value: fmtNum(stats.systemTotal) },
    { id: 'today', label: '오늘', value: fmtNum(stats.today) },
    { id: 'avg', label: '평균 토큰', value: fmtNum(stats.avgTokens) },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="message-square" size={18} />프롬프트</h1>
          <div className="page-sub">30일 추이 · 시간대 패턴 · 최근 로그 · 총 {fmtNum(stats.total)}건</div>
        </div>
        <div className="actions">
          <Btn variant="ghost" icon="refresh" onClick={() => window.location.reload()}>새로고침</Btn>
        </div>
      </div>

      <div className="stat-grid">
        {statCards.map((s) => <StatCard stat={s} key={s.id} />)}
      </div>

      <Box title="일별 프롬프트 · 30일" action={<Chip tone="accent">최근 {daily.length}일</Chip>}>
        {daily.length === 0 ? (
          <div className="empty-inline">데이터 없음 — 프롬프트가 쌓이면 추이가 표시됩니다.</div>
        ) : (
          <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            {yTicks.map((t, i) => (
              <g key={i}>
                <line x1={pad} x2={w - pad} y1={t.y} y2={t.y} className="chart-axis" />
                <text x={4} y={t.y + 3} className="chart-tick">{t.v}</text>
              </g>
            ))}
            <path d={`M ${pts[0][0]},${h - pad} L ${pts.map((p) => p.join(',')).join(' L ')} L ${pts[pts.length - 1][0]},${h - pad} Z`} className="chart-area" />
            <polyline className="chart-line" points={pts.map((p) => p.join(',')).join(' ')} />
            {pts.filter((_, i) => i % 5 === 4).map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={2} className="chart-dot" />
            ))}
          </svg>
        )}
      </Box>

      <div className="dual">
        <Box title="시간대별 활동 · 24h">
          {hourly.length === 0 || hourly.every((v) => v === 0) ? (
            <div className="empty-inline">데이터 없음</div>
          ) : (
            <>
              <div className="bars">
                {hourly.map((v, i) => (
                  <div
                    key={i}
                    className="bar"
                    title={`${String(i).padStart(2, '0')}시 · ${v}회`}
                    style={{ height: `${Math.max(3, (v / hMax) * 100)}%`, opacity: v > 0 ? Math.max(0.35, v / hMax) : 0.2 }}
                  />
                ))}
              </div>
              <div className="bars-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
            </>
          )}
        </Box>

        <Box title="길이 분포">
          {buckets.length === 0 || bTotal === 0 ? (
            <div className="empty-inline">데이터 없음</div>
          ) : buckets.map((b) => {
            const pct = bTotal > 0 ? (b.cnt / bTotal) * 100 : 0;
            return (
              <div className="distrow" key={b.label}>
                <div className="distrow-head">
                  <span className="mono">{b.label}</span>
                  <span className="muted mono">{fmtNum(b.cnt)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="meter"><div className="meter-fill purple" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
        </Box>
      </div>

      <Box title="레포별 프롬프트">
        {stats.byRepo.length === 0 ? (
          <div className="empty-inline">데이터 없음</div>
        ) : stats.byRepo.map((r) => {
          const pct = stats.userTotal > 0 ? Math.round((r.cnt / stats.userTotal) * 100) : 0;
          return (
            <div className="distrow" key={r.repo}>
              <div className="distrow-head">
                <span>{REPO_LABELS[r.repo] || r.repo}</span>
                <span className="muted mono">{fmtNum(r.cnt)}회 · {pct}%</span>
              </div>
              <div className="meter"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
            </div>
          );
        })}
      </Box>

      <Box
        title={`프롬프트 로그 (${fmtNum(filtered.length)})`}
        action={
          <label className="toggle-inline">
            <input type="checkbox" checked={showSystem} onChange={(e) => setShowSystem(e.target.checked)} />
            시스템 메시지
          </label>
        }
        padding={false}
      >
        {filtered.length === 0 ? (
          <div className="empty-inline">프롬프트 로그가 없습니다.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 64 }}>TIME</th>
                <th>PROMPT</th>
                <th style={{ width: 96 }}>REPO</th>
                <th className="right" style={{ width: 72 }}>TOKENS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p, i) => (
                <tr key={i}>
                  <td className="mono">{hhmm(p.ts)}</td>
                  <td><div className="cell-clamp">{p.prompt}</div></td>
                  <td className="mono">{REPO_LABELS[p.repo] || p.repo}</td>
                  <td className="right mono">{fmtNum(p.tokens)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    </>
  );
}
