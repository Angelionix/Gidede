/**
 * Node Graph types for Prototype Editor.
 * Based on React Flow data model with game-specific extensions.
 */

export type NodeType =
  | "onGameStart"
  | "onTick"
  | "onCollision"
  | "onKey"
  | "onTimerEnd"
  | "player"
  | "enemy"
  | "collectible"
  | "base"
  | "spawner"
  | "branch"
  | "forEach"
  | "delay"
  | "sequence"
  | "counter"
  | "random"
  | "math"
  | "array"
  | "win"
  | "lose"
  | "comment"
  // R-NODE-EXPANSION: Math & Logic (8 new nodes)
  | "clamp"
  | "lerp"
  | "distance"
  | "angle"
  | "compare"
  | "boolOp"
  | "switch"
  | "getValue";

export type PinType = "exec" | "number" | "string" | "boolean" | "vec2" | "entity" | "array";

export interface NodePin {
  id: string;
  label: string;
  type: PinType;
}

export interface NodeDefinition {
  type: NodeType;
  label: string;
  icon: string;
  category: "event" | "entity" | "flow" | "data" | "output";
  color: string;
  inputs: NodePin[];
  outputs: NodePin[];
  defaultProperties: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    properties: Record<string, unknown>;
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  sourceHandle: string | null;
  target: string;
  targetHandle: string | null;
}

export interface NodeGraph {
  version: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  settings: {
    mode: "2d" | "3d";
    canvasSize: { width: number; height: number };
    targetFps: number;
    backgroundColor: string;
  };
}

// ============================================================
// Node Definitions — 20 types
// ============================================================

