/**
 * Gidede — Configuration Tests
 * Task 4-a: Expand frontend test coverage
 *
 * Tests for all config files:
 * - api.ts: API route definitions
 * - blocks.ts: Block configuration
 * - genres.ts: Genre taxonomy
 * - aesthetics.ts: Aesthetics configuration
 */

import { describe, it, expect } from "vitest";

// ============================================================
// api.ts
// ============================================================

describe("Config — api.ts", () => {
  it("API_BASE_URL is defined", async () => {
    const { API_BASE_URL } = await import("@/config/api");
    expect(API_BASE_URL).toBeDefined();
    expect(typeof API_BASE_URL).toBe("string");
  });

  it("apiRoutes is defined and is an object", async () => {
    const { apiRoutes } = await import("@/config/api");
    expect(apiRoutes).toBeDefined();
    expect(typeof apiRoutes).toBe("object");
  });

  it("apiRoutes.auth has all required routes", async () => {
    const { apiRoutes } = await import("@/config/api");
    expect(apiRoutes.auth).toBeDefined();
    expect(typeof apiRoutes.auth.login).toBe("function");
    expect(typeof apiRoutes.auth.register).toBe("function");
    expect(typeof apiRoutes.auth.refresh).toBe("function");
    expect(typeof apiRoutes.auth.me).toBe("function");
  });

  it("apiRoutes.auth.login returns correct path", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.auth.login();
    expect(url).toContain("/api/v1/auth/login");
  });

  it("apiRoutes.auth.register returns correct path", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.auth.register();
    expect(url).toContain("/api/v1/auth/register");
  });

  it("apiRoutes.auth.refresh returns correct path", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.auth.refresh();
    expect(url).toContain("/api/v1/auth/refresh");
  });

  it("apiRoutes.auth.me returns correct path", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.auth.me();
    expect(url).toContain("/api/v1/auth/me");
  });

  it("apiRoutes.projects has all required routes", async () => {
    const { apiRoutes } = await import("@/config/api");
    expect(apiRoutes.projects).toBeDefined();
    expect(typeof apiRoutes.projects.list).toBe("function");
    expect(typeof apiRoutes.projects.detail).toBe("function");
    expect(typeof apiRoutes.projects.create).toBe("function");
  });

  it("apiRoutes.projects.detail includes project ID", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.projects.detail("test-project-123");
    expect(url).toContain("/api/v1/projects/test-project-123");
  });

  it("apiRoutes.blocks has concept route", async () => {
    const { apiRoutes } = await import("@/config/api");
    expect(apiRoutes.blocks).toBeDefined();
    const url = apiRoutes.blocks.concept("generate");
    expect(url).toContain("/api/v1/concept/generate");
  });

  it("apiRoutes.blocks has coreloop route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.blocks.coreloop("design");
    expect(url).toContain("/api/v1/coreloop/design");
  });

  it("apiRoutes.blocks has mda route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.blocks.mda("analyze");
    expect(url).toContain("/api/v1/mda/analyze");
  });

  it("apiRoutes.blocks has balance route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.blocks.balance("full-analysis");
    expect(url).toContain("/api/v1/balance/full-analysis");
  });

  it("apiRoutes.blocks has progression route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.blocks.progression("design");
    expect(url).toContain("/api/v1/progression/design");
  });

  it("apiRoutes.blocks has economy route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.blocks.economy("design");
    expect(url).toContain("/api/v1/economy/design");
  });

  it("apiRoutes.pipeline has state route with project ID", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.pipeline.state("proj-1");
    expect(url).toContain("/api/v1/pipeline/state/proj-1");
  });

  it("apiRoutes.pipeline has prepare route with project ID and block ID", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.pipeline.prepare("proj-1", 3);
    expect(url).toContain("/api/v1/pipeline/prepare-input/proj-1/3");
  });

  it("apiRoutes.pipeline has notify route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.pipeline.notify();
    expect(url).toContain("/api/v1/pipeline/notify-updated");
  });

  it("apiRoutes.pipeline has stale route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.pipeline.stale("proj-1", 2);
    expect(url).toContain("/api/v1/pipeline/stale/proj-1/2");
  });

  it("apiRoutes.pipeline has runPipeline route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.pipeline.runPipeline("proj-1");
    expect(url).toContain("/api/v1/pipeline/run-full-pipeline/proj-1");
  });

  it("apiRoutes.pipeline has runPartial route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.pipeline.runPartial("proj-1");
    expect(url).toContain("/api/v1/pipeline/run-pipeline/proj-1");
  });

  it("apiRoutes.rag has search route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.rag.search();
    expect(url).toContain("/api/v1/rag/search");
  });

  it("apiRoutes.gbe has syncTo route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.syncTo();
    expect(url).toContain("/api/v1/gbe/sync-to");
  });

  it("apiRoutes.gbe has syncFrom route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.syncFrom();
    expect(url).toContain("/api/v1/gbe/sync-from");
  });

  it("apiRoutes.gbe has webhook route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.webhook();
    expect(url).toContain("/api/v1/gbe/webhook");
  });

  it("apiRoutes.gbe has status route with project ID", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.status("proj-1");
    expect(url).toContain("/api/v1/gbe/status/proj-1");
  });

  it("apiRoutes.gbe has testConnection route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.testConnection();
    expect(url).toContain("/api/v1/gbe/test-connection");
  });

  it("apiRoutes.gbe has syncHistory route with limit parameter", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.syncHistory(20);
    expect(url).toContain("/api/v1/gbe/sync-history");
    expect(url).toContain("limit=20");
  });

  it("apiRoutes.gbe syncHistory defaults to limit=10", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.gbe.syncHistory();
    expect(url).toContain("limit=10");
  });

  it("apiRoutes has health route", async () => {
    const { apiRoutes } = await import("@/config/api");
    const url = apiRoutes.health();
    expect(url).toContain("/api/v1/health");
  });
});

