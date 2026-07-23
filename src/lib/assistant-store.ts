/**
 * Gidede — Persistent store for AI Assistant (Block 7).
 *
 * Чат-история и метаданные сохраняются в Prisma (модели ChatMessage +
 * GbeSyncHistory). Данные переживают перезапуск сервера (критерий C5).
 *
 * Интерфейс ChatMsg сохранён для обратной совместимости с вызовами в route handlers.
 */

import { db } from "@/lib/db";

export interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
  project_id?: string | null;
}

export async function getHistory(
  userId: string,
  projectId: string | null | undefined,
  limit = 50
): Promise<{ messages: ChatMsg[]; total: number }> {
  const where = projectId
    ? { userId, projectId }
    : { userId, projectId: null };

  const [rows, total] = await Promise.all([
    db.chatMessage.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
    db.chatMessage.count({ where }),
  ]);

  // findMany с desc уже возвращает самые свежие первыми — это и есть наш reverse-chron
  const messages: ChatMsg[] = rows.map((r) => ({
    id: r.id,
    role: r.role as "user" | "assistant" | "system",
    content: r.content,
    timestamp: r.createdAt.getTime(),
    metadata: r.metadata ? safeJsonParse(r.metadata) : undefined,
    project_id: r.projectId,
  }));

  return { messages, total };
}

export async function appendMessage(
  userId: string,
  projectId: string | null | undefined,
  msg: ChatMsg
): Promise<void> {
  await db.chatMessage.create({
    data: {
      userId,
      projectId: projectId ?? null,
      role: msg.role,
      content: msg.content,
      metadata: msg.metadata ? JSON.stringify(msg.metadata) : null,
    },
  });
}

export async function clearHistory(
  userId: string,
  projectId: string | null | undefined
): Promise<number> {
  const where = projectId
    ? { userId, projectId }
    : { userId, projectId: null };
  const result = await db.chatMessage.deleteMany({ where });
  return result.count;
}

