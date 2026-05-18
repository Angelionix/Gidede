# Changelog

Все заметные изменения проекта Gidede документируются в этом файле.

Формат версионирования: **v.X.Y.Z**
- **X** (major) — мажорная версия; до релиза равна 0
- **Y** (minor) — минорная версия; увеличивается при добавлении нового функционала
- **Z** (patch) — патч-версия; увеличивается при доработке существующего функционала

---

## [0.16.0] — 2026-05-18

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 4 Backend — продолжение)
- Блок 4: Backend — Intransitive-анализ и ситуационный баланс — 4.C.2
  - **Этап 3: Нетранзитивный анализ (RPS-структуры)** (3.4.5)
    - Построение payoff-матрицы N×N (объекты × оппоненты, EV при встрече)
    - Антисимметричная матрица: M[i][j] = -M[j][i], диагональ = 0
    - Учёт стихийных преимуществ через теги объектов (ELEMENTAL_ADVANTAGES)
    - Обнаружение нетранзитивных (RPS) циклов: A > B > C > A
    - Поиск равновесия Нэша через итеративный метод multiplicative weights update
    - Выявление доминируемых стратегий (вероятность = 0 в равновесии)
    - Метрики баланса стратегий: энтропия, доля доминанта (max_share), коэффициент Джини
    - Обнаружение доминантной стратегии (доля > 50%) с AI-коррекциями через SUGGEST_INTRANSITIVE_CORRECTIONS
    - Проверка «КНБ со стоимостью» (эффект Шрайбера: усиление может снизить использование)
  - **Этап 4: Ситуационный анализ (контекстная ценность)** (3.4.6)
    - Жанровые ситуации: RPG (5), Action (5), Strategy/RTS (4), fallback — default
    - Оценка ценности каждого объекта в каждой ситуации (0.0–2.0, 1.0 = средняя)
    - Расчёт ожидаемой ситуационной ценности: EV = Σ P(ситуация) × Ценность
    - Классификация универсальность/специализация (порог spread = 0.3)
    - Обнаружение мёртвых зон (объекты, не доминирующие ни в одной ситуации)
    - Обнаружение доминантных универсальных объектов (EV > 1.2)
    - Оценка стоимости переключения (low/medium/high по жанру)
  - **Q-фактор анализ (Роллингс/Моррис, Кн. 12)**
    - Построение Q-матрицы: объекты × атрибуты (нормализация min-max 0–1)
    - Определение доминантных атрибутов для каждого объекта
    - Выявление избыточных объектов (не доминируют ни по одному атрибуту)
    - Расчёт оценки избыточности (0 = уникален, 1 = полностью избыточен)
    - Маппинг «атрибут → доминирующий объект»

#### Схемы данных (Блок 4 — Intransitive/Situational/Q-Factor)
- `IntransitiveResult` — результат нетранзитивного анализа (payoff_matrix, nash_equilibrium, rps_cycles, strategy_balance, warnings, suggestions)
- `StrategyBalanceScore` — метрики баланса стратегий (entropy, max_share, gini)
- `RPSCycle` — нетранзитивный цикл (cycle, strength)
- `SituationalResult` — результат ситуационного анализа (situations, situational_values, situational_ev, versatility_map, dead_zones, dominant_universals)
- `Situation` — игровая ситуация (name, probability)
- `VersatilityInfo` — универсальность/специализация (max_value, min_value, spread, type)
- `QFactorResult` — результат Q-фактор анализа (objects, redundant_objects, attribute_dominance, q_matrix)
- `QFactorObject` — Q-фактор одного объекта (name, dominant_attributes, is_redundant, redundancy_score)
- `BalanceResult` — расширен: добавлены поля intransitive_result, situational_result, q_factor_result

#### API
- POST `/api/v1/balance/intransitive` — нетранзитивный анализ баланса (payoff-матрица, Нэш, RPS-циклы)
- POST `/api/v1/balance/situational` — ситуационный анализ (EV, универсальность, мёртвые зоны)
- POST `/api/v1/balance/qfactor` — Q-фактор анализ (избыточные объекты, доминантные атрибуты)
- POST `/api/v1/balance/analyze` — обновлён: полный пайплайн Этапов 1–5 + Q-фактор с параметрами run_intransitive, run_situational, run_q_factor

