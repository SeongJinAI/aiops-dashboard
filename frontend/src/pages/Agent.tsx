import { useCallback, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { C } from '../constants/colors';
import { apiPost, useApi } from '../hooks/useApi';
import { getToken } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

interface AssetEntry {
  path: string;
  perspective: 'planner' | 'developer' | 'user';
  size_bytes: number;
  preview: string;
  bucket: string;
}

interface CatalogResponse {
  project: string;
  repoPath: string;
  summary: {
    total: number;
    totalBytes: number;
    byPerspective: Record<string, number>;
    byBucket: Record<string, number>;
  };
  assets: {
    planner: AssetEntry[];
    developer: AssetEntry[];
    user: AssetEntry[];
  };
}

interface WikiLatest {
  project: string;
  perspectives: Record<string, { content: string; version: number; updatedAt: string }>;
  version: number;
  updatedAt: string | null;
}

interface RunStatus {
  id: number;
  status: 'running' | 'success' | 'partial_success' | 'failed';
  started_at?: string;
  finished_at?: string;
  input_count?: number;
  output_chars?: number;
  error?: string;
  diff_summary?: string;
  // 실시간 진행 (WebSocket으로 갱신)
  stage?: string;
  message?: string;
  progress?: number;
  provider?: string;
}

interface SecretStatusEntry {
  kind: 'anthropic' | 'openai' | 'gemini';
  has_key: boolean;
  preview: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic Claude',
  openai: 'OpenAI GPT',
  gemini: 'Google Gemini',
};

const PERSPECTIVE_LABEL: Record<string, string> = {
  planner: '기획자',
  developer: '개발자',
  user: '사용자',
};

const PERSPECTIVE_COLOR: Record<string, string> = {
  planner: C.purple,
  developer: C.accent,
  user: C.green,
};

export function Agent() {
  const [tab, setTab] = useState<'wiki' | 'catalog'>('wiki');
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 최신 위키 조회
  const { data: wiki, refetch: refetchWiki } = useApi<WikiLatest>(
    '/hermes/wiki/latest',
    { project: '', perspectives: {}, version: 0, updatedAt: null },
  );

  // 등록된 provider 키 상태 (드롭다운 채우기)
  const { data: secretStatus } = useApi<SecretStatusEntry[]>('/secrets', []);
  const registeredProviders = secretStatus.filter((s) => s.has_key).map((s) => s.kind);
  const [selectedProvider, setSelectedProvider] = useState<string>('anthropic');

  // 등록된 첫 provider를 기본 선택
  useEffect(() => {
    if (registeredProviders.length === 0) return;
    if (!registeredProviders.includes(selectedProvider as 'anthropic')) {
      setSelectedProvider(registeredProviders[0]);
    }
  }, [registeredProviders.join(',')]);

  // run 폴링 상태
  const [activeRun, setActiveRun] = useState<RunStatus | null>(null);

  const runCatalog = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await apiPost<CatalogResponse>('/hermes/catalog', {});
      setCatalog(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : '카탈로그 스캔 실패');
    } finally {
      setScanning(false);
    }
  };

  const triggerUpdate = async () => {
    setError(null);
    if (registeredProviders.length === 0) {
      setError('AI 프로바이더 키가 하나도 등록되지 않았습니다. "연결 설정" 탭에서 Anthropic/OpenAI/Gemini 중 하나를 등록하세요.');
      return;
    }
    try {
      const res = await apiPost<{ run_id: number; status: string; provider: string }>(
        '/hermes/wiki/update',
        { provider: selectedProvider },
      );
      setActiveRun({ id: res.run_id, status: 'running', provider: res.provider });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hermes 업데이트 실패');
    }
  };

  // WebSocket: 실시간 진행 push
  const progressHandler = useCallback((data: Record<string, unknown>) => {
    setActiveRun((prev) => {
      if (!prev || prev.id !== (data.run_id as number)) return prev;
      return {
        ...prev,
        stage: data.stage as string,
        message: data.message as string,
        progress: data.progress as number,
      };
    });
    // complete/failed 시 최종 상태 재조회
    if (data.stage === 'complete' || data.stage === 'failed') {
      refetchWiki();
    }
  }, [refetchWiki]);
  useWebSocket({ hermes_progress: progressHandler });

  // run 폴링 (WebSocket 보조 — 최종 상태 확정용, 5초 간격)
  useEffect(() => {
    if (!activeRun || (activeRun.status !== 'running')) return;
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
          setActiveRun((prev) => prev ? { ...prev, ...data } : data);
          if (data.status === 'success' || data.status === 'partial_success') {
            refetchWiki();
            return;
          }
          if (data.status === 'failed') return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setTimeout(poll, 5000);
    };
    const t = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [activeRun, refetchWiki]);

  const fmtBytes = (n: number) => (n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--s-sm, 8px)' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>에이전트 (Hermes)</h2>
        <span style={{ fontSize: 11, color: C.dim }}>
          프로젝트별 위키 자동 생성기
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 'var(--s-sm, 8px)' }}>
        {[
          { k: 'wiki', label: '위키' },
          { k: 'catalog', label: '자산 카탈로그' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k as 'wiki' | 'catalog')}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              background: 'transparent',
              color: tab === t.k ? C.accent : C.dim,
              border: 'none',
              borderBottom: `2px solid ${tab === t.k ? C.accent : 'transparent'}`,
              fontWeight: tab === t.k ? 600 : 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          marginBottom: 16, background: '#fff5f5', border: `1px solid ${C.red}`,
          borderRadius: 6, padding: '10px 12px', fontSize: 12, color: C.red,
        }}>
          {error}
        </div>
      )}

      {tab === 'wiki' && (
        <WikiPanel
          wiki={wiki}
          activeRun={activeRun}
          onUpdate={triggerUpdate}
          registeredProviders={registeredProviders}
          selectedProvider={selectedProvider}
          onSelectProvider={setSelectedProvider}
        />
      )}

      {tab === 'catalog' && (
        <CatalogPanel
          catalog={catalog}
          scanning={scanning}
          onScan={runCatalog}
          fmtBytes={fmtBytes}
        />
      )}
    </div>
  );
}

