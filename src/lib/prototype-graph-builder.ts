/**
 * Gidede — Prototype Graph Builder.
 *
 * Превращает данные ProjectCoreLoop (шаги, ресурсы, тип) в NodeGraph JSON,
 * который затем компилируется в HTML через graph/compiler.ts compileGraph().
 *
 * Это унифицирует два пути генерации прототипов:
 *   - /api/v1/prototypes/generate (server-side, from CoreLoop data)
 *   - /api/v1/prototype-graph/compile (client-side, from node-editor graph)
 * Оба теперь используют один и тот же compileGraph() → единый HTML-вывод.
 *
 * Поддерживает 10 типов прототипов:
 *   engine | economy | ecology | tower_defense | rhythm | puzzle
 *   platformer | stealth | deck_builder | survival_horror
 *
 * Каждый тип → функция buildXxxGraph(config): NodeGraph
 *   использует существующие 20 нод из NODE_DEFINITIONS.
 */

import type { NodeGraph, GraphNode, GraphEdge, NodeType } from "./graph/types";

// ============================================================
// Types
// ============================================================

export type PrototypeType =
  | "engine"
  | "economy"
  | "ecology"
  | "tower_defense"
  | "rhythm"
  | "puzzle"
  | "platformer"
  | "stealth"
  | "deck_builder"
  | "survival_horror";

export interface PrototypeBuildConfig {
  type: PrototypeType;
  mode: "2d" | "3d";
  /** Человекочитаемые шаги core loop (до 5). */
  steps: string[];
  /** Параметры из upstream артефактов (Balance, Progression, Economy). */
  params?: PrototypeParams;
}

export interface PrototypeParams {
  /** Из Balance: скорость игрока, урон врага, ценность collectible. */
  playerSpeed?: number;
  enemyDamage?: number;
  enemySpeed?: number;
  collectibleValue?: number;
  /** Из Progression: целевые уровни, порог counters. */
  targetLevel?: number;
  counterThreshold?: number;
  /** Из Economy: имя/иконка ресурса. */
  resourceName?: string;
  resourceIcon?: string;
  /** Общие параметры. */
  goalScore?: number;
  survivalSeconds?: number;
}

interface NodeSpec {
  id: string;
  type: NodeType;
  x: number;
  y: number;
  props?: Record<string, unknown>;
}

interface EdgeSpec {
  from: string;
  fromHandle: string;
  to: string;
  toHandle: string | null;
}

// ============================================================
// Helpers
// ============================================================

let nodeCounter = 0;
function nid(prefix: string): string {
  nodeCounter += 1;
  return `${prefix}_${nodeCounter}`;
}

function makeNode(spec: NodeSpec): GraphNode {
  return {
    id: spec.id,
    type: spec.type,
    position: { x: spec.x, y: spec.y },
    data: { label: spec.type, properties: spec.props ?? {} },
  };
}

function makeEdge(spec: EdgeSpec): GraphEdge {
  return {
    id: `e_${spec.from}_${spec.to}_${spec.fromHandle}_${spec.toHandle ?? ""}`,
    source: spec.from,
    sourceHandle: spec.fromHandle,
    target: spec.to,
    targetHandle: spec.toHandle,
  };
}

function buildGraph(
  nodes: NodeSpec[],
  edges: EdgeSpec[],
  mode: "2d" | "3d",
): NodeGraph {
  return {
    version: "1.0",
    nodes: nodes.map(makeNode),
    edges: edges.map(makeEdge),
    settings: {
      mode,
      canvasSize: { width: 400, height: 300 },
      targetFps: 60,
      backgroundColor: "#0f172a",
    },
  };
}

// ============================================================
// 1. ENGINE — ресурс генерируется со временем (farming-like)
// ============================================================

