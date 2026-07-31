# Рефакторинг Блока 2 — Core Loop Designer

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-2 (sub-agent)
**Связанные документы**: `docs/audit/AUDIT_REPORT.md` (раздел 2), `docs/audit/REFACTOR_PLAN_block_1.md`, `docs/bible/bible_2_4_core_loop.md` (456 строк)
**Объект рефакторинга**: `src/app/api/v1/coreloop/design/route.ts` (946 строк), `src/lib/ai-service.ts` (функция `enrichCoreLoop`, строки 499–541), `src/types/coreloop.ts` (28 строк), `src/constants/coreloop.ts` (54 строки), `prisma/schema.prisma` (модель `ProjectCoreLoop`, строки 135–160), `src/lib/pipeline-helpers.ts` (`buildPreparedInput` для blockId=2).

---

## Контекст

Блок 2 (Core Loop Designer) — вторая стадия пайплайна Gidede. Принимает `concept_id`, `mechanics: string[]`, `genre`, опциональные `desired_loop_type`, `custom_steps`, `project_id`, `use_ai`. Выполняет 5 стадий:

1. **`buildSteps(mechanics, customSteps, type)`** — либо customSteps (slice 0..10), либо **захардкоженный 5-шаговый шаблон** `"Find target (m0) / Engage (m1) / Collect rewards (m2) / Upgrade (m3) / Return to base (m4)"`.
2. **`classifyStructuralType(mechanics, genre, desiredLoopType, steps)`** — type из `desiredLoopType` или `GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid"`; sub_type из consumables/currencies/mechanics.length%2.
3. **`buildLoopHierarchy(steps, type)`** — 6 уровней (micro→meta) с canned actions; для ecology/hybrid добавляет второй micro.
4. **`detectPathologies(steps, structuralType)`** — 7 патологий + 3 type-specific (tower_defense/rhythm/puzzle).
5. **`buildValidation(steps, pathologies, structuralType)`** — 5 критериев: fun_check, loop_closedness, resource_sufficiency, pathology absence, step count.

Опционально вызывает `enrichCoreLoop` (LLM) и persist в `ProjectCoreLoop` (upsert).

**Подтверждённые дефекты** (проверены на всех 10 test_projects):
- **Все 10 проектов** имеют идентичные первые шаги `"Find target (explore)"` и идентичные 5-step английский шаблон независимо от жанра (roguelike, tower_defense, rhythm, puzzle, engine, economy, ecology). Механики подставляются в скобки `(${m0})`, но не формируют структуру цикла.
- **Все 10 проектов** имеют идентичные 9 currencies: `["signal","energy","ammo","xp","gold","power","ability","rest","save"]` — это хардкод шаблона, не связанные с механиками ресурсы.
- **Все 10 проектов** имеют одинаковые `dead_resources: ["signal","xp","power","ability","rest","save"]` (6 шт.) и `unsourced_consumables: ["energy","ammo"]` (2 шт.) — хардкод шаблона гарантирует эти утечки.
- **`loop_closedness.is_closed = true`** для всех 10 проектов — без реальной проверки замкнутости.
- **`Brittleness` патология** помечена для всех 10 проектов — потому что каждый step в шаблоне содержит ровно 1 mechanic (`steps.every((s) => s.mechanics.length <= 1)` всегда true).
- **`overall_passed = true` для 9 из 10** проектов (score=0.8) — несмотря на 6 dead_resources, 2 unsourced_consumables, и Brittleness. Только puzzle (04_Crystal_Cascade) имеет `overall_passed = false` из-за `stuck_state` critical.
- **4 Bible патологии отсутствуют**: Grind, Frustration Plateau, Disconnected Loops, Loop Overload (Bible 4.10.4–4.10.7). Реализованы 4 НЕ библейских: Brittleness, Oscillation, Stagnation, Triviality.
- **Тип классификации по жанру, не по эстетике** (Bible 4.11.1: Вызов→Engine, Открытие→Economy, Товарищество→Ecology, Подчинение→Engine) — `GENRE_DEFAULT_LOOP_TYPE[genre]` используется вместо aesthetic из concept.
- **5 вопросов Гэри (Bible 4.7, 4.11.2)** не реализованы.
- **Масштаб по жанру (Bible 4.11.3, таблица 4.8.3)**: `duration_estimate` захардкожен `6/10/4/8/5` сек — не зависит от жанра.
- **Sub_type для tower_defense/rhythm/puzzle** = `"hybrid_engine"` или `"hybrid_economy"` (через `mechanics.length % 2`) — meaningless, не отражает реальную структуру этих типов.
- **`resources.class_` для tower_defense/rhythm/puzzle** = `"balance_state"` (fallback) — должно быть tower/wave/combo/tempo/piece/board_state.
- **`customSteps` mode гарантирует утечки ресурсов**: positive шаги производят `["xp","score"]` (никогда не потребляются), negative — потребляют `["energy"]` (никогда не производится). Это противоречит Bible 4.11.4.
- **`hasBraking` логика запутана**: `type !== "engine" || subType === "braked_engine"` → все non-engine типы получают `has_braking=true`, включая ecology/hybrid где braking может отсутствовать.
- **`||` в детекции патологий**: `if (likely.includes(name) || <condition>)` — патология срабатывает даже если не "likely", но condition true. Например `Stall` срабатывает для всех ecology (likely), даже если positiveCount>0.
- **`ai_insights` не персистится в отдельной колонке** — только внутри `fullProfile` JSON. Prisma `ProjectCoreLoop` schema не имеет `aiInsights`, `modelsUsed`, `latencyMs` полей.
- **`enrichCoreLoop` prompt generic** — не упоминает конкретные патологии, dead_resources, unsourced_consumables. LLM даёт 3 общих совета вместо конкретной диагностики.
- **`hierarchyDepth = 6` захардкожен** в обоих create и update Prisma calls (строки 903, 920), хотя `Object.keys(loopHierarchy).length` всегда 6 — несложно вычислять.
- **`void safeJsonParse;`** (строка 938) — dead code, linter workaround.
- **`PATHOLOGY_TYPES` константа** (строки 71–80) объявлена, но НИГДЕ не используется.
- **`stagesCompleted = [1, 2, 3, 4, 5]`** — всегда одинаковый массив, не отражает реальные стадии.
- **Нет GET /coreloop/[projectId] route** — фронтенд не может загрузить существующий core loop, только re-design через POST.
- **`loops` array в structuralType** содержит только 2 элемента (inner, outer), не 6 (Bible 4.3).
- **`inner_loops` / `outer_loops`** — массивы с 1 элементом каждый; `meta_loop` — single object, не массив. Несогласованно с Bible 4.3 (6 уровней).
- **`GENRE_DEFAULT_LOOP_TYPE`** имеет ключ `rhythm: "engine"` (жанр rhythm → engine), но `rhythm` также является валидным `desired_loop_type`. Если пользователь не указал desired_loop_type и жанр=rhythm, type=engine (а не rhythm). Аналогично `tower_defense: "economy"` и `puzzle: "hybrid"`.
- **HIERARCHY_LEVELS scale mismatch с Bible 4.3**: `medium` (5–10 min) ↔ Long-term Cognitive (min-hr), `large` (15–30 min) ↔ Social (hr-days), `macro` (hours) ↔ Emotional (hr-weeks). Несоответствие шкал для 3 уровней.
- **Test driver** (`scripts/run_pipeline_test.sh:98`) передаёт `mechanics:["explore","combat","reward"]` (3 элемента) — что вызывает `mechanics[3]` и `mechanics[4]` fallback к `"progress"` и `"return"` (английские строки).
- **Genre case mismatch**: тест driver создаёт проекты с `genre:"RPG"`, `"Tower Defense"` (mixed case). `GENRE_DEFAULT_LOOP_TYPE` keys lowercase. Если genre передаётся в route, lookup fails → fallback `"hybrid"`.

---

## Цели рефакторинга

1. **Параметризовать `buildSteps` по структурному типу** — Engine/Economy/Ecology/Hybrid/Tower_defense/Rhythm/Puzzle должны порождать разные структуры цикла, не один захардкоженный 5-шаговый шаблон.
2. **Классифицировать тип по эстетике** (Bible 4.11.1) — Вызов→Engine, Открытие→Economy, Товарищество→Ecology, Подчинение→Engine. Использовать `concept.aestheticProfile.primary` если доступен.
3. **Реализовать 7 Bible патологий** — добавить Grind, Frustration Plateau, Disconnected Loops, Loop Overload; убрать или переименовать 4 non-biblical (Brittleness, Oscillation, Stagnation, Triviality).
4. **Реальная проверка замкнутости** — `loop_closedness.is_closed` должна проверять, что хотя бы один ресурс из `last_step.produced` потребляется в `first_step.consumed` (или любой другой шаг).
5. **Sub_type для всех 7 типов** — добавить meaningful sub_types для tower_defense/rhythm/puzzle вместо meaningless "hybrid_engine"/"hybrid_economy".
6. **Реализовать 5 вопросов Гэри** (Bible 4.7, 4.11.2) — cycle/conflict/resources/interaction/goal.
7. **Масштаб по жанру** (Bible 4.11.3, таблица 4.8.3) — `duration_estimate` должен зависеть от жанра (10s shooter, 2–5min RPG, 5–15min strategy и т.д.).
8. **Убедиться, что хардкод-шаблон не создаёт утечек ресурсов** — каждый ресурс должен иметь source и sink (Bible 4.11.4).
9. **Починить customSteps mode** — resources для custom steps должны быть осмысленными, не "xp+score для positive / energy для negative".
10. **Персистить `ai_insights`, `models_used`, `latency_ms`** в отдельных колонках Prisma.
11. **Добавить GET /coreloop/[projectId]** — для загрузки существующего core loop.
12. **Убрать dead code и неиспользуемые константы**.
13. **Улучшить `enrichCoreLoop` prompt** — передавать конкретные патологии, dead_resources, unsourced_consumables для конкретного AI-анализа.
14. **Покрыть unit-тестами** критичные функции (`buildSteps`, `classifyStructuralType`, `detectPathologies`, `buildValidation`).

---

## Задачи

### TASK-2.1: Параметризовать `buildSteps` по структурному типу (Engine/Economy/Ecology/Hybrid/TD/Rhythm/Puzzle)

**Сложность**: XL
**Приоритет**: 🔴 (блокирует TASK-2.4, TASK-2.8, TASK-2.9, TASK-2.10, TASK-2.13)
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 207–278)

**Описание проблемы**:

`buildSteps(mechanics, customSteps, type)` принимает параметр `type`, но **полностью его игнорирует**. Для всех 7 валидных типов (engine, economy, ecology, hybrid, tower_defense, rhythm, puzzle) возвращается идентичный 5-шаговый шаблон:

```ts
// route.ts:236-278
return [
  { action: `Find target (${m0})`, mechanics: [m0], resources_consumed: [], resources_produced: ["signal"], feedback_type: "neutral", duration_estimate: 6 },
  { action: `Engage (${m1})`, mechanics: [m1], resources_consumed: ["energy", "ammo"], resources_produced: [], feedback_type: "negative", duration_estimate: 10 },
  { action: `Collect rewards (${m2})`, mechanics: [m2], resources_consumed: [], resources_produced: ["xp", "gold"], feedback_type: "positive", duration_estimate: 4 },
  { action: `Upgrade (${m3})`, mechanics: [m3], resources_consumed: ["gold"], resources_produced: ["power", "ability"], feedback_type: "positive", duration_estimate: 8 },
  { action: `Return to base (${m4})`, mechanics: [m4], resources_consumed: [], resources_produced: ["rest", "save"], feedback_type: "neutral", duration_estimate: 5 },
];
```

Подтверждение на test_projects: все 10 проектов (Engine, Tower_defense, Rhythm, Puzzle, Economy, Ecology) имеют идентичные `"first_action":"Find target (explore)"` и идентичные 5 шагов. Механики лишь подставляются в скобки `(${m0})`, не влияя на структуру цикла.

**Решение**:

Заменить `buildSteps` на диспетчер, вызывающий type-specific builder'ы. Каждый builder возвращает цикл, форма которого соответствует типу по Bible 4.4:

```ts
// Новый сигнатура:
function buildSteps(
  mechanics: string[],
  customSteps: string[] | undefined,
  type: LoopType,
  context: { genre: string; idea?: string }
): CoreStep[] {
  if (customSteps && customSteps.length > 0) {
    return buildCustomSteps(mechanics, customSteps, type);  // см. TASK-2.9
  }
  switch (type) {
    case "engine":        return buildEngineSteps(mechanics, context);
    case "economy":       return buildEconomySteps(mechanics, context);
    case "ecology":       return buildEcologySteps(mechanics, context);
    case "hybrid":        return buildHybridSteps(mechanics, context);
    case "tower_defense": return buildTowerDefenseSteps(mechanics, context);
    case "rhythm":        return buildRhythmSteps(mechanics, context);
    case "puzzle":        return buildPuzzleSteps(mechanics, context);
    default:              return buildHybridSteps(mechanics, context);
  }
}

// Engine (Bible 4.4.1): однонаправленный ресурсный поток, усиливающая/тормозящая петля
function buildEngineSteps(mechanics: string[], ctx: { genre: string; idea?: string }): CoreStep[] {
  const [act, engage, reward, upgrade] = mechanics;
  return [
    // Boosting: invest resource → gain more
    { action: `Вложить ресурс (${act || "действие"})`, mechanics: [act || "action"].filter(Boolean), resources_consumed: ["resource"], resources_produced: [], feedback_type: "neutral", duration_estimate: 5 },
    { action: `Выполнить (${engage || "усилие"})`, mechanics: [engage || "engage"].filter(Boolean), resources_consumed: ["energy"], resources_produced: ["resource"], feedback_type: "positive", duration_estimate: 8 },
    { action: `Получить прирост (${reward || "награда"})`, mechanics: [reward || "reward"].filter(Boolean), resources_consumed: [], resources_produced: ["resource", "xp"], feedback_type: "positive", duration_estimate: 4 },
    // Braking: drain excess to prevent runaway (Bible 4.4.1 "Braking Engine")
    { action: `Сбросить излишек (${upgrade || "сброс"})`, mechanics: [upgrade || "drain"].filter(Boolean), resources_consumed: ["resource"], resources_produced: ["xp"], feedback_type: "neutral", duration_estimate: 3 },
  ];
  // Замкнутость: шаг 4 потребляет resource (произведённый шагом 2/3), шаг 1 тоже потребляет resource.
  // Цикл замкнут по ресурсу "resource".
}

// Economy (Bible 4.4.2): конвертация ресурсов, развёртывание сложности
function buildEconomySteps(mechanics: string[], ctx): CoreStep[] {
  const [gather, convert, trade, upgrade, sell] = mechanics;
  return [
    { action: `Собрать сырьё (${gather || "сбор"})`, mechanics: [gather || "gather"].filter(Boolean), resources_consumed: ["time"], resources_produced: ["raw"], feedback_type: "neutral", duration_estimate: 6 },
    { action: `Сконвертировать (${convert || "конвертация"})`, mechanics: [convert || "convert"].filter(Boolean), resources_consumed: ["raw"], resources_produced: ["craft"], feedback_type: "positive", duration_estimate: 5 },
    { action: `Продать/Обменять (${trade || "торговля"})`, mechanics: [trade || "trade"].filter(Boolean), resources_consumed: ["craft"], resources_produced: ["gold"], feedback_type: "positive", duration_estimate: 4 },
    { action: `Купить улучшение (${upgrade || "улучшение"})`, mechanics: [upgrade || "upgrade"].filter(Boolean), resources_consumed: ["gold"], resources_produced: ["gear"], feedback_type: "positive", duration_estimate: 8 },
    { action: `Экипировать → эффективность сбора (${sell || "экипировка"})`, mechanics: [sell || "equip"].filter(Boolean), resources_consumed: ["gear"], resources_produced: ["time"], feedback_type: "neutral", duration_estimate: 3 },
  ];
  // Замкнутость: raw → craft → gold → gear → time → raw. Bible 4.6.1 conversion chain.
}

// Ecology (Bible 4.4.3): балансирующая конвертация, метастабильность
function buildEcologySteps(mechanics: string[], ctx): CoreStep[] {
  const [observe, attack, defend, recover, adapt] = mechanics;
  return [
    { action: `Наблюдать состояние (${observe || "наблюдение"})`, mechanics: [observe || "observe"].filter(Boolean), resources_consumed: [], resources_produced: ["info"], feedback_type: "neutral", duration_estimate: 4 },
    { action: `Атаковать (${attack || "атака"})`, mechanics: [attack || "attack"].filter(Boolean), resources_consumed: ["stamina"], resources_produced: ["enemy_hp_down"], feedback_type: "positive", duration_estimate: 6 },
    { action: `Защититься (${defend || "защита"})`, mechanics: [defend || "defend"].filter(Boolean), resources_consumed: ["enemy_hp_down"], resources_produced: ["stamina"], feedback_type: "negative", duration_estimate: 5 },
    { action: `Восстановиться (${recover || "восстановление"})`, mechanics: [recover || "recover"].filter(Boolean), resources_consumed: ["info"], resources_produced: ["stamina"], feedback_type: "positive", duration_estimate: 7 },
    { action: `Адаптировать стратегию (${adapt || "адаптация"})`, mechanics: [adapt || "adapt"].filter(Boolean), resources_consumed: [], resources_produced: ["info"], feedback_type: "neutral", duration_estimate: 3 },
  ];
}

// Tower Defense (Bible 4.4.2 + type-specific)
function buildTowerDefenseSteps(mechanics: string[], ctx): CoreStep[] {
  const [build, defend, upgrade, repair, wave] = mechanics;
  return [
    { action: `Построить башню (${build || "строительство"})`, mechanics: [build || "build"].filter(Boolean), resources_consumed: ["gold"], resources_produced: ["tower"], feedback_type: "neutral", duration_estimate: 8 },
    { action: `Встретить волну (${wave || "волна"})`, mechanics: [wave || "wave"].filter(Boolean), resources_consumed: [], resources_produced: ["enemy"], feedback_type: "negative", duration_estimate: 15 },
    { action: `Защитить (${defend || "защита"})`, mechanics: [defend || "defend"].filter(Boolean), resources_consumed: ["tower"], resources_produced: ["kills"], feedback_type: "positive", duration_estimate: 12 },
    { action: `Получить награду за волну`, mechanics: [], resources_consumed: ["kills"], resources_produced: ["gold"], feedback_type: "positive", duration_estimate: 3 },
    { action: `Починить башню (${repair || "ремонт"})`, mechanics: [repair || "repair"].filter(Boolean), resources_consumed: ["gold"], resources_produced: ["tower"], feedback_type: "neutral", duration_estimate: 6 },
  ];
}

// Rhythm (Bible 4.4.1 + type-specific)
function buildRhythmSteps(mechanics: string[], ctx): CoreStep[] {
  const [listen, tap, combo, calibrate, reward] = mechanics;
  return [
    { action: `Слушать бит (${listen || "слушание"})`, mechanics: [listen || "listen"].filter(Boolean), resources_consumed: [], resources_produced: ["beat"], feedback_type: "neutral", duration_estimate: 2 },
    { action: `Нажать в ритм (${tap || "тап"})`, mechanics: [tap || "tap"].filter(Boolean), resources_consumed: ["beat"], resources_produced: ["hit"], feedback_type: "positive", duration_estimate: 1 },
    { action: `Накопить комбо (${combo || "комбо"})`, mechanics: [combo || "combo"].filter(Boolean), resources_consumed: ["hit"], resources_produced: ["combo", "score"], feedback_type: "positive", duration_estimate: 5 },
    { action: `Калибровка темпа (${calibrate || "калибровка"})`, mechanics: [calibrate || "calibrate"].filter(Boolean), resources_consumed: ["combo"], resources_produced: ["beat"], feedback_type: "neutral", duration_estimate: 3 },
    { action: `Получить награду за секцию (${reward || "награда"})`, mechanics: [reward || "reward"].filter(Boolean), resources_consumed: ["score"], resources_produced: ["unlock"], feedback_type: "positive", duration_estimate: 2 },
  ];
}

// Puzzle (Bible 4.4.2 + type-specific)
function buildPuzzleSteps(mechanics: string[], ctx): CoreStep[] {
  const [analyze, place, match, clear, hint] = mechanics;
  return [
    { action: `Анализировать доску (${analyze || "анализ"})`, mechanics: [analyze || "analyze"].filter(Boolean), resources_consumed: [], resources_produced: ["info"], feedback_type: "neutral", duration_estimate: 3 },
    { action: `Поставить фигуру (${place || "установка"})`, mechanics: [place || "place"].filter(Boolean), resources_consumed: ["piece"], resources_produced: ["board_state"], feedback_type: "neutral", duration_estimate: 2 },
    { action: `Сопоставить паттерн (${match || "сопоставление"})`, mechanics: [match || "match"].filter(Boolean), resources_consumed: ["board_state"], resources_produced: ["match"], feedback_type: "positive", duration_estimate: 4 },
    { action: `Очистить совпадение (${clear || "очистка"})`, mechanics: [clear || "clear"].filter(Boolean), resources_consumed: ["match"], resources_produced: ["score", "piece"], feedback_type: "positive", duration_estimate: 2 },
    { action: `Запросить подсказку (${hint || "подсказка"})`, mechanics: [hint || "hint"].filter(Boolean), resources_consumed: ["score"], resources_produced: ["info"], feedback_type: "negative", duration_estimate: 5 },
  ];
}
```

