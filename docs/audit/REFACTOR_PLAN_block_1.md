# Рефакторинг Блока 1 — Генератор концепции

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-1 (sub-agent)
**Связанные документы**: `docs/audit/AUDIT_REPORT.md` (раздел 1), `docs/bible/bible_2_1_fundament.md`, `docs/bible/bible_2_2_elements.md`
**Объект рефакторинга**: `src/app/api/v1/concept/generate/route.ts` (728 строк), `src/app/api/v1/concept/[id]/route.ts` (44 строки), `src/app/api/v1/concept/[id]/validate/route.ts` (69 строк), `src/lib/mechanics-db.ts` (1537 строк), `src/lib/ai-service.ts` (функции `enrichConcept`, `SYSTEM_PROMPT`), `src/types/concept.ts`, `src/constants/concept.ts`, `src/config/{genres,aesthetics}.ts`, `prisma/schema.prisma` (модель `ProjectConcept`).

---

## Контекст

Блок 1 (Concept Generator) — входная точка пайплайна Gidede. Принимает идею пользователя + опциональные параметры (genre, target audience, platforms, constraints, reference_games, forbidden_mechanics, use_ai), выполняет 7 стадий:

1. **Genre inference** (keyword table из 17 записей, substring match)
2. **Aesthetic profile** (Hunicke 8: primary/secondary/tertiary)
3. **Dynamics profile** (8 aesthetics → 3 dynamics each)
4. **Mechanic set** (MechanicsDB lookup по жанру, fallback на 5 категорий)
5. **Core Loop + USP candidates** (3 закодированных шаблона)
6. **Validation report** (Triangle of Weirdness, 5 core questions, 8 idea filters)
7. **One-pager assembly** + persistence

**Подтверждённые дефекты** (проверены на всех 10 test_projects):
- `compatibility_score = 0` для всех 10 проектов → `triangle_check.credible = false` всегда → `eight_filters.feasibility.score = 0.5` всегда → `five_questions["Why would a player return tomorrow?"] = false` всегда → warning "Mechanic compatibility below 60%" в 9 из 10 проектов.
- 4/8 idea filters захардкожены (`clarity=0.8`, `market_fit=0.6`, `emotional_impact=0.7`, `sustainability=0.65`) — не зависят от входа.
- 2/5 core questions захардкожены `true` (`"What is the core verb?"`, `"What does the player do moment-to-moment?"`).
- `/concept/[id]/validate` — STUB, не пересчитывает метрики, возвращает чужую schema (0-100 vs 0-1, `triangle_of_weirdness` vs `triangle_check`, `idea_filters` с 2 элементами vs `eight_filters` с 8).
- MechanicsDB: 128/128 механик имеют `genres: []` (подтверждено `grep -c "'genres': \[\]" = 128`).
- `GENRE_AESTHETICS` содержит 4 невалидные эстетики `"competition"` и `"strategy"` (это Yee motivations, не Hunicke 8) → `as unknown as string` cast → `deriveDynamics` fallback к `["exploration"]`/`["habit_loops"]` для 4 жанров (`fighting`, `tactical_rpg`, `tower_defense`, `racing`).
- `pickAesthetics`: substring `lower.includes("build")` матчит "deck-building" → Card_Lords получает жанр "strategy" вместо "roguelike" (несмотря на keyword "deck" в roguelike entry). Дубликаты primary/tertiary aesthetic для sandbox/visual_novel.
- `buildCoreLoopCandidates`: подставляет русские имена механик ("Броня", "Очки опыта") в английские фразы-шаблоны ("Engage in ${combatName}") → несогласованный билингвальный вывод "Engage in Броня".
- `buildUSPCandidates`: `idea.slice(0, 60)` / `slice(0, 50)` — если идея короче 60 символов, USP #1 получает всю идею без "…", USP #2/#3 могут дублировать. `lower.split(" ").slice(0, 2).join(" ")` для USP #3 — если идея из 1 слова, получаем только это слово.
- AI enrichment (`enrichConcept`) не персистит `ai_insights` и `generation_metadata` в БД (схема не имеет соответствующих полей). `result.id = proj.id` (project ID), но `GET /concept/[id]` возвращает `c.id` (concept's own cuid) — `id` не согласован между эндпоинтами.
- `result.title` не персистится в БД (нет поля `title` в `ProjectConcept` schema).
- `mechanics-db.ts:293` содержит китайский символ "摩擦" в `desc` для механики "Телепортация". `ai-service.ts:63` содержит "除非" в `SYSTEM_PROMPT`. `ai-service.ts:333` содержит "扩充" в `enrichGddSection` prompt.
- `GENRE_AESTHETICS` не содержит ключа `"default"`, но `pickAesthetics` ссылается на `GENRE_AESTHETICS.default` — для unknown genre выбросит `TypeError: Cannot read property 'primary' of undefined`.
- `MechanicSet` shared type объявляет `base: string[]`, но реализация возвращает `base: Array<{name, group, desc}>` — type bypass.
- Bible 2.2.5 требует 5-уровневую таксономию MechanicsDB (Level 0: 7 Шелла, Level 1: 5 Адамса/Дорманса, Level 2: 16 паттернов, Level 3: 127 SW.BAND, Level 4: жанровые шаблоны). Реализован только Level 3. Top-down generation principle (aesthetics → dynamics → mechanics) не соблюдён.
- Bible 2.2.5 требует «Матрицу Механика → Жанр» 127×6 с трёхуровневой оценкой релевантности — полностью отсутствует.

---

## Цели рефакторинга

1. **Починить compatibility_score** — заполнить `genres` (или `genre_affinity`) для всех 128 механик MechanicsDB; пересчитать формулу с учётом 3-уровневой релевантности.
2. **Восстановить корректность Triangle of Weirdness** — `credible` должен быть функцией реальной совместимости механик с жанром, а не всегда `false`.
3. **Реализовать 8 idea filters** с реальной логикой вместо 4 захардкоженных значений.
4. **Реализовать 5 core questions** с реальными проверками вместо 2 `true`.
5. **Унифицировать schema** между `/concept/generate` и `/concept/[id]/validate` — один формат, реальные пересчёты.
6. **Убрать type bypasses** — `as unknown as string` cast для невалидных эстетик, `MechanicSet` mismatch.
7. **Починить bilingual output** — core loop шаги с русскими существительными в английских глагольных фразах.
8. **Восстановить persistence полноты** — `ai_insights`, `generation_metadata`, `title` должны сохраняться.
9. **Убрать переводные артефакты** — китайские символы в system prompts и `desc` полях.
10. **Заложить фундамент для top-down generation** (Bible 2.2.5) — Levels 0-2 MechanicsDB + матрица mechanic×genre (необязательно в этом цикле, но отметить как TASK-1.14/1.15).

---

## Задачи

### TASK-1.1: Заполнить `genres` и `genre_affinity` для всех 128 механик MechanicsDB

**Сложность**: XL
**Приоритет**: 🔴 (блокирует TASK-1.2, TASK-1.3, TASK-1.7, TASK-1.10)
**Файлы**: `src/lib/mechanics-db.ts`

**Описание проблемы**:

Подтверждено `grep -c "'genres': \[\]" src/lib/mechanics-db.ts` → **128** (100% механик). `findMechanicsByGenre()` всегда возвращает `[]`, `buildMechanicSetForGenre()` fallback на всю БД, `compatibility_score = round(0 / 6 × 100) = 0` для всех 10 test_projects.

Текущая структура (пример):
```ts
{
  'group': 'Базовые',
  'name': 'Изучение мира',
  'desc': 'Игрок исследует игровое пространство…',
  'aesthetics': ['discovery', 'fantasy', 'sensation'],
  'genres': []   // ← ПУСТО ДЛЯ ВСЕХ 128 МЕХАНИК
}
```

Bible 2.2.5 + 1.5.4 требуют «Матрицу Механика → Жанр» 127 механик × 6 жанров с трёхуровневой оценкой релевантности (low/medium/high).

**Решение**:

1. **Расширить интерфейс `Mechanic`** в `src/lib/mechanics-db.ts:6-12`:
   ```ts
   export type GenreAffinity = "low" | "medium" | "high";

   export interface Mechanic {
     group: string;
     name: string;
     desc: string;
     aesthetics: AestheticType[];   // ← использовать shared type вместо string[]
     genres: string[];              // legacy: список жанров где affinity != "low" (для backward compat)
     genre_affinity: Partial<Record<string, GenreAffinity>>;  // new: 3-level detail
   }
   ```

2. **Выбрать 10 основных жанров** для покрытия матрицы (минимум по ТЗ):
   `rpg`, `shooter`, `strategy`, `puzzle`, `racing`, `fighting`, `platformer`, `simulation`, `adventure`, `tower_defense`.
   Опционально расширить до 15: + `horror`, `roguelike`, `sandbox`, `metroidvania`, `rhythm` (более точная фильтрация для этих жанров).

3. **Заполнить `genre_affinity` для каждой из 128 механик** на основе:
   - Эстетик механики (если механика имеет `challenge` в aesthetics и жанр driven by challenge → medium/high).
   - Группы (Боевые → high для shooter/fighting; Экономика → high для strategy/simulation; Движение → high для platformer/racing).
   - Доменного знания (механика "Броня" high для shooter/RPG/fighting, low для puzzle/adventure; "Парирование" high для fighting/action, low для puzzle/strategy; "Прыжки" high для platformer/metroidvania, low для puzzle/strategy).

4. **Сгенерировать `genres: string[]`** из `genre_affinity`:
   ```ts
   // helper для миграции
   function buildGenresList(affinity: Partial<Record<string, GenreAffinity>>): string[] {
     return Object.entries(affinity)
       .filter(([_, a]) => a === "medium" || a === "high")
       .map(([g]) => g);
   }
   ```
   Это сохранит backward compat: `findMechanicsByGenre` продолжит работать через `m.genres.includes(genreLower)`, но также отфильтрует low-affinity механики.

5. **Пример заполнения для 5 механик из группы "Базовые"**:
   ```ts
   {
     group: 'Базовые',
     name: 'Изучение мира',
     desc: 'Игрок исследует игровое пространство…',
     aesthetics: ['discovery', 'fantasy', 'sensation'],
     genre_affinity: {
       adventure: 'high',
       rpg: 'high',
       metroidvania: 'high',
       platformer: 'medium',
       shooter: 'medium',
       strategy: 'medium',
       puzzle: 'medium',
       simulation: 'medium',
       racing: 'low',
       fighting: 'low',
       tower_defense: 'low',
     },
     genres: ['adventure', 'rpg', 'metroidvania', 'platformer', 'shooter', 'strategy', 'puzzle', 'simulation'],
   },
   {
     group: 'Базовые',
     name: 'Достижения и очки',
     desc: 'Система начисления очков…',
     aesthetics: ['challenge', 'submission', 'expression'],
     genre_affinity: {
       platformer: 'high',
       puzzle: 'high',
       shooter: 'medium',
       racing: 'medium',
       fighting: 'medium',
       rpg: 'medium',
       strategy: 'medium',
       tower_defense: 'medium',
       adventure: 'low',
       simulation: 'low',
     },
     genres: ['platformer', 'puzzle', 'shooter', 'racing', 'fighting', 'rpg', 'strategy', 'tower_defense'],
   },
   // ... и так далее для всех 128
   ```

6. **Использовать полуавтоматическую генерацию**: написать скрипт `scripts/fill-mechanics-genres.ts` который для каждой механики выводит «draft» affinity на основе эвристик (group → default affinity per genre, aesthetics → +/- adjustments), затем вручную review/override для нетривиальных случаев. Сохранить результат в `mechanics-db.ts`.

**Тест-кейсы**:
- `findMechanicsByGenre("rpg")` возвращает 30+ механик с medium/high affinity для RPG (изучить мир, инвентарь, квесты, диалоги, очки опыта, перки, экипировка, классы, дерево навыков, магия и т.д.).
- `findMechanicsByGenre("puzzle")` возвращает 15+ механик (головоломки, мультцели, тайники, дискретное время, перематывание времени).
- `findMechanicsByGenre("racing")` возвращает 8+ механик (прыжки, рывок, верховая езда, боевая машина, гравитация, таймер, температура).
- `findMechanicsByGenre("nonexistent")` возвращает `[]` (не падает).
- `findMechanicsByGenre("RPG")` (uppercase) возвращает то же, что и `findMechanicsByGenre("rpg")` (нормализация).
- Механика "Броня" имеет `genre_affinity.shooter = 'high'`, `genre_affinity.rpg = 'high'`, `genre_affinity.puzzle = 'low'`.
- Механика "Парирование" имеет `genre_affinity.fighting = 'high'`, `genre_affinity.action_rpg = 'high'`, `genre_affinity.racing = 'low'`.

**Риски**:
- **Субъективность оценок affinity** — разные геймдизайнеры могут расходиться. Митигация: использовать консенсус из 2-3 источников (Bible, Game Design Workshop Фуллертон, Adams/Dormans), документировать rationale в комментариях.
- **Объём работы**: 128 механик × 10 жанров = 1280 ячеек матрицы. Митигация: batch-генерация через LLM + ручной review спорных случаев.
- **Backward compat**: если кто-то использует `m.genres` напрямую — сохранить поле, заполнить его из `genre_affinity`.

**Dependencies**: нет (стартовая задача)

---

### TASK-1.2: Починить `compatibility_score` каскад в `buildMechanicSetForGenre` + `buildValidationReport`

**Сложность**: M
**Приоритет**: 🔴 (после TASK-1.1)
**Файлы**: `src/lib/mechanics-db.ts` (строки 1463-1515), `src/app/api/v1/concept/generate/route.ts` (строки 404-507)

**Описание проблемы**:

`buildMechanicSetForGenre` (mechanics-db.ts:1502-1507):
```ts
const genreMatches = allSelected.filter((m) => m.genres.includes(genreLower)).length;
const compatibilityScore = allSelected.length > 0
  ? Math.round((genreMatches / allSelected.length) * 100)
  : 50;
```

Даже после TASK-1.1 эта формула даёт бинарный 0/100 (механика либо в списке `genres`, либо нет). Не различает medium vs high affinity.

Каскад в `buildValidationReport` (route.ts:412):
```ts
const credible = mechanicSet.compatibility_score >= 60;
```

`triangleScore` (line 414): `(weird ? 0.4 : 0.2) + (appealing ? 0.3 : 0.1) + (credible ? 0.3 : 0.1)`. При `credible=false` максимально 0.2+0.3+0.1=0.6 — на пороге `trianglePassed = triangleScore >= 0.6`. То есть даже идеальная идея с weird=true и appealing=true получает triangleScore=0.6 (граница), а не 1.0.

**Решение**:

1. **Переписать `compatibility_score`** с учётом 3-уровневой affinity (mechanics-db.ts:1502-1507):
   ```ts
   const affinityWeight = (a?: GenreAffinity): number => {
     if (a === "high") return 1.0;
     if (a === "medium") return 0.6;
     if (a === "low") return 0.3;
     return 0;
   };

   const allSelected = Object.values(selected).flat();
   const totalAffinity = allSelected.reduce(
     (sum, m) => sum + affinityWeight(m.genre_affinity?.[genreLower]),
     0
   );
   const compatibilityScore = allSelected.length > 0
     ? Math.round((totalAffinity / allSelected.length) * 100)
     : 50;
   ```

2. **Уточнить порог `credible`** в route.ts:412:
   - `>= 60` — средний minimum (большинство механик medium+).
   - Использовать градации: `>= 70 → strong`, `>= 50 → credible`, `< 50 → weak`.
   - В `triangle_check.details` выводить градацию: `"Credible=strong (compat=78%)"`.

3. **Убрать предупреждение "Mechanic compatibility below 60%"** когда `compatibility_score >= 60`:
   ```ts
   if (!credible) warnings.push(`Mechanic compatibility ${mechanicSet.compatibility_score}% below 60% threshold — review synergies`);
   ```

**Тест-кейсы**:
- Для RPG-проекта: `compatibility_score >= 65` (большинство выбранных механик имеют high affinity для RPG).
- Для puzzle-проекта: `compatibility_score >= 55` (puzzle-механик меньше, но они high-relevance).
- Для unknown genre ("action"): `compatibility_score` между 30-50 (среднее по всем 128 механикам с default affinity).
- `triangle_check.credible = true` для RPG/shooter/strategy (где affinity хорошо populated).
- Warning "Mechanic compatibility below 60%" НЕ появляется для RPG/shooter/strategy.

**Риски**:
- Если TASK-1.1 выполнен с малым покрытием жанров (только 6 жанров Bible вместо 10 ТЗ), для незаполненных жанров affinity будет undefined → score будет низким. Митигация: TASK-1.1 должен покрыть минимум 10 жанров.

**Dependencies**: TASK-1.1

---

### TASK-1.3: Реализовать 8 idea filters с реальной логикой (4 захардкожены сейчас)

**Сложность**: L
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 428-469)

