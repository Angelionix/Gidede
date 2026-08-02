/**
 * R-PROTO-DATA: tests for prototype-params.ts.
 *
 * Verifies that:
 *   - extractPrototypeParams reads Balance/Progression/Economy artifacts.
 *   - Missing/malformed artifacts fall back to defaults (no crash).
 *   - resolvePrototypeType respects typeOverride > structuralType > genre heuristic.
 */

import { describe, it, expect } from "vitest";
import {
  extractPrototypeParams,
  resolvePrototypeType,
} from "./prototype-params";

describe("extractPrototypeParams — defensive parsing", () => {
  it("returns {} for null project artifacts", () => {
    const params = extractPrototypeParams({
      id: "p1",
      name: "Test",
      genre: null,
      description: null,
      concept: null,
      balanceResult: null,
      progression: null,
      economy: null,
    });
    expect(params).toEqual({});
  });

  it("returns {} for missing artifacts", () => {
    const params = extractPrototypeParams({
      id: "p1",
      name: "Test",
      genre: "rpg",
      description: null,
      concept: undefined,
      balanceResult: undefined,
      progression: undefined,
      economy: undefined,
    });
    expect(params).toEqual({});
  });

  it("returns {} for malformed Balance fullResult JSON", () => {
    const params = extractPrototypeParams({
      id: "p1",
      name: "Test",
      genre: "rpg",
      description: null,
      balanceResult: {
        overallBalanceScore: 0.5,
        elementCount: 4,
        fullResult: "not valid json {{{",
      },
      progression: null,
      economy: null,
    });
    expect(params).toEqual({});
  });
});

describe("extractPrototypeParams — Balance extraction", () => {
  it("derives enemyDamage from Balance objects' power attribute", () => {
    const params = extractPrototypeParams({
      id: "p1",
      name: "Test",
      genre: "rpg",
      description: null,
      balanceResult: {
        overallBalanceScore: 0.7,
        elementCount: 4,
        fullResult: JSON.stringify({
          objects: [
            { id: "weapon1", name: "Sword", attributes: { power: 60 }, cost: 200 },
            { id: "weapon2", name: "Axe", attributes: { power: 90 }, cost: 400 },
            { id: "armor1", name: "Shield", attributes: { defense: 30 }, cost: 150 },
          ],
        }),
      },
      progression: null,
      economy: null,
    });
    // Average power = (60+90)/2 = 75 → /3 = 25.
    expect(params.enemyDamage).toBe(25);
  });

  it("derives enemySpeed and playerSpeed from Balance objects' speed attribute", () => {
    const params = extractPrototypeParams({
      id: "p1",
      name: "Test",
      genre: "rpg",
      description: null,
      balanceResult: {
        overallBalanceScore: 0.6,
        elementCount: 2,
        fullResult: JSON.stringify({
          objects: [
            { id: "w1", attributes: { speed: 8 }, cost: 100 },
            { id: "w2", attributes: { speed: 12 }, cost: 200 },
          ],
        }),
      },
      progression: null,
      economy: null,
    });
    // Average speed = 10; enemySpeed = 10*8 = 80 (clamped to [40,150]);
    // playerSpeed = 10*12 = 120 (clamped to [120,280]).
    expect(params.enemySpeed).toBe(80);
    expect(params.playerSpeed).toBe(120);
  });

  it("derives collectibleValue from Balance objects' cost", () => {
    const params = extractPrototypeParams({
      id: "p1",
      name: "Test",
      genre: "rpg",
      description: null,
      balanceResult: {
        overallBalanceScore: 0.7,
        elementCount: 4,
        fullResult: JSON.stringify({
          objects: [
            { id: "w1", attributes: { power: 50 }, cost: 150 },
            { id: "w2", attributes: { power: 70 }, cost: 350 },
          ],
        }),
      },
      progression: null,
      economy: null,
    });
    // Average cost = 250; /50 = 5.
    expect(params.collectibleValue).toBe(5);
  });

  it("clamps enemyDamage to [5, 30]", () => {
    const tooHigh = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: {
        overallBalanceScore: 0.5, elementCount: 2,
        fullResult: JSON.stringify({
          objects: [
            { id: "w1", attributes: { power: 500 }, cost: 1000 },
            { id: "w2", attributes: { power: 600 }, cost: 2000 },
          ],
        }),
      },
      progression: null, economy: null,
    });
    // Average power = 550 → /3 = 183 → clamped to 30.
    expect(tooHigh.enemyDamage).toBe(30);

    const tooLow = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: {
        overallBalanceScore: 0.5, elementCount: 2,
        fullResult: JSON.stringify({
          objects: [
            { id: "w1", attributes: { power: 5 }, cost: 10 },
            { id: "w2", attributes: { power: 8 }, cost: 20 },
          ],
        }),
      },
      progression: null, economy: null,
    });
    // Average power = 6.5 → /3 = 2.16 → clamped to 5.
    expect(tooLow.enemyDamage).toBe(5);
  });

  it("returns {} when Balance has <2 objects (insufficient data)", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: {
        overallBalanceScore: 0.5, elementCount: 1,
        fullResult: JSON.stringify({
          objects: [{ id: "w", attributes: { power: 50 }, cost: 100 }],
        }),
      },
      progression: null, economy: null,
    });
    expect(params).toEqual({});
  });
});

