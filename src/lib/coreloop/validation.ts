/**
 * Gidede — Core Loop validation (Block 2, TASK-2.4/2.6/2.16).
 *
 * TASK-2.4: реальная проверка замкнутости через resource flow.
 * TASK-2.6: 5 вопросов Гэри (Bible 4.11.2).
 * TASK-2.16: Bible-justified threshold — все 5 критериев обязательны.
 */

import type { CoreStep } from "./steps";
import type { PathologyReport } from "./pathologies";
import { buildResourceFlowGraph, findResourceFlowPath } from "./resource-graph";
import type { FunHypothesis } from "../../../shared/types/typescript/interfaces";

export interface GaryFiveQuestions {
  is_loop: boolean;
  has_conflict: boolean;
  has_resources: boolean;
  has_interaction: boolean;
  has_goal: boolean;
  answers: Record<string, string>;
}

export interface LoopClosedness {
  is_closed: boolean;
  connection_description: string;
  closing_resources: string[];
  step_path: number[];
}

export interface ResourceSufficiency {
  has_dead_resources: boolean;
  has_unsourced_consumables: boolean;
  dead_resources: string[];
  unsourced_consumables: string[];
}

export interface ValidationResult {
  fun_hypothesis: FunHypothesis;
  loop_closedness: LoopClosedness;
  resource_sufficiency: ResourceSufficiency;
  gary_five_questions: GaryFiveQuestions;
  structural_checks: {
    loop_closed: boolean;
    resources_balanced: boolean;
    no_critical_pathologies: boolean;
    step_count_in_range: boolean;
  };
  checklist_passed: number;
  checklist_total: number;
  overall_passed: boolean;
  score: number;
  warnings: string[];
}

export function buildFunHypothesis(steps: CoreStep[]): FunHypothesis {
  const firstAction = steps[0]?.action || "первый шаг цикла";
  const payoffAction = steps.find((step) => step.feedback_type === "positive")?.action
    || steps.at(-1)?.action
    || "завершение цикла";

  return {
    status: "unverified",
    statement: `Игрок понимает связь «${firstAction} → ${payoffAction}» за 30 секунд и хочет добровольно повторить цикл.`,
    test_protocol: {
      duration_seconds: 30,
      minimum_participants: 5,
      task: "Без подсказок фасилитатора выполнить один полный цикл, затем выбрать — повторить его или остановиться.",
      metrics: [
        {
          id: "loop_completion_rate",
          description: "Доля участников, завершивших цикл без подсказки.",
          comparator: ">=",
          target: 0.8,
        },
        {
          id: "voluntary_replay_rate",
          description: "Доля участников, добровольно начавших второй цикл.",
          comparator: ">=",
          target: 0.6,
        },
        {
          id: "critical_confusion_rate",
          description: "Доля участников, не понявших следующее действие более 5 секунд.",
          comparator: "<=",
          target: 0.2,
        },
      ],
      decision_rule: "Гипотеза поддержана только если достигнуты пороги всех метрик; иначе она отклонена.",
    },
    evidence: [],
  };
}

export function checkLoopClosedness(steps: CoreStep[]): LoopClosedness {
  if (steps.length < 2) {
    return { is_closed: false, connection_description: "Недостаточно шагов (минимум 2)", closing_resources: [], step_path: [] };
  }

  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const graph = buildResourceFlowGraph(steps);
  const path = findResourceFlowPath(graph, steps.length - 1, 0);
  if (path) {
    return {
      is_closed: true,
      connection_description: `Directed resource path ${path.steps.join(" → ")} возвращает "${lastStep.action}" к "${firstStep.action}" через [${path.resources.join(", ")}]`,
      closing_resources: [...new Set(path.resources)],
      step_path: path.steps,
    };
  }
  return {
    is_closed: false,
    connection_description: `Нет directed resource path от последнего шага "${lastStep.action}" к первому "${firstStep.action}"`,
    closing_resources: [],
    step_path: [],
  };
}

