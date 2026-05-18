# Changelog

Все заметные изменения проекта Gidede документируются в этом файле.

Формат версионирования: **v.X.Y.Z**
- **X** (major) — мажорная версия; до релиза равна 0
- **Y** (minor) — минорная версия; увеличивается при добавлении нового функционала
- **Z** (patch) — патч-версия; увеличивается при доработке существующего функционала

---

## [0.7.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, Блок 2 Backend)
- Блок 2: Backend — валидация Core Loop и рекомендации (Этапы 4–5) — 4.B.7
  - **Этап 4: Валидация Core Loop** — 5 критериев чек-листа:
    - Тест «30 секунд веселья» (Кн. 7) — формализованная оценка FUN-фактора
    - Проверка замкнутости петли (последний шаг → первый) через ресурсы, механики и семантику
    - Проверка достаточности ресурсов — выявление «мёртвых» ресурсов и потребляемых без источника
    - Проверка на отсутствие критических патологий
    - Проверка корректного числа шагов (3–7)
  - **Этап 5: Рекомендации** — AI-генерация рекомендаций через GENERATE_RECOMMENDATIONS промпт
    - Формализованные рекомендации на основе результатов валидации
    - Формализованные рекомендации на основе патологий
    - Структурные рекомендации (например, Engine без торможения)
    - AI-обогащение через GENERATE_RECOMMENDATIONS

#### Схемы данных (Валидация Core Loop)
- `FunCheckResult` — результат теста «30 секунд веселья» (passed, score, reasoning)
- `LoopClosednessCheck` — проверка замкнутости петли (is_closed, connection_description)
- `ResourceSufficiencyCheck` — проверка достаточности ресурсов (dead_resources, unsourced_consumables)
- `CoreLoopValidationResult` — итоговый результат валидации (5 критериев, score, overall_passed)
- `Recommendation` — рекомендация по улучшению (target, recommendation, priority, category, source)

#### API
- POST `/api/v1/coreloop/design` — обновлён: полный пайплайн Этапов 1–5 с валидацией и рекомендациями

### Изменено
- `coreloop_service.py` — полный пайплайн Этапов 1–5
- `design_full()` теперь включает validate_core_loop() и generate_recommendations()
- API `/design` возвращает validation и stages_completed=[1,2,3,4,5]
- Версия обновлена с 0.6.0 до 0.7.0

---

## [0.6.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, Блок 1 UI + Блок 2 Backend)
- Блок 1: UI — отображение результата концепции — 4.B.5
  - **OnePagerCard** — карточка One-Pager с 8 полями (title, platform, target_audience, rating, story_synopsis, gameplay_description, unique_features, competitors)
  - **AestheticProfileView** — визуализация 3 эстетик с цветокодированными бейджами (8 типов ЛеБланка с иконками) и обоснованием
  - **MechanicSetView** — список механик по группам (base/combat/progression/spatial/social) с индикаторами совместимости, прогресс-баром compatibility_score, предупреждениями о конфликтах и синергиях
  - **CoreLoopCandidates** — 3 варианта Core Loop для выбора с номерованными шагами, типом петли, тестом «30 секунд веселья» и оценкой длительности
  - **USPCandidates** — 3 варианта USP для выбора с проверкой Triangle of Weirdness (weird/appealing/credible)
  - **ValidationReportView** — результаты валидации с цветовой индикацией (зелёный/жёлтый/красный), 3 валидатора, предупреждения и предложения
  - Выбор Core Loop и USP пользователем — сохранение в Project State

