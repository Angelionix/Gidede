import {
  BUILTIN_LLM_ADAPTER_ID,
  createBuiltInLlmClient,
} from "@/lib/llm/configured-adapters";
import { getLlmRegistry } from "@/lib/llm/registry";
import type { LlmClient } from "@/lib/llm/types";

const registry = getLlmRegistry();

if (!registry.has(BUILTIN_LLM_ADAPTER_ID)) {
  registry.register(
    BUILTIN_LLM_ADAPTER_ID,
    async () => createBuiltInLlmClient(),
    { default: true },
  );
}

export function getBuiltInLlmProviderId(): string | null {
  return registry.getDefaultProviderId();
}

export function getRegisteredBuiltInLlmClient(): Promise<LlmClient | null> {
  return registry.getDefault();
}