**Тест-кейсы**:
- `buildSteps(["атака","блок","лечение"], undefined, "ecology", {genre:"rpg"})` → 5 шагов, ни одна пара produced/consumed не оставляет dead_resources (все ресурсы имеют source+sink).
- `buildSteps(["explore","combat"], undefined, "engine", {genre:"action"})` → ≤4 шага (engine 4-step), mechanics[2..3] не нужны.
- `buildSteps(["build","defend","wave"], undefined, "tower_defense", {genre:"strategy"})` → 5 шагов с "Встретить волну" между build и defend.
- `buildSteps([], undefined, "rhythm", {})` → возвращает 5 шагов с fallback-метками "слушание/тап/комбо/калибровка/награда".
- Для каждого типа: замкнутость цикла (хотя бы один ресурс consumed → produced → consumed).

**Риски**:
- Существующий фронтенд (`src/app/blocks/2/page.tsx`) ожидает `steps: CoreStep[]` без жёсткой структуры — должно работать.
- `loop_hierarchy.micro` использует `steps.slice(0, 2).map(s => s.action)` — корректно для любого набора шагов.
- `pathologies.Brittleness` (`steps.every(s => s.mechanics.length <= 1)`) — некоторые новые builder'ы могут возвращать `mechanics: []` (например, "Получить награду за волну"). Нужно либо указать mechanic, либо ослабить проверку (см. TASK-2.3).
- AI enrichment prompt передаёт `steps.map(s => s.action)` — русские строки могут увеличить token usage.

**Dependencies**: TASK-1.9 (bilingual fix в Block 1), TASK-2.2 (тип по эстетике), TASK-2.7 (длительность по жанру), TASK-2.10 (pathology detection refactor).

---

### TASK-2.2: Классифицировать тип Core Loop по эстетике (Bible 4.11.1)

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-2.1)
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 95–107, 795–808), `src/lib/pipeline-helpers.ts` (строки 326–337)

**Описание проблемы**:

Bible 4.11.1明确规定:

> "Шаг 1: Определить целевую эстетику и жанр. Выход: профиль Core Loop — доминирующий тип эстетики определяет тип Core Loop:
> - Вызов → Engine
> - Открытие → Economy
> - Товарищество → Ecology
> - Подчинение → Engine"

Реализация использует `GENRE_DEFAULT_LOOP_TYPE[genre]` (строки 42–69) — например, `rpg: "economy"`, `action: "engine"`. Это не учитывает aesthetic profile из concept.

Текущая логика:
```ts
// route.ts:101-107
let type: string;
if (desiredLoopType && VALID_LOOP_TYPES.includes(desiredLoopType)) {
  type = desiredLoopType;  // явный override
} else {
  type = GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid";  // по жанру, не по эстетике
}
```

Проблема: `concept.aesthetic_profile.primary` (например, `"challenge"` для Shadow_Depths) НЕ используется для определения типа. Если пользователь хочет, чтобы тип определялся по эстетике, ему нужно вручную указать `desired_loop_type`.

**Решение**:

1. Загрузить `concept.aestheticProfile` из БД (через `project.concept.aestheticProfile`):
```ts
// route.ts:788-793 — расширить запрос proj
const proj = owned.project as {
  id: string;
  name: string;
  genre: string | null;
  concept?: {
    onePagerData?: string | null;
    aestheticProfile?: string | null;  // JSON: { primary: string, ... }
  } | null;
};

// Новая функция:
function inferLoopTypeFromAesthetic(primaryAesthetic?: string): LoopType {
  switch (primaryAesthetic) {
    case "challenge":     return "engine";    // Вызов → Engine
    case "discovery":     return "economy";   // Открытие → Economy
    case "fellowship":    return "ecology";   // Товарищество → Ecology
    case "submission":    return "engine";    // Подчинение → Engine
    case "sensation":     return "engine";    // default fallback
    case "fantasy":       return "economy";
    case "narrative":     return "hybrid";
    case "abnegation":    return "ecology";
    default:              return "hybrid";
  }
}
```

2. Обновить `classifyStructuralType` приоритет:
```ts
function determineType(
  desiredLoopType: string | undefined,
  genre: string,
  primaryAesthetic?: string
): string {
  if (desiredLoopType && VALID_LOOP_TYPES.includes(desiredLoopType)) return desiredLoopType;
  if (primaryAesthetic) {
    const fromAesthetic = inferLoopTypeFromAesthetic(primaryAesthetic);
    if (fromAesthetic) return fromAesthetic;
  }
  return GENRE_DEFAULT_LOOP_TYPE[genre.toLowerCase()] || "hybrid";
}
```

3. Парсить `aestheticProfile` JSON в route handler:
```ts
let primaryAesthetic: string | undefined;
if (proj.concept?.aestheticProfile) {
  try {
    const parsed = JSON.parse(proj.concept.aestheticProfile);
    primaryAesthetic = parsed?.primary;
  } catch { /* ignore */ }
}
const structuralType = classifyStructuralType(mechanics, genre, desiredLoopType, steps, primaryAesthetic);
```

4. `genre.toLowerCase()` — починить case mismatch (сейчас "RPG" → undefined → "hybrid").

**Тест-кейсы**:
- `determineType(undefined, "rpg", "challenge")` → `"engine"` (Bible: Вызов → Engine).
- `determineType(undefined, "rpg", "discovery")` → `"economy"`.
- `determineType(undefined, "rpg", "fellowship")` → `"ecology"`.
- `determineType("ecology", "rpg", "challenge")` → `"ecology"` (override приоритетнее).
- `determineType(undefined, "RPG", undefined)` → `"economy"` (case-insensitive lookup).
- `determineType(undefined, "tower_defense", undefined)` → `"economy"` (genre lookup, не "tower_defense" loop type).

**Риски**:
- Если `aestheticProfile` сохранён как `null` или с невалидным JSON — fallback на genre. Нужен defensive parsing.
- Существующие test_projects имеют `desired_loop_type` в test driver — override будет продолжать работать.
- `aestheticProfile` поле в Prisma `ProjectConcept` — нужно проверить наличие (см. `prisma/schema.prisma`).

**Dependencies**: TASK-1.6 (Block 1 — невалидные эстетики "competition"/"strategy" должны быть исправлены, иначе `inferLoopTypeFromAesthetic("competition")` → fallback "hybrid").

---

### TASK-2.3: Реализовать 7 Bible патологий (добавить 4 отсутствующих, переименовать/убрать 4 non-biblical)

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-2.4, TASK-2.13)
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 331–543, 71–80)

**Описание проблемы**:

Bible 4.10 определяет 7 патологий:
1. **Runaway** (4.10.1) — ✓ реализована (строки 346–359)
2. **Deadlock** (4.10.2) — ✓ реализована (строки 361–371)
3. **Stall** (4.10.3) — ✓ реализована (строки 373–383)
4. **Grind** (4.10.4) — ❌ ОТСУТСТВУЕТ
5. **Frustration Plateau** (4.10.5) — ❌ ОТСУТСТВУЕТ
6. **Disconnected Loops** (4.10.6) — ❌ ОТСУТСТВУЕТ
7. **Loop Overload** (4.10.7) — ❌ ОТСУТСТВУЕТ

Реализованы 4 **НЕ библейских** патологии:
- **Brittleness** (строки 385–395) — не в Bible, использует `steps.every(s => s.mechanics.length <= 1)` → для default template всегда true → помечена во всех 10 test_projects.
- **Oscillation** (строки 397–408) — не в Bible, использует `feedbackPattern.includes("positive-negative-positive")` → substring match может ложно срабатывать.
- **Stagnation** (строки 410–423) — не в Bible, использует substring matching mechanic names.
- **Triviality** (строки 425–435) — частично соответствует Bible "Loop Overload" (4.10.7), но проверяет только step count, не когнитивную нагрузку.

**Решение**:

Заменить `detectPathologies` на Bible-compliant версию. Сохранить 3 реализованных (Runaway, Deadlock, Stall), добавить 4 отсутствующих, убрать/переименовать 4 non-biblical:

```ts
function detectPathologies(steps: CoreStep[], structuralType: StructuralType, loopHierarchy?: LoopHierarchy): PathologyReport {
  const pathologies: Pathology[] = [];
  const likely = structuralType.risk_assessment.likely_pathologies;

  // === Bible 4.10.1: Runaway ===
  // Усиливающая петля без балансирующей. Диагностика: >60% positive feedback без negative sink.
  const positiveCount = steps.filter(s => s.feedback_type === "positive").length;
  const hasNegativeSink = steps.some(s => s.feedback_type === "negative" && s.resources_consumed.length > 0);
  if (positiveCount > steps.length * 0.6 && !hasNegativeSink) {
    pathologies.push({ name: "Runaway", type: "runaway", severity: "critical",
      description: `${positiveCount}/${steps.length} шагов с positive feedback без negative sink — ресурсы экспоненциально растут`,
      correction: "Добавить тормозящий шаг (drain, налог, износ) для предотвращения runaway",
      affected_resources: steps.flatMap(s => s.resources_produced).slice(0, 5) });
  }

  // === Bible 4.10.2: Deadlock ===
  // Ресурс цикла нужен для запуска самого цикла. Диагностика: steps.length < 3 или ресурс потребляется до того, как производится.
  if (steps.length < 3) {
    pathologies.push({ name: "Deadlock", type: "deadlock", severity: "critical",
      description: `Только ${steps.length} шаг(ов) — риск круговой зависимости без выхода`,
      correction: "Добавить минимум 3 различных шага и убедиться, что каждый ресурс имеет независимый источник",
      affected_resources: [] });
  }

  // === Bible 4.10.3: Stall ===
  // Потребление превышает производство. Диагностика: нет positive feedback ИЛИ dead_resources > produced/2.
  const deadResources = computeDeadResources(steps);
  if (positiveCount === 0 || deadResources.length > steps.flatMap(s => s.resources_produced).length / 2) {
    pathologies.push({ name: "Stall", type: "stall", severity: "warning",
      description: positiveCount === 0
        ? "Нет positive-feedback шагов — игрок не получает подкрепления"
        : `${deadResources.length} ресурсов без потребления — производство простаивает`,
      correction: "Добавить шаг с positive feedback ИЛИ потребителя для produced ресурсов",
      affected_resources: deadResources });
  }

  // === Bible 4.10.4: Grind (НОВОЕ) ===
  // Каждый проход идентичен предыдущему — нет вариации. Диагностика: все шаги имеют одинаковый feedback_type или одинаковую duration.
  const feedbackTypes = new Set(steps.map(s => s.feedback_type));
  const durations = new Set(steps.map(s => s.duration_estimate));
  if (feedbackTypes.size <= 1 || durations.size <= 1) {
    pathologies.push({ name: "Grind", type: "grind", severity: "warning",
      description: feedbackTypes.size <= 1
        ? `Все ${steps.length} шагов имеют feedback_type="${steps[0]?.feedback_type}" — нет вариации`
        : `Все шаги имеют одинаковую duration=${steps[0]?.duration_estimate}s — монотонность`,
      correction: "Ввести динамическую настройку прибыльности (Bible 4.6.2): ранние проходы прибыльные, поздние — убыточные",
      affected_resources: [] });
  }

  // === Bible 4.10.5: Frustration Plateau (НОВОЕ) ===
  // Игрок застревает без прогрессии. Диагностика: нет progression-шага (mechanics.includes level/upgrade/perk) ИЛИ все positive steps требуют потребления > производства.
  const hasProgression = steps.some(s =>
    s.mechanics.some(m => /level|upgrade|perk|progress|tier/i.test(m))
  );
  const allLossy = steps.every(s => s.resources_consumed.length >= s.resources_produced.length);
  if (!hasProgression || allLossy) {
    pathologies.push({ name: "Frustration Plateau", type: "frustration_plateau", severity: "warning",
      description: !hasProgression
        ? "Нет progression-механики (level/upgrade/perk) — игрок не видит долгосрочного роста"
        : "Все шаги убыточные (consumed ≥ produced) — ресурсы убывают без прорыва",
      correction: "Добавить progression-шаг ИЛИ альтернативный путь (Bible 4.10.5: «аварийный» ресурс после повторных неудач)",
      affected_resources: [] });
  }

  // === Bible 4.10.6: Disconnected Loops (НОВОЕ) ===
  // Микро-циклы не связаны с макро-циклами. Диагностика: loopHierarchy.micro и loopHierarchy.macro не имеют общих ресурсов.
  if (loopHierarchy) {
    const microActions = (loopHierarchy.micro || []).flatMap(l => l.actions);
    const macroActions = (loopHierarchy.macro || []).flatMap(l => l.actions);
    const microResources = steps.slice(0, 2).flatMap(s => [...s.resources_consumed, ...s.resources_produced]);
    const macroResources = steps.slice(-2).flatMap(s => [...s.resources_consumed, ...s.resources_produced]);
    const shared = microResources.filter(r => macroResources.includes(r));
    if (shared.length === 0 && microActions.length > 0 && macroActions.length > 0) {
      pathologies.push({ name: "Disconnected Loops", type: "disconnected_loops", severity: "warning",
        description: "Микро-циклы не связаны с макро-циклами по ресурсам — результаты микро не поднимаются к макро",
        correction: "Спроектировать конверсионную цепь (Bible 4.6.1) — каждый ресурс микро-цикла должен потребляться в макро-цикле",
        affected_resources: [] });
    }
  }

  // === Bible 4.10.7: Loop Overload (НОВОЕ, частично заменяет Triviality) ===
  // Слишком много решений за один проход — когнитивная перегрузка. Диагностика: >7 шагов ИЛИ >5 различных ресурсов ИЛИ >3 различных feedback_type.
  const distinctResources = new Set(steps.flatMap(s => [...s.resources_consumed, ...s.resources_produced]));
  const distinctFeedbacks = new Set(steps.map(s => s.feedback_type));
  if (steps.length > 7 || distinctResources.size > 5 || distinctFeedbacks.size > 3) {
    pathologies.push({ name: "Loop Overload", type: "loop_overload", severity: "info",
      description: `${steps.length} шагов, ${distinctResources.size} ресурсов, ${distinctFeedbacks.size} feedback типов — когнитивная перегрузка`,
      correction: "Упростить Core Loop до 3-5 ключевых решений (Bible 4.9.1: экономия действий)",
      affected_resources: [] });
  }

  // === Type-specific патологии (сохранить) ===
  // Tower_defense, Rhythm, Puzzle — оставить как есть, но убрать || logic (TASK-2.10)
  // ...

  return { pathologies, total_count: pathologies.length, critical_count: pathologies.filter(p => p.severity === "critical").length };
}
```

