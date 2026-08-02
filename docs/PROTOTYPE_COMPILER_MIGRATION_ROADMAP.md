# Gidede — Роадмап миграции генератора прототипов

**Статус:** active migration plan
**Дата старта:** 2026-08-02
**Источник:** [`PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md`](../PLAYABLE_PROTOTYPE_COMPILER_DESIGN.md) (design spec 1.0)
**Ветка:** `nextjs-port`

---

## Контекст проблемы

Текущий генератор прототипов (`src/lib/prototype-generator.ts`) создаёт HTML, который **запускается**, но не **доказывает Core Loop**:

- `buildPrototypeConfig()` читает только `structuralType` и до 5 строк `steps`;
- `mechanics`, `resources_consumed`, `resources_produced`, feedback и resource graph **не попадают** в конфигурацию;
- 2D и 3D — отдельные hardcoded реализации 6 мини-игр (`generate2dHtml`, `generate3dHtml`);
- `hybrid` превращается в `engine`, неизвестные типы — в `engine`;
- шаги показываются текстом, но **не определяют правила**;
- два независимых code emitter'а создают риск, что 2D и 3D проверяют разные правила.

**Симптом (скриншот):** прототип гонки «Nitro_Rush» выдаёт цель «Накопите 50 энергии за 30 секунд» и пустой холст. Жанр, механики и шаги Core Loop проигнорированы.

---

## Цель миграции

Заменить набор жанровых мини-игр **компилятором**, который строит проверяемый playable prototype из выбранных механик, шагов и resource flow Core Loop Designer.

**Главный критерий готовности** (из design spec, раздел 16):

> Алгоритм готов не тогда, когда HTML открылся, а когда для каждого observable действия в игре можно ответить:
> 1. из какой mechanic Core Loop оно получено;
> 2. какой step/resource transition оно реализует;
> 3. каким rule ID оно исполняется;
> 4. каким telemetry event измеряется;
> 5. одинаково ли это правило работает в 2D и 3D.

---

## Фазы миграции

### Фаза 0 — Немедленные фиксы (hotfix) · ~2 дня

**Цель:** убрать самое вопиющее поведение, пока идёт большая миграция. Не трогает архитектуру.

| # | Задача | Файлы | Статус |
|---|--------|-------|--------|
| 0.1 | Добавить недостающие типы прототипов (`racing`, `platformer`, `stealth`) в `validTypes` | `src/lib/prototype-generator.ts` | ⬜ |
| 0.2 | Для неизвестного `structuralType` показывать честное сообщение «прототип для этого типа не поддерживается» вместо fallback на `engine` | `src/lib/prototype-generator.ts` | ⬜ |
| 0.3 | Передавать жанр из Concept в `buildPrototypeConfig()` и использовать для выбора цели | `src/lib/prototype-generator.ts`, `src/app/api/v1/prototypes/generate/route.ts` | ⬜ |
| 0.4 | Показывать actual mechanic names в шагах, а не «Шаг» | `src/lib/prototype-generator.ts` | ⬜ |
| 0.5 | Пометить legacy generator как `template prototype` в UI и API response | `src/app/prototypes/page.tsx`, API routes | ⬜ |

**Критерий готовности Фазы 0:** прототип Nitro_Rush больше не показывает «накопите энергию»; для неподдерживаемых типов показывается честное сообщение.

---

### Фаза 1 — Минимальный PrototypeIR (MVP) · ~3-4 недели

**Цель:** реализовать ядро архитектуры из design spec, достаточное для **реальных прототипов** ~60% проектов (shooter, survival, tower defense, arcade).

#### Спринт 1.1 — PrototypeIR schema + semantic hash (~1 неделя)

