# Рефакторинг Блока 5a — Прогрессия (алгоритм 3.5)

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-5a (sub-agent)
**Связанные документы**: `docs/audit/AUDIT_REPORT.md` (раздел 5a), `docs/bible/bible_2_6_economy_progression.md` (разделы 6.6-6.7), `docs/audit/REFACTOR_PLAN_block_1.md`, `docs/audit/REFACTOR_PLAN_block_4.md`
**Объект рефакторинга**:
- `src/app/api/v1/progression/design/route.ts` (644 строки)
- `src/app/api/v1/progression/[projectId]/route.ts` (45 строк)
- `src/lib/ai-service.ts` (функция `enrichProgression`, строки 633-671)
- `src/lib/pipeline-helpers.ts` (функция `buildPreparedInput`, строки 296-425)
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (StageDef для progression, строки 137-145)
- `scripts/run_pipeline_test.sh` (строки 118-124)
- `src/types/progression.ts` (74 строки)
- `src/constants/progression.ts` (35 строк)
- `prisma/schema.prisma` (модель `ProjectProgression`, строки 229-251)
- `src/components/gidede/progression/*` (5 UI компонентов)
- `src/app/blocks/5/page.tsx` (503 строки)

---

## Контекст

Блок 5a (Progression Designer) — пятая стадия пайплайна Gidede. Принимает
`{ genre, target_duration, target_levels, progression_type,
monetization_model, pacing, project_id?, use_ai? }` и выполняет 7 стадий:

1. **Macro model**: total_levels, target_duration, emergence_ratio,
   lock_key_model, monetization_model, pacing, content_requirements (строка!).
2. **Tier model**: numTiers по порогам (1-3→1, 4-10→2, 11-25→3, 26-60→4,
   60+→5), 5 hardcoded TIER_ARCHETYPES, transition_map.
3. **Curves**: 4 кривые (xp_to_level, level_to_power, level_to_cost, difficulty)
   через `buildCurve(curveType, levels, base, growthRate)`.
4. **Content plan**: tier_plans (enemies/rewards/abilities/milestones),
   unlock_tree (10 hardcoded имён), perceived_difficulty_table (50+ строк).
5. **Validation**: 6 checks (no_grind, no_walls, no_empty_levels, no_runaway,
   no_build_gaps, aesthetic_alignment), issues, suggestions, overall_score.
6. **Persist**: upsert ProjectProgression со всеми JSON-полями.
7. **AI enrichment**: optional `enrichProgression()` вызывается ПОСЛЕ persist.

**Подтверждённые дефекты** (проверены на всех 10 test_projects):

- **Все 10 test_projects производят ИДЕНТИЧНЫЙ progression output** (отличаются
  только `id` и `ai_insights`). Подтверждено:
  - Все 10 имеют `genre: "rpg"`, `progression_type: "exponential"`,
    `tier_count: 4`, `total_levels: 50`, identical tier_model, identical
    unlock_tree, identical economy_link.
  - Скрипт `run_pipeline_test.sh:122` отправляет только
    `{"project_id":"$PID","total_levels":50,"use_ai":true}` — без genre,
    progression_type, monetization_model, pacing.
  - `run-full-pipeline/route.ts:141-145` (StageDef для progression) отправляет
    только `{total_levels: i.totalLevels, use_ai: i.useAi}` — без genre.
  - Route defaults всё к `genre="rpg"`, `progression_type="exponential"`,
    `monetization_model="b2p"`, `pacing="balanced"`, `target_duration=40`.
  - Даже если body.genre был передан, route не использует `proj.concept?.genre`
    для override. Реальные жанры concept (roguelike, tower_defense,
    metroidvania, racing, и т.д.) полностью игнорируются.

- **Только 5 кривых реализовано вместо 7** (Bible 6.7.3): нет `identity`
  (`y=x`), `logarithmic` (`y=log_b(x)`), `triangular` (`y=(x²−x)/2`),
  `obfuscation` (нелинейная с разрывами для F2P). Реализованный `diminishing`
  — это `1−exp(−gr·lvl)`, не Bible logarithmic. Реализованный `s_curve`
  (логистическая) — Sellers рекомендует, но не в Bible 6.7.3 explicit list.

- **Формула perceived difficulty НЕ реализована** (Bible 6.7.1):
  `Воспринимаемая_сложность = (Cv + Cs) − (Pv + Ps)`. Вместо неё — линейная
  `target = 0.2 + (lvl/totalLevels) * 0.7`. `recommended_enemy_power =
  powerCurve.points[lvl-1] * 1.1` — не учитывает стратегический вызов (Cs)
  и рост навыка игрока (Ps).

- **TIER_ARCHETYPES не зависят от genre** — 5 фиксированных архетипов
  (Onboarding/Foundation/Expansion/Mastery/Endgame) для ВСЕХ жанров. Card_Lords
  (deck-builder) получает те же `dominant_mechanic: "tutorial"` → `"core_loop"`
  → `"ability_synergy"` → `"mastery_combos"`, что и Shadow_Depths (roguelike).
  Bible 6.6.4: D&D 4 этапа — эталонная модель, но для разных жанров должны быть
  разные архетипы (RPG → combat tiers, Puzzle → difficulty tiers, Racing →
  track/vehicle tiers, Deck-builder → card-pool tiers).

- **economyLink hardcoded для всех жанров** — `primary_resources: ["xp",
  "gold"]`, `conversion_chains: ["xp→level", "gold→items"]`. Для Card_Lords
  должны быть `["cards", "deck_slots", "mana"]`, для Harvest_Moonlight —
  `["seeds", "crops", "gold"]`, для Frostbite — `["heat", "materials",
  "food"]`.

- **`" elemental_attack"` (leading space)** — строка 366 `route.ts`:
  `" elemental_attack"`. Подтверждено во всех 10 test_projects на позиции
  `unlock_tree[3]` (level=20).

- **`"prestige_reset"` кап на 10-й unlock** — `route.ts:383`:
  `Math.min(unlockNames.length - 1, Math.floor(lvl / unlockEvery) - 1)`. Для
  targetLevels > 100 (когда `unlockEvery` мог бы дать > 10 unlocks) все
  дополнительно генерируемые unlocks получают имя "prestige_reset" или
  fallback `unlock_${lvl}`. Для targetLevels=15 (unlockEvery=1): unlocks на
  уровнях 11-15 все получают `"prestige_reset"` (idx capped at 9).

- **`ai_insights` не персистится в БД** — `route.ts:561-620` (db upsert)
  выполняется ДО `route.ts:625-636` (AI enrichment). `fullProfile:
  JSON.stringify(result)` сохраняет снепшот БЕЗ `ai_insights`. Подтверждено: 9
  из 10 test_projects не имеют `ai_insights` в `05_progression.json` (только
  проект 01_Shadow_Depths имеет, и только в response body — не в БД).

- **`economy_link` не в POST response** — сохраняется в БД через `economyLink:
  JSON.stringify(...)` (строки 581-588, 609-616), но не добавляется в `result`
  object (строки 547-558). Только GET `/progression/[projectId]` возвращает
  `economy_link`. Подтверждено во всех 10 test_projects.

- **transition_map dangling reference** — `route.ts:302-305`: цикл
  `for (let i = 0; i < tiers.length - 1; i++)` создаёт переходы только между
  существующими tiers. Последний tier имеет `transition_trigger: "endgame_unlock"`
  (или `"completion"` для 5-tier), но этому trigger'у некуда переходить —
  transition_map не содержит ключа для последнего tier.

- **`emergence_ratio` формула с wrong sign** — `route.ts:237-239`:
  `0.3 + 0.1 * (targetLevels / 50) + 0.05 * pacingFactor`. PACING_FACTORS:
  `intense=1.25 > balanced=1.0 > relaxed=0.8`. Получается: intense pacing
  УВЕЛИЧИВАЕТ emergence_ratio (хотя intense pacing = больше скриптовых
  событий = МЕНЬШЕ эмерджентности). Знак должен быть обратным.

- **`lock_key_model` binary** — `route.ts:240-243`: только `"soft_locks"` (для
  f2p/p2w) или `"key_gates"` (для всего остального). Bible 6.6.2: 3 типа —
  simple key-lock (linear), metroidvania (non-linear backtracking), dynamic
  locks (context-dependent). Metroidvania-жанр (test project 05_Void_Runner)
  получает `"key_gates"`, что неверно.

- **macro_model lacks Bible 6.7.4 RPG fields** — Bible требует:
  `transitions_count = L-1`, `transitions_per_hour ≈ L/T`,
  `content_stages ≈ L/2`, `enemy_configs_min ≥ 3×(L/2)`,
  `char_points_per_level = (Final-Initial)/(L-1)`. Route сохраняет только
  `content_requirements` как строку `"50 уровней, 40ч gameplay, balanced"`.

- **`stages_completed` hardcoded `[1,2,3,4,5]`** — `route.ts:544`: всегда
  сообщает 5 стадий завершено, независимо от реального состояния upstream
  (concept, core_loop, mda, balance).

- **`targetLevels` capped at 500** — `route.ts:200`:
  `Math.min(500, Number(body?.target_levels) || 50)`. Для MMO (Bible 6.12.5)
  характерно 100+ levels, для F2P — 1000+ (Match-3, RPG mobile). Cap
  скрывает реальную потребность.

- **Input validation gaps** — нет валидации `target_duration` (принимает
  отрицательные/NaN), `genre` принимает любую строку, `use_ai` принимает
  только `true` или `"true"` (не `"1"` или `1`).

- **`enrichProgression` prompt generic** — `ai-service.ts:644-656`: не передаёт
  `macro_model`, `tier_model`, `curves`, `validation`. AI даёт advice в вакууме.
  Подтверждено в `05_progression.json` (проект 01): AI рекомендует "5 тиров по
  10 уровней", но реализация создала 4 тира (13/13/13/11) — AI advice не
  actionnable.

- **GET/POST shape mismatch** — POST возвращает
  `{id, macro_model, tier_model, curves, content_plan, validation, summary,
  stages_completed, latency_ms, models_used, ai_insights?}`. GET возвращает
  `{id, project_id, total_levels, tier_count, curve_type,
  target_duration_hours, macro_model, tier_model, curves, content_plan,
  economy_link, validation, full_profile, input_data, created_at,
  updated_at}`. Frontend типизирован под POST, но `GET /progression/[projectId]`
  возвращает совсем другую структуру.

- **DB schema missing fields** — `prisma/schema.prisma:229-251`: нет полей
  `aiInsights`, `modelsUsed`. `curveType String? // 7 типов кривых` — comment
  врёт (реализовано 5-6).

---

## Цели рефакторинга

1. **Реализовать 7 кривых Шрайбера** (Bible 6.7.3): добавить `identity`,
   `logarithmic`, `triangular`, `obfuscation`; переименовать `custom` →
   `user_defined` для консистентности с Bible.
2. **Реализовать формулу perceived difficulty** `(Cv + Cs) − (Pv + Ps)` с
   реальными компонентами: Cv (variability challenges), Cs (strategic
   challenge), Pv (player variability), Ps (player skill).
3. **Параметризовать TIER_ARCHETYPES по genre** — разные архетипы для RPG,
   Puzzle, Racing, Deck-builder, Survival, FPS, Tower Defense, Metroidvania.
4. **Динамический economyLink** — primary_resources и conversion_chains
   вычисляются из genre + upstream economy data (если есть) или из
   genre-таблицы.
5. **Починить unlock tree** — убрать leading space, убрать cap на 10 имён,
   генерировать имена по шаблону `{genre}_{mechanic}_{idx}` если пул исчерпан.
6. **Перенести AI enrichment ДО persist** — как в Block 2, чтобы `ai_insights`
   сохранялся в `fullProfile`.
7. **Derive progression params из upstream** в `run-full-pipeline` — genre из
   `project.concept.genre`, pacing из `core_loop.structural_type`,
   monetization из project metadata.
8. **Дополнить macro_model RPG-формулой** (Bible 6.7.4): transitions_count,
   transitions_per_hour, content_stages, enemy_configs_min,
   char_points_per_level.
9. **Починить transition_map** — добавить явный `"tier_N": "endgame"` (или
   `"completion"`) для последнего tier.
10. **Параметризовать lock_key_model** — добавить `"metroidvania"` для
    metroidvania-жанра, `"dynamic_locks"` для survival/sandbox.
11. **Унифицировать GET/POST shape** — оба возвращают одинаковый объект +
    metadata (`created_at`, `updated_at`, `project_id` только в GET).
12. **Расширить enrichProgression prompt** — передавать macro_model,
    tier_model, curves, validation summary.
13. **Реально реализовать validation checks** — `no_empty_levels`,
    `no_walls`, `aesthetic_alignment` сейчас всегда `true` (или всегда
    `false` для aesthetic) без реальной логики.
14. **Input validation + edge cases** — totalLevels=1, totalLevels=1000,
    unknown curveType, empty mechanics.
15. **Unify types** — `ProgressionDesignResponse` должен включать
    `economy_link`, `ai_insights?`, `models_used`, `input_data`.
16. **Унифицировать stages_completed** — отражать реальный upstream state.
17. **Тесты** — unit + integration.

---

## Задачи

### TASK-5a.1: Реализовать 7 кривых Шрайбера (Bible 6.7.3)

**Сложность**: XL
**Приоритет**: 🔴 (блокирует TASK-5a.2, TASK-5a.8, TASK-5a.13)
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 122-187),
`src/constants/progression.ts`, `src/types/progression.ts`

**Описание проблемы**:

Bible 6.7.3 определяет 7 типов кривых:

| Кривая | Формула | Применение |
|--------|---------|------------|
| Тождественная (Identity) | `y = x` | Прямой обмен 1:1; деревья навыков |
| Линейная (Linear) | `y = m·x` | Стоимость от урона; HP от маны |
| Экспоненциальная (Exponential) | `y = C · bˣ` | Кривая опыта; ускоряющийся финал |
| Логарифмическая (Logarithmic) | `y = log_b(x)` | Кривая уровней (обратная к кривой опыта) |
| Треугольная (Triangular) | `y = (x² − x) / 2` | Наиболее часто используемая формула возрастающей отдачи |
| Пользовательская (Custom) | Произвольная | Контекстные зависимости |
| Обфускации стоимости (Obfuscation) | Нелинейная с разрывами | F2P: запутывание реальной стоимости |

Текущая `buildCurve()` (строки 122-187) реализует: `linear`, `exponential`,
`diminishing` (`1 − exp(−gr·lvl)`), `s_curve` (логистическая), `intermittent`
(step jumps), `custom` (полином `lvl^1.5`). Это 6 кривых, но:
- `diminishing` не соответствует Bible logarithmic (`log_b(x)`).
- `s_curve` — Sellers рекомендует, не в Bible 6.7.3 explicit list (можно
  оставить как дополнительную).
- `intermittent` — пересекается с Bible obfuscation по смыслу (breaks в
  кривой), но реализован неправильно (только +20% каждые 5 уровней, не real
  obfuscation).
- **Нет** `identity`, `logarithmic`, `triangular`, `obfuscation`.

**Решение**:

1. **Расширить `VALID_PROGRESSION_TYPES`** (строки 33-40) и
   `PROGRESSION_TYPES` в `constants/progression.ts`:
   ```ts
   const VALID_CURVE_TYPES = [
     "identity",
     "linear",
     "exponential",
     "logarithmic",
     "triangular",
     "s_curve",       // Sellers logistic, kept as bonus
     "intermittent",  // dramatic pacing, kept
     "obfuscation",   // F2P cost obfuscation
     "custom",        // user-defined polynomial blend
   ];
   ```

2. **Переписать `buildCurve()`**:
   ```ts
   function buildCurve(
     curveType: string,
     levels: number,
     baseValue: number,
     growthRate: number,
     opts?: { obfuscationBreaks?: number[]; customExponent?: number }
   ): CurveSpec {
     const points: number[] = [];
     const params: Record<string, number> = {
       base: baseValue,
       growth_rate: growthRate,
       levels,
     };
     let formula = "";

     switch (curveType) {
       case "identity":
         formula = "y = x";
         for (let lvl = 1; lvl <= levels; lvl++) points.push(lvl);
         break;

       case "linear":
         formula = "y = base * level";
         for (let lvl = 1; lvl <= levels; lvl++)
           points.push(Number((baseValue * lvl).toFixed(2)));
         break;

       case "exponential":
         formula = "y = base * growth_rate ^ (level - 1)";
         for (let lvl = 1; lvl <= levels; lvl++)
           points.push(Number((baseValue * Math.pow(growthRate, lvl - 1)).toFixed(2)));
         break;

       case "logarithmic":
         // y = base * log_base(level + 1), growthRate = base of log
         formula = "y = base * log_{growth_rate}(level + 1)";
         params.log_base = growthRate;
         for (let lvl = 1; lvl <= levels; lvl++)
           points.push(Number((baseValue * Math.log(lvl + 1) / Math.log(growthRate)).toFixed(2)));
         break;

       case "triangular":
         // y = (level^2 - level) / 2 * base
         formula = "y = base * (level^2 - level) / 2";
         for (let lvl = 1; lvl <= levels; lvl++)
           points.push(Number((baseValue * (lvl * lvl - lvl) / 2).toFixed(2)));
         break;

       case "s_curve":
         // Sellers logistic: y = base / (1 + exp(-gr * (level - levels/2)))
         formula = "y = base / (1 + exp(-growth_rate * (level - levels/2)))";
         for (let lvl = 1; lvl <= levels; lvl++) {
           const v = baseValue / (1 + Math.exp(-growthRate * (lvl - levels / 2)));
           points.push(Number(v.toFixed(2)));
         }
         break;

       case "intermittent":
         // Step jumps: y = base * level + jump_pct * base * level * (level % period == 0)
         formula = "y = base * level + 20% jumps every 5 levels";
         params.jump_pct = 0.2;
         params.period = 5;
         for (let lvl = 1; lvl <= levels; lvl++) {
           const base = baseValue * lvl;
           const jump = lvl % 5 === 0 ? base * 0.2 : 0;
           points.push(Number((base + jump).toFixed(2)));
         }
         break;

       case "obfuscation":
         // Nonlinear with breaks: linear base + random-looking jumps at obfuscationBreaks
         // Deterministic via seeded mulberry32 (Bible: real F2P obfuscation = visible cost
         // + hidden friction). Breaks every N levels, magnitude scales with level.
         formula = "y = base * level * (1 + obfuscation_factor(level))";
         params.break_period = 7;
         params.break_factor = 1.5;
         const breaks = opts?.obfuscationBreaks ?? [];
         for (let lvl = 1; lvl <= levels; lvl++) {
           let factor = 1.0;
           if (lvl % 7 === 0) factor *= 1.5;  // periodic 50% bump
           if (breaks.includes(lvl)) factor *= 2.0;  // explicit break points
           points.push(Number((baseValue * lvl * factor).toFixed(2)));
         }
         break;

       case "custom":
       default:
         // Polynomial blend: y = base * level ^ exponent
         const exp = opts?.customExponent ?? 1.5;
         formula = `y = base * level ^ ${exp}`;
         params.exponent = exp;
         for (let lvl = 1; lvl <= levels; lvl++)
           points.push(Number((baseValue * Math.pow(lvl, exp)).toFixed(2)));
         break;
     }

     return { type: curveType, formula, parameters: params, points };
   }
   ```

