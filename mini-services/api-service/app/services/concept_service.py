"""
Gidede — Concept Service
Фаза 4.B.2: Блок 1 — алгоритм генерации концепции (Этапы 1–3)

Реализация пайплайна генерации концепции из алгоритма 3.1:
- Этап 1: Анализ и определение жанра (CLASSIFY_GENRE)
- Этап 2: Reverse MDA — определение эстетики (EXTRACT_AESTHETICS)
- Этап 3: Reverse MDA — вывод динамик (SUGGEST_DYNAMICS + маппинг ЦА→эстетика→динамика)

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
)

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
    Реализует алгоритм 3.1 — Этапы 1–3.

    Методы:
    - classify_genre() — Этап 1: определение жанра
    - extract_aesthetics() — Этап 2: определение эстетических ценностей
    - derive_dynamics() — Этап 3: вывод динамик из эстетик
    - generate_stages_1_3() — полный пайплайн Этапов 1–3
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
