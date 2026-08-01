import { isTransientLlmError } from "@/lib/llm/errors";
import type {
  LlmCapabilities,
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmIntrospectionOptions,
  LlmModelDescriptor,
  LlmProviderHealth,
  LlmStreamChunk,
} from "@/lib/llm/types";

export const ROUTABLE_LLM_STAGES = [
  "default",
  "assistant",
  "concept",
  "core_loop",
  "mda",
  "balance",
  "progression",
  "economy",
  "gdd",
  "validation",
  "prototype",
] as const;

export type LlmRouteStage = (typeof ROUTABLE_LLM_STAGES)[number];

export interface LlmRouteEntry {
  configId: string | "builtin";
  model: string | null;
}

export interface LlmRoutePolicy {
  stage: LlmRouteStage;
  chain: LlmRouteEntry[];
  temperature: number | null;
  maxOutputTokens: number | null;
}

export interface LlmRouteCandidate {
  client: LlmClient;
  model: string | null;
}

function optionalModel(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new Error("route model must be a non-empty string up to 200 characters");
  }
  return value.trim();
}

function optionalNumber(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  integer = false,
): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${field} must be between ${minimum} and ${maximum}`);
  }
  if (integer && !Number.isInteger(value)) throw new Error(`${field} must be an integer`);
  return value;
}

export function parseLlmRoutePolicy(value: unknown): LlmRoutePolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("route policy must be an object");
  }
  const input = value as Record<string, unknown>;
  const stage = input.stage;
  if (typeof stage !== "string" || !(ROUTABLE_LLM_STAGES as readonly string[]).includes(stage)) {
    throw new Error(`route stage must be one of: ${ROUTABLE_LLM_STAGES.join(", ")}`);
  }
  if (!Array.isArray(input.chain) || input.chain.length < 1 || input.chain.length > 5) {
    throw new Error("route chain must contain between 1 and 5 entries");
  }
  const chain = input.chain.map((raw, index): LlmRouteEntry => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`route chain entry ${index} must be an object`);
    }
    const entry = raw as Record<string, unknown>;
    const configId = entry.config_id ?? entry.configId;
    if (typeof configId !== "string" || !configId.trim() || configId.length > 100) {
      throw new Error(`route chain entry ${index} has an invalid config_id`);
    }
    return { configId: configId.trim(), model: optionalModel(entry.model) };
  });
  const uniqueEntries = new Set(chain.map((entry) => `${entry.configId}\0${entry.model || ""}`));
  if (uniqueEntries.size !== chain.length) throw new Error("route chain contains duplicate entries");

  return {
    stage: stage as LlmRouteStage,
    chain,
    temperature: optionalNumber(input.temperature, "temperature", 0, 2),
    maxOutputTokens: optionalNumber(
      input.max_output_tokens ?? input.maxOutputTokens,
      "max_output_tokens",
      1,
      200_000,
      true,
    ),
  };
}

export function serializeLlmRoutePolicy(policy: LlmRoutePolicy) {
  return {
    stage: policy.stage,
    chain: policy.chain.map((entry) => ({ config_id: entry.configId, model: entry.model })),
    temperature: policy.temperature,
    max_output_tokens: policy.maxOutputTokens,
  };
}

/**
 * Executes an ordered provider/model chain. Fallback is deliberately limited to
 * classified transient errors. A stream can move to the next candidate only before
 * its first emitted chunk, preventing duplicated user-visible text.
 */
export class RoutedLlmClient implements LlmClient {
  readonly providerId: string;
  readonly modelId: string | null;

  constructor(
    readonly stage: LlmRouteStage,
    private readonly candidates: LlmRouteCandidate[],
    private readonly routeDefaults: { temperature: number | null; maxOutputTokens: number | null } = {
      temperature: null,
      maxOutputTokens: null,
    },
  ) {
    if (candidates.length === 0) throw new Error("LLM route requires at least one candidate");
    this.providerId = candidates[0].client.providerId;
    this.modelId = candidates[0].model || candidates[0].client.modelId;
  }

  private requestForCandidate(
    request: LlmCompletionRequest,
    candidate: LlmRouteCandidate,
  ): LlmCompletionRequest {
    return {
      ...request,
      model: candidate.model || request.model,
      temperature: request.temperature ?? this.routeDefaults.temperature ?? undefined,
      maxTokens: request.maxTokens ?? this.routeDefaults.maxOutputTokens ?? undefined,
    };
  }

  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  async createCompletion(
    request: LlmCompletionRequest,
  ): Promise<LlmCompletionResponse | AsyncIterable<LlmStreamChunk>> {
    if (request.stream) return this.streamWithFallback(request as LlmCompletionRequest & { stream: true });

    for (let index = 0; index < this.candidates.length; index += 1) {
      const candidate = this.candidates[index];
      try {
        return await candidate.client.createCompletion({
          ...this.requestForCandidate(request, candidate),
          stream: false,
        });
      } catch (error) {
        if (!isTransientLlmError(error) || index === this.candidates.length - 1) throw error;
      }
    }
    throw new Error("LLM route has no candidates");
  }

  private async *streamWithFallback(
    request: LlmCompletionRequest & { stream: true },
  ): AsyncIterable<LlmStreamChunk> {
    let emitted = false;
    for (let index = 0; index < this.candidates.length; index += 1) {
      const candidate = this.candidates[index];
      try {
        const stream = await candidate.client.createCompletion({
          ...this.requestForCandidate(request, candidate),
          stream: true,
        });
        for await (const chunk of stream) {
          emitted = true;
          yield chunk;
        }
        return;
      } catch (error) {
        if (emitted || !isTransientLlmError(error) || index === this.candidates.length - 1) throw error;
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    for (const candidate of this.candidates) {
      if (await candidate.client.isAvailable()) return true;
    }
    return false;
  }

  getCapabilities(): LlmCapabilities {
    return this.candidates[0].client.getCapabilities();
  }

  async healthCheck(options?: LlmIntrospectionOptions): Promise<LlmProviderHealth> {
    let unavailable: LlmProviderHealth | null = null;
    for (const candidate of this.candidates) {
      const health = await candidate.client.healthCheck(options);
      if (health.status !== "unavailable") return health;
      unavailable = health;
    }
    return unavailable ?? {
      status: "unknown",
      latencyMs: 0,
      checkedAt: new Date().toISOString(),
      reason: "not_configured",
    };
  }

  listModels(options?: LlmIntrospectionOptions): Promise<LlmModelDescriptor[]> {
    return this.candidates[0].client.listModels(options);
  }
}
