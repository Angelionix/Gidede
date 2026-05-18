"""
Gidede — Economy Service
Фаза 4.C.6: Блок 5 — Экономика (алгоритм 3.6)

Реализация пайплайна экономического моделирования из алгоритма 3.6:
- Этап 1: Идентификация ресурсов → ResourceInventory (3.6.3)
- Этап 2: Классификация экономической системы → EconomicClassification (3.6.4)
- Этап 3: Построение Machinations-модели → MachinationsGraph (3.6.5)
- Этап 4: Построение графа конверсий → ConversionGraph (3.6.6)
- Этап 5: Диагностика патологий → EconomyDiagnostics (3.6.7)
- Этап 6: Автоматическая балансировка → FaucetDrainBalance (3.6.8)
- Этап 7: Симуляция экономики → EconomySimResult (3.6.9)
- Этап 8: Сборка EconomyProfile (3.6.10)

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

from app.schemas.economy import (
    ResourceDescriptor,
    ResourceInventory,
    EconomicClassification,
    ConversionChain,
    ConversionGraph,
    EconomyPathology,
    EconomyDiagnostics,
    FaucetDrainAdjustment,
    FaucetDrainBalance,
    EconomySimResult,
    EconomyProfile,
)

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.6
# ============================================================

# Genre → core resources mapping (from algorithm 3.6.3)
GENRE_CORE_RESOURCES: dict[str, list[str]] = {
    "rpg": ["HP", "XP", "Золото"],
    "strategy": ["Минералы", "Территория", "Технологии"],
    "survival": ["Голод", "Здоровье", "Материалы"],
    "shooter": ["Здоровье", "Боеприпасы", "Позиция"],
    "mmorpg": ["Золото", "XP", "Снаряжение"],
    "idle": ["Энергия", "Софтвалюта", "Хардвалюта"],
    "roguelike": ["HP", "Золото_рана", "Мета_ресурс"],
    "action": ["Здоровье", "Энергия", "Очки"],
    "metroidvania": ["Здоровье", "Энергия", "Способности"],
    "sandbox": ["Материалы", "Здоровье", "Территория"],
}

# Genre → anchor resource
GENRE_ANCHOR_RESOURCE: dict[str, str] = {
    "rpg": "HP",
    "strategy": "Территория",
    "survival": "Голод",
    "shooter": "Здоровье",
    "mmorpg": "Золото",
    "idle": "Энергия",
    "roguelike": "HP",
    "action": "Здоровье",
    "metroidvania": "Здоровье",
    "sandbox": "Материалы",
}

# Genre → subsidiary resources
GENRE_SUBSIDIARY_RESOURCES: dict[str, list[str]] = {
    "rpg": ["Мана", "Репутация", "Опыт_навыка", "Снаряжение"],
    "strategy": ["Еда", "Золото", "Население", "Наука"],
    "survival": ["Тепло", "Кислород", "Инструменты", "Знания"],
    "shooter": ["Гранаты", "Аптечки", "Щит", "Ульта"],
    "mmorpg": ["Репутация", "Достижения", "Рейтинг", "Маунты"],
    "idle": ["Очки_усиления", "Бустеры", "Автодоход", "Престиж"],
    "roguelike": ["Предметы_рана", "Усиления", "Ключи", "Карта"],
    "action": ["Комбо_очки", "Ресурсы_крафта", "Деньги", "Опыт"],
    "metroidvania": ["Ракеты", "Бомбы", "Ключи", "Энергия_щита"],
    "sandbox": ["Еда", "Инструменты", "Знания", "Топливо"],
}

# Resource class mapping by Schreiber (Кн. 7)
RESOURCE_CLASS_MAP: dict[str, str] = {
    "XP": "experience",
    "Опыт": "experience",
    "XP_рана": "experience",
    "Золото": "currency",
    "Золото_рана": "currency",
    "Минералы": "currency",
    "Софтвалюта": "currency",
    "Хардвалюта": "currency",
    "Деньги": "currency",
    "HP": "hp",
    "Здоровье": "hp",
    "Голод": "hp",
    "Мана": "currency",
    "Энергия": "currency",
    "Боеприпасы": "consumable",
    "Гранаты": "consumable",
    "Территория": "game_object",
    "Снаряжение": "game_object",
    "Технологии": "game_object",
    "Способности": "game_object",
    "Репутация": "currency",
    "Достижения": "game_object",
    "Материалы": "game_object",
    "Инструменты": "game_object",
    "Население": "game_object",
    "Наука": "game_object",
    "Время": "time",
    "time": "time",
}

# Faucet/drain ratio thresholds
FAUCET_DRAIN_BALANCED_MIN = 0.7
FAUCET_DRAIN_BALANCED_MAX = 1.5
FAUCET_DRAIN_SURPLUS = 1.5
FAUCET_DRAIN_DEFICIT = 0.7

# Simulation defaults
DEFAULT_SIM_TICKS = 1000
DEFAULT_SIM_RUNS = 100
STABILITY_INDEX_THRESHOLD = 0.7
BUILD_GAP_THRESHOLD = 3.0
RUNAWAY_FREQUENCY_THRESHOLD = 0.1
STALL_FREQUENCY_THRESHOLD = 0.1

# Sellers matrix: genre → economic type
GENRE_ECONOMIC_TYPE: dict[str, str] = {
    "rpg": "engine",
    "strategy": "economy",
    "survival": "ecology",
    "shooter": "engine",
    "mmorpg": "hybrid",
    "idle": "engine",
    "roguelike": "engine",
    "action": "engine",
    "metroidvania": "engine",
    "sandbox": "ecology",
}

# Genre → default pricing type
GENRE_PRICING_TYPE: dict[str, str] = {
    "rpg": "fixed",
    "strategy": "player_driven",
    "survival": "fixed",
    "shooter": "fixed",
    "mmorpg": "player_driven",
    "idle": "f2p",
    "roguelike": "fixed",
    "action": "fixed",
    "metroidvania": "fixed",
    "sandbox": "mixed",
}

# Genre → default openness
GENRE_OPENNESS: dict[str, str] = {
    "rpg": "mixed",
    "strategy": "open",
    "survival": "closed",
    "shooter": "closed",
    "mmorpg": "open",
    "idle": "mixed",
    "roguelike": "closed",
    "action": "closed",
    "metroidvania": "closed",
    "sandbox": "open",
}

# Economy phase → target faucet/drain ratio
ECONOMY_PHASE_TARGETS: dict[str, float] = {
    "startup": 1.0,    # Balanced at start
    "growth": 1.3,     # Surplus for growth feeling
    "maturity": 1.0,   # Balanced in mid-game
    "endgame": 0.8,    # Slight deficit for challenge
}

# Default resource properties by class
RESOURCE_CLASS_DEFAULTS: dict[str, dict[str, bool]] = {
    "experience": {
        "is_consumable": False,
        "is_catalytic": False,
        "is_anchor": False,
        "depreciates": False,
        "transferable": False,
    },
    "currency": {
        "is_consumable": True,
        "is_catalytic": True,
        "is_anchor": False,
        "depreciates": False,
        "transferable": True,
    },
    "hp": {
        "is_consumable": True,
        "is_catalytic": False,
        "is_anchor": True,
        "depreciates": False,
        "transferable": False,
    },
    "game_object": {
        "is_consumable": False,
        "is_catalytic": True,
        "is_anchor": False,
        "depreciates": True,
        "transferable": True,
    },
    "consumable": {
        "is_consumable": True,
        "is_catalytic": False,
        "is_anchor": False,
        "depreciates": False,
        "transferable": True,
    },
    "time": {
        "is_consumable": True,
        "is_catalytic": False,
        "is_anchor": False,
        "depreciates": False,
        "transferable": False,
    },
}

# Risk profiles for economic types
ECONOMIC_TYPE_RISK: dict[str, dict[str, Any]] = {
    "engine": {
        "risk_level": "medium",
        "likely_pathologies": ["runaway", "stagnation"],
        "description": "Engine: ресурсный генератор с усиливающей ОС. Риск runaway без торможения.",
    },
    "economy": {
        "risk_level": "low",
        "likely_pathologies": ["inflation", "arbitrage"],
        "description": "Economy: балансирующая ОС через торговлю. Устойчива, но возможна инфляция.",
    },
    "ecology": {
        "risk_level": "medium",
        "likely_pathologies": ["stall", "deadlock"],
        "description": "Ecology: множество балансирующих петель. Риск stall при дефиците.",
    },
    "hybrid": {
        "risk_level": "high",
        "likely_pathologies": ["runaway", "stall", "oscillation"],
        "description": "Hybrid: смешанные петли. Сложный баланс, риск осцилляции.",
    },
}

# Profitability thresholds for conversion chains
CONVERSION_PROFITABILITY_GRIND_RISK = 1.5
CONVERSION_PROFITABILITY_FRUSTRATION_RISK = 0.7

# Monte Carlo: default artificial players for simulation
DEFAULT_ARTIFICIAL_PLAYERS = [
    {"name": "optimal", "strategy": "maximize_progression", "efficiency": 0.95},
    {"name": "casual", "strategy": "random_balanced", "efficiency": 0.5},
    {"name": "minmaxer", "strategy": "exploit_best_cycle", "efficiency": 0.85},
    {"name": "explorer", "strategy": "try_all_options", "efficiency": 0.6},
]


# ============================================================
# Economy Service
# ============================================================

class EconomyService:
    """
    Блок 5: Экономика.
    Реализует алгоритм 3.6 — Этапы 1–8.

    Методы:
    - identify_resources() — Этап 1: идентификация ресурсов
    - classify_economy() — Этап 2: классификация экономической системы
    - build_machinations_model() — Этап 3: построение Machinations-модели
    - build_conversion_graph() — Этап 4: построение графа конверсий
    - diagnose_economy() — Этап 5: диагностика патологий
    - balance_faucets_drains() — Этап 6: автоматическая балансировка
    - simulate_economy() — Этап 7: симуляция экономики
    - economy_design_full() — Этап 8: полный пайплайн (сборка EconomyProfile)
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Идентификация ресурсов (3.6.3)
    # ========================================================

    async def identify_resources(
        self,
        core_loop: Optional[dict] = None,
        mda_profile: Optional[dict] = None,
        progression_profile: Optional[dict] = None,
        genre: str = "",
        project_state: Optional[dict] = None,
    ) -> ResourceInventory:
        """
        Этап 1: Идентификация ресурсов игры.

        Алгоритм 3.6.3:
        1. Извлечь core resources из CoreLoop шагов (consumed/produced)
        2. Применить genre resource maps (таблица 3.6.3)
        3. Извлечь subsidiary resources из MDA mechanics
        4. Классифицировать по Schreiber: time/currency/game_object/hp/experience
        5. Установить свойства: is_consumable, is_catalytic, is_anchor, depreciates, transferable
        6. AI обогащение через IDENTIFY_RESOURCES (fallback → heuristics)

        Returns:
            ResourceInventory со всеми ресурсами и их свойствами
        """
        start = time.time()

        # === Шаг 1.1: Собираем ресурсы из CoreLoop шагов ===
        resources_from_loop: set[str] = set()
        if core_loop:
            steps = core_loop.get("steps", [])
            for step in steps:
                if isinstance(step, dict):
                    for r in step.get("resources_consumed", []):
                        if isinstance(r, str):
                            resources_from_loop.add(r)
                        elif isinstance(r, dict):
                            resources_from_loop.add(r.get("name", ""))
                    for r in step.get("resources_produced", []):
                        if isinstance(r, str):
                            resources_from_loop.add(r)
                        elif isinstance(r, dict):
                            resources_from_loop.add(r.get("name", ""))
            structural_type = core_loop.get("structural_type", {})
            if isinstance(structural_type, dict):
                for r in structural_type.get("resources", []):
                    if isinstance(r, dict):
                        name = r.get("name", "")
                        if name:
                            resources_from_loop.add(name)
                    elif isinstance(r, str):
                        resources_from_loop.add(r)

        # === Шаг 1.2: Применяем genre resource maps ===
        genre_key = genre.lower() if genre else ""
        genre_core = GENRE_CORE_RESOURCES.get(genre_key, [])
        genre_subsidiary = GENRE_SUBSIDIARY_RESOURCES.get(genre_key, [])
        genre_anchor = GENRE_ANCHOR_RESOURCE.get(genre_key, "")

        # Объединяем: genre core + from loop + genre subsidiary
        all_resource_names: list[str] = []
        seen: set[str] = set()

        for name in genre_core:
            if name not in seen:
                all_resource_names.append(name)
                seen.add(name)

        for name in resources_from_loop:
            if name and name not in seen:
                all_resource_names.append(name)
                seen.add(name)

        for name in genre_subsidiary:
            if name not in seen:
                all_resource_names.append(name)
                seen.add(name)

        # === Шаг 1.3: Извлекаем subsidiary из MDA mechanics ===
        if mda_profile:
            mechanic_set = mda_profile.get("mechanic_set", {}) or mda_profile.get("mechanic_candidate_set", {})
            mechanics = mechanic_set.get("mechanics", []) if isinstance(mechanic_set, dict) else []
            for mech in mechanics:
                if isinstance(mech, dict):
                    for dyn in mech.get("dynamics_affinity", []):
                        # Динамики могут порождать ресурсы
                        pass  # enrichment handled by AI below

        # === Шаг 1.4: Классифицируем ресурсы ===
        descriptors: list[ResourceDescriptor] = []
        for name in all_resource_names:
            res_class = RESOURCE_CLASS_MAP.get(name, "game_object")
            defaults = RESOURCE_CLASS_DEFAULTS.get(res_class, RESOURCE_CLASS_DEFAULTS["game_object"])

            is_anchor = (name == genre_anchor)

            descriptor = ResourceDescriptor(
                name=name,
                resource_class=res_class,
                is_consumable=defaults["is_consumable"],
                is_catalytic=defaults["is_catalytic"],
                is_anchor=is_anchor,
                depreciates=defaults["depreciates"],
                transferable=defaults["transferable"],
                initial_value=self._default_initial_value(res_class),
                bounds=self._default_bounds(res_class),
                source="heuristic",
            )
            descriptors.append(descriptor)

        # === Шаг 1.5: AI обогащение через IDENTIFY_RESOURCES ===
        models_used: list[str] = []
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="IDENTIFY_RESOURCES",
                inputs={
                    "genre": genre,
                    "core_loop_resources": list(resources_from_loop),
                    "genre_core": genre_core,
                    "genre_subsidiary": genre_subsidiary,
                    "anchor": genre_anchor,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            ai_data = prompt_result.data
            if isinstance(ai_data, dict):
                ai_resources = ai_data.get("resources", [])
                if isinstance(ai_resources, list):
                    ai_names: set[str] = {d.name for d in descriptors}
                    for res in ai_resources:
                        if isinstance(res, dict):
                            rname = res.get("name", "")
                            if rname and rname not in ai_names:
                                rclass = res.get("resource_class", RESOURCE_CLASS_MAP.get(rname, "game_object"))
                                defaults = RESOURCE_CLASS_DEFAULTS.get(rclass, RESOURCE_CLASS_DEFAULTS["game_object"])
                                descriptor = ResourceDescriptor(
                                    name=rname,
                                    resource_class=rclass,
                                    is_consumable=res.get("is_consumable", defaults["is_consumable"]),
                                    is_catalytic=res.get("is_catalytic", defaults["is_catalytic"]),
                                    is_anchor=res.get("is_anchor", rname == genre_anchor),
                                    depreciates=res.get("depreciates", defaults["depreciates"]),
                                    transferable=res.get("transferable", defaults["transferable"]),
                                    initial_value=res.get("initial_value", self._default_initial_value(rclass)),
                                    bounds=res.get("bounds", self._default_bounds(rclass)),
                                    source="ai",
                                )
                                descriptors.append(descriptor)
                                ai_names.add(rname)

                # Обновляем свойства существующих ресурсов из AI
                ai_enrichments = ai_data.get("enrichments", [])
                if isinstance(ai_enrichments, list):
                    name_to_desc = {d.name: d for d in descriptors}
                    for enrichment in ai_enrichments:
                        if isinstance(enrichment, dict):
                            ename = enrichment.get("name", "")
                            if ename in name_to_desc:
                                desc = name_to_desc[ename]
                                if "is_consumable" in enrichment:
                                    desc.is_consumable = enrichment["is_consumable"]
                                if "is_catalytic" in enrichment:
                                    desc.is_catalytic = enrichment["is_catalytic"]
                                if "depreciates" in enrichment:
                                    desc.depreciates = enrichment["depreciates"]
                                if "transferable" in enrichment:
                                    desc.transferable = enrichment["transferable"]
                                desc.source = "ai_enriched"

                models_used.append("IDENTIFY_RESOURCES")

        except Exception as e:
            logger.warning(
                f"[Stage 1] AI resource identification (IDENTIFY_RESOURCES) failed, "
                f"using heuristics only: {e}"
            )

        # Подсчёт по классам
        class_counts: dict[str, int] = {}
        for d in descriptors:
            class_counts[d.resource_class] = class_counts.get(d.resource_class, 0) + 1

        inventory = ResourceInventory(
            resources=descriptors,
            anchor_resource=genre_anchor,
            core_count=len([d for d in descriptors if d.name in genre_core]),
            subsidiary_count=len(descriptors) - len([d for d in descriptors if d.name in genre_core]),
            class_distribution=class_counts,
            models_used=models_used,
        )

        logger.info(
            f"[Stage 1] Resources identified: "
            f"{len(descriptors)} total, anchor={genre_anchor}, "
            f"classes={class_counts} "
            f"({time.time() - start:.2f}s)"
        )
        return inventory

    # ========================================================
    # Вспомогательные методы для Этапа 1
    # ========================================================

    def _default_initial_value(self, resource_class: str) -> float:
        """Начальное значение ресурса по умолчанию (по классу)."""
        defaults: dict[str, float] = {
            "experience": 0.0,
            "currency": 100.0,
            "hp": 100.0,
            "game_object": 0.0,
            "consumable": 10.0,
            "time": 0.0,
        }
        return defaults.get(resource_class, 0.0)

    def _default_bounds(self, resource_class: str) -> dict:
        """Границы ресурса по умолчанию (по классу)."""
        defaults: dict[str, dict] = {
            "experience": {"min": 0, "max": 100000},
            "currency": {"min": 0, "max": 999999},
            "hp": {"min": 0, "max": 999},
            "game_object": {"min": 0, "max": 1000},
            "consumable": {"min": 0, "max": 999},
            "time": {"min": 0, "max": 86400},
        }
        return defaults.get(resource_class, {"min": 0, "max": 10000})

    # ========================================================
    # Этап 2: Классификация экономической системы (3.6.4)
    # ========================================================

    async def classify_economy(
        self,
        inventory: ResourceInventory,
        core_loop: Optional[dict] = None,
        mda_profile: Optional[dict] = None,
        genre: str = "",
        project_state: Optional[dict] = None,
    ) -> EconomicClassification:
        """
        Этап 2: Классификация экономической системы.

        Алгоритм 3.6.4:
        1. Определить loop types из resource relationships (reinforcing/balancing/neutral)
        2. Определить interaction type (single_resource/conversion/exchange)
        3. Классифицировать по Sellers matrix: Engine/Economy/Ecology/Hybrid
        4. Определить sub_type: braked_engine, pure_engine, multi_currency, single_currency, metastable
        5. Определить openness (open/closed/mixed) и pricing_type (fixed/player_driven/f2p/mixed)
        6. Risk profile based on type

        Returns:
            EconomicClassification с параметрами экономики
        """
        start = time.time()

        # === Шаг 2.1: Определить loop types ===
        reinforcing_loops = 0
        balancing_loops = 0
        neutral_loops = 0

        # Анализируем CoreLoop петли
        if core_loop:
            inner_loops = core_loop.get("inner_loops", [])
            outer_loops = core_loop.get("outer_loops", [])

            for loop in inner_loops + outer_loops:
                if isinstance(loop, dict):
                    ft = loop.get("feedback_type", "positive")
                    if ft == "positive":
                        reinforcing_loops += 1
                    elif ft == "negative":
                        balancing_loops += 1
                    else:
                        neutral_loops += 1

            structural_type = core_loop.get("structural_type", {})
            if isinstance(structural_type, dict):
                loops_list = structural_type.get("loops", [])
                for loop in loops_list:
                    if isinstance(loop, dict):
                        lt = loop.get("loop_type", "positive")
                        if lt == "positive":
                            reinforcing_loops += 1
                        elif lt == "negative":
                            balancing_loops += 1

        # Если нет данных из CoreLoop — оцениваем по ресурсам
        if reinforcing_loops == 0 and balancing_loops == 0:
            # HP-ресурсы → балансирующие, currency → усиливающие
            for res in inventory.resources:
                if res.resource_class == "hp":
                    balancing_loops += 1
                elif res.resource_class == "currency":
                    reinforcing_loops += 1
                elif res.resource_class == "experience":
                    reinforcing_loops += 1

        # Определяем доминирующий тип петель
        if reinforcing_loops > balancing_loops:
            dominant_loop = "reinforcing"
        elif balancing_loops > reinforcing_loops:
            dominant_loop = "balancing"
        else:
            dominant_loop = "both"

        # === Шаг 2.2: Определить interaction type ===
        currency_count = sum(1 for r in inventory.resources if r.resource_class == "currency")
        has_exchange = False

        if mda_profile:
            mechanic_set = mda_profile.get("mechanic_set", {})
            if isinstance(mechanic_set, dict):
                mechanics = mechanic_set.get("mechanics", [])
                for mech in mechanics:
                    if isinstance(mech, dict):
                        name = mech.get("name", "").lower()
                        if any(kw in name for kw in ["торг", "торг", "обмен", "торговля", "trade", "market"]):
                            has_exchange = True

        if has_exchange:
            interaction_type = "exchange"
        elif currency_count >= 2:
            interaction_type = "conversion"
        else:
            interaction_type = "single_resource"

        # === Шаг 2.3: Классификация по Sellers matrix ===
        genre_key = genre.lower() if genre else ""
        economic_type = GENRE_ECONOMIC_TYPE.get(genre_key, "engine")

        # Проверяем structural_type из CoreLoop для коррекции
        if core_loop:
            st = core_loop.get("structural_type", {})
            if isinstance(st, dict):
                st_type = st.get("type", "").lower()
                if st_type in ("engine", "economy", "ecology", "hybrid"):
                    economic_type = st_type

        # === Шаг 2.4: Определить sub_type ===
        has_braking = False
        if core_loop:
            st = core_loop.get("structural_type", {})
            if isinstance(st, dict):
                has_braking = st.get("has_braking", False)

        if economic_type == "engine":
            if has_braking:
                sub_type = "braked_engine"
            else:
                sub_type = "pure_engine"
        elif economic_type == "economy":
            if currency_count >= 2:
                sub_type = "multi_currency"
            else:
                sub_type = "single_currency"
        elif economic_type == "ecology":
            # Проверяем metastable
            if balancing_loops >= 3:
                sub_type = "metastable"
            else:
                sub_type = "balanced_ecology"
        elif economic_type == "hybrid":
            if reinforcing_loops > balancing_loops:
                sub_type = "engine_dominant"
            else:
                sub_type = "economy_dominant"
        else:
            sub_type = ""

        # === Шаг 2.5: Определить openness и pricing_type ===
        openness = GENRE_OPENNESS.get(genre_key, "mixed")
        pricing_type = GENRE_PRICING_TYPE.get(genre_key, "fixed")

        # Коррекция на основе MDA
        if mda_profile:
            concept = mda_profile.get("aesthetic_profile", {})
            if isinstance(concept, dict):
                monetization = concept.get("monetizationModel", "")
                if monetization in ("freemium", "p2w"):
                    pricing_type = "f2p"
                    openness = "mixed"

        # === Шаг 2.6: Risk profile ===
        risk_info = ECONOMIC_TYPE_RISK.get(economic_type, ECONOMIC_TYPE_RISK["engine"])

        classification = EconomicClassification(
            economic_type=economic_type,
            sub_type=sub_type,
            dominant_loop=dominant_loop,
            interaction_type=interaction_type,
            reinforcing_loops=reinforcing_loops,
            balancing_loops=balancing_loops,
            openness=openness,
            pricing_type=pricing_type,
            risk_level=risk_info["risk_level"],
            likely_pathologies=risk_info["likely_pathologies"],
            risk_description=risk_info["description"],
        )

        logger.info(
            f"[Stage 2] Economy classified: "
            f"type={economic_type}/{sub_type}, "
            f"loop={dominant_loop}({reinforcing_loops}R/{balancing_loops}B), "
            f"interaction={interaction_type}, "
            f"open={openness}, pricing={pricing_type}, "
            f"risk={risk_info['risk_level']} "
            f"({time.time() - start:.2f}s)"
        )
        return classification

    # ========================================================
    # Этап 3: Построение Machinations-модели (3.6.5)
    # ========================================================

    async def build_machinations_model(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
        core_loop: Optional[dict] = None,
        progression_profile: Optional[dict] = None,
        project_state: Optional[dict] = None,
    ) -> MachinationsGraph:
        """
        Этап 3: Построение Machinations-модели экономики.

        Алгоритм 3.6.5:
        1. Создать Pool nodes для каждого ресурса
        2. Создать Source nodes (faucets) для каждого ресурса
        3. Создать Drain nodes (sinks) для каждого ресурса
        4. Создать Converter nodes из progression's conversion_chains
        5. Создать Trader nodes если player trading allowed
        6. Создать Gate nodes для conditional branching
        7. Добавить state connections (feedback loops)
        8. Построить resource_flows и state_connections

        Returns:
            MachinationsGraph — полный граф экономики
        """
        start = time.time()

        nodes: list[MachinationsNode] = []
        resource_flows: list[MachinationsResourceFlow] = []
        state_connections: list[MachinationsStateConnection] = []
        feedback_loops: list[MachinationsFeedbackLoop] = []

        # === Шаг 3.1: Pool nodes для каждого ресурса ===
        for res in inventory.resources:
            pool_node = MachinationsNode(
                id=f"pool_{res.name}",
                name=res.name,
                node_type="pool",
                initial_value=res.initial_value,
                capacity=res.bounds.get("max") if isinstance(res.bounds, dict) else None,
                activation="automatic",
                is_core=(res.name in [
                    r.name for r in inventory.resources[:inventory.core_count]
                ]),
            )
            nodes.append(pool_node)

        # === Шаг 3.2: Source nodes (faucets) ===
        for res in inventory.resources:
            faucet_rate = self._estimate_faucet_rate(res, classification)
            source_node = MachinationsNode(
                id=f"source_{res.name}",
                name=f"Faucet_{res.name}",
                node_type="source",
                rate=faucet_rate,
                activation="automatic",
                is_core=False,
            )
            nodes.append(source_node)

            # Flow: Source → Pool
            resource_flows.append(
                MachinationsResourceFlow(
                    source_id=f"source_{res.name}",
                    target_id=f"pool_{res.name}",
                    resource=res.name,
                    rate=faucet_rate,
                    flow_type="automatic",
                )
            )

        # === Шаг 3.3: Drain nodes (sinks) ===
        for res in inventory.resources:
            if res.is_consumable:
                drain_rate = self._estimate_drain_rate(res, classification)
                drain_node = MachinationsNode(
                    id=f"drain_{res.name}",
                    name=f"Drain_{res.name}",
                    node_type="drain",
                    rate=drain_rate,
                    activation="automatic",
                    is_core=False,
                )
                nodes.append(drain_node)

                # Flow: Pool → Drain
                resource_flows.append(
                    MachinationsResourceFlow(
                        source_id=f"pool_{res.name}",
                        target_id=f"drain_{res.name}",
                        resource=res.name,
                        rate=drain_rate,
                        flow_type="automatic",
                    )
                )

        # === Шаг 3.4: Converter nodes из progression conversion_chains ===
        conversion_chains: list[dict] = []
        if progression_profile:
            chains = progression_profile.get("economyInput", {}).get("conversion_chains", [])
            if isinstance(chains, list):
                conversion_chains = chains

        # Если нет цепочек из прогрессии — генерируем из ресурсов
        if not conversion_chains:
            conversion_chains = self._generate_default_conversions(inventory, classification)

        for i, chain in enumerate(conversion_chains):
            if isinstance(chain, dict):
                inputs_list = chain.get("inputs", [])
                outputs_list = chain.get("outputs", [])
                efficiency = chain.get("efficiency", 1.0)
                name = chain.get("name", f"Conv_{i+1}")

                converter_node = MachinationsNode(
                    id=f"converter_{i+1}",
                    name=name,
                    node_type="converter",
                    inputs=inputs_list if isinstance(inputs_list, list) else [],
                    outputs=outputs_list if isinstance(outputs_list, list) else [],
                    efficiency=efficiency,
                    activation="interactive",
                    is_core=False,
                )
                nodes.append(converter_node)

                # Flows: input Pools → Converter
                for inp in (inputs_list if isinstance(inputs_list, list) else []):
                    if isinstance(inp, str) and any(r.name == inp for r in inventory.resources):
                        resource_flows.append(
                            MachinationsResourceFlow(
                                source_id=f"pool_{inp}",
                                target_id=f"converter_{i+1}",
                                resource=inp,
                                rate=1.0,
                                flow_type="interactive",
                            )
                        )

                # Flows: Converter → output Pools
                for outp in (outputs_list if isinstance(outputs_list, list) else []):
                    if isinstance(outp, str) and any(r.name == outp for r in inventory.resources):
                        resource_flows.append(
                            MachinationsResourceFlow(
                                source_id=f"converter_{i+1}",
                                target_id=f"pool_{outp}",
                                resource=outp,
                                rate=efficiency,
                                flow_type="interactive",
                            )
                        )

        # === Шаг 3.5: Trader nodes если player trading allowed ===
        if classification.interaction_type == "exchange" or classification.openness in ("open", "mixed"):
            tradable_resources = [r for r in inventory.resources if r.transferable]
            if len(tradable_resources) >= 2:
                trader_node = MachinationsNode(
                    id="trader_player",
                    name="PlayerTrade",
                    node_type="trader",
                    inputs=[r.name for r in tradable_resources[:2]],
                    outputs=[r.name for r in tradable_resources[:2]],
                    activation="interactive",
                    is_core=False,
                )
                nodes.append(trader_node)

                # Flows: Pool ↔ Trader
                for res in tradable_resources[:2]:
                    resource_flows.append(
                        MachinationsResourceFlow(
                            source_id=f"pool_{res.name}",
                            target_id="trader_player",
                            resource=res.name,
                            rate=1.0,
                            flow_type="interactive",
                        )
                    )
                    resource_flows.append(
                        MachinationsResourceFlow(
                            source_id="trader_player",
                            target_id=f"pool_{res.name}",
                            resource=res.name,
                            rate=1.0,
                            flow_type="interactive",
                        )
                    )

        # === Шаг 3.6: Gate nodes для conditional branching ===
        anchor = inventory.anchor_resource
        if anchor:
            gate_node = MachinationsNode(
                id="gate_anchor_check",
                name=f"Gate_{anchor}_threshold",
                node_type="gate",
                activation="conditional",
                is_core=True,
            )
            nodes.append(gate_node)

            # State connection: Pool → Gate (условие)
            state_connections.append(
                MachinationsStateConnection(
                    source_id=f"pool_{anchor}",
                    target_id="gate_anchor_check",
                    modifier="+",
                    formula=f"pool_{anchor} > threshold",
                )
            )

        # === Шаг 3.7: State connections (feedback loops) ===
        # Reinforcing loops: XP → increases faucet rate of Gold
        experience_resources = [r for r in inventory.resources if r.resource_class == "experience"]
        currency_resources = [r for r in inventory.resources if r.resource_class == "currency"]

        for exp_res in experience_resources:
            for cur_res in currency_resources:
                state_connections.append(
                    MachinationsStateConnection(
                        source_id=f"pool_{exp_res.name}",
                        target_id=f"source_{cur_res.name}",
                        modifier="+",
                        formula=f"source_{cur_res.name}.rate * (1 + pool_{exp_res.name} / 1000)",
                    )
                )
                feedback_loops.append(
                    MachinationsFeedbackLoop(
                        nodes=[f"pool_{exp_res.name}", f"source_{cur_res.name}", f"pool_{cur_res.name}"],
                        loop_type="reinforcing",
                        strength=0.5,
                    )
                )

        # Balancing loops: HP → decreases faucet rate when low
        hp_resources = [r for r in inventory.resources if r.resource_class == "hp"]
        for hp_res in hp_resources:
            for cur_res in currency_resources:
                state_connections.append(
                    MachinationsStateConnection(
                        source_id=f"pool_{hp_res.name}",
                        target_id=f"source_{cur_res.name}",
                        modifier="-",
                        formula=f"source_{cur_res.name}.rate * (pool_{hp_res.name} / 100)",
                    )
                )
                feedback_loops.append(
                    MachinationsFeedbackLoop(
                        nodes=[f"pool_{hp_res.name}", f"source_{cur_res.name}"],
                        loop_type="balancing",
                        strength=0.3,
                    )
                )

        # === Сборка графа ===
        graph = MachinationsGraph(
            nodes=nodes,
            resource_flows=resource_flows,
            state_connections=state_connections,
            feedback_loops=feedback_loops,
            resource_count=len(inventory.resources),
            node_count=len(nodes),
            flow_count=len(resource_flows),
            economic_type=classification.economic_type,
            structural_patterns=self._detect_structural_patterns(classification, nodes),
        )

        logger.info(
            f"[Stage 3] Machinations model built: "
            f"{len(nodes)} nodes, {len(resource_flows)} flows, "
            f"{len(state_connections)} state connections, "
            f"{len(feedback_loops)} feedback loops "
            f"({time.time() - start:.2f}s)"
        )
        return graph

    # ========================================================
    # Вспомогательные методы для Этапа 3
    # ========================================================

    def _estimate_faucet_rate(self, res: ResourceDescriptor, classification: EconomicClassification) -> float:
        """Оценка скорости генерации ресурса (faucet)."""
        base_rates: dict[str, float] = {
            "experience": 10.0,
            "currency": 5.0,
            "hp": 2.0,
            "game_object": 0.5,
            "consumable": 3.0,
            "time": 1.0,
        }
        rate = base_rates.get(res.resource_class, 1.0)

        # Корректируем по типу экономики
        if classification.economic_type == "engine":
            rate *= 1.2  # Engine генерирует больше
        elif classification.economic_type == "ecology":
            rate *= 0.8  # Ecology — дефицит

        return round(rate, 2)

    def _estimate_drain_rate(self, res: ResourceDescriptor, classification: EconomicClassification) -> float:
        """Оценка скорости потребления ресурса (drain)."""
        base_rates: dict[str, float] = {
            "experience": 0.0,    # Experience обычно не тратится
            "currency": 4.0,
            "hp": 3.0,
            "game_object": 0.3,
            "consumable": 2.5,
            "time": 1.0,
        }
        rate = base_rates.get(res.resource_class, 1.0)

        # Корректируем по типу экономики
        if classification.economic_type == "ecology":
            rate *= 1.2  # Ecology больше потребляет
        elif classification.economic_type == "engine":
            rate *= 0.8  # Engine меньше потребляет

        return round(rate, 2)

    def _generate_default_conversions(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
    ) -> list[dict]:
        """Генерация цепочек конверсий по умолчанию."""
        chains: list[dict] = []
        resources = inventory.resources

        # Типичная конверсия: currency → game_object (покупка)
        currencies = [r for r in resources if r.resource_class == "currency"]
        game_objects = [r for r in resources if r.resource_class == "game_object"]

        for cur in currencies:
            for obj in game_objects[:2]:
                chains.append({
                    "name": f"Buy_{obj.name}_with_{cur.name}",
                    "inputs": [cur.name],
                    "outputs": [obj.name],
                    "efficiency": 0.8,
                })

        # Типичная конверсия: experience → currency (награда)
        experiences = [r for r in resources if r.resource_class == "experience"]
        for exp in experiences:
            for cur in currencies[:1]:
                chains.append({
                    "name": f"LevelUp_{exp.name}_to_{cur.name}",
                    "inputs": [exp.name],
                    "outputs": [cur.name],
                    "efficiency": 1.2,
                })

        return chains[:6]  # Ограничиваем количество

    def _detect_structural_patterns(
        self,
        classification: EconomicClassification,
        nodes: list[MachinationsNode],
    ) -> list[str]:
        """Обнаружение структурных паттернов Adams/Dormans."""
        patterns: list[str] = []
        node_types = {n.node_type for n in nodes}

        if "source" in node_types and "pool" in node_types:
            patterns.append("Static Engine")
        if "converter" in node_types:
            patterns.append("Converter Engine")
        if "drain" in node_types:
            patterns.append("Dynamic Friction")
        if "trader" in node_types:
            patterns.append("Trade")

        if classification.economic_type == "engine":
            if "drain" not in node_types:
                patterns.append("Engine Building")
            else:
                patterns.append("Dynamic Engine")
        elif classification.economic_type == "ecology":
            patterns.append("Attrition")

        return patterns

    # ========================================================
    # Этап 4: Построение графа конверсий (3.6.6)
    # ========================================================

    async def build_conversion_graph(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
        machinations_graph: MachinationsGraph,
        progression_profile: Optional[dict] = None,
        project_state: Optional[dict] = None,
    ) -> ConversionGraph:
        """
        Этап 4: Построение графа конверсий.

        Алгоритм 3.6.6:
        1. Построить conversion chains из progressionProfile.economyLink
        2. Рассчитать chain profitability (output/input ratio)
        3. Предупредить если profitability > 1.5 (grind risk) или < 0.7 (frustration risk)
        4. Проверить tier coverage

        Returns:
            ConversionGraph с цепочками конверсий и предупреждениями
        """
        start = time.time()
        warnings: list[str] = []
        suggestions: list[str] = []

        # === Шаг 4.1: Собираем conversion chains ===
        chains: list[ConversionChain] = []

        # Из progression profile
        if progression_profile:
            economy_input = progression_profile.get("economyInput", {})
            if isinstance(economy_input, dict):
                raw_chains = economy_input.get("conversion_chains", [])
                if isinstance(raw_chains, list):
                    for i, chain_data in enumerate(raw_chains):
                        if isinstance(chain_data, dict):
                            chain = self._parse_conversion_chain(chain_data, i)
                            chains.append(chain)

        # Из Machinations converters
        if not chains:
            converter_nodes = [n for n in machinations_graph.nodes if n.node_type == "converter"]
            for i, node in enumerate(converter_nodes):
                chain = ConversionChain(
                    name=node.name,
                    inputs=node.inputs,
                    outputs=node.outputs,
                    input_value=self._estimate_resource_value(node.inputs, inventory),
                    output_value=self._estimate_resource_value(node.outputs, inventory),
                    profitability=0.0,
                    tier=getattr(node, "tier", None),
                )
                chain.profitability = (
                    chain.output_value / chain.input_value
                    if chain.input_value > 0 else 0.0
                )
                chains.append(chain)

        # Генерируем дефолтные если совсем ничего
        if not chains:
            raw = self._generate_default_conversions(inventory, classification)
            for i, chain_data in enumerate(raw):
                chain = self._parse_conversion_chain(chain_data, i)
                chains.append(chain)

        # === Шаг 4.2: Рассчитать profitability ===
        for chain in chains:
            if chain.input_value > 0:
                chain.profitability = round(chain.output_value / chain.input_value, 4)
            else:
                chain.profitability = 0.0

        # === Шаг 4.3: Проверить пороги profitability ===
        for chain in chains:
            if chain.profitability > CONVERSION_PROFITABILITY_GRIND_RISK:
                warnings.append(
                    f"Конверсия '{chain.name}': profitability={chain.profitability:.2f} > "
                    f"{CONVERSION_PROFITABILITY_GRIND_RISK}. Риск гринда — "
                    f"выход значительно превышает вход."
                )
                suggestions.append(
                    f"Увеличить вход или уменьшить выход для '{chain.name}', "
                    f"чтобы снизить profitability до 1.0-1.3."
                )
            elif chain.profitability < CONVERSION_PROFITABILITY_FRUSTRATION_RISK and chain.profitability > 0:
                warnings.append(
                    f"Конверсия '{chain.name}': profitability={chain.profitability:.2f} < "
                    f"{CONVERSION_PROFITABILITY_FRUSTRATION_RISK}. Риск фрустрации — "
                    f"выход слишком мал по сравнению с входом."
                )
                suggestions.append(
                    f"Увеличить выход или уменьшить вход для '{chain.name}', "
                    f"чтобы повысить profitability до 0.8-1.0."
                )

        # === Шаг 4.4: Проверить tier coverage ===
        covered_tiers: set[int] = set()
        for chain in chains:
            if chain.tier is not None:
                covered_tiers.add(chain.tier)

        total_tiers = 5  # По умолчанию
        if progression_profile:
            tier_model = progression_profile.get("tierModel", {})
            if isinstance(tier_model, dict):
                total_tiers = tier_model.get("num_tiers", 5)

        expected_tiers = set(range(1, total_tiers + 1))
        uncovered_tiers = expected_tiers - covered_tiers

        if uncovered_tiers and len(covered_tiers) > 0:
            warnings.append(
                f"Не покрыты тиры конверсиями: {sorted(uncovered_tiers)}. "
                f"Игрокам могут потребоваться конверсии для каждого тира."
            )
            suggestions.append(
                f"Добавить конверсии для тиров: {sorted(uncovered_tiers)}."
            )

        # Средняя profitability
        avg_profitability = 0.0
        if chains:
            avg_profitability = sum(c.profitability for c in chains) / len(chains)

        graph = ConversionGraph(
            chains=chains,
            avg_profitability=round(avg_profitability, 4),
            tier_coverage=sorted(covered_tiers),
            uncovered_tiers=sorted(uncovered_tiers),
            warnings=warnings,
            suggestions=suggestions,
        )

        logger.info(
            f"[Stage 4] Conversion graph built: "
            f"{len(chains)} chains, avg_profit={avg_profitability:.2f}, "
            f"tiers_covered={sorted(covered_tiers)}, "
            f"{len(warnings)} warnings "
            f"({time.time() - start:.2f}s)"
        )
        return graph

    # ========================================================
    # Вспомогательные методы для Этапа 4
    # ========================================================

    def _parse_conversion_chain(self, data: dict, index: int) -> ConversionChain:
        """Парсинг данных цепочки конверсии."""
        inputs = data.get("inputs", [])
        outputs = data.get("outputs", [])
        input_value = data.get("input_value", 0.0)
        output_value = data.get("output_value", 0.0)

        if input_value == 0 and isinstance(inputs, list):
            input_value = float(len(inputs))
        if output_value == 0 and isinstance(outputs, list):
            output_value = float(len(outputs))

        profitability = output_value / input_value if input_value > 0 else 0.0

        return ConversionChain(
            name=data.get("name", f"Chain_{index+1}"),
            inputs=inputs if isinstance(inputs, list) else [],
            outputs=outputs if isinstance(outputs, list) else [],
            input_value=input_value,
            output_value=output_value,
            profitability=round(profitability, 4),
            tier=data.get("tier"),
        )

    def _estimate_resource_value(self, resource_names: list[str], inventory: ResourceInventory) -> float:
        """Оценка суммарной ценности списка ресурсов."""
        total = 0.0
        value_by_class: dict[str, float] = {
            "experience": 10.0,
            "currency": 5.0,
            "hp": 8.0,
            "game_object": 15.0,
            "consumable": 3.0,
            "time": 2.0,
        }
        name_to_class = {r.name: r.resource_class for r in inventory.resources}

        for name in resource_names:
            res_class = name_to_class.get(name, "game_object")
            total += value_by_class.get(res_class, 5.0)

        return total

    # ========================================================
    # Этап 5: Диагностика патологий (3.6.7)
    # ========================================================

    async def diagnose_economy(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
        machinations_graph: MachinationsGraph,
        conversion_graph: Optional[ConversionGraph] = None,
        project_state: Optional[dict] = None,
    ) -> EconomyDiagnostics:
        """
        Этап 5: Диагностика патологий экономики.

        Алгоритм 3.6.7:
        1. Runaway detection: reinforcing loops without braking
        2. Deadlock/stall detection: negative sum with balancing loops
        3. Inflation detection: faucet >> drain
        4. Stagnation detection: faucet ≈ 0
        5. Arbitrage detection: conversion loops with profit > 0
        6. Check for each resource: faucet_drain ratio
        7. Classify severities: critical/warning/info

        Returns:
            EconomyDiagnostics с обнаруженными патологиями
        """
        start = time.time()
        pathologies: list[EconomyPathology] = []

        # === Шаг 5.1: Runaway detection ===
        if classification.reinforcing_loops > 0:
            has_braking = classification.sub_type in ("braked_engine",)
            if not has_braking:
                pathologies.append(EconomyPathology(
                    name="runaway",
                    severity="critical",
                    description=(
                        f"Обнаружено {classification.reinforcing_loops} усиливающих петель "
                        f"без торможения. Риск бесконечного роста ресурсов."
                    ),
                    affected_resources=self._get_reinforcing_resources(inventory),
                    correction="Добавить тормозящий механизм: убывающая доходность, порог насыщения, или drain-узел.",
                ))
            else:
                pathologies.append(EconomyPathology(
                    name="runaway_risk",
                    severity="info",
                    description=(
                        f"Усиливающие петли ({classification.reinforcing_loops}) присутствуют, "
                        f"но есть торможение ({classification.sub_type})."
                    ),
                    affected_resources=[],
                    correction="",
                ))

        # === Шаг 5.2: Deadlock/stall detection ===
        if classification.balancing_loops > classification.reinforcing_loops:
            if classification.economic_type in ("ecology",):
                pathologies.append(EconomyPathology(
                    name="stall",
                    severity="warning",
                    description=(
                        f"Балансирующих петель ({classification.balancing_loops}) больше, "
                        f"чем усиливающих ({classification.reinforcing_loops}). "
                        f"В ecology-системе возможен stall (остановка прогрессии)."
                    ),
                    affected_resources=self._get_consumable_resources(inventory),
                    correction="Добавить источники ресурсов (faucets) или уменьшить drain для ключевых ресурсов.",
                ))

        # === Шаг 5.3: Inflation detection ===
        source_nodes = [n for n in machinations_graph.nodes if n.node_type == "source"]
        drain_nodes = [n for n in machinations_graph.nodes if n.node_type == "drain"]

        for res in inventory.resources:
            faucet_rate = self._get_node_rate(source_nodes, f"source_{res.name}")
            drain_rate = self._get_node_rate(drain_nodes, f"drain_{res.name}")

            if faucet_rate > 0 and drain_rate > 0:
                ratio = faucet_rate / drain_rate
                if ratio > FAUCET_DRAIN_SURPLUS:
                    pathologies.append(EconomyPathology(
                        name="inflation",
                        severity="warning" if ratio < 3.0 else "critical",
                        description=(
                            f"Ресурс '{res.name}': faucet/drain = {ratio:.2f} "
                            f"(порог: {FAUCET_DRAIN_SURPLUS}). Риск инфляции — "
                            f"ресурс генерируется быстрее, чем тратится."
                        ),
                        affected_resources=[res.name],
                        correction=f"Увеличить drain для '{res.name}' или уменьшить faucet.",
                    ))
            elif faucet_rate > 0 and drain_rate == 0 and res.is_consumable:
                pathologies.append(EconomyPathology(
                    name="inflation_no_drain",
                    severity="warning",
                    description=(
                        f"Ресурс '{res.name}': есть faucet ({faucet_rate}), но нет drain. "
                        f"Потребляемый ресурс без стока может накапливаться бесконечно."
                    ),
                    affected_resources=[res.name],
                    correction=f"Добавить drain для '{res.name}'.",
                ))

        # === Шаг 5.4: Stagnation detection ===
        for res in inventory.resources:
            faucet_rate = self._get_node_rate(source_nodes, f"source_{res.name}")
            if faucet_rate == 0 or (faucet_rate < 0.1 and res.resource_class != "time"):
                pathologies.append(EconomyPathology(
                    name="stagnation",
                    severity="info",
                    description=(
                        f"Ресурс '{res.name}': faucet ≈ 0 ({faucet_rate}). "
                        f"Риск стагнации — нет источника пополнения."
                    ),
                    affected_resources=[res.name],
                    correction=f"Добавить faucet (источник) для '{res.name}'.",
                ))

        # === Шаг 5.5: Arbitrage detection ===
        if conversion_graph:
            for chain in conversion_graph.chains:
                if chain.profitability > 1.0:
                    # Проверяем, образует ли замкнутый цикл с прибылью
                    pathologies.append(EconomyPathology(
                        name="arbitrage",
                        severity="warning" if chain.profitability < CONVERSION_PROFITABILITY_GRIND_RISK else "critical",
                        description=(
                            f"Конверсия '{chain.name}': profitability = {chain.profitability:.2f} > 1.0. "
                            f"Возможен арбитраж — игрок может бесконечно конвертировать с прибылью."
                        ),
                        affected_resources=chain.inputs + chain.outputs,
                        correction="Снизить эффективность конверсии или добавить стоимость (tax/drain).",
                    ))

            # Проверяем замкнутые циклы арбитража
            arbitrage_cycles = self._detect_arbitrage_cycles(conversion_graph)
            for cycle in arbitrage_cycles:
                pathologies.append(EconomyPathology(
                    name="arbitrage_cycle",
                    severity="critical",
                    description=(
                        f"Обнаружен замкнутый цикл арбитража: {' → '.join(cycle)}. "
                        f"Игрок может бесконечно получать прибыль через цепочку конверсий."
                    ),
                    affected_resources=cycle,
                    correction="Разорвать цикл: добавить потерю на одной из конверсий или ввести cooldown.",
                ))

        # === Шаг 5.6: Faucet/drain ratio для каждого ресурса ===
        faucet_drain_ratios: dict[str, float] = {}
        for res in inventory.resources:
            faucet_rate = self._get_node_rate(source_nodes, f"source_{res.name}")
            drain_rate = self._get_node_rate(drain_nodes, f"drain_{res.name}")
            if drain_rate > 0:
                faucet_drain_ratios[res.name] = round(faucet_rate / drain_rate, 4)
            elif faucet_rate > 0:
                faucet_drain_ratios[res.name] = float("inf")
            else:
                faucet_drain_ratios[res.name] = 0.0

        # === Шаг 5.7: Классификация severities ===
        critical_count = sum(1 for p in pathologies if p.severity == "critical")
        warning_count = sum(1 for p in pathologies if p.severity == "warning")
        info_count = sum(1 for p in pathologies if p.severity == "info")

        overall_severity = "info"
        if critical_count > 0:
            overall_severity = "critical"
        elif warning_count > 0:
            overall_severity = "warning"

        diagnostics = EconomyDiagnostics(
            pathologies=pathologies,
            critical_count=critical_count,
            warning_count=warning_count,
            info_count=info_count,
            overall_severity=overall_severity,
            faucet_drain_ratios=faucet_drain_ratios,
        )

        logger.info(
            f"[Stage 5] Economy diagnosed: "
            f"{len(pathologies)} pathologies "
            f"({critical_count} critical, {warning_count} warning, {info_count} info) "
            f"({time.time() - start:.2f}s)"
        )
        return diagnostics

    # ========================================================
    # Вспомогательные методы для Этапа 5
    # ========================================================

    def _get_node_rate(self, nodes: list[MachinationsNode], node_id: str) -> float:
        """Получить rate узла по ID."""
        for node in nodes:
            if node.id == node_id:
                return node.rate or 0.0
        return 0.0

    def _get_reinforcing_resources(self, inventory: ResourceInventory) -> list[str]:
        """Ресурсы, участвующие в усиливающих петлях."""
        return [
            r.name for r in inventory.resources
            if r.resource_class in ("experience", "currency")
        ]

    def _get_consumable_resources(self, inventory: ResourceInventory) -> list[str]:
        """Потребляемые ресурсы."""
        return [r.name for r in inventory.resources if r.is_consumable]

    def _detect_arbitrage_cycles(self, conversion_graph: ConversionGraph) -> list[list[str]]:
        """Обнаружение замкнутых циклов арбитража в графе конверсий."""
        cycles: list[list[str]] = []

        # Строим граф: resource → resources через конверсии
        adj: dict[str, list[tuple[str, float]]] = {}
        for chain in conversion_graph.chains:
            for inp in chain.inputs:
                for outp in chain.outputs:
                    if inp not in adj:
                        adj[inp] = []
                    adj[inp].append((outp, chain.profitability))

        # Ищем циклы с помощью DFS
        all_resources: set[str] = set()
        for chain in conversion_graph.chains:
            all_resources.update(chain.inputs)
            all_resources.update(chain.outputs)

        for start_res in all_resources:
            found = self._dfs_cycle(start_res, start_res, adj, [], set(), max_depth=6)
            if found:
                cycles.append(found)

        return cycles[:5]  # Ограничиваем

    def _dfs_cycle(
        self,
        start: str,
        current: str,
        adj: dict[str, list[tuple[str, float]]],
        path: list[str],
        visited: set[str],
        max_depth: int,
    ) -> list[str]:
        """DFS для поиска цикла с положительной прибылью."""
        if max_depth <= 0:
            return []

        if current in adj:
            for next_res, profit in adj[current]:
                if next_res == start and len(path) > 0:
                    # Найден цикл — проверяем прибыль
                    return path + [next_res]
                if next_res not in visited:
                    result = self._dfs_cycle(
                        start, next_res, adj,
                        path + [current],
                        visited | {next_res},
                        max_depth - 1,
                    )
                    if result:
                        return result

        return []

    # ========================================================
    # Этап 6: Автоматическая балансировка (3.6.8)
    # ========================================================

    async def balance_faucets_drains(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
        machinations_graph: MachinationsGraph,
        diagnostics: EconomyDiagnostics,
        economy_phase: str = "startup",
        project_state: Optional[dict] = None,
    ) -> FaucetDrainBalance:
        """
        Этап 6: Автоматическая балансировка faucet/drain.

        Алгоритм 3.6.8:
        1. Рассчитать faucet/drain ratio для каждого ресурса
        2. Auto-adjust: если deficit (ratio < 0.7), increase faucet or decrease drain
        3. Auto-adjust: если surplus (ratio > 1.5), increase drain or decrease faucet
        4. Привязать к economy phases: startup (balanced), growth (surplus), maturity (balanced), endgame (deficit)
        5. Вернуть FaucetDrainBalance с корректировками

        Returns:
            FaucetDrainBalance с корректировками
        """
        start = time.time()
        adjustments: list[FaucetDrainAdjustment] = []
        warnings: list[str] = []

        # Целевой ratio зависит от фазы экономики
        target_ratio = ECONOMY_PHASE_TARGETS.get(economy_phase, 1.0)

        source_nodes = {n.id: n for n in machinations_graph.nodes if n.node_type == "source"}
        drain_nodes = {n.id: n for n in machinations_graph.nodes if n.node_type == "drain"}

        for res in inventory.resources:
            faucet_rate = self._get_node_rate(
                list(source_nodes.values()), f"source_{res.name}"
            )
            drain_rate = self._get_node_rate(
                list(drain_nodes.values()), f"drain_{res.name}"
            )

            # Рассчитываем текущий ratio
            if drain_rate > 0:
                current_ratio = faucet_rate / drain_rate
            elif faucet_rate > 0:
                current_ratio = float("inf")
            else:
                current_ratio = 1.0  # Нет ни faucet ни drain — нейтрально

            # Определяем необходимую корректировку
            action = "none"
            new_faucet = faucet_rate
            new_drain = drain_rate

            if current_ratio < FAUCET_DRAIN_DEFICIT:
                # Дефицит: увеличить faucet или уменьшить drain
                if faucet_rate > 0:
                    new_faucet = round(faucet_rate * (target_ratio / max(current_ratio, 0.1)), 4)
                    action = "increase_faucet"
                elif drain_rate > 0:
                    new_drain = round(drain_rate * current_ratio / target_ratio, 4)
                    action = "decrease_drain"
                else:
                    new_faucet = round(self._estimate_faucet_rate(res, classification), 4)
                    action = "add_faucet"

            elif current_ratio > FAUCET_DRAIN_SURPLUS:
                # Профицит: увеличить drain или уменьшить faucet
                if drain_rate > 0:
                    new_drain = round(drain_rate * (current_ratio / target_ratio), 4)
                    action = "increase_drain"
                elif faucet_rate > 0:
                    new_faucet = round(faucet_rate * target_ratio / current_ratio, 4)
                    action = "decrease_faucet"
                else:
                    new_drain = round(self._estimate_drain_rate(res, classification), 4)
                    action = "add_drain"

            if action != "none":
                new_ratio = new_faucet / new_drain if new_drain > 0 else float("inf")
                adjustment = FaucetDrainAdjustment(
                    resource=res.name,
                    current_faucet=faucet_rate,
                    current_drain=drain_rate,
                    current_ratio=round(current_ratio, 4) if current_ratio != float("inf") else float("inf"),
                    new_faucet=new_faucet,
                    new_drain=new_drain,
                    new_ratio=round(new_ratio, 4) if new_ratio != float("inf") else float("inf"),
                    action=action,
                    phase=economy_phase,
                )
                adjustments.append(adjustment)

                if action in ("add_faucet", "add_drain"):
                    warnings.append(
                        f"Ресурс '{res.name}' не имеет {'источника' if action == 'add_faucet' else 'стока'}. "
                        f"Рекомендуется добавить {'faucet' if action == 'add_faucet' else 'drain'}."
                    )

        # Обновляем Machinations graph с корректировками
        for adj in adjustments:
            source_id = f"source_{adj.resource}"
            drain_id = f"drain_{adj.resource}"

            if source_id in source_nodes and adj.new_faucet != adj.current_faucet:
                source_nodes[source_id].rate = adj.new_faucet

            if drain_id in drain_nodes and adj.new_drain != adj.current_drain:
                drain_nodes[drain_id].rate = adj.new_drain

            # Обновляем потоки
            for flow in machinations_graph.resource_flows:
                if flow.source_id == source_id:
                    flow.rate = adj.new_faucet
                elif flow.source_id == f"pool_{adj.resource}" and flow.target_id == drain_id:
                    flow.rate = adj.new_drain

        balanced_count = sum(
            1 for adj in adjustments
            if adj.action == "none" or (
                FAUCET_DRAIN_BALANCED_MIN <= (adj.new_ratio if adj.new_ratio != float("inf") else 0) <= FAUCET_DRAIN_BALANCED_MAX
            )
        )

        balance = FaucetDrainBalance(
            adjustments=adjustments,
            economy_phase=economy_phase,
            target_ratio=target_ratio,
            balanced_count=balanced_count,
            total_count=len(inventory.resources),
            warnings=warnings,
        )

        logger.info(
            f"[Stage 6] Faucet/drain balanced: "
            f"{len(adjustments)} adjustments, phase={economy_phase}, "
            f"target_ratio={target_ratio:.2f}, "
            f"{balanced_count}/{len(inventory.resources)} balanced "
            f"({time.time() - start:.2f}s)"
        )
        return balance

    # ========================================================
    # Этап 7: Симуляция экономики (3.6.9)
    # ========================================================

    async def simulate_economy(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
        machinations_graph: MachinationsGraph,
        num_ticks: int = DEFAULT_SIM_TICKS,
        num_runs: int = DEFAULT_SIM_RUNS,
        project_state: Optional[dict] = None,
    ) -> EconomySimResult:
        """
        Этап 7: Симуляция экономики (Monte Carlo).

        Алгоритм 3.6.9:
        1. Monte Carlo simulation of economy with N ticks and M runs
        2. Use different player archetypes (optimal, casual, minmaxer, explorer)
        3. Track resource curves over time
        4. Calculate runaway_frequency, stall_frequency, stability_index
        5. Calculate build_gap between optimal and casual progression
        6. Quality assessment: resources_in_bounds, progression_pacing_ok,
           no_runaway, no_stall, build_gap_acceptable, economy_stable

        Returns:
            EconomySimResult с результатами симуляции
        """
        start = time.time()

        # === Шаг 7.1: Инициализация симуляции ===
        players = DEFAULT_ARTIFICIAL_PLAYERS

        # Начальные значения ресурсов
        initial_resources: dict[str, float] = {}
        for res in inventory.resources:
            initial_resources[res.name] = res.initial_value

        # Получаем faucet/drain rates из графа
        source_rates: dict[str, float] = {}
        drain_rates: dict[str, float] = {}
        for node in machinations_graph.nodes:
            if node.node_type == "source" and node.rate is not None:
                res_name = node.name.replace("Faucet_", "")
                source_rates[res_name] = node.rate
            elif node.node_type == "drain" and node.rate is not None:
                res_name = node.name.replace("Drain_", "")
                drain_rates[res_name] = node.rate

        # === Шаг 7.2: Выполнение прогонов для каждого архетипа ===
        all_run_data: dict[str, list[dict[str, list[float]]]] = {}

        for player in players:
            player_name = player["name"]
            efficiency = player.get("efficiency", 0.5)
            all_run_data[player_name] = []

            for run_idx in range(min(num_runs, 50)):  # Ограничиваем для производительности
                # Инициализируем ресурсы для этого прогона
                resources = dict(initial_resources)
                resource_curve: dict[str, list[float]] = {
                    name: [value] for name, value in resources.items()
                }

                is_runaway = False
                is_stall = False

                rng = random.Random(run_idx * 1000 + hash(player_name))

                for tick in range(1, num_ticks + 1):
                    # Применяем faucet
                    for res_name, rate in source_rates.items():
                        if res_name in resources:
                            # Эффективность игрока влияет на скорость
                            actual_rate = rate * efficiency * (0.8 + rng.random() * 0.4)
                            resources[res_name] += actual_rate

                    # Применяем drain
                    for res_name, rate in drain_rates.items():
                        if res_name in resources:
                            actual_drain = rate * (0.8 + rng.random() * 0.4)
                            resources[res_name] = max(0, resources[res_name] - actual_drain)

                    # Применяем reinforcing feedback (XP → Gold faucet increase)
                    for res in inventory.resources:
                        if res.resource_class == "experience" and res.name in resources:
                            for cur_res in inventory.resources:
                                if cur_res.resource_class == "currency" and cur_res.name in source_rates:
                                    bonus = source_rates[cur_res.name] * 0.001 * resources[res.name]
                                    resources[cur_res.name] += bonus * efficiency

                    # Применяем balancing feedback (HP → reduces faucet when low)
                    for res in inventory.resources:
                        if res.resource_class == "hp" and res.name in resources:
                            bounds = res.bounds if isinstance(res.bounds, dict) else {"max": 100}
                            max_hp = bounds.get("max", 100)
                            hp_ratio = resources[res.name] / max_hp if max_hp > 0 else 1.0
                            if hp_ratio < 0.3:
                                # При низком HP снижаем faucet
                                for cur_res in inventory.resources:
                                    if cur_res.resource_class == "currency" and cur_res.name in resources:
                                        resources[cur_res.name] *= 0.99

                    # Записываем каждые 100 тиков
                    if tick % 100 == 0:
                        for name in resources:
                            if name in resource_curve:
                                resource_curve[name].append(round(resources[name], 2))

                    # Проверяем runaway
                    for name, value in resources.items():
                        initial_val = initial_resources.get(name, 1.0)
                        if initial_val > 0 and value > 10 * initial_val:
                            is_runaway = True

                    # Проверяем stall
                    all_near_zero = all(
                        v < 0.1 * initial_resources.get(n, 1.0)
                        for n, v in resources.items()
                        if initial_resources.get(n, 0) > 0
                    )
                    if all_near_zero:
                        is_stall = True

                all_run_data[player_name].append({
                    "curve": resource_curve,
                    "runaway": is_runaway,
                    "stall": is_stall,
                    "final_resources": dict(resources),
                })

        # === Шаг 7.3: Агрегация результатов ===
        avg_resource_curves: dict[str, list[float]] = {}
        resource_ranges: dict[str, dict] = {}

        for res in inventory.resources:
            # Собираем все значения для этого ресурса
            all_values: list[float] = []
            curve_sum: list[float] = []

            for player_name, runs in all_run_data.items():
                for run in runs:
                    curve = run.get("curve", {})
                    if res.name in curve:
                        values = curve[res.name]
                        all_values.extend(values)
                        # Суммируем для среднего
                        for i, v in enumerate(values):
                            if i >= len(curve_sum):
                                curve_sum.append(0.0)
                            curve_sum[i] += v

            # Средняя кривая
            total_runs = sum(len(runs) for runs in all_run_data.values())
            if total_runs > 0 and curve_sum:
                avg_resource_curves[res.name] = [
                    round(s / total_runs, 2) for s in curve_sum
                ]

            # Диапазоны
            if all_values:
                resource_ranges[res.name] = {
                    "min": round(min(all_values), 2),
                    "max": round(max(all_values), 2),
                }
            else:
                resource_ranges[res.name] = {"min": 0, "max": 0}

        # === Шаг 7.4: Рассчитать runaway/stall frequency ===
        runaway_count = 0
        stall_count = 0
        total_runs_actual = 0

        for player_name, runs in all_run_data.items():
            for run in runs:
                total_runs_actual += 1
                if run.get("runaway", False):
                    runaway_count += 1
                if run.get("stall", False):
                    stall_count += 1

        runaway_frequency = runaway_count / total_runs_actual if total_runs_actual > 0 else 0.0
        stall_frequency = stall_count / total_runs_actual if total_runs_actual > 0 else 0.0

        # === Шаг 7.5: Рассчитать build_gap ===
        optimal_final: dict[str, float] = {}
        casual_final: dict[str, float] = {}

        for player_name, runs in all_run_data.items():
            if runs:
                avg_final: dict[str, float] = {}
                for run in runs:
                    for res_name, value in run.get("final_resources", {}).items():
                        avg_final[res_name] = avg_final.get(res_name, 0.0) + value
                for res_name in avg_final:
                    avg_final[res_name] /= len(runs)

                if player_name == "optimal":
                    optimal_final = avg_final
                elif player_name == "casual":
                    casual_final = avg_final

        # Build gap = ratio of optimal to casual progression (average across resources)
        build_gap = 1.0
        if optimal_final and casual_final:
            ratios: list[float] = []
            for res_name in optimal_final:
                if res_name in casual_final and casual_final[res_name] > 0:
                    ratios.append(optimal_final[res_name] / casual_final[res_name])
            if ratios:
                build_gap = sum(ratios) / len(ratios)

        # === Шаг 7.6: Рассчитать stability_index ===
        # Stability = weighted score based on runaway, stall, and variance
        stability_penalty = 0.0
        stability_penalty += runaway_frequency * 0.5
        stability_penalty += stall_frequency * 0.3

        # Variance penalty
        variance_sum = 0.0
        for res in inventory.resources:
            if res.name in resource_ranges:
                rrange = resource_ranges[res.name]
                rmin = rrange.get("min", 0)
                rmax = rrange.get("max", 0)
                initial = initial_resources.get(res.name, 1.0)
                if initial > 0:
                    variance_sum += (rmax - rmin) / initial

        avg_variance = variance_sum / len(inventory.resources) if inventory.resources else 0
        variance_penalty = min(avg_variance / 10.0, 0.2)

        stability_index = max(0.0, 1.0 - stability_penalty - variance_penalty)

        # === Шаг 7.7: Quality assessment ===
        resources_in_bounds = True
        for res in inventory.resources:
            if res.name in resource_ranges:
                rrange = resource_ranges[res.name]
                bounds = res.bounds if isinstance(res.bounds, dict) else {"min": 0, "max": 10000}
                if rrange.get("min", 0) < bounds.get("min", 0):
                    resources_in_bounds = False
                if rrange.get("max", 0) > bounds.get("max", float("inf")):
                    resources_in_bounds = False

        progression_pacing_ok = build_gap < BUILD_GAP_THRESHOLD
        no_runaway = runaway_frequency < RUNAWAY_FREQUENCY_THRESHOLD
        no_stall = stall_frequency < STALL_FREQUENCY_THRESHOLD
        build_gap_acceptable = build_gap < BUILD_GAP_THRESHOLD
        economy_stable = stability_index >= STABILITY_INDEX_THRESHOLD

        critical_issues: list[str] = []
        qa_warnings: list[str] = []

        if not resources_in_bounds:
            critical_issues.append("Ресурсы выходят за границы (min/max).")
        if not no_runaway:
            critical_issues.append(f"Runaway frequency = {runaway_frequency:.2f} > {RUNAWAY_FREQUENCY_THRESHOLD}.")
        if not no_stall:
            critical_issues.append(f"Stall frequency = {stall_frequency:.2f} > {STALL_FREQUENCY_THRESHOLD}.")
        if not build_gap_acceptable:
            qa_warnings.append(f"Build gap = {build_gap:.2f}× > {BUILD_GAP_THRESHOLD}×. Разрыв между optimal и casual слишком велик.")
        if not economy_stable:
            qa_warnings.append(f"Stability index = {stability_index:.2f} < {STABILITY_INDEX_THRESHOLD}. Экономика нестабильна.")
        if not progression_pacing_ok:
            qa_warnings.append("Темп прогрессии не соответствует целевым кривым.")

        quality = QualityAssessment(
            resources_in_bounds=resources_in_bounds,
            progression_pacing_ok=progression_pacing_ok,
            no_runaway_for_minmaxer=no_runaway,
            no_stall_for_casual=no_stall,
            build_gap_acceptable=build_gap_acceptable,
            economy_stable=economy_stable,
            overall_pass=len(critical_issues) == 0,
            critical_issues=critical_issues,
            warnings=qa_warnings,
        )

        # Снапшоты для визуализации (типичный прогон optimal)
        snapshots: list[EconomyRunSnapshot] = []
        if "optimal" in all_run_data and all_run_data["optimal"]:
            optimal_run = all_run_data["optimal"][0]
            curve = optimal_run.get("curve", {})
            for i, tick in enumerate(range(0, num_ticks + 1, 100)):
                if i < len(next(iter(curve.values()), [])):
                    snapshot_resources = {}
                    for res_name, values in curve.items():
                        if i < len(values):
                            snapshot_resources[res_name] = values[i]
                    snapshots.append(EconomyRunSnapshot(
                        tick=tick,
                        resources=snapshot_resources,
                        level=min(i + 1, 10),
                    ))

        aggregated = AggregatedSimData(
            avg_resource_curves=avg_resource_curves,
            resource_ranges=resource_ranges,
            runaway_frequency=round(runaway_frequency, 4),
            stall_frequency=round(stall_frequency, 4),
            build_gap=round(build_gap, 4),
            stability_index=round(stability_index, 4),
        )

        detected_pathologies: list[str] = []
        if runaway_frequency > RUNAWAY_FREQUENCY_THRESHOLD:
            detected_pathologies.append("runaway")
        if stall_frequency > STALL_FREQUENCY_THRESHOLD:
            detected_pathologies.append("stall")
        if not resources_in_bounds:
            detected_pathologies.append("overflow")
        if build_gap > BUILD_GAP_THRESHOLD:
            detected_pathologies.append("build_gap")

        recommendations: list[str] = []
        if runaway_frequency > RUNAWAY_FREQUENCY_THRESHOLD:
            recommendations.append("Добавить тормозящие механизмы (diminishing returns, caps).")
        if stall_frequency > STALL_FREQUENCY_THRESHOLD:
            recommendations.append("Увеличить faucet для ключевых ресурсов.")
        if build_gap > BUILD_GAP_THRESHOLD:
            recommendations.append(f"Снизить build gap с {build_gap:.1f}× до <{BUILD_GAP_THRESHOLD}× путём балансировки наград.")
        if not economy_stable:
            recommendations.append("Повысить стабильность: добавить балансирующие петли обратной связи.")

        sim_config = MachinationsSimConfig(
            ticks=num_ticks,
            num_runs=num_runs,
            artificial_players=players,
            recording_interval=100,
            resource_tracking=[r.name for r in inventory.resources],
        )

        result = EconomySimResult(
            config=sim_config,
            aggregated=aggregated,
            quality=quality,
            snapshots=snapshots[:20],
            detected_pathologies=detected_pathologies,
            recommendations=recommendations,
        )

        logger.info(
            f"[Stage 7] Economy simulated: "
            f"{num_ticks} ticks × {num_runs} runs, "
            f"runaway={runaway_frequency:.2f}, stall={stall_frequency:.2f}, "
            f"build_gap={build_gap:.2f}×, stability={stability_index:.2f}, "
            f"overall_pass={quality.overall_pass} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    # ========================================================
    # Этап 8: Сборка EconomyProfile (3.6.10)
    # ========================================================

    async def economy_design_full(
        self,
        genre: str = "",
        core_loop: Optional[dict] = None,
        mda_profile: Optional[dict] = None,
        progression_profile: Optional[dict] = None,
        economy_phase: str = "startup",
        sim_ticks: int = DEFAULT_SIM_TICKS,
        sim_runs: int = DEFAULT_SIM_RUNS,
        project_state: Optional[dict] = None,
    ) -> EconomyProfile:
        """
        Этап 8: Полный пайплайн экономического моделирования.

        Выполняет последовательно:
        1. Идентификацию ресурсов → ResourceInventory
        2. Классификацию экономики → EconomicClassification
        3. Построение Machinations-модели → MachinationsGraph
        4. Построение графа конверсий → ConversionGraph
        5. Диагностику патологий → EconomyDiagnostics
        6. Балансировку faucet/drain → FaucetDrainBalance
        7. Симуляцию экономики → EconomySimResult
        8. Сборку EconomyProfile

        Returns:
            EconomyProfile — итоговый профиль экономики
        """
        pipeline_start = time.time()
        stages_completed: list[int] = []
        models_used: list[str] = []
        all_warnings: list[str] = []
        all_suggestions: list[str] = []

        # === Этап 1: Идентификация ресурсов ===
        try:
            inventory = await self.identify_resources(
                core_loop=core_loop,
                mda_profile=mda_profile,
                progression_profile=progression_profile,
                genre=genre,
                project_state=project_state,
            )
            stages_completed.append(1)
            models_used.extend(inventory.models_used)

            logger.info(
                f"[Pipeline] Stage 1 completed: "
                f"{len(inventory.resources)} resources, anchor={inventory.anchor_resource}"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 1 (identify_resources) failed: {e}")
            all_warnings.append(f"Идентификация ресурсов не удалась: {e}")
            # Создаём минимальный inventory
            inventory = ResourceInventory(
                resources=[],
                anchor_resource="",
                core_count=0,
                subsidiary_count=0,
                class_distribution={},
                models_used=[],
            )

        # === Этап 2: Классификация экономики ===
        try:
            classification = await self.classify_economy(
                inventory=inventory,
                core_loop=core_loop,
                mda_profile=mda_profile,
                genre=genre,
                project_state=project_state,
            )
            stages_completed.append(2)

            logger.info(
                f"[Pipeline] Stage 2 completed: "
                f"type={classification.economic_type}/{classification.sub_type}"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 2 (classify_economy) failed: {e}")
            all_warnings.append(f"Классификация экономики не удалась: {e}")
            classification = EconomicClassification(
                economic_type="engine",
                sub_type="pure_engine",
            )

        # === Этап 3: Построение Machinations-модели ===
        try:
            machinations_graph = await self.build_machinations_model(
                inventory=inventory,
                classification=classification,
                core_loop=core_loop,
                progression_profile=progression_profile,
                project_state=project_state,
            )
            stages_completed.append(3)

            logger.info(
                f"[Pipeline] Stage 3 completed: "
                f"{machinations_graph.node_count} nodes, {machinations_graph.flow_count} flows"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 3 (build_machinations_model) failed: {e}")
            all_warnings.append(f"Построение Machinations-модели не удалось: {e}")
            machinations_graph = MachinationsGraph()

        # === Этап 4: Построение графа конверсий ===
        conversion_graph: Optional[ConversionGraph] = None
        try:
            conversion_graph = await self.build_conversion_graph(
                inventory=inventory,
                classification=classification,
                machinations_graph=machinations_graph,
                progression_profile=progression_profile,
                project_state=project_state,
            )
            stages_completed.append(4)
            all_warnings.extend(conversion_graph.warnings)
            all_suggestions.extend(conversion_graph.suggestions)

            logger.info(
                f"[Pipeline] Stage 4 completed: "
                f"{len(conversion_graph.chains)} chains, "
                f"avg_profit={conversion_graph.avg_profitability:.2f}"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 4 (build_conversion_graph) failed: {e}")
            all_warnings.append(f"Построение графа конверсий не удалось: {e}")

        # === Этап 5: Диагностика патологий ===
        diagnostics: Optional[EconomyDiagnostics] = None
        try:
            diagnostics = await self.diagnose_economy(
                inventory=inventory,
                classification=classification,
                machinations_graph=machinations_graph,
                conversion_graph=conversion_graph,
                project_state=project_state,
            )
            stages_completed.append(5)

            for p in diagnostics.pathologies:
                if p.severity in ("critical", "warning"):
                    all_warnings.append(f"[{p.severity}] {p.name}: {p.description}")
                if p.correction:
                    all_suggestions.append(p.correction)

            logger.info(
                f"[Pipeline] Stage 5 completed: "
                f"{diagnostics.critical_count} critical, "
                f"{diagnostics.warning_count} warning"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 5 (diagnose_economy) failed: {e}")
            all_warnings.append(f"Диагностика экономики не удалась: {e}")

        # === Этап 6: Балансировка faucet/drain ===
        balance: Optional[FaucetDrainBalance] = None
        try:
            balance = await self.balance_faucets_drains(
                inventory=inventory,
                classification=classification,
                machinations_graph=machinations_graph,
                diagnostics=diagnostics or EconomyDiagnostics(),
                economy_phase=economy_phase,
                project_state=project_state,
            )
            stages_completed.append(6)
            all_warnings.extend(balance.warnings)

            logger.info(
                f"[Pipeline] Stage 6 completed: "
                f"{len(balance.adjustments)} adjustments, "
                f"phase={economy_phase}"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 6 (balance_faucets_drains) failed: {e}")
            all_warnings.append(f"Балансировка faucet/drain не удалась: {e}")

        # === Этап 7: Симуляция экономики ===
        sim_result: Optional[EconomySimResult] = None
        try:
            sim_result = await self.simulate_economy(
                inventory=inventory,
                classification=classification,
                machinations_graph=machinations_graph,
                num_ticks=sim_ticks,
                num_runs=sim_runs,
                project_state=project_state,
            )
            stages_completed.append(7)

            if sim_result.quality:
                all_warnings.extend(sim_result.quality.critical_issues)
                all_warnings.extend(sim_result.quality.warnings)
            all_suggestions.extend(sim_result.recommendations)

            logger.info(
                f"[Pipeline] Stage 7 completed: "
                f"stability={sim_result.aggregated.stability_index if sim_result.aggregated else 0:.2f}, "
                f"pass={sim_result.quality.overall_pass if sim_result.quality else False}"
            )
        except Exception as e:
            logger.error(f"[Pipeline] Stage 7 (simulate_economy) failed: {e}")
            all_warnings.append(f"Симуляция экономики не удалась: {e}")

        # === Этап 8: Сборка EconomyProfile ===
        latency_ms = int((time.time() - pipeline_start) * 1000)

        # Генерируем summary
        summary = self._generate_economy_summary(
            inventory=inventory,
            classification=classification,
            diagnostics=diagnostics,
            sim_result=sim_result,
        )

        profile = EconomyProfile(
            inventory=inventory,
            classification=classification,
            machinations_graph=machinations_graph,
            conversion_graph=conversion_graph,
            diagnostics=diagnostics,
            balance=balance,
            sim_result=sim_result,
            summary=summary,
            stages_completed=stages_completed,
            latency_ms=latency_ms,
            models_used=list(set(models_used)),
            warnings=all_warnings,
            suggestions=all_suggestions,
        )

        logger.info(
            f"[Pipeline] Economy design complete: "
            f"{len(stages_completed)}/8 stages, "
            f"{latency_ms}ms, "
            f"{len(all_warnings)} warnings, "
            f"{len(all_suggestions)} suggestions"
        )
        return profile

    # ========================================================
    # Вспомогательные методы для Этапа 8
    # ========================================================

    def _generate_economy_summary(
        self,
        inventory: ResourceInventory,
        classification: EconomicClassification,
        diagnostics: Optional[EconomyDiagnostics],
        sim_result: Optional[EconomySimResult],
    ) -> str:
        """Генерация текстовой сводки экономики."""
        parts: list[str] = []

        parts.append(
            f"Экономика типа {classification.economic_type}/{classification.sub_type}."
        )
        parts.append(
            f"Ресурсы: {len(inventory.resources)} "
            f"({inventory.core_count} core, {inventory.subsidiary_count} subsidiary), "
            f"anchor={inventory.anchor_resource}."
        )
        parts.append(
            f"Петли: {classification.reinforcing_loops} reinforcing, "
            f"{classification.balancing_loops} balancing. "
            f"Interaction: {classification.interaction_type}."
        )
        parts.append(
            f"Openness: {classification.openness}, "
            f"Pricing: {classification.pricing_type}."
        )

        if diagnostics:
            parts.append(
                f"Патологии: {diagnostics.critical_count} critical, "
                f"{diagnostics.warning_count} warning, "
                f"{diagnostics.info_count} info."
            )
            if diagnostics.overall_severity == "critical":
                parts.append("⚠️ Экономика требует немедленной коррекции.")
            elif diagnostics.overall_severity == "warning":
                parts.append("⚡ Экономика имеет проблемы, требующие внимания.")
            else:
                parts.append("✓ Экономика в целом стабильна.")

        if sim_result and sim_result.aggregated:
            agg = sim_result.aggregated
            parts.append(
                f"Симуляция: stability_index={agg.stability_index:.2f}, "
                f"runaway_freq={agg.runaway_frequency:.2f}, "
                f"stall_freq={agg.stall_frequency:.2f}, "
                f"build_gap={agg.build_gap:.2f}×."
            )

        if sim_result and sim_result.quality:
            if sim_result.quality.overall_pass:
                parts.append("✓ Все проверки качества пройдены.")
            else:
                parts.append(
                    f"✗ Критические проблемы: {len(sim_result.quality.critical_issues)}."
                )

        return " ".join(parts)
