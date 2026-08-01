"use client";

import { useEffect, useState } from "react";
import { formatHHMM, hourMinuteToYear, todayISO } from "@/lib/dateMath";
import type { EventApiResponse } from "@/lib/types";
import EventCard from "./EventCard";

export default function TimeDateApp() {
  // This component is only ever mounted client-side (see page.tsx's
  // ssr:false dynamic import), so it's safe to seed state with the real
  // clock immediately -- there is no server-rendered markup to mismatch.
  const [now, setNow] = useState<Date>(() => new Date());
  // When set, overrides the live clock so anyone can explore any HH:MM ->
  // any year, instead of waiting for the real time to land on one.
  const [manualTime, setManualTime] = useState<{ hour: number; minute: number } | null>(null);
  const [data, setData] = useState<EventApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hour = manualTime?.hour ?? now.getHours();
  const minute = manualTime?.minute ?? now.getMinutes();
  const key = `${hour}:${minute}`;
  // Derived, not stored: true only before the very first fetch settles.
  // Later refetches just swap `data` in place once ready, instead of
  // flashing a loading state every time the time changes.
  const loading = data === null && error === null;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      hour: String(hour),
      minute: String(minute),
      date: todayISO(now),
    });

    fetch(`/api/event?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Le serveur n'a pas pu récupérer l'anecdote.");
        return res.json();
      })
      .then((body: EventApiResponse) => {
        setData(body);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Connexion à Wikipédia impossible pour le moment.");
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 px-4 py-12 text-white">
      <div className="text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-white/40">Time Date</p>
        <p className="mt-4 font-mono text-6xl font-semibold tabular-nums sm:text-7xl">
          {formatHHMM({ hour, minute })}
        </p>
        <p className="mt-2 text-sm text-white/50">soit l&apos;an {hourMinuteToYear({ hour, minute })}</p>

        <div className="mt-4 flex items-center justify-center gap-3 text-sm text-white/50">
          <label className="flex items-center gap-2">
            <span>Explorer une autre heure :</span>
            <input
              type="time"
              value={`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                if (!Number.isNaN(h) && !Number.isNaN(m)) setManualTime({ hour: h, minute: m });
              }}
              className="rounded border border-white/20 bg-transparent px-2 py-1 text-white [color-scheme:dark]"
            />
          </label>
          {manualTime && (
            <button
              onClick={() => setManualTime(null)}
              className="underline decoration-white/40 underline-offset-4 hover:text-white"
            >
              Revenir à maintenant
            </button>
          )}
        </div>
      </div>

      {/* Remounts EventCard whenever the underlying event changes, so its
          expanded/summary state always starts fresh instead of showing a
          stale summary from a previously-picked time (React's recommended
          pattern for "reset state when a prop changes"). */}
      <EventCard
        key={data ? `${data.year}|${data.event?.wikiTitle ?? data.event?.headline ?? "none"}` : "none"}
        data={data}
        loading={loading}
        error={error}
      />
    </main>
  );
}
