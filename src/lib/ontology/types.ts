/**
 * Ontology types — entities, relations, extraction results.
 *
 * This module defines the core data structures for the game design
 * knowledge graph extracted from books and GDDs.
 *
 * Design spec: docs/ONTOLOGY_RAW_BOOKS_REBUILD_PLAN.md
 */

// ============================================================
// Entity types
// ============================================================

export type EntityType =
  | "Mechanic"
  | "Genre"
  | "Aesthetic"
  | "Dynamic"
  | "Resource"
  | "Pattern"
  | "AntiPattern"
  | "Principle"
  | "Tool"
  | "CoreLoopStep"
  | "Game";

export type RelationType =
  | "REQUIRES_MECHANIC"
  | "CONFLICTS_WITH"
  | "PRODUCES_DYNAMIC"
  | "CREATES_AESTHETIC"
  | "CONSUMES_RESOURCE"
  | "PRODUCES_RESOURCE"
  | "SYNERGIZES_WITH"
  | "COUNTERS"
  | "SOLVES"
  | "LEADS_TO"
  | "DESCRIBED_IN"
  | "CONTRADICTS"
  | "INSTANCE_OF"
  | "SUPPORTS_AESTHETIC";

// ============================================================
// Core types
// ============================================================

export interface OntologyEntity {
  id: string;
  entityId: string;        // "global:mechanic:locomotion"
  scope: "global" | "project";
  projectId: string | null;
  type: EntityType;
  name: string;
  description: string;
  sourceRefs: string[];    // ["schell:ch3:p47", "adams:ch2:p31"]
  bookCount: number;       // how many books mention this
  weight: number;          // 0-1, confidence
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OntologyRelation {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationType: RelationType;
  weight: number;          // 0-1, confidence
  sourceRefs: string[];    // where this relation was extracted from
  bookCount: number;       // how many books assert this
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ============================================================
// Extraction types (LLM output)
// ============================================================

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  description: string;
  sourceRef: string;       // "schell:ch3:p47"
}

export interface ExtractedRelation {
  from: string;            // entity name (will be normalized)
  to: string;              // entity name
  type: RelationType;
  weight: number;          // 0.5-1.0
  sourceRef: string;
}

export interface ExtractionResult {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

// ============================================================
// Book / chunk types
// ============================================================

export interface BookInfo {
  id: string;              // "schell"
  filename: string;        // "Schell_Geymdizayn.pdf"
  title: string;           // "Джесси Шелл — Геймдизайн"
  author: string;          // "Шелл"
  bookNumber: number;      // 1-17 (from BOOKS_REGISTRY)
}

export interface BookChunk {
  id: string;              // "schell:chunk-042"
  bookId: string;          // "schell"
  chapter: string;         // "Chapter 3: MDA Framework"
  page: number;            // 47
  chunkIndex: number;      // 42
  text: string;            // ~2000 tokens
  tokenCount: number;      // approximate
}

// ============================================================
// Comparison types
// ============================================================

export interface ComparisonReport {
  newEntities: OntologyEntity[];       // in new, not in old
  missingEntities: OntologyEntity[];   // in old, not in new
  newRelations: OntologyRelation[];
  missingRelations: OntologyRelation[];
  conflicts: Array<{
    newRelation: OntologyRelation;
    oldRelation: OntologyRelation;
    description: string;
  }>;
  summary: {
    newEntityCount: number;
    missingEntityCount: number;
    newRelationCount: number;
    missingRelationCount: number;
    conflictCount: number;
  };
}

// ============================================================
// Ontology graph (in-memory)
// ============================================================

export interface OntologyGraph {
  entities: Map<string, OntologyEntity>;    // entityId → entity
  relations: OntologyRelation[];
  adjacency: Map<string, Array<{ relation: OntologyRelation; target: OntologyEntity }>>;
}

// ============================================================
// Helpers
// ============================================================

export function normalizeEntityName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_а-яё]/gi, "");
}

export function makeEntityId(scope: string, type: EntityType, name: string): string {
  return `${scope}:${type.toLowerCase()}:${normalizeEntityName(name)}`;
}

export function makeSourceRef(bookId: string, chapter: string, page: number): string {
  return `${bookId}:${chapter}:p${page}`;
}
