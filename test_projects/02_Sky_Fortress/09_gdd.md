# Sky_Fortress

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

# Sky_Fortress

**Жанр:** Tower Defense

Tower defense with floating fortresses and aerial waves

## Logline

A tower_defense game where every decision reshapes the world — combining "Tower defense with floating fortresses and aerial waves" with emergent narrative consequences.

## Concept

Концепция игры «Sky_Fortress» — Tower defense with floating fortresses and aerial waves.

## Usp

A tower_defense game where every decision reshapes the world — combining "Tower defense with floating fortresses and aerial waves" with emergent narrative consequences.

## Core Loop

## Core Loop

1. {"action":"Построить башни (explore)","mechanics":["explore"],"resources_consumed":[],"resources_produced":["gold"],"feedback_type":"neutral","duration_estimate":20}
2. {"action":"Защитить базу (combat)","mechanics":["combat"],"resources_consumed":["gold"],"resources_produced":["defense"],"feedback_type":"negative","duration_estimate":45}
3. {"action":"Улучшить башни (reward)","mechanics":["reward"],"resources_consumed":["defense"],"resources_produced":["upgraded_tower"],"feedback_type":"positive","duration_estimate":20}
4. {"action":"Отразить волну (Волна)","mechanics":["Волна"],"resources_consumed":["upgraded_tower"],"resources_produced":["wave_clear"],"feedback_type":"positive","duration_estimate":45}
5. {"action":"Восстановиться","mechanics":["explore"],"resources_consumed":["wave_clear"],"resources_produced":["gold"],"feedback_type":"neutral","duration_estimate":10}

## Mechanics

## Mechanics

```json
{
  "base": [
    {
      "id": "spavn_vragov",
      "name": "Спавн врагов",
      "group": "Базовые",
      "category": "base",
      "desc": "Система генерации врагов по расписанию или триггерам. Определяет темп и сложность: волны, бесконечный спавн, условные триггеры.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "izuchenie_mira",
      "name": "Изучение мира",
      "group": "Базовые",
      "category": "base",
      "desc": "Игрок исследует игровое пространство, открывая новые локации и объекты. Фундаментальная механика, определяющая паттерны перемещения и обнаружения.",
      "cross_genre": true,
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
    },
    {
      "id": "taymer",
      "name": "Таймер",
      "group": "Время",
      "category": "base",
      "desc": "Ограничение времени на выполнение действий. Создаёт давление и приоритизацию, повышая интенсивность опыта.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "tempovoe_uskorenie",
      "name": "Темповое ускорение",
      "group": "Время",
      "category": "base",
      "desc": "Постепенное или ступенчатое ускорение темпа игры. Создаёт нарастающее напряжение и проверяет предел мастерства.",
      "matched_genres": [
        "tower_defense"
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
        "tower_defense"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "razvedka_i_tuman_voyny",
      "name": "Разведка и туман войны",
      "group": "Информация",
      "category": "base",
      "desc": "Скрытие информации до её обнаружения: юниты-разведчики, наблюдательные пункты. Создаёт стратегическую неопределённость.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    }
  ],
  "combat": [
    {
      "id": "multi_target_ataki",
      "name": "Мульти-таргет атаки",
      "group": "Боевые",
      "category": "combat",
      "desc": "Атаки, поражающие несколько целей одновременно: пробивание, цепные реакции, AoE. Меняет приоритет целей — группа слабых врагов становится выгоднее одного сильного.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "kontrol_tolpy",
      "name": "Контроль толпы",
      "group": "Боевые",
      "category": "combat",
      "desc": "Механики замедления, оглушения или группирования врагов для эффективного уничтожения. Сочетается с мульти-таргет атаками.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    }
  ],
  "progression": [
    {
      "id": "trenirovka_reaktsii",
      "name": "Тренировка реакции",
      "group": "Навыки",
      "category": "progression",
      "desc": "Механики, требующие быстрой реакции на визуальные/звуковые стимулы. Развивает рефлексы и создаёт адреналиновый темп.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    }
  ],
  "spatial": [
    {
      "id": "protsedurnaya_generatsiya",
      "name": "Процедурная генерация",
      "group": "Пространство",
      "category": "spatial",
      "desc": "Алгоритмическая генерация контента: уровни, миры, враги. Обеспечивает реиграбельность и уникальность каждого прохождения.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "oborona_bazy",
      "name": "Оборона базы",
      "group": "Территория",
      "category": "spatial",
      "desc": "Защита своей территории от нападения. Создаёт динамику подготовки и реакции на угрозы.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "patrulirovanie",
      "name": "Патрулирование",
      "group": "Территория",
      "category": "spatial",
      "desc": "Регулярное обход территории для обнаружения угроз. Создаёт ритм безопасности и бдительности.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    }
  ],
  "social": [
    {
      "id": "kooperativ",
      "name": "Кооператив",
      "group": "Социальные",
      "category": "social",
      "desc": "Совместная игра 2+ игроков: общие цели, разделение ролей. Создаёт чувство товарищества и общих достижений.",
      "matched_genres": [
        "tower_defense"
      ],
      "source": "mechanics_db"
    }
  ],
  "total_count": 14,
  "conflicts_resolved": [],
  "synergies_detected": [
    {
      "name": "Тренировка реакции ↔ Мульти-таргет атаки",
      "score": 0.85
    },
    {
      "name": "Спавн врагов ↔ Процедурная генерация",
      "score": 0.72
    },
    {
      "name": "Изучение мира (cross-genre: adventure, horror) ↔ primary aesthetic",
      "score": 0.65
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
      "name": "Изучение мира",
      "group": "Базовые",
      "desc": "Игрок исследует игровое пространство, открывая новые локации и объекты. Фундаментальная механика, определяющая паттерны перемещения и обнаружения.",
      "original_genres": [
        "adventure",
        "horror",
        "jrpg",
        "metroidvania",
        "mmorpg",
        "puzzle",
        "rpg",
        "sandbox"
      ],
      "matched_aesthetics": [
        "discovery",
        "fantasy",
        "sensation"
      ]
    },
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
    "tower_defense"
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
  "primary": "challenge",
  "secondary": "submission",
  "tertiary": "discovery",
  "rationale": "Primary aesthetic \"challenge\" matches genre \"tower_defense\" and idea emphasis. Secondary/tertiary chosen to broaden the player experience."
}
```

