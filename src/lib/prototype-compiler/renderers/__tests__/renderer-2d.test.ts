/**
 * Tests for the rewritten 2D renderer (direct, playable HTML).
 *
 * Phase 2 acceptance criteria:
 * - Generates simple, playable HTML like the example prototypes
 * - Direct game loop (no inlined runtime engine)
 * - Canvas2D with emoji rendering
 * - WASD + arrow key movement
 * - Score, health, timer, game over, restart
 */

import { describe, expect, it } from "vitest";
import { render2dHtml, RENDERER_2D_VERSION } from "../renderer-2d";
import { minimalIR, makeIR } from "../../ir/__tests__/fixtures";

describe("render2dHtml — basic output", () => {
  it("produces a non-empty HTML string", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(500);
  });

  it("starts with <!DOCTYPE html>", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("contains <canvas> element", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("<canvas");
    expect(html).toContain('id="game"');
  });
});

describe("render2dHtml — direct game code (no runtime abstraction)", () => {
  it("contains direct game loop (update + draw + requestAnimationFrame)", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("function update(");
    expect(html).toContain("function draw(");
    expect(html).toContain("function gameLoop(");
    expect(html).toContain("requestAnimationFrame(gameLoop)");
  });

  it("does NOT contain inlined PrototypeRuntimeEngine class", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    // The new renderer generates direct code, not an ECS engine.
    expect(html).not.toContain("class PrototypeRuntimeEngine");
  });

  it("contains Canvas2D context", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("getContext('2d')");
  });

  it("contains rectCollide function", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("function rectCollide");
  });
});

describe("render2dHtml — input handlers", () => {
  it("contains keyboard input (WASD + arrows)", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("addEventListener('keydown'");
    expect(html).toContain("addEventListener('keyup'");
    expect(html).toContain("KeyW");
    expect(html).toContain("KeyA");
    expect(html).toContain("KeyS");
    expect(html).toContain("KeyD");
    expect(html).toContain("ArrowUp");
    expect(html).toContain("ArrowDown");
    expect(html).toContain("ArrowLeft");
    expect(html).toContain("ArrowRight");
  });

  it("contains Enter for restart", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("Enter");
    expect(html).toContain("resetGame");
  });
});

describe("render2dHtml — game features", () => {
  it("contains score tracking", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("score");
    expect(html).toContain("goalScore");
  });

  it("contains timer", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("timeLeft");
    expect(html).toContain("timerAccum");
  });

  it("contains game over screen", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("gameActive");
    expect(html).toContain("gameWon");
    expect(html).toContain("Победа");
    expect(html).toContain("Поражение");
  });

  it("contains HUD with score and timer", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("⏱");
    expect(html).toContain("WASD");
  });
});

describe("render2dHtml — telemetry", () => {
  it("contains postMessage to parent", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("window.parent.postMessage");
    expect(html).toContain("gidede-playtest");
    expect(html).toContain("session_start");
    expect(html).toContain("session_end");
  });

  it("embeds prototypeId", () => {
    const html = render2dHtml(minimalIR(), "my-proto-123");
    expect(html).toContain("my-proto-123");
  });
});

describe("render2dHtml — feature flags from IR", () => {
  it("includes combat code when combat adapter is present", () => {
    const ir = makeIR({
      mechanicBindings: [
        {
          sourceMechanicId: "combat",
          adapterId: "target/combat",
          adapterVersion: "1.0.0",
          resolution: "exact",
          representedByRuleIds: [],
          assumptions: [],
        },
      ],
      systems: [
        { id: "sys-combat", kind: "combat", appliesToRoles: ["player", "enemy"], config: { enemyDamage: 15 } },
        { id: "sys-targeting", kind: "targeting", appliesToRoles: ["enemy"], config: { enemySpeed: 80 } },
      ],
    });
    const html = render2dHtml(ir, "test-id");
    expect(html).toContain('"hasCombat":true');
  });

  it("includes survival code when survival adapter is present", () => {
    const ir = makeIR({
      mechanicBindings: [
        {
          sourceMechanicId: "survival",
          adapterId: "avoid/survive",
          adapterVersion: "1.0.0",
          resolution: "exact",
          representedByRuleIds: [],
          assumptions: [],
        },
      ],
      systems: [
        { id: "sys-hazard", kind: "collision", appliesToRoles: ["player", "hazard"], config: { damagePerContact: 10 } },
      ],
    });
    const html = render2dHtml(ir, "test-id");
    expect(html).toContain('"hasSurvival":true');
  });
});

describe("render2dHtml — canvas dimensions", () => {
  it("sets canvas dimensions from scene bounds", () => {
    const ir = minimalIR(); // bounds 400x300
    const html = render2dHtml(ir, "test-id");
    // width = min(800, 400*2) = 800, height = min(600, 300*2) = 600
    // Actually 400*2=800, 300*2=600, so canvas is 800x600
    expect(html).toMatch(/width="800"/);
    expect(html).toMatch(/height="600"/);
  });
});

describe("Renderer metadata", () => {
  it("RENDERER_2D_VERSION is a non-empty string", () => {
    expect(RENDERER_2D_VERSION).toBeTruthy();
    expect(typeof RENDERER_2D_VERSION).toBe("string");
    expect(RENDERER_2D_VERSION).toContain("2d-direct");
  });
});
