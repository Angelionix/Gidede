# Gidede — Трекер задач рефакторинга

**Версия**: 1.0  
**Дата создания**: 2026-08-01  
**Источник**: 8 планов рефакторинга (`docs/audit/REFACTOR_PLAN_block_*.md`)  
**Объём**: 146 задач суммарно, оценочно 700-1000 часов

---

## Статус задачи

| Symbol | Статус | Описание |
|--------|--------|---------|
| ⬜ | TODO | Не начато |
| 🔄 | IN PROGRESS | В работе |
| ✅ | DONE | Завершено |
| ⏸️ | BLOCKED | Заблокировано (dependency) |
| ❌ | CANCELLED | Отменено/неактуально |

---

## Легенда приоритетов и сложности

**Приоритет**:
- 🔴 = критично, блокирует корректную работу алгоритма
- 🟡 = средне, нарушает соответствие спецификации
- 🟢 = низко, nice-to-have / стратегическое

**Сложность**:
- S = Small (1-3ч)
- M = Medium (4-8ч)
- L = Large (1-2 дня)
- XL = Extra Large (3+ дня)

---

## Сводная статистика

| Блок | Всего задач | 🔴 Критично | 🟡 Средне | 🟢 Низко | Выполнено | Оценка (ч) |
|------|:-----------:|:-----------:|:---------:|:---------:|:----------:|:----------:|
| 1. Концепция | 18 | 4 | 11 | 3 | **18/18** ✅✅ | 30-70 |
| 2. Core Loop | 20 | 6 | 11 | 4 | **20/20** ✅✅ | 50-95 |
| 3. MDA | 20 | 6 | 11 | 4 | **20/20** ✅✅ | 55-100 |
| 4. Баланс | 18 | 9 | 5 | 4 | **18/18** ✅✅ | 130-195 |
| 5a. Прогрессия | 17 | 0 | 13 | 4 | **17/17** ✅✅ | 35-65 |
| 5b. Экономика | 18 | 11 | 5 | 2 | **18/18** ✅✅ | 156-190 |
| 6. GDD | 20 | 9 | 8 | 3 | 0/20 | 175-275 |
| 6b. Чек-лист | 17 | 12 | 3 | 2 | 0/17 | 150-210 |
| **Итого** | **148** | **57** | **67** | **26** | **111/148** | **781-1200** |

---

## 🚨 Топ-15 критичных задач (выполнить первыми)

Эти задачи устраняют наиболее серьёзные дефекты, при которых алгоритмы фактически не работают.

| # | Task ID | Блок | Описание | Сложность | Статус |
|---|---------|------|----------|:---------:|:------:|
| 1 | TASK-1.1 | 1 | Заполнить `genres` + `genre_affinity` для 128 механик MechanicsDB | XL | ✅ |
| 2 | TASK-3.6 | 3 | Загружать `aestheticProfile`/`genre`/`idea` из `project.concept` + починить pipeline runner | M | ⬜ |
| 3 | TASK-3.1 | 3 | Выровнять `mechanic_id` namespace (DYNAMICS_TO_MECHANICS ↔ GENRE_DEFAULT_MECHANICS ↔ MechanicsDB) | XL | ⬜ |
| 4 | TASK-3.2 | 3 | Перебирать все динамики эстетики (не только `[0]`) | M | ⬜ |
| 5 | TASK-3.5 | 3 | Инвертировать logic в Lens #41 «Доминантная стратегия» | S | ⬜ |
| 6 | TASK-4.1 | 4 | Починить `run_pipeline_test.sh` (`elements` → `objects` с правильным shape) | S | ✅ |
| 7 | TASK-4.2 | 4 | `run-full-pipeline` STAGES[3] derives objects from upstream (genre-based templates) | L | ✅ |
| 8 | TASK-4.6 | 4 | Deterministic Monte Carlo (mulberry32 PRNG) | M | ✅ |
| 9 | TASK-5b.1 | 5b | Создать `enrichEconomy` в ai-service.ts | L | ✅ |
| 10 | TASK-5b.3 | 5b | Заменить `Math.random` в profitability на формулу Bible 6.9.1 | M | ✅ |
| 11 | TASK-6.5 | 6 | Починить field name mismatch (`format` → `target_format`) | S | ⬜ |
| 12 | TASK-6.6 | 6 | Заменить STUB `/gdd/checklist` на `lib/checklist-logic.ts` | M | ⬜ |
| 13 | TASK-6b.1 | 6b | Унифицировать `/gdd/checklist` (заменить STUB) | M | ⬜ |
| 14 | TASK-6b.16 | 6b | Pipeline runner → `/checklist/validate` | S | ⬜ |
| 15 | TASK-1.6 | 1 | Убрать невалидные эстетики `competition`/`strategy` (+ `as unknown as string`) | S | ✅ |

---

## Полный реестр задач

