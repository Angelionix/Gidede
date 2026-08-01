/**
 * Gidede — Balance object builder from MDA/Core domain model (R5-02).
 *
 * Before R5-02, the pipeline runner built Balance objects by hashing mechanic
 * NAMES to synthesize random `power`/`speed`/`utility` attributes. Two
 * mechanics with the same name produced the same attributes regardless of
 * their semantic role, and the attributes had no relationship to the MDA
 * mechanic set's structure.
 *
 * R5-02 introduces `buildBalanceObjectsFromDomain(mechanicSet, options)`
 * which derives Balance objects from the MDA mechanic set's 5 categories:
 *   - combat mechanics  → type="weapon", attributes {power, speed}
 *   - survivability     → type="armor",  attributes {defense, mobility}
 *   - progression       → type="upgrade", attributes {power, utility}
 *   - spatial           → type="unit",   attributes {power, speed, range}
 *   - social            → type="support", attributes {utility, mobility}
 *
 * Attributes are derived from the mechanic's category and a deterministic
 * hash of its name (so the same mechanic always produces the same attributes,
 * but different mechanics produce different attributes). Cost and tier are
 * derived from category importance.
 *
 * The pipeline runner now uses this builder when an MDA mechanic_set is
 * available, falling back to the legacy hash-based builder only when MDA
 * has not yet run.
 */

import type { MechanicRef } from "@/lib/mechanic-ref";

export interface MdaMechanicSet {
  base: Array<{ mechanic_name: string }>;
  combat: Array<{ mechanic_name: string }>;
  progression: Array<{ mechanic_name: string }>;
  spatial: Array<{ mechanic_name: string }>;
  social: Array<{ mechanic_name: string }>;
}

export interface BalanceObject {
  id: string;
  name: string;
  type: string;
  attributes: Record<string, number>;
  cost: number;
  tier: number;
  /** Provenance: where this object came from. */
  source: "mda_domain" | "legacy_hash";
  /** The mechanic category this object was derived from. */
  derived_from_category?: string;
}

/** Category → object type + attribute schema mapping. */
const CATEGORY_TO_OBJECT_SPEC: Record<
  string,
  { type: string; attributes: string[]; costBase: number; tierBase: number }
> = {
  combat: {
    type: "weapon",
    attributes: ["power", "speed"],
    costBase: 200,
    tierBase: 2,
  },
  base: {
    // Survivability-oriented base mechanics (armor, inventory, etc.)
    type: "armor",
    attributes: ["defense", "mobility"],
    costBase: 150,
    tierBase: 1,
  },
  progression: {
    type: "upgrade",
    attributes: ["power", "utility"],
    costBase: 300,
    tierBase: 2,
  },
  spatial: {
    type: "unit",
    attributes: ["power", "speed", "range"],
    costBase: 120,
    tierBase: 1,
  },
  social: {
    type: "support",
    attributes: ["utility", "mobility"],
    costBase: 180,
    tierBase: 1,
  },
};

/** FNV-1a hash for deterministic attribute derivation. */
function hashText(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Build Balance objects from an MDA mechanic set's 5 categories.
 * Each mechanic becomes a Balance object with attributes derived from its
 * category's schema and a deterministic hash of its name.
 *
 * @param mechanicSet  The MDA structured mechanic set (5 categories).
 * @param refs         Optional MechanicRef[] for stable ids (R4-07).
 * @param maxObjects   Max objects to return (default 8, Balance contract max).
 * @returns BalanceObject[] with source="mda_domain".
 */
export function buildBalanceObjectsFromDomain(
  mechanicSet: MdaMechanicSet | null | undefined,
  refs?: MechanicRef[],
  maxObjects = 8,
): BalanceObject[] {
  if (!mechanicSet) return [];

  // Build a name→ref map for stable ids.
  const refByName = new Map<string, MechanicRef>();
  for (const ref of refs ?? []) {
    refByName.set(ref.name, ref);
  }

  const objects: BalanceObject[] = [];
  // Iterate categories in priority order: combat, progression, base, spatial, social.
  const categoryOrder: Array<keyof MdaMechanicSet> = ["combat", "progression", "base", "spatial", "social"];
  for (const category of categoryOrder) {
    const mechanics = mechanicSet[category];
    if (!Array.isArray(mechanics)) continue;
    const spec = CATEGORY_TO_OBJECT_SPEC[category];
    if (!spec) continue;

    for (const m of mechanics) {
      if (objects.length >= maxObjects) break;
      const name = m.mechanic_name;
      if (!name || typeof name !== "string") continue;

      const hash = hashText(name);
      const attributes: Record<string, number> = {};
      for (const attrName of spec.attributes) {
        // Derive attribute value from hash, scaled per attribute type.
        if (attrName === "power") {
          attributes.power = 20 + (hash % 71); // 20-90
        } else if (attrName === "defense") {
          attributes.defense = 15 + ((hash >>> 4) % 56); // 15-70
        } else if (attrName === "speed") {
          attributes.speed = 1 + ((hash >>> 8) % 10); // 1-10
        } else if (attrName === "range") {
          attributes.range = 2 + ((hash >>> 12) % 9); // 2-10
        } else if (attrName === "mobility") {
          attributes.mobility = 1 + ((hash >>> 16) % 10); // 1-10
        } else if (attrName === "utility") {
          attributes.utility = 10 + ((hash >>> 20) % 51); // 10-60
        } else {
          attributes[attrName] = 10 + (hash % 41);
        }
      }

      const ref = refByName.get(name);
      const tier = spec.tierBase + (objects.length % 2); // alternate tiers
      const cost = spec.costBase + (hash % 200);

      objects.push({
        id: ref?.id ?? `mechanic_${objects.length + 1}`,
        name,
        type: spec.type,
        attributes,
        cost,
        tier,
        source: "mda_domain",
        derived_from_category: category,
      });
    }
    if (objects.length >= maxObjects) break;
  }

  return objects;
}

/**
 * Legacy fallback: build Balance objects by hashing mechanic names directly.
 * Used only when MDA has not yet run (no mechanic_set available).
 *
 * Kept for backward compatibility with the pre-R5-02 pipeline behavior.
 */
export function buildBalanceObjectsLegacy(
  mechanics: string[],
  refs?: MechanicRef[],
  maxObjects = 8,
): BalanceObject[] {
  const source = mechanics.length >= 2 ? mechanics : [...mechanics, "secondary mechanic"];
  return source.slice(0, maxObjects).map((name, index) => {
    const hash = hashText(name);
    const ref = refs?.[index];
    return {
      id: ref?.id ?? `mechanic_${index + 1}`,
      name,
      type: "mechanic",
      attributes: {
        power: 20 + (hash % 61),
        speed: 1 + ((hash >>> 8) % 10),
        utility: 10 + ((hash >>> 16) % 51),
      },
      cost: 50 + (hash % 451),
      tier: 1 + (index % 3),
      source: "legacy_hash",
    };
  });
}

/**
 * Decide whether to use the domain-based builder or the legacy fallback.
 * Returns domain-built objects when an MDA mechanic_set is available and
 * non-empty; otherwise returns legacy-hash objects.
 */
export function buildBalanceObjects(
  mechanicSet: MdaMechanicSet | null | undefined,
  mechanics: string[],
  refs?: MechanicRef[],
  maxObjects = 8,
): BalanceObject[] {
  const domain = buildBalanceObjectsFromDomain(mechanicSet, refs, maxObjects);
  if (domain.length >= 2) return domain;
  return buildBalanceObjectsLegacy(mechanics, refs, maxObjects);
}
