/**
 * POST /api/v1/gdd/auto-fill
 * Автозаполнение секций GDD из данных проекта.
 * Body: { project_id, sections? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR, safeJsonParse } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    if (!projectId) return VALIDATION_ERROR("project_id обязателен");

    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { concept: true, coreLoop: true, mdaProfile: true, balanceResult: true, progression: true, economy: true },
    });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    const filled: Record<string, string> = {};

    if (project.concept) {
      const onePager = safeJsonParse<any>(project.concept.onePagerData || "{}", {});
      filled.title = project.name || onePager.title || "Untitled";
      filled.genre = project.concept.genre || project.genre || "—";
      filled.synopsis = onePager.story_synopsis || project.description || "Описание отсутствует";
      filled.gameplay = onePager.gameplay_description || "";
      filled.features = Array.isArray(onePager.unique_features) ? onePager.unique_features.join("; ") : "";
    }

    if (project.coreLoop) {
      const steps = safeJsonParse<any[]>(project.coreLoop.stepsData || "[]", []);
      filled.core_mechanics = steps.map((s: any) => s?.action || s?.name || "—").join(" → ");
      filled.gameplay_overview = `Core loop: ${filled.core_mechanics || "—"}`;
    }

    if (project.progression) {
      filled.progression = `Total levels: ${project.progression.totalLevels || "—"}, Tiers: ${project.progression.tierCount || "—"}`;
    }

    if (project.economy) {
      filled.economy = `System type: ${project.economy.systemType || "—"}, Resources: ${project.economy.resourceCount || "—"}`;
    }

    if (project.balanceResult) {
      filled.balance = `Score: ${project.balanceResult.overallBalanceScore || "—"}, Imbalances: ${project.balanceResult.imbalanceCount || 0}`;
    }

    const filledCount = Object.keys(filled).length;

    return NextResponse.json({
      filled_sections: filled,
      filled_count: filledCount,
      source: "project_data",
    });
  } catch (error) {
    console.error("[gdd/auto-fill] error:", error);
    return SERVER_ERROR();
  }
}
