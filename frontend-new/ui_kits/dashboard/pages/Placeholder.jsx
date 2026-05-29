// Placeholder for routes covered by the brief but not built in this UI kit.

function Placeholder({ title, icon = 'info', desc }) {
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name={icon} size={18}/>{title}</h1>
          <div className="page-sub">이 UI 키트에서는 보조 페이지로 분류되어 있습니다.</div>
        </div>
      </div>

      <EmptyState
        icon={icon}
        title={`${title} — 이 키트에는 포함되지 않습니다`}
        desc={desc || '본 디자인 시스템 키트는 Home / 프롬프트 / Hook 모니터 / 오해 추적 / 에이전트 / 연결 화면을 우선 다룹니다. 이 페이지는 실제 제품에서 사이드바를 통해 접근할 수 있습니다.'}
        primary={{ label: '디자인 시스템으로 돌아가기', icon: 'arrow-up-right' }}
      />
    </>
  );
}

window.Placeholder = Placeholder;
