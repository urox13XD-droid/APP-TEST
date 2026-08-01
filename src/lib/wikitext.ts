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
  if (!text) return null;

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
