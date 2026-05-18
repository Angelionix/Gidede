"""
Блок 2: Core Loop Designer — API endpoints.
Фаза 4.B.6: Полная реализация Этапов 1–3 алгоритма 3.2.

Endpoints:
- POST /design — проектирование Core Loop (Этапы 1–3)
"""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.coreloop_service import CoreLoopService

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов / ответов
# ============================================================

class CoreLoopInput(BaseModel):
    """Входные данные для Core Loop Designer (алгоритм 3.2.2)."""
    concept_id: str = Field(
        ..., description="ID концепции из Блока 1",
    )
    mechanics: List[str] = Field(
        default_factory=list,
        description="Список выбранных механик из MechanicsDB",
    )
    genre: str = Field(
        "rpg",
        description="Жанр игры",
    )
    desired_loop_type: Optional[str] = Field(
        None,
        description="Желаемый тип петли: engine/economy/ecology/hybrid",
    )
    custom_steps: Optional[List[str]] = Field(
        None,
        description="Пользовательские шаги Core Loop",
    )
    concept_data: Optional[dict] = Field(
        None,
        description="Данные концепции из Блока 1",
    )


class CoreLoopProfileResponse(BaseModel):
    """Результат проектирования Core Loop — Этапы 1–3."""
    id: str
    structural_type: dict
    steps: List[dict]
    inner_loops: List[dict]
    outer_loops: List[dict]
    meta_loop: Optional[dict]
    pathologies: dict
    recommendations: List[dict]
    loop_hierarchy: Optional[dict]
    stages_completed: List[int] = [1, 2, 3]
    latency_ms: int = 0
    models_used: List[str] = []


# ============================================================
# Зависимость: получить CoreLoopService
# ============================================================

async def get_coreloop_service() -> CoreLoopService:
    """Создать CoreLoopService с настроенным PromptExecutor."""
    from app.ai.executor import PromptExecutor
    from app.ai.cache import PromptCache
    from app.ai.router import PromptRouter
    from app.ai.validator import PromptValidator
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.core.config import settings

    # Инициализация провайдеров
    providers = []

    try:
        if settings.OPENAI_API_KEY:
            providers.append(OpenAIProvider(api_key=settings.OPENAI_API_KEY))
    except Exception:
        pass

    try:
        if settings.ANTHROPIC_API_KEY:
            providers.append(AnthropicProvider(api_key=settings.ANTHROPIC_API_KEY))
    except Exception:
        pass

    try:
        providers.append(ZAIProvider())
    except Exception:
        pass

    try:
        if settings.OLLAMA_BASE_URL:
            providers.append(OllamaProvider(base_url=settings.OLLAMA_BASE_URL))
    except Exception:
        pass

    if not providers:
        # Минимальный fallback — z.ai всегда доступен
        try:
            providers.append(ZAIProvider())
        except Exception as e:
            logger.error(f"No AI providers available: {e}")

    cache = PromptCache()
    router_instance = PromptRouter(providers=providers)
    validator = PromptValidator()
    executor = PromptExecutor(
        providers=providers,
        router=router_instance,
        cache=cache,
        validator=validator,
    )

    return CoreLoopService(executor=executor)


# ============================================================
# Endpoints
# ============================================================

@router.post("/design", response_model=CoreLoopProfileResponse)
async def design_core_loop(
    input_data: CoreLoopInput,
    current_user: User = Depends(get_current_user),
):
    """
    Проектирование Core Loop. Алгоритм 3.2: 3 этапа.

    1. Классификация структурного типа (3.2.3)
    2. Конструирование иерархии петель (3.2.4)
    3. Диагностика патологий (3.2.5)

    Принимает данные концепции из Блока 1 (concept_id + mechanics)
    и возвращает полный CoreLoopProfile.
    """
    user_id = current_user.id
    logger.info(f"Designing Core Loop for user {user_id}, concept {input_data.concept_id}")

    try:
        service = await get_coreloop_service()

        # Если механики не переданы — пытаемся загрузить из концепции
        mechanics = input_data.mechanics
        concept_data = input_data.concept_data

        if not mechanics or concept_data is None:
            # Пробуем загрузить концепцию из БД
            try:
                from app.core.database import async_session
                from app.models.db import ProjectConcept
                from sqlalchemy import select

                async with async_session() as session:
                    stmt = select(ProjectConcept).where(
                        ProjectConcept.id == input_data.concept_id
                    )
                    db_result = await session.execute(stmt)
                    concept = db_result.scalar_one_or_none()

                    if concept:
                        concept_data = {
                            "genre": concept.genre or input_data.genre,
                            "aesthetic_profile": concept.aesthetic_profile or {},
                            "dynamics_profile": concept.dynamics_profile or {},
                            "mechanic_set": concept.mechanic_set or {},
                        }

                        # Извлекаем механики из mechanic_set
                        if not mechanics and concept.mechanic_set:
                            mech_set = concept.mechanic_set
                            for category in ["base", "combat", "progression", "spatial", "social"]:
                                cat_mechanics = mech_set.get(category, [])
                                for m in cat_mechanics:
                                    name = m.get("name", "") if isinstance(m, dict) else str(m)
                                    if name and name not in mechanics:
                                        mechanics.append(name)
            except Exception as e:
                logger.warning(f"Could not load concept from DB: {e}")

        # Если механик всё ещё нет — используем базовые
        if not mechanics:
            mechanics = ["Враги", "Здоровье", "Очки опыта", "Уровни"]
            logger.info("Using default mechanics as fallback")

        # Определяем жанр
        genre = input_data.genre
        if concept_data and concept_data.get("genre"):
            genre = concept_data["genre"]

        # Выполняем полный пайплайн Этапы 1–3
        profile = await service.design_full(
            mechanics=mechanics,
            concept_data=concept_data,
            genre=genre,
            desired_loop_type=input_data.desired_loop_type,
            custom_steps=input_data.custom_steps,
            project_state=None,
        )

        # Формируем ответ
        result_id = uuid.uuid4().hex
        structural_type_dict = profile.structural_type.model_dump() if profile.structural_type else {}
        pathologies_dict = profile.pathologies.model_dump() if profile.pathologies else {}
        hierarchy_dict = profile.loop_hierarchy.model_dump() if profile.loop_hierarchy else None

        response = CoreLoopProfileResponse(
            id=result_id,
            structural_type=structural_type_dict,
            steps=[s.model_dump() for s in profile.steps],
            inner_loops=profile.inner_loops,
            outer_loops=profile.outer_loops,
            meta_loop=profile.meta_loop,
            pathologies=pathologies_dict,
            recommendations=profile.recommendations,
            loop_hierarchy=hierarchy_dict,
            stages_completed=[1, 2, 3],
            latency_ms=0,
            models_used=["DECOMPOSE_STEP", "GENERATE_OUTER_LOOPS", "GENERATE_META_LOOP", "GENERATE_RECOMMENDATIONS"],
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in Core Loop design: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in Core Loop design: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in Core Loop design: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")
