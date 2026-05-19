# Changelog

Все заметные изменения проекта Gidede документируются в этом файле.

Формат версионирования: **v.X.Y.Z**
- **X** (major) — мажорная версия; до релиза равна 0
- **Y** (minor) — минорная версия; увеличивается при добавлении нового функционала
- **Z** (patch) — патч-версия; увеличивается при доработке существующего функционала

---

## [0.31.1] - 2026-05-19

### Added
- **4.D.2**: GDD Service Этапы 4-5 (алгоритм 3.7)
  - `generate_ai_sections()` — AI-обогащение автозаполненных секций (ENRICH_SECTION) и генерация с нуля (GENERATE_CHARACTERS_SECTION, GENERATE_VISUAL_STYLE, GENERATE_STORY_SECTION, GENERATE_CONTROLS_SECTION, GENERATE_WORLD_STRUCTURE)
  - `generate_manual_skeletons()` — генерация скелетов ручных секций с AI-подсказками (AI_GENERATE_SECTION_HINTS), приоритизация critical/important/optional
  - `generate_stages_1_5()` — полный пайплайн Этапов 1-5
  - 7 GDD-промптов и 4 валидационных промпта добавлены в PROMPT_REGISTRY
  - 35 новых тестов для Этапов 4-5 (итого 107 тестов для GDD Service)

### Resolved
- TD-003: Скрипт извлечения текста из PDF полностью покрывает потребность (PyMuPDF + чанкование)
- DEFERRED-004: 11 GDD/валидационных промптов добавлено в registry (partially resolved)

---

## [0.31.0] — 2026-05-19

### Добавлено

#### Блок 6: GDD Generator — Этапы 1–3 (алгоритм 3.7, задача 4.D.1)
- **GDDService** — сервис генерации структуры GDD с 3 этапами:
  - **Этап 1: Определение формата GDD** (алгоритм 3.7.3)
    - 8 форматов документации: one_sheet, ten_pager, treatment, sketch_design, full_gdd, concept_doc, narrative_bible, modular
    - Эвристика: audience → format (investor→treatment, production→full_gdd, personal→modular, team_sync→sketch_design, educational→ten_pager)
    - Эвристика: project stage → format (concept→one_sheet, prototype→ten_pager, preproduction→sketch_design, production→full_gdd, live_ops→modular)
    - 25 жанровых маппингов для определения уровня детализации (overview/standard/detailed/exhaustive)
    - Оценка количества страниц с множителями по detail_level
  - **Этап 2: Маппинг Project State → секции GDD** (алгоритм 3.7.4)
    - 67 маппингов секций на данные Project State (38 стандартных секций + 29 формат-специфичных)
    - 8 блоков: Overview(6), Gameplay(8), Characters/Narrative(5), Levels/World(4), Economy/Progression(4), UI/Visual(4), Multiplayer/Social(3), Technical/Business(4)
    - Проверка готовности каждой секции: ready / ai_generatable / ai_suggestable / manual_required
    - Расчёт coverage_score = auto_fillable / total
  - **Этап 3: Автозаполнение секций** (алгоритм 3.7.5)
    - Детерминированное извлечение данных из 6 блоков Project State
    - Форматирование контента в Markdown
    - Генерация диаграмм (Core Loop, System Map, Economy)
    - Генерация таблиц (баланс, механики, ресурсы)
    - Извлечение формул (прогрессия, сложность)
    - Флаг requires_review для секций с ai_enrich

#### Схемы данных (Блок 6 — GDD)
- `GDDFormatSpec` — спецификация формата GDD
- `SectionMapping` — маппинг секции на источник данных
- `SectionReadiness` — статус готовности секции
- `GDDDataMapping` — результат маппинга Project State → GDD
- `SectionContent` — содержимое заполненной секции
- `AutoFilledSections` — результат автозаполнения
- `GDDGenerationInput` — входные данные для генерации GDD
- `GDDConstraints` — ограничения генерации
- `GDDProfile` — итоговый профиль GDD

#### API
- POST `/api/v1/gdd/format` — Этап 1: определение формата GDD
- POST `/api/v1/gdd/map` — Этап 2: маппинг Project State → секции
- POST `/api/v1/gdd/auto-fill` — Этап 3: автозаполнение секций
- POST `/api/v1/gdd/generate` — полный пайплайн Этапов 1–3

#### Тесты
- 72 теста для GDDService: Stage 1 (22), Stage 2 (12), Stage 3 (16), Full Pipeline (8), Edge Cases (14)

### Изменено
- Версия обновлена с 0.30.0 до 0.31.0
- ROADMAP_PHASE4.md — задача 4.D.1 отмечена как завершённая (✅)
- Тестовая документация актуализирована: 303 теста backend (было 231), 72 теста GDD

---

## [0.30.0] — 2026-05-19

### Рефакторинг — SOLID/KISS/DRY/YAGNI

