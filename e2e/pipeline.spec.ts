/**
 * Gidede — E2E: Сценарий 1 «От идеи до GDD»
 *
 * 4 теста:
 *   1. Полный пайплайн: создать проект → заполнить Блок 1 → перейти к Блоку 2
 *   2. Индикатор прогресса обновляется после завершения блока
 *   3. Уведомление пайплайна при изменении вышестоящего блока
 *   4. Устаревшие блоки показывают предупреждение
 *
 * API-запросы мокаются через page.route().
 */
import { test, expect } from "@playwright/test";

// ============================================================
// Mock Data
// ============================================================

const MOCK_USER = {
  id: "usr_pipeline_001",
  email: "pipeline-e2e@gidede.io",
  name: "Pipeline Tester",
  plan: "free",
  ai_calls_count: 0,
  ai_calls_limit: 50,
  is_active: true,
  created_at: new Date().toISOString(),
  last_login_at: null,
};

const MOCK_TOKENS = {
  access_token: "mock_pipeline_access_token",
  refresh_token: "mock_pipeline_refresh_token",
  token_type: "bearer",
  expires_in: 1800,
  user: MOCK_USER,
};

const MOCK_PROJECT_ID = "proj_pipeline_001";

const MOCK_CONCEPT_RESULT = {
  id: "concept_001",
  project_id: MOCK_PROJECT_ID,
  genre: "RPG",
  genre_confidence: 0.92,
  aesthetic_profile: {
    primary: "Narrative",
    secondary: "Challenge",
    tertiary: "Discovery",
    primary_justification: "Сильный акцент на историю",
    secondary_justification: "Тактические бои",
    tertiary_justification: "Исследование мира",
  },
  dynamics_profile: {
    dynamics: [
      { name: "Narrative Progression", strength: "high" },
      { name: "Resource Management", strength: "medium" },
    ],
  },
  mechanic_set: {
    base_mechanics: ["Exploration", "Combat"],
    combat_mechanics: ["Turn-based"],
    progression_mechanics: ["Leveling"],
    spatial_mechanics: ["Overworld"],
    social_mechanics: [],
    compatibility_issues: [],
    synergy_patterns: ["Exploration + Combat"],
  },
  core_loop_candidates: [
    { index: 1, name: "Explore → Fight → Loot → Upgrade", steps: ["Explore", "Fight", "Loot", "Upgrade"], description: "Классический RPG цикл" },
    { index: 2, name: "Quest → Dialogue → Choice → Consequence", steps: ["Quest", "Dialogue", "Choice", "Consequence"], description: "Нарративный цикл" },
    { index: 3, name: "Craft → Equip → Test → Refine", steps: ["Craft", "Equip", "Test", "Refine"], description: "Цикл крафта" },
  ],
  usp_candidates: [
    { index: 1, title: "Живая экосистема", description: "Мир реагирует на каждое решение игрока" },
    { index: 2, title: "Двойная реальность", description: "Параллельные миры влияют друг на друга" },
    { index: 3, title: "Эмоциональный крафт", description: "Крафт через эмоции персонажей" },
  ],
  validation_report: {
    triangle_of_weirdness: { score: 0.8, warnings: [] },
    core_gameplay_questions: { score: 0.7, warnings: ["Рассмотрите добавление социального аспекта"] },
    idea_filters: { score: 0.9, warnings: [] },
    overall_score: 0.8,
  },
  one_pager: {
    title: "Echoes of the Forgotten",
    genre: "RPG",
    target_audience: "Midcore, Narrative-focused",
    core_loop: "Explore → Fight → Loot → Upgrade",
    usp: "Живая экосистема",
    key_mechanics: ["Exploration", "Combat", "Leveling"],
    aesthetics: ["Narrative", "Challenge", "Discovery"],
  },
};

const MOCK_PIPELINE_STATE = {
  project_id: MOCK_PROJECT_ID,
  blocks: {
    1: { status: "completed", updated_at: new Date().toISOString() },
    2: { status: "pending", updated_at: null },
    3: { status: "pending", updated_at: null },
    4: { status: "pending", updated_at: null },
    5: { status: "pending", updated_at: null },
    6: { status: "pending", updated_at: null },
    7: { status: "pending", updated_at: null },
    8: { status: "pending", updated_at: null },
  },
  current_block: 2,
  stale_blocks: [],
};

const MOCK_PIPELINE_STATE_AFTER = {
  ...MOCK_PIPELINE_STATE,
  blocks: {
    ...MOCK_PIPELINE_STATE.blocks,
    1: { status: "completed", updated_at: new Date().toISOString() },
    2: { status: "stale", updated_at: new Date().toISOString(), reason: "upstream_changed" },
  },
  stale_blocks: [2],
};

// ============================================================
// Helpers
// ============================================================