export function buildEngineGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const collectValue = p.collectibleValue ?? 3;
  const threshold = p.counterThreshold ?? p.goalScore ?? 50;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 150, controlScheme: "wasd" } },
    { id: "collect", type: "collectible", x: 250, y: 60, props: { value: collectValue, count: 5, respawn: true } },
    { id: "counter", type: "counter", x: 250, y: 200, props: { startValue: 0, threshold } },
    { id: "win", type: "win", x: 450, y: 200, props: { message: `Собрано ${threshold} энергии!` } },
    { id: "timer", type: "onTimerEnd", x: 250, y: 320, props: { duration: p.survivalSeconds ?? 30 } },
    { id: "lose", type: "lose", x: 450, y: 320, props: { message: "Время вышло!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "collect", toHandle: null },
    { from: "collect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 2. ECONOMY — конвертация ресурсов (crafting-like)
// ============================================================

export function buildEconomyGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const threshold = p.counterThreshold ?? p.goalScore ?? 100;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 150, controlScheme: "wasd" } },
    { id: "collect", type: "collectible", x: 250, y: 60, props: { value: 1, count: 6, respawn: true } },
    { id: "convertKey", type: "onKey", x: 50, y: 270, props: { keyCode: "KeyC" } },
    { id: "counter", type: "counter", x: 250, y: 200, props: { startValue: 0, threshold } },
    { id: "win", type: "win", x: 450, y: 200, props: { message: `Заработано ${threshold} золота!` } },
    { id: "timer", type: "onTimerEnd", x: 250, y: 320, props: { duration: p.survivalSeconds ?? 45 } },
    { id: "lose", type: "lose", x: 450, y: 320, props: { message: "Время вышло!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "collect", toHandle: null },
    { from: "collect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "convertKey", fromHandle: "exec", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 3. ECOLOGY — конкуренция/давление (survival-like)
// ============================================================

export function buildEcologyGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const playerHp = p.goalScore ?? 100;
  const duration = p.survivalSeconds ?? 30;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 200, controlScheme: "wasd" } },
    { id: "base", type: "base", x: 350, y: 160, props: { maxHp: playerHp, isWinCondition: true } },
    { id: "spawner", type: "spawner", x: 200, y: 60, props: { entityType: "enemy", interval: 1.5 } },
    { id: "enemy", type: "enemy", x: 200, y: 160, props: { speed: p.enemySpeed ?? 80, damage: p.enemyDamage ?? 10, spawnRate: 1.5 } },
    { id: "timer", type: "onTimerEnd", x: 200, y: 270, props: { duration } },
    { id: "win", type: "win", x: 450, y: 270, props: { message: `Выжили ${duration} секунд!` } },
    { id: "lose", type: "lose", x: 450, y: 100, props: { message: "Здоровье закончилось!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "spawner", toHandle: "trigger" },
    { from: "enemy", fromHandle: "onCollide", to: "base", toHandle: null },
    { from: "base", fromHandle: "onDestroyed", to: "lose", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "win", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 4. TOWER DEFENSE — защита базы от волн
// ============================================================

export function buildTowerDefenseGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const baseHp = p.goalScore ?? 100;
  const waveCount = p.counterThreshold ?? 15;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "spawner", type: "spawner", x: 50, y: 160, props: { entityType: "enemy", interval: 2.0 } },
    { id: "enemy", type: "enemy", x: 200, y: 160, props: { speed: p.enemySpeed ?? 60, damage: p.enemyDamage ?? 20, spawnRate: 2 } },
    { id: "base", type: "base", x: 350, y: 160, props: { maxHp: baseHp, isWinCondition: true } },
    { id: "counter", type: "counter", x: 200, y: 270, props: { startValue: 0, threshold: waveCount } },
    { id: "win", type: "win", x: 450, y: 270, props: { message: `Отбито ${waveCount} волн!` } },
    { id: "lose", type: "lose", x: 450, y: 100, props: { message: "База разрушена!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "spawner", toHandle: "trigger" },
    { from: "enemy", fromHandle: "onCollide", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "base", fromHandle: "onDestroyed", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 5. RHYTHM — ловля битов в ритме
// ============================================================

export function buildRhythmGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const beatsToWin = p.counterThreshold ?? 10;
  const duration = p.survivalSeconds ?? 30;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "key", type: "onKey", x: 50, y: 160, props: { keyCode: "Space" } },
    { id: "counter", type: "counter", x: 200, y: 160, props: { startValue: 0, threshold: beatsToWin } },
    { id: "win", type: "win", x: 450, y: 160, props: { message: `Поймано ${beatsToWin} бит!` } },
    { id: "timer", type: "onTimerEnd", x: 200, y: 270, props: { duration } },
    { id: "lose", type: "lose", x: 450, y: 270, props: { message: "Время вышло!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "key", toHandle: null },
    { from: "key", fromHandle: "exec", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 6. PUZZLE — собери линии (тетрис-подобный)
// ============================================================

export function buildPuzzleGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const linesToWin = p.counterThreshold ?? 3;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "placeKey", type: "onKey", x: 50, y: 160, props: { keyCode: "Enter" } },
    { id: "collect", type: "collectible", x: 200, y: 60, props: { value: 1, count: linesToWin, respawn: false } },
    { id: "counter", type: "counter", x: 200, y: 200, props: { startValue: 0, threshold: linesToWin } },
    { id: "win", type: "win", x: 450, y: 200, props: { message: `Собрано ${linesToWin} линий!` } },
    { id: "timer", type: "onTimerEnd", x: 200, y: 320, props: { duration: p.survivalSeconds ?? 60 } },
    { id: "lose", type: "lose", x: 450, y: 320, props: { message: "Время вышло!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "placeKey", toHandle: null },
    { from: "start", fromHandle: "exec", to: "collect", toHandle: null },
    { from: "collect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 7. PLATFORMER — прыжки по платформам, сбор цели
// ============================================================

export function buildPlatformerGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const goal = p.counterThreshold ?? 5;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 180, controlScheme: "arrows" } },
    { id: "jumpKey", type: "onKey", x: 50, y: 270, props: { keyCode: "Space" } },
    { id: "collect", type: "collectible", x: 250, y: 60, props: { value: 1, count: goal, respawn: false } },
    { id: "counter", type: "counter", x: 250, y: 200, props: { startValue: 0, threshold: goal } },
    { id: "win", type: "win", x: 450, y: 200, props: { message: `Собрано ${goal} звёзд!` } },
    { id: "enemy", type: "enemy", x: 250, y: 320, props: { speed: p.enemySpeed ?? 50, damage: 100, spawnRate: 0 } },
    { id: "lose", type: "lose", x: 450, y: 320, props: { message: "Коснулись врага!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "collect", toHandle: null },
    { from: "start", fromHandle: "exec", to: "enemy", toHandle: null },
    { from: "jumpKey", fromHandle: "exec", to: "player", toHandle: null },
    { from: "collect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "enemy", fromHandle: "onCollide", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 8. STEALTH — обойди врагов, достигни цели
// ============================================================

export function buildStealthGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const goal = p.counterThreshold ?? 1;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 120, controlScheme: "wasd" } },
    { id: "enemy", type: "enemy", x: 250, y: 100, props: { speed: p.enemySpeed ?? 60, damage: 100, spawnRate: 1.5 } },
    { id: "enemy2", type: "enemy", x: 250, y: 250, props: { speed: p.enemySpeed ?? 70, damage: 100, spawnRate: 2.0 } },
    { id: "collect", type: "collectible", x: 380, y: 200, props: { value: 1, count: goal, respawn: false } },
    { id: "counter", type: "counter", x: 380, y: 280, props: { startValue: 0, threshold: goal } },
    { id: "win", type: "win", x: 500, y: 280, props: { message: "Достигнута цель!" } },
    { id: "lose", type: "lose", x: 500, y: 100, props: { message: "Обнаружены!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "enemy", toHandle: null },
    { from: "start", fromHandle: "exec", to: "enemy2", toHandle: null },
    { from: "start", fromHandle: "exec", to: "collect", toHandle: null },
    { from: "collect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "enemy", fromHandle: "onCollide", to: "lose", toHandle: "trigger" },
    { from: "enemy2", fromHandle: "onCollide", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 9. DECK BUILDER — карты как collectible, колода растёт
// ============================================================

export function buildDeckBuilderGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const deckSize = p.counterThreshold ?? 7;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 160, controlScheme: "wasd" } },
    { id: "drawKey", type: "onKey", x: 50, y: 270, props: { keyCode: "KeyD" } },
    { id: "collect", type: "collectible", x: 250, y: 60, props: { value: 1, count: deckSize, respawn: true } },
    { id: "counter", type: "counter", x: 250, y: 200, props: { startValue: 0, threshold: deckSize } },
    { id: "win", type: "win", x: 450, y: 200, props: { message: `Собрана колода из ${deckSize} карт!` } },
    { id: "timer", type: "onTimerEnd", x: 250, y: 320, props: { duration: p.survivalSeconds ?? 60 } },
    { id: "lose", type: "lose", x: 450, y: 320, props: { message: "Время вышло!" } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "collect", toHandle: null },
    { from: "drawKey", fromHandle: "exec", to: "player", toHandle: null },
    { from: "collect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "counter", fromHandle: "onThreshold", to: "win", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "lose", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// 10. SURVIVAL HORROR —有限的资源, давление, страх
// ============================================================

export function buildSurvivalHorrorGraph(config: PrototypeBuildConfig): NodeGraph {
  const p = config.params ?? {};
  const duration = p.survivalSeconds ?? 60;
  const torchCount = p.counterThreshold ?? 5;

  const nodes: NodeSpec[] = [
    { id: "start", type: "onGameStart", x: 50, y: 50 },
    { id: "player", type: "player", x: 50, y: 160, props: { speed: p.playerSpeed ?? 100, controlScheme: "wasd" } },
    { id: "torchCollect", type: "collectible", x: 250, y: 60, props: { value: 1, count: torchCount, respawn: false } },
    { id: "counter", type: "counter", x: 250, y: 200, props: { startValue: 0, threshold: torchCount } },
    { id: "enemy", type: "enemy", x: 250, y: 320, props: { speed: p.enemySpeed ?? 90, damage: p.enemyDamage ?? 100, spawnRate: 2.5 } },
    { id: "spawner", type: "spawner", x: 100, y: 320, props: { entityType: "enemy", interval: 3.0 } },
    { id: "timer", type: "onTimerEnd", x: 400, y: 270, props: { duration } },
    { id: "win", type: "win", x: 550, y: 200, props: { message: `Выжили ${duration} секунд в темноте!` } },
    { id: "lose", type: "lose", x: 550, y: 320, props: { message: "Тьма поглотила..." } },
  ];

  const edges: EdgeSpec[] = [
    { from: "start", fromHandle: "exec", to: "player", toHandle: null },
    { from: "start", fromHandle: "exec", to: "torchCollect", toHandle: null },
    { from: "start", fromHandle: "exec", to: "spawner", toHandle: "trigger" },
    { from: "torchCollect", fromHandle: "onCollect", to: "counter", toHandle: "increment" },
    { from: "enemy", fromHandle: "onCollide", to: "lose", toHandle: "trigger" },
    { from: "timer", fromHandle: "exec", to: "win", toHandle: "trigger" },
  ];

  return buildGraph(nodes, edges, config.mode);
}

// ============================================================
// Dispatcher
// ============================================================

const BUILDERS: Record<PrototypeType, (config: PrototypeBuildConfig) => NodeGraph> = {
  engine: buildEngineGraph,
  economy: buildEconomyGraph,
  ecology: buildEcologyGraph,
  tower_defense: buildTowerDefenseGraph,
  rhythm: buildRhythmGraph,
  puzzle: buildPuzzleGraph,
  platformer: buildPlatformerGraph,
  stealth: buildStealthGraph,
  deck_builder: buildDeckBuilderGraph,
  survival_horror: buildSurvivalHorrorGraph,
};

export function buildPrototypeGraph(config: PrototypeBuildConfig): NodeGraph {
  const builder = BUILDERS[config.type] ?? BUILDERS.engine;
  // Reset node counter for deterministic IDs.
  nodeCounter = 0;
  return builder(config);
}

export const PROTOTYPE_TYPES: PrototypeType[] = [
  "engine",
  "economy",
  "ecology",
  "tower_defense",
  "rhythm",
  "puzzle",
  "platformer",
  "stealth",
  "deck_builder",
  "survival_horror",
];