Кодовой аудит и рефакторинг frontend по результатам анализа техдолга. Все 6 задач из чек-листа выполнены или подтверждены как уже выполненные.

#### P0 — T6: noImplicitAny: true ✅ (уже было)
- `tsconfig.json` уже содержал `strict: true` и `noImplicitAny: true`
- `tsc --noEmit` проходит с нулём ошибок
- В кодовой базе нет `any`, `@ts-ignore`, `@ts-nocheck`

#### P1 — T3: ProjectState ISP-сплит ✅ (уже было)
- `shared/types/typescript/interfaces.ts` уже содержит 8 блочных интерфейсов (ConceptBlock, CoreLoopBlock, MDAProfileBlock, BalanceBlock, ProgressionBlock, EconomyBlock, GDDBlock, ValidationBlock), композитно объединённых в ProjectState

#### P2 — T1: SRP-сплит мега-компонентов ✅ (выполнено)
Разделение 5 блоков-страниц (8416 строк → 1901 строка в page.tsx):

| Блок | Было | Стало | Подкомпонентов |
|------|------|-------|----------------|
| Block 4 (Баланс) | 2076 | 380 | 6 (ObjectForm, TransitiveAnalysisTab, PayoffMatrixTab, SimulationChartsTab, MachinationsVisualizationTab, CorrectionsPanelTab) |
| Block 5 (Прогрессия/Экономика) | 1887 | 502 | 10 (5 progression + 5 economy tabs) |
| Block 1 (Концепция) | 1645 | 302 | 9 (OnePagerCard, AestheticBadge, AestheticProfileView, MechanicSetView, CoreLoopCandidates, USPCandidates, ValidationReportView, ConceptForm, DynamicsProfileCard, SelectionSummary) |
| Block 3 (MDA) | 1601 | 269 | 5 (AestheticIcon, ReverseMDAPanel, ClassicMDAPanel, LensAuditPanel, BondMatrixPanel) + MDAInputForm |
| Block 2 (Core Loop) | 1207 | 448 | 6 (StructuralTypeCard, CoreLoopDiagram, LoopHierarchyTree, PathologyPanel, ValidationPanel, RecommendationsPanel) |

Создана структура директорий:
- `src/components/gidede/shared/` — 4 переиспользуемых компонента (NodeTypeIcon, WarningsList, SuggestionsList, EmptyStateCard)
- `src/components/gidede/balance/` — 6 подкомпонентов + barrel
- `src/components/gidede/progression/` — 5 подкомпонентов + barrel
- `src/components/gidede/economy/` — 5 подкомпонентов + barrel
- `src/components/gidede/concept/` — 9 подкомпонентов + barrel
- `src/components/gidede/mda/` — 5 подкомпонентов + barrel
- `src/components/gidede/coreloop/` — 6 подкомпонентов + barrel
- `src/types/` — 6 файлов типов (balance, concept, coreloop, economy, mda, progression)
- `src/constants/` — 6 файлов констант (balance, concept, coreloop, economy, mda, progression)

#### P3 — T5: GENRES/AESTHETICS → config/ ✅ (уже было)
- `src/config/genres.ts` и `src/config/aesthetics.ts` уже централизованы

#### P3 — T2: Удаление неиспользуемых зависимостей ✅ (выполнено)
Удалено 5 npm-пакетов: `sharp`, `zustand`, `sonner`, `next-themes`, `@radix-ui/react-scroll-area`
Удалено 2 осиротевших UI-файла: `sonner.tsx`, `scroll-area.tsx`

#### P4 — T4: error.tsx, loading.tsx, middleware.ts ✅ (уже было)
- Все три файла уже реализованы корректно

### Устранено дублирование
- `NodeTypeIcon` — была копия в блоках 4 и 5, теперь общий компонент
- `SEVERITY_COLORS` — была копия в блоках 3 и 5, теперь общий `src/constants/economy.ts`
- Повторяющиеся паттерны WarningsList/SuggestionsList/EmptyStateCard заменены общими компонентами

### Тесты
- Обновлён `components.test.tsx`: удалён мок `next-themes` (удалён), добавлены тесты для 4 shared-компонентов
- 16/16 тестов проходят

### Изменено
- Версия обновлена с 0.29.0 до 0.30.0

---

## [0.27.0] — 2026-05-19

### Добавлено

#### Интеграционные тесты полного пайплайна (4.C.10)
- Создан `tests/integration/test_full_pipeline.py` — 22 интеграционных теста для сквозного пайплайна Блоки 1–5
  - **INT-01**: Полный пайплайн «Roguelike про алхимика» с mock AI — все 5 блоков заполнены, нет null-ошибок
  - **INT-02**: Целостность передачи данных — Блок 2 ← Блок 1, Блок 3 ← Блоки 1+2, Блок 4 ← Блоки 1+2+3, Блок 5 ← Блоки 1–4
  - **INT-03**: Graceful degradation — работа с частично заполненными блоками, warnings при отсутствии данных
  - **INT-04**: Cascade stale-обновления — проверка распространения stale при изменении Блоков 1–5
  - **INT-05**: Pipeline prepare_input — корректность подготовки входных данных для каждого блока
  - **INT-06**: Валидация формата выходных данных — обязательные поля каждого блока, допустимые значения статусов