function safeJsonParse(s: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

// ============================================================
// Deterministic AI response generator (NO real LLM)
// ============================================================

interface ResponseContext {
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
}

interface AiResponse {
  text: string;
  suggestions?: Array<{
    title: string;
    description: string;
    action: string;
    priority: string;
    data?: Record<string, unknown>;
  }>;
}

/**
 * Build a canned-but-contextual Russian response based on the user's message
 * and the project's pipeline state. Keyword-driven — no real LLM.
 */
export function generateAssistantResponse(ctx: ResponseContext): AiResponse {
  const msg = ctx.message.toLowerCase();
  const projectName = ctx.projectName || "ваш проект";
  const completion = ctx.completionPercent ?? 0;
  const stage = ctx.currentStage || "—";

  // --- Balance / balancing
  if (/(баланс|balanc|transitive|intransitive|имбаланс|неравновес)/.test(msg)) {
    return {
      text:
        `Для балансировки проекта «${projectName}» используйте трёхшаговую модель:\n` +
        `1. Классифицируйте элементы (transitive / intransitive / mixed).\n` +
        `2. Постройте cost-power кривые для каждого класса.\n` +
        `3. Запустите Monte-Carlo симуляцию (≥1000 итераций) и проверьте Nash equilibrium для intransitive-наборов.\n\n` +
        (ctx.hasBalance
          ? "У вас уже сохранён результат балансировки — откройте Блок 4 для просмотра imbalances и corrections."
          : "Сейчас в проекте нет данных по балансу. Запустите алгоритм Блока 4 (Balance Analyze), чтобы получить полный отчёт."),
      suggestions: [
        {
          title: "Запустить балансировку",
          description:
            "Запустит алгоритм 3.4 — построит cost-power кривые и найдёт патологии.",
          action: "generate",
          priority: ctx.hasBalance ? "low" : "high",
          data: { block_id: 4 },
        },
      ],
    };
  }

  // --- Core loop
  if (/(core.?loop|кор.?луп|основной цикл|gameplay loop|внутренний цикл)/.test(msg)) {
    return {
      text:
        `Core Loop — это сердце проекта «${projectName}». Структурно core loop бывает трёх типов:\n` +
        `• Engine — генерирует ресурсы (например, farming).\n` +
        `• Economy — конвертирует ресурсы (crafting, торговля).\n` +
        `• Ecology — конкуренция за ресурсы (PvP, asymmetric).\n\n` +
        `Рекомендую анализировать иерархию: inner loop (секунды) → core loop (минуты) → outer loop (часы) → meta loop (сессии). ` +
        `Проверьте каждый цикл на патологии: positive feedback runaway, dynamic inefficiency, dominant strategy.`,
      suggestions: [
        {
          title: "Проверить Core Loop на патологии",
          description:
            "Анализ 3.2 найдёт runaways, dynamic inefficiency и dominant strategies.",
          action: "validate",
          priority: "medium",
          data: { block_id: 2 },
        },
      ],
    };
  }

  // --- Economy
  if (/(экономик|economy|ресурс|faucet|drain|инфляц)/.test(msg)) {
    return {
      text:
        `Экономика «${projectName}» оценивается через faucet/drain ratio и Machinations-модель.\n` +
        `Ключевые шаги:\n` +
        `1. Составьте inventory ресурсов (валюты, материалы, прогрессия).\n` +
        `2. Найдите все conversion chains (gold → items → upgrades).\n` +
        `3. Запустите симуляцию на 50+ тиков с шумом ±10%.\n` +
        `4. Найдите патологии: inflation, drain, stall, runaway.\n\n` +
        (ctx.hasEconomy
          ? "Экономика уже смоделирована — откройте Блок 5 (вкладка Economy) для просмотра Machinations-графа."
          : "Экономика пока не смоделирована. Запустите алгоритм 3.6 в Блоке 5."),
      suggestions: [
        {
          title: "Смоделировать экономику",
          description: "Алгоритм 3.6 — построит Machinations graph и найдёт патологии.",
          action: "generate",
          priority: ctx.hasEconomy ? "low" : "high",
          data: { block_id: 5 },
        },
      ],
    };
  }

  // --- Progression
  if (/(прогресс|progression|xp|уровн|level|tier)/.test(msg)) {
    return {
      text:
        `Для прогрессии «${projectName}» определите:\n` +
        `• total_levels и target_duration_hours.\n` +
        `• progression_type (linear / exponential / diminishing / s_curve / intermittent / custom).\n` +
        `• monetization_model (f2p, b2p, subscription, p2w, cosmetic, hybrid).\n` +
        `• pacing (relaxed, balanced, intense).\n\n` +
        `Затем алгоритм 3.5 построит tier-модель, XP/power/cost/difficulty кривые и content plan с unlock tree.`,
      suggestions: [
        {
          title: "Спроектировать прогрессию",
          description: "Алгоритм 3.5 — построит кривые, tier-модель и validation report.",
          action: "generate",
          priority: ctx.hasProgression ? "low" : "high",
          data: { block_id: 5 },
        },
      ],
    };
  }

  // --- GDD
  if (/(gdd|дизайн.?документ|one.?pager|ten.?pager)/.test(msg)) {
    return {
      text:
        `GDD (Game Design Document) собирается из данных предыдущих блоков.\n` +
        `Форматы: one_sheet | ten_pager | full_gdd.\n` +
        `Для «${projectName}» рекомендую формат full_gdd — он даёт 21 секцию (title, concept, mechanics, dynamics, aesthetics, narrative, balance, progression, economy, monetization и т.д.).\n\n` +
        (ctx.hasGdd
          ? "GDD уже сгенерирован — вы можете экспортировать его в md/html/docx/pdf через Блок 6."
          : "GDD ещё не сгенерирован. Откройте Блок 6 и нажмите «Сгенерировать GDD»."),
      suggestions: [
        {
          title: ctx.hasGdd ? "Экспортировать GDD" : "Сгенерировать GDD",
          description: ctx.hasGdd
            ? "Экспорт в Markdown / HTML / DOCX / PDF."
            : "Алгоритм 3.7 соберёт GDD из данных предыдущих блоков.",
          action: "generate",
          priority: "medium",
          data: { block_id: 6 },
        },
      ],
    };
  }

  // --- MDA
  if (/(mda|mechanic|dynamic|aesthetic|механик|динамик|эстетик)/.test(msg)) {
    return {
      text:
        `MDA-фреймворк (Hunicke, LeBlanc, Zubek, 2004) описывает игру с трёх точек зрения:\n` +
        `• Mechanics — правила, данные, алгоритмы (что «делает» игра).\n` +
        `• Dynamics — поведение системы во времени (что «возникает» из правил).\n` +
        `• Aesthetics — желаемые эмоции игрока (Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission, Abnegation).\n\n` +
        `Алгоритм 3.3 строит StructuredMechanicSet → предсказывает Dynamics → соотносит с целевыми Aesthetics через match-score.`,
      suggestions: [
        {
          title: "Запустить MDA-анализ",
          description: "Алгоритм 3.3 — построит mechanic → dynamic → aesthetic mapping.",
          action: "generate",
          priority: ctx.hasMda ? "low" : "high",
          data: { block_id: 3 },
        },
      ],
    };
  }

  // --- Ludonarrative
  if (/(лудонарратив|ludonarrative|диссонанс)/.test(msg)) {
    return {
      text:
        `Лудонарративный диссонанс (Seropian, 2007) — конфликт между тем, что игра рассказывает (narrative), и тем, что игрок делает (ludus).\n` +
        `Например: сюжет про пацифиста, но gameplay требует убивать сотни врагов.\n\n` +
        `Алгоритм 3.3 включает ludonarrative_check: сравнивает заявленные aesthetics с фактическими dynamics и помечает конфликты. Запустите Блок 3 для проверки.`,
    };
  }

  // --- Concept
  if (/(концепт|concept|idea|идея|logline|жанр|genre)/.test(msg)) {
    return {
      text:
        `Концепция проекта — фундамент всего пайплайна. Убедитесь, что у «${projectName}» есть:\n` +
        `• Жанр и поджанр.\n` +
        `• Logline (1-2 предложения, кто игрок и что делает).\n` +
        `• USP (unique selling proposition) — что отличает от аналогов.\n` +
        `• Primary aesthetic — главная эмоция (Sensation, Challenge, Narrative и т.д.).\n` +
        `• Целевая аудитория и платформы.\n\n` +
        (ctx.hasConcept
          ? "Концепция уже задана. Можете запустить Блок 2 (Core Loop) или Блок 3 (MDA)."
          : "Концепция пока не сгенерирована. Откройте Блок 1 и введите идею."),
      suggestions: [
        {
          title: "Сгенерировать концепцию",
          description: "Алгоритм 3.1 — построит one-pager, aesthetic profile, dynamics profile.",
          action: "generate",
          priority: ctx.hasConcept ? "low" : "high",
          data: { block_id: 1 },
        },
      ],
    };
  }

  // --- Validation / checklist
  if (/(валид|провер|validate|checklist|issue|проблем|готовност)/.test(msg)) {
    return {
      text:
        `Финальная валидация проекта «${projectName}» выполняется алгоритмом 3.8.\n` +
        `Проверяет 5 линз:\n` +
        `1. MDA — соответствие mechanics → aesthetics.\n` +
        `2. Balance — Nash equilibrium, Monte-Carlo, патологии.\n` +
        `3. Narrative — ludonarrative consistency.\n` +
        `4. Economy — faucet/drain, inflation, drain, stall.\n` +
        `5. Lens — Schell's lens-анализ.\n\n` +
        `Результат: overall_score (0..1), readiness (ready / almost / not_ready), top issues + quick wins.`,
      suggestions: [
        {
          title: "Запустить валидацию",
          description: "Алгоритм 3.8 — runs MDA + balance + narrative + economy + lens checks.",
          action: "validate",
          priority: ctx.hasChecklist ? "low" : "high",
          data: { block_id: 6 },
        },
      ],
    };
  }

  // --- F2P / monetization
  if (/(f2p|free.?to.?play|монетиз|monetiz|p2w|pay.?to.?win|subscrib|cosmetic)/.test(msg)) {
    return {
      text:
        `Модели монетизации:\n` +
        `• F2P — бесплатные, доход от микротранзакций. Нужны мягкие/жёсткие стены.\n` +
        `• B2P — единоразовая покупка, без стен.\n` +
        `• Subscription — постоянный темп, регулярные награды.\n` +
        `• P2W — стены преодолеваются только покупкой (избегать!).\n` +
        `• Cosmetic — монетизация вне прогрессии.\n` +
        `• Hybrid — комбинированный.\n\n` +
        `Для «${projectName}» рекомендую проверить: не конфликтует ли monetization с pacing (relaxed + F2P = проблема).`,
    };
  }

  // --- Pipeline status
  if (/(пайплайн|pipeline|статус|прогресс проекта|что дальше|следующий шаг)/.test(msg)) {
    const filled: string[] = [];
    if (ctx.hasConcept) filled.push("Concept");
    if (ctx.hasCoreLoop) filled.push("Core Loop");
    if (ctx.hasMda) filled.push("MDA");
    if (ctx.hasBalance) filled.push("Balance");
    if (ctx.hasProgression) filled.push("Progression");
    if (ctx.hasEconomy) filled.push("Economy");
    if (ctx.hasGdd) filled.push("GDD");
    if (ctx.hasChecklist) filled.push("Validation");
    return {
      text:
        `Текущее состояние проекта «${projectName}»:\n` +
        `• Заполнено блоков: ${filled.length} / 8 (${completion}%).\n` +
        `• Текущая стадия: ${stage}.\n` +
        `• Заполненные блоки: ${filled.length > 0 ? filled.join(", ") : "пока ничего"}.\n\n` +
        `Следующий шаг: ${
          !ctx.hasConcept
            ? "сгенерируйте концепцию (Блок 1)."
            : !ctx.hasCoreLoop
              ? "спроектируйте Core Loop (Блок 2)."
              : !ctx.hasMda
                ? "выполните MDA-анализ (Блок 3)."
                : !ctx.hasBalance
                  ? "запустите балансировку (Блок 4)."
                  : !ctx.hasProgression
                    ? "спроектируйте прогрессию (Блок 5)."
                    : !ctx.hasEconomy
                      ? "смоделируйте экономику (Блок 5)."
                      : !ctx.hasGdd
                        ? "сгенерируйте GDD (Блок 6)."
                        : !ctx.hasChecklist
                          ? "запустите финальную валидацию (Блок 6)."
                          : "пайплайн завершён — экспортируйте GDD и переходите к GBE-интеграции (Блок 8)."
        }`,
      suggestions: [
        {
          title: "Открыть следующий блок",
          description: "Перейдите к следующему незаполненному блоку пайплайна.",
          action: "review",
          priority: "medium",
        },
      ],
    };
  }

  // --- Greeting
  if (/^(привет|здравствуй|hello|hi|хай|добрый)/.test(msg.trim())) {
    return {
      text:
        `Здравствуйте! Я AI-ассистент Gidede. Помогу с геймдизайном проекта «${projectName}».\n` +
        `Можете спросить про:\n` +
        `• Core Loop, MDA, балансировку, экономику, прогрессию, GDD.\n` +
        `• Запустить следующий блок пайплайна.\n` +
        `• Проверить проект на проблемы.\n\n` +
        `Текущий прогресс: ${completion}% (стадия: ${stage}).`,
    };
  }

  // --- Default fallback
  return {
    text:
      `Я получил ваш запрос: «${ctx.message}».\n\n` +
      `Я могу помочь с геймдизайном проекта «${projectName}» — core loop, MDA, баланс, экономика, прогрессия, GDD, валидация.\n` +
      `Уточните, какой аспект вы хотите обсудить, или запустите следующий блок пайплайна.\n\n` +
      `Текущий прогресс: ${completion}%, стадия: ${stage}.`,
    suggestions: [
      {
        title: "Открыть пайплайн",
        description: "Проверить текущее состояние проекта.",
        action: "review",
        priority: "low",
      },
    ],
  };
}

// ============================================================
// Block-specific suggestions (used by /assistant/suggestions)
// ============================================================

interface ProjectPipelineSnapshot {
  hasConcept?: boolean;
  hasCoreLoop?: boolean;
  hasMda?: boolean;
  hasBalance?: boolean;
  hasProgression?: boolean;
  hasEconomy?: boolean;
  hasGdd?: boolean;
  hasChecklist?: boolean;
  completionPercent?: number;
}

interface Suggestion {
  title: string;
  description: string;
  action: string;
  priority: string;
  data?: Record<string, unknown>;
}

/** Per-block canned suggestions derived from project state. */
export function getBlockSuggestions(
  blockId: number,
  snap: ProjectPipelineSnapshot
): Suggestion[] {
  switch (blockId) {
    case 1: // Concept
      return [
        {
          title: snap.hasConcept ? "Уточнить USP" : "Сгенерировать концепцию",
          description: snap.hasConcept
            ? "USP уже задан — проверьте triangle check и differentiation."
            : "Запустите алгоритм 3.1 — построит one-pager, aesthetic profile и dynamics profile.",
          action: "generate",
          priority: snap.hasConcept ? "low" : "high",
          data: { block_id: 1 },
        },
        {
          title: "Проверить triangle check",
          description: "Убедитесь, что USP, жанр и audience не конфликтуют.",
          action: "validate",
          priority: "medium",
        },
      ];
    case 2: // Core Loop
      return [
        {
          title: snap.hasCoreLoop
            ? "Проверить патологии Core Loop"
            : "Спроектировать Core Loop",
          description: snap.hasCoreLoop
            ? "Алгоритм 3.2 найдёт runaways, dynamic inefficiency, dominant strategies."
            : "Определите structural type (Engine / Economy / Ecology) иерархию циклов.",
          action: snap.hasCoreLoop ? "validate" : "generate",
          priority: snap.hasCoreLoop ? "medium" : "high",
          data: { block_id: 2 },
        },
        {
          title: "Анализ иерархии циклов",
          description: "Inner → core → outer → meta — проверьте переходы.",
          action: "review",
          priority: "low",
        },
      ];
    case 3: // MDA
      return [
        {
          title: snap.hasMda ? "Запустить lens check" : "Запустить MDA-анализ",
          description: snap.hasMda
            ? "Проверьте lens validation и bond validation для aesthetics."
            : "Алгоритм 3.3 построит mechanic → dynamic → aesthetic mapping.",
          action: snap.hasMda ? "validate" : "generate",
          priority: snap.hasMda ? "medium" : "high",
          data: { block_id: 3 },
        },
        {
          title: "Проверить ludonarrative",
          description: "Убедитесь, что narrative и ludus не конфликтуют.",
          action: "review",
          priority: "medium",
        },
      ];
    case 4: // Balance
      return [
        {
          title: snap.hasBalance
            ? "Перепроверить Nash equilibrium"
            : "Запустить балансировку",
          description: snap.hasBalance
            ? "Intransitive-наборы должны иметь стабильное равновесие."
            : "Алгоритм 3.4 построит cost-power кривые и найдёт патологии.",
          action: snap.hasBalance ? "validate" : "generate",
          priority: snap.hasBalance ? "medium" : "high",
          data: { block_id: 4 },
        },
        {
          title: "Monte-Carlo симуляция",
          description: "Запустите ≥1000 итераций для проверки win-rate.",
          action: "review",
          priority: "low",
        },
      ];
    case 5: // Progression + Economy
      return [
        {
          title: snap.hasProgression
            ? "Проверить XP runaway"
            : "Спроектировать прогрессию",
          description: snap.hasProgression
            ? "Контролируйте growth_rate XP-кривой (ratio < 200)."
            : "Алгоритм 3.5 построит tier-модель и кривые.",
          action: snap.hasProgression ? "validate" : "generate",
          priority: snap.hasProgression ? "medium" : "high",
          data: { block_id: 5 },
        },
        {
          title: snap.hasEconomy
            ? "Найти патологии экономики"
            : "Смоделировать экономику",
          description: snap.hasEconomy
            ? "Проверьте inflation, drain, stall, runaway."
            : "Алгоритм 3.6 построит Machinations graph и симуляцию.",
          action: snap.hasEconomy ? "validate" : "generate",
          priority: snap.hasEconomy ? "medium" : "high",
          data: { block_id: 5 },
        },
      ];
    case 6: // GDD + Validation
      return [
        {
          title: snap.hasGdd
            ? "Экспортировать GDD"
            : "Сгенерировать GDD",
          description: snap.hasGdd
            ? "Экспортируйте в md / html / docx / pdf."
            : "Алгоритм 3.7 соберёт GDD из данных предыдущих блоков.",
          action: "generate",
          priority: snap.hasGdd ? "low" : "high",
          data: { block_id: 6 },
        },
        {
          title: snap.hasChecklist
            ? "Просмотреть issues"
            : "Запустить финальную валидацию",
          description: snap.hasChecklist
            ? "Проверьте top_5_issues и quick_wins."
            : "Алгоритм 3.8 проверит MDA, balance, narrative, economy, lens.",
          action: snap.hasChecklist ? "review" : "validate",
          priority: snap.hasChecklist ? "medium" : "high",
          data: { block_id: 6 },
        },
      ];
    case 7: // AI Assistant
      return [
        {
          title: "Спросить про баланс",
          description: "Получите рекомендации по балансировке проекта.",
          action: "review",
          priority: "low",
        },
        {
          title: "Спросить про core loop",
          description: "Узнайте, как проектировать основной цикл игры.",
          action: "review",
          priority: "low",
        },
      ];
    case 8: // GBE Bridge
      return [
        {
          title: "Проверить подключение GBE",
          description: "Test connection к GDCombine API (mock-режим).",
          action: "validate",
          priority: "low",
          data: { block_id: 8 },
        },
        {
          title: "Синхронизировать с GBE",
          description: "Экспортируйте проект в GDCombine или импортируйте изменения.",
          action: "generate",
          priority: "low",
          data: { block_id: 8 },
        },
      ];
    default:
      return [];
  }
}

// ============================================================
// Proactive alerts (used by /assistant/alerts)
// ============================================================

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  block_id: number;
  title: string;
  description: string;
  suggestion: string;
  timestamp: number;
}

