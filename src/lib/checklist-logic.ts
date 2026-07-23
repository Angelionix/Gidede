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
}

const ALL_CHECKLISTS = [
  "mda",
  "balance",
  "narrative",
  "economy",
  "lenses",
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

function buildSummary(
  mdaScore: number,
  balanceScore: number,
  narrativeScore: number,
  allIssues: ChecklistIssue[]
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
  // Weighted average of check scores
  const overall = Number(
    clamp(mdaScore * 0.3 + balanceScore * 0.3 + narrativeScore * 0.3 + 0.1).toFixed(3)
  );

  const readiness =
    overall >= 0.8 ? "ready" : overall >= 0.5 ? "almost" : "not_ready";

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

  const allIssues: ChecklistIssue[] = [
    ...(mdaCheck.skipped ? [] : mdaCheck.issues),
    ...(balanceCheck.skipped ? [] : balanceCheck.issues),
    ...(narrativeCheck.skipped ? [] : narrativeCheck.issues),
    ...(economyCheck.skipped ? [] : economyCheck.issues),
    ...(lensCheck.skipped ? [] : lensCheck.issues),
  ];

  const summary = buildSummary(
    mdaCheck.overall_mda_score,
    balanceCheck.overall_balance_score,
    narrativeCheck.overall_narrative_score,
    allIssues
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
    summary,
    stages_completed: [1, 2, 3, 4, 5, 6],
    latency_ms: Date.now() - startedAt,
  };

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