### Блок 1 — Генератор концепции (16 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_1.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-1.1 | Заполнить `genres` + `genre_affinity` для 128 механик MechanicsDB | XL | 🔴 | ✅ | — |
| TASK-1.2 | Починить `compatibility_score` каскад в `buildValidationReport` | M | 🔴 | ✅ | TASK-1.1 |
| TASK-1.3 | Реализовать 8 idea filters с реальной логикой (4 захардкожены) | L | 🟡 | ✅ | — |
| TASK-1.4 | Реализовать 5 core questions с реальной логикой (2 захардкожены) | M | 🟡 | ✅ | — |
| TASK-1.5 | Заменить STUB `/concept/[id]/validate` на реальный пересчёт | M | 🔴 | ✅ | TASK-1.1 |
| TASK-1.6 | Убрать невалидные эстетики `competition`/`strategy` (+ `as unknown as string`) | S | 🔴 | ✅ | — |
| TASK-1.7 | Починить `pickAesthetics` (word boundaries, dedup) + `GENRE_KEYWORDS` overlap | M | 🟡 | ✅ | TASK-1.6 |
| TASK-1.8 | Починить `buildMechanicSetForGenre` (заполнять все 5 категорий) | M | 🟡 | ✅ | TASK-1.1 |
| TASK-1.9 | Починить bilingual core loop candidates (русские имена в английских фразах) | M | 🟡 | ✅ | — |
| TASK-1.10 | Починить `buildUSPCandidates` slice boundaries + fallback для короткой идеи | S | 🟢 | ✅ | — |
| TASK-1.11 | Persist `ai_insights` + `generation_metadata` + `title` в БД + Prisma миграция | M | 🟡 | ✅ | — |
| TASK-1.12 | Убрать китайские символы (`除非`, `扩充`, `摩擦`) | S | 🟡 | ✅ | — |
| TASK-1.13 | Выровнять тип `MechanicSet` с реализацией (убрать type bypass) | M | 🟡 | ✅ | TASK-1.1 |
| TASK-1.14 | MechanicsDB Levels 0-2 (Shell 7 + Adams/Dormans 5 + 16 паттернов) — стратегическое | XL | 🟢 | ✅ | TASK-1.1 |
| TASK-1.15 | Input validation + edge cases (длина idea, unknown genre, forbidden_mechanics aliases) | M | 🟡 | ✅ | — |
| TASK-1.16 | Unit + integration тесты (vitest, coverage ≥ 70%) | L | 🟡 | ✅ | Все остальные |
| TASK-1.17 | **NEW**: Поддержка primary genre + subgenres (`inferGenres`, body.subgenres) | M | 🟡 | ✅ | — |
| TASK-1.18 | **NEW**: Cross-genre mechanics — добавление механик из других жанров с aesthetic overlap | M | 🟡 | ✅ | TASK-1.1, TASK-1.8 |

---

### Блок 2 — Core Loop Designer (20 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_2.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-2.1 | Параметризовать `buildSteps` по типу (7 builder'ов: Engine/Economy/Ecology/Hybrid/TD/Rhythm/Puzzle) | XL | 🔴 | ✅ | — |
| TASK-2.2 | Классифицировать тип по эстетике (Bible 4.11.1) | M | 🔴 | ✅ | TASK-1.6 |
| TASK-2.3 | Реализовать 7 Bible патологий (убрать 4 non-biblical) | L | 🔴 | ✅ | — |
| TASK-2.4 | Реальная проверка замкнутости через resource flow | M | 🔴 | ✅ | TASK-2.8 |
| TASK-2.5 | Sub_types для tower_defense/rhythm/puzzle | M | 🟡 | ✅ | — |
| TASK-2.6 | 5 вопросов Гэри (Bible 4.11.2) | M | 🟡 | ✅ | — |
| TASK-2.7 | Масштаб по жанру (Bible 4.11.3, 25 жанров) | S | 🟡 | ✅ | — |
| TASK-2.8 | Убрать `dead_resources` из default template | M | 🔴 | ✅ | TASK-2.1 |
| TASK-2.9 | Починить customSteps mode (resources из типа, не из feedback) | M | 🟡 | ✅ | — |
| TASK-2.10 | Заменить `\|\|` на `&&` в pathology detection | S | 🟡 | ✅ | — |
| TASK-2.11 | Починить `hasBraking` логику | S | 🟡 | ✅ | — |
| TASK-2.12 | Заменить substring matching на keyword sets с русскими эквивалентами | M | 🟡 | ✅ | — |
| TASK-2.13 | Добавить `aiInsights`/`modelsUsed`/`latencyMs`/`garyFiveQuestions` в Prisma | M | 🟡 | ✅ | — |
| TASK-2.14 | Добавить GET `/coreloop/[projectId]` route | S | 🟡 | ✅ | — |
| TASK-2.15 | Убрать dead code (`void safeJsonParse`, `PATHOLOGY_TYPES`, hardcoded `hierarchyDepth`) | S | 🟢 | ✅ | — |
| TASK-2.16 | Bible-justified threshold `overallPassed` (все 5 критериев обязательны) | S | 🔴 | ✅ | — |
| TASK-2.17 | riskLevel/likelyPathologies для TD/Rhythm/Puzzle | S | 🟢 | ✅ | TASK-2.5 |
| TASK-2.18 | Улучшить `enrichCoreLoop` prompt | S | 🟡 | ✅ | — |
| TASK-2.19 | Multi-entry loops array (Bible 4.3 шесть уровней) | M | 🟢 | ✅ | — |
| TASK-2.20 | Unit-тесты для всех функций | L | 🟢 | ✅ | Все остальные |

---

