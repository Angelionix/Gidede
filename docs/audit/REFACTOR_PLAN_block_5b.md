# Рефакторинг Блока 5b — Экономика (алгоритм 3.6)

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-5b (sub-agent)
**Связанные документы**: `docs/audit/AUDIT_REPORT.md` (раздел 5b), `docs/bible/bible_2_6_economy_progression.md` (разделы 6.4-6.13), `docs/audit/REFACTOR_PLAN_block_1.md`, `docs/audit/REFACTOR_PLAN_block_4.md`, `docs/audit/REFACTOR_PLAN_block_5a.md`
**Объект рефакторинга**:
- `src/app/api/v1/economy/design/route.ts` (821 строка)
- `src/app/api/v1/economy/[projectId]/route.ts` (44 строки)
- `src/lib/ai-service.ts` (функции `enrichMda`, `enrichBalance`, `enrichProgression` — НЕТ `enrichEconomy`)
- `src/lib/pipeline-helpers.ts` (функция `buildPreparedInput`, строки 296-425)
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (StageDef для economy, строки 146-153)
- `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts` (StageDef для economy, строки 78-83)
- `scripts/run_pipeline_test.sh` (строки 126-132)
- `src/types/economy.ts` (82 строки)
- `src/constants/economy.ts` (19 строк)
- `prisma/schema.prisma` (модель `ProjectEconomy`, строки 257-279)
- `src/app/blocks/5/page.tsx` (UI consumer)
- `src/components/gidede/economy/*` (UI компоненты)

---

## Контекст

Блок 5b (Economy Designer) — шестая стадия пайплайна Gidede. Принимает
`{ genre, monetization_type, openness, project_id?, use_ai? }` и выполняет 7 стадий:

1. **Resource inventory**: `GENRE_RESOURCE_PRESETS` (5 жанров + default) → 3-4 core + 3 subsidiary.
   Subsidiary классы назначаются modulo: `is_catalytic = i % 2 === 0`,
   `is_consumable = i % 3 === 1`. Для F2P/Hybrid добавляется `gems` (currency).
2. **Classification**: Engine/Economy/Ecology по `hasConverter/hasConsumable/hasMeta`
   (Sellers Bible 6.3.2); sub_type по openness; pricing_type по monetization.
3. **Machinations graph**: nodes (pool/source/drain/converter) + flows + state_connections + feedback_loops.
   `feedback_loops` **hardcoded**: 2 записи с фиктивными node IDs `"converter"` и `"consumable"`.
4. **Conversion chains**: для каждого catalytic ресурса → chain с `profitability = 0.8 + Math.random() * 0.4`.
5. **Faucet/drain derivation**: `faucet = is_catalytic ? 1.0 : class==="currency" ? 0.8 : 0.4`;
   `drain = is_consumable ? 0.6 : class==="currency" ? 0.7 : 0.3`. → ratio вычисляется, не выводится из графа.
6. **Pathology detection**: 4 патологии (`Инфляция`, `Дефляция/Drain`, `Стагнация`, `Убегание`).
   Bible 6.10 требует 6 (нет `Арбитраж`, нет `Deadlock`).
7. **Simulation**: 1 loop per resource, 50 ticks, `value += faucet - drain + (Math.random()-0.5)*0.2`,
   capped to `bounds`. `config.num_runs: 10` — FAKE (реально 1 run).
8. **Persist + AI enrichment**: db.projectEconomy.upsert → POST response → optional `enrichProgression()` (НЕ `enrichEconomy`!) вызывается ПОСЛЕ persist.

**Подтверждённые дефекты** (проверены на всех 10 test_projects):

- **Все 10 test_projects производят ИДЕНТИЧНЫЙ economy output** (отличаются
  только `id`, `profitability` в conversion chains (Math.random!), и
  `ai_insights` (LLM variation)). Подтверждено:
  - Все 10 имеют `genre: "rpg"`, `monetization_type: "b2p"`, `openness: "mixed"`,
    `type: "Economy"`, `sub_type: "hybrid_economy"`, `anchor: "xp"`,
    6 ресурсов (xp, gold, hp, mana, stamina, materials), 3 structural_patterns
    (`source_pool_drain`, `converter_chain`, `consumable_burn`), 2 critical
    `Инфляция` pathologies (mana ratio=3.33, materials ratio=3.33),
    `stability_index: 0.75`, `stall_frequency: 0.5`, `runaway_frequency: 0`,
    `build_gap: 0.25`.
  - `scripts/run_pipeline_test.sh:130` отправляет только
    `{"project_id":"$PID","use_ai":true}` — без genre, monetization_type, openness.
  - `run-full-pipeline/route.ts:146-153` StageDef отправляет только
    `{ use_ai: i.useAi }` — без genre/monetization/openness.
  - `run-pipeline/[projectId]/route.ts:78-83` StageDef отправляет `{}` — вообще пустое body.
  - Route defaults всё к `genre="rpg"`, `monetization_type="b2p"`, `openness="mixed"`.
  - Route НЕ читает `proj.concept?.genre` или `proj.genre` для override.
    `getOwnedProject` возвращает project с полем `genre: string | null`, но route его игнорирует.

- **`feedback_loops` nodes содержат фиктивные ID** (route.ts:292-303):
  ```ts
  feedbackLoops.push({
    nodes: [anchor, "converter", "consumable", anchor],  // ← "converter" и "consumable" НЕ существуют в nodes[]
    loop_type: "reinforcing",
    strength: 0.7,
    description: "Core production cycle: anchor fuels converters producing consumables",
  });
  feedbackLoops.push({
    nodes: [anchor, "drain_sink", anchor],  // ← "drain_sink" существует только если есть consumable
    loop_type: "balancing",
    strength: 0.5,
    description: "Anchor sink prevents runaway accumulation",
  });
  ```
  В 01_Shadow_Depths nodes имеют ID: `xp`, `gold`, `hp`, `mana`, `stamina`,
  `materials`, `drain_sink`. Никакого `"converter"` или `"consumable"` node нет.
  Любой downstream graph traversal (`nodes.find(n => n.id === id)`) вернёт `undefined` → crash.

- **`profitability = Number((0.8 + Math.random() * 0.4).toFixed(2))`** (route.ts:353) —
  non-deterministic, не связан с actual flows. Подтверждено в 10 test_projects:
  profitabilities варьируются 0.82-1.14 при идентичных входах. Bible 6.9.1
  требует `Прибыльность = Курс_обмена × Частота_использования − Альтернативные_издержки`.

- **`faucetDrain` hardcoded по class** (route.ts:681-687):
  ```ts
  const faucet = r.is_catalytic ? 1.0 : r.resource_class === "currency" ? 0.8 : 0.4;
  const drain = r.is_consumable ? 0.6 : r.resource_class === "currency" ? 0.7 : 0.3;
  ```
  Для RPG preset: `mana` и `materials` (catalytic) → faucet=1.0, drain=0.3 → ratio=3.33 →
  ВСЕГДА 2 critical `Инфляция` pathologies. Circulus vitiosus: диагноз
  определяется class, а class задаётся preset + modulo assignment.
  Подтверждено во всех 10 test_projects: идентичные 2 critical pathologies.

- **`stallCount` threshold сломан** (route.ts:544):
  ```ts
  if (rMax <= r.bounds.min + (r.bounds.max - r.bounds.min) * 0.05) stallCount++;
  ```
  Для `gold`/`hp` с `bounds={min:0, max:10000}` порог = 500, но значения
  колеблются 50→55 (faucet=0.4, drain=0.3, delta=0.1/tick → +5 за 50 ticks).
  → ВСЕГДА stalled. Для `stamina` (consumable, faucet=0.4, drain=0.6): delta=-0.2/tick
  → -10 за 50 ticks → 0.18 (упирается в min) → stalled. Подтверждено:
  `stall_frequency: 0.5` (3 из 6 stalled: gold, hp, stamina) во всех 10 проектах.

- **`num_runs: 10` в config — FAKE** (route.ts:570):
  ```ts
  config: { ticks, num_runs: 10, recording_interval: 5 },
  ```
  Реальный цикл: `for (const r of resources) { for (let t = 0; t < ticks; t++) {...} }`.
  НЕТ outer loop по `num_runs`, НЕТ агрегации (mean/median/std). "aggregated"
  misleading — выводится single run per resource. Bible 6.13.3 явно требует
  "запустить тысячу итераций, собрать статистику" (Step 8).

- **`Math.random()` в simulation noise** (route.ts:534):
  ```ts
  const noise = (Math.random() - 0.5) * 0.2;
  value = value + d.faucet - d.drain + noise;
  ```
  Non-deterministic. Результаты не воспроизводимы. Bible требует
  deterministic seed для воспроизводимости (см. AUDIT_REPORT.md S2).

- **НЕТ функции `enrichEconomy`** в `src/lib/ai-service.ts` (подтверждено
  `grep` — найдены только `enrichMda`, `enrichBalance`, `enrichProgression`).
  Economy route (строка 29) импортирует `enrichProgression`:
  ```ts
  import { enrichProgression } from "@/lib/ai-service";
  ...
  if (useAi) {
    const aiInsights = await enrichProgression({
      projectName: proj.name || "Untitled",
      genre,
      totalLevels: resources.length || 0,  // ← 6 для RPG preset!
    });
  }
  ```
  AI получает `totalLevels: 6` (количество ресурсов!), интерпретирует как
  "6 уровней прогрессии" и даёт advice по кривым прогрессии вместо экономики.
  Подтверждено в 01_Shadow_Depths/06_economy.json `ai_insights`:
  > "1. Для RPG-проекта "Shadow_Depths" с 6 уровнями оптимальна логарифмическая
  > кривая прогрессии. Такой подход обеспечит плавный рост сложности..."

- **AI enrichment вызывается ПОСЛЕ persist** (route.ts:740-814):
  ```ts
  await db.projectEconomy.upsert({ ... fullProfile: JSON.stringify(result) ... });  // строка 740-799
  await updateProjectStage(proj.id, "economy");  // строка 801
  if (useAi) {
    const aiInsights = await enrichProgression({ ... });  // строка 805
    if (aiInsights) {
      result.ai_insights = aiInsights;  // ← добавляется в response, но НЕ в БД
      (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
    }
  }
  return NextResponse.json(result);  // строка 816
  ```
  `fullProfile` в БД сохранён БЕЗ `ai_insights`. GET `/economy/[projectId]`
  возвращает `full_profile` из БД → `ai_insights` всегда `undefined` через GET.

- **DB schema `ProjectEconomy` НЕ имеет `aiInsights` / `modelsUsed` полей**
  (prisma/schema.prisma:257-279):
  ```prisma
  model ProjectEconomy {
    id                String   @id @default(cuid())
    projectId         String   @unique
    systemType        String?
    resourceCount     Int?
    hasPathology      Boolean  @default(false)
    inputData         String?
    resourceModel     String?
    machinationsModel String?
    conversionChains  String?
    pathologies       String?
    corrections       String?
    simulationResults String?
    monetizationModel String?
    fullProfile       String?  // ← JSON без ai_insights/models_used
    createdAt         DateTime @default(now())
    updatedAt         DateTime @updatedAt
    ...
  }
  ```

- **Только 5 абстрактных structural_patterns вместо 16+ Machinations patterns**
  (Bible 6.4.1). Реализованные: `source_pool_drain`, `converter_chain`,
  `consumable_burn`, `ecological_balance`, `engine_accumulator`. Bible требует
  каталог из 16+ паттернов: Static Engine, Dynamic Engine, Converter Engine,
  Engine Building, Static Friction, Dynamic Friction, Stopping Mechanism,
  Attrition, Escalating Challenge, Escalating Complexity, Arms Race,
  Play-Style Reinforcement, Multiple Feedback, Trade, Worker Placement, Slow Cycle.

- **4 pathologies вместо 6** (Bible 6.10). Реализованные: `Инфляция`,
  `Дефляция/Drain`, `Стагнация`, `Убегание`. Bible требует 6:
  + `Арбитраж` (Bible 6.10.3) и `Deadlock` (Bible 6.10.5).

- **`feedback_loops` имеет только 4 поля вместо 8-мерного профиля** (Bible 6.8.2):
  ```ts
  interface FeedbackLoop {
    nodes: string[];
    loop_type: string;       // reinforcing/balancing (= "Тип" + "Эффект" слитно)
    strength: number;
    description: string;
  }
  ```
  Bible требует 8 характеристик: Type (pos/neg), Effect (constructive/destructive),
  Investment, Return, Speed (instant/delayed), Duration (one-shot/permanent),
  Indirectness (direct/indirect), Determinism (deterministic/probabilistic).

- **12-point validation checklist из Bible 6.13.4 НЕ реализован**. В route нет
  функции `validateEconomy()` с 12 проверками (связность, faucet/drain баланс,
  no runaway, no deadlock, no stall, progression curves defined, economic phases,
  inflation control, stagnation prevention, no arbitrage, decision depth, accessibility).

- **6 Schreiber economic system types НЕ реализованы** (Bible 6.4.3):
  Реализованный `pricing_type`: `dual_currency`, `subscription_sink`,
  `cosmetic_only`, `single_purchase`. Bible требует 6: `fixed`,
  `player_dynamic_market`, `f2p_dual_currency`, `prestige_cosmetic`,
  `real_money` (regulated), `mixed`.

- **Genre-specific dominant loops НЕ реализованы** (Bible 6.8.3):
  Реализованный `dominant_loop`: только `meta_loop` (если hasMeta) или
  `core_economy_loop`. Bible требует жанровые профили:
  - RPG → positive constructive (xp→level→skills→more xp)
  - RTS → positive constructive + negative destructive (arms race)
  - FPS → negative destructive (damage) + positive (healthkits)
  - Puzzle → positive + negative (errors → rollback)
  - Survival → negative balancing (hunger) + reinforcing (gear)
  - MMO → complex hierarchy (micro/meso/macro/meta)

- **`stages_completed: [1, 2, 3, 4, 5]` hardcoded** (route.ts:717):
  ```ts
  const stagesCompleted = [1, 2, 3, 4, 5];
  ```
  Игнорирует actual upstream state (concept/coreLoop/mda/balance/progression
  могут быть не сгенерированы).

- **POST/GET response shape mismatch**:
  - POST возвращает: `inventory`, `classification`, `machinations_model`,
    `conversion_graph`, `diagnostics`, `balance`, `sim_result`, `stages_completed`,
    `latency_ms`, `models_used`, `id`.
  - GET возвращает: `id`, `project_id`, `system_type`, `resource_count`,
    `has_pathology`, `resource_model`, `machinations_model`, `conversion_chains`,
    `pathologies`, `corrections`, `simulation_results`, `monetization_model`,
    `full_profile`, `input_data`, `created_at`, `updated_at`.
  - Несовместимые ключи: `inventory` (POST) vs `resource_model` (GET);
    `classification` (POST) vs `system_type`+`input_data` (GET);
    `conversion_graph` (POST) vs `conversion_chains` (GET);
    `diagnostics` (POST) vs `pathologies`+`has_pathology` (GET);
    `balance` (POST) vs `corrections` (GET);
    `sim_result` (POST) vs `simulation_results` (GET).
  - `ai_insights`, `models_used`, `latency_ms`, `stages_completed` — НЕ возвращаются через GET.

- **`subsidiary_count` считает все non-core ресурсы** (route.ts:658-660):
  ```ts
  const subsidiaryCount = resources.filter(
    (r) => r.resource_class !== "core"
  ).length;
  ```
  Type определяет `subsidiary_count` как количество subsidiary-class ресурсов.
  Для RPG+F2P preset: 3 core + 3 subsidiary + 1 currency(gems) = 4 non-core →
  `subsidiary_count = 4`, но actual subsidiary class = 3. Несоответствие типа.

- **`resource_type: isCatalytic ? "subsidiary" : "consumable"` для subsidiary ресурсов** (route.ts:634):
  ```ts
  const isCatalytic = i % 2 === 0;
  const isConsumable = i % 3 === 1;
  resources.push({
    name,
    resource_class: "subsidiary",
    resource_type: isCatalytic ? "subsidiary" : "consumable",  // ← для non-catalytic subsidiary получает тип "consumable"
    ...
  });
  ```
  Для i=2 (3-й subsidiary, isCatalytic=true, isConsumable=false):
  `resource_type = "subsidiary"` (OK). Для i=1 (2-й subsidiary, isCatalytic=false,
  isConsumable=true): `resource_type = "consumable"` (OK). Для i=0 (1-й subsidiary,
  isCatalytic=true, isConsumable=false): `resource_type = "subsidiary"` (OK).
  Но если preset.subsidiary.length === 6 (i=0..5), для i=4 (isCatalytic=true,
  isConsumable=false): subsidiary. Для i=5 (isCatalytic=false, isConsumable=false):
  `resource_type = "consumable"` ← WRONG (non-consumable subsidiary получает тип consumable).

- **`pickResources` case-sensitive** (route.ts:128-133):
  ```ts
  function pickResources(genre: string): { core: string[]; subsidiary: string[] } {
    return GENRE_RESOURCE_PRESETS[genre] || GENRE_RESOURCE_PRESETS.default;
  }
  ```
  `genre="RPG"` (uppercase) → fallback на default (score/currency/energy).
  `genre=" rpg"` (leading space) → fallback. Route делает `body?.genre?.toString().trim()`,
  но не `.toLowerCase()`.

- **`GENRE_RESOURCE_PRESETS` имеет только 5 жанров + default** (route.ts:98-126):
  `rpg`, `shooter`, `strategy`, `mmorpg`, `idle`. Bible 6.12 перечисляет 6
  жанров с разными экономиками: RPG, RTS, FPS, Survival, MMO, F2P/Mobile.
  Не покрыты: `puzzle`, `racing`, `metroidvania`, `roguelike`, `tower_defense`,
  `sandbox`, `simulation`, `rhythm`, `horror`, `deck_builder`. Для всех
  unknown genres (включая все 10 test_projects кроме rpg) возвращается default.

- **`models_used` hardcoded список** (route.ts:731-736):
  ```ts
  models_used: [
    "deterministic-economy-v1",
    "machinations-builder-v1",
    "pathology-detector-v1",
    "monte-carlo-sim-v1",
  ],
  ```
  Строки ни используются, ни валидируются. AI enrichment добавляет
  `"glm-4.6 (ai-enrichment)"` (строка 812) — inconsistent naming.

- **`proposeAdjustments` не обрабатывает "Стагнация"** (route.ts:454-493):
  ```ts
  for (const p of pathologies) {
    if (p.name === "Инфляция") { ... }
    else if (p.name === "Дефляция / Drain") { ... }
    else if (p.name === "Убегание") { ... }
    // ← "Стагнация" silently skipped
  }
  ```
  Если `Стагнация` обнаружена (а она обнаруживается для всех consumable
  subsidiary с faucet<0.2 && drain<0.2), adjustment не предлагается.

- **`noise = (Math.random() - 0.5) * 0.2` несоизмерим с delta** (route.ts:534-535):
  Для anchor (xp, faucet=0.4, drain=0.3): delta=0.1, noise=±0.1 → ratio noise/delta=100%.
  Для mana (faucet=1.0, drain=0.3): delta=0.7, noise=±0.1 → ratio=14%. Несоизмеримо
  разные SNR по ресурсам.

- **`overall_pass = criticalIssues.length === 0 && stability > 0.6`** (route.ts:565):
  Если stability=0.75 (всегда для RPG preset) и criticalIssues=["Высокая частота
  стагнации"] (всегда из-за stallCount bug) → `overall_pass=false` всегда.
  Подтверждено во всех 10 test_projects: `overall_pass: false`.

- **`run_pipeline_test.sh` не передаёт genre из GENRES array** (строки 50-52, 128-131):
  ```bash
  GENRES=("RPG" "Tower Defense" "Rhythm" "Puzzle" "Metroidvania" "Strategy" "Sandbox" "Shooter" "Simulation" "Racing")
  ...
  R=$(curl -s -X POST $API/economy/design \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"project_id\":\"$PID\",\"use_ai\":true}" \
    --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
  ```
  GENRES объявлен, но не используется в -d payload. Аналогично
  для progression (см. REFACTOR_PLAN_block_5a.md TASK-5a.7).

---

## Цели рефакторинга

1. **Восстановить детерминизм** — убрать `Math.random()` в profitability и
   simulation noise; заменить на seed-based PRNG (mulberry32) с passing
   seed через body.
2. **Починить feedback_loops** — nodes должны ссылаться на ACTUAL node IDs
   из `machinations_model.nodes`, не на строковые литералы `"converter"` /
   `"consumable"`.
3. **Вывести faucet/drain из actual resource flows** в machinations graph
   (сумма inflows / outflows per resource), а не из class preset.
4. **Реализовать 6 pathologies** (Bible 6.10) + adjustments для ВСЕХ 6
   (включая `Стагнация`, `Арбитраж`, `Deadlock`).
5. **Реализовать 16+ Machinations patterns** как библиотеку с metadata
   (когда применять, какие nodes нужны, типичные патологии).
6. **Реализовать 8-мерный профиль петли ОС** (Bible 6.8.2) — Type, Effect,
   Investment, Return, Speed, Duration, Indirectness, Determinism.
7. **Реализовать 12-point validation checklist** (Bible 6.13.4) — связность,
   faucet/drain баланс, no runaway, no deadlock, no stall, progression curves,
   economic phases, inflation control, stagnation prevention, no arbitrage,
   decision depth, accessibility.
8. **Реализовать real Monte Carlo** — N runs (default 100, max 1000) с
   deterministic seed, агрегация (mean ± std) per resource per tick.
9. **Создать `enrichEconomy`** в `ai-service.ts` с economy-specific prompt
   (не progression).
10. **Перенести AI enrichment ДО persist** — `ai_insights` и `models_used`
    должны сохраняться в БД. Добавить поля `aiInsights`, `modelsUsed` в
    `ProjectEconomy` schema.
11. **Деривить economy params (genre, monetization_type, openness) из upstream
    concept/balance** в `run-full-pipeline` + `run-pipeline` + `run_pipeline_test.sh`.
12. **Унифицировать POST/GET response shape** — один canonical format
    (`EconomyDesignResponse` type), GET должен возвращать тот же shape.
13. **Расширить `GENRE_RESOURCE_PRESETS` до 10+ жанров** + жанро-специфичные
    dominant loops (Bible 6.8.3) + экономические subsystems.
14. **Реализовать 6 Schreiber economic system types** в `pricing_type`
    (Bible 6.4.3).
15. **Убрать hardcoded `stages_completed: [1,2,3,4,5]`** — выводить из
    actual upstream state.
16. **Исправить `subsidiary_count` и `resource_type`** для subsidiary
    ресурсов (не считать currency/consumable как subsidiary; default type
    для subsidiary = `"subsidiary"`, не `"consumable"`).
17. **Реализовать conversion chain profitability по формуле Bible 6.9.1**:
    `Прибыльность = Курс × Частота − Альтернативные_издержки`.
18. **Починить `stallCount` threshold** — использовать relative change
    (e.g., `rMax <= initial * 1.1`) вместо absolute `min + 5% of range`.

---

## Задачи

### TASK-5b.1: Создать `enrichEconomy` в `ai-service.ts` и использовать в route

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-5b.10 — persist ai_insights)
**Файлы**: `src/lib/ai-service.ts`, `src/app/api/v1/economy/design/route.ts`

**Описание проблемы**:

В `src/lib/ai-service.ts` НЕТ функции `enrichEconomy`. Подтверждено `grep`:
найдены только `enrichMda` (строка 553), `enrichBalance` (596), `enrichProgression`
(640). Economy route (строка 29) импортирует `enrichProgression`:
```ts
import { enrichProgression } from "@/lib/ai-service";
```

Вызов (route.ts:804-814):
```ts
if (useAi) {
  const aiInsights = await enrichProgression({
    projectName: proj.name || "Untitled",
    genre,
    totalLevels: resources.length || 0,  // ← 6 для RPG!
  });
  if (aiInsights) {
    result.ai_insights = aiInsights;
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
```

`totalLevels: resources.length` = 6 для RPG preset. AI интерпретирует как
"6 уровней прогрессии" → даёт advice по логарифмической кривой, тирам,
content gates (подтверждено в 01_Shadow_Depths/06_economy.json `ai_insights`).

**Решение**:

1. **Добавить `EconomyAiInput` interface и `enrichEconomy` function** в
   `src/lib/ai-service.ts` после `enrichProgression` (после строки 671):
   ```ts
   // ============================================================
   // AI enrichment for Block 5b (Economy designer)
   // ============================================================

   export interface EconomyAiInput {
     projectName: string;
     genre: string;
     systemType: string;            // Engine | Economy | Ecology
     monetizationType: string;      // f2p | b2p | subscription | p2w | cosmetic | hybrid
     openness: string;              // open | closed | mixed
     resourceCount: number;
     anchorResource: string;
     pathologies: Array<{ name: string; severity: string; affected_resources: string[] }>;
     dominantLoops: string[];
     conversionChainCount: number;
     avgProfitability: number;
     stabilityIndex: number;
     stallFrequency: number;
     runawayFrequency: number;
   }

   export async function enrichEconomy(ctx: EconomyAiInput): Promise<string | null> {
     const zai = await getZai();
     if (!zai) return null;
     try {
       const pathologySummary = ctx.pathologies.length === 0
         ? "патологий не обнаружено"
         : ctx.pathologies
             .map((p) => `${p.name} (${p.severity}, затронуты: ${p.affected_resources.join(", ")})`)
             .join("; ");
       const prompt = `Ты — эксперт по игровой экономике (Machinations, Адамс/Дорманс, Шрайбер, Селлерс). Дай рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип системы: ${ctx.systemType} (Engine/Economy/Ecology по Селлерсу)
Монетизация: ${ctx.monetizationType}
Открытость экономики: ${ctx.openness}
Ресурсов: ${ctx.resourceCount}, якорный ресурс: "${ctx.anchorResource}"
Доминирующие петли: ${ctx.dominantLoops.join(", ")}
Цепочек конверсии: ${ctx.conversionChainCount}, средняя прибыльность: ${ctx.avgProfitability.toFixed(2)}
Симуляция (50 ticks): stability=${ctx.stabilityIndex.toFixed(2)}, stall_freq=${ctx.stallFrequency.toFixed(2)}, runaway_freq=${ctx.runawayFrequency.toFixed(2)}
Патологии: ${pathologySummary}

Дай 3-4 конкретных совета (на русском) по экономике:
1. Какая Machinations-структура оптимальна для этого жанра/монетизации (Static/Dynamic/Converter Engine, Engine Building, Friction pattern и т.д. — Bible 6.4.1)
2. Какие faucet/drain корректировки рекомендуются для выявленных патологий (Bible 6.10, 6.11.3)
3. Какие петли обратной связи добавить/усилить (reinforcing для роста, balancing для стабилизации — Bible 6.8)
4. Специфический риск для ${ctx.monetizationType} экономики (F2P: dual-currency balance; subscription: sink design; cosmetic: prestige loops) и митигация

Ответ — обычный текст с нумерованными пунктами, без markdown-заголовков.`;
       const response = await zai.chat.completions.create({
         messages: [
           { role: "system", content: "Ты — AI-ассистент по геймдизайну, эксперт по игровой экономике (Machinations framework)." },
           { role: "user", content: prompt },
         ],
         stream: false,
         thinking: { type: "disabled" },
       });
       const text = response.choices?.[0]?.message?.content?.trim();
       return text && text.length > 30 ? text : null;
     } catch (e) {
       console.error("[ai-service] enrichEconomy failed:", e instanceof Error ? e.message : e);
       return null;
     }
   }
   ```

2. **Заменить import и вызов в route.ts**:
   ```ts
   // строка 29 — было:
   import { enrichProgression } from "@/lib/ai-service";
   // стало:
   import { enrichEconomy } from "@/lib/ai-service";
   ```
   ```ts
   // строки 804-814 — было:
   if (useAi) {
     const aiInsights = await enrichProgression({
       projectName: proj.name || "Untitled",
       genre,
       totalLevels: resources.length || 0,
     });
     ...
   }
   // стало:
   if (useAi) {
     const aiInsights = await enrichEconomy({
       projectName: proj.name || "Untitled",
       genre,
       systemType: classification.type,
       monetizationType,
       openness,
       resourceCount: resources.length,
       anchorResource: anchor,
       pathologies: pathologies.map((p) => ({
         name: p.name,
         severity: p.severity,
         affected_resources: p.affected_resources,
       })),
       dominantLoops: machinations.feedback_loops.map((l) => l.loop_type),
       conversionChainCount: conversionGraph.chains.length,
       avgProfitability: conversionGraph.avg_profitability,
       stabilityIndex: simResult.aggregated.stability_index,
       stallFrequency: simResult.aggregated.stall_frequency,
       runawayFrequency: simResult.aggregated.runaway_frequency,
     });
     if (aiInsights) {
       result.ai_insights = aiInsights;
       (result.models_used as string[]).push("glm-4.6 (economy-enrichment)");
     }
   }
   ```

3. **Перенести AI enrichment ДО persist** (см. TASK-5b.10):
   ```ts
   // Было (строки 740-814): persist → AI enrichment → return
   // Стало: AI enrichment → persist (с ai_insights в result) → return
   ```

**Тест-кейсы**:
- `grep -n "enrichEconomy" src/lib/ai-service.ts` находит function declaration.
- `grep -n "enrichProgression" src/app/api/v1/economy/design/route.ts` возвращает 0 matches.
- POST `/economy/design` с `use_ai: true` для проекта Shadow_Depths (rpg, b2p)
  возвращает `ai_insights`, который содержит "Machinations", "faucet/drain",
  или "петли" (не "логарифмическая кривая прогрессии").
- POST `/economy/design` с `use_ai: false` → `ai_insights` отсутствует.
- Если ZAI SDK недоступен (`getZai()` returns null), `enrichEconomy` возвращает
  `null` без throw.
- Если LLM возвращает <30 символов, `enrichEconomy` возвращает `null`.

**Риски**:
- **LLM latency** — `enrichEconomy` добавляет 2-5s к запросу. Митигация:
  timeout 15s в `getZai()` (уже есть в SDK), fallback на `null`.
- **Prompt drift** — LLM может игнорировать инструкции. Митигация: explicit
  "без markdown-заголовков" в prompt; unit test на наличие ключевых слов
  ("Machinations" или "faucet" или "петли").
- **Cost** — каждый вызов ~500 input tokens + ~300 output tokens. Митигация:
  кеширование по `hash(ctx)` (опционально, TASK-5b.22).

**Dependencies**: нет (стартовая задача;TASK-5b.10 зависит от неё).

---

### TASK-5b.2: Починить `feedback_loops` nodes — ссылаться на ACTUAL node IDs

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-5b.12 — 8-dim profile; TASK-5b.7 —
downstream graph analysis)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 291-303)

**Описание проблемы**:

`buildMachinations` (route.ts:291-303):
```ts
// Feedback loops: anchor→converter→consumable→anchor (reinforcing) and anchor→sink→anchor (balancing)
feedbackLoops.push({
  nodes: [anchor, "converter", "consumable", anchor],  // ← "converter" и "consumable" НЕ существуют
  loop_type: "reinforcing",
  strength: 0.7,
  description: "Core production cycle: anchor fuels converters producing consumables",
});
feedbackLoops.push({
  nodes: [anchor, "drain_sink", anchor],
  loop_type: "balancing",
  strength: 0.5,
  description: "Anchor sink prevents runaway accumulation",
});
```

В 01_Shadow_Depths nodes имеют ID: `xp`, `gold`, `hp`, `mana`, `stamina`,
`materials`, `drain_sink`. `"converter"` и `"consumable"` — фиктивные
строковые литералы. Любой downstream graph traversal упадёт на
`nodes.find((n) => n.id === "converter")` → `undefined`.

Кроме того, `feedback_loops` HARDCODED — всегда 2 записи с одинаковой
структурой, не выводятся из actual resources. Если preset не имеет
catalytic ресурсов (например, default preset: score/currency/energy +
materials/tokens — `is_catalytic = i % 2 === 0` → materials catalytic,
tokens consumable; но если preset.subsidiary.length === 0, нет catalytic),
первая петля всё равно пушится с фиктивными ID.

**Решение**:

1. **Заменить hardcoded feedback loops на derived**:
   ```ts
   // В buildMachinations(), после построения nodes/flows/stateConns:

   // Helper: найти цикл в resource_flows через DFS
   function findCycles(
     flows: ResourceFlow[],
     startId: string
   ): string[][] {
     const adj = new Map<string, string[]>();
     for (const f of flows) {
       if (!adj.has(f.source_id)) adj.set(f.source_id, []);
       adj.get(f.source_id)!.push(f.target_id);
     }
     const cycles: string[][] = [];
     const visited = new Set<string>();
     const path: string[] = [];

     function dfs(node: string) {
       if (path.includes(node)) {
         const cycleStart = path.indexOf(node);
         cycles.push([...path.slice(cycleStart), node]);
         return;
       }
       if (visited.has(node)) return;
       visited.add(node);
       path.push(node);
       for (const next of adj.get(node) || []) {
         dfs(next);
       }
       path.pop();
     }
     dfs(startId);
     return cycles;
   }

   // Reinforcing loops: cycles starting from anchor through catalytic converters
   const catalyticResources = resources.filter((r) => r.is_catalytic);
   for (const cat of catalyticResources) {
     // anchor → converter → outputs → ... → anchor (если есть обратный поток)
     const outputsFlowedTo = flows
       .filter((f) => f.source_id === cat.name)
       .map((f) => f.target_id);
     for (const out of outputsFlowedTo) {
       // Ищем, есть ли обратный поток out → anchor (через другие конвертеры)
       const backFlow = flows.find(
         (f) => f.source_id === out && (f.target_id === anchor || f.target_id === cat.name)
       );
       if (backFlow) {
         feedbackLoops.push({
           nodes: [anchor, cat.name, out, backFlow.target_id, anchor].filter(
             (n, i, arr) => arr.indexOf(n) === i // dedupe
           ),
           loop_type: "reinforcing",
           strength: 0.7,
           description: `Цикл роста: ${anchor} → ${cat.name} → ${out} → ${backFlow.target_id} → ${anchor}`,
         });
       }
     }
   }

   // Если reinforcing loops не найдены — fallback на anchor → catalytic → outputs (без замыкания)
   if (feedbackLoops.length === 0 && catalyticResources.length > 0) {
     const cat = catalyticResources[0];
     const outputs = flows.filter((f) => f.source_id === cat.name).map((f) => f.target_id);
     feedbackLoops.push({
       nodes: [anchor, cat.name, ...outputs].filter((n, i, arr) => arr.indexOf(n) === i),
       loop_type: "reinforcing",
       strength: 0.6,
       description: `Цикл производства: ${anchor} → ${cat.name} → ${outputs.join(", ")}`,
     });
   }

   // Balancing loops: cycles through drain_sink
   const hasDrainSink = nodes.some((n) => n.id === "drain_sink");
   if (hasDrainSink) {
     // Найти ресурсы, сливающиеся в drain_sink
     const drainingResources = flows
       .filter((f) => f.target_id === "drain_sink")
       .map((f) => f.source_id);
     for (const res of drainingResources) {
       feedbackLoops.push({
         nodes: [res, "drain_sink"],  // нет обратного потока, но цикл "consumption"
         loop_type: "balancing",
         strength: 0.5,
         description: `Сток: ${res} → drain_sink предотвращает накопление`,
       });
     }
   }

   // Если consumable есть, но нет drain_sink (edge case) — добавить якорь как балансир
   if (feedbackLoops.length === 0) {
     feedbackLoops.push({
       nodes: [anchor],
       loop_type: "balancing",
       strength: 0.3,
       description: "Базовая балансирующая петля: ограничение якоря (capacity)",
     });
   }
   ```

2. **Валидация перед persist**: проверить, что все `nodes` в `feedback_loops`
   существуют в `machinations_model.nodes`:
   ```ts
   // В POST handler, после buildMachinations:
   const nodeIds = new Set(machinations.nodes.map((n) => n.id));
   for (const loop of machinations.feedback_loops) {
     for (const nodeId of loop.nodes) {
       if (!nodeIds.has(nodeId)) {
         console.warn(`[economy/design] feedback_loop references missing node: ${nodeId}`);
         // Либо удалить loop, либо заменить на валидный ID
       }
     }
   }
   ```

3. **Добавить unit test** (см. TASK-5b.22) — для каждого preset:
   ```ts
   test("feedback_loops reference only existing node IDs", () => {
     const { machinations_model } = runEconomyDesign({ genre: "rpg", monetization_type: "b2p", openness: "mixed" });
     const nodeIds = new Set(machinations_model.nodes.map((n) => n.id));
     for (const loop of machinations_model.feedback_loops) {
       for (const nodeId of loop.nodes) {
         expect(nodeIds.has(nodeId)).toBe(true);
       }
     }
   });
   ```

**Тест-кейсы**:
- Для RPG preset: `feedback_loops[0].nodes` содержит только ID из
  `{xp, gold, hp, mana, stamina, materials, drain_sink}`. НЕ содержит
  `"converter"` или `"consumable"`.
- Для preset без catalytic (hypothetical): `feedback_loops` не падает,
  fallback на balancing loop с anchor.
- Для preset без consumable: нет balancing loops через `drain_sink`
  (drain_sink node вообще не создаётся).
- Для empty resources (edge case): `feedback_loops = []` (не падает).
- Все 10 test_projects после рефакторинга: `feedback_loops[0].nodes`
  содержат только валидные ID.

**Риски**:
- **Алгоритм поиска циклов может дать слишком много петель** для плотных
  графов. Митигация: ограничить `feedbackLoops.length <= 5`, отсортировать
  по `strength` descending.
- **Description генерируется динамически** — может быть менее информативным,
  чем hardcoded. Митигация: explicit template string с именами ресурсов.
- **Backward compat**: UI компоненты могут ожидать ровно 2 feedback loops.
  Митигация: проверить `src/components/gidede/economy/*` и обновить рендеринг.

**Dependencies**: нет (но TASK-5b.12 расширяет feedback_loops до 8-dim
профиля после этой задачи).

---

### TASK-5b.3: Заменить `Math.random()` в profitability на детерминированную формулу

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-5b.9 — 12-point checklist arbitrage check)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 322-385)

**Описание проблемы**:

`findConversionChains` (route.ts:349-361):
```ts
for (let i = 0; i < catalytic.length; i++) {
  const c = catalytic[i];
  const input = currencies[0] || resources[0];
  const output = outputs[i % outputs.length] || resources[resources.length - 1];
  const profitability = Number((0.8 + Math.random() * 0.4).toFixed(2));  // ← RANDOM
  chains.push({
    inputs: [input.name],
    outputs: [output.name],
    profitability,
    tier: i + 1,
    risk: profitability > 1.0 ? "low" : profitability > 0.85 ? "medium" : "high",
  });
}
```

`profitability` — случайное число 0.80-1.20, не связан с actual flows.
Подтверждено: 10 test_projects имеют разные profitabilities (0.82-1.14) при
идентичных входах. Bible 6.9.1:
```
Курс_обмена = Выход / Вход
Прибыльность = Курс_обмена × Частота_использования − Альтернативные_издержки
```

**Решение**:

1. **Вывести profitability из actual resource rates**:
   ```ts
   function findConversionChains(
     resources: ResourceDef[],
     flows: ResourceFlow[],  // ← добавить параметр
     faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>  // ← добавить
   ): { ... } {
     const chains: Array<{...}> = [];
     const currencies = resources.filter((r) => r.resource_class === "currency" || r.is_anchor);
     const catalytic = resources.filter((r) => r.is_catalytic);
     const outputs = resources.filter((r) => r.resource_class === "subsidiary" || r.is_consumable);

     for (let i = 0; i < catalytic.length; i++) {
       const c = catalytic[i];
       const input = currencies[0] || resources[0];
       const output = outputs[i % outputs.length] || resources[resources.length - 1];

       // Найти actual flow rates из machinations graph
       const inflow = flows.find((f) => f.target_id === c.name && f.source_id === input.name);
       const outflow = flows.find((f) => f.source_id === c.name && f.target_id === output.name);

       // Курс обмена = output rate / input rate
       const inputRate = inflow?.rate ?? faucetDrain[input.name]?.faucet ?? 0.5;
       const outputRate = outflow?.rate ?? faucetDrain[output.name]?.faucet ?? 0.4;

       // Bible 6.9.1: Прибыльность = Курс × Частота − Альтернативные_издержки
       const exchangeRate = inputRate > 0 ? outputRate / inputRate : 0;
       const usageFrequency = faucetDrain[c.name]?.faucet ?? 0.5;  // как часто конвертер используется
       const alternativeCost = faucetDrain[input.name]?.drain ?? 0.3;  // альтернативное использование input
       const profitability = Number(
         Math.max(0, exchangeRate * usageFrequency - alternativeCost).toFixed(3)
       );

       // Risk: базируется на profitability И volatility (range bounds)
       const outputBounds = output.bounds;
       const volatility = outputBounds.max > 0
         ? (outputBounds.max - outputBounds.min) / outputBounds.max
         : 0.5;
       let risk: string;
       if (profitability > 1.0 && volatility < 0.5) risk = "low";
       else if (profitability > 0.85 && volatility < 0.8) risk = "medium";
       else risk = "high";

       chains.push({
         inputs: [input.name],
         outputs: [output.name],
         profitability,
         tier: i + 1,
         risk,
       });
     }
     ...
   }
   ```

2. **Обновить вызов в POST handler** (route.ts:678):
   ```ts
   // Было:
   const conversionGraph = findConversionChains(resources);
   // Стало:
   const conversionGraph = findConversionChains(resources, machinations.resource_flows, faucetDrain);
   ```
   ВАЖНО: `faucetDrain` должен быть вычислен ДО `findConversionChains`
   (см. TASK-5b.4 — переставить порядок вычислений).

3. **Добавить детерминированный seed для fallback** (если flows пустые):
   ```ts
   // Helper: deterministic pseudo-random based on string hash (если нет flows)
   function hashSeed(s: string): number {
     let h = 0;
     for (let i = 0; i < s.length; i++) {
       h = ((h << 5) - h) + s.charCodeAt(i);
       h |= 0;
     }
     return Math.abs(h);
   }
   // Fallback: profitability = 0.85 + (hashSeed(c.name + input.name) % 30) / 100  // 0.85-1.14
   ```

**Тест-кейсы**:
- Два вызова с идентичными input → идентичные `profitability` (детерминизм).
- Для RPG preset: `mana` converter (input=xp, output=gold/hp) → profitability
  вычисляется из actual flow rates (0.5 input, 0.4 output → exchangeRate=0.8,
  usageFrequency=1.0, alternativeCost=0.3 → profitability=0.5).
- `risk = "low"` только если `profitability > 1.0 && volatility < 0.5`.
- `risk = "high"` если `profitability < 0.85 || volatility >= 0.8`.
- Для preset без catalytic (chains пустой): `avg_profitability = 0`,
  warnings содержат "Не найдено цепочек конверсии".
- Все 10 test_projects после рефакторинга имеют ИДЕНТИЧНЫЕ profitabilities
  (т.к. входы идентичны).

**Риски**:
- **Profitability может стать < 0.8 для всех chains** → все "high" risk,
  avg_profitability низкий → warning "Средняя прибыльность ниже 1.0".
  Митигация: проверить формулу на 5+ genres, при необходимости добавить
  baseline shift (+0.3 к exchangeRate * usageFrequency).
- **`flows` могут не содержать прямой input→converter flow** (если
  converter получает ресурс из другого источника). Митигация: BFS по
  flows от input до converter, перемножить rates.

**Dependencies**: TASK-5b.4 (нужно вычислить `faucetDrain` ДО
`findConversionChains`).

---

### TASK-5b.4: Вывести `faucetDrain` из actual resource flows, не из class preset

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-5b.3, TASK-5b.8 — arbitrage detection)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 680-687)

**Описание проблемы**:

`faucetDrain` derivation (route.ts:681-687):
```ts
const faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }> = {};
for (const r of resources) {
  const faucet = r.is_catalytic ? 1.0 : r.resource_class === "currency" ? 0.8 : 0.4;
  const drain = r.is_consumable ? 0.6 : r.resource_class === "currency" ? 0.7 : 0.3;
  const ratio = drain > 0 ? Number((faucet / drain).toFixed(3)) : 0;
  faucetDrain[r.name] = { faucet, drain, ratio };
}
```

`faucet` и `drain` — константы по class. Для RPG preset:
- `mana`, `materials` (catalytic) → faucet=1.0, drain=0.3 → ratio=3.33 → ВСЕГДА critical `Инфляция`.
- `gold`, `hp` (currency class) → faucet=0.8, drain=0.7 → ratio=1.143 → no pathology.
- `xp` (anchor, class=core) → faucet=0.4, drain=0.3 → ratio=1.333 → no pathology.
- `stamina` (consumable) → faucet=0.4, drain=0.6 → ratio=0.667 → no pathology.

Подтверждено во всех 10 test_projects: ИДЕНТИЧНЫЕ faucet_drain_ratios,
ИДЕНТИЧНЫЕ 2 critical `Инфляция` pathologies (mana, materials).

**Решение**:

1. **Вычислить faucet/drain из actual machinations flows**:
   ```ts
   function deriveFaucetDrain(
     resources: ResourceDef[],
     flows: ResourceFlow[],
     anchor: string
   ): Record<string, { faucet: number; drain: number; ratio: number }> {
     const result: Record<string, { faucet: number; drain: number; ratio: number }> = {};

     for (const r of resources) {
       // Faucet = sum of inflow rates into this resource
       const inflows = flows.filter((f) => f.target_id === r.name);
       const faucet = inflows.reduce((sum, f) => sum + f.rate, 0);

       // Drain = sum of outflow rates from this resource
       const outflows = flows.filter((f) => f.source_id === r.name);
       const drain = outflows.reduce((sum, f) => sum + f.rate, 0);

       // Если нет flows (anchor без inflows, например) — fallback на baseline
       const baselineFaucet = r.is_anchor ? 0.5 : r.resource_class === "currency" ? 0.3 : 0.2;
       const baselineDrain = r.is_consumable ? 0.4 : 0.2;

       const finalFaucet = faucet > 0 ? faucet : baselineFaucet;
       const finalDrain = drain > 0 ? drain : baselineDrain;
       const ratio = finalDrain > 0 ? Number((finalFaucet / finalDrain).toFixed(3)) : 0;

       result[r.name] = { faucet: finalFaucet, drain: finalDrain, ratio };
     }

     // Для drain_sink (виртуальный узел) — drain = sum всех inflows
     const sinkInflows = flows.filter((f) => f.target_id === "drain_sink");
     if (sinkInflows.length > 0) {
       const sinkFaucet = sinkInflows.reduce((sum, f) => sum + f.rate, 0);
       result["drain_sink"] = { faucet: sinkFaucet, drain: 0, ratio: Infinity };
     }

     return result;
   }
   ```

2. **Переставить порядок вычислений в POST handler** (route.ts:674-690):
   ```ts
   // Было:
   // 1. buildMachinations
   // 2. findConversionChains (uses random profitability)
   // 3. faucetDrain (hardcoded by class)
   // 4. detectPathologies (uses faucetDrain)

   // Стало:
   // 1. buildMachinations → machinations.resource_flows
   // 2. faucetDrain = deriveFaucetDrain(resources, machinations.resource_flows, anchor)
   // 3. findConversionChains(resources, machinations.resource_flows, faucetDrain)
   // 4. detectPathologies(resources, faucetDrain)
   ```

   Конкретный код:
   ```ts
   // --- Machinations model ---
   const machinations = buildMachinations(resources, anchor, classification);

   // --- Faucet/drain ratios (derived from actual flows) ---
   const faucetDrain = deriveFaucetDrain(resources, machinations.resource_flows, anchor);

   // --- Conversion graph (uses faucetDrain for profitability) ---
   const conversionGraph = findConversionChains(resources, machinations.resource_flows, faucetDrain);

   // --- Diagnostics ---
   const pathologies = detectPathologies(resources, faucetDrain, conversionGraph);  // + conversionGraph для arbitrage
   ```

