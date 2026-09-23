/** Small time helpers (all deterministic, timezone-safe enough for an MVP). */

export function nowIso(): string {
  return new Date().toISOString();
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function todayIso(): string {
  return isoDate(new Date());
}

export function nextDayIso(): string {
  return addDays(todayIso(), 1);
}

/** Index 0 = Sunday. Returns the ISO date of the next occurrence of `weekdayIndex`. */
export function nextWeekday(weekdayIndex: number, includeToday = false): string {
  const now = new Date();
  let diff = (weekdayIndex - now.getUTCDay() + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  return addDays(isoDate(now), diff);
}

/** Number of calendar days between two ISO dates (check_out - check_in). */
export function nightsBetween(a: string, b: string): number {
  const d = (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000;
  return Math.max(1, Math.round(d));
}