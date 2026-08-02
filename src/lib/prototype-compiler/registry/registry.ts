/**
 * Mechanic adapter registry.
 *
 * Each canonical mechanic ID is resolved through this registry to a
 * MechanicAdapter that knows how to compile it into a MechanicFragment
 * (rules, entities, controls, systems).
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 7)
 *
 * Resolution order (per mechanic ID):
 *   1. exact — adapter exists for this canonical ID
 *   2. alias — versioned alias maps this ID to another adapter
 *   3. user_override — user explicitly mapped this ID via buildOptions
 *   4. unsupported — no adapter; blocks `playable` status
 *
 * For social/dialogue/negotiation mechanics, MVP returns `needs_mapping`.
 * Simulation of NPCs must not be passed off as a validation of social mechanics.
 */

import type {
  ControlBindingSpec,
  EntitySpec,
  EffectSpec,
  MechanicBinding,
  ObjectiveSpec,
  PredicateSpec,
  ResourceSpec,
  RuleSpec,
  StepStateSpec,
  SystemSpec,
  TelemetryEventName,
} from "../ir/types";

// ============================================================
// Adapter interfaces
// ============================================================

export type SceneTopology = "arena" | "lanes" | "rooms" | "grid" | "node_field";

export type RequiredContext = "player" | "target" | "resource" | "timer" | "base";

export type Capability =
  | "locomotion"
  | "collect"
  | "target/combat"
  | "avoid/survive"
  | "interact/deliver"
  | "convert/craft"
  | "build/place"
  | "defend"
  | "upgrade"
  | "transform"
  | "puzzle"
  | "timing";

/**
 * The fragment a mechanic adapter contributes to the IR.
 * All fields are additive — multiple adapters' fragments are merged.
 */
export interface MechanicFragment {
  rules: RuleSpec[];
  systems: SystemSpec[];
  controls: ControlBindingSpec[];
  objectives: ObjectiveSpec[];
  /** Resources this mechanic requires (will be deduplicated by the compiler). */
  requiredResources: ResourceSpec[];
  /** Entities this mechanic requires (player spawn, targets, etc.). */
  requiredEntities: EntitySpec[];
  /** Telemetry events this mechanic emits. */
  telemetryEvents: TelemetryEventName[];
  /** Human-readable assumptions made by the adapter. */
  assumptions: string[];
}

/**
 * Context passed to an adapter's compile() method.
 * Contains the step this mechanic belongs to and the resources available.
 */
export interface MechanicCompileContext {
  stepId: string;
  stepLabel: string;
  /** Resources already declared by previous adapters or the Core Loop. */
  availableResources: ResourceSpec[];
  /** Existing steps (for cross-references). */
  existingSteps: StepStateSpec[];
  /** Difficulty setting from buildOptions. */
  difficulty: "easy" | "baseline" | "hard";
  /** Seed for deterministic entity placement. */
  seed: string;
}

/**
 * A diagnostic message from adapter validation.
 */
export interface Diagnostic {
  level: "error" | "warning" | "info";
  code: string;
  message: string;
}

/**
 * Bot policy specification — how the headless bot should interact with
 * this mechanic during playability validation.
 */
export interface BotPolicySpec {
  /** Actions the bot will attempt for this mechanic. */
  actions: string[];
  /** Expected success rate (0-1). */
  expectedSuccessRate: number;
}

/**
 * The adapter contract. Each adapter compiles one or more canonical
 * mechanic IDs into IR fragments.
 */
export interface MechanicAdapter {
  readonly adapterId: string;
  readonly version: string;
  readonly mechanicIds: string[];
  readonly capabilities: Capability[];
  readonly compatibleTopologies: SceneTopology[];
  readonly requiredContext: RequiredContext[];
  compile(context: MechanicCompileContext): MechanicFragment;
  validate(fragment: MechanicFragment): Diagnostic[];
  botPolicy?: BotPolicySpec;
}

// ============================================================
// Registry
// ============================================================

interface RegistryEntry {
  adapter: MechanicAdapter;
  /** Aliases: other mechanic IDs that resolve to this adapter. */
  aliases: string[];
}

class MechanicAdapterRegistry {
  private entries = new Map<string, RegistryEntry>();
  private aliasToAdapterId = new Map<string, string>();

  register(adapter: MechanicAdapter, aliases: string[] = []): void {
    if (this.entries.has(adapter.adapterId)) {
      throw new Error(`Adapter '${adapter.adapterId}' is already registered`);
    }
    this.entries.set(adapter.adapterId, { adapter, aliases });

    // Register canonical mechanic IDs.
    for (const mechId of adapter.mechanicIds) {
      if (this.aliasToAdapterId.has(mechId)) {
        throw new Error(
          `Mechanic ID '${mechId}' is already registered to adapter '${this.aliasToAdapterId.get(mechId)}'`,
        );
      }
      this.aliasToAdapterId.set(mechId, adapter.adapterId);
    }

    // Register aliases (versioned).
    for (const alias of aliases) {
      if (this.aliasToAdapterId.has(alias)) {
        throw new Error(
          `Alias '${alias}' is already registered to adapter '${this.aliasToAdapterId.get(alias)}'`,
        );
      }
      this.aliasToAdapterId.set(alias, adapter.adapterId);
    }
  }

