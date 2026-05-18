"""
Gidede — Concept Schemas (Pydantic Models)
Фаза 4.B.2-4.B.4: Схемы для Блока 1 — Генератор концепции

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


# ============================================================
# ВАЛИДАЦИЯ КОНЦЕПЦИИ (алгоритм 3.1.8, Этап 6)
# ============================================================

class ValidationWarning(BaseModel):
    """Предупреждение валидатора."""
    validator: str = Field(..., description="ID валидатора: triangle/core_questions/idea_filters")
    code: str = Field("", description="Код предупреждения")
    message: str = Field(..., description="Текст предупреждения")
    severity: str = Field("warning", description="Уровень: info/warning/error")


class ValidationSuggestion(BaseModel):
    """Предложение по улучшению от валидатора."""
    validator: str = Field(..., description="ID валидатора")
    target: str = Field("", description="Что улучшить")
    suggestion: str = Field(..., description="Текст предложения")
    priority: str = Field("medium", description="Приоритет: low/medium/high")


class ValidationResult(BaseModel):
    """Результат одного валидатора (score + warnings + suggestions)."""
    validator_id: str = Field(..., description="ID валидатора")
    validator_name: str = Field("", description="Человекочитаемое название")
    score: float = Field(0.0, description="Score валидации (0.0–1.0)")
    passed: bool = Field(False, description="Прошёл ли валидацию (score >= 0.6)")
    warnings: list[ValidationWarning] = Field(default_factory=list)
    suggestions: list[ValidationSuggestion] = Field(default_factory=list)
    details: dict = Field(default_factory=dict, description="Детали валидации (специфичные для валидатора)")


class ValidationReport(BaseModel):
    """
    Полный отчёт валидации концепции (алгоритм 3.1.8, Этап 6).
    Три валидатора: Triangle of Weirdness, 5 вопросов, 8 фильтров.
    """
    triangle_of_weirdness: Optional[ValidationResult] = Field(
        None, description="Валидатор 1: Triangle of Weirdness (Кн. 8)"
    )
    core_questions: Optional[ValidationResult] = Field(
        None, description="Валидатор 2: 5 вопросов кор-геймплея (Кн. 10)"
    )
    idea_filters: Optional[ValidationResult] = Field(
        None, description="Валидатор 3: 8 фильтров идеи (Кн. 1)"
    )
    overall_score: float = Field(0.0, description="Общий score (среднее по трём валидаторам)")
    overall_passed: bool = Field(False, description="Общий результат (средний score >= 0.6)")
    warnings: list[ValidationWarning] = Field(default_factory=list, description="Все предупреждения")
    suggestions: list[ValidationSuggestion] = Field(default_factory=list, description="Все предложения")


# ============================================================
# ONE-PAGER (алгоритм 3.1.9, Этап 7)
# ============================================================

class OnePager(BaseModel):
    """
    One-Pager — итоговый документ концепции (алгоритм 3.1.9, Этап 7).
    8 полей шаблона Роджерса + дополнительные поля Gidede.
    """
    # 8 полей шаблона Роджерса
    title: str = Field("", description="Название игры")
    platform: list[str] = Field(default_factory=list, description="Целевые платформы")
    target_audience: str = Field("", description="Описание целевой аудитории")
    rating: str = Field("", description="Возрастной рейтинг (ESRB)")

    # Описания (AI-сгенерированные с валидацией)
    story_synopsis: str = Field("", description="Краткий синопсис сюжета (2-3 предложения)")
    gameplay_description: str = Field("", description="Описание геймплея (3-5 предложений)")
    unique_features: list[str] = Field(default_factory=list, description="3 уникальные фичи")
    competitors: list[str] = Field(default_factory=list, description="Сравнение с 2-3 конкурентами")

    # Дополнительные поля Gidede
    aesthetic_profile: Optional[dict] = Field(None, description="Эстетический профиль (из Этапа 2)")
    dynamics_profile: Optional[dict] = Field(None, description="Профиль динамик (из Этапа 3)")
    mechanic_set: Optional[dict] = Field(None, description="Набор механик (из Этапа 4)")
    core_loop_candidates: list[dict] = Field(default_factory=list, description="3 варианта Core Loop (из Этапа 5)")
    usp_candidates: list[dict] = Field(default_factory=list, description="3 варианта USP (из Этапа 5)")
    validation_report: Optional[dict] = Field(None, description="Отчёт валидации (из Этапа 6)")

    # Мета
    loop_type: str = Field("hybrid", description="Структурный тип Core Loop")
    compatibility_score: float = Field(0.0, description="Совместимость механик (0-100)")
    uniqueness_score: float = Field(0.0, description="Уникальность комбинации (0-100)")
    stages_completed: list[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5, 6, 7])
    latency_ms: int = Field(0)
    models_used: list[str] = Field(default_factory=list)
