/**
 * GET /api/v1/rag/stats
 * Возвращает статистику RAG (Bible sections, chunks, terms).
 */
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { getBibleStats } from "@/lib/bible-rag";
import { getMechanicsDBStats } from "@/lib/mechanics-db";
import { UNAUTH } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  const bibleStats = await getBibleStats();
  const mechStats = getMechanicsDBStats();

  return NextResponse.json({
    bible: {
      sections: bibleStats.sections,
      chunks: bibleStats.chunks,
      unique_terms: bibleStats.uniqueTerms,
      source: "docs/bible/ (12 markdown files)",
    },
    mechanics_db: {
      total: mechStats.total,
      groups: mechStats.groups,
      source: "SW.BAND «Карты геймдизайнера» (Книга 15)",
    },
    static_kb: {
      entries: 15,
      source: "Curated knowledge base",
    },
  });
}
