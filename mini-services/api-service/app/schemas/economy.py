"""
Gidede — Economy Schemas (Pydantic Models)
Фаза 4.C.6: Схемы для Блока 5 — Экономика (алгоритм 3.6)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и спецификацией алгоритма 3.6.

Алгоритм 3.6:
- Этап 1: Идентификация ресурсов → ResourceInventory (3.6.3)
- Этап 2: Классификация экономической системы → EconomicClassification (3.6.4)
- Этап 3: Построение Machinations-модели → MachinationsGraph (3.6.5)
- Этап 4: Построение графа конверсий → ConversionGraph (3.6.6)
- Этап 5: Диагностика патологий → EconomyDiagnostics (3.6.7)
- Этап 6: Автоматическая балансировка → FaucetDrainBalance (3.6.8)
- Этап 7: Симуляция экономики → EconomySimResult (3.6.9)
- Этап 8: Сборка EconomyProfile (3.6.10)
"""

from pydantic import BaseModel, Field
from typing import Any, Optional


# ============================================================
# ЭТАП 1: ИДЕНТИФИКАЦИЯ РЕСУРСОВ (алгоритм 3.6.3)
# ============================================================

class ResourceDescriptor(BaseModel):
    """Дескриптор ресурса игры."""
    name: str = Field(..., description="Название ресурса")
    resource_class: str = Field(
        "game_object",
        description="Класс по Schreiber: time/currency/game_object/hp/experience/consumable",
    )
    is_consumable: bool = Field(
        False,
        description="Является ли ресурс потребляемым",
    )
    is_catalytic: bool = Field(
        False,
        description="Является ли ресурс катализатором (используется, но не расходуется)",
    )
    is_anchor: bool = Field(
        False,
        description="Является ли якорным ресурсом (anchor resource для экономики)",
    )
    depreciates: bool = Field(
        False,
        description="Обесценивается ли ресурс со временем",
    )
    transferable: bool = Field(
        False,
        description="Можно ли передать ресурс другому игроку",
    )
    initial_value: float = Field(
        0.0,
        description="Начальное значение ресурса",
    )
    bounds: dict = Field(
        default_factory=lambda: {"min": 0, "max": 10000},
        description="Границы ресурса: {min, max}",
    )
    source: str = Field(
        "heuristic",
        description="Источник: heuristic/ai/ai_enriched/user",
    )


class ResourceInventory(BaseModel):
    """Инвентарь ресурсов — результат Этапа 1 (алгоритм 3.6.3)."""
    resources: list[ResourceDescriptor] = Field(
        default_factory=list,
        description="Список ресурсов с дескрипторами",
    )
    anchor_resource: str = Field(
        "",
        description="Якорный ресурс экономики",
    )
    core_count: int = Field(
        0,
        description="Количество core-ресурсов",
    )
    subsidiary_count: int = Field(
        0,
        description="Количество subsidiary-ресурсов",
    )
    class_distribution: dict[str, int] = Field(
        default_factory=dict,
        description="Распределение по классам: class → count",
    )
    models_used: list[str] = Field(
        default_factory=list,
        description="Использованные AI-модели",
    )


# ============================================================
# ЭТАП 2: КЛАССИФИКАЦИЯ ЭКОНОМИЧЕСКОЙ СИСТЕМЫ (3.6.4)
# ============================================================

class EconomicClassification(BaseModel):
    """Классификация экономической системы — результат Этапа 2 (алгоритм 3.6.4)."""
    economic_type: str = Field(
        "engine",
        description="Тип экономики по Sellers: engine/economy/ecology/hybrid",
    )
    sub_type: str = Field(
        "",
        description="Подтип: braked_engine, pure_engine, multi_currency, single_currency, metastable, etc.",
    )
    dominant_loop: str = Field(
        "reinforcing",
        description="Доминирующий тип петель: reinforcing/balancing/both",
    )
    interaction_type: str = Field(
        "single_resource",
        description="Тип взаимодействия: single_resource/conversion/exchange",
    )
    reinforcing_loops: int = Field(
        0,
        description="Количество усиливающих петель",
    )
    balancing_loops: int = Field(
        0,
        description="Количество балансирующих петель",
    )
    openness: str = Field(
        "closed",
        description="Открытость: open/closed/mixed",
    )
    pricing_type: str = Field(
        "fixed",
        description="Тип ценообразования: fixed/player_driven/f2p/mixed",
    )
    risk_level: str = Field(
        "low",
        description="Уровень риска: low/medium/high/critical",
    )
    likely_pathologies: list[str] = Field(
        default_factory=list,
        description="Вероятные патологии",
    )
    risk_description: str = Field(
        "",
        description="Описание риска",
    )