**Что убрать**:
- `Brittleness` (строки 385–395) — не в Bible. Заменить на "Disconnected Loops" (проверка связи микро-макро).
- `Oscillation` (строки 397–408) — не в Bible. Убрать совсем.
- `Stagnation` (строки 410–423) — поглощается "Frustration Plateau" (проверка progression mechanic).
- `Triviality` (строки 425–435) — поглощается "Loop Overload" (более полная проверка).

**Тест-кейсы**:
- 5-step default template (Runaway/Deadlock/Stall отсутствуют, Grind для одинаковых durations, Frustration Plateau если нет progression): ожидается 1–2 патологии, не "Brittleness" + "Oscillation" + "Stagnation".
- Цикл с 8 шагами → Loop Overload.
- Цикл с 4 разными feedback_types → Loop Overload.
- Цикл с 2 шагами → Deadlock critical.
- Все positive feedback без sink → Runaway critical.
- Ecology cycles без shared ресурсов между micro/macro → Disconnected Loops.

**Риски**:
- Существующий фронтенд `PathologyPanel.tsx` рендерит `pathologies.pathologies` по `type` — новые типы (`grind`, `frustration_plateau`, `disconnected_loops`, `loop_overload`) нужно добавить в `SEVERITY_STYLES` (constants/coreloop.ts:35).
- Type-specific pathologies для tower_defense/rhythm/puzzle нужно сохранить (см. TASK-2.10).
- `buildRecommendations` (строки 621–746) проходит по `pathologies.pathologies` и генерирует recommendation для каждой — новые типы будут автоматически давать "Fix Grind" / "Fix Loop Overload" etc. Нужны конкретные corrections (см. TASK-2.13).

**Dependencies**: TASK-2.1 (новые builder'ы производят разные resources, иначе Grind/Loop Overload всегда сработают).

---

### TASK-2.4: Реальная проверка замкнутости цикла (`loop_closedness.is_closed`)

**Сложность**: M
**Приоритет**: 🔴
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 559–563)

**Описание проблемы**:

```ts
// route.ts:559-563
const loopClosedness = {
  is_closed: true,  // ← ВСЕГДА TRUE
  connection_description: `Last step "${steps[steps.length - 1]?.action || "return"}" feeds back into first step "${steps[0]?.action || "find"}"`,
};
```

`is_closed = true` для всех 10 test_projects, включая проекты с 6 dead_resources и 2 unsourced_consumables. Описание — статический шаблон, не реальная проверка.

Bible 4.11.7: "«Закрыть петлю» (Селлерс): обеспечить, что игрок может действовать, видеть результат и учиться".

Bible 4.11.4: "Каждый ресурс имеет как минимум один источник и один сток".

**Решение**:

Реальная проверка замкнутости через resource flow:

```ts
function computeLoopClosedness(steps: CoreStep[]): {
  is_closed: boolean;
  connection_description: string;
  closing_resource?: string;
} {
  if (steps.length < 2) {
    return {
      is_closed: false,
      connection_description: `Только ${steps.length} шаг(ов) — цикл не замкнут`,
    };
  }
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];

  // Замкнутость: последний шаг производит ресурс, потребляемый первым шагом.
  const closingResources = lastStep.resources_produced.filter(r =>
    firstStep.resources_consumed.includes(r)
  );
  if (closingResources.length > 0) {
    return {
      is_closed: true,
      connection_description: `Последний шаг "${lastStep.action}" производит "${closingResources[0]}", потребляемый первым шагом "${firstStep.action}"`,
      closing_resource: closingResources[0],
    };
  }

  // Альтернатива: транзитивная замкнутость — какой-либо ресурс произведён и потребляется в цикле.
  const allProduced = new Set(steps.flatMap(s => s.resources_produced));
  const allConsumed = new Set(steps.flatMap(s => s.resources_consumed));
  const circulating = Array.from(allProduced).filter(r => allConsumed.has(r));
  if (circulating.length > 0) {
    return {
      is_closed: true,
      connection_description: `Цикл замкнут через ресурс "${circulating[0]}" (производится и потребляется)`,
      closing_resource: circulating[0],
    };
  }

  // Не замкнут: все produced ресурсы — dead, все consumed — unsourced.
  return {
    is_closed: false,
    connection_description: `Последний шаг "${lastStep.action}" не производит ресурс, потребляемый первым шагом "${firstStep.action}". Нет циркулирующих ресурсов.`,
  };
}
```

Использовать в `buildValidation`:
```ts
// route.ts:559 — заменить
const loopClosedness = computeLoopClosedness(steps);
```

**Тест-кейсы**:
- `[{produced:["a"], consumed:[]}, {produced:[], consumed:["a"]}]` → `is_closed=true`, `closing_resource="a"`.
- `[{produced:["a"], consumed:["b"]}, {produced:["b"], consumed:["a"]}]` → `is_closed=true` (через циркуляцию).
- `[{produced:["a"], consumed:[]}, {produced:["b"], consumed:["c"]}]` → `is_closed=false` (a,b — dead; c — unsourced).
- Default template (engine builder после TASK-2.1): `[{produced:["resource"], consumed:["resource"]}, ...]` → `is_closed=true` через `resource`.
- Default template (старый): `[{produced:["signal"], consumed:[]}, ..., {produced:["rest","save"], consumed:[]}]` → `is_closed=false` (signal/rest/save — dead).

**Риски**:
- Тест_projects будут иметь `is_closed=false` для текущего шаблона → `overall_passed=false` для всех 10 (вместо 9). Это **правильное поведение** (цикл действительно не замкнут), но изменит UX.
- `checklist_passed` будет 3/5 (вместо 4/5) для текущих test_projects. Нужно обновить порог `overallPassed` (см. TASK-2.16).

**Dependencies**: TASK-2.1 (новые builder'ы производят циркулирующие ресурсы), TASK-2.8 (убрать dead_resources из шаблона).

---

### TASK-2.5: Добавить meaningful sub_types для tower_defense/rhythm/puzzle

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 109–129)

**Описание проблемы**:

```ts
// route.ts:109-129
let subType = "hybrid_engine";
if (type === "engine") {
  subType = hasConsumed ? "braked_engine" : "pure_engine";
} else if (type === "economy") {
  subType = currencies.size >= 3 ? "multi_currency_economy" : "single_currency_economy";
} else if (type === "ecology") {
  subType = "balanced_ecology";
} else {
  // hybrid — также покрывает tower_defense, rhythm, puzzle!
  subType = mechanics.length % 2 === 0 ? "hybrid_engine" : "hybrid_economy";
}
```

Для `type="tower_defense"`, `type="rhythm"`, `type="puzzle"` (не engine/economy/ecology) попадают в `else` ветку с meaningless parity heuristic. Test JSON показывает `sub_type="hybrid_engine"` для всех 3 типов — не отражает реальную структуру.

**Решение**:

Добавить явные ветки для tower_defense/rhythm/puzzle:

```ts
function classifySubType(type: string, steps: CoreStep[], mechanics: string[]): string {
  switch (type) {
    case "engine":
      return steps.some(s => s.resources_consumed.length > 0) ? "braked_engine" : "pure_engine";
    case "economy": {
      const currencies = new Set<string>();
      for (const s of steps) {
        s.resources_consumed.forEach(r => currencies.add(r));
        s.resources_produced.forEach(r => currencies.add(r));
      }
      return currencies.size >= 3 ? "multi_currency_economy" : "single_currency_economy";
    }
    case "ecology":
      // Bible 4.4.3: 3 типа — Inventory, Combat, Social
      if (steps.some(s => s.mechanics.some(m => /inventory|item|loot/i.test(m)))) return "inventory_ecology";
      if (steps.some(s => s.mechanics.some(m => /attack|defend|combat|hp/i.test(m)))) return "combat_ecology";
      if (steps.some(s => s.mechanics.some(m => /faction|social|coop|pvp/i.test(m)))) return "social_ecology";
      return "balanced_ecology";
    case "tower_defense": {
      const laneCount = steps.filter(s => s.mechanics.some(m => /lane|path/i.test(m))).length;
      if (laneCount > 1) return "multi_lane_td";
      const hasBossWaves = steps.some(s => s.mechanics.some(m => /boss|elite/i.test(m)));
      return hasBossWaves ? "boss_wave_td" : "single_lane_td";
    }
    case "rhythm": {
      const trackCount = steps.filter(s => s.mechanics.some(m => /track|lane|button/i.test(m))).length;
      return trackCount > 1 ? "multi_track_rhythm" : "single_track_rhythm";
    }
    case "puzzle": {
      const hasBranching = steps.some(s => s.mechanics.some(m => /branch|path|choice/i.test(m)));
      return hasBranching ? "branching_puzzle" : "linear_puzzle";
    }
    case "hybrid":
    default:
      return mechanics.length % 2 === 0 ? "hybrid_engine" : "hybrid_economy";
  }
}
```

Также обновить `resources.class_` для новых типов:

```ts
// route.ts:142-150 — заменить
const resources = currencies.map((name) => {
  let cls: string;
  switch (type) {
    case "engine":        cls = "core"; break;
    case "economy":       cls = "currency"; break;
    case "ecology":       cls = "balance_state"; break;
    case "tower_defense": cls = name.match(/gold|resource|cost/i) ? "currency" : "structural"; break;
    case "rhythm":        cls = name.match(/score|combo/i) ? "progression" : "input_state"; break;
    case "puzzle":        cls = name.match(/piece|block|shape/i) ? "piece" : "board_state"; break;
    default:              cls = "balance_state";
  }
  return { name, class_: cls };
});
```

**Тест-кейсы**:
- `classifySubType("tower_defense", [...], ["build","defend","wave"])` → `"single_lane_td"` (по умолчанию).
- `classifySubType("tower_defense", [{mechanics:["lane1","lane2"]}, ...], [...])` → `"multi_lane_td"`.
- `classifySubType("rhythm", [{mechanics:["track1"]}, {mechanics:["track2"]}], ...)` → `"multi_track_rhythm"`.
- `classifySubType("puzzle", [{mechanics:["branch","choice"]}, ...], ...)` → `"branching_puzzle"`.
- `classifySubType("ecology", [{mechanics:["combat","attack"]}, ...], ...)` → `"combat_ecology"`.

**Риски**:
- Существующий фронтенд `StructuralTypeCard.tsx` рендерит `sub_type` как строку — нужно проверить, что новые значения отображаются корректно.
- Type-specific pathology detection (tower_defense/rhythm/puzzle) использует `m.includes("build")` и т.д. — substring matching может конфликтовать с новыми sub_type definitions. Нужно унифицировать (см. TASK-2.12).