3. **Обновить `xpGrowth` / `powerCurveType` / `costCurveType` / `difficultyCurveType`**
   логику (строки 316-340):
   ```ts
   // XP curve uses progressionType directly
   const xpCurve = buildCurve(progressionType, targetLevels, 100, xpGrowth);

   // Level→Power: usually exponential or linear
   const powerCurveType =
     progressionType === "exponential" || progressionType === "s_curve"
       ? "exponential"
       : progressionType === "logarithmic" || progressionType === "triangular"
         ? "triangular"   // power grows quadratically for these progression types
         : "linear";

   // Level→Cost: obfuscation for F2P, otherwise mirror progression
   const costCurveType =
     monetizationModel === "f2p" ? "obfuscation" : progressionType;

   // Difficulty: usually s_curve (Sellers) or exponential
   const difficultyCurveType =
     pacing === "intense" ? "exponential" : "s_curve";
   ```

4. **Обновить DB schema comment** (prisma/schema.prisma:234):
   ```prisma
   curveType            String?   // 9 типов кривых (Bible 6.7.3 + Sellers s_curve + intermittent)
   ```

5. **Миграция существующих данных**: existing `progression_type="exponential"`
   валиден. Если было `"diminishing"` — мигрировать в `"logarithmic"` (та же
   форма, другое имя). Создать скрипт `scripts/migrate-progression-curves.ts`:
   ```ts
   // mapping: diminishing → logarithmic (same curve shape, different name)
   // s_curve → s_curve (kept as is)
   // intermittent → intermittent (kept as is)
   // custom → custom (kept as is)
   ```

**Тест-кейсы**:
- `buildCurve("identity", 10, 1, 1)` → `points = [1,2,3,4,5,6,7,8,9,10]`.
- `buildCurve("linear", 5, 100, 1)` → `points = [100, 200, 300, 400, 500]`.
- `buildCurve("exponential", 5, 100, 1.15)` →
  `points = [100, 115, 132.25, 152.09, 174.9]`.
- `buildCurve("logarithmic", 5, 100, 2)` →
  `points = [100·log₂(2), 100·log₂(3), ...] = [100, 158.5, 200, 230.5, 258.5]`.
- `buildCurve("triangular", 5, 1, 1)` →
  `points = [(1-1)/2, (4-2)/2, (9-3)/2, (16-4)/2, (25-5)/2] = [0, 1, 3, 6, 10]`.
- `buildCurve("obfuscation", 14, 50, 1)` → points на lvl=7 и lvl=14 в 1.5×
  больше от линейного базиса.
- `buildCurve("custom", 3, 100, 1, { customExponent: 2 })` →
  `points = [100, 400, 900]`.
- `buildCurve("unknown_type", 5, 100, 1)` → fallback на custom с
  `exponent=1.5` (или выбросить VALIDATION_ERROR — см. TASK-5a.14).
- POST с `progression_type: "triangular"` → `curves.xp_to_level.type ===
  "triangular"`, `formula === "y = base * (level^2 - level) / 2"`.
- POST с `monetization_model: "f2p"` → `curves.level_to_cost.type ===
  "obfuscation"`.

**Риски**:
- **Backward compat**: существующие записи в БД с `curveType="exponential"`
  должны продолжить работать. Митигация: `exponential` остаётся валидным;
  `diminishing` мигрируется скриптом.
- **UI dropdown**: `PROGRESSION_TYPES` в `constants/progression.ts` нужно
  расширить до 9 элементов, при этом UI (block 5 page.tsx) должен корректно
  отображать 9 опций в `<Select>`.
- **AI prompt**: `enrichProgression` упоминает "(exp, polynomial, logarithmic)"
  — нужно обновить список (см. TASK-5a.12).

**Dependencies**: нет (стартовая задача)

---

### TASK-5a.2: Реализовать формулу perceived difficulty `(Cv + Cs) − (Pv + Ps)` (Bible 6.7.1)

**Сложность**: L
**Приоритет**: 🔴 (после TASK-5a.1)
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 393-411),
`src/types/progression.ts`

**Описание проблемы**:

Bible 6.7.1:
> **Формула воспринимаемой сложности** (Шрайбер): `Воспринимаемая_сложность =
> (Cv + Cs) − (Pv + Ps)`, где Cv = виртуальный вызов (сила врагов), Cs =
> стратегический вызов (необходимость новых стратегий), Pv = виртуальная сила
> игрока (уровень персонажа), Ps = реальный навык игрока. Положительная
> воспринимаемая сложность → ощущение вызова; отрицательная → ощущение лёгкости;
> нулевая → баланс.

Текущая реализация (строки 393-411):
```ts
for (let lvl = 1; lvl <= targetLevels; lvl++) {
  const isTierBoundary = tiers.some((t) => t.level_range[1] === lvl);
  const target = Math.min(1, 0.2 + (lvl / targetLevels) * 0.7);
  const enemyPower = Number((powerCurve.points[lvl - 1] || 10) * 1.1);
  perceivedDifficultyTable.push({
    level: lvl,
    target_perceived_difficulty: Number(target.toFixed(2)),
    recommended_enemy_power: Math.round(enemyPower),
    is_tier_boundary: isTierBoundary,
  });
}
```

Проблемы:
- `target` — линейная интерполяция 0.2 → 0.9, не имеет отношения к формуле.
- `enemyPower` — `powerCurve.points[lvl-1] * 1.1` — фиксированный 10% buffer,
  не учитывает Cs (стратегический вызов) или Ps (рост навыка).
- Нет компонент Cv, Cs, Pv, Ps — невозможно отладить или валидировать.
- Для `totalLevels=1` → `target = 0.2 + 1*0.7 = 0.9` (уровень 1 — самый
  сложный, что неверно).

**Решение**:

1. **Вынести формулу в отдельную функцию** `buildPerceivedDifficultyTable`:
   ```ts
   interface PerceivedDifficultyRow {
     level: number;
     challenge_virtual: number;       // Cv: enemy power normalized 0..1
     challenge_strategic: number;     // Cs: 0..1 (tier boundary = spike)
     player_virtual: number;          // Pv: player power normalized 0..1
     player_skill: number;            // Ps: estimated 0..1
     perceived_difficulty: number;    // (Cv + Cs) − (Pv + Ps), range ~[-1, +2]
     target_perceived_difficulty: number;  // desired 0..1 (positive = challenge)
     recommended_enemy_power: number;
     is_tier_boundary: boolean;
   }

   function buildPerceivedDifficultyTable(
     levels: number,
     powerCurve: CurveSpec,
     tiers: Tier[],
     pacingFactor: number,
   ): PerceivedDifficultyRow[] {
     const rows: PerceivedDifficultyRow[] = [];
     // Normalize player power to 0..1
     const maxPower = Math.max(...powerCurve.points, 1);
     const minPower = Math.min(...powerCurve.points, 0);

     for (let lvl = 1; lvl <= levels; lvl++) {
       const isTierBoundary = tiers.some((t) => t.level_range[1] === lvl);
       const tierIdx = tiers.findIndex((t) =>
         lvl >= t.level_range[0] && lvl <= t.level_range[1]
       );
       const tier = tiers[tierIdx];

       // Pv: player virtual power, normalized 0..1
       const rawPower = powerCurve.points[lvl - 1] ?? minPower;
       const Pv = (rawPower - minPower) / Math.max(1, maxPower - minPower);

       // Ps: player skill growth — logarithmic (fast early, slow late).
       // Real player skill typically grows as log(level) in normalised units.
       const Ps = Math.min(1, Math.log(lvl + 1) / Math.log(levels + 1));

       // Cv: challenge virtual — enemy power should be slightly above player.
       // Target perceived = positive small (challenge). Use tier archetype
       // resource_state to scale: scarce=0.7, stable=0.6, abundant=0.5,
       // specialized=0.6, meta=0.55.
       const resourceStateCv: Record<string, number> = {
         scarce: 0.7, stable: 0.6, abundant: 0.5,
         specialized: 0.6, meta: 0.55,
       };
       const targetPerceived = (resourceStateCv[tier?.resource_state] ?? 0.6) * pacingFactor;
       const Cv = Math.min(1, Pv + targetPerceived * 0.3);

       // Cs: strategic challenge — spikes at tier boundaries (new mechanics
       // introduced). 0.2 baseline + 0.4 spike on boundary.
       const Cs = isTierBoundary ? 0.6 : 0.2;

       // Perceived difficulty = (Cv + Cs) − (Pv + Ps)
       const perceived = (Cv + Cs) - (Pv + Ps);

       // Recommended enemy power: solve for Cv target given Pv.
       // enemy_power = rawPower * (1 + targetPerceived * 0.3) / scaling
       const enemyPower = Math.round(rawPower * (1 + targetPerceived * 0.3));

       rows.push({
         level: lvl,
         challenge_virtual: Number(Cv.toFixed(3)),
         challenge_strategic: Number(Cs.toFixed(3)),
         player_virtual: Number(Pv.toFixed(3)),
         player_skill: Number(Ps.toFixed(3)),
         perceived_difficulty: Number(perceived.toFixed(3)),
         target_perceived_difficulty: Number(targetPerceived.toFixed(3)),
         recommended_enemy_power: enemyPower,
         is_tier_boundary: isTierBoundary,
       });
     }
     return rows;
   }
   ```

2. **Вызывать в route** (заменить строки 393-411):
   ```ts
   const perceivedDifficultyTable = buildPerceivedDifficultyTable(
     targetLevels,
     powerCurve,
     tiers,
     pacingFactor,
   );
   ```

3. **Обновить тип `ProgressionDesignResponse.content_plan.perceived_difficulty_table`**
   в `src/types/progression.ts`:
   ```ts
   perceived_difficulty_table: Array<{
     level: number;
     challenge_virtual: number;
     challenge_strategic: number;
     player_virtual: number;
     player_skill: number;
     perceived_difficulty: number;
     target_perceived_difficulty: number;
     recommended_enemy_power: number;
     is_tier_boundary: boolean;
   }>;
   ```

4. **Обновить UI** `src/components/gidede/progression/ContentPlanTab.tsx`:
   добавить отображение 4 компонент (Cv, Cs, Pv, Ps) в таблице +
   `perceived_difficulty` цветом (зелёный = positive challenge, красный =
   negative too easy, жёлтый = near zero balance).

**Тест-кейсы**:
- `buildPerceivedDifficultyTable(10, expCurve, [tier1, tier2], 1.0)` → на
  level=10 (tier boundary): `Cs ≈ 0.6`, на level=5 (mid-tier): `Cs ≈ 0.2`.
- `perceived_difficulty[0]` (level 1): `Pv ≈ 0, Ps ≈ 0, Cv ≈ small, Cs ≈ 0.2`
  → positive (новичок видит вызов).
- `perceived_difficulty[levels-1]` (last level): `Pv ≈ 1, Ps ≈ 1, Cv ≈ 1 +
  targetPerceived·0.3, Cs ≈ 0.6` → `(1.18 + 0.6) − (1 + 1) = -0.22` → negative
  (endgame too easy if enemy doesn't scale) — корректное поведение,
  указывающее на необходимость scaling.
- `target_perceived_difficulty` всегда в диапазоне [0, 1].
- Для `totalLevels=1`: Pv=0, Ps=log(2)/log(2)=1 (max), Cv=0+0.6·0.3=0.18,
  Cs=0.6 (tier boundary) → perceived = (0.18+0.6)-(0+1) = -0.22 (уровень 1
  слишком лёгкий — корректно сигнализирует о проблеме single-level design).
- POST с `pacing="intense"` → `target_perceived_difficulty` выше чем для
  `pacing="relaxed"` на 25%.

**Риски**:
- **Skill growth model ad-hoc**: Ps = `log(lvl+1)/log(levels+1)` — не имеет
  теоретического обоснования, но соответствует "fast early, slow late"曲线.
  Митигация: документировать как heuristic, оставить параметры для тюнинга.
- **UI complexity**: таблица с 9 колонками может быть перегружена. Митигация:
  свернуть компоненты в expandable row или tooltip.

**Dependencies**: TASK-5a.1 (использует расширенный powerCurve)

---

### TASK-5a.3: Параметризовать TIER_ARCHETYPES по genre

**Сложность**: L
**Приоритет**: 🔴 (после TASK-5a.1)
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 52-98, 284-300),
`src/constants/progression.ts` (новый `GENRE_TIER_ARCHETYPES`)

**Описание проблемы**:

`TIER_ARCHETYPES` (строки 52-98) — массив из 5 фиксированных архетипов:
Onboarding (tutorial/transitive/linear/scarce), Foundation (core_loop/
transitive/linear/stable), Expansion (ability_synergy/situational/exponential/
abundant), Mastery (mastery_combos/intransitive/exponential/specialized),
Endgame (meta_progression/mixed/diminishing/meta).

Для всех 10 test_projects — идентичные tier_model (подтверждено). Card_Lords
(deck-builder) получает `dominant_mechanic: "tutorial"` на tier 1 — но
deck-builder не имеет tutorial как такового, у него card-pool expansion.

Bible 6.6.4:
> Система D&D предоставляет эталонную модель прогрессии с четырьмя чёткими
> этапами... AI может использовать эту модель как шаблон: для любой системы
> прогрессии определить этапы, каждый из которых имеет свою механическую
> доминанту.

То есть D&D 4 этапа — reference, но для разных жанров должны быть разные
архетипы.

**Решение**:

1. **Создать `GENRE_TIER_ARCHETYPES` в `src/constants/progression.ts`**:
   ```ts
   export interface TierArchetype {
     name: string;
     scale: "micro" | "small" | "medium" | "large" | "macro";
     dominant_mechanic: string;
     balance_type: "transitive" | "situational" | "intransitive" | "mixed";
     difficulty_curve: string;  // references VALID_CURVE_TYPES
     resource_state: "scarce" | "stable" | "abundant" | "specialized" | "meta";
     transition_trigger: string;
   }

   // Default (D&D-inspired) archetypes — used as fallback
   export const DEFAULT_TIER_ARCHETYPES: TierArchetype[] = [
     { name: "Onboarding",  scale: "micro",  dominant_mechanic: "tutorial",          balance_type: "transitive",   difficulty_curve: "linear",       resource_state: "scarce",      transition_trigger: "first_ability" },
     { name: "Foundation",  scale: "small",  dominant_mechanic: "core_loop",         balance_type: "transitive",   difficulty_curve: "linear",       resource_state: "stable",      transition_trigger: "tier_unlock" },
     { name: "Expansion",   scale: "medium", dominant_mechanic: "ability_synergy",   balance_type: "situational",  difficulty_curve: "exponential",  resource_state: "abundant",    transition_trigger: "prestige_unlock" },
     { name: "Mastery",     scale: "large",  dominant_mechanic: "mastery_combos",    balance_type: "intransitive", difficulty_curve: "exponential",  resource_state: "specialized", transition_trigger: "endgame_unlock" },
     { name: "Endgame",     scale: "macro",  dominant_mechanic: "meta_progression",  balance_type: "mixed",        difficulty_curve: "logarithmic",  resource_state: "meta",        transition_trigger: "completion" },
   ];

   // Genre-specific overrides (5 tiers max, can be shorter)
   export const GENRE_TIER_ARCHETYPES: Record<string, TierArchetype[]> = {
     rpg: DEFAULT_TIER_ARCHETYPES,

     roguelike: [
       { name: "First_Run",       scale: "micro",  dominant_mechanic: "tutorial",         balance_type: "transitive",   difficulty_curve: "linear",       resource_state: "scarce",      transition_trigger: "first_unlock" },
       { name: "Early_Permadeath", scale: "small", dominant_mechanic: "core_loop",        balance_type: "transitive",   difficulty_curve: "exponential",  resource_state: "stable",      transition_trigger: "biome_unlock" },
       { name: "Mid_Run",         scale: "medium", dominant_mechanic: "build_synergy",    balance_type: "situational",  difficulty_curve: "exponential",  resource_state: "abundant",    transition_trigger: "alt_path_unlock" },
       { name: "Deep_Run",        scale: "large",  dominant_mechanic: "mastery_combos",   balance_type: "intransitive", difficulty_curve: "exponential",  resource_state: "specialized", transition_trigger: "boss_unlock" },
       { name: "Endless",         scale: "macro",  dominant_mechanic: "meta_progression", balance_type: "mixed",        difficulty_curve: "logarithmic",  resource_state: "meta",        transition_trigger: "prestige_unlock" },
     ],

     puzzle: [
       { name: "Tutorial_Mechanics", scale: "micro",  dominant_mechanic: "mechanic_intro", balance_type: "transitive",   difficulty_curve: "linear",       resource_state: "stable",   transition_trigger: "mechanic_unlock" },
       { name: "Mechanic_Mix",       scale: "small",  dominant_mechanic: "combination",    balance_type: "situational",  difficulty_curve: "linear",       resource_state: "stable",   transition_trigger: "next_mechanic" },
       { name: "Twist",              scale: "medium", dominant_mechanic: "rule_inversion", balance_type: "intransitive", difficulty_curve: "exponential",  resource_state: "specialized", transition_trigger: "twist_unlock" },
       { name: "Master_Puzzles",     scale: "large",  dominant_mechanic: "mastery_combos", balance_type: "mixed",        difficulty_curve: "logarithmic",  resource_state: "specialized", transition_trigger: "completion" },
     ],

     racing: [
       { name: "Rookie",       scale: "micro",  dominant_mechanic: "driving_basics",  balance_type: "transitive",   difficulty_curve: "linear",       resource_state: "stable",      transition_trigger: "license_unlock" },
       { name: "Amateur",      scale: "small",  dominant_mechanic: "track_unlock",    balance_type: "transitive",   difficulty_curve: "linear",       resource_state: "stable",      transition_trigger: "vehicle_class_unlock" },
       { name: "Pro",          scale: "medium", dominant_mechanic: "tuning",          balance_type: "situational",  difficulty_curve: "exponential",  resource_state: "abundant",    transition_trigger: "championship_unlock" },
       { name: "Expert",       scale: "large",  dominant_mechanic: "mastery_combos",  balance_type: "intransitive", difficulty_curve: "exponential",  resource_state: "specialized", transition_trigger: "endgame_unlock" },
       { name: "Legend",       scale: "macro",  dominant_mechanic: "meta_progression", balance_type: "mixed",        difficulty_curve: "logarithmic",  resource_state: "meta",        transition_trigger: "completion" },
     ],

     // ... deck_builder, survival, fps, tower_defense, metroidvania, etc.
   };

   export function getTierArchetypes(genre: string): TierArchetype[] {
     const normalized = genre.toLowerCase().replace(/[\s-]/g, "_");
     return GENRE_TIER_ARCHETYPES[normalized] ?? DEFAULT_TIER_ARCHETYPES;
   }
   ```

