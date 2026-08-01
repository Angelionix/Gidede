export class LlmProviderError extends Error {
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number | null; retryable?: boolean; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = "LlmProviderError";
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export class LlmTimeoutError extends LlmProviderError {
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms`, { retryable: true });
    this.name = "LlmTimeoutError";
  }
}

export class LlmCircuitOpenError extends LlmProviderError {
  constructor(retryAfterMs: number) {
    super(`LLM provider circuit is open; retry after ${Math.max(0, retryAfterMs)}ms`, {
      retryable: true,
    });
    this.name = "LlmCircuitOpenError";
  }
}

export function isTransientLlmError(error: unknown): boolean {
  if (error instanceof LlmProviderError) return error.retryable;
  if (error instanceof DOMException && error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  return false;
}

export function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}
