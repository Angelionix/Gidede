/**
 * TASK-2.20: Unit tests for Core Loop steps builder (Block 2).
 * Covers: TASK-2.1 (parametrization), TASK-2.7 (genre duration), TASK-2.8 (dead resources), TASK-2.9 (customSteps).
 */

import { describe, it, expect } from "vitest";
import { buildSteps } from "./steps";

describe("buildSteps — TASK-2.1: параметризация по типу", () => {
  it("engine builder: 5 steps, momentum-based", () => {
    const steps = buildSteps(["Исследование", "Сражение", "Награда"], undefined, "engine", "shooter");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Найти цель");
    expect(steps[1].action).toContain("Атаковать");
    expect(steps[4].action).toContain("Повторить");
  });

  it("economy builder: 5 steps, resource conversion", () => {
    const steps = buildSteps(["Сбор", "Крафт", "Торговля"], undefined, "economy", "rpg");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Собрать ресурсы");
    expect(steps[1].action).toContain("Конвертировать");
    expect(steps[4].action).toContain("Реинвестировать");
  });

  it("ecology builder: 5 steps, balance-focused", () => {
    const steps = buildSteps(["Наблюдение", "Действие", "Баланс"], undefined, "ecology", "horror");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Оценить");
    expect(steps[4].action).toContain("Адаптироваться");
  });

  it("hybrid builder: 5 steps", () => {
    const steps = buildSteps(["Исследование", "Сражение", "Награда"], undefined, "hybrid", "adventure");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Исследовать");
  });

  it("tower_defense builder: 5 steps, wave-based", () => {
    const steps = buildSteps(["Строительство", "Защита", "Улучшение"], undefined, "tower_defense", "tower_defense");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Построить башни");
    expect(steps[3].action).toContain("Отразить волну");
  });

  it("rhythm builder: 5 steps, beat-synced", () => {
    const steps = buildSteps(["Слушать", "Ввод", "Оценка"], undefined, "rhythm", "rhythm");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Слушать ритм");
    expect(steps[4].action).toContain("Следующий такт");
  });

  it("puzzle builder: 5 steps, pattern-based", () => {
    const steps = buildSteps(["Сканирование", "Анализ", "Размещение"], undefined, "puzzle", "puzzle");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toContain("Сканировать доску");
    expect(steps[4].action).toContain("Очистить линию");
  });

  it("unknown type falls back to hybrid", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "unknown_type", "action");
    expect(steps.length).toBe(5);
  });
});

describe("buildSteps — TASK-2.7: масштаб по жанру", () => {
  it("shooter has short durations (3-8s)", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "engine", "shooter");
    const durations = steps.map((s) => s.duration_estimate);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...durations)).toBeLessThanOrEqual(8);
  });

  it("rpg has medium durations (10-40s)", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "economy", "rpg");
    const durations = steps.map((s) => s.duration_estimate);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...durations)).toBeLessThanOrEqual(40);
  });

  it("strategy has long durations (30-120s)", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "economy", "strategy");
    const durations = steps.map((s) => s.duration_estimate);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(30);
    expect(Math.max(...durations)).toBeLessThanOrEqual(120);
  });

  it("rhythm has very short durations (1-4s)", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "rhythm", "rhythm");
    const durations = steps.map((s) => s.duration_estimate);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...durations)).toBeLessThanOrEqual(4);
  });

  it("unknown genre falls back to action durations", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "engine", "unknown_genre");
    expect(steps.length).toBe(5);
    const durations = steps.map((s) => s.duration_estimate);
    expect(Math.min(...durations)).toBeGreaterThanOrEqual(4);
  });
});