export const NODE_DEFINITIONS: Record<NodeType, NodeDefinition> = {
  // --- Events (5) ---
  onGameStart: {
    type: "onGameStart",
    label: "Game Start",
    icon: "🎮",
    category: "event",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "exec", label: "→", type: "exec" }],
    defaultProperties: {},
  },
  onTick: {
    type: "onTick",
    label: "Every Frame",
    icon: "⏱",
    category: "event",
    color: "#3b82f6",
    inputs: [],
    outputs: [
      { id: "exec", label: "→", type: "exec" },
      { id: "deltaTime", label: "dt", type: "number" },
    ],
    defaultProperties: {},
  },
  onCollision: {
    type: "onCollision",
    label: "On Collision",
    icon: "💥",
    category: "event",
    color: "#3b82f6",
    inputs: [
      { id: "entityA", label: "A", type: "entity" },
      { id: "entityB", label: "B", type: "entity" },
    ],
    outputs: [{ id: "exec", label: "→", type: "exec" }],
    defaultProperties: { entityA: "player", entityB: "enemy" },
  },
  onKey: {
    type: "onKey",
    label: "On Key",
    icon: "⌨️",
    category: "event",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "exec", label: "→", type: "exec" }],
    defaultProperties: { keyCode: "Space" },
  },
  onTimerEnd: {
    type: "onTimerEnd",
    label: "Timer End",
    icon: "🎯",
    category: "event",
    color: "#3b82f6",
    inputs: [],
    outputs: [{ id: "exec", label: "→", type: "exec" }],
    defaultProperties: { duration: 30 },
  },

  // --- Entities (5) ---
  player: {
    type: "player",
    label: "Player",
    icon: "👤",
    category: "entity",
    color: "#f59e0b",
    inputs: [],
    outputs: [
      { id: "position", label: "pos", type: "vec2" },
      { id: "onMove", label: "move", type: "exec" },
    ],
    defaultProperties: { speed: 150, controlScheme: "wasd" },
  },
  enemy: {
    type: "enemy",
    label: "Enemy",
    icon: "👾",
    category: "entity",
    color: "#f59e0b",
    inputs: [{ id: "target", label: "target", type: "vec2" }],
    outputs: [
      { id: "position", label: "pos", type: "vec2" },
      { id: "onCollide", label: "collide", type: "exec" },
    ],
    defaultProperties: { speed: 80, damage: 10, spawnRate: 1.5 },
  },
  collectible: {
    type: "collectible",
    label: "Collectible",
    icon: "💎",
    category: "entity",
    color: "#f59e0b",
    inputs: [],
    outputs: [
      { id: "onCollect", label: "collect", type: "exec" },
      { id: "position", label: "pos", type: "vec2" },
    ],
    defaultProperties: { value: 1, count: 5, respawn: true },
  },
  base: {
    type: "base",
    label: "Base/Goal",
    icon: "🏰",
    category: "entity",
    color: "#f59e0b",
    inputs: [],
    outputs: [
      { id: "hp", label: "hp", type: "number" },
      { id: "onDestroyed", label: "destroyed", type: "exec" },
    ],
    defaultProperties: { maxHp: 100, isWinCondition: true },
  },
  spawner: {
    type: "spawner",
    label: "Spawner",
    icon: "✨",
    category: "entity",
    color: "#f59e0b",
    inputs: [{ id: "trigger", label: "→", type: "exec" }],
    outputs: [{ id: "spawned", label: "entity", type: "entity" }],
    defaultProperties: { entityType: "enemy", interval: 2.0 },
  },

  // --- Flow Control (4) ---
  branch: {
    type: "branch",
    label: "Branch (If)",
    icon: "🔀",
    category: "flow",
    color: "#8b5cf6",
    inputs: [
      { id: "exec", label: "→", type: "exec" },
      { id: "condition", label: "cond", type: "boolean" },
    ],
    outputs: [
      { id: "true", label: "true", type: "exec" },
      { id: "false", label: "false", type: "exec" },
    ],
    defaultProperties: {},
  },
  forEach: {
    type: "forEach",
    label: "For Each",
    icon: "🔁",
    category: "flow",
    color: "#8b5cf6",
    inputs: [
      { id: "exec", label: "→", type: "exec" },
      { id: "array", label: "array", type: "array" },
    ],
    outputs: [
      { id: "loop", label: "→", type: "exec" },
      { id: "item", label: "item", type: "entity" },
    ],
    defaultProperties: {},
  },
  delay: {
    type: "delay",
    label: "Delay",
    icon: "⏳",
    category: "flow",
    color: "#8b5cf6",
    inputs: [{ id: "exec", label: "→", type: "exec" }],
    outputs: [{ id: "exec", label: "→", type: "exec" }],
    defaultProperties: { seconds: 2.0 },
  },
  sequence: {
    type: "sequence",
    label: "Sequence",
    icon: "🔢",
    category: "flow",
    color: "#8b5cf6",
    inputs: [{ id: "exec", label: "→", type: "exec" }],
    outputs: [
      { id: "out0", label: "1", type: "exec" },
      { id: "out1", label: "2", type: "exec" },
      { id: "out2", label: "3", type: "exec" },
    ],
    defaultProperties: {},
  },

  // --- Data (4) ---
  counter: {
    type: "counter",
    label: "Counter",
    icon: "🧮",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "increment", label: "+1", type: "exec" },
      { id: "reset", label: "reset", type: "exec" },
    ],
    outputs: [
      { id: "value", label: "value", type: "number" },
      { id: "onThreshold", label: "≥ max", type: "exec" },
    ],
    defaultProperties: { startValue: 0, threshold: 5 },
  },
  random: {
    type: "random",
    label: "Random",
    icon: "🎲",
    category: "data",
    color: "#10b981",
    inputs: [{ id: "trigger", label: "→", type: "exec" }],
    outputs: [{ id: "value", label: "value", type: "number" }],
    defaultProperties: { min: 0, max: 100 },
  },
  math: {
    type: "math",
    label: "Math",
    icon: "➗",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "a", label: "a", type: "number" },
      { id: "b", label: "b", type: "number" },
    ],
    outputs: [{ id: "result", label: "result", type: "number" }],
    defaultProperties: { operation: "+" },
  },
  array: {
    type: "array",
    label: "Array",
    icon: "📋",
    category: "data",
    color: "#10b981",
    inputs: [{ id: "add", label: "add", type: "entity" }],
    outputs: [
      { id: "array", label: "array", type: "array" },
      { id: "count", label: "count", type: "number" },
    ],
    defaultProperties: { initialSize: 0 },
  },

  // --- Output (2) ---
  win: {
    type: "win",
    label: "Win!",
    icon: "🏆",
    category: "output",
    color: "#ef4444",
    inputs: [{ id: "trigger", label: "→", type: "exec" }],
    outputs: [],
    defaultProperties: { message: "Победа!" },
  },
  lose: {
    type: "lose",
    label: "Lose",
    icon: "💀",
    category: "output",
    color: "#ef4444",
    inputs: [{ id: "trigger", label: "→", type: "exec" }],
    outputs: [],
    defaultProperties: { message: "Поражение" },
  },

  // --- Utility ---
  comment: {
    type: "comment",
    label: "Comment",
    icon: "📝",
    category: "data",
    color: "#64748b",
    inputs: [],
    outputs: [],
    defaultProperties: { text: "Comment..." },
  },

  // ============================================================
  // R-NODE-EXPANSION: Math & Logic (8 new nodes)
  // ============================================================
  clamp: {
    type: "clamp",
    label: "Clamp",
    icon: "📏",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "value", label: "v", type: "number" },
      { id: "min", label: "min", type: "number" },
      { id: "max", label: "max", type: "number" },
    ],
    outputs: [{ id: "result", label: "result", type: "number" }],
    defaultProperties: { min: 0, max: 100 },
  },
  lerp: {
    type: "lerp",
    label: "Lerp",
    icon: "📈",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "a", label: "a", type: "number" },
      { id: "b", label: "b", type: "number" },
      { id: "t", label: "t", type: "number" },
    ],
    outputs: [{ id: "result", label: "result", type: "number" }],
    defaultProperties: { a: 0, b: 100, t: 0.5 },
  },
  distance: {
    type: "distance",
    label: "Distance",
    icon: "📐",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "a", label: "a", type: "vec2" },
      { id: "b", label: "b", type: "vec2" },
    ],
    outputs: [{ id: "result", label: "dist", type: "number" }],
    defaultProperties: {},
  },
  angle: {
    type: "angle",
    label: "Angle",
    icon: "🧭",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "a", label: "a", type: "vec2" },
      { id: "b", label: "b", type: "vec2" },
    ],
    outputs: [{ id: "result", label: "angle", type: "number" }],
    defaultProperties: {},
  },
  compare: {
    type: "compare",
    label: "Compare",
    icon: "⚖️",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "a", label: "a", type: "number" },
      { id: "b", label: "b", type: "number" },
    ],
    outputs: [{ id: "result", label: "result", type: "boolean" }],
    defaultProperties: { operation: "==" },
  },
  boolOp: {
    type: "boolOp",
    label: "Bool Op",
    icon: "🔗",
    category: "data",
    color: "#10b981",
    inputs: [
      { id: "a", label: "a", type: "boolean" },
      { id: "b", label: "b", type: "boolean" },
    ],
    outputs: [{ id: "result", label: "result", type: "boolean" }],
    defaultProperties: { operation: "AND" },
  },
  switch: {
    type: "switch",
    label: "Switch",
    icon: "🔀",
    category: "flow",
    color: "#8b5cf6",
    inputs: [
      { id: "exec", label: "→", type: "exec" },
      { id: "index", label: "idx", type: "number" },
    ],
    outputs: [
      { id: "out0", label: "0", type: "exec" },
      { id: "out1", label: "1", type: "exec" },
      { id: "out2", label: "2", type: "exec" },
      { id: "out3", label: "3", type: "exec" },
    ],
    defaultProperties: {},
  },
  getValue: {
    type: "getValue",
    label: "Get Value",
    icon: "📥",
    category: "data",
    color: "#10b981",
    inputs: [{ id: "trigger", label: "→", type: "exec" }],
    outputs: [{ id: "value", label: "value", type: "number" }],
    defaultProperties: { varName: "score", defaultValue: 0 },
  },
};

export const NODE_CATEGORIES = [
  { id: "event", label: "Events", color: "#3b82f6" },
  { id: "entity", label: "Entities", color: "#f59e0b" },
  { id: "flow", label: "Flow Control", color: "#8b5cf6" },
  { id: "data", label: "Data", color: "#10b981" },
  { id: "output", label: "Output", color: "#ef4444" },
] as const;

export const PIN_COLORS: Record<PinType, string> = {
  exec: "#ef4444",
  number: "#3b82f6",
  string: "#ec4899",
  boolean: "#f59e0b",
  vec2: "#10b981",
  entity: "#8b5cf6",
  array: "#06b6d4",
};
