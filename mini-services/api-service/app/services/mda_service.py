"""
Gidede — MDA Service
Фаза 4.B.9–4.B.10: Блок 3 — алгоритм MDA Lab (Этапы 1–6)

Реализация пайплайна MDA из алгоритма 3.3:
- Этап 1: Reverse MDA — определение целевых динамик (3.3.3)
  • Формализованный маппинг «Эстетика → Динамика»
  • Жанровая фильтрация
  • AI-обогащение через SUGGEST_DYNAMICS
  • Приоритизация динамик

- Этап 2: Reverse MDA — маппинг «Динамика → Механики» (3.3.4)
  • Генерация пула кандидатов из MechanicsDB
  • Паттерны Adams/Dormans (Кн. 4)
  • AI-расширение пула через SUGGEST_MECHANICS
  • Перекрёстный анализ покрытия
  • Оптимизация покрытия (Set Cover — жадная аппроксимация)
  • Добавление синергетических механик

- Этап 3: Сборка и оптимизация набора механик (3.3.5)
  • Обработка конфликтов
  • Добавление обязательных механик
  • Удаление запрещённых механик
  • Проверка покрытия эстетик
  • Проверка паттернов Adams/Dormans
  • Группировка механик по структурным ролям

- Этап 4: Classic MDA — аналитический проход (3.3.6)
  • Моделирование геймплея (SIMULATE_GAMEPLAY)
  • Вывод динамик из симуляции
  • Вывод эстетики из динамик
  • Сравнение с целевой эстетикой
  • Проверка сходимости и коррекция

- Этап 5: Валидация через Линзы Шелла (3.3.7)
  • Выбор 9 приоритетных линз
  • AI-оценка через APPLY_LENS_MDA
  • Агрегация результатов

- Этап 6: Матрица 4×3 Бонда + лудонарративный анализ (3.3.8)
  • Заполнение матрицы (4 элемента × 3 уровня)
  • Горизонтальная и вертикальная согласованность
  • Обнаружение лудонарративного диссонанса (CHECK_LUDONARRATIVE_MDA)

Итеративный цикл: maxIterations=3 с проверкой покрытия.

Зависимости: 4.A.7 (PromptExecutor), 4.A.8 (Prompt Registry), 4.A.12 (Shared Types)
"""

import time
import logging
from typing import Any, Optional

from app.ai.executor import PromptExecutor, PromptResult, PromptExecutionOptions
from app.prompts.registry import get_prompt_spec

from app.schemas.mda import (
    DynamicsTarget,
    DynamicItem,
    MechanicCandidate,
    MechanicCandidateSet,
    StructuredMechanicSet,
    AestheticCoverage,
    AdamsDormansPattern,
    ClassicMDAResult,
    GameplaySequenceStep,
    ResourceFlow,
    FeedbackLoop,
    StabilityCheck,
    LensValidation,
    LensResult,
    BondValidation,
    BondMatrixCell,
    RowConsistency,
    ColumnConsistency,
    LudonarrativeCheck,
    MDAProfile,
)

from app.schemas.concept import AestheticProfile

# MechanicsDB — 128 механик в 15 группах (SW.BAND, Кн. 15)
from app.data.mechanics_db import MECHANICS_DB_DATA

logger = logging.getLogger(__name__)


# ============================================================
# Константы: маппинги из алгоритма 3.3
# ============================================================

# Маппинг «Эстетика → Динамика» (алгоритм 3.3.3)
# Расширенная таблица из Библии геймдизайна, разд. 2.3
AESTHETIC_DYNAMICS_MAP: dict[str, list[str]] = {
    "sensation": [
        "Непосредственный сенсорный фидбэк (мс–с)",
        "Кинестетическое удовольствие от управления",
        "Зрелищность эффектов и анимаций",
        "Синестезия (визуал ↔ звук ↔ тактильность)",
    ],
    "fantasy": [
        "Идентификация с ролью/персонажем",
        "Иммерсия через согласованность мира",
        "Отыгрыш через механики (действия = роль)",
        "Трансформация (игрок меняется вместе с аватаром)",
    ],
    "narrative": [
        "Драматическая арка (напряжение → кульминация → разрешение)",
        "Раскрытие информации (от скрытого к явному)",
        "Последствия выбора (агентивность в сюжете)",
        "Эмергентный нарратив (истории из геймплея)",
    ],
    "challenge": [
        "Баланс навык/сложность (зона потока)",
        "Нарастание сложности (кривая вызова)",
        "Негативная ОС при ошибке + позитивная при успехе",
        "Треугольность (осмысленный выбор риска)",
    ],
    "fellowship": [
        "Кооперация (зависимость между игроками)",
        "Распределённые роли (каждый незаменим)",
        "Общие цели + индивидуальные мотивации",
        "Коммуникация как ресурс/механика",
    ],
    "discovery": [
        "Исследование (скрытая информация, тайны)",
        "Нелинейность (множество путей)",
        "«А-ха!» моменты (эврика)",
        "Системное понимание (как устроен мир)",
    ],
    "expression": [
        "Персонализация (кастомизация аватара, базы, стиля)",
        "Творчество (конструктивные механики)",
        "Отсутствие единственного «правильного» пути",
        "Демонстрация (показ другим игрокам)",
    ],
    "submission": [
        "Структурированная рутина (петли гринда)",
        "Управление ресурсами (оптимизация)",
        "Предсказуемые правила (прозрачная система)",
        "Микро-цели (регулярные мелкие награды)",
    ],
}

# Маппинг «Динамика → Релевантные механики» (алгоритм 3.3.4)
# Ключевые соответствия из спецификации
DYNAMICS_MECHANICS_MAP: dict[str, list[str]] = {
    "Непосредственный сенсорный фидбэк (мс–с)": [
        "Действия (кинетические)", "Эстетическое оформление", "Сочность",
    ],
    "Кинестетическое удовольствие от управления": [
        "Прыжки", "Рывок", "Гравитация", "Паркур",
    ],
    "Зрелищность эффектов и анимаций": [
        "Комбо", "Спецатаки", "Эстетическое оформление",
    ],
    "Идентификация с ролью/персонажем": [
        "Классы", "Характеристики", "Обмундирование", "Прокачка оружия",
    ],
    "Иммерсия через согласованность мира": [
        "Карта мира", "Нарратив", "Фракции", "Цикл день/ночь",
    ],
    "Отыгрыш через механики (действия = роль)": [
        "Классы", "Магия", "Навыки", "Репутация",
    ],
    "Драматическая арка (напряжение → кульминация → разрешение)": [
        "Квесты", "Боссы", "Выбор сюжета", "Конфликт",
    ],
    "Раскрытие информации (от скрытого к явному)": [
        "Сканирование", "Туман войны", "Миникарта", "Лоры",
    ],
    "Баланс навык/сложность (зона потока)": [
        "Враги", "Головоломки", "Сложность", "Уровни",
    ],
    "Нарастание сложности (кривая вызова)": [
        "Очки опыта", "Уровни", "Сложность", "Характеристики",
    ],
    "Кооперация (зависимость между игроками)": [
        "Кооперация", "Роли", "Торг", "Гильдии",
    ],
    "Исследование (скрытая информация, тайны)": [
        "Карта мира", "Тайники", "Неопределённость", "Альтернативы",
    ],
    "Персонализация (кастомизация аватара, базы, стиля)": [
        "Кастомизация", "Крафт", "Строительство", "Обмундирование",
    ],
    "Структурированная рутина (петли гринда)": [
        "Очки опыта", "Фермерство", "Ресурсы", "Достижения и очки",
    ],
    "Управление ресурсами (оптимизация)": [
        "Ресурсы", "Крафт", "Экономика", "Инвентарь",
    ],
    "Предсказуемые правила (прозрачная система)": [
        "Характеристики", "Перки", "Древо технологий", "Мана",
    ],
}

# Паттерны Adams/Dormans (Кн. 4, алгоритм 3.3.4–3.3.5)
ADAMS_PATTERNS: list[dict[str, Any]] = [
    {
        "name": "Static Engine",
        "type": "engine",
        "description": "Стабильный источник ресурсов",
        "supports_dynamics": [
            "Структурированная рутина (петли гринда)",
            "Предсказуемые правила (прозрачная система)",
            "Управление ресурсами (оптимизация)",
        ],
    },
    {
        "name": "Dynamic Engine",
        "type": "engine",
        "description": "Открываемые улучшения (усиливающая петля)",
        "supports_dynamics": [
            "Исследование (скрытая информация, тайны)",
            "Нарастание сложности (кривая вызова)",
            "Непосредственный сенсорный фидбэк (мс–с)",
        ],
    },
    {
        "name": "Engine Building",
        "type": "engine",
        "description": "Самоконструирование (игрок строит свою систему)",
        "supports_dynamics": [
            "Персонализация (кастомизация аватара, базы, стиля)",
            "Идентификация с ролью/персонажем",
            "Творчество (конструктивные механики)",
        ],
    },
    {
        "name": "Static Friction",
        "type": "friction",
        "description": "Постоянное сопротивление (расход ресурсов)",
        "supports_dynamics": [
            "Структурированная рутина (петли гринда)",
            "Управление ресурсами (оптимизация)",
            "Баланс навык/сложность (зона потока)",
        ],
    },
    {
        "name": "Escalating Challenge",
        "type": "escalation",
        "description": "Нарастание сложности (динамическое трение)",
        "supports_dynamics": [
            "Нарастание сложности (кривая вызова)",
            "Баланс навык/сложность (зона потока)",
            "Драматическая арка (напряжение → кульминация → разрешение)",
        ],
    },
    {
        "name": "Escalating Complexity",
        "type": "escalation",
        "description": "Нарастание сложности через новые элементы",
        "supports_dynamics": [
            "Нарастание сложности (кривая вызова)",
            "«А-ха!» моменты (эврика)",
            "Системное понимание (как устроен мир)",
        ],
    },
    {
        "name": "Trade",
        "type": "conversion",
        "description": "Обмен ресурсов между игроками/системами",
        "supports_dynamics": [
            "Кооперация (зависимость между игроками)",
            "Управление ресурсами (оптимизация)",
            "Коммуникация как ресурс/механика",
        ],
    },
    {
        "name": "Play-Style Reinforcement",
        "type": "other",
        "description": "Усиление стиля игры через выбор",
        "supports_dynamics": [
            "Персонализация (кастомизация аватара, базы, стиля)",
            "Отсутствие единственного «правильного» пути",
            "Идентификация с ролью/персонажем",
        ],
    },
]

# Уровни эмерджентности (Фромма, через Кн. 4)
EMERGENCE_LEVELS: dict[str, str] = {
    "nominal": "Номинальная — нет обратной связи между динамиками. Слишком предсказуемо.",
    "weak": "Слабая — однонаправленная ОС. Достаточно для коридорных игр.",
    "multiple": "Множественная — множественные обратные связи. Рекомендуемый уровень для большинства жанров.",
    "strong": "Сильная — сильно переплетённые ОС. Только для песочниц и симуляций.",
}

