/**
 * 3D renderer — generates direct, playable Three.js HTML.
 *
 * Same approach as renderer-2d.ts: reads PrototypeIR and generates
 * DIRECT game code with Three.js for 3D rendering. No runtime abstraction.
 *
 * Primitive mapping (semantic role → 3D shape):
 *   player      → green capsule
 *   enemy       → red box
 *   collectible → gold octahedron
 *   obstacle    → gray box
 *   hazard      → orange cylinder
 *   base        → blue box
 *
 * Uses Three.js from CDN (three.min.js is available in public/).
 */

import type { PrototypeIR, EntityRole } from "../ir/types";

const RENDERER_VERSION = "3d-three-2.0.0";

interface GameConfig3D {
  hasLocomotion: boolean;
  hasCollect: boolean;
  hasCombat: boolean;
  hasSurvival: boolean;
  playerSpeed: number;
  enemySpeed: number;
  enemyDamage: number;
  collectibleValue: number;
  healthMax: number;
  goalScore: number;
  resourceName: string;
  resourceIcon: string;
  worldSize: number;
  seed: string;
}

export function render3dHtml(ir: PrototypeIR, prototypeId: string): string {
  const config = derive3DGameConfig(ir);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
<title>${escapeHtml(ir.source.projectId)} — 3D Prototype</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #111; overflow: hidden; font-family: system-ui, sans-serif; }
  canvas { display: block; }
  #hud { position: fixed; top: 0; left: 0; right: 0; padding: 12px; color: white; font-size: 14px; pointer-events: none; z-index: 10; }
  .hud-item { display: inline-block; background: rgba(0,0,0,0.6); padding: 4px 12px; border-radius: 4px; margin-right: 8px; }
  #overlay { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); text-align: center; color: white; z-index: 20; pointer-events: none; }
  #overlay h1 { font-size: 32px; margin-bottom: 8px; }
  #overlay p { font-size: 16px; opacity: 0.8; }
</style>
</head>
<body>
<div id="hud"></div>
<div id="overlay" style="display:none"></div>
<script src="/three.min.js"></script>
<script>
const PROTOTYPE_ID = ${JSON.stringify(prototypeId)};
const CFG = ${JSON.stringify(config)};

// === Three.js setup ===
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a2e);
scene.fog = new THREE.Fog(0x0a0a2e, 400, 800);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 300, 400);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

// === Lighting ===
const ambient = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, 400, 200);
scene.add(dirLight);

// === Ground ===
const groundGeo = new THREE.PlaneGeometry(CFG.worldSize * 2, CFG.worldSize * 2);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.8 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Grid helper
const grid = new THREE.GridHelper(CFG.worldSize * 2, 20, 0x334466, 0x222244);
scene.add(grid);

// === Game state ===
let gameActive = true;
let gameWon = false;
let score = 0;
let health = CFG.healthMax;
let timeLeft = ${ir.session.targetDurationSec};
let lastTime = performance.now();
let timerAccum = 0;

const keys = {};
window.addEventListener('keydown', e => { keys[e.code] = true; if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', e => { keys[e.code] = false; });

// === Entities ===
const ROLE_COLORS = {
  player: 0x22c55e, enemy: 0xef4444, collectible: 0xfbbf24,
  obstacle: 0x6b7280, hazard: 0xf97316, base: 0x3b82f6, goal: 0x06b6d4
};

function makeEntity(role, x, z, geometry) {
  const mat = new THREE.MeshStandardMaterial({ color: ROLE_COLORS[role] || 0xffffff, roughness: 0.5, metalness: 0.2 });
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, geometry === undefined ? 0 : (geometry.parameters.height || 20) / 2, z);
  mesh.userData = { role, vx: 0, vz: 0, alive: true, size: 20 };
  scene.add(mesh);
  return mesh;
}

// Player
const playerGeo = new THREE.CapsuleGeometry(15, 20, 4, 8);
const player = makeEntity('player', 0, 0, playerGeo);
player.position.y = 20;

// Collectibles
const collectibles = [];
function spawnCollectible(x, z) {
  const geo = new THREE.OctahedronGeometry(12);
  const c = makeEntity('collectible', x || (Math.random() - 0.5) * CFG.worldSize, z || (Math.random() - 0.5) * CFG.worldSize, geo);
  c.position.y = 15;
  c.userData.time = Math.random() * Math.PI * 2;
  collectibles.push(c);
}
for (let i = 0; i < 5; i++) spawnCollectible();

// Enemies
const enemies = [];
if (CFG.hasCombat) {
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.BoxGeometry(24, 24, 24);
    const e = makeEntity('enemy', (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, geo);
    e.position.y = 12;
    e.userData.vx = (Math.random() - 0.5) * 2;
    e.userData.vz = (Math.random() - 0.5) * 2;
    enemies.push(e);
  }
}

// Hazards
const hazards = [];
if (CFG.hasSurvival) {
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.CylinderGeometry(20, 20, 30, 8);
    const h = makeEntity('hazard', (Math.random() - 0.5) * 300, (Math.random() - 0.5) * 300, geo);
    h.position.y = 15;
    hazards.push(h);
  }
}

