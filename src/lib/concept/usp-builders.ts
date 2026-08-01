/**
 * Gidede — USP candidate builder (Block 1, roadmap R4-05).
 *
 * Extracted from /api/v1/concept/generate/route.ts for testability. Builds
 * three USP candidates from the genre and idea, and evaluates each one
 * through the real Triangle of Weirdness evaluator (no hardcoded results).
 */

import { evaluateTriangleOfWeirdness, type TriangleEvaluation } from "@/lib/concept/triangle-check";

export interface USPCandidate {
  usp: string;
  /** Coarse pass/warn/fail label (backward-compatible with existing UI/contract). */
  triangle_of_weirdness_check: "pass" | "warn" | "fail";
  /** Structured Triangle breakdown for UI transparency. */
  triangle_check: TriangleEvaluation;
  competitive_differentiation: string;
}

/**
 * Build three USP candidates from the genre and idea. Each candidate is
 * evaluated through the real Triangle of Weirdness evaluator, so the
 * `triangle_of_weirdness_check` field reflects actual USP properties
 * rather than a hardcoded "pass"|"warn"|"pass" sequence.
 *
 * @param genre  The primary genre selected for the concept.
 * @param idea   The raw idea text supplied by the user.
 */
export function buildUSPCandidates(genre: string, idea: string): USPCandidate[] {
  const lower = idea.toLowerCase();

  // Extract first 2-3 "core verbs" from the idea (lowercased) — used for USP #3.
  const coreVerbs = lower
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !["the", "and", "for", "with", "that", "this"].includes(w))
    .slice(0, 2)
    .join(" ");
  const verbPhrase = coreVerbs.length >= 3 ? coreVerbs : "explore and survive";

  // Safe idea excerpt: never empty, always meaningful (min 20 chars).
  const ideaExcerpt = (maxLen: number, offset = 0) => {
    const slice = idea.slice(offset, offset + maxLen).trim();
    if (slice.length < 20) {
      return idea.trim().length > 0 ? idea.trim() : "an unexplored concept";
    }
    return slice + (idea.length > offset + maxLen ? "…" : "");
  };

  // Detect theme keywords for thematic USP
  const themeKeywords = ["dark", "light", "future", "past", "dream", "war", "peace", "magic", "tech", "nature"];
  const detectedTheme = themeKeywords.find((k) => lower.includes(k));
  const themePhrase = detectedTheme
    ? `the "${detectedTheme}" theme`
    : "an unconventional aesthetic direction";

  const triangleContext = { verbPhrase, themePhrase };

  const entries: Array<{ usp: string; competitive_differentiation: string }> = [
    {
      usp: `A ${genre} game where every decision reshapes the world — combining "${ideaExcerpt(60)}" with emergent narrative consequences.`,
      competitive_differentiation:
        "No competitor merges player agency with persistent world mutation at this scale.",
    },
    {
      usp: `Hybrid ${genre} experience blending traditional mechanics with novel systems derived from "${ideaExcerpt(50)}".`,
      competitive_differentiation:
        "Differentiator is mechanical fusion; similar genre games lack this hybrid layer.",
    },
    {
      usp: `Narrative-driven ${genre} where the core verb is "${verbPhrase}" and the experience leans on ${themePhrase} — players experience story through gameplay, not cutscenes.`,
      competitive_differentiation:
        "Ludonarrative harmony creates a distinct identity vs. story-light competitors.",
    },
  ];

  return entries.map(({ usp, competitive_differentiation }) => {
    const triangle = evaluateTriangleOfWeirdness(usp, genre, triangleContext);
    return {
      usp,
      triangle_of_weirdness_check: triangle.check,
      triangle_check: triangle,
      competitive_differentiation,
    };
  });
}