#### Тесты
- 50+ тестов для BalanceService: classify (3), transitive (8), stability (3), intransitive (8), situational (8), q_factor (5), full pipeline (8), API (6), helpers (7)

### Изменено
- `balance_service.py` — расширен с Этапов 1–3 до Этапов 1–5 + Q-фактор (2175 строк)
- `balance_full()` — обновлён: добавлены параметры run_intransitive, run_situational, run_q_factor
- `services/__init__.py` — добавлен экспорт BalanceService
- `schemas/__init__.py` — добавлен экспорт balance schemas
- Версия обновлена с 0.15.0 до 0.16.0

---

## [0.15.0] — 2026-05-18

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 4 Backend)
- Блок 4: Backend — Transitive-анализ баланса — 4.C.1
  - **Этап 1: Классификация задачи балансировки** (3.4.3)
    - Определение доминирующей модели балансировки (transitive/intransitive/situational/mixed)
    - Выбор якорного ресурса (HP/Валюта/Победные очки/XP)
    - Определение типа суммы игры (positive/zero/negative)
    - Определение типа обратной связи (reinforcing/balancing/both)
    - Карта балансировки: 12 типов баланса Шелла с применимостью к проекту
  - **Этап 2: Транзитивный анализ (cost-power кривые)** (3.4.4)
    - Расчёт весов атрибутов через метод наименьших квадратов (на «ванильных» объектах)
    - AI-оценка весов через ESTIMATE_WEIGHTS промпт (при недостатке данных)
    - Равномерные веса как fallback
    - Расчёт мощности (Power) = взвешенная сумма атрибутов
    - Расчёт Cost/Power ratio и отклонения от кривой стоимости
    - 3 модели кривых: тождество (PvP), сдвинутая тождественная (PvPvE), прогрессия ценности (PvE)
    - Пороговые значения: PvP=10%, PvE=15%, casual=20%
    - Выявление переоценённых (overpowered), недооценённых (underpowered), сбалансированных и «идеальный дисбаланс» объектов
  - **Этап 3: Анализ стабильности петель ОС**
    - Матрица стабильности Шрайбера (3 типа суммы × 3 типа ОС = 9 комбинаций)
    - Обнаружение патологий: runaway, deadlock, stall
    - Рекомендации по коррекции нестабильности

#### Схемы данных (Блок 4)
- `BalanceObject` — игровой объект для балансировки (id, name, type, attributes, cost, tier, tags)
- `BalanceInput` — входные данные (objects, resources, balance_type, game_mode, genre)
- `ObjectBalanceReport` — отчёт по объекту (power, effective_cost, cp_ratio, distance_from_curve, status)
- `TransitiveResult` — результат транзитивного анализа (attribute_weights, cost_curve_model, objects, warnings, suggestions)
- `BalanceMap` — карта балансировки (primary/secondary models, anchor, game_sum, feedback)
- `BalanceResult` — итоговый результат (balance_map, transitive_result, stages_completed)

#### API
- POST `/api/v1/balance/transitive` — транзитивный анализ баланса
- POST `/api/v1/balance/analyze` — полный анализ балансировки (все этапы)
- GET `/api/v1/balance/{project_id}` — получение результатов балансировки проекта

#### Тесты
- 26 тестов для BalanceService: classify (3), transitive (8), stability (3), full pipeline (3), API (2), helpers (7)

### Изменено
- Версия обновлена с 0.14.0 до 0.15.0

---

## [0.14.0] — 2026-05-18

### Добавлено

#### Сквозной пайплайн UI (Фаза 4.B.12 — завершение)
- **Pipeline Data Flow Indicator** — визуальный индикатор потоков данных на страницах Блоков 1–3
  - Блок 1: индикатор «Блок 1 ← → Блок 2 → Блок 3» с кнопкой «Запустить пайплайн 1→2→3»
  - Блок 2: индикатор «Блок 1 → Блок 2 ← → Блок 3» с кнопкой «Загрузить из пайплайна»
  - Блок 3: индикатор «Блок 1 → Блок 2 → Блок 3 ←» с кнопкой «Загрузить из пайплайна»
