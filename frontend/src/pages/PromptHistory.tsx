import { useState } from 'react';
import { C } from '../constants/colors';
import { T } from '../constants/design';
import { Box } from '../components/shared/Box';
import { StatCard, StatGrid } from '../components/shared/StatCard';
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

interface LengthBucket { label: string; cnt: number }
interface DailyEntry { date: string; cnt: number }

interface Stats {
  total: number;
  userTotal: number;
  systemTotal: number;
  today: number;
  avgTokens: number;
  byRepo: { repo: string; cnt: number }[];
  hourly?: number[];
  daily?: DailyEntry[];
  lengthBuckets?: LengthBucket[];
}

const DEFAULT_STATS: Stats = {
  total: 0, userTotal: 0, systemTotal: 0, today: 0, avgTokens: 0,
  byRepo: [], hourly: [], daily: [], lengthBuckets: [],
};

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
    <div style={{ display: "flex", flexDirection: "column", gap: 'var(--s-md, 10px)' }}>
      <StatGrid columns={4}>
        {statCards.map((m, i) => (
          <StatCard key={i} label={m.l} value={m.v} color={m.c} />
        ))}
      </StatGrid>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 'var(--s-sm, 8px)' }}>
        <Box title="일별 추세 (최근 30일)">
          <DailyChart daily={stats.daily || []} />
        </Box>
        <Box title="시간대별 활동">
          <HourlyChart hourly={stats.hourly || []} />
        </Box>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 'var(--s-sm, 8px)' }}>
        <Box title="레포별 프롬프트">
          {stats.byRepo.length === 0 ? (
            <EmptyState />
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
        <Box title="프롬프트 길이 분포">
          <LengthChart buckets={stats.lengthBuckets || []} />
        </Box>
        <Box title="피크 시간대">
          <PeakInsights hourly={stats.hourly || []} daily={stats.daily || []} />
        </Box>
      </div>

      <Box
        title={`프롬프트 로그 (${filtered.length}건)`}
        action={
          <label style={{ fontSize: T.sm, color: C.dim, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
            <input type="checkbox" checked={showSystem} onChange={e => setShowSystem(e.target.checked)} />
            시스템 메시지 표시
          </label>
        }
      >
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
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
    </div>
  );
}


function EmptyState() {
  return (
    <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>
      데이터 없음
    </div>
  );
}


function DailyChart({ daily }: { daily: DailyEntry[] }) {
  if (daily.length === 0) return <EmptyState />;
  const max = Math.max(1, ...daily.map(d => d.cnt));
  const width = 100;       // viewBox width (%) — 가변 폭에 맞춰 stretch
  const height = 100;
  const xStep = width / Math.max(1, daily.length - 1);

  const points = daily.map((d, i) => {
    const x = i * xStep;
    const y = height - (d.cnt / max) * (height * 0.85) - 5;
    return [x, y, d];
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: 140 }}>
        <path d={area} fill={C.accent} fillOpacity={0.15} />
        <path d={path} fill="none" stroke={C.accent} strokeWidth={0.8} />
        {points.map(([x, y, d], i) => (
          <circle key={i} cx={x as number} cy={y as number} r={1} fill={C.accent}>
            <title>{(d as DailyEntry).date}: {(d as DailyEntry).cnt}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginTop: 4 }}>
        <span>{daily[0]?.date.slice(5)}</span>
        <span>{daily[Math.floor(daily.length / 2)]?.date.slice(5)}</span>
        <span>{daily[daily.length - 1]?.date.slice(5)}</span>
      </div>
    </div>
  );
}


function HourlyChart({ hourly }: { hourly: number[] }) {
  if (!hourly || hourly.length === 0 || hourly.every(v => v === 0)) {
    return <EmptyState />;
  }
  const max = Math.max(1, ...hourly);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 100 }}>
        {hourly.map((v, h) => {
          const heightPct = (v / max) * 100;
          return (
            <div
              key={h}
              title={`${String(h).padStart(2, '0')}시 — ${v}회`}
              style={{
                flex: 1,
                background: v > 0 ? C.accent : C.surfaceAlt,
                height: `${Math.max(2, heightPct)}%`,
                borderRadius: '2px 2px 0 0',
                opacity: v > 0 ? Math.max(0.3, v / max) : 0.3,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: C.dim, marginTop: 4 }}>
        <span>00시</span>
        <span>06시</span>
        <span>12시</span>
        <span>18시</span>
        <span>23시</span>
      </div>
    </div>
  );
}


function LengthChart({ buckets }: { buckets: LengthBucket[] }) {
  if (!buckets || buckets.length === 0 || buckets.every(b => b.cnt === 0)) {
    return <EmptyState />;
  }
  const total = buckets.reduce((sum, b) => sum + b.cnt, 0);
  return (
    <div>
      {buckets.map((b) => {
        const pct = total > 0 ? (b.cnt / total) * 100 : 0;
        return (
          <div key={b.label} style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 11, color: C.text, fontFamily: 'monospace' }}>{b.label}</span>
              <span style={{ fontSize: 10, color: C.dim }}>{b.cnt} ({pct.toFixed(0)}%)</span>
            </div>
            <div style={{ height: 4, background: C.surfaceAlt, borderRadius: 2 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: C.purple, borderRadius: 2,
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}


function PeakInsights({ hourly, daily }: { hourly: number[]; daily: DailyEntry[] }) {
  if ((!hourly || hourly.every(v => v === 0)) && (!daily || daily.every(d => d.cnt === 0))) {
    return <EmptyState />;
  }

  const peakHour = hourly.reduce((acc, v, i) => v > hourly[acc] ? i : acc, 0);
  const totalHour = hourly.reduce((a, b) => a + b, 0);
  const peakHourPct = totalHour > 0 ? Math.round((hourly[peakHour] / totalHour) * 100) : 0;

  const sortedDaily = [...daily].sort((a, b) => b.cnt - a.cnt);
  const peakDay = sortedDaily[0];
  const totalDay = daily.reduce((a, b) => a + b.cnt, 0);
  const avgDaily = daily.length > 0 ? (totalDay / daily.length).toFixed(1) : '0';

  return (
    <div style={{ fontSize: 12, color: C.text, lineHeight: 1.8 }}>
      <Row label="가장 활발한 시간대">
        <strong style={{ color: C.accent }}>{String(peakHour).padStart(2, '0')}시</strong> ({hourly[peakHour]}회, {peakHourPct}%)
      </Row>
      <Row label="가장 활발한 날">
        <strong style={{ color: C.purple }}>{peakDay?.date.slice(5) || '-'}</strong> ({peakDay?.cnt || 0}회)
      </Row>
      <Row label="일평균">
        <strong>{avgDaily}회</strong>
      </Row>
      <Row label="30일 합계">
        <strong>{totalDay}회</strong>
      </Row>
    </div>
  );
}


function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px dashed ${C.surfaceAlt}`, padding: '4px 0' }}>
      <span style={{ color: C.dim }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}
