/**
 * Gidede — Pipeline Hook Tests
 * Task 4-a: Expand frontend test coverage
 *
 * Tests for usePipeline hook:
 * - Block progress tracking
 * - Stale detection
 * - Notification generation
 * - Pipeline state serialization
 * - Fetch state, prepare input, notify, clearStale, runFullPipeline
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Mock the auth module
const mockApiFetch = vi.fn();
vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    apiFetch: mockApiFetch,
    user: { id: "user-1", email: "test@test.com" },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

import { usePipeline } from "@/hooks/use-pipeline";
import type { PipelineState, BlockProgress, PipelineNotification } from "@/hooks/use-pipeline";

// ============================================================
// Test data factories
// ============================================================

function createBlockProgress(overrides: Partial<BlockProgress> = {}): BlockProgress {
  return {
    block_id: 1,
    name: "Concept",
    status: "completed",
    is_filled: true,
    updated_at: "2024-01-01T00:00:00Z",
    stale_since: null,
    stale_reason: null,
    ...overrides,
  };
}

function createPipelineState(overrides: Partial<PipelineState> = {}): PipelineState {
  return {
    project_id: "proj-1",
    project_name: "Test Project",
    blocks: [
      createBlockProgress({ block_id: 1, name: "Concept", status: "completed", is_filled: true }),
      createBlockProgress({ block_id: 2, name: "Core Loop", status: "in_progress", is_filled: false }),
      createBlockProgress({ block_id: 3, name: "MDA", status: "empty", is_filled: false }),
      createBlockProgress({ block_id: 4, name: "Balance", status: "stale", is_filled: true, stale_since: "2024-01-02T00:00:00Z", stale_reason: "upstream_changed" }),
      createBlockProgress({ block_id: 5, name: "Economy", status: "empty", is_filled: false }),
      createBlockProgress({ block_id: 6, name: "GDD", status: "empty", is_filled: false }),
      createBlockProgress({ block_id: 7, name: "AI", status: "empty", is_filled: false }),
      createBlockProgress({ block_id: 8, name: "GBE", status: "empty", is_filled: false }),
    ],
    completion_percent: 25,
    current_stage: "concept",
    can_proceed_to: 3,
    next_block: 3,
    notifications: [],
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

describe("usePipeline — Hook", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("returns initial state with null project", () => {
    const { result } = renderHook(() => usePipeline(null));
    expect(result.current.state).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.notifications).toEqual([]);
    expect(result.current.staleBlocks).toEqual([]);
    expect(result.current.completedBlocks).toEqual([]);
    expect(result.current.completionPercent).toBe(0);
    expect(result.current.nextBlock).toBeNull();
  });

  it("fetches pipeline state on mount with projectId", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    // Should start loading
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(result.current.state).toEqual(pipelineState);
    });
  });

  it("computes staleBlocks correctly", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    await waitFor(() => {
      const stale = result.current.staleBlocks;
      expect(stale).toHaveLength(1);
      expect(stale[0].block_id).toBe(4);
      expect(stale[0].status).toBe("stale");
    });
  });

  it("computes completedBlocks correctly", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    await waitFor(() => {
      const completed = result.current.completedBlocks;
      expect(completed).toHaveLength(1);
      expect(completed[0].block_id).toBe(1);
      expect(completed[0].status).toBe("completed");
    });
  });

  it("computes completionPercent from state", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.completionPercent).toBe(25);
    });
  });

  it("computes nextBlock from state", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.nextBlock).toBe(3);
    });
  });

  it("computes notifications from state", async () => {
    const notification: PipelineNotification = {
      type: "stale_warning",
      block_id: 4,
      block_name: "Balance",
      message: "Block 4 is stale",
      severity: "warning",
      stale_since: "2024-01-02T00:00:00Z",
      stale_reason: "upstream_changed",
    };
    const pipelineState = createPipelineState({ notifications: [notification] });
    mockApiFetch.mockResolvedValueOnce(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.notifications[0].block_id).toBe(4);
      expect(result.current.notifications[0].type).toBe("stale_warning");
    });
  });

  it("returns empty arrays when state is null", () => {
    const { result } = renderHook(() => usePipeline(null));
    expect(result.current.notifications).toEqual([]);
    expect(result.current.staleBlocks).toEqual([]);
    expect(result.current.completedBlocks).toEqual([]);
  });

  it("handles fetch error gracefully", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.state).toBeNull();
  });

  it("handles 404 error by setting state to null", async () => {
    mockApiFetch.mockRejectedValueOnce(new Error("Not found 404"));

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeNull();
    });
    // 404 should not set error
    expect(result.current.error).toBeNull();
  });

  it("prepareInput calls apiFetch with correct route", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockResolvedValueOnce({ prepared: true }); // prepareInput

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    let prepareResult: unknown;
    await act(async () => {
      prepareResult = await result.current.prepareInput(3);
    });

    expect(prepareResult).toEqual({ prepared: true });
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("prepare-input/proj-1/3")
    );
  });

  it("prepareInput returns null when projectId is null", async () => {
    const { result } = renderHook(() => usePipeline(null));

    let prepareResult: unknown;
    await act(async () => {
      prepareResult = await result.current.prepareInput(3);
    });

    expect(prepareResult).toBeNull();
  });

  it("prepareInput returns null on error", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockRejectedValueOnce(new Error("Prepare failed")); // prepareInput

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    let prepareResult: unknown;
    await act(async () => {
      prepareResult = await result.current.prepareInput(3);
    });

    expect(prepareResult).toBeNull();
  });

  it("notifyUpdated calls apiFetch with POST method", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200 }); // notifyUpdated
    mockApiFetch.mockResolvedValueOnce(pipelineState); // fetchState after notify

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    await act(async () => {
      await result.current.notifyUpdated(1, { reason: "test" });
    });

    // Should have called notify endpoint with POST
    const notifyCall = mockApiFetch.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("notify-updated")
    );
    expect(notifyCall).toBeDefined();
    expect((notifyCall![1] as RequestInit).method).toBe("POST");
  });

  it("notifyUpdated returns null on error", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockRejectedValueOnce(new Error("Notify failed")); // notifyUpdated

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    let notifyResult: unknown;
    await act(async () => {
      notifyResult = await result.current.notifyUpdated(1);
    });

    expect(notifyResult).toBeNull();
  });

  it("notifyUpdated returns null when projectId is null", async () => {
    const { result } = renderHook(() => usePipeline(null));

    let notifyResult: unknown;
    await act(async () => {
      notifyResult = await result.current.notifyUpdated(1);
    });

    expect(notifyResult).toBeNull();
  });

  it("clearStale calls apiFetch with DELETE method", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200 }); // clearStale
    mockApiFetch.mockResolvedValueOnce(pipelineState); // fetchState after clear

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    let clearResult: boolean | null = null;
    await act(async () => {
      clearResult = await result.current.clearStale(4);
    });

    expect(clearResult).toBe(true);
    // Should have called stale endpoint with DELETE
    const staleCall = mockApiFetch.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("stale/proj-1/4")
    );
    expect(staleCall).toBeDefined();
    expect((staleCall![1] as RequestInit).method).toBe("DELETE");
  });

  it("clearStale returns false on error", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockRejectedValueOnce(new Error("Clear failed")); // clearStale

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    let clearResult: boolean | null = null;
    await act(async () => {
      clearResult = await result.current.clearStale(4);
    });

    expect(clearResult).toBe(false);
  });

  it("clearStale returns false when projectId is null", async () => {
    const { result } = renderHook(() => usePipeline(null));

    let clearResult: boolean | null = null;
    await act(async () => {
      clearResult = await result.current.clearStale(4);
    });

    expect(clearResult).toBe(false);
  });

  it("runFullPipeline calls apiFetch with POST method", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockResolvedValueOnce({ ok: true, status: 200 }); // runFullPipeline
    mockApiFetch.mockResolvedValueOnce(pipelineState); // fetchState after run

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    const conceptInput = {
      idea: "A puzzle RPG",
      genre: "rpg",
    };

    await act(async () => {
      await result.current.runFullPipeline(conceptInput);
    });

    const runCall = mockApiFetch.mock.calls.find(
      (call: unknown[]) => typeof call[0] === "string" && call[0].includes("run-full-pipeline/proj-1")
    );
    expect(runCall).toBeDefined();
    expect((runCall![1] as RequestInit).method).toBe("POST");
  });

  it("runFullPipeline returns null when projectId is null", async () => {
    const { result } = renderHook(() => usePipeline(null));

    const conceptInput = { idea: "test" };

    let runResult: unknown;
    await act(async () => {
      runResult = await result.current.runFullPipeline(conceptInput);
    });

    expect(runResult).toBeNull();
  });

  it("runFullPipeline returns null on error", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValueOnce(pipelineState); // initial fetch
    mockApiFetch.mockRejectedValueOnce(new Error("Run failed")); // runFullPipeline

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    const conceptInput = { idea: "test" };
    let runResult: unknown;
    await act(async () => {
      runResult = await result.current.runFullPipeline(conceptInput);
    });

    expect(runResult).toBeNull();
  });

  it("fetchState can be called manually", async () => {
    const pipelineState = createPipelineState();
    mockApiFetch.mockResolvedValue(pipelineState);

    const { result } = renderHook(() => usePipeline("proj-1"));

    await waitFor(() => {
      expect(result.current.state).toBeTruthy();
    });

    const initialCallCount = mockApiFetch.mock.calls.length;

    await act(async () => {
      await result.current.fetchState();
    });

    // fetchState should have been called again
    expect(mockApiFetch.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it("fetchState does nothing when projectId is null", async () => {
    const { result } = renderHook(() => usePipeline(null));

    await act(async () => {
      await result.current.fetchState();
    });

    expect(mockApiFetch).not.toHaveBeenCalled();
  });
});

// ============================================================
// Pipeline state serialization tests
// ============================================================

describe("usePipeline — State Serialization", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
  });

  it("BlockProgress type has all required fields", () => {
    const block: BlockProgress = {
      block_id: 1,
      name: "Concept",
      status: "completed",
      is_filled: true,
      updated_at: "2024-01-01T00:00:00Z",
      stale_since: null,
      stale_reason: null,
    };
    expect(block.block_id).toBe(1);
    expect(block.status).toBe("completed");
    expect(block.stale_since).toBeNull();
  });

  it("BlockStatus accepts all valid values", () => {
    const statuses: Array<"empty" | "in_progress" | "completed" | "stale"> = [
      "empty", "in_progress", "completed", "stale",
    ];
    expect(statuses).toHaveLength(4);
  });

  it("PipelineNotification type has all required fields", () => {
    const notification: PipelineNotification = {
      type: "stale_warning",
      block_id: 4,
      block_name: "Balance",
      message: "Block is stale",
      severity: "warning",
      stale_since: "2024-01-02T00:00:00Z",
      stale_reason: "upstream_changed",
    };
    expect(notification.type).toBe("stale_warning");
    expect(notification.severity).toBe("warning");
  });

  it("PipelineState type has all required fields", () => {
    const state: PipelineState = {
      project_id: "proj-1",
      project_name: "Test",
      blocks: [],
      completion_percent: 0,
      current_stage: "concept",
      can_proceed_to: null,
      next_block: null,
      notifications: [],
    };
    expect(state.project_id).toBe("proj-1");
    expect(state.can_proceed_to).toBeNull();
  });

  it("PipelineState with full data serializes correctly", () => {
    const state = createPipelineState();
    const serialized = JSON.stringify(state);
    const parsed = JSON.parse(serialized);
    expect(parsed.project_id).toBe("proj-1");
    expect(parsed.blocks).toHaveLength(8);
    expect(parsed.completion_percent).toBe(25);
  });
});
