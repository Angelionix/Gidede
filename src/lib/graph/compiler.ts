/**
 * Graph Compiler — преобразует NodeGraph JSON в исполняемый LittleJS HTML.
 *
 * Архитектура (Phase 2 rewrite):
 * 1. Валидация графа (validateGraph).
 * 2. Построение карт смежности: execEdges (для обхода выполнения) и
 *    dataEdges (для разрешения значений входных пинов).
 * 3. Поиск точек входа — Event-нод. Каждая Event-нода определяет, в какой
 *    lifecycle-функцию её последователи будут выполняться:
 *      - onGameStart  → gameInit()
 *      - onTick       → gameUpdate() (каждый кадр)
 *      - onKey        → gameUpdate(), guard keyWasPressed()
 *      - onCollision  → gameUpdate(), внутри блока проверки столкновений
 *      - onTimerEnd   → gameUpdate(), guard timeLeft <= 0
 * 4. Для каждой Event-ноды — DFS-обход по exec-рёбрам с эмиссией кода в
 *    соответствующий lifecycle (initLines / updateLines).
 * 5. Entity-ноды дополнительно эмитят рендер-код в gameRender().
 * 6. Data-входы разрешаются через resolveDataInput(): следует по data-ребру
 *    к source-ноде и возвращает JS-выражение для её output-пина. Если ребра
 *    нет — используется defaultProperties.
 * 7. Все 20 типов нод имеют реальную эмиссию кода.
 * 8. Обёртка в HTML-шаблон с SFX, overlay, win()/lose(), postMessage.
 */

import type { NodeGraph, GraphNode, GraphEdge, NodeType } from "./types";
import { NODE_DEFINITIONS } from "./types";
import { validateGraph } from "./validator";

export interface CompileResult {
  html: string;
  valid: boolean;
  errors: string[];
}

/** Узел контекста компиляции — хранит промежуточное состояние. */
interface CompileContext {
  nodesById: Map<string, GraphNode>;
  execOutEdges: Map<string, GraphEdge[]>; // nodeId -> exec edges from this node
  dataInEdges: Map<string, GraphEdge[]>;  // nodeId -> data edges INTO this node (by target)
  dataOutEdges: Map<string, GraphEdge[]>; // nodeId -> data edges FROM this node (by source)
  varLines: string[];
  initLines: string[];
  updateLines: string[];
  renderLines: string[];
  /** Имя переменной для выхода ноды (nodeId:pinId -> JS expr). */
  valueCache: Map<string, string>;
  /** Защита от бесконечного обхода (одна нода может выполняться несколько раз через разные пути, но не бесконечно в одном). */
  visiting: Set<string>;
  hasPlayer: boolean;
  hasTimer: boolean;
  hasWin: boolean;
  hasLose: boolean;
  hasCounter: boolean;
  hasSpawner: boolean;
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

  // --- Build node lookup ---
  const nodesById = new Map<string, GraphNode>();
  for (const n of graph.nodes) nodesById.set(n.id, n);

  // --- Build edge adjacency maps ---
  const execOutEdges = new Map<string, GraphEdge[]>();
  const dataInEdges = new Map<string, GraphEdge[]>();
  const dataOutEdges = new Map<string, GraphEdge[]>();
  for (const e of graph.edges || []) {
    const sourceNode = nodesById.get(e.source);
    if (!sourceNode) continue;
    const sourceDef = NODE_DEFINITIONS[sourceNode.type];
    if (!sourceDef) continue;
    const sourcePin = sourceDef.outputs.find((p) => p.id === e.sourceHandle);
    if (!sourcePin) continue;

    if (sourcePin.type === "exec") {
      if (!execOutEdges.has(e.source)) execOutEdges.set(e.source, []);
      execOutEdges.get(e.source)!.push(e);
    } else {
      if (!dataOutEdges.has(e.source)) dataOutEdges.set(e.source, []);
      dataOutEdges.get(e.source)!.push(e);
      if (!dataInEdges.has(e.target)) dataInEdges.set(e.target, []);
      dataInEdges.get(e.target)!.push(e);
    }
  }

  // --- Scan for global features ---
  const hasPlayer = graph.nodes.some((n) => n.type === "player");
  const hasTimer = graph.nodes.some((n) => n.type === "onTimerEnd");
  const hasWin = graph.nodes.some((n) => n.type === "win");
  const hasLose = graph.nodes.some((n) => n.type === "lose");
  const hasCounter = graph.nodes.some((n) => n.type === "counter");
  const hasSpawner = graph.nodes.some((n) => n.type === "spawner");

  const ctx: CompileContext = {
    nodesById,
    execOutEdges,
    dataInEdges,
    dataOutEdges,
    varLines: [],
    initLines: [],
    updateLines: [],
    renderLines: [],
    valueCache: new Map(),
    visiting: new Set(),
    hasPlayer,
    hasTimer,
    hasWin,
    hasLose,
    hasCounter,
    hasSpawner,
  };

  // --- Phase A: declare variables for all entity/data nodes (top-level) ---
  for (const node of graph.nodes) {
    declareNodeVariable(node, ctx);
  }

  // --- Phase B: render code for entity nodes (gameRender) ---
  for (const node of graph.nodes) {
    emitRenderCode(node, ctx);
  }

  // --- Phase C: traverse each Event node, emitting init/update code ---
  const eventNodes = graph.nodes.filter((n) => {
    const def = NODE_DEFINITIONS[n.type];
    return def?.category === "event";
  });

  for (const evt of eventNodes) {
    emitEventEntry(evt, ctx);
  }

  // --- Phase D: HUD rendering (score/timer/hp) ---
  emitHud(ctx);

  // --- Phase E: generate HTML (2D LittleJS or 3D Three.js) ---
  const is3D = graph.settings?.mode === "3d";
  const html = is3D
    ? generate3DHtml(ctx.varLines, ctx.initLines, ctx.updateLines, ctx.renderLines)
    : generateHtml(ctx.varLines, ctx.initLines, ctx.updateLines, ctx.renderLines);
  return { html, valid: true, errors: [] };
}