| # | Задача | Артефакт |
|---|--------|----------|
| 1.1.1 | Создать `src/lib/prototype-compiler/ir/types.ts` с `PrototypeIR` интерфейсом (раздел 6 design spec) | TypeScript types |
| 1.1.2 | Создать Zod-схему для валидации IR | `ir/schema.ts` |
| 1.1.3 | Реализовать `computeSemanticHash(ir)` — детерминированный hash правил/objectives/resources | `ir/semantic-hash.ts` |
| 1.1.4 | Реализовать `computeInputHash(input)` — hash входного Core Loop snapshot | `ir/input-hash.ts` |
| 1.1.5 | Добавить versioning: `schemaVersion: "1.0.0"`, `runtimeVersion` | в types |
| 1.1.6 | Unit-тесты: IR round-trip, hash stability, version compatibility | `ir/__tests__/` |

**Критерий готовности 1.1:** IR можно создать, сериализовать, валидировать и хешировать.

#### Спринт 1.2 — Mechanic adapter registry + базовые адаптеры (~1.5 недели)

| # | Задача | Адаптеры |
|---|--------|----------|
| 1.2.1 | Создать `src/lib/prototype-compiler/registry/` с `MechanicAdapter` интерфейсом (раздел 7) | registry core |
| 1.2.2 | Реализовать `resolveMechanic(id)` — exact → alias → user_override → unsupported | resolver |
| 1.2.3 | Адаптер `locomotion` (move, dodge, jump) — перемещение actor, препятствия | `adapters/locomotion.ts` |
| 1.2.4 | Адаптер `collect` (pickup, gather, loot) — collectible → wallet/inventory | `adapters/collect.ts` |
| 1.2.5 | Адаптер `target/combat` (aim, shoot, melee) — target, projectile, health | `adapters/combat.ts` |
| 1.2.6 | Адаптер `avoid/survive` (stealth, evade, hazard) — threat, damage/detection | `adapters/survival.ts` |
| 1.2.7 | Для social/dialogue/negotiation возвращать `needs_mapping` | registry fallback |
| 1.2.8 | Unit-тесты: каждый адаптер генерирует валидный `MechanicFragment` | `adapters/__tests__/` |

**Критерий готовности 1.2:** 4 адаптера работают, unknown mechanics честно возвращают `needs_mapping`.

#### Спринт 1.3 — Step/resource state machine compiler (~3 дня)

| # | Задача |
|---|--------|
| 1.3.1 | Создать `src/lib/prototype-compiler/compiler/step-machine.ts` |
| 1.3.2 | Каждый Core Loop step → состояние с activation predicate, actions, completion, effects, transition |
| 1.3.3 | Последний step обязан вернуть ресурс, активирующий первый, либо explicit reset rule |
| 1.3.4 | Telemetry events: `step_enter`, `action_attempt`, `step_complete` |
| 1.3.5 | Unit-тесты: замкнутый цикл, unreachable step detection |

**Критерий готовности 1.3:** Core Loop steps компилируются в исполняемую state machine.

#### Спринт 1.4 — Scene topology + world synthesis (~4 дня)

| # | Задача |
|---|--------|
| 1.4.1 | Создать `src/lib/prototype-compiler/compiler/scene-grammar.ts` |
| 1.4.2 | Реализовать 2 топологии MVP: `arena` (movement/combat/avoid), `lanes` (defense/waves/racing) |
| 1.4.3 | Topology scoring: `mechanicAffinity + interactionAffinity + structuralPrior - conflicts` |
| 1.4.4 | Synthesize primitive world: player spawn, targets, obstacles, boundaries, sinks/faucets |
| 1.4.5 | Цвет кодирует роль (player/threat/resource/goal/hazard), не жанр |
| 1.4.6 | Unit-тесты: topology selection determinism, minimal entity count |

**Критерий готовности 1.4:** Для shooter → `arena`, для tower defense → `lanes`.

#### Спринт 1.5 — Shared deterministic runtime (~1 неделя)

