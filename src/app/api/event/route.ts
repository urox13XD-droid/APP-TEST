import { NextRequest, NextResponse } from "next/server";
import { hourMinuteToYear, formatHHMM } from "@/lib/dateMath";
import { resolveYearEvent } from "@/lib/eventPool";
import { getYearEvents } from "@/lib/wikipedia";
import type { EventApiResponse } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const hour = Number(params.get("hour"));
  const minute = Number(params.get("minute"));
  const date = params.get("date") ?? "";

  if (
    !Number.isInteger(hour) || hour < 0 || hour > 23 ||
    !Number.isInteger(minute) || minute < 0 || minute > 59 ||
    !DATE_RE.test(date)
  ) {
    return NextResponse.json({ error: "Paramètres invalides (hour 0-23, minute 0-59, date YYYY-MM-DD requis)." }, { status: 400 });
  }

  const year = hourMinuteToYear({ hour, minute });
  const currentYear = Number(date.slice(0, 4));

  const { isFuture, item } = await resolveYearEvent(year, currentYear, date, getYearEvents);

  const body: EventApiResponse = {
    year,
    hhmm: formatHHMM({ hour, minute }),
    isFuture,
    event: item
      ? {
          headline: item.headline,
          source: item.source,
          fictionWork: item.fictionWork,
          fictionType: item.fictionType,
          wikiTitle: item.wikiTitle,
        }
      : null,
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
