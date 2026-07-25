/**
 * Gidede — Хук и утилиты для работы с активным проектом.
 *
 * Phase 5.7: стабилизация активного проекта.
 *
 * Раньше использовался ТОЛЬКО localStorage, что вызывало:
 *  - SSR hydration mismatch (значение читалось в useEffect, не при SSR)
 *  - race-condition между вкладками (storage event не синхронен)
 *  - недоступность из middleware (middleware работает на сервере, не видит localStorage)
 *
 * Теперь: dual-write в localStorage (для client-side) + cookie (для middleware/SSR).
 * Cookie `gidede_active_project` читается middleware и server components,
 * что позволяет рендерить UI с уже известным активным проектом без hydration mismatch.
 *
 * DRY: заменяет 14+ дублирований `localStorage.getItem("gidede_active_project")`
 * по всему фронтенду.
 */

"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "gidede_active_project";
const COOKIE_KEY = "gidede_active_project";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

// ============================================================
// Cookie utilities (client-side)
// ============================================================

function setCookie(name: string, value: string, maxAgeSec: number): void {
  if (typeof document === "undefined") return;
  const isProduction = window.location.protocol === "https:";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; samesite=lax${isProduction ? "; secure" : ""}`;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

// ============================================================
// ХУК (для React-компонентов)
// ============================================================

export function useActiveProject() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Read from localStorage (primary client store)
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-time hydration from localStorage on mount
    setProjectId(stored);
    // Sync cookie with localStorage on mount (in case cookie was cleared)
    if (stored) {
      setCookie(COOKIE_KEY, stored, COOKIE_MAX_AGE);
    } else {
      deleteCookie(COOKIE_KEY);
    }
    setIsLoaded(true);

    // Слушаем изменения из других вкладок
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const newValue = e.newValue;
        setProjectId(newValue);
        if (newValue) {
          setCookie(COOKIE_KEY, newValue, COOKIE_MAX_AGE);
        } else {
          deleteCookie(COOKIE_KEY);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setActiveProject = useCallback((id: string | null) => {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
      setCookie(COOKIE_KEY, id, COOKIE_MAX_AGE);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      deleteCookie(COOKIE_KEY);
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
 * Читает из localStorage (client-only).
 */
export function getActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Установить ID активного проекта (без хука).
 * Dual-write: localStorage + cookie.
 * Безопасно для SSR — ничего не делает на сервере.
 */
export function setActiveProjectId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(STORAGE_KEY, id);
    setCookie(COOKIE_KEY, id, COOKIE_MAX_AGE);
  } else {
    localStorage.removeItem(STORAGE_KEY);
    deleteCookie(COOKIE_KEY);
  }
}
