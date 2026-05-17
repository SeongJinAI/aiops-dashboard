import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../constants/colors';
import { ENV_LABELS, detectEnv, envCommands, type Env } from '../constants/onboarding';
import { CodeBlock, EnvSelector } from '../components/onboarding/Snippets';
import { apiPost } from '../hooks/useApi';
import { getToken } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

interface OnboardingWizardProps {
  apiKey: string | null;
  tenantId: string;
  apiBase: string;
  onClose: () => void;
  onComplete: () => void;
  onRegenerate?: () => Promise<string>;
}

interface RegisteredRepo {
  path: string;
  name: string;
}

const TOTAL_STEPS = 5;
const STEP_LABELS = ['환경', 'API 키', 'env 패치', '레포 + Hook', '연결 확인'];

export function OnboardingWizard({
  apiKey: initialApiKey,
  tenantId,
  apiBase,
  onClose,
  onComplete,
  onRegenerate,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [env, setEnv] = useState<Env | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);
  const [regenerating, setRegenerating] = useState(false);
  const [repos, setRepos] = useState<RegisteredRepo[]>([]);
  const [newRepoInput, setNewRepoInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [detected, setDetected] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // 환경 자동 감지 (한 번만)
  useEffect(() => {
    if (!env) setEnv(detectEnv());
  }, [env]);

  // Step 5: 폴링 + 경과 타이머
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step !== 5 || detected) {
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const start = Date.now();
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      try {
        const token = getToken();
        const res = await fetch('/api/repos/hooks?limit=1', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr.length > 0) {
            setDetected(true);
            return;
          }
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) {
        pollingRef.current = setTimeout(poll, 30_000);
      }
    };
    poll();

    timerRef.current = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 1000);

    return () => {
      cancelled = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, detected]);

  // WebSocket: 첫 hooks 메시지 도착 시 detected=true
  const wsHandler = useCallback(() => {
    if (step === 5 && !detected) setDetected(true);
  }, [step, detected]);
  useWebSocket({ hooks: wsHandler });

  const commands = useMemo(
    () => (env ? envCommands(env, apiBase, apiKey ?? '<API 키 필요>', tenantId) : null),
    [env, apiBase, apiKey, tenantId],
  );

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    try {
      const fresh = await onRegenerate();
      setApiKey(fresh);
    } finally {
      setRegenerating(false);
    }
  };

  const addRepo = async () => {
    const path = newRepoInput.trim();
    if (!path) return;
    setAdding(true);
    setRegisterError(null);
    try {
      const name = path.split(/[\\/]/).filter(Boolean).pop() || 'my-project';
      await apiPost('/projects/swap', { name, repoPath: path, gitUrl: '' });
      setRepos((prev) => [...prev, { path, name }]);
      setNewRepoInput('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '등록 실패';
      // 중복(409 등) 처리 — message가 HTTP 409면 그대로 추가
      if (msg.includes('409')) {
        const name = path.split(/[\\/]/).filter(Boolean).pop() || 'my-project';
        setRepos((prev) => [...prev, { path, name }]);
        setNewRepoInput('');
      } else {
        setRegisterError(`레포 등록 실패: ${msg}. 경로를 확인하고 다시 시도해주세요.`);
      }
    } finally {
      setAdding(false);
    }
  };

  const removeRepo = (idx: number) => {
    setRepos((prev) => prev.filter((_, i) => i !== idx));
  };

  const canGoNext = (): boolean => {
    if (step === 1) return env !== null;
    if (step === 2) return apiKey !== null;
    return true;
  };

  const isLastStep = step === TOTAL_STEPS;
  const skipAvailable = step === 4 && repos.length === 0;

  const goNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setStep((prev) => (prev + 1) as typeof step);
  };

  const goPrev = () => {
    if (step === 1) return;
    setStep((prev) => (prev - 1) as typeof step);
  };

  const inputPlaceholder =
    env === 'windows' ? 'C:\\Users\\me\\my-project' : '/Users/me/my-project (터미널에서 pwd 결과)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          width: 640,
          maxWidth: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>온보딩 위저드</div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
              5분 안에 본인 작업이 대시보드에 흐르도록 설정합니다.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.dim,
              fontSize: 20,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 단계 인디케이터 */}
        <div
          style={{
            padding: '14px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderBottom: `1px solid ${C.border}`,
            background: C.bg,
          }}
        >
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => {
            const done = n < step;
            const current = n === step;
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: done ? C.green : current ? C.accent : C.surfaceAlt,
                    color: done || current ? '#fff' : C.dim,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {done ? '✓' : n}
                </div>
                <div
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    fontSize: 11,
                    color: current ? C.text : C.dim,
                    fontWeight: current ? 600 : 400,
                  }}
                >
                  {STEP_LABELS[n - 1]}
                </div>
                {n < TOTAL_STEPS && (
                  <div
                    style={{
                      width: 8,
                      height: 1,
                      background: done ? C.green : C.border,
                      marginRight: 4,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* 본문 */}
        <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
          {step === 1 && (
            <StepBody title="사용 환경을 선택하세요">
              <p style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
                다음 단계의 설치 명령어가 이 선택에 따라 달라집니다. 자동 감지된 기본값이 맞으면
                그대로 두세요.
              </p>
              <EnvSelector value={env} onChange={setEnv} />
              {env && (
                <p style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
                  현재 선택: <strong style={{ color: C.text }}>{ENV_LABELS[env]}</strong>
                </p>
              )}
            </StepBody>
          )}

          {step === 2 && (
            <StepBody title="API 키">
              {apiKey ? (
                <>
                  <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
                    Hook이 대시보드로 로그를 보낼 때 사용합니다.{' '}
                    <strong style={{ color: C.orange }}>지금 한 번만 표시되며</strong>, 페이지를
                    떠나면 다시 볼 수 없습니다. 안전한 곳에 복사해두세요.
                  </p>
                  <div
                    style={{
                      background: '#fffbeb',
                      border: `1px solid ${C.orange}`,
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <CodeBlock code={apiKey} />
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
                    저장된 평문 API 키가 없습니다. 재발급하면 이전 키는 즉시 무효화됩니다.
                  </p>
                  <button
                    onClick={handleRegenerate}
                    disabled={regenerating || !onRegenerate}
                    style={{
                      background: C.accent,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '10px 18px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: regenerating ? 'wait' : 'pointer',
                      opacity: regenerating ? 0.6 : 1,
                    }}
                  >
                    {regenerating ? '재발급 중...' : 'API 키 재발급'}
                  </button>
                </>
              )}
            </StepBody>
          )}

          {step === 3 && commands && (
            <StepBody title="환경변수 파일에 추가">
              <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
                아래 명령어를 복사해서{' '}
                <strong style={{ color: C.text }}>
                  {env === 'windows' ? 'PowerShell' : '터미널'}
                </strong>
                에서 <strong style={{ color: C.text }}>한 번</strong> 실행하세요.{' '}
                <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3 }}>
                  ~/.claude/.env
                </code>{' '}
                파일에 3줄이 추가됩니다.
              </p>
              <CodeBlock code={commands.envPatch} />
              <p style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
                실행 결과를 위저드가 자동 검증하지는 않습니다. 명령어 한 번 실행 후 다음 단계로
                넘어가세요.
              </p>
            </StepBody>
          )}

          {step === 4 && commands && (
            <StepBody title="레포 등록 + Hook 설치">
              <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
                추적할 레포 경로를 입력하세요. 여러 개 등록 가능합니다. 각 레포의 데이터는{' '}
                <code style={{ background: C.surfaceAlt, padding: '1px 5px', borderRadius: 3 }}>
                  repo
                </code>{' '}
                필드로 자동 분리됩니다.
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={newRepoInput}
                  onChange={(e) => setNewRepoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addRepo();
                  }}
                  placeholder={inputPlaceholder}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: 13,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    background: C.surface,
                    color: C.text,
                    fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={addRepo}
                  disabled={adding || !newRepoInput.trim()}
                  style={{
                    background: C.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: adding ? 'wait' : 'pointer',
                    opacity: adding || !newRepoInput.trim() ? 0.6 : 1,
                  }}
                >
                  {adding ? '등록 중...' : '+ 추가'}
                </button>
              </div>

              {registerError && (
                <div
                  style={{
                    background: '#fff5f5',
                    border: `1px solid ${C.red}`,
                    borderRadius: 6,
                    padding: '10px 12px',
                    fontSize: 12,
                    color: C.red,
                    marginBottom: 12,
                  }}
                >
                  {registerError}
                </div>
              )}

              {repos.length > 0 ? (
                <div style={{ marginBottom: 16 }}>
                  {repos.map((r, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: C.bg,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        marginBottom: 6,
                        fontSize: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: i === repos.length - 1 ? C.green : C.dim,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ color: C.text, fontWeight: 500 }}>{r.name}</div>
                        <div style={{ color: C.dim, fontFamily: 'monospace', fontSize: 11 }}>
                          {r.path}
                        </div>
                      </div>
                      <button
                        onClick={() => removeRepo(i)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: C.dim,
                          fontSize: 16,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                        aria-label="제거"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>
                    마지막 등록한 레포가 활성 상태로 설정됩니다.
                  </p>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.dim, marginBottom: 16, fontStyle: 'italic' }}>
                  아직 등록된 레포 없음. 건너뛰어도 됩니다 (나중에 "연결 설정" 탭에서 추가 가능).
                </div>
              )}

              <div style={{ marginTop: 12, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  Hook 설치 명령어
                </div>
                <p style={{ fontSize: 12, color: C.dim, marginBottom: 10, lineHeight: 1.6 }}>
                  각 레포 디렉토리에서 아래 명령어를 한 번씩 실행하세요. Hook 스크립트와 설정이
                  자동으로 깔립니다.
                </p>
                <CodeBlock code={commands.installHook} />
              </div>
            </StepBody>
          )}

          {step === 5 && (
            <StepBody title="연결 확인">
              {detected ? (
                <div
                  style={{
                    background: '#f0fdf4',
                    border: `1px solid ${C.green}`,
                    borderRadius: 8,
                    padding: 20,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.green, marginBottom: 4 }}>
                    연결 완료
                  </div>
                  <div style={{ fontSize: 12, color: C.dim }}>
                    첫 Hook 데이터가 도착했습니다. 이제 대시보드에서 본인의 활동을 추적하세요.
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: C.dim, marginBottom: 16, lineHeight: 1.6 }}>
                    방금 등록한 레포에서 Claude Code를 한 번 사용해보세요. 첫 Hook 데이터가
                    도착하면 자동으로 감지합니다.
                  </p>
                  <div
                    style={{
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: 20,
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        border: `3px solid ${C.border}`,
                        borderTopColor: C.accent,
                        margin: '0 auto 12px',
                        animation: 'spin 1s linear infinite',
                      }}
                    />
                    <div style={{ fontSize: 13, color: C.text, marginBottom: 4 }}>
                      Hook 데이터 대기 중...
                    </div>
                    <div style={{ fontSize: 11, color: C.dim }}>경과: {elapsedSec}초</div>
                  </div>
                  {elapsedSec >= 300 && (
                    <div
                      style={{
                        marginTop: 16,
                        background: '#fff5f5',
                        border: `1px solid ${C.red}`,
                        borderRadius: 8,
                        padding: 14,
                        fontSize: 12,
                        color: C.red,
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>5분이 지났습니다.</strong> 다음을 확인해보세요:
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>Step 3의 명령어를 실제로 터미널에서 실행했나요?</li>
                        <li>Step 4의 Hook 설치 명령어를 본인 레포 디렉토리에서 실행했나요?</li>
                        <li>
                          <code>~/.claude/.env</code>에 3개 변수가 모두 들어있나요?
                        </li>
                        <li>해당 레포에서 Claude Code를 새로 열고 한 번 사용해보셨나요?</li>
                      </ul>
                    </div>
                  )}
                </>
              )}
              <style>{`@keyframes spin { 0% { transform: rotate(0); } 100% { transform: rotate(360deg); } }`}</style>
            </StepBody>
          )}
        </div>

        {/* 푸터 (네비게이션) */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: `1px solid ${C.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: C.bg,
          }}
        >
          <button
            onClick={goPrev}
            disabled={step === 1}
            style={{
              background: 'transparent',
              border: `1px solid ${C.border}`,
              color: step === 1 ? C.dim : C.text,
              borderRadius: 6,
              padding: '8px 14px',
              fontSize: 13,
              cursor: step === 1 ? 'default' : 'pointer',
              opacity: step === 1 ? 0.5 : 1,
            }}
          >
            ← 이전
          </button>

          <div style={{ display: 'flex', gap: 8 }}>
            {skipAvailable && (
              <button
                onClick={() => setStep(5)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.dim,
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                건너뛰기
              </button>
            )}
            <button
              onClick={goNext}
              disabled={!canGoNext()}
              style={{
                background: canGoNext() ? C.accent : C.surfaceAlt,
                color: canGoNext() ? '#fff' : C.dim,
                border: 'none',
                borderRadius: 6,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: canGoNext() ? 'pointer' : 'not-allowed',
              }}
            >
              {isLastStep ? '대시보드로 이동' : '다음 →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepBody({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}
