/**
 * POST /api/v1/pipeline/run-full-pipeline/[projectId]
 *
 * Runs the full pipeline (Blocks 1 → 6 + validation) for the given project
 * SERVER-SIDE, persisting real data for every block.
 *
 * Implementation strategy: instead of duplicating each block's generation
 * logic, we issue internal HTTP requests to the existing block endpoints
 * (concept/generate, coreloop/design, mda/analyze, balance/analyze,
 * progression/design, economy/design, gdd/generate, gdd/checklist).
 * Each block endpoint already handles auth (via the forwarded cookie),
 * ownership checks, persistence, and stage updates. This gives us a true
 * server-side pipeline with transactional per-block persistence, while
 * reusing ~100% of the existing block logic.
 *
 * Body:
 *   {
 *     idea: string,                     // required — feeds Block 1
 *     genre?: string|null,              // optional override for Block 1
 *     use_ai?: boolean,                 // optional AI enrichment on all blocks
 *     target_aesthetics?: string[],     // optional for Block 3 (MDA)
 *     total_levels?: number,            // optional for Block 5 (progression)
 *     format?: "one_sheet"|"ten_pager"|"full"  // optional for Block 6 (GDD)
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     project_id: string,
 *     concept_idea: string,
 *     stages: StageResult[],            // 8 entries, one per block stage
 *     stages_completed: number,
 *     stages_total: 8,
 *     latency_ms: number,
 *     completion_percent: number        // project completion after the run
 *   }
 *
 * StageResult = {
 *   stage: string, block_id: number, block_name: string,
 *   status: "completed" | "skipped" | "error",
 *   message: string, http_status?: number, latency_ms?: number
 * }
 *
 * If a non-critical block fails, the pipeline continues with the remaining
 * blocks and reports the error in that stage's status. Block 1 (concept)
 * failure is fatal (returns 500) because downstream blocks depend on it.
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
  /** Build the request body for this stage from the pipeline input. */
  buildBody: (input: PipelineInput) => Record<string, unknown>;
}

interface PipelineInput {
  idea: string;
  genre?: string | null;
  useAi: boolean;
  targetAesthetics: string[];
  totalLevels: number;
  format: string;
}

interface StageResult {
  stage: string;
  block_id: number;
  block_name: string;
  status: "completed" | "skipped" | "error";
  message: string;
  http_status?: number;
  latency_ms?: number;
}

