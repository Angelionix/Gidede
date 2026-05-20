/**
 * Gidede — Constants Tests
 * Task 4-a: Expand frontend test coverage
 *
 * Tests for all constant files:
 * - gdd.ts: GDD format specs, detail levels, audiences
 * - coreloop.ts: Structural types, pathology types, hierarchy
 * - economy.ts: Severity colors, economic types, curve colors
 * - balance.ts: Game modes, balance types, status colors
 * - mda.ts: Priority lenses, bond elements, score colors
 * - progression.ts: Curve types, monetization models, pacing
 * - concept.ts: Platforms, budgets, experience levels, mechanic groups
 */

import { describe, it, expect } from "vitest";

// ============================================================
// gdd.ts
// ============================================================

describe("Constants — gdd.ts", () => {
  it("GDD_FORMATS is defined and has 8 formats", async () => {
    const { GDD_FORMATS } = await import("@/constants/gdd");
    expect(GDD_FORMATS).toBeDefined();
    expect(Array.isArray(GDD_FORMATS)).toBe(true);
    expect(GDD_FORMATS).toHaveLength(8);
  });

  it("GDD_FORMATS each have value, label, description, recommendation, icon", async () => {
    const { GDD_FORMATS } = await import("@/constants/gdd");
    for (const fmt of GDD_FORMATS) {
      expect(fmt).toHaveProperty("value");
      expect(fmt).toHaveProperty("label");
      expect(fmt).toHaveProperty("description");
      expect(fmt).toHaveProperty("recommendation");
      expect(fmt).toHaveProperty("icon");
      expect(typeof fmt.value).toBe("string");
      expect(typeof fmt.label).toBe("string");
      expect(typeof fmt.description).toBe("string");
      expect(typeof fmt.recommendation).toBe("string");
    }
  });

  it("GDD_FORMATS values are unique", async () => {
    const { GDD_FORMATS } = await import("@/constants/gdd");
    const values = GDD_FORMATS.map((f) => f.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("GDD_FORMATS includes one_sheet format", async () => {
    const { GDD_FORMATS } = await import("@/constants/gdd");
    const oneSheet = GDD_FORMATS.find((f) => f.value === "one_sheet");
    expect(oneSheet).toBeDefined();
    expect(oneSheet!.label).toBe("One-Sheet");
  });

  it("GDD_FORMATS includes full_gdd format", async () => {
    const { GDD_FORMATS } = await import("@/constants/gdd");
    const fullGdd = GDD_FORMATS.find((f) => f.value === "full_gdd");
    expect(fullGdd).toBeDefined();
    expect(fullGdd!.label).toBe("Full GDD");
  });

  it("GDD_FORMATS includes all 8 format values", async () => {
    const { GDD_FORMATS } = await import("@/constants/gdd");
    const values = GDD_FORMATS.map((f) => f.value);
    expect(values).toContain("one_sheet");
    expect(values).toContain("ten_pager");
    expect(values).toContain("treatment");
    expect(values).toContain("sketch_design");
    expect(values).toContain("full_gdd");
    expect(values).toContain("concept_doc");
    expect(values).toContain("narrative_bible");
    expect(values).toContain("modular");
  });

  it("DETAIL_LEVELS is defined and has 4 levels", async () => {
    const { DETAIL_LEVELS } = await import("@/constants/gdd");
    expect(DETAIL_LEVELS).toBeDefined();
    expect(Array.isArray(DETAIL_LEVELS)).toBe(true);
    expect(DETAIL_LEVELS).toHaveLength(4);
  });

  it("DETAIL_LEVELS includes overview, standard, detailed, exhaustive", async () => {
    const { DETAIL_LEVELS } = await import("@/constants/gdd");
    const values = DETAIL_LEVELS.map((d) => d.value);
    expect(values).toContain("overview");
    expect(values).toContain("standard");
    expect(values).toContain("detailed");
    expect(values).toContain("exhaustive");
  });

  it("DOC_AUDIENCES is defined and non-empty", async () => {
    const { DOC_AUDIENCES } = await import("@/constants/gdd");
    expect(DOC_AUDIENCES).toBeDefined();
    expect(Array.isArray(DOC_AUDIENCES)).toBe(true);
    expect(DOC_AUDIENCES.length).toBeGreaterThan(0);
  });

  it("DOC_AUDIENCES includes investor and production", async () => {
    const { DOC_AUDIENCES } = await import("@/constants/gdd");
    const values = DOC_AUDIENCES.map((a) => a.value);
    expect(values).toContain("investor");
    expect(values).toContain("production");
  });

  it("PROJECT_STAGES is defined and has 5 stages", async () => {
    const { PROJECT_STAGES } = await import("@/constants/gdd");
    expect(PROJECT_STAGES).toBeDefined();
    expect(Array.isArray(PROJECT_STAGES)).toBe(true);
    expect(PROJECT_STAGES).toHaveLength(5);
  });

  it("PROJECT_STAGES includes concept, prototype, production, live_ops", async () => {
    const { PROJECT_STAGES } = await import("@/constants/gdd");
    const values = PROJECT_STAGES.map((s) => s.value);
    expect(values).toContain("concept");
    expect(values).toContain("prototype");
    expect(values).toContain("production");
    expect(values).toContain("live_ops");
  });
});

// ============================================================
// coreloop.ts
// ============================================================

describe("Constants — coreloop.ts", () => {
  it("LOOP_TYPES is defined and has 4 types", async () => {
    const { LOOP_TYPES } = await import("@/constants/coreloop");
    expect(LOOP_TYPES).toBeDefined();
    expect(Array.isArray(LOOP_TYPES)).toBe(true);
    expect(LOOP_TYPES).toHaveLength(4);
  });

  it("LOOP_TYPES include engine, economy, ecology, hybrid", async () => {
    const { LOOP_TYPES } = await import("@/constants/coreloop");
    const values = LOOP_TYPES.map((t) => t.value);
    expect(values).toContain("engine");
    expect(values).toContain("economy");
    expect(values).toContain("ecology");
    expect(values).toContain("hybrid");
  });

  it("LOOP_TYPES each have value, label, description", async () => {
    const { LOOP_TYPES } = await import("@/constants/coreloop");
    for (const lt of LOOP_TYPES) {
      expect(lt).toHaveProperty("value");
      expect(lt).toHaveProperty("label");
      expect(lt).toHaveProperty("description");
      expect(typeof lt.value).toBe("string");
      expect(typeof lt.label).toBe("string");
      expect(typeof lt.description).toBe("string");
    }
  });

  it("DEFAULT_MECHANICS is a non-empty string", async () => {
    const { DEFAULT_MECHANICS } = await import("@/constants/coreloop");
    expect(DEFAULT_MECHANICS).toBeDefined();
    expect(typeof DEFAULT_MECHANICS).toBe("string");
    expect(DEFAULT_MECHANICS.length).toBeGreaterThan(0);
  });

  it("LOOP_TYPE_BADGES has entries for all 4 loop types", async () => {
    const { LOOP_TYPE_BADGES } = await import("@/constants/coreloop");
    expect(LOOP_TYPE_BADGES).toBeDefined();
    expect(Object.keys(LOOP_TYPE_BADGES)).toHaveLength(4);
    expect(LOOP_TYPE_BADGES.engine).toBeDefined();
    expect(LOOP_TYPE_BADGES.economy).toBeDefined();
    expect(LOOP_TYPE_BADGES.ecology).toBeDefined();
    expect(LOOP_TYPE_BADGES.hybrid).toBeDefined();
  });

  it("LOOP_TYPE_BADGES each have label and color", async () => {
    const { LOOP_TYPE_BADGES } = await import("@/constants/coreloop");
    for (const [, badge] of Object.entries(LOOP_TYPE_BADGES)) {
      expect(badge).toHaveProperty("label");
      expect(badge).toHaveProperty("color");
      expect(badge).toHaveProperty("icon");
      expect(typeof badge.label).toBe("string");
      expect(typeof badge.color).toBe("string");
    }
  });

  it("SEVERITY_STYLES has critical, warning, info", async () => {
    const { SEVERITY_STYLES } = await import("@/constants/coreloop");
    expect(SEVERITY_STYLES).toBeDefined();
    expect(SEVERITY_STYLES.critical).toBeDefined();
    expect(SEVERITY_STYLES.warning).toBeDefined();
    expect(SEVERITY_STYLES.info).toBeDefined();
  });

  it("SEVERITY_STYLES each have color and icon", async () => {
    const { SEVERITY_STYLES } = await import("@/constants/coreloop");
    for (const [, style] of Object.entries(SEVERITY_STYLES)) {
      expect(style).toHaveProperty("color");
      expect(style).toHaveProperty("icon");
      expect(typeof style.color).toBe("string");
    }
  });

  it("PRIORITY_STYLES has high, medium, low", async () => {
    const { PRIORITY_STYLES } = await import("@/constants/coreloop");
    expect(PRIORITY_STYLES).toBeDefined();
    expect(PRIORITY_STYLES.high).toBeDefined();
    expect(PRIORITY_STYLES.medium).toBeDefined();
    expect(PRIORITY_STYLES.low).toBeDefined();
    expect(typeof PRIORITY_STYLES.high).toBe("string");
  });

  it("HIERARCHY_LEVELS has 6 levels (micro to meta)", async () => {
    const { HIERARCHY_LEVELS } = await import("@/constants/coreloop");
    expect(HIERARCHY_LEVELS).toBeDefined();
    expect(Array.isArray(HIERARCHY_LEVELS)).toBe(true);
    expect(HIERARCHY_LEVELS).toHaveLength(6);
  });

  it("HIERARCHY_LEVELS keys are micro, small, medium, large, macro, meta", async () => {
    const { HIERARCHY_LEVELS } = await import("@/constants/coreloop");
    const keys = HIERARCHY_LEVELS.map((h) => h.key);
    expect(keys).toEqual(["micro", "small", "medium", "large", "macro", "meta"]);
  });

  it("HIERARCHY_LEVELS each have label, timeScale, icon", async () => {
    const { HIERARCHY_LEVELS } = await import("@/constants/coreloop");
    for (const level of HIERARCHY_LEVELS) {
      expect(level).toHaveProperty("key");
      expect(level).toHaveProperty("label");
      expect(level).toHaveProperty("timeScale");
      expect(level).toHaveProperty("icon");
      expect(typeof level.key).toBe("string");
      expect(typeof level.label).toBe("string");
      expect(typeof level.timeScale).toBe("string");
    }
  });
});

// ============================================================
// economy.ts
// ============================================================

describe("Constants — economy.ts", () => {
  it("SEVERITY_COLORS is defined", async () => {
    const { SEVERITY_COLORS } = await import("@/constants/economy");
    expect(SEVERITY_COLORS).toBeDefined();
    expect(typeof SEVERITY_COLORS).toBe("object");
  });

  it("SEVERITY_COLORS has critical, warning, info", async () => {
    const { SEVERITY_COLORS } = await import("@/constants/economy");
    expect(SEVERITY_COLORS.critical).toBeDefined();
    expect(SEVERITY_COLORS.warning).toBeDefined();
    expect(SEVERITY_COLORS.info).toBeDefined();
  });

  it("SEVERITY_COLORS values are CSS class strings", async () => {
    const { SEVERITY_COLORS } = await import("@/constants/economy");
    for (const [, color] of Object.entries(SEVERITY_COLORS)) {
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it("ECONOMIC_TYPE_COLORS is defined", async () => {
    const { ECONOMIC_TYPE_COLORS } = await import("@/constants/economy");
    expect(ECONOMIC_TYPE_COLORS).toBeDefined();
    expect(typeof ECONOMIC_TYPE_COLORS).toBe("object");
  });

  it("ECONOMIC_TYPE_COLORS has Engine, Economy, Ecology", async () => {
    const { ECONOMIC_TYPE_COLORS } = await import("@/constants/economy");
    expect(ECONOMIC_TYPE_COLORS.Engine).toBeDefined();
    expect(ECONOMIC_TYPE_COLORS.Economy).toBeDefined();
    expect(ECONOMIC_TYPE_COLORS.Ecology).toBeDefined();
  });

  it("CURVE_COLORS is defined and has 7 colors", async () => {
    const { CURVE_COLORS } = await import("@/constants/economy");
    expect(CURVE_COLORS).toBeDefined();
    expect(Array.isArray(CURVE_COLORS)).toBe(true);
    expect(CURVE_COLORS).toHaveLength(7);
  });

  it("CURVE_COLORS are hex color strings", async () => {
    const { CURVE_COLORS } = await import("@/constants/economy");
    for (const color of CURVE_COLORS) {
      expect(typeof color).toBe("string");
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ============================================================
// balance.ts
// ============================================================

describe("Constants — balance.ts", () => {
  it("GAME_MODES is defined and has 3 modes", async () => {
    const { GAME_MODES } = await import("@/constants/balance");
    expect(GAME_MODES).toBeDefined();
    expect(Array.isArray(GAME_MODES)).toBe(true);
    expect(GAME_MODES).toHaveLength(3);
  });

  it("GAME_MODES include PvP, PvE, PvPvE", async () => {
    const { GAME_MODES } = await import("@/constants/balance");
    const values = GAME_MODES.map((m) => m.value);
    expect(values).toContain("PvP");
    expect(values).toContain("PvE");
    expect(values).toContain("PvPvE");
  });

  it("BALANCE_TYPES is defined and has 4 types", async () => {
    const { BALANCE_TYPES } = await import("@/constants/balance");
    expect(BALANCE_TYPES).toBeDefined();
    expect(Array.isArray(BALANCE_TYPES)).toBe(true);
    expect(BALANCE_TYPES).toHaveLength(4);
  });

  it("BALANCE_TYPES include transitive, intransitive, situational, mixed", async () => {
    const { BALANCE_TYPES } = await import("@/constants/balance");
    const values = BALANCE_TYPES.map((t) => t.value);
    expect(values).toContain("transitive");
    expect(values).toContain("intransitive");
    expect(values).toContain("situational");
    expect(values).toContain("mixed");
  });

  it("STATUS_COLORS has overpowered, underpowered, balanced, ideal_imbalance", async () => {
    const { STATUS_COLORS } = await import("@/constants/balance");
    expect(STATUS_COLORS).toBeDefined();
    expect(STATUS_COLORS.overpowered).toBeDefined();
    expect(STATUS_COLORS.underpowered).toBeDefined();
    expect(STATUS_COLORS.balanced).toBeDefined();
    expect(STATUS_COLORS.ideal_imbalance).toBeDefined();
  });

  it("STATUS_DOT has 4 status dot colors", async () => {
    const { STATUS_DOT } = await import("@/constants/balance");
    expect(STATUS_DOT).toBeDefined();
    expect(Object.keys(STATUS_DOT)).toHaveLength(4);
    expect(STATUS_DOT.overpowered).toContain("bg-red");
    expect(STATUS_DOT.underpowered).toContain("bg-amber");
    expect(STATUS_DOT.balanced).toContain("bg-green");
    expect(STATUS_DOT.ideal_imbalance).toContain("bg-blue");
  });

  it("VERDICT_STYLES has GOOD, MODERATE, POOR", async () => {
    const { VERDICT_STYLES } = await import("@/constants/balance");
    expect(VERDICT_STYLES).toBeDefined();
    expect(VERDICT_STYLES.GOOD).toBeDefined();
    expect(VERDICT_STYLES.MODERATE).toBeDefined();
    expect(VERDICT_STYLES.POOR).toBeDefined();
    expect(typeof VERDICT_STYLES.GOOD).toBe("string");
  });

  it("DEFAULT_OBJECTS has 5 balance objects", async () => {
    const { DEFAULT_OBJECTS } = await import("@/constants/balance");
    expect(DEFAULT_OBJECTS).toBeDefined();
    expect(Array.isArray(DEFAULT_OBJECTS)).toBe(true);
    expect(DEFAULT_OBJECTS).toHaveLength(5);
  });

  it("DEFAULT_OBJECTS each have id, name, type, attributes, cost, tier", async () => {
    const { DEFAULT_OBJECTS } = await import("@/constants/balance");
    for (const obj of DEFAULT_OBJECTS) {
      expect(obj).toHaveProperty("id");
      expect(obj).toHaveProperty("name");
      expect(obj).toHaveProperty("type");
      expect(obj).toHaveProperty("attributes");
      expect(obj).toHaveProperty("cost");
      expect(obj).toHaveProperty("tier");
      expect(typeof obj.id).toBe("string");
      expect(typeof obj.name).toBe("string");
      expect(typeof obj.type).toBe("string");
      expect(typeof obj.attributes).toBe("object");
      expect(typeof obj.cost).toBe("number");
    }
  });

  it("DEFAULT_OBJECTS includes Warrior, Mage, Rogue, Tank, Healer", async () => {
    const { DEFAULT_OBJECTS } = await import("@/constants/balance");
    const names = DEFAULT_OBJECTS.map((o) => o.name);
    expect(names).toContain("Warrior");
    expect(names).toContain("Mage");
    expect(names).toContain("Rogue");
    expect(names).toContain("Tank");
    expect(names).toContain("Healer");
  });

  it("DEFAULT_OBJECTS Warrior has correct attributes", async () => {
    const { DEFAULT_OBJECTS } = await import("@/constants/balance");
    const warrior = DEFAULT_OBJECTS.find((o) => o.name === "Warrior");
    expect(warrior).toBeDefined();
    expect(warrior!.type).toBe("melee");
    expect(warrior!.attributes.HP).toBe(100);
    expect(warrior!.attributes.damage).toBe(15);
  });
});

// ============================================================
// mda.ts
// ============================================================

describe("Constants — mda.ts", () => {
  it("PRIORITY_LENSES is defined and non-empty", async () => {
    const { PRIORITY_LENSES } = await import("@/constants/mda");
    expect(PRIORITY_LENSES).toBeDefined();
    expect(Array.isArray(PRIORITY_LENSES)).toBe(true);
    expect(PRIORITY_LENSES.length).toBeGreaterThan(0);
  });

  it("PRIORITY_LENSES each have id, name, focus, category", async () => {
    const { PRIORITY_LENSES } = await import("@/constants/mda");
    for (const lens of PRIORITY_LENSES) {
      expect(lens).toHaveProperty("id");
      expect(lens).toHaveProperty("name");
      expect(lens).toHaveProperty("focus");
      expect(lens).toHaveProperty("category");
      expect(typeof lens.id).toBe("number");
      expect(typeof lens.name).toBe("string");
      expect(typeof lens.focus).toBe("string");
      expect(typeof lens.category).toBe("string");
    }
  });

  it("PRIORITY_LENSES has 9 lenses", async () => {
    const { PRIORITY_LENSES } = await import("@/constants/mda");
    expect(PRIORITY_LENSES).toHaveLength(9);
  });

  it("PRIORITY_LENSES categories include целостность, эмерджентность, баланс, интерес", async () => {
    const { PRIORITY_LENSES } = await import("@/constants/mda");
    const categories = PRIORITY_LENSES.map((l) => l.category);
    expect(categories).toContain("целостность");
    expect(categories).toContain("эмерджентность");
    expect(categories).toContain("баланс");
    expect(categories).toContain("интерес");
  });

  it("BOND_ELEMENTS has 4 elements", async () => {
    const { BOND_ELEMENTS } = await import("@/constants/mda");
    expect(BOND_ELEMENTS).toBeDefined();
    expect(Array.isArray(BOND_ELEMENTS)).toBe(true);
    expect(BOND_ELEMENTS).toHaveLength(4);
  });

  it("BOND_ELEMENTS are Механика, История, Эстетика, Технология", async () => {
    const { BOND_ELEMENTS } = await import("@/constants/mda");
    expect(BOND_ELEMENTS).toEqual(["Механика", "История", "Эстетика", "Технология"]);
  });

  it("BOND_LEVELS has 3 levels", async () => {
    const { BOND_LEVELS } = await import("@/constants/mda");
    expect(BOND_LEVELS).toBeDefined();
    expect(Array.isArray(BOND_LEVELS)).toBe(true);
    expect(BOND_LEVELS).toHaveLength(3);
  });

  it("SCORE_COLORS has high, medium, low", async () => {
    const { SCORE_COLORS } = await import("@/constants/mda");
    expect(SCORE_COLORS).toBeDefined();
    expect(SCORE_COLORS.high).toBeDefined();
    expect(SCORE_COLORS.medium).toBeDefined();
    expect(SCORE_COLORS.low).toBeDefined();
  });

  it("CATEGORY_COLORS has 4 categories", async () => {
    const { CATEGORY_COLORS } = await import("@/constants/mda");
    expect(CATEGORY_COLORS).toBeDefined();
    expect(Object.keys(CATEGORY_COLORS)).toHaveLength(4);
  });

  it("EMERGENCE_BADGES has nominal, weak, multiple, strong", async () => {
    const { EMERGENCE_BADGES } = await import("@/constants/mda");
    expect(EMERGENCE_BADGES).toBeDefined();
    expect(EMERGENCE_BADGES.nominal).toBeDefined();
    expect(EMERGENCE_BADGES.weak).toBeDefined();
    expect(EMERGENCE_BADGES.multiple).toBeDefined();
    expect(EMERGENCE_BADGES.strong).toBeDefined();
  });

  it("EMERGENCE_BADGES each have label and color", async () => {
    const { EMERGENCE_BADGES } = await import("@/constants/mda");
    for (const [, badge] of Object.entries(EMERGENCE_BADGES)) {
      expect(badge).toHaveProperty("label");
      expect(badge).toHaveProperty("color");
      expect(typeof badge.label).toBe("string");
      expect(typeof badge.color).toBe("string");
    }
  });
});

// ============================================================
// progression.ts
// ============================================================

describe("Constants — progression.ts", () => {
  it("PROGRESSION_TYPES is defined and has 6 types", async () => {
    const { PROGRESSION_TYPES } = await import("@/constants/progression");
    expect(PROGRESSION_TYPES).toBeDefined();
    expect(Array.isArray(PROGRESSION_TYPES)).toBe(true);
    expect(PROGRESSION_TYPES).toHaveLength(6);
  });

  it("PROGRESSION_TYPES include linear, exponential, diminishing, s_curve, intermittent, custom", async () => {
    const { PROGRESSION_TYPES } = await import("@/constants/progression");
    const values = PROGRESSION_TYPES.map((t) => t.value);
    expect(values).toContain("linear");
    expect(values).toContain("exponential");
    expect(values).toContain("diminishing");
    expect(values).toContain("s_curve");
    expect(values).toContain("intermittent");
    expect(values).toContain("custom");
  });

  it("MONETIZATION_MODELS is defined and has 6 models", async () => {
    const { MONETIZATION_MODELS } = await import("@/constants/progression");
    expect(MONETIZATION_MODELS).toBeDefined();
    expect(Array.isArray(MONETIZATION_MODELS)).toBe(true);
    expect(MONETIZATION_MODELS).toHaveLength(6);
  });

  it("MONETIZATION_MODELS include f2p, b2p, subscription", async () => {
    const { MONETIZATION_MODELS } = await import("@/constants/progression");
    const values = MONETIZATION_MODELS.map((m) => m.value);
    expect(values).toContain("f2p");
    expect(values).toContain("b2p");
    expect(values).toContain("subscription");
  });

  it("PACING_OPTIONS has 3 options", async () => {
    const { PACING_OPTIONS } = await import("@/constants/progression");
    expect(PACING_OPTIONS).toBeDefined();
    expect(Array.isArray(PACING_OPTIONS)).toBe(true);
    expect(PACING_OPTIONS).toHaveLength(3);
  });

  it("PACING_OPTIONS include relaxed, balanced, intense", async () => {
    const { PACING_OPTIONS } = await import("@/constants/progression");
    const values = PACING_OPTIONS.map((p) => p.value);
    expect(values).toContain("relaxed");
    expect(values).toContain("balanced");
    expect(values).toContain("intense");
  });

  it("OPENNESS_OPTIONS has 3 options", async () => {
    const { OPENNESS_OPTIONS } = await import("@/constants/progression");
    expect(OPENNESS_OPTIONS).toBeDefined();
    expect(Array.isArray(OPENNESS_OPTIONS)).toBe(true);
    expect(OPENNESS_OPTIONS).toHaveLength(3);
  });

  it("OPENNESS_OPTIONS include open, closed, mixed", async () => {
    const { OPENNESS_OPTIONS } = await import("@/constants/progression");
    const values = OPENNESS_OPTIONS.map((o) => o.value);
    expect(values).toContain("open");
    expect(values).toContain("closed");
    expect(values).toContain("mixed");
  });
});

// ============================================================
// concept.ts
// ============================================================

describe("Constants — concept.ts", () => {
  it("PLATFORMS is defined and has 5 platforms", async () => {
    const { PLATFORMS } = await import("@/constants/concept");
    expect(PLATFORMS).toBeDefined();
    expect(Array.isArray(PLATFORMS)).toBe(true);
    expect(PLATFORMS).toHaveLength(5);
  });

  it("PLATFORMS include pc, mobile, console, vr, web", async () => {
    const { PLATFORMS } = await import("@/constants/concept");
    const values = PLATFORMS.map((p) => p.value);
    expect(values).toContain("pc");
    expect(values).toContain("mobile");
    expect(values).toContain("console");
    expect(values).toContain("vr");
    expect(values).toContain("web");
  });

  it("BUDGET_OPTIONS is defined and has 4 options", async () => {
    const { BUDGET_OPTIONS } = await import("@/constants/concept");
    expect(BUDGET_OPTIONS).toBeDefined();
    expect(Array.isArray(BUDGET_OPTIONS)).toBe(true);
    expect(BUDGET_OPTIONS).toHaveLength(4);
  });

  it("BUDGET_OPTIONS include solo, small, medium, large", async () => {
    const { BUDGET_OPTIONS } = await import("@/constants/concept");
    const values = BUDGET_OPTIONS.map((b) => b.value);
    expect(values).toContain("solo");
    expect(values).toContain("small");
    expect(values).toContain("medium");
    expect(values).toContain("large");
  });

  it("EXPERIENCE_LEVELS has 3 levels", async () => {
    const { EXPERIENCE_LEVELS } = await import("@/constants/concept");
    expect(EXPERIENCE_LEVELS).toBeDefined();
    expect(Array.isArray(EXPERIENCE_LEVELS)).toBe(true);
    expect(EXPERIENCE_LEVELS).toHaveLength(3);
  });

  it("EXPERIENCE_LEVELS include casual, midcore, hardcore", async () => {
    const { EXPERIENCE_LEVELS } = await import("@/constants/concept");
    const values = EXPERIENCE_LEVELS.map((e) => e.value);
    expect(values).toContain("casual");
    expect(values).toContain("midcore");
    expect(values).toContain("hardcore");
  });

  it("MECHANIC_GROUPS has 5 groups", async () => {
    const { MECHANIC_GROUPS } = await import("@/constants/concept");
    expect(MECHANIC_GROUPS).toBeDefined();
    expect(Array.isArray(MECHANIC_GROUPS)).toBe(true);
    expect(MECHANIC_GROUPS).toHaveLength(5);
  });

  it("MECHANIC_GROUPS include base, combat, progression, spatial, social", async () => {
    const { MECHANIC_GROUPS } = await import("@/constants/concept");
    const keys = MECHANIC_GROUPS.map((g) => g.key);
    expect(keys).toContain("base");
    expect(keys).toContain("combat");
    expect(keys).toContain("progression");
    expect(keys).toContain("spatial");
    expect(keys).toContain("social");
  });

  it("LOOP_TYPE_LABELS has 4 entries", async () => {
    const { LOOP_TYPE_LABELS } = await import("@/constants/concept");
    expect(LOOP_TYPE_LABELS).toBeDefined();
    expect(typeof LOOP_TYPE_LABELS).toBe("object");
    expect(Object.keys(LOOP_TYPE_LABELS)).toHaveLength(4);
  });

  it("LOOP_TYPE_LABELS maps engine, economy, ecology, hybrid to Russian labels", async () => {
    const { LOOP_TYPE_LABELS } = await import("@/constants/concept");
    expect(LOOP_TYPE_LABELS.engine).toBe("Двигатель");
    expect(LOOP_TYPE_LABELS.economy).toBe("Экономика");
    expect(LOOP_TYPE_LABELS.ecology).toBe("Экология");
    expect(LOOP_TYPE_LABELS.hybrid).toBe("Гибрид");
  });
});
