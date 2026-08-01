/**
 * DELETE /api/v1/pipeline/stale/[projectId]/[blockId]
 *
 * A stale artifact cannot be made fresh by acknowledgement. This endpoint
 * confirms an already refreshed block, or returns 409 while rerun is required.
 *
 * Response: { ok: true, project_id, block_id, cleared: true }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { parsePipelineFreshnessState } from "@/lib/pipeline-stale";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";

const BLOCK_STAGES: Record<number, readonly ContractStageId[]> = {
  1: ["concept"],
  2: ["core_loop"],
  3: ["mda"],
  4: ["balance"],
  5: ["progression", "economy"],
  6: ["gdd", "validation"],
  7: [],
  8: [],
};

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ projectId: string; blockId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId, blockId: blockIdStr } = await params;
    const blockId = Number(blockIdStr);
    if (!Number.isInteger(blockId) || blockId < 1 || blockId > 8) {
      return VALIDATION_ERROR(
        `Неверный block_id: ${blockIdStr}. Ожидается 1..8.`
      );
    }

    // Verify ownership
    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id, deletedAt: null },
      select: { id: true, pipelineState: true },
    });
    if (!project) return NOT_FOUND();

    const state = parsePipelineFreshnessState(project.pipelineState);
    const staleStages = BLOCK_STAGES[blockId].filter(
      (stage) => state.artifacts[stage]?.staleSince,
    );
    if (staleStages.length > 0) {
      return NextResponse.json({
        ok: false,
        project_id: projectId,
        block_id: blockId,
        cleared: false,
        stale_stages: staleStages,
        detail: "Stale status снимается только после пересчёта блока на актуальных upstream artifacts.",
      }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      block_id: blockId,
      cleared: true,
    });
  } catch (error) {
    console.error("[pipeline/stale] error:", error);
    return SERVER_ERROR();
  }
}