// ============================================================
// Variable declaration (top-level `let` statements)
// ============================================================

function declareNodeVariable(node: GraphNode, ctx: CompileContext): void {
  const def = NODE_DEFINITIONS[node.type];
  if (!def) return;
  const props = node.data.properties || def.defaultProperties;
  const v = varName(node.id);

  switch (node.type) {
    case "player":
      ctx.varLines.push(`let player = { pos: vec2(200, 150), speed: ${num(props.speed, 150)}, hp: 100 };`);
      break;
    case "enemy":
      // Only declare the shared enemies array once (multiple enemy nodes share it)
      if (!ctx.varLines.some((l) => l.startsWith("let enemies ="))) {
        ctx.varLines.push(`let enemies = [];`);
        ctx.varLines.push(`let enemySpawnTimer = ${num(props.spawnRate, 1.5)};`);
      }
      break;
    case "collectible":
      ctx.varLines.push(`let ${v}_crystals = [];`);
      // Spawn crystals in gameInit
      ctx.initLines.push(`    for (let _i = 0; _i < ${num(props.count, 5)}; _i++) ${v}_crystals.push({pos: vec2(50+Math.random()*(canvasWidth-100), 50+Math.random()*(canvasHeight-100)), collected: false});`);
      break;
    case "base":
      ctx.varLines.push(`let ${v}_hp = ${num(props.maxHp, 100)};`);
      break;
    case "spawner":
      ctx.varLines.push(`let ${v}_timer = ${num(props.interval, 2.0)};`);
      break;
    case "counter":
      ctx.varLines.push(`let ${v} = ${num(props.startValue, 0)};`);
      ctx.varLines.push(`const ${v}_MAX = ${num(props.threshold, 5)};`);
      break;
    case "delay":
      ctx.varLines.push(`let ${v}_timer = 0;`);
      ctx.varLines.push(`let ${v}_started = false;`);
      break;
    case "array":
      ctx.varLines.push(`let ${v} = [];`);
      break;
    case "onTimerEnd":
      ctx.varLines.push(`let ${v}_timeLeft = ${num(props.duration, 30)};`);
      break;
    case "math":
      // math is pure — declared lazily where consumed, but reserve a var if it has exec input
      ctx.varLines.push(`let ${v}_result = 0;`);
      break;
    case "random":
      ctx.varLines.push(`let ${v}_value = 0;`);
      break;
    case "comment":
      // no variable
      break;
    // R-NODE-EXPANSION: Math & Logic nodes — reserve result vars.
    case "clamp":
    case "lerp":
    case "distance":
    case "angle":
    case "compare":
    case "boolOp":
    case "getValue":
      ctx.varLines.push(`let ${v}_result = 0;`);
      break;
    case "switch":
      // no variable needed; branching is inline
      break;
    // R-NODE-EXPANSION: Variables & State nodes — no per-node vars, but
    // declare the shared __vars object once if any state node is present.
    case "setVar":
    case "getVar":
    case "saveState":
    case "loadState":
      if (!ctx.varLines.some((l) => l.startsWith("let __vars ="))) {
        ctx.varLines.push(`let __vars = {};`);
      }
      // loadState needs a result var to expose the loaded value.
      if (node.type === "loadState") {
        ctx.varLines.push(`let ${v}_loaded = 0;`);
      }
      break;
    default:
      // events, flow, output — no top-level variable needed
      break;
  }
}

// ============================================================
// Render code (gameRender) — entity nodes draw themselves
// ============================================================

function emitRenderCode(node: GraphNode, ctx: CompileContext): void {
  const def = NODE_DEFINITIONS[node.type];
  if (!def) return;
  const v = varName(node.id);

  switch (node.type) {
    case "player":
      ctx.renderLines.push(`  drawCircle(player.pos, 14, new Color(0.2,0.9,0.5,1), 0, new Color(0.5,1,0.7,1), 2);`);
      break;
    case "enemy":
      ctx.renderLines.push(`  enemies.forEach(e => { drawCircle(e.pos, 12, new Color(0.9,0.2,0.2,1), 0, new Color(1,0.5,0.5,1), 2); });`);
      break;
    case "collectible":
      ctx.renderLines.push(`  ${v}_crystals.forEach(c => { if (!c.collected) drawPolygon(c.pos, 6, 10, new Color(1,0.8,0.2,1), 0, new Color(1,1,0.4,1), 2); });`);
      break;
    case "base":
      ctx.renderLines.push(`  drawRect(vec2(canvasWidth-15, canvasHeight/2), vec2(20, 60), new Color(0.2,0.5,1,1), 0, new Color(0.5,0.7,1,1), 2);`);
      break;
    default:
      // non-entity nodes have no render code
      break;
  }
}

// ============================================================
// Event entry points — emit code into init/update lifecycle
// ============================================================

