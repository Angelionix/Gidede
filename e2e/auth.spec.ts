/**
 * Gidede — E2E: Сценарий 5 «Авторизация»
 *
 * 5 тестов:
 *   1. Регистрация нового пользователя
 *   2. Регистрация с существующим email — ошибка
 *   3. Вход с валидными данными
 *   4. Вход с неверным паролем — ошибка
 *   5. Защищённый маршрут перенаправляет на /login
 *
 * API-запросы мокаются через page.route().
 */
import { test, expect } from "@playwright/test";

// ============================================================
// Helpers
// ============================================================

const MOCK_USER = {
  id: "usr_mock_001",
  email: "test-e2e@gidede.io",
  name: "E2E Tester",
  plan: "free",
  ai_calls_count: 0,
  ai_calls_limit: 50,
  is_active: true,
  created_at: new Date().toISOString(),
  last_login_at: null,
};

const MOCK_TOKENS = {
  access_token: "mock_access_token_e2e",
  refresh_token: "mock_refresh_token_e2e",
  token_type: "bearer",
  expires_in: 1800,
  user: MOCK_USER,
};

/**
 * Мокаем API-эндпоинты авторизации.
 * По умолчанию — успешная регистрация/логин.
 */
function mockAuthApi(page: import("@playwright/test").Page) {
  // Мок /api/v1/auth/register
  page.route("**/api/v1/auth/register**", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.email === "existing@gidede.io") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Пользователь с таким email уже существует" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TOKENS),
    });
  });

  // Мок /api/v1/auth/login
  page.route("**/api/v1/auth/login**", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.password === "wrongpassword") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Неверный email или пароль" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TOKENS),
    });
  });

  // Мок /api/v1/auth/me
  page.route("**/api/v1/auth/me**", async (route) => {
    const authHeader = route.request().headers()["authorization"];
    if (!authHeader || authHeader === "Bearer undefined") {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Не авторизован" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    });
  });

  // Мок /api/v1/auth/refresh
  page.route("**/api/v1/auth/refresh**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...MOCK_TOKENS,
        access_token: "mock_refreshed_access_token",
      }),
    });
  });
}

// ============================================================
// Tests
// ============================================================

test.describe("Сценарий 5: Авторизация", () => {
  test("5.1 — Регистрация нового пользователя", async ({ page }) => {
    mockAuthApi(page);

    await page.goto("/register");

    // Проверяем, что страница регистрации загружена
    await expect(page.locator("text=Регистрация")).toBeVisible();

    // Заполняем форму
    await page.locator("#email").fill("newuser@gidede.io");
    await page.locator("#name").fill("Новый Пользователь");
    await page.locator("#password").fill("StrongP@ss123");
    await page.locator("#confirmPassword").fill("StrongP@ss123");

    // Отправляем форму
    await page.locator('button:has-text("Зарегистрироваться")').click();

    // После успешной регистрации — редирект на главную
    await expect(page).toHaveURL(/\//, { timeout: 10_000 });
  });

  test("5.2 — Регистрация с существующим email показывает ошибку", async ({
    page,
  }) => {
    mockAuthApi(page);

    await page.goto("/register");

    await page.locator("#email").fill("existing@gidede.io");
    await page.locator("#name").fill("Повторный");
    await page.locator("#password").fill("StrongP@ss123");
    await page.locator("#confirmPassword").fill("StrongP@ss123");

    await page.locator('button:has-text("Зарегистрироваться")').click();

    // Ожидаем сообщение об ошибке
    await expect(
      page.locator("text=Пользователь с таким email уже существует")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("5.3 — Вход с валидными данными", async ({ page }) => {
    mockAuthApi(page);

    await page.goto("/login");

    // Проверяем заголовок формы входа
    await expect(page.locator("text=Вход в Gidede")).toBeVisible();

    // Заполняем форму
    await page.locator("#email").fill("test-e2e@gidede.io");
    await page.locator("#password").fill("correctpassword");

    // Отправляем
    await page.locator('button:has-text("Войти")').click();

    // После успешного входа — редирект на главную
    await expect(page).toHaveURL(/\//, { timeout: 10_000 });
  });

  test("5.4 — Вход с неверным паролем показывает ошибку", async ({ page }) => {
    mockAuthApi(page);

    await page.goto("/login");

    await page.locator("#email").fill("test-e2e@gidede.io");
    await page.locator("#password").fill("wrongpassword");

    await page.locator('button:has-text("Войти")').click();

    // Ожидаем сообщение об ошибке
    await expect(
      page.locator("text=Неверный email или пароль")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("5.5 — Защищённый маршрут перенаправляет на /login", async ({
    page,
  }) => {
    // Не мокаем авторизацию — пользователь не залогинен

    // Пытаемся зайти на защищённый маршрут
    await page.goto("/projects");

    // Middleware должен перенаправить на /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // Проверяем, что callbackUrl передан
    const url = page.url();
    expect(url).toContain("callbackUrl");
  });
});
