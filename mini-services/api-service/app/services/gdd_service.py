"""
Gidede — GDD Service
Фаза 4.D.1: Блок 6 — GDD Generator (алгоритм 3.7, Этапы 1–3)

Реализация пайплайна генерации GDD из алгоритма 3.7:
- Этап 1: Определение формата GDD → GDDFormatSpec (3.7.3)
  • Если targetFormat задан — используем его
  • Иначе — эвристика по audience и project stage
  • Маппинг audience → format (investor→treatment, team_sync→sketch_design, production→full_gdd, personal→modular, educational→ten_pager)
  • Маппинг project stage → format (concept→one_sheet, prototype→ten_pager, preproduction→sketch_design, production→full_gdd, live_ops→modular)
  • Определение detail_level по жанру
  • Шаблоны секций для 8 форматов
  • Оценка количества страниц

- Этап 2: Маппинг Project State → секции GDD → GDDDataMapping (3.7.4)
  • 38 секций в 8 блоках, маппинг на данные Project State
  • Фильтрация маппингов по активным секциям формата
  • Проверка готовности каждой секции
  • Расчёт coverage_score

- Этап 3: Автозаполнение секций → AutoFilledSections (3.7.5)
  • Детерминированное извлечение данных из Project State
  • Форматирование контента в Markdown
  • Диаграммы, таблицы, формулы

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry)
Примечание: Этапы 1–3 не используют AI-вызовы (детерминированные)
"""

import time
import logging
from typing import Any, Optional

from app.ai.executor import PromptExecutor

from app.schemas.gdd import (
    GDDFormat,
    DocAudience,
    DetailLevel,
    GDDFormatSpec,
    SectionMapping,
    SectionReadiness,
    GDDDataMapping,
    SectionContent,
    AutoFilledSections,
    GDDGenerationInput,
    GDDProfile,
)

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.7
# ============================================================

# Аудитория → формат GDD (алгоритм 3.7.3)
AUDIENCE_FORMAT_MAP: dict[str, str] = {
    "investor": "treatment",
    "team_sync": "sketch_design",
    "production": "full_gdd",
    "personal": "modular",
    "educational": "ten_pager",
}

# Стадия проекта → формат GDD (алгоритм 3.7.3)
STAGE_FORMAT_MAP: dict[str, str] = {
    "concept": "one_sheet",
    "prototype": "ten_pager",
    "preproduction": "sketch_design",
    "production": "full_gdd",
    "live_ops": "modular",
}

# Жанр → уровень детализации (алгоритм 3.7.3)
GENRE_DETAIL_MAP: dict[str, str] = {
    "rpg": "detailed",
    "mmorpg": "exhaustive",
    "strategy": "detailed",
    "tbs": "detailed",
    "rts": "detailed",
    "simulation": "detailed",
    "survival": "detailed",
    "sandbox": "standard",
    "action": "standard",
    "shooter": "standard",
    "fighting": "standard",
    "racing": "standard",
    "metroidvania": "standard",
    "roguelike": "standard",
    "adventure": "standard",
    "horror": "standard",
    "puzzle": "overview",
    "casual": "overview",
    "idle": "overview",
    "party": "overview",
    "educational": "overview",
    "visual_novel": "standard",
    "platformer": "standard",
    "rhythm": "overview",
    "tower_defense": "standard",
}

# Формат → количество страниц (базовое, модифицируется detail_level)
FORMAT_BASE_PAGES: dict[str, int] = {
    "one_sheet": 1,
    "ten_pager": 10,
    "treatment": 3,
    "sketch_design": 15,
    "full_gdd": 50,
    "concept_doc": 8,
    "narrative_bible": 30,
    "modular": 40,
}

# Detail level → множитель страниц
DETAIL_PAGE_MULTIPLIER: dict[str, float] = {
    "overview": 0.5,
    "standard": 1.0,
    "detailed": 1.5,
    "exhaustive": 2.5,
}

# ============================================================
# Шаблоны секций для 8 форматов (алгоритм 3.7.3)
# ============================================================

FORMAT_SECTION_TEMPLATES: dict[str, list[str]] = {
    "one_sheet": [
        "title", "logline", "genre_platform", "target_audience",
        "uniqueness", "visual_hook",
    ],
    "ten_pager": [
        "title_logline", "overview", "core_loop", "mechanics",
        "world_structure", "target_audience", "monetization",
        "milestones_budget", "risks", "team",
    ],
    "treatment": [
        "title", "game_type", "originality", "feasibility",
    ],
    "sketch_design": [
        "mechanics", "level_design", "progression", "hud_ui",
        "content_overview",
    ],
    "full_gdd": [
        # Block 1 (Overview)
        "title", "overview", "genre_platform", "target_audience",
        "uniqueness", "license",
        # Block 2 (Gameplay)
        "core_loop", "controls", "mechanics", "camera_perspective",
        "progression", "balance", "difficulty", "game_modes",
        # Block 3 (Characters/Narrative)
        "characters", "story", "dialogues", "quests", "lore",
        # Block 4 (Levels/World)
        "world_structure", "level_design", "navigation", "combat_spaces",
        # Block 5 (Economy/Progression)
        "resources", "economy", "tech_tree", "difficulty_curve",
        # Block 6 (UI/Visual)
        "hud_ui", "menus", "visual_style", "sound_music",
        # Block 7 (Multiplayer/Social)
        "multiplayer_modes", "social_features", "meta_game",
        # Block 8 (Technical/Business)
        "tech_requirements", "platform_ports", "monetization", "milestones_budget",
    ],
    "concept_doc": [
        "player_experience_goal", "core_loop", "mechanics",
        "system_map", "feedback_patterns", "success_metrics",
    ],
    "narrative_bible": [
        "logline", "story", "lore", "characters", "storyline_map",
        "cutscene_scripts", "dialogues", "quest_matrix", "lore_db",
        "dissension_validator", "pitch_deck",
    ],
    "modular": [
        "concept_overview", "core_loop", "mda_analysis",
        "balance_tables", "progression_curves", "economy_model",
        "world_structure", "character_profiles", "narrative_arc",
        "ui_wireframes", "technical_specs", "monetization", "checklist_results",
    ],
}

# ============================================================
# Маппинг секций → источники данных (алгоритм 3.7.4)
# 38 секций в 8 блоках
# ============================================================

