// 구독 — 플랜 확인 + 목 체크아웃(업그레이드/취소) + 공유 풀 기여 옵트인.
// /billing/status · /billing/checkout · /billing/cancel · /billing/share-opt-in
import { useApi, apiPost } from '../hooks/useApi';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip } from '../ui/primitives';

interface Plan { id: string; name: string; price: number; features: string[]; }
interface Billing { plan: string; premium: boolean; share_opt_in: boolean; plans: Plan[]; }

const DEFAULT: Billing = { plan: 'free', premium: false, share_opt_in: false, plans: [] };

export function Subscribe() {
  const { data: billing, refetch } = useApi<Billing>('/billing/status', DEFAULT);
  const { pushToast } = useToast();

  const upgrade = async (plan: string) => {
    try {
      await apiPost('/billing/checkout', { plan });
      pushToast({ tone: 'success', title: `${plan === 'pro' ? 'Pro' : plan}로 업그레이드되었습니다.` });
      refetch();
    } catch (e) {
      pushToast({ tone: 'danger', title: '결제 실패', desc: e instanceof Error ? e.message : '' });
    }
  };
  const cancel = async () => {
    try { await apiPost('/billing/cancel', {}); pushToast({ tone: 'info', title: 'Free로 전환되었습니다.' }); refetch(); }
    catch (e) { pushToast({ tone: 'danger', title: '실패', desc: e instanceof Error ? e.message : '' }); }
  };
  const toggleShare = async (enabled: boolean) => {
    try { await apiPost('/billing/share-opt-in', { enabled }); refetch(); }
    catch (e) { pushToast({ tone: 'danger', title: '실패', desc: e instanceof Error ? e.message : '' }); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="sparkles" size={18} />구독</h1>
          <div className="page-sub">
            현재 플랜: <strong>{billing.premium ? 'Pro' : 'Free'}</strong>
            {' '}· LLM 호출은 BYOK(내 키)로 별도 청구
          </div>
        </div>
        <div className="actions">
          <Chip tone={billing.premium ? 'accent' : 'neutral'} dot>{billing.premium ? 'Pro' : 'Free'}</Chip>
        </div>
      </div>

      <div className="plan-grid">
        {billing.plans.map((p) => {
          const current = billing.plan === p.id;
          const isPro = p.id === 'pro';
          return (
            <div className={`plan-card ${isPro ? 'pro' : ''} ${current ? 'current' : ''}`} key={p.id}>
              {isPro && <span className="plan-badge">추천</span>}
              <div className="plan-name">{p.name}</div>
              <div className="plan-price">${p.price}<s>{p.price > 0 ? ' /월' : ''}</s></div>
              <ul className="plan-feat">
                {p.features.map((f, i) => <li key={i}><Icon name="check" size={14} />{f}</li>)}
              </ul>
              {current ? (
                <Btn variant="secondary" disabled className="btn-block">현재 플랜</Btn>
              ) : isPro ? (
                <Btn variant="primary" className="btn-block" onClick={() => upgrade('pro')}>Pro로 업그레이드</Btn>
              ) : (
                <Btn variant="ghost" className="btn-block" onClick={cancel}>Free로 전환</Btn>
              )}
            </div>
          );
        })}
      </div>

      <Box title="공유 풀 기여 (옵트인)" className="">
        <div className="share-row">
          <div>
            <div className="share-title">내 프롬프트를 증류 풀에 기여하기</div>
            <div className="share-desc">
              켜면 내 프롬프트가 <strong>secret 자동 마스킹</strong> 후 공유 풀에 포함되어, 주제별 템플릿 증류에 쓰입니다.
              <strong> 원본은 다른 사용자에게 절대 노출되지 않습니다</strong> — 일반화된 템플릿만 공유됩니다.
            </div>
          </div>
          <label className="switch">
            <input type="checkbox" checked={billing.share_opt_in} onChange={(e) => toggleShare(e.target.checked)} />
            <span className="switch-track"><span className="switch-thumb" /></span>
          </label>
        </div>
      </Box>

      <div className="text-dim" style={{ fontSize: 11.5, marginTop: 8 }}>
        결제는 현재 데모(목)입니다 — 즉시 반영되며 실제 청구는 없습니다. 운영 시 Lemon Squeezy 연동 예정.
      </div>
    </>
  );
}
