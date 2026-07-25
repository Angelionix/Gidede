"use client";

/**
 * Gidede — Project block data loader (Task 14)
 *
 * Fetches the project detail (which now embeds every block's stored result)
 * and exposes a typed accessor plus a JSON parse helper with a stable
 * signature. The block pages use this to load their own previously-generated
 * result on mount so navigating away and back does not show an empty form.
 */

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

// ============================================================
// Shape of GET /api/v1/projects/[id] response (relevant parts).
// Every block field is a JSON-encoded string in the DB; we return them
// as-is and let callers JSON.parse selectively.
// ============================================================

export interface ProjectBlockData {
  id: string;
  name: string;
  genre: string | null;
  has_concept: boolean;
  has_core_loop: boolean;
  has_mda: boolean;
  has_balance: boolean;
  has_progression: boolean;
  has_economy: boolean;
  has_gdd: boolean;
  has_checklist: boolean;
  concept: {
    genre: string | null;
    subgenre: string | null;
    primaryAesthetic: string | null;
    usp: string | null;
    inputData: string | null;
    onePagerData: string | null;
    aestheticProfile: string | null;
    dynamicsProfile: string | null;
    mechanicSet: string | null;
    validationReport: string | null;
    uspCandidates: string | null;
    coreLoopCandidates: string | null;
  } | null;
  coreLoop: {
    structuralType: string | null;
    structuralSubtype: string | null;
    stepCount: number | null;
    stepsData: string | null;
    innerLoops: string | null;
    outerLoops: string | null;
    metaLoop: string | null;
    loopHierarchy: string | null;
    pathologies: string | null;
    recommendations: string | null;
    validationData: string | null;
    fullProfile: string | null;
  } | null;
  mdaProfile: {
    primaryAesthetic: string | null;
    secondaryAesthetic: string | null;
    overallMatch: number | null;
    iterationCount: number;
    mechanicSet: string | null;
    observedDynamics: string | null;
    matchScores: string | null;
    lensValidation: string | null;
    bondValidation: string | null;
    fullProfile: string | null;
  } | null;
  balanceResult: {
    balanceType: string | null;
    overallBalanceScore: number | null;
    elementCount: number | null;
    elements: string | null;
    costPowerCurves: string | null;
    pathologies: string | null;
    corrections: string | null;
    fullResult: string | null;
  } | null;
  progression: {
    totalLevels: number | null;
    tierCount: number | null;
    curveType: string | null;
    targetDurationHours: number | null;
    macroModel: string | null;
    tierModel: string | null;
    curves: string | null;
    contentPlan: string | null;
    validation: string | null;
    fullProfile: string | null;
  } | null;
  economy: {
    systemType: string | null;
    resourceCount: number | null;
    hasPathology: boolean;
    resourceModel: string | null;
    machinationsModel: string | null;
    conversionChains: string | null;
    pathologies: string | null;
    corrections: string | null;
    simulationResults: string | null;
    monetizationModel: string | null;
    fullProfile: string | null;
  } | null;
  gdd: {
    format: string | null;
    sectionCount: number | null;
    completenessPercent: number | null;
    sections: string | null;
    visualElements: string | null;
    consistencyIssues: string | null;
    completenessReport: string | null;
    fullProfile: string | null;
  } | null;
  checklist: {
    overallScore: number | null;
    readinessLevel: string | null;
    criticalIssueCount: number;
    totalIssueCount: number;
    issues: string | null;
    remediationPlan: string | null;
    fullResults: string | null;
  } | null;
}

// ============================================================
// Helpers
// ============================================================

/** Safe JSON.parse — returns null on failure or for null/empty input. */
export function safeJsonParse<T = unknown>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ============================================================
// Hook
// ============================================================

export interface UseProjectBlockDataResult {
  data: ProjectBlockData | null;
  isLoading: boolean;
  error: string | null;
  /** Reload the project detail from the server. */
  reload: () => Promise<void>;
}

/**
 * Fetches the project detail (with embedded block data) once per projectId.
 * Returns a stable isLoading flag and an error string suitable for UI.
 *
 * Block pages typically consume this via the returned `data` field and use
 * the `safeJsonParse` helper to decode each JSON-encoded field.
 */
export function useProjectBlockData(projectId: string | null): UseProjectBlockDataResult {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<ProjectBlockData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    if (!projectId) {
      setData(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ProjectBlockData>(`/projects/${projectId}`);
      setData(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось загрузить данные проекта";
      setError(msg);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reload();
     
  }, [projectId]);

  return { data, isLoading, error, reload };
}