3. **Обновить `buildMachinations` чтобы генерировать meaningful flow rates**:
   Сейчас все flows имеют hardcoded rates (0.5, 0.4, 0.3). Нужно параметризовать:
   ```ts
   // В buildMachinations, для catalytic resource:
   flows.push({
     source_id: anchor,
     target_id: r.name,
     resource: anchor,
     rate: 0.5 * (r.is_catalytic ? 1.2 : 1.0),  // catalytic конвертеры работают чуть быстрее
   });
   // outputs из converter:
   for (let i = 0; i < Math.min(2, outputs.length); i++) {
     flows.push({
       source_id: r.name,
       target_id: outputs[i].name,
       resource: outputs[i].name,
       rate: 0.4 + (i * 0.1),  // первый output 0.4, второй 0.5
     });
   }
   ```

**Тест-кейсы**:
- Для RPG preset: `mana` converter имеет inflow rate=0.5 (from xp), outflows
  to gold (0.4) + hp (0.4) → faucet=0.5, drain=0.8, ratio=0.625 → NO inflation.
  (Сейчас: faucet=1.0, drain=0.3, ratio=3.33 → critical inflation.)
- Для `stamina` (consumable): inflow=0 (нет flows в stamina), outflow=0.3
  (to drain_sink) → faucet=0.2 (baseline), drain=0.3, ratio=0.667.
- Для `drain_sink`: faucet=sum of consumable drains (0.3 для stamina) → 0.3,
  drain=0, ratio=Infinity → логично (сток никогда не переполняется).
- Все 10 test_projects после рефакторинга: faucet_drain_ratios вычислены
  из actual flows (не hardcoded), pathologies могут отличаться между
  проектами (если они имеют разные resources — после TASK-5b.7).

**Риски**:
- **Если flows отсутствуют для resource** (anchor без inflows) — fallback на
  baseline. Митигация: убедиться, что anchor имеет хотя бы один inflow
  (добавить source node с rate=0.5 для anchor в `buildMachinations`).
- **Ratio=Infinity для drain_sink** ломает JSON serialization. Митигация:
  использовать `Number.isFinite(ratio) ? ratio : 999` или хранить как
  `null` для стоков.
- **Изменение ratio меняет pathologies** — текущие 2 critical `Инфляция`
  могут исчезнуть, появятся новые. Это CORRECT behavior, но требует
  обновить snapshots в UI тестах.

**Dependencies**: нет (но требует TASK-5b.3 для использования в conversion chains).

---

### TASK-5b.5: Починить `stallCount` threshold (использовать relative change)

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-5b.6 — real Monte Carlo; влияет на `overall_pass`)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 543-544)

**Описание проблемы**:

`simulate` (route.ts:543-544):
```ts
if (rMax >= r.bounds.max * 0.95) runawayCount++;
if (rMax <= r.bounds.min + (r.bounds.max - r.bounds.min) * 0.05) stallCount++;
```

Для `gold`/`hp` с `bounds={min:0, max:10000}`:
- `rMax` после 50 ticks ≈ 55 (delta=0.1/tick × 50 = 5).
- Threshold `rMax <= 0 + 10000*0.05 = 500`.
- 55 ≤ 500 → `stallCount++`. ВСЕГДА.

Для `stamina` (consumable, faucet=0.4, drain=0.6, bounds 0-500):
- delta=-0.2/tick → -10 за 50 ticks → value=0.18 (упирается в min=0).
- Threshold `rMax <= 0 + 500*0.05 = 25`.
- rMax=10 (initial) → 10 ≤ 25 → `stallCount++`. ВСЕГДА.

Подтверждено: `stall_frequency: 0.5` (3 из 6 stalled: gold, hp, stamina)
во всех 10 test_projects. Это ARTEFACT, не реальная стагнация.

**Решение**:

1. **Использовать relative change вместо absolute threshold**:
   ```ts
   // Было:
   if (rMax <= r.bounds.min + (r.bounds.max - r.bounds.min) * 0.05) stallCount++;

   // Стало: stall = значение осталось близко к initial (или упало ниже)
   const initial = r.initial_value;
   const range = r.bounds.max - r.bounds.min;
   const stallThreshold = initial - range * 0.05;  // упало на 5% от range ниже initial
   const runawayThreshold = r.bounds.max * 0.95;   // достигло 95% от max

   // Стагнация: max за симуляцию <= initial (нет роста) ИЛИ delta < 1% от range
   const maxDelta = Math.abs(rMax - initial);
   const relativeDelta = range > 0 ? maxDelta / range : 0;
   if (relativeDelta < 0.02) stallCount++;  // изменение меньше 2% от range

   // Runaway: достигло 95% от max capacity
   if (rMax >= runawayThreshold) runawayCount++;

   // Дополнительно: stall если финальное значение упало до min
   if (series[series.length - 1] <= r.bounds.min + range * 0.01) stallCount++;
   ```

2. **Учитывать direction (growth vs decay)**:
   ```ts
   // Для ресурса с faucet > drain (ожидаемый рост) — stall = не вырос
   const expectedGrowth = d.faucet - d.drain;
   if (expectedGrowth > 0 && rMax < initial * 1.05) {
     // Должен был расти, но не вырос → stall
     stallCount++;
   }
   // Для ресурса с faucet < drain (ожидаемое падение) — runaway = не упал
   if (expectedGrowth < 0 && rMin > initial * 0.95) {
     // Должен был падать, но не упал → аномалия (но не runaway)
   }
   ```

3. **Дедуплицировать stallCount** (не считать один ресурс дважды):
   ```ts
   const stalledResources = new Set<string>();
   const runawayResources = new Set<string>();
   for (const r of resources) {
     ...
     if (isStalled) stalledResources.add(r.name);
     if (isRunaway) runawayResources.add(r.name);
   }
   const runawayCount = runawayResources.size;
   const stallCount = stalledResources.size;
   ```

**Тест-кейсы**:
- Для RPG preset после TASK-5b.4 (faucet/drain из flows):
  - `xp` (anchor): expected growth, rMax≈105 (initial 100, +5 за 50 ticks),
    relativeDelta = 5/1000 = 0.005 < 0.02 → stall. (Под вопросом —
    anchor действительно "стагнирует" если почти не растёт.)
  - `mana` (catalytic): expected growth (faucet=0.5, drain=0.8 после TASK-5b.4
    → expected decay -0.3/tick → rMin≈0). Если rMax < initial * 0.95 →
    аномалия, но не stall.
  - `stamina` (consumable): expected decay, rMin≈0 → expected behavior,
    НЕ stall (стагнация = нет изменения, не падение).
- `stall_frequency` после рефакторинга ≠ 0.5 для всех проектов.
- `runaway_frequency` > 0 если хотя бы один ресурс достиг 95% от max
  (например, для f2p preset с `gems` bounds 0-99999,初始=0, faucet=0.8,
  drain=0.7 → +5 за 50 ticks → 5, не runaway).

**Риски**:
- **Threshold 2% может быть слишком strict** для ресурсов с большим range.
  Митигация: использовать relative to initial (`maxDelta / initial > 0.05`).
- **Stall для consumable (ожидаемое падение) — это НЕ pathology**. Митигация:
  различать "expected decay" (consumable) от "stall" (ресурс должен расти,
  но не растёт).

**Dependencies**: TASK-5b.4 (faucet/drain из flows меняет expected growth direction).

---

### TASK-5b.6: Реализовать real Monte Carlo с N runs и детерминированным RNG

**Сложность**: L
**Приоритет**: 🔴 (блокирует воспроизводимость; Bible 6.13.3 Step 8)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 495-582)

**Описание проблемы**:

`simulate` (route.ts:526-545):
```ts
const curves: Record<string, number[]> = {};
const ranges: Record<string, { min: number; max: number }> = {};
let runawayCount = 0;
let stallCount = 0;

for (const r of resources) {  // ← ONE outer loop
  let value = r.initial_value;
  const series: number[] = [];
  let rMax = value;
  let rMin = value;
  for (let t = 0; t < ticks; t++) {  // ← inner tick loop
    const d = faucetDrain[r.name] || { faucet: 0.3, drain: 0.3, ratio: 1 };
    const noise = (Math.random() - 0.5) * 0.2;  // ← Math.random
    value = value + d.faucet - d.drain + noise;
    value = Math.max(r.bounds.min, Math.min(r.bounds.max, value));
    series.push(Number(value.toFixed(2)));
    rMax = Math.max(rMax, value);
    rMin = Math.min(rMin, value);
  }
  curves[r.name] = series;
  ranges[r.name] = { min: Number(rMin.toFixed(2)), max: Number(rMax.toFixed(2)) };
  if (rMax >= r.bounds.max * 0.95) runawayCount++;
  if (rMax <= r.bounds.min + (r.bounds.max - r.bounds.min) * 0.05) stallCount++;
}
```

Проблемы:
1. `config: { ticks, num_runs: 10, recording_interval: 5 }` — `num_runs: 10` FAKE.
   Реальный цикл имеет только `for (resources)` × `for (ticks)`. Нет outer
   loop по `num_runs`, нет агрегации.
2. `Math.random()` — non-deterministic. Результаты не воспроизводимы.
3. `aggregated` misleading — нет усреднения, это single run.

Bible 6.13.3 Step 8: "Запустить тысячу итераций. Собрать статистику: средние
значения ресурсов, скорость роста, точки дисбаланса."

**Решение**:

1. **Добавить детерминированный PRNG (mulberry32)**:
   ```ts
   // В начале route.ts (после interfaces):
   function mulberry32(seed: number): () => number {
     let a = seed >>> 0;
     return function () {
       a = (a + 0x6D2B79F5) >>> 0;
       let t = a;
       t = Math.imul(t ^ (t >>> 15), t | 1);
       t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
   }

   function hashSeed(s: string): number {
     let h = 2166136261;
     for (let i = 0; i < s.length; i++) {
       h ^= s.charCodeAt(i);
       h = Math.imul(h, 16777619);
     }
     return h >>> 0;
   }
   ```

2. **Реализовать real Monte Carlo с N runs**:
   ```ts
   function simulate(
     resources: ResourceDef[],
     faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>,
     ticks: number,
     numRuns: number = 100,
     seed?: number
   ): { ... } {
     // Deterministic seed: hash of resource names + ticks + numRuns
     const baseSeed = seed ?? hashSeed(
       resources.map((r) => r.name).join("|") + `_${ticks}_${numRuns}`
     );
     const rng = mulberry32(baseSeed);

     // Aggregated stats per resource per tick
     const sumCurves: Record<string, number[]> = {};
     const sumSquaresCurves: Record<string, number[]> = {};
     const minAcrossRuns: Record<string, number> = {};
     const maxAcrossRuns: Record<string, number> = {};
     let totalRunaway = 0;
     let totalStall = 0;
     const runawayResources = new Set<string>();
     const stallResources = new Set<string>();

     for (const r of resources) {
       sumCurves[r.name] = new Array(ticks).fill(0);
       sumSquaresCurves[r.name] = new Array(ticks).fill(0);
       minAcrossRuns[r.name] = Infinity;
       maxAcrossRuns[r.name] = -Infinity;
     }

     for (let run = 0; run < numRuns; run++) {
       for (const r of resources) {
         let value = r.initial_value;
         let rMax = value;
         let rMin = value;
         const d = faucetDrain[r.name] || { faucet: 0.3, drain: 0.3, ratio: 1 };
         for (let t = 0; t < ticks; t++) {
           // Deterministic noise
           const noise = (rng() - 0.5) * 0.2 * Math.abs(d.faucet - d.drain + 0.1);
           value = value + d.faucet - d.drain + noise;
           value = Math.max(r.bounds.min, Math.min(r.bounds.max, value));
           sumCurves[r.name][t] += value;
           sumSquaresCurves[r.name][t] += value * value;
           rMax = Math.max(rMax, value);
           rMin = Math.min(rMin, value);
         }
         maxAcrossRuns[r.name] = Math.max(maxAcrossRuns[r.name], rMax);
         minAcrossRuns[r.name] = Math.min(minAcrossRuns[r.name], rMin);

         // Stall/runaway detection (TASK-5b.5)
         const initial = r.initial_value;
         const range = r.bounds.max - r.bounds.min;
         const expectedGrowth = d.faucet - d.drain;
         const relativeDelta = range > 0 ? Math.abs(rMax - initial) / range : 0;
         if (expectedGrowth > 0 && relativeDelta < 0.02) {
           stallResources.add(r.name);
         }
         if (rMax >= r.bounds.max * 0.95) {
           runawayResources.add(r.name);
         }
       }
     }

     // Compute mean and std per tick per resource
     const avgCurves: Record<string, number[]> = {};
     const ranges: Record<string, { min: number; max: number }> = {};
     for (const r of resources) {
       avgCurves[r.name] = sumCurves[r.name].map((s) => Number((s / numRuns).toFixed(2)));
       ranges[r.name] = {
         min: Number(minAcrossRuns[r.name].toFixed(2)),
         max: Number(maxAcrossRuns[r.name].toFixed(2)),
       };
     }

     const runawayFreq = runawayResources.size / Math.max(1, resources.length);
     const stallFreq = stallResources.size / Math.max(1, resources.length);
     const stability = Number(
       Math.max(0, 1 - (runawayFreq + stallFreq) / 2).toFixed(3)
     );
     const buildGap = Number((Math.abs(runawayFreq - stallFreq) / 2).toFixed(3));

     const criticalIssues: string[] = [];
     if (runawayFreq > 0.3) criticalIssues.push("Высокая частота убегания ресурсов");
     if (stallFreq > 0.3) criticalIssues.push("Высокая частота стагнации");

     const quality = {
       resources_in_bounds: runawayFreq < 0.3 && stallFreq < 0.3,
       progression_pacing_ok: buildGap < 0.25,
       no_runaway_for_minmaxer: runawayFreq < 0.4,
       no_stall_for_casual: stallFreq < 0.4,
       build_gap_acceptable: buildGap < 0.25,
       economy_stable: stability > 0.6,
       overall_pass: criticalIssues.length === 0 && stability > 0.6,
       critical_issues: criticalIssues,
     };

     return {
       config: {
         ticks,
         num_runs: numRuns,
         recording_interval: 5,
         seed: baseSeed,  // ← expose seed for reproducibility
         rng: "mulberry32",
       },
       aggregated: {
         avg_resource_curves: avgCurves,
         resource_ranges: ranges,
         runaway_frequency: runawayFreq,
         stall_frequency: stallFreq,
         stability_index: stability,
         build_gap: buildGap,
       },
       quality,
       snapshots_count: ticks * numRuns,  // ← actual snapshots, not just ticks
     };
   }
   ```

3. **Обновить вызов в POST handler** (route.ts:715):
   ```ts
   // Было:
   const simResult = simulate(resources, faucetDrain, 50);
   // Стало:
   const simResult = simulate(resources, faucetDrain, 50, 100, body?.seed);
   ```

4. **Опционально: добавить `num_runs` в body**:
   ```ts
   const numRuns = Math.min(1000, Math.max(1, Number(body?.num_runs) || 100));
   const simResult = simulate(resources, faucetDrain, 50, numRuns, body?.seed);
   ```

**Тест-кейсы**:
- Два вызова с идентичными input + идентичным `seed` → ИДЕНТИЧНЫЕ
  `avg_resource_curves` (детерминизм).
- `num_runs: 100` → `snapshots_count: 5000` (50 ticks × 100 runs).
- `config.seed` возвращается в response.
- `config.rng === "mulberry32"`.
- `Math.random` НЕ вызывается в `simulate` (grep проверка).
- Stability index меняется минимально между запусками с разным seed
  (std < 0.05) — подтверждение сходимости.

**Риски**:
- **Performance**: 100 runs × 50 ticks × 6 resources = 30 000 iterations
  per request. На modern hardware ~10-30ms. Приемлемо.
- **num_runs=1000** может занять 100-300ms. Митигация: cap в 1000, default 100.
- **Seed передается через body** — user can override. Митигация: если seed
  не передан, генерировать из project_id + timestamp (но тогда не воспроизводимо).
  Решение: по умолчанию seed = hash(resource_names + ticks + numRuns).

**Dependencies**: TASK-5b.5 (stall threshold), TASK-5b.4 (faucet/drain из flows).

---

### TASK-5b.7: Деривить economy params из upstream concept/balance в pipeline runners

**Сложность**: L
**Приоритет**: 🔴 (root cause идентичных outputs; блокирует TASK-5b.11, TASK-5b.14)
**Файлы**:
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (строки 146-153)
- `src/app/api/v1/pipeline/run-pipeline/[projectId]/route.ts` (строки 78-83)
- `scripts/run_pipeline_test.sh` (строки 126-132)
- `src/app/api/v1/economy/design/route.ts` (строки 590-597 — fallbacks)

**Описание проблемы**:

`run-full-pipeline/route.ts:146-153`:
```ts
{
  stage: "economy",
  block_id: 5,
  endpoint: "/api/v1/economy/design",
  buildBody: (i) => ({
    use_ai: i.useAi,
  }),
}
```

`run-pipeline/[projectId]/route.ts:78-83`:
```ts
{
  stage: "economy",
  block_id: 5,
  endpoint: "/api/v1/economy/design",
  buildBody: () => ({}),
}
```

`run_pipeline_test.sh:128-131`:
```bash
R=$(curl -s -X POST $API/economy/design \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"project_id\":\"$PID\",\"use_ai\":true}" \
  --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
```

Ни один из источников не передаёт `genre`, `monetization_type`, `openness`.
Route fallback (route.ts:593-596):
```ts
const genre = body?.genre?.toString().trim() || "rpg";
const monetizationType = body?.monetization_type?.toString().trim() || "b2p";
const openness = body?.openness?.toString().trim() || "mixed";
```

Все 10 test_projects получают ИДЕНТИЧНЫЕ defaults → ИДЕНТИЧНЫЙ economy output
(отличаются только `Math.random()` profitability и LLM `ai_insights`).

**Решение**:

1. **Расширить `PipelineInput` interface** в `run-full-pipeline/[projectId]/route.ts`:
   ```ts
   interface PipelineInput {
     ...
     // Block 5b — Economy
     economyGenre?: string;
     economyMonetizationType?: string;
     economyOpenness?: string;
     ...
   }
   ```

2. **Деривить economy params из upstream concept** в `buildBody`:
   ```ts
   {
     stage: "economy",
     block_id: 5,
     endpoint: "/api/v1/economy/design",
     buildBody: (i) => ({
       genre: i.economyGenre || i.conceptGenre || i.projectGenre || "rpg",
       monetization_type: i.economyMonetizationType || i.conceptMonetization || "b2p",
       openness: i.economyOpenness || "mixed",
       use_ai: i.useAi,
     }),
   }
   ```

3. **В `run-full-pipeline` handler деривить concept genre** из upstream project:
   ```ts
   // В начале handleStage loop, перед buildBody:
   if (stage.stage === "economy" && !input.economyGenre) {
     // Загрузить concept для genre
     const concept = await db.projectConcept.findUnique({
       where: { projectId },
       select: { genre: true, subgenre: true },
     });
     if (concept?.genre) {
       input.economyGenre = concept.genre;
       // Деривить monetization из concept.aestheticProfile или usp
       // (пока заглушка — b2p default)
     }
   }
   ```

4. **В `economy/design/route.ts` использовать `proj.concept?.genre` как fallback**:
   ```ts
   // Было (route.ts:593):
   const genre = body?.genre?.toString().trim() || "rpg";
   // Стало:
   const concept = await db.projectConcept.findUnique({
     where: { projectId: proj.id },
     select: { genre: true, subgenre: true, onePagerData: true },
   });
   const genre = body?.genre?.toString().trim()
     || concept?.genre
     || proj.genre
     || "rpg";
   const monetizationType = body?.monetization_type?.toString().trim()
     || deriveMonetizationFromConcept(concept)
     || "b2p";
   const openness = body?.openness?.toString().trim()
     || deriveOpennessFromGenre(genre)
     || "mixed";

   function deriveMonetizationFromConcept(concept: { genre: string; subgenre: string | null; onePagerData: string | null } | null): string | null {
     if (!concept?.onePagerData) return null;
     try {
       const onePager = JSON.parse(concept.onePagerData);
       const text = JSON.stringify(onePager).toLowerCase();
       if (text.includes("free-to-play") || text.includes("f2p") || text.includes("микротранзакц")) return "f2p";
       if (text.includes("подписк") || text.includes("subscription")) return "subscription";
       if (text.includes("космет") || text.includes("cosmetic")) return "cosmetic";
       if (text.includes("pay-to-win") || text.includes("p2w")) return "p2w";
       if (text.includes("гибрид") || text.includes("hybrid")) return "hybrid";
       return null;
     } catch { return null; }
   }

   function deriveOpennessFromGenre(genre: string): string {
     // Open: MMO, strategy, survival (много торговли)
     // Closed: puzzle, platformer, narrative (нет торговли)
     // Mixed: RPG, shooter, action
     const openGenres = ["mmorpg", "strategy", "survival", "sandbox"];
     const closedGenres = ["puzzle", "platformer", "visual_novel", "adventure"];
     const g = genre.toLowerCase();
     if (openGenres.some((x) => g.includes(x))) return "open";
     if (closedGenres.some((x) => g.includes(x))) return "closed";
     return "mixed";
   }
   ```

5. **Обновить `run_pipeline_test.sh`** для передачи GENRES array:
   ```bash
   # Строка 128-131 — было:
   R=$(curl -s -X POST $API/economy/design \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d "{\"project_id\":\"$PID\",\"use_ai\":true}" \
     --max-time 60 2>/dev/null || echo '{"error":"timeout"}')

   # Стало:
   # Map GENRES array to economy genre + monetization_type + openness
   ECONOMY_GENRE=$(echo "${GENRES[$i]}" | tr '[:upper:]' '[:lower:]' | tr ' ' '_')
   case "$ECONOMY_GENRE" in
     rpg) ECO_MON="b2p"; ECO_OPEN="mixed" ;;
     tower_defense|strategy) ECO_MON="b2p"; ECO_OPEN="closed" ;;
     rhythm|puzzle) ECO_MON="b2p"; ECO_OPEN="closed" ;;
     metroidvania) ECO_MON="b2p"; ECO_OPEN="closed" ;;
     shooter) ECO_MON="b2p"; ECO_OPEN="mixed" ;;
     sandbox|simulation) ECO_MON="b2p"; ECO_OPEN="open" ;;
     racing) ECO_MON="b2p"; ECO_OPEN="closed" ;;
     *) ECO_MON="b2p"; ECO_OPEN="mixed" ;;
   esac
   R=$(curl -s -X POST $API/economy/design \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d "{\"project_id\":\"$PID\",\"genre\":\"$ECONOMY_GENRE\",\"monetization_type\":\"$ECO_MON\",\"openness\":\"$ECO_OPEN\",\"use_ai\":true}" \
     --max-time 60 2>/dev/null || echo '{"error":"timeout"}')
   ```

**Тест-кейсы**:
- `run-full-pipeline` для проекта Shadow_Depths (concept.genre = "rpg") →
  economy/design получает `genre: "rpg"` (или из body, или из concept fallback).
- `run-full-pipeline` для проекта Sky_Fortress (concept.genre = "tower_defense") →
  economy/design получает `genre: "tower_defense"` → использует preset для
  tower_defense (после TASK-5b.10) или default fallback.
- `run_pipeline_test.sh` для проекта 03_Rhythm_of_War →
  economy/design получает `genre: "rhythm"`, `monetization_type: "b2p"`,
  `openness: "closed"`.
- Все 10 test_projects после рефакторинга имеют РАЗНЫЕ `classification.genre`
  (rpg, tower_defense, rhythm, puzzle, metroidvania, strategy, sandbox,
  shooter, simulation, racing).
- Все 10 test_projects имеют РАЗНЫЕ resources (после TASK-5b.10 расширяет
  GENRE_RESOURCE_PRESETS до 10+ жанров).
- Прямой POST `/economy/design` без `genre` в body, но с project_id, у
  которого есть concept → route fallback на `concept.genre`.

**Риски**:
- **Existing test_projects fixture data** — после рефакторинга economy
  outputs изменятся. Митигация: regenerate test_projects через
  `run_pipeline_test.sh` после рефакторинга.
- **Concept может не существовать** для проекта (pipeline запущен с stage=5
  напрямую). Митигация: fallback на proj.genre, потом "rpg".
- **`deriveMonetizationFromConcept` эвристики могут быть неточными**.
  Митигация: добавить `monetization_type` в `ProjectConcept` schema
  (опционально, TASK-5b.22).

