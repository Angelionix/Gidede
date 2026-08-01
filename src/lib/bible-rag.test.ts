import { describe, expect, it } from "vitest";
import { searchBible } from "@/lib/bible-rag";

describe("Bible RAG provenance — R3-09", () => {
  it("returns stable public source IDs without absolute filesystem paths", async () => {
    const first = await searchBible("MDA mechanics dynamics aesthetics", 3);
    const second = await searchBible("MDA mechanics dynamics aesthetics", 3);

    expect(first.results.length).toBeGreaterThan(0);
    expect(first.results.map((result) => result.sourceId)).toEqual(
      second.results.map((result) => result.sourceId)
    );
    for (const result of first.results) {
      expect(result.sourceId).toMatch(/^bible:bible_2_[a-z0-9_-]+:chunk-\d+$/);
      expect(result.source).toMatch(/^docs\/bible\/bible_2_.+\.md$/);
      expect(result.source).not.toMatch(/^[A-Z]:\\/i);
    }
  });
});
