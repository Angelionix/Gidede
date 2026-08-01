import { getLlmRegistry } from "@/lib/llm/registry";
import { TtlCache } from "@/lib/llm/client-cache";
import { createConfiguredLlmClient } from "@/lib/llm/configured-adapters";
import {
  llmResiliencePolicyFromEnv,
  withLlmResilience,
} from "@/lib/llm/resilience";
import { createZaiLlmClient } from "@/lib/llm/providers/zai";
import {
  parseLlmRoutePolicy,
  RoutedLlmClient,
  type LlmRouteCandidate,
  type LlmRoutePolicy,
  type LlmRouteStage,
} from "@/lib/llm/routing";
import type {
  LlmCapabilities,
  LlmClient,
  LlmProviderHealth,
} from "@/lib/llm/types";
import { db } from "@/lib/db";
import { getAuthUserId } from "@/lib/server-auth";
import { createLlmTelemetryStore } from "@/lib/llm/telemetry-store";

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

function configuredClient(config: {
  id: string;
  adapter: string;
  label: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  configJson: string | null;
  updatedAt: Date;
}): LlmClient {
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

async function getBuiltInClient(): Promise<LlmClient | null> {
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

export async function getConfiguredLlmClient(configId: string): Promise<LlmClient | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;
  try {
    const config = await db.userLlmConfig.findFirst({ where: { id: configId, userId, enabled: true } });
    return config ? configuredClient(config) : null;
  } catch (error) {
    console.error(
      "[llm] configured provider resolution failed:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function storedPolicy(route: {
  stage: string;
  chainJson: string;
  temperature: number | null;
  maxOutputTokens: number | null;
}): LlmRoutePolicy {
  return parseLlmRoutePolicy({
    stage: route.stage,
    chain: JSON.parse(route.chainJson),
    temperature: route.temperature,
    max_output_tokens: route.maxOutputTokens,
  });
}

export async function getLlmClientForStage(stage: LlmRouteStage): Promise<LlmClient | null> {
  const userId = await getAuthUserId();
  if (!userId) return getBuiltInClient();

  try {
    const [configs, exactRoute, defaultRoute] = await Promise.all([
      db.userLlmConfig.findMany({ where: { userId, enabled: true }, orderBy: { createdAt: "asc" } }),
      db.userLlmRoute.findUnique({ where: { userId_stage: { userId, stage } } }),
      stage === "default"
        ? Promise.resolve(null)
        : db.userLlmRoute.findUnique({ where: { userId_stage: { userId, stage: "default" } } }),
    ]);
    const routeRecord = exactRoute || defaultRoute;
    const policy = routeRecord ? storedPolicy(routeRecord) : null;
    const configById = new Map(configs.map((config) => [config.id, config]));
    const entries = policy?.chain ?? [
      ...configs.slice(0, 1).map((config) => ({ configId: config.id, model: null })),
      { configId: "builtin" as const, model: null },
    ];
    const candidates: LlmRouteCandidate[] = [];
    for (const entry of entries) {
      if (entry.configId === "builtin") {
        const client = await getBuiltInClient();
        if (client) candidates.push({ client, model: entry.model });
        continue;
      }
      const config = configById.get(entry.configId);
      if (config) candidates.push({ client: configuredClient(config), model: entry.model });
    }
    if (candidates.length === 0) return null;
    return new RoutedLlmClient(stage, candidates, {
      temperature: policy?.temperature ?? null,
      maxOutputTokens: policy?.maxOutputTokens ?? null,
    }, createLlmTelemetryStore(userId));
  } catch (error) {
    console.error(
      `[llm] route resolution failed for ${stage}:`,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

export function getDefaultLlmClient(): Promise<LlmClient | null> {
  return getLlmClientForStage("default");
}

export async function getDefaultLlmStatus(stage: LlmRouteStage = "default"): Promise<{
  available: boolean;
  providerId: string | null;
  modelId: string | null;
  capabilities: LlmCapabilities | null;
  health: LlmProviderHealth | null;
}> {
  const client = await getLlmClientForStage(stage);
  if (!client) {
    return {
      available: false,
      providerId: registry.getDefaultProviderId(),
      modelId: null,
      capabilities: null,
      health: null,
    };
  }
  const health = await client.healthCheck();
  return {
    available: health.status !== "unavailable",
    providerId: client.providerId,
    modelId: client.modelId,
    capabilities: client.getCapabilities(),
    health,
  };
}
