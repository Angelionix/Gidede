/**
 * POST /api/v1/assistant/chat
 *
 * Non-streaming fallback for the AI assistant chat. Stores the user's message
 * and the assistant's response in the in-memory chat history.
 *
 * Body: { message: string, project_id?: string, context?: Record<string, unknown> }
 *
 * Response (merged for spec + frontend compatibility):
 *   {
 *     message_id: string,         // spec
 *     response: string,            // spec
 *     reply: string,               // frontend (same as response)
 *     suggestions?: Suggestion[],  // spec
 *     model_used: string,          // frontend
 *     provider: string,            // frontend
 *     latency_ms: number           // frontend
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  appendMessage,
  generateAssistantResponse,
} from "@/lib/assistant-store";
import {
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import {
  loadProjectPipelineSnapshot,
  type ProjectPipelineSnapshot,
} from "@/lib/pipeline-helpers";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const body = await request.json().catch(() => ({}));
    const message = body?.message?.toString().trim();
    const projectId = body?.project_id?.toString().trim() || undefined;

    if (!message) {
      return VALIDATION_ERROR("Поле message обязательно");
    }

    let projectName = "ваш проект";
    let snap: ProjectPipelineSnapshot | null = null;
    if (projectId) {
      snap = await loadProjectPipelineSnapshot(user.id, projectId);
      if (!snap) {
        return NextResponse.json(
          { detail: "Проект не найден" },
          { status: 404 }
        );
      }
      projectName = snap.projectName;
    }

    // Store the user's message
    const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    appendMessage(user.id, projectId || null, {
      id: userMsgId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      project_id: projectId || null,
    });

    // Build canned-but-contextual response
    const ai = generateAssistantResponse({
      message,
      projectName,
      hasConcept: snap?.hasConcept,
      hasCoreLoop: snap?.hasCoreLoop,
      hasMda: snap?.hasMda,
      hasBalance: snap?.hasBalance,
      hasProgression: snap?.hasProgression,
      hasEconomy: snap?.hasEconomy,
      hasGdd: snap?.hasGdd,
      hasChecklist: snap?.hasChecklist,
      completionPercent: snap?.completionPercent,
      currentStage: snap?.currentStage,
    });

    const assistantMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const latencyMs = Date.now() - startedAt;

    appendMessage(user.id, projectId || null, {
      id: assistantMsgId,
      role: "assistant",
      content: ai.text,
      timestamp: Date.now(),
      metadata: {
        model_used: "gidede-rules-v1",
        provider: "rules-engine",
        latency_ms: latencyMs,
      },
      project_id: projectId || null,
    });

    return NextResponse.json({
      message_id: assistantMsgId,
      response: ai.text,
      reply: ai.text, // frontend compatibility
      suggestions: ai.suggestions,
      model_used: "gidede-rules-v1",
      provider: "rules-engine",
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error("[assistant/chat] error:", error);
    return SERVER_ERROR();
  }
}
