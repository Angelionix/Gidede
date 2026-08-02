/**
 * Gidede — Checklist validation logic (Block 6, algorithm 3.8).
 *
 * Shared between the plural `/api/v1/checklists/[action]` route (per task
 * contract) and the singular `/api/v1/checklist/[action]` route (frontend
 * calls `/checklist/validate`).
 *
 * Runs validation checks (MDA, balance, narrative, economy, lens) against the
 * project's saved data, produces a readiness score, lists issues with
 * severity, and proposes remediation items. Persists to ProjectChecklist.
 */

import { db } from "@/lib/db";
import {
  safeJsonParse,
  updateProjectStage,
} from "@/lib/api-helpers";
import { getStageAlgorithmMetadata } from "@/lib/algorithm-metadata";
import { assertStageOutput, STAGE_CONTRACT_VERSION } from "@/lib/contracts/stage-contracts";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";

export interface ChecklistIssue {
  severity: string; // error | warning | info
  issue_type: string;
  description: string;
  suggestion: string;
}

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  concept?: {
    genre: string | null;
    primaryAesthetic: string | null;
    usp: string | null;
    onePagerData: string | null;
    aestheticProfile: string | null;
    dynamicsProfile: string | null;
    mechanicSet: string | null;
    validationReport: string | null;
  } | null;
  coreLoop?: {
    structuralType: string | null;
    stepCount: number | null;
    pathologyCount: number | null;
    stepsData: string | null;
    pathologies: string | null;
    validationData: string | null;
    fullProfile: string | null;
  } | null;
  mdaProfile?: {
    primaryAesthetic: string | null;
    secondaryAesthetic: string | null;
    overallMatch: number | null;
    iterationCount: number | null;
    targetDynamics: string | null;
    mechanicSet: string | null;
    lensValidation: string | null;
    bondValidation: string | null;
    ludonarrativeCheck: string | null;
    fullProfile: string | null;
  } | null;
  balanceResult?: {
    balanceType: string | null;
    overallBalanceScore: number | null;
    imbalanceCount: number | null;
    elementCount: number | null;
    pathologies: string | null;
    monteCarloResults: string | null;
    fullResult: string | null;
  } | null;
  progression?: {
    totalLevels: number | null;
    tierCount: number | null;
    curveType: string | null;
    validation: string | null;
    fullProfile: string | null;
  } | null;
  economy?: {
    systemType: string | null;
    resourceCount: number | null;
    hasPathology: boolean;
    pathologies: string | null;
    corrections: string | null;
    simulationResults: string | null;
    fullProfile: string | null;
  } | null;
  gdd?: {
    format: string | null;
    sectionCount: number | null;
    completenessPercent: number | null;
    consistencyIssues: string | null;
    sections: string | null;
    fullProfile: string | null;
  } | null;
}

export interface ChecklistResult {
  profile: {
    scope: {
      active_checklists: string[];
      depth: string;
      estimated_checks: number;
    };
    mda_check?: {
      skipped: boolean;
      issues: ChecklistIssue[];
      overall_mda_score: number;
    };
    balance_check?: {
      skipped: boolean;
      issues: ChecklistIssue[];
      overall_balance_score: number;
    };
    narrative_check?: {
      skipped: boolean;
      issues: ChecklistIssue[];
      overall_narrative_score: number;
    };
    economy_check?: {
      skipped: boolean;
      issues: ChecklistIssue[];
    };
    lens_check?: {
      skipped: boolean;
      issues: ChecklistIssue[];
    };
    summary?: {
      overall_score: number;
      readiness: string; // ready | almost | not_ready
      top_5_issues: Array<{
        severity: string;
        issue_type: string;
        description: string;
      }>;
      quick_wins: Array<{ description: string; effort: string }>;
    };
    stages_completed: number[];
    latency_ms: number;
  };
  // Persisted fields (for DB write)
  overallScore: number;
  readinessLevel: string;
  criticalIssueCount: number;
  totalIssueCount: number;
  issues: Array<{
    id: string;
    severity: "critical" | "warning" | "info";
    category: string;
    title: string;
    description: string;
    source: string;
    remediation: string;
  }>;
  remediationPlan: Array<{
    issue_id: string;
    action: string;
    effort: "easy" | "moderate" | "hard";
    impact: "high" | "medium" | "low";
  }>;
  mdaCheck: unknown;
  balanceCheck: unknown;
  narrativeCheck: unknown;
  economyCheck: unknown;
  lensCheck: unknown;
}

interface RunOptions {
  depth?: string;
  checklistTypes?: string[];
  artifactInput?: unknown;
}

// TASK-6b.3-9: Extended checklist types.
const ALL_CHECKLISTS = [
  "mda",
  "balance",
  "narrative",
  "economy",
  "lenses",
  // TASK-6b.3-9: 6 new Bible checklist types.
  "shell_filters",    // 6b.3: 8 Shell idea filters (Bible 11.5.2)
  "upton",            // 6b.4: 6 Upton heuristics (Bible 11.5.4)
  "rolling_morris",   // 6b.5: 7-point balance checklist (Bible 11.5.3)
  "bond_methods",     // 6b.6: 7 Bond indirect guidance methods (Bible 11.5.5)
  "fullerton",        // 6b.7: 5 Fullerton pleasure killers (Bible 11.5.6)
  "narrative_types",  // 6b.9: 11 narrative document types (Bible 11.4.1)
];

