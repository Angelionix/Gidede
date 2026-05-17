"""Блок 5: Экономика и прогрессия — API endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class ProgressionInput(BaseModel):
    """Входные данные для прогрессии (алгоритм 3.5)."""
    concept_id: str
    target_duration_hours: int = 40
    total_levels: int = 30
    curve_type: str = "exponential"


class EconomyInput(BaseModel):
    """Входные данные для экономики (алгоритм 3.6)."""
    concept_id: str
    resources: Optional[list] = None


@router.post("/progression/design")
async def design_progression(input_data: ProgressionInput):
    """
    Проектирование системы прогрессии (алгоритм 3.5).
    
    Этапы:
    1. Макро-параметры
    2. Разбиение на tiers
    3. Кривые прогрессии
    4. Контент-план
    """
    # TODO: Реализация в Фазе 4.C.5
    return {"status": "stub", "progression": {}}


@router.post("/economy/design")
async def design_economy(input_data: EconomyInput):
    """
    Проектирование экономики (алгоритм 3.6).
    
    Этапы:
    1. Идентификация ресурсов
    2. Построение Machinations-модели
    3. Диагностика
    4. Балансировка faucets/drains
    5. Связь с прогрессией
    """
    # TODO: Реализация в Фазе 4.C.6
    return {"status": "stub", "economy": {}}
