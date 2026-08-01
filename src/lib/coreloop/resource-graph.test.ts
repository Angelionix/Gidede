import { describe, expect, it } from "vitest";
import type { CoreStep } from "./steps";
import { buildResourceFlowGraph, findResourceFlowPath } from "./resource-graph";

function step(consumes: string[], produces: string[]): CoreStep {
  return {
    action: "test",
    mechanics: ["test"],
    resources_consumed: consumes,
    resources_produced: produces,
    feedback_type: "neutral",
    duration_estimate: 1,
  };
}

describe("directed Core Loop resource graph", () => {
  it("finds a direct last-to-first resource edge", () => {
    const graph = buildResourceFlowGraph([
      step(["momentum"], ["action"]),
      step(["action"], ["momentum"]),
    ]);
    expect(findResourceFlowPath(graph, 1, 0)).toEqual({
      steps: [1, 0],
      resources: ["momentum"],
    });
  });

  it("finds an indirect last-to-first path", () => {
    const graph = buildResourceFlowGraph([
      step(["ready"], []),
      step(["signal"], ["ready"]),
      step([], ["signal"]),
    ]);
    expect(findResourceFlowPath(graph, 2, 0)).toEqual({
      steps: [2, 1, 0],
      resources: ["signal", "ready"],
    });
  });

  it("does not infer a path from balanced sets with the wrong direction", () => {
    const graph = buildResourceFlowGraph([
      step([], ["a"]),
      step(["a"], ["b"]),
      step(["b"], ["c"]),
    ]);
    expect(findResourceFlowPath(graph, 2, 0)).toBeNull();
  });
});
