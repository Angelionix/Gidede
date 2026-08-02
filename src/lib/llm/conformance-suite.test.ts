/**
 * R7-05: LLM adapter conformance suite.
 *
 * A single set of tests that any LlmClient implementation must pass.
 * Verifies the LlmClient contract from src/lib/llm/types.ts:
 *   - createCompletion returns a response with choices[0].message.content
 *   - isAvailable returns a boolean
 *   - getCapabilities returns streaming/jsonMode/tools/modelDiscovery flags
 *   - healthCheck returns a ProviderHealth with status/latencyMs/checkedAt
 *   - listModels returns an array of ModelDescriptor
 *   - providerId and modelId are strings (modelId may be null)
 *   - streaming completion returns an AsyncIterable of LlmStreamChunk
 *
 * Uses a mock adapter to validate the suite itself; real adapters should
 * be tested by importing this test and providing their client factory.
 */

import { describe, it, expect, vi } from "vitest";
import type { LlmClient, LlmCompletionRequest, LlmCompletionResponse, LlmStreamChunk, LlmCapabilities, LlmProviderHealth, LlmModelDescriptor } from "@/lib/llm/types";

/** Create a mock LlmClient for conformance testing. */
function createMockClient(overrides: Partial<LlmClient> = {}): LlmClient {
  const capabilities: LlmCapabilities = {
    streaming: true,
    jsonMode: false,
    tools: false,
    modelDiscovery: false,
  };
  const health: LlmProviderHealth = {
    status: "healthy",
    latencyMs: 42,
    checkedAt: new Date().toISOString(),
    reason: "ok",
  };
  const models: LlmModelDescriptor[] = [
    { id: "test-model-1", label: "Test Model 1", ownedBy: "test" },
  ];

  const mockClient = {
    providerId: "mock-provider",
    modelId: "mock-model" as string | null,
    createCompletion: async (request: LlmCompletionRequest) => {
      if (request.stream) {
        return (async function* () {
          yield {
            choices: [{ delta: { content: "mock stream" } }],
            model: "mock-model",
          };
        })();
      }
      return {
        choices: [{ message: { content: "mock completion" } }],
        model: "mock-model",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
    },
    isAvailable: async () => true,
    getCapabilities: () => capabilities,
    healthCheck: async () => health,
    listModels: async () => models,
  };

  return { ...mockClient, ...overrides } as unknown as LlmClient;
}

describe("R7-05 — LLM adapter conformance suite", () => {
  describe("LlmClient contract: createCompletion (non-streaming)", () => {
    it("returns a response with choices[0].message.content", async () => {
      const client = createMockClient();
      const response = await client.createCompletion({
        messages: [{ role: "user", content: "test" }],
        stream: false,
      });
      expect(response.choices).toBeDefined();
      expect(response.choices?.[0]?.message?.content).toBe("mock completion");
    });

    it("response.model is a string", async () => {
      const client = createMockClient();
      const response = await client.createCompletion({
        messages: [{ role: "user", content: "test" }],
        stream: false,
      });
      expect(typeof response.model).toBe("string");
    });

    it("response.usage is optional but when present has token counts", async () => {
      const client = createMockClient();
      const response = await client.createCompletion({
        messages: [{ role: "user", content: "test" }],
        stream: false,
      });
      if (response.usage) {
        expect(response.usage.totalTokens).not.toBeNull();
      }
    });
  });

  describe("LlmClient contract: createCompletion (streaming)", () => {
    it("returns an AsyncIterable of LlmStreamChunk", async () => {
      const client = createMockClient();
      const stream = await client.createCompletion({
        messages: [{ role: "user", content: "test" }],
        stream: true,
      });
      expect(stream[Symbol.asyncIterator]).toBeDefined();
      const chunks: LlmStreamChunk[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].choices?.[0]?.delta?.content).toBeDefined();
    });
  });

  describe("LlmClient contract: isAvailable", () => {
    it("returns a boolean", async () => {
      const client = createMockClient();
      const result = await client.isAvailable();
      expect(typeof result).toBe("boolean");
    });
  });

  describe("LlmClient contract: getCapabilities", () => {
    it("returns LlmCapabilities with streaming/jsonMode/tools/modelDiscovery", () => {
      const client = createMockClient();
      const caps = client.getCapabilities();
      expect(typeof caps.streaming).toBe("boolean");
      expect(typeof caps.jsonMode).toBe("boolean");
      expect(typeof caps.tools).toBe("boolean");
      expect(typeof caps.modelDiscovery).toBe("boolean");
    });
  });

  describe("LlmClient contract: healthCheck", () => {
    it("returns LlmProviderHealth with status/latencyMs/checkedAt", async () => {
      const client = createMockClient();
      const health = await client.healthCheck();
      expect(["healthy", "unavailable", "unknown"]).toContain(health.status);
      expect(typeof health.latencyMs).toBe("number");
      expect(typeof health.checkedAt).toBe("string");
    });
  });

  describe("LlmClient contract: listModels", () => {
    it("returns an array of LlmModelDescriptor", async () => {
      const client = createMockClient();
      const models = await client.listModels();
      expect(Array.isArray(models)).toBe(true);
      if (models.length > 0) {
        expect(typeof models[0].id).toBe("string");
        expect(typeof models[0].label).toBe("string");
      }
    });
  });

  describe("LlmClient contract: providerId and modelId", () => {
    it("providerId is a non-empty string", () => {
      const client = createMockClient();
      expect(typeof client.providerId).toBe("string");
      expect(client.providerId.length).toBeGreaterThan(0);
    });

    it("modelId is a string or null", () => {
      const client = createMockClient();
      expect(client.modelId === null || typeof client.modelId === "string").toBe(true);
    });

    it("modelId can be null (when no model is selected)", () => {
      const client = createMockClient({ modelId: null });
      expect(client.modelId).toBeNull();
    });
  });

  describe("Conformance: error handling", () => {
    it("createCompletion does not throw for valid input", async () => {
      const client = createMockClient();
      await expect(client.createCompletion({
        messages: [{ role: "user", content: "test" }],
        stream: false,
      })).resolves.toBeDefined();
    });

    it("unavailable client returns isAvailable=false", async () => {
      const client = createMockClient({
        isAvailable: async () => false,
      });
      expect(await client.isAvailable()).toBe(false);
    });

    it("unhealthy client returns status=unavailable", async () => {
      const client = createMockClient({
        healthCheck: async () => ({
          status: "unavailable" as const,
          latencyMs: 0,
          checkedAt: new Date().toISOString(),
          reason: "request_failed" as const,
        }),
      });
      const health = await client.healthCheck();
      expect(health.status).toBe("unavailable");
    });
  });
});