- Блок 2: Backend — алгоритм Core Loop Designer (Этапы 1–3) — 4.B.6
  - **Этап 1: Классификация структурного типа** — определение Engine/Economy/Ecology/Hybrid по двум осям (тип петель × тип взаимодействия ресурсов)
    - Определение подтипа: braked_engine, pure_engine, multi_currency_economy, single_currency_economy, и др.
    - Определение ресурсов из MechanicsDB и концепции
    - Оценка рисков (RiskProfile) — вероятные патологии и уровень риска
  - **Этап 2: Конструирование иерархии петель** — 6-уровневая иерархия (микро → мета)
    - Уровни: micro (мс-с), small (1-2 мин), medium (5-10 мин), large (15-30 мин), macro (часы), meta (недели-месяцы)
    - AI-генерация внутренних петель через DECOMPOSE_STEP промпт
    - AI-генерация внешних петель через GENERATE_OUTER_LOOPS промпт
    - AI-генерация мета-петли через GENERATE_META_LOOP промпт
    - Формализованные fallback-модели при недоступности AI
  - **Этап 3: Диагностика патологий** — проверка на 7 патологий:
    - Runaway — бесконечный рост ресурса
    - Deadlock — замкнутый тупик
    - Stall — петля останавливается
    - Brittleness — хрупкость (одно изменение ломает всё)
    - Oscillation — колебание между состояниями
    - Stagnation — отсутствие прогресса
    - Triviality — тривиальность решений
    - Формализованные правила обнаружения + AI-обогащение через GENERATE_RECOMMENDATIONS

#### Схемы данных (Core Loop)
- `CoreLoopStep` — шаг Core Loop (action, mechanics, resources_consumed, resources_produced, feedback_type, duration_estimate)
- `ResourceProfile` — профиль ресурса (name, class, type, initial_value, bounds)
- `RiskProfile` — профиль рисков (likely_pathologies, risk_level, mitigation_suggestions)
- `StructuralType` — классификация структурного типа (type, sub_type, resources, loops, has_braking, currencies, risk_assessment)
- `LoopProfile` — профиль петли (level, actions, time_scale, parent_step)
- `LoopHierarchy` — 6-уровневая иерархия петель (micro, small, medium, large, macro, meta)
- `Pathology` — обнаруженная патология (name, type, severity, affected_resources, description, correction)
- `PathologyReport` — отчёт по патологиям (pathologies, total_count, critical_count)
- `CoreLoopProfile` — итоговый профиль Core Loop (structural_type, steps, inner/outer/meta loops, pathologies, recommendations, loop_hierarchy)

#### API
- POST `/api/v1/coreloop/design` — проектирование Core Loop (Этапы 1–3), заменена заглушка на полную реализацию

### Изменено
- Sidebar: Блок 2 «Core Loop Designer» статус изменён с «Скелет» на «Активен»
- Sidebar: версия обновлена до v0.6.0
- Блок 1 страница: Badge обновлён с «Реализация 4.B.1–4.B.2» до «Реализация 4.B.1–4.B.5»
- Версия обновлена с 0.5.0 до 0.6.0

### Тестовая документация
- Актуализирован полный перечень программных и UI тестов
- Добавлены тест-кейсы для Core Loop Designer (Этапы 1–3)
- Добавлены тест-кейсы для UI-компонентов отображения результата концепции
- Обновлён список API-тестов (coreloop/design)

---

## [0.5.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, завершение Блока 1)
- Блок 1: Backend — валидация концепции и сборка One-Pager (Этапы 6–7) — 4.B.4
  - **Этап 6: Валидация концепции** — 3 формальных валидатора:
    - Валидатор 1: Triangle of Weirdness (Кн. 8, Роджерс) — оценка «странности» по 3 осям (Персонажи, Мир, Активности)
    - Валидатор 2: 5 вопросов кор-геймплея (Кн. 10, Гэри) — проверка полноты Core Loop
    - Валидатор 3: 8 фильтров идеи (Кн. 1, Шелл) — проверка жизнеспособности концепции
    - Каждый валидатор возвращает score (0–1) + warnings + suggestions
    - Агрегированный overall_score и overall_passed (порог 0.6)
  - **Этап 7: Сборка One-Pager** — итоговый документ концепции (8 полей Роджерса + Gidede):
    - AI-генерация story_synopsis и gameplay_description через ASSEMBLE_ONE_PAGER промпт
    - Автоматическая оценка возрастного рейтинга (ESRB)
    - Расчёт score уникальности комбинации (0–100)
    - Полная структура OnePager со вложенными профилями и отчётом валидации

