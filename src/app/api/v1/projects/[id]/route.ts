/**
 * GET    /api/v1/projects/[id]   — get project detail
 * DELETE /api/v1/projects/[id]   — delete project
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { UNAUTH, SERVER_ERROR } from "@/lib/api-helpers";
import { serializeProject } from "../route";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    include: {
      concept: true,
      coreLoop: true,
      mdaProfile: true,
      balanceResult: true,
      progression: true,
      economy: true,
      gdd: true,
      checklist: true,
    },
  });

  if (!project) {
    return NextResponse.json(
      { detail: "Проект не найден" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ...serializeProject(project),
    project_stage: project.projectStage,
    version: project.version,
    last_algorithm_run: project.lastAlgorithmRun,
    // Include full concept + coreLoop data so frontend pages (prototypes,
    // project card) can display mechanics + core loop type without an extra
    // round-trip. Also include every block's stored result so block pages can
    // load previously-generated data on mount (Task 14).
    concept: project.concept
      ? {
          genre: project.concept.genre,
          subgenre: project.concept.subgenre,
          primaryAesthetic: project.concept.primaryAesthetic,
          usp: project.concept.usp,
          inputData: project.concept.inputData,
          onePagerData: project.concept.onePagerData,
          aestheticProfile: project.concept.aestheticProfile,
          dynamicsProfile: project.concept.dynamicsProfile,
          mechanicSet: project.concept.mechanicSet,
          validationReport: project.concept.validationReport,
          uspCandidates: project.concept.uspCandidates,
          coreLoopCandidates: project.concept.coreLoopCandidates,
        }
      : null,
    coreLoop: project.coreLoop
      ? {
          structuralType: project.coreLoop.structuralType,
          structuralSubtype: project.coreLoop.structuralSubtype,
          stepCount: project.coreLoop.stepCount,
          stepsData: project.coreLoop.stepsData,
          innerLoops: project.coreLoop.innerLoops,
          outerLoops: project.coreLoop.outerLoops,
          metaLoop: project.coreLoop.metaLoop,
          loopHierarchy: project.coreLoop.loopHierarchy,
          pathologies: project.coreLoop.pathologies,
          recommendations: project.coreLoop.recommendations,
          validationData: project.coreLoop.validationData,
          fullProfile: project.coreLoop.fullProfile,
        }
      : null,
    mdaProfile: project.mdaProfile
      ? {
          primaryAesthetic: project.mdaProfile.primaryAesthetic,
          secondaryAesthetic: project.mdaProfile.secondaryAesthetic,
          overallMatch: project.mdaProfile.overallMatch,
          iterationCount: project.mdaProfile.iterationCount,
          mechanicSet: project.mdaProfile.mechanicSet,
          observedDynamics: project.mdaProfile.observedDynamics,
          matchScores: project.mdaProfile.matchScores,
          lensValidation: project.mdaProfile.lensValidation,
          bondValidation: project.mdaProfile.bondValidation,
          fullProfile: project.mdaProfile.fullProfile,
        }
      : null,
    balanceResult: project.balanceResult
      ? {
          balanceType: project.balanceResult.balanceType,
          overallBalanceScore: project.balanceResult.overallBalanceScore,
          elementCount: project.balanceResult.elementCount,
          elements: project.balanceResult.elements,
          costPowerCurves: project.balanceResult.costPowerCurves,
          pathologies: project.balanceResult.pathologies,
          corrections: project.balanceResult.corrections,
          fullResult: project.balanceResult.fullResult,
        }
      : null,
    progression: project.progression
      ? {
          totalLevels: project.progression.totalLevels,
          tierCount: project.progression.tierCount,
          curveType: project.progression.curveType,
          targetDurationHours: project.progression.targetDurationHours,
          macroModel: project.progression.macroModel,
          tierModel: project.progression.tierModel,
          curves: project.progression.curves,
          contentPlan: project.progression.contentPlan,
          validation: project.progression.validation,
          fullProfile: project.progression.fullProfile,
        }
      : null,
    economy: project.economy
      ? {
          systemType: project.economy.systemType,
          resourceCount: project.economy.resourceCount,
          hasPathology: project.economy.hasPathology,
          resourceModel: project.economy.resourceModel,
          machinationsModel: project.economy.machinationsModel,
          conversionChains: project.economy.conversionChains,
          pathologies: project.economy.pathologies,
          corrections: project.economy.corrections,
          simulationResults: project.economy.simulationResults,
          monetizationModel: project.economy.monetizationModel,
          fullProfile: project.economy.fullProfile,
        }
      : null,
    gdd: project.gdd
      ? {
          format: project.gdd.format,
          sectionCount: project.gdd.sectionCount,
          completenessPercent: project.gdd.completenessPercent,
          sections: project.gdd.sections,
          visualElements: project.gdd.visualElements,
          consistencyIssues: project.gdd.consistencyIssues,
          completenessReport: project.gdd.completenessReport,
          fullProfile: project.gdd.fullProfile,
        }
      : null,
    checklist: project.checklist
      ? {
          overallScore: project.checklist.overallScore,
          readinessLevel: project.checklist.readinessLevel,
          criticalIssueCount: project.checklist.criticalIssueCount,
          totalIssueCount: project.checklist.totalIssueCount,
          issues: project.checklist.issues,
          remediationPlan: project.checklist.remediationPlan,
          fullResults: project.checklist.fullResults,
        }
      : null,
  });
}

/**
 * PUT /api/v1/projects/{id}
 * Обновляет проект (name, description, genre, status).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  const { id } = await params;

  const existing = await db.project.findFirst({
    where: { id, userId: user.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ detail: "Проект не найден" }, { status: 404 });

  try {
    const body = await request.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (body?.name) data.name = String(body.name).trim();
    if (body?.description !== undefined) data.description = String(body.description).trim() || null;
    if (body?.genre !== undefined) data.genre = String(body.genre).trim() || null;
    if (body?.status) data.status = String(body.status).trim();
    if (body?.project_stage) data.projectStage = String(body.project_stage).trim();
    // Support subgenres update (array of strings → JSON)
    if (Array.isArray(body?.subgenres)) {
      const subs = body.subgenres
        .filter((s: unknown) => typeof s === "string")
        .map((s: string) => s.trim())
        .filter(Boolean);
      data.subgenres = subs.length > 0 ? JSON.stringify(subs) : null;
    }

    const project = await db.project.update({
      where: { id },
      data,
      include: {
        concept: { select: { id: true } },
        coreLoop: { select: { id: true } },
        mdaProfile: { select: { id: true } },
        balanceResult: { select: { id: true } },
        progression: { select: { id: true } },
        economy: { select: { id: true } },
        gdd: { select: { id: true } },
        checklist: { select: { id: true } },
      },
    });

    return NextResponse.json(serializeProject(project));
  } catch (error) {
    console.error("[projects/update] error:", error);
    return SERVER_ERROR();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) {
    return NextResponse.json({ detail: "Не авторизован" }, { status: 401 });
  }

  const { id } = await params;

  const project = await db.project.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { detail: "Проект не найден" },
      { status: 404 }
    );
  }

  // Soft-delete: set deletedAt instead of removing the row. This preserves
  // referential integrity for PlaytestResult/SavedMechanic/PrototypeGraph
  // and allows potential restore. The list endpoint filters deletedAt: null.
  await db.project.update({
    where: { id },
    data: { deletedAt: new Date(), status: "archived" },
  });

  return NextResponse.json({ ok: true });
}
