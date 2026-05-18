"""Блок 3: MDA Lab — API endpoints (алгоритм 3.3, Этапы 1–6)."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from app.ai.executor import PromptExecutor
from app.services.mda_service import MDAService
from app.schemas.concept import AestheticProfile
from app.schemas.mda import MDAProfile

router = APIRouter()


class MDAAnalysisInput(BaseModel):
    """Входные данные для MDA Lab (алгоритм 3.3, Этапы 1–6)."""
    concept_id: str = Field(..., description="ID концепции")
    genre: str = Field("rpg", description="Жанр игры")
    idea: str = Field("", description="Описание идеи игры")

    # Целевая эстетика (обязательные)
    primary_aesthetic: str = Field(
        "challenge",
        description="Основная эстетика (8 типов ЛеБланка)",
    )
    secondary_aesthetic: str = Field(
        "fantasy",
        description="Вторичная эстетика",
    )
    tertiary_aesthetic: str = Field(
        "discovery",
        description="Третичная эстетика",
    )

    # Опциональные
    existing_mechanics: Optional[List[str]] = Field(
        None,
        description="Уже выбранные механики (из алгоритма 3.1)",
    )
    required_mechanics: Optional[List[str]] = Field(
        None,
        description="Обязательные механики (не могут быть удалены)",
    )
    forbidden_mechanics: Optional[List[str]] = Field(
        None,
        description="Запрещённые механики",
    )

    # Параметры
    max_mechanics: int = Field(18, description="Максимум механик (по умолчанию 18)")
    min_mechanics: int = Field(8, description="Минимум механик (по умолчанию 8)")
    max_iterations: int = Field(3, description="Максимум итераций генеративного цикла")
    convergence_threshold: float = Field(
        0.8,
        description="Порог сходимости эстетики (0–1)",
    )

    # Режим анализа
    full_analysis: bool = Field(
        True,
        description="Полный анализ (Этапы 1–6). Если False — только Этапы 1–3.",
    )


def _get_executor() -> PromptExecutor:
    """Создать PromptExecutor (временная фабрика)."""
    from app.ai.router import PromptRouter
    from app.ai.cache import PromptCache
    router_instance = PromptRouter()
    cache_instance = PromptCache()
    return PromptExecutor(router=router_instance, cache=cache_instance)


@router.post("/analyze", response_model=MDAProfile)
async def analyze_mda(input_data: MDAAnalysisInput):
    """
    MDA-анализ (алгоритм 3.3).

    Полный режим (full_analysis=True, по умолчанию):
    1. Reverse MDA — определение целевых динамик из эстетик
    2. Reverse MDA — маппинг «Динамика → Механики»
    3. Сборка и оптимизация набора механик
    4. Classic MDA — аналитический проход (Механики → Геймплей → Опыт)
    5. Валидация через Линзы Шелла (9 приоритетных линз)
    6. Матрица 4×3 Бонда + лудонарративный анализ

    Краткий режим (full_analysis=False):
    Только Этапы 1–3 (Reverse MDA).

    Итеративный цикл: maxIterations=3 с проверкой покрытия эстетик.

    Returns:
        MDAProfile с результатами выполненных этапов
    """
    executor = _get_executor()
    service = MDAService(executor=executor)

    # Собираем AestheticProfile из входных данных
    aesthetic_profile = AestheticProfile(
        primary=input_data.primary_aesthetic,
        secondary=input_data.secondary_aesthetic,
        tertiary=input_data.tertiary_aesthetic,
        rationale="Задано пользователем / из концепции",
    )

    try:
        if input_data.full_analysis:
            # Полный пайплайн: Этапы 1–6
            result = await service.analyze_full(
                concept_id=input_data.concept_id,
                aesthetic_profile=aesthetic_profile,
                genre=input_data.genre,
                idea=input_data.idea,
                existing_mechanics=input_data.existing_mechanics,
                required_mechanics=input_data.required_mechanics,
                forbidden_mechanics=input_data.forbidden_mechanics,
                max_mechanics=input_data.max_mechanics,
                min_mechanics=input_data.min_mechanics,
                max_iterations=input_data.max_iterations,
                convergence_threshold=input_data.convergence_threshold,
            )
        else:
            # Краткий пайплайн: Этапы 1–3
            result = await service.analyze_stages_1_3(
                concept_id=input_data.concept_id,
                aesthetic_profile=aesthetic_profile,
                genre=input_data.genre,
                idea=input_data.idea,
                existing_mechanics=input_data.existing_mechanics,
                required_mechanics=input_data.required_mechanics,
                forbidden_mechanics=input_data.forbidden_mechanics,
                max_mechanics=input_data.max_mechanics,
                min_mechanics=input_data.min_mechanics,
                max_iterations=input_data.max_iterations,
                convergence_threshold=input_data.convergence_threshold,
            )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"MDA-анализ не удался: {str(e)}",
        )
