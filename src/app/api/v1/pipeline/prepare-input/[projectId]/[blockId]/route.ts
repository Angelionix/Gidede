/**
 * POST /api/v1/pipeline/prepare-input/[projectId]/[blockId]
 *
 * Assembles the prepared input data for the given block from the project's
 * existing state (concept, coreLoop, mda, balance, progression, economy,
 * gdd, checklist). The frontend uses this to pre-fill forms when opening
 * a block page.
 *
 * Response: the prepared input object (shape varies per block).
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { buildPreparedInput, BLOCK_NAMES } from "@/lib/pipeline-helpers";

export async function POST(
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
        `Неверный block_id: ${blockIdStr}. Ожидается целое 1..8.`
      );
    }

    // Allow an optional JSON body for hints (e.g. context overrides).
    const body = await request.json().catch(() => ({}));

    const input = await buildPreparedInput(user.id, projectId, blockId);
    if (!input) return NOT_FOUND();

    return NextResponse.json({
      ...input,
      project_id: projectId,
      block_id: blockId,
      block_name: BLOCK_NAMES[blockId] || `Block ${blockId}`,
      prepared_input: input,
      context: body || {},
      ready: true,
    });
  } catch (error) {
    console.error("[pipeline/prepare-input] error:", error);
    return SERVER_ERROR();
  }
}
