# Gidede — Аудит алгоритмов пайплайна

**Версия отчёта**: 1.0  
**Дата**: 2026-08-01  
**Аудиторы**: Gidede Audit Bot (sub-agents `audit-blocks-1-4`, `audit-blocks-5-8`)  
**Объект аудита**: ветка `nextjs-port`, коммит `b55ec7e` (HEAD на момент аудита)  
**Спецификация**: `docs/bible/bible_2_*.md` (12 разделов, ~8 145 строк)  
**Реализация**: `src/app/api/v1/*/route.ts`, `src/lib/*.ts`, `src/constants/*.ts`

---

## 0. executive summary

Полный пайплайн Gidede состоит из 8 функциональных блоков, покрывающих путь от идеи до GDD. Аудит сравнил заявленные в Библии геймдизайна алгоритмы с фактической реализацией в кодовой базе.

**Ключевая находка**: структурно все 8 блоков работают (возвращают валидный JSON, персистят в Prisma, не падают). Однако в **5 из 8 блоков** есть критические дефекты, при которых ключевые метрики **всегда** принимают одно и то же значение независимо от входных данных — то есть алгоритм фактически не выполняет заявленную работу.

### Карта серьёзности

| Блок | 🔴 Критично | 🟡 Средне | 🟢 Сильно | Главный риск |
|------|:-----------:|:---------:|:---------:|--------------|
| 1. Концепция | 2 | 5 | 5 | `compatibility_score = 0` всегда |
| 2. Core Loop | 1 | 5 | 4 | default template полностью захардкожен |
| 3. MDA | 1 | 6 | 4 | `overall_match = 0` всегда, `converged = false` всегда |
| 4. Баланс | 2 | 7 | 5 | не тестировался в pipeline (422 в test_projects) |
| 5a. Прогрессия | 0 | 6 | 3 | perceived difficulty formula не реализована |
| 5b. Экономика | 7 | 0 | 3 | `Math.random()` в детерминированных вычислениях |
| 6. GDD | 6 | 4 | 4 | 21 секция вместо 38; narrative дублируются |
| 6b. Чек-лист | 6 | 2 | 4 | pipeline вызывает STUB вместо rich impl |
| **Итого** | **25** | **35** | **32** | — |

### Топ-10 критических находок

1. 🔴 **MechanicsDB genres: пустые массивы** — все 128 записей содержат `'genres': []` → `compatibility_score = 0` для каждого проекта.
2. 🔴 **MDA `overall_match = 0` всегда** — `buildClassicMDA` берёт только `[0]` динамику эстетики, mechanic_id не совпадают между lookup-таблицами.
3. 🔴 **Block 4 (Баланс) никогда не тестировался** — `scripts/run_pipeline_test.sh` передаёт `elements` вместо `objects`, все test_projects содержат 422-ошибку.
4. 🔴 **STUB вместо Universal Design Validator** — pipeline runner вызывает `/gdd/checklist` (121 строка), а не `lib/checklist-logic.ts` (743 строки с реальной логикой). Реализовано ~15 правил из ~220 заявленных.
5. 🔴 **Economy AI-обогащение использует `enrichProgression`** — функции `enrichEconomy` не существует, AI даёт советы по прогрессии вместо экономики.
6. 🔴 **Economy: `Math.random()` в детерминированных вычислениях** — `profitability = 0.8 + Math.random() * 0.4`, simulation использует `Math.random()`. Результаты не воспроизводимы.
7. 🔴 **Economy: hardcoded патологии по классу ресурса** — для RPG всегда 2 critical "Инфляция" патологии независимо от actual flows.
8. 🔴 **GDD: 21 секция вместо 38** — пропущены Управление, Камера, Режимы, Диалоги, Квесты, Лор, Дизайн уровней, HUD/UI, Меню, Визуальный стиль, Звук, Социальные, Мета-игра, Tech/Art Bible, Milestones.
9. 🔴 **GDD: 8 narrative-секций возвращают один и тот же JSON** — `deriveSectionContent` для всех 8 narrative кейсов возвращает `JSON.stringify(mda.ludonarrativeCheck)`.
10. 🔴 **Economy: feedback_loops nodes содержат несуществующие ID** — `"converter"` и `"consumable"` не существуют в графе.

### Системные проблемы

- **AI enrichment persist inconsistency** — Block 2 сохраняет `ai_insights` в БД, Blocks 1, 3, 4, 5, 6 — НЕТ. При перезагрузке проекта данные теряются.
- **Non-determinism в детерминированных блоках** — `Math.random()` в Block 4 Monte Carlo и Block 5b simulation.
- **Dead code в AI-сервисе** — `enrichGddSection` объявлена, не вызывается. `enrichEconomy` не существует.
- **Две параллельные реализации для чек-листа** — `/gdd/checklist` (STUB) и `/checklists/[action]` (rich). Pipeline использует STUB.
- **Type system bypasses** — `as unknown as string` для невалидных aesthetic values; `as unknown as { feedback_loops: ... }` в Block 4.
- **Bilingual typos в system prompts** — китайские символы `"除非"`, `"扩充"` в `ai-service.ts:63,333`.
- **Hardcoded defaults в pipeline runner** — `STAGES[3].buildBody` в `run-full-pipeline/route.ts:126-135` передаёт 4 hardcoded balance-объекта.

---

## 1. Блок 1 — Генератор концепции (алгоритм 3.1)

### 1.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_2_elements.md` описывает MechanicsDB как 5-уровневую таксономию:

- **Level 0** — 7 фундаментальных типов Шелла (Movement, Shooting, Combat, Collection, Building, Talking, Trading)
- **Level 1** — 5 структурных типов Адамса/Дорманс (Space, Objects, Actions, Rules, Skill)
- **Level 2** — 16 паттернов
- **Level 3** — 127 механик SW.BAND в 15 группах + матрица «Механика → Жанр» 127×6 с трёхуровневой оценкой релевантности (low/medium/high)
- **Level 4** — жанровые шаблоны

Принцип генерации: top-down от фундаментальных типов к дискретным механикам через aestetics → dynamics → mechanics → pattern.

### 1.2. Фактическая реализация

`src/app/api/v1/concept/generate/route.ts` (728 строк), 7 стадий:

1. **Genre inference** — keyword table `GENRE_KEYWORDS` (17 записей) с substring-match по `idea`.
2. **Aesthetic profile** — `GENRE_AESTHETICS` (29 жанров → primary/secondary/tertiary) + keyword overrides в `pickAesthetics` (story/narrative → narrative; explore/discover → discovery; build/create → expression; team/friends → fellowship).
3. **Dynamics profile** — `AESTHETIC_TO_DYNAMICS` lookup (8 aesthetics → 3 динамики каждый).
4. **Mechanic set** — `buildMechanicSetForGenre()` из `mechanics-db.ts` + fallback к `GENRE_MECHANICS.default` если группа пуста.
5. **Core Loop + USP candidates** — 3 закодированных шаблона + 3 USP из строки idea.
6. **Validation report** — Triangle of Weirdness (weird+appealing+credible, score = 0.4+0.3+0.3), 5 core questions (booleans), 8 idea filters (0-1 scores), overall = 0.3·triangle + 0.3·questions + 0.4·filters.
7. **One-pager assembly** — title, synopsis, gameplay_description, unique_features, competitors, rating.

### 1.3. Несоответствия спецификации

- MechanicsDB Level 0-2 (фундаментальные/структурные типы/паттерны) — **полностью отсутствуют**. Реализован только Level 3.
- «Матрица Механика → Жанр» 127×6 — **полностью отсутствует**.
- Принцип top-down генерации не соблюдён: механики выбираются по жанру, а не от aesthetics → dynamics → mechanics.
- 128 механик вместо 127 (off-by-one — несущественно, но говорит о небрежности).

### 1.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 1.1 | 🔴 | `src/lib/mechanics-db.ts` (все 128 записей) | `'genres': []` для КАЖДОЙ механики. `findMechanicsByGenre()` всегда возвращает `[]`, `buildMechanicSetForGenre()` fallback на всю БД, `compatibility_score = round(0/allSelected.length × 100) = 0` **всегда**. Проверено на 10 test_projects: `compatibility_score: 0` везде. |
| 1.2 | 🔴 | `route.ts:412` (`buildValidationReport`) | `credible = mechanicSet.compatibility_score >= 60` — всегда `false` из-за бага 1.1. Каскадно ломает: warning "Mechanic compatibility below 60%" всегда появляется; `eight_filters.feasibility.score` всегда 0.5; `five_questions["Why would a player return tomorrow?"]` всегда false. |
| 1.3 | 🟡 | `route.ts:83,91,98,102` | `GENRE_AESTHETICS` содержит невалидные эстетики `"competition"` и `"strategy"` (это Yee motivations, не Hunicke 8) — реализованы через `as unknown as string` cast. Затронуты: `fighting`, `tactical_rpg`, `tower_defense`, `racing`. В `AESTHETIC_TO_DYNAMICS` этих ключей нет → fallback к `["exploration"]`/`["habit_loops"]`. |
| 1.4 | 🟡 | `route.ts:191-194` (`pickAesthetics`) | substring-match без границ слов: `lower.includes("build")` матчит "deck-building", "building", "rebuild". Keyword "team" матчит "steam". Не проверяет дубликаты с secondary/tertiary. Card_Lords (description "Deck-building card battler") получил `primary=expression, secondary=discovery, tertiary=expression` — дубликат. |
| 1.5 | 🟡 | `/api/v1/concept/[id]/validate/route.ts:32-37` | stub-валидация. Считает `25+25+25+25 = 100` за существование USP/coreloop/mechanics/usp. Не пересчитывает Triangle/5 questions/8 filters. Возвращает **другую schema**: `overall_score` 0-100 (vs 0-1 в generate), `triangle_of_weirdness.score` 0-100 (vs `triangle_check.score` 0-1), поля `idea_filters` (vs `eight_filters`). |
| 1.6 | 🟡 | `ai-service.ts:63` | system prompt содержит китайские символы `"除非 пользователь просит подробнее"` ("除非" = "unless"). Переводной артефакт. |
| 1.7 | 🟡 | `route.ts` (general) | 3 USP candidates формируются из `idea.slice(0, 100)`, `idea.slice(100, 200)`, `idea.slice(200, 300)` — если idea короче 300 символов, 2-й и 3-й USP будут пустыми или дубликатами. |

### 1.5. Сильные стороны

- `enrichConcept()` (ai-service.ts:224-302) — корректная LLM-интеграция: запрашивает JSON, strip code fences, fallback на smart-quote fix, возвращает null при ошибке.
- Структура `ConceptGenerationResult` точно соответствует `src/types/concept.ts`.
- 7-стадийный pipeline последователен, persist через Prisma upsert корректен.
- `GENRE_COMPETITORS` таблица (10 жанров × 3 reference games) — полезная детерминированная база.
- 8 idea filters (clarity/novelty/feasibility/audience_fit/market_fit/differentiation/emotional_impact/sustainability) — соответствует Bible 2.1.3.

---

## 2. Блок 2 — Core Loop Designer (алгоритм 3.2)

### 2.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_4_core_loop.md` (раздел 4.11) определяет 7-шаговый метод:

1. Определить целевую эстетику + жанр → тип Core Loop (Вызов→Engine, Открытие→Economy, Товарищество→Ecology, Подчинение→Engine).
2. Сформулировать Core Loop в одном предложении (5 вопросов Гэри: цикл? конфликт? ресурсы? взаимодействие? цель?).
3. Определить масштаб (10с для шутера → 15мин для стратегии).
4. Спроектировать конверсионный цикл (каждый ресурс имеет источник и сток, не чисто прибыльный/убыточный).
5. Построить вложенные петли (микро→малый→средний→крупный→макро).
6. Проверить 7 патологий: Runaway, Deadlock, Stall, **Grind**, **Frustration Plateau**, **Disconnected Loops**, **Loop Overload**.
7. Прототип и валидация («30 секунд веселья»).

### 2.2. Фактическая реализация

`src/app/api/v1/coreloop/design/route.ts` (945 строк), 5 стадий:

1. `buildSteps(mechanics, customSteps, type)` — если customSteps, slice(0,10) map с `feedback_type = i%3 ? positive/negative/neutral`; иначе **hardcoded 5-step template**: "Find target (m0)" / "Engage (m1)" / "Collect rewards (m2)" / "Upgrade (m3)" / "Return to base (m4)".
2. `classifyStructuralType()` — type из `desiredLoopType` или `GENRE_DEFAULT_LOOP_TYPE[genre]`; sub_type из consumables/currencies/mechanics.length%2.
3. `buildLoopHierarchy()` — 6 уровней (micro/small/medium/large/macro/meta) с canned actions.
4. `detectPathologies()` — 7 патологий + 3 type-specific (tower_defense/rhythm/puzzle).
5. `buildValidation()` — 5 критериев: fun_check, loop_closedness, resource_sufficiency, pathology absence, step count.

### 2.3. Несоответствия спецификации

