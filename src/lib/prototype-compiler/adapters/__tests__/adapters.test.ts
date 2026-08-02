/**
 * Tests for the mechanic adapter registry and the 4 built-in adapters.
 *
 * Phase 1.2 acceptance criteria:
 * - 4 adapters work (locomotion, collect, combat, survival)
 * - Unknown mechanics honestly return `unsupported`
 * - Aliases resolve correctly
 * - User overrides take precedence
 * - Each adapter generates a valid MechanicFragment
 * - Adapter validation catches missing required fields
 */

import { describe, expect, it, beforeEach } from "vitest";
import {
  getMechanicAdapterRegistry,
  resetMechanicAdapterRegistry,
  type MechanicCompileContext,
} from "../../registry/registry";
import { createLocomotionAdapter } from "../locomotion";
import { createCollectAdapter } from "../collect";
import { createCombatAdapter } from "../combat";
import { createSurvivalAdapter } from "../survival";

function makeContext(overrides: Partial<MechanicCompileContext> = {}): MechanicCompileContext {
  return {
    stepId: "step-1",
    stepLabel: "Test Step",
    availableResources: [],
    existingSteps: [],
    difficulty: "baseline",
    seed: "abcdef0123",
    ...overrides,
  };
}

describe("MechanicAdapterRegistry — resolution", () => {
  beforeEach(() => {
    resetMechanicAdapterRegistry(true);
  });

  it("resolves canonical mechanic IDs exactly", () => {
    const reg = getMechanicAdapterRegistry();
    const result = reg.resolve("locomotion");
    expect(result).not.toBeNull();
    expect(result?.resolution).toBe("exact");
    expect(result?.adapter.adapterId).toBe("locomotion");
  });

  it("resolves aliases correctly", () => {
    const reg = getMechanicAdapterRegistry();
    const aliases = ["move", "dodge", "jump", "run", "walk", "fly", "swim"];
    for (const alias of aliases) {
      const result = reg.resolve(alias);
      expect(result).not.toBeNull();
      expect(result?.resolution).toBe("alias");
      expect(result?.adapter.adapterId).toBe("locomotion");
    }
  });

  it("returns null for unsupported mechanics", () => {
    const reg = getMechanicAdapterRegistry();
    const result = reg.resolve("social_dialogue");
    expect(result).toBeNull();
  });

  it("resolveBinding returns unsupported binding for unknown mechanics", () => {
    const reg = getMechanicAdapterRegistry();
    const binding = reg.resolveBinding("social_dialogue");
    expect(binding.resolution).toBe("unsupported");
    expect(binding.adapterId).toBeNull();
    expect(binding.adapterVersion).toBeNull();
  });

  it("user_override takes precedence over exact match", () => {
    const reg = getMechanicAdapterRegistry();
    // Override 'locomotion' to use the 'collect' adapter.
    const result = reg.resolve("locomotion", { locomotion: "collect" });
    expect(result).not.toBeNull();
    expect(result?.resolution).toBe("user_override");
    expect(result?.adapter.adapterId).toBe("collect");
  });

  it("resolves all 4 built-in adapters", () => {
    const reg = getMechanicAdapterRegistry();
    expect(reg.resolve("locomotion")?.adapter.adapterId).toBe("locomotion");
    expect(reg.resolve("collect")?.adapter.adapterId).toBe("target/combat" === "collect" ? "collect" : "collect");
    expect(reg.resolve("combat")?.adapter.adapterId).toBe("target/combat");
    expect(reg.resolve("survival")?.adapter.adapterId).toBe("avoid/survive");
  });

  it("list() returns all registered adapters", () => {
    const reg = getMechanicAdapterRegistry();
    const list = reg.list();
    expect(list).toHaveLength(4);
    const ids = list.map((a) => a.adapterId);
    expect(ids).toContain("locomotion");
    expect(ids).toContain("collect");
    expect(ids).toContain("target/combat");
    expect(ids).toContain("avoid/survive");
  });
});

