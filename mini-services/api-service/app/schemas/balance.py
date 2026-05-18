"""
Gidede — Balance Schemas (Pydantic Models)
Фаза 4.C.1: Схемы для Блока 4 — Transitive-анализ баланса (алгоритм 3.4)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и спецификацией алгоритма 3.4.

Алгоритм 3.4:
- Этап 1: Карта балансировки (классификация задачи)
- Этап 2: Transitive-анализ (cost-power кривые)
- Этап 3: Анализ устойчивости (Schreiber)
"""

from pydantic import BaseModel, Field
from typing import Optional


# ============================================================
# ВХОДНЫЕ ДАННЫЕ (алгоритм 3.4.2)
# ============================================================

class BalanceObject(BaseModel):
    """Игровой объект для балансировки."""
    id: str = Field(..., description="Уникальный идентификатор объекта")
    name: str = Field(..., description="Название объекта")
    type: str = Field(
        ...,
        description="Тип: character/weapon/unit/ability/item/class",
    )
    attributes: dict[str, float] = Field(
        default_factory=dict,
        description="Атрибуты объекта: HP, damage, speed, etc.",
    )
    cost: Optional[float] = Field(
        None,
        description="Стоимость объекта (ресурсная стоимость)",
    )
    tier: Optional[int] = Field(
        None,
        description="Уровень/тир объекта (1-10)",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Теги объекта (vanilla, special, unique, etc.)",
    )


class BalanceInput(BaseModel):
    """Входные данные для балансировки (алгоритм 3.4.2)."""
    objects: list[BalanceObject] = Field(
        ...,
        description="Список игровых объектов для балансировки",
    )
    resources: list[dict] = Field(
        default_factory=list,
        description="Ресурсные профили (ResourceProfile[])",
    )
    balance_type: str = Field(
        "mixed",
        description="Тип балансировки: transitive/intransitive/situational/mixed",
    )
    game_mode: str = Field(
        "PvE",
        description="Игровой режим: PvP/PvE/PvPvE",
    )
    target_duration: Optional[float] = Field(
        None,
        description="Целевая длительность матча/сессии (в секундах)",
    )
    target_levels: Optional[int] = Field(
        None,
        description="Целевое количество уровней прогрессии",
    )
    anchor_resource: Optional[str] = Field(
        None,
        description="Якорный ресурс для нормализации",
    )
    genre: str = Field(
        "",
        description="Жанр игры (для жанровых порогов)",
    )


# ============================================================
# ОТЧЁТ ПО ОБЪЕКТУ (алгоритм 3.4, Этап 2)
# ============================================================

class ObjectBalanceReport(BaseModel):
    """Отчёт по одному объекту — результат transitive-анализа."""
    name: str = Field(..., description="Название объекта")
    power: float = Field(
        0.0,
        description="Расчётная мощность объекта (power = Σ weight_i * attr_i)",
    )
    effective_cost: float = Field(
        0.0,
        description="Эффективная стоимость объекта",
    )
    cp_ratio: float = Field(
        0.0,
        description="Отношение cost/power (cost-effectiveness)",
    )
    distance_from_curve: float = Field(
        0.0,
        description="Отклонение от идеальной кривой (cp_ratio - 1.0)",
    )
    status: str = Field(
        "balanced",
        description="Статус: overpowered/underpowered/balanced/ideal_imbalance",
    )


# ============================================================
# РЕЗУЛЬТАТ TRANSITIVE-АНАЛИЗА (Этап 2, алгоритм 3.4)
# ============================================================

class TransitiveResult(BaseModel):
    """Результат транзитивного анализа — Этап 2 (алгоритм 3.4)."""
    attribute_weights: dict[str, float] = Field(
        default_factory=dict,
        description="Веса атрибутов: attr → weight",
    )
    cost_curve_model: str = Field(
        "identity",
        description="Модель кривой стоимости: identity/shifted_identity/progression",
    )
    expected_cp: float = Field(
        1.0,
        description="Ожидаемое значение cp_ratio для сбалансированных объектов",
    )
    objects: list[ObjectBalanceReport] = Field(
        default_factory=list,
        description="Отчёты по каждому объекту",
    )
    overpowered: list[str] = Field(
        default_factory=list,
        description="Список имён overpowered-объектов",
    )
    underpowered: list[str] = Field(
        default_factory=list,
        description="Список имён underpowered-объектов",
    )
    balanced: list[str] = Field(
        default_factory=list,
        description="Список имён сбалансированных объектов",
    )
    ideal_imbalance: list[str] = Field(
        default_factory=list,
        description="Список имён объектов с ideal_imbalance (5-15% отклонение)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о проблемах балансировки",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по корректировке баланса",
    )


# ============================================================
# КАРТА БАЛАНСИРОВКИ (Этап 1, алгоритм 3.4)
# ============================================================

class BalanceMap(BaseModel):
    """Карта балансировки — результат Этапа 1 (алгоритм 3.4)."""
    primary_model: str = Field(
        "transitive",
        description="Основная модель балансировки: transitive/intransitive/situational",
    )
    secondary_model: str = Field(
        "",
        description="Дополнительная модель балансировки",
    )
    anchor: str = Field(
        "gold",
        description="Якорный ресурс для нормализации",
    )
    game_sum: str = Field(
        "positive",
        description="Тип суммы игры: positive/zero/negative (Schreiber)",
    )
    feedback: str = Field(
        "balancing",
        description="Тип обратной связи: reinforcing/balancing/both (Schreiber)",
    )
    macro_model: Optional[dict] = Field(
        None,
        description="Макро-модель (PvP/PvE специфика)",
    )
    applicable_balance_types: dict[str, bool] = Field(
        default_factory=dict,
        description="Применимые типы балансировки: type → is_applicable",
    )


# ============================================================
# ИТОГОВЫЙ РЕЗУЛЬТАТ БАЛАНСИРОВКИ (алгоритм 3.4)
# ============================================================

class BalanceResult(BaseModel):
    """
    Итоговый результат балансировки — алгоритм 3.4.

    Включает:
    - balance_map: Карта балансировки (Этап 1)
    - transitive_result: Результат transitive-анализа (Этап 2)
    - stages_completed: Завершённые этапы
    - warnings, suggestions: Предупреждения и рекомендации
    """
    balance_map: Optional[BalanceMap] = Field(
        None,
        description="Карта балансировки (Этап 1)",
    )
    transitive_result: Optional[TransitiveResult] = Field(
        None,
        description="Результат transitive-анализа (Этап 2)",
    )
    stages_completed: list[int] = Field(
        default_factory=list,
        description="Завершённые этапы алгоритма 3.4",
    )
    latency_ms: int = Field(
        0,
        description="Время выполнения (мс)",
    )
    models_used: list[str] = Field(
        default_factory=list,
        description="Использованные AI-модели/промпты",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации",
    )