# ============================================================
# ЭТАП 4: ГРАФ КОНВЕРСИЙ (3.6.6)
# ============================================================

class ConversionChain(BaseModel):
    """Цепочка конверсии ресурсов."""
    name: str = Field(..., description="Название конверсии")
    inputs: list[str] = Field(
        default_factory=list,
        description="Входные ресурсы",
    )
    outputs: list[str] = Field(
        default_factory=list,
        description="Выходные ресурсы",
    )
    input_value: float = Field(
        0.0,
        description="Оценочная ценность входных ресурсов",
    )
    output_value: float = Field(
        0.0,
        description="Оценочная ценность выходных ресурсов",
    )
    profitability: float = Field(
        1.0,
        description="Прибыльность конверсии (output_value / input_value)",
    )
    tier: Optional[int] = Field(
        None,
        description="Тир, к которому относится конверсия",
    )


class ConversionGraph(BaseModel):
    """Граф конверсий — результат Этапа 4 (алгоритм 3.6.6)."""
    chains: list[ConversionChain] = Field(
        default_factory=list,
        description="Цепочки конверсий",
    )
    avg_profitability: float = Field(
        1.0,
        description="Средняя прибыльность конверсий",
    )
    tier_coverage: list[int] = Field(
        default_factory=list,
        description="Покрытые тиры",
    )
    uncovered_tiers: list[int] = Field(
        default_factory=list,
        description="Непокрытые тиры",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о проблемах конверсий",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по конверсиям",
    )


# ============================================================
# ЭТАП 5: ДИАГНОСТИКА ПАТОЛОГИЙ (3.6.7)
# ============================================================

class EconomyPathology(BaseModel):
    """Обнаруженная патология экономики."""
    name: str = Field(..., description="Название патологии")
    severity: str = Field(
        "info",
        description="Серьёзность: critical/warning/info",
    )
    description: str = Field(
        "",
        description="Описание патологии",
    )
    affected_resources: list[str] = Field(
        default_factory=list,
        description="Затронутые ресурсы",
    )
    correction: str = Field(
        "",
        description="Корректирующее действие",
    )


class EconomyDiagnostics(BaseModel):
    """Диагностика экономики — результат Этапа 5 (алгоритм 3.6.7)."""
    pathologies: list[EconomyPathology] = Field(
        default_factory=list,
        description="Список обнаруженных патологий",
    )
    critical_count: int = Field(
        0,
        description="Количество критических патологий",
    )
    warning_count: int = Field(
        0,
        description="Количество предупреждений",
    )
    info_count: int = Field(
        0,
        description="Количество информационных сообщений",
    )
    overall_severity: str = Field(
        "info",
        description="Общая серьёзность: critical/warning/info",
    )
    faucet_drain_ratios: dict[str, float] = Field(
        default_factory=dict,
        description="Отношение faucet/drain для каждого ресурса",
    )


# ============================================================
# ЭТАП 6: БАЛАНСИРОВКА FAUCET/DRAIN (3.6.8)
# ============================================================

class FaucetDrainAdjustment(BaseModel):
    """Корректировка faucet/drain для одного ресурса."""
    resource: str = Field(..., description="Название ресурса")
    current_faucet: float = Field(0.0, description="Текущий faucet rate")
    current_drain: float = Field(0.0, description="Текущий drain rate")
    current_ratio: float = Field(1.0, description="Текущее отношение faucet/drain")
    new_faucet: float = Field(0.0, description="Новый faucet rate")
    new_drain: float = Field(0.0, description="Новый drain rate")
    new_ratio: float = Field(1.0, description="Новое отношение faucet/drain")
    action: str = Field(
        "none",
        description="Действие: none/increase_faucet/decrease_faucet/increase_drain/decrease_drain/add_faucet/add_drain",
    )
    phase: str = Field(
        "startup",
        description="Фаза экономики: startup/growth/maturity/endgame",
    )


