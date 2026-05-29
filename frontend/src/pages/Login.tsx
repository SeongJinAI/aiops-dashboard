// 로그인/회원가입 — 인증 진입점. onLogin/onRegister 로직 보존, 새 디자인.
import { useState, type FormEvent } from 'react';
import logoMark from '../brand-assets/logo-mark.svg';
import { Btn } from '../ui/primitives';

interface Props {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (tenantName: string, email: string, password: string) => Promise<{ apiKey: string }>;
  initialMode?: 'login' | 'register';
  onBack?: () => void;
}

export function Login({ onLogin, onRegister, initialMode = 'login', onBack }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [tenantName, setTenantName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else {
        const { apiKey } = await onRegister(tenantName, email, password);
        sessionStorage.setItem('aiops_new_api_key', apiKey);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logoMark} alt="" />
          <span className="auth-title">Nova</span>
        </div>
        <p className="auth-sub">
          {mode === 'login' ? '로그인하여 대시보드에 접속하세요' : '새 팀을 등록하세요'}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="auth-field">
              <label htmlFor="tenant">팀 이름</label>
              <input id="tenant" className="input" value={tenantName} onChange={(e) => setTenantName(e.target.value)} placeholder="예: 개발팀" required />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="email">이메일</label>
            <input id="email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required />
          </div>

          <div className="auth-field">
            <label htmlFor="password">비밀번호</label>
            <input id="password" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" required />
          </div>

          {error && <p className="text-danger" style={{ fontSize: 12, margin: '4px 0 12px' }}>{error}</p>}

          <Btn variant="primary" type="submit" disabled={loading} className="btn-block">
            {loading ? '처리 중…' : mode === 'login' ? '로그인' : '회원가입'}
          </Btn>
        </form>

        <p className="auth-foot">
          {mode === 'login' ? (
            <>계정이 없나요? <button className="link-btn" onClick={() => setMode('register')} type="button">회원가입</button></>
          ) : (
            <>이미 계정이 있나요? <button className="link-btn" onClick={() => setMode('login')} type="button">로그인</button></>
          )}
        </p>
        {onBack && (
          <p className="auth-foot">
            <button className="link-btn" onClick={onBack} type="button">← 소개 페이지로</button>
          </p>
        )}
      </div>
    </div>
  );
}