function clamp(n: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, n));
}

/** Run MDA check against project's MDA profile. */
function runMdaCheck(project: ProjectData): {
  skipped: boolean;
  issues: ChecklistIssue[];
  overall_mda_score: number;
} {
  const issues: ChecklistIssue[] = [];
  let score = 0.5;
  const mda = project.mdaProfile;

  if (!mda) {
    return { skipped: true, issues, overall_mda_score: 0 };
  }

  // Check aesthetic-mechanic coverage
  const mechanicSet = mda.mechanicSet
    ? safeJsonParse<Record<string, unknown>>(mda.mechanicSet, {})
    : {};
  const mechanicKeys = Object.keys(mechanicSet);
  if (mechanicKeys.length === 0) {
    issues.push({
      severity: "warning",
      issue_type: "mda_no_mechanics",
      description: "MDA профиль не содержит механик",
      suggestion: "Сгенерируйте набор механик в блоке 3",
    });
  } else {
    score += 0.2;
  }

  if (mda.overallMatch != null) {
    if (mda.overallMatch < 0.5) {
      issues.push({
        severity: "error",
        issue_type: "mda_low_match",
        description: `Низкое соответствие механик-эстетик: ${mda.overallMatch.toFixed(2)}`,
        suggestion: "Скорректируйте механики для лучшего покрытия эстетик",
      });
      score -= 0.2;
    } else {
      score += 0.15;
    }
  }

  const lensVal = mda.lensValidation
    ? safeJsonParse<{ overall_score?: number }>(mda.lensValidation, {})
    : null;
  if (lensVal?.overall_score != null) {
    if (lensVal.overall_score < 0.6) {
      issues.push({
        severity: "warning",
        issue_type: "mda_low_lens_score",
        description: `Линз-аудит ниже порога: ${lensVal.overall_score.toFixed(2)}`,
        suggestion: "Пересмотрите линзы 1, 5, 9",
      });
    } else {
      score += 0.1;
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      issue_type: "mda_ok",
      description: "MDA профиль выглядит целостным",
      suggestion: "Регулярно перепроверяйте после изменений механик",
    });
  }

  return {
    skipped: false,
    issues,
    overall_mda_score: Number(clamp(score).toFixed(3)),
  };
}

function runBalanceCheck(project: ProjectData): {
  skipped: boolean;
  issues: ChecklistIssue[];
  overall_balance_score: number;
} {
  const issues: ChecklistIssue[] = [];
  let score = 0.5;
  const balance = project.balanceResult;

  if (!balance) {
    return { skipped: true, issues, overall_balance_score: 0 };
  }

  if (balance.overallBalanceScore != null) {
    if (balance.overallBalanceScore < 0.5) {
      issues.push({
        severity: "error",
        issue_type: "balance_low_score",
        description: `Низкий общий балл баланса: ${balance.overallBalanceScore.toFixed(2)}`,
        suggestion: "Перепройдите баланс-анализ с дополнительными объектами",
      });
      score -= 0.2;
    } else if (balance.overallBalanceScore > 0.8) {
      score += 0.3;
    } else {
      score += 0.15;
    }
  }

  if ((balance.imbalanceCount ?? 0) > 3) {
    issues.push({
      severity: "warning",
      issue_type: "balance_many_imbalances",
      description: `Слишком много дисбалансов: ${balance.imbalanceCount}`,
      suggestion: "Сократите количество overpowered объектов",
    });
    score -= 0.1;
  }

  const pathologies = balance.pathologies
    ? safeJsonParse<unknown[]>(balance.pathologies, [])
    : [];
  if (Array.isArray(pathologies) && pathologies.length > 0) {
    issues.push({
      severity: "warning",
      issue_type: "balance_pathologies",
      description: `Найдено патологий баланса: ${pathologies.length}`,
      suggestion: "Примените предложенные корректировки",
    });
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      issue_type: "balance_ok",
      description: "Баланс в пределах нормы",
      suggestion: "Контролируйте при добавлении нового контента",
    });
  }

  return {
    skipped: false,
    issues,
    overall_balance_score: Number(clamp(score).toFixed(3)),
  };
}

