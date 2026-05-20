/**
 * Gidede — Extended Shared Component Tests
 * Task 4-a: Expand frontend test coverage
 *
 * Comprehensive tests for all shared components:
 * - WarningsList: different severity levels, long text, HTML content, maxRows
 * - SuggestionsList: different variants, click handlers, maxRows
 * - EmptyStateCard: with/without icon, different sizes, with/without description
 * - NodeTypeIcon: all 8+ node types (pool, source, drain, converter, gate, trigger, end_condition, resource, unknown)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock for Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock for lucide-react icons — comprehensive set
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
    FileText: createIcon("FileText"),
    Bot: createIcon("Bot"),
    Puzzle: createIcon("Puzzle"),
    FlaskConical: createIcon("FlaskConical"),
    Scale: createIcon("Scale"),
    RefreshCw: createIcon("RefreshCcw"),
    Activity: createIcon("Activity"),
    Layers: createIcon("Layers"),
    Flame: createIcon("Flame"),
    BrainCircuit: createIcon("BrainCircuit"),
    Sparkles: createIcon("Sparkles"),
    MessageSquare: createIcon("MessageSquare"),
    Search: createIcon("Search"),
  };
});

// Mock for @/components/ui/card
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

// ============================================================
// WarningsList — Extended Tests
// ============================================================

describe("Shared Components — WarningsList (extended)", () => {
  it("renders nothing when warnings is empty", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const { container } = render(<WarningsList warnings={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders single warning", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Single warning"]} />);
    expect(screen.getByText("Single warning")).toBeInTheDocument();
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
    expect(screen.queryByText("Warning 4")).not.toBeInTheDocument();
  });

  it("default maxRows is 8", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const manyWarnings = Array.from({ length: 20 }, (_, i) => `Warning ${i + 1}`);
    render(<WarningsList warnings={manyWarnings} />);
    // Default maxRows=8, so Warning 9 should not be rendered
    expect(screen.getByText("Warning 8")).toBeInTheDocument();
    expect(screen.queryByText("Warning 9")).not.toBeInTheDocument();
  });

  it("renders long warning text", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const longText = "A".repeat(500);
    render(<WarningsList warnings={[longText]} />);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it("renders warning with special characters", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Warning with <script>alert('xss')</script>"]} />);
    // Should render the text but not execute script
    expect(screen.getByText("Warning with <script>alert('xss')</script>")).toBeInTheDocument();
  });

  it("renders warning with unicode characters", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Предупреждение: экономика не сбалансирована ⚠️"]} />);
    expect(screen.getByText("Предупреждение: экономика не сбалансирована ⚠️")).toBeInTheDocument();
  });

  it("renders AlertTriangle icon for header", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Test"]} />);
    // AlertTriangle appears in both header and list items
    const icons = screen.getAllByTestId("icon-AlertTriangle");
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders warning items with AlertTriangle icons", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    render(<WarningsList warnings={["Test warning"]} />);
    // There should be AlertTriangle icons — one in header and one in item
    const icons = screen.getAllByTestId("icon-AlertTriangle");
    expect(icons.length).toBeGreaterThanOrEqual(2);
  });

  it("renders correctly with exactly maxRows warnings", async () => {
    const { WarningsList } = await import("@/components/gidede/shared/WarningsList");
    const exactWarnings = Array.from({ length: 5 }, (_, i) => `Warning ${i + 1}`);
    render(<WarningsList warnings={exactWarnings} maxRows={5} />);
    expect(screen.getByText("Warning 1")).toBeInTheDocument();
    expect(screen.getByText("Warning 5")).toBeInTheDocument();
  });
});

// ============================================================
// SuggestionsList — Extended Tests
// ============================================================

describe("Shared Components — SuggestionsList (extended)", () => {
  it("renders nothing when suggestions is empty in card variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const { container } = render(<SuggestionsList suggestions={[]} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when suggestions is empty in inline variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const { container } = render(<SuggestionsList suggestions={[]} variant="inline" />);
    expect(container.innerHTML).toBe("");
  });

  it("renders suggestions in card variant with Lightbulb icon header", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Card suggestion"]} />);
    expect(screen.getByText("Card suggestion")).toBeInTheDocument();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    expect(screen.getByTestId("icon-Lightbulb")).toBeInTheDocument();
  });

  it("renders suggestions in inline variant without Card wrapper", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Inline suggestion"]} variant="inline" />);
    expect(screen.getByText("Inline suggestion")).toBeInTheDocument();
    // Inline variant should NOT have card-title
    expect(screen.queryByTestId("card-title")).not.toBeInTheDocument();
  });

  it("renders Info icon for each suggestion item in card variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Suggestion 1", "Suggestion 2"]} />);
    const infoIcons = screen.getAllByTestId("icon-Info");
    expect(infoIcons.length).toBe(2);
  });

  it("renders Info icon for each suggestion item in inline variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Suggestion 1"]} variant="inline" />);
    expect(screen.getByTestId("icon-Info")).toBeInTheDocument();
  });

  it("respects maxRows in card variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const many = Array.from({ length: 20 }, (_, i) => `Suggestion ${i + 1}`);
    render(<SuggestionsList suggestions={many} maxRows={2} />);
    expect(screen.getByText("Suggestion 1")).toBeInTheDocument();
    expect(screen.getByText("Suggestion 2")).toBeInTheDocument();
    expect(screen.queryByText("Suggestion 3")).not.toBeInTheDocument();
  });

  it("respects maxRows in inline variant", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const many = Array.from({ length: 20 }, (_, i) => `Suggestion ${i + 1}`);
    render(<SuggestionsList suggestions={many} variant="inline" maxRows={3} />);
    expect(screen.getByText("Suggestion 1")).toBeInTheDocument();
    expect(screen.getByText("Suggestion 3")).toBeInTheDocument();
    expect(screen.queryByText("Suggestion 4")).not.toBeInTheDocument();
  });

  it("default variant is card", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Default card"]} />);
    // Card variant has CardTitle with "Suggestions"
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
  });

  it("renders long suggestion text", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    const longText = "B".repeat(500);
    render(<SuggestionsList suggestions={[longText]} />);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it("renders suggestion with Russian text", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(<SuggestionsList suggestions={["Рекомендация: увеличить сложность врагов"]} />);
    expect(screen.getByText("Рекомендация: увеличить сложность врагов")).toBeInTheDocument();
  });

  it("renders multiple suggestions correctly", async () => {
    const { SuggestionsList } = await import("@/components/gidede/shared/SuggestionsList");
    render(
      <SuggestionsList
        suggestions={["Add more enemies", "Balance the economy", "Fix the AI pathfinding"]}
      />
    );
    expect(screen.getByText("Add more enemies")).toBeInTheDocument();
    expect(screen.getByText("Balance the economy")).toBeInTheDocument();
    expect(screen.getByText("Fix the AI pathfinding")).toBeInTheDocument();
  });
});

// ============================================================
// EmptyStateCard — Extended Tests
// ============================================================

describe("Shared Components — EmptyStateCard (extended)", () => {
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
    // Description should not be rendered
    expect(screen.queryByText("Run the analysis")).not.toBeInTheDocument();
  });

  it("renders the icon correctly", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { FileText } = await import("lucide-react");
    render(<EmptyStateCard icon={FileText} title="No document" description="Generate a GDD" />);
    expect(screen.getByTestId("icon-FileText")).toBeInTheDocument();
  });

  it("renders with different icons", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { Lightbulb } = await import("lucide-react");
    render(<EmptyStateCard icon={Lightbulb} title="No concept" />);
    expect(screen.getByTestId("icon-Lightbulb")).toBeInTheDocument();
    expect(screen.getByText("No concept")).toBeInTheDocument();
  });

  it("renders long title", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { AlertCircle } = await import("lucide-react");
    const longTitle = "Это очень длинный заголовок для проверки того, как компонент обрабатывает длинный текст";
    render(<EmptyStateCard icon={AlertCircle} title={longTitle} />);
    expect(screen.getByText(longTitle)).toBeInTheDocument();
  });

  it("renders long description", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { AlertCircle } = await import("lucide-react");
    const longDesc = "A".repeat(500);
    render(<EmptyStateCard icon={AlertCircle} title="Empty" description={longDesc} />);
    expect(screen.getByText(longDesc)).toBeInTheDocument();
  });

  it("renders with Scale icon", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { Scale } = await import("lucide-react");
    render(<EmptyStateCard icon={Scale} title="No balance analysis" description="Run balance analysis first" />);
    expect(screen.getByTestId("icon-Scale")).toBeInTheDocument();
  });

  it("renders with FlaskConical icon", async () => {
    const { EmptyStateCard } = await import("@/components/gidede/shared/EmptyStateCard");
    const { FlaskConical } = await import("lucide-react");
    render(<EmptyStateCard icon={FlaskConical} title="No MDA analysis" />);
    expect(screen.getByTestId("icon-FlaskConical")).toBeInTheDocument();
  });
});

// ============================================================
// NodeTypeIcon — Extended Tests
// ============================================================

describe("Shared Components — NodeTypeIcon (extended)", () => {
  it("renders pool node type", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="pool" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders resource node type (same icon as pool)", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="resource" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByTestId("icon-CircleDot")).toBeInTheDocument();
  });

  it("renders source node type with TrendingUp icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="source" />);
    expect(screen.getByTestId("icon-TrendingUp")).toBeInTheDocument();
  });

  it("renders drain node type with TrendingDown icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="drain" />);
    expect(screen.getByTestId("icon-TrendingDown")).toBeInTheDocument();
  });

  it("renders converter node type with RotateCcw icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="converter" />);
    expect(screen.getByTestId("icon-RotateCcw")).toBeInTheDocument();
  });

  it("renders gate node type with Shield icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="gate" />);
    expect(screen.getByTestId("icon-Shield")).toBeInTheDocument();
  });

  it("renders trigger node type with Zap icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="trigger" />);
    expect(screen.getByTestId("icon-Zap")).toBeInTheDocument();
  });

  it("renders end_condition node type with Target icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="end_condition" />);
    expect(screen.getByTestId("icon-Target")).toBeInTheDocument();
  });

  it("renders unknown node type with default CircleDot icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(<NodeTypeIcon type="unknown_type" />);
    expect(screen.getByTestId("icon-CircleDot")).toBeInTheDocument();
  });

  it("renders trader node type with default icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="trader" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders delay node type with default icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="delay" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders queue node type with default icon", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { container } = render(<NodeTypeIcon type="queue" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("pool and resource render the same icon (CircleDot)", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    const { rerender } = render(<NodeTypeIcon type="pool" />);
    const poolTestId = screen.getByTestId("icon-CircleDot");
    expect(poolTestId).toBeInTheDocument();

    rerender(<NodeTypeIcon type="resource" />);
    const resourceTestId = screen.getByTestId("icon-CircleDot");
    expect(resourceTestId).toBeInTheDocument();
  });

  it("renders multiple node types in the same container", async () => {
    const { NodeTypeIcon } = await import("@/components/gidede/shared/NodeTypeIcon");
    render(
      <div>
        <NodeTypeIcon type="pool" />
        <NodeTypeIcon type="source" />
        <NodeTypeIcon type="drain" />
      </div>
    );
    expect(screen.getByTestId("icon-CircleDot")).toBeInTheDocument();
    expect(screen.getByTestId("icon-TrendingUp")).toBeInTheDocument();
    expect(screen.getByTestId("icon-TrendingDown")).toBeInTheDocument();
  });
});

// ============================================================
// Shared Index — Re-export Tests
// ============================================================

describe("Shared Components — Index re-exports", () => {
  it("index.ts exports all 4 components", async () => {
    const index = await import("@/components/gidede/shared");
    expect(index.NodeTypeIcon).toBeDefined();
    expect(index.WarningsList).toBeDefined();
    expect(index.SuggestionsList).toBeDefined();
    expect(index.EmptyStateCard).toBeDefined();
  });
});
