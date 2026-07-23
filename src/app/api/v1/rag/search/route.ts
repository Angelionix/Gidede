/**
 * POST /api/v1/rag/search
 *
 * Searches the static RAG knowledge base of game-design concepts (~15 entries:
 * MDA, core loops, balance, economy, GDD, etc.). Uses keyword-overlap scoring
 * (no embeddings — acceptable for a small static KB).
 *
 * Body: { query: string, top_k?: number }
 *
 * Response: { results: [{ title, snippet, source, score }], total }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import { searchKnowledgeBase } from "@/lib/rag-knowledge-base";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const query = body?.query?.toString().trim();
    const topK = Math.max(1, Math.min(20, Number(body?.top_k) || 5));

    if (!query) {
      return VALIDATION_ERROR("Поле query обязательно");
    }

    const { results, total } = searchKnowledgeBase(query, topK);
    return NextResponse.json({ results, total });
  } catch (error) {
    console.error("[rag/search] error:", error);
    return SERVER_ERROR();
  }
}
