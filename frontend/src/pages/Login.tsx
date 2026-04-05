import { useState } from 'react';
import { C } from '../constants/colors';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (tenantName: string, email: string, password: string) => Promise<void>;
}

export function Login({ onLogin, onRegister }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        await onRegister(tenantName, email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: C.bg, fontFamily: "'Pretendard', sans-serif",
    }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 40, width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: C.text }}>
          AI OPS Dashboard
        </h1>
        <p style={{ color: C.dim, fontSize: 14, marginBottom: 28 }}>
          {mode === 'login' ? '로그인하여 대시보드에 접속하세요' : '새 팀을 등록하세요'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: C.text }}>
                팀 이름
              </label>
              <input
                value={tenantName} onChange={e => setTenantName(e.target.value)}
                placeholder="예: 개발팀"
                required
                style={{
                  width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                  borderRadius: 8, fontSize: 14, color: C.text, background: C.surface,
                }}
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: C.text }}>
              이메일
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="user@example.com"
              required
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, color: C.text, background: C.surface,
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: C.text }}>
              비밀번호
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력"
              required
              style={{
                width: '100%', padding: '10px 12px', border: `1px solid ${C.border}`,
                borderRadius: 8, fontSize: 14, color: C.text, background: C.surface,
              }}
            />
          </div>

          {error && (
            <p style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>{error}</p>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              width: '100%', padding: '12px 0', background: C.accent, color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: C.dim }}>
          {mode === 'login' ? (
            <>계정이 없나요? <span onClick={() => setMode('register')} style={{ color: C.accent, cursor: 'pointer', fontWeight: 600 }}>회원가입</span></>
          ) : (
            <>이미 계정이 있나요? <span onClick={() => setMode('login')} style={{ color: C.accent, cursor: 'pointer', fontWeight: 600 }}>로그인</span></>
          )}
        </p>
      </div>
    </div>
  );
}
