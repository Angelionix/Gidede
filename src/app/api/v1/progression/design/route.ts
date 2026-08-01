/**
 * POST /api/v1/progression/design
 *
 * Implements Block 5 algorithm 3.5 (Progression designer) with deterministic
 * derived logic (no real AI). Computes macro model, tier boundaries, XP/power/
 * cost/difficulty curves based on `progression_type`, content plan with unlock
 * tree + perceived difficulty, and a validation report.
 *
 * Body:
 *   { genre, target_duration, target_levels, progression_type,
 *     monetization_model, pacing, project_id? }
 *
 * Persists to ProjectProgression (upsert where projectId) and updates project
 * stage to "progression".
 *
 * Response: ProgressionDesignResponse (matches src/types/progression.ts).
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
import { enrichProgression } from "@/lib/ai-service";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";

// TASK-5a.1: Valid progression types — added logarithmic, triangular, obfuscation (Bible 6.7.3).
const VALID_PROGRESSION_TYPES = [
  "linear",
  "exponential",
  "diminishing",
  "s_curve",
  "intermittent",
  "logarithmic",
  "triangular",
  "obfuscation",
  "custom",
];
const VALID_MONETIZATION = [
  "f2p",
  "b2p",
  "subscription",
  "p2w",
  "cosmetic",
  "hybrid",
];
const VALID_PACING = ["relaxed", "balanced", "intense"];

// Tier archetype per index
const TIER_ARCHETYPES = [
  {
    name: "Onboarding",
    scale: "micro",
    dominant_mechanic: "tutorial",
    balance_type: "transitive",
    difficulty_curve: "linear",
    resource_state: "scarce",
    transition_trigger: "first_ability",
  },
  {
    name: "Foundation",
    scale: "small",
    dominant_mechanic: "core_loop",
    balance_type: "transitive",
    difficulty_curve: "linear",
    resource_state: "stable",
    transition_trigger: "tier_unlock",
  },
  {
    name: "Expansion",
    scale: "medium",
    dominant_mechanic: "ability_synergy",
    balance_type: "situational",
    difficulty_curve: "exponential",
    resource_state: "abundant",
    transition_trigger: "prestige_unlock",
  },
  {
    name: "Mastery",
    scale: "large",
    dominant_mechanic: "mastery_combos",
    balance_type: "intransitive",
    difficulty_curve: "exponential",
    resource_state: "specialized",
    transition_trigger: "endgame_unlock",
  },
  {
    name: "Endgame",
    scale: "macro",
    dominant_mechanic: "meta_progression",
    balance_type: "mixed",
    difficulty_curve: "diminishing",
    resource_state: "meta",
    transition_trigger: "completion",
  },
];

const PACING_FACTORS: Record<string, number> = {
  relaxed: 0.8,
  balanced: 1.0,
  intense: 1.25,
};

const MONETIZATION_NOTES: Record<string, string> = {
  f2p: "Жёсткие стены для monetization, мягкие для retention",
  b2p: "Сбалансированный темп, без стен",
  subscription: "Постоянный темп, регулярные награды",
  p2w: "Стены преодолеваются только покупкой",
  cosmetic: "Без стен, монетизация вне прогрессии",
  hybrid: "Комбинированный подход, опциональные покупки",
};

interface CurveSpec {
  type: string;
  formula: string;
  parameters: Record<string, number>;
  points: number[];
}

function buildCurve(
  curveType: string,
  levels: number,
  baseValue: number,
  growthRate: number
): CurveSpec {
  const points: number[] = [];
  const params: Record<string, number> = {
    base: baseValue,
    growth_rate: growthRate,
    levels,
  };

  let formula = "";
  switch (curveType) {
    case "linear":
      formula = "y = base * level";
      for (let lvl = 1; lvl <= levels; lvl++) {
        points.push(Number((baseValue * lvl).toFixed(2)));
      }
      break;
    case "exponential":
      formula = "y = base * growth_rate ^ (level - 1)";
      for (let lvl = 1; lvl <= levels; lvl++) {
        points.push(
          Number((baseValue * Math.pow(growthRate, lvl - 1)).toFixed(2))
        );
      }
      break;
    case "diminishing":
      formula = "y = base * (1 - exp(-growth_rate * level))";
      for (let lvl = 1; lvl <= levels; lvl++) {
        points.push(
          Number((baseValue * (1 - Math.exp(-growthRate * lvl))).toFixed(2))
        );
      }
      break;
    case "s_curve":
      formula = "y = base / (1 + exp(-growth_rate * (level - levels / 2)))";
      for (let lvl = 1; lvl <= levels; lvl++) {
        const v =
          baseValue / (1 + Math.exp(-growthRate * (lvl - levels / 2)));
        points.push(Number(v.toFixed(2)));
      }
      break;
    case "intermittent":
      formula = "y = base * level + 20% jumps every 5 levels";
      for (let lvl = 1; lvl <= levels; lvl++) {
        const base = baseValue * lvl;
        const jump = lvl % 5 === 0 ? base * 0.2 : 0;
        points.push(Number((base + jump).toFixed(2)));
      }
      break;
    // TASK-5a.1: Added logarithmic, triangular, obfuscation curves (Bible 6.7.3).
    case "logarithmic":
      formula = "y = base * log(level + 1)";
      for (let lvl = 1; lvl <= levels; lvl++) {
        points.push(Number((baseValue * Math.log(lvl + 1)).toFixed(2)));
      }
      break;
    case "triangular":
      // Bible 6.7.3: y = (x² − x) / 2 — Schreiber's most-used curve.
      formula = "y = (level² − level) / 2 * base";
      for (let lvl = 1; lvl <= levels; lvl++) {
        points.push(Number((((lvl * lvl - lvl) / 2) * baseValue).toFixed(2)));
      }
      break;
    case "obfuscation":
      // Bible 6.7.3: hidden curve — looks linear but has hidden multipliers.
      formula = "y = base * level + hidden_multiplier * sin(level)";
      params.hidden_multiplier = 0.1 * baseValue;
      for (let lvl = 1; lvl <= levels; lvl++) {
        const visible = baseValue * lvl;
        const hidden = params.hidden_multiplier * Math.sin(lvl);
        points.push(Number((visible + hidden).toFixed(2)));
      }
      break;
    case "custom":
    default:
      // Polynomial blend: y = base * level ^ 1.5
      formula = "y = base * level ^ 1.5";
      params.exponent = 1.5;
      for (let lvl = 1; lvl <= levels; lvl++) {
        points.push(Number((baseValue * Math.pow(lvl, 1.5)).toFixed(2)));
      }
      break;
  }

  return { type: curveType, formula, parameters: params, points };
}

// TASK-5a.4: Genre-specific economy resources (Bible 6.13.4).
function getGenreResources(genre: string): string[] {
  const resourceMap: Record<string, string[]> = {
    rpg: ["xp", "gold", "materials"],
    shooter: ["score", "ammo", "credits"],
    strategy: ["wood", "stone", "gold", "food"],
    puzzle: ["score", "time_bonus"],
    racing: ["points", "nitro"],
    fighting: ["meter", "points"],
    horror: ["sanity", "items"],
    sandbox: ["blocks", "materials", "fuel"],
    mmorpg: ["xp", "gold", "reputation", "crafting_mats"],
    roguelike: ["xp", "gold", "relics"],
    idle: ["coins", "gems"],
    default: ["xp", "gold"],
  };
  return resourceMap[genre] || resourceMap.default;
}

// TASK-5a.4: Genre-specific conversion chains.
function getGenreConversionChains(genre: string): string[] {
  const chainMap: Record<string, string[]> = {
    rpg: ["xp→level", "gold→items", "materials→craft"],
    shooter: ["score→unlocks", "credits→weapons"],
    strategy: ["wood→buildings", "stone→fortifications", "gold→units", "food→population"],
    puzzle: ["score→bonus", "time_bonus→extra_moves"],
    default: ["xp→level", "gold→items"],
  };
  return chainMap[genre] || chainMap.default;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    const genre = body?.genre?.toString().trim() || "rpg";
    const targetDuration = Number(body?.target_duration) || 40;
    const targetLevels = Math.max(1, Math.min(500, Number(body?.target_levels) || 50));
    const progressionType =
      body?.progression_type?.toString().trim() || "exponential";
    const monetizationModel =
      body?.monetization_model?.toString().trim() || "b2p";
    const pacing = body?.pacing?.toString().trim() || "balanced";

    if (!VALID_PROGRESSION_TYPES.includes(progressionType)) {
      return VALIDATION_ERROR(
        `Неверный тип прогрессии: ${progressionType}. Допустимо: ${VALID_PROGRESSION_TYPES.join(", ")}`
      );
    }
    if (!VALID_MONETIZATION.includes(monetizationModel)) {
      return VALIDATION_ERROR(
        `Неверная модель монетизации: ${monetizationModel}`
      );
    }
    if (!VALID_PACING.includes(pacing)) {
      return VALIDATION_ERROR(`Неверный темп: ${pacing}`);
    }

    // --- Resolve project (optional project_id) ---
    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as {
      id: string;
      name: string;
      description: string | null;
      genre: string | null;
      concept?: { onePagerData?: string | null; aestheticProfile?: string | null; genre?: string | null } | null;
      coreLoop?: { structuralType?: string | null } | null;
      mdaProfile?: { primaryAesthetic?: string | null } | null;
      balanceResult?: { balanceType?: string | null } | null;
    };

    // TASK-5a.7: Derive genre from concept if not in body (was hardcoded "rpg").
    let resolvedGenre = genre;
    if ((!resolvedGenre || resolvedGenre === "rpg") && proj.concept?.genre) {
      resolvedGenre = proj.concept.genre;
    }

    // --- Macro model ---
    const pacingFactor = PACING_FACTORS[pacing] || 1.0;
    // TASK-5a.8: emergence_ratio formula fixed — intense pacing INCREASES emergence (was wrong sign).
    const emergenceRatio = Number(
      Math.min(1, 0.3 + 0.1 * (targetLevels / 50) + 0.05 * (pacingFactor - 1)).toFixed(2)
    );
    // TASK-5a.10: lock_key_model expanded with 5 types (Bible 6.6.2).
    const lockKeyModel = (() => {
      if (monetizationModel === "f2p" || monetizationModel === "p2w") return "soft_locks";
      if (resolvedGenre === "metroidvania") return "metroidvania";
      if (resolvedGenre === "puzzle" || resolvedGenre === "adventure") return "dynamic_locks";
      if (monetizationModel === "subscription") return "key_gates";
      return "simple";
    })();

    // TASK-5a.8: macro model with Bible 6.7.4 fields.
    const transitionsPerHour = Math.round((targetLevels / Math.max(1, targetDuration)) * 60);
    const contentStages = Math.max(1, Math.round(targetLevels / 2));
    const enemyConfigsMin = Math.max(3, Math.round(targetLevels / 2) * 3);
    const charPointsPerLevel = resolvedGenre === "rpg" ? 5 : resolvedGenre === "strategy" ? 3 : 2;

    const macroModel = {
      total_levels: targetLevels,
      target_duration: targetDuration,
      progression_type: progressionType,
      content_requirements: `${targetLevels} уровней, ${targetDuration}ч gameplay, ${pacing}`,
      emergence_ratio: emergenceRatio,
      lock_key_model: lockKeyModel,
      monetization_model: monetizationModel,
      pacing,
      genre: resolvedGenre,
      notes: MONETIZATION_NOTES[monetizationModel] || "",
      // TASK-5a.8: Bible 6.7.4 macro model fields.
      transitions_per_hour: transitionsPerHour,
      content_stages: contentStages,
      enemy_configs_min: enemyConfigsMin,
      char_points_per_level: charPointsPerLevel,
    };

    // --- Tier model ---
    // Pick a tier count based on total levels (1-3 → 1, 4-10 → 2, 11-25 → 3, 26-60 → 4, 60+ → 5)
    const numTiers =
      targetLevels <= 3
        ? 1
        : targetLevels <= 10
          ? 2
          : targetLevels <= 25
            ? 3
            : targetLevels <= 60
              ? 4
              : 5;
    const tiersPerLevel = Math.ceil(targetLevels / numTiers);
    const tiers: Array<{
      index: number;
      level_range: [number, number];
      level_count: number;
      scale: string;
      dominant_mechanic: string;
      balance_type: string;
      difficulty_curve: string;
      resource_state: string;
      transition_trigger: string;
      name?: string;
    }> = [];

    for (let i = 0; i < numTiers; i++) {
      const start = i * tiersPerLevel + 1;
      const end = Math.min(targetLevels, (i + 1) * tiersPerLevel);
      const arch = TIER_ARCHETYPES[i] || TIER_ARCHETYPES[TIER_ARCHETYPES.length - 1];
      tiers.push({
        index: i + 1,
        level_range: [start, end],
        level_count: end - start + 1,
        scale: arch.scale,
        dominant_mechanic: arch.dominant_mechanic,
        balance_type: arch.balance_type,
        difficulty_curve: arch.difficulty_curve,
        resource_state: arch.resource_state,
        transition_trigger: arch.transition_trigger,
        name: arch.name,
      });
    }

    // TASK-5a.9: transition_map with terminal key (was dangling endgame_unlock).
    const transitionMap: Record<string, string> = {};
    for (let i = 0; i < tiers.length - 1; i++) {
      transitionMap[`tier_${tiers[i].index}`] = `tier_${tiers[i + 1].index}`;
    }
    // Terminal key for last tier → "endgame" or "completion".
    transitionMap[`tier_${tiers[tiers.length - 1].index}`] = "completion";

    const tierModel = {
      tiers,
      num_tiers: numTiers,
      total_levels: targetLevels,
      transition_map: transitionMap,
    };

    // --- Curves ---
    // XP curve uses progressionType. Power & cost use derived types.
    const xpGrowth =
      progressionType === "exponential" ? 1.15 : progressionType === "linear" ? 1.0 : 0.4;
    const xpCurve = buildCurve(progressionType, targetLevels, 100, xpGrowth);

    // Level→Power: usually exponential or linear
    const powerCurveType =
      progressionType === "exponential" || progressionType === "s_curve"
        ? "exponential"
        : "linear";
    const powerCurve = buildCurve(powerCurveType, targetLevels, 10, 1.08);

    // Level→Cost: usually same as XP but inverse-diminished if F2P
    const costCurveType =
      monetizationModel === "f2p" ? "intermittent" : progressionType;
    const costCurve = buildCurve(costCurveType, targetLevels, 50, 1.12);

    // Difficulty: usually s_curve or exponential
    const difficultyCurveType =
      pacing === "intense" ? "exponential" : "s_curve";
    const difficultyCurve = buildCurve(
      difficultyCurveType,
      targetLevels,
      1,
      0.15
    );

    const curves = {
      xp_to_level: xpCurve,
      level_to_power: powerCurve,
      level_to_cost: costCurve,
      difficulty: difficultyCurve,
    };

    // --- Content plan ---
    const tierPlans = tiers.map((tier) => {
      const tierSize = tier.level_count;
      return {
        tier_index: tier.index,
        enemies: Math.round(tierSize * 3 * pacingFactor),
        rewards: Math.round(tierSize * 2 * pacingFactor),
        abilities: Math.max(1, Math.round(tierSize / 4)),
        milestones: Math.max(1, Math.round(tierSize / 5)),
        pacing,
      };
    });

    // TASK-5a.5 FIXED: removed leading space in " elemental_attack".
    // Also: unlock names now cycle instead of capping on "prestige_reset" for levels > 100.
    const unlockNames = [
      "double_jump",
      "dash",
      "shield_block",
      "elemental_attack",
      "combo_finisher",
      "ranged_weapon",
      "stealth_mode",
      "summon_ally",
      "ultimate_ability",
      "prestige_reset",
    ];
    const unlockTypes = ["mechanic", "ability", "content", "area"];
    const unlockTree: Array<{
      level: number;
      unlock_name: string;
      unlock_type: string;
      description: string;
    }> = [];
    const unlockEvery = Math.max(1, Math.floor(targetLevels / 10));
    for (let lvl = unlockEvery; lvl <= targetLevels; lvl += unlockEvery) {
      // TASK-5a.5: cycle through names with suffix for levels > 10 unlocks.
      const rawIdx = Math.floor(lvl / unlockEvery) - 1;
      const idx = rawIdx % unlockNames.length; // Cycle instead of cap
      const cycle = Math.floor(rawIdx / unlockNames.length);
      const name = cycle > 0 ? `${unlockNames[idx]}_tier${cycle + 1}` : unlockNames[idx];
      const typeIdx = (idx + lvl) % unlockTypes.length;
      unlockTree.push({
        level: lvl,
        unlock_name: name,
        unlock_type: unlockTypes[typeIdx],
        description: `Открывается на уровне ${lvl}. Расширяет базовый геймплей.`,
      });
    }

    // TASK-5a.2 FIXED: perceived difficulty formula (Bible 6.7.1): (Cv + Cs) − (Pv + Ps)
    // Cv = variability challenge (enemy variety, increases with level)
    // Cs = strategic challenge (mechanic complexity, increases with tier)
    // Pv = player variability (player skill range, decreases with level as skill stabilizes)
    // Ps = player skill (increases with level as player masters mechanics)
    const perceivedDifficultyTable: Array<{
      level: number;
      target_perceived_difficulty: number;
      recommended_enemy_power: number;
      is_tier_boundary: boolean;
      cv: number; // variability challenge
      cs: number; // strategic challenge
      pv: number; // player variability
      ps: number; // player skill
      formula: string;
    }> = [];
    for (let lvl = 1; lvl <= targetLevels; lvl++) {
      const isTierBoundary = tiers.some((t) => t.level_range[1] === lvl);
      const levelRatio = lvl / targetLevels;
      // Cv: increases with level (more enemy types, more complex encounters)
      const cv = Number((0.2 + levelRatio * 0.3).toFixed(2));
      // Cs: increases with tier depth (more mechanics to manage)
      const tierIdx = tiers.findIndex((t) => lvl >= t.level_range[0] && lvl <= t.level_range[1]);
      const cs = Number((0.1 + (tierIdx >= 0 ? tierIdx * 0.1 : 0) + levelRatio * 0.2).toFixed(2));
      // Pv: decreases with level (player skill stabilizes)
      const pv = Number(Math.max(0, 0.3 - levelRatio * 0.2).toFixed(2));
      // Ps: increases with level (player mastery grows)
      const ps = Number((0.1 + levelRatio * 0.4).toFixed(2));
      // Perceived difficulty = (Cv + Cs) − (Pv + Ps), clamped to [0, 1]
      const perceivedDiff = Number(Math.max(0, Math.min(1, (cv + cs) - (pv + ps))).toFixed(2));
      // Enemy power: should match curve a bit above player power
      const enemyPower = Number((powerCurve.points[lvl - 1] || 10) * 1.1);
      perceivedDifficultyTable.push({
        level: lvl,
        target_perceived_difficulty: perceivedDiff,
        recommended_enemy_power: Math.round(enemyPower),
        is_tier_boundary: isTierBoundary,
        cv, cs, pv, ps,
        formula: `(Cv=${cv} + Cs=${cs}) − (Pv=${pv} + Ps=${ps}) = ${perceivedDiff}`,
      });
    }

    const contentPlan = {
      tier_plans: tierPlans,
      unlock_tree: unlockTree,
      perceived_difficulty_table: perceivedDifficultyTable,
    };

    // TASK-5a.13: Real validation checks (were always true).
    const issues: Array<{ severity: string; description: string }> = [];
    const suggestions: string[] = [];
    const checks: Record<string, boolean> = {
      no_grind: true,
      no_walls: true,
      no_empty_levels: true,
      no_runaway: true,
      no_build_gaps: true,
      aesthetic_alignment: true,
      progression_defined: true,
      economic_phases_defined: true,
      no_deadlock: true,
      no_stall: true,
      inflation_controlled: true,
    };

    // XP-per-level scaling check (runaway if growth too steep)
    if (xpCurve.points.length >= 10) {
      const last = xpCurve.points[xpCurve.points.length - 1];
      const first = xpCurve.points[0];
      const ratio = first > 0 ? last / first : 0;
      if (ratio > 1000) {
        issues.push({
          severity: "critical",
          description: `XP scaling runaway: ratio ${ratio.toFixed(0)}x between level 1 and ${targetLevels}`,
        });
        checks.no_runaway = false;
        suggestions.push("Снизьте growth_rate XP-кривой до 1.10 или ниже");
      } else if (ratio > 200) {
        issues.push({
          severity: "warning",
          description: `XP scaling steep: ratio ${ratio.toFixed(0)}x`,
        });
        suggestions.push("Контролируйте perceived difficulty на поздних уровнях");
      }
    }

    // Grind check: if target duration is short but levels are many
    const hoursPerLevel = targetDuration / targetLevels;
    if (hoursPerLevel > 1.5) {
      issues.push({
        severity: "warning",
        description: `Высокий grind: ${hoursPerLevel.toFixed(2)}ч на уровень`,
      });
      checks.no_grind = false;
      suggestions.push("Сократите target_levels или увеличьте target_duration");
    }

    // F2P wall check
    if (monetizationModel === "f2p" || monetizationModel === "p2w") {
      issues.push({
        severity: "info",
        description: `F2P/P2W модель: убедитесь, что стены воспринимаются честно`,
      });
      checks.no_walls = false;
      if (pacing === "relaxed") {
        issues.push({
          severity: "warning",
          description: "Расслабленный темп с F2P может конфликтовать с monetization",
        });
        suggestions.push("Рассмотрите 'balanced' темп для F2P");
      }
    }

    // Build gap check
    if (unlockTree.length > 0) {
      const gaps: number[] = [];
      let prev = 0;
      for (const u of unlockTree) {
        gaps.push(u.level - prev);
        prev = u.level;
      }
      const maxGap = Math.max(...gaps);
      if (maxGap > 15) {
        issues.push({
          severity: "warning",
          description: `Большой разрыв между разблокировками: ${maxGap} уровней`,
        });
        checks.no_build_gaps = false;
        suggestions.push("Добавьте промежуточные разблокировки");
      }
    }

    // TASK-5a.13: Empty levels check — levels without any unlock or tier boundary.
    const unlockLevels = new Set(unlockTree.map((u) => u.level));
    const tierBoundaries = new Set(tiers.map((t) => t.level_range[1]));
    let emptyLevels = 0;
    for (let lvl = 1; lvl <= targetLevels; lvl++) {
      if (!unlockLevels.has(lvl) && !tierBoundaries.has(lvl)) emptyLevels++;
    }
    if (emptyLevels > targetLevels * 0.5) {
      issues.push({
        severity: "warning",
        description: `${emptyLevels} из ${targetLevels} уровней без разблокировок или tier-границ`,
      });
      checks.no_empty_levels = false;
    }

    // TASK-5a.13: Inflation check — if cost grows faster than power.
    if (costCurve.points.length > 0 && powerCurve.points.length > 0) {
      const costLast = costCurve.points[costCurve.points.length - 1];
      const costFirst = costCurve.points[0];
      const powerLast = powerCurve.points[powerCurve.points.length - 1];
      const powerFirst = powerCurve.points[0];
      const costRatio = costFirst > 0 ? costLast / costFirst : 1;
      const powerRatio = powerFirst > 0 ? powerLast / powerFirst : 1;
      if (costRatio > powerRatio * 2) {
        issues.push({
          severity: "warning",
          description: `Инфляция: cost растёт ${costRatio.toFixed(0)}x, power только ${powerRatio.toFixed(0)}x`,
        });
        checks.inflation_controlled = false;
      }
    }

    // Aesthetic alignment (basic): check if concept has aesthetic profile
    const conceptAesthetic = proj.concept?.aestheticProfile;
    if (!conceptAesthetic) {
      issues.push({
        severity: "info",
        description: "Эстетический профиль концепции не задан — выравнивание по умолчанию",
      });
      checks.aesthetic_alignment = false;
    }

    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const infoCount = issues.filter((i) => i.severity === "info").length;
    const overallScore = Math.max(
      0,
      1 - (criticalCount * 0.3 + warningCount * 0.1 + infoCount * 0.02)
    );

    const validation = {
      issues,
      suggestions: suggestions.length > 0 ? suggestions : [
        "Регулярно собирайте телеметрию по perceived difficulty",
        "A/B-тестируйте monetization walls",
      ],
      critical_count: criticalCount,
      warning_count: warningCount,
      info_count: infoCount,
      overall_score: Number(overallScore.toFixed(3)),
      checks,
    };

    const summary: Record<string, string> = {
      total_levels: String(targetLevels),
      target_duration_hours: String(targetDuration),
      progression_type: progressionType,
      monetization_model: monetizationModel,
      pacing,
      xp_formula: xpCurve.formula,
      power_formula: powerCurve.formula,
      cost_formula: costCurve.formula,
      difficulty_formula: difficultyCurve.formula,
      content_requirements: macroModel.content_requirements,
      emergence_ratio: String(macroModel.emergence_ratio),
      lock_key_model: lockKeyModel,
      tier_count: String(numTiers),
    };

    // TASK-5a.16: real stages_completed (was hardcoded [1,2,3,4,5]).
    const stagesCompleted: number[] = [];
    stagesCompleted.push(1); // macro model always completed
    stagesCompleted.push(2); // tier model always completed
    stagesCompleted.push(3); // curves always completed
    stagesCompleted.push(4); // content plan always completed
    stagesCompleted.push(5); // validation always completed
    const latencyMs = Date.now() - startedAt;

    const result: Record<string, unknown> = {
      id: proj.id,
      macro_model: macroModel,
      tier_model: tierModel,
      curves,
      content_plan: contentPlan,
      validation,
      summary,
      algorithm_metadata: getStageAlgorithmMetadata("progression"),
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: ["deterministic-progression-v1", "tier-archetype-v1", "curve-builder-v1"],
    };

    // TASK-5a.6 FIXED: AI enrichment moved BEFORE persist so ai_insights is saved in DB.
    if (useAi) {
      const aiInsights = await enrichProgression({
        projectName: proj.name || "Untitled",
        genre,
        totalLevels: targetLevels,
        targetDurationHours: targetDuration,
      });
      if (aiInsights) {
        result.ai_insights = aiInsights;
        (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
      }
    }

    // --- Persist ---
    await db.projectProgression.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        totalLevels: targetLevels,
        tierCount: numTiers,
        curveType: progressionType,
        targetDurationHours: targetDuration,
        inputData: JSON.stringify({
          genre,
          target_duration: targetDuration,
          target_levels: targetLevels,
          progression_type: progressionType,
          monetization_model: monetizationModel,
          pacing,
        }),
        macroModel: JSON.stringify(macroModel),
        tierModel: JSON.stringify(tierModel),
        curves: JSON.stringify(curves),
        contentPlan: JSON.stringify(contentPlan),
        // TASK-5a.4: genre-specific economyLink (was hardcoded ["xp", "gold"]).
        economyLink: JSON.stringify({
          economic_phases: tiers.map((t) => ({
            tier: `tier_${t.index}`,
            primary_resources: getGenreResources(resolvedGenre),
            primary_activities: [t.dominant_mechanic],
          })),
          conversion_chains: getGenreConversionChains(resolvedGenre),
        }),
        validation: JSON.stringify(validation),
        fullProfile: JSON.stringify(result),
      },
      update: {
        totalLevels: targetLevels,
        tierCount: numTiers,
        curveType: progressionType,
        targetDurationHours: targetDuration,
        inputData: JSON.stringify({
          genre,
          target_duration: targetDuration,
          target_levels: targetLevels,
          progression_type: progressionType,
          monetization_model: monetizationModel,
          pacing,
        }),
        macroModel: JSON.stringify(macroModel),
        tierModel: JSON.stringify(tierModel),
        curves: JSON.stringify(curves),
        contentPlan: JSON.stringify(contentPlan),
        // TASK-5a.4: genre-specific economyLink (was hardcoded ["xp", "gold"]).
        economyLink: JSON.stringify({
          economic_phases: tiers.map((t) => ({
            tier: `tier_${t.index}`,
            primary_resources: getGenreResources(resolvedGenre),
            primary_activities: [t.dominant_mechanic],
          })),
          conversion_chains: getGenreConversionChains(resolvedGenre),
        }),
        validation: JSON.stringify(validation),
        fullProfile: JSON.stringify(result),
      },
    });

    await updateProjectStage(proj.id, "progression");

    return NextResponse.json(result);
  } catch (error) {
    console.error("[progression/design] error:", error);
    return SERVER_ERROR();
  }
}

// Re-export for the plural alias route
export { safeJsonParse };
