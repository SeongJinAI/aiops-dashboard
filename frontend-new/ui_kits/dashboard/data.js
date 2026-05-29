// Nova — fake data for the UI kit
// Plain JS (no JSX) so we can load via <script src=> and share globally.

window.NOVA_DATA = (() => {
  const today = new Date('2026-05-28T12:48:00');

  const sidebar = [
    {
      label: 'Dashboard',
      items: [
        { id: 'home',         label: '홈',          icon: 'home',         path: '/' },
        { id: 'repo-map',     label: '레포 관계도', icon: 'git-branch',   path: '/repo-map',     count: 5 },
      ],
    },
    {
      label: 'Insights',
      items: [
        { id: 'hooks',             label: 'Hook 모니터', icon: 'activity',       path: '/hooks',             count: '847' },
        { id: 'workflow',          label: '워크플로우',   icon: 'workflow',       path: '/workflow' },
        { id: 'prompts',           label: '프롬프트',     icon: 'message-square', path: '/prompts',           count: '3.1k' },
        { id: 'misunderstandings', label: '오해 추적',    icon: 'alert-circle',   path: '/misunderstandings', count: 12 },
      ],
    },
    {
      label: 'Nova',
      items: [
        { id: 'agent',         label: '에이전트',    icon: 'sparkles', path: '/agent' },
        { id: 'claude-config', label: 'Claude 설정', icon: 'settings', path: '/claude-config' },
        { id: 'connections',   label: '연결',        icon: 'plug',     path: '/connections' },
      ],
    },
  ];

  const stats = [
    { id: 'prompts',     label: 'PROMPTS · 24h',  value: '3,124', delta: '+12%',  trend: 'up',
      spark: [15,14,10,12,8,9,5,7,4,3,2] },
    { id: 'hooks',       label: 'HOOKS · 24h',    value: '847',   delta: '+4.3%', trend: 'up',
      spark: [10,9,12,11,14,10,8,11,9,7,8] },
    { id: 'tokens',      label: 'TOKENS · 24h',   value: '98.4k', delta: '+8.1%', trend: 'up',
      spark: [12,11,9,8,7,6,5,7,4,3,3] },
    { id: 'misun',       label: '오해 · 24h',      value: '12',    delta: '−18%',  trend: 'down',
      spark: [4,6,5,8,7,10,11,14,15,17,18] },
    { id: 'health',      label: 'SYSTEM',          value: 'OK',    delta: '3 svc', trend: 'neutral',
      spark: null, dot: 'success' },
  ];

  const repos = [
    { id: 'nova',   name: 'nova', desc: 'Track · Wikify · Coach',          branch: 'main',         dirty: false, status: 'active' },
    { id: 'kepler',  name: 'kepler',       desc: 'AI-assisted dashboard prototype', branch: 'feat/charts',  dirty: true,  status: 'tracked' },
    { id: 'inkwell', name: 'inkwell',      desc: 'Markdown asset pipeline',         branch: 'main',         dirty: false, status: 'tracked' },
    { id: 'forge',   name: 'forge',        desc: '.claude/ ruleset experiments',    branch: 'main',         dirty: false, status: 'tracked' },
    { id: 'lyra',    name: 'lyra',         desc: 'Prompt template library',         branch: 'wip/refactor', dirty: true,  status: 'tracked' },
  ];

  const recent = [
    { id: 1, kind: 'wiki',    title: 'Nova 위키 v3 빌드 완료',                    proj: 'nova', when: '12분 전',  state: 'success' },
    { id: 2, kind: 'hook',    title: 'PostToolUse · Edit (×14)',                    proj: 'nova', when: '24분 전',  state: 'success' },
    { id: 3, kind: 'misun',   title: '오해 감지 — "Tailwind v4 새 문법" 패턴',       proj: 'kepler',       when: '37분 전',  state: 'warning' },
    { id: 4, kind: 'prompt',  title: '218자 프롬프트 — "이 컴포넌트를 split하라"',   proj: 'kepler',       when: '1시간 전', state: 'info' },
    { id: 5, kind: 'hook',    title: 'SessionStart · 새 작업 시작',                  proj: 'lyra',         when: '2시간 전', state: 'success' },
    { id: 6, kind: 'wiki',    title: 'Nova 위키 v2 빌드 완료',                    proj: 'nova', when: '어제',     state: 'success' },
  ];

  // 14 days × 24 hours — heatmap. seeded pseudo-random.
  function rand(seed){ let x = Math.sin(seed)*10000; return x-Math.floor(x); }
  const heatmap = Array.from({length: 14}, (_, d) =>
    Array.from({length: 24}, (_, h) => {
      const base = (h >= 9 && h <= 18) ? 0.5 : (h >= 0 && h <= 3) ? 0.6 : 0.1;
      const v = base + rand(d*24+h)*0.5 - 0.15;
      return Math.max(0, Math.min(1, v));
    })
  );

  // 30 days line chart values
  const dailyPrompts = Array.from({length: 30}, (_, i) =>
    Math.round(60 + Math.sin(i/3)*30 + rand(i+100)*40 + i*1.2)
  );

  const prompts = [
    { id: 'p1', text: '이 컴포넌트를 더 작은 단위로 split해줘. props는 그대로 유지.', tokens: 218, when: '12:43', model: 'claude-haiku-4-5', tag: 'refactor' },
    { id: 'p2', text: 'Hook 로그 테이블의 row가 새로 들어올 때 부드럽게 slide-in 시키는 애니메이션을 추가해줘.', tokens: 142, when: '12:38', model: 'claude-haiku-4-5', tag: 'animation' },
    { id: 'p3', text: '/api/prompts endpoint가 timeout 나는 이유 분석. 마지막 trace는 server.log 라인 421부터.', tokens: 96, when: '12:31', model: 'gpt-5', tag: 'debug' },
    { id: 'p4', text: 'Pretendard variable 폰트 import할 때 dynamic-subset 쓰는 게 맞아?', tokens: 54, when: '12:20', model: 'gemini-2.5-pro', tag: 'question' },
    { id: 'p5', text: '이 prompt를 더 짧게 요약해줘. tone은 calm + expert.', tokens: 38, when: '12:12', model: 'claude-haiku-4-5', tag: 'edit' },
  ];

  const hooks = [
    { id: 'h1', name: 'PostToolUse · Edit',        project: 'nova', status: 'success', duration: '42ms',   time: '12:48:03' },
    { id: 'h2', name: 'UserPromptSubmit',          project: 'nova', status: 'success', duration: '8ms',    time: '12:47:58' },
    { id: 'h3', name: 'PreToolUse · Bash',         project: 'kepler',       status: 'retry',   duration: '1.2s',   time: '12:47:12' },
    { id: 'h4', name: 'Notification',              project: 'kepler',       status: 'failed',  duration: '3.4s',   time: '12:46:51' },
    { id: 'h5', name: 'SessionStart',              project: 'nova', status: 'success', duration: '112ms',  time: '12:45:00' },
    { id: 'h6', name: 'PostToolUse · WriteFile',   project: 'lyra',         status: 'success', duration: '28ms',   time: '12:44:21' },
    { id: 'h7', name: 'PostToolUse · Edit',        project: 'nova', status: 'success', duration: '36ms',   time: '12:43:50' },
  ];

  const misunderstandings = [
    { id: 'm1', pattern: 'Tailwind v4 syntax confusion', occurrences: 7, lastSeen: '37분 전', severity: 'warning', desc: '@apply 문법이 v3 → v4에서 바뀐 부분을 AI가 자주 혼동' },
    { id: 'm2', pattern: 'BYOK provider 응답 형식',      occurrences: 4, lastSeen: '2시간 전', severity: 'info',    desc: 'gemini와 openai의 응답 schema 차이를 같다고 가정' },
    { id: 'm3', pattern: 'TanStack Router v1 API',       occurrences: 1, lastSeen: '어제',     severity: 'info',    desc: 'createRoute → createFileRoute 변경 누락' },
  ];

  const versions = [
    { ver: 'v3', time: '12분 전',         provider: 'anthropic', summary: 'planner 재정렬, Coach 섹션 추가', diff: { added: 4, removed: 1 }, current: true },
    { ver: 'v2', time: '5월 27일 · 18:42', provider: 'openai',    summary: 'developer 코드 예제 보강',         diff: { added: 2, removed: 3 } },
    { ver: 'v1', time: '5월 26일 · 09:14', provider: 'anthropic', summary: 'initial build — catalog 252 .md',  diff: { added: 0, removed: 0 } },
  ];

  const wikiBody = [
    { kind: 'h1', text: 'Nova — Track · Wikify · Coach' },
    { kind: 'p',  text: 'Nova는 AI 협업 흔적을 추적하고, 자산화하고, 코칭하는 SaaS 학습 대시보드입니다. 이 위키는 planner perspective 기준으로 자동 생성됩니다.' },
    { kind: 'h2', text: '왜 이것이 필요한가?' },
    { kind: 'p',  text: '1인 개발자는 매일 수백 개의 프롬프트를 던지지만, 그 흔적은 .claude/ 폴더, 채팅 로그, 코드 diff에 흩어집니다. Nova는 이 흩어진 신호를 모아 객관적인 학습 데이터로 만듭니다.' },
    { kind: 'h2', text: 'Track — 무엇을 수집하나?' },
    { kind: 'ul', items: [
        'Claude Code · Cursor · Windsurf 등 모든 AI 도구의 prompt + hook',
        '.claude/ 디렉토리 안의 모든 .md, settings.json',
        '세션별 도구 호출 시퀀스 (read → edit → bash)',
        'AI가 잘못 이해한 패턴 (자동 감지)',
    ]},
    { kind: 'h2', text: 'Wikify — 어떻게 자산이 되나?' },
    { kind: 'p',  text: '252개의 흩어진 .md 파일과 활동 로그를 LLM이 3-perspective 위키로 재구성합니다. 기획자 / 개발자 / 사용자 관점 각각의 챕터를 만들고, 버전 간 diff를 자동 작성합니다.' },
    { kind: 'code', text: '$ nova wikify --provider anthropic --persp all\n→ catalog 252 files (3.1s)\n→ planner: 4 chapters (12.4s)\n→ developer: 6 chapters (18.1s)\n→ user: 3 chapters (8.9s)\n→ saved v3 to ./.hermes/wiki/' },
    { kind: 'h2', text: 'Coach — 다음 단계 (비전)' },
    { kind: 'p',  text: '오해 감지 + 활동 패턴을 결합해 "이 룰을 .claude/CLAUDE.md에 추가하면 같은 실수가 줄어듭니다" 같은 능동 제안을 합니다. 현재 미구현.' },
  ];

  return {
    today, sidebar, stats, repos, recent, prompts, hooks, misunderstandings,
    versions, wikiBody, heatmap, dailyPrompts,
  };
})();
