import { z } from "zod";
import { hashArtifactInput } from "@/lib/contracts/artifact-envelope";
import type { PrototypeArtifact } from "@/lib/prototype-lineage";

const funHypothesisSchema = z.object({
  status: z.enum(["unverified", "supported", "rejected"]),
  statement: z.string().trim().min(1),
  test_protocol: z.object({
    duration_seconds: z.number().positive(),
    minimum_participants: z.number().int().positive(),
    task: z.string().trim().min(1),
    metrics: z.array(z.object({
      id: z.enum(["loop_completion_rate", "voluntary_replay_rate", "critical_confusion_rate"]),
      description: z.string().trim().min(1),
      comparator: z.enum([">=", "<="]),
      target: z.number().min(0).max(1),
    })).min(1),
    decision_rule: z.string().trim().min(1),
  }),
  evidence: z.array(z.unknown()),
});

export interface PlaytestHypothesisSnapshot {
  hypothesisId: string;
  coreLoopVersion: string;
  statusAtTest: "unverified" | "supported" | "rejected";
  statement: string;
  testProtocol: z.infer<typeof funHypothesisSchema>["test_protocol"];
}

export interface PlaytestEvidenceRow {
  prototypeId: string | null;
  hypothesisId: string | null;
  cohortId: string | null;
  participantId: string | null;
  completion: boolean | null;
  confusionEvents: number | null;
  retryCount: number | null;
  createdAt: Date | string;
}

export interface PrototypePlaytestAggregate {
  prototypeId: string;
  hypothesisId: string;
  cohortCount: number;
  participantCount: number;
  totalRuns: number;
  latestRunAt: string;
  completion: { observed: number; rate: number | null };
  criticalConfusion: { observed: number; rate: number | null };
  retry: { observed: number; rate: number | null; averageCount: number | null };
}

export type PlaytestDecision = "go" | "iterate" | "stop" | "insufficient_data";

export interface PlaytestDecisionGate {
  decision: PlaytestDecision;
  reason: string;
  prototypeId: string | null;
  hypothesisId: string | null;
  participantCount: number;
  metricResults: Array<{
    id: string;
    observed: number;
    rate: number | null;
    comparator: ">=" | "<=";
    target: number;
    passed: boolean | null;
  }>;
}

export class PlaytestEvidenceError extends Error {
  constructor(public readonly code: "hypothesis_missing" | "core_loop_version_missing", message: string) {
    super(message);
    this.name = "PlaytestEvidenceError";
  }
}

export function createHypothesisSnapshot(
  validationData: string | null | undefined,
  prototype: PrototypeArtifact,
): PlaytestHypothesisSnapshot {
  const coreLoopVersion = prototype.sourceArtifactVersions.core_loop;
  if (!coreLoopVersion) {
    throw new PlaytestEvidenceError(
      "core_loop_version_missing",
      "PrototypeArtifact не содержит версию Core Loop.",
    );
  }
  return createHypothesisSnapshotFromValidation(validationData, coreLoopVersion);
}

export function createHypothesisSnapshotFromValidation(
  validationData: string | null | undefined,
  coreLoopVersion: string,
): PlaytestHypothesisSnapshot {
  let validation: unknown;
  try {
    validation = validationData ? JSON.parse(validationData) : null;
  } catch {
    validation = null;
  }
  const parsed = funHypothesisSchema.safeParse(
    validation && typeof validation === "object"
      ? (validation as Record<string, unknown>).fun_hypothesis
      : null,
  );
  if (!parsed.success) {
    throw new PlaytestEvidenceError(
      "hypothesis_missing",
      "Core Loop не содержит валидную fun_hypothesis; пересоберите его перед плейтестом.",
    );
  }

  return createHypothesisSnapshotForCoreVersion(parsed.data, coreLoopVersion);
}

export function createHypothesisSnapshotForCoreVersion(
  hypothesis: z.infer<typeof funHypothesisSchema>,
  coreLoopVersion: string,
): PlaytestHypothesisSnapshot {
  const hypothesisId = hashArtifactInput({
    coreLoopVersion,
    statement: hypothesis.statement,
    testProtocol: hypothesis.test_protocol,
  });
  return {
    hypothesisId,
    coreLoopVersion,
    statusAtTest: hypothesis.status,
    statement: hypothesis.statement,
    testProtocol: hypothesis.test_protocol,
  };
}

