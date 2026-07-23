/**
 * GET /api/v1/gbe/sync-history
 *
 * Returns the user's recent GBE sync history (in-memory store).
 *
 * Query: { limit?: number } — default 10
 *
 * Response: { history: SyncHistoryEntry[], total: number, limit: number }
 *   SyncHistoryEntry = { sync_id, direction, components_synced: string[], timestamp }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { getSyncHistory } from "@/lib/gbe-store";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.max(1, Math.min(100, Number(limitParam) || 10));

    const { history, total } = getSyncHistory(user.id, limit);
    return NextResponse.json({ history, total, limit });
  } catch (error) {
    console.error("[gbe/sync-history] error:", error);
    return SERVER_ERROR();
  }
}
