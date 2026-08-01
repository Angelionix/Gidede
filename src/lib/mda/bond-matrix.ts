/**
 * Gidede — Bond matrix from artifact evidence (Block 3, roadmap R4-10).
 *
 * Replaces the 100% hardcoded Bond matrix contents and always-empty
 * dissonances with real artifact-derived cells and concrete dissonance
 * detection.
 *
 * Before R4-10:
 *   - All 12 cells were hardcoded Russian strings (except "Эстетика →
 *     Фиксированный" which used aesthetics.primary).
 *   - row/col consistency scores were degenerate transforms of
 *     compatibility_score (always in [0.65, 0.9]).
 *   - dissonances: [] was always empty — the matrix could NEVER flag
 *     dissonance.
 *
 * After R4-10:
 *   - Matrix cells are filled from real artifact data: mechanic names from
 *     the mechanic_set, USP from concept, predicted aesthetics, platform info.
 *   - Dissonances are detected from concrete incompatible pairs (e.g.
 *     "submission" aesthetic with combat-heavy mechanics, "horror" genre
 *     with "fellowship" aesthetic, VR platform with party mechanics).
 *   - Row/column consistency scores reflect actual dissonance count, not a
 *     compatibility transform.
 */

export interface BondMechanicSet {
  base: Array<{ mechanic_name: string }>;
  combat: Array<{ mechanic_name: string }>;
  progression: Array<{ mechanic_name: string }>;
  spatial: Array<{ mechanic_name: string }>;
  social: Array<{ mechanic_name: string }>;
}

export interface BondAesthetics {
  primary: string;
  secondary: string;
  tertiary: string;
}

export interface BondArtifactEvidence {
  mechanicSet: BondMechanicSet;
  aesthetics: BondAesthetics;
  /** Concept's USP (used for История → Фиксированный). */
  usp?: string;
  /** Concept's genre (used for cultural-level cells). */
  genre?: string;
  /** Target platforms (used for Технология → Фиксированный). */
  platforms?: string[];
  /** Predicted aesthetics from Classic MDA (used for Эстетика → Динамический). */
  predictedAesthetics?: Record<string, number>;
}

export interface BondDissonance {
  element: string;
  level: string;
  issue: string;
  /** The concrete pair that conflicts. */
  pair: { a: string; b: string };
  /** Severity of the dissonance. */
  severity: "warning" | "critical";
}

export interface BondMatrixCell {
  element: string;
  level: string;
  content: string;
  /** Whether this cell has a dissonance. */
  has_dissonance: boolean;
}

export interface BondLudonarrative {
  result: "Гармония" | "Ирония" | "Диссонанс";
  description: string;
  mechanic_narrative_pairs: Array<{ mechanic: string; narrative: string; consistency: number }>;
  correction: string;
}

export interface BondMatrixResult {
  matrix: BondMatrixCell[];
  row_consistency: Array<{ level: string; score: number; dissonances: BondDissonance[] }>;
  col_consistency: Array<{ element: string; score: number; description: string; dissonances: BondDissonance[] }>;
  dissonances: BondDissonance[];
  overall_consistency: number;
  ludonarrative: BondLudonarrative;
}

const ELEMENTS = ["Механика", "История", "Эстетика", "Технология"];
const LEVELS = ["Фиксированный", "Динамический", "Культурный"];

/** Aesthetic groups for dissonance detection. */
const COZY_AESTHETICS = ["submission", "expression", "fellowship"];
const INTENSE_AESTHETICS = ["challenge", "sensation"];
const HORROR_GENRES = ["horror", "survival_horror"];
const SOCIAL_AESTHETICS = ["fellowship"];

/**
 * Build the Bond 4×3 matrix cells from real artifact evidence.
 * Each cell references actual data from the mechanic set, concept USP,
 * aesthetic profile, and platform info.
 */
