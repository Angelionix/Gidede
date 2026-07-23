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
10. [economy](#economy)
11. [narrative](#narrative)
12. [target_audience](#target_audience)
13. [monetization](#monetization)
14. [platforms](#platforms)
15. [ux](#ux)
16. [tech_stack](#tech_stack)
17. [art_style](#art_style)
18. [sound](#sound)
19. [localization](#localization)
20. [testing_plan](#testing_plan)
21. [risks](#risks)

## Title

# Rhythm_of_War

**Жанр:** Rhythm

Rhythm game commanding armies

## Logline

A rhythm game where every decision reshapes the world — combining Rhythm game commanding armies with emergent narrative consequences.

## Concept

Концепция игры «Rhythm_of_War» — Rhythm game commanding armies.

## Usp

A rhythm game where every decision reshapes the world — combining Rhythm game commanding armies with emergent narrative consequences.

## Core Loop

## Core Loop

1. {"action":"Find target (explore)","mechanics":["explore"],"resources_consumed":[],"resources_produced":["signal"],"feedback_type":"neutral","duration_estimate":6}
2. {"action":"Engage (combat)","mechanics":["combat"],"resources_consumed":["energy","ammo"],"resources_produced":[],"feedback_type":"negative","duration_estimate":10}
3. {"action":"Collect rewards (reward)","mechanics":["reward"],"resources_consumed":[],"resources_produced":["xp","gold"],"feedback_type":"positive","duration_estimate":4}
4. {"action":"Upgrade (progress)","mechanics":["progress"],"resources_consumed":["gold"],"resources_produced":["power","ability"],"feedback_type":"positive","duration_estimate":8}
5. {"action":"Return to base (return)","mechanics":["return"],"resources_consumed":[],"resources_produced":["rest","save"],"feedback_type":"neutral","duration_estimate":5}

## Mechanics

## Mechanics

```json
{
  "base": [
    {
      "name": "Изучение мира",
      "group": "Базовые",
      "desc": "Игрок исследует игровое пространство, открывая новые локации и объекты. Фундаментальная механика, определяющая паттерны перемещения и обнаружения."
    },
    {
      "name": "Достижения и очки",
      "group": "Базовые",
      "desc": "Система начисления очков и мета-целей, мотивирующая игрока к повторным действиям и совершенствованию результатов."
    }
  ],
  "combat": [
    {
      "name": "Броня",
      "group": "Боевые",
      "desc": "Защитный слой, снижающий получаемый урон. Создаёт тактический ресурс управления выживаемостью и визуальную прогрессию."
    },
    {
      "name": "Запас патронов",
      "group": "Боевые",
      "desc": "Ограниченный боезапас, создающий ресурсный дефицит в бою. Заставляет принимать решения о расходе и поиске пополнения."
    }
  ],
  "progression": [
    {
      "name": "Очки опыта",
      "group": "Прогрессия",
      "desc": "Количественная мера прогресса персонажа, накапливаемая через действия. Управляет темпом роста и создаёт петлю «действие → награда → рост»."
    },
    {
      "name": "Перки",
      "group": "Прогрессия",
      "desc": "Пассивные или активные бонусы, получаемые при определённых условиях. Добавляют вариативность билда и персонализацию персонажа."
    }
  ],
  "spatial": [
    {
      "name": "map_exploration",
      "group": "spatial"
    },
    {
      "name": "objective_navigation",
      "group": "spatial"
    },
    {
      "name": "spawn_points",
      "group": "spatial"
    }
  ],
  "social": [
    {
      "name": "leaderboard",
      "group": "social"
    },
    {
      "name": "achievement_share",
      "group": "social"
    },
    {
      "name": "coop_progression",
      "group": "social"
    }
  ],
  "total_count": 12,
  "conflicts_resolved": [],
  "synergies_detected": [
    {
      "name": "Очки опыта ↔ Броня",
      "score": 0.85
    },
    {
      "name": "Изучение мира ↔ map_exploration",
      "score": 0.72
    }
  ],
  "compatibility_score": 0,
  "mechanics_db_source": "MechanicsDB (SW.BAND, 128 механик)"
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

Баланс «Rhythm_of_War» TBD.

## Progression

## Progression

- Total levels: 50
- Tier count: 4
- Curve type: exponential
- Target duration (h): 40

## Economy

## Economy

- System type: Economy
- Resource count: 6
- Has pathology: yes

## Narrative

## narrative

{
  "result": "Гармония",
  "description": "Механики и нарратив согласованно выражают эстетику \"challenge\".",
  "mechanic_narrative_pairs": [
    {
      "mechanic": "combat",
      "narrative": "main_conflict",
      "consistency": 0.85
    },
    {
      "mechanic": "progression",
      "narrative": "character_growth",
      "consistency": 0.78
    },
    {
      "mechanic": "exploration",
      "narrative": "world_discovery",
      "consistency": 0.72
    }
  ],
  "correction": "Усилить нарративные отсылки в боевых эпизодах для закрепления эстетики"
}

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

## Platforms

Платформы «Rhythm_of_War» TBD.

## Ux

Раздел «ux» в разработке.

## Tech Stack

Раздел «tech_stack» в разработке.

## Art Style

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

## Sound

Раздел «sound» в разработке.

## Localization

Раздел «localization» в разработке.

## Testing Plan

Раздел «testing_plan» в разработке.

## Risks

Раздел «risks» в разработке.

