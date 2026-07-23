/**
 * Gidede — Real AI service via z-ai-web-dev-sdk.
 *
 * Integrates the LLM skill (z-ai-web-dev-sdk) into the assistant for genuine
 * generative responses about game design. Falls back to deterministic logic
 * if the SDK is unavailable or errors out.
 */

import ZAI from "z-ai-web-dev-sdk";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;
let initError: string | null = null;

async function getZai() {
  if (initError) return null;
  if (zaiInstance) return zaiInstance;
  try {
    zaiInstance = await ZAI.create();
    return zaiInstance;
  } catch (e) {
    initError = e instanceof Error ? e.message : String(e);
    console.error("[ai-service] ZAI.create() failed:", initError);
    return null;
  }
}

export interface AiContext {
  message: string;
  projectName?: string;
  hasConcept?: boolean;
  hasCoreLoop?: boolean;
  hasMda?: boolean;
  hasBalance?: boolean;
  hasProgression?: boolean;
  hasEconomy?: boolean;
  hasGdd?: boolean;
  hasChecklist?: boolean;
  completionPercent?: number;
  currentStage?: string | null;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

const SYSTEM_PROMPT = `Ты — Gidede AI, экспертный ассистент по геймдизайну. Ты основан на знаниях из 17 книг по геймдизайну (Шелл, Адамс/Дорманс, Селлерс, Роджерс, Фуллертон, Зубек и др.) и помогаешь геймдизайнерам пройти путь от идеи до GDD.

Ты знаешь:
- MDA Framework (Mechanics → Dynamics → Aesthetics, Hunicke/LeBlanc/Zubek)
- Reverse MDA (эстетика → динамики → механики, Bond)
- Core Loop проектирование (Engine/Economy/Ecology, 7 патологий)
- Балансировка (transitive/intransitive, Monte Carlo, Nash equilibrium)
- Machinations (визуальный язык экономики Adams/Dormans)
- 113 линз Шелла
- Triangle of Weirdness (Rogers)
- Матрица 4×3 Бонда
- Model Yi (12 типов игроков)

Правила ответов:
1. Отвечай на русском языке.
2. Будь конкретен и практичен — давай actionable советы.
3. Ссылайся на конкретные методологии/книги когда уместно.
4. Если вопрос связан с проектом пользователя — учитывай контекст проекта.
5. Структурируй ответ: используй списки, нумерацию, выделения.
6. Не выдумывай факты. Если не уверен — скажи это.
7. Длина ответа: 100-400 слов,除非 пользователь просит подробнее.

Контекст проекта пользователя будет передан в сообщении. Используй его для персонализации ответа.`;

function buildUserPrompt(ctx: AiContext): string {
  const parts: string[] = [];

  // Project context
  if (ctx.projectName) {
    parts.push(`Проект: «${ctx.projectName}»`);
    parts.push(`Стадия: ${ctx.currentStage || "не определена"}`);
    parts.push(`Прогресс: ${ctx.completionPercent ?? 0}%`);
    parts.push(
      `Заполненные блоки: ${[
        ctx.hasConcept && "Концепция",
        ctx.hasCoreLoop && "Core Loop",
        ctx.hasMda && "MDA",
        ctx.hasBalance && "Баланс",
        ctx.hasProgression && "Прогрессия",
        ctx.hasEconomy && "Экономика",
        ctx.hasGdd && "GDD",
        ctx.hasChecklist && "Валидация",
      ]
        .filter(Boolean)
        .join(", ") || "пусто"}`
    );
  } else {
    parts.push("Контекст проекта: не выбран (общий вопрос по геймдизайну)");
  }

  parts.push("");
  parts.push(`Вопрос пользователя: ${ctx.message}`);

  return parts.join("\n");
}

/**
 * Generate a real AI response via z-ai-web-dev-sdk.
 * Returns null if SDK is unavailable or fails — caller should fall back
 * to deterministic logic.
 */
export async function generateAiResponse(
  ctx: AiContext
): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: SYSTEM_PROMPT }];

    // Include recent history for context (last 6 messages)
    if (ctx.history && ctx.history.length > 0) {
      const recent = ctx.history.slice(-6);
      for (const m of recent) {
        messages.push({ role: m.role, content: m.content });
      }
    }

    messages.push({ role: "user", content: buildUserPrompt(ctx) });

    const response = await zai.chat.completions.create({
      messages,
      stream: false,
      thinking: { type: "disabled" },
    });

    const reply = response.choices?.[0]?.message?.content;
    return reply && reply.trim().length > 0 ? reply.trim() : null;
  } catch (e) {
    console.error(
      "[ai-service] chat.completions.create failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * Stream an AI response token-by-token via z-ai-web-dev-sdk.
 * Calls onDelta for each chunk. Returns the full text when done.
 * Returns null if SDK unavailable — caller should fall back.
 */
export async function streamAiResponse(
  ctx: AiContext,
  onDelta: (chunk: string) => void
): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [{ role: "system", content: SYSTEM_PROMPT }];

    if (ctx.history && ctx.history.length > 0) {
      const recent = ctx.history.slice(-6);
      for (const m of recent) {
        messages.push({ role: m.role, content: m.content });
      }
    }

    messages.push({ role: "user", content: buildUserPrompt(ctx) });

    const stream = await zai.chat.completions.create({
      messages,
      stream: true,
      thinking: { type: "disabled" },
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onDelta(delta);
      }
    }

    return fullText.trim() || null;
  } catch (e) {
    console.error(
      "[ai-service] stream failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** Check if the AI service is available (SDK loaded). */
export async function isAiAvailable(): Promise<boolean> {
  const zai = await getZai();
  return zai !== null;
}
