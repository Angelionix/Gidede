/**
 * 2D renderer adapter — Canvas2D.
 *
 * Reads PrototypeIR + runtime state, produces a self-contained HTML
 * file that runs the prototype in the browser. The HTML contains:
 * - the PrototypeIR as JSON (embedded)
 * - a Canvas2D renderer that reads the shared runtime
 * - input handlers (keyboard, mouse, touch)
 *
 * Design spec: docs/PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md (section 8, step 9)
 *
 * Primitive mapping (semantic role → 2D shape):
 *   player        → green circle
 *   enemy         → red circle
 *   collectible   → gold diamond
 *   obstacle      → gray rectangle
 *   projectile    → small yellow circle
 *   hazard        → orange pulsing circle
 *   base          → blue rectangle
 *   goal          → blue diamond
 *   interaction_zone → outlined circle
 *   spawner       → purple square
 *
 * Color encodes role, not genre. This is a design spec requirement.
 */

import type { PrototypeIR } from "../ir/types";
import type { EntityRole } from "../ir/types";

const RENDERER_VERSION = "2d-canvas-1.0.0";

// ============================================================
// Color palette (by role)
// ============================================================

const ROLE_COLORS: Record<EntityRole, string> = {
  player: "#22c55e",          // green
  enemy: "#ef4444",            // red
  collectible: "#fbbf24",      // gold
  obstacle: "#6b7280",         // gray
  projectile: "#facc15",       // yellow
  interaction_zone: "#8b5cf6", // purple (outlined)
  base: "#3b82f6",             // blue
  goal: "#06b6d4",             // cyan
  hazard: "#f97316",           // orange
  spawner: "#a855f7",          // purple
};

// ============================================================
// HTML generation
// ============================================================

/**
 * Generate a self-contained HTML file that runs the prototype in 2D.
 *
 * The HTML embeds:
 * 1. The PrototypeIR as JSON
 * 2. The runtime engine code (inlined, since the browser can't import TS)
 * 3. A Canvas2D renderer
 * 4. Input handlers
 *
 * The runtime is a simplified JS port of the TS engine — enough to
 * execute the IR in the browser.
 */