function emitEventEntry(evt: GraphNode, ctx: CompileContext): void {
  const v = varName(evt.id);

  switch (evt.type) {
    case "onGameStart":
      // Followers run in gameInit()
      ctx.initLines.push(`    // [onGameStart ${evt.id}]`);
      emitFollowers(evt, ctx, ctx.initLines, "    ");
      break;

    case "onTick":
      // Followers run every frame in gameUpdate()
      ctx.updateLines.push(`  // [onTick ${evt.id}] — every frame`);
      emitFollowers(evt, ctx, ctx.updateLines, "  ");
      break;

    case "onKey": {
      const keyCode = str(evt.data.properties?.keyCode, "Space");
      ctx.updateLines.push(`  // [onKey ${evt.id}]`);
      ctx.updateLines.push(`  if (keyWasPressed('${keyCode}')) {`);
      emitFollowers(evt, ctx, ctx.updateLines, "    ");
      ctx.updateLines.push(`  }`);
      break;
    }

    case "onCollision": {
      const entityA = str(evt.data.properties?.entityA, "player");
      const entityB = str(evt.data.properties?.entityB, "enemy");
      ctx.updateLines.push(`  // [onCollision ${evt.id}] ${entityA} vs ${entityB}`);
      const arrA = entityArrayExpr(entityA, ctx);
      const arrB = entityArrayExpr(entityB, ctx);
      ctx.updateLines.push(`  for (let _iA = 0; _iA < ${arrA}.length; _iA++) {`);
      ctx.updateLines.push(`    for (let _iB = 0; _iB < ${arrB}.length; _iB++) {`);
      ctx.updateLines.push(`      if (${arrA}[_iA].pos.subtract(${arrB}[_iB].pos).length() < 20) {`);
      emitFollowers(evt, ctx, ctx.updateLines, "        ");
      ctx.updateLines.push(`      }`);
      ctx.updateLines.push(`    }`);
      ctx.updateLines.push(`  }`);
      break;
    }

    case "onTimerEnd":
      ctx.updateLines.push(`  // [onTimerEnd ${evt.id}]`);
      ctx.updateLines.push(`  ${v}_timeLeft -= timeDelta;`);
      ctx.updateLines.push(`  if (${v}_timeLeft <= 0) {`);
      ctx.updateLines.push(`    ${v}_timeLeft = 0;`);
      emitFollowers(evt, ctx, ctx.updateLines, "    ");
      ctx.updateLines.push(`  }`);
      break;
  }
}

// ============================================================
// Emit followers — DFS along exec edges, emitting each node's body
// ============================================================

function emitFollowers(
  node: GraphNode,
  ctx: CompileContext,
  lines: string[],
  indent: string
): void {
  const outEdges = ctx.execOutEdges.get(node.id) || [];
  for (const edge of outEdges) {
    const target = ctx.nodesById.get(edge.target);
    if (!target) continue;
    // Guard against infinite recursion in a single path
    if (ctx.visiting.has(target.id)) continue;
    ctx.visiting.add(target.id);
    emitNodeBody(target, edge.targetHandle, ctx, lines, indent);
    ctx.visiting.delete(target.id);
  }
}

// ============================================================
// Emit a single node's body (its effect), then recurse into its exec outputs
// ============================================================

