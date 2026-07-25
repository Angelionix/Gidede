/**
 * POST /api/v1/gdd/map
 * Маппинг секций GDD на источники данных (концепция, core loop, MDA, баланс, прогрессия, экономика).
 * Body: { project_id, sections? }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";

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

    const mapping: Record<string, string | null> = {
      title: "concept",
      genre: "concept",
      synopsis: "concept",
      gameplay_overview: "core_loop",
      core_mechanics: "concept",
      progression: "progression",
      economy: "economy",
      balance: "balance",
      art_style: "concept",
      narrative: "concept",
      characters: "concept",
      world_structure: "mda",
      level_design: "concept",
    };

    const availableSources: string[] = [];
    if (project.concept) availableSources.push("concept");
    if (project.coreLoop) availableSources.push("core_loop");
    if (project.mdaProfile) availableSources.push("mda");
    if (project.balanceResult) availableSources.push("balance");
    if (project.progression) availableSources.push("progression");
    if (project.economy) availableSources.push("economy");

    return NextResponse.json({
      mapping,
      available_sources: availableSources,
      missing_sources: ["concept", "core_loop", "mda", "balance", "progression", "economy"].filter(s => !availableSources.includes(s)),
      coverage: Math.round((availableSources.length / 6) * 100),
    });
  } catch (error) {
    console.error("[gdd/map] error:", error);
    return SERVER_ERROR();
  }
}
