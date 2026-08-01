/**
 * Gidede — Concept feasibility model (Block 1, roadmap R4-03).
 *
 * Replaces the legacy compatibility-only feasibility heuristic with a
 * composite, explainable model that responds to team/budget/platform/scope
 * constraints. Each active constraint contributes a weighted sub-score and a
 * human-readable reason, so changing constraints produces a traceable change
 * in the feasibility score and explanation.
 *
 * Design principles:
 *   - Deterministic: same inputs always produce the same score and reasons.
 *   - Explainable: every score comes with a per-factor breakdown and a
 *     targeted improvement recommendation driven by the weakest factor.
 *   - Honest defaults: when a constraint is unspecified, the model uses a
 *     neutral default that is explicitly labelled `source: "default"` so
 *     consumers can distinguish evidence-backed scores from assumptions.
 *   - Backward compatible: when NO constraints are supplied at all, the
 *     legacy compatibility-only score is returned so existing behaviour and
 *     snapshots are preserved. As soon as any constraint is provided, the
 *     composite model takes over.
 */

export interface FeasibilityConstraints {
  /** Number of people who will implement the game (developers, artists, designers). */
  team_size?: number;
  /** Free-form budget string — parsed for tier keywords and currency amounts. */
  budget?: string;
  /** Target platforms (e.g. "PC", "web", "mobile", "PlayStation", "Switch"). */
  platform?: string[];
}

export interface FeasibilityFactor {
  /** Stable machine-readable factor name. */
  name:
    | "mechanics_compatibility"
    | "team_capacity"
    | "budget"
    | "platform_complexity";
  /** Factor score in [0, 1]. */
  score: number;
  /** Factor weight in [0, 1]; weights of all factors sum to 1. */
  weight: number;
  /** Precomputed `score * weight` for transparency in UI/audit. */
  contribution: number;
  /** Human-readable explanation of how the score was derived. */
  reason: string;
  /** Whether the constraint was explicitly provided or fell back to default. */
  source: "specified" | "default";
}

export interface FeasibilityResult {
  /** Composite feasibility score in [0, 1]. */
  score: number;
  /** Per-factor breakdown. */
  factors: FeasibilityFactor[];
  /** Aggregated human-readable reason referencing active factors. */
  reason: string;
  /** Targeted improvement recommendation driven by the weakest factor. */
  improvement: string;
  /** Whether the composite model was used (true) or the legacy compat-only fallback (false). */
  composite: boolean;
}

export interface MechanicSetForFeasibility {
  total_count: number;
  compatibility_score: number;
}

/** Per-platform implementation complexity (1 = trivial, 0 = very hard). */
const PLATFORM_COMPLEXITY: Record<string, number> = {
  web: 0.9,
  browser: 0.9,
  html5: 0.9,
  mobile: 0.8,
  ios: 0.8,
  android: 0.8,
  tablet: 0.8,
  pc: 0.7,
  steam: 0.7,
  mac: 0.7,
  macos: 0.7,
  windows: 0.7,
  linux: 0.7,
  desktop: 0.7,
  switch: 0.6,
  nintendo: 0.6,
  console: 0.5,
  playstation: 0.5,
  ps5: 0.5,
  ps4: 0.5,
  xbox: 0.5,
  series_x: 0.5,
  series_s: 0.5,
  vr: 0.4,
  ar: 0.4,
  mixed_reality: 0.4,
};

const BUDGET_TIER_SCORE: Record<BudgetTier, number> = {
  low: 0.5,
  medium: 0.75,
  high: 0.9,
  unspecified: 0.65,
};

type BudgetTier = "low" | "medium" | "high" | "unspecified";

interface ParsedBudget {
  tier: BudgetTier;
  amount?: number;
  currency?: string;
}

/**
 * Parse a free-form budget string into a tier.
 *
 * Recognised patterns (case-insensitive):
 *   - Explicit tier keywords: "low", "indie", "bootstrapped", "medium", "aa",
 *     "high", "aaa", "triple-a", "well-funded".
 *   - Currency amounts: "$50k", "$1.5M", "100000", "£200,000", "1M rub".
 *     Supports thousands separators (`,` or `.` between 3-digit groups) and
 *     k/m suffixes.
 *
 * Returns `unspecified` when the string is empty or no pattern matches.
 */
