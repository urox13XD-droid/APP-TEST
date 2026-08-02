import type { EventSource } from "./eventPool";

export interface EventApiResponse {
  year: number;
  hhmm: string;
  isFuture: boolean;
  event: {
    headline: string;
    source: EventSource;
    fictionWork?: string;
    fictionType?: string;
    /** Present only when we have a linkable Wikipedia (or best-effort
     * fiction) title -- the client uses it to fetch /api/summary. */
    wikiTitle: string | null;
  } | null;
}

export interface SummaryApiResponse {
  title: string;
  extract: string;
  wikipediaUrl: string;
  /** True when `extract` was written by the app's AI grounding step rather
   * than being Wikipedia's own raw article extract (see /api/summary). */
  aiGenerated: boolean;
}
