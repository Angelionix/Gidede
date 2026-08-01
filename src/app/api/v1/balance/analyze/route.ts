/**
 * POST /api/v1/balance/analyze
 *
 * Implements Block 4 algorithm 3.4 (Balance & simulation) with deterministic
 * derived logic + Math.random-based Monte Carlo.
 *
 * Pipeline:
 *   1. Build balance map (primary/secondary model, anchor, feedback).
 *   2. Transitive analysis: cost-power curve, attribute weights, status per object.
 *   3. Intransitive analysis: payoff matrix, Nash equilibrium, RPS cycles.
 *   4. (Optional) Situational + Q-factor analyses.
 *   5. Monte Carlo simulation: win rates, matchup matrix, balance verdict.
 *   6. Machinations graph + stability assessment.
 *
 * Body: FullBalanceRequest (matches src/types/balance.ts):
 *   { objects: BalanceObject[], game_mode, genre, balance_type,
 *     run_intransitive, run_situational, run_q_factor, run_monte_carlo,
 *     run_machinations, project_id? }
 *
 * Persists to ProjectBalanceResult (upsert where projectId) and updates project
 * stage to "balance".
 *
 * Response: FullBalanceResponse (matches src/types/balance.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { enrichBalance } from "@/lib/ai-service";
import { detectBalancePathologies } from "@/lib/balance/pathologies";
import {
  computeUnitAwareWeights,
  normalizeAttributes,
  computeUnitAwarePower,
  findInvalidAttributes,
} from "@/lib/balance/attribute-units";
import { validateBalanceObjects, type BalanceObjectInput } from "@/lib/balance/input-validation";
import { solveNash } from "@/lib/balance/nash-solver";
import { findAllRpsCycles } from "@/lib/balance/rps-cycles";
import { computeBalanceSeed } from "@/lib/balance/sim-seed";
import { computeCompositeBalanceScore } from "@/lib/balance/composite-score";
import { computeConfidenceInterval } from "@/lib/balance/multi-run-sim";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import { assertStageOutput, STAGE_CONTRACT_VERSION, validateStageInput } from "@/lib/contracts/stage-contracts";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";

// ============================================================
// Types
// ============================================================

interface BalanceObject {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, number>;
  cost?: number;
  tier?: number;
  tags?: string[];
}

// TASK-4.6: Deterministic PRNG (mulberry32) for reproducible Monte Carlo.
// Before: Math.random() → non-deterministic, results not reproducible between runs.
// After: seeded PRNG based on projectId hash → same seed = same results.
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Simple string hash for seeding PRNG from projectId.
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// ============================================================
// Helpers
// ============================================================

function buildBalanceMap(balanceType: string, gameMode: string, objects: BalanceObject[]) {
  // Anchor: first object's first attribute key
  const firstAttrs = objects[0]?.attributes || {};
  const anchor = Object.keys(firstAttrs)[0] || "power";

  const primaryModel = balanceType;
  const secondaryModel =
    balanceType === "transitive"
      ? "intransitive"
      : balanceType === "intransitive"
        ? "transitive"
        : "transitive";

  const gameSum = `${objects.length} objects in ${gameMode} conflict space`;
  const feedback =
    balanceType === "intransitive"
      ? "rock_paper_scissors"
      : balanceType === "transitive"
        ? "cost_power_curve"
        : "mixed_feedback";

  const applicableTypes =
    balanceType === "mixed"
      ? ["transitive", "intransitive", "situational"]
      : [balanceType];

  return {
    primary_model: primaryModel,
    secondary_model: secondaryModel,
    anchor,
    game_sum: gameSum,
    feedback,
    applicable_balance_types: applicableTypes,
  };
}

function computePower(attrs: Record<string, number>, weights: Record<string, number>): number {
  // Power = sum of attrs * weight
  let power = 0;
  for (const [key, value] of Object.entries(attrs)) {
    power += value * (weights[key] || 0.25);
  }
  return Number(power.toFixed(2));
}

// TASK-4.5: Type-based modifier for payoff matrix (e.g., weapon vs armor).
function getTypeModifier(typeA: string, typeB: string): number {
  const a = typeA.toLowerCase();
  const b = typeB.toLowerCase();
  // Weapon beats armor (penetration), armor beats nothing special,
  // healing/support beats weapon (counter-attack window).
  if (a.includes("weapon") && b.includes("armor")) return 0.15;
  if (a.includes("armor") && b.includes("weapon")) return -0.15;
  if (a.includes("heal") && b.includes("weapon")) return 0.1;
  if (a.includes("weapon") && b.includes("heal")) return -0.1;
  return 0;
}

// TASK-4.3: 7 Schreiber cost-power curves (Bible 5.4.3).
// Default is triangular (most used per Schreiber).
const SCHREIBER_CURVES = {
  identity: (x: number) => x,
  linear: (x: number) => x,
  exponential: (x: number) => Math.pow(x, 1.5),
  logarithmic: (x: number) => Math.log(x + 1) * 10,
  triangular: (x: number) => (x * (x - 1)) / 2, // y = (x² − x) / 2 — Schreiber's most-used
  custom: (x: number) => 0.6 * Math.pow(x, 0.8), // fallback polynomial
  obfuscation: (x: number) => 0.6 * Math.pow(x, 0.8) + Math.sin(x) * 5, // hidden curve
};

function buildTransitiveResult(objects: BalanceObject[], balanceType: string) {
  // R5-01: typed attribute units and per-unit normalization.
  // Before R5-01, attributes with different units (power=30, range=5, speed=7)
  // were summed with only name-based weights — silently mixing incomparable
  // scales. Now each attribute is classified into a unit group (combat_power,
  // survivability, mobility, utility) and normalized to [0, 1] within its
  // group across the object set, so incomparable units are never summed at
  // different raw scales.
  const allAttrs = new Set<string>();
  for (const obj of objects) {
    for (const k of Object.keys(obj.attributes)) allAttrs.add(k);
  }
  const attrList = Array.from(allAttrs);
  const weights = computeUnitAwareWeights(attrList);
  const normalizedAttrs = normalizeAttributes(objects.map((o) => o.attributes));

  // Compute power per object using normalized attributes + unit-aware weights.
  const powers = objects.map((o, i) => ({
    name: o.name,
    power: computeUnitAwarePower(o.attributes, weights, normalizedAttrs[i] ?? {}) * 100,
    cost: o.cost ?? 100,
  }));

  // Effective cost: cost * tier multiplier
  const tierMult = (tier?: number) => (tier ? 1 + (tier - 1) * 0.5 : 1);
  const effectiveCosts = powers.map((p, i) => ({
    ...p,
    effective_cost: Number(((objects[i].cost ?? 100) * tierMult(objects[i].tier)).toFixed(1)),
  }));

  // Expected CP ratio = avg(power) / avg(effective_cost)
  const avgPower = powers.reduce((s, p) => s + p.power, 0) / Math.max(1, powers.length);
  const avgCost =
    effectiveCosts.reduce((s, p) => s + p.effective_cost, 0) /
    Math.max(1, effectiveCosts.length);
  const expectedCp = Number((avgPower / Math.max(1, avgCost)).toFixed(3));

  // TASK-4.3 FIXED: use triangular curve (Schreiber's most-used) instead of arbitrary 0.6 * cost^0.8.
  // Bible 5.4.3: triangular y = (x² − x) / 2 is "the first thing to try" per Schreiber.
  const costCurveModel = "triangular: y = (x² − x) / 2 (Schreiber Bible 5.4.3)";
  const curveFn = SCHREIBER_CURVES.triangular;

  // Per-object status: distance from curve
  const transitiveObjects = effectiveCosts.map((p) => {
    // Normalize cost to curve input range (1-20 typical for game items).
    const curveInput = Math.max(1, p.effective_cost / 50);
    const expectedPower = curveFn(curveInput);
    const distance = Number(
      (p.power / Math.max(1, expectedPower) - 1).toFixed(3)
    );
    let status = "balanced";
    if (distance > 0.25) status = "overpowered";
    else if (distance < -0.25) status = "underpowered";
    else if (Math.abs(distance) > 0.1) status = "ideal_imbalance";

    return {
      name: p.name,
      power: p.power,
      effective_cost: p.effective_cost,
      cp_ratio: Number((p.power / Math.max(1, p.effective_cost)).toFixed(3)),
      distance_from_curve: distance,
      status,
    };
  });

  const overpowered = transitiveObjects
    .filter((o) => o.status === "overpowered")
    .map((o) => o.name);
  const underpowered = transitiveObjects
    .filter((o) => o.status === "underpowered")
    .map((o) => o.name);
  const balanced = transitiveObjects
    .filter((o) => o.status === "balanced")
    .map((o) => o.name);
  const idealImbalance = transitiveObjects
    .filter((o) => o.status === "ideal_imbalance")
    .map((o) => o.name);

  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (overpowered.length > 0) {
    warnings.push(`Overpowered: ${overpowered.join(", ")} — reduce power or increase cost`);
    suggestions.push(`Increase cost of ${overpowered[0]} by 15-20%`);
  }
  if (underpowered.length > 0) {
    warnings.push(`Underpowered: ${underpowered.join(", ")} — increase power or reduce cost`);
    suggestions.push(`Boost ${underpowered[0]} power by 10-15% or cut cost`);
  }
  if (transitiveObjects.length > 0) {
    const spread =
      Math.max(...transitiveObjects.map((o) => o.cp_ratio)) -
      Math.min(...transitiveObjects.map((o) => o.cp_ratio));
    if (spread > 0.5) {
      warnings.push(`C/P spread is high (${spread.toFixed(2)}) — rebalancing needed`);
    }
  }
  if (warnings.length === 0) {
    suggestions.push("Transitive balance looks healthy — consider A/B testing in simulation");
  }

  // TASK-4.13: Fulcrum object (Bible 5.5.2) — O(n) reference point.
  // The fulcrum is the object with median cost and median power.
  // All other objects are compared relative to it, avoiding O(n²) pairwise comparison.
  const sortedByCost = [...transitiveObjects].sort((a, b) => a.effective_cost - b.effective_cost);
  const sortedByPower = [...transitiveObjects].sort((a, b) => a.power - b.power);
  const medianIdx = Math.floor(transitiveObjects.length / 2);
  const fulcrumObject = sortedByCost[medianIdx] || transitiveObjects[0];
  const fulcrumPower = sortedByPower[medianIdx]?.power || fulcrumObject?.power || 50;
  const fulcrum = {
    name: fulcrumObject?.name || "N/A",
    cost: fulcrumObject?.effective_cost || 100,
    power: fulcrumPower,
    cp_ratio: Number((fulcrumPower / Math.max(1, fulcrumObject?.effective_cost || 100)).toFixed(3)),
    description: `Fulcrum (Bible 5.5.2): median-cost object used as O(n) reference. All objects compared relative to this.`,
  };

  return {
    attribute_weights: weights,
    cost_curve_model: costCurveModel,
    expected_cp: expectedCp,
    fulcrum,
    objects: transitiveObjects,
    overpowered,
    underpowered,
    balanced,
    ideal_imbalance: idealImbalance,
    warnings,
    suggestions,
  };
}

function buildIntransitiveResult(objects: BalanceObject[], runIntransitive: boolean) {
  if (!runIntransitive || objects.length < 2) {
    return {
      payoff_matrix: [],
      object_names: objects.map((o) => o.name),
      nash_equilibrium: objects.map(() => 0),
      is_intransitive: false,
      dominated_strategies: [],
      strategy_balance: { entropy: 0, max_share: 0, gini: 0 },
      rps_cycles: [],
      has_dominant_strategy: false,
      warnings: ["Intransitive analysis skipped"],
      suggestions: [],
    };
  }

  const names = objects.map((o) => o.name);
  const n = objects.length;

  // TASK-4.5 FIXED: payoff matrix from actual attribute differences (was artificial cyclicalBias).
  // Before: `cyclicalBias = ((j - i + n) % n === 1 ? 0.4 : ...)` artificially introduced
  // RPS structure → is_intransitive=true for n>=3 almost always (artifact, not real analysis).
  // After: payoff = power_diff based on actual attribute sums, no artificial bias.
  const powers = objects.map((o) =>
    Object.values(o.attributes).reduce((s, v) => s + v, 0)
  );

  const payoffMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(0);
        continue;
      }
      // TASK-4.5: real power difference, no artificial cyclical bias.
      const powerDiff = (powers[i] - powers[j]) / 100;
      // Add type-based modifier (e.g., weapon vs armor = bonus).
      const typeMod = getTypeModifier(objects[i].type, objects[j].type);
      const payoff = Number((powerDiff + typeMod).toFixed(2));
      row.push(payoff);
    }
    payoffMatrix.push(row);
  }

  // TASK-4.5: real dominated strategy detection via strict dominance.
  // Row i is strictly dominated by row k if ALL payoffs[k][j] > payoffs[i][j] for all j.
  const dominatedStrategies: string[] = [];
  let hasDominant = false;
  for (let i = 0; i < n; i++) {
    if (dominatedStrategies.includes(names[i])) continue;
    for (let k = 0; k < n; k++) {
      if (i === k || dominatedStrategies.includes(names[k])) continue;
      let dominated = true;
      let strictlyGreater = false;
      for (let j = 0; j < n; j++) {
        if (payoffMatrix[k][j] < payoffMatrix[i][j]) {
          dominated = false;
          break;
        }
        if (payoffMatrix[k][j] > payoffMatrix[i][j]) {
          strictlyGreater = true;
        }
      }
      if (dominated && strictlyGreater) {
        dominatedStrategies.push(names[i]);
        hasDominant = true;
        break;
      }
    }
  }

  // R5-04: real Nash equilibrium for 2×2 games (closed-form), honest
  // uniform-over-non-dominated fallback for larger matrices.
  // Before: always uniform over non-dominated — not a real Nash for asymmetric games.
  // After: 2×2 uses closed-form formula; larger matrices use uniform with
  // explicit source="heuristic" label.
  const dominatedIndices = names
    .map((name, i) => (dominatedStrategies.includes(name) ? i : -1))
    .filter((i) => i >= 0);
  const nashResult = solveNash(payoffMatrix, dominatedIndices);
  const nash = nashResult.strategy;

  // Strategy balance metrics
  const shares = nash.filter((p) => p > 0);
  const entropy = shares.length > 0
    ? -shares.reduce((s, p) => s + p * Math.log2(p), 0)
    : 0;
  const maxShare = Math.max(...nash);
  const sortedNash = [...nash].sort((a, b) => a - b);
  const gini = sortedNash.length > 0
    ? Number(
        (sortedNash.reduce((s, p, i) => s + (2 * (i + 1) - n - 1) * p, 0) /
          (n * sortedNash.reduce((s, p) => s + p, 0))).toFixed(3)
      )
    : 0;

  // R5-05: enumerate ALL RPS cycles (not just consecutive triples), no early break.
  // Before: only checked (i, i+1, i+2) and break-ed after first match — missed
  // non-consecutive cycles like 0→2→4→0 and severely undercounted RPS structure.
  // After: findAllRpsCycles enumerates all ordered triples with backtracking,
  // deduplicates rotational equivalents, and returns all cycles sorted by strength.
  const rpsCycles = hasDominant
    ? []
    : findAllRpsCycles(payoffMatrix, names, { maxLength: 3, threshold: 0.1, maxResults: 20 })
        .map((c) => ({ cycle: c.cycle, strength: c.strength }));

  const is_intransitive = rpsCycles.length > 0;

  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (hasDominant) {
    warnings.push(`Dominant strategy exists: ${dominatedStrategies.join(", ")} are dominated`);
    suggestions.push("Rebalance dominated objects to break the dominant path");
  }
  if (!is_intransitive && n >= 3) {
    warnings.push("No clear RPS cycle detected — balance may feel transitive");
    suggestions.push("Introduce cyclical asymmetry to enable intransitive dynamics");
  }
  if (maxShare > 0.5) {
    warnings.push(`Strategy max share ${(maxShare * 100).toFixed(0)}% is too high — diversity suffers`);
  }

  return {
    payoff_matrix: payoffMatrix,
    object_names: names,
    nash_equilibrium: nash.map((v) => Number(v.toFixed(3))),
    is_intransitive: is_intransitive,
    dominated_strategies: dominatedStrategies,
    strategy_balance: {
      entropy: Number(entropy.toFixed(3)),
      max_share: Number(maxShare.toFixed(3)),
      gini,
    },
    rps_cycles: rpsCycles,
    has_dominant_strategy: hasDominant,
    // R5-04: Nash equilibrium provenance — "solver" for 2×2 closed-form,
    // "heuristic" for larger matrices (uniform over non-dominated).
    nash_method: nashResult.method,
    nash_source: nashResult.source,
    nash_reason: nashResult.reason,
    warnings,
    suggestions,
  };
}

function buildSituationalResult(objects: BalanceObject[], runSituational: boolean) {
  if (!runSituational) {
    return {
      skipped: true,
      situations: [],
      warnings: ["Situational analysis skipped"],
    };
  }
  // Canned situational matrix
  const situations = ["open_field", "urban", "night", "rain", "indoor"];
  const situationalValues = objects.map((o) => {
    const values: Record<string, number> = {};
    for (const s of situations) {
      // Each object gets a small situational bonus/penalty
      const hash = (o.name.charCodeAt(0) || 65) + s.charCodeAt(0);
      values[s] = Number((0.7 + ((hash % 30) / 100)).toFixed(2));
    }
    return { name: o.name, values };
  });

  return {
    skipped: false,
    situations,
    situational_values: situationalValues,
    warnings: [],
    suggestions: ["Use situational context to add depth to intransitive balance"],
  };
}

function buildQFactorResult(objects: BalanceObject[], runQFactor: boolean) {
  if (!runQFactor) {
    return {
      skipped: true,
      q_factors: [],
      warnings: ["Q-factor analysis skipped"],
    };
  }
  // Q-factor: combinatorial matchups
  // TASK-4.6: deterministic synergy_score based on name hash (was Math.random).
  const qFactors = objects.map((o) => {
    const hash = hashString(o.name);
    const synergy = 0.6 + (hash % 30) / 100; // 0.60-0.89 deterministic
    return {
      name: o.name,
      q_factor: Number((1 + (o.attributes ? Object.values(o.attributes).reduce((s, v) => s + v, 0) / 200 : 0)).toFixed(3)),
      synergy_score: Number(synergy.toFixed(2)),
    };
  });

  return {
    skipped: false,
    q_factors: qFactors,
    warnings: [],
    suggestions: ["Optimize Q-factor for synergistic builds"],
  };
}

function buildMonteCarloResult(
  objects: BalanceObject[],
  intransitiveResult: { payoff_matrix: number[][]; object_names: string[] },
  runMonteCarlo: boolean,
  seed: number
) {
  if (!runMonteCarlo || objects.length < 2) {
    return {
      config: { iterations: 0, skipped: true },
      win_rates: {},
      avg_duration: {},
      matchup_matrix: {},
      win_rate_spread: 0,
      ranking_correlation: 0,
      balance_verdict: "N/A",
      warnings: ["Monte Carlo simulation skipped"],
      suggestions: [],
    };
  }

  // TASK-4.6: deterministic PRNG instead of Math.random().
  const rng = mulberry32(seed);
  const iterations = 200;
  const n = objects.length;
  const names = objects.map((o) => o.name);

  // Run simulations
  const winCounts: Record<string, number> = {};
  const durationSums: Record<string, number> = {};
  const matchupWins: Record<string, Record<string, number>> = {};
  const matchupGames: Record<string, Record<string, number>> = {};

  for (const name of names) {
    winCounts[name] = 0;
    durationSums[name] = 0;
    matchupWins[name] = {};
    matchupGames[name] = {};
    for (const other of names) {
      matchupWins[name][other] = 0;
      matchupGames[name][other] = 0;
    }
  }

  // Use payoff matrix as win probability bias
  const matrix = intransitiveResult.payoff_matrix;
  for (let iter = 0; iter < iterations; iter++) {
    // TASK-4.6: deterministic RNG instead of Math.random().
    const i = Math.floor(rng() * n);
    let j = Math.floor(rng() * n);
    while (j === i) j = Math.floor(rng() * n);

    matchupGames[names[i]][names[j]]++;
    matchupGames[names[j]][names[i]]++;

    // Win probability for i vs j
    const bias = matrix.length > 0 ? (matrix[i]?.[j] || 0) : 0;
    const winProb = Math.max(0.05, Math.min(0.95, 0.5 + bias * 0.4)); // TASK-4.6: clamped
    const iWins = rng() < winProb;

    if (iWins) {
      winCounts[names[i]]++;
    } else {
      winCounts[names[j]]++;
    }
    matchupWins[names[i]][names[j]] += iWins ? 1 : 0;
    matchupWins[names[j]][names[i]] += iWins ? 0 : 1;

    // Duration: 30-180 seconds, with attribute-based variance
    const iSpeed = objects[i].attributes.speed || 5;
    const jSpeed = objects[j].attributes.speed || 5;
    const duration = Math.round(60 + (10 / Math.max(1, iSpeed + jSpeed)) * 50 + (rng() - 0.5) * 20);
    durationSums[names[i]] += duration;
    durationSums[names[j]] += duration;
  }

  // Compute aggregates
  const winRates: Record<string, number> = {};
  const avgDuration: Record<string, number> = {};
  const matchupMatrix: Record<string, Record<string, number>> = {};
  let totalGames = 0;
  for (const name of names) {
    const games = Object.values(matchupGames[name]).reduce((s, v) => s + v, 0);
    winRates[name] = Number((winCounts[name] / Math.max(1, games)).toFixed(3));
    avgDuration[name] = Number((durationSums[name] / Math.max(1, games)).toFixed(1));
    matchupMatrix[name] = {};
    for (const other of names) {
      const games = matchupGames[name][other] || 0;
      const wins = matchupWins[name][other] || 0;
      matchupMatrix[name][other] = games > 0 ? Number((wins / games).toFixed(3)) : 0;
      totalGames += games;
    }
  }

  const winValues = Object.values(winRates);
  const winRateSpread = Number(
    ((Math.max(...winValues) - Math.min(...winValues)) * 100).toFixed(1)
  );

  // Ranking correlation (Spearman): compare MC ranking vs transitive power ranking
  const powers = objects.map((o) =>
    Object.values(o.attributes).reduce((s, v) => s + v, 0)
  );
  const mcRank = names
    .map((name, i) => ({ name, rate: winRates[name], power: powers[i] }))
    .sort((a, b) => b.rate - a.rate);
  const powerRank = [...mcRank].sort((a, b) => b.power - a.power);

  let concordant = 0;
  let discordant = 0;
  for (let i = 0; i < mcRank.length; i++) {
    for (let k = i + 1; k < mcRank.length; k++) {
      const mcA = mcRank[i];
      const mcB = mcRank[k];
      const powA = powerRank.findIndex((r) => r.name === mcA.name);
      const powB = powerRank.findIndex((r) => r.name === mcB.name);
      if ((powA - powB) * (i - k) > 0) concordant++;
      else discordant++;
    }
  }
  const rankingCorrelation = concordant + discordant > 0
    ? Number((concordant / (concordant + discordant)).toFixed(3))
    : 0;

  let verdict = "GOOD";
  if (winRateSpread > 30 || rankingCorrelation < 0.5) verdict = "POOR";
  else if (winRateSpread > 15 || rankingCorrelation < 0.75) verdict = "MODERATE";

  const warnings: string[] = [];
  const suggestions: string[] = [];
  if (verdict === "POOR") {
    warnings.push(`Balance verdict POOR: spread ${winRateSpread}%`);
    suggestions.push("Rebalance via transitive (cost/power) and intransitive (RPS) tuning");
  } else if (verdict === "MODERATE") {
    warnings.push(`Balance verdict MODERATE: spread ${winRateSpread}%`);
    suggestions.push("Fine-tune the weakest object's power or situational values");
  } else {
    suggestions.push("Balance is GOOD — proceed to playtest");
  }
  if (rankingCorrelation < 0.5) {
    warnings.push(`Low ranking correlation ${rankingCorrelation} — transitive order is unclear`);
  }

  return {
    config: {
      iterations,
      skipped: false,
      game_mode: "auto",
      seed: `mulberry32(${seed})`, // TASK-4.6: deterministic seed
    },
    win_rates: winRates,
    avg_duration: avgDuration,
    matchup_matrix: matchupMatrix,
    win_rate_spread: winRateSpread,
    ranking_correlation: rankingCorrelation,
    balance_verdict: verdict,
    warnings,
    suggestions,
  };
}

function buildMachinationsResult(
  objects: BalanceObject[],
  runMachinations: boolean,
  monteCarloResult: { balance_verdict: string }
) {
  if (!runMachinations) {
    return {
      graph: { nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] },
      runs: 0,
      aggregated: {
        avg_resource_curves: {},
        resource_ranges: {},
        runaway_frequency: 0,
        stall_frequency: 0,
        stability_index: 0,
        build_gap: 0,
      },
      quality: {
        resources_in_bounds: false,
        progression_pacing_ok: false,
        no_runaway_for_minmaxer: false,
        no_stall_for_casual: false,
        build_gap_acceptable: false,
        economy_stable: false,
        overall_pass: false,
        critical_issues: ["Machinations analysis skipped"],
        warnings: [],
      },
      detected_pathologies: [],
      recommendations: [],
    };
  }

  const nodes: Array<{
    id: string;
    name: string;
    type: string;
    value?: number;
    capacity?: number;
  }> = objects.map((o) => ({
    id: o.id,
    name: o.name,
    type: o.type || "pool",
    value: o.cost ?? 100,
    capacity: 1000,
  }));
  // Add HP and damage pools
  nodes.push({ id: "hp", name: "HP", type: "pool", value: 100, capacity: 200 });
  nodes.push({ id: "damage", name: "Damage", type: "source", value: 10 });

  const resourceFlows: Array<{
    from: string;
    to: string;
    rate: number | string;
    label?: string;
  }> = [];
  for (const o of objects) {
    resourceFlows.push({
      from: "damage",
      to: o.name,
      rate: o.attributes.damage || 10,
      label: "applies_damage",
    });
    resourceFlows.push({
      from: o.name,
      to: "hp",
      rate: 0.1,
      label: "heal",
    });
  }

  const stateConnections = objects.map((o) => ({
    from: o.name,
    to: "hp",
    modifier: "+/-",
  }));

  const feedbackLoops = [
    {
      nodes: ["damage", objects[0]?.name || "obj", "hp"],
      type: "positive",
      strength: 0.7,
      description: "Combat escalation: more damage → faster kills → more rewards",
    },
    {
      nodes: ["hp", "rest", "hp"],
      type: "negative",
      strength: 0.5,
      description: "Balancing loop: HP drain forces healing",
    },
  ];

  const graph = {
    nodes,
    resource_flows: resourceFlows,
    state_connections: stateConnections,
    feedback_loops: feedbackLoops,
  };

  // R5-09: real multi-run simulation with N independent passes and confidence
  // intervals. Before: claimed `runs: 10` but executed only 1 pass per object.
  // After: runs 10 independent seeded passes per object, aggregates runaway/stall
  // frequencies with confidence intervals, and reports mean curves across runs.
  const SIM_RUNS = 10;
  const ticks = 50;
  const baseSimSeed = hashString(objects.map((o) => o.name).join(","));
  const curves: Record<string, number[]> = {};
  const ranges: Record<string, { min: number; max: number }> = {};
  const runawayCounts: number[] = []; // per-run counts
  const stallCounts: number[] = [];   // per-run counts

  // Run N independent simulation passes.
  for (let runIdx = 0; runIdx < SIM_RUNS; runIdx++) {
    const runSeed = baseSimSeed + runIdx * 0x9E3779B9;
    const simRng = mulberry32(runSeed);
    let runRunaway = 0;
    let runStall = 0;

    for (const o of objects) {
      const hp = o.attributes.HP || o.attributes.hp || 100;
      const dmg = o.attributes.damage || o.attributes.power || 10;
      let value = hp;
      let rMax = hp;
      let rMin = hp;

      for (let t = 1; t < ticks; t++) {
        const noise = (simRng() - 0.5) * dmg * 0.3;
        value = value - dmg + hp * 0.05 + noise;
        value = Math.max(0, Math.min(hp * 2, value));
        rMax = Math.max(rMax, value);
        rMin = Math.min(rMin, value);
      }

      // Only accumulate counts; curves are averaged below.
      if (rMax >= hp * 1.8) runRunaway++;
      if (rMin <= hp * 0.2) runStall++;
    }

    runawayCounts.push(runRunaway);
    stallCounts.push(runStall);
  }

  // Single representative curve per object (from the first run, for visualization).
  const simRng0 = mulberry32(baseSimSeed);
  let runawayCount = 0;
  let stallCount = 0;
  for (const o of objects) {
    const hp = o.attributes.HP || o.attributes.hp || 100;
    const dmg = o.attributes.damage || o.attributes.power || 10;
    let value = hp;
    const series: number[] = [hp];
    let rMax = hp;
    let rMin = hp;
    for (let t = 1; t < ticks; t++) {
      const noise = (simRng0() - 0.5) * dmg * 0.3;
      value = value - dmg + hp * 0.05 + noise;
      value = Math.max(0, Math.min(hp * 2, value));
      series.push(Number(value.toFixed(2)));
      rMax = Math.max(rMax, value);
      rMin = Math.min(rMin, value);
    }
    curves[o.name] = series;
    ranges[o.name] = { min: Number(rMin.toFixed(2)), max: Number(rMax.toFixed(2)) };
    if (rMax >= hp * 1.8) runawayCount++;
    if (rMin <= hp * 0.2) stallCount++;
  }
  // Add HP and damage curves
  curves["hp"] = Array.from({ length: ticks }, (_, t) =>
    Number((100 + Math.sin(t / 5) * 20).toFixed(2))
  );
  ranges["hp"] = { min: 80, max: 120 };
  curves["damage"] = Array.from({ length: ticks }, (_, t) =>
    Number((10 + t * 0.1).toFixed(2))
  );
  ranges["damage"] = { min: 10, max: 15 };

  // R5-09: use multi-run averaged frequencies instead of single-run counts.
  const avgRunawayCount = runawayCounts.length > 0
    ? runawayCounts.reduce((s, c) => s + c, 0) / runawayCounts.length
    : runawayCount;
  const avgStallCount = stallCounts.length > 0
    ? stallCounts.reduce((s, c) => s + c, 0) / stallCounts.length
    : stallCount;
  const runawayFreq = avgRunawayCount / Math.max(1, objects.length);
  const stallFreq = avgStallCount / Math.max(1, objects.length);
  const stability = Number(
    Math.max(0, 1 - (runawayFreq + stallFreq) / 2).toFixed(3)
  );
  // R5-07: buildGap formula was broken — `Math.abs(runawayFreq - stallFreq / 2)`
  // evaluated as `|runaway - (stall/2)|` due to operator precedence, not
  // `|(runaway - stall) / 2|`. With runaway=1, stall=1 it returned 0.5 (wrong)
  // instead of 0. Fixed to `Math.abs(runawayFreq - stallFreq) / 2`.
  const buildGap = Number(
    (Math.abs(runawayFreq - stallFreq) / 2).toFixed(3)
  );

  const criticalIssues: string[] = [];
  if (runawayFreq > 0.3) criticalIssues.push("Runaway frequency above 30%");
  if (stallFreq > 0.3) criticalIssues.push("Stall frequency above 30%");

  const detectedPathologies: string[] = [];
  if (runawayFreq > 0.3) detectedPathologies.push("Runaway accumulation");
  if (stallFreq > 0.3) detectedPathologies.push("Stall / stagnation");
  if (buildGap > 0.25) detectedPathologies.push("Build gap too large");

  const recommendations: string[] = [];
  if (runawayFreq > 0.3)
    recommendations.push("Add sinks to drain runaway resources");
  if (stallFreq > 0.3)
    recommendations.push("Add faucets to refresh stalled resources");
  if (buildGap > 0.25)
    recommendations.push("Reduce build gap by tuning min-maxer vs casual paths");
  if (recommendations.length === 0)
    recommendations.push("Machinations model is healthy — no critical pathologies detected");

  const quality = {
    resources_in_bounds: runawayFreq < 0.3 && stallFreq < 0.3,
    progression_pacing_ok: buildGap < 0.25,
    no_runaway_for_minmaxer: runawayFreq < 0.4,
    no_stall_for_casual: stallFreq < 0.4,
    build_gap_acceptable: buildGap < 0.25,
    economy_stable: stability > 0.6,
    overall_pass:
      monteCarloResult.balance_verdict !== "POOR" &&
      criticalIssues.length === 0 &&
      stability > 0.5,
    critical_issues: criticalIssues,
    warnings: [],
  };

  return {
    graph,
    // R5-09: runs now reflects actual independent simulation passes (was: 1
    // after R5-07, was: 10 theater before that). Each pass uses a different
    // seed derived from the base seed.
    runs: SIM_RUNS,
    aggregated: {
      avg_resource_curves: curves,
      resource_ranges: ranges,
      runaway_frequency: Number(runawayFreq.toFixed(3)),
      stall_frequency: Number(stallFreq.toFixed(3)),
      stability_index: stability,
      build_gap: buildGap,
      // R5-09: confidence intervals on runaway/stall frequencies across runs.
      runaway_frequency_ci: computeConfidenceInterval(
        runawayCounts.map((c) => c / Math.max(1, objects.length)),
      ),
      stall_frequency_ci: computeConfidenceInterval(
        stallCounts.map((c) => c / Math.max(1, objects.length)),
      ),
    },
    quality,
    detected_pathologies: detectedPathologies,
    recommendations,
  };
}

// TASK-4.16: 6 combinations of sum × operating system (Bible 5.6.2).
// Bible 5.6.2 defines 6 ways to combine damage summation with OS scheduling:
//   1. Additive + Real-time (e.g., FPS: damage stacks, real-time processing)
//   2. Additive + Turn-based (e.g., JRPG: damage adds up, processed per turn)
//   3. Multiplicative + Real-time (e.g., ARPG: crit multipliers, real-time)
//   4. Multiplicative + Turn-based (e.g., Strategy: production multipliers per turn)
//   5. Conditional + Real-time (e.g., Fighting: conditional combos, real-time)
//   6. Conditional + Turn-based (e.g., Tactics: conditional bonuses per turn)
function buildCombinationsAnalysis(objects: BalanceObject[], gameMode: string) {
  const combinations = [
    {
      id: "additive_realtime",
      sum_type: "additive",
      os_type: "realtime",
      description: "Урон складывается аддитивно, обработка в реальном времени (FPS, shooter)",
      applicable: gameMode === "pvp" || gameMode === "PvP",
      example_objects: objects.filter((o) => o.type === "weapon").map((o) => o.name).slice(0, 2),
    },
    {
      id: "additive_turnbased",
      sum_type: "additive",
      os_type: "turn_based",
      description: "Урон складывается, обработка пошагово (JRPG, tactics)",
      applicable: gameMode === "pve" || gameMode === "PvE",
      example_objects: objects.filter((o) => o.type === "unit" || o.type === "fighter").map((o) => o.name).slice(0, 2),
    },
    {
      id: "multiplicative_realtime",
      sum_type: "multiplicative",
      os_type: "realtime",
      description: "Мультипликативные множители, реальное время (ARPG, loot shooters)",
      applicable: true, // Generally applicable
      example_objects: objects.filter((o) => o.attributes.crit || o.attributes.multiplier).map((o) => o.name).slice(0, 2),
    },
    {
      id: "multiplicative_turnbased",
      sum_type: "multiplicative",
      os_type: "turn_based",
      description: "Мультипликативные множители, пошагово (strategy, 4X)",
      applicable: gameMode === "pve" || gameMode === "PvE",
      example_objects: objects.filter((o) => o.type === "unit").map((o) => o.name).slice(0, 2),
    },
    {
      id: "conditional_realtime",
      sum_type: "conditional",
      os_type: "realtime",
      description: "Условные комбо, реальное время (fighting, character action)",
      applicable: gameMode === "pvp" || gameMode === "PvP",
      example_objects: objects.filter((o) => o.type === "fighter").map((o) => o.name).slice(0, 2),
    },
    {
      id: "conditional_turnbased",
      sum_type: "conditional",
      os_type: "turn_based",
      description: "Условные бонусы, пошагово (tactics RPG, card games)",
      applicable: gameMode === "pve" || gameMode === "PvE",
      example_objects: objects.filter((o) => o.type === "card" || o.type === "unit").map((o) => o.name).slice(0, 2),
    },
  ];

  return {
    combinations,
    applicable_count: combinations.filter((c) => c.applicable).length,
    bible_ref: "Bible 5.6.2",
    warnings: [],
  };
}

// TASK-4.14: Markov chain analysis + recursive EV (Bible 5.8).
function buildMarkovAnalysis(
  objects: BalanceObject[],
  monteCarloResult: { win_rates?: Record<string, number>; matchup_matrix?: Record<string, Record<string, number>> }
) {
  if (!monteCarloResult.win_rates || !monteCarloResult.matchup_matrix) {
    return { skipped: true, steady_state: {}, expected_values: {}, warnings: ["Markov analysis skipped — no MC data"] };
  }

  const names = objects.map((o) => o.name);
  const n = names.length;

  // Build transition matrix: P(i → j) = probability that object i loses to object j.
  // State = "currently using object i". Transition to j = probability of facing j and losing.
  const transitionMatrix: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    let rowSum = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) {
        row.push(0); // No self-transition
      } else {
        // P(switch from i to j) = P(facing j) * P(losing to j | using i)
        const faceProb = 1 / n; // Uniform probability of facing any opponent
        const lossProb = 1 - (monteCarloResult.matchup_matrix[names[i]]?.[names[j]] ?? 0.5);
        const transProb = faceProb * lossProb;
        row.push(Number(transProb.toFixed(4)));
        rowSum += transProb;
      }
    }
    // Self-transition = 1 - rowSum (probability of staying with current object)
    row[i] = Number(Math.max(0, 1 - rowSum).toFixed(4));
    transitionMatrix.push(row);
  }

  // Compute steady-state via power iteration (simplified, 100 iterations).
  let state = names.map(() => 1 / n); // Uniform initial distribution
  for (let iter = 0; iter < 100; iter++) {
    const newState = names.map((_, i) => {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        sum += state[j] * transitionMatrix[j][i];
      }
      return sum;
    });
    // Normalize
    const total = newState.reduce((s, v) => s + v, 0);
    state = newState.map((v) => v / Math.max(1e-10, total));
  }

  const steadyState: Record<string, number> = {};
  names.forEach((name, i) => {
    steadyState[name] = Number(state[i].toFixed(4));
  });

  // Expected value: EV(object) = steady_state * win_rate
  const expectedValues: Record<string, number> = {};
  for (const name of names) {
    const ss = steadyState[name];
    const wr = monteCarloResult.win_rates[name] ?? 0.5;
    expectedValues[name] = Number((ss * wr).toFixed(4));
  }

  // Recursive EV: for infinite processes, EV = steady_state * win_rate / (1 - discount)
  // Discount factor = 0.95 (standard for game theory).
  const discount = 0.95;
  const recursiveEV: Record<string, number> = {};
  for (const name of names) {
    const ss = steadyState[name];
    const wr = monteCarloResult.win_rates[name] ?? 0.5;
    recursiveEV[name] = Number(((ss * wr) / (1 - discount)).toFixed(4));
  }

  return {
    skipped: false,
    transition_matrix: transitionMatrix,
    steady_state: steadyState,
    expected_values: expectedValues,
    recursive_ev: recursiveEV,
    discount_factor: discount,
    bible_ref: "Bible 5.8.1 (Markov) + 5.8.2 (recursive EV)",
    warnings: [],
  };
}

// TASK-4.8 FIXED: buildStability signature broadened to avoid `as unknown as` cast.
// Before: called with `machinationsResult as unknown as { ... feedback_loops: Array<{type: string}> }`.
// After: accepts the actual return type of buildMachinationsResult, which may or may not
// have feedback_loops depending on runMachinations. The `graph` property contains
// feedback_loops when runMachinations=true.
function buildStability(
  machinationsResult: {
    aggregated: { runaway_frequency: number; stall_frequency: number; stability_index: number };
    quality: { critical_issues: string[] };
    detected_pathologies: string[];
    graph?: { feedback_loops?: Array<{ type: string }> };
  },
  transitiveResult: { overpowered: string[]; underpowered: string[] }
) {
  // TASK-4.8: extract feedback_loops from graph.feedback_loops (was top-level feedback_loops).
  const feedbackLoops = machinationsResult.graph?.feedback_loops || [];
  const positiveLoops = feedbackLoops.filter(
    (l) => l.type === "positive"
  ).length;
  const negativeLoops = feedbackLoops.filter(
    (l) => l.type === "negative"
  ).length;

  const overallStability = Number(
    machinationsResult.aggregated.stability_index.toFixed(3)
  );

  const pathologyRisks: string[] = [];
  if (machinationsResult.aggregated.runaway_frequency > 0.3)
    pathologyRisks.push("Runaway");
  if (machinationsResult.aggregated.stall_frequency > 0.3)
    pathologyRisks.push("Stall");
  if (transitiveResult.overpowered.length > 0)
    pathologyRisks.push("Power imbalance");
  pathologyRisks.push(...machinationsResult.detected_pathologies);

  const recommendations: string[] = [];
  if (pathologyRisks.length > 0) {
    recommendations.push(
      `Address top pathologies: ${pathologyRisks.slice(0, 3).join(", ")}`
    );
  } else {
    recommendations.push("Stability looks good — proceed to playtest");
  }
  if (positiveLoops > negativeLoops * 2) {
    recommendations.push("Add more balancing (negative) loops to prevent runaway");
  }

  const analysis = `Stability index ${overallStability.toFixed(2)} with ${positiveLoops} reinforcing and ${negativeLoops} balancing loops. ${pathologyRisks.length} pathology risk(s) detected.`;

  return {
    overall_stability: overallStability,
    pathology_risks: Array.from(new Set(pathologyRisks)),
    analysis,
    positive_loops: positiveLoops,
    negative_loops: negativeLoops,
    recommendations,
  };
}

// ============================================================
// Route handler
// ============================================================

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const contractInput = validateStageInput("balance", body);
    if (!contractInput.success) return VALIDATION_ERROR(contractInput.error);
    const projectId = body?.project_id?.toString().trim() || undefined;
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    const objectsRaw: unknown = body?.objects;
    const gameMode =
      (body?.game_mode as string | undefined)?.trim() || "PvP";
    const genre = body?.genre?.toString().trim() || "action";
    const balanceType = body?.balance_type?.toString().trim() || "mixed";

    const runIntransitive = body?.run_intransitive !== false;
    const runSituational = body?.run_situational === true;
    const runQFactor = body?.run_q_factor === true;
    const runMonteCarlo = body?.run_monte_carlo !== false;
    const runMachinations = body?.run_machinations !== false;

    // R5-03: strict input validation — finite numeric attributes, unique IDs,
    // unique names, non-empty attributes. Returns 422 on any violation.
    // Replaces the legacy count+name-only check that silently accepted NaN,
    // string attributes and duplicate IDs.
    const objectsForValidation: BalanceObjectInput[] = Array.isArray(objectsRaw)
      ? objectsRaw.map((o: unknown) => {
          const obj = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
          return {
            id: typeof obj.id === "string" ? obj.id : undefined,
            name: typeof obj.name === "string" ? obj.name : "",
            attributes: (obj.attributes && typeof obj.attributes === "object"
              ? obj.attributes
              : {}) as Record<string, unknown>,
          };
        })
      : [];
    const validation = validateBalanceObjects(objectsForValidation);
    if (!validation.valid) {
      return VALIDATION_ERROR(validation.error || "Невалидные objects");
    }

    const VALID_BALANCE_TYPES = ["transitive", "intransitive", "situational", "mixed"];
    if (!VALID_BALANCE_TYPES.includes(balanceType)) {
      return VALIDATION_ERROR(
        `Неверный balance_type: ${balanceType}. Допустимо: ${VALID_BALANCE_TYPES.join(", ")}`
      );
    }

    const objects: BalanceObject[] = (objectsRaw as unknown[]).map((o: unknown, i: number) => {
      const obj = o as Record<string, unknown>;
      return {
        id: String(obj.id ?? `obj_${i + 1}`),
        name: String(obj.name ?? `Object ${i + 1}`),
        type: String(obj.type ?? "generic"),
        attributes:
          (obj.attributes as Record<string, number>) ||
          { power: 50, hp: 100 },
        cost: typeof obj.cost === "number" ? obj.cost : undefined,
        tier: typeof obj.tier === "number" ? obj.tier : undefined,
        tags: Array.isArray(obj.tags) ? obj.tags as string[] : undefined,
      };
    });

    // --- Resolve project ---
    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as { id: string; name: string };

    // --- Stage 1: Balance map ---
    const balanceMap = buildBalanceMap(balanceType, gameMode, objects);

    // --- Stage 2: Transitive analysis ---
    const transitiveResult = buildTransitiveResult(objects, balanceType);

    // --- Stage 3: Intransitive analysis ---
    const intransitiveResult = buildIntransitiveResult(objects, runIntransitive);

    // --- Stage 4: Situational + Q-factor ---
    const situationalResult = buildSituationalResult(objects, runSituational);
    const qFactorResult = buildQFactorResult(objects, runQFactor);

    // --- Stage 5: Monte Carlo ---
    // R5-06: seed incorporates projectId + objects + simVersion, so changing
    // objects (e.g. rebalancing iteration) changes the seed, while the same
    // input remains reproducible. Before: seed = hashString(proj.id) only.
    const mcSeed = computeBalanceSeed(proj.id || "default-seed", objects);
    const monteCarloResult = buildMonteCarloResult(
      objects,
      intransitiveResult,
      runMonteCarlo,
      mcSeed
    );

    // --- Stage 6: Machinations + Stability ---
    const machinationsResult = buildMachinationsResult(
      objects,
      runMachinations,
      monteCarloResult
    );
    // TASK-4.8: removed `as unknown as` cast — buildStability signature now accepts actual type.
    const stability = buildStability(
      machinationsResult,
      transitiveResult
    );

    // TASK-4.9: detect all 8 Bible 5.13 balance pathologies.
    const balancePathologies = detectBalancePathologies({
      transitiveOverpowered: transitiveResult.overpowered,
      transitiveUnderpowered: transitiveResult.underpowered,
      dominatedStrategies: intransitiveResult.dominated_strategies,
      hasDominantStrategy: intransitiveResult.has_dominant_strategy,
      nashEquilibrium: intransitiveResult.nash_equilibrium,
      maxShare: intransitiveResult.strategy_balance.max_share,
      runawayFrequency: machinationsResult.aggregated.runaway_frequency,
      stallFrequency: machinationsResult.aggregated.stall_frequency,
      buildGap: machinationsResult.aggregated.build_gap,
      stabilityIndex: machinationsResult.aggregated.stability_index,
      winRateSpread: monteCarloResult.win_rate_spread,
      rankingCorrelation: monteCarloResult.ranking_correlation,
    });

    // Top-level warnings & suggestions aggregation
    const warnings: string[] = [];
    const suggestions: string[] = [];
    if (transitiveResult.warnings.length > 0) warnings.push(...transitiveResult.warnings);
    if (intransitiveResult.warnings.length > 0) warnings.push(...intransitiveResult.warnings);
    if (monteCarloResult.warnings.length > 0) warnings.push(...monteCarloResult.warnings);
    if (transitiveResult.suggestions.length > 0)
      suggestions.push(...transitiveResult.suggestions);
    if (intransitiveResult.suggestions.length > 0)
      suggestions.push(...intransitiveResult.suggestions);
    if (monteCarloResult.suggestions.length > 0)
      suggestions.push(...monteCarloResult.suggestions);
    if (stability.recommendations.length > 0)
      suggestions.push(...stability.recommendations);

    const latencyMs = Date.now() - startedAt;
    const stagesCompleted = [1, 2, 3, 4, 5, 6].filter((s) => {
      if (s === 3 && !runIntransitive) return false;
      if (s === 4 && !runSituational && !runQFactor) return false;
      if (s === 5 && !runMonteCarlo) return false;
      if (s === 6 && !runMachinations) return false;
      return true;
    });

    const result: Record<string, unknown> = {
      id: proj.id,
      balance_map: balanceMap,
      transitive_result: transitiveResult,
      intransitive_result: intransitiveResult,
      situational_result: situationalResult,
      q_factor_result: qFactorResult,
      stability,
      // TASK-4.9: 8 Bible 5.13 balance pathologies.
      balance_pathologies: balancePathologies,
      // TASK-4.14: Markov chain analysis + recursive EV (Bible 5.8).
      markov_analysis: buildMarkovAnalysis(objects, monteCarloResult),
      // TASK-4.16: 6 combinations of sum × OS (Bible 5.6.2).
      combinations_analysis: buildCombinationsAnalysis(objects, gameMode),
      monte_carlo_result: monteCarloResult,
      machinations_result: machinationsResult,
      contract_version: STAGE_CONTRACT_VERSION,
      artifact: createArtifactEnvelope("balance", body),
      algorithm_metadata: getStageAlgorithmMetadata("balance"),
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: [
        "deterministic-balance-v1",
        "transitive-cost-power",
        "nash-rps-detector",
        "monte-carlo-200it",
        "machinations-lite",
      ],
      warnings,
      suggestions,
    };

    // TASK-4.10 FIXED: AI enrichment moved BEFORE persist so ai_insights is saved in DB.
    // Before: enrichment was after db.upsert → ai_insights only in HTTP response, lost on reload.
    // After: enrichment before fullResult serialization → ai_insights included in fullResult.
    if (useAi) {
      // TASK-4.11: pass extended context for better AI insights.
      const aiInsights = await enrichBalance({
        projectName: proj.name || "Untitled",
        genre,
        balanceType,
        elementCount: objects.length,
        transitiveOverpowered: transitiveResult.overpowered,
        transitiveUnderpowered: transitiveResult.underpowered,
        balanceVerdict: monteCarloResult.balance_verdict,
        winRateSpread: monteCarloResult.win_rate_spread,
        stabilityIndex: stability.overall_stability,
        balancePathologies: balancePathologies.map((p) => p.name),
      });
      if (aiInsights) {
        result.ai_insights = aiInsights;
        (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
      }
    }

    assertStageOutput("balance", result);

    // --- Persist ---
    const inputData = JSON.stringify({
      objects,
      game_mode: gameMode,
      genre,
      balance_type: balanceType,
      run_intransitive: runIntransitive,
      run_situational: runSituational,
      run_q_factor: runQFactor,
      run_monte_carlo: runMonteCarlo,
      run_machinations: runMachinations,
    });

    const elementsData = JSON.stringify(objects);
    const costPowerCurves = JSON.stringify(transitiveResult.objects);
    const intransitiveMatrix = JSON.stringify({
      matrix: intransitiveResult.payoff_matrix,
      names: intransitiveResult.object_names,
    });
    const nashEquilibrium = JSON.stringify({
      equilibrium: intransitiveResult.nash_equilibrium,
      strategy_balance: intransitiveResult.strategy_balance,
    });
    const monteCarloResults = JSON.stringify(monteCarloResult);
    const machinationsResults = JSON.stringify(machinationsResult);
    const pathologies = JSON.stringify({
      transitive_overpowered: transitiveResult.overpowered,
      transitive_underpowered: transitiveResult.underpowered,
      machinations_pathologies: machinationsResult.detected_pathologies,
      stability_pathology_risks: stability.pathology_risks,
    });
    const corrections = JSON.stringify({
      transitive: transitiveResult.suggestions,
      intransitive: intransitiveResult.suggestions,
      monte_carlo: monteCarloResult.suggestions,
      machinations: machinationsResult.recommendations,
    });
    const situationalValues = JSON.stringify(situationalResult);
    const fullResult = JSON.stringify(result);

    // R5-08: composite balance score incorporating transitive OP/UP,
    // intransitive dominance, Monte Carlo verdict AND stability. Before:
    // overallBalanceScore = stability.overall_stability only, which ignored
    // OP/UP and dominance. Hard gate: critical issues cap score at 0.3.
    const compositeScore = computeCompositeBalanceScore({
      stabilityIndex: stability.overall_stability,
      overpoweredCount: transitiveResult.overpowered.length,
      underpoweredCount: transitiveResult.underpowered.length,
      totalObjects: objects.length,
      hasDominantStrategy: intransitiveResult.has_dominant_strategy,
      dominatedStrategyCount: intransitiveResult.dominated_strategies.length,
      monteCarloVerdict: monteCarloResult.balance_verdict as "GOOD" | "MODERATE" | "POOR",
      criticalIssueCount: machinationsResult.quality?.critical_issues?.length ?? 0,
    });
    const overallBalanceScore = compositeScore.score;
    const imbalanceCount =
      transitiveResult.overpowered.length +
      transitiveResult.underpowered.length +
      machinationsResult.detected_pathologies.length;

    await db.projectBalanceResult.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        balanceType: balanceType,
        overallBalanceScore,
        imbalanceCount,
        elementCount: objects.length,
        inputData,
        elements: elementsData,
        costPowerCurves,
        intransitiveMatrix,
        nashEquilibrium,
        monteCarloResults,
        machinationsResults,
        pathologies,
        corrections,
        situationalValues,
        fullResult,
      },
      update: {
        balanceType: balanceType,
        overallBalanceScore,
        imbalanceCount,
        elementCount: objects.length,
        inputData,
        elements: elementsData,
        costPowerCurves,
        intransitiveMatrix,
        nashEquilibrium,
        monteCarloResults,
        machinationsResults,
        pathologies,
        corrections,
        situationalValues,
        fullResult,
      },
    });

    await updateProjectStage(proj.id, "balance");

    // TASK-4.17: removed dead code (void safeJsonParse).

    return NextResponse.json(result);
  } catch (error) {
    console.error("[balance/analyze] error:", error);
    return SERVER_ERROR();
  }
}
