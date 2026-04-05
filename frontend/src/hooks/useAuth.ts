import { useState, useCallback } from 'react';

const TOKEN_KEY = 'aiops_token';
const TENANT_KEY = 'aiops_tenant_id';
const EMAIL_KEY = 'aiops_email';

export interface AuthState {
  token: string | null;
  tenantId: string | null;
  email: string | null;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem(TOKEN_KEY),
    tenantId: localStorage.getItem(TENANT_KEY),
    email: localStorage.getItem(EMAIL_KEY),
  }));

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '로그인 실패');
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(TENANT_KEY, data.tenant_id);
    localStorage.setItem(EMAIL_KEY, data.email);
    setAuth({ token: data.token, tenantId: data.tenant_id, email: data.email });
  }, []);

  const register = useCallback(async (tenantName: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenant_name: tenantName, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || '회원가입 실패');
    }
    const data = await res.json();
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(TENANT_KEY, data.tenant_id);
    localStorage.setItem(EMAIL_KEY, data.email);
    setAuth({ token: data.token, tenantId: data.tenant_id, email: data.email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TENANT_KEY);
    localStorage.removeItem(EMAIL_KEY);
    setAuth({ token: null, tenantId: null, email: null });
  }, []);

  return { auth, login, register, logout, isAuthenticated: !!auth.token };
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