describe("buildSteps — TASK-2.8: dead_resources из default template", () => {
  it("engine: minimal dead resources (chain closes)", () => {
    const steps = buildSteps(["M1", "M2", "M3"], undefined, "engine", "shooter");
    const allProduced = new Set(steps.flatMap((s) => s.resources_produced));
    const allConsumed = new Set(steps.flatMap((s) => s.resources_consumed));
    const deadResources = Array.from(allProduced).filter((r) => !allConsumed.has(r));
    // momentum is produced by last and consumed by first (loop closes) — so it's NOT dead
    expect(deadResources.length).toBeLessThanOrEqual(1);
  });

  it("economy: no dead resources (chain conversion)", () => {
    const steps = buildSteps(["M1", "M2", "M3"], undefined, "economy", "rpg");
    const allProduced = new Set(steps.flatMap((s) => s.resources_produced));
    const allConsumed = new Set(steps.flatMap((s) => s.resources_consumed));
    const deadResources = Array.from(allProduced).filter((r) => !allConsumed.has(r));
    expect(deadResources.length).toBe(0);
  });

  it("ecology: no dead resources (balanced loop)", () => {
    const steps = buildSteps(["M1", "M2", "M3"], undefined, "ecology", "horror");
    const allProduced = new Set(steps.flatMap((s) => s.resources_produced));
    const allConsumed = new Set(steps.flatMap((s) => s.resources_consumed));
    const deadResources = Array.from(allProduced).filter((r) => !allConsumed.has(r));
    expect(deadResources.length).toBe(0);
  });
});

describe("buildSteps — TASK-2.9: customSteps mode", () => {
  it("uses custom steps when provided", () => {
    const customSteps = ["Шаг 1", "Шаг 2", "Шаг 3"];
    const steps = buildSteps(["M1", "M2"], customSteps, "engine", "shooter");
    expect(steps.length).toBe(3);
    expect(steps[0].action).toBe("Шаг 1");
    expect(steps[1].action).toBe("Шаг 2");
    expect(steps[2].action).toBe("Шаг 3");
  });

  it("custom steps: ресурсы зависят от типа, не от feedback", () => {
    const customSteps = ["Step A", "Step B"];
    const engineSteps = buildSteps(["M1"], customSteps, "engine", "shooter");
    const economySteps = buildSteps(["M1"], customSteps, "economy", "rpg");

    // Engine custom: first step produces momentum
    expect(engineSteps[0].resources_produced).toContain("momentum");
    // Economy custom: first step produces raw_resource
    expect(economySteps[0].resources_produced).toContain("raw_resource");
  });

  it("custom steps: duration from genre scale", () => {
    const customSteps = ["Step 1", "Step 2", "Step 3"];
    const shooterSteps = buildSteps(["M1"], customSteps, "engine", "shooter");
    const rpgSteps = buildSteps(["M1"], customSteps, "engine", "rpg");
    const avgShooter = shooterSteps.reduce((s, st) => s + st.duration_estimate, 0) / shooterSteps.length;
    const avgRpg = rpgSteps.reduce((s, st) => s + st.duration_estimate, 0) / rpgSteps.length;
    expect(avgRpg).toBeGreaterThan(avgShooter);
  });

  it("custom steps: limited to 10 max", () => {
    const customSteps = Array.from({ length: 15 }, (_, i) => `Step ${i + 1}`);
    const steps = buildSteps(["M1"], customSteps, "engine", "shooter");
    expect(steps.length).toBe(10);
  });

  it("custom steps: mechanics assigned round-robin", () => {
    const customSteps = ["Step 1", "Step 2", "Step 3", "Step 4"];
    const mechanics = ["M1", "M2"];
    const steps = buildSteps(mechanics, customSteps, "engine", "shooter");
    expect(steps[0].mechanics).toEqual(["M1"]);
    expect(steps[1].mechanics).toEqual(["M2"]);
    expect(steps[2].mechanics).toEqual(["M1"]);
    expect(steps[3].mechanics).toEqual(["M2"]);
  });
});

describe("buildSteps — edge cases", () => {
  it("handles empty mechanics array with fallbacks", () => {
    const steps = buildSteps([], undefined, "engine", "shooter");
    expect(steps.length).toBe(5);
    expect(steps[0].action).toBeTruthy();
  });

  it("handles single mechanic", () => {
    const steps = buildSteps(["Solo"], undefined, "engine", "shooter");
    expect(steps.length).toBe(5);
  });

  it("all steps have required fields", () => {
    const steps = buildSteps(["M1", "M2"], undefined, "engine", "shooter");
    for (const s of steps) {
      expect(s.action).toBeTruthy();
      expect(Array.isArray(s.mechanics)).toBe(true);
      expect(Array.isArray(s.resources_consumed)).toBe(true);
      expect(Array.isArray(s.resources_produced)).toBe(true);
      expect(["positive", "negative", "neutral"]).toContain(s.feedback_type);
      expect(typeof s.duration_estimate).toBe("number");
      expect(s.duration_estimate).toBeGreaterThan(0);
    }
  });
});