**Dependencies**: TASK-5b.10 (расширяет GENRE_RESOURCE_PRESETS до 10+ жанров,
иначе передача genre="rhythm" всё равно даст default preset).

---

### TASK-5b.8: Реализовать 6 патологий (Bible 6.10) + adjustments для ВСЕХ 6

**Сложность**: L
**Приоритет**: 🔴 (Bible 6.10; блокирует TASK-5b.9 — 12-point checklist)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 387-445, 454-493)

**Описание проблемы**:

`detectPathologies` (route.ts:387-445) реализует 4 патологии:
- `Инфляция` (ratio > 1.5)
- `Дефляция / Drain` (ratio < 0.5)
- `Стагнация` (faucet < 0.2 && drain < 0.2)
- `Убегание` (catalytic faucet > 1.0)

Bible 6.10 требует 6 патологий:
- 6.10.1 `Инфляция` ✓
- 6.10.2 `Стагнация` (valuta nakaplivaetsya bez vozmozhnosti traty) —
  текущая реализация проверяет faucet<0.2 && drain<0.2, но Bible 6.10.2:
  "валюта накапливается без возможностей траты" → нужно проверять
  `drain == 0 && faucet > 0` (или ratio = Infinity).
- 6.10.3 `Арбитраж` (разница цен для безрисковой прибыли) — НЕ реализовано.
- 6.10.4 `Runaway` (усиливающая петля без балансирующей) ✓ (но диагностика
  упрощённая — только catalytic faucet > 1.0; нужна проверка reinforcing
  loops без balancing counterpart).
- 6.10.5 `Deadlock` (A нужен Б, Б нужен А → ни один не может начаться) — НЕ реализовано.
- 6.10.6 `Stall` (недостаточно ресурсов для продолжения) — текущая
  "Стагнация" частично покрывает, но Bible различает: stall = цикл
  запускался, но ресурсы исчерпались; стагнация = цикл не запускается вообще.

`proposeAdjustments` (route.ts:454-493) обрабатывает только 3 из 4
реализованных патологий (`Инфляция`, `Дефляция / Drain`, `Убегание`).
`Стагнация` silently skipped.

**Решение**:

1. **Расширить `detectPathologies` до 6 патологий**:
   ```ts
   function detectPathologies(
     resources: ResourceDef[],
     faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>,
     conversionGraph: { chains: Array<{ inputs: string[]; outputs: string[]; profitability: number }> },  // ← добавить
     feedbackLoops: FeedbackLoop[]  // ← добавить
   ): Pathology[] {
     const pathologies: Pathology[] = [];

     // 6.10.1 Инфляция: ratio > 1.5
     for (const [name, data] of Object.entries(faucetDrain)) {
       if (data.ratio > 1.5 && Number.isFinite(data.ratio)) {
         pathologies.push({
           name: "Инфляция",
           severity: data.ratio > 2 ? "critical" : "warning",
           description: `Ресурс «${name}» производится быстрее, чем тратится (ratio ${data.ratio.toFixed(2)})`,
           affected_resources: [name],
           correction: `Увеличьте drain «${name}» на ${Math.round((data.ratio - 1) * 100)}% или добавьте sink`,
         });
       }
     }

     // 6.10.2 Стагнация: faucet > 0 && drain == 0 (накапливается без траты)
     for (const [name, data] of Object.entries(faucetDrain)) {
       if (data.faucet > 0 && data.drain === 0 && name !== "drain_sink") {
         pathologies.push({
           name: "Стагнация",
           severity: data.faucet > 0.5 ? "warning" : "info",
           description: `Ресурс «${name}» накапливается без возможностей траты (faucet=${data.faucet.toFixed(2)}, drain=0)`,
           affected_resources: [name],
           correction: "Добавьте sink, расходник или престижный сброс для ресурса",
         });
       }
     }

     // 6.10.3 Арбитраж: цепочка конверсии с profitability > 1.5 (безрисковая прибыль)
     for (const chain of conversionGraph.chains) {
       if (chain.profitability > 1.5) {
         pathologies.push({
           name: "Арбитраж",
           severity: chain.profitability > 2 ? "critical" : "warning",
           description: `Цепочка ${chain.inputs.join("+")} → ${chain.outputs.join("+")} даёт безрисковую прибыль ${chain.profitability.toFixed(2)}`,
           affected_resources: [...chain.inputs, ...chain.outputs],
           correction: "Снизьте выходной rate, увеличьте входной cost, или добавьте commission",
         });
       }
     }

     // 6.10.4 Runaway: reinforcing loop без balancing counterpart
     const reinforcingLoops = feedbackLoops.filter((l) => l.loop_type === "reinforcing");
     const balancingLoops = feedbackLoops.filter((l) => l.loop_type === "balancing");
     for (const loop of reinforcingLoops) {
       // Проверить, есть ли balancing loop, затрагивающий те же ресурсы
       const hasBalancer = balancingLoops.some((b) =>
         b.nodes.some((n) => loop.nodes.includes(n))
       );
       if (!hasBalancer) {
         pathologies.push({
           name: "Убегание",
           severity: "warning",
           description: `Усиливающая петля [${loop.nodes.join("→")}] не имеет балансирующего противовеса`,
           affected_resources: loop.nodes,
           correction: "Добавьте balancing петлю (drain, friction) для ресурсов в цикле",
         });
       }
     }
     // Старая проверка catalytic faucet > 1.0 — оставить как fallback
     for (const r of resources) {
       if (r.is_catalytic) {
         const d = faucetDrain[r.name];
         if (d && d.faucet > 1.0) {
           // Дедуплицировать с runaway-by-loop
           const alreadyFlagged = pathologies.some(
             (p) => p.name === "Убегание" && p.affected_resources.includes(r.name)
           );
           if (!alreadyFlagged) {
             pathologies.push({
               name: "Убегание",
               severity: "warning",
               description: `Катализатор «${r.name}» производит слишком много (${d.faucet.toFixed(2)}/тик)`,
               affected_resources: [r.name],
               correction: "Снизьте rate конвертера или добавьте sink",
             });
           }
         }
       }
     }

     // 6.10.5 Deadlock: ресурс с faucet=0 И нет converters, его производящих
     for (const r of resources) {
       const d = faucetDrain[r.name];
       if (d && d.faucet === 0 && r.initial_value === 0) {
         // Проверить, есть ли конвертер, производящий этот ресурс
         const hasProducer = conversionGraph.chains.some((c) => c.outputs.includes(r.name));
         if (!hasProducer) {
           pathologies.push({
             name: "Deadlock",
             severity: "critical",
             description: `Ресурс «${r.name}» имеет faucet=0 и начальное значение 0, и нет конвертера, его производящего`,
             affected_resources: [r.name],
             correction: "Добавьте source node или converter, производящий ресурс, или дайте стартовый капитал",
           });
         }
       }
     }

     // 6.10.6 Stall: resource с faucet < drain (depleting) и bounds.min = 0
     for (const r of resources) {
       const d = faucetDrain[r.name];
       if (d && d.faucet < d.drain && d.faucet > 0 && r.bounds.min === 0) {
         // Ресурс истощается, но имеет ненулевой faucet (медленная смерть)
         const timeToEmpty = r.initial_value / (d.drain - d.faucet);
         if (timeToEmpty > 0 && timeToEmpty < 100) {  // меньше 100 ticks
           pathologies.push({
             name: "Stall",
             severity: timeToEmpty < 20 ? "critical" : "warning",
             description: `Ресурс «${r.name}» истощится за ~${Math.round(timeToEmpty)} тиков (faucet=${d.faucet.toFixed(2)} < drain=${d.drain.toFixed(2)})`,
             affected_resources: [r.name],
             correction: "Увеличьте faucet или уменьшите drain, или добавьте минимальную регенерацию",
           });
         }
       }
     }

     // Старая "Дефляция / Drain" (ratio < 0.5) — оставить как fallback для non-stall случаев
     for (const [name, data] of Object.entries(faucetDrain)) {
       if (data.ratio < 0.5 && data.ratio > 0 && data.drain > 0) {
         const alreadyFlagged = pathologies.some(
           (p) => p.affected_resources.includes(name) &&
                  ["Stall", "Deadlock"].includes(p.name)
         );
         if (!alreadyFlagged) {
           pathologies.push({
             name: "Дефляция / Drain",
             severity: data.ratio < 0.3 ? "critical" : "warning",
             description: `Ресурс «${name}» тратится быстрее, чем производится (ratio ${data.ratio.toFixed(2)})`,
             affected_resources: [name],
             correction: `Увеличьте faucet «${name}» или снизьте drain на ${Math.round((1 - data.ratio) * 100)}%`,
           });
         }
       }
     }

     return pathologies;
   }
   ```

2. **Расширить `proposeAdjustments` для всех 6 патологий**:
   ```ts
   function proposeAdjustments(
     pathologies: Pathology[],
     faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>,
     conversionGraph: { chains: Array<{ inputs: string[]; outputs: string[]; profitability: number; tier: number }> }
   ): Adjustment[] {
     const adjustments: Adjustment[] = [];
     for (const p of pathologies) {
       if (p.name === "Инфляция") {
         const res = p.affected_resources[0];
         const d = faucetDrain[res];
         adjustments.push({
           resource: res,
           action: "increase_drain",
           current_rate: d.drain,
           new_rate: Number((d.drain * (d.ratio > 2 ? 2.2 : 1.5)).toFixed(2)),
           reason: p.description,
         });
       } else if (p.name === "Дефляция / Drain") {
         const res = p.affected_resources[0];
         const d = faucetDrain[res];
         adjustments.push({
           resource: res,
           action: "increase_faucet",
           current_rate: d.faucet,
           new_rate: Number((d.faucet * (d.ratio < 0.3 ? 2.5 : 1.7)).toFixed(2)),
           reason: p.description,
         });
       } else if (p.name === "Стагнация") {
         const res = p.affected_resources[0];
         const d = faucetDrain[res];
         adjustments.push({
           resource: res,
           action: "add_sink",
           current_rate: d.drain,
           new_rate: Number((d.faucet * 0.8).toFixed(2)),  // 80% от faucet
           reason: p.description,
         });
       } else if (p.name === "Убегание") {
         const res = p.affected_resources[0];
         const d = faucetDrain[res];
         adjustments.push({
           resource: res,
           action: "decrease_faucet",
           current_rate: d.faucet,
           new_rate: Number((d.faucet * 0.7).toFixed(2)),
           reason: p.description,
         });
       } else if (p.name === "Арбитраж") {
         // Найти chain с arbitrage
         const chain = conversionGraph.chains.find(
           (c) => p.affected_resources.includes(...c.inputs) && p.affected_resources.includes(...c.outputs)
         );
         if (chain) {
           adjustments.push({
             resource: chain.outputs[0],
             action: "decrease_output_rate",
             current_rate: chain.profitability,
             new_rate: 1.0,  // целевая прибыльность = 1.0 (безрисковая, но не арбитраж)
             reason: p.description,
           });
         }
       } else if (p.name === "Deadlock") {
         const res = p.affected_resources[0];
         adjustments.push({
           resource: res,
           action: "add_source",
           current_rate: 0,
           new_rate: 0.5,  // базовый faucet
           reason: p.description,
         });
       } else if (p.name === "Stall") {
         const res = p.affected_resources[0];
         const d = faucetDrain[res];
         adjustments.push({
           resource: res,
           action: "increase_faucet",
           current_rate: d.faucet,
           new_rate: Number((d.drain * 1.1).toFixed(2)),  // faucet чуть выше drain
           reason: p.description,
         });
       }
     }
     return adjustments;
   }
   ```

3. **Обновить вызовы в POST handler**:
   ```ts
   // Было:
   const pathologies = detectPathologies(resources, faucetDrain);
   const adjustments = proposeAdjustments(pathologies, faucetDrain);

   // Стало:
   const pathologies = detectPathologies(resources, faucetDrain, conversionGraph, machinations.feedback_loops);
   const adjustments = proposeAdjustments(pathologies, faucetDrain, conversionGraph);
   ```

**Тест-кейсы**:
- Для RPG preset после TASK-5b.4 (faucet/drain из flows):
  - `mana` converter: faucet=0.5 (inflow from xp), drain=0.8 (outflows to gold+hp),
    ratio=0.625 → НЕ inflation (стало 1.0 vs 0.3 = 3.33 было).
  - `drain_sink`: faucet=0.3 (from stamina), drain=0 → ratio=Infinity →
    НЕ патология (сток по определению).
- Для F2P preset с `gems`: faucet=0 (нет source для gems), initial=0 →
  Deadlock pathology (если нет chain, производящего gems).
- Для chain с profitability=1.8 → Арбитраж pathology.
- Для reinforcing loop без balancing counterpart → Убегание.
- Для stamina (faucet=0.2, drain=0.3, initial=10): timeToEmpty=10/0.1=100
  ticks → на границе, НЕ Stall. Если drain=0.5: timeToEmpty=10/0.3=33 → Stall warning.
- `proposeAdjustments` для каждой патологии возвращает ровно 1 adjustment
  с `action` matching патологии.

**Риски**:
- **Дублирование патологий** — `Стагнация` (drain=0) и `Дефляция` (ratio<0.5)
  могут срабатывать одновременно. Митигация: дедупликация через
  `alreadyFlagged` check.
- **`drain_sink` всегда имеет drain=0** — может ложно триггерить Стагнацию.
  Митигация: исключить `drain_sink` из проверки Стагнации (`name !== "drain_sink"`).
- **`Убегание` через reinforcing loop** требует actual feedback_loops с
  реальными node IDs (TASK-5b.2). Без TASK-5b.2 проверка не работает.

**Dependencies**: TASK-5b.2 (feedback_loops с реальными IDs), TASK-5b.3
(profitability из flows), TASK-5b.4 (faucet/drain из flows).

---

### TASK-5b.9: Реализовать 12-point validation checklist (Bible 6.13.4)

**Сложность**: XL
**Приоритет**: 🔴 (Bible 6.13.4 — основной deliverable economy designer)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (новая функция + integrate в response)

**Описание проблемы**:

Bible 6.13.4 требует 12-point checklist:
1. Связность: Все ресурсы достижимы из стартового состояния?
2. Баланс кранов/сливов: Для каждого ресурса суммарный inflow ≈ outflow?
3. Нет runaway: Каждая положительная петля имеет балансирующий противовес?
4. Нет deadlock: Для каждого цикла есть стартовый ресурс?
5. Нет stall: Для каждого убыточного цикла есть внешние источники?
6. Прогрессия определена: Для каждого ядерного ресурса есть кривая прогрессии?
7. Фазы экономики: Есть ли естественные фазы (начальная → рост → зрелость → завершение)?
8. Инфляция под контролем: Есть ли стоки для каждой валюты?
9. Стагнация предотвращена: Есть ли долгосрочные цели траты для каждого ресурса?
10. Арбитраж невозможен: Курс покупки ≤ курс продажи для всех торговых пар?
11. Глубина решений: Есть ли значимые выборы в управлении ресурсами?
12. Доступность: Может ли новичок понять базовый экономический цикл за 5 минут?

В route.ts НЕТ функции `validateEconomy()`. Вместо checklist — `sim_result.quality`
с 7 булевыми полями (resources_in_bounds, progression_pacing_ok,
no_runaway_for_minmaxer, no_stall_for_casual, build_gap_acceptable,
economy_stable, overall_pass) + critical_issues.

**Решение**:

1. **Добавить функцию `validateEconomy`**:
   ```ts
   interface ValidationCheck {
     id: string;
     name: string;
     passed: boolean;
     severity: "ok" | "warning" | "critical";
     description: string;
     details?: string;
   }

   interface EconomyValidation {
     checks: ValidationCheck[];
     overall_score: number;  // 0-100
     critical_count: number;
     warning_count: number;
     passed_count: number;
     recommendations: string[];
   }

   function validateEconomy(
     resources: ResourceDef[],
     machinations: { nodes: MachNode[]; resource_flows: ResourceFlow[]; feedback_loops: FeedbackLoop[] },
     conversionGraph: { chains: Array<{ inputs: string[]; outputs: string[]; profitability: number }> },
     faucetDrain: Record<string, { faucet: number; drain: number; ratio: number }>,
     pathologies: Pathology[],
     simResult: { aggregated: { runaway_frequency: number; stall_frequency: number; stability_index: number } },
     anchor: string
   ): EconomyValidation {
     const checks: ValidationCheck[] = [];

     // 1. Связность: BFS от anchor, проверить достижимость всех ресурсов
     const adj = new Map<string, string[]>();
     for (const f of machinations.resource_flows) {
       if (!adj.has(f.source_id)) adj.set(f.source_id, []);
       adj.get(f.source_id)!.push(f.target_id);
     }
     const visited = new Set<string>([anchor]);
     const queue = [anchor];
     while (queue.length > 0) {
       const node = queue.shift()!;
       for (const next of adj.get(node) || []) {
         if (!visited.has(next)) {
           visited.add(next);
           queue.push(next);
         }
       }
     }
     const unreachable = resources.filter((r) => !visited.has(r.name)).map((r) => r.name);
     checks.push({
       id: "connectivity",
       name: "Связность графа ресурсов",
       passed: unreachable.length === 0,
       severity: unreachable.length > 0 ? "critical" : "ok",
       description: "Все ресурсы достижимы из якорного ресурса через потоки",
       details: unreachable.length > 0 ? `Недостижимы: ${unreachable.join(", ")}` : undefined,
     });

     // 2. Баланс кранов/сливов: |ratio - 1| < 0.3 для каждого ресурса (кроме стоков)
     const unbalanced = Object.entries(faucetDrain)
       .filter(([name, d]) => name !== "drain_sink" && Number.isFinite(d.ratio))
       .filter(([_, d]) => Math.abs(d.ratio - 1) > 0.3);
     checks.push({
       id: "faucet_drain_balance",
       name: "Баланс кранов/сливов",
       passed: unbalanced.length === 0,
       severity: unbalanced.length > resources.length / 2 ? "critical" : "warning",
       description: "Для каждого ресурса суммарный inflow ≈ outflow (ratio в диапазоне 0.7-1.3)",
       details: unbalanced.length > 0
         ? `Несбалансированы: ${unbalanced.map(([n, d]) => `${n}(${d.ratio.toFixed(2)})`).join(", ")}`
         : undefined,
     });

     // 3. Нет runaway: каждая reinforcing петля имеет balancing counterpart
     const reinforcingLoops = machinations.feedback_loops.filter((l) => l.loop_type === "reinforcing");
     const balancingLoops = machinations.feedback_loops.filter((l) => l.loop_type === "balancing");
     const unbalancedLoops = reinforcingLoops.filter((r) =>
       !balancingLoops.some((b) => b.nodes.some((n) => r.nodes.includes(n)))
     );
     checks.push({
       id: "no_runaway",
       name: "Нет убегания (runaway)",
       passed: unbalancedLoops.length === 0 && !pathologies.some((p) => p.name === "Убегание"),
       severity: unbalancedLoops.length > 0 ? "warning" : "ok",
       description: "Каждая усиливающая петля имеет балансирующий противовес",
       details: unbalancedLoops.length > 0
         ? `Без балансира: ${unbalancedLoops.length} усиливающих петель`
         : undefined,
     });

     // 4. Нет deadlock: каждый ресурс с faucet=0 имеет producer (converter) или initial_value > 0
     const deadlocks = resources.filter((r) => {
       const d = faucetDrain[r.name];
       return d && d.faucet === 0 && r.initial_value === 0 &&
         !conversionGraph.chains.some((c) => c.outputs.includes(r.name));
     });
     checks.push({
       id: "no_deadlock",
       name: "Нет взаимной блокировки (deadlock)",
       passed: deadlocks.length === 0 && !pathologies.some((p) => p.name === "Deadlock"),
       severity: deadlocks.length > 0 ? "critical" : "ok",
       description: "Для каждого цикла есть стартовый ресурс или альтернативный путь",
       details: deadlocks.length > 0
         ? `Deadlock: ${deadlocks.map((r) => r.name).join(", ")}`
         : undefined,
     });

     // 5. Нет stall: для каждого убыточного цикла есть внешние источники
     const stalls = pathologies.filter((p) => p.name === "Stall");
     checks.push({
       id: "no_stall",
       name: "Нет остановки (stall)",
       passed: stalls.length === 0 && simResult.aggregated.stall_frequency < 0.3,
       severity: stalls.length > 0 || simResult.aggregated.stall_frequency >= 0.5 ? "critical" : "warning",
       description: "Для каждого убыточного цикла есть внешние источники ресурсов",
       details: stalls.length > 0
         ? `Stall: ${stalls.map((s) => s.affected_resources.join(",")).join("; ")}`
         : `stall_frequency=${simResult.aggregated.stall_frequency.toFixed(2)}`,
     });

     // 6. Прогрессия определена: каждый ядерный ресурс имеет кривую прогрессии
     // (пока что проверяем, что у каждого core ресурса есть bounds.max > initial_value)
     const coreResources = resources.filter((r) => r.resource_class === "core");
     const noProgression = coreResources.filter((r) => r.bounds.max <= r.initial_value);
     checks.push({
       id: "progression_defined",
       name: "Прогрессия определена для ядерных ресурсов",
       passed: noProgression.length === 0,
       severity: noProgression.length > 0 ? "warning" : "ok",
       description: "Для каждого ядерного ресурса есть кривая прогрессии (bounds.max > initial_value)",
       details: noProgression.length > 0
         ? `Без прогрессии: ${noProgression.map((r) => r.name).join(", ")}`
         : undefined,
     });

     // 7. Фазы экономики: проверка на наличие ≥3 фаз (через simulation curve patterns)
     // Фаза = отрезок симуляции с разным трендом (рост/стабильность/падение)
     const phasesCount = countEconomicPhases(simResult);
     checks.push({
       id: "economic_phases",
       name: "Наличие экономических фаз",
       passed: phasesCount >= 3,
       severity: phasesCount < 2 ? "warning" : "ok",
       description: "Есть ли естественные фазы (начальная → рост → зрелость → завершение)",
       details: `Обнаружено фаз: ${phasesCount}`,
     });

     // 8. Инфляция под контролем: каждая валюта имеет drain > 0
     const currencies = resources.filter((r) => r.resource_class === "currency");
     const inflationRisks = currencies.filter((r) => {
       const d = faucetDrain[r.name];
       return d && d.drain === 0;
     });
     checks.push({
       id: "inflation_control",
       name: "Инфляция под контролем",
       passed: inflationRisks.length === 0,
       severity: inflationRisks.length > 0 ? "warning" : "ok",
       description: "Есть ли стоки для каждой валюты",
       details: inflationRisks.length > 0
         ? `Без стоков: ${inflationRisks.map((r) => r.name).join(", ")}`
         : undefined,
     });

     // 9. Стагнация предотвращена: каждый ресурс имеет хотя бы один consumer
     const stagnators = resources.filter((r) => {
       const d = faucetDrain[r.name];
       return d && d.drain === 0 && r.resource_class !== "currency";  // currency checked in #8
     });
     checks.push({
       id: "stagnation_prevention",
       name: "Стагнация предотвращена",
       passed: stagnators.length === 0,
       severity: stagnators.length > 0 ? "warning" : "ok",
       description: "Есть ли долгосрочные цели траты для каждого ресурса",
       details: stagnators.length > 0
         ? `Без потребителей: ${stagnators.map((r) => r.name).join(", ")}`
         : undefined,
     });

     // 10. Арбитраж невозможен: для всех conversion chains profitability ≤ 1.2
     const arbitrageChains = conversionGraph.chains.filter((c) => c.profitability > 1.2);
     checks.push({
       id: "no_arbitrage",
       name: "Арбитраж невозможен",
       passed: arbitrageChains.length === 0,
       severity: arbitrageChains.length > 0 ? "warning" : "ok",
       description: "Курс покупки ≤ курс продажи для всех торговых пар (profitability ≤ 1.2)",
       details: arbitrageChains.length > 0
         ? `Арбитражные цепочки: ${arbitrageChains.map((c) => `${c.inputs.join("+")}→${c.outputs.join("+")}(${c.profitability.toFixed(2)})`).join("; ")}`
         : undefined,
     });

     // 11. Глубина решений: ≥2 conversion chains ИЛИ ≥1 multi-input converter
     const multiInputChains = conversionGraph.chains.filter((c) => c.inputs.length > 1);
     checks.push({
       id: "decision_depth",
       name: "Глубина решений в управлении ресурсами",
       passed: conversionGraph.chains.length >= 2 || multiInputChains.length > 0,
       severity: conversionGraph.chains.length < 2 ? "info" : "ok",
       description: "Есть ли значимые выборы в управлении ресурсами (≥2 chains или multi-input)",
       details: `chains=${conversionGraph.chains.length}, multi-input=${multiInputChains.length}`,
     });

     // 12. Доступность: ресурсов ≤ 7 (правило Миллера 7±2)
     checks.push({
       id: "accessibility",
       name: "Доступность для новичка",
       passed: resources.length <= 7,
       severity: resources.length > 10 ? "warning" : resources.length > 7 ? "info" : "ok",
       description: "Может ли новичок понять базовый экономический цикл за 5 минут (≤7 ресурсов)",
       details: `resources=${resources.length}`,
     });

     // Aggregate
     const criticalCount = checks.filter((c) => c.severity === "critical").length;
     const warningCount = checks.filter((c) => c.severity === "warning").length;
     const passedCount = checks.filter((c) => c.passed).length;
     const overallScore = Math.round((passedCount / checks.length) * 100);

     const recommendations: string[] = [];
     for (const c of checks) {
       if (!c.passed) {
         recommendations.push(`[${c.id}] ${c.description}: ${c.details || "требует внимания"}`);
       }
     }

     return {
       checks,
       overall_score: overallScore,
       critical_count: criticalCount,
       warning_count: warningCount,
       passed_count: passedCount,
       recommendations,
     };
   }

   function countEconomicPhases(simResult: { aggregated: { avg_resource_curves: Record<string, number[]> } }): number {
     // Упрощённая эвристика: посчитать "переломные точки" в anchor curve
     const anchorCurve = Object.values(simResult.aggregated.avg_resource_curves)[0];
     if (!anchorCurve || anchorCurve.length < 5) return 1;

     let phases = 1;
     let lastTrend: "up" | "down" | "flat" = "flat";
     for (let i = 1; i < anchorCurve.length; i++) {
       const delta = anchorCurve[i] - anchorCurve[i - 1];
       const trend = delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat";
       if (trend !== lastTrend && trend !== "flat") {
         phases++;
         lastTrend = trend;
       }
     }
     return Math.min(phases, 5);  // cap at 5
   }
   ```

