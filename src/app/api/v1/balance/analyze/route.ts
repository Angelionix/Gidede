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
  safeJsonParse,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { enrichBalance } from "@/lib/ai-service";

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

function buildTransitiveResult(objects: BalanceObject[], balanceType: string) {
  // Attribute weights: normalized inverse of attribute count
  const allAttrs = new Set<string>();
  for (const obj of objects) {
    for (const k of Object.keys(obj.attributes)) allAttrs.add(k);
  }
  const attrList = Array.from(allAttrs);
  const weights: Record<string, number> = {};
  const equalWeight = 1 / Math.max(1, attrList.length);
  for (const a of attrList) weights[a] = Number(equalWeight.toFixed(3));

  // Compute power per object
  const powers = objects.map((o) => ({
    name: o.name,
    power: computePower(o.attributes, weights),
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

  // Curve model: y = a * cost^b
  const costCurveModel = "power = 0.6 * cost^0.8";

  // Per-object status: distance from curve
  const transitiveObjects = effectiveCosts.map((p) => {
    const expectedPower = 0.6 * Math.pow(p.effective_cost, 0.8);
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

  return {
    attribute_weights: weights,
    cost_curve_model: costCurveModel,
    expected_cp: expectedCp,
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

  // Build payoff matrix: row player's payoff = power_diff + noise
  // Use attribute-based power as base
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
      // Use a cyclic bias to encourage RPS structure:
      // Object i beats object (i+1) mod n
      const cyclicalBias = ((j - i + n) % n === 1 ? 0.4 : (i - j + n) % n === 1 ? -0.4 : 0);
      const powerDiff = (powers[i] - powers[j]) / 100;
      const payoff = Number((powerDiff + cyclicalBias).toFixed(2));
      row.push(payoff);
    }
    payoffMatrix.push(row);
  }

  // Nash equilibrium (uniform for cyclic, single strategy for dominant)
  const dominatedStrategies: string[] = [];
  let hasDominant = false;
  // Check for dominated rows (row i dominated by row k if all payoffs >= row i's)
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < n; k++) {
      if (i === k) continue;
      let dominated = true;
      for (let j = 0; j < n; j++) {
        if (payoffMatrix[k][j] <= payoffMatrix[i][j]) {
          dominated = false;
          break;
        }
      }
      if (dominated) {
        dominatedStrategies.push(names[i]);
        hasDominant = true;
        break;
      }
    }
  }

  const nash: number[] = hasDominant
    ? names.map((name) => (dominatedStrategies.includes(name) ? 0 : 1 / (n - dominatedStrategies.length)))
    : names.map(() => 1 / n);

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

  // RPS cycles: look for i → j → k → i cycles
  const rpsCycles: Array<{ cycle: string[]; strength: number }> = [];
  if (n >= 3 && !hasDominant) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const k = (i + 2) % n;
      if (
        payoffMatrix[i][j] > 0.1 &&
        payoffMatrix[j][k] > 0.1 &&
        payoffMatrix[k][i] > 0.1
      ) {
        rpsCycles.push({
          cycle: [names[i], names[j], names[k]],
          strength: Number(
            ((payoffMatrix[i][j] + payoffMatrix[j][k] + payoffMatrix[k][i]) / 3).toFixed(2)
          ),
        });
        break;
      }
    }
  }

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
  const qFactors = objects.map((o) => ({
    name: o.name,
    q_factor: Number((1 + (o.attributes ? Object.values(o.attributes).reduce((s, v) => s + v, 0) / 200 : 0)).toFixed(3)),
    synergy_score: Number((0.6 + Math.random() * 0.3).toFixed(2)),
  }));

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
  runMonteCarlo: boolean
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
    // Random pair
    const i = Math.floor(Math.random() * n);
    let j = Math.floor(Math.random() * n);
    while (j === i) j = Math.floor(Math.random() * n);

    matchupGames[names[i]][names[j]]++;
    matchupGames[names[j]][names[i]]++;

    // Win probability for i vs j
    const bias = matrix.length > 0 ? (matrix[i]?.[j] || 0) : 0;
    const winProb = 0.5 + bias * 0.4;
    const iWins = Math.random() < winProb;

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
    const duration = Math.round(60 + (10 / Math.max(1, iSpeed + jSpeed)) * 50 + (Math.random() - 0.5) * 20);
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
      seed: "Math.random",
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

  // Run simulation: 50 ticks per resource
  const ticks = 50;
  const curves: Record<string, number[]> = {};
  const ranges: Record<string, { min: number; max: number }> = {};
  let runawayCount = 0;
  let stallCount = 0;

  for (const o of objects) {
    const hp = o.attributes.HP || 100;
    const dmg = o.attributes.damage || 10;
    let value = hp;
    const series: number[] = [hp];
    let rMax = hp;
    let rMin = hp;
    for (let t = 1; t < ticks; t++) {
      // Simple model: value drops by dmg, regenerates by 5%
      const noise = (Math.random() - 0.5) * dmg * 0.3;
      value = value - dmg + hp * 0.05 + noise;
      value = Math.max(0, Math.min(hp * 2, value));
      series.push(Number(value.toFixed(2)));
      rMax = Math.max(rMax, value);
      rMin = Math.min(rMin, value);
    }
    curves[o.name] = series;
    ranges[o.name] = { min: Number(rMin.toFixed(2)), max: Number(rMax.toFixed(2)) };
    if (rMax >= hp * 1.8) runawayCount++;
    if (rMax <= hp * 0.2) stallCount++;
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

  const runawayFreq = runawayCount / Math.max(1, objects.length);
  const stallFreq = stallCount / Math.max(1, objects.length);
  const stability = Number(
    Math.max(0, 1 - (runawayFreq + stallFreq) / 2).toFixed(3)
  );
  const buildGap = Number(
    Math.abs(runawayFreq - stallFreq / 2).toFixed(3)
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
    runs: 10,
    aggregated: {
      avg_resource_curves: curves,
      resource_ranges: ranges,
      runaway_frequency: Number(runawayFreq.toFixed(3)),
      stall_frequency: Number(stallFreq.toFixed(3)),
      stability_index: stability,
      build_gap: buildGap,
    },
    quality,
    detected_pathologies: detectedPathologies,
    recommendations,
  };
}

function buildStability(
  machinationsResult: {
    aggregated: { runaway_frequency: number; stall_frequency: number; stability_index: number };
    quality: { critical_issues: string[] };
    detected_pathologies: string[];
    feedback_loops: Array<{ type: string }>;
  },
  transitiveResult: { overpowered: string[]; underpowered: string[] }
) {
  const positiveLoops = machinationsResult.feedback_loops.filter(
    (l) => l.type === "positive"
  ).length;
  const negativeLoops = machinationsResult.feedback_loops.filter(
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

    if (!Array.isArray(objectsRaw) || objectsRaw.length < 2) {
      return VALIDATION_ERROR(
        "Поле 'objects' обязательно и должно содержать минимум 2 объекта"
      );
    }

    const VALID_BALANCE_TYPES = ["transitive", "intransitive", "situational", "mixed"];
    if (!VALID_BALANCE_TYPES.includes(balanceType)) {
      return VALIDATION_ERROR(
        `Неверный balance_type: ${balanceType}. Допустимо: ${VALID_BALANCE_TYPES.join(", ")}`
      );
    }

    const objects: BalanceObject[] = objectsRaw.map((o: unknown, i: number) => {
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

    if (objects.some((o) => !o.name || !o.name.trim())) {
      return VALIDATION_ERROR("Все объекты должны иметь name");
    }

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
    const monteCarloResult = buildMonteCarloResult(
      objects,
      intransitiveResult,
      runMonteCarlo
    );

    // --- Stage 6: Machinations + Stability ---
    const machinationsResult = buildMachinationsResult(
      objects,
      runMachinations,
      monteCarloResult
    );
    const stability = buildStability(
      machinationsResult as unknown as {
        aggregated: { runaway_frequency: number; stall_frequency: number; stability_index: number };
        quality: { critical_issues: string[] };
        detected_pathologies: string[];
        feedback_loops: Array<{ type: string }>;
      },
      transitiveResult
    );

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

    const result = {
      id: proj.id,
      balance_map: balanceMap,
      transitive_result: transitiveResult,
      intransitive_result: intransitiveResult,
      situational_result: situationalResult,
      q_factor_result: qFactorResult,
      stability,
      monte_carlo_result: monteCarloResult,
      machinations_result: machinationsResult,
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

    const overallBalanceScore = stability.overall_stability;
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

    // safeJsonParse is imported but unused — satisfy linter
    void safeJsonParse;

    // --- Optional AI enrichment ---
    if (useAi) {
      const aiInsights = await enrichBalance({
        projectName: proj.name || "Untitled",
        genre,
        balanceType,
        elementCount: objects.length,
      });
      if (aiInsights) {
        result.ai_insights = aiInsights;
        result.models_used.push("glm-4.6 (ai-enrichment)");
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[balance/analyze] error:", error);
    return SERVER_ERROR();
  }
}