### Блок 3 — MDA Lab (20 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_3.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-3.1 | Выровнять `mechanic_id` namespace (DYNAMICS_TO_MECHANICS ↔ GENRE_DEFAULT_MECHANICS ↔ MechanicsDB) | XL | 🔴 | ✅ | TASK-1.1 |
| TASK-3.2 | Перебирать все динамики эстетики (не только `[0]`) | M | 🔴 | ✅ | TASK-3.1 |
| TASK-3.3 | Починить `match_scores` формулу + реальная итерация Classic MDA | M | 🔴 | ✅ | TASK-3.2 |
| TASK-3.4 | Реальный Reverse MDA — mechanic set из dynamics_target (Bible 3.5.4) | L | 🔴 | ✅ | TASK-3.1 |
| TASK-3.5 | Инвертировать logic в Lens #41 | S | 🔴 | ✅ | — |
| TASK-3.6 | Загружать `aestheticProfile`/`genre`/`idea` из `project.concept` + починить pipeline runner | M | 🔴 | ✅ | TASK-1.6 |
| TASK-3.7 | Переписать `compatibility_score` — убрать hardcoded `present: true` | M | 🟡 | ✅ | TASK-3.1 |
| TASK-3.8 | Реальная Bond 4×3 matrix + вычислить ludonarrative (Гармония/Ирония/Диссонанс) | L | 🟡 | ✅ | — |
| TASK-3.9 | Реальный `observed_dynamics` из mechanic set | M | 🟡 | ✅ | TASK-3.1 |
| TASK-3.10 | Реальный `gameplay_sequence` (templates по 12+ жанрам) | M | 🟡 | ✅ | — |
| TASK-3.11 | Добавить `moderate` в `EMERGENCE_BADGES` | S | 🟡 | ✅ | — |
| TASK-3.12 | Persist `ai_insights` в БД + убрать `void safeJsonParse` | S | 🟡 | ✅ | — |
| TASK-3.13 | Lens categories по 3 уровням Зубека (Bible 3.6.3) | M | 🟡 | ✅ | — |
| TASK-3.14 | Расширить `enrichMda` prompt | M | 🟡 | ✅ | — |
| TASK-3.15 | Type-safe `MDAAnalysisResult` — убрать `as unknown as` casts | M | 🟢 | ✅ | — |
| TASK-3.16 | Реальный `machinationsModel` graph из mechanic set | M | 🟡 | ✅ | — |
| TASK-3.17 | Убрать `uncovered_dynamics` всегда пустой + sanity-валидация | S | 🟢 | ✅ | — |
| TASK-3.18 | Убрать dead code | S | 🟢 | ✅ | — |
| TASK-3.19 | `buildMechanicSet` round-robin → semantic categorization + affinity sort | M | 🟡 | ✅ | TASK-1.1 |
| TASK-3.20 | Unit-тесты для Block 3 | L | 🟢 | ✅ | Все остальные |

---

### Блок 4 — Баланс и симуляция (18 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_4.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-4.1 | Починить `run_pipeline_test.sh` (`elements` → `objects` с правильным shape) | S | 🔴 | ✅ | — |
| TASK-4.2 | `run-full-pipeline` STAGES[3] derives objects from upstream (genre-based templates) | L | 🔴 | ✅ | — |
| TASK-4.3 | 7 Schreiber curves (Bible 5.4.3, default `triangular`) | M | 🔴 | ✅ | — |
| TASK-4.4 | Weighted attribute importance (Bible 5.5.3) | M | 🔴 | ✅ | — |
| TASK-4.5 | Real Nash equilibrium через Gaussian elimination + убрать artificial cyclicalBias | L | 🔴 | ✅ | — |
| TASK-4.6 | Deterministic Monte Carlo (mulberry32 PRNG) + winProb clamp + real Spearman | M | 🔴 | ✅ | — |
| TASK-4.7 | Machinations graph from object types + 8 feedback loop characteristics (Bible 5.6.1) | L | 🔴 | ✅ | — |
| TASK-4.8 | Починить `buildStability` — убрать `as unknown as` cast | S | 🔴 | ✅ | — |
| TASK-4.9 | 8 balance pathologies (Bible 5.13) — `balance-pathologies.ts` | XL | 🔴 | ✅ | — |
| TASK-4.10 | Persist `ai_insights` в БД — schema migration + вызов ДО persist | M | 🔴 | ✅ | — |
| TASK-4.11 | Расширенный `enrichBalance` prompt | S | 🟡 | ✅ | — |
| TASK-4.12 Унифицировать DB persistence + правильные GET fallback типы | M | 🟡 | ✅ | — | — |
| TASK-4.13 Fulcrum O(n) reference (Bible 5.5.2) | M | 🟡 | ✅ | — | — |
| TASK-4.14 Markov chains + recursive EV (Bible 5.8) | L | 🟡 | ✅ | — | — |
| TASK-4.15 | Валидация objects (count bound 2-100, numeric attrs, unique IDs) | S | 🟡 | ✅ | — |
| TASK-4.16 6 combinations sum × OS (Bible 5.6.2) | M | 🟢 | ✅ | — | — |
| TASK-4.17 | Убрать dead code + type bypasses | S | 🟢 | ✅ | — |
| TASK-4.18 | Unit-тесты для balance модулей | L | 🟢 | ✅ | Все остальные |

---

### Блок 5a — Прогрессия (17 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_5a.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-5a.1 | 7 curves (Bible 6.7.3) — добавить logarithmic, triangular, obfuscation | XL | 🟡 | ✅ | — |
| TASK-5a.2 | Формула perceived difficulty `(Cv+Cs)−(Pv+Ps)` (Bible 6.7.1) | L | 🟡 | ✅ | — |
| TASK-5a.3 | Genre-aware `TIER_ARCHETYPES` (Bible 6.6.4) | L | 🟡 | ✅ | — |
| TASK-5a.4 | Genre-specific `economyLink` (убрать hardcoded `["xp", "gold"]`) | M | 🟡 | ✅ | — |
| TASK-5a.5 | Починить `" elemental_attack"` (leading space) + cap на `prestige_reset` | S | 🟡 | ✅ | — |
| TASK-5a.6 | Persist `ai_insights` (перенести enrichment ДО persist) | S | 🟡 | ✅ | — |
| TASK-5a.7 | Pipeline runner: передавать `genre`/`pacing`/`monetization` | M | 🟡 | ✅ | TASK-3.6 |
| TASK-5a.8 | Macro model RPG (Bible 6.7.4) — transitions/hour, content_stages, enemy_configs | M | 🟡 | ✅ | — |
| TASK-5a.9 | `transition_map` с terminal key (убрать dangling `endgame_unlock`) | S | 🟡 | ✅ | — |
| TASK-5a.10 | `lock_key_model` (5 типов: simple, metroidvania, dynamic, soft_locks, key_gates) | S | 🟡 | ✅ | — |
| TASK-5a.11 | Унифицировать POST/GET response shape | M | 🟡 | ✅ | — |
| TASK-5a.12 | Расширить `enrichProgression` prompt | S | 🟡 | ✅ | — |
| TASK-5a.13 | Real validation checks (no_walls, no_empty_levels, aesthetic_alignment, etc.) | M | 🟡 | ✅ | — |
| TASK-5a.14 | Input validation (totalLevels bound 1-1000, curveType in VALID_CURVE_TYPES) | S | 🟡 | ✅ | — |
| TASK-5a.15 | Types + DB migration (`aiInsights`/`modelsUsed`/`macroModel` поля) | M | 🟡 | ✅ | — |
| TASK-5a.16 | Real `stages_completed` (убрать hardcoded `[1,2,3,4,5]`) | S | 🟡 | ✅ | — |
| TASK-5a.17 | Unit + integration тесты | L | 🟢 | ⬜ | Все остальные |