// === Helpers ===
function distance3D(a, b) {
  const dx = a.position.x - b.position.x;
  const dz = a.position.z - b.position.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function resetGame() {
  gameActive = true;
  gameWon = false;
  score = 0;
  health = CFG.healthMax;
  timeLeft = ${ir.session.targetDurationSec};
  player.position.set(0, 20, 0);
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
  if (CFG.hasLocomotion) {
    let vx = 0, vz = 0;
    if (keys['ArrowRight'] || keys['KeyD']) vx = CFG.playerSpeed;
    if (keys['ArrowLeft'] || keys['KeyA']) vx = -CFG.playerSpeed;
    if (keys['ArrowUp'] || keys['KeyW']) vz = -CFG.playerSpeed;
    if (keys['ArrowDown'] || keys['KeyS']) vz = CFG.playerSpeed;
    player.position.x += vx * dt * 60;
    player.position.z += vz * dt * 60;
    player.position.x = Math.max(-CFG.worldSize, Math.min(CFG.worldSize, player.position.x));
    player.position.z = Math.max(-CFG.worldSize, Math.min(CFG.worldSize, player.position.z));
  }

  // Camera follows player
  camera.position.x = player.position.x;
  camera.position.z = player.position.z + 300;
  camera.position.y = 250;
  camera.lookAt(player.position.x, 0, player.position.z);

  // Enemies move toward player
  for (const e of enemies) {
    if (!e.userData.alive) continue;
    const dx = player.position.x - e.position.x;
    const dz = player.position.z - e.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist > 1) {
      e.position.x += (dx / dist) * CFG.enemySpeed * dt * 60;
      e.position.z += (dz / dist) * CFG.enemySpeed * dt * 60;
    }
    e.rotation.y += dt * 2;
  }

  // Collectibles pulse
  for (const c of collectibles) {
    c.userData.time += dt * 3;
    c.position.y = 15 + Math.sin(c.userData.time) * 5;
    c.rotation.y += dt * 2;
  }

  // Collisions: player vs collectibles
  for (let i = collectibles.length - 1; i >= 0; i--) {
    if (!collectibles[i].userData.alive) continue;
    if (distance3D(player, collectibles[i]) < 30) {
      score += CFG.collectibleValue;
      collectibles[i].userData.alive = false;
      scene.remove(collectibles[i]);
      collectibles.splice(i, 1);
      if (CFG.hasCollect) spawnCollectible();
      if (score >= CFG.goalScore) {
        gameActive = false;
        gameWon = true;
      }
    }
  }

  // Collisions: player vs enemies
  if (CFG.hasCombat) {
    for (const e of enemies) {
      if (!e.userData.alive) continue;
      if (distance3D(player, e) < 30) {
        health -= CFG.enemyDamage * dt * 2;
        if (health <= 0) {
          health = 0;
          gameActive = false;
          gameWon = false;
        }
      }
    }
  }

  // Collisions: player vs hazards
  if (CFG.hasSurvival) {
    for (const h of hazards) {
      if (distance3D(player, h) < 35) {
        health -= 10 * dt * 2;
        if (health <= 0) {
          health = 0;
          gameActive = false;
          gameWon = false;
        }
      }
    }
  }
}

