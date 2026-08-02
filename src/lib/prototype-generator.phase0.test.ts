/**
 * Phase 0 tests for buildPrototypeConfig enhancements.
 *
 * Verifies:
 * - genre is passed through to config
 * - mechanicNames are used as steps when core loop steps are missing
 * - isTemplatePrototype flag is set correctly
 * - resolvedType preserves all 10 supported types
 * - unsupported structuralType falls back honestly (not silently to "engine")
 */

import { describe, expect, it } from "vitest";
import { buildPrototypeConfig } from "./prototype-generator";

describe("buildPrototypeConfig — Phase 0 enhancements", () => {
  describe("genre propagation", () => {
    it("stores genre in config when provided", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Collect", "Spend"] },
        "2d",
        { genre: "RPG" },
      );
      expect(config.genre).toBe("RPG");
    });

    it("handles null genre gracefully", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Collect"] },
        "2d",
        { genre: null },
      );
      expect(config.genre).toBeUndefined();
    });

    it("handles undefined options (backward compatibility)", () => {
      // Old 2-argument call signature must still work.
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Collect"] },
        "2d",
      );
      expect(config.genre).toBeUndefined();
      expect(config.mechanicNames).toBeUndefined();
      expect(config.type).toBe("engine");
    });
  });

  describe("mechanicNames as steps fallback", () => {
    it("uses mechanicNames when core loop steps are missing", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine" },
        "2d",
        { mechanicNames: ["Explore", "Combat", "Reward", "Upgrade"] },
      );
      expect(config.steps).toEqual(["Explore", "Combat", "Reward", "Upgrade"]);
    });

    it("uses mechanicNames when steps array is empty", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: [] },
        "2d",
        { mechanicNames: ["Jump", "Dash"] },
      );
      expect(config.steps).toEqual(["Jump", "Dash"]);
    });

    it("limits mechanicNames to 5 steps", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine" },
        "2d",
        { mechanicNames: ["A", "B", "C", "D", "E", "F", "G"] },
      );
      expect(config.steps).toHaveLength(5);
      expect(config.steps).toEqual(["A", "B", "C", "D", "E"]);
    });

    it("prefers explicit core loop steps over mechanicNames", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Explicit Step"] },
        "2d",
        { mechanicNames: ["Mechanic1", "Mechanic2"] },
      );
      expect(config.steps).toEqual(["Explicit Step"]);
    });

    it("stores mechanicNames in config for UI display", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Step"] },
        "2d",
        { mechanicNames: ["Explore", "Combat"] },
      );
      expect(config.mechanicNames).toEqual(["Explore", "Combat"]);
    });
  });

  describe("resolvedType preserves all 10 types", () => {
    const allTypes = [
      "engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle",
      "platformer", "stealth", "deck_builder", "survival_horror",
    ] as const;

    it.each(allTypes)("resolvedType='%s' is preserved from structuralType", (type) => {
      const config = buildPrototypeConfig(
        { structuralType: type, steps: ["Test"] },
        "2d",
      );
      expect(config.resolvedType).toBe(type);
    });

    it("falls back to 'engine' for unknown structuralType", () => {
      const config = buildPrototypeConfig(
        { structuralType: "unknown_type_xyz", steps: ["Test"] },
        "2d",
      );
      expect(config.resolvedType).toBe("engine");
    });

    it("falls back to 'engine' when structuralType is missing", () => {
      const config = buildPrototypeConfig(
        { steps: ["Test"] },
        "2d",
      );
      expect(config.resolvedType).toBe("engine");
    });
  });

  describe("isTemplatePrototype flag", () => {
    it("is true when structuralType is missing", () => {
      const config = buildPrototypeConfig(
        { steps: ["Test"] },
        "2d",
      );
      expect(config.isTemplatePrototype).toBe(true);
    });

    it("is true when steps are empty and no mechanicNames", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine" },
        "2d",
      );
      expect(config.isTemplatePrototype).toBe(true);
    });

    it("is false for legacy types with valid steps", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Collect", "Spend"] },
        "2d",
      );
      expect(config.isTemplatePrototype).toBe(false);
    });

    it("is true for new types (platformer, stealth, etc.)", () => {
      const newTypes = ["platformer", "stealth", "deck_builder", "survival_horror"] as const;
      for (const type of newTypes) {
        const config = buildPrototypeConfig(
          { structuralType: type, steps: ["Step"] },
          "2d",
        );
        expect(config.isTemplatePrototype).toBe(true);
      }
    });

    it("is false when mechanicNames substitute for missing steps", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine" },
        "2d",
        { mechanicNames: ["Explore", "Combat"] },
      );
      // mechanicNames fill in steps, so isTemplatePrototype should be false
      // (structuralType is present + steps are now non-empty).
      expect(config.isTemplatePrototype).toBe(false);
    });
  });

  describe("goalText for all types", () => {
    it.each([
      ["engine", "Накопите 50 энергии за 30 секунд"],
      ["ecology", "Выживите 30 секунд, уклоняясь от угроз"],
      ["tower_defense", "Защитите базу от 3 волн врагов за 30 секунд"],
      ["platformer", "Соберите 5 звёзд, перепрыгивая платформы (←→↑)"],
      ["stealth", "Дойдите до цели незамеченным (WASD + Shift для тишины)"],
    ])("type='%s' produces a non-empty goal", (type, expectedGoal) => {
      const config = buildPrototypeConfig(
        { structuralType: type, steps: ["Test"] },
        "2d",
      );
      expect(config.goalText).toBe(expectedGoal);
    });

    it("3D mode produces 3D-specific goals", () => {
      const config = buildPrototypeConfig(
        { structuralType: "engine", steps: ["Test"] },
        "3d",
      );
      expect(config.goalText).toContain("3D");
    });
  });

  describe("resource presets for new types", () => {
    it("platformer has 'Очки' resource", () => {
      const config = buildPrototypeConfig(
        { structuralType: "platformer", steps: ["Jump"] },
        "2d",
      );
      expect(config.resourceName).toBe("Очки");
      expect(config.resourceIcon).toBe("⭐");
    });

    it("stealth has 'Стелс' resource", () => {
      const config = buildPrototypeConfig(
        { structuralType: "stealth", steps: ["Sneak"] },
        "2d",
      );
      expect(config.resourceName).toBe("Стелс");
    });

    it("deck_builder has 'Карты' resource", () => {
      const config = buildPrototypeConfig(
        { structuralType: "deck_builder", steps: ["Draw"] },
        "2d",
      );
      expect(config.resourceName).toBe("Карты");
    });

    it("survival_horror has 'Ресурсы' resource", () => {
      const config = buildPrototypeConfig(
        { structuralType: "survival_horror", steps: ["Survive"] },
        "2d",
      );
      expect(config.resourceName).toBe("Ресурсы");
    });
  });
});