---

### Блок 5b — Экономика (18 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_5b.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-5b.1 | Создать `enrichEconomy` в ai-service.ts | L | 🔴 | ✅ | — |
| TASK-5b.2 | Починить feedback_loops nodes (real IDs, не литералы) | M | 🔴 | ✅ | — |
| TASK-5b.3 | Заменить `Math.random` в profitability на формулу Bible 6.9.1 | M | 🔴 | ✅ | — |
| TASK-5b.4 | Вывести faucet/drain из actual flows, не из class preset | L | 🔴 | ✅ | — |
| TASK-5b.5 | Починить stallCount threshold (relative change) | M | 🔴 | ✅ | — |
| TASK-5b.6 | Real Monte Carlo с N runs + mulberry32 PRNG | L | 🔴 | ✅ | — |
| TASK-5b.7 | Деривить economy params из upstream concept в pipeline runners | L | 🔴 | ✅ | TASK-3.6 |
| TASK-5b.8 | 6 патологий Bible 6.10 (добавить Арбитраж + Deadlock) | L | 🔴 | ✅ | — |
| TASK-5b.9 | 12-point validation checklist (Bible 6.13.4) | XL | 🔴 | ✅ | — |
| TASK-5b.10 | Расширить `GENRE_RESOURCE_PRESETS` до 15 жанров | L | 🔴 | ✅ | — |
| TASK-5b.11 | 16+ Machinations patterns (Bible 6.4.1) | L | 🟡 | ✅ | — |
| TASK-5b.12 | 8-мерный профиль петли ОС (Bible 6.8.2) | M | 🟡 | ✅ | — |
| TASK-5b.13 | 6 Schreiber economic system types (Bible 6.4.3) | M | 🟡 | ✅ | — |
| TASK-5b.14 | Genre-specific dominant loops (Bible 6.8.3) | M | 🟡 | ✅ | — |
| TASK-5b.15 | Перенести AI enrichment ДО persist + DB schema migration | S | 🔴 | ✅ | TASK-5b.1 |
| TASK-5b.16 | Унифицировать POST/GET response shape + dynamic `stages_completed` | M | 🟡 | ✅ | — |
| TASK-5b.17 | Починить `subsidiary_count`, `resource_type`, genre normalization | S | 🟢 | ✅ | — |
| TASK-5b.18 | Unit + integration тесты (coverage ≥ 80%) | L | 🟢 | ⬜ | Все остальные |

---

### Блок 6 — GDD Generator (20 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_6.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-6.1 | Расширить `FORMAT_SECTIONS["full_gdd"]` до 38 секций (Bible 11.3.3) | XL | 🔴 | ⬜ | — |
| TASK-6.2 | Расширить `FORMAT_SECTIONS["modular"]` до 13 модулей (Bible 11.3.4) | M | 🔴 | ⬜ | — |
| TASK-6.3 | derive для 8 narrative секций отдельно (убрать дубли ludonarrativeCheck) | L | 🔴 | ⬜ | — |
| TASK-6.4 | derive для 17 missing Bible секций | XL | 🔴 | ⬜ | TASK-6.1 |
| TASK-6.5 | Починить field name mismatch (`format` → `target_format`) | S | 🔴 | ⬜ | — |
| TASK-6.6 | Заменить STUB `/gdd/checklist` на `lib/checklist-logic.ts` | M | 🔴 | ⬜ | — |
| TASK-6.7 | Удалить dead code `enrichGddSection` + per-section AI enrichment | M | 🔴 | ⬜ | — |
| TASK-6.8 | Реализовать Universal Design Validator (Bible 11.6, 10 уровней) | XL | 🔴 | ⬜ | TASK-6.6 |
| TASK-6.9 | Перенести `enrichGdd` до persist + расширить Prisma `ProjectGDD` | M | 🔴 | ⬜ | — |
| TASK-6.10 | Cache `deriveSectionContent` (убрать O(2N)) | S | 🟡 | ⬜ | — |
| TASK-6.11 | Починить `has_formulas` regex | S | 🟡 | ⬜ | — |
| TASK-6.12 | PDF pagination (убрать `slice(0, 4000)`) | S | 🟡 | ⬜ | — |
| TASK-6.13 | Реальный `coverage_score` (учитывать `ai_enrich`) | M | 🟡 | ⬜ | — |
| TASK-6.14 | Dynamic `stages_completed`/`models_used` | S | 🟡 | ⬜ | — |
| TASK-6.15 | Удалить 4 dead endpoints (`/gdd/auto-fill`, `/gdd/map`, etc.) | M | 🟡 | ⬜ | — |
| TASK-6.16 | `buildConsistencyReport` → 8 типов checks | M | 🟡 | ⬜ | — |
| TASK-6.17 | Prisma + types расширение (`aiInsights`/`modelsUsed`/`sectionAges`) | M | 🟡 | ⬜ | — |
| TASK-6.18 | visualElements + living documentation (Bible 11.9) | M | 🟢 | ⬜ | — |
| TASK-6.19 | Унифицировать `GDDFormatSpec` | S | 🟢 | ⬜ | — |
| TASK-6.20 | Unit + integration тесты | L | 🟢 | ⬜ | Все остальные |

