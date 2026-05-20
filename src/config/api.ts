/**
 * Gidede — Единый источник истины для API URL и роутов.
 *
 * DRY: заменяет 13+ дублирований `process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030"`
 * по всему фронтенду.
 *
 * Default: http://localhost:3030 — порт FastAPI backend.
 */

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3030";

// ============================================================
// API ROUTES
// ============================================================

export const apiRoutes = {
  auth: {
    login: () => `${API_BASE_URL}/api/v1/auth/login`,
    register: () => `${API_BASE_URL}/api/v1/auth/register`,
    refresh: () => `${API_BASE_URL}/api/v1/auth/refresh`,
    me: () => `${API_BASE_URL}/api/v1/auth/me`,
  },
  projects: {
    list: () => `${API_BASE_URL}/api/v1/projects/`,
    detail: (id: string) => `${API_BASE_URL}/api/v1/projects/${id}`,
    create: () => `${API_BASE_URL}/api/v1/projects/`,
  },
  blocks: {
    concept: (action: string) =>
      `${API_BASE_URL}/api/v1/concept/${action}`,
    coreloop: (action: string) =>
      `${API_BASE_URL}/api/v1/coreloop/${action}`,
    mda: (action: string) => `${API_BASE_URL}/api/v1/mda/${action}`,
    balance: (action: string) =>
      `${API_BASE_URL}/api/v1/balance/${action}`,
    progression: (action: string) =>
      `${API_BASE_URL}/api/v1/progression/${action}`,
    economy: (action: string) =>
      `${API_BASE_URL}/api/v1/economy/${action}`,
  },
  pipeline: {
    state: (projectId: string) =>
      `${API_BASE_URL}/api/v1/pipeline/state/${projectId}`,
    prepare: (projectId: string, blockId: number) =>
      `${API_BASE_URL}/api/v1/pipeline/prepare-input/${projectId}/${blockId}`,
    notify: () => `${API_BASE_URL}/api/v1/pipeline/notify-updated`,
    stale: (projectId: string, blockId: number) =>
      `${API_BASE_URL}/api/v1/pipeline/stale/${projectId}/${blockId}`,
    runPipeline: (projectId: string) =>
      `${API_BASE_URL}/api/v1/pipeline/run-full-pipeline/${projectId}`,
    runPartial: (projectId: string) =>
      `${API_BASE_URL}/api/v1/pipeline/run-pipeline/${projectId}`,
  },
  rag: {
    search: () => `${API_BASE_URL}/api/v1/rag/search`,
  },
  gbe: {
    syncTo: () => `${API_BASE_URL}/api/v1/gbe/sync-to`,
    syncFrom: () => `${API_BASE_URL}/api/v1/gbe/sync-from`,
    webhook: () => `${API_BASE_URL}/api/v1/gbe/webhook`,
    status: (projectId: string) => `${API_BASE_URL}/api/v1/gbe/status/${projectId}`,
    testConnection: () => `${API_BASE_URL}/api/v1/gbe/test-connection`,
    syncHistory: (limit: number = 10) => `${API_BASE_URL}/api/v1/gbe/sync-history?limit=${limit}`,
  },
  health: () => `${API_BASE_URL}/api/v1/health`,
} as const;