- Bible 4.10 патологии: реализованы 3 (Runaway/Deadlock/Stall) + 4 **НЕ БИБЛЕЙСКИХ** (brittleness, oscillation, stagnation, triviality). Пропущены: Grind, Frustration Plateau, Disconnected Loops, Loop Overload.
- Bible 4.11.1: structural type должен определяться **aesthetic** (Вызов→Engine, Открытие→Economy). Реализация — по жанру.
- Bible 4.11.2 (5 вопросов Гэри) — не реализован.
- Bible 4.11.3 (масштаб по жанру) — `duration_estimate` захардкожен: 6/10/4/8/5 сек для default 5-step template.

### 2.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 2.1 | 🔴 | `route.ts:207-278` (`buildSteps`) | default 5-step template **полностью захардкожен**. Параметр `type` передаётся, но **не используется** внутри функции. Mechanics просто подставляются в строку `action` (`"Find target (${m0})"`), не влияя на структуру цикла. Для всех 10 test_projects шаги идентичны независимо от жанра. |
| 2.2 | 🟡 | `route.ts:559-563` (`buildValidation`) | `loopClosedness.is_closed = true` — **всегда true**. Никакой реальной проверки замкнутости: просто строка `Last step feeds back into first step`. |
| 2.3 | 🟡 | `route.ts:131` | `hasBraking = type !== "engine" || subType === "braked_engine"`. Для `type === "engine"` с `subType === "pure_engine"` — `hasBraking = false`. Логика запутана: `type !== "engine"` для всех не-engine даёт true, хотя ecology/hybrid могут не иметь тормозов. |
| 2.4 | 🟡 | `route.ts:348,374,386,399,414,426` | каждая патология добавляется если `likely.includes(name) || <condition>`. Из-за `||` патология добавляется даже если не "likely", но выполняется condition. Логика запутана. |
| 2.5 | 🟡 | `route.ts:593` | `overallPassed = checklistPassed >= 4` — произвольный порог, не обоснован в Библии. |
| 2.6 | 🟡 | `route.ts:938` | `void safeJsonParse;` — dead code, импорт только чтобы удовлетворить linter. |

### 2.5. Сильные стороны

- Type-specific pathologies для tower_defense (Wave Imbalance, No Recovery), rhythm (Off-Beat Penalty, Tempo Drift), puzzle (Stuck State, Pattern Blindness) — сильное расширение Библии.
- `resource_sufficiency` (dead_resources / unsourced_consumables) — корректная реализация проверки resources из Bible 4.11.4.
- `buildRecommendations()` связывает каждую патологию с её correction и priority.
- 6-уровневая иерархия (micro→meta) точно соответствует Bible 4.3 (шесть временных масштабов).

---

## 3. Блок 3 — MDA Lab (алгоритм 3.3)

### 3.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_3_mda_framework.md` описывает двойной MDA-процесс:

- **Generative pass (Reverse MDA)**: target aesthetics → target dynamics → required mechanics (через маппинг 3.5.4: Чувственное→Действия+Сочность, Фантазия→Прогрессия+Роль, и т.д.).
- **Analytic pass (Classic MDA)**: mechanics → dynamics → observed aesthetics → сравнение с target.
- **Shell's 113 lenses** (3.6), из них 9 приоритетных: #9 Тетрада, #11 Единство, #12 Резонанс, #30 Эмерджентность, #31 Пространство действий, #40 Треугольность, #41 Доминантная стратегия, #69 Кривая интереса, #74 Свобода vs управляемость.
- **Bond 4×3 matrix** (3.7): Механика/История/Эстетика/Технология × Фиксированный/Динамический/Культурный + ludonarrative (Гармония/Ирония/Диссонанс).

### 3.2. Фактическая реализация

`src/app/api/v1/mda/analyze/route.ts` (875 строк), 6 стадий:

1. `aestheticProfile` — входные primary/secondary/tertiary.
2. `buildDynamicsTarget()` — `AESTHETIC_TO_DYNAMICS` lookup, emergence_level по totalDynamics (3/5/7).
3. `buildMechanicCandidateSet()` — `DYNAMICS_TO_MECHANICS` lookup, synergy_pairs (round-robin 3 шт.), conflict_pairs (1 шт.).
4. `buildMechanicSet()` — `GENRE_DEFAULT_MECHANICS[genre]` + existing/required/forbidden + aesthetic_coverage + Adams/Dormans patterns (5 шт.) + compatibility_score (50 + patterns*8 + cov*2).
5. `buildClassicMDA()` — gameplay_sequence (3 шага), feedback_loops (2 canned), predicted_aesthetics (overlap-based), match_scores, converged = overall_match >= threshold.
6. `buildLensValidation()` — 9 lenses, score по category.
7. `buildBondValidation()` — matrix 4×3 с canned contents, row/col consistency, ludonarrative.

### 3.3. Несоответствия спецификации

- Bible 3.5.4 маппинг «Эстетика → Динамика → Механика» — реализован, но `DYNAMICS_TO_MECHANICS` использует вымышленные mechanic_id (`"difficulty_settings"`, `"voice_acting"`, `"backstory_choices"`), которые **не совпадают** ни с MechanicsDB-именами (`"Древо технологий"`, `"Здоровье"`), ни с `GENRE_DEFAULT_MECHANICS` (`"inventory_management"`, `"xp_leveling"`). Overlap всегда 0.
- Bible 3.6: 113 линз Шелла — реализованы только 9 приоритетных.
- Bible 3.7.3: матрица 4×3 требует **реального заполнения** ячеек. Реализация — canned contents, одинаковые для всех проектов.

### 3.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 3.1 | 🔴 | `route.ts:402` (`buildClassicMDA`) | `const mechs = DYNAMICS_TO_MECHANICS[(AESTHETIC_TO_DYNAMICS[a] || [""])[0]] || [];` — берёт только **ПЕРВУЮ** динамику эстетики, игнорируя 2 и 3. Genre-default mechanics никогда не overlap. **Результат: `predictedAesthetics[a] = 0` для всех aesthetics → `matchScores[a] = 0` → `overall_match = 0` ВСЕГДА, `converged = false` ВСЕГДА, `iterations = 3` ВСЕГДА.** Подтверждено на Shadow_Depths. Это инвалидирует весь Classic MDA pass. |
| 3.2 | 🟡 | `route.ts:511` (`buildLensValidation`) | `if (lens.id === 41 && score > 0.7) { issuesFound.push("Possible dominant strategy detected"); }` — backwards logic. Линза #41 «Доминантная стратегия» должна flag когда score **НИЗКИЙ** (доминантная стратегия есть = плохо). Реализация flag когда score **ВЫСОКИЙ** — противоположность смыслу. |
| 3.3 | 🟡 | `route.ts:306-321` | `compatibility_score = min(100, round(50 + patterns*8 + aestheticCoverage*2))`. Из 5 patterns 4 всегда `present: true` (Engine pattern hardcoded true, Dynamic coupling если core_dynamics.length>=2, Feedback loop reinforcing если progression.length>0, Balancing если combat.length>0). Минимум 50+32+0=82, обычно 90+. Score **не отражает реальную совместимость** — всегда высокий. Shadow_Depths: `compatibility_score: 94` при `overall_match: 0` — внутреннее противоречие. |
| 3.4 | 🟡 | `route.ts:620-622` (`buildBondValidation`) | `ludonarrative.result = "Гармония"` — **всегда** hardcoded. Независимо от mechanic set. |
| 3.5 | 🟡 | `constants/mda.ts:36-41` | `EMERGENCE_BADGES` содержит `nominal`, `weak`, `multiple`, `strong` — **не содержит `moderate`**, хотя `route.ts:144,146` использует `"moderate"` как default. UI fallback на `EMERGENCE_BADGES.nominal` — неправильный badge. |
| 3.6 | 🟡 | `route.ts:828,846` | `machinationsModel: JSON.stringify({ nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] })` — сохраняет пустой machinations graph. Block 4 должен заполнять это, но persist в Block 3 сохраняет пустоту. |

