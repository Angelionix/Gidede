"""
Gidede — Core Loop Service
Фаза 4.B.6: Блок 2 — алгоритм проектирования Core Loop (Этапы 1–3)

Реализация пайплайна Core Loop из алгоритма 3.2:
- Этап 1: Классификация структурного типа (3.2.3)
  • Извлечение ресурсов из механик и концепции
  • Определение типа петли: reinforcing/balancing/mixed
  • Определение взаимодействия ресурсов: single_resource/conversion
  • Классификация: Engine/Economy/Ecology/Hybrid
  • Определение подтипа: braked_engine, pure_engine, etc.
  • Оценка рисков

- Этап 2: Конструирование иерархии петель (3.2.4)
  • 6 уровней: micro → small → medium → large → macro → meta
  • Декомпозиция шагов через DECOMPOSE_STEP
  • Генерация outer loops через GENERATE_OUTER_LOOPS
  • Генерация meta loop через GENERATE_META_LOOP

- Этап 3: Диагностика патологий (3.2.5)
  • Проверка 7 патологий: runaway, deadlock, stall, brittleness,
    oscillation, stagnation, triviality
  • Формализованные правила + AI-обогащение
  • Рекомендации через GENERATE_RECOMMENDATIONS

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry), 4.A.12 (Shared Types)
"""

import uuid
import time
import logging
from typing import Any, Optional

from app.ai.executor import PromptExecutor, PromptResult, PromptExecutionOptions
from app.prompts.registry import get_prompt_spec

# Локальные Pydantic-модели, синхронизированные с shared/types/python/models.py (4.A.12)
from app.schemas.coreloop import (
    CoreLoopStep,
    ResourceProfile,
    RiskProfile,
    StructuralType,
    LoopProfile,
    LoopHierarchy,
    Pathology,
    PathologyReport,
    CoreLoopProfile,
)

# MechanicsDB — 128 механик в 15 группах (SW.BAND, Кн. 15)
from app.data.mechanics_db import MECHANICS_DB_DATA

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.2
# ============================================================

# Маппинг «Механика → Ресурсы» (алгоритм 3.2.3)
# Источник: MechanicsDB + формализованные связи механик и ресурсов
RESOURCE_MECHANIC_MAP: dict[str, list[str]] = {
    "Враги": ["HP", "урон", "опыт"],
    "Здоровье": ["HP", "лечение", "броня"],
    "Очки опыта": ["XP", "уровни"],
    "Инвентарь": ["предметы", "ресурсы"],
    "Квесты": ["XP", "золото", "репутация"],
    "Головоломки": ["интеллект", "прогресс"],
    "Достижения и очки": ["очки", "достижения"],
    "Древо технологий": ["технологии", "ресурсы"],
    "Очки опыта": ["XP", "навыки"],
    "Перки": ["способности", "навыки"],
    "Характеристики": ["статы", "XP"],
    "Обмундирование": ["снаряжение", "золото"],
    "Прокачка оружия": ["урон", "ресурсы"],
    "Достижения": ["достижения", "очки"],
    "Ресурсы": ["материалы", "золото"],
    "Уровни": ["XP", "навыки"],
    "Сложность": ["вызов", "XP"],
    "Броня": ["броня", "прочность"],
    "Запас патронов": ["патроны", "урон"],
    "Мана": ["мана", "заклинания"],
    "Комбо": ["урон", "рейтинг"],
    "Крафт": ["материалы", "предметы"],
    "Экономика": ["золото", "торговля"],
    "Строительство": ["материалы", "строения"],
    "Карта мира": ["навигация", "локации"],
    "Фермерство": ["ресурсы", "еда"],
    "Репутация": ["репутация", "фракции"],
    "Нарратив": ["сюжет", "репутация"],
}

# Маппинг «Жанр → Типичная структурная категория» (алгоритм 3.2.3)
# Источник: Типология Селлерса (Engine/Economy/Ecology)
GENRE_STRUCTURAL_MAP: dict[str, dict[str, Any]] = {
    # Engine-доминантные жанры
    "action": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "shooter": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "platformer": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "fighting": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "rhythm": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "racing": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "roguelike": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "hybrid"},
    "metroidvania": {"loop_type": "reinforcing", "resource_interaction": "conversion", "structural": "engine"},
    # Economy-доминантные жанры
    "rpg": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "action_rpg": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "mmorpg": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "strategy": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "rts": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "tbs": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "simulation": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "idle": {"loop_type": "reinforcing", "resource_interaction": "conversion", "structural": "economy"},
    # Ecology-доминантные жанры
    "survival_horror": {"loop_type": "balancing", "resource_interaction": "conversion", "structural": "ecology"},
    "horror": {"loop_type": "balancing", "resource_interaction": "conversion", "structural": "ecology"},
    "sandbox": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "ecology"},
    # Balanced/Hybrid
    "adventure": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "hybrid"},
    "stealth": {"loop_type": "balancing", "resource_interaction": "single_resource", "structural": "hybrid"},
    "puzzle": {"loop_type": "balancing", "resource_interaction": "single_resource", "structural": "ecology"},
    "tower_defense": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "hybrid"},
    "tactical_rpg": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "jrpg": {"loop_type": "mixed", "resource_interaction": "conversion", "structural": "economy"},
    "party": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "educational": {"loop_type": "balancing", "resource_interaction": "single_resource", "structural": "ecology"},
    "sports": {"loop_type": "reinforcing", "resource_interaction": "single_resource", "structural": "engine"},
    "visual_novel": {"loop_type": "balancing", "resource_interaction": "single_resource", "structural": "ecology"},
}

# Матрица классификации структурного типа (алгоритм 3.2.3)
# |                      | Один ресурс         | Конвертация ресурсов |
# | Усиливающие петли    | Engine              | Economy              |
# | Балансирующие петли  | (редкий)            | Ecology              |
# | Смешанные петли      | Hybrid Engine       | Hybrid Economy       |
LOOP_TYPE_MATRIX: dict[str, dict[str, str]] = {
    "reinforcing": {
        "single_resource": "engine",
        "conversion": "economy",
    },
    "balancing": {
        "single_resource": "ecology",  # редкий случай
        "conversion": "ecology",
    },
    "mixed": {
        "single_resource": "hybrid",
        "conversion": "hybrid",
    },
}