- **Автозаполнение из пайплайна** для Блоков 2 и 3
  - Блок 2: при нажатии «Загрузить из пайплайна» автоматически заполняются conceptId, mechanics, genre из результатов Блока 1
  - Блок 3: при нажатии «Загрузить из пайплайна» автоматически заполняются conceptId, genre, primaryAesthetic, secondaryAesthetic, tertiaryAesthetic, existingMechanics, idea из результатов Блоков 1 и 2
  - Предупреждение если предыдущий блок не заполнен (например, «Блок 1 не заполнен»)
  - Индикатор «Данные из пайплайна» (зелёный бейдж) после успешной загрузки
- **Кнопка «Запустить пайплайн 1→2→3»** на странице Блока 1
  - Вызывает `POST /api/v1/pipeline/run-pipeline/{projectId}` с параметрами формы
  - Последовательно выполняет генерацию концепции → Core Loop → MDA-анализ
  - Показывает результат концепции и обновляет состояние пайплайна
  - Toast-уведомление при завершении

### Изменено
- Версия обновлена с 0.13.0 до 0.14.0

---

## [0.13.0] — 2026-05-18

### Добавлено

#### Сквозной пайплайн (Фаза 4.B.12)
- **Pipeline Service** — сервис автоматической передачи данных между блоками
  - Автоматическая передача: OnePager (Блок 1) → CoreLoopInput (Блок 2) → MDAInput (Блок 3)
  - Отслеживание статуса каждого блока: empty/in_progress/completed/stale
  - Вычисление процента заполненности проекта
  - Рекомендация следующего блока для заполнения
  - Генерация уведомлений об устаревших данных
- **Pipeline API** — 5 эндпоинтов для управления пайплайном
  - `GET /api/v1/pipeline/state/{project_id}` — состояние пайплайна (статусы блоков, stale-уведомления, прогресс)
  - `GET /api/v1/pipeline/prepare-input/{project_id}/{block_id}` — подготовка входных данных для блока из предыдущих
  - `POST /api/v1/pipeline/notify-updated` — уведомление об обновлении блока (публикация в Redis Event Bus)
  - `POST /api/v1/pipeline/run-pipeline/{project_id}` — запуск полного пайплайна 1→2→3
  - `DELETE /api/v1/pipeline/stale/{project_id}/{block_id}` — снятие stale-статуса
- **ProgressSidebar** — компонент sidebar с индикаторами прогресса пайплайна
  - Прогресс-бар заполненности проекта
  - Статус каждого блока с цветокодированием (пусто/в процессе/готов/устарел)
  - Tooltip с детальной информацией (время обновления, причина stale)
  - Индикатор «Рекомендуется заполнить следующим»
- **PipelineNotifications** — компонент уведомлений об устаревших данных
  - Предупреждения вида «Концепция обновлена. Рекомендуется пересчитать Core Loop»
  - Кнопка «Перейти к блоку» для быстрого перехода
  - Автоматическое отображение в layout-shell на всех страницах
- **usePipeline** — React-хук для работы с пайплайном
  - fetchState, prepareInput, notifyUpdated, clearStale
  - Периодическое обновление состояния (каждые 30 сек)
- **Stale-механизм через Redis Event Bus**
  - При обновлении Блока 1 → Блоки 2-8 помечаются как stale
  - При обновлении Блока 2 → Блоки 3-8 помечаются как stale
  - Stale-статус хранится в Redis с TTL 7 дней
- Интеграция pipeline-уведомлений в страницы Блоков 1-3
  - После успешной генерации автоматически вызывается `notify-updated`
  - Активный проект сохраняется в localStorage (`gidede_active_project`)

### Изменено
- Sidebar: обновлён с поддержкой runtime-статусов пайплайна
- LayoutShell: добавлена лента PipelineNotifications
- Версия обновлена с 0.12.0 до 0.13.0

---

