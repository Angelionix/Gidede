import { describe, expect, it, vi } from "vitest";
import { LlmRegistry } from "./registry";
import type { LlmClient } from "./types";

function fakeClient(providerId: string): LlmClient {
  return {
    providerId,
    modelId: "test-model",
    async createCompletion(request) {
      if (request.stream) {
        return (async function* () { yield { choices: [{ delta: { content: "ok" } }] }; })();
      }
      return { choices: [{ message: { content: "ok" } }] };
    },
    async isAvailable() { return true; },
  } as LlmClient;
}

describe("LlmRegistry — R3-01", () => {
  it("creates a provider lazily and reuses the same instance", async () => {
    const registry = new LlmRegistry();
    const factory = vi.fn(async () => fakeClient("alpha"));
    registry.register("alpha", factory, { default: true });
    expect(factory).not.toHaveBeenCalled();
    expect(await registry.getDefault()).toBe(await registry.get("alpha"));
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("supports explicit default selection without provider-specific imports", async () => {
    const registry = new LlmRegistry();
    registry.register("alpha", async () => fakeClient("alpha"));
    registry.register("beta", async () => fakeClient("beta"));
    registry.setDefault("beta");
    expect((await registry.getDefault())?.providerId).toBe("beta");
    expect(registry.list()).toEqual(["alpha", "beta"]);
  });

  it("rejects duplicate and unknown providers", async () => {
    const registry = new LlmRegistry();
    registry.register("alpha", async () => fakeClient("alpha"));
    expect(() => registry.register("alpha", async () => fakeClient("other"))).toThrow(/already registered/);
    await expect(registry.get("missing")).rejects.toThrow(/Unknown LLM provider/);
  });
});