**Описание проблемы**:

Текущая реализация `eight_filters`:
- `clarity` — **захардкожен 0.8** (не зависит от идеи).
- `novelty` — `weird ? 0.85 : 0.55` (зависит только от USP, не от идеи).
- `feasibility` — `credible ? 0.8 : 0.5` (зависит от TASK-1.2).
- `audience_fit` — `appealing ? 0.85 : 0.5` (зависит только от primary aesthetic).
- `market_fit` — **захардкожен 0.6** (не зависит от жанра/конкурентов).
- `differentiation` — `weird ? 0.8 : 0.5` (дублирует novelty).
- `emotional_impact` — **захардкожен 0.7** (не зависит от aesthetic/narrative).
- `sustainability` — **захардкожен 0.65** (не зависит от core loop).

**Решение**:

1. **`clarity`** — оценивать идею по:
   - Длина (10-50 chars → 0.5, 50-200 → 0.7, 200-500 → 0.85, >500 → 0.6 — слишком длинная).
   - Наличие глагола действия (regex `\b(play|shoot|explore|build|fight|survive|race|solve|collect|escape)\b` → +0.1).
   - Наличие существительного-объекта (regex `\b(world|dungeon|car|gun|enemy|puzzle|character|player)\b` → +0.1).
   - Штраф за восклицания/вопросы (`!{2,}|\?{2,}` → -0.1).

2. **`novelty`** — оценивать по:
   - Количеству USP с `triangle_of_weirdness_check === "pass"` (1 → 0.7, 2 → 0.85, 3 → 0.95).
   - Присутствию unusual keywords из словаря "weird" (`dream|quantum|surreal|glitch|impossible|paradox|memory|echo|inverse` → +0.1 каждое, до +0.2).
   - Штраф за клише (`epic|legendary|amazing|best game ever` → -0.15).

3. **`feasibility`** — оценивать по:
   - `mechanicSet.compatibility_score` (Task 1.2): `>=70 → 0.85`, `>=50 → 0.7`, `<50 → 0.5`.
   - `mechanicSet.total_count` (`>=8 → +0.1`, `<5 → -0.1`).
   - `constraints.team_size` (если есть): solo + RPG/strategy → -0.15 (слишком амбициозно); solo + puzzle/platformer → +0.1.

4. **`audience_fit`** — оценивать по:
   - Совпадению `target_audience.primary` (Yee motivations) с `aesthetic_profile.primary`. Mapping: `challenge/challenge`, `competition/challenge`, `completion/submission`, `power/fantasy`, `destruction/sensation`, `excitement/sensation`, `community/fellowship`, `fantasy_yee/fantasy`, `story/narrative`, `design/expression`, `discovery_yee/discovery`.
   - Если `target_audience` не передан — использовать `0.7` baseline.

5. **`market_fit`** — оценивать по:
   - Жанру: `GENRE_MARKET_FIT` таблица (rpg/shooter/strategy → 0.75 — established; puzzle/platformer → 0.7 — saturated but viable; horror/metroidvania → 0.8 — niche but loyal; idle/visual_novel → 0.55 — narrow).
   - Штраф за oversaturated жанр без USP-pass (`weird=false && genre in [shooter, puzzle]` → -0.1).

6. **`differentiation`** — оценивать по:
   - Количеству `reference_games` (`>=3 → +0.05` — знает рынок; `0 → -0.05` — не знает).
   - `weird ? +0.2 : -0.1`.
   - Совпадению с `competitors` (если idea содержит имя competitor → differentiation=-0.15 — клон).

7. **`emotional_impact`** — оценивать по:
   - Aesthetic profile: `narrative → 0.85`, `fantasy → 0.8`, `fellowship → 0.85`, `submission → 0.65` (calm but not impactful), `challenge → 0.7`, `discovery → 0.75`, `sensation → 0.7`, `expression → 0.6`.
   - Наличию emotional keywords в idea: `love|loss|sacrifice|redemption|betrayal|hope|fear` → +0.1.

8. **`sustainability`** — оценивать по:
   - `mechanic_set.progression.length` (`>=2 → 0.8`, `1 → 0.65`, `0 → 0.4`).
   - `core_loop_candidates[0].loop_type`: `economy → 0.85` (retention via progression), `ecology → 0.75`, `hybrid → 0.8`, `engine → 0.6` (burnout risk).
   - Жанру: `mmorpg/roguelike/sandbox → +0.1` (long-term retention), `puzzle/platformer → -0.05` (short sessions).

9. **Создать `src/lib/concept-filters.ts`** с функциями `evaluateClarity(idea)`, `evaluateNovelty(idea, uspCandidates)`, и т.д. — для тестируемости.

