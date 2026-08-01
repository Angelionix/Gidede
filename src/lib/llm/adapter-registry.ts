import type { LlmClient } from "@/lib/llm/types";

export interface LlmAdapterConfig {
  providerId: string;
  baseUrl: string;
  model: string;
  secretRef: string | null;
  options: unknown;
}

export interface LlmAdapterDescriptor {
  id: string;
  label: string;
  configurable?: boolean;
  create(config: LlmAdapterConfig): LlmClient;
  normalizeOptions?(options: unknown): unknown;
}

export class LlmAdapterRegistry {
  private readonly adapters = new Map<string, LlmAdapterDescriptor>();

  register(descriptor: LlmAdapterDescriptor): void {
    const id = descriptor.id.trim();
    const label = descriptor.label.trim();
    if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
      throw new Error("LLM adapter id must use lowercase letters, digits and hyphens");
    }
    if (!label) throw new Error("LLM adapter label must not be empty");
    if (this.adapters.has(id)) throw new Error(`LLM adapter already registered: ${id}`);
    this.adapters.set(id, { ...descriptor, id, label });
  }

  has(adapterId: string): boolean {
    return this.adapters.has(adapterId);
  }

  list(options: { configurableOnly?: boolean } = {}): Array<{ id: string; label: string }> {
    return [...this.adapters.values()]
      .filter((adapter) => !options.configurableOnly || adapter.configurable !== false)
      .map(({ id, label }) => ({ id, label }))
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  normalizeOptions(
    adapterId: string,
    options: unknown,
    constraints: { configurable?: boolean } = {},
  ): unknown {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Unknown LLM adapter: ${adapterId}`);
    if (constraints.configurable && adapter.configurable === false) {
      throw new Error(`LLM adapter is built-in and cannot be configured: ${adapterId}`);
    }
    return adapter.normalizeOptions ? adapter.normalizeOptions(options) : options ?? null;
  }

  create(
    adapterId: string,
    config: LlmAdapterConfig,
    options: { normalized?: boolean; configurable?: boolean } = {},
  ): LlmClient {
    const adapter = this.adapters.get(adapterId);
    if (!adapter) throw new Error(`Unknown LLM adapter: ${adapterId}`);
    if (options.configurable && adapter.configurable === false) {
      throw new Error(`LLM adapter is built-in and cannot be configured: ${adapterId}`);
    }
    return adapter.create({
      ...config,
      options: options.normalized
        ? config.options
        : this.normalizeOptions(adapterId, config.options, {
          configurable: options.configurable,
        }),
    });
  }
}
