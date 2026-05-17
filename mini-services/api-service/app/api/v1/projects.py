"""
Gidede — API эндпоинты управления проектами
Фаза 4.A.6: CRUD для проектов (Project State)

Эндпоинты:
- POST /projects/ — создание проекта
- GET /projects/ — список проектов пользователя (пагинация, поиск)
- GET /projects/:id — получение проекта с данными блоков
- PUT /projects/:id — обновление проекта
- DELETE /projects/:id — удаление проекта
"""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth_middleware import get_current_active_user
from app.models.db import User
from app.schemas.project import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse,
    ProjectDetailResponse,
)
from app.services.project_service import (
    create_project, get_project, get_project_with_blocks,
    update_project, delete_project, list_projects,
    compute_block_flags, compute_completion_percent,
)

router = APIRouter()


@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_new_project(
    data: ProjectCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Создание нового проекта.
    Автоматически создаёт пустой Project State со всеми блоками.
    """
    project = await create_project(db, current_user.id, data)
    await db.flush()

    # Вычисляем флаги для ответа
    flags = compute_block_flags(project)
    response = ProjectResponse.model_validate(project)
    response.has_concept = flags["has_concept"]
    response.has_core_loop = flags["has_core_loop"]
    response.has_mda = flags["has_mda"]
    response.has_balance = flags["has_balance"]
    response.has_progression = flags["has_progression"]
    response.has_economy = flags["has_economy"]
    response.has_gdd = flags["has_gdd"]
    response.has_checklist = flags["has_checklist"]
    return response


@router.get("/", response_model=ProjectListResponse)
async def list_user_projects(
    page: int = Query(1, ge=1, description="Номер страницы"),
    per_page: int = Query(20, ge=1, le=100, description="Количество на странице"),
    search: str | None = Query(None, description="Поиск по названию/описанию"),
    status: str | None = Query(None, description="Фильтр по статусу"),
    genre: str | None = Query(None, description="Фильтр по жанру"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Получение списка проектов пользователя.
    Поддерживает пагинацию, поиск по назвению/описанию, фильтрацию по статусу и жанру.
    """
    projects, total = await list_projects(
        db,
        user_id=current_user.id,
        page=page,
        per_page=per_page,
        search=search,
        status=status,
        genre=genre,
    )

    project_responses = []
    for p in projects:
        flags = compute_block_flags(p)
        resp = ProjectResponse.model_validate(p)
        resp.has_concept = flags["has_concept"]
        resp.has_core_loop = flags["has_core_loop"]
        resp.has_mda = flags["has_mda"]
        resp.has_balance = flags["has_balance"]
        resp.has_progression = flags["has_progression"]
        resp.has_economy = flags["has_economy"]
        resp.has_gdd = flags["has_gdd"]
        resp.has_checklist = flags["has_checklist"]
        resp.completion_percent = compute_completion_percent(flags)
        project_responses.append(resp)

    return ProjectListResponse(
        projects=project_responses,
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project_detail(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Получение детальной информации о проекте с данными всех блоков.
    """
    project = await get_project_with_blocks(db, project_id, current_user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )

    flags = compute_block_flags(project)
    response = ProjectDetailResponse.model_validate(project)
    response.has_concept = flags["has_concept"]
    response.has_core_loop = flags["has_core_loop"]
    response.has_mda = flags["has_mda"]
    response.has_balance = flags["has_balance"]
    response.has_progression = flags["has_progression"]
    response.has_economy = flags["has_economy"]
    response.has_gdd = flags["has_gdd"]
    response.has_checklist = flags["has_checklist"]
    response.completion_percent = compute_completion_percent(flags)
    return response


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_existing_project(
    project_id: str,
    data: ProjectUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Обновление данных проекта."""
    project = await get_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )

    project = await update_project(db, project, data)
    flags = compute_block_flags(project)
    response = ProjectResponse.model_validate(project)
    response.has_concept = flags["has_concept"]
    response.has_core_loop = flags["has_core_loop"]
    response.has_mda = flags["has_mda"]
    response.has_balance = flags["has_balance"]
    response.has_progression = flags["has_progression"]
    response.has_economy = flags["has_economy"]
    response.has_gdd = flags["has_gdd"]
    response.has_checklist = flags["has_checklist"]
    return response


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_project(
    project_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Удаление проекта.
    Все связанные данные блоков удаляются каскадно.
    """
    project = await get_project(db, project_id, current_user.id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Проект не найден",
        )

    await delete_project(db, project)
