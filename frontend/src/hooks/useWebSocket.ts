import { useEffect, useRef, useState } from 'react';
import { getToken } from './useAuth';

type MessageHandler = (data: Record<string, unknown>) => void;

export function useWebSocket(handlers: Record<string, MessageHandler>) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;

      // SaaS 모드: JWT 토큰을 쿼리 파라미터로 전달
      const token = getToken();
      const params = token ? `?token=${encodeURIComponent(token)}` : '';
      const ws = new WebSocket(`${protocol}//${host}/ws/logs${params}`);

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const category = data.category as string;
          if (category && handlersRef.current[category]) {
            handlersRef.current[category](data);
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    }

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  return { connected };
}
