"""
Блок 4: Баланс и симуляция — API endpoints.
Фаза 4.C.1–4.C.3: Полная реализация Этапов 1–5 + Q-фактор + симуляции алгоритма 3.4.

Endpoints:
- POST /transitive — transitive-анализ баланса (Этап 2)
- POST /intransitive — нетранзитивный анализ (Этап 3)
- POST /situational — ситуационный анализ (Этап 4)
- POST /qfactor — Q-фактор анализ
- POST /monte-carlo — Monte Carlo-симуляция баланса (алгоритм 3.4.9, 4.C.3)
- POST /machinations — Machinations-симуляция экономики (алгоритм 3.6, 4.C.3)
- POST /analyze — полный анализ баланса (Этапы 1–5 + Q-фактор + симуляции)
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
    IntransitiveResult,
    SituationalResult,
    QFactorResult,
    SimulationConfig,
    MonteCarloResult,
    MachinationsGraph,
    MachinationsSimConfig,
    MachinationsSimResult,
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


class IntransitiveBalanceRequest(BaseModel):
    """Входные данные для нетранзитивного анализа (алгоритм 3.4, Этап 3)."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов для анализа",
    )
    game_mode: str = Field("PvP", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")
    balance_type: str = Field("mixed", description="transitive/intransitive/situational/mixed")
    anchor_resource: Optional[str] = Field(None, description="Якорный ресурс")


class SituationalBalanceRequest(BaseModel):
    """Входные данные для ситуационного анализа (алгоритм 3.4, Этап 4)."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов для анализа",
    )
    game_mode: str = Field("PvE", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")
    balance_type: str = Field("mixed", description="transitive/intransitive/situational/mixed")
    anchor_resource: Optional[str] = Field(None, description="Якорный ресурс")


class QFactorRequest(BaseModel):
    """Входные данные для Q-фактор анализа."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов для анализа",
    )
    game_mode: str = Field("PvE", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")


class MonteCarloRequest(BaseModel):
    """Входные данные для Monte Carlo-симуляции."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов для симуляции",
    )
    game_mode: str = Field("PvP", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")
    num_iterations: int = Field(10000, description="Количество итераций")
    random_seed: int = Field(42, description="Seed для воспроизводимости")
    matchup_format: str = Field("1v1", description="1v1/team")


class MachinationsRequest(BaseModel):
    """Входные данные для Machinations-симуляции."""
    objects: List[BalanceObjectRequest] = Field(
        ..., description="Список объектов",
    )
    resources: List[dict] = Field(
        default_factory=list, description="Ресурсные профили",
    )
    game_mode: str = Field("PvE", description="PvP/PvE/PvPvE")
    genre: str = Field("", description="Жанр игры")
    ticks: int = Field(1000, description="Количество тиков симуляции")
    num_runs: int = Field(100, description="Количество прогонов")
    recording_interval: int = Field(100, description="Интервал записи снепшота")


class MonteCarloResponse(BaseModel):
    """Результат Monte Carlo-симуляции."""
    config: dict
    win_rates: dict[str, float]
    avg_duration: dict[str, float]
    matchup_matrix: dict[str, dict[str, dict]]
    win_rate_spread: float
    ranking_correlation: float
    balance_verdict: str
    warnings: List[str]
    suggestions: List[str]


class MachinationsResponse(BaseModel):
    """Результат Machinations-симуляции."""
    graph: Optional[dict] = None
    runs: int = 0
    aggregated: Optional[dict] = None
    quality: Optional[dict] = None
    detected_pathologies: List[str] = []
    recommendations: List[str] = []


class FullBalanceRequest(BaseModel):
    """Входные данные для полного анализа баланса (алгоритм 3.4, Этапы 1–5 + Q)."""
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
    run_intransitive: bool = Field(True, description="Запустить нетранзитивный анализ")
    run_situational: bool = Field(True, description="Запустить ситуационный анализ")
    run_q_factor: bool = Field(True, description="Запустить Q-фактор анализ")
    run_monte_carlo: bool = Field(True, description="Запустить Monte Carlo-симуляцию")
    run_machinations: bool = Field(True, description="Запустить Machinations-симуляцию")


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


class IntransitiveBalanceResponse(BaseModel):
    """Результат нетранзитивного анализа."""
    payoff_matrix: List[List[float]]
    object_names: List[str]
    nash_equilibrium: List[float]
    is_intransitive: bool
    dominated_strategies: List[int]
    strategy_balance: Optional[dict] = None
    rps_cycles: List[dict]
    has_dominant_strategy: bool
    warnings: List[str]
    suggestions: List[str]


class SituationalBalanceResponse(BaseModel):
    """Результат ситуационного анализа."""
    situations: List[dict]
    situational_values: List[List[float]]
    object_names: List[str]
    situational_ev: List[float]
    versatility_map: List[dict]
    dead_zones: List[str]
    dominant_universals: List[str]
    switching_cost: str
    warnings: List[str]
    suggestions: List[str]


class QFactorResponse(BaseModel):
    """Результат Q-фактор анализа."""
    objects: List[dict]
    redundant_objects: List[str]
    attribute_dominance: dict[str, str]
    warnings: List[str]
    suggestions: List[str]


class FullBalanceResponse(BaseModel):
    """Результат полного анализа баланса."""
    id: str
    balance_map: Optional[dict] = None
    transitive_result: Optional[dict] = None
    intransitive_result: Optional[dict] = None
    situational_result: Optional[dict] = None
    q_factor_result: Optional[dict] = None
    stability: Optional[dict] = None
    monte_carlo_result: Optional[dict] = None
    machinations_result: Optional[dict] = None
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


def _build_balance_input(request_objects: List[BalanceObjectRequest], **kwargs) -> BalanceInput:
    """Собрать BalanceInput из запроса."""
    return BalanceInput(
        objects=_convert_objects(request_objects),
        **{k: v for k, v in kwargs.items() if v is not None},
    )


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

        balance_input = _build_balance_input(
            input_data.objects,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
            balance_type=input_data.balance_type,
            anchor_resource=input_data.anchor_resource,
            target_duration=input_data.target_duration,
            target_levels=input_data.target_levels,
        )

        # Сначала классифицируем задачу
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


@router.post("/intransitive", response_model=IntransitiveBalanceResponse)
async def intransitive_balance(
    input_data: IntransitiveBalanceRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Нетранзитивный анализ баланса (алгоритм 3.4, Этап 3).

    Выполняет:
    1. Построение payoff-матрицы
    2. Поиск RPS-циклов (нетранзитивных отношений)
    3. Расчёт равновесия Нэша
    4. Анализ распределения стратегий
    5. Обнаружение доминантных стратегий

    Возвращает IntransitiveResult с payoff-матрицей и анализом.
    """
    user_id = current_user.id
    logger.info(f"Intransitive balance analysis for user {user_id}")

    try:
        service = await get_balance_service()

        balance_input = _build_balance_input(
            input_data.objects,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
            balance_type=input_data.balance_type,
            anchor_resource=input_data.anchor_resource,
        )

        # Классификация + transitive (необходимы для intransitive)
        balance_map = await service.classify_balance_task(input_data=balance_input)
        transitive_result = await service.transitive_balance(
            input_data=balance_input, balance_map=balance_map,
        )

        # Нетранзитивный анализ
        result = await service.intransitive_balance(
            input_data=balance_input,
            transitive_result=transitive_result,
            balance_map=balance_map,
        )

        response = IntransitiveBalanceResponse(
            payoff_matrix=result.payoff_matrix,
            object_names=result.object_names,
            nash_equilibrium=result.nash_equilibrium,
            is_intransitive=result.is_intransitive,
            dominated_strategies=result.dominated_strategies,
            strategy_balance=result.strategy_balance.model_dump() if result.strategy_balance else None,
            rps_cycles=[c.model_dump() for c in result.rps_cycles],
            has_dominant_strategy=result.has_dominant_strategy,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in intransitive balance: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in intransitive balance: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in intransitive balance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/situational", response_model=SituationalBalanceResponse)
async def situational_balance(
    input_data: SituationalBalanceRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Ситуационный анализ баланса (алгоритм 3.4, Этап 4).

    Выполняет:
    1. Определение игровых ситуаций
    2. Оценку ценности каждого объекта в каждой ситуации
    3. Расчёт ожидаемой ситуационной ценности (EV)
    4. Анализ универсальности vs специализации

    Возвращает SituationalResult с матрицей ценности и анализом.
    """
    user_id = current_user.id
    logger.info(f"Situational balance analysis for user {user_id}")

    try:
        service = await get_balance_service()

        balance_input = _build_balance_input(
            input_data.objects,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
            balance_type=input_data.balance_type,
            anchor_resource=input_data.anchor_resource,
        )

        # Классификация + transitive
        balance_map = await service.classify_balance_task(input_data=balance_input)
        transitive_result = await service.transitive_balance(
            input_data=balance_input, balance_map=balance_map,
        )

        # Ситуационный анализ
        result = await service.situational_balance(
            input_data=balance_input,
            transitive_result=transitive_result,
            balance_map=balance_map,
        )

        response = SituationalBalanceResponse(
            situations=[s.model_dump() for s in result.situations],
            situational_values=result.situational_values,
            object_names=result.object_names,
            situational_ev=result.situational_ev,
            versatility_map=[v.model_dump() for v in result.versatility_map],
            dead_zones=result.dead_zones,
            dominant_universals=result.dominant_universals,
            switching_cost=result.switching_cost,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in situational balance: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        logger.error(f"Runtime error in situational balance: {e}")
        raise HTTPException(status_code=503, detail="AI-сервис временно недоступен. Попробуйте позже.")
    except Exception as e:
        logger.error(f"Unexpected error in situational balance: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/qfactor", response_model=QFactorResponse)
async def q_factor_analysis(
    input_data: QFactorRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Q-фактор анализ (Роллингс/Моррис, Кн. 12).

    Выполняет:
    1. Построение Q-матрицы (нормализованные значения 0-1)
    2. Определение доминантных атрибутов
    3. Выявление избыточных объектов

    Возвращает QFactorResult с анализом избыточности.
    """
    user_id = current_user.id
    logger.info(f"Q-factor analysis for user {user_id}")

    try:
        service = await get_balance_service()

        balance_input = _build_balance_input(
            input_data.objects,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
        )

        # Transitive нужен для weights
        balance_map = await service.classify_balance_task(input_data=balance_input)
        transitive_result = await service.transitive_balance(
            input_data=balance_input, balance_map=balance_map,
        )

        # Q-фактор
        result = service.calculate_q_factor(
            input_data=balance_input,
            transitive_result=transitive_result,
        )

        response = QFactorResponse(
            objects=[o.model_dump() for o in result.objects],
            redundant_objects=result.redundant_objects,
            attribute_dominance=result.attribute_dominance,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in Q-factor: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in Q-factor: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/analyze", response_model=FullBalanceResponse)
async def analyze_balance(
    input_data: FullBalanceRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Полный анализ баланса (алгоритм 3.4, Этапы 1–5 + Q-фактор).

    Выполняет:
    1. Классификацию задачи балансировки → BalanceMap
    2. Transitive-анализ → TransitiveResult
    3. Анализ устойчивости (Schreiber)
    4. Нетранзитивный анализ → IntransitiveResult
    5. Ситуационный анализ → SituationalResult
    Q. Q-фактор анализ → QFactorResult

    Возвращает BalanceResult с результатами всех этапов.
    """
    user_id = current_user.id
    logger.info(f"Full balance analysis for user {user_id}")

    try:
        service = await get_balance_service()

        balance_input = BalanceInput(
            objects=_convert_objects(input_data.objects),
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
            run_intransitive=input_data.run_intransitive,
            run_situational=input_data.run_situational,
            run_q_factor=input_data.run_q_factor,
            run_monte_carlo=input_data.run_monte_carlo,
            run_machinations=input_data.run_machinations,
        )

        result_id = uuid.uuid4().hex

        response = FullBalanceResponse(
            id=result_id,
            balance_map=result.balance_map.model_dump() if result.balance_map else None,
            transitive_result=result.transitive_result.model_dump() if result.transitive_result else None,
            intransitive_result=result.intransitive_result.model_dump() if result.intransitive_result else None,
            situational_result=result.situational_result.model_dump() if result.situational_result else None,
            q_factor_result=result.q_factor_result.model_dump() if result.q_factor_result else None,
            stability=result.stability.model_dump() if result.stability else None,
            monte_carlo_result=result.monte_carlo_result.model_dump() if result.monte_carlo_result else None,
            machinations_result=result.machinations_result.model_dump() if result.machinations_result else None,
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


@router.post("/monte-carlo", response_model=MonteCarloResponse)
async def monte_carlo_simulation(
    input_data: MonteCarloRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Monte Carlo-симуляция баланса (алгоритм 3.4.9, 4.C.3).

    Выполняет:
    1. Моделирование N боёв со стохастическими параметрами
    2. Агрегацию win rate, средней длительности, парных сравнений
    3. Сравнение с формальным ранжированием (корреляция Спирмена)
    4. Оценку эмоционального восприятия чисел

    Возвращает MonteCarloResult с вердиктом GOOD/MODERATE/POOR.
    """
    user_id = current_user.id
    logger.info(f"Monte Carlo simulation for user {user_id}")

    try:
        service = await get_balance_service()

        balance_input = _build_balance_input(
            input_data.objects,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
        )

        # Сначала нужен transitive-анализ для формального ранжирования
        balance_map = await service.classify_balance_task(input_data=balance_input)
        transitive_result = await service.transitive_balance(
            input_data=balance_input, balance_map=balance_map,
        )

        sim_config = SimulationConfig(
            num_iterations=input_data.num_iterations,
            matchup_format=input_data.matchup_format,
            random_seed=input_data.random_seed,
        )

        result = await service.monte_carlo_simulate(
            input_data=balance_input,
            transitive_result=transitive_result,
            balance_map=balance_map,
            config=sim_config,
        )

        response = MonteCarloResponse(
            config=result.config.model_dump(),
            win_rates=result.win_rates,
            avg_duration=result.avg_duration,
            matchup_matrix=result.matchup_matrix,
            win_rate_spread=result.win_rate_spread,
            ranking_correlation=result.ranking_correlation,
            balance_verdict=result.balance_verdict,
            warnings=result.warnings,
            suggestions=result.suggestions,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in Monte Carlo: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in Monte Carlo: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Внутренняя ошибка сервера")


@router.post("/machinations", response_model=MachinationsResponse)
async def machinations_simulation(
    input_data: MachinationsRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Machinations-симуляция экономики (алгоритм 3.6, 4.C.3).

    Выполняет:
    1. Построение Machinations-графа из ресурсов
    2. Симуляцию N тиков с разными стратегиями игроков
    3. Агрегацию результатов (runaway/stall частота, stability index)
    4. Оценку качества экономики

    Возвращает MachinationsSimResult с оценкой качества и патологиями.
    """
    user_id = current_user.id
    logger.info(f"Machinations simulation for user {user_id}")

    try:
        service = await get_balance_service()

        balance_input = BalanceInput(
            objects=_convert_objects(input_data.objects),
            resources=input_data.resources,
            game_mode=input_data.game_mode,
            genre=input_data.genre,
        )

        balance_map = await service.classify_balance_task(input_data=balance_input)
        transitive_result = await service.transitive_balance(
            input_data=balance_input, balance_map=balance_map,
        )

        # Построение графа
        graph = service.build_machinations_graph(
            input_data=balance_input,
            balance_map=balance_map,
            transitive_result=transitive_result,
        )

        # Симуляция
        sim_config = MachinationsSimConfig(
            ticks=input_data.ticks,
            num_runs=input_data.num_runs,
            recording_interval=input_data.recording_interval,
        )

        result = service.machinations_simulate(
            graph=graph,
            config=sim_config,
        )

        response = MachinationsResponse(
            graph=result.graph.model_dump() if result.graph else None,
            runs=result.runs,
            aggregated=result.aggregated.model_dump() if result.aggregated else None,
            quality=result.quality.model_dump() if result.quality else None,
            detected_pathologies=result.detected_pathologies,
            recommendations=result.recommendations,
        )

        return response

    except ValueError as e:
        logger.error(f"Validation error in Machinations: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in Machinations: {e}", exc_info=True)
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
        # TODO: Полная реализация сохранения в БД (Фаза 4.C.3+)
        # Пока возвращаем stub
        return {
            "project_id": project_id,
            "status": "not_found",
            "message": "Сохранение результатов балансировки будет реализовано в Фазе 4.C.3",
        }
    except Exception as e:
        logger.error(f"Error fetching balance result: {e}")
        raise HTTPException(status_code=500, detail="Ошибка получения результатов балансировки")
