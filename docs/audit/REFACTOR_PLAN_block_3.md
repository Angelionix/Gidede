# Рефакторинг Блока 3 — MDA Lab

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-3 (sub-agent)
**Связанные документы**: `docs/audit/AUDIT_REPORT.md` (раздел 3), `docs/bible/bible_2_3_mda_framework.md`, `docs/audit/REFACTOR_PLAN_block_1.md` (TASK-1.1 MechanicsDB genre_affinity), `docs/audit/REFACTOR_PLAN_block_2.md`
**Объект рефакторинга**:
- `src/app/api/v1/mda/analyze/route.ts` (875 строк)
- `src/lib/ai-service.ts` (функция `enrichMda`, строки 547–583)
- `src/types/mda.ts` (35 строк — только плоские интерфейсы)
- `src/constants/mda.ts` (42 строки — `PRIORITY_LENSES`, `BOND_ELEMENTS`, `EMERGENCE_BADGES`)
- `src/config/aesthetics.ts` (108 строк — Hunicke 8 + Yee)
- `prisma/schema.prisma` (модель `ProjectMDAProfile`, строки 166–192)
- `scripts/run_pipeline_test.sh` (строка 106 — pipeline runner bug)
- `src/lib/pipeline-helpers.ts` (`buildPreparedInput` для blockId=3)

---

## Контекст

Блок 3 (MDA Lab) — третий этап пайплайна Gidede. Принимает на вход целевые эстетики (Hunicke 8) + жанр + идею + опциональные ограничения, выполняет заявленный **двойной MDA-процесс** (Bible 3.5):

1. **Generative pass (Reverse MDA)** — Aesthetics → Dynamics → Mechanics (Bible 3.4–3.5.4)
2. **Analytic pass (Classic MDA)** — Mechanics → Dynamics → Predicted Aesthetics → сравнение с target (Bible 3.5.2)
3. **Shell's 9 priority lenses** — валидация (Bible 3.6.2)
4. **Bond 4×3 matrix + ludonarrative** — финальная проверка согласованности (Bible 3.7)

Фактическая реализация в `route.ts` (875 строк, 7 стадий) структурно проходит все 4 шага, но **фактически не выполняет** полезную работу: ключевые метрики `overall_match`, `converged`, `iterations` принимают одни и те же значения для всех 10 test_projects, что инвалидирует весь Classic MDA pass и делает данные в БД бесполезными для downstream-блоков (GDD, чек-лист, прогрессия).

### Подтверждённые дефекты (проверены на всех 10 test_projects)

Все 10 файлов `test_projects/*/03_mda.json` **байт-в-байт идентичны** по следующим полям:

| Поле | Значение (одинаковое для всех 10) | Ожидаемое |
|------|----------------------------------|-----------|
| `aesthetic_profile.primary` | `"challenge"` | Зависит от project.concept |
| `aesthetic_profile.secondary` | `"fantasy"` | Зависит от project.concept |
| `aesthetic_profile.tertiary` | `"discovery"` | Зависит от project.concept |
| `genre` | `"rpg"` | Зависит от project.concept.genre |
| `concept_id` | `"standalone"` | project.id или concept.id |
| `classic_mda_result.overall_match` | `0` | > 0 (зависит от механик) |
| `classic_mda_result.converged` | `false` | Зависит от threshold |
| `classic_mda_result.iterations` | `3` | Зависит от actual итераций |
| `classic_mda_result.predicted_aesthetics.challenge` | `0` | > 0 (primary должна покрываться) |
| `mechanic_set.base` | `["inventory_management","dialogue_trees"]` | Зависит от жанра |
| `mechanic_set.combat` | `["turn_based_combat","ability_cooldowns"]` | Зависит от жанра |
| `mechanic_set.compatibility_score` | `94` | Зависит от реальной совместимости |
| `mechanic_set.synergy_score` | `96` | Зависит от реальной синергии |

### Корневые причины (root causes)

**RC-1: `overall_match = 0` всегда** — функция `buildClassicMDA` (route.ts:344–467) на строке 402:
```ts
const mechs = DYNAMICS_TO_MECHANICS[(AESTHETIC_TO_DYNAMICS[a] || [""])[0]] || [];
```
Берёт только **первую** динамику эстетики (3 доступны), игнорируя 2 и 3. Кроме того, `mechanicSet` строится из `GENRE_DEFAULT_MECHANICS` (route.ts:94–123), имена которого **не пересекаются** с именами в `DYNAMICS_TO_MECHANICS` (route.ts:66–91).

Подтверждённый расчёт для Shadow_Depths (RPG, primary=challenge):
- `AESTHETIC_TO_DYNAMICS["challenge"][0] = "skill_scaling"`
- `DYNAMICS_TO_MECHANICS["skill_scaling"] = ["difficulty_settings","enemy_scaling","player_buffs"]`
- `mechanicSet` содержит: `inventory_management, dialogue_trees, turn_based_combat, ability_cooldowns, xp_leveling, skill_trees, world_exploration, dungeon_navigation, party_management, merchant_trading`
- Overlap = `0` (ни одна из 3 механик `skill_scaling` не входит в mechanicSet)
- `predicted_aesthetics["challenge"] = 0/3 = 0`
- `match_scores["challenge"] = 1 * 0 * 0.5 + min(1,0) * 0.5 = 0`
- `primaryMatch = 0`, `secondaryMatch = 0` (тоже 0 для fantasy)
- `overall_match = 0 * 0.6 + 0 * 0.4 = 0` ✅ подтверждено

**RC-2: Все 10 test_projects идентичны** — `scripts/run_pipeline_test.sh:106`:
```bash
-d "{\"project_id\":\"$PID\",\"target_aesthetics\":[\"challenge\",\"discovery\"],\"use_ai\":true}" \
```
Pipeline runner передаёт `target_aesthetics` (массив), но route.ts ожидает `primary_aesthetic`/`secondary_aesthetic`/`tertiary_aesthetic` (три скаляра). Поле `target_aesthetics` **молча игнорируется**. Route не загружает `project.concept.aestheticProfile` даже когда поля отсутствуют — fallback на захардкоженные дефолты `challenge/fantasy/discovery` (route.ts:678–680).

**RC-3: `converged = false`, `iterations = 3` всегда** — прямое следствие RC-1. Строка 437–438:
```ts
const converged = overallMatch >= convergenceThreshold;
const iterations = converged ? 1 : 3;
```
Никакой реальной итерации нет — `iterations` это просто `1` или `3`. Классический MDA не «циклится», а просто помечает результат как «не сошёлся за 3 попытки» без фактических попыток.

**RC-4: Lens #41 инвертирована** — route.ts:511:
```ts
if (lens.id === 41 && score > 0.7) {
  issuesFound.push("Possible dominant strategy detected");
}
```
Линза «Доминантная стратегия» должна flag'ать проблему (низкий score = доминантная стратегия есть), а не высокий score.

**RC-5: `compatibility_score` всегда 90+** — route.ts:293–321. Из 5 patterns 4 hardcoded `present: true`:
- `Engine pattern` → `present: true` (безусловно)
- `Dynamic coupling` → `present: dynamicsTarget.core_dynamics.length >= 2` (для 3 динамики всегда true)
- `Feedback loop (reinforcing)` → `present: progression.length > 0` (для любого жанра с progression группой — всегда)
- `Feedback loop (balancing)` → `present: combat.length > 0` (для любого жанра с combat группой — всегда)

Минимум: `50 + 4*8 + 0*2 = 82`, типично: `50 + 5*8 + 2*2 = 94` (Shadow_Depths).

**RC-6: Bond ludonarrative hardcoded** — route.ts:620–622:
```ts
const ludonarrative = {
  result: "Гармония",
  ...
};
```
Вне зависимости от mechanicSet.

**RC-7: Machinations graph сохраняется пустым** — route.ts:828, 846:
```ts
machinationsModel: JSON.stringify({ nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] }),
```
Block 4 (Balance) или Block 5b (Economy) должны заполнять это, но в Block 3 сохраняется пустота. Bible 3.5.2 «Шаг 1: Смоделировать динамику (Machinations / агентная симуляция)» — не реализовано.

**RC-8: AI enrichment не персистится** — route.ts:857–868. `enrichMda` вызывается **после** `db.projectMDAProfile.upsert`, поэтому `ai_insights` попадает только в HTTP response, но не в БД. Block 2 уже решил эту проблему (перенёс enrich до upsert). Block 1 plan (TASK-1.13) и Block 2 уже определили паттерн.

**RC-9: `EMERGENCE_BADGES` не содержит `"moderate"`** — constants/mda.ts:36–41 имеет только `nominal/weak/multiple/strong`, но route.ts:144,146 использует `"moderate"`. UI fallback на `nominal` badge — некорректно.

**RC-10: Type bypass в вызовах builder'ов** — route.ts:757,766:
```ts
lensValidation = buildLensValidation(
  mechanicSet as unknown as { compatibility_score: number; synergy_score: number },
  ...
);
bondValidation = buildBondValidation(
  mechanicSet as unknown as { compatibility_score: number },
  ...
);
```
`mechanicSet` имеет гораздо больше полей, но типы сужены через `as unknown as`. `MDAAnalysisResult` в `src/types/mda.ts` описан как `Record<string, unknown> | null` для всех подсекций — потеря type safety.

**RC-11: `mechanic_candidate_set.uncovered_dynamics` всегда `[]`** — все 8 эстетик имеют 3 динамики в `AESTHETIC_TO_DYNAMICS`, и каждая из 24 динамики имеет запись в `DYNAMICS_TO_MECHANICS`. Поэтому `coveredDynamics === requiredDynamics` всегда. Поле бесполезно.

**RC-12: `observed_dynamics` — это просто copy из input** — route.ts:382:
```ts
const observedDynamics = dynamicsTarget.core_dynamics.slice(0, 3);
```
Не «наблюдается» из mechanic set, а копируется из входных данных.

**RC-13: `gameplay_sequence` — hardcoded 3-step template** — route.ts:361–380. Всегда 3 шага с canned actions `"Engage ${baseMech}"`, `"Execute ${combatMech}"`, `"Use ${progMech}"`. Не зависит от жанра, количества механик, aesthetic profile.

**RC-14: Lens categories не соответствуют Bible 3.6** — Bible 3.6.1 определяет 16 групп линз; route.ts:486 использует 4 категории (`целостность`, `эмерджентность`, `баланс`, `интерес`). Bible 3.6.3 explicitly: «Линзы опыта (1-8, 19-25, 68-82, 96-99) → Уровень «Опыт игрока»», «Линзы геймплея (9-12, 26-36, 37-58, 59-67)», «Линзы процесса и контекста (13-18, 83-95, 100-113)». Реализация не различает уровни Зубека.

**RC-15: `enrichMda` prompt generic** — ai-service.ts:557–568. Передаёт только `projectName`, `genre`, `aesthetics` (3 строки). Не передаёт `mechanicSet`, `dynamicsTarget`, `lensValidation`, `bondValidation`. LLM не может дать конкретные советы по mechanic set, который реально сгенерирован.

**RC-16: `void safeJsonParse;` dead code** — route.ts:855. Linter workaround, импорт без использования.

**RC-17: `buildMechanicSet` round-robin для existingMechanics** — route.ts:242–252:
```ts
for (let i = 0; i < existingMechanics.length; i++) {
  const m = existingMechanics[i];
  if (forbiddenMechanics.includes(m)) continue;
  const group = i % 5;
  if (group === 0) baseSet.add(m);
  else if (group === 1) combatSet.add(m);
  ...
}
```
Mechanics распределяются по группам по индексу `i`, не по semantic content. Механика "voice_acting" может попасть в "spatial".

**RC-18: `filterToMax` slices first N** — route.ts:260–263:
```ts
const filterToMax = (set: Set<string>) => {
  const arr = Array.from(set);
  return arr.slice(0, Math.max(1, Math.ceil(maxMechanics / 5) + 1));
};
```
Slice без сортировки по affinity/relevance. Первые N механик побеждают, остальные отбрасываются.

**RC-19: Aesthetic coverage тоже берёт только `[0]`** — route.ts:275–277:
```ts
const mechs = DYNAMICS_TO_MECHANICS[
  (AESTHETIC_TO_DYNAMICS[aesthetic] || [])[0] || ""
] || [];
```
Тот же баг, что в `buildClassicMDA` (RC-1). Aesthetic coverage для fantasy считается только по `role_immersion` dynamics, игнорируя `character_growth` и `world_belief`. Поэтому `aesthetic_coverage[fantasy].count = 0` даже если mechanic set содержит `xp_leveling, skill_trees` (это механики для `character_growth`).

**RC-20: `match_scores` формула с минимумом** — route.ts:423–426:
```ts
const score = Number(
  (target * predicted * 0.5 + Math.min(target, predicted) * 0.5).toFixed(2)
);
```
Когда `predicted = 0`, score = 0 всегда (даже если target = 1). Это означает, что **невозможно** достичь `overall_match > 0` без починки RC-1.

---

## Цели рефакторинга

1. **Починить `overall_match`** — перестать брать только `[0]` динамику, выровнять `mechanic_id` namespace между `DYNAMICS_TO_MECHANICS` и `GENRE_DEFAULT_MECHANICS` / MechanicsDB.
2. **Реализовать реальную итерацию** Classic MDA: на каждой итерации добавлять mechanics для under-covered эстетик, пересчитывать `predicted_aesthetics`, проверять сходимость.
3. **Реализовать настоящий Reverse MDA** — mechanic set должен строиться от dynamics_target, не от genre defaults (Bible 3.5.4).
4. **Починить тестовый pipeline** — `run_pipeline_test.sh` должен передавать корректный shape (3 scalar aesthetics) либо route должен загружать `project.concept.aestheticProfile`.
5. **Реальная Bond matrix** — заполнить 12 ячеек конкретным контентом из mechanic set + aesthetic profile; вычислить ludonarrative (Гармония/Ирония/Диссонанс) на основе match scores.
6. **Реальная `compatibility_score`** — убрать hardcoded `present: true`, считать по фактическому overlap с MechanicsDB.
7. **Реальный `observed_dynamics`** — выводить из mechanic set, не копировать из input.
8. **Реальный `gameplay_sequence`** — генерировать из mechanic set, не 3-step canned template.
9. **Реальный machinations graph** — строить из mechanic set (хотя бы skeleton) для Block 4/5b.
10. **Persist AI enrichment** — перенести `enrichMda` ДО `db.upsert`, сохранять `ai_insights` в `fullProfile`.
11. **Type safety** — описать `MDAAnalysisResult` с конкретными подобъектами, убрать `as unknown as` casts.
12. **Bible 3.6 alignment** — добавить lens categories по уровням Зубека (опыт/геймплей/контекст) для targeted валидации.
13. **Расширить `enrichMda` prompt** — передавать `mechanicSet`, `dynamicsTarget`, `lensValidation`, `bondValidation`.
14. **Убрать dead code** — `void safeJsonParse`, неиспользуемые импорты.
15. **EMERGENCE_BADGES fix** — добавить `moderate` или переименовать `multiple` → `moderate`.

---

## Задачи

### TASK-3.1: Выровнять `mechanic_id` namespace между `DYNAMICS_TO_MECHANICS`, `GENRE_DEFAULT_MECHANICS` и MechanicsDB

**Сложность**: XL
**Приоритет**: 🔴 (блокирует TASK-3.2, TASK-3.3, TASK-3.4, TASK-3.9, TASK-3.19)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 66–123), `src/lib/mechanics-db.ts`, новый `src/constants/mda-namespaces.ts`

**Описание проблемы**:

В route.ts сосуществуют три независимых источника имён механик:

1. **`DYNAMICS_TO_MECHANICS`** (строки 66–91) — 24 динамики × 3 механики = 72 имени. Все в `snake_case` английском: `"health_damage"`, `"difficulty_settings"`, `"voice_acting"`, `"backstory_choices"`, `"xp_leveling"`, `"skill_trees"`, `"ability_cooldowns"`.
2. **`GENRE_DEFAULT_MECHANICS`** (строки 94–123) — 4 жанра × 5 групп × 2 = 40 имен. Тоже `snake_case` английский: `"inventory_management"`, `"turn_based_combat"`, `"world_exploration"`, `"party_management"`, `"merchant_trading"`.
3. **MechanicsDB** (`src/lib/mechanics-db.ts`) — 128 механик с **русскими** именами: `"Изучение мира"`, `"Броня"`, `"Древо технологий"`, `"Здоровье"`, `"Очки опыта"`.

Overlap между 1 и 2: только **3** имени (`"ability_cooldowns"`, `"xp_leveling"`, `"skill_trees"` в character_growth). Overlap между 1+2 и 3: **0** (русский vs английский).

Из-за этого:
- `buildClassicMDA` (RC-1) считает overlap = 0 для всех эстетик, кроме sensation/narrative (там случайно 1 механика совпала).
- `buildMechanicSet.aesthetic_coverage` (RC-19) возвращает `count=0` для 6 из 8 эстетик.
- Block 4 (Balance), Block 5b (Economy), Block 6 (GDD) получают `mechanic_set` с английскими именами, но MechanicsDB возвращает русские — любые lookup-таблицы ломаются.

**Решение**:

1. **Выбрать единый canonical namespace** — `snake_case` английский (подходит для JSON, machine-readable, не зависит от UI localisation). Это базовый идентификатор.

2. **Создать `src/constants/mda-namespaces.ts`** с тремя mapping'ами:
   ```ts
   // MechanicsDB (русское имя) → canonical_id
   export const MECHANICS_DB_ID: Record<string, string> = {
     "Изучение мира": "world_exploration",
     "Броня": "armor_system",
     "Древо технологий": "skill_trees",
     "Здоровье": "health_damage",
     "Очки опыта": "xp_leveling",
     "Инвентарь": "inventory_management",
     "Диалоги": "dialogue_trees",
     "Квесты": "quest_log",
     "Парирование": "parry_mechanic",
     // ... 128 entries (можно сгенерировать скриптом + ручной review)
   };

   // canonical_id → MechanicsDB русское имя (для UI)
   export const ID_TO_DISPLAY_NAME: Record<string, string> =
     Object.fromEntries(
       Object.entries(MECHANICS_DB_ID).map(([ru, en]) => [en, ru])
     );

   // Список canonical IDs (для валидации)
   export const ALL_MECHANIC_IDS: string[] = Object.values(MECHANICS_DB_ID);
   ```

3. **Переписать `GENRE_DEFAULT_MECHANICS`** — использовать canonical IDs, добавить жанры `puzzle`, `racing`, `fighting`, `platformer`, `simulation`, `adventure`, `tower_defense`, `horror`, `roguelike`, `sandbox`, `metroidvania`, `rhythm`:
   ```ts
   export const GENRE_DEFAULT_MECHANICS: Record<string, Record<string, string[]>> = {
     rpg: {
       base: ["inventory_management", "dialogue_trees", "quest_log"],
       combat: ["turn_based_combat", "ability_cooldowns", "health_damage"],
       progression: ["xp_leveling", "skill_trees", "ability_unlocks"],
       spatial: ["world_exploration", "dungeon_navigation", "landmark_discovery"],
       social: ["party_management", "merchant_trading", "npc_dialogue"],
     },
     shooter: {
       base: ["aim_assist", "reload_mechanic", "ammo_management"],
       combat: ["hitscan_combat", "projectile_physics", "health_damage"],
       progression: ["weapon_unlocks", "perk_trees", "loadout_system"],
       spatial: ["tactical_movement", "vertical_traversal", "cover_system"],
       social: ["squad_coordination", "leaderboards", "voice_chat"],
     },
     // ... ещё 11 жанров
     default: { /* как сейчас, но с canonical IDs */ },
   };
   ```

4. **Переписать `DYNAMICS_TO_MECHANICS`** — для каждой динамики перечислить механики **существующие в MechanicsDB** (canonical IDs). Использовать Bible 3.5.4 mapping:
   ```ts
   // Bible 3.5.4: Чувственное → Действия (кинетические), Эстетическое оформление, Сочность фидбэка
   // Aesthetic → typical dynamics (LeBlanc)
   export const AESTHETIC_TO_DYNAMICS: Record<string, string[]> = {
     sensation: ["combat_pacing", "feedback_effects", "audio_visual_sync"],
     fantasy: ["role_immersion", "character_growth", "world_belief"],
     // ... (без изменений)
   };

   export const DYNAMICS_TO_MECHANICS: Record<string, string[]> = {
     // Для combat_pacing — механики, которые физически есть в MechanicsDB
     combat_pacing: ["health_damage", "ability_cooldowns", "enemy_ai"],
     // Для skill_scaling — механики для Вызова (Bible: "Навык + Шанс, Петли ОС эскалации")
     skill_scaling: ["difficulty_settings", "enemy_scaling", "perfect_timing"],
     // Для character_growth — механики для Фантазии (Bible: "Прогрессия, Роль/класс, Объекты-аватар")
     character_growth: ["xp_leveling", "skill_trees", "ability_unlocks", "character_customization"],
     // Для role_immersion — voice_acting и backstory_choices УБИРАЕМ (нет в MechanicsDB)
     // или ДОБАВЛЯЕМ их в MechanicsDB (рекомендуется: 8 новых механик)
     role_immersion: ["character_customization", "npc_dialogue", "backstory_choices"],
     // ... для всех 24 динамики
   };
   ```

