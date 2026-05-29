// 에이전트 (Nova) — 위키 자동 생성. /hermes/* 빌드 로직 + WS progress + 버전 히스토리 보존.
import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { apiPost, useApi } from '../hooks/useApi';
import { getToken } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip } from '../ui/primitives';

interface AssetEntry { path: string; perspective: string; size_bytes: number; preview: string; bucket: string; }
interface CatalogResponse {
  project: string; repoPath: string;
  summary: { total: number; totalBytes: number; byPerspective: Record<string, number>; byBucket: Record<string, number>; };
  assets: { planner: AssetEntry[]; developer: AssetEntry[]; user: AssetEntry[]; };
}
interface WikiLatest {
  project: string;
  perspectives: Record<string, { content: string; version: number; updatedAt: string }>;
  version: number; updatedAt: string | null;
}
interface RunStatus {
  id: number; status: 'running' | 'success' | 'partial_success' | 'failed';
  started_at?: string; finished_at?: string; input_count?: number; output_chars?: number;
  error?: string; diff_summary?: string; stage?: string; message?: string; progress?: number; provider?: string;
}
interface SecretStatusEntry { kind: 'anthropic' | 'openai' | 'gemini'; has_key: boolean; preview: string | null; }
interface VersionEntry {
  version: number; updatedAt: string; chars: number;
  diffFromPrev: { summary: string; added: string[]; removed: string[]; char_delta: number };
}

type Persp = 'planner' | 'developer' | 'user';

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic Claude', openai: 'OpenAI GPT', gemini: 'Google Gemini',
};
const PERSPECTIVE_LABEL: Record<Persp, string> = { planner: '기획자', developer: '개발자', user: '사용자' };
const PERSP_DOT: Record<Persp, string> = { planner: 'purple', developer: 'accent', user: 'cyan' };
const STAGES = ['catalog', 'planner', 'developer', 'user', 'complete'];