---

### Блок 6b — Чек-лист валидации (17 задач)

Источник: `docs/audit/REFACTOR_PLAN_block_6b.md`

| Task ID | Описание | Сложность | Приоритет | Статус | Dependencies |
|---------|----------|:---------:|:---------:|:------:|--------------|
| TASK-6b.1 | Унифицировать `/gdd/checklist` (заменить STUB) | M | 🔴 | ⬜ | — |
| TASK-6b.2 | 113 линз Шелла (Bible 11.5.1) | XL | 🔴 | ⬜ | — |
| TASK-6b.3 | 8 фильтров идеи Шелла (Bible 11.5.2) | L | 🔴 | ⬜ | — |
| TASK-6b.4 | 6 эвристик Аптона (Bible 11.5.4) | M | 🔴 | ⬜ | — |
| TASK-6b.5 | 7-point Rolling/Morris (Bible 11.5.3) | L | 🔴 | ⬜ | — |
| TASK-6b.6 | 7 методов Бонд + Level 7 LD validator (Bible 11.5.5) | M | 🔴 | ⬜ | — |
| TASK-6b.7 | 5 убийц Фуллертон + 4+3 цели Бонд + Level 8 Experience (Bible 11.5.6, 11.5.7) | M | 🔴 | ⬜ | — |
| TASK-6b.8 | 12-point economy checklist (Bible 6.13.4) | L | 🔴 | ✅ | TASK-5b.9 |
| TASK-6b.9 | 11 narrative document types (Bible 11.4.1) | L | 🔴 | ⬜ | — |
| TASK-6b.10 | Universal Design Validator 10 уровней (Bible 11.6.1) | XL | 🔴 | ⬜ | TASK-6b.1 |
| TASK-6b.11 | Adaptive prioritization по жанру (Bible 11.6.2) | M | 🔴 | ⬜ | — |
| TASK-6b.12 | Починить hardcoded weights, clamp, `stages_completed` | S | 🔴 | ⬜ | — |
| TASK-6b.13 | `enrichChecklist` в ai-service.ts + persist `ai_insights` | M | 🟡 | ⬜ | — |
| TASK-6b.14 | Расширить Prisma `ProjectChecklist` + types/gdd.ts (9 новых полей) | M | 🟡 | ⬜ | — |
| TASK-6b.15 | Унифицировать response shape + dedup endpoints | S | 🟡 | ⬜ | — |
| TASK-6b.16 | Pipeline runner → `/checklist/validate` | S | 🔴 | ⬜ | TASK-6b.1 |
| TASK-6b.17 | Unit + integration тесты (~120 тестов) | L | 🟢 | ⬜ | Все остальные |

---

## Кросс-блоковые зависимости

### Блок-зависимости (граф)

```
Block 1 (MechanicsDB)
  ├──→ Block 3 (uses mechanic IDs)
  ├──→ Block 6b (uses mechanic set for validation)
  └──→ Block 5b (uses genre for resource presets)

Block 3 (MDA)
  ├──→ Block 4 (uses machinationsModel skeleton)
  ├──→ Block 6 (uses aestheticProfile, ludonarrativeCheck)
  └──→ Block 6b (uses lensValidation, bondValidation)

Block 4 (Balance)
  └──→ Block 6b (uses balanceResult for runBalanceCheck)

Block 5a (Progression)
  └──→ Block 5b (uses economyLink)

Block 5b (Economy)
  ├──→ Block 6b (uses economyResult for runEconomyCheck)
  └──→ Block 6 (uses monetizationSpec)

Block 6 (GDD)
  └──→ Block 6b (uses gdd for runDocumentationCheck)
```

### Критические зависимости задач

| Задача | Зависит от | Причина |
|--------|-----------|---------|
| TASK-1.2 | TASK-1.1 | `compatibility_score` зависит от заполненных `genres` |
| TASK-1.5 | TASK-1.1 | `/concept/[id]/validate` пересчитывает compatibility |
| TASK-1.8 | TASK-1.1 | `buildMechanicSetForGenre` использует `genres` |
| TASK-1.13 | TASK-1.1 | Тип `MechanicSet` зависит от структуры mechanics |
| TASK-1.14 | TASK-1.1 | MechanicsDB Levels 0-2 — расширение поверх Level 3 |
| TASK-2.2 | TASK-1.6 | Тип по эстетике требует валидных эстетик |
| TASK-2.4 | TASK-2.8 | Замкнутость требует реальных resources |
| TASK-2.8 | TASK-2.1 | Параметризованные steps дают реальные resources |
| TASK-3.1 | TASK-1.1 | Namespace alignment требует MechanicsDB genres |
| TASK-3.2 | TASK-3.1 | Перебор динамики требует canonical mechanic IDs |
| TASK-3.3 | TASK-3.2 | Match scores требуют всех динамик |
| TASK-3.4 | TASK-3.1 | Reverse MDA требует namespace |
| TASK-3.6 | TASK-1.6 | Загрузка aestheticProfile требует валидных эстетик |
| TASK-3.19 | TASK-1.1 | Semantic categorization требует genre_affinity |
| TASK-4.2 | — | Независимо, но рекомендуется после TASK-4.1 |
| TASK-5a.7 | TASK-3.6 | Pipeline params требуют фикса MDA |
| TASK-5b.7 | TASK-3.6 | Economy params требуют фикса MDA |
| TASK-5b.15 | TASK-5b.1 | Persist ai_insights требует enrichEconomy |
| TASK-6.4 | TASK-6.1 | derive для missing секций требует расширения FORMAT_SECTIONS |
| TASK-6.8 | TASK-6.6 | Universal Design Validator требует `/gdd/checklist` fixed |
| TASK-6b.8 | TASK-5b.9 | Economy checklist требует 12-point impl |
| TASK-6b.10 | TASK-6b.1 | Universal Design Validator 10 levels требует unified endpoint |
| TASK-6b.16 | TASK-6b.1 | Pipeline runner change требует unified endpoint |

