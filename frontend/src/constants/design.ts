/**
 * 디자인 토큰 — 콤팩트 UI를 위한 일관된 단위.
 *
 * spacing(S), typography(T), radius(R)를 한 곳에서 관리.
 * 인라인 스타일에서 import해서 사용한다.
 *
 * density 모드(compact / normal / roomy)는 CSS 변수로 동적 전환되며,
 * 인라인 스타일에서는 var(--s-md) 같이 쓰거나, 정적 import S.md를 사용해도 된다.
 * 정적 import는 'normal' 기본값을 사용한다.
 */

export type Density = 'compact' | 'normal' | 'roomy';

/** 사용자가 선택한 밀도 (App에서 useDensity 훅으로 변경) */
export const DENSITY_KEY = 'aiops_density';

/** 1.0 = normal, 0.75 = compact, 1.25 = roomy */
export const DENSITY_SCALE: Record<Density, number> = {
  compact: 0.75,
  normal: 1.0,
  roomy: 1.25,
};

/** 정적 spacing — normal 기준. 동적 전환은 useDensity / CSS var 사용. */
export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** 콤팩트 모드 spacing — JS에서 직접 참조할 때 사용 */
export const S_COMPACT = {
  xs: 3,
  sm: 6,
  md: 9,
  lg: 12,
  xl: 18,
  xxl: 24,
} as const;

/** Typography — px 단위 fontSize */
export const T = {
  h1: 18,
  h2: 15,
  h3: 13,
  body: 12,
  sm: 11,
  xs: 10,
} as const;

/** Radius */
export const R = {
  sm: 4,
  md: 6,
  lg: 8,
} as const;

/** density에 따른 spacing 객체 반환 */
export function spacingFor(density: Density): typeof S {
  if (density === 'compact') return S_COMPACT as unknown as typeof S;
  if (density === 'roomy') {
    return {
      xs: 5, sm: 10, md: 15, lg: 20, xl: 30, xxl: 40,
    };
  }
  return S;
}

/**
 * CSS 변수 기반 동적 전환을 위한 :root 변수 주입.
 * App에서 한 번 호출하면 모든 자식에서 var(--s-md) 등 사용 가능.
 */
export function applyDensityVars(density: Density) {
  const s = spacingFor(density);
  const root = document.documentElement;
  root.style.setProperty('--s-xs', `${s.xs}px`);
  root.style.setProperty('--s-sm', `${s.sm}px`);
  root.style.setProperty('--s-md', `${s.md}px`);
  root.style.setProperty('--s-lg', `${s.lg}px`);
  root.style.setProperty('--s-xl', `${s.xl}px`);
  root.style.setProperty('--s-xxl', `${s.xxl}px`);
  root.style.setProperty('--density', density);
}

export function loadDensity(): Density {
  const v = (typeof localStorage !== 'undefined' && localStorage.getItem(DENSITY_KEY)) || 'compact';
  if (v === 'compact' || v === 'normal' || v === 'roomy') return v;
  return 'compact';
}

export function saveDensity(d: Density) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(DENSITY_KEY, d);
}