export function evaluatePlaytestDecision(
  hypothesis: PlaytestHypothesisSnapshot,
  aggregate: PrototypePlaytestAggregate | null,
): PlaytestDecisionGate {
  if (!aggregate) {
    return {
      decision: "insufficient_data",
      reason: "Нет versioned playtest evidence для текущей гипотезы.",
      prototypeId: null,
      hypothesisId: hypothesis.hypothesisId,
      participantCount: 0,
      metricResults: [],
    };
  }

  const metricResults = hypothesis.testProtocol.metrics.map((metric) => {
    const measured = metric.id === "loop_completion_rate"
      ? aggregate.completion
      : metric.id === "critical_confusion_rate"
        ? aggregate.criticalConfusion
        : aggregate.retry;
    const passed = measured.rate == null
      ? null
      : metric.comparator === ">="
        ? measured.rate >= metric.target
        : measured.rate <= metric.target;
    return { id: metric.id, observed: measured.observed, rate: measured.rate, comparator: metric.comparator, target: metric.target, passed };
  });
  const minimum = hypothesis.testProtocol.minimum_participants;
  const missingEvidence = aggregate.participantCount < minimum
    || metricResults.some((metric) => metric.observed < minimum || metric.rate == null);
  if (missingEvidence) {
    return {
      decision: "insufficient_data",
      reason: `Нужно минимум ${minimum} участников и ${minimum} наблюдений по каждой метрике.`,
      prototypeId: aggregate.prototypeId,
      hypothesisId: aggregate.hypothesisId,
      participantCount: aggregate.participantCount,
      metricResults,
    };
  }

  const allPassed = metricResults.every((metric) => metric.passed === true);
  const repeatedCompleteFailure = metricResults.every((metric) => metric.passed === false)
    && aggregate.cohortCount >= 2
    && aggregate.participantCount >= minimum * 2;
  return {
    decision: allPassed ? "go" : repeatedCompleteFailure ? "stop" : "iterate",
    reason: allPassed
      ? "Все пороги гипотезы подтверждены достаточным числом наблюдений."
      : repeatedCompleteFailure
        ? "Все пороги провалены минимум в двух когортах с удвоенной минимальной выборкой."
      : "Данных достаточно, но один или несколько порогов гипотезы не достигнуты.",
    prototypeId: aggregate.prototypeId,
    hypothesisId: aggregate.hypothesisId,
    participantCount: aggregate.participantCount,
    metricResults,
  };
}

function rate(values: boolean[]): number | null {
  if (values.length === 0) return null;
  return Number((values.filter(Boolean).length / values.length).toFixed(3));
}

export function aggregatePlaytestEvidence(rows: PlaytestEvidenceRow[]): PrototypePlaytestAggregate[] {
  const groups = new Map<string, PlaytestEvidenceRow[]>();
  for (const row of rows) {
    if (!row.prototypeId || !row.hypothesisId) continue;
    const key = `${row.prototypeId}\u0000${row.hypothesisId}`;
    groups.set(key, [...(groups.get(key) || []), row]);
  }

  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      const completions = group.flatMap((row) => row.completion == null ? [] : [row.completion]);
      const confusions = group.flatMap((row) => row.confusionEvents == null ? [] : [row.confusionEvents > 0]);
      const retries = group.flatMap((row) => row.retryCount == null ? [] : [row.retryCount]);
      const latestRunAt = group
        .map((row) => new Date(row.createdAt).toISOString())
        .sort()
        .at(-1)!;

      return {
        prototypeId: first.prototypeId!,
        hypothesisId: first.hypothesisId!,
        cohortCount: new Set(group.map((row) => row.cohortId).filter(Boolean)).size,
        participantCount: new Set(group.map((row) => row.participantId).filter(Boolean)).size,
        totalRuns: group.length,
        latestRunAt,
        completion: { observed: completions.length, rate: rate(completions) },
        criticalConfusion: { observed: confusions.length, rate: rate(confusions) },
        retry: {
          observed: retries.length,
          rate: rate(retries.map((count) => count > 0)),
          averageCount: retries.length > 0
            ? Number((retries.reduce((sum, count) => sum + count, 0) / retries.length).toFixed(3))
            : null,
        },
      };
    })
    .sort((left, right) => right.latestRunAt.localeCompare(left.latestRunAt));
}