class FaucetDrainBalance(BaseModel):
    """Результат балансировки faucet/drain — Этап 6 (алгоритм 3.6.8)."""
    adjustments: list[FaucetDrainAdjustment] = Field(
        default_factory=list,
        description="Корректировки по ресурсам",
    )
    economy_phase: str = Field(
        "startup",
        description="Текущая фаза экономики",
    )
    target_ratio: float = Field(
        1.0,
        description="Целевое отношение faucet/drain для текущей фазы",
    )
    balanced_count: int = Field(
        0,
        description="Количество сбалансированных ресурсов",
    )
    total_count: int = Field(
        0,
        description="Общее количество ресурсов",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения",
    )


# ============================================================
# ЭТАП 7: РЕЗУЛЬТАТ СИМУЛЯЦИИ ЭКОНОМИКИ (3.6.9)
# ============================================================

class EconomySimResult(BaseModel):
    """Результат симуляции экономики — Этап 7 (алгоритм 3.6.9)."""
    config: Optional[Any] = Field(
        None,
        description="Конфигурация симуляции (MachinationsSimConfig)",
    )
    aggregated: Optional[Any] = Field(
        None,
        description="Агрегированные данные (AggregatedSimData)",
    )
    quality: Optional[Any] = Field(
        None,
        description="Оценка качества (QualityAssessment)",
    )
    snapshots: list[Any] = Field(
        default_factory=list,
        description="Снепшоты типичного прогона (EconomyRunSnapshot[])",
    )
    detected_pathologies: list[str] = Field(
        default_factory=list,
        description="Обнаруженные патологии: runaway/stall/overflow/build_gap",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Рекомендации по коррекции экономики",
    )


# ============================================================
# ЭТАП 8: ИТОГОВЫЙ ПРОФИЛЬ ЭКОНОМИКИ (3.6.10)
# ============================================================

class EconomyProfile(BaseModel):
    """
    Итоговый профиль экономики — результат алгоритма 3.6 (Этапы 1-8).

    Включает:
    - inventory: Инвентарь ресурсов (Этап 1)
    - classification: Классификация экономики (Этап 2)
    - machinations_graph: Machinations-модель (Этап 3)
    - conversion_graph: Граф конверсий (Этап 4)
    - diagnostics: Диагностика патологий (Этап 5)
    - balance: Балансировка faucet/drain (Этап 6)
    - sim_result: Результат симуляции (Этап 7)
    - summary: Текстовая сводка
    - stages_completed: Завершённые этапы
    - latency_ms: Время выполнения
    - models_used: Использованные AI-модели
    - warnings, suggestions: Предупреждения и рекомендации
    """
    inventory: Optional[ResourceInventory] = Field(
        None,
        description="Инвентарь ресурсов (Этап 1)",
    )
    classification: Optional[EconomicClassification] = Field(
        None,
        description="Классификация экономики (Этап 2)",
    )
    machinations_graph: Optional[Any] = Field(
        None,
        description="Machinations-модель (Этап 3, MachinationsGraph)",
    )
    conversion_graph: Optional[ConversionGraph] = Field(
        None,
        description="Граф конверсий (Этап 4)",
    )
    diagnostics: Optional[EconomyDiagnostics] = Field(
        None,
        description="Диагностика патологий (Этап 5)",
    )
    balance: Optional[FaucetDrainBalance] = Field(
        None,
        description="Балансировка faucet/drain (Этап 6)",
    )
    sim_result: Optional[EconomySimResult] = Field(
        None,
        description="Результат симуляции (Этап 7)",
    )
    summary: str = Field(
        "",
        description="Текстовая сводка экономики",
    )
    stages_completed: list[int] = Field(
        default_factory=list,
        description="Завершённые этапы алгоритма 3.6",
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
