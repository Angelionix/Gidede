/**
 * Unicode-aware word tokenization shared by deterministic text heuristics.
 *
 * `Intl.Segmenter` provides locale-aware word boundaries for both Cyrillic and
 * Latin text. The Unicode-property fallback keeps the same contract in runtimes
 * where Segmenter is unavailable.
 */

let cachedSegmenter: Intl.Segmenter | null | undefined;

function normalizeWord(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replaceAll("ё", "е");
}

function getSegmenter(): Intl.Segmenter | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;

  cachedSegmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(["ru", "en"], { granularity: "word" })
    : null;

  return cachedSegmenter;
}

export function tokenizeUnicodeWords(text: string): string[] {
  const normalizedText = text.normalize("NFKC");
  const segmenter = getSegmenter();

  if (segmenter) {
    return Array.from(segmenter.segment(normalizedText))
      .filter((part) => part.isWordLike)
      .map((part) => normalizeWord(part.segment))
      .filter(Boolean);
  }

  return Array.from(
    normalizedText.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu),
    (match) => normalizeWord(match[0])
  );
}

export function countUnicodeWords(text: string): number {
  return tokenizeUnicodeWords(text).length;
}

export function containsTokenSequence(
  tokens: readonly string[],
  phrase: string
): boolean {
  const phraseTokens = tokenizeUnicodeWords(phrase);
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) return false;

  outer: for (let start = 0; start <= tokens.length - phraseTokens.length; start += 1) {
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      if (tokens[start + offset] !== phraseTokens[offset]) continue outer;
    }
    return true;
  }

  return false;
}

export function hasAnyWordOrPhrase(
  textOrTokens: string | readonly string[],
  keywords: readonly string[]
): boolean {
  const tokens = typeof textOrTokens === "string"
    ? tokenizeUnicodeWords(textOrTokens)
    : textOrTokens;

  return keywords.some((keyword) => containsTokenSequence(tokens, keyword));
}

export function countWordOrPhraseMatches(
  textOrTokens: string | readonly string[],
  keywords: readonly string[]
): number {
  const tokens = typeof textOrTokens === "string"
    ? tokenizeUnicodeWords(textOrTokens)
    : textOrTokens;

  return keywords.reduce(
    (count, keyword) => count + Number(containsTokenSequence(tokens, keyword)),
    0
  );
}

export function hasAnyTokenPrefix(
  textOrTokens: string | readonly string[],
  prefixes: readonly string[]
): boolean {
  const tokens = typeof textOrTokens === "string"
    ? tokenizeUnicodeWords(textOrTokens)
    : textOrTokens;
  const normalizedPrefixes = prefixes
    .map(normalizeWord)
    .filter((prefix) => prefix.length >= 3);

  return tokens.some((token) =>
    normalizedPrefixes.some((prefix) => token.startsWith(prefix))
  );
}