SECTION_DATA_MAP: dict[str, SectionMapping] = {
    # ── Block 1 (Overview) ──────────────────────────────────
    "title": SectionMapping(
        source="concept.title", auto_fill=True, ai_enrich=False,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "overview": SectionMapping(
        source="concept.description", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "genre_platform": SectionMapping(
        source="concept.genre+concept.platforms", auto_fill=True, ai_enrich=False,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "target_audience": SectionMapping(
        source="concept.targetAudience", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "uniqueness": SectionMapping(
        source="concept.usp", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "license": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=False, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    # ── Block 2 (Gameplay) ──────────────────────────────────
    "core_loop": SectionMapping(
        source="coreLoop", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=False, formulas=False,
    ),
    "controls": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "mechanics": SectionMapping(
        source="mdaProfile.mechanicSet", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "camera_perspective": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "progression": SectionMapping(
        source="progressionProfile", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=True, formulas=True,
    ),
    "balance": SectionMapping(
        source="balanceResult", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=True, formulas=True,
    ),
    "difficulty": SectionMapping(
        source="progressionProfile.curves.difficulty", auto_fill=True, ai_enrich=False,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=True, tables=False, formulas=True,
    ),
    "game_modes": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    # ── Block 3 (Characters/Narrative) ──────────────────────
    "characters": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "story": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "dialogues": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "quests": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "lore": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    # ── Block 4 (Levels/World) ──────────────────────────────
    "world_structure": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "level_design": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "navigation": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "combat_spaces": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    # ── Block 5 (Economy/Progression) ───────────────────────
    "resources": SectionMapping(
        source="economyProfile.inventory", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "economy": SectionMapping(
        source="economyProfile", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=True, formulas=True,
    ),
    "tech_tree": SectionMapping(
        source="progressionProfile.contentPlan.unlockTree", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=True, tables=True, formulas=False,
    ),
    "difficulty_curve": SectionMapping(
        source="progressionProfile.curves.difficulty", auto_fill=True, ai_enrich=False,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=False, formulas=True,
    ),
    # ── Block 6 (UI/Visual) ─────────────────────────────────
    "hud_ui": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "menus": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "visual_style": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "sound_music": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    # ── Block 7 (Multiplayer/Social) ────────────────────────
    "multiplayer_modes": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "social_features": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "meta_game": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    # ── Block 8 (Technical/Business) ────────────────────────
    "tech_requirements": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "platform_ports": SectionMapping(
        source="concept.platforms", auto_fill=True, ai_enrich=False,
        ai_generate=False, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "monetization": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "milestones_budget": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    # ── Специфичные секции для форматов ─────────────────────
    "logline": SectionMapping(
        source="concept.description", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "visual_hook": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "title_logline": SectionMapping(
        source="concept.title+concept.description", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "game_type": SectionMapping(
        source="concept.genre", auto_fill=True, ai_enrich=False,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "originality": SectionMapping(
        source="concept.usp", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "feasibility": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "content_overview": SectionMapping(
        source="progressionProfile.contentPlan", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "player_experience_goal": SectionMapping(
        source="mdaProfile.aesthetics", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "system_map": SectionMapping(
        source="coreLoop+mdaProfile.mechanicSet", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=False, formulas=False,
    ),
    "feedback_patterns": SectionMapping(
        source="coreLoop.loops", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=True, tables=False, formulas=False,
    ),
    "success_metrics": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "storyline_map": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "cutscene_scripts": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=False, formulas=False,
    ),
    "quest_matrix": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "lore_db": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "dissension_validator": SectionMapping(
        source="mdaProfile", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "pitch_deck": SectionMapping(
        source="concept", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=True, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "risks": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "team": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=False, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    # ── Modular-специфичные секции ──────────────────────────
    "concept_overview": SectionMapping(
        source="concept", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=False, formulas=False,
    ),
    "mda_analysis": SectionMapping(
        source="mdaProfile", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=True, formulas=False,
    ),
    "balance_tables": SectionMapping(
        source="balanceResult", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=False, tables=True, formulas=True,
    ),
    "progression_curves": SectionMapping(
        source="progressionProfile.curves", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=True, formulas=True,
    ),
    "economy_model": SectionMapping(
        source="economyProfile", auto_fill=True, ai_enrich=True,
        ai_generate=False, ai_suggest=False, manual=False,
        diagram=True, tables=True, formulas=True,
    ),
    "character_profiles": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "narrative_arc": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "ui_wireframes": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=True, tables=False, formulas=False,
    ),
    "technical_specs": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
    "checklist_results": SectionMapping(
        source="", auto_fill=False, ai_enrich=False,
        ai_generate=True, ai_suggest=True, manual=True,
        diagram=False, tables=True, formulas=False,
    ),
}


# ============================================================
# GDD Service
# ============================================================

class GDDService:
    """
    Блок 6: Генератор GDD.
    Реализует алгоритм 3.7 — Этапы 1–3.

    Методы:
    - determine_gdd_format() — Этап 1: определение формата GDD
    - map_project_to_sections() — Этап 2: маппинг Project State → секции
    - generate_auto_sections() — Этап 3: автозаполнение секций
    - generate_stages_1_3() — полный пайплайн Этапов 1–3
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Определение формата GDD (3.7.3)
    # ========================================================

    async def determine_gdd_format(
        self,
        input_data: GDDGenerationInput,
    ) -> GDDFormatSpec:
        """
        Этап 1: Определение формата GDD на основе входных данных.

        Алгоритм 3.7.3:
        1. Если targetFormat указан → используем его
        2. Иначе → эвристика по audience и project stage
        3. Определяем detail_level по жанру
        4. Определяем секции по формату
        5. Оцениваем количество страниц

        Returns:
            GDDFormatSpec с форматом, секциями и оценкой страниц
        """
        start = time.time()

        # === Шаг 1.1: Определение формата ===
        target_format = input_data.target_format

        if not target_format:
            # Эвристика: audience имеет приоритет
            if input_data.target_audience_doc:
                target_format = AUDIENCE_FORMAT_MAP.get(
                    input_data.target_audience_doc, "full_gdd"
                )
                logger.info(
                    f"[Stage 1.1] Format from audience "
                    f"'{input_data.target_audience_doc}': {target_format}"
                )
            elif input_data.project_stage:
                target_format = STAGE_FORMAT_MAP.get(
                    input_data.project_stage, "full_gdd"
                )
                logger.info(
                    f"[Stage 1.1] Format from project stage "
                    f"'{input_data.project_stage}': {target_format}"
                )
            else:
                target_format = "full_gdd"
                logger.info("[Stage 1.1] Default format: full_gdd")

        # === Шаг 1.2: Определение уровня детализации ===
        detail_level = input_data.detail_level

        if not detail_level:
            genre = ""
            if input_data.concept:
                genre = input_data.concept.get("genre", "").lower()

            if genre:
                detail_level = GENRE_DETAIL_MAP.get(genre, "standard")
                logger.info(
                    f"[Stage 1.2] Detail level from genre '{genre}': {detail_level}"
                )
            else:
                detail_level = "standard"
                logger.info("[Stage 1.2] Default detail level: standard")

        # === Шаг 1.3: Определение секций ===
        sections = list(FORMAT_SECTION_TEMPLATES.get(target_format, []))

        # Добавляем пользовательские секции
        if input_data.custom_sections:
            for section in input_data.custom_sections:
                if section not in sections:
                    sections.append(section)

        # Удаляем исключённые секции
        if input_data.excluded_sections:
            sections = [
                s for s in sections
                if s not in input_data.excluded_sections
            ]

        # === Шаг 1.4: Оценка страниц ===
        base_pages = FORMAT_BASE_PAGES.get(target_format, 20)
        page_multiplier = DETAIL_PAGE_MULTIPLIER.get(detail_level, 1.0)
        estimated_pages = max(1, int(base_pages * page_multiplier))

        # === Сборка результата ===
        format_spec = GDDFormatSpec(
            format=target_format,
            detail_level=detail_level,
            sections=sections,
            estimated_pages=estimated_pages,
            audience=input_data.target_audience_doc,
        )

        logger.info(
            f"[Stage 1] Format determined: {target_format}, "
            f"detail={detail_level}, sections={len(sections)}, "
            f"pages≈{estimated_pages} ({time.time() - start:.2f}s)"
        )

        return format_spec

    # ========================================================
    # Этап 2: Маппинг Project State → секции GDD (3.7.4)
    # ========================================================

    async def map_project_to_sections(
        self,
        format_spec: GDDFormatSpec,
        input_data: GDDGenerationInput,
    ) -> GDDDataMapping:
        """
        Этап 2: Маппинг Project State → секции GDD.

        Алгоритм 3.7.4:
        1. Фильтруем маппинги по активным секциям из format_spec
        2. Проверяем готовность каждой секции (есть ли данные в input?)
        3. Классифицируем секции: auto_fillable, manual, ai_generatable
        4. Рассчитываем coverage_score

        Returns:
            GDDDataMapping с маппингами, готовностью и покрытием
        """
        start = time.time()

        active_sections = format_spec.sections
        active_mappings: dict[str, SectionMapping] = {}
        section_readiness: dict[str, SectionReadiness] = {}
        auto_fillable_sections: list[str] = []
        manual_sections: list[str] = []
        ai_generatable_sections: list[str] = []

        for section_name in active_sections:
            # Получаем маппинг для секции (или создаём default)
            mapping = SECTION_DATA_MAP.get(
                section_name,
                SectionMapping(
                    source="", auto_fill=False, ai_enrich=False,
                    ai_generate=True, ai_suggest=True, manual=True,
                    diagram=False, tables=False, formulas=False,
                ),
            )
            active_mappings[section_name] = mapping

            # Проверяем готовность секции
            readiness = self._check_section_readiness(
                section_name, mapping, input_data
            )
            section_readiness[section_name] = readiness

            # Классифицируем секцию
            if readiness.status == "ready" and mapping.auto_fill:
                auto_fillable_sections.append(section_name)
            elif readiness.status == "ai_generatable" or mapping.ai_generate:
                ai_generatable_sections.append(section_name)
            elif readiness.status == "ai_suggestable" and mapping.ai_suggest:
                ai_generatable_sections.append(section_name)
            else:
                manual_sections.append(section_name)

        # Рассчитываем coverage_score
        total = len(active_sections)
        auto_count = len(auto_fillable_sections)
        coverage_score = round(auto_count / total, 3) if total > 0 else 0.0

        data_mapping = GDDDataMapping(
            format_spec=format_spec,
            active_mappings=active_mappings,
            section_readiness=section_readiness,
            auto_fillable_sections=auto_fillable_sections,
            manual_sections=manual_sections,
            ai_generatable_sections=ai_generatable_sections,
            coverage_score=coverage_score,
        )

        logger.info(
            f"[Stage 2] Mapping complete: {len(active_mappings)} sections, "
            f"auto_fillable={auto_count}, manual={len(manual_sections)}, "
            f"ai_generatable={len(ai_generatable_sections)}, "
            f"coverage={coverage_score:.2f} ({time.time() - start:.2f}s)"
        )

        return data_mapping

    def _check_section_readiness(
        self,
        section_name: str,
        mapping: SectionMapping,
        input_data: GDDGenerationInput,
    ) -> SectionReadiness:
        """
        Проверка готовности секции на основе наличия данных в input.

        Возвращает:
            SectionReadiness со статусом и уровнем покрытия
        """
        source = mapping.source
        if not source:
            # Нет источника — требуется ручное заполнение или AI
            if mapping.ai_generate:
                return SectionReadiness(
                    status="ai_generatable",
                    coverage=0.0,
                    auto_fillable=False,
                )
            return SectionReadiness(
                status="manual_required",
                coverage=0.0,
                auto_fillable=False,
            )

        # Проверяем наличие данных по источнику
        coverage = self._assess_source_coverage(source, input_data)

        if coverage >= 0.8:
            status = "ready"
            auto_fillable = mapping.auto_fill
        elif coverage >= 0.4:
            status = "ai_suggestable"
            auto_fillable = mapping.auto_fill and coverage >= 0.6
        elif mapping.ai_generate:
            status = "ai_generatable"
            auto_fillable = False
        else:
            status = "manual_required"
            auto_fillable = False

        return SectionReadiness(
            status=status,
            coverage=round(coverage, 3),
            auto_fillable=auto_fillable,
        )

    def _assess_source_coverage(
        self,
        source: str,
        input_data: GDDGenerationInput,
    ) -> float:
        """
        Оценка покрытия данных для источника.

        Проверяет наличие и полноту данных по пути source
        во входных данных (concept, coreLoop, mdaProfile, etc.)
        """
        # Разбиваем source на части (напр. "concept.title" → ["concept", "title"])
        parts = source.split("+")
        total_coverage = 0.0

        for part in parts:
            part = part.strip()
            coverage = self._assess_single_source(part, input_data)
            total_coverage = max(total_coverage, coverage)

        return total_coverage

    def _assess_single_source(
        self,
        source: str,
        input_data: GDDGenerationInput,
    ) -> float:
        """Оценка покрытия для одного источника."""
        path_parts = source.split(".")
        root = path_parts[0]
        sub_path = path_parts[1:] if len(path_parts) > 1 else []

        # Получаем корневой объект
        root_data: Optional[dict] = None
        if root == "concept" and input_data.concept:
            root_data = input_data.concept
        elif root == "coreLoop" and input_data.core_loop:
            root_data = input_data.core_loop
        elif root == "mdaProfile" and input_data.mda_profile:
            root_data = input_data.mda_profile
        elif root == "balanceResult" and input_data.balance_result:
            root_data = input_data.balance_result
        elif root == "progressionProfile" and input_data.progression_profile:
            root_data = input_data.progression_profile
        elif root == "economyProfile" and input_data.economy_profile:
            root_data = input_data.economy_profile

        if root_data is None:
            return 0.0

        # Если нет подпути — корневой объект существует
        if not sub_path:
            # Проверяем что объект не пустой
            if isinstance(root_data, dict) and len(root_data) > 0:
                return 1.0
            return 0.3  # Пустой объект

        # Проходим по подпути
        current = root_data
        for part in sub_path:
            if isinstance(current, dict):
                if part in current:
                    current = current[part]
                else:
                    return 0.2  # Подпуть не найден
            else:
                return 0.1

        # Финальное значение существует
        if current is not None and current != "" and current != []:
            return 1.0
        return 0.3

    # ========================================================
    # Этап 3: Автозаполнение секций (3.7.5)
    # ========================================================

    async def generate_auto_sections(
        self,
        data_mapping: GDDDataMapping,
        input_data: GDDGenerationInput,
    ) -> AutoFilledSections:
        """
        Этап 3: Автозаполнение секций GDD из Project State.

        Алгоритм 3.7.5:
        1. Для каждой auto-fillable секции где данные готовы:
           - Извлечь исходные данные из input
           - Отформатировать как Markdown
        2. Типы форматирования:
           - Текстовые секции → прямое форматирование
           - Секции с диаграммами → текст + markdown-диаграмма
           - Секции с таблицами → markdown-таблица
           - Секции с формулами → форматированные формулы

        Returns:
            AutoFilledSections с заполненными секциями
        """
        start = time.time()

        sections: dict[str, SectionContent] = {}
        auto_fillable = data_mapping.auto_fillable_sections

        for section_name in auto_fillable:
            mapping = data_mapping.active_mappings.get(section_name)
            if not mapping:
                continue

            readiness = data_mapping.section_readiness.get(section_name)
            if not readiness or not readiness.auto_fillable:
                continue

            # Извлекаем и форматируем данные
            content = self._format_section_content(
                section_name, mapping, input_data
            )

            if content:
                sections[section_name] = content

        # Рассчитываем общее покрытие
        total_sections = len(data_mapping.format_spec.sections)
        filled_count = len(sections)
        total_coverage = round(filled_count / total_sections, 3) if total_sections > 0 else 0.0

        result = AutoFilledSections(
            sections=sections,
            count=filled_count,
            total_coverage=total_coverage,
        )

        logger.info(
            f"[Stage 3] Auto-filled: {filled_count}/{total_sections} sections, "
            f"coverage={total_coverage:.2f} ({time.time() - start:.2f}s)"
        )

        return result

    def _format_section_content(
        self,
        section_name: str,
        mapping: SectionMapping,
        input_data: GDDGenerationInput,
    ) -> Optional[SectionContent]:
        """
        Форматирование содержимого секции на основе типа и источника.

        Возвращает SectionContent или None если данных недостаточно
        """
        source = mapping.source
        if not source:
            return None

        # Извлекаем данные из источника
        raw_data = self._extract_source_data(source, input_data)

        if raw_data is None:
            return None

        # Форматируем по типу секции
        formatter = self._get_section_formatter(section_name)
        content_text = formatter(raw_data, section_name, mapping)

        # Обрабатываем дополнительные элементы
        diagram = None
        tables = None
        formulas = None
        requires_review = False

        if mapping.diagram:
            diagram = self._generate_diagram_markdown(section_name, raw_data)

        if mapping.tables:
            tables = self._generate_tables(section_name, raw_data)

        if mapping.formulas:
            formulas = self._extract_formulas(section_name, raw_data)

        # Секции с AI-enrich требуют ревью
        if mapping.ai_enrich:
            requires_review = True

        return SectionContent(
            content=content_text,
            source="auto_fill",
            auto_filled=True,
            diagram=diagram,
            tables=tables,
            formulas=formulas,
            requires_review=requires_review,
        )

    def _extract_source_data(
        self,
        source: str,
        input_data: GDDGenerationInput,
    ) -> Any:
        """Извлечение данных из источника по пути source."""
        # Для составных источников (через +) объединяем
        parts = source.split("+")
        if len(parts) > 1:
            combined = {}
            for part in parts:
                data = self._extract_single_source(part.strip(), input_data)
                if isinstance(data, dict):
                    combined.update(data)
                elif data is not None:
                    combined[part.strip().split(".")[-1]] = data
            return combined if combined else None

        return self._extract_single_source(parts[0].strip(), input_data)

    def _extract_single_source(
        self,
        source: str,
        input_data: GDDGenerationInput,
    ) -> Any:
        """Извлечение данных из одного источника."""
        path_parts = source.split(".")
        root = path_parts[0]
        sub_path = path_parts[1:] if len(path_parts) > 1 else []

        root_data: Optional[dict] = None
        if root == "concept" and input_data.concept:
            root_data = input_data.concept
        elif root == "coreLoop" and input_data.core_loop:
            root_data = input_data.core_loop
        elif root == "mdaProfile" and input_data.mda_profile:
            root_data = input_data.mda_profile
        elif root == "balanceResult" and input_data.balance_result:
            root_data = input_data.balance_result
        elif root == "progressionProfile" and input_data.progression_profile:
            root_data = input_data.progression_profile
        elif root == "economyProfile" and input_data.economy_profile:
            root_data = input_data.economy_profile

        if root_data is None:
            return None

        if not sub_path:
            return root_data

        # Проходим по подпути
        current: Any = root_data
        for part in sub_path:
            if isinstance(current, dict) and part in current:
                current = current[part]
            else:
                return None

        return current

    def _get_section_formatter(self, section_name: str):
        """Получить функцию форматирования для секции."""
        formatters = {
            "title": self._format_text_field,
            "logline": self._format_text_field,
            "overview": self._format_rich_text,
            "genre_platform": self._format_genre_platform,
            "target_audience": self._format_text_field,
            "uniqueness": self._format_text_field,
            "core_loop": self._format_core_loop,
            "mechanics": self._format_mechanics,
            "progression": self._format_progression,
            "balance": self._format_balance,
            "difficulty": self._format_difficulty,
            "resources": self._format_resources,
            "economy": self._format_economy,
            "tech_tree": self._format_tech_tree,
            "difficulty_curve": self._format_difficulty_curve,
            "title_logline": self._format_text_field,
            "game_type": self._format_text_field,
            "originality": self._format_text_field,
            "content_overview": self._format_content_overview,
            "player_experience_goal": self._format_text_field,
            "system_map": self._format_system_map,
            "feedback_patterns": self._format_feedback_patterns,
            "dissension_validator": self._format_dissension,
            "pitch_deck": self._format_pitch_deck,
            "concept_overview": self._format_concept_overview,
            "mda_analysis": self._format_mda_analysis,
            "balance_tables": self._format_balance,
            "progression_curves": self._format_progression,
            "economy_model": self._format_economy,
            "platform_ports": self._format_genre_platform,
            "visual_hook": self._format_text_field,
            "feasibility": self._format_text_field,
            "license": self._format_text_field,
            "success_metrics": self._format_text_field,
        }
        return formatters.get(section_name, self._format_generic)

    # ========================================================
    # Форматтеры секций
    # ========================================================

    def _format_text_field(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование простого текстового поля."""
        if isinstance(data, str):
            return data
        elif isinstance(data, dict):
            # Пытаемся извлечь осмысленный текст
            text_keys = [
                "title", "name", "description", "text", "logline",
                "usp", "value", "content",
            ]
            for key in text_keys:
                if key in data and isinstance(data[key], str):
                    return data[key]
            # Если не нашли — формат как список ключ-значение
            lines = []
            for k, v in data.items():
                if isinstance(v, (str, int, float, bool)):
                    lines.append(f"**{k}**: {v}")
            return "\n".join(lines) if lines else str(data)
        return str(data) if data is not None else ""

    def _format_rich_text(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование расширенного текстового содержимого."""
        if isinstance(data, str):
            return data
        elif isinstance(data, dict):
            lines = []
            # Заголовок если есть
            for title_key in ["title", "name"]:
                if title_key in data and isinstance(data[title_key], str):
                    lines.append(f"## {data[title_key]}")
                    break

            # Описание
            for desc_key in ["description", "overview", "text", "summary"]:
                if desc_key in data and isinstance(data[desc_key], str):
                    lines.append(data[desc_key])
                    break

            # Остальные поля как список
            skip_keys = {"title", "name", "description", "overview", "text", "summary"}
            for k, v in data.items():
                if k in skip_keys:
                    continue
                if isinstance(v, (str, int, float, bool)):
                    lines.append(f"- **{k}**: {v}")
                elif isinstance(v, list):
                    lines.append(f"- **{k}**: {', '.join(str(i) for i in v[:10])}")

            return "\n\n".join(lines) if lines else str(data)
        return str(data) if data is not None else ""

    def _format_genre_platform(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование жанра и платформ."""
        if isinstance(data, dict):
            lines = []
            if "genre" in data:
                lines.append(f"**Жанр**: {data['genre']}")
            if "subgenre" in data:
                lines.append(f"**Поджанр**: {data['subgenre']}")
            if "platforms" in data:
                platforms = data["platforms"]
                if isinstance(platforms, list):
                    lines.append(f"**Платформы**: {', '.join(str(p) for p in platforms)}")
                else:
                    lines.append(f"**Платформы**: {platforms}")
            # Остальные поля
            skip = {"genre", "subgenre", "platforms"}
            for k, v in data.items():
                if k not in skip and isinstance(v, (str, int, float)):
                    lines.append(f"**{k}**: {v}")
            return "\n".join(lines) if lines else str(data)
        elif isinstance(data, list):
            # Платформы как список
            return f"**Платформы**: {', '.join(str(p) for p in data)}"
        return str(data) if data is not None else ""

    def _format_core_loop(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование Core Loop с диаграммой."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = []

        # Структурный тип
        struct_type = data.get("structural_type", "")
        if isinstance(struct_type, dict):
            st_name = struct_type.get("type", struct_type.get("name", ""))
            lines.append(f"**Структурный тип**: {st_name}")
        elif isinstance(struct_type, str) and struct_type:
            lines.append(f"**Структурный тип**: {struct_type}")

        # Шаги
        steps = data.get("steps", [])
        if steps and isinstance(steps, list):
            lines.append("\n### Шаги Core Loop")
            for i, step in enumerate(steps):
                if isinstance(step, dict):
                    name = step.get("name", step.get("action", f"Шаг {i+1}"))
                    lines.append(f"{i+1}. **{name}**")
                    if "resources_consumed" in step:
                        consumed = step["resources_consumed"]
                        if isinstance(consumed, list) and consumed:
                            lines.append(f"   - Потребляет: {', '.join(str(r) for r in consumed[:5])}")
                    if "resources_produced" in step:
                        produced = step["resources_produced"]
                        if isinstance(produced, list) and produced:
                            lines.append(f"   - Производит: {', '.join(str(r) for r in produced[:5])}")
                elif isinstance(step, str):
                    lines.append(f"{i+1}. {step}")

        # Ресурсы
        resources = data.get("resources", [])
        if resources and isinstance(resources, list):
            lines.append("\n### Ресурсы")
            for res in resources[:10]:
                if isinstance(res, dict):
                    name = res.get("name", "")
                    lines.append(f"- **{name}**")
                elif isinstance(res, str):
                    lines.append(f"- {res}")

        return "\n".join(lines) if lines else ""

    def _format_mechanics(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование механик."""
        if isinstance(data, dict):
            mechanic_set = data.get("mechanicSet", data.get("mechanic_set", data))
            if isinstance(mechanic_set, dict):
                mechanics = mechanic_set.get("mechanics", mechanic_set.get("base", []))
            else:
                mechanics = []
        elif isinstance(data, list):
            mechanics = data
        else:
            return str(data) if data is not None else ""

        lines = []
        if isinstance(mechanics, list):
            for mech in mechanics[:15]:
                if isinstance(mech, dict):
                    name = mech.get("name", mech.get("mechanic_name", ""))
                    desc = mech.get("description", "")
                    group = mech.get("group", mech.get("group_name", ""))
                    if name:
                        line = f"- **{name}**"
                        if group:
                            line += f" ({group})"
                        if desc:
                            line += f": {desc[:100]}"
                        lines.append(line)
                elif isinstance(mech, str):
                    lines.append(f"- {mech}")

        return "\n".join(lines) if lines else ""

    def _format_progression(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование прогрессии."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = []

        # Макро-параметры
        macro = data.get("macroModel", data)
        if isinstance(macro, dict):
            duration = macro.get("duration", 0)
            levels = macro.get("totalLevels", macro.get("levels", 0))
            prog_type = macro.get("progressionType", "")
            if duration:
                lines.append(f"**Длительность**: {duration} ч.")
            if levels:
                lines.append(f"**Уровни**: {levels}")
            if prog_type:
                lines.append(f"**Тип прогрессии**: {prog_type}")

        # Тиры
        tier_model = data.get("tierModel", {})
        if isinstance(tier_model, dict):
            tiers = tier_model.get("tiers", [])
            if tiers:
                lines.append("\n### Тиры")
                for tier in tiers:
                    if isinstance(tier, dict):
                        idx = tier.get("index", 0)
                        scale = tier.get("scale", "")
                        levels = tier.get("level_count", 0)
                        lines.append(
                            f"- **Тир {idx+1}** ({scale}): {levels} уровней"
                        )

        # Кривые
        curves = data.get("curves", {})
        if isinstance(curves, dict):
            xp = curves.get("xp_to_level", {})
            if isinstance(xp, dict) and xp.get("formula"):
                lines.append(f"\n**XP-кривая**: {xp['formula']}")

        return "\n".join(lines) if lines else ""

    def _format_balance(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование балансировки."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = []

        # Тип балансировки
        balance_type = data.get("balanceType", data.get("dominant_type", ""))
        if balance_type:
            lines.append(f"**Тип балансировки**: {balance_type}")

        # Транзитивная балансировка
        transitive = data.get("transitiveResult", data.get("transitive", {}))
        if isinstance(transitive, dict) and transitive:
            lines.append("\n### Транзитивная балансировка")
            score = transitive.get("correlation", transitive.get("score", 0))
            lines.append(f"- Корреляция cost/power: {score:.3f}")

        # Нетранзитивная балансировка
        intransitive = data.get("intransitiveResult", data.get("intransitive", {}))
        if isinstance(intransitive, dict) and intransitive:
            lines.append("\n### Нетранзитивная балансировка")
            rps = intransitive.get("rpsCycles", intransitive.get("cycles", []))
            if isinstance(rps, list) and rps:
                lines.append(f"- RPS-циклов: {len(rps)}")

        return "\n".join(lines) if lines else ""

    def _format_difficulty(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование кривой сложности."""
        if isinstance(data, dict):
            formula = data.get("formula", "")
            params = data.get("parameters", {})
            lines = []
            if formula:
                lines.append(f"**Формула**: `{formula}`")
            if isinstance(params, dict) and params:
                lines.append("**Параметры**:")
                for k, v in params.items():
                    if isinstance(v, (int, float, str)):
                        lines.append(f"- {k}: {v}")
            return "\n".join(lines) if lines else ""
        return str(data) if data is not None else ""

    def _format_resources(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование ресурсов экономики."""
        if isinstance(data, dict):
            inventory = data.get("inventory", data)
            if isinstance(inventory, dict):
                resources = inventory.get("resources", [])
            else:
                resources = []
        elif isinstance(data, list):
            resources = data
        else:
            return str(data) if data is not None else ""

        lines = []
        if isinstance(resources, list):
            for res in resources[:15]:
                if isinstance(res, dict):
                    name = res.get("name", "")
                    res_class = res.get("resource_class", "")
                    consumable = res.get("is_consumable", False)
                    lines.append(
                        f"- **{name}** ({res_class})"
                        + (" — потребляемый" if consumable else "")
                    )
                elif isinstance(res, str):
                    lines.append(f"- {res}")

        return "\n".join(lines) if lines else ""

    def _format_economy(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование экономики."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = []

        classification = data.get("classification", {})
        if isinstance(classification, dict):
            econ_type = classification.get("economic_type", "")
            sub_type = classification.get("sub_type", "")
            if econ_type:
                lines.append(f"**Тип экономики**: {econ_type}" + (f" / {sub_type}" if sub_type else ""))

        inventory = data.get("inventory", {})
        if isinstance(inventory, dict):
            resources = inventory.get("resources", [])
            if isinstance(resources, list):
                lines.append(f"\n**Ресурсы**: {len(resources)} типов")

        return "\n".join(lines) if lines else ""

    def _format_tech_tree(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование дерева технологий (разблокировок)."""
        if isinstance(data, dict):
            unlocks = data.get("unlockTree", data.get("unlocks", []))
            if isinstance(unlocks, list):
                return self._format_unlock_list(unlocks)
        elif isinstance(data, list):
            # Список разблокировок напрямую
            return self._format_unlock_list(data)
        return str(data) if data is not None else ""

    def _format_unlock_list(self, unlocks: list) -> str:
        """Форматирование списка разблокировок."""
        lines = ["### Дерево разблокировок"]
        for unlock in unlocks[:20]:
            if isinstance(unlock, dict):
                level = unlock.get("level", "?")
                name = unlock.get("unlock_name", unlock.get("name", ""))
                utype = unlock.get("unlock_type", "")
                lines.append(f"- Ур. {level}: **{name}** ({utype})")
            elif isinstance(unlock, str):
                lines.append(f"- {unlock}")
        return "\n".join(lines) if len(lines) > 1 else ""

    def _format_difficulty_curve(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование кривой сложности."""
        return self._format_difficulty(data, section_name, mapping)

    def _format_content_overview(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование обзора контента."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = []
        content_plan = data.get("contentPlan", data)
        if isinstance(content_plan, dict):
            total = content_plan.get("total_content_requirements", {})
            if isinstance(total, dict):
                for k, v in total.items():
                    lines.append(f"- **{k}**: {v}")

        return "\n".join(lines) if lines else ""

    def _format_system_map(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование карты систем."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = ["### Карта систем"]
        for key, value in data.items():
            if isinstance(value, (str, int, float)):
                lines.append(f"- **{key}**: {value}")
            elif isinstance(value, list):
                lines.append(f"- **{key}**: {len(value)} элементов")
            elif isinstance(value, dict):
                lines.append(f"- **{key}**: {len(value)} подсистем")

        return "\n".join(lines) if lines else ""

    def _format_feedback_patterns(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование паттернов обратной связи."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = ["### Паттерны обратной связи"]

        loops = data.get("loops", data.get("inner_loops", []))
        if isinstance(loops, list):
            for loop in loops[:10]:
                if isinstance(loop, dict):
                    name = loop.get("name", "Петля")
                    ft = loop.get("feedback_type", loop.get("loop_type", ""))
                    lines.append(f"- **{name}** ({ft})")

        return "\n".join(lines) if lines else ""

    def _format_dissension(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование валидации лудонарративного диссонанса."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = ["### Валидация лудонарративного диссонанса"]
        aesthetics = data.get("aesthetics", data.get("aesthetic_profile", {}))
        if isinstance(aesthetics, dict):
            primary = aesthetics.get("primary", "")
            if primary:
                lines.append(f"- **Целевая эстетика**: {primary}")

        return "\n".join(lines) if lines else ""

    def _format_pitch_deck(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование питч-дека."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = ["### Pitch Deck"]
        for key in ["title", "genre", "description", "usp", "targetAudience"]:
            val = data.get(key)
            if val:
                if isinstance(val, (str, int, float)):
                    lines.append(f"- **{key}**: {val}")
                elif isinstance(val, list):
                    lines.append(f"- **{key}**: {', '.join(str(v) for v in val[:5])}")

        return "\n".join(lines) if lines else ""

    def _format_concept_overview(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование обзора концепции."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = []
        for key in ["title", "genre", "description", "usp"]:
            val = data.get(key)
            if val and isinstance(val, str):
                label_map = {
                    "title": "Название",
                    "genre": "Жанр",
                    "description": "Описание",
                    "usp": "Уникальность",
                }
                lines.append(f"**{label_map.get(key, key)}**: {val}")

        return "\n\n".join(lines) if lines else ""

    def _format_mda_analysis(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Форматирование MDA-анализа."""
        if not isinstance(data, dict):
            return str(data) if data is not None else ""

        lines = ["### MDA-анализ"]

        aesthetics = data.get("aesthetics", data.get("aesthetic_profile", {}))
        if isinstance(aesthetics, dict):
            primary = aesthetics.get("primary", "")
            secondary = aesthetics.get("secondary", "")
            if primary:
                lines.append(f"- **Эстетика**: {primary}" + (f" / {secondary}" if secondary else ""))

        dynamics = data.get("dynamics_target", data.get("dynamics", {}))
        if isinstance(dynamics, dict):
            core = dynamics.get("core_dynamics", [])
            if isinstance(core, list) and core:
                lines.append(f"- **Динамики**: {', '.join(str(d) for d in core[:5])}")

        return "\n".join(lines) if lines else ""

    def _format_generic(
        self, data: Any, section_name: str, mapping: SectionMapping
    ) -> str:
        """Универсальное форматирование."""
        if isinstance(data, str):
            return data
        elif isinstance(data, dict):
            lines = []
            for k, v in data.items():
                if isinstance(v, (str, int, float, bool)):
                    lines.append(f"- **{k}**: {v}")
                elif isinstance(v, list):
                    lines.append(f"- **{k}**: {', '.join(str(i) for i in v[:10])}")
                elif isinstance(v, dict):
                    lines.append(f"- **{k}**: {len(v)} элементов")
            return "\n".join(lines) if lines else str(data)
        elif isinstance(data, list):
            lines = []
            for item in data[:15]:
                if isinstance(item, dict):
                    name = item.get("name", item.get("title", ""))
                    if name:
                        lines.append(f"- {name}")
                elif isinstance(item, str):
                    lines.append(f"- {item}")
            return "\n".join(lines) if lines else str(data)
        return str(data) if data is not None else ""

    # ========================================================
    # Вспомогательные методы для диаграмм/таблиц/формул
    # ========================================================

    def _generate_diagram_markdown(
        self, section_name: str, data: Any
    ) -> Optional[str]:
        """Генерация Markdown-представления диаграммы."""
        if not isinstance(data, dict):
            return None

        if section_name == "core_loop":
            steps = data.get("steps", [])
            if isinstance(steps, list) and steps:
                lines = ["```mermaid", "graph TD"]
                for i, step in enumerate(steps):
                    if isinstance(step, dict):
                        name = step.get("name", step.get("action", f"S{i+1}"))
                        safe_name = name.replace(" ", "_")[:20]
                        lines.append(f"    S{i+1}[{safe_name}]")
                        if i > 0:
                            lines.append(f"    S{i} --> S{i+1}")
                    else:
                        lines.append(f"    S{i+1}[{step}]")
                        if i > 0:
                            lines.append(f"    S{i} --> S{i+1}")
                # Замыкаем цикл
                if len(steps) > 1:
                    lines.append(f"    S{len(steps)} --> S1")
                lines.append("```")
                return "\n".join(lines)

        elif section_name in ("system_map", "feedback_patterns"):
            loops = data.get("loops", data.get("inner_loops", []))
            if isinstance(loops, list) and loops:
                lines = ["```mermaid", "graph LR"]
                for i, loop in enumerate(loops[:6]):
                    if isinstance(loop, dict):
                        name = loop.get("name", f"L{i+1}")
                        ft = loop.get("feedback_type", loop.get("loop_type", ""))
                        safe_name = name.replace(" ", "_")[:15]
                        color = "green" if ft in ("positive", "reinforcing") else "red"
                        lines.append(f"    L{i+1}({safe_name})")
                lines.append("```")
                return "\n".join(lines)

        elif section_name in ("progression", "progression_curves"):
            return "```mermaid\ngraph TD\n    XP[Опыт] --> Level[Уровень]\n    Level --> Power[Мощность]\n    Level --> Cost[Стоимость]\n```"

        elif section_name in ("economy", "economy_model"):
            return "```mermaid\ngraph LR\n    Source[Источники] --> Pool[Пул ресурсов]\n    Pool --> Drain[Стоки]\n    Pool --> Converter[Конвертер]\n    Converter --> Pool\n```"

        elif section_name in ("difficulty", "difficulty_curve"):
            return "```mermaid\ngraph TD\n    Base[Базовая сложность] --> Perceived[Воспринимаемая]\n    Tier[Tier Spike] --> Perceived\n```"

        return None

    def _generate_tables(
        self, section_name: str, data: Any
    ) -> Optional[list[dict]]:
        """Генерация таблиц для секции."""
        if not isinstance(data, dict):
            return None

        tables: list[dict] = []

        if section_name in ("mechanics",):
            mechanic_set = data.get("mechanicSet", data.get("mechanic_set", data))
            if isinstance(mechanic_set, dict):
                mechs = mechanic_set.get("mechanics", mechanic_set.get("base", []))
            elif isinstance(mechanic_set, list):
                mechs = mechanic_set
            else:
                mechs = []

            if isinstance(mechs, list) and mechs:
                rows = []
                for m in mechs[:15]:
                    if isinstance(m, dict):
                        rows.append({
                            "Название": m.get("name", m.get("mechanic_name", "")),
                            "Группа": m.get("group", m.get("group_name", "")),
                            "Описание": m.get("description", "")[:60],
                        })
                if rows:
                    tables.append({
                        "title": "Механики игры",
                        "headers": ["Название", "Группа", "Описание"],
                        "rows": rows,
                    })

        elif section_name in ("resources",):
            inventory = data.get("inventory", data)
            if isinstance(inventory, dict):
                resources = inventory.get("resources", [])
            elif isinstance(data, list):
                resources = data
            else:
                resources = []

            if isinstance(resources, list) and resources:
                rows = []
                for r in resources[:15]:
                    if isinstance(r, dict):
                        rows.append({
                            "Ресурс": r.get("name", ""),
                            "Класс": r.get("resource_class", ""),
                            "Потребляемый": "Да" if r.get("is_consumable") else "Нет",
                        })
                if rows:
                    tables.append({
                        "title": "Ресурсы игры",
                        "headers": ["Ресурс", "Класс", "Потребляемый"],
                        "rows": rows,
                    })

        elif section_name in ("balance", "balance_tables"):
            # Cost-power таблица
            objects = data.get("objects", data.get("balanceMap", {}).get("objects", []))
            if isinstance(objects, list) and objects:
                rows = []
                for obj in objects[:10]:
                    if isinstance(obj, dict):
                        rows.append({
                            "Объект": obj.get("name", ""),
                            "Cost": obj.get("cost", 0),
                            "Power": obj.get("power", 0),
                        })
                if rows:
                    tables.append({
                        "title": "Cost-Power баланс",
                        "headers": ["Объект", "Cost", "Power"],
                        "rows": rows,
                    })

        elif section_name in ("progression", "progression_curves"):
            curves = data.get("curves", {})
            if isinstance(curves, dict):
                xp = curves.get("xp_to_level", {})
                if isinstance(xp, dict):
                    tables.append({
                        "title": "Кривая XP → Level",
                        "headers": ["Параметр", "Значение"],
                        "rows": [
                            {"Параметр": k, "Значение": str(v)}
                            for k, v in xp.get("parameters", {}).items()
                            if isinstance(v, (int, float, str))
                        ],
                    })

        return tables if tables else None

    def _extract_formulas(
        self, section_name: str, data: Any
    ) -> Optional[list[str]]:
        """Извлечение формул из данных."""
        if not isinstance(data, dict):
            return None

        formulas: list[str] = []

        if section_name in ("progression", "progression_curves", "difficulty_curve", "difficulty"):
            curves = data.get("curves", data)
            if isinstance(curves, dict):
                for curve_key in ["xp_to_level", "level_to_power", "level_to_cost", "difficulty"]:
                    curve = curves.get(curve_key, {})
                    if isinstance(curve, dict) and curve.get("formula"):
                        formulas.append(f"{curve_key}: {curve['formula']}")

        elif section_name in ("balance", "balance_tables"):
            formula = data.get("cost_power_formula", data.get("formula", ""))
            if formula and isinstance(formula, str):
                formulas.append(f"cost/power: {formula}")

        elif section_name in ("economy", "economy_model"):
            classification = data.get("classification", {})
            if isinstance(classification, dict):
                econ_type = classification.get("economic_type", "")
                formulas.append(f"Тип экономики: {econ_type}")

        return formulas if formulas else None

    # ========================================================
    # Полный пайплайн: Этапы 1–3
    # ========================================================

    async def generate_stages_1_3(
        self,
        input_data: GDDGenerationInput,
    ) -> GDDProfile:
        """
        Полный пайплайн генерации GDD — Этапы 1–3 алгоритма 3.7.

        Выполняет последовательно:
        1. Определение формата GDD
        2. Маппинг Project State → секции
        3. Автозаполнение секций

        Returns:
            GDDProfile с результатами всех трёх этапов
        """
        pipeline_start = time.time()

        # === Этап 1: Формат ===
        format_spec = await self.determine_gdd_format(input_data)

        # === Этап 2: Маппинг ===
        data_mapping = await self.map_project_to_sections(
            format_spec, input_data
        )

        # === Этап 3: Автозаполнение ===
        auto_filled = await self.generate_auto_sections(
            data_mapping, input_data
        )

        latency_ms = int((time.time() - pipeline_start) * 1000)

        # Общий coverage_score
        coverage_score = data_mapping.coverage_score

        profile = GDDProfile(
            format_spec=format_spec,
            data_mapping=data_mapping,
            auto_filled_sections=auto_filled,
            stages_completed=[1, 2, 3],
            coverage_score=coverage_score,
            latency_ms=latency_ms,
        )

        logger.info(
            f"[Pipeline 1-3] Completed in {latency_ms}ms. "
            f"Format: {format_spec.format}, "
            f"Sections: {len(format_spec.sections)}, "
            f"Auto-filled: {auto_filled.count}, "
            f"Coverage: {coverage_score:.2f}"
        )

        return profile