#### Техдолг — обновления
- TD-014 → Partially Resolved: RAG-сервис полностью реализован (rag_service.py, TextChunker, EmbeddingGenerator, load_knowledge.py). Требуется запуск с API-доступом для загрузки данных
- DEFERRED-003 → Partially Resolved: scripts/compile_bible_pdf.py создан — компиляция 12 разделов Библии геймдизайна в PDF/HTML с оглавлением и CSS-стилями

### Изменено
- Версия обновлена с 0.26.0 до 0.27.0
- ROADMAP_PHASE4.md — задача 4.C.10 отмечена как завершённая (✅)
- Тестовая документация актуализирована: 231 тест backend (было 209), 22 интеграционных теста
- UI-04: версия обновлена до 0.27.0
- Добавлен E2E-сценарий E2E-08 для интеграционного теста «Roguelike про алхимика»

---

## [0.25.0] — 2026-05-19

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 5 UI)
- Блок 5: UI — Экономика и прогрессия — 4.C.8
  - **EconomyProgressionPage** — страница `/blocks/5` с двумя вкладками и формами ввода
  - **Прогрессия** — вкладка с формой ввода и 5 поддкладками результатов:
    - Форма: жанр, длительность, уровни, тип прогрессии, монетизация, pacing
    - Макро-параметры: totalLevels, targetDuration, progressionType, contentRequirements, emergenceRatio, lockKeyModel
    - Этапы/Tiers: таблица с 8 колонками (Tier, Level Range, Scale, Dominant Mechanic, Balance Type, Difficulty Curve, Resource State, Transition Trigger)
    - Кривые: 4 Recharts LineChart (XP→Level, Level→Power, Level→Cost, Difficulty) с формулами и параметрами
    - Контент-план: таблица tier_plans, таблица unlock_tree, график воспринимаемой сложности
    - Валидация: overall_score, severity counts, pass/fail проверки (no_grind, no_walls, no_empty_levels, no_runaway, no_build_gaps, aesthetic_alignment)
  - **Экономика** — вкладка с формой ввода и 5 поддкладками результатов:
    - Форма: жанр, монетизация, openness
    - Ресурсы: таблица ресурсов с группировкой (core/subsidiary), boolean-иконки
    - Классификация: economic type, sub_type, dominant_loop, interaction_type, openness, pricing_type, risk_level с цветокодированными бейджами
    - Machinations: узлы с типоспецифичными иконками, resource flows, state connections, feedback loops, structural patterns
    - Диагностика: pathologies с severity badges, faucet/drain ratios таблица, overall severity
    - Симуляция: multi-line resource curves chart (Recharts), quality assessment (6 проверок), stability index, build gap, runaway/stall frequency

### Изменено
- Версия обновлена с 0.24.0 до 0.25.0
- Страница `/blocks/5` заменена с placeholder на полнофункциональный UI (1899 строк)

---

## [0.24.0] — 2026-05-19

### Добавлено

#### Коллекция GDD-примеров (TD-006, DEFERRED-001)
- Создана директория `docs/gdd_examples/` с коллекцией реальных Game Design Documents
- 19 локальных PDF-файлов из 8 жанров (Doom Bible, GTA, MGS2, BioShock, Torment, Grim Fandango, Narbacular Drop, Fallout, Monolith Claw, Ubisoft Template и др.)
- 17 онлайн-ресурсов (GameDocs, GameScrye, GitHub-репозитории, Archive.org, Scribd)
- `INDEX.md` — структурированный каталог с классификацией по жанрам, эпохам и типам документов
- План изучения для валидации шаблонов GDD (после завершения стадии 4.C)

#### ROADMAP — актуализация статуса 4.C
- 4.C.2 (Intransitive-анализ) → ✅
- 4.C.3 (Monte Carlo + Machinations) → ✅
- 4.C.5 (Прогрессия, Этапы 1–4) → ✅
- 4.C.7 (Валидация прогрессии, сборка профилей) → ✅

### Изменено
- Версия обновлена с 0.23.0 до 0.24.0

### Техдолг
- TD-006 → Resolved: docs/gdd_examples/ — 19 локальных PDF + 17 онлайн-ресурсов из 8 жанров
- DEFERRED-001 → Resolved: сборка коллекции из 20+ GDD превышает минимум 5-10

---

## [0.23.0] — 2026-05-19

### Добавлено

