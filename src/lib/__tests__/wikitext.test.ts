import { describe, expect, it } from "vitest";
import { extractEventBullets, extractSection, parseBulletLine, parseBulletLines } from "../wikitext";

const SAMPLE_PAGE = `{{Infobox Année}}
'''1945''' est une année commune.

== Événements ==
=== Janvier ===
* [[27 janvier]] : libération du camp d'[[Auschwitz]] par l'Armée rouge.

=== Mai ===
* [[8 mai]] : capitulation de l'[[Allemagne nazie|Allemagne]], fin de la [[Seconde Guerre mondiale]] en Europe<ref>Une source quelconque.</ref>.

=== Divers ===
* Fondation de l'[[Organisation des Nations unies|ONU]].
* Première [[explosion nucléaire]] lors de l'essai [[Trinity (essai nucléaire)|Trinity]].

== Naissances ==
* [[1er janvier]] : Une personne née cette année-là.

== Décès ==
* Une autre personne.
`;

describe("extractSection", () => {
  it("extracts only the content between the target heading and the next level-2 heading", () => {
    const section = extractSection(SAMPLE_PAGE, ["Événements"]);
    expect(section).toContain("Auschwitz");
    expect(section).toContain("ONU");
    expect(section).toContain("Trinity");
    expect(section).not.toContain("Naissances");
    expect(section).not.toContain("Une personne née");
  });

  it("is case-insensitive and matches any of several candidate names", () => {
    const section = extractSection(SAMPLE_PAGE, ["événements prévus", "ÉVÉNEMENTS"]);
    expect(section).toContain("Auschwitz");
  });

  it("returns null when no matching section exists", () => {
    expect(extractSection(SAMPLE_PAGE, ["Section inexistante"])).toBeNull();
  });

  it("includes subsection headings like '=== Mai ===' inside captured text (caller ignores them)", () => {
    const section = extractSection(SAMPLE_PAGE, ["Événements"])!;
    expect(section).toContain("=== Mai ===");
  });
});

describe("parseBulletLine", () => {
  it("keeps the display text of a piped wikilink and captures its target", () => {
    const result = parseBulletLine("* [[8 mai]] : capitulation de l'[[Allemagne nazie|Allemagne]].");
    expect(result?.text).toBe("8 mai : capitulation de l'Allemagne.");
    expect(result?.linkTitle).toBe("8 mai");
  });

  it("unwraps a {{Date-|...}} template to its date text instead of deleting it", () => {
    // Regression test: real French Wikipedia year pages date-link events
    // with this template rather than a plain [[wikilink]]. Deleting it
    // like a noise template left bullets starting mid-sentence (": ...").
    const result = parseBulletLine(
      "** {{Date-|30 septembre}} : élections législatives danoises. Le 30, [[Hans Hedtoft]] forme un gouvernement social-démocrate minoritaire."
    );
    expect(result?.text).toBe(
      "30 septembre : élections législatives danoises. Le 30, Hans Hedtoft forme un gouvernement social-démocrate minoritaire."
    );
    expect(result?.text.startsWith(":")).toBe(false);
  });

  it("unwraps {{date-|...}} regardless of capitalisation", () => {
    const result = parseBulletLine("* {{date-|1er janvier}} : nouvelle année.");
    expect(result?.text).toBe("1er janvier : nouvelle année.");
  });

  it("drops a leading bare colon left behind by an unrecognised date template", () => {
    // Simulates a date-link template name we don't specifically unwrap
    // (Wikipedia uses several across different years/pages) getting
    // deleted by the generic template stripper, leaving ": rest of
    // sentence" -- this is the actual bug reported from real usage.
    const result = parseBulletLine("* {{Date sd|29|1|1713}} : Second traité de la Barrière à Utrecht.");
    expect(result?.text).toBe("Second traité de la Barrière à Utrecht.");
  });

  it("capitalises the first letter even when there was no leading colon", () => {
    const result = parseBulletLine("* le général Laperrine quitte Ouargla en automobile.");
    expect(result?.text).toBe("Le général Laperrine quitte Ouargla en automobile.");
  });

  it("leaves a digit-first sentence (e.g. a date) untouched by capitalisation", () => {
    const result = parseBulletLine("* [[8 mai]] : capitulation de l'Allemagne.");
    expect(result?.text).toBe("8 mai : capitulation de l'Allemagne.");
  });

  it("strips <ref>...</ref> footnotes entirely", () => {
    const result = parseBulletLine("* Fin de la guerre<ref>Une source quelconque.</ref>.");
    expect(result?.text).toBe("Fin de la guerre.");
  });

  it("strips self-closing ref tags", () => {
    const result = parseBulletLine("* Un événement<ref name=\"x\" />.");
    expect(result?.text).toBe("Un événement.");
  });

  it("strips bold and italic wiki-markup", () => {
    const result = parseBulletLine("* '''Un événement''' vraiment ''important''.");
    expect(result?.text).toBe("Un événement vraiment important.");
  });

  it("converts an external link to its label", () => {
    const result = parseBulletLine("* Voir [https://example.com plus d'infos] ici.");
    expect(result?.text).toBe("Voir plus d'infos ici.");
  });

  it("strips simple templates", () => {
    const result = parseBulletLine("* Un événement {{Référence nécessaire}} important.");
    expect(result?.text).toBe("Un événement important.");
  });

  it("returns null for an empty bullet", () => {
    expect(parseBulletLine("*")).toBeNull();
    expect(parseBulletLine("*   ")).toBeNull();
  });

  it("uses the FIRST wikilink as linkTitle when several are present", () => {
    const result = parseBulletLine("* [[Napoléon Ier|Napoléon]] devient [[Empereur des Français|empereur]].");
    expect(result?.linkTitle).toBe("Napoléon Ier");
    expect(result?.text).toBe("Napoléon devient empereur.");
  });

  it("drops a parent bullet that is only a date with nothing else (real events are in nested sub-bullets)", () => {
    // Regression test from real usage: recent years structure "1er janvier"
    // as a parent bullet with a bare colon, followed by "**" sub-bullets
    // for each actual event of that day.
    expect(parseBulletLine("* [[1er janvier]] :")).toBeNull();
    expect(parseBulletLine("* [[8 mai]] :")).toBeNull();
  });

  it("keeps a genuinely short event even though it's only a few words", () => {
    const result = parseBulletLine("* Bataille de Hastings.");
    expect(result?.text).toBe("Bataille de Hastings.");
  });
});

