# Фаза 3: Алгоритмы — Спецификация 3.3 и 3.4

> **Проект**: Gidede — Game Design AI System  
> **Дата**: 2026-05-18  
> **Настоящая фаза**: Формализация алгоритмов  
> **Данный документ**: Спецификации алгоритмов 3.3 (Генерация механик на основе MDA) и 3.4 (Балансировка: transitive/intransitive модели)  
> **Источники**: Кн. 1, 4, 6, 7, 9, 12, 13, 15, 17; Библия геймдизайна (разд. 2.3, 2.5); Концепция программы (разд. 2.5.2, Блок 3, Блок 4); Алгоритмы 3.1–3.2

---

## 3.3 Алгоритм генерации механик на основе MDA

### 3.3.1 Обзор алгоритма

Алгоритм генерации механик на основе MDA реализует **двойной MDA-процесс** Gidede — цикл генерации (Reverse MDA) и валидации (Classic MDA), который итеративно уточняет набор механик до тех пор, пока порождаемый ими опыт не совпадёт с целевым. Это центральный алгоритм Блока 3 «Механики и MDA Lab» (Концепция программы, разд. 2.5.2), который объединяет четыре режима работы: генеративный (Reverse MDA), аналитический (Classic MDA), валидационный (Линзы Шелла) и структурный (Матрица 4×3 Бонда).

Ключевой принцип: **MDA — это не однонаправленная причинность, а двунаправленная модель**. Алгоритм использует Reverse MDA для порождения кандидатов-механик из целевой эстетики и Classic MDA для верификации того, что выбранные механики действительно порождают нужный опыт. Обратная связь между двумя проходами обеспечивает сходимость процесса. Дополнительно алгоритм интегрирует модель Зубека (Механика → Геймплей → Опыт), чтобы сделать промежуточный уровень «геймплей» явным и наблюдаемым — это критически важно для AI-системы, которой нужен конкретный, моделируемый артефакт на каждом этапе.

Алгоритм состоит из 6 этапов. Этапы 1-3 — генеративный проход (Reverse MDA: Эстетика → Динамика → Механики). Этап 4 — аналитический проход (Classic MDA: Механики → Геймплей → Опыт). Этапы 5-6 — валидационные (Линзы Шелла, Матрица 4×3 Бонда, Лудонарративный анализ).

### 3.3.2 Входные данные

```typescript
interface MDAGenerationInput {
  // Обязательные поля (из алгоритма 3.1 или ручной ввод)
  aestheticProfile: AestheticProfile;    // Целевая эстетика (2-3 из 8 типов ЛеБланка)
  genre: GenreProfile;                   // Жанр игры
  concept: OnePager;                     // Концепция игры
  
  // Опциональные поля
  existingMechanics?: MechanicSet;       // Уже выбранные механики (из алгоритма 3.1)
  dynamicsProfile?: DynamicsProfile;     // Уже определённые динамики
  forbiddenMechanics?: string[];         // Запрещённые механики
  requiredMechanics?: string[];          // Обязательные механики
  maxMechanics?: number;                 // Максимум механик (по умолчанию 18)
  minMechanics?: number;                 // Минимум механик (по умолчанию 8)
  
  // Параметры итерации
  maxIterations?: number;                // Максимум итераций генеративного цикла (по умолчанию 3)
  convergenceThreshold?: number;         // Порог сходимости эстетики (по умолчанию 0.8)
}
```

### 3.3.3 Этап 1: Reverse MDA — определение целевых динамик

**Цель**: На основе целевой эстетики определить набор динамик, которые должны возникнуть в игре. Динамики — это наблюдаемые паттерны взаимодействия между механиками, которые порождают эстетический опыт. Этап использует как формализованные таблицы соответствий, так и AI-обогащение для учёта контекста конкретной игры.

**Алгоритм**:

```
ВХОД: AestheticProfile, GenreProfile, ConceptInput

// ===== ШАГ 1.1: Формализованный маппинг «Эстетика → Динамика» =====
// Основная таблица соответствий (из Библии геймдизайна, разд. 2.3)
aesthetic_dynamics_map = {
    "Чувственное": [
        "Непосредственный сенсорный фидбэк (мс–с)",
        "Кинестетическое удовольствие от управления",
        "Зрелищность эффектов и анимаций",
        "Синестезия (визуал ↔ звук ↔ тактильность)"
    ],
    "Фантазия": [
        "Идентификация с ролью/персонажем",
        "Иммерсия через согласованность мира",
        "Отыгрыш через механики (действия = роль)",
        "Трансформация (игрок меняется вместе с аватаром)"
    ],
    "Нарратив": [
        "Драматическая арка (напряжение → кульминация → разрешение)",
        "Раскрытие информации (от скрытого к явному)",
        "Последствия выбора (агентивность в сюжете)",
        "Эмергентный нарратив (истории, возникающие из геймплея)"
    ],
    "Вызов": [
        "Баланс навык/сложность (зона потока)",
        "Нарастание сложности (кривая вызова)",
        "Негативная ОС при ошибке + позитивная при успехе",
        "Треугольность (осмысленный выбор риска)"
    ],
    "Товарищество": [
        "Кооперация (зависимость между игроками)",
        "Распределённые роли (каждый незаменим)",
        "Общие цели + индивидуальные мотивации",
        "Коммуникация как ресурс/механика"
    ],
    "Открытие": [
        "Исследование (скрытая информация, тайны)",
        "Нелинейность (множество путей)",
        "«А-ха!» моменты (эврика)",
        "Системное понимание (как устроен мир)"
    ],
    "Выражение": [
        "Персонализация (кастомизация аватара, базы, стиля)",
        "Творчество (конструктивные механики)",
        "Отсутствие единственного «правильного» пути",
        "Демонстрация (показ другим игрокам)"
    ],
    "Подчинение": [
        "Структурированная рутина (петли гринда)",
        "Управление ресурсами (оптимизация)",
        "Предсказуемые правила (прозрачная система)",
        "Микро-цели (регулярные мелкие награды)"
    ]
}

target_dynamics = []
FOR EACH aesthetic IN [primary, secondary, tertiary]:
    target_dynamics = MERGE(target_dynamics, aesthetic_dynamics_map[aesthetic])

// ===== ШАГ 1.2: Жанровая фильтрация =====
// Некоторые динамики нетипичны для определённых жанров
FOR EACH dynamic IN target_dynamics:
    genre_fit = GENRE_DYNAMICS_FIT[dynamic][genre]
    IF genre_fit < 0.3:
        // Динамика нетипична для жанра — отметить, но не удалять
        dynamic.warning = f"Динамика '{dynamic}' редка для жанра '{genre}'. " +
                          f"Это может создать уникальный опыт или диссонанс."

// ===== ШАГ 1.3: AI-обогащение контекстом =====
// AI добавляет динамики, специфичные для конкретной идеи
context_dynamics = AI_SUGGEST_DYNAMICS(
    aesthetic=aestheticProfile,
    genre=genre,
    idea=concept.idea,
    constraints=[
        "Только динамики, которые порождают целевую эстетику",
        "Учитывать жанровые конвенции",
        "Допускаются нестандартные комбинации, если обоснованы"
    ],
    count=5  // Максимум 5 дополнительных динамик
)

// ===== ШАГ 1.4: Приоритизация динамик =====
all_dynamics = MERGE(target_dynamics, context_dynamics)
prioritized_dynamics = SORT(all_dynamics, BY={
    1. Количество порождаемых эстетик (desc),
    2. Жанровое соответствие (desc),
    3. Уникальность (динамики, порождаемые 3 эстетиками, приоритетнее)
})

ВЫХОД: DynamicsTarget = {
    core_dynamics: prioritized_dynamics[:6],      // Основные (порождают все 3 эстетики)
    supporting_dynamics: prioritized_dynamics[6:12], // Поддерживающие
    context_dynamics: context_dynamics,              // Контекстно-специфичные
    emergence_level: ASSESS_EMERGENCE(prioritized_dynamics),
    // Номинальная / Слабая / Множественная / Сильная (типология Фромма)
    rationale: AI_GENERATE_RATIONALE(prioritized_dynamics, aestheticProfile)
}
```

**Таблица: Уровни эмерджентности (Фромма, через Кн. 4)**

| Уровень | Название | Обратная связь | Рекомендация для AI |
|---------|----------|---------------|-------------------|
| 1 | Номинальная | Нет | Предупредить: «Слишком предсказуемо» |
| 2 | Слабая | Однонаправленная | Достаточно для коридорных игр |
| 3 | Множественная | Множественная | Рекомендуемый уровень для большинства жанров |
| 4 | Сильная | Сильно переплетённая | Только для песочниц и симуляций |

### 3.3.4 Этап 2: Reverse MDA — маппинг «Динамика → Механики»

**Цель**: Для каждой целевой динамики определить, какие механики из MechanicsDB (127 механик, Кн. 15) и из типологии Адамса/Дорманса (5 типов + 16 паттернов, Кн. 4) способны её порождать. Это ключевой генеративный этап, где формализованные соответствия сочетаются с AI-ранжированием.

**Таблица: Динамика → Релевантные механики (основные соответствия)**

| Динамика | Релевантные механики (уровни MechanicsDB) | Паттерны Adams/Dormans |
|----------|------------------------------------------|----------------------|
| Сенсорный фидбэк | Действия (кинетические), Эстетическое оформление, «Сочность» | Static Engine (стабильный поток) |
| Идентификация с ролью | Прогрессия (нарративная), Роль/класс, Объекты (аватар) | Engine Building (самоконструирование) |
| Драматическая арка | Прогрессия (сюжетная), Конфликт, Выбор с последствиями | Escalating Challenge |
| Баланс навык/сложность | Навык + Шанс, Петли ОС (эскалация), Кривая прогрессии | Escalating Complexity |
| Кооперация | Социальное взаимодействие, Роли, Зависимость (взаимная) | Trade, Worker Placement |
| Исследование | Пространство (открытое), Скрытые объекты, Неопределённость | Dynamic Engine (открываемые улучшения) |
| Персонализация | Действия (конструктивные), Кастомизация, Ресурсы (строительные) | Engine Building, Play-Style Reinforcement |
| Структурированная рутина | Прогрессия (гринд), Ресурсы (цикл производство→потребление) | Static Engine, Static Friction |

**Алгоритм**:

```
ВХОД: DynamicsTarget, MDAGenerationInput, GenreProfile

// ===== ШАГ 2.1: Генерация пула кандидатов для каждой динамики =====
mechanic_candidates = {}  // динамика → [кандидат-механик]

FOR EACH dynamic IN DynamicsTarget.core_dynamics + DynamicsTarget.supporting_dynamics:
    
    // 2.1.1: Формализованный отбор из MechanicsDB
    formal_mechanics = MECHANICS_DB.filter(
        dynamics_coverage CONTAINS dynamic,
        genre_affinity[input.genre] >= 2  // ●● или ●●●
    )
    
    // 2.1.2: Паттерны Adams/Dormans (Кн. 4)
    relevant_patterns = ADAMS_PATTERNS.filter(
        supports_dynamics CONTAINS dynamic
    )
    
    // 2.1.3: AI-расширение пула
    ai_mechanics = AI_SUGGEST_MECHANICS(
        dynamic=dynamic,
        genre=input.genre,
        existing=formal_mechanics,
        constraints=[
            "Механики должны порождать динамику '" + dynamic + "'",
            "Совместимы с жанром '" + input.genre + "'",
            "Из каталога 127 механик SW.BAND или аналоги"
        ],
        count=5
    )
    
    mechanic_candidates[dynamic] = MERGE(formal_mechanics, ai_mechanics)
    // Каждый кандидат имеет:
    //   .name — название механики
    //   .source — "MechanicsDB" | "AdamsPattern" | "AI-Suggested"
    //   .dynamics_affinity — список порождаемых динамик
    //   .genre_affinity — привязка к жанру (1-3)
    //   .aesthetics_served — список порождаемых эстетик

// ===== ШАГ 2.2: Перекрёстный анализ — какие механики покрывают больше динамик? =====
all_candidates = FLATTEN(mechanic_candidates.values())
coverage_map = {}  // кандидат → [динамики, которые он покрывает]

FOR EACH candidate IN all_candidates:
    covered = []
    FOR EACH dynamic IN mechanic_candidates.keys():
        IF candidate IN mechanic_candidates[dynamic]:
            covered.append(dynamic)
    coverage_map[candidate] = covered

// ===== ШАГ 2.3: Оптимизация покрытия (покрыть все динамики минимальным числом механик) =====
// Это задача покрытия множества (Set Cover) — NP-полная, используем жадную аппроксимацию
selected_mechanics = []
uncovered_dynamics = SET(DynamicsTarget.core_dynamics + DynamicsTarget.supporting_dynamics)

WHILE uncovered_dynamics IS NOT EMPTY:
    // Выбрать механику, покрывающую максимум непокрытых динамик
    best = ARGMAX(all_candidates, KEY=lambda m: 
        LEN(INTERSECTION(coverage_map[m], uncovered_dynamics)) 
        + GENRE_AFFINITY[m][genre] * 0.3
        + AESTHETIC_OVERLAP[m][aestheticProfile] * 0.2
    )
    selected_mechanics.append(best)
    uncovered_dynamics = uncovered_dynamics - SET(coverage_map[best])
    all_candidates.REMOVE(best)

// ===== ШАГ 2.4: Добавление синергетических механик =====
// Механики, которые сами не покрывают новые динамики, но усиливают уже покрытые
synergy_candidates = ALL_MECHANICS.filter(m => 
    m NOT IN selected_mechanics AND
    SYNERGY_SCORE(m, selected_mechanics) > 0.7 AND
    GENRE_AFFINITY[m][genre] >= 2
)

FOR EACH synergy IN SORT(synergy_candidates, BY=SYNERGY_SCORE, DESC):
    IF selected_mechanics.length < input.maxMechanics:
        selected_mechanics.append(synergy)
    ELSE:
        BREAK

ВЫХОД: MechanicCandidateSet = {
    mechanics: selected_mechanics,        // 8-18 механик
    dynamics_coverage: coverage_map,      // Какая механика какие динамики покрывает
    uncovered_dynamics: uncovered_dynamics, // Динамики без механик (если есть)
    synergy_pairs: CHECK_SYNERGIES(selected_mechanics),
    conflict_pairs: CHECK_CONFLICTS(selected_mechanics),
    total_aesthetics_served: CALC_AESTHETIC_COVERAGE(selected_mechanics, aestheticProfile)
}
```

### 3.3.5 Этап 3: Сборка и оптимизация набора механик

**Цель**: Уточнить набор механик, разрешив конфликты, проверив обязательные и запрещённые механики, и обеспечив достаточное покрытие всех трёх доминантных эстетик. Это этап, где формализованные правила преобладают над AI-генерацией.

**Алгоритм**:

```
ВХОД: MechanicCandidateSet, MDAGenerationInput

mechanics = COPY(MechanicCandidateSet.mechanics)

// ===== ШАГ 3.1: Обработка конфликтов =====
conflicts = MechanicCandidateSet.conflict_pairs
FOR EACH conflict IN SORT(conflicts, BY=severity, DESC):
    // Стратегия разрешения:
    // 1. Если одна из конфликтующих механик обязательна — удалить другую
    IF conflict.a IN input.requiredMechanics:
        mechanics.REMOVE(conflict.b)
        ADD_WARNING(f"Удалена механика '{conflict.b}' из-за конфликта с обязательной '{conflict.a}'")
    ELIF conflict.b IN input.requiredMechanics:
        mechanics.REMOVE(conflict.a)
        ADD_WARNING(f"Удалена механика '{conflict.a}' из-за конфликта с обязательной '{conflict.b}'")
    // 2. Иначе — удалить механику с меньшим покрытием динамик
    ELSE:
        coverage_a = LEN(MechanicCandidateSet.dynamics_coverage[conflict.a])
        coverage_b = LEN(MechanicCandidateSet.dynamics_coverage[conflict.b])
        victim = conflict.a IF coverage_a < coverage_b ELSE conflict.b
        mechanics.REMOVE(victim)
        ADD_WARNING(f"Удалена механика '{victim}' из-за конфликта с '{other}'")

// ===== ШАГ 3.2: Добавление обязательных механик =====
IF input.requiredMechanics:
    FOR EACH req IN input.requiredMechanics:
        IF req NOT IN mechanics:
            mechanics.append(LOOKUP_MECHANIC(req))
            // Пересчитать конфликты с новой механикой
            new_conflicts = CHECK_CONFLICTS_WITH(req, mechanics)
            FOR EACH nc IN new_conflicts:
                IF nc.severity == "critical":
                    ADD_WARNING(f"Обязательная механика '{req}' конфликтует с '{nc.other}'")

// ===== ШАГ 3.3: Удаление запрещённых механик =====
IF input.forbiddenMechanics:
    mechanics = mechanics.filter(m => m.name NOT IN input.forbiddenMechanics)

// ===== ШАГ 3.4: Проверка покрытия эстетик =====
aesthetic_coverage = {}
FOR EACH aesthetic IN [aestheticProfile.primary, aestheticProfile.secondary, aestheticProfile.tertiary]:
    covering_mechanics = mechanics.filter(m => aesthetic IN m.aesthetics_served)
    aesthetic_coverage[aesthetic] = {
        count: covering_mechanics.length,
        mechanics: covering_mechanics,
        sufficient: covering_mechanics.length >= 2  // Минимум 2 механики на эстетику
    }

// Если какая-то эстетика недостаточно покрыта — добавить механики
FOR EACH aesthetic, coverage IN aesthetic_coverage:
    IF NOT coverage.sufficient:
        additional = AI_SUGGEST_MECHANICS_FOR_AESTHETIC(
            aesthetic=aesthetic,
            genre=genre,
            existing=mechanics,
            constraints=["Не конфликтовать с существующими"],
            count=3 - coverage.count  // Сколько нужно добавить
        )
        mechanics = MERGE(mechanics, additional)

// ===== ШАГ 3.5: Проверка паттернов Adams/Dormans =====
// Набор механик должен содержать хотя бы один структурный паттерн
patterns_present = DETECT_PATTERNS(mechanics)
IF NOT patterns_present.engine:
    ADD_SUGGESTION("Добавьте двигательную механику (источник ресурсов) для устойчивой экономики")
IF NOT patterns_present.friction:
    ADD_SUGGESTION("Добавьте трение (расход ресурсов) для предотвращения runaway")
IF NOT patterns_present.escalation:
    ADD_SUGGESTION("Добавьте эскалацию (нарастание сложности) для долгосрочной мотивации")

// ===== ШАГ 3.6: Группировка механик по структурным ролям =====
structured_set = {
    // Группа 1: Базовые механики (ядро взаимодействия)
    base: mechanics.filter(group=1),           // 3-5 из MechanicsDB
    
    // Группа 2: Механики боевого взаимодействия
    combat: mechanics.filter(group IN [4, 8]),  // 2-4
    
    // Группа 3: Механики прогрессии
    progression: mechanics.filter(group IN [2, 9]), // 2-3
    
    // Группа 4: Пространственные механики
    spatial: mechanics.filter(group IN [3, 5, 11]), // 2-3
    
    // Группа 5: Социальные / информационные механики
    social: mechanics.filter(group=7),          // 1-3
    
    // Мета-данные
    total_count: mechanics.length,
    aesthetic_coverage: aesthetic_coverage,
    patterns_detected: patterns_present,
    compatibility_score: CALC_COMPAT(mechanics),
    synergy_score: CALC_SYNERGY(mechanics)
}

ВЫХОД: StructuredMechanicSet
```

### 3.3.6 Этап 4: Classic MDA — аналитический проход

**Цель**: Проверить, действительно ли выбранные механики порождают целевую эстетику. Это обратный проход: Механики → Геймплей → Опыт. Алгоритм моделирует взаимодействие механик и определяет, какой опыт вероятнее всего возникнет у игрока, затем сравнивает с целевой эстетикой. Если обнаруживается расхождение — алгоритм возвращается к генеративному проходу.

**Алгоритм**:

