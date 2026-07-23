/**
 * POST /api/v1/gbe/sync-to
 *
 * Exports project state to GDCombine (mock). Reads the project from the DB
 * and produces a list of "synced components" based on which blocks have data.
 *
 * Body: { project_id?: string, base_url?: string, api_key?: string, project_state?: unknown }
 *
 * Response (merged spec + frontend GBESyncResult):
 *   {
 *     ok: boolean,                            // spec
 *     synced_components: string[],              // spec
 *     errors?: string[],                        // spec
 *     sync_id: string,                          // frontend
 *     direction: "to_gbe",                       // frontend
 *     status: "synced"|"synced_with_warnings"|"failed", // frontend
 *     components_synced: string[],              // frontend (= synced_components)
 *     components_skipped: string[],             // frontend
 *     warnings: string[],                       // frontend
 *     conflicts: unknown[],                     // frontend
 *     timestamp: string,                        // frontend
 *     latency_ms: number                         // frontend
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import {
  appendSyncHistory,
  GBE_EXPORT_COMPONENTS,
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

    // Resolve project (auto-select most-recent if project_id missing)
    const projectInclude = {
      concept: { select: { id: true } },
      coreLoop: { select: { id: true } },
      mdaProfile: { select: { id: true } },
      balanceResult: { select: { id: true } },
      progression: { select: { id: true } },
      economy: { select: { id: true } },
      gdd: { select: { id: true } },
      checklist: { select: { id: true } },
    } as const;
    const project = projectId
      ? await db.project.findFirst({
          where: { id: projectId, userId: user.id },
          include: projectInclude,
        })
      : await db.project.findFirst({
          where: { userId: user.id },
          orderBy: { updatedAt: "desc" },
          include: projectInclude,
        });

    if (!project) {
      return NextResponse.json(
        { detail: "Проект не найден" },
        { status: 404 }
      );
    }

    // Build the synced-components list based on what's actually present.
    const componentsSynced: string[] = [];
    const componentsSkipped: string[] = [];
    if (project.concept) componentsSynced.push("concept_blueprint");
    else componentsSkipped.push("concept_blueprint");
    if (project.coreLoop) componentsSynced.push("core_loop_diagram");
    else componentsSkipped.push("core_loop_diagram");
    if (project.mdaProfile) componentsSynced.push("mda_model");
    else componentsSkipped.push("mda_model");
    if (project.balanceResult) componentsSynced.push("balance_report");
    else componentsSkipped.push("balance_report");
    if (project.progression) componentsSynced.push("progression_curve");
    else componentsSkipped.push("progression_curve");
    if (project.economy) componentsSynced.push("economy_graph");
    else componentsSkipped.push("economy_graph");
    if (project.gdd) componentsSynced.push("gdd_document");
    else componentsSkipped.push("gdd_document");
    if (project.checklist) componentsSynced.push("checklist_report");
    else componentsSkipped.push("checklist_report");

    const warnings: string[] = [];
    if (componentsSkipped.length > 0) {
      warnings.push(
        `Пропущено компонентов: ${componentsSkipped.length} (нет данных в проекте).`
      );
    }
    warnings.push(
      `Mock-режим: данные не отправлены на реальный GBE (endpoint=${baseUrl}, version=${GBE_VERSION}).`
    );

    const status =
      componentsSynced.length === 0
        ? "failed"
        : componentsSkipped.length > 0
          ? "synced_with_warnings"
          : "synced";

    const syncId = `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = new Date().toISOString();
    const latencyMs = Date.now() - startedAt;

    // Append to in-memory sync history
    appendSyncHistory(user.id, {
      sync_id: syncId,
      direction: "to_gbe",
      components_synced: componentsSynced,
      timestamp,
      status,
    });

    return NextResponse.json({
      // spec fields
      ok: status !== "failed",
      synced_components: componentsSynced,
      errors: status === "failed" ? ["Нет данных для экспорта"] : [],
      // frontend fields
      sync_id: syncId,
      direction: "to_gbe",
      status,
      components_synced: componentsSynced,
      components_skipped: componentsSkipped,
      warnings,
      conflicts: [],
      timestamp,
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error("[gbe/sync-to] error:", error);
    return SERVER_ERROR();
  }
}
