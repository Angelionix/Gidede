/**
 * POST /api/v1/pipeline/run-full-pipeline/[projectId]
 *
 * Runs the full pipeline (Blocks 1 → 6) for the given project. Since actually
 * re-running all 8 algorithms is complex (and each block requires specific
 * input that the user provides via its own form), we SIMULATE the run:
 * we iterate over stages 1..6 and mark each as "completed" in the response
 * (without actually persisting any data). The frontend uses this for UX
 * demos / presentations.
 *
 * Body (concept input, mostly ignored in the mock):
 *   {
 *     idea: string, genre?: string, target_audience?: object,
 *     platform?: string[], constraints?: object,
 *     reference_games?: string[], forbidden_mechanics?: string[]
 *   }
 *
 * Response: { ok: true, project_id, stages: StageResult[], latency_ms }
 *   StageResult = { stage: string, block_id: number, status: "completed"|"skipped", message: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { loadProjectPipelineSnapshot, BLOCK_NAMES } from "@/lib/pipeline-helpers";

const STAGES = [
  { stage: "concept", block_id: 1 },
  { stage: "core_loop", block_id: 2 },
  { stage: "mda", block_id: 3 },
  { stage: "balance", block_id: 4 },
  { stage: "progression", block_id: 5 },
  { stage: "economy", block_id: 5 },
  { stage: "gdd", block_id: 6 },
  { stage: "validation", block_id: 6 },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    const body = await request.json().catch(() => ({}));
    const idea = body?.idea?.toString().trim();

    if (!idea) {
      return VALIDATION_ERROR("Поле idea обязательно для запуска пайплайна");
    }

    const snap = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snap) return NOT_FOUND();

    // Simulate each stage's "completion"
    const stages = STAGES.map((s) => ({
      stage: s.stage,
      block_id: s.block_id,
      block_name: BLOCK_NAMES[s.block_id] || `Block ${s.block_id}`,
      status: "completed" as const,
      message: `Стадия «${s.stage}» обработана (mock — данные не сохранены).`,
    }));

    const latencyMs = Date.now() - startedAt;

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      concept_idea: idea,
      stages,
      stages_completed: stages.length,
      stages_total: STAGES.length,
      latency_ms: latencyMs,
      note: "Mock-выполнение: реальные данные блоков не сохранены. Используйте отдельные POST-эндпоинты блоков для фактической генерации.",
    });
  } catch (error) {
    console.error("[pipeline/run-full-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
