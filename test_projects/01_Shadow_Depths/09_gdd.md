# Shadow_Depths

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

# Shadow_Depths

**Жанр:** RPG

A dark roguelike where you descend into procedurally generated dungeons collecting souls

## Logline

A roguelike game where every decision reshapes the world — combining "A dark roguelike where you descend into procedurally generat…" with emergent narrative consequences.

## Concept

Концепция игры «Shadow_Depths» — A dark roguelike where you descend into procedurally generated dungeons collecting souls.

## Usp

A roguelike game where every decision reshapes the world — combining "A dark roguelike where you descend into procedurally generat…" with emergent narrative consequences.

## Core Loop

## Core Loop

1. {"action":"Оценить ситуацию (explore)","mechanics":["explore"],"resources_consumed":[],"resources_produced":["information"],"feedback_type":"neutral","duration_estimate":8}
2. {"action":"Действовать (combat)","mechanics":["combat"],"resources_consumed":["information"],"resources_produced":["state_change"],"feedback_type":"neutral","duration_estimate":15}
3. {"action":"Сбалансировать (reward)","mechanics":["reward"],"resources_consumed":["state_change"],"resources_produced":["stability"],"feedback_type":"positive","duration_estimate":15}
4. {"action":"Восстановиться (Восстановление)","mechanics":["Восстановление"],"resources_consumed":["stability"],"resources_produced":["resources"],"feedback_type":"positive","duration_estimate":30}
5. {"action":"Адаптироваться","mechanics":["explore"],"resources_consumed":["resources"],"resources_produced":["information"],"feedback_type":"neutral","duration_estimate":8}

## Mechanics

## Mechanics

