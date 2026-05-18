"""
Блок 5: Экономика — API endpoints.
Фаза 4.C.6: Полная реализация алгоритма 3.6 (Этапы 1–8).

Endpoints:
- POST /design — полный пайплайн экономического моделирования (алгоритм 3.6)
- POST /resources — идентификация ресурсов (Этап 1)
- POST /classify — классификация экономической системы (Этап 2)
- POST /machinations — построение Machinations-модели (Этап 3)
- POST /conversions — построение графа конверсий (Этап 4)
- POST /diagnose — диагностика патологий (Этап 5)
- POST /balance — балансировка faucet/drain (Этап 6)
- POST /simulate — симуляция экономики (Этап 7)
- GET /{project_id} — получить результаты для проекта
"""

import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Optional

from app.core.auth_middleware import get_current_user
from app.models.db import User
from app.services.economy_service import EconomyService
from app.schemas.economy import (
    EconomyProfile,
    ResourceInventory,
    EconomicClassification,
    ConversionGraph,
    EconomyDiagnostics,
    FaucetDrainBalance,
    EconomySimResult,
)
from app.schemas.balance import MachinationsGraph

logger = logging.getLogger(__name__)

router = APIRouter()


# ============================================================
# Схемы запросов
# ============================================================

class EconomyDesignRequest(BaseModel):
    """Входные данные для полного проектирования экономики (алгоритм 3.6)."""
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
    progressionProfile: Optional[dict] = Field(
        None,
        description="Профиль прогрессии (из Блока 5, алгоритм 3.5)",
    )
    monetizationType: str = Field(
        "mixed",
        description="Тип монетизации: fixed/player_driven/f2p_dual_currency/prestige/mixed",
    )
    openness: str = Field(
        "mixed",
        description="Открытость экономики: open/closed/mixed",
    )
    genre: str = Field(
        "",
        description="Жанр игры",
    )
    maxResources: int = Field(
        12,
        description="Максимум типов ресурсов",
    )
    maxConversionChains: int = Field(
        20,
        description="Максимум цепочек конверсии",
    )
    allowPlayerTrade: bool = Field(
        False,
        description="Разрешена ли торговля между игроками",
    )
    run_simulation: bool = Field(
        True,
        description="Запустить Monte Carlo-симуляцию экономики",
    )
    sim_ticks: int = Field(
        1000,
        description="Количество тиков симуляции",
    )
    sim_runs: int = Field(
        100,
        description="Количество прогонов симуляции",
    )


class EconomyDesignResponse(BaseModel):
    """Результат полного проектирования экономики."""
    id: str
    inventory: Optional[dict] = None
    classification: Optional[dict] = None
    machinations_graph: Optional[dict] = None
    conversion_graph: Optional[dict] = None
    diagnostics: Optional[dict] = None
    balance: Optional[dict] = None
    sim_result: Optional[dict] = None
    summary: str = ""
    stages_completed: list[int] = []
    latency_ms: int = 0
    models_used: list[str] = []
    warnings: list[str] = []
    suggestions: list[str] = []


class ResourceIdentifyRequest(BaseModel):
    """Входные данные для идентификации ресурсов (Этап 1)."""
    coreLoop: Optional[dict] = None
    mdaProfile: Optional[dict] = None
    genre: str = ""


class ClassifyRequest(BaseModel):
    """Входные данные для классификации экономики (Этап 2)."""
    inventory: Optional[dict] = None
    coreLoop: Optional[dict] = None
    mdaProfile: Optional[dict] = None
    genre: str = ""


# ============================================================
# Зависимость: получить EconomyService
# ============================================================

async def get_economy_service() -> EconomyService:
    """Создать EconomyService с настроенным PromptExecutor."""
    from app.ai.executor import PromptExecutor
    from app.ai.cache import PromptCache
    from app.ai.router import PromptRouter
    from app.ai.validator import PromptValidator
    from app.ai.providers.openai_provider import OpenAIProvider
    from app.ai.providers.anthropic_provider import AnthropicProvider
    from app.ai.providers.zai_provider import ZAIProvider
    from app.ai.providers.ollama_provider import OllamaProvider
    from app.core.config import settings

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

    return EconomyService(executor=executor)


