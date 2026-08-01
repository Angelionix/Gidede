/**
 * Gidede — Typed attribute units for Balance (Block 4, roadmap R5-01).
 *
 * Before R5-01, the Balance transitive analysis summed attributes with
 * different units (e.g. `power: 30`, `range: 5`, `speed: 7`) using only
 * name-based weights. This silently mixed incomparable scales — an object
 * with `power: 30, range: 5` and another with `power: 30, range: 50` got
 * similar weighted-power scores even though their `range` units mean
 * completely different things (meters vs. abstract rating).
 *
 * R5-01 introduces:
 *   - An `AttributeUnit` type tagging each attribute with its unit kind.
 *   - `classifyAttributeUnit(name)` — heuristic mapping from attribute name
 *     to a canonical unit (combat_power, survivability, mobility, utility).
 *   - `normalizeAttributes(attrs)` — normalizes each attribute to [0, 1]
 *     within its unit group ACROSS the object set, so incomparable units
 *     are never silently summed at different scales.
 *   - `computeUnitAwarePower(attrs, weights, normalization)` — computes a
 *     weighted power score from normalized attributes, with weights aligned
 *     to unit groups.
 *
 * The pipeline runner's hardcoded per-genre object sets (rpg, shooter, etc.)
 * use attributes like `power`, `range`, `speed`, `defense`, `mobility` — all
 * of which are now classified and normalized before any summation.
 */

export type AttributeUnit =
  | "combat_power"   // power, damage, attack, dps — offensive output
  | "survivability"  // defense, hp, health, armor, shield — damage mitigation
  | "mobility"       // speed, range, mobility, velocity — spatial/temporal
  | "utility"        // everything else — abstract rating
  | "unknown";

export interface AttributeClassification {
  name: string;
  unit: AttributeUnit;
  /** Default weight for this unit group (used when no explicit weights given). */
  defaultWeight: number;
}

/** Default weight per unit group (Bible 5.5.3 importance heuristic). */
export const UNIT_DEFAULT_WEIGHTS: Record<AttributeUnit, number> = {
  combat_power: 3,
  survivability: 2.5,
  mobility: 1.5,
  utility: 1,
  unknown: 1,
};

/**
 * Classify an attribute name into a canonical unit group.
 * Uses case-insensitive keyword matching.
 */
export function classifyAttributeUnit(name: string): AttributeClassification {
  const lower = name.toLowerCase();
  let unit: AttributeUnit;
  if (/power|damage|attack|dps/.test(lower)) unit = "combat_power";
  else if (/defen|hp|health|armor|shield/.test(lower)) unit = "survivability";
  else if (/speed|range|mobility|velocity/.test(lower)) unit = "mobility";
  else if (/utility|crit|cooldown|mana|energy/.test(lower)) unit = "utility";
  else unit = "unknown";
  return {
    name,
    unit,
    defaultWeight: UNIT_DEFAULT_WEIGHTS[unit],
  };
}

/**
 * Group attributes by unit and normalize each to [0, 1] within its group
 * across the object set. Incomparable units (e.g. `power` and `range`) are
 * normalized separately so they cannot be silently summed at different scales.
 *
 * Normalization strategy per unit group:
 *   - min-max: (value - min) / (max - min), with a 0.01 floor to avoid
 *     division by zero when all values are equal.
 *   - when the group has a single object, all values map to 0.5 (neutral).
 *
 * @param objectsAttrs  Array of attribute records, one per object.
 * @returns Per-object normalized attribute records (same keys, values in [0,1]).
 */
