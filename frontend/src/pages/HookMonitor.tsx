// Hook 모니터 — /repos/hooks 초기 로드 + /ws/logs(category: hooks) 실시간 슬라이드 인.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip } from '../ui/primitives';
import { fmtDuration, timeOf } from '../lib/format';
import type { HookLog } from '../types';

type Row = HookLog & { _k: string; _fresh?: boolean };

function normalize(r: Record<string, unknown>): HookLog {
  return {
    ts: String(r.ts ?? ''),
    hook: String(r.hook ?? ''),
    script: String(r.script ?? ''),
    exit: Number(r.exit ?? r.exit_code ?? 0),
    ms: Number(r.ms ?? 0),
    repo: String(r.repo ?? ''),
    error: r.error ? String(r.error) : undefined,
    session: r.session ? String(r.session) : undefined,
  };
}

export function HookMonitor() {
  const { data: apiLogs } = useApi<HookLog[]>('/repos/hooks', []);
  const [wsLogs, setWsLogs] = useState<Row[]>([]);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const handle = useCallback((data: Record<string, unknown>) => {
    if (pausedRef.current) return;
    const k = `ws-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const row: Row = { ...normalize(data), _k: k, _fresh: true };
    setWsLogs((prev) => [row, ...prev].slice(0, 50));
    setTimeout(() => setWsLogs((prev) => prev.map((l) => (l._k === k ? { ...l, _fresh: false } : l))), 900);
  }, []);

  useWebSocket({ hooks: handle });

  const apiRows: Row[] = (apiLogs as unknown as Record<string, unknown>[])
    .map((r, i) => ({ ...normalize(r), _k: `api-${i}` }));
  const rows = [...wsLogs, ...apiRows]
    .sort((a, b) => b.ts.localeCompare(a.ts))
    .slice(0, 60);

  const total = rows.length;
  const failed = rows.filter((r) => r.exit !== 0).length;

  const tone = (exit: number) => (exit === 0 ? 'success' : 'danger');
  const label = (exit: number) => (exit === 0 ? 'success' : `failed ${exit}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="activity" size={18} />Hook 모니터</h1>
          <div className="page-sub">WebSocket 실시간 · {total}개 표시 · 실패 {failed}건</div>
        </div>
        <div className="actions">
          <Chip tone={paused ? 'neutral' : 'success'} dot>{paused ? 'paused' : 'live'}</Chip>
          <Btn variant="secondary" icon={paused ? 'play' : 'pause'} onClick={() => setPaused((p) => !p)}>
            {paused ? '재개' : '일시정지'}
          </Btn>
        </div>
      </div>

      <Box padding={false}>
        {rows.length === 0 ? (
          <div className="empty-inline">Hook 활동이 없습니다. Hook이 설치되면 실시간으로 표시됩니다.</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 220 }}>HOOK</th>
                <th>SCRIPT</th>
                <th style={{ width: 120 }}>REPO</th>
                <th style={{ width: 110 }}>STATUS</th>
                <th className="right" style={{ width: 80 }}>DURATION</th>
                <th className="right" style={{ width: 96 }}>TIME</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._k} className={r._fresh ? 'new' : ''}>
                  <td className="mono">{r.hook}</td>
                  <td className="mono">{r.script}</td>
                  <td className="mono">{r.repo}</td>
                  <td><Chip tone={tone(r.exit)} dot>{label(r.exit)}</Chip></td>
                  <td className="right mono">{fmtDuration(r.ms)}</td>
                  <td className="right mono">{timeOf(r.ts)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Box>
    </>
  );
}