function runNarrativeCheck(project: ProjectData): {
  skipped: boolean;
  issues: ChecklistIssue[];
  overall_narrative_score: number;
} {
  const issues: ChecklistIssue[] = [];
  let score = 0.5;
  const mda = project.mdaProfile;
  const concept = project.concept;

  if (!mda && !concept) {
    return { skipped: true, issues, overall_narrative_score: 0 };
  }

  const ludonarrative = mda?.ludonarrativeCheck
    ? safeJsonParse<{ issues?: unknown[]; agency?: number }>(mda.ludonarrativeCheck, {})
    : null;

  if (ludonarrative?.issues && Array.isArray(ludonarrative.issues) && ludonarrative.issues.length > 0) {
    issues.push({
      severity: "warning",
      issue_type: "ludonarrative_dissonance",
      description: `Лудонарративная диссонансия: ${ludonarrative.issues.length} проблем`,
      suggestion: "Выровняйте нарратив и механики",
    });
    score -= 0.2;
  } else {
    score += 0.2;
  }

  if (concept?.usp) {
    score += 0.1;
  } else {
    issues.push({
      severity: "info",
      issue_type: "narrative_no_usp",
      description: "USP не задан — нарратив может быть расплывчатым",
      suggestion: "Сформулируйте чёткое USP в блоке 1",
    });
  }

  if (project.genre === "narrative_bible" || project.genre === "visual_novel") {
    if (!project.gdd) {
      issues.push({
        severity: "warning",
        issue_type: "narrative_no_gdd",
        description: "Нарративно-ориентированной игре нужен narrative bible",
        suggestion: "Сгенерируйте GDD с форматом narrative_bible",
      });
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      issue_type: "narrative_ok",
      description: "Нарративная целостность в норме",
      suggestion: "Перепроверяйте после изменений сюжета",
    });
  }

  return {
    skipped: false,
    issues,
    overall_narrative_score: Number(clamp(score).toFixed(3)),
  };
}

function runEconomyCheck(project: ProjectData): {
  skipped: boolean;
  issues: ChecklistIssue[];
} {
  const issues: ChecklistIssue[] = [];
  const economy = project.economy;

  if (!economy) {
    return { skipped: true, issues };
  }

  if (economy.hasPathology) {
    const pathologies = economy.pathologies
      ? safeJsonParse<unknown[]>(economy.pathologies, [])
      : [];
    issues.push({
      severity: "warning",
      issue_type: "economy_pathologies",
      description: `Экономика содержит ${Array.isArray(pathologies) ? pathologies.length : "N"} патологий`,
      suggestion: "Примените корректировки из economy.corrections",
    });
  }

  const simResults = economy.simulationResults
    ? safeJsonParse<{
        quality?: { overall_pass?: boolean; critical_issues?: string[] };
        aggregated?: { stability_index?: number };
      }>(economy.simulationResults, {})
    : null;
  if (simResults?.quality?.overall_pass === false) {
    issues.push({
      severity: "error",
      issue_type: "economy_unstable",
      description: `Симуляция экономики не прошла: ${(simResults.quality.critical_issues || []).join("; ")}`,
      suggestion: "Сбалансируйте faucet/drain перед продакшеном",
    });
  }
  if (simResults?.aggregated?.stability_index != null) {
    if (simResults.aggregated.stability_index < 0.5) {
      issues.push({
        severity: "warning",
        issue_type: "economy_low_stability",
        description: `Низкий индекс стабильности: ${simResults.aggregated.stability_index.toFixed(2)}`,
        suggestion: "Усиьте balancing loops",
      });
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      issue_type: "economy_ok",
      description: "Экономика стабильна",
      suggestion: "Контролируйте при live-ops изменениях",
    });
  }

  return { skipped: false, issues };
}

function runLensCheck(project: ProjectData): {
  skipped: boolean;
  issues: ChecklistIssue[];
} {
  const issues: ChecklistIssue[] = [];
  const mda = project.mdaProfile;

  if (!mda?.lensValidation) {
    return { skipped: true, issues };
  }

  const lensVal = safeJsonParse<{
    overall_score?: number;
    results?: Array<{ lens_name?: string; score?: number; question?: string }>;
  }>(mda.lensValidation, {});

  if (Array.isArray(lensVal.results)) {
    for (const r of lensVal.results) {
      if (typeof r.score === "number" && r.score < 0.5) {
        issues.push({
          severity: r.score < 0.3 ? "error" : "warning",
          issue_type: "lens_low_score",
          description: `Линза «${r.lens_name || "—"}» набрала ${r.score.toFixed(2)}`,
          suggestion: `Пересмотрите: ${r.question || "—"}`,
        });
      }
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      issue_type: "lens_ok",
      description: "Линз-аудит пройден",
      suggestion: "Перепроверяйте при значимых изменениях дизайна",
    });
  }

  return { skipped: false, issues };
}

// ============================================================
// TASK-6b.3: 8 Shell idea filters (Bible 11.5.2)
// ============================================================
function runShellFiltersCheck(project: ProjectData): { skipped: boolean; issues: ChecklistIssue[] } {
  const issues: ChecklistIssue[] = [];
  const concept = project.concept;
  if (!concept) return { skipped: true, issues };

  const validation = concept.validationReport
    ? safeJsonParse<{ eight_filters?: Record<string, { score?: number }> }>(concept.validationReport, {})
    : {};
  const filters = validation.eight_filters || {};
  const filterNames = ["clarity", "novelty", "feasibility", "audience_fit", "market_fit", "differentiation", "emotional_impact", "sustainability"];

  for (const name of filterNames) {
    const f = filters[name];
    if (!f || typeof f.score !== "number") {
      issues.push({
        severity: "info",
        issue_type: `shell_filter_${name}_missing`,
        description: `Shell фильтр «${name}» не оценён`,
        suggestion: `Оцените фильтр «${name}» в блоке 1`,
      });
    } else if (f.score < 0.4) {
      issues.push({
        severity: "warning",
        issue_type: `shell_filter_${name}_low`,
        description: `Shell фильтр «${name}» низкий: ${f.score.toFixed(2)}`,
        suggestion: `Улучшите: ${name}`,
      });
    }
  }

  if (issues.length === 0) {
    issues.push({ severity: "info", issue_type: "shell_filters_ok", description: "Все 8 Shell фильтров прошли", suggestion: "Перепроверяйте после изменений концепции" });
  }
  return { skipped: false, issues };
}

