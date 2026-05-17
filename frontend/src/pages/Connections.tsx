import { useEffect, useState } from 'react';
import { C } from '../constants/colors';
import { useApi, apiPost } from '../hooks/useApi';
import { useAuth } from '../hooks/useAuth';
import { CodeBlock, EnvSelector } from '../components/onboarding/Snippets';
import { detectEnv, envCommands, type Env } from '../constants/onboarding';

interface ApiKeyStatus { has_key: boolean }
interface RegenerateResponse { api_key: string }

interface ConnectionsProps {
  onReopenWizard?: () => void;
}

const NEW_KEY_SESSION = 'aiops_new_api_key';

export function Connections({ onReopenWizard }: ConnectionsProps) {
  const { auth } = useAuth();
  const { data: status, refetch } = useApi<ApiKeyStatus>('/auth/api-key', { has_key: false });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [env, setEnv] = useState<Env>(detectEnv());

  // 가입 직후 임시 저장된 새 키가 있으면 한번 보여주고 삭제
  useEffect(() => {
    const fresh = sessionStorage.getItem(NEW_KEY_SESSION);
    if (fresh) {
      setRevealedKey(fresh);
      sessionStorage.removeItem(NEW_KEY_SESSION);
    }
  }, []);

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await apiPost<RegenerateResponse>('/auth/api-key/regenerate', {});
      setRevealedKey(res.api_key);
      setConfirming(false);
      refetch();
    } catch (e) {
      alert(e instanceof Error ? e.message : '재발급 실패');
    } finally {
      setBusy(false);
    }
  };

  const apiBase = window.location.origin;
  const tenantId = auth.tenantId || '';
  const cmds = envCommands(env, apiBase, revealedKey || '<API 키 — 재발급 후 붙여넣기>', tenantId);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>연결 설정</h2>
        {onReopenWizard && (
          <button onClick={onReopenWizard} style={btnSecondary}>
            온보딩 위저드 다시 보기
          </button>
        )}
      </div>

      <Section title="계정 정보">
        <Row label="이메일" value={auth.email || '-'} />
        <Row label="Tenant ID" value={tenantId} mono />
      </Section>

      <Section title="API 키">
        <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
          이 키는 Hook이 대시보드로 로그를 전송할 때 사용됩니다. 보안상 평문은{' '}
          <strong>발급 직후 한 번만</strong> 표시되며, 이후엔 재발급만 가능합니다.
        </p>

        {revealedKey ? (
          <div style={{
            background: '#fffbeb', border: `1px solid ${C.orange}`,
            borderRadius: 8, padding: 16, marginBottom: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: C.orange }}>
              지금 복사해두세요. 페이지를 떠나면 다시 볼 수 없습니다.
            </div>
            <CodeBlock code={revealedKey} />
            <button onClick={() => setRevealedKey(null)} style={{ ...btnSecondary, marginTop: 12 }}>
              감추기
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <Row label="상태" value={status.has_key ? '발급됨' : '미발급'} />
            {confirming ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={regenerate} disabled={busy} style={btnDanger}>
                  {busy ? '재발급 중...' : '재발급 확정'}
                </button>
                <button onClick={() => setConfirming(false)} style={btnSecondary}>취소</button>
              </div>
            ) : (
              <button onClick={() => setConfirming(true)} style={{ ...btnPrimary, marginTop: 8 }}>
                {status.has_key ? '재발급' : 'API 키 발급'}
              </button>
            )}
            {confirming && status.has_key && (
              <p style={{ fontSize: 12, color: C.red, marginTop: 8 }}>
                기존 키는 즉시 무효화됩니다. 모든 Hook 설정을 새 키로 갱신해야 합니다.
              </p>
            )}
          </div>
        )}
      </Section>

      <Section title="Hook 설치 가이드">
        <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
          본인 개발 레포에서 Claude Code 작업이 이 대시보드로 자동 수집되게 하려면 두 단계를 거치세요.
        </p>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontWeight: 500 }}>환경 선택</div>
          <EnvSelector value={env} onChange={setEnv} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <CodeBlock label="1) ~/.claude/.env 에 변수 3개 추가 (한 번만)" code={cmds.envPatch} />
        </div>

        <div>
          <CodeBlock label="2) 본인 레포 디렉토리에서 Hook 설치" code={cmds.installHook} />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: 20, marginBottom: 16,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: C.text }}>{title}</h3>
      {children}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 6, fontSize: 13 }}>
      <span style={{ width: 100, color: C.dim }}>{label}</span>
      <span style={{ color: C.text, fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: C.accent, color: '#fff', border: 'none', borderRadius: 6,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};

const btnSecondary: React.CSSProperties = {
  background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}`,
  borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer',
};

const btnDanger: React.CSSProperties = {
  background: C.red, color: '#fff', border: 'none', borderRadius: 6,
  padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
