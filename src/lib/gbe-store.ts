/**
 * Gidede — In-memory store for GBE (Block 8) sync history + connection state.
 *
 * Prisma has no GBE table; we keep an in-memory Map of sync history entries
 * keyed by user. Resets on server restart — acceptable for a demo.
 *
 * All GBE responses are mock-but-realistic — there's no real GDCombine backend
 * running in this sandbox.
 */

export interface SyncHistoryEntry {
  sync_id: string;
  direction: "to_gbe" | "from_gbe";
  components_synced: string[];
  timestamp: string;
  status: string;
}

const syncHistoryByUser = new Map<string, SyncHistoryEntry[]>();
const MAX_HISTORY_PER_USER = 100;

export function appendSyncHistory(
  userId: string,
  entry: SyncHistoryEntry
): void {
  const list = syncHistoryByUser.get(userId) || [];
  list.unshift(entry);
  if (list.length > MAX_HISTORY_PER_USER) list.length = MAX_HISTORY_PER_USER;
  syncHistoryByUser.set(userId, list);
}

export function getSyncHistory(
  userId: string,
  limit = 10
): { history: SyncHistoryEntry[]; total: number } {
  const list = syncHistoryByUser.get(userId) || [];
  return {
    history: list.slice(0, limit),
    total: list.length,
  };
}

// ============================================================
// Mock component inventories (plausible for a game-design tool)
// ============================================================

export const GBE_EXPORT_COMPONENTS = [
  "concept_blueprint",
  "core_loop_diagram",
  "mda_model",
  "balance_report",
  "progression_curve",
  "economy_graph",
  "gdd_document",
  "checklist_report",
];

export const GBE_IMPORT_COMPONENTS = [
  "blueprint_node",
  "diagram_edge",
  "lint_warning",
  "balance_suggestion",
  "economy_resource",
];

export const GBE_VERSION = "1.0.0-mock";
