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
  getHistory,
} from "@/lib/assistant-store";
import { streamAiResponse } from "@/lib/ai-service";
import {
  UNAUTH,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
import {
  loadProjectPipelineSnapshot,
  type ProjectPipelineSnapshot,
} from "@/lib/pipeline-helpers";
import { NextResponse } from "next/server";
import { checkAiQuota, incrementAiUsage } from "@/lib/ai-quota";

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

  // Pre-flight AI quota check. If exhausted, we still stream the
  // deterministic fallback (free-of-charge) so the user isn't left
  // without a response — we just skip the real AI call.
  const quota = await checkAiQuota(user);

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

  // Store the user message immediately
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

  const assistantMsgId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
          model_used: "glm-4.6",
          provider: "z-ai-web-dev-sdk",
        });

        let fullText = "";
        let modelUsed = "glm-4.6";
        let provider = "z-ai-web-dev-sdk";

        // 2. Try real AI streaming first (only if quota allows)
        let aiText: string | null = null;
        if (quota.allowed) {
          aiText = await streamAiResponse(
          {
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
          },
          (chunk) => {
            fullText += chunk;
            send({
              type: "message",
              message_id: assistantMsgId,
              content: fullText,
            });
          }
        );
        }

        // 3. If AI streaming failed, fall back to deterministic response
        if (!aiText || fullText.length === 0) {
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
          fullText = fallback.text;
          modelUsed = "gidede-rules-v1";
          provider = "rules-engine (fallback)";

          // Stream the fallback word-by-word
          const words = fallback.text.split(/(\s+)/);
          let accumulated = "";
          for (const w of words) {
            accumulated += w;
            send({
              type: "message",
              message_id: assistantMsgId,
              content: accumulated,
            });
            await new Promise((r) => setTimeout(r, 25));
          }
        } else {
          fullText = aiText;
          // Charge the AI call against the user's daily quota ONLY when
          // the SDK actually produced a response.
          await incrementAiUsage(user.id).catch((e) => {
            console.error("[ai-quota] increment failed:", e);
          });
        }

        const latencyMs = Date.now() - startedAt;

        // 4. Store the assistant message in history
        await appendMessage(user.id, projectId || null, {
          id: assistantMsgId,
          role: "assistant",
          content: fullText,
          timestamp: Date.now(),
          metadata: {
            model_used: modelUsed,
            provider,
            latency_ms: latencyMs,
          },
          project_id: projectId || null,
        });

        // 5. Done event with metadata
        send({
          type: "done",
          message_id: assistantMsgId,
          model_used: modelUsed,
          provider,
          latency_ms: latencyMs,
          ai_quota: {
            used: quota.used + (modelUsed === "glm-4.6" ? 1 : 0),
            limit: quota.limit,
            remaining: Math.max(0, quota.remaining - (modelUsed === "glm-4.6" ? 1 : 0)),
            reset_at: new Date(quota.resetAtMs).toISOString(),
          },
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
