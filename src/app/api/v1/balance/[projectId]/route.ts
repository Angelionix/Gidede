/**
 * GET /api/v1/balance/{projectId}
 * Возвращает сохранённый результат балансировки.
 *
 * TASK-4.12: унифицированы fallback типы для safeJsonParse.
 * Добавлены situational_values и ai_insights (из fullResult).
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
  // TASK-4.12: parse fullResult to extract ai_insights and balance_pathologies.
  const fullResult = safeJsonParse<Record<string, unknown>>(b.fullResult || "{}", {});
  const aiInsights = typeof fullResult.ai_insights === "string" ? fullResult.ai_insights : null;
  const balancePathologies = Array.isArray(fullResult.balance_pathologies)
    ? fullResult.balance_pathologies
    : [];

  return NextResponse.json({
    id: b.id,
    project_id: b.projectId,
    balance_type: b.balanceType,
    overall_balance_score: b.overallBalanceScore,
    imbalance_count: b.imbalanceCount,
    element_count: b.elementCount,
    // TASK-4.12: unified fallback types.
    elements: safeJsonParse<unknown[]>(b.elements || "[]", []),
    cost_power_curves: safeJsonParse<unknown[]>(b.costPowerCurves || "[]", []),
    intransitive_matrix: safeJsonParse<Record<string, unknown>>(b.intransitiveMatrix || "{}", {}),
    nash_equilibrium: safeJsonParse<Record<string, unknown>>(b.nashEquilibrium || "{}", {}),
    monte_carlo_results: safeJsonParse<Record<string, unknown>>(b.monteCarloResults || "{}", {}),
    machinations_results: safeJsonParse<Record<string, unknown>>(b.machinationsResults || "{}", {}),
    pathologies: safeJsonParse<Record<string, unknown>>(b.pathologies || "{}", {}),
    corrections: safeJsonParse<Record<string, unknown>>(b.corrections || "{}", {}),
    situational_values: safeJsonParse<Record<string, unknown>>(b.situationalValues || "{}", {}),
    input_data: safeJsonParse<Record<string, unknown>>(b.inputData || "{}", {}),
    full_result: fullResult,
    // TASK-4.12: expose ai_insights and balance_pathologies from fullResult.
    ai_insights: aiInsights,
    balance_pathologies: balancePathologies,
    created_at: b.createdAt.toISOString(),
    updated_at: b.updatedAt.toISOString(),
  });
}
