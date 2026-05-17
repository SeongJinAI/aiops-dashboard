import { useEffect, useState } from 'react';
import { C } from '../constants/colors';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';

interface HookLog {
  ts?: string;
}

const FRESH_MS = 24 * 60 * 60 * 1000; // 24h

export function ConnectionStatus() {
  const { data } = useApi<HookLog[]>('/repos/hooks?limit=1', []);
  const [lastBeat, setLastBeat] = useState<number>(0);

  useWebSocket({
    hooks: () => setLastBeat(Date.now()),
  });

  // 초기 로딩 시점에 가장 최근 데이터 ts 반영
  useEffect(() => {
    const ts = data[0]?.ts;
    if (ts) {
      const t = new Date(ts).getTime();
      if (!isNaN(t)) setLastBeat((prev) => Math.max(prev, t));
    }
  }, [data]);

  const fresh = lastBeat > 0 && Date.now() - lastBeat < FRESH_MS;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        background: fresh ? `${C.green}12` : C.surfaceAlt,
        border: `1px solid ${fresh ? `${C.green}40` : C.border}`,
        borderRadius: 12,
      }}
      title={fresh ? '최근 24시간 내 Hook 데이터가 도착했습니다' : '아직 Hook 데이터가 없습니다'}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: fresh ? C.green : C.dim,
        }}
      />
      <span style={{ fontSize: 11, color: fresh ? C.green : C.dim, fontWeight: 500 }}>
        {fresh ? '연결됨' : '연결 대기'}
      </span>
    </div>
  );
}