# ============================================================
# Endpoints
# ============================================================

@router.post("/design", response_model=EconomyDesignResponse)
async def design_economy(
    input_data: EconomyDesignRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Полный пайплайн экономического моделирования (алгоритм 3.6, Этапы 1-8).

    Выполняет:
    1. Идентификацию ресурсов → ResourceInventory
    2. Классификацию экономической системы → EconomicClassification
    3. Построение Machinations-модели → MachinationsGraph
    4. Построение графа конверсий → ConversionGraph
    5. Диагностику патологий → EconomyDiagnostics
    6. Балансировку faucet/drain → FaucetDrainBalance
    7. Симуляцию экономики → EconomySimResult
    8. Сборку EconomyProfile

    Возвращает EconomyProfile с результатами всех этапов.
    """
    user_id = current_user.id
    logger.info(f"Economy design for user {user_id}")

    try:
        service = await get_economy_service()

        result = await service.economy_design_full(
            concept=input_data.concept,
            core_loop=input_data.coreLoop,
            mda_profile=input_data.mdaProfile,
            progression_profile=input_data.progressionProfile,
            genre=input_data.genre,
            monetization_type=input_data.monetizationType,
            openness=input_data.openness,
            max_resources=input_data.maxResources,
            max_conversion_chains=input_data.maxConversionChains,
            allow_player_trade=input_data.allowPlayerTrade,
            run_simulation=input_data.run_simulation,
            sim_ticks=input_data.sim_ticks,
            sim_runs=input_data.sim_runs,
        )

        result_id = uuid.uuid4().hex

        response = EconomyDesignResponse(
            id=result_id,
            inventory=result.inventory.model_dump() if result.inventory else None,
            classification=result.classification.model_dump() if result.classification else None,
            machinations_graph=result.machinations_graph.model_dump() if result.machinations_graph else None,
            conversion_graph=result.conversion_graph.model_dump() if result.conversion_graph else None,
            diagnostics=result.diagnostics.model_dump() if result.diagnostics else None,
            balance=result.balance.model_dump() if result.balance else None,
            sim_result=result.sim_result.model_dump() if result.sim_result else None,
            summary=result.summary,
            stages_completed=result.stages_completed,
            latency_ms=result.latency_ms,
            models_used=result.models_used,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in economy design: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in economy design: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in economy design: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/resources")
async def identify_resources(
    input_data: ResourceIdentifyRequest,
    current_user: User = Depends(get_current_user),
):
    """Идентификация ресурсов (алгоритм 3.6, Этап 1)."""
    try:
        service = await get_economy_service()
        result = await service.identify_resources(
            core_loop=input_data.coreLoop,
            mda_profile=input_data.mdaProfile,
            genre=input_data.genre,
        )
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error in resource identification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/classify")
async def classify_economy(
    input_data: ClassifyRequest,
    current_user: User = Depends(get_current_user),
):
    """Классификация экономической системы (алгоритм 3.6, Этап 2)."""
    try:
        service = await get_economy_service()

        # Если нет инвентаря — сначала идентифицируем ресурсы
        inventory = None
        if input_data.inventory:
            inventory = ResourceInventory(**input_data.inventory)

        if not inventory:
            inventory = await service.identify_resources(
                core_loop=input_data.coreLoop,
                genre=input_data.genre,
            )

        result = await service.classify_economy(
            inventory=inventory,
            core_loop=input_data.coreLoop,
            mda_profile=input_data.mdaProfile,
            genre=input_data.genre,
        )
        return result.model_dump()
    except Exception as e:
        logger.error(f"Error in economy classification: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.get("/{project_id}")
async def get_economy_result(
    project_id: str,
    current_user: User = Depends(get_current_user),
):
    """Получить результаты экономического моделирования для проекта."""
    try:
        return {
            "project_id": project_id,
            "status": "not_found",
            "message": "Сохранение результатов экономики будет реализовано в Фазе 4.C.7",
        }
    except Exception as e:
        logger.error(f"Error fetching economy result: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения результатов экономики")
