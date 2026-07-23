/**
 * GET /api/v1/economy/{projectId}
 * Возвращает сохранённую экономику.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, safeJsonParse } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: { economy: true },
  });
  if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
  if (!project.economy) return NextResponse.json({ detail: "Экономика не сгенерирована" }, { status: 404 });

  const e = project.economy;
  return NextResponse.json({
    id: e.id,
    project_id: e.projectId,
    system_type: e.systemType,
    resource_count: e.resourceCount,
    has_pathology: e.hasPathology,
    resource_model: safeJsonParse(e.resourceModel || "{}", {}),
    machinations_model: safeJsonParse(e.machinationsModel || "{}", {}),
    conversion_chains: safeJsonParse(e.conversionChains || "[]", []),
    pathologies: safeJsonParse(e.pathologies || "[]", []),
    corrections: safeJsonParse(e.corrections || "[]", []),
    simulation_results: safeJsonParse(e.simulationResults || "{}", {}),
    monetization_model: safeJsonParse(e.monetizationModel || "{}", {}),
    full_profile: safeJsonParse(e.fullProfile || "{}", {}),
    input_data: safeJsonParse(e.inputData || "{}", {}),
    created_at: e.createdAt.toISOString(),
    updated_at: e.updatedAt.toISOString(),
  });
}
