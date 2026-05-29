// Home page — system status, stat cards, repos, recent activity

function Home({ onNavigate }) {
  const { stats, repos, recent } = window.NOVA_DATA;

  const kindIcon = {
    wiki: 'sparkles',
    hook: 'activity',
    misun: 'alert-circle',
    prompt: 'message-square',
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <Icon name="home" size={18}/>
            홈
          </h1>
          <div className="page-sub">5월 28일 · 12:48 · 시스템 정상 · 5개 레포 추적 중</div>
        </div>
        <div className="actions">
          <Btn variant="ghost" icon="refresh">새로고침</Btn>
          <Btn variant="secondary" icon="download">CSV 내보내기</Btn>
        </div>
      </div>

      <div className="stat-grid">
        {stats.map((s) => <StatCard stat={s} key={s.id}/>)}
      </div>

      <div className="dual">
        <Box title="최근 활동 · Recent activity" action={<Btn variant="ghost" size="sm">전체 보기</Btn>} padding={false}>
          {recent.map((r) => (
            <div className="activity-row" key={r.id}>
              <div className={`kind kind-${r.kind}`}>
                <Icon name={kindIcon[r.kind]} size={13}/>
              </div>
              <div className="activity-title">{r.title}</div>
              <div className="activity-proj">{r.proj}</div>
              <div className="activity-when">{r.when}</div>
            </div>
          ))}
        </Box>

        <Box title="시스템 상태" action={<Chip tone="success" dot>running</Chip>}>
          <div className="kv-list">
            <div className="kv"><span className="k">API server</span><span className="v">200 OK · 14ms</span></div>
            <div className="kv"><span className="k">WebSocket</span><span className="v">connected · 23 events/m</span></div>
            <div className="kv"><span className="k">DB · SQLite</span><span className="v">42 MB</span></div>
            <div className="kv"><span className="k">Provider · Anthropic</span><span className="v">claude-haiku-4-5</span></div>
            <div className="kv"><span className="k">Token</span><span className="v">24h 남음</span></div>
            <div className="kv"><span className="k">Plan</span><span className="v">Pro · $19/mo</span></div>
          </div>
        </Box>
      </div>

      <Box title="추적 중인 레포" action={<Btn variant="secondary" size="sm" icon="plus">레포 추가</Btn>}>
        <div className="repo-grid">
          {repos.map((r) => (
            <div key={r.id} className={`repo ${r.status === 'active' ? 'active' : ''}`} onClick={() => onNavigate('/repo-map')}>
              <div className="repo-top">
                <Icon name="git-branch" size={14}/>
                <span className="repo-name">{r.name}</span>
                {r.status === 'active' && <Chip tone="accent">active</Chip>}
              </div>
              <div className="repo-desc">{r.desc}</div>
              <div className="repo-meta">
                <span>{r.branch}</span>
                {r.dirty && <Chip tone="warning">dirty</Chip>}
              </div>
            </div>
          ))}
        </div>
      </Box>
    </>
  );
}

window.Home = Home;