**Тест-кейсы**:
- Идея "A roguelike where you collect souls of fallen enemies in procedurally generated dungeons" → clarity=0.85 (есть глагол "collect", существительное "dungeons", длина适中).
- Идея "my game idea!!!" → clarity=0.3 (нет глагола, нет существительного, восклицания).
- Идея с "epic legendary adventure" → novelty получает штраф -0.15 за клише.
- RPG-проект с use_ai=true (3 USP pass) → novelty=0.95.
- Идея "Minecraft clone" → differentiation=-0.15 (содержит competitor name).
- Идея с "love, loss, redemption" + primary=narrative → emotional_impact=0.95.
- Sandbox-проект без progression механик → sustainability=0.4.

**Риски**:
- Слишком сложные эвристики могут стать непредсказуемыми. Митигация: каждый filter возвращает `{score, reason, improvement}` с понятным reason.
- Keyword lists нужно поддерживать ( добавлять новые клише, weird words). Митигация: вынести в `src/constants/concept.ts` как экспортируемые константы.

**Dependencies**: TASK-1.2 (для `feasibility`), TASK-1.6 (для keyword lists)

---

### TASK-1.4: Реализовать 5 core questions с реальной логикой (2 захардкожены `true`)

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 419-425)

**Описание проблемы**:

Текущая реализация:
```ts
const fiveQuestions: Record<string, boolean> = {
  "What is the core verb?": true,                              // ← ВСЕГДА TRUE
  "What does the player do moment-to-moment?": true,            // ← ВСЕГДА TRUE
  "What long-term goal drives the player?": mechanicSet.total_count >= 5,
  "Where does the fun come from?": appealing,
  "Why would a player return tomorrow?": credible,
};
```

Первые 2 вопроса не имеют логики — возвращают `true` независимо от входа.

**Решение**:

1. **`"What is the core verb?"`** — проверить, что idea содержит глагол действия:
   ```ts
   const actionVerbs = /\b(play|shoot|explore|build|fight|survive|race|solve|collect|escape|craft|trade|defend|attack|jump|run|hide|cast|summon|upgrade|unlock)\b/i;
   const hasCoreVerb = actionVerbs.test(idea);
   ```

2. **`"What does the player do moment-to-moment?"`** — проверить, что `mechanic_set.base` или `mechanic_set.combat` непусты (есть хотя бы 1 механика):
   ```ts
   const hasMomentToMoment = mechanicSet.base.length > 0 && mechanicSet.combat.length > 0;
   ```

3. **`"What long-term goal drives the player?"`** — текущая логика `mechanicSet.total_count >= 5` OK, но можно усилить: проверить наличие progression-механик:
   ```ts
   const hasLongTermGoal = mechanicSet.progression.length > 0 && mechanicSet.total_count >= 5;
   ```

4. **`"Where does the fun come from?"`** — текущая логика `appealing` (= primary != "submission"). Усилить: проверить, что есть хотя бы 1 synergy в `mechanic_set.synergies_detected`:
   ```ts
   const hasFunSource = appealing && (mechanicSet.synergies_detected?.length ?? 0) > 0;
   ```

5. **`"Why would a player return tomorrow?"`** — текущая логика `credible`. Усилить: проверить наличие core_loop_candidates с `loop_type != "engine"` (engine loops склонны к burnout) ИЛИ наличие meta-механик:
   ```ts
   const hasReturnReason = credible && (
     coreLoopCandidates.some(c => c.loop_type !== "engine") ||
     (mechanicSet as any).social?.some(m => /leaderboard|achievement|season/i.test(m.name ?? ""))
   );
   ```

6. **Расширить тип `five_questions`** до `Record<string, { passed: boolean; reason: string }>` для actionable feedback:
   ```ts
   const fiveQuestions = {
     "What is the core verb?": {
       passed: hasCoreVerb,
       reason: hasCoreVerb ? "Idea contains action verb" : "No action verb detected — add 'explore', 'fight', 'build' etc.",
     },
     // ...
   };
   ```
   Изменить shared type `ValidationReport.five_questions: Record<string, QuestionResult>` где `QuestionResult = { passed: boolean; reason: string }`. UI `ValidationReportView` уже поддерживает boolean (вернёт просто check/x) — для нового формата добавить рендеринг reason как tooltip.

**Тест-кейсы**:
- Идея "Dark roguelike in dungeons collecting souls" → core verb=true ("collect"), moment-to-moment=true.
- Идея "my game" → core verb=false, moment-to-moment=false (если mechanicSet пустой).
- Идея без progression механик → long-term goal=false.

**Риски**:
- Расширение типа `five_questions` может сломать UI. Митигация: обновить `ValidationReportView` (block 1) + `LensaValidator` (block 3 если использует). Backward compat: поддержать оба формата через `typeof val === "boolean" ? { passed: val, reason: "" } : val`.

**Dependencies**: TASK-1.2

---

### TASK-1.5: Заменить STUB `/concept/[id]/validate` на реальный пересчёт Triangle/5Q/8Filters

**Сложность**: M
**Приоритет**: 🔴
**Файлы**: `src/app/api/v1/concept/[id]/validate/route.ts` (полностью переписать)

**Описание проблемы**:

Текущая реализация (validate/route.ts:32-57):
```ts
const overallScore = Math.round(
  (uspCandidates.length > 0 ? 25 : 0) +
  (coreLoopCandidates.length > 0 ? 25 : 0) +
  (mechanicSet?.total_count >= 5 ? 25 : 15) +
  (c.usp ? 25 : 0)
);

const validationReport = {
  overall_score: overallScore,                                       // 0-100 (vs 0-1 в generate!)
  triangle_of_weirdness: {                                           // vs triangle_check
    score: uspCandidates.length > 0 ? 80 : 40,
    unique_mechanics: mechanicSet?.total_count || 0,
    verdict: overallScore >= 60 ? "pass" : "review",
  },
  five_core_questions: { ... },                                       // vs five_questions
  idea_filters: {                                                    // vs eight_filters
    "Triangle check": { passed: true, note: "..." },                  // только 2 элемента!
    "Market fit": { passed: true, note: "..." },
  },
};
```

Проблемы:
1. Не пересчитывает Triangle of Weirdness — берёт `uspCandidates.length` (который всегда 3 после generate).
2. Не пересчитывает 5 core questions — использует другие вопросы чем generate.
3. Идея_filters содержит только 2 элемента вместо 8.
4. Возвращает другую schema (0-100 vs 0-1, другие имена полей).
5. `overall_score` всегда 100 если все 4 условия выполнены (что почти всегда) — бесполезно.

**Решение**:

1. **Извлечь общую логику в `src/lib/concept-validation.ts`**:
   ```ts
   export function buildValidationReport(params: {
     aestheticProfile: AestheticProfile;
     mechanicSet: MechanicSet;
     uspCandidates: USPCandidate[];
     coreLoopCandidates: CoreLoopCandidate[];
     idea: string;
     targetAudience?: { primary?: string[]; experience?: string };
     constraints?: { team_size?: number; budget?: string };
     referenceGames?: string[];
     genre: string;
   }): ValidationReport {
     // ← вынести текущий код из generate/route.ts:404-507
   }
   ```

2. **Использовать эту функцию и в generate, и в validate**:
   - generate: вызывает после сборки всех профилей.
   - validate: читает из БД `aestheticProfile`, `mechanicSet`, `uspCandidates`, `coreLoopCandidates`, `inputData` (для idea/genre/target_audience) и пересчитывает.

3. **Полностью переписать validate/route.ts**:
   ```ts
   import { buildValidationReport } from "@/lib/concept-validation";

   export async function POST(request, { params }) {
     // ... auth, get project, get concept
     const inputData = safeJsonParse(c.inputData || "{}", {});
     const aestheticProfile = safeJsonParse(c.aestheticProfile || "{}", {});
     const mechanicSet = safeJsonParse(c.mechanicSet || "{}", {});
     const uspCandidates = safeJsonParse(c.uspCandidates || "[]", []);
     const coreLoopCandidates = safeJsonParse(c.coreLoopCandidates || "[]", []);

     const validationReport = buildValidationReport({
       idea: inputData.idea || "",
       genre: c.genre || inputData.genre || "action",
       aestheticProfile,
       mechanicSet,
       uspCandidates,
       coreLoopCandidates,
       targetAudience: inputData.target_audience,
       constraints: inputData.constraints,
       referenceGames: inputData.reference_games,
     });

     await db.projectConcept.update({
       where: { projectId: id },
       data: { validationReport: JSON.stringify(validationReport) },
     });

     return NextResponse.json(validationReport);
   }
   ```

4. **Унифицировать schema**: вернуть тот же `ValidationReport` тип что и generate (`triangle_check`, `five_questions`, `eight_filters`, `overall_score` 0-1, `warnings`, `suggestions`).

5. **Удалить старую schema** (`triangle_of_weirdness`, `five_core_questions`, `idea_filters` — единственный consumer это UI ValidationReportView который уже поддерживает оба формата).

**Тест-кейсы**:
- POST `/concept/{id}/validate` после generate возвращает тот же `validation_report` что был в generate (или более точный если фильтры улучшены в TASK-1.3).
- `overall_score` в диапазоне [0, 1] (не 0-100).
- `triangle_check.score` в [0, 1].
- `eight_filters` содержит 8 элементов (clarity, novelty, feasibility, audience_fit, market_fit, differentiation, emotional_impact, sustainability).
- Если mechanicSet был изменён (в будущем через UI), validate пересчитывает credible на основе нового mechanicSet.

**Риски**:
- Если frontend уже использует старую schema (`triangle_of_weirdness.scores`), сломается UI. Митигация: grep по кодовой базе — `triangle_of_weirdness` упоминается только в `ValidationReportView.tsx:169` где явно поддерживает оба формата через `??`. Безопасно удалять.

**Dependencies**: TASK-1.3, TASK-1.4 (чтобы пересчёт использовал улучшенные фильтры)

---

### TASK-1.6: Убрать невалидные эстетики `"competition"` и `"strategy"` из `GENRE_AESTHETICS`

**Сложность**: S
**Приоритет**: 🔴
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 83, 91, 98, 102)

**Описание проблемы**:

В `GENRE_AESTHETICS` (route.ts:76-109) 4 записи используют невалидные эстетики:
```ts
fighting:      { primary: "challenge", secondary: "competition" as unknown as string, tertiary: "expression" },
tactical_rpg:  { primary: "challenge", secondary: "strategy" as unknown as string, tertiary: "narrative" },
tower_defense: { primary: "challenge", secondary: "strategy" as unknown as string, tertiary: "submission" },
racing:        { primary: "sensation", secondary: "challenge", tertiary: "competition" as unknown as string },
```

`"competition"` и `"strategy"` — это Yee motivations (см. `src/config/aesthetics.ts:84,95`), не Hunicke 8 aesthetics. `AESTHETIC_VALUES` (route.ts:43-52) содержит только 8 валидных: sensation, fantasy, narrative, challenge, fellowship, discovery, expression, submission.