2. **Интегрировать в response**:
   ```ts
   // В POST handler, после simulate:
   const validation = validateEconomy(
     resources, machinations, conversionGraph, faucetDrain, pathologies, simResult, anchor
   );

   // Добавить в result:
   result.validation = validation;
   ```

3. **Обновить `EconomyDesignResponse` type**:
   ```ts
   // В src/types/economy.ts добавить:
   export interface EconomyDesignResponse {
     ...
     validation: {
       checks: Array<{
         id: string;
         name: string;
         passed: boolean;
         severity: "ok" | "warning" | "critical";
         description: string;
         details?: string;
       }>;
       overall_score: number;
       critical_count: number;
       warning_count: number;
       passed_count: number;
       recommendations: string[];
     };
     ...
   }
   ```

**Тест-кейсы**:
- Для RPG preset после всех рефакторингов: `validation.checks.length === 12`.
- `validation.overall_score` в диапазоне 0-100.
- `validation.passed_count + validation.critical_count + validation.warning_count <= 12`.
- Check `connectivity` passed если все ресурсы достижимы.
- Check `no_deadlock` passed если нет ресурсов с faucet=0 и initial=0 без producer.
- Check `no_arbitrage` passed если все chains имеют profitability ≤ 1.2.
- Check `accessibility` passed если resources.length ≤ 7.
- После рефакторинга все 10 test_projects имеют РАЗНЫЕ `validation.overall_score`
  (т.к. genre/monetization/openness теперь разные — TASK-5b.7).

**Риски**:
- **`countEconomicPhases` эвристика упрощённая** — может давать ложные
  срабатывания на зашумлённых кривых. Митигация: использовать сглаживание
  (moving average) перед определением trend.
- **`accessibility` check `resources.length <= 7`** — для strategy preset
  (4 core + 3 subsidiary = 7) проходит; для mmorpg preset (3 core + 3
  subsidiary = 6) проходит; для F2P (4 core + 3 subsidiary + 1 currency = 8)
  — warning. Митигация: возможно, исключить currency из счёта (т.к. это
  "meta" ресурс).
- **`decision_depth` check может fail для простых economies** (puzzle, rhythm).
  Митигация: severity "info" для < 2 chains, не "warning".

**Dependencies**: TASK-5b.2 (feedback_loops), TASK-5b.3 (profitability),
TASK-5b.4 (faucet/drain), TASK-5b.8 (6 pathologies), TASK-5b.6 (real simulation).

---

### TASK-5b.10: Расширить `GENRE_RESOURCE_PRESETS` до 10+ жанров + параметризовать resource class assignment

**Сложность**: L
**Приоритет**: 🔴 (Bible 6.5.1, 6.12; блокирует TASK-5b.7)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 98-126, 627-641)

**Описание проблемы**:

`GENRE_RESOURCE_PRESETS` (route.ts:98-126) имеет только 5 жанров + default:
```ts
const GENRE_RESOURCE_PRESETS: Record<string, { core: string[]; subsidiary: string[] }> = {
  rpg: { core: ["xp", "gold", "hp"], subsidiary: ["mana", "stamina", "materials"] },
  shooter: { core: ["score", "ammo", "armor"], subsidiary: ["credits", "scrap", "intel"] },
  strategy: { core: ["wood", "food", "gold", "stone"], subsidiary: ["population", "research", "favor"] },
  mmorpg: { core: ["gold", "xp", "reputation"], subsidiary: ["honor", "tokens", "crafting_mats"] },
  idle: { core: ["coins", "gems", "energy"], subsidiary: ["prestige_points", "automation", "research"] },
  default: { core: ["score", "currency", "energy"], subsidiary: ["materials", "tokens"] },
};
```

Не покрыты (из 10 test_projects): `tower_defense`, `rhythm`, `puzzle`,
`metroidvania`, `sandbox`, `simulation`, `racing`, `deck_builder`,
`roguelike`, `horror`, `survival`, `platformer`, `fighting`, `adventure`.

`is_catalytic = i % 2 === 0`, `is_consumable = i % 3 === 1` (route.ts:629-630) —
modulo-based, не зависит от actual resource semantics. Для всех presets с
3 subsidiary: [catalytic, consumable, catalytic] — одинаковая структура для всех жанров.

Bible 6.12 требует жанро-специфичные ресурсы:
- RPG: HP, mana, опыт, золото, предметы, навыки
- RTS: золото/минералы, дерево/газ, юниты, территории, технологии
- FPS: здоровье, боеприпасы, оружие, позиция
- Survival: голод, жажда, здоровье, материалы, энергия
- MMO: золото, опыт, снаряжение, репутация, социальный капитал
- F2P/Mobile: энергия, софтвалюта, хардвалюта, очки опыта, cosmetic токены

**Решение**:

1. **Расширить `GENRE_RESOURCE_PRESETS` до 15 жанров**:
   ```ts
   interface ResourcePreset {
     core: Array<{ name: string; resource_class: string; resource_type: string; initial: number; max: number; is_anchor?: boolean }>;
     subsidiary: Array<{ name: string; resource_class: string; resource_type: string; initial: number; max: number; is_catalytic?: boolean; is_consumable?: boolean }>;
     dominant_loop: string;  // Bible 6.8.3
     economic_subsystem: string;  // Bible 6.12
   }

   const GENRE_RESOURCE_PRESETS: Record<string, ResourcePreset> = {
     rpg: {
       core: [
         { name: "xp", resource_class: "core", resource_type: "experience", initial: 100, max: 1000, is_anchor: true },
         { name: "gold", resource_class: "currency", resource_type: "currency", initial: 50, max: 10000 },
         { name: "hp", resource_class: "core", resource_type: "hp", initial: 100, max: 9999 },
       ],
       subsidiary: [
         { name: "mana", resource_class: "subsidiary", resource_type: "magic", initial: 10, max: 500, is_catalytic: true },
         { name: "stamina", resource_class: "consumable", resource_type: "consumable", initial: 10, max: 500, is_consumable: true },
         { name: "materials", resource_class: "subsidiary", resource_type: "crafting", initial: 10, max: 500, is_catalytic: true },
       ],
       dominant_loop: "positive_constructive",
       economic_subsystem: "rpg_combat_progression",
     },
     shooter: {
       core: [
         { name: "score", resource_class: "core", resource_type: "score", initial: 0, max: 99999, is_anchor: true },
         { name: "ammo", resource_class: "consumable", resource_type: "consumable", initial: 30, max: 200, is_consumable: true },
         { name: "armor", resource_class: "core", resource_type: "defense", initial: 100, max: 100 },
       ],
       subsidiary: [
         { name: "credits", resource_class: "currency", resource_type: "currency", initial: 0, max: 10000, is_catalytic: true },
         { name: "scrap", resource_class: "subsidiary", resource_type: "crafting", initial: 0, max: 500, is_catalytic: true },
         { name: "intel", resource_class: "meta", resource_type: "meta", initial: 0, max: 100 },
       ],
       dominant_loop: "negative_destructive_positive_recovery",
       economic_subsystem: "fps_resource_scarcity",
     },
     strategy: {
       core: [
         { name: "gold", resource_class: "currency", resource_type: "currency", initial: 100, max: 99999, is_anchor: true },
         { name: "wood", resource_class: "core", resource_type: "material", initial: 50, max: 9999 },
         { name: "food", resource_class: "core", resource_type: "consumable", initial: 50, max: 9999, is_consumable: true },
         { name: "stone", resource_class: "core", resource_type: "material", initial: 30, max: 9999 },
       ],
       subsidiary: [
         { name: "population", resource_class: "meta", resource_type: "meta", initial: 5, max: 200 },
         { name: "research", resource_class: "subsidiary", resource_type: "tech", initial: 0, max: 1000, is_catalytic: true },
         { name: "favor", resource_class: "subsidiary", resource_type: "meta", initial: 0, max: 100 },
       ],
       dominant_loop: "arms_race_positive_constructive",
       economic_subsystem: "rts_engine_building",
     },
     mmorpg: {
       core: [
         { name: "gold", resource_class: "currency", resource_type: "currency", initial: 100, max: 999999, is_anchor: true },
         { name: "xp", resource_class: "core", resource_type: "experience", initial: 100, max: 999999 },
         { name: "reputation", resource_class: "subsidiary", resource_type: "social", initial: 0, max: 1000 },
       ],
       subsidiary: [
         { name: "honor", resource_class: "subsidiary", resource_type: "social", initial: 0, max: 5000, is_catalytic: true },
         { name: "tokens", resource_class: "currency", resource_type: "currency", initial: 0, max: 1000, is_catalytic: true },
         { name: "crafting_mats", resource_class: "subsidiary", resource_type: "crafting", initial: 10, max: 9999, is_consumable: true },
       ],
       dominant_loop: "complex_hierarchy_micro_meso_macro_meta",
       economic_subsystem: "mmo_inflation_prone",
     },
     idle: {
       core: [
         { name: "coins", resource_class: "currency", resource_type: "currency", initial: 0, max: 1e12, is_anchor: true },
         { name: "gems", resource_class: "currency", resource_type: "premium_currency", initial: 0, max: 99999 },
         { name: "energy", resource_class: "consumable", resource_type: "energy", initial: 100, max: 100, is_consumable: true },
       ],
       subsidiary: [
         { name: "prestige_points", resource_class: "meta", resource_type: "meta", initial: 0, max: 1000, is_catalytic: true },
         { name: "automation", resource_class: "subsidiary", resource_type: "tech", initial: 0, max: 100, is_catalytic: true },
         { name: "research", resource_class: "subsidiary", resource_type: "tech", initial: 0, max: 1000 },
       ],
       dominant_loop: "exponential_growth_prestige_reset",
       economic_subsystem: "idle_f2p_dual_currency",
     },
     // НОВЫЕ ЖАНРЫ:
     tower_defense: {
       core: [
         { name: "gold", resource_class: "currency", resource_type: "currency", initial: 100, max: 9999, is_anchor: true },
         { name: "lives", resource_class: "core", resource_type: "hp", initial: 20, max: 20 },
         { name: "wave", resource_class: "core", resource_type: "progress", initial: 1, max: 50 },
       ],
       subsidiary: [
         { name: "tower_slots", resource_class: "meta", resource_type: "meta", initial: 5, max: 20, is_catalytic: true },
         { name: "upgrades", resource_class: "subsidiary", resource_type: "tech", initial: 0, max: 100, is_catalytic: true },
         { name: "ammo", resource_class: "consumable", resource_type: "consumable", initial: 100, max: 999, is_consumable: true },
       ],
       dominant_loop: "escalating_challenge_static_friction",
       economic_subsystem: "td_wave_economy",
     },
     puzzle: {
       core: [
         { name: "score", resource_class: "core", resource_type: "score", initial: 0, max: 99999, is_anchor: true },
         { name: "moves", resource_class: "consumable", resource_type: "turns", initial: 30, max: 30, is_consumable: true },
       ],
       subsidiary: [
         { name: "hints", resource_class: "consumable", resource_type: "consumable", initial: 3, max: 10, is_consumable: true },
         { name: "stars", resource_class: "meta", resource_type: "meta", initial: 0, max: 300, is_catalytic: true },
       ],
       dominant_loop: "positive_progress_negative_errors",
       economic_subsystem: "puzzle_score_economy",
     },
     metroidvania: {
       core: [
         { name: "hp", resource_class: "core", resource_type: "hp", initial: 100, max: 999, is_anchor: true },
         { name: "ability_points", resource_class: "core", resource_type: "experience", initial: 0, max: 100 },
       ],
       subsidiary: [
         { name: "keys", resource_class: "subsidiary", resource_type: "key_item", initial: 0, max: 20, is_catalytic: true },
         { name: "energy_tanks", resource_class: "subsidiary", resource_type: "upgrade", initial: 0, max: 10, is_catalytic: true },
         { name: "missiles", resource_class: "consumable", resource_type: "ammo", initial: 10, max: 250, is_consumable: true },
       ],
       dominant_loop: "lock_key_progression",
       economic_subsystem: "metroidvania_gated_exploration",
     },
     rhythm: {
       core: [
         { name: "score", resource_class: "core", resource_type: "score", initial: 0, max: 999999, is_anchor: true },
         { name: "combo", resource_class: "core", resource_type: "streak", initial: 0, max: 999 },
         { name: "beat_energy", resource_class: "consumable", resource_type: "energy", initial: 100, max: 100, is_consumable: true },
       ],
       subsidiary: [
         { name: "stars", resource_class: "meta", resource_type: "meta", initial: 0, max: 300, is_catalytic: true },
         { name: "unlock_tokens", resource_class: "currency", resource_type: "currency", initial: 0, max: 999, is_catalytic: true },
       ],
       dominant_loop: "escalating_complexity_rhythm",
       economic_subsystem: "rhythm_score_economy",
     },
     sandbox: {
       core: [
         { name: "blocks", resource_class: "core", resource_type: "material", initial: 100, max: 99999, is_anchor: true },
         { name: "time", resource_class: "core", resource_type: "time", initial: 0, max: 999999 },
       ],
       subsidiary: [
         { name: "tools", resource_class: "subsidiary", resource_type: "upgrade", initial: 1, max: 50, is_catalytic: true },
         { name: "blueprints", resource_class: "meta", resource_type: "meta", initial: 0, max: 500, is_catalytic: true },
         { name: "materials", resource_class: "subsidiary", resource_type: "material", initial: 50, max: 9999, is_consumable: true },
       ],
       dominant_loop: "engine_building_player_driven",
       economic_subsystem: "sandbox_creative_economy",
     },
     simulation: {
       core: [
         { name: "money", resource_class: "currency", resource_type: "currency", initial: 1000, max: 9999999, is_anchor: true },
         { name: "population", resource_class: "core", resource_type: "population", initial: 100, max: 100000 },
       ],
       subsidiary: [
         { name: "happiness", resource_class: "subsidiary", resource_type: "meta", initial: 50, max: 100, is_catalytic: true },
         { name: "resources", resource_class: "core", resource_type: "material", initial: 500, max: 99999, is_consumable: true },
         { name: "tech_level", resource_class: "meta", resource_type: "tech", initial: 1, max: 100, is_catalytic: true },
       ],
       dominant_loop: "engine_building_ecological_balance",
       economic_subsystem: "sim_city_builder",
     },
     racing: {
       core: [
         { name: "credits", resource_class: "currency", resource_type: "currency", initial: 5000, max: 999999, is_anchor: true },
         { name: "nitro", resource_class: "consumable", resource_type: "energy", initial: 100, max: 100, is_consumable: true },
       ],
       subsidiary: [
         { name: "car_parts", resource_class: "subsidiary", resource_type: "upgrade", initial: 0, max: 50, is_catalytic: true },
         { name: "rep", resource_class: "subsidiary", resource_type: "social", initial: 0, max: 9999, is_catalytic: true },
         { name: "tickets", resource_class: "consumable", resource_type: "consumable", initial: 5, max: 50, is_consumable: true },
       ],
       dominant_loop: "positive_constructive_car_progression",
       economic_subsystem: "racing_upgrade_economy",
     },
     deck_builder: {
       core: [
         { name: "gold", resource_class: "currency", resource_type: "currency", initial: 50, max: 9999, is_anchor: true },
         { name: "cards", resource_class: "core", resource_type: "collection", initial: 10, max: 500 },
         { name: "deck_slots", resource_class: "meta", resource_type: "meta", initial: 30, max: 30 },
       ],
       subsidiary: [
         { name: "mana", resource_class: "consumable", resource_type: "energy", initial: 1, max: 10, is_consumable: true },
         { name: "dust", resource_class: "subsidiary", resource_type: "crafting", initial: 0, max: 9999, is_catalytic: true },
         { name: "packs", resource_class: "consumable", resource_type: "consumable", initial: 1, max: 99, is_consumable: true },
       ],
       dominant_loop: "positive_constructive_card_pool_growth",
       economic_subsystem: "deck_builder_craft_economy",
     },
     survival: {
       core: [
         { name: "hp", resource_class: "core", resource_type: "hp", initial: 100, max: 100, is_anchor: true },
         { name: "hunger", resource_class: "consumable", resource_type: "vital", initial: 100, max: 100, is_consumable: true },
         { name: "thirst", resource_class: "consumable", resource_type: "vital", initial: 100, max: 100, is_consumable: true },
       ],
       subsidiary: [
         { name: "wood", resource_class: "subsidiary", resource_type: "material", initial: 10, max: 999, is_catalytic: true },
         { name: "food", resource_class: "consumable", resource_type: "consumable", initial: 5, max: 99, is_consumable: true },
         { name: "tools", resource_class: "subsidiary", resource_type: "upgrade", initial: 1, max: 20, is_catalytic: true },
       ],
       dominant_loop: "negative_balancing_vicious_circle",
       economic_subsystem: "survival_ecology",
     },
     default: {
       core: [
         { name: "score", resource_class: "core", resource_type: "score", initial: 0, max: 99999, is_anchor: true },
         { name: "currency", resource_class: "currency", resource_type: "currency", initial: 50, max: 9999 },
         { name: "energy", resource_class: "consumable", resource_type: "energy", initial: 100, max: 100, is_consumable: true },
       ],
       subsidiary: [
         { name: "materials", resource_class: "subsidiary", resource_type: "material", initial: 10, max: 500, is_catalytic: true },
         { name: "tokens", resource_class: "subsidiary", resource_type: "meta", initial: 0, max: 999 },
       ],
       dominant_loop: "core_economy_loop",
       economic_subsystem: "generic_economy",
     },
   };
   ```

2. **Обновить `pickResources` для нормализации genre**:
   ```ts
   function pickResources(genre: string): ResourcePreset {
     const normalized = genre.trim().toLowerCase().replace(/[\s-]/g, "_");
     // Aliases
     const aliases: Record<string, string> = {
       rpgs: "rpg",
       fps: "shooter",
       rts: "strategy",
       moba: "strategy",
       tbs: "strategy",
       "tower-defense": "tower_defense",
       td: "tower_defense",
       card: "deck_builder",
       ccg: "deck_builder",
       tcg: "deck_builder",
       rogue: "roguelike",
       rogue_lite: "roguelike",
       sim: "simulation",
       tycoon: "simulation",
     };
     const key = aliases[normalized] || normalized;
     return GENRE_RESOURCE_PRESETS[key] || GENRE_RESOURCE_PRESETS.default;
   }
   ```

3. **Переписать resource inventory generation** (route.ts:610-654):
   ```ts
   const preset = pickResources(genre);
   const resources: ResourceDef[] = [];

   for (const c of preset.core) {
     resources.push({
       name: c.name,
       resource_class: c.resource_class,
       resource_type: c.resource_type,
       initial_value: c.initial,
       bounds: { min: 0, max: c.max },
       is_consumable: c.resource_class === "consumable",
       is_catalytic: false,
       is_anchor: c.is_anchor ?? false,
     });
   }
   for (const s of preset.subsidiary) {
     resources.push({
       name: s.name,
       resource_class: s.resource_class,
       resource_type: s.resource_type,
       initial_value: s.initial,
       bounds: { min: 0, max: s.max },
       is_consumable: s.is_consumable ?? false,
       is_catalytic: s.is_catalytic ?? false,
       is_anchor: false,
     });
   }
   // Premium currency for F2P/Hybrid
   if (monetizationType === "f2p" || monetizationType === "hybrid") {
     resources.push({
       name: "gems",
       resource_class: "currency",
       resource_type: "premium_currency",
       initial_value: 0,
       bounds: { min: 0, max: 99999 },
       is_consumable: false,
       is_catalytic: false,
       is_anchor: false,
     });
   }

   const anchor = preset.core.find((c) => c.is_anchor)?.name || preset.core[0].name;
   const coreCount = resources.filter((r) => r.resource_class === "core").length;
   const subsidiaryCount = resources.filter((r) => r.resource_class === "subsidiary").length;
   ```

4. **Использовать `preset.dominant_loop` в classification**:
   ```ts
   // В classifySystemType:
   const dominantLoopName = preset.dominant_loop || (hasMeta ? "meta_loop" : "core_economy_loop");
   ```

**Тест-кейсы**:
- `pickResources("rpg")` → preset с core: [xp, gold, hp], subsidiary: [mana, stamina, materials].
- `pickResources("RPG")` → то же (uppercase).
- `pickResources(" rpg ")` → то же (whitespace).
- `pickResources("Tower Defense")` → preset для `tower_defense` (через alias + normalize).
- `pickResources("nonexistent")` → default preset.
- Для `genre="tower_defense"`: resources = [gold, lives, wave, tower_slots, upgrades, ammo].
  `anchor = "gold"`, `dominant_loop = "escalating_challenge_static_friction"`.
- Для `genre="puzzle"`: resources = [score, moves, hints, stars]. `anchor = "score"`.
- `subsidiary_count` для RPG = 3 (только subsidiary class), не 4 или 5.

**Риски**:
- **Объём данных** — 15 жанров × ~6 ресурсов × 8 полей = 720 значений.
  Митигация: вынести в отдельный файл `src/constants/economy-presets.ts`.
- **Aliases могут не покрыть все варианты** (например, "RPG-game", "JRPG").
  Митигация: substring matching как fallback.
- **`is_anchor` для некоторых жанров не очевиден** (например, для racing —
  credits или car_parts?). Митигация: documented choice в комментарии.

**Dependencies**: нет (но TASK-5b.7 зависит от неё — иначе genre="rhythm"
всё равно даст default preset).

---

### TASK-5b.11: Реализовать 16+ Machinations patterns (Bible 6.4.1) с metadata

**Сложность**: L
**Приоритет**: 🟡 (Bible 6.4.1; enhances `structural_patterns` usefulness)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 305-310, новая библиотека)

**Описание проблемы**:

`buildMachinations` (route.ts:305-310) генерирует `structural_patterns`:
```ts
const patterns: string[] = [];
patterns.push("source_pool_drain");
if (resources.some((r) => r.is_catalytic)) patterns.push("converter_chain");
if (resources.some((r) => r.is_consumable)) patterns.push("consumable_burn");
if (classification.type === "Ecology") patterns.push("ecological_balance");
if (classification.type === "Engine") patterns.push("engine_accumulator");
```

