"use client";

import { useState } from "react";
import type { EventApiResponse, SummaryApiResponse } from "@/lib/types";

const SOURCE_LABEL: Record<string, string> = {
  historique: "Historique",
  prevision: "Prévision",
  fiction: "Fiction",
};

const SOURCE_STYLE: Record<string, string> = {
  historique: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  prevision: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  fiction: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

interface Props {
  data: EventApiResponse | null;
  loading: boolean;
  error: string | null;
}

export default function EventCard({ data, loading, error }: Props) {
  const event = data?.event ?? null;

  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<SummaryApiResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  async function handleToggle() {
    if (!event) return;
    const next = !expanded;
    setExpanded(next);
    if (next && !summary && !summaryLoading) {
      if (!event.wikiTitle) {
        setSummaryError("Pas de résumé disponible pour cet événement.");
        return;
      }
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const res = await fetch(`/api/summary?title=${encodeURIComponent(event.wikiTitle)}`);
        if (!res.ok) throw new Error("Échec de la récupération du résumé.");
        setSummary(await res.json());
      } catch {
        setSummaryError("Impossible de charger le résumé pour le moment.");
      } finally {
        setSummaryLoading(false);
      }
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-md animate-pulse rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/50">
        Recherche de l&apos;anecdote…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-center text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!data || !event) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/50">
        {data ? `Aucune donnée connue pour l'an ${data.year} pour le moment.` : ""}
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <button
        onClick={handleToggle}
        className="w-full rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition-colors hover:bg-white/10"
      >
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${SOURCE_STYLE[event.source] ?? ""}`}
        >
          {SOURCE_LABEL[event.source] ?? event.source}
          {event.fictionWork ? ` · ${event.fictionWork}` : ""}
        </span>
        <p className={`mt-2 text-base leading-snug text-white/90 ${expanded ? "" : "line-clamp-1"}`}>
          {event.headline}
        </p>
        <p className="mt-2 text-xs text-white/40">{expanded ? "Toucher pour réduire ▲" : "Toucher pour en savoir plus ▼"}</p>
      </button>

      {expanded && (
        <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-5 text-sm text-white/80">
          {summaryLoading && <p className="text-white/50">Chargement du résumé…</p>}
          {summaryError && <p className="text-white/50">{summaryError}</p>}
          {summary && (
            <>
              <p className="leading-relaxed">{summary.extract}</p>
              <a
                href={summary.wikipediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block text-sky-300 underline decoration-sky-300/40 underline-offset-4 hover:text-sky-200"
              >
                Lire l&apos;article complet sur Wikipédia →
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}