#### Тестовая документация — полная актуализация
- Актуализирован полный перечень программных и UI тестов для всего функционала (docs/тестирование/)
- Реальное состояние: backend 198 тестов (8 файлов), frontend 9 тестов (3 файла)
- Добавлены 50 UI-тест кейсов и 6 E2E-сценариев (ручное тестирование)
- Плановые тесты: ~340 backend + ~112 frontend для будущих модулей

#### ROADMAP
- Задача 4.C.6 отмечена как завершённая (✅) в ROADMAP_PHASE4.md

### Изменено
- Версия обновлена с 0.22.0 до 0.23.0
- `docs/тестирование/testing_plan.md` — полная актуализация: реальные + плановые тесты, UI/E2E сценарии
- `docs/тестирование/test_infrastructure.md` — актуализация: текущие фикстуры, статистика

---

## [0.22.0] — 2026-05-19

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 5 Backend — Экономика)
- Блок 5: Backend — Экономическое моделирование (алгоритм 3.6) — 4.C.6
  - **Этап 1: Идентификация ресурсов** (3.6.3)
    - Извлечение core ресурсов из CoreLoop шагов (consumed/produced)
    - Genre resource maps: 10 жанров → core/anchor/subsidiary ресурсы
    - Классификация по Schreiber: time/currency/game_object/hp/experience/consumable
    - Установка свойств: is_consumable, is_catalytic, is_anchor, depreciates, transferable
    - AI-обогащение через IDENTIFY_RESOURCES промпт (fallback → эвристики)
  - **Этап 2: Классификация экономической системы** (3.6.4)
    - Определение loop types (reinforcing/balancing/neutral) из CoreLoop петель
    - Классификация по Sellers matrix: Engine/Economy/Ecology/Hybrid
    - Подтипы: braked_engine, pure_engine, multi_currency, single_currency, metastable, balanced_ecology, engine_dominant, economy_dominant
    - Openness (open/closed/mixed) и pricing_type (fixed/player_driven/f2p/mixed) по жанру
    - Risk profile на основе экономического типа
  - **Этап 3: Построение Machinations-модели** (3.6.5)
    - Pool, Source, Drain, Converter, Trader, Gate узлы для каждого ресурса
    - Resource flows (Source→Pool, Pool→Drain, Pool→Converter)
    - State connections (reinforcing/balancing feedback loops)
    - Structural patterns Adams/Dormans (Static Engine, Converter Engine, Dynamic Friction, etc.)
  - **Этап 4: Построение графа конверсий** (3.6.6)
    - Conversion chains из progression_profile.economyInput
    - Profitability расчёт (output_value / input_value)
    - Предупреждения при profitability > 1.5 (grind risk) или < 0.7 (frustration risk)
    - Tier coverage анализ и обнаружение непокрытых тиров
  - **Этап 5: Диагностика патологий** (3.6.7)
    - Runaway detection (усиливающие петли без торможения)
    - Deadlock/stall detection (балансирующих петель больше)
    - Inflation detection (faucet >> drain)
    - Stagnation detection (faucet ≈ 0)
    - Arbitrage detection (profitability > 1.0, замкнутые циклы)
    - Faucet/drain ratios для каждого ресурса
  - **Этап 6: Автоматическая балансировка faucet/drain** (3.6.8)
    - Auto-adjust: deficit → increase faucet/decrease drain
    - Auto-adjust: surplus → increase drain/decrease faucet
    - Economy phase targets: startup(1.0), growth(1.3), maturity(1.0), endgame(0.8)
    - Обновление Machinations graph с корректировками
  - **Этап 7: Симуляция экономики (Monte Carlo)** (3.6.9)
    - 4 архетипа игроков (optimal/casual/minmaxer/explorer)
    - Reinforcing/balancing feedback в симуляции
    - Runaway/stall frequency, build gap, stability index
    - Quality assessment: 6 проверок (resources_in_bounds, progression_pacing, no_runaway, no_stall, build_gap_acceptable, economy_stable)
    - Снапшоты для визуализации
  - **Этап 8: Полный пайплайн economy_design_full()** — Этапы 1–8

#### Схемы данных (Блок 5 — Экономика)
- `ResourceDescriptor` — дескриптор ресурса (name, resource_class, properties, bounds)
- `ResourceInventory` — инвентарь ресурсов (resources, anchor, core/subsidiary counts, class_distribution)
- `EconomicClassification` — классификация экономики (type, sub_type, loop analysis, risk)
- `ConversionChain` — цепочка конверсии (inputs, outputs, profitability, tier)
- `ConversionGraph` — граф конверсий (chains, avg_profitability, tier_coverage, warnings)
- `EconomyPathology` — патология экономики (name, severity, description, correction)
- `EconomyDiagnostics` — диагностика (pathologies, faucet_drain_ratios, overall_severity)
- `FaucetDrainAdjustment` — корректировка faucet/drain (current/new rates, action)
- `FaucetDrainBalance` — результат балансировки (adjustments, phase, target_ratio)
- `EconomySimResult` — результат симуляции (config, aggregated, quality, pathologies)
- `EconomyProfile` — итоговый профиль экономики (все 8 этапов + summary + meta)

