import { describe, expect, it } from "vitest";
import { extractSection, parseBulletLine, parseBulletLines } from "../wikitext";

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
