"""
Gidede — Balance Schemas (Pydantic Models)
Фаза 4.C.1–4.C.2: Схемы для Блока 4 — Балансировка (алгоритм 3.4)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и спецификацией алгоритма 3.4.

Алгоритм 3.4:
- Этап 1: Карта балансировки (классификация задачи)
- Этап 2: Transitive-анализ (cost-power кривые)
- Этап 3: Нетранзитивный анализ (RPS-структуры)
- Этап 4: Ситуационный анализ (контекстная ценность)
- Этап 5: Анализ устойчивости (Schreiber)
- Q-фактор (Роллингс/Моррис, Кн. 12)
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
# РЕЗУЛЬТАТ INTRANSITIVE-АНАЛИЗА (Этап 3, алгоритм 3.4.5)
# ============================================================

class StrategyBalanceScore(BaseModel):
    """Метрики баланса стратегий (нетранзитивный анализ)."""
    entropy: float = Field(
        0.0,
        description="Энтропия распределения стратегий: -Σ p_i * log(p_i). "
                    "Максимум = log(n), когда все равны",
    )
    max_share: float = Field(
        0.0,
        description="Доля наиболее популярной стратегии (не должна превышать 50%)",
    )
    gini: float = Field(
        0.0,
        description="Коэффициент Джини (0 = идеальное равенство, 1 = доминантная стратегия)",
    )


class RPSCycle(BaseModel):
    """Нетранзитивный цикл (Rock-Paper-Scissors)."""
    cycle: list[str] = Field(
        default_factory=list,
        description="Цикл доминирования: [A, B, C] означает A > B > C > A",
    )
    strength: float = Field(
        0.0,
        description="Сила цикла (минимальное преимущество в цикле)",
    )


class IntransitiveResult(BaseModel):
    """Результат нетранзитивного анализа — Этап 3 (алгоритм 3.4.5)."""
    payoff_matrix: list[list[float]] = Field(
        default_factory=list,
        description="Матрица выигрышей N×N: payoff[i][j] = EV объекта i против объекта j",
    )
    object_names: list[str] = Field(
        default_factory=list,
        description="Имена объектов (индексы матрицы)",
    )
    nash_equilibrium: list[float] = Field(
        default_factory=list,
        description="Равновесие Нэша: вероятность выбора каждого объекта",
    )
    is_intransitive: bool = Field(
        False,
        description="Наличие нетранзитивных (RPS) отношений между объектами",
    )
    dominated_strategies: list[int] = Field(
        default_factory=list,
        description="Индексы доминируемых стратегий (не должны выбираться)",
    )
    strategy_balance: Optional[StrategyBalanceScore] = Field(
        None,
        description="Метрики баланса стратегий",
    )
    rps_cycles: list[RPSCycle] = Field(
        default_factory=list,
        description="Обнаруженные RPS-циклы",
    )
    has_dominant_strategy: bool = Field(
        False,
        description="Есть ли доминантная стратегия (используется >50%)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о проблемах нетранзитивного баланса",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по коррекции RPS-структуры",
    )


# ============================================================
# РЕЗУЛЬТАТ СИТУАЦИОННОГО АНАЛИЗА (Этап 4, алгоритм 3.4.6)
# ============================================================

class Situation(BaseModel):
    """Игровая ситуация для ситуационного анализа."""
    name: str = Field(..., description="Название ситуации")
    probability: float = Field(
        0.0,
        description="Вероятность возникновения ситуации (0-1)",
    )


class VersatilityInfo(BaseModel):
    """Информация об универсальности/специализации объекта."""
    max_value: float = Field(0.0, description="Максимальная ситуационная ценность")
    min_value: float = Field(0.0, description="Минимальная ситуационная ценность")
    spread: float = Field(0.0, description="Разброс (max - min)")
    type: str = Field(
        "universal",
        description="Тип: universal (spread < 0.3) или specialized (spread >= 0.3)",
    )


class SituationalResult(BaseModel):
    """Результат ситуационного анализа — Этап 4 (алгоритм 3.4.6)."""
    situations: list[Situation] = Field(
        default_factory=list,
        description="Список игровых ситуаций с вероятностями",
    )
    situational_values: list[list[float]] = Field(
        default_factory=list,
        description="Матрица ценности: objects × situations → value (0.0-2.0, 1.0 = средняя)",
    )
    object_names: list[str] = Field(
        default_factory=list,
        description="Имена объектов (индексы строк матрицы)",
    )
    situational_ev: list[float] = Field(
        default_factory=list,
        description="Ожидаемая ситуационная ценность для каждого объекта: Σ P(sit) * value",
    )
    versatility_map: list[VersatilityInfo] = Field(
        default_factory=list,
        description="Универсальность/специализация каждого объекта",
    )
    dead_zones: list[str] = Field(
        default_factory=list,
        description="Объекты, которые никогда не доминируют (мёртвые зоны)",
    )
    dominant_universals: list[str] = Field(
        default_factory=list,
        description="Универсальные объекты с высокой EV — потенциально доминантные",
    )
    switching_cost: str = Field(
        "medium",
        description="Стоимость переключения: low/medium/high",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о ситуационном дисбалансе",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по коррекции ситуационного баланса",
    )


# ============================================================
# РЕЗУЛЬТАТ Q-ФАКТОРА (алгоритм 3.4.7, Роллингс/Моррис)
# ============================================================

class QFactorObject(BaseModel):
    """Q-фактор анализ одного объекта."""
    name: str = Field(..., description="Название объекта")
    dominant_attributes: list[str] = Field(
        default_factory=list,
        description="Атрибуты, по которым объект доминирует",
    )
    is_redundant: bool = Field(
        False,
        description="Является ли объект избыточным (не доминирует ни по одному атрибуту)",
    )
    redundancy_score: float = Field(
        0.0,
        description="Оценка избыточности (0 = уникален, 1 = полностью избыточен)",
    )


class QFactorResult(BaseModel):
    """Результат Q-фактор анализа — Роллингс/Моррис (Кн. 12)."""
    objects: list[QFactorObject] = Field(
        default_factory=list,
        description="Анализ Q-фактора для каждого объекта",
    )
    redundant_objects: list[str] = Field(
        default_factory=list,
        description="Список избыточных объектов (кандидаты на удаление/усиление)",
    )
    attribute_dominance: dict[str, str] = Field(
        default_factory=dict,
        description="Атрибут → имя объекта, доминирующего по этому атрибуту",
    )
    q_matrix: list[list[float]] = Field(
        default_factory=list,
        description="Q-матрица: объекты × атрибуты (нормализованные значения 0-1)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения об избыточных компонентах",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по устранению избыточности",
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
    - intransitive_result: Результат нетранзитивного анализа (Этап 3)
    - situational_result: Результат ситуационного анализа (Этап 4)
    - q_factor_result: Результат Q-фактор анализа
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
    intransitive_result: Optional[IntransitiveResult] = Field(
        None,
        description="Результат нетранзитивного анализа (Этап 3)",
    )
    situational_result: Optional[SituationalResult] = Field(
        None,
        description="Результат ситуационного анализа (Этап 4)",
    )
    q_factor_result: Optional[QFactorResult] = Field(
        None,
        description="Результат Q-фактор анализа",
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
