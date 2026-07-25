"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { apiRoutes } from "@/config/api";

// ============================================================
// ТИПЫ
// ============================================================

export type BlockStatus = "empty" | "in_progress" | "completed" | "stale";

export interface BlockProgress {
  block_id: number;
  name: string;
  status: BlockStatus;
  is_filled: boolean;
  updated_at: string | null;
  stale_since: string | null;
  stale_reason: string | null;
}

export interface PipelineNotification {
  type: "stale_warning";
  block_id: number;
  block_name: string;
  message: string;
  severity: "warning";
  stale_since: string | null;
  stale_reason: string | null;
}

export interface PipelineState {
  project_id: string;
  project_name: string;
  blocks: BlockProgress[];
  completion_percent: number;
  current_stage: string;
  can_proceed_to: number | null;
  next_block: number | null;
  current_block?: number | null;
  notifications: PipelineNotification[];
}

/** Тип ответа API для операций с HTTP-статусом */
interface ApiResponse {
  ok: boolean;
  status: number;
  data?: unknown;
}

// ============================================================
// ХУК usePipeline
// ============================================================

export function usePipeline(projectId: string | null) {
  const { apiFetch } = useAuth();
  const [state, setState] = useState<PipelineState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Загрузить состояние пайплайна
  const fetchState = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await apiFetch<PipelineState>(
        apiRoutes.pipeline.state(projectId)
      );
      setState(data);
    } catch (err) {
      // 404 — проект не найден, это не ошибка
      if (err instanceof Error && err.message.includes("404")) {
        setState(null);
        return;
      }
      console.error("Failed to fetch pipeline state:", err);
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [projectId, apiFetch]);

  // Подготовить входные данные для блока
  const prepareInput = useCallback(
    async (blockId: number): Promise<unknown> => {
      if (!projectId) return null;

      try {
        const result = await apiFetch<unknown>(
          apiRoutes.pipeline.prepare(projectId, blockId)
        );
        return result;
      } catch (err) {
        console.error(`Failed to prepare input for block ${blockId}:`, err);
        return null;
      }
    },
    [projectId, apiFetch]
  );

  // Уведомить об обновлении блока
  const notifyUpdated = useCallback(
    async (blockId: number, metadata?: Record<string, unknown>) => {
      if (!projectId) return null;

      try {
        const result = await apiFetch<ApiResponse>(
          apiRoutes.pipeline.notify(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              project_id: projectId,
              block_id: blockId,
              metadata: metadata || {},
            }),
          }
        );

        // Обновляем состояние после уведомления
        await fetchState();

        return result;
      } catch (err) {
        console.error(`Failed to notify block ${blockId} updated:`, err);
        return null;
      }
    },
    [projectId, apiFetch, fetchState]
  );

  // Снять stale-статус
  const clearStale = useCallback(
    async (blockId: number) => {
      if (!projectId) return false;

      try {
        await apiFetch<ApiResponse>(
          apiRoutes.pipeline.stale(projectId, blockId),
          { method: "DELETE" }
        );

        // Обновляем состояние
        await fetchState();

        return true;
      } catch (err) {
        console.error(`Failed to clear stale for block ${blockId}:`, err);
        return false;
      }
    },
    [projectId, apiFetch, fetchState]
  );

  // Первичная загрузка
  useEffect(() => {
    if (projectId) {
      fetchState();
    }
  }, [projectId, fetchState]);

  // Периодическое обновление (каждые 30 сек)
  useEffect(() => {
    if (!projectId) return;

    const interval = setInterval(() => {
      fetchState();
    }, 30000);

    return () => clearInterval(interval);
  }, [projectId, fetchState]);

  // Запустить полный пайплайн 1→5 (4.C.9)
  const runFullPipeline = useCallback(
    async (conceptInput: {
      idea: string;
      genre?: string;
      target_audience?: Record<string, unknown>;
      platform?: string[];
      constraints?: Record<string, unknown>;
      reference_games?: string[];
      forbidden_mechanics?: string[];
    }) => {
      if (!projectId) return null;

      try {
        const result = await apiFetch<ApiResponse>(
          apiRoutes.pipeline.runPipeline(projectId),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(conceptInput),
          }
        );

        // Обновляем состояние пайплайна после выполнения
        await fetchState();

        return result;
      } catch (err) {
        console.error("Failed to run full pipeline:", err);
        return null;
      }
    },
    [projectId, apiFetch, fetchState]
  );

  return {
    state,
    loading,
    error,
    fetchState,
    prepareInput,
    notifyUpdated,
    clearStale,
    runFullPipeline,
    // Удобные геттеры
    notifications: state?.notifications || [],
    staleBlocks: (state?.blocks || []).filter((b) => b.status === "stale"),
    completedBlocks: (state?.blocks || []).filter((b) => b.status === "completed"),
    completionPercent: state?.completion_percent || 0,
    nextBlock: state?.next_block || null,
  };
}
