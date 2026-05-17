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
    concept = ProjectConcept(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(concept)

    core_loop = ProjectCoreLoop(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(core_loop)

    mda_profile = ProjectMDAProfile(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(mda_profile)

    balance_result = ProjectBalanceResult(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(balance_result)

    progression = ProjectProgression(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(progression)

    economy = ProjectEconomy(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(economy)

    gdd = ProjectGDD(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(gdd)

    checklist = ProjectChecklist(
        id=uuid.uuid4().hex,
        project_id=project_id,
    )
    db.add(checklist)

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