| # | Задача |
|---|--------|
| 1.5.1 | Создать `src/lib/prototype-compiler/runtime/engine.ts` — minimal ECS/Rule VM |
| 1.5.2 | Simulation clock 60 Hz, seeded PRNG (mulberry32 или similar) |
| 1.5.3 | Deterministic entity IDs и spawn order |
| 1.5.4 | Entity/rule/event budgets (limits для предотвращения event storm) |
| 1.5.5 | Circle/AABB/capsule collisions |
| 1.5.6 | Renderer-independent transforms и physics |
| 1.5.7 | Pause/restart/timeout |
| 1.5.8 | postMessage по versioned event schema |
| 1.5.9 | Unit-тесты: determinism (same seed → same result), budget enforcement |

**Критерий готовности 1.5:** Runtime исполняет IR детерминированно, без NaN/unbounded growth.

#### Спринт 1.6 — 2D renderer adapter (~4 дня)

| # | Задача |
|---|--------|
| 1.6.1 | Создать `src/lib/prototype-compiler/renderers/renderer-2d.ts` |
| 1.6.2 | Canvas2D adapter (или совместимый слой LittleJS) |
| 1.6.3 | Primitive mapping: actor → circle, obstacle → rect, collectible → diamond, projectile → small circle |
| 1.6.4 | Camera + input (keyboard/mouse/touch) |
| 1.6.5 | Интеграция с shared runtime |
| 1.6.6 | E2E тест: shooter fixture → 2D HTML → bot завершает loop |

**Критерий готовности 1.6:** 2D прототип shooter'а играбелен и проходит bot reachability.

#### Спринт 1.7 — Static + headless validation gates (~3 дня)

| # | Задача |
|---|--------|
| 1.7.1 | Реализовать gates 1-7 из раздела 8 шаг 8 (static checks) |
| 1.7.2 | Gate 8: policy bot может завершить loop |
| 1.7.3 | Gate 9: idle policy **не выигрывает автоматически** |
| 1.7.4 | Gate 10: нет NaN, unbounded growth, event storm |
| 1.7.5 | Coverage report: `PrototypeCoverageReport` (раздел 13) |
| 1.7.6 | Статусы: `playable` / `needs_mapping` / `invalid` / `build_failed` |

**Критерий готовности Фазы 1:** для shooter, survival, tower defense, arcade генерируются **реальные играбельные прототипы** с traceability от действий к механикам Core Loop.

---

### Фаза 2 — Расширение coverage и 3D · ~4-6 недель

#### Спринт 2.1 — Дополнительные адаптеры (~2 недели)

| Адаптер | Механики |
|---------|----------|
| `interact/deliver` | activate, carry, deposit |
| `convert/craft` | craft, trade, combine |
| `build/place` | build, tower placement |
| `defend` | protect base, wave defense |
| `upgrade` | improve, level |
| `transform` | rotate, push, redirect |
| `puzzle` | match, connect, route |
| `timing` | rhythm, timed input |

#### Спринт 2.2 — Дополнительные топологии (~1 неделя)

- `rooms` — exploration/delivery/stealth
- `grid` — placement/puzzle/route
- `node_field` — collect/convert/economy

#### Спринт 2.3 — 3D renderer adapter (~1.5 недели)

| # | Задача |
|---|--------|
| 2.3.1 | Создать `src/lib/prototype-compiler/renderers/renderer-3d.ts` на Three.js |
| 2.3.2 | Primitive mapping: actor → capsule, obstacle → box, collectible → octahedron, projectile → small sphere |
| 2.3.3 | Камера (perspective), input (mouse + WASD) |
| 2.3.4 | **Тот же runtime**, тот же IR — только renderer отличается |
| 2.3.5 | E2E тест: shooter fixture → 2D и 3D builds имеют одинаковые rule/objective/resource hashes |

#### Спринт 2.4 — Telemetry pipeline (~1 неделя)

