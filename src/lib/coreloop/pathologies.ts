/**
 * Gidede — Core Loop pathologies detection (Block 2, TASK-2.3/2.10).
 *
 * TASK-2.3: 7 Bible патологий (Bible 4.10) + 6 type-specific.
 * TASK-2.10: || → && в conditions (патологии только если likely AND condition).
 */

import type { CoreStep } from "./steps";

export interface Pathology {
  name: string;
  type: string;
  severity: "critical" | "warning" | "info";
  description: string;
  correction: string;
  affected_resources: string[];
  bible_ref?: string;
}

export interface PathologyReport {
  pathologies: Pathology[];
  total_count: number;
  critical_count: number;
}

export function detectPathologies(
  steps: CoreStep[],
  structuralType: {
    type: string;
    has_braking: boolean;
    risk_assessment: { likely_pathologies: string[] };
  }
): PathologyReport {
  const pathologies: Pathology[] = [];
  const likely = structuralType.risk_assessment.likely_pathologies;

  const positiveCount = steps.filter((s) => s.feedback_type === "positive").length;
  const negativeCount = steps.filter((s) => s.feedback_type === "negative").length;
  const neutralCount = steps.filter((s) => s.feedback_type === "neutral").length;

  // 4.10.1: Runaway
  if (likely.includes("runaway") && positiveCount > steps.length / 2 && !structuralType.has_braking) {
    pathologies.push({
      name: "Runaway", type: "runaway",
      severity: positiveCount > steps.length * 0.6 ? "critical" : "warning",
      description: `Цикл имеет ${positiveCount}/${steps.length} positive-feedback шагов и без тормоза — накопление может выйти из-под контроля`,
      correction: "Добавить balancing sink step, который сливает избыточные ресурсы",
      affected_resources: steps.flatMap((s) => s.resources_produced).slice(0, 3),
      bible_ref: "Bible 4.10.1",
    });
  }

  // 4.10.2: Deadlock
  const allProduceNothing = steps.every((s) => s.resources_produced.length === 0);
  if (likely.includes("deadlock") && (steps.length < 3 || allProduceNothing)) {
    pathologies.push({
      name: "Deadlock", type: "deadlock", severity: "critical",
      description: steps.length < 3 ? `Только ${steps.length} шаг(а/ов) — риск кругового deadlock` : "Все шаги потребляют, но никто не производит — цикл заблокирован",
      correction: steps.length < 3 ? "Добавить минимум 3 различных шага" : "Добавить шаг, который производит ресурсы (faucet)",
      affected_resources: [], bible_ref: "Bible 4.10.2",
    });
  }

  // 4.10.3: Stall
  if (likely.includes("stall") && positiveCount === 0) {
    pathologies.push({
      name: "Stall", type: "stall", severity: "warning",
      description: "Цикл не имеет positive-feedback шагов — игрок может застрять",
      correction: "Добавить шаг с positive feedback (награда, прогресс)",
      affected_resources: [], bible_ref: "Bible 4.10.3",
    });
  }

  // 4.10.4: Grind (universal)
  const allSameMechanic = steps.length > 0 && steps.every((s) => s.mechanics.length === 1 && s.mechanics[0] === steps[0].mechanics[0]);
  const allNeutral = neutralCount === steps.length && steps.length > 0;
  if (allSameMechanic || allNeutral) {
    pathologies.push({
      name: "Grind", type: "grind", severity: "warning",
      description: allSameMechanic ? "Все шаги используют одну механику — повторение без вариативности" : "Все шаги neutral — рутинный grind",
      correction: "Добавить вариативность: random events, branching paths",
      affected_resources: [], bible_ref: "Bible 4.10.4",
    });
  }

  // 4.10.5: Frustration Plateau (universal)
  if (negativeCount > steps.length / 2 && positiveCount === 0) {
    pathologies.push({
      name: "Frustration Plateau", type: "frustration_plateau", severity: "critical",
      description: `${negativeCount}/${steps.length} negative-feedback и 0 positive — игрок застревает на плато`,
      correction: "Ввести checkpoint или difficulty drop; добавить positive feedback",
      affected_resources: [], bible_ref: "Bible 4.10.5",
    });
  }

  // 4.10.6: Disconnected Loops
  if (likely.includes("disconnected_loops")) {
    const producedResources = new Set(steps.flatMap((s) => s.resources_produced));
    const consumedResources = new Set(steps.flatMap((s) => s.resources_consumed));
    const sharedResources = Array.from(producedResources).filter((r) => consumedResources.has(r));
    if (sharedResources.length === 0) {
      pathologies.push({
        name: "Disconnected Loops", type: "disconnected_loops", severity: "warning",
        description: "Нет общих ресурсов между шагами — петли не связаны",
        correction: "Добавить общий ресурс, связывающий разные петли",
        affected_resources: [], bible_ref: "Bible 4.10.6",
      });
    }
  }

  // 4.10.7: Loop Overload
  if (likely.includes("loop_overload") && steps.length > 7) {
    pathologies.push({
      name: "Loop Overload", type: "loop_overload", severity: "info",
      description: `${steps.length} шагов — выше идеала 3-7. Риск размытия core verb`,
      correction: "Консолидировать похожие шаги; стремиться к 3-7 ключевым",
      affected_resources: [], bible_ref: "Bible 4.10.7",
    });
  }

  // Type-specific: Tower Defense
  if (structuralType.type === "tower_defense") {
    const buildSteps = steps.filter((s) => s.mechanics.some((m) => /build|place|construct|строить|построить/i.test(m))).length;
    const defendSteps = steps.filter((s) => s.mechanics.some((m) => /defend|shoot|attack|protect|защит/i.test(m))).length;
    if (defendSteps < buildSteps) {
      pathologies.push({
        name: "Wave Imbalance", type: "wave_imbalance", severity: "warning",
        description: `Defense: ${defendSteps} defend vs ${buildSteps} build — игрок может игнорировать защиту`,
        correction: "Балансировать ratio build:defend ближе к 1:1",
        affected_resources: [],
      });
    }
    const hasRecovery = steps.some((s) => s.mechanics.some((m) => /repair|heal|recover|restore|ремонт|восстан/i.test(m)));
    if (!hasRecovery) {
      pathologies.push({
        name: "No Recovery", type: "no_recovery", severity: "info",
        description: "Нет механики ремонта/восстановления",
        correction: "Добавить шаг ремонта между волнами",
        affected_resources: [],
      });
    }
  }

  // Type-specific: Rhythm
  if (structuralType.type === "rhythm") {
    if (negativeCount > steps.length / 2) {
      pathologies.push({
        name: "Off-Beat Penalty", type: "off_beat_penalty", severity: "warning",
        description: `${negativeCount}/${steps.length} negative — ритм ощущается наказывающим`,
        correction: "Увеличить positive feedback за успешные попадания",
        affected_resources: [],
      });
    }
    const hasCalibration = steps.some((s) => s.mechanics.some((m) => /calibrate|sync|tempo|bpm|калибр|синхр/i.test(m)));
    if (!hasCalibration && steps.length > 4) {
      pathologies.push({
        name: "Tempo Drift", type: "tempo_drift", severity: "info",
        description: "Нет шага tempo calibration",
        correction: "Добавить шаг tempo-sync или BPM-shift",
        affected_resources: [],
      });
    }
  }

  // Type-specific: Puzzle
  if (structuralType.type === "puzzle") {
    const hasHint = steps.some((s) => s.mechanics.some((m) => /hint|reset|undo|clear|restart|подсказ|сброс|отмен/i.test(m)));
    if (!hasHint) {
      pathologies.push({
        name: "Stuck State", type: "stuck_state", severity: "critical",
        description: "Нет механики hint/undo/reset — игрок не может восстановиться после ошибки",
        correction: "Добавить undo, hint или board-reset механику",
        affected_resources: [],
      });
    }
    const pieceTypes = steps.filter((s) => s.mechanics.some((m) => /piece|shape|block|tile|фигур|блок|плит/i.test(m))).length;
    if (pieceTypes > 4) {
      pathologies.push({
        name: "Pattern Blindness", type: "pattern_blindness", severity: "warning",
        description: `${pieceTypes} piece-related шагов — когнитивная перегрузка`,
        correction: "Ограничить variety до 3-4 типов",
        affected_resources: [],
      });
    }
  }

  return {
    pathologies,
    total_count: pathologies.length,
    critical_count: pathologies.filter((p) => p.severity === "critical").length,
  };
}