describe("real-world recent-year structure (Chronologie mensuelle)", () => {
  // Regression test: recent/heavily-edited French Wikipedia year pages
  // (reported from real usage on "2020") keep only a handful of vague
  // bullets directly under "== Événements ==" and move all the actual
  // dated events into a separate "== Chronologie mensuelle ==" section,
  // broken down by "=== Mois AAAA ===" sub-sections. Missing this section
  // entirely made recent years look almost empty.
  const RECENT_YEAR_PAGE = `{{Infobox Année}}
'''2020''' est une année.

== Événements ==
* Poursuite de la [[pandémie de Covid-19]].
* En 2020, la Métropole de Lille est capitale mondiale du design.

== Chronologie mensuelle ==
=== Janvier 2020 ===
Article détaillé : [[Janvier 2020]].

* [[1er janvier]] :
   ** La [[Croatie]] prend la présidence tournante du [[Conseil de l'Union européenne]].
   ** Des foules de manifestants pénètrent dans l'enceinte de l'ambassade des États-Unis à Bagdad.
* 3 janvier : le général iranien [[Qassem Soleimani]] est assassiné en Irak par une frappe américaine.

=== Février 2020 ===
Article détaillé : [[Février 2020]].

* 9 février : élections législatives en Irlande.

== Événements annulés ==
* Le sommet du G7 n'aura finalement jamais lieu.

== Naissances en 2020 ==
* Une personne.
`;

  it("extractSection finds the monthly chronology section separately from Événements", () => {
    const section = extractSection(RECENT_YEAR_PAGE, ["Chronologie mensuelle"]);
    expect(section).toContain("Soleimani");
    expect(section).toContain("Croatie");
    expect(section).not.toContain("pandémie");
    expect(section).not.toContain("Événements annulés");
  });

  it("combining Événements + Chronologie mensuelle yields the full real event list", () => {
    const events = extractSection(RECENT_YEAR_PAGE, ["Événements"]);
    const monthly = extractSection(RECENT_YEAR_PAGE, ["Chronologie mensuelle"]);
    const bullets = parseBulletLines([events, monthly].filter((s): s is string => !!s).join("\n"));

    const texts = bullets.map((b) => b.text);
    expect(texts).toContain("Poursuite de la pandémie de Covid-19.");
    // the bare "* [[1er janvier]] :" parent bullet is dropped...
    expect(texts.some((t) => t === "1er janvier")).toBe(false);
    // ...but its real nested events survive, without a stray leading colon
    expect(texts.some((t) => t.startsWith("La Croatie prend la présidence"))).toBe(true);
    expect(texts.some((t) => t.startsWith("Des foules de manifestants"))).toBe(true);
    expect(texts.some((t) => t.includes("Soleimani"))).toBe(true);
    expect(texts.some((t) => t.includes("Irlande"))).toBe(true);
    for (const t of texts) {
      expect(t.startsWith(":")).toBe(false);
    }
  });
});

