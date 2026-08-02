/**
 * PrototypeIR — Intermediate Representation for playable prototypes.
 *
 * This is the single source of gameplay semantics. It contains ONLY data
 * from a closed taxonomy — no arbitrary JS expressions, HTML, event handler
 * strings, or imports. Both 2D and 3D renderers consume the same IR.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 6)
 *
 * Schema versioning:
 * - schemaVersion: IR structure version (this file). Breaking changes bump
 *   the major version; additive changes bump minor.
 * - runtimeVersion: the fixed-step ECS runtime version that can execute this IR.
 *
 * Stability contract:
 * - Once an IR is created with schemaVersion "1.0.0", it must remain
 *   deserializable and executable by any runtime that declares support
 *   for that schemaVersion.
 * - semanticHash(ir) must be stable: same IR content → same hash, across
 *   process restarts and Node.js versions.
 */

// ============================================================
// Versioning
// ============================================================

export const IR_SCHEMA_VERSION = "1.0.0" as const;
export const RUNTIME_VERSION = "0.1.0" as const;

// ============================================================
// Primitives
// ============================================================

/** 2D vector. All coordinates are in world units (not pixels). */
export interface Vec2 {
  x: number;
  y: number;
}

/** Entity transform. rotation is in radians. */
export interface Transform {
  position: Vec2;
  rotation: number;
  scale: Vec2;
}

/** Axis-aligned bounding box. */
export interface AABB {
  center: Vec2;
  halfExtents: Vec2;
}

/** Circle collider. */
export interface CircleCollider {
  center: Vec2;
  radius: number;
}

/** Seeded PRNG specification. mulberry32 is the only supported algorithm in v1. */
export interface PrngSpec {
  algorithm: "mulberry32";
  seed: string; // hex string, 8+ chars
}

// ============================================================
// Session
// ============================================================

/**
 * A predicate that the runtime evaluates each tick.
 * In v1, predicates are limited to a closed set of comparison operations
 * over resource values, step state, and entity counts.
 */
export type PredicateSpec =
  | { kind: "resource_gte"; resourceId: string; value: number }
  | { kind: "resource_lte"; resourceId: string; value: number }
  | { kind: "step_completed"; stepId: string }
  | { kind: "loop_count_gte"; value: number }
  | { kind: "time_elapsed_gte"; seconds: number }
  | { kind: "entity_count_lte"; roleId: string; value: number }
  | { kind: "and"; predicates: PredicateSpec[] }
  | { kind: "or"; predicates: PredicateSpec[] }
  | { kind: "not"; predicate: PredicateSpec };

export interface SessionSpec {
  /** Target session duration in seconds (20–120 per design spec). */
  targetDurationSec: number;
  /** Simulation frequency in Hz. Fixed at 60 for v1. */
  fixedStepHz: 60;
  /** Win condition. */
  success: PredicateSpec;
  /** Failure conditions (any of these triggers a loss). */
  failure: PredicateSpec[];
  /** Number of core-loop iterations the session is designed to validate. */
  loopTarget: number;
}

// ============================================================
// Mechanics
// ============================================================

export type MechanicResolution =
  | "exact"        // adapter exists for this canonical ID
  | "alias"        // resolved via versioned alias
  | "user_override" // user explicitly mapped this mechanic
  | "unsupported";  // no adapter; blocks `playable` status

export interface MechanicBinding {
  sourceMechanicId: string;
  adapterId: string | null;
  adapterVersion: string | null;
  resolution: MechanicResolution;
  /** Rule IDs that this mechanic's adapter contributed to the IR. */
  representedByRuleIds: string[];
  /** Human-readable assumptions made by the adapter (e.g., "treats 'jump' as locomotion"). */
  assumptions: string[];
}

// ============================================================
// Resources
// ============================================================

export type ResourceClass = "core" | "secondary" | "meta";

export interface ResourceSpec {
  id: string;
  name: string;
  icon: string;
  class: ResourceClass;
  /** Initial value at session start. */
  initialValue: number;
  /** Optional min/max bounds. null means unbounded. */
  min: number | null;
  max: number | null;
}

// ============================================================
// Step state machine
// ============================================================

export interface StepStateSpec {
  id: string;
  label: string;
  /** Predicate that activates this step (e.g., resource consumed). */
  activationPredicate: PredicateSpec;
  /** Player actions allowed in this step (from mechanic adapters). */
  allowedActionIds: string[];
  /** Predicate that completes this step. */
  completionPredicate: PredicateSpec;
  /** Effects applied on completion (resource production, etc.). */
  effects: EffectSpec[];
  /** Next step ID. null = terminal (explicit reset required). */
  nextStepId: string | null;
  /** Telemetry events emitted for this step. */
  telemetryEvents: string[];
}

export type EffectSpec =
  | { kind: "resource_delta"; resourceId: string; delta: number }
  | { kind: "set_step"; stepId: string }
  | { kind: "spawn_entity"; roleId: string; position: Vec2 }
  | { kind: "despawn_entity"; entityId: string }
  | { kind: "increment_loop_count" }
  | { kind: "reset_loop" };

// ============================================================
// Scene
// ============================================================

export type SceneTopology =
  | "arena"
  | "lanes"
  | "rooms"
  | "grid"
  | "node_field";

export interface SceneSpec {
  topology: SceneTopology;
  /** World bounds. Entities outside are clamped or destroyed. */
  bounds: AABB;
  /** Affinity scores that led to this topology selection (evidence). */
  topologyScores: Array<{ topology: SceneTopology; score: number }>;
}

// ============================================================
// Entities
// ============================================================

export type EntityRole =
  | "player"
  | "enemy"
  | "collectible"
  | "obstacle"
  | "projectile"
  | "interaction_zone"
  | "base"
  | "goal"
  | "hazard"
  | "spawner";