## [0.12.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, Блок 3 UI)
- Блок 3: UI — MDA Lab — 4.B.11
  - **MDALabPage** — страница `/blocks/3` с полной формой ввода и 4 вкладками результатов
  - **ReverseMDAPanel** — вкладка «Reverse MDA» (Этапы 1–3)
    - Выбор целевой эстетики через 8 иконок ЛеБланка (sensation/fantasy/narrative/challenge/fellowship/discovery/expression/submission) с цветокодированием
    - Отображение целевых динамик (core/supporting/context) с обоснованием и предупреждениями
    - Индикатор уровня эмерджентности (nominal/weak/multiple/strong) с цветокодированным бейджем
    - AI-предложенные динамики с пометкой «AI» и обоснованием
    - Маппинг «Динамика → Механики» с непокрытыми динамиками, синергиями и конфликтами
    - Структурированный набор механик по 5 группам (base/combat/progression/spatial/social) с прогресс-барами совместимости и синергии
    - Покрытие эстетик с прогресс-барами и индикаторами достаточности
    - Обнаруженные паттерны Adams/Dormans с индикаторами присутствия и рекомендациями
  - **ClassicMDAPanel** — вкладка «Classic MDA» (Этап 4)
    - Карта сходимости эстетик с прогресс-баром и порогом 0.8
    - Совпадение по каждой эстетике (match_scores) с цветокодированием (зелёный/жёлтый/красный)
    - Карта предсказанных эстетических ценностей с бейджами
    - Смоделированный геймплей: последовательность шагов с потреблёнными/произведёнными ресурсами
    - Наблюдаемые динамики и петли обратной связи (усиливающие/балансирующие) с оценкой стабильности
    - Проверка устойчивости симуляции (stable/runaway/oscillation/stall)
    - Итеративная коррекция: количество итераций, рекомендации и предупреждения
  - **LensAuditPanel** — вкладка «Линзы Шелла» (Этап 5)
    - Общий score валидации с прогресс-баром
    - 9 приоритетных линз с категориями (целостность/эмерджентность/баланс/интерес)
    - Каждая линза: score, вопросы и ответы, обнаруженные проблемы, рекомендации
    - Цветокодирование карточек: зелёный (>=0.7), жёлтый (0.4–0.7), красный (<0.4)
    - Сводка: количество пройденных, предупреждений, критических проблем
  - **BondMatrixPanel** — вкладка «Матрица Бонда» (Этап 6)
    - Интерактивная таблица 4×3 (Механика/История/Эстетика/Технология × Фиксированный/Динамический/Культурный)
    - Горизонтальная согласованность по строкам с прогресс-барами
    - Вертикальная согласованность по столбцам с прогресс-барами и описаниями
    - Общая согласованность с цветокодированным процентом
    - Лудонарративный анализ: Гармония/Ирония/Диссонанс с цветокодированным бейджем
    - Пары «механика ↔ нарратив» с оценкой согласованности
    - Корректирующие рекомендации при иронии/диссонансе
  - Форма ввода: concept_id, genre, 3 эстетики, idea, существующие/обязательные/запрещённые механики, max_mechanics, convergence_threshold
  - Переключатель режима: полный анализ (Этапы 1–6) / краткий (Этапы 1–3)
  - Кнопка «Запустить MDA-анализ» → POST `/api/v1/mda/analyze`

#### Техдолг (TD-005, TD-012, TD-011)
- TD-005: Создан глоссарий унифицированных терминов RU/EN (`docs/glossary.md`)
- TD-012: Создан golden dataset для AI-промптов (`mini-services/api-service/tests/golden_dataset/`)
- TD-011: Создан CI/CD пайплайн GitHub Actions (локально `.github/workflows/ci.yml`, не может быть запушен — PAT без workflow scope)

### Изменено
- Sidebar: версия обновлена до v0.12.0
- Sidebar: Блок 3 статус обновлён с «Скелет» на «Активен»
- Версия обновлена с 0.11.0 до 0.12.0
- TD-005 → Resolved в TECH_DEBT.md
- TD-012 → Resolved в TECH_DEBT.md
- TD-011 → частично (файл создан, требуется push с полным доступом)
- DEFERRED-002 → Resolved (глоссарий создан)

