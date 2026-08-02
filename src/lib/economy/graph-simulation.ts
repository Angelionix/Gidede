/**
 * Gidede — Machinations graph simulation (Block 5b, roadmap R5-15).
 *
 * Before R5-15, the Economy simulation was a per-resource single-pool
 * integration (value = value + faucet - drain + noise) that did NOT execute
 * the Machinations graph (nodes + resource_flows + state_connections). The
 * graph was built but never simulated — diagnostics came from the single-pool
 * model, not from the graph structure.
 *
 * R5-15 introduces `runGraphSimulation(graph, resources, ticks, seed)`:
 *   - Initializes each node (resource pool) with its initial_value.
 *   - At each tick, processes resource_flows: transfers `rate` units from
 *     source to target (respecting bounds).
 *   - Applies state_connections as gates (activates/inhibits flows based on
 *     pool levels).
 *   - Tracks per-node value series, runaway (value approaches max), and
 *     stall (value approaches 0 or min).
 *   - Returns diagnostics derived from the graph execution.
 */

export interface GraphNode {
  id: string;
  type: string;
  rate?: number;
  capacity?: number;
}

export interface GraphFlow {
  source_id: string;
  target_id: string;
  resource: string;
  rate: number;
}

export interface GraphStateConnection {
  source_id: string;
  target_id: string;
  modifier: string;
  formula?: string;
}

export interface ResourceDef {
  name: string;
  initial_value: number;
  bounds: { min: number; max: number };
}

export interface GraphSimulationResult {
  curves: Record<string, number[]>;
  ranges: Record<string, { min: number; max: number }>;
  ticks: number;
  runaway_count: number;
  stall_count: number;
  runaway_frequency: number;
  stall_frequency: number;
  stability_index: number;
  source: "graph_execution";
}

function hashString(s: string): number {
  let hash = 2166136261;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function runGraphSimulation(
  nodes: GraphNode[],
  flows: GraphFlow[],
  stateConns: GraphStateConnection[],
  resources: ResourceDef[],
  ticks = 50,
  seed = 42,
): GraphSimulationResult {
  const rng = mulberry32(seed);

  const resourceMap = new Map<string, ResourceDef>();
  for (const r of resources) {
    resourceMap.set(r.name, r);
  }

  const values: Record<string, number> = {};
  const bounds: Record<string, { min: number; max: number }> = {};
  for (const node of nodes) {
    const res = resourceMap.get(node.id);
    const init = res?.initial_value ?? node.capacity ?? 100;
    const max = res?.bounds.max ?? node.capacity ?? 1000;
    const min = res?.bounds.min ?? 0;
    values[node.id] = init;
    bounds[node.id] = { min, max };
  }

  const gates = new Map<string, boolean>();
  for (const sc of stateConns) {
    const key = `${sc.source_id}->${sc.target_id}`;
    gates.set(key, true);
  }

  const curves: Record<string, number[]> = {};
  const ranges: Record<string, { min: number; max: number }> = {};
  for (const node of nodes) {
    curves[node.id] = [values[node.id]];
    ranges[node.id] = { min: values[node.id], max: values[node.id] };
  }

  for (let t = 1; t < ticks; t++) {
    // Update gates.
    for (const sc of stateConns) {
      const sourceValue = values[sc.source_id] ?? 0;
      const key = `${sc.source_id}->${sc.target_id}`;
      if (sc.modifier === "+") {
        gates.set(key, sourceValue > 0);
      } else if (sc.modifier === "-") {
        gates.set(key, sourceValue <= 0);
      }
    }

    // Compute flow deltas.
    const deltas: Record<string, number> = {};
    for (const node of nodes) {
      deltas[node.id] = 0;
    }

    for (const flow of flows) {
      const gateKey = `${flow.source_id}->${flow.target_id}`;
      const isActive = gates.get(gateKey) ?? true;
      if (!isActive) continue;

      const sourceValue = values[flow.source_id] ?? 0;
      if (sourceValue <= 0) continue;

      const noise = (rng() - 0.5) * 0.1 * flow.rate;
      const transfer = Math.max(0, flow.rate + noise);
      const actualTransfer = Math.min(transfer, sourceValue);

      deltas[flow.source_id] = (deltas[flow.source_id] ?? 0) - actualTransfer;
      deltas[flow.target_id] = (deltas[flow.target_id] ?? 0) + actualTransfer;
    }

    // Apply deltas.
    for (const node of nodes) {
      const newValue = values[node.id] + deltas[node.id];
      const b = bounds[node.id];
      values[node.id] = Math.max(b.min, Math.min(b.max, newValue));

      curves[node.id].push(Number(values[node.id].toFixed(2)));
      ranges[node.id].min = Math.min(ranges[node.id].min, values[node.id]);
      ranges[node.id].max = Math.max(ranges[node.id].max, values[node.id]);
    }
  }

  // Diagnostics.
  let runawayCount = 0;
  let stallCount = 0;
  for (const node of nodes) {
    const b = bounds[node.id];
    const r = ranges[node.id];
    if (r.max >= b.max * 0.95) runawayCount++;
    // R-AUDIT-FIX: stall detection. Was:
    //   `if (r.min <= init * 0.05 || r.min <= b.min) stallCount++;`
    // which always evaluated to true for resources with `initial_value=0`
    // and `bounds.min=0` (common for `xp`, `score`, `shop`) — the condition
    // `r.min <= 0` is always true because r.min starts at 0 and only
    // decreases or stays. Resources that legitimately start at 0 and grow
    // during simulation were always flagged as stalled.
    // Now uses relative change (mirrors the single-pool simulate() fix):
    // a resource is stalled if its value moved less than 5% of its
    // initial_value (or less than 5% of its capacity for init=0 resources).
    const init = resourceMap.get(node.id)?.initial_value ?? 100;
    const capacity = b.max - b.min;
    const valueChange = Math.abs(r.max - r.min);
    const reference = init > 0 ? init : capacity > 0 ? capacity : 1;
    const relativeChange = valueChange / reference;
    if (relativeChange < 0.05) stallCount++;
  }

  const totalNodes = Math.max(1, nodes.length);
  const runawayFreq = runawayCount / totalNodes;
  const stallFreq = stallCount / totalNodes;
  const stability = Math.max(0, 1 - (runawayFreq + stallFreq) / 2);

  return {
    curves,
    ranges,
    ticks,
    runaway_count: runawayCount,
    stall_count: stallCount,
    runaway_frequency: Number(runawayFreq.toFixed(3)),
    stall_frequency: Number(stallFreq.toFixed(3)),
    stability_index: Number(stability.toFixed(3)),
    source: "graph_execution",
  };
}