```
ВХОД: StructuredMechanicSet, AestheticProfile, DynamicsTarget

iteration = 0
converged = false

WHILE NOT converged AND iteration < input.maxIterations:
    iteration += 1
    
    // ===== ШАГ 4.1: Моделирование геймплея (уровень Зубека) =====
    // Конструируем гипотетический геймплей из механик
    simulated_gameplay = AI_SIMULATE_GAMEPLAY(
        mechanics=StructuredMechanicSet,
        genre=genre,
        constraints=[
            "Опиши конкретную последовательность действий игрока",
            "Покажи, как механики взаимодействуют друг с другом",
            "Укажи, какие ресурсы производятся и потребляются",
            "Покажи петли обратной связи, которые возникают"
        ]
    )
    
    // Альтернативный (алгоритмический) метод: Machinations-модель
    machinations_model = BUILD_MACHINATIONS_MODEL(StructuredMechanicSet)
    // Запуск симуляции: 1000 тиков
    simulation_result = SIMULATE_MACHINATIONS(machinations_model, ticks=1000)
    // Результат: распределения ресурсов, частоты действий, стабильность петель
    
    // ===== ШАГ 4.2: Вывод динамик из геймплея =====
    // Какие динамические паттерны наблюдаются в симуляции?
    observed_dynamics = EXTRACT_DYNAMICS(simulation_result, simulated_gameplay)
    
    // Проверка устойчивости: есть ли runaway, deadlock, stall?
    stability_check = CHECK_STABILITY(simulation_result)
    IF NOT stability_check.stable:
        ADD_WARNING(f"Обнаружена патология: {stability_check.pathology}")
        ADD_SUGGESTION(stability_check.correction)
    
    // ===== ШАГ 4.3: Вывод эстетики из динамик =====
    // Какой опыт вероятнее всего получит игрок?
    predicted_aesthetics = DYNAMICS_TO_AESTHETICS(observed_dynamics)
    // Используем обратную таблицу: динамика → эстетика
    
    // ===== ШАГ 4.4: Сравнение с целевой эстетикой =====
    match_scores = {}
    FOR EACH target_aesthetic IN [aestheticProfile.primary, aestheticProfile.secondary, aestheticProfile.tertiary]:
        IF target_aesthetic IN predicted_aesthetics:
            match_scores[target_aesthetic] = predicted_aesthetics[target_aesthetic].confidence
        ELSE:
            match_scores[target_aesthetic] = 0.0
            ADD_WARNING(f"Целевая эстетика '{target_aesthetic}' не порождается текущими механиками")
    
    overall_match = AVERAGE(match_scores.values())
    
    // ===== ШАГ 4.5: Проверка сходимости =====
    IF overall_match >= input.convergenceThreshold:
        converged = true
        ADD_INFO(f"Сходимость достигнута на итерации {iteration}: {overall_match:.2f}")
    ELSE:
        // Определить, какие эстетики не покрыты, и предложить коррекцию
        weak_aesthetics = FILTER(match_scores, score < 0.6)
        
        FOR EACH aesthetic, score IN weak_aesthetics:
            // AI предлагает замену или добавление механики
            correction = AI_SUGGEST_CORRECTION(
                weak_aesthetic=aesthetic,
                current_mechanics=StructuredMechanicSet,
                target_dynamics=DynamicsTarget,
                observed_dynamics=observed_dynamics,
                constraints=["Минимальные изменения", "Не нарушать существующие синергии"]
            )
            APPLY_CORRECTION(StructuredMechanicSet, correction)
        
        // Вернуться к шагу 4.1 с обновлённым набором

ВЫХОД: MDAResult = {
    mechanic_set: StructuredMechanicSet,
    simulated_gameplay: simulated_gameplay,
    observed_dynamics: observed_dynamics,
    predicted_aesthetics: predicted_aesthetics,
    match_scores: match_scores,
    overall_match: overall_match,
    iterations: iteration,
    converged: converged,
    stability: stability_check,
    machinations_model: machinations_model,
    simulation_result: simulation_result
}
```

### 3.3.7 Этап 5: Валидация через Линзы Шелла

**Цель**: Прогнать сгенерированный набор механик через релевантные линзы Шелла (Кн. 1) для выявления проблем, которые не видны через MDA-анализ. Линзы проверяют аспекты, которые MDA не охватывает: целостность, эмерджентность, треугольность, кривую интереса и другие.

**Алгоритм**:

```
ВХОД: MDAResult, StructuredMechanicSet

// ===== ШАГ 5.1: Выбор релевантных линз =====
// Не все 113 линз релевантны для данного проекта. Фильтрация по:
// (1) Уровень модели Зубека, на котором выявлена проблема
// (2) Жанровая релевантность
// (3) Тип эстетики

relevant_lenses = SELECT_LENSES(
    level=DETERMINE_FOCUS_LEVEL(MDAResult),  // опыт / геймплей / механика
    genre=genre,
    aesthetics=aestheticProfile
)

// ПРИОРИТЕТНЫЕ ЛИНЗЫ для MDA-валидации:
priority_lenses = [
    // Линзы целостности (критические для любого проекта)
    { id: 9,  name: "Тетрада", focus: "Согласованность Механика/История/Эстетика/Технология" },
    { id: 11, name: "Единство", focus: "Работают ли все элементы на общий замысел?" },
    { id: 12, name: "Резонанс", focus: "Усиливают ли элементы друг друга?" },
    
    // Линзы эмерджентности (критические для системных игр)
    { id: 30, name: "Эмерджентность", focus: "Сколько глаголов? Сколько результирующих действий?" },
    { id: 31, name: "Пространство действий", focus: "Совпадает ли воспринимаемое с реальным?" },
    
    // Линзы баланса (критические для конкурентных игр)
    { id: 40, name: "Треугольность", focus: "Осмысленный выбор риска vs безопасности" },
    { id: 41, name: "Доминантная стратегия", focus: "Есть ли один очевидно лучший путь?" },
    
    // Линзы интереса (критические для удержания)
    { id: 69, name: "Кривая интереса", focus: "Пики и спады интереса на протяжении игры" },
    { id: 74, name: "Свобода vs управляемость", focus: "Баланс агентивности и замысла" }
]

// ===== ШАГ 5.2: Применение линз =====
lens_results = []

FOR EACH lens IN priority_lenses:
    // AI оценивает проект через конкретную линзу
    result = AI_APPLY_LENS(
        lens=lens,
        mechanic_set=StructuredMechanicSet,
        mda_result=MDAResult,
        concept=concept,
        output_format={
            "lens_id": "number",
            "lens_name": "string",
            "questions_asked": ["string"],
            "answers": ["string"],
            "score": "0.0-1.0",
            "issues_found": ["string"],
            "suggestions": ["string"]
        }
    )
    lens_results.append(result)

// ===== ШАГ 5.3: Агрегация результатов =====
critical_issues = lens_results.filter(r => r.score < 0.4)
warnings = lens_results.filter(r => r.score >= 0.4 AND r.score < 0.7)
passed = lens_results.filter(r => r.score >= 0.7)

IF critical_issues.length > 0:
    FOR EACH issue IN critical_issues:
        ADD_CRITICAL(f"Линза #{issue.lens_id} '{issue.lens_name}': {issue.issues_found}")
        ADD_SUGGESTION(issue.suggestions)

ВЫХОД: LensValidation = {
    results: lens_results,
    critical_issues: critical_issues,
    warnings: warnings,
    passed_count: passed.length,
    total_count: lens_results.length,
    overall_score: AVERAGE(lens_results.map(r => r.score))
}
```

### 3.3.8 Этап 6: Валидация через Матрицу 4×3 Бонда и лудонарративный анализ

**Цель**: Проверить согласованность механик через расширенную матрицу Бонда (4 элемента × 3 уровня владения) и выявить лудонарративный диссонанс. Матрица Бонда (Кн. 17) проверяет, согласованы ли механика, история, эстетика и технология на каждом из трёх уровней (фиксированный, динамический, культурный).

**Алгоритм**:

```
ВХОД: StructuredMechanicSet, ConceptInput, MDAResult

// ===== ШАГ 6.1: Заполнение матрицы 4×3 =====
matrix = {
    // Фиксированный уровень (создано разработчиком)
    "Механика_Фикс":   EXTRACT_FIXED_MECHANICS(StructuredMechanicSet),
    "История_Фикс":    EXTRACT_FIXED_NARRATIVE(concept),
    "Эстетика_Фикс":   EXTRACT_FIXED_AESTHETICS(concept),
    "Технология_Фикс": EXTRACT_FIXED_TECH(concept),
    
    // Динамический уровень (возникает при взаимодействии)
    "Механика_Динам":   AI_PREDICT_EMERGENT_MECHANICS(StructuredMechanicSet),
    "История_Динам":    AI_PREDICT_EMERGENT_NARRATIVE(StructuredMechanicSet, concept),
    "Эстетика_Динам":   MDAResult.predicted_aesthetics,
    "Технология_Динам": AI_PREDICT_DYNAMIC_TECH(concept),
    
    // Культурный уровень (вне контроля разработчика)
    "Механика_Культ":   AI_PREDICT_CULTURAL_MECHANICS(StructuredMechanicSet),
    "История_Культ":    AI_PREDICT_CULTURAL_NARRATIVE(concept),
    "Эстетика_Культ":   AI_PREDICT_CULTURAL_AESTHETICS(concept),
    "Технология_Культ": AI_PREDICT_CULTURAL_TECH(concept)
}

// ===== ШАГ 6.2: Проверка согласованности по строкам (горизонтальная) =====
// В каждой строке все 4 элемента должны сообщать одно и то же
row_consistency = {}
FOR EACH level IN ["Фикс", "Динам", "Культ"]:
    row = {
        Механика: matrix["Механика_" + level],
        История: matrix["История_" + level],
        Эстетика: matrix["Эстетика_" + level],
        Технология: matrix["Технология_" + level]
    }
    consistency = AI_CHECK_ROW_CONSISTENCY(row, genre, concept)
    row_consistency[level] = consistency
    // consistency.score: 0.0-1.0
    // consistency.dissonances: [{element_a, element_b, reason}]

// ===== ШАГ 6.3: Проверка согласованности по столбцам (вертикальная) =====
// Фиксированный → Динамический → Культурный должны быть логической последовательностью
col_consistency = {}
FOR EACH element IN ["Механика", "История", "Эстетика", "Технология"]:
    col = {
        fixed: matrix[element + "_Фикс"],
        dynamic: matrix[element + "_Динам"],
        cultural: matrix[element + "_Культ"]
    }
    consistency = AI_CHECK_COLUMN_CONSISTENCY(col)
    col_consistency[element] = consistency

// ===== ШАГ 6.4: Обнаружение лудонарративного диссонанса =====
// Специфическая проверка: Механика ↔ История
ludonarrative_check = AI_CHECK_LUDONARRATIVE(
    mechanics=matrix["Механика_Фикс"],
    narrative=matrix["История_Фикс"],
    // Результат: Гармония / Ирония / Диссонанс
    criteria=[
        "Действия игрока (механика) согласуются ли с характером персонажа (нарратив)?",
        "Награды и наказания (механика) поддерживают ли заявленную тему (нарратив)?",
        "Эмергентные стратегии (динамическая механика) соответствуют ли миру (нарратив)?"
    ]
)

IF ludonarrative_check.result == "Диссонанс":
    ADD_CRITICAL(f"Лудонарративный диссонанс: {ludonarrative_check.description}")
    ADD_SUGGESTION(ludonarrative_check.correction)
ELIF ludonarrative_check.result == "Ирония":
    ADD_WARNING(f"Лудонарративная ирония (может быть намеренной): {ludonarrative_check.description}")

ВЫХОД: BondValidation = {
    matrix: matrix,
    row_consistency: row_consistency,
    col_consistency: col_consistency,
    ludonarrative: ludonarrative_check,
    overall_consistency: AVERAGE(
        row_consistency.map(r => r.score),
        col_consistency.map(c => c.score)
    )
}
```

### 3.3.9 Итоговая сборка: MDA-профиль механик

**Цель**: Объединить результаты всех 6 этапов в единый MDA-профиль, который становится частью Project State и передаётся в последующие алгоритмы (3.4 балансировка, 3.5 прогрессия, 3.7 GDD).

