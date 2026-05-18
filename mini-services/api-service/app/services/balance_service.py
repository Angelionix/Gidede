"""
Gidede — Balance Service
Фаза 4.C.1–4.C.2: Блок 4 — Балансировка (алгоритм 3.4)

Реализация пайплайна балансировки из алгоритма 3.4:
- Этап 1: Классификация задачи балансировки → BalanceMap (3.4.3)
  • Определение primary/secondary balance models
  • Выбор anchor-ресурса
  • Определение game sum type и feedback type
  • Построение applicable_balance_types

- Этап 2: Transitive-анализ → TransitiveResult (3.4.4)
  • Шаг 2.1: Расчёт attribute_weights (least squares / ESTIMATE_WEIGHTS)
  • Шаг 2.2: Расчёт power, cost, cp_ratio для каждого объекта
  • Шаг 2.3: Построение cost curve model (identity/shifted_identity/progression)
  • Шаг 2.4: Идентификация overpowered/underpowered/balanced/ideal_imbalance
  • Шаг 2.5: Проверка ideal_imbalance (5-15% отклонение)
  • Генерация warnings и suggestions

- Этап 3: Анализ устойчивости → StabilityAssessment (3.4.5)
  • 6 комбинаций sum_type × feedback_type (Schreiber)
  • Проверка патологий: runaway, deadlock, stall
  • Корректирующие рекомендации

- Этап 4: Нетранзитивный анализ → IntransitiveResult (3.4.5 / 4.C.2)
  • Построение payoff-матрицы
  • Поиск RPS-циклов
  • Равновесие Нэша
  • Анализ распределения стратегий

- Этап 5: Ситуационный анализ → SituationalResult (3.4.6 / 4.C.2)
  • Определение ситуаций (по жанру)
  • Оценка ситуационной ценности
  • Универсальность vs специализация

- Q-фактор → QFactorResult (3.4.7 / 4.C.2)
  • Выявление избыточных компонентов
  • Q-матрица (объекты × атрибуты)

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry), 4.A.12 (Shared Types)
"""

import time
import logging
import math
import random
from typing import Any, Optional

from app.ai.executor import PromptExecutor, PromptResult, PromptExecutionOptions
from app.prompts.registry import get_prompt_spec

from app.schemas.balance import (
    BalanceObject,
    BalanceInput,
    BalanceMap,
    ObjectBalanceReport,
    TransitiveResult,
    IntransitiveResult,
    StrategyBalanceScore,
    RPSCycle,
    SituationalResult,
    Situation,
    VersatilityInfo,
    QFactorResult,
    QFactorObject,
    BalanceResult,
    StabilityAnalysis,
    SimulationConfig,
    MatchupData,
    NumberFormatReport,
    MonteCarloResult,
    MachinationsNode,
    MachinationsResourceFlow,
    MachinationsStateConnection,
    MachinationsFeedbackLoop,
    MachinationsGraph,
    MachinationsSimConfig,
    EconomyRunSnapshot,
    AggregatedSimData,
    QualityAssessment,
    MachinationsSimResult,
)

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.4
# ============================================================

# Пороговые значения THRESHOLD по типу игры (алгоритм 3.4.4)
# Отклонение от кривой, при котором объект считается дисбалансным
THRESHOLD_BY_MODE: dict[str, float] = {
    "PvP": 0.10,      # PvP — строгий баланс (10%)
    "PvE": 0.15,       # PvE — умеренный (15%)
    "PvPvE": 0.12,     # PvPvE — промежуточный
    "casual": 0.20,    # Казуальные — мягкий (20%)
}

# Диапазон ideal_imbalance: 5-15% отклонение (алгоритм 3.4.4)
IDEAL_IMBALANCE_MIN = 0.05
IDEAL_IMBALANCE_MAX = 0.15

# Маппинг «game_mode → primary_balance_model» (алгоритм 3.4.3)
GAME_MODE_TO_PRIMARY_MODEL: dict[str, str] = {
    "PvP": "transitive",        # PvP → transitive (cost-power)
    "PvE": "progression",       # PvE → progression (кривая сложности)
    "PvPvE": "mixed",           # PvPvE → mixed
}

# Маппинг «game_mode → game_sum_type» (Schreiber, Кн. 14)
GAME_MODE_TO_SUM_TYPE: dict[str, str] = {
    "PvP": "zero",         # PvP — zero-sum
    "PvE": "positive",     # PvE — positive sum (оба могут выиграть)
    "PvPvE": "positive",   # PvPvE — positive sum
}

# Маппинг «game_mode → feedback_type» (Schreiber)
GAME_MODE_TO_FEEDBACK: dict[str, str] = {
    "PvP": "balancing",     # PvP → balancing feedback
    "PvE": "reinforcing",   # PvE → reinforcing feedback (прогрессия)
    "PvPvE": "both",        # PvPvE → both
}

# Маппинг «game_mode → cost_curve_model» (алгоритм 3.4.4)
GAME_MODE_TO_COST_CURVE: dict[str, str] = {
    "PvP": "identity",            # PvP → identity (cost = power)
    "PvE": "progression",         # PvE → progression (power растёт быстрее cost)
    "PvPvE": "shifted_identity",  # PvPvE → shifted_identity
}

# Маппинг «объект type → default_anchor_resource»
OBJECT_TYPE_TO_ANCHOR: dict[str, str] = {
    "character": "gold",
    "weapon": "gold",
    "unit": "gold",
    "ability": "mana",
    "item": "gold",
    "class": "experience",
}

# Жанровые пороги (более мягкие для определённых жанров)
GENRE_THRESHOLD_OVERRIDE: dict[str, float] = {
    "party": 0.25,           # Party — очень мягкий
    "idle": 0.20,            # Idle — мягкий
    "sandbox": 0.20,         # Sandbox — мягкий
    "visual_novel": 0.30,    # Визуальная новелла — не нужен баланс
    "puzzle": 0.15,          # Puzzle — умеренный
}

# Матрица устойчивости Schreiber (6 комбинаций sum × feedback)
# (sum_type, feedback_type) → pathology risk
SCHREIBER_STABILITY_MATRIX: dict[tuple[str, str], dict[str, Any]] = {
    ("positive", "reinforcing"): {
        "stability": "unstable",
        "pathology_risk": "runaway",
        "description": "Усиливающая петля в positive-sum игре → runaway (бесконечный рост)",
        "correction": "Добавить negative feedback: убывающая доходность, порог насыщения",
    },
    ("positive", "balancing"): {
        "stability": "stable",
        "pathology_risk": "none",
        "description": "Балансирующая петля в positive-sum игре → устойчиво",
        "correction": "",
    },
    ("positive", "both"): {
        "stability": "conditionally_stable",
        "pathology_risk": "oscillation",
        "description": "Оба типа ОС в positive-sum → условно устойчиво, риск осцилляции",
        "correction": "Убедиться, что balancing-ОС доминирует над reinforcing-ОС",
    },
    ("zero", "reinforcing"): {
        "stability": "unstable",
        "pathology_risk": "runaway",
        "description": "Усиливающая петля в zero-sum → runaway (доминантная стратегия)",
        "correction": "Добавить компенсирующие mechanics (negative feedback, diminishing returns)",
    },
    ("zero", "balancing"): {
        "stability": "stable",
        "pathology_risk": "none",
        "description": "Балансирующая петля в zero-sum → устойчиво (Nash equilibrium)",
        "correction": "",
    },
    ("zero", "both"): {
        "stability": "conditionally_stable",
        "pathology_risk": "oscillation",
        "description": "Оба типа ОС в zero-sum → условно устойчиво",
        "correction": "Проверить, что balancing-ОС сдерживает reinforcing-ОС",
    },
    ("negative", "reinforcing"): {
        "stability": "unstable",
        "pathology_risk": "deadlock",
        "description": "Усиливающая петля в negative-sum → deadlock (распад системы)",
        "correction": "Добавить external resource injection, reset mechanics",
    },
    ("negative", "balancing"): {
        "stability": "stable",
        "pathology_risk": "stall",
        "description": "Балансирующая петля в negative-sum → stall (система останавливается)",
        "correction": "Добавить источники ресурсов (faucets), чтобы компенсировать drain",
    },
    ("negative", "both"): {
        "stability": "unstable",
        "pathology_risk": "deadlock",
        "description": "Оба типа ОС в negative-sum → неустойчиво, риск deadlock",
        "correction": "Добавить external resource injection и reset mechanics",
    },
}

# Жанровые ситуации для ситуационного анализа (алгоритм 3.4.6)
GENRE_SITUATIONS: dict[str, list[dict]] = {
    "rpg": [
        {"name": "Одиночный сильный враг", "probability": 0.3},
        {"name": "Группа слабых врагов", "probability": 0.4},
        {"name": "Босс", "probability": 0.1},
        {"name": "Стелс-секция", "probability": 0.1},
        {"name": "Защита точки", "probability": 0.1},
    ],
    "action": [
        {"name": "Одиночный сильный враг", "probability": 0.3},
        {"name": "Группа слабых врагов", "probability": 0.4},
        {"name": "Босс", "probability": 0.1},
        {"name": "Стелс-секция", "probability": 0.1},
        {"name": "Защита точки", "probability": 0.1},
    ],
    "strategy": [
        {"name": "Ранняя игра (экономика)", "probability": 0.3},
        {"name": "Мидгейм (война)", "probability": 0.4},
        {"name": "Лейтгейм (осадные орудия)", "probability": 0.2},
        {"name": "Оборона базы", "probability": 0.1},
    ],
    "rts": [
        {"name": "Ранняя игра (экономика)", "probability": 0.3},
        {"name": "Мидгейм (война)", "probability": 0.4},
        {"name": "Лейтгейм (осадные орудия)", "probability": 0.2},
        {"name": "Оборона базы", "probability": 0.1},
    ],
}

# Пороги для ситуационного анализа
VERSATILITY_SPREAD_THRESHOLD = 0.3  # spread < 0.3 → universal, >= 0.3 → specialized
DOMINANT_UNIVERSAL_EV_THRESHOLD = 1.2  # EV > 1.2 для универсального → потенциально доминантный
DEAD_ZONE_MAX_VALUE = 1.5  # max situational value < 1.5 → мёртвая зона
DOMINANT_STRATEGY_SHARE = 0.5  # share > 50% → доминантная стратегия

# Элементальные преимущества для нетранзитивного анализа
ELEMENTAL_ADVANTAGES: dict[str, str] = {
    "fire": "ice",
    "ice": "lightning",
    "lightning": "fire",
    "light": "dark",
    "dark": "light",
    "holy": "undead",
    "undead": "poison",
    "poison": "holy",
}

# Monte Carlo-симуляция: пороговые значения (алгоритм 3.4.9)
WIN_RATE_SPREAD_GOOD = 0.15      # < 0.15 → GOOD
WIN_RATE_SPREAD_MODERATE = 0.30  # < 0.30 → MODERATE, >= 0.30 → POOR
SPEARMAN_CORRELATION_WARNING = 0.5  # < 0.5 → расхождение с формальным анализом

# Machinations: default игрок-архетипы (алгоритм 3.6.9)
DEFAULT_ARTIFICIAL_PLAYERS = [
    {"name": "optimal", "strategy": "maximize_progression"},
    {"name": "casual", "strategy": "random_balanced"},
    {"name": "minmaxer", "strategy": "exploit_best_cycle"},
    {"name": "explorer", "strategy": "try_all_options"},
]

# Adams/Dormans structural patterns for Machinations graph
ADAMS_DORMANS_PATTERNS = [
    "Static Engine", "Dynamic Engine", "Converter Engine",
    "Engine Building", "Static Friction", "Dynamic Friction",
    "Stopping Mechanism", "Attrition", "Escalating Challenge",
    "Escalating Complexity", "Arms Race", "Play-Style Reinforcement",
    "Multiple Feedback", "Trade", "Worker Placement", "Slow Cycle",
]


# ============================================================
# Balance Service
# ============================================================

