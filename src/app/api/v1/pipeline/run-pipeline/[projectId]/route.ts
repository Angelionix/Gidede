/**
 * POST /api/v1/pipeline/run-pipeline/[projectId]
 *
 * Runs a partial pipeline (subset of blocks). Mock implementation: marks
 * each requested block as "completed" in the response without actually
 * persisting data.
 *
 * Body: { block_ids: number[] }
 *
 * Response: { ok: true, project_id, stages: StageResult[], latency_ms }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { loadProjectPipelineSnapshot, BLOCK_NAMES } from "@/lib/pipeline-helpers";

const BLOCK_ID_TO_STAGES: Record<number, string[]> = {
  1: ["concept"],
  2: ["core_loop"],
  3: ["mda"],
  4: ["balance"],
  5: ["progression", "economy"],
  6: ["gdd", "validation"],
  7: ["assistant"],
  8: ["gbe"],
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    const body = await request.json().catch(() => ({}));
    const blockIdsRaw = Array.isArray(body?.block_ids) ? body.block_ids : null;

    if (!blockIdsRaw || blockIdsRaw.length === 0) {
      return VALIDATION_ERROR(
        "Поле block_ids обязательно и должно содержать хотя бы один ID блока"
      );
    }

    const blockIds = blockIdsRaw
      .map((n: unknown) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 8);

    if (blockIds.length === 0) {
      return VALIDATION_ERROR(
        "Все block_ids должны быть целыми числами в диапазоне 1..8"
      );
    }

    const snap = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snap) return NOT_FOUND();

    const stages: Array<{
      stage: string;
      block_id: number;
      block_name: string;
      status: "completed" | "skipped";
      message: string;
    }> = [];

    for (const blockId of blockIds) {
      const stageNames = BLOCK_ID_TO_STAGES[blockId] || [`block_${blockId}`];
      for (const stage of stageNames) {
        stages.push({
          stage,
          block_id: blockId,
          block_name: BLOCK_NAMES[blockId] || `Block ${blockId}`,
          status: "completed",
          message: `Стадия «${stage}» (Блок ${blockId}) обработана (mock).`,
        });
      }
    }

    const latencyMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      stages,
      stages_completed: stages.length,
      stages_total: stages.length,
      latency_ms: latencyMs,
      note: "Mock-выполнение: реальные данные блоков не сохранены. Используйте отдельные POST-эндпоинты блоков для фактической генерации.",
    });
  } catch (error) {
    console.error("[pipeline/run-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
