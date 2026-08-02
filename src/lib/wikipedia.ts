/**
 * French Wikipedia access: fetch a year page's wikitext, pull out every
 * event bullet on the page (see extractEventBullets in wikitext.ts for how
 * "event" sections are told apart from non-event ones like Naissances/
 * Décès), and fetch a short plain-text summary for a specific article on
 * demand.
 *
 * Cannot be exercised against the real API in this dev sandbox (network
 * policy blocks wikipedia.org here) -- verified instead via the wikitext
 * parsing unit tests, which cover the actual parsing logic against
 * realistic fixtures. The HTTP plumbing here is intentionally thin.
 */
import { extractEventBullets, type ParsedBullet } from "./wikitext";

const WIKI_API = "https://fr.wikipedia.org/w/api.php";
const USER_AGENT = "TimeDateApp/0.1 (educational/personal project)";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h -- historical content barely changes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const yearEventsCache = new Map<number, CacheEntry<ParsedBullet[]>>();
const summaryCache = new Map<string, CacheEntry<ArticleSummary | null>>();

export interface ArticleSummary {
  title: string;
  extract: string;
  wikipediaUrl: string;
}

interface MediaWikiParseResponse {
  error?: unknown;
  parse?: { wikitext?: string };
}

interface MediaWikiQueryResponse {
  query?: { pages?: { title: string; missing?: boolean; extract?: string }[] };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchWikitext(pageTitle: string): Promise<string | null> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&formatversion=2&format=json`;
  const data = await fetchJson<MediaWikiParseResponse>(url);
  if (!data || data.error) return null;
  return data.parse?.wikitext ?? null;
}

/** Returns every parsed event bullet for a given year, from cache when
 * available. */
export async function getYearEvents(year: number): Promise<ParsedBullet[]> {
  const cached = yearEventsCache.get(year);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const wikitext = await fetchWikitext(String(year));
  const bullets = wikitext ? extractEventBullets(wikitext) : [];

  yearEventsCache.set(year, { value: bullets, expiresAt: Date.now() + CACHE_TTL_MS });
  return bullets;
}

/** Short plain-text summary + canonical URL for a given article title,
 * suitable for the "click to expand" panel. Returns null if the article
 * doesn't exist (e.g. a guessed title for a fictional work was wrong). */
export async function getArticleSummary(title: string): Promise<ArticleSummary | null> {
  const cached = summaryCache.get(title);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url =
    `${WIKI_API}?action=query&prop=extracts&exintro=1&explaintext=1&exchars=500` +
    `&redirects=1&titles=${encodeURIComponent(title)}&format=json&formatversion=2`;
  const data = await fetchJson<MediaWikiQueryResponse>(url);
  const page = data?.query?.pages?.[0];

  let result: ArticleSummary | null = null;
  if (page && !page.missing && page.extract) {
    result = {
      title: page.title,
      extract: page.extract.trim(),
      wikipediaUrl: `https://fr.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`,
    };
  }

  summaryCache.set(title, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}

/** A guaranteed-to-work fallback link when we don't have (or can't
 * confirm) an exact article title. */
export function wikipediaSearchUrl(query: string): string {
  return `https://fr.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;
}