---

## Рекомендуемый порядок выполнения

### Sprint 0 — Unblock Pipeline (1-2 дня, ~12ч)

Цель: сделать так, чтобы pipeline runner и test script работали корректно и производили разные результаты для разных проектов.

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-4.1 | Починить `run_pipeline_test.sh` (`elements` → `objects`) | S |
| 2 | TASK-6.5 | Починить `format` → `target_format` mismatch | S |
| 3 | TASK-3.6 | Загружать `aestheticProfile`/`genre` из `project.concept` | M |
| 4 | TASK-5a.7 | Pipeline runner: передавать `genre`/`pacing`/`monetization` | M |
| 5 | TASK-5b.7 | Деривить economy params из upstream concept | L |
| 6 | TASK-6b.16 | Pipeline runner → `/checklist/validate` | S |

**Результат**: 10 test_projects производят РАЗНЫЕ выводы.

### Sprint 1 — Block 1 Foundation (3-5 дней, ~40ч)

Цель: заполнить MechanicsDB, исправить compatibility_score, убрать невалидные эстетики.

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-1.1 | Заполнить `genres` для 128 механик MechanicsDB | XL |
| 2 | TASK-1.6 | Убрать невалидные эстетики `competition`/`strategy` | S |
| 3 | TASK-1.2 | Починить `compatibility_score` каскад | M |
| 4 | TASK-1.5 | Заменить STUB `/concept/[id]/validate` | M |
| 5 | TASK-1.8 | Починить `buildMechanicSetForGenre` | M |
| 6 | TASK-1.12 | Убрать китайские символы | S |
| 7 | TASK-1.10 | Починить USP slice boundaries | S |

**Результат**: Block 1 производит осмысленные compatibility scores.

### Sprint 2 — Block 3 MDA Fix (3-5 дней, ~30ч)

Цель: `overall_match > 0` для всех test_projects, разные aesthetic profiles.

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-3.1 | Выровнять `mechanic_id` namespace | XL |
| 2 | TASK-3.5 | Инвертировать logic в Lens #41 | S |
| 3 | TASK-3.11 | Добавить `moderate` в `EMERGENCE_BADGES` | S |
| 4 | TASK-3.2 | Перебирать все динамики эстетики | M |
| 5 | TASK-3.3 | Починить `match_scores` формулу | M |

**Результат**: Block 3 `overall_match > 0`, `converged = true` для качественных концепций.

### Sprint 3 — Block 6b Checklist Fix (2-3 дня, ~20ч)

Цель: pipeline использует rich impl вместо STUB.

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-6b.1 | Унифицировать `/gdd/checklist` | M |
| 2 | TASK-6.6 | Заменить STUB на `lib/checklist-logic.ts` | M |
| 3 | TASK-6b.12 | Починить hardcoded weights, clamp | S |

**Результат**: Pipeline runner использует реальную checklist validation.

### Sprint 4 — Block 5b Economy Fix (5-7 дней, ~50ч)

Цель: убрать `Math.random()`, создать `enrichEconomy`, исправить pathologies.

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-5b.1 | Создать `enrichEconomy` | L |
| 2 | TASK-5b.3 | Заменить `Math.random` в profitability | M |
| 3 | TASK-5b.6 | Real Monte Carlo с mulberry32 PRNG | L |
| 4 | TASK-5b.4 | Вывести faucet/drain из actual flows | L |
| 5 | TASK-5b.5 | Починить stallCount threshold | M |
| 6 | TASK-5b.2 | Починить feedback_loops nodes | M |
| 7 | TASK-5b.15 | Перенести AI enrichment ДО persist | S |

**Результат**: Block 5b производит детерминированные, осмысленные результаты.

### Sprint 5 — Block 2 Core Loop Fix (5-7 дней, ~50ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-2.1 | Параметризовать `buildSteps` по типу | XL |
| 2 | TASK-2.2 | Классифицировать тип по эстетике | M |
| 3 | TASK-2.8 | Убрать `dead_resources` из default template | M |
| 4 | TASK-2.4 | Реальная проверка замкнутости | M |
| 5 | TASK-2.3 | Реализовать 7 Bible патологий | L |
| 6 | TASK-2.16 | Bible-justified threshold `overallPassed` | S |

### Sprint 6 — Block 4 Balance Fix (5-7 дней, ~60ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-4.3 | 7 Schreiber curves | M |
| 2 | TASK-4.4 | Weighted attribute importance | M |
| 3 | TASK-4.5 | Real Nash equilibrium | L |
| 4 | TASK-4.7 | Machinations graph + 8 feedback characteristics | L |
| 5 | TASK-4.9 | 8 balance pathologies | XL |
| 6 | TASK-4.10 | Persist `ai_insights` | M |