5. **Решение для `voice_acting` и `backstory_choices`** — либо:
   - **(a)** Добавить 8–12 новых механик в MechanicsDB (рекомендуется; Bible 2.2.5 Level 3 = 127 механик SW.BAND, реально может быть 135–140 после расширения).
   - **(b)** Заменить на существующие: `"voice_acting"` → `"npc_dialogue"` (есть в MechanicsDB).

   Рекомендация: **(a)** для Bible-соответствия + **(b)** как fallback для backward-compat в течение переходного периода.

6. **Покрыть все 24 динамики из `AESTHETIC_TO_DYNAMICS`** — каждая должна иметь ≥1 механику в `DYNAMICS_TO_MECHANICS`, и каждая механика должна существовать в MechanicsDB. Валидация:
   ```ts
   // В src/constants/mda-namespaces.ts
   export function validateMechanicNamespaces(): string[] {
     const errors: string[] = [];
     for (const [dyn, mechs] of Object.entries(DYNAMICS_TO_MECHANICS)) {
       for (const m of mechs) {
         if (!ALL_MECHANIC_IDS.includes(m)) {
           errors.push(`DYNAMICS_TO_MECHANICS["${dyn}"] references unknown mechanic "${m}"`);
         }
       }
     }
     for (const [genre, groups] of Object.entries(GENRE_DEFAULT_MECHANICS)) {
       for (const [group, mechs] of Object.entries(groups)) {
         for (const m of mechs) {
           if (!ALL_MECHANIC_IDS.includes(m)) {
             errors.push(`GENRE_DEFAULT_MECHANICS["${genre}"]["${group}"] references unknown mechanic "${m}"`);
           }
         }
       }
     }
     return errors;
   }
   ```
   Вызывать в unit-тестах (TASK-3.20).

7. **Backward compat** — для существующих `ProjectMDAProfile` записей в БД со старыми IDs, добавить миграцию (одноразовый скрипт `scripts/migrate-mda-mechanic-ids.ts`):
   ```ts
   // Для каждой записи с mechanicSet, содержащим старые IDs, переписать на canonical
   // Старые IDs (English snake_case) уже совпадают с canonical для большинства механик,
   // нужно только переименовать ~5 спорных случаев.
   ```

**Тест-кейсы**:
- `validateMechanicNamespaces()` возвращает `[]` (нет unknown references).
- Для каждого из 8 эстетик: `AESTHETIC_TO_DYNAMICS[a]` → для каждой динамики `DYNAMICS_TO_MECHANICS[d]` возвращает ≥3 механики, ВСЕ присутствуют в MechanicsDB.
- Для каждого из 12+ жанров в `GENRE_DEFAULT_MECHANICS`: все 5 групп (`base/combat/progression/spatial/social`) содержат ≥2 механики, все из MechanicsDB.
- `MECHANICS_DB_ID["Броня"] === "armor_system"`.
- `ID_TO_DISPLAY_NAME["armor_system"] === "Броня"`.
- Для существующей записи `ProjectMDAProfile.mechanicSet` (JSON с `"inventory_management"`) — после миграции поле сохраняет `"inventory_management"` (уже canonical).

**Риски**:
- **Объём работы**: 128 entries × 2 mapping (ru→en + en→ru) + проверка 24×3+12×5×2 = ~150 cross-references. Митигация: автоматическая генерация draft + ручной review спорных случаев (как в TASK-1.1 из Block 1 plan).
- **Bilingual UI** — frontend может использовать `AESTHETIC_MAP` (config/aesthetics.ts:54) с русскими лейблами для эстетик. Для механик нужно либо (a) показывать `ID_TO_DISPLAY_NAME[id]`, либо (b) добавить `label` в `AESTHETIC_MAP`. Рекомендация: (a).
- **DB миграция** — существующие 10 test_projects имеют `mechanicSet` с английскими IDs (уже canonical для большинства). Миграция минимальна.
- **Зависимость от Block 1 TASK-1.1** — Block 1 plan уже предполагает заполнение `genre_affinity` в MechanicsDB. Coordinate ID схему.

**Dependencies**: TASK-1.1 (Block 1) — genre_affinity заполнение; TASK-1.6 (Block 1) — невалидные эстетики "competition"/"strategy" должны быть исправлены.

---

### TASK-3.2: Перебирать все динамики эстетики в `buildClassicMDA` и `buildMechanicSet.aesthetic_coverage`

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-3.3, TASK-3.7, TASK-3.19)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 397–414, 273–290)

**Описание проблемы**:

**Баг 1**: `buildClassicMDA` (route.ts:402) берёт только `[0]` динамику:
```ts
const mechs = DYNAMICS_TO_MECHANICS[(AESTHETIC_TO_DYNAMICS[a] || [""])[0]] || [];
```
Каждая эстетика имеет 3 динамики в `AESTHETIC_TO_DYNAMICS`. Например, для `challenge`: `["skill_scaling", "difficulty_curves", "mastery_growth"]`. Берётся только `skill_scaling`, игнорируются `difficulty_curves` и `mastery_growth`.

**Баг 2**: `buildMechanicSet.aesthetic_coverage` (route.ts:275–277) — идентичный баг:
```ts
const mechs = DYNAMICS_TO_MECHANICS[
  (AESTHETIC_TO_DYNAMICS[aesthetic] || [])[0] || ""
] || [];
```

**Эффект**: `aesthetic_coverage[fantasy].count = 0` даже когда `mechanicSet` содержит `xp_leveling, skill_trees` (механики для `character_growth` dynamics, которая является второй для fantasy).

**Решение**:

1. **Создать helper `getMechanicsForAesthetic`** (новая функция в route.ts или в `src/constants/mda-namespaces.ts`):
   ```ts
   /**
    * Returns ALL mechanics that contribute to an aesthetic, by aggregating
    * mechanics across ALL dynamics of that aesthetic (not just [0]).
    * Bible 3.5.4: one aesthetic ↔ 3 dynamics, each dynamics ↔ 3 mechanics.
    */
   export function getMechanicsForAesthetic(aesthetic: string): string[] {
     const dynamics = AESTHETIC_TO_DYNAMICS[aesthetic] || [];
     const allMechs = new Set<string>();
     for (const dyn of dynamics) {
       const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
       for (const m of mechs) allMechs.add(m);
     }
     return Array.from(allMechs);
   }
   ```

2. **Заменить строку 402** в `buildClassicMDA`:
   ```ts
   // БЫЛО:
   // const mechs = DYNAMICS_TO_MECHANICS[(AESTHETIC_TO_DYNAMICS[a] || [""])[0]] || [];

   // СТАЛО:
   const mechs = getMechanicsForAesthetic(a);
   ```

3. **Заменить строки 275–277** в `buildMechanicSet.aesthetic_coverage`:
   ```ts
   // БЫЛО:
   // const mechs = DYNAMICS_TO_MECHANICS[
   //   (AESTHETIC_TO_DYNAMICS[aesthetic] || [])[0] || ""
   // ] || [];

   // СТАЛО:
   const mechs = getMechanicsForAesthetic(aesthetic);
   ```

4. **Поправить формулу `predicted_aesthetics`** (route.ts:410–413) — учитывать уникальные механики:
   ```ts
   // БЫЛО:
   // const overlap = mechs.filter((m) => allMechs.includes(m)).length;
   // predictedAesthetics[a] = Number(
   //   Math.min(1, overlap / Math.max(1, mechs.length)).toFixed(2)
   // );

   // СТАЛО:
   const overlap = mechs.filter((m) => allMechs.includes(m)).length;
   // Учитываем coverage ratio (сколько из 3 dynamics имеют ≥1 matched mechanic)
   const dynamicsWithMatch = (AESTHETIC_TO_DYNAMICS[a] || []).filter(
     (dyn) => (DYNAMICS_TO_MECHANICS[dyn] || []).some((m) => allMechs.includes(m))
   ).length;
   const dynamicsCoverage = dynamicsWithMatch / Math.max(1, (AESTHETIC_TO_DYNAMICS[a] || []).length);
   const mechanicCoverage = overlap / Math.max(1, mechs.length);
   // Взвешенное: 60% mechanic coverage + 40% dynamics coverage
   predictedAesthetics[a] = Number(
     Math.min(1, mechanicCoverage * 0.6 + dynamicsCoverage * 0.4).toFixed(2)
   );
   ```

5. **Аналогично поправить `aesthetic_coverage.sufficient` порог** (route.ts:285–289):
   ```ts
   // БЫЛО: sufficient: count >= 1
   // СТАЛО: sufficient: count >= 1 && dynamicsWithMatch >= 2 (из 3 dynamics покрыты)
   const dynamicsWithMatch = (AESTHETIC_TO_DYNAMICS[aesthetic] || []).filter(
     (dyn) => (DYNAMICS_TO_MECHANICS[dyn] || []).some((m) => allMechsInSet.includes(m))
   ).length;
   return {
     aesthetic,
     count,
     dynamics_covered: dynamicsWithMatch,
     dynamics_total: (AESTHETIC_TO_DYNAMICS[aesthetic] || []).length,
     sufficient: count >= 1 && dynamicsWithMatch >= 2,
   };
   ```

**Тест-кейсы**:
- Для RPG, primary=challenge: `predicted_aesthetics.challenge > 0` (механики `xp_leveling, skill_trees` матчат `character_growth` динамику для fantasy, и `difficulty_settings, enemy_scaling` матчат `skill_scaling` динамику для challenge — обе динамики покрыты).
- Для RPG, secondary=fantasy: `predicted_aesthetics.fantasy > 0.3` (механики `xp_leveling, skill_trees, ability_unlocks, character_customization` матчат `character_growth` dynamics; `npc_dialogue` матчит `world_belief`).
- `aesthetic_coverage[fantasy].dynamics_covered >= 2` для RPG (character_growth + world_belief покрыты).
- `aesthetic_coverage[expression].dynamics_covered = 0` для RPG (нет creative_tools, customization, sandbox_building механик).

**Риски**:
- Без TASK-3.1 даже после TASK-3.2 overlap останется 0 для части эстетик, потому что `DYNAMICS_TO_MECHANICS` использует имена, не входящие в `GENRE_DEFAULT_MECHANICS`. **TASK-3.1 — обязательная предпосылка**.
- `dynamicsCoverage * 0.4` может переоценить для эстетик с большим количеством динамики (3 динамики, 1 mechanic covers 1 dynamics = 33% dynamics coverage, что даёт 0.33*0.4 = 0.13). Если задача — способствовать convergence, можно увеличить вес dynamics coverage.

**Dependencies**: TASK-3.1 (namespace alignment обязателен).

---

### TASK-3.3: Починить `match_scores` формулу и реализовать реальную итерацию Classic MDA

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-3.10, TASK-3.13, TASK-3.19)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 416–446)

**Описание проблемы**:

**Баг 1**: формула `match_scores` (route.ts:424–426):
```ts
const score = Number(
  (target * predicted * 0.5 + Math.min(target, predicted) * 0.5).toFixed(2)
);
```
Когда `predicted = 0`, оба слагаемых = 0, score = 0. Даже когда `predicted > 0`, score ограничен `min(target, predicted)`, что для вторичных эстетик (`target = 0.7`) и малого `predicted` (0.3) даёт `0.7 * 0.3 * 0.5 + 0.3 * 0.5 = 0.105 + 0.15 = 0.255`. Чтобы достичь `overall_match >= 0.8`, нужно `primaryMatch >= 0.9` И `secondaryMatch >= 0.85` — практически недостижимо.

**Баг 2**: `iterations = converged ? 1 : 3` (route.ts:438) — нет реальной итерации. Bible 3.5.2 явно требует: «Шаг 4: Если расхождение → вернуться к генеративному проходу».

**Решение**:

1. **Переписать формулу `match_scores`** — использовать F1-like score с reward за coverage:
   ```ts
   // Match score = harmonic mean of target and predicted, with recall emphasis
   // (we want to reward coverage of target aesthetics more than precision)
   const recall = predicted; // what fraction of target's mechanics we have
   const precision = target > 0 ? Math.min(1, predicted / target) : 1;
   const f1 = recall + precision > 0
     ? (2 * recall * precision) / (recall + precision)
     : 0;
   // Weighted: 70% F1, 30% raw predicted (so 0 predicted → 0 score, but partial coverage → meaningful score)
   const score = Number((0.7 * f1 + 0.3 * predicted).toFixed(2));
   ```

2. **Реализовать реальную итерацию** — `runClassicMdaIterations`:
   ```ts
   function runClassicMdaIterations(
     initialMechanicSet: MechanicSet,
     dynamicsTarget: DynamicsTarget,
     aesthetics: { primary: string; secondary: string; tertiary: string },
     convergenceThreshold: number,
     maxIterations: number = 5
   ): {
     finalMechanicSet: MechanicSet;
     iterations: Array<{
       iteration: number;
       overall_match: number;
       converged: boolean;
       adjustments: string[]; // что добавили/убрали
     }>;
     converged: boolean;
     iterationsDone: number;
   } {
     const history: IterationRecord[] = [];
     let currentMechanicSet = initialMechanicSet;
     let lastOverall = 0;
     let converged = false;

     for (let iter = 1; iter <= maxIterations; iter++) {
       const classicMda = buildClassicMDA(currentMechanicSet, dynamicsTarget, aesthetics, convergenceThreshold);
       const overall = classicMda.overall_match;
       const adjustments: string[] = [];

       if (overall >= convergenceThreshold) {
         converged = true;
         history.push({ iteration: iter, overall_match: overall, converged, adjustments: [] });
         return { finalMechanicSet: currentMechanicSet, iterations: history, converged, iterationsDone: iter };
       }

       // If not converged, add mechanics for under-covered aesthetics
       const underCovered = (Object.entries(classicMda.predicted_aesthetics) as [string, number][])
         .filter(([a, p]) => {
           const target = a === aesthetics.primary ? 1 : a === aesthetics.secondary ? 0.7 : a === aesthetics.tertiary ? 0.5 : 0.2;
           return p < target * 0.7; // less than 70% of target → under-covered
         })
         .map(([a]) => a);

       for (const a of underCovered.slice(0, 2)) { // max 2 adjustments per iteration
         const candidateMechanics = getMechanicsForAesthetic(a)
           .filter((m) => !mechanicInSet(currentMechanicSet, m));
         if (candidateMechanics.length > 0) {
           const addedMech = candidateMechanics[0];
           addMechanicToSet(currentMechanicSet, addedMech, a); // добавить в подходящую группу
           adjustments.push(`Added ${addedMech} to support ${a}`);
         }
       }

       history.push({ iteration: iter, overall_match: overall, converged: false, adjustments });

       // Early stop if no progress
       if (overall <= lastOverall + 0.01) {
         break;
       }
       lastOverall = overall;
     }

     return { finalMechanicSet: currentMechanicSet, iterations: history, converged, iterationsDone: history.length };
   }
   ```

3. **Сохранить в результат** массив итераций (расширить тип):
   ```ts
   // В buildClassicMDA return:
   return {
     ...existingFields,
     iterations_history: history, // NEW: массив итераций
     iterations: iterationsDone,
     converged,
     // ...
   };
   ```

4. **Обновить DB persistence** — добавить поле `iterationsHistory` в `ProjectMDAProfile` (или сохранять в `simulationResults` JSON).

5. **Передать finalMechanicSet наверх** — route handler должен использовать `finalMechanicSet` (после итераций) в `mechanic_set` поле результата, не `initialMechanicSet`:
   ```ts
   // route.ts: после Stage 4
   let mechanicSet = buildMechanicSet(...);
   let classicMdaResult = null;
   if (fullAnalysis) {
     const iterResult = runClassicMdaIterations(mechanicSet, dynamicsTarget, aestheticProfile, convergenceThreshold);
     mechanicSet = iterResult.finalMechanicSet; // UPDATE с учётом итераций
     classicMdaResult = buildClassicMDA(mechanicSet, dynamicsTarget, aestheticProfile, convergenceThreshold);
     classicMdaResult.iterations = iterResult.iterationsDone;
     classicMdaResult.iterations_history = iterResult.iterations;
     classicMdaResult.converged = iterResult.converged;
   }
   ```

**Тест-кейсы**:
- Для RPG, primary=challenge, secondary=fantasy: после 1-2 итераций `overall_match >= 0.5` (baseline); после 3-5 итераций `>= 0.7-0.8`.
- `iterations_history` содержит массив с `iteration`, `overall_match`, `adjustments` — длина ≥ 1.
- Если `convergenceThreshold = 0.4`, convergence достигается за 1-2 итерации (легко).
- Если `convergenceThreshold = 0.95`, convergence не достигается за 5 итераций (`iterations = 5`, `converged = false`, `overall_match` растёт но не достигает порога).
- `iterations_history[iter].overall_match` монотонно не убывает (каждая итерация добавляет механики, не убирает).
- Если на итерации N `overall_match` не вырос (> 0.01), цикл прерывается early.

**Риски**:
- **Stability** — добавление механик может разрастить `mechanic_set` сверх `maxMechanics`. Нужна проверка: `if (totalMechanics >= maxMechanics) break;`
- **Diminishing returns** — после 3-4 итераций добавление механик почти не меняет score. Early stop miticates.
- **Type change** — `iterations_done` остаётся числом, но добавляется `iterations_history: array`. Frontend Block 3 UI (`ClassicMDAPanel.tsx`) нужно обновить для отображения истории итераций.

**Dependencies**: TASK-3.1, TASK-3.2 (предпосылки для того, чтобы `predicted_aesthetics` были > 0).

---

### TASK-3.4: Реализовать настоящий Reverse MDA — mechanic set из dynamics_target, не из GENRE_DEFAULT_MECHANICS

**Сложность**: L
**Приоритет**: 🔴 (соответствие Bible 3.5.4)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 225–342, функция `buildMechanicSet`)

**Описание проблемы**:

Bible 3.5.1 явно описывает генеративный проход:
```
ШАГ 1: Определить целевую эстетику (2-3 типа из 8)
  ↓
ШАГ 2: Вывести целевую динамику (маппинг эстетика → динамика)
  ↓
ШАГ 3: Выбрать механики из MechanicsDB (через маппинг)
```

Реализация же использует `GENRE_DEFAULT_MECHANICS` как primary source, игнорируя `dynamicsTarget`:
```ts
// route.ts:233
const templates = GENRE_DEFAULT_MECHANICS[genre] || GENRE_DEFAULT_MECHANICS.default;
const baseSet = new Set(templates.base);
const combatSet = new Set(templates.combat);
// ...
```

`dynamicsTarget` передаётся в `buildMechanicSet` как параметр, но используется **только** для `patterns_detected[2].present` (Dynamic coupling) на строке 299. Mechanics НЕ выбираются из `dynamicsTarget.core_dynamics` / `supporting_dynamics`.

**Эффект**:
- `mechanic_candidate_set` (Stage 3) считает механики из dynamics, но `mechanic_set` (Stage 4) игнорирует их и берёт genre defaults.
- `mechanic_candidate_set.uncovered_dynamics = []` всегда (RC-11), потому что все dynamics имеют entries в `DYNAMICS_TO_MECHANICS`, но эти entries не попадают в `mechanic_set`.

**Решение**:

