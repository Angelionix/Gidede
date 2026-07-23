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
  getHistory,
} from "@/lib/assistant-store";
import { generateAiResponse } from "@/lib/ai-service";
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
    await appendMessage(user.id, projectId || null, {
      id: userMsgId,
      role: "user",
      content: message,
      timestamp: Date.now(),
      project_id: projectId || null,
    });

    // Gather recent history for AI context
    const hist = await getHistory(user.id, projectId || null, 6);
    const historyForAi = hist.messages
      .reverse()
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }))
      .filter((m) => m.role === "user" || m.role === "assistant");

    // Try real AI first; fall back to deterministic rules engine
    let responseText: string;
    let modelUsed: string;
    let provider: string;

    const aiText = await generateAiResponse({
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
      history: historyForAi,
    });

    if (aiText) {
      responseText = aiText;
      modelUsed = "glm-4.6";
      provider = "z-ai-web-dev-sdk";
    } else {
      // Deterministic fallback
      const fallback = generateAssistantResponse({
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
      responseText = fallback.text;
      modelUsed = "gidede-rules-v1";
      provider = "rules-engine (fallback)";
    }

    const assistantMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const latencyMs = Date.now() - startedAt;

    await appendMessage(user.id, projectId || null, {
      id: assistantMsgId,
      role: "assistant",
      content: responseText,
      timestamp: Date.now(),
      metadata: {
        model_used: modelUsed,
        provider,
        latency_ms: latencyMs,
      },
      project_id: projectId || null,
    });

    return NextResponse.json({
      message_id: assistantMsgId,
      response: responseText,
      reply: responseText, // frontend compatibility
      model_used: modelUsed,
      provider,
      latency_ms: latencyMs,
    });
  } catch (error) {
    console.error("[assistant/chat] error:", error);
    return SERVER_ERROR();
  }
}
