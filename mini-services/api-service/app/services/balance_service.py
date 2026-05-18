"""
Gidede — Balance Service
Фаза 4.C.1: Блок 4 — Transitive-анализ баланса (алгоритм 3.4)

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


# ============================================================
# Balance Service
# ============================================================

class BalanceService:
    """
    Блок 4: Transitive-анализ баланса.
    Реализует алгоритм 3.4 — Этапы 1–3.

    Методы:
    - classify_balance_task() — Этап 1: классификация задачи балансировки
    - transitive_balance() — Этап 2: transitive-анализ (cost-power кривые)
    - analyze_stability() — Этап 3: анализ устойчивости (Schreiber)
    - balance_full() — полный пайплайн Этапов 1–3
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
    # Полный пайплайн: Этапы 1–3
    # ========================================================

    async def balance_full(
        self,
        input_data: BalanceInput,
        mda_profile: Optional[dict] = None,
        project_state: Optional[dict] = None,
    ) -> BalanceResult:
        """
        Полный пайплайн балансировки — Этапы 1–3 алгоритма 3.4.

        Выполняет последовательно:
        1. Классификацию задачи балансировки → BalanceMap
        2. Transitive-анализ → TransitiveResult
        3. Анализ устойчивости → StabilityAssessment

        Returns:
            BalanceResult с результатами всех этапов
        """
        pipeline_start = time.time()
        models_used: list[str] = []
        all_warnings: list[str] = []
        all_suggestions: list[str] = []
        stages_completed: list[int] = []

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

        latency_ms = int((time.time() - pipeline_start) * 1000)

        logger.info(
            f"[Pipeline] Full balance completed in {latency_ms}ms. "
            f"Stages: {stages_completed}, "
            f"Stability: {stability_result.get('overall_stability', 'unknown')}"
        )

        return BalanceResult(
            balance_map=balance_map,
            transitive_result=transitive_result,
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

        return loops