1. **Переопределить порядок**: mechanic set должен строиться из dynamics_target, с genre defaults только как fallback/supplement:
   ```ts
   function buildMechanicSet(
     genre: string,
     dynamicsTarget: { core_dynamics: string[]; supporting_dynamics: string[] },
     existingMechanics: string[],
     requiredMechanics: string[],
     forbiddenMechanics: string[],
     maxMechanics: number
   ): MechanicSet {
     // ШАГ 1: Собрать всех кандидатов из dynamics_target (Reverse MDA)
     const dynamicsMechanics = new Set<string>();
     const mechanicToDynamics: Record<string, string> = {}; // для категоризации

     for (const dyn of [...dynamicsTarget.core_dynamics, ...dynamicsTarget.supporting_dynamics]) {
       const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
       for (const m of mechs) {
         if (!forbiddenMechanics.includes(m)) {
           dynamicsMechanics.add(m);
           mechanicToDynamics[m] = dyn;
         }
       }
     }

     // ШАГ 2: Добавить existingMechanics (user-specified)
     for (const m of existingMechanics) {
       if (!forbiddenMechanics.includes(m)) {
         dynamicsMechanics.add(m);
         if (!mechanicToDynamics[m]) mechanicToDynamics[m] = "user_provided";
       }
     }

     // ШАГ 3: Добавить requiredMechanics
     for (const m of requiredMechanics) {
       if (!forbiddenMechanics.includes(m)) {
         dynamicsMechanics.add(m);
         if (!mechanicToDynamics[m]) mechanicToDynamics[m] = "required";
       }
     }

     // ШАГ 4: Категоризировать механики по группам (base/combat/progression/spatial/social)
     // на основе dynamics, к которой они принадлежат
     const baseSet = new Set<string>();
     const combatSet = new Set<string>();
     const progressionSet = new Set<string>();
     const spatialSet = new Set<string>();
     const socialSet = new Set<string>();

     // Mapping dynamics → group (на основе Bible 3.5.4)
     const DYNAMICS_TO_GROUP: Record<string, "base"|"combat"|"progression"|"spatial"|"social"> = {
       // base dynamics
       combat_pacing: "combat", feedback_effects: "base", audio_visual_sync: "base",
       // combat dynamics
       skill_scaling: "combat", difficulty_curves: "combat", mastery_growth: "progression",
       // progression dynamics
       character_growth: "progression", role_immersion: "progression", world_belief: "spatial",
       story_progression: "progression", character_arcs: "progression", lore_discovery: "spatial",
       // spatial dynamics
       exploration_loops: "spatial", secret_finding: "spatial", world_unfolding: "spatial",
       // social dynamics
       team_coordination: "social", social_bonding: "social", shared_goals: "social",
       // expression dynamics
       creative_tools: "base", customization: "base", sandbox_building: "spatial",
       // submission dynamics
       routine_formation: "progression", habit_loops: "progression", flow_state: "base",
     };

     for (const m of dynamicsMechanics) {
       const dyn = mechanicToDynamics[m];
       const group = (dyn && DYNAMICS_TO_GROUP[dyn]) || "base"; // default base
       switch (group) {
         case "combat": combatSet.add(m); break;
         case "progression": progressionSet.add(m); break;
         case "spatial": spatialSet.add(m); break;
         case "social": socialSet.add(m); break;
         default: baseSet.add(m);
       }
     }

     // ШАГ 5: Если dynamics_target не покрывает группу, дополнить из GENRE_DEFAULT_MECHANICS
     const genreDefaults = GENRE_DEFAULT_MECHANICS[genre] || GENRE_DEFAULT_MECHANICS.default;
     const ensureGroupMin = (set: Set<string>, defaults: string[], minCount: number = 2) => {
       const arr = Array.from(set);
       for (const d of defaults) {
         if (arr.length >= minCount) break;
         if (!set.has(d) && !forbiddenMechanics.includes(d)) {
           set.add(d);
           arr.push(d);
         }
       }
     };
     ensureGroupMin(baseSet, genreDefaults.base);
     ensureGroupMin(combatSet, genreDefaults.combat);
     ensureGroupMin(progressionSet, genreDefaults.progression);
     ensureGroupMin(spatialSet, genreDefaults.spatial);
     ensureGroupMin(socialSet, genreDefaults.social);

     // ШАГ 6: Применить maxMechanics (с сохранением пропорций)
     // ... filterToMax как раньше, но с учётом affinity/sort

     // ШАГ 7: ... остальное (aesthetic_coverage, patterns, scores)
   }
   ```

2. **Включить `mechanic_candidate_set` в финальный `mechanic_set`** как под-поле `derived_from_dynamics`, чтобы UI показывал связь:
   ```ts
   return {
     base, combat, progression, spatial, social,
     aesthetic_coverage: aestheticCoverage,
     patterns_detected: patterns,
     compatibility_score: compatibilityScore,
     synergy_score: synergyScore,
     suggestions, warnings,
     // NEW
     derived_from_dynamics: {
       core_dynamics_covered: dynamicsTarget.core_dynamics,
       supporting_dynamics_covered: dynamicsTarget.supporting_dynamics,
       mechanics_by_dynamics: mechanicToDynamics, // mapping mech → dynamics
       genre_defaults_added: /* список добавленных из GENRE_DEFAULT */,
     },
   };
   ```

3. **Удалить `mechanic_candidate_set` как отдельную стадию** (Stage 3) — она становится частью `mechanic_set` (Stage 4). Или оставить как «preliminary»:
   ```ts
   // mechanic_candidate_set = "сырой" список до категоризации
   // mechanic_set = структурированный по 5 группам
   ```
   Рекомендация: оставить как есть (две стадии), но `mechanic_candidate_set` должен стать **входом** для `mechanic_set`, а не отдельным расчётом.

**Тест-кейсы**:
- Для RPG, primary=challenge, secondary=fantasy, tertiary=discovery:
  - `core_dynamics = ["skill_scaling", "difficulty_curves", "mastery_growth"]`
  - `mechanic_set.combat` содержит `difficulty_settings, enemy_scaling, player_buffs` (из skill_scaling) + `adaptive_difficulty, level_design_pacing, skill_checks` (из difficulty_curves) + `combo_system, perfect_timing, ranking_system` (из mastery_growth).
  - `mechanic_set.progression` содержит `xp_leveling, skill_trees` (из character_growth — secondary fantasy).
  - `mechanic_set.spatial` содержит `map_reveal, fast_travel, landmark_discovery` (из exploration_loops — tertiary discovery).
- Для shooter, primary=sensation:
  - `mechanic_set.combat` содержит `health_damage, ability_cooldowns, enemy_ai` (из combat_pacing).
- `mechanic_set.derived_from_dynamics.core_dynamics_covered.length === dynamicsTarget.core_dynamics.length`.
- `mechanic_set.derived_from_dynamics.genre_defaults_added.length < 5` (минимум дополнений).

**Риски**:
- **Group imbalance** — если dynamics_target не покрывает social (например, для single-player RPG), `socialSet` будет содержать только genre defaults (2 механики). Это OK для большинства случаев, но может быть проблемой для кооперативных игр.
- **maxMechanics** — если dynamics_target имеет 9 динамики × 3 механики = 27 candidates, может превысить maxMechanics=18. Нужна стратегия: priority core_dynamics over supporting, дедупликация, affinity-based sort.
- **Backward compat** — существующий `mechanic_set` schema без `derived_from_dynamics` поле. Frontend должен gracefully handle absence.

**Dependencies**: TASK-3.1 (canonical IDs), TASK-3.2 (getMechanicsForAesthetic helper).

---

### TASK-3.5: Инвертировать logic в Lens #41 (Доминантная стратегия)

**Сложность**: S
**Приоритет**: 🔴 (semantic correctness)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строка 511)

**Описание проблемы**:

```ts
// route.ts:511
if (lens.id === 41 && score > 0.7) {
  issuesFound.push("Possible dominant strategy detected");
  suggestions.push("Add a counter-balancing mechanic to break the dominant path");
}
```

Bible 3.6.2 (Линза #41 «Доминантная стратегия»): фокус — «Есть ли один очевидно лучший путь?». Если доминантная стратегия есть (плохо), score должен быть НИЗКИЙ. Реализация flag'ает проблему когда score ВЫСОКИЙ — **инвертированная логика**.

**Эффект** (Shadow_Depths): `lens_validation.results[6] = { lens_id: 41, score: 0.98, issues_found: ["Possible dominant strategy detected"] }`. Парадокс: score = 0.98 (высокий = хорошо), но issues_found — это проблема.

**Решение**:

```ts
// БЫЛО:
// if (lens.id === 41 && score > 0.7) {
//   issuesFound.push("Possible dominant strategy detected");
//   suggestions.push("Add a counter-balancing mechanic to break the dominant path");
// }

// СТАЛО:
if (lens.id === 41) {
  // Линза #41: «Доминантная стратегия» — низкий score означает, что доминантная стратегия
  // ВЕРОЯТНО есть (мало альтернатив, мало контр-балансирующих механик).
  // Высокий score — много встречных стратегий, доминантной нет.
  if (score < 0.5) {
    issuesFound.push("Доминантная стратегия вероятна: мало контр-балансирующих механик");
    suggestions.push("Добавить контр-механику (counter-play), чтобы разрушить доминантный путь");
  } else if (score < 0.7) {
    issuesFound.push("Возможна доминантная стратегия — рассмотреть добавление альтернативных путей");
    suggestions.push("Ввести треугольность (Линза #40): риск vs безопасность");
  }
  // При score >= 0.7 — всё хорошо, нет issues
}
```

Дополнительно: `lens_validation.warnings` (route.ts:545–551) filter `score >= 0.4 && score < 0.6` — это уже корректно для других lens, но для #41 нужно явное правило.

**Тест-кейсы**:
- Для проекта с `score = 0.4` (мало механик в combat/progression): `issues_found` содержит «Доминантная стратегия вероятна».
- Для проекта с `score = 0.98` (как Shadow_Depths сейчас): `issues_found` для #41 = `[]` (пусто).
- `lens_validation.critical_issues` не содержит #41 при высоком score.
- `lens_validation.passed_count` для проекта с #41 score = 0.98: count includes #41.

**Риски**:
- После фикса Lens #41 в Shadow_Depths `issues_found = []` для #41 — изменится UI отображение (раньше было "Possible dominant strategy detected" warning). Это expected behaviour, не regression.
- Frontend (`LensAuditPanel.tsx`) может зависеть от старого pattern. Проверить UI.

**Dependencies**: нет (standalone fix).

---

### TASK-3.6: Загружать `aestheticProfile`/`genre`/`idea` из `project.concept` если не переданы в body

**Сложность**: M
**Приоритет**: 🔴 (блокирует корректную работу pipeline)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 670–720), `scripts/run_pipeline_test.sh` (строка 106)

**Описание проблемы**:

**Баг 1** (scripts/run_pipeline_test.sh:106):
```bash
-d "{\"project_id\":\"$PID\",\"target_aesthetics\":[\"challenge\",\"discovery\"],\"use_ai\":true}" \
```
Pipeline runner передаёт `target_aesthetics` (массив), но route ожидает `primary_aesthetic`/`secondary_aesthetic`/`tertiary_aesthetic`. Поле молча игнорируется.

**Баг 2** (route.ts:678–680):
```ts
const primaryAesthetic = body?.primary_aesthetic?.toString().trim() || "challenge";
const secondaryAesthetic = body?.secondary_aesthetic?.toString().trim() || "fantasy";
const tertiaryAesthetic = body?.tertiary_aesthetic?.toString().trim() || "discovery";
```
Когда body не содержит эти поля, используются hardcoded defaults `challenge/fantasy/discovery`. Route не пытается загрузить `project.concept.aestheticProfile` из БД.

**Эффект**: ВСЕ 10 test_projects имеют идентичный MDA-вывод (confirmed — см. Контекст).

**Решение**:

1. **Обновить `getOwnedProject` вызов** — включить `concept` relation в select (route.ts:711):
   ```ts
   // БЫЛО:
   // const owned = await getOwnedProject(user, projectId);
   // const proj = owned.project as { id: string; name: string };

   // СТАЛО: расширить type + получить concept
   const owned = await getOwnedProject(user, projectId);
   const proj = owned.project as {
     id: string;
     name: string;
     genre?: string | null;
     concept?: {
       genre: string | null;
       primaryAesthetic: string | null;
       secondaryAesthetic: string | null;
       tertiaryAesthetic: string | null;
       aestheticProfile: string | null; // JSON
       dynamicsProfile: string | null;
       mechanicSet: string | null;
       onePagerData: string | null;
     } | null;
     coreLoop?: {
       stepsData: string | null;
       structuralType: string | null;
     } | null;
   };
   ```

   Примечание: нужно проверить, что `getOwnedProject` (в `src/lib/api-helpers.ts`) уже включает concept — если нет, расширить его или использовать прямой `db.project.findUnique` с нужным select.

2. **Добавить fallback загрузку из concept**:
   ```ts
   // Если body не содержит primary_aesthetic, попробовать загрузить из concept
   let primaryAesthetic = body?.primary_aesthetic?.toString().trim() || "";
   let secondaryAesthetic = body?.secondary_aesthetic?.toString().trim() || "";
   let tertiaryAesthetic = body?.tertiary_aesthetic?.toString().trim() || "";

   // Поддержка legacy `target_aesthetics` массива
   if (!primaryAesthetic && Array.isArray(body?.target_aesthetics)) {
     const arr = body.target_aesthetics.map((a: unknown) => String(a).trim()).filter(Boolean);
     primaryAesthetic = arr[0] || "";
     secondaryAesthetic = arr[1] || "";
     tertiaryAesthetic = arr[2] || "";
   }

   // Fallback к concept.aestheticProfile
   if ((!primaryAesthetic || !secondaryAesthetic || !tertiaryAesthetic) && proj.concept) {
     try {
       const ap = proj.concept.aestheticProfile
         ? JSON.parse(proj.concept.aestheticProfile)
         : null;
       if (ap) {
         primaryAesthetic = primaryAesthetic || ap.primary || "";
         secondaryAesthetic = secondaryAesthetic || ap.secondary || "";
         tertiaryAesthetic = tertiaryAesthetic || ap.tertiary || "";
       }
     } catch { /* ignore parse error */ }

     // Альтернатива: отдельные поля
     primaryAesthetic = primaryAesthetic || proj.concept.primaryAesthetic || "";
     secondaryAesthetic = secondaryAesthetic || proj.concept.secondaryAesthetic || "";
     tertiaryAesthetic = tertiaryAesthetic || proj.concept.tertiaryAesthetic || "";
   }

   // Финальный fallback к defaults (только если ничего не найдено)
   primaryAesthetic = primaryAesthetic || "challenge";
   secondaryAesthetic = secondaryAesthetic || "fantasy";
   tertiaryAesthetic = tertiaryAesthetic || "discovery";
   ```

3. **Аналогично для `genre`**:
   ```ts
   let genre = body?.genre?.toString().trim() || "";
   if (!genre && proj.concept?.genre) {
     genre = proj.concept.genre;
   }
   if (!genre && proj.genre) {
     genre = proj.genre;
   }
   genre = genre || "rpg"; // final fallback
   ```

4. **Аналогично для `idea`** — загрузить из `concept.onePagerData`:
   ```ts
   let idea = (body?.idea as string | undefined)?.trim() || "";
   if (!idea && proj.concept?.onePagerData) {
     try {
       const op = JSON.parse(proj.concept.onePagerData);
       idea = op?.synopsis || op?.idea || op?.gameplay_description || "";
     } catch { /* ignore */ }
   }
   ```

5. **Аналогично для `existingMechanics`** — из `concept.mechanicSet`:
   ```ts
   if (existingMechanics.length === 0 && proj.concept?.mechanicSet) {
     try {
       const ms = JSON.parse(proj.concept.mechanicSet);
       // ms может иметь структуру { base: [...], combat: [...], ... } или { mechanics: [...] }
       const allMechs = ms.mechanics || [
         ...(ms.base || []), ...(ms.combat || []), ...(ms.progression || []),
         ...(ms.spatial || []), ...(ms.social || []),
       ].map((m: any) => typeof m === "string" ? m : m.mechanic_name || m.name);
       existingMechanics.push(...allMechs.filter(Boolean));
     } catch { /* ignore */ }
   }
   ```

6. **Обновить `scripts/run_pipeline_test.sh:106`** — передавать корректный shape:
   ```bash
   # БЫЛО:
   # -d "{\"project_id\":\"$PID\",\"target_aesthetics\":[\"challenge\",\"discovery\"],\"use_ai\":true}" \

   # СТАЛО: либо не передавать (route сам загрузит из concept)
   -d "{\"project_id\":\"$PID\",\"use_ai\":true}" \

   # Или явно из upstream:
   # -d "{\"project_id\":\"$PID\",\"primary_aesthetic\":\"$PRIMARY\",\"secondary_aesthetic\":\"$SECONDARY\",\"tertiary_aesthetic\":\"$TERTIARY\",\"genre\":\"$GENRE\",\"idea\":\"$IDEA\",\"use_ai\":true}" \
   ```
   Рекомендация: первый вариант (минимум полей) — route сам загрузит из concept.

**Тест-кейсы**:
- POST `/mda/analyze` с `{"project_id":"<existing>"}` (без aesthetics/genre/idea) → route загружает aesthetics из `project.concept.aestheticProfile`.
- POST `/mda/analyze` с `{"project_id":"<existing>","target_aesthetics":["sensation","narrative","challenge"]}` → route парсит массив и использует как primary/secondary/tertiary.
- POST `/mda/analyze` с явным `primary_aesthetic="fellowship"` → route использует его, игнорирует `concept.primaryAesthetic`.
- POST `/mda/analyze` для проекта без concept → route использует defaults (challenge/fantasy/discovery).
- После фикса: 10 test_projects имеют РАЗНЫЕ `aesthetic_profile` (зависят от project.concept).
- Pipeline runner (run_pipeline_test.sh:106) с минимальным body `{"project_id":"$PID","use_ai":true}` — route загружает всё из БД.

**Риски**:
- `getOwnedProject` может не включать `concept` relation по умолчанию. Проверить и при необходимости — расширить.
- Существующие проекты без `concept` (например, созданные напрямую через `db.project.create`) — fallback к defaults. Это OK.
- Performance: лишний DB query для каждого MDA call. Митигация: использовать `select` с конкретными полями.

**Dependencies**: TASK-1.6 (Block 1) — `GENRE_AESTHETICS` не должен содержать невалидные эстетики "competition"/"strategy", иначе concept.aestheticProfile будет содержать их, и route упадёт на VALIDATION_ERROR.

---

### TASK-3.7: Переписать `compatibility_score` формулу — убрать hardcoded `present: true`

**Сложность**: M
**Приоритет**: 🟡 (среднее — внутреннее противоречие: compatibility=94 при overall_match=0)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 293–321)

**Описание проблемы**:

Из 5 patterns 4 hardcoded `present: true` или легко true (см. RC-5). Минимум `50 + 32 = 82`, типично `94`. Score не отражает реальную совместимость.

Дополнительно: `synergy_score = 40 + patterns*10 + cov*3` — тоже over-inflated (типично 96).

**Эффект**: `mechanic_set.compatibility_score: 94` при `classic_mda_result.overall_match: 0` — внутреннее противоречие. UI показывает «хорошую» совместимость, но алгоритм MDA считает, что механики не порождают target aesthetics.

**Решение**:

1. **Реальная оценка patterns**:
   ```ts
   // Engine pattern: present если в mechanic set есть И source ресурсов, И consumer ресурсов
   // (не просто hardcoded true)
   const allMechs = [...base, ...combat, ...progression, ...spatial, ...social]
     .map((m) => m.mechanic_name);
   const hasEngineSource = allMechs.some((m) =>
     ["resource_gathering", "xp_leveling", "score_increase", "level_unlock"].includes(m)
   );
   const hasEngineConsumer = allMechs.some((m) =>
     ["health_damage", "ability_cooldowns", "ammo_management"].includes(m)
   );
   const enginePresent = hasEngineSource && hasEngineConsumer;

   // Converter chain: present если есть ≥2 механик, которые последовательно конвертируют ресурсы
   // (resource → crafting → equipment, например)
   const hasResourceProducer = allMechs.some((m) => ["resource_mining", "crafting_system", "resource_gathering"].includes(m));
   const hasResourceConsumer = allMechs.some((m) => ["weapon_unlocks", "equipment_upgrade", "ability_unlocks"].includes(m));
   const converterChainPresent = hasResourceProducer && hasResourceConsumer;

   // Dynamic coupling (Björk): present если ≥2 core_dynamics имеют общие механики
   // (механика обслуживает >1 динамику)
   const dynamicsMechanicsMap: Record<string, string[]> = {};
   for (const dyn of dynamicsTarget.core_dynamics) {
     dynamicsMechanicsMap[dyn] = DYNAMICS_TO_MECHANICS[dyn] || [];
   }
   const sharedMechanics = Object.values(dynamicsMechanicsMap)
     .flat()
     .filter((m, i, arr) => arr.indexOf(m) !== i); // дубликаты = общие механики
   const dynamicCouplingPresent = sharedMechanics.length > 0;

   // Feedback loop (reinforcing): present если есть progression + reward
   const hasProgression = progression.length > 0;
   const hasReward = allMechs.some((m) => ["loot_system", "achievement_system", "score_increase"].includes(m));
   const reinforcingLoopPresent = hasProgression && hasReward;

   // Feedback loop (balancing): present если есть combat + cost
   const hasCombat = combat.length > 0;
   const hasCost = allMechs.some((m) => ["energy_drain", "ammo_consumption", "health_damage"].includes(m));
   const balancingLoopPresent = hasCombat && hasCost;

   const patterns = [
     { name: "Engine pattern", pattern_type: "adams", present: enginePresent,
       suggestion: enginePresent ? "" : "Добавить source+consumer ресурсов для engine pattern" },
     { name: "Converter chain", pattern_type: "dormans", present: converterChainPresent,
       suggestion: converterChainPresent ? "" : "Добавить crafting/upgrade chain" },
     { name: "Dynamic coupling (Björk)", pattern_type: "bjork", present: dynamicCouplingPresent,
       suggestion: dynamicCouplingPresent ? "" : "Добавить механику, обслуживающую >1 динамику" },
     { name: "Feedback loop (reinforcing)", pattern_type: "dormans", present: reinforcingLoopPresent,
       suggestion: reinforcingLoopPresent ? "" : "Связать progression с reward системой" },
     { name: "Feedback loop (balancing)", pattern_type: "dormans", present: balancingLoopPresent,
       suggestion: balancingLoopPresent ? "" : "Добавить cost для combat (energy/ammo)" },
   ];
   ```

