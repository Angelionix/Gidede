# Фаза 3: Алгоритмы — Спецификация 3.1 и 3.2

> **Проект**: Gidede — Game Design AI System  
> **Дата**: 2026-05-18  
> **Настоящая фаза**: Формализация алгоритмов  
> **Данный документ**: Спецификации алгоритмов 3.1 (Генерация концепции) и 3.2 (Core Loop)  
> **Источники**: Кн. 5, 6, 7, 8, 10, 13, 15, 17; Библия геймдизайна (разд. 2.1, 2.3, 2.4); Концепция программы (разд. 2.5.2)

---

## 3.1 Алгоритм генерации концепции игры

### 3.1.1 Обзор алгоритма

Алгоритм генерации концепции — точка входа в систему Gidede. Он принимает абстрактную идею пользователя и преобразует её в структурированную концепцию игры, включающую жанр, эстетический профиль, набор совместимых механик, Core Loop и USP. Алгоритм реализует **Reverse MDA** (Бонд, Кн. 17) как основной генеративный принцип: от желаемого опыта (эстетика) к конкретным правилам (механики), а не наоборот. Это критически отличается от подхода большинства дизайнеров, которые начинают с механик и надеются, что получится интересный опыт. Reverse MDA целенаправленно конструирует игру, чьи механики гарантированно порождают нужный опыт.

Алгоритм состоит из 7 этапов, каждый из которых имеет формализованные входы, выходы и критерии качества. Этапы 1-3 — аналитические (определяют «что»), этапы 4-5 — генеративные (конструируют «как»), этапы 6-7 — валидационные (проверяют «правильно ли»).

### 3.1.2 Входные данные

```typescript
interface ConceptInput {
  // Обязательные поля
  idea: string;                    // Текстовое описание идеи (1-5 предложений)
  genre: GenreInput;              // Жанр (выбор из таксономии или автоопределение)
  
  // Опциональные поля (заполняются AI если не указаны)
  targetAudience?: AudienceInput;  // Целевая аудитория
  platform?: Platform[];           // Платформы
  constraints?: ConstraintsInput;  // Ограничения
  referenceGames?: string[];       // Референтные игры
  aestheticFocus?: AestheticType[]; // Желаемая эстетика (если пользователь знает)
  forbiddenMechanics?: string[];   // Запрещённые механики («перевёрнутые карты»)
}

type GenreInput = 
  | { type: 'explicit'; genre: Genre }        // Пользователь указал жанр
  | { type: 'auto' }                           // Определить автоматически из идеи
  | { type: 'explore'; options: Genre[] };     // Выбрать из предложенных

interface AudienceInput {
  primary: YeeMotivation[];        // Мотивации по модели Йи (1-3)
  experience: 'casual' | 'midcore' | 'hardcore';
  bartleType?: BartleType;         // Для быстрой совместимости
}

interface ConstraintsInput {
  teamSize?: number;               // Размер команды
  budget?: 'low' | 'medium' | 'high';
  timeline?: string;               // Срок разработки
  monetization?: MonetizationModel;
  scope?: 'small' | 'medium' | 'large';
}
```

### 3.1.3 Этап 1: Анализ и определение жанра

**Цель**: Определить жанр игры и его характеристики, включая жанровые конвенции, типичный Core Loop и ожидания аудитории.

**Алгоритм**:

```
ВХОД: ConceptInput

IF genre.type == 'explicit':
    genre_result = GENRE_TAXONOMY[genre.genre]
ELSE IF genre.type == 'auto':
    // AI-анализ текста идеи
    genre_candidates = AI_CLASSIFY_GENRE(idea, top_k=3)
    
    FOR EACH candidate IN genre_candidates:
        // Проверка через жанровые маркеры (Кн. 8, таксономия Роджерса)
        markers = EXTRACT_GENRE_MARKERS(idea)
        candidate.score *= MARKER_OVERLAP(candidate, markers)
    
    genre_result = SELECT_BEST(genre_candidates)
ELSE IF genre.type == 'explore':
    // Генерация вариантов с обоснованием
    genre_result = PRESENT_OPTIONS(genre.options, WITH_REASONING)

// Обогащение жанра данными из MechanicsDB
genre_profile = {
    name: genre_result.name,
    subgenre: genre_result.subgenre,
    typical_aesthetics: GENRE_AESTHETIC_MAP[genre_result],   // Таблица 3.1.4
    typical_mechanics: GENRE_MECHANIC_MAP[genre_result],      // Матрица «Механика→Жанр» из Кн. 15
    typical_core_loops: GENRE_CORELOOP_TEMPLATES[genre_result],
    audience_profile: GENRE_AUDIENCE_MAP[genre_result],
    conventions: GENRE_CONVENTIONS[genre_result]               // Кн. 8, Роджерс
}

ВЫХОД: GenreProfile
```

**Таблица 3.1.4: Маппинг жанр → доминантные эстетики (по ЛеБланку)**

| Жанр | Эстетика 1 (доминантная) | Эстетика 2 (поддерживающая) | Эстетика 3 (опциональная) |
|------|--------------------------|----------------------------|--------------------------|
| Шутер | Вызов | Чувственное | Товарищество (MP) |
| RPG | Фантазия | Нарратив | Вызов |
| Стратегия | Вызов | Подчинение | Выражение |
| Квест/Пазл | Открытие | Нарратив | Вызов |
| Выживание | Вызов | Открытие | Фантазия |
| Платформер | Чувственное | Вызов | Открытие |
| Roguelike | Вызов | Открытие | Нарратив |
| Симулятор | Фантазия | Подчинение | Открытие |
| MMO | Товарищество | Выражение | Вызов |
| Хоррор | Чувственное | Нарратив | Вызов |
| Спорт/Гонки | Вызов | Чувственное | Товарищество |

### 3.1.4 Этап 2: Reverse MDA — определение эстетики

**Цель**: Определить 2-3 доминантные эстетические ценности, которые игра должна вызывать у игрока. Это — целевая функция всего процесса: все последующие механики должны порождать именно эти эстетики.

**Алгоритм**:

```
ВХОД: GenreProfile, AudienceInput, ConceptInput

// Шаг 2.1: Начальное определение эстетики
IF input.aestheticFocus IS PROVIDED:
    primary_aesthetics = input.aestheticFocus
ELSE:
    // Маппинг ЦА → эстетика через модель Йи (Кн. 6)
    yee_to_aesthetic = {
        // Кластер «Экшен-социальный»
        'Destruction':     ['Вызов', 'Чувственное'],
        'Excitement':      ['Чувственное', 'Вызов'],
        'Competition':     ['Вызов', 'Товарищество'],
        'Community':       ['Товарищество', 'Выражение'],
        // Кластер «Мастерство-достижения»
        'Challenge':       ['Вызов', 'Подчинение'],
        'Strategy':        ['Подчинение', 'Вызов'],
        'Completion':      ['Подчинение', 'Открытие'],
        'Power':           ['Вызов', 'Фантазия'],
        // Кластер «Погружение-творчество»
        'Fantasy':         ['Фантазия', 'Нарратив'],
        'Story':           ['Нарратив', 'Фантазия'],
        'Design':          ['Выражение', 'Открытие'],
        'Discovery':       ['Открытие', 'Вызов']
    }
    
    primary_aesthetics = DEDUPLICATE(
        FLATMAP(input.targetAudience.primary, yee_to_aesthetic)
    )

// Шаг 2.2: Коррекция жанром
FOR EACH aesthetic IN primary_aesthetics:
    IF aesthetic NOT IN genre_profile.typical_aesthetics:
        // Предупреждение: нестандартная комбинация
        warning = f"Эстетика '{aesthetic}' нетипична для жанра '{genre}'. " +
                  f"Это может создать уникальный опыт или диссонанс."
        ADD_WARNING(warning)

// Шаг 2.3: AI-обогащение из описания идеи
idea_aesthetics = AI_EXTRACT_AESTHETICS(input.idea, FROM_CONTEXT=[
    "8 типов эстетики ЛеБланка: Чувственное, Фантазия, Нарратив, " +
    "Вызов, Товарищество, Открытие, Выражение, Подчинение",
    "Жанр: " + genre_profile.name,
    "Описание идеи: " + input.idea
])

// Шаг 2.4: Синтез
final_aesthetics = MERGE_AND_RANK(
    primary_aesthetics,    // Из ЦА/жанра
    idea_aesthetics        // Из AI-анализа идеи
)[:3]  // Оставить топ-3

ВЫХОД: AestheticProfile = {
    primary: final_aesthetics[0],    // Доминантная эстетика
    secondary: final_aesthetics[1],  // Поддерживающая
    tertiary: final_aesthetics[2],   // Опциональная
    rationale: AI_GENERATE_RATIONALE(final_aesthetics, input)
}
```

### 3.1.5 Этап 3: Reverse MDA — вывод динамик

**Цель**: Определить, какие динамические паттерны (типы взаимодействия, петли, эмерджентные поведения) порождают выбранные эстетики. Динамики — это «мост» между эстетикой и механиками: они описывают, **как** механики должны работать, чтобы создать нужный опыт.

**Таблица: Эстетика → Динамики (основные соответствия)**

| Эстетика | Порождающие динамики | Необходимые условия |
|----------|---------------------|-------------------|
| **Чувственное** | Сенсорная обратная связь, кинестетическое удовольствие, зрелищность | Мгновенная обратная связь (мс–с), визуальная/звуковая награда |
| **Фантазия** | Ролевое отыгрыш, погружение в мир, идентификация с персонажем | Согласованный сеттинг, агентивность, механики ↔ нарратив |
| **Нарратив** | Раскрытие сюжета, драматическое напряжение, эмергентный нарратив | Последовательность событий, персонажи, конфликт |
| **Вызов** | Рост сложности, мастерство, преодоление препятствий | Баланс вызов/навык, негативная ОС при ошибке, позитивная при успехе |
| **Товарищество** | Кооперация, социальные взаимодействия, общие цели | Зависимость между игроками, коммуникация, распределённые роли |
| **Открытие** | Исследование, тайны, нелинейность, «а-ха!» моменты | Скрытая информация, множественные пути, награда за любопытство |
| **Выражение** | Индивидуализация, творчество, выбор стиля | Множество вариантов, отсутствие единственного «правильного» пути |
| **Подчинение** | Управление, контроль, оптимизация, системное понимание | Сложная система с предсказуемыми правилами, прозрачные причинно-следственные связи |

**Алгоритм**:

```
ВХОД: AestheticProfile

dynamics = []

FOR EACH aesthetic IN [primary, secondary, tertiary]:
    // Получить порождающие динамики из таблицы соответствий
    aesthetic_dynamics = AESTHETIC_DYNAMICS_MAP[aesthetic]
    
    // AI-обогащение: какие ещё динамики могут порождать эту эстетику?
    additional = AI_SUGGEST_DYNAMICS(
        aesthetic=aesthetic,
        context="Жанр: " + genre + ", Идея: " + idea,
        constraints="Только из списка: " + DYNAMICS_VOCABULARY
    )
    
    dynamics = MERGE(dynamics, aesthetic_dynamics, additional)

// Устранение дубликатов и приоритизация
dynamics = DEDUPLICATE_AND_RANK(dynamics, BY={
    1. Сколько эстетик порождает (чем больше — тем лучше)
    2. Жанровое соответствие
    3. ЦА-соответствие
})

ВЫХОД: DynamicsProfile = {
    core_dynamics: dynamics[:5],     // Основные динамики
    supporting_dynamics: dynamics[5:10],  // Поддерживающие
    emergence_potential: ASSESS_EMERGENCE(dynamics),  // Номинальная/Слабая/Множественная/Сильная
    rationale: AI_GENERATE_RATIONALE(dynamics, aestheticProfile)
}
```

### 3.1.6 Этап 4: Выбор механик из MechanicsDB

**Цель**: Выбрать из MechanicsDB (127 механик) набор совместимых механик, которые порождают нужные динамики. Это ключевой генеративный этап, где алгоритмическое фильтрование сочетается с AI-ранжированием.

**Алгоритм (7-шаговый процесс, адаптированный из Кн. 15)**:

```
ВХОД: GenreProfile, AestheticProfile, DynamicsProfile, ConceptInput

// ===== ШАГ 1: Выбор базовых механик (Группа 1 MechanicsDB) =====
base_pool = MECHANICS_DB.filter(group=1)  // 9 механик: Изучение мира, Достижения, 
                                           // Враги, Инвентарь, Квесты, Головоломки,
                                           // Колода карт, Здоровье, Древо технологий

// Обязательные: минимум 1 из {Враги, Головоломки, Изучение мира}
// Обязательные: минимум 1 из {Здоровье, Достижения и очки}
selected_base = AI_SELECT(
    FROM=base_pool,
    CRITERIA=[
        genre_affinity >= 2,            // ●● или ●●● в матрице «Механика→Жанр»
        dynamics_coverage >= 1,          // Порождает хотя бы 1 нужную динамику
        min_count=3, max_count=5
    ],
    CONSTRAINTS=[
        AT_LEAST_ONE(["Враги", "Головоломки", "Изучение мира"]),
        AT_LEAST_ONE(["Здоровье", "Достижения и очки"])
    ]
)

// ===== ШАГ 2: Выбор боевых механик (Группы 4, 8) =====
IF "Враги" IN selected_base:
    combat_pool = MECHANICS_DB.filter(group IN [4, 8])
    
    // Жанровая специализация
    IF genre == "шутер":
        combat_specialization = ["Броня", "Запас патронов", "Укрытия", "Бесшумное оружие"]
    ELIF genre == "стелс":
        combat_specialization = ["Стелс и прятки", "Бесшумное оружие", "Ночное видение", "Без убийств"]
    ELIF genre == "RPG":
        combat_specialization = ["Характеристики", "Перки", "Обмундирование", "Прокачка оружия"]
    ELSE:
        combat_specialization = AI_SELECT_SUITABLE(combat_pool, genre, dynamics)
    
    selected_combat = AI_SELECT(
        FROM=combat_pool,
        PREFER=combat_specialization,
        min_count=2, max_count=4
    )
ELSE:
    selected_combat = []

// ===== ШАГ 3: Выбор прогрессии (Группы 2, 9) =====
progression_pool = MECHANICS_DB.filter(group IN [2, 9])

IF genre == "RPG":
    progression_specialization = ["Очки опыта", "Перки", "Характеристики", "Древо технологий"]
ELIF genre == "action":
    progression_specialization = ["Прокачка оружия", "Обмундирование", "Достижения"]
ELIF genre == "стратегия":
    progression_specialization = ["Древо технологий", "Строительство", "Сложность"]
ELSE:
    progression_specialization = AI_SUGGEST(progression_pool, genre, aesthetics)

selected_progression = AI_SELECT(
    FROM=progression_pool,
    PREFER=progression_specialization,
    min_count=2, max_count=3
)

// ===== ШАГ 4: Выбор пространственных механик (Группы 3, 5, 11) =====
spatial_pool = MECHANICS_DB.filter(group IN [3, 5, 11])

IF aesthetics.contains("Открытие"):
    spatial_specialization = ["Альтернативы", "Мультицели", "Карта мира", "Тайники", "Секретные уровни"]
ELIF aesthetics.contains("Подчинение"):
    spatial_specialization = ["Экономика", "Торг", "Зона игры", "Дискретное время"]
ELSE:
    spatial_specialization = AI_SUGGEST(spatial_pool, genre, dynamics)

selected_spatial = AI_SELECT(
    FROM=spatial_pool,
    PREFER=spatial_specialization,
    min_count=2, max_count=3
)

// ===== ШАГ 5: Выбор социальных/информационных (Группа 7) =====
IF platform == "мультиплеер" OR aesthetics.contains("Товарищество"):
    social_pool = MECHANICS_DB.filter(group=7)
    selected_social = AI_SELECT(FROM=social_pool, min_count=1, max_count=3)
ELSE:
    selected_social = AI_SELECT(
        FROM=MECHANICS_DB.filter(group=7, tags=["single-player-friendly"]),
        min_count=1, max_count=2
    )

// ===== ШАГ 6: Валидация совместимости =====
all_selected = selected_base + selected_combat + selected_progression + 
               selected_spatial + selected_social

// 6.1: Проверка конфликтов
conflicts = CHECK_CONFLICTS(all_selected)  // Из модели совместимости (Кн. 15)
IF conflicts:
    FOR EACH conflict IN conflicts:
        // Удалить механику с меньшей жанровой привязкой
        victim = MIN_BY(conflict.mechanic_a, conflict.mechanic_b, 
                        KEY=lambda m: GENRE_AFFINITY[m][genre])
        all_selected.REMOVE(victim)
        ADD_WARNING(f"Удалена механика '{victim}' из-за конфликта с '{other}'")

// 6.2: Проверка синергий
synergies = CHECK_SYNERGIES(all_selected)
synergy_score = len(synergies.strong) * 3 + len(synergies.weak) * 1
IF synergy_score < 5:
    ADD_WARNING("Слабые синергии между механиками — игра может ощущаться фрагментарной")
    // Предложить добавить механику, создающую синергию
    suggestion = AI_SUGGEST_SYNERGY_MECHANIC(all_selected, genre)
    ADD_SUGGESTION(suggestion)

// 6.3: Проверка запрещённых механик
IF input.forbiddenMechanics:
    all_selected = all_selected.filter(m => m NOT IN forbiddenMechanics)

// ===== ШАГ 7: Финальный набор механик =====
mechanic_set = {
    base: selected_base,           // 3-5 механик
    combat: selected_combat,       // 2-4 механики
    progression: selected_progression, // 2-3 механики
    spatial: selected_spatial,     // 2-3 механики
    social: selected_social,       // 1-3 механики
    total_count: 10-18 механик,    // Оптимальный диапазон для первой итерации
    conflicts_resolved: conflicts,
    synergies_detected: synergies,
    compatibility_score: CALC_COMPAT(all_selected)
}

ВЫХОД: MechanicSet
```

### 3.1.7 Этап 5: Генерация Core Loop и USP

**Цель**: На основе выбранного набора механик сформулировать основной игровой цикл и уникальное торговое предложение. Core Loop должен описывать минимальную FUN-активность (тест «30 секунд веселья», Кн. 7), а USP — уникальность концепции.

**Алгоритм**:

```
ВХОД: MechanicSet, AestheticProfile, DynamicsProfile

// ===== 5.1: Генерация Core Loop =====
// Используем шаблоны из Кн. 6 (Зубек) + Кн. 5 (Фуллертон) + Кн. 13 (Селлерс)

// Определить структурный тип Core Loop (Кн. 13)
IF DynamicsProfile.contains("усиливающие петли") AND NOT DynamicsProfile.contains("конвертация"):
    loop_type = "engine"
ELIF DynamicsProfile.contains("усиливающие петли") AND DynamicsProfile.contains("конвертация"):
    loop_type = "economy"
ELIF DynamicsProfile.contains("балансирующие петли") AND DynamicsProfile.contains("конвертация"):
    loop_type = "ecology"
ELSE:
    loop_type = "hybrid"

// Сгенерировать Core Loop из механик
core_loop_candidates = AI_GENERATE_CORE_LOOPS(
    mechanics=mechanic_set,
    aesthetics=aestheticProfile,
    dynamics=dynamicsProfile,
    loop_type=loop_type,
    constraints=[
        "3-5 шагов в цикле",
        "Каждый шаг соответствует 1-2 механикам",
        "Последний шаг замыкает петлю на первый",
        "Формулируется как действия игрока (глаголы)",
        "Проходит тест '30 секунд веселья'"
    ],
    count=3  // Генерируем 3 варианта для выбора
)

// ===== 5.2: Генерация USP =====
// Метод: найти уникальную комбинацию механик, которая отсутствует у конкурентов
usp_candidates = AI_GENERATE_USP(
    mechanics=mechanic_set,
    genre=genre,
    core_loops=core_loop_candidates,
    reference_games=input.referenceGames,
    constraints=[
        "1-2 предложения",
        "Формат: 'Единственный [жанр], где [уникальная комбинация]'",
        "Должен отражать основную эстетику",
        "Должен быть проверяем через Triangle of Weirdness"
    ],
    count=3
)

ВЫХОД: {
    core_loop_candidates: CoreLoopCandidate[],  // 3 варианта
    usp_candidates: USPCandidate[],             // 3 варианта
    loop_type: 'engine' | 'economy' | 'ecology' | 'hybrid'
}
```

### 3.1.8 Этап 6: Валидация концепции

**Цель**: Проверить сгенерированную концепцию через 3 формальных валидатора. Валидация не отвергает концепцию, а выявляет потенциальные проблемы и предлагает улучшения.

**Валидатор 1: Triangle of Weirdness (Кн. 8, Роджерс)**

```
triangle_result = EVALUATE_TRIANGLE(
    characters: ASSESS_WEIRDNESS(concept.characters),
    world: ASSESS_WEIRDNESS(concept.world),
    activities: ASSESS_WEIRDNESS(concept.activities)
)

IF triangle_result.weird_corners > 1:
    ADD_WARNING("Более 1 'странного' угла — концепция может быть труднопродаваемой")
    SUGGEST("Выберите один странный угол, остальные сделайте привычными")
```

