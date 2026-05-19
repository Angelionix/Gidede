/**
 * Gidede — E2E: Сценарий 3 «AI-ассистент»
 *
 * 3 теста:
 *   1. Отправка сообщения AI-ассистенту и получение ответа
 *   2. Контекстные подсказки появляются на основе текущего блока
 *   3. Проактивные уведомления для экономических патологий
 *
 * API-запросы мокаются через page.route().
 */
import { test, expect } from "@playwright/test";

// ============================================================
// Mock Data
// ============================================================

const MOCK_USER = {
  id: "usr_ai_001",
  email: "ai-e2e@gidede.io",
  name: "AI Tester",
  plan: "free",
  ai_calls_count: 0,
  ai_calls_limit: 50,
  is_active: true,
  created_at: new Date().toISOString(),
  last_login_at: null,
};

const MOCK_SUGGESTIONS = {
  block_id: 1,
  suggestions: [
    {
      title: "Добавить социальную механику",
      description: "Ваш концепт не содержит социальных механик. Рассмотрите кооперативный режим.",
      action: "generate",
      priority: "medium",
    },
    {
      title: "Проверить совместимость механик",
      description: "Некоторые боевые механики могут конфликтовать с прогрессией.",
      action: "validate",
      priority: "high",
    },
    {
      title: "Определить целевую эстетику",
      description: "Рекомендуется явно указать 3 целевых эстетики для MDA-анализа.",
      action: "review",
      priority: "low",
    },
  ],
};

const MOCK_ALERTS = {
  alerts: [
    {
      id: "alert_001",
      alert_type: "economy_pathology",
      severity: "critical",
      block_id: 5,
      title: "Runaway инфляция",
      description: "Экономическая модель показывает экспоненциальный рост ресурсов. Faucet/Drain ratio > 3:1.",
      suggestion: "Увеличьте drain-каналы или уменьшите faucet-источники на Блоке 5.",
      timestamp: Date.now(),
    },
    {
      id: "alert_002",
      alert_type: "balance_issue",
      severity: "warning",
      block_id: 4,
      title: "Доминантная стратегия",
      description: "Воин побеждает в 65% боёв — возможна доминантная стратегия.",
      suggestion: "Скорректируйте баланс на Блоке 4 через Intransitive-анализ.",
      timestamp: Date.now(),
    },
  ],
  total: 2,
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
    localStorage.setItem("gidede_access_token", "mock_ai_token");
    localStorage.setItem("gidede_refresh_token", "mock_ai_refresh");
    localStorage.setItem("gidede_active_project", "proj_001");
  });
}

// ============================================================
// Tests
// ============================================================

test.describe("Сценарий 3: AI-ассистент", () => {
  test("3.1 — Отправка сообщения AI-ассистенту и получение ответа", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    // Мокаем chat API (не-streaming fallback)
    await page.route("**/api/v1/assistant/chat**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reply:
            "Для RPG с живой экосистемой рекомендую использовать механики:\n" +
            "1. Dynamic Faction System — фракции меняют отношения\n" +
            "2. Ecosystem Simulation — хищники/жертвы влияют на ресурсы\n" +
            "3. Emergent Quests — задания генерируются из состояния мира",
          model_used: "gpt-4o",
          provider: "openai",
          latency_ms: 2300,
        }),
      });
    });

    // Мокаем SSE streaming endpoint — возвращаем обычный ответ
    await page.route("**/api/v1/assistant/chat/stream**", async (route) => {
      // Возвращаем SSE-подобный ответ
      const sseBody =
        `data: ${JSON.stringify({ type: "message", content: "Для RPG с живой экосистемой рекомендую использовать механики:\n1. Dynamic Faction System\n2. Ecosystem Simulation\n3. Emergent Quests" })}\n\n` +
        `data: ${JSON.stringify({ type: "done", model_used: "gpt-4o", provider: "openai", latency_ms: 2300 })}\n\n` +
        "data: [DONE]\n\n";

      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody,
      });
    });

    // Мокаем history API
    await page.route("**/api/v1/assistant/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], total: 0 }),
      });
    });

    await page.goto("/blocks/7");

    // Проверяем, что страница AI-ассистента загружена
    await expect(page.locator("text=AI-ассистент")).toBeVisible();

    // Вводим сообщение
    await page.locator('input[placeholder*="вопрос"]').fill(
      "Какие механики подходят для RPG с живой экосистемой?"
    );

    // Отправляем
    await page.locator('button[aria-label="Отправить сообщение"]').click();

    // Ждём ответ от AI
    await expect(
      page.locator("text=Dynamic Faction System").or(page.locator("text=Ecosystem Simulation"))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("3.2 — Контекстные подсказки появляются на основе текущего блока", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    // Мокаем suggestions API
    await page.route("**/api/v1/assistant/suggestions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUGGESTIONS),
      });
    });

    // Мокаем alerts API
    await page.route("**/api/v1/assistant/alerts**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ alerts: [], total: 0 }),
      });
    });

    // Мокаем history API
    await page.route("**/api/v1/assistant/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], total: 0 }),
      });
    });

    await page.goto("/blocks/7");

    // Проверяем, что страница AI-ассистента загружена
    await expect(page.locator("text=AI-ассистент")).toBeVisible();

    // Переключаемся на вкладку «Подсказки»
    await page.locator('button[role="tab"]:has-text("Подсказки")').click();

    // Нажимаем «Загрузить»
    await page.locator('button:has-text("Загрузить")').click();

    // Проверяем, что подсказки отображены
    await expect(
      page.locator("text=Добавить социальную механику")
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator("text=Проверить совместимость механик")
    ).toBeVisible();

    // Проверяем приоритет
    await expect(page.locator("text=high")).toBeVisible();
  });

  test("3.3 — Проактивные уведомления для экономических патологий", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    // Мокаем alerts API с патологиями
    await page.route("**/api/v1/assistant/alerts**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ALERTS),
      });
    });

    // Мокаем suggestions API
    await page.route("**/api/v1/assistant/suggestions**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ block_id: 5, suggestions: [] }),
      });
    });

    // Мокаем history API
    await page.route("**/api/v1/assistant/history**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ messages: [], total: 0 }),
      });
    });

    await page.goto("/blocks/7");

    // Проверяем, что страница AI-ассистента загружена
    await expect(page.locator("text=AI-ассистент")).toBeVisible();

    // Переключаемся на вкладку «Уведомления»
    await page.locator('button[role="tab"]:has-text("Уведомления")').click();

    // Нажимаем «Проверить»
    await page.locator('button:has-text("Проверить")').click();

    // Проверяем, что уведомления о патологиях отображены
    await expect(
      page.locator("text=Runaway инфляция")
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.locator("text=Доминантная стратегия")
    ).toBeVisible();

    // Проверяем наличие badge критичности
    await expect(page.locator("text=critical").first()).toBeVisible();

    // Проверяем, что привязка к блоку отображена
    await expect(page.locator("text=Блок 5").first()).toBeVisible();
  });
});
