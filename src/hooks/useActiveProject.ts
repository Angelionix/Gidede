/**
 * Gidede — Хук и утилиты для работы с активным проектом.
 *
 * DRY: заменяет 11+ дублирований
 * `typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null`
 * по всему фронтенду.
 *
 * Решает проблему SSR hydration mismatch: значение читается в useEffect,
 * а не во время серверного рендера.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "gidede_active_project";

// ============================================================
// ХУК (для React-компонентов)
// ============================================================

export function useActiveProject() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setProjectId(stored);
    setIsLoaded(true);

    // Слушаем изменения из других вкладок
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setProjectId(e.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setActiveProject = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setProjectId(id);
  }, []);

  return { projectId, isLoaded, setActiveProject };
}

// ============================================================
// УТИЛИТЫ (для не-React контекста)
// ============================================================

/**
 * Получить ID активного проекта (без хука).
 * Безопасно для SSR — возвращает null на сервере.
 */
export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Установить ID активного проекта (без хука).
 * Безопасно для SSR — ничего не делает на сервере.
 */
export function setActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}
