/**
 * Gidede — Core Loop hierarchy + recommendations (Block 2, TASK-2.19).
 *
 * TASK-2.19: multi-entry loops array (Bible 4.3 — шесть временных масштабов).
 */

import type { CoreStep } from "./steps";
import type { PathologyReport } from "./pathologies";

export interface HierarchyLevel {
  actions: string[];
  parent_step: string;
  duration_estimate: number;
}

export type LoopHierarchy = Record<
  "micro" | "small" | "medium" | "large" | "macro" | "meta",
  HierarchyLevel[]
>;

export function buildLoopHierarchy(steps: CoreStep[], type: string): LoopHierarchy {
  const hierarchy: LoopHierarchy = {
    micro: [{ actions: steps.slice(0, 2).map((s) => s.action), parent_step: steps[0]?.action || "start", duration_estimate: steps.slice(0, 2).reduce((s, st) => s + st.duration_estimate, 0) }],
    small: [{ actions: steps.map((s) => s.action), parent_step: "core_loop", duration_estimate: steps.reduce((s, st) => s + st.duration_estimate, 0) }],
    medium: [{ actions: ["Завершить 3 core loops", "Триггерить side activity", "Bank progress"], parent_step: "small_loop", duration_estimate: 300 }],
    large: [{ actions: ["Завершить quest arc", "Открыть новую область", "Получить key item"], parent_step: "medium_loop", duration_estimate: 1800 }],
    macro: [{ actions: ["Достичь level cap", "Победить final boss", "Завершить campaign"], parent_step: "large_loop", duration_estimate: 36000 }],
    meta: [{ actions: ["New Game+", "Daily challenges", "Seasonal events", "Leaderboard"], parent_step: "macro_loop", duration_estimate: 604800 }],
  };

  if (type === "ecology" || type === "hybrid") {
    hierarchy.micro.push({ actions: ["Наблюдать состояние", "Скорректировать стратегию"], parent_step: steps[2]?.action || "mid_step", duration_estimate: 10 });
  }
  if (type === "tower_defense") {
    hierarchy.medium = [{ actions: ["Завершить волну", "Получить награду", "Подготовиться к следующей"], parent_step: "wave_loop", duration_estimate: 60 }];
  }
  if (type === "rhythm") {
    hierarchy.small = [{ actions: steps.map((s) => s.action), parent_step: "measure", duration_estimate: steps.reduce((s, st) => s + st.duration_estimate, 0) }];
  }
  if (type === "puzzle") {
    hierarchy.medium = [{ actions: ["Очистить линию", "Заработать bonus", "Увеличить сложность"], parent_step: "clear_loop", duration_estimate: 60 }];
  }

  return hierarchy;
}

export interface Recommendation {
  target: string;
  recommendation: string;
  priority: "high" | "medium" | "low";
  category: string;
  source: "formal" | "ai";
}

export function buildRecommendations(
  pathologies: PathologyReport,
  structuralType: { type: string; has_braking: boolean }
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  for (const p of pathologies.pathologies) {
    recommendations.push({
      target: `Исправить: ${p.name}`,
      recommendation: p.correction,
      priority: p.severity === "critical" ? "high" : p.severity === "warning" ? "medium" : "low",
      category: p.type, source: "formal",
    });
  }

  if (!structuralType.has_braking) {
    recommendations.push({
      target: "Добавить тормозящий механизм",
      recommendation: "Вставить sink step для слива ресурсов",
      priority: "medium", category: "balancing", source: "formal",
    });
  }

  recommendations.push(...getTypeRecommendations(structuralType.type));
  recommendations.push({
    target: "Провести 30-second fun test",
    recommendation: "Запустить бумажный прототип, засечь 30 секунд — улыбается ли игрок?",
    priority: "low", category: "validation", source: "ai",
  });

  return recommendations;
}

function getTypeRecommendations(type: string): Recommendation[] {
  switch (type) {
    case "tower_defense":
      return [
        { target: "Кривая pacing волн", recommendation: "Интервалы: 15с → 12с → 10с для нарастающего tension", priority: "high", category: "pacing", source: "formal" },
        { target: "Economy vs defense tension", recommendation: "Build-vs-defend решение каждую волну", priority: "medium", category: "decision_design", source: "formal" },
        { target: "Tower upgrade path", recommendation: "Минимум 2 уровня апгрейда (damage + range)", priority: "medium", category: "progression", source: "formal" },
      ];
    case "rhythm":
      return [
        { target: "Кривая сложности", recommendation: "60 BPM старт, +10-15 BPM каждые 30с", priority: "high", category: "pacing", source: "formal" },
        { target: "Visual feedback sync", recommendation: "Визуальный пульс точно на бит, даже 50ms задержки ломает feel", priority: "high", category: "feedback", source: "formal" },
        { target: "Miss recovery window", recommendation: "200ms grace window после miss без сброса combo", priority: "medium", category: "forgiveness", source: "formal" },
      ];
    case "puzzle":
      return [
        { target: "Piece preview queue", recommendation: "Показывать следующие 3 pieces для планирования", priority: "high", category: "strategic_depth", source: "formal" },
        { target: "Hold/swap механика", recommendation: "Держать одну piece и swap позже", priority: "medium", category: "mechanic_depth", source: "formal" },
        { target: "Сложность через speed", recommendation: "Увеличивать speed, не variety — когнитивная перегрузка убивает fun", priority: "medium", category: "difficulty_curve", source: "formal" },
      ];
    case "ecology":
      return [
        { target: "Balance feedback loops", recommendation: "Каждая усиливающая петля должна иметь балансирующую", priority: "high", category: "balancing", source: "formal" },
        { target: "Player agency в балансе", recommendation: "Дать игроку явные рычаги влияния", priority: "medium", category: "agency", source: "formal" },
      ];
    case "economy":
      return [
        { target: "Currency sink balancing", recommendation: "Faucet ≈ drain для каждой валюты", priority: "high", category: "balancing", source: "formal" },
        { target: "Conversion chain clarity", recommendation: "Игрок должен понимать: raw → refined → finished → reward", priority: "medium", category: "clarity", source: "formal" },
      ];
    default:
      return [
        { target: "30-second fun test", recommendation: "Первые 30 секунд дают positive feedback", priority: "high", category: "validation", source: "formal" },
      ];
  }
}
