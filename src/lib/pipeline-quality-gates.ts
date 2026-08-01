import {
  artifactEnvelopeSchema,
  type ArtifactStatus,
} from "@/lib/contracts/artifact-envelope";
import type { ContractStageId } from "@/lib/contracts/stage-contracts";

export type QualityGateSeverity = "pass" | "review" | "critical";

export interface QualityGateResult {
  stage: ContractStageId;
  severity: QualityGateSeverity;
  status: Extract<ArtifactStatus, "success" | "needs_review">;
  shouldStop: boolean;
  criticalIssues: string[];
  reviewIssues: string[];
}

export type ResumePrerequisiteResult =
  | { ok: true; gate: QualityGateResult }
  | { ok: false; reason: string; gate?: QualityGateResult };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedRecord(root: Record<string, unknown>, ...path: string[]): Record<string, unknown> | null {
  let current: Record<string, unknown> | null = root;
  for (const key of path) {
    current = asRecord(current?.[key]);
    if (!current) return null;
  }
  return current;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
}

function severityIssues(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    const issue = asRecord(item);
    const severity = typeof issue?.severity === "string" ? issue.severity.toLowerCase() : "";
    if (severity !== "critical" && severity !== "error") return [];
    const description = issue?.description ?? issue?.message ?? issue?.issue_type;
    return [typeof description === "string" && description.trim()
      ? description.trim()
      : `Critical issue ${index + 1}`];
  });
}

function positiveCount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function evaluateStageQuality(
  stage: ContractStageId,
  output: unknown,
): QualityGateResult {
  const result = asRecord(output) ?? {};
  const criticalIssues: string[] = [];
  const reviewIssues: string[] = [];

  const validation = nestedRecord(result, "validation");
  const validationReport = nestedRecord(result, "validation_report");
  const pathologies = nestedRecord(result, "pathologies");

  criticalIssues.push(...strings(validation?.critical_issues));
  criticalIssues.push(...strings(validationReport?.critical_issues));
  criticalIssues.push(...strings(pathologies?.critical_issues));
  criticalIssues.push(...severityIssues(validation?.issues));
  criticalIssues.push(...severityIssues(validationReport?.issues));
  criticalIssues.push(...severityIssues(pathologies?.pathologies));

  if (positiveCount(validation?.critical_count)) {
    criticalIssues.push(`${validation?.critical_count} critical validation issue(s)`);
  }
  if (positiveCount(validationReport?.critical_count)) {
    criticalIssues.push(`${validationReport?.critical_count} critical concept issue(s)`);
  }
  if (positiveCount(pathologies?.critical_count)) {
    criticalIssues.push(`${pathologies?.critical_count} critical pathology issue(s)`);
  }

  if (stage === "mda") {
    const lensValidation = nestedRecord(result, "lens_validation");
    criticalIssues.push(...strings(lensValidation?.critical_issues));
    const classic = nestedRecord(result, "classic_mda_result");
    if (classic?.converged === false) reviewIssues.push("MDA did not converge");
  }

  if (stage === "balance") {
    const quality = nestedRecord(result, "machinations_result", "quality");
    criticalIssues.push(...strings(quality?.critical_issues));
    if (quality?.overall_pass === false && strings(quality.critical_issues).length === 0) {
      reviewIssues.push("Balance quality checks did not pass");
    }
  }

  if (stage === "progression") {
    if (positiveCount(validation?.warning_count)) {
      reviewIssues.push(`${validation?.warning_count} progression warning(s)`);
    }
  }

  if (stage === "economy") {
    const quality = nestedRecord(result, "sim_result", "quality");
    criticalIssues.push(...strings(quality?.critical_issues));
    if (quality?.overall_pass === false && strings(quality.critical_issues).length === 0) {
      reviewIssues.push("Economy simulation requires review");
    }
  }

  if (stage === "gdd") {
    const consistency = nestedRecord(result, "consistency_report");
    criticalIssues.push(...severityIssues(consistency?.issues));
    if (positiveCount(consistency?.error_count)) {
      criticalIssues.push(`${consistency?.error_count} GDD consistency error(s)`);
    } else if (consistency?.is_valid === false) {
      reviewIssues.push("GDD consistency report is not valid");
    }
  }

  if (stage === "validation") {
    const summary = nestedRecord(result, "summary");
    if (typeof summary?.readiness === "string" && summary.readiness !== "ready") {
      reviewIssues.push(`Checklist readiness is ${summary.readiness}`);
    }
  }

  if (validation?.overall_passed === false && criticalIssues.length === 0) {
    reviewIssues.push(`${stage} validation requires review`);
  }

  const uniqueCritical = [...new Set(criticalIssues)];
  const uniqueReview = [...new Set(reviewIssues)];
  const severity: QualityGateSeverity = uniqueCritical.length > 0
    ? "critical"
    : uniqueReview.length > 0
      ? "review"
      : "pass";

  return {
    stage,
    severity,
    status: severity === "pass" ? "success" : "needs_review",
    shouldStop: severity === "critical",
    criticalIssues: uniqueCritical,
    reviewIssues: uniqueReview,
  };
}

export function validateResumePrerequisite(
  stage: ContractStageId,
  output: unknown,
): ResumePrerequisiteResult {
  const result = asRecord(output);
  if (!result) return { ok: false, reason: `${stage} output is missing` };

  const artifact = artifactEnvelopeSchema.safeParse(result.artifact);
  if (!artifact.success || artifact.data.artifactType !== stage) {
    return { ok: false, reason: `${stage} has no matching versioned artifact` };
  }
  if (artifact.data.status !== "success") {
    return { ok: false, reason: `${stage} artifact status is ${artifact.data.status}` };
  }

  const gate = evaluateStageQuality(stage, result);
  if (gate.shouldStop) {
    return { ok: false, reason: `${stage} critical gate is still active`, gate };
  }
  return { ok: true, gate };
}
