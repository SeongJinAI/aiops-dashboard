// Hook Monitor — realtime table with slide-in animation
const { useState: _useState_hm, useEffect: _useEffect_hm, useRef: _useRef_hm } = React;

function HookMonitor() {
  const seed = window.NOVA_DATA.hooks;
  const [rows, setRows] = _useState_hm(seed);
  const [paused, setPaused] = _useState_hm(false);
  const intervalRef = _useRef_hm();

  _useEffect_hm(() => {
    if (paused) return;
    const pool = [
      { name: 'PostToolUse · Edit',      project: 'nova',  status: 'success', dms: () => Math.round(20 + Math.random()*100) + 'ms' },
      { name: 'UserPromptSubmit',        project: 'nova',  status: 'success', dms: () => Math.round(5 + Math.random()*30) + 'ms' },
      { name: 'PreToolUse · Bash',       project: 'kepler', status: 'success', dms: () => (0.5 + Math.random()*2).toFixed(1) + 's' },
      { name: 'PostToolUse · WriteFile', project: 'lyra',   status: 'success', dms: () => Math.round(15 + Math.random()*60) + 'ms' },
      { name: 'Notification',            project: 'kepler', status: 'failed',  dms: () => (2 + Math.random()*3).toFixed(1) + 's' },
      { name: 'PreToolUse · Grep',       project: 'inkwell',status: 'retry',   dms: () => (0.8 + Math.random()).toFixed(1) + 's' },
    ];
    intervalRef.current = setInterval(() => {
      const e = pool[Math.floor(Math.random()*pool.length)];
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
      setRows((r) => [{ ...e, duration: e.dms(), time, id: `r-${Date.now()}`, fresh: true }, ...r].slice(0, 14));
    }, 2800);
    return () => clearInterval(intervalRef.current);
  }, [paused]);

  const toneFor = (s) => s === 'success' ? 'success' : s === 'failed' ? 'danger' : 'warning';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="activity" size={18}/>Hook 모니터</h1>
          <div className="page-sub">WebSocket 연결됨 · {rows.length}개 행 표시 · 새 이벤트 자동 슬라이드 인</div>
        </div>
        <div className="actions">
          <Chip tone={paused ? 'neutral' : 'success'} dot>{paused ? 'paused' : 'live'}</Chip>
          <Btn variant="secondary" icon={paused ? 'play' : 'clock'} onClick={() => setPaused(!paused)}>
            {paused ? '재개' : '일시정지'}
          </Btn>
          <Btn variant="ghost" icon="download">로그 다운로드</Btn>
        </div>
      </div>

      <Box padding={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 220 }}>HOOK</th>
              <th>PROJECT</th>
              <th style={{ width: 100 }}>STATUS</th>
              <th className="right" style={{ width: 80 }}>DURATION</th>
              <th className="right" style={{ width: 100 }}>TIME</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.fresh ? 'new' : ''}>
                <td className="mono">{r.name}</td>
                <td className="mono">{r.project}</td>
                <td><Chip tone={toneFor(r.status)} dot>{r.status}</Chip></td>
                <td className="right mono">{r.duration}</td>
                <td className="right mono">{r.time}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </>
  );
}

window.HookMonitor = HookMonitor;
