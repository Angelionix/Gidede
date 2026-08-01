/**
 * Gidede — Simulation seed for Balance (Block 4, roadmap R5-06).
 *
 * Before R5-06, the Monte Carlo seed was `hashString(proj.id)` — dependent
 * ONLY on the project ID. Re-running the same project with DIFFERENT objects
 * (e.g. a rebalancing iteration) produced the identical RNG sequence, making
 * it impossible to distinguish genuine balance changes from RNG artifacts.
 *
 * R5-06 introduces `computeBalanceSeed(projectId, objects, simVersion)`:
 *   - Incorporates the canonical input (objects' names + attributes + costs)
 *     into the seed, so changing objects changes the seed.
 *   - Includes a `simVersion` tag so the simulation version is explicit.
 *   - Same projectId + same objects → same seed (reproducible).
 *   - Same projectId + different objects → different seed.
 */

export interface BalanceObjectForSeed {
  name: string;
  attributes?: Record<string, number>;
  cost?: number;
  tier?: number;
}

/** FNV-1a string hash (deterministic, 32-bit unsigned). */
export function hashString(s: string): number {
  let hash = 2166136261;
  for (let index = 0; index < s.length; index += 1) {
    hash ^= s.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Canonicalize objects into a stable string representation for seeding.
 * Only includes fields that affect the simulation outcome: name, attributes,
 * cost, tier. Object order is preserved (the caller controls it).
 */
function canonicalizeObjects(objects: BalanceObjectForSeed[]): string {
  return objects.map((o) => {
    const attrs = o.attributes ?? {};
    const attrStr = Object.keys(attrs)
      .sort()
      .map((k) => `${k}:${attrs[k]}`)
      .join(",");
    return `${o.name}|${attrStr}|cost:${o.cost ?? 0}|tier:${o.tier ?? 1}`;
  }).join("||");
}

/**
 * Compute a deterministic Balance simulation seed that incorporates:
 *   - the project ID
 *   - the canonical input (objects' names, attributes, costs, tiers)
 *   - the simulation version tag
 *
 * Properties:
 *   - Same projectId + same objects + same simVersion → same seed (reproducible).
 *   - Same projectId + different objects → different seed.
 *   - Different projectId + same objects → different seed.
 *
 * @param projectId   The project ID.
 * @param objects     The Balance objects being analysed.
 * @param simVersion  Simulation version tag (default "balance-mc-v1").
 * @returns 32-bit unsigned integer seed for mulberry32 PRNG.
 */
export function computeBalanceSeed(
  projectId: string,
  objects: BalanceObjectForSeed[],
  simVersion = "balance-mc-v1",
): number {
  const canonical = canonicalizeObjects(objects);
  const seedString = `${projectId}::${simVersion}::${canonical}`;
  return hashString(seedString);
}