export function normalizeAttributes(
  objectsAttrs: Array<Record<string, number>>,
): Array<Record<string, number>> {
  if (objectsAttrs.length === 0) return [];

  // Collect all attribute names and classify them.
  const allAttrNames = new Set<string>();
  for (const attrs of objectsAttrs) {
    for (const k of Object.keys(attrs)) allAttrNames.add(k);
  }
  const classifications = new Map<string, AttributeClassification>();
  for (const name of allAttrNames) {
    classifications.set(name, classifyAttributeUnit(name));
  }

  // Group attribute names by unit.
  const byUnit = new Map<AttributeUnit, string[]>();
  for (const [name, cls] of classifications) {
    const list = byUnit.get(cls.unit) ?? [];
    list.push(name);
    byUnit.set(cls.unit, list);
  }

  // For each unit group, compute min/max across all objects.
  const minMaxByAttr = new Map<string, { min: number; max: number }>();
  for (const [, attrNames] of byUnit) {
    for (const name of attrNames) {
      const values = objectsAttrs
        .map((a) => a[name])
        .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
      if (values.length === 0) {
        minMaxByAttr.set(name, { min: 0, max: 1 });
        continue;
      }
      const min = Math.min(...values);
      const max = Math.max(...values);
      minMaxByAttr.set(name, { min, max });
    }
  }

  // Normalize each object's attributes.
  return objectsAttrs.map((attrs) => {
    const normalized: Record<string, number> = {};
    for (const [name, value] of Object.entries(attrs)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        normalized[name] = 0;
        continue;
      }
      const { min, max } = minMaxByAttr.get(name) ?? { min: 0, max: 1 };
      const range = max - min;
      if (range < 0.01) {
        // All values equal (or single object) → neutral 0.5.
        normalized[name] = 0.5;
      } else {
        normalized[name] = Number(((value - min) / range).toFixed(4));
      }
    }
    return normalized;
  });
}

/**
 * Compute unit-aware weights for the attribute set.
 * Weights are normalised to sum to 1 within each unit group, then unit groups
 * are combined with their default group weights (combat_power > survivability
 * > mobility > utility). This ensures attributes of the same unit contribute
 * equally, while more important unit groups get higher aggregate weight.
 *
 * @param attrNames  All attribute names present in the object set.
 * @returns Weights per attribute name, summing to 1 across all attributes.
 */
export function computeUnitAwareWeights(attrNames: string[]): Record<string, number> {
  if (attrNames.length === 0) return {};
  const classifications = attrNames.map((n) => classifyAttributeUnit(n));

  // Group by unit.
  const byUnit = new Map<AttributeUnit, string[]>();
  for (let i = 0; i < attrNames.length; i++) {
    const name = attrNames[i];
    const unit = classifications[i].unit;
    const list = byUnit.get(unit) ?? [];
    list.push(name);
    byUnit.set(unit, list);
  }

  // Within each unit, equal weight; across units, default group weight.
  const weights: Record<string, number> = {};
  const totalUnitWeight = Array.from(byUnit.keys())
    .reduce((s, unit) => s + UNIT_DEFAULT_WEIGHTS[unit], 0);
  for (const [unit, names] of byUnit) {
    const groupWeight = UNIT_DEFAULT_WEIGHTS[unit] / totalUnitWeight;
    const perAttr = groupWeight / names.length;
    for (const name of names) {
      weights[name] = Number(perAttr.toFixed(4));
    }
  }
  return weights;
}

/**
 * Compute a unit-aware power score for a single object.
 *
 * @param attrs          The object's raw attributes (e.g. {power: 30, range: 5}).
 * @param weights        Unit-aware weights (from computeUnitAwareWeights).
 * @param normalizedAttrs  The object's normalized attributes (from normalizeAttributes).
 * @returns Weighted power score in [0, 1].
 */
export function computeUnitAwarePower(
  _attrs: Record<string, number>,
  weights: Record<string, number>,
  normalizedAttrs: Record<string, number>,
): number {
  let power = 0;
  for (const [name, normValue] of Object.entries(normalizedAttrs)) {
    const w = weights[name] ?? 0;
    power += normValue * w;
  }
  return Number(power.toFixed(4));
}

/**
 * Validate that all attributes across an object set are finite numbers.
 * Returns the list of invalid (objectIndex, attrName, value) tuples; empty
 * when all are valid.
 */
export function findInvalidAttributes(
  objectsAttrs: Array<Record<string, unknown>>,
): Array<{ objectIndex: number; attr: string; value: unknown }> {
  const invalid: Array<{ objectIndex: number; attr: string; value: unknown }> = [];
  for (let i = 0; i < objectsAttrs.length; i++) {
    const attrs = objectsAttrs[i];
    for (const [name, value] of Object.entries(attrs)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        invalid.push({ objectIndex: i, attr: name, value });
      }
    }
  }
  return invalid;
}