# Жанровая фильтрация динамик (алгоритм 3.3.3)
# Динамики, нетипичные для определённых жанров
GENRE_DYNAMICS_WARNINGS: dict[str, list[str]] = {
    "puzzle": ["Кооперация (зависимость между игроками)", "Коммуникация как ресурс/механика"],
    "visual_novel": [
        "Баланс навык/сложность (зона потока)",
        "Нарастание сложности (кривая вызова)",
        "Треугольность (осмысленный выбор риска)",
    ],
    "idle": [
        "Баланс навык/сложность (зона потока)",
        "Кинестетическое удовольствие от управления",
    ],
    "party": [
        "Драматическая арка (напряжение → кульминация → разрешение)",
        "Идентификация с ролью/персонажем",
    ],
}

# Высокая эмерджентность для этих жанров
HIGH_EMERGENCE_GENRES = {"sandbox", "simulation", "roguelike", "mmorpg", "strategy", "tbs"}

# ============================================================
# Константы: Этапы 4–6 (алгоритм 3.3.6–3.3.8)
# ============================================================

# 9 приоритетных линз Шелла для MDA-валидации (алгоритм 3.3.7)
PRIORITY_LENSES: list[dict[str, Any]] = [
    {
        "id": 9,
        "name": "Тетрада",
        "focus": "Согласованность Механика/История/Эстетика/Технология",
        "category": "целостность",
    },
    {
        "id": 11,
        "name": "Единство",
        "focus": "Работают ли все элементы на общий замысел?",
        "category": "целостность",
    },
    {
        "id": 12,
        "name": "Резонанс",
        "focus": "Усиливают ли элементы друг друга?",
        "category": "целостность",
    },
    {
        "id": 30,
        "name": "Эмерджентность",
        "focus": "Сколько глаголов? Сколько результирующих действий?",
        "category": "эмерджентность",
    },
    {
        "id": 31,
        "name": "Пространство действий",
        "focus": "Совпадает ли воспринимаемое с реальным?",
        "category": "эмерджентность",
    },
    {
        "id": 40,
        "name": "Треугольность",
        "focus": "Осмысленный выбор риска vs безопасности",
        "category": "баланс",
    },
    {
        "id": 41,
        "name": "Доминантная стратегия",
        "focus": "Есть ли один очевидно лучший путь?",
        "category": "баланс",
    },
    {
        "id": 69,
        "name": "Кривая интереса",
        "focus": "Пики и спады интереса на протяжении игры",
        "category": "интерес",
    },
    {
        "id": 74,
        "name": "Свобода vs управляемость",
        "focus": "Баланс агентивности и замысла",
        "category": "интерес",
    },
]

# Обратная таблица: динамика → эстетика (для Classic MDA)
DYNAMICS_TO_AESTHETICS: dict[str, dict[str, float]] = {
    "Непосредственный сенсорный фидбэк (мс–с)": {"sensation": 0.9, "challenge": 0.2},
    "Кинестетическое удовольствие от управления": {"sensation": 0.85, "challenge": 0.3},
    "Зрелищность эффектов и анимаций": {"sensation": 0.8, "expression": 0.3},
    "Синестезия (визуал ↔ звук ↔ тактильность)": {"sensation": 0.95, "discovery": 0.2},
    "Идентификация с ролью/персонажем": {"fantasy": 0.9, "expression": 0.3},
    "Иммерсия через согласованность мира": {"fantasy": 0.85, "narrative": 0.3, "discovery": 0.3},
    "Отыгрыш через механики (действия = роль)": {"fantasy": 0.8, "expression": 0.4},
    "Трансформация (игрок меняется вместе с аватаром)": {"fantasy": 0.75, "submission": 0.3},
    "Драматическая арка (напряжение → кульминация → разрешение)": {"narrative": 0.9, "challenge": 0.3},
    "Раскрытие информации (от скрытого к явному)": {"narrative": 0.8, "discovery": 0.5},
    "Последствия выбора (агентивность в сюжете)": {"narrative": 0.85, "expression": 0.3},
    "Эмергентный нарратив (истории из геймплея)": {"narrative": 0.7, "discovery": 0.4, "fellowship": 0.2},
    "Баланс навык/сложность (зона потока)": {"challenge": 0.9, "sensation": 0.2},
    "Нарастание сложности (кривая вызова)": {"challenge": 0.85, "submission": 0.3},
    "Негативная ОС при ошибке + позитивная при успехе": {"challenge": 0.8, "narrative": 0.2},
    "Треугольность (осмысленный выбор риска)": {"challenge": 0.75, "discovery": 0.3},
    "Кооперация (зависимость между игроками)": {"fellowship": 0.9, "narrative": 0.2},
    "Распределённые роли (каждый незаменим)": {"fellowship": 0.85, "expression": 0.3},
    "Общие цели + индивидуальные мотивации": {"fellowship": 0.8, "challenge": 0.2},
    "Коммуникация как ресурс/механика": {"fellowship": 0.75, "narrative": 0.3},
    "Исследование (скрытая информация, тайны)": {"discovery": 0.9, "fantasy": 0.2},
    "Нелинейность (множество путей)": {"discovery": 0.85, "expression": 0.3},
    "«А-ха!» моменты (эврика)": {"discovery": 0.9, "challenge": 0.3},
    "Системное понимание (как устроен мир)": {"discovery": 0.8, "submission": 0.2},
    "Персонализация (кастомизация аватара, базы, стиля)": {"expression": 0.9, "fantasy": 0.2},
    "Творчество (конструктивные механики)": {"expression": 0.85, "discovery": 0.3},
    "Отсутствие единственного «правильного» пути": {"expression": 0.8, "discovery": 0.4},
    "Демонстрация (показ другим игрокам)": {"expression": 0.75, "fellowship": 0.4},
    "Структурированная рутина (петли гринда)": {"submission": 0.9, "challenge": 0.1},
    "Управление ресурсами (оптимизация)": {"submission": 0.85, "challenge": 0.2},
    "Предсказуемые правила (прозрачная система)": {"submission": 0.8, "discovery": 0.1},
    "Микро-цели (регулярные мелкие награды)": {"submission": 0.85, "challenge": 0.2},
}

# Элементы матрицы Бонда (Кн. 17)
BOND_ELEMENTS = ["Механика", "История", "Эстетика", "Технология"]
BOND_LEVELS = ["Фиксированный", "Динамический", "Культурный"]


# ============================================================
# MDA Service
# ============================================================