export function parseBudget(budget?: string): ParsedBudget {
  if (!budget || !budget.trim()) return { tier: "unspecified" };
  const lower = budget.toLowerCase();

  // Explicit tier keywords.
  if (/\b(low|indie|bootstrapped|self[- ]?funded|small|micro)\b/.test(lower)) {
    return { tier: "low" };
  }
  if (/\b(medium|mid|aa|double[- ]?a|mid[- ]?tier)\b/.test(lower)) {
    return { tier: "medium" };
  }
  if (/\b(high|aaa|triple[- ]?a|big|well[- ]?funded|large)\b/.test(lower)) {
    return { tier: "high" };
  }

  // Currency symbol/prefix.
  const currencyMatch = lower.match(/([$€£¥]|usd|eur|gbp|jpy|rub)\b/);
  const currency = currencyMatch?.[1];

  // Try k/m suffix first — handles "$1.5M", "$25k".
  const suffixMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*([km])\b/);
  if (suffixMatch) {
    const n = parseFloat(suffixMatch[1].replace(",", "."));
    const amount = n * (suffixMatch[2] === "k" ? 1_000 : 1_000_000);
    return tierFromAmount(amount, currency);
  }

  // Plain number with optional thousands separators — handles "100000",
  // "500,000", "1.000.000" (European), "200,000".
  const numMatch = lower.match(/\d{1,3}(?:[.,]\d{3})+|\d+/);
  if (numMatch) {
    // Strip thousands separators (., between digit groups). When only one
    // separator is present and it's followed by exactly 1-2 digits, treat
    // it as a decimal separator instead (e.g. "1.5" without suffix).
    const raw = numMatch[0];
    const sepCount = (raw.match(/[.,]/g) || []).length;
    let amount: number;
    if (sepCount === 1 && /[,.]\d{1,2}$/.test(raw)) {
      // Decimal separator (e.g. "1.5" → 1.5).
      amount = parseFloat(raw.replace(",", "."));
    } else {
      // Thousands separators — strip them and parse as integer.
      amount = parseInt(raw.replace(/[.,]/g, ""), 10);
    }
    if (Number.isFinite(amount)) {
      return tierFromAmount(amount, currency);
    }
  }

  return { tier: "unspecified" };
}

function tierFromAmount(amount: number, currency?: string): ParsedBudget {
  if (amount < 50_000) return { tier: "low", amount, currency };
  if (amount < 1_000_000) return { tier: "medium", amount, currency };
  return { tier: "high", amount, currency };
}

/** Legacy compatibility-only score, used when no constraints are supplied. */
function legacyCompatScore(compatibility: number): number {
  if (compatibility >= 80) return 0.9;
  if (compatibility >= 60) return 0.75;
  if (compatibility >= 40) return 0.55;
  return 0.4;
}

