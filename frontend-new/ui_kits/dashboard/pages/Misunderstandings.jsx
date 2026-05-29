// Misunderstandings — pattern distribution + detection log

function Misunderstandings() {
  const { misunderstandings } = window.NOVA_DATA;

  const total = misunderstandings.reduce((s, m) => s + m.occurrences, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="alert-circle" size={18}/>오해 추적</h1>
          <div className="page-sub">AI가 잘못 이해한 패턴 자동 감지 · 지난 30일 {total}건 · 전주 대비 −18%</div>
        </div>
      </div>

      <Box title="패턴별 분포" action={<Chip tone="warning" dot>3 active patterns</Chip>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {misunderstandings.map((m) => {
            const pct = Math.round((m.occurrences / total) * 100);
            return (
              <div key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12 }}>
                  <span style={{ fontWeight: 500 }}>{m.pattern}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-dim)' }}>
                    {m.occurrences}회 · {pct}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--surface-alt)', borderRadius: 'var(--r-full)', marginTop: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: m.severity === 'warning' ? 'var(--warning)' : 'var(--info)',
                    borderRadius: 'var(--r-full)',
                  }}/>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{m.desc}</div>
              </div>
            );
          })}
        </div>
      </Box>

      <Box title="감지 로그" padding={false}>
        <table className="tbl">
          <thead>
            <tr>
              <th>PATTERN</th>
              <th style={{ width: 100 }}>SEVERITY</th>
              <th className="right" style={{ width: 100 }}>OCCURRENCES</th>
              <th className="right" style={{ width: 100 }}>LAST SEEN</th>
              <th style={{ width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {misunderstandings.map((m) => (
              <tr key={m.id}>
                <td>{m.pattern}</td>
                <td><Chip tone={m.severity} dot>{m.severity}</Chip></td>
                <td className="right mono">{m.occurrences}</td>
                <td className="right mono">{m.lastSeen}</td>
                <td><Btn variant="ghost" size="sm">상세</Btn></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <EmptyState
        icon="lightbulb"
        title="Coach가 활성화되면 — 다음 단계 제안 (비전, 미구현)"
        desc="패턴 ‘Tailwind v4 syntax confusion’이 자주 감지됩니다. .claude/CLAUDE.md 에 다음 규칙을 추가하면 같은 실수가 줄어들 수 있습니다."
        primary={{ label: 'Coach 미리보기', icon: 'arrow-up-right' }}
      />
    </>
  );
}

window.Misunderstandings = Misunderstandings;
