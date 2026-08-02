/**
 * R6-06: Unit tests for per-section LLM generation.
 */

import { describe, it, expect } from "vitest";
import { shouldUseLlmForSection } from "./section-llm";

describe("shouldUseLlmForSection — eligibility logic", () => {
  it("returns false when useAi is false", () => {
    expect(shouldUseLlmForSection("template", true, false)).toBe(false);
  });

  it("returns false for auto_fill sections (already have real data)", () => {
    expect(shouldUseLlmForSection("auto_fill", true, true)).toBe(false);
  });

  it("returns false when no upstream artifact", () => {
    expect(shouldUseLlmForSection("template", false, true)).toBe(false);
  });

  it("returns true for template sections with upstream artifact and useAi", () => {
    expect(shouldUseLlmForSection("template", true, true)).toBe(true);
  });

  it("returns true for placeholder sections with upstream artifact and useAi", () => {
    expect(shouldUseLlmForSection("placeholder", true, true)).toBe(true);
  });

  it("returns false for manual sections", () => {
    expect(shouldUseLlmForSection("manual", true, true)).toBe(false);
  });
});

describe("R6-06 acceptance — LLM sections never auto-accepted", () => {
  it("template + upstream + useAi → eligible for LLM (but review required)", () => {
    const eligible = shouldUseLlmForSection("template", true, true);
    expect(eligible).toBe(true);
    // The LlmSectionResult type enforces review_status: "needs_review" —
    // this is a compile-time guarantee, not a runtime check.
  });

  it("auto_fill → NOT eligible (already has real data)", () => {
    expect(shouldUseLlmForSection("auto_fill", true, true)).toBe(false);
  });
});
