// 홈 — 개인 코칭 대시보드. 협업 점수 요약 + 활동 통계 + 최근 활동 + 바로가기.
// /api/health · /repos/prompts/stats · /coach/report 실데이터.
import { useApi } from '../hooks/useApi';
import { Icon } from '../ui/Icon';
import { Box, StatCard, Btn, Chip, type StatItem } from '../ui/primitives';
import { fmtNum, relTime } from '../lib/format';
import type { HealthData, PromptStats } from '../types';

const DEFAULT_HEALTH: HealthData = {
  status: 'ok', activeProject: null,
  hooks: { total: 0, success: 0, failed: 0, successRate: 0 },
  prompts: { total: 0, avgTokens: 0 },
  workflow: { compliance: 0 },
  recentActivity: [],
};
const DEFAULT_PROMPT: PromptStats = { total: 0, today: 0, avgTokens: 0, byRepo: [] };

interface CoachLite { score: number; grade: string; headline: string; lowData: boolean; }
const DEFAULT_COACH: CoachLite = { score: 0, grade: '-', headline: '', lowData: true };

const SHORTCUTS = [
  { path: '/coach', icon: 'lightbulb', name: '코치', desc: '협업 점수와 다음 한 걸음 확인' },
  { path: '/library', icon: 'copy', name: '프롬프트 라이브러리', desc: '주제별 템플릿 열람·복사 (Pro)' },
  { path: '/agent', icon: 'sparkles', name: '위키 에이전트', desc: '흩어진 문서를 3관점 위키로' },
];

interface HomeProps {
  onNavigate: (p: string) => void;
  activeProjectName: string;
}

export function Home({ onNavigate, activeProjectName }: HomeProps) {
  const { data: health } = useApi<HealthData>('/health', DEFAULT_HEALTH);
  const { data: prompts } = useApi<PromptStats>('/repos/prompts/stats', DEFAULT_PROMPT);
  const { data: coach } = useApi<CoachLite>('/coach/report', DEFAULT_COACH);

  const rate = health.hooks.successRate;
  const stats: StatItem[] = [
    { id: 'prompts', label: '프롬프트 · 오늘', value: fmtNum(prompts.today), sub: `총 ${fmtNum(prompts.total)}` },
    { id: 'hooks', label: 'HOOK · 전체', value: fmtNum(health.hooks.total), sub: `성공 ${fmtNum(health.hooks.success)}` },
    { id: 'rate', label: 'HOOK 통과율', value: health.hooks.total > 0 ? `${rate}%` : '—', trend: rate >= 90 ? 'up' : rate > 0 ? 'down' : 'neutral', sub: `${health.hooks.success}/${health.hooks.total}` },
    { id: 'tokens', label: '평균 토큰', value: fmtNum(prompts.avgTokens), sub: '프롬프트당' },
    { id: 'score', label: '협업 점수', value: coach.lowData ? '—' : String(coach.score), dot: coach.score >= 80 ? 'success' : coach.score >= 60 ? 'warning' : coach.score > 0 ? 'danger' : 'neutral', sub: coach.lowData ? '데이터 부족' : `등급 ${coach.grade}` },
  ];

  const recent = health.recentActivity || [];
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="home" size={18} />홈</h1>
          <div className="page-sub">
            {today} · AI 협업을 데이터로 · 활성 프로젝트 {activeProjectName || '—'}
          </div>
        </div>
        <div className="actions">
          <Btn variant="ghost" icon="refresh" onClick={() => window.location.reload()}>새로고침</Btn>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => <StatCard stat={s} key={s.id} />)}
      </div>

      <div className="dual">
        <Box title="최근 활동 · Recent activity" padding={false}>
          {recent.length === 0 ? (
            <div className="empty-inline">활동 기록이 없습니다. Hook이 설치되면 여기에 표시됩니다.</div>
          ) : recent.slice(0, 8).map((a, i) => (
            <div className="activity-row" key={i}>
              <div className="kind kind-hook"><Icon name="activity" size={13} /></div>
              <div className="activity-title">{a.hook} → {a.script}{a.error ? ` · ${a.error}` : ''}</div>
              <div className="activity-proj">{a.repo}</div>
              <div className="activity-when">{relTime(a.ts)}</div>
            </div>
          ))}
        </Box>

        <Box
          title="협업 점수"
          action={!coach.lowData && <Chip tone={coach.score >= 80 ? 'success' : 'warning'}>등급 {coach.grade}</Chip>}
        >
          {coach.lowData ? (
            <div className="empty-inline">데이터가 더 쌓이면 협업 점수가 계산됩니다.</div>
          ) : (
            <>
              <div className="coach-scorenum" style={{ fontSize: 34 }}>{coach.score}<span>/100</span></div>
              {coach.headline && <div className="coach-headline" style={{ marginTop: 12 }}><Icon name="sparkles" size={14} className="ico" /> {coach.headline}</div>}
            </>
          )}
          <div style={{ marginTop: 'var(--s-md)' }}>
            <Btn variant="secondary" size="sm" icon="lightbulb" onClick={() => onNavigate('/coach')}>코치 자세히 보기</Btn>
          </div>
        </Box>
      </div>

      <Box title="바로가기">
        <div className="repo-grid">
          {SHORTCUTS.map((s) => (
            <div key={s.path} className="repo" onClick={() => onNavigate(s.path)}>
              <div className="repo-top">
                <Icon name={s.icon} size={14} />
                <span className="repo-name">{s.name}</span>
                {s.path === '/library' && <Chip tone="accent">Pro</Chip>}
              </div>
              <div className="repo-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </Box>
    </>
  );
}