## Balance

## Balance

- Type: mixed
- Overall score: 0.013
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

Система сложности «Sky_Fortress» (жанр: Tower Defense) предлагает 3 уровней: Easy / Normal / Hard.

Прогрессия разбита на 4 тиров, каждый со своей кривой сложности (см. difficulty_curve).

Валидация прогрессии: пройдено 9 из 11 проверок.

Модификаторы сложности: здоровье врагов, урон врагов, частота checkpoint, доступность tutorial hints. Accessibility: настраиваемые привязки управления, опции цвета/шрифта, возможность пропуска QTE, ассистивный режим (auto-aim, slow-motion). Целевая аудитория: опытные игроки жанра Tower Defense.

## Economy

## Economy

- System type: Economy
- Resource count: 6
- Has pathology: yes

## Narrative

## Нарратив

Игра «Sky_Fortress» в жанре Tower Defense использует нарративные элементы для усиления эстетики «challenge».

**Ludonarrative анализ:** Гармония
Механики и нарратив согласованно выражают эстетику "challenge".

## World Overview

## Обзор мира

Мир «Sky_Fortress» построен вокруг эстетики «challenge». Жанр: Tower Defense.

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

Сюжет «Sky_Fortress» следует структуре, основанной на core loop из 5 шагов.

Основные арки:
1. Завязка — введение в мир и конфликт
2. Развитие — усложнение через gameplay
3. Кульминация — финальное противостояние
4. Развязка — разрешение конфликта

Жанр: Tower Defense

## Themes

## Темы

Основные темы «Sky_Fortress»:
- Преодоление, мастерство, рост через трудности
- Взаимодействие механик и нарратива
- Эмоциональное путешествие игрока

Primary aesthetic: challenge

## Tone Voice

## Тон и голос

Тон «Sky_Fortress» определяется жанром Tower Defense и эстетикой «challenge».

