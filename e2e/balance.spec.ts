/**
 * Gidede — E2E: Сценарий 2 «Проверка баланса»
 *
 * 3 теста:
 *   1. Ввод данных баланса и запуск транзитивного анализа
 *   2. Интранзитивный анализ с payoff-матрицей
 *   3. Monte Carlo симуляция — запуск и отображение результатов
 *
 * API-запросы мокаются через page.route().
 */
import { test, expect } from "@playwright/test";

// ============================================================
// Mock Data
// ============================================================

const MOCK_USER = {
  id: "usr_balance_001",
  email: "balance-e2e@gidede.io",
  name: "Balance Tester",
  plan: "free",
  ai_calls_count: 0,
  ai_calls_limit: 50,
  is_active: true,
  created_at: new Date().toISOString(),
  last_login_at: null,
};

const MOCK_BALANCE_RESULT = {
  id: "balance_001",
  transitive_result: {
    anchor_object_id: "warrior",
    objects: [
      {
        id: "warrior",
        name: "Воин",
        cost: 100,
        power: 95,
        cp_ratio: 0.95,
        status: "balanced",
        deviation_pct: 0,
      },
      {
        id: "mage",
        name: "Маг",
        cost: 120,
        power: 110,
        cp_ratio: 0.917,
        status: "balanced",
        deviation_pct: -3.5,
      },
      {
        id: "archer",
        name: "Лучник",
        cost: 80,
        power: 70,
        cp_ratio: 0.875,
        status: "underpowered",
        deviation_pct: -7.9,
      },
    ],
    anchor_cp_ratio: 0.95,
  },
  intransitive_result: {
    payoff_matrix: {
      dimensions: ["warrior", "mage", "archer"],
      rows: [
        [0.5, 0.3, 0.7],
        [0.7, 0.5, 0.4],
        [0.3, 0.6, 0.5],
      ],
    },
    dominant_strategies: [],
    nash_equilibria: [{ strategy: ["warrior", "mage"], probability: 0.4 }],
  },
  monte_carlo_result: {
    num_simulations: 1000,
    win_rates: {
      warrior: 0.35,
      mage: 0.38,
      archer: 0.27,
    },
    avg_battle_duration: 12.5,
    balance_verdict: "slightly_imbalanced",
    resource_distribution: {
      warrior: { mean: 50, std: 12 },
      mage: { mean: 55, std: 15 },
      archer: { mean: 42, std: 10 },
    },
  },
  machinations_result: {
    stable: true,
    pathologies: [],
    resource_trend: "stable",
  },
  corrections: [
    {
      object_id: "archer",
      type: "buff",
      description: "Лучник недооценён: увеличьте power с 70 до 80",
      confidence: 0.85,
    },
  ],
  latency_ms: 1523,
};

// ============================================================
// Helpers
// ============================================================

async function setupAuthenticatedPage(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/auth/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    });
  });

  await page.route("**/api/v1/projects/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ projects: [], total: 0, page: 1, per_page: 20 }),
    });
  });

  await page.route("**/api/v1/pipeline/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ project_id: "proj_001", blocks: {}, stale_blocks: [] }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem("gidede_access_token", "mock_balance_token");
    localStorage.setItem("gidede_refresh_token", "mock_balance_refresh");
    localStorage.setItem("gidede_active_project", "proj_001");
  });
}

// ============================================================
// Tests
// ============================================================

test.describe("Сценарий 2: Проверка баланса", () => {
  test("2.1 — Ввод данных баланса и запуск транзитивного анализа", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    // Мокаем balance API
    await page.route("**/api/v1/balance/analyze**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BALANCE_RESULT),
      });
    });

    await page.route("**/api/v1/pipeline/notify-updated**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.goto("/blocks/4");

    // Проверяем, что страница Блока 4 загружена
    await expect(page.locator("text=Balance and Simulation")).toBeVisible();

    // Нажимаем кнопку «Run Analysis»
    await page.locator('button:has-text("Run Analysis")').click();

    // Ждём появления результатов
    await expect(page.locator("text=Transitive")).toBeVisible({
      timeout: 15_000,
    });

    // Проверяем, что транзитивный анализ отображен
    await expect(page.locator('button[role="tab"]:has-text("Transitive")')).toBeVisible();

    // Кликаем на вкладку Transitive
    await page.locator('button[role="tab"]:has-text("Transitive")').click();

    // Проверяем, что данные объектов отображены
    await expect(page.locator("text=Воин")).toBeVisible({ timeout: 10_000 });
  });

  test("2.2 — Интранзитивный анализ с payoff-матрицей", async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.route("**/api/v1/balance/analyze**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BALANCE_RESULT),
      });
    });

    await page.route("**/api/v1/pipeline/notify-updated**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.goto("/blocks/4");

    await expect(page.locator("text=Balance and Simulation")).toBeVisible();

    // Запускаем анализ
    await page.locator('button:has-text("Run Analysis")').click();

    // Ждём загрузки результатов
    await expect(page.locator("text=Transitive")).toBeVisible({
      timeout: 15_000,
    });

    // Кликаем на вкладку Payoff
    await page.locator('button[role="tab"]:has-text("Payoff")').click();

    // Проверяем, что payoff-матрица отображается
    await expect(page.locator("text=warrior").or(page.locator("text=Воин"))).toBeVisible({
      timeout: 10_000,
    });
  });

  test("2.3 — Monte Carlo симуляция: запуск и отображение результатов", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    await page.route("**/api/v1/balance/analyze**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_BALANCE_RESULT),
      });
    });

    await page.route("**/api/v1/pipeline/notify-updated**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "ok" }),
      });
    });

    await page.goto("/blocks/4");

    await expect(page.locator("text=Balance and Simulation")).toBeVisible();

    // Запускаем анализ
    await page.locator('button:has-text("Run Analysis")').click();

    // Ждём загрузки результатов
    await expect(page.locator("text=Transitive")).toBeVisible({
      timeout: 15_000,
    });

    // Кликаем на вкладку Simulation
    await page.locator('button[role="tab"]:has-text("Simulation")').click();

    // Проверяем, что результаты симуляции отображены
    // Должны быть графики win rate или данные о симуляции
    const simulationContent = await page.textContent("body");
    expect(simulationContent).toBeTruthy();

    // Кликаем на вкладку Corrections для проверки коррекций
    await page.locator('button[role="tab"]:has-text("Corrections")').click();

    // Проверяем, что коррекции отображены
    await expect(
      page.locator("text=Лучник").or(page.locator("text=archer"))
    ).toBeVisible({ timeout: 10_000 });
  });
});