```typescript
interface MDAProfile {
    // Целевая модель (из этапов 1-3)
    aestheticProfile: AestheticProfile;        // Целевая эстетика
    dynamicsTarget: DynamicsTarget;            // Целевые динамики
    mechanicSet: StructuredMechanicSet;        // Выбранные механики
    
    // Аналитическая модель (из этапа 4)
    observedDynamics: string[];                // Наблюдаемые динамики (из симуляции)
    predictedAesthetics: Record<AestheticType, number>; // Предсказанная эстетика + уверенность
    matchScores: Record<AestheticType, number>;         // Совпадение с целевой
    overallMatch: number;                      // Общая сходимость (0-1)
    
    // Валидация (из этапов 5-6)
    lensValidation: LensValidation;            // Результаты линз Шелла
    bondValidation: BondValidation;            // Результаты матрицы 4×3
    
    // Модели для дальнейшего использования
    machinationsModel: MachinationsGraph;      // Machinations-модель экономики
    gameplayScript: string;                    // Описание смоделированного геймплея
    
    // Мета-данные
    iterationsRequired: number;                // Количество итераций MDA-цикла
    converged: boolean;                        // Достигнута ли сходимость
    issues: Issue[];                           // Все выявленные проблемы
    suggestions: Suggestion[];                 // Все рекомендации
    
    // Связь с другими алгоритмами
    balanceInput: BalanceInput;                // Данные для алгоритма 3.4
    progressionInput: ProgressionInput;        // Данные для алгоритма 3.5
}
```

### 3.3.10 AI-промпт-спецификации для алгоритма 3.3

#### Промпт SUGGEST_DYNAMICS

```
SYSTEM: Ты — эксперт по MDA-фреймворку и динамике игр. На основе целевой эстетики 
и жанра игры предложи динамические паттерны, которые порождают эту эстетику 
в контексте данного жанра. Динамика — это наблюдаемый паттерн взаимодействия 
между механиками, который игрок может ощутить. Учитывай:
- Специфику жанра (какие динамики типичны, какие — нет)
- Описание идеи игры
- Взаимодействие нескольких эстетик (если эстетики конфликтуют — предложи компромисс)

USER: Эстетика: [{aestheticProfile}]. Жанр: {genre}. Идея: {idea}.

OUTPUT FORMAT: JSON [{"dynamic": "...", "aesthetics_served": ["..."], 
"genre_fit": 0.0-1.0, "reasoning": "..."}]
```

#### Промпт SUGGEST_MECHANICS

```
SYSTEM: Ты — эксперт по механикам игр. На основе целевой динамики и жанра 
предложи конкретные механики из каталога 127 механик SW.BAND (15 групп), 
которые порождают эту динамику. Учитывай совместимость с уже выбранными 
механиками. Каждая механика описывается: название, группа, порождаемые 
динамики, жанровая привязка, синергии и конфликты.

USER: Динамика: {dynamic}. Жанр: {genre}. Уже выбраны: {existing_mechanics}.

OUTPUT FORMAT: JSON [{"name": "...", "group": 1-15, "dynamics": ["..."],
"genre_affinity": {"genre": 1-3}, "synergies": ["..."], "conflicts": ["..."],
"reasoning": "..."}]
```

#### Промпт SIMULATE_GAMEPLAY

```
SYSTEM: Ты — AI-симулятор геймплея. На основе набора механик и жанра 
смоделируй типичную игровую сессию: опиши конкретную последовательность 
действий игрока (глаголы), покажи взаимодействие механик, ресурсные потоки 
и петли обратной связи. Фокус: какие динамики возникают? Какой опыт 
вероятнее всего получит игрок?

USER: Механики: {mechanic_set}. Жанр: {genre}. Core Loop: {core_loop}.

OUTPUT FORMAT: JSON {
"gameplay_sequence": [{"step": 1, "action": "...", "mechanics_used": ["..."],
"resources_consumed": ["..."], "resources_produced": ["..."],
"feedback_type": "positive/negative"}],
"observed_dynamics": ["..."],
"predicted_aesthetics": [{"type": "...", "confidence": 0.0-1.0}],
"stability_issues": ["..."]
}
```

#### Промпт APPLY_LENS

```
SYSTEM: Ты — геймдизайн-аудитор. Примени Линзу #{lens_id} «{lens_name}» 
Шелла к проекту игры. Линза задаёт вопросы, на которые нужно ответить, 
анализируя механики, нарратив и эстетику проекта. Оцени результат по шкале 
0-1, где 1 = линза полностью пройдена, 0 = критические проблемы.

Ключевой вопрос линзы: {lens_question}

USER: Проект: {mechanic_set}. Концепция: {concept}. MDA-результат: {mda_result}.

OUTPUT FORMAT: JSON {"lens_id": ..., "score": 0.0-1.0, "answers": ["..."],
"issues_found": ["..."], "suggestions": ["..."]}
```

#### Промпт CHECK_LUDONARRATIVE

```
SYSTEM: Ты — эксперт по нарративному дизайну. Проанализируй соответствие 
между механикой игры и её нарративом. Существует три типа соответствия:
1. Гармония — механика и нарратив усиливают друг друга (Doom: бой = ярость демона)
2. Ирония — механика и нарратив противоречат друг другу намеренно (Papers, Please)
3. Диссонанс — механика и нарратив противоречат друг другу ненамеренно (Uncharted: 
   обаятельный авантюрист убивает сотни людей)

USER: Механика: {mechanics}. Нарратив: {narrative}. Жанр: {genre}.

OUTPUT FORMAT: JSON {"result": "Гармония/Ирония/Диссонанс", "confidence": 0.0-1.0,
"description": "...", "correction": "..."}
```

---

## 3.4 Алгоритм балансировки (transitive/intransitive модели)

### 3.4.1 Обзор алгоритма

Алгоритм балансировки — формальный аппарат для математического анализа и коррекции баланса игры. Он реализует Блок 4 «Баланс и симуляция» (Концепция программы, разд. 2.5.2) и объединяет три фундаментальные модели балансировки: **транзитивную** (cost-power кривые, «получаешь за то, что платишь»), **нетранзитивную** (RPS-структуры, циклические доминирования) и **ситуационную** (контекстная ценность объектов). Дополнительно алгоритм анализирует стабильность петель обратной связи (6 комбинаций по Шрайберу), диагностирует патологии баланса и проводит Monte Carlo-симуляцию.

Ключевой принцип алгоритма: **математический баланс ≠ воспринимаемый баланс** (Селлерс, Кн. 13; Шрайбер, Кн. 7). Алгоритм работает на двух уровнях — формальном (расчёт кривых, матриц, вероятностей) и перцептивном (эвристики восприятия, формат чисел, прозрачность случайности). Формальные модели обеспечивают математическую основу, а перцептивные — ощущение справедливости, которое в конечном счёте определяет, будет ли игрок доволен.

Алгоритм состоит из 7 этапов: классификация задачи балансировки, транзитивный анализ, нетранзитивный анализ, ситуационный анализ, анализ стабильности петель ОС, диагностика патологий, и Monte Carlo-валидация. Каждый этап производит формализованные артефакты (кривые, матрицы, отчёты), которые становятся частью Project State.

### 3.4.2 Входные данные

```typescript
interface BalanceInput {
    // Из алгоритма 3.3 (MDA-профиль)
    mdaProfile: MDAProfile;                    // MDA-профиль механик
    
    // Объекты для балансировки
    objects: BalanceObject[];                   // Игровые объекты (оружие, классы, юниты)
    resources: ResourceProfile[];               // Ресурсы экономики
    
    // Параметры балансировки
    balanceType: BalanceType;                   // Тип балансировки
    gameMode: 'PvP' | 'PvE' | 'PvPvE';       // Режим игры
    targetDuration?: number;                    // Целевая длительность (часы)
    targetLevels?: number;                      // Целевое число уровней
    
    // Ограничения
    anchorResource?: string;                    // Якорный ресурс (по умолчанию — первый из ресурсов)
    fulcrumLevel?: number;                      // Уровень фулкрума (по умолчанию — средний)
}

interface BalanceObject {
    id: string;
    name: string;
    type: 'character' | 'weapon' | 'unit' | 'ability' | 'item' | 'class';
    attributes: Record<string, number>;         // Атрибуты объекта (HP, урон, скорость, ...)
    cost?: number;                              // Стоимость (если применимо)
    tier?: number;                              // Уровень/тир
    tags?: string[];                            // Теги (элемент, стихия, тип урона)
}

type BalanceType = 
    | 'transitive'        // Стоимость пропорциональна силе
    | 'intransitive'      // Циклические доминирования (RPS)
    | 'situational'       // Контекстная ценность
    | 'mixed';            // Комбинация (по умолчанию)
```

### 3.4.3 Этап 1: Классификация задачи балансировки

**Цель**: Определить, какие типы балансировки применимы к данной игре, и выбрать стратегии для каждого типа. Классификация основана на 12 типах баланса Шелла (Кн. 1), 7 типах Шрайбера (Кн. 7) и 3 моделях Роллингса/Морриса (Кн. 12).

**Алгоритм**:

```
ВХОД: BalanceInput, MDAProfile

// ===== ШАГ 1.1: Определение доминирующей модели балансировки =====
// Выбор зависит от режима игры и структуры объектов

IF gameMode == 'PvP' AND objects имеют разную стоимость:
    primary_model = "transitive"          // Cost-power кривые
    secondary_model = "intransitive"      // RPS-структуры между классами
    
ELIF gameMode == 'PvP' AND objects НЕ имеют стоимости:
    primary_model = "intransitive"        // Циклические доминирования
    secondary_model = "situational"       // Контекстная ценность
    
ELIF gameMode == 'PvE':
    primary_model = "transitive"          // Кривые прогрессии
    secondary_model = "situational"       // Контекстная зависимость
    
ELSE:  // PvPvE
    primary_model = "mixed"
    secondary_model = "mixed"

// ===== ШАГ 1.2: Определение якорного ресурса =====
IF input.anchorResource IS PROVIDED:
    anchor = input.anchorResource
ELSE:
    // Выбрать ресурс, наиболее связанный с критерием победы/поражения
    anchor = SELECT_ANCHOR(resources, CRITERIA=[
        "HP — для боевых игр",
        "Валюта — для экономических игр",
        "Победные очки — для стратегий",
        "XP — для RPG"
    ])

// ===== ШАГ 1.3: Определение масштаба балансировки =====
IF input.targetDuration AND input.targetLevels:
    macro_model = CALC_MACRO_MODEL(
        hours=input.targetDuration,
        levels=input.targetLevels
    )
    // macro_model = {
    //   transitions: L - 1,
    //   transitions_per_hour: L / T,
    //   content_stages: L / 2,
    //   enemy_configs: 3 * (L / 2),
    //   stat_points_per_level: (Final - Initial) / (L - 1)
    // }

// ===== ШАГ 1.4: Определение типа суммы и ОС =====
// По матрице Шрайбера (6 комбинаций)
game_sum_type = DETERMINE_SUM_TYPE(objects, resources)
// Положительная / Нулевая / Отрицательная сумма

feedback_type = DETERMINE_FEEDBACK_TYPE(MDAResult.observed_dynamics)
// Усиливающая / Балансирующая / Обе

// ===== ШАГ 1.5: Карта балансировки =====
balance_map = {
    primary_model: primary_model,
    secondary_model: secondary_model,
    anchor: anchor,
    game_sum: game_sum_type,
    feedback: feedback_type,
    macro_model: macro_model,
    applicable_balance_types: {
        // Из 12 типов Шелла — какие актуальны для данного проекта
        fairness: gameMode == 'PvP',
        difficulty: true,             // Всегда актуально
        meaningful_choice: true,      // Всегда актуально
        skill_vs_chance: MDAResult.observed_dynamics.contains("случайность"),
        head_vs_hands: genre IN ["action", "shooter", "fighting"],
        competition_vs_coop: gameMode == 'PvP',
        short_vs_long: true,          // Всегда актуально
        rewards: true,                // Всегда актуально
        punishment: true,             // Всегда актуально
        freedom_vs_control: aestheticProfile.contains("Открытие"),
        simplicity_vs_complexity: true,
        detail_vs_imagination: true
    }
}

ВЫХОД: BalanceMap = balance_map
```

