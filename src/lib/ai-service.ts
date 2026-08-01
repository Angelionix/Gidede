/**
 * Gidede — provider-agnostic AI orchestration service.
 *
 * Uses the shared LlmClient contract and falls back to deterministic logic
 * if the selected provider is unavailable or errors out.
 */

import { getLlmClientForStage } from "@/lib/llm/default-client";
import { createStructuredCompletion } from "@/lib/llm/structured-output";
import {
  aiGraphSchema,
  aiGraphSuggestionsSchema,
  conceptEnrichmentSchema,
  customMechanicSchema,
  type AiGraphOutput,
  type AiGraphSuggestionOutput,
  type ConceptEnrichmentOutput,
  type CustomMechanicOutput,
} from "@/lib/ai-structured-schemas";
import {
  buildBiblePromptContext,
  type BiblePromptSource,
} from "@/lib/llm/bible-context";
import type { LlmCallTelemetry } from "@/lib/llm/types";

const getLlmClient = getLlmClientForStage;

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

export interface AiTextResponse {
  text: string;
  sources: BiblePromptSource[];
  telemetry?: LlmCallTelemetry;
}

async function buildAssistantMessages(ctx: AiContext): Promise<{
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  sources: BiblePromptSource[];
}> {
  const rag = await buildBiblePromptContext(ctx.message);
  const messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: SYSTEM_PROMPT }];

  if (rag.promptContext) {
    messages.push({ role: "system", content: rag.promptContext });
  }

  if (ctx.history && ctx.history.length > 0) {
    const recent = ctx.history.slice(-6);
    for (const message of recent) {
      messages.push({ role: message.role, content: message.content });
    }
  }

  messages.push({ role: "user", content: buildUserPrompt(ctx) });
  return { messages, sources: rag.sources };
}

/**
 * Generate a real AI response via the selected LLM provider.
 * Returns null if the provider is unavailable or fails — caller should fall back
 * to deterministic logic.
 */
export async function generateAiResponse(
  ctx: AiContext
): Promise<string | null> {
  const result = await generateAiResponseWithSources(ctx);
  return result?.text ?? null;
}

