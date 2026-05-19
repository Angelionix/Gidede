/**
 * Gidede — Глобальный Loading State
 *
 * Next.js App Router loading.tsx — показывается при загрузке
 * дочерних маршрутов (Suspense fallback).
 */

export default function Loading() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-8" role="status" aria-busy="true">
      <div className="relative h-10 w-10">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
      </div>
      <p className="text-sm text-muted-foreground">Загрузка...</p>
    </div>
  );
}
