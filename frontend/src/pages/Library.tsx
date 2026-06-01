// 프롬프트 라이브러리 (Pro 전용) — 주제별 증류 템플릿 열람·복사 + 증류(BYOK).
// 비프리미엄은 잠금 + 업그레이드 CTA. /library/templates · /library/distill · /billing/status
import { useState } from 'react';
import { useApi, apiPost } from '../hooks/useApi';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Btn, Chip, EmptyState } from '../ui/primitives';

interface Template { id: number; topic: string; title: string; body: string; tags: string[]; exampleCount: number; }
interface LibData { templates: Template[]; topics: string[]; count: number; }
interface Billing { premium: boolean; share_opt_in: boolean; }

const DEFAULT_LIB: LibData = { templates: [], topics: [], count: 0 };

export function Library({ onNavigate }: { onNavigate?: (p: string) => void }) {
  const { data: billing, loading: billingLoading } = useApi<Billing>('/billing/status', { premium: false, share_opt_in: false });
  const { data: lib, refetch } = useApi<LibData>('/library/templates', DEFAULT_LIB);
  const { pushToast } = useToast();
  const [topic, setTopic] = useState<string>('전체');
  const [provider, setProvider] = useState('anthropic');
  const [distilling, setDistilling] = useState(false);

  const copy = async (body: string) => {
    try { await navigator.clipboard.writeText(body); pushToast({ tone: 'success', title: '클립보드에 복사했습니다.' }); }
    catch { pushToast({ tone: 'danger', title: '복사 실패 — 직접 선택해 복사하세요.' }); }
  };

  const distill = async () => {
    setDistilling(true);
    try {
      const res = await apiPost<{ count: number; corpus: number; message?: string }>('/library/distill', { provider });
      if (res.count > 0) pushToast({ tone: 'success', title: `템플릿 ${res.count}개 생성 (corpus ${res.corpus}개)` });
      else pushToast({ tone: 'info', title: res.message || '생성된 템플릿이 없습니다.' });
      refetch();
    } catch (e) {
      pushToast({ tone: 'danger', title: '증류 실패', desc: e instanceof Error ? e.message : '' });
    } finally { setDistilling(false); }
  };

  // ── 구독 상태 로딩 중: 잠금 화면 깜박임 방지 ──────────────────────
  if (billingLoading) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title"><Icon name="message-square" size={18} />프롬프트 라이브러리 <Chip tone="accent">Pro</Chip></h1>
            <div className="page-sub">구독 상태 확인 중…</div>
          </div>
        </div>
        <div className="empty-inline">불러오는 중…</div>
      </>
    );
  }

  // ── 비프리미엄: 잠금 + 업그레이드 ────────────────────────────────
  if (!billing.premium) {
    return (
      <>
        <div className="page-head">
          <div>
            <h1 className="page-title"><Icon name="message-square" size={18} />프롬프트 라이브러리 <Chip tone="accent">Pro</Chip></h1>
            <div className="page-sub">동의한 사용자들의 프롬프트를 LLM이 주제별 템플릿으로 증류 — 열람·복사</div>
          </div>
        </div>
        <EmptyState
          icon="key"
          title="Pro 전용 기능입니다"
          desc="프롬프트 라이브러리는 Pro 구독자가 이용할 수 있습니다. 내 프롬프트 원본은 절대 공유되지 않으며, 익명·일반화된 템플릿만 열람·복사됩니다."
          primary={onNavigate ? { label: 'Pro로 업그레이드', icon: 'sparkles', onClick: () => onNavigate('/subscribe') } : undefined}
        />
      </>
    );
  }

  // ── 프리미엄 ──────────────────────────────────────────────────
  const shown = topic === '전체' ? lib.templates : lib.templates.filter((t) => t.topic === topic);
  const topics = ['전체', ...lib.topics];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="message-square" size={18} />프롬프트 라이브러리 <Chip tone="accent">Pro</Chip></h1>
          <div className="page-sub">주제별 증류 템플릿 {lib.count}개 · 바로 복사해 사용</div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ height: 30, fontSize: 11 }}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
          <Btn variant="primary" size="sm" icon={distilling ? 'loader' : 'refresh'} onClick={distill} disabled={distilling}>
            {distilling ? '증류 중…' : '라이브러리 갱신'}
          </Btn>
        </div>
      </div>

      {!billing.share_opt_in && (
        <div className="alert alert-info" style={{ marginBottom: 'var(--s-lg)' }}>
          공유 풀에 아직 기여하지 않았습니다. 구독 설정에서 옵트인하면 내 프롬프트도 증류 corpus에 포함됩니다(원본은 비공개).
        </div>
      )}

      {lib.count === 0 ? (
        <EmptyState
          icon="message-square"
          title="아직 템플릿이 없습니다"
          desc="공유 풀의 프롬프트를 LLM으로 증류해 주제별 템플릿을 만드세요. (등록된 LLM 키 필요 · BYOK)"
          primary={{ label: '지금 증류하기', icon: 'sparkles', onClick: distill }}
        />
      ) : (
        <>
          <div className="lib-topics">
            {topics.map((t) => (
              <button key={t} className={`lib-topic ${topic === t ? 'on' : ''}`} onClick={() => setTopic(t)} type="button">{t}</button>
            ))}
          </div>
          <div className="lib-grid">
            {shown.map((t) => (
              <div className="lib-card" key={t.id}>
                <div className="lib-card-head">
                  <span className="lib-card-topic">{t.topic}</span>
                  <button className="lib-copy" onClick={() => copy(t.body)} type="button" title="복사"><Icon name="copy" size={13} /></button>
                </div>
                <div className="lib-card-title">{t.title}</div>
                <div className="lib-card-body">{t.body}</div>
                {t.tags.length > 0 && (
                  <div className="lib-card-tags">{t.tags.map((tag) => <span className="lib-tag" key={tag}>{tag}</span>)}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
