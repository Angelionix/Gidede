# Фаза 3: Алгоритмы — Спецификация 3.5 и 3.6

> **Проект**: Gidede — Game Design AI System  
> **Дата**: 2026-05-18  
> **Настоящая фаза**: Формализация алгоритмов  
> **Данный документ**: Спецификации алгоритмов 3.5 (Создание системы прогрессии) и 3.6 (Экономическое моделирование)  
> **Источники**: Кн. 4 (Адамс/Дорманс — Machinations), Кн. 6 (Зубек — циклы конверсии), Кн. 7 (Шрайбер — баланс, кривые), Кн. 9 (Газэуэй — формулы роста), Кн. 12 (Роллингс/Моррис — Q-фактор, SPS), Кн. 13 (Селлерс — Engines/Economies/Ecologies), Кн. 16 (D&D — 4 этапа прогрессии), Кн. 17 (Бонд — обратный MDA); Библия геймдизайна (разд. 2.5, 2.6); Концепция программы (разд. 2.5.2, Блок 5); Алгоритмы 3.1–3.4

---

## 3.5 Алгоритм создания системы прогрессии

### 3.5.1 Обзор алгоритма

Алгоритм создания системы прогрессии реализует **Блок 5.3** (Прогрессия и контент-план) архитектуры Gidede и принимает на вход данные из предшествующих алгоритмов: концепцию (3.1), Core Loop (3.2), MDA-профиль механик (3.3) и результаты балансировки (3.4). Его задача — спроектировать систему, которая обеспечивает игроку **ощущение направленного роста** на протяжении всего игрового опыта, от первого взаимодействия до финального контента.

Ключевой принцип: **прогрессия — это не просто «числа растут», а управляемое изменение игрового опыта**. Шрайбер (Кн. 7) формулирует цикл прогрессии: Мотивация → Прогрессия → Награда → Удовлетворение. Каждая итерация этого цикла должна ощущаться значимой, а не механической. Селлерс (Кн. 13) добавляет: прогрессия может быть двух фундаментальных типов — **скриптовая** (замок-и-ключ, спланированная последовательность) и **эмерджентная** (экономические фазы, возникающие из правил). Gidede поддерживает оба типа и их комбинацию.

Алгоритм состоит из 7 этапов. Этапы 1-2 — аналитические (определение параметров прогрессии). Этапы 3-4 — конструирующие (построение кривых и контент-плана). Этап 5 — интегративный (связь прогрессии с экономикой). Этапы 6-7 — валидационные (проверка на патологии и формулирование рекомендаций).

### 3.5.2 Входные данные

```typescript
interface ProgressionInput {
  // Обязательные поля (из предшествующих алгоритмов)
  concept: OnePager;                       // Из алгоритма 3.1
  coreLoop: CoreLoopProfile;               // Из алгоритма 3.2
  mdaProfile: MDAProfile;                  // Из алгоритма 3.3
  balanceResult: BalanceResult;            // Из алгоритма 3.4
  
  // Параметры прогрессии (опционально — AI заполняет, если не указаны)
  targetDuration?: number;                  // Целевая длительность игры (часы)
  targetLevels?: number;                    // Целевое число уровней/рангов
  progressionType?: ProgressionType;        // Тип прогрессии
  monetizationModel?: MonetizationModel;    // Модель монетизации (влияет на pacing)
  
  // Ограничения
  constraints?: ProgressionConstraints;
}

type ProgressionType = 
  | 'linear'               // Линейная: равномерный рост (казуальные)
  | 'exponential'          // Экспоненциальная: ускоряющийся рост
  | 'diminishing'          // Замедляющаяся: быстрый старт → торможение (F2P)
  | 's_curve'              // S-кривая: медленно → быстро → медленно (логистическая)
  | 'intermittent'         // Прерывистая: эмоциональные качели
  | 'custom';              // Произвольная: ручная настройка

interface ProgressionConstraints {
  maxGrindTolerance?: number;             // Максимум повторений до скуки (по умолчанию 5)
  minRewardInterval?: number;             // Минимум наград за час (по умолчанию 3)
  flowTarget?: 'relaxed' | 'balanced' | 'intense'; // Целевой pacing
  contentBudget?: 'low' | 'medium' | 'high';       // Бюджет контента
}
```

### 3.5.3 Этап 1: Определение макро-параметров прогрессии

**Цель**: На основе жанра, целевой аудитории и длительности определить фундаментальные параметры системы прогрессии: количество уровней/рангов, частоту переходов, требования к контенту. Используется макро-модель RPG-прогрессии Шрайбера (Кн. 7), обобщённая на произвольные жанры.

**Алгоритм**:

```
ВХОД: ProgressionInput

// ===== ШАГ 1.1: Определение целевой длительности =====
IF input.targetDuration IS PROVIDED:
    T = input.targetDuration
ELSE:
    // Жанровая эвристика длительности (часы)
    genre_duration_map = {
        "казуальная":     2-10,
        "инди-пазл":      5-15,
        "RPG":            30-80,
        "action":         10-25,
        "стратегия":      20-60,
        "survival":       30-100,
        "roguelike":      50-200,  // Высокая реиграбельность
        "MMO":            500+,    // Живой сервис
        "F2P mobile":     100+     // Долгосрочная вовлечённость
    }
    T = genre_duration_map[input.genre] ?? 20

// ===== ШАГ 1.2: Определение числа уровней/рангов =====
IF input.targetLevels IS PROVIDED:
    L = input.targetLevels
ELSE:
    // Эвристика: частота переходов зависит от pacing
    // Шрайбер: переходов/час ≈ L/T (больше в начале, меньше в конце)
    pacing_map = {
        "relaxed":  0.3,   // Новый уровень каждые ~3.3 часа
        "balanced": 0.5,   // Новый уровень каждые ~2 часа
        "intense":  1.0    // Новый уровень каждый час
    }
    
    target_transitions_per_hour = pacing_map[input.flowTarget] ?? 0.5
    L = ROUND(T * target_transitions_per_hour)
    
    // Ограничения:
    L = MAX(L, 5)     // Минимум 5 уровней (иначе нет ощутимой прогрессии)
    L = MIN(L, 100)   // Максимум 100 (иначе размытие значимости)

// ===== ШАГ 1.3: Расчёт контент-требований (Шрайбер) =====
macro_model = {
    duration: T,
    levels: L,
    transitions: L - 1,
    transitions_per_hour: L / T,
    content_stages: ROUND(L / 2),                    // Количество уникальных стадий
    enemy_configs: CEIL(3 * (L / 2)),                // Минимум конфигураций противников
    stat_points_per_level: (final_stat - base_stat) / (L - 1),
    
    // Дополнительные расчёты:
    avg_session_duration: ESTIMATE_SESSION(genre),    // Средняя сессия (минуты)
    sessions_to_complete: T * 60 / avg_session_duration,
    levels_per_session: L / sessions_to_complete,
    meaningful_choices_per_level: ESTIMATE_CHOICES(genre)  // Осмысленных решений
}

// ===== ШАГ 1.4: Определение типа прогрессии =====
IF input.progressionType IS PROVIDED:
    p_type = input.progressionType
ELSE:
    // Жанровая эвристика типа кривой
    genre_progression_map = {
        "казуальная":     "linear",        // Равномерный рост
        "F2P mobile":     "diminishing",   // Быстрый старт → hook → замедление
        "RPG":            "s_curve",       // Обучение → рост → mastery
        "roguelike":      "intermittent",  // Прерывистая: смерть → restart → дальше
        "стратегия":      "exponential",   // Ускоряющийся рост в конце
        "survival":       "s_curve",       // Медленный старт → расширение → mastery
        "action":         "linear",        // Постоянная скорость роста навыков
        "MMO":            "diminishing",   // Быстрый старт → долгий гринд
        "шутер":          "intermittent"   // Пики боёв → спады (миссии)
    }
    p_type = genre_progression_map[genre] ?? "s_curve"

// ===== ШАГ 1.5: Определение модели прогрессии по Юлу =====
// Дихотомия Юла (Кн. 4): эмерджентность vs прогрессия
emergence_ratio = ASSESS_EMERGENCE_RATIO(coreLoop, mdaProfile)
// emergence_ratio: 0.0 = чистая прогрессия, 1.0 = чистая эмерджентность

progression_model = {
    type: p_type,
    emergence_ratio: emergence_ratio,
    
    // Какой тип замков/ключей доминирует
    lock_key_model: DETERMINE_LOCK_KEY_MODEL(genre, emergence_ratio),
    // "linear" | "metroidvania" | "dynamic" | "emergent" | "hybrid"
    
    // Этапы прогрессии (модель D&D, Кн. 16)
    tiers: PLAN_TIERS(L, genre),
    // Каждый tier = { level_range, scale, dominant_mechanics, balance_type }
}

ВЫХОД: ProgressionMacroModel = {
    duration: T,
    levels: L,
    macro_model: macro_model,
    progression_type: p_type,
    emergence_ratio: emergence_ratio,
    lock_key_model: progression_model.lock_key_model,
    tiers: progression_model.tiers,
    content_requirements: {
        content_stages: macro_model.content_stages,
        enemy_configs: macro_model.enemy_configs,
        meaningful_choices: macro_model.meaningful_choices_per_level * L
    }
}
```

**Таблица: Замок-и-ключ модели по жанрам**

| Жанр | Модель замков/ключей | Описание |
|------|---------------------|----------|
| RPG | Metroidvania + Dynamic | Навыки открывают новые области + репутация открывает квесты |
| Action | Linear + Dynamic | Последовательность уровней + условные доступы |
| Стратегия | Emergent | Технологическое дерево определяет фазы развития |
| Survival | Dynamic + Emergent | Условия (день/ночь, сезоны) + экономические фазы |
| Roguelike | Emergent | Прогрессия через мета-разблокировки между ранами |
| F2P Mobile | Linear | Зоны/эпизоды → явные блокировки → разблокировка за прогресс |
| MMO | Hybrid | Скриптовый сюжет + эмерджентная экономика + рейд-прогресс |

### 3.5.4 Этап 2: Определение этапов (tiers) прогрессии

**Цель**: Разбить общую прогрессию на качественно различные этапы, каждый из которых имеет свою механическую доминанту, масштаб вызовов и тип баланса. Используется модель 4 этапов D&D (Кн. 16), обобщённая на произвольные жанры.

**Алгоритм**:

```
ВХОД: ProgressionMacroModel, CoreLoopProfile

// ===== ШАГ 2.1: Определение числа этапов =====
// Минимум 2, максимум 5, оптимально 3-4
num_tiers = MIN(MAX(ROUND(L / 5), 2), 5)

// ===== ШАГ 2.2: Распределение уровней по этапам =====
// Неравномерное: первые этапы короче (быстрый прогресс), последние длиннее
tier_distributions = {
    2: [0.3, 0.7],              // 30% / 70%
    3: [0.2, 0.3, 0.5],         // 20% / 30% / 50%
    4: [0.15, 0.20, 0.25, 0.40], // 15% / 20% / 25% / 40%
    5: [0.10, 0.15, 0.20, 0.25, 0.30]  // 10% / 15% / 20% / 25% / 30%
}

level_bounds = DISTRIBUTE_LEVELS(L, tier_distributions[num_tiers])

// ===== ШАГ 2.3: Характеристика каждого этапа =====
tiers = []
FOR i = 0 TO num_tiers - 1:
    tier = {
        index: i + 1,
        level_range: [level_bounds[i], level_bounds[i + 1]],
        level_count: level_bounds[i + 1] - level_bounds[i],
        
        // Масштаб вызовов (модель D&D)
        scale: TIER_SCALES[i],  // Локальный → Региональный → Мировой → Мультивселенский
        
        // Доминантная механика (какая механика определяет этот этап)
        dominant_mechanic: DETERMINE_DOMINANT(coreLoop, mdaProfile, tier_index=i),
        
        // Тип баланса (Кн. 7, Кн. 16)
        balance_type: IF i < num_tiers / 2 THEN "transitive" ELSE "intransitive",
        // На ранних этапах: сила пропорциональна уровню (транзитивный)
        // На поздних: взаимные контры (интранзитивный)
        
        // Сложность (относительная)
        difficulty_curve: IF i == 0 THEN "gentle" ELSE IF i == num_tiers - 1 THEN "steep" ELSE "moderate",
        
        // Ресурсная динамика
        resource_state: DETERMINE_RESOURCE_STATE(i, coreLoop.structural_type),
        // "scarcity" | "growth" | "abundance" | "escalation"
        
        // Ключевой переход между этапами
        transition_trigger: DETERMINE_TRANSITION(i, genre, lock_key_model)
    }
    tiers.append(tier)

ВЫХОД: TierModel = {
    tiers: tiers,
    num_tiers: num_tiers,
    total_levels: L,
    // Карта переходов между этапами
    transition_map: BUILD_TRANSITION_MAP(tiers)
}
```

**Таблица: Ресурсная динамика по этапам (типология Селлерса)**

| Этап | Двигатель (Engine) | Экономика (Economy) | Экология (Ecology) |
|------|-------------------|--------------------|-------------------|
| 1 (Начальный) | Scarcity: мало ресурсов, стартовый капитал | Scarcity: базовые ресурсы, простые цепочки | Tension: баланс на грани выживания |
| 2 (Рост) | Growth: инвестиции в двигатель, нарастающий поток | Unfolding: новые ресурсы, новые цепочки конверсии | Expansion: рост численности, территории |
| 3 (Зрелость) | Abundance: стабильный поток, оптимизация | Complexity: многовалютная система, сложные цепи | Metastability: динамическое равновесие |
| 4 (Эскалация) | Escalation: скорость/сложность нарастают | Endgame: редкие ресурсы, престижные цели | Competition: борьба за ограниченные ресурсы |

### 3.5.5 Этап 3: Построение кривых прогрессии

**Цель**: Для каждого ядерного ресурса (XP, мощность, стоимость, доступность) определить математическую кривую роста, которая создаёт нужный pacing. Используется библиотека из 7 кривых Шрайбера (Кн. 7) + логистическая (S-кривая) Селлерса (Кн. 13) + формулы роста Газэуэя (Кн. 9).

**Алгоритм**:

```
ВХОД: ProgressionMacroModel, TierModel, CoreLoopProfile

// ===== ШАГ 3.1: Идентификация кривых прогрессии =====
// Каждая игра имеет несколько кривых, по одной на каждый ядерный ресурс
core_resources = EXTRACT_CORE_RESOURCES(coreLoop, mdaProfile)
// Примеры: XP (накопление), Уровень (пороги), Мощность (сила), Стоимость (затраты)

curves = {}

// ===== КРИВАЯ 1: XP → Уровень (кривая опыта) =====
// Определяет, сколько XP нужно для следующего уровня
// Для большинства жанров: экспоненциальная или треугольная
xp_curve_type = DETERMINE_XP_CURVE(genre, progression_type)
// "exponential" | "triangular" | "linear" | "custom"

IF xp_curve_type == "exponential":
    // y = C × b^x — классическая XP-кривая
    xp_params = {
        formula: "y = C × b^x",
        base: SELECT_BASE(genre),        // 1.1-1.5 (RPG), 1.5-2.0 (F2P)
        coefficient: CALC_COEFFICIENT(L, T),
        xp_for_level_n: (n) => ROUND(C * POW(base, n))
    }
ELIF xp_curve_type == "triangular":
    // y = (x² - x) / 2 — возрастающая отдача
    xp_params = {
        formula: "y = (x² - x) / 2",
        xp_for_level_n: (n) => ROUND((n * n - n) / 2)
    }

curves.xp_to_level = xp_params

// ===== КРИВАЯ 2: Уровень → Мощность (кривая силы) =====
// Определяет, насколько сильным становится игрок с уровнем
// Для PvP: линейная (чтобы новые игроки могли конкурировать)
// Для PvE: полиномиальная (ощущение роста)
power_curve_type = DETERMINE_POWER_CURVE(genre, monetization_model)

IF power_curve_type == "linear":
    power_params = {
        formula: "Power(n) = Base + Rate × n",
        rate: CALC_POWER_RATE(L, final_power, base_power)
    }
ELIF power_curve_type == "polynomial":
    power_params = {
        formula: "Power(n) = Base + Rate × n^exponent",
        exponent: SELECT_EXPONENT(genre),  // 1.2-1.5 (RPG), 1.5-2.0 (F2P)
        rate: CALC_POWER_RATE(L, final_power, base_power)
    }
ELIF power_curve_type == "logistic":
    // S-кривая: Power(n) = MaxPower / (1 + e^(-k(n - n0)))
    power_params = {
        formula: "Power(n) = Max / (1 + e^(-k × (n - n0)))",
        max_power: CALC_MAX_POWER(genre, L),
        k: CALC_LOGISTIC_K(L),
        n0: CALC_LOGISTIC_MIDPOINT(L)
    }

curves.level_to_power = power_params

// ===== КРИВАЯ 3: Уровень → Стоимость (кривая затрат) =====
// Определяет, сколько стоят предметы/улучшения на каждом уровне
// Связана с кривой XP: стоимость должна быть пропорциональна доходу
cost_params = {
    formula: "Cost(n) = Power(n) × Multiplier",
    multiplier: CALC_COST_MULTIPLIER(genre, monetization_model),
    // Для F2P: multiplier > 1 (доход отстает от затрат → давление донат)
    // Для PvP: multiplier ≈ 1 (баланс доходов и расходов)
    // Для PvE: multiplier < 1 (профицит → ощущение роста)
}

curves.level_to_cost = cost_params

// ===== КРИВАЯ 4: Сложность (кривая вызова) =====
// Формула воспринимаемой сложности Шрайбера:
// Воспринимаемая_сложность = (Cv + Cs) - (Pv + Ps)
difficulty_params = {
    formula: "Perceived_Diff = (Virtual_Challenge + Strategic_Challenge) - (Player_Power + Player_Skill)",
    target_perceived_diff: 0.1-0.3,  // Слегка положительный → ощущение вызова
    // Зоны:
    // > 0.5: Frustration (слишком сложно)
    // 0.1-0.5: Flow (оптимально)
    // -0.1-0.1: Balance (нейтрально)
    // < -0.1: Boredom (слишком легко)
    
    virtual_challenge_curve: "escalating",   // Сила врагов нарастает
    strategic_challenge_curve: "step",        // Новые стратегии нужны на границах tiers
    player_power_curve: curves.level_to_power,
    player_skill_curve: ESTIMATE_SKILL_CURVE(genre)  // Логистическая: обучение → рост → плато
}

curves.difficulty = difficulty_params

// ===== ШАГ 3.2: Проверка согласованности кривых =====
// Ключевое правило: доход игрока (XP → уровень → мощность) должен соответствовать затратам
// Если доход >> затрат → профицит → скука
// Если затраты >> доход → дефицит → фрустрация
FOR n = 1 TO L:
    income_at_n = ESTIMATE_INCOME(curves.xp_to_level, curves.level_to_power, n)
    cost_at_n = curves.level_to_cost.formula(n)
    perceived_diff = curves.difficulty.formula(n)
    
    IF income_at_n < cost_at_n * 0.7:
        ADD_WARNING(f"Уровень {n}: затраты значительно превышают доход — риск фрустрации")
    ELIF income_at_n > cost_at_n * 1.5:
        ADD_WARNING(f"Уровень {n}: доход значительно превышает затраты — риск скуки")

ВЫХОД: ProgressionCurves = {
    curves: curves,
    xp_curve_type: xp_curve_type,
    power_curve_type: power_curve_type,
    core_resources: core_resources,
    consistency_check: {
        warnings: warnings,
        imbalance_levels: [levels with warnings]
    }
}
```

**Таблица: Рекомендуемые кривые по жанрам**

| Жанр | XP-кривая | Мощность | Стоимость | Pacing |
|------|----------|----------|----------|--------|
| RPG | Треугольная | Полиномиальная | Пропорциональная мощности | S-кривая |
| Action | Линейная | Линейная | Линейная | Равномерный |
| F2P Mobile | Экспоненциальная | Полиномиальная | Агрессивная (>мощности) | Быстрый старт → замедление |
| Стратегия | Линейная | Полиномиальная | Линейная | Ускоряющийся финал |
| Survival | Линейная | Логистическая | Пропорциональная | S-кривая |
| Roguelike | Треугольная | Линейная | Минимальная | Прерывистая |
| MMO | Экспоненциальная | Полиномиальная | Пропорциональная + стоки | Замедляющаяся |

### 3.5.6 Этап 4: Генерация контент-плана

**Цель**: На основе макро-модели и кривых прогрессии создать конкретный план контента: какие типы врагов, предметов, способностей и событий нужны на каждом уровне. Это «спецификация требований к контенту», которую дизайнер заполняет реальным контентом.

**Алгоритм**:

```
ВХОД: ProgressionMacroModel, TierModel, ProgressionCurves

// ===== ШАГ 4.1: Контент-требования по уровням =====
content_plan = []

FOR tier IN TierModel.tiers:
    tier_plan = {
        tier_index: tier.index,
        level_range: tier.level_range,
        duration_hours: ESTIMATE_TIER_DURATION(tier, macro_model),
        
        // Враги/препятствия
        enemies: {
            count: CEIL(macro_model.enemy_configs * tier.level_count / macro_model.levels),
            // Минимум 3 конфигурации на стадию (Шрайбер)
            min_configs: 3 * CEIL(tier.level_count / 5),
            power_range: CALC_ENEMY_POWER_RANGE(tier, curves),
            new_mechanics: SUGGEST_NEW_ENEMY_MECHANICS(tier, mdaProfile)
        },
        
        // Награды/предметы
        rewards: {
            items_per_level: ESTIMATE_ITEMS_PER_LEVEL(genre, monetization_model),
            power_range: CALC_ITEM_POWER_RANGE(tier, curves),
            rarity_distribution: CALC_RARITY_DISTRIBUTION(tier),
            new_unlocks: SUGGEST_UNLOCKS(tier, coreLoop, mdaProfile)
        },
        
        // Способности/навыки
        abilities: {
            new_per_level: IF tier.index <= 2 THEN 1-2 ELSE 0-1,
            total_at_tier_end: CALC_ABILITY_COUNT(tier),
            synergy_requirements: CHECK_ABILITY_SYNERGIES(mdaProfile)
        },
        
        // Ключевые события
        milestones: PLAN_MILESTONES(tier, lock_key_model),
        // Примеры: "Босс зоны", "Открытие новой области", "Новый тип врага",
        //          "Новая механика крафта", "Смена фазы экономики"
        
        // Pacing: чередование напряжения и расслабления
        pacing: GENERATE_PACING_PATTERN(tier, constraints),
        // Паттерн: "нарастание → пик → награда → передышка → нарастание → ..."
    }
    content_plan.append(tier_plan)

// ===== ШАГ 4.2: Генерация графика разблокировок =====
// Что становится доступным на каждом уровне (дерево разблокировок)
unlock_tree = BUILD_UNLOCK_TREE(
    levels=L,
    mechanics=mdaProfile.mechanicSet,
    lock_key_model=lock_key_model,
    constraints=[
        "Новые механики вводятся постепенно (1-2 за уровень)",
        "Каждая разблокировка открывает новые стратегии (не просто «больше урона»)",
        "Разблокировки распределены равномерно, без «пустых» уровней",
        "Ключевые механики (из Core Loop) доступны с уровня 1"
    ]
)

// ===== ШАГ 4.3: Формула воспринимаемой сложности по уровням =====
// Шрайбер: Воспринимаемая_сложность = (Cv + Cs) - (Pv + Ps)
// Генерируем таблицу: уровень → целевая воспринимаемая сложность
perceived_difficulty_table = []
FOR n = 1 TO L:
    // Внутри уровня: плавный рост
    // На границах tiers: скачок (новые типы вызовов)
    tier_for_n = FIND_TIER(n, TierModel)
    is_tier_boundary = (n IN tier_boundaries)
    
    IF is_tier_boundary:
        target_perceived_diff = 0.4  // Скачок сложности на границе этапа
    ELIF n <= L * 0.1:
        target_perceived_diff = 0.0  // Обучение: не слишком сложно
    ELSE:
        target_perceived_diff = 0.2  // Зона потока
    
    perceived_difficulty_table.append({
        level: n,
        target_perceived_difficulty: target_perceived_diff,
        recommended_enemy_power: CALC_ENEMY_POWER(curves, n, target_perceived_diff),
        recommended_new_mechanics: is_tier_boundary
    })

ВЫХОД: ContentPlan = {
    tier_plans: content_plan,
    unlock_tree: unlock_tree,
    perceived_difficulty_table: perceived_difficulty_table,
    total_content_requirements: {
        enemy_configs: SUM(tier_plan.enemies.min_configs),
        items: SUM(tier_plan.rewards.items_per_level) * L,
        abilities: SUM(tier_plan.abilities.total_at_tier_end),
        milestones: SUM(LEN(tier_plan.milestones))
    }
}
```

### 3.5.7 Этап 5: Связь прогрессии с экономикой

**Цель**: Интегрировать систему прогрессии с экономической моделью игры. Прогрессия — это не независимая система: она является **результатом** экономических потоков (XP → уровни → навыки → больше XP) и одновременно **драйвером** этих потоков (новые уровни → доступ к новым ресурсам → новые цепочки конверсии). Этот этап обеспечивает двунаправленную связь.

**Алгоритм**:

```
ВХОД: ProgressionCurves, ContentPlan, CoreLoopProfile, MDAProfile

// ===== ШАГ 5.1: Определение двигателей прогрессии =====
// Каждый этап прогрессии приводится в движение экономическим двигателем
progression_engines = []

// Двигатель 1: XP-цикл (основной для RPG/Action)
xp_engine = {
    type: "Dynamic Engine",  // Кн. 4, Адамс/Дорманс
    source: "Действия Core Loop → XP",
    pool: "XP Pool",
    converter: "XP → Уровень (по XP-кривой)",
    output: "Новые способности → больше возможностей → больше XP",
    feedback_type: "reinforcing",  // Положительная петля: больше XP → больше уровней → больше XP
    braking: "XP-кривая (экспоненциальная/треугольная) замедляет прокачку"
}
progression_engines.append(xp_engine)

// Двигатель 2: Ресурсный цикл (основной для стратегий/survival)
resource_engine = {
    type: "Converter Engine",
    source: "Добыча ресурсов → Конвертация в улучшения",
    pool: "Ресурсные пулы (золото, материалы, технологии)",
    converter: "Ресурсы → Постройки/Апгрейды → Больше добычи",
    output: "Расширенные возможности → доступ к новым ресурсам",
    feedback_type: "reinforcing + balancing",
    braking: "Убывающая отдача апгрейдов + статическое трение (расходы)"
}
progression_engines.append(resource_engine)

// Двигатель 3: Нарративный цикл (основной для Adventure/RPG)
narrative_engine = {
    type: "Escalating Challenge",
    source: "Квест → Награда (XP + предметы + доступ к новым квестам)",
    escalation: "Нарастание сложности и масштаба квестов",
    lock_key: "Новые способности/предметы открывают доступ к новым квестам",
    feedback_type: "scripted"  // Скриптованная прогрессия (замок-и-ключ)
}
progression_engines.append(narrative_engine)

// ===== ШАГ 5.2: Маппинг этапов прогрессии на фазы экономики =====
// Каждому tier соответствует определённая фаза экономического развития
economy_phases = []
FOR tier IN TierModel.tiers:
    phase = MAP_TIER_TO_ECONOMY_PHASE(tier, coreLoop.structural_type)
    // tier 1 → "start-up": дефицит, ограниченные ресурсы, базовые цепочки
    // tier 2 → "growth": инвестиции, расширение, новые цепочки конверсии
    // tier 3 → "maturity": стабильный поток, оптимизация, сложные цепи
    // tier 4 → "endgame": эскалация, престиж, редкие ресурсы
    
    economy_phases.append({
        tier: tier.index,
        phase: phase,
        resource_state: tier.resource_state,
        dominant_engine: SELECT_DOMINANT_ENGINE(tier, coreLoop),
        faucet_drain_balance: CALC_FAUCET_DRAIN_RATIO(tier, phase),
        // start-up: faucet ≈ drain (равновесие)
        // growth: faucet > drain (профицит → ощущение роста)
        // maturity: faucet ≈ drain (равновесие на высоком уровне)
        // endgame: faucet < drain (дефицит → эскалация давления)
    })

// ===== ШАГ 5.3: Цепочки конверсии прогрессии =====
// Зубек (Кн. 6): механики образуют цепочки «производитель→потребитель»
// Строим граф конверсий для каждого tier
conversion_chains = {}
FOR tier IN TierModel.tiers:
    chain = BUILD_CONVERSION_CHAIN(
        tier=tier,
        mechanics=mdaProfile.mechanicSet,
        resources=core_resources,
        economy_phase=economy_phases[tier.index - 1]
    )
    
    // Проверка прибыльности циклов (Зубек)
    chain_profitability = CALC_CHAIN_PROFITABILITY(chain)
    IF chain_profitability > 1.5:
        ADD_WARNING(f"Tier {tier.index}: цикл конверсии слишком прибыльный — риск гринда")
        ADD_SUGGESTION("Добавить трение: расход на поддержку, убывающая отдача, кулдауны")
    ELIF chain_profitability < 0.7:
        ADD_WARNING(f"Tier {tier.index}: цикл конверсии неприбыльный — риск разочарования")
        ADD_SUGGESTION("Добавить источник: побочные квесты, бонусные награды, пассивный доход")
    
    conversion_chains[tier.index] = chain

ВЫХОД: ProgressionEconomyLink = {
    progression_engines: progression_engines,
    economy_phases: economy_phases,
    conversion_chains: conversion_chains,
    faucet_drain_balance_by_tier: economy_phases.map(p => p.faucet_drain_balance)
}
```

### 3.5.8 Этап 6: Валидация прогрессии

**Цель**: Проверить спроектированную систему прогрессии на типичные патологии и соответствие заявленной эстетике. Валидация использует формальные критерии из Шрайбера (Кн. 7), Селлерса (Кн. 13) и Адамса/Дорманса (Кн. 4).

**Алгоритм**:

```
ВХОД: ProgressionMacroModel, TierModel, ProgressionCurves, ContentPlan, ProgressionEconomyLink

issues = []
suggestions = []

// ===== ПРОВЕРКА 1: Гринд (монотонные повторения) =====
// Шрайбер: если переход между уровнями требует > maxGrindTolerance повторений
// одного и того же цикла → гринд
FOR n = 1 TO L:
    xp_for_n = curves.xp_to_level.xp_for_level_n(n)
    xp_per_cycle = ESTIMATE_XP_PER_CYCLE(coreLoop, n)
    cycles_needed = CEIL(xp_for_n / xp_per_cycle)
    
    IF cycles_needed > constraints.maxGrindTolerance:
        issues.append({
            level: n,
            type: "grind",
            severity: cycles_needed > 10 ? "critical" : "warning",
            description: f"Уровень {n}: нужно {cycles_needed} циклов для перехода (максимум {constraints.maxGrindTolerance})",
            correction: "Снизить XP-требование или увеличить XP-награду за цикл"
        })

// ===== ПРОВЕРКА 2: Стены (резкие скачки сложности) =====
// Если воспринимаемая сложность на уровне n значительно выше, чем на n-1
FOR n = 2 TO L:
    diff_n = perceived_difficulty_table[n].target_perceived_difficulty
    diff_n_1 = perceived_difficulty_table[n - 1].target_perceived_difficulty
    
    IF diff_n - diff_n_1 > 0.3:
        issues.append({
            level: n,
            type: "wall",
            severity: "warning",
            description: f"Уровень {n}: резкий скачок сложности (+{diff_n - diff_n_1:.2f})",
            correction: "Добавить промежуточные уровни или смягчить переход"
        })

// ===== ПРОВЕРКА 3: Пустые уровни (нет новых механик/контента) =====
FOR n = 1 TO L:
    unlocks_at_n = unlock_tree.filter(u => u.level == n)
    IF unlocks_at_n.length == 0 AND n > 1:
        issues.append({
            level: n,
            type: "empty_level",
            severity: "info",
            description: f"Уровень {n}: нет новых разблокировок",
            correction: "Добавить хотя бы косметическую награду или мини-достижение"
        })

// ===== ПРОВЕРКА 4: Runaway прогрессия =====
// Селлерс: усиливающие петли без балансирующих → exponential runaway
IF coreLoop.structural_type == "engine" AND NOT coreLoop.has_braking:
    issues.append({
        type: "runaway_progression",
        severity: "critical",
        description: "Core Loop — чистый двигатель без торможения. Прогрессия будет runaway",
        correction: "Добавить Dynamic Friction (убывающая отдача), Stopping Mechanism (потолки), или Attrition (нарастающие расходы)"
    })

// ===== ПРОВЕРКА 5: Разрыв билдов =====
// Шрайбер: Δ(t) = Power_optimal(t) - Power_competitive(t) — монотонно возрастающая
build_gap = ESTIMATE_BUILD_GAP(curves, L)
IF build_gap.final_gap > build_gap.initial_gap * 3:
    issues.append({
        type: "build_gap_escalation",
        severity: "warning",
        description: f"Разрыв билдов растёт: от {build_gap.initial_gap:.1f}x до {build_gap.final_gap:.1f}x",
        correction: "Основная мощность — от базовых параметров, навыки — небольшие бонусы"
    })

// ===== ПРОВЕРКА 6: Эстетическое соответствие =====
// Прогрессия должна поддерживать целевую эстетику, а не противоречить ей
aesthetic_check = CHECK_PROGRESSION_AESTHETICS(
    curves=curves,
    aesthetics=mdaProfile.aestheticProfile
)
// Примеры:
// "Вызов" → кривая сложности должна создавать зону потока
// "Фантазия" → прогрессия должна ощущаться как трансформация
// "Подчинение" → кривые должны быть предсказуемыми
// "Открытие" → разблокировки должны открывать новые пути, а не просто числа
FOR EACH mismatch IN aesthetic_check.mismatches:
    issues.append(mismatch)

ВЫХОД: ProgressionValidation = {
    issues: issues,
    suggestions: suggestions,
    critical_count: issues.filter(i => i.severity == "critical").length,
    warning_count: issues.filter(i => i.severity == "warning").length,
    info_count: issues.filter(i => i.severity == "info").length,
    overall_score: CALC_PROGRESSION_SCORE(issues, L)
}
```

