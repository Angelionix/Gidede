"use client";

import { useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Home, Bug } from "lucide-react";
import Link from "next/link";

/**
 * Gidede — Глобальный Error Boundary
 *
 * Next.js App Router error.tsx — перехватывает ошибки рендеринга
 * во всех дочерних маршрутах. Позволяет пользователю попытаться
 * восстановить состояние без полной перезагрузки страницы.
 *
 * 4.E.4: Добавлена возможность повторной попытки с отсчётом,
 * кнопка возврата на главную, детальная информация об ошибке.
 */

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // Логируем ошибку для мониторинга
    console.error("[Gidede Error Boundary]", error);
  }, [error]);

  const handleRetry = async () => {
    setIsRetrying(true);
    setRetryCount((prev) => prev + 1);

    // Небольшая задержка перед повторной попыткой
    await new Promise((resolve) => setTimeout(resolve, 500));

    try {
      reset();
    } catch {
      // Если retry тоже падает — просто обновляем состояние
      setIsRetrying(false);
    }
  };

  // Определяем тип ошибки для более информативного сообщения
  const isNetworkError =
    error.message?.includes("fetch") ||
    error.message?.includes("network") ||
    error.message?.includes("Failed to fetch") ||
    error.message?.includes("NetworkError");

  const isTimeoutError =
    error.message?.includes("timeout") ||
    error.message?.includes("Timeout") ||
    error.message?.includes("превысил таймаут");

  const isAIError =
    error.message?.includes("AI") ||
    error.message?.includes("provider") ||
    error.message?.includes("prompt");

  const getErrorTitle = () => {
    if (isNetworkError) return "Ошибка сети";
    if (isTimeoutError) return "Превышено время ожидания";
    if (isAIError) return "Ошибка AI-сервиса";
    return "Что-то пошло не так";
  };

  const getErrorDescription = () => {
    if (isNetworkError)
      return "Не удалось подключиться к серверу. Проверьте подключение к интернету и попробуйте снова.";
    if (isTimeoutError)
      return "Сервер не ответил за отведённое время. Попробуйте повторить действие — возможно, нагрузка снизится.";
    if (isAIError)
      return "AI-сервис временно недоступен. Это может быть связано с нагрузкой или техническими работами. Попробуйте позже.";
    return "Произошла непредвиденная ошибка. Попробуйте повторить действие или вернитесь на главную страницу.";
  };

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <div className="text-center space-y-2 max-w-md">
        <h2 className="text-2xl font-bold tracking-tight">
          {getErrorTitle()}
        </h2>
        <p className="text-muted-foreground">
          {getErrorDescription()}
        </p>

        {/* Детали ошибки (сворачиваемые) */}
        {retryCount > 0 && (
          <details className="mt-3 text-left">
            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
              Детали ошибки
            </summary>
            <pre className="mt-2 text-xs text-destructive/80 bg-muted/50 rounded-md p-3 overflow-auto max-h-32">
              {error.message || "Неизвестная ошибка"}
            </pre>
          </details>
        )}

        {error.digest && (
          <p className="text-xs text-muted-foreground/60">
            Код ошибки: {error.digest}
          </p>
        )}

        {retryCount > 0 && (
          <p className="text-xs text-muted-foreground">
            Попыток восстановления: {retryCount}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
          {isRetrying ? "Восстановление..." : "Попробовать снова"}
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <Home className="h-4 w-4" />
          На главную
        </Link>
      </div>

      {/* Подсказка для повторной ошибки */}
      {retryCount >= 3 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 max-w-md">
          <Bug className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-medium">Ошибка повторяется</p>
            <p className="mt-1">
              Если проблема не устраняется после нескольких попыток, попробуйте
              обновить страницу (Ctrl+Shift+R) или очистить кэш браузера.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
