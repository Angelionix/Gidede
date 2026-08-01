/**
 * POST /api/v1/playtests/save
 *
 * Saves one observable playtest run against an exact PrototypeArtifact and
 * Core Loop fun-hypothesis snapshot.
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { checkPrototypeFreshness, prototypeArtifactSchema } from "@/lib/prototype-lineage";
import { createHypothesisSnapshot, PlaytestEvidenceError } from "@/lib/playtest-evidence";

const VALID_TYPES = ["engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle"];
const VALID_MODES = ["2d", "3d"];
const VALID_OUTCOMES = ["win", "lose", "timeout"];

function optionalNonNegativeInteger(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : "invalid";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    const prototypeType = body?.prototype_type?.toString().trim();
    const mode = body?.mode?.toString().trim();
    const outcome = body?.outcome?.toString().trim();
    const score = body?.score != null ? Number(body.score) : null;
    const durationSec = Number(body?.duration_sec);
    const notes = body?.notes?.toString().trim().slice(0, 5000) || null;
    const aiGenerated = body?.ai_generated === true;
    const confusionEvents = optionalNonNegativeInteger(body?.confusion_events);
    const retryCount = optionalNonNegativeInteger(body?.retry_count);
    const prototypeArtifact = prototypeArtifactSchema.safeParse(body?.prototype_artifact);

    if (!projectId) return VALIDATION_ERROR("project_id обязателен для versioned playtest evidence");
    if (!prototypeArtifact.success) return VALIDATION_ERROR("prototype_artifact отсутствует или не прошёл schema validation");
    if (prototypeArtifact.data.projectId !== projectId) return VALIDATION_ERROR("prototype_artifact принадлежит другому проекту");
    if (!prototypeType || !VALID_TYPES.includes(prototypeType)) {
      return VALIDATION_ERROR(`prototype_type обязателен (${VALID_TYPES.join("|")})`);
    }
    if (!mode || !VALID_MODES.includes(mode)) {
      return VALIDATION_ERROR(`mode обязателен (${VALID_MODES.join("|")})`);
    }
    if (!outcome || !VALID_OUTCOMES.includes(outcome)) {
      return VALIDATION_ERROR(`outcome обязателен (${VALID_OUTCOMES.join("|")})`);
    }
    if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 600) {
      return VALIDATION_ERROR("duration_sec обязателен (0–600 сек)");
    }
    if (score != null && !Number.isFinite(score)) return VALIDATION_ERROR("score должен быть конечным числом");
    if (confusionEvents === "invalid") return VALIDATION_ERROR("confusion_events должен быть целым числом >= 0");
    if (retryCount === "invalid") return VALIDATION_ERROR("retry_count должен быть целым числом >= 0");
    if (body?.completion != null && typeof body.completion !== "boolean") {
      return VALIDATION_ERROR("completion должен быть boolean");
    }

    const project = await db.project.findFirst({
      where: { id: projectId, userId: user.id, deletedAt: null },
      select: {
        id: true,
        pipelineState: true,
        coreLoop: { select: { validationData: true } },
      },
    });
    if (!project) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

    const freshness = checkPrototypeFreshness(prototypeArtifact.data, project.pipelineState);
    if (!freshness.fresh) {
      return NextResponse.json(
        { detail: "Прототип устарел; сгенерируйте его из текущего Core Loop.", code: "prototype_stale", reason: freshness.reason },
        { status: 409 },
      );
    }

    const hypothesis = createHypothesisSnapshot(project.coreLoop?.validationData, prototypeArtifact.data);
    const cohortId = body?.cohort_id?.toString().trim().slice(0, 200) || prototypeArtifact.data.prototypeId;
    const participantId = body?.participant_id?.toString().trim().slice(0, 200) || user.id;
    const completion = typeof body?.completion === "boolean" ? body.completion : outcome === "win";

    const result = await db.playtestResult.create({
      data: {
        userId: user.id,
        projectId,
        prototypeId: prototypeArtifact.data.prototypeId,
        prototypeSchemaVersion: prototypeArtifact.data.schemaVersion,
        prototypeInputHash: prototypeArtifact.data.inputHash,
        prototypeGeneratedAt: new Date(prototypeArtifact.data.generatedAt),
        sourceArtifactVersions: JSON.stringify(prototypeArtifact.data.sourceArtifactVersions),
        hypothesisId: hypothesis.hypothesisId,
        hypothesisSnapshot: JSON.stringify(hypothesis),
        cohortId,
        participantId,
        prototypeType,
        mode,
        outcome,
        score,
        durationSec,
        completion,
        confusionEvents,
        retryCount,
        notes,
        aiGenerated,
      },
    });

    return NextResponse.json({
      id: result.id,
      saved: true,
      prototype_id: result.prototypeId,
      hypothesis_id: result.hypothesisId,
      cohort_id: result.cohortId,
    });
  } catch (error) {
    if (error instanceof PlaytestEvidenceError) {
      return NextResponse.json({ detail: error.message, code: error.code }, { status: 409 });
    }
    console.error("[playtests/save] error:", error);
    return SERVER_ERROR();
  }
}