### 3.5. Сильные стороны

- 9 приоритетных линз Шелла выбраны точно по Bible 3.6.2.
- Структура Bond matrix 4×3 + row_consistency + col_consistency + ludonarrative pairs — соответствует Bible 3.7.1.
- `buildDynamicsTarget()` — корректная реализация emergence_level.
- `mechanic_candidate_set` с `uncovered_dynamics`, `synergy_pairs`, `conflict_pairs` — полезная структура.

---

## 4. Блок 4 — Баланс (алгоритм 3.4)

### 4.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_5_balance.md` описывает:

- 3 модели баланса: transitive (5.3.1), intransitive (5.3.2), situational (5.3.3) + ideal imbalance (5.3.4, ~10-15% отклонение).
- 7 кривых Шрайбера (5.4.3): identity, linear, exp, log, **triangular `y=(x²−x)/2`**, custom, obfuscation. Triangular — «наиболее используемая».
- Формула диапазона (5.5.1): `((Max−Min)×%)+Min`. Фулкрум (5.5.2): O(n) вместо O(n²).
- Взвешенная сумма (5.5.3): `Σ(Value_i × Weight_i)`, DPS = DPM/60.
- 8 характеристик петли ОС (5.6.1).
- Markov chains (5.8.1) и recursive EV (5.8.2) для бесконечных процессов.
- 8 патологий баланса (5.13): Доминантная стратегия, Runaway, Мёртвая зона, Обязательный выбор, Разрыв билдов, Инфляция, Хрупкость экологии, Воспринимаемая несправедливость.

### 4.2. Фактическая реализация

`src/app/api/v1/balance/analyze/route.ts` (1063 строки), 6 стадий:

1. `buildBalanceMap()` — primary/secondary model, anchor = `Object.keys(objects[0].attributes)[0]`.
2. `buildTransitiveResult()` — equal weights `1/attrCount`, cost-power curve `power = 0.6 * cost^0.8`, distance_from_curve → 4 статуса (overpowered/underpowered/balanced/ideal_imbalance).
3. `buildIntransitiveResult()` — payoff_matrix с cyclicalBias (i beats (i+1)%n с bias 0.4), nash_equilibrium, RPS cycles, dominated_strategies, strategy_balance (entropy/max_share/gini).
4. `buildSituationalResult()` + `buildQFactorResult()` — canned situational values (hash-based), Q-factor = 1 + sum/200.
5. `buildMonteCarloResult()` — 200 итераций с `Math.random`, win probability `0.5 + bias*0.4`, Spearman ranking_correlation, verdict (GOOD/MODERATE/POOR).
6. `buildMachinationsResult()` — graph (nodes + flows + feedback_loops), 50-tick simulation per object: `value = value - dmg + hp*0.05 + noise`.

### 4.3. Несоответствия спецификации

- Bible 5.4.3: triangular curve — не используется. Route использует `0.6 * cost^0.8` (polynomial power), не из списка 7 Schreiber curves.
- Bible 5.5.1 (формула диапазона) и 5.5.2 (фулкрум O(n)) — не реализованы.
- Bible 5.5.3: weights должны быть **выше** для важных атрибутов. Route даёт **equal weights** `1/attrCount` — нарушает принцип.
- Bible 5.6.1: 8 характеристик петли ОС — не реализованы.
- Bible 5.8.1 (Markov chains) и 5.8.2 (recursive EV) — **не реализованы**.
- Bible 5.13: 8 патологий баланса — route не реализует ни одной напрямую. `detected_pathologies` содержит только общие с Block 2.

### 4.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 4.1 | 🔴 | `scripts/run_pipeline_test.sh:108-112` | Тестовый скрипт передаёт `{"elements":[{"name":"sword","cost":100,"power":50}]}` вместо ожидаемого `{"objects": BalanceObject[]}`. Поле `elements` игнорируется, `objects` пустой → 422 VALIDATION_ERROR. **Проверено: ВСЕ 10 `test_projects/*/04_balance.json` содержат только эту 422-ошибку.** Block 4 НИКОГДА не тестировался end-to-end. |
| 4.2 | 🔴 | `route.ts:135` | `costCurveModel = "power = 0.6 * cost^0.8"` — hardcoded константы, не выведены из game data. Bible 5.4.1 требует реверс-инжиниринг из "ванильных" карт через систему уравнений. |
| 4.3 | 🟡 | `route.ts:443` (Monte Carlo) | `const winProb = 0.5 + bias * 0.4;` — bias из payoff matrix, который уже включает cyclicalBias 0.4. Эффект: для cyclic matchup winProb = 0.5 + 0.4*0.4 = 0.66. Не обосновано. |
| 4.4 | 🟡 | `route.ts:442-444` | `const i = Math.floor(Math.random() * n);` — `seed: "Math.random"` (line 542), **non-deterministic**. Результаты Monte Carlo **не воспроизводимы**. |
| 4.5 | 🟡 | `route.ts:242` (`buildIntransitiveResult`) | `cyclicalBias = ((j - i + n) % n === 1 ? 0.4 : ...)` — искусственно вводит RPS-структуру (i beats (i+1)%n). Это делает `is_intransitive=true` для n>=3 почти всегда, но это **артефакт алгоритма**, не реальный анализ. |
| 4.6 | 🟡 | `route.ts:679-680` | `if (rMax >= hp * 1.8) runawayCount++; if (rMax <= hp * 0.2) stallCount++;` — пороги 1.8 и 0.2 произвольные. |
| 4.7 | 🟡 | `route.ts:737` | `runs: 10` — hardcoded, но в коде только **1 simulation per object** (50 ticks каждый). 10 runs не выполняется. |
| 4.8 | 🟡 | `route.ts:898-905` (`buildStability`) | `machinationsResult as unknown as { ... feedback_loops: Array<{type: string}> }` — но `buildMachinationsResult` при `runMachinations=false` **не возвращает** `feedback_loops` поле. |
| 4.9 | 🟡 | `route.ts:1044-1056` | AI enrichment вызывается **после** `db.projectBalanceResult.upsert` (line 1000). Поэтому `ai_insights` попадает в HTTP response, но **не сохраняется** в БД. |