/** Derive alerts from project's pipeline state. Empty stages → warnings. */
export function deriveAlerts(snap: ProjectPipelineSnapshot): Alert[] {
  const now = Date.now();
  const alerts: Alert[] = [];

  if (!snap.hasConcept) {
    alerts.push({
      id: `alert-concept-${now}`,
      alert_type: "missing_stage",
      severity: "warning",
      block_id: 1,
      title: "Концепция не сгенерирована",
      description: "Проект не имеет сгенерированной концепции — это фундамент всего пайплайна.",
      suggestion: "Откройте Блок 1 и сгенерируйте концепцию (алгоритм 3.1).",
      timestamp: now,
    });
  }

  if (snap.hasConcept && !snap.hasCoreLoop) {
    alerts.push({
      id: `alert-coreloop-${now}`,
      alert_type: "missing_stage",
      severity: "warning",
      block_id: 2,
      title: "Core Loop не спроектирован",
      description: "Концепция есть, но core loop ещё не построен.",
      suggestion: "Откройте Блок 2 и задайте structural type + шаги цикла.",
      timestamp: now,
    });
  }

  if (snap.hasCoreLoop && !snap.hasMda) {
    alerts.push({
      id: `alert-mda-${now}`,
      alert_type: "missing_stage",
      severity: "info",
      block_id: 3,
      title: "MDA-анализ не выполнен",
      description: "Core Loop есть, но MDA-профиль не построен.",
      suggestion: "Запустите алгоритм 3.3 — построит mechanic → aesthetic mapping.",
      timestamp: now,
    });
  }

  if (snap.hasMda && !snap.hasBalance) {
    alerts.push({
      id: `alert-balance-${now}`,
      alert_type: "missing_stage",
      severity: "info",
      block_id: 4,
      title: "Балансировка не запущена",
      description: "MDA есть, но балансировка элементов не выполнена.",
      suggestion: "Запустите алгоритм 3.4 — построит cost-power кривые.",
      timestamp: now,
    });
  }

  if (snap.hasBalance && !snap.hasProgression) {
    alerts.push({
      id: `alert-progression-${now}`,
      alert_type: "missing_stage",
      severity: "info",
      block_id: 5,
      title: "Прогрессия не спроектирована",
      description: "Баланс есть, но прогрессия не построена.",
      suggestion: "Запустите алгоритм 3.5 — построит tier-модель и кривые.",
      timestamp: now,
    });
  }

  if (snap.hasProgression && !snap.hasEconomy) {
    alerts.push({
      id: `alert-economy-${now}`,
      alert_type: "missing_stage",
      severity: "info",
      block_id: 5,
      title: "Экономика не смоделирована",
      description: "Прогрессия есть, но экономика не построена.",
      suggestion: "Запустите алгоритм 3.6 — построит Machinations graph.",
      timestamp: now,
    });
  }

  if (snap.hasEconomy && !snap.hasGdd) {
    alerts.push({
      id: `alert-gdd-${now}`,
      alert_type: "missing_stage",
      severity: "warning",
      block_id: 6,
      title: "GDD не сгенерирован",
      description: "Все предыдущие блоки готовы — пора собрать GDD.",
      suggestion: "Запустите алгоритм 3.7 в Блоке 6.",
      timestamp: now,
    });
  }

  if (snap.hasGdd && !snap.hasChecklist) {
    alerts.push({
      id: `alert-checklist-${now}`,
      alert_type: "missing_stage",
      severity: "warning",
      block_id: 6,
      title: "Финальная валидация не выполнена",
      description: "GDD есть, но checklist не запущен.",
      suggestion: "Запустите алгоритм 3.8 — проверит MDA, balance, narrative, economy, lens.",
      timestamp: now,
    });
  }

  // Completion milestone
  if ((snap.completionPercent ?? 0) >= 100) {
    alerts.push({
      id: `alert-complete-${now}`,
      alert_type: "milestone",
      severity: "info",
      block_id: 8,
      title: "Проект готов к экспорту",
      description: "Все 8 блоков пайплайна завершены.",
      suggestion: "Экспортируйте GDD и синхронизируйте с GBE (Блок 8).",
      timestamp: now,
    });
  }

  return alerts;
}