class MDAService:
    """
    Блок 3: MDA Lab.
    Реализует алгоритм 3.3 — Этапы 1–6.

    Методы:
    - determine_target_dynamics() — Этап 1: определение целевых динамик
    - map_dynamics_to_mechanics() — Этап 2: маппинг «Динамика → Механики»
    - assemble_mechanic_set() — Этап 3: сборка и оптимизация набора
    - classic_mda_pass() — Этап 4: Classic MDA аналитический проход
    - validate_lenses() — Этап 5: валидация через Линзы Шелла
    - validate_bond_matrix() — Этап 6: Матрица 4×3 Бонда + лудонарративный анализ
    - analyze_stages_1_3() — полный пайплайн Этапов 1–3
    - analyze_full() — полный пайплайн Этапов 1–6
    """

    def __init__(self, executor: PromptExecutor):
        self.executor = executor

    # ========================================================
    # Этап 1: Reverse MDA — определение целевых динамик (3.3.3)
    # ========================================================

    async def determine_target_dynamics(
        self,
        aesthetic_profile: AestheticProfile,
        genre: str,
        idea: str = "",
        project_state: Optional[dict] = None,
    ) -> DynamicsTarget:
        """
        Этап 1: Определение целевых динамик на основе эстетического профиля.

        Алгоритм 3.3.3:
        1. Формализованный маппинг «Эстетика → Динамика»
        2. Жанровая фильтрация (отметить нетипичные)
        3. AI-обогащение через SUGGEST_DYNAMICS
        4. Приоритизация динамик
        5. Оценка эмерджентности

        Returns:
            DynamicsTarget с core, supporting, context динамиками
        """
        start = time.time()

        # === Шаг 1.1: Формализованный маппинг ===
        all_dynamics: list[DynamicItem] = []

        for aesthetic in [aesthetic_profile.primary, aesthetic_profile.secondary, aesthetic_profile.tertiary]:
            mapped = AESTHETIC_DYNAMICS_MAP.get(aesthetic, [])
            for dynamic_name in mapped:
                # Проверяем, нет ли уже этой динамики
                existing = next((d for d in all_dynamics if d.name == dynamic_name), None)
                if existing:
                    # Добавляем эстетику, если ещё не учтена
                    if aesthetic not in existing.aesthetics_served:
                        existing.aesthetics_served.append(aesthetic)
                else:
                    all_dynamics.append(
                        DynamicItem(
                            name=dynamic_name,
                            aesthetics_served=[aesthetic],
                            genre_fit=1.0,
                            source="formal",
                        )
                    )

        # === Шаг 1.2: Жанровая фильтрация ===
        genre_warnings = GENRE_DYNAMICS_WARNINGS.get(genre, [])
        warnings: list[str] = []

        for dynamic in all_dynamics:
            if dynamic.name in genre_warnings:
                dynamic.genre_fit = 0.3
                dynamic.warning = (
                    f"Динамика '{dynamic.name}' редка для жанра '{genre}'. "
                    f"Это может создать уникальный опыт или диссонанс."
                )
                warnings.append(dynamic.warning)

        # === Шаг 1.3: AI-обогащение ===
        context_dynamics: list[DynamicItem] = []
        try:
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
                    if dynamic_name and not any(d.name == dynamic_name for d in all_dynamics):
                        aesthetics_served = item.get("aesthetics_served", [])
                        genre_fit = item.get("genre_fit", 0.5)

                        context_dynamic = DynamicItem(
                            name=dynamic_name,
                            aesthetics_served=aesthetics_served,
                            genre_fit=genre_fit,
                            source="ai",
                            reasoning=item.get("reasoning", ""),
                        )
                        context_dynamics.append(context_dynamic)
                        all_dynamics.append(context_dynamic)

        except Exception as e:
            logger.warning(
                f"[Stage 1] AI enrichment (SUGGEST_DYNAMICS) failed, "
                f"using formalized dynamics only: {e}"
            )

        # === Шаг 1.4: Приоритизация ===
        # Сортировка: количество порождаемых эстетик (desc), жанровое соответствие (desc)
        all_dynamics.sort(
            key=lambda d: (
                len(d.aesthetics_served),
                d.genre_fit,
            ),
            reverse=True,
        )

        # Разделение на core / supporting
        core_dynamics = [d.name for d in all_dynamics[:6]]
        supporting_dynamics = [d.name for d in all_dynamics[6:12]]

        # === Шаг 1.5: Оценка эмерджентности ===
        emergence_level = self._assess_emergence(all_dynamics, genre)
        emergence_description = EMERGENCE_LEVELS.get(emergence_level, "")

        # Обоснование
        rationale = self._build_dynamics_rationale(
            aesthetic_profile, core_dynamics, supporting_dynamics
        )

        dynamics_target = DynamicsTarget(
            core_dynamics=core_dynamics,
            supporting_dynamics=supporting_dynamics,
            context_dynamics=context_dynamics,
            all_dynamics=all_dynamics[:12],
            emergence_level=emergence_level,
            emergence_description=emergence_description,
            rationale=rationale,
            warnings=warnings,
        )

        logger.info(
            f"[Stage 1] Target dynamics: "
            f"{len(core_dynamics)} core, {len(supporting_dynamics)} supporting, "
            f"emergence={emergence_level} "
            f"({time.time() - start:.2f}s)"
        )
        return dynamics_target

    def _assess_emergence(
        self,
        dynamics: list[DynamicItem],
        genre: str,
    ) -> str:
        """
        Оценка уровня эмерджентности по Фромму (Кн. 4).

        Уровни: nominal / weak / multiple / strong
        """
        total = len(dynamics)

        # Считаем динамики, которые обслуживают несколько эстетик
        multi_aesthetic = sum(1 for d in dynamics if len(d.aesthetics_served) >= 2)

        if genre in HIGH_EMERGENCE_GENRES and total >= 8 and multi_aesthetic >= 3:
            return "strong"
        elif total >= 6 and multi_aesthetic >= 2:
            return "multiple"
        elif total >= 3:
            return "weak"
        else:
            return "nominal"

    def _build_dynamics_rationale(
        self,
        aesthetic_profile: AestheticProfile,
        core_dynamics: list[str],
        supporting_dynamics: list[str],
    ) -> str:
        """Построить текстовое обоснование выбора динамик."""
        aesthetic_names_ru = {
            "sensation": "Чувственное", "fantasy": "Фантазия",
            "narrative": "Нарратив", "challenge": "Вызов",
            "fellowship": "Товарищество", "discovery": "Открытие",
            "expression": "Выражение", "submission": "Подчинение",
        }

        primary_ru = aesthetic_names_ru.get(
            aesthetic_profile.primary, aesthetic_profile.primary
        )
        secondary_ru = aesthetic_names_ru.get(
            aesthetic_profile.secondary, aesthetic_profile.secondary
        )

        return (
            f"Основные динамики ({len(core_dynamics)}) создают {primary_ru} "
            f"— ключевую эстетику проекта. "
            f"Поддерживающие динамики ({len(supporting_dynamics)}) "
            f"усиливают {secondary_ru} и обеспечивают глубину взаимодействия."
        )

    # ========================================================
    # Этап 2: Маппинг «Динамика → Механики» (3.3.4)
    # ========================================================

    async def map_dynamics_to_mechanics(
        self,
        dynamics_target: DynamicsTarget,
        genre: str,
        aesthetic_profile: AestheticProfile,
        existing_mechanics: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        max_mechanics: int = 18,
        min_mechanics: int = 8,
        project_state: Optional[dict] = None,
    ) -> MechanicCandidateSet:
        """
        Этап 2: Маппинг «Динамика → Механики».

        Алгоритм 3.3.4:
        1. Генерация пула кандидатов для каждой динамики
        2. Перекрёстный анализ — какие механики покрывают больше динамик
        3. Оптимизация покрытия (Set Cover — жадная аппроксимация)
        4. Добавление синергетических механик

        Returns:
            MechanicCandidateSet с выбранными механиками и покрытием
        """
        start = time.time()

        all_dynamics_names = (
            dynamics_target.core_dynamics + dynamics_target.supporting_dynamics
        )
        forbidden = set(forbidden_mechanics or [])

        # === Шаг 2.1: Генерация пула кандидатов ===
        mechanic_candidates: dict[str, list[MechanicCandidate]] = {}

        for dynamic_name in all_dynamics_names:
            candidates: list[MechanicCandidate] = []

            # 2.1.1: Формализованный отбор из MechanicsDB
            formal_mechanics = self._get_formal_mechanics(dynamic_name, genre)
            candidates.extend(formal_mechanics)

            # 2.1.2: Паттерны Adams/Dormans
            pattern_mechanics = self._get_adams_pattern_mechanics(dynamic_name, genre)
            candidates.extend(pattern_mechanics)

            # 2.1.3: AI-расширение пула
            try:
                ai_mechanics = await self._get_ai_mechanics(
                    dynamic_name, genre, [c.name for c in candidates], project_state
                )
                candidates.extend(ai_mechanics)
            except Exception as e:
                logger.warning(
                    f"[Stage 2] AI enrichment (SUGGEST_MECHANICS) for "
                    f"'{dynamic_name}' failed: {e}"
                )

            # Удаляем запрещённые
            candidates = [c for c in candidates if c.name not in forbidden]

            # Удаляем дубликаты по имени
            seen_names: set[str] = set()
            unique_candidates = []
            for c in candidates:
                if c.name not in seen_names:
                    seen_names.add(c.name)
                    unique_candidates.append(c)

            mechanic_candidates[dynamic_name] = unique_candidates

        # === Шаг 2.2: Перекрёстный анализ покрытия ===
        all_candidates: list[MechanicCandidate] = []
        seen_all: set[str] = set()
        for candidates_list in mechanic_candidates.values():
            for c in candidates_list:
                if c.name not in seen_all:
                    seen_all.add(c.name)
                    all_candidates.append(c)

        # Карта покрытия: кандидат → [динамики, которые он покрывает]
        coverage_map: dict[str, list[str]] = {}
        for candidate in all_candidates:
            covered = []
            for dynamic_name, candidates_list in mechanic_candidates.items():
                if any(c.name == candidate.name for c in candidates_list):
                    covered.append(dynamic_name)
            coverage_map[candidate.name] = covered

        # === Шаг 2.3: Оптимизация покрытия (Set Cover) ===
        selected: list[MechanicCandidate] = []
        uncovered_dynamics = set(all_dynamics_names)
        remaining_candidates = list(all_candidates)

        while uncovered_dynamics and remaining_candidates:
            # Выбрать механику, покрывающую максимум непокрытых динамик
            best = None
            best_score = -1.0

            for candidate in remaining_candidates:
                covered = coverage_map.get(candidate.name, [])
                new_coverage = len(set(covered) & uncovered_dynamics)

                # Скор = покрытие + жанровая привязка + эстетическое пересечение
                score = (
                    float(new_coverage)
                    + candidate.genre_affinity * 0.3
                    + len(candidate.aesthetics_served) * 0.2
                )

                if score > best_score:
                    best_score = score
                    best = candidate

            if best is None or best_score <= 0:
                break

            selected.append(best)
            covered_by_best = set(coverage_map.get(best.name, []))
            uncovered_dynamics -= covered_by_best
            remaining_candidates.remove(best)

        # === Шаг 2.4: Добавление синергетических механик ===
        selected_names = {c.name for c in selected}

        synergy_candidates = []
        for candidate in all_candidates:
            if candidate.name not in selected_names:
                # Проверяем синергии с уже выбранными
                synergy_score = self._calculate_synergy_with_set(
                    candidate, selected
                )
                if synergy_score > 0.7 and candidate.genre_affinity >= 0.5:
                    synergy_candidates.append((candidate, synergy_score))

        # Сортируем по синергии
        synergy_candidates.sort(key=lambda x: x[1], reverse=True)

        for candidate, _ in synergy_candidates:
            if len(selected) < max_mechanics:
                selected.append(candidate)
                selected_names.add(candidate.name)
            else:
                break

        # === Построение результата ===
        # Проверка конфликтов
        conflict_pairs = self._check_conflicts(selected)
        synergy_pairs = self._check_synergies(selected)

        # Покрытие эстетик
        total_aesthetics_served = self._calculate_aesthetic_coverage(
            selected, aesthetic_profile
        )

        # Пересчёт карты покрытия для выбранных
        selected_coverage: dict[str, list[str]] = {}
        for candidate in selected:
            selected_coverage[candidate.name] = coverage_map.get(candidate.name, [])

        result = MechanicCandidateSet(
            mechanics=selected,
            dynamics_coverage=selected_coverage,
            uncovered_dynamics=list(uncovered_dynamics),
            synergy_pairs=synergy_pairs,
            conflict_pairs=conflict_pairs,
            total_aesthetics_served=total_aesthetics_served,
        )

        logger.info(
            f"[Stage 2] Mechanics mapped: "
            f"{len(selected)} selected, "
            f"{len(uncovered_dynamics)} uncovered dynamics, "
            f"{len(conflict_pairs)} conflicts, "
            f"{len(synergy_pairs)} synergies "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _get_formal_mechanics(
        self,
        dynamic_name: str,
        genre: str,
    ) -> list[MechanicCandidate]:
        """Получить механики из формализованного маппинга и MechanicsDB."""
        candidates = []

        # Из формализованного маппинга
        mapped_names = DYNAMICS_MECHANICS_MAP.get(dynamic_name, [])
        for name in mapped_names:
            # Поиск в MechanicsDB
            db_entry = next(
                (m for m in MECHANICS_DB_DATA if m["mechanic_name"] == name), None
            )
            if db_entry:
                candidates.append(
                    MechanicCandidate(
                        name=db_entry["mechanic_name"],
                        group_id=db_entry["group_id"],
                        group_name=db_entry["group_name"],
                        source="MechanicsDB",
                        dynamics_affinity=[dynamic_name],
                        genre_affinity=db_entry.get("genre_affinity", {}).get(genre, 0.5),
                        aesthetics_served=db_entry.get("aesthetics_served", []),
                        description=db_entry["description"],
                        conflicts_with=db_entry.get("conflicts_with", []),
                        synergies_with=db_entry.get("synergies_with", []),
                    )
                )
            else:
                # Механика не в DB — создаём кандидата с базовыми данными
                candidates.append(
                    MechanicCandidate(
                        name=name,
                        source="formal",
                        dynamics_affinity=[dynamic_name],
                        genre_affinity=0.5,
                    )
                )

        # Также ищем механики в DB, которые покрывают эту динамику
        for m in MECHANICS_DB_DATA:
            if dynamic_name in m.get("dynamics_served", []):
                if not any(c.name == m["mechanic_name"] for c in candidates):
                    candidates.append(
                        MechanicCandidate(
                            name=m["mechanic_name"],
                            group_id=m["group_id"],
                            group_name=m["group_name"],
                            source="MechanicsDB",
                            dynamics_affinity=[dynamic_name],
                            genre_affinity=m.get("genre_affinity", {}).get(genre, 0.5),
                            aesthetics_served=m.get("aesthetics_served", []),
                            description=m["description"],
                            conflicts_with=m.get("conflicts_with", []),
                            synergies_with=m.get("synergies_with", []),
                        )
                    )

        return candidates

    def _get_adams_pattern_mechanics(
        self,
        dynamic_name: str,
        genre: str,
    ) -> list[MechanicCandidate]:
        """Получить механики из паттернов Adams/Dormans."""
        candidates = []

        for pattern in ADAMS_PATTERNS:
            if dynamic_name in pattern.get("supports_dynamics", []):
                # Создаём виртуальную механику-паттерн
                candidates.append(
                    MechanicCandidate(
                        name=pattern["name"],
                        source="AdamsPattern",
                        dynamics_affinity=[dynamic_name],
                        genre_affinity=0.6,
                        description=pattern["description"],
                    )
                )

        return candidates

    async def _get_ai_mechanics(
        self,
        dynamic_name: str,
        genre: str,
        existing: list[str],
        project_state: Optional[dict] = None,
    ) -> list[MechanicCandidate]:
        """Получить механики через AI (SUGGEST_MECHANICS промпт)."""
        prompt_result: PromptResult = await self.executor.execute(
            prompt_id="SUGGEST_MECHANICS",
            inputs={
                "dynamic": dynamic_name,
                "genre": genre,
                "existing": existing[:10],  # Ограничиваем контекст
            },
            project_state=project_state,
            options=PromptExecutionOptions(skip_cache=False),
        )

        mechanics_data = prompt_result.data
        if not isinstance(mechanics_data, list):
            return []

        candidates = []
        for item in mechanics_data:
            mechanic_name = item.get("mechanic", "")
            if not mechanic_name:
                continue

            candidates.append(
                MechanicCandidate(
                    name=mechanic_name,
                    group_name=item.get("group", ""),
                    source="AI-Suggested",
                    dynamics_affinity=item.get("dynamics", [dynamic_name]),
                    genre_affinity=item.get("genre_affinity", 0.5),
                    description=item.get("description", ""),
                )
            )

        return candidates

    def _calculate_synergy_with_set(
        self,
        candidate: MechanicCandidate,
        selected: list[MechanicCandidate],
    ) -> float:
        """Рассчитать score синергии кандидата с уже выбранными механиками."""
        if not selected:
            return 0.0

        synergy_count = 0
        for s in selected:
            # Проверяем взаимные синергии
            if s.name in candidate.synergies_with:
                synergy_count += 1
            if candidate.name in s.synergies_with:
                synergy_count += 1
            # Проверяем пересечение эстетик
            overlap = len(set(candidate.aesthetics_served) & set(s.aesthetics_served))
            if overlap > 0:
                synergy_count += overlap

        # Нормализуем
        max_possible = len(selected) * 3  # Максимум: 3 точки на каждую пару
        return synergy_count / max_possible if max_possible > 0 else 0.0

    def _check_conflicts(
        self,
        mechanics: list[MechanicCandidate],
    ) -> list[dict]:
        """Проверить конфликты между выбранными механиками."""
        conflicts = []
        names = {m.name for m in mechanics}

        for m in mechanics:
            for conflict_name in m.conflicts_with:
                if conflict_name in names:
                    # Избегаем дублирования пар
                    pair = tuple(sorted([m.name, conflict_name]))
                    if not any(
                        c.get("mechanic_a") in pair and c.get("mechanic_b") in pair
                        for c in conflicts
                    ):
                        conflicts.append({
                            "mechanic_a": m.name,
                            "mechanic_b": conflict_name,
                            "severity": "warning",
                        })

        return conflicts

    def _check_synergies(
        self,
        mechanics: list[MechanicCandidate],
    ) -> list[dict]:
        """Проверить синергии между выбранными механиками."""
        synergies = []
        names = {m.name for m in mechanics}

        for m in mechanics:
            for synergy_name in m.synergies_with:
                if synergy_name in names and synergy_name != m.name:
                    pair = tuple(sorted([m.name, synergy_name]))
                    if not any(
                        s.get("mechanic_a") in pair and s.get("mechanic_b") in pair
                        for s in synergies
                    ):
                        synergies.append({
                            "mechanic_a": m.name,
                            "mechanic_b": synergy_name,
                            "strength": "strong",
                        })

        return synergies

    def _calculate_aesthetic_coverage(
        self,
        mechanics: list[MechanicCandidate],
        aesthetic_profile: AestheticProfile,
    ) -> dict[str, float]:
        """Рассчитать покрытие эстетик выбранными механиками."""
        coverage: dict[str, float] = {}

        for aesthetic in [
            aesthetic_profile.primary,
            aesthetic_profile.secondary,
            aesthetic_profile.tertiary,
        ]:
            covering_count = sum(
                1 for m in mechanics if aesthetic in m.aesthetics_served
            )
            total = len(mechanics) if mechanics else 1
            coverage[aesthetic] = min(1.0, covering_count / max(1, total) * 3)

        return coverage

    # ========================================================
    # Этап 3: Сборка и оптимизация набора механик (3.3.5)
    # ========================================================

    async def assemble_mechanic_set(
        self,
        candidate_set: MechanicCandidateSet,
        aesthetic_profile: AestheticProfile,
        genre: str,
        required_mechanics: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        project_state: Optional[dict] = None,
    ) -> StructuredMechanicSet:
        """
        Этап 3: Сборка и оптимизация набора механик.

        Алгоритм 3.3.5:
        1. Обработка конфликтов
        2. Добавление обязательных механик
        3. Удаление запрещённых механик
        4. Проверка покрытия эстетик
        5. Проверка паттернов Adams/Dormans
        6. Группировка по структурным ролям

        Returns:
            StructuredMechanicSet с финальным набором механик
        """
        start = time.time()

        mechanics = list(candidate_set.mechanics)
        warnings: list[str] = []
        conflicts_resolved: list[str] = []
        suggestions: list[str] = []

        # === Шаг 3.1: Обработка конфликтов ===
        conflicts = candidate_set.conflict_pairs
        for conflict in sorted(conflicts, key=lambda c: c.get("severity", "info"), reverse=True):
            a_name = conflict.get("mechanic_a", "")
            b_name = conflict.get("mechanic_b", "")

            # Если одна из конфликтующих обязательна — удалить другую
            required = set(required_mechanics or [])
            if a_name in required:
                mechanics = [m for m in mechanics if m.name != b_name]
                conflicts_resolved.append(
                    f"Удалена механика '{b_name}' из-за конфликта с обязательной '{a_name}'"
                )
            elif b_name in required:
                mechanics = [m for m in mechanics if m.name != a_name]
                conflicts_resolved.append(
                    f"Удалена механика '{a_name}' из-за конфликта с обязательной '{b_name}'"
                )
            else:
                # Удалить механику с меньшим покрытием динамик
                a_coverage = len(candidate_set.dynamics_coverage.get(a_name, []))
                b_coverage = len(candidate_set.dynamics_coverage.get(b_name, []))
                victim = a_name if a_coverage < b_coverage else b_name
                other = b_name if victim == a_name else a_name
                mechanics = [m for m in mechanics if m.name != victim]
                conflicts_resolved.append(
                    f"Удалена механика '{victim}' из-за конфликта с '{other}'"
                )

        # === Шаг 3.2: Добавление обязательных механик ===
        if required_mechanics:
            current_names = {m.name for m in mechanics}
            for req_name in required_mechanics:
                if req_name not in current_names:
                    # Ищем в MechanicsDB
                    db_entry = next(
                        (m for m in MECHANICS_DB_DATA if m["mechanic_name"] == req_name),
                        None,
                    )
                    if db_entry:
                        new_mechanic = MechanicCandidate(
                            name=db_entry["mechanic_name"],
                            group_id=db_entry["group_id"],
                            group_name=db_entry["group_name"],
                            source="MechanicsDB",
                            genre_affinity=db_entry.get("genre_affinity", {}).get(genre, 0.5),
                            aesthetics_served=db_entry.get("aesthetics_served", []),
                            description=db_entry["description"],
                            conflicts_with=db_entry.get("conflicts_with", []),
                            synergies_with=db_entry.get("synergies_with", []),
                        )
                    else:
                        new_mechanic = MechanicCandidate(
                            name=req_name,
                            source="required",
                            genre_affinity=0.5,
                        )

                    mechanics.append(new_mechanic)

                    # Проверяем новые конфликты
                    for m in mechanics:
                        if m.name != req_name and req_name in m.conflicts_with:
                            warnings.append(
                                f"Обязательная механика '{req_name}' конфликтует с '{m.name}'"
                            )

        # === Шаг 3.3: Удаление запрещённых механик ===
        if forbidden_mechanics:
            before = len(mechanics)
            mechanics = [m for m in mechanics if m.name not in set(forbidden_mechanics)]
            removed = before - len(mechanics)
            if removed > 0:
                conflicts_resolved.append(f"Удалено {removed} запрещённых механик")

        # === Шаг 3.4: Проверка покрытия эстетик ===
        aesthetic_coverage_list: list[AestheticCoverage] = []

        for aesthetic in [
            aesthetic_profile.primary,
            aesthetic_profile.secondary,
            aesthetic_profile.tertiary,
        ]:
            covering_mechanics = [
                m.name for m in mechanics if aesthetic in m.aesthetics_served
            ]
            count = len(covering_mechanics)
            sufficient = count >= 2

            if not sufficient:
                warnings.append(
                    f"Эстетика '{aesthetic}' недостаточно покрыта ({count} механик, "
                    f"рекомендуется >= 2)"
                )
                suggestions.append(
                    f"Добавьте механики, порождающие эстетику '{aesthetic}'"
                )

            aesthetic_coverage_list.append(
                AestheticCoverage(
                    aesthetic=aesthetic,
                    count=count,
                    mechanics=covering_mechanics,
                    sufficient=sufficient,
                )
            )

        # === Шаг 3.5: Проверка паттернов Adams/Dormans ===
        patterns_detected = self._detect_adams_patterns(mechanics, aesthetic_profile)

        for pattern in patterns_detected:
            if not pattern.present and pattern.suggestion:
                suggestions.append(pattern.suggestion)

        # === Шаг 3.6: Группировка механик по структурным ролям ===
        base_group = self._group_mechanics(mechanics, [1])
        combat_group = self._group_mechanics(mechanics, [4, 8])
        progression_group = self._group_mechanics(mechanics, [2, 9])
        spatial_group = self._group_mechanics(mechanics, [3, 5, 11])
        social_group = self._group_mechanics(mechanics, [7, 14])

        # Расчёт score совместимости
        compatibility_score = self._calculate_compatibility(mechanics)

        # Расчёт score синергии
        synergy_score = self._calculate_synergy_score(mechanics)

        result = StructuredMechanicSet(
            base=base_group,
            combat=combat_group,
            progression=progression_group,
            spatial=spatial_group,
            social=social_group,
            total_count=len(mechanics),
            aesthetic_coverage=aesthetic_coverage_list,
            patterns_detected=patterns_detected,
            compatibility_score=compatibility_score,
            synergy_score=synergy_score,
            conflicts_resolved=conflicts_resolved,
            suggestions=suggestions,
            warnings=warnings,
        )

        logger.info(
            f"[Stage 3] Mechanic set assembled: "
            f"{len(mechanics)} mechanics, "
            f"compat={compatibility_score:.1f}, synerg={synergy_score:.1f}, "
            f"{len(patterns_detected)} patterns, "
            f"{len(warnings)} warnings "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _detect_adams_patterns(
        self,
        mechanics: list[MechanicCandidate],
        aesthetic_profile: AestheticProfile,
    ) -> list[AdamsDormansPattern]:
        """Обнаружить паттерны Adams/Dormans в наборе механик."""
        mechanic_names = {m.name for m in mechanics}
        patterns = []

        # Engine: наличие источника ресурсов
        engine_mechanics = {"Очки опыта", "Ресурсы", "Фермерство", "Крафт"}
        has_engine = bool(mechanic_names & engine_mechanics)
        patterns.append(
            AdamsDormansPattern(
                name="Static Engine",
                pattern_type="engine",
                present=has_engine,
                supporting_mechanics=list(mechanic_names & engine_mechanics),
                suggestion=(
                    ""
                    if has_engine
                    else "Добавьте двигательную механику (источник ресурсов) для устойчивой экономики"
                ),
            )
        )

        # Friction: наличие расхода ресурсов
        friction_mechanics = {"Мана", "Запас патронов", "Голод", "Износ"}
        has_friction = bool(mechanic_names & friction_mechanics)
        patterns.append(
            AdamsDormansPattern(
                name="Static Friction",
                pattern_type="friction",
                present=has_friction,
                supporting_mechanics=list(mechanic_names & friction_mechanics),
                suggestion=(
                    ""
                    if has_friction
                    else "Добавьте трение (расход ресурсов) для предотвращения runaway"
                ),
            )
        )

        # Escalation: наличие нарастающей сложности
        escalation_mechanics = {"Сложность", "Уровни", "Характеристики", "Враги"}
        has_escalation = bool(mechanic_names & escalation_mechanics)
        patterns.append(
            AdamsDormansPattern(
                name="Escalating Challenge",
                pattern_type="escalation",
                present=has_escalation,
                supporting_mechanics=list(mechanic_names & escalation_mechanics),
                suggestion=(
                    ""
                    if has_escalation
                    else "Добавьте эскалацию (нарастание сложности) для долгосрочной мотивации"
                ),
            )
        )

        # Engine Building: кастомизация/строительство
        building_mechanics = {"Кастомизация", "Строительство", "Древо технологий", "Обмундирование"}
        has_building = bool(mechanic_names & building_mechanics)
        patterns.append(
            AdamsDormansPattern(
                name="Engine Building",
                pattern_type="engine",
                present=has_building,
                supporting_mechanics=list(mechanic_names & building_mechanics),
                suggestion=(
                    ""
                    if has_building
                    else "Добавьте конструктивные механики для самовыражения игрока"
                ),
            )
        )

        # Trade: социальное взаимодействие
        trade_mechanics = {"Торг", "Кооперация", "Экономика", "Репутация"}
        has_trade = bool(mechanic_names & trade_mechanics)
        patterns.append(
            AdamsDormansPattern(
                name="Trade",
                pattern_type="conversion",
                present=has_trade,
                supporting_mechanics=list(mechanic_names & trade_mechanics),
                suggestion=(
                    ""
                    if has_trade
                    else "Добавьте торговые механики для обмена ресурсами"
                ),
            )
        )

        return patterns

    def _group_mechanics(
        self,
        mechanics: list[MechanicCandidate],
        group_ids: list[int],
    ) -> list[dict]:
        """Группировать механики по ID групп MechanicsDB."""
        result = []
        for m in mechanics:
            if m.group_id in group_ids:
                result.append({
                    "name": m.name,
                    "group": m.group_name,
                    "description": m.description,
                    "source": m.source,
                })
            elif not m.group_id and m.source == "required":
                # Обязательные механики без группы добавляем в результат
                result.append({
                    "name": m.name,
                    "group": "required",
                    "description": m.description,
                    "source": m.source,
                })
        return result

    def _calculate_compatibility(
        self,
        mechanics: list[MechanicCandidate],
    ) -> float:
        """Рассчитать score совместимости набора (0-100)."""
        if not mechanics:
            return 0.0

        # Штраф за конфликты
        conflict_penalty = 0
        names = {m.name for m in mechanics}
        for m in mechanics:
            for conflict_name in m.conflicts_with:
                if conflict_name in names:
                    conflict_penalty += 10

        # Бонус за синергии
        synergy_bonus = 0
        for m in mechanics:
            for synergy_name in m.synergies_with:
                if synergy_name in names and synergy_name != m.name:
                    synergy_bonus += 5

        # Базовый score
        base_score = 60.0

        # Корректировки
        score = base_score - conflict_penalty + synergy_bonus

        # Бонус за разнообразие групп
        groups = {m.group_id for m in mechanics if m.group_id > 0}
        if len(groups) >= 4:
            score += 10
        elif len(groups) >= 3:
            score += 5

        return min(100.0, max(0.0, score))

    def _calculate_synergy_score(
        self,
        mechanics: list[MechanicCandidate],
    ) -> float:
        """Рассчитать score синергии набора (0-100)."""
        if len(mechanics) < 2:
            return 0.0

        names = {m.name for m in mechanics}
        total_synergies = 0
        possible_pairs = len(mechanics) * (len(mechanics) - 1) / 2

        for m in mechanics:
            for synergy_name in m.synergies_with:
                if synergy_name in names and synergy_name != m.name:
                    total_synergies += 1

        # Нормализуем: каждая синергия считается дважды
        raw_score = (total_synergies / 2) / max(1, possible_pairs)
        return min(100.0, raw_score * 100 * 3)  # Умножаем для наглядности

    # ========================================================
    # Полный пайплайн: Этапы 1–3
    # ========================================================

    async def analyze_stages_1_3(
        self,
        concept_id: str,
        aesthetic_profile: AestheticProfile,
        genre: str,
        idea: str = "",
        existing_mechanics: Optional[list[str]] = None,
        required_mechanics: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        max_mechanics: int = 18,
        min_mechanics: int = 8,
        max_iterations: int = 3,
        convergence_threshold: float = 0.8,
        project_state: Optional[dict] = None,
    ) -> MDAProfile:
        """
        Полный пайплайн MDA Lab — Этапы 1–3 алгоритма 3.3.

        Выполняет последовательно:
        1. Определение целевых динамик
        2. Маппинг «Динамика → Механики»
        3. Сборка и оптимизация набора механик

        Итеративный цикл: если покрытие эстетик недостаточно,
        повторяет с уточнёнными входными данными.

        Returns:
            MDAProfile с результатами Этапов 1–3
        """
        pipeline_start = time.time()
        models_used: list[str] = []

        iteration = 0
        best_profile: Optional[MDAProfile] = None

        while iteration < max_iterations:
            iteration += 1

            # === Этап 1: Целевые динамики ===
            dynamics_target = await self.determine_target_dynamics(
                aesthetic_profile=aesthetic_profile,
                genre=genre,
                idea=idea,
                project_state=project_state,
            )
            models_used.append("SUGGEST_DYNAMICS")

            # === Этап 2: Маппинг «Динамика → Механики» ===
            candidate_set = await self.map_dynamics_to_mechanics(
                dynamics_target=dynamics_target,
                genre=genre,
                aesthetic_profile=aesthetic_profile,
                existing_mechanics=existing_mechanics,
                forbidden_mechanics=forbidden_mechanics,
                max_mechanics=max_mechanics,
                min_mechanics=min_mechanics,
                project_state=project_state,
            )
            models_used.append("SUGGEST_MECHANICS")

            # === Этап 3: Сборка набора механик ===
            mechanic_set = await self.assemble_mechanic_set(
                candidate_set=candidate_set,
                aesthetic_profile=aesthetic_profile,
                genre=genre,
                required_mechanics=required_mechanics,
                forbidden_mechanics=forbidden_mechanics,
                project_state=project_state,
            )

            # Проверяем покрытие эстетик
            insufficient = [
                ac for ac in mechanic_set.aesthetic_coverage if not ac.sufficient
            ]

            latency_ms = int((time.time() - pipeline_start) * 1000)

            profile = MDAProfile(
                aesthetic_profile=aesthetic_profile.model_dump(),
                dynamics_target=dynamics_target,
                mechanic_candidate_set=candidate_set,
                mechanic_set=mechanic_set,
                genre=genre,
                concept_id=concept_id,
                iterations_done=iteration,
                stages_completed=[1, 2, 3],
                latency_ms=latency_ms,
                models_used=models_used,
            )

            best_profile = profile

            # Если покрытие достаточное — выходим
            if not insufficient:
                logger.info(
                    f"[Pipeline 1-3] Converged at iteration {iteration}. "
                    f"All aesthetics sufficiently covered."
                )
                break

            # Иначе — логируем и продолжаем
            logger.info(
                f"[Pipeline 1-3] Iteration {iteration}: "
                f"{len(insufficient)} aesthetics insufficiently covered. "
                f"Retrying..."
            )

            # Для следующей итерации: обновляем required_mechanics
            # на основе недостаточно покрытых эстетик
            for ac in insufficient:
                if required_mechanics is None:
                    required_mechanics = []
                # Добавляем механики, покрывающие слабую эстетику
                for m in MECHANICS_DB_DATA:
                    if ac.aesthetic in m.get("aesthetics_served", []):
                        if m["mechanic_name"] not in (required_mechanics or []):
                            required_mechanics = (required_mechanics or []) + [m["mechanic_name"]]
                            break

        logger.info(
            f"[Pipeline 1-3] Completed in {latency_ms}ms. "
            f"Iterations: {iteration}, "
            f"Genre: {genre}, "
            f"Mechanics: {best_profile.mechanic_set.total_count if best_profile.mechanic_set else 0}"
        )

        return best_profile or MDAProfile(
            aesthetic_profile=aesthetic_profile.model_dump(),
            genre=genre,
            concept_id=concept_id,
        )

    # ========================================================
    # Этап 4: Classic MDA — аналитический проход (3.3.6)
    # ========================================================

    async def classic_mda_pass(
        self,
        mechanic_set: StructuredMechanicSet,
        aesthetic_profile: AestheticProfile,
        dynamics_target: DynamicsTarget,
        genre: str,
        convergence_threshold: float = 0.8,
        max_iterations: int = 3,
        project_state: Optional[dict] = None,
    ) -> ClassicMDAResult:
        """
        Этап 4: Classic MDA — аналитический проход.

        Алгоритм 3.3.6:
        1. Моделирование геймплея (SIMULATE_GAMEPLAY)
        2. Вывод динамик из симуляции
        3. Вывод эстетики из динамик
        4. Сравнение с целевой эстетикой
        5. Проверка сходимости и коррекция

        Returns:
            ClassicMDAResult с моделированным геймплеем и оценкой сходимости
        """
        start = time.time()
        warnings: list[str] = []
        suggestions: list[str] = []

        # Собираем имена всех механик
        all_mechanics: list[str] = []
        for group_key in ["base", "combat", "progression", "spatial", "social"]:
            group = getattr(mechanic_set, group_key, [])
            all_mechanics.extend(m.get("name", "") for m in group if m.get("name"))

        iteration = 0
        converged = False
        overall_match = 0.0
        match_scores: dict[str, float] = {}
        predicted_aesthetics: dict[str, float] = {}
        observed_dynamics: list[str] = []
        gameplay_sequence: list[GameplaySequenceStep] = []
        resource_flows: list[ResourceFlow] = []
        feedback_loops: list[FeedbackLoop] = []
        stability: Optional[StabilityCheck] = None
        gameplay_script = ""

        while iteration < max_iterations and not converged:
            iteration += 1

            # === Шаг 4.1: Моделирование геймплея ===
            try:
                prompt_result: PromptResult = await self.executor.execute(
                    prompt_id="SIMULATE_GAMEPLAY",
                    inputs={
                        "mechanics": all_mechanics,
                        "genre": genre,
                    },
                    project_state=project_state,
                    options=PromptExecutionOptions(skip_cache=False),
                )

                sim_data = prompt_result.data if isinstance(prompt_result.data, dict) else {}

                # Парсинг gameplay sequence
                if "gameplay_sequence" in sim_data:
                    gameplay_sequence = [
                        GameplaySequenceStep(
                            step_number=i + 1,
                            action=step.get("action", "") if isinstance(step, dict) else str(step),
                            mechanics_used=step.get("mechanics_used", []) if isinstance(step, dict) else [],
                            resources_consumed=step.get("resources_consumed", []) if isinstance(step, dict) else [],
                            resources_produced=step.get("resources_produced", []) if isinstance(step, dict) else [],
                        )
                        for i, step in enumerate(sim_data["gameplay_sequence"])
                        if isinstance(step, (dict, str))
                    ]

                # Парсинг resource flows
                if "resource_flows" in sim_data:
                    resource_flows = [
                        ResourceFlow(
                            source=flow.get("source", "") if isinstance(flow, dict) else "",
                            target=flow.get("target", "") if isinstance(flow, dict) else "",
                            resource=flow.get("resource", "") if isinstance(flow, dict) else "",
                            flow_type=flow.get("flow_type", "production") if isinstance(flow, dict) else "production",
                        )
                        for flow in sim_data["resource_flows"]
                        if isinstance(flow, dict)
                    ]

                # Парсинг feedback loops
                if "feedback_loops" in sim_data:
                    feedback_loops = [
                        FeedbackLoop(
                            loop_type=loop.get("loop_type", "positive") if isinstance(loop, dict) else "positive",
                            description=loop.get("description", "") if isinstance(loop, dict) else str(loop),
                            mechanics_involved=loop.get("mechanics_involved", []) if isinstance(loop, dict) else [],
                            stability=loop.get("stability", "stable") if isinstance(loop, dict) else "stable",
                        )
                        for loop in sim_data["feedback_loops"]
                        if isinstance(loop, dict)
                    ]

                # Gameplay script
                gameplay_script = sim_data.get("gameplay_script", "")

            except Exception as e:
                logger.warning(f"[Stage 4] AI simulation (SIMULATE_GAMEPLAY) failed: {e}")
                # Fallback: формализованная модель на основе механик
                gameplay_sequence = self._formal_gameplay_simulation(mechanic_set, genre)
                gameplay_script = self._formal_gameplay_script(mechanic_set, genre)

            # === Шаг 4.2: Вывод динамик из геймплея ===
            observed_dynamics = self._extract_observed_dynamics(
                gameplay_sequence, feedback_loops, dynamics_target
            )

            # === Шаг 4.3: Вывод эстетики из динамик ===
            predicted_aesthetics = self._predict_aesthetics_from_dynamics(
                observed_dynamics, aesthetic_profile
            )

            # === Шаг 4.4: Сравнение с целевой эстетикой ===
            target_aesthetics = [
                aesthetic_profile.primary,
                aesthetic_profile.secondary,
                aesthetic_profile.tertiary,
            ]

            for target in target_aesthetics:
                if target in predicted_aesthetics:
                    match_scores[target] = predicted_aesthetics[target]
                else:
                    match_scores[target] = 0.0
                    warnings.append(
                        f"Целевая эстетика '{target}' не порождается текущими механиками"
                    )

            overall_match = sum(match_scores.values()) / max(1, len(match_scores))

            # === Шаг 4.5: Проверка устойчивости ===
            stability = self._check_simulation_stability(feedback_loops)
            if not stability.stable:
                warnings.append(f"Обнаружена патология: {stability.pathology}")
                if stability.correction:
                    suggestions.append(stability.correction)

            # === Шаг 4.6: Проверка сходимости ===
            if overall_match >= convergence_threshold:
                converged = True
            else:
                # Определяем слабые эстетики
                weak = [a for a, s in match_scores.items() if s < 0.6]
                for aesthetic in weak:
                    suggestions.append(
                        f"Эстетика '{aesthetic}' слабо выражена (score={match_scores[aesthetic]:.2f}). "
                        f"Рекомендуется добавить механики, порождающие динамики для этой эстетики."
                    )

        logger.info(
            f"[Stage 4] Classic MDA pass: "
            f"match={overall_match:.2f}, converged={converged}, "
            f"iterations={iteration}, "
            f"{len(observed_dynamics)} dynamics observed "
            f"({time.time() - start:.2f}s)"
        )

        return ClassicMDAResult(
            gameplay_sequence=gameplay_sequence,
            resource_flows=resource_flows,
            feedback_loops=feedback_loops,
            observed_dynamics=observed_dynamics,
            predicted_aesthetics=predicted_aesthetics,
            match_scores=match_scores,
            overall_match=overall_match,
            converged=converged,
            stability=stability,
            gameplay_script=gameplay_script,
            iterations=iteration,
            warnings=warnings,
            suggestions=suggestions,
        )

    def _formal_gameplay_simulation(
        self,
        mechanic_set: StructuredMechanicSet,
        genre: str,
    ) -> list[GameplaySequenceStep]:
        """Формализованная модель геймплея (fallback при недоступности AI)."""
        steps = []
        step_num = 0

        # Из базовых механик — начало сессии
        for m in mechanic_set.base[:2]:
            step_num += 1
            steps.append(GameplaySequenceStep(
                step_number=step_num,
                action=f"Выполнить: {m.get('name', 'действие')}",
                mechanics_used=[m.get("name", "")],
                resources_consumed=[],
                resources_produced=["информация", "позиционирование"],
            ))

        # Из боевых — основная активность
        for m in mechanic_set.combat[:2]:
            step_num += 1
            steps.append(GameplaySequenceStep(
                step_number=step_num,
                action=f"Сразиться: {m.get('name', 'бой')}",
                mechanics_used=[m.get("name", "")],
                resources_consumed=["здоровье", "ресурсы"],
                resources_produced=["очки опыта", "лут"],
            ))

        # Из прогрессионных — развитие
        for m in mechanic_set.progression[:2]:
            step_num += 1
            steps.append(GameplaySequenceStep(
                step_number=step_num,
                action=f"Прокачать: {m.get('name', 'прогрессия')}",
                mechanics_used=[m.get("name", "")],
                resources_consumed=["очки опыта"],
                resources_produced=["новые способности", "улучшения"],
            ))

        return steps

    def _formal_gameplay_script(
        self,
        mechanic_set: StructuredMechanicSet,
        genre: str,
    ) -> str:
        """Сгенерировать текстовое описание геймплея (fallback)."""
        mechanics_list = []
        for group_key in ["base", "combat", "progression", "spatial", "social"]:
            group = getattr(mechanic_set, group_key, [])
            mechanics_list.extend(m.get("name", "") for m in group if m.get("name"))

        return (
            f"Игрок начинает сессию в жанре {genre}, используя базовые механики: "
            f"{', '.join(mechanic_set.base[0].get('name', '') for _ in range(min(2, len(mechanic_set.base))))}. "
            f"Основная активность включает боевые механики и взаимодействие с миром. "
            f"Прогрессия обеспечивается через развитие персонажа и получение наград. "
            f"Общий набор механик: {', '.join(mechanics_list[:10])}."
        )

    def _extract_observed_dynamics(
        self,
        gameplay_sequence: list[GameplaySequenceStep],
        feedback_loops: list[FeedbackLoop],
        dynamics_target: DynamicsTarget,
    ) -> list[str]:
        """Извлечь наблюдаемые динамики из моделированного геймплея."""
        observed: list[str] = []

        # Из feedback loops — динамики, ассоциированные с типами петель
        for loop in feedback_loops:
            if loop.loop_type == "positive" and "Нарастание сложности" not in observed:
                observed.append("Нарастание сложности (кривая вызова)")
            if loop.loop_type == "negative" and "Баланс навык/сложность" not in observed:
                observed.append("Баланс навык/сложность (зона потока)")

        # Из механик в шагах — сопоставляем с целевыми динамиками
        mechanics_used: set[str] = set()
        for step in gameplay_sequence:
            mechanics_used.update(step.mechanics_used)

        # Проверяем, какие целевые динамики затрагиваются механиками
        for dynamic_name in dynamics_target.core_dynamics:
            # Проверяем маппинг «Динамика → Механики»
            related_mechanics = DYNAMICS_MECHANICS_MAP.get(dynamic_name, [])
            if any(m in mechanics_used for m in related_mechanics):
                if dynamic_name not in observed:
                    observed.append(dynamic_name)

        # Добавляем динамики из ресурсов
        all_consumed: set[str] = set()
        all_produced: set[str] = set()
        for step in gameplay_sequence:
            all_consumed.update(step.resources_consumed)
            all_produced.update(step.resources_produced)

        if all_consumed and all_produced:
            if "Управление ресурсами (оптимизация)" not in observed:
                observed.append("Управление ресурсами (оптимизация)")

        return observed

    def _predict_aesthetics_from_dynamics(
        self,
        observed_dynamics: list[str],
        aesthetic_profile: AestheticProfile,
    ) -> dict[str, float]:
        """Предсказать эстетику из наблюдаемых динамик (обратный маппинг)."""
        predicted: dict[str, float] = {}

        for dynamic_name in observed_dynamics:
            aesthetic_map = DYNAMICS_TO_AESTHETICS.get(dynamic_name, {})
            for aesthetic, confidence in aesthetic_map.items():
                if aesthetic in predicted:
                    predicted[aesthetic] = max(predicted[aesthetic], confidence)
                else:
                    predicted[aesthetic] = confidence

        return predicted

    def _check_simulation_stability(
        self,
        feedback_loops: list[FeedbackLoop],
    ) -> StabilityCheck:
        """Проверить устойчивость симуляции (патологии Machinations)."""
        for loop in feedback_loops:
            if loop.stability == "runaway":
                return StabilityCheck(
                    stable=False,
                    pathology="runaway",
                    correction="Добавьте drain (сток) для ограничения роста ресурса",
                    details=f"Обнаружена runaway-петля: {loop.description}",
                )
            if loop.stability == "oscillating":
                return StabilityCheck(
                    stable=False,
                    pathology="oscillation",
                    correction="Добавьте буфер (пул) для сглаживания колебаний",
                    details=f"Обнаружена осциллирующая петля: {loop.description}",
                )

        # Проверяем баланс positive/negative петель
        positive_count = sum(1 for l in feedback_loops if l.loop_type == "positive")
        negative_count = sum(1 for l in feedback_loops if l.loop_type == "negative")

        if positive_count > 0 and negative_count == 0:
            return StabilityCheck(
                stable=False,
                pathology="stall",
                correction="Добавьте негативную обратную связь (трение) для баланса",
                details="Только положительные петли ОС — риск runaway без балансировки",
            )

        return StabilityCheck(stable=True, pathology="none", details="Симуляция стабильна")

    # ========================================================
    # Этап 5: Валидация через Линзы Шелла (3.3.7)
    # ========================================================

    async def validate_lenses(
        self,
        mechanic_set: StructuredMechanicSet,
        classic_mda_result: ClassicMDAResult,
        concept_id: str = "",
        project_state: Optional[dict] = None,
    ) -> LensValidation:
        """
        Этап 5: Валидация через Линзы Шелла.

        Алгоритм 3.3.7:
        1. Выбор 9 приоритетных линз
        2. AI-оценка через APPLY_LENS_MDA
        3. Агрегация результатов

        Returns:
            LensValidation с результатами по каждой линзе
        """
        start = time.time()

        # Собираем имена механик
        mechanics_list: list[str] = []
        for group_key in ["base", "combat", "progression", "spatial", "social"]:
            group = getattr(mechanic_set, group_key, [])
            mechanics_list.extend(m.get("name", "") for m in group if m.get("name"))

        lens_results: list[LensResult] = []

        for lens_info in PRIORITY_LENSES:
            lens_id = lens_info["id"]
            lens_name = lens_info["name"]
            lens_focus = lens_info["focus"]

            try:
                prompt_result: PromptResult = await self.executor.execute(
                    prompt_id="APPLY_LENS_MDA",
                    inputs={
                        "lens": str(lens_id),
                        "mechanic_set": mechanics_list,
                        "mda_result": {
                            "match_scores": classic_mda_result.match_scores,
                            "overall_match": classic_mda_result.overall_match,
                            "observed_dynamics": classic_mda_result.observed_dynamics,
                            "converged": classic_mda_result.converged,
                        },
                    },
                    project_state=project_state,
                    options=PromptExecutionOptions(skip_cache=False),
                )

                data = prompt_result.data if isinstance(prompt_result.data, dict) else {}
                score = data.get("score", 0.5)
                issues = data.get("issues_found", data.get("issues", []))
                suggestions_list = data.get("suggestions", [])
                questions = data.get("questions_asked", [])
                answers = data.get("answers", [])

                if not isinstance(issues, list):
                    issues = [str(issues)] if issues else []
                if not isinstance(suggestions_list, list):
                    suggestions_list = [str(suggestions_list)] if suggestions_list else []

                lens_results.append(LensResult(
                    lens_id=lens_id,
                    lens_name=lens_name,
                    questions_asked=questions if isinstance(questions, list) else [lens_focus],
                    answers=answers if isinstance(answers, list) else [],
                    score=float(score),
                    issues_found=issues,
                    suggestions=suggestions_list,
                ))

            except Exception as e:
                logger.warning(
                    f"[Stage 5] Lens #{lens_id} '{lens_name}' failed: {e}. Using formalized fallback."
                )
                # Fallback: формализованная оценка
                lens_results.append(self._formal_lens_evaluation(
                    lens_id, lens_name, lens_focus, mechanic_set, classic_mda_result
                ))

        # Агрегация
        critical = [r for r in lens_results if r.score < 0.4]
        warn = [r for r in lens_results if 0.4 <= r.score < 0.7]
        passed = [r for r in lens_results if r.score >= 0.7]
        overall = sum(r.score for r in lens_results) / max(1, len(lens_results))

        result = LensValidation(
            results=lens_results,
            critical_issues=critical,
            warnings=warn,
            passed_count=len(passed),
            total_count=len(lens_results),
            overall_score=overall,
        )

        logger.info(
            f"[Stage 5] Lens validation: "
            f"{len(passed)} passed, {len(warn)} warnings, {len(critical)} critical, "
            f"overall={overall:.2f} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _formal_lens_evaluation(
        self,
        lens_id: int,
        lens_name: str,
        lens_focus: str,
        mechanic_set: StructuredMechanicSet,
        classic_mda_result: ClassicMDAResult,
    ) -> LensResult:
        """Формализованная оценка линзы (fallback при недоступности AI)."""
        score = 0.5
        issues: list[str] = []
        suggestions_list: list[str] = []

        # Линза 9: Тетрада — проверяем разнообразие групп
        if lens_id == 9:
            groups = set()
            for group_key in ["base", "combat", "progression", "spatial", "social"]:
                if getattr(mechanic_set, group_key, []):
                    groups.add(group_key)
            if len(groups) >= 4:
                score = 0.8
            elif len(groups) >= 3:
                score = 0.6
            else:
                score = 0.3
                issues.append("Недостаточное разнообразие механик по группам")
                suggestions_list.append("Добавьте механики из недостающих групп")

        # Линза 11: Единство
        elif lens_id == 11:
            score = min(1.0, mechanic_set.compatibility_score / 100)
            if score < 0.5:
                issues.append("Низкая совместимость механик")
                suggestions_list.append("Устраните конфликты между механиками")

        # Линза 12: Резонанс
        elif lens_id == 12:
            score = min(1.0, mechanic_set.synergy_score / 100)
            if score < 0.5:
                issues.append("Слабая синергия между механиками")
                suggestions_list.append("Добавьте механики с высокими синергиями")

        # Линза 30: Эмерджентность
        elif lens_id == 30:
            all_mechanics_count = mechanic_set.total_count
            if all_mechanics_count >= 12:
                score = 0.7
            elif all_mechanics_count >= 8:
                score = 0.5
            else:
                score = 0.3
                issues.append("Недостаточно механик для эмерджентности")
                suggestions_list.append("Добавьте взаимодействующие механики")

        # Линза 31: Пространство действий
        elif lens_id == 31:
            score = classic_mda_result.overall_match

        # Линза 40: Треугольность
        elif lens_id == 40:
            if classic_mda_result.converged:
                score = 0.7
            else:
                score = 0.4
                issues.append("Выбор может быть несодержательным без сходимости эстетик")

        # Линза 41: Доминантная стратегия
        elif lens_id == 41:
            if mechanic_set.compatibility_score > 70:
                score = 0.6
            else:
                score = 0.4
                issues.append("Возможна доминантная стратегия из-за конфликтов")

        # Линза 69: Кривая интереса
        elif lens_id == 69:
            if len(classic_mda_result.feedback_loops) >= 2:
                score = 0.7
            else:
                score = 0.4
                issues.append("Недостаточно петель обратной связи для кривой интереса")

        # Линза 74: Свобода vs управляемость
        elif lens_id == 74:
            if mechanic_set.total_count >= 10:
                score = 0.7
            else:
                score = 0.5

        return LensResult(
            lens_id=lens_id,
            lens_name=lens_name,
            questions_asked=[lens_focus],
            answers=[f"Формализованная оценка: {score:.1f}"],
            score=score,
            issues_found=issues,
            suggestions=suggestions_list,
        )

    # ========================================================
    # Этап 6: Матрица 4×3 Бонда + лудонарративный анализ (3.3.8)
    # ========================================================

    async def validate_bond_matrix(
        self,
        mechanic_set: StructuredMechanicSet,
        classic_mda_result: ClassicMDAResult,
        genre: str,
        idea: str = "",
        concept_id: str = "",
        project_state: Optional[dict] = None,
    ) -> BondValidation:
        """
        Этап 6: Матрица 4×3 Бонда + лудонарративный анализ.

        Алгоритм 3.3.8:
        1. Заполнение матрицы (4 элемента × 3 уровня)
        2. Горизонтальная согласованность
        3. Вертикальная согласованность
        4. Обнаружение лудонарративного диссонанса

        Returns:
            BondValidation с матрицей, согласованностью и лудонарративным анализом
        """
        start = time.time()

        # Собираем имена механик
        mechanics_list: list[str] = []
        for group_key in ["base", "combat", "progression", "spatial", "social"]:
            group = getattr(mechanic_set, group_key, [])
            mechanics_list.extend(m.get("name", "") for m in group if m.get("name"))

        # === Шаг 6.1: Заполнение матрицы 4×3 ===
        matrix = self._fill_bond_matrix(mechanic_set, classic_mda_result, genre, idea)

        # === Шаг 6.2: Горизонтальная согласованность ===
        row_consistency = self._check_row_consistency(matrix, genre)

        # === Шаг 6.3: Вертикальная согласованность ===
        col_consistency = self._check_column_consistency(matrix)

        # === Шаг 6.4: Лудонарративный диссонанс ===
        ludonarrative = await self._check_ludonarrative(
            matrix, mechanics_list, genre, idea, project_state
        )

        # Общая согласованность
        all_scores = [r.score for r in row_consistency] + [c.score for c in col_consistency]
        overall_consistency = sum(all_scores) / max(1, len(all_scores))

        result = BondValidation(
            matrix=matrix,
            row_consistency=row_consistency,
            col_consistency=col_consistency,
            ludonarrative=ludonarrative,
            overall_consistency=overall_consistency,
        )

        logger.info(
            f"[Stage 6] Bond validation: "
            f"consistency={overall_consistency:.2f}, "
            f"ludonarrative={ludonarrative.result if ludonarrative else 'N/A'} "
            f"({time.time() - start:.2f}s)"
        )
        return result

    def _fill_bond_matrix(
        self,
        mechanic_set: StructuredMechanicSet,
        classic_mda_result: ClassicMDAResult,
        genre: str,
        idea: str,
    ) -> list[BondMatrixCell]:
        """Заполнить матрицу 4×3 Бонда."""
        matrix: list[BondMatrixCell] = []

        # Собираем имена механик
        mechanics_list: list[str] = []
        for group_key in ["base", "combat", "progression", "spatial", "social"]:
            group = getattr(mechanic_set, group_key, [])
            mechanics_list.extend(m.get("name", "") for m in group if m.get("name"))

        # Фиксированный уровень (создано разработчиком)
        matrix.append(BondMatrixCell(
            element="Механика", level="Фиксированный",
            content=f"Определённые правила: {', '.join(mechanics_list[:8])}",
        ))
        matrix.append(BondMatrixCell(
            element="История", level="Фиксированный",
            content=f"Заданный нарратив: {idea[:200] if idea else 'Не указан'}",
        ))
        matrix.append(BondMatrixCell(
            element="Эстетика", level="Фиксированный",
            content=f"Целевые эстетики: {', '.join(classic_mda_result.match_scores.keys())}",
        ))
        matrix.append(BondMatrixCell(
            element="Технология", level="Фиксированный",
            content=f"Жанровая платформа: {genre}",
        ))

        # Динамический уровень (возникает при взаимодействии)
        matrix.append(BondMatrixCell(
            element="Механика", level="Динамический",
            content=f"Эмергентные механики: {', '.join(classic_mda_result.observed_dynamics[:5])}",
        ))
        matrix.append(BondMatrixCell(
            element="История", level="Динамический",
            content="Эмергентный нарратив: истории из геймплея игрока",
        ))
        matrix.append(BondMatrixCell(
            element="Эстетика", level="Динамический",
            content=f"Наблюдаемая эстетика: {', '.join(f'{k}={v:.1f}' for k, v in classic_mda_result.predicted_aesthetics.items()[:5])}",
        ))
        matrix.append(BondMatrixCell(
            element="Технология", level="Динамический",
            content="Динамические системы: симуляция, процедурная генерация",
        ))

        # Культурный уровень (вне контроля разработчика)
        matrix.append(BondMatrixCell(
            element="Механика", level="Культурный",
            content="Метагейм: стратегии сообщества, мемы, моды",
        ))
        matrix.append(BondMatrixCell(
            element="История", level="Культурный",
            content="Культурный нарратив: фанфики, обсуждения, лор-видео",
        ))
        matrix.append(BondMatrixCell(
            element="Эстетика", level="Культурный",
            content="Культурная эстетика: как игра воспринимается сообществом",
        ))
        matrix.append(BondMatrixCell(
            element="Технология", level="Культурный",
            content="Культурная технология: мемы, стриминг, eSports",
        ))

        return matrix

    def _check_row_consistency(
        self,
        matrix: list[BondMatrixCell],
        genre: str,
    ) -> list[RowConsistency]:
        """Проверить горизонтальную согласованность (в каждой строке все 4 элемента сообщают одно и то же)."""
        results: list[RowConsistency] = []

        for level in BOND_LEVELS:
            cells = [c for c in matrix if c.level == level]

            # Формализованная оценка:
            # Если во всех ячейках уровня есть содержимое — выше score
            filled_count = sum(1 for c in cells if c.content and len(c.content) > 10)
            score = filled_count / max(1, len(cells))

            # Проверяем на явные рассогласования
            dissonances: list[dict] = []

            # Проверка: Механика ↔ Эстетика
            mech_cell = next((c for c in cells if c.element == "Механика"), None)
            aest_cell = next((c for c in cells if c.element == "Эстетика"), None)
            if mech_cell and aest_cell:
                if not mech_cell.content or not aest_cell.content:
                    dissonances.append({
                        "element_a": "Механика",
                        "element_b": "Эстетика",
                        "reason": "Пустое содержимое в одном из элементов",
                    })

            results.append(RowConsistency(
                level=level,
                score=score,
                dissonances=dissonances,
            ))

        return results

    def _check_column_consistency(
        self,
        matrix: list[BondMatrixCell],
    ) -> list[ColumnConsistency]:
        """Проверить вертикальную согласованность (Фиксированный → Динамический → Культурный)."""
        results: list[ColumnConsistency] = []

        for element in BOND_ELEMENTS:
            cells = [c for c in matrix if c.element == element]

            # Все ячейки заполнены — хорошая последовательность
            filled_count = sum(1 for c in cells if c.content and len(c.content) > 5)
            score = filled_count / max(1, len(cells))

            description = f"Логическая последовательность '{element}': "
            if filled_count == 3:
                description += "полная — от замысла до культурного влияния"
            elif filled_count == 2:
                description += "частичная — отсутствует культурный уровень"
            else:
                description += "неполная — требуется доработка"

            results.append(ColumnConsistency(
                element=element,
                score=score,
                description=description,
            ))

        return results

    async def _check_ludonarrative(
        self,
        matrix: list[BondMatrixCell],
        mechanics_list: list[str],
        genre: str,
        idea: str,
        project_state: Optional[dict] = None,
    ) -> LudonarrativeCheck:
        """Проверить лудонарративный диссонанс (Механика ↔ История)."""
        try:
            prompt_result: PromptResult = await self.executor.execute(
                prompt_id="CHECK_LUDONARRATIVE_MDA",
                inputs={
                    "mechanics": mechanics_list,
                    "narrative": idea or "Не указан",
                    "genre": genre,
                },
                project_state=project_state,
                options=PromptExecutionOptions(skip_cache=False),
            )

            data = prompt_result.data if isinstance(prompt_result.data, dict) else {}
            result_type = data.get("result", "Гармония")
            description = data.get("description", "")
            pairs = data.get("mechanic_narrative_pairs", [])
            correction = data.get("correction", "")

            return LudonarrativeCheck(
                result=result_type,
                description=description,
                mechanic_narrative_pairs=pairs if isinstance(pairs, list) else [],
                correction=correction,
            )

        except Exception as e:
            logger.warning(f"[Stage 6] AI ludonarrative check failed: {e}")
            # Fallback: формализованная проверка
            return self._formal_ludonarrative_check(mechanics_list, idea)

    def _formal_ludonarrative_check(
        self,
        mechanics_list: list[str],
        idea: str,
    ) -> LudonarrativeCheck:
        """Формализованная проверка лудонарративного диссонанса (fallback)."""
        # Если нет нарратива — нельзя проверить
        if not idea:
            return LudonarrativeCheck(
                result="Гармония",
                description="Нарратив не указан — лудонарративная проверка ограничена",
                mechanic_narrative_pairs=[],
                correction="",
            )

        # Простейшая проверка: если механики включают «Нарратив» — гармония
        narrative_mechanics = ["Нарратив", "Квесты", "Выбор сюжета", "Фракции", "Компаньоны"]
        has_narrative_mech = any(m in mechanics_list for m in narrative_mechanics)

        if has_narrative_mech:
            return LudonarrativeCheck(
                result="Гармония",
                description="Нарративные механики присутствуют — механика поддерживает историю",
                mechanic_narrative_pairs=[{
                    "mechanic": next(m for m in mechanics_list if m in narrative_mechanics),
                    "narrative_element": "сюжет",
                    "consistency": "high",
                }],
                correction="",
            )

        return LudonarrativeCheck(
            result="Ирония",
            description="Нарративные механики отсутствуют — возможна лудонарративная ирония",
            mechanic_narrative_pairs=[],
            correction="Добавьте нарративные механики (квесты, выбор сюжета) для согласованности",
        )

    # ========================================================
    # Полный пайплайн: Этапы 1–6
    # ========================================================

    async def analyze_full(
        self,
        concept_id: str,
        aesthetic_profile: AestheticProfile,
        genre: str,
        idea: str = "",
        existing_mechanics: Optional[list[str]] = None,
        required_mechanics: Optional[list[str]] = None,
        forbidden_mechanics: Optional[list[str]] = None,
        max_mechanics: int = 18,
        min_mechanics: int = 8,
        max_iterations: int = 3,
        convergence_threshold: float = 0.8,
        project_state: Optional[dict] = None,
    ) -> MDAProfile:
        """
        Полный пайплайн MDA Lab — Этапы 1–6 алгоритма 3.3.

        Выполняет последовательно:
        1. Определение целевых динамик (Reverse MDA)
        2. Маппинг «Динамика → Механики»
        3. Сборка и оптимизация набора механик
        4. Classic MDA — аналитический проход
        5. Валидация через Линзы Шелла
        6. Матрица 4×3 Бонда + лудонарративный анализ

        Returns:
            MDAProfile с результатами всех 6 этапов
        """
        pipeline_start = time.time()
        models_used: list[str] = []

        # === Этапы 1–3: Reverse MDA ===
        profile = await self.analyze_stages_1_3(
            concept_id=concept_id,
            aesthetic_profile=aesthetic_profile,
            genre=genre,
            idea=idea,
            existing_mechanics=existing_mechanics,
            required_mechanics=required_mechanics,
            forbidden_mechanics=forbidden_mechanics,
            max_mechanics=max_mechanics,
            min_mechanics=min_mechanics,
            max_iterations=max_iterations,
            convergence_threshold=convergence_threshold,
            project_state=project_state,
        )
        models_used.extend(profile.models_used)

        if not profile.mechanic_set or not profile.dynamics_target:
            logger.warning("[Pipeline 1-6] Stages 1-3 failed — cannot proceed to stages 4-6")
            return profile

        # === Этап 4: Classic MDA ===
        try:
            classic_result = await self.classic_mda_pass(
                mechanic_set=profile.mechanic_set,
                aesthetic_profile=aesthetic_profile,
                dynamics_target=profile.dynamics_target,
                genre=genre,
                convergence_threshold=convergence_threshold,
                max_iterations=max_iterations,
                project_state=project_state,
            )
            profile.classic_mda_result = classic_result
            models_used.append("SIMULATE_GAMEPLAY")
        except Exception as e:
            logger.error(f"[Pipeline 1-6] Stage 4 (Classic MDA) failed: {e}")

        # === Этап 5: Линзы Шелла ===
        if profile.classic_mda_result:
            try:
                lens_result = await self.validate_lenses(
                    mechanic_set=profile.mechanic_set,
                    classic_mda_result=profile.classic_mda_result,
                    concept_id=concept_id,
                    project_state=project_state,
                )
                profile.lens_validation = lens_result
                models_used.append("APPLY_LENS_MDA")
            except Exception as e:
                logger.error(f"[Pipeline 1-6] Stage 5 (Lens Validation) failed: {e}")

        # === Этап 6: Матрица Бонда ===
        if profile.classic_mda_result:
            try:
                bond_result = await self.validate_bond_matrix(
                    mechanic_set=profile.mechanic_set,
                    classic_mda_result=profile.classic_mda_result,
                    genre=genre,
                    idea=idea,
                    concept_id=concept_id,
                    project_state=project_state,
                )
                profile.bond_validation = bond_result
                models_used.append("CHECK_LUDONARRATIVE_MDA")
            except Exception as e:
                logger.error(f"[Pipeline 1-6] Stage 6 (Bond Validation) failed: {e}")

        # Обновляем метаданные
        profile.stages_completed = [1, 2, 3, 4, 5, 6]
        profile.latency_ms = int((time.time() - pipeline_start) * 1000)
        profile.models_used = models_used

        logger.info(
            f"[Pipeline 1-6] Completed in {profile.latency_ms}ms. "
            f"Stages: {profile.stages_completed}, "
            f"Converged: {profile.classic_mda_result.converged if profile.classic_mda_result else 'N/A'}, "
            f"Lens score: {profile.lens_validation.overall_score:.2f if profile.lens_validation else 'N/A'}, "
            f"Bond consistency: {profile.bond_validation.overall_consistency:.2f if profile.bond_validation else 'N/A'}"
        )

        return profile
