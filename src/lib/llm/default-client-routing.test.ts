import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LlmClient } from "@/lib/llm/types";

const mocks = vi.hoisted(() => ({
  getAuthUserId: vi.fn(),
  findConfigs: vi.fn(),
  findRoute: vi.fn(),
  createConfigured: vi.fn(),
  createTelemetry: vi.fn(),
}));

vi.mock("@/lib/server-auth", () => ({ getAuthUserId: mocks.getAuthUserId }));
vi.mock("@/lib/db", () => ({
  db: {
    userLlmConfig: { findMany: mocks.findConfigs, findFirst: vi.fn() },
    userLlmRoute: { findUnique: mocks.findRoute },
    llmCallTelemetry: { create: mocks.createTelemetry },
  },
}));
vi.mock("@/lib/llm/configured-adapters", () => ({
  createConfiguredLlmClient: mocks.createConfigured,
}));

import { getLlmClientForStage } from "@/lib/llm/default-client";

function provider(providerId: string, modelId: string): LlmClient {
  return {
    providerId,
    modelId,
    createCompletion: vi.fn(async (request) => ({
      model: request.model || modelId,
      choices: [{ message: { content: "ok" } }],
      usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
    })),
    isAvailable: async () => true,
    getCapabilities: () => ({ streaming: true, jsonMode: false, tools: false, modelDiscovery: false }),
    healthCheck: async () => ({
      status: "healthy",
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      reason: "ok",
    }),
    listModels: async () => [],
  } as unknown as LlmClient;
}

const configs = [
  {
    id: "concept-config",
    userId: "user-1",
    adapter: "openai-compatible",
    label: "Concept provider",
    baseUrl: "https://concept.example/v1",
    model: "concept-default",
    secretRef: null,
    configJson: null,
    enabled: true,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
  {
    id: "gdd-config",
    userId: "user-1",
    adapter: "openai-compatible",
    label: "GDD provider",
    baseUrl: "https://gdd.example/v1",
    model: "gdd-default",
    secretRef: null,
    configJson: null,
    enabled: true,
    createdAt: new Date("2026-01-02"),
    updatedAt: new Date("2026-01-02"),
  },
];

describe("getLlmClientForStage — R3-07", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUserId.mockResolvedValue("user-1");
    mocks.createTelemetry.mockResolvedValue({ id: "call-1" });
    mocks.findConfigs.mockResolvedValue(configs);
    mocks.findRoute.mockImplementation(({ where }) => {
      const stage = where.userId_stage.stage;
      if (stage === "concept") {
        return Promise.resolve({
          stage,
          chainJson: JSON.stringify([{ config_id: "concept-config", model: "concept-specialized" }]),
          temperature: null,
          maxOutputTokens: null,
        });
      }
      if (stage === "gdd") {
        return Promise.resolve({
          stage,
          chainJson: JSON.stringify([{ config_id: "gdd-config", model: "gdd-specialized" }]),
          temperature: null,
          maxOutputTokens: null,
        });
      }
      return Promise.resolve(null);
    });
    mocks.createConfigured.mockImplementation(({ label, model }) => provider(label, model));
  });

  it("resolves Concept and GDD to independent providers and model overrides", async () => {
    const concept = await getLlmClientForStage("concept");
    const gdd = await getLlmClientForStage("gdd");

    expect(concept).toMatchObject({ providerId: "Concept provider", modelId: "concept-specialized" });
    expect(gdd).toMatchObject({ providerId: "GDD provider", modelId: "gdd-specialized" });
  });

  it("persists routed call telemetry for the authenticated user", async () => {
    const concept = await getLlmClientForStage("concept");

    await concept!.createCompletion({
      messages: [{ role: "user", content: "idea" }],
      stream: false,
    });

    expect(mocks.createTelemetry).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        stage: "concept",
        provider: "Concept provider",
        model: "concept-specialized",
        status: "success",
        totalTokens: 3,
        usageSource: "provider",
      }),
    });
  });
});