interface VersionEntry {
  version: number;
  updatedAt: string;
  chars: number;
  diffFromPrev: {
    summary: string;
    added: string[];
    removed: string[];
    char_delta: number;
  };
}

function WikiPanel({
  wiki,
  activeRun,
  onUpdate,
  registeredProviders,
  selectedProvider,
  onSelectProvider,
}: {
  wiki: WikiLatest;
  activeRun: RunStatus | null;
  onUpdate: () => void;
  registeredProviders: string[];
  selectedProvider: string;
  onSelectProvider: (p: string) => void;
}) {
  const [selectedPersp, setSelectedPersp] = useState<'planner' | 'developer' | 'user'>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<VersionEntry[]>([]);
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);
  const [viewingContent, setViewingContent] = useState<string>('');
  const hasContent = wiki.version > 0;
  const isRunning = activeRun?.status === 'running';

  const current = wiki.perspectives[selectedPersp];

  // 버전 히스토리 로드
  useEffect(() => {
    if (!showHistory || !hasContent) return;
    const token = getToken();
    fetch(`/api/hermes/wiki/versions?perspective=${selectedPersp}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok ? r.json() : [])
      .then((data: VersionEntry[]) => setHistory(data))
      .catch(() => setHistory([]));
  }, [showHistory, selectedPersp, hasContent, wiki.version]);

  // perspective 바뀌면 특정 버전 보기 초기화
  useEffect(() => {
    setViewingVersion(null);
    setViewingContent('');
  }, [selectedPersp]);

  const loadVersion = async (version: number) => {
    const token = getToken();
    const res = await fetch(
      `/api/hermes/wiki/version?perspective=${selectedPersp}&version=${version}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    );
    if (res.ok) {
      const data = await res.json();
      setViewingVersion(version);
      setViewingContent(data.content);
    }
  };

  const displayedContent = viewingVersion !== null ? viewingContent : (current?.content || '');
  const displayedVersion = viewingVersion !== null ? viewingVersion : current?.version;

  return (
    <div>
      <Section title="프로젝트 위키" color={PERSPECTIVE_COLOR[selectedPersp]}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['planner', 'developer', 'user'] as const).map((p) => {
              const has = wiki.perspectives[p];
              return (
                <button
                  key={p}
                  onClick={() => setSelectedPersp(p)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: selectedPersp === p ? PERSPECTIVE_COLOR[p] : C.surface,
                    color: selectedPersp === p ? '#fff' : C.text,
                    border: `1px solid ${selectedPersp === p ? PERSPECTIVE_COLOR[p] : C.border}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontWeight: selectedPersp === p ? 600 : 400,
                  }}
                >
                  {PERSPECTIVE_LABEL[p]}
                  {has && (
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>
                      v{has.version}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {hasContent && (
              <button
                onClick={() => setShowHistory((v) => !v)}
                style={{
                  background: showHistory ? C.surfaceAlt : 'transparent',
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '8px 12px',
                  fontSize: 12,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {showHistory ? '히스토리 닫기' : '버전 히스토리'}
              </button>
            )}

            {registeredProviders.length > 0 ? (
              <select
                value={selectedProvider}
                onChange={(e) => onSelectProvider(e.target.value)}
                disabled={isRunning}
                style={{
                  background: C.surface,
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '8px 10px',
                  fontSize: 12,
                  fontFamily: 'inherit',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                }}
                title="위키 생성에 사용할 AI 프로바이더"
              >
                {registeredProviders.map((p) => (
                  <option key={p} value={p}>
                    {PROVIDER_LABELS[p] || p}
                  </option>
                ))}
              </select>
            ) : (
              <span style={{
                fontSize: 11, color: C.orange,
                padding: '8px 10px',
                background: '#fffbeb',
                border: `1px solid ${C.orange}`,
                borderRadius: 6,
              }}>
                연결 설정에서 키 등록 필요
              </span>
            )}

            <button onClick={onUpdate} disabled={isRunning || registeredProviders.length === 0} style={btnPrimary(isRunning || registeredProviders.length === 0)}>
              {isRunning ? '진행 중...' : (hasContent ? 'Hermes 다시 업데이트' : 'Hermes 업데이트')}
            </button>
          </div>
        </div>

        {activeRun && (
          <RunStatusBox run={activeRun} />
        )}

        {showHistory && hasContent && (
          <HistoryList
            history={history}
            currentVersion={current?.version ?? 0}
            viewingVersion={viewingVersion}
            onSelect={(v) => {
              if (v === current?.version) {
                setViewingVersion(null);
                setViewingContent('');
              } else {
                loadVersion(v);
              }
            }}
          />
        )}

        {!hasContent && !isRunning && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📖</div>
            <div style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 8 }}>
              아직 생성된 위키가 없습니다
            </div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6, maxWidth: 420, margin: '0 auto' }}>
              <strong>[Hermes 업데이트]</strong> 버튼을 누르면 활성 프로젝트의 마크다운 자산을 모두 분석해
              <br />
              기획자/개발자/사용자 3-perspective 위키 챕터를 자동 생성합니다.
              <br /><br />
              <span style={{ fontSize: 11 }}>
                ※ Claude API 키가 필요합니다 (<code style={codeInline}>~/.claude/.env</code>의 <code style={codeInline}>ANTHROPIC_API_KEY</code>)
              </span>
            </div>
          </div>
        )}

        {current && (
          <div style={{ marginTop: 12 }}>
            <div style={{
              fontSize: 11, color: C.dim, marginBottom: 12,
              display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
            }}>
              <span>버전 {displayedVersion ?? current.version}</span>
              {viewingVersion !== null && viewingVersion !== current.version && (
                <span style={{
                  background: C.orange, color: '#fff',
                  padding: '1px 6px', borderRadius: 3, fontSize: 10,
                }}>이전 버전 보기</span>
              )}
              <span>·</span>
              <span>업데이트: {current.updatedAt}</span>
              {viewingVersion !== null && viewingVersion !== current.version && (
                <button
                  onClick={() => { setViewingVersion(null); setViewingContent(''); }}
                  style={{
                    background: 'transparent', border: 'none',
                    color: C.accent, fontSize: 11, cursor: 'pointer',
                    padding: 0, textDecoration: 'underline',
                  }}
                >
                  최신 버전으로 돌아가기
                </button>
              )}
            </div>
            <div style={markdownStyle}>
              <ReactMarkdown>{displayedContent}</ReactMarkdown>
            </div>
          </div>
        )}

        {hasContent && !current && (
          <div style={{ fontSize: 13, color: C.dim, padding: 20, textAlign: 'center' }}>
            이 perspective에는 생성된 위키가 아직 없습니다. 업데이트를 다시 실행하세요.
          </div>
        )}
      </Section>
    </div>
  );
}

function HistoryList({
  history,
  currentVersion,
  viewingVersion,
  onSelect,
}: {
  history: VersionEntry[];
  currentVersion: number;
  viewingVersion: number | null;
  onSelect: (version: number) => void;
}) {
  if (history.length === 0) {
    return (
      <div style={{
        background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
        padding: 16, marginBottom: 12, fontSize: 12, color: C.dim, textAlign: 'center',
      }}>
        히스토리를 불러오는 중...
      </div>
    );
  }
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
      marginBottom: 12, overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 14px', fontSize: 11, color: C.dim,
        borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt,
      }}>
        버전 히스토리 — 총 {history.length}개 (최신 v{currentVersion})
      </div>
      {history.map((h) => {
        const isLatest = h.version === currentVersion;
        const isViewing = h.version === viewingVersion || (viewingVersion === null && isLatest);
        return (
          <button
            key={h.version}
            onClick={() => onSelect(h.version)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', width: '100%', textAlign: 'left',
              background: isViewing ? C.surfaceAlt : 'transparent',
              border: 'none', borderBottom: `1px solid ${C.border}`,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
              color: C.text,
            }}
          >
            <span style={{
              background: isLatest ? C.green : C.border, color: '#fff',
              padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
              minWidth: 32, textAlign: 'center',
            }}>
              v{h.version}
            </span>
            <span style={{ flex: 1 }}>
              <div style={{ color: C.text, marginBottom: 2 }}>
                {h.diffFromPrev.summary}
              </div>
              <div style={{ fontSize: 11, color: C.dim }}>
                {h.updatedAt} · {h.chars.toLocaleString()}자
                {h.diffFromPrev.added.length > 0 && (
                  <span style={{ color: C.green, marginLeft: 8 }}>
                    +{h.diffFromPrev.added.length} 섹션
                  </span>
                )}
                {h.diffFromPrev.removed.length > 0 && (
                  <span style={{ color: C.red, marginLeft: 8 }}>
                    -{h.diffFromPrev.removed.length} 섹션
                  </span>
                )}
              </div>
            </span>
            {isViewing && (
              <span style={{ color: C.accent, fontSize: 11, fontWeight: 600 }}>보는 중</span>
            )}
          </button>
        );
      })}
    </div>
  );
}


function RunStatusBox({ run }: { run: RunStatus }) {
  const isRunning = run.status === 'running';
  const isOK = run.status === 'success' || run.status === 'partial_success';
  const isFail = run.status === 'failed';

  const bg = isOK ? '#f0fdf4' : isFail ? '#fff5f5' : C.surfaceAlt;
  const border = isOK ? (run.status === 'partial_success' ? C.orange : C.green) : isFail ? C.red : C.border;
  const icon = run.status === 'success' ? '✓'
    : run.status === 'partial_success' ? '⚠'
      : run.status === 'failed' ? '✗' : '⏳';

  const headlineText = run.status === 'success'
    ? `완료 — ${run.diff_summary || ''}`
    : run.status === 'partial_success'
      ? `부분 완료 — ${run.diff_summary || ''}`
      : run.status === 'failed'
        ? `실패 — ${run.error || '알 수 없는 오류'}`
        : (run.message || 'Hermes가 자산을 분석하고 위키를 작성하는 중입니다... (보통 30~90초 소요)');

  const progress = run.progress ?? 0;

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 8,
      padding: '12px 14px', marginBottom: 12, color: C.text,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ flex: 1 }}>{headlineText}</span>
        {run.input_count !== undefined && run.input_count > 0 && (
          <span style={{ color: C.dim, fontSize: 11 }}>
            {run.input_count}개 자산, {run.output_chars ?? 0}자
          </span>
        )}
      </div>

      {isRunning && (
        <div style={{ marginTop: 10 }}>
          <div style={{
            height: 6, background: C.border, borderRadius: 3, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.max(2, Math.min(100, progress))}%`,
              background: C.accent,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            marginTop: 4, fontSize: 11, color: C.dim,
          }}>
            <span>{run.stage ? `단계: ${run.stage}` : '시작 중...'}</span>
            <span>{progress}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CatalogPanel({
  catalog,
  scanning,
  onScan,
  fmtBytes,
}: {
  catalog: CatalogResponse | null;
  scanning: boolean;
  onScan: () => void;
  fmtBytes: (n: number) => string;
}) {
  return (
    <div>
      <Section title="활성 프로젝트 스캔">
        <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
          활성 프로젝트의 <code style={codeInline}>repoPath</code> 아래에서 마크다운 자산(.md)을
          재귀 스캔하여 <strong>기획자/개발자/사용자</strong> 3가지 관점으로 분류합니다.
          LLM 호출 없이 로컬 파일만 읽습니다.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={onScan} disabled={scanning} style={btnPrimary(scanning)}>
            {scanning ? '스캔 중...' : '자산 카탈로그 스캔'}
          </button>
          {catalog && (
            <span style={{ fontSize: 12, color: C.dim }}>
              {catalog.project} · {catalog.repoPath}
            </span>
          )}
        </div>
      </Section>

      {catalog && (
        <>
          <Section title="요약">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Stat label="총 자산" value={catalog.summary.total} />
              <Stat label="총 크기" value={fmtBytes(catalog.summary.totalBytes)} />
              {Object.entries(catalog.summary.byPerspective).map(([k, v]) => (
                <Stat key={k} label={PERSPECTIVE_LABEL[k] || k} value={v} color={PERSPECTIVE_COLOR[k]} />
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, color: C.dim, marginBottom: 6 }}>버킷별 분포</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {Object.entries(catalog.summary.byBucket).map(([k, v]) => (
                  <span key={k} style={chipStyle}>
                    {k} <span style={{ color: C.dim }}>· {v}</span>
                  </span>
                ))}
              </div>
            </div>
          </Section>

          {(['planner', 'developer', 'user'] as const).map((p) => {
            const list = catalog.assets[p];
            if (!list.length) return null;
            return (
              <Section
                key={p}
                title={`${PERSPECTIVE_LABEL[p]} 챕터 (${list.length}개)`}
                color={PERSPECTIVE_COLOR[p]}
              >
                {list.slice(0, 50).map((a, i) => (
                  <div key={i} style={{
                    padding: '10px 12px',
                    borderBottom: i === Math.min(list.length, 50) - 1 ? 'none' : `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                      <code style={{ fontSize: 12, color: C.text, fontFamily: 'monospace' }}>{a.path}</code>
                      <span style={{ fontSize: 10, color: C.dim }}>
                        {a.bucket} · {fmtBytes(a.size_bytes)}
                      </span>
                    </div>
                  </div>
                ))}
                {list.length > 50 && (
                  <div style={{ padding: '10px 12px', fontSize: 11, color: C.dim, textAlign: 'center' }}>
                    + 추가 {list.length - 50}개 자산
                  </div>
                )}
              </Section>
            );
          })}
        </>
      )}

      {!catalog && !scanning && (
        <Section title="안내">
          <p style={{ fontSize: 13, color: C.dim, lineHeight: 1.6 }}>
            <strong>자산 카탈로그 스캔</strong>은 위키 업데이트 전에 어떤 자료가 입력될지 미리 보는 용도입니다.
            바로 위키만 생성하려면 위의 <strong>위키</strong> 탭에서 [Hermes 업데이트]를 누르세요.
          </p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, color }: { title: string; children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${color || C.border}`,
      borderRadius: 10, padding: 20, marginBottom: 16,
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: color || C.text }}>{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{
      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: '10px 14px', minWidth: 100,
    }}>
      <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || C.text }}>{value}</div>
    </div>
  );
}

const btnPrimary = (busy: boolean): React.CSSProperties => ({
  background: C.accent, color: '#fff', border: 'none', borderRadius: 6,
  padding: '8px 16px', fontSize: 13, fontWeight: 600,
  cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
});

const codeInline: React.CSSProperties = {
  background: C.surfaceAlt, padding: '1px 6px', borderRadius: 3,
  fontFamily: 'monospace', fontSize: 12,
};

const chipStyle: React.CSSProperties = {
  fontSize: 11, padding: '3px 8px', background: C.surfaceAlt,
  border: `1px solid ${C.border}`, borderRadius: 12, color: C.text,
  fontFamily: 'monospace',
};

const markdownStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.7,
  color: C.text,
};
