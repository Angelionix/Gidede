/**
 * Shared deterministic runtime engine.
 *
 * Executes a PrototypeIR at a fixed 60 Hz timestep. The engine is
 * renderer-independent — it handles simulation logic (movement, collision,
 * resource deltas, step transitions, rule firing). Renderers (2D/3D) only
 * read the resulting state and draw it.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 9)
 *
 * Determinism contract:
 * - Same IR + same input sequence → same final state, across runs.
 * - Uses mulberry32 PRNG seeded from IR.seed.
 * - Entity IDs and spawn order are deterministic.
 *
 * Budgets (prevents event storm / unbounded growth):
 * - Max entities: 200
 * - Max rules fired per tick: 50
 * - Max telemetry events per tick: 100
 * - Max ticks: targetDurationSec * 60 * 2 (2x overshoot → timeout)
 */

import type {
  EffectSpec,
  PrototypeIR,
  RuleSpec,
  StepStateSpec,
} from "../ir/types";
import { createMulberry32 } from "./prng";
import { evaluatePredicate } from "./predicate-evaluator";
import {
  applyResourceDelta,
  createRuntimeState,
  despawnEntity,
  markStepCompleted,
  recordInput,
  spawnEntity,
  type InputEvent,
  type RuntimeEntity,
  type RuntimeState,
} from "./state";

const FIXED_HZ = 60;
const FIXED_DT = 1 / FIXED_HZ;
const MAX_ENTITIES = 200;
const MAX_RULES_PER_TICK = 50;
const MAX_TELEMETRY_PER_TICK = 100;
const MAX_TICKS_MULTIPLIER = 2; // 2x target duration → timeout

export interface EngineConfig {
  /** If true, the engine emits telemetry records. Default: true. */
  emitTelemetry: boolean;
  /** If true, NaN/Infinity checks raise an error. Default: true. */
  strictNumericChecks: boolean;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  emitTelemetry: true,
  strictNumericChecks: true,
};

export class PrototypeRuntimeEngine {
  private readonly ir: PrototypeIR;
  private readonly config: EngineConfig;
  private readonly prng: () => number;
  readonly state: RuntimeState;