Только 5 абстрактных имён, не из Bible 6.4.1 библиотеки. Bible требует 16+
паттернов с metadata:
- **Engines**: Static Engine, Dynamic Engine, Converter Engine, Engine Building
- **Friction**: Static Friction, Dynamic Friction, Stopping Mechanism, Attrition
- **Escalation**: Escalating Challenge, Escalating Complexity, Arms Race
- **Other**: Play-Style Reinforcement, Multiple Feedback, Trade, Worker Placement, Slow Cycle

**Решение**:

1. **Создать библиотеку Machinations patterns** в новом файле
   `src/constants/machinations-patterns.ts`:
   ```ts
   export type MachinationsPatternCategory = "engine" | "friction" | "escalation" | "other";

   export interface MachinationsPattern {
     id: string;
     name: string;
     category: MachinationsPatternCategory;
     description: string;
     when_to_use: string;
     required_node_types: string[];  // ["source", "pool", "converter", ...]
     typical_pathologies: string[];  // ["runaway", "stall", ...]
     bible_ref: string;  // "6.4.1"
   }

   export const MACHINATIONS_PATTERNS: MachinationsPattern[] = [
     // Engines
     {
       id: "static_engine",
       name: "Static Engine",
       category: "engine",
       description: "Постоянный, предсказуемый поток ресурсов",
       when_to_use: "Стабильная базовая экономика (зарплата каждый ход, фиксированный доход)",
       required_node_types: ["source", "pool"],
       typical_pathologies: ["stagnation"],
       bible_ref: "6.4.1",
     },
     {
       id: "dynamic_engine",
       name: "Dynamic Engine",
       category: "engine",
       description: "Поток ресурсов, который можно улучшать/апгрейдить",
       when_to_use: "Игрок инвестирует в рост (RTS-харвестеры, фабрики, апгрейды добычи)",
       required_node_types: ["source", "pool", "converter"],
       typical_pathologies: ["runaway"],
       bible_ref: "6.4.1",
     },
     {
       id: "converter_engine",
       name: "Converter Engine",
       category: "engine",
       description: "Два конвертера в цикле, создающие излишек",
       when_to_use: "Петля роста через преобразование (руд → золото → постройка → больше рудника)",
       required_node_types: ["converter", "pool"],
       typical_pathologies: ["runaway", "arbitrage"],
       bible_ref: "6.4.1",
     },
     {
       id: "engine_building",
       name: "Engine Building",
       category: "engine",
       description: "Игрок сам конструирует свою экономику",
       when_to_use: "Экономика — часть творчества (Civilization, Factorio, Stellaris)",
       required_node_types: ["source", "pool", "converter", "gate"],
       typical_pathologies: ["deadlock", "runaway"],
       bible_ref: "6.4.1",
     },
     // Friction
     {
       id: "static_friction",
       name: "Static Friction",
       category: "friction",
       description: "Постоянное сопротивление/сток ресурсов",
       when_to_use: "Фиксированные расходы (налог каждый ход, содержание войск, аренда)",
       required_node_types: ["drain", "pool"],
       typical_pathologies: ["stall"],
       bible_ref: "6.4.1",
     },
     {
       id: "dynamic_friction",
       name: "Dynamic Friction",
       category: "friction",
       description: "Сопротивление, масштабирующееся с уровнем ресурсов",
       when_to_use: "Замедление лидера (подоходный налог, усложнение на высоких уровнях, rubber-banding)",
       required_node_types: ["drain", "pool", "state_connection"],
       typical_pathologies: ["stall"],
       bible_ref: "6.4.1",
     },
     {
       id: "stopping_mechanism",
       name: "Stopping Mechanism",
       category: "friction",
       description: "Жёсткий потолок, останавливающий производство",
       when_to_use: "Абсолютный лимит (максимум юнитов, население города, вместимость склада)",
       required_node_types: ["pool", "gate"],
       typical_pathologies: ["stagnation"],
       bible_ref: "6.4.1",
     },
     {
       id: "attrition",
       name: "Attrition",
       category: "friction",
       description: "Ресурсы потребляются с нарастающей скоростью",
       when_to_use: "Эскалация давления (износ оборудования, рост расходов, старение юнитов)",
       required_node_types: ["drain", "pool", "state_connection"],
       typical_pathologies: ["stall", "deadlock"],
       bible_ref: "6.4.1",
     },
     // Escalation
     {
       id: "escalating_challenge",
       name: "Escalating Challenge",
       category: "escalation",
       description: "Препятствия становятся сложнее",
       when_to_use: "Прогрессирующий pacing (волны врагов, уровни сложности, рейды)",
       required_node_types: ["source", "gate", "drain"],
       typical_pathologies: ["stall"],
       bible_ref: "6.4.1",
     },
     {
       id: "escalating_complexity",
       name: "Escalating Complexity",
       category: "escalation",
       description: "Система становится сложнее со временем",
       when_to_use: "Давление принятия решений (Tetris — скорость растёт, RTS — больше юнитов)",
       required_node_types: ["pool", "state_connection"],
       typical_pathologies: ["stall"],
       bible_ref: "6.4.1",
     },
     {
       id: "arms_race",
       name: "Arms Race",
       category: "escalation",
       description: "Конкурирующие игроки эскалируют друг против друга",
       when_to_use: "PvP-баланс (многоуровневые стратегии, гонка технологий)",
       required_node_types: ["source", "pool", "converter", "drain"],
       typical_pathologies: ["runaway", "arbitrage"],
       bible_ref: "6.4.1",
     },
     // Other
     {
       id: "play_style_reinforcement",
       name: "Play-Style Reinforcement",
       category: "other",
       description: "Долгосрочная стратегическая приверженность вознаграждается",
       when_to_use: "Игроки, выбравшие специализацию, получают бонусы за углубление",
       required_node_types: ["pool", "state_connection"],
       typical_pathologies: ["stagnation"],
       bible_ref: "6.4.1",
     },
     {
       id: "multiple_feedback",
       name: "Multiple Feedback",
       category: "other",
       description: "Несколько одновременных петель обратной связи",
       when_to_use: "Создаёт богатую динамику, но сложнее в балансировке",
       required_node_types: ["pool", "converter", "drain", "state_connection"],
       typical_pathologies: ["runaway", "stall", "arbitrage"],
       bible_ref: "6.4.1",
     },
     {
       id: "trade",
       name: "Trade",
       category: "other",
       description: "Обмен между игроками или ресурсными системами",
       when_to_use: "Создаёт социальную динамику и возникающие курсы обмена",
       required_node_types: ["trader", "pool"],
       typical_pathologies: ["arbitrage", "inflation"],
       bible_ref: "6.4.1",
     },
     {
       id: "worker_placement",
       name: "Worker Placement",
       category: "other",
       description: "Распределение ограниченных действий",
       when_to_use: "Конкуренция за дефицитные слоты создаёт напряжение",
       required_node_types: ["pool", "gate", "queue"],
       typical_pathologies: ["deadlock"],
       bible_ref: "6.4.1",
     },
     {
       id: "slow_cycle",
       name: "Slow Cycle",
       category: "other",
       description: "Периодические, предсказуемые фазовые изменения",
       when_to_use: "День/ночь, сезоны, экономические циклы — добавляет стратегическую глубину",
       required_node_types: ["source", "pool", "delay"],
       typical_pathologies: ["stagnation"],
       bible_ref: "6.4.1",
     },
   ];

   // Helper: detect which patterns are present in a machinations graph
   export function detectPatterns(
     nodes: Array<{ node_type: string }>,
     hasConverter: boolean,
     hasConsumable: boolean,
     hasMeta: boolean,
     classificationType: string
   ): string[] {
     const nodeTypes = new Set(nodes.map((n) => n.node_type));
     const detected: string[] = [];

     // Static Engine: any source node
     if (nodeTypes.has("source")) detected.push("static_engine");
     // Dynamic Engine: source + converter
     if (nodeTypes.has("source") && nodeTypes.has("converter")) detected.push("dynamic_engine");
     // Converter Engine: 2+ converters
     const converterCount = nodes.filter((n) => n.node_type === "converter").length;
     if (converterCount >= 2) detected.push("converter_engine");
     // Engine Building: source + converter + gate (extended)
     if (nodeTypes.has("source") && nodeTypes.has("converter") && nodeTypes.has("gate")) {
       detected.push("engine_building");
     }
     // Static Friction: any drain
     if (nodeTypes.has("drain")) detected.push("static_friction");
     // Dynamic Friction: drain + state_connection (TODO: check state_connections)
     // Stopping Mechanism: pool with capacity
     const poolsWithCap = nodes.filter((n) => n.node_type === "pool" && n.capacity !== null).length;
     if (poolsWithCap > 0) detected.push("stopping_mechanism");
     // Attrition: drain + state_connection (TODO)
     // Escalating Challenge: for tower_defense / wave-based
     // Escalating Complexity: for puzzle / rhythm
     // Arms Race: for strategy / PvP
     // Multiple Feedback: 2+ feedback loops
     // Slow Cycle: delay node

     // Legacy compatibility:
     if (nodeTypes.has("source") && nodeTypes.has("pool") && nodeTypes.has("drain")) {
       detected.push("source_pool_drain");  // legacy
     }
     if (hasConverter) detected.push("converter_chain");  // legacy
     if (hasConsumable) detected.push("consumable_burn");  // legacy
     if (classificationType === "Ecology") detected.push("ecological_balance");  // legacy
     if (classificationType === "Engine") detected.push("engine_accumulator");  // legacy

     return [...new Set(detected)];
   }
   ```

2. **Использовать `detectPatterns` в `buildMachinations`**:
   ```ts
   // В buildMachinations, заменить строки 305-310:
   const patterns = detectPatterns(
     nodes,
     resources.some((r) => r.is_catalytic),
     resources.some((r) => r.is_consumable),
     resources.some((r) => r.resource_class === "meta"),
     classification.type
   );
   ```

3. **Опционально: добавить `pattern_metadata` в response**:
   ```ts
   // В result:
   result.machinations_model.pattern_details = patterns
     .map((id) => MACHINATIONS_PATTERNS.find((p) => p.id === id))
     .filter(Boolean);
   ```

**Тест-кейсы**:
- Для RPG preset: `structural_patterns` содержит как минимум
  `static_engine`, `static_friction`, `stopping_mechanism`, `converter_chain`
  (legacy), `source_pool_drain` (legacy).
- `MACHINATIONS_PATTERNS.length === 16`.
- `detectPatterns` для nodes=[source, pool, converter, drain] →
  `["static_engine", "dynamic_engine", "static_friction", "source_pool_drain", "converter_chain"]`.
- `pattern_details` содержит objects с `id`, `name`, `category`, `bible_ref`.

**Риски**:
- **`detectPatterns` эвристики приблизительные** — некоторые patterns
  (Dynamic Friction, Attrition, Escalating Challenge, Slow Cycle) требуют
  state_connections или delay nodes, которые route не генерирует. Митигация:
  расширить `buildMachinations` для генерации state_connections per pattern.
- **Backward compat**: UI компоненты могут ожидать legacy pattern names
  (`source_pool_drain`). Митигация: сохранить legacy names alongside new.

**Dependencies**: нет (но обогащает TASK-5b.9 — validation может использовать
pattern metadata для рекомендаций).

---

### TASK-5b.12: Реализовать 8-мерный профиль петли ОС (Bible 6.8.2)

**Сложность**: M
**Приоритет**: 🟡 (Bible 6.8.2; расширяет `feedback_loops` до полного профиля)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (interface `FeedbackLoop`, функция `buildMachinations`), `src/types/economy.ts`

**Описание проблемы**:

`FeedbackLoop` interface (route.ts:75-80):
```ts
interface FeedbackLoop {
  nodes: string[];
  loop_type: string;       // reinforcing/balancing
  strength: number;
  description: string;
}
```

Только 4 поля. Bible 6.8.2 требует 8 характеристик:
1. Type (positive/negative)
2. Effect (constructive/destructive)
3. Investment (float)
4. Return (float)
5. Speed (instant/delayed)
6. Duration (one-shot/permanent)
7. Indirectness (direct/indirect)
8. Determinism (deterministic/probabilistic)

**Решение**:

1. **Расширить `FeedbackLoop` interface**:
   ```ts
   interface FeedbackLoopProfile {
     type: "positive" | "negative";          // reinforcing=positive, balancing=negative
     effect: "constructive" | "destructive";  // growth vs decay
     investment: number;                       // сколько вкладывается (sum of input rates)
     return: number;                           // сколько возвращается (sum of output rates)
     speed: "instant" | "delayed";             // есть ли delay node
     duration: "one_shot" | "permanent";       // single fire или continuous
     indirectness: "direct" | "indirect";      // длина цикла: 1-2 = direct, 3+ = indirect
     determinism: "deterministic" | "probabilistic";  // есть ли gate с probability
   }

   interface FeedbackLoop {
     nodes: string[];
     loop_type: string;  // reinforcing | balancing (legacy alias for type)
     strength: number;
     description: string;
     profile: FeedbackLoopProfile;  // ← new field
   }
   ```

2. **Вычислять `profile` для каждого feedback loop в `buildMachinations`**:
   ```ts
   function computeLoopProfile(
     loop: { nodes: string[]; loop_type: string },
     flows: ResourceFlow[],
     stateConnections: StateConnection[],
     nodes: MachNode[]
   ): FeedbackLoopProfile {
     // Type: reinforcing → positive, balancing → negative
     const type: "positive" | "negative" =
       loop.loop_type === "reinforcing" ? "positive" : "negative";

     // Effect: если петля через source/converter → constructive (рост),
     // если через drain → destructive
     const nodeTypesInLoop = loop.nodes
       .map((id) => nodes.find((n) => n.id === id)?.node_type)
       .filter(Boolean) as string[];
     const hasDrain = nodeTypesInLoop.includes("drain");
     const hasSourceOrConverter = nodeTypesInLoop.includes("source") || nodeTypesInLoop.includes("converter");
     const effect: "constructive" | "destructive" =
       hasDrain && !hasSourceOrConverter ? "destructive" : "constructive";

     // Investment: sum of flow rates INTO the loop (from outside)
     const loopNodeSet = new Set(loop.nodes);
     const inflows = flows.filter(
       (f) => !loopNodeSet.has(f.source_id) && loopNodeSet.has(f.target_id)
     );
     const investment = Number(inflows.reduce((s, f) => s + f.rate, 0).toFixed(2));

     // Return: sum of flow rates OUT of the loop (to outside)
     const outflows = flows.filter(
       (f) => loopNodeSet.has(f.source_id) && !loopNodeSet.has(f.target_id)
     );
     const returnVal = Number(outflows.reduce((s, f) => s + f.rate, 0).toFixed(2));

     // Speed: delayed если в loop есть delay node (или state_connection with delay)
     const hasDelay = nodeTypesInLoop.includes("delay") ||
       stateConnections.some((sc) =>
         loopNodeSet.has(sc.source_id) && sc.formula.toLowerCase().includes("delay")
       );
     const speed: "instant" | "delayed" = hasDelay ? "delayed" : "instant";

     // Duration: permanent (continuous) по умолчанию; one_shot если gate с probability
     const hasGate = nodeTypesInLoop.includes("gate");
     const duration: "one_shot" | "permanent" = hasGate ? "one_shot" : "permanent";

     // Indirectness: direct для длины 1-2, indirect для 3+
     const uniqueNodes = new Set(loop.nodes).size;
     const indirectness: "direct" | "indirect" = uniqueNodes <= 2 ? "direct" : "indirect";

     // Determinism: probabilistic если есть gate с probability, иначе deterministic
     const determinism: "deterministic" | "probabilistic" = hasGate ? "probabilistic" : "deterministic";

     return { type, effect, investment, return: returnVal, speed, duration, indirectness, determinism };
   }
   ```

3. **Использовать в `buildMachinations`**:
   ```ts
   // После формирования feedbackLoops:
   for (const loop of feedbackLoops) {
     loop.profile = computeLoopProfile(loop, flows, stateConns, nodes);
   }
   ```

4. **Обновить `EconomyDesignResponse` type**:
   ```ts
   // В src/types/economy.ts:
   machinations_model: {
     ...
     feedback_loops: Array<{
       nodes: string[];
       loop_type: string;
       strength: number;
       description: string;
       profile: {
         type: "positive" | "negative";
         effect: "constructive" | "destructive";
         investment: number;
         return: number;
         speed: "instant" | "delayed";
         duration: "one_shot" | "permanent";
         indirectness: "direct" | "indirect";
         determinism: "deterministic" | "probabilistic";
       };
     }>;
     ...
   }
   ```

5. **Diagnostic for runaway-prone loops** (Bible 6.8.2 diagnostic pattern):
   ```ts
   // В detectPathologies (TASK-5b.8):
   // Bible 6.8.2: "Положительная, конструктивная, низкая инвестиция, высокая отдача,
   // мгновенная, постоянная, прямая, детерминированная петля — почти гарантированно вызовет runaway"
   for (const loop of feedbackLoops) {
     if (!loop.profile) continue;
     const p = loop.profile;
     const isRunawayProne =
       p.type === "positive" &&
       p.effect === "constructive" &&
       p.investment < 0.5 &&
       p.return > 1.0 &&
       p.speed === "instant" &&
       p.duration === "permanent" &&
       p.indirectness === "direct" &&
       p.determinism === "deterministic";
     if (isRunawayProne) {
       pathologies.push({
         name: "Убегание",
         severity: "critical",
         description: `Петля [${loop.nodes.join("→")}] имеет 8-мерный профиль, типичный для runaway (Bible 6.8.2)`,
         affected_resources: loop.nodes,
         correction: "Добавьте задержку (delay), увеличьте инвестицию, или сделайте петлю вероятностной",
       });
     }
   }
   ```

**Тест-кейсы**:
- Для каждого feedback_loop: `profile` содержит все 8 полей.
- Reinforcing loop → `profile.type === "positive"`.
- Balancing loop через drain_sink → `profile.type === "negative"`,
  `profile.effect === "destructive"`.
- Loop с 1-2 nodes → `profile.indirectness === "direct"`.
- Loop с 3+ nodes → `profile.indirectness === "indirect"`.
- Loop без gate → `profile.determinism === "deterministic"`,
  `profile.duration === "permanent"`.
- Runaway-prone loop (все 8 условий Bible 6.8.2) → triggers critical
  `Убегание` pathology.

**Риски**:
- **`investment` и `return` могут быть 0** для loops без external flows
  (циклы полностью внутренние). Митигация: если 0, fallback на sum of
  internal rates.
- **`delay` и `gate` node_types не генерируются** в текущем `buildMachinations`.
  Митигация: расширить `buildMachinations` (опционально, TASK-5b.11 dependency),
  или всегда возвращать `speed: "instant"`, `duration: "permanent"`,
  `determinism: "deterministic"` для текущих графов.

**Dependencies**: TASK-5b.2 (feedback_loops с реальными node IDs — иначе
`computeLoopProfile` не может найти nodes).

---

### TASK-5b.13: Реализовать 6 Schreiber economic system types в `pricing_type` (Bible 6.4.3)

**Сложность**: M
**Приоритет**: 🟡 (Bible 6.4.3; enriches classification)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 169-176, `classifySystemType`)

**Описание проблемы**:

`classifySystemType` (route.ts:169-176):
```ts
const pricingType =
  monetization === "f2p"
    ? "dual_currency"
    : monetization === "subscription"
      ? "subscription_sink"
      : monetization === "cosmetic"
        ? "cosmetic_only"
        : "single_purchase";
```

Только 4 типа. Bible 6.4.3 требует 6:
1. **Fixed** — разработчик устанавливает все цены
2. **Player-dynamic market** — аукцион WoW, торговля в Catan
3. **F2P dual-currency** — софтвалюта + хардвалюта
4. **Prestige cosmetic** — косметика за деньги
5. **Real-money** — азартные игры, регулируется
6. **Mixed** — комбинация нескольких

**Решение**:

1. **Расширить `pricing_type` до 6 типов**:
   ```ts
   type PricingType =
     | "fixed"                          // Bible 6.4.3 #1
     | "player_dynamic_market"          // Bible 6.4.3 #2
     | "f2p_dual_currency"              // Bible 6.4.3 #3
     | "prestige_cosmetic"              // Bible 6.4.3 #4
     | "real_money"                     // Bible 6.4.3 #5
     | "mixed";                         // Bible 6.4.3 #6

   function derivePricingType(
     monetization: string,
     openness: string
   ): PricingType {
     // F2P → dual currency (софт + хард)
     if (monetization === "f2p") return "f2p_dual_currency";
     // Cosmetic → prestige cosmetic
     if (monetization === "cosmetic") return "prestige_cosmetic";
     // P2W → mixed (fixed prices + real money advantages)
     if (monetization === "p2w") return "mixed";
     // Hybrid → mixed
     if (monetization === "hybrid") return "mixed";
     // Subscription + open → player_dynamic_market (аукцион)
     if (monetization === "subscription" && openness === "open") return "player_dynamic_market";
     // Subscription + closed/mixed → fixed (NPC economy)
     if (monetization === "subscription") return "fixed";
     // B2P + open → player_dynamic_market
     if (monetization === "b2p" && openness === "open") return "player_dynamic_market";
     // B2P + closed/mixed → fixed
     return "fixed";
   }
   ```

2. **Использовать в `classifySystemType`**:
   ```ts
   // Заменить строки 169-176:
   const pricingType = derivePricingType(monetization, openness);
   ```

3. **Добавить `real_money` detection** (если в body передан `real_money: true`):
   ```ts
   // В POST handler:
   const isRealMoney = body?.real_money === true;
   ...
   // После classifySystemType:
   if (isRealMoney) {
     (classification as Record<string, unknown>).pricing_type = "real_money";
     (classification as Record<string, unknown>).regulatory_warning =
       "Экономика с реальными деньгами требует лицензии и регулируется (Bible 6.4.3 #5)";
   }
   ```

4. **Обновить `monetizationModel` в persist** для соответствия 6 типам:
   ```ts
   // В db.projectEconomy.upsert, monetizationModel:
   monetizationModel: JSON.stringify({
     type: monetizationType,
     pricing_type: classification.pricing_type,
     primary_revenue:
       monetizationType === "f2p"
         ? ["iap", "ads"]
         : monetizationType === "subscription"
           ? ["subscription"]
           : monetizationType === "cosmetic"
             ? ["cosmetic_iap"]
             : monetizationType === "p2w"
               ? ["iap", "pay_to_win"]
               : monetizationType === "hybrid"
                 ? ["purchase", "iap", "cosmetic"]
                 : ["purchase"],
     secondary_revenue:
       monetizationType === "f2p" ? ["battle_pass"] :
       monetizationType === "subscription" ? ["dlc"] :
       [],
     ethical_concerns:
       monetizationType === "p2w" ? ["pay_to_win"] :
       monetizationType === "f2p" ? ["addiction_risk", "predatory_monetization"] :
       [],
     bible_ref: "6.4.3",
   }),
   ```

**Тест-кейсы**:
- `monetization="f2p"` → `pricing_type === "f2p_dual_currency"`.
- `monetization="cosmetic"` → `pricing_type === "prestige_cosmetic"`.
- `monetization="b2p", openness="open"` → `pricing_type === "player_dynamic_market"`.
- `monetization="b2p", openness="closed"` → `pricing_type === "fixed"`.
- `monetization="p2w"` → `pricing_type === "mixed"`,
  `ethical_concerns` включает `"pay_to_win"`.
- `body.real_money === true` → `pricing_type === "real_money"`,
  `regulatory_warning` присутствует.

**Риски**:
- **`real_money` flag** может быть случайно передан. Митигация: warning в
  response, не block request.
- **`ethical_concerns` для F2P** — `addiction_risk` может быть слишком
  строгим. Митигация: оставить только `predatory_monetization` как
  warning-level concern.

**Dependencies**: нет.

---

### TASK-5b.14: Реализовать genre-specific dominant loops (Bible 6.8.3)

**Сложность**: M
**Приоритет**: 🟡 (Bible 6.8.3; enriches classification)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 165, `classifySystemType`)

**Описание проблемы**:

`classifySystemType` (route.ts:165):
```ts
const dominantLoopName = hasMeta ? "meta_loop" : "core_economy_loop";
```

