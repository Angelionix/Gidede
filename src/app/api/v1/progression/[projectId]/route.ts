/**
 * GET /api/v1/progression/{projectId}
 * Возвращает сохранённую прогрессию.
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
    include: { progression: true },
  });
  if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
  if (!project.progression) return NextResponse.json({ detail: "Прогрессия не сгенерирована" }, { status: 404 });

  const p = project.progression;
  return NextResponse.json({
    id: p.id,
    project_id: p.projectId,
    total_levels: p.totalLevels,
    tier_count: p.tierCount,
    curve_type: p.curveType,
    target_duration_hours: p.targetDurationHours,
    macro_model: safeJsonParse(p.macroModel || "{}", {}),
    tier_model: safeJsonParse(p.tierModel || "{}", {}),
    curves: safeJsonParse(p.curves || "{}", {}),
    content_plan: safeJsonParse(p.contentPlan || "{}", {}),
    economy_link: safeJsonParse(p.economyLink || "{}", {}),
    validation: safeJsonParse(p.validation || "{}", {}),
    full_profile: safeJsonParse(p.fullProfile || "{}", {}),
    input_data: safeJsonParse(p.inputData || "{}", {}),
    created_at: p.createdAt.toISOString(),
    updated_at: p.updatedAt.toISOString(),
  });
}
