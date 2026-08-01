import type { CoreStep } from "./steps";

export interface ResourceFlowEdge {
  from: number;
  to: number;
  resources: string[];
}

export interface ResourceFlowGraph {
  stepCount: number;
  edges: ResourceFlowEdge[];
}

export interface ResourceFlowPath {
  steps: number[];
  resources: string[];
}

function normalizedResources(resources: string[]): Map<string, string> {
  const normalized = new Map<string, string>();
  for (const resource of resources) {
    const display = resource.trim();
    if (display) normalized.set(display.toLocaleLowerCase(), display);
  }
  return normalized;
}

/** Build directed producer-step → consumer-step edges for shared resources. */
export function buildResourceFlowGraph(steps: CoreStep[]): ResourceFlowGraph {
  const edges: ResourceFlowEdge[] = [];
  const produced = steps.map((step) => normalizedResources(step.resources_produced));
  const consumed = steps.map((step) => normalizedResources(step.resources_consumed));

  for (let from = 0; from < steps.length; from += 1) {
    for (let to = 0; to < steps.length; to += 1) {
      if (from === to) continue;
      const resources = [...produced[from].keys()]
        .filter((resource) => consumed[to].has(resource))
        .map((resource) => produced[from].get(resource)!);
      if (resources.length > 0) edges.push({ from, to, resources });
    }
  }

  return { stepCount: steps.length, edges };
}

/** Find the shortest directed resource path between two steps. */
export function findResourceFlowPath(
  graph: ResourceFlowGraph,
  from: number,
  to: number,
): ResourceFlowPath | null {
  if (from < 0 || to < 0 || from >= graph.stepCount || to >= graph.stepCount) return null;

  const queue: Array<{ step: number; steps: number[]; resources: string[] }> = [
    { step: from, steps: [from], resources: [] },
  ];
  const visited = new Set<number>([from]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.step === to) {
      return { steps: current.steps, resources: current.resources };
    }
    for (const edge of graph.edges.filter((candidate) => candidate.from === current.step)) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      queue.push({
        step: edge.to,
        steps: [...current.steps, edge.to],
        resources: [...current.resources, ...edge.resources],
      });
    }
  }

  return null;
}
