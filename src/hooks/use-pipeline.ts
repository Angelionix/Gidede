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
  notifications: PipelineNotification[];
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
      const res = await apiFetch(
        apiRoutes.pipeline.state(projectId)
      );

      if (!res.ok) {
        if (res.status === 404) {
          // Проект не найден — не ошибка, просто нет данных
          setState(null);
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setState(data);
    } catch (err) {
      console.error("Failed to fetch pipeline state:", err);
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [projectId, apiFetch]);

  // Подготовить входные данные для блока
  const prepareInput = useCallback(
    async (blockId: number) => {
      if (!projectId) return null;

      try {
        const res = await apiFetch(
          apiRoutes.pipeline.prepare(projectId, blockId)
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        return await res.json();
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
        const res = await apiFetch(
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

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const result = await res.json();

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
        const res = await apiFetch(
          apiRoutes.pipeline.stale(projectId, blockId),
          { method: "DELETE" }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

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
        const res = await apiFetch(
          apiRoutes.pipeline.runPipeline(projectId),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(conceptInput),
          }
        );

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const result = await res.json();

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
