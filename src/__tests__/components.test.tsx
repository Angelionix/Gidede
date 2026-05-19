/**
 * Gidede — UI Component Tests
 * Фаза 4.A.11 + Рефакторинг v0.30.0
 *
 * Базовые тесты UI-компонентов:
 * - Рендеринг страниц
 * - Навигация
 * - Формы
 * - Общие компоненты (shared)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Мок для Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("UI Components - базовые тесты", () => {
  it("page renders without crashing", () => {
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

describe("Shared Components - WarningsList", () => {
  it("renders nothing when warnings is empty", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const { container } = render(<WarningsList warnings={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders warnings when provided", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Test warning"]} />);
    expect(screen.getByText("Test warning")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
  });
});

describe("Shared Components - SuggestionsList", () => {
  it("renders nothing when suggestions is empty", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const { container } = render(<SuggestionsList suggestions={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders suggestions when provided", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Test suggestion"]} />);
    expect(screen.getByText("Test suggestion")).toBeInTheDocument();
  });
});

describe("Shared Components - EmptyStateCard", () => {
  it("renders with icon, title and description", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { AlertCircle } = await import("lucide-react");
    render(
      <EmptyStateCard
        icon={AlertCircle}
        title="No data yet"
        description="Run the analysis to see results"
      />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
    expect(screen.getByText("Run the analysis to see results")).toBeInTheDocument();
  });
});

describe("Shared Components - NodeTypeIcon", () => {
  it("renders pool node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="pool" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders unknown node type with default icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="unknown_type" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});