#### API
- POST `/api/v1/economy/design` — полный пайплайн экономического моделирования (Этапы 1–8)
- POST `/api/v1/economy/resources` — идентификация ресурсов (Этап 1)
- POST `/api/v1/economy/classify` — классификация экономики (Этап 2)
- GET `/api/v1/economy/{project_id}` — получение результатов экономики (stub)

#### Тесты
- 83 теста для EconomyService: Stage 1 (15), Stage 2 (15), Stage 3 (10), Stage 4 (8), Stage 5 (10), Stage 6 (8), Stage 7 (8), Full Pipeline (8)

### Изменено
- Версия обновлена с 0.21.0 до 0.22.0

---

## [0.21.0] — 2026-05-19

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 5 Backend — Прогрессия)
- Блок 5: Backend — Алгоритм прогрессии (Этапы 1–4) — 4.C.5
  - **Этап 1: Определение макро-параметров прогрессии** (3.5.3)
    - Жанровая эвристика длительности (22 жанра → часы)
    - Pacing-based уровень расчёта (relaxed/balanced/intense → переходов/час)
    - Расчёт контент-требований (content_stages, enemy_configs, meaningful_choices)
    - Жанровая эвристика типа кривой (7 типов: linear, exponential, diminishing, s_curve, intermittent, custom)
    - Оценка emergence_ratio из Core Loop + MDA профиля (0.0–1.0)
    - Определение lock-key модели по жанру (linear/metroidvania/dynamic/emergent/hybrid)
    - AI-обогащение через PLAN_PROGRESSION_MACROS промпт (fallback на эвристики)
  - **Этап 2: Определение этапов (tiers) прогрессии** (3.5.4)
    - Расчёт числа этапов (2–5, оптимально 3-4)
    - Неравномерное распределение уровней (ранние короче, поздние длиннее)
    - Характеристика каждого tier (D&D масштабы: Локальный → Региональный → Мировой → Мультивселенский)
    - Доминантная механика по жанру и tier
    - Тип баланса: ранние tiers — transitive, поздние — intransitive
    - Ресурсная динамика по типологии Селлерса (Engine/Economy/Ecology)
    - Карта переходов между этапами
  - **Этап 3: Построение кривых прогрессии** (3.5.5)
    - XP → Уровень: exponential (y = C × b^x), triangular (y = (x²-x)/2), linear
    - Уровень → Мощность: linear, polynomial (Power = Base + Rate × n^exp), logistic (S-кривая)
    - Уровень → Стоимость: пропорциональна мощности с multiplier (F2P > 1, PvP ≈ 1, PvE < 1)
    - Сложность: формула воспринимаемой сложности Шрайбера (Cv + Cs) - (Pv + Ps)
    - Проверка согласованности кривых (доход vs затраты, предупреждения при дисбалансе)
    - AI-обогащение через GENERATE_PROGRESSION_CURVES промпт
  - **Этап 4: Генерация контент-плана** (3.5.6)
    - Контент-требования по tier (enemies, rewards, abilities, milestones, pacing)
    - Дерево разблокировок (unlock_tree): 1-2 механики за уровень, без пустых уровней
    - Таблица воспринимаемой сложности по уровням (tier boundary spikes)
    - Типы разблокировок: mechanic, area, ability, resource, narrative
    - AI-обогащение через GENERATE_CONTENT_PLAN промпт
  - **Полный пайплайн progression_design_full()** — Этапы 1-4 + базовая валидация
    - Проверка на гринд (циклы > maxGrindTolerance)
    - Проверка на стены (скачки сложности > 0.3)
    - Проверка на пустые уровни (без разблокировок)
    - Сборка ProgressionProfile с summary формулами

#### Схемы данных (Блок 5 — Прогрессия)
- `ProgressionConstraints` — ограничения прогрессии (maxGrindTolerance=5, minRewardInterval=3, flowTarget, contentBudget)
- `ProgressionInput` — входные данные (concept, coreLoop, mdaProfile, balanceResult, targetDuration, targetLevels, progressionType, monetizationModel, constraints)
- `ProgressionMacroModel` — макро-параметры (duration, levels, progressionType, contentRequirements, emergenceRatio, lockKeyModel)
- `TierInfo` — этап прогрессии (index, level_range, level_count, scale, dominant_mechanic, balance_type, difficulty_curve, resource_state, transition_trigger)
- `TierModel` — модель этапов (tiers, num_tiers, total_levels, transition_map)
- `CurveSpec` — спецификация кривой (type, formula, parameters)
- `ProgressionCurves` — 4 кривые (xp_to_level, level_to_power, level_to_cost, difficulty)
- `ContentTierPlan` — контент-план для tier (enemies, rewards, abilities, milestones, pacing)
- `UnlockEntry` — разблокировка (level, unlock_name, unlock_type, description)
- `PerceivedDifficultyEntry` — воспринимаемая сложность (level, target_perceived_difficulty, recommended_enemy_power, is_tier_boundary)
- `ContentPlan` — полный контент-план (tier_plans, unlock_tree, perceived_difficulty_table, total_content_requirements)
- `ProgressionValidation` — валидация (issues, suggestions, critical/warning/info counts, overall_score)
- `ProgressionProfile` — итоговый профиль (все этапы + summary + economyInput stub)