export function render2dHtml(ir: PrototypeIR, prototypeId: string): string {
  const irJson = safeJsonForScript(JSON.stringify(ir));
  const safeProtoId = safeJsonForScript(JSON.stringify(prototypeId));
  const bounds = ir.scene.bounds;
  const canvasWidth = (bounds.halfExtents.x * 2) + 40; // padding
  const canvasHeight = (bounds.halfExtents.y * 2) + 40;

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>Prototype ${escapeHtml(prototypeId)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0f172a; color: #e2e8f0; font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 16px; }
  h1 { font-size: 18px; margin-bottom: 8px; }
  .hud { display: flex; gap: 16px; margin-bottom: 12px; font-size: 14px; flex-wrap: wrap; }
  .hud-item { background: #1e293b; padding: 6px 12px; border-radius: 6px; }
  .hud-value { font-weight: bold; color: #fbbf24; }
  canvas { border: 2px solid #334155; border-radius: 8px; background: #1e293b; max-width: 100%; height: auto; }
  .controls { margin-top: 12px; font-size: 13px; color: #94a3b8; text-align: center; }
  .status { margin-top: 8px; font-size: 16px; font-weight: bold; }
  .status.won { color: #22c55e; }
  .status.lost { color: #ef4444; }
  .status.timeout { color: #f97316; }
</style>
</head>
<body>
<h1>🎮 ${escapeHtml(ir.scene.topology)} prototype</h1>
<div class="hud" id="hud"></div>
<canvas id="game" width="${canvasWidth}" height="${canvasHeight}"></canvas>
<div class="controls" id="controls"></div>
<div class="status" id="status"></div>

<script>
// === PrototypeIR (embedded) ===
const IR = ${irJson};
const PROTOTYPE_ID = ${safeProtoId};
const RENDERER_VERSION = ${JSON.stringify(RENDERER_VERSION)};

// === Runtime (JS port of PrototypeRuntimeEngine) ===
${RUNTIME_JS}

// === 2D Renderer ===
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const hudEl = document.getElementById('hud');
const statusEl = document.getElementById('status');
const controlsEl = document.getElementById('controls');

const OFFSET_X = canvas.width / 2;
const OFFSET_Y = canvas.height / 2;

const ROLE_COLORS = ${JSON.stringify(ROLE_COLORS)};

function drawEntity(entity) {
  const x = entity.position.x + OFFSET_X;
  const y = entity.position.y + OFFSET_Y;
  const color = ROLE_COLORS[entity.role] || '#ffffff';

  ctx.save();
  ctx.translate(x, y);

  if (entity.role === 'player') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    // Direction indicator
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(entity.rotation) * 20, Math.sin(entity.rotation) * 20);
    ctx.stroke();
  } else if (entity.role === 'enemy') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();
    // Health bar
    if (entity.health !== null && entity.maxHealth !== null) {
      const pct = entity.health / entity.maxHealth;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-20, -28, 40, 6);
      ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#fbbf24' : '#ef4444';
      ctx.fillRect(-20, -28, 40 * pct, 6);
    }
  } else if (entity.role === 'collectible') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 12);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (entity.role === 'hazard') {
    const pulse = 1 + Math.sin(Date.now() / 200) * 0.15;
    ctx.fillStyle = color + '80'; // semi-transparent
    ctx.beginPath();
    ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (entity.role === 'obstacle') {
    ctx.fillStyle = color;
    ctx.fillRect(-30, -10, 60, 20);
  } else if (entity.role === 'base') {
    ctx.fillStyle = color;
    ctx.fillRect(-20, -40, 40, 80);
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.strokeRect(-20, -40, 40, 80);
  } else {
    // Default: small circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawBounds() {
  const b = IR.scene.bounds;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(
    b.center.x - b.halfExtents.x + OFFSET_X,
    b.center.y - b.halfExtents.y + OFFSET_Y,
    b.halfExtents.x * 2,
    b.halfExtents.y * 2,
  );
}

function updateHud() {
  let html = '';
  for (const [id, value] of engine.state.resources) {
    const meta = engine.state.resourceMeta.get(id);
    const name = meta ? meta.name : id;
    const icon = meta ? meta.icon || '' : '';
    html += '<div class="hud-item">' + icon + ' ' + escapeHtml(name) + ': <span class="hud-value">' + value + '</span></div>';
  }
  html += '<div class="hud-item">⏱ ' + engine.state.elapsedSec.toFixed(1) + 's</div>';
  html += '<div class="hud-item">🔄 Loop: <span class="hud-value">' + engine.state.loopCount + '</span></div>';
  if (engine.state.currentStepId) {
    html += '<div class="hud-item">📍 Step: ' + escapeHtml(engine.state.currentStepId) + '</div>';
  }
  hudEl.innerHTML = html;
}

function updateStatus() {
  const status = engine.getStatus();
  statusEl.className = 'status ' + status;
  if (status === 'won') statusEl.textContent = '🎉 Победа!';
  else if (status === 'lost') statusEl.textContent = '💀 Поражение';
  else if (status === 'timeout') statusEl.textContent = '⏰ Время вышло';
  else statusEl.textContent = '';
}

function updateControls() {
  const controls = [];
  for (const c of IR.controls) {
    if (c.binding.kind === 'keyboard') {
      controls.push(c.action + ': ' + c.binding.keys.join('+'));
    } else if (c.binding.kind === 'pointer') {
      controls.push(c.action + ': mouse');
    } else if (c.binding.kind === 'touch_stick') {
      controls.push(c.action + ': touch');
    }
  }
  controlsEl.textContent = controls.join(' | ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// === Input ===
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  engine.input({ action: 'primary_action', timestamp: engine.state.elapsedSec });
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width) - OFFSET_X;
  const y = (e.clientY - rect.top) * (canvas.height / rect.height) - OFFSET_Y;
  engine.input({ action: 'aim', position: { x, y }, timestamp: engine.state.elapsedSec });
});

canvas.addEventListener('click', (e) => {
  engine.input({ action: 'primary_action', timestamp: engine.state.elapsedSec });
});

// Touch support
let touchActive = false;
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touchActive = true;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = (touch.clientX - rect.left) * (canvas.width / rect.width) - OFFSET_X;
  const y = (touch.clientY - rect.top) * (canvas.height / rect.height) - OFFSET_Y;
  engine.input({ action: 'move', position: { x, y }, timestamp: engine.state.elapsedSec });
});
canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!touchActive) return;
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  const x = (touch.clientX - rect.left) * (canvas.width / rect.width) - OFFSET_X;
  const y = (touch.clientY - rect.top) * (canvas.height / rect.height) - OFFSET_Y;
  engine.input({ action: 'move', position: { x, y }, timestamp: engine.state.elapsedSec });
});
canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  touchActive = false;
});