`AESTHETIC_TO_DYNAMICS` (route.ts:112-121) не имеет ключей `"competition"` и `"strategy"` → `deriveDynamics` использует fallback `["exploration"]`/`["habit_loops"]` — неверные dynamics для fighting/racing/tower_defense.

`as unknown as string` cast — type bypass, скрывает ошибку от TypeScript.

**Решение**:

1. **Заменить `"competition"`** на `"challenge"` (ближайшая Hunicke aesthetic для соревнования — skill mastery, overcoming opponents):
   ```ts
   fighting: { primary: "challenge", secondary: "fellowship", tertiary: "expression" },
   racing:   { primary: "sensation", secondary: "challenge", tertiary: "fellowship" },
   ```
   `fellowship` для racing — мотивация multiplayer racing; для fighting — community/competitive scene.

2. **Заменить `"strategy"`** на `"challenge"` (mental challenge) или `"submission"` (strategic planning = structured decision-making):
   ```ts
   tactical_rpg:  { primary: "challenge", secondary: "submission", tertiary: "narrative" },
   tower_defense: { primary: "challenge", secondary: "submission", tertiary: "discovery" },
   ```
   `submission` здесь подходит — систематическое управление экономикой/защитой = submission aesthetic.

3. **Убрать все `as unknown as string`** cast'ы.

4. **Добавить runtime assertion** в `pickAesthetics`:
   ```ts
   function pickAesthetics(genre: string, idea: string): AestheticProfile {
     const base = GENRE_AESTHETICS[genre] ?? { primary: "challenge", secondary: "discovery", tertiary: "narrative" };
     // ... assert all 3 are in AESTHETIC_VALUES
     if (!AESTHETIC_VALUES.includes(base.primary as AestheticType)) {
       console.warn(`[concept/generate] Invalid primary aesthetic "${base.primary}" for genre "${genre}" — fallback to "challenge"`);
       base.primary = "challenge";
     }
     // ... same for secondary, tertiary
   }
   ```

5. **Типизировать `GENRE_AESTHETICS`** через `AestheticType`:
   ```ts
   import type { AestheticType } from "@/shared/types/typescript/enums";
   const GENRE_AESTHETICS: Record<string, { primary: AestheticType; secondary: AestheticType; tertiary: AestheticType }> = { ... };
   ```

**Тест-кейсы**:
- `deriveDynamics` для `fighting` возвращает `[skill_scaling, difficulty_curves, mastery_growth]` (primary=challenge) + `[team_coordination, social_bonding, shared_goals]` (secondary=fellowship) — не fallback к `["exploration"]`.
- TypeScript компилируется без `as unknown as string`.
- runtime warning не появляется для известных жанров.

**Риски**:
- Изменение aesthetics для 4 жанров может изменить существующий UX (например, у tower_defense сейчас `secondary=strategy` → fallback к dynamics `["exploration"]`, после фикса → `["routine_formation", "habit_loops", "flow_state"]`). Митигация: это правильное поведение, fallback был баг.

**Dependencies**: нет

---

### TASK-1.7: Исправить `pickAesthetics` — word boundaries, dedup, GENRE_KEYWORDS overlap

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 55-73, 186-201)

**Описание проблемы**:

**7.1. Substring matching без word boundaries** (route.ts:191-194):
```ts
if (lower.includes("story") || lower.includes("narrative")) primary = "narrative";
if (lower.includes("explore") || lower.includes("discover")) primary = "discovery";
if (lower.includes("build") || lower.includes("create")) primary = "expression";
if (lower.includes("team") || lower.includes("friends")) primary = "fellowship";
```

Проблемы:
- `"build"` матчит "deck-building", "building simulator", "rebuild", "buildcraft".
- `"team"` матчит "steam", "team-based", "team up".
- `"story"` матчит "history", "storyboard", "story-driven" (последнее OK).
- Без проверки на то, что primary уже был изменён предыдущим правилом — последнее правило перезаписывает все предыдущие.

**7.2. Дубликаты primary/secondary/tertiary**:
- `sandbox` → `base = { primary: "expression", secondary: "discovery", tertiary: "submission" }`. Если idea содержит "create", primary становится "expression" (без изменения, OK). Но если idea содержит "team" → primary="fellowship", secondary="discovery", tertiary="submission" — нет дублей. ОК для sandbox.
- `visual_novel` → `base = { primary: "narrative", secondary: "fantasy", tertiary: "expression" }`. Если idea содержит "create" → primary="expression", tertiary="expression" — **ДУБЛЬ**.
- `simulation` → `base = { primary: "submission", secondary: "expression", tertiary: "discovery" }`. Если idea содержит "create" → primary="expression", secondary="expression" — **ДУБЛЬ**.

**7.3. GENRE_KEYWORDS overlap** (route.ts:55-73):
- `"build"` присутствует в `strategy` (строка 60) и `sandbox` (строка 64). Strategy идёт раньше → "deck-building game" → genre="strategy" (не roguelike, хотя roguelike содержит "deck").
- `"combat"` присутствует в `fighting` (строка 69) и неявно в других жанрах. Если idea "RPG with deep combat" → `rpg` не находится на iteration #4 (ключевые слова `rpg, roleplay, quest, character, leveling`), но `fighting` находится на #14 ("combat"). Однако `rpg` всё же находится на iteration #4 через `rpg` keyword. Для "tactical RPG with deep combat" → `rpg` матчится первым, `tactical_rpg` не существует в GENRE_KEYWORDS.

**Решение**:

1. **Заменить `lower.includes()` на regex с word boundaries** (route.ts:191-194):
   ```ts
   const hasKeyword = (re: RegExp) => re.test(lower);
   if (hasKeyword(/\b(story|narrative|plot|character-driven)\b/)) primary = "narrative";
   else if (hasKeyword(/\b(explore|exploration|discover|discovery|unknown)\b/)) primary = "discovery";
   else if (hasKeyword(/\b(build|create|craft|construct|design|customize)\b/)) primary = "expression";
   else if (hasKeyword(/\b(team|friends?|coop|co-op|multiplayer|guild|clan)\b/)) primary = "fellowship";
   ```
   `else if` вместо `if` — первое сработавшее правило не перезаписывается.

2. **Добавить dedup** — если новая primary равна secondary или tertiary, циклически сдвинуть:
   ```ts
   const allAesthetics = [primary, base.secondary, base.tertiary];
   const unique = new Set(allAesthetics);
   if (unique.size < 3) {
     // Найти замену из AESTHETIC_VALUES
     const replacement = AESTHETIC_VALUES.find(a => !unique.has(a)) ?? "submission";
     if (base.secondary === primary) base.secondary = replacement;
     else if (base.tertiary === primary) base.tertiary = replacement;
   }
   ```

3. **Удалить `"build"` из `strategy` keywords** (route.ts:60), оставить только в `sandbox`:
   ```ts
   { keywords: ["strategy", "tactic", "rts", "empire", "civilization"], genre: "strategy" },
   { keywords: ["sandbox", "craft", "build", "open world", "creative"], genre: "sandbox" },
   ```
   Это правильно: "deck-building" → roguelike (через "deck"); "building simulator" → sandbox.

4. **Добавить `tactical_rpg` в GENRE_KEYWORDS**:
   ```ts
   { keywords: ["tactical rpg", "tactics", "grid-based rpg", "xcom-like"], genre: "tactical_rpg" },
   ```

5. **Добавить weighted scoring** вместо first-match: если несколько genre entries матчат, выбрать тот с наибольшим числом совпадений:
   ```ts
   function inferGenre(idea: string): string {
     const lower = idea.toLowerCase();
     const scores: Record<string, number> = {};
     for (const entry of GENRE_KEYWORDS) {
       scores[entry.genre] = entry.keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
     }
     const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
     return best && best[1] > 0 ? best[0] : "action";
   }
   ```
   Это делает "deck-building roguelike" → roguelike (2 match: "deck", "rogue") vs strategy (0 match).

**Тест-кейсы**:
- Идея "deck-building card battler" → genre="roguelike" (через "deck", "rogue-like"), не "strategy".
- Идея "team-based shooter with friends" → primary="fellowship", no duplicates with secondary/tertiary.
- Идея "create your own visual novel" → primary="expression", secondary="fantasy", tertiary="narrative" (no duplicate of "expression").
- Идея "history of building simulator" → genre="sandbox" (через "build"), primary="expression" (через "build"). Слово "history" не триггерит narrative (word boundary `\bhistory\b` не входит в regex).
- Идея "tactical RPG with grid-based combat" → genre="tactical_rpg" (через "tactical", "grid-based rpg"), не "rpg".

**Риски**:
- Weighted scoring может быть медленнее для длинных идей (O(N*K) где N=17 жанров, K=5 keywords). Митигация: 17*5=85 операций `.includes()` — пренебрежимо мало.
- Удаление `"build"` из strategy может сломать проекты где пользователь явно хочет strategy + build. Митигация: пользователь может передать `genre: "strategy"` явно.

**Dependencies**: TASK-1.6 (для валидации aesthetic values)

---