describe("Locomotion adapter", () => {
  it("compiles a valid fragment with movement system and controls", () => {
    const adapter = createLocomotionAdapter();
    const fragment = adapter.compile(makeContext());

    expect(fragment.systems).toHaveLength(1);
    expect(fragment.systems[0].kind).toBe("movement");
    expect(fragment.controls.length).toBeGreaterThanOrEqual(2); // WASD + arrows + touch
    expect(fragment.requiredEntities.some((e) => e.role === "player")).toBe(true);
    expect(fragment.telemetryEvents).toContain("input_action");
    expect(fragment.assumptions.length).toBeGreaterThan(0);
  });

  it("adjusts speed based on difficulty", () => {
    const adapter = createLocomotionAdapter();

    const easyFragment = adapter.compile(makeContext({ difficulty: "easy" }));
    const hardFragment = adapter.compile(makeContext({ difficulty: "hard" }));

    const easySpeed = easyFragment.systems[0].config.speed as number;
    const hardSpeed = hardFragment.systems[0].config.speed as number;
    expect(easySpeed).toBeLessThan(hardSpeed);
  });

  it("passes validation for a complete fragment", () => {
    const adapter = createLocomotionAdapter();
    const fragment = adapter.compile(makeContext());
    const diagnostics = adapter.validate(fragment);
    const errors = diagnostics.filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("fails validation when movement system is missing", () => {
    const adapter = createLocomotionAdapter();
    const fragment = adapter.compile(makeContext());
    const broken = { ...fragment, systems: [] };
    const diagnostics = adapter.validate(broken);
    expect(diagnostics.some((d) => d.code === "locomotion.no_system")).toBe(true);
  });

  it("has a bot policy", () => {
    const adapter = createLocomotionAdapter();
    expect(adapter.botPolicy).toBeDefined();
    expect(adapter.botPolicy?.actions).toContain("move");
  });
});

describe("Collect adapter", () => {
  it("compiles collectibles, collect system, and resource_delta rule", () => {
    const adapter = createCollectAdapter();
    const fragment = adapter.compile(makeContext());

    expect(fragment.systems.some((s) => s.kind === "collect")).toBe(true);
    expect(fragment.requiredEntities.some((e) => e.role === "collectible")).toBe(true);
    expect(fragment.requiredEntities.filter((e) => e.role === "collectible").length).toBe(3);

    const collectRule = fragment.rules.find((r) =>
      r.effects.some((e) => e.kind === "resource_delta"),
    );
    expect(collectRule).toBeDefined();
    expect(collectRule?.sourceMechanicId).toBe("collect");
  });

  it("creates a new resource when none available", () => {
    const adapter = createCollectAdapter();
    const fragment = adapter.compile(makeContext());
    expect(fragment.requiredResources).toHaveLength(1);
    expect(fragment.requiredResources[0].name).toBe("Collected");
    expect(fragment.requiredResources[0].class).toBe("core");
  });

  it("reuses an existing core resource when available", () => {
    const adapter = createCollectAdapter();
    const fragment = adapter.compile(makeContext({
      availableResources: [{
        id: "gold",
        name: "Gold",
        icon: "💰",
        class: "core",
        initialValue: 0,
        min: 0,
        max: null,
      }],
    }));
    expect(fragment.requiredResources).toHaveLength(0); // reused, not created
    const collectRule = fragment.rules.find((r) =>
      r.effects.some((e) => e.kind === "resource_delta"),
    );
    expect(collectRule?.effects[0]).toMatchObject({ resourceId: "gold" });
  });

  it("passes validation for a complete fragment", () => {
    const adapter = createCollectAdapter();
    const fragment = adapter.compile(makeContext());
    const errors = adapter.validate(fragment).filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("fails validation when collectibles are missing", () => {
    const adapter = createCollectAdapter();
    const fragment = adapter.compile(makeContext());
    const broken = { ...fragment, requiredEntities: [] };
    const diagnostics = adapter.validate(broken);
    expect(diagnostics.some((d) => d.code === "collect.no_collectibles")).toBe(true);
  });
});

describe("Combat adapter", () => {
  it("compiles enemies with health, combat system, and aim/shoot controls", () => {
    const adapter = createCombatAdapter();
    const fragment = adapter.compile(makeContext());

    expect(fragment.systems.some((s) => s.kind === "combat")).toBe(true);
    expect(fragment.systems.some((s) => s.kind === "targeting")).toBe(true);
    expect(fragment.requiredEntities.some((e) => e.role === "enemy")).toBe(true);

    const enemies = fragment.requiredEntities.filter((e) => e.role === "enemy");
    expect(enemies.length).toBe(2);
    expect(enemies.every((e) => e.components.some((c) => c.kind === "health"))).toBe(true);

    const actions = fragment.controls.map((c) => c.action);
    expect(actions).toContain("aim");
    expect(actions).toContain("primary_action");
  });

  it("adjusts enemy health and damage based on difficulty", () => {
    const adapter = createCombatAdapter();

    const easy = adapter.compile(makeContext({ difficulty: "easy" }));
    const hard = adapter.compile(makeContext({ difficulty: "hard" }));

    const easyHealth = easy.requiredEntities.find((e) => e.role === "enemy")?.components.find((c) => c.kind === "health");
    const hardHealth = hard.requiredEntities.find((e) => e.role === "enemy")?.components.find((c) => c.kind === "health");

    expect((easyHealth as { max: number }).max).toBeLessThan((hardHealth as { max: number }).max);
  });

  it("creates a kill counter resource and defeat objective", () => {
    const adapter = createCombatAdapter();
    const fragment = adapter.compile(makeContext());

    const killResource = fragment.requiredResources.find((r) => r.name === "Kills");
    expect(killResource).toBeDefined();
    expect(killResource?.class).toBe("secondary");

    const objective = fragment.objectives[0];
    expect(objective).toBeDefined();
    expect(objective.required).toBe(true);
  });

  it("passes validation for a complete fragment", () => {
    const adapter = createCombatAdapter();
    const fragment = adapter.compile(makeContext());
    const errors = adapter.validate(fragment).filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });
});

describe("Survival adapter", () => {
  it("compiles hazards, health resource, and damage rule", () => {
    const adapter = createSurvivalAdapter();
    const fragment = adapter.compile(makeContext());

    expect(fragment.systems.some((s) => s.kind === "collision")).toBe(true);
    expect(fragment.requiredEntities.some((e) => e.role === "hazard")).toBe(true);
    expect(fragment.requiredEntities.filter((e) => e.role === "hazard").length).toBe(3);

    const health = fragment.requiredResources.find((r) => r.name === "Health");
    expect(health).toBeDefined();
    expect(health?.min).toBe(0);
    expect(health?.max).toBeGreaterThan(0);

    const damageRule = fragment.rules.find((r) =>
      r.effects.some((e) => e.kind === "resource_delta" && e.delta < 0),
    );
    expect(damageRule).toBeDefined();
  });

  it("adjusts player health based on difficulty", () => {
    const adapter = createSurvivalAdapter();

    const easy = adapter.compile(makeContext({ difficulty: "easy" }));
    const hard = adapter.compile(makeContext({ difficulty: "hard" }));

    const easyHealth = easy.requiredResources.find((r) => r.name === "Health");
    const hardHealth = hard.requiredResources.find((r) => r.name === "Health");
    expect((easyHealth as { max: number }).max).toBeGreaterThan((hardHealth as { max: number }).max);
  });

  it("passes validation for a complete fragment", () => {
    const adapter = createSurvivalAdapter();
    const fragment = adapter.compile(makeContext());
    const errors = adapter.validate(fragment).filter((d) => d.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("fails validation when hazards are missing", () => {
    const adapter = createSurvivalAdapter();
    const fragment = adapter.compile(makeContext());
    const broken = { ...fragment, requiredEntities: [] };
    const diagnostics = adapter.validate(broken);
    expect(diagnostics.some((d) => d.code === "survival.no_hazards")).toBe(true);
  });
});

describe("Registry — duplicate registration", () => {
  it("throws when registering the same adapterId twice", () => {
    resetMechanicAdapterRegistry(false);
    const reg = getMechanicAdapterRegistry();
    reg.register(createLocomotionAdapter());
    expect(() => reg.register(createLocomotionAdapter())).toThrow(/already registered/);
  });

  it("throws when two adapters claim the same mechanic ID", () => {
    resetMechanicAdapterRegistry(false);
    const reg = getMechanicAdapterRegistry();
    reg.register(createLocomotionAdapter());
    // Create a fake adapter that also claims 'locomotion'.
    const dup = {
      ...createCollectAdapter(),
      mechanicIds: ["locomotion"],
    };
    expect(() => reg.register(dup)).toThrow(/already registered/);
  });
});