Только 2 варианта. Bible 6.8.3 требует жанровые профили:
- RPG → positive constructive (xp→level→skills→more xp)
- RTS → positive constructive + negative destructive (arms race)
- FPS → negative destructive (damage) + positive (healthkits)
- Puzzle → positive + negative (errors → rollback)
- Survival → negative balancing (hunger) + reinforcing (gear)
- MMO → complex hierarchy (micro/meso/macro/meta)

**Решение**:

1. **Добавить genre-specific dominant loops в `GENRE_RESOURCE_PRESETS`**
   (см. TASK-5b.10 — уже добавлено поле `dominant_loop`).

2. **Использовать `preset.dominant_loop` в `classifySystemType`**:
   ```ts
   // Изменить signature:
   function classifySystemType(
     resources: ResourceDef[],
     openness: string,
     monetization: string,
     genre: string,  // ← добавить
     presetDominantLoop?: string  // ← добавить
   ): { ... } {
     ...
     // Было:
     // const dominantLoopName = hasMeta ? "meta_loop" : "core_economy_loop";
     // Стало:
     const dominantLoopName = presetDominantLoop
       || (hasMeta ? "meta_loop" : "core_economy_loop");
     ...
   }
   ```

3. **Передать `preset.dominant_loop` из POST handler**:
   ```ts
   const preset = pickResources(genre);
   const classification = classifySystemType(
     resources, openness, monetizationType, genre, preset.dominant_loop
   );
   ```

4. **Добавить `dominant_loop_description` в classification**:
   ```ts
   const DOMINANT_LOOP_DESCRIPTIONS: Record<string, string> = {
     positive_constructive: "RPG-стиль: инвестиция → прокачка → больше возможностей (Bible 6.8.3 RPG)",
     arms_race_positive_constructive: "RTS-стиль: больше ресурсов → больше войск → победы (Bible 6.8.3 RTS)",
     negative_destructive_positive_recovery: "FPS-стиль: урон → меньше HP → аптечка → восстановление (Bible 6.8.3 FPS)",
     positive_progress_negative_errors: "Puzzle-стиль: решение части → прогресс; ошибки → откат (Bible 6.8.3 Puzzle)",
     negative_balancing_vicious_circle: "Survival-стиль: голод → поиск еды → насыщение (Bible 6.8.3 Survival)",
     complex_hierarchy_micro_meso_macro_meta: "MMO-стиль: микро (бой) → мезо (данжен) → макро (прогрессия) → мета (рейд) (Bible 6.8.3 MMO)",
     exponential_growth_prestige_reset: "Idle-стиль: экспоненциальный рост + престижный сброс",
     escalating_challenge_static_friction: "Tower Defense-стиль: волны + трение",
     lock_key_progression: "Metroidvania-стиль: ключи → замки → новые области",
     escalating_complexity_rhythm: "Rhythm-стиль: скорость растёт со временем",
     engine_building_player_driven: "Sandbox-стиль: игрок сам строит экономику",
     engine_building_ecological_balance: "Simulation-стиль: балансирующие петли экосистемы",
     positive_constructive_car_progression: "Racing-стиль: кредиты → апгрейды → победы",
     positive_constructive_card_pool_growth: "Deck-builder-стиль: карты → больше карт → комбинации",
     core_economy_loop: "Базовый цикл: производство → потребление",
     meta_loop: "Мета-цикл: долгосрочная прогрессия",
   };

   (classification as Record<string, unknown>).dominant_loop_description =
     DOMINANT_LOOP_DESCRIPTIONS[dominantLoopName] || "Custom loop";
   ```

**Тест-кейсы**:
- Для `genre="rpg"`: `dominant_loop === "positive_constructive"`,
  `dominant_loop_description` содержит "RPG-стиль".
- Для `genre="shooter"`: `dominant_loop === "negative_destructive_positive_recovery"`.
- Для `genre="strategy"`: `dominant_loop === "arms_race_positive_constructive"`.
- Для `genre="survival"`: `dominant_loop === "negative_balancing_vicious_circle"`.
- Для unknown genre: `dominant_loop === "core_economy_loop"` (default).

**Риски**:
- **`preset.dominant_loop` может быть undefined** для default preset.
  Митигация: fallback на `hasMeta ? "meta_loop" : "core_economy_loop"`.
- **Описания могут устареть** при изменении Bible. Митигация: вынести в
  `src/constants/economy.ts` (или новый `dominant-loops.ts`).

**Dependencies**: TASK-5b.10 (genre presets с `dominant_loop` field).

---

### TASK-5b.15: Перенести AI enrichment ДО persist + добавить `aiInsights`, `modelsUsed` в DB schema

**Сложность**: S
**Приоритет**: 🔴 (блокирует TASK-5b.1 — без этого `ai_insights` не сохраняется)
**Файлы**:
- `src/app/api/v1/economy/design/route.ts` (строки 739-814)
- `prisma/schema.prisma` (модель `ProjectEconomy`, строки 257-279)
- `src/app/api/v1/economy/[projectId]/route.ts` (GET response)

**Описание проблемы**:

AI enrichment вызывается ПОСЛЕ persist (route.ts:739-814):
```ts
// 1. Persist (строки 740-799)
await db.projectEconomy.upsert({
  ...
  fullProfile: JSON.stringify(result),  // ← БЕЗ ai_insights
});

// 2. Update stage (строка 801)
await updateProjectStage(proj.id, "economy");

// 3. AI enrichment (строки 804-814) — ПОСЛЕ persist
if (useAi) {
  const aiInsights = await enrichProgression({ ... });
  if (aiInsights) {
    result.ai_insights = aiInsights;  // ← добавляется в response, но НЕ в БД
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
return NextResponse.json(result);
```

`fullProfile` в БД сохранён БЕЗ `ai_insights`. GET `/economy/[projectId]`
возвращает `full_profile` из БД → `ai_insights` всегда `undefined` через GET.

DB schema `ProjectEconomy` (prisma/schema.prisma:257-279) НЕ имеет `aiInsights`
или `modelsUsed` полей.

**Решение**:

1. **Перенести AI enrichment ДО persist**:
   ```ts
   // Было (строки 739-814):
   // 1. Build result (без ai_insights)
   // 2. Persist
   // 3. AI enrichment → добавить в result
   // 4. Return result

   // Стало:
   // 1. Build result (без ai_insights)
   // 2. AI enrichment → добавить в result (если useAi)
   // 3. Persist (с ai_insights в result → fullProfile содержит ai_insights)
   // 4. Return result

   const result: Record<string, unknown> = {
     id: proj.id,
     inventory,
     classification,
     machinations_model: machinations,
     conversion_graph: conversionGraph,
     diagnostics,
     balance,
     sim_result: simResult,
     stages_completed: stagesCompleted,
     latency_ms: latencyMs,
     models_used: [
       "deterministic-economy-v1",
       "machinations-builder-v1",
       "pathology-detector-v1",
       "monte-carlo-sim-v1",
     ],
   };

   // --- Optional AI enrichment (BEFORE persist) ---
   if (useAi) {
     const aiInsights = await enrichEconomy({ ... });  // TASK-5b.1
     if (aiInsights) {
       result.ai_insights = aiInsights;
       (result.models_used as string[]).push("glm-4.6 (economy-enrichment)");
     }
   }

   // --- Persist (with ai_insights in result) ---
   await db.projectEconomy.upsert({
     where: { projectId: proj.id },
     create: {
       projectId: proj.id,
       systemType: classification.type,
       resourceCount: resources.length,
       hasPathology: pathologies.length > 0,
       inputData: JSON.stringify({ genre, monetization_type: monetizationType, openness }),
       resourceModel: JSON.stringify(inventory),
       machinationsModel: JSON.stringify(machinations),
       conversionChains: JSON.stringify(conversionGraph),
       pathologies: JSON.stringify(pathologies),
       corrections: JSON.stringify(adjustments),
       simulationResults: JSON.stringify(simResult),
       monetizationModel: JSON.stringify({ ... }),
       fullProfile: JSON.stringify(result),  // ← теперь содержит ai_insights
       aiInsights: result.ai_insights ? String(result.ai_insights) : null,  // ← new field
       modelsUsed: JSON.stringify(result.models_used),  // ← new field
     },
     update: { /* same fields */ },
   });

   await updateProjectStage(proj.id, "economy");
   return NextResponse.json(result);
   ```

2. **Добавить поля в Prisma schema**:
   ```prisma
   model ProjectEconomy {
     id                String   @id @default(cuid())
     projectId         String   @unique
     systemType        String?
     resourceCount     Int?
     hasPathology      Boolean  @default(false)
     inputData         String?
     resourceModel     String?
     machinationsModel String?
     conversionChains  String?
     pathologies       String?
     corrections       String?
     simulationResults String?
     monetizationModel String?
     fullProfile       String?
     aiInsights        String?  // ← NEW: AI enrichment text
     modelsUsed        String?  // ← NEW: JSON array of model names
     createdAt         DateTime @default(now())
     updatedAt         DateTime @updatedAt

     project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

     @@index([systemType])
     @@map("project_economies")
   }
   ```

3. **Создать Prisma migration**:
   ```bash
   npx prisma migrate dev --name add_economy_ai_insights_models_used
   ```

4. **Обновить GET `/economy/[projectId]`** для возврата `ai_insights` и `models_used`:
   ```ts
   // В src/app/api/v1/economy/[projectId]/route.ts:
   return NextResponse.json({
     id: e.id,
     project_id: e.projectId,
     system_type: e.systemType,
     resource_count: e.resourceCount,
     has_pathology: e.hasPathology,
     resource_model: safeJsonParse(e.resourceModel || "{}", {}),
     machinations_model: safeJsonParse(e.machinationsModel || "{}", {}),
     conversion_chains: safeJsonParse(e.conversionChains || "[]", []),
     pathologies: safeJsonParse(e.pathologies || "[]", []),
     corrections: safeJsonParse(e.corrections || "[]", []),
     simulation_results: safeJsonParse(e.simulationResults || "{}", {}),
     monetization_model: safeJsonParse(e.monetizationModel || "{}", {}),
     full_profile: safeJsonParse(e.fullProfile || "{}", {}),
     input_data: safeJsonParse(e.inputData || "{}", {}),
     ai_insights: e.aiInsights,  // ← NEW
     models_used: safeJsonParse(e.modelsUsed || "[]", []),  // ← NEW
     created_at: e.createdAt.toISOString(),
     updated_at: e.updatedAt.toISOString(),
   });
   ```

**Тест-кейсы**:
- POST `/economy/design` с `use_ai: true` → response содержит `ai_insights`.
- GET `/economy/[projectId]` для проекта с `use_ai: true` → возвращает
  `ai_insights` (не null).
- GET `/economy/[projectId]` для проекта с `use_ai: false` →
  `ai_insights: null`.
- `models_used` в GET содержит массив строк (включая `"glm-4.6 (economy-enrichment)"` если useAi).
- Prisma migration применена без ошибок.
- После повторного запуска (`use_ai: true`) `ai_insights` обновляется
  (upsert перезаписывает).

**Риски**:
- **AI enrichment latency (2-5s) теперь блокирует persist**. Митигация:
  persist всё равно выполняется после enrichment; общий latency
  увеличивается на 2-5s. Приемлемо для interactive use.
- **DB migration может потребовать down-time**. Митигация: поля nullable,
  backward compatible.
- **`aiInsights` text может быть большой** (1-5KB). Митигация: TEXT column
  в Postgres (уже String? в Prisma → TEXT).

**Dependencies**: TASK-5b.1 (нужно `enrichEconomy` чтобы было что
сохранять; хотя бы без AI enrichment, persist+return всё равно работает).

---

### TASK-5b.16: Унифицировать POST/GET response shape + убрать hardcoded `stages_completed`

**Сложность**: M
**Приоритет**: 🟡 (consistency; UI/UX impact)
**Файлы**:
- `src/app/api/v1/economy/design/route.ts` (response shape)
- `src/app/api/v1/economy/[projectId]/route.ts` (GET response shape)
- `src/types/economy.ts` (canonical type)

**Описание проблемы**:

POST и GET возвращают РАЗНЫЕ shapes:
- **POST** (route.ts:720-737): `id`, `inventory`, `classification`,
  `machinations_model`, `conversion_graph`, `diagnostics`, `balance`,
  `sim_result`, `stages_completed`, `latency_ms`, `models_used`.
- **GET** (route.ts:26-43 in [projectId]/route.ts): `id`, `project_id`,
  `system_type`, `resource_count`, `has_pathology`, `resource_model`,
  `machinations_model`, `conversion_chains`, `pathologies`, `corrections`,
  `simulation_results`, `monetization_model`, `full_profile`, `input_data`,
  `created_at`, `updated_at`.

Несовместимые ключи:
- `inventory` (POST) vs `resource_model` (GET)
- `classification` (POST) vs `system_type`+`input_data` (GET)
- `conversion_graph` (POST) vs `conversion_chains` (GET)
- `diagnostics` (POST) vs `pathologies`+`has_pathology` (GET)
- `balance` (POST) vs `corrections` (GET)
- `sim_result` (POST) vs `simulation_results` (GET)
- `ai_insights`, `models_used`, `latency_ms`, `stages_completed` — НЕ возвращаются через GET.

`stages_completed: [1, 2, 3, 4, 5]` hardcoded (route.ts:717) — игнорирует
actual upstream state.

**Решение**:

1. **Унифицировать canonical shape** в `src/types/economy.ts`:
   ```ts
   export interface EconomyDesignResponse {
     id: string;
     project_id: string;  // ← добавить (POST сейчас возвращает только id)

     // Top-level
     inventory: { ... };  // = resource_model
     classification: { ... };  // = system_type + input_data
     machinations_model: { ... };
     conversion_graph: { ... };  // = conversion_chains
     diagnostics: { ... };  // = pathologies + has_pathology
     balance: { ... };  // = corrections
     sim_result: { ... };  // = simulation_results
     monetization_model: { ... };  // ← добавить в POST (сейчас только в DB)
     validation: { ... };  // ← TASK-5b.9

     // Meta
     stages_completed: number[];  // derived, не hardcoded
     latency_ms: number;
     models_used: string[];
     ai_insights?: string | null;

     // DB-only
     created_at?: string;
     updated_at?: string;
   }
   ```

2. **POST handler: добавить `project_id`, `monetization_model` в response**:
   ```ts
   const result: EconomyDesignResponse = {
     id: proj.id,
     project_id: proj.id,  // ← new
     inventory,
     classification,
     machinations_model: machinations,
     conversion_graph: conversionGraph,
     diagnostics,
     balance,
     sim_result: simResult,
     monetization_model: {  // ← new (раньше только в DB)
       type: monetizationType,
       pricing_type: classification.pricing_type,
       primary_revenue: ...,
       secondary_revenue: ...,
       ethical_concerns: ...,
     },
     validation,  // ← TASK-5b.9
     stages_completed: stagesCompleted,
     latency_ms: latencyMs,
     models_used: [...],
     ai_insights: undefined,  // будет заполнено в TASK-5b.15
   };
   ```

3. **GET handler: вернуть canonical shape** (вместо плоского):
   ```ts
   // В GET /economy/[projectId]:
   const fullProfile = safeJsonParse(e.fullProfile || "{}", {});
   return NextResponse.json({
     id: e.id,
     project_id: e.projectId,
     // Если fullProfile сохранён (после рефакторинга), вернуть его;
     // иначе сконструировать из отдельных полей (backward compat)
     ...(fullProfile.inventory ? fullProfile : {
       inventory: safeJsonParse(e.resourceModel || "{}", {}),
       classification: {
         type: e.systemType,
         ...safeJsonParse(e.inputData || "{}", {}),
       },
       machinations_model: safeJsonParse(e.machinationsModel || "{}", {}),
       conversion_graph: safeJsonParse(e.conversionChains || "{}", { chains: [] }),
       diagnostics: {
         pathologies: safeJsonParse(e.pathologies || "[]", []),
         has_pathology: e.hasPathology,
       },
       balance: { adjustments: safeJsonParse(e.corrections || "[]", []) },
       sim_result: safeJsonParse(e.simulationResults || "{}", {}),
       monetization_model: safeJsonParse(e.monetizationModel || "{}", {}),
     }),
     ai_insights: e.aiInsights,
     models_used: safeJsonParse(e.modelsUsed || "[]", []),
     created_at: e.createdAt.toISOString(),
     updated_at: e.updatedAt.toISOString(),
   });
   ```

4. **Деривить `stages_completed` из actual upstream state**:
   ```ts
   // Заменить route.ts:717:
   // const stagesCompleted = [1, 2, 3, 4, 5];
   // Стало:
   const stagesCompleted = await deriveStagesCompleted(proj.id);

   async function deriveStagesCompleted(projectId: string): Promise<number[]> {
     const project = await db.project.findUnique({
       where: { id: projectId },
       select: {
         concept: { select: { id: true } },
         coreLoop: { select: { id: true } },
         mdaProfile: { select: { id: true } },
         balanceResult: { select: { id: true } },
         progression: { select: { id: true } },
       },
     });
     if (!project) return [];
     const stages: number[] = [];
     if (project.concept) stages.push(1);
     if (project.coreLoop) stages.push(2);
     if (project.mdaProfile) stages.push(3);
     if (project.balanceResult) stages.push(4);
     if (project.progression) stages.push(5);  // progression before economy
     stages.push(5);  // economy itself (Block 5)
     return [...new Set(stages)].sort((a, b) => a - b);
   }
   ```

**Тест-кейсы**:
- POST response содержит `project_id`, `monetization_model`, `validation`.
- GET response содержит тот же shape, что POST (canonical).
- Для проекта без concept: `stages_completed = [5]` (только economy).
- Для проекта со всеми upstream stages: `stages_completed = [1, 2, 3, 4, 5]`.
- UI компоненты (`src/components/gidede/economy/*`) продолжают работать
  (проверить, что они используют canonical keys).

**Риски**:
- **Backward compat**: старые записи в БД (до рефакторинга) могут не иметь
  `fullProfile.inventory`. Митигация: fallback на склейку отдельных полей.
- **UI компоненты могут ломаться** при изменении shape. Митигация: постепенно
  migrate UI; оставить aliases (`resource_model` = `inventory`) на过渡 period.
- **`deriveStagesCompleted` добавляет DB query**. Митигация: batch с
  `getOwnedProject` (уже делает include).

**Dependencies**: TASK-5b.9 (validation в response), TASK-5b.15 (ai_insights в response).

---

### TASK-5b.17: Исправить `subsidiary_count`, `resource_type` для subsidiary; нормализовать genre

**Сложность**: S
**Приоритет**: 🟢 (type consistency)
**Файлы**: `src/app/api/v1/economy/design/route.ts` (строки 627-660, 593)

**Описание проблемы**:

1. `subsidiary_count` (route.ts:658-660):
   ```ts
   const subsidiaryCount = resources.filter(
     (r) => r.resource_class !== "core"
   ).length;
   ```
   Считает ВСЕ non-core (subsidiary + currency + consumable + meta).
   Type определяет subsidiary_count как количество subsidiary class.

2. `resource_type` для subsidiary (route.ts:634):
   ```ts
   resource_type: isCatalytic ? "subsidiary" : "consumable",
   ```
   Для non-catalytic subsidiary без `is_consumable=true` получает тип
   `"consumable"` — неправильно.

3. `pickResources` case-sensitive (route.ts:128-133):
   ```ts
   function pickResources(genre: string): { core: string[]; subsidiary: string[] } {
     return GENRE_RESOURCE_PRESETS[genre] || GENRE_RESOURCE_PRESETS.default;
   }
   ```
   `genre="RPG"` → fallback на default.

**Решение**:

1. **Исправить `subsidiary_count`** (см. TASK-5b.10 — уже исправлено в новой
   версии, где `coreCount = resources.filter((r) => r.resource_class === "core").length`
   и `subsidiaryCount = resources.filter((r) => r.resource_class === "subsidiary").length`).

   Если TASK-5b.10 не делается, минимум исправить:
   ```ts
   const coreCount = resources.filter((r) => r.resource_class === "core").length;
   const subsidiaryCount = resources.filter((r) => r.resource_class === "subsidiary").length;
   const currencyCount = resources.filter((r) => r.resource_class === "currency").length;
   const consumableCount = resources.filter((r) => r.resource_class === "consumable").length;
   const metaCount = resources.filter((r) => r.resource_class === "meta").length;
   ```

2. **Исправить `resource_type` для subsidiary**:
   ```ts
   // Было (route.ts:634):
   resource_type: isCatalytic ? "subsidiary" : "consumable",
   // Стало:
   resource_type: isConsumable ? "consumable" : isCatalytic ? "catalytic" : "subsidiary",
   ```

3. **Нормализовать genre в `pickResources`** (см. TASK-5b.10 — уже добавлено).
   Если TASK-5b.10 не делается, минимум:
   ```ts
   function pickResources(genre: string): { core: string[]; subsidiary: string[] } {
     const normalized = genre.trim().toLowerCase();
     return GENRE_RESOURCE_PRESETS[normalized] || GENRE_RESOURCE_PRESETS.default;
   }
   ```

**Тест-кейсы**:
- Для RPG preset: `core_count = 3`, `subsidiary_count = 3` (не 4 или 6).
- Для F2P preset (с `gems`): `core_count = 3`, `subsidiary_count = 3`,
  `currency_count = 2` (gold + gems), `consumable_count = 1` (stamina).
- Subsidiary non-catalytic non-consumable (например, `tokens` в default
  preset) → `resource_type = "subsidiary"` (не "consumable").
- `genre="RPG"` (uppercase) → использует rpg preset (не default).
- `genre=" rpg "` (whitespace) → использует rpg preset.

**Риски**:
- **Существующие test_projects** имеют старые значения `subsidiary_count`
  (4 для F2P preset). Митигация: regenerate test_projects после рефакторинга.

**Dependencies**: TASK-5b.10 (полное решение через новый preset structure).

---

### TASK-5b.18: Unit + integration тесты для economy designer

**Сложность**: L
**Приоритет**: 🟢 (после всех остальных задач; verify correctness)
**Файлы**:
- `tests/unit/economy-design.test.ts` (новый)
- `tests/integration/economy-design-api.test.ts` (новый)
- `tests/fixtures/economy/*.json` (новые fixtures)

**Описание проблемы**:

В репозитории НЕТ unit/integration тестов для `economy/design/route.ts`.
Все 7+ функций (`classifySystemType`, `buildMachinations`, `findConversionChains`,
`detectPathologies`, `proposeAdjustments`, `simulate`, `validateEconomy`)
не покрыты тестами. Регрессии не отлавливаются.

**Решение**:

1. **Unit тесты для каждой функции**:
   ```ts
   // tests/unit/economy-design.test.ts
   import { describe, expect, test } from "vitest";
   import {
     classifySystemType,
     buildMachinations,
     findConversionChains,
     detectPathologies,
     proposeAdjustments,
     simulate,
     validateEconomy,
   } from "@/app/api/v1/economy/design/route";  // ← export functions

   describe("classifySystemType", () => {
     test("returns Engine for resources without converter/consumable", () => {
       const resources = [
         { name: "score", resource_class: "core", is_consumable: false, is_catalytic: false, is_anchor: true },
       ];
       const result = classifySystemType(resources, "closed", "b2p");
       expect(result.type).toBe("Engine");
       expect(result.risk_level).toBe("low");
     });

     test("returns Ecology for resources with meta + converter", () => {
       const resources = [
         { name: "score", resource_class: "core", is_consumable: false, is_catalytic: false, is_anchor: true },
         { name: "research", resource_class: "meta", is_consumable: false, is_catalytic: true },
       ];
       const result = classifySystemType(resources, "open", "f2p");
       expect(result.type).toBe("Ecology");
       expect(result.risk_level).toBe("high");
     });

     test("returns Economy for resources with converter only", () => {
       const resources = [
         { name: "gold", resource_class: "currency", is_consumable: false, is_catalytic: false, is_anchor: true },
         { name: "materials", resource_class: "subsidiary", is_consumable: false, is_catalytic: true },
       ];
       const result = classifySystemType(resources, "mixed", "b2p");
       expect(result.type).toBe("Economy");
       expect(result.risk_level).toBe("medium");
     });

     test("openness=open → sub_type=player_driven_market", () => {
       const result = classifySystemType([], "open", "b2p");
       expect(result.sub_type).toBe("player_driven_market");
     });

     test("monetization=f2p → pricing_type=f2p_dual_currency", () => {
       const result = classifySystemType([], "mixed", "f2p");
       expect(result.pricing_type).toBe("f2p_dual_currency");
     });
   });

   describe("buildMachinations", () => {
     test("feedback_loops reference only existing node IDs", () => {
       const resources = [
         { name: "xp", resource_class: "core", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 100, bounds: {min: 0, max: 1000} },
         { name: "mana", resource_class: "subsidiary", is_anchor: false, is_catalytic: true, is_consumable: false, initial_value: 10, bounds: {min: 0, max: 500} },
         { name: "stamina", resource_class: "subsidiary", is_anchor: false, is_catalytic: false, is_consumable: true, initial_value: 10, bounds: {min: 0, max: 500} },
       ];
       const result = buildMachinations(resources, "xp", { type: "Economy" });
       const nodeIds = new Set(result.nodes.map((n) => n.id));
       for (const loop of result.feedback_loops) {
         for (const nodeId of loop.nodes) {
           expect(nodeIds.has(nodeId)).toBe(true);
         }
       }
     });

     test("drain_sink node created when consumable exists", () => {
       const resources = [
         { name: "xp", resource_class: "core", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 100, bounds: {min: 0, max: 1000} },
         { name: "stamina", resource_class: "subsidiary", is_anchor: false, is_catalytic: false, is_consumable: true, initial_value: 10, bounds: {min: 0, max: 500} },
       ];
       const result = buildMachinations(resources, "xp", { type: "Economy" });
       expect(result.nodes.some((n) => n.id === "drain_sink")).toBe(true);
     });

     test("empty resources → empty feedback_loops or single fallback", () => {
       const result = buildMachinations([], "score", { type: "Engine" });
       expect(result.feedback_loops.length).toBeLessThanOrEqual(1);
     });
   });

   describe("findConversionChains", () => {
     test("profitability is deterministic (same input → same output)", () => {
       const resources = [
         { name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} },
         { name: "mana", resource_class: "subsidiary", is_anchor: false, is_catalytic: true, is_consumable: false, initial_value: 10, bounds: {min: 0, max: 500} },
       ];
       const flows = [{ source_id: "gold", target_id: "mana", resource: "gold", rate: 0.5 }];
       const faucetDrain = { gold: { faucet: 0.5, drain: 0.3, ratio: 1.667 }, mana: { faucet: 0.5, drain: 0, ratio: Infinity } };
       const result1 = findConversionChains(resources, flows, faucetDrain);
       const result2 = findConversionChains(resources, flows, faucetDrain);
       expect(result1.chains[0].profitability).toBe(result2.chains[0].profitability);
     });

     test("no catalytic → empty chains with warning", () => {
       const resources = [
         { name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} },
       ];
       const result = findConversionChains(resources, [], {});
       expect(result.chains).toHaveLength(0);
       expect(result.warnings).toContain("Не найдено цепочек конверсии");
     });
   });

   describe("detectPathologies", () => {
     test("detects Инфляция when ratio > 1.5", () => {
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const faucetDrain = { gold: { faucet: 1.0, drain: 0.5, ratio: 2.0 } };
       const pathologies = detectPathologies(resources, faucetDrain, { chains: [] }, []);
       expect(pathologies.some((p) => p.name === "Инфляция" && p.severity === "critical")).toBe(true);
     });

     test("detects Стагнация when drain=0 and faucet>0", () => {
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const faucetDrain = { gold: { faucet: 0.5, drain: 0, ratio: Infinity } };
       const pathologies = detectPathologies(resources, faucetDrain, { chains: [] }, []);
       expect(pathologies.some((p) => p.name === "Стагнация")).toBe(true);
     });

     test("detects Арбитраж when profitability > 1.5", () => {
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const faucetDrain = { gold: { faucet: 0.5, drain: 0.5, ratio: 1.0 } };
       const chains = [{ inputs: ["gold"], outputs: ["gems"], profitability: 1.8, tier: 1, risk: "low" }];
       const pathologies = detectPathologies(resources, faucetDrain, { chains }, []);
       expect(pathologies.some((p) => p.name === "Арбитраж")).toBe(true);
     });

     test("detects Deadlock when faucet=0, initial=0, no producer", () => {
       const resources = [{ name: "gems", resource_class: "currency", is_anchor: false, is_catalytic: false, is_consumable: false, initial_value: 0, bounds: {min: 0, max: 99999} }];
       const faucetDrain = { gems: { faucet: 0, drain: 0, ratio: 0 } };
       const pathologies = detectPathologies(resources, faucetDrain, { chains: [] }, []);
       expect(pathologies.some((p) => p.name === "Deadlock")).toBe(true);
     });

     test("detects all 6 pathology types (Bible 6.10)", () => {
       // Construct resources that trigger all 6
       const resources = [
         { name: "inflated", resource_class: "currency", is_anchor: false, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} },
         { name: "stagnant", resource_class: "currency", is_anchor: false, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} },
         { name: "deadlocked", resource_class: "currency", is_anchor: false, is_catalytic: false, is_consumable: false, initial_value: 0, bounds: {min: 0, max: 10000} },
         { name: "stalled", resource_class: "subsidiary", is_anchor: false, is_catalytic: false, is_consumable: false, initial_value: 10, bounds: {min: 0, max: 100} },
         { name: "catalytic_runaway", resource_class: "subsidiary", is_anchor: false, is_catalytic: true, is_consumable: false, initial_value: 10, bounds: {min: 0, max: 500} },
       ];
       const faucetDrain = {
         inflated: { faucet: 1.5, drain: 0.5, ratio: 3.0 },
         stagnant: { faucet: 0.5, drain: 0, ratio: Infinity },
         deadlocked: { faucet: 0, drain: 0, ratio: 0 },
         stalled: { faucet: 0.1, drain: 0.5, ratio: 0.2 },
         catalytic_runaway: { faucet: 1.5, drain: 0.3, ratio: 5.0 },
       };
       const chains = [{ inputs: ["inflated"], outputs: ["stagnant"], profitability: 2.0, tier: 1, risk: "low" }];
       const feedbackLoops = [{ nodes: ["catalytic_runaway", "inflated"], loop_type: "reinforcing", strength: 0.8, description: "test" }];
       const pathologies = detectPathologies(resources, faucetDrain, { chains }, feedbackLoops);
       const names = new Set(pathologies.map((p) => p.name));
       expect(names.has("Инфляция")).toBe(true);
       expect(names.has("Стагнация")).toBe(true);
       expect(names.has("Арбитраж")).toBe(true);
       expect(names.has("Deadlock")).toBe(true);
       expect(names.has("Stall")).toBe(true);
       expect(names.has("Убегание")).toBe(true);
     });
   });

   describe("simulate", () => {
     test("deterministic with same seed", () => {
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const faucetDrain = { gold: { faucet: 0.5, drain: 0.3, ratio: 1.667 } };
       const result1 = simulate(resources, faucetDrain, 50, 100, 12345);
       const result2 = simulate(resources, faucetDrain, 50, 100, 12345);
       expect(result1.aggregated.avg_resource_curves.gold).toEqual(result2.aggregated.avg_resource_curves.gold);
       expect(result1.config.seed).toBe(12345);
     });

     test("num_runs=100 → snapshots_count=5000 (50 ticks × 100 runs)", () => {
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const faucetDrain = { gold: { faucet: 0.5, drain: 0.3, ratio: 1.667 } };
       const result = simulate(resources, faucetDrain, 50, 100);
       expect(result.snapshots_count).toBe(5000);
       expect(result.config.num_runs).toBe(100);
     });

     test("Math.random not used (deterministic)", () => {
       const spy = vi.spyOn(Math, "random");
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const faucetDrain = { gold: { faucet: 0.5, drain: 0.3, ratio: 1.667 } };
       simulate(resources, faucetDrain, 50, 100, 12345);
       expect(spy).not.toHaveBeenCalled();
       spy.mockRestore();
     });
   });

   describe("validateEconomy", () => {
     test("returns 12 checks", () => {
       const resources = [{ name: "gold", resource_class: "currency", is_anchor: true, is_catalytic: false, is_consumable: false, initial_value: 50, bounds: {min: 0, max: 10000} }];
       const machinations = { nodes: [{ id: "gold", name: "gold", node_type: "pool", initial_value: 50, capacity: 10000, rate: null }], resource_flows: [], feedback_loops: [] };
       const conversionGraph = { chains: [], avg_profitability: 0, tier_coverage: {}, warnings: [] };
       const faucetDrain = { gold: { faucet: 0.5, drain: 0.5, ratio: 1.0 } };
       const pathologies: any[] = [];
       const simResult = { aggregated: { runaway_frequency: 0, stall_frequency: 0, stability_index: 1.0, avg_resource_curves: { gold: [50, 50, 50] } } };
       const validation = validateEconomy(resources, machinations, conversionGraph, faucetDrain, pathologies, simResult, "gold");
       expect(validation.checks).toHaveLength(12);
       expect(validation.overall_score).toBeGreaterThanOrEqual(0);
       expect(validation.overall_score).toBeLessThanOrEqual(100);
     });
   });
   ```

2. **Integration тесты для API endpoint**:
   ```ts
   // tests/integration/economy-design-api.test.ts
   import { describe, expect, test, beforeAll, afterAll } from "vitest";
   import { POST } from "@/app/api/v1/economy/design/route";
   import { GET } from "@/app/api/v1/economy/[projectId]/route";
   import { createMockRequest, createMockUser, createTestProject } from "../helpers";

   describe("POST /api/v1/economy/design", () => {
     test("returns 200 with valid input for RPG genre", async () => {
       const user = await createMockUser();
       const project = await createTestProject(user.id, { genre: "rpg" });
       const req = createMockRequest("POST", {
         project_id: project.id,
         genre: "rpg",
         monetization_type: "b2p",
         openness: "mixed",
       });
       const response = await POST(req);
       expect(response.status).toBe(200);
       const body = await response.json();
       expect(body.inventory.resources.length).toBeGreaterThan(0);
       expect(body.machinations_model.nodes.length).toBeGreaterThan(0);
       expect(body.validation.checks).toHaveLength(12);
       expect(body.sim_result.config.rng).toBe("mulberry32");
     });

     test("deterministic: same input → same output (no Math.random)", async () => {
       const user = await createMockUser();
       const project1 = await createTestProject(user.id, { genre: "rpg" });
       const project2 = await createTestProject(user.id, { genre: "rpg" });
       const req1 = createMockRequest("POST", { project_id: project1.id, genre: "rpg", monetization_type: "b2p", openness: "mixed", seed: 42 });
       const req2 = createMockRequest("POST", { project_id: project2.id, genre: "rpg", monetization_type: "b2p", openness: "mixed", seed: 42 });
       const r1 = await (await POST(req1)).json();
       const r2 = await (await POST(req2)).json();
       expect(r1.sim_result.aggregated.avg_resource_curves).toEqual(r2.sim_result.aggregated.avg_resource_curves);
       expect(r1.conversion_graph.chains.map((c: any) => c.profitability)).toEqual(r2.conversion_graph.chains.map((c: any) => c.profitability));
     });

     test("different genres produce different resources", async () => {
       const user = await createMockUser();
       const p1 = await createTestProject(user.id, { genre: "rpg" });
       const p2 = await createTestProject(user.id, { genre: "tower_defense" });
       const r1 = await (await POST(createMockRequest("POST", { project_id: p1.id, genre: "rpg" }))).json();
       const r2 = await (await POST(createMockRequest("POST", { project_id: p2.id, genre: "tower_defense" }))).json();
       expect(r1.inventory.resources.map((r: any) => r.name)).not.toEqual(r2.inventory.resources.map((r: any) => r.name));
     });

     test("use_ai=true → ai_insights in response AND in DB", async () => {
       const user = await createMockUser();
       const project = await createTestProject(user.id, { genre: "rpg" });
       const req = createMockRequest("POST", { project_id: project.id, genre: "rpg", use_ai: true });
       const response = await POST(req);
       const body = await response.json();
       expect(body.ai_insights).toBeTruthy();
       // GET should also return ai_insights
       const getReq = createMockRequest("GET", {}, { projectId: project.id });
       const getResponse = await GET(getReq, { params: Promise.resolve({ projectId: project.id }) });
       const getBody = await getResponse.json();
       expect(getBody.ai_insights).toBeTruthy();
       expect(getBody.ai_insights).toBe(body.ai_insights);
     });

     test("invalid monetization_type → 422", async () => {
       const user = await createMockUser();
       const project = await createTestProject(user.id);
       const req = createMockRequest("POST", { project_id: project.id, monetization_type: "invalid_type" });
       const response = await POST(req);
       expect(response.status).toBe(422);
     });
   });
   ```

3. **Export functions from route.ts** для testability:
   ```ts
   // В начале route.ts, добавить exports:
   export {
     classifySystemType,
     buildMachinations,
     findConversionChains,
     detectPathologies,
     proposeAdjustments,
     simulate,
     validateEconomy,
     mulberry32,
     hashSeed,
     deriveFaucetDrain,
     derivePricingType,
   };
   ```
   (Currently functions are not exported — only `POST` handler is.)

4. **Run tests**:
   ```bash
   npx vitest run tests/unit/economy-design.test.ts
   npx vitest run tests/integration/economy-design-api.test.ts
   ```

**Тест-кейсы**:
- Все unit тесты проходят.
- Все integration тесты проходят.
- Coverage ≥ 80% для `economy/design/route.ts`.
- Тест на детерминизм: 2 вызова с seed=42 → идентичные `avg_resource_curves`.
- Тест на genre diversity: rpg vs tower_defense → разные resources.
- Тест на ai_insights persistence: POST + GET → `ai_insights` совпадают.

**Риски**:
- **Mocking Prisma** для unit tests. Митигация: использовать
  `vitest-mock-extended` или in-memory SQLite.
- **Integration tests требуют running Next.js + DB**. Митигация: использовать
  `next-test-api-route-handler` для изоляции.
- **AI enrichment mock** — реальные LLM вызовы дорогие. Митигация: mock
  `enrichEconomy` в integration tests.

**Dependencies**: все остальные задачи (TASK-5b.1 — TASK-5b.17). Тесты
покрывают итоговое поведение после всех рефакторингов.

---

## Сводная таблица задач

| ID | Сложность | Приоритет | Зависимости | Кратко |
|----|-----------|-----------|-------------|--------|
| TASK-5b.1 | L | 🔴 | — | Создать `enrichEconomy` в ai-service.ts |
| TASK-5b.2 | M | 🔴 | — | Починить feedback_loops nodes (real IDs, не литералы) |
| TASK-5b.3 | M | 🔴 | TASK-5b.4 | Заменить `Math.random()` в profitability на формулу Bible 6.9.1 |
| TASK-5b.4 | L | 🔴 | — | Вывести faucet/drain из actual flows, не из class preset |
| TASK-5b.5 | M | 🔴 | TASK-5b.4 | Починить stallCount threshold (relative change) |
| TASK-5b.6 | L | 🔴 | TASK-5b.4, TASK-5b.5 | Real Monte Carlo с N runs + mulberry32 PRNG |
| TASK-5b.7 | L | 🔴 | TASK-5b.10 | Деривить economy params из upstream concept в pipeline runners |
| TASK-5b.8 | L | 🔴 | TASK-5b.2, TASK-5b.3, TASK-5b.4 | 6 патологий (Bible 6.10) + adjustments для всех 6 |
| TASK-5b.9 | XL | 🔴 | TASK-5b.2 — TASK-5b.6, TASK-5b.8 | 12-point validation checklist (Bible 6.13.4) |
| TASK-5b.10 | L | 🔴 | — | Расширить GENRE_RESOURCE_PRESETS до 15 жанров |
| TASK-5b.11 | L | 🟡 | — | 16+ Machinations patterns (Bible 6.4.1) |
| TASK-5b.12 | M | 🟡 | TASK-5b.2 | 8-мерный профиль петли ОС (Bible 6.8.2) |
| TASK-5b.13 | M | 🟡 | — | 6 Schreiber economic system types (Bible 6.4.3) |
| TASK-5b.14 | M | 🟡 | TASK-5b.10 | Genre-specific dominant loops (Bible 6.8.3) |
| TASK-5b.15 | S | 🔴 | TASK-5b.1 | Перенести AI enrichment ДО persist + DB schema fields |
| TASK-5b.16 | M | 🟡 | TASK-5b.9, TASK-5b.15 | Унифицировать POST/GET shape + dynamic stages_completed |
| TASK-5b.17 | S | 🟢 | TASK-5b.10 | Починить subsidiary_count, resource_type, genre normalization |
| TASK-5b.18 | L | 🟢 | ALL | Unit + integration тесты |

**Итого**: 18 задач
- 🔴 Критичных: 11 (TASK-5b.1, 5b.2, 5b.3, 5b.4, 5b.5, 5b.6, 5b.7, 5b.8, 5b.9, 5b.10, 5b.15)
- 🟡 Средних: 5 (TASK-5b.11, 5b.12, 5b.13, 5b.14, 5b.16)
- 🟢 Низких: 2 (TASK-5b.17, 5b.18)

**Сложность по часам** (rough estimate):
- S (Small): 2-4ч каждая → 2 задачи × 3ч = 6ч
- M (Medium): 4-8ч каждая → 7 задач × 6ч = 42ч
- L (Large): 8-16ч каждая → 7 задач × 12ч = 84ч
- XL (Extra Large): 16-32ч → 1 задача × 24ч = 24ч

**Total**: ~156ч без тестов; ~190ч с тестами (TASK-5b.18 добавляет ~30ч на
test fixtures + mocking infrastructure).

---

## Приоритеты выполнения

### Phase 1 (Foundation — 1-2 недели):
- TASK-5b.1 (enrichEconomy) — unblocks AI enrichment correctness
- TASK-5b.4 (derive faucet/drain) — unblocks TASK-5b.3, 5b.5, 5b.8
- TASK-5b.2 (fix feedback_loops) — unblocks TASK-5b.8, 5b.12
- TASK-5b.10 (expand presets) — unblocks TASK-5b.7, 5b.14
- TASK-5b.15 (move AI before persist + DB schema) — unblocks ai_insights persistence

### Phase 2 (Correctness — 2-3 недели):
- TASK-5b.3 (deterministic profitability)
- TASK-5b.5 (fix stallCount)
- TASK-5b.6 (real Monte Carlo)
- TASK-5b.7 (derive economy params in pipeline runners)
- TASK-5b.8 (6 pathologies)
- TASK-5b.17 (fix subsidiary_count etc.)

### Phase 3 (Bible compliance — 2-3 недели):
- TASK-5b.9 (12-point checklist)
- TASK-5b.11 (16+ Machinations patterns)
- TASK-5b.12 (8-dim loop profile)
- TASK-5b.13 (6 Schreiber types)
- TASK-5b.14 (genre-specific dominant loops)

### Phase 4 (Polish — 1 неделя):
- TASK-5b.16 (unified response shape)
- TASK-5b.18 (tests)

---

## Ожидаемые результаты после рефакторинга

1. **Детерминизм**: 2 запуска с идентичным input + seed → идентичный output
   (включая profitability, sim curves, pathologies).
2. **Genre diversity**: 10 test_projects имеют РАЗНЫЕ resources, classification,
   pathologies (не все rpg/b2p/mixed).
3. **AI insights relevance**: `ai_insights` содержит advice по экономике
   (Machinations, faucet/drain, петли), не по прогрессии.
4. **AI insights persistence**: GET `/economy/[projectId]` возвращает
   `ai_insights` (не null).
5. **6 pathologies**: `diagnostics.pathologies` может содержать
   `Инфляция`, `Стагнация`, `Арбитраж`, `Убегание`, `Deadlock`, `Stall`.
6. **12-point checklist**: `validation.checks.length === 12`,
   `validation.overall_score` в диапазоне 0-100.
7. **Real Monte Carlo**: `sim_result.config.num_runs` соответствует actual
   runs (100 by default), `snapshots_count = ticks × num_runs`.
8. **Feedback loops valid**: все `feedback_loops[].nodes` ссылаются на
   существующие node IDs.
9. **16+ Machinations patterns**: `structural_patterns` содержит
   Bible-compliant IDs (`static_engine`, `dynamic_engine`, etc.).
10. **8-dim loop profile**: `feedback_loops[].profile` содержит все 8
    характеристик (type, effect, investment, return, speed, duration,
    indirectness, determinism).
11. **6 Schreiber types**: `classification.pricing_type` ∈
    `{fixed, player_dynamic_market, f2p_dual_currency, prestige_cosmetic,
    real_money, mixed}`.
12. **Genre-specific dominant loops**: `classification.dominant_loop`
    зависит от genre (RPG → positive_constructive, etc.).
13. **POST/GET unified**: один canonical shape, UI компоненты работают с
    обоими endpoints без адаптеров.
14. **`stages_completed` derived**: отражает actual upstream state.
15. **Test coverage ≥ 80%** для `economy/design/route.ts`.

---

## Риски рефакторинга

1. **Breaking changes для UI** (`src/components/gidede/economy/*`,
   `src/app/blocks/5/page.tsx`) — изменятся shape, добавятся поля.
   Митигация: обновить UI параллельно; оставить aliases на переходный период.

2. **DB migration** (`aiInsights`, `modelsUsed` поля) — может потребовать
   down-time. Митигация: nullable поля, backward compatible.

3. **Test_projects fixture data** — все 10 test_projects нужно regenerate.
   Митигация: запустить `run_pipeline_test.sh` после рефакторинга.

4. **AI enrichment latency** — увеличивается на 2-5s (block persist).
   Митигация: рассмотреть async pattern (возвращать 202 с poll token) в
   TASK-5b.18 или будущем расширении.

5. **16+ patterns metadata volume** — увеличивает размер response.
   Митигация: опциональное поле `pattern_details` (только если
   `?include=pattern_details` в query).

6. **`num_runs=1000` performance** — 50 ticks × 1000 runs × 6 resources =
   300 000 iterations (~100-300ms). Митигация: default 100, max 1000,
   warning в response при > 500.

7. **`deriveStagesCompleted` DB query** — дополнительный запрос на каждый
   POST. Митигация: batch с `getOwnedProject` (уже include).

---

## Связанные задачи из других блоков

- **TASK-1.X** (Block 1): `concept.genre` должен быть заполнен для всех
  10 test_projects (сейчас `genre="rpg"` для всех, см. TASK-5a.7).
- **TASK-4.X** (Block 4): `balanceResult.elements` может использоваться
  для деривации resources (если balance design уже есть).
- **TASK-5a.X** (Block 5a): `progression.economy_link` должен
  синхронизироваться с economy `inventory.resources` (сейчас hardcoded
  `["xp", "gold"]` в progression).
- **TASK-6.X** (Block 6 GDD): GDD section "Экономика" должен использовать
  canonical economy shape (после TASK-5b.16).

---

## Заключение

Блок 5b (Economy Designer) имеет **18 задач** рефакторинга, из которых
**11 критичных** (блокируют Bible compliance и детерминизм). Главные
проблемы:

1. **Идентичные outputs для всех 10 test_projects** — root cause: pipeline
   runners не передают genre/monetization/openness; route не использует
   upstream concept genre.
2. **Non-determinism** — `Math.random()` в profitability и simulation noise;
   `num_runs: 10` fake (реально 1 run).
3. **Bogus feedback_loops** — `"converter"` и `"consumable"` строковые
   литералы вместо реальных node IDs.
4. **Hardcoded faucet/drain by class** — всегда даёт ratio=3.33 для
   catalytic → всегда 2 critical `Инфляция` pathologies.
5. **Missing `enrichEconomy`** — route использует `enrichProgression` с
   `totalLevels: 6` (количество ресурсов!) → AI даёт advice по прогрессии.
6. **AI enrichment after persist** — `ai_insights` не сохраняется в БД.
7. **Bible compliance gaps** — 4/6 pathologies, 5/16+ patterns, 4/8 loop
   profile fields, 4/6 Schreiber types, 0/12 checklist checks.

После рефакторинга все 10 test_projects будут иметь **разные** economy
outputs (genre-specific resources, dominant loops, pathologies, validation
scores), AI insights будут релевантны экономике и сохраняться в БД, а
результаты будут **воспроизводимы** при одинаковом seed.