export async function generateAiResponseWithSources(
  ctx: AiContext
): Promise<AiTextResponse | null> {
  const zai = await getLlmClient("assistant");
  if (!zai) return null;

  try {
    const { messages, sources } = await buildAssistantMessages(ctx);
    let telemetry: LlmCallTelemetry | undefined;

    const response = await zai.createCompletion({
      messages,
      stream: false,
      reasoning: "disabled",
      onTelemetry: (event) => {
        if (event.status === "success") telemetry = event;
      },
    });

    const reply = response.choices?.[0]?.message?.content;
    return reply && reply.trim().length > 0
      ? { text: reply.trim(), sources, ...(telemetry ? { telemetry } : {}) }
      : null;
  } catch (e) {
    console.error(
      "[ai-service] LLM completion failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * Stream an AI response token-by-token via the selected LLM provider.
 * Calls onDelta for each chunk. Returns the full text when done.
 * Returns null if the provider is unavailable — caller should fall back.
 */
export async function streamAiResponse(
  ctx: AiContext,
  onDelta: (chunk: string) => void
): Promise<string | null> {
  const result = await streamAiResponseWithSources(ctx, onDelta);
  return result?.text ?? null;
}

export async function streamAiResponseWithSources(
  ctx: AiContext,
  onDelta: (chunk: string) => void
): Promise<AiTextResponse | null> {
  const zai = await getLlmClient("assistant");
  if (!zai) return null;

  try {
    const { messages, sources } = await buildAssistantMessages(ctx);
    let telemetry: LlmCallTelemetry | undefined;

    const stream = await zai.createCompletion({
      messages,
      stream: true,
      reasoning: "disabled",
      onTelemetry: (event) => {
        if (event.status === "success") telemetry = event;
      },
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        fullText += delta;
        onDelta(delta);
      }
    }

    const text = fullText.trim();
    return text
      ? { text, sources, ...(telemetry ? { telemetry } : {}) }
      : null;
  } catch (e) {
    console.error(
      "[ai-service] stream failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** Check if the selected LLM provider is available. */
export async function isAiAvailable(): Promise<boolean> {
  const zai = await getLlmClient("assistant");
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

export type ConceptEnrichment = ConceptEnrichmentOutput;

/**
 * AI-обогащение концепции: генерирует более креативные story_synopsis,
 * gameplay_description и unique_features через LLM. Возвращает null при
 * недоступности SDK — вызывающий код использует детерминированный fallback.
 */
export async function enrichConcept(
  ctx: ConceptEnrichmentInput
): Promise<ConceptEnrichment | null> {
  const zai = await getLlmClient("concept");
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

    return await createStructuredCompletion(zai, {
      messages: [
        {
          role: "system",
          content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON.",
        },
        { role: "user", content: prompt },
      ],
      reasoning: "disabled",
    }, {
      schema: conceptEnrichmentSchema,
      schemaName: "concept_enrichment",
      schemaHint: "strict object {story_synopsis:string, gameplay_description:string, unique_features:string[1..8], ai_insights:string}",
      maxRepairAttempts: 1,
    });
  } catch (e) {
    console.error(
      "[ai-service] enrichConcept failed:",
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

// TASK-6.7: Removed dead code enrichGddSection + GddEnrichmentInput.
// This function was declared but never called from any route.
// Per-section AI enrichment will be implemented in a future sprint if needed.

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
  const zai = await getLlmClient("prototype");
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

    const response = await zai.createCompletion({
      messages: [
        {
          role: "system",
          content:
            "Ты — AI-ассистент по геймдизайну, специализирующийся на прототипировании кор-лупов.",
        },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
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
): Promise<CustomMechanicOutput | null> {
  const zai = await getLlmClient("prototype");
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

    return await createStructuredCompletion(zai, {
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну и программированию. Отвечай только валидным JSON." },
        { role: "user", content: prompt },
      ],
      reasoning: "disabled",
    }, {
      schema: customMechanicSchema,
      schemaName: "custom_mechanic",
      schemaHint: "strict object {mechanicName:string, description:string, codeSnippet:string}",
      maxRepairAttempts: 1,
    });
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
  // TASK-2.18: расширенный контекст
  pathologies?: string[];
  deadResources?: string[];
  unsourcedConsumables?: string[];
  garyAnswers?: Record<string, string>;
}

export async function enrichCoreLoop(ctx: CoreLoopAiInput): Promise<string | null> {
  const zai = await getLlmClient("core_loop");
  if (!zai) return null;
  try {
    // TASK-2.18: расширенный prompt с реальным контекстом
    const pathologiesSection = ctx.pathologies && ctx.pathologies.length > 0
      ? `\nОбнаруженные патологии: ${ctx.pathologies.join(", ")}`
      : "\nПатологии не обнаружены.";

    const deadResourcesSection = ctx.deadResources && ctx.deadResources.length > 0
      ? `\nDead resources (производятся, но не потребляются): ${ctx.deadResources.join(", ")}`
      : "";

    const unsourcedSection = ctx.unsourcedConsumables && ctx.unsourcedConsumables.length > 0
      ? `\nUnsourced consumables (потребляются, но не производятся): ${ctx.unsourcedConsumables.join(", ")}`
      : "";

    const garySection = ctx.garyAnswers
      ? `\n\n5 вопросов Гэри:\n${Object.entries(ctx.garyAnswers).map(([q, a]) => `- ${q}: ${a}`).join("\n")}`
      : "";

    const prompt = `Ты — экспертный геймдизайнер. Дай инсайты по кор-лупу для теста «30 секунд веселья».

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType}
Шаги: ${ctx.steps.join(" → ")}
${pathologiesSection}${deadResourcesSection}${unsourcedSection}${garySection}

Дай 4 конкретных совета (на русском, каждый 1-2 предложения):
1. Что делает этот кор-луп увлекательным (fun factor)
2. Какие wow-моменты добавить для усиления эмоций
3. Какие риски fun factor могут возникнуть (учти обнаруженные патологии)
4. Конкретное улучшение для замкнутости цикла или resource flow

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.createCompletion({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, специализирующийся на core loop проектировании по методологии Шелла и Адамса/Дорманс." },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
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
  // TASK-3.14: расширенный контекст для более качественных AI-инсайтов.
  mechanicSet?: { compatibility_score: number; total_count?: number };
  dynamicsTarget?: { core_dynamics: string[]; supporting_dynamics: string[]; emergence_level: string };
  lensValidation?: { overall_score: number; critical_issues?: unknown[] };
  bondValidation?: { overall_consistency: number; ludonarrative?: { result: string } };
  classicMda?: { overall_match: number; converged: boolean };
}

export async function enrichMda(ctx: MdaAiInput): Promise<string | null> {
  const zai = await getLlmClient("mda");
  if (!zai) return null;
  try {
    // TASK-3.14: расширенный prompt с реальным контекстом MDA-анализа.
    const compatSection = ctx.mechanicSet
      ? `\nСовместимость механик: ${ctx.mechanicSet.compatibility_score}%`
      : "";
    const dynamicsSection = ctx.dynamicsTarget
      ? `\nCore динамики: ${ctx.dynamicsTarget.core_dynamics.join(", ")}\nSupporting динамики: ${ctx.dynamicsTarget.supporting_dynamics.join(", ")}\nУровень эмерджентности: ${ctx.dynamicsTarget.emergence_level}`
      : "";
    const lensSection = ctx.lensValidation
      ? `\nОбщий score линз Шелла: ${ctx.lensValidation.overall_score}\nCritical issues: ${ctx.lensValidation.critical_issues?.length || 0}`
      : "";
    const bondSection = ctx.bondValidation
      ? `\nBond matrix consistency: ${ctx.bondValidation.overall_consistency}\nLudonarrative: ${ctx.bondValidation.ludonarrative?.result || "unknown"}`
      : "";
    const matchSection = ctx.classicMda
      ? `\nOverall MDA match: ${ctx.classicMda.overall_match}\nConverged: ${ctx.classicMda.converged ? "yes" : "no"}`
      : "";

    const prompt = `Ты — экспертный геймдизайнер. Проанализируй MDA-профиль игры.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Целевые эстетики (LeBlanc): ${ctx.aesthetics.join(", ")}${compatSection}${dynamicsSection}${lensSection}${bondSection}${matchSection}

Дай 4 рекомендации (на русском, каждая 1-2 предложения):
1. Какие механики лучше всего вызовут целевые эстетики (учти текущий compatibility_score)
2. Какие динамики могут возникнуть и как их направить (учти emergence_level)
3. Какие линзы Шелла приоритетны (учти critical issues и zubek_level)
4. Как улучшить ludonarrative alignment (Гармония/Ирония/Диссонанс)

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.createCompletion({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по MDA фреймворку (Hunicke/LeBlanc/Zubek), линзам Шелла и матрице Бонда." },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
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
  // TASK-4.11: extended context for better AI insights.
  transitiveOverpowered?: string[];
  transitiveUnderpowered?: string[];
  balanceVerdict?: string;
  winRateSpread?: number;
  stabilityIndex?: number;
  balancePathologies?: string[];
}

export async function enrichBalance(ctx: BalanceAiInput): Promise<string | null> {
  const zai = await getLlmClient("balance");
  if (!zai) return null;
  try {
    // TASK-4.11: extended prompt with real balance analysis context.
    const overpoweredSection = ctx.transitiveOverpowered && ctx.transitiveOverpowered.length > 0
      ? `\nOverpowered: ${ctx.transitiveOverpowered.join(", ")}`
      : "";
    const underpoweredSection = ctx.transitiveUnderpowered && ctx.transitiveUnderpowered.length > 0
      ? `\nUnderpowered: ${ctx.transitiveUnderpowered.join(", ")}`
      : "";
    const verdictSection = ctx.balanceVerdict
      ? `\nBalance verdict: ${ctx.balanceVerdict}`
      : "";
    const spreadSection = ctx.winRateSpread !== undefined
      ? `\nWin rate spread: ${ctx.winRateSpread}%`
      : "";
    const stabilitySection = ctx.stabilityIndex !== undefined
      ? `\nStability index: ${ctx.stabilityIndex}`
      : "";
    const pathologiesSection = ctx.balancePathologies && ctx.balancePathologies.length > 0
      ? `\nОбнаруженные патологии: ${ctx.balancePathologies.join(", ")}`
      : "\nПатологии не обнаружены.";

    const prompt = `Ты — эксперт по балансу игр. Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип баланса: ${ctx.balanceType}
Количество элементов: ${ctx.elementCount}${overpoweredSection}${underpoweredSection}${verdictSection}${spreadSection}${stabilitySection}${pathologiesSection}

Дай 4 совета (на русском, каждый 1-2 предложения):
1. Какие метрики баланса наиболее важны для этого типа (учти verdict и spread)
2. Какие дисбалансы вероятны и как их предотвратить (учти обнаруженные патологии)
3. Какие Monte-Carlo параметры рекомендуются (итерации, критерии победы)
4. Конкретные корректировки для overpowered/underpowered объектов (если есть)

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.createCompletion({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по балансу игр по методологии Шрайбера и Адамса/Дорманс." },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
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
  const zai = await getLlmClient("progression");
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
    const response = await zai.createCompletion({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по прогрессии." },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichProgression failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// TASK-5b.1: New enrichEconomy function (was missing — route used enrichProgression).
export interface EconomyAiInput {
  projectName: string;
  genre: string;
  systemType: string; // Engine | Economy | Ecology
  resourceCount: number;
  monetizationType: string;
  openness: string;
  pathologies?: string[];
  stabilityIndex?: number;
  avgProfitability?: number;
  dominantLoop?: string;
}

export async function enrichEconomy(ctx: EconomyAiInput): Promise<string | null> {
  const zai = await getLlmClient("economy");
  if (!zai) return null;
  try {
    const pathologiesSection = ctx.pathologies && ctx.pathologies.length > 0
      ? `\nОбнаруженные патологии: ${ctx.pathologies.join(", ")}`
      : "\nПатологии не обнаружены.";
    const stabilitySection = ctx.stabilityIndex !== undefined
      ? `\nStability index: ${ctx.stabilityIndex}`
      : "";
    const profitabilitySection = ctx.avgProfitability !== undefined
      ? `\nСредняя прибыльность: ${ctx.avgProfitability}`
      : "";
    const dominantLoopSection = ctx.dominantLoop
      ? `\nДоминантная петля: ${ctx.dominantLoop}`
      : "";

    const prompt = `Ты — эксперт по игровой экономике. Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип системы: ${ctx.systemType}
Ресурсов: ${ctx.resourceCount}
Монетизация: ${ctx.monetizationType}
Открытость: ${ctx.openness}${pathologiesSection}${stabilitySection}${profitabilitySection}${dominantLoopSection}

Дай 4 совета (на русском, каждый 1-2 предложения):
1. Какие корректировки faucet/drain нужны (учти обнаруженные патологии)
2. Как улучшить стабильность экономики (учти stability index)
3. Какие конверсионные цепочки добавить или убрать (учти прибыльность)
4. Как монетизация влияет на баланс экономики (учти тип монетизации и открытость)

Ответ — обычный текст с нумерованными пунктами.`;
    const response = await zai.createCompletion({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по игровой экономике (Machinations, Schreiber, Adams/Dormans)." },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichEconomy failed:", e instanceof Error ? e.message : e);
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
  const zai = await getLlmClient("gdd");
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
    const response = await zai.createCompletion({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по написанию GDD." },
        { role: "user", content: prompt },
      ],
      stream: false,
      reasoning: "disabled",
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

export type AiGraphResult = AiGraphOutput;

/**
 * AI генерирует граф прототипа из текстового описания игры.
 * LLM возвращает JSON с nodes и edges, используя 20 типов нод.
 */
export async function generateGraphFromText(
  ctx: AiGraphInput
): Promise<AiGraphResult | null> {
  const zai = await getLlmClient("prototype");
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

    return await createStructuredCompletion(zai, {
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON." },
        { role: "user", content: prompt },
      ],
      reasoning: "disabled",
    }, {
      schema: aiGraphSchema,
      schemaName: "prototype_graph",
      schemaHint: "strict object {nodes:[{id,type,label,position:{x,y},properties}], edges:[{source,sourceHandle,target,targetHandle}]}; unique node IDs, known node types/endpoints, event and win/lose required",
      maxRepairAttempts: 1,
    });
  } catch (e) {
    console.error("[ai-service] generateGraphFromText failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

// ============================================================
// AI Graph Validation & Suggestions (Phase 3.2)
// ============================================================

export type AiGraphSuggestion = AiGraphSuggestionOutput;

/**
 * AI анализирует граф и предлагает улучшения.
 */
export async function validateGraphWithAI(
  nodeTypes: string[],
  edgeCount: number,
  description?: string
): Promise<AiGraphSuggestion[] | null> {
  const zai = await getLlmClient("prototype");
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

    return await createStructuredCompletion(zai, {
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON массивом." },
        { role: "user", content: prompt },
      ],
      reasoning: "disabled",
    }, {
      schema: aiGraphSuggestionsSchema,
      schemaName: "prototype_graph_suggestions",
      schemaHint: "array (max 50) of strict {type:error|warning|suggestion, message:string, suggestedNode?:string, fixAction?:string}",
      maxRepairAttempts: 1,
    });
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
  const zai = await getLlmClient("prototype");
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

    return await createStructuredCompletion(zai, {
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну. Отвечай только валидным JSON." },
        { role: "user", content: prompt },
      ],
      reasoning: "disabled",
    }, {
      schema: aiGraphSchema,
      schemaName: "gdd_prototype_graph",
      schemaHint: "strict object {nodes:[{id,type,label,position:{x,y},properties}], edges:[{source,sourceHandle,target,targetHandle}]}; unique node IDs, known node types/endpoints, event and win/lose required",
      maxRepairAttempts: 1,
    });
  } catch (e) {
    console.error("[ai-service] generateGraphFromGdd failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
