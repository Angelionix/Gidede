/**
 * R-PROTO-DATA: extract prototype params from upstream pipeline artifacts.
 *
 * Before this module, /prototypes/generate used only CoreLoop data and
 * hardcoded defaults (playerSpeed=150, enemyDamage=10, threshold=50, etc.).
 * Every engine prototype was identical regardless of project's Balance,
 * Progression, or Economy stages.
 *
 * Now the route reads Balance/Progression/Economy artifacts and derives
 * concrete prototype parameters from them. This makes prototypes
 * meaningfully different across projects.
 *
 * All extraction is defensive: missing/malformed artifacts fall back to
 * sensible defaults — the prototype always generates.
 */

import { safeJsonParse } from "@/lib/api-helpers";
import type { PrototypeParams } from "./prototype-graph-builder";

// ============================================================
// Types — mirror Prisma model shapes (only fields we read)
// ============================================================

interface BalanceRecord {
  overallBalanceScore?: number | null;
  elementCount?: number | null;
  fullResult?: string | null;
}

interface ProgressionRecord {
  totalLevels?: number | null;
  tierCount?: number | null;
  curveType?: string | null;
  fullProfile?: string | null;
}

interface EconomyRecord {
  resourceCount?: number | null;
  hasPathology?: boolean | null;
  resourceModel?: string | null;
  fullProfile?: string | null;
}

interface ConceptRecord {
  aestheticProfile?: string | null;
  mechanicSet?: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  genre: string | null;
  description: string | null;
  concept?: ConceptRecord | null;
  balanceResult?: BalanceRecord | null;
  progression?: ProgressionRecord | null;
  economy?: EconomyRecord | null;
}

// ============================================================
// Helpers
// ============================================================

function pickNumber(
  ...candidates: Array<number | null | undefined>
): number | undefined {
  for (const c of candidates) {
    if (typeof c === "number" && isFinite(c) && c > 0) return c;
  }
  return undefined;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ============================================================
// Per-artifact extractors
// ============================================================

interface BalanceDerivedParams {
  playerSpeed?: number;
  enemyDamage?: number;
  enemySpeed?: number;
  collectibleValue?: number;
}

/**
 * Derive prototype combat params from Balance stage output.
 *
 * Strategy:
 *   - Parse `fullResult` JSON to find the first 2-4 balance objects.
 *   - Average their `attributes.power` for enemy damage baseline.
 *   - Average their `attributes.speed`/`mobility` for enemy speed.
 *   - Player speed = 1.5x average enemy speed (player should feel faster).
 *   - Collectible value = ceil(average object cost / 50) clamped to [1, 10].
 *
 * If Balance hasn't run or has <2 objects, returns {} (caller uses defaults).
 */
function extractBalanceParams(balance: BalanceRecord | null | undefined): BalanceDerivedParams {
  if (!balance) return {};

  const fullResult = safeJsonParse<Record<string, unknown>>(balance.fullResult, {});
  // Balance route returns objects either as `result.objects` (older) or
  // at top level under different keys depending on the stage version.
  const objects = extractObjects(fullResult);
  if (objects.length < 2) return {};

  let powerSum = 0;
  let powerCount = 0;
  let speedSum = 0;
  let speedCount = 0;
  let costSum = 0;

  for (const obj of objects) {
    const attrs = (obj.attributes ?? {}) as Record<string, unknown>;
    const power = pickNumber(
      attrs.power as number | undefined,
      attrs.damage as number | undefined,
      attrs.attack as number | undefined,
    );
    if (power !== undefined) {
      powerSum += power;
      powerCount += 1;
    }
    const speed = pickNumber(
      attrs.speed as number | undefined,
      attrs.mobility as number | undefined,
    );
    if (speed !== undefined) {
      speedSum += speed;
      speedCount += 1;
    }
    const cost = pickNumber(obj.cost as number | undefined);
    if (cost !== undefined) costSum += cost;
  }

  const result: BalanceDerivedParams = {};

  if (powerCount > 0) {
    // Average enemy damage: scale down so it's reasonable per-frame.
    // Balance `power` is typically 20-90; we want enemy.damage 5-30.
    const avgPower = powerSum / powerCount;
    result.enemyDamage = clamp(Math.round(avgPower / 3), 5, 30);
  }

  if (speedCount > 0) {
    const avgSpeed = speedSum / speedCount;
    result.enemySpeed = clamp(Math.round(avgSpeed * 8), 40, 150);
    // Player is ~1.5x faster than enemies.
    result.playerSpeed = clamp(Math.round(avgSpeed * 12), 120, 280);
  }

  if (costSum > 0) {
    const avgCost = costSum / objects.length;
    result.collectibleValue = clamp(Math.ceil(avgCost / 50), 1, 10);
  }

  return result;
}

interface BalanceObject {
  attributes?: Record<string, unknown>;
  cost?: number | null;
}

function extractObjects(fullResult: Record<string, unknown>): BalanceObject[] {
  // Try several known shapes.
  if (Array.isArray(fullResult.objects)) return fullResult.objects as BalanceObject[];
  if (Array.isArray(fullResult.balanceObjects)) return fullResult.balanceObjects as BalanceObject[];
  const result = fullResult.result;
  if (result && typeof result === "object" && Array.isArray((result as Record<string, unknown>).objects)) {
    return (result as Record<string, unknown>).objects as BalanceObject[];
  }
  return [];
}

interface ProgressionDerivedParams {
  targetLevel?: number;
  counterThreshold?: number;
}

/**
 * Derive progression params from Progression stage output.
 *
 * Strategy:
 *   - counterThreshold = min(totalLevels, 20) — capped so prototypes stay short.
 *   - targetLevel = totalLevels (informational, used for messages).
 *
 * Falls back to {} when progression is absent.
 */
function extractProgressionParams(
  progression: ProgressionRecord | null | undefined,
): ProgressionDerivedParams {
  if (!progression) return {};
  const totalLevels = pickNumber(progression.totalLevels);
  if (totalLevels === undefined) return {};
  return {
    targetLevel: totalLevels,
    counterThreshold: clamp(totalLevels, 3, 20),
  };
}

interface EconomyDerivedParams {
  resourceName?: string;
  resourceIcon?: string;
}

const RESOURCE_ICON_BY_NAME: Record<string, string> = {
  gold: "💰",
  золото: "💰",
  xp: "⭐",
  опыт: "⭐",
  score: "🎯",
  очки: "🎯",
  hp: "❤️",
  здоровье: "❤️",
  gems: "💎",
  кристаллы: "💎",
  energy: "⚡",
  энергия: "⚡",
  mana: "🔮",
  мана: "🔮",
  wood: "🪵",
  дерево: "🪵",
  food: "🍞",
  еда: "🍞",
};

/**
 * Derive resource name/icon from Economy stage output.
 *
 * Strategy:
 *   - Parse `resourceModel` JSON to find the anchor resource (first core
 *     resource in the inventory).
 *   - Map common resource names to emoji icons.
 */
function extractEconomyParams(
  economy: EconomyRecord | null | undefined,
): EconomyDerivedParams {
  if (!economy) return {};
  const resourceModel = safeJsonParse<Record<string, unknown>>(economy.resourceModel, {});
  const resources = (resourceModel.resources ?? []) as Array<{ name?: string }>;
  if (!Array.isArray(resources) || resources.length === 0) return {};

  // Anchor = first resource with role "core" or just the first one.
  const anchor = resources.find((r) => (r as { role?: string }).role === "core") ?? resources[0];
  const name = (anchor as { name?: string }).name;
  if (!name) return {};

  const lowerName = name.toLowerCase();
  const icon = RESOURCE_ICON_BY_NAME[lowerName] ?? "✨";

  return { resourceName: name, resourceIcon: icon };
}

// ============================================================
// Public API
// ============================================================

/**
 * Build PrototypeParams from a project's upstream artifacts.
 * Returns {} when no artifacts are available (caller uses builder defaults).
 *
 * Usage:
 *   const params = extractPrototypeParams(project);
 *   const graph = buildPrototypeGraph({ type, mode, steps, params });
 */
export function extractPrototypeParams(project: ProjectRecord): PrototypeParams {
  const balance = extractBalanceParams(project.balanceResult);
  const progression = extractProgressionParams(project.progression);
  const economy = extractEconomyParams(project.economy);

  // Type-specific tuning.
  const params: PrototypeParams = {
    playerSpeed: balance.playerSpeed,
    enemyDamage: balance.enemyDamage,
    enemySpeed: balance.enemySpeed,
    collectibleValue: balance.collectibleValue,
    targetLevel: progression.targetLevel,
    counterThreshold: progression.counterThreshold,
    resourceName: economy.resourceName,
    resourceIcon: economy.resourceIcon,
  };

  // Strip undefined values for cleaner downstream logging.
  const clean: PrototypeParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) (clean as Record<string, unknown>)[k] = v;
  }
  return clean;
}

