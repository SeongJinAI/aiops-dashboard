// Connections — API key issuance + BYOK cards
const { useState: _useState_cn } = React;

function Connections({ pushToast }) {
  const [apiKey, setApiKey] = _useState_cn('hop_live_a1b2c3d4e5f6***x9y0');

  const providers = [
    { id: 'anthropic', name: 'Anthropic',     short: 'A', mask: 'sk-ant-1***xyz9',  defaultModel: 'claude-haiku-4-5', registered: true,  verified: true },
    { id: 'openai',    name: 'OpenAI',        short: 'O', mask: 'sk-proj-7***k2m1', defaultModel: 'gpt-5',            registered: true,  verified: true },
    { id: 'google',    name: 'Google Gemini', short: 'G', mask: null,               defaultModel: 'gemini-2.5-pro',   registered: false, verified: false },
  ];

  function rotate() {
    pushToast && pushToast({ tone: 'success', title: 'Nova API 키가 재발급되었습니다.', desc: '기존 키는 24시간 후 만료됩니다.' });
    setApiKey('hop_live_z9y8x7w6v5u4***a0b1');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="plug" size={18}/>연결</h1>
          <div className="page-sub">Nova API 키 · BYOK provider · Hook 설치 가이드</div>
        </div>
      </div>

      <Box title="Nova API 키" action={<Chip tone="success" dot>active</Chip>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            CLI(<code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-alt)', padding: '1px 4px', borderRadius: 3 }}>nova install</code>)와 hook이 이 키로 인증합니다.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input mono" value={apiKey} readOnly style={{ flex: 1, maxWidth: 360 }}/>
            <Btn variant="secondary" icon="copy">복사</Btn>
            <Btn variant="danger" icon="refresh" onClick={rotate}>재발급</Btn>
          </div>
        </div>
      </Box>

      <Box title="BYOK · LLM Provider" action={<span style={{ fontSize: 11, color: 'var(--text-faint)' }}>평문 키는 저장되지 않습니다. AES-GCM 암호화.</span>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--s-md)' }}>
          {providers.map((p) => (
            <div key={p.id} className={`provider-card ${p.registered ? 'registered' : ''}`}>
              <div className="provider-head">
                <div className="provider-logo">{p.short}</div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="provider-name">{p.name}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>{p.model}</span>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {p.verified  && <Chip tone="success" dot>verified</Chip>}
                  {!p.registered && <Chip tone="neutral">미등록</Chip>}
                </div>
              </div>
              {p.registered ? (
                <>
                  <div className="provider-mask">{p.mask}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" size="sm" icon="refresh">갱신</Btn>
                    <Btn variant="danger" size="sm">삭제</Btn>
                  </div>
                </>
              ) : (
                <>
                  <input className="input mono" type="password" placeholder="키 입력…"/>
                  <Btn variant="primary" size="sm" icon="key" onClick={() => pushToast && pushToast({ tone: 'success', title: `${p.name} 키가 안전하게 저장되었습니다.`, desc: `model: ${p.model} — 검증 통과` })}>
                    등록
                  </Btn>
                </>
              )}
            </div>
          ))}
        </div>
      </Box>

      <Box title="Hook 설치 (원클릭)" action={<Btn variant="ghost" size="sm" icon="copy">복사</Btn>}>
        <pre style={{
          background: 'var(--surface-alt)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-md)', padding: '10px 12px',
          fontFamily: 'var(--font-mono)', fontSize: 11.5, lineHeight: 1.6,
          margin: 0, overflowX: 'auto',
        }}>
{`# macOS / Linux
curl -fsSL https://get.nova.dev | sh

# 그 다음, .claude/ 디렉토리가 있는 프로젝트 루트에서
nova install --token=${apiKey}`}
        </pre>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
          설치 후 Claude Code, Cursor, Windsurf에서 자동으로 hook이 활성화됩니다.
        </div>
      </Box>
    </>
  );
}

window.Connections = Connections;
