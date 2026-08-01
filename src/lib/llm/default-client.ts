import { getLlmRegistry } from "@/lib/llm/registry";
import { TtlCache } from "@/lib/llm/client-cache";
import { createConfiguredLlmClient } from "@/lib/llm/configured-adapters";
import {
  llmResiliencePolicyFromEnv,
  withLlmResilience,
} from "@/lib/llm/resilience";
import { createZaiLlmClient } from "@/lib/llm/providers/zai";
import type { LlmClient } from "@/lib/llm/types";
import { db } from "@/lib/db";
import { getAuthUserId } from "@/lib/server-auth";

const DEFAULT_PROVIDER_ID = "zai-sdk";
const registry = getLlmRegistry();
if (!registry.has(DEFAULT_PROVIDER_ID)) {
  registry.register(DEFAULT_PROVIDER_ID, createZaiLlmClient, { default: true });
}

const resiliencePolicy = llmResiliencePolicyFromEnv();
const configuredClients = new TtlCache<LlmClient>(resiliencePolicy.clientTtlMs);
const builtInClients = new WeakMap<LlmClient, LlmClient>();

function resilient(client: LlmClient): LlmClient {
  const cached = builtInClients.get(client);
  if (cached) return cached;
  const wrapped = withLlmResilience(client, resiliencePolicy);
  builtInClients.set(client, wrapped);
  return wrapped;
}

async function getConfiguredUserClient(): Promise<LlmClient | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;

  const config = await db.userLlmConfig.findUnique({ where: { userId } });
  if (!config?.enabled) return null;

  const cacheKey = `${config.id}:${config.updatedAt.getTime()}`;
  return configuredClients.getOrCreate(cacheKey, () => withLlmResilience(
    createConfiguredLlmClient({
      adapterId: config.adapter,
      label: config.label,
      baseUrl: config.baseUrl,
      model: config.model,
      secretRef: config.secretRef,
      options: config.configJson ? JSON.parse(config.configJson) : null,
    }),
    resiliencePolicy,
  ));
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

  try {
    const client = await registry.getDefault();
    return client ? resilient(client) : null;
  } catch (error) {
    console.error(
      "[llm] default provider initialization failed:",
      error instanceof Error ? error.message : String(error),
    );
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
