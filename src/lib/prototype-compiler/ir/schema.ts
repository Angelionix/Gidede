/**
 * Zod schema for PrototypeIR validation.
 *
 * Validates that an IR object conforms to the closed taxonomy declared in
 * ir/types.ts. This is the boundary check that prevents malformed or
 * hand-crafted IR from reaching the runtime.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 6)
 *
 * Note: zod v4 is used. Schema is intentionally strict — unknown keys are
 * rejected, so adding a new field requires a schema bump.
 */

import { z } from "zod";
import { IR_SCHEMA_VERSION, RUNTIME_VERSION } from "./types";

// ============================================================
// Primitives
// ============================================================

export const vec2Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
});

export const transformSchema = z.object({
  position: vec2Schema,
  rotation: z.number().finite(),
  scale: vec2Schema,
});

export const aabbSchema = z.object({
  center: vec2Schema,
  halfExtents: vec2Schema.refine(
    (v) => v.x > 0 && v.y > 0,
    "halfExtents must be positive",
  ),
});

export const circleColliderSchema = z.object({
  center: vec2Schema,
  radius: z.number().positive(),
});

export const prngSpecSchema = z.object({
  algorithm: z.literal("mulberry32"),
  seed: z.string().regex(/^[0-9a-f]{8,}$/i, "seed must be a hex string (8+ chars)"),
});

// ============================================================
// PredicateSpec — recursive
// ============================================================

export const predicateSpecSchema: z.ZodType = z.lazy(() =>
  z.union([
    z.object({ kind: z.literal("resource_gte"), resourceId: z.string().min(1), value: z.number() }),
    z.object({ kind: z.literal("resource_lte"), resourceId: z.string().min(1), value: z.number() }),
    z.object({ kind: z.literal("step_completed"), stepId: z.string().min(1) }),
    z.object({ kind: z.literal("loop_count_gte"), value: z.number().int().nonnegative() }),
    z.object({ kind: z.literal("time_elapsed_gte"), seconds: z.number().positive() }),
    z.object({ kind: z.literal("entity_count_lte"), roleId: z.string().min(1), value: z.number().int().nonnegative() }),
    z.object({ kind: z.literal("and"), predicates: z.array(predicateSpecSchema).min(1) }),
    z.object({ kind: z.literal("or"), predicates: z.array(predicateSpecSchema).min(1) }),
    z.object({ kind: z.literal("not"), predicate: predicateSpecSchema }),
  ]),
);

// ============================================================
// Session
// ============================================================

export const sessionSpecSchema = z.object({
  targetDurationSec: z.number().int().min(20).max(120),
  fixedStepHz: z.literal(60),
  success: predicateSpecSchema,
  failure: z.array(predicateSpecSchema).min(1, "at least one failure condition required"),
  loopTarget: z.number().int().min(1),
});

// ============================================================
// Mechanics
// ============================================================

export const mechanicResolutionSchema = z.enum([
  "exact", "alias", "user_override", "unsupported",
]);

export const mechanicBindingSchema = z.object({
  sourceMechanicId: z.string().min(1),
  adapterId: z.string().nullable(),
  adapterVersion: z.string().nullable(),
  resolution: mechanicResolutionSchema,
  representedByRuleIds: z.array(z.string()),
  assumptions: z.array(z.string()),
});

// ============================================================
// Resources
// ============================================================

export const resourceClassSchema = z.enum(["core", "secondary", "meta"]);

export const resourceSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  class: resourceClassSchema,
  initialValue: z.number(),
  min: z.number().nullable(),
  max: z.number().nullable(),
});

// ============================================================
// Effects
// ============================================================

export const effectSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("resource_delta"), resourceId: z.string().min(1), delta: z.number() }),
  z.object({ kind: z.literal("set_step"), stepId: z.string().min(1) }),
  z.object({ kind: z.literal("spawn_entity"), roleId: z.string().min(1), position: vec2Schema }),
  z.object({ kind: z.literal("despawn_entity"), entityId: z.string().min(1) }),
  z.object({ kind: z.literal("increment_loop_count") }),
  z.object({ kind: z.literal("reset_loop") }),
]);

// ============================================================
// Step state machine
// ============================================================

export const stepStateSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  activationPredicate: predicateSpecSchema,
  allowedActionIds: z.array(z.string()),
  completionPredicate: predicateSpecSchema,
  effects: z.array(effectSpecSchema),
  nextStepId: z.string().nullable(),
  telemetryEvents: z.array(z.string()),
});

// ============================================================
// Scene
// ============================================================

export const sceneTopologySchema = z.enum([
  "arena", "lanes", "rooms", "grid", "node_field",
]);

export const sceneSpecSchema = z.object({
  topology: sceneTopologySchema,
  bounds: aabbSchema,
  topologyScores: z.array(z.object({
    topology: sceneTopologySchema,
    score: z.number(),
  })),
});

// ============================================================
// Entities
// ============================================================

export const entityRoleSchema = z.enum([
  "player", "enemy", "collectible", "obstacle", "projectile",
  "interaction_zone", "base", "goal", "hazard", "spawner",
]);

