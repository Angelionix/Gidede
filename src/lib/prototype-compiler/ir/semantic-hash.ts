/**
 * Semantic hash for PrototypeIR.
 *
 * Produces a stable, deterministic hash of the IR's gameplay semantics.
 * Two IRs with the same semantic hash will play identically (same rules,
 * objectives, resources, controls) — even if their cosmetic representation
 * (entity IDs, ordering, comments) differs.
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 15, item 10)
 *
 * Stability contract:
 * - Same IR content → same hash, across process restarts and Node versions.
 * - Changing only the renderer (2D vs 3D) does NOT change semantic hash.
 * - Changing one mechanic DOES change the hash.
 *
 * Algorithm:
 * 1. Extract semantic fields (rules, objectives, resources, step machine,
 *    controls, session, scene topology — NOT entities, because entity
 *    positions are renderer-dependent).
 * 2. Sort arrays by stable key (id) to make order irrelevant.
 * 3. Serialize to canonical JSON (sorted keys, no whitespace).
 * 4. SHA-256 hash, hex-encoded, truncated to 16 chars.
 */

import { createHash } from "crypto";
import type { PrototypeIR } from "./types";

/**
 * Extract the semantic subset of an IR for hashing.
 * Entities are excluded because their positions may differ between 2D and 3D
 * renderers while the underlying rules remain identical.
 */
function extractSemanticSubset(ir: PrototypeIR): unknown {
  return {
    session: {
      targetDurationSec: ir.session.targetDurationSec,
      loopTarget: ir.session.loopTarget,
      success: ir.session.success,
      failure: ir.session.failure,
    },
    sceneTopology: ir.scene.topology,
    resources: ir.resources
      .map((r) => ({
        id: r.id,
        class: r.class,
        initialValue: r.initialValue,
        min: r.min,
        max: r.max,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    stepMachine: ir.stepMachine
      .map((s) => ({
        id: s.id,
        activationPredicate: s.activationPredicate,
        allowedActionIds: [...s.allowedActionIds].sort(),
        completionPredicate: s.completionPredicate,
        effects: s.effects,
        nextStepId: s.nextStepId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    rules: ir.rules
      .map((r) => ({
        id: r.id,
        sourceMechanicId: r.sourceMechanicId,
        trigger: r.trigger,
        guard: r.guard,
        effects: r.effects,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    objectives: ir.objectives
      .map((o) => ({
        id: o.id,
        predicate: o.predicate,
        required: o.required,
        stepId: o.stepId,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    controls: ir.controls
      .map((c) => ({
        action: c.action,
        binding: c.binding,
        contextPredicate: c.contextPredicate,
      }))
      .sort((a, b) => a.action.localeCompare(b.action)),
    systems: ir.systems
      .map((s) => ({
        kind: s.kind,
        appliesToRoles: [...s.appliesToRoles].sort(),
        config: s.config,
      }))
      .sort((a, b) => a.kind.localeCompare(b.kind)),
  };
}

/**
 * Canonical JSON serialization: sorted keys, no extra whitespace.
 * This ensures the same logical object always produces the same string.
 */
function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(",")}}`;
}

/**
 * Compute the semantic hash of a PrototypeIR.
 * Returns a 16-character hex string (truncated SHA-256).
 */
export function computeSemanticHash(ir: PrototypeIR): string {
  const semantic = extractSemanticSubset(ir);
  const canonical = canonicalJsonStringify(semantic);
  const fullHash = createHash("sha256").update(canonical, "utf8").digest("hex");
  // 16 chars = 64 bits, collision probability is negligible for prototype-scale data.
  return fullHash.substring(0, 16);
}
