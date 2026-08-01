/**
 * POST /api/v1/gdd/checklist
 *
 * TASK-6b.1 + 6b.15: Unified with /checklists/validate.
 * This endpoint now delegates to the same runChecklistValidation() as /checklists/validate.
 * Both endpoints return identical response shape.
 *
 * Body: { project_id }
 *
 * NOTE: /checklists/validate is the canonical endpoint (used by pipeline runner).
 * This endpoint is kept for backward compatibility with frontend that calls /gdd/checklist.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { runChecklistValidation } from "@/lib/checklist-logic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    if (!projectId) return VALIDATION_ERROR("project_id обязателен");

    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
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
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    // TASK-6b.1: Same call as /checklists/validate — unified response shape.
    const result = await runChecklistValidation(project, "validate", {
      depth: "standard",
    });

    // TASK-6b.15: Return same shape as /checklists/validate (result.profile).
    return NextResponse.json(result.profile);
  } catch (error) {
    console.error("[gdd/checklist] error:", error);
    return SERVER_ERROR();
  }
}
