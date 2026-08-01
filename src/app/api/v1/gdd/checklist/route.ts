/**
 * POST /api/v1/gdd/checklist
 *
 * TASK-6.6 FIXED: Replaced STUB with real checklist-logic.ts.
 *
 * Before: hardcoded scores (80/0/40/70/75), no real validation.
 * After: delegates to runChecklistValidation() from lib/checklist-logic.ts,
 * which runs 5 real check functions (MDA, Balance, Narrative, Economy, Lens)
 * with actual issue detection and remediation plans.
 *
 * Body: { project_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { runChecklistValidation } from "@/lib/checklist-logic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    if (!projectId) return VALIDATION_ERROR("project_id обязателен");

    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id },
      include: {
        concept: true,
        coreLoop: true,
        mdaProfile: true,
        balanceResult: true,
        progression: true,
        economy: true,
        gdd: true,
        checklist: true,
      },
    });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    // TASK-6.6: Use real checklist-logic.ts instead of STUB.
    const result = await runChecklistValidation(project, "validate", {
      depth: "standard",
    });

    return NextResponse.json({
      overall_score: result.overallScore,
      readiness_level: result.readinessLevel,
      checks: {
        mda_check: result.mdaCheck,
        balance_check: result.balanceCheck,
        economy_check: result.economyCheck,
        narrative_check: result.narrativeCheck,
        lens_check: result.lensCheck,
      },
      issues: result.issues,
      remediation_plan: result.remediationPlan,
      critical_issue_count: result.criticalIssueCount,
      total_issue_count: result.totalIssueCount,
      profile: result.profile,
    });
  } catch (error) {
    console.error("[gdd/checklist] error:", error);
    return SERVER_ERROR();
  }
}
