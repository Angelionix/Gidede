import type { LlmClient, LlmClientFactory } from "@/lib/llm/types";

export class LlmRegistry {
  private readonly factories = new Map<string, LlmClientFactory>();
  private readonly instances = new Map<string, Promise<LlmClient>>();
  private defaultProviderId: string | null = null;

  register(providerId: string, factory: LlmClientFactory, options: { default?: boolean } = {}): void {
    const id = providerId.trim();
    if (!id) throw new Error("LLM provider id must not be empty");
    if (this.factories.has(id)) throw new Error(`LLM provider already registered: ${id}`);
    this.factories.set(id, factory);
    if (options.default || !this.defaultProviderId) this.defaultProviderId = id;
  }

  has(providerId: string): boolean {
    return this.factories.has(providerId);
  }

  list(): string[] {
    return [...this.factories.keys()].sort();
  }

  setDefault(providerId: string): void {
    if (!this.factories.has(providerId)) throw new Error(`Unknown LLM provider: ${providerId}`);
    this.defaultProviderId = providerId;
  }

  getDefaultProviderId(): string | null {
    return this.defaultProviderId;
  }

  async get(providerId: string): Promise<LlmClient> {
    const factory = this.factories.get(providerId);
    if (!factory) throw new Error(`Unknown LLM provider: ${providerId}`);
    let instance = this.instances.get(providerId);
    if (!instance) {
      instance = factory();
      this.instances.set(providerId, instance);
    }
    return instance;
  }

  async getDefault(): Promise<LlmClient | null> {
    return this.defaultProviderId ? this.get(this.defaultProviderId) : null;
  }
}

const registry = new LlmRegistry();

export function getLlmRegistry(): LlmRegistry {
  return registry;
}