**Dependencies**: TASK-2.1 (новые builder'ы передают mechanics с осмысленными именами), TASK-2.12 (заменить substring matching).

---

### TASK-2.6: Реализовать 5 вопросов Гэри (Bible 4.7, 4.11.2)

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (новая функция, вызов в POST handler)

**Описание проблемы**:

Bible 4.7 определяет 5 вопросов Гэри для верификации Core Loop:
1. **Какой игровой цикл?** (4.7.1) — Можно ли описать в 1-2 предложениях?
2. **В чём главный конфликт?** (4.7.2) — Какое ограничение стоит на пути?
3. **Какие ресурсы?** (4.7.3) — Масштабируемые / Фиксированные / Накапливаемые.
4. **Как происходит взаимодействие?** (4.7.4) — 5 типов: Hot shared / Cold shared / Прямой урон / Социальная дедукция / Интеллектуальная дедукция.
5. **В чём цель игры?** (4.7.5) — Элиминация / Ограничение по времени / Достижение цели.

Реализация полностью отсутствует. Bible 4.11.2 шаг 2 требует прохождения этих вопросов.

**Решение**:

Добавить новую функцию `runGaryFiveQuestions`:

```ts
interface GaryFiveQuestions {
  cycle_description: string;        // Q1
  main_conflict: string;            // Q2
  resource_types: {                 // Q3
    scalable: string[];
    fixed: string[];
    accumulating: string[];
  };
  interaction_type: {               // Q4
    type: "hot_shared" | "cold_shared" | "direct_damage" | "social_deduction" | "intellectual_deduction";
    description: string;
  };
  goal_type: {                      // Q5
    type: "elimination" | "time_limited" | "goal_achievement";
    description: string;
  };
  pass: boolean;  // true если все 5 вопросов имеют осмысленный ответ
}

function runGaryFiveQuestions(
  steps: CoreStep[],
  structuralType: StructuralType,
  genre: string,
  idea?: string
): GaryFiveQuestions {
  // Q1: Cycle description — concatenation первых 3 actions.
  const cycleDescription = steps.slice(0, 3).map(s => s.action).join(" → ") + " → ...";

  // Q2: Main conflict — derived from structural type.
  const conflictMap: Record<string, string> = {
    engine: "Дефицит ресурсов против роста потребления",
    economy: "Ограниченная конвертация против неограниченных желаний",
    ecology: "Балансирование противодействующих сил",
    hybrid: "Множественные конкурирующие цели",
    tower_defense: "Ограниченный бюджет защиты против растущих волн",
    rhythm: "Темп игры против способности игрока",
    puzzle: "Ограниченные ходы против сложности паттерна",
  };
  const mainConflict = conflictMap[structuralType.type] || "Конфликт не определён";

  // Q3: Resource types — classify by production pattern.
  const allResources = Array.from(new Set(steps.flatMap(s => [...s.resources_consumed, ...s.resources_produced])));
  const producedCounts: Record<string, number> = {};
  for (const s of steps) for (const r of s.resources_produced) producedCounts[r] = (producedCounts[r] || 0) + 1;
  const consumedCounts: Record<string, number> = {};
  for (const s of steps) for (const r of s.resources_consumed) consumedCounts[r] = (consumedCounts[r] || 0) + 1;
  const scalable = allResources.filter(r => (producedCounts[r] || 0) >= 2);  // производится многократно
  const fixed = allResources.filter(r => (producedCounts[r] || 0) === 1 && (consumedCounts[r] || 0) === 1);  // 1:1
  const accumulating = allResources.filter(r => (producedCounts[r] || 0) > (consumedCounts[r] || 0));  // net positive

  // Q4: Interaction type — derived from genre + mechanic names.
  const mechanicStr = steps.flatMap(s => s.mechanics).join(" ").toLowerCase();
  let interactionType: GaryFiveQuestions["interaction_type"]["type"] = "direct_damage";
  let interactionDesc = "Прямой урон — атака, разрушение, устранение";
  if (/social|coop|guild|party/.test(mechanicStr)) {
    interactionType = "social_deduction";
    interactionDesc = "Социальная дедукция — блеф, скрытые роли";
  } else if (/puzzle|logic|clue|deduc/.test(mechanicStr)) {
    interactionType = "intellectual_deduction";
    interactionDesc = "Интеллектуальная дедукция — логический вывод";
  } else if (/trade|auction|draft/.test(mechanicStr)) {
    interactionType = "cold_shared";
    interactionDesc = "Холодные общие ресурсы — скрытый выбор";
  } else if (/territory|capture|control/.test(mechanicStr)) {
    interactionType = "hot_shared";
    interactionDesc = "Горячие общие ресурсы — видимый захват";
  }

  // Q5: Goal type — derived from genre.
  const goalMap: Record<string, GaryFiveQuestions["goal_type"]["type"]> = {
    shooter: "elimination", action: "elimination", fighting: "elimination",
    rpg: "goal_achievement", adventure: "goal_achievement", puzzle: "goal_achievement",
    strategy: "time_limited", rts: "time_limited", racing: "time_limited",
    rhythm: "goal_achievement", tower_defense: "time_limited",
  };
  const goalType = goalMap[genre.toLowerCase()] || "goal_achievement";
  const goalDescMap: Record<string, string> = {
    elimination: "Элиминация — последний выживший побеждает",
    time_limited: "Ограничение по времени — побеждает достигший больше к моменту истечения",
    goal_achievement: "Достижение цели — первый достигший целевого состояния побеждает",
  };

  const pass = !!(cycleDescription && mainConflict && scalable.length + fixed.length + accumulating.length > 0);
  return {
    cycle_description: cycleDescription,
    main_conflict: mainConflict,
    resource_types: { scalable, fixed, accumulating },
    interaction_type: { type: interactionType, description: interactionDesc },
    goal_type: { type: goalType, description: goalDescMap[goalType] },
    pass,
  };
}
```

Добавить в результат route:
```ts
// route.ts:853-867 — расширить result
let result: Record<string, unknown> = {
  id: proj.id,
  structural_type: structuralType,
  steps,
  // ... существующие поля ...
  gary_five_questions: runGaryFiveQuestions(steps, structuralType, genre, idea),  // НОВОЕ
  // ...
};
```

**Тест-кейсы**:
- Engine builder (TASK-2.1): `scalable=["resource"]`, `fixed=[]`, `accumulating=["xp"]`, `interaction_type="direct_damage"`, `goal_type` по жанру.
- Tower_defense builder: `scalable=["gold","tower"]`, `interaction_type` зависит от mechanic names (если есть "territory" → hot_shared).
- Empty mechanics: `cycle_description` использует fallback labels.
- Genre="rhythm": `goal_type="goal_achievement"`.

**Риски**:
- Существующий тип `CoreLoopDesignResult` (src/types/coreloop.ts) использует `Record<string, unknown>` для большинства полей — добавление нового поля безопасно.
- Фронтенд не отображает эти данные — нужно добавить UI компонент (опционально, не блокирующее).
- AI enrichment не использует эти данные — можно расширить prompt (см. TASK-2.19).

**Dependencies**: TASK-2.1 (новые builder'ы дают meaningful mechanic names для Q3/Q4).

---

### TASK-2.7: Масштаб Core Loop по жанру (Bible 4.11.3, таблица 4.8.3)

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 207–278, новая константа)

**Описание проблемы**:

Bible 4.11.3 + таблица 4.8.3 определяют оптимальный масштаб Core Loop по жанру:

| Жанр | Оптимальный масштаб | Что делает цикл |
|------|---------------------|-----------------|
| Шутер | 10–30 секунд | Боевой encounter |
| RPG | 2–5 минут | Бой → лут → прокачка |
| Стратегия | 5–15 минут | Ход → решение → результат |
| MMO-рейд | 15–30 минут | Попытка → анализ → коррекция |
| Настольная игра | 5–15 минут | Ход → взаимодействие → результат |
| Idle-игра | 30–60 секунд | Нажатие → награда → улучшение |

Реализация: `duration_estimate` захардкожен `6/10/4/8/5` сек (строки 243, 251, 259, 267, 275) — НЕ зависит от жанра. Для shooter 5 шагов = 33 сек (close to Bible), для RPG = 33 сек (должно быть 120–300 сек), для strategy = 33 сек (должно быть 300–900 сек).

Также `outer_loops[0].duration_estimate = 300` (5 min hardcoded), `meta_loop.duration_estimate = 604800` (1 week hardcoded) — не зависят от жанра.

**Решение**:

Добавить жанровую таблицу длительностей:

```ts
// Новая константа:
const GENRE_LOOP_SCALE: Record<string, {
  step_duration_range: [number, number];  // sec
  outer_loop_duration: number;            // sec
  meta_loop_duration: number;             // sec (1 day = 86400, 1 week = 604800
}> = {
  shooter:      { step_duration_range: [2, 10],  outer_loop_duration: 30,   meta_loop_duration: 86400 },     // 1 day
  action:       { step_duration_range: [3, 10],  outer_loop_duration: 60,   meta_loop_duration: 86400 },
  platformer:   { step_duration_range: [2, 8],   outer_loop_duration: 30,   meta_loop_duration: 86400 },
  fighting:     { step_duration_range: [2, 5],   outer_loop_duration: 30,   meta_loop_duration: 86400 },
  rhythm:       { step_duration_range: [1, 3],   outer_loop_duration: 180,  meta_loop_duration: 604800 },    // 1 week
  racing:       { step_duration_range: [5, 15],  outer_loop_duration: 300,  meta_loop_duration: 604800 },
  rpg:          { step_duration_range: [30, 90], outer_loop_duration: 600,  meta_loop_duration: 2592000 },   // 30 days
  action_rpg:   { step_duration_range: [15, 45], outer_loop_duration: 300,  meta_loop_duration: 2592000 },
  jrpg:         { step_duration_range: [60, 120],outer_loop_duration: 900,  meta_loop_duration: 2592000 },
  tactical_rpg: { step_duration_range: [120, 300], outer_loop_duration: 1800, meta_loop_duration: 2592000 },
  mmorpg:       { step_duration_range: [60, 180],outer_loop_duration: 1800, meta_loop_duration: 2592000 },
  strategy:     { step_duration_range: [60, 180],outer_loop_duration: 900,  meta_loop_duration: 2592000 },
  rts:          { step_duration_range: [30, 90], outer_loop_duration: 600,  meta_loop_duration: 2592000 },
  tbs:          { step_duration_range: [180, 600],outer_loop_duration: 3600, meta_loop_duration: 2592000 },
  tower_defense:{ step_duration_range: [10, 30], outer_loop_duration: 300,  meta_loop_duration: 604800 },
  simulation:   { step_duration_range: [30, 120],outer_loop_duration: 1800, meta_loop_duration: 2592000 },
  sandbox:      { step_duration_range: [60, 300],outer_loop_duration: 3600, meta_loop_duration: 2592000 },
  horror:       { step_duration_range: [15, 60], outer_loop_duration: 600,  meta_loop_duration: 604800 },
  survival_horror: { step_duration_range: [30, 90], outer_loop_duration: 900, meta_loop_duration: 2592000 },
  roguelike:    { step_duration_range: [10, 30], outer_loop_duration: 300,  meta_loop_duration: 604800 },
  adventure:    { step_duration_range: [60, 180],outer_loop_duration: 1800, meta_loop_duration: 2592000 },
  puzzle:       { step_duration_range: [5, 20],  outer_loop_duration: 180,  meta_loop_duration: 604800 },
  metroidvania: { step_duration_range: [30, 90], outer_loop_duration: 1800, meta_loop_duration: 2592000 },
  idle:         { step_duration_range: [5, 15],  outer_loop_duration: 60,   meta_loop_duration: 86400 },
  visual_novel: { step_duration_range: [120, 600],outer_loop_duration: 3600,meta_loop_duration: 2592000 },
  stealth:      { step_duration_range: [15, 60], outer_loop_duration: 600,  meta_loop_duration: 2592000 },
};

function getGenreLoopScale(genre: string) {
  return GENRE_LOOP_SCALE[genre.toLowerCase()] || GENRE_LOOP_SCALE.action;
}
```

Использовать в `buildSteps` (каждом type-specific builder'е):

```ts
function buildEngineSteps(mechanics: string[], ctx: { genre: string; idea?: string }): CoreStep[] {
  const scale = getGenreLoopScale(ctx.genre);
  const randomDur = () => Math.round(scale.step_duration_range[0] + Math.random() * (scale.step_duration_range[1] - scale.step_duration_range[0]));
  // Использовать randomDur() для duration_estimate каждого шага
  // ИЛИ детерминированно: scale.step_duration_range[0] + i * (range / steps.length)
  return [
    { action: "...", ..., duration_estimate: scale.step_duration_range[0] },
    { action: "...", ..., duration_estimate: Math.round((scale.step_duration_range[0] + scale.step_duration_range[1]) / 2) },
    // ...
  ];
}
```

Также обновить `outer_loops` и `meta_loop`:
```ts
const scale = getGenreLoopScale(genre);
const outerLoops = [
  { name: "session_loop", actions: [...], duration_estimate: scale.outer_loop_duration, type: "outer" },
];
const metaLoop = {
  name: "meta_progression", actions: [...], duration_estimate: scale.meta_loop_duration, type: "meta",
};
```

**Тест-кейсы**:
- `getGenreLoopScale("shooter").step_duration_range` → `[2, 10]`.
- `getGenreLoopScale("RPG")` → `{step_duration_range: [30, 90], ...}` (case-insensitive).
- `getGenreLoopScale("unknown")` → fallback `action` scale.
- Engine builder для shooter: step durations в [2, 10] сек.
- Engine builder для strategy: step durations в [60, 180] сек.
- Outer loop для RPG: 600 сек (10 мин).
- Meta loop для idle: 86400 сек (1 день).

**Риски**:
- Если `Math.random()` используется — нарушит determinism (см. Block 5b finding в AUDIT_REPORT). Использовать детерминированную формулу: `scale.step_duration_range[0] + i * step`.
- Изменит существующие test_projects outputs (latency_ms, scores). Нужно перегенерировать test_projects после рефакторинга.

**Dependencies**: TASK-2.1 (новые builder'ы потребляют scale).

---

### TASK-2.8: Убрать dead_resources и unsourced_consumables из default template

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-2.4)
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 236–278)

**Описание проблемы**:

Текущий default template (после TASK-2.1 — это будут type-specific builder'ы, но та же проблема):

```ts
// Старый шаблон:
{ resources_produced: ["signal"], resources_consumed: [] },  // signal — DEAD (никогда не потребляется)
{ resources_produced: [], resources_consumed: ["energy", "ammo"] },  // energy, ammo — UNSOURCED
{ resources_produced: ["xp", "gold"], resources_consumed: [] },  // xp — DEAD (часть), gold — потребляется в step 4
{ resources_produced: ["power", "ability"], resources_consumed: ["gold"] },  // power, ability — DEAD
{ resources_produced: ["rest", "save"], resources_consumed: [] },  // rest, save — DEAD
```

Подтверждено для всех 10 test_projects: `dead_resources: ["signal","xp","power","ability","rest","save"]` (6 шт.) + `unsourced_consumables: ["energy","ammo"]` (2 шт.).

Bible 4.11.4: "Каждый ресурс имеет как минимум один источник и один сток".

**Решение**:

В каждом type-specific builder'е (TASK-2.1) обеспечить циркуляцию:

```ts
// Engine builder (Bible 4.4.1: boosting + braking)
function buildEngineSteps(mechanics: string[], ctx): CoreStep[] {
  return [
    { ..., resources_consumed: ["resource"], resources_produced: [] },          // step 1: тратит resource
    { ..., resources_consumed: [], resources_produced: ["resource"] },          // step 2: производит resource (источник для step 1)
    { ..., resources_consumed: ["resource"], resources_produced: ["xp"] },      // step 3: тратит resource, даёт xp
    { ..., resources_consumed: ["xp"], resources_produced: ["resource"] },      // step 4: тратит xp (sink), даёт resource
  ];
  // Циркуляция: resource ↔ xp. Нет dead, нет unsourced.
}

// Economy builder (Bible 4.6.1: conversion chain)
function buildEconomySteps(mechanics: string[], ctx): CoreStep[] {
  return [
    { ..., resources_consumed: ["time"], resources_produced: ["raw"] },          // time ← step 5; raw → step 2
    { ..., resources_consumed: ["raw"], resources_produced: ["craft"] },         // raw ← step 1; craft → step 3
    { ..., resources_consumed: ["craft"], resources_produced: ["gold"] },        // craft ← step 2; gold → step 4
    { ..., resources_consumed: ["gold"], resources_produced: ["gear"] },         // gold ← step 3; gear → step 5
    { ..., resources_consumed: ["gear"], resources_produced: ["time"] },         // gear ← step 4; time → step 1
  ];
  // Циркуляция: time → raw → craft → gold → gear → time. Bible 4.6.1 conversion cycle.
}

// Ecology builder (Bible 4.4.3: balancing)
function buildEcologySteps(mechanics: string[], ctx): CoreStep[] {
  return [
    { ..., resources_consumed: [], resources_produced: ["info"] },               // info → step 2, 4
    { ..., resources_consumed: ["info", "stamina"], resources_produced: ["enemy_hp"] },  // stamina ← step 3; enemy_hp → step 3
    { ..., resources_consumed: ["enemy_hp"], resources_produced: ["stamina"] },  // enemy_hp ← step 2; stamina → step 2
    { ..., resources_consumed: ["info"], resources_produced: ["info"] },         // info циркулирует
    { ..., resources_consumed: [], resources_produced: ["info"] },               // info накопление
  ];
}
```

**Тест-кейсы**:
- `computeLoopClosedness(buildEngineSteps(...))` → `is_closed=true`.
- `computeDeadResources(buildEngineSteps(...))` → `[]` (пусто).
- `computeUnsourcedConsumables(buildEngineSteps(...))` → `[]` (пусто).
- Все 7 builder'ы: 0 dead, 0 unsourced.

**Риски**:
- `buildValidation` уже помечает dead/unsourced в warnings. После фикса warnings пропадут — это изменит UX (пользователь больше не увидит предупреждений).
- Type-specific pathology detection может зависеть от конкретных ресурсов (например, tower_defense проверяет "build"/"defend" mechanic names, не resource names).

**Dependencies**: TASK-2.1 (новые builder'ы), TASK-2.4 (computeLoopClosedness использует resource flow).

---

### TASK-2.9: Починить customSteps mode — заменить шаблонные ресурсы на вычисляемые

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 213–227)

**Описание проблемы**:

```ts
// route.ts:213-227
if (customSteps && customSteps.length > 0) {
  return customSteps.slice(0, 10).map((action, i) => {
    const mech = mechanics[i % Math.max(1, mechanics.length)] || "core_action";
    const feedbackType: CoreStep["feedback_type"] =
      i % 3 === 0 ? "positive" : i % 3 === 1 ? "negative" : "neutral";
    return {
      action,
      mechanics: [mech],
      resources_consumed: feedbackType === "negative" ? ["energy"] : [],
      resources_produced: feedbackType === "positive" ? ["xp", "score"] : [],
      feedback_type: feedbackType,
      duration_estimate: 5 + (i % 5) * 2,
    };
  });
}
```

Проблемы:
1. **feedback_type** циклически `positive/negative/neutral` по `i % 3` — не зависит от action.
2. **resources_consumed** для negative = `["energy"]` (хардкод, никогда не производится) → **гарантированные unsourced_consumables**.
3. **resources_produced** для positive = `["xp", "score"]` (хардкод, никогда не потребляются) → **гарантированные dead_resources**.
4. **mechanics** берутся циклически из входного массива — `mechanics[i % Math.max(1, mechanics.length)]` — если mechanics.length=1, все шаги получат один и тот же mechanic.
5. **duration_estimate** = `5 + (i % 5) * 2` — детерминированный шаблон 5/7/9/11/13 сек, не зависит от action или жанра.

**Решение**:

Заменить на type-aware resource assignment + closed loop guarantee:

```ts
function buildCustomSteps(
  mechanics: string[],
  customSteps: string[],
  type: LoopType,
  genre: string
): CoreStep[] {
  const scale = getGenreLoopScale(genre);  // TASK-2.7
  const steps = customSteps.slice(0, 10);

  // Создаём циркулирующий пул ресурсов
  const resourcePool = inferResourcesFromType(type);  // ["resource"] для engine, ["raw","craft","gold"] для economy и т.д.
  // feedback_type inference из action text
  const inferFeedback = (action: string): CoreStep["feedback_type"] => {
    const lower = action.toLowerCase();
    if (/attack|fight|damage|lose|cost|spend|consume|destroy|kill|hit/.test(lower)) return "negative";
    if (/reward|gain|earn|collect|win|upgrade|level|score|bonus/.test(lower)) return "positive";
    return "neutral";
  };

  return steps.map((action, i) => {
    const feedback = inferFeedback(action);
    const mech = mechanics[i % Math.max(1, mechanics.length)] || `custom_step_${i + 1}`;
    // Циркуляция: каждый шаг потребляет resource из предыдущего, производит для следующего
    const produced = [resourcePool[i % resourcePool.length]];
    const consumed = i > 0 ? [resourcePool[(i - 1) % resourcePool.length]] : [resourcePool[resourcePool.length - 1]];  // первый потребляет последний → замыкает цикл
    const duration = Math.round(scale.step_duration_range[0] + (i / steps.length) * (scale.step_duration_range[1] - scale.step_duration_range[0]));
    return {
      action,
      mechanics: [mech],
      resources_consumed: consumed,
      resources_produced: produced,
      feedback_type: feedback,
      duration_estimate: duration,
    };
  });
}

function inferResourcesFromType(type: LoopType): string[] {
  switch (type) {
    case "engine":        return ["resource", "xp"];
    case "economy":       return ["raw", "craft", "gold", "gear"];
    case "ecology":       return ["info", "stamina", "enemy_hp"];
    case "tower_defense": return ["gold", "tower", "kills"];
    case "rhythm":        return ["beat", "hit", "combo", "score"];
    case "puzzle":        return ["piece", "board_state", "match", "score"];
    default:              return ["resource", "xp"];
  }
}
```

**Тест-кейсы**:
- `buildCustomSteps([], ["attack","reward","defend"], "ecology", "rpg")` → 3 шага, ресурсы циркулируют (info/stamina/enemy_hp), `is_closed=true`.
- `buildCustomSteps(["m1"], ["a"], "engine", "shooter")` → 1 шаг, deadlock pathology сработает (steps.length < 3).
- `buildCustomSteps(["m1","m2","m3","m4","m5","m6","m7","m8"], ["a","b","c","d","e","f","g","h"], "engine", "shooter")` → 8 шагов, Loop Overload сработает.
- Action "Attack the goblin" → feedback_type="negative" (matematches `/attack/`).
- Action "Collect gold reward" → feedback_type="positive" (matematches `/reward|collect|gold/`).

**Риски**:
- `inferFeedback` использует English keywords — для русских actions (`"Атаковать гоблина"`) нужно расширить regex: `/атак|бить|удар|получить урон|потерять/` → negative; `/наград|получить|собрать|прокач|уровень|опыт/` → positive.
- Если customSteps длиной 1, produced/consumed указывают на один и тот же resource → "самопотребление". Лучше в этом случае вернуть empty arrays и положиться на Deadlock pathology.
- Type inference (`type` parameter) — нужно убедиться, что `type` уже определён до вызова buildSteps. Сейчас `buildSteps` вызывается ДО `classifyStructuralType` (строки 797–808), поэтому type передаётся из `desiredLoopType || GENRE_DEFAULT_LOOP_TYPE[genre] || "hybrid"`. После TASK-2.2 — из aesthetic.

**Dependencies**: TASK-2.1 (новая сигнатура `buildSteps` принимает `type` и `context`), TASK-2.2 (type из aesthetic), TASK-2.7 (scale).

---

### TASK-2.10: Заменить `||` логику в детекции патологий на чёткое AND/likely weighting

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 348, 362, 374, 386, 399, 414, 426)

**Описание проблемы**:

Каждая патология имеет условие:
```ts
if (likely.includes(name) || <condition>) { ... }
```

Из-за `||` патология срабатывает даже если не "likely", но condition true. Это приводит к ложным срабатываниям:

- **Stall** (строка 374): `likely.includes("stall") || positiveCount === 0`. Для ecology типа `likely=["stall","oscillation"]` → Stall срабатывает ВСЕГДА для ecology, даже если positiveCount > 0. Test JSON для 01_Shadow_Depths (ecology) подтверждает: Stall помечен несмотря на 2 positive steps.
- **Brittleness** (строка 386): `likely.includes("brittleness") || steps.every(s => s.mechanics.length <= 1)`. Для default template `steps.every(...)` всегда true → Brittleness всегда срабатывает.
- **Oscillation** (строка 399): `likely.includes("oscillation") || feedbackPattern.includes("positive-negative-positive")`. Для ecology `likely` включает "oscillation" → всегда срабатывает.
- **Stagnation** (строка 414): `likely.includes("stagnation") || !hasProgression`. Default template не имеет progression mechanic (mechanics = "explore"/"combat"/"reward"/"progress"/"return" — "progress" substring match в `/progress|upgrade|level/` → hasProgression=true, но только потому что fallback имя "progress").
- **Triviality** (строка 426): `likely.includes("triviality") || steps.length > 7`. Default template steps.length=5 → не срабатывает.

**Решение**:

Заменить `||` на `&&` для "likely" проверок. Либо использовать явную логику:

```ts
// Старый подход:
if (likely.includes("stall") || positiveCount === 0) { ... }

// Новый подход (Bible-compliant):
const isStallLikely = likely.includes("stall");
const hasNoPositiveFeedback = positiveCount === 0;
const hasExcessDeadResources = deadResources.length > steps.flatMap(s => s.resources_produced).length / 2;

// Stall = (no positive feedback) OR (excess dead resources), независимо от likely
if (hasNoPositiveFeedback || hasExcessDeadResources) {
  pathologies.push({
    name: "Stall",
    type: "stall",
    severity: isStallLikely ? "warning" : "info",  // likely повышает severity
    description: hasNoPositiveFeedback
      ? "Нет positive-feedback шагов — игрок не получает подкрепления"
      : `${deadResources.length} ресурсов без потребления — производство простаивает`,
    correction: "...",
    affected_resources: deadResources,
  });
}
```

Принцип: `likely` определяет **severity** (likely → warning, не likely → info), а не **наличие** патологии. Наличие определяется **только** реальным condition.

Применяя к каждой патологии:
- **Runaway**: condition = `positiveCount > steps.length / 2 && !hasNegativeSink`. Likely="runaway" → severity=critical, иначе warning.
- **Deadlock**: condition = `steps.length < 3`. Likely="deadlock" → critical, иначе warning.
- **Stall**: condition = `positiveCount === 0 || deadResources.length > produced/2`. Likely → warning, иначе info.
- **Grind** (TASK-2.3): condition = `feedbackTypes.size <= 1 || durations.size <= 1`. Likely → warning, иначе info.
- **Frustration Plateau** (TASK-2.3): condition = `!hasProgression || allLossy`. Likely → warning, иначе info.
- **Disconnected Loops** (TASK-2.3): condition = `sharedResources.length === 0`. Likely → warning, иначе info.
- **Loop Overload** (TASK-2.3): condition = `steps.length > 7 || distinctResources > 5 || distinctFeedbacks > 3`. Likely → warning, иначе info.

**Тест-кейсы**:
- Engine type (likely=["runaway"]): если `positiveCount <= steps.length / 2` → Runaway НЕ срабатывает (вместо нынешнего ложного срабатывания).
- Ecology type (likely=["stall","oscillation"]): если `positiveCount > 0` и `deadResources.length === 0` → Stall НЕ срабатывает.
- Default template: `positiveCount=2`, `steps.length=5`, `2 > 5/2=2.5` → false → Runaway НЕ срабатывает (вместо нынешнего срабатывания для engine типа).

**Риски**:
- Изменит количество патологий в существующих test_projects. Например, 01_Shadow_Depths (ecology) сейчас имеет 3 патологии (Stall, Brittleness, Oscillation) — после фикса может иметь 0–1.
- `buildRecommendations` проходит по `pathologies.pathologies` — количество recommendations тоже уменьшится. Это улучшит UX (меньше шума).

**Dependencies**: TASK-2.3 (новые патологии), TASK-2.1 (новые builder'ы дают meaningful resource flow).

---

### TASK-2.11: Починить `hasBraking` логику

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строка 131)

**Описание проблемы**:

```ts
const hasBraking = type !== "engine" || subType === "braked_engine";
```

Логика:
- type="engine", subType="pure_engine" → `false || false` = `false`. ✓ (no braking)
- type="engine", subType="braked_engine" → `false || true` = `true`. ✓ (has braking)
- type="economy" → `true || ...` = `true`. ❌ (economy не обязательно имеет braking)
- type="ecology" → `true`. ❌ (ecology может быть без braking)
- type="hybrid" → `true`. ❌
- type="tower_defense" → `true`. ❌
- type="rhythm" → `true`. ❌
- type="puzzle" → `true`. ❌

Все non-engine типы получают `has_braking=true` по умолчанию. Это вводит в заблуждение — `buildValidation` (строка 602–603) использует `!structuralType.has_braking` для добавления warning, который НИКОГДА не появляется для non-engine типов.

**Решение**:

Заменить на явную проверку наличия sink шага:

```ts
// route.ts:131 — заменить
const hasBraking = computeHasBraking(steps, type);

function computeHasBraking(steps: CoreStep[], type: string): boolean {
  // Braking = наличие шага с resources_consumed.length > 0 (тратит ресурсы)
  const hasSinkStep = steps.some(s => s.resources_consumed.length > 0);
  if (!hasSinkStep) return false;

  // Для engine: braking обязательно (Bible 4.4.1: "Braking Engine" предотвращает runaway)
  if (type === "engine") return true;

  // Для economy: braking через sink валюты
  if (type === "economy") {
    // Проверяем, что хотя бы одна валюта имеет sink
    const allProduced = new Set(steps.flatMap(s => s.resources_produced));
    const allConsumed = new Set(steps.flatMap(s => s.resources_consumed));
    return Array.from(allProduced).some(r => allConsumed.has(r));
  }

  // Для ecology: braking через балансирующие шаги (negative feedback)
  if (type === "ecology") {
    return steps.some(s => s.feedback_type === "negative");
  }

  // Для hybrid/tower_defense/rhythm/puzzle: braking через sink
  return hasSinkStep;
}
```

Использовать в `buildValidation`:
```ts
if (!structuralType.has_braking) {
  warnings.push(`Loop has no braking — consider adding a sink step (type=${structuralType.type})`);
}
```

**Тест-кейсы**:
- Engine builder (TASK-2.1) с шагом `resources_consumed: ["resource"]` → `has_braking=true`.
- Ecology builder без negative feedback → `has_braking=false`.
- Economy builder без циркуляции ресурсов → `has_braking=false`.
- Default template: step 2 has `resources_consumed: ["energy","ammo"]` → `has_braking=true` (но это unsourced consumables).

**Риски**:
- Изменит `structural_type.has_braking` для существующих test_projects. Для 01_Shadow_Depths (ecology) сейчас `has_braking=true`, после фикса может стать `false` (если ecology builder не имеет negative step).
- Warning "Loop has no braking" будет появляться чаще.

**Dependencies**: TASK-2.1 (новые builder'ы определяют sink/negative шаги).

---

### TASK-2.12: Заменить substring matching в type-specific pathology detection и stagnation check

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 411–413, 444–535)

**Описание проблемы**:

```ts
// Stagnation check (строки 411-413):
const hasProgression = steps.some((s) =>
  s.mechanics.some((m) => m.includes("progress") || m.includes("upgrade") || m.includes("level"))
);

// Tower_defense Wave Imbalance (строки 444-446):
const buildSteps = steps.filter((s) =>
  s.mechanics.some((m) => m.includes("build") || m.includes("place") || m.includes("upgrade"))
).length;

// Rhythm Tempo Drift (строки 491-493):
const hasCalibration = steps.some((s) =>
  s.mechanics.some((m) => m.includes("calibrate") || m.includes("sync") || m.includes("tempo"))
);
```

Проблемы:
1. **Substring matching без word boundaries** — "build" матчит "deck-building", "building_blocks". "level" матчит "level_design".
2. **Только английские keywords** — MechanicsDB содержит русские имена (`"Изучение мира"`, `"Очки опыта"`, `"Броня"`). Substring matching `/progress|upgrade|level/` не найдёт русские эквиваленты.
3. **Case sensitivity** — `m.includes("build")` не матчит `"Build tower"`.
4. **Имена fallback в default template** (`"progress"`, `"return"`, `"explore"`, `"combat"`, `"reward"`) — ложно матчатся, давая ложные `hasProgression=true`, `hasRecovery=false`, и т.д.

**Решение**:

1. Расширить keywords с русскими эквивалентами:
```ts
const PROGRESSION_KEYWORDS = [
  // English
  "progress", "upgrade", "level", "xp", "perk", "tier", "skill", "tech",
  // Russian
  "прогресс", "улучшен", "уровень", "опыт", "перк", "тир", "навык", "технолог",
];

const hasProgression = steps.some((s) =>
  s.mechanics.some((m) => {
    const lower = m.toLowerCase();
    return PROGRESSION_KEYWORDS.some(kw => lower.includes(kw));
  })
);
```

2. Использовать word boundary где возможно:
```ts
const matchKeyword = (text: string, keywords: string[]): boolean => {
  const lower = text.toLowerCase();
  return keywords.some(kw => {
    // Word boundary для ASCII; для кириллицы просто includes (нет \b в JS regex для Unicode по умолчанию)
    if (/^[a-z]+$/.test(kw)) {
      const re = new RegExp(`\\b${kw}\\b`, "i");
      return re.test(text);
    }
    return lower.includes(kw);
  });
};
```

3. Добавить type-specific keyword sets для tower_defense/rhythm/puzzle:
```ts
const TOWER_DEFENSE_BUILD_KEYWORDS = ["build", "place", "construct", "deploy", "строить", "построить", "разместить", "установить"];
const TOWER_DEFENSE_DEFEND_KEYWORDS = ["defend", "shoot", "attack", "защищать", "защитить", "стрелять", "атаковать"];
const TOWER_DEFENSE_REPAIR_KEYWORDS = ["repair", "heal", "recover", "чинить", "ремонт", "лечить", "восстановить"];

const RHYTHM_CALIBRATION_KEYWORDS = ["calibrate", "sync", "tempo", "калибровк", "синхрон", "темп"];
const RHYTHM_NEGATIVE_KEYWORDS = ["miss", "fail", "wrong", "ошиб", "промах", "неверн"];

const PUZZLE_HINT_KEYWORDS = ["hint", "reset", "undo", "clear", "подсказк", "сброс", "отмен", "очистить"];
const PUZZLE_PIECE_KEYWORDS = ["piece", "shape", "block", "фигур", "форм", "блок"];
```

4. Использовать keyword sets в детекции:
```ts
// Tower_defense Wave Imbalance
const buildSteps = steps.filter(s => 
  s.mechanics.some(m => matchKeyword(m, TOWER_DEFENSE_BUILD_KEYWORDS))
).length;
const defendSteps = steps.filter(s => 
  s.mechanics.some(m => matchKeyword(m, TOWER_DEFENSE_DEFEND_KEYWORDS))
).length;

// Rhythm Tempo Drift
const hasCalibration = steps.some(s =>
  s.mechanics.some(m => matchKeyword(m, RHYTHM_CALIBRATION_KEYWORDS))
);
```

**Тест-кейсы**:
- `matchKeyword("Очки опыта", ["опыт"])` → `true`.
- `matchKeyword("deck-building", ["build"])` → `false` (word boundary).
- `matchKeyword("build tower", ["build"])` → `true`.
- `matchKeyword("Level Design", ["level"])` → `false` (word boundary, "level" как separate word).
- `matchKeyword("level_up", ["level"])` → `true` (underscore treated as boundary).

**Риски**:
- Word boundary для кириллицы не работает стандартным `\b`. Нужно использовать Unicode property escapes: `/\p{L}/u`.
- Если MechanicsDB имена содержат keywords как substring (например, `"Здоровье"` не содержит "level" но `"Уровень здоровья"` — содержит) — нужно тестировать.

**Dependencies**: TASK-2.3 (новые патологии), TASK-1.1 (MechanicsDB genres — некоторые keywords могут быть в desc).

---

### TASK-2.13: Добавить `aiInsights`, `modelsUsed`, `latencyMs` колонки в Prisma `ProjectCoreLoop`

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `prisma/schema.prisma` (строки 135–160), `src/app/api/v1/coreloop/design/route.ts` (строки 896–933)

**Описание проблемы**:

`ProjectCoreLoop` schema НЕ имеет полей для `aiInsights`, `modelsUsed`, `latencyMs`:

```prisma
model ProjectCoreLoop {
  id                String   @id @default(cuid())
  projectId         String   @unique
  structuralType    String?
  structuralSubtype String?
  stepCount         Int?
  hierarchyDepth    Int?
  pathologyCount    Int       @default(0)
  inputData         String?
  stepsData         String?
  innerLoops        String?
  outerLoops        String?
  metaLoop          String?
  loopHierarchy     String?
  pathologies       String?
  recommendations   String?
  validationData    String?
  fullProfile       String?  // ← ai_insights, models_used, latency_ms находятся здесь как JSON
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  // ... НЕТ aiInsights, modelsUsed, latencyMs полей
}
```

В route.ts:
```ts
// route.ts:870-882 — ai_insights добавляется в result, но НЕ персистится в отдельной колонке
let aiInsights: string | null = null;
if (useAi) {
  aiInsights = await enrichCoreLoop({...});
  if (aiInsights) {
    result.ai_insights = aiInsights;  // только в result
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}

// route.ts:894 — fullProfile содержит ВСЕ поля result, включая ai_insights
const fullProfile = JSON.stringify(result);

// route.ts:896-933 — Prisma upsert не сохраняет ai_insights/models_used/latency_ms отдельно
await db.projectCoreLoop.upsert({
  where: { projectId: proj.id },
  create: { ..., fullProfile },  // ai_insights только внутри fullProfile JSON
  update: { ..., fullProfile },
});
```

Проблемы:
1. Чтобы получить `ai_insights`, нужно `JSON.parse(fullProfile).ai_insights` — неэффективно и неудобно для запросов.
2. Невозможно отфильтровать проекты с/без AI enrichment на уровне SQL.
3. `models_used` и `latency_ms` тоже недоступны для SQL queries.
4. В файле `worklog.md` (Task audit-blocks-5-8) отмечено: "Все 4 блока (5a, 5b, 6, 6b) persist `fullProfile: JSON.stringify(result)` ДО добавления `ai_insights`. ai_insights попадает в HTTP response, но НЕ в DB. Несогласованность с Blocks 1-4 (уже отмечено previous agent)." — это означает, что Block 2 persist `fullProfile` ПОСЛЕ добавления `ai_insights` (правильно), но другие блоки — ДО. Нужно унифицировать.

**Решение**:

1. Добавить колонки в Prisma schema:
```prisma
model ProjectCoreLoop {
  id                String   @id @default(cuid())
  projectId         String   @unique
  structuralType    String?
  structuralSubtype String?
  stepCount         Int?
  hierarchyDepth    Int?
  pathologyCount    Int       @default(0)
  inputData         String?
  stepsData         String?
  innerLoops        String?
  outerLoops        String?
  metaLoop          String?
  loopHierarchy     String?
  pathologies       String?
  recommendations   String?
  validationData    String?
  aiInsights        String?  // НОВОЕ: AI-generated insights text
  modelsUsed        String?  // НОВОЕ: JSON array of model identifiers
  latencyMs         Int?     // НОВОЕ: route handler latency in ms
  garyFiveQuestions String?  // НОВОЕ: TASK-2.6 result as JSON
  fullProfile       String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([structuralType])
  @@map("project_core_loops")
}
```

2. Запустить миграцию:
```bash
bunx prisma migrate dev --name add_coreloop_ai_metadata
```

3. Обновить route.ts upsert:
```ts
await db.projectCoreLoop.upsert({
  where: { projectId: proj.id },
  create: {
    projectId: proj.id,
    structuralType: structuralType.type,
    structuralSubtype: structuralType.sub_type,
    stepCount: steps.length,
    hierarchyDepth: Object.keys(loopHierarchy).length,  // TASK-2.15
    pathologyCount: pathologies.total_count,
    inputData,
    stepsData,
    innerLoops: JSON.stringify(innerLoops),
    outerLoops: JSON.stringify(outerLoops),
    metaLoop: JSON.stringify(metaLoop),
    loopHierarchy: JSON.stringify(loopHierarchy),
    pathologies: JSON.stringify(pathologies),
    recommendations: JSON.stringify(recommendations),
    validationData: JSON.stringify(validation),
    aiInsights,  // НОВОЕ
    modelsUsed: JSON.stringify(result.models_used),  // НОВОЕ
    latencyMs: latencyMs,  // НОВОЕ
    garyFiveQuestions: JSON.stringify(result.gary_five_questions),  // НОВОЕ (TASK-2.6)
    fullProfile,  // всё ещё как fallback
  },
  update: { /* same fields */ },
});
```

**Тест-кейсы**:
- После POST с `use_ai=true`: `SELECT aiInsights, modelsUsed, latencyMs FROM project_core_loops WHERE projectId = ?` возвращает значения.
- После POST с `use_ai=false`: `aiInsights IS NULL`, `modelsUsed` содержит `["deterministic-coreloop-v1","sellers-typology","pathology-detector-v1"]`.
- `latencyMs` < 100 для deterministic, 1000–5000 для AI.
- Миграция не теряет существующие данные (поле `fullProfile` сохраняет всё).

**Риски**:
- Prisma migration требует downtime или совместимой стратегии (SQLite + dev — минимальный риск).
- Существующие записи имеют `aiInsights=NULL` — GET route должен обрабатывать null.
- Нужно обновить `buildPreparedInput` в `pipeline-helpers.ts` (строки 338–349) — добавить `ai_insights` в upstream.core_loop для Block 3+ prepare-input.

**Dependencies**: TASK-2.6 (`garyFiveQuestions` поле).

---

### TASK-2.14: Добавить GET /coreloop/[projectId] route

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/[projectId]/route.ts` (новый файл)

**Описание проблемы**:

В `src/app/api/v1/coreloop/` есть только `design/route.ts` (POST). Нет GET endpoint для загрузки существующего core loop. Фронтенд `src/app/blocks/2/page.tsx` хранит `result` только в React state — при перезагрузке страницы данные теряются, пользователь должен re-design.

```bash
$ ls src/app/api/v1/coreloop/
design/route.ts
# НЕТ [projectId]/route.ts
```

В contrast, Block 1 имеет `src/app/api/v1/concept/[id]/route.ts` (GET). Block 6 имеет `src/app/api/v1/gdd/[projectId]/route.ts` (если есть — нужно проверить). Несогласованность API.

**Решение**:

Создать новый файл `src/app/api/v1/coreloop/[projectId]/route.ts`:

```ts
/**
 * GET /api/v1/coreloop/[projectId]
 *
 * Returns the persisted Core Loop design result for the given project.
 * Reconstructs the full result object from individual Prisma columns +
 * fullProfile JSON (for backward compat).
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/server-auth";
import { getOwnedProject, UNAUTH, SERVER_ERROR, NOT_FOUND } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();

  try {
    const { projectId } = await params;
    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;

    const coreLoop = await db.projectCoreLoop.findUnique({
      where: { projectId },
    });

    if (!coreLoop) return NOT_FOUND();

    // Reconstruct result from columns + fullProfile
    const fullProfile = coreLoop.fullProfile
      ? JSON.parse(coreLoop.fullProfile)
      : {};

    const result = {
      id: projectId,
      structural_type: fullProfile.structural_type || {
        type: coreLoop.structuralType,
        sub_type: coreLoop.structuralSubtype,
      },
      steps: coreLoop.stepsData ? JSON.parse(coreLoop.stepsData) : [],
      inner_loops: coreLoop.innerLoops ? JSON.parse(coreLoop.innerLoops) : [],
      outer_loops: coreLoop.outerLoops ? JSON.parse(coreLoop.outerLoops) : [],
      meta_loop: coreLoop.metaLoop ? JSON.parse(coreLoop.metaLoop) : null,
      loop_hierarchy: coreLoop.loopHierarchy ? JSON.parse(coreLoop.loopHierarchy) : null,
      pathologies: coreLoop.pathologies ? JSON.parse(coreLoop.pathologies) : { pathologies: [], total_count: 0, critical_count: 0 },
      recommendations: coreLoop.recommendations ? JSON.parse(coreLoop.recommendations) : [],
      validation: coreLoop.validationData ? JSON.parse(coreLoop.validationData) : null,
      ai_insights: coreLoop.aiInsights || fullProfile.ai_insights || null,  // TASK-2.13
      models_used: coreLoop.modelsUsed ? JSON.parse(coreLoop.modelsUsed) : fullProfile.models_used || [],
      latency_ms: coreLoop.latencyMs ?? fullProfile.latency_ms ?? 0,
      gary_five_questions: coreLoop.garyFiveQuestions
        ? JSON.parse(coreLoop.garyFiveQuestions)
        : fullProfile.gary_five_questions || null,
      stages_completed: fullProfile.stages_completed || [1, 2, 3, 4, 5],
      created_at: coreLoop.createdAt,
      updated_at: coreLoop.updatedAt,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[coreloop/[projectId]] error:", error);
    return SERVER_ERROR();
  }
}
```

Обновить фронтенд `src/app/blocks/2/page.tsx` для загрузки существующего core loop при монтировании:

```ts
// В useEffect при смене projectId:
useEffect(() => {
  if (!projectId) return;
  apiFetch<CoreLoopDesignResult>(`/api/v1/coreloop/${projectId}`)
    .then(data => setResult(data))
    .catch(() => setResult(null));
}, [projectId]);
```

**Тест-кейсы**:
- После POST /coreloop/design: GET /coreloop/[projectId] возвращает тот же result.
- Для проекта без core loop: GET возвращает 404.
- Для неавторизованного пользователя: GET возвращает 401.
- После миграции TASK-2.13: GET возвращает ai_insights, models_used, latency_ms как отдельные поля.

**Риски**:
- Существующий фронтенд не вызывает GET при загрузке — нужно обновить page.tsx.
- `apiRoutes.coreloop.get(projectId)` — нужно добавить в `src/config/api.ts` (если используется).

**Dependencies**: TASK-2.13 (новые колонки), TASK-1.11 (Block 1 — аналогичный паттерн для /concept/[id]).

---

### TASK-2.15: Заменить хардкод `hierarchyDepth = 6` на вычисляемое значение; убрать dead code

**Сложность**: S
**Приоритет**: 🟢
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 71–80, 851, 903, 920, 938)

**Описание проблемы**:

1. **`hierarchyDepth = 6` хардкод** в обоих create (строка 903) и update (строка 920):
```ts
create: { ..., hierarchyDepth: 6, ... },
update: { ..., hierarchyDepth: 6, ... },
```
Хотя `Object.keys(loopHierarchy).length` всегда 6 — несложно вычислять. Если в будущем добавится 7-й уровень (например, "sub-micro" или "cosmic"), хардкод не обновится.

2. **`PATHOLOGY_TYPES` константа** (строки 71–80) объявлена, но НИГДЕ не используется:
```ts
const PATHOLOGY_TYPES = [
  "runaway", "deadlock", "stall", "brittleness",
  "oscillation", "stagnation", "triviality",
];
```

3. **`void safeJsonParse;`** (строка 938) — dead code, импорт только чтобы удовлетворить linter:
```ts
// Use safeJsonParse to satisfy linter (kept for future use)
void safeJsonParse;
```

4. **`stagesCompleted = [1, 2, 3, 4, 5]`** (строка 851) — всегда одинаковый массив. Не отражает реальные стадии. Если buildSteps или detectPathologies упадут, stages_completed всё равно вернёт `[1,2,3,4,5]`.

**Решение**:

1. Вычислять `hierarchyDepth`:
```ts
const hierarchyDepth = Object.keys(loopHierarchy).length;
// ...
create: { ..., hierarchyDepth, ... },
update: { ..., hierarchyDepth, ... },
```

2. Удалить `PATHOLOGY_TYPES` (или использовать в TASK-2.3 для валидации pathology type).

3. Удалить `void safeJsonParse;` и убрать `safeJsonParse` из импорта:
```ts
import {
  getOwnedProject,
  // safeJsonParse,  ← УБРАТЬ
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
```

4. Реально отслеживать `stagesCompleted`:
```ts
const stagesCompleted: number[] = [];
try {
  const steps = buildSteps(...);          stagesCompleted.push(1);
  const structuralType = classifyStructuralType(...); stagesCompleted.push(2);
  const loopHierarchy = buildLoopHierarchy(...);     stagesCompleted.push(3);
  const pathologies = detectPathologies(...);        stagesCompleted.push(4);
  const validation = buildValidation(...);           stagesCompleted.push(5);
} catch (e) {
  // stagesCompleted содержит только завершённые стадии
}
```

**Тест-кейсы**:
- После рефакторинга: `hierarchyDepth === Object.keys(result.loop_hierarchy).length` → `6`.
- `PATHOLOGY_TYPES` не существует (или используется в TASK-2.3).
- `safeJsonParse` не импортируется.
- Если `detectPathologies` падает (mock error): `stagesCompleted === [1, 2, 3]`.

**Риски**:
- Удаление `PATHOLOGY_TYPES` может сломать что-то, если оно используется в других файлах. Проверить: `grep -r "PATHOLOGY_TYPES" src/`.

**Dependencies**: Нет.

---

### TASK-2.16: Заменить `overallPassed = checklistPassed >= 4` на Bible-justified threshold

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 581–593)

**Описание проблемы**:

```ts
// route.ts:581-593
const checklistItems = [
  funCheckPassed,                                                                    // 1. fun check
  loopClosedness.is_closed,                                                          // 2. closedness (ВСЕГДА true)
  !resourceSufficiency.has_dead_resources && !resourceSufficiency.has_unsourced_consumables,  // 3. resources
  pathologies.critical_count === 0,                                                  // 4. pathologies
  steps.length >= 3 && steps.length <= 7,                                            // 5. step count
];
const checklistPassed = checklistItems.filter(Boolean).length;
const checklistTotal = 5;
const score = Number((checklistPassed / checklistTotal).toFixed(3));
const overallPassed = checklistPassed >= 4;  // ← ПРОИЗВОЛЬНЫЙ ПОРОГ
```

Проблемы:
1. `overallPassed = checklistPassed >= 4` — позволяет пройти с 1 проваленной проверкой. Для всех 10 test_projects checklistPassed=4 (closedness=true, fun=true, pathologies=true, step count=true; resources=false) → overallPassed=true. Только puzzle (04_Crystal_Cascade) имеет critical pathology → checklistPassed=3 → overallPassed=false.
2. После TASK-2.4 (real closedness check) closedness будет false для текущего шаблона → checklistPassed=3 → overallPassed=false для всех 10. Это правильное поведение, но нужно уточнить threshold.
3. Bible 4.11.7 говорит "закрыть петлю" — closedness обязательна. Bible 4.11.4 — каждый ресурс имеет source+sink. Bible 4.11.6 — pathology check. Все 5 критериев существенны.

**Решение**:

Заменить threshold на "ВСЕ 5 критериев обязательны":

```ts
// Bible 4.11.7: "закрыть петлю" — closedness обязательна
// Bible 4.11.4: "каждый ресурс имеет source+sink" — resources обязательны
// Bible 4.11.6: "проверить на патологии" — pathology absence обязательна
// Bible 4.8: "30 секунд веселья" — fun check обязателен
// Bible 4.9.1: "3-5 решений за цикл" — step count обязателен

const criticalCriteria = [
  { name: "fun_check", passed: funCheckPassed, weight: 1 },
  { name: "loop_closedness", passed: loopClosedness.is_closed, weight: 1 },
  { name: "resource_sufficiency", passed: !resourceSufficiency.has_dead_resources && !resourceSufficiency.has_unsourced_consumables, weight: 1 },
  { name: "pathology_absence", passed: pathologies.critical_count === 0, weight: 1 },
  { name: "step_count", passed: steps.length >= 3 && steps.length <= 7, weight: 1 },
];

const checklistPassed = criticalCriteria.filter(c => c.passed).length;
const checklistTotal = criticalCriteria.length;
const score = Number((checklistPassed / checklistTotal).toFixed(3));

// Все 5 критериев обязательны для overall_passed=true
const overallPassed = criticalCriteria.every(c => c.passed);
```

Если хочется более мягкий threshold (например, 4/5 с пометкой "needs review"):
```ts
const overallPassed = checklistPassed === checklistTotal;
const needsReview = checklistPassed >= 4 && checklistPassed < checklistTotal;
```

**Тест-кейсы**:
- Все 5 критериев pass → `overallPassed=true`.
- 4/5 (например, closedness=false) → `overallPassed=false`, `needsReview=true`.
- 3/5 → `overallPassed=false`, `needsReview=false`.
- Default template после TASK-2.4: closedness=false → overallPassed=false (правильно).
- Engine builder (TASK-2.1) после TASK-2.8: все 5 pass → overallPassed=true.

**Риски**:
- Изменит UX: после рефакторинга большинство test_projects будут иметь `overall_passed=false`. Это правильно (циклы действительно не замкнуты/ресурсы утекают), но пользователь может расценить как regression.
- Фронтенд `ValidationPanel.tsx` отображает `overall_passed` как badge — нужно проверить, что `needsReview` тоже отображается.

**Dependencies**: TASK-2.3 (новые патологии), TASK-2.4 (real closedness), TASK-2.8 (no resource leaks).

---

### TASK-2.17: Добавить `riskLevel` и `likelyPathologies` для tower_defense/rhythm/puzzle

**Сложность**: S
**Приоритет**: 🟢
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 167–190)

**Описание проблемы**:

```ts
// route.ts:167-178
const riskLevel =
  type === "ecology" ? "high" :
  type === "hybrid" ? "medium" :
  "low";  // engine, economy, tower_defense, rhythm, puzzle — все "low"
const likelyPathologies: string[] = [];
if (type === "engine") likelyPathologies.push("runaway");
if (type === "ecology") likelyPathologies.push("stall", "oscillation");
if (type === "hybrid") likelyPathologies.push("brittleness");
if (steps.length > 7) likelyPathologies.push("triviality", "stagnation");
if (steps.length < 3) likelyPathologies.push("deadlock");
```

`tower_defense`, `rhythm`, `puzzle` получают `risk_level="low"` и пустой `likely_pathologies`. Test JSON для 02_Sky_Fortress (tower_defense): `"risk_level":"low","likely_pathologies":[]`. Это вводит в заблуждение — tower_defense имеет характерные патологии (wave imbalance, no recovery), которые И реализованы в `detectPathologies` (строки 442–474), но НЕ отмечены как likely.

Также `mitigationSuggestions` (строки 180–190) имеет только 5 pathologies — отсутствуют mitigations для type-specific pathologies (Wave Imbalance, No Recovery, Off-Beat Penalty, Tempo Drift, Stuck State, Pattern Blindness).

**Решение**:

Расширить `riskLevel` и `likelyPathologies`:

```ts
const riskAssessment = computeRiskAssessment(type, steps);

function computeRiskAssessment(type: string, steps: CoreStep[]) {
  let riskLevel: "low" | "medium" | "high";
  let likelyPathologies: string[] = [];
  let mitigationSuggestions: string[] = [];

  switch (type) {
    case "engine":
      riskLevel = "medium";  // runaway risk
      likelyPathologies = ["runaway"];
      mitigationSuggestions = ["Add a balancing sink to drain excess resources"];
      break;
    case "economy":
      riskLevel = "medium";  // inflation, deadlock
      likelyPathologies = ["grind", "stall"];
      mitigationSuggestions = [
        "Implement dynamic profitability tuning (Bible 4.6.2)",
        "Ensure every currency has both source and sink",
      ];
      break;
    case "ecology":
      riskLevel = "high";  // brittleness, imbalance
      likelyPathologies = ["stall", "frustration_plateau", "disconnected_loops"];
      mitigationSuggestions = [
        "Ensure every pool has a faucet AND a drain",
        "Add recovery mechanic for resilience (Bible 4.4.3)",
      ];
      break;
    case "hybrid":
      riskLevel = "medium";
      likelyPathologies = ["loop_overload", "disconnected_loops"];
      mitigationSuggestions = ["Add redundant paths so failure of one mechanic doesn't break the loop"];
      break;
    case "tower_defense":
      riskLevel = "high";  // wave imbalance, snowball
      likelyPathologies = ["wave_imbalance", "no_recovery", "stall"];
      mitigationSuggestions = [
        "Balance build:defend ratio closer to 1:1, or add urgency mechanics (timed waves)",
        "Add a repair or shield regeneration step between waves",
      ];
      break;
    case "rhythm":
      riskLevel = "medium";  // tempo drift, off-beat penalty
      likelyPathologies = ["off_beat_penalty", "tempo_drift", "frustration_plateau"];
      mitigationSuggestions = [
        "Add a tempo-sync or BPM-shift step to maintain consistent challenge curve",
        "Increase positive feedback for successful hits; reduce miss penalty severity",
      ];
      break;
    case "puzzle":
      riskLevel = "high";  // stuck state, pattern blindness
      likelyPathologies = ["stuck_state", "pattern_blindness", "frustration_plateau"];
      mitigationSuggestions = [
        "Add an undo step, hint system, or board-reset mechanic",
        "Limit piece variety to 3-4 types; introduce complexity gradually",
      ];
      break;
    default:
      riskLevel = "medium";
      likelyPathologies = [];
      mitigationSuggestions = [];
  }

  // Step count overrides
  if (steps.length > 7) {
    likelyPathologies.push("loop_overload");
    mitigationSuggestions.push("Reduce step count to 3-7 core verbs");
  }
  if (steps.length < 3) {
    likelyPathologies.push("deadlock");
    mitigationSuggestions.push("Add at least 3 distinct steps to break circular deadlocks");
  }

  return { risk_level: riskLevel, likely_pathologies: likelyPathologies, mitigation_suggestions: mitigationSuggestions };
}
```

**Тест-кейсы**:
- `computeRiskAssessment("tower_defense", [...])` → `{risk_level: "high", likely_pathologies: ["wave_imbalance","no_recovery","stall"], ...}`.
- `computeRiskAssessment("rhythm", [...])` → `{risk_level: "medium", likely_pathologies: ["off_beat_penalty","tempo_drift","frustration_plateau"], ...}`.
- `computeRiskAssessment("puzzle", [...])` → `{risk_level: "high", likely_pathologies: ["stuck_state","pattern_blindness","frustration_plateau"], ...}`.
- `computeRiskAssessment("engine", [8 steps])` → `likely_pathologies` includes `"loop_overload"`.

**Риски**:
- Изменит `structural_type.risk_assessment` для существующих test_projects. tower_defense/rhythm/puzzle получат non-empty `likely_pathologies` — улучшит информативность.
- `buildRecommendations` не зависит от `likely_pathologies` напрямую, но использует `mitigation_suggestions` — нужно убедиться, что recommendations не дублируют mitigations.

**Dependencies**: TASK-2.3 (новые патологии), TASK-2.10 (likely влияет на severity, не на наличие).

---

### TASK-2.18: Улучшить `enrichCoreLoop` prompt с конкретным контекстом

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/lib/ai-service.ts` (строки 503–541)

**Описание проблемы**:

Текущий `enrichCoreLoop` prompt generic:

```ts
// ai-service.ts:514-526
const prompt = `Ты — экспертный геймдизайнер. Дай инсайты по кор-лупу для теста «30 секунд веселья».

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType}
Шаги: ${ctx.steps.join(" → ")}

Дай 3 конкретных совета (на русском, каждый 1-2 предложения):
1. Что делает этот кор-луп увлекательным
2. Какие wow-моменты добавить
3. Какие риски fun factor могут возникнуть

Ответ — обычный текст с нумерованными пунктами.`;
```

Проблемы:
1. **Не передаёт патологии** — LLM не знает, какие патологии обнаружены.
2. **Не передаёт dead_resources / unsourced_consumables** — LLM не может предложить конкретные фиксы.
3. **Не передаёт gary_five_questions** (после TASK-2.6) — LLM не знает определённый цикл/конфликт/ресурсы.
4. **Не передаёт risk_assessment** — LLM не знает likely pathologies.
5. **Response — plain text** — не структурированный, сложно парсить для UI.

**Решение**:

Расширить `CoreLoopAiInput` и prompt:

```ts
export interface CoreLoopAiInput {
  projectName: string;
  genre: string;
  coreLoopType: string;
  steps: string[];
  // НОВЫЕ поля:
  pathologies?: Array<{ name: string; type: string; severity: string; description: string; correction: string }>;
  deadResources?: string[];
  unsourcedConsumables?: string[];
  garyFiveQuestions?: {
    cycle_description: string;
    main_conflict: string;
    resource_types: { scalable: string[]; fixed: string[]; accumulating: string[] };
    interaction_type: { type: string; description: string };
    goal_type: { type: string; description: string };
  };
  riskLevel?: string;
  likelyPathologies?: string[];
}

export async function enrichCoreLoop(ctx: CoreLoopAiInput): Promise<string | null> {
  const zai = await getZai();
  if (!zai) return null;
  try {
    const pathologySection = ctx.pathologies && ctx.pathologies.length > 0
      ? `\n\nОБНАРУЖЕННЫЕ ПАТОЛОГИИ:\n${ctx.pathologies.map(p => `- ${p.name} (${p.severity}): ${p.description}. Лечение: ${p.correction}`).join("\n")}`
      : "\n\nПатологий не обнаружено.";

    const resourceSection = (ctx.deadResources?.length || ctx.unsourcedConsumables?.length)
      ? `\n\nПРОБЛЕМЫ РЕСУРСОВ:\n${ctx.deadResources?.length ? `Dead resources (производятся, не потребляются): ${ctx.deadResources.join(", ")}` : ""}${ctx.unsourcedConsumables?.length ? `\nUnsourced consumables (потребляются, не производятся): ${ctx.unsourcedConsumables.join(", ")}` : ""}`
      : "\n\nРесурсы сбалансированы.";

    const garySection = ctx.garyFiveQuestions
      ? `\n\n5 ВОПРОСОВ ГЭРИ:\n- Цикл: ${ctx.garyFiveQuestions.cycle_description}\n- Конфликт: ${ctx.garyFiveQuestions.main_conflict}\n- Ресурсы: scalable=${ctx.garyFiveQuestions.resource_types.scalable.join(",")}, fixed=${ctx.garyFiveQuestions.resource_types.fixed.join(",")}, accumulating=${ctx.garyFiveQuestions.resource_types.accumulating.join(",")}\n- Взаимодействие: ${ctx.garyFiveQuestions.interaction_type.description}\n- Цель: ${ctx.garyFiveQuestions.goal_type.description}`
      : "";

    const prompt = `Ты — экспертный геймдизайнер (Шелл, Адамс/Дорманс, Селлерс, Зубек). Проанализируй Core Loop для теста «30 секунд веселья».

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Тип кор-лупа: ${ctx.coreLoopType}
Уровень риска: ${ctx.riskLevel || "не определён"}
Likely патологии: ${(ctx.likelyPathologies || []).join(", ") || "нет"}

ШАГИ ЦИКЛА:
${ctx.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}
${pathologySection}${resourceSection}${garySection}

Дай развёрнутый анализ (на русском, 200-400 слов):
1. **Сильные стороны**: что делает этот кор-луп увлекательным (2-3 конкретных момента, со ссылками на шаги)
2. **Слабые места**: какие риски fun factor могут возникнуть (со ссылками на обнаруженные патологии и проблемы ресурсов)
3. **Wow-моменты**: 2-3 конкретных wow-момента, которые можно добавить (с привязкой к жанру и типу)
4. **Приоритет фиксов**: какие 1-2 проблемы решить в первую очередь и почему

Ответ — Markdown с заголовками ## и списками.`;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Ты — AI-ассистент по геймдизайну, специализирующийся на core loop проектировании. Используй знания MDA, типологии Селлерса, 7 патологий Зубека, 5 вопросов Гэри." },
        { role: "user", content: prompt },
      ],
      stream: false,
      thinking: { type: "disabled" },
    });
    const text = response.choices?.[0]?.message?.content?.trim();
    return text && text.length > 30 ? text : null;
  } catch (e) {
    console.error("[ai-service] enrichCoreLoop failed:", e instanceof Error ? e.message : e);
    return null;
  }
}
```

Обновить вызов в route.ts:
```ts
// route.ts:872-877 — расширить вызов
aiInsights = await enrichCoreLoop({
  projectName: proj.name || "Untitled",
  genre,
  coreLoopType: structuralType.type,
  steps: steps.map(s => s.action),
  pathologies: pathologies.pathologies,  // НОВОЕ
  deadResources: validation.resource_sufficiency.dead_resources,  // НОВОЕ
  unsourcedConsumables: validation.resource_sufficiency.unsourced_consumables,  // НОВОЕ
  garyFiveQuestions: result.gary_five_questions,  // НОВОЕ (TASK-2.6)
  riskLevel: structuralType.risk_assessment.risk_level,  // НОВОЕ
  likelyPathologies: structuralType.risk_assessment.likely_pathologies,  // НОВОЕ
});
```

**Тест-кейсы**:
- AI enrichment для проекта с 3 патологиями: response упоминает конкретные патологии и их fixed.
- AI enrichment для проекта с dead_resources=["xp","gold"]: response предлагает конкретные sink шаги.
- AI enrichment для проекта без патологий: response фокусируется на wow-моментах.
- Latency: prompt увеличился с ~100 tokens до ~500 — latency возрастёт с ~3s до ~10s.

**Риски**:
- Увеличенный prompt → больше token usage → выше стоимость.
- LLM может не возвращать Markdown — нужно defensive parsing.
- Если `garyFiveQuestions` или `pathologies` undefined (старый формат), prompt должен gracefully деградировать.

**Dependencies**: TASK-2.6 (gary_five_questions), TASK-2.3 (новые патологии), TASK-2.13 (persist aiInsights).

---

### TASK-2.19: Заменить hardcoded `inner_loops` / `outer_loops` / `meta_loop` на multi-entry arrays derived from `loopHierarchy`

**Сложность**: M
**Приоритет**: 🟢
**Файлы**: `src/app/api/v1/coreloop/design/route.ts` (строки 813–839)

**Описание проблемы**:

```ts
// route.ts:813-839
const innerLoops = [
  { name: "micro_action_loop", actions: steps.slice(0, 2).map(s => s.action), duration_estimate: steps.slice(0, 2).reduce((s, st) => s + st.duration_estimate, 0), type: structuralType.type },
];
const outerLoops = [
  { name: "session_loop", actions: ["Complete 3 core loops", "Bank progress", "Trigger event"], duration_estimate: 300, type: "outer" },
];
const metaLoop = {
  name: "meta_progression", actions: ["New Game+", "Season pass", "Daily challenges"], duration_estimate: 604800, type: "meta",
};
```

Проблемы:
1. `inner_loops` — массив с 1 элементом, но Bible 4.3 говорит о 6 уровнях. `outer_loops` тоже 1 элемент. `meta_loop` — single object, не массив. Несоответствие типов.
2. `outerLoops[0].actions` — английские hardcoded strings `"Complete 3 core loops", "Bank progress", "Trigger event"`. Не зависят от жанра или типа.
3. `metaLoop.actions` — hardcoded `["New Game+", "Season pass", "Daily challenges"]`. Не зависят от жанра.
4. `duration_estimate: 300` (5 min) и `604800` (1 week) — hardcoded, не зависят от жанра (см. TASK-2.7).
5. `loopHierarchy` (строки 280–329) уже содержит 6 уровней, но отдельные top-level поля `inner_loops`/`outer_loops`/`meta_loop` дублируют часть информации.

**Решение**:

Унифицировать через `loopHierarchy` и убрать дублирование:

```ts
// После buildLoopHierarchy:
const loopHierarchy = buildLoopHierarchy(steps, structuralType.type);

// Заменить inner_loops/outer_loops/meta_loop на loops array (6 уровней):
const loops = [
  {
    level: "micro",
    name: "micro_action_loop",
    actions: loopHierarchy.micro[0]?.actions || [],
    duration_estimate: steps.slice(0, 2).reduce((s, st) => s + st.duration_estimate, 0),
    type: structuralType.type,
  },
  {
    level: "small",
    name: "small_loop",
    actions: loopHierarchy.small[0]?.actions || [],
    duration_estimate: steps.reduce((s, st) => s + st.duration_estimate, 0),
    type: "core",
  },
  {
    level: "medium",
    name: "session_loop",
    actions: loopHierarchy.medium[0]?.actions || [],
    duration_estimate: scale.outer_loop_duration,  // TASK-2.7
    type: "outer",
  },
  {
    level: "large",
    name: "quest_loop",
    actions: loopHierarchy.large[0]?.actions || [],
    duration_estimate: scale.outer_loop_duration * 4,
    type: "outer",
  },
  {
    level: "macro",
    name: "macro_progression",
    actions: loopHierarchy.macro[0]?.actions || [],
    duration_estimate: scale.meta_loop_duration / 4,
    type: "macro",
  },
  {
    level: "meta",
    name: "meta_progression",
    actions: loopHierarchy.meta[0]?.actions || [],
    duration_estimate: scale.meta_loop_duration,
    type: "meta",
  },
];
```

Для обратной совместимости сохранить top-level поля как slices:
```ts
const innerLoops = loops.filter(l => l.level === "micro" || l.level === "small");
const outerLoops = loops.filter(l => l.level === "medium" || l.level === "large");
const metaLoop = loops.find(l => l.level === "meta") || null;
```

Также сделать actions в loopHierarchy жанро-зависимыми:
```ts
function buildLoopHierarchy(steps: CoreStep[], type: string, genre: string): LoopHierarchy {
  const genreActionMap: Record<string, { medium: string[]; large: string[]; macro: string[]; meta: string[] }> = {
    rpg: {
      medium: ["Завершить 3 кор-лупа", "Получить уровень", "Открыть скилл"],
      large: ["Завершить квестовую арку", "Открыть новую локацию"],
      macro: ["Достичь максимального уровня", "Победить финального босса"],
      meta: ["New Game+", "Ежедневные испытания", "Сезонные события"],
    },
    shooter: {
      medium: ["Зачистить 3 encounter", "Получить ачивку", "Сменить оружие"],
      large: ["Завершить уровень", "Открыть новую карту"],
      macro: ["Пройти кампанию", "Открыть сложный режим"],
      meta: ["Ежедневные испытания", "Сезонные события", "Leaderboard"],
    },
    // ... добавить для всех жанров
  };
  const actions = genreActionMap[genre.toLowerCase()] || genreActionMap.default;
  // ... использовать actions вместо hardcoded
}
```

**Тест-кейсы**:
- `loops.length === 6` для любого проекта.
- `loops[0].level === "micro"`, `loops[5].level === "meta"`.
- RPG project: `loops[2].actions` содержит "Получить уровень".
- Shooter project: `loops[2].actions` содержит "Зачистить 3 encounter".
- `metaLoop.level === "meta"` (если сохранён как single object).

**Риски**:
- Фронтенд `LoopHierarchyTree.tsx` отображает `loop_hierarchy` (micro/small/medium/large/macro/meta) — должно работать без изменений.
- Фронтенд `CoreLoopDiagram.tsx` может использовать `inner_loops`/`outer_loops` — нужно проверить.
- `Prisma.upsert` сохраняет `innerLoops`, `outerLoops`, `metaLoop` как JSON — структура изменится. Существующие записи в БД будут иметь старую структуру. GET route (TASK-2.14) должен обрабатывать оба формата.

**Dependencies**: TASK-2.7 (genre-based duration), TASK-2.14 (GET route для нового формата).

---

### TASK-2.20: Покрыть unit-тестами критичные функции (`buildSteps`, `classifyStructuralType`, `detectPathologies`, `buildValidation`, `computeLoopClosedness`)

**Сложность**: L
**Приоритет**: 🟢
**Файлы**: `src/app/api/v1/coreloop/design/route.test.ts` (новый файл)

**Описание проблемы**:

В репозитории нет unit-тестов для Block 2. Проверка `grep -r "coreloop.*test" src/` возвращает 0 результатов. Все 10 test_projects — это end-to-end pipeline tests через `scripts/run_pipeline_test.sh`, но они:
1. Используют hardcoded mechanics `["explore","combat","reward"]` — не покрывают edge cases.
2. Не проверяют инварианты (например, "все produced ресурсы должны потребляться").
3. Не покрывают type-specific builders (после TASK-2.1).
4. Не тестируют Bible compliance (7 патологий, 5 вопросов Гэри).

**Решение**:

Создать `src/app/api/v1/coreloop/design/route.test.ts` с использованием bun test framework:

```ts
import { describe, it, expect } from "bun:test";
// Импортировать функции после экспорта из route.ts (нужно отрефакторить route.ts, чтобы функции были экспортированы)
import {
  buildSteps,
  classifyStructuralType,
  detectPathologies,
  buildValidation,
  computeLoopClosedness,
  runGaryFiveQuestions,
} from "./route";

describe("buildSteps", () => {
  it("engine type produces 4 steps with circulating resource", () => {
    const steps = buildSteps(["атака","усилие"], undefined, "engine", { genre: "action" });
    expect(steps.length).toBe(4);
    const allProduced = new Set(steps.flatMap(s => s.resources_produced));
    const allConsumed = new Set(steps.flatMap(s => s.resources_consumed));
    for (const r of allProduced) {
      expect(allConsumed.has(r)).toBe(true);  // нет dead resources
    }
  });

  it("economy type produces 5-step conversion chain", () => {
    const steps = buildSteps(["сбор","крафт","торг","апгрейд","экип"], undefined, "economy", { genre: "rpg" });
    expect(steps.length).toBe(5);
    // Chain: raw → craft → gold → gear → time → raw
    expect(steps[0].resources_produced).toContain("raw");
    expect(steps[1].resources_consumed).toContain("raw");
    expect(steps[1].resources_produced).toContain("craft");
    expect(steps[2].resources_consumed).toContain("craft");
  });

  it("tower_defense type includes wave step", () => {
    const steps = buildSteps(["строительство","защита","волна","ремонт"], undefined, "tower_defense", { genre: "strategy" });
    expect(steps.some(s => s.action.includes("волна"))).toBe(true);
  });

  it("rhythm type has 1-3 sec duration for shooter genre", () => {
    const steps = buildSteps(["слушание","тап"], undefined, "rhythm", { genre: "shooter" });
    // Wait — rhythm + shooter doesn't make sense. Use rhythm genre.
    const rhythmSteps = buildSteps(["слушание","тап"], undefined, "rhythm", { genre: "rhythm" });
    for (const s of rhythmSteps) {
      expect(s.duration_estimate).toBeGreaterThanOrEqual(1);
      expect(s.duration_estimate).toBeLessThanOrEqual(3);
    }
  });

  it("customSteps with 1 element triggers deadlock pathology", () => {
    const steps = buildSteps(["m"], ["single action"], "engine", { genre: "action" });
    expect(steps.length).toBe(1);
    // Deadlock pathology should fire
    const structuralType = classifyStructuralType(["m"], "action", "engine", steps);
    const pathologies = detectPathologies(steps, structuralType);
    expect(pathologies.pathologies.some(p => p.type === "deadlock")).toBe(true);
  });

  it("customSteps with 10+ elements triggers Loop Overload", () => {
    const longSteps = Array.from({ length: 12 }, (_, i) => `Step ${i + 1}`);
    const steps = buildSteps(["m1","m2"], longSteps, "hybrid", { genre: "action" });
    expect(steps.length).toBe(10);  // sliced to 10
    const structuralType = classifyStructuralType(["m1","m2"], "action", "hybrid", steps);
    const pathologies = detectPathologies(steps, structuralType);
    expect(pathologies.pathologies.some(p => p.type === "loop_overload")).toBe(true);
  });
});

describe("classifyStructuralType", () => {
  it("type from desiredLoopType overrides genre", () => {
    const steps = buildSteps(["m"], undefined, "ecology", { genre: "rpg" });
    const st = classifyStructuralType(["m"], "rpg", "ecology", steps);
    expect(st.type).toBe("ecology");
  });

  it("type from aesthetic (Bible 4.11.1) — challenge → engine", () => {
    const steps = buildSteps(["m"], undefined, "engine", { genre: "rpg" });
    const st = classifyStructuralType(["m"], "rpg", undefined, steps, "challenge");
    expect(st.type).toBe("engine");
  });

  it("sub_type for tower_defense is single_lane_td or multi_lane_td", () => {
    const steps = buildSteps(["строительство","защита"], undefined, "tower_defense", { genre: "strategy" });
    const st = classifyStructuralType(["строительство","защита"], "strategy", "tower_defense", steps);
    expect(["single_lane_td", "multi_lane_td", "boss_wave_td"]).toContain(st.sub_type);
  });

  it("resources.class_ for tower_defense has structural/currency", () => {
    const steps = buildSteps(["строительство","защита"], undefined, "tower_defense", { genre: "strategy" });
    const st = classifyStructuralType(["строительство","защита"], "strategy", "tower_defense", steps);
    expect(st.resources.some(r => r.class_ === "currency" || r.class_ === "structural")).toBe(true);
  });
});

describe("detectPathologies", () => {
  it("Runaway for >60% positive feedback without sink", () => {
    const steps = [
      { action: "A", mechanics: ["a"], resources_consumed: [], resources_produced: ["x"], feedback_type: "positive" as const, duration_estimate: 5 },
      { action: "B", mechanics: ["b"], resources_consumed: [], resources_produced: ["x"], feedback_type: "positive" as const, duration_estimate: 5 },
      { action: "C", mechanics: ["c"], resources_consumed: [], resources_produced: ["x"], feedback_type: "positive" as const, duration_estimate: 5 },
      { action: "D", mechanics: ["d"], resources_consumed: [], resources_produced: ["x"], feedback_type: "positive" as const, duration_estimate: 5 },
    ];
    const st = { type: "engine", risk_assessment: { likely_pathologies: ["runaway"], mitigation_suggestions: [] } };
    const p = detectPathologies(steps, st as any);
    expect(p.pathologies.some(pp => pp.type === "runaway")).toBe(true);
  });

  it("Grind for identical feedback_types", () => {
    const steps = [
      { action: "A", mechanics: ["a"], resources_consumed: [], resources_produced: ["x"], feedback_type: "positive" as const, duration_estimate: 5 },
      { action: "B", mechanics: ["b"], resources_consumed: [], resources_produced: ["y"], feedback_type: "positive" as const, duration_estimate: 5 },
    ];
    const st = { type: "economy", risk_assessment: { likely_pathologies: [], mitigation_suggestions: [] } };
    const p = detectPathologies(steps, st as any);
    expect(p.pathologies.some(pp => pp.type === "grind")).toBe(true);
  });

  it("Loop Overload for >7 steps", () => {
    const steps = Array.from({ length: 8 }, (_, i) => ({
      action: `Step ${i + 1}`, mechanics: [`m${i}`], resources_consumed: [], resources_produced: [`r${i}`],
      feedback_type: "neutral" as const, duration_estimate: 5,
    }));
    const st = { type: "hybrid", risk_assessment: { likely_pathologies: [], mitigation_suggestions: [] } };
    const p = detectPathologies(steps, st as any);
    expect(p.pathologies.some(pp => pp.type === "loop_overload")).toBe(true);
  });

  it("all 7 Bible pathologies can fire", () => {
    // Test each pathology trigger separately
    const biblePathologies = ["runaway", "deadlock", "stall", "grind", "frustration_plateau", "disconnected_loops", "loop_overload"];
    // ... individual tests for each
  });
});

describe("computeLoopClosedness", () => {
  it("returns true for resource circulation", () => {
    const steps = [
      { action: "A", mechanics: ["a"], resources_consumed: ["x"], resources_produced: ["y"], feedback_type: "neutral" as const, duration_estimate: 5 },
      { action: "B", mechanics: ["b"], resources_consumed: ["y"], resources_produced: ["x"], feedback_type: "neutral" as const, duration_estimate: 5 },
    ];
    const closed = computeLoopClosedness(steps);
    expect(closed.is_closed).toBe(true);
  });

  it("returns false for unsourced consumables", () => {
    const steps = [
      { action: "A", mechanics: ["a"], resources_consumed: [], resources_produced: ["x"], feedback_type: "neutral" as const, duration_estimate: 5 },
      { action: "B", mechanics: ["b"], resources_consumed: ["z"], resources_produced: [], feedback_type: "neutral" as const, duration_estimate: 5 },
    ];
    const closed = computeLoopClosedness(steps);
    expect(closed.is_closed).toBe(false);
  });
});

describe("runGaryFiveQuestions", () => {
  it("returns cycle_description from first 3 actions", () => {
    const steps = [
      { action: "Собрать", mechanics: ["m"], resources_consumed: [], resources_produced: ["x"], feedback_type: "neutral" as const, duration_estimate: 5 },
      { action: "Скрафтить", mechanics: ["m"], resources_consumed: ["x"], resources_produced: ["y"], feedback_type: "positive" as const, duration_estimate: 5 },
      { action: "Продать", mechanics: ["m"], resources_consumed: ["y"], resources_produced: ["gold"], feedback_type: "positive" as const, duration_estimate: 5 },
    ];
    const st = { type: "economy", risk_assessment: { likely_pathologies: [], mitigation_suggestions: [] } };
    const gary = runGaryFiveQuestions(steps, st as any, "rpg");
    expect(gary.cycle_description).toContain("Собрать");
    expect(gary.cycle_description).toContain("Скрафтить");
    expect(gary.resource_types.scalable.length + gary.resource_types.fixed.length + gary.resource_types.accumulating.length).toBeGreaterThan(0);
  });
});
```

Также добавить integration test через `scripts/run_pipeline_test.sh` с реальным AI:

```bash
# После рефакторинга:
PROJECTS=("Shadow_Depths:ecology" "Sky_Fortress:tower_defense" "Rhythm_of_War:rhythm" "Crystal_Cascade:puzzle" "Void_Runner:engine")
for entry in "${PROJECTS[@]}"; do
  NAME="${entry%:*}"
  TYPE="${entry##*:}"
  # ... assert different first_action for each type
done
```

**Тест-кейсы** (_summary):
- 7 Bible pathologies individually trigger.
- 7 type-specific builders produce different step counts and resource flows.
- computeLoopClosedness handles 4 cases (closed via circulation, closed via direct, unclosed, single step).
- runGaryFiveQuestions extracts cycle/conflict/resources/interaction/goal.
- Edge cases: empty mechanics, 1 mechanic, 10+ mechanics, customSteps empty/1/10.

**Риски**:
- Нужно отрефакторить route.ts, чтобы функции были экспортируемыми (сейчас они module-private).
- Bun test framework должен быть настроен (проверить `package.json` scripts).
- Mock для `db` и `getCurrentUser` при integration тестах.

**Dependencies**: TASK-2.1–2.6 (все функции должны быть реализованы), TASK-2.13 (Prisma schema для integration test).

---

## Приоритеты и сложности

| ID | Название | Сложность | Приоритет | Dependencies |
|----|----------|-----------|-----------|--------------|
| TASK-2.1 | Параметризовать `buildSteps` по структурному типу | XL | 🔴 | TASK-2.2, TASK-2.7, TASK-2.10 |
| TASK-2.2 | Классифицировать тип по эстетике (Bible 4.11.1) | M | 🔴 | TASK-1.6 |
| TASK-2.3 | Реализовать 7 Bible патологий | L | 🔴 | TASK-2.1 |
| TASK-2.4 | Реальная проверка замкнутости | M | 🔴 | TASK-2.1, TASK-2.8 |
| TASK-2.5 | Sub_types для tower_defense/rhythm/puzzle | M | 🟡 | TASK-2.1, TASK-2.12 |
| TASK-2.6 | 5 вопросов Гэри (Bible 4.11.2) | M | 🟡 | TASK-2.1 |
| TASK-2.7 | Масштаб по жанру (Bible 4.11.3) | S | 🟡 | — |
| TASK-2.8 | Убрать dead_resources из default template | M | 🔴 | TASK-2.1 |
| TASK-2.9 | Починить customSteps mode | M | 🟡 | TASK-2.1, TASK-2.2, TASK-2.7 |
| TASK-2.10 | Заменить `\|\|` логику в pathology detection | S | 🟡 | TASK-2.3 |
| TASK-2.11 | Починить `hasBraking` логику | S | 🟡 | TASK-2.1 |
| TASK-2.12 | Заменить substring matching | M | 🟡 | TASK-2.3 |
| TASK-2.13 | Prisma колонки для AI metadata | M | 🟡 | TASK-2.6 |
| TASK-2.14 | GET /coreloop/[projectId] route | S | 🟡 | TASK-2.13 |
| TASK-2.15 | Убрать dead code, вычислять hierarchyDepth | S | 🟢 | — |
| TASK-2.16 | Bible-justified threshold `overallPassed` | S | 🟡 | TASK-2.3, TASK-2.4, TASK-2.8 |
| TASK-2.17 | riskLevel и likelyPathologies для TD/Rhythm/Puzzle | S | 🟢 | TASK-2.3, TASK-2.10 |
| TASK-2.18 | Улучшить `enrichCoreLoop` prompt | S | 🟡 | TASK-2.3, TASK-2.6, TASK-2.13 |
| TASK-2.19 | Multi-entry loops array (Bible 4.3) | M | 🟢 | TASK-2.7, TASK-2.14 |
| TASK-2.20 | Unit-тесты | L | 🟢 | TASK-2.1–2.6 |

**Итог по приоритетам**:
- 🔴 Критичные (6 задач): TASK-2.1 (XL), TASK-2.2 (M), TASK-2.3 (L), TASK-2.4 (M), TASK-2.8 (M), TASK-2.16 (S) — без них нельзя достичь Bible compliance.
- 🟡 Средние (11 задач): TASK-2.5, 2.6, 2.7, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.17, 2.18, 2.19.
- 🟢 Низкие (3 задачи): TASK-2.15, 2.17, 2.19, 2.20.

**Суммарная оценка effort**:
- Без TASK-2.20 (тесты): 50–70 часов.
- С TASK-2.20: 70–95 часов.

**Рекомендуемая последовательность**:
1. **Фаза 1 (Bible compliance, ~25 ч)**: TASK-2.2 → TASK-2.7 → TASK-2.1 → TASK-2.8 → TASK-2.4 → TASK-2.3 → TASK-2.10 → TASK-2.16.
2. **Фаза 2 (Type-specific, ~15 ч)**: TASK-2.5 → TASK-2.11 → TASK-2.12 → TASK-2.17 → TASK-2.6.
3. **Фаза 3 (Persistence + API, ~10 ч)**: TASK-2.13 → TASK-2.14 → TASK-2.9 → TASK-2.18.
4. **Фаза 4 (Cleanup + tests, ~15 ч)**: TASK-2.15 → TASK-2.19 → TASK-2.20.

---

## Проверка после рефакторинга

После реализации всех задач:

1. **Запустить `scripts/run_pipeline_test.sh`** — все 10 test_projects должны:
   - Иметь **разные** `first_action` (не "Find target (explore)" для всех).
   - Иметь **0 dead_resources** и **0 unsourced_consumables** для большинства типов.
   - Иметь **`is_closed=true`** (через resource circulation).
   - Иметь **non-empty `likely_pathologies`** для tower_defense/rhythm/puzzle.
   - Иметь **`gary_five_questions`** populated.
   - Иметь **type-specific sub_type** (например, `single_lane_td`, `single_track_rhythm`, `linear_puzzle`).
   - Иметь **`overall_passed=false`** для проектов с реальными проблемами (не puzzle-only).

2. **Проверить `models_used`** — должно быть `["deterministic-coreloop-v1","sellers-typology","pathology-detector-v1","gary-five-questions-v1","bible-pathology-detector-v2"]` (или подобное) + `"glm-4.6 (ai-enrichment)"` при `use_ai=true`.

3. **Проверить `ai_insights`** — должно содержать конкретные упоминания:
   - Имена обнаруженных патологий.
   - Конкретные dead_resources / unsourced_consumables.
   - Ссылки на 5 вопросов Гэри.
   - 4 секции (Сильные стороны / Слабые места / Wow-моменты / Приоритет фиксов).

4. **Проверить Prisma migration** — `bunx prisma migrate dev` проходит без ошибок, новые колонки существуют.

5. **Запустить unit-тесты** — `bun test src/app/api/v1/coreloop/design/route.test.ts` → all green.

6. **Проверить GET /coreloop/[projectId]** — после POST, GET возвращает идентичный результат.

---

## Ссылки на связанные документы

- **Спецификация**: `docs/bible/bible_2_4_core_loop.md` (разделы 4.3, 4.4, 4.6, 4.7, 4.10, 4.11).
- **Аудит**: `docs/audit/AUDIT_REPORT.md` (раздел 2, строки ~95–160).
- **Block 1 план**: `docs/audit/REFACTOR_PLAN_block_1.md` (TASK-1.6 — невалидные эстетики, влияющие на TASK-2.2).
- **Исходный код**:
  - `src/app/api/v1/coreloop/design/route.ts` (946 строк) — основной файл.
  - `src/lib/ai-service.ts` (строки 499–541) — `enrichCoreLoop`.
  - `src/types/coreloop.ts` (28 строк) — `CoreLoopFormState`, `CoreLoopDesignResult`.
  - `src/constants/coreloop.ts` (54 строки) — `LOOP_TYPES`, `HIERARCHY_LEVELS`.
  - `prisma/schema.prisma` (строки 135–160) — `ProjectCoreLoop`.
  - `src/lib/pipeline-helpers.ts` (строки 296–425) — `buildPreparedInput` для blockId=2.
  - `src/app/blocks/2/page.tsx` (460 строк) — фронтенд.
  - `src/components/gidede/coreloop/*` — UI компоненты (`CoreLoopDiagram`, `LoopHierarchyTree`, `PathologyPanel`, `RecommendationsPanel`, `StructuralTypeCard`, `ValidationPanel`).
- **Test artifacts**: `test_projects/*/02_coreloop.json` (10 файлов, ~7 KB каждый).
- **Test runner**: `scripts/run_pipeline_test.sh` (строка 98 — hardcoded `mechanics:["explore","combat","reward"]`).