function hasAnyConstraint(c: FeasibilityConstraints): boolean {
  return (
    (typeof c.team_size === "number" && c.team_size > 0)
    || (typeof c.budget === "string" && c.budget.trim().length > 0)
    || (Array.isArray(c.platform) && c.platform.some((p) => typeof p === "string" && p.trim().length > 0))
  );
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Compute a composite, explainable feasibility score from mechanic set and
 * project constraints.
 *
 * @param mechanicSet  Selected mechanic set (total_count + compatibility_score).
 * @param constraints  Optional project constraints (team_size, budget, platform).
 * @returns FeasibilityResult with score, per-factor breakdown, reason and improvement.
 */
export function computeFeasibility(
  mechanicSet: MechanicSetForFeasibility,
  constraints: FeasibilityConstraints = {},
): FeasibilityResult {
  const compatibility = mechanicSet.compatibility_score;
  const mechCount = mechanicSet.total_count;

  // Backward compatibility: when no constraints are supplied, return the
  // legacy compatibility-only score so existing snapshots/tests stay stable.
  if (!hasAnyConstraint(constraints)) {
    const legacy = legacyCompatScore(compatibility);
    const reason = `Совместимость механик ${compatibility}% → ${legacy} (без указанных constraints)`;
    const improvement = legacy < 0.6
      ? "Сократите scope или добавьте чёткий MVP slice"
      : "Укажите team_size, budget и platform для более точной оценки реализуемости";
    return {
      score: round2(legacy),
      factors: [
        {
          name: "mechanics_compatibility",
          score: legacy,
          weight: 1,
          contribution: legacy,
          reason,
          source: "specified",
        },
      ],
      reason,
      improvement,
      composite: false,
    };
  }

  // Factor 1 — mechanics compatibility (always present, weight 0.35).
  const compatScore = legacyCompatScore(compatibility);
  const compatFactor: FeasibilityFactor = {
    name: "mechanics_compatibility",
    score: compatScore,
    weight: 0.35,
    contribution: compatScore * 0.35,
    reason: `Совместимость механик ${compatibility}% → ${compatScore}`,
    source: "specified",
  };

  // Factor 2 — team capacity: mechanics per developer.
  let teamFactor: FeasibilityFactor;
  if (typeof constraints.team_size === "number" && constraints.team_size > 0) {
    const mechPerDev = mechCount / constraints.team_size;
    let s: number;
    if (mechPerDev <= 3) s = 0.9;
    else if (mechPerDev <= 6) s = 0.75;
    else if (mechPerDev <= 10) s = 0.55;
    else s = 0.35;
    teamFactor = {
      name: "team_capacity",
      score: s,
      weight: 0.25,
      contribution: s * 0.25,
      reason: `${mechCount} механик / ${constraints.team_size} чел. = ${mechPerDev.toFixed(1)} мех./чел. → ${s}`,
      source: "specified",
    };
  } else {
    teamFactor = {
      name: "team_capacity",
      score: 0.65,
      weight: 0.25,
      contribution: 0.65 * 0.25,
      reason: `team_size не указан → нейтральный 0.65 (предполагается малая команда на ${mechCount} механик)`,
      source: "default",
    };
  }

  // Factor 3 — budget tier.
  const budget = parseBudget(constraints.budget);
  const budgetScore = BUDGET_TIER_SCORE[budget.tier];
  const budgetReason = budget.tier === "unspecified"
    ? "budget не указан → нейтральный 0.65"
    : `budget tier "${budget.tier}"${budget.amount ? ` (~${budget.currency ?? ""}${budget.amount.toLocaleString("en-US")})` : ""} → ${budgetScore}`;
  const budgetFactor: FeasibilityFactor = {
    name: "budget",
    score: budgetScore,
    weight: 0.2,
    contribution: budgetScore * 0.2,
    reason: budgetReason,
    source: budget.tier === "unspecified" ? "default" : "specified",
  };

  // Factor 4 — platform complexity.
  let platformFactor: FeasibilityFactor;
  const platforms = (constraints.platform ?? [])
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter((p) => p.length > 0);
  if (platforms.length === 0) {
    platformFactor = {
      name: "platform_complexity",
      score: 0.75,
      weight: 0.2,
      contribution: 0.75 * 0.2,
      reason: "platform не указан → нейтральный 0.75 (предполагается PC)",
      source: "default",
    };
  } else {
    const scores = platforms.map((p) => {
      const key = p.toLowerCase().trim();
      return PLATFORM_COMPLEXITY[key] ?? 0.6;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const multiPenalty = Math.max(0, (platforms.length - 1) * 0.05);
    const s = clamp01(avg - multiPenalty);
    platformFactor = {
      name: "platform_complexity",
      score: s,
      weight: 0.2,
      contribution: s * 0.2,
      reason: `${platforms.length} платформ(а/ы) [${platforms.join(", ")}] → ${s}`,
      source: "specified",
    };
  }

  const factors = [compatFactor, teamFactor, budgetFactor, platformFactor];
  const total = factors.reduce((sum, f) => sum + f.contribution, 0);
  const score = round2(clamp01(total));

  // Aggregate reason — prefer specified factors, fall back to defaults.
  const reasonParts = factors
    .filter((f) => f.source === "specified")
    .map((f) => f.reason);
  const reason = reasonParts.length > 0
    ? reasonParts.join("; ")
    : "Все constraints не указаны — оценка только по совместимости механик";

  // Improvement — driven by the weakest specified factor; if all defaults,
  // recommend providing constraints.
  const weakest = [...factors].sort((a, b) => a.score - b.score)[0];
  let improvement: string;
  if (weakest.source === "default") {
    improvement = "Укажите team_size, budget и platform для более точной оценки реализуемости";
  } else if (weakest.name === "team_capacity") {
    improvement = `Сократите scope (сейчас ${mechCount} механик) или усильте команду — баланс мех./чел. ниже целевого`;
  } else if (weakest.name === "budget") {
    improvement = "Сократите MVP slice под бюджет или привлечь дополнительное финансирование для полного scope";
  } else if (weakest.name === "platform_complexity") {
    improvement = "Релиз на одной ведущей платформе сначала; портируйте после валидации MVP";
  } else {
    improvement = "Сократите cross-genre механики или сузьте subgenres для роста совместимости";
  }

  return {
    score,
    factors,
    reason,
    improvement,
    composite: true,
  };
}
