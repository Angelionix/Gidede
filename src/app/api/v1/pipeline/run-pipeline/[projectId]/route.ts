/**
 * POST /api/v1/pipeline/run-pipeline/[projectId]
 *
 * Runs a partial pipeline (subset of blocks) SERVER-SIDE with real
 * persistence. Mirrors run-full-pipeline but only executes the requested
 * block_ids.
 *
 * Body: { block_ids: number[] }
 *
 * Response: { ok, project_id, stages: StageResult[], latency_ms, completion_percent }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, signAccessToken } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  NOT_FOUND,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { loadProjectPipelineSnapshot, BLOCK_NAMES } from "@/lib/pipeline-helpers";
import { db } from "@/lib/db";

interface StageDef {
  stage: string;
  block_id: number;
  endpoint: string;
  buildBody: (ctx: PartialPipelineCtx) => Record<string, unknown>;
}

interface PartialPipelineCtx {
  /** Project name — used as the concept idea fallback. */
  projectName: string;
  /** Project description — preferred source for the concept idea. */
  projectDescription: string | null;
  /** Project genre — feeds Block 1 concept generation. */
  projectGenre: string | null;
  /** Pre-existing concept idea, if the project already ran Block 1. */
  existingIdea: string | null;
}

const BLOCK_STAGES: Record<number, StageDef[]> = {
  1: [
    {
      stage: "concept",
      block_id: 1,
      endpoint: "/api/v1/concept/generate",
      // Use the project's real description/name as the concept idea instead
      // of a meaningless literal string. If the project already has a concept
      // (re-run), fall back to the stored onePagerData idea if available.
      buildBody: (ctx) => ({
        idea:
          ctx.existingIdea ||
          ctx.projectDescription ||
          `${ctx.projectName} — игра в жанре ${ctx.projectGenre || "RPG"}`,
        ...(ctx.projectGenre ? { genre: ctx.projectGenre } : {}),
      }),
    },
  ],
  2: [
    {
      stage: "core_loop",
      block_id: 2,
      endpoint: "/api/v1/coreloop/design",
      buildBody: (ctx) => ({
        mechanics: deriveMechanicsFromIdea(
          ctx.existingIdea || ctx.projectDescription || ctx.projectName || ""
        ),
      }),
    },
  ],
  3: [
    {
      stage: "mda",
      block_id: 3,
      endpoint: "/api/v1/mda/analyze",
      buildBody: () => ({ target_aesthetics: ["challenge"] }),
    },
  ],
  4: [
    {
      stage: "balance",
      block_id: 4,
      endpoint: "/api/v1/balance/analyze",
      buildBody: (ctx) => ({
        objects: [
          { id: "weapon_basic", name: "Базовое оружие", type: "weapon", attributes: { power: 30, range: 5, speed: 7 }, cost: 100, tier: 1 },
          { id: "weapon_advanced", name: "Продвинутое оружие", type: "weapon", attributes: { power: 60, range: 8, speed: 5 }, cost: 300, tier: 2 },
          { id: "armor_light", name: "Лёгкая броня", type: "armor", attributes: { defense: 20, mobility: 8 }, cost: 150, tier: 1 },
          { id: "armor_heavy", name: "Тяжёлая броня", type: "armor", attributes: { defense: 50, mobility: 3 }, cost: 400, tier: 3 },
        ],
        game_mode: "pve",
        ...(ctx.projectGenre ? { genre: ctx.projectGenre } : {}),
      }),
    },
  ],
  5: [
    {
      stage: "progression",
      block_id: 5,
      endpoint: "/api/v1/progression/design",
      buildBody: () => ({ total_levels: 50 }),
    },
    {
      stage: "economy",
      block_id: 5,
      endpoint: "/api/v1/economy/design",
      buildBody: () => ({}),
    },
  ],
  6: [
    {
      stage: "gdd",
      block_id: 6,
      endpoint: "/api/v1/gdd/generate",
      buildBody: () => ({ format: "one_sheet" }),
    },
    {
      stage: "validation",
      block_id: 6,
      endpoint: "/api/v1/gdd/checklist",
      buildBody: () => ({}),
    },
  ],
};

/**
 * Heuristic: pick 3–4 mechanics from the idea text for Block 2.
 * Supports both English and Russian keywords so RU-language projects
 * don't silently fall through to the hardcoded fallback.
 */
function deriveMechanicsFromIdea(idea: string): string[] {
  const text = (idea || "").toLowerCase();
  const candidates = [
    { kw: ["combat", "fight", "shoot", "attack", "battle", "бой", "сраж", "стрелять", "атака", "битва", "сражение"], m: "combat" },
    { kw: ["explore", "discover", "map", "world", "исслед", "открыв", "карта", "мир", "путешеств"], m: "explore" },
    { kw: ["collect", "gather", "loot", "farm", "собирай", "собирать", "лут", "ферм", "ресурс"], m: "collect" },
    { kw: ["build", "craft", "construct", "строй", "строить", "крафт", "конструир"], m: "build" },
    { kw: ["puzzle", "solve", "logic", "головолом", "реша", "логика", "загадка"], m: "puzzle" },
    { kw: ["race", "speed", "run", "гонк", "скорость", "бег", "гонщи"], m: "race" },
    { kw: ["survive", "survival", "endure", "выжив", "пережить", "выжить"], m: "survive" },
    { kw: ["trade", "economy", "market", "торг", "эконом", "рынок", "торговл"], m: "trade" },
    { kw: ["upgrade", "progress", "level", "улучш", "прогресс", "уровен", "качаться", "прокач"], m: "upgrade" },
  ];
  const picked = candidates
    .filter((c) => c.kw.some((k) => text.includes(k)))
    .map((c) => c.m);
  // Always return at least 3 mechanics so Block 2 has enough to design a loop.
  const fallback = ["explore", "combat", "reward"];
  const merged = [...new Set([...picked, ...fallback])];
  return merged.slice(0, 4);
}


