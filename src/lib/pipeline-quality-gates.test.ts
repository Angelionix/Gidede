import { describe, expect, it } from "vitest";
import { createArtifactEnvelope } from "@/lib/contracts/artifact-envelope";
import {
  evaluateStageQuality,
  validateResumePrerequisite,
} from "./pipeline-quality-gates";

describe("pipeline quality gates", () => {
  it("stops on explicit Core Loop critical pathologies", () => {
    const gate = evaluateStageQuality("core_loop", {
      pathologies: {
        critical_count: 1,
        pathologies: [{ severity: "critical", description: "Stuck state" }],
      },
    });
    expect(gate).toMatchObject({ severity: "critical", status: "needs_review", shouldStop: true });
    expect(gate.criticalIssues).toContain("Stuck state");
  });

  it("stops on critical Balance, Progression, Economy and GDD signals", () => {
    expect(evaluateStageQuality("balance", {
      machinations_result: { quality: { critical_issues: ["Runaway"] } },
    }).shouldStop).toBe(true);
    expect(evaluateStageQuality("progression", {
      validation: { critical_count: 2 },
    }).shouldStop).toBe(true);
    expect(evaluateStageQuality("economy", {
      sim_result: { quality: { critical_issues: ["Stall"] } },
    }).shouldStop).toBe(true);
    expect(evaluateStageQuality("gdd", {
      consistency_report: { error_count: 1, issues: [] },
    }).shouldStop).toBe(true);
  });

  it("marks soft failures for review without stopping downstream work", () => {
    const gate = evaluateStageQuality("mda", {
      classic_mda_result: { converged: false },
      lens_validation: { critical_issues: [] },
    });
    expect(gate).toMatchObject({ severity: "review", status: "needs_review", shouldStop: false });
  });

  it("passes when no explicit critical or review signal is present", () => {
    expect(evaluateStageQuality("concept", {
      validation_report: { issues: [], critical_count: 0 },
    })).toMatchObject({ severity: "pass", status: "success", shouldStop: false });
  });

  it("allows resume only through a successful versioned artifact with a cleared hard gate", () => {
    expect(validateResumePrerequisite("core_loop", {
      validation: { overall_passed: true },
    })).toMatchObject({ ok: false, reason: expect.stringContaining("versioned artifact") });

    expect(validateResumePrerequisite("core_loop", {
      artifact: createArtifactEnvelope("core_loop", {}),
      pathologies: { critical_count: 1 },
    })).toMatchObject({ ok: false, reason: expect.stringContaining("critical gate") });

    expect(validateResumePrerequisite("core_loop", {
      artifact: createArtifactEnvelope("core_loop", {}),
      pathologies: { critical_count: 0, pathologies: [] },
      validation: { overall_passed: true },
    })).toMatchObject({ ok: true, gate: { shouldStop: false } });
  });
});
