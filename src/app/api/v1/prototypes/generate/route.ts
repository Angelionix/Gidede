/**
 * POST /api/v1/prototypes/generate
 *
 * Генерирует HTML-прототип кор-лупа из данных проекта.
 * Body: { project_id: string, mode?: '2d'|'3d', use_ai?: bool, type?: string }
 * Response: { html: string, config: {...}, playable: true }
 *
 * R-PROTO-DATA: теперь читает Balance/Progression/Economy артефакты проекта
 * и использует их для data-driven параметров прототипа (playerSpeed, enemyDamage,
 * counterThreshold, resourceName и т.д.). Раньше все engine-прототипы были
 * одинаковыми (hardcoded defaults); теперь они содержательно различаются
 * между проектами.
 *
 * R-PROTO-TYPES: теперь поддерживает 10 типов прототипов (было 6):
 *   engine, economy, ecology, tower_defense, rhythm, puzzle (оригинальные)
 *   platformer, stealth, deck_builder, survival_horror (новые)
 * Новые типы используют graph-builder path (compileGraph), legacy inline
 * templates не доступны для них.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import {
  buildPrototypeConfig,
  generatePrototypeHtml,
  generatePrototypeFromGraph,
} from "@/lib/prototype-generator";
import {
  extractPrototypeParams,
  resolvePrototypeType,
} from "@/lib/prototype-params";
import { generatePrototypeInsights, generateCustomMechanic } from "@/lib/ai-service";
import { createPrototypeArtifact, PrototypeLineageError } from "@/lib/prototype-lineage";

/**
 * Infer mechanic IDs for the new compiler based on prototype type.
 * Maps each prototype type to the mechanics that the IR compiler should resolve.
 */