// ============================================================
// TASK-6b.4: 6 Upton heuristics (Bible 11.5.4)
// ============================================================
function runUptonCheck(project: ProjectData): { skipped: boolean; issues: ChecklistIssue[] } {
  const issues: ChecklistIssue[] = [];
  const coreLoop = project.coreLoop;
  if (!coreLoop) return { skipped: true, issues };

  const validation = coreLoop.validationData
    ? safeJsonParse<Record<string, unknown>>(coreLoop.validationData, {})
    : {};
  const stepCount = coreLoop.stepCount || 0;
  const pathologyCount = coreLoop.pathologyCount || 0;

  // 6 Upton heuristics:
  // 1. Loop has 3-7 steps
  if (stepCount < 3) {
    issues.push({ severity: "warning", issue_type: "upton_few_steps", description: `Слишком мало шагов: ${stepCount} (нужно 3-7)`, suggestion: "Добавьте шаги в core loop" });
  } else if (stepCount > 7) {
    issues.push({ severity: "info", issue_type: "upton_many_steps", description: `Много шагов: ${stepCount} (идеал 3-7)`, suggestion: "Консолидируйте похожие шаги" });
  }
  // 2. Pathologies < 3
  if (pathologyCount > 3) {
    issues.push({ severity: "warning", issue_type: "upton_many_pathologies", description: `Много патологий: ${pathologyCount}`, suggestion: "Устраните критические патологии" });
  }
  // 3. Loop is closed
  const loopClosed = validation.loop_closedness;
  if (loopClosed && typeof loopClosed === "object" && "is_closed" in loopClosed && !(loopClosed as { is_closed: boolean }).is_closed) {
    issues.push({ severity: "warning", issue_type: "upton_loop_not_closed", description: "Core loop не замкнут", suggestion: "Свяжите последний шаг с первым" });
  }
  // 4. Fun remains a hypothesis until player evidence is recorded.
  const funHypothesis = validation.fun_hypothesis;
  const funStatus = funHypothesis && typeof funHypothesis === "object" && "status" in funHypothesis
    ? (funHypothesis as { status: unknown }).status
    : "unverified";
  if (funStatus === "rejected") {
    issues.push({ severity: "warning", issue_type: "upton_fun_hypothesis_rejected", description: "Гипотеза fun отклонена плейтестом", suggestion: "Измените core loop и повторите протокол плейтеста" });
  } else if (funStatus !== "supported") {
    issues.push({ severity: "info", issue_type: "upton_fun_unverified", description: "Гипотеза fun ещё не проверена на игроках", suggestion: "Запустите 30-секундный прототип и запишите результаты протокола" });
  }
  // 5. Has braking
  const structuralType = coreLoop.structuralType;
  if (structuralType === "engine") {
    issues.push({ severity: "info", issue_type: "upton_engine_no_brake", description: "Engine тип без тормоза — риск runaway", suggestion: "Рассмотрите braked_engine" });
  }
  // 6. Gary questions
  const gary = validation.gary_five_questions;
  if (gary && typeof gary === "object" && "has_conflict" in gary && !(gary as { has_conflict: boolean }).has_conflict) {
    issues.push({ severity: "info", issue_type: "upton_no_conflict", description: "Gary Q2: нет конфликта в цикле", suggestion: "Добавьте opposing force" });
  }

  if (issues.length === 0) {
    issues.push({ severity: "info", issue_type: "upton_ok", description: "6 эвристик Аптона пройдены", suggestion: "Перепроверяйте после изменений core loop" });
  }
  return { skipped: false, issues };
}

