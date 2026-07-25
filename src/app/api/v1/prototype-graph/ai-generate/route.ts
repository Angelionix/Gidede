/**
 * POST /api/v1/prototype-graph/ai-generate
 * Body: { description, mode? } or { project_id } for GDD-based generation
 * Response: { nodes, edges } (AiGraphResult)
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR, getOwnedProject, safeJsonParse } from "@/lib/api-helpers";
import { generateGraphFromText, generateGraphFromGdd } from "@/lib/ai-service";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const description = body?.description?.toString().trim();
    const mode = body?.mode === "3d" ? "3d" : "2d" as const;
    const projectId = body?.project_id?.toString().trim();

    if (!description && !projectId) {
      return VALIDATION_ERROR("description или project_id обязателен");
    }

    // If project_id provided → generate from GDD
    if (projectId) {
      const owned = await getOwnedProject({ id: user.id, email: user.email, name: user.name }, projectId);
      if (owned instanceof NextResponse) return owned;
      const proj = owned.project as Record<string, unknown>;

      // Get core loop steps
      let coreLoopType = "engine";
      let steps: string[] = ["explore", "combat", "reward"];
      const coreLoop = (proj as Record<string, unknown>)?.coreLoop as Record<string, unknown> | null;
      if (coreLoop) {
        coreLoopType = String(coreLoop.structuralType || "engine");
        const stepsData = safeJsonParse(coreLoop.stepsData as string || "[]", []);
        if (Array.isArray(stepsData) && stepsData.length > 0) {
          steps = stepsData.map((s: unknown) => typeof s === "string" ? s : (s as Record<string, unknown>)?.action as string || "step");
        }
      }

      const result = await generateGraphFromGdd({
        projectName: String(proj.name || "Untitled"),
        genre: String(proj.genre || "action"),
        coreLoopType,
        steps,
      });

      if (result) return NextResponse.json(result);
      return NextResponse.json({ detail: "AI недоступен" }, { status: 503 });
    }

    // Text-based generation
    const result = await generateGraphFromText({ description: description!, mode });
    if (result) return NextResponse.json(result);
    return NextResponse.json({ detail: "AI недоступен" }, { status: 503 });
  } catch (error) {
    console.error("[prototype-graph/ai-generate] error:", error);
    return SERVER_ERROR();
  }
}