### 3.5.9 Этап 7: Итоговая сборка ProgressionProfile

**Цель**: Объединить результаты всех 6 этапов в единый ProgressionProfile, который становится частью Project State и передаётся в алгоритм 3.6 (Экономическое моделирование) и далее в алгоритмы 3.7-3.10.

```typescript
interface ProgressionProfile {
    // Макро-параметры (из этапа 1)
    macroModel: ProgressionMacroModel;
    
    // Этапы прогрессии (из этапа 2)
    tierModel: TierModel;
    
    // Кривые прогрессии (из этапа 3)
    curves: ProgressionCurves;
    
    // Контент-план (из этапа 4)
    contentPlan: ContentPlan;
    
    // Связь с экономикой (из этапа 5)
    economyLink: ProgressionEconomyLink;
    
    // Валидация (из этапа 6)
    validation: ProgressionValidation;
    
    // Мета-данные
    totalLevels: number;
    totalDuration: number;                  // Часы
    progressionType: ProgressionType;
    emergenceRatio: number;                 // 0-1
    lockKeyModel: string;
    
    // Связь с другими алгоритмами
    economyInput: EconomyInput;             // Данные для алгоритма 3.6
    gddInput: ProgressionGDDInput;          // Данные для алгоритма 3.7
    
    // Сводные формулы для разработчика
    summary: {
        xpFormula: string;                  // Например: "y = 100 × 1.15^n"
        powerFormula: string;               // Например: "Power = 10 + 5 × n^1.3"
        costFormula: string;                // Например: "Cost = Power × 1.2"
        difficultyFormula: string;          // Формула воспринимаемой сложности
        contentRequirements: string;        // Человекочитаемое резюме
    }
}
```

### 3.5.10 AI-промпт-спецификации для алгоритма 3.5

#### Промпт PLAN_TIERS

```
SYSTEM: Ты — эксперт по системам прогрессии в играх. Разбей систему прогрессии 
на качественно различные этапы (tiers), аналогично модели 4 этапов D&D 
(Локальные → Региональные → Мировые → Мультивселенские угрозы). Каждый этап 
должен: (1) иметь свою механическую доминанту, (2) качественно отличаться от 
предыдущего, (3) использовать разный тип баланса. Учитывай жанр: {genre} 
и структурный тип Core Loop: {structural_type}.

USER: Жанр: {genre}. Число уровней: {L}. Core Loop тип: {loop_type}. 
Механики: {mechanic_list}. Эстетика: {aesthetic_list}.

OUTPUT FORMAT: JSON [{
  "tier_index": number,
  "level_range": [min, max],
  "scale": "локальный | региональный | мировой | мультивселенский",
  "dominant_mechanic": "...",
  "balance_type": "transitive | intransitive",
  "key_unlock": "...",
  "pacing_description": "..."
}]
```

#### Промпт SUGGEST_UNLOCKS

```
SYSTEM: Ты — эксперт по дизайну разблокировок в играх. Для каждого этапа 
прогрессии предложи конкретные разблокировки (способности, предметы, области, 
механики), которые: (1) открывают новые стратегии, а не просто «больше урона», 
(2) соответствуют целевой эстетике, (3) связаны с Core Loop. Разблокировки 
должны следовать принципу: каждая новая механика взаимодействует с минимум 
2 существующими (синергия). Учитывай жанр: {genre}.

USER: Этап: {tier}. Механики: {mechanics}. Core Loop: {core_loop}. 
Эстетика: {aesthetics}. Уровни: {level_range}.

OUTPUT FORMAT: JSON [{
  "level": number,
  "unlock_name": "...",
  "unlock_type": "ability | item | area | mechanic | social",
  "description": "...",
  "synergies_with": ["..."],
  "strategic_impact": "..."
}]
```

#### Промпт CHECK_PROGRESSION_AESTHETICS

```
SYSTEM: Ты — эксперт по MDA-фреймворку. Проверь, поддерживает ли 
спроектированная система прогрессии целевую эстетику игры. Для каждой 
эстетики определи: (1) какие элементы прогрессии её поддерживают, 
(2) какие — противоречат, (3) что нужно добавить. Учитывай:
- "Вызов" требует зоны потока (баланс навык/сложность)
- "Фантазия" требует ощущения трансформации
- "Нарратив" требует драматической арки в прогрессии
- "Открытие" требует новых путей, а не только чисел
- "Подчинение" требует предсказуемых кривых
- "Выражение" требует ветвящихся деревьев навыков

USER: Эстетика: {aesthetics}. Кривые: {curves_summary}. 
Разблокировки: {unlock_summary}. Контент-план: {content_summary}.

OUTPUT FORMAT: JSON [{
  "aesthetic": "...",
  "supporting_elements": ["..."],
  "contradicting_elements": ["..."],
  "suggestions": ["..."],
  "score": 0.0-1.0
}]
```

---

## 3.6 Алгоритм экономического моделирования

### 3.6.1 Обзор алгоритма

Алгоритм экономического моделирования реализует **Блок 5** (Экономика и прогрессия) архитектуры Gidede и является наиболее формализованным из всех алгоритмов системы. В отличие от алгоритма 3.5, который определяет «что растёт и как», алгоритм 3.6 отвечает на вопрос «через какие ресурсные потоки происходит рост» — он строит полную модель внутренней экономики игры на основе формального языка Machinations (Кн. 4, Адамс/Дорманс), типологии Селлерса (Кн. 13) и цепочек конверсии Зубека (Кн. 6).

Ключевой принцип: **игровая экономика — это формализуемая система, которую можно спроектировать, визуализировать, симулировать и диагностировать алгоритмически**. Адамс/Дорманс создали для этого визуальный язык Machinations, который описывает экономику через конечный набор элементов (Source, Drain, Pool, Converter, Trader, Gate, Register, Delay, Queue, Activator, Trigger), соединённых связями ресурсов и состояний. Селлерс (Кн. 13) углубил этот подход типологией Engines/Economies/Ecologies, которая связывает структуру экономической системы с типом порождаемого геймплея. Зубек (Кн. 6) добавил операциональный аппарат цепочек и циклов конверсии, позволяющий анализировать прибыльность ресурсных потоков.

Алгоритм состоит из 8 этапов. Этапы 1-2 — аналитические (определение ресурсов и типа системы). Этапы 3-4 — конструирующие (построение Machinations-модели и графа конверсий). Этап 5 — диагностический (выявление патологий). Этап 6 — корректирующий (балансировка). Этапы 7-8 — симуляционный и валидационный (проверка через Monte Carlo и итоговая сборка).

### 3.6.2 Входные данные

```typescript
interface EconomyInput {
  // Обязательные поля (из предшествующих алгоритмов)
  concept: OnePager;                       // Из алгоритма 3.1
  coreLoop: CoreLoopProfile;               // Из алгоритма 3.2
  mdaProfile: MDAProfile;                  // Из алгоритма 3.3
  progressionProfile: ProgressionProfile;  // Из алгоритма 3.5
  
  // Экономические параметры (опционально — AI заполняет)
  monetizationType?: EconomyMonetizationType;  // Тип экономики по Шрайберу
  openness?: 'open' | 'closed' | 'mixed';     // Открытая/закрытая
  customResources?: ResourceDefinition[];      // Пользовательские ресурсы
  
  // Ограничения
  constraints?: EconomyConstraints;
}

type EconomyMonetizationType = 
  | 'fixed'              // Фиксированные цены (Кн. 7)
  | 'player_driven'      // Рынок игроков (аукцион)
  | 'f2p_dual_currency'  // F2P: софт + хард валюта
  | 'prestige'           // Косметика за деньги
  | 'mixed';             // Смешанная (большинство AAA)

interface ResourceDefinition {
  name: string;
  type: 'core' | 'subsidiary' | 'currency' | 'consumable' | 'meta';
  class: 'time' | 'currency' | 'game_object' | 'hp' | 'experience';
  bounds: { min: number; max: number };
  initialValue: number;
}

interface EconomyConstraints {
  maxResources?: number;                   // Максимум типов ресурсов (по умолчанию 12)
  maxConversionChains?: number;            // Максимум цепочек конверсии (по умолчанию 20)
  allowPlayerTrade?: boolean;              // Разрешена ли торговля между игроками
  targetInflationRate?: number;            // Целевая инфляция (0 = стационарная, >0 = рост)
}
```

### 3.6.3 Этап 1: Идентификация ресурсов

**Цель**: Определить полный перечень ресурсов в игре, классифицировать их по роли (ядро/подсобные), по классу (Шрайбер) и по свойствам. Ресурсы — это «существительные» игровой экономики; от их правильной идентификации зависит качество всей модели.

**Алгоритм**:

```
ВХОД: EconomyInput

// ===== ШАГ 1.1: Определение ядерных ресурсов =====
// Селлерс (Кн. 13): ядерные ресурсы — главные «существительные» игры,
// напрямую связанные с базовыми игровыми циклами. Обычно 2-4 ресурса.
core_resources = []

// Извлечение из Core Loop
FOR EACH step IN coreLoop.steps:
    consumed = EXTRACT_CONSUMED_RESOURCES(step)
    produced = EXTRACT_PRODUCED_RESOURCES(step)
    core_resources = MERGE(core_resources, consumed, produced)

// AI-обогащение: какие ещё ресурсы типичны для данного жанра?
genre_core_resources = GENRE_CORE_RESOURCE_MAP[genre]
core_resources = MERGE(core_resources, genre_core_resources)

// Фильтрация: оставляем только 2-4 самых важных
core_resources = PRIORITIZE_AND_SELECT(core_resources, count=3,
    CRITERIA=[
        "Напрямую участвует в Core Loop",
        "Имеет и источник (faucet), и сток (drain)",
        "Является объектом управления игрока"
    ]
)

// ===== ШАГ 1.2: Определение подсобных ресурсов =====
// Подсобные ресурсы поддерживают ядерные, создают глубину
subsidiary_resources = []

// Извлечение из механик
FOR EACH mechanic IN mdaProfile.mechanicSet.mechanics:
    mechanic_resources = EXTRACT_MECHANIC_RESOURCES(mechanic)
    subsidiary_resources = MERGE(subsidiary_resources, mechanic_resources)

// Удаление дубликатов с ядерными
subsidiary_resources = subsidiary_resources.filter(r => r NOT IN core_resources)

// AI-расширение
additional_subsidiary = AI_SUGGEST_SUBSIDIARY_RESOURCES(
    core_resources=core_resources,
    genre=genre,
    mechanics=mdaProfile.mechanicSet,
    constraints=[f"Максимум {constraints.maxResources - core_resources.length} подсобных ресурсов"]
)
subsidiary_resources = MERGE(subsidiary_resources, additional_subsidiary)

// ===== ШАГ 1.3: Классификация по Шрайберу =====
all_resources = core_resources + subsidiary_resources
classified_resources = []

FOR EACH resource IN all_resources:
    classified = {
        name: resource.name,
        role: resource IN core_resources ? "core" : "subsidiary",
        class: CLASSIFY_BY_SHREIBER(resource),  // time | currency | game_object | hp | experience
        bounds: resource.bounds ?? ESTIMATE_BOUNDS(resource, genre),
        initial_value: resource.initialValue ?? ESTIMATE_INITIAL(resource, genre),
        
        // Дополнительные свойства
        is_consumable: DETERMINE_CONSUMABILITY(resource),     // Тратится ли при использовании
        is_catalytic: DETERMINE_CATALYTICITY(resource),       // Не расходуется при обмене (валюта)
        is_anchor: DETERMINE_ANCHOR(resource, genre),         // Якорный ресурс (HP для боевых, деньги для tycoon)
        depreciates: DETERMINE_DEPRECIATION(resource, progressionProfile),  // Обесценивается ли с прогрессией
        transferable: DETERMINE_TRANSFERABILITY(resource, constraints)  // Можно ли передать другому игроку
    }
    classified_resources.append(classified)

ВЫХОД: ResourceInventory = {
    core_resources: classified_resources.filter(r => r.role == "core"),
    subsidiary_resources: classified_resources.filter(r => r.role == "subsidiary"),
    all: classified_resources,
    count: classified_resources.length,
    anchor_resource: classified_resources.find(r => r.is_anchor),
    currencies: classified_resources.filter(r => r.is_catalytic)
}
```

