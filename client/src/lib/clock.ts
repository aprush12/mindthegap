// Demo clock: starts at the moment the synthetic scenario is set (11/20/2026 11:20 local)
// and advances in real time, so new events line up with the seeded timeline.
const DEMO_START = new Date(2026, 10, 20, 11, 20, 0).getTime();
const bootedAt = Date.now();

export function now(): Date {
  return new Date(DEMO_START + (Date.now() - bootedAt));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local ISO without zone, e.g. 2026-11-20T11:24:07 */
export function nowIso(): string {
  const d = now();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const parse = (iso: string) => new Date(iso.length === 16 ? `${iso}:00` : iso);

export const fmtTime = (iso?: string) => (iso ? `${pad(parse(iso).getHours())}:${pad(parse(iso).getMinutes())}` : '—');
export const fmtTimeSec = (iso?: string) => (iso ? `${fmtTime(iso)}:${pad(parse(iso).getSeconds())}` : '—');
export const fmtMonthDay = (iso: string) => `${pad(parse(iso).getMonth() + 1)}/${pad(parse(iso).getDate())}`;
export const fmtShort = (iso?: string) => (iso ? `${fmtMonthDay(iso)} ${fmtTime(iso)}` : '—');
export const fmtFull = (iso?: string) => (iso ? `${fmtMonthDay(iso)}/${parse(iso).getFullYear()} ${fmtTime(iso)}` : '—');
export const fmtDayHeading = (iso: string) => parse(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** Minutes from now until iso (negative when past). */
export function minutesUntil(iso: string): number {
  return Math.round((parse(iso).getTime() - now().getTime()) / 60000);
}

export function fmtDuration(totalMin: number): string {
  const m = Math.abs(totalMin);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export const fmtClock = (secs: number) => `${Math.floor(secs / 60)}:${pad(secs % 60)}`;