describe("extractEventBullets", () => {
  // A blocklist ("skip Naissances/Décès/...") is far more robust than an
  // allowlist of exact section names, since French Wikipedia doesn't use
  // identical section names on every year page. This is the full-page
  // version of the "real-world recent-year structure" test above, using
  // extractEventBullets directly instead of manually combining sections.
  const FULL_YEAR_PAGE = `{{Infobox Année}}
'''2020''' est une année.

== Événements ==
* Poursuite de la [[pandémie de Covid-19]].

== Chronologie mensuelle ==
=== Janvier 2020 ===
Article détaillé : [[Janvier 2020]].

* [[1er janvier]] :
   ** La [[Croatie]] prend la présidence tournante du Conseil de l'Union européenne.
* 3 janvier : le général iranien [[Qassem Soleimani]] est assassiné en Irak.

== Événements annulés ==
* Le sommet du G7 n'aura finalement jamais lieu.

== Distinctions internationales ==
=== Prix Nobel ===
* Prix Nobel de la paix : Programme alimentaire mondial.

== Fondations en 2020 ==
* Une entreprise.

== Naissances en 2020 ==
* Une personne née cette année-là.

== Décès en 2020 ==
[[Sean Connery]].
=== Janvier ===
* 31 janvier : Mary Higgins Clark, écrivaine américaine.

== Voir aussi ==
* [[Années 2020]]

== Notes et références ==
1. Une note.
`;

  it("includes real events from both Événements and Chronologie mensuelle", () => {
    const texts = extractEventBullets(FULL_YEAR_PAGE).map((b) => b.text);
    expect(texts.some((t) => t.includes("pandémie de Covid-19"))).toBe(true);
    expect(texts.some((t) => t.includes("Croatie"))).toBe(true);
    expect(texts.some((t) => t.includes("Soleimani"))).toBe(true);
  });

  it("excludes Naissances, Décès, Fondations, Distinctions/Prix Nobel, Voir aussi, Notes, Événements annulés", () => {
    const texts = extractEventBullets(FULL_YEAR_PAGE).map((b) => b.text);
    expect(texts.some((t) => t.includes("née cette année"))).toBe(false);
    expect(texts.some((t) => t.includes("Higgins Clark"))).toBe(false);
    expect(texts.some((t) => t.includes("Une entreprise"))).toBe(false);
    expect(texts.some((t) => t.includes("Programme alimentaire"))).toBe(false);
    expect(texts.some((t) => t.includes("Années 2020"))).toBe(false);
    expect(texts.some((t) => t.includes("G7"))).toBe(false);
  });

  it("matches excluded section prefixes regardless of accents/case (Décès vs DECES vs décès en 2020)", () => {
    const page = `== Événements ==\n* Un vrai événement.\n\n== DÉCÈS EN 2020 ==\n* Ne devrait jamais apparaître.\n`;
    const texts = extractEventBullets(page).map((b) => b.text);
    expect(texts).toEqual(["Un vrai événement."]);
  });

  it("returns an empty array for a page with no recognisable event section", () => {
    const page = `== Naissances ==\n* Une personne.\n\n== Décès ==\n* Une autre.\n`;
    expect(extractEventBullets(page)).toEqual([]);
  });
});

describe("parseBulletLines", () => {
  it("parses every bullet in a multi-subsection events block, in order", () => {
    const section = extractSection(SAMPLE_PAGE, ["Événements"])!;
    const bullets = parseBulletLines(section);
    expect(bullets).toHaveLength(4);
    expect(bullets[0].text).toContain("Auschwitz");
    expect(bullets[0].linkTitle).toBe("27 janvier");
    expect(bullets[2].text).toContain("ONU");
    expect(bullets[3].text).toContain("Trinity");
  });

  it("ignores non-bullet lines like subsection headings and blank lines", () => {
    const bullets = parseBulletLines("=== Mai ===\n\n* Un seul événement.\n\nTexte libre sans puce.");
    expect(bullets).toHaveLength(1);
    expect(bullets[0].text).toBe("Un seul événement.");
  });
});
