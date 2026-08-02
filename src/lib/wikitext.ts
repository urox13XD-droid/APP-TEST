/**
 * Minimal MediaWiki wikitext parsing: extract a named level-2 section
 * ("== Événements ==") and turn its bullet lines into clean display text
 * + the first linked article title (used to fetch a proper summary later).
 *
 * Deliberately regex-based rather than a full wikitext parser -- French
 * Wikipedia year pages are simple, flat bullet lists for this purpose, and
 * a full parser would be a lot of weight for that.
 */

export interface ParsedBullet {
  text: string;
  linkTitle: string | null;
}

// Matches a bare French date fragment and nothing else (e.g. "1er janvier",
// "8 mai", "30 septembre 2020", "Décembre") -- used to drop parent list
// items that carry no content of their own, see parseBulletLine below.
const BARE_DATE_RE =
  /^(?:\d{1,2}(?:er)?\s+)?(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)(?:\s+\d{3,4})?$/i;

/**
 * Returns the raw wikitext of the first matching level-2 section
 * (`== Heading ==`), up to (not including) the next level-2 heading.
 * Section names are matched case-insensitively. Returns null if none of
 * the given names are found.
 */
export function extractSection(wikitext: string, sectionNames: string[]): string | null {
  const targets = new Set(sectionNames.map((s) => s.trim().toLowerCase()));
  const lines = wikitext.split("\n");

  let capturing = false;
  const captured: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^==([^=].*?)==\s*$/);
    if (heading) {
      const title = heading[1].trim().toLowerCase();
      if (targets.has(title)) {
        capturing = true;
        continue;
      }
      if (capturing) {
        break; // reached the next level-2 section: stop
      }
      continue;
    }
    if (capturing) captured.push(line);
  }

  return captured.length ? captured.join("\n") : null;
}

/** Splits wikitext into top-level (`==`) sections, each carrying all of
 * its nested (`===`, `====`, ...) subsection text as-is. Level-3+
 * headings are matched by `parseBulletLines`'s "not a bullet" filter and
 * simply flow through as inert text -- only the level-2 boundary matters
 * here. */
function parseTopLevelSections(wikitext: string): { title: string; content: string }[] {
  const lines = wikitext.split("\n");
  const sections: { title: string; content: string[] }[] = [];
  let current: { title: string; content: string[] } | null = null;

  for (const line of lines) {
    const heading = line.match(/^==([^=].*?)==\s*$/);
    if (heading) {
      if (current) sections.push(current);
      current = { title: heading[1].trim(), content: [] };
      continue;
    }
    if (current) current.content.push(line);
    // Lines before the first level-2 heading (lede/infobox) are discarded.
  }
  if (current) sections.push(current);

  return sections.map((s) => ({ title: s.title, content: s.content.join("\n") }));
}

// Section titles that never contain "events that happened" in the sense
// this app cares about. Matched as a prefix (case-insensitive, accents
// normalised) so "Décès en 2020" / "Décès" / "Fondations en 2020" etc. all
// match without having to enumerate every year. An allowlist of exact
// section names ("Événements", "Chronologie mensuelle", ...) turned out to
// be too brittle -- French Wikipedia doesn't use identical section names
// on every year page, so real events kept getting missed. Blocking the
// small set of sections we *know* aren't events is far more robust.
const EXCLUDED_SECTION_PREFIXES = [
  "naissance",
  "deces", // "décès", diacritic-stripped, see normalise()
  "distinction",
  "prix nobel",
  "autres prix",
  "fondation",
  "note",
  "reference",
  "bibliographie",
  "article connexe",
  "voir aussi",
  "lien externe",
  "annexe",
  "source",
  "chronologie specifique a la fiction", // handled separately as a fiction source, not historical fact
  "evenements annule", // "Événements annulés" -- never actually happened
];

function normalise(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accent marks
    .toLowerCase()
    .trim();
}

function isExcludedSection(title: string): boolean {
  const normalised = normalise(title);
  return EXCLUDED_SECTION_PREFIXES.some((prefix) => normalised.startsWith(prefix));
}

