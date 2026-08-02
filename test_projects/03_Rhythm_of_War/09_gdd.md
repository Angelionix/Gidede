# Rhythm_of_War

> Format: full_gdd • Detail: standard • Stage: preproduction

## Table of Contents

1. [title](#title)
2. [logline](#logline)
3. [concept](#concept)
4. [usp](#usp)
5. [core_loop](#core_loop)
6. [mechanics](#mechanics)
7. [aesthetics](#aesthetics)
8. [balance](#balance)
9. [progression](#progression)
10. [difficulty](#difficulty)
11. [economy](#economy)
12. [narrative](#narrative)
13. [world_overview](#world_overview)
14. [characters](#characters)
15. [plot_arcs](#plot_arcs)
16. [themes](#themes)
17. [tone_voice](#tone_voice)
18. [story_mechanics](#story_mechanics)
19. [branching_structure](#branching_structure)
20. [target_audience](#target_audience)
21. [monetization](#monetization)
22. [license_ip](#license_ip)
23. [platforms](#platforms)
24. [tech_requirements](#tech_requirements)
25. [ux](#ux)
26. [ux_flow](#ux_flow)
27. [ui_mockups](#ui_mockups)
28. [controls](#controls)
29. [camera](#camera)
30. [game_modes](#game_modes)
31. [social_features](#social_features)
32. [dialogues](#dialogues)
33. [quests](#quests)
34. [lore_and_world](#lore_and_world)
35. [level_design](#level_design)
36. [navigation](#navigation)
37. [combat_spaces](#combat_spaces)
38. [resources](#resources)
39. [tech_tree](#tech_tree)
40. [difficulty_curve](#difficulty_curve)
41. [hud_ui](#hud_ui)
42. [menus_navigation](#menus_navigation)
43. [visual_style](#visual_style)
44. [sound](#sound)
45. [localization](#localization)
46. [testing_plan](#testing_plan)
47. [risks](#risks)
48. [team_fit](#team_fit)
49. [live_ops_plan](#live_ops_plan)
50. [meta_game](#meta_game)
51. [milestones](#milestones)

## Title

# Rhythm_of_War

**Жанр:** Rhythm

Rhythm game commanding armies by tapping beats

## Logline

A rhythm game where every decision reshapes the world — combining "Rhythm game commanding armies by tapping beats" with emergent narrative consequences.

## Concept

Концепция игры «Rhythm_of_War» — Rhythm game commanding armies by tapping beats.

## Usp

A rhythm game where every decision reshapes the world — combining "Rhythm game commanding armies by tapping beats" with emergent narrative consequences.

## Core Loop

## Core Loop

1. {"action":"Слушать ритм (explore)","mechanics":["explore"],"resources_consumed":[],"resources_produced":[],"feedback_type":"neutral","duration_estimate":1}
2. {"action":"Ввести ноту (combat)","mechanics":["combat"],"resources_consumed":[],"resources_produced":["combo"],"feedback_type":"positive","duration_estimate":1}
3. {"action":"Оценить (reward)","mechanics":["reward"],"resources_consumed":["combo"],"resources_produced":["score"],"feedback_type":"positive","duration_estimate":1}
4. {"action":"Продлить комбо (Комбо)","mechanics":["Комбо"],"resources_consumed":["score"],"resources_produced":["multiplier"],"feedback_type":"positive","duration_estimate":1}
5. {"action":"Следующий такт","mechanics":["explore"],"resources_consumed":["multiplier"],"resources_produced":[],"feedback_type":"neutral","duration_estimate":1}

## Mechanics

## Mechanics

```json
{
  "base": [
    {
      "id": "taymer",
      "name": "Таймер",
      "group": "Время",
      "category": "base",
      "desc": "Ограничение времени на выполнение действий. Создаёт давление и приоритизацию, повышая интенсивность опыта.",
      "matched_genres": [
        "rhythm"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "bit_sinhronizatsiya",
      "name": "Бит-синхронизация",
      "group": "Время",
      "category": "base",
      "desc": "Игрок нажимает кнопки в ритм музыке. Точность тайминга определяет эффективность: perfect/good/miss. Основа rhythm-жанра.",
      "matched_genres": [
        "rhythm"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "podskazki_i_tutorialy",
      "name": "Подсказки и туториалы",
      "group": "Информация",
      "category": "base",
      "desc": "Внутриигровые инструкции, объясняющие механики. Критично для онбординга: первые 5 минут определяют удержание.",
      "matched_genres": [
        "rhythm"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "dostizheniya_i_ochki",
      "name": "Достижения и очки",
      "group": "Базовые",
      "category": "base",
      "desc": "Система начисления очков и мета-целей, мотивирующая игрока к повторным действиям и совершенствованию результатов.",
      "cross_genre": true,
      "source": "mechanics_db"
    }
  ],
  "combat": [
    {
      "id": "kombo",
      "name": "Комбо",
      "group": "Боевые",
      "category": "combat",
      "desc": "Последовательные атаки, усиливающие эффект при правильном тайминге. Создаёт петлю мастерства и зрелищности.",
      "matched_genres": [
        "rhythm"
      ],
      "source": "mechanics_db"
    }
  ],
  "progression": [
    {
      "id": "kombo_tsepochki",
      "name": "Комбо-цепочки",
      "group": "Навыки",
      "category": "progression",
      "desc": "Последовательности действий, усиливающих друг друга при правильном тайминге. Поощряют мастерство и создание экспрессивных sequence-атак.",
      "matched_genres": [
        "rhythm"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "tayming_okna",
      "name": "Тайминг-окна",
      "group": "Навыки",
      "category": "progression",
      "desc": "Короткие временные окна для идеального действия: парирование, perfect dodge, critical hit. Создаёт risk/reward tension.",
      "matched_genres": [
        "rhythm"
      ],
      "source": "mechanics_db"
    }
  ],
  "spatial": [
    {
      "id": "map_exploration",
      "name": "map_exploration",
      "group": "spatial",
      "category": "spatial",
      "source": "genre_default"
    },
    {
      "id": "objective_navigation",
      "name": "objective_navigation",
      "group": "spatial",
      "category": "spatial",
      "source": "genre_default"
    },
    {
      "id": "spawn_points",
      "name": "spawn_points",
      "group": "spatial",
      "category": "spatial",
      "source": "genre_default"
    }
  ],
  "social": [
    {
      "id": "leaderboard",
      "name": "leaderboard",
      "group": "social",
      "category": "social",
      "source": "genre_default"
    },
    {
      "id": "achievement_share",
      "name": "achievement_share",
      "group": "social",
      "category": "social",
      "source": "genre_default"
    },
    {
      "id": "coop_progression",
      "name": "coop_progression",
      "group": "social",
      "category": "social",
      "source": "genre_default"
    }
  ],
  "total_count": 13,
  "conflicts_resolved": [],
  "synergies_detected": [
    {
      "name": "Комбо-цепочки ↔ Комбо",
      "score": 0.85
    },
    {
      "name": "Таймер ↔ map_exploration",
      "score": 0.72
    },
    {
      "name": "Достижения и очки (cross-genre: action, adventure) ↔ primary aesthetic",
      "score": 0.65
    }
  ],
  "compatibility_score": 100,
  "mechanics_db_source": "MechanicsDB (SW.BAND, 128 механик)",
  "cross_genre_mechanics": [
    {
      "name": "Достижения и очки",
      "group": "Базовые",
      "desc": "Система начисления очков и мета-целей, мотивирующая игрока к повторным действиям и совершенствованию результатов.",
      "original_genres": [
        "action",
        "adventure",
        "mmorpg",
        "platformer",
        "rpg",
        "shooter"
      ],
      "matched_aesthetics": [
        "challenge",
        "submission",
        "expression"
      ]
    }
  ],
  "genres_searched": [
    "rhythm"
  ],
  "genre_coverage": 1,
  "hybrid_bonus": 0,
  "cross_genre_role": "none"
}
```

## Aesthetics

## Aesthetics

**Primary aesthetic:** challenge

```json
{
  "primary": "sensation",
  "secondary": "submission",
  "tertiary": "expression",
  "rationale": "Primary aesthetic \"sensation\" matches genre \"rhythm\" and idea emphasis. Secondary/tertiary chosen to broaden the player experience."
}
```

## Balance

## Balance

- Type: mixed
- Overall score: 0.113
- Elements: 4
- Imbalances: 6

## Progression

## Progression

- Total levels: 50
- Tier count: 4
- Curve type: exponential
- Target duration (h): 40

## Difficulty

## Сложность

Система сложности «Rhythm_of_War» (жанр: Rhythm) предлагает 3 уровней: Easy / Normal / Hard.

Прогрессия разбита на 4 тиров, каждый со своей кривой сложности (см. difficulty_curve).

Валидация прогрессии: пройдено 9 из 11 проверок.

Модификаторы сложности: здоровье врагов, урон врагов, частота checkpoint, доступность tutorial hints. Accessibility: настраиваемые привязки управления, опции цвета/шрифта, возможность пропуска QTE, ассистивный режим (auto-aim, slow-motion). Целевая аудитория: опытные игроки жанра Rhythm.

## Economy

## Economy

- System type: Economy
- Resource count: 6
- Has pathology: yes

## Narrative

## Нарратив

Игра «Rhythm_of_War» в жанре Rhythm использует нарративные элементы для усиления эстетики «challenge».

**Ludonarrative анализ:** Гармония
Механики и нарратив согласованно выражают эстетику "challenge".

## World Overview

## Обзор мира

Мир «Rhythm_of_War» построен вокруг эстетики «sensation». Жанр: Rhythm.

Мир включает:
- Основные локации
- Культуры и фракции
- Исторические события
- Географию и климат

## Characters

## Персонажи

Игрок управляет главным героем.

Основные типы персонажей:
- Главный герой
- NPC
- Антагонисты

Эстетический фокус: challenge

## Plot Arcs

## Сюжетные арки

Сюжет «Rhythm_of_War» следует структуре, основанной на core loop из 5 шагов.

Основные арки:
1. Завязка — введение в мир и конфликт
2. Развитие — усложнение через gameplay
3. Кульминация — финальное противостояние
4. Развязка — разрешение конфликта

Жанр: Rhythm

## Themes

## Темы

Основные темы «Rhythm_of_War»:
- Интенсивность, момент, поток
- Взаимодействие механик и нарратива
- Эмоциональное путешествие игрока

Primary aesthetic: sensation

## Tone Voice

## Тон и голос

Тон «Rhythm_of_War» определяется жанром Rhythm и эстетикой «challenge».

Тональность:
- Диалоги: динамичные, лаконичные
- Описание: сбалансированное
- UI текст: краткий, функциональный

## Story Mechanics

## Сюжетные механики

Сюжетные механики «Rhythm_of_War» интегрированы с core loop типа «rhythm».

Механики:
- Квесты и задания
- Диалоговые деревья
- Сюжетные триггеры
- Branching choices (если применимо)

Тип цикла: rhythm

## Branching Structure

## Ветвление сюжета

Игра следует линейной структуре с локальными выборами.

Структура:
- Основная линия: линейная
- Побочные квесты: линейные
- Концовки: одна основная + вариации

Жанр: Rhythm

## Target Audience

Целевая аудитория «Rhythm_of_War» — игроки жанра Rhythm.

Профиль динамики:
```json
{
  "core_dynamics": [
    "combat_pacing",
    "feedback_effects",
    "audio_visual_sync"
  ],
  "supporting_dynamics": [
    "routine_formation",
    "habit_loops",
    "flow_state",
    "creative_tools",
    "customization",
    "sandbox_building"
  ],
  "emergence_potential": "strong",
  "rationale": "Core dynamics derive from primary aesthetic \"sensation\" (combat_pacing, feedback_effects, audio_visual_sync). Supporting dynamics come from secondary \"submission\" and tertiary \"expression\" aesthetics."
}
```

## Monetization

## Monetization

```json
{
  "type": "b2p",
  "primary_revenue": [
    "purchase"
  ],
  "secondary_revenue": [],
  "ethical_concerns": []
}
```

## License Ip

## Лицензия / IP

«Rhythm_of_War» — оригинальная интеллектуальная собственность. Полные права принадлежат the studio.

Тип IP: Original IP.

Права: the studio владеет всеми авторскими правами, товарными знаками и связанными правами на название, персонажей, мир и механики игры.

Third-party licenses: используются только стандартные middleware (движок, аудио-библиотеки) — каждая с собственной EULA.

Trademark: регистрация товарного знака «Rhythm_of_War» в ключевых юрисдикциях (RU, US, EU) рекомендуется до релиза.

## Platforms

Платформы «Rhythm_of_War» TBD.

## Tech Requirements

## Технические требования

Минимальные требования: OS: Windows 10 64-bit, CPU: Intel i5-6600 / AMD Ryzen 5 1600, RAM: 8 GB, GPU: GTX 1060 / RX 580, Storage: 10-30 GB.

Рекомендуемые требования: OS: Windows 11 64-bit, CPU: Intel i7-10700 / AMD Ryzen 7 3700X, RAM: 16 GB, GPU: RTX 3060 / RX 6700 XT (VRAM 4-6 GB), Storage: SSD 10-30 GB.

Сеть: Optional: cloud save sync, asynchronous features.

Периферия: Keyboard + Mouse, Xbox-compatible gamepad, optional racing wheel / HOTAS (genre-dependent).

Целевые платформы: не заданы — выведены из жанра.

## Ux

## ux

UX/UI для «Rhythm_of_War» в жанре Rhythm. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Ux Flow

## ux_flow

UX/UI для «Rhythm_of_War» в жанре Rhythm. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Ui Mockups

## ui_mockups

UX/UI для «Rhythm_of_War» в жанре Rhythm. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Controls

## controls

Управление для «Rhythm_of_War» в жанре Rhythm.

Схема управления:
- клавиатура / геймпад
- Назначение кнопок: TBD
- Accessibility: настраиваемые привязки

## Camera

## camera

Камера для «Rhythm_of_War» в жанре Rhythm.

Настройки камеры:
- Тип: 3rd person
- Дистанция: средняя
- Управление: автоматическое

## Game Modes

## Игровые режимы

Режимы «Rhythm_of_War»:
- Single Player: основной (единственный)

- Difficulty: Easy / Normal / Hard

## Social Features

## Социальные функции

Социальные системы «Rhythm_of_War» (жанр: Rhythm): определены как ядро опыта.

Функции:
- leaderboard
- achievement_share
- coop_progression

Игра не имеет онлайн-мультиплеера — социальные функции носят асинхронный характер (например, гостевые визиты, обмен UGC).

Moderation: chat filter + report system. Privacy: opt-in для всех социальных функций.

## Dialogues

## Диалоги

Система диалогов «Rhythm_of_War»:
- Тип: линейные реплики
- Озвучка: частичная
- Локализация: RU + EN
- Количество NPC: TBD

## Quests

## Квесты

Квестовая система «Rhythm_of_War»:
- Основные квесты: 50 уровней
- Побочные квесты: ~25
- Daily/Weekly: нет
- Структура: линейные

## Lore And World

## Лор и мир

История мира «Rhythm_of_War»:
- Эпоха: вымышленный мир
- Фракции: 1-2
- Культура: TBD
- Bestiary: минимальный

## Level Design

## level_design

Дизайн уровней для «Rhythm_of_War»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Navigation

## navigation

Навигация для «Rhythm_of_War»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Combat Spaces

## combat_spaces

Боевые пространства для «Rhythm_of_War»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Resources

## resources

Ресурсы для «Rhythm_of_War»:
- Ресурсов в экономике: 6
- Тип системы: Economy
- Тиров: 4
- Тип кривой: exponential

## Tech Tree

## tech_tree

Дерево технологий для «Rhythm_of_War»:
- Ресурсов в экономике: 6
- Тип системы: Economy
- Тиров: 4
- Тип кривой: exponential

## Difficulty Curve

## Кривая сложности

Кривая сложности «Rhythm_of_War» — тип: s_curve. Формула: y = base / (1 + exp(-growth_rate * (level - levels / 2))) Коэффициент роста: 0.15

Тир-модель: Onboarding: linear, Foundation: linear, Expansion: exponential, Mastery: exponential.

Принцип: первые 30% контента — линейный рост (onboarding), затем кривая ускоряется к потолку мастерства. Perceived difficulty отслеживается через content_plan.perceived_difficulty_table. Баланс потока (flow): при выходе за пределы ±15% от целевого perceived difficulty — корректировка врагов/наград.

## Hud Ui

## hud_ui

UX/UI для «Rhythm_of_War» в жанре Rhythm. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Menus Navigation

## menus_navigation

UX/UI для «Rhythm_of_War» в жанре Rhythm. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Visual Style

## visual_style

Визуальный стиль «Rhythm_of_War»:
- Эстетика: challenge
- Палитра: сбалансированная палитра
- Стиль: стилизованный
- Анимация: скелетная

## Sound

## sound

Звуковое design «Rhythm_of_War»:
- Музыка: адаптивная
- SFX: универсальные игровые звуки
- Озвучка: текст + ключевые фразы
- Аудио-дизайнер: TBD

## Localization

## Локализация

Локализация «Rhythm_of_War»:
- Языки: RU, EN
- Текст: полный перевод
- Озвучка: EN только
- Дата завершения локализации: за 2 месяца до релиза

## Testing Plan

## План тестирования

Тестирование «Rhythm_of_War»:
- Unit тесты: критические механики
- Integration: пайплайн (concept → GDD)
- Playtest: 5 итераций по 10 игроков
- Beta: открытая бета за 1 месяц
- Автоматизация: CI/CD pipeline

## Risks

## Риски

Основные риски «Rhythm_of_War»:
- Scope creep: средний
- Технические: оптимизация
- Дизайн: баланс экономики (патологии обнаружены)
- Расписание: buffer 20%

## Team Fit

## Команда

Команда для «Rhythm_of_War»:
- Геймдизайнер: 1
- Программист: 2-3
- Художник: 2-3
- Звук: 1 (или аутсорс)
- QA: 1-2
- Продюсер: 1 (совместитель)

## Live Ops Plan

## Live Ops

Live ops для «Rhythm_of_War»:
- Сезоны: не применимо
- Events: праздничные
- Монетизация: b2p

## Meta Game

## Мета-игра

Мета-игровые системы «Rhythm_of_War» — то, что существует «поверх» основного core loop.

Системы:
- NG+
- multiple save slots
- achievement system

Монетизация: b2p → определяет набор meta-систем.

Save slots: 3 (по умолчанию). NG+: да, перенос прокачки.

## Milestones

## Milestones

Milestones «Rhythm_of_War»:
1. Prototype (4 недели)
2. Vertical Slice (8 недель)
3. Alpha (50% контента)
4. Beta (feature complete)
5. Gold Master
6. Launch

Текущая стадия: preproduction

