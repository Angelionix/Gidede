/**
 * Gidede — Triangle of Weirdness evaluator (Block 1, roadmap R4-05).
 *
 * Replaces the hardcoded `triangle_of_weirdness_check: "pass" | "warn" | "pass"`
 * on USP candidates with a real evaluation that derives the three Triangle
 * dimensions (weird, appealing, credible) from the actual properties of each
 * candidate USP text.
 *
 * Triangle of Weirdness (Schreiber): a concept is strong when it is
 * simultaneously weird (novel / cross-genre / unconventional), appealing
 * (understandable player benefit) and credible (realisable within the
 * genre/scope, without hyperbolic claims).
 *
 * Each dimension uses transparent keyword/phrase heuristics. The output is
 * deterministic and explainable — every boolean is backed by a concrete
 * signal in the USP text.
 */

export interface TriangleContext {
  /** Resolved verb phrase from the idea (e.g. "explore and survive"). */
  verbPhrase?: string;
  /** Resolved theme phrase (e.g. "the dark theme" or "an unconventional aesthetic direction"). */
  themePhrase?: string;
}

export interface TriangleEvaluation {
  /** Coarse pass/warn/fail label for backward-compatible USP candidate field. */
  check: "pass" | "warn" | "fail";
  /** Weird dimension: USP deviates from genre conventions (cross-genre / novelty). */
  weird: boolean;
  /** Appealing dimension: USP promises an understandable player benefit. */
  appealing: boolean;
  /** Credible dimension: USP is realisable, no hyperbolic claims, genre-aligned. */
  credible: boolean;
  /** Composite score in [0, 1]: 0.4 weird + 0.3 appealing + 0.3 credible. */
  score: number;
  /** Human-readable reason listing which signals fired. */
  reason: string;
}

const CROSS_GENRE_SIGNALS = [
  "hybrid", "blending", "blend", "fusion", "combining", "combine",
  "merges", "merge", "mixed", "cross-genre", "cross genre",
];

const NOVELTY_SIGNALS = [
  "novel", "unique", "unconventional", "emergent", "reshapes", "reshape",
  "revolutionary", "distinct identity", "unprecedented", "never before",
  "new kind", "fresh",
];

const PLAYER_BENEFIT_SIGNALS = [
  "player agency", "story through gameplay", "players experience",
  "players feel", "empowers", "engages", "player journey",
  "players shape", "player-driven",
]

const RESONANCE_SIGNALS = [
  "story", "narrative", "experience", "journey", "emotional",
  "immersive", "resonance",
]

/**
 * Phrases that signal hyperbolic / unrealisable claims. Presence of any of
 * these drops the credible dimension to false, because the USP overpromises
 * relative to what the genre and scope can deliver.
 */
const HYPERBOLIC_CLAIMS = [
  "every decision", "every choice", "every action", "every move",
  "infinite", "limitless", "endless", "unbounded",
  "never before seen", "revolutionary", "impossible", "always",
  "forever", "all of", "reshapes the world",
]

function lower(s: string): string {
  return s.toLowerCase();
}

function containsAny(text: string, signals: readonly string[]): string[] {
  const matched: string[] = [];
  for (const s of signals) {
    if (text.includes(s)) matched.push(s);
  }
  return matched;
}

/**
 * Evaluate the Triangle of Weirdness for a USP candidate text.
 *
 * @param usp      The USP candidate text to evaluate.
 * @param genre    The primary genre (used for genre-alignment check).
 * @param context  Optional resolved verb/theme phrases from the idea.
 */
export function evaluateTriangleOfWeirdness(
  usp: string,
  genre: string,
  context: TriangleContext = {},
): TriangleEvaluation {
  const text = lower(usp);
  const genreLower = lower(genre);

  // Weird: cross-genre fusion OR explicit novelty signal.
  const crossGenreHits = containsAny(text, CROSS_GENRE_SIGNALS);
  const noveltyHits = containsAny(text, NOVELTY_SIGNALS);
  const weird = crossGenreHits.length > 0 || noveltyHits.length > 0;
  const weirdSignals = [...crossGenreHits, ...noveltyHits];

  // Appealing: player benefit phrase OR concrete verb OR emotional resonance,
  // AND reasonable USP length (not too terse, not a paragraph).
  const benefitHits = containsAny(text, PLAYER_BENEFIT_SIGNALS);
  const hasConcreteVerb = typeof context.verbPhrase === "string" && context.verbPhrase.length >= 3;
  const resonanceHits = containsAny(text, RESONANCE_SIGNALS);
  const reasonableLength = usp.length >= 30 && usp.length <= 300;
  const appealing = reasonableLength && (benefitHits.length > 0 || hasConcreteVerb || resonanceHits.length > 0);
  const appealingSignals = [
    ...benefitHits,
    ...(hasConcreteVerb ? [`verb:"${context.verbPhrase}"`] : []),
    ...resonanceHits,
  ];

  // Credible: no hyperbolic claims AND genre alignment (genre keyword present
  // or genre is empty/unknown).
  const hyperbolicHits = containsAny(text, HYPERBOLIC_CLAIMS);
  const hasGenreMention = genreLower === "" || text.includes(genreLower);
  const credible = hyperbolicHits.length === 0 && hasGenreMention;
  const credibleSignals: string[] = [];
  if (hyperbolicHits.length > 0) credibleSignals.push(`hyperbolic:${hyperbolicHits.join(",")}`);
  if (!hasGenreMention) credibleSignals.push("no-genre-mention");

  const score = Number(
    ((weird ? 0.4 : 0.1) + (appealing ? 0.3 : 0.1) + (credible ? 0.3 : 0.1)).toFixed(2),
  );

  // Pass requires all three dimensions; warn if at least one; fail if none.
  const passed = weird && appealing && credible;
  const anyDim = weird || appealing || credible;
  const check: "pass" | "warn" | "fail" = passed
    ? "pass"
    : anyDim
    ? "warn"
    : "fail";

  const reason = [
    `weird=${weird} (${weirdSignals.length > 0 ? weirdSignals.join(",") : "—"})`,
    `appealing=${appealing} (${appealingSignals.length > 0 ? appealingSignals.join(",") : "—"})`,
    `credible=${credible} (${credibleSignals.length > 0 ? credibleSignals.join(",") : "ok"})`,
  ].join("; ");

  return {
    check,
    weird,
    appealing,
    credible,
    score,
    reason,
  };
}