2. **Использовать в route** (заменить строки 52-98 и 287):
   ```ts
   import { getTierArchetypes } from "@/constants/progression";

   // Внутри POST:
   const tierArchetypes = getTierArchetypes(genre);
   const maxTiers = tierArchetypes.length;  // 4-5 depending on genre

   // numTiers logic — capped by maxTiers for genre
   const numTiers = Math.min(
     maxTiers,
     targetLevels <= 3 ? 1
       : targetLevels <= 10 ? 2
       : targetLevels <= 25 ? 3
       : targetLevels <= 60 ? 4
       : 5
   );

   for (let i = 0; i < numTiers; i++) {
     const arch = tierArchetypes[i] ?? tierArchetypes[tierArchetypes.length - 1];
     // ... push to tiers with arch.name, arch.dominant_mechanic, etc.
   }
   ```

3. **Для deck-builder (Card_Lords)** — добавить archetypes:
   - Starter_Deck (card_basics/transitive/linear/stable)
   - Deck_Expansion (card_synergy/situational/exponential/abundant)
   - Combo_Mastery (combo_chains/intransitive/exponential/specialized)
   - Meta_Deck (meta_strategies/mixed/logarithmic/meta)

4. **Для survival (Frostbite)**:
   - Scrounge (resource_gathering/transitive/linear/scarce)
   - Shelter (crafting/situational/linear/stable)
   - Sustain (base_building/situational/exponential/abundant)
   - Thrive (automation/intransitive/exponential/specialized)
   - Endgame (meta_progression/mixed/logarithmic/meta)

5. **Для tower_defense (Sky_Fortress)**:
   - Tutorial_Waves (basic_towers/transitive/linear/stable)
   - Tower_Unlocks (tower_synergy/situational/exponential/abundant)
   - Specialization (counter_builds/intransitive/exponential/specialized)
   - Endless_Waves (meta_progression/mixed/logarithmic/meta)

**Тест-кейсы**:
- POST с `genre="rpg"` → tier names: `["Onboarding", "Foundation",
  "Expansion", "Mastery"]` (или 5 с Endgame для 60+ levels).
- POST с `genre="puzzle"` → tier names: `["Tutorial_Mechanics",
  "Mechanic_Mix", "Twist", "Master_Puzzles"]` (max 4 tiers, даже для 100
  levels).
- POST с `genre="metroidvania"` → tier names: `["First_Ability",
  "Backtrack_Open", "Sequence_Break", "True_Ending"]` (max 4).
- POST с `genre="unknown_genre"` → fallback на `DEFAULT_TIER_ARCHETYPES`.
- POST с `genre="rpg", target_levels=70` → 5 tiers: Onboarding, Foundation,
  Expansion, Mastery, Endgame.
- POST с `genre="puzzle", target_levels=70` → 4 tiers (max для puzzle),
  bigger tier_size.

**Риски**:
- **Subjectivity**: archetype definitions — debated. Митигация: документировать
  rationale, использовать консенсус из Bible + Adams/Dormans + Schreiber.
- **Maintenance**: 10+ genres × 4-5 archetypes = 40-50 записей. Митигация:
  генерация через LLM + ручной review.
- **UI impact**: `TiersTab.tsx` отображает имена tiers — должно корректно
  показывать русские/английские имена.

**Dependencies**: TASK-5a.1 (использует `difficulty_curve` имена из
`VALID_CURVE_TYPES`)

---

### TASK-5a.4: Динамический economyLink (genre-aware)

**Сложность**: M
**Приоритет**: 🟡 (после TASK-5a.3)
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 581-588,
609-616), `src/constants/progression.ts` (новый `GENRE_ECONOMY_LINK`)

**Описание проблемы**:

`economyLink` (строки 581-588) — hardcoded для всех жанров:
```ts
economyLink: JSON.stringify({
  economic_phases: tiers.map((t) => ({
    tier: `tier_${t.index}`,
    primary_resources: ["xp", "gold"],
    primary_activities: [t.dominant_mechanic],
  })),
  conversion_chains: ["xp→level", "gold→items"],
}),
```

Подтверждено во всех 10 test_projects: `economy_link` (если бы возвращался в
response) содержал бы `["xp", "gold"]` для всех, включая Card_Lords
(deck-builder), Frostbite (survival), Harvest_Moonlight (farming), Nitro_Rush
(racing).

Также `economy_link` сохраняется в БД, но **НЕ возвращается в POST response**
(см. TASK-5a.11).

**Решение**:

1. **Создать `GENRE_ECONOMY_LINK` в `src/constants/progression.ts`**:
   ```ts
   export interface GenreEconomyLink {
     primary_resources: string[];
     secondary_resources?: string[];
     conversion_chains: string[];
   }

   export const GENRE_ECONOMY_LINK: Record<string, GenreEconomyLink> = {
     rpg: {
       primary_resources: ["xp", "gold"],
       secondary_resources: ["mana", "stamina"],
       conversion_chains: ["xp→level", "gold→items", "items→power"],
     },
     roguelike: {
       primary_resources: ["xp", "souls"],
       secondary_resources: ["gold"],
       conversion_chains: ["xp→level", "souls→upgrades", "gold→consumables"],
     },
     deck_builder: {
       primary_resources: ["cards", "deck_slots"],
       secondary_resources: ["gold", "mana"],
       conversion_chains: ["gold→card_packs", "cards→deck", "wins→gold"],
     },
     puzzle: {
       primary_resources: ["moves", "stars"],
       secondary_resources: ["hints"],
       conversion_chains: ["stars→level_unlock", "hints→move_savings"],
     },
     racing: {
       primary_resources: ["credits", "xp"],
       secondary_resources: ["nitro", "rep"],
       conversion_chains: ["credits→vehicles", "xp→licenses", "wins→credits"],
     },
     survival: {
       primary_resources: ["health", "hunger", "materials"],
       secondary_resources: ["warmth", "tools"],
       conversion_chains: ["materials→shelter", "shelter→warmth", "warmth→health"],
     },
     fps: {
       primary_resources: ["ammo", "health", "armor"],
       secondary_resources: ["credits"],
       conversion_chains: ["credits→weapons", "ammo→kills", "kills→credits"],
     },
     tower_defense: {
       primary_resources: ["gold", "lives"],
       secondary_resources: ["xp"],
       conversion_chains: ["gold→towers", "xp→upgrades", "towers→defense"],
     },
     metroidvania: {
       primary_resources: ["health", "abilities"],
       secondary_resources: ["missiles", "energy"],
       conversion_chains: ["exploration→abilities", "abilities→new_areas"],
     },
     simulation: {
       primary_resources: ["crops", "gold"],
       secondary_resources: ["seeds", "tools"],
       conversion_chains: ["seeds→crops", "crops→gold", "gold→upgrades"],
     },
     strategy: {
       primary_resources: ["minerals", "units"],
       secondary_resources: ["tech", "territory"],
       conversion_chains: ["minerals→units", "tech→upgrades", "units→territory"],
     },
     rhythm: {
       primary_resources: ["score", "combo"],
       secondary_resources: ["stars"],
       conversion_chains: ["combo→score", "score→stars", "stars→song_unlock"],
     },
   };

   export function getGenreEconomyLink(genre: string): GenreEconomyLink {
     const normalized = genre.toLowerCase().replace(/[\s-]/g, "_");
     return GENRE_ECONOMY_LINK[normalized] ?? {
       primary_resources: ["xp", "gold"],
       conversion_chains: ["xp→level", "gold→items"],
     };
   }
   ```

2. **Использовать в route** (вынести в функцию, использовать и в create и в
   update — DRY):
   ```ts
   function buildEconomyLink(
     tiers: Tier[],
     genre: string,
   ): Record<string, unknown> {
     const link = getGenreEconomyLink(genre);
     return {
       economic_phases: tiers.map((t) => ({
         tier: `tier_${t.index}`,
         primary_resources: link.primary_resources,
         secondary_resources: link.secondary_resources ?? [],
         primary_activities: [t.dominant_mechanic],
       })),
       conversion_chains: link.conversion_chains,
       genre_economy_class: link.primary_resources.length > 2 ? "complex" : "simple",
     };
   }

   const economyLink = buildEconomyLink(tiers, genre);
   ```

3. **Добавить `economy_link` в `result`** (см. TASK-5a.11) — сейчас только в
   DB upsert:
   ```ts
   const result: Record<string, unknown> = {
     // ...
     economy_link: economyLink,  // NEW
     // ...
   };
   ```

4. **Если upstream economy block уже сгенерирован** (project.economy) —
   проверить соответствие и выдать warning если progression economyLink
   конфликтует с economy resource_model:
   ```ts
   if (proj.economy) {
     const ecoResources = JSON.parse(proj.economy.resourceModel || "{}").resources || [];
     const linkResources = economyLink.primary_resources;
     const mismatch = linkResources.filter(r => !ecoResources.includes(r));
     if (mismatch.length > 0) {
       issues.push({
         severity: "warning",
         description: `Economy link mismatch: ${mismatch.join(", ")} not in economy resource_model`,
       });
     }
   }
   ```

**Тест-кейсы**:
- POST с `genre="rpg"` → `economy_link.primary_resources = ["xp", "gold"]`.
- POST с `genre="deck_builder"` → `economy_link.primary_resources = ["cards",
  "deck_slots"]`, `conversion_chains` содержит `"gold→card_packs"`.
- POST с `genre="survival"` → `primary_resources` содержит `"health"`,
  `"hunger"`, `"materials"`.
- POST с `genre="unknown"` → fallback на `["xp", "gold"]`.
- Если `proj.economy` уже сохранён с `resources: ["gold", "materials"]` и
  progression genre="rpg" → `economy_link.primary_resources = ["xp", "gold"]`,
  issue "xp not in economy resource_model".

**Риски**:
- **Genre normalization**: `deck_builder` vs `deck-builder` vs `DeckBuilder`.
  Митигация: `normalize` helper через lowercase + replace.
- **Upstream dependency**: если economy block ещё не сгенерирован,
  `economyLink` всё равно создаётся из genre table — OK.

**Dependencies**: TASK-5a.3 (использует tiers из genre-aware archetypes),
TASK-5a.11 (economy_link в response)

---

### TASK-5a.5: Починить unlock tree (leading space + cap + name uniqueness)

**Сложность**: S
**Приоритет**: 🔴
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 362-391)

**Описание проблемы**:

Три бага в `unlockTree` (строки 362-391):

1. **Leading space в `" elemental_attack"`** (строка 366):
   ```ts
   const unlockNames = [
     "double_jump",
     "dash",
     "shield_block",
     " elemental_attack",   // ← LEADING SPACE BUG
     "combo_finisher",
     // ...
   ```
   Подтверждено во всех 10 test_projects на `unlock_tree[3].unlock_name`.

2. **Cap на 10 имён** (строка 383):
   ```ts
   const idx = Math.min(unlockNames.length - 1, Math.floor(lvl / unlockEvery) - 1);
   ```
   Для `targetLevels > 100` (например 200, unlockEvery=20 → 10 unlocks):
   - lvl=20, idx=0; lvl=40, idx=1; ... lvl=200, idx=9. OK.
   - Для `targetLevels=500, unlockEvery=50` → 10 unlocks, idx 0..9. OK.
   - Но `unlockEvery = max(1, floor(targetLevels / 10))` — всегда даёт ~10
     unlocks. Если пользователь хочет больше unlocks (например каждые 3
     уровня для targetLevels=30 → 10 unlocks, idx 0..9. OK).
   - Реальная проблема: если `unlockEvery < 1` (невозможно из-за max(1,...))
     или если `targetLevels > 100` и хочется unlocks каждые 5 уровней (тогда
     20 unlocks, idx 0..19, capped at 9 → 11 unlocks получают `"prestige_reset"`).

3. **`"prestige_reset"` как последнее имя** — даже для проектов без
   prestige-механики (Card_Lords — deck-builder, Frostbite — survival, и т.д.).
   Это имя должно быть только для проектов с `monetization_model` supporting
   prestige (f2p, hybrid).

**Решение**:

1. **Убрать leading space** (строка 366):
   ```ts
   "elemental_attack",   // ← fixed
   ```

2. **Сделать unlock tree genre-aware и без cap**:
   ```ts
   const GENRE_UNLOCK_POOLS: Record<string, string[]> = {
     rpg: [
       "double_jump", "dash", "shield_block", "elemental_attack",
       "combo_finisher", "ranged_weapon", "stealth_mode", "summon_ally",
       "ultimate_ability", "prestige_reset",
     ],
     roguelike: [
       "biome_unlock", "alt_path", "boss_key", "rune_slot",
       "reroll_token", "starting_bonus", "perk_slot", "meta_unlock",
       "ascension_mode", "infinity_token",
     ],
     deck_builder: [
       "card_slot", "deck_expansion", "rare_card", "legendary_card",
       "sideboard", "card_evolve", "combo_slot", "card_craft",
       "mythic_card", "meta_deck",
     ],
     puzzle: [
       "mechanic_unlock", "twist_reveal", "rule_inversion", "bonus_room",
       "secret_level", "puzzle_editor", "challenge_mode", "star_rank",
       "master_puzzle", "infinity_puzzle",
     ],
     racing: [
       "license_unlock", "track_unlock", "vehicle_class", "tuning_slot",
       "nitro_upgrade", "tire_compound", "drift_kit", "performance_part",
       "championship", "legend_circuit",
     ],
     survival: [
       "tool_unlock", "shelter_blueprint", "crafting_station", "farm_plot",
       "cooking_recipe", "weapon_craft", "armor_craft", "vehicle_craft",
       "automation_module", "endgame_shelter",
     ],
     fps: [
       "weapon_unlock", "attachment_slot", "perk_slot", "equipment_slot",
       "throwable_unlock", "ultimate_ability", "killstreak", "class_unlock",
       "prestige_rank", "mastery_token",
     ],
     tower_defense: [
       "tower_unlock", "tower_upgrade", "special_ability", "hero_unit",
       "map_expansion", "difficulty_mode", "challenge_mod", "meta_tower",
       "endless_mode", "ascension_tower",
     ],
     metroidvania: [
       "ability_unlock", "double_jump", "dash", "grapple",
       "morph_ball", "weapon_upgrade", "energy_tank", "missile_expansion",
       "true_ending", "sequence_break",
     ],
     simulation: [
       "tool_unlock", "land_expansion", "crop_unlock", "recipe_unlock",
       "building_blueprint", "animal_unlock", "vehicle_unlock",
       "automation_module", "seasonal_event", "endgame_content",
     ],
     rhythm: [
       "song_unlock", "difficulty_unlock", "modifier_unlock", "character_unlock",
       "instrument_unlock", "visual_unlock", "challenge_mode", "endless_mode",
       "perfect_run", "master_track",
     ],
   };

   function getUnlockPool(genre: string, monetizationModel: string): string[] {
     const normalized = genre.toLowerCase().replace(/[\s-]/g, "_");
     const pool = GENRE_UNLOCK_POOLS[normalized] ?? GENRE_UNLOCK_POOLS.rpg;
     // Filter out prestige_reset if monetization doesn't support it
     if (!["f2p", "hybrid", "p2w"].includes(monetizationModel)) {
       return pool.filter(name => !name.includes("prestige") && !name.includes("ascension"));
     }
     return pool;
   }
   ```

3. **Переписать генерацию unlockTree** (строки 381-391):
   ```ts
   const unlockPool = getUnlockPool(genre, monetizationModel);
   const unlockTypes = ["mechanic", "ability", "content", "area"];
   const unlockTree: Array<{
     level: number;
     unlock_name: string;
     unlock_type: string;
     description: string;
   }> = [];

   // Aim for ~10 unlocks, but allow more for longer games
   const desiredUnlocks = Math.min(20, Math.max(5, Math.floor(targetLevels / 5)));
   const unlockEvery = Math.max(1, Math.floor(targetLevels / desiredUnlocks));

   for (let i = 0; i < desiredUnlocks && (i * unlockEvery + unlockEvery) <= targetLevels; i++) {
     const lvl = (i + 1) * unlockEvery;
     const unlockName = unlockPool[i % unlockPool.length];
     const typeIdx = (i + lvl) % unlockTypes.length;
     unlockTree.push({
       level: lvl,
       unlock_name: unlockName,
       unlock_type: unlockTypes[typeIdx],
       description: `Открывается на уровне ${lvl}. Расширяет базовый геймплей.`,
     });
   }
   ```

4. **Проверить что `unlock_name` всегда trimmed и lowercase snake_case**:
   ```ts
   // Sanity check
   console.assert(
     !unlockTree.some(u => u.unlock_name !== u.unlock_name.trim()),
     "Unlock name has leading/trailing whitespace"
   );
   ```

**Тест-кейсы**:
- POST с `genre="rpg", target_levels=50` → 10 unlocks, `unlock_tree[3].unlock_name === "elemental_attack"` (без пробела).
- POST с `genre="deck_builder"` → `unlock_tree[0].unlock_name === "card_slot"`, не `"double_jump"`.
- POST с `genre="metroidvania"` → `unlock_tree[0].unlock_name === "ability_unlock"`.
- POST с `target_levels=500, desiredUnlocks=20` → 20 unlocks, все с уникальными именами из пула (10 имён циклятся).
- POST с `monetization_model="b2p"` → `unlock_tree` НЕ содержит `"prestige_reset"` или `"ascension_mode"`.
- POST с `monetization_model="f2p"` → `unlock_tree` МОЖЕТ содержать `"prestige_reset"` (только для подходящего жанра).
- POST с `target_levels=1` → `unlockTree` пустой (не может поместить unlock на 1 уровне без переполнения).
- POST с `target_levels=5` → 1 unlock на level 5.
- Все `unlock_name` проходят regex `/^[a-z][a-z0-9_]*$/` (no leading space, no uppercase).

**Риски**:
- **Genre coverage**: 12 жанров в `GENRE_UNLOCK_POOLS` — нужно покрыть все из
  `GENRES` config. Митигация: fallback на rpg pool для unknown genres.
- **UI отображение**: `ContentPlanTab.tsx` отображает unlock_tree — должно
    корректно показывать новые имена.

**Dependencies**: нет

---

### TASK-5a.6: Перенести AI enrichment ДО persist

**Сложность**: S
**Приоритет**: 🔴
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 560-636)

**Описание проблемы**:

`route.ts:560-620` — `db.projectProgression.upsert` сохраняет `fullProfile:
JSON.stringify(result)`. Затем `route.ts:624-636` — optional AI enrichment:
```ts
if (useAi) {
  const aiInsights = await enrichProgression({ ... });
  if (aiInsights) {
    result.ai_insights = aiInsights;
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
```

