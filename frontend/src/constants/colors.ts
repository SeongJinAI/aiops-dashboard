// 레거시 색상 상수 — CSS 토큰(styles/tokens.css)의 별칭.
// 인라인 스타일에서 var() 토큰을 쓰게 해 라이트/다크 모드 모두 자동 대응.
// 신규 코드는 ui/primitives + CSS 클래스를 우선 사용할 것.
export const C = {
  bg: "var(--bg)", surface: "var(--surface)", surfaceAlt: "var(--surface-alt)",
  border: "var(--border)", borderActive: "var(--border-active)",
  text: "var(--text)", dim: "var(--text-dim)", accent: "var(--accent)",
  green: "var(--success)", red: "var(--danger)", orange: "var(--warning)",
  cyan: "var(--cyan)", purple: "var(--purple)", pink: "var(--purple)",
} as const;
