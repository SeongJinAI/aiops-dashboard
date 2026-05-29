// 연결 — Nova API 키 발급/재발급 + BYOK provider 키 + Hook 설치 가이드.
// /auth/api-key · /secrets/* 로직 보존, 새 디자인으로 리스킨.
import { useEffect, useState } from 'react';
import { useApi, apiPost } from '../hooks/useApi';
import { useAuth, getToken } from '../hooks/useAuth';
import { CodeBlock, EnvSelector } from '../components/onboarding/Snippets';
import { detectEnv, envCommands, type Env } from '../constants/onboarding';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip } from '../ui/primitives';

interface ApiKeyStatus { has_key: boolean }
interface RegenerateResponse { api_key: string }
interface ProviderStatus { has_key: boolean; preview: string | null; createdAt: string | null; lastUsedAt: string | null; }
interface ProviderMeta {
  name: 'anthropic' | 'openai' | 'gemini';
  label: string; defaultModel: string; settingsUrl: string; description: string; placeholder: string; short: string;
}

const PROVIDER_METAS: ProviderMeta[] = [
  { name: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-sonnet-4-5', settingsUrl: 'https://console.anthropic.com/settings/keys', description: '품질 우선 — 긴 문맥, 다국어, 코드 추론에 강함.', placeholder: 'sk-ant-api03-...', short: 'A' },
  { name: 'openai', label: 'OpenAI GPT', defaultModel: 'gpt-4o', settingsUrl: 'https://platform.openai.com/api-keys', description: '범용성 — 가장 흔한 표준. 안정적이며 가격대비 좋음.', placeholder: 'sk-...', short: 'O' },
  { name: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.0-flash', settingsUrl: 'https://aistudio.google.com/apikey', description: '구글 생태계 연동 — 무료 티어 존재.', placeholder: 'AI...', short: 'G' },
];

const NEW_KEY_SESSION = 'aiops_new_api_key';

interface ConnectionsProps {
  onReopenWizard?: () => void;
  /** 대시보드의 공개 URL — Hook 설치 명령의 baseUrl. App에서 /api/mode.public_url로부터 받음. */
  apiBase: string;
}

export function Connections({ onReopenWizard, apiBase }: ConnectionsProps) {
  const { pushToast } = useToast();
  const { auth } = useAuth();
  const { data: status, refetch } = useApi<ApiKeyStatus>('/auth/api-key', { has_key: false });
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [env, setEnv] = useState<Env>(detectEnv());

  useEffect(() => {
    const fresh = sessionStorage.getItem(NEW_KEY_SESSION);
    if (fresh) { setRevealedKey(fresh); sessionStorage.removeItem(NEW_KEY_SESSION); }
  }, []);

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await apiPost<RegenerateResponse>('/auth/api-key/regenerate', {});
      setRevealedKey(res.api_key);
      setConfirming(false);
      refetch();
      pushToast({ tone: 'success', title: 'Nova API 키가 재발급되었습니다.', desc: '기존 키는 즉시 무효화됩니다.' });
    } catch (e) {
      pushToast({ tone: 'danger', title: '재발급 실패', desc: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const tenantId = auth.tenantId || '';
  const cmds = envCommands(env, apiBase, revealedKey || '<API 키 — 재발급 후 붙여넣기>', tenantId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="plug" size={18} />연결</h1>
          <div className="page-sub">Nova API 키 · BYOK provider · Hook 설치 가이드</div>
        </div>
        {onReopenWizard && (
          <div className="actions">
            <Btn variant="secondary" icon="play" onClick={onReopenWizard}>온보딩 다시 보기</Btn>
          </div>
        )}
      </div>

      <Box title="계정 정보">
        <div className="kv-list">
          <div className="kv"><span className="k">이메일</span><span className="v">{auth.email || '—'}</span></div>
          <div className="kv"><span className="k">Tenant ID</span><span className="v">{tenantId || '—'}</span></div>
        </div>
      </Box>

      <Box title="Nova API 키" action={<Chip tone={status.has_key ? 'success' : 'neutral'} dot>{status.has_key ? 'active' : '미발급'}</Chip>}>
        <div className="text-dim" style={{ fontSize: 11.5, lineHeight: 1.6, marginBottom: 10 }}>
          Hook이 대시보드로 로그를 전송할 때 사용합니다. 평문은 <strong>발급 직후 한 번만</strong> 표시되며 이후엔 재발급만 가능합니다.
        </div>

        {revealedKey ? (
          <div className="alert alert-warning" style={{ marginBottom: 10 }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>지금 복사해두세요. 페이지를 떠나면 다시 볼 수 없습니다.</div>
            <CodeBlock code={revealedKey} />
            <div style={{ marginTop: 10 }}>
              <Btn variant="secondary" size="sm" icon="eye-off" onClick={() => setRevealedKey(null)}>감추기</Btn>
            </div>
          </div>
        ) : confirming ? (
          <div className="col" style={{ gap: 8 }}>
            {status.has_key && (
              <div className="text-danger" style={{ fontSize: 11.5 }}>기존 키는 즉시 무효화됩니다. 모든 Hook 설정을 새 키로 갱신해야 합니다.</div>
            )}
            <div className="row">
              <Btn variant="danger" icon="refresh" onClick={regenerate} disabled={busy}>{busy ? '재발급 중…' : '재발급 확정'}</Btn>
              <Btn variant="ghost" onClick={() => setConfirming(false)}>취소</Btn>
            </div>
          </div>
        ) : (
          <Btn variant="primary" icon="key" onClick={() => setConfirming(true)}>{status.has_key ? '재발급' : 'API 키 발급'}</Btn>
        )}
      </Box>

      <Box
        title="BYOK · LLM Provider"
        action={<span className="muted" style={{ fontSize: 11 }}>평문 키는 저장되지 않습니다. AES-GCM 암호화.</span>}
      >
        <div className="provider-grid">
          {PROVIDER_METAS.map((m) => <ProviderKeyCard key={m.name} meta={m} />)}
        </div>
      </Box>

      <HookInstallSection
        env={env}
        setEnv={setEnv}
        cmds={cmds}
        hasKey={!!revealedKey}
        apiBase={apiBase}
        apiKey={revealedKey || ''}
      />
    </>
  );
}

function ProviderKeyCard({ meta }: { meta: ProviderMeta }) {
  const { pushToast } = useToast();
  const { data: status, refetch } = useApi<ProviderStatus>(
    `/secrets/${meta.name}`, { has_key: false, preview: null, createdAt: null, lastUsedAt: null },
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [skip, setSkip] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const register = async () => {
    const key = input.trim();
    if (!key) return;
    setBusy(true);
    try {
      const res = await apiPost<{ has_key: boolean; preview: string; verified: boolean; message: string }>(
        `/secrets/${meta.name}`, { key, skip_verification: skip },
      );
      pushToast({ tone: 'success', title: `${meta.label} 키가 안전하게 저장되었습니다.`, desc: res.message });
      setInput(''); setEditing(false); refetch();
    } catch (e) {
      pushToast({ tone: 'danger', title: `${meta.label} 키 등록 실패`, desc: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const token = getToken();
      const res = await fetch(`/api/secrets/${meta.name}`, {
        method: 'DELETE', headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      pushToast({ tone: 'success', title: `${meta.label} 키가 삭제되었습니다.` });
      setConfirmDelete(false); refetch();
    } catch (e) {
      pushToast({ tone: 'danger', title: '삭제 실패', desc: e instanceof Error ? e.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const showInput = !status.has_key || editing;

  return (
    <div className={`provider-card ${status.has_key ? 'registered' : ''}`}>
      <div className="provider-head">
        <div className="provider-logo">{meta.short}</div>
        <div className="col" style={{ gap: 0 }}>
          <span className="provider-name">{meta.label}</span>
          <span className="muted mono" style={{ fontSize: 10.5 }}>{meta.defaultModel}</span>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {status.has_key ? <Chip tone="success" dot>verified</Chip> : <Chip tone="neutral">미등록</Chip>}
        </div>
      </div>

      <div className="muted" style={{ fontSize: 11, lineHeight: 1.5 }}>
        {meta.description}{' · '}
        <a href={meta.settingsUrl} target="_blank" rel="noreferrer" className="link-btn">키 발급</a>
      </div>

      {status.has_key && !editing && (
        <>
          <div className="provider-mask">{status.preview || '••••••••'}</div>
          <div className="row">
            <Btn variant="ghost" size="sm" icon="refresh" onClick={() => setEditing(true)}>갱신</Btn>
            {confirmDelete ? (
              <>
                <Btn variant="danger" size="sm" onClick={remove} disabled={busy}>{busy ? '삭제 중…' : '삭제 확정'}</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>취소</Btn>
              </>
            ) : (
              <Btn variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>삭제</Btn>
            )}
          </div>
        </>
      )}

      {showInput && (
        <div className="col" style={{ gap: 6 }}>
          <input
            className="input mono"
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={meta.placeholder}
          />
          <div className="row">
            <Btn variant="primary" size="sm" icon="key" onClick={register} disabled={busy || !input.trim()}>
              {busy ? '검증 중…' : '등록'}
            </Btn>
            {editing && <Btn variant="ghost" size="sm" onClick={() => { setEditing(false); setInput(''); }}>취소</Btn>}
          </div>
          <label className="toggle-inline">
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
            검증 건너뛰기 (외부 verify 실패 시에만)
          </label>
        </div>
      )}
    </div>
  );
}

function HookInstallSection({ env, setEnv, cmds, hasKey, apiBase, apiKey }: {
  env: Env; setEnv: (e: Env) => void; cmds: ReturnType<typeof envCommands>;
  hasKey: boolean; apiBase: string; apiKey: string;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const downloadUrl = hasKey && apiKey
    ? `${apiBase}/api/scripts/install.sh?token=${encodeURIComponent(apiKey)}&download=1`
    : '';
  return (
    <Box title="Hook 설치 가이드 (원클릭)">
      <div className="text-dim" style={{ fontSize: 11.5, lineHeight: 1.6, marginBottom: 10 }}>
        본인 레포에서 Claude Code 작업이 이 대시보드로 자동 수집되게 하려면, 아래 명령을 레포 디렉토리에서 한 번 실행하세요.
      </div>

      {!hasKey && (
        <div className="alert alert-warning" style={{ marginBottom: 10 }}>
          API 키 평문이 세션에 없습니다. 위에서 "재발급"으로 새 키를 받으면 이 명령에 자동 반영됩니다.
        </div>
      )}

      <div className="field" style={{ marginBottom: 10 }}>
        <span className="field-label">환경 선택</span>
        <EnvSelector value={env} onChange={setEnv} />
      </div>

      <CodeBlock label="원클릭 설치 — 본인 레포 루트에서 실행" code={cmds.oneLineInstall} />

      {hasKey && downloadUrl && (
        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <a className="btn btn-secondary btn-sm" href={downloadUrl} download="nova-install.sh">
            <Icon name="download" size={14} />
            install.sh 다운로드
          </a>
          <span className="muted" style={{ fontSize: 11 }}>
            받은 후 레포 루트에서 <code className="code-inline">bash nova-install.sh</code>
          </span>
        </div>
      )}

      <div className="pre-block" style={{ marginTop: 10, whiteSpace: 'normal', fontFamily: 'var(--font-sans)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>자동으로 처리되는 항목</div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><code className="code-inline">~/.claude/.env</code>에 환경변수 3개 추가</li>
          <li>현재 디렉토리를 활성 프로젝트로 자동 등록</li>
          <li>Hook 스크립트 3종 설치 + <code className="code-inline">settings.json</code> 갱신</li>
          <li>테스트 ping 전송으로 연결 확인</li>
        </ul>
      </div>

      <button className="link-btn" style={{ marginTop: 10 }} onClick={() => setShowAdvanced((v) => !v)} type="button">
        {showAdvanced ? '고급 옵션 닫기' : '고급: 2단계 수동 방식 보기'}
      </button>

      {showAdvanced && (
        <div className="col" style={{ marginTop: 10 }}>
          <CodeBlock label="1) ~/.claude/.env 에 변수 3개 추가 (한 번만)" code={cmds.envPatch} />
          <CodeBlock label="2) 본인 레포 디렉토리에서 Hook 설치" code={cmds.installHook} />
          <p className="muted" style={{ fontSize: 11 }}>
            이 방식은 레포 등록이 자동으로 되지 않습니다. "프로젝트" 페이지에서 별도 등록이 필요합니다.
          </p>
        </div>
      )}
    </Box>
  );
}
