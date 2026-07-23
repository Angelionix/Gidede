/**
 * GET /api/v1/pipeline/state/[projectId]
 *
 * Returns the project's full pipeline state: 8 blocks (Concept, Core Loop,
 * MDA, Balance, Progression+Economy, GDD+Validation, AI Assistant, GBE),
 * completion_percent, current_stage, can_proceed_to, next_block, notifications.
 *
 * Response shape matches use-pipeline.ts PipelineState:
 *   {
 *     project_id, project_name, blocks: BlockProgress[],
 *     completion_percent, current_stage,
 *     can_proceed_to, next_block, notifications: PipelineNotification[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR, NOT_FOUND } from "@/lib/api-helpers";
import {
  loadProjectPipelineSnapshot,
  buildBlocks,
  nextBlockToFill,
  canProceedTo,
  derivePipelineNotifications,
} from "@/lib/pipeline-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    const snap = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snap) return NOT_FOUND();

    const blocks = buildBlocks(snap);
    const next = nextBlockToFill(snap);
    const canProceed = canProceedTo(snap);
    const notifications = derivePipelineNotifications(snap);

    return NextResponse.json({
      project_id: snap.projectId,
      project_name: snap.projectName,
      blocks,
      completion_percent: snap.completionPercent,
      current_stage: snap.currentStage || "—",
      can_proceed_to: canProceed,
      next_block: next,
      notifications,
    });
  } catch (error) {
    console.error("[pipeline/state] error:", error);
    return SERVER_ERROR();
  }
}
