/**
 * POST /api/v1/prototype-graph/compile
 * Body: { graph: NodeGraph }
 * Response: { html, valid, errors }
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR } from "@/lib/api-helpers";
import { compileGraph } from "@/lib/graph/compiler";
import type { NodeGraph } from "@/lib/graph/types";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const graph = body?.graph;
    if (!graph) return VALIDATION_ERROR("graph обязателен");

    const result = compileGraph(graph as NodeGraph);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[prototype-graph/compile] error:", error);
    return SERVER_ERROR();
  }
}
