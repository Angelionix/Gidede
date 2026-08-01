import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "./client-cache";

describe("TtlCache — R3-05", () => {
  it("reuses a client inside TTL and recreates it after expiry", () => {
    let now = 1_000;
    const cache = new TtlCache<object>(500, () => now);
    const factory = vi.fn(() => ({ createdAt: now }));

    const first = cache.getOrCreate("provider", factory);
    now = 1_499;
    expect(cache.getOrCreate("provider", factory)).toBe(first);
    now = 1_500;
    expect(cache.getOrCreate("provider", factory)).not.toBe(first);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
