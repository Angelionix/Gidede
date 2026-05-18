"""
Gidede — Progression Service
Фаза 4.C.5: Блок 5 — Прогрессия (алгоритм 3.5, Этапы 1-4)

Реализация пайплайна проектирования прогрессии из алгоритма 3.5:
- Этап 1: Макро-параметры → ProgressionMacroModel (3.5.1)
  • Жанровые эвристики длительности (genre → hours)
  • pacing → количество уровней (transitions/hour)
  • Требования к контенту (content_stages, enemy_configs, reward_types)
  • Жанровые эвристики типа прогрессии (genre → curve type)
  • Оценка emergence ratio (coreLoop + mdaProfile)
  • Модель замок-ключ (genre → lock_key_model)
  • AI-обогащение через PLAN_PROGRESSION_MACROS

- Этап 2: Разбиение на тиры → TierModel (3.5.2)
  • Расчёт num_tiers (min 2, max 5, optimal 3-4)
  • Распределение уровней (неравномерное: ранние короткие, поздние длинные)
  • Характеристика каждого тира (scale, dominant_mechanic, balance_type,
    difficulty, resource_state, transition_trigger)
  • Карта переходов

- Этап 3: Кривые прогрессии → ProgressionCurves (3.5.3)
  • XP → Level (exponential/triangular/linear)
  • Level → Power (linear/polynomial/logistic)
  • Level → Cost (proportional to power × multiplier)
  • Difficulty (Schreiber perceived difficulty)
  • Проверка консистентности (income vs cost)
  • AI-обогащение через GENERATE_PROGRESSION_CURVES

- Этап 4: Контент-план → ContentPlan (3.5.4)
  • Контент-требования по тирам (enemies, rewards, abilities, milestones, pacing)
  • Дерево разблокировок (что открывается на каждом уровне)
  • Таблица воспринимаемой сложности (level-by-level с spike на границах тиров)
  • AI-обогащение через GENERATE_CONTENT_PLAN

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry), 4.A.12 (Shared Types)
"""

import time
import logging
import math
from typing import Any, Optional

from app.ai.executor import PromptExecutor, PromptResult, PromptExecutionOptions

from app.schemas.progression import (
    ProgressionInput,
    ProgressionConstraints,
    ProgressionMacroModel,
    TierInfo,
    TierModel,
    CurveSpec,
    ProgressionCurves,
    ContentTierPlan,
    UnlockEntry,
    PerceivedDifficultyEntry,
    ContentPlan,
    ProgressionValidation,
    ProgressionProfile,
)

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.5
# ============================================================

# Жанр → длительность (часы)
GENRE_DURATION_MAP: dict[str, int] = {
    "casual": 5, "puzzle": 10, "rpg": 50, "action": 15,
    "strategy": 40, "survival": 60, "roguelike": 100,
    "mmorpg": 500, "idle": 100, "shooter": 12,
    "metroidvania": 20, "sandbox": 80, "horror": 8,
    "platformer": 10, "fighting": 200, "racing": 15,
    "rhythm": 30, "visual_novel": 10, "simulation": 50,
    "tower_defense": 25, "party": 5, "educational": 5,
}

# Pacing → transitions per hour
PACING_MAP: dict[str, float] = {
    "relaxed": 0.3,
    "balanced": 0.5,
    "intense": 1.0,
}

# Жанр → тип прогрессии
GENRE_PROGRESSION_MAP: dict[str, str] = {
    "casual": "linear", "idle": "diminishing", "rpg": "s_curve",
    "roguelike": "intermittent", "strategy": "exponential",
    "survival": "s_curve", "action": "linear", "mmorpg": "diminishing",
    "shooter": "intermittent", "metroidvania": "s_curve",
}

# Жанр → модель замок-ключ
GENRE_LOCK_KEY_MAP: dict[str, str] = {
    "rpg": "metroidvania", "action": "linear", "strategy": "emergent",
    "survival": "dynamic", "roguelike": "emergent", "idle": "linear",
    "mmorpg": "hybrid", "shooter": "linear", "metroidvania": "metroidvania",
}

# Распределение тиров (2-5 тиров): доля уровней на каждый тир
TIER_DISTRIBUTIONS: dict[int, list[float]] = {
    2: [0.3, 0.7],
    3: [0.2, 0.3, 0.5],
    4: [0.15, 0.20, 0.25, 0.40],
    5: [0.10, 0.15, 0.20, 0.25, 0.30],
}

# Масштабы тиров (D&D-модель)
TIER_SCALES = [
    "Локальный", "Региональный", "Мировой",
    "Мультивселенский", "Трансцендентный",
]

# Состояние ресурсов по структурному типу (engine/economy/ecology)
ENGINE_RESOURCE_STATES = ["scarcity", "growth", "abundance", "escalation", "escalation"]
ECONOMY_RESOURCE_STATES = ["scarcity", "unfolding", "complexity", "endgame", "endgame"]
ECOLOGY_RESOURCE_STATES = ["tension", "expansion", "metastability", "competition", "competition"]

# Жанр → тип XP-кривой
GENRE_XP_CURVE_MAP: dict[str, str] = {
    "rpg": "triangular", "action": "linear", "idle": "exponential",
    "strategy": "linear", "survival": "linear", "roguelike": "triangular",
    "mmorpg": "exponential", "shooter": "linear",
}

# Жанр → тип power-кривой
GENRE_POWER_CURVE_MAP: dict[str, str] = {
    "rpg": "polynomial", "action": "linear", "idle": "polynomial",
    "strategy": "polynomial", "survival": "logistic", "roguelike": "linear",
    "mmorpg": "polynomial", "shooter": "linear",
}

# Механики по жанрам для тиров
GENRE_TIER_MECHANICS: dict[str, list[str]] = {
    "rpg": ["Исследование", "Сражения", "Развитие персонажа", "Рейды", "Эндгейм"],
    "action": ["Базовые атаки", "Комбо-система", "Спецприёмы", "Боссы", "Челлендж-режим"],
    "strategy": ["Сбор ресурсов", "Строительство", "Армия", "Дипломатия", "Глобальное доминирование"],
    "survival": ["Сбор", "Крафт", "Строительство базы", "Защита", "Эндгейм"],
    "roguelike": ["Базовые классы", "Модификаторы", "Синергии", "Альтернативные пути", "Мега-босс"],
    "mmorpg": ["Квесты", "Подземелья", "Рейды", "PvP", "Эндгейм"],
    "shooter": ["Базовое оружие", "Модификации", "Спецоружие", "Тактические миссии", "Рейтинговый режим"],
    "metroidvania": ["Базовые способности", "Двойной прыжок", "Телепортация", "Полёт", "Финальные способности"],
}

# Типы разблокировок по жанрам
GENRE_UNLOCK_TYPES: dict[str, list[str]] = {
    "rpg": ["ability", "spell", "area", "item", "boss"],
    "action": ["ability", "combo", "weapon", "boss", "feature"],
    "strategy": ["unit", "building", "technology", "area", "feature"],
    "survival": ["recipe", "tool", "area", "structure", "feature"],
    "roguelike": ["character", "modifier", "relic", "boss", "mode"],
    "mmorpg": ["ability", "dungeon", "mount", "raid", "feature"],
    "shooter": ["weapon", "attachment", "perk", "map", "mode"],
    "metroidvania": ["ability", "area", "upgrade", "boss", "shortcut"],
}

