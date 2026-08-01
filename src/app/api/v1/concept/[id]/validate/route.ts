/**
 * POST /api/v1/concept/{id}/validate
 *
 * Перезапускает валидацию концепции (Triangle of Weirdness, 5 questions, 8 filters).
 *
 * TASK-1.5 FIXED: оригинальная реализация была STUB-ом — считала 25+25+25+25=100
 * за существование полей, возвращала ДРУГУЮ schema чем /concept/generate.
 *
 * TASK-1.3 + TASK-1.4 + TASK-1.5: теперь использует общий модуль
 * `src/lib/concept/validation.ts` с реальной логикой 8 filters и 5 questions.
 * Возвращает СОВМЕСТИМУЮ schema с /concept/generate.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, safeJsonParse } from "@/lib/api-helpers";
import { buildValidationReport } from "@/lib/concept/validation";

export async function POST(
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

  try {
    const c = project.concept;

    // Загружаем сохранённые данные концепции.
    const aestheticProfile = safeJsonParse<{
      primary: string;
      secondary: string;
      tertiary: string;
    }>(c.aestheticProfile || "{}", { primary: "challenge", secondary: "discovery", tertiary: "submission" });

    const mechanicSet = safeJsonParse<{
      total_count: number;
      compatibility_score: number;
      cross_genre_mechanics?: Array<unknown>;
      genres_searched?: string[];
    }>(c.mechanicSet || "{}", { total_count: 0, compatibility_score: 0 });

    const uspCandidates = safeJsonParse<
      Array<{ triangle_of_weirdness_check: string; usp: string }>
    >(c.uspCandidates || "[]", []);

    // TASK-1.17: загружаем idea и subgenres из inputData для реального анализа.
    const inputData = safeJsonParse<{
      idea?: string;
      primary_genre?: string;
      subgenres?: string[];
    }>(c.inputData || "{}", {});
    const idea = inputData.idea || "";
    const subgenres = inputData.subgenres || [];

    // Re-run validation using the SAME logic as /concept/generate.
    const validationReport = buildValidationReport(
      aestheticProfile,
      mechanicSet,
      uspCandidates,
      idea,
      subgenres
    );

    // Persist the recomputed validation report.
    await db.projectConcept.update({
      where: { projectId: id },
      data: { validationReport: JSON.stringify(validationReport) },
    });

    return NextResponse.json(validationReport);
  } catch (error) {
    console.error("[concept/validate] error:", error);
    return SERVER_ERROR();
  }
}
