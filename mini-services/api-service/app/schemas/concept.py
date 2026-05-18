"""
Gidede — Concept Schemas (Pydantic Models)
Фаза 4.B.2-4.B.3: Схемы для Блока 1 — Генератор концепции

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и shared/types/typescript/interfaces.ts.
"""

from pydantic import BaseModel, Field
from typing import Any, Optional


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


# ============================================================
# НАБОР МЕХАНИК (алгоритм 3.1.6, Этап 4)
# ============================================================

class MechanicSet(BaseModel):
    """Набор выбранных механик из MechanicsDB — результат Этапа 4."""
    base: list[dict] = Field(default_factory=list, description="Базовые механики (3-5)")
    combat: list[dict] = Field(default_factory=list, description="Боевые механики (2-4)")
    progression: list[dict] = Field(default_factory=list, description="Прогрессионные механики (2-3)")
    spatial: list[dict] = Field(default_factory=list, description="Пространственные механики (2-3)")
    social: list[dict] = Field(default_factory=list, description="Социальные/информационные механики (1-3)")
    total_count: int = Field(0, description="Общее количество механик")
    conflicts_resolved: list[str] = Field(default_factory=list, description="Разрешённые конфликты")
    synergies_detected: list[dict] = Field(default_factory=list, description="Обнаруженные синергии")
    compatibility_score: float = Field(0.0, description="Score совместимости (0-100)")
    warnings: list[str] = Field(default_factory=list, description="Предупреждения")


# ============================================================
# CORE LOOP КАНДИДАТ (алгоритм 3.1.7, Этап 5)
# ============================================================

class CoreLoopCandidate(BaseModel):
    """Кандидат Core Loop — один из 3 вариантов."""
    name: str = Field("", description="Название варианта Core Loop")
    steps: list[Any] = Field(default_factory=list, description="Шаги цикла (3-5)")
    loop_type: str = Field("hybrid", description="Тип петли: engine/economy/ecology/hybrid")
    fun_check: str = Field("", description="Тест '30 секунд веселья'")
    estimated_duration_seconds: int = Field(30, description="Оценка длительности одного цикла (сек)")


# ============================================================
# USP КАНДИДАТ (алгоритм 3.1.7, Этап 5)
# ============================================================

class USPCandidate(BaseModel):
    """Кандидат USP — один из 3 вариантов."""
    usp: str = Field("", description="Формулировка USP")
    triangle_check: dict = Field(default_factory=dict, description="Triangle of Weirdness: weird/appealing/credible")
    competitive_differentiation: str = Field("", description="Отличие от конкурентов")
