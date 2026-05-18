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


# ============================================================
# Balance Service
# ============================================================

class BalanceService:
    """
    Блок 4: Анализ баланса.
    Реализует алгоритм 3.4 — Этапы 1–5 + Q-фактор.

    Методы:
    - classify_balance_task() — Этап 1: классификация задачи балансировки
    - transitive_balance() — Этап 2: transitive-анализ (cost-power кривые)
    - analyze_stability() — Этап 3: анализ устойчивости (Schreiber)
    - intransitive_balance() — Этап 4: нетранзитивный анализ (RPS-структуры)
    - situational_balance() — Этап 5: ситуационный анализ (контекстная ценность)
    - calculate_q_factor() — Q-фактор: выявление избыточных компонентов
    - balance_full() — полный пайплайн Этапов 1–5 + Q-фактор
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
    ) -> BalanceResult:
        """
        Полный пайплайн балансировки — Этапы 1–5 + Q-фактор алгоритма 3.4.

        Выполняет последовательно:
        1. Классификацию задачи балансировки → BalanceMap
        2. Transitive-анализ → TransitiveResult
        3. Анализ устойчивости → StabilityAssessment
        4. Нетранзитивный анализ → IntransitiveResult (если run_intransitive)
        5. Ситуационный анализ → SituationalResult (если run_situational)
        Q. Q-фактор анализ → QFactorResult (если run_q_factor)

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
                # Q-фактор не получает номер этапа, но отмечаем как выполненный
                stages_completed.append(6)  # Используем 6 для Q-фактора
                all_warnings.extend(q_factor_result.warnings)
                all_suggestions.extend(q_factor_result.suggestions)

                logger.info(
                    f"[Pipeline] Q-factor completed: "
                    f"{len(q_factor_result.redundant_objects)} redundant objects"
                )
            except Exception as e:
                logger.error(f"[Pipeline] Q-factor analysis failed: {e}")
                all_warnings.append(f"Q-фактор анализ не удалось выполнить: {e}")

        latency_ms = int((time.time() - pipeline_start) * 1000)

        logger.info(
            f"[Pipeline] Full balance completed in {latency_ms}ms. "
            f"Stages: {stages_completed}, "
            f"Stability: {stability_result.get('overall_stability', 'unknown')}"
        )

        return BalanceResult(
            balance_map=balance_map,
            transitive_result=transitive_result,
            intransitive_result=intransitive_result,
            situational_result=situational_result,
            q_factor_result=q_factor_result,
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