export function buildBondMatrixFromArtifacts(evidence: BondArtifactEvidence): BondMatrixCell[] {
  const { mechanicSet, aesthetics, usp, genre, platforms, predictedAesthetics } = evidence;

  const baseMechs = mechanicSet.base.map((m) => m.mechanic_name);
  const combatMechs = mechanicSet.combat.map((m) => m.mechanic_name);
  const progMechs = mechanicSet.progression.map((m) => m.mechanic_name);
  const spatialMechs = mechanicSet.spatial.map((m) => m.mechanic_name);
  const socialMechs = mechanicSet.social.map((m) => m.mechanic_name);

  const topPredicted = predictedAesthetics
    ? Object.entries(predictedAesthetics)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([a, score]) => `${a} (${(score * 100).toFixed(0)}%)`)
    : [];

  const platformStr = platforms && platforms.length > 0
    ? platforms.join(", ")
    : "PC (default)";

  const genreStr = genre || "unspecified";

  const contents: Record<string, Record<string, string>> = {
    "Механика": {
      "Фиксированный": baseMechs.length > 0
        ? `Базовые механики: ${baseMechs.slice(0, 3).join(", ")}`
        : "Базовые механики: не определены",
      "Динамический": combatMechs.length > 0 || progMechs.length > 0
        ? `Динамические: ${[...combatMechs, ...progMechs].slice(0, 3).join(", ")}`
        : "Динамические механики: не определены",
      "Культурный": socialMechs.length > 0 || spatialMechs.length > 0
        ? `Мета/социальные: ${[...socialMechs, ...spatialMechs].slice(0, 3).join(", ")}`
        : "Мета-стратегии: не определены",
    },
    "История": {
      "Фиксированный": usp
        ? `USP: ${usp.slice(0, 80)}`
        : "Главный конфликт не сформулирован (нет USP)",
      "Динамический": topPredicted.length > 0
        ? `Наблюдаемые эстетики: ${topPredicted.join(", ")}`
        : "Эмерджентные истории игрока: недостаточно данных",
      "Культурный": `Жанровые конвенции: ${genreStr}`,
    },
    "Эстетика": {
      "Фиксированный": `Целевая эстетика: ${aesthetics.primary} (secondary: ${aesthetics.secondary})`,
      "Динамический": topPredicted.length > 0
        ? `Предсказанные: ${topPredicted.join(", ")}`
        : "Эмоциональные пики: недостаточно данных MDA",
      "Культурный": `Аудитория: эстетика "${aesthetics.primary}" определяет целевую аудиторию`,
    },
    "Технология": {
      "Фиксированный": `Платформы: ${platformStr}`,
      "Динамический": combatMechs.length > 0
        ? `Тех-зависимые: ${combatMechs.slice(0, 2).join(", ")} (требуют физики/ИИ)`
        : "Физика/ИИ: не определены",
      "Культурный": `Моды/сообщество: ${socialMechs.length > 0 ? "поддерживается social-механиками" : "не выражено"}`,
    },
  };

  // We'll set has_dissonance after detecting dissonances.
  const matrix: BondMatrixCell[] = [];
  for (const element of ELEMENTS) {
    for (const level of LEVELS) {
      matrix.push({
        element,
        level,
        content: contents[element][level],
        has_dissonance: false,
      });
    }
  }
  return matrix;
}

/**
 * Detect concrete Bond dissonances from artifact evidence.
 * Each dissonance references a specific conflicting pair.
 */
export function detectBondDissonances(evidence: BondArtifactEvidence): BondDissonance[] {
  const dissonances: BondDissonance[] = [];
  const { mechanicSet, aesthetics, genre, platforms } = evidence;

  const combatCount = mechanicSet.combat.length;
  const socialCount = mechanicSet.social.length;
  const baseCount = mechanicSet.base.length;
  const primary = aesthetics.primary;

  // 1. Cozy aesthetic + combat-heavy mechanics → dissonance.
  if (COZY_AESTHETICS.includes(primary) && combatCount > socialCount + 1) {
    dissonances.push({
      element: "Эстетика",
      level: "Динамический",
      issue: `Cozy-эстетика "${primary}" конфликтует с combat-heavy набором (${combatCount} боевых механик)`,
      pair: { a: `aesthetic:${primary}`, b: `combat_count:${combatCount}` },
      severity: "warning",
    });
  }

  // 2. Intense aesthetic + only cozy mechanics → dissonance.
  if (INTENSE_AESTHETICS.includes(primary) && combatCount === 0) {
    dissonances.push({
      element: "Механика",
      level: "Динамический",
      issue: `Intense-эстетика "${primary}" требует боевых/динамических механик, но combat-категория пуста`,
      pair: { a: `aesthetic:${primary}`, b: "combat:empty" },
      severity: "critical",
    });
  }

  // 3. Horror genre + fellowship aesthetic → tonal dissonance.
  if (genre && HORROR_GENRES.includes(genre) && SOCIAL_AESTHETICS.includes(primary)) {
    dissonances.push({
      element: "История",
      level: "Культурный",
      issue: `Жанр "${genre}" конфликтует с эстетикой "${primary}" — хоррор и fellowship редко сочетаются`,
      pair: { a: `genre:${genre}`, b: `aesthetic:${primary}` },
      severity: "warning",
    });
  }

  // 4. VR platform + party/social mechanics → tech dissonance.
  if (platforms?.some((p) => p.toLowerCase().includes("vr"))) {
    if (socialCount > 2) {
      dissonances.push({
        element: "Технология",
        level: "Фиксированный",
        issue: "VR-платформа с большим количеством social-механик затрудняет multiplayer-опыт",
        pair: { a: "platform:VR", b: `social_count:${socialCount}` },
        severity: "warning",
      });
    }
  }

  // 5. No base mechanics → structural dissonance.
  if (baseCount === 0) {
    dissonances.push({
      element: "Механика",
      level: "Фиксированный",
      issue: "Категория base пуста — нет фундаментальных механик для опоры Bond matrix",
      pair: { a: "base:empty", b: "element:Механика" },
      severity: "critical",
    });
  }

  // 6. Primary aesthetic not in top-3 predicted → ludonarrative dissonance.
  if (evidence.predictedAesthetics) {
    const top3 = Object.entries(evidence.predictedAesthetics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([a]) => a);
    if (!top3.includes(primary) && top3.length > 0) {
      dissonances.push({
        element: "Эстетика",
        level: "Динамический",
        issue: `Целевая эстетика "${primary}" не входит в топ-3 предсказанных (${top3.join(", ")}) — ludonarrative диссонанс`,
        pair: { a: `target:${primary}`, b: `predicted:${top3.join(",")}` },
        severity: "warning",
      });
    }
  }

  return dissonances;
}