2. **Переписать `compatibility_score` формулу** с учётом реальной aesthetic coverage:
   ```ts
   const patternsPresent = patterns.filter((p) => p.present).length;
   const aestheticsSufficient = aestheticCoverage.filter((a) => a.sufficient).length;
   const aestheticsTotal = aestheticCoverage.length;

   // База 30 + patterns (max 5 × 8 = 40) + aesthetic coverage ratio (max 30)
   const compatibilityScore = Math.min(
     100,
     Math.round(
       30 +
       patternsPresent * 8 +
       (aestheticsSufficient / aestheticsTotal) * 30
     )
   );

   // Synergy = насколько механики поддерживают друг друга (shared resources, coupling)
   const synergyScore = Math.min(
     100,
     Math.round(
       20 +
       patternsPresent * 10 +
       (sharedMechanics.length / Math.max(1, allMechs.length)) * 50 + // coupling ratio
       (aestheticsSufficient / aestheticsTotal) * 20
     )
   );
   ```

3. **Логировать несоответствие** — если `compatibility_score > 70` но `overall_match < 0.3`, добавить warning:
   ```ts
   const warnings: string[] = [];
   if (compatibilityScore > 70 && /* overall_match доступен позже */) {
     // отложенная проверка, после buildClassicMDA
   }
   // В route handler после buildClassicMDA:
   if (classicMdaResult && mechanicSet.compatibility_score > 70 && classicMdaResult.overall_match < 0.3) {
     mechanicSet.warnings.push(
       `compatibility_score=${mechanicSet.compatibility_score} но overall_match=${classicMdaResult.overall_match.toFixed(2)} — механики согласованы структурно, но не порождают target aesthetics. Рассмотреть Reverse MDA: добавить механики из dynamics_target.`
     );
   }
   ```

**Тест-кейсы**:
- Для RPG с полным mechanic set (5 групп × 2 механики): `compatibility_score >= 60` (3+ patterns present, 4+ aesthetics sufficient).
- Для проекта с пустым combat group: `compatibility_score < 50` (Engine pattern=false, balancing loop=false).
- Для проекта со всеми 5 patterns present и 8/8 aesthetics sufficient: `compatibility_score = 30 + 40 + 30 = 100`.
- Warning о несоответствии появляется когда `compatibility > 70 && overall_match < 0.3`.

**Риски**:
- После фикса `compatibility_score` снизится с 94 до ~50-70 (реалистичный range). Frontend `BondMatrixPanel.tsx` и `ReverseMDAPanel.tsx` могут отображать score как цветной прогресс-бар — проверить, что 60-70 не интерпретируется как «плохо» (нужно настроить пороги в UI).
- Список «resource producer/consumer» механик — hardcoded, может быть не полным. Использовать canonical IDs из TASK-3.1 + ручной review.

**Dependencies**: TASK-3.1 (canonical IDs), TASK-3.2 (aesthetic coverage fix).

---

### TASK-3.8: Реализовать Bond 4×3 matrix с реальным содержимым + вычислить ludonarrative

**Сложность**: L
**Приоритет**: 🟡 (соответствие Bible 3.7)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 563–660, функция `buildBondValidation`)

**Описание проблемы**:

**Баг 1** (RC-6): Bond matrix ячейки содержат **canned strings** (route.ts:572–593), одинаковые для всех проектов:
```ts
"Механика": {
  "Фиксированный": "Базовые механики: движение, атака, способность",
  "Динамический": "Комбо-системы, эмерджентные взаимодействия",
  "Культурный": "Мета-стратегии, обсуждаемые сообществом",
},
// ...
```
Bible 3.7.3 явно требует: «Для каждой из 12 ячеек дизайнер (или AI) задаёт вопрос: "Что находится в этой ячейке?"» — ячейки должны быть **конкретными для проекта**.

**Баг 2** (RC-6): `ludonarrative.result = "Гармония"` — hardcoded, не вычисляется.

**Баг 3**: `mechanic_narrative_pairs` (route.ts:623–639) — canned пары `combat ↔ main_conflict`, `progression ↔ character_growth`, `exploration ↔ world_discovery`. Не связаны с actual mechanic_set.

**Решение**:

1. **Передать в `buildBondValidation` больше контекста**:
   ```ts
   function buildBondValidation(
     mechanicSet: MechanicSet,
     dynamicsTarget: DynamicsTarget,
     aesthetics: { primary: string; secondary: string; tertiary: string },
     classicMdaResult: { overall_match: number; predicted_aesthetics: Record<string, number> } | null,
     concept?: { genre?: string; onePagerData?: string } | null
   ) {
     // ...
   }
   ```

2. **Заполнить matrix реальным контентом** из mechanic set + aesthetic profile:
   ```ts
   const allMechs = [
     ...mechanicSet.base, ...mechanicSet.combat, ...mechanicSet.progression,
     ...mechanicSet.spatial, ...mechanicSet.social,
   ].map((m) => m.mechanic_name);

   // Helper: топ-3 механики по группе
   const topMechs = (group: string[], n: number = 3) => group.slice(0, n).map((m) => m.mechanic_name).join(", ");

   const contents: Record<string, Record<string, string>> = {
     "Механика": {
       "Фиксированный": `Базовые механики: ${topMechs(mechanicSet.base, 2)}. Боевые: ${topMechs(mechanicSet.combat, 2)}. Прогрессия: ${topMechs(mechanicSet.progression, 2)}.`,
       "Динамический": `Эмерджентные взаимодействия: ${detectEmergentInteractions(mechanicSet).join(", ") || "требуется playtesting"}`,
       "Культурный": `Потенциальные мета-стратегии: ${inferMetaStrategies(mechanicSet, aesthetics.primary).join(", ") || "не определены на данном этапе"}`,
     },
     "История": {
       "Фиксированный": `Жанр: ${concept?.genre || "не указан"}. Целевая эстетика: ${aesthetics.primary}.`,
       "Динамический": `Эмерджентные истории игрока: ${inferEmergentStories(aesthetics.primary)}`,
       "Культурный": `Фан-теории возможны при наличии лора (см. spatial механики: ${topMechs(mechanicSet.spatial, 2)})`,
     },
     "Эстетика": {
       "Фиксированный": `Целевые эстетики: ${aesthetics.primary} (primary), ${aesthetics.secondary} (secondary), ${aesthetics.tertiary} (tertiary)`,
       "Динамический": `Эмоциональные пики возникают в моменты: ${inferEmotionalPeaks(mechanicSet, aesthetics.primary)}`,
       "Культурный": `Фан-арт/косплей вероятны при наличии ярких персонажей или визуальной идентичности`,
     },
     "Технология": {
       "Фиксированный": `Движок и платформа: не определены на этапе MDA (см. Block 6 GDD)`,
       "Динамический": `Процедурная генерация: ${allMechs.includes("procedural_generation") ? "да" : "нет"}. Физика: ${allMechs.includes("projectile_physics") ? "да" : "базовая"}`,
       "Культурный": `Мод-поддержка: ${allMechs.some((m) => ["level_editor", "crafting_system"].includes(m)) ? "потенциальная (есть editor/crafting)" : "не заложена"}`,
     },
   };
   ```

3. **Реализовать helper'ы**:
   ```ts
   function detectEmergentInteractions(mechanicSet: MechanicSet): string[] {
     const interactions: string[] = [];
     const allMechs = [...mechanicSet.base, ...mechanicSet.combat, ...mechanicSet.progression, ...mechanicSet.spatial, ...mechanicSet.social].map((m) => m.mechanic_name);
     // Combat + Progression → "combat → reward → upgrade loop"
     if (mechanicSet.combat.length > 0 && mechanicSet.progression.length > 0) {
       interactions.push("combat→reward→upgrade loop");
     }
     // Spatial + Discovery → "exploration → secret → reward"
     if (mechanicSet.spatial.length > 0 && allMechs.includes("secret_finding")) {
       interactions.push("exploration→secret→reward");
     }
     // Social + Combat → "coop tactics"
     if (mechanicSet.social.length > 0 && mechanicSet.combat.length > 0) {
       interactions.push("coop tactical combos");
     }
     return interactions;
   }

   function inferMetaStrategies(mechanicSet: MechanicSet, primaryAesthetic: string): string[] {
     const allMechs = [...mechanicSet.base, ...mechanicSet.combat, ...mechanicSet.progression, ...mechanicSet.spatial, ...mechanicSet.social].map((m) => m.mechanic_name);
     const strategies: string[] = [];
     if (allMechs.includes("ability_cooldowns") && allMechs.includes("perfect_timing")) {
       strategies.push("cooldown-optimization builds");
     }
     if (allMechs.includes("skill_trees") && allMechs.includes("character_customization")) {
       strategies.push("min-max builds");
     }
     if (allMechs.includes("leaderboards")) {
       strategies.push("speedrun/ranking meta");
     }
     return strategies;
   }

   function inferEmergentStories(primaryAesthetic: string): string {
     switch (primaryAesthetic) {
       case "narrative": return "множественные концовки, выбор с последствиями";
       case "fantasy": return "идентификация с ролью, player-authored character arcs";
       case "challenge": return "clutch moments, comeback stories";
       case "discovery": return "exploration anecdotes, hidden area discoveries";
       case "fellowship": return "shared victory/defeat narratives";
       default: return "situational stories из взаимодействия механик";
     }
   }

   function inferEmotionalPeaks(mechanicSet: MechanicSet, primaryAesthetic: string): string {
     // На основе наличия определённых механик
     const allMechs = [...mechanicSet.base, ...mechanicSet.combat, ...mechanicSet.progression, ...mechanicSet.spatial, ...mechanicSet.social].map((m) => m.mechanic_name);
     const peaks: string[] = [];
     if (allMechs.includes("boss_encounter") || allMechs.includes("raid_encounters")) {
       peaks.push("босс-файты (кульминация)");
     }
     if (allMechs.includes("perfect_timing") || allMechs.includes("combo_system")) {
       peaks.push("execution perfection moments");
     }
     if (allMechs.includes("cutscene_triggers") || allMechs.includes("quest_log")) {
       peaks.push("нарративные повороты");
     }
     return peaks.length > 0 ? peaks.join(", ") : "общие пики через core loop";
   }
   ```

4. **Вычислить ludonarrative** на основе `classicMdaResult`:
   ```ts
   // Bible 3.7.3: ludonarrative harmony = механика и нарратив усиливают друг друга
   // Диссонанс = механика и нарратив противоречат
   // Ирония = механика и нарратив осознанно контрастируют (для комедии/сатиры)

   function computeLudonarrative(
     mechanicSet: MechanicSet,
     aesthetics: { primary: string },
     classicMda: { overall_match: number; predicted_aesthetics: Record<string, number> } | null
   ): {
     result: "Гармония" | "Ирония" | "Диссонанс";
     description: string;
     mechanic_narrative_pairs: Array<{ mechanic: string; narrative: string; consistency: number }>;
     correction: string;
   } {
     const predicted = classicMda?.predicted_aesthetics || {};
     const primaryPredicted = predicted[aesthetics.primary] || 0;

     // Гармония: primary эстетика предсказана с высокой вероятностью
     // Диссонанс: primary эстетика предсказана с низкой вероятностью (< 0.3)
     // Ирония: предсказана другая эстетика сильнее primary
     const sortedAesthetics = Object.entries(predicted).sort((a, b) => b[1] - a[1]);
     const topPredicted = sortedAesthetics[0]?.[0];
     const topPredictedScore = sortedAesthetics[0]?.[1] || 0;

     let result: "Гармония" | "Ирония" | "Диссонанс";
     let description: string;
     let correction: string;

     if (primaryPredicted >= 0.6) {
       result = "Гармония";
       description = `Механики и нарратив согласованно выражают эстетику "${aesthetics.primary}" (predicted: ${primaryPredicted.toFixed(2)}).`;
       correction = "Поддерживать текущий direction; усилить слабые эстетики через secondary mechanics";
     } else if (topPredicted && topPredicted !== aesthetics.primary && topPredictedScore > primaryPredicted + 0.2) {
       result = "Ирония";
       description = `Механики предсказуемо порождают "${topPredicted}" (predicted: ${topPredictedScore.toFixed(2)}) вместо целевой "${aesthetics.primary}". Возможна осознанная ирония.`;
       correction = `Если ирония намеренная — усилить контраст. Если нет — добавить механики для "${aesthetics.primary}"`;
     } else {
       result = "Диссонанс";
       description = `Механики не порождают целевую эстетику "${aesthetics.primary}" (predicted: ${primaryPredicted.toFixed(2)}). Лудонарративный диссонанс.`;
       correction = `Пересмотреть mechanic set: добавить механики из dynamics_target для "${aesthetics.primary}"`;
     }

     // Реальные pairs на основе actual mechanic_set
     const allMechs = [
       ...mechanicSet.base, ...mechanicSet.combat, ...mechanicSet.progression,
       ...mechanicSet.spatial, ...mechanicSet.social,
     ].map((m) => m.mechanic_name);

     const pairs: Array<{ mechanic: string; narrative: string; consistency: number }> = [];

     // Combat ↔ main_conflict
     if (mechanicSet.combat.length > 0) {
       const combatMech = mechanicSet.combat[0].mechanic_name;
       const consistency = aesthetics.primary === "challenge" ? 0.9 :
                           aesthetics.primary === "narrative" ? 0.7 : 0.5;
       pairs.push({ mechanic: combatMech, narrative: "main_conflict", consistency });
     }

     // Progression ↔ character_growth
     if (mechanicSet.progression.length > 0) {
       const progMech = mechanicSet.progression[0].mechanic_name;
       const consistency = ["fantasy", "challenge", "submission"].includes(aesthetics.primary) ? 0.85 : 0.6;
       pairs.push({ mechanic: progMech, narrative: "character_growth", consistency });
     }

     // Spatial ↔ world_discovery
     if (mechanicSet.spatial.length > 0) {
       const spatialMech = mechanicSet.spatial[0].mechanic_name;
       const consistency = ["discovery", "fantasy"].includes(aesthetics.primary) ? 0.85 : 0.6;
       pairs.push({ mechanic: spatialMech, narrative: "world_discovery", consistency });
     }

     // Social ↔ social_bonding
     if (mechanicSet.social.length > 0) {
       const socialMech = mechanicSet.social[0].mechanic_name;
       const consistency = aesthetics.primary === "fellowship" ? 0.9 : 0.5;
       pairs.push({ mechanic: socialMech, narrative: "social_bonding", consistency });
     }

     return { result, description, mechanic_narrative_pairs: pairs, correction };
   }
   ```

5. **Вычислить `row_consistency` и `col_consistency`** на основе реального content (не просто `compatibility_score`):
   ```ts
   // Row consistency (per level): насколько 4 элемента согласованы на одном уровне
   // Проверяем: есть ли явные противоречия между Механикой/Историей/Эстетикой/Технологией
   const rowConsistency = levels.map((level) => {
     const dissonances: Array<{ element: string; issue: string }> = [];

     // На Фиксированном уровне: check что aesthetic primary и narrative genre согласованы
     if (level === "Фиксированный") {
       // Если primary=challenge, но mechanicSet.combat пусто → диссонанс
       if (aesthetics.primary === "challenge" && mechanicSet.combat.length === 0) {
         dissonances.push({ element: "Механика", issue: "primary=challenge, но combat mechanics отсутствуют" });
       }
       if (aesthetics.primary === "discovery" && mechanicSet.spatial.length === 0) {
         dissonances.push({ element: "Механика", issue: "primary=discovery, но spatial mechanics отсутствуют" });
       }
     }

     const baseScore = dissonances.length === 0 ? 0.85 : 0.5 - dissonances.length * 0.1;
     return {
       level,
       score: Number(Math.max(0, Math.min(1, baseScore + (mechanicSet.compatibility_score / 100) * 0.1)).toFixed(3)),
       dissonances,
     };
   });

   // Col consistency (per element): насколько 3 уровня согласованы для одного элемента
   const colConsistency = elements.map((element) => {
     // Например, для Механики: Фиксированный → конкретные механики, Динамический → interactions, Культурный → meta
     // Если на Фиксированном 0 механик, а на Динамическом есть interactions — диссонанс (откуда interactions?)
     let score = 0.65 + (mechanicSet.compatibility_score / 100) * 0.2;
     if (element === "Механика" && (mechanicSet.base.length + mechanicSet.combat.length + mechanicSet.progression.length + mechanicSet.spatial.length + mechanicSet.social.length) < 5) {
       score -= 0.15;
     }
     return {
       element,
       score: Number(Math.max(0, Math.min(1, score)).toFixed(3)),
       description: `${element} ${score > 0.7 ? "согласованно" : "требует доработки"} на всех трёх уровнях`,
     };
   });
   ```

**Тест-кейсы**:
- Для RPG, primary=challenge: `bond_validation.matrix[0..11].content` содержит конкретные mechanical имена (например, `"Базовые механики: inventory_management, dialogue_trees. Боевые: turn_based_combat, ability_cooldowns..."`), а не canned strings.
- Для проекта с primary=challenge и пустым combat group: `ludonarrative.result = "Диссонанс"`.
- Для проекта с `overall_match = 0.85`: `ludonarrative.result = "Гармония"`.
- `ludonarrative.mechanic_narrative_pairs` содержит реальные mechanic_id из mechanicSet, не canned `"combat"`, `"progression"`, `"exploration"`.
- `bond_validation.row_consistency[0].dissonances` непустой для проекта с primary=challenge и пустым combat.

**Риски**:
- Размер `matrix[].content` может быть большим (если много механик). Cap на 200 символов.
- Helper'ы `inferMetaStrategies`, `inferEmotionalPeaks` — hardcoded эвристики, могут не покрывать все случаи. Documentировать как «первое приближение, расширять по мере тестирования».
- `ludonarrative.result = "Ирония"` — новая категория, может смутить пользователей. UI должен объяснять.

**Dependencies**: TASK-3.1, TASK-3.2, TASK-3.3 (`classicMdaResult.overall_match` нужен для ludonarrative).

---

### TASK-3.9: Реальный `observed_dynamics` из mechanic set

**Сложность**: M
**Приоритет**: 🟡 (semantic correctness — Bible 3.5.2 Шаг 2 «определить эстетику, порождаемую данной динамикой»)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строка 382)

**Описание проблемы**:

```ts
// route.ts:382
const observedDynamics = dynamicsTarget.core_dynamics.slice(0, 3);
```

`observed_dynamics` — это просто **копия** первых 3 core_dynamics из input. Bible 3.5.2 требует: «Моделировать динамику (Machinations / агентная симуляция)» — dynamics должны быть **наблюдены** из mechanic set, не скопированы из входных данных.

**Эффект**: `observed_dynamics` всегда совпадает с `dynamics_target.core_dynamics` — поле бесполезно. AI и downstream блоки не могут отличить «ожидаемые» dynamics от «наблюдаемых».

**Решение**:

1. **Реализовать `computeObservedDynamics`**:
   ```ts
   /**
    * Наблюдаемые динамики: для каждой динамики проверяем, ≥1 ли её механик
    * присутствуют в mechanic set. Если да — динамика "наблюдается".
    * Bible 3.5.2: dynamics arise from mechanics, not from designer's intent.
    */
   function computeObservedDynamics(mechanicSet: MechanicSet): string[] {
     const allMechs = [
       ...mechanicSet.base, ...mechanicSet.combat, ...mechanicSet.progression,
       ...mechanicSet.spatial, ...mechanicSet.social,
     ].map((m) => m.mechanic_name);

     const observed: string[] = [];
     for (const [dyn, mechs] of Object.entries(DYNAMICS_TO_MECHANICS)) {
       const hasMechanic = mechs.some((m) => allMechs.includes(m));
       if (hasMechanic) {
         observed.push(dyn);
       }
     }
     return observed;
   }
   ```