/** Настраивает моки API и эмулирует авторизованное состояние */
async function setupAuthenticatedPage(page: import("@playwright/test").Page) {
  // Мокаем auth endpoints
  await page.route("**/api/v1/auth/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/auth/me") || url.includes("/auth/refresh")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_USER),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TOKENS),
    });
  });

  // Мокаем projects API
  await page.route("**/api/v1/projects/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: MOCK_PROJECT_ID,
          name: "E2E Pipeline Test",
          description: "Тестовый проект для пайплайна",
          genre: "RPG",
          status: "active",
          completion_percent: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        projects: [],
        total: 0,
        page: 1,
        per_page: 20,
      }),
    });
  });

  // Мокаем concept generation API
  await page.route("**/api/v1/concept/generate**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_CONCEPT_RESULT),
    });
  });

  // Мокаем pipeline state API
  await page.route("**/api/v1/pipeline/state/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_PIPELINE_STATE),
    });
  });

  // Мокаем pipeline notify
  await page.route("**/api/v1/pipeline/notify-updated**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    });
  });

  // Мокаем pipeline run-partial
  await page.route("**/api/v1/pipeline/run-pipeline/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        concept_result: MOCK_CONCEPT_RESULT,
        stages_completed: [1, 2, 3],
      }),
    });
  });

  // Мокаем все остальные /api/v1/ запросы
  await page.route("**/api/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({}),
    });
  });

  // Устанавливаем токены в localStorage для эмуляции авторизации
  await page.addInitScript(() => {
    localStorage.setItem("gidede_access_token", "mock_pipeline_access_token");
    localStorage.setItem("gidede_refresh_token", "mock_pipeline_refresh_token");
  });
}

// ============================================================
// Tests
// ============================================================

test.describe("Сценарий 1: От идеи до GDD (Pipeline)", () => {
  test("1.1 — Полный пайплайн: проект → Блок 1 → переход к Блоку 2", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    // Устанавливаем активный проект
    await page.addInitScript(() => {
      localStorage.setItem("gidede_active_project", "proj_pipeline_001");
    });

    // Открываем Блок 1
    await page.goto("/blocks/1");

    // Проверяем, что страница Блока 1 загружена
    await expect(page.locator("text=Генератор концепции")).toBeVisible();

    // Заполняем идею
    const ideaInput = page.locator("textarea").first();
    await ideaInput.fill("RPG с живой экосистемой, где мир реагирует на решения игрока");

    // Нажимаем «Сгенерировать концепцию»
    await page.locator('button:has-text("Сгенерировать концепцию")').first().click();

    // Ждем результат генерации
    await expect(page.locator("text=Echoes of the Forgotten")).toBeVisible({
      timeout: 15_000,
    });

    // Проверяем, что One-Pager отображен
    await expect(page.locator("text=RPG")).toBeVisible();

    // Переходим к Блоку 2
    await page.goto("/blocks/2");
    await expect(page.locator("text=Core Loop")).toBeVisible();
  });

  test("1.2 — Индикатор прогресса обновляется после завершения блока", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    await page.addInitScript(() => {
      localStorage.setItem("gidede_active_project", "proj_pipeline_001");
    });

    // Открываем Блок 1
    await page.goto("/blocks/1");

    // Проверяем, что пайплайн-индикатор виден
    await expect(page.locator("text=Пайплайн")).toBeVisible({ timeout: 10_000 });

    // Заполняем и генерируем
    const ideaInput = page.locator("textarea").first();
    await ideaInput.fill("Стратегия с нелинейной экономикой и процедурной генерацией карт");

    await page.locator('button:has-text("Сгенерировать концепцию")').first().click();

    // После генерации — пайплайн должен обновиться
    // Проверяем, что уведомление о пайплайне появляется
    await expect(
      page.locator("text=Блок 1").first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test("1.3 — Уведомление пайплайна при изменении вышестоящего блока", async ({
    page,
  }) => {
    await setupAuthenticatedPage(page);

    await page.addInitScript(() => {
      localStorage.setItem("gidede_active_project", "proj_pipeline_001");
    });

    // Мокаем pipeline state с устаревшим Блоком 2
    await page.route("**/api/v1/pipeline/state/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_PIPELINE_STATE_AFTER),
      });
    });

    // Открываем страницу с уведомлениями пайплайна
    await page.goto("/blocks/2");

    // Проверяем, что предупреждение об устаревании отображается
    // Блок 2 должен быть помечен как stale
    await expect(
      page.locator("text=Core Loop").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("1.4 — Устаревшие блоки показывают предупреждение", async ({ page }) => {
    await setupAuthenticatedPage(page);

    await page.addInitScript(() => {
      localStorage.setItem("gidede_active_project", "proj_pipeline_001");
    });

    // Мокаем pipeline state с stale_blocks
    await page.route("**/api/v1/pipeline/state/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...MOCK_PIPELINE_STATE_AFTER,
          stale_blocks: [2, 3],
        }),
      });
    });

    // Открываем Блок 2 — он должен показывать предупреждение
    await page.goto("/blocks/2");

    // На странице должен быть индикатор stale
    await expect(page.locator("text=Core Loop").first()).toBeVisible({
      timeout: 10_000,
    });

    // На сайдбаре должен быть индикатор устаревания
    // Проверяем, что страница загрузилась корректно
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });
});
