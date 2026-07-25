/**
 * GET /api/v1/gbe/status/[projectId]
 *
 * Returns the GBE sync status for a project (mock — there's no real GBE
 * backend, so we derive plausible values from the project's pipeline state).
 *
 * Response (merged spec + frontend):
 *   {
 *     project_id: string,             // spec
 *     sync_status: string,             // spec ("synced" | "pending" | "never")
 *     last_sync?: string | null,      // spec
 *     pending_changes: number,         // spec
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR, NOT_FOUND } from "@/lib/api-helpers";
import { getSyncHistory } from "@/lib/gbe-store";
import { loadProjectPipelineSnapshot } from "@/lib/pipeline-helpers";

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

    // Derive a plausible GBE sync status from the project's pipeline state.
    // If the user has any sync history entries, use the most-recent one as
    // last_sync; otherwise report "never".
    const { history } = await getSyncHistory(user.id, 1);

    let syncStatus: string;
    let lastSync: string | null;
    let pendingChanges: number;

    if (history.length === 0) {
      syncStatus = "never";
      lastSync = null;
      // Pending = how many of the 8 pipeline blocks still aren't filled
      const filled = [
        snap.hasConcept,
        snap.hasCoreLoop,
        snap.hasMda,
        snap.hasBalance,
        snap.hasProgression || snap.hasEconomy,
        snap.hasGdd || snap.hasChecklist,
        true,
        true,
      ].filter(Boolean).length;
      pendingChanges = 8 - filled;
    } else {
      // After the first sync, we treat the project as synced unless there's
      // a more recent block update (then "pending").
      const lastSyncDate = new Date(history[0].timestamp);
      const projectUpdate = snap.updatedAt;
      if (projectUpdate && projectUpdate > lastSyncDate) {
        syncStatus = "pending";
        pendingChanges = 1; // mock — at least one pending change
      } else {
        syncStatus = "synced";
        pendingChanges = 0;
      }
      lastSync = history[0].timestamp;
    }

    return NextResponse.json({
      project_id: projectId,
      sync_status: syncStatus,
      last_sync: lastSync,
      pending_changes: pendingChanges,
    });
  } catch (error) {
    console.error("[gbe/status] error:", error);
    return SERVER_ERROR();
  }
}
