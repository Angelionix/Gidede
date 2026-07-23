/**
 * POST /api/v1/gbe/webhook
 *
 * Receives a webhook from GBE (mock). Returns a plausible acknowledgement
 * based on the event type.
 *
 * Body: { event_type: string, project_id?: string, component?: string, changed_fields?: unknown[], data?: unknown }
 *
 * Response (merged spec + frontend GBEWebhookResult):
 *   {
 *     received: boolean,                // spec
 *     processed: boolean,                // spec
 *     acknowledged: boolean,             // frontend (= processed)
 *     event_type: string,                // frontend
 *     action_taken: string,              // frontend
 *     message: string,                   // frontend
 *     timestamp: string                  // frontend
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";

const KNOWN_EVENT_TYPES = new Set([
  "blueprint.updated",
  "diagram.changed",
  "sync.requested",
  "lint.completed",
]);

const ACTION_BY_EVENT: Record<string, string> = {
  "blueprint.updated": "blueprint_reloaded",
  "diagram.changed": "diagram_recomputed",
  "sync.requested": "sync_triggered",
  "lint.completed": "lint_report_stored",
};

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const eventType = body?.event_type?.toString().trim();

    if (!eventType) {
      return VALIDATION_ERROR("Поле event_type обязательно");
    }

    const component = body?.component?.toString().trim() || "unknown";
    const known = KNOWN_EVENT_TYPES.has(eventType);

    const actionTaken = known
      ? ACTION_BY_EVENT[eventType]
      : "unknown_event_ignored";

    const message = known
      ? `Событие ${eventType} обработано (компонент: ${component}).`
      : `Событие ${eventType} неизвестно — проигнорировано.`;

    const timestamp = new Date().toISOString();

    return NextResponse.json({
      // spec fields
      received: true,
      processed: known,
      // frontend fields
      acknowledged: known,
      event_type: eventType,
      action_taken: actionTaken,
      message,
      timestamp,
    });
  } catch (error) {
    console.error("[gbe/webhook] error:", error);
    return SERVER_ERROR();
  }
}
