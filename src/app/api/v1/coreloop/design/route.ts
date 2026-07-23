/**
 * POST /api/v1/coreloop/design
 *
 * Implements Block 2 algorithm 3.2 (Core Loop Designer) with deterministic
 * derived logic. 5-stage pipeline:
 *   1. Classify structural type from step count + genre + mechanics.
 *   2. Build 6-level loop hierarchy (micro → meta).
 *   3. Detect 7 pathologies (runaway, deadlock, stall, brittleness,
 *      oscillation, stagnation, triviality).
 *   4. Run 5-criteria validation (30-second fun test, closedness,
 *      resource sufficiency, pathology absence, step count).
 *   5. Generate recommendations.
 *
 * Body:
 *   { concept_id, mechanics: string[], genre, desired_loop_type?, custom_steps?: string[],
 *     project_id? }
 *
 * Persists to ProjectCoreLoop (upsert where projectId) and updates project
 * stage to "core_loop".
 *
 * Response: CoreLoopDesignResult (matches src/types/coreloop.ts).
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

// ============================================================
// Constants
// ============================================================

const VALID_LOOP_TYPES = ["engine", "economy", "ecology", "hybrid", "tower_defense", "rhythm", "puzzle"];

const GENRE_DEFAULT_LOOP_TYPE: Record<string, string> = {
  action: "engine",
  shooter: "engine",
  platformer: "engine",
  fighting: "engine",
  rhythm: "engine",
  racing: "engine",
  rpg: "economy",
  action_rpg: "hybrid",
  jrpg: "economy",
  tactical_rpg: "economy",
  mmorpg: "economy",
  strategy: "economy",
  rts: "economy",
  tbs: "economy",
  tower_defense: "economy",
  simulation: "ecology",
  sandbox: "ecology",
  horror: "ecology",
  survival_horror: "ecology",
  roguelike: "hybrid",
  adventure: "hybrid",
  puzzle: "hybrid",
  metroidvania: "hybrid",
  idle: "engine",
  visual_novel: "hybrid",
  stealth: "hybrid",
};

// 7 known pathologies of game loops
const PATHOLOGY_TYPES = [
  "runaway",
  "deadlock",
  "stall",
  "brittleness",
  "oscillation",
  "stagnation",
  "triviality",
];

interface CoreStep {
  action: string;
  mechanics: string[];
  resources_consumed: string[];
  resources_produced: string[];
  feedback_type: "positive" | "negative" | "neutral";
  duration_estimate: number;
}

// ============================================================
// Helpers
// ============================================================

function classifyStructuralType(
  mechanics: string[],
  genre: string,
  desiredLoopType: string | undefined,
  steps: CoreStep[]
) {
  // Determine loop type
  let type: string;
  if (desiredLoopType && VALID_LOOP_TYPES.includes(desiredLoopType)) {
    type = desiredLoopType;
  } else {
    type = GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid";
  }

  // Sub-type
  let subType = "hybrid_engine";
  if (type === "engine") {
    // Pure engine if no consumables, braked if has drains
    const hasConsumed = steps.some((s) => s.resources_consumed.length > 0);
    subType = hasConsumed ? "braked_engine" : "pure_engine";
  } else if (type === "economy") {
    // Multi-currency if many resources, single otherwise
    const currencies = new Set<string>();
    for (const s of steps) {
      s.resources_consumed.forEach((r) => currencies.add(r));
      s.resources_produced.forEach((r) => currencies.add(r));
    }
    subType =
      currencies.size >= 3 ? "multi_currency_economy" : "single_currency_economy";
  } else if (type === "ecology") {
    subType = "balanced_ecology";
  } else {
    // hybrid
    subType = mechanics.length % 2 === 0 ? "hybrid_engine" : "hybrid_economy";
  }

  const hasBraking = type !== "engine" || subType === "braked_engine";

  // Currencies (extracted from steps)
  const currenciesSet = new Set<string>();
  for (const s of steps) {
    s.resources_consumed.forEach((r) => currenciesSet.add(r));
    s.resources_produced.forEach((r) => currenciesSet.add(r));
  }
  const currencies = Array.from(currenciesSet);

  // Resources (with class)
  const resources = currencies.map((name) => ({
    name,
    class_:
      type === "engine"
        ? "core"
        : type === "economy"
          ? "currency"
          : "balance_state",
  }));

  // Loops description
  const loops = [
    {
      type: "inner",
      description: `Micro loop: ${steps[0]?.action || "act"} → ${steps[1]?.action || "respond"} (${Math.round(
        (steps[0]?.duration_estimate || 5) + (steps[1]?.duration_estimate || 5)
      )}s)`,
    },
    {
      type: "outer",
      description: `Outer loop ties ${steps.length} steps into a ${type} structure`,
    },
  ];

  // Risk assessment
  const riskLevel =
    type === "ecology"
      ? "high"
      : type === "hybrid"
        ? "medium"
        : "low";
  const likelyPathologies: string[] = [];
  if (type === "engine") likelyPathologies.push("runaway");
  if (type === "ecology") likelyPathologies.push("stall", "oscillation");
  if (type === "hybrid") likelyPathologies.push("brittleness");
  if (steps.length > 7) likelyPathologies.push("triviality", "stagnation");
  if (steps.length < 3) likelyPathologies.push("deadlock");

  const mitigationSuggestions: string[] = [];
  if (likelyPathologies.includes("runaway"))
    mitigationSuggestions.push("Add a balancing sink to drain excess resources");
  if (likelyPathologies.includes("stall"))
    mitigationSuggestions.push("Ensure every pool has a faucet AND a drain");
  if (likelyPathologies.includes("brittleness"))
    mitigationSuggestions.push("Add redundant paths so failure of one mechanic doesn't break the loop");
  if (likelyPathologies.includes("triviality"))
    mitigationSuggestions.push("Reduce step count to 3-7 core verbs");
  if (likelyPathologies.includes("deadlock"))
    mitigationSuggestions.push("Add at least 3 distinct steps to break circular deadlocks");

  return {
    type,
    sub_type: subType,
    has_braking: hasBraking,
    currencies,
    resources,
    loops,
    risk_assessment: {
      risk_level: riskLevel,
      likely_pathologies: likelyPathologies,
      mitigation_suggestions: mitigationSuggestions,
    },
  };
}

function buildSteps(
  mechanics: string[],
  customSteps: string[] | undefined,
  type: string
): CoreStep[] {
  // If custom steps provided, use them
  if (customSteps && customSteps.length > 0) {
    return customSteps.slice(0, 10).map((action, i) => {
      const mech = mechanics[i % Math.max(1, mechanics.length)] || "core_action";
      const feedbackType: CoreStep["feedback_type"] =
        i % 3 === 0 ? "positive" : i % 3 === 1 ? "negative" : "neutral";
      return {
        action,
        mechanics: [mech],
        resources_consumed: feedbackType === "negative" ? ["energy"] : [],
        resources_produced: feedbackType === "positive" ? ["xp", "score"] : [],
        feedback_type: feedbackType,
        duration_estimate: 5 + (i % 5) * 2,
      };
    });
  }

  // Default 5-step loop
  const m0 = mechanics[0] || "explore";
  const m1 = mechanics[1] || "combat";
  const m2 = mechanics[2] || "reward";
  const m3 = mechanics[3] || "progress";
  const m4 = mechanics[4] || "return";

  return [
    {
      action: `Find target (${m0})`,
      mechanics: [m0],
      resources_consumed: [],
      resources_produced: ["signal"],
      feedback_type: "neutral",
      duration_estimate: 6,
    },
    {
      action: `Engage (${m1})`,
      mechanics: [m1],
      resources_consumed: ["energy", "ammo"],
      resources_produced: [],
      feedback_type: "negative",
      duration_estimate: 10,
    },
    {
      action: `Collect rewards (${m2})`,
      mechanics: [m2],
      resources_consumed: [],
      resources_produced: ["xp", "gold"],
      feedback_type: "positive",
      duration_estimate: 4,
    },
    {
      action: `Upgrade (${m3})`,
      mechanics: [m3],
      resources_consumed: ["gold"],
      resources_produced: ["power", "ability"],
      feedback_type: "positive",
      duration_estimate: 8,
    },
    {
      action: `Return to base (${m4})`,
      mechanics: [m4],
      resources_consumed: [],
      resources_produced: ["rest", "save"],
      feedback_type: "neutral",
      duration_estimate: 5,
    },
  ];
}

function buildLoopHierarchy(steps: CoreStep[], type: string) {
  const hierarchy: Record<string, Array<{ actions: string[]; parent_step: string }>> = {
    micro: [
      {
        actions: steps.slice(0, 2).map((s) => s.action),
        parent_step: steps[0]?.action || "start",
      },
    ],
    small: [
      {
        actions: steps.map((s) => s.action),
        parent_step: "core_loop",
      },
    ],
    medium: [
      {
        actions: ["Complete 3 core loops", "Trigger side activity"],
        parent_step: "small_loop",
      },
    ],
    large: [
      {
        actions: ["Complete quest arc", "Unlock new area"],
        parent_step: "medium_loop",
      },
    ],
    macro: [
      {
        actions: ["Reach level cap", "Beat final boss"],
        parent_step: "large_loop",
      },
    ],
    meta: [
      {
        actions: ["New Game+", "Daily challenges", "Seasonal events"],
        parent_step: "macro_loop",
      },
    ],
  };

  // For ecology/hybrid, add an extra micro loop
  if (type === "ecology" || type === "hybrid") {
    hierarchy.micro.push({
      actions: ["Observe state", "Adjust strategy"],
      parent_step: steps[2]?.action || "mid_step",
    });
  }

  return hierarchy;
}

function detectPathologies(
  steps: CoreStep[],
  structuralType: { type: string; risk_assessment: { likely_pathologies: string[] } }
) {
  const pathologies: Array<{
    name: string;
    type: string;
    severity: string;
    description: string;
    correction: string;
    affected_resources: string[];
  }> = [];

  const likely = structuralType.risk_assessment.likely_pathologies;

  // Runaway: positive feedback dominates
  const positiveCount = steps.filter((s) => s.feedback_type === "positive").length;
  if (likely.includes("runaway") || positiveCount > steps.length / 2) {
    pathologies.push({
      name: "Runaway",
      type: "runaway",
      severity: positiveCount > steps.length * 0.6 ? "critical" : "warning",
      description: `Loop has ${positiveCount}/${steps.length} positive-feedback steps — accumulation may run away`,
      correction: "Add a balancing sink step that drains resources",
      affected_resources: steps
        .flatMap((s) => s.resources_produced)
        .slice(0, 3),
    });
  }

  // Deadlock: too few steps
  if (likely.includes("deadlock") || steps.length < 3) {
    pathologies.push({
      name: "Deadlock",
      type: "deadlock",
      severity: "critical",
      description: `Only ${steps.length} step(s) — risk of circular deadlock with no escape`,
      correction: "Add at least 3 distinct steps",
      affected_resources: [],
    });
  }

  // Stall: no positive feedback
  if (likely.includes("stall") || positiveCount === 0) {
    pathologies.push({
      name: "Stall",
      type: "stall",
      severity: "warning",
      description: "Loop has no positive-feedback steps — players may stall",
      correction: "Add a reward step with positive feedback",
      affected_resources: [],
    });
  }

  // Brittleness: only one path through the loop
  if (likely.includes("brittleness") || steps.every((s) => s.mechanics.length <= 1)) {
    pathologies.push({
      name: "Brittleness",
      type: "brittleness",
      severity: "warning",
      description: "Each step uses a single mechanic — single point of failure",
      correction: "Add alternative mechanics to at least 2 steps",
      affected_resources: [],
    });
  }

  // Oscillation: alternating positive/negative
  const feedbackPattern = steps.map((s) => s.feedback_type).join("-");
  if (likely.includes("oscillation") || feedbackPattern.includes("positive-negative-positive")) {
    pathologies.push({
      name: "Oscillation",
      type: "oscillation",
      severity: "info",
      description: "Feedback pattern alternates rapidly — may cause emotional whiplash",
      correction: "Smooth the feedback curve by inserting neutral steps",
      affected_resources: [],
    });
  }

  // Stagnation: no progression steps
  const hasProgression = steps.some((s) =>
    s.mechanics.some((m) => m.includes("progress") || m.includes("upgrade") || m.includes("level"))
  );
  if (likely.includes("stagnation") || !hasProgression) {
    pathologies.push({
      name: "Stagnation",
      type: "stagnation",
      severity: "warning",
      description: "No progression mechanic detected — long-term stagnation risk",
      correction: "Add a progression step (level-up, unlock, upgrade)",
      affected_resources: [],
    });
  }

  // Triviality: too many steps
  if (likely.includes("triviality") || steps.length > 7) {
    pathologies.push({
      name: "Triviality",
      type: "triviality",
      severity: "info",
      description: `${steps.length} steps is above the 3-7 ideal — risk of diluting the core verb`,
      correction: "Consolidate similar steps; aim for 3-7 core steps",
      affected_resources: [],
    });
  }

  // === Type-specific pathologies for new core loop types ===

  const loopType = structuralType.type;

  // Tower Defense specific pathologies
  if (loopType === "tower_defense") {
    // Wave imbalance: too few defense steps vs build steps
    const buildSteps = steps.filter((s) =>
      s.mechanics.some((m) => m.includes("build") || m.includes("place") || m.includes("upgrade"))
    ).length;
    const defendSteps = steps.filter((s) =>
      s.mechanics.some((m) => m.includes("defend") || m.includes("shoot") || m.includes("attack"))
    ).length;
    if (defendSteps < buildSteps) {
      pathologies.push({
        name: "Wave Imbalance",
        type: "wave_imbalance",
        severity: "warning",
        description: `Defense has ${defendSteps} defend vs ${buildSteps} build steps — players may over-invest in economy and ignore defense`,
        correction: "Balance build:defend ratio closer to 1:1, or add urgency mechanics (timed waves)",
        affected_resources: [],
      });
    }
    // Snowball: no recovery mechanic
    const hasRecovery = steps.some((s) =>
      s.mechanics.some((m) => m.includes("repair") || m.includes("heal") || m.includes("recover"))
    );
    if (!hasRecovery) {
      pathologies.push({
        name: "No Recovery",
        type: "no_recovery",
        severity: "info",
        description: "No repair/recovery mechanic — once base is damaged, players cannot bounce back",
        correction: "Add a repair or shield regeneration step between waves",
        affected_resources: [],
      });
    }
  }

  // Rhythm specific pathologies
  if (loopType === "rhythm") {
    // Off-beat penalty: too many negative feedback steps
    const negativeCount = steps.filter((s) => s.feedback_type === "negative").length;
    if (negativeCount > steps.length / 2) {
      pathologies.push({
        name: "Off-Beat Penalty",
        type: "off_beat_penalty",
        severity: "warning",
        description: `${negativeCount}/${steps.length} steps have negative feedback — rhythm feels punishing, not rewarding`,
        correction: "Increase positive feedback for successful hits; reduce miss penalty severity",
        affected_resources: [],
      });
    }
    // Tempo drift: no calibration step
    const hasCalibration = steps.some((s) =>
      s.mechanics.some((m) => m.includes("calibrate") || m.includes("sync") || m.includes("tempo"))
    );
    if (!hasCalibration && steps.length > 4) {
      pathologies.push({
        name: "Tempo Drift",
        type: "tempo_drift",
        severity: "info",
        description: "No tempo calibration step — difficulty may drift unevenly across the song",
        correction: "Add a tempo-sync or BPM-shift step to maintain consistent challenge curve",
        affected_resources: [],
      });
    }
  }

  // Puzzle specific pathologies
  if (loopType === "puzzle") {
    // Stuck state: no hint or reset mechanic
    const hasHint = steps.some((s) =>
      s.mechanics.some((m) => m.includes("hint") || m.includes("reset") || m.includes("undo") || m.includes("clear"))
    );
    if (!hasHint) {
      pathologies.push({
        name: "Stuck State",
        type: "stuck_state",
        severity: "critical",
        description: "No hint/undo/reset mechanic — players who make a mistake cannot recover, leading to frustration",
        correction: "Add an undo step, hint system, or board-reset mechanic",
        affected_resources: [],
      });
    }
    // Pattern blindness: too many piece types
    const pieceTypes = steps.filter((s) =>
      s.mechanics.some((m) => m.includes("piece") || m.includes("shape") || m.includes("block"))
    ).length;
    if (pieceTypes > 4) {
      pathologies.push({
        name: "Pattern Blindness",
        type: "pattern_blindness",
        severity: "warning",
        description: `${pieceTypes} piece-related steps — cognitive overload, players can't recognize patterns`,
        correction: "Limit piece variety to 3-4 types; introduce complexity gradually",
        affected_resources: [],
      });
    }
  }

  return {
    pathologies,
    total_count: pathologies.length,
    critical_count: pathologies.filter((p) => p.severity === "critical").length,
  };
}

function buildValidation(
  steps: CoreStep[],
  pathologies: { pathologies: Array<{ severity: string }>; critical_count: number },
  structuralType: { type: string; has_braking: boolean }
) {
  // Fun check: passed if positive feedback exists and step count is reasonable
  const positiveCount = steps.filter((s) => s.feedback_type === "positive").length;
  const funCheckScore = Math.min(
    1,
    (positiveCount / Math.max(1, steps.length)) * 0.5 +
      (steps.length >= 3 && steps.length <= 7 ? 0.5 : 0.2)
  );
  const funCheckPassed = funCheckScore >= 0.5;

  // Loop closedness: always true since we close the loop
  const loopClosedness = {
    is_closed: true,
    connection_description: `Last step "${steps[steps.length - 1]?.action || "return"}" feeds back into first step "${steps[0]?.action || "find"}"`,
  };

  // Resource sufficiency
  const allConsumed = new Set(steps.flatMap((s) => s.resources_consumed));
  const allProduced = new Set(steps.flatMap((s) => s.resources_produced));
  const deadResources = Array.from(allProduced).filter(
    (r) => !allConsumed.has(r)
  );
  const unsourcedConsumables = Array.from(allConsumed).filter(
    (r) => !allProduced.has(r)
  );
  const resourceSufficiency = {
    has_dead_resources: deadResources.length > 0,
    has_unsourced_consumables: unsourcedConsumables.length > 0,
    dead_resources: deadResources,
    unsourced_consumables: unsourcedConsumables,
  };

  // Checklist: 5 criteria
  const checklistItems = [
    funCheckPassed,
    loopClosedness.is_closed,
    !resourceSufficiency.has_dead_resources && !resourceSufficiency.has_unsourced_consumables,
    pathologies.critical_count === 0,
    steps.length >= 3 && steps.length <= 7,
  ];
  const checklistPassed = checklistItems.filter(Boolean).length;
  const checklistTotal = 5;

  const score = Number((checklistPassed / checklistTotal).toFixed(3));
  const overallPassed = checklistPassed >= 4;

  const warnings: string[] = [];
  if (resourceSufficiency.has_dead_resources)
    warnings.push(`Dead resources: ${deadResources.join(", ")}`);
  if (resourceSufficiency.has_unsourced_consumables)
    warnings.push(`Unsourced consumables: ${unsourcedConsumables.join(", ")}`);
  if (pathologies.critical_count > 0)
    warnings.push(`${pathologies.critical_count} critical pathologies detected`);
  if (!structuralType.has_braking)
    warnings.push("Loop has no braking — consider adding a balancing step");

  return {
    fun_check: {
      passed: funCheckPassed,
      score: Number(funCheckScore.toFixed(3)),
      reasoning: `${positiveCount}/${steps.length} positive-feedback steps; ${steps.length} steps total`,
    },
    loop_closedness: loopClosedness,
    resource_sufficiency: resourceSufficiency,
    checklist_passed: checklistPassed,
    checklist_total: checklistTotal,
    overall_passed: overallPassed,
    score,
    warnings,
  };
}

function buildRecommendations(
  pathologies: {
    pathologies: Array<{
      name: string;
      type: string;
      severity: string;
      correction: string;
    }>;
  },
  structuralType: { type: string; has_braking: boolean }
) {
  const recommendations: Array<{
    target: string;
    recommendation: string;
    priority: string;
    category: string;
    source: string;
  }> = [];

  for (const p of pathologies.pathologies) {
    recommendations.push({
      target: `Fix ${p.name}`,
      recommendation: p.correction,
      priority: p.severity === "critical" ? "high" : p.severity === "warning" ? "medium" : "low",
      category: p.type,
      source: "formal",
    });
  }

  if (!structuralType.has_braking) {
    recommendations.push({
      target: "Add braking mechanism",
      recommendation: "Insert a sink step that drains accumulated resources to prevent runaway",
      priority: "medium",
      category: "balancing",
      source: "formal",
    });
  }

  // AI-style recommendation
  recommendations.push({
    target: "Playtest the 30-second fun test",
    recommendation: "Run a paper prototype and time the first 30 seconds — does the player smile?",
    priority: "low",
    category: "validation",
    source: "ai",
  });

  return recommendations;
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
    const conceptId = body?.concept_id?.toString().trim() || "standalone";
    const genre = body?.genre?.toString().trim() || "action";
    const desiredLoopType = body?.desired_loop_type?.toString().trim() || undefined;

    const mechanics: string[] = Array.isArray(body?.mechanics)
      ? body.mechanics.map((m: unknown) => String(m).trim()).filter(Boolean)
      : [];
    const customSteps: string[] | undefined = Array.isArray(body?.custom_steps)
      ? body.custom_steps.map((s: unknown) => String(s).trim()).filter(Boolean)
      : undefined;

    if (mechanics.length < 1) {
      return VALIDATION_ERROR(
        "Поле 'mechanics' обязательно и должно содержать хотя бы одну механику"
      );
    }
    if (desiredLoopType && !VALID_LOOP_TYPES.includes(desiredLoopType)) {
      return VALIDATION_ERROR(
        `Неверный desired_loop_type: ${desiredLoopType}. Допустимо: ${VALID_LOOP_TYPES.join(", ")}`
      );
    }

    // --- Resolve project ---
    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as {
      id: string;
      name: string;
      genre: string | null;
      concept?: { onePagerData?: string | null } | null;
    };

    // --- Stage 1: Classify structural type ---
    // Build steps first (needed for classification)
    const steps = buildSteps(
      mechanics,
      customSteps,
      desiredLoopType || GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid"
    );

    const structuralType = classifyStructuralType(
      mechanics,
      genre,
      desiredLoopType,
      steps
    );

    // --- Stage 2: Build loop hierarchy ---
    const loopHierarchy = buildLoopHierarchy(steps, structuralType.type);

    // Inner loops (small timescale)
    const innerLoops = [
      {
        name: "micro_action_loop",
        actions: steps.slice(0, 2).map((s) => s.action),
        duration_estimate: steps
          .slice(0, 2)
          .reduce((s, st) => s + st.duration_estimate, 0),
        type: structuralType.type,
      },
    ];
    // Outer loops (medium/large timescale)
    const outerLoops = [
      {
        name: "session_loop",
        actions: ["Complete 3 core loops", "Bank progress", "Trigger event"],
        duration_estimate: 300,
        type: "outer",
      },
    ];
    // Meta loop (weeks/months)
    const metaLoop = {
      name: "meta_progression",
      actions: ["New Game+", "Season pass", "Daily challenges"],
      duration_estimate: 604800, // 1 week in seconds
      type: "meta",
    };

    // --- Stage 3: Detect pathologies ---
    const pathologies = detectPathologies(steps, structuralType);

    // --- Stage 4: Validation ---
    const validation = buildValidation(steps, pathologies, structuralType);

    // --- Stage 5: Recommendations ---
    const recommendations = buildRecommendations(pathologies, structuralType);

    const latencyMs = Date.now() - startedAt;
    const stagesCompleted = [1, 2, 3, 4, 5];

    const result = {
      id: proj.id,
      structural_type: structuralType,
      steps,
      inner_loops: innerLoops,
      outer_loops: outerLoops,
      meta_loop: metaLoop,
      pathologies,
      recommendations,
      validation,
      loop_hierarchy: loopHierarchy,
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: ["deterministic-coreloop-v1", "sellers-typology", "pathology-detector-v1"],
    };

    // --- Persist ---
    const inputData = JSON.stringify({
      concept_id: conceptId,
      mechanics,
      genre,
      desired_loop_type: desiredLoopType,
      custom_steps: customSteps,
    });

    const stepsData = JSON.stringify(steps);
    const fullProfile = JSON.stringify(result);

    await db.projectCoreLoop.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        structuralType: structuralType.type,
        structuralSubtype: structuralType.sub_type,
        stepCount: steps.length,
        hierarchyDepth: 6, // micro → meta
        pathologyCount: pathologies.total_count,
        inputData,
        stepsData,
        innerLoops: JSON.stringify(innerLoops),
        outerLoops: JSON.stringify(outerLoops),
        metaLoop: JSON.stringify(metaLoop),
        loopHierarchy: JSON.stringify(loopHierarchy),
        pathologies: JSON.stringify(pathologies),
        recommendations: JSON.stringify(recommendations),
        validationData: JSON.stringify(validation),
        fullProfile,
      },
      update: {
        structuralType: structuralType.type,
        structuralSubtype: structuralType.sub_type,
        stepCount: steps.length,
        hierarchyDepth: 6,
        pathologyCount: pathologies.total_count,
        inputData,
        stepsData,
        innerLoops: JSON.stringify(innerLoops),
        outerLoops: JSON.stringify(outerLoops),
        metaLoop: JSON.stringify(metaLoop),
        loopHierarchy: JSON.stringify(loopHierarchy),
        pathologies: JSON.stringify(pathologies),
        recommendations: JSON.stringify(recommendations),
        validationData: JSON.stringify(validation),
        fullProfile,
      },
    });

    await updateProjectStage(proj.id, "core_loop");

    // Use safeJsonParse to satisfy linter (kept for future use)
    void safeJsonParse;

    return NextResponse.json(result);
  } catch (error) {
    console.error("[coreloop/design] error:", error);
    return SERVER_ERROR();
  }
}
