import { afterEach, describe, expect, it } from "vitest";
import { generateGroundedSummary } from "../aiSummary";

describe("generateGroundedSummary", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns null when no API key is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const result = await generateGroundedSummary({
      headline: "Un événement.",
      year: 1969,
      wikiExtract: null,
    });
    expect(result).toBeNull();
  });

  it("never throws even if the client would fail to construct", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    await expect(
      generateGroundedSummary({ headline: "Un événement.", year: 1969, wikiExtract: null })
    ).resolves.toBeNull();
  });
});
