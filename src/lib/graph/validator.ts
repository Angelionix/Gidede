/**
 * Graph Validator — проверяет NodeGraph перед компиляцией.
 * Проверяет: обязательные ноды, связность, типы пинов, отсутствие циклов.
 */

import type { NodeGraph, GraphNode, GraphEdge } from "./types";
import { NODE_DEFINITIONS } from "./types";

export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  type: "missing_node" | "disconnected" | "type_mismatch" | "cycle" | "warning";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validateGraph(graph: NodeGraph): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!graph.nodes || graph.nodes.length === 0) {
    errors.push({ type: "missing_node", message: "Граф пуст — добавьте ноды" });
    return { valid: false, errors, warnings };
  }

  // 1. Check for at least one Event node
  const eventNodes = graph.nodes.filter((n) => {
    const def = NODE_DEFINITIONS[n.type as keyof typeof NODE_DEFINITIONS];
    return def?.category === "event";
  });
  if (eventNodes.length === 0) {
    errors.push({ type: "missing_node", message: "Нет Event ноды — игра не начнётся" });
  }

  // 2. Check for Win or Lose node
  const outputNodes = graph.nodes.filter((n) => {
    const def = NODE_DEFINITIONS[n.type as keyof typeof NODE_DEFINITIONS];
    return def?.category === "output";
  });
  if (outputNodes.length === 0) {
    errors.push({ type: "missing_node", message: "Нет Win/Lose ноды — нет условия завершения" });
  }

  // 3. Check for Player node (recommended)
  const playerNodes = graph.nodes.filter((n) => n.type === "player");
  if (playerNodes.length === 0) {
    warnings.push({ type: "warning", message: "Нет Player ноды — игрок не сможет управлять прототипом" });
  }

  // 4. Check edges for type mismatches
  for (const edge of graph.edges || []) {
    const sourceNode = graph.nodes.find((n) => n.id === edge.source);
    const targetNode = graph.nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) {
      errors.push({ edgeId: edge.id, type: "disconnected", message: `Связь ${edge.id} указывает на несуществующую ноду` });
      continue;
    }

    const sourceDef = NODE_DEFINITIONS[sourceNode.type as keyof typeof NODE_DEFINITIONS];
    const targetDef = NODE_DEFINITIONS[targetNode.type as keyof typeof NODE_DEFINITIONS];
    if (!sourceDef || !targetDef) continue;

    const sourcePin = sourceDef.outputs.find((p) => p.id === edge.sourceHandle);
    const targetPin = targetDef.inputs.find((p) => p.id === edge.targetHandle);
    if (!sourcePin || !targetPin) continue;

    // exec can connect to exec, data types must match
    if (sourcePin.type === "exec" && targetPin.type !== "exec") {
      errors.push({
        edgeId: edge.id,
        type: "type_mismatch",
        message: `Связь ${edge.id}: exec → ${targetPin.type} (несовместимые типы)`,
      });
    } else if (sourcePin.type !== "exec" && targetPin.type === "exec") {
      errors.push({
        edgeId: edge.id,
        type: "type_mismatch",
        message: `Связь ${edge.id}: ${sourcePin.type} → exec (несовместимые типы)`,
      });
    } else if (sourcePin.type !== "exec" && targetPin.type !== "exec" && sourcePin.type !== targetPin.type) {
      // Allow number → boolean (implicit truthiness), entity → vec2 (position)
      const allowed: Record<string, string[]> = {
        number: ["boolean"],
        entity: ["vec2"],
      };
      if (!allowed[sourcePin.type]?.includes(targetPin.type)) {
        warnings.push({
          edgeId: edge.id,
          type: "type_mismatch",
          message: `Связь ${edge.id}: ${sourcePin.type} → ${targetPin.type} (типы различаются)`,
        });
      }
    }
  }

  // 5. Check for disconnected nodes (no edges)
  for (const node of graph.nodes) {
    const hasEdges = (graph.edges || []).some(
      (e) => e.source === node.id || e.target === node.id
    );
    if (!hasEdges && node.type !== "comment") {
      const def = NODE_DEFINITIONS[node.type as keyof typeof NODE_DEFINITIONS];
      if (def && def.category !== "event") {
        warnings.push({
          nodeId: node.id,
          type: "disconnected",
          message: `Нода "${def.label}" не подключена ни к чему`,
        });
      }
    }
  }

  // 6. Cycle detection (simple DFS)
  const visited = new Set<string>();
  const recursion = new Set<string>();
  for (const node of graph.nodes) {
    if (detectCycle(graph, node.id, visited, recursion)) {
      errors.push({ type: "cycle", message: "Обнаружен цикл в графе выполнения" });
      break;
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

function detectCycle(
  graph: NodeGraph,
  nodeId: string,
  visited: Set<string>,
  recursion: Set<string>
): boolean {
  if (recursion.has(nodeId)) return true;
  if (visited.has(nodeId)) return false;

  visited.add(nodeId);
  recursion.add(nodeId);

  const outgoing = (graph.edges || []).filter((e) => e.source === nodeId);
  for (const edge of outgoing) {
    if (detectCycle(graph, edge.target, visited, recursion)) return true;
  }

  recursion.delete(nodeId);
  return false;
}
