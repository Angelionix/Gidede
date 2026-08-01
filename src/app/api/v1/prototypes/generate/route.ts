/**
 * POST /api/v1/prototypes/generate
 *
 * Генерирует HTML-прототип кор-лупа из данных проекта.
 * Body: { project_id: string }
 * Response: { html: string, config: {...}, playable: true }
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
} from "@/lib/prototype-generator";
import { generatePrototypeInsights, generateCustomMechanic } from "@/lib/ai-service";
import { createPrototypeArtifact, PrototypeLineageError } from "@/lib/prototype-lineage";

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
      coreLoop?: {
        structuralType: string | null;
        steps: string | null;
        stepsData: string | null;
        inputData: string | null;
      } | null;
    };

    const cl = project.coreLoop;
    const config = buildPrototypeConfig(
      {
        structuralType: typeOverride || cl?.structuralType || "engine",
        steps: cl?.steps
          ? (JSON.parse(cl.steps) as string[] | { name?: string; description?: string; action?: string }[])
          : cl?.stepsData
            ? (JSON.parse(cl.stepsData) as string[] | { name?: string; description?: string; action?: string }[])
            : undefined,
        inputData: cl?.inputData || undefined,
      },
      mode
    );

    const prototypeArtifact = createPrototypeArtifact(project.id, project.pipelineState, {
      mode: config.mode,
      type: config.type,
      steps: config.steps,
      resource: config.resourceName,
      goal: config.goalText,
      typeOverride,
    });
    const html = generatePrototypeHtml(config, prototypeArtifact.prototypeId);

    // Optional AI insights for the prototype
    let aiInsights: string | null = null;
    let customMechanic: { mechanicName: string; description: string; codeSnippet: string } | null = null;
    if (useAi) {
      aiInsights = await generatePrototypeInsights({
        projectName: project.name,
        genre: project.genre || "—",
        coreLoopType: config.type,
        steps: config.steps,
        mode: config.mode,
        idea: project.description || undefined,
      });
      customMechanic = await generateCustomMechanic({
        projectName: project.name,
        genre: project.genre || "—",
        coreLoopType: config.type,
        mode: config.mode,
        idea: project.description || undefined,
      });
    }

    return NextResponse.json({
      playable: true,
      html,
      config: {
        type: config.type,
        mode: config.mode,
        steps: config.steps,
        resource: config.resourceName,
        goal: config.goalText,
      },
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