2. **Различать `target_dynamics` (intent) vs `observed_dynamics` (actual)**:
   ```ts
   // В buildClassicMDA:
   const targetDynamics = [...dynamicsTarget.core_dynamics, ...dynamicsTarget.supporting_dynamics];
   const observedDynamics = computeObservedDynamics(mechanicSet);

   // dynamics, которые целевые, но не наблюдаются — gap
   const missingDynamics = targetDynamics.filter((d) => !observedDynamics.includes(d));
   // dynamics, которые наблюдаются, но не были целевыми — emergent
   const emergentDynamics = observedDynamics.filter((d) => !targetDynamics.includes(d));

   // В return:
   return {
     // ... existing
     observed_dynamics: observedDynamics,
     target_dynamics_coverage: {
       target: targetDynamics,
       observed: observedDynamics,
       missing: missingDynamics,
       emergent: emergentDynamics,
       coverage_ratio: targetDynamics.length > 0
         ? Number((observedDynamics.filter((d) => targetDynamics.includes(d)).length / targetDynamics.length).toFixed(2))
         : 0,
     },
     // ...
   };
   ```

3. **Добавить warnings** про missing dynamics:
   ```ts
   const warnings: string[] = [];
   if (missingDynamics.length > 0) {
     warnings.push(
       `Missing dynamics: ${missingDynamics.join(", ")} — добавить механики из DYNAMICS_TO_MECHANICS для покрытия`
     );
   }
   if (emergentDynamics.length > 0) {
     warnings.push(
       `Emergent dynamics (не были целевыми): ${emergentDynamics.join(", ")} — проверить, ожидаемые ли это паттерны`
     );
   }
   ```

**Тест-кейсы**:
- Для RPG, target=[skill_scaling, difficulty_curves, mastery_growth, role_immersion, ...]: `observed_dynamics` содержит только те, чьи механики есть в set. Например, `["character_growth", "story_progression", "combat_pacing"]` (если xp_leveling, dialogue_trees, ability_cooldowns присутствуют).
- `target_dynamics_coverage.missing` содержит dynamics без механик.
- `target_dynamics_coverage.coverage_ratio < 1` для типичного проекта.
- `target_dynamics_coverage.emergent` может содержать dynamics от genre defaults, которые не были в target.

**Риски**:
- `observed_dynamics` может быть короче, чем `target_dynamics` — это expected (и highlighting gap — это ценно).
- Frontend (`ClassicMDAPanel.tsx`) может ожидать `observed_dynamics.length >= 3`. Проверить и обновить UI для отображения coverage ratio.

**Dependencies**: TASK-3.1, TASK-3.4 (mechanic set из dynamics_target гарантирует, что `observed_dynamics` будет содержать большинство target).

---

### TASK-3.10: Реальный `gameplay_sequence` из mechanic set

**Сложность**: M
**Приоритет**: 🟡 (Bible 3.5.2 Шаг 1 «смоделировать динамику» + 3.10.3 «Геймплей → Опыт»)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 357–380, функция `buildClassicMDA`)

**Описание проблемы**:

```ts
// route.ts:361–380
const gameplaySequence = [
  { action: `Engage ${baseMech}`, mechanics_used: [baseMech], resources_consumed: [], resources_produced: ["signal"] },
  { action: `Execute ${combatMech}`, mechanics_used: [combatMech], resources_consumed: ["energy"], resources_produced: [] },
  { action: `Use ${progMech}`, mechanics_used: [progMech], resources_consumed: [], resources_produced: ["xp", "gold"] },
];
```

Hardcoded 3-step template: `Engage baseMech → Execute combatMech → Use progMech`. Не зависит от жанра, количества механик, aesthetic profile.

Bible 3.10.3 явно описывает геймплей как «изучи паттерн врага → найди окно для атаки → уклонись от ответного удара» — то есть последовательность должна отражать **конкретный** gameplay.

**Решение**:

1. **Передать в `buildClassicMDA` весь mechanic set**:
   ```ts
   function buildClassicMDA(
     mechanicSet: MechanicSet,
     dynamicsTarget: DynamicsTarget,
     aesthetics: { primary: string; secondary: string; tertiary: string },
     convergenceThreshold: number,
     genre: string, // NEW
     idea: string   // NEW
   ) {
     // ...
   }
   ```

2. **Шаблоны gameplay_sequence по жанру**:
   ```ts
   const GAMEPLAY_TEMPLATES: Record<string, (mechanicSet: MechanicSet) => GameplayStep[]> = {
     rpg: (ms) => [
       { action: `Explore the world using ${ms.base[0]?.mechanic_name || "explore"}`,
         mechanics_used: [ms.base[0]?.mechanic_name || "explore"],
         resources_consumed: [], resources_produced: ["location_intel"] },
       { action: `Engage in ${ms.combat[0]?.mechanic_name || "combat"} encounter`,
         mechanics_used: [ms.combat[0]?.mechanic_name || "combat"],
         resources_consumed: ["hp", "mp"], resources_produced: [] },
       { action: `Apply ${ms.progression[0]?.mechanic_name || "progression"} after victory`,
         mechanics_used: [ms.progression[0]?.mechanic_name || "progression"],
         resources_consumed: [], resources_produced: ["xp", "gold", "loot"] },
       { action: `Return to town, use ${ms.social[0]?.mechanic_name || "merchant"} to upgrade`,
         mechanics_used: [ms.social[0]?.mechanic_name || "merchant"],
         resources_consumed: ["gold"], resources_produced: ["upgraded_gear"] },
     ],
     shooter: (ms) => [
       { action: `Move through level using ${ms.spatial[0]?.mechanic_name || "movement"}`,
         mechanics_used: [ms.spatial[0]?.mechanic_name || "movement"],
         resources_consumed: [], resources_produced: ["positioning"] },
       { action: `Engage enemy with ${ms.combat[0]?.mechanic_name || "weapon"}`,
         mechanics_used: [ms.combat[0]?.mechanic_name || "weapon"],
         resources_consumed: ["ammo"], resources_produced: [] },
       { action: `Loot drops, use ${ms.progression[0]?.mechanic_name || "perk"} to advance`,
         mechanics_used: [ms.progression[0]?.mechanic_name || "perk"],
         resources_consumed: [], resources_produced: ["xp", "ammo_refill"] },
     ],
     puzzle: (ms) => [
       { action: `Observe puzzle, identify ${ms.base[0]?.mechanic_name || "rule"}`,
         mechanics_used: [ms.base[0]?.mechanic_name || "rule"],
         resources_consumed: [], resources_produced: ["insight"] },
       { action: `Manipulate ${ms.spatial[0]?.mechanic_name || "pieces"} to test hypothesis`,
         mechanics_used: [ms.spatial[0]?.mechanic_name || "pieces"],
         resources_consumed: ["moves"], resources_produced: [] },
       { action: `${ms.progression[0]?.mechanic_name || "progress"} on success, retry on failure`,
         mechanics_used: [ms.progression[0]?.mechanic_name || "progress"],
         resources_consumed: [], resources_produced: ["solved", "stars"] },
     ],
     // ... добавить для strategy, racing, fighting, platformer, simulation, adventure, tower_defense, horror, roguelike, sandbox, metroidvania, rhythm
     default: (ms) => [
       { action: `Engage ${ms.base[0]?.mechanic_name || "explore"}`,
         mechanics_used: [ms.base[0]?.mechanic_name || "explore"],
         resources_consumed: [], resources_produced: ["signal"] },
       { action: `Execute ${ms.combat[0]?.mechanic_name || "combat"}`,
         mechanics_used: [ms.combat[0]?.mechanic_name || "combat"],
         resources_consumed: ["energy"], resources_produced: [] },
       { action: `Use ${ms.progression[0]?.mechanic_name || "progress"}`,
         mechanics_used: [ms.progression[0]?.mechanic_name || "progress"],
         resources_consumed: [], resources_produced: ["xp", "gold"] },
     ],
   };

   const gameplaySequence = (GAMEPLAY_TEMPLATES[genre] || GAMEPLAY_TEMPLATES.default)(mechanicSet);
   ```

3. **Расширить `gameplay_script`** — генерировать из gameplay_sequence + idea:
   ```ts
   const gameplayScript = `Player (${idea.slice(0, 60) || "main character"}) ` +
     gameplaySequence.map((s, i) => {
       const verb = i === 0 ? "starts by" : i === gameplaySequence.length - 1 ? "finally" : "then";
       return `${verb} ${s.action.toLowerCase()}`;
     }).join(", ") + ". " +
     `This produces a ${dynamicsTarget.emergence_level} emergence pattern with ` +
     `${observedDynamics.length} observable dynamics. ` +
     `Target aesthetic "${aesthetics.primary}" is ${classicMdaResult?.converged ? "" : "not "}achieved.`;
   ```

**Тест-кейсы**:
- Для RPG: `gameplay_sequence` содержит 4 шага с реальными mechanic_id из mechanic_set.
- Для puzzle: первый шаг `Observe puzzle, identify <rule>`, не `Engage <baseMech>`.
- `gameplay_script` начинается с `Player (main character) starts by ...` (или с `idea` если задан).
- `gameplay_sequence[0].mechanics_used[0] === mechanicSet.base[0].mechanic_name`.

**Риски**:
- 12 шаблонов — много кода. Вынести в отдельный модуль `src/lib/mda/gameplay-templates.ts`.
- Если `mechanicSet.combat[0]` undefined (пустая группа) — fallback на `"combat"` строку. Нужно убедиться, что это не сломает downstream типы.

**Dependencies**: TASK-3.1 (canonical IDs), TASK-3.4 (mechanic set populated properly).

---

### TASK-3.11: Добавить `moderate` в `EMERGENCE_BADGES` (или переименовать `multiple` → `moderate`)

**Сложность**: S
**Приоритет**: 🟡 (UI consistency)
**Файлы**: `src/constants/mda.ts` (строки 36–41), `src/app/api/v1/mda/analyze/route.ts` (строки 144–148), `src/components/gidede/mda/ReverseMDAPanel.tsx` (использование)

**Описание проблемы**:

```ts
// constants/mda.ts:36–41
export const EMERGENCE_BADGES: Record<string, { label: string; color: string }> = {
  nominal: { label: "Номинальная", color: "..." },
  weak: { label: "Слабая", color: "..." },
  multiple: { label: "Множественная", color: "..." },  // ← не используется в route
  strong: { label: "Сильная", color: "..." },
};

// route.ts:144–148
let emergenceLevel = "moderate";  // ← default
if (totalDynamics >= 7) emergenceLevel = "strong";
else if (totalDynamics >= 5) emergenceLevel = "moderate";  // ← использует moderate
else if (totalDynamics >= 3) emergenceLevel = "weak";
else emergenceLevel = "nominal";
```

`EMERGENCE_BADGES["moderate"]` — undefined. UI fallback на `nominal` badge — некорректно (показывает «Номинальная» для moderate emergence).

**Решение**:

Вариант A — добавить `moderate` (рекомендуется, обратно-совместимо):
```ts
export const EMERGENCE_BADGES: Record<string, { label: string; color: string }> = {
  nominal: { label: "Номинальная", color: "bg-gray-100 text-gray-800 dark:bg-gray-950/40 dark:text-gray-300" },
  weak: { label: "Слабая", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300" },
  moderate: { label: "Умеренная", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
  multiple: { label: "Множественная", color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  strong: { label: "Сильная", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" },
};
```

Вариант B — переименовать `multiple` → `moderate` (меньше вариантов, но breaking change):
```ts
export const EMERGENCE_BADGES: Record<string, { label: string; color: string }> = {
  nominal: { ... },
  weak: { ... },
  moderate: { label: "Умеренная", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300" },
  strong: { label: "Сильная", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" },
};
// + grep по всем использованиям EMERGENCE_BADGES.multiple, заменить на moderate
```

Рекомендация: **вариант A** — сохраняет backward compat, добавляет moderate явно.

Дополнительно: убрать hardcoded `"moderate"` default в route.ts:144 — лучше `nominal`:
```ts
// БЫЛО: let emergenceLevel = "moderate";
// СТАЛО: let emergenceLevel = "nominal";
```

**Тест-кейсы**:
- `EMERGENCE_BADGES["moderate"]` определён.
- `EMERGENCE_BADGES["moderate"].label === "Умеренная"`.
- UI `ReverseMDAPanel.tsx` для проекта с `emergence_level = "moderate"` показывает badge «Умеренная» (blue), не «Номинальная» (gray).
- `EMERGENCE_BADGES["multiple"]` все ещё определён (для backward compat).

**Риски**:
- Если используется `multiple` где-то в коде — проверить `rg "EMERGENCE_BADGES.multiple"`.
- Frontend может кэшировать labels. Browser refresh после деплоя.

**Dependencies**: нет.

---

### TASK-3.12: Persist `ai_insights` в БД + убрать `void safeJsonParse`

**Сложность**: S
**Приоритет**: 🟡 (consistency с Block 2)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 793–870)

**Описание проблемы**:

```ts
// route.ts:811–850 — db.upsert сохраняет результат БЕЗ ai_insights
await db.projectMDAProfile.upsert({
  where: { projectId: proj.id },
  create: { /* ... */ fullProfile },
  update: { /* ... */ fullProfile },
});

// route.ts:855
void safeJsonParse;  // dead code

// route.ts:857–868 — enrichMda вызывается ПОСЛЕ upsert
if (useAi) {
  const aiInsights = await enrichMda({ ... });
  if (aiInsights) {
    result.ai_insights = aiInsights;
    (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
```

`ai_insights` попадает в HTTP response, но **не сохраняется** в БД. После перезагрузки проекта данные теряются. Block 2 (Core Loop) уже решил эту проблему — перенёс enrich ДО upsert.

**Решение**:

1. **Перенести `enrichMda` вызов ДО `db.upsert`**:
   ```ts
   // --- Stage 7: Bond matrix ---
   // ... (existing)

   const latencyMs = Date.now() - startedAt;
   const stagesCompleted = fullAnalysis ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
   const iterationsDone = classicMdaResult?.iterations || 0;

   // --- Optional AI enrichment (ДО persist) ---
   let aiInsights: string | null = null;
   if (useAi) {
     aiInsights = await enrichMda({
       projectName: proj.name || "Untitled",
       genre,
       aesthetics: [primaryAesthetic, secondaryAesthetic, tertiaryAesthetic],
       // TASK-3.14: расширить prompt с mechanicSet, dynamicsTarget, lensValidation
       mechanicSet: JSON.stringify(mechanicSet),
       dynamicsTarget: JSON.stringify(dynamicsTarget),
       lensValidation: lensValidation ? JSON.stringify(lensValidation) : null,
       bondValidation: bondValidation ? JSON.stringify(bondValidation) : null,
     });
   }

   const result: Record<string, unknown> = {
     aesthetic_profile: aestheticProfile,
     dynamics_target: dynamicsTarget,
     mechanic_candidate_set: mechanicCandidateSet,
     mechanic_set: mechanicSet,
     classic_mda_result: classicMdaResult,
     lens_validation: lensValidation,
     bond_validation: bondValidation,
     genre,
     concept_id: conceptId,
     iterations_done: iterationsDone,
     stages_completed: stagesCompleted,
     latency_ms: latencyMs,
     models_used: fullAnalysis
       ? ["deterministic-mda-v1", "leblanc-aesthetics", "adams-dormans-patterns", "shell-lenses-lite", "bond-matrix-v1"]
       : ["deterministic-mda-v1", "leblanc-aesthetics"],
   };
   if (aiInsights) {
     result.ai_insights = aiInsights;
     (result.models_used as string[]).push("glm-4.6 (ai-enrichment)");
   }

   // --- Persist (с ai_insights в fullProfile) ---
   const fullProfile = JSON.stringify(result);

   await db.projectMDAProfile.upsert({
     where: { projectId: proj.id },
     create: { /* ... */ fullProfile },
     update: { /* ... */ fullProfile },
   });

   await updateProjectStage(proj.id, "mda");

   return NextResponse.json(result);
   ```

2. **Удалить `void safeJsonParse;`** (route.ts:855) и убрать импорт:
   ```ts
   // БЫЛО:
   // import { ..., safeJsonParse, ... } from "@/lib/api-helpers";
   // ...
   // void safeJsonParse;

   // СТАЛО: убрать safeJsonParse из импорта, удалить void строку
   import {
     getOwnedProject,
     updateProjectStage,
     UNAUTH,
     SERVER_ERROR,
     VALIDATION_ERROR,
   } from "@/lib/api-helpers";
   ```

3. **(Опционально) Добавить колонку `aiInsights` в Prisma schema** — для прямого доступа без парсинга `fullProfile`:
   ```prisma
   model ProjectMDAProfile {
     // ... existing
     aiInsights        String?  // NEW: AI enrichment text
     // ...
   }
   ```
   Запуск `npx prisma migrate dev --name add_mda_ai_insights`.
   Записывать:
   ```ts
   await db.projectMDAProfile.upsert({
     create: { /* ... */ aiInsights: aiInsights || null, fullProfile },
     update: { /* ... */ aiInsights: aiInsights || null, fullProfile },
   });
   ```

**Тест-кейсы**:
- POST `/mda/analyze` с `use_ai=true`: после ответа, `GET /mda/[projectId]` (если существует) или чтение `ProjectMDAProfile.fullProfile` через БД возвращает `ai_insights` поле.
- POST с `use_ai=false`: `ai_insights` отсутствует в response и в БД.
- `safeJsonParse` не импортируется в route.ts.
- При ошибке `enrichMda` (LLM timeout): route не падает, возвращает результат без `ai_insights`, `models_used` не содержит "glm-4.6".

**Риски**:
- Latency: если `enrichMda` занимает 5-10 сек, общая latency route увеличивается. Митигация: timeout 30s, graceful fallback.
- Если Prisma миграция для `aiInsights` колонки не запускается — данные только в `fullProfile` JSON. Это OK (как Block 2 сейчас).

**Dependencies**: TASK-3.14 (расширение prompt для `enrichMda`).

---

### TASK-3.13: Расширить lens categories до Bible 3.6 (3 уровня Зубека вместо 4 произвольных)

**Сложность**: M
**Приоритет**: 🟡 (соответствие Bible 3.6.3)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 469–561, функция `buildLensValidation`), `src/constants/mda.ts` (`PRIORITY_LENSES`)

**Описание проблемы**:

Bible 3.6.3 явно определяет 3 уровня Зубека:
- **Линзы опыта** (1-8, 19-25, 68-82, 96-99) → Уровень «Опыт игрока»
- **Линзы геймплея** (9-12, 26-36, 37-58, 59-67) → Уровень «Геймплей»
- **Линзы процесса и контекста** (13-18, 83-95, 100-113) → Мета-уровень

Реализация использует 4 произвольные категории: `целостность`, `эмерджентность`, `баланс`, `интерес`. Не соответствуют уровням Зубека, не дают направленного применения lens по уровню проблемы.

**Решение**:

1. **Обновить `PRIORITY_LENSES`** в `constants/mda.ts` — добавить `zubek_level`:
   ```ts
   export type ZubekLevel = "experience" | "gameplay" | "context";

   export const PRIORITY_LENSES = [
     // Линзы геймплея (Bible 3.6.3)
     { id: 9,  name: "Тетрада",                  focus: "Согласованность Механика/История/Эстетика/Технология", category: "целостность",    zubek_level: "gameplay" },
     { id: 11, name: "Единство",                  focus: "Работают ли все элементы на общий замысел?",            category: "целостность",    zubek_level: "gameplay" },
     { id: 12, name: "Резонанс",                  focus: "Усиливают ли элементы друг друга?",                     category: "целостность",    zubek_level: "gameplay" },
     { id: 30, name: "Эмерджентность",            focus: "Сколько глаголов? Сколько результирующих действий?",    category: "эмерджентность", zubek_level: "gameplay" },
     { id: 31, name: "Пространство действий",     focus: "Совпадает ли воспринимаемое с реальным?",              category: "эмерджентность", zubek_level: "gameplay" },
     { id: 40, name: "Треугольность",             focus: "Осмысленный выбор риска vs безопасности",               category: "баланс",        zubek_level: "gameplay" },
     { id: 41, name: "Доминантная стратегия",     focus: "Есть ли один очевидно лучший путь?",                    category: "баланс",        zubek_level: "gameplay" },
     // Линзы опыта (Bible 3.6.3)
     { id: 69, name: "Кривая интереса",           focus: "Пики и спады интереса на протяжении игры",              category: "интерес",       zubek_level: "experience" },
     { id: 74, name: "Свобода vs управляемость",  focus: "Баланс агентивности и замысла",                         category: "интерес",       zubek_level: "experience" },
   ];
   ```