**Валидатор 2: 5 вопросов кор-геймплея (Кн. 10, Гэри)**

```
five_questions = {
    q1_loop: core_loop IS_DEFINED AND core_loop.length >= 3,
    q2_conflict: concept.main_conflict IS_DEFINED,
    q3_resources: mechanic_set.contains_resource_mechanic(),
    q4_interaction: concept.interaction_type IS_DEFINED,
    q5_goal: concept.win_condition IS_DEFINED
}

unanswered = five_questions.filter(q => q.answer == false)
IF unanswered:
    FOR EACH question IN unanswered:
        ADD_SUGGESTION(AI_ANSWER_QUESTION(question, FROM=concept))
```

**Валидатор 3: 8 фильтров идеи (Кн. 1, Шелл)**

```
filters = [
    f1_experience: "Создаёт ли концепция чёткий опыт?",
    f2_audience: "Понятна ли ЦА?",
    f3_motivation: "Почему игрок будет играть?",
    f4_uniqueness: "Отличается ли от конкурентов?",
    f5_feasibility: "Реализуема ли концепция?",
    f6_scope: "Адекватен ли масштаб?",
    f7_fun: "Есть ли веселье в Core Loop?",
    f8_iteration: "Можно ли прототипировать за неделю?"
]

validation_result = AI_EVALUATE_FILTERS(concept, filters)
FOR EACH filter WHERE validation_result[filter].score < 0.6:
    ADD_WARNING(filter + ": " + validation_result[filter].reason)
    ADD_SUGGESTION(validation_result[filter].improvement)
```

### 3.1.9 Этап 7: Сборка One-Pager

**Цель**: Собрать все результаты в структурированный One-Pager — документ концепции из 8 полей (Кн. 8, Роджерс), который становится исходной точкой для Блока 2 (Core Loop Designer).

```typescript
interface OnePager {
    // 8 полей шаблона Роджерса
    title: string;                      // Название игры
    platform: Platform[];               // Целевые платформы
    targetAudience: string;             // Описание ЦА
    rating: ESRBRating;                 // Возрастной рейтинг
    
    // Описания (AI-сгенерированные с валидацией)
    storySynopsis: string;              // Краткий синопсис сюжета (2-3 предложения)
    gameplayDescription: string;        // Описание геймплея (3-5 предложений)
    uniqueFeatures: string[3];          // 3 уникальные фичи
    competitors: string[2-3];           // Сравнение с конкурентами
    
    // Дополнительные поля Gidede
    aestheticProfile: AestheticProfile; // Из Этапа 2
    dynamicsProfile: DynamicsProfile;   // Из Этапа 3
    mechanicSet: MechanicSet;           // Из Этапа 4
    coreLoop: CoreLoopCandidate;        // Выбранный вариант из Этапа 5
    usp: string;                        // Выбранный USP из Этапа 5
    validationReport: ValidationReport; // Из Этапа 6
    
    // Мета
    loopType: 'engine' | 'economy' | 'ecology' | 'hybrid';
    compatibilityScore: number;         // 0-100, совместимость механик
    uniquenessScore: number;            // 0-100, уникальность комбинации
}
```

### 3.1.10 AI-промпт-спецификации для алгоритма 3.1

#### Промпт CLASSIFY_GENRE

```
SYSTEM: Ты — эксперт по жанровой классификации игр. Определи жанр на основе 
описания идеи пользователя. Используй таксономию Роджерса: Action (platformer, 
shooter, fighting, stealth, survival horror, rhythm), Adventure, RPG (action, 
JRPG, tactical, MMORPG, roguelike), Simulation, Strategy, Puzzle, Party, 
Educational, Racing, Sports. Верни топ-3 жанра с оценкой уверенности (0-1).

USER: [idea text]

OUTPUT FORMAT: JSON [{"genre": "...", "subgenre": "...", "confidence": 0.0-1.0, "reasoning": "..."}]
```

#### Промпт EXTRACT_AESTHETICS

```
SYSTEM: Ты — эксперт по MDA-фреймворку. Проанализируй описание идеи игры и 
определи, какие из 8 эстетических ценностей ЛеБланка доминируют: Чувственное 
(Sensation), Фантазия (Fantasy), Нарратив (Narrative), Вызов (Challenge), 
Товарищество (Fellowship), Открытие (Discovery), Выражение (Expression), 
Подчинение (Submission). Учитывай жанр: [genre]. Верни топ-3 с обоснованием.

USER: [idea text]

OUTPUT FORMAT: JSON [{"aesthetic": "...", "confidence": 0.0-1.0, "reasoning": "..."}]
```

#### Промпт GENERATE_CORE_LOOPS

```
SYSTEM: Ты — креативный геймдизайнер. Создай 3 варианта Core Loop для игры на 
основе выбранных механик и эстетики. Core Loop = минимальная FUN-активность, 
мотивирующая продолжать (тест «30 секунд веселья»). Каждый вариант: 3-5 шагов, 
описанных как действия игрока (глаголы). Последний шаг замыкает петлю на первый. 
Структурный тип: [engine/economy/ecology]. Механики: [mechanic list]. 
Эстетика: [aesthetic list].

OUTPUT FORMAT: JSON [{"name": "...", "steps": ["...", "..."], "loop_type": "...", 
"fun_check_reasoning": "...", "estimated_duration_seconds": 15-120}]
```

#### Промпт GENERATE_USP

```
SYSTEM: Ты — эксперт по позиционированию игр. Создай 3 варианта USP (Unique 
Selling Proposition) для игры. Формат: «Единственный [жанр], где [уникальная 
комбинация]». USP должен: (1) отражать основную эстетику, (2) выделять среди 
конкурентов, (3) быть проверяемым. Референтные игры: [references]. 
Механики: [mechanic list]. Core Loop: [core loop].

OUTPUT FORMAT: JSON [{"usp": "...", "triangle_of_weirdness_check": "pass/warn",
"competitive_differentiation": "..."}]
```

---

## 3.2 Алгоритм проектирования Core Loop

### 3.2.1 Обзор алгоритма

Алгоритм проектирования Core Loop принимает концепцию игры (из алгоритма 3.1 или ручной ввод) и строит детальную, диагностированную и валидированную модель основного игрового цикла. В отличие от алгоритма 3.1, который генерирует предварительный Core Loop как часть концепции, алгоритм 3.2 углубляется в структуру петель, их взаимодействие на разных временных масштабах, диагностику патологий и валидацию через формальные критерии.

Core Loop — это не просто «цикл действий», а иерархическая система вложенных петель (Кн. 6, Зубек), которая работает на нескольких временных масштабах (Кн. 13, Селлерс) и классифицируется по типу ресурсных взаимодействий (Engines/Economies/Ecologies). Понимание этой структуры критично для создания игры, которая удерживает игрока: каждая вложенная петля должна предоставлять свой тип вознаграждения и вести к следующей.

### 3.2.2 Входные данные