# Маппинг «Структурный тип → Подтипы» (алгоритм 3.2.3)
STRUCTURAL_SUBTYPES: dict[str, list[str]] = {
    "engine": ["pure_engine", "braked_engine"],
    "economy": ["single_currency_economy", "multi_currency_economy"],
    "ecology": ["balanced_ecology"],
    "hybrid": ["hybrid_engine", "hybrid_economy"],
}

# Маппинг «Структурный тип → Вероятные патологии» (алгоритм 3.2.5)
STRUCTURAL_PATHOLOGY_MAP: dict[str, list[str]] = {
    "engine": ["runaway", "stagnation", "triviality"],
    "economy": ["deadlock", "oscillation", "runaway"],
    "ecology": ["stall", "brittleness", "stagnation"],
    "hybrid": ["runaway", "deadlock", "brittleness", "oscillation"],
}

# Правила обнаружения патологий (алгоритм 3.2.5)
PATHOLOGY_RULES: dict[str, dict[str, Any]] = {
    "runaway": {
        "name": "Неограниченный рост",
        "description": "Ресурс растёт без ограничений, петля усиливает сама себя",
        "detection": "Есть усиливающая петля без тормозящего механизма и без верхней границы ресурса",
        "correction": "Добавить тормозящий механизм (drain) или верхнюю границу ресурса",
        "default_severity": "critical",
    },
    "deadlock": {
        "name": "Замкнутый тупик",
        "description": "Циклическая зависимость: для получения A нужен B, для B нужен A, но ни одного нет",
        "detection": "Два+ ресурса в циклической зависимости без начального источника",
        "correction": "Добавить альтернативный источник хотя бы одного ресурса или начальный запас",
        "default_severity": "critical",
    },
    "stall": {
        "name": "Остановка петли",
        "description": "Петля перестаёт функционировать из-за исчерпания критического ресурса",
        "detection": "Ключевой потребляемый ресурс без источника пополнения",
        "correction": "Обеспечить автоматическое пополнение или альтернативный источник ресурса",
        "default_severity": "warning",
    },
    "brittleness": {
        "name": "Хрупкость",
        "description": "Малое изменение одного параметра ломает всю систему",
        "detection": "Единственный путь прохождения петли, нет альтернативных маршрутов",
        "correction": "Добавить альтернативные маршруты и резервные механизмы",
        "default_severity": "warning",
    },
    "oscillation": {
        "name": "Колебание",
        "description": "Система колеблется между состояниями без стабилизации",
        "detection": "Балансирующая и усиливающая петли конфликтуют без демпфирования",
        "correction": "Добавить демпфирующий механизм или ограничить амплитуду колебаний",
        "default_severity": "warning",
    },
    "stagnation": {
        "name": "Стагнация",
        "description": "Система достигает равновесия, но без прогресса",
        "detection": "Все ресурсы в равновесии, нет мотивации к действию",
        "correction": "Добавить прогрессионный механизм или нарушить равновесие через события",
        "default_severity": "info",
    },
    "triviality": {
        "name": "Тривиальность",
        "description": "Решения в петле очевидны, нет стратегической глубины",
        "detection": "Один ресурс, одно действие, нет выбора",
        "correction": "Добавить альтернативные действия или несколько расходуемых ресурсов",
        "default_severity": "info",
    },
}


# ============================================================
# Core Loop Service
# ============================================================

