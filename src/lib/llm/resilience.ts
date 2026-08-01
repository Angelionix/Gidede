import {
  isTransientLlmError,
  LlmCircuitOpenError,
  LlmTimeoutError,
} from "@/lib/llm/errors";
import type {
  LlmClient,
  LlmCompletionRequest,
  LlmCompletionResponse,
  LlmStreamChunk,
} from "@/lib/llm/types";

export interface LlmResiliencePolicy {
  timeoutMs: number;
  maxRetries: number;
  backoffBaseMs: number;
  backoffMaxMs: number;
  circuitFailureThreshold: number;
  circuitCooldownMs: number;
  clientTtlMs: number;
}

export const DEFAULT_LLM_RESILIENCE_POLICY: LlmResiliencePolicy = {
  timeoutMs: 30_000,
  maxRetries: 2,
  backoffBaseMs: 250,
  backoffMaxMs: 2_000,
  circuitFailureThreshold: 3,
  circuitCooldownMs: 30_000,
  clientTtlMs: 5 * 60_000,
};

type Sleep = (delayMs: number, signal?: AbortSignal) => Promise<void>;

interface ResilienceDependencies {
  now?: () => number;
  random?: () => number;
  sleep?: Sleep;
}

function integerFromEnv(name: string, fallback: number, minimum: number, maximum: number): number {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

export function llmResiliencePolicyFromEnv(): LlmResiliencePolicy {
  return {
    timeoutMs: integerFromEnv("GIDEDE_LLM_TIMEOUT_MS", DEFAULT_LLM_RESILIENCE_POLICY.timeoutMs, 100, 300_000),
    maxRetries: integerFromEnv("GIDEDE_LLM_MAX_RETRIES", DEFAULT_LLM_RESILIENCE_POLICY.maxRetries, 0, 5),
    backoffBaseMs: integerFromEnv("GIDEDE_LLM_BACKOFF_BASE_MS", DEFAULT_LLM_RESILIENCE_POLICY.backoffBaseMs, 10, 30_000),
    backoffMaxMs: integerFromEnv("GIDEDE_LLM_BACKOFF_MAX_MS", DEFAULT_LLM_RESILIENCE_POLICY.backoffMaxMs, 10, 60_000),
    circuitFailureThreshold: integerFromEnv(
      "GIDEDE_LLM_CIRCUIT_FAILURE_THRESHOLD",
      DEFAULT_LLM_RESILIENCE_POLICY.circuitFailureThreshold,
      1,
      20,
    ),
    circuitCooldownMs: integerFromEnv(
      "GIDEDE_LLM_CIRCUIT_COOLDOWN_MS",
      DEFAULT_LLM_RESILIENCE_POLICY.circuitCooldownMs,
      100,
      600_000,
    ),
    clientTtlMs: integerFromEnv("GIDEDE_LLM_CLIENT_TTL_MS", DEFAULT_LLM_RESILIENCE_POLICY.clientTtlMs, 1_000, 3_600_000),
  };
}

function defaultSleep(delayMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

class AttemptContext {
  readonly signal: AbortSignal;
  private readonly controller = new AbortController();
  private readonly externalSignal?: AbortSignal;
  private readonly onExternalAbort: () => void;

  constructor(private readonly timeoutMs: number, externalSignal?: AbortSignal) {
    this.signal = this.controller.signal;
    this.externalSignal = externalSignal;
    this.onExternalAbort = () => this.controller.abort(
      externalSignal?.reason ?? new DOMException("Aborted", "AbortError"),
    );
    if (externalSignal?.aborted) this.onExternalAbort();
    else externalSignal?.addEventListener("abort", this.onExternalAbort, { once: true });
  }

  async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this.signal.aborted) throw this.signal.reason;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => undefined;
    let abortListener: () => void = onAbort;
    const interruption = new Promise<never>((_, reject) => {
      abortListener = () => reject(
        this.signal.reason ?? new DOMException("Aborted", "AbortError"),
      );
      this.signal.addEventListener("abort", abortListener, { once: true });
      timer = setTimeout(() => {
        this.controller.abort(new LlmTimeoutError(this.timeoutMs));
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([Promise.resolve().then(operation), interruption]);
    } finally {
      if (timer) clearTimeout(timer);
      this.signal.removeEventListener("abort", abortListener);
    }
  }

  abort(): void {
    if (!this.signal.aborted) this.controller.abort();
  }

  cleanup(): void {
    this.externalSignal?.removeEventListener("abort", this.onExternalAbort);
  }
}

export class ResilientLlmClient implements LlmClient {
  readonly providerId: string;
  readonly modelId: string | null;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly sleep: Sleep;
  private consecutiveFailures = 0;
  private circuitOpenedAt: number | null = null;
  private halfOpenProbe = false;

  constructor(
    private readonly inner: LlmClient,
    readonly policy: LlmResiliencePolicy = DEFAULT_LLM_RESILIENCE_POLICY,
    dependencies: ResilienceDependencies = {},
  ) {
    this.providerId = inner.providerId;
    this.modelId = inner.modelId;
    this.now = dependencies.now ?? Date.now;
    this.random = dependencies.random ?? Math.random;
    this.sleep = dependencies.sleep ?? defaultSleep;
  }

  createCompletion(request: LlmCompletionRequest & { stream: false }): Promise<LlmCompletionResponse>;
  createCompletion(request: LlmCompletionRequest & { stream: true }): Promise<AsyncIterable<LlmStreamChunk>>;
  async createCompletion(request: LlmCompletionRequest): Promise<LlmCompletionResponse | AsyncIterable<LlmStreamChunk>> {
    if (request.stream === true) {
      return this.streamWithResilience(request as LlmCompletionRequest & { stream: true });
    }
    return this.completeWithResilience(request as LlmCompletionRequest & { stream: false });
  }

  getCircuitState(): "closed" | "open" | "half_open" {
    if (this.circuitOpenedAt === null) return "closed";
    if (this.halfOpenProbe) return "half_open";
    return "open";
  }

  private beginCircuitRequest(): void {
    if (this.circuitOpenedAt === null) return;
    const elapsed = this.now() - this.circuitOpenedAt;
    if (elapsed < this.policy.circuitCooldownMs || this.halfOpenProbe) {
      throw new LlmCircuitOpenError(this.policy.circuitCooldownMs - elapsed);
    }
    this.halfOpenProbe = true;
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitOpenedAt = null;
    this.halfOpenProbe = false;
  }

  private recordFailure(error: unknown): void {
    if (!isTransientLlmError(error)) {
      this.recordSuccess();
      return;
    }
    this.consecutiveFailures += 1;
    if (this.halfOpenProbe || this.consecutiveFailures >= this.policy.circuitFailureThreshold) {
      this.circuitOpenedAt = this.now();
    }
    this.halfOpenProbe = false;
  }

  private recordRequestFailure(error: unknown, request: LlmCompletionRequest): void {
    if (request.signal?.aborted) {
      this.halfOpenProbe = false;
      return;
    }
    this.recordFailure(error);
  }

  private canRetry(error: unknown, attempt: number, request: LlmCompletionRequest): boolean {
    return !request.signal?.aborted
      && isTransientLlmError(error)
      && attempt < this.policy.maxRetries;
  }

  private backoffDelay(attempt: number): number {
    const exponential = Math.min(
      this.policy.backoffMaxMs,
      this.policy.backoffBaseMs * (2 ** attempt),
    );
    return Math.round(exponential * (0.75 + this.random() * 0.5));
  }

  private async completeWithResilience(
    request: LlmCompletionRequest & { stream: false },
  ): Promise<LlmCompletionResponse> {
    this.beginCircuitRequest();
    for (let attempt = 0; ; attempt += 1) {
      const context = new AttemptContext(this.policy.timeoutMs, request.signal);
      try {
        const response = await context.run(() => this.inner.createCompletion({
          ...request,
          signal: context.signal,
        }));
        this.recordSuccess();
        return response;
      } catch (error) {
        if (this.canRetry(error, attempt, request)) {
          try {
            await this.sleep(this.backoffDelay(attempt), request.signal);
          } catch (sleepError) {
            this.recordRequestFailure(sleepError, request);
            throw sleepError;
          }
          continue;
        }
        this.recordRequestFailure(error, request);
        throw error;
      } finally {
        context.cleanup();
      }
    }
  }

  private async *streamWithResilience(
    request: LlmCompletionRequest & { stream: true },
  ): AsyncIterable<LlmStreamChunk> {
    let settled = false;
    let emitted = false;
    this.beginCircuitRequest();
    try {
      for (let attempt = 0; ; attempt += 1) {
        const context = new AttemptContext(this.policy.timeoutMs, request.signal);
        let iterator: AsyncIterator<LlmStreamChunk> | null = null;
        try {
          const stream = await context.run(() => this.inner.createCompletion({
            ...request,
            signal: context.signal,
          }));
          iterator = stream[Symbol.asyncIterator]();
          while (true) {
            const next = await context.run(() => iterator!.next());
            if (next.done) {
              this.recordSuccess();
              settled = true;
              return;
            }
            emitted = true;
            yield next.value;
          }
        } catch (error) {
          if (!emitted && this.canRetry(error, attempt, request)) {
            try {
              await this.sleep(this.backoffDelay(attempt), request.signal);
            } catch (sleepError) {
              this.recordRequestFailure(sleepError, request);
              settled = true;
              throw sleepError;
            }
            continue;
          }
          this.recordRequestFailure(error, request);
          settled = true;
          throw error;
        } finally {
          context.abort();
          context.cleanup();
          try {
            await iterator?.return?.();
          } catch {
            // Preserve the original stream outcome; cleanup errors are not retry signals.
          }
        }
      }
    } finally {
      if (!settled) this.recordSuccess();
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      this.beginCircuitRequest();
      const context = new AttemptContext(this.policy.timeoutMs);
      try {
        const available = await context.run(() => this.inner.isAvailable());
        this.recordSuccess();
        return available;
      } finally {
        context.cleanup();
      }
    } catch (error) {
      if (error instanceof LlmCircuitOpenError) return false;
      this.recordFailure(error);
      return false;
    }
  }
}

export function withLlmResilience(
  client: LlmClient,
  policy: LlmResiliencePolicy = llmResiliencePolicyFromEnv(),
): LlmClient {
  return client instanceof ResilientLlmClient ? client : new ResilientLlmClient(client, policy);
}