function internalBaseUrl(request: NextRequest): string {
  const xfHost = request.headers.get("x-forwarded-host");
  const xfProto = request.headers.get("x-forwarded-proto") || "http";
  const host = xfHost || request.headers.get("host") || "localhost:3000";
  return `${xfProto}://${host}`;
}

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
    const blockIdsRaw = Array.isArray(body?.block_ids) ? body.block_ids : null;

    if (!blockIdsRaw || blockIdsRaw.length === 0) {
      return VALIDATION_ERROR(
        "Поле block_ids обязательно и должно содержать хотя бы один ID блока"
      );
    }

    const blockIds = blockIdsRaw
      .map((n: unknown) => Number(n))
      .filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 8);

    if (blockIds.length === 0) {
      return VALIDATION_ERROR(
        "Все block_ids должны быть целыми числами в диапазоне 1..8"
      );
    }

    const snap = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snap) return NOT_FOUND();

    // Load the project row to build a context for stages that need real
    // project data (Block 1 concept idea, Block 2 mechanics derivation).
    // Also pull the existing concept's onePagerData to recover the original
    // idea when re-running Block 1.
    const projectRow = await db.project.findFirst({
      where: { id: projectId, userId: user.id, deletedAt: null },
      select: {
        name: true,
        description: true,
        genre: true,
        concept: { select: { inputData: true } },
      },
    });
    let existingIdea: string | null = null;
    if (projectRow?.concept?.inputData) {
      try {
        const parsed = JSON.parse(projectRow.concept.inputData) as { idea?: unknown };
        if (typeof parsed.idea === "string" && parsed.idea.trim()) {
          existingIdea = parsed.idea.trim();
        }
      } catch {
        /* ignore malformed inputData */
      }
    }
    const ctx: PartialPipelineCtx = {
      projectName: projectRow?.name || snap.projectName,
      projectDescription: projectRow?.description ?? null,
      projectGenre: projectRow?.genre ?? null,
      existingIdea,
    };

    // Sign a short-lived internal access token for the block endpoints.
    const internalToken = signAccessToken(user.id, user.email);
    const authHeader = `Bearer ${internalToken}`;
    const baseUrl = internalBaseUrl(request);

    const stages: Array<{
      stage: string;
      block_id: number;
      block_name: string;
      status: "completed" | "skipped" | "error";
      message: string;
      http_status?: number;
      latency_ms?: number;
    }> = [];

    for (const blockId of blockIds) {
      const stageDefs = BLOCK_STAGES[blockId] || [];
      for (const stage of stageDefs) {
        const stageStart = Date.now();
        const url = `${baseUrl}${stage.endpoint}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
            },
            body: JSON.stringify({ project_id: projectId, ...stage.buildBody(ctx) }),
            redirect: "manual",
          });
          const latencyMs = Date.now() - stageStart;
          if (res.ok) {
            stages.push({
              stage: stage.stage,
              block_id: stage.block_id,
              block_name: BLOCK_NAMES[blockId] || `Block ${blockId}`,
              status: "completed",
              message: `Стадия «${stage.stage}» выполнена — данные сохранены.`,
              http_status: res.status,
              latency_ms: latencyMs,
            });
          } else {
            let detail = "";
            try {
              const errBody = await res.json();
              detail = errBody?.detail || errBody?.message || JSON.stringify(errBody).slice(0, 200);
            } catch {
              detail = `HTTP ${res.status}`;
            }
            stages.push({
              stage: stage.stage,
              block_id: stage.block_id,
              block_name: BLOCK_NAMES[blockId] || `Block ${blockId}`,
              status: res.status === 422 ? "skipped" : "error",
              message: `Стадия «${stage.stage}» ${res.status === 422 ? "пропущена" : "завершилась с ошибкой"}: ${detail}`,
              http_status: res.status,
              latency_ms: latencyMs,
            });
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          stages.push({
            stage: stage.stage,
            block_id: stage.block_id,
            block_name: BLOCK_NAMES[blockId] || `Block ${blockId}`,
            status: "error",
            message: `Сетевая ошибка: ${msg}`,
            latency_ms: Date.now() - stageStart,
          });
        }
      }
    }

    const finalSnap = await loadProjectPipelineSnapshot(user.id, projectId);
    const completedCount = stages.filter((s) => s.status === "completed").length;

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      stages,
      stages_completed: completedCount,
      stages_total: stages.length,
      latency_ms: Date.now() - startedAt,
      completion_percent: finalSnap?.completionPercent ?? 0,
      note:
        completedCount === stages.length
          ? "Все запрошенные стадии выполнены. Данные сохранены."
          : `Выполнено ${completedCount}/${stages.length} стадий. См. stages[].status.`,
    });
  } catch (error) {
    console.error("[pipeline/run-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