// === Main loop ===
const engine = new PrototypeRuntimeEngine(IR);
let lastTime = performance.now();

function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Apply keyboard movement.
  const player = engine.getEntities().find((e) => e.role === 'player');
  if (player) {
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy -= 1;
    if (keys['s'] || keys['arrowdown']) dy += 1;
    if (keys['a'] || keys['arrowleft']) dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      const movementSystem = IR.systems.find((s) => s.kind === 'movement');
      const speed = movementSystem ? (movementSystem.config.speed || 200) : 200;
      const targetX = player.position.x + (dx / len) * speed;
      const targetY = player.position.y + (dy / len) * speed;
      engine.input({ action: 'move', position: { x: targetX, y: targetY }, timestamp: engine.state.elapsedSec });
    }
  }

  // Run fixed steps.
  const stepsToRun = Math.min(5, Math.floor(dt / (1 / 60)));
  for (let i = 0; i < stepsToRun; i++) {
    if (engine.getStatus() !== 'running') break;
    engine.tick();
  }

  // Render.
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawBounds();
  for (const entity of engine.getEntities()) {
    if (entity.alive) drawEntity(entity);
  }
  updateHud();
  updateStatus();
  updateControls();

  // Drain telemetry and forward to parent (for playtest tracking).
  const telemetry = engine.drainTelemetry();
  for (const t of telemetry) {
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({ type: 'gidede-playtest', prototypeId: PROTOTYPE_ID, ...t }, '*');
      } catch (e) { /* ignore */ }
    }
  }

  if (engine.getStatus() === 'running') {
    requestAnimationFrame(loop);
  } else {
    // Final render + send final status.
    setTimeout(() => {
      if (window.parent && window.parent !== window) {
        try {
          window.parent.postMessage({
            type: 'gidede-playtest',
            prototypeId: PROTOTYPE_ID,
            event: 'session_end',
            status: engine.getStatus(),
            data: { loopCount: engine.state.loopCount, elapsedSec: engine.state.elapsedSec },
          }, '*');
        } catch (e) { /* ignore */ }
      }
    }, 500);
  }
}