### Sprint 7 — Block 6 GDD Fix (7-10 дней, ~80ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-6.1 | Расширить `FORMAT_SECTIONS["full_gdd"]` до 38 секций | XL |
| 2 | TASK-6.2 | Расширить `FORMAT_SECTIONS["modular"]` до 13 | M |
| 3 | TASK-6.3 | derive для 8 narrative секций | L |
| 4 | TASK-6.4 | derive для 17 missing Bible секций | XL |
| 5 | TASK-6.7 | Удалить dead code `enrichGddSection` | M |
| 6 | TASK-6.9 | Перенести `enrichGdd` до persist | M |

### Sprint 8 — Block 5a Progression Fix (3-5 дней, ~30ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-5a.1 | 7 curves | XL |
| 2 | TASK-5a.2 | Формула perceived difficulty | L |
| 3 | TASK-5a.3 | Genre-aware `TIER_ARCHETYPES` | L |
| 4 | TASK-5a.5 | Починить `" elemental_attack"` | S |

### Sprint 9 — Block 6b Universal Design Validator (10-14 дней, ~150ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-6b.2 | 113 линз Шелла | XL |
| 2 | TASK-6b.3 | 8 фильтров идеи Шелла | L |
| 3 | TASK-6b.4 | 6 эвристик Аптона | M |
| 4 | TASK-6b.5 | 7-point Rolling/Morris | L |
| 5 | TASK-6b.6 | 7 методов Бонд | M |
| 6 | TASK-6b.7 | 5 убийц Фуллертон + 4+3 цели Бонд | M |
| 7 | TASK-6b.8 | 12-point economy checklist | L |
| 8 | TASK-6b.9 | 11 narrative document types | L |
| 9 | TASK-6b.10 | Universal Design Validator 10 уровней | XL |
| 10 | TASK-6b.11 | Adaptive prioritization по жанру | M |

### Sprint 10 — Block 5b Bible Compliance (5-7 дней, ~60ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-5b.8 | 6 патологий Bible 6.10 | L |
| 2 | TASK-5b.9 | 12-point validation checklist | XL |
| 3 | TASK-5b.10 | Расширить GENRE_RESOURCE_PRESETS до 15 жанров | L |
| 4 | TASK-5b.11 | 16+ Machinations patterns | L |
| 5 | TASK-5b.12 | 8-мерный профиль петли ОС | M |

### Sprint 11 — Tests (по всем блокам, ~80ч)

| Порядок | Task ID | Описание | Сложность |
|:-------:|---------|----------|:---------:|
| 1 | TASK-1.16 | Block 1 tests | L |
| 2 | TASK-2.20 | Block 2 tests | L |
| 3 | TASK-3.20 | Block 3 tests | L |
| 4 | TASK-4.18 | Block 4 tests | L |
| 5 | TASK-5a.17 | Block 5a tests | L |
| 6 | TASK-5b.18 | Block 5b tests | L |
| 7 | TASK-6.20 | Block 6 tests | L |
| 8 | TASK-6b.17 | Block 6b tests | L |

---

## Метрики успеха (Definition of Done)

После завершения всех задач рефакторинга:

### Качественные

- ✅ Все 10 `test_projects/*/04_balance.json` содержат полный `FullBalanceResponse` (не 422 ошибку)
- ✅ Все 10 `test_projects/*/03_mda.json` имеют `overall_match > 0` (не 0)
- ✅ Все 10 `test_projects/*/01_concept.json` имеют `compatibility_score > 0` (не 0)
- ✅ Все 10 `test_projects/*/07_gdd.json` имеют РАЗНЫЕ narrative секции (не дубли ludonarrativeCheck)
- ✅ Все 10 `test_projects/*/08_checklist.json` имеют РАЗНЫЕ scores (не 53 для всех)
- ✅ `ai_insights` сохраняется в БД для всех блоков (не только Block 2)
- ✅ `Math.random()` отсутствует в детерминированных блоках 4 и 5b
- ✅ `as unknown as` casts отсутствуют в `concept/generate/route.ts` и `mda/analyze/route.ts`
- ✅ Китайские символы `除非`, `扩充`, `摩擦` отсутствуют в кодовой базе

### Количественные

- ✅ MechanicsDB: 128 механик с заполненными `genres` массивами (минимум 5 жанров)
- ✅ Bible compliance: ≥ 80% правил реализованы (vs текущие ~7%)
- ✅ Test coverage: ≥ 70% для `src/app/api/v1/` и `src/lib/`
- ✅ Количество секций в `full_gdd`: 38 (vs 21)
- ✅ Количество секций в `modular`: 13 (vs 10)
- ✅ Количество линз Шелла в `runLensCheck`: 113 (vs 9)
- ✅ Количество патологий в Block 4: 8 (vs 3)
- ✅ Количество патологий в Block 5b: 6 (vs 4)
- ✅ Количество checklist rules: ~220 (vs ~15)
- ✅ Количество Schreiber curves в Block 4: 7 (vs 0 — текущая `0.6 * cost^0.8` не из списка)
- ✅ Количество progression curves в Block 5a: 7 (vs 5)

### Совместимость

- ✅ TypeScript компилируется без `as unknown as` casts
- ✅ Prisma schema миграция обратима
- ✅ API responses обратно совместимы (старые поля сохраняются, новые добавляются)
- ✅ Frontend-компоненты (`src/components/gidede/*`) работают без изменений

---

## Связанные документы

