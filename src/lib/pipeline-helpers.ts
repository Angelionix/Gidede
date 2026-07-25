/**
 * Gidede — Pipeline block computation helpers.
 *
 * Maps the 8 functional blocks (Concept, Core Loop, MDA, Balance,
 * Progression, Economy, GDD, Validation) to their Prisma sub-tables and
 * computes per-block status, completion percent, current stage, next block.
 */

import { db } from "@/lib/db";

export type BlockStatus = "empty" | "in_progress" | "completed" | "stale";

export interface BlockProgress {
  block_id: number;
  name: string;
  status: BlockStatus;
  is_filled: boolean;
  updated_at: string | null;
  stale_since: string | null;
  stale_reason: string | null;
}

export interface PipelineNotification {
  type: "stale_warning";
  block_id: number;
  block_name: string;
  message: string;
  severity: "warning";
  stale_since: string | null;
  stale_reason: string | null;
}

export interface ProjectPipelineSnapshot {
  projectId: string;
  projectName: string;
  hasConcept: boolean;
  hasCoreLoop: boolean;
  hasMda: boolean;
  hasBalance: boolean;
  hasProgression: boolean;
  hasEconomy: boolean;
  hasGdd: boolean;
  hasChecklist: boolean;
  completionPercent: number;
  currentStage: string | null;
  updatedAt: Date | null;
}

export const BLOCK_NAMES: Record<number, string> = {
  1: "Концепция",
  2: "Core Loop",
  3: "MDA-анализ",
  4: "Балансировка",
  5: "Прогрессия и Экономика",
  6: "GDD и Валидация",
  7: "AI-ассистент",
  8: "GBE Bridge",
};

/** Stage → Prisma field that backs it. */
const STAGE_FIELDS = [
  { block_id: 1, stage: "concept", key: "concept" },
  { block_id: 2, stage: "core_loop", key: "coreLoop" },
  { block_id: 3, stage: "mda", key: "mdaProfile" },
  { block_id: 4, stage: "balance", key: "balanceResult" },
  { block_id: 5, stage: "progression", key: "progression" },
  { block_id: 5, stage: "economy", key: "economy" },
  { block_id: 6, stage: "gdd", key: "gdd" },
  { block_id: 6, stage: "validation", key: "checklist" },
] as const;

/**
 * Load the project (verifying ownership) and return a snapshot of which
 * blocks have data. Returns null if the project doesn't exist or isn't owned.
 */
export async function loadProjectPipelineSnapshot(
  userId: string,
  projectId: string
): Promise<ProjectPipelineSnapshot | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: {
      concept: { select: { id: true, updatedAt: true } },
      coreLoop: { select: { id: true, updatedAt: true } },
      mdaProfile: { select: { id: true, updatedAt: true } },
      balanceResult: { select: { id: true, updatedAt: true } },
      progression: { select: { id: true, updatedAt: true } },
      economy: { select: { id: true, updatedAt: true } },
      gdd: { select: { id: true, updatedAt: true } },
      checklist: { select: { id: true, updatedAt: true } },
    },
  });
  if (!project) return null;

  const hasConcept = !!project.concept;
  const hasCoreLoop = !!project.coreLoop;
  const hasMda = !!project.mdaProfile;
  const hasBalance = !!project.balanceResult;
  const hasProgression = !!project.progression;
  const hasEconomy = !!project.economy;
  const hasGdd = !!project.gdd;
  const hasChecklist = !!project.checklist;

  // Same completion weights as in api-helpers.updateProjectStage
  const STAGE_WEIGHTS: Record<string, number> = {
    concept: 12,
    core_loop: 12,
    mda: 18,
    balance: 18,
    progression: 10,
    economy: 10,
    gdd: 10,
    validation: 10,
  };
  let completion = 0;
  if (hasConcept) completion += STAGE_WEIGHTS.concept;
  if (hasCoreLoop) completion += STAGE_WEIGHTS.core_loop;
  if (hasMda) completion += STAGE_WEIGHTS.mda;
  if (hasBalance) completion += STAGE_WEIGHTS.balance;
  if (hasProgression) completion += STAGE_WEIGHTS.progression;
  if (hasEconomy) completion += STAGE_WEIGHTS.economy;
  if (hasGdd) completion += STAGE_WEIGHTS.gdd;
  if (hasChecklist) completion += STAGE_WEIGHTS.validation;
  completion = Math.min(100, completion);

  // Determine which block has the latest update (current stage).
  const stageCandidates = [
    { stage: "concept", updatedAt: project.concept?.updatedAt || null },
    { stage: "core_loop", updatedAt: project.coreLoop?.updatedAt || null },
    { stage: "mda", updatedAt: project.mdaProfile?.updatedAt || null },
    { stage: "balance", updatedAt: project.balanceResult?.updatedAt || null },
    { stage: "progression", updatedAt: project.progression?.updatedAt || null },
    { stage: "economy", updatedAt: project.economy?.updatedAt || null },
    { stage: "gdd", updatedAt: project.gdd?.updatedAt || null },
    { stage: "validation", updatedAt: project.checklist?.updatedAt || null },
  ];
  let currentStage: string | null = project.projectStage || null;
  let latestUpdate: Date | null = null;
  for (const c of stageCandidates) {
    if (c.updatedAt && (!latestUpdate || c.updatedAt > latestUpdate)) {
      latestUpdate = c.updatedAt;
      if (!currentStage) currentStage = c.stage;
    }
  }

  return {
    projectId: project.id,
    projectName: project.name,
    hasConcept,
    hasCoreLoop,
    hasMda,
    hasBalance,
    hasProgression,
    hasEconomy,
    hasGdd,
    hasChecklist,
    completionPercent: completion,
    currentStage,
    updatedAt: latestUpdate || project.updatedAt,
  };
}

