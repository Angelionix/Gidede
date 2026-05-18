"""
Блок 5: Прогрессия — API endpoints.
Фаза 4.C.5: Полная реализация Этапов 1-4 алгоритма 3.5.

Endpoints:
- POST /macro-params — Этап 1: макро-параметры прогрессии
- POST /plan-tiers — Этап 2: разбиение на тиры
- POST /build-curves — Этап 3: кривые прогрессии
- POST /content-plan — Этап 4: контент-план
- POST /design — полный пайплайн (Этапы 1-4)
- GET /{project_id} — получить сохранённую прогрессию для проекта
"""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.progression_service import ProgressionService
from app.schemas.progression import (
    ProgressionInput,
    ProgressionConstraints,
    ProgressionMacroModel,
    TierModel,
    ProgressionCurves,
    ContentPlan,
    ProgressionProfile,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов / ответов
# ============================================================

class ProgressionConstraintsRequest(BaseModel):
    """Ограничения для проектирования прогрессии (API-схема)."""
    maxGrindTolerance: int = Field(5, description="Максимальный допустимый гринд")
    minRewardInterval: int = Field(3, description="Минимальный интервал между наградами")
    flowTarget: str = Field("balanced", description="Целевой поток: relaxed/balanced/intense")
    contentBudget: str = Field("medium", description="Бюджет контента: low/medium/high")


class ProgressionDesignRequest(BaseModel):
    """Входные данные для проектирования прогрессии (алгоритм 3.5)."""
    concept: dict = Field(
        default_factory=dict,
        description="Концепт игры (из Блока 1)",
    )
    coreLoop: Optional[dict] = Field(
        None,
        description="Профиль Core Loop (из Блока 2)",
    )
    mdaProfile: Optional[dict] = Field(
        None,
        description="MDA-профиль (из Блока 3)",
    )
    balanceResult: Optional[dict] = Field(
        None,
        description="Результат балансировки (из Блока 4)",
    )
    targetDuration: Optional[int] = Field(
        None,
        description="Целевая длительность (часы)",
    )
    targetLevels: Optional[int] = Field(
        None,
        description="Целевое количество уровней",
    )
    progressionType: Optional[str] = Field(
        None,
        description="Тип прогрессии: linear/exponential/s_curve/diminishing/intermittent",
    )
    monetizationModel: str = Field(
        "premium",
        description="Модель монетизации: premium/freemium/p2w/cosmetic/subscription",
    )
    constraints: ProgressionConstraintsRequest = Field(
        default_factory=ProgressionConstraintsRequest,
        description="Ограничения прогрессии",
    )


class MacroParamsRequest(BaseModel):
    """Входные данные для Этапа 1 (макро-параметры)."""
    concept: dict = Field(default_factory=dict, description="Концепт игры")
    coreLoop: Optional[dict] = Field(None, description="Профиль Core Loop")
    mdaProfile: Optional[dict] = Field(None, description="MDA-профиль")
    targetDuration: Optional[int] = Field(None, description="Целевая длительность (часы)")
    targetLevels: Optional[int] = Field(None, description="Целевое количество уровней")
    progressionType: Optional[str] = Field(None, description="Тип прогрессии")
    monetizationModel: str = Field("premium", description="Модель монетизации")
    constraints: ProgressionConstraintsRequest = Field(
        default_factory=ProgressionConstraintsRequest,
        description="Ограничения прогрессии",
    )


class TierPlanRequest(BaseModel):
    """Входные данные для Этапа 2 (разбиение на тиры)."""
    macro_model: dict = Field(..., description="Макро-параметры (из Этапа 1)")
    coreLoop: Optional[dict] = Field(None, description="Профиль Core Loop")


class BuildCurvesRequest(BaseModel):
    """Входные данные для Этапа 3 (кривые прогрессии)."""
    macro_model: dict = Field(..., description="Макро-параметры (из Этапа 1)")
    tier_model: dict = Field(..., description="Модель тиров (из Этапа 2)")
    coreLoop: Optional[dict] = Field(None, description="Профиль Core Loop")
    mdaProfile: Optional[dict] = Field(None, description="MDA-профиль")


class ContentPlanRequest(BaseModel):
    """Входные данные для Этапа 4 (контент-план)."""
    macro_model: dict = Field(..., description="Макро-параметры (из Этапа 1)")
    tier_model: dict = Field(..., description="Модель тиров (из Этапа 2)")
    curves: dict = Field(..., description="Кривые прогрессии (из Этапа 3)")
    mdaProfile: Optional[dict] = Field(None, description="MDA-профиль")
    coreLoop: Optional[dict] = Field(None, description="Профиль Core Loop")


class ProgressionDesignResponse(BaseModel):
    """Результат полного проектирования прогрессии."""
    id: str = ""
    macroModel: Optional[dict] = None
    tierModel: Optional[dict] = None
    curves: Optional[dict] = None
    contentPlan: Optional[dict] = None
    validation: Optional[dict] = None
    totalLevels: int = 0
    totalDuration: int = 0
    progressionType: str = "linear"
    emergenceRatio: float = 0.0
    lockKeyModel: str = "linear"
    summary: str = ""
    economyInput: Optional[dict] = None
    stages_completed: list[int] = []
    latency_ms: int = 0
    models_used: list[str] = []
    warnings: list[str] = []
    suggestions: list[str] = []


# ============================================================
# Зависимость: получить ProgressionService
# ============================================================

async def get_progression_service() -> ProgressionService:
    """Создать ProgressionService с настроенным PromptExecutor."""
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

    return ProgressionService(executor=executor)


def _build_progression_input(request: ProgressionDesignRequest) -> ProgressionInput:
    """Собрать ProgressionInput из запроса."""
    return ProgressionInput(
        concept=request.concept,
        coreLoop=request.coreLoop,
        mdaProfile=request.mdaProfile,
        balanceResult=request.balanceResult,
        targetDuration=request.targetDuration,
        targetLevels=request.targetLevels,
        progressionType=request.progressionType,
        monetizationModel=request.monetizationModel,
        constraints=ProgressionConstraints(
            maxGrindTolerance=request.constraints.maxGrindTolerance,
            minRewardInterval=request.constraints.minRewardInterval,
            flowTarget=request.constraints.flowTarget,
            contentBudget=request.constraints.contentBudget,
        ),
    )


# ============================================================
# Endpoints
# ============================================================

@router.post("/macro-params")
async def calculate_macro_params(
    input_data: MacroParamsRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 1: Макро-параметры прогрессии (алгоритм 3.5.1).

    Выполняет:
    1. Определение целевой длительности по жанру
    2. Расчёт количества уровней (pacing × duration)
    3. Определение типа прогрессии
    4. Расчёт требований к контенту
    5. Оценку emergence ratio
    6. Определение модели замок-ключ

    Возвращает ProgressionMacroModel.
    """
    user_id = current_user.id
    logger.info(f"Macro params calculation for user {user_id}")

    try:
        service = await get_progression_service()

        progression_input = ProgressionInput(
            concept=input_data.concept,
            coreLoop=input_data.coreLoop,
            mdaProfile=input_data.mdaProfile,
            targetDuration=input_data.targetDuration,
            targetLevels=input_data.targetLevels,
            progressionType=input_data.progressionType,
            monetizationModel=input_data.monetizationModel,
            constraints=ProgressionConstraints(
                maxGrindTolerance=input_data.constraints.maxGrindTolerance,
                minRewardInterval=input_data.constraints.minRewardInterval,
                flowTarget=input_data.constraints.flowTarget,
                contentBudget=input_data.constraints.contentBudget,
            ),
        )

        result = await service.calculate_macro_params(progression_input)

        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in macro params: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in macro params: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in macro params: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/plan-tiers")
async def plan_tiers(
    input_data: TierPlanRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 2: Разбиение на тиры (алгоритм 3.5.2).

    Выполняет:
    1. Расчёт num_tiers (min 2, max 5)
    2. Неравномерное распределение уровней
    3. Характеристику каждого тира (D&D-модель)
    4. Построение карты переходов

    Возвращает TierModel.
    """
    user_id = current_user.id
    logger.info(f"Tier planning for user {user_id}")

    try:
        service = await get_progression_service()

        macro_model = ProgressionMacroModel(**input_data.macro_model)

        result = await service.plan_tiers(macro_model, input_data.coreLoop)

        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in tier planning: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in tier planning: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in tier planning: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/build-curves")
async def build_curves(
    input_data: BuildCurvesRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 3: Кривые прогрессии (алгоритм 3.5.3).

    Выполняет:
    1. XP → Level кривую
    2. Level → Power кривую
    3. Level → Cost кривую
    4. Difficulty кривую (Schreiber)
    5. Проверку консистентности

    Возвращает ProgressionCurves.
    """
    user_id = current_user.id
    logger.info(f"Curve building for user {user_id}")

    try:
        service = await get_progression_service()

        macro_model = ProgressionMacroModel(**input_data.macro_model)
        tier_model = TierModel(**input_data.tier_model)

        result = await service.build_curves(
            macro_model, tier_model,
            core_loop_profile=input_data.coreLoop,
            mda_profile=input_data.mdaProfile,
        )

        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in curve building: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in curve building: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in curve building: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/content-plan")
async def generate_content_plan(
    input_data: ContentPlanRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Этап 4: Контент-план (алгоритм 3.5.4).

    Выполняет:
    1. Контент-требования по тирам
    2. Дерево разблокировок
    3. Таблицу воспринимаемой сложности
    4. Общие требования к контенту

    Возвращает ContentPlan.
    """
    user_id = current_user.id
    logger.info(f"Content plan generation for user {user_id}")

    try:
        service = await get_progression_service()

        macro_model = ProgressionMacroModel(**input_data.macro_model)
        tier_model = TierModel(**input_data.tier_model)
        curves = ProgressionCurves(**input_data.curves)

        result = await service.generate_content_plan(
            macro_model, tier_model, curves,
            mda_profile=input_data.mdaProfile,
            core_loop_profile=input_data.coreLoop,
        )

        return result.model_dump()

    except ValueError as e:
        logger.error(f"Validation error in content plan: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in content plan: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in content plan: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/design", response_model=ProgressionDesignResponse)
async def design_progression(
    input_data: ProgressionDesignRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Полный пайплайн проектирования прогрессии (алгоритм 3.5, Этапы 1-4).

    Выполняет:
    1. Макро-параметры → ProgressionMacroModel
    2. Разбиение на тиры → TierModel
    3. Кривые прогрессии → ProgressionCurves
    4. Контент-план → ContentPlan
    5. Валидацию (grind, wall, empty level checks)

    Возвращает ProgressionProfile с результатами всех этапов.
    """
    user_id = current_user.id
    logger.info(f"Full progression design for user {user_id}")

    try:
        service = await get_progression_service()

        progression_input = _build_progression_input(input_data)

        result = await service.progression_design_full(progression_input)

        result_id = uuid.uuid4().hex

        response = ProgressionDesignResponse(
            id=result_id,
            macroModel=result.macroModel.model_dump(),
            tierModel=result.tierModel.model_dump(),
            curves=result.curves.model_dump(),
            contentPlan=result.contentPlan.model_dump(),
            validation=result.validation.model_dump(),
            totalLevels=result.totalLevels,
            totalDuration=result.totalDuration,
            progressionType=result.progressionType,
            emergenceRatio=result.emergenceRatio,
            lockKeyModel=result.lockKeyModel,
            summary=result.summary,
            economyInput=result.economyInput,
            stages_completed=result.stages_completed,
            latency_ms=result.latency_ms,
            models_used=result.models_used,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in progression design: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in progression design: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in progression design: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/{project_id}")
async def get_progression_result(
    project_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Получить результаты прогрессии для проекта.

    Возвращает сохранённые результаты проектирования прогрессии,
    привязанные к проекту.
    """
    try:
        # TODO: Полная реализация сохранения в БД (Фаза 4.C.5+)
        # Пока возвращаем stub
        return {
            "project_id": project_id,
            "status": "not_found",
            "message": "Сохранение результатов прогрессии будет реализовано в следующей итерации",
        }
    except Exception as e:
        logger.error(f"Error fetching progression result: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения результатов прогрессии")
