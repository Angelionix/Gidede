/**
 * Combat adapter.
 *
 * Compiles combat mechanics (aim, shoot, melee, attack, strike, cast)
 * into target entities, projectiles, health components, a combat system,
 * and aim/shoot controls.
 *
 * Primitive behaviour: target, projectile/hitbox, health.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 7)
 */

import type {
  ControlBindingSpec,
  EntitySpec,
  EffectSpec,
  ObjectiveSpec,
  PredicateSpec,
  ResourceSpec,
  RuleSpec,
  SystemSpec,
  TelemetryEventName,
} from "../ir/types";
import type {
  MechanicAdapter,
  MechanicCompileContext,
  MechanicFragment,
} from "../registry/registry";

const ADAPTER_ID = "target/combat";
const ADAPTER_VERSION = "1.0.0";

export function createCombatAdapter(): MechanicAdapter {
  return {
    adapterId: ADAPTER_ID,
    version: ADAPTER_VERSION,
    mechanicIds: ["combat"],
    capabilities: ["target/combat"],
    compatibleTopologies: ["arena", "lanes", "rooms"],
    requiredContext: ["player", "target"],

    compile(context: MechanicCompileContext): MechanicFragment {
      const enemyDamage = context.difficulty === "hard" ? 20 : context.difficulty === "easy" ? 8 : 12;
      const enemyHealth = context.difficulty === "hard" ? 60 : context.difficulty === "easy" ? 20 : 40;
      const projectileSpeed = 400;

      // Combat system: handles projectiles, hit detection, damage.
      const combatSystem: SystemSpec = {
        id: `sys-${context.stepId}-combat`,
        kind: "combat",
        appliesToRoles: ["player", "enemy", "projectile"],
        config: {
          projectileSpeed,
          damagePerHit: 10,
          enemyDamage,
          friendlyFire: false,
        },
      };

      // Targeting system: enemies move toward player.
      const targetingSystem: SystemSpec = {
        id: `sys-${context.stepId}-targeting`,
        kind: "targeting",
        appliesToRoles: ["enemy"],
        config: {
          enemySpeed: context.difficulty === "hard" ? 100 : 60,
          detectionRadius: 350,
        },
      };

      // Controls: aim (pointer) + primary_action (shoot).
      const controls: ControlBindingSpec[] = [
        {
          action: "aim",
          binding: { kind: "pointer" },
          contextPredicate: null,
        },
        {
          action: "primary_action",
          binding: { kind: "keyboard", keys: ["space", "mouse0"] },
          contextPredicate: null,
        },
      ];

      // Enemy entities: 2 placed deterministically.
      const seedHash = hashString(context.seed + context.stepId);
      const enemies: EntitySpec[] = [];
      const positions = deterministicPositions(seedHash, 2, 250);
      for (let i = 0; i < 2; i++) {
        const pos = positions[i];
        enemies.push({
          id: `entity-${context.stepId}-enemy-${i}`,
          role: "enemy",
          deterministicId: `det-enemy-${context.stepId}-${i}-${seedHash.toString(16).substring(0, 4)}`,
          components: [
            {
              kind: "transform",
              data: {
                position: pos,
                rotation: 0,
                scale: { x: 1, y: 1 },
              },
            },
            {
              kind: "collider",
              shape: "circle",
              data: { center: pos, radius: 20 },
            },
            {
              kind: "health",
              max: enemyHealth,
              current: enemyHealth,
            },
            {
              kind: "team",
              teamId: "enemy",
            },
          ],
          spawnSchedule: null,
        });
      }

      // Rule: on hit event → damage target.
      const hitRule: RuleSpec = {
        id: `rule-${context.stepId}-combat-hit`,
        sourceMechanicId: "combat",
        trigger: { kind: "event", eventId: "hit" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [], // damage applied by combat system based on projectile-entity collision
      };

      // Rule: on enemy death → spawn new enemy (respawn) or count kill.
      const killRule: RuleSpec = {
        id: `rule-${context.stepId}-combat-kill`,
        sourceMechanicId: "combat",
        trigger: { kind: "event", eventId: "enemy_death" },
        guard: { kind: "loop_count_gte", value: 0 },
        effects: [
          { kind: "resource_delta", resourceId: `res-${context.stepId}-kills`, delta: 1 },
        ],
      };

      // Resource: kill counter.
      const killResource: ResourceSpec = {
        id: `res-${context.stepId}-kills`,
        name: "Kills",
        icon: "💀",
        class: "secondary",
        initialValue: 0,
        min: 0,
        max: null,
      };

      // Objective: defeat N enemies.
      const objective: ObjectiveSpec = {
        id: `obj-${context.stepId}-combat`,
        label: `Defeat ${enemies.length} enemies`,
        predicate: {
          kind: "resource_gte",
          resourceId: killResource.id,
          value: enemies.length,
        },
        required: true,
        stepId: context.stepId,
      };

      return {
        rules: [hitRule, killRule],
        systems: [combatSystem, targetingSystem],
        controls,
        objectives: [objective],
        requiredResources: [killResource],
        requiredEntities: enemies,
        telemetryEvents: ["mechanic_triggered", "damage", "death"],
        assumptions: [
          `Enemy damage set to ${enemyDamage} based on difficulty '${context.difficulty}'`,
          `Enemy health set to ${enemyHealth}`,
          `Projectile speed: ${projectileSpeed} units/sec`,
          "Enemies use simple seeking AI (move toward player)",
          "Friendly fire is disabled",
        ],
      };
    },

    validate(fragment: MechanicFragment) {
      const diagnostics = [];
      const hasCombatSystem = fragment.systems.some((s) => s.kind === "combat");
      if (!hasCombatSystem) {
        diagnostics.push({
          level: "error" as const,
          code: "combat.no_system",
          message: "Combat fragment must include a combat system",
        });
      }
      const hasEnemies = fragment.requiredEntities.some((e) => e.role === "enemy");
      if (!hasEnemies) {
        diagnostics.push({
          level: "error" as const,
          code: "combat.no_enemies",
          message: "Combat fragment must declare at least one enemy entity",
        });
      }
      const enemiesWithHealth = fragment.requiredEntities.filter(
        (e) => e.role === "enemy" && e.components.some((c) => c.kind === "health"),
      );
      if (enemiesWithHealth.length === 0) {
        diagnostics.push({
          level: "warning" as const,
          code: "combat.enemies_no_health",
          message: "Enemies without health components cannot be defeated",
        });
      }
      return diagnostics;
    },

    botPolicy: {
      actions: ["aim", "primary_action"],
      expectedSuccessRate: 0.7,
    },
  };
}

// ============================================================
// Deterministic helpers (duplicated from collect.ts for module independence)
// ============================================================

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function deterministicPositions(seed: number, count: number, radius: number): Array<{ x: number; y: number }> {
  const positions: Array<{ x: number; y: number }> = [];
  let state = seed || 1;
  for (let i = 0; i < count; i++) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const angle = (state / 0xffffffff) * Math.PI * 2;
    state = (state * 1664525 + 1013904223) >>> 0;
    const r = (state / 0xffffffff) * radius;
    positions.push({
      x: Math.cos(angle) * r,
      y: Math.sin(angle) * r,
    });
  }
  return positions;
}
