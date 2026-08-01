import { getLlmRegistry } from "@/lib/llm/registry";
import { createConfiguredLlmClient } from "@/lib/llm/configured-adapters";
import { createZaiLlmClient } from "@/lib/llm/providers/zai";
import type { LlmClient } from "@/lib/llm/types";
import { db } from "@/lib/db";
import { getAuthUserId } from "@/lib/server-auth";

const DEFAULT_PROVIDER_ID = "zai-sdk";
const registry = getLlmRegistry();
if (!registry.has(DEFAULT_PROVIDER_ID)) {
  registry.register(DEFAULT_PROVIDER_ID, createZaiLlmClient, { default: true });
}

let initError: string | null = null;

async function getConfiguredUserClient(): Promise<LlmClient | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const config = await db.userLlmConfig.findUnique({ where: { userId } });
  if (!config?.enabled) return null;

  return createConfiguredLlmClient({
    adapterId: config.adapter,
    label: config.label,
    baseUrl: config.baseUrl,
    model: config.model,
    secretRef: config.secretRef,
    options: config.configJson ? JSON.parse(config.configJson) : null,
  });
}

export async function getDefaultLlmClient(): Promise<LlmClient | null> {
  try {
    const configuredClient = await getConfiguredUserClient();
    if (configuredClient) return configuredClient;
  } catch (error) {
    console.error(
      "[llm] user provider resolution failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

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
