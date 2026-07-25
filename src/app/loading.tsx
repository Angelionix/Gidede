/**
 * Gidede — Глобальный Loading State
 *
 * Next.js App Router loading.tsx — показывается при загрузке
 * дочерних маршрутов (Suspense fallback).
 *
 * 4.E.3: Скелетон-состояние для асинхронной загрузки данных.
 * Визуально повторяет структуру типичной страницы блоков:
 * заголовок → форма → результаты.
 */

export default function Loading() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" role="status" aria-busy="true" aria-label="Загрузка">
      {/* Заголовок — skeleton */}
      <div className="flex items-center gap-3 animate-pulse">
        <div className="h-6 w-6 rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-6 w-48 rounded bg-muted" />
          <div className="h-4 w-32 rounded bg-muted" />
        </div>
        <div className="ml-auto h-6 w-24 rounded-full bg-muted" />
      </div>

      {/* Карточка формы — skeleton */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="space-y-2 animate-pulse">
          <div className="h-5 w-40 rounded bg-muted" />
          <div className="h-4 w-64 rounded bg-muted" />
        </div>

        {/* Поля формы */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-9 w-full rounded-md bg-muted" />
            </div>
          ))}
        </div>

        {/* Кнопка */}
        <div className="animate-pulse">
          <div className="h-10 w-48 rounded-md bg-muted" />
        </div>
      </div>

      {/* Карточка результатов — skeleton */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3 animate-pulse">
          <div className="h-5 w-36 rounded bg-muted" />
          <div className="ml-auto flex gap-2">
            <div className="h-5 w-16 rounded-full bg-muted" />
            <div className="h-5 w-16 rounded-full bg-muted" />
          </div>
        </div>

        {/* Табы */}
        <div className="flex gap-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 rounded-md bg-muted" />
          ))}
        </div>

        {/* Контент */}
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-muted" />
              <div className="h-4 flex-1 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>

      {/* Экранный ридер текст */}
      <span className="sr-only">Загрузка данных...</span>
    </div>
  );
}
