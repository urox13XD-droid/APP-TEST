/**
 * HH:MM -> year mapping and the deterministic "different event each day"
 * rotation. Pure functions, no I/O, so they're fully unit-testable without
 * touching Wikipedia.
 */

export interface HourMinute {
  hour: number;
  minute: number;
}

/** 16:04 -> 1604, 00:04 -> 4, 23:59 -> 2359. */
export function hourMinuteToYear({ hour, minute }: HourMinute): number {
  return hour * 100 + minute;
}

export function formatHHMM({ hour, minute }: HourMinute): string {
  return `${String(hour).padStart(2, "0")}h${String(minute).padStart(2, "0")}`;
}

/** Local (not UTC) calendar date as YYYY-MM-DD -- day boundaries should
 * match the user's own day, not a server timezone. */
export function todayISO(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Deterministic index in [0, count) derived from (year, localDateISO):
 * stable for a whole day, changes the next day, with no state to persist.
 * (FNV-1a-style hash -- simple, fast, good-enough distribution for a
 * handful of candidates per year.)
 */
export function dailyRotationIndex(year: number, localDateISO: string, count: number): number {
  if (count <= 0) return 0;
  const seed = `${year}|${localDateISO}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % count;
}
