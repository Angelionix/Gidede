import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient } from "@/lib/llm/types";

const mocks = vi.hoisted(() => ({
  getLlmClientForStage: vi.fn(),
  complete: vi.fn(),
}));

vi.mock("@/lib/llm/default-client", () => ({ getLlmClientForStage: mocks.getLlmClientForStage }));

import {
  enrichConcept,
  generateGraphFromText,
  validateGraphWithAI,
} from "@/lib/ai-service";

function useOutputs(outputs: string[]) {
  mocks.complete.mockImplementation(async () => ({
    choices: [{ message: { content: outputs.shift() ?? "" } }],
  }));
}

describe("ai-service structured output boundary — R3-08", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLlmClientForStage.mockResolvedValue({
      createCompletion: mocks.complete,
    } as unknown as LlmClient);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not coerce schema-invalid Concept output into domain data", async () => {
    useOutputs([
      '{"story_synopsis":42,"gameplay_description":true,"unique_features":[7]}',
      '{"story_synopsis":42,"gameplay_description":true,"unique_features":[7]}',
    ]);

    await expect(enrichConcept({
      idea: "Idea",
      genre: "Strategy",
      projectName: "Project",
      aesthetics: ["Challenge"],
    })).resolves.toBeNull();
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });

  it("accepts a schema-valid bounded repair and returns only the validated shape", async () => {
    useOutputs([
      "invalid json",
      JSON.stringify({
        story_synopsis: "Story",
        gameplay_description: "Gameplay",
        unique_features: ["Feature"],
        ai_insights: "Insight",
      }),
    ]);

    await expect(enrichConcept({
      idea: "Idea",
      genre: "Strategy",
      projectName: "Project",
      aesthetics: ["Challenge"],
    })).resolves.toEqual({
      story_synopsis: "Story",
      gameplay_description: "Gameplay",
      unique_features: ["Feature"],
      ai_insights: "Insight",
    });
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });

  it("rejects valid JSON graphs with unknown executable node types and dangling edges", async () => {
    const invalidGraph = JSON.stringify({
      nodes: [{
        id: "evil",
        type: "executeArbitraryCode",
        label: "Evil",
        position: { x: 0, y: 0 },
        properties: {},
      }],
      edges: [{ source: "missing", sourceHandle: "out", target: "evil", targetHandle: "in" }],
    });
    useOutputs([invalidGraph, invalidGraph]);

    await expect(generateGraphFromText({ description: "Game" })).resolves.toBeNull();
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });

  it("validates repaired graph suggestions against their finite taxonomy", async () => {
    useOutputs([
      '[{"type":"execute","message":"bad"}]',
      '[{"type":"warning","message":"Add a win condition","suggestedNode":"win"}]',
    ]);

    await expect(validateGraphWithAI(["player"], 0)).resolves.toEqual([
      { type: "warning", message: "Add a win condition", suggestedNode: "win" },
    ]);
    expect(mocks.complete).toHaveBeenCalledTimes(2);
  });
});