### 4.5. Сильные стороны

- `TransitiveObject` с 4 статусами (overpowered/underpowered/balanced/ideal_imbalance) — точно соответствует Bible 5.3.4 «идеальный дисбаланс» Портноу (порог 10-15%).
- `IntransitiveResult` — богатый набор метрик: `payoff_matrix`, `nash_equilibrium`, `strategy_balance` (entropy + max_share + gini), `rps_cycles`, `dominated_strategies`.
- `MonteCarloResult` — `win_rates`, `matchup_matrix`, `win_rate_spread`, `ranking_correlation` (Spearman), `balance_verdict`.
- Schema `FullBalanceResponse` точно соответствует `src/types/balance.ts`.

---

## 5a. Блок 5a — Прогрессия (алгоритм 3.5)

### 5a.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_6_economy_progression.md` (разделы 6.6-6.7):

- 5+2 типа кривых прогрессии (6.7.2 + 6.7.3): Linear, Exponential, Diminishing, Intermittent, Custom + Logarithmic, Triangular `y=(x²−x)/2`, Obfuscation.
- Формула воспринимаемой сложности (6.7.1): `(Cv + Cs) − (Pv + Ps)` где Cv — variability challenges, Cs — strategic challenge, Pv — player variability, Ps — player skill.
- 4 этапа прогрессии D&D (6.6.4): 1-4 / 5-10 / 11-16 / 17-20.
- Макро-модель RPG (6.7.4): `Переходов/час ≈ L/T`, `Стадий_контента ≈ L/2`, `Конфигураций_врагов ≥ 3×(L/2)`.

### 5a.2. Фактическая реализация

`src/app/api/v1/progression/design/route.ts` (644 строки):

- `buildCurve()` (строки 122-187) — 5 типов кривых (linear/exponential/diminishing/s_curve/intermittent/custom=polynomial). Параметры: base, growth_rate, levels.
- `TIER_ARCHETYPES` (строки 52-98) — 5 фиксированных архетипов. `numTiers` по порогам: 1-3→1, 4-10→2, 11-25→3, 26-60→4, 60+→5.
- `perceivedDifficultyTable` (строки 393-411): `target = 0.2 + (lvl/total)*0.7`, `enemyPower = powerCurve.points[lvl-1] * 1.1`.
- `unlock_tree` — 10 hardcoded имён разблокировок, `unlockEvery = floor(targetLevels/10)`.
- Validation: `no_runaway` (XP ratio > 1000=🔴, > 200=🟡), `no_grind` (hours/level > 1.5), `no_build_gaps` (max gap > 15).

### 5a.3. Несоответствия спецификации

- Только 5 кривых вместо 7 (нет Logarithmic, Triangular, Obfuscation).
- Формула perceived difficulty `(Cv + Cs) − (Pv + Ps)` — НЕ реализована (нет Cs, Ps).
- D&D 4 этапа по уровням → реализация 5 тиров по индексу с hardcoded порогами.
- `economyLink` (строки 581-588): hardcoded `primary_resources: ["xp", "gold"]` для ВСЕХ жанров.

### 5a.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 5a.1 | 🟡 | `route.ts:366` | Leading space в `" elemental_attack"` (баг в unlockNames). |
| 5a.2 | 🟡 | `route.ts:383` | `Math.min(unlockNames.length - 1, ...)` cap → для targetLevels > 100 все unlocks получают имя "prestige_reset". |
| 5a.3 | 🟡 | `route.ts:287` | `TIER_ARCHETYPES[i] || TIER_ARCHETYPES[length-1]` — для numTiers=5 archetypes всегда фиксированы, не зависят от genre/progression_type. |
| 5a.4 | 🟡 | `route.ts` (general) | Формула perceived difficulty `(Cv + Cs) − (Pv + Ps)` не реализована — есть только `target = 0.2 + (lvl/total)*0.7` без учёта player skill/strategy. |
| 5a.5 | 🟡 | `route.ts:581-588` | `economyLink.primary_resources: ["xp", "gold"]` — hardcoded для всех жанров. |
| 5a.6 | 🟡 | `route.ts` (curves) | Нет triangular curve `y=(x²−x)/2`, нет logarithmic, нет obfuscation. |

### 5a.5. Сильные стороны

- `buildCurve` — рабочая функция с корректными формулами для 5 реализованных кривых.
- Validation checks срабатывают (подтверждено в `05_progression.json`: XP ratio 942x → warning).
- AI enrichment (`enrichProgression`) — корректный LLM-вызов с fallback.

---

## 5b. Блок 5b — Экономика (алгоритм 3.6)

### 5b.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_6_economy_progression.md` (разделы 6.4-6.13):

- Machinations library 16+ паттернов (6.4.1): Static/Dynamic/Converter Engine, Engine Building, Static/Dynamic Friction, Stopping Mechanism, Escalating Challenge/Complexity, Arms Race.
- 5 классов ресурсов Шрайбера (6.5.1): Core, Subsidiary, Currency, Consumable, Meta.
- 8-мерный профиль петли ОС (6.8.2): Type, Effect, Investment, Return, Speed, Duration, Indirectness, Determinism.
- Conversion chains (6.9.1): `Курс = Выход/Вход`, `Прибыльность = Курс × Частота − Альтернативные_издержки`.
- 6 патологий (6.10): inflation, stagnation, arbitrage, runaway, deadlock, stall.
- 12-point validation checklist (6.13.4).
- 7-step analysis algorithm (6.13.2): graph → components → cycles → loop profiles → faucet/drain → pathologies → corrections.

### 5b.2. Фактическая реализация

`src/app/api/v1/economy/design/route.ts` (821 строка):

- `GENRE_RESOURCE_PRESETS` (строки 98-126) — 5 жанров + default. Каждый preset: 3-4 core + 3 subsidiary.
- `classifySystemType` (строки 135-190) — Engine/Economy/Ecology по hasConverter/hasConsumable/hasMeta.
- `buildMachinations` (строки 192-320) — строит nodes/flows/state_connections/feedback_loops.
- `findConversionChains` (строки 322-385) — chains для catalytic ресурсов.
- `detectPathologies` (строки 387-445) — Инфляция/Дефляция/Стагнация/Убегание.
- `simulate` (строки 495-582) — 50 ticks, value = value + faucet - drain + noise.