```json
{
  "base": [
    {
      "id": "vragi",
      "name": "Враги",
      "group": "Базовые",
      "category": "base",
      "desc": "Наличие противников, создающих препятствия и угрозы. Основа конфликтного взаимодействия и баланса вызова.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "inventar",
      "name": "Инвентарь",
      "group": "Базовые",
      "category": "base",
      "desc": "Система хранения и управления предметами. Управление ограниченным пространством создаёт стратегические решения о приоритетах.",
      "matched_genres": [
        "roguelike"
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
    }
  ],
  "combat": [
    {
      "id": "bronya",
      "name": "Броня",
      "group": "Боевые",
      "category": "combat",
      "desc": "Защитный слой, снижающий получаемый урон. Создаёт тактический ресурс управления выживаемостью и визуальную прогрессию.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "besshumnoe_oruzhie",
      "name": "Бесшумное оружие",
      "group": "Боевые",
      "category": "combat",
      "desc": "Оружие, не привлекающее внимание врагов. Ключевой инструмент стелс-подхода к боевым ситуациям.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    }
  ],
  "progression": [
    {
      "id": "perki",
      "name": "Перки",
      "group": "Прогрессия",
      "category": "progression",
      "desc": "Пассивные или активные бонусы, получаемые при определённых условиях. Добавляют вариативность билда и персонализацию персонажа.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "harakteristiki",
      "name": "Характеристики",
      "group": "Прогрессия",
      "category": "progression",
      "desc": "Числовые параметры персонажа (сила, ловкость, интеллект и пр.), определяющие его возможности. Фундамент ролевой системы.",
      "matched_genres": [
        "roguelike"
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
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "ryvok",
      "name": "Рывок",
      "group": "Движение",
      "category": "spatial",
      "desc": "Быстрое перемещение на короткое расстояние. Инструмент для уклонения и агрессивного сближения с противником.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "boevaya_mashina",
      "name": "Боевая машина",
      "group": "Движение",
      "category": "spatial",
      "desc": "Управляемая боевая техника с уникальными характеристиками. Существенно расширяет боевые и навигационные возможности.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    }
  ],
  "social": [
    {
      "id": "kraft",
      "name": "Крафт",
      "group": "Экономика",
      "category": "social",
      "desc": "Создание новых предметов из имеющихся ресурсов. Петля «собери → создай → используй» — фундамент прогрессии через созидание.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "zelya",
      "name": "Зелья",
      "group": "Экономика",
      "category": "social",
      "desc": "Расходуемые предметы с временными эффектами. Создают ресурсную петлю подготовки и потребления в критические моменты.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    },
    {
      "id": "kooperativ",
      "name": "Кооператив",
      "group": "Социальные",
      "category": "social",
      "desc": "Совместная игра 2+ игроков: общие цели, разделение ролей. Создаёт чувство товарищества и общих достижений.",
      "matched_genres": [
        "roguelike"
      ],
      "source": "mechanics_db"
    }
  ],
  "total_count": 14,
  "conflicts_resolved": [],
  "synergies_detected": [
    {
      "name": "Перки ↔ Броня",
      "score": 0.85
    },
    {
      "name": "Враги ↔ Процедурная генерация",
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
    "roguelike"
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
  "secondary": "discovery",
  "tertiary": "sensation",
  "rationale": "Primary aesthetic \"challenge\" matches genre \"roguelike\" and idea emphasis. Secondary/tertiary chosen to broaden the player experience."
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

Система сложности «Shadow_Depths» (жанр: RPG) предлагает 3 уровней: Easy / Normal / Hard.

Прогрессия разбита на 4 тиров, каждый со своей кривой сложности (см. difficulty_curve).

Валидация прогрессии: пройдено 9 из 11 проверок.

Модификаторы сложности: здоровье врагов, урон врагов, частота checkpoint, доступность tutorial hints. Accessibility: настраиваемые привязки управления, опции цвета/шрифта, возможность пропуска QTE, ассистивный режим (auto-aim, slow-motion). Целевая аудитория: опытные игроки жанра RPG.

## Economy

## Economy

- System type: Economy
- Resource count: 6
- Has pathology: yes

## Narrative

## Нарратив

Игра «Shadow_Depths» в жанре RPG использует нарративные элементы для усиления эстетики «challenge».

**Ludonarrative анализ:** Гармония
Механики и нарратив согласованно выражают эстетику "challenge".

## World Overview

## Обзор мира

Мир «Shadow_Depths» построен вокруг эстетики «challenge». Жанр: RPG.

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

Сюжет «Shadow_Depths» следует структуре, основанной на core loop из 5 шагов.

Основные арки:
1. Завязка — введение в мир и конфликт
2. Развитие — усложнение через gameplay
3. Кульминация — финальное противостояние
4. Развязка — разрешение конфликта

Жанр: RPG

## Themes

## Темы

Основные темы «Shadow_Depths»:
- Преодоление, мастерство, рост через трудности
- Взаимодействие механик и нарратива
- Эмоциональное путешествие игрока

Primary aesthetic: challenge

## Tone Voice

## Тон и голос

Тон «Shadow_Depths» определяется жанром RPG и эстетикой «challenge».

Тональность:
- Диалоги: динамичные, лаконичные
- Описание: сбалансированное
- UI текст: краткий, функциональный

## Story Mechanics

## Сюжетные механики

Сюжетные механики «Shadow_Depths» интегрированы с core loop типа «ecology».

Механики:
- Квесты и задания
- Диалоговые деревья
- Сюжетные триггеры
- Branching choices (если применимо)

Тип цикла: ecology

## Branching Structure

## Ветвление сюжета

Игра следует линейной структуре с локальными выборами.

Структура:
- Основная линия: линейная
- Побочные квесты: линейные
- Концовки: одна основная + вариации

Жанр: RPG

## Target Audience

Целевая аудитория «Shadow_Depths» — игроки жанра RPG.

Профиль динамики:
```json
{
  "core_dynamics": [
    "skill_scaling",
    "difficulty_curves",
    "mastery_growth"
  ],
  "supporting_dynamics": [
    "exploration_loops",
    "secret_finding",
    "world_unfolding",
    "combat_pacing",
    "feedback_effects",
    "audio_visual_sync"
  ],
  "emergence_potential": "strong",
  "rationale": "Core dynamics derive from primary aesthetic \"challenge\" (skill_scaling, difficulty_curves, mastery_growth). Supporting dynamics come from secondary \"discovery\" and tertiary \"sensation\" aesthetics."
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

«Shadow_Depths» — оригинальная интеллектуальная собственность. Полные права принадлежат the studio.

Тип IP: Original IP.

Права: the studio владеет всеми авторскими правами, товарными знаками и связанными правами на название, персонажей, мир и механики игры.

Third-party licenses: используются только стандартные middleware (движок, аудио-библиотеки) — каждая с собственной EULA.

Trademark: регистрация товарного знака «Shadow_Depths» в ключевых юрисдикциях (RU, US, EU) рекомендуется до релиза.

## Platforms

Платформы «Shadow_Depths» TBD.

## Tech Requirements

## Технические требования

Минимальные требования: OS: Windows 10 64-bit, CPU: Intel i5-6600 / AMD Ryzen 5 1600, RAM: 8 GB, GPU: GTX 1060 / RX 580, Storage: 10-30 GB.

Рекомендуемые требования: OS: Windows 11 64-bit, CPU: Intel i7-10700 / AMD Ryzen 7 3700X, RAM: 16 GB, GPU: RTX 3060 / RX 6700 XT (VRAM 4-6 GB), Storage: SSD 10-30 GB.

Сеть: Optional: cloud save sync, asynchronous features.

Периферия: Keyboard + Mouse, Xbox-compatible gamepad, optional racing wheel / HOTAS (genre-dependent).

Целевые платформы: не заданы — выведены из жанра.

## Ux

## ux

UX/UI для «Shadow_Depths» в жанре RPG. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Ux Flow

## ux_flow

UX/UI для «Shadow_Depths» в жанре RPG. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Ui Mockups

## ui_mockups

UX/UI для «Shadow_Depths» в жанре RPG. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Controls

## controls

Управление для «Shadow_Depths» в жанре RPG.

Схема управления:
- клавиатура / геймпад
- Назначение кнопок: TBD
- Accessibility: настраиваемые привязки

## Camera

## camera

Камера для «Shadow_Depths» в жанре RPG.

Настройки камеры:
- Тип: 3rd person
- Дистанция: средняя
- Управление: автоматическое

## Game Modes

## Игровые режимы

Режимы «Shadow_Depths»:
- Single Player: основной (единственный)

- Difficulty: Easy / Normal / Hard

## Social Features

## Социальные функции

Социальные системы «Shadow_Depths» (жанр: RPG): определены как ядро опыта.

Функции:
- Крафт
- Зелья
- Кооператив

Игра не имеет онлайн-мультиплеера — социальные функции носят асинхронный характер (например, гостевые визиты, обмен UGC).

Moderation: chat filter + report system. Privacy: opt-in для всех социальных функций.

## Dialogues

## Диалоги

Система диалогов «Shadow_Depths»:
- Тип: линейные реплики
- Озвучка: частичная
- Локализация: RU + EN
- Количество NPC: TBD

## Quests

## Квесты

Квестовая система «Shadow_Depths»:
- Основные квесты: 50 уровней
- Побочные квесты: ~25
- Daily/Weekly: нет
- Структура: линейные

## Lore And World

## Лор и мир

История мира «Shadow_Depths»:
- Эпоха: вымышленный мир
- Фракции: 1-2
- Культура: TBD
- Bestiary: минимальный

## Level Design

## level_design

Дизайн уровней для «Shadow_Depths»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Navigation

## navigation

Навигация для «Shadow_Depths»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Combat Spaces

## combat_spaces

Боевые пространства для «Shadow_Depths»:
- Структура: линейная + открытые зоны
- Масштаб: 50 уровней/зон
- Темп: сбалансированный

## Resources

## resources

Ресурсы для «Shadow_Depths»:
- Ресурсов в экономике: 6
- Тип системы: Economy
- Тиров: 4
- Тип кривой: exponential

## Tech Tree

## tech_tree

Дерево технологий для «Shadow_Depths»:
- Ресурсов в экономике: 6
- Тип системы: Economy
- Тиров: 4
- Тип кривой: exponential

## Difficulty Curve

## Кривая сложности

Кривая сложности «Shadow_Depths» — тип: s_curve. Формула: y = base / (1 + exp(-growth_rate * (level - levels / 2))) Коэффициент роста: 0.15

Тир-модель: Onboarding: linear, Foundation: linear, Expansion: exponential, Mastery: exponential.

Принцип: первые 30% контента — линейный рост (onboarding), затем кривая ускоряется к потолку мастерства. Perceived difficulty отслеживается через content_plan.perceived_difficulty_table. Баланс потока (flow): при выходе за пределы ±15% от целевого perceived difficulty — корректировка врагов/наград.

## Hud Ui

## hud_ui

UX/UI для «Shadow_Depths» в жанре RPG. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Menus Navigation

## menus_navigation

UX/UI для «Shadow_Depths» в жанре RPG. Требует детального прототипирования.

Ключевые экраны:
- Главное меню
- HUD (игровой интерфейс)
- Меню паузы
- Экран инвентаря

Управление: универсальное

## Visual Style

## visual_style

Визуальный стиль «Shadow_Depths»:
- Эстетика: challenge
- Палитра: сбалансированная палитра
- Стиль: стилизованный
- Анимация: скелетная

## Sound

## sound

Звуковое design «Shadow_Depths»:
- Музыка: адаптивная
- SFX: универсальные игровые звуки
- Озвучка: текст + ключевые фразы
- Аудио-дизайнер: TBD

## Localization

## Локализация

Локализация «Shadow_Depths»:
- Языки: RU, EN
- Текст: полный перевод
- Озвучка: EN только
- Дата завершения локализации: за 2 месяца до релиза

## Testing Plan

## План тестирования

Тестирование «Shadow_Depths»:
- Unit тесты: критические механики
- Integration: пайплайн (concept → GDD)
- Playtest: 5 итераций по 10 игроков
- Beta: открытая бета за 1 месяц
- Автоматизация: CI/CD pipeline

## Risks

## Риски

Основные риски «Shadow_Depths»:
- Scope creep: средний
- Технические: оптимизация
- Дизайн: баланс экономики (патологии обнаружены)
- Расписание: buffer 20%

## Team Fit

## Команда

Команда для «Shadow_Depths»:
- Геймдизайнер: 1
- Программист: 2-3
- Художник: 2-3
- Звук: 1 (или аутсорс)
- QA: 1-2
- Продюсер: 1 (совместитель)

## Live Ops Plan

## Live Ops

Live ops для «Shadow_Depths»:
- Сезоны: не применимо
- Events: праздничные
- Монетизация: b2p

## Meta Game

## Мета-игра

Мета-игровые системы «Shadow_Depths» — то, что существует «поверх» основного core loop.

Системы:
- NG+
- multiple save slots
- achievement system

Монетизация: b2p → определяет набор meta-систем.

Save slots: 3 (по умолчанию). NG+: да, перенос прокачки.

## Milestones

## Milestones

Milestones «Shadow_Depths»:
1. Prototype (4 недели)
2. Vertical Slice (8 недель)
3. Alpha (50% контента)
4. Beta (feature complete)
5. Gold Master
6. Launch

Текущая стадия: preproduction

