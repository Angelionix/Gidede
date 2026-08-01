/**
 * Gidede — Core Loop steps builder (Block 2, TASK-2.1/2.7/2.8/2.9).
 *
 * TASK-2.1: параметризация buildSteps по типу.
 *   7 builders: engine/economy/ecology/hybrid/tower_defense/rhythm/puzzle.
 * TASK-2.7: масштаб по жанру (Bible 4.11.3).
 * TASK-2.8: убраны dead_resources из default template.
 * TASK-2.9: customSteps mode — ресурсы из типа, не из feedback.
 */

const GENRE_DURATION_SCALE: Record<string, { short: number; medium: number; long: number }> = {
  action: { short: 4, medium: 6, long: 8 },
  shooter: { short: 3, medium: 5, long: 8 },
  platformer: { short: 2, medium: 4, long: 6 },
  fighting: { short: 2, medium: 3, long: 5 },
  racing: { short: 3, medium: 5, long: 10 },
  rhythm: { short: 1, medium: 2, long: 4 },
  puzzle: { short: 5, medium: 15, long: 30 },
  rpg: { short: 10, medium: 20, long: 40 },
  action_rpg: { short: 8, medium: 15, long: 30 },
  jrpg: { short: 15, medium: 30, long: 60 },
  tactical_rpg: { short: 30, medium: 60, long: 120 },
  mmorpg: { short: 10, medium: 30, long: 60 },
  strategy: { short: 30, medium: 60, long: 120 },
  rts: { short: 15, medium: 30, long: 60 },
  tbs: { short: 60, medium: 120, long: 300 },
  tower_defense: { short: 10, medium: 20, long: 45 },
  simulation: { short: 20, medium: 60, long: 120 },
  sandbox: { short: 15, medium: 30, long: 60 },
  horror: { short: 10, medium: 20, long: 40 },
  survival_horror: { short: 15, medium: 30, long: 60 },
  roguelike: { short: 8, medium: 15, long: 30 },
  adventure: { short: 15, medium: 30, long: 60 },
  metroidvania: { short: 8, medium: 15, long: 30 },
  idle: { short: 5, medium: 30, long: 60 },
  visual_novel: { short: 30, medium: 60, long: 120 },
  stealth: { short: 10, medium: 20, long: 40 },
};

export interface CoreStep {
  action: string;
  mechanics: string[];
  resources_consumed: string[];
  resources_produced: string[];
  feedback_type: "positive" | "negative" | "neutral";
  duration_estimate: number;
}

export type LoopType =
  | "engine"
  | "economy"
  | "ecology"
  | "hybrid"
  | "tower_defense"
  | "rhythm"
  | "puzzle";

export function buildSteps(
  mechanics: string[],
  customSteps: string[] | undefined,
  type: string,
  genre: string
): CoreStep[] {
  if (customSteps && customSteps.length > 0) {
    const scale = GENRE_DURATION_SCALE[genre] || GENRE_DURATION_SCALE.action;
    return customSteps.slice(0, 10).map((action, i) => {
      const mech = mechanics[i % Math.max(1, mechanics.length)] || "core_action";
      const { consumed, produced, feedback } = getResourcesForStep(type, i, customSteps.length);
      const durationKey = i < 2 ? "short" : i < customSteps.length - 1 ? "medium" : "long";
      return {
        action,
        mechanics: [mech],
        resources_consumed: consumed,
        resources_produced: produced,
        feedback_type: feedback,
        duration_estimate: scale[durationKey as keyof typeof scale],
      };
    });
  }

  const scale = GENRE_DURATION_SCALE[genre] || GENRE_DURATION_SCALE.action;
  const builder = STEP_BUILDERS[type as LoopType] || STEP_BUILDERS.hybrid;
  return builder(mechanics, scale);
}