### 5b.3. Несоответствия спецификации

- Machinations library 16+ паттернов → только 5 абстрактных имён (source_pool_drain, converter_chain, consumable_burn, ecological_balance, engine_accumulator).
- 8-мерный профиль петли → только 4 поля (nodes, loop_type, strength, description).
- 6 патологий → только 4 (нет arbitrage, нет deadlock).
- 12-point checklist → ~4 проверены.
- Conversion chain profitability = `0.8 + Math.random() * 0.4` — RANDOM, не выведено из actual flows.

### 5b.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 5b.1 | 🔴 | `ai-service.ts` | НЕТ функции `enrichEconomy`. Economy route (строка 29) импортирует `enrichProgression`, вызывает с `totalLevels: resources.length` (6 для RPG). AI даёт advice по progression вместо economy. Подтверждено в `06_economy.json`: `ai_insights` начинается "1. Для RPG-проекта Shadow_Depths с 6 уровнями оптимальна логарифмическая кривая прогрессии..." |
| 5b.2 | 🔴 | `route.ts:293` | `feedback_loops` nodes содержат строковые литералы `"converter"` и `"consumable"` — НЕ существующие node IDs в графе. Любой downstream-анализ упадёт. |
| 5b.3 | 🔴 | `route.ts:292-303` | `feedback_loops` HARDCODED: всегда `"anchor→converter→consumable→anchor"` + `"anchor→drain_sink→anchor"`, не выводятся из actual resources. |
| 5b.4 | 🔴 | `route.ts:353` | `profitability = 0.8 + Math.random() * 0.4` — non-deterministic, не имеет отношения к экономике. |
| 5b.5 | 🔴 | `route.ts:681-687` | `faucetDrain` hardcoded по class. Для RPG ВСЕГДА `mana` и `materials` (catalytic) получают faucet=1.0, drain=0.3 → ratio=3.33 → ВСЕГДА 2 critical "Инфляция" pathologies. Circulus vitiosus: диагноз определяется class, а class задаётся preset. |
| 5b.6 | 🔴 | `route.ts:534-544` | `stallCount` использует порог `rMax <= min + (max-min)*0.05`. Для gold/hp с bounds.max=10000 порог = 500, значения колеблются 50→55 → ВСЕГДА stalled. Подтверждено: stall_frequency=0.5 (3 из 6 stalled: gold, hp, stamina). |
| 5b.7 | 🔴 | `route.ts:570` | `num_runs: 10` в config — hardcoded, НО реальный цикл runs отсутствует (выполняется 1 run). "aggregated" misleading — нет усреднения. |
| 5b.8 | 🔴 | `route.ts:534` | `Math.random()` в simulation — non-deterministic, результаты не воспроизводимы. |

### 5b.5. Сильные стороны

- `classifySystemType` — корректная эвристика Engine/Economy/Ecology по Sellers (Bible 6.3.2).
- `proposeAdjustments` — конкретные `new_rate` с reason, actionable.
- Simulation produces time series + ranges + stability_index — концептуально соответствует Bible 6.11.3 Step 8.

---

## 6. Блок 6 — GDD Generator (алгоритм 3.7)

### 6.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_11_gdd_templates_checklists.md`:

- Full GDD = 38 секций в 8 блоках (11.3.3).
- Modular documentation = 13 модулей M-01..M-13 (11.3.4).
- Universal Design Validator integration (11.6).
- AI vs алгоритмы: AI формулирует текст, алгоритмы валидируют (11.8.2).
- Living documentation: каждый раздел отслеживает возраст (11.9).

### 6.2. Фактическая реализация

`src/app/api/v1/gdd/generate/route.ts` (1065 строк):

- 8 форматов: one_sheet, ten_pager, treatment, sketch_design, full_gdd, concept_doc, narrative_bible, modular.
- `FORMAT_SECTIONS` (строки 61-155) — каталог секций по формату.
- `deriveSectionContent` (строки 272-581) — switch по sectionName, возвращает content+source.
- `buildConsistencyReport` (строки 583-678) — 3 типа checks.
- Markdown assembly + word count + estimated pages.

### 6.3. Несоответствия спецификации

- Full GDD: 21 секция вместо 38 (missing ~17: Управление, Камера, Режимы игры, Диалоги, Квесты, Лор, Структура мира, Дизайн уровней, Навигация, Боевые пространства, Ресурсы, Дерево технологий, HUD/UI, Меню, Визуальный стиль, Звук, Режимы, Социальные, Мета-игра, Тех. требования, Платформа, Milestones).
- Modular: 10 секций вместо 13 (missing UI/UX Spec, Audio Bible, Production Plan).
- Universal Design Validator 10 уровней → не реализован в `buildConsistencyReport`.
- `deriveSectionContent` narrative cases (строки 481-506) — все 8 narrative sections возвращают ОДНО и ТО ЖЕ: `JSON.stringify(mda.ludonarrativeCheck)`. "characters" = "world_overview" = "plot_arcs".
- `/gdd/auto-fill/route.ts` — возвращает `synopsis`, `gameplay_overview`, `features` — НЕ совпадает с именами секций в `FORMAT_SECTIONS`. Endpoint бесполезен для generate.
- `/gdd/map/route.ts:25-39` — HARDCODED mapping, не инспектирует actual available data.

### 6.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 6.1 | 🔴 | `gdd/generate/route.ts:555-580` | default case возвращает placeholder для ux/ux_flow/ui_mockups/tech_notes/tech_stack/tech_bible/art_bible/sound/localization/testing_plan/risks/team_fit/live_ops_plan/overview. Для full_gdd это 10+ секций с placeholder → coverage_score ~50% даже при наличии всех upstream-данных. |
| 6.2 | 🔴 | `gdd/generate/route.ts:481-506` | `deriveSectionContent` для всех narrative кейсов (`characters`, `world_overview`, `plot_arcs`, `story_structure`, `dialogue_style`, `themes`, `cutscenes`, `pacing`) возвращает ОДНО и ТО ЖЕ: `JSON.stringify(mda.ludonarrativeCheck)`. |
| 6.3 | 🔴 | `gdd/generate/route.ts:61-155` (`FORMAT_SECTIONS`) | Full GDD: 21 секция вместо 38; Modular: 10 вместо 13. |
| 6.4 | 🔴 | `gdd/auto-fill/route.ts` | Возвращает `synopsis`, `gameplay_overview`, `features` — НЕ совпадает с именами секций в `FORMAT_SECTIONS` (`concept`, `core_loop_summary`). Endpoint бесполезен для generate. |
| 6.5 | 🔴 | `gdd/map/route.ts:25-39` | HARDCODED mapping, не инспектирует actual available data. |
| 6.6 | 🔴 | `gdd/generate/route.ts:828-841` | `aiEnriched` misleading labels: "enriched_sections" это narrative с ludonarrativeCheck, "generated_sections" это fallback text. Реального AI enrichment per-section нет. |
| 6.7 | 🟡 | `gdd/generate/route.ts:746 + 800` | `deriveSectionContent` вызывается ДВАЖДЫ для каждой секции. O(2N) без caching. |
| 6.8 | 🟡 | `gdd/generate/route.ts:897` | `has_formulas` regex `/=|∑|∫|≤|≥/` матчит любой "=" символ. |
| 6.9 | 🟡 | `ai-service.ts:318-357` | `enrichGddSection` существует, но НЕ вызывается ни из одного route. Dead code. |
| 6.10 | 🟡 | `gdd/export/route.ts:82-108` | `mdToPdfLike` fallback обрезает контент до 4000 символов (`escapedText.slice(0, 4000)`). |

