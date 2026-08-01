import { describe, expect, it } from "vitest";
import {
  aiGraphSchema,
  aiGraphSuggestionsSchema,
  conceptEnrichmentSchema,
  customMechanicSchema,
} from "@/lib/ai-structured-schemas";

const validGraph = {
  nodes: [
    {
      id: "start",
      type: "onGameStart",
      label: "Start",
      position: { x: 50, y: 50 },
      properties: {},
    },
    {
      id: "win",
      type: "win",
      label: "Win",
      position: { x: 200, y: 50 },
      properties: {},
    },
  ],
  edges: [{ source: "start", sourceHandle: "out", target: "win", targetHandle: "in" }],
};

describe("AI structured output schemas — R3-08", () => {
  it("accepts bounded canonical Concept and mechanic outputs", () => {
    expect(conceptEnrichmentSchema.safeParse({
      story_synopsis: "Story",
      gameplay_description: "Gameplay",
      unique_features: ["Feature"],
      ai_insights: "Insight",
    }).success).toBe(true);
    expect(customMechanicSchema.safeParse({
      mechanicName: "Mechanic",
      description: "Description",
      codeSnippet: "const x = 1;",
    }).success).toBe(true);
  });

  it("rejects coercible values and undeclared fields instead of casting them", () => {
    expect(conceptEnrichmentSchema.safeParse({
      story_synopsis: 123,
      gameplay_description: "Gameplay",
      unique_features: [true],
      ai_insights: "Insight",
    }).success).toBe(false);
    expect(customMechanicSchema.safeParse({
      mechanicName: "Mechanic",
      description: "Description",
      codeSnippet: "",
      html: "<script>unsafe()</script>",
    }).success).toBe(false);
  });

  it("validates graph types, uniqueness, endpoints and required outcome structure", () => {
    expect(aiGraphSchema.safeParse(validGraph).success).toBe(true);
    expect(aiGraphSchema.safeParse({
      nodes: [
        { ...validGraph.nodes[0], type: "arbitraryCode" },
        { ...validGraph.nodes[0] },
      ],
      edges: [{ source: "missing", sourceHandle: "out", target: "also-missing", targetHandle: "in" }],
    }).success).toBe(false);
  });

  it("rejects graph suggestions outside the finite action taxonomy", () => {
    expect(aiGraphSuggestionsSchema.safeParse([
      { type: "execute", message: "Run arbitrary code" },
    ]).success).toBe(false);
  });
});
