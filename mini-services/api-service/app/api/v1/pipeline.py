"""
Gidede — Сквозной пайплайн: API endpoints.
Фаза 4.B.12: Блок 1 → Блок 2 → Блок 3

Endpoints:
- GET /state/{project_id} — состояние пайплайна (статусы блоков, stale-уведомления)
- GET /prepare-input/{project_id}/{block_id} — подготовить входные данные для блока
- POST /notify-updated — уведомить об обновлении блока
- POST /run-pipeline/{project_id} — запустить полный пайплайн 1→2→3
- DELETE /stale/{project_id}/{block_id} — снять stale-статус с блока
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов / ответов
# ============================================================

class NotifyUpdatedRequest(BaseModel):
    """Запрос на уведомление об обновлении блока."""
    project_id: str = Field(..., description="ID проекта")
    block_id: int = Field(..., ge=1, le=8, description="Номер обновлённого блока")
    metadata: Optional[dict] = Field(None, description="Дополнительные метаданные")


class RunPipelineRequest(BaseModel):
    """Запрос на запуск полного пайплайна 1→2→3."""
    idea: str = Field(..., min_length=10, max_length=1000, description="Описание идеи игры")
    genre: Optional[str] = Field(None, description="Жанр (если указан)")
    target_audience: Optional[dict] = Field(None, description="Целевая аудитория")
    platform: Optional[List[str]] = Field(None, description="Платформы")
    constraints: Optional[dict] = Field(None, description="Ограничения")
    reference_games: Optional[List[str]] = Field(None, description="Референтные игры")
    forbidden_mechanics: Optional[List[str]] = Field(None, description="Запрещённые механики")


# ============================================================
# Зависимость: получить PipelineService
# ============================================================

async def get_pipeline_service(db: AsyncSession = Depends(get_db)):
    """Создать PipelineService с Redis-клиентом."""
    from app.services.pipeline_service import PipelineService
    from app.core.redis_client import get_redis_client

    try:
        redis_client = await get_redis_client()
    except Exception:
        redis_client = None

    return PipelineService(db=db, redis_client=redis_client)


# ============================================================
# Endpoints
# ============================================================

@router.get("/state/{project_id}")
async def get_pipeline_state(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Получить состояние пайплайна проекта.

    Возвращает:
    - Статус каждого блока (empty/in_progress/completed/stale)
    - Процент заполненности проекта
    - Уведомления об устаревших данных
    - Рекомендацию следующего блока
    """
    service = await get_pipeline_service(db)

    state = await service.get_pipeline_state(project_id, current_user.id)
    if not state:
        raise HTTPException(status_code=404, detail="Проект не найден")

    return state.to_dict()


@router.get("/prepare-input/{project_id}/{block_id}")
async def prepare_block_input(
    project_id: str,
    block_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Подготовить входные данные для блока на основе результатов предыдущих.

    Блок 2: получает OnePager + mechanicSet из Блока 1
    Блок 3: получает данные из Блоков 1 и 2
    """
    if block_id < 2 or block_id > 8:
        raise HTTPException(status_code=400, detail="Подготовка входа поддерживается для Блоков 2-8")

    service = await get_pipeline_service(db)
    result = await service.prepare_block_input(project_id, block_id)

    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])

    if result.get("status") == "missing_concept":
        raise HTTPException(
            status_code=422,
            detail=result.get("message", "Сначала заполните предыдущие блоки"),
        )

    return result


@router.post("/notify-updated")
async def notify_block_updated(
    request: NotifyUpdatedRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Уведомить об обновлении данных в блоке.

    Автоматически:
    1. Публикует событие через Redis Event Bus
    2. Помечает зависимые блоки как stale
    3. Возвращает список stale-блоков и уведомлений
    """
    service = await get_pipeline_service(db)

    result = await service.notify_block_updated(
        project_id=request.project_id,
        block_id=request.block_id,
        user_id=current_user.id,
        metadata=request.metadata,
    )

    return result


@router.post("/run-pipeline/{project_id}")
async def run_pipeline(
    project_id: str,
    request: RunPipelineRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Запустить полный пайплайн: Блок 1 → Блок 2 → Блок 3.

    Последовательно выполняет:
    1. Генерацию концепции (алгоритм 3.1)
    2. Проектирование Core Loop (алгоритм 3.2)
    3. MDA-анализ (алгоритм 3.3)

    Результаты каждого блока автоматически передаются следующему.
    """
    service = await get_pipeline_service(db)

    concept_input = {
        "idea": request.idea,
        "genre": request.genre,
        "target_audience": request.target_audience,
        "platform": request.platform,
        "constraints": request.constraints,
        "reference_games": request.reference_games,
        "forbidden_mechanics": request.forbidden_mechanics,
    }

    try:
        result = await service.run_pipeline_blocks_1_2_3(
            project_id=project_id,
            user_id=current_user.id,
            concept_input=concept_input,
        )

        return result

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен")
    except Exception as e:
        logger.error(f"Pipeline execution failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Ошибка выполнения пайплайна")


@router.delete("/stale/{project_id}/{block_id}")
async def clear_stale_status(
    project_id: str,
    block_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Снять stale-статус с блока.

    Вызывается после того, как пользователь обновил данные в блоке
    и stale-предупреждение больше неактуально.
    """
    service = await get_pipeline_service(db)

    success = await service.clear_stale_status(project_id, block_id)

    if success:
        return {"status": "ok", "project_id": project_id, "block_id": block_id}
    else:
        raise HTTPException(status_code=500, detail="Не удалось снять stale-статус")