#### Схемы данных
- `ValidationResult` — результат одного валидатора (score, passed, warnings, suggestions, details)
- `ValidationWarning` — предупреждение валидатора (validator, code, message, severity)
- `ValidationSuggestion` — предложение по улучшению (validator, target, suggestion, priority)
- `ValidationReport` — полный отчёт валидации (3 валидатора + агрегация)
- `OnePager` — итоговый документ концепции (8 полей Роджерса + эстетика + динамики + механики + Core Loop + USP + валидация + мета)

#### AI-промпты
- `VALIDATE_TRIANGLE` — AI-валидация Triangle of Weirdness (Кн. 8)
- `VALIDATE_IDEA_FILTERS` — AI-валидация 8 фильтров идеи (Кн. 1)
- `ASSEMBLE_ONE_PAGER` — AI-генерация описаний для One-Pager (story_synopsis, gameplay_description)

#### API
- POST `/api/v1/concept/generate` — обновлён: полный пайплайн Этапов 1–7 с OnePager
- POST `/api/v1/concept/{concept_id}/validate` — отдельная валидация (Этап 6)
- completion_percent обновлён с 30% до 100% после завершения Этапов 6–7

### Изменено
- `concept_service.py` — полный пайплайн Этапов 1–7
- `generate_full()` теперь включает validate_concept() и assemble_one_pager()
- API `/generate` возвращает полный OnePager с validation_report и all stages completed
- Версия обновлена с 0.4.0 до 0.5.0

### Тестовая документация
- Актуализирован полный перечень программных и UI тестов (покрытие всего функционала)
- Добавлены тест-кейсы для валидации концепции (Этап 6)
- Добавлены тест-кейсы для сборки One-Pager (Этап 7)
- Обновлён список API-тестов

---

## [0.3.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, продолжение)
- Блок 1: Backend — алгоритм генерации концепции (Этапы 4–5) — 4.B.3
  - **Этап 4: Выбор механик из MechanicsDB** — 7-шаговый процесс:
    - Шаг 1: Выбор базовых механик (Группа 1: 9 механик) с ограничениями
    - Шаг 2: Выбор боевых механик (Группы 4, 8) с жанровой специализацией
    - Шаг 3: Выбор прогрессионных механик (Группы 2, 9) с жанровой специализацией
    - Шаг 4: Выбор пространственных механик (Группы 3, 5, 11) с эстетической адаптацией
    - Шаг 5: Выбор социальных/информационных механик (Группы 7, 14)
    - Шаг 6: Валидация совместимости (конфликты, синергии, запрещённые механики)
    - Шаг 7: Финальный набор механик с compatibility_score
  - **Этап 5: Генерация Core Loop и USP**
    - Определение структурного типа Core Loop (Engine/Economy/Ecology/Hybrid)
    - Генерация 3 вариантов Core Loop через GENERATE_CORE_LOOPS промпт (с fallback)
    - Генерация 3 вариантов USP через GENERATE_USP промпт (с fallback, Triangle of Weirdness)

#### MechanicsDB
- Создана полная база данных игровых механик — **128 механик в 15 группах** (SW.BAND, Кн. 15)
  - Группа 1: Базовые (9) — Изучение мира, Враги, Здоровье и др.
  - Группа 2: Прогрессия (9) — Очки опыта, Перки, Характеристики и др.
  - Группа 3: Пространство (9) — Карта мира, Альтернативы, Тайники и др.
  - Группа 4: Боевые (9) — Броня, Комбо, Уклонение и др.
  - Группа 5: Движение (9) — Прыжки, Рывок, Гравитация и др.
  - Группа 6: Экономика (9) — Крафт, Торг, Зелья и др.
  - Группа 7: Социальные (8) — Кооперация, Нарратив, Репутация и др.
  - Группа 8: Стелс (7) — Стелс и прятки, Тени, Маскировка и др.
  - Группа 9: Навыки (9) — Классы, Магия, Алхимия и др.
  - Группа 10: Время (8) — Цикл день/ночь, Таймер, Сезоны и др.
  - Группа 11: Территория (9) — Захват территории, Туман войны и др.
  - Группа 12: Сюжет (8) — Выбор сюжета, Фракции, Компаньоны и др.
  - Группа 13: Выживание (8) — Голод, Пермасмерть, Сохранения и др.
  - Группа 14: Информация (9) — Миникарта, Сканирование и др.
  - Группа 15: Мета (8) — Модификации, Сезонный пропуск и др.