function getResourcesForStep(
  type: string,
  stepIndex: number,
  totalSteps: number
): {
  consumed: string[];
  produced: string[];
  feedback: CoreStep["feedback_type"];
} {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  switch (type) {
    case "engine":
      if (isFirst) return { consumed: [], produced: ["momentum"], feedback: "neutral" };
      if (isLast) return { consumed: ["energy"], produced: ["score"], feedback: "positive" };
      return { consumed: ["energy", "momentum"], produced: ["combo"], feedback: "positive" };
    case "economy":
      if (isFirst) return { consumed: [], produced: ["raw_resource"], feedback: "neutral" };
      if (isLast) return { consumed: ["gold"], produced: ["upgrade"], feedback: "positive" };
      return { consumed: ["raw_resource"], produced: ["gold"], feedback: "neutral" };
    case "ecology":
      if (isFirst) return { consumed: [], produced: [], feedback: "neutral" };
      if (isLast) return { consumed: [], produced: ["stability"], feedback: "positive" };
      return { consumed: ["resource_a"], produced: ["resource_b"], feedback: "neutral" };
    case "tower_defense":
      if (isFirst) return { consumed: [], produced: ["gold"], feedback: "neutral" };
      if (isLast) return { consumed: [], produced: ["survival"], feedback: "positive" };
      return { consumed: ["gold"], produced: ["defense"], feedback: "negative" };
    case "rhythm":
      if (isFirst) return { consumed: [], produced: [], feedback: "neutral" };
      if (isLast) return { consumed: [], produced: ["score", "combo"], feedback: "positive" };
      return { consumed: [], produced: ["combo"], feedback: "positive" };
    case "puzzle":
      if (isFirst) return { consumed: [], produced: [], feedback: "neutral" };
      if (isLast) return { consumed: [], produced: ["clear_bonus"], feedback: "positive" };
      return { consumed: [], produced: [], feedback: "neutral" };
    default:
      if (isFirst) return { consumed: [], produced: ["resource"], feedback: "neutral" };
      if (isLast) return { consumed: ["resource"], produced: ["reward"], feedback: "positive" };
      return { consumed: ["resource"], produced: ["progress"], feedback: "neutral" };
  }
}

type StepBuilder = (mechanics: string[], scale: { short: number; medium: number; long: number }) => CoreStep[];