/** Build the 8 BlockProgress entries from the snapshot. */
export function buildBlocks(snap: ProjectPipelineSnapshot): BlockProgress[] {
  const filledMap: Record<number, boolean> = {
    1: snap.hasConcept,
    2: snap.hasCoreLoop,
    3: snap.hasMda,
    4: snap.hasBalance,
    5: snap.hasProgression || snap.hasEconomy,
    6: snap.hasGdd || snap.hasChecklist,
    7: true, // AI assistant — always available
    8: true, // GBE — always available
  };

  // Stale detection: if a later block is filled but an earlier block hasn't
  // been updated since, mark the earlier one as stale. For simplicity (no
  // real stale tracking in DB), we use a heuristic: if the project's stage
  // is later than this block's stage, but the block is filled, it's not stale.
  const stageOrder = [
    "concept",
    "core_loop",
    "mda",
    "balance",
    "progression",
    "economy",
    "gdd",
    "validation",
  ];
  const currentStageIdx = snap.currentStage
    ? stageOrder.indexOf(snap.currentStage)
    : -1;

  const blockStageIdx: Record<number, number> = {
    1: 0,
    2: 1,
    3: 2,
    4: 3,
    5: 4, // progression / economy
    6: 6, // gdd / validation
    7: 7,
    8: 7,
  };

  return [1, 2, 3, 4, 5, 6, 7, 8].map((blockId) => {
    const isFilled = !!filledMap[blockId];
    let status: BlockStatus;
    if (!isFilled) {
      status = "empty";
    } else if (
      currentStageIdx >= 0 &&
      blockStageIdx[blockId] < currentStageIdx &&
      // Block 5 has progression+economy — count as completed if BOTH filled
      !(blockId === 5 && snap.hasProgression && snap.hasEconomy) &&
      !(blockId === 6 && snap.hasGdd && snap.hasChecklist)
    ) {
      // Earlier stage filled but a later stage is current → could be stale.
      // For demo we just mark as "completed" (not stale) unless project stage
      // regressed. Stale notifications are still derived below.
      status = "completed";
    } else if (blockId === 7 || blockId === 8) {
      status = "completed";
    } else {
      status = "completed";
    }
    return {
      block_id: blockId,
      name: BLOCK_NAMES[blockId],
      status,
      is_filled: isFilled,
      updated_at: snap.updatedAt ? snap.updatedAt.toISOString() : null,
      stale_since: null,
      stale_reason: null,
    };
  });
}

/** Determine next block to fill (smallest block_id that's not filled). */
export function nextBlockToFill(
  snap: ProjectPipelineSnapshot
): number | null {
  if (!snap.hasConcept) return 1;
  if (!snap.hasCoreLoop) return 2;
  if (!snap.hasMda) return 3;
  if (!snap.hasBalance) return 4;
  if (!snap.hasProgression) return 5;
  if (!snap.hasEconomy) return 5;
  if (!snap.hasGdd) return 6;
  if (!snap.hasChecklist) return 6;
  return null;
}

/** Can the user proceed to the next block? */
export function canProceedTo(
  snap: ProjectPipelineSnapshot
): number | null {
  const next = nextBlockToFill(snap);
  return next;
}

/** Derive pipeline notifications (stale warnings). */
export function derivePipelineNotifications(
  snap: ProjectPipelineSnapshot
): PipelineNotification[] {
  const notifs: PipelineNotification[] = [];
  // Warn about gaps in the pipeline.
  if (snap.hasGdd && !snap.hasChecklist) {
    notifs.push({
      type: "stale_warning",
      block_id: 6,
      block_name: BLOCK_NAMES[6],
      message: "GDD сгенерирован, но финальная валидация не запущена.",
      severity: "warning",
      stale_since: snap.updatedAt ? snap.updatedAt.toISOString() : null,
      stale_reason: "validation_missing",
    });
  }
  if (snap.hasBalance && !snap.hasProgression) {
    notifs.push({
      type: "stale_warning",
      block_id: 5,
      block_name: BLOCK_NAMES[5],
      message: "Баланс выполнен, но прогрессия не спроектирована.",
      severity: "warning",
      stale_since: snap.updatedAt ? snap.updatedAt.toISOString() : null,
      stale_reason: "progression_missing",
    });
  }
  return notifs;
}

