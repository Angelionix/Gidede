"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Gidede — Глобальный Error Boundary
 *
 * Next.js App Router error.tsx — перехватывает ошибки рендеринга
 * во всех дочерних маршрутах. Позволяет пользователю попытаться
 * восстановить состояние без полной перезагрузки страницы.
 */

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Логируем ошибку для мониторинга
    console.error("[Gidede Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>

      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold tracking-tight">
          Что-то пошло не так
        </h2>
        <p className="text-muted-foreground max-w-md">
          Произошла непредвиденная ошибка. Попробуйте повторить действие или
          вернитесь на главную страницу.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60">
            Код ошибки: {error.digest}
          </p>
        )}
      </div>

      <button
        onClick={reset}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <RefreshCw className="h-4 w-4" />
        Попробовать снова
      </button>
    </div>
  );
}