const STEP_BUILDERS: Record<LoopType, StepBuilder> = {
  engine: (mechanics, scale) => {
    const m0 = mechanics[0] || "Исследование";
    const m1 = mechanics[1] || "Сражение";
    const m2 = mechanics[2] || "Награда";
    const m3 = mechanics[3] || "Прокачка";
    return [
      { action: `Найти цель (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: ["momentum"], feedback_type: "neutral", duration_estimate: scale.short },
      { action: `Атаковать (${m1})`, mechanics: [m1], resources_consumed: ["momentum"], resources_produced: ["combo"], feedback_type: "positive", duration_estimate: scale.medium },
      { action: `Собрать награду (${m2})`, mechanics: [m2], resources_consumed: ["combo"], resources_produced: ["xp"], feedback_type: "positive", duration_estimate: scale.short },
      { action: `Улучшить (${m3})`, mechanics: [m3], resources_consumed: ["xp"], resources_produced: ["power"], feedback_type: "positive", duration_estimate: scale.medium },
      { action: "Повторить с большей силой", mechanics: [m0], resources_consumed: ["power"], resources_produced: ["momentum"], feedback_type: "positive", duration_estimate: scale.long },
    ];
  },
  economy: (mechanics, scale) => {
    const m0 = mechanics[0] || "Сбор ресурсов";
    const m1 = mechanics[1] || "Крафт";
    const m2 = mechanics[2] || "Торговля";
    const m3 = mechanics[3] || "Прокачка";
    return [
      { action: `Собрать ресурсы (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: ["raw_resource"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Конвертировать (${m1})`, mechanics: [m1], resources_consumed: ["raw_resource"], resources_produced: ["gold"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Торговать (${m2})`, mechanics: [m2], resources_consumed: ["gold"], resources_produced: ["equipment"], feedback_type: "positive", duration_estimate: scale.short },
      { action: `Использовать (${m3})`, mechanics: [m3], resources_consumed: ["equipment"], resources_produced: ["progress"], feedback_type: "positive", duration_estimate: scale.long },
      { action: "Реинвестировать", mechanics: [m0], resources_consumed: ["progress"], resources_produced: ["raw_resource"], feedback_type: "neutral", duration_estimate: scale.medium },
    ];
  },
  ecology: (mechanics, scale) => {
    const m0 = mechanics[0] || "Наблюдение";
    const m1 = mechanics[1] || "Действие";
    const m2 = mechanics[2] || "Балансировка";
    const m3 = mechanics[3] || "Восстановление";
    return [
      { action: `Оценить ситуацию (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: ["information"], feedback_type: "neutral", duration_estimate: scale.short },
      { action: `Действовать (${m1})`, mechanics: [m1], resources_consumed: ["information"], resources_produced: ["state_change"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Сбалансировать (${m2})`, mechanics: [m2], resources_consumed: ["state_change"], resources_produced: ["stability"], feedback_type: "positive", duration_estimate: scale.medium },
      { action: `Восстановиться (${m3})`, mechanics: [m3], resources_consumed: ["stability"], resources_produced: ["resources"], feedback_type: "positive", duration_estimate: scale.long },
      { action: "Адаптироваться", mechanics: [m0], resources_consumed: ["resources"], resources_produced: ["information"], feedback_type: "neutral", duration_estimate: scale.short },
    ];
  },
  hybrid: (mechanics, scale) => {
    const m0 = mechanics[0] || "Исследование";
    const m1 = mechanics[1] || "Сражение";
    const m2 = mechanics[2] || "Награда";
    const m3 = mechanics[3] || "Крафт";
    return [
      { action: `Исследовать (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: ["resource"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Сражаться (${m1})`, mechanics: [m1], resources_consumed: ["resource"], resources_produced: ["loot"], feedback_type: "positive", duration_estimate: scale.short },
      { action: `Собрать (${m2})`, mechanics: [m2], resources_consumed: [], resources_produced: ["gold"], feedback_type: "positive", duration_estimate: scale.short },
      { action: `Скрафтить (${m3})`, mechanics: [m3], resources_consumed: ["gold", "loot"], resources_produced: ["upgrade"], feedback_type: "positive", duration_estimate: scale.medium },
      { action: "Продолжить с улучшениями", mechanics: [m0], resources_consumed: ["upgrade"], resources_produced: ["resource"], feedback_type: "neutral", duration_estimate: scale.long },
    ];
  },
  tower_defense: (mechanics, scale) => {
    const m0 = mechanics[0] || "Строительство";
    const m1 = mechanics[1] || "Защита";
    const m2 = mechanics[2] || "Улучшение";
    const m3 = mechanics[3] || "Волна";
    return [
      { action: `Построить башни (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: ["gold"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Защитить базу (${m1})`, mechanics: [m1], resources_consumed: ["gold"], resources_produced: ["defense"], feedback_type: "negative", duration_estimate: scale.long },
      { action: `Улучшить башни (${m2})`, mechanics: [m2], resources_consumed: ["defense"], resources_produced: ["upgraded_tower"], feedback_type: "positive", duration_estimate: scale.medium },
      { action: `Отразить волну (${m3})`, mechanics: [m3], resources_consumed: ["upgraded_tower"], resources_produced: ["wave_clear"], feedback_type: "positive", duration_estimate: scale.long },
      { action: "Восстановиться", mechanics: [m0], resources_consumed: ["wave_clear"], resources_produced: ["gold"], feedback_type: "neutral", duration_estimate: scale.short },
    ];
  },
  rhythm: (mechanics, scale) => {
    const m0 = mechanics[0] || "Слушать";
    const m1 = mechanics[1] || "Ввод";
    const m2 = mechanics[2] || "Оценка";
    const m3 = mechanics[3] || "Комбо";
    return [
      { action: `Слушать ритм (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: [], feedback_type: "neutral", duration_estimate: scale.short },
      { action: `Ввести ноту (${m1})`, mechanics: [m1], resources_consumed: [], resources_produced: ["combo"], feedback_type: "positive", duration_estimate: scale.short },
      { action: `Оценить (${m2})`, mechanics: [m2], resources_consumed: ["combo"], resources_produced: ["score"], feedback_type: "positive", duration_estimate: scale.short },
      { action: `Продлить комбо (${m3})`, mechanics: [m3], resources_consumed: ["score"], resources_produced: ["multiplier"], feedback_type: "positive", duration_estimate: scale.short },
      { action: "Следующий такт", mechanics: [m0], resources_consumed: ["multiplier"], resources_produced: [], feedback_type: "neutral", duration_estimate: scale.short },
    ];
  },
  puzzle: (mechanics, scale) => {
    const m0 = mechanics[0] || "Сканирование";
    const m1 = mechanics[1] || "Анализ";
    const m2 = mechanics[2] || "Размещение";
    const m3 = mechanics[3] || "Проверка";
    return [
      { action: `Сканировать доску (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: [], feedback_type: "neutral", duration_estimate: scale.short },
      { action: `Анализировать (${m1})`, mechanics: [m1], resources_consumed: [], resources_produced: ["pattern"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Разместить элемент (${m2})`, mechanics: [m2], resources_consumed: ["pattern"], resources_produced: ["placement"], feedback_type: "neutral", duration_estimate: scale.medium },
      { action: `Проверить (${m3})`, mechanics: [m3], resources_consumed: ["placement"], resources_produced: ["match"], feedback_type: "positive", duration_estimate: scale.short },
      { action: "Очистить линию", mechanics: [m0], resources_consumed: ["match"], resources_produced: ["clear_bonus"], feedback_type: "positive", duration_estimate: scale.short },
    ];
  },
};