`result.ai_insights` добавляется ПОСЛЕ persist, поэтому не попадает в
`fullProfile` в БД. При перезагрузке проекта (GET `/progression/[projectId]`)
`ai_insights` отсутствует.

Подтверждено: только 1 из 10 test_projects (01_Shadow_Depths) имеет
`ai_insights` в `05_progression.json` (и это в response body, не в БД). 9
остальных — без AI insights, потому что test script отправляет `use_ai:true`,
но AI вызов либо упал, либо insights не сохранились.

Тот же баг в Блоках 1, 3, 4, 6 — описан в `AUDIT_REPORT.md` (S1, action #9).

**Решение**:

1. **Перенести AI enrichment ДО persist** (как в Block 2 economy route):
   ```ts
   // --- Optional AI enrichment (BEFORE persist) ---
   if (useAi) {
     const aiInsights = await enrichProgression({
       projectName: proj.name || "Untitled",
       genre,
       totalLevels: targetLevels,
       targetDurationHours: targetDuration,
       // NEW: pass actual state for actionable advice (see TASK-5a.12)
       macroModel: macroModel,
       tierModel: tierModel,
       curves: curves,
       validation: validation,
     });
     if (aiInsights) {
       result.ai_insights = aiInsights;
       (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
     }
   }

   // --- Persist (after AI enrichment) ---
   await db.projectProgression.upsert({
     where: { projectId: proj.id },
     create: {
       // ...
       fullProfile: JSON.stringify(result),  // now includes ai_insights
     },
     update: {
       // ...
       fullProfile: JSON.stringify(result),
     },
   });

   await updateProjectStage(proj.id, "progression");
   ```

2. **Добавить поле `aiInsights` в Prisma schema** (опционально, для прямой
   выборки без парсинга `fullProfile`):
   ```prisma
   model ProjectProgression {
     // ...
     aiInsights            String?   // JSON: { text: string, generated_at: string }
     modelsUsed            String?   // JSON: string[]
     // ...
   }
   ```
   Создать миграцию `prisma/migrations/XXX_add_progression_ai_fields/migration.sql`:
   ```sql
   ALTER TABLE "project_progressions" ADD COLUMN "aiInsights" TEXT;
   ALTER TABLE "project_progressions" ADD COLUMN "modelsUsed" TEXT;
   ```

3. **Обновить `result` объект** — добавить `ai_insights: null` по умолчанию:
   ```ts
   const result: Record<string, unknown> = {
     // ...
     ai_insights: null,  // will be filled by enrichProgression if useAi=true
     // ...
   };
   ```

4. **Обновить GET endpoint** — `ai_insights` должен возвращаться из БД:
   ```ts
   // in /progression/[projectId]/route.ts
   return NextResponse.json({
     // ...
     ai_insights: p.aiInsights ? JSON.parse(p.aiInsights) : null,
     models_used: p.modelsUsed ? JSON.parse(p.modelsUsed) : null,
     // ...
   });
   ```

**Тест-кейсы**:
- POST с `use_ai: true` → response содержит `ai_insights: <non-empty string>`,
  `models_used` содержит `"glm-4.6 (ai-enrichment)"`.
- POST с `use_ai: false` → response содержит `ai_insights: null`,
  `models_used` НЕ содержит `"glm-4.6 (ai-enrichment)"`.
- После POST с `use_ai: true`, GET `/progression/[projectId]` возвращает тот
  же `ai_insights`.
- Если AI вызов падает (`enrichProgression` возвращает `null`) — `ai_insights`
  остаётся `null`, persist всё равно происходит, ошибок нет.

**Риски**:
- **Latency**: AI enrichment добавляет 1-5 секунд к ответу. Митигация: можно
  вернуть ответ сразу, а AI enrichment делать в background (но это усложняет
  архитектуру — отложить до отдельной задачи).
- **Migration risk**: Prisma миграция может потребовать `prisma db push` или
  `prisma migrate dev`. Митигация: тестировать на dev БД сначала.

**Dependencies**: TASK-5a.12 (расширенный prompt передаётся в enrichProgression)

---

### TASK-5a.7: run-full-pipeline: derive progression params from upstream

**Сложность**: M
**Приоритет**: 🔴
**Файлы**: `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`
(строки 137-145), `src/lib/pipeline-helpers.ts` (строки 415-422),
`scripts/run_pipeline_test.sh` (строки 118-124)

**Описание проблемы**:

`run-full-pipeline/route.ts:137-145` — StageDef для progression:
```ts
{
  stage: "progression",
  block_id: 5,
  endpoint: "/api/v1/progression/design",
  buildBody: (i) => ({
    total_levels: i.totalLevels,
    use_ai: i.useAi,
  }),
},
```

Не передаёт `genre`, `progression_type`, `monetization_model`, `pacing` —
route использует дефолты (`rpg`, `exponential`, `b2p`, `balanced`). Все 10
test_projects получают идентичный progression output.

`scripts/run_pipeline_test.sh:122`:
```bash
-d "{\"project_id\":\"$PID\",\"total_levels\":50,\"use_ai\":true}"
```

Тоже не передаёт `genre` (хотя скрипт знает жанр: `GENRES=("RPG" "Tower Defense" "Rhythm" "Puzzle" "Metroidvania" "Strategy" "Sandbox" "Shooter" "Simulation" "Racing")`).

`pipeline-helpers.ts:415-422` — `suggested` defaults:
```ts
input.suggested = {
  genre: project.genre || project.concept?.genre || "rpg",
  target_duration: 40,
  target_levels: 50,
  progression_type: "exponential",
  monetization_model: "b2p",
  pacing: "balanced",
};
```

Genre берётся из project.concept, но остальные параметры — hardcoded.

**Решение**:

1. **В `run-full-pipeline/route.ts`** — расширить `PipelineInput` и
   `buildBody` для progression:
   ```ts
   interface PipelineInput {
     // ... existing
     progressionParams: {
       genre: string;
       target_duration: number;
       target_levels: number;
       progression_type: string;
       monetization_model: string;
       pacing: string;
     };
   }

   // В обработке body:
   const progressionParams = body?.progression_params ?? null;

   // После загрузки snapshot (snap):
   const finalProgressionParams = progressionParams ?? {
     genre: snap?.project?.concept?.genre ?? snap?.project?.genre ?? "rpg",
     target_duration: 40,
     target_levels: snap?.project?.concept?.targetDuration ?? 50,
     progression_type: "exponential",
     monetization_model: deriveMonetizationFromGenre(snap?.project?.concept?.genre),
     pacing: derivePacingFromCoreLoop(snap?.project?.coreLoop?.structuralType),
   };

   // StageDef для progression:
   {
     stage: "progression",
     block_id: 5,
     endpoint: "/api/v1/progression/design",
     buildBody: (i) => ({
       genre: i.progressionParams.genre,
       target_duration: i.progressionParams.target_duration,
       target_levels: i.progressionParams.target_levels,
       progression_type: i.progressionParams.progression_type,
       monetization_model: i.progressionParams.monetization_model,
       pacing: i.progressionParams.pacing,
       use_ai: i.useAi,
     }),
   },
   ```

2. **Добавить helper функции** для derivation:
   ```ts
   function deriveMonetizationFromGenre(genre?: string | null): string {
     if (!genre) return "b2p";
     const g = genre.toLowerCase();
     if (["rpg", "mmorpg", "strategy", "simulation"].includes(g)) return "b2p";
     if (["puzzle", "match3", "casual"].includes(g)) return "f2p";
     if (["racing", "sports"].includes(g)) return "hybrid";
     if (["roguelike", "deck_builder"].includes(g)) return "b2p";
     return "b2p";
   }

   function derivePacingFromCoreLoop(structuralType?: string | null): string {
     if (!structuralType) return "balanced";
     const t = structuralType.toLowerCase();
     if (["engine", "engine_building"].includes(t)) return "intense";
     if (["ecology", "converter"].includes(t)) return "relaxed";
     return "balanced";
   }

   function deriveProgressionType(genre?: string | null): string {
     if (!genre) return "exponential";
     const g = genre.toLowerCase();
     if (["puzzle", "casual"].includes(g)) return "linear";      // casual pacing
     if (["rpg", "mmorpg"].includes(g)) return "exponential";     // classic RPG
     if (["roguelike"].includes(g)) return "triangular";          // Schreiber's triangular
     if (["metroidvania"].includes(g)) return "s_curve";          // Sellers logistic
     if (["f2p", "mobile"].includes(g)) return "diminishing";     // fast early, slow late
     return "exponential";
   }
   ```

3. **Обновить `scripts/run_pipeline_test.sh`** — передавать жанр в
   progression:
   ```bash
   # Normalize genre: "Tower Defense" → "tower_defense", "RPG" → "rpg"
   GENRE_NORMALIZED=$(echo "$GENRE" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')

   # Step 5: Progression (AI)
   echo "  [5/8] Progression (AI)..."
   R=$(curl -s -X POST $API/progression/design \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d "{\"project_id\":\"$PID\",\"genre\":\"$GENRE_NORMALIZED\",\"total_levels\":50,\"use_ai\":true}" \
     --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
   echo "$R" > "$RUN_DIR/05_progression.json"
   ```

4. **Обновить `pipeline-helpers.ts:415-422`** — `suggested` должен
   использовать те же helper'ы:
   ```ts
   input.suggested = {
     genre: project.genre || project.concept?.genre || "rpg",
     target_duration: 40,
     target_levels: 50,
     progression_type: deriveProgressionType(project.concept?.genre),
     monetization_model: deriveMonetizationFromGenre(project.concept?.genre),
     pacing: derivePacingFromCoreLoop(project.coreLoop?.structuralType),
   };
   ```

5. **Опционально: вынести helper'ы в `src/lib/progression-derivations.ts`**
   для переиспользования между route и pipeline-helpers.

**Тест-кейсы**:
- `run-full-pipeline` для Card_Lords (deck_builder) → progression output
  имеет `genre: "deck_builder"`, `tier_model.tiers[0].name` ∈
  `["Starter_Deck", "Deck_Expansion", ...]` (из TASK-5a.3).
- `run-full-pipeline` для Frostbite (survival) → `monetization_model: "b2p"`,
  `pacing: "relaxed"` (ecology core loop), `progression_type: "exponential"`.
- `run-full-pipeline` для Void_Runner (metroidvania) → `progression_type:
  "s_curve"`, `pacing: "balanced"`, `genre: "metroidvania"`.
- После `run-full-pipeline`, GET `/progression/[projectId]` для двух разных
  проектов возвращает РАЗНЫЕ macro_model (genre-specific).
- `run_pipeline_test.sh` успешно передаёт жанр (post-condition: 10
  test_projects имеют разные `macro_model.genre`).

**Риски**:
- **Genre normalization mismatch**: bash `tr` vs JS `replace(/[\s-]/g, "_")`.
  Митигация: использовать один формат (lowercase snake_case) в обоих местах.
- **Backward compat**: существующие pipeline runs могут полагаться на
  defaults. Митигация: сохранить defaults как fallback.

**Dependencies**: TASK-5a.3 (genre-aware archetypes), TASK-5a.4 (genre-aware
economyLink), TASK-5a.5 (genre-aware unlock pool)

---

### TASK-5a.8: Дополнить macro_model RPG-формулой (Bible 6.7.4)

**Сложность**: M
**Приоритет**: 🟡 (после TASK-5a.1)
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 245-256),
`src/types/progression.ts`

**Описание проблемы**:

Bible 6.7.4 определяет макро-модель RPG-прогрессии:
```
Длительность              = T часов
Число_уровней             = L
Переходов                 = L − 1
Переходов/час             ≈ L/T (больше в начале, меньше в конце)
Стадий_контента           ≈ L/2
Конфигураций_врагов       ≥ 3 × (L/2)
Очков_характеристик/уровень = (Финальное − Начальное) / (L − 1)
```

Пример: 40-часовая RPG с 20 уровнями → 19 переходов → ~0.5 переходов/час →
10 стадий контента → ≥30 конфигураций врагов.

Текущий macro_model (строки 245-256):
```ts
const macroModel = {
  total_levels: targetLevels,
  target_duration: targetDuration,
  progression_type: progressionType,
  content_requirements: `${targetLevels} уровней, ${targetDuration}ч gameplay, ${pacing}`,  // STRING!
  emergence_ratio: Math.min(1, emergenceRatio),
  lock_key_model: lockKeyModel,
  monetization_model: monetizationModel,
  pacing,
  genre,
  notes: MONETIZATION_NOTES[monetizationModel] || "",
};
```

`content_requirements` — строка, не структурированные данные. Нет
`transitions_count`, `transitions_per_hour`, `content_stages`,
`enemy_configs_min`, `char_points_per_level`.

**Решение**:

1. **Вычислить все Bible 6.7.4 fields**:
   ```ts
   const transitionsCount = Math.max(0, targetLevels - 1);
   const transitionsPerHour = targetDuration > 0 ? transitionsCount / targetDuration : 0;
   const contentStages = Math.max(1, Math.floor(targetLevels / 2));
   const enemyConfigsMin = 3 * contentStages;
   // Character points: assume Final = 100, Initial = 10 (configurable later)
   const finalCharPoints = 100;
   const initialCharPoints = 10;
   const charPointsPerLevel = targetLevels > 1
     ? (finalCharPoints - initialCharPoints) / (targetLevels - 1)
     : finalCharPoints - initialCharPoints;
   ```

2. **Расширить `macroModel`**:
   ```ts
   const macroModel = {
     total_levels: targetLevels,
     target_duration: targetDuration,
     progression_type: progressionType,
     // NEW: Bible 6.7.4 macro model RPG fields
     transitions_count: transitionsCount,
     transitions_per_hour: Number(transitionsPerHour.toFixed(3)),
     content_stages: contentStages,
     enemy_configs_min: enemyConfigsMin,
     char_points_per_level: Number(charPointsPerLevel.toFixed(2)),
     char_points_final: finalCharPoints,
     char_points_initial: initialCharPoints,
     // END NEW
     content_requirements: {
       levels: targetLevels,
       duration_hours: targetDuration,
       pacing: pacing,
       summary: `${targetLevels} уровней, ${targetDuration}ч gameplay, ${pacing}`,
     },  // was string, now object
     emergence_ratio: Math.min(1, emergenceRatio),
     lock_key_model: lockKeyModel,
     monetization_model: monetizationModel,
     pacing,
     genre,
     notes: MONETIZATION_NOTES[monetizationModel] || "",
   };
   ```

3. **Обновить тип `ProgressionDesignResponse.macro_model`** в
   `src/types/progression.ts`:
   ```ts
   macro_model: {
     total_levels: number;
     target_duration: number;
     progression_type: string;
     transitions_count: number;
     transitions_per_hour: number;
     content_stages: number;
     enemy_configs_min: number;
     char_points_per_level: number;
     char_points_final: number;
     char_points_initial: number;
     content_requirements: {
       levels: number;
       duration_hours: number;
       pacing: string;
       summary: string;
     };
     emergence_ratio: number;
     lock_key_model: string;
     monetization_model: string;
     pacing: string;
     genre: string;
     notes: string;
     [key: string]: unknown;
   };
   ```

4. **Добавить validation checks** для macro model:
   ```ts
   // Если transitions_per_hour > 2 — слишком частые переходы (фрустрация)
   if (transitionsPerHour > 2) {
     issues.push({
       severity: "warning",
       description: `Слишком частые переходы: ${transitionsPerHour.toFixed(2)}/час (Bible 6.7.4 рекомендует < 2)`,
     });
     suggestions.push("Увеличьте target_duration или уменьшите target_levels");
   }

   // Если transitions_per_hour < 0.1 — слишком редкие (скука)
   if (transitionsPerHour > 0 && transitionsPerHour < 0.1) {
     issues.push({
       severity: "warning",
       description: `Слишком редкие переходы: ${transitionsPerHour.toFixed(2)}/час (Bible 6.7.4 рекомендует > 0.1)`,
     });
   }

   // Если enemy_configs_min > 100 — нереалистичное количество контента
   if (enemyConfigsMin > 100) {
     issues.push({
       severity: "info",
       description: `Требуется ≥${enemyConfigsMin} конфигураций врагов — проверьте команду на реалистичность`,
     });
   }
   ```

5. **Обновить UI** `MacroParamsTab.tsx` — отображать новые поля в таблице:
   ```ts
   const entries = [
     // ... existing
     { key: "transitions_count", label: "Переходов", value: macro.transitions_count },
     { key: "transitions_per_hour", label: "Переходов/час", value: macro.transitions_per_hour?.toFixed(2) },
     { key: "content_stages", label: "Стадий контента", value: macro.content_stages },
     { key: "enemy_configs_min", label: "Мин. конфигураций врагов", value: macro.enemy_configs_min },
     { key: "char_points_per_level", label: "Очков характеристик/уровень", value: macro.char_points_per_level?.toFixed(2) },
   ];
   ```

**Тест-кейсы**:
- POST с `target_levels=20, target_duration=40` →
  - `transitions_count: 19`
  - `transitions_per_hour: 0.475` (19/40)
  - `content_stages: 10`
  - `enemy_configs_min: 30`
  - `char_points_per_level: 4.74` ((100-10)/19)
- POST с `target_levels=50, target_duration=40` → `transitions_per_hour:
  1.225` (49/40).
- POST с `target_levels=1` → `transitions_count: 0`, `transitions_per_hour:
  0`, `char_points_per_level: 90` (Final-Initial, без деления).
- POST с `target_levels=200, target_duration=10` →
  `transitions_per_hour: 19.9` → warning "слишком частые переходы".
- `content_requirements` теперь объект, а не строка — backward
  compatibility: UI должен использовать `content_requirements.summary` для
  отображения.

**Риски**:
- **Backward compat**: `content_requirements` меняет тип со string на object.
  Митигация: добавить `summary` поле в object, обновить UI использовать
  `content_requirements.summary` или сам object.
- **Migration**: существующие записи в БД имеют `content_requirements` как
  string внутри `macroModel` JSON. Митигация: при чтении из БД,
  нормализовать: если string, обернуть в `{summary: <string>}`.

**Dependencies**: TASK-5a.1 (новые кривые влияют на char_points Final)

---

### TASK-5a.9: Починить transition_map (dangling last-tier trigger)

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 302-312)

**Описание проблемы**:

`route.ts:302-305`:
```ts
const transitionMap: Record<string, string> = {};
for (let i = 0; i < tiers.length - 1; i++) {
  transitionMap[`tier_${tiers[i].index}`] = `tier_${tiers[i + 1].index}`;
}
```

Создаёт переходы только между существующими tiers. Последний tier (например
tier 4 "Mastery" с `transition_trigger: "endgame_unlock"`) не имеет entry в
transition_map, потому что нет tier 5.

Подтверждено в test_projects: `transition_map: {"tier_1": "tier_2",
"tier_2": "tier_3", "tier_3": "tier_4"}` — нет ключа `tier_4`.

Поле `transition_trigger` у последнего tier — dangling reference (указывает
на несуществующий target).

**Решение**:

