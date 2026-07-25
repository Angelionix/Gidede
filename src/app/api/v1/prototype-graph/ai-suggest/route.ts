/**
 * POST /api/v1/prototype-graph/ai-suggest
 * Body: { nodeTypes: string[], edgeCount: number, description? }
 * Response: { suggestions: AiGraphSuggestion[] }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { validateGraphWithAI } from "@/lib/ai-service";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const nodeTypes = Array.isArray(body?.nodeTypes) ? body.nodeTypes : [];
    const edgeCount = Number(body?.edgeCount) || 0;
    const description = body?.description?.toString().trim() || undefined;

    if (nodeTypes.length === 0) {
      return VALIDATION_ERROR("nodeTypes обязателен");
    }

    const suggestions = await validateGraphWithAI(nodeTypes, edgeCount, description);
    if (suggestions) return NextResponse.json({ suggestions });
    return NextResponse.json({ detail: "AI недоступен" }, { status: 503 });
  } catch (error) {
    console.error("[prototype-graph/ai-suggest] error:", error);
    return SERVER_ERROR();
  }
}