/** The 8 pipeline stages in execution order. */
const STAGES: StageDef[] = [
  {
    stage: "concept",
    block_id: 1,
    endpoint: "/api/v1/concept/generate",
    buildBody: (i) => ({
      idea: i.idea,
      ...(i.genre ? { genre: i.genre } : {}),
      use_ai: i.useAi,
    }),
  },
  {
    stage: "core_loop",
    block_id: 2,
    endpoint: "/api/v1/coreloop/design",
    // Derive mechanics from the idea keywords; blocks 2 accepts a mechanics list.
    buildBody: (i) => ({
      mechanics: deriveMechanicsFromIdea(i.idea),
      use_ai: i.useAi,
    }),
  },
  {
    stage: "mda",
    block_id: 3,
    endpoint: "/api/v1/mda/analyze",
    buildBody: (i) => ({
      target_aesthetics: i.targetAesthetics.length ? i.targetAesthetics : ["challenge"],
      use_ai: i.useAi,
    }),
  },
  {
    stage: "balance",
    block_id: 4,
    endpoint: "/api/v1/balance/analyze",
    // TASK-4.2 FIXED: derive balance objects from genre (was hardcoded 4 RPG objects).
    // Different genres get different object sets appropriate to their balance needs.
    buildBody: (i) => {
      const genre = i.genre || "rpg";
      const objectsByGenre: Record<string, Array<{ id: string; name: string; type: string; attributes: Record<string, number>; cost: number; tier: number }>> = {
        rpg: [
          { id: "weapon_basic", name: "Базовое оружие", type: "weapon", attributes: { power: 30, range: 5, speed: 7 }, cost: 100, tier: 1 },
          { id: "weapon_advanced", name: "Продвинутое оружие", type: "weapon", attributes: { power: 60, range: 8, speed: 5 }, cost: 300, tier: 2 },
          { id: "armor_light", name: "Лёгкая броня", type: "armor", attributes: { defense: 20, mobility: 8 }, cost: 150, tier: 1 },
          { id: "armor_heavy", name: "Тяжёлая броня", type: "armor", attributes: { defense: 50, mobility: 3 }, cost: 400, tier: 3 },
        ],
        shooter: [
          { id: "smg", name: "Пистолет-пуромет", type: "weapon", attributes: { power: 25, range: 3, speed: 9 }, cost: 200, tier: 1 },
          { id: "rifle", name: "Винтовка", type: "weapon", attributes: { power: 50, range: 8, speed: 4 }, cost: 400, tier: 2 },
          { id: "shotgun", name: "Дробовик", type: "weapon", attributes: { power: 70, range: 2, speed: 3 }, cost: 350, tier: 2 },
          { id: "sniper", name: "Снайперская винтовка", type: "weapon", attributes: { power: 90, range: 10, speed: 1 }, cost: 600, tier: 3 },
        ],
        strategy: [
          { id: "infantry", name: "Пехота", type: "unit", attributes: { power: 15, defense: 10, speed: 5 }, cost: 50, tier: 1 },
          { id: "cavalry", name: "Кавалерия", type: "unit", attributes: { power: 30, defense: 8, speed: 9 }, cost: 120, tier: 2 },
          { id: "archer", name: "Лучник", type: "unit", attributes: { power: 25, defense: 5, speed: 3 }, cost: 80, tier: 1 },
          { id: "siege", name: "Осадная машина", type: "unit", attributes: { power: 80, defense: 20, speed: 1 }, cost: 300, tier: 3 },
        ],
        fighting: [
          { id: "grappler", name: "Грэпплер", type: "fighter", attributes: { power: 40, speed: 4, defense: 30 }, cost: 0, tier: 1 },
          { id: "rushdown", name: "Рашдаун", type: "fighter", attributes: { power: 35, speed: 9, defense: 15 }, cost: 0, tier: 1 },
          { id: "zoner", name: "Зонер", type: "fighter", attributes: { power: 25, speed: 6, defense: 20 }, cost: 0, tier: 1 },
          { id: "tank", name: "Танк", type: "fighter", attributes: { power: 30, speed: 2, defense: 50 }, cost: 0, tier: 1 },
        ],
      };
      const objects = objectsByGenre[genre] || objectsByGenre.rpg;
      return {
        objects,
        game_mode: genre === "fighting" ? "pvp" : "pve",
        genre,
        use_ai: i.useAi,
      };
    },
  },
  {
    stage: "progression",
    block_id: 5,
    endpoint: "/api/v1/progression/design",
    buildBody: (i) => ({
      total_levels: i.totalLevels,
      use_ai: i.useAi,
    }),
  },
  {
    stage: "economy",
    block_id: 5,
    endpoint: "/api/v1/economy/design",
    buildBody: (i) => ({
      use_ai: i.useAi,
    }),
  },
  {
    stage: "gdd",
    block_id: 6,
    endpoint: "/api/v1/gdd/generate",
    buildBody: (i) => ({
      format: i.format,
      use_ai: i.useAi,
    }),
  },
  {
    stage: "validation",
    block_id: 6,
    // TASK-6b.16 FIXED: use /checklists/validate (rich impl) instead of /gdd/checklist (was STUB, now also fixed).
    // Both work after TASK-6.6, but /checklists/validate is the canonical endpoint.
    endpoint: "/api/v1/checklists/validate",
    buildBody: () => ({}),
  },
];

/** Heuristic: pick 3 mechanics from the idea text for Block 2. */
function deriveMechanicsFromIdea(idea: string): string[] {
  const text = idea.toLowerCase();
  const candidates = [
    { kw: ["combat", "fight", "shoot", "attack", "battle"], m: "combat" },
    { kw: ["explore", "discover", "map", "world"], m: "explore" },
    { kw: ["collect", "gather", "loot", "farm"], m: "collect" },
    { kw: ["build", "craft", "construct"], m: "build" },
    { kw: ["puzzle", "solve", "logic"], m: "puzzle" },
    { kw: ["race", "speed", "run"], m: "race" },
    { kw: ["survive", "survival", "endure"], m: "survive" },
    { kw: ["trade", "economy", "market"], m: "trade" },
    { kw: ["upgrade", "progress", "level"], m: "upgrade" },
  ];
  const picked = candidates
    .filter((c) => c.kw.some((k) => text.includes(k)))
    .map((c) => c.m);
  // Always return at least 3 mechanics so Block 2 has enough to design a loop.
  const fallback = ["explore", "combat", "reward"];
  const merged = [...new Set([...picked, ...fallback])];
  return merged.slice(0, 4);
}

