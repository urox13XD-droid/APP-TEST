/**
 * Combines the historical/predicted Wikipedia events for a year with the
 * curated fictional dates (future years only), then picks today's item via
 * the deterministic daily rotation.
 *
 * `getYearEvents` is injected so this can be unit-tested without touching
 * the network (see eventPool.test.ts) -- the real caller passes
 * wikipedia.ts's `getYearEvents`.
 */
import { dailyRotationIndex } from "./dateMath";
import { FICTIONAL_DATES, type FictionalDate } from "./fictionalDates";
import type { ParsedBullet } from "./wikitext";

export type EventSource = "historique" | "prevision" | "fiction";

export interface PoolItem {
  headline: string;
  wikiTitle: string | null;
  source: EventSource;
  fictionWork?: string;
  fictionType?: string;
}

export interface YearEventResult {
  year: number;
  isFuture: boolean;
  item: PoolItem | null;
}

const YEAR_ZERO_FALLBACK: PoolItem = {
  headline:
    "Repère du calendrier : il n'existe pas d'« an 0 » dans le calendrier grégorien usuel -- l'an 1 av. J.-C. est immédiatement suivi de l'an 1.",
  wikiTitle: "Ère commune",
  source: "historique",
};

export type GetYearEventsFn = (year: number) => Promise<ParsedBullet[]>;

export async function resolveYearEvent(
  year: number,
  currentYear: number,
  todayISODate: string,
  getYearEvents: GetYearEventsFn,
  fictionalDates: FictionalDate[] = FICTIONAL_DATES
): Promise<YearEventResult> {
  if (year === 0) {
    return { year, isFuture: false, item: YEAR_ZERO_FALLBACK };
  }

  const isFuture = year > currentYear;
  const bullets = await getYearEvents(year);

  let pool: PoolItem[] = bullets.map((b) => ({
    headline: b.text,
    wikiTitle: b.linkTitle,
    source: (isFuture ? "prevision" : "historique") as EventSource,
  }));

  if (isFuture) {
    const fiction: PoolItem[] = fictionalDates
      .filter((f) => f.year === year)
      .map((f) => ({
        headline: f.description,
        wikiTitle: f.wikiTitle ?? null,
        source: "fiction" as const,
        fictionWork: f.work,
        fictionType: f.type,
      }));
    pool = pool.concat(fiction);
  }

  if (pool.length === 0) {
    return { year, isFuture, item: null };
  }

  const idx = dailyRotationIndex(year, todayISODate, pool.length);
  return { year, isFuture, item: pool[idx] };
}
