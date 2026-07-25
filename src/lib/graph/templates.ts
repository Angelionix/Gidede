/**
 * 5 graph templates for quick start.
 * Each template is a NodeGraph JSON that can be loaded into the editor.
 */
import type { NodeGraph, GraphNode, GraphEdge } from "./types";

function makeNode(id: string, type: string, x: number, y: number, props: Record<string, unknown> = {}): GraphNode {
  return {
    id,
    type: type as GraphNode["type"],
    position: { x, y },
    data: { label: type, properties: props },
  };
}

export const GRAPH_TEMPLATES: Record<string, { name: string; description: string; graph: NodeGraph }> = {
  collector: {
    name: "Collector",
    description: "Собери 5 кристаллов — Player + Collectibles + Counter + Win",
    graph: {
      version: "1.0",
      settings: { mode: "2d", canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      nodes: [
        makeNode("n1", "onGameStart", 50, 50),
        makeNode("n2", "player", 50, 150, { speed: 150, controlScheme: "wasd" }),
        makeNode("n3", "collectible", 250, 50, { value: 1, count: 5, respawn: true }),
        makeNode("n4", "counter", 250, 200, { startValue: 0, threshold: 5 }),
        makeNode("n5", "win", 450, 200, { message: "Собрано 5 кристаллов!" }),
      ],
      edges: [
        { id: "e1", source: "n1", sourceHandle: "exec", target: "n2", targetHandle: null },
        { id: "e2", source: "n3", sourceHandle: "onCollect", target: "n4", targetHandle: "increment" },
        { id: "e3", source: "n4", sourceHandle: "onThreshold", target: "n5", targetHandle: "trigger" },
      ],
    },
  },
  survival: {
    name: "Survival",
    description: "Выживи 30 секунд — Player + Enemy spawner + HP + Lose + Timer",
    graph: {
      version: "1.0",
      settings: { mode: "2d", canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      nodes: [
        makeNode("n1", "onGameStart", 50, 50),
        makeNode("n2", "player", 50, 150, { speed: 200, controlScheme: "wasd" }),
        makeNode("n3", "spawner", 250, 50, { entityType: "enemy", interval: 1.5 }),
        makeNode("n4", "enemy", 250, 150, { speed: 80, damage: 10, spawnRate: 1.5 }),
        makeNode("n5", "base", 450, 150, { maxHp: 100, isWinCondition: true }),
        makeNode("n6", "onTimerEnd", 250, 250, { duration: 30 }),
        makeNode("n7", "win", 450, 250, { message: "Выжили 30 секунд!" }),
        makeNode("n8", "lose", 450, 50, { message: "База разрушена!" }),
      ],
      edges: [
        { id: "e1", source: "n1", sourceHandle: "exec", target: "n2", targetHandle: null },
        { id: "e2", source: "n1", sourceHandle: "exec", target: "n3", targetHandle: "trigger" },
        { id: "e3", source: "n4", sourceHandle: "onCollide", target: "n5", targetHandle: null },
        { id: "e4", source: "n5", sourceHandle: "onDestroyed", target: "n8", targetHandle: "trigger" },
        { id: "e5", source: "n6", sourceHandle: "exec", target: "n7", targetHandle: "trigger" },
      ],
    },
  },
  tower_defense: {
    name: "Tower Defense",
    description: "Защити базу от 3 волн — Base + Enemy waves + Counter + Win/Lose",
    graph: {
      version: "1.0",
      settings: { mode: "2d", canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      nodes: [
        makeNode("n1", "onGameStart", 50, 50),
        makeNode("n2", "spawner", 50, 150, { entityType: "enemy", interval: 2.0 }),
        makeNode("n3", "enemy", 200, 150, { speed: 60, damage: 20, spawnRate: 2 }),
        makeNode("n4", "base", 350, 150, { maxHp: 100, isWinCondition: true }),
        makeNode("n5", "counter", 200, 250, { startValue: 0, threshold: 15 }),
        makeNode("n6", "win", 350, 250, { message: "Все волны отбиты!" }),
        makeNode("n7", "lose", 350, 50, { message: "База пала!" }),
      ],
      edges: [
        { id: "e1", source: "n1", sourceHandle: "exec", target: "n2", targetHandle: "trigger" },
        { id: "e2", source: "n3", sourceHandle: "onCollide", target: "n4", targetHandle: null },
        { id: "e3", source: "n4", sourceHandle: "onDestroyed", target: "n7", targetHandle: "trigger" },
        { id: "e4", source: "n5", sourceHandle: "onThreshold", target: "n6", targetHandle: "trigger" },
      ],
    },
  },
  rhythm: {
    name: "Rhythm",
    description: "Поймай 10 бит — Timer + Keyboard + Counter + Win",
    graph: {
      version: "1.0",
      settings: { mode: "2d", canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      nodes: [
        makeNode("n1", "onGameStart", 50, 50),
        makeNode("n2", "onKey", 50, 150, { keyCode: "Space" }),
        makeNode("n3", "counter", 200, 150, { startValue: 0, threshold: 10 }),
        makeNode("n4", "win", 350, 150, { message: "10 бит поймано!" }),
        makeNode("n5", "onTimerEnd", 200, 250, { duration: 30 }),
        makeNode("n6", "lose", 350, 250, { message: "Время вышло!" }),
      ],
      edges: [
        { id: "e1", source: "n1", sourceHandle: "exec", target: "n2", targetHandle: null },
        { id: "e2", source: "n2", sourceHandle: "exec", target: "n3", targetHandle: "increment" },
        { id: "e3", source: "n3", sourceHandle: "onThreshold", target: "n4", targetHandle: "trigger" },
        { id: "e4", source: "n5", sourceHandle: "exec", target: "n6", targetHandle: "trigger" },
      ],
    },
  },
  puzzle: {
    name: "Puzzle",
    description: "Собери 3 линии — Grid + Place + Counter + Win",
    graph: {
      version: "1.0",
      settings: { mode: "2d", canvasSize: { width: 400, height: 300 }, targetFps: 60, backgroundColor: "#0f172a" },
      nodes: [
        makeNode("n1", "onGameStart", 50, 50),
        makeNode("n2", "onKey", 50, 150, { keyCode: "Enter" }),
        makeNode("n3", "collectible", 200, 50, { value: 1, count: 3, respawn: false }),
        makeNode("n4", "counter", 200, 200, { startValue: 0, threshold: 3 }),
        makeNode("n5", "win", 350, 200, { message: "3 линии собрано!" }),
      ],
      edges: [
        { id: "e1", source: "n1", sourceHandle: "exec", target: "n2", targetHandle: null },
        { id: "e2", source: "n3", sourceHandle: "onCollect", target: "n4", targetHandle: "increment" },
        { id: "e3", source: "n4", sourceHandle: "onThreshold", target: "n5", targetHandle: "trigger" },
      ],
    },
  },
};
