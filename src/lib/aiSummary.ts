/**
 * Turns a Wikipedia-sourced event headline into a short, focused summary
 * written for this app -- grounded in the exact headline (and, when
 * available, a Wikipedia extract for extra context) rather than just
 * returning Wikipedia's own article intro, which often drifts to whatever
 * the first linked article happens to be about instead of the dated event
 * itself.
 *
 * Returns null (never throws) whenever generation isn't possible -- no API
 * key configured, or the request fails -- so callers can fall back to the
 * plain Wikipedia extract.
 */
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey }) : null;
}

export interface GroundedSummaryInput {
  headline: string;
  year: number;
  /** Wikipedia's own article extract for the linked title, if any -- may
   * describe a related but different topic than the headline itself; the
   * prompt is written to treat it as optional background, not ground truth. */
  wikiExtract: string | null;
}

export async function generateGroundedSummary({
  headline,
  year,
  wikiExtract,
}: GroundedSummaryInput): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  const context = wikiExtract
    ? `Extrait d'un article Wikipédia lié (peut porter sur un sujet connexe plutôt que sur l'événement précis -- à utiliser seulement s'il aide à comprendre le contexte) :\n"""\n${wikiExtract}\n"""`
    : "Aucun extrait Wikipédia disponible.";

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content:
            `Événement daté de l'année ${year}, tel que rapporté par Wikipédia : "${headline}"\n\n${context}\n\n` +
            "Rédige, en français, un résumé de 2 à 4 phrases qui explique cet événement précis (son contexte, ses causes ou ses conséquences). " +
            "Reste concentré sur cet événement précis -- ne dévie pas vers l'extrait ci-dessus s'il parle d'autre chose. " +
            "N'invente aucun fait qui ne soit pas déjà contenu dans l'énoncé de l'événement ou dans l'extrait fourni : si tu ne sais pas, reste général plutôt que d'inventer un détail. " +
            "Style neutre et informatif, pas de formule d'introduction du type \"Voici un résumé\".",
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    return text || null;
  } catch {
    return null;
  }
}