class BalanceService:
    """
    Блок 4: Анализ баланса.
    Реализует алгоритм 3.4 — Этапы 1–5 + Q-фактор + Этапы 6-7 (симуляции).

    Методы:
    - classify_balance_task() — Этап 1: классификация задачи балансировки
    - transitive_balance() — Этап 2: transitive-анализ (cost-power кривые)
    - analyze_stability() — Этап 3: анализ устойчивости (Schreiber)
    - intransitive_balance() — Этап 4: нетранзитивный анализ (RPS-структуры)
    - situational_balance() — Этап 5: ситуационный анализ (контекстная ценность)
    - calculate_q_factor() — Q-фактор: выявление избыточных компонентов
    - monte_carlo_simulate() — Этап 6: Monte Carlo-симуляция (стохастическая валидация)
    - build_machinations_graph() — Этап 7a: построение Machinations-графа экономики
    - machinations_simulate() — Этап 7b: Machinations-симуляция экономики
    - analyze_simulation_stability() — комбинированный анализ устойчивости (MC + Machinations)
    - balance_full() — полный пайплайн Этапов 1–7 + Q-фактор
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Классификация задачи балансировки (3.4.3)
    # ========================================================

    async def classify_balance_task(
        self,
        input_data: BalanceInput,
        mda_profile: Optional[dict] = None,
    ) -> BalanceMap:
        """
        Этап 1: Определение параметров балансировки на основе входных данных.

        Алгоритм 3.4.3:
        1. Определить primary/secondary balance models по game_mode и objects
        2. Выбрать anchor-ресурс
        3. Определить game sum type и feedback type
        4. Построить applicable_balance_types map

        Returns:
            BalanceMap с параметрами балансировки
        """
        start = time.time()
        game_mode = input_data.game_mode

        # === Шаг 1.1: Primary/Secondary balance models ===
        primary_model = GAME_MODE_TO_PRIMARY_MODEL.get(game_mode, "transitive")

        # Secondary model зависит от balance_type и разнообразия объектов
        secondary_model = ""
        object_types = set(obj.type for obj in input_data.objects)

        if input_data.balance_type == "mixed":
            secondary_model = "situational"
        elif len(object_types) >= 3:
            secondary_model = "intransitive"
        elif primary_model == "transitive":
            secondary_model = ""
        else:
            secondary_model = "transitive"

        # Если есть MDA-профиль, обогащаем
        if mda_profile:
            dynamics = mda_profile.get("dynamics_target", {})
            core_dynamics = dynamics.get("core_dynamics", [])
            if any("соревнован" in d.lower() or "competition" in d.lower() for d in core_dynamics):
                if primary_model != "intransitive":
                    secondary_model = "intransitive"

        # === Шаг 1.2: Anchor resource ===
        anchor = input_data.anchor_resource
        if not anchor:
            # Выбираем по типам объектов
            type_counts: dict[str, int] = {}
            for obj in input_data.objects:
                type_counts[obj.type] = type_counts.get(obj.type, 0) + 1

            dominant_type = max(type_counts, key=type_counts.get) if type_counts else "character"
            anchor = OBJECT_TYPE_TO_ANCHOR.get(dominant_type, "gold")

        # === Шаг 1.3: Game sum type и feedback type ===
        game_sum = GAME_MODE_TO_SUM_TYPE.get(game_mode, "positive")
        feedback = GAME_MODE_TO_FEEDBACK.get(game_mode, "balancing")

        # === Шаг 1.4: applicable_balance_types ===
        applicable: dict[str, bool] = {
            "transitive": True,       # Transitive всегда применим
            "intransitive": game_mode == "PvP" or len(object_types) >= 3,
            "situational": len(input_data.objects) >= 3,
            "simulation": len(input_data.objects) >= 3,
        }

        # === Макро-модель ===
        macro_model = {
            "game_mode": game_mode,
            "object_count": len(input_data.objects),
            "object_types": list(object_types),
            "has_costs": any(obj.cost is not None for obj in input_data.objects),
            "has_tiers": any(obj.tier is not None for obj in input_data.objects),
        }

        balance_map = BalanceMap(
            primary_model=primary_model,
            secondary_model=secondary_model,
            anchor=anchor,
            game_sum=game_sum,
            feedback=feedback,
            macro_model=macro_model,
            applicable_balance_types=applicable,
        )

        logger.info(
            f"[Stage 1] Balance task classified: "
            f"primary={primary_model}, secondary={secondary_model}, "
            f"anchor={anchor}, sum={game_sum}, feedback={feedback} "
            f"({time.time() - start:.2f}s)"
        )
        return balance_map

    # ========================================================
    # Этап 2: Transitive-анализ (3.4.4)
    # ========================================================

    async def transitive_balance(
        self,
        input_data: BalanceInput,
        balance_map: BalanceMap,
        project_state: Optional[dict] = None,
    ) -> TransitiveResult:
        """
        Этап 2: Transitive-анализ баланса — cost-power кривые.

        Алгоритм 3.4.4:
        1. Рассчитать attribute_weights (least squares / ESTIMATE_WEIGHTS)
        2. Рассчитать power, cost, cp_ratio для каждого объекта
        3. Построить cost curve model (identity/shifted_identity/progression)
        4. Идентифицировать overpowered/underpowered/balanced/ideal_imbalance
        5. Проверить ideal_imbalance (5-15% отклонение)
        6. Сгенерировать warnings и suggestions

        Returns:
            TransitiveResult с результатами transitive-анализа
        """
        start = time.time()
        game_mode = input_data.game_mode

        # === Шаг 2.1: Расчёт attribute_weights ===
        attribute_weights = await self._calculate_attribute_weights(
            input_data, project_state
        )

        # === Шаг 2.2: Расчёт power, cost, cp_ratio ===
        cost_curve_model = GAME_MODE_TO_COST_CURVE.get(game_mode, "identity")

        reports: list[ObjectBalanceReport] = []
        for obj in input_data.objects:
            power = self._calculate_power(obj, attribute_weights)
            effective_cost = self._calculate_effective_cost(obj, cost_curve_model)
            cp_ratio = effective_cost / power if power > 0 else float("inf")
            expected_cp = self._get_expected_cp(cost_curve_model, obj)
            distance = cp_ratio - expected_cp if cp_ratio != float("inf") else float("inf")

            reports.append(
                ObjectBalanceReport(
                    name=obj.name,
                    power=round(power, 4),
                    effective_cost=round(effective_cost, 4),
                    cp_ratio=round(cp_ratio, 4) if cp_ratio != float("inf") else float("inf"),
                    distance_from_curve=round(distance, 4) if distance != float("inf") else float("inf"),
                    status="balanced",  # будет обновлён ниже
                )
            )

        # === Шаг 2.3: Cost curve model уже определён ===
        # (выше, на основе game_mode)

        # === Шаг 2.4: Идентификация статуса объектов ===
        threshold = self._get_threshold(game_mode, input_data.genre)

        overpowered: list[str] = []
        underpowered: list[str] = []
        balanced: list[str] = []
        ideal_imbalance: list[str] = []

        for report in reports:
            abs_distance = abs(report.distance_from_curve)
            if abs_distance == float("inf"):
                report.status = "underpowered"  # Бесконечное отклонение — точно underpowered
                underpowered.append(report.name)
            elif report.distance_from_curve < -threshold:
                report.status = "overpowered"
                overpowered.append(report.name)
            elif report.distance_from_curve > threshold:
                report.status = "underpowered"
                underpowered.append(report.name)
            elif IDEAL_IMBALANCE_MIN <= abs_distance <= IDEAL_IMBALANCE_MAX:
                report.status = "ideal_imbalance"
                ideal_imbalance.append(report.name)
            else:
                report.status = "balanced"
                balanced.append(report.name)

        # === Шаг 2.5: Проверка ideal_imbalance ===
        # ideal_imbalance — это преднамеренное отклонение 5-15% от кривой
        # допустимое в PvE для создания ощущения прогрессии

        # === Генерация warnings и suggestions ===
        warnings = self._generate_warnings(
            overpowered, underpowered, reports, threshold, game_mode
        )
        suggestions = self._generate_suggestions(
            overpowered, underpowered, ideal_imbalance, reports, cost_curve_model
        )

        # Ожидаемое cp
        expected_cp = 1.0
        if cost_curve_model == "progression":
            expected_cp = 0.8  # В progression-модели power > cost
        elif cost_curve_model == "shifted_identity":
            expected_cp = 1.1  # Сдвиг

        result = TransitiveResult(
            attribute_weights=attribute_weights,
            cost_curve_model=cost_curve_model,
            expected_cp=expected_cp,
            objects=reports,
            overpowered=overpowered,
            underpowered=underpowered,
            balanced=balanced,
            ideal_imbalance=ideal_imbalance,
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Stage 2] Transitive balance: "
            f"{len(overpowered)} OP, {len(underpowered)} UP, "
            f"{len(balanced)} balanced, {len(ideal_imbalance)} ideal_imbalance "
            f"(threshold={threshold:.2f}, curve={cost_curve_model}) "
            f"({time.time() - start:.2f}s)"
        )
        return result

    # ========================================================
    # Вспомогательные методы для Этапа 2
    # ========================================================

    async def _calculate_attribute_weights(
        self,
        input_data: BalanceInput,
        project_state: Optional[dict] = None,
    ) -> dict[str, float]:
        """
        Шаг 2.1: Расчёт весов атрибутов.

        Стратегия:
        1. Если есть «vanilla» объекты с cost → least squares (cost = Σ w_i * a_i)
        2. Если данных мало → AI через ESTIMATE_WEIGHTS
        3. Fallback → равные веса
        """
        objects = input_data.objects
        all_attrs: set[str] = set()
        for obj in objects:
            all_attrs.update(obj.attributes.keys())

        if not all_attrs:
            return {}

        # Пытаемся least squares на vanilla-объектах с cost
        vanilla_objects = [
            obj for obj in objects
            if obj.cost is not None and "special" not in obj.tags and "unique" not in obj.tags
        ]

        if len(vanilla_objects) >= len(all_attrs) + 1:
            # Достаточно данных для least squares
            weights = self._least_squares_weights(vanilla_objects, list(all_attrs))
            if weights:
                return weights

        # AI estimation через ESTIMATE_WEIGHTS
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="ESTIMATE_WEIGHTS",
                inputs={
                    "objects": [obj.model_dump() for obj in objects[:10]],
                    "game_mode": input_data.game_mode,
                    "genre": input_data.genre,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            ai_weights = prompt_result.data
            if isinstance(ai_weights, dict) and "weights" in ai_weights:
                weights_dict = ai_weights["weights"]
                if isinstance(weights_dict, dict) and len(weights_dict) > 0:
                    return weights_dict
            elif isinstance(ai_weights, dict):
                # Возможно, формат {attr: weight}
                numeric_values = {
                    k: float(v) for k, v in ai_weights.items()
                    if isinstance(v, (int, float))
                }
                if numeric_values:
                    return numeric_values

        except Exception as e:
            logger.warning(
                f"[Stage 2.1] AI weight estimation (ESTIMATE_WEIGHTS) failed, "
                f"using equal weights: {e}"
            )

        # Fallback: равные веса
        weight = 1.0 / len(all_attrs)
        return {attr: round(weight, 4) for attr in all_attrs}

    def _least_squares_weights(
        self,
        vanilla_objects: list[BalanceObject],
        attrs: list[str],
    ) -> Optional[dict[str, float]]:
        """
        Решение системы cost = Σ(w_i * a_i) методом наименьших квадратов.

        Решает Ax = b, где:
        - A — матрица атрибутов (objects × attrs)
        - b — вектор стоимостей
        - x — вектор весов
        """
        n = len(vanilla_objects)
        m = len(attrs)

        if n < m:
            return None

        # Строим матрицу A и вектор b
        A: list[list[float]] = []
        b: list[float] = []

        for obj in vanilla_objects:
            row = [obj.attributes.get(attr, 0.0) for attr in attrs]
            cost = obj.cost
            if cost is None:
                continue
            A.append(row)
            b.append(cost)

        if len(A) < m:
            return None

        # Простой least squares через нормальные уравнения: (A^T A) x = A^T b
        try:
            # A^T
            AT = [[A[j][i] for j in range(len(A))] for i in range(m)]

            # A^T A
            ATA = [
                [
                    sum(AT[i][k] * AT[j][k] for k in range(len(A)))
                    for j in range(m)
                ]
                for i in range(m)
            ]

            # A^T b
            ATb = [
                sum(AT[i][k] * b[k] for k in range(len(b)))
                for i in range(m)
            ]

            # Решаем систему ATA x = ATb методом Гаусса
            weights_vec = self._solve_linear_system(ATA, ATb)
            if weights_vec is None:
                return None

            # Нормализуем веса (сумма = 1)
            total = sum(abs(w) for w in weights_vec)
            if total < 1e-10:
                return None

            result = {}
            for i, attr in enumerate(attrs):
                result[attr] = round(abs(weights_vec[i]) / total, 4)

            return result

        except Exception as e:
            logger.warning(f"Least squares failed: {e}")
            return None

    def _solve_linear_system(
        self,
        A: list[list[float]],
        b: list[float],
    ) -> Optional[list[float]]:
        """Решение линейной системы методом Гаусса с частичным выбором ведущего элемента."""
        n = len(b)
        if n == 0:
            return None

        # Создаём расширенную матрицу [A|b]
        M = [row[:] + [b[i]] for i, row in enumerate(A)]

        # Прямой ход
        for col in range(n):
            # Частичный выбор ведущего элемента
            max_row = col
            max_val = abs(M[col][col])
            for row in range(col + 1, n):
                if abs(M[row][col]) > max_val:
                    max_val = abs(M[row][col])
                    max_row = row

            if max_val < 1e-10:
                continue  # Сингулярная матрица — пропускаем

            M[col], M[max_row] = M[max_row], M[col]

            for row in range(col + 1, n):
                factor = M[row][col] / M[col][col]
                for j in range(col, n + 1):
                    M[row][j] -= factor * M[col][j]

        # Обратный ход
        x = [0.0] * n
        for i in range(n - 1, -1, -1):
            if abs(M[i][i]) < 1e-10:
                x[i] = 0.0
                continue
            s = M[i][n]
            for j in range(i + 1, n):
                s -= M[i][j] * x[j]
            x[i] = s / M[i][i]

        return x

    def _calculate_power(
        self,
        obj: BalanceObject,
        weights: dict[str, float],
    ) -> float:
        """Расчёт мощности объекта: power = Σ(weight_i * attribute_i)."""
        power = 0.0
        for attr, value in obj.attributes.items():
            weight = weights.get(attr, 0.0)
            power += weight * value
        return power

    def _calculate_effective_cost(
        self,
        obj: BalanceObject,
        cost_curve_model: str,
    ) -> float:
        """Расчёт эффективной стоимости объекта."""
        if obj.cost is not None and obj.cost > 0:
            return obj.cost

        # Если cost не задан — оцениваем по атрибутам
        attr_sum = sum(obj.attributes.values())

        if cost_curve_model == "identity":
            # identity: cost ≈ power
            return max(attr_sum, 1.0)
        elif cost_curve_model == "progression":
            # progression: cost растёт медленнее power
            # Эффективная стоимость ниже суммы атрибутов
            return max(attr_sum * 0.8, 1.0)
        elif cost_curve_model == "shifted_identity":
            # shifted_identity: небольшой сдвиг
            return max(attr_sum * 1.1, 1.0)
        else:
            return max(attr_sum, 1.0)

    def _get_expected_cp(
        self,
        cost_curve_model: str,
        obj: BalanceObject,
    ) -> float:
        """Получить ожидаемое cp_ratio для данной модели кривой."""
        if cost_curve_model == "identity":
            return 1.0
        elif cost_curve_model == "progression":
            # В progression ожидаем cp_ratio < 1 (power > cost)
            if obj.tier is not None and obj.tier > 1:
                return 1.0 - (obj.tier - 1) * 0.05  # Каждый тир чуть сильнее
            return 0.85
        elif cost_curve_model == "shifted_identity":
            return 1.1
        return 1.0

    def _get_threshold(self, game_mode: str, genre: str) -> float:
        """Получить порог дисбаланса с учётом жанра."""
        # Жанровый override
        if genre in GENRE_THRESHOLD_OVERRIDE:
            return GENRE_THRESHOLD_OVERRIDE[genre]

        return THRESHOLD_BY_MODE.get(game_mode, 0.15)

    def _generate_warnings(
        self,
        overpowered: list[str],
        underpowered: list[str],
        reports: list[ObjectBalanceReport],
        threshold: float,
        game_mode: str,
    ) -> list[str]:
        """Генерация предупреждений о дисбалансе."""
        warnings: list[str] = []

        if overpowered:
            if len(overpowered) > len(reports) * 0.3:
                warnings.append(
                    f"Более 30% объектов overpowered ({len(overpowered)}/{len(reports)}). "
                    f"Возможно, порог ({threshold:.0%}) слишком строгий для {game_mode}."
                )
            else:
                warnings.append(
                    f"Overpowered объекты: {', '.join(overpowered)}. "
                    f"Они слишком эффективны для своей стоимости."
                )

        if underpowered:
            if len(underpowered) > len(reports) * 0.3:
                warnings.append(
                    f"Более 30% объектов underpowered ({len(underpowered)}/{len(reports)}). "
                    f"Возможно, порог ({threshold:.0%}) слишком строгий или baseline завышен."
                )
            else:
                warnings.append(
                    f"Underpowered объекты: {', '.join(underpowered)}. "
                    f"Они неоправданно слабы для своей стоимости."
                )

        # Проверка extremes
        for report in reports:
            if report.distance_from_curve != float("inf"):
                if abs(report.distance_from_curve) > 2 * threshold:
                    warnings.append(
                        f"'{report.name}' имеет экстремальное отклонение "
                        f"({abs(report.distance_from_curve):.1%}). Требуется немедленная коррекция."
                    )

        if not warnings:
            warnings.append("Баланс в пределах нормы. Серьёзных проблем не обнаружено.")

        return warnings

    def _generate_suggestions(
        self,
        overpowered: list[str],
        underpowered: list[str],
        ideal_imbalance: list[str],
        reports: list[ObjectBalanceReport],
        cost_curve_model: str,
    ) -> list[str]:
        """Генерация предложений по коррекции баланса."""
        suggestions: list[str] = []

        for name in overpowered:
            report = next((r for r in reports if r.name == name), None)
            if report:
                distance = abs(report.distance_from_curve)
                if cost_curve_model == "identity":
                    suggestions.append(
                        f"'{name}': увеличить cost на {distance:.0%} или "
                        f"уменьшить power на {distance:.0%}"
                    )
                elif cost_curve_model == "progression":
                    suggestions.append(
                        f"'{name}': уменьшить атрибуты на {distance:.0%} "
                        f"или повысить требования для получения"
                    )
                else:
                    suggestions.append(
                        f"'{name}': скорректировать cost/power ratio на {distance:.0%}"
                    )

        for name in underpowered:
            report = next((r for r in reports if r.name == name), None)
            if report:
                distance = abs(report.distance_from_curve)
                if cost_curve_model == "identity":
                    suggestions.append(
                        f"'{name}': уменьшить cost на {distance:.0%} или "
                        f"увеличить power на {distance:.0%}"
                    )
                elif cost_curve_model == "progression":
                    suggestions.append(
                        f"'{name}': усилить атрибуты на {distance:.0%} "
                        f"или добавить situational бонусы"
                    )
                else:
                    suggestions.append(
                        f"'{name}': скорректировать cost/power ratio на {distance:.0%}"
                    )

        if ideal_imbalance:
            suggestions.append(
                f"Ideal imbalance: {', '.join(ideal_imbalance)} — "
                f"преднамеренное отклонение (5-15%), допустимое в PvE. "
                f"Не корректировать, если это задумано."
            )

        if not suggestions:
            suggestions.append("Коррекция не требуется — все объекты сбалансированы.")

        return suggestions

    # ========================================================
    # Этап 3: Анализ устойчивости (3.4.5 / Schreiber)
    # ========================================================

    def analyze_stability(self, feedback_loops: list[dict]) -> dict:
        """
        Этап 3: Анализ устойчивости системы.

        Анализирует 6 комбинаций sum_type × feedback_type (Schreiber)
        и проверяет на патологии: runaway, deadlock, stall.

        Args:
            feedback_loops: Список петель обратной связи.
                Каждый элемент: {
                    "loop_type": "positive" | "negative",
                    "description": str,
                    "mechanics_involved": list[str],
                }

        Returns:
            {
                "overall_stability": "stable" | "unstable" | "conditionally_stable",
                "pathology_risks": list[str],
                "analysis": list[dict],  # Анализ каждой комбинации
                "positive_loops": int,
                "negative_loops": int,
                "recommendations": list[str],
            }
        """
        positive_loops = sum(1 for loop in feedback_loops if loop.get("loop_type") == "positive")
        negative_loops = sum(1 for loop in feedback_loops if loop.get("loop_type") == "negative")

        # Определяем доминирующий тип ОС
        if positive_loops > negative_loops:
            feedback_dominant = "reinforcing"
        elif negative_loops > positive_loops:
            feedback_dominant = "balancing"
        else:
            feedback_dominant = "both"

        # Анализируем все релевантные комбинации
        analysis: list[dict] = []
        pathology_risks: list[str] = []
        recommendations: list[str] = []

        # Определяем sum_types для анализа
        sum_types = ["positive", "zero", "negative"]

        for sum_type in sum_types:
            key = (sum_type, feedback_dominant)
            entry = SCHREIBER_STABILITY_MATRIX.get(key)

            if entry:
                analysis_item = {
                    "sum_type": sum_type,
                    "feedback": feedback_dominant,
                    "stability": entry["stability"],
                    "pathology_risk": entry["pathology_risk"],
                    "description": entry["description"],
                }
                analysis.append(analysis_item)

                if entry["pathology_risk"] != "none":
                    pathology_risks.append(entry["pathology_risk"])

                if entry["correction"]:
                    recommendations.append(entry["correction"])

        # Общая оценка устойчивости
        stability_scores = {
            "stable": 0,
            "conditionally_stable": 0,
            "unstable": 0,
        }
        for item in analysis:
            stability_scores[item["stability"]] = stability_scores.get(item["stability"], 0) + 1

        if stability_scores.get("unstable", 0) > 0:
            overall_stability = "unstable"
        elif stability_scores.get("conditionally_stable", 0) > 0:
            overall_stability = "conditionally_stable"
        else:
            overall_stability = "stable"

        # Дополнительные рекомендации
        if positive_loops > 3 and negative_loops < 2:
            recommendations.append(
                "Слишком много усиливающих петель при малом количестве балансирующих. "
                "Добавьте negative feedback (убывающая доходность,cooldowns)."
            )
        if negative_loops > 3 and positive_loops < 2:
            recommendations.append(
                "Слишком много балансирующих петель — система может停滞 (stall). "
                "Добавьте positive feedback (прогрессия, награды)."
            )

        return {
            "overall_stability": overall_stability,
            "pathology_risks": pathology_risks,
            "analysis": analysis,
            "positive_loops": positive_loops,
            "negative_loops": negative_loops,
            "recommendations": recommendations,
        }

    # ========================================================
    # Этап 4: Нетранзитивный анализ (3.4.5 / 4.C.2)
    # ========================================================

    async def intransitive_balance(
        self,
        input_data: BalanceInput,
        transitive_result: TransitiveResult,
        balance_map: BalanceMap,
        project_state: Optional[dict] = None,
    ) -> IntransitiveResult:
        """
        Этап 4 (4.C.2): Нетранзитивный анализ — RPS-структуры.

        Алгоритм 3.4.5:
        1. Построение payoff-матрицы (A × B)
        2. Проверка на нетранзитивность (RPS-циклы)
        3. Поиск равновесия Нэша
        4. Анализ распределения стратегий (entropy, max_share, gini)
        5. Проверка доминантных стратегий
        6. AI-коррекции через SUGGEST_INTRANSITIVE_CORRECTIONS
        """
        start = time.time()
        objects = input_data.objects
        n = len(objects)
        object_names = [obj.name for obj in objects]

        # === Шаг 4.1: Построение payoff-матрицы ===
        payoff_matrix = self._build_payoff_matrix(objects, transitive_result)

        # === Шаг 4.2: Проверка на нетранзитивность (RPS-циклы) ===
        rps_cycles = self._find_rps_cycles(payoff_matrix, object_names)
        is_intransitive = len(rps_cycles) > 0

        # === Шаг 4.3: Вычисление равновесия Нэша ===
        nash_equilibrium, dominated_strategies = self._compute_nash_equilibrium(
            payoff_matrix, n
        )

        # === Шаг 4.4: Анализ распределения стратегий ===
        strategy_balance = self._compute_strategy_balance(nash_equilibrium, n)

        # === Шаг 4.5: Проверка доминантных стратегий ===
        has_dominant_strategy = (
            strategy_balance is not None
            and strategy_balance.max_share > DOMINANT_STRATEGY_SHARE
        )

        # === Шаг 4.6: AI-коррекции ===
        warnings: list[str] = []
        suggestions: list[str] = []

        if has_dominant_strategy:
            dominant_idx = nash_equilibrium.index(max(nash_equilibrium))
            dominant_name = object_names[dominant_idx] if dominant_idx < len(object_names) else f"объект #{dominant_idx}"
            warnings.append(
                f"Доминантная стратегия: '{dominant_name}' "
                f"(доля {max(nash_equilibrium):.1%}). "
                f"Это разрушает разнообразие геймплея."
            )

            # Попытка AI-коррекции
            ai_suggestions = await self._ai_suggest_intransitive_corrections(
                input_data, payoff_matrix, object_names, nash_equilibrium, project_state
            )
            if ai_suggestions:
                suggestions.extend(ai_suggestions)
            else:
                # Fallback: правило-основанные рекомендации
                suggestions.append(
                    f"Ослабить '{dominant_name}' или усилить его контр-стратегии."
                )
                if is_intransitive:
                    suggestions.append(
                        "Усилить RPS-циклы для создания более чёткого "
                        "камень-ножницы-бумажного баланса."
                    )
                else:
                    suggestions.append(
                        "Добавить нетранзитивные отношения (RPS-циклы), "
                        "чтобы создать смысловой выбор между стратегиями."
                    )

        if dominated_strategies:
            for idx in dominated_strategies:
                name = object_names[idx] if idx < len(object_names) else f"объект #{idx}"
                warnings.append(
                    f"'{name}' — доминируемая стратегия (никогда не выбирается). "
                    f"Рассмотрите усиление или удаление."
                )

        if not is_intransitive and n >= 3:
            warnings.append(
                "Нетранзитивные отношения не обнаружены. "
                "В игре может не быть достаточного разнообразия стратегий."
            )

        if not warnings:
            warnings.append("Нетранзитивный баланс в норме. RPS-структуры обнаружены." if is_intransitive else "Нетранзитивный анализ завершён без проблем.")

        if not suggestions:
            suggestions.append("Коррекция нетранзитивного баланса не требуется.")

        result = IntransitiveResult(
            payoff_matrix=payoff_matrix,
            object_names=object_names,
            nash_equilibrium=nash_equilibrium,
            is_intransitive=is_intransitive,
            dominated_strategies=dominated_strategies,
            strategy_balance=strategy_balance,
            rps_cycles=rps_cycles,
            has_dominant_strategy=has_dominant_strategy,
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Stage 4] Intransitive balance: "
            f"intransitive={is_intransitive}, "
            f"{len(rps_cycles)} RPS-cycles, "
            f"{len(dominated_strategies)} dominated, "
            f"dominant_strategy={has_dominant_strategy} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _build_payoff_matrix(
        self,
        objects: list[BalanceObject],
        transitive_result: TransitiveResult,
    ) -> list[list[float]]:
        """
        Шаг 4.1: Построение payoff-матрицы N×N.

        payoff[i][j] = EV объекта i против объекта j.
        Диагональ = 0.
        Учитывает: пересечение атрибутов, элементальные преимущества, теги.
        """
        n = len(objects)
        matrix: list[list[float]] = [[0.0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 0.0
                    continue

                # Базовое EV на основе transitive-результата
                obj_i_report = next(
                    (r for r in transitive_result.objects if r.name == objects[i].name), None
                )
                obj_j_report = next(
                    (r for r in transitive_result.objects if r.name == objects[j].name), None
                )

                if obj_i_report and obj_j_report:
                    power_i = obj_i_report.power
                    power_j = obj_j_report.power
                    # Базовое преимущество: отношение мощностей
                    if power_j > 0:
                        base_ev = (power_i - power_j) / max(power_i + power_j, 1e-10)
                    else:
                        base_ev = 1.0
                else:
                    base_ev = 0.0

                # Бонус за элементальные преимущества
                tag_bonus = 0.0
                for tag_i in objects[i].tags:
                    for tag_j in objects[j].tags:
                        tag_i_lower = tag_i.lower()
                        tag_j_lower = tag_j.lower()
                        if ELEMENTAL_ADVANTAGES.get(tag_i_lower) == tag_j_lower:
                            tag_bonus += 0.3  # Преимущество
                        if ELEMENTAL_ADVANTAGES.get(tag_j_lower) == tag_i_lower:
                            tag_bonus -= 0.3  # Уязвимость

                # Пересечение атрибутов (сходство = нейтральность)
                attrs_i = set(objects[i].attributes.keys())
                attrs_j = set(objects[j].attributes.keys())
                overlap = len(attrs_i & attrs_j)
                total_attrs = len(attrs_i | attrs_j)
                similarity = overlap / total_attrs if total_attrs > 0 else 0.0
                similarity_penalty = -0.1 * similarity  # Сходство снижает преимущество

                matrix[i][j] = round(base_ev + tag_bonus + similarity_penalty, 4)

        return matrix

    def _find_rps_cycles(
        self,
        payoff_matrix: list[list[float]],
        object_names: list[str],
    ) -> list[RPSCycle]:
        """
        Шаг 4.2: Поиск RPS-циклов — нетранзитивных троек.

        Ищем все тройки (i,j,k) где A>B, B>C, C>A.
        """
        n = len(object_names)
        cycles: list[RPSCycle] = []

        if n < 3:
            return cycles

        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                # A > B (payoff > 0 означает преимущество)
                if payoff_matrix[i][j] <= 0:
                    continue
                for k in range(n):
                    if k == i or k == j:
                        continue
                    # B > C
                    if payoff_matrix[j][k] <= 0:
                        continue
                    # C > A (нетранзитивность!)
                    if payoff_matrix[k][i] > 0:
                        strength = min(
                            payoff_matrix[i][j],
                            payoff_matrix[j][k],
                            payoff_matrix[k][i],
                        )
                        cycle = RPSCycle(
                            cycle=[object_names[i], object_names[j], object_names[k]],
                            strength=round(strength, 4),
                        )
                        # Проверяем, нет ли уже такого цикла (с учётом ротации)
                        cycle_set = {object_names[i], object_names[j], object_names[k]}
                        is_duplicate = False
                        for existing in cycles:
                            if set(existing.cycle) == cycle_set:
                                is_duplicate = True
                                break
                        if not is_duplicate:
                            cycles.append(cycle)

        return cycles

    def _compute_nash_equilibrium(
        self,
        payoff_matrix: list[list[float]],
        n: int,
    ) -> tuple[list[float], list[int]]:
        """
        Шаг 4.3: Вычисление равновесия Нэша для симметричной zero-sum игры.

        Использует итеративный метод:
        1. Начинаем с равномерного распределения
        2. Итерируем через best response updates
        3. Если стратегия получает отрицательную вероятность — обнуляем (доминируемая)
        4. Нормализуем

        Returns:
            (nash_equilibrium, dominated_strategies)
        """
        if n == 0:
            return [], []

        if n == 1:
            return [1.0], []

        # Итеративный метод для приближённого равновесия Нэша
        strategy = [1.0 / n] * n
        dominated: list[int] = []
        active = [True] * n
        iterations = 200
        learning_rate = 0.1

        for _ in range(iterations):
            # Вычисляем expected payoff для каждой стратегии
            expected_payoffs = [0.0] * n
            for i in range(n):
                if not active[i]:
                    continue
                for j in range(n):
                    if not active[j]:
                        continue
                    expected_payoffs[i] += strategy[j] * payoff_matrix[i][j]

            # Best response: стратегия с максимальным expected payoff
            best_idx = -1
            best_payoff = float("-inf")
            for i in range(n):
                if not active[i]:
                    continue
                if expected_payoffs[i] > best_payoff:
                    best_payoff = expected_payoffs[i]
                    best_idx = i

            if best_idx < 0:
                break

            # Обновляем стратегию (multiplicative weights update)
            for i in range(n):
                if not active[i]:
                    continue
                strategy[i] *= math.exp(learning_rate * expected_payoffs[i])

            # Проверяем на доминируемые стратегии
            for i in range(n):
                if not active[i]:
                    continue
                # Стратегия доминируема, если все expected_payoffs отрицательны
                all_negative = True
                for j in range(n):
                    if active[j] and payoff_matrix[i][j] > 0:
                        all_negative = False
                        break
                if all_negative and strategy[i] < 1e-6:
                    active[i] = False
                    if i not in dominated:
                        dominated.append(i)

            # Нормализуем
            total = sum(s for s in strategy if s > 0)
            if total > 1e-10:
                for i in range(n):
                    if strategy[i] < 0:
                        strategy[i] = 0.0
                    strategy[i] = strategy[i] / total
            else:
                # Fallback: равномерное по активным
                active_count = sum(1 for a in active if a)
                for i in range(n):
                    strategy[i] = (1.0 / active_count) if active[i] else 0.0

        # Проверяем, не стала ли матрица сингулярной (одна доминантная стратегия)
        max_prob = max(strategy)
        if max_prob > 0.95:
            # Почти чистая стратегия — доминантная
            dominant_idx = strategy.index(max_prob)
            # Проверяем, действительно ли доминирует
            dominates_all = True
            for j in range(n):
                if j == dominant_idx:
                    continue
                if payoff_matrix[dominant_idx][j] <= 0:
                    dominates_all = False
                    break
            if dominates_all:
                strategy = [0.0] * n
                strategy[dominant_idx] = 1.0
                for i in range(n):
                    if i != dominant_idx and i not in dominated:
                        dominated.append(i)

        # Финальная нормализация и округление
        total = sum(strategy)
        if total > 1e-10:
            strategy = [round(s / total, 4) for s in strategy]
        else:
            strategy = [round(1.0 / n, 4)] * n

        return strategy, dominated

    def _compute_strategy_balance(
        self,
        nash_equilibrium: list[float],
        n: int,
    ) -> Optional[StrategyBalanceScore]:
        """
        Шаг 4.4: Вычисление метрик баланса стратегий.

        - entropy = -Σ p_i * log(p_i + 1e-10)
        - max_share = максимальная доля стратегии
        - gini = коэффициент Джини
        """
        if not nash_equilibrium or n == 0:
            return None

        # Энтропия
        entropy = -sum(
            p * math.log(p + 1e-10) for p in nash_equilibrium
        )
        max_entropy = math.log(n) if n > 1 else 1.0

        # Максимальная доля
        max_share = max(nash_equilibrium) if nash_equilibrium else 0.0

        # Коэффициент Джини
        sorted_probs = sorted(nash_equilibrium)
        gini_sum = 0.0
        for i in range(n):
            for j in range(n):
                gini_sum += abs(sorted_probs[i] - sorted_probs[j])
        gini = gini_sum / (2 * n * sum(sorted_probs)) if sum(sorted_probs) > 1e-10 else 0.0

        return StrategyBalanceScore(
            entropy=round(entropy, 4),
            max_share=round(max_share, 4),
            gini=round(gini, 4),
        )

    async def _ai_suggest_intransitive_corrections(
        self,
        input_data: BalanceInput,
        payoff_matrix: list[list[float]],
        object_names: list[str],
        nash_equilibrium: list[float],
        project_state: Optional[dict] = None,
    ) -> list[str]:
        """
        Шаг 4.6: AI-коррекции через SUGGEST_INTRANSITIVE_CORRECTIONS.
        Fallback на правило-основанные рекомендации при ошибке.
        """
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="SUGGEST_INTRANSITIVE_CORRECTIONS",
                inputs={
                    "objects": [obj.model_dump() for obj in input_data.objects[:10]],
                    "payoff_matrix": payoff_matrix,
                    "object_names": object_names,
                    "nash_equilibrium": nash_equilibrium,
                    "game_mode": input_data.game_mode,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            data = prompt_result.data
            if isinstance(data, dict) and "suggestions" in data:
                suggestions = data["suggestions"]
                if isinstance(suggestions, list) and len(suggestions) > 0:
                    return [str(s) for s in suggestions]
            elif isinstance(data, list) and len(data) > 0:
                return [str(s) for s in data]

        except Exception as e:
            logger.warning(
                f"[Stage 4.6] AI intransitive corrections (SUGGEST_INTRANSITIVE_CORRECTIONS) "
                f"failed, using rule-based fallback: {e}"
            )

        return []

    # ========================================================
    # Этап 5: Ситуационный анализ (3.4.6 / 4.C.2)
    # ========================================================

    async def situational_balance(
        self,
        input_data: BalanceInput,
        transitive_result: TransitiveResult,
        balance_map: BalanceMap,
        project_state: Optional[dict] = None,
    ) -> SituationalResult:
        """
        Этап 5 (4.C.2): Ситуационный анализ — контекстная ценность.

        Алгоритм 3.4.6:
        1. Определение ситуаций (по жанру или AI-генерация)
        2. Оценка ценности каждого объекта в каждой ситуации
        3. Расчёт ожидаемой ситуационной ценности (EV)
        4. Оценка универсальности vs специализации
        5. Проверка баланса универсальности
        6. Стоимость переключения
        """
        start = time.time()
        objects = input_data.objects
        object_names = [obj.name for obj in objects]

        # === Шаг 5.1: Определение ситуаций ===
        situations = await self._get_situations(input_data, project_state)

        # === Шаг 5.2: Оценка ценности каждого объекта в каждой ситуации ===
        situational_values = await self._evaluate_situational_values(
            objects, situations, input_data, project_state
        )

        # === Шаг 5.3: Расчёт ожидаемой ситуационной ценности (EV) ===
        situational_ev: list[float] = []
        for i, obj in enumerate(objects):
            ev = 0.0
            for j, sit in enumerate(situations):
                ev += sit.probability * situational_values[i][j]
            situational_ev.append(round(ev, 4))

        # === Шаг 5.4: Оценка универсальности vs специализации ===
        versatility_map: list[VersatilityInfo] = []
        for i, obj in enumerate(objects):
            values = situational_values[i]
            max_val = max(values) if values else 0.0
            min_val = min(values) if values else 0.0
            spread = round(max_val - min_val, 4)
            v_type = "universal" if spread < VERSATILITY_SPREAD_THRESHOLD else "specialized"

            versatility_map.append(
                VersatilityInfo(
                    max_value=round(max_val, 4),
                    min_value=round(min_val, 4),
                    spread=spread,
                    type=v_type,
                )
            )

        # === Шаг 5.5: Проверка баланса универсальности ===
        dead_zones: list[str] = []
        dominant_universals: list[str] = []

        for i, obj in enumerate(objects):
            # Мёртвая зона: максимальная ситуационная ценность < порога
            if versatility_map[i].max_value < DEAD_ZONE_MAX_VALUE:
                dead_zones.append(obj.name)

            # Доминантный универсал: универсальный с высокой EV
            if (
                versatility_map[i].type == "universal"
                and situational_ev[i] > DOMINANT_UNIVERSAL_EV_THRESHOLD
            ):
                dominant_universals.append(obj.name)

        # === Шаг 5.6: Стоимость переключения ===
        switching_cost = self._estimate_switching_cost(input_data.genre)

        # Генерация warnings и suggestions
        warnings: list[str] = []
        suggestions: list[str] = []

        if dead_zones:
            warnings.append(
                f"Мёртвые зоны (объекты без доминирующих ситуаций): "
                f"{', '.join(dead_zones)}. Рассмотрите усиление или добавление "
                f"ситуаций, где эти объекты могут проявиться."
            )

        if dominant_universals:
            warnings.append(
                f"Доминантные универсалы: {', '.join(dominant_universals)}. "
                f"Они одновременно универсальны и сильны — потенциально нарушают баланс."
            )
            for name in dominant_universals:
                suggestions.append(
                    f"'{name}': ослабить в общих ситуациях или повысить стоимость "
                    f"переключения, чтобы специализированные объекты были конкурентоспособны."
                )

        # Проверка баланса EV
        if situational_ev:
            ev_max = max(situational_ev)
            ev_min = min(situational_ev)
            ev_range = ev_max - ev_min
            if ev_range > 0.5:
                warnings.append(
                    f"Большой разброс ситуационных EV ({ev_range:.2f}). "
                    f"Некоторые объекты слишком ситуативно зависимы."
                )

        # Проверка, что все специализированные объекты имеют нишу
        for i, obj in enumerate(objects):
            if versatility_map[i].type == "specialized":
                max_sit_idx = situational_values[i].index(
                    max(situational_values[i])
                ) if situational_values[i] else -1
                if max_sit_idx >= 0 and situational_values[i][max_sit_idx] < 1.5:
                    suggestions.append(
                        f"'{obj.name}': специализирован, но не доминирует "
                        f"ни в одной ситуации. Усилить специализацию или расширить нишу."
                    )

        if not warnings:
            warnings.append("Ситуационный баланс в пределах нормы.")

        if not suggestions:
            suggestions.append("Коррекция ситуационного баланса не требуется.")

        result = SituationalResult(
            situations=situations,
            situational_values=situational_values,
            object_names=object_names,
            situational_ev=situational_ev,
            versatility_map=versatility_map,
            dead_zones=dead_zones,
            dominant_universals=dominant_universals,
            switching_cost=switching_cost,
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Stage 5] Situational balance: "
            f"{len(situations)} situations, "
            f"{len(dead_zones)} dead_zones, "
            f"{len(dominant_universals)} dominant_universals, "
            f"switching_cost={switching_cost} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    async def _get_situations(
        self,
        input_data: BalanceInput,
        project_state: Optional[dict] = None,
    ) -> list[Situation]:
        """
        Шаг 5.1: Определение ситуаций по жанру.

        Попытка AI-генерации через EVALUATE_SITUATIONAL_VALUE,
        fallback на GENRE_SITUATIONS, затем на RPG-дефолт.
        """
        genre = input_data.genre.lower() if input_data.genre else ""

        # Проверяем константу жанровых ситуаций
        if genre in GENRE_SITUATIONS:
            return [
                Situation(name=s["name"], probability=s["probability"])
                for s in GENRE_SITUATIONS[genre]
            ]

        # Попытка AI-генерации ситуаций
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="EVALUATE_SITUATIONAL_VALUE",
                inputs={
                    "action": "generate_situations",
                    "genre": input_data.genre,
                    "game_mode": input_data.game_mode,
                    "object_types": list(set(obj.type for obj in input_data.objects)),
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            data = prompt_result.data
            if isinstance(data, dict) and "situations" in data:
                sit_list = data["situations"]
                if isinstance(sit_list, list) and len(sit_list) > 0:
                    situations = []
                    for s in sit_list:
                        if isinstance(s, dict) and "name" in s and "probability" in s:
                            situations.append(
                                Situation(name=s["name"], probability=float(s["probability"]))
                            )
                    if situations:
                        return situations
        except Exception as e:
            logger.warning(
                f"[Stage 5.1] AI situation generation (EVALUATE_SITUATIONAL_VALUE) "
                f"failed, using default RPG situations: {e}"
            )

        # Fallback: RPG-ситуации по умолчанию
        default_situations = GENRE_SITUATIONS.get("rpg", [])
        return [
            Situation(name=s["name"], probability=s["probability"])
            for s in default_situations
        ]

    async def _evaluate_situational_values(
        self,
        objects: list[BalanceObject],
        situations: list[Situation],
        input_data: BalanceInput,
        project_state: Optional[dict] = None,
    ) -> list[list[float]]:
        """
        Шаг 5.2: Оценка ценности каждого объекта в каждой ситуации.

        Использует эвристику на основе атрибутов и тегов.
        Попытка AI через EVALUATE_SITUATIONAL_VALUE, fallback на эвристику.
        """
        n = len(objects)
        m = len(situations)

        # Попытка AI-оценки
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="EVALUATE_SITUATIONAL_VALUE",
                inputs={
                    "action": "evaluate_values",
                    "objects": [obj.model_dump() for obj in objects[:10]],
                    "situations": [s.model_dump() for s in situations],
                    "genre": input_data.genre,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            data = prompt_result.data
            if isinstance(data, dict) and "values" in data:
                values = data["values"]
                if isinstance(values, list) and len(values) == n:
                    result = []
                    for row in values:
                        if isinstance(row, list) and len(row) == m:
                            result.append([round(float(v), 4) for v in row])
                        else:
                            break
                    else:
                        return result
        except Exception as e:
            logger.warning(
                f"[Stage 5.2] AI situational evaluation (EVALUATE_SITUATIONAL_VALUE) "
                f"failed, using heuristic: {e}"
            )

        # Fallback: эвристическая оценка на основе атрибутов
        values: list[list[float]] = []
        for obj in objects:
            row: list[float] = []
            for sit in situations:
                value = self._heuristic_situational_value(obj, sit)
                row.append(round(value, 4))
            values.append(row)

        return values

    def _heuristic_situational_value(
        self,
        obj: BalanceObject,
        situation: Situation,
    ) -> float:
        """
        Эвристическая оценка ценности объекта в ситуации.

        Логика:
        - Базовое значение = 1.0 (среднее)
        - Боевые атрибуты (damage, attack, strength) → бонус в боевых ситуациях
        - Защитные атрибуты (defense, hp, armor) → бонус в защитных ситуациях
        - Скорость (speed, agility) → бонус в стелс-ситуациях
        - Экономические атрибуты → бонус в экономических ситуациях
        - Теги дают ситуационные бонусы/штрафы
        """
        base_value = 1.0
        sit_name = situation.name.lower()

        # Классификация ситуации по ключевым словам
        is_combat = any(kw in sit_name for kw in ["враг", "босс", "война", "одиночный", "группа"])
        is_defense = any(kw in sit_name for kw in ["защит", "оборона", "баз"])
        is_stealth = any(kw in sit_name for kw in ["стелс", "скрыт", "тих"])
        is_economy = any(kw in sit_name for kw in ["экономи", "ранняя", "ресурс"])
        is_siege = any(kw in sit_name for kw in ["осад", "лейт", "поздн"])

        attrs = obj.attributes
        bonus = 0.0

        if is_combat:
            # Боевые атрибуты
            combat_attrs = ["damage", "attack", "strength", "power", "dps", "урон", "атака", "сила"]
            for attr in combat_attrs:
                if attr in attrs:
                    normalized = min(attrs[attr] / 100.0, 1.0)  # нормализация
                    bonus += 0.3 * normalized
            # Группа врагов = AOE бонус
            if "группа" in sit_name or "group" in sit_name:
                aoe_tags = ["aoe", "splash", "area", "массовый"]
                for tag in obj.tags:
                    if tag.lower() in aoe_tags:
                        bonus += 0.4

        if is_defense:
            # Защитные атрибуты
            defense_attrs = ["defense", "hp", "armor", "health", "shield", "защита", "здоровье", "броня"]
            for attr in defense_attrs:
                if attr in attrs:
                    normalized = min(attrs[attr] / 100.0, 1.0)
                    bonus += 0.3 * normalized

        if is_stealth:
            # Атрибуты скрытности
            stealth_attrs = ["speed", "agility", "stealth", "dexterity", "скорость", "ловкость", "скрытность"]
            for attr in stealth_attrs:
                if attr in attrs:
                    normalized = min(attrs[attr] / 100.0, 1.0)
                    bonus += 0.3 * normalized

        if is_economy:
            # Экономические атрибуты
            economy_attrs = ["cost_efficiency", "production", "income", "economy", "экономика", "производство"]
            for attr in economy_attrs:
                if attr in attrs:
                    normalized = min(attrs[attr] / 100.0, 1.0)
                    bonus += 0.3 * normalized
            # Дешёвые объекты лучше в ранней игре
            if obj.cost is not None and obj.cost < 50:
                bonus += 0.2

        if is_siege:
            # Осадные атрибуты
            siege_attrs = ["range", "siege", "penetration", "дальность", "осада", "пробитие"]
            for attr in siege_attrs:
                if attr in attrs:
                    normalized = min(attrs[attr] / 100.0, 1.0)
                    bonus += 0.3 * normalized

        # Теги: ситуационные бонусы
        for tag in obj.tags:
            tag_lower = tag.lower()
            # Элементальные теги
            if tag_lower in ("fire", "огонь") and is_combat:
                bonus += 0.1
            if tag_lower in ("ice", "лёд") and is_defense:
                bonus += 0.1
            if tag_lower in ("lightning", "молния") and is_stealth:
                bonus += 0.1
            if tag_lower in ("tank", "танк") and is_defense:
                bonus += 0.3
            if tag_lower in ("assassin", "ассасин") and is_stealth:
                bonus += 0.3
            if tag_lower in ("support", "поддержка") and is_economy:
                bonus += 0.2

        value = base_value + bonus
        # Ограничиваем диапазон [0.0, 2.0]
        return max(0.0, min(2.0, value))

    def _estimate_switching_cost(self, genre: str) -> str:
        """
        Шаг 5.6: Оценка стоимости переключения.

        Зависит от жанра:
        - Стратегии (RTS, TBS) → high (дорого переключать стратегию)
        - RPG → medium
        - Action → low (быстрое переключение)
        """
        genre_lower = genre.lower() if genre else ""

        high_cost_genres = {"strategy", "rts", "tbs", "4x", "grand_strategy"}
        low_cost_genres = {"action", "fps", "fighting", "shooter", "hack_and_slash"}

        if genre_lower in high_cost_genres:
            return "high"
        elif genre_lower in low_cost_genres:
            return "low"
        else:
            return "medium"

    # ========================================================
    # Q-фактор анализ (3.4.7 / Роллингс/Моррис, Кн. 12)
    # ========================================================

    def calculate_q_factor(
        self,
        input_data: BalanceInput,
        transitive_result: TransitiveResult,
    ) -> QFactorResult:
        """
        Q-фактор анализ (Роллингс/Моррис, Кн. 12).

        Выявление избыточных компонентов, не влияющих на геймплей:
        1. Построение Q-матрицы (объекты × атрибуты, нормализованные 0-1)
        2. Определение доминантных атрибутов для каждого объекта
        3. Выявление избыточных объектов (не доминируют ни по одному атрибуту)
        4. Расчёт оценки избыточности
        """
        start = time.time()
        objects = input_data.objects

        # === Шаг 1: Построение Q-матрицы ===
        # Собираем все атрибуты
        all_attrs: list[str] = []
        seen_attrs: set[str] = set()
        for obj in objects:
            for attr in obj.attributes:
                if attr not in seen_attrs:
                    all_attrs.append(attr)
                    seen_attrs.add(attr)

        n = len(objects)
        m = len(all_attrs)

        if n == 0 or m == 0:
            return QFactorResult(
                objects=[],
                redundant_objects=[],
                attribute_dominance={},
                q_matrix=[],
                warnings=["Недостаточно данных для Q-фактор анализа."],
                suggestions=["Добавьте объекты с атрибутами для анализа."],
            )

        # Строим raw-матрицу и нормализуем по столбцам (0-1)
        raw_matrix: list[list[float]] = []
        for obj in objects:
            row = [obj.attributes.get(attr, 0.0) for attr in all_attrs]
            raw_matrix.append(row)

        # Min-max нормализация по каждому столбцу
        q_matrix: list[list[float]] = [[0.0] * m for _ in range(n)]
        for j in range(m):
            col_values = [raw_matrix[i][j] for i in range(n)]
            col_min = min(col_values)
            col_max = max(col_values)
            col_range = col_max - col_min

            for i in range(n):
                if col_range > 1e-10:
                    q_matrix[i][j] = round((raw_matrix[i][j] - col_min) / col_range, 4)
                else:
                    # Все значения одинаковы — нейтрально (0.5)
                    q_matrix[i][j] = 0.5

        # === Шаг 2: Определение доминантных атрибутов ===
        # Для каждого атрибута находим объект с максимальным значением
        attribute_dominance: dict[str, str] = {}
        for j in range(m):
            max_val = -1.0
            max_idx = 0
            for i in range(n):
                if q_matrix[i][j] > max_val:
                    max_val = q_matrix[i][j]
                    max_idx = i
            # Объект доминирует по атрибуту, если его значение = 1.0 (максимум)
            if max_val >= 0.99:
                attribute_dominance[all_attrs[j]] = objects[max_idx].name

        # Для каждого объекта — какие атрибуты он доминирует
        object_dominant_attrs: dict[int, list[str]] = {i: [] for i in range(n)}
        for j, attr in enumerate(all_attrs):
            for i in range(n):
                if q_matrix[i][j] >= 0.99:
                    object_dominant_attrs[i].append(attr)

        # === Шаг 3: Выявление избыточных объектов ===
        q_factor_objects: list[QFactorObject] = []
        redundant_objects: list[str] = []

        for i, obj in enumerate(objects):
            dominant_attrs = object_dominant_attrs[i]
            is_redundant = len(dominant_attrs) == 0
            # Оценка избыточности: 1 - (число доминантных атрибутов / всего атрибутов)
            redundancy_score = 1.0 - (len(dominant_attrs) / m) if m > 0 else 1.0

            q_factor_objects.append(
                QFactorObject(
                    name=obj.name,
                    dominant_attributes=dominant_attrs,
                    is_redundant=is_redundant,
                    redundancy_score=round(redundancy_score, 4),
                )
            )

            if is_redundant:
                redundant_objects.append(obj.name)

        # === Шаг 4: Генерация warnings и suggestions ===
        warnings: list[str] = []
        suggestions: list[str] = []

        if redundant_objects:
            warnings.append(
                f"Избыточные объекты (не доминируют ни по одному атрибуту): "
                f"{', '.join(redundant_objects)}. "
                f"Эти объекты могут быть заменены другими без потери геймплея."
            )

        for q_obj in q_factor_objects:
            if q_obj.is_redundant:
                suggestions.append(
                    f"'{q_obj.name}': усилить уникальный атрибут, добавить новый "
                    f"отличительный атрибут, или удалить, если дублирует другие объекты."
                )

        # Проверка: слишком много объектов доминируют по одному атрибуту
        attr_owner_counts: dict[str, int] = {}
        for q_obj in q_factor_objects:
            for attr in q_obj.dominant_attributes:
                attr_owner_counts[attr] = attr_owner_counts.get(attr, 0) + 1

        for attr, count in attr_owner_counts.items():
            if count > 1:
                warnings.append(
                    f"Атрибут '{attr}' доминируется {count} объектами одновременно. "
                    f"Рассмотрите дифференциацию."
                )

        # Проверка: атрибуты без доминантного объекта
        dominated_attrs = set(attribute_dominance.keys())
        undominated_attrs = [a for a in all_attrs if a not in dominated_attrs]
        if undominated_attrs:
            warnings.append(
                f"Атрибуты без чёткого доминантного объекта: "
                f"{', '.join(undominated_attrs)}. "
                f"Все объекты одинаковы по этим атрибутам — они не влияют на выбор."
            )

        if not warnings:
            warnings.append("Q-фактор анализ завершён. Избыточных компонентов не обнаружено.")

        if not suggestions:
            suggestions.append("Все объекты вносят уникальный вклад в геймплей.")

        result = QFactorResult(
            objects=q_factor_objects,
            redundant_objects=redundant_objects,
            attribute_dominance=attribute_dominance,
            q_matrix=q_matrix,
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Q-factor] Analysis: "
            f"{n} objects, {m} attributes, "
            f"{len(redundant_objects)} redundant, "
            f"{len(attribute_dominance)} dominated attributes "
            f"({time.time() - start:.2f}s)"
        )
        return result

    # ========================================================
    # Полный пайплайн: Этапы 1–5 + Q-фактор
    # ========================================================

    async def balance_full(
        self,
        input_data: BalanceInput,
        mda_profile: Optional[dict] = None,
        project_state: Optional[dict] = None,
        run_intransitive: bool = True,
        run_situational: bool = True,
        run_q_factor: bool = True,
        run_monte_carlo: bool = True,
        run_machinations: bool = True,
    ) -> BalanceResult:
        """
        Полный пайплайн балансировки — Этапы 1–7 + Q-фактор алгоритма 3.4.

        Выполняет последовательно:
        1. Классификацию задачи балансировки → BalanceMap
        2. Transitive-анализ → TransitiveResult
        3. Анализ устойчивости → StabilityAssessment
        4. Нетранзитивный анализ → IntransitiveResult (если run_intransitive)
        5. Ситуационный анализ → SituationalResult (если run_situational)
        Q. Q-фактор анализ → QFactorResult (если run_q_factor)
        6. Monte Carlo-симуляция → MonteCarloResult (если run_monte_carlo)
        7. Machinations-симуляция → MachinationsSimResult (если run_machinations)

        Returns:
            BalanceResult с результатами всех этапов
        """
        pipeline_start = time.time()
        models_used: list[str] = []
        all_warnings: list[str] = []
        all_suggestions: list[str] = []
        stages_completed: list[int] = []

        intransitive_result: Optional[IntransitiveResult] = None
        situational_result: Optional[SituationalResult] = None
        q_factor_result: Optional[QFactorResult] = None
        monte_carlo_result: Optional[MonteCarloResult] = None
        machinations_result: Optional[MachinationsSimResult] = None

        # === Этап 1: Классификация ===
        balance_map = await self.classify_balance_task(
            input_data=input_data,
            mda_profile=mda_profile,
        )
        stages_completed.append(1)

        logger.info(
            f"[Pipeline] Stage 1 completed: "
            f"primary_model={balance_map.primary_model}"
        )

        # === Этап 2: Transitive-анализ ===
        transitive_result = await self.transitive_balance(
            input_data=input_data,
            balance_map=balance_map,
            project_state=project_state,
        )
        stages_completed.append(2)
        models_used.append("ESTIMATE_WEIGHTS")
        all_warnings.extend(transitive_result.warnings)
        all_suggestions.extend(transitive_result.suggestions)

        logger.info(
            f"[Pipeline] Stage 2 completed: "
            f"{len(transitive_result.overpowered)} OP, "
            f"{len(transitive_result.underpowered)} UP"
        )

        # === Этап 3: Анализ устойчивости ===
        # Собираем feedback_loops из MDA-профиля или создаём из balance_map
        feedback_loops = self._extract_feedback_loops(mda_profile, balance_map)
        stability_result = self.analyze_stability(feedback_loops)
        stages_completed.append(3)

        # Добавляем рекомендации из stability analysis
        all_warnings.extend(
            f"Stability: {risk}" for risk in stability_result.get("pathology_risks", [])
        )
        all_suggestions.extend(stability_result.get("recommendations", []))

        # === Этап 4: Нетранзитивный анализ ===
        if run_intransitive and len(input_data.objects) >= 2:
            try:
                intransitive_result = await self.intransitive_balance(
                    input_data=input_data,
                    transitive_result=transitive_result,
                    balance_map=balance_map,
                    project_state=project_state,
                )
                stages_completed.append(4)
                models_used.append("SUGGEST_INTRANSITIVE_CORRECTIONS")
                all_warnings.extend(intransitive_result.warnings)
                all_suggestions.extend(intransitive_result.suggestions)

                logger.info(
                    f"[Pipeline] Stage 4 completed: "
                    f"intransitive={intransitive_result.is_intransitive}, "
                    f"{len(intransitive_result.rps_cycles)} RPS-cycles"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Stage 4 (intransitive) failed: {e}")
                all_warnings.append(f"Нетранзитивный анализ не удалось выполнить: {e}")

        # === Этап 5: Ситуационный анализ ===
        if run_situational and len(input_data.objects) >= 2:
            try:
                situational_result = await self.situational_balance(
                    input_data=input_data,
                    transitive_result=transitive_result,
                    balance_map=balance_map,
                    project_state=project_state,
                )
                stages_completed.append(5)
                models_used.append("EVALUATE_SITUATIONAL_VALUE")
                all_warnings.extend(situational_result.warnings)
                all_suggestions.extend(situational_result.suggestions)

                logger.info(
                    f"[Pipeline] Stage 5 completed: "
                    f"{len(situational_result.situations)} situations, "
                    f"{len(situational_result.dead_zones)} dead_zones"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Stage 5 (situational) failed: {e}")
                all_warnings.append(f"Ситуационный анализ не удалось выполнить: {e}")

        # === Q-фактор анализ ===
        if run_q_factor and len(input_data.objects) >= 2:
            try:
                q_factor_result = self.calculate_q_factor(
                    input_data=input_data,
                    transitive_result=transitive_result,
                )
                # Q-фактор — отдельный подэтап, номер не назначаем
                all_warnings.extend(q_factor_result.warnings)
                all_suggestions.extend(q_factor_result.suggestions)

                logger.info(
                    f"[Pipeline] Q-factor completed: "
                    f"{len(q_factor_result.redundant_objects)} redundant objects"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Q-factor analysis failed: {e}")
                all_warnings.append(f"Q-фактор анализ не удалось выполнить: {e}")

        # === Этап 6: Monte Carlo-симуляция ===
        if run_monte_carlo and transitive_result is not None and len(input_data.objects) >= 2:
            try:
                monte_carlo_result = await self.monte_carlo_simulate(
                    input_data=input_data,
                    transitive_result=transitive_result,
                    balance_map=balance_map,
                    project_state=project_state,
                )
                stages_completed.append(6)
                all_warnings.extend(monte_carlo_result.warnings)
                all_suggestions.extend(monte_carlo_result.suggestions)

                logger.info(
                    f"[Pipeline] Stage 6 (Monte Carlo) completed: "
                    f"verdict={monte_carlo_result.balance_verdict}, "
                    f"spread={monte_carlo_result.win_rate_spread:.3f}"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Stage 6 (Monte Carlo) failed: {e}")
                all_warnings.append(f"Monte Carlo-симуляция не удалась: {e}")

        # === Этап 7: Machinations-симуляция ===
        if run_machinations and transitive_result is not None and len(input_data.objects) >= 2:
            try:
                machinations_graph = self.build_machinations_graph(
                    input_data=input_data,
                    balance_map=balance_map,
                    transitive_result=transitive_result,
                )
                machinations_result = self.machinations_simulate(graph=machinations_graph)
                stages_completed.append(7)
                all_warnings.extend(machinations_result.recommendations)
                all_suggestions.extend(machinations_result.recommendations)

                logger.info(
                    f"[Pipeline] Stage 7 (Machinations) completed: "
                    f"runs={machinations_result.runs}, "
                    f"pathologies={len(machinations_result.detected_pathologies)}"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Stage 7 (Machinations) failed: {e}")
                all_warnings.append(f"Machinations-симуляция не удалась: {e}")

        # === Обновление анализа устойчивости с учётом симуляций ===
        stability = self.analyze_simulation_stability(
            monte_carlo_result=monte_carlo_result,
            machinations_result=machinations_result,
        )

        latency_ms = int((time.time() - pipeline_start) * 1000)

        logger.info(
            f"[Pipeline] Full balance completed in {latency_ms}ms. "
            f"Stages: {stages_completed}, "
            f"Stability: {stability.overall_stability}"
        )

        return BalanceResult(
            balance_map=balance_map,
            transitive_result=transitive_result,
            stability=stability,
            intransitive_result=intransitive_result,
            situational_result=situational_result,
            q_factor_result=q_factor_result,
            monte_carlo_result=monte_carlo_result,
            machinations_result=machinations_result,
            stages_completed=stages_completed,
            latency_ms=latency_ms,
            models_used=models_used,
            warnings=all_warnings,
            suggestions=all_suggestions,
        )

    def _extract_feedback_loops(
        self,
        mda_profile: Optional[dict],
        balance_map: BalanceMap,
    ) -> list[dict]:
        """Извлечь петли обратной связи из MDA-профиля или построить из balance_map."""
        loops: list[dict] = []

        # Из MDA-профиля
        if mda_profile:
            classic_mda = mda_profile.get("classic_mda_result", {})
            if isinstance(classic_mda, dict):
                feedback_loops = classic_mda.get("feedback_loops", [])
                for loop in feedback_loops:
                    if isinstance(loop, dict):
                        loops.append(loop)
                    elif hasattr(loop, "model_dump"):
                        loops.append(loop.model_dump())

        # Если петель нет — создаём из balance_map
        if not loops:
            feedback = balance_map.feedback

            if feedback in ("reinforcing", "both"):
                loops.append({
                    "loop_type": "positive",
                    "description": "Усиливающая петля прогрессии (из BalanceMap)",
                    "mechanics_involved": [],
                })

            if feedback in ("balancing", "both"):
                loops.append({
                    "loop_type": "negative",
                    "description": "Балансирующая петля (из BalanceMap)",
                    "mechanics_involved": [],
                })

            # Fallback: если нет MDA-профиля, создаём 1 положительную + 1 отрицательную
            if not loops:
                loops.append({
                    "loop_type": "positive",
                    "description": "Усиливающая петля (автогенерация из feedback type)",
                    "mechanics_involved": [],
                })
                loops.append({
                    "loop_type": "negative",
                    "description": "Балансирующая петля (автогенерация из feedback type)",
                    "mechanics_involved": [],
                })

        return loops

    # ========================================================
    # Этап 6: Monte Carlo-симуляция (алгоритм 3.4.9)
    # ========================================================

    async def monte_carlo_simulate(
        self,
        input_data: BalanceInput,
        transitive_result: TransitiveResult,
        balance_map: BalanceMap,
        config: Optional[SimulationConfig] = None,
        project_state: Optional[dict] = None,
    ) -> MonteCarloResult:
        """
        Этап 6: Monte Carlo-симуляция — стохастическая валидация баланса.

        Алгоритм 3.4.9:
        1. Запустить N итераций случайных 1v1 боёв
        2. Собрать win_rates, durations, matchup-матрицу
        3. Определить balance_verdict по win_rate_spread
        4. Кросс-валидация с формальным ранжированием (Spearman)
        5. Анализ формата чисел (Гэзэуэй/Кн. 9)
        6. Генерация warnings и suggestions

        Returns:
            MonteCarloResult с результатами стохастической валидации
        """
        start = time.time()
        cfg = config or SimulationConfig()
        random.seed(cfg.random_seed)

        objects = input_data.objects
        n = len(objects)

        if n < 2:
            return MonteCarloResult(
                config=cfg,
                balance_verdict="GOOD",
                warnings=["Недостаточно объектов для Monte Carlo-симуляции (нужно ≥ 2)."],
                suggestions=["Добавьте объекты для симуляции."],
            )

        # === Шаг 6.1: Запуск итераций боёв ===
        wins: dict[str, int] = {obj.name: 0 for obj in objects}
        total_matches: dict[str, int] = {obj.name: 0 for obj in objects}
        total_durations: dict[str, float] = {obj.name: 0.0 for obj in objects}
        draws_count = 0

        # Pairwise matchup results: (name_a, name_b) → MatchupData
        matchup_data: dict[str, dict[str, MatchupData]] = {
            obj.name: {} for obj in objects
        }

        num_iterations = min(cfg.num_iterations, 50000)  # Ограничение для производительности

        for _ in range(num_iterations):
            # Случайно выбираем двух объектов
            idx_a = random.randint(0, n - 1)
            idx_b = random.randint(0, n - 1)
            while idx_b == idx_a:
                idx_b = random.randint(0, n - 1)

            obj_a = objects[idx_a]
            obj_b = objects[idx_b]

            # Симуляция 1v1 боя
            hp_a = obj_a.attributes.get("hp", obj_a.attributes.get("health", 100.0))
            hp_b = obj_b.attributes.get("hp", obj_b.attributes.get("health", 100.0))
            dmg_a = obj_a.attributes.get("damage", obj_a.attributes.get("attack", 10.0))
            dmg_b = obj_b.attributes.get("damage", obj_b.attributes.get("attack", 10.0))
            spd_a = obj_a.attributes.get("speed", obj_a.attributes.get("agility", 5.0))
            spd_b = obj_b.attributes.get("speed", obj_b.attributes.get("agility", 5.0))
            def_a = obj_a.attributes.get("defense", obj_a.attributes.get("armor", 0.0))
            def_b = obj_b.attributes.get("defense", obj_b.attributes.get("armor", 0.0))

            # Случайные параметры: крит и уклонение
            crit_chance = random.uniform(0.05, 0.15)
            evasion_chance = random.uniform(0.05, 0.10)

            tick = 0
            max_ticks = 200  # Защита от бесконечного боя
            winner = None  # "a", "b", или None (draw)

            current_hp_a = hp_a
            current_hp_b = hp_b

            while tick < max_ticks:
                tick += 1

                # Атака A → B
                actual_dmg_a = dmg_a * (1 + random.uniform(-0.2, 0.2))
                if random.random() < crit_chance:
                    actual_dmg_a *= 1.5  # Критический удар
                if random.random() < evasion_chance:
                    actual_dmg_a = 0.0  # Уклонение
                # Применяем защиту
                actual_dmg_a = max(actual_dmg_a - def_b * 0.5, 0.0)
                # Учитываем скорость: более быстрый наносит доп. урон
                if spd_a > spd_b:
                    actual_dmg_a *= 1.0 + (spd_a - spd_b) / (spd_a + spd_b + 1e-10) * 0.2
                current_hp_b -= actual_dmg_a

                # Атака B → A
                actual_dmg_b = dmg_b * (1 + random.uniform(-0.2, 0.2))
                if random.random() < crit_chance:
                    actual_dmg_b *= 1.5
                if random.random() < evasion_chance:
                    actual_dmg_b = 0.0
                actual_dmg_b = max(actual_dmg_b - def_a * 0.5, 0.0)
                if spd_b > spd_a:
                    actual_dmg_b *= 1.0 + (spd_b - spd_a) / (spd_a + spd_b + 1e-10) * 0.2
                current_hp_a -= actual_dmg_b

                # Проверка конца боя
                if current_hp_a <= 0 and current_hp_b <= 0:
                    winner = None  # Ничья
                    break
                elif current_hp_b <= 0:
                    winner = "a"
                    break
                elif current_hp_a <= 0:
                    winner = "b"
                    break

            if winner is None:
                draws_count += 1
            elif winner == "a":
                wins[obj_a.name] += 1
            else:
                wins[obj_b.name] += 1

            total_matches[obj_a.name] += 1
            total_matches[obj_b.name] += 1
            total_durations[obj_a.name] += tick
            total_durations[obj_b.name] += tick

            # Обновляем matchup-данные
            matchup_key_ab = (obj_a.name, obj_b.name)
            matchup_key_ba = (obj_b.name, obj_a.name)

            for key, won_side in [(matchup_key_ab, winner), (matchup_key_ba, winner)]:
                src, tgt = key
                if tgt not in matchup_data[src]:
                    matchup_data[src][tgt] = MatchupData()
                md = matchup_data[src][tgt]
                md.avg_duration = (md.avg_duration * (md.wins_a + md.wins_b + md.draws) + tick) / (
                    md.wins_a + md.wins_b + md.draws + 1
                )
                if won_side is None:
                    md.draws += 1
                elif (src == obj_a.name and won_side == "a") or (src == obj_b.name and won_side == "b"):
                    md.wins_a += 1
                else:
                    md.wins_b += 1

        # === Шаг 6.2: Расчёт win_rates ===
        win_rates: dict[str, float] = {}
        avg_duration: dict[str, float] = {}
        for obj in objects:
            name = obj.name
            matches = total_matches[name]
            win_rates[name] = round(wins[name] / matches, 4) if matches > 0 else 0.0
            avg_duration[name] = round(total_durations[name] / matches, 2) if matches > 0 else 0.0

        # === Шаг 6.3: Win rate spread и balance_verdict ===
        if win_rates:
            wr_values = list(win_rates.values())
            win_rate_spread = round(max(wr_values) - min(wr_values), 4)
        else:
            win_rate_spread = 0.0

        if win_rate_spread < WIN_RATE_SPREAD_GOOD:
            balance_verdict = "GOOD"
        elif win_rate_spread < WIN_RATE_SPREAD_MODERATE:
            balance_verdict = "MODERATE"
        else:
            balance_verdict = "POOR"

        # === Шаг 6.4: Кросс-валидация с формальным ранжированием (Spearman) ===
        ranking_correlation = self._compute_spearman_correlation(
            transitive_result, win_rates, objects
        )

        # === Шаг 6.5: Анализ формата чисел ===
        number_format = self._analyze_number_format(objects)

        # === Шаг 6.6: Генерация warnings и suggestions ===
        warnings: list[str] = []
        suggestions: list[str] = []

        if balance_verdict == "POOR":
            warnings.append(
                f"Win rate spread = {win_rate_spread:.2f} (POOR). "
                f"Значительный дисбаланс между объектами."
            )
            # Находим лучшие/худшие
            if win_rates:
                best = max(win_rates, key=win_rates.get)  # type: ignore[arg-type]
                worst = min(win_rates, key=win_rates.get)  # type: ignore[arg-type]
                suggestions.append(
                    f"'{best}' доминирует (win rate {win_rates[best]:.1%}). "
                    f"Ослабить или повысить стоимость."
                )
                suggestions.append(
                    f"'{worst}' слишком слаб (win rate {win_rates[worst]:.1%}). "
                    f"Усилить или снизить стоимость."
                )
        elif balance_verdict == "MODERATE":
            warnings.append(
                f"Win rate spread = {win_rate_spread:.2f} (MODERATE). "
                f"Умеренный дисбаланс — возможна коррекция."
            )
        else:
            warnings.append(
                f"Win rate spread = {win_rate_spread:.2f} (GOOD). "
                f"Баланс в пределах нормы."
            )

        if ranking_correlation < SPEARMAN_CORRELATION_WARNING:
            warnings.append(
                f"Корреляция Спирмена = {ranking_correlation:.3f} (< {SPEARMAN_CORRELATION_WARNING}). "
                f"Расхождение между формальным анализом и симуляцией."
            )
            suggestions.append(
                "Формальный и симуляционный ранги расходятся. "
                "Возможно, атрибуты не полностью отражают боевую эффективность. "
                "Рассмотрите добавление скрытых параметров или пересмотр весов."
            )

        if draws_count > num_iterations * 0.1:
            warnings.append(
                f"Высокий процент ничьих: {draws_count}/{num_iterations} "
                f"({draws_count / num_iterations:.1%}). "
                f"Объекты могут быть слишком похожи."
            )

        if not suggestions:
            suggestions.append("Симуляция подтверждает формальный анализ баланса.")

        # Сериализация matchup_matrix (MatchupData → dict)
        matchup_matrix: dict[str, dict[str, dict]] = {}
        for src_name, targets in matchup_data.items():
            matchup_matrix[src_name] = {}
            for tgt_name, md in targets.items():
                matchup_matrix[src_name][tgt_name] = md.model_dump()

        result = MonteCarloResult(
            config=cfg,
            win_rates=win_rates,
            avg_duration=avg_duration,
            matchup_matrix=matchup_matrix,
            win_rate_spread=win_rate_spread,
            ranking_correlation=ranking_correlation,
            number_format=number_format,
            balance_verdict=balance_verdict,
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Stage 6] Monte Carlo simulation: "
            f"{num_iterations} iterations, verdict={balance_verdict}, "
            f"spread={win_rate_spread:.3f}, "
            f"spearman={ranking_correlation:.3f} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _compute_spearman_correlation(
        self,
        transitive_result: TransitiveResult,
        win_rates: dict[str, float],
        objects: list[BalanceObject],
    ) -> float:
        """
        Вычисление корреляции Спирмена между формальным ранжированием
        (по power из transitive_result) и ранжированием по win_rate из симуляции.
        """
        # Формальный ранг: сортируем объекты по power (убывание)
        formal_powers: dict[str, float] = {}
        for report in transitive_result.objects:
            formal_powers[report.name] = report.power

        # Общие имена
        common_names = [obj.name for obj in objects if obj.name in formal_powers and obj.name in win_rates]
        if len(common_names) < 2:
            return 1.0  # Недостаточно данных для корреляции

        # Формальные ранги
        sorted_formal = sorted(common_names, key=lambda n: formal_powers[n], reverse=True)
        formal_ranks = {name: i + 1 for i, name in enumerate(sorted_formal)}

        # Ранги по win_rate
        sorted_sim = sorted(common_names, key=lambda n: win_rates[n], reverse=True)
        sim_ranks = {name: i + 1 for i, name in enumerate(sorted_sim)}

        # Spearman rank correlation: 1 - (6 * Σd²) / (n * (n² - 1))
        n = len(common_names)
        sum_d_sq = sum(
            (formal_ranks[name] - sim_ranks[name]) ** 2
            for name in common_names
        )
        if n <= 1:
            return 1.0
        denominator = n * (n * n - 1)
        if denominator == 0:
            return 1.0
        correlation = 1.0 - (6.0 * sum_d_sq) / denominator
        return round(max(-1.0, min(1.0, correlation)), 4)

    def _analyze_number_format(
        self,
        objects: list[BalanceObject],
    ) -> NumberFormatReport:
        """
        Анализ формата чисел (Гэзэуэй/Кн. 9).

        «Лёгкие» числа (кратные 5/10) воспринимаются спокойно.
        «Тяжёлые» числа (некруглые) создают напряжение.
        """
        light_numbers: list[str] = []
        heavy_numbers: list[str] = []

        for obj in objects:
            for attr, value in obj.attributes.items():
                label = f"{obj.name}.{attr}={value}"
                if isinstance(value, (int, float)):
                    if value != 0 and (value % 5 == 0 or value % 10 == 0):
                        light_numbers.append(label)
                    elif value != 0 and value != int(value):
                        heavy_numbers.append(label)
                    elif value != 0 and int(value) % 5 != 0:
                        heavy_numbers.append(label)

            # Стоимость
            if obj.cost is not None:
                label = f"{obj.name}.cost={obj.cost}"
                if obj.cost % 5 == 0 or obj.cost % 10 == 0:
                    light_numbers.append(label)
                else:
                    heavy_numbers.append(label)

        light_count = len(light_numbers)
        heavy_count = len(heavy_numbers)
        total = light_count + heavy_count

        if total > 0:
            light_ratio = light_count / total
            if light_ratio > 0.7:
                assessment = "Преобладают «лёгкие» числа — спокойное восприятие, подходит для казуальных игр."
            elif light_ratio > 0.4:
                assessment = "Смешанный формат чисел — сбалансированное восприятие."
            else:
                assessment = "Преобладают «тяжёлые» числа — ощущение сложности и напряжения, подходит для хардкорных игр."
        else:
            assessment = "Недостаточно числовых данных для анализа."

        return NumberFormatReport(
            light_numbers=light_numbers,
            heavy_numbers=heavy_numbers,
            assessment=assessment,
        )

    # ========================================================
    # Этап 7a: Построение Machinations-графа (алгоритм 3.6.5)
    # ========================================================

    def build_machinations_graph(
        self,
        input_data: BalanceInput,
        balance_map: BalanceMap,
        transitive_result: Optional[TransitiveResult] = None,
    ) -> MachinationsGraph:
        """
        Этап 7a: Построение Machinations-графа внутренней экономики игры.

        Алгоритм 3.6.5:
        1. Создать Pool-узлы для каждого ресурса
        2. Создать Source-узлы для faucets
        3. Создать Drain-узлы для sinks
        4. Создать Converter-узлы для conversion chains
        5. Обнаружить feedback loops через state connections
        6. Определить economic_type
        7. Обнаружить структурные паттерны Adams/Dormans

        Returns:
            MachinationsGraph — полный направленный граф экономики
        """
        start = time.time()
        nodes: list[MachinationsNode] = []
        flows: list[MachinationsResourceFlow] = []
        state_conns: list[MachinationsStateConnection] = []
        feedback_loops: list[MachinationsFeedbackLoop] = []

        resources = input_data.resources if input_data.resources else []

        # === Шаг 7a.1: Pool-узлы для каждого ресурса ===
        for res in resources:
            node_id = f"pool_{res}"
            # Начальное значение из первого объекта, использующего этот ресурс
            initial = 0.0
            for obj in input_data.objects:
                if res in obj.attributes:
                    initial = max(initial, obj.attributes[res] * 10)

            nodes.append(MachinationsNode(
                id=node_id,
                name=res,
                node_type="pool",
                initial_value=round(initial, 2),
                capacity=initial * 5 if initial > 0 else None,
                is_core=(res == balance_map.anchor),
            ))

        # Если ресурсов нет — создаём базовые pool-узлы из атрибутов объектов
        if not resources:
            seen_resources: set[str] = set()
            for obj in input_data.objects:
                for attr in obj.attributes:
                    if attr not in seen_resources:
                        seen_resources.add(attr)
                        node_id = f"pool_{attr}"
                        initial = obj.attributes[attr] * 5
                        nodes.append(MachinationsNode(
                            id=node_id,
                            name=attr,
                            node_type="pool",
                            initial_value=round(initial, 2),
                            capacity=initial * 10 if initial > 0 else None,
                            is_core=(attr == balance_map.anchor),
                        ))
            resources = list(seen_resources)

        # === Шаг 7a.2: Source-узлы (faucets) ===
        for res in resources:
            source_id = f"source_{res}"
            nodes.append(MachinationsNode(
                id=source_id,
                name=f"Source: {res}",
                node_type="source",
                rate=1.0,
                activation="automatic",
            ))
            # Поток: source → pool
            pool_id = f"pool_{res}"
            flows.append(MachinationsResourceFlow(
                source_id=source_id,
                target_id=pool_id,
                resource=res,
                rate=1.0,
                flow_type="automatic",
            ))

        # === Шаг 7a.3: Drain-узлы (sinks) ===
        for res in resources:
            drain_id = f"drain_{res}"
            nodes.append(MachinationsNode(
                id=drain_id,
                name=f"Drain: {res}",
                node_type="drain",
                rate=0.5,
            ))
            # Поток: pool → drain
            pool_id = f"pool_{res}"
            flows.append(MachinationsResourceFlow(
                source_id=pool_id,
                target_id=drain_id,
                resource=res,
                rate=0.5,
                flow_type="automatic",
            ))

        # === Шаг 7a.4: Converter-узлы для conversion chains ===
        # Если ресурсов ≥ 2, создаём конвертеры между парами
        for i in range(len(resources) - 1):
            conv_id = f"converter_{i}"
            res_in = resources[i]
            res_out = resources[i + 1]
            nodes.append(MachinationsNode(
                id=conv_id,
                name=f"Converter: {res_in} → {res_out}",
                node_type="converter",
                inputs=[res_in],
                outputs=[res_out],
                efficiency=0.8,
                activation="interactive",
            ))
            # Поток: pool_in → converter
            flows.append(MachinationsResourceFlow(
                source_id=f"pool_{res_in}",
                target_id=conv_id,
                resource=res_in,
                rate=1.0,
                flow_type="interactive",
            ))
            # Поток: converter → pool_out
            flows.append(MachinationsResourceFlow(
                source_id=conv_id,
                target_id=f"pool_{res_out}",
                resource=res_out,
                rate=0.8,
                flow_type="interactive",
            ))

        # === Шаг 7a.5: Обнаружение feedback loops ===
        # Упрощённая эвристика: если есть цепочка pool→converter→pool,
        # это потенциальная feedback loop
        for i in range(len(resources) - 1):
            loop_nodes = [f"pool_{resources[i]}", f"converter_{i}", f"pool_{resources[i + 1]}"]
            # Проверяем, возвращается ли цепочка к первому ресурсу
            if i == len(resources) - 2 and len(resources) > 2:
                # Замыкаем цикл
                loop_nodes.append(f"pool_{resources[0]}")
                feedback_loops.append(MachinationsFeedbackLoop(
                    nodes=loop_nodes,
                    loop_type="reinforcing",
                    strength=0.5,
                ))

        # Добавляем state connections для feedback
        for fl in feedback_loops:
            if len(fl.nodes) >= 2:
                state_conns.append(MachinationsStateConnection(
                    source_id=fl.nodes[0],
                    target_id=fl.nodes[1],
                    modifier="+" if fl.loop_type == "reinforcing" else "-",
                    formula=f"rate * (1 + pool_level / 100)",
                ))

        # === Шаг 7a.6: Определение economic_type ===
        source_count = sum(1 for n in nodes if n.node_type == "source")
        drain_count = sum(1 for n in nodes if n.node_type == "drain")
        converter_count = sum(1 for n in nodes if n.node_type == "converter")
        pool_count = sum(1 for n in nodes if n.node_type == "pool")

        reinforcing_loops = sum(1 for fl in feedback_loops if fl.loop_type == "reinforcing")
        balancing_loops = sum(1 for fl in feedback_loops if fl.loop_type == "balancing")

        if source_count > drain_count and reinforcing_loops > balancing_loops:
            economic_type = "engine"
        elif source_count <= drain_count and balancing_loops > reinforcing_loops:
            economic_type = "ecology"
        elif converter_count > 0 and source_count > 0 and drain_count > 0:
            economic_type = "economy"
        else:
            economic_type = "hybrid"

        # === Шаг 7a.7: Обнаружение структурных паттернов Adams/Dormans ===
        detected_patterns: list[str] = []

        # Упрощённая эвристика на основе состава узлов
        if source_count > 0 and converter_count == 0 and pool_count > 0:
            detected_patterns.append("Static Engine")
        if source_count > 0 and converter_count > 0:
            detected_patterns.append("Dynamic Engine")
        if converter_count >= 2:
            detected_patterns.append("Converter Engine")
        if reinforcing_loops > 0 and converter_count > 0:
            detected_patterns.append("Engine Building")
        if drain_count > 0 and source_count == 0:
            detected_patterns.append("Static Friction")
        if drain_count > 0 and converter_count > 0:
            detected_patterns.append("Dynamic Friction")
        if drain_count > source_count:
            detected_patterns.append("Stopping Mechanism")
        if drain_count > 0 and reinforcing_loops == 0:
            detected_patterns.append("Attrition")
        if reinforcing_loops > 0 and pool_count > 2:
            detected_patterns.append("Escalating Challenge")
        if converter_count > 1 and reinforcing_loops > 0:
            detected_patterns.append("Escalating Complexity")
        if reinforcing_loops > 1:
            detected_patterns.append("Arms Race")
        if balancing_loops > 0 and reinforcing_loops > 0:
            detected_patterns.append("Play-Style Reinforcement")

        # Если паттернов не обнаружено — добавляем дефолтный
        if not detected_patterns:
            detected_patterns.append("Static Engine")

        graph = MachinationsGraph(
            nodes=nodes,
            resource_flows=flows,
            state_connections=state_conns,
            feedback_loops=feedback_loops,
            resource_count=len(resources),
            node_count=len(nodes),
            flow_count=len(flows),
            economic_type=economic_type,
            structural_patterns=detected_patterns,
        )

        logger.info(
            f"[Stage 7a] Machinations graph built: "
            f"{len(nodes)} nodes, {len(flows)} flows, "
            f"type={economic_type}, "
            f"patterns={detected_patterns} "
            f"({time.time() - start:.2f}s)"
        )
        return graph

    # ========================================================
    # Этап 7b: Machinations-симуляция (алгоритм 3.6.9)
    # ========================================================

    def machinations_simulate(
        self,
        graph: MachinationsGraph,
        config: Optional[MachinationsSimConfig] = None,
    ) -> MachinationsSimResult:
        """
        Этап 7b: Machinations-симуляция внутренней экономики.

        Алгоритм 3.6.9:
        1. Инициализировать состояние ресурсов из Pool-узлов
        2. Запустить N прогонов с разными стратегиями
        3. Каждый прогон: T тиков с обработкой sources, drains, converters
        4. Записывать снепшоты через каждые recording_interval тиков
        5. Детектировать runaway и stall
        6. Агрегировать результаты по всем прогонам
        7. Оценка качества (QualityAssessment)

        Returns:
            MachinationsSimResult с агрегированными данными симуляции
        """
        start = time.time()
        cfg = config or MachinationsSimConfig()

        # Устанавливаем artificial players если не заданы
        if not cfg.artificial_players:
            cfg.artificial_players = DEFAULT_ARTIFICIAL_PLAYERS.copy()

        # Ограничиваем количество прогонов для производительности
        num_runs = min(cfg.num_runs, 10)
        ticks = min(cfg.ticks, 5000)
        recording_interval = cfg.recording_interval

        # === Инициализация: извлекаем Pool-узлы ===
        pool_nodes = [n for n in graph.nodes if n.node_type == "pool"]
        source_nodes = [n for n in graph.nodes if n.node_type == "source"]
        drain_nodes = [n for n in graph.nodes if n.node_type == "drain"]
        converter_nodes = [n for n in graph.nodes if n.node_type == "converter"]

        # Начальное состояние ресурсов
        initial_state: dict[str, float] = {}
        for node in pool_nodes:
            initial_state[node.name] = node.initial_value

        if not initial_state:
            # Fallback: если нет pool-узлов с ресурсами
            initial_state = {"default_resource": 100.0}

        # === Запуск прогонов ===
        all_snapshots: list[list[EconomyRunSnapshot]] = []
        runaway_flags: list[bool] = []
        stall_flags: list[bool] = []
        final_levels: dict[str, int] = {}  # player → level

        for run_idx in range(num_runs):
            # Выбираем стратегию игрока
            player = cfg.artificial_players[run_idx % len(cfg.artificial_players)]
            player_name = player.get("name", f"player_{run_idx}")
            strategy = player.get("strategy", "random_balanced")

            # Инициализируем состояние
            resource_state = dict(initial_state)
            level = 1
            run_snapshots: list[EconomyRunSnapshot] = []
            is_runaway = False
            is_stall = False

            for tick in range(1, ticks + 1):
                actions_taken: list[str] = []

                # Выбор действия на основе стратегии
                action = self._select_player_action(
                    strategy, resource_state, source_nodes, drain_nodes, converter_nodes
                )
                if action:
                    actions_taken.append(action)

                # Обработка автоматических Source-узлов
                for src_node in source_nodes:
                    if src_node.activation == "automatic" and src_node.rate:
                        target_pool = src_node.name.replace("Source: ", "")
                        if target_pool in resource_state:
                            resource_state[target_pool] += src_node.rate

                # Обработка автоматических Drain-узлов
                for drn_node in drain_nodes:
                    if drn_node.rate:
                        source_pool = drn_node.name.replace("Drain: ", "")
                        if source_pool in resource_state:
                            resource_state[source_pool] -= drn_node.rate

                # Обработка Converter-узлов (только если активированы игроком или автоматически)
                for conv_node in converter_nodes:
                    if conv_node.activation == "automatic" or (action and "convert" in action.lower()):
                        if conv_node.inputs and conv_node.outputs:
                            in_res = conv_node.inputs[0]
                            out_res = conv_node.outputs[0]
                            efficiency = conv_node.efficiency or 0.8
                            if in_res in resource_state and resource_state[in_res] >= 1.0:
                                resource_state[in_res] -= 1.0
                                if out_res in resource_state:
                                    resource_state[out_res] += efficiency
                                else:
                                    resource_state[out_res] = efficiency

                # Enforce bounds: clamp to [0, capacity]
                for pool_node in pool_nodes:
                    name = pool_node.name
                    if name in resource_state:
                        resource_state[name] = max(0.0, resource_state[name])
                        if pool_node.capacity is not None:
                            resource_state[name] = min(resource_state[name], pool_node.capacity)

                # Детекция runaway: любой ресурс > 10 * initial
                for res_name, value in resource_state.items():
                    init_val = initial_state.get(res_name, 0.0)
                    if init_val > 0 and value > 10 * init_val:
                        is_runaway = True

                # Детекция stall: любой ресурс < 0.1 * initial
                for res_name, value in resource_state.items():
                    init_val = initial_state.get(res_name, 0.0)
                    if init_val > 0 and value < 0.1 * init_val:
                        is_stall = True

                # Прогрессия: каждый 100 тиков — уровень
                if tick % 100 == 0:
                    level += 1

                # Запись снепшота
                if tick % recording_interval == 0:
                    run_snapshots.append(EconomyRunSnapshot(
                        tick=tick,
                        resources={k: round(v, 2) for k, v in resource_state.items()},
                        level=level,
                        actions_taken=actions_taken,
                    ))

            runaway_flags.append(is_runaway)
            stall_flags.append(is_stall)
            final_levels[player_name] = level
            all_snapshots.append(run_snapshots)

        # === Агрегация результатов ===
        # avg_resource_curves: усредняем по прогонам
        resource_names = list(initial_state.keys())
        avg_resource_curves: dict[str, list[float]] = {res: [] for res in resource_names}
        resource_ranges: dict[str, dict] = {
            res: {"min": float("inf"), "max": float("-inf")} for res in resource_names
        }

        # Собираем все значения по интервалам
        interval_data: dict[str, list[list[float]]] = {res: [] for res in resource_names}
        for run_snapshots in all_snapshots:
            for res in resource_names:
                values = [snap.resources.get(res, 0.0) for snap in run_snapshots]
                interval_data[res].append(values)

        # Усредняем
        for res in resource_names:
            all_series = interval_data[res]
            if all_series:
                max_len = max(len(s) for s in all_series)
                for i in range(max_len):
                    vals = [s[i] for s in all_series if i < len(s)]
                    avg = sum(vals) / len(vals) if vals else 0.0
                    avg_resource_curves[res].append(round(avg, 2))

                    # Обновляем min/max
                    if vals:
                        resource_ranges[res]["min"] = min(resource_ranges[res]["min"], min(vals))
                        resource_ranges[res]["max"] = max(resource_ranges[res]["max"], max(vals))

        # Убираем inf из ranges
        for res in resource_names:
            if resource_ranges[res]["min"] == float("inf"):
                resource_ranges[res]["min"] = 0.0
            if resource_ranges[res]["max"] == float("-inf"):
                resource_ranges[res]["max"] = 0.0

        runaway_frequency = sum(1 for f in runaway_flags if f) / num_runs if num_runs > 0 else 0.0
        stall_frequency = sum(1 for f in stall_flags if f) / num_runs if num_runs > 0 else 0.0
        stability_index = round(1.0 - (runaway_frequency + stall_frequency) / 2.0, 4)

        # Build gap: ratio optimal vs casual progression
        optimal_level = final_levels.get("optimal", 1)
        casual_level = final_levels.get("casual", 1)
        build_gap = round(optimal_level / max(casual_level, 1), 2)

        aggregated = AggregatedSimData(
            avg_resource_curves=avg_resource_curves,
            resource_ranges=resource_ranges,
            runaway_frequency=round(runaway_frequency, 4),
            stall_frequency=round(stall_frequency, 4),
            build_gap=build_gap,
            stability_index=stability_index,
        )

        # === Оценка качества ===
        resources_in_bounds = all(
            resource_ranges[res]["min"] >= 0
            and (resource_ranges[res]["max"] <= (pool_nodes[i].capacity or float("inf")))
            for i, res in enumerate(resource_names)
            if i < len(pool_nodes)
        )

        no_runaway_for_minmaxer = runaway_frequency < 0.1
        no_stall_for_casual = stall_frequency < 0.1
        build_gap_acceptable = build_gap < 3.0
        economy_stable = stability_index > 0.7

        critical_issues: list[str] = []
        quality_warnings: list[str] = []

        if not no_runaway_for_minmaxer:
            critical_issues.append(
                f"Runaway при оптимальной стратегии: частота {runaway_frequency:.1%} (> 10%)."
            )
        if not no_stall_for_casual:
            critical_issues.append(
                f"Stall при казуальной стратегии: частота {stall_frequency:.1%} (> 10%)."
            )
        if not build_gap_acceptable:
            quality_warnings.append(
                f"Разрыв билдов слишком велик: {build_gap:.1f}× (> 3.0×)."
            )
        if not economy_stable:
            quality_warnings.append(
                f"Экономика нестабильна: индекс {stability_index:.2f} (< 0.7)."
            )

        overall_pass = (
            resources_in_bounds
            and no_runaway_for_minmaxer
            and no_stall_for_casual
            and build_gap_acceptable
            and economy_stable
        )

        quality = QualityAssessment(
            resources_in_bounds=resources_in_bounds,
            no_runaway_for_minmaxer=no_runaway_for_minmaxer,
            no_stall_for_casual=no_stall_for_casual,
            build_gap_acceptable=build_gap_acceptable,
            economy_stable=economy_stable,
            overall_pass=overall_pass,
            critical_issues=critical_issues,
            warnings=quality_warnings,
        )

        # === Детекция патологий ===
        detected_pathologies: list[str] = []
        if runaway_frequency > 0.3:
            detected_pathologies.append("runaway")
        if stall_frequency > 0.3:
            detected_pathologies.append("stall")
        if runaway_frequency > 0.1 and stall_frequency > 0.1:
            detected_pathologies.append("oscillation")
        if stall_frequency > 0.5:
            detected_pathologies.append("deadlock")

        # Проверка инфляции: ресурсы постоянно растут
        for res in resource_names:
            curve = avg_resource_curves.get(res, [])
            if len(curve) >= 4:
                if all(curve[i] > curve[i - 1] for i in range(1, len(curve))):
                    if "inflation" not in detected_pathologies:
                        detected_pathologies.append("inflation")

        # Проверка стагнации: ресурсы не меняются
        for res in resource_names:
            curve = avg_resource_curves.get(res, [])
            if len(curve) >= 4:
                if all(abs(curve[i] - curve[0]) < 0.01 for i in range(1, len(curve))):
                    if "stagnation" not in detected_pathologies:
                        detected_pathologies.append("stagnation")

        # === Рекомендации ===
        recommendations: list[str] = []
        if "runaway" in detected_pathologies:
            recommendations.append(
                "Обнаружен runaway: добавить убывающую доходность (diminishing returns) "
                "или порог насыщения для ресурсов."
            )
        if "stall" in detected_pathologies:
            recommendations.append(
                "Обнаружен stall: увеличить скорость генерации ресурсов (source rate) "
                "или уменьшить потребление (drain rate)."
            )
        if "oscillation" in detected_pathologies:
            recommendations.append(
                "Обнаружена осцилляция: сбалансировать reinforcing и balancing feedback."
            )
        if "inflation" in detected_pathologies:
            recommendations.append(
                "Обнаружена инфляция: добавить sink-механики или повысить drain rate."
            )
        if "stagnation" in detected_pathologies:
            recommendations.append(
                "Обнаружена стагнация: добавить конвертеры или интерактивные механики "
                "для стимуляции экономики."
            )
        if not build_gap_acceptable:
            recommendations.append(
                f"Разрыв optimal/casual = {build_gap:.1f}× — рассмотрите сглаживание кривой прогрессии."
            )

        if not recommendations:
            recommendations.append("Экономика стабильна. Коррекция не требуется.")

        # Собираем снепшоты типичного прогона (первый с каждой стратегией)
        representative_snapshots: list[EconomyRunSnapshot] = []
        for run_snapshots in all_snapshots[:4]:
            representative_snapshots.extend(run_snapshots)

        result = MachinationsSimResult(
            config=cfg,
            graph=graph,
            runs=num_runs,
            aggregated=aggregated,
            quality=quality,
            snapshots=representative_snapshots,
            detected_pathologies=detected_pathologies,
            recommendations=recommendations,
        )

        logger.info(
            f"[Stage 7b] Machinations simulation: "
            f"{num_runs} runs × {ticks} ticks, "
            f"stability_index={stability_index:.3f}, "
            f"pathologies={detected_pathologies} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _select_player_action(
        self,
        strategy: str,
        resource_state: dict[str, float],
        source_nodes: list[MachinationsNode],
        drain_nodes: list[MachinationsNode],
        converter_nodes: list[MachinationsNode],
    ) -> str:
        """Выбор действия на основе стратегии игрока-архетипа."""
        if strategy == "maximize_progression":
            # Optimal: всегда конвертируем, если можно
            if converter_nodes:
                conv = converter_nodes[0]
                return f"convert_{conv.inputs[0] if conv.inputs else 'unknown'}"
            return "wait"

        elif strategy == "random_balanced":
            # Casual: случайное действие
            actions = ["wait"]
            if converter_nodes:
                actions.append(f"convert_{converter_nodes[0].name}")
            return random.choice(actions)

        elif strategy == "exploit_best_cycle":
            # Minmaxer: конвертируем ресурс с максимальным запасом
            if converter_nodes and resource_state:
                best_res = max(resource_state, key=resource_state.get)  # type: ignore[arg-type]
                return f"convert_{best_res}"
            return "wait"

        elif strategy == "try_all_options":
            # Explorer: пробует разные конвертеры
            if converter_nodes:
                conv = random.choice(converter_nodes)
                return f"convert_{conv.name}"
            return "wait"

        return "wait"

    # ========================================================
    # Комбинированный анализ устойчивости (MC + Machinations)
    # ========================================================

    def analyze_simulation_stability(
        self,
        monte_carlo_result: Optional[MonteCarloResult] = None,
        machinations_result: Optional[MachinationsSimResult] = None,
    ) -> StabilityAnalysis:
        """
        Комбинированный анализ устойчивости на основе результатов
        Monte Carlo и Machinations симуляций.

        Объединяет:
        - Monte Carlo verdict → stability assessment
        - Machinations quality → pathology risks
        - Генерация комбинированных рекомендаций

        Returns:
            StabilityAnalysis с общей оценкой устойчивости
        """
        start = time.time()

        # Определяем общую устойчивость
        overall_stability = "stable"
        pathology_risks: list[str] = []
        analysis_items: list[dict] = []
        recommendations: list[str] = []
        positive_loops = 0
        negative_loops = 0

        # === Анализ Monte Carlo ===
        if monte_carlo_result is not None:
            mc_verdict = monte_carlo_result.balance_verdict
            mc_spread = monte_carlo_result.win_rate_spread
            mc_correlation = monte_carlo_result.ranking_correlation

            if mc_verdict == "POOR":
                mc_stability = "unstable"
                pathology_risks.append("runaway")  # Доминантная стратегия
            elif mc_verdict == "MODERATE":
                mc_stability = "conditionally_stable"
                pathology_risks.append("oscillation")
            else:
                mc_stability = "stable"

            analysis_items.append({
                "source": "monte_carlo",
                "verdict": mc_verdict,
                "stability": mc_stability,
                "win_rate_spread": mc_spread,
                "ranking_correlation": mc_correlation,
            })

            # Если корреляция с формальным анализом низкая — предупреждение
            if mc_correlation < SPEARMAN_CORRELATION_WARNING:
                recommendations.append(
                    f"Monte Carlo: низкая корреляция с формальным анализом "
                    f"(ρ = {mc_correlation:.3f}). Пересмотрите веса атрибутов."
                )

            # Рекомендации на основе вердикта
            if mc_verdict == "POOR":
                recommendations.append(
                    f"Monte Carlo: win rate spread = {mc_spread:.2f} (POOR). "
                    f"Требуется значительная коррекция баланса."
                )
                positive_loops += 1  # Усиливающая петля дисбаланса
            elif mc_verdict == "MODERATE":
                recommendations.append(
                    f"Monte Carlo: win rate spread = {mc_spread:.2f} (MODERATE). "
                    f"Рекомендуется точечная коррекция."
                )

        # === Анализ Machinations ===
        if machinations_result is not None:
            mach_pathologies = machinations_result.detected_pathologies
            mach_quality = machinations_result.quality

            if mach_quality is not None:
                if not mach_quality.economy_stable:
                    mach_stability = "unstable"
                elif mach_quality.critical_issues:
                    mach_stability = "conditionally_stable"
                else:
                    mach_stability = "stable"

                analysis_items.append({
                    "source": "machinations",
                    "stability": mach_stability,
                    "stability_index": machinations_result.aggregated.stability_index if machinations_result.aggregated else 0.0,
                    "runaway_frequency": machinations_result.aggregated.runaway_frequency if machinations_result.aggregated else 0.0,
                    "stall_frequency": machinations_result.aggregated.stall_frequency if machinations_result.aggregated else 0.0,
                    "build_gap": machinations_result.aggregated.build_gap if machinations_result.aggregated else 0.0,
                })

                # Добавляем патологии
                for pathology in mach_pathologies:
                    if pathology not in pathology_risks:
                        pathology_risks.append(pathology)

                # Machinations feedback loops
                if machinations_result.graph and machinations_result.graph.feedback_loops:
                    for fl in machinations_result.graph.feedback_loops:
                        if fl.loop_type == "reinforcing":
                            positive_loops += 1
                        else:
                            negative_loops += 1

                # Рекомендации из Machinations
                recommendations.extend(machinations_result.recommendations)

        # === Комбинированная оценка устойчивости ===
        stability_scores = {
            "stable": 0,
            "conditionally_stable": 0,
            "unstable": 0,
        }
        for item in analysis_items:
            s = item.get("stability", "stable")
            stability_scores[s] = stability_scores.get(s, 0) + 1

        # Если любой источник unstable → overall unstable
        if stability_scores.get("unstable", 0) > 0:
            overall_stability = "unstable"
        elif stability_scores.get("conditionally_stable", 0) > 0:
            overall_stability = "conditionally_stable"
        else:
            overall_stability = "stable"

        # Если нет данных от симуляций — используем default stable
        if not analysis_items:
            overall_stability = "stable"
            pathology_risks = []
            recommendations.append(
                "Симуляции не выполнялись. Рекомендуется запустить Monte Carlo и Machinations "
                "для более полной оценки устойчивости."
            )

        result = StabilityAnalysis(
            overall_stability=overall_stability,
            pathology_risks=pathology_risks,
            analysis=analysis_items,
            positive_loops=positive_loops,
            negative_loops=negative_loops,
            recommendations=recommendations,
        )

        logger.info(
            f"[Stability] Combined analysis: "
            f"stability={overall_stability}, "
            f"risks={pathology_risks}, "
            f"+loops={positive_loops}, -loops={negative_loops} "
            f"({time.time() - start:.2f}s)"
        )
        return result