// ============================================================
// blocks.ts
// ============================================================

describe("Config — blocks.ts", () => {
  it("BLOCKS array is defined", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    expect(BLOCKS).toBeDefined();
    expect(Array.isArray(BLOCKS)).toBe(true);
  });

  it("BLOCKS has exactly 8 blocks", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    expect(BLOCKS).toHaveLength(8);
  });

  it("Block 1: Concept Generator has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block1 = BLOCKS.find((b) => b.id === 1);
    expect(block1).toBeDefined();
    expect(block1!.name).toBe("Генератор концепции");
    expect(block1!.href).toBe("/blocks/1");
    expect(block1!.algorithm).toBe("3.1");
    expect(block1!.status).toBe("active");
  });

  it("Block 2: Core Loop Designer has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block2 = BLOCKS.find((b) => b.id === 2);
    expect(block2).toBeDefined();
    expect(block2!.name).toBe("Core Loop Designer");
    expect(block2!.href).toBe("/blocks/2");
    expect(block2!.algorithm).toBe("3.2");
    expect(block2!.status).toBe("active");
  });

  it("Block 3: MDA Lab has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block3 = BLOCKS.find((b) => b.id === 3);
    expect(block3).toBeDefined();
    expect(block3!.name).toBe("MDA Lab");
    expect(block3!.href).toBe("/blocks/3");
    expect(block3!.algorithm).toBe("3.3");
    expect(block3!.status).toBe("active");
  });

  it("Block 4: Balance has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block4 = BLOCKS.find((b) => b.id === 4);
    expect(block4).toBeDefined();
    expect(block4!.name).toBe("Баланс и симуляция");
    expect(block4!.href).toBe("/blocks/4");
    expect(block4!.algorithm).toBe("3.4");
  });

  it("Block 5: Economy & Progression has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block5 = BLOCKS.find((b) => b.id === 5);
    expect(block5).toBeDefined();
    expect(block5!.name).toBe("Экономика и прогрессия");
    expect(block5!.href).toBe("/blocks/5");
    expect(block5!.algorithm).toBe("3.5–3.6");
  });

  it("Block 6: GDD Generator has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block6 = BLOCKS.find((b) => b.id === 6);
    expect(block6).toBeDefined();
    expect(block6!.name).toBe("GDD Generator");
    expect(block6!.href).toBe("/blocks/6");
    expect(block6!.algorithm).toBe("3.7–3.8");
  });

  it("Block 7: AI Assistant has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block7 = BLOCKS.find((b) => b.id === 7);
    expect(block7).toBeDefined();
    expect(block7!.name).toBe("AI-ассистент");
    expect(block7!.href).toBe("/blocks/7");
    expect(block7!.algorithm).toBe("3.9");
  });

  it("Block 8: GBE Integration has correct properties", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const block8 = BLOCKS.find((b) => b.id === 8);
    expect(block8).toBeDefined();
    expect(block8!.name).toBe("Интеграция GBE");
    expect(block8!.href).toBe("/blocks/8");
    expect(block8!.status).toBe("planned");
  });

  it("Each block has required fields: id, name, href, description, icon, algorithm, status", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    for (const block of BLOCKS) {
      expect(block.id).toBeDefined();
      expect(typeof block.id).toBe("number");
      expect(block.name).toBeDefined();
      expect(typeof block.name).toBe("string");
      expect(block.name.length).toBeGreaterThan(0);
      expect(block.href).toBeDefined();
      expect(typeof block.href).toBe("string");
      expect(block.href).toMatch(/^\/blocks\/\d+$/);
      expect(block.description).toBeDefined();
      expect(typeof block.description).toBe("string");
      expect(block.description.length).toBeGreaterThan(0);
      expect(block.icon).toBeDefined();
      expect(block.algorithm).toBeDefined();
      expect(typeof block.algorithm).toBe("string");
      expect(block.status).toBeDefined();
      expect(["active", "skeleton", "planned"]).toContain(block.status);
    }
  });

  it("Block IDs are sequential from 1 to 8", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const ids = BLOCKS.map((b) => b.id).sort();
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("Block dev statuses are valid", async () => {
    const { BLOCKS } = await import("@/config/blocks");
    const validStatuses = ["active", "skeleton", "planned"];
    for (const block of BLOCKS) {
      expect(validStatuses).toContain(block.status);
    }
  });
});

