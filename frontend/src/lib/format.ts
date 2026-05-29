// 숫자/시간 포맷 — ko-KR locale, tabular-nums 전제.

export function fmtNum(n: number | undefined | null): string {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  return n.toLocaleString('ko-KR');
}

/** 큰 수를 3.1k / 98.4k / 1.2M 형태로 압축 */
export function fmtCompact(n: number | undefined | null): string {
  if (typeof n !== 'number' || !isFinite(n)) return '0';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** ISO ts → "12분 전" / "3시간 전" / "5월 28일" */
export function relTime(ts: string): string {
  const t = new Date(ts).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(t).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

/** ISO ts → "12:48:03" */
export function timeOf(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** ISO ts → "12:48" */
export function hhmm(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

/** 소요시간(ms) → "42ms" / "1.2s" */
export function fmtDuration(ms: number): string {
  if (typeof ms !== 'number' || !isFinite(ms)) return '-';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