```typescript
interface CoreLoopInput {
    // Из алгоритма 3.1 (или ручной ввод)
    concept: OnePager;                    // Концепция игры
    initialCoreLoop?: CoreLoopCandidate;  // Предварительный Core Loop (из 3.1)
    
    // Дополнительные данные
    mechanics: MechanicSet;               // Выбранные механики
    aestheticProfile: AestheticProfile;   // Эстетический профиль
    
    // Ручные корректировки (опционально)
    desiredLoopType?: 'engine' | 'economy' | 'ecology';
    customSteps?: CoreLoopStep[];         // Пользовательские шаги
}
```

### 3.2.3 Этап 1: Классификация структурного типа

**Цель**: Определить структурный тип Core Loop по двум осям (Кн. 13, Селлерс): (1) тип петель (усиливающие vs балансирующие), (2) тип ресурсных взаимодействий (один ресурс vs конвертация). Это определяет, как Core Loop будет вести себя в долгосрочной перспективе и какие патологии вероятны.

**Матрица классификации**:

| | Один ресурс | Конвертация ресурсов |
|---|-----------|---------------------|
| **Усиливающие петли** | **Двигатель (Engine)** | **Экономика (Economy)** |
| **Балансирующие петли** | *(Редкий случай)* | **Экология (Ecology)** |
| **Смешанные петли** | **Гибридный двигатель** | **Гибридная экономика** |

**Алгоритм**:

```
ВХОД: CoreLoopInput

// Шаг 1.1: Определить ресурсы в Core Loop
resources = EXTRACT_RESOURCES(input.mechanics, input.concept)
// Примеры: HP, XP, золото, мана, очки действий, территория, предметы

// Шаг 1.2: Определить тип петель
FOR EACH pair IN resources:
    IF pair.a → pair.a (усиливающая):  // Больше X → ещё больше X
        loop_type = "reinforcing"
    ELIF pair.a → LESS pair.a (балансирующая):  // Больше X → меньше X
        loop_type = "balancing"
    ELSE:
        loop_type = "mixed"

// Шаг 1.3: Определить тип взаимодействия
IF all resources are the same type:
    interaction = "single_resource"
ELIF resources convert into each other (XP → уровни → способности):
    interaction = "conversion"

// Шаг 1.4: Классификация
structural_type = CLASSIFY(loop_type, interaction)

// Шаг 1.5: Определение подтипа для Engine
IF structural_type == "engine":
    IF has_braking_mechanism(resources):  // Налоги, износ, расход
        sub_type = "braked_engine"        // Усиливающий + тормозящий
    ELSE:
        sub_type = "pure_engine"          // Только усиливающий — ОПАСЕН

// Шаг 1.6: Определение подтипа для Economy
IF structural_type == "economy":
    currencies = IDENTIFY_CURRENCIES(resources)
    IF currencies.length >= 2:
        sub_type = "multi_currency_economy"
    ELSE:
        sub_type = "single_currency_economy"
    IF has_braking_mechanism(resources):
        sub_type += "+braked"

ВЫХОД: StructuralType = {
    type: 'engine' | 'economy' | 'ecology',
    sub_type: string,
    resources: ResourceProfile[],
    loops: LoopProfile[],        // Усиливающие и балансирующие петли
    has_braking: boolean,
    currencies: string[],
    risk_assessment: RiskProfile  // Какие патологии наиболее вероятны
}
```

### 3.2.4 Этап 2: Конструирование иерархии петель

**Цель**: Построить многоуровневую иерархию Core Loop, от микро-петель (секунды) до мета-петель (часы/дни). Используем модель 6 временных масштабов Селлерса (Кн. 13) и 5 уровней геймплейных циклов Зубека (Кн. 6).

**Модель иерархии**:

```
┌───────────────────────────────────────────────────────────┐
│  МЕТА-ПЕТЛЯ (недели-месяцы)                              │
│  Сезоны, обновления, социальные события                  │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  МАКРО-ПЕТЛЯ (часы)                                 │ │
│  │  Сессия игры: старт → развитие → кульминация        │ │
│  │  ┌─────────────────────────────────────────────────┐│ │
│  │  │  КРУПНАЯ ПЕТЛЯ (15-30 мин)                      ││ │
│  │  │  Квест/миссия: принятие → выполнение → награда  ││ │
│  │  │  ┌─────────────────────────────────────────────┐││ │
│  │  │  │  СРЕДНЯЯ ПЕТЛЯ (5-10 мин)                   │││ │
│  │  │  │  Бой/головоломка: начало → решение → лут    │││ │
│  │  │  │  ┌─────────────────────────────────────────┐│││ │
│  │  │  │  │  МАЛАЯ ПЕТЛЯ (1-2 мин)                  ││││ │
│  │  │  │  │  Микро-задача: подход → действие → фидбэк││││ │
│  │  │  │  │  ┌─────────────────────────────────────┐││││ │
│  │  │  │  │  │  МИКРО-ПЕТЛЯ (мс-секунды)          │││││ │
│  │  │  │  │  │  Нажатие → анимация → эффект        │││││ │
│  │  │  │  │  └─────────────────────────────────────┘││││ │
│  │  │  │  └─────────────────────────────────────────┘│││ │
│  │  │  └─────────────────────────────────────────────┘││ │
│  │  └─────────────────────────────────────────────────┘│ │
│  └─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

**Алгоритм**:

```
ВХОД: StructuralType, CoreLoopInput, MechanicSet

// Шаг 2.1: Определить основную петлю (Core Loop — уровень «Средняя/Крупная»)
core_steps = input.initialCoreLoop?.steps ?? 
             AI_GENERATE_CORE_LOOP(mechanics, structural_type, aesthetics)

// Каждый шаг основной петли привязан к механике и ресурсу
core_loop = {
    steps: core_steps.map(step => ({
        action: step,                             // Глагол действия
        mechanics: MAP_STEP_TO_MECHANICS(step),    // Какие механики задействованы
        resources_consumed: EXTRACT_CONSUMED(step),
        resources_produced: EXTRACT_PRODUCED(step),
        feedback_type: DETERMINE_FEEDBACK(step),   // Позитивная/негативная
        duration_estimate: ESTIMATE_DURATION(step)  // Секунды-минуты
    })),
    structural_type: structural_type
}

// Шаг 2.2: Построить внутренние (микро) петли
// Каждая внутренняя петля = «30 секунд веселья» (Кн. 7)
inner_loops = []
FOR EACH step IN core_loop.steps:
    inner = AI_DECOMPOSE_STEP(step, INTO_MICRO_ACTIONS)
    inner_loops.push({
        level: "inner",
        parent_step: step,
        actions: inner,
        fun_check: EVALUATE_FUN(inner),  // Тест «30 секунд веселья»
        time_scale: ESTIMATE(inner)       // 1-30 секунд
    })

// Шаг 2.3: Построить внешние (макро) петли
// Внешние петли = долгосрочная мотивация (почему продолжать после 1 цикла?)
outer_loops = AI_GENERATE_OUTER_LOOPS(
    core_loop,
    mechanics,
    aesthetics,
    constraints=[
        "Каждый цикл Core Loop должен давать прогресс во внешней петле",
        "Внешняя петля должна усиливать мотивацию возвращаться",
        "3-5 внешних циклов = 1 макро-цикл (сессия)"
    ]
)

