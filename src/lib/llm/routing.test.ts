import { describe, expect, it, vi } from "vitest";
import { LlmProviderError } from "@/lib/llm/errors";
import { parseLlmRoutePolicy, RoutedLlmClient } from "@/lib/llm/routing";
import type { LlmClient, LlmCompletionRequest } from "@/lib/llm/types";

function client(
  providerId: string,
  createCompletion: (request: LlmCompletionRequest) => Promise<unknown>,
  healthStatus: "healthy" | "unavailable" | "unknown" = "healthy",
): LlmClient {
  return {
    providerId,
    modelId: `${providerId}-default`,
    createCompletion,
    isAvailable: async () => true,
    getCapabilities: () => ({ streaming: true, jsonMode: false, tools: false, modelDiscovery: false }),
    healthCheck: async () => ({
      status: healthStatus,
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      reason: healthStatus === "healthy" ? "ok" : "request_failed",
    }),
    listModels: async () => [],
  } as unknown as LlmClient;
}

const request = {
  messages: [{ role: "user" as const, content: "hello" }],
  stream: false as const,
};

describe("RoutedLlmClient — R3-07", () => {
  it("applies the stage model and route defaults to the primary provider", async () => {
    const complete = vi.fn(async () => ({ choices: [{ message: { content: "ok" } }] }));
    const routed = new RoutedLlmClient(
      "concept",
      [{ client: client("concept-provider", complete), model: "concept-model" }],
      { temperature: 0.35, maxOutputTokens: 900 },
    );

    await routed.createCompletion(request);

    expect(complete).toHaveBeenCalledWith(expect.objectContaining({
      model: "concept-model",
      temperature: 0.35,
      maxTokens: 900,
      stream: false,
    }));
  });

  it("falls back to the next provider/model only after a transient failure", async () => {
    const primary = vi.fn(async () => {
      throw new LlmProviderError("busy", { status: 503, retryable: true });
    });
    const fallback = vi.fn(async () => ({ model: "gdd-fallback", choices: [{ message: { content: "ok" } }] }));
    const routed = new RoutedLlmClient("gdd", [
      { client: client("primary", primary), model: "gdd-primary" },
      { client: client("fallback", fallback), model: "gdd-fallback" },
    ]);

    await expect(routed.createCompletion(request)).resolves.toMatchObject({ model: "gdd-fallback" });
    expect(primary).toHaveBeenCalledOnce();
    expect(fallback).toHaveBeenCalledWith(expect.objectContaining({ model: "gdd-fallback" }));
  });

  it("does not hide a permanent provider error with fallback", async () => {
    const primary = vi.fn(async () => {
      throw new LlmProviderError("invalid request", { status: 400, retryable: false });
    });
    const fallback = vi.fn();
    const routed = new RoutedLlmClient("concept", [
      { client: client("primary", primary), model: null },
      { client: client("fallback", fallback), model: null },
    ]);

    await expect(routed.createCompletion(request)).rejects.toThrow("invalid request");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("can fall back when a stream fails before its first chunk", async () => {
    const primary = vi.fn(async () => {
      throw new LlmProviderError("offline", { retryable: true });
    });
    const fallback = vi.fn(async () => (async function* () {
      yield { choices: [{ delta: { content: "B" } }] };
    })());
    const routed = new RoutedLlmClient("assistant", [
      { client: client("primary", primary), model: null },
      { client: client("fallback", fallback), model: null },
    ]);

    const stream = await routed.createCompletion({ ...request, stream: true });
    const output: string[] = [];
    for await (const chunk of stream) output.push(chunk.choices?.[0]?.delta?.content || "");

    expect(output).toEqual(["B"]);
    expect(fallback).toHaveBeenCalledOnce();
  });

  it("never falls back after a stream emitted user-visible content", async () => {
    const primary = vi.fn(async () => (async function* () {
      yield { choices: [{ delta: { content: "A" } }] };
      throw new LlmProviderError("interrupted", { retryable: true });
    })());
    const fallback = vi.fn();
    const routed = new RoutedLlmClient("assistant", [
      { client: client("primary", primary), model: null },
      { client: client("fallback", fallback), model: null },
    ]);
    const stream = await routed.createCompletion({ ...request, stream: true });

    await expect((async () => {
      for await (const _chunk of stream) {
        // Consume until the provider interruption.
      }
    })()).rejects.toThrow("interrupted");
    expect(fallback).not.toHaveBeenCalled();
  });

  it("reports the route healthy when a configured fallback is healthy", async () => {
    const routed = new RoutedLlmClient("concept", [
      { client: client("primary", vi.fn(), "unavailable"), model: null },
      { client: client("fallback", vi.fn(), "healthy"), model: null },
    ]);

    await expect(routed.healthCheck()).resolves.toMatchObject({ status: "healthy" });
  });
});

describe("parseLlmRoutePolicy", () => {
  it("normalizes a bounded ordered provider chain", () => {
    expect(parseLlmRoutePolicy({
      stage: "gdd",
      chain: [
        { config_id: "provider-a", model: "gdd-model" },
        { config_id: "builtin" },
      ],
      temperature: 0.2,
      max_output_tokens: 4_000,
    })).toEqual({
      stage: "gdd",
      chain: [
        { configId: "provider-a", model: "gdd-model" },
        { configId: "builtin", model: null },
      ],
      temperature: 0.2,
      maxOutputTokens: 4_000,
    });
  });

  it("rejects unknown stages, duplicate entries and unbounded generation settings", () => {
    expect(() => parseLlmRoutePolicy({ stage: "unknown", chain: [{ config_id: "builtin" }] })).toThrow(/stage/);
    expect(() => parseLlmRoutePolicy({
      stage: "concept",
      chain: [{ config_id: "builtin" }, { config_id: "builtin" }],
    })).toThrow(/duplicate/);
    expect(() => parseLlmRoutePolicy({
      stage: "concept",
      chain: [{ config_id: "builtin" }],
      max_output_tokens: 1_000_000,
    })).toThrow(/max_output_tokens/);
  });
});

describe("RoutedLlmClient telemetry — R3-10", () => {
  it("reports the actual successful provider, response model, latency and tokens", async () => {
    const telemetry = vi.fn();
    const routed = new RoutedLlmClient(
      "concept",
      [{
        client: client("provider-a", vi.fn(async () => ({
          model: "actual-model",
          choices: [{ message: { content: "ok" } }],
          usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
        }))),
        model: "configured-model",
      }],
      undefined,
      telemetry,
    );

    await routed.createCompletion(request);

    expect(telemetry).toHaveBeenCalledWith(expect.objectContaining({
      stage: "concept",
      providerId: "provider-a",
      modelId: "actual-model",
      status: "success",
      stream: false,
      latencyMs: expect.any(Number),
      usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 },
      usageSource: "provider",
      errorClass: null,
    }));
  });

  it("records a classified primary failure and the factual fallback success", async () => {
    const telemetry = vi.fn();
    const primary = vi.fn(async () => {
      throw new LlmProviderError("busy", { status: 503, retryable: true });
    });
    const fallback = vi.fn(async () => ({
      model: "fallback-actual",
      choices: [{ message: { content: "ok" } }],
    }));
    const routed = new RoutedLlmClient(
      "gdd",
      [
        { client: client("primary", primary), model: "primary-model" },
        { client: client("fallback", fallback), model: "fallback-model" },
      ],
      undefined,
      telemetry,
    );

    await routed.createCompletion(request);

    expect(telemetry.mock.calls.map(([event]) => event)).toEqual([
      expect.objectContaining({
        providerId: "primary",
        modelId: "primary-model",
        status: "error",
        errorClass: "provider_transient",
      }),
      expect.objectContaining({
        providerId: "fallback",
        modelId: "fallback-actual",
        status: "success",
        usageSource: "unavailable",
      }),
    ]);
  });

  it("collects final stream usage and does not fail the call when a telemetry sink fails", async () => {
    const requestTelemetry = vi.fn();
    const failingStore = vi.fn(() => {
      throw new Error("telemetry database unavailable");
    });
    const streaming = vi.fn(async () => (async function* () {
      yield { choices: [{ delta: { content: "ok" } }] };
      yield {
        model: "stream-actual",
        usage: { inputTokens: 5, outputTokens: 1, totalTokens: 6 },
      };
    })());
    const routed = new RoutedLlmClient(
      "assistant",
      [{ client: client("stream-provider", streaming), model: null }],
      undefined,
      failingStore,
    );

    const stream = await routed.createCompletion({
      ...request,
      stream: true,
      onTelemetry: requestTelemetry,
    });
    for await (const _chunk of stream) {
      // Consume the stream so completion telemetry is emitted.
    }

    expect(requestTelemetry).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "stream-provider",
      modelId: "stream-actual",
      stream: true,
      usage: { inputTokens: 5, outputTokens: 1, totalTokens: 6 },
    }));
  });
});