/**
 * Determine the prototype type from project data.
 * Order of preference:
 *   1. typeOverride (from request body)
 *   2. coreLoop.structuralType (lowercased, validated against supported types)
 *   3. genre-based heuristic (rpg → engine, puzzle → puzzle, etc.)
 *   4. "engine" (default)
 */
export function resolvePrototypeType(
  typeOverride: string | null,
  structuralType: string | null | undefined,
  genre: string | null | undefined,
): PrototypeType {
  const supported: PrototypeType[] = [
    "engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle",
    "platformer", "stealth", "deck_builder", "survival_horror",
  ];

  // 1. Explicit override.
  if (typeOverride) {
    const lower = typeOverride.toLowerCase();
    if (supported.includes(lower as PrototypeType)) return lower as PrototypeType;
  }

  // 2. From Core Loop structural type.
  if (structuralType) {
    const lower = structuralType.toLowerCase();
    if (supported.includes(lower as PrototypeType)) return lower as PrototypeType;
  }

  // 3. Genre-based heuristic.
  if (genre) {
    const g = genre.toLowerCase().replace(/\s+/g, "_");
    const genreMap: Record<string, PrototypeType> = {
      rpg: "engine",
      shooter: "ecology",
      strategy: "tower_defense",
      tower_defense: "tower_defense",
      puzzle: "puzzle",
      rhythm: "rhythm",
      platformer: "platformer",
      metroidvania: "platformer",
      roguelike: "deck_builder",
      sandbox: "economy",
      horror: "survival_horror",
      survival_horror: "survival_horror",
      racing: "rhythm", // racing ≈ rhythm in terms of timing-based input
      card: "deck_builder",
      mmorpg: "ecology",
    };
    if (genreMap[g]) return genreMap[g];
  }

  // 4. Default.
  return "engine";
}

// Re-export the type for callers.
import type { PrototypeType } from "./prototype-graph-builder";
