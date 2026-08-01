/**
 * Gidede — Core Loop structural type classification (Block 2, TASK-2.2/2.5/2.11).
 *
 * TASK-2.2: классификация типа по эстетике (Bible 4.11.1).
 * TASK-2.5: sub_types для tower_defense/rhythm/puzzle.
 * TASK-2.11: hasBraking — реальная проверка наличия тормозящего шага.
 */

import type { CoreStep, LoopType } from "./steps";

const AESTHETIC_TO_LOOP_TYPE: Record<string, LoopType> = {
  challenge: "engine",
  discovery: "economy",
  fellowship: "ecology",
  submission: "engine",
  sensation: "engine",
  fantasy: "economy",
  narrative: "hybrid",
  expression: "ecology",
};

const GENRE_DEFAULT_LOOP_TYPE: Record<string, LoopType> = {
  action: "engine", shooter: "engine", platformer: "engine", fighting: "engine",
  rhythm: "rhythm", racing: "engine", rpg: "economy", action_rpg: "hybrid",
  jrpg: "economy", tactical_rpg: "economy", mmorpg: "economy", strategy: "economy",
  rts: "economy", tbs: "economy", tower_defense: "tower_defense",
  simulation: "ecology", sandbox: "ecology", horror: "ecology",
  survival_horror: "ecology", roguelike: "hybrid", adventure: "hybrid",
  puzzle: "puzzle", metroidvania: "hybrid", idle: "engine",
  visual_novel: "hybrid", stealth: "hybrid",
};

export const VALID_LOOP_TYPES: LoopType[] = [
  "engine", "economy", "ecology", "hybrid",
  "tower_defense", "rhythm", "puzzle",
];

export interface StructuralType {
  type: string;
  sub_type: string;
  has_braking: boolean;
  currencies: string[];
  resources: Array<{ name: string; class_: string }>;
  loops: Array<{ type: string; description: string }>;
  risk_assessment: {
    risk_level: string;
    likely_pathologies: string[];
    mitigation_suggestions: string[];
  };
}

export function classifyStructuralType(
  mechanics: string[],
  genre: string,
  primaryAesthetic: string | undefined,
  desiredLoopType: string | undefined,
  steps: CoreStep[]
): StructuralType {
  let type: string;
  if (desiredLoopType && VALID_LOOP_TYPES.includes(desiredLoopType as LoopType)) {
    type = desiredLoopType;
  } else if (primaryAesthetic && AESTHETIC_TO_LOOP_TYPE[primaryAesthetic]) {
    type = AESTHETIC_TO_LOOP_TYPE[primaryAesthetic];
  } else {
    type = GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid";
  }

  const subType = getSubType(type, steps, mechanics);
  const hasBraking = detectBraking(steps);

  const currenciesSet = new Set<string>();
  for (const s of steps) {
    s.resources_consumed.forEach((r) => currenciesSet.add(r));
    s.resources_produced.forEach((r) => currenciesSet.add(r));
  }
  const currencies = Array.from(currenciesSet);

  const resources = currencies.map((name) => ({
    name,
    class_: type === "engine" ? "core" : type === "economy" ? "currency" : "balance_state",
  }));

  const loops = [
    {
      type: "inner",
      description: `Микро-цикл: ${steps[0]?.action || "действие"} → ${steps[1]?.action || "реакция"} (${Math.round((steps[0]?.duration_estimate || 5) + (steps[1]?.duration_estimate || 5))}с)`,
    },
    { type: "outer", description: `Внешний цикл объединяет ${steps.length} шагов в структуру ${type}` },
  ];

  const riskLevel = getRiskLevel(type);
  const likelyPathologies = getLikelyPathologies(type, steps.length);
  const mitigationSuggestions = getMitigationSuggestions(likelyPathologies);

  return {
    type, sub_type: subType, has_braking: hasBraking, currencies, resources, loops,
    risk_assessment: {
      risk_level: riskLevel,
      likely_pathologies: likelyPathologies,
      mitigation_suggestions: mitigationSuggestions,
    },
  };
}