describe("extractPrototypeParams — Progression extraction", () => {
  it("derives counterThreshold from Progression totalLevels (clamped to [3, 20])", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: null,
      progression: { totalLevels: 50, tierCount: 5, curveType: "exponential", fullProfile: null },
      economy: null,
    });
    // 50 clamped to 20.
    expect(params.counterThreshold).toBe(20);
    expect(params.targetLevel).toBe(50);
  });

  it("clamps counterThreshold to minimum 3", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: null,
      progression: { totalLevels: 1, tierCount: 1, curveType: null, fullProfile: null },
      economy: null,
    });
    expect(params.counterThreshold).toBe(3);
  });

  it("returns {} for missing totalLevels", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: null,
      progression: { totalLevels: null, tierCount: null, curveType: null, fullProfile: null },
      economy: null,
    });
    expect(params).toEqual({});
  });
});

describe("extractPrototypeParams — Economy extraction", () => {
  it("derives resourceName and resourceIcon from Economy resourceModel", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: null, progression: null,
      economy: {
        resourceCount: 4, hasPathology: false,
        resourceModel: JSON.stringify({
          resources: [
            { name: "gold", role: "core" },
            { name: "xp", role: "subsidiary" },
          ],
        }),
        fullProfile: null,
      },
    });
    expect(params.resourceName).toBe("gold");
    expect(params.resourceIcon).toBe("💰"); // from RESOURCE_ICON_BY_NAME map
  });

  it("returns fallback icon '✨' for unknown resource names", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: null, progression: null,
      economy: {
        resourceCount: 1, hasPathology: false,
        resourceModel: JSON.stringify({
          resources: [{ name: "plasma_crystals", role: "core" }],
        }),
        fullProfile: null,
      },
    });
    expect(params.resourceName).toBe("plasma_crystals");
    expect(params.resourceIcon).toBe("✨");
  });

  it("returns {} for empty resources array", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: null, progression: null,
      economy: {
        resourceCount: 0, hasPathology: false,
        resourceModel: JSON.stringify({ resources: [] }),
        fullProfile: null,
      },
    });
    // economy params absent, but other stages are null too → overall {}.
    expect(params).toEqual({});
  });
});

describe("extractPrototypeParams — combined extraction", () => {
  it("merges Balance + Progression + Economy params", () => {
    const params = extractPrototypeParams({
      id: "p1", name: "T", genre: "rpg", description: null,
      balanceResult: {
        overallBalanceScore: 0.7, elementCount: 2,
        fullResult: JSON.stringify({
          objects: [
            { id: "w1", attributes: { power: 60, speed: 10 }, cost: 200 },
            { id: "w2", attributes: { power: 80, speed: 12 }, cost: 300 },
          ],
        }),
      },
      progression: { totalLevels: 15, tierCount: 3, curveType: null, fullProfile: null },
      economy: {
        resourceCount: 2, hasPathology: false,
        resourceModel: JSON.stringify({
          resources: [{ name: "gems", role: "core" }],
        }),
        fullProfile: null,
      },
    });
    expect(params.enemyDamage).toBe(23);  // (60+80)/2/3 ≈ 23.3 → 23
    expect(params.enemySpeed).toBe(88);   // (10+12)/2*8 = 88
    expect(params.playerSpeed).toBe(132); // 11*12 = 132
    expect(params.collectibleValue).toBe(5); // (200+300)/2/50 = 5
    expect(params.counterThreshold).toBe(15);
    expect(params.targetLevel).toBe(15);
    expect(params.resourceName).toBe("gems");
    expect(params.resourceIcon).toBe("💎");
  });
});

describe("resolvePrototypeType — type resolution precedence", () => {
  it("typeOverride takes precedence over structuralType and genre", () => {
    expect(resolvePrototypeType("platformer", "engine", "rpg")).toBe("platformer");
  });

  it("structuralType takes precedence over genre when no override", () => {
    expect(resolvePrototypeType(null, "tower_defense", "rpg")).toBe("tower_defense");
  });

  it("genre heuristic is used when no override and no structuralType", () => {
    expect(resolvePrototypeType(null, null, "puzzle")).toBe("puzzle");
    expect(resolvePrototypeType(null, null, "Puzzle")).toBe("puzzle");
    expect(resolvePrototypeType(null, null, "Tower Defense")).toBe("tower_defense");
    expect(resolvePrototypeType(null, null, "Horror")).toBe("survival_horror");
    expect(resolvePrototypeType(null, null, "Racing")).toBe("rhythm");
  });

  it("returns 'engine' default when nothing matches", () => {
    expect(resolvePrototypeType(null, null, null)).toBe("engine");
    expect(resolvePrototypeType(null, null, "unknown_genre_xyz")).toBe("engine");
  });

  it("rejects invalid typeOverride, falls back to structuralType", () => {
    expect(resolvePrototypeType("invalid_type", "rhythm", "rpg")).toBe("rhythm");
  });

  it("accepts all 10 supported types as override", () => {
    const supported = [
      "engine", "economy", "ecology", "tower_defense", "rhythm", "puzzle",
      "platformer", "stealth", "deck_builder", "survival_horror",
    ];
    for (const t of supported) {
      expect(resolvePrototypeType(t, null, null)).toBe(t);
    }
  });

  it("genre-based mapping: metroidvania → platformer", () => {
    expect(resolvePrototypeType(null, null, "metroidvania")).toBe("platformer");
  });

  it("genre-based mapping: roguelike → deck_builder", () => {
    expect(resolvePrototypeType(null, null, "roguelike")).toBe("deck_builder");
  });

  it("genre-based mapping: strategy → tower_defense", () => {
    expect(resolvePrototypeType(null, null, "strategy")).toBe("tower_defense");
  });
});
