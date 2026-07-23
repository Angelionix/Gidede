/**
 * Gidede — Persistent store for GBE (Block 8) sync history + mock state.
 *
 * История синхронизации сохраняется в Prisma (модель GbeSyncHistory).
 * Данные переживают перезапуск сервера (критерий C5).
 *
 * Все GBE-ответы — mock-but-realistic, реального бэкенда GDCombine нет.
 */

import { db } from "@/lib/db";

export interface SyncHistoryEntry {
  sync_id: string;
  direction: "to_gbe" | "from_gbe";
  components_synced: string[];
  timestamp: string;
  status: string;
}

export async function appendSyncHistory(
  userId: string,
  entry: SyncHistoryEntry
): Promise<void> {
  const direction =
    entry.direction === "to_gbe" ? "to" : "from";
  await db.gbeSyncHistory.create({
    data: {
      userId,
      syncDirection: direction,
      status: entry.status,
      componentsCount: entry.components_synced.length,
      detail: JSON.stringify({
        sync_id: entry.sync_id,
        components_synced: entry.components_synced,
      }),
    },
  });
}

export async function getSyncHistory(
  userId: string,
  limit = 10
): Promise<{ history: SyncHistoryEntry[]; total: number }> {
  const [rows, total] = await Promise.all([
    db.gbeSyncHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.gbeSyncHistory.count({ where: { userId } }),
  ]);

  const history: SyncHistoryEntry[] = rows.map((r) => {
    const detail = r.detail ? safeJsonParse(r.detail) : null;
    return {
      sync_id: detail?.sync_id ?? r.id,
      direction:
        r.syncDirection === "to" ? ("to_gbe" as const) : ("from_gbe" as const),
      components_synced: detail?.components_synced ?? [],
      timestamp: r.createdAt.toISOString(),
      status: r.status,
    };
  });

  return { history, total };
}

function safeJsonParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
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
