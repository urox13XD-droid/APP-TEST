import { describe, expect, it } from "vitest";
import { dailyRotationIndex, formatHHMM, hourMinuteToYear, todayISO } from "../dateMath";

describe("hourMinuteToYear", () => {
  it("maps 16:04 to 1604", () => {
    expect(hourMinuteToYear({ hour: 16, minute: 4 })).toBe(1604);
  });
  it("maps 00:04 to 4 (no leading-zero padding as a number)", () => {
    expect(hourMinuteToYear({ hour: 0, minute: 4 })).toBe(4);
  });
  it("maps 00:00 to 0", () => {
    expect(hourMinuteToYear({ hour: 0, minute: 0 })).toBe(0);
  });
  it("maps 23:59 to 2359 (max possible value)", () => {
    expect(hourMinuteToYear({ hour: 23, minute: 59 })).toBe(2359);
  });
});

describe("formatHHMM", () => {
  it("zero-pads both hour and minute", () => {
    expect(formatHHMM({ hour: 4, minute: 7 })).toBe("04h07");
  });
});

describe("todayISO", () => {
  it("uses local date fields, not UTC", () => {
    const d = new Date(2026, 0, 5); // Jan 5 2026, local time
    expect(todayISO(d)).toBe("2026-01-05");
  });
});

describe("dailyRotationIndex", () => {
  it("is stable for the same (year, date) pair", () => {
    const a = dailyRotationIndex(1945, "2026-08-01", 5);
    const b = dailyRotationIndex(1945, "2026-08-01", 5);
    expect(a).toBe(b);
  });

  it("changes across different dates (for at least one of many days)", () => {
    const results = new Set<number>();
    for (let day = 1; day <= 28; day++) {
      const iso = `2026-01-${String(day).padStart(2, "0")}`;
      results.add(dailyRotationIndex(1945, iso, 7));
    }
    expect(results.size).toBeGreaterThan(1);
  });

  it("always returns an index within [0, count)", () => {
    for (let i = 0; i < 50; i++) {
      const idx = dailyRotationIndex(i * 37, `2026-0${(i % 9) + 1}-15`, 3);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(3);
    }
  });

  it("returns 0 for a pool of size 1", () => {
    expect(dailyRotationIndex(2049, "2026-08-01", 1)).toBe(0);
  });

  it("returns 0 for an empty pool instead of throwing", () => {
    expect(dailyRotationIndex(2049, "2026-08-01", 0)).toBe(0);
  });
});
