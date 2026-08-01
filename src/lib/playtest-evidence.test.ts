import { describe, expect, it } from "vitest";
import { aggregatePlaytestEvidence, createHypothesisSnapshot, evaluatePlaytestDecision } from "./playtest-evidence";
import type { PrototypeArtifact } from "./prototype-lineage";

const prototype: PrototypeArtifact = {
  prototypeId: "prototype-v1",
  schemaVersion: "1.0.0",
  projectId: "project-1",
  sourceArtifactVersions: { core_loop: "core-v1@1.0.0" },
  inputHash: "a".repeat(64),
  generatedAt: "2026-08-01T10:00:00.000Z",
};

const hypothesis = {
  status: "unverified",
  statement: "Players understand and voluntarily repeat the loop.",
  test_protocol: {
    duration_seconds: 30,
    minimum_participants: 5,
    task: "Complete one loop without help.",
    metrics: [
      { id: "loop_completion_rate", description: "Completion", comparator: ">=", target: 0.8 },
    ],
    decision_rule: "All thresholds must pass.",
  },
  evidence: [],
};

describe("playtest evidence — R2-07", () => {
  it("creates a stable hypothesis snapshot tied to the Core Loop version", () => {
    const left = createHypothesisSnapshot(JSON.stringify({ fun_hypothesis: hypothesis }), prototype);
    const right = createHypothesisSnapshot(JSON.stringify({ fun_hypothesis: hypothesis }), prototype);
    expect(left.hypothesisId).toBe(right.hypothesisId);
    expect(left.hypothesisId).toMatch(/^[a-f0-9]{64}$/);
    expect(left.coreLoopVersion).toBe("core-v1@1.0.0");
    expect(left.statusAtTest).toBe("unverified");
  });

  it("rejects a playtest without a measurable fun hypothesis", () => {
    expect(() => createHypothesisSnapshot("{}", prototype)).toThrow(/fun_hypothesis/);
  });

  it("aggregates only measured fields and keeps missing observations explicit", () => {
    const aggregates = aggregatePlaytestEvidence([
      {
        prototypeId: "p1", hypothesisId: "h1", cohortId: "c1", participantId: "u1",
        completion: true, confusionEvents: 0, retryCount: 1, createdAt: "2026-08-01T10:00:00.000Z",
      },
      {
        prototypeId: "p1", hypothesisId: "h1", cohortId: "c1", participantId: "u2",
        completion: false, confusionEvents: 2, retryCount: null, createdAt: "2026-08-01T10:01:00.000Z",
      },
      {
        prototypeId: "p1", hypothesisId: "h1", cohortId: "c2", participantId: "u1",
        completion: true, confusionEvents: null, retryCount: 0, createdAt: "2026-08-01T10:02:00.000Z",
      },
      {
        prototypeId: null, hypothesisId: null, cohortId: null, participantId: null,
        completion: true, confusionEvents: 0, retryCount: 0, createdAt: "2026-08-01T10:03:00.000Z",
      },
    ]);

    expect(aggregates).toEqual([expect.objectContaining({
      prototypeId: "p1",
      hypothesisId: "h1",
      cohortCount: 2,
      participantCount: 2,
      totalRuns: 3,
      completion: { observed: 3, rate: 0.667 },
      criticalConfusion: { observed: 2, rate: 0.5 },
      retry: { observed: 2, rate: 0.5, averageCount: 0.5 },
    })]);
  });

  it("does not manufacture rates when a metric was never observed", () => {
    const [aggregate] = aggregatePlaytestEvidence([{
      prototypeId: "p1", hypothesisId: "h1", cohortId: "c1", participantId: "u1",
      completion: null, confusionEvents: null, retryCount: null, createdAt: "2026-08-01T10:00:00.000Z",
    }]);
    expect(aggregate.completion).toEqual({ observed: 0, rate: null });
    expect(aggregate.criticalConfusion).toEqual({ observed: 0, rate: null });
    expect(aggregate.retry).toEqual({ observed: 0, rate: null, averageCount: null });
  });

  it("requires the minimum cohort and observed metrics before go", () => {
    const snapshot = createHypothesisSnapshot(JSON.stringify({ fun_hypothesis: hypothesis }), prototype);
    const aggregate = {
      prototypeId: "p1", hypothesisId: snapshot.hypothesisId, cohortCount: 1, participantCount: 4,
      totalRuns: 4, latestRunAt: "2026-08-01T10:00:00.000Z",
      completion: { observed: 4, rate: 1 }, criticalConfusion: { observed: 0, rate: null },
      retry: { observed: 4, rate: 1, averageCount: 1 },
    };
    expect(evaluatePlaytestDecision(snapshot, aggregate).decision).toBe("insufficient_data");
  });

  it("returns go only when every measured threshold passes", () => {
    const fullHypothesis = { ...hypothesis, test_protocol: { ...hypothesis.test_protocol, metrics: [
      { id: "loop_completion_rate", description: "Completion", comparator: ">=", target: 0.8 },
      { id: "voluntary_replay_rate", description: "Replay", comparator: ">=", target: 0.6 },
      { id: "critical_confusion_rate", description: "Confusion", comparator: "<=", target: 0.2 },
    ] } };
    const snapshot = createHypothesisSnapshot(JSON.stringify({ fun_hypothesis: fullHypothesis }), prototype);
    const base = {
      prototypeId: "p1", hypothesisId: snapshot.hypothesisId, cohortCount: 1, participantCount: 5,
      totalRuns: 5, latestRunAt: "2026-08-01T10:00:00.000Z",
      completion: { observed: 5, rate: 0.8 }, criticalConfusion: { observed: 5, rate: 0.2 },
      retry: { observed: 5, rate: 0.6, averageCount: 0.6 },
    };
    expect(evaluatePlaytestDecision(snapshot, base).decision).toBe("go");
    expect(evaluatePlaytestDecision(snapshot, { ...base, completion: { observed: 5, rate: 0.6 } }).decision).toBe("iterate");
    expect(evaluatePlaytestDecision(snapshot, {
      ...base,
      cohortCount: 2,
      participantCount: 10,
      completion: { observed: 10, rate: 0.2 },
      criticalConfusion: { observed: 10, rate: 0.8 },
      retry: { observed: 10, rate: 0.1, averageCount: 0.1 },
    }).decision).toBe("stop");
  });
});
