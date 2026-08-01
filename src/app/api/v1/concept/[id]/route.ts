/**
 * GET /api/v1/concept/{id}
 * Возвращает сохранённую концепцию проекта.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, safeJsonParse } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    include: { concept: true },
  });
  if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
  if (!project.concept) return NextResponse.json({ detail: "Концепция не сгенерирована" }, { status: 404 });

  const c = project.concept;
  // TASK-1.17: извлекаем primary_genre и subgenres из inputData.
  const inputData = safeJsonParse<{
    primary_genre?: string;
    subgenres?: string[];
    idea?: string;
  }>(c.inputData || "{}", {});

  return NextResponse.json({
    id: c.id,
    project_id: c.projectId,
    genre: c.genre,
    // TASK-1.17: primary + subgenres из inputData.
    primary_genre: inputData.primary_genre || c.genre,
    subgenres: inputData.subgenres || (c.subgenre ? safeJsonParse<string[]>(c.subgenre, []) : []),
    subgenre: c.subgenre, // legacy field
    primary_aesthetic: c.primaryAesthetic,
    usp: c.usp,
    // TASK-1.11: возвращаем title, ai_insights, generation_metadata из БД.
    title: c.title,
    ai_insights: c.aiInsights,
    generation_metadata: safeJsonParse(c.generationMetadata || "{}"),
    one_pager: safeJsonParse(c.onePagerData || "{}"),
    aesthetic_profile: safeJsonParse(c.aestheticProfile || "{}"),
    dynamics_profile: safeJsonParse(c.dynamicsProfile || "{}"),
    mechanic_set: safeJsonParse(c.mechanicSet || "{}"),
    validation_report: safeJsonParse(c.validationReport || "{}"),
    usp_candidates: safeJsonParse(c.uspCandidates || "[]"),
    core_loop_candidates: safeJsonParse(c.coreLoopCandidates || "[]"),
    input_data: inputData,
    created_at: c.createdAt.toISOString(),
    updated_at: c.updatedAt.toISOString(),
  });
}
