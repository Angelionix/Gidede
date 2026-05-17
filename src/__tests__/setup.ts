/**
 * Gidede — Vitest Setup
 * Фаза 4.A.11: Локальная тестовая инфраструктура
 *
 * Глобальная настройка для всех фронтенд-тестов.
 */

import "@testing-library/jest-dom/vitest";

// Мок для next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Мок для next-auth
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: null,
    status: "unauthenticated",
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Мок для fetch
global.fetch = vi.fn();
