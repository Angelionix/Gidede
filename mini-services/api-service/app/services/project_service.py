"""
Gidede — Сервис управления проектами (CRUD)
Фаза 4.A.6: Project State CRUD

Бизнес-логика для:
- Создание проекта с пустым Project State
- Получение проекта с данными блоков
- Обновление проекта
- Удаление проекта (каскадное)
- Список проектов пользователя с пагинацией и поиском
"""

import uuid
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.db import (
    Project, ProjectConcept, ProjectCoreLoop, ProjectMDAProfile,
    ProjectBalanceResult, ProjectProgression, ProjectEconomy,
    ProjectGDD, ProjectChecklist,
)
from app.schemas.project import ProjectCreate, ProjectUpdate


async def create_project(
    db: AsyncSession,
    user_id: str,
    data: ProjectCreate,
) -> Project:
    """
    Создание нового проекта с пустым Project State.
    Автоматически создаёт записи во всех таблицах блоков (пустые).
    """
    project_id = uuid.uuid4().hex

    # Создаём основной проект
    project = Project(
        id=project_id,
        user_id=user_id,
        name=data.name,
        description=data.description,
        genre=data.genre,
        status="draft",
        completion_percent=0,
        version=1,
    )
    db.add(project)

    # Автоматическое создание пустых записей для всех блоков
    BLOCK_MODELS = [
        ProjectConcept, ProjectCoreLoop, ProjectMDAProfile,
        ProjectBalanceResult, ProjectProgression, ProjectEconomy,
        ProjectGDD, ProjectChecklist,
    ]
    for Model in BLOCK_MODELS:
        db.add(Model(id=uuid.uuid4().hex, project_id=project_id))

    await db.flush()
    return project