### 3.4.4 Этап 2: Транзитивный анализ (cost-power кривые)

**Цель**: Проверить, что каждый объект «стоит своей цены» — его сила пропорциональна стоимости. Это основа математического баланса: если транзитивный баланс нарушен, ни один другой тип баланса не исправит ситуацию. Транзитивный анализ отвечает на вопрос: «Получает ли игрок адекватную отдачу за свои инвестиции?».

**Алгоритм**:

```
ВХОД: BalanceInput, BalanceMap

// ===== ШАГ 2.1: Определение вспомогательной математики (Support Math) =====
// Каждый атрибут выражается в единицах якорного ресурса
attribute_weights = {}  // атрибут → вес в единицах якоря

// Метод 1: Из «ванильных» объектов (только стоимость + базовые статы)
vanilla_objects = objects.filter(o => o.tags.length == 0 AND o.type != "ability")
IF vanilla_objects.length >= 3:
    // Система уравнений: cost = w1*a1 + w2*a2 + ... + wn*an
    // Решаем методом наименьших квадратов
    attribute_weights = SOLVE_LEAST_SQUARES(vanilla_objects)
ELSE:
    // Метод 2: AI-оценка весов на основе жанра
    attribute_weights = AI_ESTIMATE_WEIGHTS(objects, genre, anchor)

// ===== ШАГ 2.2: Расчёт cost-power для каждого объекта =====
FOR EACH object IN objects:
    // Мощность (Power) = взвешенная сумма атрибутов
    object.power = SIGMA(attribute * attribute_weights[attribute] FOR attribute IN object.attributes)
    
    // Стоимость (Cost) = заявленная стоимость или расчётная
    IF object.cost IS DEFINED:
        object.effective_cost = object.cost
    ELSE:
        object.effective_cost = object.power  // Если стоимости нет — считаем равной мощности
    
    // Отношение Cost/Power
    object.cp_ratio = object.effective_cost / object.power
    
    // Позиция относительно кривой стоимости
    object.distance_from_curve = object.cp_ratio - 1.0  // 0 = на кривой

// ===== ШАГ 2.3: Построение кривой стоимости =====
// Три модели кривых по типу игры (Шрайбер, Кн. 7)

IF BalanceMap.game_sum == "positive" AND gameMode == "PvP":
    // Модель 1: Кривая тождества (y = x)
    // Сумма преимуществ = Сумма затрат
    expected_cp = 1.0
    
ELIF gameMode == "PvP" AND NOT objects[0].cost:
    // Модель 2: Сдвинутая тождественная
    // Сумма преимуществ − Сумма затрат = const > 0
    expected_cp = CALC_SHIFTED_IDENTITY(objects)
    
ELIF gameMode == "PvE":
    // Модель 3: Прогрессия ценности
    // Value[n+1] = Value[n] × (1 + прирост)
    growth_rate = ESTIMATE_GROWTH_RATE(macro_model)
    FOR EACH object IN SORT(objects, BY=tier):
        expected_power[tier] = expected_power[tier-1] * (1 + growth_rate)

// ===== ШАГ 2.4: Выявление пере-/недооценённых объектов =====
overpowered = objects.filter(o => o.distance_from_curve < -THRESHOLD)  // Слишком силён за свою цену
underpowered = objects.filter(o => o.distance_from_curve > THRESHOLD)  // Слишком слаб за свою цену
balanced = objects.filter(o => ABS(o.distance_from_curve) <= THRESHOLD)

// THRESHOLD зависит от типа игры:
// PvP-соревновательная: 0.10 (10%)
// PvE: 0.15 (15% — допустим «идеальный дисбаланс»)
// Казуальная: 0.20 (20%)

FOR EACH obj IN overpowered:
    ADD_WARNING(f"Объект '{obj.name}' переоценён (CP ratio: {obj.cp_ratio:.2f}, " +
                f"отклонение: {obj.distance_from_curve:.2f})")
    // Предложения коррекции
    correction = SUGGEST_TRANSITIVE_CORRECTION(obj, direction="nerf")
    ADD_SUGGESTION(correction)

FOR EACH obj IN underpowered:
    ADD_WARNING(f"Объект '{obj.name}' недооценён (CP ratio: {obj.cp_ratio:.2f}, " +
                f"отклонение: {obj.distance_from_curve:.2f})")
    correction = SUGGEST_TRANSITIVE_CORRECTION(obj, direction="buff")
    ADD_SUGGESTION(correction)

// ===== ШАГ 2.5: Проверка «идеального дисбаланса» =====
// (Портноу, через Шрайбера): умеренные отклонения ~10-15% от кривой — это хорошо
ideal_imbalance_count = objects.filter(o => ABS(o.distance_from_curve) BETWEEN 0.05 AND 0.15).length
IF ideal_imbalance_count > 0 AND gameMode != "PvP_competitive":
    ADD_INFO(f"{ideal_imbalance_count} объектов в зоне «идеального дисбаланса» — это обогащает мета-игру")

ВЫХОД: TransitiveResult = {
    attribute_weights: attribute_weights,
    cost_curve: expected_cp,
    objects: objects.map(o => ({
        name: o.name,
        power: o.power,
        cost: o.effective_cost,
        cp_ratio: o.cp_ratio,
        distance_from_curve: o.distance_from_curve,
        status: "overpowered" | "underpowered" | "balanced" | "ideal_imbalance"
    })),
    overpowered: overpowered,
    underpowered: underpowered,
    balanced: balanced
}
```

### 3.4.5 Этап 3: Нетранзитивный анализ (RPS-структуры)

**Цель**: Выявить циклические доминирования между объектами и проверить, что нет доминантной стратегии. Нетранзитивный баланс критически важен для PvP-игр: он создаёт пространство для осмысленных решений, где нет единственного «лучшего» выбора, а оптимальная стратегия зависит от выбора оппонента.

**Алгоритм**:

```
ВХОД: BalanceInput, TransitiveResult

// ===== ШАГ 3.1: Построение матрицы выигрышей =====
// Строки = свои объекты, столбцы = объекты оппонента, ячейки = EV при встрече

n = objects.length
payoff_matrix = MATRIX(n, n)

FOR i IN 0..n-1:
    FOR j IN 0..n-1:
        IF i == j:
            payoff_matrix[i][j] = 0  // Зеркальный матч
        ELSE:
            // Расчёт исхода встречи на основе атрибутов
            payoff_matrix[i][j] = CALC_MATCHUP_EV(objects[i], objects[j])
            // Учитываем: тип урона, стихийные преимущества, дальность, скорость, и т.д.
            // Если объекты имеют теги (элементы) — использовать таблицу стихийных преимуществ

// ===== ШАГ 3.2: Проверка на нетранзитивность =====
is_intransitive = true
FOR i IN 0..n-1:
    FOR j IN 0..n-1:
        FOR k IN 0..n-1:
            // Если A бьёт B, B бьёт C, но A бьёт C — транзитивно!
            IF payoff_matrix[i][j] > 0 AND payoff_matrix[j][k] > 0 AND payoff_matrix[i][k] > 0:
                // Это тройка с транзитивным доминированием — не RPS
                CONTINUE
            ELIF payoff_matrix[i][j] > 0 AND payoff_matrix[j][k] > 0 AND payoff_matrix[k][i] > 0:
                // Это нетранзитивная тройка — RPS!
                LOG(f"Нетранзитивная тройка: {objects[i].name} > {objects[j].name} > {objects[k].name}")

// ===== ШАГ 3.3: Поиск равновесия Нэша =====
// Для симметричной игры с нулевой суммой:
// Все жизнеспособные стратегии дают одинаковый выигрыш = 0

IF is_symmetrical_game(payoff_matrix):
    // Решение через матричную алгебру: c = M⁻¹ × p
    TRY:
        nash_equilibrium = SOLVE_NASH_SYMMETRIC(payoff_matrix)
        // nash_equilibrium = вектор вероятностей выбора каждого объекта
        
        // Проверка: все вероятности >= 0?
        dominated = []
        FOR i IN 0..n-1:
            IF nash_equilibrium[i] < 0:
                // Стратегия доминируема — не должна выбираться
                dominated.append(i)
                nash_equilibrium[i] = 0  // Установить в 0
        
        // Нормализация
        total = SUM(nash_equilibrium)
        nash_equilibrium = nash_equilibrium.map(p => p / total)
        
    CATCH SingularMatrixError:
        // Матрица вырождена — есть доминантная стратегия
        ADD_CRITICAL("Обнаружена доминантная стратегия — игра не сбалансирована!")
        nash_equilibrium = FIND_DOMINANT_STRATEGY(payoff_matrix)
        ADD_CRITICAL(f"Доминантная стратегия: {objects[nash_equilibrium.argmax].name}")
ELSE:
    // Асимметричная игра — используем линейное программирование
    nash_equilibrium = SOLVE_NASH_ASYMMETRIC(payoff_matrix)

// ===== ШАГ 3.4: Анализ распределения стратегий =====
strategy_balance_score = CALC_STRATEGY_BALANCE(nash_equilibrium)
// Метрики:
//   entropy = -Σ p_i × log(p_i)  (максимальная = log(n), все равны)
//   max_share = max(nash_equilibrium)  (не должно превышать 50%)
//   gini = GINI_COEFFICIENT(nash_equilibrium)  (0 = идеальное равенство)

IF strategy_balance_score.max_share > 0.5:
    ADD_CRITICAL(f"Стратегия '{objects[nash_equilibrium.argmax].name}' используется в " +
                 f"{strategy_balance_score.max_share*100:.0f}% случаев — доминантная стратегия!")
    
    // Предложить коррекцию
    corrections = AI_SUGGEST_INTRANSITIVE_CORRECTIONS(
        payoff_matrix=payoff_matrix,
        dominant_idx=nash_equilibrium.argmax,
        objects=objects,
        constraints=["Не ломать существующие RPS-циклы", "Минимальные изменения"]
    )
    FOR EACH correction IN corrections:
        ADD_SUGGESTION(correction)

// ===== ШАГ 3.5: Проверка «КНБ со стоимостью» =====
// Контринтуитивный результат Шрайбера: усиление элемента может СНИЗИТЬ его использование
IF objects.some(o => o.cost IS DEFINED):
    // Пересчитать равновесие с учётом стоимости
    adjusted_payoff = payoff_matrix.map(row => 
        row.map(cell => cell - objects[row_idx].cost * COST_WEIGHT)
    )
    adjusted_nash = SOLVE_NASH_SYMMETRIC(adjusted_payoff)
    
    // Сравнить: усилило ли добавление стоимости доминантный элемент?
    FOR i IN 0..n-1:
        IF adjusted_nash[i] < nash_equilibrium[i]:
            ADD_INFO(f"Объект '{objects[i].name}' используется реже с учётом стоимости — " +
                     f"это нормально (эффект КНБ-со-стоимостью)")

ВЫХОД: IntransitiveResult = {
    payoff_matrix: payoff_matrix,
    nash_equilibrium: nash_equilibrium,
    is_intransitive: is_intransitive,
    dominated_strategies: dominated,
    strategy_balance: strategy_balance_score,
    rps_cycles: FIND_ALL_RPS_CYCLES(payoff_matrix),
    corrections: corrections
}
```