// Шаг 2.4: Построить мета-петлю (долгосрочная)
meta_loop = AI_GENERATE_META_LOOP(
    outer_loops,
    aesthetics,
    genre,
    constraints=[
        "Мета-петля должна давать ощущение развития (Развитие из Кн. 10)",
        "Мета-петля должна поддерживать основную эстетику",
        "Мета-петля = причина вернуться завтра"
    ]
)

ВЫХОД: LoopHierarchy = {
    core: core_loop,                // Основная петля
    inner: inner_loops,             // Микро-петли (3-7)
    outer: outer_loops,             // Макро-петли (2-4)
    meta: meta_loop,                // Мета-петля (1)
    total_levels: 4-5               // Количество уровней иерархии
}
```

### 3.2.5 Этап 3: Диагностика патологий

**Цель**: Проверить иерархию петель на 7 известных патологий (Кн. 13, Селлерс + Кн. 7, Шрайбер). Ранняя диагностика позволяет скорректировать Core Loop до того, как патология проявится в прототипе.

**Каталог патологий и алгоритмы обнаружения**:

#### Патология 1: Runaway (Экспоненциальный разрыв)

**Определение**: Усиливающая петля без тормозящего механизма. «Богатые становятся богаче». Каждый цикл Core Loop усиливает отрыв лидера, делая игру всё более несбалансированной.

**Алгоритм обнаружения**:

```
FOR EACH loop IN loop_hierarchy:
    IF loop.type == "reinforcing" AND NOT loop.has_brake:
        // Симуляция: что происходит после N итераций?
        simulation = SIMULATE_N_CYCLES(loop, N=20)
        
        IF simulation.growth_ratio > 2.0:  // Двойной рост за 5 циклов
            SEVERITY = "CRITICAL"
        ELIF simulation.growth_ratio > 1.5:
            SEVERITY = "WARNING"
        ELSE:
            SEVERITY = "OK"
        
        IF SEVERITY != "OK":
            ADD_DIAGNOSIS({
                pathology: "runaway",
                loop: loop,
                severity: SEVERITY,
                simulation_data: simulation,
                fix_options: [
                    "Добавить тормозящий двигатель: [налог, износ, расход маны]",
                    "Снизить множитель усиливающей петли",
                    "Ввести ситуационную зависимость (эффект уменьшается при повторе)",
                    "Добавить отрицательную ОС (отстающие получают бонус — Mario Kart)"
                ]
            })
```

#### Патология 2: Deadlock (Тупик)

**Определение**: Ресурс, получаемый в цикле, необходим для запуска этого же цикла. Игрок не может начать Core Loop, потому что у него нет ресурса, который можно получить только пройдя Core Loop.

**Алгоритм обнаружения**:

```
FOR EACH loop IN loop_hierarchy:
    required_resources = loop.steps[0].resources_consumed
    produced_resources = loop.steps[-1].resources_produced
    
    FOR EACH req IN required_resources:
        IF req IN produced_resources AND req NOT IN initial_resources:
            // Ресурс нужен для старта, но производится только в конце
            ADD_DIAGNOSIS({
                pathology: "deadlock",
                resource: req,
                loop: loop,
                severity: "CRITICAL",
                fix_options: [
                    "Добавить альтернативный источник ресурса (начальный запас)",
                    "Разделить цикл на два: мини-цикл для добычи ресурса + основной",
                    "Сделать первый цикл 'бесплатным' (без потребления ресурса)"
                ]
            })
```

#### Патология 3: Stall (Остановка)

**Определение**: Недостаточно ресурсов для продолжения цикла. В отличие от deadlock, stall возникает после нескольких успешных циклов, когда ресурсы истощаются.

**Алгоритм обнаружения**:

```
FOR EACH loop IN loop_hierarchy:
    simulation = SIMULATE_N_CYCLES(loop, N=20)
    
    IF simulation.resources_depleted_at_cycle IS NOT NULL:
        ADD_DIAGNOSIS({
            pathology: "stall",
            loop: loop,
            depletion_cycle: simulation.resources_depleted_at_cycle,
            severity: simulation.resources_depleted_at_cycle < 5 ? "CRITICAL" : "WARNING",
            fix_options: [
                "Увеличить приток ресурсов (faucet)",
                "Уменьшить расход (drain)",
                "Добавить механизм регенерации",
                "Ввести 'кризисный' источник (бонус при низких ресурсах)"
            ]
        })
```

#### Патология 4: Brittleness (Хрупкость)

**Определение**: Система выглядит стабильной, но одно возмущение может вывести её из равновесия без возможности восстановления. Характерно для Ecology-систем.

**Алгоритм обнаружения**:

```
IF structural_type == "ecology":
    // Возмущение: увеличить/уменьшить один ресурс на 30%
    FOR EACH resource IN resources:
        perturbation = SIMULATE_WITH_PERTURBATION(loop, resource, delta=0.3)
        recovery = perturbation.recovery_time  // В циклах
        
        IF recovery == INFINITE:
            ADD_DIAGNOSIS({
                pathology: "brittleness",
                resource: resource,
                severity: "CRITICAL",
                fix_options: [
                    "Добавить балансирующую петлю для этого ресурса",
                    "Увеличить 'буфер' (максимальный запас ресурса)",
                    "Ввести механизм 'аварийного восстановления'"
                ]
            })
        ELIF recovery > 5:
            ADD_DIAGNOSIS({
                pathology: "brittleness",
                resource: resource,
                severity: "WARNING",
                recovery_cycles: recovery
            })
```

#### Патология 5: Слабая эмерджентность

**Определение**: Core Loop линейный и предсказуемый — каждый цикл идентичен предыдущему. Нет пространства для различных стратегий или неожиданных взаимодействий.

**Алгоритм обнаружения**:

```
// Оценка эмерджентности (Кн. 4, Адамс/Дорманс — 4 уровня Фромма)
emergence_indicators = {
    branching_factor: CALC_BRANCHING_FACTOR(core_loop),
    // Сколько meaningful выборов на каждом шаге? >1 = хорошо
    
    state_space_size: CALC_STATE_SPACE(core_loop),
    // Насколько велико пространство состояний? Большое = хорошо
    
    mechanic_interactions: COUNT_CROSS_MECHANIC_INTERACTIONS(mechanics),
    // Сколько механик влияют друг на друга? >3 = хорошо
    
    player_strategies: AI_COUNT_VIABLE_STRATEGIES(core_loop, mechanics),
    // Сколько различных стратегий прохождения Core Loop? >2 = хорошо
}

IF emergence_indicators.branching_factor <= 1.5:
    ADD_DIAGNOSIS({
        pathology: "weak_emergence",
        indicator: "branching_factor",
        value: emergence_indicators.branching_factor,
        severity: "WARNING",
        fix_options: [
            "Добавить механику с множеством исходов (случайность, скрытая информация)",
            "Ввести несколько путей через Core Loop (альтернативы)",
            "Добавить взаимодействие между механиками (синергия создает новые стратегии)",
            "Разблокировать новые возможности по мере прогресса (unfolding complexity)"
        ]
    })