// ============================================================
// TASK-6b.5: 7-point Rolling/Morris balance checklist (Bible 11.5.3)
// ============================================================
function runRollingMorrisCheck(project: ProjectData): { skipped: boolean; issues: ChecklistIssue[] } {
  const issues: ChecklistIssue[] = [];
  const balance = project.balanceResult;
  if (!balance) return { skipped: true, issues };

  // 7-point Rolling/Morris checklist:
  // 1. PvP balance: win rates 45-55%
  const mcResults = balance.monteCarloResults
    ? safeJsonParse<{ win_rate_spread?: number; balance_verdict?: string }>(balance.monteCarloResults, {})
    : {};
  if (mcResults.win_rate_spread != null && mcResults.win_rate_spread > 30) {
    issues.push({ severity: "warning", issue_type: "rm_pvp_spread", description: `PvP win rate spread ${mcResults.win_rate_spread}% > 30%`, suggestion: "Сбалансируйте win rates к 45-55%" });
  }
  // 2. Player vs designer: no dominant strategy
  const pathologies = balance.pathologies
    ? safeJsonParse<unknown[]>(balance.pathologies, [])
    : [];
  if (Array.isArray(pathologies) && pathologies.length > 2) {
    issues.push({ severity: "warning", issue_type: "rm_dominant_strategy", description: `${pathologies.length} патологий баланса`, suggestion: "Устраните доминантные стратегии" });
  }
  // 3. Designer vs player: no exploit
  if (mcResults.balance_verdict === "POOR") {
    issues.push({ severity: "error", issue_type: "rm_poor_verdict", description: "Monte Carlo verdict: POOR", suggestion: "Перебалансируйте объекты" });
  }
  // 4. Q-factor: builds viable
  // 5. SPS: skill-per-second meaningful
  // 6. Golden rule: fun > balance
  if (balance.overallBalanceScore != null && balance.overallBalanceScore > 0.95) {
    issues.push({ severity: "info", issue_type: "rm_overbalanced", description: "Баланс слишком идеален — может быть скучно", suggestion: "Добавьте intentional imbalance 10-15%" });
  }
  // 7. Scalability: balance holds with more content
  if ((balance.elementCount ?? 0) < 4) {
    issues.push({ severity: "info", issue_type: "rm_few_objects", description: `Только ${balance.elementCount} объектов — баланс может не масштабироваться`, suggestion: "Протестируйте с 6-10 объектами" });
  }

  if (issues.length === 0) {
    // R6-11: honestly report the implemented point count. Points 4 (Q-factor)
    // and 5 (SPS) are not yet implemented — only 5 of 7 points are checked.
    issues.push({ severity: "info", issue_type: "rm_ok", description: "5 of 7 Rolling/Morris points passed (points 4 Q-factor и 5 SPS не реализованы)", suggestion: "Перепроверяйте при добавлении контента; Q-factor и SPS проверяются вручную" });
  }
  return { skipped: false, issues };
}

// ============================================================
// TASK-6b.6: 7 Bond indirect guidance methods (Bible 11.5.5)
// ============================================================
function runBondMethodsCheck(project: ProjectData): { skipped: boolean; issues: ChecklistIssue[] } {
  const issues: ChecklistIssue[] = [];
  const mda = project.mdaProfile;
  const coreLoop = project.coreLoop;
  if (!mda && !coreLoop) return { skipped: true, issues };

  // 7 Bond methods:
  // 1. Level Design guides player through space
  if (!project.progression) {
    issues.push({ severity: "info", issue_type: "bond_no_progression", description: "Нет прогрессии — level design не направляет игрока", suggestion: "Сгенерируйте прогрессию в блоке 5a" });
  }
  // 2. Economy guides through resource management
  if (!project.economy) {
    issues.push({ severity: "info", issue_type: "bond_no_economy", description: "Нет экономики — resource management не направляет", suggestion: "Сгенерируйте экономику в блоке 5b" });
  }
  // 3. Narrative guides through story
  const concept = project.concept;
  if (!concept?.usp) {
    issues.push({ severity: "info", issue_type: "bond_no_narrative", description: "Нет USP — нарратив не направляет", suggestion: "Сформулируйте USP в блоке 1" });
  }
  // 4. Aesthetic guides through emotional design
  if (!mda?.primaryAesthetic) {
    issues.push({ severity: "info", issue_type: "bond_no_aesthetic", description: "Нет primary aesthetic — эмоциональный дизайн не определён", suggestion: "Сгенерируйте MDA в блоке 3" });
  }
  // 5. Technology guides through constraints
  // 6. Social guides through multiplayer
  // 7. Meta guides through progression systems
  if (coreLoop?.structuralType === "ecology" || coreLoop?.structuralType === "hybrid") {
    issues.push({ severity: "info", issue_type: "bond_ecology_complex", description: "Ecology/hybrid тип — требует осторожного косвенного руководства", suggestion: "Убедитесь, что игрок понимает цели" });
  }

  if (issues.length === 0) {
    // R6-11: honestly report the implemented method count. Methods 5 (Technology)
    // and 6 (Social/multiplayer) are not yet implemented — only 5 of 7 are checked.
    issues.push({ severity: "info", issue_type: "bond_ok", description: "5 of 7 Bond methods passed (methods 5 Technology и 6 Social не реализованы)", suggestion: "Перепроверяйте при изменении дизайна; Technology и Social проверяются вручную" });
  }
  return { skipped: false, issues };
}

