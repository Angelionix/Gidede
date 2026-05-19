/**
 * Gidede — UI Component Tests
 * Фаза 4.A.11 + Рефакторинг v0.30.0 + Актуализация v0.46.0
 *
 * Базовые тесты UI-компонентов:
 * - Рендеринг базовых элементов
 * - Общие компоненты (shared)
 * - Обработка ошибок API (4.E.4)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Мок для Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Мок для lucide-react иконок — возвращаем простые SVG
vi.mock("lucide-react", () => {
  const createIcon = (name: string) => {
    const Icon = ({ className }: { className?: string }) => (
      <svg data-testid={`icon-${name}`} className={className}>
        <title>{name}</title>
      </svg>
    );
    Icon.displayName = name;
    return Icon;
  };
  return {
    AlertCircle: createIcon("AlertCircle"),
    AlertTriangle: createIcon("AlertTriangle"),
    Info: createIcon("Info"),
    Lightbulb: createIcon("Lightbulb"),
    CircleDot: createIcon("CircleDot"),
    TrendingUp: createIcon("TrendingUp"),
    TrendingDown: createIcon("TrendingDown"),
    RotateCcw: createIcon("RotateCcw"),
    Shield: createIcon("Shield"),
    Zap: createIcon("Zap"),
    Target: createIcon("Target"),
  };
});

// Мок для @/components/ui/card
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardHeader: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <h3 data-testid="card-title" className={className}>{children}</h3>
  ),
  CardContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="card-content" className={className}>{children}</div>
  ),
}));

describe("UI Components — базовые тесты", () => {
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

describe("Shared Components — WarningsList", () => {
  it("renders nothing when warnings is empty", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const { container } = render(<WarningsList warnings={[]} />);
    // WarningsList returns null for empty array
    expect(container.innerHTML).toBe("");
  });

  it("renders warnings when provided", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Test warning"]} />);
    expect(screen.getByText("Test warning")).toBeInTheDocument();
    expect(screen.getByText("Warnings")).toBeInTheDocument();
  });

  it("renders multiple warnings", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Warning 1", "Warning 2", "Warning 3"]} />);
    expect(screen.getByText("Warning 1")).toBeInTheDocument();
    expect(screen.getByText("Warning 2")).toBeInTheDocument();
    expect(screen.getByText("Warning 3")).toBeInTheDocument();
  });

  it("respects maxRows limit", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const manyWarnings = Array.from({ length: 20 }, (_, i) => `Warning ${i + 1}`);
    render(<WarningsList warnings={manyWarnings} maxRows={3} />);
    expect(screen.getByText("Warning 1")).toBeInTheDocument();
    expect(screen.getByText("Warning 2")).toBeInTheDocument();
    expect(screen.getByText("Warning 3")).toBeInTheDocument();
    // Warning 4 should NOT be rendered (maxRows=3)
    expect(screen.queryByText("Warning 4")).not.toBeInTheDocument();
  });
});

describe("Shared Components — SuggestionsList", () => {
  it("renders nothing when suggestions is empty", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const { container } = render(<SuggestionsList suggestions={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders suggestions in card variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Test suggestion"]} />);
    expect(screen.getByText("Test suggestion")).toBeInTheDocument();
  });

  it("renders suggestions in inline variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Inline suggestion"]} variant="inline" />);
    expect(screen.getByText("Inline suggestion")).toBeInTheDocument();
  });
});

describe("Shared Components — EmptyStateCard", () => {
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

  it("renders without description", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { AlertCircle } = await import("lucide-react");
    render(<EmptyStateCard icon={AlertCircle} title="Empty" />);
    expect(screen.getByText("Empty")).toBeInTheDocument();
  });
});

describe("Shared Components — NodeTypeIcon", () => {
  it("renders pool node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="pool" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders source node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="source" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders drain node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="drain" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders converter node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="converter" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders gate node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="gate" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders unknown node type with default icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="unknown_type" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });
});

describe("API Error Handling (4.E.4)", () => {
  it("classifyError identifies timeout errors", async () => {
    const { classifyError } = await import("@/lib/api-client");
    const { ApiTimeoutError } = await import("@/lib/api-client");
    expect(classifyError(new ApiTimeoutError(30000))).toBe("timeout");
  });

  it("classifyError identifies network errors", async () => {
    const { classifyError } = await import("@/lib/api-client");
    const { ApiNetworkError } = await import("@/lib/api-client");
    expect(classifyError(new ApiNetworkError())).toBe("network");
  });

  it("classifyError identifies auth errors", async () => {
    const { classifyError, ApiClientError } = await import("@/lib/api-client");
    expect(classifyError(new ApiClientError("Unauthorized", 401))).toBe("auth");
  });

  it("classifyError identifies validation errors", async () => {
    const { classifyError, ApiClientError } = await import("@/lib/api-client");
    expect(classifyError(new ApiClientError("Invalid input", 422))).toBe("validation");
  });

  it("classifyError identifies server errors", async () => {
    const { classifyError, ApiClientError } = await import("@/lib/api-client");
    expect(classifyError(new ApiClientError("Server error", 500))).toBe("server");
  });

  it("getErrorMessage returns human-readable messages", async () => {
    const { getErrorMessage, ApiTimeoutError, ApiNetworkError } = await import("@/lib/api-client");
    expect(getErrorMessage(new ApiTimeoutError(30000))).toContain("время");
    expect(getErrorMessage(new ApiNetworkError())).toContain("интернет");
  });
});
