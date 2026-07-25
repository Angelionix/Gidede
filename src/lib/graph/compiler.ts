/**
 * Graph Compiler — преобразует NodeGraph JSON в исполняемый LittleJS HTML.
 *
 * Архитектура:
 * 1. Найти все Event ноды (точки входа)
 * 2. Для каждого Event → пройти по exec-рёбрам, генерируя код
 * 3. Сгенерировать переменные из Entity нод
 * 4. Сгенерировать gameUpdate() из exec-цепочек
 * 5. Сгенерировать gameRender() из Entity нод
 * 6. Обернуть в HTML template с SFX
 */

import type { NodeGraph, GraphNode, GraphEdge } from "./types";
import { NODE_DEFINITIONS } from "./types";
import { validateGraph } from "./validator";

interface CompileResult {
  html: string;
  valid: boolean;
  errors: string[];
}

export function compileGraph(graph: NodeGraph): CompileResult {
  const validation = validateGraph(graph);
  if (!validation.valid) {
    return {
      html: "",
      valid: false,
      errors: validation.errors.map((e) => e.message),
    };
  }

  const nodesById = new Map<string, GraphNode>();
  for (const n of graph.nodes) nodesById.set(n.id, n);

  const edges = graph.edges || [];
  const execEdges = edges.filter((e) => isExecEdge(e, nodesById));
  const dataEdges = edges.filter((e) => !isExecEdge(e, nodesById));

  // Find event nodes (entry points)
  const eventNodes = graph.nodes.filter((n) => {
    const def = NODE_DEFINITIONS[n.type as keyof typeof NODE_DEFINITIONS];
    return def?.category === "event";
  });

  // Generate variable declarations
  const varLines: string[] = [];
  const initLines: string[] = [];
  const updateLines: string[] = [];
  const renderLines: string[] = [];

  // Process each node type
  for (const node of graph.nodes) {
    const def = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
    if (!def) continue;
    const props = node.data.properties || def.defaultProperties;
    const varName = node.id.replace(/-/g, "_");

    switch (node.type) {
      case "player":
        varLines.push(`let player = { pos: vec2(200, 150), speed: ${props.speed || 150}, hp: 100 };`);
        updateLines.push(`  // Player movement`);
        updateLines.push(`  const move = vec2();`);
        updateLines.push(`  if (keyIsDown('KeyW')||keyIsDown('ArrowUp')) move.y += 1;`);
        updateLines.push(`  if (keyIsDown('KeyS')||keyIsDown('ArrowDown')) move.y -= 1;`);
        updateLines.push(`  if (keyIsDown('KeyA')||keyIsDown('ArrowLeft')) move.x -= 1;`);
        updateLines.push(`  if (keyIsDown('KeyD')||keyIsDown('ArrowRight')) move.x += 1;`);
        updateLines.push(`  player.pos = player.pos.add(move.normalize().multiply(player.speed * timeDelta));`);
        updateLines.push(`  player.pos.x = clamp(player.pos.x, 20, canvasWidth-20);`);
        updateLines.push(`  player.pos.y = clamp(player.pos.y, 20, canvasHeight-20);`);
        renderLines.push(`  drawCircle(player.pos, 14, new Color(0.2,0.9,0.5,1), 0, new Color(0.5,1,0.7,1), 2);`);
        break;

      case "enemy":
        varLines.push(`let enemies = [];`);
        varLines.push(`let enemySpawnTimer = ${props.spawnRate || 1.5};`);
        updateLines.push(`  // Enemy spawn`);
        updateLines.push(`  enemySpawnTimer -= timeDelta;`);
        updateLines.push(`  if (enemySpawnTimer <= 0) { enemySpawnTimer = ${props.spawnRate || 1.5}; enemies.push({pos: vec2(Math.random()*canvasWidth, -10), vel: vec2((Math.random()-0.5)*40, -${props.speed || 80})}); }`);
        updateLines.push(`  enemies.forEach(e => { e.pos = e.pos.add(e.vel.multiply(timeDelta)); });`);
        updateLines.push(`  enemies = enemies.filter(e => e.pos.y > -20);`);
        // Check collision with player
        updateLines.push(`  for (let i=enemies.length-1;i>=0;i--) { if (enemies[i].pos.subtract(player.pos).length() < 20) { player.hp -= ${props.damage || 10}*timeDelta; enemies.splice(i,1); sfxHit(); spawnParticles(player.pos, 4, new Color(1,0.3,0.3,1)); } }`);
        renderLines.push(`  enemies.forEach(e => { drawCircle(e.pos, 12, new Color(0.9,0.2,0.2,1), 0, new Color(1,0.5,0.5,1), 2); });`);
        break;

      case "collectible":
        varLines.push(`let crystals = [];`);
        initLines.push(`  for (let i=0; i<${props.count || 5}; i++) crystals.push({pos: vec2(50+Math.random()*(canvasWidth-100), 50+Math.random()*(canvasHeight-100)), collected: false});`);
        updateLines.push(`  // Collectible check`);
        updateLines.push(`  for (let c of crystals) { if (!c.collected && c.pos.subtract(player.pos).length() < 20) { c.collected = true; score++; sfxCollect(); spawnParticles(c.pos, 6, new Color(1,0.8,0.2,1)); } }`);
        renderLines.push(`  crystals.forEach(c => { if (!c.collected) drawPolygon(c.pos, 6, 10, new Color(1,0.8,0.2,1), 0, new Color(1,1,0.4,1), 2); });`);
        break;

      case "base":
        varLines.push(`let baseHp = ${props.maxHp || 100};`);
        renderLines.push(`  drawRect(vec2(canvasWidth-15, canvasHeight/2), vec2(20, 60), new Color(0.2,0.5,1,1), 0, new Color(0.5,0.7,1,1), 2);`);
        break;

      case "counter":
        varLines.push(`let score = ${props.startValue || 0};`);
        varLines.push(`const WIN_THRESHOLD = ${props.threshold || 5};`);
        break;

      case "onTimerEnd":
        varLines.push(`let timeLeft = ${props.duration || 30};`);
        updateLines.push(`  timeLeft -= timeDelta;`);
        updateLines.push(`  if (timeLeft <= 0) { timeLeft = 0; /* timer end event */ }`);
        break;

      case "onKey":
        varLines.push(`let keyHit = false;`);
        updateLines.push(`  if (keyWasPressed('${props.keyCode || "Space"}')) { keyHit = true; } else { keyHit = false; }`);
        break;

      case "win":
        updateLines.push(`  if (score >= WIN_THRESHOLD) { sfxWin(); win(); }`);
        break;

      case "lose":
        updateLines.push(`  if (player.hp <= 0) { player.hp = 0; sfxLose(); lose(); }`);
        break;
    }
  }

  // Timer-based win/lose
  const hasTimer = graph.nodes.some((n) => n.type === "onTimerEnd");
  const hasWin = graph.nodes.some((n) => n.type === "win");
  const hasLose = graph.nodes.some((n) => n.type === "lose");

  if (hasTimer && hasWin) {
    updateLines.push(`  if (timeLeft <= 0 && player.hp > 0) { sfxWin(); win(); }`);
  }

  // Render score/timer if applicable
  if (graph.nodes.some((n) => n.type === "counter")) {
    renderLines.push(`  drawText('Score: ' + score + '/' + WIN_THRESHOLD, vec2(canvasWidth/2, canvasHeight-30), 20, new Color(1,0.85,0.2));`);
  }
  if (hasTimer) {
    renderLines.push(`  drawText(Math.ceil(timeLeft) + 's', vec2(canvasWidth-30, canvasHeight-30), 18, new Color(0.6,0.7,0.8), 0, 'right');`);
  }
  if (graph.nodes.some((n) => n.type === "player")) {
    renderLines.push(`  drawText('HP: ' + Math.floor(player.hp), vec2(30, canvasHeight-30), 16, player.hp>30?new Color(0.2,0.9,0.5):new Color(0.9,0.2,0.2));`);
  }

  const html = generateHtml(varLines, initLines, updateLines, renderLines);
  return { html, valid: true, errors: [] };
}

