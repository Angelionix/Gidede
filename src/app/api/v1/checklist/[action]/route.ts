/**
 * POST /api/v1/checklist/[action]
 *
 * Singular alias of /api/v1/checklists/[action]. The frontend (block 6 page)
 * calls `/checklist/validate`, so this route simply forwards to the plural
 * handler's logic via the shared `runChecklistValidation` helper.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { runChecklistValidation } from "@/lib/checklist-logic";

const VALID_ACTIONS = new Set([
  "validate",
  "mda-check",
  "balance-check",
  "narrative-check",
  "economy-check",
  "lens-check",
  "mda",
  "balance",
  "narrative",
  "economy",
  "lenses",
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { action } = await params;
    if (!VALID_ACTIONS.has(action)) {
      return VALIDATION_ERROR(
        `Неизвестное действие чек-листа: ${action}. Допустимо: ${Array.from(VALID_ACTIONS).join(", ")}`
      );
    }

    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim() || undefined;
    const depth = body?.depth?.toString().trim() || "standard";
    const checklistTypes = Array.isArray(body?.checklist_types)
      ? body.checklist_types.map(String)
      : undefined;

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const project = owned.project as Parameters<typeof runChecklistValidation>[0];

    const result = await runChecklistValidation(project, action, {
      depth,
      checklistTypes,
    });

    return NextResponse.json(result.profile);
  } catch (error) {
    console.error("[checklist/[action]] error:", error);
    return SERVER_ERROR();
  }
}
