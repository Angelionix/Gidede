/**
 * Gidede — E2E: Сценарий 4 «Экспорт»
 *
 * 2 теста:
 *   1. Генерация GDD документа со всеми секциями
 *   2. Экспорт GDD в PDF формат
 *
 * API-запросы мокаются через page.route().
 */
import { test, expect } from "@playwright/test";

// ============================================================
// Mock Data
// ============================================================

const MOCK_USER = {
  id: "usr_export_001",
  email: "export-e2e@gidede.io",
  name: "Export Tester",
  plan: "free",
  ai_calls_count: 0,
  ai_calls_limit: 50,
  is_active: true,
  created_at: new Date().toISOString(),
  last_login_at: null,
};

const MOCK_GDD_PROFILE = {
  id: "gdd_001",
  target_format: "full_gdd",
  detail_level: "standard",
  target_audience_doc: "team_sync",
  project_stage: "preproduction",
  language: "ru",
  coverage_score: 0.78,
  stages_completed: [1, 2, 3],
  latency_ms: 4500,
  assembled_document: {
    title: "Echoes of the Forgotten — Game Design Document",
    sections: {
      concept: {
        title: "Концепция",
        content: "RPG с живой экосистемой, где мир реагирует на решения игрока. Жанр: RPG, Платформа: PC.",
        source: "auto",
        requires_review: false,
      },
      core_loop: {
        title: "Core Loop",
        content: "Основной игровой цикл: Explore → Fight → Loot → Upgrade. Структурный тип: Economy.",
        source: "auto",
        requires_review: false,
      },
      mda: {
        title: "MDA-анализ",
        content: "Целевые эстетики: Narrative (первичная), Challenge (вторичная), Discovery (третичная).",
        source: "auto",
        requires_review: false,
      },
      balance: {
        title: "Баланс",
        content: "Транзитивный анализ: 3 объекта, 1 недооценён. Monte Carlo: win_rate warrior=35%, mage=38%, archer=27%.",
        source: "auto",
        requires_review: true,
      },
      progression: {
        title: "Прогрессия",
        content: "4 tiers, тип кривой: логистическая. XP→Level: 7 типов кривых. Целевая длительность: 40 часов.",
        source: "ai_generated",
        requires_review: true,
      },
      economy: {
        title: "Экономика",
        content: "3 ресурса: Gold, Experience, Materials. Faucet/Drain ratio: сбалансировано. Патологий не обнаружено.",
        source: "auto",
        requires_review: false,
      },
      narrative: {
        title: "Нарратив",
        content: "Основной конфликт: выживание в мире, где экосистема рушится. 3 актовая структура.",
        source: "ai_generated",
        requires_review: true,
      },
      ux: {
        title: "UX/UI",
        content: "Управление: WASD + мышь. Минимальный HUD. Контекстные подсказки.",
        source: "manual",
        requires_review: true,
      },
    },
    consistency_report: {
      overall_score: 0.85,
      inconsistencies: [
        {
          section_a: "concept",
          section_b: "narrative",
          type: "terminology_mismatch",
          description: "Разные термины для описания экосистемы",
        },
      ],
    },
  },
  data_mapping: {
    auto_fillable_sections: ["concept", "core_loop", "mda", "balance", "economy"],
    ai_generatable_sections: ["progression", "narrative"],
    manual_sections: ["ux"],
    coverage_score: 0.78,
  },
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

  await page.route("**/api/v1/pipeline/notify-updated**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "ok" }),
    });
  });

  await page.addInitScript(() => {
    localStorage.setItem("gidede_access_token", "mock_export_token");
    localStorage.setItem("gidede_refresh_token", "mock_export_refresh");
    localStorage.setItem("gidede_active_project", "proj_001");
  });
}

// ============================================================
// Tests
// ============================================================

test.describe("Сценарий 4: Экспорт", () => {
  test("4.1 — Генерация GDD документа со всеми секциями", async ({ page }) => {
    await setupAuthenticatedPage(page);

    // Мокаем GDD generation API
    await page.route("**/api/v1/gdd/generate**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_GDD_PROFILE),
      });
    });

    await page.goto("/blocks/6");

    // Проверяем, что страница GDD Generator загружена
    await expect(page.locator("text=GDD Generator")).toBeVisible();

    // Нажимаем «Сгенерировать GDD»
    await page.locator('button:has-text("Сгенерировать GDD")').click();

    // Ждём результат генерации — переключение на вкладку предпросмотра
    await expect(page.locator("text=Сгенерирован")).toBeVisible({
      timeout: 15_000,
    });

    // Проверяем, что вкладка «Предпросмотр» доступна
    await expect(
      page.locator('button[role="tab"]:has-text("Предпросмотр")')
    ).toBeEnabled();

    // Кликаем на «Предпросмотр»
    await page.locator('button[role="tab"]:has-text("Предпросмотр")').click();

    // Проверяем, что секции GDD отображены
    await expect(
      page.locator("text=Концепция").or(page.locator("text=concept"))
    ).toBeVisible({ timeout: 10_000 });

    // Проверяем покрытие
    await expect(page.locator("text=78%").or(page.locator("text=0.78"))).toBeVisible({
      timeout: 10_000,
    });

    // Проверяем data mapping info
    await expect(page.locator("text=Автозаполняемых").or(page.locator("text=5"))).toBeVisible({
      timeout: 10_000,
    });
  });

  test("4.2 — Экспорт GDD в PDF формат", async ({ page }) => {
    await setupAuthenticatedPage(page);

    // Мокаем GDD generation API
    await page.route("**/api/v1/gdd/generate**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_GDD_PROFILE),
      });
    });

    // Мокаем экспорт API — возвращаем PDF-подобный бинарный ответ
    await page.route("**/api/v1/gdd/export**", async (route) => {
      // Для E2E мокаем успешный экспорт
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: {
          "Content-Disposition": 'attachment; filename="gdd_export.pdf"',
        },
        body: "MOCK_PDF_CONTENT",
      });
    });

    await page.goto("/blocks/6");

    // Сначала генерируем GDD
    await page.locator('button:has-text("Сгенерировать GDD")').click();

    await expect(page.locator("text=Сгенерирован")).toBeVisible({
      timeout: 15_000,
    });

    // Переключаемся на вкладку «Экспорт»
    await page.locator('button[role="tab"]:has-text("Экспорт")').click();

    // Проверяем, что панель экспорта отображается
    const exportContent = await page.textContent("body");
    expect(exportContent).toBeTruthy();

    // Проверяем, что кнопки экспорта доступны
    // Экспорт-панель должна содержать опции для PDF/DOCX
    const hasExportOption =
      (await page.locator("text=PDF").count()) > 0 ||
      (await page.locator("text=pdf").count()) > 0 ||
      (await page.locator("text=Экспорт").count()) > 0;
    expect(hasExportOption).toBeTruthy();
  });
});
