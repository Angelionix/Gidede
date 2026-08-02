/**
 * POST /api/v1/checklists/[action]
 *
 * Block 6 algorithm 3.8 (Checklist validation). The `[action]` segment
 * selects which checklist(s) to run. Supported actions:
 *   - validate             (run all checks, return full profile)
 *   - mda-check            (run MDA check only)
 *   - balance-check        (run balance check only)
 *   - narrative-check      (run narrative check only)
 *   - economy-check        (run economy check only)
 *   - lens-check           (run lens check only)
 *
 * Body: { project_id?, depth?, checklist_types? }
 *
 * Persists to ProjectChecklist (upsert where projectId) and updates project
 * stage to "validation".
 *
 * Response: ChecklistValidationProfile (matches src/types/gdd.ts).
 *
 * NOTE: The frontend calls `/checklist/validate` (singular). The plural
 * path here matches the API contract; a thin alias at
 * `/api/v1/checklist/[action]/route.ts` re-exports this handler so both
 * paths work.
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
import { validateStageInput } from "@/lib/contracts/stage-contracts";

const VALID_ACTIONS = new Set([
  "validate",
  // Original 5 per-block checks.
  "mda-check",
  "balance-check",
  "narrative-check",
  "economy-check",
  "lens-check",
  // Short aliases for the original 5.
  "mda",
  "balance",
  "narrative",
  "economy",
  "lenses",
  // R-AUDIT-FIX: 6 new Bible checklist types (TASK-6b.3-9) were added to
  // checklist-logic.ts ALL_CHECKLISTS but were missing from VALID_ACTIONS,
  // so POST /checklists/<name>-check returned 422. Now whitelisted.
  "shell_filters-check",
  "upton-check",
  "rolling_morris-check",
  "bond_methods-check",
  "fullerton-check",
  "narrative_types-check",
  // Short aliases for the 6 new checks.
  "shell_filters",
  "upton",
  "rolling_morris",
  "bond_methods",
  "fullerton",
  "narrative_types",
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
    const contractInput = validateStageInput("validation", body);
    if (!contractInput.success) return VALIDATION_ERROR(contractInput.error);
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
      artifactInput: body,
    });

    return NextResponse.json(result.profile);
  } catch (error) {
    console.error("[checklists/[action]] error:", error);
    return SERVER_ERROR();
  }
}
