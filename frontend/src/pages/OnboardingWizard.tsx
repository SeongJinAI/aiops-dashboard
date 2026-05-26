import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { C } from '../constants/colors';
import { ENV_LABELS, detectEnv, envCommands, type Env } from '../constants/onboarding';
import { CodeBlock, EnvSelector } from '../components/onboarding/Snippets';
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

const TOTAL_STEPS = 4;
const STEP_LABELS = ['환경', 'API 키', '원클릭 설치', '연결 확인'];

export function OnboardingWizard({
  apiKey: initialApiKey,
  tenantId,
  apiBase,
  onClose,
  onComplete,
  onRegenerate,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<number>(1);
  const [env, setEnv] = useState<Env | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(initialApiKey);
  const [regenerating, setRegenerating] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detected, setDetected] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);

  // 환경 자동 감지 (한 번만)
  useEffect(() => {
    if (!env) setEnv(detectEnv());
  }, [env]);

  // Step 4: 폴링 + 경과 타이머
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step !== 4 || detected) {
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
        pollingRef.current = setTimeout(poll, 10_000);
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

  // WebSocket: 첫 hooks 메시지 도착 시 detected=true (통합 스크립트의 install_test ping도 잡힘)
  const wsHandler = useCallback(() => {
    if (step === 4 && !detected) setDetected(true);
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

  const canGoNext = (): boolean => {
    if (step === 1) return env !== null;
    if (step === 2) return apiKey !== null;
    return true;
  };

  const isLastStep = step === TOTAL_STEPS;

  const goNext = () => {
    if (isLastStep) {
      onComplete();
      return;
    }
    setStep((prev) => prev + 1);
  };

  const goPrev = () => {
    if (step === 1) return;
    setStep((prev) => prev - 1);
  };

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
              4단계, 약 2분 안에 본인 작업이 대시보드에 흐르도록 설정합니다.
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
                    떠나면 다시 볼 수 없습니다. 다음 단계의 설치 명령에 자동으로 포함되므로 별도
                    복사는 선택사항입니다.
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
            <StepBody title="원클릭 설치">
              <p style={{ fontSize: 13, color: C.dim, marginBottom: 12, lineHeight: 1.6 }}>
                추적할 <strong style={{ color: C.text }}>본인 레포의 루트 디렉토리</strong>로
                이동한 뒤, 아래 한 줄을 터미널에서 실행하세요. 환경변수 설정, 레포 등록, Hook
                설치, 연결 테스트가 자동으로 진행됩니다.
              </p>

              <CodeBlock code={commands.oneLineInstall} />

              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 12,
                  color: C.dim,
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>
                  자동으로 처리되는 항목
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li><code>~/.claude/.env</code>에 AIOPS_REMOTE_URL / API_KEY / TENANT_ID 추가</li>
                  <li>현재 디렉토리를 활성 프로젝트로 자동 등록</li>
                  <li><code>.claude/hooks/</code>에 Hook 스크립트 3종 설치 및 <code>settings.json</code> 갱신</li>
                  <li>테스트 ping 전송 → 다음 단계에서 자동 감지</li>
                </ul>
              </div>

              <button
                onClick={() => setShowAdvanced((v) => !v)}
                style={{
                  marginTop: 14,
                  background: 'transparent',
                  border: 'none',
                  color: C.dim,
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                }}
              >
                {showAdvanced ? '고급 옵션 닫기' : '고급: 2단계 수동 방식 보기'}
              </button>

              {showAdvanced && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 12, color: C.dim, marginBottom: 8 }}>
                    1) 환경변수 추가 (한 번만)
                  </p>
                  <CodeBlock code={commands.envPatch} />
                  <p style={{ fontSize: 12, color: C.dim, margin: '12px 0 8px' }}>
                    2) 레포 디렉토리에서 Hook 설치
                  </p>
                  <CodeBlock code={commands.installHook} />
                  <p style={{ fontSize: 11, color: C.dim, marginTop: 8 }}>
                    이 방식은 레포 등록이 자동으로 되지 않습니다. "연결 설정" 탭에서 수동 등록이
                    필요합니다.
                  </p>
                </div>
              )}
            </StepBody>
          )}

          {step === 4 && (
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
                    이전 단계의 설치 명령이 정상 종료되었다면 곧 자동 감지됩니다. 통합
                    스크립트는 마지막에 테스트 ping을 전송하므로 보통 즉시 도착합니다.
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
                  {elapsedSec >= 120 && (
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
                      <strong>2분이 지났습니다.</strong> 다음을 확인해보세요:
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>Step 3의 명령어를 본인 레포 디렉토리에서 실제로 실행했나요?</li>
                        <li>스크립트가 "[4/4] 연결 테스트" 단계까지 완료했나요?</li>
                        <li>방화벽/프록시가 대시보드 호스트를 차단하지 않나요?</li>
                        <li>API 키가 만료/재발급된 상태는 아닌가요?</li>
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
