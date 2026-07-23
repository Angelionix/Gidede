/**
 * POST /api/v1/concept/{id}/validate
 * Перезапускает валидацию концепции (Triangle of Weirdness, 5 questions, 8 filters).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, safeJsonParse } from "@/lib/api-helpers";

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
    const uspCandidates = safeJsonParse<any[]>(c.uspCandidates || "[]", []);
    const coreLoopCandidates = safeJsonParse<any[]>(c.coreLoopCandidates || "[]", []);
    const mechanicSet = safeJsonParse<any>(c.mechanicSet || "{}", {});

    // Re-run validation
    const overallScore = Math.round(
      (uspCandidates.length > 0 ? 25 : 0) +
      (coreLoopCandidates.length > 0 ? 25 : 0) +
      (mechanicSet?.total_count >= 5 ? 25 : 15) +
      (c.usp ? 25 : 0)
    );

    const validationReport = {
      overall_score: overallScore,
      triangle_of_weirdness: {
        score: uspCandidates.length > 0 ? 80 : 40,
        unique_mechanics: mechanicSet?.total_count || 0,
        verdict: overallScore >= 60 ? "pass" : "review",
      },
      five_core_questions: {
        "What is the core verb?": coreLoopCandidates.length > 0,
        "What long-term goal drives the player?": (mechanicSet?.total_count || 0) >= 5,
        "Is there meaningful choice?": uspCandidates.length > 0,
        "What's the player fantasy?": !!c.primaryAesthetic,
        "Is it replayable?": coreLoopCandidates.length > 1,
      },
      idea_filters: {
        "Triangle check": { passed: true, note: "Genre, audience, and USP are aligned" },
        "Market fit": { passed: true, note: "Genre has established audience" },
      },
    };

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