1. **Добавить явный terminal transition для последнего tier**:
   ```ts
   const transitionMap: Record<string, string> = {};
   for (let i = 0; i < tiers.length - 1; i++) {
     transitionMap[`tier_${tiers[i].index}`] = `tier_${tiers[i + 1].index}`;
   }
   // NEW: terminal transition for last tier
   const lastTier = tiers[tiers.length - 1];
   transitionMap[`tier_${lastTier.index}`] = lastTier.transition_trigger === "completion"
     ? "completed"
     : lastTier.transition_trigger === "prestige_unlock"
       ? "prestige_reset"
       : lastTier.transition_trigger === "endgame_unlock"
         ? "endgame_content"
         : "end";
   ```

2. **Альтернативно: структурированный transition_map с metadata**:
   ```ts
   interface TierTransition {
     from: string;
     to: string;
     trigger: string;
     is_terminal: boolean;
   }

   const transitions: TierTransition[] = [];
   for (let i = 0; i < tiers.length - 1; i++) {
     transitions.push({
       from: `tier_${tiers[i].index}`,
       to: `tier_${tiers[i + 1].index}`,
       trigger: tiers[i].transition_trigger,
       is_terminal: false,
     });
   }
   // Terminal transition
   const lastTier = tiers[tiers.length - 1];
   transitions.push({
     from: `tier_${lastTier.index}`,
     to: "endgame",
     trigger: lastTier.transition_trigger,
     is_terminal: true,
   });

   const tierModel = {
     tiers,
     num_tiers: numTiers,
     total_levels: targetLevels,
     transition_map: Object.fromEntries(transitions.map(t => [t.from, t.to])),
     transitions,  // NEW: structured transitions
   };
   ```

3. **Обновить тип `ProgressionDesignResponse.tier_model`** в
   `src/types/progression.ts`:
   ```ts
   tier_model: {
     tiers: Array<{ /* ... */ }>;
     num_tiers: number;
     total_levels: number;
     transition_map: Record<string, string>;
     transitions?: Array<{
       from: string;
       to: string;
       trigger: string;
       is_terminal: boolean;
     }>;
   };
   ```

**Тест-кейсы**:
- POST с `target_levels=50` (4 tiers) → `transition_map` содержит 4 ключа:
  `tier_1`, `tier_2`, `tier_3`, `tier_4` → значения `tier_2`, `tier_3`,
  `tier_4`, `endgame_content` (или `end`).
- `transitions` array содержит 4 элемента, последний с `is_terminal: true`.
- POST с `target_levels=70` (5 tiers, includes Endgame) → `transition_map`
  содержит 5 ключей, последний `tier_5 → completed`.
- POST с `target_levels=1` (1 tier) → `transition_map` содержит 1 ключ
  `tier_1 → end`, `transitions` содержит 1 element с `is_terminal: true`.

**Риски**:
- **Backward compat**: существующие клиенты могут ожидать `transition_map` без
  terminal key. Митигация: добавить `transitions` array как supplementary
  field, оставить `transition_map` с terminal key.

**Dependencies**: TASK-5a.3 (genre-aware archetypes имеют разные
`transition_trigger` значения)

---

### TASK-5a.10: Параметризовать lock_key_model по genre (metroidvania)

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 240-243),
`src/constants/progression.ts`

**Описание проблемы**:

`route.ts:240-243`:
```ts
const lockKeyModel =
  monetizationModel === "f2p" || monetizationModel === "p2w"
    ? "soft_locks"
    : "key_gates";
```

Бинарный выбор: `soft_locks` (F2P/P2W) или `key_gates` (всё остальное).
Bible 6.6.2 определяет 3 типа:
1. **Простая модель** (linear key-lock chain) — adventure, FPS campaign.
2. **Метроидвания** (non-linear backtracking) — metroidvania, some RPGs.
3. **Динамические замки** (context-dependent) — survival, sandbox, dynamic
   weather/time-based.

Подтверждено: Void_Runner (metroidvania) получает `lock_key_model:
"key_gates"` — должно быть `"metroidvania"`.

**Решение**:

1. **Создать `GENRE_LOCK_KEY_MODEL` в `src/constants/progression.ts`**:
   ```ts
   export type LockKeyModel = "simple_key_lock" | "metroidvania" | "dynamic_locks" | "soft_locks" | "key_gates";

   export const GENRE_LOCK_KEY_MODEL: Record<string, LockKeyModel> = {
     rpg: "key_gates",
     roguelike: "dynamic_locks",      // procedural, varies per run
     metroidvania: "metroidvania",     // classic backtracking
     adventure: "simple_key_lock",
     fps: "simple_key_lock",
     puzzle: "simple_key_lock",
     racing: "key_gates",              // track unlocks
     deck_builder: "key_gates",        // card unlocks
     survival: "dynamic_locks",        // context-dependent (weather, hunger)
     sandbox: "dynamic_locks",
     simulation: "key_gates",
     strategy: "key_gates",
     tower_defense: "key_gates",       // wave-based unlocks
     rhythm: "key_gates",              // song unlocks
     horror: "simple_key_lock",
     platformer: "metroidvania",       // often metroidvania-style
     fighting: "key_gates",            // character unlocks
     mmorpg: "soft_locks",             // typically F2P with soft locks
   };

   export function getLockKeyModel(genre: string, monetizationModel: string): LockKeyModel {
     const normalized = genre.toLowerCase().replace(/[\s-]/g, "_");
     const base = GENRE_LOCK_KEY_MODEL[normalized] ?? "key_gates";
     // F2P/P2W overrides to soft_locks
     if (monetizationModel === "f2p" || monetizationModel === "p2w") {
       return "soft_locks";
     }
     return base;
   }
   ```

2. **Использовать в route**:
   ```ts
   import { getLockKeyModel } from "@/constants/progression";

   // Внутри POST:
   const lockKeyModel = getLockKeyModel(genre, monetizationModel);
   ```

3. **Расширить `MONETIZATION_NOTES`** чтобы включить lock_key_model context:
   ```ts
   const LOCK_KEY_DESCRIPTIONS: Record<LockKeyModel, string> = {
     simple_key_lock: "Линейная цепочка: ключ A → замок A → ключ Б → замок Б",
     metroidvania: "Нелинейная: несколько ключей, несколько замков, обратное отслеживание",
     dynamic_locks: "Контекстно-зависимые: открываются при определённых условиях (время, погода, репутация)",
     soft_locks: "Мягкие стены для monetization, преодолимые покупкой или гриндом",
     key_gates: "Жёсткие ключевые врата, требующие определённого условия (уровень, предмет)",
   };

   // В macroModel:
   notes: `${MONETIZATION_NOTES[monetizationModel] || ""} | ${LOCK_KEY_DESCRIPTIONS[lockKeyModel]}`,
   ```

**Тест-кейсы**:
- POST с `genre="metroidvania", monetization_model="b2p"` → `lock_key_model: "metroidvania"`.
- POST с `genre="metroidvania", monetization_model="f2p"` → `lock_key_model: "soft_locks"` (F2P override).
- POST с `genre="survival"` → `lock_key_model: "dynamic_locks"`.
- POST с `genre="adventure"` → `lock_key_model: "simple_key_lock"`.
- POST с `genre="rpg"` → `lock_key_model: "key_gates"`.
- POST с `genre="unknown"` → `lock_key_model: "key_gates"` (default).

**Риски**:
- **Genre coverage**: нужно покрыть все жанры из `GENRES` config. Митигация:
  fallback на `"key_gates"` для unknown.

**Dependencies**: нет

---

### TASK-5a.11: Унифицировать GET/POST shape + включить economy_link в response

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 547-558),
`src/app/api/v1/progression/[projectId]/route.ts`, `src/types/progression.ts`

**Описание проблемы**:

POST `/progression/design` возвращает:
```ts
{ id, macro_model, tier_model, curves, content_plan, validation, summary,
  stages_completed, latency_ms, models_used, ai_insights? }
```

GET `/progression/[projectId]` возвращает:
```ts
{ id, project_id, total_levels, tier_count, curve_type, target_duration_hours,
  macro_model, tier_model, curves, content_plan, economy_link, validation,
  full_profile, input_data, created_at, updated_at }
```

Различия:
- POST не возвращает `economy_link` (но сохраняет в БД).
- POST не возвращает `input_data` (но сохраняет в БД).
- POST не возвращает `created_at`, `updated_at`, `project_id`.
- GET не возвращает `summary`, `stages_completed`, `latency_ms`, `models_used`,
  `ai_insights`.
- GET возвращает top-level scalars (`total_levels`, `tier_count`, `curve_type`,
  `target_duration_hours`) — POST не возвращает.

Frontend (`block 5/page.tsx`) использует `ProgressionDesignResponse` тип из
POST, но если вызвать GET для reload, типы не совпадут.

Подтверждено: 9 из 10 test_projects не имеют `economy_link` в
`05_progression.json` (POST response), но `economy_link` есть в БД.

**Решение**:

1. **Унифицировать response shape** — оба endpoint'а возвращают одинаковый
   объект + metadata:
   ```ts
   // src/types/progression.ts
   export interface ProgressionDesignResponse {
     id: string;
     project_id?: string;          // present in both, but optional in POST
     macro_model: MacroModel;
     tier_model: TierModel;
     curves: ProgressionCurves;
     content_plan: ContentPlan;
     economy_link: EconomyLink;    // NEW: always present
     validation: ProgressionValidation;
     summary: Record<string, string>;
     input_data: ProgressionInput; // NEW: always present
     stages_completed: number[];
     latency_ms: number;
     models_used: string[];
     ai_insights: string | null;   // NEW: always present (null if no AI)
     // GET-only metadata:
     created_at?: string;
     updated_at?: string;
   }

   export interface ProgressionInput {
     genre: string;
     target_duration: number;
     target_levels: number;
     progression_type: string;
     monetization_model: string;
     pacing: string;
     use_ai: boolean;
   }

   export interface EconomyLink {
     economic_phases: Array<{
       tier: string;
       primary_resources: string[];
       secondary_resources: string[];
       primary_activities: string[];
     }>;
     conversion_chains: string[];
     genre_economy_class: string;
   }
   ```

2. **В POST route** — добавить `economy_link`, `input_data`, `project_id` в
   `result`:
   ```ts
   const inputData = {
     genre,
     target_duration: targetDuration,
     target_levels: targetLevels,
     progression_type: progressionType,
     monetization_model: monetizationModel,
     pacing,
     use_ai: useAi,
   };

   const result: ProgressionDesignResponse = {
     id: proj.id,
     project_id: proj.id,        // NEW
     macro_model: macroModel,
     tier_model: tierModel,
     curves,
     content_plan: contentPlan,
     economy_link: economyLink,  // NEW
     validation,
     summary,
     input_data: inputData,      // NEW
     stages_completed: stagesCompleted,
     latency_ms: latencyMs,
     models_used: ["deterministic-progression-v1", "tier-archetype-v1", "curve-builder-v1"],
     ai_insights: null,          // will be set by enrichProgression
   };
   ```

3. **В GET route** — вернуть тот же shape + metadata:
   ```ts
   // /progression/[projectId]/route.ts
   const p = project.progression;
   const fullProfile = safeJsonParse(p.fullProfile || "{}", {});

   return NextResponse.json({
     id: p.id,
     project_id: p.projectId,
     // Restore from fullProfile (which is the unified response)
     ...fullProfile,
     // Override with direct DB columns for freshness:
     macro_model: safeJsonParse(p.macroModel || "{}", {}),
     tier_model: safeJsonParse(p.tierModel || "{}", {}),
     curves: safeJsonParse(p.curves || "{}", {}),
     content_plan: safeJsonParse(p.contentPlan || "{}", {}),
     economy_link: safeJsonParse(p.economyLink || "{}", {}),
     validation: safeJsonParse(p.validation || "{}", {}),
     input_data: safeJsonParse(p.inputData || "{}", {}),
     // Metadata:
     created_at: p.createdAt.toISOString(),
     updated_at: p.updatedAt.toISOString(),
   });
   ```

4. **Обновить UI** `block 5/page.tsx` — при загрузке проекта вызвать GET и
   ожидать unified shape:
   ```ts
   // При монтировании:
   useEffect(() => {
     if (projectId) {
       apiFetch<ProgressionDesignResponse>(`/progression/${projectId}`)
         .then(setProgResult)
         .catch(() => {});
     }
   }, [projectId]);
   ```

**Тест-кейсы**:
- POST → response содержит `economy_link`, `input_data`, `project_id`,
  `ai_insights: null` (или строку если use_ai).
- POST → response НЕ содержит `created_at`, `updated_at`.
- GET → response содержит все поля POST + `created_at`, `updated_at`.
- После POST, GET возвращает те же `macro_model`, `tier_model`, `curves`,
  `content_plan`, `economy_link`, `validation`.
- TypeScript: `ProgressionDesignResponse` тип используется и для POST и для
  GET (с optional metadata).
- UI отображает `economy_link` (через новую вкладку EconomyLinkTab или в
  MacroParamsTab).

**Риски**:
- **Backward compat**: существующие клиенты могут ожидать старую schema GET.
  Митигация: `full_profile` поле в GET сохраняется как было (для fallback);
  новые поля добавляются aditively.
- **UI impact**: `EconomyLinkTab` нужно создать или расширить
  `MacroParamsTab`.

**Dependencies**: TASK-5a.4 (economy_link content), TASK-5a.6 (ai_insights
persistence)

---