requestAnimationFrame(loop);
</script>
</body>
</html>`;
}

// ============================================================
// Renderer metadata
// ============================================================

export const RENDERER_2D_VERSION = RENDERER_VERSION;

export function getRenderer2dInfo() {
  return {
    rendererId: "canvas2d",
    version: RENDERER_VERSION,
    primitiveMapping: {
      player: "green circle",
      enemy: "red circle + health bar",
      collectible: "gold diamond",
      obstacle: "gray rectangle",
      projectile: "small yellow circle",
      hazard: "orange pulsing circle",
      base: "blue rectangle",
      goal: "cyan diamond",
      interaction_zone: "outlined purple circle",
      spawner: "purple square",
    },
  };
}

// ============================================================
// Helpers
// ============================================================

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

/**
 * Make a JSON string safe to embed inside a <script> tag.
 * JSON.stringify does not escape `<` or `>`, which allows `</script>` in
 * the data to break out of the script context. This replaces `<` with
 * `\u003c` to prevent script injection.
 */
function safeJsonForScript(jsonString: string): string {
  return jsonString
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

// ============================================================
// Inlined runtime JS (browser port)
// ============================================================

/**
 * This is a JS port of the TypeScript runtime engine, inlined into the
 * generated HTML. It's a simplified version that supports the core
 * operations needed for browser execution: PRNG, predicate evaluation,
 * state mutation, tick loop.
 *
 * Kept in sync with src/lib/prototype-compiler/runtime/engine.ts.
 */
const RUNTIME_JS = `
function createMulberry32(seed) {
  let a = 0;
  for (let i = 0; i < seed.length; i++) {
    a = Math.imul(a ^ seed.charCodeAt(i), 16777619);
  }
  a = a >>> 0;
  return function() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function evaluatePredicate(predicate, state) {
  switch (predicate.kind) {
    case 'resource_gte': return (state.resources.get(predicate.resourceId) || 0) >= predicate.value;
    case 'resource_lte': return (state.resources.get(predicate.resourceId) || 0) <= predicate.value;
    case 'step_completed': return state.completedSteps.has(predicate.stepId);
    case 'loop_count_gte': return state.loopCount >= predicate.value;
    case 'time_elapsed_gte': return state.elapsedSec >= predicate.seconds;
    case 'entity_count_lte': {
      let count = 0;
      for (const e of state.entities.values()) { if (e.role === predicate.roleId) count++; }
      return count <= predicate.value;
    }
    case 'and': return predicate.predicates.every(p => evaluatePredicate(p, state));
    case 'or': return predicate.predicates.some(p => evaluatePredicate(p, state));
    case 'not': return !evaluatePredicate(predicate.predicate, state);
    default: return false;
  }
}

const FIXED_DT = 1 / 60;
const MAX_ENTITIES = 200;
const MAX_RULES_PER_TICK = 50;

class PrototypeRuntimeEngine {
  constructor(ir) {
    this.ir = ir;
    this.prng = createMulberry32(ir.seed);
    this.state = {
      elapsedSec: 0, tick: 0, loopCount: 0,
      currentStepId: null, completedSteps: new Set(),
      resources: new Map(), resourceMeta: new Map(),
      entities: new Map(), pendingInputs: [],
      telemetry: [], status: 'running', started: false, lastInputAt: 0,
    };
    this._initialize();
  }

  _initialize() {
    for (const res of this.ir.resources) {
      this.state.resources.set(res.id, res.initialValue);
      this.state.resourceMeta.set(res.id, {
        id: res.id, name: res.name, value: res.initialValue,
        min: res.min, max: res.max, class: res.class,
      });
    }
    for (const entity of this.ir.entities) {
      if (entity.spawnSchedule === null) this._spawnEntity(entity);
    }
    if (this.ir.stepMachine.length > 0) {
      this.state.currentStepId = this.ir.stepMachine[0].id;
    }
    this.state.started = true;
    this._emit('session_start', {});
  }

  _spawnEntity(spec) {
    if (this.state.entities.size >= MAX_ENTITIES) return;
    let position = { x: 0, y: 0 }, rotation = 0, health = null, maxHealth = null, team = null;
    for (const comp of spec.components) {
      if (comp.kind === 'transform') { position = comp.data.position; rotation = comp.data.rotation; }
      else if (comp.kind === 'health') { health = comp.data.current; maxHealth = comp.data.max; }
      else if (comp.kind === 'team') { team = comp.data.teamId; }
    }
    this.state.entities.set(spec.id, {
      id: spec.id, deterministicId: spec.deterministicId, role: spec.role,
      position, rotation, velocity: { x: 0, y: 0 },
      health, maxHealth, team, cooldownEndsAt: null, alive: true, spawnedAt: this.state.elapsedSec,
    });
  }

  input(event) {
    this.state.pendingInputs.push(event);
    this.state.lastInputAt = this.state.elapsedSec;
    this._emit('input_action', { action: event.action, position: event.position });
  }

  tick() {
    if (this.state.status !== 'running') return;
    const maxTicks = this.ir.session.targetDurationSec * 60 * 2;
    if (this.state.tick >= maxTicks) {
      this.state.status = 'timeout';
      this._emit('timeout', { tick: this.state.tick });
      return;
    }
    this.state.tick++;
    this.state.elapsedSec = this.state.tick * FIXED_DT;
    this._processInputs();
    this._updateSystems();
    this._fireRules();
    this._updateStepMachine();
    this._checkConditions();
    this.state.pendingInputs = [];
  }

  _processInputs() {
    for (const input of this.state.pendingInputs) {
      if (input.action === 'move') {
        const player = this._getPlayer();
        if (player && input.position) {
          const dx = input.position.x - player.position.x;
          const dy = input.position.y - player.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 1) {
            const ms = this.ir.systems.find(s => s.kind === 'movement');
            const speed = (ms && ms.config.speed) || 200;
            player.velocity.x = (dx / dist) * speed;
            player.velocity.y = (dy / dist) * speed;
          } else { player.velocity.x = 0; player.velocity.y = 0; }
        }
      }
    }
  }

  _updateSystems() {
    for (const entity of this.state.entities.values()) {
      if (entity.velocity.x !== 0 || entity.velocity.y !== 0) {
        entity.position.x += entity.velocity.x * FIXED_DT;
        entity.position.y += entity.velocity.y * FIXED_DT;
        const b = this.ir.scene.bounds;
        entity.position.x = Math.max(b.center.x - b.halfExtents.x, Math.min(b.center.x + b.halfExtents.x, entity.position.x));
        entity.position.y = Math.max(b.center.y - b.halfExtents.y, Math.min(b.center.y + b.halfExtents.y, entity.position.y));
        entity.velocity.x *= 0.92; entity.velocity.y *= 0.92;
        if (Math.abs(entity.velocity.x) < 1) entity.velocity.x = 0;
        if (Math.abs(entity.velocity.y) < 1) entity.velocity.y = 0;
      }
    }
    const player = this._getPlayer();
    if (player) {
      const ts = this.ir.systems.find(s => s.kind === 'targeting');
      if (ts) {
        const es = ts.config.enemySpeed || 60;
        for (const e of this.state.entities.values()) {
          if (e.role === 'enemy' && e.alive) {
            const dx = player.position.x - e.position.x;
            const dy = player.position.y - e.position.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 1) { e.velocity.x = (dx / d) * es; e.velocity.y = (dy / d) * es; }
          }
        }
      }
      this._processCollisions(player);
    }
  }

  _processCollisions(player) {
    const toRemove = [];
    for (const entity of this.state.entities.values()) {
      if (entity.id === player.id || !entity.alive) continue;
      const d = Math.sqrt((entity.position.x - player.position.x) ** 2 + (entity.position.y - player.position.y) ** 2);
      if (entity.role === 'collectible' && d < 35) {
        const cs = this.ir.systems.find(s => s.kind === 'collect');
        if (cs) {
          this._applyDelta(cs.config.resourceId, cs.config.valuePerCollectible || 1);
          this._emit('mechanic_triggered', { mechanic: 'collect' });
          toRemove.push(entity.id);
        }
      }
      if ((entity.role === 'hazard' && d < 45) || (entity.role === 'enemy' && d < 40)) {
        const sys = this.ir.systems.find(s => entity.role === 'hazard' ? s.kind === 'collision' : s.kind === 'combat');
        if (sys) {
          const dmg = entity.role === 'hazard' ? sys.config.damagePerContact : sys.config.enemyDamage;
          const hpRes = Array.from(this.state.resourceMeta.values()).find(r => r.name === 'Health');
          if (hpRes && dmg) {
            if (entity.cooldownEndsAt === null || this.state.elapsedSec >= entity.cooldownEndsAt) {
              this._applyDelta(hpRes.id, -dmg);
              this._emit('damage', { amount: dmg });
              entity.cooldownEndsAt = this.state.elapsedSec + 0.5;
            }
          }
        }
      }
    }
    for (const id of toRemove) this.state.entities.delete(id);
    const hpRes = Array.from(this.state.resourceMeta.values()).find(r => r.name === 'Health');
    if (hpRes && (this.state.resources.get(hpRes.id) || 0) <= 0 && this.state.status === 'running') {
      this.state.status = 'lost';
      this._emit('death', {}); this._emit('lose', {});
    }
  }

  _fireRules() {
    let fired = 0;
    for (const rule of this.ir.rules) {
      if (fired >= MAX_RULES_PER_TICK) break;
      if (rule.trigger.kind === 'event' && this.state.telemetry.some(t => t.event === rule.trigger.eventId)) {
        if (evaluatePredicate(rule.guard, this.state)) { this._applyEffects(rule.effects); fired++; }
      }
    }
  }

  _updateStepMachine() {
    if (!this.state.currentStepId) return;
    const step = this.ir.stepMachine.find(s => s.id === this.state.currentStepId);
    if (!step) return;
    if (evaluatePredicate(step.completionPredicate, this.state)) {
      if (!this.state.completedSteps.has(step.id)) {
        this.state.completedSteps.add(step.id);
        this._emit('step_complete', { stepId: step.id });
      }
      this._applyEffects(step.effects);
      if (step.nextStepId) {
        const next = this.ir.stepMachine.find(s => s.id === step.nextStepId);
        if (next) {
          if (step.nextStepId === this.ir.stepMachine[0].id) {
            this.state.loopCount++;
            this._emit('loop_complete', { count: this.state.loopCount });
          }
          this.state.currentStepId = next.id;
          this._emit('step_enter', { stepId: next.id });
        }
      }
    }
    for (const rule of this.ir.rules) {
      if (rule.trigger.kind === 'predicate' && evaluatePredicate(rule.trigger.predicate, this.state) && evaluatePredicate(rule.guard, this.state)) {
        this._applyEffects(rule.effects);
      }
    }
  }

  _applyEffects(effects) {
    for (const effect of effects) {
      if (effect.kind === 'resource_delta') this._applyDelta(effect.resourceId, effect.delta);
      else if (effect.kind === 'set_step') { this.state.currentStepId = effect.stepId; this._emit('step_enter', { stepId: effect.stepId }); }
      else if (effect.kind === 'increment_loop_count') { this.state.loopCount++; this._emit('loop_complete', { count: this.state.loopCount }); }
      else if (effect.kind === 'reset_loop') { this.state.loopCount = 0; }
    }
  }

  _applyDelta(resourceId, delta) {
    const cur = this.state.resources.get(resourceId) || 0;
    const meta = this.state.resourceMeta.get(resourceId);
    let next = cur + delta;
    if (meta) {
      if (meta.min !== null) next = Math.max(meta.min, next);
      if (meta.max !== null) next = Math.min(meta.max, next);
    }
    this.state.resources.set(resourceId, next);
    this._emit('resource_changed', { resourceId, delta, newValue: next });
  }

  _checkConditions() {
    if (this.state.status !== 'running') return;
    if (evaluatePredicate(this.ir.session.success, this.state)) {
      this.state.status = 'won'; this._emit('win', {}); return;
    }
    for (const fail of this.ir.session.failure) {
      if (evaluatePredicate(fail, this.state)) {
        this.state.status = 'lost'; this._emit('lose', { reason: 'failure_condition' }); return;
      }
    }
  }

  _getPlayer() {
    for (const e of this.state.entities.values()) { if (e.role === 'player') return e; }
    return null;
  }

  _emit(event, data) {
    this.state.telemetry.push({ event, data, tick: this.state.tick, timestamp: this.state.elapsedSec });
  }

  getEntities() { return Array.from(this.state.entities.values()); }
  getResource(id) { return this.state.resources.get(id) || 0; }
  getElapsedSec() { return this.state.elapsedSec; }
  getStatus() { return this.state.status; }
  getCurrentStepId() { return this.state.currentStepId; }
  getLoopCount() { return this.state.loopCount; }
  drainTelemetry() { const t = this.state.telemetry; this.state.telemetry = []; return t; }
}
`;