async def get_project(
    db: AsyncSession,
    project_id: str,
    user_id: str,
) -> Optional[Project]:
    """Получение проекта по ID (только если принадлежит пользователю)."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def get_project_with_blocks(
    db: AsyncSession,
    project_id: str,
    user_id: str,
) -> Optional[Project]:
    """Получение проекта со всеми связанными данными блоков."""
    result = await db.execute(
        select(Project)
        .where(Project.id == project_id, Project.user_id == user_id)
        .options(
            selectinload(Project.concept),
            selectinload(Project.core_loop),
            selectinload(Project.mda_profile),
            selectinload(Project.balance_result),
            selectinload(Project.progression),
            selectinload(Project.economy),
            selectinload(Project.gdd),
            selectinload(Project.checklist),
        )
    )
    return result.unique().scalar_one_or_none()


async def update_project(
    db: AsyncSession,
    project: Project,
    data: ProjectUpdate,
) -> Project:
    """Обновление данных проекта."""
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.genre is not None:
        project.genre = data.genre
    if data.status is not None:
        project.status = data.status

    await db.flush()
    return project


async def delete_project(
    db: AsyncSession,
    project: Project,
) -> bool:
    """
    Удаление проекта (каскадное).
    Все связанные записи блоков удаляются автоматически через CASCADE.
    """
    await db.delete(project)
    await db.flush()
    return True


async def list_projects(
    db: AsyncSession,
    user_id: str,
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    genre: Optional[str] = None,
) -> tuple[list[Project], int]:
    """
    Получение списка проектов пользователя с пагинацией и фильтрацией.

    Возвращает (projects, total_count).
    """
    # Базовый запрос — только проекты пользователя
    base_query = select(Project).where(Project.user_id == user_id)

    # Фильтрация по статусу
    if status:
        base_query = base_query.where(Project.status == status)

    # Фильтрация по жанру
    if genre:
        base_query = base_query.where(Project.genre == genre)

    # Поиск по названию и описанию
    if search:
        search_term = f"%{search}%"
        base_query = base_query.where(
            or_(
                Project.name.ilike(search_term),
                Project.description.ilike(search_term),
            )
        )

    # Подсчёт общего количества
    count_query = select(func.count()).select_from(base_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Пагинация
    offset = (page - 1) * per_page
    query = base_query.order_by(Project.updated_at.desc()).offset(offset).limit(per_page)

    result = await db.execute(query)
    projects = list(result.scalars().all())

    return projects, total


def compute_block_flags(project: Project) -> dict:
    """
    Вычисление флагов заполненности блоков.
    Блок считается заполненным, если у него есть хотя бы одно JSON-поле с данными.
    """
    flags = {
        "has_concept": False,
        "has_core_loop": False,
        "has_mda": False,
        "has_balance": False,
        "has_progression": False,
        "has_economy": False,
        "has_gdd": False,
        "has_checklist": False,
    }

    if project.concept and (project.concept.one_pager_data or project.concept.aesthetic_profile):
        flags["has_concept"] = True

    if project.core_loop and (project.core_loop.steps_data or project.core_loop.full_profile):
        flags["has_core_loop"] = True

    if project.mda_profile and (project.mda_profile.mechanic_set or project.mda_profile.full_profile):
        flags["has_mda"] = True

    if project.balance_result and (project.balance_result.elements or project.balance_result.full_result):
        flags["has_balance"] = True

    if project.progression and (project.progression.curves or project.progression.full_profile):
        flags["has_progression"] = True

    if project.economy and (project.economy.resource_model or project.economy.full_profile):
        flags["has_economy"] = True

    if project.gdd and (project.gdd.sections or project.gdd.full_profile):
        flags["has_gdd"] = True

    if project.checklist and (project.checklist.issues or project.checklist.full_results):
        flags["has_checklist"] = True

    return flags


def compute_completion_percent(flags: dict) -> int:
    """
    Вычисление процента заполненности проекта.
    Каждый блок даёт примерно 12.5% (8 блоков = 100%).
    """
    filled = sum(1 for v in flags.values() if v)
    return int(filled / 8 * 100)


# ============================================================
# 4.D.9: Единый Project State API
# ============================================================

async def get_full_project_state(
    db: AsyncSession,
    project_id: str,
    user_id: str,
) -> Optional[dict]:
    """
    Получить полный Project State проекта как dict.

    Фаза 4.D.9: Единый API для получения данных всех блоков.
    Используется GDD Generator (Блок 6), AI-ассистентом (Блок 7),
    чек-листами (алгоритм 3.8) и экспортом.

    Returns:
        dict с полной структурой ProjectState или None если проект не найден.
        Формат соответствует ProjectState из shared/types/typescript/interfaces.ts
    """
    project = await get_project_with_blocks(db, project_id, user_id)
    if not project:
        return None

    flags = compute_block_flags(project)
    completion = compute_completion_percent(flags)

    # ---- Собираем данные из каждого блока ----

    # Блок 1: Концепция
    concept_data = None
    if project.concept:
        concept_data = {
            "genre": project.concept.genre,
            "subgenre": project.concept.subgenre,
            "primary_aesthetic": project.concept.primary_aesthetic,
            "usp": project.concept.usp,
            "input_data": project.concept.input_data,
            "one_pager_data": project.concept.one_pager_data,
            "aesthetic_profile": project.concept.aesthetic_profile,
            "dynamics_profile": project.concept.dynamics_profile,
            "mechanic_set": project.concept.mechanic_set,
            "validation_report": project.concept.validation_report,
            "usp_candidates": project.concept.usp_candidates,
            "core_loop_candidates": project.concept.core_loop_candidates,
        }

    # Блок 2: Core Loop
    core_loop_data = None
    if project.core_loop:
        core_loop_data = {
            "structural_type": project.core_loop.structural_type,
            "structural_subtype": project.core_loop.structural_subtype,
            "step_count": project.core_loop.step_count,
            "input_data": project.core_loop.input_data,
            "steps_data": project.core_loop.steps_data,
            "inner_loops": project.core_loop.inner_loops,
            "outer_loops": project.core_loop.outer_loops,
            "meta_loop": project.core_loop.meta_loop,
            "loop_hierarchy": project.core_loop.loop_hierarchy,
            "pathologies": project.core_loop.pathologies,
            "recommendations": project.core_loop.recommendations,
            "validation_data": project.core_loop.validation_data,
            "full_profile": project.core_loop.full_profile,
        }

    # Блок 3: MDA
    mda_data = None
    if project.mda_profile:
        mda_data = {
            "primary_aesthetic": project.mda_profile.primary_aesthetic,
            "secondary_aesthetic": project.mda_profile.secondary_aesthetic,
            "overall_match": project.mda_profile.overall_match,
            "iteration_count": project.mda_profile.iteration_count,
            "input_data": project.mda_profile.input_data,
            "target_dynamics": project.mda_profile.target_dynamics,
            "mechanic_set": project.mda_profile.mechanic_set,
            "observed_dynamics": project.mda_profile.observed_dynamics,
            "predicted_aesthetics": project.mda_profile.predicted_aesthetics,
            "match_scores": project.mda_profile.match_scores,
            "lens_validation": project.mda_profile.lens_validation,
            "bond_validation": project.mda_profile.bond_validation,
            "ludonarrative_check": project.mda_profile.ludonarrative_check,
            "machinations_model": project.mda_profile.machinations_model,
            "simulation_results": project.mda_profile.simulation_results,
            "full_profile": project.mda_profile.full_profile,
        }

    # Блок 4: Баланс
    balance_data = None
    if project.balance_result:
        balance_data = {
            "balance_type": project.balance_result.balance_type,
            "overall_balance_score": project.balance_result.overall_balance_score,
            "imbalance_count": project.balance_result.imbalance_count,
            "element_count": project.balance_result.element_count,
            "input_data": project.balance_result.input_data,
            "elements": project.balance_result.elements,
            "cost_power_curves": project.balance_result.cost_power_curves,
            "intransitive_matrix": project.balance_result.intransitive_matrix,
            "nash_equilibrium": project.balance_result.nash_equilibrium,
            "monte_carlo_results": project.balance_result.monte_carlo_results,
            "machinations_results": project.balance_result.machinations_results,
            "pathologies": project.balance_result.pathologies,
            "corrections": project.balance_result.corrections,
            "situational_values": project.balance_result.situational_values,
            "full_result": project.balance_result.full_result,
        }

    # Блок 5: Прогрессия
    progression_data = None
    if project.progression:
        progression_data = {
            "total_levels": project.progression.total_levels,
            "tier_count": project.progression.tier_count,
            "curve_type": project.progression.curve_type,
            "target_duration_hours": project.progression.target_duration_hours,
            "input_data": project.progression.input_data,
            "macro_model": project.progression.macro_model,
            "tier_model": project.progression.tier_model,
            "curves": project.progression.curves,
            "content_plan": project.progression.content_plan,
            "economy_link": project.progression.economy_link,
            "validation": project.progression.validation,
            "full_profile": project.progression.full_profile,
        }

    # Блок 5: Экономика
    economy_data = None
    if project.economy:
        economy_data = {
            "system_type": project.economy.system_type,
            "resource_count": project.economy.resource_count,
            "has_pathology": project.economy.has_pathology,
            "input_data": project.economy.input_data,
            "resource_model": project.economy.resource_model,
            "machinations_model": project.economy.machinations_model,
            "conversion_chains": project.economy.conversion_chains,
            "pathologies": project.economy.pathologies,
            "corrections": project.economy.corrections,
            "simulation_results": project.economy.simulation_results,
            "monetization_model": project.economy.monetization_model,
            "full_profile": project.economy.full_profile,
        }

    # Блок 6: GDD
    gdd_data = None
    if project.gdd:
        gdd_data = {
            "format": project.gdd.format,
            "section_count": project.gdd.section_count,
            "completeness_percent": project.gdd.completeness_percent,
            "input_data": project.gdd.input_data,
            "sections": project.gdd.sections,
            "visual_elements": project.gdd.visual_elements,
            "consistency_issues": project.gdd.consistency_issues,
            "completeness_report": project.gdd.completeness_report,
            "full_profile": project.gdd.full_profile,
        }

    # Блок 6/7: Чек-листы
    checklist_data = None
    if project.checklist:
        checklist_data = {
            "overall_score": project.checklist.overall_score,
            "readiness_level": project.checklist.readiness_level,
            "critical_issue_count": project.checklist.critical_issue_count,
            "total_issue_count": project.checklist.total_issue_count,
            "input_data": project.checklist.input_data,
            "mda_check": project.checklist.mda_check,
            "balance_check": project.checklist.balance_check,
            "narrative_check": project.checklist.narrative_check,
            "economy_check": project.checklist.economy_check,
            "lens_check": project.checklist.lens_check,
            "issues": project.checklist.issues,
            "remediation_plan": project.checklist.remediation_plan,
            "full_results": project.checklist.full_results,
        }

    # ---- Сборка единого Project State ----
    project_state = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "genre": project.genre,
        "status": project.status,
        "project_stage": project.project_stage,
        "completion_percent": completion,
        "version": project.version,
        "last_algorithm_run": project.last_algorithm_run,
        "created_at": str(project.created_at) if project.created_at else None,
        "updated_at": str(project.updated_at) if project.updated_at else None,

        # Данные блоков
        "concept": concept_data,
        "core_loop": core_loop_data,
        "coreLoop": core_loop_data,  # alias для совместимости с AI-ассистентом
        "mda_profile": mda_data,
        "mda": mda_data,  # alias
        "balance_result": balance_data,
        "balance": balance_data,  # alias
        "progression_profile": progression_data,
        "progression": progression_data,  # alias
        "economy_profile": economy_data,
        "economy": economy_data,  # alias
        "gdd_profile": gdd_data,
        "gdd": gdd_data,  # alias
        "checklist_results": checklist_data,
        "checklist": checklist_data,  # alias

        # Флаги заполненности
        "block_flags": flags,

        # Мета-информация
        "blocks_available": {
            "concept": flags["has_concept"],
            "core_loop": flags["has_core_loop"],
            "mda": flags["has_mda"],
            "balance": flags["has_balance"],
            "progression": flags["has_progression"],
            "economy": flags["has_economy"],
            "gdd": flags["has_gdd"],
            "checklist": flags["has_checklist"],
        },
    }

    return project_state
