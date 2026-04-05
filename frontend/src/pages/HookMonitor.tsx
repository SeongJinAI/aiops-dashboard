import { useState, useCallback } from 'react';
import { C } from '../constants/colors';
import { Box } from '../components/shared/Box';
import { useApi } from '../hooks/useApi';
import { useWebSocket } from '../hooks/useWebSocket';
import type { HookLog } from '../types';

export function HookMonitor() {
  const { data: apiLogs } = useApi<HookLog[]>('/repos/hooks', []);
  const [wsLogs, setWsLogs] = useState<HookLog[]>([]);

  const handleHookMessage = useCallback((data: Record<string, unknown>) => {
    setWsLogs(prev => [data as unknown as HookLog, ...prev]);
  }, []);

  useWebSocket({ hooks: handleHookMessage });

  const normalizeLogs = (raw: Record<string, unknown>[]): HookLog[] =>
    raw.map(r => ({
      ts: String(r.ts ?? ""),
      hook: String(r.hook ?? ""),
      script: String(r.script ?? ""),
      exit: Number(r.exit ?? r.exit_code ?? 0),
      ms: Number(r.ms ?? 0),
      repo: String(r.repo ?? ""),
      error: r.error ? String(r.error) : undefined,
      session: r.session ? String(r.session) : undefined,
    }));

  const allLogs = [...wsLogs, ...normalizeLogs(apiLogs as unknown as Record<string, unknown>[])].slice(0, 100);
  const logs = [...allLogs].sort((a, b) => b.ts.localeCompare(a.ts));

  const total = logs.length;
  const success = logs.filter(l => l.exit === 0).length;
  const failed = total - success;
  const successRate = total > 0 ? ((success / total) * 100).toFixed(1) : "0";

  const stats = [
    { l: "전체", v: String(total), c: C.text },
    { l: "성공", v: String(success), c: C.green },
    { l: "실패", v: String(failed), c: C.red },
    { l: "성공률", v: `${successRate}%`, c: C.green },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        {stats.map((m, i) => (
          <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: m.c }}>{m.v}</div>
            <div style={{ fontSize: 11, color: C.dim, marginTop: 4 }}>{m.l}</div>
          </div>
        ))}
      </div>
      <Box title="실시간 Hook 로그">
        {logs.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: C.dim }}>로그 데이터가 없습니다</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["시각", "Hook", "스크립트", "상태", "소요", "레포"].map(h => <td key={h} style={{ padding: "8px 10px", fontSize: 11, color: C.dim, fontWeight: 500 }}>{h}</td>)}</tr></thead>
            <tbody>{logs.map((l, i) => {
              const time = new Date(l.ts).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${C.surfaceAlt}` }}>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: C.dim }}>{time}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: C.text }}>{l.hook}</td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: C.dim }}>{l.script}</td>
                  <td style={{ padding: "8px 10px" }}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: l.exit === 0 ? `${C.green}15` : `${C.red}15`, color: l.exit === 0 ? C.green : C.red, fontWeight: 500 }}>{l.exit === 0 ? "성공" : "실패 " + l.exit}</span></td>
                  <td style={{ padding: "8px 10px", fontSize: 12, color: C.dim }}>{l.ms}ms</td>
                  <td style={{ padding: "8px 10px", fontSize: 11, color: C.dim }}>{l.repo}</td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Box>
    </div>
  );
}
