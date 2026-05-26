import { useEffect, useState } from 'react';
import { C } from '../constants/colors';
import { useApi, apiPost } from '../hooks/useApi';
import { useAuth, getToken } from '../hooks/useAuth';
import { CodeBlock, EnvSelector } from '../components/onboarding/Snippets';
import { detectEnv, envCommands, type Env } from '../constants/onboarding';

interface ApiKeyStatus { has_key: boolean }
interface RegenerateResponse { api_key: string }

interface AnthropicStatus {
  has_key: boolean;
  preview: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

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

      <AnthropicKeySection />

      <HookInstallSection
        env={env}
        setEnv={setEnv}
        cmds={cmds}
        hasKey={!!revealedKey}
      />
    </div>
  );
}

function HookInstallSection({
  env,
  setEnv,
  cmds,
  hasKey,
}: {
  env: Env;
  setEnv: (e: Env) => void;
  cmds: ReturnType<typeof envCommands>;
  hasKey: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Section title="Hook 설치 가이드">
      <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
        본인 개발 레포에서 Claude Code 작업이 이 대시보드로 자동 수집되게 하려면 아래 명령을
        해당 레포 디렉토리에서 한 번 실행하면 됩니다.
      </p>

      {!hasKey && (
        <div
          style={{
            background: '#fffbeb',
            border: `1px solid ${C.orange}`,
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 12,
            color: C.orange,
            marginBottom: 12,
          }}
        >
          API 키 평문이 세션에 없습니다. 위의 "재발급"으로 새 키를 받은 직후 이 명령에 자동
          반영됩니다.
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.dim, marginBottom: 8, fontWeight: 500 }}>환경 선택</div>
        <EnvSelector value={env} onChange={setEnv} />
      </div>

      <CodeBlock label="원클릭 설치 — 본인 레포 루트에서 실행" code={cmds.oneLineInstall} />

      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: C.bg,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          fontSize: 12,
          color: C.dim,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>
          자동으로 처리되는 항목
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><code>~/.claude/.env</code>에 환경변수 3개 추가</li>
          <li>현재 디렉토리를 활성 프로젝트로 자동 등록</li>
          <li>Hook 스크립트 3종 설치 + <code>settings.json</code> 갱신</li>
          <li>테스트 ping 전송으로 연결 확인</li>
        </ul>
      </div>

      <button
        onClick={() => setShowAdvanced((v) => !v)}
        style={{
          marginTop: 12,
          background: 'transparent',
          border: 'none',
          color: C.dim,
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
          textDecoration: 'underline',
        }}
      >
        {showAdvanced ? '고급 옵션 닫기' : '고급: 2단계 수동 방식 보기'}
      </button>

      {showAdvanced && (
        <div style={{ marginTop: 12 }}>
          <CodeBlock label="1) ~/.claude/.env 에 변수 3개 추가 (한 번만)" code={cmds.envPatch} />
          <div style={{ height: 12 }} />
          <CodeBlock label="2) 본인 레포 디렉토리에서 Hook 설치" code={cmds.installHook} />
          <p style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
            이 방식은 레포 등록이 자동으로 되지 않습니다. "프로젝트 교체" 탭에서 별도 등록이
            필요합니다.
          </p>
        </div>
      )}
    </Section>
  );
}

function AnthropicKeySection() {
  const { data: status, refetch } = useApi<AnthropicStatus>(
    '/secrets/anthropic',
    { has_key: false, preview: null, createdAt: null, lastUsedAt: null },
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [skipVerification, setSkipVerification] = useState(false);

  const register = async () => {
    const key = input.trim();
    if (!key) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiPost<{ has_key: boolean; preview: string; verified: boolean; message: string }>(
        '/secrets/anthropic', { key, skip_verification: skipVerification },
      );
      setMessage({ kind: 'ok', text: `등록 완료 · ${res.message}` });
      setInput('');
      refetch();
    } catch (e) {
      // 백엔드 detail까지 보이도록 형태 그대로
      const errText = e instanceof Error ? e.message : '등록 실패';
      setMessage({ kind: 'err', text: errText });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const token = getToken();
      const res = await fetch('/api/secrets/anthropic', {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMessage({ kind: 'ok', text: '키가 삭제되었습니다.' });
      setConfirmingDelete(false);
      refetch();
    } catch (e) {
      setMessage({ kind: 'err', text: e instanceof Error ? e.message : '삭제 실패' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="Anthropic API 키 (Hermes 위키 생성용)">
      <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
        본인 Anthropic 키를 등록하면 <strong>에이전트 (Hermes)</strong> 탭의 위키 생성에 사용됩니다.
        키는 서버에서 <strong>AES-GCM으로 암호화</strong>되어 저장됩니다 (평문 보관 X).
        호출 비용은 본인 Anthropic 계정에 청구됩니다.
        <br />
        키 발급: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" style={{ color: C.accent }}>
          console.anthropic.com/settings/keys
        </a>
      </p>

      {status.has_key ? (
        <div>
          <Row label="상태" value="등록됨" />
          <Row label="키 미리보기" value={status.preview || '-'} mono />
          <Row label="등록 시각" value={status.createdAt || '-'} />
          <Row label="마지막 사용" value={status.lastUsedAt || '-'} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              onClick={() => { setConfirmingDelete(false); setInput(''); setMessage(null); }}
              style={btnSecondary}
            >
              새 키로 교체
            </button>
            {confirmingDelete ? (
              <>
                <button onClick={remove} disabled={busy} style={btnDanger}>
                  {busy ? '삭제 중...' : '삭제 확정'}
                </button>
                <button onClick={() => setConfirmingDelete(false)} style={btnSecondary}>취소</button>
              </>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} style={btnDanger}>
                키 삭제
              </button>
            )}
          </div>
        </div>
      ) : null}

      {(!status.has_key || message) && (
        <div style={{ marginTop: status.has_key ? 16 : 0 }}>
          <label style={{ fontSize: 12, color: C.dim, fontWeight: 500, display: 'block', marginBottom: 6 }}>
            {status.has_key ? '새 키 입력 (등록하면 기존 키 덮어씁니다)' : 'Anthropic API 키 입력'}
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="password"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="sk-ant-api03-..."
              style={{
                flex: 1, padding: '8px 12px', fontSize: 13,
                fontFamily: 'monospace', border: `1px solid ${C.border}`,
                borderRadius: 6, background: C.surface, color: C.text,
              }}
            />
            <button
              onClick={register}
              disabled={busy || !input.trim()}
              style={{
                background: C.accent, color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                cursor: busy ? 'wait' : 'pointer', opacity: busy || !input.trim() ? 0.6 : 1,
              }}
            >
              {busy ? '검증 중...' : '등록'}
            </button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: C.dim, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={skipVerification}
              onChange={(e) => setSkipVerification(e.target.checked)}
            />
            <span>검증 건너뛰기 (verify 호출이 실패할 때만 사용 — 잘못된 키도 통과됨)</span>
          </label>
          <p style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
            등록 시 짧은 테스트 호출(1~2초)로 키 유효성을 검증합니다. 사용 시점에는 진짜 위키 생성 호출이 일어납니다.
          </p>
        </div>
      )}

      {message && (
        <div style={{
          marginTop: 12,
          background: message.kind === 'ok' ? '#f0fdf4' : '#fff5f5',
          border: `1px solid ${message.kind === 'ok' ? C.green : C.red}`,
          borderRadius: 6, padding: '8px 12px', fontSize: 12,
          color: message.kind === 'ok' ? C.green : C.red,
        }}>
          {message.text}
        </div>
      )}
    </Section>
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