# Модели монетизации → влияние на гринд
MONETIZATION_GRIND_MULTIPLIER: dict[str, float] = {
    "premium": 1.0,       # Без искусственного гринда
    "freemium": 1.3,      # Умеренный дополнительный гринд
    "p2w": 1.8,           # Значительный гринд
    "cosmetic": 1.0,      # Без влияния
    "subscription": 1.1,  # Минимальный
}

# Минимальный/максимальный размер тира
MIN_TIER_LEVELS = 3
MAX_TIER_LEVELS = 30

# Пороги валидации
GRIND_WARNING_THRESHOLD = 5
GRIND_CRITICAL_THRESHOLD = 10
WALL_DIFFICULTY_SPIKE = 0.3  # Spike > 0.3 на одном уровне = wall


# ============================================================
# Progression Service
# ============================================================

class ProgressionService:
    """
    Блок 5: Проектирование прогрессии.
    Реализует алгоритм 3.5 — Этапы 1–4.

    Методы:
    - calculate_macro_params() — Этап 1: макро-параметры
    - plan_tiers() — Этап 2: разбиение на тиры
    - build_curves() — Этап 3: кривые прогрессии
    - generate_content_plan() — Этап 4: контент-план
    - progression_design_full() — полный пайплайн (Этапы 1-4)
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Макро-параметры (3.5.1)
    # ========================================================

    async def calculate_macro_params(
        self,
        input_data: ProgressionInput,
        project_state: Optional[dict] = None,
    ) -> ProgressionMacroModel:
        """
        Этап 1: Определение макро-параметров прогрессии.

        Алгоритм 3.5.1:
        1. Определить целевую длительность по жанру
        2. Рассчитать количество уровней (pacing × duration)
        3. Определить тип прогрессии по жанру
        4. Рассчитать требования к контенту
        5. Оценить emergence ratio
        6. Определить модель замок-ключ
        7. AI-обогащение через PLAN_PROGRESSION_MACROS (fallback → эвристики)

        Returns:
            ProgressionMacroModel с макро-параметрами
        """
        start = time.time()
        genre = input_data.concept.get("genre", "").lower()

        # === Шаг 1.1: Целевая длительность ===
        duration = input_data.targetDuration
        if not duration:
            duration = GENRE_DURATION_MAP.get(genre, 20)
            logger.info(f"[Stage 1.1] Duration from genre '{genre}': {duration}h")

        # === Шаг 1.2: Количество уровней ===
        levels = input_data.targetLevels
        if not levels:
            # pacing × duration × base_levels_per_transition
            pacing_key = input_data.constraints.flowTarget
            transitions_per_hour = PACING_MAP.get(pacing_key, 0.5)
            base_levels_per_transition = 5  # ~5 уровней на каждый переход
            levels = max(10, int(duration * transitions_per_hour * base_levels_per_transition))
            logger.info(
                f"[Stage 1.2] Levels calculated: {levels} "
                f"(duration={duration}h, pacing={pacing_key}, t/h={transitions_per_hour})"
            )

        # === Шаг 1.3: Тип прогрессии ===
        progression_type = input_data.progressionType
        if not progression_type:
            progression_type = GENRE_PROGRESSION_MAP.get(genre, "linear")
            logger.info(f"[Stage 1.3] Progression type from genre '{genre}': {progression_type}")

        # === Шаг 1.4: Требования к контенту ===
        content_requirements = self._calculate_content_requirements(
            genre=genre,
            levels=levels,
            duration=duration,
            progression_type=progression_type,
            content_budget=input_data.constraints.contentBudget,
        )

        # === Шаг 1.5: Emergence ratio ===
        emergence_ratio = self._assess_emergence_ratio(
            input_data.coreLoop, input_data.mdaProfile, genre
        )

        # === Шаг 1.6: Модель замок-ключ ===
        lock_key_model = GENRE_LOCK_KEY_MAP.get(genre, "linear")
        logger.info(f"[Stage 1.6] Lock-key model from genre '{genre}': {lock_key_model}")

        # === Шаг 1.7: AI-обогащение ===
        models_used: list[str] = []
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="PLAN_PROGRESSION_MACROS",
                inputs={
                    "genre": genre,
                    "duration": duration,
                    "levels": levels,
                    "progression_type": progression_type,
                    "monetization_model": input_data.monetizationModel,
                    "core_loop_type": (input_data.coreLoop or {}).get("structural_type", ""),
                    "flow_target": input_data.constraints.flowTarget,
                    "content_budget": input_data.constraints.contentBudget,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            ai_data = prompt_result.data
            if isinstance(ai_data, dict):
                # Обогащаем результат AI-данными, если они есть
                if "suggested_duration" in ai_data and isinstance(ai_data["suggested_duration"], (int, float)):
                    duration = max(1, int(ai_data["suggested_duration"]))
                if "suggested_levels" in ai_data and isinstance(ai_data["suggested_levels"], (int, float)):
                    levels = max(3, int(ai_data["suggested_levels"]))
                if "suggested_progression_type" in ai_data and isinstance(ai_data["suggested_progression_type"], str):
                    progression_type = ai_data["suggested_progression_type"]
                if "emergence_ratio" in ai_data and isinstance(ai_data["emergence_ratio"], (int, float)):
                    emergence_ratio = float(ai_data["emergence_ratio"])
                if "lock_key_model" in ai_data and isinstance(ai_data["lock_key_model"], str):
                    lock_key_model = ai_data["lock_key_model"]
                if "content_suggestions" in ai_data and isinstance(ai_data["content_suggestions"], dict):
                    content_requirements.update(ai_data["content_suggestions"])
                models_used.append("PLAN_PROGRESSION_MACROS")
                logger.info("[Stage 1.7] AI enrichment applied for macro params")
        except Exception as e:
            logger.warning(
                f"[Stage 1.7] AI enrichment (PLAN_PROGRESSION_MACROS) failed, "
                f"using heuristics: {e}"
            )

        macro_model = ProgressionMacroModel(
            duration=duration,
            levels=levels,
            progressionType=progression_type,
            monetizationModel=input_data.monetizationModel,
            contentRequirements=content_requirements,
            emergenceRatio=round(emergence_ratio, 3),
            lockKeyModel=lock_key_model,
        )

        logger.info(
            f"[Stage 1] Macro params: duration={duration}h, levels={levels}, "
            f"type={progression_type}, emergence={emergence_ratio:.2f}, "
            f"lockKey={lock_key_model} ({time.time() - start:.2f}s)"
        )
        return macro_model

    def _calculate_content_requirements(
        self,
        genre: str,
        levels: int,
        duration: int,
        progression_type: str,
        content_budget: str,
    ) -> dict:
        """Расчёт требований к контенту."""
        # Базовые множители по бюджету
        budget_multipliers = {"low": 0.6, "medium": 1.0, "high": 1.5}
        mult = budget_multipliers.get(content_budget, 1.0)

        # Базовое количество контента
        base_enemies = max(5, int(levels * 0.5 * mult))
        base_rewards = max(3, int(levels * 0.3 * mult))
        base_abilities = max(2, int(levels * 0.15 * mult))
        content_stages = max(2, int(levels * 0.1 * mult))

        # Жанровые корректировки
        genre_enemy_mult = {
            "rpg": 1.5, "action": 1.3, "shooter": 1.2, "strategy": 0.8,
            "puzzle": 0.3, "visual_novel": 0.1, "horror": 0.7,
        }
        genre_reward_mult = {
            "rpg": 1.5, "mmorpg": 1.8, "idle": 2.0, "survival": 1.3,
            "puzzle": 0.5, "visual_novel": 0.3,
        }
        genre_ability_mult = {
            "rpg": 2.0, "mmorpg": 1.8, "metroidvania": 1.5, "strategy": 1.3,
            "shooter": 0.8, "puzzle": 0.3,
        }

        enemy_configs = max(3, int(base_enemies * genre_enemy_mult.get(genre, 1.0)))
        reward_types = max(2, int(base_rewards * genre_reward_mult.get(genre, 1.0)))
        ability_count = max(1, int(base_abilities * genre_ability_mult.get(genre, 1.0)))

        return {
            "content_stages": content_stages,
            "enemy_configs": enemy_configs,
            "reward_types": reward_types,
            "ability_count": ability_count,
            "milestone_count": max(2, int(levels * 0.05 * mult)),
            "boss_count": max(1, int(content_stages * 0.5)),
            "area_count": max(2, int(content_stages * 0.8)),
            "budget_multiplier": mult,
        }

    def _assess_emergence_ratio(
        self,
        core_loop: Optional[dict],
        mda_profile: Optional[dict],
        genre: str,
    ) -> float:
        """
        Оценка коэффициента эмерджентности (0-1).

        Высокий emergence ratio = много emergent-геймплея (sandbox, roguelike).
        Низкий = scripted/linear опыт.
        """
        base_emergence = {
            "sandbox": 0.8, "roguelike": 0.7, "survival": 0.6,
            "strategy": 0.5, "mmorpg": 0.4, "rpg": 0.3,
            "metroidvania": 0.2, "action": 0.2, "shooter": 0.15,
            "puzzle": 0.1, "visual_novel": 0.05, "idle": 0.1,
            "horror": 0.15, "platformer": 0.1, "fighting": 0.3,
            "racing": 0.1, "rhythm": 0.05, "simulation": 0.4,
            "tower_defense": 0.3, "party": 0.3, "educational": 0.1,
            "casual": 0.1,
        }

        ratio = base_emergence.get(genre, 0.2)

        # Корректировка по coreLoop structural type
        if core_loop:
            struct_type = core_loop.get("structural_type", "").lower()
            if struct_type == "ecology":
                ratio = min(1.0, ratio + 0.2)
            elif struct_type == "economy":
                ratio = min(1.0, ratio + 0.1)
            elif struct_type == "engine":
                ratio = max(0.0, ratio - 0.1)

            # Много ресурсов → больше эмерджентности
            resources = core_loop.get("resources", [])
            if len(resources) >= 5:
                ratio = min(1.0, ratio + 0.1)

        # Корректировка по MDA dynamics
        if mda_profile:
            dynamics = mda_profile.get("dynamics_target", {})
            core_dynamics = dynamics.get("core_dynamics", [])
            emergent_keywords = ["emergent", "эмерджент", "creative", "креатив", "discovery", "открыти"]
            for d in core_dynamics:
                if any(kw in d.lower() for kw in emergent_keywords):
                    ratio = min(1.0, ratio + 0.15)
                    break

        return round(max(0.0, min(1.0, ratio)), 3)

    # ========================================================
    # Этап 2: Разбиение на тиры (3.5.2)
    # ========================================================

    async def plan_tiers(
        self,
        macro_model: ProgressionMacroModel,
        core_loop_profile: Optional[dict] = None,
    ) -> TierModel:
        """
        Этап 2: Разбиение на тиры по D&D-модели.

        Алгоритм 3.5.2:
        1. Определить num_tiers (min 2, max 5)
        2. Распределить уровни (неравномерно: ранние короткие, поздние длинные)
        3. Характеризовать каждый тир
        4. Построить карту переходов

        Returns:
            TierModel с информацией о тирах
        """
        start = time.time()
        total_levels = macro_model.levels

        # === Шаг 2.1: Определить num_tiers ===
        if total_levels <= 10:
            num_tiers = 2
        elif total_levels <= 25:
            num_tiers = 3
        elif total_levels <= 50:
            num_tiers = 4
        else:
            num_tiers = 5

        num_tiers = max(2, min(5, num_tiers))

        # === Шаг 2.2: Распределить уровни ===
        distribution = TIER_DISTRIBUTIONS.get(num_tiers, TIER_DISTRIBUTIONS[3])
        tier_level_counts = []
        remaining = total_levels

        for i, fraction in enumerate(distribution):
            if i == num_tiers - 1:
                # Последний тир получает все оставшиеся уровни
                tier_level_counts.append(max(MIN_TIER_LEVELS, remaining))
            else:
                count = max(MIN_TIER_LEVELS, int(total_levels * fraction))
                count = min(count, remaining - (num_tiers - i - 1) * MIN_TIER_LEVELS)
                tier_level_counts.append(count)
                remaining -= count

        # === Шаг 2.3: Характеризовать каждый тир ===
        struct_type = "engine"
        if core_loop_profile:
            struct_type = core_loop_profile.get("structural_type", "engine").lower()

        # Выбираем resource states по структурному типу
        if struct_type == "economy":
            resource_states = ECONOMY_RESOURCE_STATES
        elif struct_type == "ecology":
            resource_states = ECOLOGY_RESOURCE_STATES
        else:
            resource_states = ENGINE_RESOURCE_STATES

        genre = macro_model.contentRequirements.get("genre", "")
        tier_mechanics = GENRE_TIER_MECHANICS.get(
            genre, GENRE_TIER_MECHANICS.get("rpg", [])
        )

        tiers: list[TierInfo] = []
        current_level = 1

        for i in range(num_tiers):
            level_count = tier_level_counts[i]
            end_level = current_level + level_count - 1

            # Масштаб (D&D)
            scale = TIER_SCALES[i] if i < len(TIER_SCALES) else TIER_SCALES[-1]

            # Доминирующая механика
            dominant_mechanic = (
                tier_mechanics[i] if i < len(tier_mechanics)
                else f"Механика тира {i + 1}"
            )

            # Тип балансировки
            balance_types = ["transitive", "intransitive", "situational", "mixed", "mixed"]
            balance_type = balance_types[i] if i < len(balance_types) else "mixed"

            # Кривая сложности
            difficulty_curves = ["gradual", "gradual", "spike", "plateau", "spike"]
            difficulty_curve = difficulty_curves[i] if i < len(difficulty_curves) else "gradual"

            # Состояние ресурсов
            resource_state = (
                resource_states[i] if i < len(resource_states)
                else resource_states[-1]
            )

            # Триггер перехода
            transition_trigger = ""
            if i < num_tiers - 1:
                transition_triggers = [
                    "Достижение порога мощности",
                    "Победа над боссом тира",
                    "Открытие новой области",
                    "Получение ключевой способности",
                ]
                transition_trigger = transition_triggers[i] if i < len(transition_triggers) else "Достижение порога"

            tier_info = TierInfo(
                index=i,
                level_range=[current_level, end_level],
                level_count=level_count,
                scale=scale,
                dominant_mechanic=dominant_mechanic,
                balance_type=balance_type,
                difficulty_curve=difficulty_curve,
                resource_state=resource_state,
                transition_trigger=transition_trigger,
            )
            tiers.append(tier_info)
            current_level = end_level + 1

        # === Шаг 2.4: Карта переходов ===
        transition_map: dict[str, str] = {}
        for i in range(num_tiers - 1):
            key = f"tier_{i} → tier_{i + 1}"
            transition_map[key] = tiers[i].transition_trigger

        tier_model = TierModel(
            tiers=tiers,
            num_tiers=num_tiers,
            total_levels=sum(tier_level_counts),
            transition_map=transition_map,
        )

        logger.info(
            f"[Stage 2] Tier model: {num_tiers} tiers, "
            f"level_counts={tier_level_counts} "
            f"({time.time() - start:.2f}s)"
        )
        return tier_model

    # ========================================================
    # Этап 3: Кривые прогрессии (3.5.3)
    # ========================================================

    async def build_curves(
        self,
        macro_model: ProgressionMacroModel,
        tier_model: TierModel,
        core_loop_profile: Optional[dict] = None,
        mda_profile: Optional[dict] = None,
        project_state: Optional[dict] = None,
    ) -> ProgressionCurves:
        """
        Этап 3: Построение кривых прогрессии.

        Алгоритм 3.5.3:
        1. XP → Level кривая (exponential/triangular/linear)
        2. Level → Power кривая (linear/polynomial/logistic)
        3. Level → Cost кривая (proportional to power × multiplier)
        4. Difficulty кривая (Schreiber perceived difficulty)
        5. Проверка консистентности (income vs cost)
        6. AI-обогащение через GENERATE_PROGRESSION_CURVES

        Returns:
            ProgressionCurves с 4 кривыми
        """
        start = time.time()
        genre = macro_model.contentRequirements.get("genre", "")
        total_levels = macro_model.levels

        # === Шаг 3.1: XP → Level кривая ===
        xp_curve_type = GENRE_XP_CURVE_MAP.get(genre, "linear")
        xp_curve = self._build_xp_curve(xp_curve_type, total_levels)

        # === Шаг 3.2: Level → Power кривая ===
        power_curve_type = GENRE_POWER_CURVE_MAP.get(genre, "linear")
        power_curve = self._build_power_curve(power_curve_type, total_levels, macro_model.progressionType)

        # === Шаг 3.3: Level → Cost кривая ===
        cost_multiplier = MONETIZATION_GRIND_MULTIPLIER.get(macro_model.monetizationModel, 1.0)
        cost_curve = self._build_cost_curve(power_curve, cost_multiplier)

        # === Шаг 3.4: Difficulty кривая (Schreiber) ===
        difficulty_curve = self._build_difficulty_curve(total_levels, tier_model)

        # === Шаг 3.5: Проверка консистентности ===
        consistency_warnings = self._check_curve_consistency(
            xp_curve, power_curve, cost_curve, macro_model
        )

        # === Шаг 3.6: AI-обогащение ===
        models_used: list[str] = []
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="GENERATE_PROGRESSION_CURVES",
                inputs={
                    "genre": genre,
                    "total_levels": total_levels,
                    "progression_type": macro_model.progressionType,
                    "xp_curve_type": xp_curve_type,
                    "power_curve_type": power_curve_type,
                    "monetization_model": macro_model.monetizationModel,
                    "num_tiers": tier_model.num_tiers,
                    "xp_parameters": xp_curve.parameters,
                    "power_parameters": power_curve.parameters,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            ai_data = prompt_result.data
            if isinstance(ai_data, dict):
                # Обогащаем кривые AI-параметрами
                if "xp_curve" in ai_data and isinstance(ai_data["xp_curve"], dict):
                    ai_xp = ai_data["xp_curve"]
                    if "parameters" in ai_xp and isinstance(ai_xp["parameters"], dict):
                        xp_curve.parameters.update(
                            {k: float(v) for k, v in ai_xp["parameters"].items() if isinstance(v, (int, float))}
                        )
                    if "formula" in ai_xp:
                        xp_curve.formula = ai_xp["formula"]

                if "power_curve" in ai_data and isinstance(ai_data["power_curve"], dict):
                    ai_power = ai_data["power_curve"]
                    if "parameters" in ai_power and isinstance(ai_power["parameters"], dict):
                        power_curve.parameters.update(
                            {k: float(v) for k, v in ai_power["parameters"].items() if isinstance(v, (int, float))}
                        )
                    if "formula" in ai_power:
                        power_curve.formula = ai_power["formula"]

                if "difficulty_adjustments" in ai_data and isinstance(ai_data["difficulty_adjustments"], dict):
                    diff_adj = ai_data["difficulty_adjustments"]
                    if "parameters" in diff_adj and isinstance(diff_adj["parameters"], dict):
                        difficulty_curve.parameters.update(
                            {k: float(v) for k, v in diff_adj["parameters"].items() if isinstance(v, (int, float))}
                        )

                models_used.append("GENERATE_PROGRESSION_CURVES")
                logger.info("[Stage 3.6] AI enrichment applied for curves")
        except Exception as e:
            logger.warning(
                f"[Stage 3.6] AI enrichment (GENERATE_PROGRESSION_CURVES) failed, "
                f"using formalized curves: {e}"
            )

        curves = ProgressionCurves(
            xp_to_level=xp_curve,
            level_to_power=power_curve,
            level_to_cost=cost_curve,
            difficulty=difficulty_curve,
        )

        logger.info(
            f"[Stage 3] Curves built: xp={xp_curve_type}, power={power_curve_type}, "
            f"consistency_warnings={len(consistency_warnings)} "
            f"({time.time() - start:.2f}s)"
        )
        return curves

    def _build_xp_curve(self, curve_type: str, total_levels: int) -> CurveSpec:
        """Построение XP → Level кривой."""
        if curve_type == "exponential":
            # XP = base * exponent^level
            base = 100
            exponent = 1.15
            return CurveSpec(
                type="exponential",
                formula=f"xp = {base} * {exponent}^level",
                parameters={"base": base, "exponent": exponent, "initial_xp": base},
            )
        elif curve_type == "triangular":
            # XP для уровня L = base * L * (L + 1) / 2
            # (треугольные числа: кумулятивная сумма 1+2+3+...+L)
            base = 50
            return CurveSpec(
                type="triangular",
                formula=f"xp_to_level(L) = {base} * L * (L + 1) / 2",
                parameters={"base": base, "multiplier": 1.0},
            )
        else:
            # linear: XP = base * level
            base = 200
            return CurveSpec(
                type="linear",
                formula=f"xp = {base} * level",
                parameters={"base": base, "increment": base},
            )

    def _build_power_curve(self, curve_type: str, total_levels: int, progression_type: str) -> CurveSpec:
        """Построение Level → Power кривой."""
        if curve_type == "polynomial":
            # Power = base * level^exponent
            base = 10
            exponent = 1.5 if progression_type == "exponential" else 1.3
            return CurveSpec(
                type="polynomial",
                formula=f"power = {base} * level^{exponent}",
                parameters={"base": base, "exponent": exponent},
            )
        elif curve_type == "logistic":
            # Power = max_power / (1 + e^(-k * (level - midpoint)))
            max_power = 1000
            k = 0.1
            midpoint = total_levels / 2
            return CurveSpec(
                type="logistic",
                formula=f"power = {max_power} / (1 + e^(-{k} * (level - {midpoint})))",
                parameters={
                    "max_power": max_power, "k": k,
                    "midpoint": midpoint, "initial_power": 10,
                },
            )
        else:
            # linear: Power = base * level + offset
            base = 20
            offset = 10
            return CurveSpec(
                type="linear",
                formula=f"power = {base} * level + {offset}",
                parameters={"base": base, "offset": offset},
            )

    def _build_cost_curve(self, power_curve: CurveSpec, cost_multiplier: float) -> CurveSpec:
        """Построение Level → Cost кривой (пропорциональна power × multiplier)."""
        # Cost ≈ power * multiplier
        # Формула аналогична power, но с множителем
        if power_curve.type == "polynomial":
            base = power_curve.parameters.get("base", 10) * cost_multiplier
            exponent = power_curve.parameters.get("exponent", 1.3)
            return CurveSpec(
                type="polynomial",
                formula=f"cost = {base:.1f} * level^{exponent}",
                parameters={"base": round(base, 2), "exponent": exponent, "multiplier": cost_multiplier},
            )
        elif power_curve.type == "logistic":
            max_cost = power_curve.parameters.get("max_power", 1000) * cost_multiplier
            k = power_curve.parameters.get("k", 0.1)
            midpoint = power_curve.parameters.get("midpoint", 25)
            return CurveSpec(
                type="logistic",
                formula=f"cost = {max_cost:.0f} / (1 + e^(-{k} * (level - {midpoint})))",
                parameters={
                    "max_cost": round(max_cost, 2), "k": k,
                    "midpoint": midpoint, "multiplier": cost_multiplier,
                },
            )
        else:
            base = power_curve.parameters.get("base", 20) * cost_multiplier
            offset = power_curve.parameters.get("offset", 10) * cost_multiplier
            return CurveSpec(
                type="linear",
                formula=f"cost = {base:.1f} * level + {offset:.1f}",
                parameters={"base": round(base, 2), "offset": round(offset, 2), "multiplier": cost_multiplier},
            )

    def _build_difficulty_curve(self, total_levels: int, tier_model: TierModel) -> CurveSpec:
        """
        Построение кривой воспринимаемой сложности (Schreiber).

        Schreiber's perceived difficulty:
        - Базовая сложность растёт логистически (0 → 1)
        - На границах тиров — spike (резкий скачок)
        - Между тировыми границами — gradual рост или plateau
        """
        # Формула: perceived_difficulty(L) =
        #   base_curve(L) + Σ spike(L, boundary_i, width, height)
        # Где base_curve = k * L / total_levels
        # spike(x, center, w, h) = h * e^(-(x-center)^2 / (2*w^2))

        k = 0.7  # Базовый рост (70% от максимальной сложности на последнем уровне)
        spike_height = 0.25  # Высота spike на границе тира
        spike_width = 1.5    # Ширина spike (в уровнях)

        # Границы тиров — уровни, где происходит переход
        tier_boundaries: list[int] = []
        for tier in tier_model.tiers:
            if tier.level_range and len(tier.level_range) >= 2:
                tier_boundaries.append(tier.level_range[1])

        # Убираем последнюю границу (конец игры — не spike)
        if tier_boundaries:
            tier_boundaries = tier_boundaries[:-1]

        boundary_str = ", ".join(str(b) for b in tier_boundaries) if tier_boundaries else "none"

        return CurveSpec(
            type="logistic_with_spikes",
            formula=(
                f"perceived_difficulty(L) = {k} * L / {total_levels} "
                f"+ Σ(0.25 * e^(-(L-boundary)^2 / (2*1.5^2))) "
                f"for boundaries in [{boundary_str}]"
            ),
            parameters={
                "k": k,
                "total_levels": total_levels,
                "spike_height": spike_height,
                "spike_width": spike_width,
                "tier_boundaries": tier_boundaries,
                "base_difficulty": 0.15,
                "max_difficulty": 0.95,
            },
        )

    def _check_curve_consistency(
        self,
        xp_curve: CurveSpec,
        power_curve: CurveSpec,
        cost_curve: CurveSpec,
        macro_model: ProgressionMacroModel,
    ) -> list[str]:
        """Проверка консистентности кривых (income vs cost balance)."""
        warnings: list[str] = []

        # Проверка: cost multiplier не должен быть слишком высоким
        cost_multiplier = cost_curve.parameters.get("multiplier", 1.0)
        if cost_multiplier > 1.5:
            warnings.append(
                f"Cost multiplier ({cost_multiplier:.1f}x) значительно превышает 1.0. "
                f"Это может привести к чрезмерному гринду при модели монетизации "
                f"'{macro_model.monetizationModel}'."
            )

        # Проверка: XP-кривая не должна быть слишком крутой
        xp_exponent = xp_curve.parameters.get("exponent", 1.0)
        if xp_curve.type == "exponential" and xp_exponent > 1.3:
            warnings.append(
                f"XP-кривая очень крутая (exponent={xp_exponent}). "
                f"Поздние уровни могут требовать неоправданно много гринда."
            )

        # Проверка: power не должен расти быстрее cost (для PvP)
        power_exponent = power_curve.parameters.get("exponent", 1.0)
        cost_exponent = cost_curve.parameters.get("exponent", 1.0)
        if power_exponent > cost_exponent + 0.2:
            warnings.append(
                f"Power растёт быстрее cost (exp: {power_exponent} > {cost_exponent}). "
                f"В PvP это приведёт к доминированию высокоуровневых игроков."
            )

        return warnings

    # ========================================================
    # Этап 4: Контент-план (3.5.4)
    # ========================================================

    async def generate_content_plan(
        self,
        macro_model: ProgressionMacroModel,
        tier_model: TierModel,
        curves: ProgressionCurves,
        mda_profile: Optional[dict] = None,
        core_loop_profile: Optional[dict] = None,
        project_state: Optional[dict] = None,
    ) -> ContentPlan:
        """
        Этап 4: Генерация контент-плана.

        Алгоритм 3.5.4:
        1. Контент-требования по тирам
        2. Дерево разблокировок
        3. Таблица воспринимаемой сложности
        4. AI-обогащение через GENERATE_CONTENT_PLAN

        Returns:
            ContentPlan с планами по тирам, деревом разблокировок и таблицей сложности
        """
        start = time.time()
        genre = macro_model.contentRequirements.get("genre", "")
        total_levels = macro_model.levels

        # === Шаг 4.1: Контент-требования по тирам ===
        tier_plans = self._generate_tier_plans(
            tier_model, macro_model, genre
        )

        # === Шаг 4.2: Дерево разблокировок ===
        unlock_tree = self._generate_unlock_tree(
            total_levels, tier_model, genre, macro_model
        )

        # === Шаг 4.3: Таблица воспринимаемой сложности ===
        difficulty_table = self._generate_perceived_difficulty_table(
            total_levels, tier_model, curves
        )

        # === Шаг 4.4: Общие требования к контенту ===
        total_requirements = {
            "enemy_types": sum(len(tp.enemies) for tp in tier_plans),
            "reward_types": sum(len(tp.rewards) for tp in tier_plans),
            "ability_count": sum(len(tp.abilities) for tp in tier_plans),
            "milestone_count": sum(len(tp.milestones) for tp in tier_plans),
            "total_unlocks": len(unlock_tree),
            "total_tiers": tier_model.num_tiers,
        }

        # === Шаг 4.5: AI-обогащение ===
        models_used: list[str] = []
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="GENERATE_CONTENT_PLAN",
                inputs={
                    "genre": genre,
                    "total_levels": total_levels,
                    "progression_type": macro_model.progressionType,
                    "num_tiers": tier_model.num_tiers,
                    "tier_ranges": [
                        {"tier": t.index, "range": t.level_range, "scale": t.scale}
                        for t in tier_model.tiers
                    ],
                    "unlock_types": GENRE_UNLOCK_TYPES.get(genre, ["ability", "item", "area", "boss"]),
                    "xp_curve": curves.xp_to_level.type,
                    "power_curve": curves.level_to_power.type,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            ai_data = prompt_result.data
            if isinstance(ai_data, dict):
                # Обогащаем контент-план AI-данными
                if "tier_content_suggestions" in ai_data and isinstance(ai_data["tier_content_suggestions"], list):
                    for i, suggestion in enumerate(ai_data["tier_content_suggestions"]):
                        if i < len(tier_plans) and isinstance(suggestion, dict):
                            if "enemies" in suggestion and isinstance(suggestion["enemies"], list):
                                tier_plans[i].enemies.extend(
                                    e for e in suggestion["enemies"] if isinstance(e, str)
                                )
                            if "rewards" in suggestion and isinstance(suggestion["rewards"], list):
                                tier_plans[i].rewards.extend(
                                    r for r in suggestion["rewards"] if isinstance(r, str)
                                )

                if "additional_unlocks" in ai_data and isinstance(ai_data["additional_unlocks"], list):
                    for unlock_data in ai_data["additional_unlocks"]:
                        if isinstance(unlock_data, dict) and "level" in unlock_data and "name" in unlock_data:
                            unlock_tree.append(UnlockEntry(
                                level=int(unlock_data["level"]),
                                unlock_name=str(unlock_data["name"]),
                                unlock_type=str(unlock_data.get("type", "feature")),
                                description=str(unlock_data.get("description", "")),
                            ))
                    # Сортируем по уровню
                    unlock_tree.sort(key=lambda u: u.level)

                models_used.append("GENERATE_CONTENT_PLAN")
                logger.info("[Stage 4.5] AI enrichment applied for content plan")
        except Exception as e:
            logger.warning(
                f"[Stage 4.5] AI enrichment (GENERATE_CONTENT_PLAN) failed, "
                f"using formalized plan: {e}"
            )

        # Пересчитываем общие требования после AI-обогащения
        total_requirements = {
            "enemy_types": sum(len(tp.enemies) for tp in tier_plans),
            "reward_types": sum(len(tp.rewards) for tp in tier_plans),
            "ability_count": sum(len(tp.abilities) for tp in tier_plans),
            "milestone_count": sum(len(tp.milestones) for tp in tier_plans),
            "total_unlocks": len(unlock_tree),
            "total_tiers": tier_model.num_tiers,
        }

        content_plan = ContentPlan(
            tier_plans=tier_plans,
            unlock_tree=unlock_tree,
            perceived_difficulty_table=difficulty_table,
            total_content_requirements=total_requirements,
        )

        logger.info(
            f"[Stage 4] Content plan: {len(tier_plans)} tier plans, "
            f"{len(unlock_tree)} unlocks, {len(difficulty_table)} difficulty entries "
            f"({time.time() - start:.2f}s)"
        )
        return content_plan

    def _generate_tier_plans(
        self,
        tier_model: TierModel,
        macro_model: ProgressionMacroModel,
        genre: str,
    ) -> list[ContentTierPlan]:
        """Генерация контент-плана для каждого тира."""
        tier_plans: list[ContentTierPlan] = []

        # Базовые враги по жанрам
        genre_enemies: dict[str, list[list[str]]] = {
            "rpg": [
                ["Слизень", "Гоблин", "Скелет"],
                ["Орк-воин", "Тролль", "Некромант"],
                ["Дракон", "Демон", "Лич"],
                ["Архидемон", "Бог смерти", "Титан"],
                ["Создатель", "Хранитель миров", "Абсолют"],
            ],
            "action": [
                ["Рядовой враг", "Дрон", "Минион"],
                ["Элитный боец", "Снайпер", "Щитовик"],
                ["Мини-босс", "Тяжёлый солдат", "Мастер клинка"],
                ["Босс зоны", "Элитный охотник", "Командир"],
                ["Финальный босс", "Секретный босс", "Босс режима"],
            ],
            "strategy": [
                ["Милиция", "Разведчик", "Рабочий"],
                ["Пехота", "Лучник", "Кавалерия"],
                ["Маг", "Осадное орудие", "Элитный отряд"],
                ["Драконий всадник", "Голем", "Архимаг"],
                ["Титан", "Легион", "Авангард"],
            ],
        }

        default_enemies = [
            ["Враг-1", "Враг-2", "Враг-3"],
            ["Враг-4", "Враг-5", "Мини-босс"],
            ["Элитный враг", "Босс", "Усиленный враг"],
            ["Супер-босс", "Финальный страж", "Тайный враг"],
            ["Абсолютный босс", "Эндгейм-враг", "Челлендж-враг"],
        ]

        enemies_by_genre = genre_enemies.get(genre, default_enemies)

        # Базовые награды
        base_rewards = [
            ["Золото", "Опыт", "Базовое снаряжение"],
            ["Редкое снаряжение", "Рецепты", "Ресурсы"],
            ["Эпическое снаряжение", "Способности", "Уникальные предметы"],
            ["Легендарное снаряжение", "Маунты", "Титулы"],
            ["Мифическое снаряжение", "Косметика", "Достижения"],
        ]

        # Базовые способности
        genre_abilities = GENRE_UNLOCK_TYPES.get(genre, ["ability", "item", "area", "boss", "feature"])
        base_abilities_by_tier = [
            [f"Базовая {t}" for t in genre_abilities[:2]],
            [f"Продвинутая {t}" for t in genre_abilities[:3]],
            [f"Экспертная {t}" for t in genre_abilities[:3]],
            [f"Мастерская {t}" for t in genre_abilities[:4]],
            [f"Абсолютная {t}" for t in genre_abilities],
        ]

        # Базовые милстоуны
        base_milestones = [
            "Первый босс", "Открытие нового региона",
            "Победа над главным боссом тира", "Получение ключевой способности",
            "Достижение максимального уровня",
        ]

        # Pacing по тирам
        pacings = ["slow", "balanced", "balanced", "fast", "intense"]

        for tier in tier_model.tiers:
            i = tier.index
            enemies = enemies_by_genre[i] if i < len(enemies_by_genre) else enemies_by_genre[-1]
            rewards = base_rewards[i] if i < len(base_rewards) else base_rewards[-1]
            abilities = base_abilities_by_tier[i] if i < len(base_abilities_by_tier) else base_abilities_by_tier[-1]
            milestones = [base_milestones[i]] if i < len(base_milestones) else [f"Милстоун тира {i + 1}"]
            pacing = pacings[i] if i < len(pacings) else "balanced"

            tier_plans.append(ContentTierPlan(
                tier_index=i,
                level_range=tier.level_range,
                enemies=enemies,
                rewards=rewards,
                abilities=abilities,
                milestones=milestones,
                pacing=pacing,
            ))

        return tier_plans

    def _generate_unlock_tree(
        self,
        total_levels: int,
        tier_model: TierModel,
        genre: str,
        macro_model: ProgressionMacroModel,
    ) -> list[UnlockEntry]:
        """Генерация дерева разблокировок по уровням."""
        unlock_tree: list[UnlockEntry] = []

        unlock_types = GENRE_UNLOCK_TYPES.get(genre, ["ability", "item", "area", "boss", "feature"])

        # Типичные разблокировки по уровням
        # Расставляем по minRewardInterval
        interval = macro_model.contentRequirements.get("reward_types", 3)
        interval = max(2, min(5, interval))

        tier_boundaries: set[int] = set()
        for tier in tier_model.tiers:
            if tier.level_range and len(tier.level_range) >= 2:
                tier_boundaries.add(tier.level_range[1])

        # Генерируем разблокировки с заданным интервалом
        type_index = 0
        for level in range(1, total_levels + 1, interval):
            if level <= 1:
                continue  # Уровень 1 — стартовый, без разблокировки

            is_boundary = level in tier_boundaries
            unlock_type = unlock_types[type_index % len(unlock_types)]

            if is_boundary:
                # На границе тира — важная разблокировка
                unlock_name = f"Ключевая {unlock_type} (граница тира)"
                description = f"Разблокировка на границе тира, уровень {level}. Открывает доступ к следующему этапу прогрессии."
            else:
                unlock_name = f"{unlock_type.capitalize()} уровня {level}"
                description = f"Разблокировка {unlock_type} на уровне {level}."

            unlock_tree.append(UnlockEntry(
                level=level,
                unlock_name=unlock_name,
                unlock_type=unlock_type,
                description=description,
            ))
            type_index += 1

        # Добавляем разблокировку на уровне 1 (стартовая)
        if unlock_types:
            unlock_tree.insert(0, UnlockEntry(
                level=1,
                unlock_name=f"Стартовая {unlock_types[0]}",
                unlock_type=unlock_types[0],
                description="Начальная разблокировка, доступная с первого уровня.",
            ))

        return unlock_tree

    def _generate_perceived_difficulty_table(
        self,
        total_levels: int,
        tier_model: TierModel,
        curves: ProgressionCurves,
    ) -> list[PerceivedDifficultyEntry]:
        """
        Генерация таблицы воспринимаемой сложности по уровням.

        Использует Schreiber's perceived difficulty formula с spike на границах тиров.
        """
        table: list[PerceivedDifficultyEntry] = []
        diff_params = curves.difficulty.parameters

        k = diff_params.get("k", 0.7)
        spike_height = diff_params.get("spike_height", 0.25)
        spike_width = diff_params.get("spike_width", 1.5)
        tier_boundaries = diff_params.get("tier_boundaries", [])
        base_diff = diff_params.get("base_difficulty", 0.15)
        max_diff = diff_params.get("max_difficulty", 0.95)

        # Собираем границы тиров
        tier_boundary_set: set[int] = set()
        for tier in tier_model.tiers:
            if tier.level_range and len(tier.level_range) >= 2:
                tier_boundary_set.add(tier.level_range[1])

        # Параметры power-кривой для recommended_enemy_power
        power_base = curves.level_to_power.parameters.get("base", 20)
        power_offset = curves.level_to_power.parameters.get("offset", 10)
        power_type = curves.level_to_power.type

        for level in range(1, min(total_levels + 1, 101)):  # Ограничиваем до 100 записей
            # Базовая воспринимаемая сложность (логистический рост)
            base = base_diff + (max_diff - base_diff) * (k * level / max(total_levels, 1))

            # Spike на границах тиров
            spike = 0.0
            for boundary in tier_boundaries:
                if isinstance(boundary, (int, float)):
                    distance = abs(level - boundary)
                    spike += spike_height * math.exp(-(distance ** 2) / (2 * spike_width ** 2))

            perceived = min(1.0, max(0.0, base + spike))
            is_boundary = level in tier_boundary_set

            # Рекомендуемая мощность врагов
            if power_type == "polynomial":
                exponent = curves.level_to_power.parameters.get("exponent", 1.3)
                enemy_power = power_base * (level ** exponent) * 0.9  # Враги чуть слабее игрока
            elif power_type == "logistic":
                max_power = curves.level_to_power.parameters.get("max_power", 1000)
                log_k = curves.level_to_power.parameters.get("k", 0.1)
                midpoint = curves.level_to_power.parameters.get("midpoint", total_levels / 2)
                enemy_power = max_power / (1 + math.exp(-log_k * (level - midpoint))) * 0.9
            else:
                enemy_power = (power_base * level + power_offset) * 0.9

            table.append(PerceivedDifficultyEntry(
                level=level,
                target_perceived_difficulty=round(perceived, 3),
                recommended_enemy_power=round(enemy_power, 2),
                is_tier_boundary=is_boundary,
            ))

        # Для больших игр — добавляем сэмплы каждые 5 уровней после 100
        if total_levels > 100:
            for level in range(105, total_levels + 1, 5):
                base = base_diff + (max_diff - base_diff) * (k * level / max(total_levels, 1))
                spike = 0.0
                for boundary in tier_boundaries:
                    if isinstance(boundary, (int, float)):
                        distance = abs(level - boundary)
                        spike += spike_height * math.exp(-(distance ** 2) / (2 * spike_width ** 2))
                perceived = min(1.0, max(0.0, base + spike))
                is_boundary = level in tier_boundary_set

                if power_type == "polynomial":
                    exponent = curves.level_to_power.parameters.get("exponent", 1.3)
                    enemy_power = power_base * (level ** exponent) * 0.9
                elif power_type == "logistic":
                    max_power = curves.level_to_power.parameters.get("max_power", 1000)
                    log_k = curves.level_to_power.parameters.get("k", 0.1)
                    midpoint = curves.level_to_power.parameters.get("midpoint", total_levels / 2)
                    enemy_power = max_power / (1 + math.exp(-log_k * (level - midpoint))) * 0.9
                else:
                    enemy_power = (power_base * level + power_offset) * 0.9

                table.append(PerceivedDifficultyEntry(
                    level=level,
                    target_perceived_difficulty=round(perceived, 3),
                    recommended_enemy_power=round(enemy_power, 2),
                    is_tier_boundary=is_boundary,
                ))

        return table

    # ========================================================
    # Полный пайплайн (Этапы 1-4)
    # ========================================================

    async def progression_design_full(
        self,
        input_data: ProgressionInput,
        project_state: Optional[dict] = None,
    ) -> ProgressionProfile:
        """
        Полный пайплайн проектирования прогрессии (алгоритм 3.5, Этапы 1-4).

        Выполняет:
        1. calculate_macro_params() → ProgressionMacroModel
        2. plan_tiers() → TierModel
        3. build_curves() → ProgressionCurves
        4. generate_content_plan() → ContentPlan
        5. Валидация (grind check, wall check, empty level check)
        6. Сборка ProgressionProfile

        Returns:
            ProgressionProfile с результатами всех этапов
        """
        pipeline_start = time.time()
        stages_completed: list[int] = []
        models_used: list[str] = []
        warnings: list[str] = []
        suggestions: list[str] = []

        # === Этап 1: Макро-параметры ===
        macro_model = await self.calculate_macro_params(input_data, project_state)
        stages_completed.append(1)

        # === Этап 2: Разбиение на тиры ===
        tier_model = await self.plan_tiers(macro_model, input_data.coreLoop)
        stages_completed.append(2)

        # === Этап 3: Кривые прогрессии ===
        curves = await self.build_curves(
            macro_model, tier_model,
            core_loop_profile=input_data.coreLoop,
            mda_profile=input_data.mdaProfile,
            project_state=project_state,
        )
        stages_completed.append(3)

        # === Этап 4: Контент-план ===
        content_plan = await self.generate_content_plan(
            macro_model, tier_model, curves,
            mda_profile=input_data.mdaProfile,
            core_loop_profile=input_data.coreLoop,
            project_state=project_state,
        )
        stages_completed.append(4)

        # === Валидация ===
        validation = self._validate_progression(
            macro_model, tier_model, curves, content_plan, input_data
        )

        # Собираем warnings/suggestions из валидации
        for issue in validation.issues:
            severity = issue.get("severity", "info")
            message = issue.get("message", "")
            if severity == "critical":
                warnings.append(f"⛔ {message}")
            elif severity == "warning":
                warnings.append(f"⚠️ {message}")

        suggestions.extend(validation.suggestions)

        # === Сводка ===
        summary = self._generate_summary(macro_model, tier_model, curves, content_plan)

        # === Сборка профиля ===
        latency_ms = int((time.time() - pipeline_start) * 1000)

        profile = ProgressionProfile(
            macroModel=macro_model,
            tierModel=tier_model,
            curves=curves,
            contentPlan=content_plan,
            validation=validation,
            totalLevels=macro_model.levels,
            totalDuration=macro_model.duration,
            progressionType=macro_model.progressionType,
            emergenceRatio=macro_model.emergenceRatio,
            lockKeyModel=macro_model.lockKeyModel,
            summary=summary,
            economyInput={
                "status": "stub",
                "message": "Входные данные для экономики (алгоритм 3.6) будут сгенерированы в Фазе 4.C.6",
                "progression_summary": summary,
                "resource_requirements": macro_model.contentRequirements,
            },
            stages_completed=stages_completed,
            latency_ms=latency_ms,
            models_used=models_used,
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Progression Full Pipeline] Completed stages {stages_completed}, "
            f"score={validation.overall_score:.0f}/100, "
            f"latency={latency_ms}ms"
        )
        return profile

    def _validate_progression(
        self,
        macro_model: ProgressionMacroModel,
        tier_model: TierModel,
        curves: ProgressionCurves,
        content_plan: ContentPlan,
        input_data: ProgressionInput,
    ) -> ProgressionValidation:
        """Валидация системы прогрессии (grind check, wall check, empty level check)."""
        issues: list[dict] = []
        suggestions_list: list[str] = []
        critical_count = 0
        warning_count = 0
        info_count = 0

        # --- Grind check ---
        # Проверяем, не слишком ли крутая XP-кривая
        xp_type = curves.xp_to_level.type
        xp_exponent = curves.xp_to_level.parameters.get("exponent", 1.0)
        cost_multiplier = curves.level_to_cost.parameters.get("multiplier", 1.0)

        if xp_type == "exponential" and xp_exponent > 1.3:
            grind_estimate = int((xp_exponent - 1.0) * 20 * cost_multiplier)
            if grind_estimate > GRIND_CRITICAL_THRESHOLD:
                issues.append({
                    "severity": "critical",
                    "message": f"Ожидаемый гринд слишком высокий ({grind_estimate} повторений). "
                               f"XP-кривая exponential с exponent={xp_exponent}",
                    "stage": 3,
                })
                critical_count += 1
                suggestions_list.append(
                    "Снизить exponent XP-кривой до 1.15-1.20 или переключиться на triangular"
                )
            elif grind_estimate > GRIND_WARNING_THRESHOLD:
                issues.append({
                    "severity": "warning",
                    "message": f"Гринд выше комфортного уровня ({grind_estimate} повторений).",
                    "stage": 3,
                })
                warning_count += 1
                suggestions_list.append(
                    "Рассмотреть снижение крутизны XP-кривой или добавление бонусов опыта"
                )

        # --- Wall check ---
        # Проверяем скачки сложности между соседними уровнями
        diff_table = content_plan.perceived_difficulty_table
        for i in range(1, len(diff_table)):
            spike = diff_table[i].target_perceived_difficulty - diff_table[i - 1].target_perceived_difficulty
            if spike > WALL_DIFFICULTY_SPIKE and not diff_table[i].is_tier_boundary:
                issues.append({
                    "severity": "warning",
                    "message": f"Стена на уровне {diff_table[i].level}: "
                               f"скачок сложности {spike:.2f} (не на границе тира)",
                    "stage": 3,
                })
                warning_count += 1
                suggestions_list.append(
                    f"Сгладить скачок сложности на уровне {diff_table[i].level} "
                    f"или сделать его границей тира"
                )
                break  # Одно предупреждение о стене достаточно

        # --- Empty level check ---
        # Проверяем, что нет уровней без разблокировок (с учётом minRewardInterval)
        unlocked_levels: set[int] = {u.level for u in content_plan.unlock_tree}
        interval = input_data.constraints.minRewardInterval
        consecutive_empty = 0
        max_consecutive_empty = 0

        for level in range(1, macro_model.levels + 1):
            if level in unlocked_levels:
                consecutive_empty = 0
            else:
                consecutive_empty += 1
                max_consecutive_empty = max(max_consecutive_empty, consecutive_empty)

        if max_consecutive_empty > interval * 2:
            issues.append({
                "severity": "warning",
                "message": f"Слишком много уровней без наград: {max_consecutive_empty} подряд "
                           f"(рекомендуется не более {interval * 2})",
                "stage": 4,
            })
            warning_count += 1
            suggestions_list.append(
                f"Добавить разблокировки каждые {interval} уровней"
            )
        elif max_consecutive_empty > interval:
            issues.append({
                "severity": "info",
                "message": f"Некоторые уровни без наград: {max_consecutive_empty} подряд",
                "stage": 4,
            })
            info_count += 1

        # --- Tier balance check ---
        if tier_model.num_tiers < 2:
            issues.append({
                "severity": "warning",
                "message": "Слишком мало тиров (< 2). Прогрессия может казаться монотонной.",
                "stage": 2,
            })
            warning_count += 1
            suggestions_list.append("Увеличить количество тиров до 3-4")

        # --- Monetization impact check ---
        if macro_model.monetizationModel in ("p2w", "freemium"):
            if cost_multiplier > 1.5:
                issues.append({
                    "severity": "info",
                    "message": f"Модель монетизации '{macro_model.monetizationModel}' "
                               f"с cost_multiplier={cost_multiplier:.1f}. "
                               f"Убедитесь, что гринд не является наказанием.",
                    "stage": 1,
                })
                info_count += 1

        # --- Общая оценка ---
        score = 100.0
        score -= critical_count * 25
        score -= warning_count * 10
        score -= info_count * 2
        score = max(0.0, min(100.0, score))

        if not issues:
            issues.append({
                "severity": "info",
                "message": "Прогрессия выглядит сбалансированной. Серьёзных проблем не обнаружено.",
                "stage": 0,
            })
            info_count += 1

        if not suggestions_list:
            suggestions_list.append("Коррекция не требуется — прогрессия сбалансирована.")

        return ProgressionValidation(
            issues=issues,
            suggestions=suggestions_list,
            critical_count=critical_count,
            warning_count=warning_count,
            info_count=info_count,
            overall_score=round(score, 1),
        )

    def _generate_summary(
        self,
        macro_model: ProgressionMacroModel,
        tier_model: TierModel,
        curves: ProgressionCurves,
        content_plan: ContentPlan,
    ) -> str:
        """Генерация текстовой сводки системы прогрессии."""
        tier_descriptions = []
        for tier in tier_model.tiers:
            tier_descriptions.append(
                f"Тир {tier.index + 1} ({tier.scale}): "
                f"уровни {tier.level_range[0]}-{tier.level_range[1]}, "
                f"механика: {tier.dominant_mechanic}, "
                f"ресурсы: {tier.resource_state}"
            )

        summary = (
            f"Система прогрессии: {macro_model.progressionType}, "
            f"длительность {macro_model.duration}ч, "
            f"{macro_model.levels} уровней, "
            f"{tier_model.num_tiers} тиров.\n"
            f"Модель замок-ключ: {macro_model.lockKeyModel}, "
            f"эмерджентность: {macro_model.emergenceRatio:.0%}.\n"
            f"Кривые: XP={curves.xp_to_level.type}, "
            f"Power={curves.level_to_power.type}, "
            f"Cost×{curves.level_to_cost.parameters.get('multiplier', 1.0):.1f}.\n"
            f"Тиры:\n" + "\n".join(f"  - {d}" for d in tier_descriptions)
        )

        return summary