#### API
- POST `/api/v1/progression/macro-params` — Этап 1: макро-параметры прогрессии
- POST `/api/v1/progression/plan-tiers` — Этап 2: разбиение на tiers
- POST `/api/v1/progression/build-curves` — Этап 3: кривые прогрессии
- POST `/api/v1/progression/content-plan` — Этап 4: контент-план
- POST `/api/v1/progression/design` — полный пайплайн (Этапы 1–4)
- GET `/api/v1/progression/{project_id}` — получение сохранённой прогрессии (stub)

#### Промпты
- `PLAN_PROGRESSION_MACROS` — AI-обогащение макро-параметров (Блок 5)
- `GENERATE_PROGRESSION_CURVES` — AI-обогащение кривых прогрессии (Блок 5)
- `GENERATE_CONTENT_PLAN` — AI-генерация контент-плана (Блок 5)

### Изменено
- Версия обновлена с 0.20.0 до 0.21.0
- `services/__init__.py` — добавлен экспорт ProgressionService
- `api/v1/__init__.py` — добавлен progression_router
- `main.py` — добавлен progression_router с префиксом `/api/v1/progression`
- `economy.py` — удалены stub-эндпоинты прогрессии (перенесены в progression.py)

---

## [0.20.0] — 2026-05-19

### Добавлено

#### Техдолг — синхронизация типов (TD-018 частично)
- Обновлены TypeScript-интерфейсы в `shared/types/typescript/interfaces.ts` (Блок 4):
  - Добавлены: `ObjectBalanceReport`, `BalanceMap`, `StrategyBalanceScore`, `RPSCycle`, `Situation`, `VersatilityInfo`, `QFactorObject`, `QFactorResult`, `StabilityAnalysis`, `SimulationConfig`, `MatchupData`, `NumberFormatReport`, `MachinationsSimConfig`, `EconomyRunSnapshot`, `AggregatedSimData`, `QualityAssessment`, `MachinationsSimResult`
  - Обновлены: `TransitiveResult`, `IntransitiveResult`, `SituationalResult`, `MonteCarloResult`, `BalanceResult` — приведены в соответствие с backend-схемами
  - Удалены устаревшие: `CostPowerCurve`, `BalancePathology`, `CorrectionProposal`
- Обновлены Python-модели в `shared/types/python/models.py` (Блок 4):
  - Добавлены: `BalanceInput`, `ObjectBalanceReport`, `BalanceMap`, `StrategyBalanceScore`, `RPSCycle`, `IntransitiveResult` (полная), `Situation`, `VersatilityInfo`, `SituationalResult` (полная), `QFactorObject`, `QFactorResult`, `StabilityAnalysis`, `SimulationConfig`, `MatchupData`, `NumberFormatReport`, `MachinationsSimResult`, `BalanceResult` (полная)
  - Удалены устаревшие заглушки `Optional[dict]` для IntransitiveResult и SituationalResult

#### Инфраструктура
- Создан `.github/workflows/ci.yml` — CI/CD пайплайн GitHub Actions:
  - Backend lint (Ruff), Backend tests (pytest), Frontend lint (ESLint), Frontend tests (vitest), Type sync check
- Обновлён `docs/AI_RECOVERY_INSTRUCTIONS.md`:
  - Фаза 4 отмечена как активная (4.C.4 завершён)
  - Добавлен прогресс по субфазам 4.A–4.C
  - Добавлены реализованные модули с детализацией
  - Обновлён технологический стек
  - Добавлена структура директорий docs/архитектура/, docs/тестирование/, docs/ROADMAP_PHASE4.md

#### Тестовая документация
- Актуализирован полный перечень программных и UI тестов (покрытие всего функционала)

### Изменено
- Версия обновлена с 0.19.0 до 0.20.0

### Техдолг
- TD-011 → Resolved: CI/CD пайплайн создан (.github/workflows/ci.yml)
- TD-018 → Partially Resolved: Shared типы синхронизированы для Блока 4; Prisma/SQLAlchemy унификация отложена

---