**Таблица: Ядерные ресурсы по жанрам (типичные)**

| Жанр | Ядерный ресурс 1 | Ядерный ресурс 2 | Ядерный ресурс 3 | Якорный ресурс |
|------|-----------------|-----------------|-----------------|---------------|
| RPG | HP | XP | Золото | HP |
| Стратегия | Ресурсы (минералы) | Территория | Технологии | Территория |
| Survival | Голод/Жажда | Здоровье | Материалы | Голод |
| FPS | Здоровье | Боеприпасы | Позиция | Здоровье |
| MMO | Золото | XP | Снаряжение | Золото |
| F2P Mobile | Энергия | Софтвалюта | Хардвалюта | Энергия |
| Tycoon | Деньги | Репутация | Время | Деньги |
| Roguelike | HP | Золото (за ран) | Мета-ресурс | HP |

### 3.6.4 Этап 2: Классификация экономической системы

**Цель**: Определить тип экономической системы по двум осям: (1) тип петель (усиливающие/балансирующие/смешанные) и (2) тип ресурсных взаимодействий (один ресурс/конвертация/обмен). Это классификация Селлерса (Кн. 13), которая определяет, как экономика будет вести себя в долгосрочной перспективе.

**Алгоритм**:

```
ВХОД: ResourceInventory, CoreLoopProfile

// ===== ШАГ 2.1: Определение типа петель =====
loop_types = []

// Анализируем связи между ресурсами в Core Loop
FOR EACH pair IN COMBINATIONS(ResourceInventory.core_resources, 2):
    relationship = ANALYZE_RESOURCE_RELATIONSHIP(pair.a, pair.b, coreLoop)
    // "reinforcing": A ↑ → B ↑ (усиливающая)
    // "balancing": A ↑ → B ↓ (балансирующая)
    // "neutral": нет прямой зависимости
    
    loop_types.append({
        resources: [pair.a, pair.b],
        type: relationship.type,
        strength: relationship.strength  // 0-1
    })

dominant_loop = MAJORITY(loop_types.map(lt => lt.type))

// ===== ШАГ 2.2: Определение типа взаимодействия =====
interaction_type = DETERMINE_INTERACTION_TYPE(ResourceInventory, coreLoop)
// "single_resource": все потоки вокруг одного ресурса (двигатель)
// "conversion": ресурсы конвертируются друг в друга (экономика)
// "exchange": ресурсы обмениваются с обратимостью (торговля)

// ===== ШАГ 2.3: Классификация по матрице Селлерса =====
//             | Один ресурс  | Конвертация  | Обмен
// Усиливающие | Engine       | Economy      | Trade Economy
// Балансирующие| (редко)     | Ecology      | Market
// Смешанные   | Hybrid Eng.  | Hybrid Econ. | Hybrid Market

economic_type = CLASSIFY(dominant_loop, interaction_type)

// ===== ШАГ 2.4: Определение подтипа и рисков =====
sub_type_detail = {}
IF economic_type == "engine":
    has_braking = CHECK_BRAKING(ResourceInventory, coreLoop)
    sub_type_detail = {
        variant: has_braking ? "braked_engine" : "pure_engine",
        risks: has_braking 
            ? ["stall (если торможение слишком сильное)"]
            : ["runaway (критический риск — нет торможения)", "deadlock"],
        required_patterns: has_braking 
            ? [] 
            : ["Dynamic Friction", "Stopping Mechanism", "или Attrition"]
    }
ELIF economic_type == "economy":
    currencies = ResourceInventory.currencies
    sub_type_detail = {
        variant: currencies.length >= 2 ? "multi_currency" : "single_currency",
        has_braking: CHECK_BRAKING(ResourceInventory, coreLoop),
        risks: ["runaway (через конвертацию)", "инфляция", "арбитраж"],
        unfolding_potential: ASSESS_UNFOLDING(ResourceInventory)
    }
ELIF economic_type == "ecology":
    sub_type_detail = {
        variant: "metastable",
        risks: ["oscillation (колебания вместо равновесия)", "collapse (схлопывание экологии)"],
        stability_conditions: CHECK_STABILITY_CONDITIONS(ResourceInventory)
    }

// ===== ШАГ 2.5: Определение экономической открытости =====
openness = DETERMINE_OPENNESS(concept, monetizationType, constraints)

// ===== ШАГ 2.6: Определение типа ценообразования =====
pricing_type = DETERMINE_PRICING_TYPE(monetizationType, openness)

ВЫХОД: EconomicClassification = {
    type: economic_type,        // "engine" | "economy" | "ecology" | "hybrid_*"
    dominant_loop: dominant_loop,
    interaction_type: interaction_type,
    sub_type: sub_type_detail,
    openness: openness,          // "open" | "closed" | "mixed"
    pricing_type: pricing_type,  // "fixed" | "player_driven" | "f2p" | "mixed"
    risk_profile: sub_type_detail.risks
}
```

### 3.6.5 Этап 3: Построение Machinations-модели

**Цель**: Создать полную Machinations-модель внутренней экономики игры — ориентированный граф, узлы которого представляют элементы экономики (Source, Drain, Pool, Converter, Trader, Gate, Register, Delay, Queue), а рёбра — потоки ресурсов и связи состояний. Модель строится на основе идентифицированных ресурсов, их классификации и типа экономической системы.

**Алгоритм**:

```
ВХОД: ResourceInventory, EconomicClassification, CoreLoopProfile, ProgressionProfile

// ===== ШАГ 3.1: Создание пулов для каждого ресурса =====
nodes = []
FOR EACH resource IN ResourceInventory.all:
    pool_node = {
        id: "pool_" + resource.name,
        type: "Pool",
        resource: resource.name,
        initial_value: resource.initial_value,
        capacity: resource.bounds.max,
        is_core: resource.role == "core"
    }
    nodes.append(pool_node)

// ===== ШАГ 3.2: Создание источников (Sources) =====
// Определить, откуда каждый ресурс появляется в игру
sources = []
FOR EACH resource IN ResourceInventory.all:
    faucets = IDENTIFY_FAUCETS(resource, coreLoop, genre)
    FOR EACH faucet IN faucets:
        source_node = {
            id: "source_" + resource.name + "_" + faucet.name,
            type: "Source",
            resource: resource.name,
            rate: faucet.rate,              // Ресурсов за тик
            activation: faucet.activation,  // "automatic" | "interactive" | "conditional"
            trigger: faucet.trigger         // Условие активации (если conditional)
        }
        sources.append(source_node)
        
        // Связь: Source → Pool
        flow = {
            type: "resource_flow",
            from: source_node.id,
            to: "pool_" + resource.name,
            rate: faucet.rate,
            label: faucet.name
        }

// ===== ШАГ 3.3: Создание стоков (Drains) =====
drains = []
FOR EACH resource IN ResourceInventory.all:
    sinks = IDENTIFY_SINKS(resource, coreLoop, genre, progressionProfile)
    FOR EACH sink IN sinks:
        drain_node = {
            id: "drain_" + resource.name + "_" + sink.name,
            type: "Drain",
            resource: resource.name,
            rate: sink.rate,
            activation: sink.activation
        }
        drains.append(drain_node)
        
        // Связь: Pool → Drain
        flow = {
            type: "resource_flow",
            from: "pool_" + resource.name,
            to: drain_node.id,
            rate: sink.rate,
            label: sink.name
        }

// ===== ШАГ 3.4: Создание конвертеров (Converters) =====
// Определить, какие ресурсы превращаются в какие
converters = []
conversion_chains = progressionProfile.economyLink.conversion_chains

FOR EACH chain IN FLATTEN(conversion_chains.values()):
    converter_node = {
        id: "converter_" + chain.name,
        type: "Converter",
        inputs: chain.inputs,      // [{resource, amount}]
        outputs: chain.outputs,     // [{resource, amount}]
        efficiency: chain.efficiency,  // Выход / Вход
        activation: chain.activation
    }
    converters.append(converter_node)
    
    // Связи: Pools → Converter → Pools
    FOR EACH input IN chain.inputs:
        flow_in = { type: "resource_flow", from: "pool_" + input.resource, to: converter_node.id }
    FOR EACH output IN chain.outputs:
        flow_out = { type: "resource_flow", from: converter_node.id, to: "pool_" + output.resource }

// ===== ШАГ 3.5: Создание торговцев (Traders) =====
// Если есть торговля между игроками или фракциями
traders = []
IF constraints.allowPlayerTrade OR genre == "MMO":
    trade_pairs = IDENTIFY_TRADE_PAIRS(ResourceInventory, concept)
    FOR EACH pair IN trade_pairs:
        trader_node = {
            id: "trader_" + pair.name,
            type: "Trader",
            resource_a: pair.resource_a,
            resource_b: pair.resource_b,
            exchange_rate: pair.rate,
            bidirectional: pair.bidirectional ?? true
        }
        traders.append(trader_node)

// ===== ШАГ 3.6: Создание ворот (Gates) =====
// Условные ветвления в потоке ресурсов
gates = []
FOR EACH conditional IN IDENTIFY_CONDITIONALS(coreLoop, mdaProfile):
    gate_node = {
        id: "gate_" + conditional.name,
        type: "Gate",
        distribution: conditional.distribution,  // "probability" | "condition"
        probabilities: conditional.probabilities, // [0.3, 0.5, 0.2]
        conditions: conditional.conditions        // ["pool_gold > 100", "level >= 5"]
    }
    gates.append(gate_node)

// ===== ШАГ 3.7: Добавление задержек и очередей =====
delays = []
queues = []
FOR EACH timed_mechanic IN IDENTIFY_TIMED_MECHANICS(coreLoop, genre):
    IF timed_mechanic.type == "cooldown":
        delay_node = {
            id: "delay_" + timed_mechanic.name,
            type: "Delay",
            ticks: timed_mechanic.cooldown
        }
        delays.append(delay_node)
    ELIF timed_mechanic.type == "queue":
        queue_node = {
            id: "queue_" + timed_mechanic.name,
            type: "Queue",
            capacity: timed_mechanic.capacity,
            fifo: true
        }
        queues.append(queue_node)

// ===== ШАГ 3.8: Добавление связей состояний =====
// Пунктирные стрелки: влияние состояния одного узла на другой
state_connections = []

// (1) Петли обратной связи: количество ресурса влияет на скорость генерации
FOR EACH feedback IN IDENTIFY_FEEDBACK_LOOPS(coreLoop, ResourceInventory):
    state_conn = {
        type: "state_connection",
        from: "pool_" + feedback.source_resource,
        to: feedback.target_node_id,    // Source, Drain или Converter
        modifier: feedback.modifier,     // "+" (усиливающая) или "-" (балансирующая)
        formula: feedback.formula        // Например: "rate * (1 - pool_gold / max_gold)"
    }
    state_connections.append(state_conn)

// (2) Активаторы: условие включает/выключает узел
// (3) Триггеры: порог запускает действие
// (Обнаруживаются автоматически из Gates и Conditions)

// ===== ШАГ 3.9: Сборка графа =====
machinations_graph = {
    nodes: nodes + sources + drains + converters + traders + gates + delays + queues,
    resource_flows: ALL_RESOURCE_FLOWS,     // Сплошные стрелки
    state_connections: state_connections,     // Пунктирные стрелки
    feedback_loops: IDENTIFY_ALL_FEEDBACK_LOOPS(),
    
    // Мета-данные
    resource_count: ResourceInventory.count,
    node_count: nodes.length + sources.length + drains.length + converters.length + traders.length + gates.length,
    flow_count: ALL_RESOURCE_FLOWS.length,
    
    // Тип системы
    economic_type: EconomicClassification.type,
    structural_patterns: DETECT_PATTERNS(machinations_graph)
    // Автоматическое обнаружение паттернов Adams/Dormans:
    // Static Engine, Dynamic Engine, Converter Engine, Engine Building,
    // Static Friction, Dynamic Friction, Stopping Mechanism, Attrition,
    // Escalating Challenge, Escalating Complexity, Arms Race,
    // Play-Style Reinforcement, Multiple Feedback, Trade, Worker Placement, Slow Cycle
}

ВЫХОД: MachinationsModel = machinations_graph
```

