// 프로젝트 교체 — /projects 목록 + /projects/swap. 전환 단계 모달 보존, 새 디자인.
import { useState } from 'react';
import { useApi, apiPost } from '../hooks/useApi';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip } from '../ui/primitives';
import type { Project } from '../types';

interface ProjectSwapProps {
  activeProject: Project;
  setActiveProject: (p: Project) => void;
}

const STEPS = [
  '프로젝트 레포 연결 해제', '.env 변수 업데이트', 'setup.sh 실행 (config 재생성)',
  '지식 레포 경로 갱신', '테스트 레포 연결 갱신', 'Hook 검증', '완료',
];

export function ProjectSwap({ activeProject, setActiveProject }: ProjectSwapProps) {
  const { pushToast } = useToast();
  // 백엔드 라우터가 `/api/projects/` (trailing slash)로 등록돼 있어
  // 슬래시 없이 호출하면 307 redirect 후 Authorization 헤더가 드롭되어 401이 된다.
  const { data: projects } = useApi<Project[]>('/projects/', []);
  const [swapUrl, setSwapUrl] = useState('');
  const [confirmSwap, setConfirmSwap] = useState<Project | null>(null);
  const [swapStep, setSwapStep] = useState<number | null>(null);

  const handleSwap = (project: Project) => { setConfirmSwap(project); setSwapStep(null); };

  const executeSwap = async () => {
    if (!confirmSwap) return;
    setSwapStep(0);
    try {
      await apiPost('/projects/swap', {
        name: confirmSwap.name,
        repoPath: confirmSwap.repoPath || '',
        gitUrl: confirmSwap.url || '',
      });
    } catch {
      // 실패를 정직하게 — 가짜 성공 애니메이션을 진행하지 않는다.
      setSwapStep(null);
      pushToast({ tone: 'danger', title: '프로젝트 전환 실패', desc: '서버 오류로 전환하지 못했습니다. 잠시 후 다시 시도하세요.' });
      return;
    }

    // 실제 전환 성공 후에만 단계 애니메이션 표시.
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setSwapStep(i);
      if (i >= STEPS.length - 1) {
        clearInterval(iv);
        setTimeout(() => {
          setActiveProject(confirmSwap);
          pushToast({ tone: 'success', title: `프로젝트 전환됨 — ${confirmSwap.name}`, desc: 'Hook·프롬프트·위키가 이 프로젝트 기준으로 재계산됩니다.' });
          setConfirmSwap(null);
          setSwapStep(null);
        }, 600);
      }
    }, 500);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="folder" size={18} />프로젝트</h1>
          <div className="page-sub">프로젝트 레포만 교체하면 나머지 4개 레포는 그대로 재사용됩니다.</div>
        </div>
      </div>

      <Box title="현재 활성 프로젝트" action={<Chip tone="success" dot>active</Chip>}>
        <div className="active-proj">
          <div className="active-proj-mark">{(activeProject.name || 'P').slice(0, 1).toUpperCase()}</div>
          <div className="active-proj-body">
            <div className="active-proj-name">{activeProject.name}</div>
            <div className="active-proj-meta">{activeProject.url || '로컬 프로젝트'}{activeProject.domain ? ` · ${activeProject.domain}` : ''}</div>
          </div>
        </div>
      </Box>

      <Box title="GitHub URL로 새 프로젝트 연결">
        <div className="row">
          <input
            className="input grow mono"
            value={swapUrl}
            onChange={(e) => setSwapUrl(e.target.value)}
            placeholder="https://github.com/org/repo-name"
          />
          <Btn
            variant="primary"
            icon="git-branch"
            onClick={() => {
              if (swapUrl.trim()) handleSwap({ name: swapUrl.split('/').pop() || 'new-project', url: swapUrl, domain: '새 프로젝트', status: 'ready' });
            }}
          >
            연결
          </Btn>
        </div>
      </Box>

      <Box title="등록된 프로젝트" padding={false}>
        {projects.length === 0 ? (
          <div className="empty-inline">등록된 프로젝트가 없습니다. 위에서 GitHub URL로 연결하세요.</div>
        ) : projects.map((p) => {
          const isActive = p.name === activeProject.name;
          return (
            <div className="activity-row" key={p.name}>
              <span className={`statusdot statusdot-${isActive ? 'success' : 'neutral'}`} />
              <div className="activity-title">
                <div>{p.name}</div>
                <div className="muted" style={{ fontSize: 10.5 }}>{p.domain}{p.url ? ` · ${p.url}` : ''}</div>
              </div>
              {isActive ? (
                <Chip tone="success">활성</Chip>
              ) : (
                <Btn variant="secondary" size="sm" onClick={() => handleSwap(p)}>전환</Btn>
              )}
            </div>
          );
        })}
      </Box>

      {confirmSwap && (
        <div className="scrim" onClick={() => swapStep === null && setConfirmSwap(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {swapStep === null ? (
              <>
                <div className="modal-title">프로젝트 교체 확인</div>
                <div className="row" style={{ marginBottom: 12 }}>
                  <Chip tone="danger">{activeProject.name}</Chip>
                  <Icon name="arrow-up-right" size={14} />
                  <Chip tone="success">{confirmSwap.name}</Chip>
                </div>
                <div className="col" style={{ gap: 4 }}>
                  {['거버넌스 레포 — 변경 없음', '테스트 레포 — .env 업데이트 + setup.sh 재실행', '지식 레포 — 새 프로젝트용 구조 초기화', 'RAG 레포 — 인덱스 경로 갱신'].map((t) => (
                    <div className="muted" key={t} style={{ fontSize: 11 }}>· {t}</div>
                  ))}
                </div>
                <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
                  <Btn variant="ghost" onClick={() => setConfirmSwap(null)}>취소</Btn>
                  <Btn variant="primary" icon="refresh" onClick={executeSwap}>교체 실행</Btn>
                </div>
              </>
            ) : (
              <>
                <div className="modal-title">교체 진행 중…</div>
                <div className="col" style={{ gap: 4 }}>
                  {STEPS.map((step, i) => {
                    const cls = i < swapStep ? 'done' : i === swapStep ? 'active' : '';
                    return (
                      <div key={step} className={`steprow ${i === swapStep ? 'active' : ''}`}>
                        <span className={`stepnum ${cls}`}>{i < swapStep ? '✓' : String(i + 1)}</span>
                        <span className="steprow-label">{step}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
