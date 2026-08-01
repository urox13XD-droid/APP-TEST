import { NextRequest, NextResponse } from "next/server";
import { getArticleSummary, wikipediaSearchUrl } from "@/lib/wikipedia";
import type { SummaryApiResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title")?.trim();
  if (!title) {
    return NextResponse.json({ error: "Paramètre 'title' requis." }, { status: 400 });
  }

  const summary = await getArticleSummary(title);

  const body: SummaryApiResponse = summary ?? {
    title,
    extract: "Résumé indisponible pour cet article -- essaie la recherche Wikipédia ci-dessous.",
    wikipediaUrl: wikipediaSearchUrl(title),
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
