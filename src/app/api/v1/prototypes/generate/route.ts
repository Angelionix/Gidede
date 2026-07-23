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

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || null;
    const mode = (body?.mode?.toString().trim() === "3d" ? "3d" : "2d") as "2d" | "3d";

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
        structuralType: cl?.structuralType || "engine",
        steps: cl?.steps ? (cl.steps as unknown) : (cl?.stepsData as unknown),
        inputData: cl?.inputData || undefined,
      },
      mode
    );

    const html = generatePrototypeHtml(config);

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
      project_id: project.id,
      project_name: project.name,
    });
  } catch (error) {
    console.error("[prototypes/generate] error:", error);
    return SERVER_ERROR();
  }
}