// === HUD ===
const hudEl = document.getElementById('hud');
const overlayEl = document.getElementById('overlay');

function updateHUD() {
  let html = '<span class="hud-item">' + CFG.resourceIcon + ' ' + CFG.resourceName + ': ' + score + ' / ' + CFG.goalScore + '</span>';
  html += '<span class="hud-item">⏱ ' + timeLeft + 's</span>';
  if (CFG.hasCombat || CFG.hasSurvival) {
    html += '<span class="hud-item">❤️ HP: ' + Math.ceil(health) + '</span>';
  }
  html += '<span class="hud-item">WASD — движение</span>';
  hudEl.innerHTML = html;

  if (!gameActive) {
    overlayEl.style.display = 'block';
    overlayEl.innerHTML = '<h1 style="color:' + (gameWon ? '#22c55e' : '#ef4444') + '">' +
      (gameWon ? '🎉 Победа!' : '💀 Поражение') + '</h1>' +
      '<p>' + CFG.resourceName + ': ' + score + ' / ' + CFG.goalScore + '</p>' +
      '<p>Нажми Enter для рестарта</p>';
  } else {
    overlayEl.style.display = 'none';
  }
}

// === Game loop ===
function animate(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  updateHUD();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// === Restart ===
window.addEventListener('keydown', function(e) {
  if (e.code === 'Enter' && !gameActive) {
    resetGame();
    e.preventDefault();
  }
});

// === Resize ===
window.addEventListener('resize', function() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// === Telemetry ===
if (window.parent && window.parent !== window) {
  try {
    window.parent.postMessage({
      type: 'gidede-playtest',
      prototypeId: PROTOTYPE_ID,
      event: 'session_start',
      data: { mode: '3d', goal: CFG.goalScore }
    }, '*');
  } catch(e) {}
}

// Start
requestAnimationFrame(animate);
</script>
</body>
</html>`;
}

function derive3DGameConfig(ir: PrototypeIR): GameConfig3D {
  const bounds = ir.scene.bounds;
  const worldSize = Math.round(Math.max(bounds.halfExtents.x, bounds.halfExtents.y));

  const adapterIds = ir.mechanicBindings
    .map((b) => b.adapterId)
    .filter((id): id is string => id !== null);

  const hasLocomotion = adapterIds.includes("locomotion");
  const hasCollect = adapterIds.includes("collect");
  const hasCombat = adapterIds.includes("target/combat");
  const hasSurvival = adapterIds.includes("avoid/survive");

  const movementSystem = ir.systems.find((s) => s.kind === "movement");
  const playerSpeed = ((movementSystem?.config.speed as number) ?? 200) / 60;

  const targetingSystem = ir.systems.find((s) => s.kind === "targeting");
  const enemySpeed = ((targetingSystem?.config.enemySpeed as number) ?? 60) / 60;

  const combatSystem = ir.systems.find((s) => s.kind === "combat");
  const enemyDamage = (combatSystem?.config.enemyDamage as number) ?? 12;

  const collectSystem = ir.systems.find((s) => s.kind === "collect");
  const collectibleValue = (collectSystem?.config.valuePerCollectible as number) ?? 3;

  const healthResource = ir.resources.find((r) => r.name === "Health");
  const healthMax = healthResource?.max ?? 100;

  const coreResource = ir.resources.find((r) => r.class === "core");
  const resourceName = coreResource?.name ?? "Score";
  const resourceIcon = coreResource?.icon ?? "⭐";
  const goalScore = Math.max(10, collectibleValue * 7);

  return {
    hasLocomotion, hasCollect, hasCombat, hasSurvival,
    playerSpeed, enemySpeed, enemyDamage, collectibleValue,
    healthMax, goalScore, resourceName, resourceIcon,
    worldSize, seed: ir.seed,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

export const RENDERER_3D_VERSION = RENDERER_VERSION;
