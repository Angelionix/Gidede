/**
 * Tests for the 3D Three.js renderer.
 *
 * Phase 2.3 acceptance criteria:
 * - Generates playable HTML with Three.js
 * - 3D primitive mapping (capsule, box, octahedron, cylinder)
 * - Camera follows player
 * - WASD movement in 3D space
 * - Score, health, timer, game over
 */

import { describe, expect, it } from "vitest";
import { render3dHtml, RENDERER_3D_VERSION } from "../renderer-3d";
import { minimalIR, makeIR } from "../../ir/__tests__/fixtures";

describe("render3dHtml — basic output", () => {
  it("produces a non-empty HTML string", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(500);
  });

  it("starts with <!DOCTYPE html>", () => {
    expect(render3dHtml(minimalIR(), "test-id").startsWith("<!DOCTYPE html>")).toBe(true);
  });

  it("loads Three.js from CDN", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toContain("/three.min.js");
  });
});

describe("render3dHtml — Three.js setup", () => {
  it("contains THREE.Scene", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("new THREE.Scene()");
  });

  it("contains PerspectiveCamera", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("PerspectiveCamera");
  });

  it("contains WebGLRenderer", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("WebGLRenderer");
  });

  it("contains lighting (AmbientLight + DirectionalLight)", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toContain("AmbientLight");
    expect(html).toContain("DirectionalLight");
  });

  it("contains ground plane", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("PlaneGeometry");
  });

  it("contains GridHelper", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("GridHelper");
  });
});

describe("render3dHtml — 3D primitives", () => {
  it("player is a CapsuleGeometry", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("CapsuleGeometry");
  });

  it("collectibles are OctahedronGeometry", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("OctahedronGeometry");
  });

  it("enemies are BoxGeometry when combat is present", () => {
    const ir = makeIR({
      mechanicBindings: [{
        sourceMechanicId: "combat",
        adapterId: "target/combat",
        adapterVersion: "1.0.0",
        resolution: "exact",
        representedByRuleIds: [],
        assumptions: [],
      }],
      systems: [{ id: "sys-combat", kind: "combat", appliesToRoles: ["player", "enemy"], config: { enemyDamage: 10 } }],
    });
    expect(render3dHtml(ir, "test-id")).toContain("BoxGeometry");
  });

  it("hazards are CylinderGeometry when survival is present", () => {
    const ir = makeIR({
      mechanicBindings: [{
        sourceMechanicId: "survival",
        adapterId: "avoid/survive",
        adapterVersion: "1.0.0",
        resolution: "exact",
        representedByRuleIds: [],
        assumptions: [],
      }],
      systems: [{ id: "sys-hazard", kind: "collision", appliesToRoles: ["player", "hazard"], config: { damagePerContact: 10 } }],
    });
    expect(render3dHtml(ir, "test-id")).toContain("CylinderGeometry");
  });
});

describe("render3dHtml — game logic", () => {
  it("contains update function", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("function update(");
  });

  it("contains camera follow logic", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("camera.position.x = player.position.x");
  });

  it("contains WASD movement", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toContain("KeyW");
    expect(html).toContain("KeyA");
    expect(html).toContain("KeyS");
    expect(html).toContain("KeyD");
  });

  it("contains collision detection", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("distance3D");
  });

  it("contains timer and score", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toContain("timeLeft");
    expect(html).toContain("score");
    expect(html).toContain("goalScore");
  });

  it("contains game over overlay", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toContain("overlay");
    expect(html).toContain("Победа");
    expect(html).toContain("Поражение");
  });

  it("contains Enter for restart", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("Enter");
  });

  it("contains resize handler", () => {
    expect(render3dHtml(minimalIR(), "test-id")).toContain("addEventListener('resize'");
  });
});

describe("render3dHtml — telemetry", () => {
  it("contains postMessage to parent", () => {
    const html = render3dHtml(minimalIR(), "test-id");
    expect(html).toContain("window.parent.postMessage");
    expect(html).toContain("gidede-playtest");
    expect(html).toContain("session_start");
  });
});

describe("Renderer metadata", () => {
  it("RENDERER_3D_VERSION is set", () => {
    expect(RENDERER_3D_VERSION).toBeTruthy();
    expect(RENDERER_3D_VERSION).toContain("3d-three");
  });
});