/** The main extraction entry point: every bullet from every section of
 * the page except the known non-event ones (see EXCLUDED_SECTION_PREFIXES
 * above), in document order. Replaces trying to guess exact section names
 * ("Événements", "Chronologie mensuelle", "Événements prévus", ...) --
 * this only needs to know what to skip, not what to look for. */
export function extractEventBullets(wikitext: string): ParsedBullet[] {
  const sections = parseTopLevelSections(wikitext);
  const bullets: ParsedBullet[] = [];
  for (const section of sections) {
    if (isExcludedSection(section.title)) continue;
    bullets.push(...parseBulletLines(section.content));
  }
  return bullets;
}

// French Wikipedia year pages commonly date-link the start of an event
// bullet with a template instead of a plain [[wikilink]], e.g.
// "{{Date-|30 septembre}} : élections..." -- unwrap these to their date
// text *before* the generic template stripper runs, otherwise the date
// itself gets deleted along with genuine noise templates (citation-needed
// markers, etc.), leaving a bullet that starts mid-sentence with ": ...".
function unwrapDateTemplates(text: string): string {
  return text.replace(/\{\{\s*[Dd]ate2?-?\s*\|([^{}|]+)(?:\|[^{}]*)?\}\}/g, (_m, param: string) => param.trim());
}

function stripTemplates(text: string): string {
  // {{...}} can nest in real wikitext, but not in the short event bullets
  // we deal with here -- loop a non-nested pass until stable, as cheap
  // insurance against one level of nesting.
  let prev: string;
  do {
    prev = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, "");
  } while (text !== prev);
  return text;
}

/** Parses a single wikitext bullet line into clean display text plus the
 * first `[[wikilink]]` target found (or null if there isn't one). */
export function parseBulletLine(rawLine: string): ParsedBullet | null {
  let text = rawLine.trim().replace(/^\*+\s*/, "");
  if (!text) return null;

  // Refs: <ref>...</ref> and self-closing <ref .../>
  text = text.replace(/<ref[^>]*\/>/gi, "");
  text = text.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "");
  // Other stray HTML-ish tags (<br />, <small>...</small>, etc.)
  text = text.replace(/<[^>]+>/g, " ");

  let linkTitle: string | null = null;
  text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, display?: string) => {
    if (linkTitle === null) linkTitle = target.trim();
    return (display ?? target).trim();
  });

  // External links: [http://example.com Label] -> Label
  text = text.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, "$1");
  text = text.replace(/\[https?:\/\/[^\s\]]+\]/g, "");

  text = unwrapDateTemplates(text);
  text = stripTemplates(text);

  // Bold/italic markup
  text = text.replace(/'''''/g, "").replace(/'''/g, "").replace(/''/g, "");

  text = text.replace(/\s+/g, " ").trim();

  // Wikipedia uses several different date-link template names across
  // years/pages -- we can't reliably chase every variant. When one we
  // don't recognise gets deleted by the generic template stripper above,
  // it leaves the bullet's own ": rest of the sentence" separator with
  // nothing in front of it. Clean that up defensively (whatever the
  // cause) and always capitalise the first letter, so the headline
  // reads as a proper sentence either way.
  text = text.replace(/^:+\s*/, "");
  if (text.length > 0) {
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  if (!text) return null;

  // A bullet that's just a date and nothing else -- e.g. a parent list
  // item "* [[1er janvier]] :" whose actual events live entirely in
  // nested "**" sub-bullets below it -- carries no real information on
  // its own. Drop it instead of surfacing a near-empty headline like
  // "1er janvier". Genuine short sentences ("Un événement.") don't match
  // this date-only pattern and survive.
  text = text.replace(/:\s*$/, "").trim();
  if (BARE_DATE_RE.test(text)) return null;

  return { text, linkTitle };
}

/** Parses every bullet line (any nesting depth: `*`, `**`, ...) found in a
 * section's wikitext, in document order. */
export function parseBulletLines(sectionText: string): ParsedBullet[] {
  return sectionText
    .split("\n")
    .filter((line) => /^\*+\s*\S/.test(line.trim()))
    .map(parseBulletLine)
    .filter((b): b is ParsedBullet => b !== null);
}
