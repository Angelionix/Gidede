/**
 * POST /api/v1/gdd/format
 * Выбор формата GDD (one_sheet | ten_pager | full).
 * Body: { project_id, format }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";

const VALID_FORMATS = ["one_sheet", "ten_pager", "full"];

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    const format = body?.format?.toString().trim();

    if (!projectId) return VALIDATION_ERROR("project_id обязателен");
    if (!format || !VALID_FORMATS.includes(format)) {
      return VALIDATION_ERROR(`format должен быть: ${VALID_FORMATS.join(", ")}`);
    }

    const project = await db.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    const sectionCount = format === "one_sheet" ? 6 : format === "ten_pager" ? 12 : 38;
    return NextResponse.json({
      format,
      section_count: sectionCount,
      sections: generateSectionList(format),
      message: `Формат GDD: ${format}, ${sectionCount} секций`,
    });
  } catch (error) {
    console.error("[gdd/format] error:", error);
    return SERVER_ERROR();
  }
}

function generateSectionList(format: string): string[] {
  if (format === "one_sheet") {
    return ["title", "genre", "synopsis", "gameplay", "features", "rating"];
  }
  if (format === "ten_pager") {
    return ["title", "genre", "synopsis", "gameplay", "features", "mechanics", "art_style", "sound", "monetization", "target_audience", "competitors", "rating"];
  }
  return [
    "title", "genre", "synopsis", "gameplay_overview", "core_mechanics",
    "progression", "economy", "balance", "art_style", "sound_design",
    "narrative", "characters", "world_structure", "level_design",
    "ui_ux", "controls", "multiplayer", "monetization", "target_audience",
    "competitors", "platforms", "tech_stack", "accessibility",
    "localization", "testing_plan", "milestones", "risks",
    "rating", "appendix_a", "appendix_b", "appendix_c",
    "glossary", "references", "change_log", "version_history",
    "team", "budget", "timeline",
  ];
}