### TASK-1.8: Починить `buildMechanicSetForGenre` — заполнять все 5 категорий, не только первые 3

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/lib/mechanics-db.ts` (строки 1463-1515)

**Описание проблемы**:

Текущая реализация (mechanics-db.ts:1490-1500):
```ts
const priorityGroups = ["Базовые", "Боевые", "Прогрессия", "Пространство", "Экономика", "Движение", "Социальные", "Выживание", "Стелс", "Навыки", "Время", "Территория", "Сюжет", "Информация", "Мета"];
const selected: Record<string, Mechanic[]> = {};
let count = 0;
for (const g of priorityGroups) {
  if (count >= 5) break;             // ← BREAK после 5 механик!
  if (byGroup[g] && byGroup[g].length > 0) {
    const picks = byGroup[g].slice(0, 2);
    selected[g] = picks;
    count += picks.length;
  }
}
```

После `Базовые` (2) + `Боевые` (2) + `Прогрессия` (2) = 6 ≥ 5 → break. `Пространство`, `Экономика`, `Движение`, `Социальные` и т.д. никогда не заполняются.

В `buildMechanicSet` (route.ts:273-279):
```ts
for (const [cat, list] of Object.entries(categories)) {
  if (list.length === 0) {
    const templates = GENRE_MECHANICS.default;
    const key = cat as keyof typeof templates;
    categories[cat] = templates[key].map((name: string) => ({ name, group: cat }));
  }
}
```

Для пустых `spatial` и `social` категорий берутся **English** имена из `GENRE_MECHANICS.default` (`map_exploration`, `objective_navigation`, `spawn_points`, `leaderboard`, `achievement_share`, `coop_progression`) — несогласованно с русскими именами в `base/combat/progression`. Подтверждено в `test_projects/01_Shadow_Depths/01_concept.json`:
```json
"spatial":[{"name":"map_exploration","group":"spatial"}, ...],
"social":[{"name":"leaderboard","group":"social"}, ...],
```

**Решение**:

1. **Убрать `if (count >= 5) break;`** — выбирать по 1-2 механики из каждой из 5 priority групп (Базовые, Боевые, Прогрессия, Пространство, Экономика):
   ```ts
   const priorityGroups = ["Базовые", "Боевые", "Прогрессия", "Пространство", "Экономика"];
   const selected: Record<string, Mechanic[]> = {};
   for (const g of priorityGroups) {
     if (byGroup[g] && byGroup[g].length > 0) {
       selected[g] = byGroup[g].slice(0, 2);   // 1-2 механики на группу
     }
   }
   // Если приоритетных групп недостаточно — fallback на остальные
   if (Object.values(selected).flat().length < 5) {
     for (const g of ["Движение", "Социальные", "Выживание", "Стелс", "Навыки", "Время", "Территория", "Сюжет", "Информация", "Мета"]) {
       if (byGroup[g]?.length > 0) selected[g] = byGroup[g].slice(0, 2);
       if (Object.values(selected).flat().length >= 8) break;
     }
   }
   ```

2. **Убрать fallback на `GENRE_MECHANICS.default`** в route.ts:273-279 — он маскирует проблему. Если категория пуста, оставить пустой массив `[]` (UI покажет "нет механик в этой категории"). Или: добавить fallback на другие группы MechanicsDB, а не на английские имена.

3. **Альтернатива**: фильтровать MechanicsDB по genre affinity (TASK-1.1) и выбирать top-N по affinity. Это даст более релевантные механики:
   ```ts
   const pool = MECHANICS_DB
     .filter(m => m.genre_affinity?.[genreLower])
     .sort((a, b) => affinityWeight(b.genre_affinity[genreLower]) - affinityWeight(a.genre_affinity[genreLower]));
   ```

**Тест-кейсы**:
- `buildMechanicSetForGenre("rpg")` возвращает 5 групп: Базовые (2), Боевые (2), Прогрессия (2), Пространство (1-2), Экономика (1-2). Все с русскими именами из MechanicsDB.
- `mechanic_set.spatial` не содержит `map_exploration` (английское имя).
- `mechanic_set.social` содержит "Торг" / "Кооперация" / "Гильдии" (русские имена из MechanicsDB), не `leaderboard`.

**Риски**:
- Удаление `break` может дать 8-10 механик вместо 6 — больше данных для downstream blocks. Митигация: ограничить `total_count <= 10` после выбора.

**Dependencies**: TASK-1.1 (для affinity-based filtering)

---

### TASK-1.9: Починить bilingual core loop candidates (русские имена в английских фразах)

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 307-376)

**Описание проблемы**:

`buildCoreLoopCandidates` (route.ts:332-375) генерирует шаги вида:
```ts
steps: [
  `Explore the world`,
  `Encounter enemies`,
  `Engage in ${combatName}`,        // combatName = "Броня" (из MechanicsDB)
  `Collect rewards`,
  `Upgrade via ${progName}`,        // progName = "Очки опыта"
],
```

Результат в `test_projects/01_Shadow_Depths/01_concept.json`:
```json
"steps":["Explore the world","Encounter enemies","Engage in Броня","Collect rewards","Upgrade via Очки опыта"]
```

Это **билингвальный nonsensical output** — механика "Броня" (Armor) не является действием, в которое можно "Engage in". Это существительное, обозначающее защитный слой.

**Решение**:

1. **Локализовать шаблоны шагов на русский** (соответствует языку `SYSTEM_PROMPT` AI и `desc` полей MechanicsDB):
   ```ts
   steps: [
     `Исследовать мир`,
     `Встретить врагов`,
     `Применить механику «${combatName}»`,
     `Собрать награды`,
     `Улучшить через «${progName}»`,
   ],
   fun_check_reasoning: "Тест 30 секунд веселья: каждый шаг даёт мгновенную обратную связь и видимый прогресс",
   ```

2. **Или**: использовать не имя механики, а её глагол (если он есть). Добавить опциональное поле `verb` в `Mechanic`:
   ```ts
   export interface Mechanic {
     group: string;
     name: string;
     verb?: string;       // "Броня" → "защищаться"; "Очки опыта" → "прокачиваться"; "Прыжки" → "прыгать"
     desc: string;
     // ...
   }
   ```
   И использовать `${combatMechanic.verb ?? combatMechanic.name}` в шаблоне.

3. **Или**: переформулировать шаги так, чтобы они не требовали глагольной формы механики:
   ```ts
   steps: [
     `Исследовать мир (${baseName})`,
     `Встретить противников`,
     `Вступить в бой (${combatName})`,
     `Получить награды`,
     `Прокачаться (${progName})`,
   ],
   ```
   Здесь `${combatName}` в скобках как уточнение, не как глагол.

4. **Унифицировать все 3 core loop template** на русский язык. Сейчас 3 шаблона: "Core Loop", "Combat-Focused Loop", "Progression-First Loop" — все на английском.

**Тест-кейсы**:
- `coreLoopCandidates[0].steps` — все шаги на одном языке (русский или английский, не смешаны).
- `coreLoopCandidates[0].steps` — нет существительных в позиции глаголов ("Engage in Броня" → "Вступить в бой (Броня)").
- `coreLoopCandidates[0].fun_check_reasoning` — на русском.

**Риски**:
- Frontend может рендерить шаги в markdown списке — изменение языка видимо пользователю. Митигация: язык приложения уже русский (UI labels на русском), так что это правильное поведение.

**Dependencies**: нет

---

### TASK-1.10: Починить `buildUSPCandidates` — slice boundaries, fallback для короткой идеи

**Сложность**: S
**Приоритет**: 🟢
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 378-402)

**Описание проблемы**:

`buildUSPCandidates` (route.ts:378-401):
```ts
const candidates = [
  {
    usp: `A ${genre} game where every decision reshapes the world — combining ${idea.slice(0, 60)}${idea.length > 60 ? "…" : ""} with emergent narrative consequences.`,
    // ...
  },
  {
    usp: `Hybrid ${genre} experience blending traditional mechanics with novel systems derived from "${idea.slice(0, 50)}${idea.length > 50 ? "…" : ""}".`,
    // ...
  },
  {
    usp: `Narrative-driven ${genre} where the core verb is "${lower.split(" ").slice(0, 2).join(" ")}" — players experience story through gameplay, not cutscenes.`,
    // ...
  },
];
```

Проблемы:
- Если idea = "Puzzle game" (11 chars): USP #1 → `combining Puzzle game with emergent narrative consequences` (нет "…", OK). USP #2 → `derived from "Puzzle game"` (нет "…", OK). USP #3 → `core verb is "puzzle game"` (тривиально).
- Если idea = "Test" (4 chars): USP #1 → `combining Test with emergent narrative consequences` (nonsense). USP #3 → `core verb is "test"` (1 слово).
- Если idea > 60 chars: USP #1 обрезается на 60. USP #2 обрезается на 50. Несогласованно.
- Все 3 USP на английском, тогда как `SYSTEM_PROMPT` и `desc` MechanicsDB на русском.

**Решение**:

1. **Локализовать USP шаблоны на русский**:
   ```ts
   const candidates = [
     {
       usp: `${genreLabel} — игра, где каждое решение меняет мир. Объединяет «${truncatedIdea}» с эмерджентными нарративными последствиями.`,
       triangle_of_weirdness_check: "pass" as const,
       competitive_differentiation: "Ни один конкурент не объединяет агентность игрока с перманентной мутацией мира в таком масштабе.",
     },
     {
       usp: `Гибридный ${genreLabel} опыт: традиционные механики + новые системы из «${truncatedIdeaShort}».`,
       triangle_of_weirdness_check: "warn" as const,
       competitive_differentiation: "Дифференциатор — механический синтез; похожие жанровые игры лишены этого гибридного слоя.",
     },
     {
       usp: `Нарративный ${genreLabel}, где корневой глагол — «${coreVerb}». Игрок проживает историю через геймплей, не через кат-сцены.`,
       triangle_of_weirdness_check: "pass" as const,
       competitive_differentiation: "Лудонарративная гармония создаёт уникальную идентичность vs. story-light конкурентов.",
     },
   ];
   ```

2. **Безопасное усечение**:
   ```ts
   const truncate = (s: string, max: number): string =>
     s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
   const truncatedIdea = truncate(idea, 80);
   const truncatedIdeaShort = truncate(idea, 60);
   ```

3. **Извлечение корневого глагола** — вместо `lower.split(" ").slice(0, 2).join(" ")` (произвольные 2 слова), найти первый глагол действия:
   ```ts
   const ACTION_VERBS = ["исследуй", "собирай", "сражайся", "строй", "выживай", "гоняй", "решай", "прыгай", "убегай", "торгуй"];
   const lowerIdea = idea.toLowerCase();
   const coreVerb = ACTION_VERBS.find(v => lowerIdea.includes(v))
     ?? lowerIdea.split(/\s+/)[0]   // fallback на первое слово
     ?? "играй";
   ```

4. **Лейбл жанра на русском** (маппинг genre → label):
   ```ts
   const GENRE_LABELS_RU: Record<string, string> = {
     rpg: "RPG",
     shooter: "шутер",
     strategy: "стратегия",
     puzzle: "головоломка",
     // ... использовать src/config/genres.ts GENRES labels
   };
   const genreLabel = GENRE_LABELS_RU[genre] ?? genre;
   ```

**Тест-кейсы**:
- Идея "Puzzle game" → USP #1: "Головоломка — игра, где каждое решение меняет мир. Объединяет «Puzzle game» с эмерджентными нарративными последствиями."
- Идея "Test" → USP #3: `core verb is "test"` → `корневой глагол — «test»`. (fallback на первое слово).
- Идея > 100 chars → все 3 USP обрезаются consistently (не 60 в одном, 50 в другом).
- Все 3 USP на русском.

**Риски**:
- LLM (use_ai=true) всё равно перезапишет USP — но это для deterministic fallback.

**Dependencies**: нет

---

### TASK-1.11: Persist `ai_insights`, `generation_metadata`, `title` в БД + исправить `result.id` inconsistency

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `prisma/schema.prisma` (модель `ProjectConcept`), `src/app/api/v1/concept/generate/route.ts` (строки 640-721), `src/app/api/v1/concept/[id]/route.ts`

**Описание проблемы**:

**11.1. `ai_insights` не персистится**: в `route.ts:636` `aiEnrichment.insights` попадает в `result.generation_metadata.ai_insights`, но в `onePagerData` JSON (route.ts:679-688) этого поля нет. При перезагрузке проекта через `GET /concept/[id]` ai_insights теряется.

**11.2. `generation_metadata` не персистится**: включает `stages_completed`, `latency_ms`, `models_used`, `ai_enriched`, `ai_insights` — теряется при перезагрузке.

**11.3. `title` не персистится**: `result.title = "Shadow_Depths — ROGUELIKE Concept"` (route.ts:642) — нигде не сохраняется. `GET /concept/[id]` не возвращает `title`.

**11.4. `result.id` inconsistency**: `generate` возвращает `id: proj.id` (project ID). `GET /concept/[id]` возвращает `id: c.id` (concept's own cuid). Frontend может ожидать один из них — несогласованно.

**Решение**:

1. **Добавить поля в Prisma schema** (`prisma/schema.prisma`, модель `ProjectConcept`):
   ```prisma
   model ProjectConcept {
     id                  String   @id @default(cuid())
     projectId           String   @unique
     genre               String?
     subgenre            String?
     title               String?   // ← NEW: result.title
     primaryAesthetic    String?
     usp                 String?
     inputData           String?
     onePagerData        String?
     aestheticProfile    String?
     dynamicsProfile     String?
     mechanicSet         String?
     validationReport    String?
     uspCandidates       String?
     coreLoopCandidates  String?
     generationMetadata  String?   // ← NEW: JSON { stages_completed, latency_ms, models_used, ai_enriched, ai_insights }
     createdAt           DateTime @default(now())
     updatedAt           DateTime @updatedAt
     // ... existing relations
   }
   ```

2. **Запустить миграцию**:
   ```bash
   cd /home/z/my-project/repos/Gidede
   bunx prisma migrate dev --name add_concept_title_metadata
   ```

3. **Сохранять `title` и `generationMetadata`** в route.ts:690-718:
   ```ts
   const generationMetadata = JSON.stringify({
     stages_completed: stagesCompleted,
     latency_ms: latencyMs,
     models_used: useAi && aiEnrichment.enriched
       ? ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite", "glm-4.6 (ai-enrichment)"]
       : ["deterministic-concept-v1", "rule-based-mda", "shell-lens-lite"],
     ai_enriched: aiEnrichment.enriched,
     ai_insights: aiEnrichment.insights || null,
   });

   await db.projectConcept.upsert({
     where: { projectId: proj.id },
     create: {
       projectId: proj.id,
       genre,
       title: result.title,            // ← NEW
       primaryAesthetic: aestheticProfile.primary,
       usp: uspCandidates[0]?.usp || null,
       inputData,
       onePagerData,
       aestheticProfile: JSON.stringify(aestheticProfile),
       dynamicsProfile: JSON.stringify(dynamicsProfile),
       mechanicSet: JSON.stringify(mechanicSet),
       validationReport: JSON.stringify(validationReport),
       uspCandidates: JSON.stringify(uspCandidates),
       coreLoopCandidates: JSON.stringify(coreLoopCandidates),
       generationMetadata,             // ← NEW
     },
     update: { /* same fields */ },
   });
   ```

4. **Вернуть `result.id = concept record id`** (не project ID). После upsert получить созданную/обновлённую запись:
   ```ts
   const savedConcept = await db.projectConcept.upsert({
     // ...
     select: { id: true },
   });
   const result = { id: savedConcept.id, ... };
   ```

5. **Обновить `GET /concept/[id]`** для возврата `title` и `generationMetadata`:
   ```ts
   return NextResponse.json({
     id: c.id,
     project_id: c.projectId,
     genre: c.genre,
     subgenre: c.subgenre,
     title: c.title,                          // ← NEW
     primary_aesthetic: c.primaryAesthetic,
     usp: c.usp,
     one_pager: safeJsonParse(c.onePagerData || "{}"),
     aesthetic_profile: safeJsonParse(c.aestheticProfile || "{}"),
     dynamics_profile: safeJsonParse(c.dynamicsProfile || "{}"),
     mechanic_set: safeJsonParse(c.mechanicSet || "{}"),
     validation_report: safeJsonParse(c.validationReport || "{}"),
     usp_candidates: safeJsonParse(c.uspCandidates || "[]"),
     core_loop_candidates: safeJsonParse(c.coreLoopCandidates || "[]"),
     input_data: safeJsonParse(c.inputData || "{}"),
     generation_metadata: safeJsonParse(c.generationMetadata || "{}"),  // ← NEW
     created_at: c.createdAt.toISOString(),
     updated_at: c.updatedAt.toISOString(),
   });
   ```

**Тест-кейсы**:
- POST `/concept/generate` с `use_ai=true` → response.id совпадает с GET `/concept/{id}` response.id.
- После generate + reload (GET), `generation_metadata.ai_insights` не теряется.
- После generate + reload, `title` присутствует.
- `bunx prisma migrate dev` проходит без ошибок.

**Риски**:
- Prisma миграция может потребовать reset DB в dev (sqlite). Митигация: `bunx prisma migrate dev` создаёт additive migration (новые nullable поля), не требует reset.
- Frontend может ломаться если ожидает `id` = project ID. Митигация: grep по кодовой базе — `response.id` используется в `pipeline.notify()` (route.ts:185) для `metadata: { concept_id: response.id }`. Это метаданные, не критично. Но лучше вернуть оба: `id: savedConcept.id, project_id: proj.id`.

**Dependencies**: нет

---

### TASK-1.12: Убрать китайские символы из `ai-service.ts` и `mechanics-db.ts`

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/lib/ai-service.ts` (строки 63, 333), `src/lib/mechanics-db.ts` (строка 293)