export type ComponentSpec =
  | { kind: "transform"; data: Transform }
  | { kind: "collider"; shape: "circle" | "aabb"; data: CircleCollider | AABB }
  | { kind: "health"; max: number; current: number }
  | { kind: "inventory"; capacity: number }
  | { kind: "resource_wallet"; resourceId: string }
  | { kind: "cooldown"; durationSec: number; lastTriggeredAt: number }
  | { kind: "team"; teamId: string };

export interface EntitySpec {
  id: string;
  role: EntityRole;
  /** Stable deterministic ID (derived from seed + spawn order). */
  deterministicId: string;
  components: ComponentSpec[];
  /** Optional spawn schedule. null = present at session start. */
  spawnSchedule: { atStepId?: string; atTimeSec?: number } | null;
}

// ============================================================
// Systems
// ============================================================

export type SystemKind =
  | "movement"
  | "targeting"
  | "collision"
  | "collect"
  | "combat"
  | "spawn"
  | "convert"
  | "place"
  | "timing"
  | "puzzle_state";

export interface SystemSpec {
  id: string;
  kind: SystemKind;
  /** Entity roles this system operates on. */
  appliesToRoles: EntityRole[];
  /** Configuration for this system (e.g., movement speed, collision pairs). */
  config: Record<string, unknown>;
}

// ============================================================
// Rules
// ============================================================

export type RuleTrigger =
  | { kind: "event"; eventId: string }
  | { kind: "predicate"; predicate: PredicateSpec }
  | { kind: "step_enter"; stepId: string }
  | { kind: "step_complete"; stepId: string };

export interface RuleSpec {
  id: string;
  /** Source mechanic ID that contributed this rule (for traceability). */
  sourceMechanicId: string;
  /** When this rule fires. */
  trigger: RuleTrigger;
  /** Conditions that must hold for the rule to fire. */
  guard: PredicateSpec;
  /** Effects applied when the rule fires. */
  effects: EffectSpec[];
}

// ============================================================
// Objectives
// ============================================================

export interface ObjectiveSpec {
  id: string;
  label: string;
  /** Predicate that satisfies this objective. */
  predicate: PredicateSpec;
  /** Whether this objective is required for session success. */
  required: boolean;
  /** Step ID this objective belongs to (for telemetry grouping). */
  stepId: string | null;
}

// ============================================================
// Controls
// ============================================================

export type ControlAction =
  | "move"
  | "aim"
  | "primary_action"
  | "secondary_action"
  | "interact"
  | "place"
  | "rotate";

export type InputBinding =
  | { kind: "keyboard"; keys: string[] }
  | { kind: "pointer" }
  | { kind: "touch_stick" };

export interface ControlBindingSpec {
  action: ControlAction;
  binding: InputBinding;
  /** Context predicate: when this binding is active. null = always. */
  contextPredicate: PredicateSpec | null;
}

// ============================================================
// Telemetry
// ============================================================

export type TelemetryEventName =
  | "session_start"
  | "session_end"
  | "input_action"
  | "mechanic_triggered"
  | "step_enter"
  | "step_complete"
  | "resource_changed"
  | "damage"
  | "death"
  | "retry"
  | "loop_complete"
  | "win"
  | "lose"
  | "timeout"
  | "inactivity_window"
  | "invalid_action";

export interface TelemetrySpec {
  /** Events the runtime emits. */
  events: TelemetryEventName[];
  /** Metrics derived from events (computed by the analytics layer, not runtime). */
  metrics: string[];
}

// ============================================================
// PrototypeIR — the root
// ============================================================

export interface PrototypeIR {
  schemaVersion: typeof IR_SCHEMA_VERSION;
  runtimeVersion: typeof RUNTIME_VERSION;
  seed: string;
  prng: PrngSpec;

  source: {
    projectId: string;
    artifactVersions: Record<string, string>;
    hypothesisId: string | null;
  };

  session: SessionSpec;

  mechanicBindings: MechanicBinding[];
  resources: ResourceSpec[];
  stepMachine: StepStateSpec[];
  scene: SceneSpec;
  entities: EntitySpec[];
  systems: SystemSpec[];
  rules: RuleSpec[];
  objectives: ObjectiveSpec[];
  controls: ControlBindingSpec[];

  telemetry: TelemetrySpec;

  /** Human-readable assumptions made by the compiler (for the coverage report). */
  assumptions: string[];
}

// ============================================================
// Compile result
// ============================================================

export type CompileStatus = "playable" | "needs_mapping" | "invalid" | "build_failed";

export interface PrototypeCoverageReport {
  mandatoryMechanics: { represented: number; total: number };
  allMechanics: { represented: number; total: number };
  representedStepIds: string[];
  missingStepIds: string[];
  unsupportedMechanicIds: string[];
  assumptions: string[];
}

export interface PrototypeValidationReport {
  gatesPassed: number[];
  gatesFailed: Array<{ gateId: number; reason: string }>;
}

export interface PrototypeArtifactV2 {
  artifactId: string;
  artifactType: "prototype_v2";
  envelopeVersion: 1;
  schemaVersion: typeof IR_SCHEMA_VERSION;
  runtimeVersion: typeof RUNTIME_VERSION;
  irSemanticHash: string;
  inputHash: string;
  status: CompileStatus;
  createdAt: string;
}

export interface PrototypeBuildResult {
  status: CompileStatus;
  ir: PrototypeIR;
  builds: {
    "2d"?: { html: string; rendererVersion: string };
    "3d"?: { html: string; rendererVersion: string };
  };
  coverage: PrototypeCoverageReport;
  validation: PrototypeValidationReport;
  artifact: PrototypeArtifactV2;
}