### 3.4.6 Этап 4: Ситуационный анализ

**Цель**: Оценить контекстную ценность объектов, которая зависит от конкретной игровой ситуации. Универсальный объект (эффективный в любой ситуации) должен стоить дороже специализированного (сильного только в определённых условиях). Формула (Шрайбер): `EV_ситуационный = Σ P(ситуация_i) × Ценность(объект в ситуации_i)`.

**Алгоритм**:

```
ВХОД: BalanceInput, TransitiveResult, IntransitiveResult

// ===== ШАГ 4.1: Определение ситуаций =====
// Ситуации зависят от жанра и типа объектов
IF genre IN ["RPG", "action"]:
    situations = [
        {name: "Одиночный сильный враг", probability: 0.3},
        {name: "Группа слабых врагов", probability: 0.4},
        {name: "Босс", probability: 0.1},
        {name: "Стелс-секция", probability: 0.1},
        {name: "Защита точки", probability: 0.1}
    ]
ELIF genre IN ["strategy", "RTS"]:
    situations = [
        {name: "Ранняя игра (экономика)", probability: 0.3},
        {name: "Мидгейм (война)", probability: 0.4},
        {name: "Лейтгейм (осадные орудия)", probability: 0.2},
        {name: "Оборона базы", probability: 0.1}
    ]
ELSE:
    // AI генерирует ситуации на основе механик
    situations = AI_GENERATE_SITUATIONS(objects, genre, constraints=[
        "Каждая ситуация должна делать разные объекты ценными",
        "Сумма вероятностей = 1",
        "3-7 ситуаций"
    ])

// ===== ШАГ 4.2: Оценка ценности каждого объекта в каждой ситуации =====
situational_values = MATRIX(objects.length, situations.length)

FOR i IN 0..objects.length-1:
    FOR j IN 0..situations.length-1:
        situational_values[i][j] = AI_EVALUATE_SITUATIONAL_VALUE(
            object=objects[i],
            situation=situations[j],
            context={genre, mechanics, other_objects: objects}
        )
        // Возвращает: 0.0-2.0 (1.0 = средняя ценность, >1.0 = сильнее среднего, <1.0 = слабее)

// ===== ШАГ 4.3: Расчёт ожидаемой ситуационной ценности =====
situational_ev = []
FOR i IN 0..objects.length-1:
    ev = SIGMA(situations[j].probability * situational_values[i][j] FOR j IN 0..situations.length-1)
    situational_ev.append(ev)

// ===== ШАГ 4.4: Оценка универсальности vs специализации =====
FOR i IN 0..objects.length-1:
    max_value = MAX(situational_values[i])
    min_value = MIN(situational_values[i])
    
    objects[i].versatility = {
        max: max_value,
        min: min_value,
        spread: max_value - min_value,
        type: "universal" IF spread < 0.3 ELSE "specialized",
        value_of_versatility: MAX_COST(uncertainty=1.0) - MIN_COST(uncertainty=0.0)
    }

// ===== ШАГ 4.5: Проверка баланса универсальности =====
// Универсальные объекты должны стоить дороже специализированных
universal_objects = objects.filter(o => o.versatility.type == "universal")
specialized_objects = objects.filter(o => o.versatility.type == "specialized")

FOR EACH universal IN universal_objects:
    // Универсальный объект с высокой ситуационной ценностью — потенциально доминантный
    IF situational_ev[universal.idx] > 1.2 AND universal.effective_cost < AVERAGE_COST(objects):
        ADD_WARNING(f"Универсальный объект '{universal.name}' слишком дёшев " +
                    f"для своей универсальности (EV: {situational_ev[universal.idx]:.2f})")

FOR EACH specialized IN specialized_objects:
    // Специализированный объект, который никогда не доминирует — может быть бесполезен
    IF MAX(situational_values[specialized.idx]) < 1.5:
        ADD_WARNING(f"Специализированный объект '{specialized.name}' недостаточно силён " +
                    f"даже в своей нише — возможно, мёртвая зона")

// ===== ШАГ 4.6: Стоимость переключения =====
switching_cost = ESTIMATE_SWITCHING_COST(objects, genre)
IF switching_cost == "high":
    ADD_INFO("Высокая стоимость переключения → специализация ценнее универсальности")
    // Специализированные объекты должны быть значительно сильнее универсальных в своей нише
ELIF switching_cost == "low":
    ADD_INFO("Низкая стоимость переключения → универсальность ценнее")
    // Универсальные объекты должны быть конкурентоспособны

ВЫХОД: SituationalResult = {
    situations: situations,
    situational_values: situational_values,
    situational_ev: situational_ev,
    versatility_map: objects.map(o => o.versatility),
    dead_zones: specialized_objects.filter(o => MAX(situational_values[o.idx]) < 1.5),
    dominant_universals: universal_objects.filter(o => situational_ev[o.idx] > 1.2),
    switching_cost: switching_cost
}
```

### 3.4.7 Этап 5: Анализ стабильности петель обратной связи

**Цель**: Проанализировать, как петли обратной связи влияют на долгосрочную стабильность баланса. Используем 8-мерный профиль петель (Адамс/Дорманс, Кн. 4) и 6 комбинаций сумма × ОС (Шрайбер, Кн. 7), чтобы прогнозировать поведение системы и выявлять патологии до их возникновения.

**Алгоритм**:

```
ВХОД: BalanceInput, MDAProfile, BalanceMap

// ===== ШАГ 5.1: Идентификация петель ОС =====
feedback_loops = EXTRACT_FEEDBACK_LOOPS(MDAProfile.machinationsModel)
// Каждая петля описывается 8 характеристиками Адамса/Дорманса:
// 1. Тип: Усиливающая / Балансирующая
// 2. Эффект: Конструктивная / Деструктивная
// 3. Инвестиция: число
// 4. Отдача: число
// 5. Скорость: Мгновенная / Задержанная
// 6. Длительность: Одноразовая / Постоянная
// 7. Косвенность: Прямая / Опосредованная
// 8. Определённость: Детерминированная / Вероятностная

FOR EACH loop IN feedback_loops:
    loop.profile = PROFILE_FEEDBACK_LOOP(loop)
    loop.risk_level = ASSESS_LOOP_RISK(loop.profile)
    // risk_level: "safe" | "caution" | "danger" | "critical"
    
    // Диагностический паттерн:
    // Положительная + Конструктивная + Низкая инвестиция + Высокая отдача +
    // Мгновенная + Постоянная + Прямая + Детерминированная = почти гарантированный runaway
    IF loop.profile.type == "reinforcing" AND 
       loop.profile.effect == "constructive" AND
       loop.profile.investment < THRESHOLD_LOW AND
       loop.profile.return > THRESHOLD_HIGH AND
       loop.profile.speed == "instant" AND
       loop.profile.duration == "permanent":
        loop.risk_level = "critical"
        ADD_CRITICAL(f"Петля '{loop.name}' — кандидат на runaway: " +
                     f"усиливающая, конструктивная, низкая инвестиция, высокая отдача, " +
                     f"мгновенная, постоянная")

// ===== ШАГ 5.2: Анализ комбинаций сумма × ОС =====
// По 6 комбинациям Шрайбера
sum_type = BalanceMap.game_sum  // Положительная / Нулевая / Отрицательная
has_reinforcing = feedback_loops.some(l => l.profile.type == "reinforcing")
has_balancing = feedback_loops.some(l => l.profile.type == "balancing")

IF sum_type == "positive" AND has_reinforcing AND NOT has_balancing:
    ADD_CRITICAL("Положительная сумма + Усиливающая ОС без балансирующей = " +
                 "Экспоненциальный разрыв (как в 4X-стратегиях без ограничителей)")
    ADD_SUGGESTION("Добавьте балансирующую петлю (Dynamic Friction, Stopping Mechanism, " +
                   "или rubber-banding)")

ELIF sum_type == "positive" AND has_balancing AND NOT has_reinforcing:
    ADD_INFO("Положительная сумма + Балансирующая ОС = «Косичка» — лидерство чередуется")
    
ELIF sum_type == "zero" AND has_reinforcing AND has_balancing:
    ADD_INFO("Нулевая сумма + Обе петли = Минус рано, плюс поздно (как в покере)")

// ===== ШАГ 5.3: Проверка на runaway =====
FOR EACH loop IN feedback_loops WHERE risk_level == "critical":
    // Ищем балансирующую петлю, которая компенсирует эту усиливающую
    compensating = feedback_loops.filter(l => 
        l.profile.type == "balancing" AND
        SHARED_RESOURCES(l, loop).length > 0
    )
    IF compensating.length == 0:
        ADD_CRITICAL(f"Усиливающая петля '{loop.name}' не компенсирована никакой " +
                     f"балансирующей петлёй — runaway неизбежен!")
        // Предложить коррекцию
        corrections = [
            "Добавить Dynamic Friction (сопротивление, растущее с уровнем ресурса)",
            "Добавить Stopping Mechanism (жёсткий потолок)",
            "Добавить задержку в петлю (инвестиция → отсрочка → отдача)",
            "Добавить вероятность (вместо детерминированной — вероятностная отдача)"
        ]
        ADD_SUGGESTION(AI_SELECT_BEST_CORRECTION(loop, corrections))

// ===== ШАГ 5.4: Анализ Q-фактора (Роллингс/Моррис) =====
// Каждый объект оценивается 1-10 по каждому атрибуту
q_matrix = CALC_Q_MATRIX(objects, objects[0].attributes.keys())

FOR EACH object IN objects:
    object.q_dominant_attrs = q_matrix[object.id].filter(q => q == MAX(q_matrix[object.id]))
    IF object.q_dominant_attrs.length == 0:
        ADD_WARNING(f"Объект '{object.name}' не доминирует ни по одному атрибуту — " +
                    f"кандидат на удаление или усиление")

ВЫХОД: FeedbackStabilityResult = {
    loops: feedback_loops,
    sum_feedback_combo: {sum: sum_type, feedback: feedback_type},
    critical_loops: feedback_loops.filter(l => l.risk_level IN ["danger", "critical"]),
    runaway_risk: feedback_loops.some(l => l.risk_level == "critical"),
    q_matrix: q_matrix,
    compensating_pairs: FIND_COMPENSATING_PAIRS(feedback_loops)
}
```

