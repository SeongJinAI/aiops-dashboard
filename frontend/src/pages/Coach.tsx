// 코치 — Track → Wikify → Coach 가치 사슬의 3번째 단계.
// 축적된 프롬프트·Hook·오해 데이터를 협업 점수 + 실행 가능한 인사이트로 변환한다.
// /coach/report(룰 기반, 항상 동작) + /coach/summary(BYOK LLM 브리핑, 선택).
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useApi, apiPost } from '../hooks/useApi';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip, EmptyState } from '../ui/primitives';

type Severity = 'warn' | 'suggest' | 'good' | 'info';

interface Insight {
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  evidence: string;
  action: string | null;
}
interface Metric {
  key: string; label: string; value: number; hint: string;
}
interface CoachReport {
  generatedAt: string;
  score: number;
  grade: string;
  metrics: Metric[];
  insights: Insight[];
  headline: string;
  dataPoints: number;
  lowData: boolean;
  counts: { prompts: number; hooks: number; misunderstandings: number };
}

const DEFAULT: CoachReport = {
  generatedAt: '', score: 0, grade: 'E', metrics: [], insights: [],
  headline: '', dataPoints: 0, lowData: true,
  counts: { prompts: 0, hooks: 0, misunderstandings: 0 },
};

const SEV_ICON: Record<Severity, string> = {
  warn: 'alert-circle', suggest: 'lightbulb', good: 'check-circle', info: 'info',
};

const meterTone = (v: number) => (v >= 85 ? 'success' : v >= 70 ? '' : v >= 50 ? 'warning' : 'danger');

// `code` 구간만 <code>로, 나머지는 평문으로 렌더
function inline(text: string) {
  return text.split(/(`[^`]+`)/g).map((p, i) =>
    p.startsWith('`') && p.endsWith('`')
      ? <code key={i}>{p.slice(1, -1)}</code>
      : <span key={i}>{p}</span>
  );
}

export function Coach() {
  const { data: report } = useApi<CoachReport>('/coach/report', DEFAULT);
  const { pushToast } = useToast();
  const [provider, setProvider] = useState('anthropic');
  const [brief, setBrief] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);

  const generateBrief = async () => {
    setBriefLoading(true);
    setBrief('');
    try {
      const res = await apiPost<{ summary: string }>('/coach/summary', { provider });
      setBrief(res.summary);
      pushToast({ tone: 'success', title: '코치 브리핑이 생성되었습니다.' });
    } catch (e) {
      pushToast({ tone: 'danger', title: '브리핑 생성 실패', desc: e instanceof Error ? e.message : '' });
    } finally {
      setBriefLoading(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="lightbulb" size={18} />코치</h1>
          <div className="page-sub">
            Track → Wikify → <strong>Coach</strong> · 축적된 데이터로 다음 한 걸음을 제안합니다
          </div>
        </div>
      </div>

      {report.dataPoints === 0 ? (
        <EmptyState
          icon="lightbulb"
          title="아직 코칭할 데이터가 없어요"
          desc="Hook을 설치하고 AI로 작업을 시작하면, 프롬프트·Hook·오해 데이터가 쌓입니다. 코치는 그 데이터에서 협업을 개선할 구체적인 다음 행동을 제안합니다."
        />
      ) : (
        <>
          <Box title="협업 점수">
            <div className="coach-hero">
              <div className="coach-scorewrap">
                <div className="coach-scorenum">{report.score}<span>/100</span></div>
                <span className="coach-grade">등급 {report.grade}</span>
              </div>
              <div className="coach-metrics">
                {report.metrics.length === 0 ? (
                  <div className="empty-inline">점수를 계산할 데이터가 부족합니다.</div>
                ) : report.metrics.map((m) => (
                  <div className="distrow" key={m.key}>
                    <div className="distrow-head">
                      <span>{m.label}</span>
                      <span className="muted mono">{m.value}</span>
                    </div>
                    <div className="meter"><div className={`meter-fill ${meterTone(m.value)}`} style={{ width: `${m.value}%` }} /></div>
                    <div className="distrow-desc">{m.hint}</div>
                  </div>
                ))}
              </div>
            </div>
            {report.headline && (
              <div className="coach-headline" style={{ marginTop: 'var(--s-lg)' }}>
                <Icon name="sparkles" size={14} className="ico" /> {report.headline}
              </div>
            )}
            {report.lowData && (
              <div className="distrow-desc" style={{ marginTop: 8 }}>
                데이터 {report.dataPoints}건 — 더 쌓일수록 점수와 제안이 정확해집니다.
              </div>
            )}
          </Box>

          <Box
            title="개선 인사이트"
            action={<Chip tone="accent">{report.insights.length}개</Chip>}
          >
            {report.insights.length === 0 ? (
              <div className="empty-inline">아직 도출된 인사이트가 없습니다.</div>
            ) : report.insights.map((ins, i) => (
              <div className={`insight ${ins.severity}`} key={i}>
                <div className="insight-head">
                  <Icon name={SEV_ICON[ins.severity]} size={14} className={`ico ${ins.severity}`} />
                  <span className="insight-title">{ins.title}</span>
                  <Chip tone="neutral">{ins.category}</Chip>
                </div>
                <div className="insight-detail">{inline(ins.detail)}</div>
                {ins.evidence && <div className="insight-evidence">{ins.evidence}</div>}
                {ins.action && (
                  <div className="insight-action">
                    <Icon name="arrow-up-right" size={13} className="ico" />
                    <span>{inline(ins.action)}</span>
                  </div>
                )}
              </div>
            ))}
          </Box>

          <Box
            title="코치 브리핑 · AI 요약"
            action={
              <div className="actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ height: 28, fontSize: 11 }}>
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                </select>
                <Btn variant="primary" size="sm" icon={briefLoading ? 'loader' : 'sparkles'} onClick={generateBrief} disabled={briefLoading}>
                  {briefLoading ? '생성 중…' : '브리핑 생성'}
                </Btn>
              </div>
            }
          >
            {brief ? (
              <div className="coach-brief"><ReactMarkdown>{brief}</ReactMarkdown></div>
            ) : (
              <div className="empty-inline">
                위 인사이트를 한국어 코치 브리핑으로 요약합니다. 키 없이 바로 사용(플랜별 월 한도) — 본인 LLM 키(BYOK)를 등록하면 한도 없이 쓸 수 있습니다.
              </div>
            )}
          </Box>
        </>
      )}
    </>
  );
}
