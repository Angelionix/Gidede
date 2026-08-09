/**
 * Ontology merger — merges extraction results into a unified graph.
 *
 * Deduplicates entities by normalized name + type.
 * Merges relations: same (from, to, type) from multiple books → higher weight.
 *
 * Design spec: docs/ONTOLOGY_RAW_BOOKS_REBUILD_PLAN.md (stage 4)
 */

import type {
  ExtractionResult,
  OntologyEntity,
  OntologyRelation,
  ExtractedEntity,
  ExtractedRelation,
} from "./types";
import { normalizeEntityName, makeEntityId } from "./types";

// ============================================================
// Entity merging
// ============================================================

interface MergedEntity {
  type: OntologyEntity["type"];
  name: string;
  normalizedName: string;
  description: string;
  sourceRefs: string[];
  bookIds: Set<string>;
  weight: number;
}

/**
 * Merge entities from multiple extraction results.
 * Deduplicates by normalized name + type.
 */
export function mergeEntities(
  extractions: ExtractionResult[],
): Map<string, MergedEntity> {
  const entityMap = new Map<string, MergedEntity>();

  for (const extraction of extractions) {
    for (const entity of extraction.entities) {
      const normalizedName = normalizeEntityName(entity.name);
      const key = `${entity.type}:${normalizedName}`;

      if (entityMap.has(key)) {
        // Merge into existing
        const existing = entityMap.get(key)!;
        existing.sourceRefs.push(entity.sourceRef);

        // Extract bookId from sourceRef (format: "bookId:chunk-XXX" or "bookId:chapter:pXX")
        const bookId = entity.sourceRef.split(":")[0];
        existing.bookIds.add(bookId);

        // Keep the longer description
        if (entity.description.length > existing.description.length) {
          existing.description = entity.description;
        }

        // Increase weight when multiple extractions agree
        existing.weight = Math.min(1.0, existing.weight + 0.05);
      } else {
        const bookId = entity.sourceRef.split(":")[0];
        entityMap.set(key, {
          type: entity.type,
          name: entity.name,
          normalizedName,
          description: entity.description,
          sourceRefs: [entity.sourceRef],
          bookIds: new Set([bookId]),
          weight: 0.7, // base weight for single mention
        });
      }
    }
  }

  // Boost weight for entities mentioned in multiple books
  for (const entity of entityMap.values()) {
    if (entity.bookIds.size > 1) {
      entity.weight = Math.min(1.0, entity.weight + 0.1 * (entity.bookIds.size - 1));
    }
  }

  return entityMap;
}

// ============================================================
// Relation merging
// ============================================================

interface MergedRelation {
  fromName: string;
  toName: string;
  fromType: string;
  toType: string;
  relationType: OntologyRelation["relationType"];
  weight: number;
  sourceRefs: string[];
  bookIds: Set<string>;
}

/**
 * Merge relations from multiple extraction results.
 * Deduplicates by (from, to, type).
 */
export function mergeRelations(
  extractions: ExtractionResult[],
  entityMap: Map<string, MergedEntity>,
): MergedRelation[] {
  const relationMap = new Map<string, MergedRelation>();

  // Build a name→type lookup for resolving entity types
  const nameToType = new Map<string, string>();
  for (const entity of entityMap.values()) {
    nameToType.set(entity.normalizedName, entity.type);
  }

  for (const extraction of extractions) {
    for (const rel of extraction.relations) {
      const fromNorm = normalizeEntityName(rel.from);
      const toNorm = normalizeEntityName(rel.to);

      // Skip self-relations
      if (fromNorm === toNorm) continue;

      // Skip if either entity is not in our map (hallucinated)
      if (!nameToType.has(fromNorm) || !nameToType.has(toNorm)) continue;

      const key = `${fromNorm}|${toNorm}|${rel.type}`;

      if (relationMap.has(key)) {
        const existing = relationMap.get(key)!;
        existing.sourceRefs.push(rel.sourceRef);
        const bookId = rel.sourceRef.split(":")[0];
        existing.bookIds.add(bookId);
        // Merge weight: take the max, then boost for multiple books
        existing.weight = Math.max(existing.weight, rel.weight);
      } else {
        const bookId = rel.sourceRef.split(":")[0];
        relationMap.set(key, {
          fromName: fromNorm,
          toName: toNorm,
          fromType: nameToType.get(fromNorm) || "Mechanic",
          toType: nameToType.get(toNorm) || "Mechanic",
          relationType: rel.type,
          weight: rel.weight,
          sourceRefs: [rel.sourceRef],
          bookIds: new Set([bookId]),
        });
      }
    }
  }

  // Boost weight for relations mentioned in multiple books
  const merged = Array.from(relationMap.values());
  for (const rel of merged) {
    if (rel.bookIds.size > 1) {
      rel.weight = Math.min(1.0, rel.weight + 0.1 * (rel.bookIds.size - 1));
    }
  }

  return merged;
}

// ============================================================
// Full merge
// ============================================================

export interface MergedOntology {
  entities: OntologyEntity[];
  relations: OntologyRelation[];
  stats: {
    totalExtractions: number;
    rawEntities: number;
    rawRelations: number;
    mergedEntities: number;
    mergedRelations: number;
    multiBookEntities: number;
    multiBookRelations: number;
  };
}

/**
 * Merge all extraction results into a unified ontology.
 */
export function mergeOntology(extractions: ExtractionResult[]): MergedOntology {
  const rawEntityCount = extractions.reduce((sum, e) => sum + e.entities.length, 0);
  const rawRelationCount = extractions.reduce((sum, e) => sum + e.relations.length, 0);

  // Merge entities
  const entityMap = mergeEntities(extractions);
  const mergedRelations = mergeRelations(extractions, entityMap);

  // Convert to OntologyEntity[]
  const entities: OntologyEntity[] = [];
  const now = new Date().toISOString();
  let multiBookEntities = 0;

  for (const [key, merged] of entityMap) {
    if (merged.bookIds.size > 1) multiBookEntities++;
    entities.push({
      id: key,
      entityId: makeEntityId("global", merged.type, merged.name),
      scope: "global",
      projectId: null,
      type: merged.type,
      name: merged.name,
      description: merged.description,
      sourceRefs: merged.sourceRefs,
      bookCount: merged.bookIds.size,
      weight: merged.weight,
      metadata: { books: Array.from(merged.bookIds) },
      createdAt: now,
      updatedAt: now,
    });
  }

  // Convert to OntologyRelation[]
  const relations: OntologyRelation[] = [];
  let multiBookRelations = 0;

  for (const merged of mergedRelations) {
    if (merged.bookIds.size > 1) multiBookRelations++;
    const fromEntityId = makeEntityId(
      "global",
      merged.fromType as OntologyEntity["type"],
      merged.fromName,
    );
    const toEntityId = makeEntityId(
      "global",
      merged.toType as OntologyEntity["type"],
      merged.toName,
    );
    relations.push({
      id: `${fromEntityId}|${merged.relationType}|${toEntityId}`,
      fromEntityId,
      toEntityId,
      relationType: merged.relationType,
      weight: merged.weight,
      sourceRefs: merged.sourceRefs,
      bookCount: merged.bookIds.size,
      metadata: { books: Array.from(merged.bookIds) },
      createdAt: now,
    });
  }

  return {
    entities,
    relations,
    stats: {
      totalExtractions: extractions.length,
      rawEntities: rawEntityCount,
      rawRelations: rawRelationCount,
      mergedEntities: entities.length,
      mergedRelations: relations.length,
      multiBookEntities,
      multiBookRelations,
    },
  };
}
