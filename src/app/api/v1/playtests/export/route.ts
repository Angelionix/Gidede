/** GET /api/v1/playtests/export — exports versioned playtest evidence. */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";

function parseVersions(value: string | null): Record<string, string> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "json";
    const results = await db.playtestResult.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    const exported = results.map((result) => {
      const sourceArtifactVersions = parseVersions(result.sourceArtifactVersions);
      const prototypeArtifact = result.projectId
        && result.prototypeId
        && result.prototypeSchemaVersion === "1.0.0"
        && result.prototypeInputHash
        && result.prototypeGeneratedAt
        && sourceArtifactVersions
        ? {
            prototypeId: result.prototypeId,
            schemaVersion: result.prototypeSchemaVersion,
            projectId: result.projectId,
            sourceArtifactVersions,
            inputHash: result.prototypeInputHash,
            generatedAt: result.prototypeGeneratedAt.toISOString(),
          }
        : null;

      return {
        id: result.id,
        project_id: result.projectId,
        prototype_artifact: prototypeArtifact,
        prototype_id: result.prototypeId,
        hypothesis_id: result.hypothesisId,
        cohort_id: result.cohortId,
        participant_id: result.participantId,
        prototype_type: result.prototypeType,
        mode: result.mode,
        outcome: result.outcome,
        score: result.score,
        duration_sec: result.durationSec,
        completion: result.completion,
        confusion_events: result.confusionEvents,
        retry_count: result.retryCount,
        notes: result.notes,
        ai_generated: result.aiGenerated,
        created_at: result.createdAt.toISOString(),
      };
    });

    if (format === "csv") {
      const columns = [
        "id", "project_id", "prototype_id", "hypothesis_id", "cohort_id", "participant_id",
        "prototype_type", "mode", "outcome", "score", "duration_sec", "completion",
        "confusion_events", "retry_count", "notes", "ai_generated", "created_at",
      ] as const;
      const csv = [
        columns.join(","),
        ...exported.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
      ].join("\n");
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="playtest-history.csv"',
        },
      });
    }

    return Response.json({
      exported_at: new Date().toISOString(),
      count: exported.length,
      results: exported,
    });
  } catch (error) {
    console.error("[playtests/export] error:", error);
    return SERVER_ERROR();
  }
}
