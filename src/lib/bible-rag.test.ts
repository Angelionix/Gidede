/**
 * Unit tests for src/lib/bible-rag.ts — TF-IDF RAG over 12 Bible sections.
 *
 * The module is async and reads markdown files from `docs/bible/` at runtime,
 * so each test awaits the search/stats functions.
 */
import { describe, it, expect } from "vitest";
import { searchBible, getBibleStats } from "@/lib/bible-rag";

describe("getBibleStats", () => {
  it("returns { sections: 12, chunks: number, uniqueTerms: number }", async () => {
    const stats = await getBibleStats();
    expect(stats.sections).toBe(12);
    expect(stats.chunks).toBeGreaterThan(0);
    expect(typeof stats.uniqueTerms).toBe("number");
    expect(stats.uniqueTerms).toBeGreaterThan(0);
  });
});

describe("searchBible", () => {
  it("returns results with the expected shape (array of {section, score, ...})", async () => {
    const { results, total } = await searchBible("core loop", 5);
    expect(Array.isArray(results)).toBe(true);
    expect(typeof total).toBe("number");
    if (results.length > 0) {
      const r = results[0];
      expect(r).toHaveProperty("title");
      expect(r).toHaveProperty("snippet");
      expect(r).toHaveProperty("source");
      expect(r).toHaveProperty("section");
      expect(r).toHaveProperty("score");
      expect(typeof r.section).toBe("string");
      expect(typeof r.score).toBe("number");
      expect(r.score).toBeGreaterThan(0);
    }
  });

  it("empty query → returns empty results (results: [], total: 0)", async () => {
    // An empty string tokenizes to zero tokens, so the implementation
    // short-circuits with `{ results: [], total: 0 }`.
    const { results, total } = await searchBible("", 5);
    expect(results).toEqual([]);
    expect(total).toBe(0);
  });

  it("query of pure stopwords → returns empty results", async () => {
    // 'the and or' tokenizes to nothing after stopword removal.
    const { results, total } = await searchBible("the and or", 5);
    expect(results).toEqual([]);
    expect(total).toBe(0);
  });

  it("query 'core loop' → top result is the core-loop section (source contains 'core_loop' or '2_4', or section contains 'Core Loop' / '2.4')", async () => {
    const { results } = await searchBible("core loop", 5);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    const sectionMatches =
      top.section.toLowerCase().includes("core loop") ||
      top.section.includes("2.4");
    const sourceMatches =
      top.source.includes("core_loop") || top.source.includes("2_4");
    expect(sectionMatches || sourceMatches).toBe(true);
  });
});
