/**
 * LLM extractor — extracts entities and relations from text chunks.
 *
 * Uses z-ai-web-dev-sdk (glm-4.6) to extract structured knowledge
 * from book chunks. Each chunk → ExtractionResult (entities + relations).
 *
 * Design spec: docs/ONTOLOGY_RAW_BOOKS_REBUILD_PLAN.md (stage 3)
 */

import { z } from "zod";
import { getLlmClient } from "@/lib/llm/default-client";
import { createStructuredCompletion } from "@/lib/llm/structured-output";
import type { ExtractionResult, BookChunk } from "./types";

// ============================================================
// Zod schema for LLM output
// ============================================================

export const entityTypeSchema = z.enum([
  "Mechanic", "Genre", "Aesthetic", "Dynamic", "Resource",
  "Pattern", "AntiPattern", "Principle", "Tool", "CoreLoopStep", "Game",
]);

export const relationTypeSchema = z.enum([
  "REQUIRES_MECHANIC", "CONFLICTS_WITH", "PRODUCES_DYNAMIC",
  "CREATES_AESTHETIC", "CONSUMES_RESOURCE", "PRODUCES_RESOURCE",
  "SYNERGIZES_WITH", "COUNTERS", "SOLVES", "LEADS_TO",
  "DESCRIBED_IN", "CONTRADICTS", "INSTANCE_OF", "SUPPORTS_AESTHETIC",
]);

export const extractedEntitySchema = z.object({
  type: entityTypeSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(500),
  sourceRef: z.string().min(1),
});

export const extractedRelationSchema = z.object({
  from: z.string().min(1).max(200),
  to: z.string().min(1).max(200),
  type: relationTypeSchema,
  weight: z.number().min(0.5).max(1.0),
  sourceRef: z.string().min(1),
});

export const extractionResultSchema = z.object({
  entities: z.array(extractedEntitySchema).max(50),
  relations: z.array(extractedRelationSchema).max(100),
});

// ============================================================
// Prompt
// ============================================================

function buildExtractionPrompt(chunk: BookChunk): string {
  return `Извлеки сущности и отношения из текста по геймдизайну.

Книга: ${chunk.bookId}
Глава: ${chunk.chapter}
Страница: ${chunk.page}

Текст:
${chunk.text.substring(0, 8000)}

Извлеки сущности и отношения.

Сущности (type):
- Mechanic: конкретные игровые механики (движение, сбор, бой, крафт и т.д.)
- Genre: жанры игр (RPG, racing, puzzle, shooter и т.д.)
- Aesthetic: эстетики MDA (challenge, sensation, narrative, fantasy, discovery, submission, expression, fellowship)
- Dynamic: динамики (emergent behaviors: movement, conflict, acquisition, positioning, timing)
- Resource: игровые ресурсы (gold, HP, score, time)
- Pattern: паттерны геймдизайна (core loop, feedback loop, risk/reward)
- AntiPattern: антипаттерны (grinding, dominant strategy, dead time)
- Principle: принципы геймдизайна (loops over threads, interesting choices)
- Tool: инструменты (Machinations, MDA, lenses)

Отношения (type):
- REQUIRES_MECHANIC: жанр требует механику (Racing REQUIRES_MECHANIC locomotion)
- CONFLICTS_WITH: конфликт (Racing CONFLICTS_WITH Combat)
- PRODUCES_DYNAMIC: механика создаёт динамику (Combat PRODUCES_DYNAMIC conflict)
- CREATES_AESTHETIC: динамика создаёт эстетику (conflict CREATES_AESTHETIC challenge)
- CONSUMES_RESOURCE: потребляет ресурс (Crafting CONSUMES_RESOURCE wood)
- PRODUCES_RESOURCE: производит ресурс (Mining PRODUCES_RESOURCE ore)
- SYNERGIZES_WITH: синергия (Combat SYNERGIZES_WITH Upgrade)
- COUNTERS: контрит (Stealth COUNTERS Combat)
- SOLVES: паттерн решает проблему (CoreLoop SOLVES engagement_problem)
- LEADS_TO: антипаттерн ведёт к проблеме (Grinding LEADS_TO boredom)
- SUPPORTS_AESTHETIC: механика поддерживает эстетику (Combat SUPPORTS_AESTHETIC challenge)
- CONTRADICTS: противоречие (один автор противоречит другому)

sourceRef для всех: "${chunk.id}"

Правила:
- Извлекай только явные связи из текста
- Weight: 0.5-1.0 (1.0 = явно утверждается, 0.5 = подразумевается)
- Не выдумывай отношения, которых нет в тексте
- Имена сущностей: lowercase, singular
- Описания: краткие (1-2 предложения)`;
}

// ============================================================
// LLM extraction
// ============================================================

/**
 * Extract entities and relations from a single chunk using LLM.
 * Returns null if LLM is unavailable or extraction fails.
 */
export async function extractFromChunk(
  chunk: BookChunk,
): Promise<ExtractionResult | null> {
  const llm = await getLlmClient("prototype");
  if (!llm) {
    console.warn(`[llm-extractor] LLM unavailable, skipping ${chunk.id}`);
    return null;
  }

  try {
    const result = await createStructuredCompletion(
      llm,
      {
        messages: [
          {
            role: "system",
            content:
              "Ты — game design knowledge engineer. Извлекаешь сущности и отношения " +
              "из текста по геймдизайну. Отвечаешь ТОЛЬКО валидным JSON.",
          },
          {
            role: "user",
            content: buildExtractionPrompt(chunk),
          },
        ],
        reasoning: "disabled",
      },
      {
        schema: extractionResultSchema,
        schemaName: "ontology_extraction",
        schemaHint:
          "strict object {entities: [{type, name, description, sourceRef}], " +
          "relations: [{from, to, type, weight, sourceRef}]}",
        maxRepairAttempts: 2,
      },
    );

    if (!result) {
      console.warn(`[llm-extractor] No result for ${chunk.id}`);
      return null;
    }

    // Ensure all sourceRefs are set to chunk ID
    for (const entity of result.entities) {
      entity.sourceRef = chunk.id;
    }
    for (const rel of result.relations) {
      rel.sourceRef = chunk.id;
    }

    return result;
  } catch (e) {
    console.error(
      `[llm-extractor] FAILED ${chunk.id}: ${e instanceof Error ? e.message : e}`,
    );
    return null;
  }
}

/**
 * Extract from multiple chunks (with optional rate limiting).
 */
export async function extractFromChunks(
  chunks: BookChunk[],
  options: {
    maxChunks?: number;
    delayMs?: number;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<ExtractionResult[]> {
  const { maxChunks, delayMs = 500, onProgress } = options;
  const toProcess = maxChunks ? chunks.slice(0, maxChunks) : chunks;
  const results: ExtractionResult[] = [];

  for (let i = 0; i < toProcess.length; i++) {
    const chunk = toProcess[i];
    const result = await extractFromChunk(chunk);

    if (result) {
      results.push(result);
      console.log(
        `[llm-extractor] ${chunk.id}: ${result.entities.length} entities, ${result.relations.length} relations`,
      );
    }

    if (onProgress) onProgress(i + 1, toProcess.length);

    // Rate limit
    if (delayMs > 0 && i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return results;
}