function emitNodeBody(
  node: GraphNode,
  inputHandle: string | null,
  ctx: CompileContext,
  lines: string[],
  indent: string
): void {
  const def = NODE_DEFINITIONS[node.type];
  if (!def) return;
  const v = varName(node.id);
  const props = node.data.properties || def.defaultProperties;

  switch (node.type) {
    // --- Events (shouldn't normally be reached as followers, but handle gracefully) ---
    case "onGameStart":
    case "onTick":
    case "onCollision":
    case "onKey":
    case "onTimerEnd":
      // Events are entry points; if reached as a follower, just emit their followers.
      emitFollowers(node, ctx, lines, indent);
      break;

    // --- Entities ---
    case "player":
      // Player movement (also emitted once globally — but if reached via exec, emit move)
      lines.push(`${indent}// player ${node.id} movement`);
      lines.push(`${indent}const _move = vec2();`);
      lines.push(`${indent}if (keyIsDown('KeyW')||keyIsDown('ArrowUp')) _move.y += 1;`);
      lines.push(`${indent}if (keyIsDown('KeyS')||keyIsDown('ArrowDown')) _move.y -= 1;`);
      lines.push(`${indent}if (keyIsDown('KeyA')||keyIsDown('ArrowLeft')) _move.x -= 1;`);
      lines.push(`${indent}if (keyIsDown('KeyD')||keyIsDown('ArrowRight')) _move.x += 1;`);
      lines.push(`${indent}player.pos = player.pos.add(_move.normalize().multiply(player.speed * timeDelta));`);
      lines.push(`${indent}player.pos.x = clamp(player.pos.x, 20, canvasWidth-20);`);
      lines.push(`${indent}player.pos.y = clamp(player.pos.y, 20, canvasHeight-20);`);
      emitFollowersByHandle(node, "onMove", ctx, lines, indent);
      break;

    case "enemy":
      // Enemy spawn + movement + collision with player
      lines.push(`${indent}// enemy ${node.id} spawn/move`);
      lines.push(`${indent}enemySpawnTimer -= timeDelta;`);
      lines.push(`${indent}if (enemySpawnTimer <= 0) { enemySpawnTimer = ${num(props.spawnRate, 1.5)}; enemies.push({pos: vec2(Math.random()*canvasWidth, -10), vel: vec2((Math.random()-0.5)*40, -${num(props.speed, 80)})}); }`);
      lines.push(`${indent}enemies.forEach(e => { e.pos = e.pos.add(e.vel.multiply(timeDelta)); });`);
      lines.push(`${indent}enemies = enemies.filter(e => e.pos.y > -20 && e.pos.y < canvasHeight+20);`);
      lines.push(`${indent}for (let _ei = enemies.length-1; _ei >= 0; _ei--) { if (enemies[_ei].pos.subtract(player.pos).length() < 20) { player.hp -= ${num(props.damage, 10)}*timeDelta; enemies.splice(_ei,1); sfxHit(); spawnParticles(player.pos, 4, new Color(1,0.3,0.3,1));`);
      emitFollowersByHandle(node, "onCollide", ctx, lines, indent + "  ");
      lines.push(`${indent}  } }`);
      break;

    case "collectible": {
      lines.push(`${indent}// collectible ${node.id} check`);
      lines.push(`${indent}for (let _ci = 0; _ci < ${v}_crystals.length; _ci++) {`);
      lines.push(`${indent}  const c = ${v}_crystals[_ci];`);
      lines.push(`${indent}  if (!c.collected && c.pos.subtract(player.pos).length() < 20) {`);
      lines.push(`${indent}    c.collected = true; sfxCollect(); spawnParticles(c.pos, 6, new Color(1,0.8,0.2,1));`);
      emitFollowersByHandle(node, "onCollect", ctx, lines, indent + "    ");
      lines.push(`${indent}  }`);
      lines.push(`${indent}}`);
      break;
    }

    case "base":
      lines.push(`${indent}// base ${node.id} check destroyed`);
      lines.push(`${indent}if (${v}_hp <= 0) {`);
      emitFollowersByHandle(node, "onDestroyed", ctx, lines, indent + "  ");
      lines.push(`${indent}}`);
      break;

    case "spawner": {
      const entityType = str(props.entityType, "enemy");
      lines.push(`${indent}// spawner ${node.id} -> ${entityType}`);
      lines.push(`${indent}${v}_timer -= timeDelta;`);
      lines.push(`${indent}if (${v}_timer <= 0) {`);
      lines.push(`${indent}  ${v}_timer = ${num(props.interval, 2.0)};`);
      if (entityType === "enemy") {
        lines.push(`${indent}  enemies.push({pos: vec2(Math.random()*canvasWidth, -10), vel: vec2((Math.random()-0.5)*40, -60)});`);
      } else {
        lines.push(`${indent}  // spawn ${entityType} (no specific array)`);
      }
      emitFollowersByHandle(node, "spawned", ctx, lines, indent + "  ");
      lines.push(`${indent}}`);
      break;
    }

    // --- Flow Control ---
    case "branch": {
      const cond = resolveDataInput(node.id, "condition", ctx, props);
      lines.push(`${indent}// branch ${node.id}`);
      lines.push(`${indent}if (${cond}) {`);
      emitFollowersByHandle(node, "true", ctx, lines, indent + "  ");
      lines.push(`${indent}} else {`);
      emitFollowersByHandle(node, "false", ctx, lines, indent + "  ");
      lines.push(`${indent}}`);
      break;
    }

    case "forEach": {
      const arr = resolveDataInput(node.id, "array", ctx, props);
      lines.push(`${indent}// forEach ${node.id}`);
      lines.push(`${indent}for (let _item = 0; _item < (${arr} || []).length; _item++) {`);
      lines.push(`${indent}  const ${v}_item = ${arr}[_item];`);
      // Cache the item value for the 'item' output pin
      ctx.valueCache.set(`${node.id}:item`, `${v}_item`);
      emitFollowersByHandle(node, "loop", ctx, lines, indent + "  ");
      lines.push(`${indent}}`);
      break;
    }

    case "delay": {
      lines.push(`${indent}// delay ${node.id}`);
      lines.push(`${indent}if (!${v}_started) { ${v}_started = true; ${v}_timer = ${num(props.seconds, 2.0)}; }`);
      lines.push(`${indent}if (${v}_started) { ${v}_timer -= timeDelta; if (${v}_timer <= 0) {`);
      emitFollowers(node, ctx, lines, indent + "  ");
      lines.push(`${indent}  } }`);
      break;
    }

    case "sequence": {
      lines.push(`${indent}// sequence ${node.id}`);
      // out0, out1, out2 sequentially
      emitFollowersByHandle(node, "out0", ctx, lines, indent);
      emitFollowersByHandle(node, "out1", ctx, lines, indent);
      emitFollowersByHandle(node, "out2", ctx, lines, indent);
      break;
    }

    // --- Data ---
    case "counter": {
      // inputHandle tells us if this is 'increment' or 'reset'
      if (inputHandle === "reset") {
        lines.push(`${indent}// counter ${node.id} reset`);
        lines.push(`${indent}${v} = ${num(props.startValue, 0)};`);
      } else {
        // increment (default)
        lines.push(`${indent}// counter ${node.id} increment`);
        lines.push(`${indent}${v}++;`);
      }
      // Check threshold
      lines.push(`${indent}if (${v} >= ${v}_MAX) {`);
      emitFollowersByHandle(node, "onThreshold", ctx, lines, indent + "  ");
      lines.push(`${indent}}`);
      // Cache value output
      ctx.valueCache.set(`${node.id}:value`, v);
      break;
    }

    case "random": {
      const min = num(props.min, 0);
      const max = num(props.max, 100);
      lines.push(`${indent}// random ${node.id}`);
      lines.push(`${indent}${v}_value = ${min} + Math.random() * (${max} - ${min});`);
      ctx.valueCache.set(`${node.id}:value`, `${v}_value`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "math": {
      const a = resolveDataInput(node.id, "a", ctx, props);
      const b = resolveDataInput(node.id, "b", ctx, props);
      const op = str(props.operation, "+");
      let expr: string;
      switch (op) {
        case "-": expr = `(${a}) - (${b})`; break;
        case "*": expr = `(${a}) * (${b})`; break;
        case "/": expr = `(${b}) !== 0 ? (${a}) / (${b}) : 0`; break;
        case "%": expr = `(${b}) !== 0 ? (${a}) % (${b}) : 0`; break;
        case "min": expr = `Math.min(${a}, ${b})`; break;
        case "max": expr = `Math.max(${a}, ${b})`; break;
        case "+":
        default: expr = `(${a}) + (${b})`; break;
      }
      lines.push(`${indent}// math ${node.id} ${op}`);
      lines.push(`${indent}${v}_result = ${expr};`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "array": {
      // 'add' input is an entity — push to array
      const item = resolveDataInput(node.id, "add", ctx, props);
      lines.push(`${indent}// array ${node.id} add`);
      lines.push(`${indent}${v}.push(${item});`);
      ctx.valueCache.set(`${node.id}:array`, v);
      ctx.valueCache.set(`${node.id}:count`, `${v}.length`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    // --- Output ---
    case "win":
      lines.push(`${indent}// win ${node.id}`);
      lines.push(`${indent}sfxWin(); win();`);
      break;

    case "lose":
      lines.push(`${indent}// lose ${node.id}`);
      lines.push(`${indent}sfxLose(); lose();`);
      break;

    case "comment":
      // no code, just a comment in source
      lines.push(`${indent}// ${str(props.text, "comment")}`);
      break;

    // ============================================================
    // R-NODE-EXPANSION: Math & Logic (8 new nodes)
    // ============================================================
    case "clamp": {
      const val = resolveDataInput(node.id, "value", ctx, props);
      const minV = resolveDataInput(node.id, "min", ctx, props);
      const maxV = resolveDataInput(node.id, "max", ctx, props);
      lines.push(`${indent}// clamp ${node.id}`);
      lines.push(`${indent}${v}_result = Math.max(${minV}, Math.min(${maxV}, ${val}));`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "lerp": {
      const a = resolveDataInput(node.id, "a", ctx, props);
      const b = resolveDataInput(node.id, "b", ctx, props);
      const t = resolveDataInput(node.id, "t", ctx, props);
      lines.push(`${indent}// lerp ${node.id}`);
      lines.push(`${indent}${v}_result = (${a}) + ((${b}) - (${a})) * clamp(${t}, 0, 1);`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "distance": {
      const a = resolveDataInput(node.id, "a", ctx, props);
      const b = resolveDataInput(node.id, "b", ctx, props);
      lines.push(`${indent}// distance ${node.id}`);
      lines.push(`${indent}{ const _dx = (${a}).x - (${b}).x; const _dy = (${a}).y - (${b}).y; ${v}_result = Math.sqrt(_dx*_dx + _dy*_dy); }`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "angle": {
      const a = resolveDataInput(node.id, "a", ctx, props);
      const b = resolveDataInput(node.id, "b", ctx, props);
      lines.push(`${indent}// angle ${node.id}`);
      lines.push(`${indent}{ const _dx = (${b}).x - (${a}).x; const _dy = (${b}).y - (${a}).y; ${v}_result = Math.atan2(_dy, _dx); }`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "compare": {
      const a = resolveDataInput(node.id, "a", ctx, props);
      const b = resolveDataInput(node.id, "b", ctx, props);
      const op = str(props.operation, "==");
      let expr: string;
      switch (op) {
        case "!=": expr = `(${a}) !== (${b})`; break;
        case "<": expr = `(${a}) < (${b})`; break;
        case ">": expr = `(${a}) > (${b})`; break;
        case "<=": expr = `(${a}) <= (${b})`; break;
        case ">=": expr = `(${a}) >= (${b})`; break;
        case "==":
        default: expr = `(${a}) === (${b})`; break;
      }
      lines.push(`${indent}// compare ${node.id} ${op}`);
      lines.push(`${indent}${v}_result = ${expr};`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "boolOp": {
      const a = resolveDataInput(node.id, "a", ctx, props);
      const b = resolveDataInput(node.id, "b", ctx, props);
      const op = str(props.operation, "AND");
      let expr: string;
      switch (op) {
        case "OR": expr = `(${a}) || (${b})`; break;
        case "NOT": expr = `!(${a})`; break;
        case "XOR": expr = `(${a}) !== (${b})`; break;
        case "AND":
        default: expr = `(${a}) && (${b})`; break;
      }
      lines.push(`${indent}// boolOp ${node.id} ${op}`);
      lines.push(`${indent}${v}_result = ${expr};`);
      ctx.valueCache.set(`${node.id}:result`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "switch": {
      const idx = resolveDataInput(node.id, "index", ctx, props);
      lines.push(`${indent}// switch ${node.id}`);
      lines.push(`${indent}switch (Math.floor(${idx})) {`);
      lines.push(`${indent}  case 0:`);
      emitFollowersByHandle(node, "out0", ctx, lines, indent + "    ");
      lines.push(`${indent}    break;`);
      lines.push(`${indent}  case 1:`);
      emitFollowersByHandle(node, "out1", ctx, lines, indent + "    ");
      lines.push(`${indent}    break;`);
      lines.push(`${indent}  case 2:`);
      emitFollowersByHandle(node, "out2", ctx, lines, indent + "    ");
      lines.push(`${indent}    break;`);
      lines.push(`${indent}  case 3:`);
      emitFollowersByHandle(node, "out3", ctx, lines, indent + "    ");
      lines.push(`${indent}    break;`);
      lines.push(`${indent}  default:`);
      lines.push(`${indent}    // no match`);
      lines.push(`${indent}}`);
      break;
    }

    case "getValue": {
      const varName = str(props.varName, "score");
      const defVal = num(props.defaultValue, 0);
      lines.push(`${indent}// getValue ${node.id} var=${varName}`);
      // Read from a graph-scope variable (declared elsewhere or fallback to default).
      // We use a global object __vars to avoid polluting the global namespace.
      lines.push(`${indent}${v}_result = (typeof __vars !== 'undefined' && __vars[${JSON.stringify(varName)}] !== undefined) ? __vars[${JSON.stringify(varName)}] : ${defVal};`);
      ctx.valueCache.set(`${node.id}:value`, `${v}_result`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    // ============================================================
    // R-NODE-EXPANSION: Variables & State (4 new nodes)
    // ============================================================
    case "setVar": {
      const varName = str(props.varName, "score");
      const val = resolveDataInput(node.id, "value", ctx, props);
      lines.push(`${indent}// setVar ${node.id} ${varName}`);
      lines.push(`${indent}__vars[${JSON.stringify(varName)}] = ${val};`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "getVar": {
      // Pure data node — no exec body. Resolution happens via resolveOutputExpr.
      // Nothing to emit here.
      break;
    }

    case "saveState": {
      const key = str(props.key, "progress");
      const val = resolveDataInput(node.id, "value", ctx, props);
      lines.push(`${indent}// saveState ${node.id} key=${key}`);
      // Persist to localStorage. Wrap in try/catch for sandboxed iframes.
      lines.push(`${indent}try { localStorage.setItem(${JSON.stringify(key)}, String(${val})); } catch(e) {}`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }

    case "loadState": {
      const key = str(props.key, "progress");
      const defVal = num(props.defaultValue, 0);
      lines.push(`${indent}// loadState ${node.id} key=${key}`);
      lines.push(`${indent}try { const _s = localStorage.getItem(${JSON.stringify(key)}); ${v}_loaded = _s !== null ? Number(_s) : ${defVal}; } catch(e) { ${v}_loaded = ${defVal}; }`);
      ctx.valueCache.set(`${node.id}:value`, `${v}_loaded`);
      emitFollowers(node, ctx, lines, indent);
      break;
    }
  }
}

// ============================================================
// Helpers
// ============================================================

/** Emit followers connected to a specific exec output handle (e.g. "true", "false", "onCollect"). */
function emitFollowersByHandle(
  node: GraphNode,
  handle: string,
  ctx: CompileContext,
  lines: string[],
  indent: string
): void {
  const outEdges = ctx.execOutEdges.get(node.id) || [];
  for (const edge of outEdges) {
    if (edge.sourceHandle !== handle) continue;
    const target = ctx.nodesById.get(edge.target);
    if (!target) continue;
    if (ctx.visiting.has(target.id)) continue;
    ctx.visiting.add(target.id);
    emitNodeBody(target, edge.targetHandle, ctx, lines, indent);
    ctx.visiting.delete(target.id);
  }
}

/**
 * Resolve a data input pin to a JS expression string.
 * Follows the data edge back to the source node's output pin.
 * If no edge, uses the property value or a sensible default.
 */
function resolveDataInput(
  nodeId: string,
  pinId: string,
  ctx: CompileContext,
  props: Record<string, unknown>
): string {
  // Check cache first
  const cacheKey = `${nodeId}:${pinId}`;
  const cached = ctx.valueCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // Look for a data edge into this pin
  const inEdges = ctx.dataInEdges.get(nodeId) || [];
  const edge = inEdges.find((e) => e.targetHandle === pinId);
  if (edge) {
    const sourceNode = ctx.nodesById.get(edge.source);
    if (sourceNode) {
      const expr = resolveOutputExpr(sourceNode, edge.sourceHandle || "", ctx);
      if (expr) return expr;
    }
  }

  // No edge — use property or default
  const propVal = props[pinId];
  if (typeof propVal === "number") return String(propVal);
  if (typeof propVal === "string") return JSON.stringify(propVal);
  if (typeof propVal === "boolean") return String(propVal);
  // Sensible defaults per pin id
  if (pinId === "condition") return "true";
  if (pinId === "a" || pinId === "b") return "0";
  if (pinId === "array") return "[]";
  if (pinId === "add") return "null";
  return "0";
}

/** Get the JS expression for a node's output pin (without triggering exec). */
function resolveOutputExpr(
  node: GraphNode,
  pinId: string,
  ctx: CompileContext
): string | null {
  const def = NODE_DEFINITIONS[node.type];
  if (!def) return null;
  const v = varName(node.id);
  const props = node.data.properties || def.defaultProperties;

  // Check cache (for nodes that were already executed and cached a value)
  const cacheKey = `${node.id}:${pinId}`;
  const cached = ctx.valueCache.get(cacheKey);
  if (cached !== undefined) return cached;

  switch (node.type) {
    case "player":
      if (pinId === "position") return "player.pos";
      if (pinId === "hp") return "player.hp";
      break;
    case "enemy":
      if (pinId === "position") return "enemies.length > 0 ? enemies[0].pos : vec2(0,0)";
      break;
    case "collectible":
      if (pinId === "position") return `${v}_crystals.length > 0 ? ${v}_crystals[0].pos : vec2(0,0)`;
      break;
    case "base":
      if (pinId === "hp") return `${v}_hp`;
      break;
    case "counter":
      if (pinId === "value") return v;
      break;
    case "random":
      if (pinId === "value") return `${v}_value`;
      break;
    case "math":
      if (pinId === "result") {
        // Evaluate inline if inputs are resolvable
        const a = resolveDataInput(node.id, "a", ctx, props);
        const b = resolveDataInput(node.id, "b", ctx, props);
        const op = str(props.operation, "+");
        switch (op) {
          case "-": return `((${a}) - (${b}))`;
          case "*": return `((${a}) * (${b}))`;
          case "/": return `((${b}) !== 0 ? (${a}) / (${b}) : 0)`;
          case "%": return `((${b}) !== 0 ? (${a}) % (${b}) : 0)`;
          case "min": return `Math.min(${a}, ${b})`;
          case "max": return `Math.max(${a}, ${b})`;
          default: return `((${a}) + (${b}))`;
        }
      }
      break;
    case "array":
      if (pinId === "array") return v;
      if (pinId === "count") return `${v}.length`;
      break;
    case "forEach":
      if (pinId === "item") return `${v}_item`;
      break;
    case "onTick":
      if (pinId === "deltaTime") return "timeDelta";
      break;
    // R-NODE-EXPANSION: inline resolution for Math & Logic nodes.
    case "clamp": {
      if (pinId === "result") {
        const val = resolveDataInput(node.id, "value", ctx, props);
        const minV = resolveDataInput(node.id, "min", ctx, props);
        const maxV = resolveDataInput(node.id, "max", ctx, props);
        return `Math.max(${minV}, Math.min(${maxV}, ${val}))`;
      }
      break;
    }
    case "lerp": {
      if (pinId === "result") {
        const a = resolveDataInput(node.id, "a", ctx, props);
        const b = resolveDataInput(node.id, "b", ctx, props);
        const t = resolveDataInput(node.id, "t", ctx, props);
        return `((${a}) + ((${b}) - (${a})) * Math.max(0, Math.min(1, ${t})))`;
      }
      break;
    }
    case "distance": {
      if (pinId === "result") {
        const a = resolveDataInput(node.id, "a", ctx, props);
        const b = resolveDataInput(node.id, "b", ctx, props);
        return `Math.sqrt(Math.pow((${a}).x - (${b}).x, 2) + Math.pow((${a}).y - (${b}).y, 2))`;
      }
      break;
    }
    case "angle": {
      if (pinId === "result") {
        const a = resolveDataInput(node.id, "a", ctx, props);
        const b = resolveDataInput(node.id, "b", ctx, props);
        return `Math.atan2((${b}).y - (${a}).y, (${b}).x - (${a}).x)`;
      }
      break;
    }
    case "compare": {
      if (pinId === "result") {
        const a = resolveDataInput(node.id, "a", ctx, props);
        const b = resolveDataInput(node.id, "b", ctx, props);
        const op = str(props.operation, "==");
        switch (op) {
          case "!=": return `((${a}) !== (${b}))`;
          case "<": return `((${a}) < (${b}))`;
          case ">": return `((${a}) > (${b}))`;
          case "<=": return `((${a}) <= (${b}))`;
          case ">=": return `((${a}) >= (${b}))`;
          default: return `((${a}) === (${b}))`;
        }
      }
      break;
    }
    case "boolOp": {
      if (pinId === "result") {
        const a = resolveDataInput(node.id, "a", ctx, props);
        const b = resolveDataInput(node.id, "b", ctx, props);
        const op = str(props.operation, "AND");
        switch (op) {
          case "OR": return `((${a}) || (${b}))`;
          case "NOT": return `(!(${a}))`;
          case "XOR": return `((${a}) !== (${b}))`;
          default: return `((${a}) && (${b}))`;
        }
      }
      break;
    }
    case "getValue": {
      if (pinId === "value") {
        const varName = str(props.varName, "score");
        const defVal = num(props.defaultValue, 0);
        return `(typeof __vars !== 'undefined' && __vars[${JSON.stringify(varName)}] !== undefined) ? __vars[${JSON.stringify(varName)}] : ${defVal}`;
      }
      break;
    }
    // R-NODE-EXPANSION: Variables & State — inline resolution.
    case "getVar": {
      if (pinId === "value") {
        const varName = str(props.varName, "score");
        const defVal = num(props.defaultValue, 0);
        return `(typeof __vars !== 'undefined' && __vars[${JSON.stringify(varName)}] !== undefined) ? __vars[${JSON.stringify(varName)}] : ${defVal}`;
      }
      break;
    }
    case "loadState": {
      if (pinId === "value") {
        return `${v}_loaded`;
      }
      break;
    }
  }
  return null;
}

/** Map an entity name (string property) to its JS array expression. */
function entityArrayExpr(name: string, ctx: CompileContext): string {
  const lower = name.toLowerCase();
  if (lower === "player") return "[player]";
  if (lower === "enemy" || lower === "enemies") return "enemies";
  // collectibles: find a collectible node's array
  for (const [nid, node] of ctx.nodesById) {
    if (node.type === "collectible") return `${varName(nid)}_crystals`;
  }
  return "[]";
}

/** HUD: score, timer, HP text. */
function emitHud(ctx: CompileContext): void {
  // Counter → score HUD
  const counterNodes = [...ctx.nodesById.values()].filter((n) => n.type === "counter");
  if (counterNodes.length > 0) {
    const c = counterNodes[0];
    const cv = varName(c.id);
    ctx.renderLines.push(`  drawText('Score: ' + ${cv} + '/' + ${cv}_MAX, vec2(canvasWidth/2, canvasHeight-30), 20, new Color(1,0.85,0.2));`);
  }
  if (ctx.hasTimer) {
    // find the timer node
    const timerNode = [...ctx.nodesById.values()].find((n) => n.type === "onTimerEnd");
    if (timerNode) {
      const tv = varName(timerNode.id);
      ctx.renderLines.push(`  drawText(Math.ceil(${tv}_timeLeft) + 's', vec2(canvasWidth-30, canvasHeight-30), 18, new Color(0.6,0.7,0.8), 0, 'right');`);
    }
  }
  if (ctx.hasPlayer) {
    ctx.renderLines.push(`  drawText('HP: ' + Math.floor(player.hp), vec2(30, canvasHeight-30), 16, player.hp>30?new Color(0.2,0.9,0.5):new Color(0.9,0.2,0.2));`);
  }
}

// ============================================================
// Small utilities
// ============================================================

function varName(nodeId: string): string {
  return "n_" + nodeId.replace(/[^a-zA-Z0-9]/g, "_");
}

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && !isNaN(v)) return v;
  if (typeof v === "string" && !isNaN(Number(v))) return Number(v);
  return fallback;
}

function str(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.length > 0) return v;
  return fallback;
}

// ============================================================
// HTML template (preserved from original, with SFX + overlay)
// ============================================================

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

  // Determine score/timer variables for win()/lose() notifyParent
  const hasCounter = varLines.some((l) => l.startsWith("let n_") && l.includes("_MAX"));
  const scoreExpr = hasCounter
    ? "(typeof n_" + "score !== 'undefined' ? 0 : 0)"
    : "0";

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
    function win() { running=false; resultText.textContent='🎉 Победа!'; overlay.classList.add('show'); notifyParent('win', ${scoreExpr}, 0); }
    function lose() { running=false; resultText.textContent='💀 Поражение'; overlay.classList.add('show'); notifyParent('lose', 0, 0); }

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

// ============================================================
// 3D HTML template (Three.js) — Phase 2.3
// Uses Three.js with shims for the LittleJS API so the same compiled
// node-graph code runs in a 3D scene (player = green cube, enemies =
// red spheres, collectibles = yellow octahedra, base = blue box).
// ============================================================

function generate3DHtml(
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
<title>Node Graph Prototype 3D</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0f172a;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;padding:8px;min-height:100vh;overflow:hidden}
  h1{font-size:14px;margin-bottom:2px}
  .goal{color:#94a3b8;font-size:11px;margin-bottom:4px}
  .steps{font-size:10px;color:#64748b;margin-top:2px;text-align:center}
  .overlay{position:absolute;inset:0;background:rgba(0,0,0,0.88);display:none;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:8px;z-index:10}
  .overlay.show{display:flex}
  .overlay h2{font-size:20px}
  .overlay button{padding:6px 16px;background:#10b981;color:#000;border:none;border-radius:6px;font-weight:700;cursor:pointer}
  #hud{position:absolute;top:4px;left:4px;font-size:11px;color:#e2e8f0;pointer-events:none;z-index:5;text-shadow:0 0 3px #000}
</style>
</head>
<body>
  <h1>🎮 Node Graph Prototype 3D</h1>
  <p class="goal">Compiled from visual graph (Three.js)</p>
  <div style="position:relative;width:100%;max-width:400px;height:300px;border-radius:8px;overflow:hidden;border:1px solid #334155">
    <div id="hud"></div>
    <div class="overlay" id="overlay">
      <h2 id="resultText"></h2>
      <button onclick="location.reload()">Заново</button>
    </div>
  </div>
  <p class="steps">Powered by Three.js • Node-compiled 3D</p>
  <script src="/three.min.js"></script>
  <script>
    ${sfxSnippet}
    // === LittleJS API shims (so compiled 2D-style code runs in 3D) ===
    const canvasWidth = 400, canvasHeight = 300;
    let timeDelta = 0;
    function vec2(x, y) { return { x: x||0, y: y||0, add(v){return vec2(this.x+v.x,this.y+v.y)}, subtract(v){return vec2(this.x-v.x,this.y-v.y)}, multiply(s){return vec2(this.x*s,this.y*s)}, normalize(){const l=Math.hypot(this.x,this.y)||1;return vec2(this.x/l,this.y/l)}, length(){return Math.hypot(this.x,this.y)} }; }
    function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
    function Color(r,g,b,a){ return {r:r,g:g,b:b,a:a===undefined?1:a}; }
    const _keys = {};
    function keyIsDown(k){ return !!_keys[k]; }
    function keyWasPressed(k){ return !!_keysOnce[k]; }
    let _keysOnce = {};
    window.addEventListener('keydown', e => { _keys[e.code] = true; if (!e.repeat) _keysOnce[e.code] = true; });
    window.addEventListener('keyup', e => { _keys[e.code] = false; });
    // Drawing shims — map 2D draw calls to 3D meshes
    const _meshes = [];
    function drawCircle(pos, radius, color, seg, strokeColor, lineWidth) {
      // Reuse or create a sphere mesh for this position
      let m = _circleMeshes[pos.x.toFixed(0)+'_'+pos.y.toFixed(0)];
      if (!m) {
        const geo = new THREE.SphereGeometry(radius * 0.5, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color.r, color.g, color.b) });
        m = new THREE.Mesh(geo, mat);
        scene.add(m); _circleMeshes[pos.x.toFixed(0)+'_'+pos.y.toFixed(0)] = m;
      }
      m.position.set(pos.x - 200, pos.y - 150, 0);
      m.material.color.setRGB(color.r, color.g, color.b);
    }
    const _circleMeshes = {};
    function drawRect(pos, size, color, rot, strokeColor, lineWidth) {
      // background fill — skip (scene background handles it)
      if (size instanceof Color || typeof size === 'number') { /* background call */ return; }
    }
    function drawPolygon(pos, sides, radius, color, rot, strokeColor, lineWidth) {
      let m = _circleMeshes['poly_'+pos.x.toFixed(0)+'_'+pos.y.toFixed(0)];
      if (!m) {
        const geo = new THREE.OctahedronGeometry(radius * 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color.r, color.g, color.b), emissive: new THREE.Color(color.r*0.3, color.g*0.3, color.b*0.3) });
        m = new THREE.Mesh(geo, mat);
        scene.add(m); _circleMeshes['poly_'+pos.x.toFixed(0)+'_'+pos.y.toFixed(0)] = m;
      }
      m.position.set(pos.x - 200, pos.y - 150, 0);
      m.rotation.y += 0.03;
    }
    function drawText(text, pos, size, color, rot, align) {
      const hud = document.getElementById('hud');
      if (hud) hud.textContent = text;
    }
    let particles = [];
    function spawnParticles(pos, n, color) { for (let i=0;i<n;i++) { const a=Math.random()*Math.PI*2; const s=50+Math.random()*100; particles.push({pos:vec2(pos.x+Math.cos(a)*s*0.3,pos.y+Math.sin(a)*s*0.3), vel:vec2(Math.cos(a)*s,Math.sin(a)*s), life:1, color:color}); } }

    // === Three.js setup ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    const camera = new THREE.PerspectiveCamera(60, 400/300, 0.1, 1000);
    camera.position.set(0, 0, 350);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 300);
    document.querySelector('[style*="max-width:400px"]').insertBefore(renderer.domElement, document.getElementById('hud'));
    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const _dl = new THREE.DirectionalLight(0xffffff, 0.8); _dl.position.set(100, 100, 200); scene.add(_dl);
    // Ground plane
    const _ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 300), new THREE.MeshStandardMaterial({color:0x1e293b}));
    _ground.position.z = -20; scene.add(_ground);

    let running = true;
    const overlay = document.getElementById('overlay');
    const resultText = document.getElementById('resultText');
    function notifyParent(outcome, score, duration) { try { window.parent.postMessage({ type: 'gidede-playtest', outcome, score: score||null, duration: duration||30, prototypeType: 'node-graph', mode: '3d' }, '*'); } catch(e){} }
    function win() { running=false; resultText.textContent='🎉 Победа!'; overlay.classList.add('show'); notifyParent('win', 0, 0); }
    function lose() { running=false; resultText.textContent='💀 Поражение'; overlay.classList.add('show'); notifyParent('lose', 0, 0); }

    // === Variables (from graph) ===
    ${varLines.join("\n    ")}

    function gameInit() { ${initLines.join(" ")} }

    function gameUpdate() {
      if (!running) return;
      ${updateLines.join("\n      ")}
      _keysOnce = {}; // clear once-pressed after each frame
    }

    function gameRender() {
      ${renderLines.join("\n      ")}
    }

    // === Main loop ===
    let _last = performance.now();
    function _loop() {
      requestAnimationFrame(_loop);
      const now = performance.now();
      timeDelta = Math.min(0.1, (now - _last) / 1000);
      _last = now;
      gameUpdate();
      // Update particle meshes (simple: skip in 3D, they're cosmetic)
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => { p.life -= timeDelta*1.5; });
      // Clear stale circle meshes each frame (they get recreated by gameRender)
      gameRender();
      renderer.render(scene, camera);
    }
    gameInit();
    _loop();
  </script>
</body>
</html>`;
}
