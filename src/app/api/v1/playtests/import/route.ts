/** POST /api/v1/playtests/import — imports versioned playtest evidence. */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { checkPrototypeFreshness, prototypeArtifactSchema } from "@/lib/prototype-lineage";
import { createHypothesisSnapshot } from "@/lib/playtest-evidence";

const VALID_TYPES = ["engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle"];
const VALID_MODES = ["2d", "3d"];
const VALID_OUTCOMES = ["win", "lose", "timeout"];

function optionalInteger(value: unknown): number | null | "invalid" {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : "invalid";
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const results = Array.isArray(body?.results) ? body.results : [];
    const defaultProjectId = body?.project_id?.toString().trim() || null;
    if (results.length === 0) return VALIDATION_ERROR("Поле results обязательно и должно быть массивом");

    const projects = new Map<string, {
      pipelineState: string | null;
      validationData: string | null | undefined;
    } | null>();
    let imported = 0;
    let skipped = 0;

    for (const item of results) {
      try {
        const projectId = item?.project_id?.toString().trim() || defaultProjectId;
        const type = item?.prototype_type?.toString().trim();
        const mode = item?.mode?.toString().trim();
        const outcome = item?.outcome?.toString().trim();
        const durationSec = Number(item?.duration_sec);
        const artifact = prototypeArtifactSchema.safeParse(item?.prototype_artifact);
        const confusionEvents = optionalInteger(item?.confusion_events);
        const retryCount = optionalInteger(item?.retry_count);

        if (!projectId || !artifact.success || artifact.data.projectId !== projectId) throw new Error("invalid lineage");
        if (!type || !VALID_TYPES.includes(type)) throw new Error("invalid type");
        if (!mode || !VALID_MODES.includes(mode)) throw new Error("invalid mode");
        if (!outcome || !VALID_OUTCOMES.includes(outcome)) throw new Error("invalid outcome");
        if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 600) throw new Error("invalid duration");
        if (confusionEvents === "invalid" || retryCount === "invalid") throw new Error("invalid observations");

        if (!projects.has(projectId)) {
          const project = await db.project.findFirst({
            where: { id: projectId, userId: user.id, deletedAt: null },
            select: { pipelineState: true, coreLoop: { select: { validationData: true } } },
          });
          projects.set(projectId, project ? {
            pipelineState: project.pipelineState,
            validationData: project.coreLoop?.validationData,
          } : null);
        }
        const project = projects.get(projectId);
        if (!project) throw new Error("project not owned");
        if (!checkPrototypeFreshness(artifact.data, project.pipelineState).fresh) throw new Error("stale prototype");

        const hypothesis = createHypothesisSnapshot(project.validationData, artifact.data);
        const createdAt = item?.created_at ? new Date(item.created_at) : new Date();
        if (Number.isNaN(createdAt.getTime())) throw new Error("invalid date");
        const score = item?.score != null ? Number(item.score) : null;
        if (score != null && !Number.isFinite(score)) throw new Error("invalid score");

        await db.playtestResult.create({
          data: {
            userId: user.id,
            projectId,
            prototypeId: artifact.data.prototypeId,
            prototypeSchemaVersion: artifact.data.schemaVersion,
            prototypeInputHash: artifact.data.inputHash,
            prototypeGeneratedAt: new Date(artifact.data.generatedAt),
            sourceArtifactVersions: JSON.stringify(artifact.data.sourceArtifactVersions),
            hypothesisId: hypothesis.hypothesisId,
            hypothesisSnapshot: JSON.stringify(hypothesis),
            cohortId: item?.cohort_id?.toString().trim().slice(0, 200) || artifact.data.prototypeId,
            participantId: item?.participant_id?.toString().trim().slice(0, 200) || user.id,
            prototypeType: type,
            mode,
            outcome,
            score,
            durationSec,
            completion: typeof item?.completion === "boolean" ? item.completion : outcome === "win",
            confusionEvents,
            retryCount,
            notes: item?.notes?.toString().trim().slice(0, 5000) || null,
            aiGenerated: item?.ai_generated === true,
            createdAt,
          },
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return Response.json({ imported, skipped, total: results.length });
  } catch (error) {
    console.error("[playtests/import] error:", error);
    return SERVER_ERROR();
  }
}