function isExecEdge(edge: GraphEdge, nodes: Map<string, GraphNode>): boolean {
  const source = nodes.get(edge.source);
  if (!source) return false;
  const def = NODE_DEFINITIONS[source.type as keyof typeof NODE_DEFINITIONS];
  if (!def) return false;
  const pin = def.outputs.find((p) => p.id === edge.sourceHandle);
  return pin?.type === "exec";
}

function generateHtml(
  varLines: string[],
  initLines: string[],
  updateLines: string[],
  renderLines: string[]
): string {
  const sfxSnippet = `
  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  function sfx(freq, dur, type='sine', vol=0.15) { try { if (!actx) actx = new AC(); const o = actx.createOscillator(); const g = actx.createGain(); o.type=type; o.frequency.value=freq; g.gain.value=vol; o.connect(g); g.connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime+dur); o.stop(actx.currentTime+dur); } catch(e){} }
  function sfxCollect() { sfx(880, 0.12, 'square'); setTimeout(()=>sfx(1320, 0.1, 'square'), 60); }
  function sfxHit() { sfx(120, 0.25, 'sawtooth', 0.2); }
  function sfxWin() { sfx(523,0.15); setTimeout(()=>sfx(659,0.15),150); setTimeout(()=>sfx(784,0.3),300); }
  function sfxLose() { sfx(220,0.2,'sawtooth'); setTimeout(()=>sfx(110,0.4,'sawtooth'),200); }
`;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Node Graph Prototype</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:8px;min-height:100vh;overflow:hidden}
  h1{font-size:14px;margin-bottom:2px}
  .goal{color:#94a3b8;font-size:11px;margin-bottom:4px}
  .steps{font-size:10px;color:#64748b;margin-top:2px;text-align:center}
  .overlay{position:absolute;inset:0;background:rgba(0,0,0,0.88);display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:8px}
  .overlay.show{display:flex}
  .overlay h2{font-size:20px}
  .overlay button{padding:6px 16px;background:#10b981;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer}
</style>
</head>
<body>
  <h1>🎮 Node Graph Prototype</h1>
  <p class="goal">Compiled from visual graph</p>
  <div style="position:relative;width:100%;max-width:400px;height:300px;border-radius:8px;overflow:hidden;border:1px solid #334155">
    <div class="overlay" id="overlay">
      <h2 id="resultText"></h2>
      <button onclick="location.reload()">Заново</button>
    </div>
  </div>
  <p class="steps">Powered by LittleJS • Node-compiled</p>
  <script src="/littlejs.min.js"></script>
  <script>
    ${sfxSnippet}
    let running = true;
    const overlay = document.getElementById('overlay');
    const resultText = document.getElementById('resultText');
    function notifyParent(outcome, score, duration) { try { window.parent.postMessage({ type: 'gidede-playtest', outcome, score: score||null, duration: duration||30, prototypeType: 'node-graph', mode: '2d' }, '*'); } catch(e){} }
    function win() { running=false; resultText.textContent='🎉 Победа!'; overlay.classList.add('show'); notifyParent('win', score, Math.max(0, 30-timeLeft)); }
    function lose() { running=false; resultText.textContent='💀 Поражение'; overlay.classList.add('show'); notifyParent('lose', score, Math.max(0, 30-timeLeft)); }

    // === Variables ===
    ${varLines.join("\n    ")}

    let particles = [];
    function spawnParticles(pos, n, color) { for (let i=0;i<n;i++) { const a=Math.random()*Math.PI*2; const s=50+Math.random()*100; particles.push({pos:pos.add(vec2(Math.cos(a)*s,Math.sin(a)*s)), vel:vec2(Math.cos(a)*s,Math.sin(a)*s), life:1, color:color}); } }

    function gameInit() { canvasFixedSize = vec2(400, 300); ${initLines.join(" ")} }

    function gameUpdate() {
      if (!running) return;
      ${updateLines.join("\n      ")}
    }

    function gameUpdatePost() {
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => { p.life -= timeDelta*1.5; p.pos = p.pos.add(p.vel.multiply(timeDelta)); p.vel = p.vel.multiply(0.95); });
    }

    function gameRender() {
      drawRect(vec2(0,0), new Color(0.06,0.09,0.16), 0, 0);
      ${renderLines.join("\n      ")}
    }

    function gameRenderPost() {
      particles.forEach(p => { if (p.life > 0) drawCircle(p.pos, 4*p.life, p.color); });
    }

    engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
  </script>
</body>
</html>`;
}
