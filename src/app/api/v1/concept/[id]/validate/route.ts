/**
 * POST /api/v1/concept/{id}/validate
 *
 * Перезапускает валидацию концепции (Triangle of Weirdness, 5 questions, 8 filters).
 *
 * TASK-1.5 FIXED: оригинальная реализация была STUB-ом — считала 25+25+25+25=100
 * за существование полей, возвращала ДРУГУЮ schema чем /concept/generate:
 *   - `overall_score` 0-100 (vs 0-1 в generate)
 *   - `triangle_of_weirdness.score` 0-100 (vs `triangle_check.score` 0-1)
 *   - `idea_filters` с 2 элементами (vs `eight_filters` с 8)
 *
 * Новая реализация переиспользует логику из /concept/generate/route.ts
 * (функция buildValidationReport) и возвращает СОВМЕСТИМУЮ schema.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, safeJsonParse } from "@/lib/api-helpers";

// Локальная копия buildValidationReport из /concept/generate/route.ts.
// В будущем (TASK-1.13) нужно вынести в общий модуль src/lib/concept/validation.ts
// и импортировать в обоих маршрутах.
function buildValidationReport(
  aestheticProfile: { primary: string; secondary: string; tertiary: string },
  mechanicSet: { total_count: number; compatibility_score: number },
  uspCandidates: Array<{ triangle_of_weirdness_check: string }>
) {
  const weird = uspCandidates.some((c) => c.triangle_of_weirdness_check === "pass");
  const appealing = aestheticProfile.primary !== "submission";
  const credible = mechanicSet.compatibility_score >= 60;
  const triangleScore = Number(
    ((weird ? 0.4 : 0.2) + (appealing ? 0.3 : 0.1) + (credible ? 0.3 : 0.1)).toFixed(2)
  );
  const trianglePassed = triangleScore >= 0.6;

  const fiveQuestions: Record<string, boolean> = {
    "What is the core verb?": true,
    "What does the player do moment-to-moment?": true,
    "What long-term goal drives the player?": mechanicSet.total_count >= 5,
    "Where does the fun come from?": appealing,
    "Why would a player return tomorrow?": credible,
  };

  const eightFilters: Record<string, { score: number; reason: string; improvement: string }> = {
    clarity: {
      score: 0.8,
      reason: "Core idea is expressible in one sentence",
      improvement: "Sharpen the verb-noun form of the pitch",
    },
    novelty: {
      score: weird ? 0.85 : 0.55,
      reason: weird ? "Multiple novel angles detected" : "Familiar genre conventions dominate",
      improvement: "Add one truly weird angle (per Triangle of Weirdness)",
    },
    feasibility: {
      score: credible ? 0.8 : 0.5,
      reason: credible ? "Mechanic set is implementable with given scope" : "Mechanic count too low or incompatible",
      improvement: "Reduce scope or add a clear MVP slice",
    },
    audience_fit: {
      score: appealing ? 0.85 : 0.5,
      reason: appealing ? "Aesthetic aligns with target motivations" : "Primary aesthetic may not pull target audience",
      improvement: "Re-pick primary aesthetic to match audience",
    },
    market_fit: {
      score: 0.6,
      reason: "Genre has competition but viable niche",
      improvement: "Identify 2-3 direct competitors and define differentiation",
    },
    differentiation: {
      score: weird ? 0.8 : 0.5,
      reason: weird ? "USP candidates propose clear differentiation" : "USP candidates need a stronger weird angle",
      improvement: "Push the USP triangle further toward 'weird'",
    },
    emotional_impact: {
      score: 0.7,
      reason: "Aesthetic profile promises an emotional journey",
      improvement: "Map aesthetic to specific emotion beats in the campaign",
    },
    sustainability: {
      score: 0.65,
      reason: "Core loop has replay potential via progression mechanics",
      improvement: "Add meta-loop or live-ops hook",
    },
  };

  const overallScore = Number(
    (
      triangleScore * 0.3 +
      (Object.values(fiveQuestions).filter(Boolean).length / 5) * 0.3 +
      (Object.values(eightFilters).reduce((s, f) => s + f.score, 0) /
        Object.keys(eightFilters).length) *
        0.4
    ).toFixed(3)
  );

  const warnings: string[] = [];
  if (!credible) warnings.push("Mechanic compatibility below 60% — review synergies");
  if (!appealing) warnings.push("Primary aesthetic is 'submission' — may not pull casual audience");
  if (!weird) warnings.push("No USP passed the Triangle of Weirdness — push for a stranger angle");

  const suggestions: string[] = [
    "Run a 5-minute paper prototype to validate the core verb",
    "Define 3 direct competitors and articulate one concrete differentiator",
    "Map aesthetic profile to specific moments in the player journey",
  ];

  return {
    triangle_check: {
      passed: trianglePassed,
      score: triangleScore,
      details: `Weird=${weird}, Appealing=${appealing}, Credible=${credible}`,
      weird,
      appealing,
      credible,
    },
    five_questions: fiveQuestions,
    eight_filters: eightFilters,
    overall_score: overallScore,
    warnings,
    suggestions,
  };
}

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
    }>(c.mechanicSet || "{}", { total_count: 0, compatibility_score: 0 });

    const uspCandidates = safeJsonParse<
      Array<{ triangle_of_weirdness_check: string }>
    >(c.uspCandidates || "[]", []);

    // Re-run validation using the SAME logic as /concept/generate.
    const validationReport = buildValidationReport(
      aestheticProfile,
      mechanicSet,
      uspCandidates
    );

    // Persist the recomputed validation report.
    await db.projectConcept.update({
      where: { projectId: id },
      data: { validationReport: JSON.stringify(validationReport) },
    });

    // Возвращаем СОВМЕСТИМУЮ schema (как /concept/generate.validation_report).
    return NextResponse.json(validationReport);
  } catch (error) {
    console.error("[concept/validate] error:", error);
    return SERVER_ERROR();
  }
}
