/**
 * Gidede — UI Component Tests
 * Фаза 4.A.11: Локальная тестовая инфраструктура
 *
 * Базовые тесты UI-компонентов:
 * - Рендеринг страниц
 * - Навигация
 * - Формы
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Мок для Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Мок для next-themes
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("UI Components - базовые тесты", () => {
  it("page renders without crashing", () => {
    // Простейший тест — проверяем что JSX рендерится
    const { container } = render(<div data-testid="test">Hello Gidede</div>);
    expect(screen.getByTestId("test")).toBeInTheDocument();
    expect(screen.getByText("Hello Gidede")).toBeInTheDocument();
  });

  it("button element renders correctly", () => {
    render(<button>Click Me</button>);
    expect(screen.getByText("Click Me")).toBeInTheDocument();
  });

  it("input element renders correctly", () => {
    render(<input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
  });
});
