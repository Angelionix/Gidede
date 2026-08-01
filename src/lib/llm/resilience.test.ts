import { describe, expect, it, vi } from "vitest";
import {
  LlmCircuitOpenError,
  LlmProviderError,
  LlmTimeoutError,
} from "./errors";
import {
  DEFAULT_LLM_RESILIENCE_POLICY,
  ResilientLlmClient,
  type LlmResiliencePolicy,
} from "./resilience";
import type { LlmClient, LlmCompletionRequest } from "./types";

function policy(overrides: Partial<LlmResiliencePolicy> = {}): LlmResiliencePolicy {
  return {
    ...DEFAULT_LLM_RESILIENCE_POLICY,
    timeoutMs: 100,
    maxRetries: 0,
    backoffBaseMs: 10,
    backoffMaxMs: 100,
    circuitFailureThreshold: 3,
    circuitCooldownMs: 1_000,
    clientTtlMs: 5_000,
    ...overrides,
  };
}

function fakeClient(
  create: (request: LlmCompletionRequest) => Promise<unknown>,
): LlmClient {
  return {
    providerId: "test-provider",
    modelId: "test-model",
    createCompletion: create,
    async isAvailable() { return true; },
  } as unknown as LlmClient;
}

const completionRequest = {
  messages: [{ role: "user" as const, content: "hello" }],
  stream: false as const,
};

describe("ResilientLlmClient — R3-05", () => {
  it("retries classified transient errors with exponential backoff", async () => {
    const create = vi.fn()
      .mockRejectedValueOnce(new LlmProviderError("busy", { status: 503, retryable: true }))
      .mockRejectedValueOnce(new LlmProviderError("limited", { status: 429, retryable: true }))
      .mockResolvedValueOnce({ choices: [{ message: { content: "ok" } }] });
    const sleep = vi.fn(async (_delayMs: number, _signal?: AbortSignal) => undefined);
    const client = new ResilientLlmClient(fakeClient(create), policy({ maxRetries: 2 }), {
      random: () => 0.5,
      sleep,
    });

    await expect(client.createCompletion(completionRequest)).resolves.toMatchObject({
      choices: [{ message: { content: "ok" } }],
    });
    expect(create).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([10, 20]);
  });

  it("does not retry permanent provider errors", async () => {
    const create = vi.fn(async () => {
      throw new LlmProviderError("invalid request", { status: 400, retryable: false });
    });
    const sleep = vi.fn(async () => undefined);
    const client = new ResilientLlmClient(fakeClient(create), policy({ maxRetries: 3 }), { sleep });

    await expect(client.createCompletion(completionRequest)).rejects.toThrow("invalid request");
    expect(create).toHaveBeenCalledOnce();
    expect(sleep).not.toHaveBeenCalled();
  });

  it("aborts a hanging request at the configured timeout", async () => {
    const create = vi.fn((_request: LlmCompletionRequest) => new Promise(() => undefined));
    const client = new ResilientLlmClient(fakeClient(create), policy({ timeoutMs: 10 }));

    await expect(client.createCompletion(completionRequest)).rejects.toBeInstanceOf(LlmTimeoutError);
    expect(create).toHaveBeenCalledOnce();
    expect(create.mock.calls[0][0].signal).toBeInstanceOf(AbortSignal);
    expect(create.mock.calls[0][0].signal?.aborted).toBe(true);
  });

  it("opens the circuit after consecutive transient failures and recovers with a half-open probe", async () => {
    let now = 10_000;
    const create = vi.fn(async (): Promise<unknown> => {
      throw new LlmProviderError("offline", { status: 503, retryable: true });
    });
    const client = new ResilientLlmClient(
      fakeClient(create),
      policy({ circuitFailureThreshold: 2, circuitCooldownMs: 1_000 }),
      { now: () => now },
    );

    await expect(client.createCompletion(completionRequest)).rejects.toThrow("offline");
    await expect(client.createCompletion(completionRequest)).rejects.toThrow("offline");
    expect(client.getCircuitState()).toBe("open");
    await expect(client.createCompletion(completionRequest)).rejects.toBeInstanceOf(LlmCircuitOpenError);
    expect(create).toHaveBeenCalledTimes(2);

    now += 1_000;
    create.mockImplementationOnce(async () => ({ choices: [{ message: { content: "recovered" } }] }));
    await expect(client.createCompletion(completionRequest)).resolves.toBeTruthy();
    expect(client.getCircuitState()).toBe("closed");
  });

  it("never retries a failed stream after content was emitted", async () => {
    const create = vi.fn(async () => (async function* () {
      yield { choices: [{ delta: { content: "A" } }] };
      throw new LlmProviderError("stream interrupted", { retryable: true });
    })());
    const client = new ResilientLlmClient(fakeClient(create), policy({ maxRetries: 2 }), {
      sleep: vi.fn(async () => undefined),
    });
    const stream = await client.createCompletion({ ...completionRequest, stream: true });
    const content: string[] = [];

    await expect((async () => {
      for await (const chunk of stream) content.push(chunk.choices?.[0]?.delta?.content || "");
    })()).rejects.toThrow("stream interrupted");
    expect(content).toEqual(["A"]);
    expect(create).toHaveBeenCalledOnce();
  });

  it("times out an idle stream while waiting for its next chunk", async () => {
    const create = vi.fn(async () => ({
      [Symbol.asyncIterator]() {
        return {
          next: () => new Promise<IteratorResult<never>>(() => undefined),
        };
      },
    }));
    const client = new ResilientLlmClient(fakeClient(create), policy({ timeoutMs: 10 }));
    const stream = await client.createCompletion({ ...completionRequest, stream: true });

    await expect((async () => {
      for await (const _chunk of stream) {
        // The provider never emits a chunk.
      }
    })()).rejects.toBeInstanceOf(LlmTimeoutError);
    expect(create).toHaveBeenCalledOnce();
  });
});
