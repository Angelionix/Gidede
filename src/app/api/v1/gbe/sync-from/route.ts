/**
 * POST /api/v1/gbe/sync-from
 *
 * Imports data from GDCombine into the project (mock). Does NOT modify the
 * Prisma DB (since we don't know the real GBE response shape). Returns a
 * plausible component list.
 *
 * Body: { project_id?: string, base_url?: string, api_key?: string, gbe_data?: unknown }
 *
 * Response (merged spec + frontend GBESyncResult):
 *   {
 *     ok: boolean,
 *     imported_components: string[],          // spec
 *     synced_components: string[],             // alias (same as imported_components)
 *     errors?: string[],
 *     sync_id, direction: "from_gbe", status, components_synced, components_skipped, warnings, conflicts, timestamp, latency_ms
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import {
  appendSyncHistory,
  GBE_IMPORT_COMPONENTS,
  GBE_VERSION,
} from "@/lib/gbe-store";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
    const baseUrl =
      body?.base_url?.toString().trim() ||
      "https://gbe.example.com/api/v1";
    const gbeData = body?.gbe_data;

    // Resolve project (auto-select if missing)
    const projectSelect = { id: true, name: true } as const;
    const project = projectId
      ? await db.project.findFirst({
          where: { id: projectId, userId: user.id },
          select: projectSelect,
        })
      : await db.project.findFirst({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          select: projectSelect,
        });

    if (!project) {
      return NextResponse.json(
        { detail: "Проект не найден" },
        { status: 404 }
      );
    }

    // Derive "imported components" from what GBE provided.
    const componentsSynced: string[] = [];
    const componentsSkipped: string[] = [];

    if (gbeData && typeof gbeData === "object") {
      const data = gbeData as Record<string, unknown>;
      if (data.blueprint) componentsSynced.push("blueprint_node");
      if (data.mda_model) componentsSynced.push("mda_model_node");
      if (data.balance_report) componentsSynced.push("balance_suggestion");
      if (data.progression_model) componentsSynced.push("progression_curve");
      if (data.economy_model) componentsSynced.push("economy_resource");
    }

    // If nothing was matched, fall back to the standard import set
    if (componentsSynced.length === 0) {
      componentsSynced.push(...GBE_IMPORT_COMPONENTS);
    }

    // Always skip these (mock)
    componentsSkipped.push("lint_warning");

    const warnings: string[] = [
      `Mock-режим: данные не загружены с реального GBE (endpoint=${baseUrl}, version=${GBE_VERSION}).`,
    ];

    const status = "synced";
    const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const latencyMs = Date.now() - startedAt;

    appendSyncHistory(user.id, {
      sync_id: syncId,
      direction: "from_gbe",
      components_synced: componentsSynced,
      timestamp,
      status,
    });

    return NextResponse.json({
      // spec fields
      ok: true,
      imported_components: componentsSynced,
      synced_components: componentsSynced, // alias
      errors: [],
      // frontend fields
      sync_id: syncId,
      direction: "from_gbe",
      status,
      components_synced: componentsSynced,
      components_skipped: componentsSkipped,
      warnings,
      conflicts: [],
      timestamp,
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error("[gbe/sync-from] error:", error);
    return SERVER_ERROR();
  }
}
