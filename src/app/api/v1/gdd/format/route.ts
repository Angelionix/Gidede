/**
 * POST /api/v1/gdd/format
 * Выбор формата GDD. Возвращает список секций для запрошенного формата.
 * Body: { project_id, target_format? | format? }
 *
 * R-AUDIT-FIX: was returning a parallel (drifting) section list — 38 sections
 * for full_gdd, 36 from generateSectionList(), 45 in actual /gdd/generate.
 * Now reads the canonical `FORMAT_SECTIONS` from /gdd/generate so this route
 * always agrees with the generator.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { normalizeGddFormat } from "@/lib/contracts/stage-contracts";
import { FORMAT_SECTIONS } from "@/app/api/v1/gdd/generate/route";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    const normalizedFormat = normalizeGddFormat(body?.target_format ?? body?.format);
    const format = typeof normalizedFormat === "string" ? normalizedFormat : undefined;

    if (!projectId) return VALIDATION_ERROR("project_id обязателен");
    if (!format || !Object.prototype.hasOwnProperty.call(FORMAT_SECTIONS, format)) {
      return VALIDATION_ERROR(
        `format должен быть одним из: ${Object.keys(FORMAT_SECTIONS).join(", ")}`
      );
    }

    const project = await db.project.findFirst({ where: { id: projectId, userId: user.id }, select: { id: true } });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    const sections = FORMAT_SECTIONS[format];
    return NextResponse.json({
      format,
      section_count: sections.length,
      sections,
      message: `Формат GDD: ${format}, ${sections.length} секций`,
    });
  } catch (error) {
    console.error("[gdd/format] error:", error);
    return SERVER_ERROR();
  }
}