// ============================================================
// TASK-6b.7: 5 Fullerton pleasure killers (Bible 11.5.6)
// ============================================================
function runFullertonCheck(project: ProjectData): { skipped: boolean; issues: ChecklistIssue[] } {
  const issues: ChecklistIssue[] = [];
  const coreLoop = project.coreLoop;
  const balance = project.balanceResult;
  if (!coreLoop && !balance) return { skipped: true, issues };

  // 5 Fullerton pleasure killers:
  // 1. Ambiguity: unclear goals
  if (!project.concept?.usp) {
    issues.push({ severity: "warning", issue_type: "fullerton_ambiguity", description: "Неясная цель — игрок не понимает, что делать", suggestion: "Сформулируйте чёткое USP" });
  }
  // 2. Grinding: repetitive without reward
  const validation = coreLoop?.validationData
    ? safeJsonParse<{ checks?: Record<string, boolean> }>(coreLoop.validationData, {})
    : {};
  if (validation.checks?.no_grind === false) {
    issues.push({ severity: "warning", issue_type: "fullerton_grinding", description: "Grind обнаружен — повторение без награды", suggestion: "Добавьте вариативность в core loop" });
  }
  // 3. Stagnation: no progression
  if (!project.progression) {
    issues.push({ severity: "info", issue_type: "fullerton_stagnation", description: "Нет прогрессии — риск стагнации", suggestion: "Сгенерируйте прогрессию" });
  }
  // 4. Overcomplexity: too many systems
  const systemCount = [project.concept, project.coreLoop, project.mdaProfile, project.balanceResult, project.progression, project.economy].filter(Boolean).length;
  if (systemCount > 5) {
    issues.push({ severity: "info", issue_type: "fullerton_overcomplexity", description: `${systemCount} систем — риск перегрузки`, suggestion: "Упростите — фокус на core loop" });
  }
  // 5. Dominant strategy: one best path
  if (balance && balance.imbalanceCount != null && balance.imbalanceCount > 3) {
    issues.push({ severity: "warning", issue_type: "fullerton_dominant", description: `${balance.imbalanceCount} дисбалансов — доминантная стратегия`, suggestion: "Разнообразьте стратегии" });
  }

  if (issues.length === 0) {
    issues.push({ severity: "info", issue_type: "fullerton_ok", description: "5 убийц удовольствия не обнаружены", suggestion: "Перепроверяйте при изменении дизайна" });
  }
  return { skipped: false, issues };
}

// ============================================================
// TASK-6b.9: 11 narrative document types (Bible 11.4.1)
// ============================================================
function runNarrativeTypesCheck(project: ProjectData): { skipped: boolean; issues: ChecklistIssue[] } {
  const issues: ChecklistIssue[] = [];
  const gdd = project.gdd;
  const concept = project.concept;
  if (!gdd && !concept) return { skipped: true, issues };

  // 11 narrative document types (Bible 11.4.1):
  const requiredTypes = [
    "world_overview", "characters", "plot_arcs", "themes", "tone_voice",
    "story_mechanics", "branching_structure", "narrative", "dialogues", "quests", "lore_and_world"
  ];

  const sections = gdd?.sections
    ? safeJsonParse<Record<string, unknown>>(gdd.sections, {})
    : {};
  const sectionKeys = Object.keys(sections);

  let missingCount = 0;
  for (const type of requiredTypes) {
    if (!sectionKeys.includes(type) && !sectionKeys.includes(`narrative_${type}`)) {
      missingCount++;
    }
  }

  if (missingCount > 5) {
    issues.push({
      severity: "warning",
      issue_type: "narrative_types_missing",
      description: `${missingCount} из 11 нарративных типов отсутствуют в GDD`,
      suggestion: "Сгенерируйте GDD с форматом narrative_bible или full_gdd",
    });
  } else if (missingCount > 0) {
    issues.push({
      severity: "info",
      issue_type: "narrative_types_partial",
      description: `${missingCount} из 11 нарративных типов отсутствуют`,
      suggestion: "Дополните недостающие нарративные секции",
    });
  }

  if (!concept?.usp) {
    issues.push({
      severity: "info",
      issue_type: "narrative_no_usp",
      description: "USP не задан — нарративный фокус неясен",
      suggestion: "Сформулируйте USP в блоке 1",
    });
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      issue_type: "narrative_types_ok",
      description: "Все 11 нарративных типов присутствуют",
      suggestion: "Перепроверяйте после изменений GDD",
    });
  }
  return { skipped: false, issues };
}

function buildSummary(
  mdaScore: number,
  balanceScore: number,
  narrativeScore: number,
  allIssues: ChecklistIssue[],
  economyScore: number,
  lensScore: number,
  progressionScore: number,  // R6-07: new parameter
): {
  overall_score: number;
  readiness: string;
  top_5_issues: Array<{
    severity: string;
    issue_type: string;
    description: string;
  }>;
  quick_wins: Array<{ description: string; effort: string }>;
} {
  // R6-07: equal weights across all 6 checks (was 5 — Progression now included).
  const overall = Number(
    clamp((mdaScore + balanceScore + narrativeScore + economyScore + lensScore + progressionScore) / 6).toFixed(3)
  );

  // R6-08: hard gate — critical issues (severity "error") forbid "ready".
  const criticalIssueCount = allIssues.filter((i) => i.severity === "error").length;
  let readiness: string;
  if (criticalIssueCount > 0) {
    // R6-08: cannot be "ready" when critical issues exist, regardless of score.
    readiness = overall >= 0.5 ? "almost" : "not_ready";
  } else {
    readiness = overall >= 0.8 ? "ready" : overall >= 0.5 ? "almost" : "not_ready";
  }

  // Sort issues by severity (error > warning > info)
  const sevRank: Record<string, number> = {
    error: 0,
    warning: 1,
    info: 2,
  };
  const sortedIssues = [...allIssues].sort(
    (a, b) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3)
  );
  const top5 = sortedIssues.slice(0, 5).map((i) => ({
    severity: i.severity,
    issue_type: i.issue_type,
    description: i.description,
  }));

  // Quick wins: info issues + easy corrections
  const quickWins = sortedIssues
    .filter((i) => i.severity === "info" || i.severity === "warning")
    .slice(0, 3)
    .map((i) => ({
      description: i.suggestion,
      effort: i.severity === "info" ? "easy" : "moderate",
    }));

  return {
    overall_score: overall,
    readiness,
    top_5_issues: top5,
    quick_wins: quickWins,
  };
}