Тональность:
- Диалоги: динамичные, лаконичные
- Описание: сбалансированное
- UI текст: краткий, функциональный

## Story Mechanics

## Сюжетные механики

Сюжетные механики «Sky_Fortress» интегрированы с core loop типа «tower_defense».

Механики:
- Квесты и задания
- Диалоговые деревья
- Сюжетные триггеры
- Branching choices (если применимо)

Тип цикла: tower_defense

## Branching Structure

## Ветвление сюжета

Игра следует линейной структуре с локальными выборами.

Структура:
- Основная линия: линейная
- Побочные квесты: линейные
- Концовки: одна основная + вариации

Жанр: Tower Defense

## Target Audience

Целевая аудитория «Sky_Fortress» — игроки жанра Tower Defense.

Профиль динамики:
```json
{
  "core_dynamics": [
    "skill_scaling",
    "difficulty_curves",
    "mastery_growth"
  ],
  "supporting_dynamics": [
    "routine_formation",
    "habit_loops",
    "flow_state",
    "exploration_loops",
    "secret_finding",
    "world_unfolding"
  ],
  "emergence_potential": "strong",
  "rationale": "Core dynamics derive from primary aesthetic \"challenge\" (skill_scaling, difficulty_curves, mastery_growth). Supporting dynamics come from secondary \"submission\" and tertiary \"discovery\" aesthetics."
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

«Sky_Fortress» — оригинальная интеллектуальная собственность. Полные права принадлежат the studio.

Тип IP: Original IP.

Права: the studio владеет всеми авторскими правами, товарными знаками и связанными правами на название, персонажей, мир и механики игры.

Third-party licenses: используются только стандартные middleware (движок, аудио-библиотеки) — каждая с собственной EULA.

Trademark: регистрация товарного знака «Sky_Fortress» в ключевых юрисдикциях (RU, US, EU) рекомендуется до релиза.

## Platforms

Платформы «Sky_Fortress» TBD.

## Tech Requirements

## Технические требования

Минимальные требования: OS: Windows 10 64-bit, CPU: Intel i5-6600 / AMD Ryzen 5 1600, RAM: 8 GB, GPU: GTX 1060 / RX 580, Storage: 10-30 GB.

Рекомендуемые требования: OS: Windows 11 64-bit, CPU: Intel i7-10700 / AMD Ryzen 7 3700X, RAM: 16 GB, GPU: RTX 3060 / RX 6700 XT (VRAM 4-6 GB), Storage: SSD 10-30 GB.

Сеть: Optional: cloud save sync, asynchronous features.

Периферия: Keyboard + Mouse, Xbox-compatible gamepad, optional racing wheel / HOTAS (genre-dependent).

Целевые платформы: не заданы — выведены из жанра.

## Ux

## ux

UX/UI для «Sky_Fortress» в жанре Tower Defense. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Ux Flow

## ux_flow

UX/UI для «Sky_Fortress» в жанре Tower Defense. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Ui Mockups

## ui_mockups

UX/UI для «Sky_Fortress» в жанре Tower Defense. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Controls

## controls

Управление для «Sky_Fortress» в жанре Tower Defense.

Схема управления:
- клавиатура / геймпад
- Назначение кнопок: TBD
- Accessibility: настраиваемые привязки

## Camera

## camera

Камера для «Sky_Fortress» в жанре Tower Defense.

Настройки камеры:
- Тип: 3rd person
- Дистанция: средняя
- Управление: автоматическое

## Game Modes

## Игровые режимы

Режимы «Sky_Fortress»:
- Single Player: основной (единственный)

- Difficulty: Easy / Normal / Hard

## Social Features

## Социальные функции

Социальные системы «Sky_Fortress» (жанр: Tower Defense): определены как ядро опыта.

Функции:
- Кооператив

Игра не имеет онлайн-мультиплеера — социальные функции носят асинхронный характер (например, гостевые визиты, обмен UGC).

Moderation: chat filter + report system. Privacy: opt-in для всех социальных функций.

## Dialogues

## Диалоги

Система диалогов «Sky_Fortress»:
- Тип: линейные реплики
- Озвучка: частичная
- Локализация: RU + EN
- Количество NPC: TBD

## Quests

## Квесты

Квестовая система «Sky_Fortress»:
- Основные квесты: 50 уровней
- Побочные квесты: ~25
- Daily/Weekly: нет
- Структура: линейные

## Lore And World

## Лор и мир

История мира «Sky_Fortress»:
- Эпоха: вымышленный мир
- Фракции: 1-2
- Культура: TBD
- Bestiary: минимальный

## Level Design

## level_design

Дизайн уровней для «Sky_Fortress»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Navigation

## navigation

Навигация для «Sky_Fortress»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Combat Spaces

## combat_spaces

Боевые пространства для «Sky_Fortress»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Resources

## resources

Ресурсы для «Sky_Fortress»:
- Ресурсов в экономике: 6
- Тип системы: Economy
- Тиров: 4
- Тип кривой: exponential

## Tech Tree

## tech_tree

Дерево технологий для «Sky_Fortress»:
- Ресурсов в экономике: 6
- Тип системы: Economy
- Тиров: 4
- Тип кривой: exponential

## Difficulty Curve

## Кривая сложности

Кривая сложности «Sky_Fortress» — тип: s_curve. Формула: y = base / (1 + exp(-growth_rate * (level - levels / 2))) Коэффициент роста: 0.15

Тир-модель: Onboarding: linear, Foundation: linear, Expansion: exponential, Mastery: exponential.

Принцип: первые 30% контента — линейный рост (onboarding), затем кривая ускоряется к потолку мастерства. Perceived difficulty отслеживается через content_plan.perceived_difficulty_table. Баланс потока (flow): при выходе за пределы ±15% от целевого perceived difficulty — корректировка врагов/наград.

## Hud Ui

## hud_ui

UX/UI для «Sky_Fortress» в жанре Tower Defense. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Menus Navigation

## menus_navigation

UX/UI для «Sky_Fortress» в жанре Tower Defense. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Visual Style

## visual_style

Визуальный стиль «Sky_Fortress»:
- Эстетика: challenge
- Палитра: сбалансированная палитра
- Стиль: стилизованный
- Анимация: скелетная

## Sound

## sound

Звуковое design «Sky_Fortress»:
- Музыка: адаптивная
- SFX: универсальные игровые звуки
- Озвучка: текст + ключевые фразы
- Аудио-дизайнер: TBD

## Localization

## Локализация

Локализация «Sky_Fortress»:
- Языки: RU, EN
- Текст: полный перевод
- Озвучка: EN только
- Дата завершения локализации: за 2 месяца до релиза

## Testing Plan

## План тестирования

Тестирование «Sky_Fortress»:
- Unit тесты: критические механики
- Integration: пайплайн (concept → GDD)
- Playtest: 5 итераций по 10 игроков
- Beta: открытая бета за 1 месяц
- Автоматизация: CI/CD pipeline

## Risks

## Риски

Основные риски «Sky_Fortress»:
- Scope creep: средний
- Технические: оптимизация
- Дизайн: баланс экономики (патологии обнаружены)
- Расписание: buffer 20%

## Team Fit

## Команда

Команда для «Sky_Fortress»:
- Геймдизайнер: 1
- Программист: 2-3
- Художник: 2-3
- Звук: 1 (или аутсорс)
- QA: 1-2
- Продюсер: 1 (совместитель)

## Live Ops Plan

## Live Ops

Live ops для «Sky_Fortress»:
- Сезоны: не применимо
- Events: праздничные
- Монетизация: b2p

## Meta Game

## Мета-игра

Мета-игровые системы «Sky_Fortress» — то, что существует «поверх» основного core loop.

Системы:
- NG+
- multiple save slots
- achievement system

Монетизация: b2p → определяет набор meta-систем. Обнаружена premium-валюта — battle pass с premium-треком целесообразен.

Save slots: 3 (по умолчанию). NG+: да, перенос прокачки.

## Milestones

## Milestones

Milestones «Sky_Fortress»:
1. Prototype (4 недели)
2. Vertical Slice (8 недель)
3. Alpha (50% контента)
4. Beta (feature complete)
5. Gold Master
6. Launch

Текущая стадия: preproduction

