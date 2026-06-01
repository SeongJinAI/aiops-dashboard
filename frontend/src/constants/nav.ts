// 사이드바 3섹션 네비게이션 (DESIGN-BRIEF 부록 B 기반). path는 App.tsx 라우팅 키.
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  count?: string | number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const SIDEBAR_GROUPS: NavGroup[] = [
  {
    label: '코칭',
    items: [
      { id: 'home', label: '홈', icon: 'home', path: '/' },
      { id: 'coach', label: '코치', icon: 'lightbulb', path: '/coach' },
      { id: 'chat', label: '지식 챗', icon: 'search', path: '/chat' },
      { id: 'prompts', label: '프롬프트', icon: 'message-square', path: '/prompts' },
      { id: 'library', label: '프롬프트 라이브러리', icon: 'copy', path: '/library', count: 'Pro' },
      { id: 'misunderstandings', label: '오해 추적', icon: 'alert-circle', path: '/misunderstandings' },
      { id: 'hooks', label: 'Hook 활동', icon: 'activity', path: '/hooks' },
    ],
  },
  {
    label: '에이전트 · 계정',
    items: [
      { id: 'agent', label: '위키 에이전트', icon: 'sparkles', path: '/agent' },
      { id: 'connections', label: '연결', icon: 'plug', path: '/connections' },
      { id: 'subscribe', label: '구독', icon: 'user', path: '/subscribe' },
    ],
  },
];

/** nav에서 빠졌지만 직접 접근 가능한 경로의 라벨 (breadcrumb 보정) */
const OFF_NAV_LABELS: Record<string, string> = {
  '/project-swap': '프로젝트',
};

/** path → 라벨 (TopBar breadcrumb, CommandPalette) */
export function labelForPath(path: string): string {
  for (const g of SIDEBAR_GROUPS) {
    for (const it of g.items) {
      if (it.path === path) return it.label;
    }
  }
  return OFF_NAV_LABELS[path] ?? '홈';
}