IF emergence_indicators.player_strategies <= 1:
    ADD_DIAGNOSIS({
        pathology: "single_strategy",
        severity: "CRITICAL",
        fix_options: [
            "Добавить серебряные пули (Кн. 10) — контрмеры для доминантной стратегии",
            "Ввести асимметрию (разные классы/перки = разные подходы)",
            "Создать ситуационную зависимость (эффективность зависит от контекста)"
        ]
    })
```

#### Патология 6: Монотонность (Pacing failure)

**Определение**: Core Loop не создаёт вариации интенсивности — каждый цикл одинакового напряжения. Отсутствует «кривая интереса» (Кн. 1, Шелл).

**Алгоритм обнаружения**:

```
intensity_profile = core_loop.steps.map(step => 
    ESTIMATE_INTENSITY(step, based_on={
        cognitive_load: step.decision_complexity,
        time_pressure: step.has_timer,
        risk: step.failure_consequence,
        sensory_load: step.sensory_feedback_intensity
    })
)

// Проверка: есть ли вариация?
variance = CALC_VARIANCE(intensity_profile)
IF variance < 0.2:  // Все шаги одинаковой интенсивности
    ADD_DIAGNOSIS({
        pathology: "monotone_pacing",
        intensity_profile: intensity_profile,
        severity: "WARNING",
        fix_options: [
            "Добавить 'пиковые' моменты (боссы, кризисы, поворотные точки)",
            "Ввести 'отдых' между интенсивными шагами (безопасные зоны)",
            "Создать нарастание сложности внутри макро-цикла",
            "Чередовать типы задач (действие → стратегия → исследование)"
        ]
    })
```

#### Патология 7: Разрыв между петлями

**Определение**: Внутренние петли не связываются с внешними. Игрок чувствует «зачем я это делаю?» — микро-действия не ведут к макро-целям.

**Алгоритм обнаружения**:

```
FOR EACH (inner, outer) IN PAIR(loop_hierarchy.inner, loop_hierarchy.outer):
    resource_flow = TRACE_RESOURCE_FLOW(inner, outer)
    
    IF NOT resource_flow.exists:
        ADD_DIAGNOSIS({
            pathology: "loop_disconnect",
            inner: inner,
            outer: outer,
            severity: "WARNING",
            fix_options: [
                "Добавить ресурс, который производится во внутренней петле " +
                "и потребляется во внешней",
                "Создать 'мост': завершение внутренней петли открывает " +
                "возможности во внешней",
                "Ввести общую валюту прогресса (XP, очки)"
            ]
        })
```

### 3.2.6 Этап 4: Валидация Core Loop

**Цель**: Проверить Core Loop через 4 формальных критерия, каждый из которых основан на конкретном фреймворке из книг.

**Критерий 1: Тест «30 секунд веселья» (Кн. 7)**

```
fun_check = {
    // Минимальная FUN-активность определена?
    has_fun_activity: inner_loops.some(l => l.fun_check.score >= 3),
    
    // Игрок получает чёткую обратную связь за каждое действие?
    has_clear_feedback: core_loop.steps.every(s => s.feedback_type != "none"),
    
    // Есть ли значимый выбор внутри цикла?
    has_meaningful_choice: emergence_indicators.branching_factor > 1,
    
    // Чувствует ли игрок прогресс?
    has_progression: outer_loops.some(l => l.provides_progression == true)
}

fun_score = CALC_WEIGHTED_SCORE(fun_check, weights=[0.3, 0.2, 0.3, 0.2])
```

**Критерий 2: Закрытие интерактивной петли (Кн. 13)**

```
interactive_loop_check = {
    // Игрок может действовать?
    can_act: core_loop.steps.every(s => s.action != "none"),
    
    // Действие меняет состояние игры?
    changes_state: core_loop.steps.every(s => s.resources_consumed.length > 0 OR 
                                               s.resources_produced.length > 0),
    
    // Игрок видит результат действия?
    sees_result: core_loop.steps.every(s => s.feedback_type != "none"),
    
    // Результат обновляет ментальную модель игрока?
    updates_model: emergence_indicators.player_strategies > 1
}
```

**Критерий 3: Поддержание основной эстетики**

```
FOR EACH step IN core_loop.steps:
    step_aesthetics = MAP_STEP_TO_AESTHETICS(step)
    IF aestheticProfile.primary NOT IN step_aesthetics AND
       aestheticProfile.secondary NOT IN step_aesthetics:
        ADD_WARNING(f"Шаг '{step.action}' не поддерживает основную эстетику " +
                    f"'{aestheticProfile.primary}'. Рассмотрите добавление " +
                    f"элемента, поддерживающего эту эстетику.")
```

**Критерий 4: Устойчивость к итерациям**

```
// Симуляция 100 циклов Core Loop
long_run = SIMULATE_N_CYCLES(core_loop, N=100)

sustainability_check = {
    // Нет runaway?
    no_runaway: long_run.growth_ratio < 2.0,
    
    // Нет stall?
    no_stall: long_run.min_resources > 0,
    
    // Сохраняется ли разнообразие стратегий?
    maintains_variety: long_run.dominant_strategy_share < 0.5,
    
    // Есть ли долгосрочная мотивация?
    has_long_term: meta_loop != null
}
```

### 3.2.7 Этап 5: Генерация рекомендаций и финальная сборка

**Цель**: На основе диагностики и валидации сгенерировать конкретные рекомендации по улучшению Core Loop и собрать финальную модель.

**Алгоритм**:

```
ВХОД: LoopHierarchy, DiagnosticReport[], ValidationReport[]

// Шаг 5.1: Приоритизация диагнозов
prioritized_diagnostics = SORT(diagnostics, BY={
    1. severity (CRITICAL > WARNING > INFO),
    2. pathology_type (runaway, deadlock > weak_emergence > monotone),
    3. fix_complexity (простые исправления приоритетнее)
})

// Шаг 5.2: AI-генерация рекомендаций
recommendations = AI_GENERATE_RECOMMENDATIONS(
    diagnostics=prioritized_diagnostics,
    core_loop=loop_hierarchy,
    constraints="Не меняйте основную эстетику и USP",
    max_recommendations=5
)

// Шаг 5.3: Автоматическое применение безопасных исправлений
FOR EACH recommendation IN recommendations:
    IF recommendation.auto_applicable AND recommendation.risk == "low":
        APPLY(recommendation)
        RE_DIAGNOSE()  // Перепроверить после исправления

// Шаг 5.4: Сборка финальной модели
final_core_loop = {
    // Иерархия петель
    hierarchy: loop_hierarchy,
    
    // Структурный тип
    structural_type: structural_type,
    
    // Диагностика
    diagnostics: prioritized_diagnostics,
    applied_fixes: recommendations.filter(r => r.applied),
    pending_fixes: recommendations.filter(r => !r.applied),
    
    // Валидация
    validation: {
        fun_check: fun_check,
        interactive_loop_check: interactive_loop_check,
        aesthetic_check: aesthetic_check,
        sustainability_check: sustainability_check,
        overall_score: WEIGHTED_AVERAGE(fun_check, interactive_loop_check, 
                                        aesthetic_check, sustainability_check)
    },
    
    // Визуализация (для UI)
    diagram: GENERATE_DIAGRAM(loop_hierarchy),
    
    // Связь с MechanicsDB
    mechanic_mapping: MAP_LOOPS_TO_MECHANICS(loop_hierarchy, mechanics)
}

