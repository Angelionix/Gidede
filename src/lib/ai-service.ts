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
7. Длина ответа: 100-400 слов, если пользователь не просит подробнее.

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

Задача: перепиши и расширь эту секцию, сделай её более подробной и профессиональной (150-250 слов, на русском). Сохрани суть, добавь конкретики.`;

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

// ============================================================
// AI enrichment for Block 2 (Core Loop)
// ============================================================

export interface CoreLoopAiInput {
  projectName: string;
  genre: string;
  coreLoopType: string;
  steps: string[];
}

export async function enrichCoreLoop(ctx: CoreLoopAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const prompt = `Ты — экспертный геймдизайнер. Дай инсайты по кор-лупу для теста «30 секунд веселья».

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType}
Шаги: ${ctx.steps.join(" → ")}

Дай 3 конкретных совета (на русском, каждый 1-2 предложения):
1. Что делает этот кор-луп увлекательным
2. Какие wow-моменты добавить
3. Какие риски fun factor могут возникнуть

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, специализирующийся на core loop проектировании." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichCoreLoop failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI enrichment for Block 3 (MDA)
// ============================================================

export interface MdaAiInput {
  projectName: string;
  genre: string;
  aesthetics: string[];
}

export async function enrichMda(ctx: MdaAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const prompt = `Ты — экспертный геймдизайнер. Проанализируй MDA-профиль игры.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Целевые эстетики (LeBlanc): ${ctx.aesthetics.join(", ")}

Дай 3 рекомендации (на русском):
1. Какие механики лучше всего вызовут эти эстетики
2. Какие динамики могут возникнуть и как их направить
3. Какие линзы Шелла приоритетны для этого набора эстетик

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по MDA фреймворку." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichMda failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI enrichment for Block 4 (Balance)
// ============================================================

export interface BalanceAiInput {
  projectName: string;
  genre: string;
  balanceType: string;
  elementCount: number;
}

export async function enrichBalance(ctx: BalanceAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const prompt = `Ты — эксперт по балансу игр. Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип баланса: ${ctx.balanceType}
Количество элементов: ${ctx.elementCount}

Дай 3 совета (на русском):
1. Какие метрики баланса наиболее важны для этого типа
2. Какие дисбалансы вероятны и как их предотвратить
3. Какие Monte-Carlo параметры рекомендуются (итерации, критерии победы)

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по балансу." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichBalance failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI enrichment for Block 5 (Progression + Economy)
// ============================================================

export interface ProgressionAiInput {
  projectName: string;
  genre: string;
  totalLevels: number;
  targetDurationHours?: number;
}

export async function enrichProgression(ctx: ProgressionAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const prompt = `Ты — эксперт по прогрессии в играх. Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Уровней: ${ctx.totalLevels}
Целевая длительность: ${ctx.targetDurationHours || "—"} часов

Дай 3 совета (на русском):
1. Какая кривая прогрессии оптимальна (exp, polynomial, logarithmic)
2. Сколько тиров и как их распределить
3. Какие content gates рекомендуются

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по прогрессии." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichProgression failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI enrichment for Block 6 (GDD)
// ============================================================

export interface GddAiInput {
  projectName: string;
  genre: string;
  format: string;
  sectionCount: number;
}

export async function enrichGdd(ctx: GddAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const prompt = `Ты — технический писатель GDD. Дай рекомендации по структуре дизайн-документа.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Формат: ${ctx.format}
Секций: ${ctx.sectionCount}

Дай 3 совета (на русском):
1. Какие секции наиболее критичны для этого жанра
2. Как структурировать narrative и gameplay секции
3. Какие чек-листы валидации приоритетны

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по написанию GDD." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichGdd failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI Graph Generation (Phase 3.1)
// ============================================================

export interface AiGraphInput {
  description: string;
  mode?: "2d" | "3d";
}

export interface AiGraphResult {
  nodes: Array<{
    id: string;
    type: string;
    label: string;
    position: { x: number; y: number };
    properties: Record<string, unknown>;
  }>;
  edges: Array<{
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }>;
}

/**
 * AI генерирует граф прототипа из текстового описания игры.
 * LLM возвращает JSON с nodes и edges, используя 20 типов нод.
 */
export async function generateGraphFromText(
  ctx: AiGraphInput
): Promise<AiGraphResult | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const prompt = `Ты — экспертный геймдизайнер и визуальный программист. Создай граф игрового прототипа из описания.

Описание: "${ctx.description}"
Режим: ${ctx.mode || "2d"}

Доступные типы нод (20):
Events: onGameStart, onTick, onCollision, onKey, onTimerEnd
Entities: player, enemy, collectible, base, spawner
Flow: branch, forEach, delay, sequence
Data: counter, random, math, array
Output: win, lose

Каждая нода имеет inputs и outputs (pins). Связи идут от output pin к input pin.

Сгенерируй JSON:
{
  "nodes": [
    { "id": "n1", "type": "onGameStart", "label": "Start", "position": {"x":50,"y":50}, "properties": {} },
    { "id": "n2", "type": "player", "label": "Player", "position": {"x":50,"y":150}, "properties": {"speed":150} },
    ... (5-10 нод)
  ],
  "edges": [
    { "source": "n3", "sourceHandle": "onCollect", "target": "n4", "targetHandle": "increment" },
    ...
  ]
}

Правила:
- Должен быть хотя бы 1 event (onGameStart) + win или lose
- Позиции: x от 50 до 500, y от 50 до 300
- Properties из defaultProperties соответствующего типа ноды
- Связи: sourceHandle и targetHandle должны существовать у нод

Ответ — только валидный JSON, без markdown.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON." },
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

    if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) return null;

    return {
      nodes: parsed.nodes as AiGraphResult["nodes"],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as AiGraphResult["edges"]) : [],
    };
  } catch (e) {
    console.error("[ai-service] generateGraphFromText failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI Graph Validation & Suggestions (Phase 3.2)
// ============================================================

export interface AiGraphSuggestion {
  type: "error" | "warning" | "suggestion";
  message: string;
  suggestedNode?: string;
  fixAction?: string;
}

/**
 * AI анализирует граф и предлагает улучшения.
 */
export async function validateGraphWithAI(
  nodeTypes: string[],
  edgeCount: number,
  description?: string
): Promise<AiGraphSuggestion[] | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const prompt = `Проанализируй граф прототипа и дай рекомендации.

Ноды (${nodeTypes.length}): ${nodeTypes.join(", ")}
Связей: ${edgeCount}
${description ? `Описание игры: ${description}` : ""}

Доступные типы нод: onGameStart, onTick, onCollision, onKey, onTimerEnd, player, enemy, collectible, base, spawner, branch, forEach, delay, sequence, counter, random, math, array, win, lose

Проверь:
1. Есть ли Event нода?
2. Есть ли Win/Lose?
3. Есть ли Player?
4. Достаточно ли связей?
5. Что можно улучшить?

Ответ — JSON массив: [{"type":"error|warning|suggestion","message":"...","suggestedNode":"тип ноды (опционально)","fixAction":"описание (опционально)"}]`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON массивом." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || "";
    let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const arrStart = cleaned.indexOf("[");
    const arrEnd = cleaned.lastIndexOf("]");
    if (arrStart >= 0 && arrEnd > arrStart) {
      cleaned = cleaned.slice(arrStart, arrEnd + 1);
    }

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return null;

    return parsed as AiGraphSuggestion[];
  } catch (e) {
    console.error("[ai-service] validateGraphWithAI failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI Graph from GDD (Phase 3.3)
// ============================================================

export interface GddToGraphInput {
  projectName: string;
  genre: string;
  coreLoopType: string;
  steps: string[];
  mechanicsDb?: string[];
}

/**
 * Генерирует граф прототипа из данных проекта (GDD + core loop).
 */
export async function generateGraphFromGdd(
  ctx: GddToGraphInput
): Promise<AiGraphResult | null> {
  const zai = await getZai();
  if (!zai) return null;

  try {
    const prompt = `Создай граф прототипа на основе данных проекта.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType}
Шаги кор-лупа: ${ctx.steps.join(" → ")}
${ctx.mechanicsDb ? `Механики из MechanicsDB: ${ctx.mechanicsDb.join(", ")}` : ""}

Маппинг шагов → ноды:
- "explore"/"study" → player + collectible
- "combat"/"fight" → enemy + base
- "build"/"place" → spawner + base
- "upgrade"/"progress" → counter
- "reward"/"score" → win

Доступные типы: onGameStart, onTick, onCollision, onKey, onTimerEnd, player, enemy, collectible, base, spawner, branch, forEach, delay, sequence, counter, random, math, array, win, lose

Сгенерируй JSON: {"nodes":[...], "edges":[...]}
- 5-10 нод, позиции x:50-500, y:50-300
- Event + Win/Lose обязательны

Ответ — только валидный JSON.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON." },
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

    if (!Array.isArray(parsed.nodes)) return null;

    return {
      nodes: parsed.nodes as AiGraphResult["nodes"],
      edges: Array.isArray(parsed.edges) ? (parsed.edges as AiGraphResult["edges"]) : [],
    };
  } catch (e) {
    console.error("[ai-service] generateGraphFromGdd failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