/** Resolve the internal base URL for same-server fetch. */
function internalBaseUrl(request: NextRequest): string {
  // Prefer the forwarded host (so internal fetch hits the same origin).
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
    const idea = body?.idea?.toString().trim();

    if (!idea) {
      return VALIDATION_ERROR("Поле idea обязательно для запуска пайплайна");
    }

    const snap = await loadProjectPipelineSnapshot(user.id, projectId);
    if (!snap) return NOT_FOUND();

    // Assemble pipeline input with sensible defaults.
    const input: PipelineInput = {
      idea,
      genre: body?.genre ?? null,
      useAi: body?.use_ai === true || body?.use_ai === "true",
      targetAesthetics: Array.isArray(body?.target_aesthetics)
        ? body.target_aesthetics.filter((a: unknown) => typeof a === "string")
        : [],
      totalLevels:
        typeof body?.total_levels === "number" && body.total_levels > 0
          ? body.total_levels
          : 50,
      format:
        body?.format === "ten_pager" || body?.format === "full"
          ? body.format
          : "one_sheet",
    };

    // Sign a short-lived internal access token for the user. The block
    // endpoints authenticate via getCurrentUser(request) which reads the
    // Authorization: Bearer header (or the access_token cookie). Because an
    // internal fetch's manual `cookie` header does NOT populate the
    // next/headers cookies() context of the target route, we use the Bearer
    // header path which is read directly from the request object.
    const internalToken = signAccessToken(user.id, user.email);
    const authHeader = `Bearer ${internalToken}`;
    const baseUrl = internalBaseUrl(request);

    const stages: StageResult[] = [];

    for (const stage of STAGES) {
      const stageStart = Date.now();
      const body = stage.buildBody(input);
      const url = `${baseUrl}${stage.endpoint}`;

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify({ project_id: projectId, ...body }),
          // Don't follow redirects; block endpoints return 200/4xx/5xx directly.
          redirect: "manual",
        });

        const latencyMs = Date.now() - stageStart;

        if (res.ok) {
          stages.push({
            stage: stage.stage,
            block_id: stage.block_id,
            block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
            status: "completed",
            message: `Стадия «${stage.stage}» выполнена — данные сохранены.`,
            http_status: res.status,
            latency_ms: latencyMs,
          });
        } else {
          // Non-OK: try to read the error detail.
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
            block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
            status: res.status === 422 ? "skipped" : "error",
            message: `Стадия «${stage.stage}» ${res.status === 422 ? "пропущена" : "завершилась с ошибкой"}: ${detail}`,
            http_status: res.status,
            latency_ms: latencyMs,
          });

          // Block 1 (concept) is fatal — downstream blocks all depend on it.
          if (stage.block_id === 1) {
            const latencyMsTotal = Date.now() - startedAt;
            return NextResponse.json(
              {
                ok: false,
                project_id: projectId,
                concept_idea: idea,
                stages,
                stages_completed: stages.filter((s) => s.status === "completed").length,
                stages_total: STAGES.length,
                latency_ms: latencyMsTotal,
                error: `Блок 1 (Концепция) не смог выполниться: ${detail}`,
              },
              { status: 500 }
            );
          }
        }
      } catch (err) {
        const latencyMs = Date.now() - stageStart;
        const msg = err instanceof Error ? err.message : String(err);
        stages.push({
          stage: stage.stage,
          block_id: stage.block_id,
          block_name: BLOCK_NAMES[stage.block_id] || `Block ${stage.block_id}`,
          status: "error",
          message: `Сетевая ошибка на стадии «${stage.stage}»: ${msg}`,
          latency_ms: latencyMs,
        });
        // Network error on Block 1 is also fatal.
        if (stage.block_id === 1) {
          return NextResponse.json(
            {
              ok: false,
              project_id: projectId,
              concept_idea: idea,
              stages,
              stages_completed: 0,
              stages_total: STAGES.length,
              latency_ms: Date.now() - startedAt,
              error: `Блок 1 (Концепция) недоступен: ${msg}`,
            },
            { status: 500 }
          );
        }
      }
    }

    // Reload snapshot to compute the final completion percent.
    const finalSnap = await loadProjectPipelineSnapshot(user.id, projectId);
    const latencyMs = Date.now() - startedAt;
    const completedCount = stages.filter((s) => s.status === "completed").length;

    // Bump project version to reflect the pipeline run.
    await db.project
      .update({
        where: { id: projectId },
        data: { version: { increment: 1 } },
      })
      .catch(() => {
        /* version increment is best-effort */
      });

    return NextResponse.json({
      ok: true,
      project_id: projectId,
      concept_idea: idea,
      stages,
      stages_completed: completedCount,
      stages_total: STAGES.length,
      latency_ms: latencyMs,
      completion_percent: finalSnap?.completionPercent ?? 0,
      note:
        completedCount === STAGES.length
          ? "Все 8 стадий выполнены успешно. Данные сохранены в БД."
          : `Пайплайн завершён с ${completedCount}/${STAGES.length} успешных стадий. См. stages[].status для деталей.`,
    });
  } catch (error) {
    console.error("[pipeline/run-full-pipeline] error:", error);
    return SERVER_ERROR();
  }
}
