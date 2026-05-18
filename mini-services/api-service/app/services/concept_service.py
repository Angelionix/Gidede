"""
Gidede — Concept Service
Фаза 4.B.2-4.B.3: Блок 1 — алгоритм генерации концепции (Этапы 1–5)

Реализация пайплайна генерации концепции из алгоритма 3.1:
- Этап 1: Анализ и определение жанра (CLASSIFY_GENRE)
- Этап 2: Reverse MDA — определение эстетики (EXTRACT_AESTHETICS)
- Этап 3: Reverse MDA — вывод динамик (SUGGEST_DYNAMICS + маппинг ЦА→эстетика→динамика)
- Этап 4: Выбор механик из MechanicsDB — 7-шаговый процесс (SUGGEST_MECHANICS)
- Этап 5: Генерация Core Loop и USP (GENERATE_CORE_LOOPS, GENERATE_USP)

Каждый метод вызывает PromptExecutor и валидирует выход.
Результат сохраняется в project_concepts.

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry), 4.A.12 (Shared Types)
"""

import uuid
import time
import logging
from typing import Any, Optional
from datetime import datetime, timezone

from app.ai.executor import PromptExecutor, PromptResult, PromptExecutionOptions
from app.prompts.registry import get_prompt_spec

# Локальные Pydantic-модели, синхронизированные с shared/types/python/models.py (4.A.12)
# Импорт из shared/types невозможен напрямую (разные пакеты), поэтому
# модели дублируются здесь с сохранением полной совместимости.
from app.schemas.concept import (
    AestheticProfile,
    DynamicsProfile,
    MechanicSet,
    CoreLoopCandidate,
    USPCandidate,
)

# MechanicsDB — 128 механик в 15 группах (SW.BAND, Кн. 15)
from app.data.mechanics_db import MECHANICS_DB_DATA

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.1
# ============================================================

# Маппинг «Мотивация Йи → Эстетика ЛеБланка» (алгоритм 3.1.4)
# Источник: Nick Yee's Motivation Taxonomy → LeBlanc's 8 Aesthetics
YEE_TO_AESTHETIC_MAP: dict[str, list[str]] = {
    # Кластер «Действие-Социальность»
    "destruction": ["challenge", "sensation"],       # Разрушение → Вызов, Чувственное
    "excitement":  ["sensation", "challenge"],        # Возбуждение → Чувственное, Вызов
    "competition": ["challenge", "fellowship"],       # Соревнование → Вызов, Товарищество
    "community":   ["fellowship", "submission"],      # Сообщество → Товарищество, Подчинение
    # Кластер «Мастерство-Достижение»
    "challenge":   ["challenge", "discovery"],        # Вызов → Вызов, Открытие
    "strategy":    ["challenge", "expression"],        # Стратегия → Вызов, Выражение
    "completion":  ["submission", "challenge"],        # Завершение → Подчинение, Вызов
    "power":       ["challenge", "fantasy"],           # Мощь → Вызов, Фантазия
    # Кластер «Погружение-Творчество»
    "fantasy_yee": ["fantasy", "narrative"],           # Фантазия → Фантазия, Нарратив
    "story":       ["narrative", "fantasy"],           # Сюжет → Нарратив, Фантазия
    "design":      ["expression", "discovery"],        # Дизайн → Выражение, Открытие
    "discovery_yee": ["discovery", "narrative"],       # Открытие → Открытие, Нарратив
}

# Маппинг «Эстетика → Динамика» (алгоритм 3.1.5)
AESTHETIC_TO_DYNAMICS_MAP: dict[str, list[str]] = {
    "sensation":  ["сенсорное обогащение", "визуальная обратная связь", "аудиальное вознаграждение"],
    "fantasy":    ["погружение в роль", "отождествление с персонажем", "исследование мира"],
    "narrative":  ["развитие сюжета", "эмоциональные решения", "раскрытие персонажей"],
    "challenge":  ["преодоление трудностей", "рост мастерства", "соревновательность"],
    "fellowship": ["кооперация", "социальное взаимодействие", "командная работа"],
    "discovery":  ["исследование", "поиск секретов", "экспериментирование"],
    "expression": ["кастомизация", "творчество", "самовыражение через геймплей"],
    "submission": ["рутинное удовольствие", "завершение коллекций", "регулярные награды"],
}

# Формализованная таксономия жанров (алгоритм 3.1.3)
# Ключи — ID из shared/types, значения — типичные эстетики жанра
GENRE_AESTHETIC_PROFILES: dict[str, list[str]] = {
    "action":       ["challenge", "sensation"],
    "platformer":   ["challenge", "sensation"],
    "shooter":      ["challenge", "sensation", "fellowship"],
    "fighting":     ["challenge", "competition"],
    "stealth":      ["challenge", "discovery"],
    "survival_horror": ["challenge", "sensation", "narrative"],
    "rhythm":       ["sensation", "challenge"],
    "adventure":    ["narrative", "discovery", "fantasy"],
    "rpg":          ["fantasy", "narrative", "challenge"],
    "action_rpg":   ["fantasy", "challenge", "narrative"],
    "jrpg":         ["narrative", "fantasy", "challenge"],
    "tactical_rpg": ["challenge", "strategy", "expression"],
    "mmorpg":       ["fellowship", "fantasy", "submission"],
    "roguelike":    ["challenge", "discovery"],
    "simulation":   ["expression", "discovery", "submission"],
    "strategy":     ["challenge", "expression"],
    "rts":          ["challenge", "strategy"],
    "tbs":          ["challenge", "strategy"],
    "tower_defense": ["challenge", "strategy"],
    "puzzle":       ["challenge", "discovery"],
    "party":        ["fellowship", "sensation"],
    "educational":  ["discovery", "challenge"],
    "racing":       ["sensation", "challenge"],
    "sports":       ["challenge", "fellowship"],
    "sandbox":      ["expression", "discovery"],
    "horror":       ["sensation", "narrative"],
    "metroidvania": ["discovery", "challenge"],
    "idle":         ["submission", "expression"],
    "visual_novel": ["narrative", "fantasy"],
}


# ============================================================
# Concept Service
# ============================================================

