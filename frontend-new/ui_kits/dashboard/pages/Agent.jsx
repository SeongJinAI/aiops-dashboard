// Agent page — wiki body, perspective tabs, build progress, version timeline
const { useState: _useState_ag, useRef: _useRef_ag } = React;

const STAGES = ['catalog', 'planner', 'developer', 'user', 'complete'];

function renderBlock(b, i) {
  switch (b.kind) {
    case 'h1': return <h1 key={i}>{b.text}</h1>;
    case 'h2': return <h2 key={i}>{b.text}</h2>;
    case 'p':  return <p key={i}>{b.text}</p>;
    case 'ul': return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
    case 'code': return <pre key={i}>{b.text}</pre>;
    default: return null;
  }
}

function Agent({ pushToast }) {
  const data = window.NOVA_DATA;
  const [persp, setPersp] = _useState_ag('planner');
  const [provider, setProvider] = _useState_ag('anthropic');
  const [model, setModel] = _useState_ag('');
  const [showHistory, setShowHistory] = _useState_ag(false);

  const [building, setBuilding] = _useState_ag(false);
  const [stageIdx, setStageIdx] = _useState_ag(-1);
  const [progress, setProgress] = _useState_ag(0);

  const timerRef = _useRef_ag();

  function startBuild() {
    if (building) return;
    setBuilding(true);
    setStageIdx(0);
    setProgress(0);
    let s = 0;
    timerRef.current = setInterval(() => {
      s += 1;
      if (s >= STAGES.length) {
        clearInterval(timerRef.current);
        setBuilding(false);
        setStageIdx(STAGES.length - 1);
        setProgress(100);
        pushToast && pushToast({ tone: 'success', title: 'Nova 빌드 완료', desc: `v4 자동 저장 · ${provider}${model ? ' · ' + model : ''}` });
        return;
      }
      setStageIdx(s);
      setProgress(Math.round((s / (STAGES.length - 1)) * 100));
    }, 900);
  }

  const providerLabel = {
    anthropic: 'Anthropic',
    openai:    'OpenAI',
    google:    'Google Gemini',
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="sparkles" size={18}/>에이전트</h1>
          <div className="page-sub">위키 자동 생성 · 3 perspective · 12개 버전 보관 · 최신 v3</div>
        </div>
        <div className="actions">
          <select className="select" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ minWidth: 140 }}>
            <option value="anthropic">{providerLabel.anthropic}</option>
            <option value="openai">{providerLabel.openai}</option>
            <option value="google">{providerLabel.google}</option>
          </select>
          <input
            className="input mono"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="모델 (선택)"
            style={{ width: 180 }}
          />
          <Btn variant="secondary" icon="history" onClick={() => setShowHistory(!showHistory)}>
            버전 히스토리
          </Btn>
          <Btn variant="primary" icon="sparkles" onClick={startBuild} disabled={building}>
            {building ? '빌드 중…' : 'Nova 업데이트'}
          </Btn>
        </div>
      </div>

      {(building || progress > 0) && (
        <Box title={building ? '빌드 진행 중' : '마지막 빌드'} action={<span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-dim)' }}>{progress}%</span>}>
          <div className="bar-frame">
            <div className="bar-top">
              <span>
                <span className="stage">{STAGES[stageIdx] || 'idle'}</span>
                {building ? ' 작성 중…' : building === false && progress === 100 ? ' — 위키 v4 자동 저장됨' : ''}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{Math.round((stageIdx + 1) * 14)}s</span>
            </div>
            <div className="bar-track">
              <div className={`bar-fill ${progress === 100 ? 'done' : ''}`} style={{ width: `${progress}%` }}/>
            </div>
            <div className="stages">
              {STAGES.map((s, i) => (
                <div key={s} className={`stg ${i < stageIdx ? 'done' : i === stageIdx ? 'active' : ''}`}>
                  <span className="ico"/>{s}
                </div>
              ))}
            </div>
          </div>
        </Box>
      )}

      <Box padding={false}>
        <div style={{ padding: '0 var(--s-lg)' }}>
          <div className="tabs">
            <button className={`tab ${persp === 'planner' ? 'active' : ''}`} onClick={() => setPersp('planner')}>
              <span className="dot purple"/>기획자
            </button>
            <button className={`tab ${persp === 'developer' ? 'active' : ''}`} onClick={() => setPersp('developer')}>
              <span className="dot accent"/>개발자
            </button>
            <button className={`tab ${persp === 'user' ? 'active' : ''}`} onClick={() => setPersp('user')}>
              <span className="dot cyan"/>사용자
            </button>
          </div>
        </div>
        <div style={{ padding: 'var(--s-lg) var(--s-xl)' }} className="wiki">
          {data.wikiBody.map(renderBlock)}
        </div>
      </Box>

      {showHistory && (
        <Box title="버전 히스토리" action={<Btn variant="ghost" size="sm">전체 보기</Btn>}>
          <div className="timeline">
            {data.versions.map((v) => (
              <div key={v.ver} className={`tl-entry ${v.current ? 'current' : ''}`}>
                <div className="tl-head">
                  <span className="tl-ver">{v.ver}</span>
                  <span className="tl-time">{v.time}</span>
                  <span className="tl-provider">{v.provider}</span>
                </div>
                <div className="tl-diff">
                  {v.diff.added > 0 && <><span className="add">+{v.diff.added}</span> sections </>}
                  {v.diff.removed > 0 && <>· <span className="rm">−{v.diff.removed}</span> </>}
                  — {v.summary}
                </div>
              </div>
            ))}
          </div>
        </Box>
      )}
    </>
  );
}

window.Agent = Agent;
