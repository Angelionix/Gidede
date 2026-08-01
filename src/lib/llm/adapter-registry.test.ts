import { describe, expect, it, vi } from "vitest";
import { LlmAdapterRegistry } from "./adapter-registry";
import type { LlmClient } from "./types";

function client(providerId: string): LlmClient {
  return {
    providerId,
    modelId: "model",
    createCompletion: vi.fn(),
    isAvailable: vi.fn(async () => true),
  } as unknown as LlmClient;
}

describe("LlmAdapterRegistry — R3-03", () => {
  it("connects a custom adapter with one descriptor registration", () => {
    const registry = new LlmAdapterRegistry();
    const create = vi.fn((config) => client(config.providerId));
    registry.register({
      id: "vendor-plugin",
      label: "Vendor plugin",
      normalizeOptions: (options) => ({ normalized: options }),
      create,
    });

    const result = registry.create("vendor-plugin", {
      providerId: "vendor-plugin:demo",
      baseUrl: "https://vendor.example/generate",
      model: "vendor-model",
      secretRef: "env:VENDOR_KEY",
      options: { region: "eu" },
    });

    expect(result.providerId).toBe("vendor-plugin:demo");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      options: { normalized: { region: "eu" } },
    }));
    expect(registry.list()).toEqual([{ id: "vendor-plugin", label: "Vendor plugin" }]);
  });

  it("rejects invalid, duplicate and unknown adapter ids", () => {
    const registry = new LlmAdapterRegistry();
    const descriptor = { id: "adapter", label: "Adapter", create: () => client("adapter") };
    registry.register(descriptor);
    expect(() => registry.register(descriptor)).toThrow(/already registered/);
    expect(() => registry.register({ ...descriptor, id: "Invalid id" })).toThrow(/lowercase/);
    expect(() => registry.create("missing", {
      providerId: "missing",
      baseUrl: "https://example.com",
      model: "model",
      secretRef: null,
      options: null,
    })).toThrow(/Unknown LLM adapter/);
  });

  it("keeps built-in adapters in the same registry but outside user configuration", () => {
    const registry = new LlmAdapterRegistry();
    registry.register({
      id: "built-in",
      label: "Built in",
      configurable: false,
      create: (config) => client(config.providerId),
    });
    registry.register({
      id: "external",
      label: "External",
      create: (config) => client(config.providerId),
    });

    expect(registry.list()).toEqual([
      { id: "built-in", label: "Built in" },
      { id: "external", label: "External" },
    ]);
    expect(registry.list({ configurableOnly: true })).toEqual([
      { id: "external", label: "External" },
    ]);
    expect(() => registry.normalizeOptions("built-in", null, {
      configurable: true,
    })).toThrow(/built-in/);
  });
});
