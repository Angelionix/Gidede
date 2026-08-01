import { LlmAdapterRegistry, type LlmAdapterDescriptor } from "@/lib/llm/adapter-registry";
import { createOpenAiCompatibleLlmClient } from "@/lib/llm/providers/openai-compatible";
import { GenericHttpLlmClient, parseGenericHttpMapping } from "@/lib/llm/providers/generic-http";
import { createZaiLlmClient } from "@/lib/llm/providers/zai";
import type { LlmClient } from "@/lib/llm/types";

const registry = new LlmAdapterRegistry();
export const BUILTIN_LLM_ADAPTER_ID = "zai-sdk";
export const BUILTIN_LLM_MODEL_ID = "glm-4.6";

registry.register({
  id: BUILTIN_LLM_ADAPTER_ID,
  label: "Built-in ZAI",
  configurable: false,
  normalizeOptions: () => null,
  create: (config) => createZaiLlmClient({
    providerId: config.providerId,
    model: config.model,
  }),
});

registry.register({
  id: "openai-compatible",
  label: "OpenAI-compatible",
  normalizeOptions: () => null,
  create: (config) => createOpenAiCompatibleLlmClient({
    providerId: config.providerId,
    baseUrl: config.baseUrl,
    model: config.model,
    secretRef: config.secretRef,
  }),
});

registry.register({
  id: "generic-http",
  label: "Generic HTTP mapping",
  normalizeOptions: parseGenericHttpMapping,
  create: (config) => new GenericHttpLlmClient({
    providerId: config.providerId,
    endpoint: config.baseUrl,
    model: config.model,
    secretRef: config.secretRef,
    mapping: config.options,
  }),
});

export function registerConfiguredLlmAdapter(descriptor: LlmAdapterDescriptor): void {
  registry.register(descriptor);
}

export function listConfiguredLlmAdapters(): Array<{ id: string; label: string }> {
  return registry.list({ configurableOnly: true });
}

export function normalizeConfiguredLlmOptions(adapterId: string, options: unknown): unknown {
  return registry.normalizeOptions(adapterId, options, { configurable: true });
}

export function createBuiltInLlmClient(): LlmClient {
  return registry.create(BUILTIN_LLM_ADAPTER_ID, {
    providerId: BUILTIN_LLM_ADAPTER_ID,
    baseUrl: "",
    model: BUILTIN_LLM_MODEL_ID,
    secretRef: null,
    options: null,
  });
}

export function createConfiguredLlmClient(config: {
  adapterId: string;
  label: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  options: unknown;
}): LlmClient {
  return registry.create(config.adapterId, {
    providerId: `${config.adapterId}:${config.label}`,
    baseUrl: config.baseUrl,
    model: config.model,
    secretRef: config.secretRef,
    options: config.options,
  }, { normalized: true, configurable: true });
}