**Описание проблемы**:

**12.1. `ai-service.ts:63`** в `SYSTEM_PROMPT`:
```
7. Длина ответа: 100-400 слов,除非 пользователь просит подробнее.
```
`除非` (chúfēi) = "unless" — переводной артефакт. Должно быть "если только пользователь не просит подробнее".

**12.2. `ai-service.ts:333`** в `enrichGddSection` prompt:
```
Задача: перепиши и扩充 эту секцию, сделай её более подробной и профессиональной
```
`扩充` (kuòchōng) = "expand" — переводной артефакт. Должно быть "расширь".

**12.3. `mechanics-db.ts:293`** в `desc` для "Телепортация":
```
'Мгновенное перемещение между точками мира. Снижает摩擦 навигации и управляет темпом игры.'
```
`摩擦` (mócā) = "friction" — переводной артефакт. Должно быть "Снижает трение навигации".

**Решение**:

1. **`ai-service.ts:63`**: заменить
   ```ts
   7. Длина ответа: 100-400 слов, если только пользователь не просит подробнее.
   ```

2. **`ai-service.ts:333`**: заменить
   ```ts
   Задача: перепиши и расширь эту секцию, сделай её более подробной и профессиональной (150-250 слов, на русском). Сохрани суть, добавь конкретики.
   ```

3. **`mechanics-db.ts:293`**: заменить
   ```ts
   'desc': 'Мгновенное перемещение между точками мира. Снижает трение навигации и управляет темпом игры.'
   ```

4. **Проверить grep'ом** отсутствие других китайских символов:
   ```bash
   grep -rP '[\x{4e00}-\x{9fff}]' src/lib/ src/constants/ src/app/api/v1/
   ```
   Исправить все найденные.

**Тест-кейсы**:
- `grep -rP '[\x{4e00}-\x{9fff}]' src/lib/ai-service.ts src/lib/mechanics-db.ts` → 0 matches.
- LLM prompt не содержит непонятных символов.

**Риски**:
- Нет. Чисто косметическая правка.

**Dependencies**: нет

---

### TASK-1.13: Выровнять тип `MechanicSet` с реализацией (type bypass устранить)

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `shared/types/typescript/interfaces.ts` (строки 73-83), `src/app/api/v1/concept/generate/route.ts` (строки 257-305), `src/types/concept.ts`

**Описание проблемы**:

Shared type (`shared/types/typescript/interfaces.ts:73-83`):
```ts
export interface MechanicSet {
  base: string[];          // ← массив строк!
  combat: string[];
  progression: string[];
  spatial: string[];
  social: string[];
  total_count: number;
  conflicts_resolved: string[];
  synergies_detected: string[];
  compatibility_score: number;
}
```

Реализация в route.ts:257-305 возвращает:
```ts
categories.base: Array<{ name: string; group: string; desc?: string }>  // ← массив объектов!
```

Это type bypass — TypeScript не ловит несоответствие, потому что `result` в `ConceptGenerationResult.mechanic_set: Record<string, unknown> | null` (см. `src/types/concept.ts:38`).

Downstream blocks (Core Loop, MDA) получают `mechanicSet.base[0]` и ожидают либо string, либо object — несогласованно. Например, `buildCoreLoopCandidates` в route.ts:312 делает `mechanicSet.base[0]?.name` (ожидает object). Но Block 2 (CoreLoop) `src/app/api/v1/coreloop/design/route.ts` может ожидать string.

**Решение**:

1. **Обновить shared type** на структурированный формат (более информативный):
   ```ts
   export interface MechanicEntry {
     name: string;
     group: string;
     desc?: string;
   }

   export interface MechanicSet {
     base: MechanicEntry[];
     combat: MechanicEntry[];
     progression: MechanicEntry[];
     spatial: MechanicEntry[];
     social: MechanicEntry[];
     total_count: number;
     conflicts_resolved: string[];
     synergies_detected: Array<{ name: string; score: number }>;
     compatibility_score: number;
     mechanics_db_source?: string;
   }
   ```

2. **Обновить `ConceptGenerationResult.mechanic_set`** в `src/types/concept.ts:38`:
   ```ts
   import type { MechanicSet } from "../../shared/types/typescript/interfaces";
   export interface ConceptGenerationResult {
     // ...
     mechanic_set: MechanicSet | null;   // ← вместо Record<string, unknown> | null
     // ...
   }
   ```

3. **Проверить downstream consumers** (Block 2, 3, 6):
   - `src/app/api/v1/coreloop/design/route.ts` — если он читает `mechanicSet.base[0]` как string, нужно обновить на `.name`.
   - `src/app/api/v1/mda/analyze/route.ts` — аналогично.
   - `src/app/api/v1/gdd/generate/route.ts` — если использует mechanic names.

4. **Альтернатива (минимально инвазивная)**: оставить `base: string[]` в shared type, но в route.ts маппить `{name, group, desc}` → `name` (просто строка):
   ```ts
   categories[cat] = mechanics.map(m => m.name);   // ← только имя
   ```
   Но тогда теряется `group` и `desc` информация для UI. Лучше первое решение.

**Тест-кейсы**:
- TypeScript компилируется без `as unknown as` cast для mechanicSet.
- `mechanic_set.base[0].name` возвращает строку, `mechanic_set.base[0].group` возвращает группу, `mechanic_set.base[0].desc` возвращает описание.
- Block 2/3/6 корректно читают mechanic_set после изменения типа.

**Риски**:
- Downstream blocks могут ломаться. Митигация: grep по `mechanicSet.base` / `mechanic_set.base` / `mechanics.base` и обновить все consumer'ы.
- UI `MechanicSetView.tsx` может ожидать string вместо object — проверить и обновить.

