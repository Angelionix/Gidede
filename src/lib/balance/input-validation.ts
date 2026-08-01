/**
 * Gidede — Balance input validation (Block 4, roadmap R5-03).
 *
 * Before R5-03, the Balance route's input validation only checked object count
 * (2-100) and name presence. The comment claimed "unique IDs, numeric
 * attributes" but no actual validation was performed — NaN, Infinity, string
 * attribute values and duplicate IDs all passed through silently, corrupting
 * downstream transitive/intransitive/Monte Carlo analysis.
 *
 * R5-03 introduces strict validation that returns 422 for:
 *   - Non-finite attribute values (NaN, Infinity, -Infinity).
 *   - Non-number attribute values (strings, booleans, objects).
 *   - Empty attributes record (at least one attribute required).
 *   - Duplicate object IDs (after auto-id assignment).
 *   - Duplicate object names (ambiguous for downstream name-based lookups).
 */

export interface BalanceObjectInput {
  id?: string;
  name: string;
  type?: string;
  attributes: Record<string, unknown>;
  cost?: unknown;
  tier?: unknown;
  tags?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  /** Detailed list of invalid attributes (for debugging). */
  invalidAttributes?: Array<{ objectIndex: number; objectName: string; attr: string; value: unknown }>;
  /** Detailed list of duplicate IDs (for debugging). */
  duplicateIds?: string[];
}

/**
 * Validate that all attribute values across all objects are finite numbers.
 * Returns the list of invalid (objectIndex, objectName, attr, value) tuples;
 * empty when all are valid.
 */
export function findInvalidAttributeValues(
  objects: BalanceObjectInput[],
): Array<{ objectIndex: number; objectName: string; attr: string; value: unknown }> {
  const invalid: Array<{ objectIndex: number; objectName: string; attr: string; value: unknown }> = [];
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    const attrs = obj.attributes ?? {};
    for (const [attr, value] of Object.entries(attrs)) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        invalid.push({
          objectIndex: i,
          objectName: obj.name ?? `Object ${i + 1}`,
          attr,
          value,
        });
      }
    }
  }
  return invalid;
}

/**
 * Detect duplicate object IDs. Objects without an explicit `id` are assigned
 * `obj_N` (1-indexed) before comparison, matching the route's auto-id logic.
 */
export function findDuplicateIds(objects: BalanceObjectInput[]): string[] {
  const ids = objects.map((o, i) => String(o.id ?? `obj_${i + 1}`));
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    else seen.add(id);
  }
  return Array.from(duplicates);
}

/**
 * Detect duplicate object names (case-insensitive after trim).
 */
export function findDuplicateNames(objects: BalanceObjectInput[]): string[] {
  const names = objects.map((o) => (o.name ?? "").trim().toLowerCase());
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    if (seen.has(name)) duplicates.add(name);
    else seen.add(name);
  }
  return Array.from(duplicates);
}

/**
 * Detect objects with empty attributes records (no attributes at all).
 */
export function findEmptyAttributes(objects: BalanceObjectInput[]): number[] {
  const empty: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    const attrs = objects[i].attributes ?? {};
    if (Object.keys(attrs).length === 0) empty.push(i);
  }
  return empty;
}

/**
 * Comprehensive Balance objects validation. Returns a ValidationResult with
 * `valid: false` and a descriptive error when any check fails.
 *
 * Checks (in order):
 *   1. At least 2 objects.
 *   2. At most 100 objects.
 *   3. All objects have a non-empty name.
 *   4. All attribute values are finite numbers.
 *   5. No empty attributes records.
 *   6. No duplicate IDs.
 *   7. No duplicate names.
 */
export function validateBalanceObjects(objects: BalanceObjectInput[]): ValidationResult {
  if (!Array.isArray(objects) || objects.length < 2) {
    return {
      valid: false,
      error: "Поле 'objects' обязательно и должно содержать минимум 2 объекта",
    };
  }
  if (objects.length > 100) {
    return {
      valid: false,
      error: `Слишком много объектов: ${objects.length}. Максимум 100.`,
    };
  }

  // Check names.
  for (let i = 0; i < objects.length; i++) {
    const name = objects[i].name;
    if (!name || typeof name !== "string" || !name.trim()) {
      return {
        valid: false,
        error: `Объект ${i + 1} не имеет name (обязательное поле)`,
      };
    }
  }

  // Check empty attributes.
  const emptyIndices = findEmptyAttributes(objects);
  if (emptyIndices.length > 0) {
    const names = emptyIndices.map((i) => objects[i].name).join(", ");
    return {
      valid: false,
      error: `Объекты без attributes: ${names}. Каждый объект должен иметь хотя бы один атрибут.`,
    };
  }

  // Check finite numeric attributes.
  const invalidAttrs = findInvalidAttributeValues(objects);
  if (invalidAttrs.length > 0) {
    const first = invalidAttrs[0];
    const valueDesc = typeof first.value === "number"
      ? (Number.isNaN(first.value) ? "NaN" : "Infinity")
      : `тип ${typeof first.value}`;
    return {
      valid: false,
      error: `Объект "${first.objectName}" имеет невалидный атрибут "${first.attr}" (${valueDesc}). Все атрибуты должны быть конечными числами (finite numbers).`,
      invalidAttributes: invalidAttrs,
    };
  }

  // Check duplicate IDs.
  const duplicateIds = findDuplicateIds(objects);
  if (duplicateIds.length > 0) {
    return {
      valid: false,
      error: `Дубликаты ID объектов: ${duplicateIds.join(", ")}. Все ID должны быть уникальными.`,
      duplicateIds,
    };
  }

  // Check duplicate names.
  const duplicateNames = findDuplicateNames(objects);
  if (duplicateNames.length > 0) {
    return {
      valid: false,
      error: `Дубликаты имён объектов: ${duplicateNames.join(", ")}. Все имена должны быть уникальными (case-insensitive).`,
    };
  }

  return { valid: true };
}
