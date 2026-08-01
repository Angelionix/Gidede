import { LlmAdapterRegistry, type LlmAdapterDescriptor } from "@/lib/llm/adapter-registry";
import { createOpenAiCompatibleLlmClient } from "@/lib/llm/providers/openai-compatible";
import { GenericHttpLlmClient, parseGenericHttpMapping } from "@/lib/llm/providers/generic-http";
import type { LlmClient } from "@/lib/llm/types";

const registry = new LlmAdapterRegistry();

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
  return registry.list();
}

export function normalizeConfiguredLlmOptions(adapterId: string, options: unknown): unknown {
  return registry.normalizeOptions(adapterId, options);
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
  }, { normalized: true });
}