**Dependencies**: нет (но влияет на другие блоки)

---

### TASK-1.14: Реализовать MechanicsDB Levels 0-2 (Shell 7, Adams/Dormans 5, 16 паттернов) — фундамент для top-down generation

**Сложность**: XL
**Приоритет**: 🟢 (стратегическое, не блокирует текущие баги)
**Файлы**: `src/lib/mechanics-db.ts` (новые экспорты), `src/app/api/v1/concept/generate/route.ts` (новая Stage 1.5)

**Описание проблемы**:

Bible 2.2.5 (строки 95-109) определяет 5-уровневую таксономию MechanicsDB:
- **Level 0**: 7 фундаментальных типов Шелла (Пространство, Время, Объекты, Действия, Правила, Навык, Шанс).
- **Level 1**: 5 структурных типов Адамса/Дорманса (Физика, Внутренняя экономика, Прогрессия, Тактическое маневрирование, Социальное взаимодействие).
- **Level 2**: 16+ паттернов дизайна (Static Engine, Dynamic Engine, Converter Engine, Engine Building, Static Friction, Dynamic Friction, Stopping Mechanism, Attrition, Escalating Challenge, Escalating Complexity, Arms Race, Play-Style Reinforcement, Multiple Feedback, Trade, Worker Placement, Slow Cycle).
- **Level 3**: 127 SW.BAND механик — реализовано (128 в коде, off-by-one).
- **Level 4**: жанровые шаблоны (Apple Catcher, Physics Launcher, SHMUP, Card Game, ...) — не реализовано.

Реализован только Level 3. Top-down generation principle (Bible 2.2.5): "система работает сверху вниз — от фундаментальных типов к дискретным механикам" — не соблюдён. Текущая генерация идёт bottom-up: genre → mechanics.

**Решение** ( phased approach):

**Phase 1 (этот цикл рефакторинга)**: добавить Levels 0-2 как справочники без интеграции в pipeline.

1. **Добавить `FUNDAMENTAL_TYPES`** (Level 0):
   ```ts
   export interface FundamentalType {
     id: string;          // "space", "time", "objects", "actions", "rules", "skill", "chance"
     name: string;        // "Пространство"
     desc: string;
     applies_to_genres: string[];   // какие жанры центральны для этого типа
   }
   export const FUNDAMENTAL_TYPES: FundamentalType[] = [
     { id: "space", name: "Пространство", desc: "...", applies_to_genres: ["platformer", "metroidvania", "racing"] },
     { id: "time", name: "Время", desc: "...", applies_to_genres: ["strategy", "puzzle"] },
     // ...
   ];
   ```

2. **Добавить `STRUCTURAL_TYPES`** (Level 1):
   ```ts
   export interface StructuralType {
     id: string;          // "physics", "economy", "progression", "tactical_maneuvering", "social"
     name: string;
     desc: string;
     fundamental_types: string[];   // link to Level 0
   }
   export const STRUCTURAL_TYPES: StructuralType[] = [ ... ];
   ```

3. **Добавить `DESIGN_PATTERNS`** (Level 2):
   ```ts
   export interface DesignPattern {
     id: string;          // "static_engine", "dynamic_engine", ...
     name: string;
     category: "engine" | "friction" | "escalation" | "other";
     desc: string;
     structural_type: string;       // link to Level 1
     machinations_notation?: string;
   }
   export const DESIGN_PATTERNS: DesignPattern[] = [ ... ];   // 16 паттернов
   ```

4. **Связать Level 3 механики с Level 2 паттернами** (опциональное поле `pattern_id` в `Mechanic`):
   ```ts
   export interface Mechanic {
     // ... existing
     pattern_id?: string;   // link to Level 2 design pattern
   }
   ```

**Phase 2 (отдельный цикл)**: интегрировать top-down generation в pipeline:
- Stage 1.5 (новая): определить релевантные fundamental types по жанру.
- Stage 1.6: выбрать доминирующий structural type.
- Stage 1.7: выбрать design patterns, поддерживающие dynamics.
- Stage 4 (обновить): фильтровать MechanicsDB по pattern_id + genre_affinity.

**Тест-кейсы**:
- `FUNDAMENTAL_TYPES.length === 7`.
- `STRUCTURAL_TYPES.length === 5`.
- `DESIGN_PATTERNS.length === 16`.
- `MECHANICS_DB.filter(m => m.pattern_id).length > 50` (большинство механик привязаны к паттерну).
- Новые экспорты не ломают существующий pipeline (они только добавлены, не используются).

**Риски**:
- Большой объём работы (16 паттернов с описаниями + маппинг 128 механик к паттернам). Митигация: разбить на подзадачи, делать постепенно.
- Без Phase 2 интеграции — dead code. Митигация: задокументировать в `REFACTOR_PLAN_block_1.md` как "подготовительный фундамент".

**Dependencies**: TASK-1.1 (для consistent genre_affinity)

---