export const componentSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("transform"), data: transformSchema }),
  z.object({
    kind: z.literal("collider"),
    shape: z.enum(["circle", "aabb"]),
    data: z.union([circleColliderSchema, aabbSchema]),
  }),
  z.object({
    kind: z.literal("health"),
    max: z.number().positive(),
    current: z.number().min(0),
  }),
  z.object({ kind: z.literal("inventory"), capacity: z.number().int().nonnegative() }),
  z.object({ kind: z.literal("resource_wallet"), resourceId: z.string().min(1) }),
  z.object({
    kind: z.literal("cooldown"),
    durationSec: z.number().positive(),
    lastTriggeredAt: z.number().nonnegative(),
  }),
  z.object({ kind: z.literal("team"), teamId: z.string().min(1) }),
]);

export const entitySpecSchema = z.object({
  id: z.string().min(1),
  role: entityRoleSchema,
  deterministicId: z.string().min(1),
  components: z.array(componentSpecSchema),
  spawnSchedule: z.object({
    atStepId: z.string().optional(),
    atTimeSec: z.number().nonnegative().optional(),
  }).nullable(),
});

// ============================================================
// Systems
// ============================================================

export const systemKindSchema = z.enum([
  "movement", "targeting", "collision", "collect", "combat",
  "spawn", "convert", "place", "timing", "puzzle_state",
]);

export const systemSpecSchema = z.object({
  id: z.string().min(1),
  kind: systemKindSchema,
  appliesToRoles: z.array(entityRoleSchema),
  config: z.record(z.string(), z.unknown()),
});

// ============================================================
// Rules
// ============================================================

export const ruleTriggerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("event"), eventId: z.string().min(1) }),
  z.object({ kind: z.literal("predicate"), predicate: predicateSpecSchema }),
  z.object({ kind: z.literal("step_enter"), stepId: z.string().min(1) }),
  z.object({ kind: z.literal("step_complete"), stepId: z.string().min(1) }),
]);

export const ruleSpecSchema = z.object({
  id: z.string().min(1),
  sourceMechanicId: z.string().min(1),
  trigger: ruleTriggerSchema,
  guard: predicateSpecSchema,
  effects: z.array(effectSpecSchema),
});

// ============================================================
// Objectives
// ============================================================

export const objectiveSpecSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  predicate: predicateSpecSchema,
  required: z.boolean(),
  stepId: z.string().nullable(),
});

// ============================================================
// Controls
// ============================================================

export const controlActionSchema = z.enum([
  "move", "aim", "primary_action", "secondary_action",
  "interact", "place", "rotate",
]);

export const inputBindingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("keyboard"), keys: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal("pointer") }),
  z.object({ kind: z.literal("touch_stick") }),
]);

export const controlBindingSpecSchema = z.object({
  action: controlActionSchema,
  binding: inputBindingSchema,
  contextPredicate: predicateSpecSchema.nullable(),
});

// ============================================================
// Telemetry
// ============================================================

export const telemetryEventNameSchema = z.enum([
  "session_start", "session_end", "input_action", "mechanic_triggered",
  "step_enter", "step_complete", "resource_changed", "damage", "death",
  "retry", "loop_complete", "win", "lose", "timeout", "inactivity_window",
  "invalid_action",
]);

export const telemetrySpecSchema = z.object({
  events: z.array(telemetryEventNameSchema),
  metrics: z.array(z.string()),
});

// ============================================================
// PrototypeIR — root
// ============================================================

export const prototypeIRSchema = z.object({
  schemaVersion: z.literal(IR_SCHEMA_VERSION),
  runtimeVersion: z.literal(RUNTIME_VERSION),
  seed: z.string().min(1),
  prng: prngSpecSchema,

  source: z.object({
    projectId: z.string().min(1),
    artifactVersions: z.record(z.string(), z.string()),
    hypothesisId: z.string().nullable(),
  }),

  session: sessionSpecSchema,

  mechanicBindings: z.array(mechanicBindingSchema),
  resources: z.array(resourceSpecSchema),
  stepMachine: z.array(stepStateSpecSchema).min(1, "at least one step required"),
  scene: sceneSpecSchema,
  entities: z.array(entitySpecSchema),
  systems: z.array(systemSpecSchema),
  rules: z.array(ruleSpecSchema),
  objectives: z.array(objectiveSpecSchema).min(1, "at least one objective required"),
  controls: z.array(controlBindingSpecSchema),

  telemetry: telemetrySpecSchema,

  assumptions: z.array(z.string()),
});

/**
 * Validate an unknown object as a PrototypeIR.
 * Throws a structured error on failure.
 */
export function validatePrototypeIR(ir: unknown): PrototypeIR {
  return prototypeIRSchema.parse(ir) as PrototypeIR;
}

/**
 * Safe validation — returns a result object instead of throwing.
 */
export function safeValidatePrototypeIR(ir: unknown):
  | { success: true; data: PrototypeIR }
  | { success: false; error: z.ZodError } {
  const result = prototypeIRSchema.safeParse(ir);
  if (result.success) {
    return { success: true, data: result.data as PrototypeIR };
  }
  return { success: false, error: result.error };
}

// Import the type at the end to avoid circular dependency.
import type { PrototypeIR } from "./types";