const fmtBytes = (n: number) => (n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`);

export function Agent() {
  const { pushToast } = useToast();
  const [error, setError] = useState<string | null>(null);

  const { data: wiki, refetch: refetchWiki } = useApi<WikiLatest>(
    '/hermes/wiki/latest',
    { project: '', perspectives: {}, version: 0, updatedAt: null },
  );
  const { data: secretStatus } = useApi<SecretStatusEntry[]>('/secrets', []);
  const registeredProviders = secretStatus.filter((s) => s.has_key).map((s) => s.kind);
  const [selectedProvider, setSelectedProvider] = useState<string>('anthropic');

  useEffect(() => {
    if (registeredProviders.length === 0) return;
    if (!registeredProviders.includes(selectedProvider as 'anthropic')) {
      setSelectedProvider(registeredProviders[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registeredProviders.join(',')]);

  const [activeRun, setActiveRun] = useState<RunStatus | null>(null);
  const isRunning = activeRun?.status === 'running';
  const hasContent = wiki.version > 0;

  const triggerUpdate = async () => {
    setError(null);
    if (registeredProviders.length === 0) {
      setError('AI 프로바이더 키가 하나도 등록되지 않았습니다. "연결"에서 Anthropic/OpenAI/Gemini 중 하나를 등록하세요.');
      return;
    }
    try {
      const res = await apiPost<{ run_id: number; status: string; provider: string }>(
        '/hermes/wiki/update', { provider: selectedProvider },
      );
      setActiveRun({ id: res.run_id, status: 'running', provider: res.provider });
      pushToast({ tone: 'info', title: 'Nova 위키 빌드를 시작했습니다.', desc: PROVIDER_LABELS[res.provider] || res.provider });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nova 업데이트 실패');
    }
  };

  // WS 실시간 진행
  const progressHandler = useCallback((data: Record<string, unknown>) => {
    setActiveRun((prev) => {
      if (!prev || prev.id !== (data.run_id as number)) return prev;
      return { ...prev, stage: data.stage as string, message: data.message as string, progress: data.progress as number };
    });
    if (data.stage === 'complete' || data.stage === 'failed') refetchWiki();
  }, [refetchWiki]);
  useWebSocket({ hermes_progress: progressHandler });

  // 폴링(최종 상태 확정)
  useEffect(() => {
    if (!activeRun || activeRun.status !== 'running') return;
    let cancelled = false;
    const token = getToken();
    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/hermes/runs/${activeRun.id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data: RunStatus = await res.json();
          setActiveRun((prev) => (prev ? { ...prev, ...data } : data));
          if (data.status === 'success' || data.status === 'partial_success') {
            refetchWiki();
            pushToast({ tone: 'success', title: 'Nova 위키 빌드 완료', desc: data.diff_summary });
            return;
          }
          if (data.status === 'failed') {
            pushToast({ tone: 'danger', title: 'Nova 위키 빌드 실패', desc: data.error });
            return;
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setTimeout(poll, 5000);
    };
    const t = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [activeRun, refetchWiki, pushToast]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="sparkles" size={18} />에이전트</h1>
          <div className="page-sub">위키 자동 생성 · 3 perspective · {hasContent ? `최신 v${wiki.version}` : '아직 생성되지 않음'}</div>
        </div>
        <div className="actions">
          {registeredProviders.length > 0 ? (
            <select
              className="select"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              disabled={isRunning}
              style={{ minWidth: 160 }}
              title="위키 생성에 사용할 AI 프로바이더"
            >
              {registeredProviders.map((p) => <option key={p} value={p}>{PROVIDER_LABELS[p] || p}</option>)}
            </select>
          ) : (
            <Chip tone="warning">연결에서 키 등록 필요</Chip>
          )}
          <Btn
            variant="primary"
            icon="sparkles"
            onClick={triggerUpdate}
            disabled={isRunning || registeredProviders.length === 0}
          >
            {isRunning ? '빌드 중…' : (hasContent ? 'Nova 다시 업데이트' : 'Nova 업데이트')}
          </Btn>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {activeRun && <RunProgress run={activeRun} />}

      <WikiPanel wiki={wiki} />

      <CatalogPanel />
    </>
  );
}

function RunProgress({ run }: { run: RunStatus }) {
  const progress = run.progress ?? 0;
  const stageIdx = STAGES.indexOf(run.stage || '');
  const done = run.status === 'success' || run.status === 'partial_success';
  const failed = run.status === 'failed';
  const fillCls = failed ? 'fail' : done ? 'done' : '';

  return (
    <Box
      title={run.status === 'running' ? '빌드 진행 중' : done ? '마지막 빌드' : '빌드 상태'}
      action={<span className="mono text-dim">{progress}%</span>}
    >
      <div className="bar-frame">
        <div className="bar-top">
          <span><span className="stage">{run.stage || 'idle'}</span>{run.message ? ` · ${run.message}` : ''}</span>
          {run.input_count ? <span className="mono">{run.input_count}개 자산 · {run.output_chars ?? 0}자</span> : null}
        </div>
        <div className="bar-track">
          <div className={`bar-fill ${fillCls}`} style={{ width: `${Math.max(2, Math.min(100, progress))}%` }} />
        </div>
        <div className="stages">
          {STAGES.map((s, i) => (
            <div key={s} className={`stg ${i < stageIdx ? 'done' : i === stageIdx ? 'active' : ''}`}>
              <span className="ico" />{s}
            </div>
          ))}
        </div>
      </div>
      {failed && <div className="distrow-desc text-danger">{run.error || '알 수 없는 오류'}</div>}
      {done && run.diff_summary && <div className="distrow-desc">{run.diff_summary}</div>}
    </Box>
  );
}

function WikiPanel({ wiki }: { wiki: WikiLatest }) {
  const [persp, setPersp] = useState<Persp>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<VersionEntry[]>([]);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [viewingContent, setViewingContent] = useState('');
  const hasContent = wiki.version > 0;
  const current = wiki.perspectives[persp];

  useEffect(() => {
    if (!showHistory || !hasContent) return;
    const token = getToken();
    fetch(`/api/hermes/wiki/versions?perspective=${persp}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: VersionEntry[]) => setHistory(data))
      .catch(() => setHistory([]));
  }, [showHistory, persp, hasContent, wiki.version]);

  const changePersp = (p: Persp) => { setPersp(p); setViewingVersion(null); setViewingContent(''); };

  const loadVersion = async (version: number) => {
    if (version === current?.version) { setViewingVersion(null); setViewingContent(''); return; }
    const token = getToken();
    const res = await fetch(`/api/hermes/wiki/version?perspective=${persp}&version=${version}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) { const data = await res.json(); setViewingVersion(version); setViewingContent(data.content); }
  };

  const content = viewingVersion !== null ? viewingContent : (current?.content || '');
  const shownVersion = viewingVersion !== null ? viewingVersion : current?.version;

  return (
    <>
      <Box
        padding={false}
        action={hasContent ? (
          <Btn variant="ghost" size="sm" icon="history" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? '히스토리 닫기' : '버전 히스토리'}
          </Btn>
        ) : undefined}
        title="프로젝트 위키"
      >
        <div className="tabs tabs-inset">
          {(['planner', 'developer', 'user'] as Persp[]).map((p) => {
            const has = wiki.perspectives[p];
            return (
              <button key={p} className={`tab ${persp === p ? 'active' : ''}`} onClick={() => changePersp(p)} type="button">
                <span className={`dot ${PERSP_DOT[p]}`} />
                {PERSPECTIVE_LABEL[p]}
                {has && <span className="muted mono"> v{has.version}</span>}
              </button>
            );
          })}
        </div>

        {!hasContent ? (
          <div className="wiki-empty">
            <Icon name="sparkles" size={24} />
            <div className="wiki-empty-title">아직 생성된 위키가 없습니다</div>
            <div className="wiki-empty-desc">
              <strong>[Nova 업데이트]</strong>를 누르면 활성 프로젝트의 마크다운 자산을 분석해
              기획자 / 개발자 / 사용자 3-perspective 위키를 자동 생성합니다.
              <br />AI 프로바이더 키가 필요합니다 (연결 페이지에서 등록).
            </div>
          </div>
        ) : !current ? (
          <div className="empty-inline">이 perspective에는 생성된 위키가 없습니다. 업데이트를 다시 실행하세요.</div>
        ) : (
          <>
            <div className="wiki-meta">
              <span>버전 {shownVersion}</span>
              {viewingVersion !== null && viewingVersion !== current.version && (
                <>
                  <Chip tone="warning">이전 버전 보기</Chip>
                  <button className="link-btn" onClick={() => { setViewingVersion(null); setViewingContent(''); }} type="button">최신으로</button>
                </>
              )}
              <span className="muted">· 업데이트 {current.updatedAt}</span>
            </div>
            <div className="wiki wiki-body">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          </>
        )}
      </Box>

      {showHistory && hasContent && (
        <Box title="버전 히스토리" action={<span className="muted mono">{history.length}개 버전</span>}>
          {history.length === 0 ? (
            <div className="empty-inline">히스토리를 불러오는 중…</div>
          ) : (
            <div className="timeline">
              {history.map((h) => {
                const isCurrent = h.version === current?.version;
                const isViewing = h.version === viewingVersion || (viewingVersion === null && isCurrent);
                return (
                  <div key={h.version} className={`tl-entry ${isViewing ? 'current' : ''}`}>
                    <div className="tl-head">
                      <span className="tl-ver">v{h.version}</span>
                      <span className="tl-time">{h.updatedAt}</span>
                      {isCurrent && <span className="tl-provider">latest</span>}
                    </div>
                    <div className="tl-diff">
                      {h.diffFromPrev.added.length > 0 && <><span className="add">+{h.diffFromPrev.added.length}</span> 섹션 </>}
                      {h.diffFromPrev.removed.length > 0 && <>· <span className="rm">−{h.diffFromPrev.removed.length}</span> </>}
                      — {h.diffFromPrev.summary} · {h.chars.toLocaleString('ko-KR')}자
                    </div>
                    {!isCurrent && (
                      <button className="link-btn" onClick={() => loadVersion(h.version)} type="button">
                        {h.version === viewingVersion ? '보는 중' : '이 버전 보기'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Box>
      )}
    </>
  );
}

function CatalogPanel() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const runCatalog = async () => {
    setScanning(true); setErr(null);
    try {
      const res = await apiPost<CatalogResponse>('/hermes/catalog', {});
      setCatalog(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '카탈로그 스캔 실패');
    } finally {
      setScanning(false);
    }
  };

  return (
    <Box
      title="자산 카탈로그"
      action={<Btn variant="secondary" size="sm" icon="folder" onClick={runCatalog} disabled={scanning}>{scanning ? '스캔 중…' : '스캔'}</Btn>}
    >
      <div className="text-dim" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
        활성 프로젝트의 <code className="code-inline">.md</code> 자산을 재귀 스캔해 기획자/개발자/사용자 관점으로 분류합니다. LLM 호출 없이 로컬 파일만 읽습니다.
      </div>
      {err && <div className="alert alert-danger" style={{ marginTop: 8 }}>{err}</div>}
      {catalog && (
        <div style={{ marginTop: 10 }}>
          <div className="kv-list">
            <div className="kv"><span className="k">프로젝트</span><span className="v">{catalog.project}</span></div>
            <div className="kv"><span className="k">총 자산</span><span className="v">{catalog.summary.total}개 · {fmtBytes(catalog.summary.totalBytes)}</span></div>
            {(['planner', 'developer', 'user'] as Persp[]).map((p) => (
              <div className="kv" key={p}>
                <span className="k">{PERSPECTIVE_LABEL[p]}</span>
                <span className="v">{catalog.summary.byPerspective[p] ?? 0}개</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Box>
  );
}
