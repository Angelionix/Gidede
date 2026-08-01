/**
 * GET /api/v1/coreloop/{projectId}
 * TASK-2.14: возвращает сохранённый core loop проекта.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, safeJsonParse } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { projectId } = await params;

  try {
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { coreLoop: true },
    });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
    if (!project.coreLoop) return NextResponse.json({ detail: "Core loop не сгенерирован" }, { status: 404 });

    const cl = project.coreLoop;
    return NextResponse.json({
      id: cl.id,
      project_id: cl.projectId,
      structural_type: cl.structuralType,
      structural_subtype: cl.structuralSubtype,
      step_count: cl.stepCount,
      hierarchy_depth: cl.hierarchyDepth,
      pathology_count: cl.pathologyCount,
      ai_insights: cl.aiInsights,
      latency_ms: cl.latencyMs,
      models_used: safeJsonParse<string[]>(cl.modelsUsed || "[]", []),
      gary_five_questions: safeJsonParse(cl.garyFiveQuestions || "{}", {}),
      input_data: safeJsonParse(cl.inputData || "{}"),
      steps: safeJsonParse(cl.stepsData || "[]"),
      inner_loops: safeJsonParse(cl.innerLoops || "[]"),
      outer_loops: safeJsonParse(cl.outerLoops || "[]"),
      meta_loop: safeJsonParse(cl.metaLoop || "{}"),
      loop_hierarchy: safeJsonParse(cl.loopHierarchy || "{}"),
      pathologies: safeJsonParse(cl.pathologies || "{}"),
      recommendations: safeJsonParse(cl.recommendations || "[]"),
      validation: safeJsonParse(cl.validationData || "{}"),
      full_profile: safeJsonParse(cl.fullProfile || "{}"),
      created_at: cl.createdAt.toISOString(),
      updated_at: cl.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[coreloop/get] error:", error);
    return SERVER_ERROR();
  }
}
