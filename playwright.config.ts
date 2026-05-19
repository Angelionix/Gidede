import { defineConfig, devices } from "@playwright/test";

/**
 * Gidede — Playwright E2E Test Configuration
 *
 * 4.E.6: Комплексное E2E-тестирование
 * Минимум 15 E2E-тестов в 5 сценариях:
 *   1) Authorization (auth.spec.ts) — 5 тестов
 *   2) Pipeline: Idea → GDD (pipeline.spec.ts) — 4 теста
 *   3) Balance Check (balance.spec.ts) — 3 теста
 *   4) AI Assistant (ai-assistant.spec.ts) — 3 теста
 *   5) Export (export.spec.ts) — 2 теста
 *
 * API-запросы мокаются через page.route() — реальные AI-вызовы
 * недоступны в CI окружении.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["list"]]
    : [["html", { open: "on-failure" }], ["list"]],
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.CI
    ? {
        command: "bun run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      }
    : undefined,
});
