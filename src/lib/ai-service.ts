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

// ============================================================
// Concept enrichment (use_ai flag for block 1)
// ============================================================

export interface ConceptEnrichmentInput {
  idea: string;
  genre: string;
  projectName: string;
  aesthetics: string[];
}

export interface ConceptEnrichment {
  story_synopsis: string;
  gameplay_description: string;
  unique_features: string[];
  ai_insights: string;
}

/**
 * AI-обогащение концепции: генерирует более креативные story_synopsis,
 * gameplay_description и unique_features через LLM. Возвращает null при
 * недоступности SDK — вызывающий код использует детерминированный fallback.
 */
export async function enrichConcept(
  ctx: ConceptEnrichmentInput
): Promise<ConceptEnrichment | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const prompt = `Ты — экспертный геймдизайнер. Обогати концепцию игры, основываясь на идее пользователя.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Идея: ${ctx.idea}
Целевые эстетики (MDA): ${ctx.aesthetics.join(", ")}

Сгенерируй JSON с полями:
- story_synopsis: краткий синопсис сюжета (2-3 предложения, на русском)
- gameplay_description: описание геймплея (3-4 предложения, на русском, конкретно)
- unique_features: массив из 3-4 уникальных фич игры (на русском, каждая 1 предложение)
- ai_insights: 1-2 предложения инсайтов/рекомендаций от AI

Ответ — только валидный JSON, без markdown обёртки.`;

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || "";
    // Strip markdown code fences if present
    let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    // Try to extract JSON object from the response (LLM may include preamble text)
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: try to fix common LLM JSON issues (unescaped quotes, trailing commas)
      const fixed = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\u201C\u201D]/g, '"') // smart quotes → straight
        .replace(/[\u2018\u2019]/g, "'");
      parsed = JSON.parse(fixed);
    }

    if (!parsed.story_synopsis || !parsed.gameplay_description) {
      return null;
    }

    return {
      story_synopsis: String(parsed.story_synopsis),
      gameplay_description: String(parsed.gameplay_description),
      unique_features: Array.isArray(parsed.unique_features)
        ? parsed.unique_features.map(String)
        : [],
      ai_insights: String(parsed.ai_insights || ""),
    };
  } catch (e) {
    console.error(
      "[ai-service] enrichConcept failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// ============================================================
// GDD section enrichment (use_ai flag for block 6)
// ============================================================

export interface GddEnrichmentInput {
  sectionName: string;
  projectName: string;
  genre: string;
  existingContent: string;
}

/**
 * AI-обогащение секции GDD: дополняет/переформулирует текст секции через LLM.
 */
export async function enrichGddSection(
  ctx: GddEnrichmentInput
): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const prompt = `Ты — технический писатель GDD. Обогати и улучши секцию дизайн-документа.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Секция: ${ctx.sectionName}
Текущее содержание:
${ctx.existingContent}

Задача: перепиши и扩充 эту секцию, сделай её более подробной и профессиональной (150-250 слов, на русском). Сохрани суть, добавь конкретики.`;

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Ты — AI-ассистент по геймдизайну, специализирующийся на написании GDD.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 20 ? text : null;
  } catch (e) {
    console.error(
      "[ai-service] enrichGddSection failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// ============================================================
// AI-generated prototype code (use_ai flag for /prototypes/generate)
// ============================================================

export interface PrototypeAiInput {
  projectName: string;
  genre: string;
  coreLoopType: string;   // engine | economy | ecology
  steps: string[];
  mode: "2d" | "3d";
  idea?: string;
}

/**
 * AI генерирует описание уникальной механики для прототипа кор-лупа.
 * Возвращает текст-описание (~150 слов) как прототип должен себя вести,
 * какие объекты/взаимодействия добавить сверх базового шаблона.
 *
 * Код не генерируется напрямую (рискованно), но AI описывает концепцию,
 * которая подсвечивается в UI как «AI-инсайты для прототипа».
 */
export async function generatePrototypeInsights(
  ctx: PrototypeAiInput
): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const prompt = `Ты — экспертный геймдизайнер. Дай конкретные советы по прототипу кор-лупа для теста «30 секунд веселья».

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType} (engine=генерация ресурса, economy=конвертация, ecology=выживание)
Режим прототипа: ${ctx.mode}
Шаги кор-лупа: ${ctx.steps.join(" → ")}
${ctx.idea ? `Идея проекта: ${ctx.idea}` : ""}

Дай 3-4 конкретных совета (на русском, каждый 1-2 предложения):
1. Что добавить в прототип, чтобы кор-луп ощущался веселее
2. Какая «wow-механика» сделает тест запоминающимся
3. На что обратить внимание при плейтесте (что считать успехом/провалом)
4. Баланс-предупреждение (что может сломать fun)

Ответ — обычный текст с нумерованными пунктами, без JSON.`;

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Ты — AI-ассистент по геймдизайну, специализирующийся на прототипировании кор-лупов.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error(
      "[ai-service] generatePrototypeInsights failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// ============================================================
// AI-generated custom mechanic code (sandboxed)
// ============================================================

export interface CustomMechanicInput {
  projectName: string;
  genre: string;
  coreLoopType: string;
  mode: "2d" | "3d";
  idea?: string;
}

export async function generateCustomMechanic(
  ctx: CustomMechanicInput
): Promise<{ mechanicName: string; description: string; codeSnippet: string } | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const engine = ctx.mode === "3d" ? "Three.js" : "LittleJS (canvas 2D)";
    const prompt = `Ты — экспертный геймдизайнер и game-программист. Предложи уникальную кастомную механику для прототипа кор-лупа.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType}
Режим: ${ctx.mode} (${engine})

Сгенерируй JSON с полями:
- mechanicName: краткое название механики (2-4 слова, на русском)
- description: описание механики (2-3 предложения, на русском)
- codeSnippet: JS код-сниппет (10-30 строк) для ${engine}. Без HTML, только JS. Используй: ${ctx.mode === "3d" ? "THREE.Mesh, scene.add, THREE.BoxGeometry" : "drawCircle, vec2, keyWasPressed, timeDelta"}.

Ответ — только валидный JSON, без markdown.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну и программированию. Отвечай только валидным JSON." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || "";
    let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const fixed = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
      parsed = JSON.parse(fixed);
    }

    if (!parsed.mechanicName || !parsed.description) return null;
    return {
      mechanicName: String(parsed.mechanicName),
      description: String(parsed.description),
      codeSnippet: String(parsed.codeSnippet || ""),
    };
  } catch (e) {
    console.error("[ai-service] generateCustomMechanic failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
