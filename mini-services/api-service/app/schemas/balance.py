"""
Gidede — Balance Schemas (Pydantic Models)
Фаза 4.C.1–4.C.3: Схемы для Блока 4 — Балансировка (алгоритм 3.4)

Модели синхронизированы с shared/types/python/models.py (4.A.12)
и спецификацией алгоритма 3.4.

Алгоритм 3.4:
- Этап 1: Карта балансировки (классификация задачи)
- Этап 2: Transitive-анализ (cost-power кривые)
- Этап 3: Нетранзитивный анализ (RPS-структуры)
- Этап 4: Ситуационный анализ (контекстная ценность)
- Этап 5: Анализ устойчивости (Schreiber)
- Q-фактор (Роллингс/Моррис, Кн. 12)
- Этап 6: Monte Carlo-симуляция (4.C.3)
- Этап 7: Machinations-симуляция (4.C.3)
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
# РЕЗУЛЬТАТ АНАЛИЗА УСТОЙЧИВОСТИ (Этап 3, Schreiber)
# ============================================================

class StabilityAnalysis(BaseModel):
    """Результат анализа устойчивости (Schreiber) — Этап 3."""
    overall_stability: str = Field(
        "stable",
        description="Общая устойчивость: stable/unstable/conditionally_stable",
    )
    pathology_risks: list[str] = Field(
        default_factory=list,
        description="Риски патологий: runaway/deadlock/stall/oscillation",
    )
    analysis: list[dict] = Field(
        default_factory=list,
        description="Анализ каждой комбинации sum_type × feedback_type",
    )
    positive_loops: int = Field(
        0,
        description="Количество усиливающих петель",
    )
    negative_loops: int = Field(
        0,
        description="Количество балансирующих петель",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Рекомендации по повышению устойчивости",
    )


# ============================================================
# MONTE CARLO СИМУЛЯЦИЯ (Этап 6, алгоритм 3.4.9)
# ============================================================

class SimulationConfig(BaseModel):
    """Конфигурация Monte Carlo-симуляции."""
    num_iterations: int = Field(
        10000,
        description="Количество итераций (боёв/сессий)",
    )
    matchup_format: str = Field(
        "1v1",
        description="Формат встреч: 1v1/team",
    )
    random_seed: int = Field(
        42,
        description="Seed для воспроизводимости",
    )
    logging_level: str = Field(
        "summary",
        description="Уровень логирования: summary/detailed/debug",
    )


class MatchupData(BaseModel):
    """Результат парного сравнения (matchup) в Monte Carlo."""
    wins_a: int = Field(0, description="Количество побед объекта A")
    wins_b: int = Field(0, description="Количество побед объекта B")
    draws: int = Field(0, description="Количество ничьих")
    avg_duration: float = Field(0.0, description="Средняя длительность боя (тики)")


class NumberFormatReport(BaseModel):
    """Оценка эмоционального восприятия чисел (Гэзэуэй/Кн. 9)."""
    light_numbers: list[str] = Field(
        default_factory=list,
        description="«Лёгкие» числа (кратные 5/10) — спокойствие",
    )
    heavy_numbers: list[str] = Field(
        default_factory=list,
        description="«Тяжёлые» числа (некруглые) — напряжение",
    )
    assessment: str = Field(
        "",
        description="Общая оценка восприятия чисел",
    )


class MonteCarloResult(BaseModel):
    """
    Результат Monte Carlo-симуляции — Этап 6 (алгоритм 3.4.9).

    Стохастическая валидация формального анализа баланса.
    Моделирует N боёв/сессий и агрегирует win rates, длительности,
    распределения ресурсов.
    """
    config: SimulationConfig = Field(
        default_factory=SimulationConfig,
        description="Конфигурация симуляции",
    )
    win_rates: dict[str, float] = Field(
        default_factory=dict,
        description="Win rate каждого объекта: name → win_rate (0-1)",
    )
    avg_duration: dict[str, float] = Field(
        default_factory=dict,
        description="Средняя длительность боя с участием объекта: name → ticks",
    )
    matchup_matrix: dict[str, dict[str, dict]] = Field(
        default_factory=dict,
        description="Матрица парных сравнений: name_a → {name_b → MatchupData}",
    )
    win_rate_spread: float = Field(
        0.0,
        description="Разброс win rate: MAX - MIN",
    )
    ranking_correlation: float = Field(
        0.0,
        description="Корреляция Спирмена: формальный ранг vs симуляция",
    )
    number_format: Optional[NumberFormatReport] = Field(
        None,
        description="Оценка эмоционального восприятия чисел",
    )
    balance_verdict: str = Field(
        "GOOD",
        description="Вердикт: GOOD (spread < 0.15), MODERATE (< 0.30), POOR (>= 0.30)",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения о расхождениях с формальным анализом",
    )
    suggestions: list[str] = Field(
        default_factory=list,
        description="Рекомендации по коррекции на основе симуляции",
    )


# ============================================================
# MACHINATIONS-СИМУЛЯЦИЯ (Этап 7, алгоритмы 3.4/3.6)
# ============================================================

class MachinationsNode(BaseModel):
    """Узел Machinations-графа."""
    id: str = Field(..., description="Уникальный идентификатор узла")
    name: str = Field(..., description="Название узла")
    node_type: str = Field(
        ...,
        description="Тип: pool/source/drain/converter/trader/gate/delay/queue",
    )
    initial_value: float = Field(
        0.0,
        description="Начальное значение (для Pool)",
    )
    capacity: Optional[float] = Field(
        None,
        description="Вместимость (для Pool, Queue)",
    )
    rate: Optional[float] = Field(
        None,
        description="Скорость генерации/потребления (для Source/Drain)",
    )
    activation: str = Field(
        "automatic",
        description="Активация: automatic/interactive/conditional",
    )
    inputs: list[str] = Field(
        default_factory=list,
        description="Входящие ресурсы (для Converter/Trader)",
    )
    outputs: list[str] = Field(
        default_factory=list,
        description="Исходящие ресурсы (для Converter/Trader)",
    )
    efficiency: Optional[float] = Field(
        None,
        description="Эффективность конверсии output/input (для Converter)",
    )
    is_core: bool = Field(
        False,
        description="Является ли ключевым ресурсом",
    )


class MachinationsResourceFlow(BaseModel):
    """Поток ресурсов между узлами Machinations-графа (сплошная стрелка)."""
    source_id: str = Field(..., description="ID исходного узла")
    target_id: str = Field(..., description="ID целевого узла")
    resource: str = Field(..., description="Название ресурса")
    rate: float = Field(1.0, description="Скорость потока (ресурсов/тик)")
    flow_type: str = Field(
        "automatic",
        description="Тип потока: automatic/interactive/conditional",
    )


class MachinationsStateConnection(BaseModel):
    """Связь состояния Machinations-графа (пунктирная стрелка)."""
    source_id: str = Field(..., description="ID исходного узла")
    target_id: str = Field(..., description="ID целевого узла")
    modifier: str = Field(
        "+",
        description="Модификатор: + (усиливающая) / - (балансирующая)",
    )
    formula: str = Field(
        "",
        description="Формула связи (напр. 'rate * (1 - pool_gold / max_gold)')",
    )


class MachinationsFeedbackLoop(BaseModel):
    """Обратная связь в Machinations-графе."""
    nodes: list[str] = Field(
        default_factory=list,
        description="Цикл узлов обратной связи",
    )
    loop_type: str = Field(
        "reinforcing",
        description="Тип: reinforcing/balancing",
    )
    strength: float = Field(
        0.0,
        description="Сила обратной связи",
    )


class MachinationsGraph(BaseModel):
    """
    Полный Machinations-граф (алгоритм 3.6.5).

    Направленный граф внутренней экономики игры.
    Узлы = экономические элементы (Source, Drain, Pool, Converter, etc.)
    Рёбра = потоки ресурсов и связи состояния.
    """
    nodes: list[MachinationsNode] = Field(
        default_factory=list,
        description="Узлы графа",
    )
    resource_flows: list[MachinationsResourceFlow] = Field(
        default_factory=list,
        description="Потоки ресурсов (сплошные стрелки)",
    )
    state_connections: list[MachinationsStateConnection] = Field(
        default_factory=list,
        description="Связи состояния (пунктирные стрелки)",
    )
    feedback_loops: list[MachinationsFeedbackLoop] = Field(
        default_factory=list,
        description="Петли обратной связи",
    )
    resource_count: int = Field(
        0,
        description="Количество уникальных ресурсов",
    )
    node_count: int = Field(
        0,
        description="Количество узлов",
    )
    flow_count: int = Field(
        0,
        description="Количество потоков",
    )
    economic_type: str = Field(
        "",
        description="Тип экономики: engine/economy/ecology/hybrid",
    )
    structural_patterns: list[str] = Field(
        default_factory=list,
        description="Обнаруженные структурные паттерны Adams/Dormans",
    )


class MachinationsSimConfig(BaseModel):
    """Конфигурация Machinations-симуляции экономики."""
    ticks: int = Field(
        1000,
        description="Количество тиков симуляции (1 тик ~ 1 действие Core Loop)",
    )
    num_runs: int = Field(
        100,
        description="Количество прогонов с разными стратегиями",
    )
    artificial_players: list[dict] = Field(
        default_factory=list,
        description="Архетипы игроков: optimal/casual/minmaxer/explorer",
    )
    recording_interval: int = Field(
        100,
        description="Интервал записи снепшота (каждые N тиков)",
    )
    resource_tracking: list[str] = Field(
        default_factory=list,
        description="Отслеживаемые ресурсы",
    )


class EconomyRunSnapshot(BaseModel):
    """Снепшот состояния экономики на определённом тике."""
    tick: int = Field(0, description="Номер тика")
    resources: dict[str, float] = Field(
        default_factory=dict,
        description="Значения ресурсов на этом тике",
    )
    level: int = Field(0, description="Текущий уровень прогрессии")
    actions_taken: list[str] = Field(
        default_factory=list,
        description="Действия, выполненные на этом тике",
    )


class AggregatedSimData(BaseModel):
    """Агрегированные данные Machinations-симуляции."""
    avg_resource_curves: dict[str, list[float]] = Field(
        default_factory=dict,
        description="Средние значения ресурсов по времени: resource → [values per interval]",
    )
    resource_ranges: dict[str, dict] = Field(
        default_factory=dict,
        description="Диапазоны ресурсов (min/max): resource → {min, max}",
    )
    runaway_frequency: float = Field(
        0.0,
        description="Доля прогонов с runaway (ресурс > 10 × initial)",
    )
    stall_frequency: float = Field(
        0.0,
        description="Доля прогонов со stall (ресурс < 0.1 × initial)",
    )
    avg_ticks_per_level: dict[int, float] = Field(
        default_factory=dict,
        description="Среднее количество тиков для достижения уровня",
    )
    build_gap: float = Field(
        0.0,
        description="Разрыв между optimal и casual прогрессией (×)",
    )
    stability_index: float = Field(
        0.0,
        description="Индекс стабильности (0-1, >0.7 = стабильно)",
    )


class QualityAssessment(BaseModel):
    """Оценка качества экономики по результатам Machinations-симуляции."""
    resources_in_bounds: bool = Field(
        True,
        description="Все ресурсы в пределах min/max",
    )
    progression_pacing_ok: bool = Field(
        True,
        description="Темп прогрессии соответствует целевым кривым",
    )
    no_runaway_for_minmaxer: bool = Field(
        True,
        description="Нет runaway при оптимальной стратегии (freq < 0.1)",
    )
    no_stall_for_casual: bool = Field(
        True,
        description="Нет stall при казуальной стратегии (freq < 0.1)",
    )
    build_gap_acceptable: bool = Field(
        True,
        description="Разрыв билдов приемлем (< 3.0×)",
    )
    economy_stable: bool = Field(
        True,
        description="Экономика стабильна (stability_index > 0.7)",
    )
    overall_pass: bool = Field(
        True,
        description="Общая оценка: все проверки пройдены",
    )
    critical_issues: list[str] = Field(
        default_factory=list,
        description="Критические проблемы",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Предупреждения",
    )


class MachinationsSimResult(BaseModel):
    """
    Результат Machinations-симуляции экономики — Этап 7 (алгоритм 3.6.9).

    Выполнение графа Machinations на N тиков с разными стратегиями,
    агрегация результатов, оценка качества экономики.
    """
    config: MachinationsSimConfig = Field(
        default_factory=MachinationsSimConfig,
        description="Конфигурация симуляции",
    )
    graph: Optional[MachinationsGraph] = Field(
        None,
        description="Построенный Machinations-граф",
    )
    runs: int = Field(
        0,
        description="Количество выполненных прогонов",
    )
    aggregated: Optional[AggregatedSimData] = Field(
        None,
        description="Агрегированные данные симуляции",
    )
    quality: Optional[QualityAssessment] = Field(
        None,
        description="Оценка качества экономики",
    )
    snapshots: list[EconomyRunSnapshot] = Field(
        default_factory=list,
        description="Снепшоты типичного прогона (для визуализации)",
    )
    detected_pathologies: list[str] = Field(
        default_factory=list,
        description="Обнаруженные патологии: runaway/deadlock/stall/oscillation/inflation/stagnation",
    )
    recommendations: list[str] = Field(
        default_factory=list,
        description="Рекомендации по коррекции экономики",
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
    - stability: Анализ устойчивости (Этап 3)
    - intransitive_result: Результат нетранзитивного анализа (Этап 4)
    - situational_result: Результат ситуационного анализа (Этап 5)
    - q_factor_result: Результат Q-фактор анализа
    - monte_carlo_result: Результат Monte Carlo-симуляции (Этап 6)
    - machinations_result: Результат Machinations-симуляции (Этап 7)
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
    stability: Optional[StabilityAnalysis] = Field(
        None,
        description="Результат анализа устойчивости (Этап 3)",
    )
    intransitive_result: Optional[IntransitiveResult] = Field(
        None,
        description="Результат нетранзитивного анализа (Этап 4)",
    )
    situational_result: Optional[SituationalResult] = Field(
        None,
        description="Результат ситуационного анализа (Этап 5)",
    )
    q_factor_result: Optional[QFactorResult] = Field(
        None,
        description="Результат Q-фактор анализа",
    )
    monte_carlo_result: Optional[MonteCarloResult] = Field(
        None,
        description="Результат Monte Carlo-симуляции (Этап 6, 4.C.3)",
    )
    machinations_result: Optional[MachinationsSimResult] = Field(
        None,
        description="Результат Machinations-симуляции (Этап 7, 4.C.3)",
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
