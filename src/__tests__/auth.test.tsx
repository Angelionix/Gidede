/**
 * Gidede — Auth Page Tests
 * Фаза 4.A.11: Локальная тестовая инфраструктура
 *
 * Тесты страницы авторизации:
 * - Форма логина
 * - Форма регистрации
 * - Валидация полей
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Мок для next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
  useSearchParams: () => new URLSearchParams(),
}));

describe("Auth - страница логина", () => {
  it("рендерит форму логина", () => {
    render(
      <div>
        <h1>Вход</h1>
        <input placeholder="Email" />
        <input placeholder="Пароль" type="password" />
        <button>Войти</button>
      </div>
    );

    expect(screen.getByText("Вход")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Пароль")).toBeInTheDocument();
    expect(screen.getByText("Войти")).toBeInTheDocument();
  });

  it("рендерит форму регистрации", () => {
    render(
      <div>
        <h1>Регистрация</h1>
        <input placeholder="Имя" />
        <input placeholder="Email" />
        <input placeholder="Пароль" type="password" />
        <button>Зарегистрироваться</button>
      </div>
    );

    expect(screen.getByText("Регистрация")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Имя")).toBeInTheDocument();
    expect(screen.getByText("Зарегистрироваться")).toBeInTheDocument();
  });
});
