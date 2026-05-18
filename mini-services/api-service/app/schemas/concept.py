"""
Gidede — Concept Schemas (Pydantic Models)
Фаза 4.B.2: Схемы для Блока 1 — Генератор концепции

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и shared/types/typescript/interfaces.ts.
"""

from pydantic import BaseModel, Field
from typing import Optional


# ============================================================
# ЭСТЕТИЧЕСКИЙ ПРОФИЛЬ (алгоритм 3.1.4)
# ============================================================

class AestheticProfile(BaseModel):
    """Профиль эстетических ценностей — 3 основные эстетики."""
    primary: str = Field(..., description="Основная эстетическая ценность")
    secondary: str = Field("", description="Вторичная эстетическая ценность")
    tertiary: str = Field("", description="Третичная эстетическая ценность")
    rationale: str = Field("", description="Обоснование выбора эстетик")


# ============================================================
# ПРОФИЛЬ ДИНАМИК (алгоритм 3.1.5)
# ============================================================

class DynamicsProfile(BaseModel):
    """Профиль динамик — основные и поддерживающие динамики."""
    core_dynamics: list[str] = Field(default_factory=list, description="Основные динамики")
    supporting_dynamics: list[str] = Field(default_factory=list, description="Поддерживающие динамики")
    emergence_potential: str = Field("none", description="Потенциал эмерджентности: none/weak/moderate/strong")
    rationale: str = Field("", description="Обоснование выбора динамик")
