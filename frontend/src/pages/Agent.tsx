import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { C } from '../constants/colors';
import { apiPost, useApi } from '../hooks/useApi';
import { getToken } from '../hooks/useAuth';

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
  status: 'running' | 'success' | 'failed';
  started_at?: string;
  finished_at?: string;
  input_count?: number;
  output_chars?: number;
  error?: string;
  diff_summary?: string;
}

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
    try {
      const res = await apiPost<{ run_id: number; status: string }>('/hermes/wiki/update', {});
      setActiveRun({ id: res.run_id, status: 'running' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hermes 업데이트 실패');
    }
  };

  // run 폴링 (running 상태에서 3초 간격)
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
          setActiveRun(data);
          if (data.status === 'success') {
            refetchWiki();
            return;
          }
          if (data.status === 'failed') return;
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setTimeout(poll, 3000);
    };
    const t = setTimeout(poll, 3000);
    return () => { cancelled = true; clearTimeout(t); };
  }, [activeRun, refetchWiki]);

  const fmtBytes = (n: number) => (n < 1024 ? `${n}B` : `${(n / 1024).toFixed(1)}KB`);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text }}>에이전트 (Hermes)</h2>
        <span style={{ fontSize: 11, color: C.dim }}>
          프로젝트별 위키 자동 생성기
        </span>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
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

function WikiPanel({
  wiki,
  activeRun,
  onUpdate,
}: {
  wiki: WikiLatest;
  activeRun: RunStatus | null;
  onUpdate: () => void;
}) {
  const [selectedPersp, setSelectedPersp] = useState<'planner' | 'developer' | 'user'>('planner');
  const hasContent = wiki.version > 0;
  const isRunning = activeRun?.status === 'running';

  const current = wiki.perspectives[selectedPersp];

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
          <button onClick={onUpdate} disabled={isRunning} style={btnPrimary(isRunning)}>
            {isRunning ? '진행 중...' : (hasContent ? 'Hermes 다시 업데이트' : 'Hermes 업데이트')}
          </button>
        </div>

        {activeRun && (
          <RunStatusBox run={activeRun} />
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
              <span>버전 {current.version}</span>
              <span>·</span>
              <span>업데이트: {current.updatedAt}</span>
            </div>
            <div style={markdownStyle}>
              <ReactMarkdown>{current.content}</ReactMarkdown>
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

function RunStatusBox({ run }: { run: RunStatus }) {
  const bg = run.status === 'success' ? '#f0fdf4' : run.status === 'failed' ? '#fff5f5' : C.surfaceAlt;
  const border = run.status === 'success' ? C.green : run.status === 'failed' ? C.red : C.border;
  const icon = run.status === 'success' ? '✓' : run.status === 'failed' ? '✗' : '⏳';
  const text = run.status === 'success'
    ? `완료 — ${run.diff_summary || ''}`
    : run.status === 'failed'
      ? `실패 — ${run.error || '알 수 없는 오류'}`
      : 'Hermes가 자산을 분석하고 위키를 작성하는 중입니다... (보통 30~90초 소요)';

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 6,
      padding: '10px 14px', marginBottom: 12, fontSize: 12, color: C.text,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1 }}>{text}</span>
      {run.input_count !== undefined && run.input_count > 0 && (
        <span style={{ color: C.dim, fontSize: 11 }}>
          {run.input_count}개 자산, {run.output_chars ?? 0}자
        </span>
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
