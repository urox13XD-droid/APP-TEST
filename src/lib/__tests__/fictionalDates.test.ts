import { describe, expect, it } from "vitest";
import { FICTIONAL_DATES } from "../fictionalDates";

describe("FICTIONAL_DATES", () => {
  it("has at least a handful of entries", () => {
    expect(FICTIONAL_DATES.length).toBeGreaterThanOrEqual(5);
  });

  it("every entry has a plausible 4-digit year within the app's range", () => {
    for (const entry of FICTIONAL_DATES) {
      expect(entry.year).toBeGreaterThanOrEqual(0);
      expect(entry.year).toBeLessThanOrEqual(2359);
    }
  });

  it("every entry has non-empty work/description and a valid type", () => {
    const validTypes = new Set(["film", "série", "roman", "jeu vidéo"]);
    for (const entry of FICTIONAL_DATES) {
      expect(entry.work.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(validTypes.has(entry.type)).toBe(true);
    }
  });

  it("every description actually mentions the work's title", () => {
    for (const entry of FICTIONAL_DATES) {
      expect(entry.description).toContain(entry.work);
    }
  });
});