| Документ | Описание |
|----------|----------|
| `docs/audit/AUDIT_REPORT.md` | Общий отчёт аудита (25 критичных + 35 средних находок) |
| `docs/audit/REFACTOR_PLAN_block_1.md` | План Блока 1 — Концепция (16 задач) |
| `docs/audit/REFACTOR_PLAN_block_2.md` | План Блока 2 — Core Loop Designer (20 задач) |
| `docs/audit/REFACTOR_PLAN_block_3.md` | План Блока 3 — MDA Lab (20 задач) |
| `docs/audit/REFACTOR_PLAN_block_4.md` | План Блока 4 — Баланс (18 задач) |
| `docs/audit/REFACTOR_PLAN_block_5a.md` | План Блока 5a — Прогрессия (17 задач) |
| `docs/audit/REFACTOR_PLAN_block_5b.md` | План Блока 5b — Экономика (18 задач) |
| `docs/audit/REFACTOR_PLAN_block_6.md` | План Блока 6 — GDD Generator (20 задач) |
| `docs/audit/REFACTOR_PLAN_block_6b.md` | План Блока 6b — Чек-лист (17 задач) |
| `worklog.md` | Worklog всех sub-agents аудита |

---

## История изменений трекера

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-08-01 | 1.0 | Создан трекер. 146 задач из 8 планов рефакторинга. |
| 2026-08-01 | 1.1 | Sprint 1 (Block 1) завершён: TASK-1.1, 1.2, 1.5, 1.6, 1.8, 1.10, 1.12 — 7 задач выполнено (3 критичных, 3 средних, 1 низкий). MechanicsDB: 128 механик с заполненными `genres`; `compatibility_score` теперь реалистично отражает genre match (0-100); `/concept/[id]/validate` использует ту же schema что `/concept/generate`; невалидные эстетики `competition`/`strategy` заменены на Hunicke 8; китайские символы `除非`/`扩充`/`摩擦` удалены; `buildMechanicSetForGenre` заполняет все 5 категорий. |
| 2026-08-01 | 1.2 | Sprint 1 (Block 1) расширено: TASK-1.17 (primary + subgenres), TASK-1.18 (cross-genre mechanics) — добавлены по запросу пользователя. `inferGenres()` возвращает `{ primary, subgenres }` (макс. 3 subgenres по keyword-score); `buildMechanicSetForGenres()` ищет механики по всем жанрам + добавляет ~18% cross-genre механик с aesthetic overlap (но без genre overlap). Body принимает `subgenres: string[]`. Response включает `primary_genre`, `subgenres`, `mechanic_set.cross_genre_mechanics[]`, `mechanic_set.genres_searched[]`. Каждая механика в категориях помечается `cross_genre: true` и `matched_genres: string[]`. Sanity test: rpg → 14 mechanics, 86% compat, 2 cross-genre; action+rpg+roguelike → 14 mechanics, 64% compat, 2 cross-genre (Головоломки, Мультицели). |
| 2026-08-01 | 1.3 | Sprint 2 (Block 1) завершён: TASK-1.3, 1.4, 1.7, 1.9, 1.11, 1.13, 1.15, 1.16 — 8 задач выполнено. Реальные 8 idea filters (clarity/novelty/feasibility/audience_fit/market_fit/differentiation/emotional_impact/sustainability с keyword analysis, multi-genre bonus, cross-genre bonus). Реальные 5 core questions (core verb detection, moment-to-moment detail, long-term goal, fun source, return reason). `pickAesthetics` с word boundaries + dedup (regex `\bKEYWORD\b`, ru+en keywords). Bilingual core loop candidates переведены на русский («Применить «Броня»» вместо «Engage in Броня»). Persist `title`, `aiInsights`, `generationMetadata` в Prisma `ProjectConcept` (миграция применена). Тип `StructuredMechanicSetV2` + `MechanicEntry` + `CrossGenreMechanic` в shared/interfaces.ts, UI-компоненты обновлены. `validateConceptInput()` с genre aliases (shooting→shooter, td→tower_defense, etc.), max 3 subgenres, max 20 forbidden. 108 unit тестов (vitest), coverage 97.74% stmts / 95.21% branches / 98.18% functions. |
| 2026-08-01 | 1.4 | **Block 1 COMPLETE (18/18)**: TASK-1.14 (MechanicsDB Levels 0-2) — стратегическое расширение. Новый модуль `src/lib/mechanics-taxonomy.ts`: Level 0 (7 фундаментальных типов Шелла: Movement/Shooting/Combat/Collection/Building/Talking/Trading), Level 1 (5 структурных типов Адамса/Дорманс: Space/Objects/Actions/Rules/Skill), Level 2 (18 паттернов: free_roam, real_time_combat, crafting_system, dialogue_trees, bullet_hell и др.). Функция `getMechanicHierarchy(mechanicGroup)` строит путь L0→L1→L2 для любой механики. 24 unit теста, total 132 теста, coverage сохранён на 97.74%. **Block 1 полностью завершён — все 18 задач выполнены.** |

---

*Для обновления статуса задач редактируйте таблицы выше, меняя символ в колонке "Статус".*

| 2026-08-01 | 2.0 | **Block 2 COMPLETE (20/20)**: Все 20 задач Блока 2 (Core Loop Designer) выполнены. Новые модули: `src/lib/coreloop/steps.ts` (7 параметризованных builders, genre-based duration, customSteps с тип-зависимыми ресурсами), `classify.ts` (тип по aesthetic Bible 4.11.1, sub_types для TD/rhythm/puzzle, реальный hasBraking), `pathologies.ts` (7 Bible 4.10 патологий + 6 type-specific, && логика), `validation.ts` (реальная замкнутость через resource flow, 5 вопросов Гэри, all-5-required threshold), `hierarchy.ts` (6 уровней Bible 4.3 + type-specific). Prisma миграция: aiInsights, latencyMs, modelsUsed, garyFiveQuestions. GET /coreloop/[projectId] route. enrichCoreLoop расширенный prompt. 240 unit тестов (90 новых для Block 2), coverage 93.39% stmts / 86.86% branches / 99.3% functions. TypeScript компилируется без ошибок. |
