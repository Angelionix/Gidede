/**
 * Tests for the 2D renderer adapter.
 *
 * Phase 1.6 acceptance criteria:
 * - render2dHtml produces a valid self-contained HTML string
 * - HTML contains the embedded IR as JSON
 * - HTML contains the runtime engine code
 * - HTML contains Canvas2D rendering code
 * - HTML contains input handlers (keyboard, mouse, touch)
 * - HTML contains postMessage telemetry forwarding
 * - Role colors are applied correctly
 * - Renderer metadata is exposed
 */

import { describe, expect, it } from "vitest";
import { render2dHtml, getRenderer2dInfo, RENDERER_2D_VERSION } from "../renderer-2d";
import { minimalIR, makeIR } from "../../ir/__tests__/fixtures";

describe("render2dHtml — basic output", () => {
  it("produces a non-empty HTML string", () => {
    const html = render2dHtml(minimalIR(), "test-prototype-id");
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(1000);
  });

  it("starts with <!DOCTYPE html>", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("contains <html>, <head>, <body> tags", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
  });

  it("contains a <canvas> element", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("<canvas");
    expect(html).toContain('id="game"');
  });
});

describe("render2dHtml — IR embedding", () => {
  it("embeds the PrototypeIR as JSON", () => {
    const ir = minimalIR();
    const html = render2dHtml(ir, "test-id");
    // The IR should be embedded as a JSON constant.
    expect(html).toContain("const IR =");
    // Check that key IR fields are present in the embedded JSON.
    expect(html).toContain('"schemaVersion"');
    expect(html).toContain('"seed"');
    expect(html).toContain('"session"');
    expect(html).toContain('"stepMachine"');
  });

  it("embeds the prototypeId", () => {
    const html = render2dHtml(minimalIR(), "proto-abc-123");
    expect(html).toContain("proto-abc-123");
    expect(html).toContain("const PROTOTYPE_ID");
  });
});

describe("render2dHtml — runtime code", () => {
  it("contains the PrototypeRuntimeEngine class", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("class PrototypeRuntimeEngine");
  });

  it("contains the mulberry32 PRNG", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("createMulberry32");
  });

  it("contains the predicate evaluator", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("evaluatePredicate");
    expect(html).toContain("resource_gte");
    expect(html).toContain("loop_count_gte");
  });

  it("contains tick() method", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("tick()");
  });
});

describe("render2dHtml — rendering code", () => {
  it("contains Canvas2D context setup", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("getContext('2d')");
  });

  it("contains drawEntity function", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("function drawEntity");
  });

  it("contains role colors mapping", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("ROLE_COLORS");
    expect(html).toContain("#22c55e"); // player green
    expect(html).toContain("#ef4444"); // enemy red
    expect(html).toContain("#fbbf24"); // collectible gold
  });

  it("contains drawBounds function", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("function drawBounds");
  });

  it("contains HUD update function", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("function updateHud");
  });
});

describe("render2dHtml — input handlers", () => {
  it("contains keyboard input handler", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("addEventListener('keydown'");
    expect(html).toContain("addEventListener('keyup'");
  });

  it("contains mouse input handler", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("addEventListener('mousemove'");
    expect(html).toContain("addEventListener('click'");
  });

  it("contains touch input handler", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("addEventListener('touchstart'");
    expect(html).toContain("addEventListener('touchmove'");
    expect(html).toContain("addEventListener('touchend'");
  });

  it("contains WASD movement mapping", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("keys['w']");
    expect(html).toContain("keys['a'");
    expect(html).toContain("keys['s'");
    expect(html).toContain("keys['d'");
  });
});

describe("render2dHtml — telemetry forwarding", () => {
  it("contains postMessage call to parent", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("window.parent.postMessage");
    expect(html).toContain("gidede-playtest");
  });

  it("forwards prototypeId in telemetry", () => {
    const html = render2dHtml(minimalIR(), "my-proto-id");
    expect(html).toContain("prototypeId: PROTOTYPE_ID");
  });

  it("sends session_end event on completion", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain("session_end");
  });
});

describe("render2dHtml — canvas dimensions", () => {
  it("sets canvas width based on scene bounds", () => {
    const ir = minimalIR(); // bounds halfExtents: 400x300
    const html = render2dHtml(ir, "test-id");
    // canvasWidth = (400 * 2) + 40 = 840
    expect(html).toContain('width="840"');
    expect(html).toContain('height="640"');
  });

  it("adjusts canvas for different scene sizes", () => {
    const ir = makeIR({
      scene: {
        topology: "arena",
        bounds: { center: { x: 0, y: 0 }, halfExtents: { x: 500, y: 400 } },
        topologyScores: [],
      },
    });
    const html = render2dHtml(ir, "test-id");
    // canvasWidth = (500 * 2) + 40 = 1040
    expect(html).toContain('width="1040"');
    expect(html).toContain('height="840"');
  });
});

describe("render2dHtml — status display", () => {
  it("contains status element", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain('id="status"');
  });

  it("contains win/lose/timeout CSS classes", () => {
    const html = render2dHtml(minimalIR(), "test-id");
    expect(html).toContain(".status.won");
    expect(html).toContain(".status.lost");
    expect(html).toContain(".status.timeout");
  });
});

describe("Renderer metadata", () => {
  it("getRenderer2dInfo returns version and primitive mapping", () => {
    const info = getRenderer2dInfo();
    expect(info.rendererId).toBe("canvas2d");
    expect(info.version).toBe(RENDERER_2D_VERSION);
    expect(info.primitiveMapping).toBeDefined();
    expect(info.primitiveMapping.player).toContain("green");
    expect(info.primitiveMapping.enemy).toContain("red");
    expect(info.primitiveMapping.collectible).toContain("gold");
  });

  it("RENDERER_2D_VERSION is a non-empty string", () => {
    expect(RENDERER_2D_VERSION).toBeTruthy();
    expect(typeof RENDERER_2D_VERSION).toBe("string");
  });
});

describe("render2dHtml — HTML escaping", () => {
  it("escapes HTML in prototypeId to prevent script injection", () => {
    const html = render2dHtml(minimalIR(), '<script>alert(1)</script>');
    // The prototypeId is embedded via safeJsonForScript which escapes < >
    // to \u003c \u003e, preventing </script> breakout.
    expect(html).not.toContain('"<script>alert(1)</script>"');
    expect(html).toContain("\\u003cscript\\u003e");
  });

  it("escapes HTML in IR data (e.g., assumption strings)", () => {
    const ir = makeIR({ assumptions: ["<script>bad</script>"] });
    const html = render2dHtml(ir, "safe-id");
    expect(html).not.toContain("<script>bad</script>");
    expect(html).toContain("\\u003cscript\\u003e");
  });
});