class CoreLoopService:
    """
    Блок 2: Core Loop Designer.
    Реализует алгоритм 3.2 — Этапы 1–3.

    Методы:
    - classify_core_loop() — Этап 1: классификация структурного типа
    - build_loop_hierarchy() — Этап 2: конструирование иерархии петель
    - diagnose_pathologies() — Этап 3: диагностика патологий
    - design_full() — полный пайплайн Этапов 1–3
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Классификация структурного типа (3.2.3)
    # ========================================================

    async def classify_core_loop(
        self,
        mechanics: list[str],
        concept_data: Optional[dict] = None,
        genre: str = "rpg",
        desired_loop_type: Optional[str] = None,
        project_state: Optional[dict] = None,
    ) -> StructuralType:
        """
        Этап 1: Классификация структурного типа Core Loop.

        Алгоритм 3.2.3:
        1. Извлечь ресурсы из механик
        2. Определить тип петли (reinforcing/balancing/mixed)
        3. Определить взаимодействие ресурсов (single_resource/conversion)
        4. Классифицировать структурный тип по матрице
        5. Определить подтип
        6. Оценить риски

        Returns:
            StructuralType с type, sub_type, resources, loops, has_braking, currencies, risk_assessment
        """
        start = time.time()

        # 1. Извлечение ресурсов из механик
        all_resources: list[str] = []
        resource_details: list[ResourceProfile] = []

        for mechanic_name in mechanics:
            mapped_resources = RESOURCE_MECHANIC_MAP.get(mechanic_name, [])
            for res in mapped_resources:
                if res not in all_resources:
                    all_resources.append(res)
                    # Классифицируем ресурс
                    resource_details.append(
                        self._classify_resource(res, mechanics, genre)
                    )

        # 2. Определение типа петли
        loop_type = self._determine_loop_type(
            mechanics, genre, desired_loop_type
        )

        # 3. Определение взаимодействия ресурсов
        resource_interaction = self._determine_resource_interaction(
            all_resources, resource_details
        )

        # 4. Классификация по матрице
        structural_type_str = LOOP_TYPE_MATRIX.get(
            loop_type, {}
        ).get(resource_interaction, "hybrid")

        # Переопределение из жанрового маппинга, если нет желаемого типа
        if not desired_loop_type:
            genre_structural = GENRE_STRUCTURAL_MAP.get(genre, {})
            if genre_structural:
                structural_type_str = genre_structural.get(
                    "structural", structural_type_str
                )
                loop_type = genre_structural.get("loop_type", loop_type)
                resource_interaction = genre_structural.get(
                    "resource_interaction", resource_interaction
                )

        # Если пользователь указал желаемый тип — используем его
        if desired_loop_type and desired_loop_type in [
            "engine", "economy", "ecology", "hybrid",
        ]:
            structural_type_str = desired_loop_type

        # 5. Определение подтипа
        sub_type = self._determine_sub_type(
            structural_type_str, resource_details, mechanics
        )

        # 6. Наличие тормозящего механизма
        has_braking = self._check_braking(resource_details, mechanics)

        # 7. Определение валют
        currencies = [
            r.name for r in resource_details
            if r.type == "currency" or r.class_ == "Valued"
        ]

        # 8. Оценка рисков
        risk_assessment = self._assess_risk(
            structural_type_str, resource_details, has_braking
        )

        # 9. Формируем профили петель (базовые)
        loops = self._build_initial_loops(
            structural_type_str, mechanics, all_resources
        )

        structural_type = StructuralType(
            type=structural_type_str,
            sub_type=sub_type,
            resources=[r.model_dump() for r in resource_details],
            loops=loops,
            has_braking=has_braking,
            currencies=currencies,
            risk_assessment=risk_assessment,
        )

        logger.info(
            f"[Stage 1] Core Loop classified: {structural_type_str}/{sub_type} "
            f"({len(all_resources)} resources, braking={has_braking}, "
            f"{time.time() - start:.2f}s)"
        )
        return structural_type

    def _classify_resource(
        self,
        resource_name: str,
        mechanics: list[str],
        genre: str,
    ) -> ResourceProfile:
        """Классифицировать ресурс по классу и типу."""
        # Определяем класс ресурса (Valued/Commodity/Subsidiary)
        valued_resources = {"XP", "очки", "достижения", "репутация", "навыки", "статы"}
        commodity_resources = {"материалы", "ресурсы", "еда", "патроны", "мана", "золото"}
        subsidiary_resources = {"HP", "броня", "прочность", "лечение"}

        if resource_name in valued_resources:
            class_ = "Valued"
            type_ = "core"
            bounds = {"min": 0, "max": 999999}
            initial = 0
        elif resource_name in commodity_resources:
            class_ = "Commodity"
            type_ = "consumable"
            bounds = {"min": 0, "max": 999}
            initial = 10
        elif resource_name in subsidiary_resources:
            class_ = "Subsidiary"
            type_ = "core"
            bounds = {"min": 0, "max": 100}
            initial = 100
        else:
            class_ = "Commodity"
            type_ = "consumable"
            bounds = {"min": 0, "max": 100}
            initial = 50

        # Валюты
        currency_resources = {"золото", "мана", "очень"}
        if resource_name in currency_resources:
            type_ = "currency"
            class_ = "Valued"

        return ResourceProfile(
            name=resource_name,
            class_=class_,
            type=type_,
            initial_value=initial,
            bounds=bounds,
        )

    def _determine_loop_type(
        self,
        mechanics: list[str],
        genre: str,
        desired_loop_type: Optional[str] = None,
    ) -> str:
        """
        Определить тип петли: reinforcing/balancing/mixed.

        reinforcing — усиливающая (больше ресурса → больше действий → ещё больше ресурса)
        balancing — балансирующая (отклонение → компенсация → возврат к норме)
        mixed — смешанная
        """
        if desired_loop_type:
            type_map = {
                "engine": "reinforcing",
                "economy": "mixed",
                "ecology": "balancing",
                "hybrid": "mixed",
            }
            return type_map.get(desired_loop_type, "mixed")

        # Из жанрового маппинга
        genre_info = GENRE_STRUCTURAL_MAP.get(genre, {})
        return genre_info.get("loop_type", "mixed")

    def _determine_resource_interaction(
        self,
        all_resources: list[str],
        resource_details: list[ResourceProfile],
    ) -> str:
        """
        Определить тип взаимодействия ресурсов:
        - single_resource: один основной ресурс
        - conversion: конвертация между ресурсами
        """
        # Если 1-2 ресурса — single_resource
        if len(all_resources) <= 2:
            return "single_resource"

        # Если есть валюты и несколько consumable — conversion
        has_currency = any(r.type == "currency" for r in resource_details)
        has_consumable = any(r.type == "consumable" for r in resource_details)

        if has_currency and has_consumable:
            return "conversion"

        # Если больше 3 ресурсов — conversion
        if len(all_resources) > 3:
            return "conversion"

        return "single_resource"

    def _determine_sub_type(
        self,
        structural_type: str,
        resources: list[ResourceProfile],
        mechanics: list[str],
    ) -> str:
        """Определить подтип структурного типа."""
        subtypes = STRUCTURAL_SUBTYPES.get(structural_type, ["unknown"])

        if structural_type == "engine":
            # Проверяем наличие тормозящего механизма
            has_drain = any(
                r.type == "consumable" for r in resources
            )
            return "braked_engine" if has_drain else "pure_engine"

        elif structural_type == "economy":
            # Считаем количество валют
            currency_count = sum(
                1 for r in resources if r.type == "currency"
            )
            return (
                "multi_currency_economy"
                if currency_count > 1
                else "single_currency_economy"
            )

        elif structural_type == "ecology":
            return "balanced_ecology"

        elif structural_type == "hybrid":
            # Определяем преобладающий компонент
            has_engine_mechanics = any(
                m in mechanics
                for m in ["Враги", "Комбо", "Уровни", "Очки опыта"]
            )
            return "hybrid_engine" if has_engine_mechanics else "hybrid_economy"

        return subtypes[0] if subtypes else "unknown"

    def _check_braking(
        self,
        resources: list[ResourceProfile],
        mechanics: list[str],
    ) -> bool:
        """Проверить наличие тормозящего механизма (drain)."""
        # Наличие расходуемых ресурсов
        has_consumable = any(r.type == "consumable" for r in resources)

        # Наличие механик-дрейнов
        drain_mechanics = {"Запас патронов", "Мана", "Голод", "Износ", "Ремонт"}
        has_drain_mechanic = any(m in mechanics for m in drain_mechanics)

        return has_consumable or has_drain_mechanic

    def _assess_risk(
        self,
        structural_type: str,
        resources: list[ResourceProfile],
        has_braking: bool,
    ) -> RiskProfile:
        """Оценить риски на основе структурного типа."""
        likely_pathologies = STRUCTURAL_PATHOLOGY_MAP.get(
            structural_type, []
        )

        # Корректируем риски на основе наличия тормозящего механизма
        if has_braking and "runaway" in likely_pathologies:
            likely_pathologies.remove("runaway")
            if "stagnation" not in likely_pathologies:
                likely_pathologies.append("stagnation")

        # Определяем уровень риска
        risk_level = "low"
        if structural_type in ("engine", "hybrid") and not has_braking:
            risk_level = "high"
        elif structural_type == "economy" and len(resources) > 5:
            risk_level = "medium"
        elif len(likely_pathologies) >= 3:
            risk_level = "medium"

        # Предложения по снижению рисков
        mitigation_suggestions = []
        if "runaway" in likely_pathologies:
            mitigation_suggestions.append(
                "Добавить тормозящий механизм (drain) для основных ресурсов"
            )
        if "deadlock" in likely_pathologies:
            mitigation_suggestions.append(
                "Обеспечить начальный запас ресурсов для запуска петли"
            )
        if not has_braking:
            mitigation_suggestions.append(
                "Добавить расходуемый ресурс для предотвращения неограниченного роста"
            )

        return RiskProfile(
            likely_pathologies=likely_pathologies,
            risk_level=risk_level,
            mitigation_suggestions=mitigation_suggestions,
        )

    def _build_initial_loops(
        self,
        structural_type: str,
        mechanics: list[str],
        resources: list[str],
    ) -> list[dict]:
        """Построить начальные профили петель на основе структурного типа."""
        loops = []

        if structural_type in ("engine", "hybrid"):
            loops.append({
                "type": "reinforcing",
                "description": "Основная усиливающая петля",
                "resources_in": resources[:3] if len(resources) >= 3 else resources,
                "resources_out": resources[:3] if len(resources) >= 3 else resources,
            })

        if structural_type in ("ecology", "hybrid"):
            loops.append({
                "type": "balancing",
                "description": "Балансирующая петля",
                "resources_in": resources[1:4] if len(resources) >= 4 else resources,
                "resources_out": resources[0:3] if len(resources) >= 3 else resources,
            })

        if structural_type == "economy":
            loops.append({
                "type": "conversion",
                "description": "Петля конвертации ресурсов",
                "resources_in": resources[:2] if len(resources) >= 2 else resources,
                "resources_out": resources[2:4] if len(resources) >= 4 else resources,
            })

        return loops

    # ========================================================
    # Этап 2: Конструирование иерархии петель (3.2.4)
    # ========================================================

    async def build_loop_hierarchy(
        self,
        structural_type: StructuralType,
        core_loop_steps: list[CoreLoopStep],
        mechanics: list[str],
        genre: str = "rpg",
        custom_steps: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> LoopHierarchy:
        """
        Этап 2: Конструирование иерархии петель.

        Алгоритм 3.2.4:
        1. Micro-петли (мс-секунды) — атомарные действия
        2. Small-петли (1-2 мин) — базовый Core Loop
        3. Medium-петли (5-10 мин) — несколько итераций Core Loop
        4. Large-петли (15-30 мин) — квест/миссия
        5. Macro-петли (часы) — сессия/уровень
        6. Meta-петли (недели-месяцы) — сезон/прогрессия

        Использует AI-промпты:
        - DECOMPOSE_STEP — для декомпозиции шагов на микро-действия
        - GENERATE_OUTER_LOOPS — для outer loops
        - GENERATE_META_LOOP — для meta loop

        Returns:
            LoopHierarchy с 6 уровнями петель
        """
        start = time.time()

        # Если шаги не переданы — генерируем из механик
        if not core_loop_steps:
            core_loop_steps = self._generate_default_steps(mechanics, structural_type)

        # Если есть пользовательские шаги — добавляем их
        if custom_steps:
            for i, step_text in enumerate(custom_steps):
                if i < len(core_loop_steps):
                    core_loop_steps[i].action = step_text
                else:
                    core_loop_steps.append(
                        CoreLoopStep(
                            action=step_text,
                            mechanics=mechanics[:2] if mechanics else [],
                            resources_consumed=[],
                            resources_produced=[],
                            feedback_type="positive",
                            duration_estimate=5.0,
                        )
                    )

        hierarchy = LoopHierarchy()

        # === Уровень 1: Micro-петли (мс-секунды) ===
        hierarchy.micro = await self._build_micro_loops(
            core_loop_steps, project_state
        )

        # === Уровень 2: Small-петли (1-2 мин) — базовый Core Loop ===
        hierarchy.small = self._build_small_loops(core_loop_steps)

        # === Уровень 3: Medium-петли (5-10 мин) ===
        hierarchy.medium = self._build_medium_loops(core_loop_steps, mechanics)

        # === Уровень 4: Large-петли (15-30 мин) ===
        hierarchy.large = await self._build_large_loops(
            core_loop_steps, mechanics, project_state
        )

        # === Уровень 5: Macro-петли (часы) ===
        hierarchy.macro = self._build_macro_loops(core_loop_steps, genre)

        # === Уровень 6: Meta-петли (недели-месяцы) ===
        hierarchy.meta = await self._build_meta_loops(
            core_loop_steps, genre, project_state
        )

        logger.info(
            f"[Stage 2] Loop hierarchy built: "
            f"micro={len(hierarchy.micro)}, small={len(hierarchy.small)}, "
            f"medium={len(hierarchy.medium)}, large={len(hierarchy.large)}, "
            f"macro={len(hierarchy.macro)}, meta={len(hierarchy.meta)} "
            f"({time.time() - start:.2f}s)"
        )
        return hierarchy

    def _generate_default_steps(
        self,
        mechanics: list[str],
        structural_type: StructuralType,
    ) -> list[CoreLoopStep]:
        """Сгенерировать шаги Core Loop по умолчанию из механик."""
        default_actions = [
            ("Найти", "Обнаружить цель / врага / ресурс"),
            ("Действовать", "Выполнить основное действие"),
            ("Получить", "Получить награду / ресурс"),
            ("Решить", "Принять решение о дальнейшем действии"),
            ("Подготовиться", "Подготовиться к следующей итерации"),
        ]

        steps = []
        for i, (action, description) in enumerate(default_actions):
            # Привязываем механики к шагам
            step_mechanics = []
            if i < len(mechanics):
                step_mechanics = [mechanics[i]] if i < len(mechanics) else mechanics[:2]
            elif mechanics:
                step_mechanics = mechanics[:2]

            # Определяем потребляемые и производимые ресурсы
            consumed = []
            produced = []
            if structural_type.resources:
                res_list = structural_type.resources
                if i < len(res_list):
                    produced.append(res_list[i].get("name", ""))
                if i > 0 and i - 1 < len(res_list):
                    consumed.append(res_list[i - 1].get("name", ""))

            steps.append(
                CoreLoopStep(
                    action=action,
                    mechanics=step_mechanics,
                    resources_consumed=[r for r in consumed if r],
                    resources_produced=[r for r in produced if r],
                    feedback_type="positive" if i % 2 == 0 else "neutral",
                    duration_estimate=5.0 + i * 2.0,
                )
            )

        return steps

    async def _build_micro_loops(
        self,
        core_loop_steps: list[CoreLoopStep],
        project_state: Optional[dict] = None,
    ) -> list[LoopProfile]:
        """Построить микро-петли (мс-секунды) через декомпозицию шагов."""
        micro_loops: list[LoopProfile] = []

        for step in core_loop_steps:
            # Пытаемся использовать AI для декомпозиции
            try:
                prompt_result: PromptResult = await self.executor.execute(
                    prompt_id="DECOMPOSE_STEP",
                    inputs={
                        "step": step.model_dump(),
                        "core_loop": {
                            "action": step.action,
                            "mechanics": step.mechanics,
                        },
                    },
                    project_state=project_state,
                    options=PromptExecutionOptions(skip_cache=False),
                )

                decomposed = prompt_result.data
                if isinstance(decomposed, dict) and "actions" in decomposed:
                    actions = decomposed["actions"]
                    if isinstance(actions, list):
                        for action_item in actions:
                            action_name = (
                                action_item.get("action", "")
                                if isinstance(action_item, dict)
                                else str(action_item)
                            )
                            if action_name:
                                micro_loops.append(
                                    LoopProfile(
                                        level="micro",
                                        actions=[action_name],
                                        time_scale="мс-секунды",
                                        parent_step=step.action,
                                    )
                                )
                        continue  # AI сработал, пропускаем fallback
            except Exception as e:
                logger.warning(
                    f"[Stage 2] DECOMPOSE_STEP failed, using fallback: {e}"
                )

            # Fallback: формализованная декомпозиция
            micro_actions = self._decompose_step_formalized(step)
            for action_name in micro_actions:
                micro_loops.append(
                    LoopProfile(
                        level="micro",
                        actions=[action_name],
                        time_scale="мс-секунды",
                        parent_step=step.action,
                    )
                )

        return micro_loops

    def _decompose_step_formalized(self, step: CoreLoopStep) -> list[str]:
        """Формализованная декомпозиция шага на микро-действия."""
        action = step.action.lower()

        # Шаблоны декомпозиции по глаголам действий
        decomposition_templates: dict[str, list[str]] = {
            "найти": ["Осмотреться", "Обнаружить", "Подойти"],
            "действовать": ["Прицелиться", "Выполнить", "Оценить результат"],
            "получить": ["Подобрать", "Подсчитать", "Добавить в инвентарь"],
            "решить": ["Оценить варианты", "Выбрать", "Подтвердить"],
            "подготовиться": ["Проверить ресурсы", "Спланировать", "Обновить экипировку"],
        }

        for key, actions in decomposition_templates.items():
            if key in action:
                return actions

        # Универсальная декомпозиция
        return [
            f"Начать: {step.action}",
            f"Выполнить: {step.action}",
            f"Завершить: {step.action}",
        ]

    def _build_small_loops(
        self,
        core_loop_steps: list[CoreLoopStep],
    ) -> list[LoopProfile]:
        """Построить малые петли (1-2 мин) — базовый Core Loop."""
        if not core_loop_steps:
            return []

        return [
            LoopProfile(
                level="small",
                actions=[s.action for s in core_loop_steps],
                time_scale="1-2 мин",
            )
        ]

    def _build_medium_loops(
        self,
        core_loop_steps: list[CoreLoopStep],
        mechanics: list[str],
    ) -> list[LoopProfile]:
        """Построить средние петли (5-10 мин) — несколько итераций Core Loop."""
        actions = [s.action for s in core_loop_steps]

        # Medium loop = 3-5 итераций small loop + бонусное действие
        medium_actions = []
        for i in range(3):
            medium_actions.extend([f"{a} (итерация {i+1})" for a in actions[:3]])

        # Добавляем завершающее действие
        medium_actions.append("Получить промежуточную награду")

        return [
            LoopProfile(
                level="medium",
                actions=medium_actions,
                time_scale="5-10 мин",
            )
        ]

    async def _build_large_loops(
        self,
        core_loop_steps: list[CoreLoopStep],
        mechanics: list[str],
        project_state: Optional[dict] = None,
    ) -> list[LoopProfile]:
        """Построить большие петли (15-30 мин) через GENERATE_OUTER_LOOPS."""
        # Пытаемся использовать AI
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="GENERATE_OUTER_LOOPS",
                inputs={
                    "core_loop": {
                        "steps": [s.model_dump() for s in core_loop_steps],
                        "mechanics": mechanics,
                    },
                    "mechanics": mechanics,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            outer_loops_data = prompt_result.data
            if isinstance(outer_loops_data, list):
                large_loops = []
                for i, loop_data in enumerate(outer_loops_data):
                    outer_loop = (
                        loop_data.get("outer_loop", loop_data)
                        if isinstance(loop_data, dict)
                        else {}
                    )
                    actions = outer_loop.get("actions", outer_loop.get("steps", []))
                    if isinstance(actions, list) and actions:
                        large_loops.append(
                            LoopProfile(
                                level="large",
                                actions=[
                                    a if isinstance(a, str) else str(a)
                                    for a in actions
                                ],
                                time_scale="15-30 мин",
                            )
                        )
                if large_loops:
                    return large_loops

        except Exception as e:
            logger.warning(
                f"[Stage 2] GENERATE_OUTER_LOOPS failed, using fallback: {e}"
            )

        # Fallback: формализованные outer loops
        return self._build_large_loops_fallback(core_loop_steps, mechanics)

    def _build_large_loops_fallback(
        self,
        core_loop_steps: list[CoreLoopStep],
        mechanics: list[str],
    ) -> list[LoopProfile]:
        """Fallback для больших петель."""
        large_loops = []

        # Петля прогрессии
        progression_actions = [
            "Принять квест/задание",
            "Выполнить серию Core Loop итераций",
            "Получить ключевую награду",
            "Разблокировать новый контент",
        ]
        large_loops.append(
            LoopProfile(
                level="large",
                actions=progression_actions,
                time_scale="15-30 мин",
            )
        )

        # Петля улучшений (если есть соответствующие механики)
        upgrade_mechanics = {"Крафт", "Обмундирование", "Прокачка оружия", "Древо технологий"}
        if any(m in mechanics for m in upgrade_mechanics):
            upgrade_actions = [
                "Собрать ресурсы для улучшения",
                "Принять решение об улучшении",
                "Выполнить улучшение",
                "Оценить результат",
            ]
            large_loops.append(
                LoopProfile(
                    level="large",
                    actions=upgrade_actions,
                    time_scale="15-30 мин",
                )
            )

        return large_loops

    def _build_macro_loops(
        self,
        core_loop_steps: list[CoreLoopStep],
        genre: str,
    ) -> list[LoopProfile]:
        """Построить макро-петли (часы) — сессия/уровень."""
        macro_actions = [
            "Начать игровую сессию",
            "Выполнить серию квестов/миссий",
            "Достичь промежуточной цели",
            "Получить уровневую награду",
            "Завершить сессию с прогрессом",
        ]

        # Жанровая специализация
        if genre in ("mmorpg", "rpg", "action_rpg"):
            macro_actions = [
                "Войти в мир",
                "Выполнить цепочку квестов",
                "Получить новый уровень",
                "Разблокировать новые способности",
                "Оценить прогресс и спланировать следующую сессию",
            ]
        elif genre in ("strategy", "rts", "tbs"):
            macro_actions = [
                "Начать кампанию/сценарий",
                "Построить экономику",
                "Исследовать технологии",
                "Вести войну/дипломатию",
                "Достичь победы или поражения",
            ]
        elif genre in ("roguelike",):
            macro_actions = [
                "Начать забег",
                "Пройти серию комнат/этажей",
                "Собрать лут и усилиться",
                "Встретить босса",
                "Умереть или победить (получить мета-прогресс)",
            ]

        return [
            LoopProfile(
                level="macro",
                actions=macro_actions,
                time_scale="часы",
            )
        ]

    async def _build_meta_loops(
        self,
        core_loop_steps: list[CoreLoopStep],
        genre: str,
        project_state: Optional[dict] = None,
    ) -> list[LoopProfile]:
        """Построить мета-петли (недели-месяцы) через GENERATE_META_LOOP."""
        # Пытаемся использовать AI
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="GENERATE_META_LOOP",
                inputs={
                    "outer_loops": [
                        {"level": "large", "actions": [s.action for s in core_loop_steps]},
                    ],
                    "genre": genre,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            meta_data = prompt_result.data
            if isinstance(meta_data, dict):
                meta_loop = meta_data.get("meta_loop", meta_data)
                actions = meta_loop.get("actions", meta_loop.get("steps", []))
                if isinstance(actions, list) and actions:
                    return [
                        LoopProfile(
                            level="meta",
                            actions=[
                                a if isinstance(a, str) else str(a)
                                for a in actions
                            ],
                            time_scale="недели-месяцы",
                        )
                    ]

        except Exception as e:
            logger.warning(
                f"[Stage 2] GENERATE_META_LOOP failed, using fallback: {e}"
            )

        # Fallback: формализованная мета-петля
        meta_actions = self._build_meta_loops_fallback(genre)
        return [
            LoopProfile(
                level="meta",
                actions=meta_actions,
                time_scale="недели-месяцы",
            )
        ]

    def _build_meta_loops_fallback(self, genre: str) -> list[str]:
        """Fallback для мета-петель."""
        meta_templates: dict[str, list[str]] = {
            "mmorpg": [
                "Сезонные события и обновления",
                "Рейд-прогрессия",
                "Рейтинг PvP",
                "Гильдейские цели",
            ],
            "rpg": [
                "Новый контент (DLC/обновления)",
                "Достижение конца игры",
                "New Game+",
                "Коллекционирование",
            ],
            "roguelike": [
                "Мета-прогресс (разблокировки)",
                "Еженедельные испытания",
                "Достижение финального босса",
                "Сбор всех секретов",
            ],
            "strategy": [
                "Сезонные лиги",
                "Новые сценарии",
                "Рейтинг игроков",
                "Модификации сообщества",
            ],
        }

        return meta_templates.get(
            genre,
            [
                "Сезонный контент",
                "Долгосрочная прогрессия",
                "Социальные цели",
                "Коллекционирование",
            ],
        )

    # ========================================================
    # Этап 3: Диагностика патологий (3.2.5)
    # ========================================================

    async def diagnose_pathologies(
        self,
        structural_type: StructuralType,
        core_loop_steps: list[CoreLoopStep],
        loop_hierarchy: Optional[LoopHierarchy] = None,
        project_state: Optional[dict] = None,
    ) -> tuple[PathologyReport, list[dict]]:
        """
        Этап 3: Диагностика патологий Core Loop.

        Алгоритм 3.2.5:
        1. Проверка 7 патологий по формализованным правилам
        2. AI-обогащение диагностики
        3. Генерация рекомендаций через GENERATE_RECOMMENDATIONS

        Патологии:
        - Runaway — бесконечный рост ресурса
        - Deadlock — замкнутый тупик
        - Stall — петля останавливается
        - Brittleness — хрупкость
        - Oscillation — колебание
        - Stagnation — стагнация
        - Triviality — тривиальность

        Returns:
            (PathologyReport, list[dict]) — отчёт по патологиям и рекомендации
        """
        start = time.time()

        # 1. Формализованная проверка патологий
        detected_pathologies: list[Pathology] = []

        # Runaway
        runaway = self._check_runaway(structural_type, core_loop_steps)
        if runaway:
            detected_pathologies.append(runaway)

        # Deadlock
        deadlock = self._check_deadlock(structural_type, core_loop_steps)
        if deadlock:
            detected_pathologies.append(deadlock)

        # Stall
        stall = self._check_stall(structural_type, core_loop_steps)
        if stall:
            detected_pathologies.append(stall)

        # Brittleness
        brittleness = self._check_brittleness(structural_type, core_loop_steps)
        if brittleness:
            detected_pathologies.append(brittleness)

        # Oscillation
        oscillation = self._check_oscillation(structural_type, core_loop_steps)
        if oscillation:
            detected_pathologies.append(oscillation)

        # Stagnation
        stagnation = self._check_stagnation(structural_type, core_loop_steps)
        if stagnation:
            detected_pathologies.append(stagnation)

        # Triviality
        triviality = self._check_triviality(structural_type, core_loop_steps)
        if triviality:
            detected_pathologies.append(triviality)

        # 2. AI-обогащение — расширяем диагностику
        try:
            ai_pathologies = await self._ai_enrich_pathologies(
                structural_type, core_loop_steps, project_state
            )
            # Добавляем только новые патологии (не дублируем)
            existing_types = {p.type for p in detected_pathologies}
            for ap in ai_pathologies:
                if ap.type not in existing_types:
                    detected_pathologies.append(ap)
                    existing_types.add(ap.type)
        except Exception as e:
            logger.warning(
                f"[Stage 3] AI pathology enrichment failed: {e}"
            )

        # 3. Генерация рекомендаций
        recommendations = await self._generate_recommendations(
            detected_pathologies, structural_type, core_loop_steps, project_state
        )

        # Считаем метрики
        critical_count = sum(
            1 for p in detected_pathologies if p.severity == "critical"
        )

        report = PathologyReport(
            pathologies=detected_pathologies,
            total_count=len(detected_pathologies),
            critical_count=critical_count,
        )

        logger.info(
            f"[Stage 3] Pathologies diagnosed: "
            f"{len(detected_pathologies)} total, {critical_count} critical "
            f"({time.time() - start:.2f}s)"
        )
        return report, recommendations

    def _check_runaway(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Runaway — бесконечный рост ресурса."""
        rule = PATHOLOGY_RULES["runaway"]

        # Условие: усиливающая петля без торможения и без верхней границы
        if structural_type.type == "engine" and not structural_type.has_braking:
            affected = []
            for res in structural_type.resources:
                bounds = res.get("bounds", {})
                max_val = bounds.get("max", 0)
                if max_val > 10000:  # Очень высокая верхняя граница
                    affected.append(res.get("name", "unknown"))

            if not affected and structural_type.resources:
                affected = [structural_type.resources[0].get("name", "основной ресурс")]

            return Pathology(
                name=rule["name"],
                type="runaway",
                severity=rule["default_severity"],
                affected_resources=affected,
                description=rule["description"],
                correction=rule["correction"],
            )

        return None

    def _check_deadlock(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Deadlock — замкнутый тупик."""
        rule = PATHOLOGY_RULES["deadlock"]

        # Условие: конвертация ресурсов без начального источника
        if structural_type.type == "economy":
            # Проверяем: все ли ресурсы имеют начальное значение > 0
            zero_initial = []
            for res in structural_type.resources:
                if res.get("initial_value", 0) == 0:
                    zero_initial.append(res.get("name", "unknown"))

            if len(zero_initial) >= 2:
                return Pathology(
                    name=rule["name"],
                    type="deadlock",
                    severity=rule["default_severity"],
                    affected_resources=zero_initial,
                    description=rule["description"],
                    correction=rule["correction"],
                )

        return None

    def _check_stall(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Stall — остановка петли."""
        rule = PATHOLOGY_RULES["stall"]

        # Условие: потребляемый ресурс без источника пополнения
        consumed_resources = set()
        produced_resources = set()

        for step in steps:
            for r in step.resources_consumed:
                consumed_resources.add(r)
            for r in step.resources_produced:
                produced_resources.add(r)

        # Ресурсы, которые потребляются, но не производятся
        stalled = consumed_resources - produced_resources
        # Исключаем начальные ресурсы (они могут пополняться извне)
        stalled -= {r.get("name", "") for r in structural_type.resources if r.get("initial_value", 0) > 0}

        if stalled:
            return Pathology(
                name=rule["name"],
                type="stall",
                severity=rule["default_severity"],
                affected_resources=list(stalled),
                description=rule["description"],
                correction=rule["correction"],
            )

        return None

    def _check_brittleness(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Brittleness — хрупкость."""
        rule = PATHOLOGY_RULES["brittleness"]

        # Условие: только один путь прохождения петли
        if len(steps) <= 2 and structural_type.type in ("ecology", "hybrid"):
            return Pathology(
                name=rule["name"],
                type="brittleness",
                severity=rule["default_severity"],
                affected_resources=[
                    r.get("name", "")
                    for r in structural_type.resources[:3]
                ],
                description=rule["description"],
                correction=rule["correction"],
            )

        return None

    def _check_oscillation(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Oscillation — колебание."""
        rule = PATHOLOGY_RULES["oscillation"]

        # Условие: смешанные петли без демпфирования
        has_positive = any(s.feedback_type == "positive" for s in steps)
        has_negative = any(s.feedback_type == "negative" for s in steps)

        if has_positive and has_negative and not structural_type.has_braking:
            return Pathology(
                name=rule["name"],
                type="oscillation",
                severity=rule["default_severity"],
                affected_resources=[
                    r.get("name", "")
                    for r in structural_type.resources[:2]
                ],
                description=rule["description"],
                correction=rule["correction"],
            )

        return None

    def _check_stagnation(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Stagnation — стагнация."""
        rule = PATHOLOGY_RULES["stagnation"]

        # Условие: ecology с торможением → возможна стагнация
        if structural_type.type == "ecology" and structural_type.has_braking:
            return Pathology(
                name=rule["name"],
                type="stagnation",
                severity=rule["default_severity"],
                affected_resources=[
                    r.get("name", "")
                    for r in structural_type.resources[:2]
                ],
                description=rule["description"],
                correction=rule["correction"],
            )

        # Engine с торможением → тоже возможна стагнация
        if structural_type.type == "engine" and structural_type.has_braking and len(steps) <= 3:
            return Pathology(
                name=rule["name"],
                type="stagnation",
                severity="info",
                affected_resources=[
                    r.get("name", "")
                    for r in structural_type.resources[:2]
                ],
                description=rule["description"],
                correction=rule["correction"],
            )

        return None

    def _check_triviality(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
    ) -> Optional[Pathology]:
        """Проверить на Triviality — тривиальность."""
        rule = PATHOLOGY_RULES["triviality"]

        # Условие: один ресурс, одно действие
        unique_resources = set()
        for step in steps:
            unique_resources.update(step.resources_consumed)
            unique_resources.update(step.resources_produced)

        unique_actions = set(s.action for s in steps)

        if len(unique_resources) <= 1 and len(unique_actions) <= 2:
            return Pathology(
                name=rule["name"],
                type="triviality",
                severity=rule["default_severity"],
                affected_resources=list(unique_resources),
                description=rule["description"],
                correction=rule["correction"],
            )

        return None

    async def _ai_enrich_pathologies(
        self,
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
        project_state: Optional[dict] = None,
    ) -> list[Pathology]:
        """AI-обогащение диагностики патологий."""
        try:
            # Используем DECOMPOSE_STEP для проверки структуры шагов
            for step in steps[:3]:  # Проверяем первые 3 шага
                await self.executor.execute(
                    prompt_id="DECOMPOSE_STEP",
                    inputs={
                        "step": step.model_dump(),
                        "core_loop": {
                            "structural_type": structural_type.type,
                            "resources": structural_type.resources,
                        },
                    },
                    project_state=project_state,
                    options=PromptExecutionOptions(skip_cache=True),
                )

            # В текущей реализации не добавляем дополнительных патологий от AI,
            # но сохраняем возможность для будущего расширения
            return []

        except Exception as e:
            logger.warning(f"[Stage 3] AI pathology enrichment failed: {e}")
            return []

    async def _generate_recommendations(
        self,
        pathologies: list[Pathology],
        structural_type: StructuralType,
        steps: list[CoreLoopStep],
        project_state: Optional[dict] = None,
    ) -> list[dict]:
        """Генерация рекомендаций на основе обнаруженных патологий."""
        recommendations: list[dict] = []

        # Для каждой патологии генерируем рекомендации
        for pathology in pathologies:
            # Сначала добавляем формализованную рекомендацию
            recommendations.append({
                "pathology": pathology.type,
                "recommendation": pathology.correction,
                "priority": "critical" if pathology.severity == "critical" else "high",
                "source": "formalized",
            })

            # Пытаемся получить AI-рекомендации
            try:
                prompt_result: PromptResult = await self.executor.execute(
                    prompt_id="GENERATE_RECOMMENDATIONS",
                    inputs={
                        "pathology": pathology.name,
                        "core_loop": {
                            "structural_type": structural_type.type,
                            "steps": [s.model_dump() for s in steps],
                            "affected_resources": pathology.affected_resources,
                        },
                    },
                    project_state=project_state,
                    options=PromptExecutionOptions(skip_cache=False),
                )

                ai_recs = prompt_result.data
                if isinstance(ai_recs, list):
                    for rec in ai_recs:
                        if isinstance(rec, dict):
                            recommendations.append({
                                "pathology": pathology.type,
                                "recommendation": rec.get("recommendation", ""),
                                "priority": rec.get("priority", "medium"),
                                "source": "ai",
                            })

            except Exception as e:
                logger.warning(
                    f"[Stage 3] GENERATE_RECOMMENDATIONS failed for "
                    f"{pathology.type}: {e}"
                )

        # Добавляем общие рекомендации, если нет критических патологий
        if not pathologies:
            recommendations.append({
                "pathology": "none",
                "recommendation": "Core Loop выглядит здоровым. Рекомендуется прототипирование для валидации.",
                "priority": "low",
                "source": "system",
            })

        return recommendations

    # ========================================================
    # Полный пайплайн: Этапы 1–3
    # ========================================================

    async def design_full(
        self,
        mechanics: list[str],
        concept_data: Optional[dict] = None,
        genre: str = "rpg",
        desired_loop_type: Optional[str] = None,
        custom_steps: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> CoreLoopProfile:
        """
        Полный пайплайн проектирования Core Loop — Этапы 1–3 алгоритма 3.2.

        Выполняет последовательно:
        1. Классификацию структурного типа
        2. Конструирование иерархии петель
        3. Диагностику патологий

        Returns:
            CoreLoopProfile с результатами всех трёх этапов
        """
        pipeline_start = time.time()

        # === Этап 1: Классификация ===
        structural_type = await self.classify_core_loop(
            mechanics=mechanics,
            concept_data=concept_data,
            genre=genre,
            desired_loop_type=desired_loop_type,
            project_state=project_state,
        )

        # Генерируем шаги Core Loop
        core_loop_steps = self._generate_default_steps(mechanics, structural_type)

        # === Этап 2: Иерархия петель ===
        loop_hierarchy = await self.build_loop_hierarchy(
            structural_type=structural_type,
            core_loop_steps=core_loop_steps,
            mechanics=mechanics,
            genre=genre,
            custom_steps=custom_steps,
            project_state=project_state,
        )

        # Обновляем шаги на основе иерархии (берём из small loop)
        if loop_hierarchy.small:
            small_loop = loop_hierarchy.small[0]
            # Пересоздаём шаги из small loop
            updated_steps = []
            for i, action in enumerate(small_loop.actions):
                # Находим соответствующий шаг или создаём новый
                matching_step = next(
                    (s for s in core_loop_steps if s.action == action),
                    None,
                )
                if matching_step:
                    updated_steps.append(matching_step)
                else:
                    updated_steps.append(
                        CoreLoopStep(
                            action=action,
                            mechanics=mechanics[:2] if mechanics else [],
                            resources_consumed=[],
                            resources_produced=[],
                            feedback_type="positive",
                            duration_estimate=5.0,
                        )
                    )
            core_loop_steps = updated_steps

        # === Этап 3: Диагностика патологий ===
        pathology_report, recommendations = await self.diagnose_pathologies(
            structural_type=structural_type,
            core_loop_steps=core_loop_steps,
            loop_hierarchy=loop_hierarchy,
            project_state=project_state,
        )

        # Формируем inner_loops, outer_loops, meta_loop из иерархии
        inner_loops = [
            lp.model_dump() for lp in loop_hierarchy.micro + loop_hierarchy.small
        ]
        outer_loops = [
            lp.model_dump()
            for lp in loop_hierarchy.medium + loop_hierarchy.large + loop_hierarchy.macro
        ]
        meta_loop = None
        if loop_hierarchy.meta:
            meta_loop = loop_hierarchy.meta[0].model_dump()

        profile = CoreLoopProfile(
            structural_type=structural_type,
            steps=core_loop_steps,
            inner_loops=inner_loops,
            outer_loops=outer_loops,
            meta_loop=meta_loop,
            pathologies=pathology_report,
            recommendations=recommendations,
            loop_hierarchy=loop_hierarchy,
        )

        latency_ms = int((time.time() - pipeline_start) * 1000)
        logger.info(
            f"[Pipeline 1-3] Core Loop design completed in {latency_ms}ms. "
            f"Type: {structural_type.type}/{structural_type.sub_type}, "
            f"Steps: {len(core_loop_steps)}, "
            f"Pathologies: {pathology_report.total_count} "
            f"({pathology_report.critical_count} critical)"
        )

        return profile
