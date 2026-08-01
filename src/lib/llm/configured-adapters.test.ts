import { describe, expect, it } from "vitest";
import {
  BUILTIN_LLM_ADAPTER_ID,
  BUILTIN_LLM_MODEL_ID,
  createBuiltInLlmClient,
  listConfiguredLlmAdapters,
  normalizeConfiguredLlmOptions,
} from "@/lib/llm/configured-adapters";

describe("unified LLM adapter bootstrap — R3-11", () => {
  it("creates built-in ZAI through the common adapter contract", () => {
    const client = createBuiltInLlmClient();

    expect(client).toMatchObject({
      providerId: BUILTIN_LLM_ADAPTER_ID,
      modelId: BUILTIN_LLM_MODEL_ID,
    });
    expect(client.getCapabilities()).toEqual({
      streaming: true,
      jsonMode: false,
      tools: false,
      modelDiscovery: false,
    });
  });

  it("does not expose the built-in adapter as a user-configurable HTTP connection", () => {
    expect(listConfiguredLlmAdapters().map((adapter) => adapter.id)).toEqual([
      "generic-http",
      "openai-compatible",
    ]);
    expect(() => normalizeConfiguredLlmOptions(BUILTIN_LLM_ADAPTER_ID, null))
      .toThrow(/built-in/);
  });
});