ВЫХОД: FinalCoreLoop
```

### 3.2.8 Типовые шаблоны Core Loop по жанрам

Для ускорения генерации алгоритм использует библиотеку типовых шаблонов Core Loop, извлечённых из анализа книг:

| Жанр | Структурный тип | Шаблон Core Loop | Источник |
|------|----------------|-----------------|----------|
| Шутер | Engine + Ecology | Стрелять → Убивать → Получить лут → Улучшить оружие → Стрелять сильнее | Кн. 13 |
| RPG | Economy | Исследовать → Сражаться → Получить XP → Прокачаться → Открыть новые зоны → Исследовать | Кн. 6 |
| Стратегия | Economy | Собирать ресурсы → Строить → Создавать армию → Завоёвывать → Больше ресурсов | Кн. 13 |
| Roguelike | Engine (braked) | Войти в подземелье → Собрать лут → Сражаться → Умереть/Пройти → Разблокировать → Войти снова | Кн. 7 |
| Выживание | Economy + Ecology | Собирать → Крафтить → Строить → Защищать → Расширять → Собирать больше | Кн. 4 |
| Квест/Пазл | Engine (exploration) | Найти подсказку → Разгадать → Открыть путь → Найти новую подсказку | Кн. 8 |
| Платформер | Engine (skill) | Бежать → Прыгать → Преодолевать → Собирать → Бежать дальше | Кн. 5 |

### 3.2.9 AI-промпт-спецификации для алгоритма 3.2

#### Промпт DECOMPOSE_STEP

```
SYSTEM: Ты — эксперт по микро-дизайну игрового процесса. Разложи шаг Core Loop 
на последовательность микро-действий (1-5 секунд каждое), которые игрок 
выполняет на уровне мышечной памяти. Учитывай: (1) каждое действие должно 
давать мгновенную обратную связь, (2) цепочка должна ощущаться как «поток», 
(3) минимум одно действие должно требовать навыка (не автопилот).

USER: Шаг Core Loop: "[step description]"

OUTPUT FORMAT: JSON [{"action": "...", "feedback": "...", "skill_required": true/false, 
"duration_ms": 100-5000}]
```

#### Промпт GENERATE_OUTER_LOOPS

```
SYSTEM: Ты — эксперт по долгосрочному удержанию игроков. Создай 2-4 внешние 
(макро) петли, которые оборачивают Core Loop. Каждая макро-петля: (1) даёт 
прогресс, мотивирующий продолжать, (2) усиливает основную эстетику 
[aesthetics], (3) работает на масштабе 15-60 минут. Тип Core Loop: 
[engine/economy/ecology]. Механики: [mechanics].

OUTPUT FORMAT: JSON [{"name": "...", "trigger": "...", "goal": "...", 
"reward": "...", "duration_minutes": 15-60, "aesthetic_supported": "..."}]
```

#### Промпт GENERATE_META_LOOP

```
SYSTEM: Ты — эксперт по мета-дизайну игр. Создай мета-петлю — долгосрочную 
мотивацию, которая заставляет игрока вернуться завтра и через неделю. 
Мета-петля: (1) работает на масштабе дней-недель, (2) использует мотаивации 
из модели Йи [motivations], (3) связывает все макро-петли в единый прогресс. 
Жанр: [genre]. Эстетика: [aesthetics].

OUTPUT FORMAT: JSON [{"name": "...", "daily_hook": "...", "weekly_progression": "...",
"long_term_goal": "...", "motivation_type": "Победа/Самовыражение/Связь/Погружение/Развитие"}]
```

#### Промпт GENERATE_RECOMMENDATIONS

```
SYSTEM: Ты — опытный геймдизайнер-консультант. На основе диагнозов патологий 
Core Loop предложи конкретные исправления. Правила: (1) Не меняй основную 
эстетику и USP, (2) Предлагай минимальные изменения (принцип «измени одно 
правило»), (3) Для каждого исправления оцени риск (low/medium/high), 
(4) Предлагай максимум 5 рекомендаций в порядке приоритета.

USER: Диагнозы: [diagnostics]. Core Loop: [core_loop]. Эстетика: [aesthetics].

OUTPUT FORMAT: JSON [{"diagnosis_ref": "...", "recommendation": "...", 
"risk": "low/medium/high", "auto_applicable": true/false, "expected_impact": "..."}]
```

### 3.2.10 Интеграция с Project State

Результаты алгоритмов 3.1 и 3.2 записываются в Project State:

```typescript
// После алгоритма 3.1:
projectState.concept = onePager;
projectState.mda.aesthetics = aestheticProfile;
projectState.mda.dynamics = dynamicsProfile;
projectState.mda.mechanics = mechanicSet;

// После алгоритма 3.2:
projectState.coreLoop = {
    structuralType: structuralType,
    loops: loopHierarchy,
    pathologyReport: diagnosticReport,
    funCheckResult: funCheck,
    coreLoopDiagram: diagram
};

// Событие для Event Bus:
emit("coreLoop.designed", { projectId, coreLoop: projectState.coreLoop });
// → Подписчики: mda.revalidate(), balance.prepare(), gdd.updateTemplate()
```

---

## Приложение: Связь алгоритмов с книгами-источниками

| Этап алгоритма | Ключевые источники | Концепции |
|---------------|-------------------|-----------|
| 3.1 Этап 1 (Жанр) | Кн. 8, 10 | Таксономия Роджерса, конкретизирующие вопросы Гэри |
| 3.1 Этап 2 (Эстетика) | Кн. 2, 6, 13, 17 | 8 эстетик ЛеБланка, модель Йи, Big Five, Reverse MDA |
| 3.1 Этап 3 (Динамики) | Кн. 4, 6, 13 | Петли ОС, эмерджентность, Engines/Economies/Ecologies |
| 3.1 Этап 4 (Механики) | Кн. 4, 8, 15 | MechanicsDB (127 механик), модель совместимости, 7-шаговый алгоритм |
| 3.1 Этап 5 (Core Loop + USP) | Кн. 5, 6, 7, 8, 13 | Петли взаимодействия, «30 сек веселья», Box Cover Method |
| 3.1 Этап 6 (Валидация) | Кн. 1, 8, 10 | Triangle of Weirdness, 5 вопросов, 8 фильтров |
| 3.2 Этап 1 (Классификация) | Кн. 13 | Engines/Economies/Ecologies, Sources/Stocks/Sinks/Flows |
| 3.2 Этап 2 (Иерархия) | Кн. 6, 13 | 5 уровней Зубека, 6 масштабов Селлерса |
| 3.2 Этап 3 (Диагностика) | Кн. 4, 7, 13 | Runaway, deadlock, stall, brittleness, 6 комбинаций ОС |
| 3.2 Этап 4 (Валидация) | Кн. 1, 7, 13 | «30 сек веселья», интерактивная петля, кривая интереса |
| 3.2 Этап 5 (Рекомендации) | Кн. 5, 13 | RITE-метод, «измени одно правило», дизайнерская петля |
