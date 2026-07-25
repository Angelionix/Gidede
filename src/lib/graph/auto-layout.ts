/**
 * Auto-layout helper for the prototype node editor.
 *
 * Uses dagre (hierarchical layered layout) to compute optimal x/y positions
 * for a set of React Flow nodes given their edge relationships. Returns a
 * new array of nodes with updated `position` fields — original nodes are
 * not mutated.
 *
 * Direction is top-to-bottom (TB) which matches the natural flow of
 * Event → Entity → Output graphs in the Gidede node editor.
 */

import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

export interface AutoLayoutOptions {
  /** Layout direction. Default "TB" (top-to-bottom). */
  rankdir?: "TB" | "LR" | "BT" | "RL";
  /** Rank spacing in px. Default 80. */
  ranksep?: number;
  /** Node spacing within a rank in px. Default 40. */
  nodesep?: number;
}

/**
 * Compute auto-laid-out positions for the given nodes/edges.
 * Returns a new nodes array with updated `position` fields.
 */
export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  options: AutoLayoutOptions = {}
): Node[] {
  const {
    rankdir = "TB",
    ranksep = 80,
    nodesep = 40,
  } = options;

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir, ranksep, nodesep, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    // Only lay out edges between nodes that exist in the graph.
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const laid = g.node(node.id);
    if (!laid) return node;
    return {
      ...node,
      // dagre returns the center of the node; React Flow positions by
      // top-left corner, so subtract half the dimensions.
      position: {
        x: laid.x - NODE_WIDTH / 2,
        y: laid.y - NODE_HEIGHT / 2,
      },
    };
  });
}
