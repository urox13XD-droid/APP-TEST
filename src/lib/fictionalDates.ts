/**
 * Curated fictional/pop-culture dates: works whose story explicitly takes
 * place in a stated real-calendar year. Deliberately kept small -- every
 * entry here should be a year genuinely cited in the work itself (often
 * literally in the title), not a guess. Only used to fill in "future"
 * years (see eventPool.ts): the app never mixes fiction into real
 * historical years.
 *
 * Easy to extend: add an entry here, nothing else needs to change.
 */

export type FictionType = "film" | "série" | "roman" | "jeu vidéo";

export interface FictionalDate {
  year: number;
  work: string;
  type: FictionType;
  description: string;
  /** Best-effort French Wikipedia article title for the "en savoir plus"
   * link. If it turns out wrong/missing, the UI falls back to a Wikipedia
   * search link instead of a broken direct link. */
  wikiTitle?: string;
}

export const FICTIONAL_DATES: FictionalDate[] = [
  {
    year: 2027,
    work: "Deus Ex",
    type: "jeu vidéo",
    description:
      "Dans le jeu vidéo Deus Ex (2000), le monde de 2027 est marqué par une pandémie mondiale et l'essor du transhumanisme.",
    wikiTitle: "Deus Ex (jeu vidéo)",
  },
  {
    year: 2035,
    work: "I, Robot",
    type: "film",
    description:
      "Le film I, Robot (2004) se déroule en 2035 à Chicago, où les robots obéissant aux lois de la robotique d'Asimov font partie du quotidien.",
    wikiTitle: "I, Robot (film)",
  },
  {
    year: 2038,
    work: "Detroit: Become Human",
    type: "jeu vidéo",
    description:
      "Le jeu vidéo Detroit: Become Human (2018) se déroule en 2038 à Detroit, où des androïdes commencent à développer une conscience propre.",
    wikiTitle: "Detroit: Become Human",
  },
  {
    year: 2045,
    work: "Ready Player One",
    type: "roman",
    description:
      "Dans Ready Player One (Ernest Cline, 2011), l'humanité de 2045 passe l'essentiel de son temps dans l'univers virtuel de l'OASIS.",
    wikiTitle: "Ready Player One",
  },
  {
    year: 2049,
    work: "Blade Runner 2049",
    type: "film",
    description:
      "Le film Blade Runner 2049 (2017) se déroule à Los Angeles en 2049, trente ans après les événements du premier Blade Runner.",
    wikiTitle: "Blade Runner 2049",
  },
  {
    year: 2054,
    work: "Minority Report",
    type: "film",
    description:
      "Le film Minority Report (2002) se déroule en 2054 à Washington D.C., où la police utilise des « précogs » pour prévenir les crimes avant qu'ils n'aient lieu.",
    wikiTitle: "Minority Report (film)",
  },
  {
    year: 2077,
    work: "Cyberpunk 2077",
    type: "jeu vidéo",
    description:
      "Le jeu vidéo Cyberpunk 2077 (2020) se déroule en 2077 à Night City, mégalopole dominée par les corporations et les implants cybernétiques.",
    wikiTitle: "Cyberpunk 2077",
  },
  {
    year: 2154,
    work: "Elysium",
    type: "film",
    description:
      "Le film Elysium (2013) se déroule en 2154 : les plus riches vivent sur une station spatiale luxueuse en orbite, loin d'une Terre surpeuplée.",
    wikiTitle: "Elysium (film)",
  },
];