### 3.6.6 Этап 4: Построение графа конверсий

**Цель**: Построить ориентированный граф конверсий ресурсов (Зубек, Кн. 6), который показывает, как ресурсы превращаются друг в друга через механики. Этот граф дополняет Machinations-модель, фокусируясь на прибыльности циклов и выявлении узких мест.

**Алгоритм**:

```
ВХОД: ResourceInventory, MachinationsModel, CoreLoopProfile

// ===== ШАГ 4.1: Построение графа =====
// Вершины = ресурсы, рёбра = конверсии (с курсом обмена)
conversion_graph = {
    vertices: ResourceInventory.all.map(r => r.name),
    edges: []
}

// Извлечение конверсий из Machinations-модели
FOR EACH converter IN machinations_graph.nodes.filter(n => n.type == "Converter"):
    FOR EACH input IN converter.inputs:
        FOR EACH output IN converter.outputs:
            edge = {
                from: input.resource,
                to: output.resource,
                rate: output.amount / input.amount,  // Курс конверсии
                mechanic: converter.id,
                is_reversible: CHECK_REVERSIBILITY(converter)
            }
            conversion_graph.edges.append(edge)

// ===== ШАГ 4.2: Поиск циклов конверсии =====
// Цикл = путь из ресурса в себя через цепочку конверсий
cycles = FIND_ALL_CYCLES(conversion_graph)

profitable_cycles = []
unprofitable_cycles = []
balanced_cycles = []

FOR EACH cycle IN cycles:
    // Прибыльность = произведение всех курсов конверсии в цикле
    profitability = PRODUCT(cycle.edges.map(e => e.rate))
    // profitability > 1: прибыльный (каждый проход увеличивает ресурс)
    // profitability < 1: неприбыльный (каждый проход уменьшает ресурс)
    // profitability == 1: сбалансированный
    
    cycle_analysis = {
        path: cycle.vertices,
        edges: cycle.edges,
        profitability: profitability,
        type: IF profitability > 1.1 THEN "profitable" 
              ELIF profitability < 0.9 THEN "unprofitable" 
              ELSE "balanced",
        risk: IF profitability > 1.1 THEN "grind" 
              ELIF profitability < 0.9 THEN "frustration" 
              ELSE "boredom",
        // Частота прохождения цикла (оценка из Core Loop)
        estimated_frequency: ESTIMATE_CYCLE_FREQUENCY(cycle, coreLoop),
        // Чистая прибыль за проход
        net_gain_per_cycle: CALC_NET_GAIN(cycle, ResourceInventory)
    }
    
    IF cycle_analysis.type == "profitable":
        profitable_cycles.append(cycle_analysis)
    ELIF cycle_analysis.type == "unprofitable":
        unprofitable_cycles.append(cycle_analysis)
    ELSE:
        balanced_cycles.append(cycle_analysis)

// ===== ШАГ 4.3: Выявление узких мест =====
// (1) Ресурсы с одним источником (single point of failure)
// (2) Ресурсы без стоков (накопление → стагнация)
// (3) Несвязанные компоненты (мёртвые ресурсы)

bottlenecks = []
FOR EACH resource IN ResourceInventory.all:
    sources_count = COUNT_SOURCES(resource, machinations_graph)
    drains_count = COUNT_DRAINS(resource, machinations_graph)
    
    IF sources_count == 0:
        bottlenecks.append({
            resource: resource.name,
            type: "no_source",
            severity: "critical",
            description: f"Ресурс '{resource.name}' не имеет источников — он не может быть получен"
        })
    ELIF sources_count == 1:
        bottlenecks.append({
            resource: resource.name,
            type: "single_source",
            severity: "warning",
            description: f"Ресурс '{resource.name}' имеет единственный источник — точка отказа"
        })
    
    IF drains_count == 0 AND NOT resource.is_catalytic:
        bottlenecks.append({
            resource: resource.name,
            type: "no_drain",
            severity: "warning",
            description: f"Ресурс '{resource.name}' не имеет стоков — будет накапливаться бесконечно"
        })

// (4) Мёртвые ресурсы: не связаны с остальной экономикой
dead_resources = FIND_DISCONNECTED_COMPONENTS(conversion_graph)
FOR EACH dead IN dead_resources:
    bottlenecks.append({
        resource: dead,
        type: "disconnected",
        severity: "warning",
        description: f"Ресурс '{dead}' не связан с остальной экономикой"
    })

ВЫХОД: ConversionGraph = {
    graph: conversion_graph,
    cycles: {
        profitable: profitable_cycles,
        unprofitable: unprofitable_cycles,
        balanced: balanced_cycles,
        total: cycles.length
    },
    bottlenecks: bottlenecks,
    profitability_summary: {
        avg_profitability: AVERAGE(cycles.map(c => c.profitability)),
        max_profitability: MAX(cycles.map(c => c.profitability)),
        min_profitability: MIN(cycles.map(c => c.profitability))
    }
}
```

### 3.6.7 Этап 5: Диагностика экономических патологий

**Цель**: Проверить экономическую модель на 6 типичных патологий: runaway, deadlock, stall, инфляция, стагнация, арбитраж. Каждая патология имеет формальные критерии обнаружения и набор рекомендаций по коррекции (Кн. 4, 7, 13).

**Алгоритм**:

```
ВХОД: MachinationsModel, ConversionGraph, ResourceInventory, EconomicClassification

diagnostics = []

// ===== ПАТОЛОГИЯ 1: Runaway (саморазгон) =====
// Критерий: усиливающая петля без балансирующей с высокой скоростью
FOR EACH loop IN machinations_graph.feedback_loops:
    IF loop.type == "reinforcing":
        // Профилирование петли по 8 характеристикам (Кн. 4)
        profile = PROFILE_FEEDBACK_LOOP(loop, machinations_graph)
        // Тип: положительная
        // Эффект: конструктивная (добавляет ресурсы)
        // Инвестиция: низкая?
        // Отдача: высокая?
        // Скорость: мгновенная?
        // Длительность: постоянная?
        // Косвенность: прямая?
        // Определённость: детерминированная?
        
        runaway_risk = CALC_RUNAWAY_RISK(profile)
        // Если: положительная + конструктивная + низкая инвестиция + высокая отдача + 
        //       мгновенная + постоянная + прямая + детерминированная → runaway_risk = 0.95
        
        balancing_loops = FIND_BALANCING_LOOPS(loop, machinations_graph)
        
        IF runaway_risk > 0.7 AND balancing_loops.length == 0:
            diagnostics.append({
                pathology: "runaway",
                severity: "critical",
                location: loop.id,
                description: f"Усиливающая петля без балансирующей: {loop.description}",
                profile: profile,
                runaway_risk: runaway_risk,
                corrections: [
                    "Dynamic Friction: сопротивление, масштабирующееся с уровнем ресурса",
                    "Stopping Mechanism: жёсткий потолок на максимум ресурса",
                    "Attrition: нарастающее потребление",
                    "Delay: задержка между инвестицией и отдачей",
                    "Probability: добавить случайность в отдачу"
                ],
                priority_corrections: SELECT_BEST_CORRECTIONS(runaway_risk, genre)
            })

// ===== ПАТОЛОГИЯ 2: Deadlock (взаимная блокировка) =====
// Критерий: цикл конверсии, где для получения ресурса A нужен ресурс B,
// а для получения B нужен A, и нет стартового капитала
FOR EACH cycle IN ConversionGraph.cycles.all:
    IF CYCLE_REQUIRES_ITSELF_TO_START(cycle):
        // Проверяем: есть ли альтернативный источник для запуска?
        starting_resources = CHECK_STARTING_RESOURCES(cycle, ResourceInventory)
        
        IF starting_resources.insufficient:
            diagnostics.append({
                pathology: "deadlock",
                severity: "critical",
                location: cycle.path,
                description: f"Взаимная блокировка: {cycle.description}",
                corrections: [
                    "Стартовый капитал: дать игроку начальное количество ресурса для запуска",
                    "Альтернативный путь: неоптимальный, но рабочий источник",
                    "Кредит: взять в долг с условием возврата",
                    "Таймер: через N ходов deadlock разрешается автоматически"
                ]
            })

// ===== ПАТОЛОГИЯ 3: Stall (остановка) =====
// Критерий: неприбыльный цикл + нет внешних источников для восстановления
FOR EACH cycle IN ConversionGraph.cycles.unprofitable:
    external_sources = FIND_EXTERNAL_SOURCES(cycle, machinations_graph)
    
    IF external_sources.length == 0:
        diagnostics.append({
            pathology: "stall",
            severity: "critical",
            location: cycle.path,
            description: f"Неприбыльный цикл без внешних источников: {cycle.description}",
            corrections: [
                "Минимальный гарантированный доход (базовая регенерация)",
                "Спасательный круг при критическом уровне",
                "Альтернативные источники (не зависящие от основного цикла)"
            ]
        })

// ===== ПАТОЛОГИЯ 4: Инфляция =====
// Критерий: суммарный faucet > суммарный drain для валюты
FOR EACH currency IN ResourceInventory.currencies:
    total_faucet = SUM_FAUCET_RATES(currency, machinations_graph)
    total_drain = SUM_DRAIN_RATES(currency, machinations_graph)
    
    IF total_faucet > total_drain * 1.2:  // 20%+ профицит
        inflation_rate = (total_faucet - total_drain) / total_drain
        diagnostics.append({
            pathology: "inflation",
            severity: inflation_rate > 0.5 ? "critical" : "warning",
            location: currency.name,
            description: f"Валюта '{currency.name}': faucet ({total_faucet}/тик) > drain ({total_drain}/тик). Инфляция ~{inflation_rate:.0%}",
            faucet_breakdown: BREAKDOWN_FAUCETS(currency, machinations_graph),
            drain_breakdown: BREAKDOWN_DRAINS(currency, machinations_graph),
            corrections: [
                "Увеличить стоки: налоги, ремонт, расходники",
                "Bind-on-equip: предметы нельзя перепродать",
                "Динамическое трение: расход пропорционален богатству",
                "Сезонные сбросы: новый сезон обесценивает старый контент",
                "Престижные сбросы: обнулить прогресс ради постоянного бонуса"
            ]
        })

// ===== ПАТОЛОГИЯ 5: Стагнация =====
// Критерий: валюта накапливается без возможностей траты
FOR EACH currency IN ResourceInventory.currencies:
    spend_opportunities = COUNT_SPEND_OPPORTUNITIES(currency, machinations_graph, progressionProfile)
    // Если на поздних этапах нет, на что тратить → стагнация
    
    IF spend_opportunities.late_game < 2:
        diagnostics.append({
            pathology: "stagnation",
            severity: "warning",
            location: currency.name,
            description: f"Валюта '{currency.name}': нехватка возможностей траты на поздних этапах",
            corrections: [
                "Бесконечные апгрейды (с убывающей отдачей)",
                "Престижные предметы (косметика за валюту)",
                "Социальные механики (подарки, аукцион)",
                "Престижные сбросы (prestige system)"
            ]
        })

// ===== ПАТОЛОГИЯ 6: Арбитраж =====
// Критерий: путь покупки по цене X и продажи по цене Y, где Y > X
FOR EACH trader IN machinations_graph.nodes.filter(n => n.type == "Trader"):
    forward_rate = trader.exchange_rate
    // Проверяем: можно ли купить у NPC и продать с прибылью?
    IF HAS_ARBITRAGE(trader, machinations_graph):
        diagnostics.append({
            pathology: "arbitrage",
            severity: "warning",
            location: trader.id,
            description: f"Арбитражная возможность: безрисковая прибыль через {trader.id}",
            corrections: [
                "NPC покупает дешевле, чем продаёт (spread)",
                "Комиссия на аукционе/торговле",
                "Bind-on-equip: нельзя перепродать",
                "Динамическое ценообразование"
            ]
        })

ВЫХОД: EconomyDiagnostics = {
    diagnostics: diagnostics,
    critical_count: diagnostics.filter(d => d.severity == "critical").length,
    warning_count: diagnostics.filter(d => d.severity == "warning").length,
    runaways: diagnostics.filter(d => d.pathology == "runaway"),
    deadlocks: diagnostics.filter(d => d.pathology == "deadlock"),
    stalls: diagnostics.filter(d => d.pathology == "stall"),
    inflations: diagnostics.filter(d => d.pathology == "inflation"),
    stagnations: diagnostics.filter(d => d.pathology == "stagnation"),
    arbitrages: diagnostics.filter(d => d.pathology == "arbitrage")
}
```

### 3.6.8 Этап 6: Автоматическая балансировка

**Цель**: На основе диагностики автоматически скорректировать модель экономики, устранив выявленные патологии. Коррекция может быть алгоритмической (расчёт оптимальных коэффициентов) или AI-генерированной (предложение новых механик для устранения проблем).

**Алгоритм**:

```
ВХОД: MachinationsModel, EconomyDiagnostics, ConversionGraph

corrections_applied = []

// ===== КОРРЕКЦИЯ 1: Устранение runaway =====
FOR EACH runaway IN EconomyDiagnostics.runaways:
    FOR EACH correction IN runaway.priority_corrections:
        IF correction.type == "Dynamic Friction":
            // Добавить drain, пропорциональный богатству
            // Формула: drain_rate = base_rate × (current_value / threshold)
            friction_node = {
                type: "Drain",
                resource: runaway.resource,
                rate_formula: "base_rate × (pool_value / threshold)",
                activation: "automatic"
            }
            // Рассчитать threshold так, чтобы runaway остановился
            threshold = CALC_RUNAWAY_THRESHOLD(runaway, machinations_graph)
            friction_node.threshold = threshold
            
            ADD_NODE(machinations_graph, friction_node)
            corrections_applied.append({
                pathology: "runaway",
                correction: "Dynamic Friction",
                node_added: friction_node.id,
                parameters: { threshold: threshold }
            })
            BREAK  // Применяем первую коррекцию, потом проверяем
            
        ELIF correction.type == "Stopping Mechanism":
            // Установить жёсткий потолок на пул ресурса
            pool = FIND_POOL(runaway.resource, machinations_graph)
            pool.capacity = CALC_OPTIMAL_CAPACITY(runaway, progressionProfile)
            corrections_applied.append({
                pathology: "runaway",
                correction: "Stopping Mechanism",
                pool_modified: pool.id,
                new_capacity: pool.capacity
            })
            BREAK

// ===== КОРРЕКЦИЯ 2: Устранение deadlock =====
FOR EACH deadlock IN EconomyDiagnostics.deadlocks:
    // Самая простая коррекция: стартовый капитал
    FOR EACH resource IN deadlock.required_resources:
        initial = CALC_MINIMUM_STARTING(resource, deadlock.cycle)
        pool = FIND_POOL(resource, machinations_graph)
        pool.initial_value = MAX(pool.initial_value, initial)
        corrections_applied.append({
            pathology: "deadlock",
            correction: "Starting capital",
            resource: resource,
            initial_value: initial
        })

// ===== КОРРЕКЦИЯ 3: Устранение stall =====
FOR EACH stall IN EconomyDiagnostics.stalls:
    // Добавить минимальный гарантированный источник
    safety_source = {
        type: "Source",
        resource: stall.critical_resource,
        rate: CALC_MINIMUM_SUSTAINABLE_RATE(stall),
        activation: "automatic",
        condition: f"pool_{stall.critical_resource} < {SAFETY_THRESHOLD}"
    }
    ADD_NODE(machinations_graph, safety_source)
    corrections_applied.append({
        pathology: "stall",
        correction: "Safety net source",
        node_added: safety_source.id
    })

// ===== КОРРЕКЦИЯ 4: Балансировка faucet/drain =====
FOR EACH inflation IN EconomyDiagnostics.inflations:
    // Стратегия: увеличить drain до уровня faucet (или уменьшить faucet)
    target_drain = CALC_TARGET_DRAIN(inflation, constraints.targetInflationRate)
    
    // Выбрать оптимальный метод:
    // (1) Добавить новый drain (налог, расходник)
    // (2) Увеличить существующий drain
    // (3) Добавить Dynamic Friction
    
    best_method = SELECT_BEST_DRAIN_METHOD(inflation, genre, machinations_graph)
    APPLY_DRAIN_CORRECTION(best_method, target_drain, machinations_graph)
    corrections_applied.append({
        pathology: "inflation",
        correction: best_method.description,
        target_drain: target_drain
    })

// ===== КОРРЕКЦИЯ 5: Устранение стагнации =====
FOR EACH stagnation IN EconomyDiagnostics.stagnations:
    // Добавить sinks для поздней игры
    late_game_sinks = AI_SUGGEST_SINKS(
        resource=stagnation.resource,
        genre=genre,
        existing_sinks=BREAKDOWN_DRAINS(stagnation.resource, machinations_graph),
        progression=progressionProfile,
        constraints=["Не нарушать раннюю игру", "Давать ощущение ценности"]
    )
    FOR EACH sink IN late_game_sinks:
        ADD_NODE(machinations_graph, CONVERT_TO_DRAIN(sink))
    corrections_applied.append({
        pathology: "stagnation",
        correction: "Late-game sinks added",
        sinks_added: late_game_sinks.length
    })

ВЫХОД: BalancedEconomy = {
    machinations_model: machinations_graph,
    corrections_applied: corrections_applied,
    pre_balance_diagnostics: EconomyDiagnostics,
    // Повторная диагностика после коррекции
    post_balance_diagnostics: RE_DIAGNOSE(machinations_graph)
}
```

### 3.6.9 Этап 7: Симуляция экономики (Monte Carlo)

**Цель**: Запустить N итераций экономической модели, чтобы проверить её долгосрочное поведение. Симуляция обнаруживает патологии, которые не видны при статическом анализе: медленный runaway, осцилляции, точки коллапса, неочевидные арбитражные возможности.

**Алгоритм**:

```
ВХОД: BalancedEconomy, ProgressionProfile

// ===== ШАГ 7.1: Подготовка симуляции =====
sim_config = {
    ticks: 10000,                     // Количество тиков (1 тик ≈ 1 действие в Core Loop)
    num_runs: 100,                     // Количество прогонов (разные стратегии)
    artificial_players: [
        { name: "optimal", strategy: "maximize_progression" },
        { name: "casual", strategy: "random_balanced" },
        { name: "minmaxer", strategy: "exploit_best_cycle" },
        { name: "explorer", strategy: "try_all_options" }
    ],
    recording_interval: 100,           // Записывать состояние каждые 100 тиков
    resource_tracking: ResourceInventory.all.map(r => r.name)
}

// ===== ШАГ 7.2: Выполнение симуляции =====
simulation_results = []

FOR run = 1 TO sim_config.num_runs:
    player_type = sim_config.artificial_players[run % 4]
    
    // Инициализация состояния
    state = INIT_STATE(BalancedEconomy.machinations_model)
    
    run_data = {
        player: player_type,
        snapshots: [],
        events: []
    }
    
    FOR tick = 1 TO sim_config.ticks:
        // 7.2.1: Выбрать действие на основе стратегии
        action = SELECT_ACTION(player_type.strategy, state, BalancedEconomy)
        
        // 7.2.2: Выполнить действие
        state = EXECUTE_ACTION(action, state, BalancedEconomy.machinations_model)
        
        // 7.2.3: Автоматические процессы (источники, стоки, конвертеры)
        state = PROCESS_AUTOMATIC(state, BalancedEconomy.machinations_model)
        
        // 7.2.4: Проверка границ (capacity, bounds)
        state = ENFORCE_BOUNDS(state, ResourceInventory)
        
        // 7.2.5: Записать снапшот
        IF tick % sim_config.recording_interval == 0:
            snapshot = {
                tick: tick,
                resources: COPY(state.resources),
                level: ESTIMATE_LEVEL(state, progressionProfile),
                actions_taken: state.actions_count
            }
            run_data.snapshots.append(snapshot)
        
        // 7.2.6: Детектор событий
        IF ANY_RESOURCE_EXCEEDED(state, 10 * INITIAL_VALUE):
            run_data.events.append({ tick, type: "potential_runaway", resource })
        ELIF ANY_RESOURCE_DEPLETED(state, 0.1 * INITIAL_VALUE):
            run_data.events.append({ tick, type: "potential_stall", resource })
    
    simulation_results.append(run_data)

// ===== ШАГ 7.3: Агрегация результатов =====
aggregated = {
    // Средние значения ресурсов по тикам
    avg_resource_curves: CALC_AVERAGE_CURVES(simulation_results),
    
    // Мин/макс значения (диапазон нормальности)
    resource_ranges: CALC_RANGES(simulation_results),
    
    // Частота событий
    runaway_frequency: COUNT_EVENTS(simulation_results, "potential_runaway") / sim_config.num_runs,
    stall_frequency: COUNT_EVENTS(simulation_results, "potential_stall") / sim_config.num_runs,
    
    // Скорость прогрессии (сколько тиков до каждого уровня)
    avg_ticks_per_level: CALC_AVG_TICKS_PER_LEVEL(simulation_results, progressionProfile),
    
    // Разрыв между оптимальной и неоптимальной стратегиями
    build_gap: CALC_BUILD_GAP(simulation_results),
    
    // Стабильность экономики (колебания ресурсов)
    stability_index: CALC_STABILITY_INDEX(simulation_results)
}

// ===== ШАГ 7.4: Оценка качества =====
quality_assessment = {
    // Все ли ресурсы остаются в разумных пределах?
    resources_in_bounds: CHECK_ALL_IN_BOUNDS(aggregated, ResourceInventory),
    
    // Не слишком ли быстрый/медленный рост?
    progression_pacing_ok: CHECK_PACING(aggregated, progressionProfile),
    
    // Нет ли runaway даже у minmaxer?
    no_runaway_for_minmaxer: aggregated.runaway_frequency < 0.1,
    
    // Нет ли stall у casual?
    no_stall_for_casual: aggregated.stall_frequency < 0.1,
    
    // Разрыв билдов приемлем?
    build_gap_acceptable: aggregated.build_gap < 3.0,
    
    // Экономика стабильна?
    economy_stable: aggregated.stability_index > 0.7
}

IF NOT quality_assessment.resources_in_bounds:
    ADD_CRITICAL("Ресурсы выходят за разумные пределы — нужна балансировка")
IF NOT quality_assessment.progression_pacing_ok:
    ADD_WARNING("Прогрессия слишком быстрая или медленная — коррекция кривых")
IF NOT quality_assessment.no_runaway_for_minmaxer:
    ADD_CRITICAL("Minmaxer вызывает runaway — усилить трение")
IF NOT quality_assessment.no_stall_for_casual:
    ADD_CRITICAL("Casual-игрок попадает в stall — добавить safety net")
IF NOT quality_assessment.build_gap_acceptable:
    ADD_WARNING("Разрыв билдов > 3x — сузить через базовые параметры")

ВЫХОД: SimulationResult = {
    config: sim_config,
    runs: simulation_results.length,
    aggregated: aggregated,
    quality: quality_assessment,
    recommendations: GENERATE_RECOMMENDATIONS(quality_assessment)
}
```

### 3.6.10 Этап 8: Итоговая сборка EconomyProfile

**Цель**: Объединить результаты всех 7 этапов в единый EconomyProfile, который становится частью Project State и передаётся в последующие алгоритмы (3.7 GDD, 3.8 чек-листы, 3.9 AI-промпты, 3.10 итоговая спецификация).

```typescript
interface EconomyProfile {
    // Ресурсы (из этапа 1)
    resources: ResourceInventory;
    
    // Классификация (из этапа 2)
    classification: EconomicClassification;
    
    // Machinations-модель (из этапа 3)
    machinationsModel: MachinationsModel;
    
    // Граф конверсий (из этапа 4)
    conversionGraph: ConversionGraph;
    
    // Диагностика (из этапа 5)
    diagnostics: EconomyDiagnostics;
    
    // Скорректированная модель (из этапа 6)
    balancedEconomy: BalancedEconomy;
    
    // Симуляция (из этапа 7)
    simulation: SimulationResult;
    
    // Мета-данные
    economicType: string;                  // "engine" | "economy" | "ecology" | "hybrid_*"
    openness: string;                      // "open" | "closed" | "mixed"
    pricingType: string;                   // "fixed" | "player_driven" | "f2p" | "mixed"
    detectedPatterns: string[];            // Паттерны Adams/Dormans
    
    // Сводка для разработчика
    summary: {
        coreResourcesDescription: string;  // Человекочитаемое описание ядерных ресурсов
        economicTypeDescription: string;   // Описание типа экономики
        faucetDrainSummary: string;        // Сводка источников и стоков
        cyclesSummary: string;             // Сводка циклов конверсии
        pathologiesSummary: string;        // Сводка патологий и коррекций
        simulationSummary: string;         // Сводка результатов симуляции
    }
    
    // Связь с другими алгоритмами
    gddInput: EconomyGDDInput;             // Данные для алгоритма 3.7
    checklistInput: EconomyChecklistInput; // Данные для алгоритма 3.8
}
```

### 3.6.11 AI-промпт-спецификации для алгоритма 3.6

#### Промпт SUGGEST_SUBSIDIARY_RESOURCES

```
SYSTEM: Ты — эксперт по экономике игр. На основе уже определённых ядерных 
ресурсов и жанра игры предложи подсобные ресурсы, которые создают глубину 
и поддерживают ядерные. Подсобные ресурсы нужны для эффективного 
использования ядерных, но не являются самоцелью. Учитывай:
- Максимум {max_count} ресурсов (экономика не должна быть перегружена)
- Каждый подсобный ресурс должен быть связан хотя бы с 1 ядерным
- Разные подсобные ресурсы должны создавать разные стратегии
- Жанр: {genre} определяет типичные подсобные ресурсы

USER: Ядерные ресурсы: {core_resources}. Жанр: {genre}. 
Механики: {mechanics}. Core Loop: {core_loop}.

OUTPUT FORMAT: JSON [{
  "name": "...",
  "class": "time | currency | game_object | hp | experience",
  "relationship_to_core": "...",
  "strategic_purpose": "...",
  "bounds": {"min": 0, "max": 999},
  "initial_value": number
}]
```

#### Промпт SUGGEST_LATE_GAME_SINKS

```
SYSTEM: Ты — эксперт по экономике игр, особенно по проблеме стагнации 
в поздней игре. Игрок накопил много валюты '{resource}', но ему некуда 
её тратить. Предложи конкретные механики-стоки, которые: 
(1) дают ощущение ценности траты, (2) не разрушают раннюю игру, 
(3) поддерживают целевую эстетику игры. Учитывай жанр: {genre} 
и текущие стоки: {existing_drains}.

USER: Валюта: {resource}. Жанр: {genre}. Эстетика: {aesthetics}. 
Уровни: {level_range}. Существующие стоки: {existing_drains}.

OUTPUT FORMAT: JSON [{
  "sink_name": "...",
  "description": "...",
  "resource_cost": "...",
  "player_value": "...",
  "aesthetic_alignment": "...",
  "impact_on_early_game": "neutral | positive | slight_negative"
}]
```

#### Промпт GENERATE_ECONOMY_DESCRIPTION

```
SYSTEM: Ты — эксперт по экономике игр. На основе Machinations-модели 
создай человекочитаемое описание внутренней экономики игры для GDD. 
Описание должно включать: (1) ключевые ресурсы и их роль, 
(2) основные ресурсные потоки, (3) тип экономической системы, 
(4) механизмы балансировки, (5) типичные патологии и их профилактика.
Формат: технический, но понятный геймдизайнеру без знания Machinations.

USER: Модель: {machinations_summary}. Тип: {economic_type}. 
Жанр: {genre}. Ресурсы: {resources}. Циклы: {cycles_summary}.

OUTPUT FORMAT: Markdown-текст (3-5 абзацев)
```

---

## Интеграционная карта: связь алгоритмов 3.5 и 3.6

```
┌─────────────────────────────────────────────────────────────────────┐
│                     АЛГОРИТМ 3.5: ПРОГРЕССИЯ                       │
│                                                                     │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────┐   │
│  │ Макро-   │──→│ Этапы    │──→│ Кривые   │──→│ Контент-план  │   │
│  │ модель   │   │ (Tiers)  │   │ прогресс.│   │               │   │
│  └──────────┘   └──────────┘   └────┬─────┘   └───────────────┘   │
│                                      │                              │
│                    ┌─────────────────┘                              │
│                    ▼                                                 │
│           ┌────────────────┐                                        │
│           │ Связь с        │──────────────────────────────────┐     │
│           │ экономикой     │                                  │     │
│           └────────────────┘                                  │     │
│                    │                                          │     │
│                    ▼                                          ▼     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              АЛГОРИТМ 3.6: ЭКОНОМИКА                           │ │
│  │                                                                │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐               │ │
│  │  │Ресурсы   │─→│Классифи-  │─→│Machinations- │               │ │
│  │  │          │  │кация      │  │модель        │               │ │
│  │  └──────────┘  └───────────┘  └──────┬───────┘               │ │
│  │                                       │                        │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────▼───────┐               │ │
│  │  │Граф      │─→│Диагности- │─→│Балансировка  │               │ │
│  │  │конверсий │  │ка         │  │              │               │ │
│  │  └──────────┘  └───────────┘  └──────┬───────┘               │ │
│  │                                       │                        │ │
│  │                              ┌────────▼────────┐              │ │
│  │                              │ Monte Carlo     │              │ │
│  │                              │ симуляция       │              │ │
│  │                              └────────┬────────┘              │ │
│  │                                       │                        │ │
│  └───────────────────────────────────────┼────────────────────────┘ │
│                                          │                          │
│                    ┌─────────────────────┘                          │
│                    ▼                                                │
│         ┌──────────────────┐                                        │
│         │  ProgressionProfile + EconomyProfile                      │
│         │  → Project State → Алгоритмы 3.7-3.10                     │
│         └──────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Ключевые потоки данных между 3.5 и 3.6**:

| Данные | Откуда → Куда | Описание |
|--------|--------------|----------|
| Ядерные ресурсы | 3.5 → 3.6 | Ресурсы, которые растут через прогрессию |
| Faucet/Drain баланс по этапам | 3.5 → 3.6 | Сколько ресурсов должно поступать/уходить на каждом tier |
| Цепочки конверсии | 3.5 → 3.6 | Как ресурсы превращаются друг в друга |
| Кривые прогрессии | 3.5 → 3.6 | Формулы XP, мощности, стоимости |
| Machinations-модель | 3.6 → 3.5 | Экономическая модель, питающая прогрессию |
| Симуляционные данные | 3.6 → 3.5 | Реальное поведение кривых в симуляции |
| Диагностика патологий | 3.6 → 3.5 | Выявленные дисбалансы, влияющие на прогрессию |
| Скорректированные коэффициенты | 3.6 → 3.5 | Обновлённые параметры после балансировки |

**Итеративный цикл**: Алгоритмы 3.5 и 3.6 образуют замкнутый цикл: прогрессия задаёт требования к экономике → экономика моделирует потоки → симуляция проверяет поведение → коррекция → обновление кривых прогрессии → повтор. Рекомендуемое количество итераций: 2-3 (до сходимости качества симуляции > 0.8).