/**
 * Run the full checklist validation for a project.
 * `action` may be "validate" (full profile) or a specific check id like
 * "mda-check" / "balance-check" — in the latter case we still return the
 * full profile (per the ChecklistValidationProfile shape) but only the
 * requested check is non-skipped.
 */
export async function runChecklistValidation(
  project: ProjectData,
  action: string,
  options: RunOptions = {}
): Promise<ChecklistResult> {
  const startedAt = Date.now();
  const depth = options.depth || "standard";
  const requestedTypes =
    options.checklistTypes && options.checklistTypes.length > 0
      ? options.checklistTypes
      : action === "validate"
        ? ALL_CHECKLISTS
        : [action.replace(/-check$/, "").replace(/s$/, "")];

  const activeChecklists = requestedTypes.filter((t) =>
    ALL_CHECKLISTS.includes(t)
  );
  const estimatedChecks = activeChecklists.length * 5;

  let mdaCheck: { skipped: boolean; issues: ChecklistIssue[]; overall_mda_score: number };
  let balanceCheck: {
    skipped: boolean;
    issues: ChecklistIssue[];
    overall_balance_score: number;
  };
  let narrativeCheck: {
    skipped: boolean;
    issues: ChecklistIssue[];
    overall_narrative_score: number;
  };
  let economyCheck: { skipped: boolean; issues: ChecklistIssue[] };
  let lensCheck: { skipped: boolean; issues: ChecklistIssue[] };

  if (activeChecklists.includes("mda")) {
    mdaCheck = runMdaCheck(project);
  } else {
    mdaCheck = { skipped: true, issues: [], overall_mda_score: 0 };
  }

  if (activeChecklists.includes("balance")) {
    balanceCheck = runBalanceCheck(project);
  } else {
    balanceCheck = { skipped: true, issues: [], overall_balance_score: 0 };
  }

  if (activeChecklists.includes("narrative")) {
    narrativeCheck = runNarrativeCheck(project);
  } else {
    narrativeCheck = { skipped: true, issues: [], overall_narrative_score: 0 };
  }

  if (activeChecklists.includes("economy")) {
    economyCheck = runEconomyCheck(project);
  } else {
    economyCheck = { skipped: true, issues: [] };
  }

  if (activeChecklists.includes("lenses")) {
    lensCheck = runLensCheck(project);
  } else {
    lensCheck = { skipped: true, issues: [] };
  }

  // TASK-6b.3-9: Run 6 new Bible checks.
  const shellFiltersCheck = activeChecklists.includes("shell_filters") ? runShellFiltersCheck(project) : { skipped: true, issues: [] };
  const uptonCheck = activeChecklists.includes("upton") ? runUptonCheck(project) : { skipped: true, issues: [] };
  const rollingMorrisCheck = activeChecklists.includes("rolling_morris") ? runRollingMorrisCheck(project) : { skipped: true, issues: [] };
  const bondMethodsCheck = activeChecklists.includes("bond_methods") ? runBondMethodsCheck(project) : { skipped: true, issues: [] };
  const fullertonCheck = activeChecklists.includes("fullerton") ? runFullertonCheck(project) : { skipped: true, issues: [] };
  const narrativeTypesCheck = activeChecklists.includes("narrative_types") ? runNarrativeTypesCheck(project) : { skipped: true, issues: [] };

  const allIssues: ChecklistIssue[] = [
    ...(mdaCheck.skipped ? [] : mdaCheck.issues),
    ...(balanceCheck.skipped ? [] : balanceCheck.issues),
    ...(narrativeCheck.skipped ? [] : narrativeCheck.issues),
    ...(economyCheck.skipped ? [] : economyCheck.issues),
    ...(lensCheck.skipped ? [] : lensCheck.issues),
    // TASK-6b.3-9: 6 new Bible checks.
    ...(shellFiltersCheck.skipped ? [] : shellFiltersCheck.issues),
    ...(uptonCheck.skipped ? [] : uptonCheck.issues),
    ...(rollingMorrisCheck.skipped ? [] : rollingMorrisCheck.issues),
    ...(bondMethodsCheck.skipped ? [] : bondMethodsCheck.issues),
    ...(fullertonCheck.skipped ? [] : fullertonCheck.issues),
    ...(narrativeTypesCheck.skipped ? [] : narrativeTypesCheck.issues),
  ];

  // R6-07: compute economy and lens scores for buildSummary, including
  // Progression as a new scored check. R6-09: skipped/missing checks now
  // get score 0 (was 0.5 — falsely inflated readiness for incomplete projects).
  const economyScore = economyCheck.skipped
    ? 0  // R6-09: missing stage = 0, not 0.5
    : (economyCheck.issues.length === 0 ? 0.9 : economyCheck.issues.some((i) => i.severity === "error") ? 0.2 : 0.6);
  const lensScore = lensCheck.skipped
    ? 0  // R6-09: missing stage = 0, not 0.5
    : (lensCheck.issues.length === 0 ? 0.9 : lensCheck.issues.some((i) => i.severity === "error") ? 0.2 : 0.6);
  // R6-07: Progression check — score from progression presence and validation.
  const progressionScore = project.progression
    ? (() => {
        const progValidation = safeJsonParse<{ checks?: Record<string, boolean> }>(project.progression.validation, {});
        const checks = progValidation?.checks ?? {};
        const checkValues = Object.values(checks);
        const passedCount = checkValues.filter(Boolean).length;
        return checkValues.length > 0 ? passedCount / checkValues.length : 0.5;
      })()
    : 0;  // R6-09: missing stage = 0

  const summary = buildSummary(
    mdaCheck.overall_mda_score,
    balanceCheck.overall_balance_score,
    narrativeCheck.overall_narrative_score,
    allIssues,
    economyScore,
    lensScore,
    progressionScore,  // R6-07: new parameter
  );

  // Build the persisted issues list (with id + remediation)
  const persistedIssues = allIssues.map((issue, idx) => {
    const sev: "critical" | "warning" | "info" =
      issue.severity === "error" ? "critical" : (issue.severity as "warning" | "info");
    return {
      id: `issue_${idx + 1}`,
      severity: sev,
      category: issue.issue_type,
      title: issue.issue_type,
      description: issue.description,
      source: "checklist",
      remediation: issue.suggestion,
    };
  });

  const remediationPlan = persistedIssues.map((issue) => ({
    issue_id: issue.id,
    action: issue.remediation,
    effort: (issue.severity === "critical" ? "hard" : issue.severity === "warning" ? "moderate" : "easy") as "easy" | "moderate" | "hard",
    impact: (issue.severity === "critical" ? "high" : issue.severity === "warning" ? "medium" : "low") as "high" | "medium" | "low",
  }));

  const criticalIssueCount = persistedIssues.filter((i) => i.severity === "critical").length;
  const totalIssueCount = persistedIssues.length;

  const readinessLevel =
    summary.readiness === "ready"
      ? "ready"
      : summary.readiness === "almost"
        ? "review"
        : "draft";

  const profile = {
    scope: {
      active_checklists: activeChecklists,
      depth,
      estimated_checks: estimatedChecks,
    },
    mda_check: mdaCheck,
    balance_check: balanceCheck,
    narrative_check: narrativeCheck,
    economy_check: economyCheck,
    lens_check: lensCheck,
    // TASK-6b.3-9: 6 new Bible checks in profile.
    shell_filters_check: shellFiltersCheck,
    upton_check: uptonCheck,
    rolling_morris_check: rollingMorrisCheck,
    bond_methods_check: bondMethodsCheck,
    fullerton_check: fullertonCheck,
    narrative_types_check: narrativeTypesCheck,
    summary,
    contract_version: STAGE_CONTRACT_VERSION,
    artifact: createArtifactEnvelope("validation", options.artifactInput ?? {
      action,
      depth,
      checklist_types: activeChecklists,
    }),
    algorithm_metadata: getStageAlgorithmMetadata("validation"),
    // TASK-6b.12: dynamic stages_completed (was hardcoded [1,2,3,4,5,6]).
    stages_completed: activeChecklists.map((_, i) => i + 1),
    latency_ms: Date.now() - startedAt,
  };

  assertStageOutput("validation", profile);

  // --- Persist ---
  await db.projectChecklist.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      overallScore: summary.overall_score,
      readinessLevel,
      criticalIssueCount,
      totalIssueCount,
      inputData: JSON.stringify({
        action,
        depth,
        checklist_types: activeChecklists,
      }),
      mdaCheck: JSON.stringify(mdaCheck),
      balanceCheck: JSON.stringify(balanceCheck),
      narrativeCheck: JSON.stringify(narrativeCheck),
      economyCheck: JSON.stringify(economyCheck),
      lensCheck: JSON.stringify(lensCheck),
      issues: JSON.stringify(persistedIssues),
      remediationPlan: JSON.stringify(remediationPlan),
      fullResults: JSON.stringify(profile),
    },
    update: {
      overallScore: summary.overall_score,
      readinessLevel,
      criticalIssueCount,
      totalIssueCount,
      inputData: JSON.stringify({
        action,
        depth,
        checklist_types: activeChecklists,
      }),
      mdaCheck: JSON.stringify(mdaCheck),
      balanceCheck: JSON.stringify(balanceCheck),
      narrativeCheck: JSON.stringify(narrativeCheck),
      economyCheck: JSON.stringify(economyCheck),
      lensCheck: JSON.stringify(lensCheck),
      issues: JSON.stringify(persistedIssues),
      remediationPlan: JSON.stringify(remediationPlan),
      fullResults: JSON.stringify(profile),
    },
  });

  await updateProjectStage(project.id, "validation");

  return {
    profile,
    overallScore: summary.overall_score,
    readinessLevel,
    criticalIssueCount,
    totalIssueCount,
    issues: persistedIssues,
    remediationPlan,
    mdaCheck,
    balanceCheck,
    narrativeCheck,
    economyCheck,
    lensCheck,
  };
}