- Каждая механика содержит: описание, dynamics_served, aesthetics_served, genre_affinity, conflicts_with, synergies_with

#### Схемы данных
- `MechanicSet` — Pydantic-модель набора механик (base/combat/progression/spatial/social + метаданные)
- `CoreLoopCandidate` — Pydantic-модель кандидата Core Loop (name, steps, loop_type, fun_check)
- `USPCandidate` — Pydantic-модель кандидата USP (usp, triangle_check, competitive_differentiation)

#### API
- POST `/api/v1/concept/generate` — обновлён: теперь выполняет полный пайплайн Этапов 1–5 (ранее 1–3)
- В ответе заполнены mechanic_set, core_loop_candidates, usp_candidates
- completion_percent обновлён с 10% до 30%

### Изменено
- `concept_service.py` — расширен с Этапов 1–3 до Этапов 1–5
- Добавлен метод `generate_full()` — полный пайплайн Этапов 1–5
- Добавлен метод `generate_stages_4_5()` — пайплайн Этапов 4–5
- Добавлен метод `select_mechanics()` — Этап 4 (7-шаговый процесс)
- Добавлен метод `generate_core_loops()` — Этап 5.1
- Добавлен метод `generate_usp()` — Этап 5.2
- API-эндпоинт `/generate` теперь возвращает `status: "stages_1_5_completed"`

---

## [0.1.0] — 2026-05-18

### Добавлено

#### Инфраструктура (Фаза 4.A)
- Инициализация монорепозитория с Docker Compose (Next.js, FastAPI, PostgreSQL, Redis) — 4.A.1
- Настройка Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui — 4.A.2
- Настройка FastAPI + модульная структура backend-проекта — 4.A.3
- Схема PostgreSQL (Project State): 14+ таблиц, Alembic-миграции — 4.A.4
- JWT авторизация (access + refresh токены), регистрация, логин — 4.A.5
- CRUD для проектов: API + UI управления проектами — 4.A.6
- AI-сервис (PromptExecutor): маршрутизация, кэширование, fallback, валидация — 4.A.7
- Реестр промптов (PROMPT_REGISTRY): 31 PromptSpec, валидация, логирование — 4.A.8
- Redis: кэш промптов, сессии, Pub/Sub Event Bus — 4.A.9
- pgvector + RAG-сервис: векторный поиск, эмбеддинги, обогащение промптов — 4.A.10
- Локальная тестовая инфраструктура: pytest, vitest, pre-commit hooks — 4.A.11
- Shared-модели и типы (TypeScript + Python): синхронизация типов — 4.A.12

#### Основные модули (Фаза 4.B, начало)
- Блок 1: UI Генератора концепции — страница ввода `/blocks/1` — 4.B.1
- Блок 1: Backend — алгоритм генерации концепции (Этапы 1–3): классификация жанра, извлечение эстетик, вывод динамик — 4.B.2

#### Документация
- Анализ 17 книг по геймдизайну (`docs/анализ/`)
- Концепция программы (`docs/концепт/`)
- 10 алгоритмических спецификаций (`docs/Алгоритмы/`)
- Архитектурные документы по субфазам 4.A (`docs/архитектура/`)
- Тестовая документация (`docs/тестирование/`)
- Дорожная карта Фазы 4 (`docs/ROADMAP_PHASE4.md`)
- Технический долг (`docs/TECH_DEBT.md`)
- Реестр источников — Библия геймдизайна (`docs/bible/`, `docs/BOOKS_REGISTRY.md`)