### Тестовая документация
- Актуализирован полный перечень программных и UI тестов
- Добавлены тест-кейсы для MDA Lab UI (Блок 3)
- Добавлены тест-кейсы для ReverseMDAPanel, ClassicMDAPanel, LensAuditPanel, BondMatrixPanel
- Обновлён список frontend-тестов (Block 3 components)

---

## [0.11.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, Блок 3 Backend)
- Блок 3: Backend — MDA аналитический проход и валидация (Этапы 4–6) — 4.B.10
  - **Этап 4: Classic MDA — аналитический проход** (3.3.6)
    - Моделирование геймплея через SIMULATE_GAMEPLAY промпт (Machinations-модель)
    - Формализованный fallback при недоступности AI
    - Вывод динамик из симулированного геймплея
    - Вывод эстетики из наблюдаемых динамик (обратная таблица DYNAMICS_TO_AESTHETICS)
    - Сравнение с целевой эстетикой и проверка сходимости (convergenceThreshold=0.8)
    - Итеративная коррекция при несходимости (до maxIterations=3)
    - Проверка устойчивости симуляции (runaway/deadlock/stall/oscillation)
  - **Этап 5: Валидация через Линзы Шелла** (3.3.7)
    - Выбор 9 приоритетных линз: Тетрада (#9), Единство (#11), Резонанс (#12), Эмерджентность (#30), Пространство действий (#31), Треугольность (#40), Доминантная стратегия (#41), Кривая интереса (#69), Свобода vs управляемость (#74)
    - AI-оценка через APPLY_LENS_MDA промпт для каждой линзы
    - Формализованный fallback-оценка для каждой линзы при недоступности AI
    - Агрегация результатов: critical (<0.4), warnings (0.4–0.7), passed (>=0.7)
    - Общий score как среднее по всем линзам
  - **Этап 6: Матрица 4×3 Бонда + лудонарративный анализ** (3.3.8)
    - Заполнение матрицы 4×3 (Механика/История/Эстетика/Технология × Фиксированный/Динамический/Культурный)
    - Проверка горизонтальной согласованности (в каждой строке все 4 элемента)
    - Проверка вертикальной согласованности (Фиксированный → Динамический → Культурный)
    - Обнаружение лудонарративного диссонанса через CHECK_LUDONARRATIVE_MDA промпт
    - Результат: Гармония / Ирония / Диссонанс
    - Формализованный fallback при недоступности AI

#### Схемы данных (MDA Lab — Этапы 4–6)
- `GameplaySequenceStep` — шаг моделируемого геймплея (action, mechanics_used, resources)
- `ResourceFlow` — поток ресурсов (source, target, resource, flow_type)
- `FeedbackLoop` — петля обратной связи (positive/negative, stability)
- `StabilityCheck` — проверка устойчивости симуляции (stable, pathology, correction)
- `ClassicMDAResult` — результат Classic MDA прохода (observed_dynamics, predicted_aesthetics, match_scores, overall_match, converged)
- `LensResult` — результат применения одной линзы Шелла (lens_id, score, issues, suggestions)
- `LensValidation` — агрегация результатов 9 линз (critical_issues, warnings, overall_score)
- `BondMatrixCell` — ячейка матрицы 4×3 Бонда (element, level, content)
- `RowConsistency` — горизонтальная согласованность матрицы (level, score, dissonances)
- `ColumnConsistency` — вертикальная согласованность матрицы (element, score, description)
- `LudonarrativeCheck` — результат лудонарративного анализа (result, description, correction)
- `BondValidation` — итоговый результат матрицы Бонда (matrix, row/col_consistency, ludonarrative, overall_consistency)

#### API
- POST `/api/v1/mda/analyze` — обновлён: добавлен параметр `full_analysis` (default: True)
  - full_analysis=True: полный пайплайн Этапов 1–6
  - full_analysis=False: только Этапы 1–3 (Reverse MDA)
- MDAProfile расширен: добавлены поля classic_mda_result, lens_validation, bond_validation
- stages_completed теперь [1,2,3,4,5,6] при полном анализе

### Изменено
- `mda_service.py` — расширен с Этапов 1–3 до Этапов 1–6
- Добавлен метод `classic_mda_pass()` — Этап 4
- Добавлен метод `validate_lenses()` — Этап 5
- Добавлен метод `validate_bond_matrix()` — Этап 6
- Добавлен метод `analyze_full()` — полный пайплайн Этапов 1–6
- `mda.py` (schemas) — расширены модели для Этапов 4–6
- `MDAProfile` — добавлены поля: classic_mda_result, lens_validation, bond_validation
- Версия обновлена с 0.10.0 до 0.11.0

---

## [0.9.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, Блок 3 Backend)
- Блок 3: Backend — алгоритм MDA Lab (Этапы 1–3) — 4.B.9
  - **Этап 1: Reverse MDA — определение целевых динамик** (3.3.3)
    - Формализованный маппинг «Эстетика → Динамика» (8 эстетик × 4 динамики)
    - Жанровая фильтрация (предупреждения о нетипичных динамико-жанровых комбинациях)
    - AI-обогащение через SUGGEST_DYNAMICS промпт
    - Приоритизация: динамики, обслуживающие несколько эстетик, приоритетнее
    - Оценка эмерджентности: nominal/weak/multiple/strong (типология Фромма)
  - **Этап 2: Reverse MDA — маппинг «Динамика → Механики»** (3.3.4)
    - Генерация пула кандидатов из MechanicsDB (128 механик × 15 групп)
    - Паттерны Adams/Dormans (8 паттернов: Static/Dynamic Engine, Engine Building, Static Friction, Escalating Challenge/Complexity, Trade, Play-Style Reinforcement)
    - AI-расширение пула через SUGGEST_MECHANICS промпт
    - Перекрёстный анализ покрытия (coverage_map)
    - Оптимизация покрытия: жадная аппроксимация Set Cover
    - Добавление синергетических механик до max_mechanics
  - **Этап 3: Сборка и оптимизация набора механик** (3.3.5)
    - Обработка конфликтов: обязательная механика побеждает / больший coverage побеждает
    - Добавление обязательных механик (required_mechanics)
    - Удаление запрещённых механик (forbidden_mechanics)
    - Проверка покрытия эстетик (минимум 2 механики на эстетику)
    - Обнаружение паттернов Adams/Dormans (5 паттернов: Engine, Friction, Escalation, Engine Building, Trade)
    - Группировка механик по структурным ролям (base/combat/progression/spatial/social)
    - Расчёт compatibility_score и synergy_score
  - **Итеративный цикл**: maxIterations=3, convergenceThreshold=0.8

#### Схемы данных (MDA Lab)
- `DynamicItem` — динамика с метаданными (aesthetics_served, genre_fit, source, warning)
- `DynamicsTarget` — целевые динамики (core, supporting, context, emergence_level)
- `MechanicCandidate` — кандидат-механика (dynamics_affinity, genre_affinity, source)
- `MechanicCandidateSet` — набор кандидатов (mechanics, dynamics_coverage, uncovered_dynamics)
- `AestheticCoverage` — покрытие эстетики (count, sufficient)
- `AdamsDormansPattern` — обнаруженный паттерн (present, supporting_mechanics, suggestion)
- `StructuredMechanicSet` — структурированный набор (5 групп + метаданные)
- `MDAProfile` — итоговый профиль MDA (Этапы 1–3)

#### API
- POST `/api/v1/mda/analyze` — MDA-анализ (Этапы 1–3), заменена заглушка на полную реализацию

### Изменено
- Sidebar: Блок 3 «MDA Lab» статус изменён с «Скелет» на «Активен»
- Sidebar: версия обновлена до v0.9.0
- Главная страница: Блок 3 статус обновлён с «skeleton» на «active»
- Версия обновлена с 0.8.0 до 0.9.0

### Тестовая документация
- Актуализирован полный перечень программных и UI тестов
- Добавлены тест-кейсы для MDA Service — Этап 1: Целевые динамики (B-172–B-182)
- Добавлены тест-кейсы для MDA Service — Этап 2: Маппинг динамик (B-183–B-194)
- Добавлены тест-кейсы для MDA Service — Этап 3: Сборка набора (B-195–B-212)
- Добавлены тест-кейсы для полного пайплайна MDA (B-213–B-218)
- Добавлены тест-кейсы для API MDA Lab (B-219–B-223)
- Добавлены тест-кейсы для UI MDA Lab (F-36–F-44, UI-25, UI-26)

---

## [0.8.0] — 2026-05-18

### Добавлено

#### Основные модули (Фаза 4.B, Блок 2 UI)
- Блок 2: UI — Core Loop Designer — 4.B.8
  - **CoreLoopDesignerPage** — страница `/blocks/2` с полной формой ввода и отображением результатов
  - **StructuralTypeCard** — карточка структурного типа (type, sub_type, resources, braking, currencies, risk_assessment)
    - Визуализация типа (Engine/Economy/Ecology/Hybrid) с цветокодированными бейджами
    - Индикатор наличия тормозящего механизма (drain)
    - Список валют и ресурсов с классификацией (Valued/Commodity/Subsidiary)
    - Оценка рисков (likely_pathologies, risk_level, mitigation_suggestions)
  - **CoreLoopDiagram** — визуальная круговая диаграмма шагов Core Loop
    - CSS-based круговая раскладка с SVG-стрелками между шагами
    - Цветокодирование feedback_type (positive/negative/neutral)
    - Детальный список шагов с потребляемыми и производимыми ресурсами
  - **LoopHierarchyTree** — сворачиваемое дерево иерархии петель (6 уровней)
    - Micro (мс-с) → Small (1-2 мин) → Medium (5-10 мин) → Large (15-30 мин) → Macro (часы) → Meta (недели-месяцы)
    - Раскрываемые секции с действиями каждой петли
    - Индикация родительского шага (parent_step)
  - **PathologyPanel** — панель диагностики патологий (7 типов)
    - Цветовая индикация severity (critical/warning/info)
    - Описание патологии и корректирующее действие
    - Сводка: всего патологий, критических
  - **ValidationPanel** — панель валидации Core Loop (5 критериев)
    - Тест «30 секунд веселья» (Кн. 7)
    - Замкнутость петли (последний шаг → первый)
    - Достаточность ресурсов (мёртвые ресурсы, потребляемые без источника)
    - Отсутствие критических патологий
    - Корректное число шагов (3–7)
    - Прогресс-бар и overall_passed индикатор
  - **RecommendationsPanel** — панель рекомендаций (Этап 5)
    - Приоритеты (high/medium/low) с цветокодированием
    - Категории (fun/closedness/resource/pathology/structure)
    - Источник (формализованная / AI)
  - Форма ввода: concept_id, mechanics, genre, desired_loop_type, custom_steps
  - Кнопка «Проектировать Core Loop» → POST `/api/v1/coreloop/design`

#### Безопасность (Техдолг TD-017)
- JWT_SECRET_KEY: удалено захардкоженное dev-значение из config.py
  - Новый `settings.jwt_secret` property: в production обязателен env, в dev — auto-generated с warning
  - security.py обновлён для использования `settings.jwt_secret`
  - RuntimeError в production при отсутствии JWT_SECRET_KEY env-переменной

### Изменено
- Sidebar: Блок 2 «Core Loop Designer» статус изменён с «Скелет» на «Активен»
- Sidebar: версия обновлена до v0.8.0
- Главная страница: Блок 2 статус обновлён с «skeleton» на «active»
- Версия обновлена с 0.7.0 до 0.8.0
- TD-017 → Resolved в TECH_DEBT.md

### Тестовая документация
- Актуализирован полный перечень программных и UI тестов
- Добавлены тест-кейсы для Core Loop Designer UI (Блок 2)
- Добавлены тест-кейсы для StructuralTypeCard, CoreLoopDiagram, LoopHierarchyTree
- Добавлены тест-кейсы для PathologyPanel, ValidationPanel, RecommendationsPanel
- Обновлён список frontend-тестов (Block 2 components)

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