class ConceptService:
    """
    Блок 1: Генератор концепции.
    Реализует алгоритм 3.1 — Этапы 1–5.

    Методы:
    - classify_genre() — Этап 1: определение жанра
    - extract_aesthetics() — Этап 2: определение эстетических ценностей
    - derive_dynamics() — Этап 3: вывод динамик из эстетик
    - select_mechanics() — Этап 4: выбор механик из MechanicsDB (7-шаговый процесс)
    - generate_core_loops() — Этап 5: генерация 3 вариантов Core Loop
    - generate_usp() — Этап 5: генерация 3 вариантов USP
    - generate_stages_1_3() — полный пайплайн Этапов 1–3
    - generate_stages_4_5() — полный пайплайн Этапов 4–5
    - generate_full() — полный пайплайн Этапов 1–5
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Анализ и определение жанра (3.1.3)
    # ========================================================

    async def classify_genre(
        self,
        idea: str,
        explicit_genre: Optional[str] = None,
        project_state: Optional[dict] = None,
    ) -> dict[str, Any]:
        """
        Этап 1: Определение жанра игры на основе описания идеи.

        Если пользователь указал жанр явно — используем его и дополняем
        формализованными данными из таксономии. Если нет — вызываем
        CLASSIFY_GENRE промпт для AI-классификации.

        Returns:
            {
                "genre": "rpg",
                "subgenre": "roguelike",
                "confidence": 0.85,
                "reasoning": "...",
                "typical_aesthetics": ["fantasy", "challenge", "discovery"],
                "all_candidates": [...]
            }
        """
        start = time.time()

        if explicit_genre:
            # Пользователь указал жанр — дополняем из таксономии
            typical_aesthetics = GENRE_AESTHETIC_PROFILES.get(
                explicit_genre, ["challenge", "fantasy"]
            )
            result = {
                "genre": explicit_genre,
                "subgenre": "",
                "confidence": 1.0,
                "reasoning": "Жанр указан пользователем явно",
                "typical_aesthetics": typical_aesthetics,
                "all_candidates": [
                    {
                        "genre": explicit_genre,
                        "subgenre": "",
                        "confidence": 1.0,
                        "reasoning": "Явно указанный жанр",
                    }
                ],
            }
            logger.info(
                f"[Stage 1] Genre explicitly set: {explicit_genre} "
                f"({time.time() - start:.2f}s)"
            )
            return result

        # AI-классификация жанра
        prompt_result: PromptResult = await self.executor.execute(
            prompt_id="CLASSIFY_GENRE",
            inputs={"idea": idea},
            project_state=project_state,
            options=PromptExecutionOptions(skip_cache=False),
        )

        candidates = prompt_result.data
        if not isinstance(candidates, list) or len(candidates) == 0:
            # Fallback — эвристическая классификация по ключевым словам
            return self._fallback_genre_classification(idea)

        # Берём лучший кандидат
        best = candidates[0]
        genre = best.get("genre", "rpg").lower().replace(" ", "_")
        subgenre = best.get("subgenre", "")
        confidence = best.get("confidence", 0.5)
        reasoning = best.get("reasoning", "")

        # Дополняем из таксономии
        typical_aesthetics = GENRE_AESTHETIC_PROFILES.get(genre, ["challenge", "fantasy"])

        result = {
            "genre": genre,
            "subgenre": subgenre,
            "confidence": confidence,
            "reasoning": reasoning,
            "typical_aesthetics": typical_aesthetics,
            "all_candidates": candidates,
        }

        logger.info(
            f"[Stage 1] Genre classified: {genre}/{subgenre} "
            f"(confidence={confidence:.2f}, {time.time() - start:.2f}s)"
        )
        return result

    def _fallback_genre_classification(self, idea: str) -> dict[str, Any]:
        """
        Эвристическая классификация жанра по ключевым словам.
        Используется, если AI-вызов не удался.
        """
        idea_lower = idea.lower()

        # Простые правила по ключевым словам
        keyword_genre_map = {
            "roguelike": "roguelike", "rogue": "roguelike",
            "shooter": "shooter", "стрелялк": "shooter",
            "rpg": "rpg", "роле": "rpg",
            "strategy": "strategy", "стратег": "strategy",
            "platformer": "platformer", "платформер": "platformer",
            "puzzle": "puzzle", "головолом": "puzzle",
            "horror": "horror", "хоррор": "horror", "страш": "horror",
            "survival": "survival_horror", "выживан": "survival_horror",
            "simulation": "simulation", "симулят": "simulation",
            "racing": "racing", "гонк": "racing",
            "sandbox": "sandbox", "песочн": "sandbox",
            "metroidvania": "metroidvania",
        }

        detected_genre = "rpg"  # default
        for keyword, genre in keyword_genre_map.items():
            if keyword in idea_lower:
                detected_genre = genre
                break

        typical_aesthetics = GENRE_AESTHETIC_PROFILES.get(detected_genre, ["challenge", "fantasy"])

        return {
            "genre": detected_genre,
            "subgenre": "",
            "confidence": 0.4,
            "reasoning": "Эвристическая классификация по ключевым словам (AI недоступен)",
            "typical_aesthetics": typical_aesthetics,
            "all_candidates": [
                {
                    "genre": detected_genre,
                    "subgenre": "",
                    "confidence": 0.4,
                    "reasoning": "Fallback: ключевое слово в описании идеи",
                }
            ],
        }

    # ========================================================
    # Этап 2: Reverse MDA — определение эстетики (3.1.4)
    # ========================================================

    async def extract_aesthetics(
        self,
        idea: str,
        genre: str,
        target_motivations: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> AestheticProfile:
        """
        Этап 2: Определение целевых эстетических ценностей через Reverse MDA.

        Стратегия:
        1. Если пользователь указал мотивации Йи → маппинг ЦА→эстетика через формализованную таблицу
        2. Если мотивации не указаны → AI-определение через EXTRACT_AESTHETICS
        3. Обогащение результата жанровыми конвенциями

        Returns:
            AestheticProfile с primary, secondary, tertiary эстетиками и обоснованием
        """
        start = time.time()

        # Собираем кандидат-эстетики из формализованного маппинга
        aesthetic_scores: dict[str, float] = {}

        # 1. Из мотиваций Йи
        if target_motivations:
            for motivation in target_motivations:
                mapped_aesthetics = YEE_TO_AESTHETIC_MAP.get(motivation, [])
                for i, aesthetic in enumerate(mapped_aesthetics):
                    # Ближайшая эстетика получает больше баллов
                    score = 1.0 - (i * 0.3)
                    aesthetic_scores[aesthetic] = aesthetic_scores.get(aesthetic, 0.0) + score

        # 2. Из жанровых конвенций
        genre_aesthetics = GENRE_AESTHETIC_PROFILES.get(genre, [])
        for i, aesthetic in enumerate(genre_aesthetics):
            score = 0.5 - (i * 0.1)  # Жанровые эстетики получают меньше баллов
            aesthetic_scores[aesthetic] = aesthetic_scores.get(aesthetic, 0.0) + score

        # Если есть мотивации — используем формализованный результат как основу
        if target_motivations and len(aesthetic_scores) >= 3:
            # Сортируем по скору
            sorted_aesthetics = sorted(
                aesthetic_scores.items(), key=lambda x: x[1], reverse=True
            )
            primary = sorted_aesthetics[0][0] if len(sorted_aesthetics) > 0 else "challenge"
            secondary = sorted_aesthetics[1][0] if len(sorted_aesthetics) > 1 else "fantasy"
            tertiary = sorted_aesthetics[2][0] if len(sorted_aesthetics) > 2 else "discovery"

            # Обогащаем через AI для обоснования
            rationale = self._build_aesthetic_rationale(
                primary, secondary, tertiary, target_motivations, genre
            )

            profile = AestheticProfile(
                primary=primary,
                secondary=secondary,
                tertiary=tertiary,
                rationale=rationale,
            )

            logger.info(
                f"[Stage 2] Aesthetics from Yee mapping: "
                f"{primary}/{secondary}/{tertiary} "
                f"({time.time() - start:.2f}s)"
            )
            return profile

        # Мотивации не указаны — вызываем AI для определения эстетик
        prompt_result: PromptResult = await self.executor.execute(
            prompt_id="EXTRACT_AESTHETICS",
            inputs={"idea": idea, "genre": genre},
            project_state=project_state,
            options=PromptExecutionOptions(skip_cache=False),
        )

        aesthetics_data = prompt_result.data
        if isinstance(aesthetics_data, list) and len(aesthetics_data) >= 3:
            primary = aesthetics_data[0].get("aesthetic", "challenge").lower()
            secondary = aesthetics_data[1].get("aesthetic", "fantasy").lower()
            tertiary = aesthetics_data[2].get("aesthetic", "discovery").lower()

            # Собираем обоснования
            reasoning_parts = []
            for item in aesthetics_data[:3]:
                if item.get("reasoning"):
                    reasoning_parts.append(item["reasoning"])
            rationale = "; ".join(reasoning_parts) if reasoning_parts else "AI-определённые эстетики"
        else:
            # Fallback — из жанрового профиля
            primary = genre_aesthetics[0] if len(genre_aesthetics) > 0 else "challenge"
            secondary = genre_aesthetics[1] if len(genre_aesthetics) > 1 else "fantasy"
            tertiary = genre_aesthetics[2] if len(genre_aesthetics) > 2 else "discovery"
            rationale = "Эстетики определены из жанрового профиля (AI недоступен)"

        profile = AestheticProfile(
            primary=primary,
            secondary=secondary,
            tertiary=tertiary,
            rationale=rationale,
        )

        logger.info(
            f"[Stage 2] Aesthetics extracted: "
            f"{primary}/{secondary}/{tertiary} "
            f"({time.time() - start:.2f}s)"
        )
        return profile

    def _build_aesthetic_rationale(
        self,
        primary: str,
        secondary: str,
        tertiary: str,
        motivations: list[str],
        genre: str,
    ) -> str:
        """Построить текстовое обоснование выбора эстетик."""
        aesthetic_names_ru = {
            "sensation": "Чувственное",
            "fantasy": "Фантазия",
            "narrative": "Нарратив",
            "challenge": "Вызов",
            "fellowship": "Товарищество",
            "discovery": "Открытие",
            "expression": "Выражение",
            "submission": "Подчинение",
        }

        parts = []
        for aesthetic in [primary, secondary, tertiary]:
            name_ru = aesthetic_names_ru.get(aesthetic, aesthetic)
            # Найти какие мотивации привели к этой эстетике
            related_motivations = []
            for m in motivations:
                if aesthetic in YEE_TO_AESTHETIC_MAP.get(m, []):
                    related_motivations.append(m)
            if related_motivations:
                parts.append(
                    f"{name_ru} — обосновано мотивациями: {', '.join(related_motivations)}"
                )
            else:
                parts.append(
                    f"{name_ru} — типично для жанра {genre}"
                )

        return "; ".join(parts)

    # ========================================================
    # Этап 3: Reverse MDA — вывод динамик (3.1.5)
    # ========================================================

    async def derive_dynamics(
        self,
        aesthetic_profile: AestheticProfile,
        genre: str,
        idea: str,
        project_state: Optional[dict] = None,
    ) -> DynamicsProfile:
        """
        Этап 3: Вывод динамик из эстетических ценностей.

        Стратегия:
        1. Формализованный маппинг «Эстетика → Динамика»
        2. AI-обогащение через SUGGEST_DYNAMICS (расширяет формализованный список)
        3. Жанровая фильтрация (отсекаем динамики, нетипичные для жанра)

        Returns:
            DynamicsProfile с core_dynamics, supporting_dynamics и emergence_potential
        """
        start = time.time()

        # 1. Формализованный маппинг — базовые динамики
        core_dynamics_set: set[str] = set()
        supporting_dynamics_set: set[str] = set()

        for aesthetic in [aesthetic_profile.primary, aesthetic_profile.secondary, aesthetic_profile.tertiary]:
            mapped = AESTHETIC_TO_DYNAMICS_MAP.get(aesthetic, [])
            if aesthetic == aesthetic_profile.primary:
                core_dynamics_set.update(mapped)
            else:
                supporting_dynamics_set.update(mapped)

        # Убираем из supporting те, что уже в core
        supporting_dynamics_set -= core_dynamics_set

        core_dynamics = list(core_dynamics_set)
        supporting_dynamics = list(supporting_dynamics_set)

        # 2. AI-обогащение — расширяем список динамик
        try:
            # Обогащаем для primary эстетики
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="SUGGEST_DYNAMICS",
                inputs={
                    "aesthetic": aesthetic_profile.primary,
                    "genre": genre,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            dynamics_data = prompt_result.data
            if isinstance(dynamics_data, list):
                for item in dynamics_data:
                    dynamic_name = item.get("dynamic", "")
                    if dynamic_name and dynamic_name not in core_dynamics:
                        # Определяем — core или supporting
                        aesthetics_served = item.get("aesthetics_served", [])
                        if aesthetic_profile.primary in aesthetics_served:
                            core_dynamics.append(dynamic_name)
                        else:
                            supporting_dynamics.append(dynamic_name)

            # Обогащаем для secondary эстетики
            prompt_result_2: PromptResult = await self.executor.execute(
                prompt_id="SUGGEST_DYNAMICS",
                inputs={
                    "aesthetic": aesthetic_profile.secondary,
                    "genre": genre,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            dynamics_data_2 = prompt_result_2.data
            if isinstance(dynamics_data_2, list):
                for item in dynamics_data_2:
                    dynamic_name = item.get("dynamic", "")
                    if dynamic_name and dynamic_name not in core_dynamics and dynamic_name not in supporting_dynamics:
                        supporting_dynamics.append(dynamic_name)

        except Exception as e:
            logger.warning(f"[Stage 3] AI enrichment failed, using formalized dynamics only: {e}")

        # 3. Определяем emergence_potential
        emergence_potential = self._assess_emergence_potential(
            core_dynamics, supporting_dynamics, genre
        )

        # 4. Обоснование
        rationale = self._build_dynamics_rationale(
            aesthetic_profile, core_dynamics, supporting_dynamics
        )

        profile = DynamicsProfile(
            core_dynamics=core_dynamics[:8],  # Ограничиваем до 8
            supporting_dynamics=supporting_dynamics[:12],  # Ограничиваем до 12
            emergence_potential=emergence_potential,
            rationale=rationale,
        )

        logger.info(
            f"[Stage 3] Dynamics derived: "
            f"{len(core_dynamics)} core, {len(supporting_dynamics)} supporting "
            f"(emergence={emergence_potential}, {time.time() - start:.2f}s)"
        )
        return profile

    def _assess_emergence_potential(
        self,
        core_dynamics: list[str],
        supporting_dynamics: list[str],
        genre: str,
    ) -> str:
        """
        Оценка потенциала эмерджентности.
        Зависит от количества и разнообразия динамик.
        """
        total = len(core_dynamics) + len(supporting_dynamics)

        # Жанры с высокой эмерджентностью
        high_emergence_genres = {"sandbox", "simulation", "roguelike", "mmorpg", "strategy"}

        if genre in high_emergence_genres and total >= 8:
            return "strong"
        elif total >= 6:
            return "moderate"
        elif total >= 3:
            return "weak"
        else:
            return "none"

    def _build_dynamics_rationale(
        self,
        aesthetic_profile: AestheticProfile,
        core_dynamics: list[str],
        supporting_dynamics: list[str],
    ) -> str:
        """Построить текстовое обоснование выбора динамик."""
        parts = []
        aesthetic_names_ru = {
            "sensation": "Чувственное", "fantasy": "Фантазия",
            "narrative": "Нарратив", "challenge": "Вызов",
            "fellowship": "Товарищество", "discovery": "Открытие",
            "expression": "Выражение", "submission": "Подчинение",
        }

        primary_ru = aesthetic_names_ru.get(aesthetic_profile.primary, aesthetic_profile.primary)
        parts.append(
            f"Основные динамики ({len(core_dynamics)}) создают {primary_ru} "
            f"— ключевую эстетику проекта"
        )

        secondary_ru = aesthetic_names_ru.get(aesthetic_profile.secondary, aesthetic_profile.secondary)
        parts.append(
            f"Поддерживающие динамики ({len(supporting_dynamics)}) "
            f"усиливают {secondary_ru} и обеспечивают глубину"
        )

        return ". ".join(parts)

    # ========================================================
    # Полный пайплайн: Этапы 1–3
    # ========================================================

    async def generate_stages_1_3(
        self,
        idea: str,
        explicit_genre: Optional[str] = None,
        target_motivations: Optional[list[str]] = None,
        experience_level: str = "midcore",
        platforms: Optional[list[str]] = None,
        constraints: Optional[dict] = None,
        reference_games: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> dict[str, Any]:
        """
        Полный пайплайн генерации концепции — Этапы 1–3 алгоритма 3.1.

        Выполняет последовательно:
        1. Классификацию жанра
        2. Определение эстетических ценностей
        3. Вывод динамик из эстетик

        Returns:
            {
                "genre_result": {...},        # Результат Этапа 1
                "aesthetic_profile": {...},   # Результат Этапа 2
                "dynamics_profile": {...},     # Результат Этапа 3
                "stages_completed": [1, 2, 3],
                "latency_ms": ...,
                "models_used": [...],
            }
        """
        pipeline_start = time.time()
        models_used: list[str] = []

        # === Этап 1: Жанр ===
        genre_result = await self.classify_genre(
            idea=idea,
            explicit_genre=explicit_genre,
            project_state=project_state,
        )
        if genre_result.get("confidence", 0) < 1.0:
            models_used.append("CLASSIFY_GENRE")

        # === Этап 2: Эстетика ===
        aesthetic_profile = await self.extract_aesthetics(
            idea=idea,
            genre=genre_result["genre"],
            target_motivations=target_motivations,
            project_state=project_state,
        )
        if not target_motivations or len(target_motivations) == 0:
            models_used.append("EXTRACT_AESTHETICS")

        # === Этап 3: Динамики ===
        dynamics_profile = await self.derive_dynamics(
            aesthetic_profile=aesthetic_profile,
            genre=genre_result["genre"],
            idea=idea,
            project_state=project_state,
        )
        models_used.append("SUGGEST_DYNAMICS")

        latency_ms = int((time.time() - pipeline_start) * 1000)

        logger.info(
            f"[Pipeline 1-3] Completed in {latency_ms}ms. "
            f"Genre: {genre_result['genre']}, "
            f"Aesthetics: {aesthetic_profile.primary}/{aesthetic_profile.secondary}/{aesthetic_profile.tertiary}, "
            f"Dynamics: {len(dynamics_profile.core_dynamics)} core"
        )

        return {
            "genre_result": genre_result,
            "aesthetic_profile": aesthetic_profile.model_dump(),
            "dynamics_profile": dynamics_profile.model_dump(),
            "stages_completed": [1, 2, 3],
            "latency_ms": latency_ms,
            "models_used": models_used,
        }

    # ========================================================
    # Этап 4: Выбор механик из MechanicsDB (3.1.6)
    # ========================================================

    async def select_mechanics(
        self,
        genre: str,
        aesthetic_profile: AestheticProfile,
        dynamics_profile: DynamicsProfile,
        platforms: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> MechanicSet:
        """
        Этап 4: Выбор механик из MechanicsDB — 7-шаговый процесс (алгоритм 3.1.6).

        Шаги:
        1. Выбор базовых механик (Группа 1)
        2. Выбор боевых механик (Группы 4, 8)
        3. Выбор прогрессионных механик (Группы 2, 9)
        4. Выбор пространственных механик (Группы 3, 5, 11)
        5. Выбор социальных/информационных (Группа 7, 14)
        6. Валидация совместимости (конфликты, синергии)
        7. Финальный набор механик

        Returns:
            MechanicSet с base, combat, progression, spatial, social механиками
        """
        start = time.time()

        aesthetics = [aesthetic_profile.primary, aesthetic_profile.secondary, aesthetic_profile.tertiary]
        core_dynamics = dynamics_profile.core_dynamics
        all_dynamics = core_dynamics + dynamics_profile.supporting_dynamics

        # Все механики из MechanicsDB
        mechanics_by_group: dict[int, list[dict]] = {}
        for m in MECHANICS_DB_DATA:
            gid = m["group_id"]
            mechanics_by_group.setdefault(gid, []).append(m)

        # === Шаг 1: Базовые механики (Группа 1) ===
        base_pool = mechanics_by_group.get(1, [])
        selected_base = self._select_mechanics_from_pool(
            pool=base_pool, genre=genre, aesthetics=aesthetics,
            dynamics=all_dynamics, min_count=3, max_count=5,
            constraints=[
                # Обязательные: минимум 1 из {Враги, Головоломки, Изучение мира}
                {"at_least_one": ["Враги", "Головоломки", "Изучение мира"]},
                # Обязательные: минимум 1 из {Здоровье, Достижения и очки}
                {"at_least_one": ["Здоровье", "Достижения и очки"]},
            ],
        )

        # === Шаг 2: Боевые механики (Группы 4, 8) ===
        selected_base_names = {m["mechanic_name"] for m in selected_base}
        has_enemies = "Враги" in selected_base_names

        if has_enemies:
            combat_pool = mechanics_by_group.get(4, []) + mechanics_by_group.get(8, [])

            # Жанровая специализация боевых механик
            combat_prefer = self._get_combat_specialization(genre)

            selected_combat = self._select_mechanics_from_pool(
                pool=combat_pool, genre=genre, aesthetics=aesthetics,
                dynamics=all_dynamics, min_count=2, max_count=4,
                prefer_names=combat_prefer,
            )
        else:
            selected_combat = []

        # === Шаг 3: Прогрессионные механики (Группы 2, 9) ===
        progression_pool = mechanics_by_group.get(2, []) + mechanics_by_group.get(9, [])
        progression_prefer = self._get_progression_specialization(genre)

        selected_progression = self._select_mechanics_from_pool(
            pool=progression_pool, genre=genre, aesthetics=aesthetics,
            dynamics=all_dynamics, min_count=2, max_count=3,
            prefer_names=progression_prefer,
        )

        # === Шаг 4: Пространственные механики (Группы 3, 5, 11) ===
        spatial_pool = (
            mechanics_by_group.get(3, [])
            + mechanics_by_group.get(5, [])
            + mechanics_by_group.get(11, [])
        )
        spatial_prefer = self._get_spatial_specialization(genre, aesthetics)

        selected_spatial = self._select_mechanics_from_pool(
            pool=spatial_pool, genre=genre, aesthetics=aesthetics,
            dynamics=all_dynamics, min_count=2, max_count=3,
            prefer_names=spatial_prefer,
        )

        # === Шаг 5: Социальные/информационные (Группы 7, 14) ===
        is_multiplayer = platforms and ("mobile" in platforms or "console" in platforms)
        has_fellowship = "fellowship" in aesthetics

        if is_multiplayer or has_fellowship:
            social_pool = mechanics_by_group.get(7, [])
            selected_social = self._select_mechanics_from_pool(
                pool=social_pool, genre=genre, aesthetics=aesthetics,
                dynamics=all_dynamics, min_count=1, max_count=3,
            )
        else:
            social_pool = mechanics_by_group.get(7, []) + mechanics_by_group.get(14, [])
            # Для single-player берём из группы 7 с пометкой single-player-friendly
            sp_friendly = ["Нарратив", "Репутация", "Рейтинги"]
            selected_social = self._select_mechanics_from_pool(
                pool=social_pool, genre=genre, aesthetics=aesthetics,
                dynamics=all_dynamics, min_count=1, max_count=2,
                prefer_names=sp_friendly,
            )

        # === Шаг 6: Валидация совместимости ===
        all_selected = selected_base + selected_combat + selected_progression + selected_spatial + selected_social
        all_names = [m["mechanic_name"] for m in all_selected]

        # 6.1: Проверка конфликтов
        conflicts_resolved = []
        for m in all_selected[:]:
            for conflict_name in m.get("conflicts_with", []):
                if conflict_name in all_names:
                    # Удаляем механику с меньшей жанровой привязкой
                    other = next((x for x in all_selected if x["mechanic_name"] == conflict_name), None)
                    if other:
                        m_affinity = m.get("genre_affinity", {}).get(genre, 0)
                        o_affinity = other.get("genre_affinity", {}).get(genre, 0)
                        if m_affinity <= o_affinity:
                            all_selected.remove(m)
                            all_names.remove(m["mechanic_name"])
                            conflicts_resolved.append(
                                f"Удалена механика '{m['mechanic_name']}' из-за конфликта с '{conflict_name}'"
                            )
                        else:
                            all_selected.remove(other)
                            all_names.remove(other["mechanic_name"])
                            conflicts_resolved.append(
                                f"Удалена механика '{conflict_name}' из-за конфликта с '{m['mechanic_name']}'"
                            )
                    break

        # 6.2: Проверка синергий
        synergies_detected = []
        for m in all_selected:
            for synergy_name in m.get("synergies_with", []):
                if synergy_name in all_names and synergy_name != m["mechanic_name"]:
                    synergies_detected.append(
                        {"mechanic_a": m["mechanic_name"], "mechanic_b": synergy_name, "strength": "strong"}
                    )

        synergy_score = len(synergies_detected) * 1
        warnings = []
        if synergy_score < 5:
            warnings.append("Слабые синергии между механиками — игра может ощущаться фрагментарной")

        # 6.3: Удаление запрещённых механик
        if forbidden_mechanics:
            before = len(all_selected)
            all_selected = [m for m in all_selected if m["mechanic_name"] not in forbidden_mechanics]
            removed = before - len(all_selected)
            if removed > 0:
                conflicts_resolved.append(f"Удалено {removed} запрещённых механик")

        # === Шаг 7: Финальный набор ===
        # Пересобираем по категориям
        base_names_set = {m["mechanic_name"] for m in selected_base}
        combat_names_set = {m["mechanic_name"] for m in selected_combat}
        progression_names_set = {m["mechanic_name"] for m in selected_progression}
        spatial_names_set = {m["mechanic_name"] for m in selected_spatial}
        social_names_set = {m["mechanic_name"] for m in selected_social}

        final_base = [m for m in all_selected if m["mechanic_name"] in base_names_set]
        final_combat = [m for m in all_selected if m["mechanic_name"] in combat_names_set]
        final_progression = [m for m in all_selected if m["mechanic_name"] in progression_names_set]
        final_spatial = [m for m in all_selected if m["mechanic_name"] in spatial_names_set]
        final_social = [m for m in all_selected if m["mechanic_name"] in social_names_set]

        compatibility_score = self._calculate_compatibility_score(all_selected, synergies_detected, conflicts_resolved)

        mechanic_set = MechanicSet(
            base=[{"name": m["mechanic_name"], "group": m["group_name"], "description": m["description"]} for m in final_base],
            combat=[{"name": m["mechanic_name"], "group": m["group_name"], "description": m["description"]} for m in final_combat],
            progression=[{"name": m["mechanic_name"], "group": m["group_name"], "description": m["description"]} for m in final_progression],
            spatial=[{"name": m["mechanic_name"], "group": m["group_name"], "description": m["description"]} for m in final_spatial],
            social=[{"name": m["mechanic_name"], "group": m["group_name"], "description": m["description"]} for m in final_social],
            total_count=len(all_selected),
            conflicts_resolved=conflicts_resolved,
            synergies_detected=synergies_detected,
            compatibility_score=compatibility_score,
            warnings=warnings,
        )

        logger.info(
            f"[Stage 4] Mechanics selected: {mechanic_set.total_count} total "
            f"({len(final_base)} base, {len(final_combat)} combat, "
            f"{len(final_progression)} prog, {len(final_spatial)} spatial, {len(final_social)} social) "
            f"compat={compatibility_score:.0f} ({time.time() - start:.2f}s)"
        )
        return mechanic_set

    def _select_mechanics_from_pool(
        self,
        pool: list[dict],
        genre: str,
        aesthetics: list[str],
        dynamics: list[str],
        min_count: int = 2,
        max_count: int = 4,
        prefer_names: Optional[list[str]] = None,
        constraints: Optional[list[dict]] = None,
    ) -> list[dict]:
        """
        Выбор механик из пула на основе жанрового сродства, эстетического
        покрытия и предпочтительных названий. Алгоритмический выбор без AI
        (AI-обогащение будет добавлено через SUGGEST_MECHANICS в будущем).
        """
        if not pool:
            return []

        # Скоринг каждой механики
        scored: list[tuple[float, dict]] = []
        for m in pool:
            score = 0.0

            # Жанровое сродство (вес 3)
            genre_aff = m.get("genre_affinity", {}).get(genre, 0)
            score += genre_aff * 3.0

            # Эстетическое покрытие (вес 2)
            m_aesthetics = m.get("aesthetics_served", [])
            for a in aesthetics:
                if a in m_aesthetics:
                    score += 2.0

            # Покрытие динамик (вес 1)
            m_dynamics = m.get("dynamics_served", [])
            for d in dynamics:
                # Нечёткое совпадение (подстрока)
                for md in m_dynamics:
                    if d.lower() in md.lower() or md.lower() in d.lower():
                        score += 1.0
                        break

            # Предпочтительные механики (бонус 2)
            if prefer_names and m["mechanic_name"] in prefer_names:
                score += 2.0

            scored.append((score, m))

        # Сортируем по скору (убывание)
        scored.sort(key=lambda x: x[0], reverse=True)

        # Выбираем top-N с учётом ограничений
        selected = []
        selected_names = set()

        # Сначала добавляем предпочтительные
        if prefer_names:
            for name in prefer_names:
                for score, m in scored:
                    if m["mechanic_name"] == name and m["mechanic_name"] not in selected_names:
                        selected.append(m)
                        selected_names.add(m["mechanic_name"])
                        break

        # Затем добираем по скору до max_count
        for score, m in scored:
            if len(selected) >= max_count:
                break
            if m["mechanic_name"] not in selected_names:
                selected.append(m)
                selected_names.add(m["mechanic_name"])

        # Проверяем ограничения
        if constraints:
            for constraint in constraints:
                if "at_least_one" in constraint:
                    required = constraint["at_least_one"]
                    if not any(m["mechanic_name"] in required for m in selected):
                        # Добавляем первую подходящую из пула
                        for score, m in scored:
                            if m["mechanic_name"] in required and m["mechanic_name"] not in selected_names:
                                selected.append(m)
                                selected_names.add(m["mechanic_name"])
                                break

        # Гарантируем min_count — если слишком мало, добавляем лучшие
        if len(selected) < min_count:
            for score, m in scored:
                if len(selected) >= min_count:
                    break
                if m["mechanic_name"] not in selected_names:
                    selected.append(m)
                    selected_names.add(m["mechanic_name"])

        return selected[:max_count]

    def _get_combat_specialization(self, genre: str) -> list[str]:
        """Жанровая специализация боевых механик (алгоритм 3.1.6, Шаг 2)."""
        combat_map: dict[str, list[str]] = {
            "shooter": ["Броня", "Запас патронов", "Укрытия", "Бесшумное оружие"],
            "stealth": ["Стелс и прятки", "Бесшумное оружие", "Ночное видение", "Без убийств"],
            "rpg": ["Характеристики", "Перки", "Обмундирование", "Прокачка оружия"],
            "action_rpg": ["Комбо", "Парирование", "Уклонение", "Спецатаки"],
            "action": ["Комбо", "Уклонение", "Парирование", "Рывок"],
            "fighting": ["Комбо", "Парирование", "Уклонение", "Спецатаки"],
            "horror": ["Стелс и прятки", "Укрытия", "Бесшумное оружие"],
            "survival_horror": ["Укрытия", "Запас патронов", "Бесшумное оружие"],
        }
        return combat_map.get(genre, ["Уклонение", "Спецатаки"])

    def _get_progression_specialization(self, genre: str) -> list[str]:
        """Жанровая специализация прогрессионных механик (алгоритм 3.1.6, Шаг 3)."""
        progression_map: dict[str, list[str]] = {
            "rpg": ["Очки опыта", "Перки", "Характеристики", "Древо технологий"],
            "action_rpg": ["Прокачка оружия", "Обмундирование", "Достижения"],
            "strategy": ["Древо технологий", "Строительство", "Сложность"],
            "roguelike": ["Очки опыта", "Перки", "Древо технологий"],
            "mmorpg": ["Очки опыта", "Уровни", "Дерево навыков", "Классы"],
            "shooter": ["Прокачка оружия", "Обмундирование", "Достижения"],
        }
        return progression_map.get(genre, ["Очки опыта", "Уровни"])

    def _get_spatial_specialization(self, genre: str, aesthetics: list[str]) -> list[str]:
        """Жанровая специализация пространственных механик (алгоритм 3.1.6, Шаг 4)."""
        if "discovery" in aesthetics:
            return ["Альтернативы", "Мультицели", "Карта мира", "Тайники", "Секретные уровни"]
        elif "submission" in aesthetics:
            return ["Экономика", "Торг", "Зона игры", "Дискретное время"]

        spatial_map: dict[str, list[str]] = {
            "sandbox": ["Строительство", "Карта мира", "Альтернативы"],
            "strategy": ["Зона игры", "Контроль точек", "Туман войны"],
            "rpg": ["Карта мира", "Телепортация", "Путешествия"],
            "metroidvania": ["Тайники", "Секретные уровни", "Гравитация"],
            "platformer": ["Прыжки", "Двойной прыжок", "Стены"],
        }
        return spatial_map.get(genre, ["Карта мира", "Альтернативы"])

    def _calculate_compatibility_score(
        self,
        selected: list[dict],
        synergies: list[dict],
        conflicts: list[str],
    ) -> float:
        """Расчёт score совместимости механик (0–100)."""
        if not selected:
            return 0.0

        # Базовый скор из синергий
        synergy_score = min(len(synergies) * 5, 50)

        # Штраф за конфликты
        conflict_penalty = min(len(conflicts) * 10, 40)

        # Бонус за разнообразие групп
        groups = set(m.get("group_id", 0) for m in selected)
        diversity_bonus = min(len(groups) * 5, 20)

        score = synergy_score + diversity_bonus - conflict_penalty
        return max(0.0, min(100.0, score))

    # ========================================================
    # Этап 5: Генерация Core Loop и USP (3.1.7)
    # ========================================================

    async def generate_core_loops(
        self,
        mechanic_set: MechanicSet,
        aesthetic_profile: AestheticProfile,
        dynamics_profile: DynamicsProfile,
        project_state: Optional[dict] = None,
    ) -> list[CoreLoopCandidate]:
        """
        Этап 5.1: Генерация 3 вариантов Core Loop.

        Определяет структурный тип петли (Engine/Economy/Ecology/Hybrid)
        и вызывает GENERATE_CORE_LOOPS промпт.

        Returns:
            Список из 3 CoreLoopCandidate с name, steps, loop_type, fun_check
        """
        start = time.time()

        # Определяем структурный тип Core Loop
        dynamics_list = dynamics_profile.core_dynamics + dynamics_profile.supporting_dynamics
        loop_type = self._determine_loop_type(dynamics_list, aesthetic_profile)

        # Формируем список механик для промпта
        all_mechanics = []
        for category in ["base", "combat", "progression", "spatial", "social"]:
            for m in getattr(mechanic_set, category, []):
                all_mechanics.append(m.get("name", ""))

        aesthetics_list = [
            aesthetic_profile.primary,
            aesthetic_profile.secondary,
            aesthetic_profile.tertiary,
        ]

        # Вызываем AI для генерации Core Loop
        candidates: list[CoreLoopCandidate] = []

        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="GENERATE_CORE_LOOPS",
                inputs={
                    "mechanics": all_mechanics,
                    "aesthetics": aesthetics_list,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=True),
            )

            data = prompt_result.data
            if isinstance(data, list):
                for item in data[:3]:
                    candidates.append(CoreLoopCandidate(
                        name=item.get("name", "Core Loop"),
                        steps=item.get("steps", []),
                        loop_type=item.get("loop_type", loop_type),
                        fun_check=item.get("fun_check", ""),
                        estimated_duration_seconds=item.get("estimated_duration_seconds", 30),
                    ))

        except Exception as e:
            logger.warning(f"[Stage 5.1] AI generation failed, using fallback: {e}")

        # Fallback — если AI не вернул кандидатов
        if not candidates:
            candidates = self._fallback_core_loop_generation(all_mechanics, loop_type)

        logger.info(
            f"[Stage 5.1] Core Loop candidates: {len(candidates)} variants "
            f"(type={loop_type}, {time.time() - start:.2f}s)"
        )
        return candidates

    def _determine_loop_type(self, dynamics: list[str], aesthetic_profile: AestheticProfile) -> str:
        """
        Определение структурного типа Core Loop (алгоритм 3.1.7).
        Engine: усиливающие петли без конвертации
        Economy: усиливающие петли + конвертация
        Ecology: балансирующие петли + конвертация
        Hybrid: смешанный случай
        """
        dynamics_lower = [d.lower() for d in dynamics]

        has_reinforcing = any(kw in d for d in dynamics_lower for kw in ["накоплен", "рост", "усилен", "прогресс", "наращ"])
        has_conversion = any(kw in d for d in dynamics_lower for kw in ["конвертац", "обмен", "торг", "крафт", "трансформац"])
        has_balancing = any(kw in d for d in dynamics_lower for kw in ["баланс", "управлен", "контроль", "регулирован"])

        if has_reinforcing and not has_conversion:
            return "engine"
        elif has_reinforcing and has_conversion:
            return "economy"
        elif has_balancing and has_conversion:
            return "ecology"
        else:
            return "hybrid"

    def _fallback_core_loop_generation(
        self, mechanics: list[str], loop_type: str
    ) -> list[CoreLoopCandidate]:
        """
        Fallback-генерация Core Loop без AI.
        Создаёт базовые варианты на основе шаблонов.
        """
        templates = [
            CoreLoopCandidate(
                name="Основной цикл",
                steps=[
                    {"action": "Исследовать", "mechanic": mechanics[0] if mechanics else "Изучение мира", "resource": "информация"},
                    {"action": "Собирать", "mechanic": mechanics[1] if len(mechanics) > 1 else "Ресурсы", "resource": "ресурсы"},
                    {"action": "Применять", "mechanic": mechanics[2] if len(mechanics) > 2 else "Крафт", "resource": "снаряжение"},
                    {"action": "Сражаться", "mechanic": mechanics[3] if len(mechanics) > 3 else "Враги", "resource": "опыт"},
                ],
                loop_type=loop_type,
                fun_check="Замкнутый цикл: исследование → сбор → крафт → бой → новая территория",
                estimated_duration_seconds=60,
            ),
            CoreLoopCandidate(
                name="Цикл развития",
                steps=[
                    {"action": "Принять вызов", "mechanic": mechanics[0] if mechanics else "Квесты", "resource": "задача"},
                    {"action": "Выполнить", "mechanic": mechanics[1] if len(mechanics) > 1 else "Головоломки", "resource": "прогресс"},
                    {"action": "Получить награду", "mechanic": mechanics[2] if len(mechanics) > 2 else "Достижения", "resource": "награда"},
                ],
                loop_type=loop_type,
                fun_check="Короткий цикл: вызов → решение → награда → новый вызов",
                estimated_duration_seconds=30,
            ),
            CoreLoopCandidate(
                name="Цикл созидания",
                steps=[
                    {"action": "Собрать материалы", "mechanic": mechanics[0] if mechanics else "Ресурсы", "resource": "ингредиенты"},
                    {"action": "Создать предмет", "mechanic": mechanics[1] if len(mechanics) > 1 else "Крафт", "resource": "предмет"},
                    {"action": "Испытать", "mechanic": mechanics[2] if len(mechanics) > 2 else "Враги", "resource": "результат"},
                    {"action": "Улучшить", "mechanic": mechanics[3] if len(mechanics) > 3 else "Прокачка оружия", "resource": "апгрейд"},
                ],
                loop_type=loop_type,
                fun_check="Созидательный цикл: сбор → крафт → испытание → улучшение",
                estimated_duration_seconds=90,
            ),
        ]
        return templates

    async def generate_usp(
        self,
        mechanic_set: MechanicSet,
        genre: str,
        core_loop_candidates: list[CoreLoopCandidate],
        reference_games: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> list[USPCandidate]:
        """
        Этап 5.2: Генерация 3 вариантов USP (Unique Selling Proposition).

        Формат: «Единственный [жанр], где [уникальная комбинация]».
        Проверка через Triangle of Weirdness.

        Returns:
            Список из 3 USPCandidate
        """
        start = time.time()

        # Формируем список механик
        all_mechanics = []
        for category in ["base", "combat", "progression", "spatial", "social"]:
            for m in getattr(mechanic_set, category, []):
                all_mechanics.append(m.get("name", ""))

        references_str = ", ".join(reference_games) if reference_games else "нет"

        candidates: list[USPCandidate] = []

        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="GENERATE_USP",
                inputs={
                    "mechanics": all_mechanics,
                    "genre": genre,
                    "references": references_str,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=True),
            )

            data = prompt_result.data
            if isinstance(data, list):
                for item in data[:3]:
                    triangle = item.get("triangle_check", {})
                    if isinstance(triangle, dict):
                        triangle_check = triangle
                    else:
                        triangle_check = {"weird": True, "appealing": True, "credible": True}

                    candidates.append(USPCandidate(
                        usp=item.get("usp", ""),
                        triangle_check=triangle_check,
                        competitive_differentiation=item.get("differentiation", ""),
                    ))

        except Exception as e:
            logger.warning(f"[Stage 5.2] AI generation failed, using fallback: {e}")

        # Fallback — если AI не вернул кандидатов
        if not candidates:
            candidates = self._fallback_usp_generation(all_mechanics, genre)

        logger.info(
            f"[Stage 5.2] USP candidates: {len(candidates)} variants "
            f"({time.time() - start:.2f}s)"
        )
        return candidates

    def _fallback_usp_generation(
        self, mechanics: list[str], genre: str
    ) -> list[USPCandidate]:
        """
        Fallback-генерация USP без AI.
        Создаёт базовые варианты на основе комбинаций механик.
        """
        mech_str = ", ".join(mechanics[:3]) if mechanics else "уникальные механики"
        genre_ru = {
            "rpg": "RPG", "shooter": "шутер", "strategy": "стратегия",
            "adventure": "приключение", "horror": "хоррор", "roguelike": "рогалик",
            "sandbox": "песочница", "simulation": "симулятор",
        }.get(genre, genre)

        return [
            USPCandidate(
                usp=f"Единственный {genre_ru}, где {mech_str} объединены в единый игровой цикл",
                triangle_check={"weird": True, "appealing": True, "credible": True},
                competitive_differentiation="Уникальная комбинация механик",
            ),
            USPCandidate(
                usp=f"{genre_ru.capitalize()}, где игрок создаёт собственный путь через {mech_str}",
                triangle_check={"weird": False, "appealing": True, "credible": True},
                competitive_differentiation="Фокус на игроковой автономии",
            ),
            USPCandidate(
                usp=f"{genre_ru.capitalize()} с нестандартным взаимодействием: {mech_str}",
                triangle_check={"weird": True, "appealing": True, "credible": False},
                competitive_differentiation="Инновационная механическая связка",
            ),
        ]

    # ========================================================
    # Полный пайплайн: Этапы 4–5
    # ========================================================

    async def generate_stages_4_5(
        self,
        genre_result: dict,
        aesthetic_profile: AestheticProfile,
        dynamics_profile: DynamicsProfile,
        platforms: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        reference_games: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> dict[str, Any]:
        """
        Полный пайплайн генерации концепции — Этапы 4–5 алгоритма 3.1.

        Выполняет последовательно:
        4. Выбор механик из MechanicsDB
        5. Генерацию Core Loop и USP

        Returns:
            {
                "mechanic_set": {...},          # Результат Этапа 4
                "core_loop_candidates": [...], # Результат Этапа 5.1
                "usp_candidates": [...],        # Результат Этапа 5.2
                "loop_type": "...",             # Структурный тип
                "stages_completed": [4, 5],
                "latency_ms": ...,
                "models_used": [...],
            }
        """
        pipeline_start = time.time()
        models_used: list[str] = []
        genre = genre_result.get("genre", "rpg")

        # === Этап 4: Выбор механик ===
        mechanic_set = self.select_mechanics(
            genre=genre,
            aesthetic_profile=aesthetic_profile,
            dynamics_profile=dynamics_profile,
            platforms=platforms,
            forbidden_mechanics=forbidden_mechanics,
            project_state=project_state,
        )

        # === Этап 5: Генерация Core Loop и USP ===
        core_loop_candidates = await self.generate_core_loops(
            mechanic_set=mechanic_set,
            aesthetic_profile=aesthetic_profile,
            dynamics_profile=dynamics_profile,
            project_state=project_state,
        )
        models_used.append("GENERATE_CORE_LOOPS")

        usp_candidates = await self.generate_usp(
            mechanic_set=mechanic_set,
            genre=genre,
            core_loop_candidates=core_loop_candidates,
            reference_games=reference_games,
            project_state=project_state,
        )
        models_used.append("GENERATE_USP")

        loop_type = self._determine_loop_type(
            dynamics_profile.core_dynamics + dynamics_profile.supporting_dynamics,
            aesthetic_profile,
        )

        latency_ms = int((time.time() - pipeline_start) * 1000)

        logger.info(
            f"[Pipeline 4-5] Completed in {latency_ms}ms. "
            f"Mechanics: {mechanic_set.total_count}, "
            f"Core Loops: {len(core_loop_candidates)}, "
            f"USPs: {len(usp_candidates)}, "
            f"loop_type: {loop_type}"
        )

        return {
            "mechanic_set": mechanic_set.model_dump(),
            "core_loop_candidates": [c.model_dump() for c in core_loop_candidates],
            "usp_candidates": [c.model_dump() for c in usp_candidates],
            "loop_type": loop_type,
            "stages_completed": [4, 5],
            "latency_ms": latency_ms,
            "models_used": models_used,
        }

    # ========================================================
    # Полный пайплайн: Этапы 1–5
    # ========================================================

    async def generate_full(
        self,
        idea: str,
        explicit_genre: Optional[str] = None,
        target_motivations: Optional[list[str]] = None,
        experience_level: str = "midcore",
        platforms: Optional[list[str]] = None,
        constraints: Optional[dict] = None,
        reference_games: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> dict[str, Any]:
        """
        Полный пайплайн генерации концепции — Этапы 1–5 алгоритма 3.1.

        Выполняет все этапы последовательно:
        1. Классификацию жанра
        2. Определение эстетических ценностей
        3. Вывод динамик
        4. Выбор механик
        5. Генерацию Core Loop и USP

        Returns:
            Полный результат генерации концепции
        """
        pipeline_start = time.time()
        all_models_used: list[str] = []

        # Этапы 1–3
        stages_1_3 = await self.generate_stages_1_3(
            idea=idea,
            explicit_genre=explicit_genre,
            target_motivations=target_motivations,
            experience_level=experience_level,
            platforms=platforms,
            constraints=constraints,
            reference_games=reference_games,
            forbidden_mechanics=forbidden_mechanics,
            project_state=project_state,
        )
        all_models_used.extend(stages_1_3.get("models_used", []))

        # Восстанавливаем Pydantic-модели из dict
        aesthetic_profile = AestheticProfile(**stages_1_3["aesthetic_profile"])
        dynamics_profile = DynamicsProfile(**stages_1_3["dynamics_profile"])

        # Этапы 4–5
        stages_4_5 = await self.generate_stages_4_5(
            genre_result=stages_1_3["genre_result"],
            aesthetic_profile=aesthetic_profile,
            dynamics_profile=dynamics_profile,
            platforms=platforms,
            forbidden_mechanics=forbidden_mechanics,
            reference_games=reference_games,
            project_state=project_state,
        )
        all_models_used.extend(stages_4_5.get("models_used", []))

        total_latency_ms = int((time.time() - pipeline_start) * 1000)

        return {
            "genre_result": stages_1_3["genre_result"],
            "aesthetic_profile": stages_1_3["aesthetic_profile"],
            "dynamics_profile": stages_1_3["dynamics_profile"],
            "mechanic_set": stages_4_5["mechanic_set"],
            "core_loop_candidates": stages_4_5["core_loop_candidates"],
            "usp_candidates": stages_4_5["usp_candidates"],
            "loop_type": stages_4_5["loop_type"],
            "stages_completed": [1, 2, 3, 4, 5],
            "latency_ms": total_latency_ms,
            "models_used": all_models_used,
        }
