export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) throw new Error("TTL must be positive");
  }

  getOrCreate(key: string, factory: () => T): T {
    const now = this.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) return cached.value;
    const value = factory();
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
    this.prune(now);
    return value;
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }
}
