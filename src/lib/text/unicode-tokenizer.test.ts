import { describe, expect, it } from "vitest";
import {
  containsTokenSequence,
  countUnicodeWords,
  hasAnyWordOrPhrase,
  tokenizeUnicodeWords,
} from "./unicode-tokenizer";

describe("Unicode tokenizer", () => {
  it("segments Cyrillic words across punctuation and normalizes Russian yo", () => {
    expect(tokenizeUnicodeWords("Строить, исследовать — и беречь Ёлку!"))
      .toEqual(["строить", "исследовать", "и", "беречь", "елку"]);
  });

  it("segments English hyphenated phrases and numbers consistently", () => {
    expect(tokenizeUnicodeWords("A co-op match-3 game"))
      .toEqual(["a", "co", "op", "match", "3", "game"]);
  });

  it("matches whole words and multi-word phrases without substring matches", () => {
    const tokens = tokenizeUnicodeWords("Жанр «защита башен» with steam engine and history");

    expect(containsTokenSequence(tokens, "защита башен")).toBe(true);
    expect(hasAnyWordOrPhrase(tokens, ["team"])).toBe(false);
    expect(hasAnyWordOrPhrase(tokens, ["story"])).toBe(false);
  });

  it("counts words rather than whitespace-separated chunks", () => {
    expect(countUnicodeWords("Гонка—головоломка: co-op/match-3"))
      .toBe(6);
  });
});