### 6.5. Сильные стороны

- 8 форматов — шире Bible (4 формата).
- `DETAIL_FACTOR` multipliers (0.5/1.0/1.6/2.3) влияет на длину AI-секций.
- `/gdd/export` real DOCX через `docx` npm package с heading levels, bullets, bold/italic parsing.
- `/gdd/export` real PDF через Playwright с graceful fallback.

---

## 6b. Блок 6b — Чек-лист валидации (алгоритм 3.8)

### 6b.1. Заявленный алгоритм (Библия)

`docs/bible/bible_2_11_gdd_templates_checklists.md` (разделы 11.5-11.6):

- Universal Design Validator = **10 уровней** (11.6.1), каждый с 5-10 checks (~80+ total).
- 113 линз Шелла в 16 категориях (11.5.1).
- 8 фильтров идеи Шелла (11.5.2).
- 7-point balance checklist Rolling/Morris (11.5.3).
- 6 эвристик Аптона (11.5.4).
- 7 методов косвенного руководства Бонд (11.5.5).
- 5 убийц удовольствия Фуллертон (11.5.6).
- 4+3 цели проектирования Бонд (11.5.7).
- Адаптивная приоритизация по жанру (11.6.2).
- Итого **~220 checks в спецификации**.

### 6b.2. Фактическая реализация

**Две параллельные реализации:**

**A. `/api/v1/gdd/checklist/route.ts` (121 строка) — STUB:**

```ts
mda_check.score = mdaProfile ? 80 : 0
balance_check.score = balanceResult?.overallBalanceScore || 0
economy_check.score = hasPathology ? 40 : 80
narrative_check.score = concept ? 70 : 0
lens_check.score = mdaProfile ? 75 : 0
```

Просто проверяет существование полей в DB. Никакой реальной валидации.

**B. `/api/v1/checklists/[action]/route.ts` + `/api/v1/checklist/[action]/route.ts`** — используют `lib/checklist-logic.ts` (743 строки) с 5 check-functions:

- `runMdaCheck` — 3 правила (mechanicSet keys, overallMatch < 0.5, lensVal.overall_score < 0.6).
- `runBalanceCheck` — 4 правила (overallBalanceScore, imbalanceCount > 3, pathologies > 0).
- `runNarrativeCheck` — 3 правила (ludonarrative issues, USP exists, narrative_bible genre needs GDD).
- `runEconomyCheck` — 3 правила (hasPathology, simResults.quality.overall_pass, stability_index < 0.5).
- `runLensCheck` — 1 правило (iterate lensValidation.results, flag scores < 0.5).

### 6b.3. Несоответствия спецификации

- Только ~15 правил вместо ~220 из Bible.
- Level 7 (Level Design), Level 9 (Interface), Level 10 (Documentation) — полностью отсутствуют.
- 8 фильтров Шелла, 6 Аптона, 7 Бонд, 5 Фуллертон, 4+3 Бонд — НИ ОДИН не реализован.
- 113 линз Шелла — НЕ применяются. `runLensCheck` только читает pre-computed `lensValidation.results` из Block 3 (MDA).
- Bible 11.6.2 adaptive prioritization per genre — НЕ реализована (hardcoded weights 0.3/0.3/0.3/0.1).

### 6b.4. Критические замечания

| № | Серьёзность | Локация | Описание |
|---|-------------|---------|----------|
| 6b.1 | 🔴 | `gdd/checklist/route.ts` | STUB, не использует `checklist-logic.ts`. **Pipeline test script вызывает `/gdd/checklist`, НЕ `/checklist/validate`**. Подтверждено в `08_checklist.json`: scores целые 80/0/40/70/75, overall_score=53. Богатая реализация `checklist-logic.ts` — фактически dead code в production pipeline. |
| 6b.2 | 🔴 | `checklist-logic.ts:184-257 runMdaCheck` | Только 3 проверки. Нет 9 Shell lenses, aesthetic coverage, bond matrix. |
| 6b.3 | 🔴 | `checklist-logic.ts:259-324 runBalanceCheck` | Только 4 проверки. Bible 11.5.3 7-point Rolling/Morris checklist НЕ реализован. |
| 6b.4 | 🔴 | `checklist-logic.ts:326-392 runNarrativeCheck` | Только 3 проверки. Bible 11.4.1 11 narrative document types НЕ валидируются. |
| 6b.5 | 🔴 | `checklist-logic.ts:394-452 runEconomyCheck` | Только 3 проверки. Bible 6.13.4 12-point checklist НЕ реализован. |
| 6b.6 | 🔴 | `checklist-logic.ts:454-493 runLensCheck` | Итерирует `lensValidation.results`, не применяет 113 линз. |
| 6b.7 | 🟡 | `checklist-logic.ts:511-513` | `overall = mdaScore*0.3 + balanceScore*0.3 + narrativeScore*0.3 + 0.1` — hardcoded weights, fixed 0.1 baseline boost. |
| 6b.8 | 🟡 | `checklist-logic.ts:179-181 clamp()` | Score всегда в [0, 1]. 5 critical issues всё равно дают score ≥ 0. |

### 6b.5. Сильные стороны

- `runChecklistValidation` поддерживает per-checklist invocation через `action` param.
- `remediationPlan` maps каждый issue to action/effort/impact — actionable.
- `quick_wins` filters info/warning issues с effort labels.
- 3 severities (error/warning/info) corresponding to 🔴🟡🟢 — соответствует Bible 11.6.3.

---

## 7. Системные проблемы (cross-block)