### 3.4.8 Этап 6: Диагностика патологий и коррекция

**Цель**: На основе результатов этапов 2-5 поставить диагноз и предложить конкретные коррекции. Патологии баланса — это конкретные, диагностируемые проблемы, каждая из которых имеет формальные критерии обнаружения и известные методы лечения.

**Каталог патологий** (из Библии геймдизайна, разд. 2.5 + Кн. 7, 9, 12, 13):

```
ВХОД: TransitiveResult, IntransitiveResult, SituationalResult, FeedbackStabilityResult

pathologies = []

// ===== ПАТОЛОГИЯ 1: Доминантная стратегия =====
IF IntransitiveResult.strategy_balance.max_share > 0.5:
    pathologies.append({
        name: "Доминантная стратегия",
        severity: "critical",
        evidence: f"Стратегия '{dominant_name}' используется в {max_share*100:.0f}% случаев",
        treatment: [
            "Ввести нетранзитивные отношения (RPS-структуру)",
            "Повысить стоимость доминанта",
            "Добавить контр-стратегии",
            "Ослабить синергии доминантной стратегии"
        ]
    })

// ===== ПАТОЛОГИЯ 2: Runaway (саморазгон) =====
IF FeedbackStabilityResult.runaway_risk:
    pathologies.append({
        name: "Runaway",
        severity: "critical",
        evidence: "Усиливающая петля без компенсации",
        treatment: [
            "Dynamic Friction (сопротивление, масштабирующееся с ресурсом)",
            "Stopping Mechanism (жёсткий потолок)",
            "Отрицательная ОС (резиновая лента)",
            "Задержка в петле (отсрочка отдачи)"
        ]
    })

// ===== ПАТОЛОГИЯ 3: Мёртвая зона =====
dead_zone_objects = SituationalResult.dead_zones
IF dead_zone_objects.length > 0:
    pathologies.append({
        name: "Мёртвая зона",
        severity: "warning",
        evidence: f"{dead_zone_objects.length} объектов никогда не доминируют",
        treatment: [
            "Усилить сырые значения",
            "Снизить стоимость (дешёвая альтернатива)",
            "Добавить уникальную ситуационную ценность",
            "Добавить синергию с популярными объектами"
        ]
    })

// ===== ПАТОЛОГИЯ 4: Обязательный выбор (божественный параметр) =====
mandatory_attrs = FIND_MANDATORY_ATTRIBUTES(objects)
IF mandatory_attrs.length > 0:
    pathologies.append({
        name: "Божественный параметр",
        severity: "warning",
        evidence: f"Атрибут '{mandatory_attrs[0]}' присутствует во всех оптимальных билдах",
        treatment: [
            "Усилить альтернативные атрибуты",
            "Добавить затраты на обязательный атрибут",
            "Ввести нетранзитивность (сильнее в одном контексте, слабее в другом)"
        ]
    })

// ===== ПАТОЛОГИЯ 5: Разрыв билдов =====
IF gameMode == "PvP":
    build_gap = CALC_BUILD_GAP(objects, TransitiveResult)
    IF build_gap.monotonically_increasing:
        pathologies.append({
            name: "Разрыв билдов",
            severity: "warning",
            evidence: "Разница между оптимальным и конкурентоспособным билдом растёт с уровнем",
            treatment: [
                "Мощность определяется в основном базовыми параметрами",
                "Навыки/атрибуты дают лишь небольшие бонусы",
                "Несколько уровней сложности (казуальный/нормальный/хардкор)"
            ]
        })

// ===== ПАТОЛОГИЯ 6: Инфляция =====
IF FeedbackStabilityResult.loops.some(l => l.name.contains("валюта") AND l.profile.type == "reinforcing"):
    pathologies.append({
        name: "Инфляция",
        severity: "warning",
        evidence: "Усиливающая петля в валютной системе",
        treatment: [
            "Добавить денежные стоки (налоги, износ)",
            "Экономические сбросы (сезонные обнуления)",
            "Ограничение максимального запаса валюты"
        ]
    })

// ===== ПАТОЛОГИЯ 7: Стагнация =====
stagnant_resources = FIND_STAGNANT_RESOURCES(resources, FeedbackStabilityResult)
IF stagnant_resources.length > 0:
    pathologies.append({
        name: "Стагнация",
        severity: "info",
        evidence: f"Ресурсы '{stagnant_resources}' накапливаются без возможностей траты",
        treatment: [
            "Добавить новые способы расходования ресурса",
            "Ввести устаревание (ресурс теряет ценность со временем)",
            "Добавить престиж-сброс (трата ресурса для долгосрочной выгоды)"
        ]
    })

// ===== ПАТОЛОГИЯ 8: Хрупкость =====
IF FeedbackStabilityResult.loops.some(l => l.risk_level == "critical" AND l.is_ecology):
    pathologies.append({
        name: "Хрупкость (brittleness)",
        severity: "warning",
        evidence: "Экологическая система с критическими петлями — может рухнуть при возмущении",
        treatment: [
            "Добавить буферные зоны (запасы прочности)",
            "Ввести множественные балансирующие петли",
            "Уменьшить амплитуду колебаний"
        ]
    })

ВЫХОД: PathologyReport = {
    pathologies: pathologies,
    critical_count: pathologies.filter(p => p.severity == "critical").length,
    warning_count: pathologies.filter(p => p.severity == "warning").length,
    info_count: pathologies.filter(p => p.severity == "info").length,
    priority_corrections: SORT(pathologies, BY=severity, DESC).map(p => ({
        pathology: p.name,
        treatments: p.treatment
    }))
}
```

### 3.4.9 Этап 7: Monte Carlo-валидация

**Цель**: Проверить результаты формального анализа через стохастическое моделирование. Monte Carlo-симуляция запускает тысячи виртуальных боёв/сессий и собирает статистику: частота побед каждого объекта, средняя длительность сессии, распределение ресурсов. Это «окончательная проверка», которая выявляет проблемы, не видные на уровне формул.

**Алгоритм**:

```
ВХОД: BalanceInput, TransitiveResult, IntransitiveResult, PathologyReport

// ===== ШАГ 7.1: Настройка симуляции =====
simulation_config = {
    num_iterations: 10000,            // Количество прогонов
    matchup_format: "1v1" | "team",   // Формат встречи
    random_seed: 42,                   // Для воспроизводимости
    logging_level: "summary"           // "summary" | "detailed" | "debug"
}

// ===== ШАГ 7.2: Запуск симуляции боёв =====
results = {
    win_rates: {},                     // объект → частота побед
    avg_duration: {},                  // объект → средняя длительность боя
    matchup_results: {},               // (i, j) → {wins_i, wins_j, draws}
    resource_distribution: {},         // объект → распределение ресурсов после боя
    comeback_rate: {}                  // объект → частота камбэков (выиграл из проигрышной позиции)
}

FOR iteration IN 0..simulation_config.num_iterations-1:
    // Случайный выбор двух объектов
    [obj_a, obj_b] = RANDOM_PAIR(objects)
    
    // Симуляция боя на основе атрибутов и вероятностей
    outcome = SIMULATE_COMBAT(obj_a, obj_b, {
        // Используем атрибуты: HP, урон, скорость, защита, и т.д.
        // Добавляем случайность: критический шанс, уклонение, и т.д.
        // Результат: победитель, длительность, остаток HP
    })
    
    // Агрегация результатов
    results.win_rates[outcome.winner] += 1
    results.matchup_results[(obj_a.id, obj_b.id)][outcome.winner] += 1
    results.avg_duration[outcome.winner] = 
        RUNNING_AVG(results.avg_duration[outcome.winner], outcome.duration)

// Нормализация
FOR EACH obj IN objects:
    results.win_rates[obj.id] /= simulation_config.num_iterations

// ===== ШАГ 7.3: Анализ результатов симуляции =====
win_rate_spread = MAX(results.win_rates.values()) - MIN(results.win_rates.values())

IF win_rate_spread > 0.3:
    ADD_CRITICAL(f"Разброс win-rate: {win_rate_spread*100:.0f}% — " +
                 f"значительный дисбаланс!")
    best = ARGMAX(results.win_rates)
    worst = ARGMIN(results.win_rates)
    ADD_CRITICAL(f"Лучший: {objects[best].name} ({results.win_rates[best]*100:.1f}% побед), " +
                 f"Худший: {objects[worst].name} ({results.win_rates[worst]*100:.1f}% побед)")

ELIF win_rate_spread > 0.15:
    ADD_WARNING(f"Разброс win-rate: {win_rate_spread*100:.0f}% — умеренный дисбаланс")

ELSE:
    ADD_INFO(f"Разброс win-rate: {win_rate_spread*100:.0f}% — хороший баланс")

// ===== ШАГ 7.4: Проверка формулы воспринимаемой сложности =====
// Воспринимаемая_сложность = (Cv + Cs) − (Pv + Ps)
FOR EACH level IN 1..targetLevels:
    perceived_difficulty = CALC_PERCEIVED_DIFFICULTY(level, objects, macro_model)
    // Если воспринимаемая сложность > 0 → ощущение вызова (хорошо для Вызова)
    // Если воспринимаемая сложность < 0 → ощущение лёгкости (хорошо для Подчинения)
    // Если воспринимаемая сложность ≈ 0 → баланс
    
    IF aestheticProfile.primary == "Вызов" AND perceived_difficulty < 0:
        ADD_WARNING(f"Уровень {level}: воспринимаемая сложность отрицательная — " +
                    f"слишком легко для игры с эстетикой Вызова")
    ELIF aestheticProfile.primary == "Подчинение" AND perceived_difficulty > 0.5:
        ADD_WARNING(f"Уровень {level}: воспринимаемая сложность слишком высокая — " +
                    f"фрустрирующе для игры с эстетикой Подчинения")

// ===== ШАГ 7.5: Сравнение с формальными результатами =====
// Сходятся ли результаты симуляции с формальным анализом?
formal_ranking = SORT(objects, BY=TransitiveResult.cp_ratio)
simulation_ranking = SORT(objects, BY=results.win_rates)

ranking_correlation = SPEARMAN_CORRELATION(formal_ranking, simulation_ranking)
IF ranking_correlation < 0.5:
    ADD_WARNING("Формальный рейтинг плохо коррелирует с результатами симуляции — " +
                "возможно, неучтённые взаимодействия между атрибутами")
    // AI-анализ расхождения
    discrepancy_report = AI_ANALYZE_DISCREPANCY(
        formal_ranking, simulation_ranking, objects, results
    )
    ADD_SUGGESTION(discrepancy_report)

// ===== ШАГ 7.6: Эмоциональная оценка чисел =====
// Формат чисел влияет на восприятие (Гэзэуэй, Кн. 9)
number_format_report = ANALYZE_NUMBER_FORMAT(objects, {
    "light_numbers": objects.filter(o => o.attributes.all(a => a % 5 == 0 OR a % 10 == 0)),
    "heavy_numbers": objects.filter(o => o.attributes.some(a => a % 5 != 0 AND a % 10 != 0)),
    "recommendation": aestheticProfile.primary == "Вызов" 
        ? "Используйте «тяжёлые» числа для напряжённости" 
        : "Используйте «лёгкие» числа для спокойствия"
})

ВЫХОД: MonteCarloResult = {
    config: simulation_config,
    win_rates: results.win_rates,
    avg_duration: results.avg_duration,
    matchup_matrix: results.matchup_results,
    win_rate_spread: win_rate_spread,
    ranking_correlation: ranking_correlation,
    perceived_difficulty_curve: CALC_DIFFICULTY_CURVE(objects, macro_model),
    number_format: number_format_report,
    balance_verdict: win_rate_spread < 0.15 ? "GOOD" : 
                     win_rate_spread < 0.30 ? "MODERATE" : "POOR"
}
```