2. **Обновить `buildLensValidation`** — группировать по `zubek_level`:
   ```ts
   function buildLensValidation(mechanicSet, dynamicsTarget, aesthetics, classicMdaResult) {
     const lenses = PRIORITY_LENSES; // импорт из constants

     const results = lenses.map((lens) => {
       let score = 0.6;

       // Bible 3.6.3: directed diagnosis — experience lenses зависят от predicted_aesthetics,
       // gameplay lenses — от mechanic_set, context lenses — от pipeline metadata
       if (lens.zubek_level === "experience") {
         // Линзы опыта: score зависит от classicMdaResult.overall_match
         const matchFactor = classicMdaResult?.overall_match || 0;
         if (lens.id === 69) { // Кривая интереса
           score = 0.4 + matchFactor * 0.5; // лучше матч → лучше interest curve
         } else if (lens.id === 74) { // Свобода vs управляемость
           const mechanicCount = countMechanics(mechanicSet);
           score = Math.min(0.95, 0.5 + Math.min(1, mechanicCount / 15) * 0.4);
         }
       } else if (lens.zubek_level === "gameplay") {
         if (lens.category === "целостность") {
           score = Math.min(1, mechanicSet.compatibility_score / 100);
         } else if (lens.category === "эмерджентность") {
           score = dynamicsTarget.emergence_level === "strong" ? 0.85
                 : dynamicsTarget.emergence_level === "moderate" ? 0.7
                 : dynamicsTarget.emergence_level === "weak" ? 0.55
                 : 0.4;
         } else if (lens.category === "баланс") {
           // Для #40 Треугольность: проверить, есть ли risk vs safety механики
           if (lens.id === 40) {
             const hasRisk = mechanicSet.combat.some((m) => ["health_damage", "perfect_timing"].includes(m.mechanic_name));
             const hasSafety = mechanicSet.progression.some((m) => ["ability_cooldowns", "shield_system"].includes(m.mechanic_name));
             score = (hasRisk && hasSafety) ? 0.85 : (hasRisk || hasSafety) ? 0.6 : 0.4;
           }
           // Для #41 Доминантная стратегия: меньше путей → выше риск доминантной
           if (lens.id === 41) {
             const totalMechs = countMechanics(mechanicSet);
             score = Math.min(0.95, 0.4 + totalMechs / 30); // больше механик → меньше шанс доминантной
           }
         }
       }

       // ... existing issuesFound/suggestions logic (с fixed TASK-3.5 logic для #41)
       // ...
     });

     // Группировка по zubek_level для отчета
     const byZubekLevel = {
       experience: results.filter((r) => PRIORITY_LENSES.find((l) => l.id === r.lens_id)?.zubek_level === "experience"),
       gameplay: results.filter((r) => PRIORITY_LENSES.find((l) => l.id === r.lens_id)?.zubek_level === "gameplay"),
       context: results.filter((r) => PRIORITY_LENSES.find((l) => l.id === r.lens_id)?.zubek_level === "context"),
     };

     return {
       results,
       by_zubek_level: {
         experience: {
           count: byZubekLevel.experience.length,
           avg_score: avg(byZubekLevel.experience.map((r) => r.score)),
         },
         gameplay: {
           count: byZubekLevel.gameplay.length,
           avg_score: avg(byZubekLevel.gameplay.map((r) => r.score)),
         },
         context: {
           count: byZubekLevel.context.length,
           avg_score: avg(byZubekLevel.context.length > 0 ? byZubekLevel.context.map((r) => r.score) : [0]),
         },
       },
       critical_issues, warnings, passed_count, total_count, overall_score,
     };
   }
   ```

3. **Передать `classicMdaResult` в `buildLensValidation`** (сейчас не передаётся):
   ```ts
   // route.ts: после Stage 5
   if (fullAnalysis) {
     lensValidation = buildLensValidation(
       mechanicSet,
       dynamicsTarget,
       aestheticProfile,
       classicMdaResult  // NEW
     );
   }
   ```

**Тест-кейсы**:
- `lens_validation.by_zubek_level.experience.count === 2` (lens 69, 74).
- `lens_validation.by_zubek_level.gameplay.count === 7` (lens 9, 11, 12, 30, 31, 40, 41).
- `lens_validation.by_zubek_level.context.count === 0` (нет context lens в приоритетных 9).
- Для проекта с `overall_match = 0.9`: `by_zubek_level.experience.avg_score >= 0.7`.
- Для #40 Треугольность: score = 0.85 если есть и risk, и safety механики.

**Риски**:
- Добавление `zubek_level` в `PRIORITY_LENSES` — breaking change для frontend, если UI зависит от `category`. Проверить `LensAuditPanel.tsx`.
- `by_zubek_level` — новое поле в response. Type расширить в `src/types/mda.ts`.

**Dependencies**: TASK-3.5 (Lens #41 inversion), TASK-3.3 (`classicMdaResult` для experience lens scoring).

---

### TASK-3.14: Расширить `enrichMda` prompt — передавать mechanicSet, dynamicsTarget, lensValidation, bondValidation

**Сложность**: M
**Приоритет**: 🟡 (AI quality)
**Файлы**: `src/lib/ai-service.ts` (строки 547–583, функция `enrichMda`)

**Описание проблемы**:

```ts
// ai-service.ts:547–583
export interface MdaAiInput {
  projectName: string;
  genre: string;
  aesthetics: string[];
}

export async function enrichMda(ctx: MdaAiInput): Promise<string | null> {
  // ...
  const prompt = `Ты — экспертный геймдизайнер. Проанализируй MDA-профиль игры.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Целевые эстетики (LeBlanc): ${ctx.aesthetics.join(", ")}

Дай 3 рекомендации (на русском):
1. Какие механики лучше всего вызовут эти эстетики
2. Какие динамики могут возникнуть и как их направить
3. Какие линзы Шелла приоритетны для этого набора эстетик

Ответ — обычный текст с нумерованными пунктами.`;
  // ...
}
```

AI получает только `projectName`, `genre`, `aesthetics` (3 строки). Не знает о фактическом mechanic set, dynamics target, lens scores. LLM даёт **общие** советы, не привязанные к конкретному проекту.

Подтверждено в `01_Shadow_Depths/03_mda.json`: `ai_insights` начинается с общих фраз «1. Для эстетики "challenge" реализуйте систему сложных боёв...» — это generic advice, не основанный на mechanic set (который уже содержит `turn_based_combat, ability_cooldowns`).

**Решение**:

1. **Расширить `MdaAiInput`**:
   ```ts
   export interface MdaAiInput {
     projectName: string;
     genre: string;
     aesthetics: string[];                  // existing
     // NEW:
     mechanicSet?: string;                  // JSON: MechanicSet
     dynamicsTarget?: string;               // JSON: DynamicsTarget
     lensValidation?: string | null;        // JSON: LensValidation
     bondValidation?: string | null;        // JSON: BondValidation
     classicMdaResult?: string | null;      // JSON: ClassicMdaResult (overall_match, converged, missing dynamics)
   }
   ```

2. **Обновить prompt** — включить конкретные данные:
   ```ts
   export async function enrichMda(ctx: MdaAiInput): Promise<string | null> {
     const zai = await getZai();
     if (!zai) return null;
     try {
       const mechanicSetSummary = ctx.mechanicSet ? summarizeMechanicSet(ctx.mechanicSet) : "не передан";
       const dynamicsSummary = ctx.dynamicsTarget ? summarizeDynamics(ctx.dynamicsTarget) : "не переданы";
       const lensSummary = ctx.lensValidation ? summarizeLens(ctx.lensValidation) : "не переданы";
       const bondSummary = ctx.bondValidation ? summarizeBond(ctx.bondValidation) : "не передана";
       const mdaSummary = ctx.classicMdaResult ? summarizeClassicMda(ctx.classicMdaResult) : "не передан";

       const prompt = `Ты — экспертный геймдизайнер. Проанализируй MDA-профиль игры и дай КОНКРЕТНЫЕ рекомендации.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Целевые эстетики (LeBlanc): ${ctx.aesthetics.join(", ")}

Сгенерированный mechanic set:
${mechanicSetSummary}

Целевые динамики:
${dynamicsSummary}

Результат Classic MDA (analytic pass):
${mdaSummary}

Валидация 9 приоритетных линз Шелла:
${lensSummary}

Bond 4×3 matrix + ludonarrative:
${bondSummary}

Дай 4-5 КОНКРЕТНЫХ рекомендаций (на русском, каждая 2-4 предложения):
1. Какие конкретные механики добавить/убрать для улучшения overall_match (укажи, для какой aesthetics)
2. Какие динамики могут возникнуть ЭМЕРДЖЕНТНО (не target) и как их направить
3. Какие линзы Шелла имеют низкий score и что сделать для их улучшения
4. Есть ли лудонарративный диссонанс? Если да — как исправить
5. Приоритетные действия для следующей итерации Reverse MDA

Ответ — обычный текст с нумерованными пунктами. Избегай общих фраз, ссылайся на конкретные mechanic_id и dynamics.`;
       // ...
     }
   }

   function summarizeMechanicSet(json: string): string {
     try {
       const ms = JSON.parse(json);
       const fmt = (arr: any[]) => (arr || []).map((m) => m.mechanic_name).join(", ");
       return `  base: ${fmt(ms.base)}
  combat: ${fmt(ms.combat)}
  progression: ${fmt(ms.progression)}
  spatial: ${fmt(ms.spatial)}
  social: ${fmt(ms.social)}
  compatibility_score: ${ms.compatibility_score}
  synergy_score: ${ms.synergy_score}`;
     } catch { return "  (parse error)"; }
   }

   function summarizeDynamics(json: string): string {
     try {
       const dt = JSON.parse(json);
       return `  core: ${dt.core_dynamics.join(", ")}
  supporting: ${dt.supporting_dynamics.join(", ")}
  emergence_level: ${dt.emergence_level}`;
     } catch { return "  (parse error)"; }
   }

   function summarizeLens(json: string): string {
     try {
       const lv = JSON.parse(json);
       const issues = lv.results
         .filter((r: any) => r.score < 0.6)
         .map((r: any) => `    ${r.lens_name} (#${r.lens_id}): score=${r.score}, issues=${r.issues_found.length}`)
         .join("\n");
       return `  overall_score: ${lv.overall_score}
  passed: ${lv.passed_count}/${lv.total_count}
  lenses с low score (< 0.6):
${issues || "    (все линзы выше 0.6)"}`;
     } catch { return "  (parse error)"; }
   }

   function summarizeBond(json: string): string {
     try {
       const bv = JSON.parse(json);
       return `  overall_consistency: ${bv.overall_consistency}
  ludonarrative.result: ${bv.ludonarrative.result}
  ludonarrative.description: ${bv.ludonarrative.description}`;
     } catch { return "  (parse error)"; }
   }

   function summarizeClassicMda(json: string): string {
     try {
       const cm = JSON.parse(json);
       return `  overall_match: ${cm.overall_match}
  converged: ${cm.converged}
  iterations: ${cm.iterations}
  observed_dynamics: ${(cm.observed_dynamics || []).join(", ")}
  top-3 predicted_aesthetics: ${Object.entries(cm.predicted_aesthetics || {})
    .sort((a: any, b: any) => b[1] - a[1])
    .slice(0, 3)
    .map(([a, p]: any) => `${a}=${p}`)
    .join(", ")}`;
     } catch { return "  (parse error)"; }
   }
   ```

3. **Передать данные в route.ts**:
   ```ts
   // route.ts — после Stage 6, до persist
   let aiInsights: string | null = null;
   if (useAi) {
     aiInsights = await enrichMda({
       projectName: proj.name || "Untitled",
       genre,
       aesthetics: [primaryAesthetic, secondaryAesthetic, tertiaryAesthetic],
       mechanicSet: JSON.stringify(mechanicSet),
       dynamicsTarget: JSON.stringify(dynamicsTarget),
       lensValidation: lensValidation ? JSON.stringify(lensValidation) : null,
       bondValidation: bondValidation ? JSON.stringify(bondValidation) : null,
       classicMdaResult: classicMdaResult ? JSON.stringify(classicMdaResult) : null,
     });
   }
   ```

**Тест-кейсы**:
- `enrichMda` вызывается с полным контекстом — prompt содержит реальный `mechanic_set` (например, `combat: turn_based_combat, ability_cooldowns`).
- AI response ссылается на конкретные mechanic_id (например, «добавить `difficulty_settings` для эстетики challenge»).
- Если `lensValidation` имеет lens с score < 0.6, AI рекомендует конкретное улучшение.
- Если `ludonarrative.result === "Диссонанс"`, AI объясняет причину и предлагает решение.
- Если AI timeout/fails, `enrichMda` возвращает null — route не падает.

**Риски**:
- Prompt size: с JSON-сериализованными объектами может быть 2-4 KB. LLM должна справляться, но latency увеличится.
- Token cost: больше токенов на prompt = дороже. Митигация: использовать summary helpers (уже в решении).
- JSON parse errors в helpers — fallback на "(parse error)", prompt остаётся валидным.

**Dependencies**: TASK-3.12 (persist ai_insights — порядок вызова).

---

### TASK-3.15: Type-safe `MDAAnalysisResult` — убрать `as unknown as` casts, описать конкретные подобъекты

**Сложность**: M
**Приоритет**: 🟢 (code quality, подготовка к TASK-3.20 unit-тестам)
**Файлы**: `src/types/mda.ts` (35 строк), `src/app/api/v1/mda/analyze/route.ts` (строки 757, 766)

**Описание проблемы**:

```ts
// src/types/mda.ts — текущий (плоский, потеря type safety)
export interface MDAAnalysisResult {
  aesthetic_profile: Record<string, unknown> | null;
  dynamics_target: Record<string, unknown> | null;
  mechanic_candidate_set: Record<string, unknown> | null;
  mechanic_set: Record<string, unknown> | null;
  classic_mda_result: Record<string, unknown> | null;
  lens_validation: Record<string, unknown> | null;
  bond_validation: Record<string, unknown> | null;
  // ...
}
```

Все подсекции — `Record<string, unknown> | null`. TypeScript не проверяет поля. В route.ts (строки 757, 766):
```ts
lensValidation = buildLensValidation(
  mechanicSet as unknown as { compatibility_score: number; synergy_score: number },
  // ...
);
bondValidation = buildBondValidation(mechanicSet as unknown as { compatibility_score: number }, ...);
```

`mechanicSet` имеет гораздо больше полей, но типы сужены через `as unknown as` — type bypass.

**Решение**:

1. **Описать конкретные типы** в `src/types/mda.ts`:
   ```ts
   /**
    * Gidede — MDA Types (Block 3)
    * Bible 2.3 reference: bible_2_3_mda_framework.md
    */

   export type AestheticType =
     | "sensation" | "fantasy" | "narrative" | "challenge"
     | "fellowship" | "discovery" | "expression" | "submission";

   export interface MDAFormState {
     conceptId: string;
     genre: string;
     primaryAesthetic: AestheticType;
     secondaryAesthetic: AestheticType;
     tertiaryAesthetic: AestheticType;
     idea: string;
     existingMechanics: string;
     requiredMechanics: string;
     forbiddenMechanics: string;
     maxMechanics: number;
     convergenceThreshold: number;
     fullAnalysis: boolean;
   }

   // === Aesthetic Profile ===
   export interface AestheticProfile {
     primary: AestheticType;
     secondary: AestheticType;
     tertiary: AestheticType;
     rationale: string;
   }

   // === Dynamics Target ===
   export interface ContextDynamic {
     name: string;
     reasoning: string;
     warning: string;
   }

   export interface DynamicsTarget {
     core_dynamics: string[];
     supporting_dynamics: string[];
     emergence_level: "nominal" | "weak" | "moderate" | "multiple" | "strong";
     emergence_description: string;
     rationale: string;
     context_dynamics: ContextDynamic[];
     warnings: string[];
   }

   // === Mechanic Candidate Set ===
   export interface SynergyPair { mechanic_a: string; mechanic_b: string; }
   export interface ConflictPair { mechanic_a: string; mechanic_b: string; }

   export interface MechanicCandidateSet {
     uncovered_dynamics: string[];
     synergy_pairs: SynergyPair[];
     conflict_pairs: ConflictPair[];
   }

   // === Mechanic Set ===
   export interface MechanicEntry { mechanic_name: string; }

   export interface AestheticCoverageEntry {
     aesthetic: AestheticType;
     count: number;
     dynamics_covered?: number;  // NEW в TASK-3.2
     dynamics_total?: number;    // NEW
     sufficient: boolean;
   }

   export interface PatternEntry {
     name: string;
     pattern_type: "adams" | "dormans" | "bjork";
     present: boolean;
     suggestion?: string;
   }

   export interface DerivedFromDynamics {  // NEW в TASK-3.4
     core_dynamics_covered: string[];
     supporting_dynamics_covered: string[];
     mechanics_by_dynamics: Record<string, string>;
     genre_defaults_added: string[];
   }

   export interface MechanicSet {
     base: MechanicEntry[];
     combat: MechanicEntry[];
     progression: MechanicEntry[];
     spatial: MechanicEntry[];
     social: MechanicEntry[];
     aesthetic_coverage: AestheticCoverageEntry[];
     patterns_detected: PatternEntry[];
     compatibility_score: number;
     synergy_score: number;
     suggestions: string[];
     warnings: string[];
     derived_from_dynamics?: DerivedFromDynamics;
   }

   // === Classic MDA Result ===
   export interface GameplayStep {
     action: string;
     mechanics_used: string[];
     resources_consumed: string[];
     resources_produced: string[];
   }

   export interface FeedbackLoop {
     loop_type: "positive" | "negative";
     description: string;
     stability: "stable" | "unstable" | "critical";
   }

   export interface TargetDynamicsCoverage {  // NEW в TASK-3.9
     target: string[];
     observed: string[];
     missing: string[];
     emergent: string[];
     coverage_ratio: number;
   }

   export interface IterationRecord {  // NEW в TASK-3.3
     iteration: number;
     overall_match: number;
     converged: boolean;
     adjustments: string[];
   }

   export interface StabilityReport {
     stable: boolean;
     pathology: string | null;
     correction: string;
   }

   export interface ClassicMDAResult {
     gameplay_sequence: GameplayStep[];
     feedback_loops: FeedbackLoop[];
     observed_dynamics: string[];
     target_dynamics_coverage?: TargetDynamicsCoverage;
     predicted_aesthetics: Record<AestheticType, number>;
     match_scores: Record<AestheticType, number>;
     overall_match: number;
     converged: boolean;
     stability: StabilityReport;
     iterations: number;
     iterations_history?: IterationRecord[];
     gameplay_script: string;
     suggestions: string[];
     warnings: string[];
   }

   // === Lens Validation ===
   export type LensCategory = "целостность" | "эмерджентность" | "баланс" | "интерес";
   export type ZubekLevel = "experience" | "gameplay" | "context";

   export interface LensEntry {
     id: number;
     name: string;
     focus: string;
     category: LensCategory;
     zubek_level: ZubekLevel;
   }

   export interface LensResult {
     lens_id: number;
     lens_name: string;
     score: number;
     issues_found: string[];
     suggestions: string[];
     questions_asked: string[];
     answers: string[];
   }

   export interface CriticalIssue {
     lens_id: number;
     lens_name: string;
     issues: string[];
   }

   export interface LensValidation {
     results: LensResult[];
     critical_issues: CriticalIssue[];
     warnings: CriticalIssue[];
     passed_count: number;
     total_count: number;
     overall_score: number;
     by_zubek_level?: {  // NEW в TASK-3.13
       experience: { count: number; avg_score: number };
       gameplay: { count: number; avg_score: number };
       context: { count: number; avg_score: number };
     };
   }

   // === Bond Validation ===
   export interface BondMatrixCell {
     element: string;
     level: string;
     content: string;
   }

   export interface RowConsistency {
     level: string;
     score: number;
     dissonances: Array<{ element: string; issue: string }>;
   }

   export interface ColConsistency {
     element: string;
     score: number;
     description: string;
   }

   export interface LudonarrativeCheck {
     result: "Гармония" | "Ирония" | "Диссонанс";
     description: string;
     mechanic_narrative_pairs: Array<{
       mechanic: string;
       narrative: string;
       consistency: number;
     }>;
     correction: string;
   }

   export interface BondValidation {
     matrix: BondMatrixCell[];
     row_consistency: RowConsistency[];
     col_consistency: ColConsistency[];
     ludonarrative: LudonarrativeCheck;
     overall_consistency: number;
   }

   // === Final Result ===
   export interface MDAAnalysisResult {
     aesthetic_profile: AestheticProfile;
     dynamics_target: DynamicsTarget;
     mechanic_candidate_set: MechanicCandidateSet;
     mechanic_set: MechanicSet;
     classic_mda_result: ClassicMDAResult | null;
     lens_validation: LensValidation | null;
     bond_validation: BondValidation | null;
     genre: string;
     concept_id: string;
     iterations_done: number;
     stages_completed: number[];
     latency_ms: number;
     models_used: string[];
     ai_insights?: string;
   }
   ```

2. **Использовать типы в route.ts** — убрать `as unknown as` casts:
   ```ts
   // route.ts — function signatures
   function buildMechanicSet(...): MechanicSet { ... }
   function buildClassicMDA(...): ClassicMDAResult { ... }
   function buildLensValidation(
     mechanicSet: MechanicSet,  // вместо { compatibility_score, synergy_score }
     dynamicsTarget: DynamicsTarget,
     aesthetics: AestheticProfile,
     classicMdaResult: ClassicMDAResult | null
   ): LensValidation { ... }
   function buildBondValidation(
     mechanicSet: MechanicSet,
     dynamicsTarget: DynamicsTarget,
     aesthetics: AestheticProfile,
     classicMdaResult: ClassicMDAResult | null,
     concept?: { genre?: string; onePagerData?: string } | null
   ): BondValidation { ... }

   // В route handler:
   let mechanicSet: MechanicSet = buildMechanicSet(...);
   let classicMdaResult: ClassicMDAResult | null = null;
   let lensValidation: LensValidation | null = null;
   let bondValidation: BondValidation | null = null;

   if (fullAnalysis) {
     classicMdaResult = buildClassicMDA(mechanicSet, dynamicsTarget, aestheticProfile, convergenceThreshold, genre, idea);
     lensValidation = buildLensValidation(mechanicSet, dynamicsTarget, aestheticProfile, classicMdaResult);
     bondValidation = buildBondValidation(mechanicSet, dynamicsTarget, aestheticProfile, classicMdaResult, proj.concept);
   }

   const result: MDAAnalysisResult = {
     aesthetic_profile: aestheticProfile,
     dynamics_target: dynamicsTarget,
     // ... без casts
   };
   ```

3. **Обновить импорты** — `import { ... } from "@/types/mda"`.

**Тест-кейсы**:
- `tsc --noEmit` не выдаёт ошибок типов в `route.ts`, `types/mda.ts`.
- `as unknown as` отсутствует в route.ts (grep должен вернуть 0 совпадений).
- `MDAAnalysisResult` импортируется в `src/app/blocks/3/page.tsx` (если используется).
- Тип `AestheticType` используется для валидации входных данных (можно заменить `VALID_AESTHETICS.includes(primaryAesthetic)` на type-narrowing function).

**Риски**:
- Большой объём типов — `types/mda.ts` разрастается с 35 до ~250 строк. Это OK (соответствует Bible-сложности).
- Frontend (`blocks/3/page.tsx`, `components/gidede/mda/*`) может зависеть от текущей плоской структуры — обновить импорты.
- Existing JSON в БД (`fullProfile`) не соответствует strict типу — `JSON.parse` возвращает `any`, нужно runtime validation (например, через zod) для полного type safety. В первом приближении — достаточно compile-time типов.

**Dependencies**: TASK-3.1 — TASK-3.14 (типы описывают структуру, которая формируется этими задачами).

---

### TASK-3.16: Реальный `machinationsModel` graph из mechanic set

**Сложность**: M
**Приоритет**: 🟡 (Bible 3.5.2 Шаг 1 «Смоделировать динамику (Machinations)»)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 828, 846), новый `src/lib/mda/machinations-builder.ts`

**Описание проблемы**:

```ts
// route.ts:828, 846
machinationsModel: JSON.stringify({ nodes: [], resource_flows: [], state_connections: [], feedback_loops: [] }),
```

Сохраняется **пустой** graph. Bible 3.5.2 явно требует: «Шаг 1: Смоделировать динамику (Machinations / агентная симуляция)».

Block 4 (Balance) и Block 5b (Economy) имеют свои `machinationsModel` поля, но они не наследуют из Block 3. Block 3 должен передать skeleton (nodes from mechanic_set, flows from dynamics), который Block 4/5b могут расширить.

**Решение**:

1. **Создать `src/lib/mda/machinations-builder.ts`**:
   ```ts
   import { MechanicSet, DynamicsTarget, AestheticProfile } from "@/types/mda";

   export interface MachinationsNode {
     id: string;
     type: "source" | "pool" | "converter" | "drain" | "gate" | "end";
     label: string;
     mechanic_id?: string;
     group?: "base" | "combat" | "progression" | "spatial" | "social";
   }

   export interface MachinationsFlow {
     id: string;
     from: string;
     to: string;
     resource: string;
     rate: number; // прикидочное значение, дальше Block 4 уточнит
   }

   export interface MachinationsFeedbackLoop {
     id: string;
     type: "positive" | "negative";
     nodes: string[]; // ordered path
     description: string;
   }

   export interface MachinationsStateConnection {
     id: string;
     from: string;
     to: string;
     condition: string; // например, "if node.resources >= threshold"
   }

   export interface MachinationsGraph {
     nodes: MachinationsNode[];
     resource_flows: MachinationsFlow[];
     state_connections: MachinationsStateConnection[];
     feedback_loops: MachinationsFeedbackLoop[];
     // NEW: metadata
     generated_from: "block3_mda";
     mechanic_count: number;
     dynamics_count: number;
   }

   /**
    * Строит skeleton Machinations graph из mechanic set.
    * Это начальная топология для Block 4 (Balance) и Block 5b (Economy).
    */
   export function buildMachinationsSkeleton(
     mechanicSet: MechanicSet,
     dynamicsTarget: DynamicsTarget
   ): MachinationsGraph {
     const nodes: MachinationsNode[] = [];
     const flows: MachinationsFlow[] = [];
     const feedbackLoops: MachinationsFeedbackLoop[] = [];
     const stateConnections: MachinationsStateConnection[] = [];

     // 1. Создать pool-узел для каждой механики
     const allMechs: Array<{ name: string; group: string }> = [
       ...mechanicSet.base.map((m) => ({ name: m.mechanic_name, group: "base" })),
       ...mechanicSet.combat.map((m) => ({ name: m.mechanic_name, group: "combat" })),
       ...mechanicSet.progression.map((m) => ({ name: m.mechanic_name, group: "progression" })),
       ...mechanicSet.spatial.map((m) => ({ name: m.mechanic_name, group: "spatial" })),
       ...mechanicSet.social.map((m) => ({ name: m.mechanic_name, group: "social" })),
     ];

     for (const m of allMechs) {
       nodes.push({
         id: m.name,
         type: "pool",
         label: m.name,
         mechanic_id: m.name,
         group: m.group as any,
       });
     }

     // 2. Создать resource source/drain узлы (базовые ресурсы)
     const baseResources = ["xp", "gold", "energy", "hp", "materials"];
     for (const r of baseResources) {
       nodes.push({ id: `source_${r}`, type: "source", label: `${r} source` });
       nodes.push({ id: `drain_${r}`, type: "drain", label: `${r} drain` });
     }

     // 3. Создать flows: base → combat → progression → spatial → social → base (цикл)
     // Используем heuristic: первая механика каждой группы связана с следующей группой
     const groups = ["base", "combat", "progression", "spatial", "social"] as const;
     for (let i = 0; i < groups.length; i++) {
       const fromGroup = groups[i];
       const toGroup = groups[(i + 1) % groups.length];
       const fromMechs = mechanicSet[fromGroup];
       const toMechs = mechanicSet[toGroup];
       if (fromMechs.length > 0 && toMechs.length > 0) {
         const fromName = fromMechs[0].mechanic_name;
         const toName = toMechs[0].mechanic_name;
         flows.push({
           id: `flow_${fromName}_to_${toName}`,
           from: fromName,
           to: toName,
           resource: i === 0 ? "signal" : i === 1 ? "energy" : i === 2 ? "xp" : i === 3 ? "intel" : "social_capital",
           rate: 1.0, // placeholder
         });
       }
     }

     // 4. Создать feedback loops: combat → reward → progression → stronger combat
     if (mechanicSet.combat.length > 0 && mechanicSet.progression.length > 0) {
       const combatName = mechanicSet.combat[0].mechanic_name;
       const progName = mechanicSet.progression[0].mechanic_name;
       feedbackLoops.push({
         id: "loop_reinforcing_combat_progression",
         type: "positive",
         nodes: [combatName, progName, combatName],
         description: "Combat → reward → progression → stronger combat (reinforcing)",
       });
     }

     // 5. Balancing loop: combat → energy drain → return to base
     if (mechanicSet.combat.length > 0) {
       const combatName = mechanicSet.combat[0].mechanic_name;
       feedbackLoops.push({
         id: "loop_balancing_energy",
         type: "negative",
         nodes: [combatName, "drain_energy", "source_energy", combatName],
         description: "Combat → energy drain → return to base (balancing)",
       });
     }

     // 6. State connections: gate conditions
     // Например, ability_cooldowns gate → combat
     const allMechsSet = new Set(allMechs.map((m) => m.name));
     if (allMechsSet.has("ability_cooldowns") && mechanicSet.combat.length > 0) {
       stateConnections.push({
         id: "gate_cooldown_to_combat",
         from: "ability_cooldowns",
         to: mechanicSet.combat[0].mechanic_name,
         condition: "if cooldown_ready == true",
       });
     }

     return {
       nodes,
       resource_flows: flows,
       state_connections: stateConnections,
       feedback_loops: feedbackLoops,
       generated_from: "block3_mda",
       mechanic_count: allMechs.length,
       dynamics_count: dynamicsTarget.core_dynamics.length + dynamicsTarget.supporting_dynamics.length,
     };
   }
   ```

2. **Использовать в route.ts**:
   ```ts
   import { buildMachinationsSkeleton } from "@/lib/mda/machinations-builder";

   // ... после buildMechanicSet:
   const machinationsModel = buildMachinationsSkeleton(mechanicSet, dynamicsTarget);

   // В db.upsert:
   await db.projectMDAProfile.upsert({
     create: {
       // ...
       machinationsModel: JSON.stringify(machinationsModel),
       // ...
     },
     update: {
       // ...
       machinationsModel: JSON.stringify(machinationsModel),
       // ...
     },
   });

   // В result:
   const result: MDAAnalysisResult = {
     // ...
     machinations_model: machinationsModel,  // NEW field в response
     // ...
   };
   ```

3. **Опционально** — расширить тип `MDAAnalysisResult` полем `machinations_model?: MachinationsGraph`.

**Тест-кейсы**:
- Для любого проекта с непустым mechanicSet: `machinationsModel.nodes.length > 0`.
- `nodes` содержит pool-узел для каждой механики + 10 source/drain узлов для 5 базовых ресурсов.
- `flows` содержит ≥1 flow между группами.
- `feedback_loops` содержит ≥1 reinforcing loop если есть combat+progression.
- `mechanic_count === суммарное количество механик в mechanicSet`.
- Block 4 (Balance) может прочитать `machinationsModel` из БД и использовать как skeleton.

**Риски**:
- Идентификаторы resource (`xp`, `gold`, `energy`, `hp`, `materials`) — hardcoded. Должны соответствовать Block 5b GENRE_RESOURCE_PRESETS. Coordinate.
- `mechanic_name` как node id — может содержать неподходящие для graph characters (пробелы). Использовать slugify если нужно.
- Block 4/5b могут игнорировать это поле и строить свой graph заново. Документировать, что Block 3 даёт skeleton.

**Dependencies**: TASK-3.1 (canonical IDs как node ids), TASK-3.4 (mechanic set populated).

---

### TASK-3.17: Убрать `mechanic_candidate_set.uncovered_dynamics` всегда пустой + реальная sanity-валидация

**Сложность**: S
**Приоритет**: 🟢 (cleanup — RC-11)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 178–223, функция `buildMechanicCandidateSet`)

**Описание проблемы**:

```ts
// route.ts:186–197
const coveredDynamics: string[] = [];
for (const dyn of requiredDynamics) {
  const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
  for (const m of mechs) {
    allMechanics.add(m);
  }
  if (mechs.length > 0) coveredDynamics.push(dyn);
}