export function checkGaryFiveQuestions(steps: CoreStep[]): GaryFiveQuestions {
  const hasLoop = steps.length >= 2;
  const hasConflict = steps.some((s) => s.feedback_type === "negative" || s.resources_consumed.length > 0);
  const allResources = new Set<string>();
  for (const s of steps) {
    s.resources_consumed.forEach((r) => allResources.add(r));
    s.resources_produced.forEach((r) => allResources.add(r));
  }
  const hasResources = allResources.size >= 2;
  const hasInteraction = steps.every((s) => s.mechanics.length > 0);
  const hasGoal = steps.some((s) => s.feedback_type === "positive");

  const answers: Record<string, string> = {
    "Является ли это циклом?": hasLoop ? `Да, ${steps.length} шагов` : "Нет, недостаточно шагов",
    "Есть ли конфликт?": hasConflict ? "Да, есть opposing force" : "Нет явного конфликта",
    "Какие ресурсы?": hasResources ? `${allResources.size} ресурсов: ${Array.from(allResources).slice(0, 5).join(", ")}` : "Недостаточно ресурсов",
    "Какое взаимодействие?": hasInteraction ? "Каждый шаг имеет player action" : "Некоторые шаги без action",
    "Какова цель?": hasGoal ? "Да, есть positive feedback" : "Нет явной цели",
  };

  return { is_loop: hasLoop, has_conflict: hasConflict, has_resources: hasResources, has_interaction: hasInteraction, has_goal: hasGoal, answers };
}

export function checkResourceSufficiency(steps: CoreStep[]): ResourceSufficiency {
  const allConsumed = new Set(steps.flatMap((s) => s.resources_consumed));
  const allProduced = new Set(steps.flatMap((s) => s.resources_produced));
  const deadResources = Array.from(allProduced).filter((r) => !allConsumed.has(r));
  const unsourcedConsumables = Array.from(allConsumed).filter((r) => !allProduced.has(r));
  return {
    has_dead_resources: deadResources.length > 0,
    has_unsourced_consumables: unsourcedConsumables.length > 0,
    dead_resources: deadResources,
    unsourced_consumables: unsourcedConsumables,
  };
}

export function buildValidation(
  steps: CoreStep[],
  pathologies: PathologyReport,
  structuralType: { type: string; has_braking: boolean }
): ValidationResult {
  const loopClosedness = checkLoopClosedness(steps);
  const resourceSufficiency = checkResourceSufficiency(steps);
  const garyFiveQuestions = checkGaryFiveQuestions(steps);

  const structuralChecks = {
    loop_closed: loopClosedness.is_closed,
    resources_balanced: !resourceSufficiency.has_dead_resources && !resourceSufficiency.has_unsourced_consumables,
    no_critical_pathologies: pathologies.critical_count === 0,
    step_count_in_range: steps.length >= 3 && steps.length <= 7,
  };
  const checklistItems = Object.values(structuralChecks);
  const checklistPassed = checklistItems.filter(Boolean).length;
  const checklistTotal = checklistItems.length;
  // Structural acceptance is separate from player-evidence validation.
  const overallPassed = checklistPassed === checklistTotal;
  const score = Number((checklistPassed / checklistTotal).toFixed(3));

  const warnings: string[] = [];
  if (resourceSufficiency.has_dead_resources) warnings.push(`Dead resources: ${resourceSufficiency.dead_resources.join(", ")}`);
  if (resourceSufficiency.has_unsourced_consumables) warnings.push(`Unsourced consumables: ${resourceSufficiency.unsourced_consumables.join(", ")}`);
  if (pathologies.critical_count > 0) warnings.push(`${pathologies.critical_count} critical патологий`);
  if (!structuralType.has_braking) warnings.push("Цикл без торможения");
  if (!loopClosedness.is_closed) warnings.push("Цикл не замкнут");
  if (!garyFiveQuestions.has_conflict) warnings.push("Gary Q2: нет конфликта");
  if (!garyFiveQuestions.has_goal) warnings.push("Gary Q5: нет цели");

  return {
    fun_hypothesis: buildFunHypothesis(steps),
    loop_closedness: loopClosedness,
    resource_sufficiency: resourceSufficiency,
    gary_five_questions: garyFiveQuestions,
    structural_checks: structuralChecks,
    checklist_passed: checklistPassed,
    checklist_total: checklistTotal,
    overall_passed: overallPassed,
    score,
    warnings,
  };
}
