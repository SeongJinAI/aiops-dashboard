// 지식 챗 (RAG) — 프로젝트 지식 문서를 검색해 AI가 답하는 "작업 메모리".
// /chat/status · /chat/index · /chat/query. 검색은 키 없이 동작, 합성 답변은 관리형 AI(쿼터) 우선·BYOK 가능.
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useApi, apiPost } from '../hooks/useApi';
import { useToast } from '../ui/toast';
import { Icon } from '../ui/Icon';
import { Box, Btn, Chip, EmptyState } from '../ui/primitives';

interface Source { path: string; heading: string | null; snippet: string; score: number; }
interface QueryResult { answer: string | null; sources: Source[]; message?: string; provider?: string; }
interface Status { project: string | null; chunks: number; }

const DEFAULT_STATUS: Status = { project: null, chunks: 0 };

export function Chat() {
  const { data: status, refetch } = useApi<Status>('/chat/status', DEFAULT_STATUS);
  const { pushToast } = useToast();
  const [provider, setProvider] = useState('anthropic');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [asking, setAsking] = useState(false);
  const [indexing, setIndexing] = useState(false);

  const reindex = async () => {
    setIndexing(true);
    try {
      const res = await apiPost<{ chunks: number; assets: number }>('/chat/index', {});
      pushToast({ tone: 'success', title: `색인 완료 — ${res.chunks}개 청크 (자산 ${res.assets})` });
      refetch();
    } catch (e) {
      pushToast({ tone: 'danger', title: '색인 실패', desc: e instanceof Error ? e.message : '' });
    } finally { setIndexing(false); }
  };

  const ask = async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setResult(null);
    try {
      const res = await apiPost<QueryResult>('/chat/query', { question: q, provider });
      setResult(res);
    } catch (e) {
      pushToast({ tone: 'danger', title: '질의 실패', desc: e instanceof Error ? e.message : '' });
    } finally { setAsking(false); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title"><Icon name="search" size={18} />지식 챗</h1>
          <div className="page-sub">
            프로젝트 문서를 검색해 답합니다 · {status.project || '프로젝트 없음'} · 색인 {status.chunks}청크
          </div>
        </div>
        <div className="actions" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select className="input" value={provider} onChange={(e) => setProvider(e.target.value)} style={{ height: 30, fontSize: 11 }}>
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
          </select>
          <Btn variant="secondary" size="sm" icon={indexing ? 'loader' : 'refresh'} onClick={reindex} disabled={indexing}>
            {indexing ? '색인 중…' : '색인 갱신'}
          </Btn>
        </div>
      </div>

      {status.chunks === 0 ? (
        <EmptyState
          icon="search"
          title="아직 색인된 문서가 없습니다"
          desc="프로젝트의 .md 문서를 Nova가 수집하면(설치 시 자동 + skill로 생성), '색인 갱신'으로 검색 가능한 지식 베이스를 만듭니다. 그 뒤 질문하면 문서를 근거로 답합니다."
          primary={{ label: '지금 색인하기', icon: 'refresh', onClick: reindex }}
        />
      ) : (
        <>
          <Box title="질문">
            <div className="chat-ask">
              <textarea
                className="input chat-input"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(); }}
                placeholder="예: 로그인 인증 흐름이 어떻게 되나요? (⌘/Ctrl+Enter 전송)"
                rows={3}
              />
              <Btn variant="primary" icon={asking ? 'loader' : 'arrow-up-right'} onClick={ask} disabled={asking}>
                {asking ? '검색 중…' : '질문'}
              </Btn>
            </div>
          </Box>

          {result && (
            <Box title="답변" action={result.provider && <Chip tone="accent">{result.provider}</Chip>}>
              {result.answer ? (
                <div className="coach-brief"><ReactMarkdown>{result.answer}</ReactMarkdown></div>
              ) : (
                <div className="alert alert-info">{result.message || '답변을 생성하지 못했습니다.'}</div>
              )}
              {result.sources.length > 0 && (
                <div className="chat-sources">
                  <div className="chat-sources-h">출처 {result.sources.length}</div>
                  {result.sources.map((s, i) => (
                    <div className="chat-src" key={i}>
                      <div className="chat-src-head">
                        <span className="chat-src-no">[{i + 1}]</span>
                        <span className="chat-src-path mono">{s.path}{s.heading ? ` · ${s.heading}` : ''}</span>
                        <span className="chat-src-score mono">{s.score}</span>
                      </div>
                      <div className="chat-src-snip">{s.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </Box>
          )}
        </>
      )}
    </>
  );
}