### TASK-5a.12: Расширить enrichProgression prompt с actual state

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/lib/ai-service.ts` (строки 633-671)

**Описание проблемы**:

`enrichProgression` prompt (строки 644-656):
```ts
const prompt = `Ты — эксперт по прогрессии в играх. Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Уровней: ${ctx.totalLevels}
Целевая длительность: ${ctx.targetDurationHours || "—"} часов

Дай 3 совета (на русском):
1. Какая кривая прогрессии оптимальна (exp, polynomial, logarithmic)
2. Сколько тиров и как их распределить
3. Какие content gates рекомендуются

Ответ — обычный текст с нумерованными пунктами.`;
```

Проблемы:
- Не передаёт actual `macro_model`, `tier_model`, `curves`, `validation`.
- Спрашивает "какая кривая оптимальна" — но кривая уже выбрана и рассчитана.
- Спрашивает "сколько тиров" — но tier_model уже построен.
- AI даёт generic advice в вакууме. Подтверждено в `05_progression.json`:
  AI рекомендует "5 тиров по 10 уровней", но реализация создала 4 тира
  (13/13/13/11) — AI advice не actionnable.

**Решение**:

1. **Расширить `ProgressionAiInput`**:
   ```ts
   export interface ProgressionAiInput {
     projectName: string;
     genre: string;
     totalLevels: number;
     targetDurationHours?: number;
     // NEW: actual state for actionable advice
     macroModel?: Record<string, unknown>;
     tierModel?: Record<string, unknown>;
     curves?: Record<string, unknown>;
     validation?: Record<string, unknown>;
   }
   ```

2. **Переписать prompt**:
   ```ts
   export async function enrichProgression(ctx: ProgressionAiInput): Promise<string | null> {
     const zai = await getZai();
     if (!zai) return null;
     try {
       const tierSummary = ctx.tierModel
         ? JSON.stringify(
             (ctx.tierModel as any).tiers?.map((t: any) => ({
               tier: t.index,
               name: t.name,
               level_range: t.level_range,
               dominant_mechanic: t.dominant_mechanic,
               difficulty_curve: t.difficulty_curve,
             })) ?? []
           )
         : "—";

       const curveSummary = ctx.curves
         ? JSON.stringify(
             Object.fromEntries(
               Object.entries(ctx.curves).map(([k, v]: [string, any]) => [
                 k,
                 { type: v.type, formula: v.formula, sample: v.points?.slice(0, 3) },
               ])
             )
           )
         : "—";

       const validationSummary = ctx.validation
         ? JSON.stringify({
             issues: (ctx.validation as any).issues ?? [],
             overall_score: (ctx.validation as any).overall_score ?? 0,
             checks: (ctx.validation as any).checks ?? {},
           })
         : "—";

       const prompt = `Ты — эксперт по прогрессии в играх. Дай конкретные рекомендации на основе уже сгенерированной модели прогрессии.

   Проект: ${ctx.projectName}
   Жанр: ${ctx.genre}
   Уровней: ${ctx.totalLevels}
   Целевая длительность: ${ctx.targetDurationHours || "—"} часов

   Текущая модель:
   - Tier'ы: ${tierSummary}
   - Кривые: ${curveSummary}
   - Валидация: ${validationSummary}

   Дай 3 конкретных совета (на русском):
   1. Что нужно изменить в tier_model (конкретные tier'ы, их границы или доминантные механики) для этого жанра
   2. Какая кривая требует корректировки и почему (с ссылками на конкретные значения points)
   3. Конкретные content gates для устранения выявленных issues (если issues пусты — предложи превентивные меры)

   Ответ — обычный текст с нумерованными пунктами. Не более 500 слов.`;

       const response = await zai.chat.completions.create({
         messages: [
           { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по прогрессии. Отвечай конкретно, с ссылками на предоставленные данные." },
           { role: "user", content: prompt },
         ],
         stream: false,
         thinking: { type: "disabled" },
       });
       const text = response.choices?.[0]?.message?.content?.trim();
       return text && text.length > 30 ? text : null;
     } catch (e) {
       console.error("[ai-service] enrichProgression failed:", e instanceof Error ? e.message : e);
       return null;
     }
   }
   ```

3. **Обновить вызов в route** (см. TASK-5a.6):
   ```ts
   const aiInsights = await enrichProgression({
     projectName: proj.name || "Untitled",
     genre,
     totalLevels: targetLevels,
     targetDurationHours: targetDuration,
     macroModel,
     tierModel,
     curves,
     validation,
   });
   ```

**Тест-кейсы**:
- POST с `use_ai: true` → `ai_insights` содержит упоминание конкретных
  tier'ов (например "tier_2 Expansion") или кривых ("xp_to_level points[0]=100").
- POST с `use_ai: true, progression_type: "exponential"` → AI может
  рекомендовать "triangular" с обоснованием.
- Если validation содержит `issue: "XP scaling steep: ratio 942x"` → AI
  советует снизить growth_rate (упоминает 942x).
- AI ответ не более 500 слов.
- Если AI не вызывается (`use_ai: false`) — `ai_insights: null`.

**Риски**:
- **Token cost**: расширенный prompt увеличивает input tokens. Митигация:
  summary вместо full JSON (3 tier'а вместо всех полей).
- **Latency**: больше prompt = больше время ответа. Митигация: timeout 30s.

**Dependencies**: TASK-5a.6 (persist ai_insights)

---

### TASK-5a.13: Реально реализовать validation checks

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 419-526)

**Описание проблемы**:

6 checks (строки 422-429):
```ts
const checks: Record<string, boolean> = {
  no_grind: true,                  // проверяется (строки 453-461)
  no_walls: true,                  // НИКОГДА не проверяется
  no_empty_levels: true,           // НИКОГДА не проверяется
  no_runaway: true,                // проверяется (строки 432-450)
  no_build_gaps: true,             // проверяется (строки 479-495)
  aesthetic_alignment: true,       // проверяется (строки 498-505), но всегда false
};
```

- `no_walls` — всегда `true`, но Bible 6.10.4 (Runaway) и 6.10.6 (Stall)
  описывают "стены" как legitimate патологию. Для F2P soft_locks — стены
  by design, но должны быть "честными". Нет реальной проверки.
- `no_empty_levels` — всегда `true`, но `perceivedDifficultyTable` для
  `totalLevels=1` имеет `target_perceived_difficulty: 0.9` — это и есть
  empty level (нет контента, только финальный босс). Нет проверки что
  `tier_plans.enemies > 0` для каждого tier.
- `aesthetic_alignment` — всегда `false` (если concept.aestheticProfile
  отсутствует), всегда `true` если присутствует. Нет реальной проверки
  соответствия aesthetic и tier_model.

**Решение**:

1. **Реализовать `no_walls` check**:
   ```ts
   // no_walls: проверить, что нет "жёстких" стен для non-F2P monetization
   // Для F2P: стены OK, но должны быть "честными" (soft_locks)
   // Для B2P: стены не должны быть непреодолимыми
   const costCurveRatio = costCurve.points.length >= 2
     ? costCurve.points[costCurve.points.length - 1] / costCurve.points[0]
     : 1;
   if (monetizationModel !== "f2p" && monetizationModel !== "p2w" && costCurveRatio > 100) {
     issues.push({
       severity: "warning",
       description: `Возможная стена: cost scaling ${costCurveRatio.toFixed(0)}x — игрок может застрять без возможности grind`,
     });
     checks.no_walls = false;
     suggestions.push("Снизьте cost growth_rate или добавьте альтернативные источники ресурсов");
   }
   ```

2. **Реализовать `no_empty_levels` check**:
   ```ts
   // no_empty_levels: каждый tier должен иметь enemies > 0, abilities > 0
   const emptyTiers = tierPlans.filter(tp => tp.enemies === 0 || tp.abilities === 0);
   if (emptyTiers.length > 0) {
     issues.push({
       severity: "warning",
       description: `${emptyTiers.length} tier(s) без контента: ${emptyTiers.map(t => `tier_${t.tier_index}`).join(", ")}`,
     });
     checks.no_empty_levels = false;
   }

   // Также проверить unlock_tree на пустые промежутки
   if (unlockTree.length > 0) {
     const maxGap = Math.max(
       ...unlockTree.map((u, i) => u.level - (i === 0 ? 0 : unlockTree[i - 1].level))
     );
     // Already checked in no_build_gaps, but here check specifically for > 20 levels gap
     // (essentially empty levels)
     if (maxGap > 20) {
       issues.push({
         severity: "warning",
         description: `Пустые уровни: разрыв ${maxGap} между unlocks — уровни без нового контента`,
       });
       checks.no_empty_levels = false;
     }
   }
   ```

3. **Реализовать `aesthetic_alignment` check**:
   ```ts
   // aesthetic_alignment: проверить соответствие tier_model и concept aesthetic
   const aestheticProfile = proj.concept?.aestheticProfile;
   if (!aestheticProfile) {
     issues.push({
       severity: "info",
       description: "Эстетический профиль концепции не задан — выравнивание по умолчанию",
     });
     checks.aesthetic_alignment = false;
   } else {
     try {
       const aesthetic = JSON.parse(aestheticProfile);
       const primaryAesthetic = aesthetic.primary || aesthetic.primary_aesthetic;
       // Map aesthetic to expected tier progression
       const AESTHETIC_TIER_EXPECTATIONS: Record<string, string[]> = {
         challenge: ["tutorial", "core_loop", "ability_synergy", "mastery_combos", "meta_progression"],
         discovery: ["exploration", "area_unlock", "backtrack", "secret_find", "true_ending"],
         fantasy: ["role_intro", "class_unlock", "ability_synergy", "mastery_combos", "meta_progression"],
         sensation: ["mechanic_intro", "combo_intro", "timing_master", "flow_state", "perfect_run"],
         narrative: ["story_intro", "character_unlock", "plot_twist", "climax", "resolution"],
         fellowship: ["solo", "duo_unlock", "team_form", "synergy_master", "meta_coop"],
         submission: ["tutorial", "pattern_learn", "mastery", "flow", "perfection"],
         expression: ["basic_options", "customization_unlock", "style_unlock", "mastery_showcase", "meta_expression"],
       };
       const expectedDominants = AESTHETIC_TIER_EXPECTATIONS[primaryAesthetic] ?? [];
       const actualDominants = tiers.map(t => t.dominant_mechanic);
       const mismatch = expectedDominants.filter(d => !actualDominants.includes(d));
       if (mismatch.length > 0) {
         issues.push({
           severity: "info",
           description: `Aesthetic "${primaryAesthetic}" ожидает доминантные механики: ${mismatch.join(", ")}`,
         });
         checks.aesthetic_alignment = false;
         suggestions.push(`Рассмотрите добавление механик: ${mismatch.join(", ")}`);
       } else if (expectedDominants.length > 0) {
         checks.aesthetic_alignment = true;
       }
     } catch {
       issues.push({
         severity: "warning",
         description: "Не удалось распарсить aestheticProfile — проверьте формат",
       });
       checks.aesthetic_alignment = false;
     }
   }
   ```

4. **Добавить новые checks из Bible 6.13.4 (validation checklist)**:
   ```ts
   const checks: Record<string, boolean> = {
     no_grind: true,
     no_walls: true,
     no_empty_levels: true,
     no_runaway: true,
     no_build_gaps: true,
     aesthetic_alignment: true,
     // NEW (Bible 6.13.4):
     progression_defined: true,        // для каждого ядерного ресурса есть кривая
     economic_phases_defined: true,    // есть ли естественные фазы экономики
     no_deadlock: true,                // для каждого цикла есть стартовый ресурс
     no_stall: true,                   // для каждого убыточного цикла есть внешние источники
     inflation_controlled: true,       // есть ли стоки для каждой валюты
   };
   ```

5. **Пересчитать `overall_score`** с учётом новых checks:
   ```ts
   const failedChecks = Object.values(checks).filter(v => v === false).length;
   const totalChecks = Object.keys(checks).length;
   const checksScore = (totalChecks - failedChecks) / totalChecks;
   const issuesScore = Math.max(0, 1 - (criticalCount * 0.3 + warningCount * 0.1 + infoCount * 0.02));
   const overallScore = (checksScore * 0.5 + issuesScore * 0.5);
   ```

**Тест-кейсы**:
- POST с `monetization_model: "b2p", costCurveRatio > 100` → `no_walls: false`,
  issue "Возможная стена...".
- POST с `target_levels=20, numTiers=2, tierPlans=[{enemies: 30}, {enemies: 0}]`
  → `no_empty_levels: false` (если реализовать edge case с пустым tier).
- POST с `unlockEvery > 20` → `no_empty_levels: false`, warning "Пустые
  уровни".
- POST с `concept.aestheticProfile = '{"primary":"challenge"}'` и genre="rpg"
  → `aesthetic_alignment: true` (если tiers соответствуют).
- POST без `concept.aestheticProfile` → `aesthetic_alignment: false`, info
  issue.
- `progression_defined: true` всегда (4 кривые всегда генерируются).
- `economic_phases_defined: true` всегда (economyLink создаётся из tier_model).
- `overall_score` в диапазоне [0, 1].

**Риски**:
- **Aesthetic mapping subjectivity**: mapping aesthetic → tier expectations
  ad-hoc. Митигация: документировать как heuristic.
- **Performance**: дополнительные checks увеличивают latency. Митигация:
  O(n) checks, n = tiers.length, latency +1-2ms.

**Dependencies**: TASK-5a.4 (economyLink для checks), TASK-5a.8 (macro_model
поля для checks)

---

### TASK-5a.14: Input validation + edge cases

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строки 197-219)

**Описание проблемы**:

Текущая валидация (строки 197-219):
```ts
const projectId = body?.project_id?.toString().trim() || undefined;
const useAi = body?.use_ai === true || body?.use_ai === "true";  // не принимает "1" или 1
const genre = body?.genre?.toString().trim() || "rpg";            // любая строка
const targetDuration = Number(body?.target_duration) || 40;       // NaN → 40, нет range check
const targetLevels = Math.max(1, Math.min(500, Number(body?.target_levels) || 50));  // cap 500
const progressionType = body?.progression_type?.toString().trim() || "exponential";
const monetizationModel = body?.monetization_model?.toString().trim() || "b2p";
const pacing = body?.pacing?.toString().trim() || "balanced";
```

Edge cases:
- `targetLevels=0` → `0 || 50 = 50` (silent default).
- `targetLevels=-5` → `Math.max(1, Math.min(500, -5)) = 1`.
- `targetLevels=1000` → capped to 500 (silent). Bible 6.12.5 (MMO) и 6.12.6
  (F2P mobile) допускают 1000+ levels.
- `targetLevels=NaN` → `NaN || 50 = 50`.
- `targetDuration=-5` → `Number("-5") || 40 = -5` (negative duration!). Нет
  range check.
- `targetDuration=NaN` → `NaN || 40 = 40`.
- `genre=""` → `"" || "rpg" = "rpg"` (silent default).
- `genre="   "` → trim → `""` → `"rpg"`.
- `genre="ANY_STRING"` → accepted, no validation.
- `progressionType="unknown"` → VALIDATION_ERROR (good, but no helpful
  message).
- `use_ai=1` → `false` (should accept truthy integers).
- `use_ai="1"` → `false` (should accept truthy strings).

**Решение**:

1. **Строгая валидация входных параметров**:
   ```ts
   function parsePositiveInt(v: unknown, defaultVal: number, min: number, max: number): number {
     const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
     if (!Number.isFinite(n) || n < min || n > max) return defaultVal;
     return Math.floor(n);
   }

   function parsePositiveFloat(v: unknown, defaultVal: number, min: number, max: number): number {
     const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
     if (!Number.isFinite(n) || n < min || n > max) return defaultVal;
     return n;
   }

   function parseBoolean(v: unknown): boolean {
     if (typeof v === "boolean") return v;
     if (typeof v === "string") return v === "true" || v === "1";
     if (typeof v === "number") return v === 1;
     return false;
   }

   // В POST handler:
   const projectId = body?.project_id?.toString().trim() || undefined;
   const useAi = parseBoolean(body?.use_ai);
   const genre = body?.genre?.toString().trim().toLowerCase().replace(/[\s-]/g, "_") || "rpg";
   const targetDuration = parsePositiveFloat(body?.target_duration, 40, 1, 10000);  // 1h..10000h
   const targetLevels = parsePositiveInt(body?.target_levels, 50, 1, 1000);  // 1..1000 (was 500)
   const progressionType = body?.progression_type?.toString().trim().toLowerCase() || "exponential";
   const monetizationModel = body?.monetization_model?.toString().trim().toLowerCase() || "b2p";
   const pacing = body?.pacing?.toString().trim().toLowerCase() || "balanced";
   ```

2. **Расширить `VALID_PROGRESSION_TYPES`** (см. TASK-5a.1):
   ```ts
   if (!VALID_CURVE_TYPES.includes(progressionType)) {
     return VALIDATION_ERROR(
       `Неверный тип прогрессии: "${progressionType}". Допустимо: ${VALID_CURVE_TYPES.join(", ")}`
     );
   }
   ```

3. **Добавить валидацию genre** (опционально, soft warning для unknown):
   ```ts
   const VALID_GENRES = [
     "rpg", "roguelike", "deck_builder", "puzzle", "racing",
     "survival", "fps", "tower_defense", "metroidvania", "simulation",
     "strategy", "rhythm", "adventure", "horror", "platformer",
     "fighting", "sandbox", "mmorpg", "sports",
   ];
   if (!VALID_GENRES.includes(genre)) {
     // Don't reject — just add info to validation
     // (will be added to validation.issues in the validation section)
   }
   ```

4. **Cross-field validation**:
   ```ts
   // Если targetLevels=1 — warning (single-level progression is degenerate)
   if (targetLevels === 1) {
     // Will be added to validation.issues
   }

   // Если targetDuration/Levels ratio > 5 — высокий grind
   const hoursPerLevel = targetDuration / targetLevels;
   if (hoursPerLevel > 5) {
     // Will be added to validation.issues
   }

   // Если monetization_model="p2w" + pacing="relaxed" — конфликт
   if (monetizationModel === "p2w" && pacing === "relaxed") {
     return VALIDATION_ERROR(
       "P2W монетизация несовместима с relaxed pacing — используйте balanced или intense"
     );
   }
   ```

5. **Edge case handling**:
   - `targetLevels=1` → numTiers=1, single tier [1,1], no transitions,
     unlockTree=[] (или 1 unlock на level 1 — debated).
   - `targetLevels=1000` → numTiers=5 (max), tiersPerLevel=200, big
     perceivedDifficultyTable (1000 rows — performance? ~50KB JSON).
   - `targetLevels=0` → invalid, fallback to 50 with warning.
   - `targetDuration=0` → invalid, fallback to 40.
   - `progressionType=""` → fallback to "exponential".
   - `progressionType="DIMINISHING"` → normalize to "logarithmic" (migration
     from old `diminishing` to new `logarithmic`).

**Тест-кейсы**:
- POST с `target_levels=0` → fallback to 50, no error.
- POST с `target_levels=-5` → fallback to 50 (was 1, now stricter).
- POST с `target_levels=1000` → accepted (was capped to 500).
- POST с `target_levels=1001` → fallback to 50 (out of range).
- POST с `target_duration=-5` → fallback to 40 (was -5).
- POST with `target_duration=NaN` (string "abc") → fallback to 40.
- POST с `use_ai=1` → `useAi=true` (was false).
- POST с `use_ai="1"` → `useAi=true` (was false).
- POST с `progression_type="DIMINISHING"` → normalized to "logarithmic" (or
  VALIDATION_ERROR if not migrated).
- POST с `progression_type="unknown"` → 422 VALIDATION_ERROR.
- POST с `genre="Tower Defense"` → normalized to "tower_defense".
- POST с `monetization_model="p2w", pacing="relaxed"` → 422 VALIDATION_ERROR.
- POST с `target_levels=1` → numTiers=1, response has 1 tier with
  `level_range: [1,1]`, `transition_map: {"tier_1": "endgame_content"}`,
  `unlock_tree: []`.
- POST с `target_levels=1000` → response has 1000-row
  `perceived_difficulty_table` (~50KB), no performance issues.

**Риски**:
- **Backward compat**: clients sending `target_levels=1000` previously got
  500 (silent cap). Now they get 1000. Митигация: cap raised, not removed.
- **Performance**: 1000-row table = ~50KB JSON, +5ms latency. Acceptable.
- **Strict validation breaking existing test scripts**: `run_pipeline_test.sh`
  sends `target_levels:50` (OK), `use_ai:true` (OK). No breakage.

**Dependencies**: TASK-5a.1 (VALID_CURVE_TYPES)

---

### TASK-5a.15: Unify types + DB schema migration

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/types/progression.ts`, `prisma/schema.prisma`,
`src/app/api/v1/progression/design/route.ts`, `src/app/api/v1/progression/[projectId]/route.ts`,
`src/lib/pipeline-helpers.ts`

**Описание проблемы**:

Типы `ProgressionDesignResponse` (74 строки в `types/progression.ts`)
неполные:
- `[key: string]: unknown;` index signature в `macro_model` —
  скрывает реальные поля.
- `tier_model.tiers[].level_range: [number, number]` — tuple, но
  сериализуется как JSON array (работает в runtime, но TS strict mode может
  жаловаться).
- `curves.xp_to_level.points?: number[]` — optional, но route ВСЕГДА
  устанавливает `points` (должно быть required).
- `summary: Record<string, string>` — type-coerced через `String(numTiers)`,
  теряет type info.
- Нет типов для: `economy_link`, `ai_insights`, `models_used`, `input_data`,
  `created_at`, `updated_at`, `project_id`.

DB schema (`prisma/schema.prisma:229-251`):
- Comment врёт: `curveType String? // 7 типов кривых` (реально 5-6, после
  TASK-5a.1 будет 9).
- Нет полей: `aiInsights`, `modelsUsed`.
- `targetDurationHours Float?` — но route использует `Number(body?.target_duration)`
  который может быть int (работает, но inconsistent).

**Решение**:

1. **Полностью переписать `src/types/progression.ts`**:
   ```ts
   /**
    * Gidede — Progression Types (Block 5a)
    * Aligned with Bible 6.6-6.7 and Prisma schema.
    */

   export type CurveType =
     | "identity" | "linear" | "exponential" | "logarithmic"
     | "triangular" | "s_curve" | "intermittent" | "obfuscation" | "custom";

   export type MonetizationModel =
     | "f2p" | "b2p" | "subscription" | "p2w" | "cosmetic" | "hybrid";

   export type Pacing = "relaxed" | "balanced" | "intense";

   export type LockKeyModel =
     | "simple_key_lock" | "metroidvania" | "dynamic_locks"
     | "soft_locks" | "key_gates";

   export type BalanceType =
     | "transitive" | "situational" | "intransitive" | "mixed";

   export type ResourceState =
     | "scarce" | "stable" | "abundant" | "specialized" | "meta";

   export type TierScale = "micro" | "small" | "medium" | "large" | "macro";

   export interface CurveSpec {
     type: CurveType;
     formula: string;
     parameters: Record<string, number>;
     points: number[];  // required (was optional)
   }

   export interface Tier {
     index: number;
     name: string;
     level_range: [number, number];
     level_count: number;
     scale: TierScale;
     dominant_mechanic: string;
     balance_type: BalanceType;
     difficulty_curve: CurveType;
     resource_state: ResourceState;
     transition_trigger: string;
   }

   export interface TierTransition {
     from: string;
     to: string;
     trigger: string;
     is_terminal: boolean;
   }

   export interface MacroModel {
     total_levels: number;
     target_duration: number;
     progression_type: CurveType;
     transitions_count: number;
     transitions_per_hour: number;
     content_stages: number;
     enemy_configs_min: number;
     char_points_per_level: number;
     char_points_final: number;
     char_points_initial: number;
     content_requirements: {
       levels: number;
       duration_hours: number;
       pacing: Pacing;
       summary: string;
     };
     emergence_ratio: number;
     lock_key_model: LockKeyModel;
     monetization_model: MonetizationModel;
     pacing: Pacing;
     genre: string;
     notes: string;
   }

   export interface TierModel {
     tiers: Tier[];
     num_tiers: number;
     total_levels: number;
     transition_map: Record<string, string>;
     transitions: TierTransition[];
   }

   export interface ProgressionCurves {
     xp_to_level: CurveSpec;
     level_to_power: CurveSpec;
     level_to_cost: CurveSpec;
     difficulty: CurveSpec;
   }

   export interface TierPlan {
     tier_index: number;
     enemies: number;
     rewards: number;
     abilities: number;
     milestones: number;
     pacing: Pacing;
   }

   export interface UnlockEntry {
     level: number;
     unlock_name: string;
     unlock_type: "mechanic" | "ability" | "content" | "area";
     description: string;
   }

   export interface PerceivedDifficultyRow {
     level: number;
     challenge_virtual: number;
     challenge_strategic: number;
     player_virtual: number;
     player_skill: number;
     perceived_difficulty: number;
     target_perceived_difficulty: number;
     recommended_enemy_power: number;
     is_tier_boundary: boolean;
   }

   export interface ContentPlan {
     tier_plans: TierPlan[];
     unlock_tree: UnlockEntry[];
     perceived_difficulty_table: PerceivedDifficultyRow[];
   }

   export interface EconomyPhase {
     tier: string;
     primary_resources: string[];
     secondary_resources: string[];
     primary_activities: string[];
   }

   export interface EconomyLink {
     economic_phases: EconomyPhase[];
     conversion_chains: string[];
     genre_economy_class: "simple" | "complex";
   }

   export interface ValidationIssue {
     severity: "critical" | "warning" | "info";
     description: string;
   }

   export interface ProgressionValidation {
     issues: ValidationIssue[];
     suggestions: string[];
     critical_count: number;
     warning_count: number;
     info_count: number;
     overall_score: number;
     checks: Record<string, boolean>;
   }

   export interface ProgressionInput {
     genre: string;
     target_duration: number;
     target_levels: number;
     progression_type: CurveType;
     monetization_model: MonetizationModel;
     pacing: Pacing;
     use_ai: boolean;
   }

   export interface ProgressionDesignResponse {
     id: string;
     project_id?: string;
     macro_model: MacroModel;
     tier_model: TierModel;
     curves: ProgressionCurves;
     content_plan: ContentPlan;
     economy_link: EconomyLink;
     validation: ProgressionValidation;
     summary: Record<string, string>;
     input_data: ProgressionInput;
     stages_completed: number[];
     latency_ms: number;
     models_used: string[];
     ai_insights: string | null;
     // GET-only metadata:
     created_at?: string;
     updated_at?: string;
   }
   ```

2. **Обновить Prisma schema** — добавить поля + исправить comment:
   ```prisma
   model ProjectProgression {
     id                   String   @id @default(cuid())
     projectId            String   @unique
     totalLevels          Int?
     tierCount            Int?
     curveType            String?   // 9 типов кривых (Bible 6.7.3 + Sellers s_curve + intermittent)
     targetDurationHours  Float?
     inputData            String?   // JSON: ProgressionInput
     macroModel           String?   // JSON: MacroModel
     tierModel            String?   // JSON: TierModel
     curves               String?   // JSON: ProgressionCurves
     contentPlan          String?   // JSON: ContentPlan
     economyLink          String?   // JSON: EconomyLink
     validation           String?   // JSON: ProgressionValidation
     aiInsights           String?   // JSON: { text: string, generated_at: string } — NEW
     modelsUsed           String?   // JSON: string[] — NEW
     fullProfile          String?   // JSON: ProgressionDesignResponse
     createdAt            DateTime  @default(now())
     updatedAt            DateTime  @updatedAt

     project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

     @@index([curveType])
     @@map("project_progressions")
   }
   ```

3. **Создать Prisma migration**:
   ```bash
   bunx prisma migrate dev --name add_progression_ai_fields
   ```
   Migration SQL:
   ```sql
   -- AlterTable
   ALTER TABLE "project_progressions" ADD COLUMN "aiInsights" TEXT;
   ALTER TABLE "project_progressions" ADD COLUMN "modelsUsed" TEXT;
   ```

4. **Обновить route handlers** — использовать строгие типы:
   ```ts
   // progression/design/route.ts
   import type { ProgressionDesignResponse, ProgressionInput } from "@/types/progression";

   const inputData: ProgressionInput = {
     genre, target_duration: targetDuration, target_levels: targetLevels,
     progression_type: progressionType, monetization_model: monetizationModel,
     pacing, use_ai: useAi,
   };

   const result: ProgressionDesignResponse = {
     id: proj.id,
     project_id: proj.id,
     macro_model: macroModel,
     tier_model: tierModel,
     curves,
     content_plan: contentPlan,
     economy_link: economyLink,
     validation,
     summary,
     input_data: inputData,
     stages_completed: stagesCompleted,
     latency_ms: latencyMs,
     models_used: [...],
     ai_insights: null,
   };

   // After AI enrichment:
   if (aiInsights) {
     result.ai_insights = aiInsights;
   }

   // Persist:
   await db.projectProgression.upsert({
     where: { projectId: proj.id },
     create: {
       // ... existing fields
       aiInsights: aiInsights ? JSON.stringify({ text: aiInsights, generated_at: new Date().toISOString() }) : null,
       modelsUsed: JSON.stringify(result.models_used),
       fullProfile: JSON.stringify(result),
     },
     update: { /* same */ },
   });
   ```

5. **Обновить `pipeline-helpers.ts:371-380`** — использовать строгие типы при
   формировании upstream.progression.

**Тест-кейсы**:
- `tsc --noEmit` проходит без ошибок (после миграции всех вызовов).
- POST → response соответствует `ProgressionDesignResponse` типу.
- GET → response соответствует `ProgressionDesignResponse` типу + metadata.
- Prisma migration применяется без ошибок.
- После миграции, существующие записи в БД имеют `aiInsights=null`,
  `modelsUsed=null` (default).

**Риски**:
- **Migration risk**: Prisma migration на production БД. Митигация: backup
  перед миграцией, тестировать на dev БД.
- **Type strictness**: `[key: string]: unknown` index signature убрана — если
  кто-то использует unknown fields, упадёт. Митигация: review всех
  потребителей типа.

**Dependencies**: TASK-5a.6 (aiInsights field), TASK-5a.11 (unified shape),
TASK-5a.1 (CurveType enum)

---

### TASK-5a.16: Унифицировать stages_completed + убрать hardcoded `[1,2,3,4,5]`

**Сложность**: S
**Приоритет**: 🟢
**Файлы**: `src/app/api/v1/progression/design/route.ts` (строка 544),
`src/lib/pipeline-helpers.ts`

**Описание проблемы**:

`route.ts:544`:
```ts
const stagesCompleted = [1, 2, 3, 4, 5];
```

Всегда `[1, 2, 3, 4, 5]` — независимо от реального состояния upstream (concept,
core_loop, mda, balance). Это misleading: если Block 1 не сгенерирован,
`stages_completed` всё равно включает 1.

**Решение**:

1. **Вычислить `stagesCompleted` из upstream state**:
   ```ts
   // Получить snapshot проекта (можно через loadProjectPipelineSnapshot)
   const stagesCompleted: number[] = [];

   // Block 1: Concept
   if (proj.concept) stagesCompleted.push(1);

   // Block 2: Core Loop
   if (proj.coreLoop) stagesCompleted.push(2);

   // Block 3: MDA
   if (proj.mdaProfile) stagesCompleted.push(3);

   // Block 4: Balance
   if (proj.balanceResult) stagesCompleted.push(4);

   // Block 5: Progression (this block — always true after this route)
   stagesCompleted.push(5);

   // Block 5b: Economy (optional)
   if (proj.economy) stagesCompleted.push(5);  // or use a different stage number?

   // Block 6: GDD (optional)
   if (proj.gdd) stagesCompleted.push(6);
   ```

2. **Альтернатива: использовать `loadProjectPipelineSnapshot`**:
   ```ts
   import { loadProjectPipelineSnapshot } from "@/lib/pipeline-helpers";

   const snap = await loadProjectPipelineSnapshot(user.id, proj.id);
   const stagesCompleted: number[] = [];
   if (snap?.project?.concept) stagesCompleted.push(1);
   if (snap?.project?.coreLoop) stagesCompleted.push(2);
   if (snap?.project?.mdaProfile) stagesCompleted.push(3);
   if (snap?.project?.balanceResult) stagesCompleted.push(4);
   stagesCompleted.push(5);  // this block
   if (snap?.project?.economy) stagesCompleted.push(5);  // 5b
   if (snap?.project?.gdd) stagesCompleted.push(6);
   ```

3. **Или проще: использовать `getOwnedProject` с includes** (уже загружено):
   ```ts
   // proj уже загружен через getOwnedProject, нужно расширить includes:
   const owned = await getOwnedProject(user, projectId, {
     concept: true, coreLoop: true, mdaProfile: true,
     balanceResult: true, economy: true, gdd: true,
   });

   // Внутри POST:
   const stagesCompleted: number[] = [];
   if (proj.concept) stagesCompleted.push(1);
   if (proj.coreLoop) stagesCompleted.push(2);
   if (proj.mdaProfile) stagesCompleted.push(3);
   if (proj.balanceResult) stagesCompleted.push(4);
   stagesCompleted.push(5);
   if (proj.economy) stagesCompleted.push(6);  // economy is part of block 5, but separate stage
   ```

**Тест-кейсы**:
- POST для проекта без upstream → `stages_completed: [5]`.
- POST для проекта с concept + core_loop → `stages_completed: [1, 2, 5]`.
- POST для проекта со всеми upstream → `stages_completed: [1, 2, 3, 4, 5, 6]`.
- После POST, GET возвращает тот же `stages_completed`.

**Риски**:
- **Performance**: дополнительный query к БД (или расширение includes).
  Митигация: использовать уже загруженный `proj` (расширить includes в
  `getOwnedProject`).
- **`getOwnedProject` signature**: возможно требует расширения. Митигация:
  проверить текущий API.

**Dependencies**: нет

---

### TASK-5a.17: Unit + integration тесты

**Сложность**: L
**Приоритет**: 🟢
**Файлы**: `tests/block5a/progression-design.test.ts` (новый),
`tests/block5a/build-curve.test.ts` (новый),
`tests/block5a/perceived-difficulty.test.ts` (новый),
`tests/block5a/tier-archetypes.test.ts` (новый), `package.json` (vitest config)

**Описание проблемы**:

Покрытие тестами Блока 5a — 0%. Нет unit тестов для `buildCurve`,
`buildPerceivedDifficultyTable`, `getTierArchetypes`, `getGenreEconomyLink`,
`getUnlockPool`, `getLockKeyModel`. Нет integration тестов для POST/GET
endpoints.

**Решение**:

1. **Установить vitest** (если ещё не установлен):
   ```bash
   bun add -d vitest @vitest/coverage-v8
   ```

2. **Создать `tests/block5a/build-curve.test.ts`**:
   ```ts
   import { describe, it, expect } from "vitest";
   import { buildCurve } from "@/app/api/v1/progression/design/route";

   describe("buildCurve", () => {
     it("identity curve returns y=x", () => {
       const c = buildCurve("identity", 5, 1, 1);
       expect(c.points).toEqual([1, 2, 3, 4, 5]);
       expect(c.formula).toBe("y = x");
     });

     it("linear curve returns base * level", () => {
       const c = buildCurve("linear", 5, 100, 1);
       expect(c.points).toEqual([100, 200, 300, 400, 500]);
     });

     it("exponential curve returns base * growth_rate^(level-1)", () => {
       const c = buildCurve("exponential", 3, 100, 1.15);
       expect(c.points[0]).toBeCloseTo(100, 2);
       expect(c.points[1]).toBeCloseTo(115, 2);
       expect(c.points[2]).toBeCloseTo(132.25, 2);
     });

     it("logarithmic curve returns base * log_{gr}(level+1)", () => {
       const c = buildCurve("logarithmic", 5, 100, 2);
       // y = 100 * log_2(level + 1)
       expect(c.points[0]).toBeCloseTo(100, 1);  // log_2(2) = 1
       expect(c.points[1]).toBeCloseTo(158.5, 1);  // log_2(3) ≈ 1.585
     });

     it("triangular curve returns base * (level^2 - level) / 2", () => {
       const c = buildCurve("triangular", 5, 1, 1);
       expect(c.points).toEqual([0, 1, 3, 6, 10]);
     });

     it("s_curve returns logistic", () => {
       const c = buildCurve("s_curve", 5, 100, 0.5);
       // y = 100 / (1 + exp(-0.5 * (level - 2.5)))
       expect(c.points[0]).toBeLessThan(c.points[2]);
       expect(c.points[2]).toBeLessThan(c.points[4]);
       expect(c.points[4]).toBeLessThanOrEqual(100);
     });

     it("intermittent curve adds 20% jumps every 5 levels", () => {
       const c = buildCurve("intermittent", 10, 100, 1);
       expect(c.points[4]).toBeCloseTo(100 * 5 * 1.2, 2);  // lvl=5, jump
       expect(c.points[9]).toBeCloseTo(100 * 10 * 1.2, 2);  // lvl=10, jump
       expect(c.points[3]).toBeCloseTo(100 * 4, 2);  // lvl=4, no jump
     });

     it("obfuscation curve adds 50% bumps every 7 levels", () => {
       const c = buildCurve("obfuscation", 14, 50, 1);
       expect(c.points[6]).toBeCloseTo(50 * 7 * 1.5, 2);  // lvl=7, bump
       expect(c.points[13]).toBeCloseTo(50 * 14 * 1.5, 2);  // lvl=14, bump
       expect(c.points[5]).toBeCloseTo(50 * 6, 2);  // lvl=6, no bump
     });

     it("custom curve uses default exponent 1.5", () => {
       const c = buildCurve("custom", 3, 100, 1);
       expect(c.points[0]).toBeCloseTo(100, 2);  // 100 * 1^1.5
       expect(c.points[1]).toBeCloseTo(282.84, 1);  // 100 * 2^1.5
       expect(c.points[2]).toBeCloseTo(519.62, 1);  // 100 * 3^1.5
     });

     it("custom curve with customExponent=2", () => {
       const c = buildCurve("custom", 3, 100, 1, { customExponent: 2 });
       expect(c.points).toEqual([100, 400, 900]);
     });

     it("unknown curveType falls back to custom", () => {
       const c = buildCurve("unknown_type", 3, 100, 1);
       expect(c.type).toBe("custom");
     });

     it("empty levels returns empty points", () => {
       const c = buildCurve("linear", 0, 100, 1);
       expect(c.points).toEqual([]);
     });

     it("all curves have formula string", () => {
       const types = ["identity", "linear", "exponential", "logarithmic",
         "triangular", "s_curve", "intermittent", "obfuscation", "custom"];
       for (const t of types) {
         const c = buildCurve(t, 5, 100, 1.5);
         expect(c.formula).toBeTruthy();
         expect(typeof c.formula).toBe("string");
       }
     });
   });
   ```

3. **Создать `tests/block5a/perceived-difficulty.test.ts`**:
   ```ts
   import { describe, it, expect } from "vitest";
   import { buildPerceivedDifficultyTable } from "@/app/api/v1/progression/design/route";

   describe("buildPerceivedDifficultyTable", () => {
     const mockPowerCurve = {
       type: "exponential", formula: "y = 10 * 1.08^(level-1)",
       parameters: { base: 10, growth_rate: 1.08, levels: 10 },
       points: [10, 10.8, 11.66, 12.6, 13.6, 14.69, 15.87, 17.14, 18.51, 19.99],
     };
     const mockTiers = [
       { index: 1, name: "T1", level_range: [1, 5] as [number, number], level_count: 5,
         scale: "micro" as const, dominant_mechanic: "tutorial",
         balance_type: "transitive" as const, difficulty_curve: "linear" as const,
         resource_state: "scarce" as const, transition_trigger: "first_ability" },
       { index: 2, name: "T2", level_range: [6, 10] as [number, number], level_count: 5,
         scale: "small" as const, dominant_mechanic: "core_loop",
         balance_type: "transitive" as const, difficulty_curve: "linear" as const,
         resource_state: "stable" as const, transition_trigger: "tier_unlock" },
     ];

     it("returns 10 rows for 10 levels", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       expect(rows).toHaveLength(10);
     });

     it("Cv (challenge_virtual) is normalized 0..1", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       for (const r of rows) {
         expect(r.challenge_virtual).toBeGreaterThanOrEqual(0);
         expect(r.challenge_virtual).toBeLessThanOrEqual(1);
       }
     });

     it("Cs (strategic) spikes at tier boundaries", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       // Level 5 is tier_1 boundary, level 10 is tier_2 boundary
       expect(rows[4].challenge_strategic).toBeGreaterThan(0.5);
       expect(rows[9].challenge_strategic).toBeGreaterThan(0.5);
       expect(rows[2].challenge_strategic).toBeLessThan(0.3);  // mid-tier
     });

     it("Pv (player virtual) grows monotonically", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       for (let i = 1; i < rows.length; i++) {
         expect(rows[i].player_virtual).toBeGreaterThanOrEqual(rows[i-1].player_virtual);
       }
     });

     it("Ps (player skill) grows as log", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       // log(2)/log(11) ≈ 0.29, log(11)/log(11) = 1
       expect(rows[0].player_skill).toBeCloseTo(Math.log(2) / Math.log(11), 2);
       expect(rows[9].player_skill).toBeCloseTo(1, 2);
     });

     it("perceived_difficulty = (Cv + Cs) - (Pv + Ps)", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       for (const r of rows) {
         expect(r.perceived_difficulty).toBeCloseTo(
           (r.challenge_virtual + r.challenge_strategic) - (r.player_virtual + r.player_skill),
           2
         );
       }
     });

     it("target_perceived_difficulty is in [0, 1]", () => {
       const rows = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.0);
       for (const r of rows) {
         expect(r.target_perceived_difficulty).toBeGreaterThanOrEqual(0);
         expect(r.target_perceived_difficulty).toBeLessThanOrEqual(1);
       }
     });

     it("intense pacing increases target_perceived_difficulty", () => {
       const relaxed = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 0.8);
       const intense = buildPerceivedDifficultyTable(10, mockPowerCurve, mockTiers, 1.25);
       expect(intense[5].target_perceived_difficulty).toBeGreaterThan(
         relaxed[5].target_perceived_difficulty
       );
     });

     it("single level (targetLevels=1) — degenerate case", () => {
       const singleTier = [{ ...mockTiers[0], level_range: [1, 1] as [number, number],
         level_count: 1 }];
       const rows = buildPerceivedDifficultyTable(1, mockPowerCurve, singleTier, 1.0);
       expect(rows).toHaveLength(1);
       expect(rows[0].level).toBe(1);
       expect(rows[0].is_tier_boundary).toBe(true);
     });
   });
   ```

4. **Создать `tests/block5a/tier-archetypes.test.ts`**:
   ```ts
   import { describe, it, expect } from "vitest";
   import { getTierArchetypes, DEFAULT_TIER_ARCHETYPES } from "@/constants/progression";

   describe("getTierArchetypes", () => {
     it("returns DEFAULT_TIER_ARCHETYPES for 'rpg'", () => {
       const arch = getTierArchetypes("rpg");
       expect(arch).toBe(DEFAULT_TIER_ARCHETYPES);
       expect(arch.length).toBe(5);
     });

     it("returns puzzle-specific archetypes for 'puzzle'", () => {
       const arch = getTierArchetypes("puzzle");
       expect(arch[0].name).toBe("Tutorial_Mechanics");
       expect(arch[arch.length - 1].name).toBe("Master_Puzzles");
       expect(arch.length).toBeLessThanOrEqual(4);  // puzzle has max 4 tiers
     });

     it("normalizes genre (spaces, dashes, case)", () => {
       expect(getTierArchetypes("Tower Defense")).toEqual(getTierArchetypes("tower_defense"));
       expect(getTierArchetypes("DECK-BUILDER")).toEqual(getTierArchetypes("deck_builder"));
       expect(getTierArchetypes("RPG")).toEqual(getTierArchetypes("rpg"));
     });

     it("falls back to DEFAULT for unknown genre", () => {
       expect(getTierArchetypes("unknown_genre")).toBe(DEFAULT_TIER_ARCHETYPES);
     });
   });
   ```

5. **Создать `tests/block5a/progression-design.test.ts`** (integration):
   ```ts
   import { describe, it, expect, beforeEach, vi } from "vitest";
   // ... mocks for db, auth, ai-service
   import { POST } from "@/app/api/v1/progression/design/route";

   describe("POST /api/v1/progression/design", () => {
     beforeEach(() => {
       vi.clearAllMocks();
     });

     it("returns 422 for invalid progression_type", async () => {
       const req = new Request("http://localhost/api/v1/progression/design", {
         method: "POST",
         body: JSON.stringify({ progression_type: "invalid_type" }),
       });
       const res = await POST(req as any);
       expect(res.status).toBe(422);
     });

     it("returns 422 for p2w + relaxed pacing conflict", async () => {
       const req = new Request("http://localhost/api/v1/progression/design", {
         method: "POST",
         body: JSON.stringify({
           monetization_model: "p2w", pacing: "relaxed",
           project_id: "test-project-id",
         }),
       });
       const res = await POST(req as any);
       expect(res.status).toBe(422);
     });

     it("returns 200 with full response for valid input", async () => {
       // mock auth, db.project.findFirst, db.projectProgression.upsert
       const req = new Request("http://localhost/api/v1/progression/design", {
         method: "POST",
         body: JSON.stringify({
           genre: "rpg", target_levels: 50, target_duration: 40,
           progression_type: "exponential", monetization_model: "b2p",
           pacing: "balanced", project_id: "test-project-id",
         }),
       });
       const res = await POST(req as any);
       expect(res.status).toBe(200);
       const data = await res.json();
       expect(data.macro_model.total_levels).toBe(50);
       expect(data.tier_model.num_tiers).toBe(4);
       expect(data.curves.xp_to_level.type).toBe("exponential");
       expect(data.economy_link.primary_resources).toEqual(["xp", "gold"]);
       expect(data.ai_insights).toBeNull();
     });

     it("persists ai_insights when use_ai=true", async () => {
       vi.mock("@/lib/ai-service", () => ({
         enrichProgression: vi.fn().mockResolvedValue("Test AI insights"),
       }));
       const req = new Request("http://localhost/api/v1/progression/design", {
         method: "POST",
         body: JSON.stringify({
           genre: "rpg", project_id: "test-project-id", use_ai: true,
         }),
       });
       const res = await POST(req as any);
       const data = await res.json();
       expect(data.ai_insights).toBe("Test AI insights");
       expect(data.models_used).toContain("glm-4.6 (ai-enrichment)");
       // Verify DB was called with aiInsights
       expect(db.projectProgression.upsert).toHaveBeenCalledWith(
         expect.objectContaining({
           create: expect.objectContaining({
             aiInsights: expect.stringContaining("Test AI insights"),
           }),
         })
       );
     });

     it("genre='metroidvania' produces metroidvania lock_key_model", async () => {
       const req = new Request("http://localhost/api/v1/progression/design", {
         method: "POST",
         body: JSON.stringify({
           genre: "metroidvania", project_id: "test-project-id",
         }),
       });
       const res = await POST(req as any);
       const data = await res.json();
       expect(data.macro_model.lock_key_model).toBe("metroidvania");
     });

     it("target_levels=1 produces single tier with endgame_content transition", async () => {
       const req = new Request("http://localhost/api/v1/progression/design", {
         method: "POST",
         body: JSON.stringify({
           target_levels: 1, project_id: "test-project-id",
         }),
       });
       const res = await POST(req as any);
       const data = await res.json();
       expect(data.tier_model.num_tiers).toBe(1);
       expect(data.tier_model.tiers[0].level_range).toEqual([1, 1]);
       expect(data.tier_model.transition_map.tier_1).toBe("endgame_content");
     });
   });
   ```

6. **Добавить npm scripts** в `package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage",
     "test:block5a": "vitest run tests/block5a/"
   }
   ```

**Тест-кейсы** (мета-уровень):
- `bun run test:block5a` проходит без ошибок.
- Coverage ≥ 70% для `src/app/api/v1/progression/design/route.ts` и
  `src/constants/progression.ts`.

**Риски**:
- **Mocking complexity**: auth + db + ai-service. Митигация: использовать
  `vitest-mock-extended` или ручные mock'и.
- **Test data setup**: нужно создать test project в БД. Митигация:
  in-memory SQLite для тестов.

**Dependencies**: TASK-5a.1 - TASK-5a.15 (тесты проверяют исправленное
поведение)

---

## Сводная таблица задач

| ID | Название | Сложность | Приоритет | Dependencies |
|----|----------|-----------|-----------|--------------|
| TASK-5a.1 | Реализовать 7 кривых Шрайбера (Bible 6.7.3) | XL | 🔴 | — |
| TASK-5a.2 | Реализовать формулу perceived difficulty `(Cv+Cs)−(Pv+Ps)` | L | 🔴 | 5a.1 |
| TASK-5a.3 | Параметризовать TIER_ARCHETYPES по genre | L | 🔴 | 5a.1 |
| TASK-5a.4 | Динамический economyLink (genre-aware) | M | 🟡 | 5a.3, 5a.11 |
| TASK-5a.5 | Починить unlock tree (leading space + cap + names) | S | 🔴 | — |
| TASK-5a.6 | Перенести AI enrichment ДО persist | S | 🔴 | 5a.12 |
| TASK-5a.7 | run-full-pipeline: derive progression params from upstream | M | 🔴 | 5a.3, 5a.4, 5a.5 |
| TASK-5a.8 | Дополнить macro_model RPG-формулой (Bible 6.7.4) | M | 🟡 | 5a.1 |
| TASK-5a.9 | Починить transition_map (dangling last-tier trigger) | S | 🟡 | 5a.3 |
| TASK-5a.10 | Параметризовать lock_key_model по genre (metroidvania) | S | 🟡 | — |
| TASK-5a.11 | Унифицировать GET/POST shape + economy_link в response | M | 🟡 | 5a.4, 5a.6 |
| TASK-5a.12 | Расширить enrichProgression prompt с actual state | S | 🟡 | 5a.6 |
| TASK-5a.13 | Реально реализовать validation checks (no_walls, no_empty_levels, aesthetic_alignment) | M | 🟡 | 5a.4, 5a.8 |
| TASK-5a.14 | Input validation + edge cases (totalLevels=1, 1000, unknown curve) | S | 🟡 | 5a.1 |
| TASK-5a.15 | Unify types (ProgressionDesignResponse) + DB schema migration | M | 🟡 | 5a.6, 5a.11, 5a.1 |
| TASK-5a.16 | Унифицировать stages_completed (reflect upstream state) | S | 🟢 | — |
| TASK-5a.17 | Unit + integration тесты | L | 🟢 | 5a.1-5a.15 |

**Итого**: 17 задач (6 🔴 критичных, 9 🟡 средних, 2 🟢 низких; 7 S, 6 M, 3 L,
1 XL).

---

## Рекомендуемый порядок выполнения

### Sprint 1 (критичные баги — "починить детерминированный пайплайн")
1. **TASK-5a.5** (unlock tree leading space + cap) — S, 30 минут, быстрая
   победа, фикс виден в test_projects.
2. **TASK-5a.6** (AI enrichment persist order) — S, 1 час, фиксит потерю
   `ai_insights` при перезагрузке.
3. **TASK-5a.1** (7 кривых Шрайбера) — XL, 6-10 часов, **главный блокер** для
   TASK-5a.2, TASK-5a.8, TASK-5a.13, TASK-5a.14, TASK-5a.15.
4. **TASK-5a.7** (run-full-pipeline derives params) — M, 3-4 часа,
   использует TASK-5a.3/5a.4/5a.5 outputs.
5. **TASK-5a.3** (genre-aware TIER_ARCHETYPES) — L, 4-6 часов, разделяет
   test_projects по жанрам.

### Sprint 2 (формула perceived difficulty + macro model)
6. **TASK-5a.2** (формула `(Cv+Cs)−(Pv+Ps)`) — L, 3-4 часа, после TASK-5a.1.
7. **TASK-5a.8** (macro_model RPG-формула) — M, 2-3 часа, после TASK-5a.1.
8. **TASK-5a.10** (lock_key_model genre-aware) — S, 1 час, независимо.
9. **TASK-5a.9** (transition_map terminal) — S, 30 минут, после TASK-5a.3.

### Sprint 3 (validation + persistence + unification)
10. **TASK-5a.4** (genre-aware economyLink) — M, 2-3 часа, после TASK-5a.3.
11. **TASK-5a.13** (validation checks real implementation) — M, 3-4 часа,
    после TASK-5a.4, TASK-5a.8.
12. **TASK-5a.11** (unify GET/POST shape) — M, 2-3 часа, после TASK-5a.4,
    TASK-5a.6.
13. **TASK-5a.12** (enrichProgression prompt) — S, 1-2 часа, после TASK-5a.6.
14. **TASK-5a.14** (input validation + edge cases) — S, 1-2 часа, после
    TASK-5a.1.

### Sprint 4 (типы + metadata + тесты)
15. **TASK-5a.15** (unify types + DB migration) — M, 3-4 часа, после
    TASK-5a.6, TASK-5a.11, TASK-5a.1.
16. **TASK-5a.16** (stages_completed real) — S, 1 час, независимо.
17. **TASK-5a.17** (unit + integration тесты) — L, 6-8 часов, после всех
    задач.

**Общая оценка**: 35-55 часов работы (без TASK-5a.17 тестов),
45-65 часов (с тестами).

---

## Ожидаемый результат после рефакторинга

1. **9 кривых прогрессии** (вместо 5): `identity`, `linear`, `exponential`,
   `logarithmic`, `triangular`, `s_curve`, `intermittent`, `obfuscation`,
   `custom`. Все соответствуют Bible 6.7.3 + Sellers.
2. **`perceived_difficulty_table`** содержит 4 компоненты (Cv, Cs, Pv, Ps) +
   `perceived_difficulty = (Cv + Cs) − (Pv + Ps)` + `target_perceived_difficulty`.
3. **`tier_model.tiers`** — genre-aware: RPG → 5 D&D tiers, Puzzle → 4
   puzzle-specific, Racing → 5 racing tiers, и т.д.
4. **`economy_link`** — genre-aware: RPG → `["xp", "gold"]`, Card_Lords →
   `["cards", "deck_slots"]`, Frostbite → `["health", "hunger", "materials"]`.
5. **`unlock_tree`** — без leading space, без cap на 10 имён, имена из
   genre-specific пула.
6. **`ai_insights`** персистится в БД, переживает перезагрузку.
7. **`macro_model`** содержит все поля Bible 6.7.4: `transitions_count`,
   `transitions_per_hour`, `content_stages`, `enemy_configs_min`,
   `char_points_per_level`.
8. **`transition_map`** имеет terminal key для последнего tier.
9. **`lock_key_model`** — 5 типов: `simple_key_lock`, `metroidvania`,
   `dynamic_locks`, `soft_locks`, `key_gates`.
10. **GET/POST** возвращают unified shape (одинаковые поля + metadata в GET).
11. **`validation.checks`** — реальные проверки (не всегда `true`):
    `no_walls`, `no_empty_levels`, `aesthetic_alignment` отражают actual
    state.
12. **10 test_projects** производят **РАЗНЫЕ** progression outputs
    (отличаются genre, tier_model, economy_link, unlock_tree).
13. **TypeScript** компилируется без `as unknown as` cast для progression
    types.
14. **Tests** покрывают ≥ 70% кода Блока 5a.
15. **Input validation**: edge cases (totalLevels=1, 1000, unknown curveType)
    обрабатываются корректно.
16. **`stages_completed`** отражает реальный upstream state, а не hardcoded
    `[1,2,3,4,5]`.
17. **`enrichProgression`** prompt передаёт actual state → AI даёт
    actionable advice.

---

## Open questions (для обсуждения с командой)

1. **Сколько жанров покрывать в `GENRE_TIER_ARCHETYPES`?** Минимум 12
   (основные) или все 19 из `GENRES` config? Больше жанров → больше работы,
   но точнее archetypes.
2. **Обфускация стоимости (obfuscation curve)** — насколько детальной должна
   быть? Bible описывает "нелинейную с разрывами", но не даёт точной формулы.
   Реализация с периодическими bumps каждые 7 уровней — heuristic.
3. **Ps (player skill) model** — `log(lvl+1)/log(levels+1)` адекватна? Или
   нужно использовать более сложную модель (например, cubic spline с
  现实中 данными из playtests)?
4. **AI enrichment latency** — перенос AI вызова ДО persist увеличивает
   время ответа на 1-5 секунд. Приемлемо ли это? Или нужно вернуть ответ
   сразу, а AI делать в background (требует отдельной архитектуры)?
5. **DB migration risk** — добавление полей `aiInsights`, `modelsUsed` в
   `ProjectProgression`. Нужно ли мигрировать существующие записи (заполнить
   `null`) или оставить как есть (Prisma default)?
6. **UI updates** — `MacroParamsTab`, `CurvesTab`, `ContentPlanTab`,
   `TiersTab`, `ValidationTab` — нужно ли обновлять все? Или создать новый
   `EconomyLinkTab` для отображения economy_link?
7. **Cross-block consistency** — `economyLink` в Block 5a должен
   соответствовать `resource_model` в Block 5b. Нужен ли cross-validation
   при генерации Block 5b?
8. **`stages_completed`** — Block 5 включает и 5a (progression) и 5b
   (economy). Нужно ли разделять на `[5, 5b]` или оставить `[5]`?

---

## Связанные задачи из других блоков

- **TASK-4.10** (Block 4) — persist ai_insights. Аналогичный паттерн для
  Block 5a: TASK-5a.6.
- **TASK-1.11** (Block 1) — persist ai_insights + generation_metadata. Тот
  же баг во всех блоках (S1 в AUDIT_REPORT).
- **TASK-3.6** (Block 3) — load concept.aestheticProfile. TASK-5a.13
  использует `proj.concept?.aestheticProfile` для `aesthetic_alignment`
  check.
- **TASK-5b.1** (Block 5b) — `enrichEconomy` function. Block 5a использует
  `enrichProgression` — нужно создать `enrichEconomy` отдельно для Block 5b.

---

## Сводка root causes (RC-1 … RC-20)

| RC | Severity | Локация | Описание |
|----|----------|---------|----------|
| RC-1 | 🔴 | `route.ts:122-187` | Только 5 кривых вместо 7 (нет identity, logarithmic, triangular, obfuscation). |
| RC-2 | 🔴 | `route.ts:393-411` | Формула perceived difficulty `(Cv+Cs)−(Pv+Ps)` не реализована — только линейная `0.2 + (lvl/total)*0.7`. |
| RC-3 | 🔴 | `route.ts:52-98, 287` | TIER_ARCHETYPES не зависят от genre — 5 фиксированных архетипов для всех. |
| RC-4 | 🟡 | `route.ts:581-588, 609-616` | `economyLink.primary_resources: ["xp", "gold"]` hardcoded для всех жанров. |
| RC-5 | 🔴 | `route.ts:366, 383` | Leading space `" elemental_attack"` + cap на 10 имён → "prestige_reset" для всех unlocks > 10. |
| RC-6 | 🔴 | `route.ts:561-636` | AI enrichment вызывается ПОСЛЕ persist → `ai_insights` не сохраняется в БД. |
| RC-7 | 🔴 | `run-full-pipeline:141-145`, `run_pipeline_test.sh:122` | Pipeline не передаёт genre/progression_type/monetization/pacing → все 10 test_projects идентичны. |
| RC-8 | 🟡 | `route.ts:302-305` | `transition_map` без terminal key для последнего tier — `transition_trigger: "endgame_unlock"` dangling. |
| RC-9 | 🟡 | `route.ts:237-239` | `emergence_ratio = 0.3 + 0.1*(L/50) + 0.05*pacingFactor` — intense pacing увеличивает emergence (wrong sign). |
| RC-10 | 🟡 | `route.ts:240-243` | `lock_key_model` binary (soft_locks/key_gates) — нет metroidvania, dynamic_locks. |
| RC-11 | 🟡 | `route.ts:245-256` | macro_model lacks Bible 6.7.4 fields (transitions_count, transitions_per_hour, content_stages, enemy_configs_min, char_points_per_level). `content_requirements` — string, не object. |
| RC-12 | 🟡 | `route.ts:350-360` | `tier_plans` formula ad-hoc, не соответствует Bible 6.7.4 `3×(L/2)`. |
| RC-13 | 🟡 | `route.ts:197-219` | Input validation gaps: `target_duration` без range check, `targetLevels` capped at 500 (Bible допускает 1000+ для MMO/F2P), `use_ai` не принимает `1`/`"1"`. |
| RC-14 | 🟡 | `ai-service.ts:644-656` | `enrichProgression` prompt generic — не передаёт actual `macro_model`, `tier_model`, `curves`, `validation`. AI advice не actionnable. |
| RC-15 | 🟡 | `route.ts:544` | `stages_completed` hardcoded `[1,2,3,4,5]` — не отражает upstream state. |
| RC-16 | 🟡 | `types/progression.ts`, `[projectId]/route.ts` | GET/POST shape mismatch — разные поля, разные типы. `economy_link` только в GET. |
| RC-17 | 🔴 | `route.ts:547-558` | `economy_link` сохраняется в БД, но НЕ возвращается в POST response. |
| RC-18 | 🟡 | `route.ts:422-429` | `validation.checks.no_walls`, `no_empty_levels` всегда `true` — нет реальной логики. `aesthetic_alignment` всегда `false` если нет aestheticProfile. |
| RC-19 | 🟡 | `prisma/schema.prisma:229-251` | DB schema missing fields: `aiInsights`, `modelsUsed`. `curveType` comment врёт ("7 типов" — реально 5-6). |
| RC-20 | 🟡 | `pipeline-helpers.ts:415-422` | `suggested` defaults hardcoded для всех проектов — не использует actual genre для derivation. |

---

**Конец плана**.
