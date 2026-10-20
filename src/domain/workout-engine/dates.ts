/** Date helpers that work on local wall-clock time. Pure; no Date.now(). */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** YYYY-MM-DD in the local timezone */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function localDateOfIso(iso: string): string {
  return localDate(new Date(iso));
}

export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Parses YYYY-MM-DD into a local Date at midnight */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(a: string, b: string): number {
  const ms = startOfLocalDay(parseLocalDate(b)).getTime() - startOfLocalDay(parseLocalDate(a)).getTime();
  return Math.round(ms / 86_400_000);
}
