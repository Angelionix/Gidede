/**
 * GET /api/v1/balance/{projectId}
 * Возвращает сохранённый результат балансировки.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, safeJsonParse } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { projectId } = await params;

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    include: { balanceResult: true },
  });
  if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });
  if (!project.balanceResult) return NextResponse.json({ detail: "Баланс не сгенерирован" }, { status: 404 });

  const b = project.balanceResult;
  return NextResponse.json({
    id: b.id,
    project_id: b.projectId,
    balance_type: b.balanceType,
    overall_balance_score: b.overallBalanceScore,
    imbalance_count: b.imbalanceCount,
    element_count: b.elementCount,
    elements: safeJsonParse(b.elements || "[]", []),
    cost_power_curves: safeJsonParse(b.costPowerCurves || "[]", []),
    intransitive_matrix: safeJsonParse(b.intransitiveMatrix || "{}", {}),
    nash_equilibrium: safeJsonParse(b.nashEquilibrium || "{}", {}),
    monte_carlo_results: safeJsonParse(b.monteCarloResults || "[]", []),
    machinations_results: safeJsonParse(b.machinationsResults || "{}", {}),
    pathologies: safeJsonParse(b.pathologies || "[]", []),
    corrections: safeJsonParse(b.corrections || "[]", []),
    input_data: safeJsonParse(b.inputData || "{}", {}),
    full_result: safeJsonParse(b.fullResult || "{}", {}),
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  });
}
