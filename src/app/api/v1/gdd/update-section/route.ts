/**
 * POST /api/v1/gdd/update-section
 *
 * Persists a manual edit of a single GDD section to the database.
 * Previously the GDDSectionEditor only updated local React state — edits
 * were lost on page refresh. This endpoint updates the `sections` JSON
 * column of ProjectGDD for the given project_id.
 *
 * Body:
 *   {
 *     project_id: string,            // required
 *     section_key: string,           // required — key in sections{} object
 *     content: string,               // required — new markdown content
 *     requires_review?: boolean      // optional — default false (user-edited)
 *   }
 *
 * Response: { ok: true, section_key, updated_at }
 *
 * Security: verifies project ownership; section_key is validated against
 * the existing sections object to prevent arbitrary key injection.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
  safeJsonParse,
} from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    const sectionKey = body?.section_key?.toString().trim();
    const content = body?.content;
    const requiresReview =
      body?.requires_review !== undefined
        ? Boolean(body.requires_review)
        : false;

    if (!projectId) {
      return VALIDATION_ERROR("Поле project_id обязательно");
    }
    if (!sectionKey) {
      return VALIDATION_ERROR("Поле section_key обязательно");
    }
    if (typeof content !== "string") {
      return VALIDATION_ERROR("Поле content должно быть строкой");
    }
    // Reasonable length cap to prevent DB bloat / abuse.
    if (content.length > 100_000) {
      return VALIDATION_ERROR(
        "Содержимое секции слишком длинное (максимум 100 000 символов)"
      );
    }

    // Verify ownership + load the existing GDD row.
    const gdd = await db.projectGDD.findFirst({
      where: { projectId, project: { userId: user.id, deletedAt: null } },
    });
    if (!gdd) {
      return NextResponse.json(
        { detail: "GDD не найден — сначала сгенерируйте GDD" },
        { status: 404 }
      );
    }

    const sections = safeJsonParse<Record<string, unknown>>(gdd.sections);
    if (!sections || typeof sections !== "object") {
      return NextResponse.json(
        { detail: "Структура секций GDD повреждена" },
        { status: 500 }
      );
    }

    // Reject unknown section keys to prevent arbitrary key injection.
    if (!(sectionKey in sections)) {
      return VALIDATION_ERROR(
        `Секция «${sectionKey}» не существует в GDD. Доступные: ${Object.keys(sections).join(", ")}`
      );
    }

    // Update the specific section while preserving sibling fields
    // (source, requires_review, section_name, etc.).
    const existingSection = sections[sectionKey] as Record<string, unknown>;
    const updatedSection: Record<string, unknown> = {
      ...existingSection,
      content,
      source: "manual",
      requires_review: requiresReview,
      updated_at: new Date().toISOString(),
    };
    sections[sectionKey] = updatedSection;

    await db.projectGDD.update({
      where: { id: gdd.id },
      data: {
        sections: JSON.stringify(sections),
      },
    });

    return NextResponse.json({
      ok: true,
      section_key: sectionKey,
      updated_at: updatedSection.updated_at,
    });
  } catch (error) {
    console.error("[gdd/update-section] error:", error);
    return SERVER_ERROR();
  }
}