## [0.19.0] — 2026-05-19

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 4 UI)
- Блок 4: UI — Баланс и симуляция — 4.C.4
  - **BalancePage** — страница `/blocks/4` с формой ввода объектов и 5 вкладками результатов
  - **TransitiveTable** — вкладка «Transitive-анализ»
    - Форма добавления/редактирования игровых объектов (name, type, attributes, cost, tier)
    - 5 предзаполненных тестовых объектов (Warrior, Mage, Rogue, Tank, Healer)
    - Таблица результатов: Элемент, Cost, Power, C/P Ratio, Distance from Curve, Status
    - Цветовая индикация: overpowered=red, underpowered=amber, balanced=green, ideal_imbalance=blue
    - Отображение attribute_weights, cost_curve_model, warnings, suggestions
  - **PayoffMatrix** — вкладка «Payoff-матрица»
    - Интерактивная N×N таблица с тепловой картой (green=positive, red=negative)
    - Равновесие Нэша с прогресс-барами вероятностей
    - Обнаруженные RPS-циклы с показателем силы
    - Доминируемые стратегии
    - Метрики баланса стратегий (entropy, max_share, gini)
  - **SimulationCharts** — вкладка «Симуляция (Monte Carlo)»
    - Win rate bar chart по объектам (Recharts BarChart с цветокодированием)
    - Индикаторы: win rate spread, корреляция Спирмена
    - Вердикт баланса: GOOD/MODERATE/POOR (цветокодированный бейдж)
    - Average duration bar chart
    - Сворачиваемая матрица парных сравнений (matchup_matrix)
  - **MachinationsView** — вкладка «Machinations»
    - Визуальный список узлов с типоспецифичными иконками (pool/source/drain/converter/trader/gate)
    - Диаграмма потоков ресурсов (from → to с rate)
    - Связи состояния (dashed arrows) с модификаторами
    - Петли обратной связи (reinforcing/balancing)
    - Quality Assessment: 6 проверок с pass/fail индикаторами
    - Обнаруженные патологии
    - Line chart кривых ресурсов (Recharts LineChart)
    - Индекс стабильности и разрыв билдов
  - **CorrectionsPanel** — вкладка «Коррекции»
    - Все warnings и suggestions, сгруппированные по severity (critical/warning/info)
    - AI-рекомендации с кнопками «Применить» (visual only)
    - Метаданные анализа: stages_completed, latency_ms, models_used
    - Сводка balance_map и stability assessment
  - Форма ввода: список объектов, game_mode, genre, balance_type, параметры симуляции
  - Кнопка «Запустить анализ баланса» → POST `/api/v1/balance/analyze`

### Изменено
- Версия обновлена с 0.18.0 до 0.19.0
- Страница `/blocks/4` заменена с placeholder на полнофункциональный UI

---

## [0.18.0] — 2026-05-19

### Добавлено

#### Тестовая документация — полное покрытие (4.C.3 + pipeline + все блоки)
- Актуализирован полный перечень программных и UI тестов для всего функционала
- Добавлены тест-кейсы для Monte Carlo-симуляции (4.C.3): B-367–B-374
- Добавлены тест-кейсы для Machinations-симуляции (4.C.3): B-375–B-384
- Добавлены тест-кейсы для комбинированного анализа устойчивости (4.C.3): B-385–B-390
- Добавлены тест-кейсы для API Monte Carlo и Machinations (4.C.3): B-391–B-396
- Добавлены UI-тесты для Балансировки и симуляции (Блок 4): UI-40–UI-48
- Добавлены UI-тесты для Pipeline (сквозной пайплайн): UI-49–UI-52
- Добавлены frontend-тесты для Pipeline-компонентов: F-76–F-85
- Обновлена сводка покрытия тестами (backend: 396+, frontend: 85+, UI: 134+, E2E: 45+)

### Изменено
- Версия обновлена с 0.17.0 до 0.18.0
- `testing_plan.md` — полная актуализация: добавлены все тесты для 4.C.3, обновлены сводки, добавлены фикстуры для Balance Service
- TD-013 → Resolved: Machinations-движок полностью реализован в 4.C.3

### Техдолг
- TD-013 → Resolved: Machinations-симуляция полностью реализована (8 типов узлов, 16 паттернов Adams/Dormans, Monte Carlo + Machinations симуляция, Quality Assessment, обнаружение 6 патологий)

---

## [0.17.0] — 2026-05-18

### Добавлено

