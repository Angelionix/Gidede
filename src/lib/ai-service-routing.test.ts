import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient } from "@/lib/llm/types";

const getLlmClientForStage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llm/default-client", () => ({ getLlmClientForStage }));

import { enrichConcept, enrichGdd } from "@/lib/ai-service";

const responseText = JSON.stringify({
  story_synopsis: "История проекта достаточно подробна для теста.",
  gameplay_description: "Игрок выполняет действия и получает измеримую обратную связь.",
  unique_features: ["Feature"],
  ai_insights: "Insight",
});

function client(): LlmClient {
  return {
    createCompletion: vi.fn(async () => ({ choices: [{ message: { content: responseText } }] })),
  } as unknown as LlmClient;
}

describe("ai-service stage routing — R3-07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLlmClientForStage.mockResolvedValue(client());
  });

  it("resolves Concept enrichment through the concept route", async () => {
    await enrichConcept({
      idea: "Idea",
      genre: "Strategy",
      projectName: "Project",
      aesthetics: ["Challenge"],
    });

    expect(getLlmClientForStage).toHaveBeenCalledWith("concept");
  });

  it("resolves GDD enrichment through an independent gdd route", async () => {
    await enrichGdd({ projectName: "Project", genre: "Strategy", format: "full_gdd", sectionCount: 21 });

    expect(getLlmClientForStage).toHaveBeenCalledWith("gdd");
  });
});