/**
 * Build the complete Bond validation from artifact evidence: matrix cells,
 * dissonances, row/column consistency scores, and overall consistency.
 */
export function buildBondValidationFromArtifacts(evidence: BondArtifactEvidence): BondMatrixResult {
  const { aesthetics } = evidence;
  const matrix = buildBondMatrixFromArtifacts(evidence);
  const dissonances = detectBondDissonances(evidence);

  // Mark cells that have dissonances.
  for (const d of dissonances) {
    const cell = matrix.find((c) => c.element === d.element && c.level === d.level);
    if (cell) cell.has_dissonance = true;
  }

  // Row consistency (per level — horizontal across 4 elements).
  const rowConsistency = LEVELS.map((level) => {
    const levelDissonances = dissonances.filter((d) => d.level === level);
    const elementCount = ELEMENTS.length;
    const score = Math.max(0, 1 - levelDissonances.length / elementCount);
    return {
      level,
      score: Number(score.toFixed(3)),
      dissonances: levelDissonances,
    };
  });

  // Column consistency (per element — vertical across 3 levels).
  const colConsistency = ELEMENTS.map((element) => {
    const elementDissonances = dissonances.filter((d) => d.element === element);
    const levelCount = LEVELS.length;
    const score = Math.max(0, 1 - elementDissonances.length / levelCount);
    return {
      element,
      score: Number(score.toFixed(3)),
      description: elementDissonances.length === 0
        ? `${element} согласованно на всех трёх уровнях`
        : `${element} имеет ${elementDissonances.length} диссонанс(ов)`,
      dissonances: elementDissonances,
    };
  });

  const overallConsistency = Number(
    (
      (rowConsistency.reduce((s, r) => s + r.score, 0) / rowConsistency.length) * 0.5 +
      (colConsistency.reduce((s, r) => s + r.score, 0) / colConsistency.length) * 0.5
    ).toFixed(3),
  );

  // R4-10: ludonarrative analysis derived from dissonances, not compatibility.
  const ludoDissonances = dissonances.filter((d) =>
    d.issue.includes("ludonarrative") || d.pair.a.startsWith("target:")
  );
  let ludoResult: BondLudonarrative["result"];
  let ludoDescription: string;
  let ludoCorrection: string;
  if (ludoDissonances.length === 0 && overallConsistency >= 0.75) {
    ludoResult = "Гармония";
    ludoDescription = `Механики и нарратив согласованно выражают эстетику "${aesthetics.primary}".`;
    ludoCorrection = "Усилить нарративные отсылки в боевых эпизодах для закрепления эстетики";
  } else if (ludoDissonances.length === 0) {
    ludoResult = "Ирония";
    ludoDescription = `Механики и нарратив имеют некоторое напряжение — игровой тон не полностью соответствует заявленной эстетике "${aesthetics.primary}".`;
    ludoCorrection = "Выровнять тон механик с нарративом: добавить механики, поддерживающие целевую эстетику";
  } else {
    ludoResult = "Диссонанс";
    ludoDescription = `Механики и нарратив конфликтуют — целевая эстетика "${aesthetics.primary}" не подтверждается предсказанными эстетиками MDA.`;
    ludoCorrection = "Кардинально пересмотреть набор механик для соответствия целевой эстетике";
  }

  const ludonarrative: BondLudonarrative = {
    result: ludoResult,
    description: ludoDescription,
    mechanic_narrative_pairs: [
      { mechanic: "combat", narrative: "main_conflict", consistency: Number(Math.min(1, overallConsistency + 0.1).toFixed(2)) },
      { mechanic: "progression", narrative: "character_growth", consistency: Number(Math.min(1, overallConsistency + 0.05).toFixed(2)) },
      { mechanic: "exploration", narrative: "world_discovery", consistency: Number(overallConsistency.toFixed(2)) },
    ],
    correction: ludoCorrection,
  };

  return {
    matrix,
    row_consistency: rowConsistency,
    col_consistency: colConsistency,
    dissonances,
    overall_consistency: overallConsistency,
    ludonarrative,
  };
}
