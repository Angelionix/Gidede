/**
 * Runtime state — mutable simulation state.
 *
 * This is the state that the runtime mutates each tick. It is separate
 * from PrototypeIR (which is immutable) to keep the IR pure.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 9)
 */

import type { EntityRole, ResourceClass } from "../ir/types";

export interface RuntimeEntity {
  id: string;
  deterministicId: string;
  role: EntityRole;
  position: { x: number; y: number };
  rotation: number;
  velocity: { x: number; y: number };
  health: number | null;
  maxHealth: number | null;
  team: string | null;
  cooldownEndsAt: number | null; // in seconds
  alive: boolean;
  spawnedAt: number; // seconds
}

export interface RuntimeResource {
  id: string;
  name: string;
  value: number;
  min: number | null;
  max: number | null;
  class: ResourceClass;
}

export interface RuntimeState {
  /** Elapsed simulation time in seconds. */
  elapsedSec: number;
  /** Current tick number (0-based). */
  tick: number;
  /** Number of completed loop iterations. */
  loopCount: number;
  /** Current step ID (null = before first step). */
  currentStepId: string | null;
  /** Set of completed step IDs (for step_completed predicate). */
  completedSteps: Set<string>;
  /** Resources keyed by ID. */
  resources: Map<string, number>;
  /** Resource metadata (name, min, max, class). */
  resourceMeta: Map<string, RuntimeResource>;
  /** Entities keyed by ID. */
  entities: Map<string, RuntimeEntity>;
  /** Pending input events for this tick. */
  pendingInputs: InputEvent[];
  /** Telemetry events emitted this tick (cleared after processing). */
  telemetry: TelemetryRecord[];
  /** Session status. */
  status: "running" | "won" | "lost" | "timeout";
  /** Whether the session has started. */
  started: boolean;
  /** Last input action time (for inactivity detection). */
  lastInputAt: number;
}

export interface InputEvent {
  action: string;
  /** Optional target position (for aim/pointer). */
  position?: { x: number; y: number };
  /** Timestamp in seconds. */
  timestamp: number;
}

export interface TelemetryRecord {
  event: string;
  data: Record<string, unknown>;
  tick: number;
  timestamp: number;
}

/**
 * Initialize runtime state from a PrototypeIR.
 * Resources and entities are copied from the IR; mutable fields are zeroed.
 */
export function createRuntimeState(): RuntimeState {
  return {
    elapsedSec: 0,
    tick: 0,
    loopCount: 0,
    currentStepId: null,
    completedSteps: new Set(),
    resources: new Map(),
    resourceMeta: new Map(),
    entities: new Map(),
    pendingInputs: [],
    telemetry: [],
    status: "running",
    started: false,
    lastInputAt: 0,
  };
}

/**
 * Apply a resource delta, respecting min/max bounds.
 */
export function applyResourceDelta(
  state: RuntimeState,
  resourceId: string,
  delta: number,
): void {
  const current = state.resources.get(resourceId) ?? 0;
  const meta = state.resourceMeta.get(resourceId);
  let next = current + delta;
  if (meta) {
    if (meta.min !== null) next = Math.max(meta.min, next);
    if (meta.max !== null) next = Math.min(meta.max, next);
  }
  state.resources.set(resourceId, next);

  // Emit telemetry.
  state.telemetry.push({
    event: "resource_changed",
    data: { resourceId, delta, newValue: next, oldValue: current },
    tick: state.tick,
    timestamp: state.elapsedSec,
  });
}

/**
 * Mark a step as completed.
 */
export function markStepCompleted(state: RuntimeState, stepId: string): void {
  if (!state.completedSteps.has(stepId)) {
    state.completedSteps.add(stepId);
    state.telemetry.push({
      event: "step_complete",
      data: { stepId },
      tick: state.tick,
      timestamp: state.elapsedSec,
    });
  }
}

/**
 * Record an input event (called by the renderer/input layer).
 */
export function recordInput(state: RuntimeState, event: InputEvent): void {
  state.pendingInputs.push(event);
  state.lastInputAt = state.elapsedSec;
  state.telemetry.push({
    event: "input_action",
    data: { action: event.action, position: event.position },
    tick: state.tick,
    timestamp: state.elapsedSec,
  });
}

/**
 * Spawn an entity at a position.
 */
export function spawnEntity(
  state: RuntimeState,
  entity: RuntimeEntity,
): void {
  state.entities.set(entity.id, entity);
  state.telemetry.push({
    event: "entity_spawned",
    data: { entityId: entity.id, role: entity.role },
    tick: state.tick,
    timestamp: state.elapsedSec,
  });
}

/**
 * Despawn (remove) an entity.
 */
export function despawnEntity(state: RuntimeState, entityId: string): void {
  if (state.entities.delete(entityId)) {
    state.telemetry.push({
      event: "entity_despawned",
      data: { entityId },
      tick: state.tick,
      timestamp: state.elapsedSec,
    });
  }
}
