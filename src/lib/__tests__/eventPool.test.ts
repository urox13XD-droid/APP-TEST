import { describe, expect, it } from "vitest";
import { resolveYearEvent, type GetYearEventsFn } from "../eventPool";
import type { FictionalDate } from "../fictionalDates";

const CURRENT_YEAR = 2026;

function fakeEvents(byYear: Record<number, { text: string; linkTitle: string | null }[]>): GetYearEventsFn {
  return async (year: number) => byYear[year] ?? [];
}

describe("resolveYearEvent", () => {
  it("returns the year-zero fallback without calling getYearEvents", async () => {
    let called = false;
    const getYearEvents: GetYearEventsFn = async () => {
      called = true;
      return [];
    };
    const result = await resolveYearEvent(0, CURRENT_YEAR, "2026-08-01", getYearEvents);
    expect(called).toBe(false);
    expect(result.item?.source).toBe("historique");
    expect(result.isFuture).toBe(false);
  });

  it("marks a past year's event as 'historique' and never adds fiction", async () => {
    const getYearEvents = fakeEvents({ 1945: [{ text: "Fin de la guerre.", linkTitle: "Seconde Guerre mondiale" }] });
    const result = await resolveYearEvent(1945, CURRENT_YEAR, "2026-08-01", getYearEvents, [
      { year: 1945, work: "Test", type: "film", description: "devrait ne jamais apparaître" },
    ]);
    expect(result.isFuture).toBe(false);
    expect(result.item?.source).toBe("historique");
    expect(result.item?.headline).toBe("Fin de la guerre.");
  });

  it("marks a future year's Wikipedia event as 'prevision'", async () => {
    const getYearEvents = fakeEvents({ 2030: [{ text: "Un événement prévu.", linkTitle: "Sujet" }] });
    const result = await resolveYearEvent(2030, CURRENT_YEAR, "2026-08-01", getYearEvents, []);
    expect(result.isFuture).toBe(true);
    expect(result.item?.source).toBe("prevision");
  });

  it("uses a fictional date to fill a future year with no real Wikipedia data", async () => {
    const getYearEvents = fakeEvents({});
    const fiction: FictionalDate[] = [
      { year: 2049, work: "Blade Runner 2049", type: "film", description: "Se déroule en 2049." },
    ];
    const result = await resolveYearEvent(2049, CURRENT_YEAR, "2026-08-01", getYearEvents, fiction);
    expect(result.item?.source).toBe("fiction");
    expect(result.item?.fictionWork).toBe("Blade Runner 2049");
  });

  it("combines real predicted events and fiction into one rotation pool for future years", async () => {
    const getYearEvents = fakeEvents({ 2049: [{ text: "Éclipse prévue.", linkTitle: "Éclipse" }] });
    const fiction: FictionalDate[] = [
      { year: 2049, work: "Blade Runner 2049", type: "film", description: "Se déroule en 2049." },
    ];
    // Try every day of a month; both sources should show up across the rotation.
    const seenSources = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const iso = `2026-03-${String(day).padStart(2, "0")}`;
      const result = await resolveYearEvent(2049, CURRENT_YEAR, iso, getYearEvents, fiction);
      seenSources.add(result.item!.source);
    }
    expect(seenSources.has("prevision")).toBe(true);
    expect(seenSources.has("fiction")).toBe(true);
  });

  it("returns item: null when nothing is available at all", async () => {
    const getYearEvents = fakeEvents({});
    const result = await resolveYearEvent(2301, CURRENT_YEAR, "2026-08-01", getYearEvents, []);
    expect(result.item).toBeNull();
    expect(result.isFuture).toBe(true);
  });

  it("returns item: null for a past year with no recorded events, without fiction leaking in", async () => {
    const getYearEvents = fakeEvents({});
    const result = await resolveYearEvent(5, CURRENT_YEAR, "2026-08-01", getYearEvents, [
      { year: 5, work: "Ne devrait pas s'afficher", type: "roman", description: "..." },
    ]);
    expect(result.item).toBeNull();
  });

  it("is deterministic: same year+date always yields the same item", async () => {
    const getYearEvents = fakeEvents({
      1789: [
        { text: "Prise de la Bastille.", linkTitle: "Prise de la Bastille" },
        { text: "Déclaration des droits de l'homme.", linkTitle: "DDHC" },
      ],
    });
    const a = await resolveYearEvent(1789, CURRENT_YEAR, "2026-07-14", getYearEvents);
    const b = await resolveYearEvent(1789, CURRENT_YEAR, "2026-07-14", getYearEvents);
    expect(a.item?.headline).toBe(b.item?.headline);
  });
});