/**
 * Build the prepared input for a given block from the existing project state.
 * Returns an object with all upstream data the block's algorithm would need.
 */
export async function buildPreparedInput(
  userId: string,
  projectId: string,
  blockId: number
): Promise<Record<string, unknown> | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    include: {
      concept: true,
      coreLoop: true,
      mdaProfile: true,
      balanceResult: true,
      progression: true,
      economy: true,
      gdd: true,
      checklist: true,
    },
  });
  if (!project) return null;

  const input: Record<string, unknown> = {
    project_id: project.id,
    project_name: project.name,
    project_description: project.description,
    project_genre: project.genre,
    block_id: blockId,
    upstream: {} as Record<string, unknown>,
  };
  const upstream = input.upstream as Record<string, unknown>;

  if (blockId >= 2 && project.concept) {
    upstream.concept = {
      genre: project.concept.genre,
      subgenre: project.concept.subgenre,
      primary_aesthetic: project.concept.primaryAesthetic,
      usp: project.concept.usp,
      one_pager: project.concept.onePagerData,
      aesthetic_profile: project.concept.aestheticProfile,
      dynamics_profile: project.concept.dynamicsProfile,
      mechanic_set: project.concept.mechanicSet,
    };
  }
  if (blockId >= 3 && project.coreLoop) {
    upstream.core_loop = {
      structural_type: project.coreLoop.structuralType,
      structural_subtype: project.coreLoop.structuralSubtype,
      step_count: project.coreLoop.stepCount,
      steps: project.coreLoop.stepsData,
      inner_loops: project.coreLoop.innerLoops,
      outer_loops: project.coreLoop.outerLoops,
      meta_loop: project.coreLoop.metaLoop,
      pathologies: project.coreLoop.pathologies,
    };
  }
  if (blockId >= 4 && project.mdaProfile) {
    upstream.mda = {
      primary_aesthetic: project.mdaProfile.primaryAesthetic,
      secondary_aesthetic: project.mdaProfile.secondaryAesthetic,
      overall_match: project.mdaProfile.overallMatch,
      mechanic_set: project.mdaProfile.mechanicSet,
      observed_dynamics: project.mdaProfile.observedDynamics,
      predicted_aesthetics: project.mdaProfile.predictedAesthetics,
    };
  }
  if (blockId >= 5 && project.balanceResult) {
    upstream.balance = {
      balance_type: project.balanceResult.balanceType,
      overall_balance_score: project.balanceResult.overallBalanceScore,
      element_count: project.balanceResult.elementCount,
      elements: project.balanceResult.elements,
      cost_power_curves: project.balanceResult.costPowerCurves,
      pathologies: project.balanceResult.pathologies,
    };
  }
  if (blockId >= 6) {
    if (project.progression) {
      upstream.progression = {
        total_levels: project.progression.totalLevels,
        tier_count: project.progression.tierCount,
        curve_type: project.progression.curveType,
        target_duration_hours: project.progression.targetDurationHours,
        macro_model: project.progression.macroModel,
        curves: project.progression.curves,
        content_plan: project.progression.contentPlan,
      };
    }
    if (project.economy) {
      upstream.economy = {
        system_type: project.economy.systemType,
        resource_count: project.economy.resourceCount,
        has_pathology: project.economy.hasPathology,
        resource_model: project.economy.resourceModel,
        machinations_model: project.economy.machinationsModel,
        conversion_chains: project.economy.conversionChains,
        pathologies: project.economy.pathologies,
      };
    }
  }
  if (blockId >= 7 && project.gdd) {
    upstream.gdd = {
      format: project.gdd.format,
      section_count: project.gdd.sectionCount,
      completeness_percent: project.gdd.completenessPercent,
      sections: project.gdd.sections,
      consistency_issues: project.gdd.consistencyIssues,
    };
  }
  if (blockId >= 8 && project.checklist) {
    upstream.checklist = {
      overall_score: project.checklist.overallScore,
      readiness_level: project.checklist.readinessLevel,
      critical_issue_count: project.checklist.criticalIssueCount,
      total_issue_count: project.checklist.totalIssueCount,
      issues: project.checklist.issues,
      remediation_plan: project.checklist.remediationPlan,
    };
  }

  // Add suggested defaults for the block's own input
  input.suggested = {
    genre: project.genre || project.concept?.genre || "rpg",
    target_duration: 40,
    target_levels: 50,
    progression_type: "exponential",
    monetization_model: "b2p",
    pacing: "balanced",
  };

  return input;
}