function inferMechanicIds(
  resolvedType: string,
  mechanicNames: string[] | undefined,
): string[] {
  // Type-based defaults: each type maps to canonical mechanic IDs.
  const typeToMechanics: Record<string, string[]> = {
    engine: ["locomotion", "collect"],
    economy: ["locomotion", "collect"],
    ecology: ["locomotion", "collect", "survival"],
    tower_defense: ["locomotion", "combat", "collect"],
    rhythm: ["locomotion"],
    puzzle: ["locomotion"],
    platformer: ["locomotion", "collect"],
    stealth: ["locomotion", "survival"],
    deck_builder: ["locomotion", "collect"],
    survival_horror: ["locomotion", "survival", "collect"],
  };
  const mechanics = typeToMechanics[resolvedType] || ["locomotion", "collect"];
  // If mechanicNames are available, try to map them to canonical IDs.
  if (mechanicNames && mechanicNames.length > 0) {
    const extra: string[] = [];
    for (const name of mechanicNames.slice(0, 5)) {
      const lower = name.toLowerCase();
      if (lower.includes("двиг") || lower.includes("move") || lower.includes("ход")) extra.push("locomotion");
      else if (lower.includes("сбор") || lower.includes("collect") || lower.includes("pickup")) extra.push("collect");
      else if (lower.includes("бой") || lower.includes("combat") || lower.includes("attack")) extra.push("combat");
      else if (lower.includes("выжив") || lower.includes("survival") || lower.includes("avoid")) extra.push("survival");
    }
    // Merge unique.
    return [...new Set([...mechanics, ...extra])];
  }
  return mechanics;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || null;
    const mode = (body?.mode?.toString().trim() === "3d" ? "3d" : "2d") as "2d" | "3d";
    const useAi = body?.use_ai === true || body?.use_ai === "true";
    // Optional override: test any prototype type without changing the project's core loop
    const typeOverride = body?.type?.toString().trim() || null;

    if (!projectId) {
      return VALIDATION_ERROR("project_id обязателен");
    }

    // getOwnedProject проверяет владение и возвращает project с includes
    const owned = await getOwnedProject(
      { id: user.id, email: user.email, name: user.name },
      projectId
    );
    if (owned instanceof NextResponse) return owned;

    const project = owned.project as {
      id: string;
      name: string;
      genre: string | null;
      description: string | null;
      pipelineState: string | null;
      concept?: {
        aestheticProfile: string | null;
        mechanicSet: string | null;
      } | null;
      coreLoop?: {
        structuralType: string | null;
        steps: string | null;
        stepsData: string | null;
        inputData: string | null;
      } | null;
      balanceResult?: {
        overallBalanceScore: number | null;
        elementCount: number | null;
        fullResult: string | null;
      } | null;
      progression?: {
        totalLevels: number | null;
        tierCount: number | null;
        curveType: string | null;
        fullProfile: string | null;
      } | null;
      economy?: {
        resourceCount: number | null;
        hasPathology: boolean;
        resourceModel: string | null;
        fullProfile: string | null;
      } | null;
    };

    // R-PROTO-DATA: extract params from upstream artifacts (Balance,
    // Progression, Economy). Returns {} if artifacts are missing.
    const dataParams = extractPrototypeParams(project);

    // R-PROTO-TYPES: resolve prototype type from override / core loop / genre.
    const resolvedType = resolvePrototypeType(
      typeOverride,
      project.coreLoop?.structuralType,
      project.genre,
    );

    // Build config (still needed for legacy generatePrototypeHtml path and
    // for the response.config field).
    // Фаза 0: теперь передаём genre и mechanicNames из Concept, чтобы цель
    // прототипа была контекстной, а шаги показывали actual mechanic names.
    const cl = project.coreLoop;
    const conceptMechanicSet = project.concept?.mechanicSet;
    let mechanicNames: string[] | undefined;
    if (conceptMechanicSet) {
      try {
        const parsed = JSON.parse(conceptMechanicSet) as {
          base?: Array<{ name?: string }>;
          combat?: Array<{ name?: string }>;
          progression?: Array<{ name?: string }>;
          spatial?: Array<{ name?: string }>;
          social?: Array<{ name?: string }>;
        };
        const allCategories = [
          ...(parsed.base ?? []),
          ...(parsed.combat ?? []),
          ...(parsed.progression ?? []),
          ...(parsed.spatial ?? []),
          ...(parsed.social ?? []),
        ];
        const names = allCategories
          .map((m) => m?.name)
          .filter((n): n is string => typeof n === "string" && n.length > 0);
        if (names.length > 0) {
          mechanicNames = names;
        }
      } catch {
        // ignore malformed mechanicSet
      }
    }

    const config = buildPrototypeConfig(
      {
        structuralType: resolvedType,
        steps: cl?.steps
          ? (JSON.parse(cl.steps) as string[] | { name?: string; description?: string; action?: string }[])
          : cl?.stepsData
            ? (JSON.parse(cl.stepsData) as string[] | { name?: string; description?: string; action?: string }[])
            : undefined,
        inputData: cl?.inputData || undefined,
      },
      mode,
      {
        genre: project.genre,
        mechanicNames,
      },
    );

    const prototypeArtifact = createPrototypeArtifact(project.id, project.pipelineState, {
      mode: config.mode,
      type: resolvedType,
      steps: config.steps,
      resource: dataParams.resourceName ?? config.resourceName,
      goal: config.goalText,
      typeOverride,
    });

    // === NEW: PrototypeIR compiler path (Phase 2) ===
    // When use_compiler=true, use the new compilePrototype() which generates
    // direct playable HTML from the IR. Falls back to legacy on error.
    const useCompiler = body?.use_compiler === true || body?.use_compiler === "true";
    if (useCompiler) {
      try {
        const { compilePrototype } = await import("@/lib/prototype-compiler");
        const compilerInput = {
          projectId: project.id,
          coreLoopArtifactRef: "cl@1.0.0",
          conceptArtifactRef: "concept@1.0.0",
          genre: project.genre || "unknown",
          structuralType: resolvedType,
          steps: (config.steps || []).map((action, i) => ({
            id: `step-${i + 1}`,
            action,
            mechanicIds: inferMechanicIds(resolvedType, config.mechanicNames),
            resourcesConsumed: [],
            resourcesProduced: [],
            feedbackType: "neutral" as const,
            durationEstimateSec: 5,
          })),
          resourceGraph: { edges: [] },
          funHypothesis: null,
          buildOptions: {
            dimensions: [mode] as Array<"2d" | "3d">,
            targetSessionSec: 30,
            difficulty: "baseline" as const,
          },
        };
        const result = compilePrototype(compilerInput, { skipSimulationGates: true });
        if (result.builds["2d"]?.html) {
          return NextResponse.json({
            playable: true,
            html: result.builds["2d"].html,
            config: {
              type: resolvedType,
              mode: config.mode,
              steps: config.steps,
              resource: dataParams.resourceName ?? config.resourceName,
              goal: config.goalText,
              data_params: dataParams,
              data_params_source: Object.keys(dataParams).length > 0
                ? "balance+progression+economy"
                : "defaults",
            },
            is_template_prototype: false,
            resolved_type: resolvedType,
            compiler_status: result.status,
            compiler_artifact: result.artifact,
            genre: config.genre || project.genre || null,
            mechanic_names: config.mechanicNames || null,
            ai_insights: null,
            custom_mechanic: null,
            ai_generated: false,
            prototype_artifact: prototypeArtifact,
            project_id: project.id,
            project_name: project.name,
          });
        }
      } catch (e) {
        console.error("[prototypes/generate] compiler error, falling back to legacy:", e);
      }
    }

    // R-PROTO-TYPES: for the 4 NEW types (platformer, stealth, deck_builder,
    // survival_horror), use the graph-builder path directly. For the 6
    // original types, generatePrototypeHtml tries graph first, falls back
    // to legacy inline templates if graph compilation fails.
    const NEW_TYPES = ["platformer", "stealth", "deck_builder", "survival_horror"];
    let html: string;
    if (NEW_TYPES.includes(resolvedType)) {
      const result = generatePrototypeFromGraph(
        resolvedType,
        mode,
        config.steps,
        dataParams,
        prototypeArtifact.prototypeId,
      );
      if (!result.valid) {
        return NextResponse.json({
          detail: "Прототип не скомпилировался",
          errors: result.errors,
        }, { status: 500 });
      }
      html = result.html;
    } else {
      // For the 6 original types, generatePrototypeHtml uses graph path
      // with legacy fallback.
      // Merge data-driven params into config for the legacy path.
      const configWithData = {
        ...config,
        type: resolvedType as typeof config.type,
      };
      html = generatePrototypeHtml(configWithData, prototypeArtifact.prototypeId);
    }

    // Optional AI insights for the prototype
    let aiInsights: string | null = null;
    let customMechanic: { mechanicName: string; description: string; codeSnippet: string } | null = null;
    if (useAi) {
      aiInsights = await generatePrototypeInsights({
        projectName: project.name,
        genre: project.genre || "—",
        coreLoopType: resolvedType,
        steps: config.steps,
        mode: config.mode,
        idea: project.description || undefined,
      });
      customMechanic = await generateCustomMechanic({
        projectName: project.name,
        genre: project.genre || "—",
        coreLoopType: resolvedType,
        mode: config.mode,
        idea: project.description || undefined,
      });
    }

    return NextResponse.json({
      playable: true,
      html,
      config: {
        type: resolvedType,
        mode: config.mode,
        steps: config.steps,
        resource: dataParams.resourceName ?? config.resourceName,
        goal: config.goalText,
        // R-PROTO-DATA: expose the data-driven params so the client can
        // show them in the UI ("Player speed: 220 (from Balance)").
        data_params: dataParams,
        data_params_source: Object.keys(dataParams).length > 0
          ? "balance+progression+economy"
          : "defaults",
      },
      // Фаза 0: честный флаг template prototype. UI должен показывать
      // предупреждение, что этот прототип построен из шаблона, а не из
      // реальных механик Core Loop.
      is_template_prototype: config.isTemplatePrototype,
      resolved_type: resolvedType,
      genre: config.genre || project.genre || null,
      mechanic_names: config.mechanicNames || null,
      ai_insights: aiInsights,
      custom_mechanic: customMechanic,
      ai_generated: useAi && aiInsights !== null,
      prototype_artifact: prototypeArtifact,
      project_id: project.id,
      project_name: project.name,
    });
  } catch (error) {
    if (error instanceof PrototypeLineageError) {
      return NextResponse.json({ detail: error.message, code: error.code }, { status: 409 });
    }
    console.error("[prototypes/generate] error:", error);
    return SERVER_ERROR();
  }
}
