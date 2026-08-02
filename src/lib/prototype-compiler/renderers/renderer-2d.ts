/**
 * 2D renderer — generates direct, playable Canvas2D HTML.
 *
 * Unlike the previous over-engineered approach (which inlined a full
 * runtime engine + IR JSON), this renderer reads the PrototypeIR and
 * generates DIRECT game code — simple, readable, and actually playable.
 *
 * Inspired by the example prototypes (prot1.html, pro2.html):
 * - Direct game loop (update + draw + requestAnimationFrame)
 * - Simple state management (no ECS abstraction at runtime)
 * - Canvas2D with emoji rendering for entities
 * - Keyboard input (WASD + arrows)
 * - AABB collision detection
 * - Score, game over, restart
 *
 * The IR is still the source of truth — the renderer maps IR semantics
 * to direct code. But the generated HTML has no runtime abstraction.
 */

import type { PrototypeIR, EntityRole } from "../ir/types";

const RENDERER_VERSION = "2d-direct-2.0.0";

interface RendererEntity {
  id: string;
  role: EntityRole;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  health: number | null;
  maxHealth: number | null;
  alive: boolean;
}

interface GameConfig {
  width: number;
  height: number;
  hasLocomotion: boolean;
  hasCollect: boolean;
  hasCombat: boolean;
  hasSurvival: boolean;
  playerSpeed: number;
  enemySpeed: number;
  enemyDamage: number;
  enemyHealth: number;
  collectibleValue: number;
  healthMax: number;
  goalScore: number;
  goalText: string;
  resourceName: string;
  resourceIcon: string;
  seed: string;
}

/**
 * Generate a self-contained, playable HTML file from a PrototypeIR.
 */