### 3.4.10 Итоговая сборка: Профиль баланса

```typescript
interface BalanceProfile {
    // Входные данные
    balanceMap: BalanceMap;                        // Классификация задачи
    objects: BalanceObject[];                      // Объекты балансировки
    
    // Результаты анализов
    transitiveResult: TransitiveResult;            // Cost-power кривые
    intransitiveResult: IntransitiveResult;        // RPS-структуры
    situationalResult: SituationalResult;          // Контекстная ценность
    feedbackStability: FeedbackStabilityResult;    // Стабильность петель ОС
    pathologyReport: PathologyReport;              // Диагноз патологий
    monteCarloResult: MonteCarloResult;            // Симуляционная проверка
    
    // Агрегированные метрики
    overallBalanceScore: number;                   // 0-100, агрегированный балл
    criticalIssues: Issue[];                       // Критические проблемы
    warnings: Issue[];                             // Предупреждения
    suggestions: Suggestion[];                     // Рекомендации
    
    // Кривые прогрессии (если применимо)
    progressionCurves?: {
        xpCurve: CurveSpec;                        // XP → уровень
        powerCurve: CurveSpec;                     // Уровень → сила
        contentCurve: CurveSpec;                   // Контент по уровням
    };
    
    // Формулы для реализации
    formulas: {
        damageFormula: string;                     // Формула расчёта урона
        hpFormula: string;                         // Формула расчёта HP
        costFormula: string;                       // Формула расчёта стоимости
        difficultyFormula: string;                 // Формула воспринимаемой сложности
    };
    
    // Связь с другими алгоритмами
    progressionInput: ProgressionInput;            // Данные для алгоритма 3.5
    economyInput: EconomyInput;                    // Данные для алгоритма 3.6
}

// Расчёт агрегированного балла
function calcOverallBalanceScore(profile: BalanceProfile): number {
    let score = 100;
    
    // Штрафы за критические проблемы
    score -= profile.criticalIssues.length * 20;
    score -= profile.warnings.length * 5;
    
    // Штраф за разброс win-rate
    score -= profile.monteCarloResult.win_rate_spread * 100;
    
    // Бонус за сходимость формального и симуляционного анализа
    score += profile.monteCarloResult.ranking_correlation * 10;
    
    // Бонус за покрытие эстетик
    score += profile.transitiveResult.balanced.length * 2;
    
    return CLAMP(score, 0, 100);
}
```

### 3.4.11 AI-промпт-спецификации для алгоритма 3.4

#### Промпт ESTIMATE_WEIGHTS

```
SYSTEM: Ты — эксперт по балансу игр. Для данных игровых объектов определи вес 
каждого атрибута в единицах якорного ресурса. Вес отражает, насколько атрибут 
влияет на итоговую мощь объекта. Более важные атрибуты имеют больший вес.

Правила:
- Сумма весов для «ванильного» объекта = его стоимость
- Универсально полезные атрибуты (HP, урон) имеют больший вес
- Ситуационные атрибуты (стихийный урон, стелс) имеют меньший вес
- Ограничения = отрицательная стоимость

USER: Объекты: {objects}. Якорь: {anchor}. Жанр: {genre}.

OUTPUT FORMAT: JSON {"attribute": "weight_value", "reasoning": "..."}
```

#### Промпт EVALUATE_SITUATIONAL_VALUE

```
SYSTEM: Ты — эксперт по ситуационному балансу в играх. Оцени ценность объекта 
в конкретной игровой ситуации по шкале 0.0-2.0, где 1.0 = средняя ценность.

Критерии оценки:
- Насколько атрибуты объекта соответствуют требованиям ситуации?
- Есть ли синергии с типичными стратегиями в данной ситуации?
- Есть ли антагонизмы с условиями ситуации?

USER: Объект: {object}. Ситуация: {situation}. Жанр: {genre}. 
Другие объекты: {other_objects}.

OUTPUT FORMAT: JSON {"value": 0.0-2.0, "reasoning": "...", 
"dominant_attributes": ["..."], "weaknesses_in_situation": ["..."]}
```

#### Промпт SUGGEST_INTRANSITIVE_CORRECTIONS

```
SYSTEM: Ты — эксперт по нетранзитивному балансу. В игре обнаружена доминантная 
стратегия: объект {dominant_name} имеет долю выбора {share}% в равновесии Нэша. 
Предложи 3 варианта коррекции, которые восстановят RPS-структуру, не ломая 
существующие циклы.

Правила:
- Изменения должны быть минимальными (одно число на объект)
- Не ломать существующие RPS-циклы
- Цель: максимальная доля стратегии < 40%

USER: Матрица выигрышей: {payoff_matrix}. Объекты: {objects}. 
Доминант: {dominant}.

OUTPUT FORMAT: JSON [{"description": "...", "changes": [{"object": "...", 
"attribute": "...", "old_value": ..., "new_value": ...}], 
"expected_max_share": 0.0-1.0, "reasoning": "..."}]
```

#### Промпт ANALYZE_DISCREPANCY

```
SYSTEM: Ты — аналитик баланса игр. Формальный анализ (cost-power кривые) и 
Monte Carlo-симуляция дали расходящиеся результаты. Определи причину расхождения.

Типичные причины:
- Нелинейные взаимодействия между атрибутами (синергии)
- Скрытые RPS-структуры (объект формально слаб, но контрит лидера)
- Формат чисел (малые числа → большая волатильность)
- Неправильные веса атрибутов
- Эмергентные стратегии, не учтённые формальной моделью

USER: Формальный рейтинг: {formal_ranking}. Симуляционный рейтинг: {sim_ranking}.
Объекты: {objects}. Результаты симуляции: {sim_results}.

OUTPUT FORMAT: JSON {"likely_cause": "...", "confidence": 0.0-1.0,
"recommended_action": "...", "weight_adjustments": {"attr": new_weight}}
```

#### Промпт SELECT_BEST_CORRECTION

```
SYSTEM: Ты — геймдизайн-консультант. Для обнаруженной патологии баланса выбери 
наилучшую коррекцию из предложенных вариантов. Критерии выбора:
1. Минимальные изменения (не ломать работающие системы)
2. Максимальный эффект (решить проблему полностью)
3. Элегантность (коррекция должна ощущаться как часть игры, а не как заплатка)
4. Жанровое соответствие (некоторые коррекции неуместны в определённых жанрах)

USER: Патология: {pathology}. Варианты: {corrections}. Жанр: {genre}. 
Эстетика: {aesthetics}. Текущие механики: {mechanics}.

OUTPUT FORMAT: JSON {"selected": "correction_name", "reasoning": "...",
"implementation_notes": "...", "expected_side_effects": ["..."]}
```

---

## Связь между алгоритмами 3.3 и 3.4

Алгоритмы 3.3 и 3.4 образуют **тесно связанную пару**: MDA-генерация определяет, *какие* механики нужны, а балансировка проверяет, *насколько хорошо* они работают вместе. Данные передаются в обоих направлениях:

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   АЛГОРИТМ 3.3          │         │   АЛГОРИТМ 3.4          │
│   MDA-генерация         │ ──────→ │   Балансировка          │
│   механик               │  MDA    │                         │
│                         │  Profile│   Вход: MDA-профиль,   │
│   Выход: MDA-профиль    │         │   объекты, ресурсы     │
│   с набором механик     │         │                         │
│                         │ ←────── │   Выход: BalanceProfile │
│   Если балансировка     │ Feedback│   с диагнозом и         │
│   выявляет критические  │  loop   │   коррекциями           │
│   проблемы → итерация   │         │                         │
│   MDA-цикла             │         │                         │
└─────────────────────────┘         └─────────────────────────┘
           │                                    │
           ▼                                    ▼
   ┌──────────────────────────────────────────────────┐
   │   ЕДИНАЯ МОДЕЛЬ ПРОЕКТА (Project State)         │
   │                                                  │
   │   mdaProfile: MDAProfile                        │
   │   balanceProfile: BalanceProfile                │
   │   → Передача в алгоритмы 3.5, 3.6, 3.7        │
   └──────────────────────────────────────────────────┘
```

**Обратная связь**: Если балансировка (3.4) выявляет критические проблемы (runaway, доминантная стратегия, мёртвая зона), которые нельзя решить только числовой коррекцией, система возвращается к MDA-генерации (3.3) для замены проблемных механик. Это реализует принцип итеративного дизайна: не пытаться «залатать» фундаментально сломанную механику, а заменить её на более подходящую.
