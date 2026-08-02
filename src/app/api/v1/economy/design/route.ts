/**
 * POST /api/v1/economy/design
 *
 * Implements Block 5 algorithm 3.6 (Economy designer) with deterministic
 * derived logic. Classifies system type, builds a Machinations graph (nodes,
 * resource flows, state connections, feedback loops), finds conversion chains,
 * detects pathologies (inflation / drain / stall / runaway), proposes
 * corrections, and simulates the system over N ticks.
 *
 * Body:
 *   { genre, monetization_type, openness, project_id? }
 *
 * Persists to ProjectEconomy (upsert where projectId) and updates project
 * stage to "economy".
 *
 * Response: EconomyDesignResponse (matches src/types/economy.ts).
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
import { enrichEconomy } from "@/lib/ai-service";
import { runGraphSimulation } from "@/lib/economy/graph-simulation";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import { assertStageOutput, STAGE_CONTRACT_VERSION, validateStageInput } from "@/lib/contracts/stage-contracts";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";

const VALID_MONETIZATION = [
  "f2p",
  "b2p",
  "subscription",
  "p2w",
  "cosmetic",
  "hybrid",
];
const VALID_OPENNESS = ["open", "closed", "mixed"];

interface ResourceDef {
  name: string;
  resource_class: string; // core | subsidiary | currency | consumable | meta
  resource_type: string;
  initial_value: number;
  bounds: { min: number; max: number };
  is_consumable: boolean;
  is_catalytic: boolean;
  is_anchor: boolean;
}

interface MachNode {
  id: string;
  name: string;
  node_type: string;
  initial_value: number;
  capacity: number | null;
  rate: number | null;
}

interface ResourceFlow {
  source_id: string;
  target_id: string;
  resource: string;
  rate: number;
}

interface StateConnection {
  source_id: string;
  target_id: string;
  modifier: string;
  formula: string;
}

interface FeedbackLoop {
  nodes: string[];
  loop_type: string;
  strength: number;
  description: string;
}

interface Pathology {
  name: string;
  severity: string;
  description: string;
  affected_resources: string[];
  correction: string;
}

interface Adjustment {
  resource: string;
  action: string;
  current_rate: number;
  new_rate: number;
  reason: string;
}

// TASK-5b.10: Expanded to 15 genres (was 5 + default).
const GENRE_RESOURCE_PRESETS: Record<
  string,
  { core: string[]; subsidiary: string[] }
> = {
  rpg: { core: ["xp", "gold", "hp"], subsidiary: ["mana", "stamina", "materials"] },
  shooter: { core: ["score", "ammo", "armor"], subsidiary: ["credits", "scrap", "intel"] },
  strategy: { core: ["wood", "food", "gold", "stone"], subsidiary: ["population", "research", "favor"] },
  mmorpg: { core: ["gold", "xp", "reputation"], subsidiary: ["honor", "tokens", "crafting_mats"] },
  idle: { core: ["coins", "gems", "energy"], subsidiary: ["prestige_points", "automation", "research"] },
  // TASK-5b.10: 10 new genre presets.
  tower_defense: { core: ["gold", "lives", "waves"], subsidiary: ["gems", "tower_xp", "stars"] },
  puzzle: { core: ["score", "moves", "time"], subsidiary: ["hints", "combos", "stars"] },
  metroidvania: { core: ["hp", "energy", "map_percent"], subsidiary: ["missiles", "keys", "artifacts"] },
  rhythm: { core: ["score", "combo", "accuracy"], subsidiary: ["stars", "coins", "unlocks"] },
  sandbox: { core: ["blocks", "health", "materials"], subsidiary: ["fuel", "tools", "blueprints"] },
  simulation: { core: ["money", "happiness", "population"], subsidiary: ["resources", "research", "influence"] },
  racing: { core: ["credits", "nitro", "position"], subsidiary: ["blueprints", "upgrades", "rep"] },
  roguelike: { core: ["gold", "relics", "hp"], subsidiary: ["potions", "keys", "soul_stones"] },
  survival_horror: { core: ["hp", "hunger", "thirst"], subsidiary: ["wood", "stone", "fiber"] },
  horror: { core: ["sanity", "hp", "items"], subsidiary: ["ammo", "keys", "clues"] },
  default: { core: ["score", "currency", "energy"], subsidiary: ["materials", "tokens"] },
};

function pickResources(genre: string): {
  core: string[];
  subsidiary: string[];
} {
  return GENRE_RESOURCE_PRESETS[genre] || GENRE_RESOURCE_PRESETS.default;
}

function classifySystemType(
  resources: ResourceDef[],
  openness: string,
  monetization: string
): {
  type: string;
  sub_type: string;
  dominant_loop: string;
  interaction_type: string;
  pricing_type: string;
  risk_level: string;
  openness: string;
} {
  const hasConverter = resources.some(
    (r) => r.resource_class === "currency" || r.is_catalytic
  );
  const hasConsumable = resources.some((r) => r.is_consumable);
  const hasMeta = resources.some((r) => r.resource_class === "meta");

  let type = "Economy";
  if (hasMeta && hasConverter) type = "Ecology";
  else if (!hasConverter && !hasConsumable) type = "Engine";

  const sub_type =
    openness === "open"
      ? "player_driven_market"
      : openness === "closed"
        ? "single_currency_economy"
        : "hybrid_economy";

  const dominantLoopName = hasMeta ? "meta_loop" : "core_economy_loop";
  const interactionType =
    openness === "open" ? "PvP_trade" : openness === "mixed" ? "hybrid" : "PvE_sinks";

  const pricingType =
    monetization === "f2p"
      ? "dual_currency"
      : monetization === "subscription"
        ? "subscription_sink"
        : monetization === "cosmetic"
          ? "cosmetic_only"
          : "single_purchase";

  const riskLevel =
    type === "Ecology" ? "high" : type === "Engine" ? "low" : "medium";

  return {
    type,
    sub_type,
    dominant_loop: dominantLoopName,
    interaction_type: interactionType,
    pricing_type: pricingType,
    risk_level: riskLevel,
    openness,
  };
}

function buildMachinations(
  resources: ResourceDef[],
  anchor: string,
  classification: { type: string }
): {
  nodes: MachNode[];
  resource_flows: ResourceFlow[];
  state_connections: StateConnection[];
  feedback_loops: FeedbackLoop[];
  economic_type: string;
  structural_patterns: string[];
} {
  const nodes: MachNode[] = [];
  const flows: ResourceFlow[] = [];
  const stateConns: StateConnection[] = [];
  const feedbackLoops: FeedbackLoop[] = [];

  // Source for each currency/currency resource
  for (const r of resources) {
    let nodeType = "pool";
    let capacity: number | null = null;
    let rate: number | null = null;
    if (r.resource_class === "currency" || r.name === "gold" || r.name === "coins") {
      nodeType = r.is_anchor ? "pool" : "source";
      rate = 1.0;
    } else if (r.is_consumable) {
      nodeType = "drain";
      rate = 0.3;
    } else if (r.is_catalytic) {
      nodeType = "converter";
      rate = 0.5;
    } else if (r.resource_class === "core") {
      nodeType = "pool";
      capacity = r.bounds.max;
    }
    nodes.push({
      id: r.name,
      name: r.name,
      node_type: nodeType,
      initial_value: r.initial_value,
      capacity,
      rate,
    });
  }

  // Flows: anchor → consumable, source → pool, converter in/out
  for (const r of resources) {
    if (r.is_catalytic) {
      // converter: anchor → converter → 2 outputs
      flows.push({
        source_id: anchor,
        target_id: r.name,
        resource: anchor,
        rate: 0.5,
      });
      const outputs = resources.filter(
        (o) => o.name !== r.name && o.name !== anchor && o.resource_class !== "currency"
      );
      for (let i = 0; i < Math.min(2, outputs.length); i++) {
        flows.push({
          source_id: r.name,
          target_id: outputs[i].name,
          resource: outputs[i].name,
          rate: 0.4,
        });
      }
    } else if (r.is_consumable) {
      flows.push({
        source_id: r.name,
        target_id: "drain_sink",
        resource: r.name,
        rate: 0.3,
      });
      // ensure drain_sink node exists
      if (!nodes.find((n) => n.id === "drain_sink")) {
        nodes.push({
          id: "drain_sink",
          name: "Drain Sink",
          node_type: "drain",
          initial_value: 0,
          capacity: null,
          rate: null,
        });
      }
    }
  }

  // State connections: every pool gates its converter
  for (const r of resources) {
    if (r.is_catalytic) {
      stateConns.push({
        source_id: anchor,
        target_id: r.name,
        modifier: "+",
        formula: `if ${anchor} > 0 then activate ${r.name}`,
      });
    }
  }

  // TASK-5b.2 FIXED: feedback_loops nodes now use REAL resource names, not literals.
  // Before: used "converter" and "consumable" which don't exist as node IDs.
  // After: uses actual catalytic and consumable resource names from the resources array.
  const catalyticNames = resources.filter((r) => r.is_catalytic).map((r) => r.name);
  const consumableNames = resources.filter((r) => r.is_consumable).map((r) => r.name);

  // Reinforcing loop: anchor → first catalytic → first consumable → anchor
  if (catalyticNames.length > 0 && consumableNames.length > 0) {
    feedbackLoops.push({
      nodes: [anchor, catalyticNames[0], consumableNames[0], anchor],
      loop_type: "reinforcing",
      strength: 0.7,
      description: "Core production cycle: anchor fuels converters producing consumables",
    });
  } else if (catalyticNames.length > 0) {
    // Fallback: anchor → catalytic → anchor (no consumables in set)
    feedbackLoops.push({
      nodes: [anchor, catalyticNames[0], anchor],
      loop_type: "reinforcing",
      strength: 0.6,
      description: "Production cycle: anchor fuels converter",
    });
  } else {
    // Fallback: anchor → first subsidiary → anchor
    const subNames = resources.filter((r) => r.resource_class === "subsidiary").map((r) => r.name);
    if (subNames.length > 0) {
      feedbackLoops.push({
        nodes: [anchor, subNames[0], anchor],
        loop_type: "reinforcing",
        strength: 0.5,
        description: "Basic production cycle: anchor to subsidiary and back",
      });
    }
  }

  // Balancing loop: anchor → drain_sink → anchor (if drain_sink exists)
  if (nodes.find((n) => n.id === "drain_sink")) {
    feedbackLoops.push({
      nodes: [anchor, "drain_sink", anchor],
      loop_type: "balancing",
      strength: 0.5,
      description: "Anchor sink prevents runaway accumulation",
    });
  }

  const patterns: string[] = [];
  patterns.push("source_pool_drain");
  if (resources.some((r) => r.is_catalytic)) patterns.push("converter_chain");
  if (resources.some((r) => r.is_consumable)) patterns.push("consumable_burn");
  if (classification.type === "Ecology") patterns.push("ecological_balance");
  if (classification.type === "Engine") patterns.push("engine_accumulator");

  return {
    nodes,
    resource_flows: flows,
    state_connections: stateConns,
    feedback_loops: feedbackLoops,
    economic_type: classification.type,
    structural_patterns: patterns,
  };
}

function findConversionChains(resources: ResourceDef[]): {
  chains: Array<{
    inputs: string[];
    outputs: string[];
    profitability: number;
    tier: number;
    risk: string;
  }>;
  avg_profitability: number;
  tier_coverage: Record<string, boolean>;
  warnings: string[];
} {
  const chains: Array<{
    inputs: string[];
    outputs: string[];
    profitability: number;
    tier: number;
    risk: string;
  }> = [];
  const currencies = resources.filter(
    (r) => r.resource_class === "currency" || r.is_anchor
  );
  const catalytic = resources.filter((r) => r.is_catalytic);
  const outputs = resources.filter(
    (r) => r.resource_class === "subsidiary" || r.is_consumable
  );

  for (let i = 0; i < catalytic.length; i++) {
    const c = catalytic[i];
    const input = currencies[0] || resources[0];
    const output = outputs[i % outputs.length] || resources[resources.length - 1];
    // TASK-5b.3 FIXED: deterministic profitability (Bible 6.9.1).
    // Before: 0.8 + Math.random() * 0.4 — non-deterministic, unrelated to actual flows.
    // After: Profitability = (output_value / input_value) × frequency − opportunity_cost
    //   where frequency = c.initial_value / 10, opportunity_cost = 0.1 * (i + 1).
    const outputValue = output.initial_value || 10;
    const inputValue = input.initial_value || 50;
    const frequency = c.initial_value / 10;
    const opportunityCost = 0.1 * (i + 1);
    const profitability = Number(
      ((outputValue / Math.max(1, inputValue)) * frequency - opportunityCost).toFixed(2)
    );
    chains.push({
      inputs: [input.name],
      outputs: [output.name],
      profitability,
      tier: i + 1,
      risk: profitability > 1.0 ? "low" : profitability > 0.85 ? "medium" : "high",
    });
  }

  const avg =
    chains.length > 0
      ? Number(
          (chains.reduce((s, c) => s + c.profitability, 0) / chains.length).toFixed(3)
        )
      : 0;
  const tierCoverage: Record<string, boolean> = {};
  for (const c of chains) {
    tierCoverage[`tier_${c.tier}`] = true;
  }

  const warnings: string[] = [];
  if (chains.length === 0) warnings.push("Не найдено цепочек конверсии");
  if (avg < 0.9)
    warnings.push("Средняя прибыльность ниже 1.0 — экономика в убытке");

  return {
    chains,
    avg_profitability: avg,
    tier_coverage: tierCoverage,
    warnings,
  };
}

function detectPathologies(
  resources: ResourceDef[],
  faucetDrain: Record<string, { faucet: number; drain: number; ratio: number; is_fallback?: boolean }>
): Pathology[] {
  const pathologies: Pathology[] = [];

  // Inflation: ratio > 1.5 for anchor
  for (const [name, data] of Object.entries(faucetDrain)) {
    // R-AUDIT-FIX (#10): skip pathology detection for fallback entries.
    // When a resource has no graph flows, faucet/drain are class-based
    // heuristics — diagnosing "Инфляция" from a heuristic ratio would
    // recreate the circulus vitiosus pattern flagged in the original audit.
    if (data.is_fallback) continue;
    if (data.ratio > 1.5) {
      pathologies.push({
        name: "Инфляция",
        severity: data.ratio > 2 ? "critical" : "warning",
        description: `Ресурс «${name}» производится быстрее, чем тратится (ratio ${data.ratio.toFixed(2)})`,
        affected_resources: [name],
        correction: `Увеличьте drain «${name}» на ${Math.round((data.ratio - 1) * 100)}%`,
      });
    } else if (data.ratio < 0.5) {
      pathologies.push({
        name: "Дефляция / Drain",
        severity: data.ratio < 0.3 ? "critical" : "warning",
        description: `Ресурс «${name}» тратится быстрее, чем производится (ratio ${data.ratio.toFixed(2)})`,
        affected_resources: [name],
        correction: `Увеличьте faucet «${name}» или снизьте drain на ${Math.round((1 - data.ratio) * 100)}%`,
      });
    }
  }

  // Stall: any resource with both faucet and drain near 0
  for (const r of resources) {
    const d = faucetDrain[r.name];
    if (d && d.faucet < 0.2 && d.drain < 0.2) {
      pathologies.push({
        name: "Стагнация",
        severity: "info",
        description: `Ресурс «${r.name}» почти не используется в цикле`,
        affected_resources: [r.name],
        correction: "Подключите ресурс к активной цепочке конверсии",
      });
    }
  }

  // Runaway: catalytic resource producing too much
  for (const r of resources) {
    if (r.is_catalytic) {
      const d = faucetDrain[r.name];
      if (d && d.faucet > 1.0) {
        pathologies.push({
          name: "Убегание",
          severity: "warning",
          description: `Катализатор «${r.name}» производит слишком много (${d.faucet.toFixed(2)}/тик)`,
          affected_resources: [r.name],
          correction: "Снизьте rate конвертера или добавьте sink",
        });
      }
    }
  }

  // TASK-5b.8: Bible 6.10 — 2 missing pathologies (Arbitrage + Deadlock).

  // 6.10.5: Arbitrage — conversion chain with profitability > 1.5 creates risk-free profit loop.
  // Detected when a catalytic resource has very high faucet and low drain (ratio > 2).
  for (const r of resources) {
    if (r.is_catalytic) {
      const d = faucetDrain[r.name];
      if (d && d.ratio > 2.0) {
        pathologies.push({
          name: "Арбитраж",
          severity: "warning",
          description: `Катализатор «${r.name}» имеет ratio ${d.ratio.toFixed(2)} — безрисковый arbitrage loop`,
          affected_resources: [r.name],
          correction: "Снизьте прибыльность конверсии или увеличьте opportunity cost",
        });
      }
    }
  }

  // 6.10.6: Deadlock — resource with both faucet and drain = 0 (completely disconnected).
  for (const r of resources) {
    const d = faucetDrain[r.name];
    if (d && d.faucet === 0 && d.drain === 0) {
      pathologies.push({
        name: "Deadlock",
        severity: "critical",
        description: `Ресурс «${r.name}» полностью отключён от экономики (faucet=0, drain=0)`,
        affected_resources: [r.name],
        correction: "Подключите ресурс к активной цепочке конверсии или удалите его",
      });
    }
  }

  return pathologies;
}

function computeOverallSeverity(pathologies: Pathology[]): string {
  if (pathologies.some((p) => p.severity === "critical")) return "critical";
  if (pathologies.some((p) => p.severity === "warning")) return "warning";
  if (pathologies.length > 0) return "info";
  return "ok";
}

function proposeAdjustments(
  pathologies: Pathology[],
  faucetDrain: Record<string, { faucet: number; drain: number; ratio: number; is_fallback?: boolean }>
): Adjustment[] {
  const adjustments: Adjustment[] = [];
  for (const p of pathologies) {
    if (p.name === "Инфляция") {
      const res = p.affected_resources[0];
      const d = faucetDrain[res];
      adjustments.push({
        resource: res,
        action: "increase_drain",
        current_rate: d.drain,
        new_rate: Number((d.drain * (d.ratio > 2 ? 2.2 : 1.5)).toFixed(2)),
        reason: p.description,
      });
    } else if (p.name === "Дефляция / Drain") {
      const res = p.affected_resources[0];
      const d = faucetDrain[res];
      adjustments.push({
        resource: res,
        action: "increase_faucet",
        current_rate: d.faucet,
        new_rate: Number((d.faucet * (d.ratio < 0.3 ? 2.5 : 1.7)).toFixed(2)),
        reason: p.description,
      });
    } else if (p.name === "Убегание") {
      const res = p.affected_resources[0];
      const d = faucetDrain[res];
      adjustments.push({
        resource: res,
        action: "decrease_faucet",
        current_rate: d.faucet,
        new_rate: Number((d.faucet * 0.7).toFixed(2)),
        reason: p.description,
      });
    }
  }
  return adjustments;
}

// TASK-5b.6: Deterministic PRNG (mulberry32) for reproducible economy simulation.
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

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function simulate(
  resources: ResourceDef[],
  faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>,
  ticks: number,
  seed: number,
  numRuns = 10
): {
  config: Record<string, unknown>;
  aggregated: {
    avg_resource_curves: Record<string, number[]>;
    resource_ranges: Record<string, { min: number; max: number }>;
    runaway_frequency: number;
    stall_frequency: number;
    stability_index: number;
    build_gap: number;
  };
  quality: {
    resources_in_bounds: boolean;
    progression_pacing_ok: boolean;
    no_runaway_for_minmaxer: boolean;
    no_stall_for_casual: boolean;
    build_gap_acceptable: boolean;
    economy_stable: boolean;
    overall_pass: boolean;
    critical_issues: string[];
  };
  snapshots_count: number;
} {
  // R-AUDIT-FIX (#1): was running a single pass but reporting `num_runs: 10`
  // in the config — misleading. Now runs `numRuns` independent passes with
  // different seeds (baseSeed + runIndex * golden ratio constant, same pattern
  // as src/lib/balance/multi-run-sim.ts) and averages the per-resource curves.
  // Diagnostics (runaway/stall frequency, stability, build_gap) are computed
  // from the averaged curves, so they reflect the actual distribution of
  // outcomes across runs rather than a single sample.
  const rng = mulberry32(seed);
  const avgCurves: Record<string, number[]> = {};
  const avgRanges: Record<string, { min: number; max: number }> = {};
  for (const r of resources) {
    avgCurves[r.name] = new Array(ticks).fill(0);
    avgRanges[r.name] = { min: Infinity, max: -Infinity };
  }

  let totalRunaway = 0;
  let totalStall = 0;

  for (let run = 0; run < numRuns; run++) {
    // Per-run seed: deterministic, depends on base seed + run index.
    const runSeed = seed + run * 0x9e3779b9;
    const runRng = mulberry32(runSeed);
    const runCurves: Record<string, number[]> = {};
    const runRanges: Record<string, { min: number; max: number }> = {};
    let runRunaway = 0;
    let runStall = 0;

    for (const r of resources) {
      let value = r.initial_value;
      const series: number[] = [];
      let rMax = value;
      let rMin = value;
      for (let t = 0; t < ticks; t++) {
        const d = faucetDrain[r.name] || { faucet: 0.3, drain: 0.3, ratio: 1 };
        const noise = (runRng() - 0.5) * 0.2;
        value = value + d.faucet - d.drain + noise;
        value = Math.max(r.bounds.min, Math.min(r.bounds.max, value));
        series.push(Number(value.toFixed(2)));
        rMax = Math.max(rMax, value);
        rMin = Math.min(rMin, value);
      }
      runCurves[r.name] = series;
      runRanges[r.name] = { min: Number(rMin.toFixed(2)), max: Number(rMax.toFixed(2)) };
      const valueChange = Math.abs(rMax - rMin);
      const relativeChange = r.initial_value > 0 ? valueChange / r.initial_value : 0;
      if (rMax >= r.bounds.max * 0.95) runRunaway++;
      if (relativeChange < 0.05) runStall++;
    }

    // Accumulate per-resource stats for averaging.
    for (const r of resources) {
      for (let t = 0; t < ticks; t++) {
        avgCurves[r.name][t] += runCurves[r.name][t] / numRuns;
      }
      avgRanges[r.name].min = Math.min(avgRanges[r.name].min, runRanges[r.name].min);
      avgRanges[r.name].max = Math.max(avgRanges[r.name].max, runRanges[r.name].max);
    }
    totalRunaway += runRunaway;
    totalStall += runStall;
  }

  // Round averaged curves.
  for (const r of resources) {
    avgCurves[r.name] = avgCurves[r.name].map((v) => Number(v.toFixed(2)));
    if (!isFinite(avgRanges[r.name].min)) avgRanges[r.name].min = 0;
    if (!isFinite(avgRanges[r.name].max)) avgRanges[r.name].max = 0;
  }

  // Average frequencies across runs.
  const runawayFreq = totalRunaway / (numRuns * Math.max(1, resources.length));
  const stallFreq = totalStall / (numRuns * Math.max(1, resources.length));
  const stability = Number(
    Math.max(0, 1 - (runawayFreq + stallFreq) / 2).toFixed(3)
  );
  const buildGap = Number((Math.abs(runawayFreq - stallFreq) / 2).toFixed(3));

  const criticalIssues: string[] = [];
  if (runawayFreq > 0.3) criticalIssues.push("Высокая частота убегания ресурсов");
  if (stallFreq > 0.3) criticalIssues.push("Высокая частота стагнации");

  const quality = {
    resources_in_bounds: runawayFreq < 0.3 && stallFreq < 0.3,
    progression_pacing_ok: buildGap < 0.25,
    no_runaway_for_minmaxer: runawayFreq < 0.4,
    no_stall_for_casual: stallFreq < 0.4,
    build_gap_acceptable: buildGap < 0.25,
    economy_stable: stability > 0.6,
    overall_pass: criticalIssues.length === 0 && stability > 0.6,
    critical_issues: criticalIssues,
  };

  // Suppress unused warning for the legacy single-run rng (kept for seed stability).
  void rng;

  return {
    config: { ticks, num_runs: numRuns, recording_interval: 5 },
    aggregated: {
      avg_resource_curves: avgCurves,
      resource_ranges: avgRanges,
      runaway_frequency: Number(runawayFreq.toFixed(3)),
      stall_frequency: Number(stallFreq.toFixed(3)),
      stability_index: stability,
      build_gap: buildGap,
    },
    quality,
    snapshots_count: ticks * numRuns,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const contractInput = validateStageInput("economy", body);
    if (!contractInput.success) return VALIDATION_ERROR(contractInput.error);
    const projectId = body?.project_id?.toString().trim() || undefined;
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    const genre = body?.genre?.toString().trim() || "rpg";
    const monetizationType =
      body?.monetization_type?.toString().trim() || "b2p";
    const openness = body?.openness?.toString().trim() || "mixed";

    if (!VALID_MONETIZATION.includes(monetizationType)) {
      return VALIDATION_ERROR(`Неверный тип монетизации: ${monetizationType}`);
    }
    if (!VALID_OPENNESS.includes(openness)) {
      return VALIDATION_ERROR(`Неверная открытость: ${openness}`);
    }

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as {
      id: string; name: string; genre: string | null;
      concept?: { genre?: string | null; inputData?: string | null } | null;
    };

    // TASK-5b.7: Derive genre/monetization/openness from concept if not in body.
    let resolvedGenre = genre;
    if ((!resolvedGenre || resolvedGenre === "rpg") && proj.concept?.genre) {
      resolvedGenre = proj.concept.genre;
    }
    // Try to load monetization from concept inputData.
    let resolvedMonetization = monetizationType;
    let resolvedOpenness = openness;
    if (proj.concept?.inputData) {
      try {
        const conceptInput = JSON.parse(proj.concept.inputData);
        if (conceptInput.monetization_model && !body?.monetization_type) {
          resolvedMonetization = conceptInput.monetization_model;
        }
      } catch { /* ignore */ }
    }

    // --- Build resource inventory ---
    // R5-13: when Core Loop resource flows are available (forwarded by the
    // pipeline runner), build the resource inventory from the actual game
    // loop instead of genre presets. Falls back to genre preset when Core
    // Loop hasn't run or has no resource data.
    const coreLoopResources = Array.isArray(body?.core_loop_resources)
      ? (body.core_loop_resources as Array<{
          name: string;
          role: string;
          produced: boolean;
          consumed: boolean;
        }>)
      : [];
    const resourceSource = coreLoopResources.length > 0
      ? "core_loop_steps_data"
      : "genre_preset";
    const preset = pickResources(resolvedGenre);
    const resources: ResourceDef[] = [];

    if (coreLoopResources.length > 0) {
      // Build from Core Loop resource flows.
      for (const clr of coreLoopResources) {
        const isAnchor = clr.role === "anchor";
        const isFaucet = clr.role === "faucet";
        const isDrain = clr.role === "drain";
        resources.push({
          name: clr.name,
          resource_class: isAnchor ? "core" : "subsidiary",
          resource_type: isAnchor ? "core" : "currency",
          initial_value: isAnchor ? 100 : isDrain ? 10 : 50,
          bounds: { min: 0, max: isAnchor ? 1000 : 10000 },
          is_consumable: isDrain,
          is_catalytic: !isAnchor && !isDrain && !isFaucet,
          is_anchor: isAnchor,
        });
      }
    } else {
      // Fallback: genre preset (pre-R5-13 behavior).
      const anchorName = preset.core[0] || "score";
      for (const name of preset.core) {
        const isAnchor = name === anchorName;
        resources.push({
          name,
          resource_class: "core",
          resource_type: isAnchor ? "core" : "currency",
          initial_value: isAnchor ? 100 : 50,
          bounds: { min: 0, max: isAnchor ? 1000 : 10000 },
          is_consumable: false,
          is_catalytic: false,
          is_anchor: isAnchor,
        });
      }
    }
    // R5-13: only add genre-preset subsidiary resources when not using
    // Core Loop resources (Core Loop already provides the full resource set).
    if (coreLoopResources.length === 0) {
      for (let i = 0; i < preset.subsidiary.length; i++) {
      const name = preset.subsidiary[i];
      const isCatalytic = i % 2 === 0;
      const isConsumable = i % 3 === 1;
      resources.push({
        name,
        resource_class: "subsidiary",
        resource_type: isCatalytic ? "subsidiary" : "consumable",
        initial_value: 10,
        bounds: { min: 0, max: 500 },
        is_consumable: isConsumable,
        is_catalytic: isCatalytic,
        is_anchor: false,
      });
      }
    }
    // Add a premium currency if F2P
    if (resolvedMonetization === "f2p" || resolvedMonetization === "hybrid") {
      resources.push({
        name: "gems",
        resource_class: "currency",
        resource_type: "currency",
        initial_value: 0,
        bounds: { min: 0, max: 99999 },
        is_consumable: false,
        is_catalytic: false,
        is_anchor: false,
      });
    }

    // R5-13: anchor is the first core resource, or the first Core Loop
    // anchor resource when using Core Loop data.
    const anchor = coreLoopResources.length > 0
      ? (coreLoopResources.find((r) => r.role === "anchor")?.name ?? coreLoopResources[0]?.name ?? "score")
      : (preset.core[0] || "score");
    const coreCount = resources.filter((r) => r.resource_class === "core").length;
    const subsidiaryCount = resources.filter(
      (r) => r.resource_class !== "core"
    ).length;

    const inventory = {
      resources,
      anchor,
      core_count: coreCount,
      subsidiary_count: subsidiaryCount,
    };

    // --- Classification ---
    const classification = classifySystemType(resources, resolvedOpenness, resolvedMonetization);
    (classification as Record<string, unknown>).monetization_type = resolvedMonetization;
    (classification as Record<string, unknown>).genre = resolvedGenre;

    // --- Machinations model ---
    const machinations = buildMachinations(resources, anchor, classification);

    // --- Conversion graph ---
    const conversionGraph = findConversionChains(resources);

    // TASK-5b.4 FIXED: faucet/drain derived from actual resource flows in machinations graph.
    // Before: hardcoded by class (catalytic=1.0, currency=0.8, etc.) — circulus vitiosus.
    // After: count actual flows producing (faucet) and consuming (drain) each resource.
    // R-AUDIT-FIX (#10): when a resource has no flows, the fallback class-based
    // values are still used for diagnostics (pathology detection via ratio),
    // but the entry is marked `is_fallback: true` so downstream consumers know
    // this is a heuristic, not measured behavior. The single-pool simulation
    // now uses faucet=0, drain=0 for fallback resources — a resource with no
    // flows in the graph should not move in the simulation either.
    const faucetDrain: Record<string, { faucet: number; drain: number; ratio: number; is_fallback: boolean }> = {};
    const simFaucetDrain: Record<string, { faucet: number; drain: number; ratio: number }> = {};
    for (const r of resources) {
      // R5-14: fixed producingFlows filter. Was `f.target_id === r.name || f.resource === r.name`
      // — the second clause incorrectly matched outbound flows carrying r.name as
      // "producing" r (e.g. flow {source: xp, target: mana, resource: xp} was counted as
      // producing xp, when xp is actually being consumed). Now only checks target_id.
      const producingFlows = machinations.resource_flows.filter(
        (f) => f.target_id === r.name
      );
      // Count flows that consume this resource (r.name → target means r gives away).
      const consumingFlows = machinations.resource_flows.filter(
        (f) => f.source_id === r.name
      );
      const hasFlows = producingFlows.length > 0 || consumingFlows.length > 0;
      // Faucet = sum of producing flow rates (or fallback to class-based if no flows).
      const fallbackFaucet = r.is_catalytic ? 0.8 : r.resource_class === "currency" ? 0.6 : 0.4;
      const fallbackDrain = r.is_consumable ? 0.5 : r.resource_class === "currency" ? 0.5 : 0.3;
      const faucet = producingFlows.length > 0
        ? Number(producingFlows.reduce((s, f) => s + f.rate, 0).toFixed(3))
        : fallbackFaucet;
      // Drain = sum of consuming flow rates (or fallback).
      const drain = consumingFlows.length > 0
        ? Number(consumingFlows.reduce((s, f) => s + f.rate, 0).toFixed(3))
        : fallbackDrain;
      const ratio = drain > 0 ? Number((faucet / drain).toFixed(3)) : 0;
      faucetDrain[r.name] = { faucet, drain, ratio, is_fallback: !hasFlows };
      // For single-pool simulation: use real values when flows exist, 0 otherwise.
      // A resource with no graph flows should not move in the simulation either.
      simFaucetDrain[r.name] = hasFlows
        ? { faucet, drain, ratio }
        : { faucet: 0, drain: 0, ratio: 0 };
    }

    // --- Diagnostics ---
    const pathologies = detectPathologies(resources, faucetDrain);
    const overallSeverity = computeOverallSeverity(pathologies);
    const diagnostics = {
      pathologies,
      faucet_drain_ratios: faucetDrain,
      overall_severity: overallSeverity,
    };

    // --- Balance / corrections ---
    const adjustments = proposeAdjustments(pathologies, faucetDrain);
    const targetRatio = 1.0;
    const balancePhase =
      overallSeverity === "critical"
        ? "major_rebalance"
        : overallSeverity === "warning"
          ? "minor_tuning"
          : "balanced";

    const balance = {
      adjustments,
      phase: balancePhase,
      target_ratio: targetRatio,
    };

    // --- Simulation ---
    // TASK-5b.6: deterministic seed from projectId for reproducible results.
    const simSeed = hashString(proj.id || "economy-default-seed");
    // R-AUDIT-FIX (#10): pass simFaucetDrain (which zeros out faucet/drain for
    // resources without graph flows) instead of faucetDrain (which keeps the
    // class-based fallback). This prevents single-pool simulation from
    // hallucinating movement for disconnected resources.
    const simResult = simulate(resources, simFaucetDrain, 50, simSeed);

    // R5-15: execute the Machinations graph (nodes + resource_flows +
    // state_connections) as a real resource-flow simulation, not just
    // single-pool decay. The graph sim provides diagnostics derived from the
    // actual graph structure, complementing the single-pool simResult.
    const graphSimResult = runGraphSimulation(
      machinations.nodes.map((n) => ({
        id: n.id,
        type: n.node_type,
        rate: n.rate ?? undefined,
        capacity: n.capacity ?? undefined,
      })),
      machinations.resource_flows.map((f) => ({
        source_id: f.source_id,
        target_id: f.target_id,
        resource: f.resource,
        rate: f.rate,
      })),
      machinations.state_connections.map((sc) => ({
        source_id: sc.source_id,
        target_id: sc.target_id,
        modifier: sc.modifier,
        formula: sc.formula ?? undefined,
      })),
      resources.map((r) => ({ name: r.name, initial_value: r.initial_value, bounds: r.bounds })),
      50,
      simSeed,
    );

    // TASK-5b.9: 12-point validation checklist (Bible 6.13.4).
    // R-AUDIT-FIX (#2): checklist now consults BOTH the single-pool simResult
    // AND the graph_sim_result. Stability (#8) and runaway (#12) are taken as
    // the WORST of the two — if either simulation shows instability, the
    // checklist fails. Before this fix, graph_sim_result was computed but
    // never consumed, making it purely cosmetic.
    const graphStability = graphSimResult.stability_index;
    const graphRunawayFreq = graphSimResult.runaway_frequency;
    const effectiveStability = Math.min(simResult.aggregated.stability_index, graphStability);
    const effectiveRunawayFreq = Math.max(simResult.aggregated.runaway_frequency, graphRunawayFreq);
    const checklist = {
      1: resources.length >= 2, // Минимум 2 ресурса
      2: resources.some((r) => r.is_catalytic), // Есть конвертер
      3: resources.some((r) => r.is_consumable), // Есть consumable
      4: machinations.feedback_loops.length >= 1, // Есть feedback loop
      5: machinations.feedback_loops.some((l) => l.loop_type === "reinforcing"), // Reinforcing loop
      6: machinations.feedback_loops.some((l) => l.loop_type === "balancing"), // Balancing loop
      7: pathologies.filter((p) => p.severity === "critical").length === 0, // No critical pathologies
      8: effectiveStability > 0.5, // Stability > 0.5 (worst of single-pool + graph)
      9: conversionGraph.chains.length > 0, // Есть conversion chains
      10: conversionGraph.avg_profitability > 0, // Прибыльность > 0
      11: !resources.some((r) => faucetDrain[r.name]?.faucet === 0 && faucetDrain[r.name]?.drain === 0 && !faucetDrain[r.name]?.is_fallback), // No deadlock (real resources with no flows)
      12: effectiveRunawayFreq < 0.5, // No runaway (worst of single-pool + graph)
    };
    const checklistPassed = Object.values(checklist).filter(Boolean).length;

    // TASK-5b.12: 8-dimensional feedback loop profile (Bible 6.8.2).
    const loopProfiles = machinations.feedback_loops.map((loop) => ({
      nodes: loop.nodes,
      type: loop.loop_type,
      effect: loop.loop_type === "reinforcing" ? "amplification" : "dampening",
      investment: loop.nodes.length > 2 ? "multi_step" : "single_step",
      return_type: loop.loop_type === "reinforcing" ? "compounding" : "normalizing",
      speed: loop.strength > 0.6 ? "fast" : loop.strength > 0.4 ? "medium" : "slow",
      duration: "continuous", // All loops run continuously in economy
      indirectness: loop.nodes.length > 3 ? "indirect" : "direct",
      determinism: "deterministic", // Economy loops are deterministic (no RNG in feedback)
      description: loop.description,
    }));

    // TASK-5b.13: 6 Schreiber economic system types (Bible 6.4.3).
    const schreiberTypes = {
      current: classification.type.toLowerCase(),
      all_types: ["static_engine", "dynamic_engine", "engine_building", "static_friction", "dynamic_friction", "stopping_mechanism"],
      description: classification.type === "Engine"
        ? "Static/Dynamic Engine — accumulates resources over time"
        : classification.type === "Ecology"
        ? "Engine Building + Stopping Mechanism — balanced production and consumption"
        : "Dynamic Friction + Converter — resource conversion with friction",
    };

    // TASK-5b.14: Genre-specific dominant loops (Bible 6.8.3).
    const genreDominantLoops: Record<string, string> = {
      rpg: "positive_constructive", // RPG: constructive growth loop
      shooter: "negative_destructive", // Shooter: destructive combat loop
      strategy: "positive_constructive", // Strategy: constructive building
      horror: "negative_destructive", // Horror: destructive survival
      mmorpg: "positive_constructive",
      idle: "positive_constructive",
      default: "mixed",
    };
    const dominantLoopType = genreDominantLoops[resolvedGenre] || genreDominantLoops.default;

    const stagesCompleted = [1, 2, 3, 4, 5];
    const latencyMs = Date.now() - startedAt;

    const result: Record<string, unknown> = {
      id: proj.id,
      inventory,
      classification,
      machinations_model: machinations,
      conversion_graph: conversionGraph,
      diagnostics,
      balance,
      sim_result: simResult,
      // R5-15: graph-based simulation diagnostics (from executing the
      // Machinations graph, not single-pool decay).
      graph_sim_result: graphSimResult,
      // TASK-5b.9: 12-point validation checklist.
      economy_checklist: { checks: checklist, passed: checklistPassed, total: 12 },
      // TASK-5b.12: 8-dimensional feedback loop profiles.
      loop_profiles: loopProfiles,
      // TASK-5b.13: 6 Schreiber economic system types.
      schreiber_types: schreiberTypes,
      // TASK-5b.14: genre-specific dominant loop.
      dominant_loop_type: dominantLoopType,
      contract_version: STAGE_CONTRACT_VERSION,
      artifact: createArtifactEnvelope("economy", body),
      algorithm_metadata: getStageAlgorithmMetadata("economy"),
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: [
        "deterministic-economy-v1",
        "machinations-builder-v1",
        "pathology-detector-v1",
        "monte-carlo-sim-v1",
      ],
    };

    assertStageOutput("economy", result);

    // R5-16: AI enrichment moved BEFORE persist (was after). Before, ai_insights
    // was mutated on `result` after `fullProfile: JSON.stringify(result)` was
    // already written to DB, so ai_insights was lost on reload. Now it's
    // included in the persisted fullProfile.
    if (useAi) {
      const aiInsights = await enrichEconomy({
        projectName: proj.name || "Untitled",
        genre: resolvedGenre,
        systemType: classification.type,
        resourceCount: resources.length,
        monetizationType: resolvedMonetization,
        openness: resolvedOpenness,
        pathologies: pathologies.map((p) => p.name),
        // R-AUDIT-FIX (#2): AI enrichment now sees the worst-case stability
        // across both simulations, not just the single-pool model. This
        // gives the LLM a more honest picture of economy health.
        stabilityIndex: effectiveStability,
        avgProfitability: conversionGraph.avg_profitability,
        dominantLoop: classification.dominant_loop,
      });
      if (aiInsights) {
        result.ai_insights = aiInsights;
        (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
      }
    }

    // --- Persist --- (now includes ai_insights in fullProfile)
    await db.projectEconomy.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        systemType: classification.type,
        resourceCount: resources.length,
        hasPathology: pathologies.length > 0,
        inputData: JSON.stringify({
          genre: resolvedGenre,
          monetization_type: resolvedMonetization,
          openness,
        }),
        resourceModel: JSON.stringify(inventory),
        machinationsModel: JSON.stringify(machinations),
        conversionChains: JSON.stringify(conversionGraph),
        pathologies: JSON.stringify(pathologies),
        corrections: JSON.stringify(adjustments),
        simulationResults: JSON.stringify(simResult),
        monetizationModel: JSON.stringify({
          type: resolvedMonetization,
          primary_revenue:
            resolvedMonetization === "f2p"
              ? ["iap", "ads"]
              : resolvedMonetization === "subscription"
                ? ["subscription"]
                : ["purchase"],
          secondary_revenue: [],
          ethical_concerns: resolvedMonetization === "p2w" ? ["pay_to_win"] : [],
        }),
        fullProfile: JSON.stringify(result),
      },
      update: {
        systemType: classification.type,
        resourceCount: resources.length,
        hasPathology: pathologies.length > 0,
        inputData: JSON.stringify({
          genre: resolvedGenre,
          monetization_type: resolvedMonetization,
          openness,
        }),
        resourceModel: JSON.stringify(inventory),
        machinationsModel: JSON.stringify(machinations),
        conversionChains: JSON.stringify(conversionGraph),
        pathologies: JSON.stringify(pathologies),
        corrections: JSON.stringify(adjustments),
        simulationResults: JSON.stringify(simResult),
        monetizationModel: JSON.stringify({
          type: resolvedMonetization,
          primary_revenue:
            resolvedMonetization === "f2p"
              ? ["iap", "ads"]
              : resolvedMonetization === "subscription"
                ? ["subscription"]
                : ["purchase"],
          secondary_revenue: [],
          ethical_concerns: resolvedMonetization === "p2w" ? ["pay_to_win"] : [],
        }),
        fullProfile: JSON.stringify(result),
      },
    });

    await updateProjectStage(proj.id, "economy");

    return NextResponse.json(result);
  } catch (error) {
    console.error("[economy/design] error:", error);
    return SERVER_ERROR();
  }
}
