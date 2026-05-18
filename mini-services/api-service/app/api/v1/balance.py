"""
Блок 4: Баланс и симуляция — API endpoints.
Фаза 4.C.1: Полная реализация Этапов 1–3 алгоритма 3.4.

Endpoints:
- POST /transitive — transitive-анализ баланса (Этап 2)
- POST /analyze — полный анализ баланса (Этапы 1–3)
- GET /{project_id} — получить результаты балансировки для проекта
"""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.balance_service import BalanceService
from app.schemas.balance import (
    BalanceObject,
    BalanceInput,
    BalanceResult,
    TransitiveResult,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов / ответов
# ============================================================

class BalanceObjectRequest(BaseModel):
    """Игровой объект для балансировки (API-схема)."""
    id: str = Field(..., description="Уникальный идентификатор")
    name: str = Field(..., description="Название объекта")
    type: str = Field(
        ..., description="Тип: character/weapon/unit/ability/item/class",
    )
    attributes: dict[str, float] = Field(
        default_factory=dict, description="Атрибуты: HP, damage, speed, etc.",
    )
    cost: Optional[float] = Field(None, description="Стоимость")
    tier: Optional[int] = Field(None, description="Уровень/тир (1-10)")
    tags: List[str] = Field(default_factory=list, description="Теги")


class TransitiveBalanceRequest(BaseModel):
    """Входные данные для transitive-анализа (алгоритм 3.4, Этап 2)."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов для балансировки",
    )
    game_mode: str = Field("PvE", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")
    balance_type: str = Field("mixed", description="transitive/intransitive/situational/mixed")
    anchor_resource: Optional[str] = Field(None, description="Якорный ресурс")
    target_duration: Optional[float] = Field(None, description="Целевая длительность (с)")
    target_levels: Optional[int] = Field(None, description="Целевое количество уровней")


class FullBalanceRequest(BaseModel):
    """Входные данные для полного анализа баланса (алгоритм 3.4, Этапы 1–3)."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов для балансировки",
    )
    resources: List[dict] = Field(
        default_factory=list, description="Ресурсные профили",
    )
    game_mode: str = Field("PvE", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")
    balance_type: str = Field("mixed", description="transitive/intransitive/situational/mixed")
    anchor_resource: Optional[str] = Field(None, description="Якорный ресурс")
    target_duration: Optional[float] = Field(None, description="Целевая длительность (с)")
    target_levels: Optional[int] = Field(None, description="Целевое количество уровней")
    mda_profile: Optional[dict] = Field(None, description="MDA-профиль (из Блока 3)")


class TransitiveBalanceResponse(BaseModel):
    """Результат transitive-анализа."""
    attribute_weights: dict[str, float]
    cost_curve_model: str
    expected_cp: float
    objects: List[dict]
    overpowered: List[str]
    underpowered: List[str]
    balanced: List[str]
    ideal_imbalance: List[str]
    warnings: List[str]
    suggestions: List[str]


class FullBalanceResponse(BaseModel):
    """Результат полного анализа баланса."""
    id: str
    balance_map: Optional[dict] = None
    transitive_result: Optional[dict] = None
    stability: Optional[dict] = None
    stages_completed: List[int] = []
    latency_ms: int = 0
    models_used: List[str] = []
    warnings: List[str] = []
    suggestions: List[str] = []


# ============================================================
# Зависимость: получить BalanceService
# ============================================================

async def get_balance_service() -> BalanceService:
    """Создать BalanceService с настроенным PromptExecutor."""
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

    return BalanceService(executor=executor)


def _convert_objects(request_objects: List[BalanceObjectRequest]) -> list[BalanceObject]:
    """Конвертировать API-схемы во внутренние модели."""
    return [
        BalanceObject(
            id=obj.id,
            name=obj.name,
            type=obj.type,
            attributes=obj.attributes,
            cost=obj.cost,
            tier=obj.tier,
            tags=obj.tags,
        )
        for obj in request_objects
    ]


# ============================================================
# Endpoints
# ============================================================

@router.post("/transitive", response_model=TransitiveBalanceResponse)
async def transitive_balance(
    input_data: TransitiveBalanceRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Transitive-анализ баланса (алгоритм 3.4, Этап 2).

    Выполняет:
    1. Расчёт attribute_weights
    2. Расчёт power, cost, cp_ratio для каждого объекта
    3. Построение cost curve model
    4. Идентификацию overpowered/underpowered/balanced/ideal_imbalance

    Возвращает TransitiveResult с отчётами по каждому объекту.
    """
    user_id = current_user.id
    logger.info(f"Transitive balance analysis for user {user_id}")

    try:
        service = await get_balance_service()

        # Конвертируем объекты
        balance_objects = _convert_objects(input_data.objects)

        # Строим BalanceInput
        balance_input = BalanceInput(
            objects=balance_objects,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
            balance_type=input_data.balance_type,
            anchor_resource=input_data.anchor_resource,
            target_duration=input_data.target_duration,
            target_levels=input_data.target_levels,
        )

        # Сначала классифицируем задачу (нужен BalanceMap)
        balance_map = await service.classify_balance_task(
            input_data=balance_input,
        )

        # Выполняем transitive-анализ
        result = await service.transitive_balance(
            input_data=balance_input,
            balance_map=balance_map,
        )

        response = TransitiveBalanceResponse(
            attribute_weights=result.attribute_weights,
            cost_curve_model=result.cost_curve_model,
            expected_cp=result.expected_cp,
            objects=[r.model_dump() for r in result.objects],
            overpowered=result.overpowered,
            underpowered=result.underpowered,
            balanced=result.balanced,
            ideal_imbalance=result.ideal_imbalance,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in transitive balance: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in transitive balance: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in transitive balance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/analyze", response_model=FullBalanceResponse)
async def analyze_balance(
    input_data: FullBalanceRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Полный анализ баланса (алгоритм 3.4, Этапы 1–3).

    Выполняет:
    1. Классификацию задачи балансировки → BalanceMap
    2. Transitive-анализ → TransitiveResult
    3. Анализ устойчивости (Schreiber) → StabilityAssessment

    Возвращает BalanceResult с результатами всех этапов.
    """
    user_id = current_user.id
    logger.info(f"Full balance analysis for user {user_id}")

    try:
        service = await get_balance_service()

        # Конвертируем объекты
        balance_objects = _convert_objects(input_data.objects)

        # Строим BalanceInput
        balance_input = BalanceInput(
            objects=balance_objects,
            resources=input_data.resources,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
            balance_type=input_data.balance_type,
            anchor_resource=input_data.anchor_resource,
            target_duration=input_data.target_duration,
            target_levels=input_data.target_levels,
        )

        # Выполняем полный пайплайн
        result = await service.balance_full(
            input_data=balance_input,
            mda_profile=input_data.mda_profile,
        )

        # Извлекаем stability из warnings (Stage 3)
        stability = None
        if result.balance_map:
            feedback_loops = service._extract_feedback_loops(
                input_data.mda_profile, result.balance_map,
            )
            stability = service.analyze_stability(feedback_loops)

        result_id = uuid.uuid4().hex

        response = FullBalanceResponse(
            id=result_id,
            balance_map=result.balance_map.model_dump() if result.balance_map else None,
            transitive_result=result.transitive_result.model_dump() if result.transitive_result else None,
            stability=stability,
            stages_completed=result.stages_completed,
            latency_ms=result.latency_ms,
            models_used=result.models_used,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in balance analysis: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in balance analysis: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in balance analysis: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/{project_id}")
async def get_balance_result(
    project_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Получить результаты балансировки для проекта.

    Возвращает сохранённые результаты анализа баланса,
    привязанные к проекту.
    """
    try:
        # TODO: Полная реализация сохранения в БД (Фаза 4.C.2+)
        # Пока возвращаем stub
        return {
            "project_id": project_id,
            "status": "not_found",
            "message": "Сохранение результатов балансировки будет реализовано в Фазе 4.C.2",
        }
    except Exception as e:
        logger.error(f"Error fetching balance result: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения результатов балансировки")