  constructor(ir: PrototypeIR, config: Partial<EngineConfig> = {}) {
    this.ir = ir;
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...config };
    this.prng = createMulberry32(ir.seed);
    this.state = createRuntimeState();
    this.initializeState();
  }

  // ============================================================
  // Initialization
  // ============================================================

  private initializeState(): void {
    // Initialize resources.
    for (const res of this.ir.resources) {
      this.state.resources.set(res.id, res.initialValue);
      this.state.resourceMeta.set(res.id, {
        id: res.id,
        name: res.name,
        value: res.initialValue,
        min: res.min,
        max: res.max,
        class: res.class,
      });
    }

    // Initialize entities (only those with no spawn schedule).
    for (const entity of this.ir.entities) {
      if (entity.spawnSchedule === null) {
        this.spawnEntityFromSpec(entity);
      }
    }

    // Set initial step.
    if (this.ir.stepMachine.length > 0) {
      this.state.currentStepId = this.ir.stepMachine[0].id;
    }

    this.state.started = true;
    this.emitTelemetry("session_start", {});
  }

  private spawnEntityFromSpec(spec: {
    id: string;
    deterministicId: string;
    role: RuntimeEntity["role"];
    components: Array<{ kind: string; data?: unknown }>;
  }): void {
    if (this.state.entities.size >= MAX_ENTITIES) {
      this.emitTelemetry("entity_spawn_blocked", {
        entityId: spec.id,
        reason: "max_entities_reached",
      });
      return;
    }

    let position = { x: 0, y: 0 };
    let rotation = 0;
    let health: number | null = null;
    let maxHealth: number | null = null;
    let team: string | null = null;

    for (const comp of spec.components) {
      if (comp.kind === "transform") {
        const data = comp.data as { position: { x: number; y: number }; rotation: number };
        position = data.position;
        rotation = data.rotation;
      } else if (comp.kind === "health") {
        const data = comp.data as { max: number; current: number };
        health = data.current;
        maxHealth = data.max;
      } else if (comp.kind === "team") {
        const data = comp.data as { teamId: string };
        team = data.teamId;
      }
    }

    const entity: RuntimeEntity = {
      id: spec.id,
      deterministicId: spec.deterministicId,
      role: spec.role,
      position,
      rotation,
      velocity: { x: 0, y: 0 },
      health,
      maxHealth,
      team,
      cooldownEndsAt: null,
      alive: true,
      spawnedAt: this.state.elapsedSec,
    };
    spawnEntity(this.state, entity);
  }

  // ============================================================
  // Input
  // ============================================================

  /** Called by the renderer/input layer to submit an input event. */
  input(event: InputEvent): void {
    recordInput(this.state, event);
  }

  // ============================================================
  // Tick — advance the simulation by one fixed step
  // ============================================================

  /** Advance the simulation by one fixed timestep (1/60 sec). */
  tick(): void {
    if (this.state.status !== "running") return;

    const maxTicks = this.ir.session.targetDurationSec * FIXED_HZ * MAX_TICKS_MULTIPLIER;
    if (this.state.tick >= maxTicks) {
      this.state.status = "timeout";
      this.emitTelemetry("timeout", { tick: this.state.tick });
      return;
    }

    this.state.tick++;
    this.state.elapsedSec = this.state.tick * FIXED_DT;

    // Clear previous tick's telemetry if budget exceeded.
    if (this.state.telemetry.length > MAX_TELEMETRY_PER_TICK * 10) {
      this.state.telemetry = this.state.telemetry.slice(-MAX_TELEMETRY_PER_TICK);
    }

    // Process scheduled entity spawns.
    this.processScheduledSpawns();

    // Process pending inputs (apply movement, etc.).
    this.processInputs();

    // Update systems (movement, targeting, collision, etc.).
    this.updateSystems();

    // Fire rules whose triggers match.
    this.fireRules();

    // Update step machine.
    this.updateStepMachine();

    // Check session success/failure conditions.
    this.checkSessionConditions();

    // Clear pending inputs (consumed this tick).
    this.state.pendingInputs = [];

    // Strict numeric checks.
    if (this.config.strictNumericChecks) {
      this.checkNumericValidity();
    }

    // Clear telemetry for this tick (keep only the latest batch).
    if (this.config.emitTelemetry && this.state.telemetry.length > MAX_TELEMETRY_PER_TICK) {
      this.state.telemetry = this.state.telemetry.slice(-MAX_TELEMETRY_PER_TICK);
    }
  }

  /** Run the simulation until completion (or timeout). */
  run(maxTicksOverride?: number): void {
    const maxTicks = maxTicksOverride ?? this.ir.session.targetDurationSec * FIXED_HZ * MAX_TICKS_MULTIPLIER;
    while (this.state.status === "running" && this.state.tick < maxTicks) {
      this.tick();
    }
    if (this.state.status === "running") {
      this.state.status = "timeout";
      this.emitTelemetry("timeout", { tick: this.state.tick });
    }
    this.emitTelemetry("session_end", { status: this.state.status });
  }

  // ============================================================
  // Sub-systems
  // ============================================================

  private processScheduledSpawns(): void {
    for (const entity of this.ir.entities) {
      if (entity.spawnSchedule === null) continue;
      const schedule = entity.spawnSchedule;
      if (schedule.atTimeSec !== undefined && this.state.elapsedSec >= schedule.atTimeSec) {
        if (!this.state.entities.has(entity.id)) {
          this.spawnEntityFromSpec(entity);
        }
      }
      if (schedule.atStepId !== undefined && this.state.currentStepId === schedule.atStepId) {
        if (!this.state.entities.has(entity.id)) {
          this.spawnEntityFromSpec(entity);
        }
      }
    }
  }

  private processInputs(): void {
    for (const input of this.state.pendingInputs) {
      if (input.action === "move") {
        // Apply movement to player entity.
        const player = this.getPlayerEntity();
        if (player && input.position) {
          // Simple steering: set velocity toward input position.
          const dx = input.position.x - player.position.x;
          const dy = input.position.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            const movementSystem = this.ir.systems.find((s) => s.kind === "movement");
            const speed = (movementSystem?.config.speed as number) ?? 200;
            player.velocity.x = (dx / dist) * speed;
            player.velocity.y = (dy / dist) * speed;
          } else {
            player.velocity.x = 0;
            player.velocity.y = 0;
          }
        }
      }
      if (input.action === "primary_action") {
        // Emit a combat event for rule firing.
        this.emitTelemetry("mechanic_triggered", {
          mechanic: "combat",
          action: "primary_action",
        });
      }
    }
  }

  private updateSystems(): void {
    // Movement: apply velocity to position, apply friction.
    for (const entity of this.state.entities.values()) {
      if (entity.velocity.x !== 0 || entity.velocity.y !== 0) {
        entity.position.x += entity.velocity.x * FIXED_DT;
        entity.position.y += entity.velocity.y * FIXED_DT;

        // Clamp to world bounds.
        const bounds = this.ir.scene.bounds;
        const minX = bounds.center.x - bounds.halfExtents.x;
        const maxX = bounds.center.x + bounds.halfExtents.x;
        const minY = bounds.center.y - bounds.halfExtents.y;
        const maxY = bounds.center.y + bounds.halfExtents.y;
        entity.position.x = Math.max(minX, Math.min(maxX, entity.position.x));
        entity.position.y = Math.max(minY, Math.min(maxY, entity.position.y));

        // Friction (decelerate).
        const friction = 0.92;
        entity.velocity.x *= friction;
        entity.velocity.y *= friction;
        if (Math.abs(entity.velocity.x) < 1) entity.velocity.x = 0;
        if (Math.abs(entity.velocity.y) < 1) entity.velocity.y = 0;
      }
    }

    // Targeting: enemies move toward player.
    const player = this.getPlayerEntity();
    if (player) {
      const targetingSystem = this.ir.systems.find((s) => s.kind === "targeting");
      if (targetingSystem) {
        const enemySpeed = (targetingSystem.config.enemySpeed as number) ?? 60;
        for (const entity of this.state.entities.values()) {
          if (entity.role === "enemy" && entity.alive) {
            const dx = player.position.x - entity.position.x;
            const dy = player.position.y - entity.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 1) {
              entity.velocity.x = (dx / dist) * enemySpeed;
              entity.velocity.y = (dy / dist) * enemySpeed;
            }
          }
        }
      }
    }

    // Collision: collect / damage.
    this.processCollisions(player);
  }

  private processCollisions(player: RuntimeEntity | null): void {
    if (!player) return;

    const entitiesToRemove: string[] = [];

    for (const entity of this.state.entities.values()) {
      if (entity.id === player.id || !entity.alive) continue;

      const dist = Math.sqrt(
        (entity.position.x - player.position.x) ** 2 +
        (entity.position.y - player.position.y) ** 2,
      );

      // Collectible: collect on contact.
      if (entity.role === "collectible" && dist < 35) {
        const collectSystem = this.ir.systems.find((s) => s.kind === "collect");
        if (collectSystem) {
          const resourceId = collectSystem.config.resourceId as string;
          const value = collectSystem.config.valuePerCollectible as number;
          applyResourceDelta(this.state, resourceId, value);
          this.emitTelemetry("mechanic_triggered", {
            mechanic: "collect",
            entityId: entity.id,
          });
          entitiesToRemove.push(entity.id);
        }
      }

      // Hazard: damage player on contact.
      if (entity.role === "hazard" && dist < 45) {
        const hazardSystem = this.ir.systems.find((s) => s.kind === "collision");
        if (hazardSystem) {
          const damage = hazardSystem.config.damagePerContact as number;
          const healthResource = hazardSystem.config.damageResource as string;
          if (healthResource) {
            // Damage tick every 0.5s.
            if (entity.cooldownEndsAt === null || this.state.elapsedSec >= entity.cooldownEndsAt) {
              applyResourceDelta(this.state, healthResource, -damage);
              this.emitTelemetry("damage", { amount: damage, source: entity.id });
              entity.cooldownEndsAt = this.state.elapsedSec + 0.5;
            }
          }
        }
      }

      // Enemy: damage player on contact.
      if (entity.role === "enemy" && dist < 40) {
        const combatSystem = this.ir.systems.find((s) => s.kind === "combat");
        if (combatSystem) {
          const damage = combatSystem.config.enemyDamage as number;
          // Find the health resource.
          const healthResource = Array.from(this.state.resourceMeta.values()).find(
            (r) => r.name === "Health",
          );
          if (healthResource) {
            if (entity.cooldownEndsAt === null || this.state.elapsedSec >= entity.cooldownEndsAt) {
              applyResourceDelta(this.state, healthResource.id, -damage);
              this.emitTelemetry("damage", { amount: damage, source: entity.id });
              entity.cooldownEndsAt = this.state.elapsedSec + 0.5;
            }
          }
        }
      }
    }

    for (const id of entitiesToRemove) {
      despawnEntity(this.state, id);
    }

    // Check player death.
    const healthResource = Array.from(this.state.resourceMeta.values()).find(
      (r) => r.name === "Health",
    );
    if (healthResource) {
      const hp = this.state.resources.get(healthResource.id) ?? 0;
      if (hp <= 0 && this.state.status === "running") {
        this.state.status = "lost";
        this.emitTelemetry("death", {});
        this.emitTelemetry("lose", {});
      }
    }
  }

  private fireRules(): void {
    let rulesFired = 0;
    for (const rule of this.ir.rules) {
      if (rulesFired >= MAX_RULES_PER_TICK) {
        this.emitTelemetry("rules_capped", { limit: MAX_RULES_PER_TICK });
        break;
      }
      // Check trigger (only event-triggered rules fire here; predicate-triggered
      // rules are checked in updateStepMachine).
      if (rule.trigger.kind === "event") {
        // Check if the event was emitted this tick.
        const eventMatched = this.state.telemetry.some(
          (t) => t.event === rule.trigger.eventId,
        );
        if (eventMatched && evaluatePredicate(rule.guard, this.state)) {
          this.applyEffects(rule.effects);
          rulesFired++;
        }
      }
    }
  }

  private updateStepMachine(): void {
    if (this.state.currentStepId === null) return;

    const currentStep = this.ir.stepMachine.find(
      (s) => s.id === this.state.currentStepId,
    );
    if (!currentStep) return;

    // Check completion.
    if (evaluatePredicate(currentStep.completionPredicate, this.state)) {
      markStepCompleted(this.state, currentStep.id);
      this.applyEffects(currentStep.effects);

      // Transition to next step.
      if (currentStep.nextStepId) {
        const nextStep = this.ir.stepMachine.find(
          (s) => s.id === currentStep.nextStepId,
        );
        if (nextStep) {
          // If next step is the first step (loop closed), increment loop count.
          if (currentStep.nextStepId === this.ir.stepMachine[0].id) {
            this.state.loopCount++;
            this.emitTelemetry("loop_complete", { count: this.state.loopCount });
          }
          this.state.currentStepId = nextStep.id;
          this.emitTelemetry("step_enter", { stepId: nextStep.id });
        }
      }
    }

    // Fire predicate-triggered rules.
    for (const rule of this.ir.rules) {
      if (rule.trigger.kind === "predicate") {
        if (evaluatePredicate(rule.trigger.predicate, this.state) && evaluatePredicate(rule.guard, this.state)) {
          this.applyEffects(rule.effects);
        }
      }
    }
  }

  private applyEffects(effects: EffectSpec[]): void {
    for (const effect of effects) {
      switch (effect.kind) {
        case "resource_delta":
          applyResourceDelta(this.state, effect.resourceId, effect.delta);
          break;
        case "set_step":
          this.state.currentStepId = effect.stepId;
          this.emitTelemetry("step_enter", { stepId: effect.stepId });
          break;
        case "spawn_entity": {
          const entity: RuntimeEntity = {
            id: `spawned-${this.state.tick}-${this.prng().toString(36).substring(2, 8)}`,
            deterministicId: `det-spawned-${this.state.tick}`,
            role: effect.roleId as RuntimeEntity["role"],
            position: effect.position,
            rotation: 0,
            velocity: { x: 0, y: 0 },
            health: null,
            maxHealth: null,
            team: null,
            cooldownEndsAt: null,
            alive: true,
            spawnedAt: this.state.elapsedSec,
          };
          spawnEntity(this.state, entity);
          break;
        }
        case "despawn_entity":
          despawnEntity(this.state, effect.entityId);
          break;
        case "increment_loop_count":
          this.state.loopCount++;
          this.emitTelemetry("loop_complete", { count: this.state.loopCount });
          break;
        case "reset_loop":
          this.state.loopCount = 0;
          break;
      }
    }
  }

  private checkSessionConditions(): void {
    if (this.state.status !== "running") return;

    // Check success.
    if (evaluatePredicate(this.ir.session.success, this.state)) {
      this.state.status = "won";
      this.emitTelemetry("win", {});
      return;
    }

    // Check failure conditions.
    for (const failPredicate of this.ir.session.failure) {
      if (evaluatePredicate(failPredicate, this.state)) {
        this.state.status = "lost";
        this.emitTelemetry("lose", { reason: "failure_condition" });
        return;
      }
    }
  }

  private checkNumericValidity(): void {
    for (const entity of this.state.entities.values()) {
      if (!Number.isFinite(entity.position.x) || !Number.isFinite(entity.position.y)) {
        throw new Error(
          `NaN/Infinity detected in entity '${entity.id}' position at tick ${this.state.tick}`,
        );
      }
    }
    for (const [id, value] of this.state.resources) {
      if (!Number.isFinite(value)) {
        throw new Error(
          `NaN/Infinity detected in resource '${id}' at tick ${this.state.tick}`,
        );
      }
    }
  }

  private getPlayerEntity(): RuntimeEntity | null {
    for (const entity of this.state.entities.values()) {
      if (entity.role === "player") return entity;
    }
    return null;
  }

  private emitTelemetry(event: string, data: Record<string, unknown>): void {
    if (!this.config.emitTelemetry) return;
    this.state.telemetry.push({
      event,
      data,
      tick: this.state.tick,
      timestamp: this.state.elapsedSec,
    });
  }

  // ============================================================
  // Public accessors (for renderers)
  // ============================================================

  getEntities(): RuntimeEntity[] {
    return Array.from(this.state.entities.values());
  }

  getResource(resourceId: string): number {
    return this.state.resources.get(resourceId) ?? 0;
  }

  getElapsedSec(): number {
    return this.state.elapsedSec;
  }

  getStatus(): RuntimeState["status"] {
    return this.state.status;
  }

  getCurrentStepId(): string | null {
    return this.state.currentStepId;
  }

  getLoopCount(): number {
    return this.state.loopCount;
  }

  /** Drain telemetry events (called by renderer after each tick). */
  drainTelemetry(): RuntimeState["telemetry"] {
    const events = this.state.telemetry;
    this.state.telemetry = [];
    return events;
  }
}
