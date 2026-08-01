/**
 * POST /api/v1/coreloop/design
 *
 * Block 2 algorithm 3.2 (Core Loop Designer).
 * Refactored to use modular lib/coreloop/* modules.
 *
 * TASK-2.1/2.2/2.7/2.8/2.9: buildSteps parametrized by type.
 * TASK-2.3/2.10/2.11/2.17: 7 Bible pathologies + type-specific.
 * TASK-2.4/2.6/2.16: real closedness + 5 Gary questions + all-5-required threshold.
 * TASK-2.13: persists aiInsights, latencyMs, modelsUsed, garyFiveQuestions.
 * TASK-2.15: removed dead code.
 * TASK-2.18: improved enrichCoreLoop prompt.
 * TASK-2.19: multi-entry loop hierarchy (Bible 4.3).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { getOwnedProject, updateProjectStage, UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { enrichCoreLoop } from "@/lib/ai-service";
import { buildSteps } from "@/lib/coreloop/steps";
import { classifyStructuralType, VALID_LOOP_TYPES } from "@/lib/coreloop/classify";
import { detectPathologies } from "@/lib/coreloop/pathologies";
import { buildValidation } from "@/lib/coreloop/validation";
import { buildLoopHierarchy, buildRecommendations } from "@/lib/coreloop/hierarchy";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import { assertStageOutput, STAGE_CONTRACT_VERSION, validateStageInput } from "@/lib/contracts/stage-contracts";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import { resolveCoreLoopInput } from "@/lib/coreloop/input";

const GENRE_DEFAULT_LOOP_TYPE: Record<string, string> = {
  action: "engine", shooter: "engine", platformer: "engine", fighting: "engine",
  rhythm: "rhythm", racing: "engine", rpg: "economy", action_rpg: "hybrid",
  jrpg: "economy", tactical_rpg: "economy", mmorpg: "economy", strategy: "economy",
  rts: "economy", tbs: "economy", tower_defense: "tower_defense",
  simulation: "ecology", sandbox: "ecology", horror: "ecology",
  survival_horror: "ecology", roguelike: "hybrid", adventure: "hybrid",
  puzzle: "puzzle", metroidvania: "hybrid", idle: "engine",
  visual_novel: "hybrid", stealth: "hybrid",
};

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return VALIDATION_ERROR("Core Loop input must be a JSON object");
    }
    const projectId = body?.project_id?.toString().trim() || undefined;
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    const desiredLoopType = body?.desired_loop_type?.toString().trim() || undefined;
    const customSteps: string[] | undefined = Array.isArray(body?.custom_steps)
      ? body.custom_steps.map((s: unknown) => String(s).trim()).filter(Boolean)
      : undefined;
    if (desiredLoopType && !VALID_LOOP_TYPES.includes(desiredLoopType as typeof VALID_LOOP_TYPES[number])) {
      return VALIDATION_ERROR(`Неверный desired_loop_type: ${desiredLoopType}. Допустимо: ${VALID_LOOP_TYPES.join(", ")}`);
    }

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const proj = owned.project as {
      id: string; name: string; genre: string | null;
      concept?: {
        id?: string | null;
        genre?: string | null;
        primaryAesthetic?: string | null;
        aestheticProfile?: string | null;
        mechanicSet?: string | null;
      } | null;
    };
    const resolvedInput = resolveCoreLoopInput(body, proj.genre, proj.concept);
    const conceptId = resolvedInput.conceptId;
    const mechanics = resolvedInput.mechanics;
    const genre = resolvedInput.genre;
    const resolvedAesthetic = resolvedInput.primaryAesthetic;
    const resolvedBody = {
      ...body,
      concept_id: conceptId,
      mechanics,
      genre,
      ...(resolvedAesthetic ? { primary_aesthetic: resolvedAesthetic } : {}),
    };
    const contractInput = validateStageInput("core_loop", resolvedBody);
    if (!contractInput.success) return VALIDATION_ERROR(contractInput.error);

    // Stage 1: Build steps + classify
    const loopType = desiredLoopType || GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid";
    const steps = buildSteps(mechanics, customSteps, loopType, genre);
    const structuralType = classifyStructuralType(mechanics, genre, resolvedAesthetic, desiredLoopType, steps);

    // Stage 2: Build loop hierarchy (TASK-2.19)
    const loopHierarchy = buildLoopHierarchy(steps, structuralType.type);

    const innerLoops = [{
      name: "micro_action_loop",
      actions: steps.slice(0, 2).map((s) => s.action),
      duration_estimate: steps.slice(0, 2).reduce((s, st) => s + st.duration_estimate, 0),
      type: structuralType.type,
    }];
    const outerLoops = [{
      name: "session_loop",
      actions: ["Завершить 3 core loops", "Bank progress", "Триггерить event"],
      duration_estimate: 300, type: "outer",
    }];
    const metaLoop = {
      name: "meta_progression",
      actions: ["New Game+", "Season pass", "Daily challenges"],
      duration_estimate: 604800, type: "meta",
    };

    // Stage 3: Detect pathologies (TASK-2.3/2.10)
    const pathologies = detectPathologies(steps, structuralType);

    // Stage 4: Validation (TASK-2.4/2.6/2.16)
    const validation = buildValidation(steps, pathologies, structuralType);

    // Stage 5: Recommendations
    const recommendations = buildRecommendations(pathologies, structuralType);

    const latencyMs = Date.now() - startedAt;
    const stagesCompleted = [1, 2, 3, 4, 5];
    const modelsUsed = ["deterministic-coreloop-v2", "sellers-typology", "bible-4.10-pathologies", "gary-5-questions"];

    let result: Record<string, unknown> = {
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
      gary_five_questions: validation.gary_five_questions,
      contract_version: STAGE_CONTRACT_VERSION,
      artifact: createArtifactEnvelope("core_loop", contractInput.data),
      algorithm_metadata: getStageAlgorithmMetadata("core_loop"),
      stages_completed: stagesCompleted,
      latency_ms: latencyMs,
      models_used: modelsUsed,
    };

    // TASK-2.18: AI enrichment with extended context
    let aiInsights: string | null = null;
    if (useAi) {
      aiInsights = await enrichCoreLoop({
        projectName: proj.name || "Untitled",
        genre,
        coreLoopType: structuralType.type,
        steps: steps.map((s) => s.action),
        pathologies: pathologies.pathologies.map((p) => p.name),
        deadResources: validation.resource_sufficiency.dead_resources,
        unsourcedConsumables: validation.resource_sufficiency.unsourced_consumables,
        garyAnswers: validation.gary_five_questions.answers,
      });
      if (aiInsights) {
        result.ai_insights = aiInsights;
        modelsUsed.push("glm-4.6 (ai-enrichment)");
        result.models_used = modelsUsed;
      }
    }

    assertStageOutput("core_loop", result);

    // TASK-2.13: persist with new fields
    const inputData = JSON.stringify({
      concept_id: conceptId, mechanics, genre,
      primary_aesthetic: resolvedAesthetic,
      mechanics_source: resolvedInput.mechanicsSource,
      desired_loop_type: desiredLoopType, custom_steps: customSteps,
    });
    const stepsData = JSON.stringify(steps);
    const fullProfile = JSON.stringify({
      ...result, ai_insights: aiInsights, gary_five_questions: validation.gary_five_questions,
    });

    await db.projectCoreLoop.upsert({
      where: { projectId: proj.id },
      create: {
        projectId: proj.id,
        structuralType: structuralType.type,
        structuralSubtype: structuralType.sub_type,
        stepCount: steps.length,
        hierarchyDepth: 6,
        pathologyCount: pathologies.total_count,
        inputData, stepsData,
        innerLoops: JSON.stringify(innerLoops),
        outerLoops: JSON.stringify(outerLoops),
        metaLoop: JSON.stringify(metaLoop),
        loopHierarchy: JSON.stringify(loopHierarchy),
        pathologies: JSON.stringify(pathologies),
        recommendations: JSON.stringify(recommendations),
        validationData: JSON.stringify(validation),
        fullProfile,
        aiInsights: aiInsights || null,
        latencyMs,
        modelsUsed: JSON.stringify(modelsUsed),
        garyFiveQuestions: JSON.stringify(validation.gary_five_questions),
      },
      update: {
        structuralType: structuralType.type,
        structuralSubtype: structuralType.sub_type,
        stepCount: steps.length,
        hierarchyDepth: 6,
        pathologyCount: pathologies.total_count,
        inputData, stepsData,
        innerLoops: JSON.stringify(innerLoops),
        outerLoops: JSON.stringify(outerLoops),
        metaLoop: JSON.stringify(metaLoop),
        loopHierarchy: JSON.stringify(loopHierarchy),
        pathologies: JSON.stringify(pathologies),
        recommendations: JSON.stringify(recommendations),
        validationData: JSON.stringify(validation),
        fullProfile,
        aiInsights: aiInsights || null,
        latencyMs,
        modelsUsed: JSON.stringify(modelsUsed),
        garyFiveQuestions: JSON.stringify(validation.gary_five_questions),
      },
    });

    await updateProjectStage(proj.id, "core_loop");

    return NextResponse.json(result);
  } catch (error) {
    console.error("[coreloop/design] error:", error);
    return SERVER_ERROR();
  }
}