export function render2dHtml(ir: PrototypeIR, prototypeId: string): string {
  const config = deriveGameConfig(ir);
  const entities = initEntities(ir, config);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${escapeHtml(ir.source.projectId)} — Prototype</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #111; display: flex; justify-content: center; align-items: center; min-height: 100vh; overflow: hidden; font-family: system-ui, sans-serif; }
  canvas { image-rendering: pixelated; width: 100%; max-width: ${config.width}px; background: #0a0a1a; border-radius: 4px; }
</style>
</head>
<body>
<canvas id="game" width="${config.width}" height="${config.height}"></canvas>
<script>
const PROTOTYPE_ID = ${JSON.stringify(prototypeId)};
const W = ${config.width}, H = ${config.height};
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// === Config ===
const CFG = ${JSON.stringify(config)};

// === Game state ===
let gameActive = true;
let gameWon = false;
let score = 0;
let health = CFG.healthMax;
let timeLeft = ${ir.session.targetDurationSec};
let lastTime = performance.now();
let timerAccum = 0;

// === Entities ===
let player = ${JSON.stringify(entities.player)};
let enemies = ${JSON.stringify(entities.enemies)};
let collectibles = ${JSON.stringify(entities.collectibles)};
let hazards = ${JSON.stringify(entities.hazards)};

// === Input ===
const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// === Helpers ===
function rectCollide(a, b) {
  return Math.abs(a.x - b.x) < (a.size + b.size) / 2 &&
         Math.abs(a.y - b.y) < (a.size + b.size) / 2;
}

function randomPos(margin) {
  return {
    x: margin + Math.random() * (W - 2 * margin),
    y: margin + Math.random() * (H - 2 * margin)
  };
}

function spawnCollectible() {
  const pos = randomPos(30);
  collectibles.push({
    id: 'star-' + Date.now(),
    role: 'collectible',
    x: pos.x, y: pos.y, vx: 0, vy: 0,
    size: 12, health: null, maxHealth: null, alive: true,
    time: Math.random() * Math.PI * 2
  });
}

function spawnEnemy() {
  const pos = randomPos(40);
  const angle = Math.random() * Math.PI * 2;
  const speed = CFG.enemySpeed * (0.8 + Math.random() * 0.4);
  enemies.push({
    id: 'enemy-' + Date.now(),
    role: 'enemy',
    x: pos.x, y: pos.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 14, health: CFG.enemyHealth, maxHealth: CFG.enemyHealth, alive: true
  });
}

function resetGame() {
  gameActive = true;
  gameWon = false;
  score = 0;
  health = CFG.healthMax;
  timeLeft = ${ir.session.targetDurationSec};
  timerAccum = 0;
  player = ${JSON.stringify(entities.player)};
  enemies = ${JSON.stringify(entities.enemies)};
  collectibles = ${JSON.stringify(entities.collectibles)};
  hazards = ${JSON.stringify(entities.hazards)};
}

// === Update ===
function update(dt) {
  if (!gameActive) return;

  // Timer
  timerAccum += dt;
  if (timerAccum >= 1) {
    timeLeft--;
    timerAccum -= 1;
    if (timeLeft <= 0) {
      gameActive = false;
      gameWon = score >= CFG.goalScore;
    }
  }

  // Player movement
  player.vx = 0;
  player.vy = 0;
  if (CFG.hasLocomotion) {
    if (keys['ArrowRight'] || keys['KeyD']) player.vx = CFG.playerSpeed;
    if (keys['ArrowLeft'] || keys['KeyA']) player.vx = -CFG.playerSpeed;
    if (keys['ArrowUp'] || keys['KeyW']) player.vy = -CFG.playerSpeed;
    if (keys['ArrowDown'] || keys['KeyS']) player.vy = CFG.playerSpeed;
  }
  player.x += player.vx * dt * 60;
  player.y += player.vy * dt * 60;
  player.x = Math.max(player.size/2, Math.min(W - player.size/2, player.x));
  player.y = Math.max(player.size/2, Math.min(H - player.size/2, player.y));

  // Enemies: move + bounce
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.x += enemy.vx * dt * 60;
    enemy.y += enemy.vy * dt * 60;
    if (enemy.x < enemy.size/2 || enemy.x > W - enemy.size/2) { enemy.vx *= -1; enemy.x = Math.max(enemy.size/2, Math.min(W - enemy.size/2, enemy.x)); }
    if (enemy.y < enemy.size/2 || enemy.y > H - enemy.size/2) { enemy.vy *= -1; enemy.y = Math.max(enemy.size/2, Math.min(H - enemy.size/2, enemy.y)); }
  }

  // Collectibles: pulse
  for (const c of collectibles) {
    if (c.time !== undefined) c.time += dt * 4;
  }

  // Collisions: player vs collectibles
  for (let i = collectibles.length - 1; i >= 0; i--) {
    if (!collectibles[i].alive) continue;
    if (rectCollide(player, collectibles[i])) {
      score += CFG.collectibleValue;
      collectibles[i].alive = false;
      collectibles.splice(i, 1);
      if (CFG.hasCollect) spawnCollectible();
      // Check win
      if (score >= CFG.goalScore) {
        gameActive = false;
        gameWon = true;
      }
    }
  }

  // Collisions: player vs enemies (damage)
  if (CFG.hasCombat) {
    for (const enemy of enemies) {
      if (!enemy.alive) continue;
      if (rectCollide(player, enemy)) {
        health -= CFG.enemyDamage * dt * 2;
        if (health <= 0) {
          health = 0;
          gameActive = false;
          gameWon = false;
        }
      }
    }
  }

  // Collisions: player vs hazards (damage)
  if (CFG.hasSurvival) {
    for (const hazard of hazards) {
      if (rectCollide(player, hazard)) {
        health -= CFG.hazardDamage * dt * 2;
        if (health <= 0) {
          health = 0;
          gameActive = false;
          gameWon = false;
        }
      }
    }
  }
}

// === Draw ===
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a2e');
  grad.addColorStop(1, '#1a1a3e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = '#1a1a3e';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Hazards
  if (CFG.hasSurvival) {
    for (const h of hazards) {
      const pulse = 1 + 0.15 * Math.sin(Date.now() / 200);
      ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.size * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Collectibles
  for (const c of collectibles) {
    if (!c.alive) continue;
    const pulse = 1 + 0.1 * Math.sin(c.time || 0);
    ctx.font = Math.floor(16 * pulse) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(CFG.resourceIcon, c.x, c.y);
  }

  // Enemies
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(enemy.x - enemy.size/2, enemy.y - enemy.size/2, enemy.size, enemy.size);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👾', enemy.x, enemy.y);
    // Health bar
    if (enemy.health !== null && enemy.maxHealth && enemy.health < enemy.maxHealth) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(enemy.x - 15, enemy.y - 18, 30, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(enemy.x - 15, enemy.y - 18, 30 * (enemy.health / enemy.maxHealth), 4);
    }
  }

  // Player
  if (gameActive) {
    ctx.fillStyle = '#3399ff';
    ctx.fillRect(player.x - player.size/2, player.y - player.size/2, player.size, player.size);
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😎', player.x, player.y);
  }

  // HUD
  ctx.fillStyle = 'white';
  ctx.font = '14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(CFG.resourceIcon + ' ' + CFG.resourceName + ': ' + score + ' / ' + CFG.goalScore, 10, 20);
  if (CFG.hasCombat || CFG.hasSurvival) {
    ctx.fillStyle = health > 50 ? '#22c55e' : health > 25 ? '#fbbf24' : '#ef4444';
    ctx.fillText('❤️ HP: ' + Math.ceil(health), 10, 40);
  }
  ctx.fillStyle = 'white';
  ctx.textAlign = 'right';
  ctx.fillText('⏱ ' + timeLeft + 's', W - 10, 20);

  // Controls hint
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.fillText('WASD/Стрелки — движение' + (CFG.hasCombat ? ' | Избегай врагов' : ''), 10, H - 10);

  // Game over / win screen
  if (!gameActive) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, H/2 - 50, W, 100);
    ctx.fillStyle = gameWon ? '#22c55e' : '#ef4444';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(gameWon ? '🎉 Победа!' : '💀 Поражение', W/2, H/2 - 10);
    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(CFG.resourceName + ': ' + score + ' / ' + CFG.goalScore, W/2, H/2 + 15);
    ctx.fillText('Нажми Enter для рестарта', W/2, H/2 + 40);

    // Send telemetry to parent
    if (window.parent && window.parent !== window) {
      try {
        window.parent.postMessage({
          type: 'gidede-playtest',
          prototypeId: PROTOTYPE_ID,
          event: 'session_end',
          status: gameWon ? 'win' : 'lose',
          data: { score: score, timeLeft: timeLeft }
        }, '*');
      } catch(e) {}
    }
  }
}

