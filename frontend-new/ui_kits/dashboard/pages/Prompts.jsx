// Prompts page — line chart + time-of-day heatmap + log list

function Prompts() {
  const { dailyPrompts, heatmap, prompts } = window.NOVA_DATA;

  // Build line chart polyline points
  const w = 720, h = 160, pad = 28;
  const max = Math.max(...dailyPrompts);
  const min = Math.min(...dailyPrompts);
  const range = max - min || 1;
  const points = dailyPrompts.map((v, i) => {
    const x = pad + (i / (dailyPrompts.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const polyline = points.map((p) => p.join(',')).join(' ');
  const areaPath = `M ${points[0][0]},${h - pad} L ${polyline.replaceAll(' ', ' L ').replaceAll(',', ' ')} L ${points[points.length-1][0]},${h - pad} Z`;

  // Y ticks
  const yTicks = [0, 0.5, 1].map((t) => ({
    y: pad + (1 - t) * (h - pad * 2),
    v: Math.round(min + range * t),
  }));

  // Heatmap colour
  const cellColor = (v) => `rgba(99, 102, 241, ${0.06 + v * 0.86})`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <Icon name="message-square" size={18}/>
            프롬프트
          </h1>
          <div className="page-sub">30일 추이 · 시간대 패턴 · 최근 로그 · 12,847 총 프롬프트 / 8.4M 토큰</div>
        </div>
        <div className="actions">
          <Btn variant="ghost" icon="refresh">새로고침</Btn>
          <Btn variant="secondary" icon="download">CSV</Btn>
        </div>
      </div>

      <Box title="일별 프롬프트 · 30일" action={<><Chip tone="accent">+12% WoW</Chip><Btn variant="ghost" size="sm">30D</Btn><Btn variant="ghost" size="sm">90D</Btn></>}>
        <svg className="chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={pad} x2={w - pad} y1={t.y} y2={t.y} className="chart-axis"/>
              <text x={4} y={t.y + 3} className="chart-tick">{t.v}</text>
            </g>
          ))}
          <path d={`M ${points[0][0]},${h - pad} L ${points.map(p => p.join(',')).join(' L ')} L ${points[points.length-1][0]},${h - pad} Z`} className="chart-area"/>
          <polyline className="chart-line" points={polyline}/>
          {points.filter((_, i) => i % 5 === 4).map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="2" className="chart-dot"/>
          ))}
        </svg>
      </Box>

      <div className="dual">
        <Box title="시간대 히트맵 · 14일" action={<span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>피크: 새벽 1–3시 · 오후 2–4시</span>}>
          <div className="heatmap">
            <span></span>
            {Array.from({length: 24}, (_, h) => (
              <span className="col-label" key={h}>{h % 4 === 0 ? h : ''}</span>
            ))}
            {heatmap.map((row, d) => (
              <React.Fragment key={d}>
                <span className="row-label">{d === 0 ? '오늘' : `${d}일전`}</span>
                {row.map((v, h) => (
                  <div key={h} className="cell" style={{ background: cellColor(v) }} title={`${h}시 · ${Math.round(v*100)}%`}/>
                ))}
              </React.Fragment>
            ))}
          </div>
        </Box>

        <Box title="길이 분포" padding={true}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '6px 0' }}>
            {[14, 38, 65, 92, 78, 52, 31, 18, 8, 4].map((h, i) => (
              <div key={i} style={{ flex: 1, height: `${h}%`, background: 'var(--accent)', opacity: 0.5 + (h/100)*0.5, borderRadius: '2px 2px 0 0' }}/>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
            <span>0</span><span>100</span><span>500</span><span>1k+</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 10 }}>
            중앙값 <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>142 chars</strong> · 평균 <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>284</strong> · p95 <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-mono)' }}>892</strong>
          </div>
        </Box>
      </div>

      <Box title="최근 프롬프트" action={<><Btn variant="ghost" size="sm">필터</Btn><Btn variant="ghost" size="sm">정렬</Btn></>} padding={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 50 }}>TIME</th>
              <th>PROMPT</th>
              <th style={{ width: 80 }}>TAG</th>
              <th style={{ width: 140 }}>MODEL</th>
              <th className="right" style={{ width: 60 }}>TOKENS</th>
            </tr>
          </thead>
          <tbody>
            {prompts.map((p) => (
              <tr key={p.id}>
                <td className="mono">{p.when}</td>
                <td style={{ maxWidth: 440, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.text}</td>
                <td><Chip tone="neutral">{p.tag}</Chip></td>
                <td className="mono">{p.model}</td>
                <td className="right mono">{p.tokens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </>
  );
}

window.Prompts = Prompts;
