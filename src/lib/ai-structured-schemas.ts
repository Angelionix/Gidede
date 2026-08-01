import { z } from "zod";

const boundedText = (maximum: number) => z.string().trim().min(1).max(maximum);

export const conceptEnrichmentSchema = z.object({
  story_synopsis: boundedText(4_000),
  gameplay_description: boundedText(6_000),
  unique_features: z.array(boundedText(1_000)).min(1).max(8),
  ai_insights: z.string().trim().max(4_000).default(""),
}).strict();

export const customMechanicSchema = z.object({
  mechanicName: boundedText(200),
  description: boundedText(4_000),
  codeSnippet: z.string().max(20_000).default(""),
}).strict();

export const PROTOTYPE_NODE_TYPES = [
  "onGameStart",
  "onTick",
  "onCollision",
  "onKey",
  "onTimerEnd",
  "player",
  "enemy",
  "collectible",
  "base",
  "spawner",
  "branch",
  "forEach",
  "delay",
  "sequence",
  "counter",
  "random",
  "math",
  "array",
  "win",
  "lose",
] as const;

const safePropertiesSchema = z.record(z.string().min(1).max(100), z.unknown()).superRefine((value, context) => {
  for (const key of Object.keys(value)) {
    if (key === "__proto__" || key === "prototype" || key === "constructor") {
      context.addIssue({ code: "custom", message: "unsafe property key", path: [key] });
    }
  }
});

const graphNodeSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
  type: z.enum(PROTOTYPE_NODE_TYPES),
  label: boundedText(200),
  position: z.object({
    x: z.number().finite().min(-10_000).max(10_000),
    y: z.number().finite().min(-10_000).max(10_000),
  }).strict(),
  properties: safePropertiesSchema.default({}),
}).strict();

const graphEdgeSchema = z.object({
  source: z.string().trim().min(1).max(64),
  sourceHandle: z.string().trim().min(1).max(100),
  target: z.string().trim().min(1).max(64),
  targetHandle: z.string().trim().min(1).max(100),
}).strict();

export const aiGraphSchema = z.object({
  nodes: z.array(graphNodeSchema).min(1).max(50),
  edges: z.array(graphEdgeSchema).max(200).default([]),
}).strict().superRefine((graph, context) => {
  const nodeIds = new Set<string>();
  graph.nodes.forEach((node, index) => {
    if (nodeIds.has(node.id)) {
      context.addIssue({ code: "custom", message: "duplicate node id", path: ["nodes", index, "id"] });
    }
    nodeIds.add(node.id);
  });
  graph.edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.source)) {
      context.addIssue({ code: "custom", message: "unknown edge source", path: ["edges", index, "source"] });
    }
    if (!nodeIds.has(edge.target)) {
      context.addIssue({ code: "custom", message: "unknown edge target", path: ["edges", index, "target"] });
    }
  });
  if (!graph.nodes.some((node) => node.type.startsWith("on"))) {
    context.addIssue({ code: "custom", message: "graph requires an event node", path: ["nodes"] });
  }
  if (!graph.nodes.some((node) => node.type === "win" || node.type === "lose")) {
    context.addIssue({ code: "custom", message: "graph requires a win or lose node", path: ["nodes"] });
  }
});

export const aiGraphSuggestionsSchema = z.array(z.object({
  type: z.enum(["error", "warning", "suggestion"]),
  message: boundedText(2_000),
  suggestedNode: z.string().trim().min(1).max(100).optional(),
  fixAction: z.string().trim().min(1).max(2_000).optional(),
}).strict()).max(50);

export type ConceptEnrichmentOutput = z.infer<typeof conceptEnrichmentSchema>;
export type CustomMechanicOutput = z.infer<typeof customMechanicSchema>;
export type AiGraphOutput = z.infer<typeof aiGraphSchema>;
export type AiGraphSuggestionOutput = z.infer<typeof aiGraphSuggestionsSchema>[number];
