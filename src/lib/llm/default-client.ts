import { getLlmRegistry } from "@/lib/llm/registry";
import { createZaiLlmClient } from "@/lib/llm/providers/zai";
import type { LlmClient } from "@/lib/llm/types";

const DEFAULT_PROVIDER_ID = "zai-sdk";
const registry = getLlmRegistry();
if (!registry.has(DEFAULT_PROVIDER_ID)) {
  registry.register(DEFAULT_PROVIDER_ID, createZaiLlmClient, { default: true });
}

let initError: string | null = null;

export async function getDefaultLlmClient(): Promise<LlmClient | null> {
  if (initError) return null;
  try {
    return await registry.getDefault();
  } catch (error) {
    initError = error instanceof Error ? error.message : String(error);
    console.error("[llm] default provider initialization failed:", initError);
    return null;
  }
}

export async function getDefaultLlmStatus(): Promise<{
  available: boolean;
  providerId: string | null;
  modelId: string | null;
}> {
  const client = await getDefaultLlmClient();
  if (!client) return { available: false, providerId: registry.getDefaultProviderId(), modelId: null };
  return {
    available: await client.isAvailable(),
    providerId: client.providerId,
    modelId: client.modelId,
  };
}