// === Game loop ===
function gameLoop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  if (gameActive) {
    requestAnimationFrame(gameLoop);
  } else {
    // Keep drawing for the game-over screen + restart listener
    requestAnimationFrame(gameLoop);
  }
}

// === Restart ===
window.addEventListener('keydown', function(e) {
  if (e.code === 'Enter' && !gameActive) {
    resetGame();
    e.preventDefault();
  }
});

// Send session_start telemetry
if (window.parent && window.parent !== window) {
  try {
    window.parent.postMessage({
      type: 'gidede-playtest',
      prototypeId: PROTOTYPE_ID,
      event: 'session_start',
      data: { goal: CFG.goalScore, duration: ${ir.session.targetDurationSec} }
    }, '*');
  } catch(e) {}
}

// Start
requestAnimationFrame(gameLoop);
</script>
</body>
</html>`;
}

// ============================================================
// Config derivation
// ============================================================

function deriveGameConfig(ir: PrototypeIR): GameConfig {
  const bounds = ir.scene.bounds;
  const width = Math.round(bounds.halfExtents.x * 2);
  const height = Math.round(bounds.halfExtents.y * 2);

  // Detect which adapters contributed to the IR.
  const adapterIds = ir.mechanicBindings
    .map((b) => b.adapterId)
    .filter((id): id is string => id !== null);

  const hasLocomotion = adapterIds.includes("locomotion");
  const hasCollect = adapterIds.includes("collect");
  const hasCombat = adapterIds.includes("target/combat");
  const hasSurvival = adapterIds.includes("avoid/survive");

  // Extract speeds from systems config.
  const movementSystem = ir.systems.find((s) => s.kind === "movement");
  const playerSpeed = (movementSystem?.config.speed as number) ?? 200;

  const targetingSystem = ir.systems.find((s) => s.kind === "targeting");
  const enemySpeed = (targetingSystem?.config.enemySpeed as number) ?? 60;

  const combatSystem = ir.systems.find((s) => s.kind === "combat");
  const enemyDamage = (combatSystem?.config.enemyDamage as number) ?? 12;
  const enemyHealth = 40;

  const collectSystem = ir.systems.find((s) => s.kind === "collect");
  const collectibleValue = (collectSystem?.config.valuePerCollectible as number) ?? 3;

  // Find health resource (from survival adapter).
  const healthResource = ir.resources.find((r) => r.name === "Health");
  const healthMax = healthResource?.max ?? 100;

  // Find the core resource (for score).
  const coreResource = ir.resources.find((r) => r.class === "core");
  const resourceName = coreResource?.name ?? "Score";
  const resourceIcon = coreResource?.icon ?? "⭐";

  // Goal score: 10 collectibles worth collectibleValue each, or derived from objectives.
  const goalScore = Math.max(10, collectibleValue * 7);

  // Goal text from IR.
  const goalText = `Соберите ${goalScore} ${resourceName.toLowerCase()} за ${ir.session.targetDurationSec} секунд`;

  return {
    width: Math.min(width, 800),
    height: Math.min(height, 600),
    hasLocomotion,
    hasCollect,
    hasCombat,
    hasSurvival,
    playerSpeed: playerSpeed / 60, // convert to per-frame at 60fps
    enemySpeed: enemySpeed / 60,
    enemyDamage,
    enemyHealth,
    collectibleValue,
    healthMax,
    goalScore,
    goalText,
    resourceName,
    resourceIcon,
    hazardDamage: 10,
    seed: ir.seed,
  };
}

// ============================================================
// Entity initialization
// ============================================================

function initEntities(
  ir: PrototypeIR,
  config: GameConfig,
): {
  player: RendererEntity;
  enemies: RendererEntity[];
  collectibles: RendererEntity[];
  hazards: RendererEntity[];
} {
  // Find player from IR entities.
  const playerSpec = ir.entities.find((e) => e.role === "player");
  const playerPos = extractPosition(playerSpec);
  const player: RendererEntity = {
    id: "player",
    role: "player",
    x: playerPos.x + config.width / 2,
    y: playerPos.y + config.height / 2,
    vx: 0,
    vy: 0,
    size: 14,
    health: config.healthMax,
    maxHealth: config.healthMax,
    alive: true,
  };

  // Collectibles from IR.
  const collectibles: RendererEntity[] = [];
  const collectibleSpecs = ir.entities.filter((e) => e.role === "collectible");
  for (const spec of collectibleSpecs) {
    const pos = extractPosition(spec);
    collectibles.push({
      id: spec.id,
      role: "collectible",
      x: pos.x + config.width / 2,
      y: pos.y + config.height / 2,
      vx: 0,
      vy: 0,
      size: 12,
      health: null,
      maxHealth: null,
      alive: true,
      time: Math.random() * Math.PI * 2,
    } as RendererEntity & { time: number });
  }
  // Ensure at least 5 collectibles.
  while (collectibles.length < 5) {
    collectibles.push({
      id: `auto-star-${collectibles.length}`,
      role: "collectible",
      x: 40 + Math.random() * (config.width - 80),
      y: 40 + Math.random() * (config.height - 80),
      vx: 0, vy: 0, size: 12,
      health: null, maxHealth: null, alive: true,
      time: Math.random() * Math.PI * 2,
    } as RendererEntity & { time: number });
  }

  // Enemies from IR.
  const enemies: RendererEntity[] = [];
  if (config.hasCombat) {
    const enemySpecs = ir.entities.filter((e) => e.role === "enemy");
    for (const spec of enemySpecs) {
      const pos = extractPosition(spec);
      const healthComp = spec.components.find((c) => c.kind === "health");
      const hp = healthComp?.kind === "health" ? healthComp.data.max : config.enemyHealth;
      enemies.push({
        id: spec.id,
        role: "enemy",
        x: pos.x + config.width / 2,
        y: pos.y + config.height / 2,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 14,
        health: hp,
        maxHealth: hp,
        alive: true,
      });
    }
    // Ensure at least 3 enemies.
    while (enemies.length < 3) {
      enemies.push({
        id: `auto-enemy-${enemies.length}`,
        role: "enemy",
        x: 60 + Math.random() * (config.width - 120),
        y: 60 + Math.random() * (config.height - 120),
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: 14,
        health: config.enemyHealth,
        maxHealth: config.enemyHealth,
        alive: true,
      });
    }
  }

  // Hazards from IR.
  const hazards: RendererEntity[] = [];
  if (config.hasSurvival) {
    const hazardSpecs = ir.entities.filter((e) => e.role === "hazard");
    for (const spec of hazardSpecs) {
      const pos = extractPosition(spec);
      hazards.push({
        id: spec.id,
        role: "hazard",
        x: pos.x + config.width / 2,
        y: pos.y + config.height / 2,
        vx: 0, vy: 0, size: 24,
        health: null, maxHealth: null, alive: true,
      });
    }
    // Ensure at least 3 hazards.
    while (hazards.length < 3) {
      hazards.push({
        id: `auto-hazard-${hazards.length}`,
        role: "hazard",
        x: 80 + Math.random() * (config.width - 160),
        y: 80 + Math.random() * (config.height - 160),
        vx: 0, vy: 0, size: 24,
        health: null, maxHealth: null, alive: true,
      });
    }
  }

  return { player, enemies, collectibles, hazards };
}

function extractPosition(entity: unknown): { x: number; y: number } {
  if (!entity || typeof entity !== "object") return { x: 0, y: 0 };
  const spec = entity as { components?: Array<{ kind: string; data?: unknown }> };
  const transform = spec.components?.find((c) => c.kind === "transform");
  if (transform?.data && typeof transform.data === "object") {
    const data = transform.data as { position?: { x: number; y: number } };
    return data.position ?? { x: 0, y: 0 };
  }
  return { x: 0, y: 0 };
}

// ============================================================
// Helpers
// ============================================================

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

export const RENDERER_2D_VERSION = RENDERER_VERSION;
