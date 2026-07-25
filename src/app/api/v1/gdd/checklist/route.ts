/**
 * POST /api/v1/gdd/checklist
 * Запуск чек-листа валидации GDD.
 * Body: { project_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR, safeJsonParse, updateProjectStage } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    if (!projectId) return VALIDATION_ERROR("project_id обязателен");

    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: { concept: true, coreLoop: true, mdaProfile: true, balanceResult: true, progression: true, economy: true, gdd: true, checklist: true },
    });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    // Run 5 checks
    const checks: any = {};

    // MDA check
    checks.mda_check = {
      passed: !!project.mdaProfile,
      score: project.mdaProfile ? 80 : 0,
      message: project.mdaProfile ? "MDA-профиль сгенерирован" : "MDA-профиль отсутствует",
    };

    // Balance check
    checks.balance_check = {
      passed: !!project.balanceResult && (project.balanceResult.overallBalanceScore || 0) >= 60,
      score: project.balanceResult?.overallBalanceScore || 0,
      message: project.balanceResult ? `Score: ${project.balanceResult.overallBalanceScore}%` : "Баланс не сгенерирован",
    };

    // Economy check
    checks.economy_check = {
      passed: !!project.economy && !project.economy.hasPathology,
      score: project.economy ? (project.economy.hasPathology ? 40 : 80) : 0,
      message: project.economy ? (project.economy.hasPathology ? "Обнаружены патологии" : "Без патологий") : "Экономика не сгенерирована",
    };

    // Narrative check
    checks.narrative_check = {
      passed: !!project.concept,
      score: project.concept ? 70 : 0,
      message: project.concept ? "Концепция сгенерирована" : "Концепция отсутствует",
    };

    // Lens check (Schell)
    checks.lens_check = {
      passed: !!project.mdaProfile,
      score: project.mdaProfile ? 75 : 0,
      message: "Линзы Шелла применены через MDA",
    };

    const scores = Object.values(checks).map((c: any) => c.score);
    const overallScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);

    const issues: any[] = [];
    for (const [key, check] of Object.entries(checks)) {
      if (!(check as any).passed) {
        issues.push({ check: key, severity: "warning", message: (check as any).message });
      }
    }

    const readiness = overallScore >= 75 ? "ready" : overallScore >= 50 ? "review" : "draft";

    const result = {
      overall_score: overallScore,
      readiness_level: readiness,
      checks,
      issues,
      critical_issue_count: issues.filter(i => i.severity === "critical").length,
      total_issue_count: issues.length,
    };

    // Persist checklist
    await db.projectChecklist.upsert({
      where: { projectId },
      create: {
        projectId,
        overallScore: overallScore,
        readinessLevel: readiness,
        criticalIssueCount: issues.filter(i => i.severity === "critical").length,
        totalIssueCount: issues.length,
        mdaCheck: JSON.stringify(checks.mda_check),
        balanceCheck: JSON.stringify(checks.balance_check),
        economyCheck: JSON.stringify(checks.economy_check),
        narrativeCheck: JSON.stringify(checks.narrative_check),
        lensCheck: JSON.stringify(checks.lens_check),
        issues: JSON.stringify(issues),
        fullResults: JSON.stringify(result),
      },
      update: {
        overallScore: overallScore,
        readinessLevel: readiness,
        criticalIssueCount: issues.filter(i => i.severity === "critical").length,
        totalIssueCount: issues.length,
        mdaCheck: JSON.stringify(checks.mda_check),
        balanceCheck: JSON.stringify(checks.balance_check),
        economyCheck: JSON.stringify(checks.economy_check),
        narrativeCheck: JSON.stringify(checks.narrative_check),
        lensCheck: JSON.stringify(checks.lens_check),
        issues: JSON.stringify(issues),
        fullResults: JSON.stringify(result),
      },
    });

    // Update project stage / completion percent to reflect the final
    // validation stage. Without this call the project's completionPercent
    // stays at 90 (gdd stage) instead of 100 (validation stage) and
    // projectStage/lastAlgorithmRun remain "gdd" instead of "validation".
    await updateProjectStage(projectId, "validation");

    return NextResponse.json(result);
  } catch (error) {
    console.error("[gdd/checklist] error:", error);
    return SERVER_ERROR();
  }
}