| № | Серьёзность | Проблема | Затронутые блоки |
|---|-------------|----------|------------------|
| S1 | 🔴 | AI enrichment persist inconsistency: Block 2 сохраняет `ai_insights` в БД (через `fullProfile` после enrichment). Блоки 1, 3, 4, 5, 6 — НЕТ. | 1, 3, 4, 5, 6 |
| S2 | 🔴 | Non-determinism: `Math.random()` в Block 4 (Monte Carlo) и Block 5b (profitability + simulation). | 4, 5b |
| S3 | 🟡 | Dead code: `enrichGddSection` объявлена, но не вызывается. `enrichEconomy` не существует. | 6, 5b |
| S4 | 🟡 | Две параллельные реализации для чек-листа: `/gdd/checklist` (STUB) и `/checklists/[action]` (rich). Pipeline использует STUB. | 6b |
| S5 | 🟡 | Type system bypasses: `as unknown as string` для невалидных aesthetic values в Block 1; `as unknown as { feedback_loops: ... }` в Block 4. | 1, 4 |
| S6 | 🟡 | Bilingual typos в system prompts: китайские символы `"除非"`, `"扩充"` в `ai-service.ts:63,333`. | 7 (AI) |
| S7 | 🟡 | Hardcoded defaults в pipeline runner: `STAGES[3].buildBody` передаёт 4 hardcoded balance-объекта. | pipeline |
| S8 | 🟡 | Все 4 маршрута импортируют `safeJsonParse` и делают `void safeJsonParse;` чтобы удовлетворить linter. | 1-4 |

---

## 8. Рекомендованный порядок исправления

| # | Приоритет | Задача | Ожидаемый эффект |
|---|-----------|-------|------------------|
| 1 | 🔴🔴🔴 | Заполнить `genres: []` для всех 128 механик в MechanicsDB | Block 1 `compatibility_score` начнёт отражать реальность |
| 2 | 🔴🔴🔴 | Исправить `buildClassicMDA`: перебирать все динамики эстетики + выровнять mechanic_id в `DYNAMICS_TO_MECHANICS` с MechanicsDB | Block 3 `overall_match` перестанет быть 0 |
| 3 | 🔴🔴🔴 | Заставить `/gdd/checklist` вызывать `lib/checklist-logic.ts` | Universal Design Validator начнёт работать в pipeline |
| 4 | 🔴🔴🔴 | Исправить `scripts/run_pipeline_test.sh:108` (`elements` → `objects` с правильным shape) | Block 4 начнёт тестироваться end-to-end |
| 5 | 🔴🔴 | Создать `enrichEconomy` в `ai-service.ts` и использовать в `economy/design/route.ts` | AI-советы по экономике вместо прогрессии |
| 6 | 🔴🔴 | Заменить `Math.random()` на детерминированный seed в Block 4 Monte Carlo и Block 5b simulation | Воспроизводимость результатов |
| 7 | 🔴🔴 | Расширить `FORMAT_SECTIONS["full_gdd"]` до 38 секций + `modular` до 13 | GDD будет соответствовать Bible 11.3.3 |
| 8 | 🔴🔴 | Реализовать `deriveSectionContent` для 8 narrative-секций отдельно | Перестанут дублироваться |
| 9 | 🔴 | Перенести `enrichXxx()` ДО `db.upsert` в Блоках 1, 3, 4, 5, 6 (как в Block 2) | `ai_insights` будет сохраняться в БД |
| 10 | 🔴 | Реализовать 8 патологий баланса из Bible 5.13 | Block 4 pathology detection станет осмысленным |
| 11 | 🟡 | Заменить `"competition"`/`"strategy"` на валидные Hunicke 8 эстетики | Block 1 aesthetic profile станет корректным |
| 12 | 🟡 | Инвертировать condition в Lens #41 (`score < 0.5` вместо `> 0.7`) | Линза «Доминантная стратегия» начнёт работать правильно |
| 13 | 🟡 | Параметризовать `buildSteps` по `type` в Block 2 | Engine/Economy/Ecology будут давать разные структуры шагов |
| 14 | 🟡 | Реализовать формулу perceived difficulty `(Cv + Cs) − (Pv + Ps)` в Block 5a | Прогрессия будет учитывать player skill |
| 15 | 🟡 | Удалить `enrichGddSection` или вызвать её в `/gdd/generate` | Устранить dead code |

---

## 9. Методология аудита

### Источники истины

- **Спецификация**: 12 разделов Библии геймдизайна в `docs/bible/bible_2_*.md` (~8 145 строк).
- **Реализация**: TypeScript-файлы в `src/app/api/v1/`, `src/lib/`, `src/constants/`, `src/types/`.
- **Проверка**: 10 test_projects в `test_projects/*/` с реальными JSON-выводами каждого блока.

### Что проверялось

1. **Соответствие заявленных алгоритмов фактической реализации** — каждый блок сравнивался с соответствующим разделом Библии.
2. **Детерминизм** — одинаковые ли результаты для одинаковых входов?
3. **Persist в БД** — сохраняются ли все вычисленные поля?
4. **Edge cases** — пустые входы, короткие идеи, большие проекты.
5. **Type safety** — использование `as unknown as`, type casts.
6. **AI enrichment** — корректность вызова, сохранение в БД.
7. **Consistency между блоками** — одинаковые ли паттерны в похожих ситуациях.

### Что НЕ проверялось

- Frontend-компоненты (`src/components/gidede/*`) — только API-слой.
- Performance (latency, memory) — только корректность.
- Security (auth, RBAC) — отдельный аудит.
- Node-редактор прототипов (`src/lib/graph/`) — отдельный аудит.

### Глубина анализа

- Все 8 block-эндпоинтов прочитаны целиком (суммарно ~6 800 строк).
- Все 12 разделов Библии прочитаны целиком (~8 145 строк).
- Все 10 test_projects проверены на наличие артефактов багов.
- 2 sub-agents работали параллельно (Блоки 1-4 и 5-8).

---

## 10. Приложения

### 10.1. Файлы отчётов

- `/home/z/my-project/repos/Gidede/worklog.md` — детальные записи sub-agents (Task ID: `audit-blocks-1-4`, `audit-blocks-5-8`).
- `/home/z/my-project/repos/Gidede/docs/audit/AUDIT_REPORT.md` — данный отчёт.
- `/home/z/my-project/repos/Gidede/docs/audit/REFACTOR_PLAN_block_N.md` — планы рефакторинга по каждому блоку (см. этап 2).
- `/home/z/my-project/repos/Gidede/docs/audit/REFACTOR_TRACKER.md` — трекер задач рефакторинга (см. этап 3).

### 10.2. Соглашения

- 🔴 = критично, блокирует корректную работу алгоритма.
- 🟡 = средне, нарушает соответствие спецификации, но не ломает pipeline.
- 🟢 = низко / сильная сторона — реализовано хорошо.
- Локации указываются в формате `file:line` или `file:function`.
- Цитаты кода минимальны — для контекста, не для воспроизведения.

---

*Конец отчёта.*