const uncoveredDynamics = requiredDynamics.filter(
  (d) => !coveredDynamics.includes(d)
);
```

Все 24 динамики имеют entries в `DYNAMICS_TO_MECHANICS` (3 механики каждая), поэтому `mechs.length > 0` всегда true, `coveredDynamics === requiredDynamics`, `uncoveredDynamics = []` всегда.

Поле `uncovered_dynamics` бесполезно — никогда не содержит значений.

**Решение**:

1. **Удалить `uncovered_dynamics` поле** или **переопределить его смысл**:
   - Вариант A: удалить поле совсем (если не используется в UI).
   - Вариант B: переопределить — `uncovered_dynamics` = dynamics, для которых **ни одна** механика не входит в `mechanic_set` (после применения genre defaults, forbidden, max). Это полезная информация.

   Рекомендация: **вариант B**.

2. **Реализация варианта B**:
   ```ts
   function buildMechanicCandidateSet(
     dynamicsTarget: { core_dynamics: string[]; supporting_dynamics: string[] },
     existingMechanics: string[],
     forbiddenMechanics: string[] = []  // NEW parameter
   ) {
     const requiredDynamics = [...dynamicsTarget.core_dynamics, ...dynamicsTarget.supporting_dynamics];
     const allMechanics = new Set<string>(existingMechanics);

     // Map dynamics to mechanics
     const dynamicsToMechanics: Record<string, string[]> = {};
     for (const dyn of requiredDynamics) {
       const mechs = (DYNAMICS_TO_MECHANICS[dyn] || []).filter(
         (m) => !forbiddenMechanics.includes(m)
       );
       dynamicsToMechanics[dyn] = mechs;
       for (const m of mechs) {
         allMechanics.add(m);
       }
     }

     // Dynamics, у которых нет механик (после forbidden filter)
     const uncoveredDynamics = requiredDynamics.filter(
       (dyn) => dynamicsToMechanics[dyn].length === 0
     );

     // NEW: dynamics, у которых все механики уже forbidden
     const fullyForbiddenDynamics = requiredDynamics.filter((dyn) => {
       const allMechs = DYNAMICS_TO_MECHANICS[dyn] || [];
       return allMechs.length > 0 && allMechs.every((m) => forbiddenMechanics.includes(m));
     });

     // Synergy pairs (round-robin 3 шт.) — без изменений
     // ...

     // Conflict pairs — без изменений
     // ...

     return {
       uncovered_dynamics: uncoveredDynamics,
       fully_forbidden_dynamics: fullyForbiddenDynamics,  // NEW
       synergy_pairs: synergyPairs,
       conflict_pairs: conflictPairs,
       // NEW: mapping для transparency
       dynamics_to_mechanics: dynamicsToMechanics,
     };
   }
   ```

3. **Передать `forbiddenMechanics`** в вызове:
   ```ts
   const mechanicCandidateSet = buildMechanicCandidateSet(
     dynamicsTarget,
     existingMechanics,
     forbiddenMechanics  // NEW
   );
   ```

**Тест-кейсы**:
- Для проекта без forbidden: `uncovered_dynamics = []` (expected, все dynamics покрыты).
- Для проекта с `forbidden_mechanics=["difficulty_settings","enemy_scaling","player_buffs"]`: `uncovered_dynamics` содержит `"skill_scaling"` (все 3 её механики запрещены).
- `fully_forbidden_dynamics` содержит dynamics, все механики которых forbidden.
- `dynamics_to_mechanics` — mapping для transparency (UI может показывать).

**Риски**:
- Если frontend (`ReverseMDAPanel.tsx`) отображает `uncovered_dynamics` — UI должен gracefully handle непустой массив. Проверить.
- `dynamics_to_mechanics` — новое поле, может раздуть response. Cap на 24 entries (24 dynamics × 3 mechanics = 72 strings, ~2KB).

**Dependencies**: TASK-3.1 (canonical IDs).

---

### TASK-3.18: Убрать dead code — `void safeJsonParse`, неиспользуемые imports

**Сложность**: S
**Приоритет**: 🟢 (cleanup)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 28–35, 855)

**Описание проблемы**:

```ts
// route.ts:28–35 — импорт safeJsonParse, который не используется
import {
  getOwnedProject,
  safeJsonParse,  // ← не используется
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";

// route.ts:855
void safeJsonParse;  // ← linter workaround
```

Тот же паттерн в Block 1, Block 2, Block 4 — системная проблема S8 из AUDIT_REPORT.

**Решение**:

```ts
// БЫЛО:
// import {
//   getOwnedProject,
//   safeJsonParse,
//   updateProjectStage,
//   UNAUTH,
//   SERVER_ERROR,
//   VALIDATION_ERROR,
// } from "@/lib/api-helpers";
// ...
// void safeJsonParse;

// СТАЛО:
import {
  getOwnedProject,
  updateProjectStage,
  UNAUTH,
  SERVER_ERROR,
  VALIDATION_ERROR,
} from "@/lib/api-helpers";
// safeJsonParse удалён из импорта
// void safeJsonParse; удалён
```

Дополнительно — проверить другие неиспользуемые imports через `tsc --noUnusedLocals`:
```bash
npx tsc --noUnusedLocals --noEmit src/app/api/v1/mda/analyze/route.ts
```

**Тест-кейсы**:
- `tsc --noUnusedLocals` не выдаёт warnings для route.ts.
- `grep "safeJsonParse" src/app/api/v1/mda/analyze/route.ts` возвращает 0 совпадений.
- Build проходит без linter warnings.

**Риски**: нет.

**Dependencies**: TASK-3.12 (persist ai_insights уже удаляет `void safeJsonParse` в своём решении — coordinate).

---

### TASK-3.19: Реальная `buildMechanicSet` round-robin → semantic categorization + affinity-based sort

**Сложность**: M
**Приоритет**: 🟡 (RC-17, RC-18)
**Файлы**: `src/app/api/v1/mda/analyze/route.ts` (строки 242–269, функция `buildMechanicSet`)

**Описание проблемы**:

```ts
// route.ts:242–252 — round-robin по индексу
for (let i = 0; i < existingMechanics.length; i++) {
  const m = existingMechanics[i];
  if (forbiddenMechanics.includes(m)) continue;
  const group = i % 5;
  if (group === 0) baseSet.add(m);
  else if (group === 1) combatSet.add(m);
  // ...
}

// route.ts:260–263 — slice без сортировки
const filterToMax = (set: Set<string>) => {
  const arr = Array.from(set);
  return arr.slice(0, Math.max(1, Math.ceil(maxMechanics / 5) + 1));
};
```

Mechanics распределяются по группам по индексу `i`, не по content. `voice_acting` может попасть в `spatial`. Slice берёт первые N без учёта relevance.

**Решение**:

1. **Semantic categorization** — использовать `DYNAMICS_TO_GROUP` mapping (см. TASK-3.4) для каждой механики:
   ```ts
   // Helper: для mechanic_id определить, в какую группу он относится
   function categorizeMechanic(mechanicId: string): "base" | "combat" | "progression" | "spatial" | "social" {
     // 1. Поиск по dynamics_to_mechanics: для каждой динамики, проверить, входит ли mechanicId
     for (const [dyn, group] of Object.entries(DYNAMICS_TO_GROUP)) {
       const mechs = DYNAMICS_TO_MECHANICS[dyn] || [];
       if (mechs.includes(mechanicId)) return group;
     }
     // 2. Поиск по GENRE_DEFAULT_MECHANICS: для каждого жанра/группы
     for (const genreGroups of Object.values(GENRE_DEFAULT_MECHANICS)) {
       for (const [group, mechs] of Object.entries(genreGroups)) {
         if (mechs.includes(mechanicId)) return group as any;
       }
     }
     // 3. Fallback: по имени механики (heuristic)
     if (/combat|fight|attack|weapon|enemy|damage/.test(mechanicId)) return "combat";
     if (/xp|level|skill|progress|unlock|upgrade/.test(mechanicId)) return "progression";
     if (/explore|map|world|dungeon|spatial|location/.test(mechanicId)) return "spatial";
     if (/party|social|trade|friend|guild|chat/.test(mechanicId)) return "social";
     return "base";
   }

   // В buildMechanicSet:
   for (const m of existingMechanics) {
     if (forbiddenMechanics.includes(m)) continue;
     const group = categorizeMechanic(m);
     switch (group) {
       case "combat": combatSet.add(m); break;
       case "progression": progressionSet.add(m); break;
       case "spatial": spatialSet.add(m); break;
       case "social": socialSet.add(m); break;
       default: baseSet.add(m);
     }
   }
   ```

2. **Affinity-based sort + filterToMax** — вместо `slice(0, N)`:
   ```ts
   const filterToMax = (set: Set<string>, genre: string, maxPerGroup: number) => {
     const arr = Array.from(set);
     // Sort по affinity к жанру (если TASK-1.1 Block 1 выполнен, использовать genre_affinity)
     const sorted = arr.sort((a, b) => {
       const aAffinity = getMechanicGenreAffinity(a, genre); // "high"=3, "medium"=2, "low"=1, undefined=0
       const bAffinity = getMechanicGenreAffinity(b, genre);
       return bAffinity - aAffinity;
     });
     return sorted.slice(0, maxPerGroup).map((name) => ({ mechanic_name: name }));
   };

   const maxPerGroup = Math.max(1, Math.ceil(maxMechanics / 5) + 1);
   const base = filterToMax(baseSet, genre, maxPerGroup);
   // ...
   ```

3. **Helper `getMechanicGenreAffinity`** — использовать MechanicsDB из Block 1:
   ```ts
   import { findMechanicByName } from "@/lib/mechanics-db";

   function getMechanicGenreAffinity(mechanicId: string, genre: string): number {
     // Преобразовать canonical_id → русское имя MechanicsDB
     const displayName = ID_TO_DISPLAY_NAME[mechanicId];
     if (!displayName) return 0;
     const mech = findMechanicByName(displayName);
     if (!mech) return 0;
     const affinity = mech.genre_affinity?.[genre.toLowerCase()];
     if (affinity === "high") return 3;
     if (affinity === "medium") return 2;
     if (affinity === "low") return 1;
     return 0;
   }
   ```

**Тест-кейсы**:
- Для `existingMechanics=["voice_acting","backstory_choices"]`: `categorizeMechanic("voice_acting") === "base"` (по `DYNAMICS_TO_MECHANICS["role_immersion"]` → group "progression" если в mapping, иначе heuristic fallback).
- Для `existingMechanics=["health_damage"]`: categorize → "combat".
- `filterToMax` для RPG с `["health_damage","armor_system","parry_mechanic","dialogue_trees","quest_log"]` в combat set: сохраняет top-2 по affinity (health_damage и armor_system если у них high для RPG).
- `mechanic_set.base/combat/...` содержит механики, семантически соответствующие группе.

**Риски**:
- `DYNAMICS_TO_GROUP` mapping (из TASK-3.4) должен быть консистентен с `categorizeMechanic`.
- `findMechanicByName` — lookup по русскому имени. Coordinate с Block 1 TASK-1.1 (genre_affinity populated).
- Для mechanics, которых нет в MechanicsDB (новые IDs из TASK-3.1 расширения) — fallback на heuristic.

**Dependencies**: TASK-3.1 (canonical IDs), TASK-3.4 (DYNAMICS_TO_GROUP mapping), TASK-1.1 Block 1 (genre_affinity в MechanicsDB).

---

### TASK-3.20: Unit-тесты для Block 3 — покрыть критические функции

**Сложность**: L
**Приоритет**: 🟢 (quality assurance)
**Файлы**: новый `src/app/api/v1/mda/analyze/__tests__/route.test.ts`, новый `src/lib/mda/__tests__/namespaces.test.ts`, новый `src/lib/mda/__tests__/machinations-builder.test.ts`

**Описание проблемы**:

В кодовой базе нет unit-тестов для Block 3. После рефакторинга TASK-3.1–3.19 критические функции (`buildClassicMDA`, `runClassicMdaIterations`, `buildBondValidation`, `computeLudonarrative`, `buildMachinationsSkeleton`, `categorizeMechanic`, `getMechanicsForAesthetic`) должны быть покрыты тестами для регрессионной защиты.

**Решение**:

1. **Создать тестовую инфраструктуру** — vitest или jest (проверить `package.json` для тест-раннера):
   ```bash
   # Если не настроено:
   bun add -d vitest @vitest/coverage-v8
   ```

2. **Тесты для namespaces** (`src/lib/mda/__tests__/namespaces.test.ts`):
   ```ts
   import { describe, it, expect } from "vitest";
   import {
     validateMechanicNamespaces,
     getMechanicsForAesthetic,
     MECHANICS_DB_ID,
     ALL_MECHANIC_IDS,
   } from "@/constants/mda-namespaces";
   import { AESTHETIC_TO_DYNAMICS, DYNAMICS_TO_MECHANICS, GENRE_DEFAULT_MECHANICS } from "@/constants/mda-namespaces";

   describe("Mechanic namespaces", () => {
     it("validateMechanicNamespaces returns no errors", () => {
       const errors = validateMechanicNamespaces();
       expect(errors).toEqual([]);
     });

     it("MECHANICS_DB_ID has 128+ entries", () => {
       expect(Object.keys(MECHANICS_DB_ID).length).toBeGreaterThanOrEqual(128);
     });

     it("ALL_MECHANIC_IDS has no duplicates", () => {
       const ids = ALL_MECHANIC_IDS;
       expect(new Set(ids).size).toBe(ids.length);
     });

     it("getMechanicsForAesthetic returns ≥3 mechanics for each aesthetic", () => {
       const aesthetics = ["sensation", "fantasy", "narrative", "challenge", "fellowship", "discovery", "expression", "submission"];
       for (const a of aesthetics) {
         const mechs = getMechanicsForAesthetic(a);
         expect(mechs.length).toBeGreaterThanOrEqual(3);
         // All mechanics should be canonical IDs
         for (const m of mechs) {
           expect(ALL_MECHANIC_IDS).toContain(m);
         }
       }
     });
   });
   ```

3. **Тесты для `buildClassicMDA`** (`src/app/api/v1/mda/analyze/__tests__/route.test.ts`):
   ```ts
   import { describe, it, expect } from "vitest";
   // Импортировать функции напрямую (могут потребоваться extracted в src/lib/mda/)
   // Если функции объявлены внутри route.ts — рефакторить в src/lib/mda/classic-mda.ts

   describe("buildClassicMDA", () => {
     it("returns overall_match > 0 for RPG with full mechanic set", () => {
       const mechanicSet = { /* populated RPG set */ };
       const dynamicsTarget = { core_dynamics: ["skill_scaling", ...], supporting_dynamics: [...] };
       const aesthetics = { primary: "challenge", secondary: "fantasy", tertiary: "discovery" };
       const result = buildClassicMDA(mechanicSet, dynamicsTarget, aesthetics, 0.8, "rpg", "");
       expect(result.overall_match).toBeGreaterThan(0);
       expect(result.predicted_aesthetics.challenge).toBeGreaterThan(0);
     });

     it("returns converged=true when overall_match >= threshold", () => {
       // Setup с очень низким threshold
       const result = buildClassicMDA(/* ... */);
       expect(result.converged).toBe(true);
       expect(result.iterations).toBe(1);
     });

     it("returns iterations_history with at least 1 entry", () => {
       const result = buildClassicMDA(/* ... */);
       expect(result.iterations_history).toBeDefined();
       expect(result.iterations_history.length).toBeGreaterThanOrEqual(1);
     });
   });

   describe("computeLudonarrative", () => {
     it("returns 'Гармония' when primary aesthetic is well-covered", () => {
       const result = computeLudonarrative(/* mechanicSet, aesthetics, classicMda with overall_match=0.85 */);
       expect(result.result).toBe("Гармония");
     });

     it("returns 'Диссонанс' when primary aesthetic is poorly covered", () => {
       const result = computeLudonarrative(/* classicMda with overall_match=0.1, predicted[primary]=0.05 */);
       expect(result.result).toBe("Диссонанс");
     });

     it("returns 'Ирония' when other aesthetic is stronger than primary", () => {
       const result = computeLudonarrative(/* primary=challenge, predicted: sensation=0.8, challenge=0.3 */);
       expect(result.result).toBe("Ирония");
     });
   });

   describe("buildMachinationsSkeleton", () => {
     it("returns non-empty nodes for non-empty mechanic set", () => {
       const graph = buildMachinationsSkeleton(/* populated mechanicSet, dynamicsTarget */);
       expect(graph.nodes.length).toBeGreaterThan(0);
       expect(graph.feedback_loops.length).toBeGreaterThan(0);
     });

     it("returns empty graph for empty mechanic set", () => {
       const graph = buildMachinationsSkeleton(/* empty mechanicSet */, /* empty dynamicsTarget */);
       expect(graph.nodes.length).toBe(10); // только resource source/drain
     });
   });

   describe("categorizeMechanic", () => {
     it("categorizes combat mechanics correctly", () => {
       expect(categorizeMechanic("health_damage")).toBe("combat");
       expect(categorizeMechanic("turn_based_combat")).toBe("combat");
     });

     it("categorizes progression mechanics correctly", () => {
       expect(categorizeMechanic("xp_leveling")).toBe("progression");
       expect(categorizeMechanic("skill_trees")).toBe("progression");
     });

     it("defaults to 'base' for unknown mechanics", () => {
       expect(categorizeMechanic("unknown_mechanic")).toBe("base");
     });
   });
   ```

4. **Integration тест** — end-to-end через test script:
   ```ts
   describe("MDA analyze endpoint integration", () => {
     it("returns different results for different inputs", async () => {
       // Mock project с разными aesthetics
       const result1 = await callMdaAnalyze({ primary_aesthetic: "challenge", ... });
       const result2 = await callMdaAnalyze({ primary_aesthetic: "fellowship", ... });
       expect(result1.aesthetic_profile.primary).not.toBe(result2.aesthetic_profile.primary);
       expect(result1.mechanic_set).not.toEqual(result2.mechanic_set);
     });
   });
   ```

5. **Regression тест** — `overall_match` не должен быть 0 для reasonable input:
   ```ts
   it("overall_match > 0 for any non-trivial input (regression for RC-1)", () => {
     for (const aesthetic of VALID_AESTHETICS) {
       for (const genre of ["rpg", "shooter", "strategy", "puzzle"]) {
         const result = buildClassicMDA(/* with default mechanic set for genre */);
         expect(result.overall_match).toBeGreaterThan(0);
       }
     }
   });
   ```

6. **CI integration** — добавить в GitHub Actions / pre-commit:
   ```yaml
   # .github/workflows/test.yml
   - name: Run Block 3 tests
     run: bun test src/app/api/v1/mda/ src/lib/mda/
   ```

**Тест-кейсы** (для самих тестов — meta):
- `bun test src/app/api/v1/mda/` проходит без failures.
- Coverage ≥80% для `src/lib/mda/*.ts`.
- Coverage ≥70% для `src/app/api/v1/mda/analyze/route.ts`.

**Риски**:
- **Функции в route.ts не экспортируются** — нужно либо (a) рефакторить в `src/lib/mda/` модули (рекомендуется), либо (b) использовать `// @vitest-environment node` и тестировать через HTTP.
- **DB зависимости** — `route.ts` вызывает `db.projectMDAProfile.upsert`. Для unit-тестов нужно mock'ать `db` через `vi.mock("@/lib/db")`.
- **AI enrichment** — `enrichMda` вызывает внешний LLM. Mock'ать через `vi.mock("@/lib/ai-service")`.

**Dependencies**: TASK-3.1–3.19 (функции должны быть выделены и type-safe). Рекомендуется выполнять TASK-3.20 последним после стабилизации API.

---

## Сводная таблица задач

| ID | Сложность | Приоритет | Краткое описание | Dependencies |
|----|-----------|-----------|------------------|--------------|
| TASK-3.1 | XL | 🔴 | Выровнять `mechanic_id` namespace (DYNAMICS_TO_MECHANICS ↔ GENRE_DEFAULT_MECHANICS ↔ MechanicsDB) | TASK-1.1 (Block 1) |
| TASK-3.2 | M | 🔴 | Перебирать все динамики эстетики в `buildClassicMDA` и `aesthetic_coverage` (не только `[0]`) | TASK-3.1 |
| TASK-3.3 | M | 🔴 | Починить `match_scores` формулу + реальная итерация Classic MDA | TASK-3.1, TASK-3.2 |
| TASK-3.4 | L | 🔴 | Реальный Reverse MDA — mechanic set из dynamics_target, не из GENRE_DEFAULT_MECHANICS | TASK-3.1, TASK-3.2 |
| TASK-3.5 | S | 🔴 | Инвертировать logic в Lens #41 (Доминантная стратегия) | нет |
| TASK-3.6 | M | 🔴 | Загружать aestheticProfile/genre/idea из project.concept если не переданы в body + починить pipeline runner | TASK-1.6 (Block 1) |
| TASK-3.7 | M | 🟡 | Переписать `compatibility_score` формулу — убрать hardcoded `present: true` | TASK-3.1, TASK-3.2 |
| TASK-3.8 | L | 🟡 | Реальная Bond 4×3 matrix + вычислить ludonarrative (Гармония/Ирония/Диссонанс) | TASK-3.1, TASK-3.3 |
| TASK-3.9 | M | 🟡 | Реальный `observed_dynamics` из mechanic set (не copy из input) | TASK-3.1, TASK-3.4 |
| TASK-3.10 | M | 🟡 | Реальный `gameplay_sequence` из mechanic set (templates по жанру) | TASK-3.1, TASK-3.4 |
| TASK-3.11 | S | 🟡 | Добавить `moderate` в `EMERGENCE_BADGES` | нет |
| TASK-3.12 | S | 🟡 | Persist `ai_insights` в БД + убрать `void safeJsonParse` | TASK-3.14 |
| TASK-3.13 | M | 🟡 | Расширить lens categories до Bible 3.6 (3 уровня Зубека) | TASK-3.3, TASK-3.5 |
| TASK-3.14 | M | 🟡 | Расширить `enrichMda` prompt — передавать mechanicSet, dynamicsTarget, lensValidation | TASK-3.12 |
| TASK-3.15 | M | 🟢 | Type-safe `MDAAnalysisResult` — убрать `as unknown as` casts | TASK-3.1–3.14 |
| TASK-3.16 | M | 🟡 | Реальный `machinationsModel` graph из mechanic set | TASK-3.1, TASK-3.4 |
| TASK-3.17 | S | 🟢 | Убрать `uncovered_dynamics` всегда пустой + реальная sanity-валидация | TASK-3.1 |
| TASK-3.18 | S | 🟢 | Убрать dead code — `void safeJsonParse`, неиспользуемые imports | TASK-3.12 |
| TASK-3.19 | M | 🟡 | Реальная `buildMechanicSet` round-robin → semantic categorization + affinity-based sort | TASK-3.1, TASK-3.4, TASK-1.1 (Block 1) |
| TASK-3.20 | L | 🟢 | Unit-тесты для Block 3 — покрыть критические функции | TASK-3.1–3.19 |

**Итого**: 20 задач
- 🔴 критичных: **6** (TASK-3.1, TASK-3.2, TASK-3.3, TASK-3.4, TASK-3.5, TASK-3.6)
- 🟡 средних: **11** (TASK-3.7, TASK-3.8, TASK-3.9, TASK-3.10, TASK-3.11, TASK-3.12, TASK-3.13, TASK-3.14, TASK-3.16, TASK-3.19) + TASK-3.11
- 🟢 низких: **4** (TASK-3.15, TASK-3.17, TASK-3.18, TASK-3.20)

**Оценка трудозатрат** (приблизительная):
- Без TASK-3.20: **55-75 часов**
- С TASK-3.20: **75-100 часов**

---

## Рекомендуемый порядок выполнения

### Фаза 1: Unblock pipeline (15-20 часов)
1. **TASK-3.6** — загружать aestheticProfile/genre/idea из project.concept (M, 🔴) — без этого все 10 test_projects идентичны.
2. **TASK-3.5** — инвертировать Lens #41 logic (S, 🔴) — простой фикс semantic correctness.
3. **TASK-3.11** — EMERGENCE_BADGES.moderate (S, 🟡) — простой UI fix.
4. **TASK-3.18** — убрать dead code (S, 🟢) — cleanup.

### Фаза 2: Namespace alignment (25-35 часов)
5. **TASK-3.1** — выровнять mechanic_id namespace (XL, 🔴) — фундамент для TASK-3.2/3.3/3.4/3.7/3.8/3.9/3.10/3.16/3.17/3.19.
6. **TASK-3.17** — реальная sanity-валидация uncovered_dynamics (S, 🟢) — простое follow-up после TASK-3.1.

### Фаза 3: Classic MDA fix (15-20 часов)
7. **TASK-3.2** — перебирать все динамики (M, 🔴) — root cause для overall_match=0.
8. **TASK-3.3** — починить match_scores + реальная итерация (M, 🔴).
9. **TASK-3.4** — Reverse MDA: mechanic set из dynamics_target (L, 🔴) — соответствие Bible 3.5.4.

### Фаза 4: Validation stages (15-20 часов)
10. **TASK-3.7** — compatibility_score (M, 🟡).
11. **TASK-3.8** — Bond matrix + ludonarrative (L, 🟡).
12. **TASK-3.9** — observed_dynamics (M, 🟡).
13. **TASK-3.10** — gameplay_sequence (M, 🟡).
14. **TASK-3.13** — lens categories by Zubek level (M, 🟡).
15. **TASK-3.16** — machinationsModel graph (M, 🟡).
16. **TASK-3.19** — semantic categorization (M, 🟡).

### Фаза 5: AI + types + tests (15-25 часов)
17. **TASK-3.12** — persist ai_insights (S, 🟡).
18. **TASK-3.14** — enrichMda prompt extension (M, 🟡).
19. **TASK-3.15** — type-safe MDAAnalysisResult (M, 🟢).
20. **TASK-3.20** — unit-тесты (L, 🟢).

---

## Метрики успеха (definition of done)

После выполнения всех 20 задач:

1. **Корректность `overall_match`**:
   - Для всех 10 test_projects `overall_match > 0` (зависит от реального mechanic set).
   - Для проектов с разными aesthetic profiles `overall_match` различается.
   - `converged = true` для проектов с low threshold (≤0.6) и хорошо покрытыми aesthetics.

2. **Pipeline uniqueness**:
   - 10 test_projects имеют **разные** `aesthetic_profile`, `dynamics_target`, `mechanic_set`, `classic_mda_result` (зависят от project.concept).

3. **Bible compliance**:
   - `DYNAMICS_TO_MECHANICS` содержит только canonical IDs, присутствующие в MechanicsDB.
   - `GENRE_DEFAULT_MECHANICS` покрывает ≥12 жанров с canonical IDs.
   - 9 приоритетных линз Шелла соответствуют Bible 3.6.2 (lens 9, 11, 12, 30, 31, 40, 41, 69, 74).
   - Bond matrix 4×3 содержит конкретный контент из mechanic set (не canned strings).
   - `ludonarrative.result` ∈ {"Гармония", "Ирония", "Диссонанс"} вычисляется на основе `classicMdaResult`.

4. **AI enrichment**:
   - `ai_insights` сохраняется в БД (через `fullProfile` или отдельную колонку).
   - `enrichMda` prompt содержит конкретные mechanic_id и dynamics.

5. **Type safety**:
   - `tsc --noUnusedLocals` не выдаёт warnings для route.ts.
   - `as unknown as` отсутствует в route.ts.
   - `MDAAnalysisResult` описан с конкретными подобъектами.

6. **Test coverage**:
   - `bun test src/app/api/v1/mda/ src/lib/mda/` проходит без failures.
   - Coverage ≥80% для `src/lib/mda/*.ts`.

7. **Regression test**:
   - После рефакторинга повторно запустить `scripts/run_pipeline_test.sh` и сравнить 10 `03_mda.json` файлов — они должны различаться (раньше были идентичны).

---

## Связанные задачи из других блоков

- **TASK-1.1 (Block 1)** — заполнить `genre_affinity` для 128 механик MechanicsDB. **Критично для TASK-3.1 и TASK-3.19**.
- **TASK-1.6 (Block 1)** — убрать невалидные эстетики "competition"/"strategy" из `GENRE_AESTHETICS`. **Критично для TASK-3.6** (иначе route упадёт на VALIDATION_ERROR для проектов с этими эстетиками).
- **TASK-2.x (Block 2)** — persist `ai_insights` паттерн. **Reference для TASK-3.12**.
- **Block 4 (Balance)** — должен использовать `machinationsModel` из Block 3 как skeleton. Coordinate в TASK-3.16.
- **Block 6b (Checklist)** — `runMdaCheck` (3 правила) может быть расширен с использованием реальных данных после рефакторинга Block 3.

---

*Конец плана.*