// ============================================================
// genres.ts
// ============================================================

describe("Config — genres.ts", () => {
  it("GENRES array is defined and non-empty", async () => {
    const { GENRES } = await import("@/config/genres");
    expect(GENRES).toBeDefined();
    expect(Array.isArray(GENRES)).toBe(true);
    expect(GENRES.length).toBeGreaterThan(0);
  });

  it("GENRES has 29 genres (Rogers taxonomy)", async () => {
    const { GENRES } = await import("@/config/genres");
    expect(GENRES).toHaveLength(29);
  });

  it("Each genre has value and label fields", async () => {
    const { GENRES } = await import("@/config/genres");
    for (const genre of GENRES) {
      expect(genre).toHaveProperty("value");
      expect(genre).toHaveProperty("label");
      expect(typeof genre.value).toBe("string");
      expect(typeof genre.label).toBe("string");
      expect(genre.value.length).toBeGreaterThan(0);
      expect(genre.label.length).toBeGreaterThan(0);
    }
  });

  it("Genre values are unique", async () => {
    const { GENRES } = await import("@/config/genres");
    const values = GENRES.map((g) => g.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("Genre labels are unique", async () => {
    const { GENRES } = await import("@/config/genres");
    const labels = GENRES.map((g) => g.label);
    const uniqueLabels = new Set(labels);
    expect(uniqueLabels.size).toBe(labels.length);
  });

  it("Contains key genres: action, rpg, strategy, simulation", async () => {
    const { GENRES } = await import("@/config/genres");
    const values = GENRES.map((g) => g.value);
    expect(values).toContain("action");
    expect(values).toContain("rpg");
    expect(values).toContain("strategy");
    expect(values).toContain("simulation");
  });

  it("Contains niche genres: roguelike, metroidvania, visual_novel", async () => {
    const { GENRES } = await import("@/config/genres");
    const values = GENRES.map((g) => g.value);
    expect(values).toContain("roguelike");
    expect(values).toContain("metroidvania");
    expect(values).toContain("visual_novel");
  });

  it("GenreOption interface is correct", async () => {
    const { GENRES } = await import("@/config/genres");
    const firstGenre = GENRES[0];
    expect(firstGenre).toEqual({
      value: "action",
      label: "Action",
    });
  });
});

// ============================================================
// aesthetics.ts
// ============================================================

describe("Config — aesthetics.ts", () => {
  it("AESTHETICS array is defined and has 8 LeBlanc aesthetics", async () => {
    const { AESTHETICS } = await import("@/config/aesthetics");
    expect(AESTHETICS).toBeDefined();
    expect(Array.isArray(AESTHETICS)).toBe(true);
    expect(AESTHETICS).toHaveLength(8);
  });

  it("Each aesthetic has value, label, icon, and color", async () => {
    const { AESTHETICS } = await import("@/config/aesthetics");
    for (const a of AESTHETICS) {
      expect(a).toHaveProperty("value");
      expect(a).toHaveProperty("label");
      expect(a).toHaveProperty("icon");
      expect(a).toHaveProperty("color");
      expect(typeof a.value).toBe("string");
      expect(typeof a.label).toBe("string");
      expect(typeof a.color).toBe("string");
      expect(a.icon).toBeDefined();
    }
  });

  it("Aesthetic values match LeBlanc's 8: sensation, fantasy, narrative, challenge, fellowship, discovery, expression, submission", async () => {
    const { AESTHETICS } = await import("@/config/aesthetics");
    const values = AESTHETICS.map((a) => a.value);
    expect(values).toContain("sensation");
    expect(values).toContain("fantasy");
    expect(values).toContain("narrative");
    expect(values).toContain("challenge");
    expect(values).toContain("fellowship");
    expect(values).toContain("discovery");
    expect(values).toContain("expression");
    expect(values).toContain("submission");
  });

  it("Aesthetic values are unique", async () => {
    const { AESTHETICS } = await import("@/config/aesthetics");
    const values = AESTHETICS.map((a) => a.value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("AESTHETIC_MAP is defined and has 8 entries", async () => {
    const { AESTHETIC_MAP } = await import("@/config/aesthetics");
    expect(AESTHETIC_MAP).toBeDefined();
    expect(typeof AESTHETIC_MAP).toBe("object");
    const keys = Object.keys(AESTHETIC_MAP);
    expect(keys).toHaveLength(8);
  });

  it("AESTHETIC_MAP keys match AESTHETICS values", async () => {
    const { AESTHETICS, AESTHETIC_MAP } = await import("@/config/aesthetics");
    const aestheticValues = AESTHETICS.map((a) => a.value).sort();
    const mapKeys = Object.keys(AESTHETIC_MAP).sort();
    expect(mapKeys).toEqual(aestheticValues);
  });

  it("AESTHETIC_MAP entries have emoji, label, and color", async () => {
    const { AESTHETIC_MAP } = await import("@/config/aesthetics");
    for (const [key, entry] of Object.entries(AESTHETIC_MAP)) {
      expect(entry).toHaveProperty("emoji");
      expect(entry).toHaveProperty("label");
      expect(entry).toHaveProperty("color");
      expect(typeof entry.emoji).toBe("string");
      expect(typeof entry.label).toBe("string");
      expect(typeof entry.color).toBe("string");
    }
  });

  it("YEE_MOTIVATIONS is defined and has 3 clusters", async () => {
    const { YEE_MOTIVATIONS } = await import("@/config/aesthetics");
    expect(YEE_MOTIVATIONS).toBeDefined();
    expect(Array.isArray(YEE_MOTIVATIONS)).toBe(true);
    expect(YEE_MOTIVATIONS).toHaveLength(3);
  });

  it("YEE_MOTIVATIONS clusters have correct structure", async () => {
    const { YEE_MOTIVATIONS } = await import("@/config/aesthetics");
    for (const cluster of YEE_MOTIVATIONS) {
      expect(cluster).toHaveProperty("cluster");
      expect(cluster).toHaveProperty("items");
      expect(typeof cluster.cluster).toBe("string");
      expect(Array.isArray(cluster.items)).toBe(true);
      expect(cluster.items.length).toBeGreaterThan(0);
    }
  });

  it("YEE_MOTIVATIONS has 12 total motivation items (4 per cluster)", async () => {
    const { YEE_MOTIVATIONS } = await import("@/config/aesthetics");
    const totalItems = YEE_MOTIVATIONS.reduce((sum, c) => sum + c.items.length, 0);
    expect(totalItems).toBe(12);
  });

  it("YEE_MOTIVATIONS cluster names are correct", async () => {
    const { YEE_MOTIVATIONS } = await import("@/config/aesthetics");
    const clusterNames = YEE_MOTIVATIONS.map((c) => c.cluster);
    expect(clusterNames).toContain("Действие-Социальность");
    expect(clusterNames).toContain("Мастерство-Достижение");
    expect(clusterNames).toContain("Погружение-Творчество");
  });

  it("Each YEE motivation item has value and label", async () => {
    const { YEE_MOTIVATIONS } = await import("@/config/aesthetics");
    for (const cluster of YEE_MOTIVATIONS) {
      for (const item of cluster.items) {
        expect(item).toHaveProperty("value");
        expect(item).toHaveProperty("label");
        expect(typeof item.value).toBe("string");
        expect(typeof item.label).toBe("string");
      }
    }
  });
});
