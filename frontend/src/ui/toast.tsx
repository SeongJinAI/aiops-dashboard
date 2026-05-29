// Toast 컨텍스트 — 모든 mutation 피드백을 우측 하단 스택으로. (Sonner 대체, ui.css .toast)
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export interface ToastInput {
  tone?: 'info' | 'success' | 'danger';
  title: string;
  desc?: string;
}

interface ToastItem extends ToastInput {
  id: string;
}

interface ToastCtxValue {
  pushToast: (t: ToastInput) => void;
}

const ToastCtx = createContext<ToastCtxValue>({ pushToast: () => {} });

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastCtxValue {
  return useContext(ToastCtx);
}

const ICON_FOR: Record<string, string> = {
  success: 'check-circle',
  danger: 'x-circle',
  info: 'info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((t: ToastInput) => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((ts) => [...ts, { id, ...t }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4500);
  }, []);

  const dismiss = (id: string) => setToasts((ts) => ts.filter((x) => x.id !== id));

  return (
    <ToastCtx.Provider value={{ pushToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div className={`toast ${t.tone || 'info'}`} key={t.id}>
            <Icon className="toast-ico" name={ICON_FOR[t.tone || 'info']} size={14} />
            <div className="toast-title">{t.title}</div>
            <button className="toast-x" onClick={() => dismiss(t.id)} aria-label="닫기" type="button">
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
