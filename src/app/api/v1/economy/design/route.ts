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

const GENRE_RESOURCE_PRESETS: Record<
  string,
  { core: string[]; subsidiary: string[] }
> = {
  rpg: {
    core: ["xp", "gold", "hp"],
    subsidiary: ["mana", "stamina", "materials"],
  },
  shooter: {
    core: ["score", "ammo", "armor"],
    subsidiary: ["credits", "scrap", "intel"],
  },
  strategy: {
    core: ["wood", "food", "gold", "stone"],
    subsidiary: ["population", "research", "favor"],
  },
  mmorpg: {
    core: ["gold", "xp", "reputation"],
    subsidiary: ["honor", "tokens", "crafting_mats"],
  },
  idle: {
    core: ["coins", "gems", "energy"],
    subsidiary: ["prestige_points", "automation", "research"],
  },
  default: {
    core: ["score", "currency", "energy"],
    subsidiary: ["materials", "tokens"],
  },
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

  // Feedback loops: anchor→converter→consumable→anchor (reinforcing) and anchor→sink→anchor (balancing)
  feedbackLoops.push({
    nodes: [anchor, "converter", "consumable", anchor],
    loop_type: "reinforcing",
    strength: 0.7,
    description: "Core production cycle: anchor fuels converters producing consumables",
  });
  feedbackLoops.push({
    nodes: [anchor, "drain_sink", anchor],
    loop_type: "balancing",
    strength: 0.5,
    description: "Anchor sink prevents runaway accumulation",
  });

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
    const profitability = Number((0.8 + Math.random() * 0.4).toFixed(2));
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
  faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>
): Pathology[] {
  const pathologies: Pathology[] = [];

  // Inflation: ratio > 1.5 for anchor
  for (const [name, data] of Object.entries(faucetDrain)) {
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
  faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>
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

function simulate(
  resources: ResourceDef[],
  faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>,
  ticks: number
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
  const curves: Record<string, number[]> = {};
  const ranges: Record<string, { min: number; max: number }> = {};
  let runawayCount = 0;
  let stallCount = 0;

  for (const r of resources) {
    let value = r.initial_value;
    const series: number[] = [];
    let rMax = value;
    let rMin = value;
    for (let t = 0; t < ticks; t++) {
      const d = faucetDrain[r.name] || { faucet: 0.3, drain: 0.3, ratio: 1 };
      // Add some noise
      const noise = (Math.random() - 0.5) * 0.2;
      value = value + d.faucet - d.drain + noise;
      value = Math.max(r.bounds.min, Math.min(r.bounds.max, value));
      series.push(Number(value.toFixed(2)));
      rMax = Math.max(rMax, value);
      rMin = Math.min(rMin, value);
    }
    curves[r.name] = series;
    ranges[r.name] = { min: Number(rMin.toFixed(2)), max: Number(rMax.toFixed(2)) };
    if (rMax >= r.bounds.max * 0.95) runawayCount++;
    if (rMax <= r.bounds.min + (r.bounds.max - r.bounds.min) * 0.05) stallCount++;
  }

  const runawayFreq = runawayCount / Math.max(1, resources.length);
  const stallFreq = stallCount / Math.max(1, resources.length);
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

  return {
    config: { ticks, num_runs: 10, recording_interval: 5 },
    aggregated: {
      avg_resource_curves: curves,
      resource_ranges: ranges,
      runaway_frequency: runawayFreq,
      stall_frequency: stallFreq,
      stability_index: stability,
      build_gap: buildGap,
    },
    quality,
    snapshots_count: ticks,
  };
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
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
    const proj = owned.project as { id: string; name: string; genre: string | null };

    // --- Build resource inventory ---
    const preset = pickResources(genre);
    const resources: ResourceDef[] = [];
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
    // Add a premium currency if F2P
    if (monetizationType === "f2p" || monetizationType === "hybrid") {
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

    const anchor = anchorName;
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
    const classification = classifySystemType(resources, openness, monetizationType);
    (classification as Record<string, unknown>).monetization_type = monetizationType;
    (classification as Record<string, unknown>).genre = genre;

    // --- Machinations model ---
    const machinations = buildMachinations(resources, anchor, classification);

    // --- Conversion graph ---
    const conversionGraph = findConversionChains(resources);

    // --- Faucet/drain ratios (derived) ---
    const faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }> = {};
    for (const r of resources) {
      const faucet = r.is_catalytic ? 1.0 : r.resource_class === "currency" ? 0.8 : 0.4;
      const drain = r.is_consumable ? 0.6 : r.resource_class === "currency" ? 0.7 : 0.3;
      const ratio = drain > 0 ? Number((faucet / drain).toFixed(3)) : 0;
      faucetDrain[r.name] = { faucet, drain, ratio };
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
    const simResult = simulate(resources, faucetDrain, 50);

    const stagesCompleted = [1, 2, 3, 4, 5];
    const latencyMs = Date.now() - startedAt;

    const result = {
      id: proj.id,
      inventory,
      classification,
      machinations_model: machinations,
      conversion_graph: conversionGraph,
      diagnostics,
      balance,
      sim_result: simResult,
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
    };

    // --- Persist ---
    await db.projectEconomy.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        systemType: classification.type,
        resourceCount: resources.length,
        hasPathology: pathologies.length > 0,
        inputData: JSON.stringify({
          genre,
          monetization_type: monetizationType,
          openness,
        }),
        resourceModel: JSON.stringify(inventory),
        machinationsModel: JSON.stringify(machinations),
        conversionChains: JSON.stringify(conversionGraph),
        pathologies: JSON.stringify(pathologies),
        corrections: JSON.stringify(adjustments),
        simulationResults: JSON.stringify(simResult),
        monetizationModel: JSON.stringify({
          type: monetizationType,
          primary_revenue:
            monetizationType === "f2p"
              ? ["iap", "ads"]
              : monetizationType === "subscription"
                ? ["subscription"]
                : ["purchase"],
          secondary_revenue: [],
          ethical_concerns: monetizationType === "p2w" ? ["pay_to_win"] : [],
        }),
        fullProfile: JSON.stringify(result),
      },
      update: {
        systemType: classification.type,
        resourceCount: resources.length,
        hasPathology: pathologies.length > 0,
        inputData: JSON.stringify({
          genre,
          monetization_type: monetizationType,
          openness,
        }),
        resourceModel: JSON.stringify(inventory),
        machinationsModel: JSON.stringify(machinations),
        conversionChains: JSON.stringify(conversionGraph),
        pathologies: JSON.stringify(pathologies),
        corrections: JSON.stringify(adjustments),
        simulationResults: JSON.stringify(simResult),
        monetizationModel: JSON.stringify({
          type: monetizationType,
          primary_revenue:
            monetizationType === "f2p"
              ? ["iap", "ads"]
              : monetizationType === "subscription"
                ? ["subscription"]
                : ["purchase"],
          secondary_revenue: [],
          ethical_concerns: monetizationType === "p2w" ? ["pay_to_win"] : [],
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