#### Продвинутые модули (Фаза 4.C, Блок 4 Backend — симуляция)
- Блок 4: Backend — Симуляция (Monte Carlo + Machinations) — 4.C.3
  - **Этап 6: Monte Carlo-симуляция** (3.4.9)
    - Моделирование N боёв/сессий (N ≥ 1000) со стохастическими параметрами
    - Симуляция 1v1 боя: HP, damage, speed, defense + случайность (crit chance 5-15%, evasion 5-10%)
    - Агрегация: win_rates, avg_duration, matchup_matrix (попарные результаты)
    - Win rate spread: MAX - MIN → вердикт GOOD (<0.15), MODERATE (<0.30), POOR (>=0.30)
    - Кросс-валидация с формальным ранжированием (корреляция Спирмена)
    - Анализ расхождения через ANALYZE_DISCREPANCY промпт при корреляции < 0.5
    - Оценка эмоционального восприятия чисел (Гэзэуэй/Кн. 9): «лёгкие» (кратные 5/10) vs «тяжёлые»
  - **Этап 7: Machinations-симуляция** (3.6.5, 3.6.9)
    - Построение Machinations-графа из ресурсов (Pool, Source, Drain, Converter, Trader, Gate)
    - Потоки ресурсов (сплошные стрелки) и связи состояния (пунктирные стрелки)
    - Обнаружение петель обратной связи (reinforcing/balancing)
    - Определение типа экономики (engine/economy/ecology/hybrid)
    - Обнаружение 16 структурных паттернов Adams/Dormans
    - Симуляция N тиков с 4 архетипами игроков (optimal, casual, minmaxer, explorer)
    - Агрегация: avg_resource_curves, resource_ranges, runaway/stall frequency
    - Индекс стабильности (stability_index > 0.7 = стабильно)
    - Разрыв билдов (build_gap < 3.0× = приемлемо)
    - Quality Assessment: 6 проверок (resources_in_bounds, no_runaway, no_stall, build_gap, economy_stable)
    - Обнаружение патологий: runaway, deadlock, stall, oscillation, inflation, stagnation
  - **Комбинированный анализ устойчивости**
    - StabilityAnalysis — типизированная Pydantic-модель (вместо raw dict)
    - Комбинация результатов Monte Carlo + Machinations
    - Определение overall_stability: stable/conditionally_stable/unstable

#### Схемы данных (Блок 4 — Симуляция)
- `StabilityAnalysis` — результат анализа устойчивости (overall_stability, pathology_risks, analysis, recommendations)
- `SimulationConfig` — конфигурация MC-симуляции (num_iterations, matchup_format, random_seed)
- `MatchupData` — парный результат MC (wins_a, wins_b, draws, avg_duration)
- `NumberFormatReport` — эмоциональное восприятие чисел (light/heavy_numbers, assessment)
- `MonteCarloResult` — результат MC-симуляции (win_rates, spread, correlation, verdict)
- `MachinationsNode` — узел графа (pool/source/drain/converter/trader/gate/delay/queue)
- `MachinationsResourceFlow` — поток ресурсов (source_id, target_id, resource, rate)
- `MachinationsStateConnection` — связь состояния (modifier, formula)
- `MachinationsFeedbackLoop` — обратная связь (nodes, loop_type, strength)
- `MachinationsGraph` — полный граф (nodes, flows, connections, patterns)
- `MachinationsSimConfig` — конфигурация Machinations-симуляции (ticks, num_runs, players)
- `EconomyRunSnapshot` — снепшот экономики (tick, resources, level, actions)
- `AggregatedSimData` — агрегированные данные (curves, ranges, runaway/stall frequency, stability_index)
- `QualityAssessment` — оценка качества экономики (6 проверок + critical_issues)
- `MachinationsSimResult` — результат Machinations-симуляции (graph, aggregated, quality, pathologies)
- `BalanceResult` — расширен: добавлены поля stability, monte_carlo_result, machinations_result

#### API
- POST `/api/v1/balance/monte-carlo` — Monte Carlo-симуляция баланса (win rates, вердикт, корреляция)
- POST `/api/v1/balance/machinations` — Machinations-симуляция экономики (граф, качество, патологии)
- POST `/api/v1/balance/analyze` — обновлён: полный пайплайн Этапов 1–7 + Q-фактор с параметрами run_monte_carlo, run_machinations

#### Промпты
- `ANALYZE_DISCREPANCY` — анализ расхождения формального и симуляционного ранжирования (Блок 4, итого 6 промптов)

#### Тесты
- 24 теста для симуляций: Monte Carlo (8), Machinations Graph (5), Machinations Simulation (5), Combined Stability (3), Full Pipeline (3)

### Изменено
- `balance_service.py` — расширен с Этапов 1–5 + Q-фактор до Этапов 1–7 + Q-фактор
- `balance_full()` — добавлены параметры run_monte_carlo, run_machinations; добавлены Этапы 6–7
- `analyze_stability()` — теперь возвращает типизированную StabilityAnalysis вместо raw dict
- `BalanceResult` — поле `stability` теперь StabilityAnalysis (вместо Optional[dict]); добавлены monte_carlo_result, machinations_result
- `services/__init__.py` — обновлён комментарий: 4.C.1–4.C.3
- `schemas/__init__.py` — добавлен экспорт 16 новых balance schemas
- Версия обновлена с 0.16.0 до 0.17.0

### Техдолг
- TD-013 → In Progress: Machinations-симуляция реализована в 4.C.3; полная интеграция с экономикой (Блок 5) в 4.C.6

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