### TASK-1.15: Добавить input validation + edge cases handling

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/concept/generate/route.ts` (строки 513-560), `src/lib/api-helpers.ts`

**Описание проблемы**:

Текущая валидация (route.ts:527-531):
```ts
if (!idea || idea.length < 10) {
  return VALIDATION_ERROR("Поле 'idea' обязательно и должно быть не менее 10 символов");
}
```

Edge cases не обработаны:
- **Очень длинная идея** (>5000 chars) — передаётся в LLM без обрезки, может превысить token limit.
- **Unknown genre** (явно передан `"genre": "battle_royale"`) — `GENRE_AESTHETICS["battle_royale"]` = undefined → `pickAesthetics` → `GENRE_AESTHETICS.default` = undefined → `base.primary` → TypeError.
- **Empty array `forbidden_mechanics: []`** — OK, передаётся как `[]`.
- **`forbidden_mechanics: ["Броня"]`** (русское имя) — `m.name.toLowerCase().includes("броня")` матчит — OK.
- **`forbidden_mechanics: ["armor"]`** (английское имя) — `m.name.toLowerCase().includes("armor")` НЕ матчит русские имена — silent skip.
- **`platform: "PC"`** (строка вместо массива) — `Array.isArray(body?.platform)` проверяет, fallback на null. OK.
- **`constraints: null`** — `body?.constraints` null → destructuring `{ team_size, budget }` from null → TypeError.
- **`use_ai: "true"` (string)** — обрабатывается `=== true || === "true"`. OK.
- **`use_ai: 1`** (number) — НЕ обрабатывается → fallback на deterministic. OK но неявно.
- **Special characters in idea** (HTML, SQL injection) — Prisma экранирует, но idea попадает в LLM prompt без sanitization.

**Решение**:

1. **Ограничить длину idea**:
   ```ts
   if (idea.length > 2000) {
     return VALIDATION_ERROR("Поле 'idea' не должно превышать 2000 символов");
   }
   ```

2. **Validate genre** against `GENRES` enum (из `src/config/genres.ts`):
   ```ts
   import { GENRES } from "@/config/genres";
   const validGenres = new Set(GENRES.map(g => g.value));
   if (explicitGenre && !validGenres.has(explicitGenre)) {
     return VALIDATION_ERROR(`Поле 'genre' должно быть одним из: ${Array.from(validGenres).join(", ")}`);
   }
   ```

3. **Defensive `pickAesthetics`** — fallback если genre не найден:
   ```ts
   function pickAesthetics(genre: string, idea: string): { primary: AestheticType; secondary: AestheticType; tertiary: AestheticType } {
     const base = GENRE_AESTHETICS[genre] ?? {
       primary: "challenge" as AestheticType,
       secondary: "discovery" as AestheticType,
       tertiary: "narrative" as AestheticType,
     };
     // ...
   }
   ```

4. **Sanitize `constraints`**:
   ```ts
   const constraints = body?.constraints && typeof body.constraints === "object"
     ? body.constraints as { team_size?: number; budget?: string }
     : null;
   ```

5. **Map english `forbidden_mechanics` to Russian** через словарь синонимов:
   ```ts
   const MECHANIC_ALIASES: Record<string, string> = {
     "armor": "Броня",
     "ammo": "Запас патронов",
     "cover": "Укрытия",
     "health": "Здоровье",
     "quest": "Квесты",
     "inventory": "Инвентарь",
     // ...
   };
   const normalizeMechanicName = (s: string): string =>
     MECHANIC_ALIASES[s.toLowerCase()] ?? s;
   const forbiddenNormalized = forbiddenMechanics.map(normalizeMechanicName);
   ```

6. **Sanitize idea for LLM** (strip HTML tags, limit to reasonable length):
   ```ts
   const sanitizeIdea = (s: string): string =>
     s.replace(/<[^>]*>/g, "").slice(0, 2000);
   const cleanIdea = sanitizeIdea(idea);
   ```

7. **Добавить `validateConceptInput`** helper в `src/lib/api-helpers.ts` для переиспользования:
   ```ts
   export function validateConceptInput(body: unknown): { ok: true; data: ConceptInput } | { ok: false; error: string } {
     // centralized validation
   }
   ```

**Тест-кейсы**:
- `idea: "x".repeat(3000)` → 422 "не должно превышать 2000 символов".
- `genre: "battle_royale"` → 422 с списком валидных жанров.
- `genre: "rpg"` → OK.
- `constraints: null` → не падает, fallback на null.
- `forbidden_mechanics: ["armor"]` → фильтрует "Броня" (через alias).
- `idea: "<script>alert('xss')</script>game"` → idea sanitized to "alert('xss')game" перед LLM.

**Риски**:
- Валидация жанра может отвергать пользовательские кастомные жанры. Митигация: разрешить `genre: "custom"` или оставить strict (Bible defines 29 genres — этого достаточно).

**Dependencies**: TASK-1.6 (для валидации aesthetic values)

---

### TASK-1.16: Написать unit + integration тесты для Блока 1

**Сложность**: L
**Приоритет**: 🟡
**Файлы**: `tests/block1/*.test.ts` (новая директория)

**Описание проблемы**:

В репозитории нет тестов для Блока 1. `scripts/run_pipeline_test.sh` — integration test, но он не покрывает edge cases и не проверяет конкретные значения метрик (только что endpoint возвращает 200).

**Решение**:

1. **Установить vitest** (если ещё нет):
   ```bash
   bun add -d vitest @vitest/coverage-v8
   ```

2. **Создать `tests/block1/mechanics-db.test.ts`**:
   ```ts
   import { describe, it, expect } from "vitest";
   import { MECHANICS_DB, findMechanicsByGenre, buildMechanicSetForGenre } from "@/lib/mechanics-db";

   describe("MechanicsDB", () => {
     it("has 128 mechanics", () => {
       expect(MECHANICS_DB.length).toBe(128);
     });

     it("all mechanics have non-empty genres after TASK-1.1", () => {
       const emptyGenres = MECHANICS_DB.filter(m => m.genres.length === 0);
       expect(emptyGenres.length).toBe(0);
     });

     it("all mechanics have genre_affinity after TASK-1.1", () => {
       const noAffinity = MECHANICS_DB.filter(m => !m.genre_affinity || Object.keys(m.genre_affinity).length === 0);
       expect(noAffinity.length).toBe(0);
     });

     it("findMechanicsByGenre('rpg') returns 20+ mechanics", () => {
       expect(findMechanicsByGenre("rpg").length).toBeGreaterThan(20);
     });

     it("findMechanicsByGenre('nonexistent') returns []", () => {
       expect(findMechanicsByGenre("nonexistent")).toEqual([]);
     });

     it("buildMechanicSetForGenre('rpg') returns compatibility_score > 50", () => {
       const result = buildMechanicSetForGenre("rpg");
       expect(result.compatibility_score).toBeGreaterThan(50);
       expect(result.total_count).toBeGreaterThanOrEqual(5);
     });

     it("buildMechanicSetForGenre respects forbidden_mechanics", () => {
       const result = buildMechanicSetForGenre("rpg", ["Очки опыта"]);
       const allMechanics = Object.values(result.groups).flat();
       expect(allMechanics.every(m => !m.name.includes("Очки опыта"))).toBe(true);
     });
   });
   ```

3. **Создать `tests/block1/concept-generate.test.ts`** — integration tests:
   ```ts
   import { describe, it, expect, beforeAll } from "vitest";
   // ... mock auth, db, ai-service

   describe("POST /api/v1/concept/generate", () => {
     it("rejects empty idea", async () => {
       const res = await POST(mockRequest({ idea: "" }));
       expect(res.status).toBe(422);
     });

     it("rejects idea < 10 chars", async () => {
       const res = await POST(mockRequest({ idea: "short" }));
       expect(res.status).toBe(422);
     });

     it("rejects idea > 2000 chars", async () => {
       const res = await POST(mockRequest({ idea: "x".repeat(2001) }));
       expect(res.status).toBe(422);
     });

     it("rejects unknown genre", async () => {
       const res = await POST(mockRequest({ idea: "test idea here", genre: "battle_royale" }));
       expect(res.status).toBe(422);
     });

     it("infers genre 'roguelike' from 'deck-building' keyword", async () => {
       const res = await POST(mockRequest({ idea: "deck-building roguelike card game" }));
       const data = await res.json();
       expect(data.genre).toBe("roguelike");
     });

     it("returns compatibility_score > 50 for RPG", async () => {
       const res = await POST(mockRequest({ idea: "Epic RPG with character leveling and quests", genre: "rpg" }));
       const data = await res.json();
       expect(data.mechanic_set.compatibility_score).toBeGreaterThan(50);
     });

     it("returns triangle_check.credible = true for RPG", async () => {
       const res = await POST(mockRequest({ idea: "Epic RPG", genre: "rpg" }));
       const data = await res.json();
       expect(data.validation_report.triangle_check.credible).toBe(true);
     });

     it("returns all 8 idea filters with scores in [0, 1]", async () => {
       const res = await POST(mockRequest({ idea: "test idea here" }));
       const data = await res.json();
       const filters = data.validation_report.eight_filters;
       expect(Object.keys(filters).length).toBe(8);
       for (const f of Object.values(filters)) {
         expect((f as any).score).toBeGreaterThanOrEqual(0);
         expect((f as any).score).toBeLessThanOrEqual(1);
       }
     });

     it("returns core_loop_candidates with Russian steps", async () => {
       const res = await POST(mockRequest({ idea: "RPG with deep combat", genre: "rpg" }));
       const data = await res.json();
       expect(data.core_loop_candidates[0].steps[0]).toMatch(/[А-Яа-я]/);  // содержит кириллицу
     });

     it("persists ai_insights when use_ai=true", async () => {
       // mock enrichConcept to return { ai_insights: "test insights" }
       const res = await POST(mockRequest({ idea: "test", use_ai: true }));
       const concept = await db.projectConcept.findUnique({ where: { projectId: "test" } });
       const meta = JSON.parse(concept.generationMetadata);
       expect(meta.ai_insights).toBe("test insights");
     });
   });
   ```

4. **Создать `tests/block1/concept-validate.test.ts`**:
   ```ts
   describe("POST /api/v1/concept/[id]/validate", () => {
     it("returns same schema as generate (overall_score 0-1)", async () => {
       // generate first, then validate, compare shapes
     });

     it("recomputes triangle_check based on current mechanicSet", async () => {
       // if mechanicSet was changed externally, validate should reflect it
     });
   });
   ```

5. **Добавить npm script** в `package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest",
     "test:coverage": "vitest run --coverage"
   }
   ```

6. **CI integration** — добавить в GitHub Actions (если есть) или pre-commit hook.

**Тест-кейсы** (мета-уровень):
- `bun run test` проходит без ошибок.
- Coverage ≥ 70% для `src/lib/mechanics-db.ts` и `src/app/api/v1/concept/generate/route.ts`.

**Риски**:
- Mocking auth + db + ai-service может быть сложным. Митигация: использовать `vitest-mock-extended` или ручные mock'и через `vi.mock()`.

**Dependencies**: TASK-1.1 - TASK-1.5 (тесты проверяют исправленное поведение)

---

## Сводная таблица задач

| ID | Название | Сложность | Приоритет | Dependencies |
|----|----------|-----------|-----------|--------------|
| TASK-1.1 | Заполнить genres + genre_affinity для 128 механик | XL | 🔴 | — |
| TASK-1.2 | Починить compatibility_score каскад | M | 🔴 | 1.1 |
| TASK-1.3 | Реализовать 8 idea filters с реальной логикой | L | 🟡 | 1.2, 1.6 |
| TASK-1.4 | Реализовать 5 core questions с реальной логикой | M | 🟡 | 1.2 |
| TASK-1.5 | Заменить STUB /concept/[id]/validate | M | 🔴 | 1.3, 1.4 |
| TASK-1.6 | Убрать невалидные эстетики competition/strategy | S | 🔴 | — |
| TASK-1.7 | Починить pickAesthetics + GENRE_KEYWORDS overlap | M | 🟡 | 1.6 |
| TASK-1.8 | Починить buildMechanicSetForGenre (5 категорий) | M | 🟡 | 1.1 |
| TASK-1.9 | Починить bilingual core loop candidates | M | 🟡 | — |
| TASK-1.10 | Починить buildUSPCandidates slice boundaries | S | 🟢 | — |
| TASK-1.11 | Persist ai_insights + generation_metadata + title | M | 🟡 | — |
| TASK-1.12 | Убрать китайские символы | S | 🟡 | — |
| TASK-1.13 | Выровнять тип MechanicSet | M | 🟡 | — |
| TASK-1.14 | MechanicsDB Levels 0-2 (стратегическое) | XL | 🟢 | 1.1 |
| TASK-1.15 | Input validation + edge cases | M | 🟡 | 1.6 |
| TASK-1.16 | Unit + integration тесты | L | 🟡 | 1.1-1.5 |

**Итого**: 16 задач (4 🔴 критичных, 9 🟡 средних, 3 🟢 низких; 3 S, 7 M, 3 L, 3 XL).

---

## Рекомендуемый порядок выполнения

### Sprint 1 (критичные баги — "починить детерминированный пайплайн")
1. TASK-1.12 (китайские символы) — S, 5 минут, быстрая победа.
2. TASK-1.6 (невалидные эстетики) — S, 30 минут, убирает `as unknown as string`.
3. TASK-1.1 (MechanicsDB genres) — XL, 4-8 часов, **главный блокер**.
4. TASK-1.2 (compatibility_score каскад) — M, 1 час, использует TASK-1.1.
5. TASK-1.5 (validate route реальный пересчёт) — M, 2 часа, использует улучшенные фильтры.

### Sprint 2 (улучшение качества метрик)
6. TASK-1.3 (8 idea filters) — L, 3-4 часа.
7. TASK-1.4 (5 core questions) — M, 1-2 часа.
8. TASK-1.7 (pickAesthetics + keywords) — M, 2 часа.
9. TASK-1.8 (buildMechanicSetForGenre 5 категорий) — M, 1 час.
10. TASK-1.9 (bilingual core loop) — M, 1 час.
11. TASK-1.10 (USP candidates) — S, 30 минут.

### Sprint 3 (persistence + типы + валидация)
12. TASK-1.11 (persist ai_insights + title) — M, 2 часа (включая Prisma миграцию).
13. TASK-1.13 (MechanicSet тип) — M, 2 часа (включая downstream fixes).
14. TASK-1.15 (input validation) — M, 1-2 часа.

### Sprint 4 (стратегическое + тесты)
15. TASK-1.16 (тесты) — L, 4-6 часов.
16. TASK-1.14 (MechanicsDB Levels 0-2) — XL, 8-16 часов (отдельный цикл).

**Общая оценка**: 30-50 часов работы (без TASK-1.14), 50-70 часов (с TASK-1.14).

---

## Ожидаемый результат после рефакторинга

1. **`compatibility_score`** в диапазоне 50-95 для всех test_projects (вместо 0).
2. **`triangle_check.credible = true`** для 7+ из 10 test_projects (вместо 0/10).
3. **`eight_filters.feasibility.score`** в диапазоне 0.5-0.9 (вместо всегда 0.5).
4. **`five_questions`** — 4-5 из 5 возвращают `true` для качественной идеи (вместо всегда 3/5).
5. **`/concept/[id]/validate`** возвращает ту же schema что `/concept/generate`.
6. **`mechanic_set`** — все 5 категорий заполнены русскими именами из MechanicsDB.
7. **`core_loop_candidates`** — шаги на одном языке (русский), без "Engage in Броня".
8. **`ai_insights`** персистится в БД, переживает перезагрузку.
9. **TypeScript** компилируется без `as unknown as string` cast.
10. **Tests** покрывают ≥ 70% кода Блока 1.

---

## Open questions (для обсуждения с командой)

1. **Сколько жанров покрывать в `genre_affinity`?** Минимум 10 (ТЗ) или все 29 из `GENRES`? Больше жанров → больше работы, но точнее фильтрация.
2. **Расширять ли `MechanicSet` тип на `MechanicEntry[]`?** Это сломает downstream blocks (2, 3, 6). Альтернатива: оставить `string[]` и терять `desc`/`group`.
3. **Локализовать ли core loop / USP на русский?** Сейчас английский, но `SYSTEM_PROMPT` AI и `desc` MechanicsDB — русский. Несогласованно.
4. **Реализовывать ли TASK-1.14 (Levels 0-2) в этом цикле?** Это стратегический долг — не блокирует текущие баги, но нужен для Bible compliance.
5. **Добавлять ли `genre_affinity` через LLM-генерацию или вручную?** LLM быстрее, но может дать неточные оценки; вручную дольше, но точнее. Рекомендация: гибрид — LLM draft + ручной review.
