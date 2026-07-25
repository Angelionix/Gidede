/**
 * PUT /api/v1/coreloop/[projectId]
 *
 * Обновляет шаги Core Loop для указанного проекта.
 * Body: { steps: Array<{ name?: string; action?: string; feedback?: string; ... }> }
 *
 * Поведение:
 *  - Верифицирует владение проектом через getOwnedProject.
 *  - Загружает существующую строку ProjectCoreLoop (или создаёт новую, если её нет).
 *  - Записывает отредактированные шаги в JSON-колонку stepsData,
 *    сохраняя оригинальную форму объектов (слияние).
 *  - Обновляет stepCount.
 *  - Возвращает { ok: true, step_count: N }.
 *
 * Не пересчитывает structural_type / pathologies / validation — это
 * позволяет пользователю делать быстрые правки без запуска полного
 * 5-этапного алгоритма (для пересчёта нужно перезапустить Блок 2).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import {
  getOwnedProject,
  safeJsonParse,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";

interface EditedStep {
  name?: string;
  action?: string;
  feedback?: string;
  feedback_type?: string;
  mechanics?: string[];
  resources_consumed?: string[];
  resources_produced?: string[];
  duration_estimate?: number;
  description?: string;
  [key: string]: unknown;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    if (!projectId) {
      return VALIDATION_ERROR("projectId обязателен в пути");
    }

    const body = await request.json().catch(() => null);
    if (!body || !Array.isArray(body.steps)) {
      return VALIDATION_ERROR("Поле 'steps' (массив) обязательно в теле запроса");
    }

    // Нормализуем шаги: убираем служебные поля, валидируем.
    const editedSteps: EditedStep[] = body.steps
      .map((raw: unknown) => {
        if (typeof raw !== "object" || raw === null) return null;
        const s = raw as Record<string, unknown>;
        // Гарантируем что есть хотя бы action или name.
        const name = (s.name as string | undefined)?.toString().trim();
        const action = (s.action as string | undefined)?.toString().trim();
        if (!name && !action) return null;
        return {
          ...s,
          name: name || action,
          action: action || name,
          feedback: (s.feedback as string | undefined)?.toString().trim() || undefined,
          feedback_type:
            (s.feedback_type as string | undefined)?.toString().trim() ||
            (s.feedback as string | undefined)?.toString().trim() ||
            undefined,
          // Удаляем служебные поля UI
          _uid: undefined,
        } as EditedStep;
      })
      .filter((s: EditedStep | null): s is EditedStep => s !== null);

    if (editedSteps.length === 0) {
      return VALIDATION_ERROR("Должен быть хотя бы один шаг с названием или действием");
    }

    // Верифицируем владение проектом.
    const owned = await getOwnedProject(
      { id: user.id, email: user.email, name: user.name },
      projectId
    );
    if (owned instanceof NextResponse) return owned;

    const project = owned.project as {
      id: string;
      coreLoop?: {
        id: string;
        stepsData: string | null;
        inputData: string | null;
        structuralType: string | null;
        structuralSubtype: string | null;
      } | null;
    };

    // Загружаем существующие шаги, чтобы слить редактированные поля
    // с оригинальными (mechanics, resources, duration_estimate, ...).
    const existingStepsRaw = project.coreLoop?.stepsData || null;
    const existingSteps = safeJsonParse<unknown[]>(existingStepsRaw, []);
    const existingArray = Array.isArray(existingSteps) ? existingSteps : [];

    // Стратегия слияния:
    //  - Если новый шаг имеет тот же индекс, что и существующий —
    //    сливаем поля (обновляем только то, что менял пользователь).
    //  - Если шагов больше, чем в existing — для новых используем как есть.
    //  - Если шагов меньше — лишние существующие дропаем.
    const merged: EditedStep[] = editedSteps.map((edited, idx) => {
      const original = existingArray[idx] as Record<string, unknown> | undefined;
      if (original && typeof original === "object") {
        return { ...(original as Record<string, unknown>), ...edited } as EditedStep;
      }
      return edited;
    });

    const stepsDataJson = JSON.stringify(merged);

    // Upsert ProjectCoreLoop: если строки нет — создаём с минимальным набором.
    await db.projectCoreLoop.upsert({
      where: { projectId: project.id },
      create: {
        projectId: project.id,
        structuralType: project.coreLoop?.structuralType || "engine",
        structuralSubtype: project.coreLoop?.structuralSubtype || null,
        stepCount: merged.length,
        hierarchyDepth: 6,
        pathologyCount: 0,
        inputData: project.coreLoop?.inputData || JSON.stringify({ source: "manual_edit" }),
        stepsData: stepsDataJson,
      },
      update: {
        stepsData: stepsDataJson,
        stepCount: merged.length,
      },
    });

    // Бамп стадии проекта (без пересчёта completion процентов — он не меняется,
    // core_loop уже учтён, если существовал; если только что создан — добавится).
    await updateProjectStage(project.id, "core_loop");

    return NextResponse.json({
      ok: true,
      project_id: project.id,
      step_count: merged.length,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[coreloop/PUT] error:", error);
    return SERVER_ERROR();
  }
}

/**
 * GET /api/v1/coreloop/[projectId]
 *
 * Возвращает текущие шаги Core Loop проекта — используется редактором
 * при первой загрузке (если нужно загрузить шаги без перегенерации).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    if (!projectId) return VALIDATION_ERROR("projectId обязателен");

    const owned = await getOwnedProject(
      { id: user.id, email: user.email, name: user.name },
      projectId
    );
    if (owned instanceof NextResponse) return owned;

    const project = owned.project as {
      id: string;
      coreLoop?: {
        stepsData: string | null;
        structuralType: string | null;
        stepCount: number | null;
      } | null;
    };

    if (!project.coreLoop) {
      return NextResponse.json({
        ok: true,
        project_id: project.id,
        steps: [],
        structural_type: null,
      });
    }

    const steps = safeJsonParse<unknown[]>(project.coreLoop.stepsData, []);
    return NextResponse.json({
      ok: true,
      project_id: project.id,
      steps: Array.isArray(steps) ? steps : [],
      structural_type: project.coreLoop.structuralType,
      step_count: project.coreLoop.stepCount,
    });
  } catch (error) {
    console.error("[coreloop/GET] error:", error);
    return SERVER_ERROR();
  }
}