function getSubType(type: string, steps: CoreStep[], mechanics: string[]): string {
  switch (type) {
    case "engine": {
      const hasConsumed = steps.some((s) => s.resources_consumed.length > 0);
      return hasConsumed ? "braked_engine" : "pure_engine";
    }
    case "economy": {
      const currencies = new Set<string>();
      for (const s of steps) {
        s.resources_consumed.forEach((r) => currencies.add(r));
        s.resources_produced.forEach((r) => currencies.add(r));
      }
      return currencies.size >= 3 ? "multi_currency_economy" : "single_currency_economy";
    }
    case "ecology": return "balanced_ecology";
    case "hybrid": return mechanics.length % 2 === 0 ? "hybrid_engine" : "hybrid_economy";
    case "tower_defense": return "wave_based";
    case "rhythm": return "beat_synced";
    case "puzzle": return "pattern_based";
    default: return "hybrid_engine";
  }
}

function detectBraking(steps: CoreStep[]): boolean {
  const hasNegativeFeedback = steps.some((s) => s.feedback_type === "negative");
  if (hasNegativeFeedback) return true;

  const produced = new Set<string>();
  const consumed = new Set<string>();
  for (const s of steps) {
    s.resources_produced.forEach((r) => produced.add(r));
    s.resources_consumed.forEach((r) => consumed.add(r));
  }
  for (const c of consumed) {
    if (!produced.has(c)) return true;
  }
  return false;
}

function getRiskLevel(type: string): string {
  if (type === "ecology") return "high";
  if (type === "hybrid" || type === "tower_defense" || type === "rhythm" || type === "puzzle") return "medium";
  return "low";
}

function getLikelyPathologies(type: string, stepCount: number): string[] {
  const likely: string[] = [];
  switch (type) {
    case "engine": likely.push("runaway"); break;
    case "ecology": likely.push("stall", "oscillation"); break;
    case "hybrid": likely.push("disconnected_loops"); break;
    case "tower_defense": likely.push("wave_imbalance", "no_recovery"); break;
    case "rhythm": likely.push("off_beat_penalty", "tempo_drift"); break;
    case "puzzle": likely.push("stuck_state", "pattern_blindness"); break;
  }
  if (stepCount > 7) likely.push("loop_overload");
  if (stepCount < 3) likely.push("deadlock");
  if (type === "engine" || type === "economy") likely.push("grind");
  if (type === "ecology") likely.push("frustration_plateau");
  return Array.from(new Set(likely));
}

function getMitigationSuggestions(likelyPathologies: string[]): string[] {
  const suggestions: string[] = [];
  const mitigationMap: Record<string, string> = {
    runaway: "Добавить balancing sink для слива избыточных ресурсов",
    deadlock: "Добавить минимум 3 различных шага для разрыва кругового deadlock",
    stall: "Убедиться, что каждый пул ресурсов имеет и faucet, и drain",
    disconnected_loops: "Добавить общий ресурс, связывающий разные петли",
    loop_overload: "Сократить количество шагов до 3-7 ключевых",
    grind: "Добавить вариативность в повторяющиеся действия (random events, branching)",
    frustration_plateau: "Ввести checkpoint или difficulty drop после серии неудач",
    wave_imbalance: "Балансировать ratio build:defend ближе к 1:1",
    no_recovery: "Добавить механику ремонта/регенерации между волнами",
    off_beat_penalty: "Увеличить positive feedback за успешные попадания",
    tempo_drift: "Добавить шаг tempo-sync или BPM-shift",
    stuck_state: "Добавить undo, hint или board-reset механику",
    pattern_blindness: "Ограничить variety pieces до 3-4 типов",
  };
  for (const p of likelyPathologies) {
    if (mitigationMap[p]) suggestions.push(mitigationMap[p]);
  }
  return suggestions;
}