  /**
   * Resolve a mechanic ID to an adapter.
   *
   * Resolution order:
   *   1. exact match on canonical mechanicIds
   *   2. alias match
   *   3. user_override (explicit mapping)
   *   4. unsupported (returns null)
   */
  resolve(
    mechanicId: string,
    userOverride?: Record<string, string>,
  ): { adapter: MechanicAdapter; resolution: "exact" | "alias" | "user_override" } | null {
    // 3. User override takes precedence.
    if (userOverride && userOverride[mechanicId]) {
      const overrideAdapterId = userOverride[mechanicId];
      const entry = this.entries.get(overrideAdapterId);
      if (entry) {
        return { adapter: entry.adapter, resolution: "user_override" };
      }
    }

    // 1 & 2. Exact or alias match (same lookup — canonical IDs and aliases
    // are both in aliasToAdapterId).
    const adapterId = this.aliasToAdapterId.get(mechanicId);
    if (adapterId) {
      const entry = this.entries.get(adapterId);
      if (!entry) return null;
      // Determine if it was exact or alias.
      const isExact = entry.adapter.mechanicIds.includes(mechanicId);
      return {
        adapter: entry.adapter,
        resolution: isExact ? "exact" : "alias",
      };
    }

    return null;
  }

  /**
   * Resolve a mechanic ID and produce a MechanicBinding (for IR evidence).
   */
  resolveBinding(
    mechanicId: string,
    userOverride?: Record<string, string>,
  ): MechanicBinding {
    const resolved = this.resolve(mechanicId, userOverride);
    if (!resolved) {
      return {
        sourceMechanicId: mechanicId,
        adapterId: null,
        adapterVersion: null,
        resolution: "unsupported",
        representedByRuleIds: [],
        assumptions: [],
      };
    }
    // Compile to get rule IDs (for representedByRuleIds).
    // Note: full compilation happens in the compiler; here we just record
    // the adapter identity. Rule IDs will be filled by the compiler.
    return {
      sourceMechanicId: mechanicId,
      adapterId: resolved.adapter.adapterId,
      adapterVersion: resolved.adapter.version,
      resolution: resolved.resolution,
      representedByRuleIds: [], // filled by compiler after compile()
      assumptions: [],
    };
  }

  list(): Array<{ adapterId: string; mechanicIds: string[]; capabilities: Capability[] }> {
    return Array.from(this.entries.values()).map((e) => ({
      adapterId: e.adapter.adapterId,
      mechanicIds: e.adapter.mechanicIds,
      capabilities: e.adapter.capabilities,
    }));
  }

  /** Clear all registrations (for testing). */
  clear(): void {
    this.entries.clear();
    this.aliasToAdapterId.clear();
  }
}

// Singleton registry.
let registryInstance: MechanicAdapterRegistry | null = null;

export function getMechanicAdapterRegistry(): MechanicAdapterRegistry {
  if (!registryInstance) {
    registryInstance = new MechanicAdapterRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton (for testing). Also re-registers built-in adapters
 * if registerBuiltIns=true.
 */
export function resetMechanicAdapterRegistry(registerBuiltIns = true): void {
  if (registryInstance) {
    registryInstance.clear();
  }
  registryInstance = new MechanicAdapterRegistry();
  if (registerBuiltIns) {
    registerBuiltInAdapters(registryInstance);
  }
}

// ============================================================
// Built-in adapter registration
// ============================================================

import { createLocomotionAdapter } from "../adapters/locomotion";
import { createCollectAdapter } from "../adapters/collect";
import { createCombatAdapter } from "../adapters/combat";
import { createSurvivalAdapter } from "../adapters/survival";

/**
 * Register the 4 built-in adapters (Phase 1.2 MVP).
 * Called automatically on first getMechanicAdapterRegistry() use.
 */
function registerBuiltInAdapters(reg: MechanicAdapterRegistry): void {
  reg.register(createLocomotionAdapter(), [
    // Aliases: common alternative names for movement mechanics.
    "move", "dodge", "jump", "run", "walk", "fly", "swim",
  ]);
  reg.register(createCollectAdapter(), [
    "pickup", "gather", "loot", "harvest", "mine", "fish",
  ]);
  reg.register(createCombatAdapter(), [
    "aim", "shoot", "melee", "attack", "strike", "cast",
  ]);
  reg.register(createSurvivalAdapter(), [
    "stealth", "evade", "hazard", "hide", "sneak",
  ]);
}

// Auto-register on module load.
resetMechanicAdapterRegistry(true);
