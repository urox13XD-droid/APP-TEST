import { NextRequest, NextResponse } from "next/server";
import { getArticleSummary, wikipediaSearchUrl } from "@/lib/wikipedia";
import { generateGroundedSummary } from "@/lib/aiSummary";
import type { SummaryApiResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const title = params.get("title")?.trim();
  const headline = params.get("headline")?.trim();
  const year = Number(params.get("year"));
  if (!title) {
    return NextResponse.json({ error: "Paramètre 'title' requis." }, { status: 400 });
  }

  const wikiSummary = await getArticleSummary(title);

  // Ground the AI summary in the headline (which is what the app actually
  // showed the user and is known-accurate) rather than the Wikipedia
  // extract alone, since the linked article is sometimes about a related
  // but different topic than the specific dated event.
  const aiExtract =
    headline && Number.isInteger(year)
      ? await generateGroundedSummary({ headline, year, wikiExtract: wikiSummary?.extract ?? null })
      : null;

  const body: SummaryApiResponse = aiExtract
    ? {
        title: wikiSummary?.title ?? title,
        extract: aiExtract,
        wikipediaUrl: wikiSummary?.wikipediaUrl ?? wikipediaSearchUrl(title),
        aiGenerated: true,
      }
    : wikiSummary
      ? { ...wikiSummary, aiGenerated: false }
      : {
          title,
          extract: "Résumé indisponible pour cet article -- essaie la recherche Wikipédia ci-dessous.",
          wikipediaUrl: wikipediaSearchUrl(title),
          aiGenerated: false,
        };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
