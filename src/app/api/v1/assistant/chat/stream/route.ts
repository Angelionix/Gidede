/**
 * POST /api/v1/assistant/chat/stream
 *
 * SSE streaming variant of /assistant/chat. Returns a text/event-stream
 * Response. Events:
 *   - data: { type: "start", message_id }
 *   - data: { type: "message", content: <accumulated-so-far> }
 *     (sent repeatedly as the response is built up word-by-word)
 *   - data: { type: "done", message_id, model_used, provider, latency_ms }
 *
 * Body: { message: string, project_id?: string, context?: Record<string, unknown> }
 *
 * Notes:
 *   - The frontend (block 7 page.tsx) reads events where event.type === "message"
 *     and uses event.content as the FULL accumulated content (replacing prior),
 *     then finalizes with the "done" event's metadata.
 *   - Uses Response + ReadableStream (NOT NextResponse.json) per Next 16 SSE pattern.
 *   - Stores the user + assistant messages in the in-memory chat history.
 */

import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import {
  appendMessage,
  generateAssistantResponse,
} from "@/lib/assistant-store";
import {
  UNAUTH,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import {
  loadProjectPipelineSnapshot,
  type ProjectPipelineSnapshot,
} from "@/lib/pipeline-helpers";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const message = body?.message?.toString().trim();
  const projectId = body?.project_id?.toString().trim() || undefined;

  if (!message) {
    return VALIDATION_ERROR("Поле message обязательно");
  }

  // Resolve project (optional)
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

  // Store the user message immediately (so it shows up in history even if
  // the stream is aborted).
  const userMsgId = `u-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  appendMessage(user.id, projectId || null, {
    id: userMsgId,
    role: "user",
    content: message,
    timestamp: Date.now(),
    project_id: projectId || null,
  });

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

  // Build the SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        // 1. Start event
        send({
          type: "start",
          message_id: assistantMsgId,
          model_used: "gidede-rules-v1",
          provider: "rules-engine",
        });

        // 2. Stream the response word-by-word. Send accumulated content
        //    in each "message" event so the frontend can replace the prior
        //    buffer (per block 7 page.tsx).
        const words = ai.text.split(/(\s+)/); // keep whitespace tokens
        let accumulated = "";
        for (const w of words) {
          accumulated += w;
          send({
            type: "message",
            message_id: assistantMsgId,
            content: accumulated,
          });
          // Throttle to simulate token streaming
          await new Promise((r) => setTimeout(r, 25));
        }

        // 3. Store the assistant message in history (final, full text)
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

        // 4. Done event with metadata
        send({
          type: "done",
          message_id: assistantMsgId,
          model_used: "gidede-rules-v1",
          provider: "rules-engine",
          latency_ms: latencyMs,
          suggestions: ai.suggestions,
        });
      } catch (err) {
        console.error("[assistant/chat/stream] stream error:", err);
        try {
          send({ type: "error", message: "Ошибка стриминга" });
        } catch {
          /* ignore */
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
