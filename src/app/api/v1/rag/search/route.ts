/**
 * POST /api/v1/rag/search
 *
 * Searches the knowledge base of game-design concepts. Combines:
 * 1. Static KB (~15 curated entries: MDA, core loops, balance, etc.)
 * 2. Bible RAG (12 sections / ~hundreds of chunks from docs/bible/)
 *
 * Scoring: keyword-overlap (static KB) + TF-IDF (bible chunks).
 * Results are merged, deduplicated by title, sorted by score.
 *
 * Body: { query: string, top_k?: number, source?: "all" | "bible" | "static" }
 *
 * Response: { results: [{ title, snippet, source, section?, score }], total, stats }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { searchKnowledgeBase } from "@/lib/rag-knowledge-base";
import { searchBible, getBibleStats } from "@/lib/bible-rag";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const query = body?.query?.toString().trim();
    const topK = Math.max(1, Math.min(20, Number(body?.top_k) || 5));
    const source = (body?.source?.toString() || "all") as "all" | "bible" | "static";

    if (!query) {
      return VALIDATION_ERROR("Поле query обязательно");
    }

    // Run searches in parallel
    const [staticResult, bibleResult, stats] = await Promise.all([
      source === "bible"
        ? { results: [], total: 0 }
        : searchKnowledgeBase(query, Math.ceil(topK / 2)),
      source === "static"
        ? { results: [], total: 0 }
        : searchBible(query, topK),
      getBibleStats(),
    ]);

    // Merge results
    const allResults = [
      ...bibleResult.results.map((r) => ({
        source_id: r.sourceId,
        title: r.title,
        snippet: r.snippet,
        fullContent: r.fullContent,
        source: r.source,
        section: r.section,
        score: r.score * 1.2, // slight boost: bible chunks are more specific
        type: "bible" as const,
      })),
      ...staticResult.results.map((r) => ({
        title: r.title,
        snippet: r.snippet,
        source: r.source,
        section: undefined,
        score: r.score,
        type: "curated" as const,
      })),
    ];

    // Deduplicate by title (keep highest score)
    const seen = new Map<string, (typeof allResults)[0]>();
    for (const r of allResults) {
      const existing = seen.get(r.title.toLowerCase());
      if (!existing || r.score > existing.score) {
        seen.set(r.title.toLowerCase(), r);
      }
    }

    const results = Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return NextResponse.json({
      results,
      total: results.length,
      stats: {
        bible_sections: stats.sections,
        bible_chunks: stats.chunks,
        bible_terms: stats.uniqueTerms,
      },
    });
  } catch (error) {
    console.error("[rag/search] error:", error);
    return SERVER_ERROR();
  }
}