| # | Задача |
|---|--------|
| 2.4.1 | События: `session_start/end`, `input_action`, `mechanic_triggered`, `step_enter/complete`, `resource_changed`, `damage/death/retry`, `loop_complete`, `win/lose/timeout`, `inactivity_window` |
| 2.4.2 | Метрики: time to first action, completion rate per step, loop completion time, stalls, invalid actions, damage/death/retry distribution, mechanic usage coverage |
| 2.4.3 | Связь с `prototypeId`, `hypothesisId`, IR/runtime/compiler versions, Core Loop lineage |
| 2.4.4 | Только реальные playtests меняют fun hypothesis на `supported`/`rejected` |

---

### Фаза 3 — Node editor integration + cleanup · ~2-3 недели

#### Спринт 3.1 — Node editor projection (~1.5 недели)

| # | Задача |
|---|--------|
| 3.1.1 | Core Loop compiler создаёт IR |
| 3.1.2 | Editor показывает и редактирует разрешённую projection IR |
| 3.1.3 | Ручной graph компилируется сначала в тот же IR |
| 3.1.4 | Compiler и editor используют один registry definitions |

#### Спринт 3.2 — Legacy migration + cleanup (~1 неделя)

| # | Задача |
|---|--------|
| 3.2.1 | Legacy `NodeGraph → raw JS` становится временным importer |
| 3.2.2 | Сравнить с legacy templates на golden fixtures |
| 3.2.3 | Удалить silent fallback (legacy generator) |
| 3.2.4 | Обновить UI: чёткое разделение «real prototype» vs «template prototype» |

#### Спринт 3.3 — Acceptance fixtures (~1 неделя)

6 механически различимых fixtures (раздел 14 design spec):

1. **shooter:** move + aim + shoot + capture
2. **puzzle:** rotate rooms + redirect light + connect path
3. **tower defense:** gather/spend + place + defend + upgrade
4. **economy:** collect + convert + trade + reinvest
5. **survival:** navigate + avoid + limited resource management
6. **rhythm:** timed input + combo + miss penalty

Для каждого fixture:
- 2D и 3D builds имеют одинаковые rule/objective/resource hashes
- все source mechanic IDs присутствуют в mechanic bindings и telemetry
- policy bot завершает loop в заданном budget
- idle bot не завершает loop
- изменение одной mechanic меняет IR и input hash
- изменение только renderer не меняет semantic hash
- unsupported mandatory mechanic даёт `needs_mapping`, а не generic prototype

---

## Зависимости и предусловия

| Зависимость | Статус | Влияние |
|-------------|--------|---------|
| R4-07: canonical mechanic IDs | ⚠️ Проверить статус | Без неё компилятор не может разрешать механики; до неё — versioned alias resolver с evidence |
| Core Loop `accepted` + `fresh` status | ✅ Уже есть (pipeline-quality-gates) | Предусловие для компиляции |
| Resource graph validation | ✅ Уже есть (coreloop/validation) | Предусловие для замкнутого цикла |
| Versioned Zod schema для input | ✅ Уже есть (contracts/stage-contracts) | Линия артефактов |

---

## LLM-политика (из design spec, раздел 11)

LLM **не генерирует исполняемый JavaScript прототипа**.

Допустимые задачи LLM:
- предложить mapping неизвестного mechanic label к существующему adapter;
- предложить primitive metaphor или UI instruction;
- объяснить compile diagnostics;
- предложить bounded parameter values по строгой схеме.

Любой LLM mapping имеет `llm_generated` provenance, проходит schema validation и требует подтверждения пользователя, если меняет обязательную механику.

---

## Канбан статусов

- ⬜ Not started
- 🔄 In progress
- ✅ Done
- ⚠️ Blocked
- 🔁 Needs review

---

## Git-конвенция

- Ветка: `nextjs-port`
- Коммиты: `feat(prototype-compiler): <краткое описание>`
- Перед каждым коммитом: `bun run lint` (должен быть без ошибок)
- После каждого спринта: push в origin
- Большие изменения — через feature branch + PR (если команда вырастет)

---

## Обновление этого документа

После завершения каждого спринта обновлять статусы в таблицах (⬜ → 🔄 → ✅) и добавлять заметки в колонку «Заметки».
