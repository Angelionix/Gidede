/**
 * Gidede — API Client с обработкой ошибок
 * 4.E.4: Сетевая обработка ошибок, таймауты, retry
 */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export class ApiTimeoutError extends ApiClientError {
  constructor(timeoutMs: number) {
    super(
      `Запрос превысил время ожидания (${timeoutMs / 1000}с)`,
      408,
      "TIMEOUT"
    );
    this.name = "ApiTimeoutError";
  }
}

export class ApiNetworkError extends ApiClientError {
  constructor() {
    super(
      "Не удалось подключиться к серверу. Проверьте подключение к интернету.",
      0,
      "NETWORK_ERROR"
    );
    this.name = "ApiNetworkError";
  }
}

/** Тип ошибки для отображения в UI */
export type ApiErrorType = "network" | "timeout" | "auth" | "validation" | "server" | "unknown";

export function classifyError(error: unknown): ApiErrorType {
  if (error instanceof ApiTimeoutError) return "timeout";
  if (error instanceof ApiNetworkError) return "network";
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.status === 403) return "auth";
    if (error.status === 422) return "validation";
    if (error.status && error.status >= 500) return "server";
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("таймаут")) return "timeout";
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("сеть")) return "network";
  }
  return "unknown";
}

/** Человекочитаемое сообщение об ошибке на русском */
export function getErrorMessage(error: unknown): string {
  const type = classifyError(error);

  switch (type) {
    case "network":
      return "Не удалось подключиться к серверу. Проверьте подключение к интернету.";
    case "timeout":
      return "Сервер не ответил за отведённое время. Попробуйте позже или уменьшите объём данных.";
    case "auth":
      return "Сессия истекла. Войдите в аккаунт заново.";
    case "validation":
      return "Некорректные входные данные. Проверьте введённые значения.";
    case "server":
      return "Внутренняя ошибка сервера. Попробуйте позже.";
    default:
      if (error instanceof Error) return error.message || "Произошла неизвестная ошибка.";
      return "Произошла неизвестная ошибка.";
  }
}

export interface FetchWithRetryOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * Утилита для fetch-запросов с retry, timeout и обработкой ошибок.
 * 4.E.4: Экспоненциальный backoff, таймаут, классификация ошибок.
 */
export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: FetchWithRetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 2,
    retryDelay = 1000,
    timeoutMs = 30000,
    signal: externalSignal,
  } = retryOptions;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Проверяем, не отменён ли запрос
    if (externalSignal?.aborted) {
      throw new ApiClientError("Запрос отменён", 0, "CANCELLED");
    }

    // Создаём AbortController для таймаута
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Связываем с внешним signal если есть
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onExternalAbort);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", onExternalAbort);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage =
          (errorBody as Record<string, unknown>).detail?.toString() ||
          (errorBody as Record<string, unknown>).message?.toString() ||
          `Ошибка сервера (${response.status})`;

        throw new ApiClientError(
          errorMessage,
          response.status,
          (errorBody as Record<string, unknown>).code?.toString(),
          errorBody
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      externalSignal?.removeEventListener("abort", onExternalAbort);

      // Timeout
      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        !externalSignal?.aborted
      ) {
        lastError = new ApiTimeoutError(timeoutMs);
      }
      // Network error
      else if (
        error instanceof TypeError &&
        (error.message.includes("fetch") || error.message.includes("Failed"))
      ) {
        lastError = new ApiNetworkError();
      }
      // Already classified error
      else if (error instanceof ApiClientError) {
        // Don't retry auth errors
        if (error.status === 401 || error.status === 403 || error.status === 422) {
          throw error;
        }
        lastError = error;
      } else {
        lastError = error;
      }

      // Retry with exponential backoff (if attempts remain)
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
