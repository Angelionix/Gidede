# Рефакторинг Блока 6 — GDD Generator (алгоритм 3.7)

**Версия плана**: 1.0
**Дата**: 2026-08-02
**Автор**: refactor-plan-block-6 (sub-agent)
**Связанные документы**:
- `docs/audit/AUDIT_REPORT.md` (раздел 6)
- `docs/bible/bible_2_11_gdd_templates_checklists.md` (782 строки, разделы 11.3.3 / 11.3.4 / 11.6)
- `docs/audit/REFACTOR_PLAN_block_1.md`, `_block_2.md`, `_block_3.md`, `_block_4.md`, `_block_5a.md`, `_block_5b.md`

**Объект рефакторинга**:
- `src/app/api/v1/gdd/generate/route.ts` (1065 строк) — главный route
- `src/app/api/v1/gdd/generate-full/route.ts` (61 строка) — STUB (4 fake stages)
- `src/app/api/v1/gdd/auto-fill/route.ts` (65 строк) — dead endpoint, несовместимые имена
- `src/app/api/v1/gdd/map/route.ts` (59 строк) — dead endpoint, hardcoded mapping
- `src/app/api/v1/gdd/format/route.ts` (60 строк) — dead endpoint, несовместимые форматы
- `src/app/api/v1/gdd/checklist/route.ts` (121 строка) — STUB, не вызывает `checklist-logic.ts`
- `src/app/api/v1/gdd/export/route.ts` (320 строк) — PDF fallback обрезает до 4000 символов
- `src/lib/ai-service.ts` (строки 304-357 `enrichGddSection` — dead code; 684-715 `enrichGdd`)
- `src/types/gdd.ts` (185 строк)
- `src/constants/gdd.ts` (37 строк)
- `prisma/schema.prisma` (модель `ProjectGDD`, строки 285-304)
- `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (StageDef для GDD, строки 154-168)
- `scripts/run_pipeline_test.sh` (строки 134-164 — GDD stage)

---

## Контекст

Блок 6 (GDD Generator) — финальная стадия пайплайна Gidede. Принимает
`{ target_format, detail_level, target_audience_doc, project_stage, language, custom_sections, excluded_sections, use_ai, project_id }`
и выполняет 6 стадий:

1. **Section catalogue**: `FORMAT_SECTIONS[targetFormat]` — 8 форматов × 6-21 секций.
2. **Section mappings / readiness**: для каждой секции вызывается `deriveSectionContent()`,
   возвращающая `{ content, source: "auto_fill" | "ai_generate" | "ai_enrich" | "manual", requires_review }`.
3. **Auto-filled sections**: второй вызов `deriveSectionContent()` (повторно!) с
   adjust по DETAIL_FACTOR.
4. **AI enriched / generated buckets**: группировка по `source` без вызова AI per-section.
5. **Manual skeletons**: priority critical/important/optional по hardcoded условию.
6. **Assembled document**: `assembledSections[]` + `consistencyReport` + `formattedDocument.markdown`.

Затем persist в `db.projectGDD.upsert` → optional `enrichGdd()` (ПОСЛЕ persist) → POST response.

**Подтверждённые дефекты** (проверены на всех 10 test_projects):

- **Все 10 test_projects производят ИДЕНТИЧНЫЙ narrative контент** в `07_gdd.json`.
  Подтверждено: `narrative` секция содержит один и тот же JSON
  `{"result":"Гармония","description":"Механики и нарратив согласованно выражают эстетику \"challenge\"."}`
  для всех 10 проектов (10 разных жанров: rpg/tower_defense/rhythm/puzzle/metroidvania/strategy/horror/shooter/action/racing).
  Root cause: `deriveSectionContent` (route.ts:481-506) для всех 8 narrative кейсов
  возвращает один и тот же `JSON.stringify(mda.ludonarrativeCheck)`. Block 3
  также дублирует ludonarrativeCheck для всех 10 проектов (отдельная проблема
  Block 3, см. REFACTOR_PLAN_block_3.md), но Block 6 **дополнительно** игнорирует
  semantic diff между "characters" / "world_overview" / "plot_arcs" / etc.

- **Все 10 test_projects имеют format = "full_gdd"** (вместо "one_sheet" как
  заявлено в `run_pipeline_test.sh:138`). Pipeline runner отправляет
  `{format: "one_sheet", use_ai: true}`, но route.ts:689 читает `body.target_format`
  (НЕ `body.format`) → fallback к default "full_gdd". Та же ошибка в
  `run-full-pipeline/route.ts:158-161`: отправляет `{format: i.format}`.

- **`/gdd/checklist` — STUB, не вызывает `lib/checklist-logic.ts`**.
  Подтверждено в `08_checklist.json` всех 10 проектов:
  - Все 10 имеют ИДЕНТИЧНЫЙ `overall_score=53`, `readiness_level="review"`.
  - Все scores — целые 80/0/40/70/75 (`mda_check=80`, `balance_check=0`,
    `economy_check=40`, `narrative_check=70`, `lens_check=75`).
  - STUB просто проверяет наличие полей в DB, не выполняет реальных проверок.
  - Богатая реализация `lib/checklist-logic.ts` (743 строки, 5 check-functions)
    фактически dead code в production pipeline.

- **`FORMAT_SECTIONS["full_gdd"]` имеет 21 секцию вместо 38** (Bible 11.3.3).
  Подтверждено: missing 30 Bible секций (overview, genre_and_platform, uniqueness,
  license_ip, controls, camera_perspective, difficulty, game_modes, characters,
  plot, dialogues, quests, lore_and_world, world_structure, level_design,
  navigation, combat_spaces, resources, tech_tree, difficulty_curve, hud_ui,
  menus_navigation, visual_style, sound_and_music, modes, social_features,
  meta_game, tech_requirements, platform_and_ports, milestones_and_budget).

- **`FORMAT_SECTIONS["modular"]` имеет 10 секций вместо 13** (Bible 11.3.4).
  Подтверждено: missing M-04 Balance Spec, M-08 Level Design Spec, M-09 UI/UX Spec,
  M-11 Audio Bible, M-12 Monetization Spec, M-13 Production Plan (6 модулей).
  Дополнительно в code есть `tech_bible` и `live_ops_plan`, не существующие
  в Bible 11.3.4 (несоответствие спецификации).

- **`/gdd/auto-fill`, `/gdd/map`, `/gdd/format`, `/gdd/generate-full` — dead endpoints**
  (не вызываются ни из frontend, ни из pipeline runner, ни из других route).
  `/gdd/auto-fill` возвращает `{title, genre, synopsis, gameplay, features, ...}`
  — имена полей НЕ совпадают с именами секций в `FORMAT_SECTIONS` (там
  `title`, `concept`, `usp`, `core_loop_summary`).
  `/gdd/map` возвращает hardcoded mapping 13 секций — не инспектирует actual available data.
  `/gdd/format` возвращает incompatible список 38 секций (33 имени, не 38) с
  `appendix_a/b/c`, `glossary`, `references`, `change_log` — НЕ совпадает с
  Bible 11.3.3 (38 секций в 8 блоках) и с `FORMAT_SECTIONS["full_gdd"]` (21 секция).

- **`ai_insights` НЕ сохраняется в БД**. Route persist на строках 991-1042
  сохраняет `fullProfile: JSON.stringify(profile)` ДО того, как `enrichGdd()`
  добавит `profile.ai_insights` (строки 1047-1058). Таким образом, в DB
  `fullProfile` не содержит `ai_insights`. Подтверждено: AI insights видны
  только в прямом POST response (как в `07_gdd.json` test_projects),
  но теряются при повторном чтении из DB.

- **`deriveSectionContent` вызывается ДВАЖДЫ** для каждой секции (строки 746
  и 800) — без caching. O(2N) для полного GDD из 21 секции = 42 вызова.
  Для будущего 38 секций = 76 вызовов.

- **`enrichGddSection` — dead code** (ai-service.ts:318-357). Объявлена, но
  не импортирована ни из одного файла. Содержит китайский символ `扩充`
  (строка 333) — переводной артефакт из оригинального китайского prompt.

- **`has_formulas` regex матчит любой `=`** (route.ts:897):
  ```ts
  const hasFormulas = /=|∑|∫|≤|≥/.test(v.content) && v.content.length > 0;
  ```
  Если секция содержит `=` (base64 padding, code snippet `const x = ...`,
  RPG stats `HP=100`, color comparison `red = danger`) → флаг
  `has_formulas: true` — false positive. Подтверждено в тестах regex:
  matches=True для всех 7 строк с `=` (даже "Color: red = danger").

- **`mdToPdfLike` fallback обрезает контент до 4000 символов**
  (export/route.ts:95):
  ```ts
  const contentStream = `BT /F1 10 Tf 50 800 Td (${escapedText.slice(0, 4000)}) Tj ET`;
  ```
  Для GDD на 50 страниц (~25 000 слов, ~150 000 символов) обрезает 97% контента.
  Real PDF через Playwright (`generateRealPdf`) обычно срабатывает, но fallback
  ломает длинные GDD.

- **`buildConsistencyReport` имеет только 3 типа checks** (route.ts:609-665):
  1. `requires_review` → warning
  2. `content.length < 20` → info
  3. Hardcoded pair checks (`core_loop`+`mechanics`, `aesthetics`+`narrative`)
  Bible 11.6 требует 10 уровней Universal Design Validator с ~80+ checks.
  Никаких проверок формул, длительности, типа баланса, патологий, USP и т.д.

- **Universal Design Validator (Bible 11.6, 10 уровней) — НЕ реализован**:
  - Level 1 (Concept validation): 8 фильтров Шелла — нет.
  - Level 2 (Mechanics validation): 6 эвристик Аптона — нет.
  - Level 3 (Core Loop validation): 5 вопросов Гэри — нет.
  - Level 4 (Balance validation): 7-point Rolling/Morris checklist — нет.
  - Level 5 (Economy & Progression): faucet/drain, pathologies — нет.
  - Level 6 (Narrative): ludonarrative dissonance — частично (через MDA Block 3).
  - Level 7 (Level Design): 7 методов Бонд — нет.
  - Level 8 (Experience): 5 убийц удовольствия Фуллертон — нет.
  - Level 9 (Interface): 6 принципов UI — нет.
  - Level 10 (Documentation): полнота 38 секций — нет.

- **`stages_completed: [1, 2, 3, 4, 5, 6]` hardcoded** (route.ts:958) — не отражает
  actual pipeline state.

- **`models_used: ["deterministic-gdd-v1", "section-assembler-v1", "consistency-checker-v1"]`**
  hardcoded (route.ts:983-987) — три "model" имена, которые не соответствуют
  actual code modules.

- **Coverage score формула вводит в заблуждение** (route.ts:779):
  ```ts
  const coverageScore = autoFillable.length / Math.max(1, sectionsList.length);
  ```
  Считает только `auto_fill` секции как "covered", не считая `ai_enrich` (которые
  реально наполнены контентом из mda.ludonarrativeCheck). Для full_gdd из 21 секции
  с 12 auto_fill → coverage=0.571 (подтверждено во всех 10 test_projects).
  Но фактическая coverage должна учитывать и `ai_enrich`.

- **`GDDProfile` TypeScript type** (src/types/gdd.ts:87-128) указывает
  `ai_enriched_sections` опциональным (`?`) и не описывает `ai_insights` /
  `models_used` — но route.ts их возвращает. Type mismatch.

- **Prisma schema `ProjectGDD`** (prisma/schema.prisma:285-304) НЕ имеет
  полей `aiInsights`, `modelsUsed`, `consistencyReport`, `targetStage`,
  `lastUpdated` — Bible 11.9 требует tracking "возраста" каждой секции
  (living documentation). Поле `visualElements: String?` объявлено, но
  route.ts сохраняет туда `JSON.stringify({})` (пустой объект).

---

## Цели рефакторинга

1. **Расширить `FORMAT_SECTIONS["full_gdd"]` до 38 секций** по Bible 11.3.3
   (8 блоков × ~5 секций), добавить `deriveSectionContent` cases для всех
   17 missing (controls, camera, game_modes, characters, plot, dialogues,
   quests, lore_and_world, world_structure, level_design, navigation,
   combat_spaces, resources, tech_tree, hud_ui, menus_navigation, visual_style,
   sound_and_music, modes, social_features, meta_game, tech_requirements,
   platform_and_ports, milestones_and_budget, license_ip, difficulty,
   difficulty_curve, uniqueness, overview, genre_and_platform).
2. **Расширить `FORMAT_SECTIONS["modular"]` до 13 модулей** по Bible 11.3.4
   (M-01..M-13), убрать `tech_bible` и `live_ops_plan` (not in Bible).
3. **Реализовать `deriveSectionContent` для 8 narrative секций отдельно**
   (characters / world_overview / plot_arcs / themes / tone_voice /
   story_mechanics / branching_structure / narrative) — каждая со своим
   semantic extraction из upstream data (concept.onePagerData, mda.bondValidation,
   mda.ludonarrativeCheck, concept.validationReport).
4. **Починить field name mismatch** в pipeline runner: `format` → `target_format`
   (или обратно — обновить route.ts для чтения обоих).
5. **Заменить STUB `/gdd/checklist` на вызов `lib/checklist-logic.ts`** —
   реальная валидация с 5+ check-functions вместо 5 integer scores.
6. **Реализовать Universal Design Validator (Bible 11.6)** — 10 уровней
   валидации с адаптивной приоритизацией по жанру (Bible 11.6.2).
7. **Удалить dead code `enrichGddSection`** (или вызвать её per-section для
   реального AI enrichment, заменив misleading labels `ai_enriched_sections` /
   `generated_sections`).
8. **Перенести `enrichGdd()` ДО persist** (как в Block 2), чтобы `ai_insights`
   сохранялся в БД. Расширить Prisma `ProjectGDD` полями `aiInsights`,
   `modelsUsed`.
9. **Cache `deriveSectionContent`** — вызвать один раз per section (не дважды).
10. **Починить `has_formulas` regex** — требовать math context (`/\b\w+\s*=\s*\d/`
    или `/f\(.+\)\s*=/`), а не одиночный `=`.
11. **Починить `mdToPdfLike` fallback** — paginate или использовать реальный
    PDF library вместо обрезки до 4000 символов.
12. **Удалить или объединить dead endpoints** (`/gdd/auto-fill`, `/gdd/map`,
    `/gdd/format`, `/gdd/generate-full`) — либо вызвать из `/gdd/generate`
    как внутренние шаги, либо убрать полностью.
13. **Унифицировать `FORMAT_SECTIONS` между route.ts и format/route.ts** —
    единственный source of truth в `src/constants/gdd.ts`.
14. **Реализовать living documentation** (Bible 11.9) — tracking времени
    последнего обновления каждой секции, предупреждение об устаревших секциях.
15. **Расширить `buildConsistencyReport`** до real checks (USP exists,
    formula consistency, balance score correlation, progression curve
    coherence, etc.).
16. **Реальное `coverage_score`** — учитывать `auto_fill` + `ai_enrich` как covered.

---

## Карта серьёзности

| # | Находка | Серьёзность | Локация |
|---|---------|:-----------:|---------|
| 6.1 | 21 секция вместо 38 для full_gdd | 🔴 | `generate/route.ts:101-123` |
| 6.2 | 8 narrative секций возвращают один и тот же ludonarrativeCheck JSON | 🔴 | `generate/route.ts:481-506` |
| 6.3 | `/gdd/checklist` STUB, не вызывает `checklist-logic.ts` | 🔴 | `checklist/route.ts:25-82` |
| 6.4 | Pipeline runner отправляет `format` вместо `target_format` | 🔴 | `run-full-pipeline/route.ts:158-161`, `run_pipeline_test.sh:138` |
| 6.5 | `enrichGddSection` dead code + китайский символ `扩充` | 🔴 | `ai-service.ts:318-357` |
| 6.6 | `ai_insights` НЕ сохраняется в БД (persist до enrichment) | 🔴 | `generate/route.ts:991-1058` |
| 6.7 | `auto-fill`, `map`, `format`, `generate-full` — dead endpoints | 🔴 | 4 файла в `/gdd/` |
| 6.8 | Universal Design Validator (Bible 11.6, 10 уровней) НЕ реализован | 🔴 | `generate/route.ts:583-678` |
| 6.9 | Modular: 10 секций вместо 13; лишние `tech_bible`, `live_ops_plan` | 🟡 | `generate/route.ts:143-154` |
| 6.10 | `deriveSectionContent` вызывается ДВАЖДЫ (O(2N) без cache) | 🟡 | `generate/route.ts:746, 800` |
| 6.11 | `has_formulas` regex матчит любой `=` | 🟡 | `generate/route.ts:897` |
| 6.12 | `mdToPdfLike` обрезает контент до 4000 символов | 🟡 | `export/route.ts:95` |
| 6.13 | `coverage_score` не учитывает `ai_enrich` как covered | 🟡 | `generate/route.ts:779` |
| 6.14 | `stages_completed: [1,2,3,4,5,6]` hardcoded | 🟡 | `generate/route.ts:958` |
| 6.15 | `models_used` hardcoded 3 строковых идентификатора | 🟡 | `generate/route.ts:983-987` |
| 6.16 | `buildConsistencyReport` имеет только 3 типа checks | 🟡 | `generate/route.ts:583-678` |
| 6.17 | Prisma `ProjectGDD` не имеет `aiInsights`, `modelsUsed`, `lastUpdated` | 🟡 | `prisma/schema.prisma:285-304` |
| 6.18 | `visualElements` сохраняется как `{}` (пустой объект) | 🟡 | `generate/route.ts:1006, 1030` |
| 6.19 | Type `GDDProfile` (types/gdd.ts) не описывает `ai_insights`, `models_used` | 🟢 | `types/gdd.ts:87-128` |
| 6.20 | `/gdd/format` `generateSectionList("full")` имеет 33 имени, не 38 | 🟢 | `format/route.ts:42-60` |

---

## Задачи

### TASK-6.1: Расширить `FORMAT_SECTIONS["full_gdd"]` до 38 секций по Bible 11.3.3

**Сложность**: XL
**Приоритет**: 🔴 (блокирует TASK-6.3, TASK-6.5, TASK-6.8, TASK-6.16)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts`, `src/constants/gdd.ts` (новый `FULL_GDD_SECTIONS`), `src/types/gdd.ts`

**Описание проблемы**:

`FORMAT_SECTIONS["full_gdd"]` (route.ts:101-123) содержит 21 секцию:
```ts
full_gdd: [
  "title", "logline", "concept", "usp", "core_loop", "mechanics",
  "aesthetics", "balance", "progression", "economy", "narrative",
  "target_audience", "monetization", "platforms", "ux", "tech_stack",
  "art_style", "sound", "localization", "testing_plan", "risks",
],
```

Bible 11.3.3 требует 38 секций в 8 блоках (см. ASCII-диаграмму в Bible):
```
БЛОК 1: ОБЗОР ИГРЫ (1-6)
  1. Название игры       2. Обзор
  3. Жанр и платформа    4. Целевая аудитория
  5. Уникальность        6. Лицензия / IP
БЛОК 2: ГЕЙМПЛЕЙ (7-14)
  7. Core Loop           8. Управление
  9. Механики            10. Камера и перспектива
  11. Прогрессия         12. Баланс
  13. Сложность          14. Режимы игры
БЛОК 3: ПЕРСОНАЖИ И НАРРАТИВ (15-19)
  15. Персонажи          16. Сюжет
  17. Диалоги            18. Квесты
  19. Лор и мир
БЛОК 4: УРОВНИ И МИР (20-23)
  20. Структура мира     21. Дизайн уровней
  22. Навигация          23. Боевые пространства
БЛОК 5: ЭКОНОМИКА И ПРОГРЕССИЯ (24-27)
  24. Ресурсы            25. Экономика
  26. Дерево технологий  27. Кривая сложности
БЛОК 6: ИНТЕРФЕЙС И ВИЗУАЛ (28-31)
  28. HUD и UI           29. Меню и навигация
  30. Визуальный стиль   31. Звук и музыка
БЛОК 7: МУЛЬТИПЛЕЕР И СОЦИАЛЬ (32-34)
  32. Режимы             33. Социальные функции
  34. Мета-игра
БЛОК 8: ТЕХНИЧЕСКИЕ И БИЗНЕС (35-38)
  35. Технические требования  36. Платформа и порты
  37. Монетизация             38. Milestones и бюджет
```

Missing 17 секций (по аудиту): Управление, Камера, Режимы игры, Диалоги, Квесты,
Лор, Структура мира, Дизайн уровней, Навигация, Боевые пространства, Ресурсы,
Дерево технологий, HUD/UI, Меню, Визуальный стиль, Звук, Социальные, Мета-игра,
Тех. требования, Milestones.

Фактически missing 30 секций при канонической нумерации Bible (см. карту 6.1
выше) — потому что в code используются не-Bible имена (`aesthetics` вместо
`visual_style`, `narrative` вместо `plot+dialogues+lore_and_world`).

**Решение**:

1. **Создать канонический список в `src/constants/gdd.ts`**:
   ```ts
   export const FULL_GDD_SECTIONS_38: ReadonlyArray<{
     id: string;             // canonical machine name (snake_case)
     block: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
     bible_number: number;   // 1..38 (Bible 11.3.3)
     label_ru: string;
     label_en: string;
   }> = [
     // БЛОК 1: ОБЗОР ИГРЫ (1-6)
     { id: "title",                block: 1, bible_number: 1,  label_ru: "Название игры",     label_en: "Game Title" },
     { id: "overview",             block: 1, bible_number: 2,  label_ru: "Обзор",             label_en: "Overview" },
     { id: "genre_and_platform",   block: 1, bible_number: 3,  label_ru: "Жанр и платформа",  label_en: "Genre & Platform" },
     { id: "target_audience",      block: 1, bible_number: 4,  label_ru: "Целевая аудитория", label_en: "Target Audience" },
     { id: "usp",                  block: 1, bible_number: 5,  label_ru: "Уникальность",      label_en: "Unique Selling Proposition" },
     { id: "license_ip",           block: 1, bible_number: 6,  label_ru: "Лицензия / IP",     label_en: "License / IP" },
     // БЛОК 2: ГЕЙМПЛЕЙ (7-14)
     { id: "core_loop",            block: 2, bible_number: 7,  label_ru: "Core Loop",         label_en: "Core Loop" },
     { id: "controls",             block: 2, bible_number: 8,  label_ru: "Управление",        label_en: "Controls" },
     { id: "mechanics",            block: 2, bible_number: 9,  label_ru: "Механики",          label_en: "Mechanics" },
     { id: "camera_perspective",   block: 2, bible_number: 10, label_ru: "Камера и перспектива", label_en: "Camera & Perspective" },
     { id: "progression",          block: 2, bible_number: 11, label_ru: "Прогрессия",        label_en: "Progression" },
     { id: "balance",              block: 2, bible_number: 12, label_ru: "Баланс",            label_en: "Balance" },
     { id: "difficulty",           block: 2, bible_number: 13, label_ru: "Сложность",         label_en: "Difficulty" },
     { id: "game_modes",           block: 2, bible_number: 14, label_ru: "Режимы игры",       label_en: "Game Modes" },
     // БЛОК 3: ПЕРСОНАЖИ И НАРРАТИВ (15-19)
     { id: "characters",           block: 3, bible_number: 15, label_ru: "Персонажи",         label_en: "Characters" },
     { id: "plot",                 block: 3, bible_number: 16, label_ru: "Сюжет",             label_en: "Plot" },
     { id: "dialogues",            block: 3, bible_number: 17, label_ru: "Диалоги",           label_en: "Dialogues" },
     { id: "quests",               block: 3, bible_number: 18, label_ru: "Квесты",            label_en: "Quests" },
     { id: "lore_and_world",       block: 3, bible_number: 19, label_ru: "Лор и мир",         label_en: "Lore & World" },
     // БЛОК 4: УРОВНИ И МИР (20-23)
     { id: "world_structure",      block: 4, bible_number: 20, label_ru: "Структура мира",    label_en: "World Structure" },
     { id: "level_design",         block: 4, bible_number: 21, label_ru: "Дизайн уровней",    label_en: "Level Design" },
     { id: "navigation",           block: 4, bible_number: 22, label_ru: "Навигация",         label_en: "Navigation" },
     { id: "combat_spaces",        block: 4, bible_number: 23, label_ru: "Боевые пространства", label_en: "Combat Spaces" },
     // БЛОК 5: ЭКОНОМИКА И ПРОГРЕССИЯ (24-27)
     { id: "resources",            block: 5, bible_number: 24, label_ru: "Ресурсы",           label_en: "Resources" },
     { id: "economy",              block: 5, bible_number: 25, label_ru: "Экономика",         label_en: "Economy" },
     { id: "tech_tree",            block: 5, bible_number: 26, label_ru: "Дерево технологий", label_en: "Tech Tree" },
     { id: "difficulty_curve",     block: 5, bible_number: 27, label_ru: "Кривая сложности",  label_en: "Difficulty Curve" },
     // БЛОК 6: ИНТЕРФЕЙС И ВИЗУАЛ (28-31)
     { id: "hud_ui",               block: 6, bible_number: 28, label_ru: "HUD и UI",          label_en: "HUD & UI" },
     { id: "menus_navigation",     block: 6, bible_number: 29, label_ru: "Меню и навигация",  label_en: "Menus & Navigation" },
     { id: "visual_style",         block: 6, bible_number: 30, label_ru: "Визуальный стиль",  label_en: "Visual Style" },
     { id: "sound_and_music",      block: 6, bible_number: 31, label_ru: "Звук и музыка",     label_en: "Sound & Music" },
     // БЛОК 7: МУЛЬТИПЛЕЕР И СОЦИАЛЬ (32-34)
     { id: "modes",                block: 7, bible_number: 32, label_ru: "Режимы",            label_en: "Modes" },
     { id: "social_features",      block: 7, bible_number: 33, label_ru: "Социальные функции", label_en: "Social Features" },
     { id: "meta_game",            block: 7, bible_number: 34, label_ru: "Мета-игра",         label_en: "Meta Game" },
     // БЛОК 8: ТЕХНИЧЕСКИЕ И БИЗНЕС (35-38)
     { id: "tech_requirements",    block: 8, bible_number: 35, label_ru: "Технические требования", label_en: "Technical Requirements" },
     { id: "platform_and_ports",   block: 8, bible_number: 36, label_ru: "Платформа и порты", label_en: "Platform & Ports" },
     { id: "monetization",         block: 8, bible_number: 37, label_ru: "Монетизация",       label_en: "Monetization" },
     { id: "milestones_and_budget",block: 8, bible_number: 38, label_ru: "Milestones и бюджет", label_en: "Milestones & Budget" },
   ];

   export const FORMAT_SECTIONS_CANONICAL: Readonly<Record<string, string[]>> = {
     one_sheet: ["title", "logline", "genre_and_platform", "target_audience", "usp", "visual_hook"],
     ten_pager: [
       "title", "logline", "concept", "usp", "core_loop",
       "mechanics", "world_overview", "target_audience",
       "monetization", "milestones_and_budget", "risks", "team_fit",
     ],
     treatment: ["title", "logline", "concept", "usp", "market_position", "team_fit"],
     sketch_design: [
       "title", "core_loop", "mechanics", "balance",
       "progression", "level_design", "hud_ui", "world_overview",
     ],
     full_gdd: FULL_GDD_SECTIONS_38.map(s => s.id),
     concept_doc: [
       "title", "logline", "concept", "target_audience",
       "experience_goals", "usp", "competitive_landscape",
     ],
     narrative_bible: [
       "title", "world_overview", "characters", "plot_arcs",
       "themes", "tone_voice", "story_mechanics", "branching_structure",
     ],
     modular: [/* see TASK-6.2 */],
   };
   ```

2. **Импортировать в route.ts и заменить локальный `FORMAT_SECTIONS`**:
   ```ts
   import { FORMAT_SECTIONS_CANONICAL as FORMAT_SECTIONS } from "@/constants/gdd";
   ```

3. **Сохранить backward compat**: legacy имена (`aesthetics`, `art_style`,
   `narrative`, `tech_stack`, `sound`, `localization`, `testing_plan`, `risks`)
   оставить как aliases в `deriveSectionContent` (но canonical имена
   использовать в `FORMAT_SECTIONS`).

**Тест-кейсы**:
- `FORMAT_SECTIONS.full_gdd.length === 38` (после рефакторинга).
- `FORMAT_SECTIONS.full_gdd` включает `"license_ip"`, `"camera_perspective"`,
  `"game_modes"`, `"dialogues"`, `"quests"`, `"lore_and_world"`,
  `"world_structure"`, `"level_design"`, `"navigation"`, `"combat_spaces"`,
  `"resources"`, `"tech_tree"`, `"difficulty_curve"`, `"hud_ui"`,
  `"menus_navigation"`, `"visual_style"`, `"sound_and_music"`, `"modes"`,
  `"social_features"`, `"meta_game"`, `"tech_requirements"`,
  `"platform_and_ports"`, `"milestones_and_budget"`.
- Все 8 Bible блоков представлены (4-6 секций на блок).
- `deriveSectionContent("license_ip", ...)` возвращает meaningful content
  (например, "Оригинальная IP, без лицензий" — не placeholder).
- Запуск pipeline для 01_Shadow_Depths: `07_gdd.json.assembled_document.total_sections === 38`.
- Запуск pipeline для 06_Card_Lords: `07_gdd.json.assembled_document.total_sections === 38`.

**Риски**:
- **Сломать downstream consumers**: frontend `GDDPreview.tsx` и
  `GDDSectionEditor.tsx` могут ожидать старые имена секций. Митигация:
  сохранить aliases в switch case `deriveSectionContent` для
  `aesthetics` → `visual_style`, `narrative` → `plot+lore_and_world`,
  `tech_stack` → `tech_requirements`, `sound` → `sound_and_music`,
  `localization` → часть `tech_requirements`, `art_style` → `visual_style`.
- **Coverage score упадёт до ~20%** (38 секций × 12 auto_fill = 0.32), потому
  что многие секции ещё не имеют derive case. Митигация: параллельно
  реализовать TASK-6.3 (derive для всех 38 секций).
- **Markdown document станет огромным** (~50 страниц). Митигация: проверить
  TASK-6.12 (PDF pagination) и TASK-6.10 (cache).

**Dependencies**: нет (стартовая задача).

---

### TASK-6.2: Расширить `FORMAT_SECTIONS["modular"]` до 13 модулей M-01..M-13 по Bible 11.3.4

**Сложность**: M
**Приоритет**: 🔴 (после TASK-6.1)
**Файлы**: `src/constants/gdd.ts`, `src/app/api/v1/gdd/generate/route.ts`

**Описание проблемы**:

`FORMAT_SECTIONS["modular"]` (route.ts:143-154) содержит 10 секций:
```ts
modular: [
  "title", "overview", "core_loop", "mechanics", "progression",
  "economy", "narrative", "art_bible", "tech_bible", "live_ops_plan",
],
```

Bible 11.3.4 требует 13 модулей:
```
M-01: Concept Card (= One-Sheet)
M-02: Core Loop Diagram
M-03: Mechanics Bible
M-04: Balance Spec
M-05: Economy Spec
M-06: Progression Spec
M-07: Narrative Bible
M-08: Level Design Spec
M-09: UI/UX Spec
M-10: Art Bible
M-11: Audio Bible
M-12: Monetization Spec
M-13: Production Plan
```

Missing 6 модулей: M-04 Balance Spec, M-08 Level Design Spec, M-09 UI/UX Spec,
M-11 Audio Bible, M-12 Monetization Spec, M-13 Production Plan.

Дополнительно в code есть `tech_bible` и `live_ops_plan` — НЕ существующие
в Bible 11.3.4 (это ad-hoc дополнения, не основанные на спецификации).

**Решение**:

1. **Добавить константу `MODULAR_SECTIONS_13` в `src/constants/gdd.ts`**:
   ```ts
   export const MODULAR_SECTIONS_13: ReadonlyArray<{
     module_id: string;       // "M-01".."M-13"
     section_name: string;    // canonical snake_case
     title_ru: string;
     title_en: string;
     source_block: string;    // KB-XX reference
     auto_generated: boolean; // true if can be derived from upstream
   }> = [
     { module_id: "M-01", section_name: "concept_card",     title_ru: "Concept Card",        title_en: "Concept Card",       source_block: "KB-01", auto_generated: true },
     { module_id: "M-02", section_name: "core_loop_diagram",title_ru: "Core Loop Diagram",   title_en: "Core Loop Diagram",  source_block: "KB-07", auto_generated: true },
     { module_id: "M-03", section_name: "mechanics_bible",  title_ru: "Mechanics Bible",     title_en: "Mechanics Bible",    source_block: "KB-04", auto_generated: true },
     { module_id: "M-04", section_name: "balance_spec",     title_ru: "Balance Spec",        title_en: "Balance Spec",       source_block: "KB-08", auto_generated: true },
     { module_id: "M-05", section_name: "economy_spec",     title_ru: "Economy Spec",        title_en: "Economy Spec",       source_block: "KB-10", auto_generated: true },
     { module_id: "M-06", section_name: "progression_spec", title_ru: "Progression Spec",    title_en: "Progression Spec",   source_block: "KB-09", auto_generated: true },
     { module_id: "M-07", section_name: "narrative_bible",  title_ru: "Narrative Bible",     title_en: "Narrative Bible",    source_block: "KB-11", auto_generated: true },
     { module_id: "M-08", section_name: "level_design_spec",title_ru: "Level Design Spec",   title_en: "Level Design Spec",  source_block: "KB-12", auto_generated: false },
     { module_id: "M-09", section_name: "ui_ux_spec",       title_ru: "UI/UX Spec",          title_en: "UI/UX Spec",         source_block: "—",     auto_generated: false },
     { module_id: "M-10", section_name: "art_bible",        title_ru: "Art Bible",           title_en: "Art Bible",          source_block: "—",     auto_generated: false },
     { module_id: "M-11", section_name: "audio_bible",      title_ru: "Audio Bible",         title_en: "Audio Bible",        source_block: "—",     auto_generated: false },
     { module_id: "M-12", section_name: "monetization_spec",title_ru: "Monetization Spec",   title_en: "Monetization Spec",  source_block: "—",     auto_generated: true },
     { module_id: "M-13", section_name: "production_plan",  title_ru: "Production Plan",     title_en: "Production Plan",    source_block: "—",     auto_generated: false },
   ];

   // В FORMAT_SECTIONS_CANONICAL:
   modular: MODULAR_SECTIONS_13.map(m => m.section_name),
   ```

2. **Удалить `tech_bible` и `live_ops_plan`** из `FORMAT_SECTIONS["modular"]` —
   они не соответствуют Bible 11.3.4. Если эти концепты нужны для UI, вынести
   в отдельный optional раздел `supplementary_modules` (не в canonical list).

3. **Обновить `deriveSectionContent` cases**:
   - `mechanics_bible` → использует `concept.mechanicSet` (как текущий `mechanics`)
   - `balance_spec` → использует `balanceResult.fullResult` (как текущий `balance`)
   - `economy_spec` → использует `economy.fullProfile`
   - `progression_spec` → использует `progression.fullProfile`
   - `narrative_bible` → использует `mda.ludonarrativeCheck` + `concept.validationReport`
   - `level_design_spec` → placeholder (manual, требует level design data)
   - `ui_ux_spec` → placeholder (manual, требует UI mockups)
   - `audio_bible` → placeholder (manual)
   - `monetization_spec` → использует `economy.monetizationModel`
   - `production_plan` → placeholder (manual)

**Тест-кейсы**:
- `FORMAT_SECTIONS.modular.length === 13`.
- Все 13 модулей имеют `deriveSectionContent` case (return meaningful content или placeholder).
- `FORMAT_SECTIONS.modular` НЕ содержит `"tech_bible"` или `"live_ops_plan"`.
- Запуск pipeline с `format: "modular"`: `07_gdd.json.assembled_document.total_sections === 13`.

**Риски**:
- Frontend `GDDFormatSelector.tsx` может фильтровать modular секции по именам.
  Митигация: проверить и обновить frontend (out-of-scope этого плана, но отметить).

**Dependencies**: TASK-6.1.

---

### TASK-6.3: Реализовать `deriveSectionContent` для 8 narrative секций отдельно

**Сложность**: L
**Приоритет**: 🔴 (блокирует TASK-6.5, TASK-6.8)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 481-506)

**Описание проблемы**:

`deriveSectionContent` (route.ts:481-506) для всех 8 narrative кейсов
возвращает ОДНО и ТО ЖЕ:
```ts
case "narrative":
case "world_overview":
case "characters":
case "plot_arcs":
case "themes":
case "tone_voice":
case "story_mechanics":
case "branching_structure": {
  const ludonarrative = mda?.ludonarrativeCheck
    ? safeJsonParse<Record<string, unknown>>(mda.ludonarrativeCheck, {})
    : {};
  if (Object.keys(ludonarrative).length > 0) {
    return {
      content: `## ${sectionName}\n\n${JSON.stringify(ludonarrative, null, 2)}`,
      source: "ai_enrich",
      requires_review: true,
    };
  }
  return {
    content: isRu
      ? `Нарративный раздел «${sectionName}» для «${name}» требует ручного заполнения. Жанр: ${genre}.`
      : `Narrative section "${sectionName}" for "${name}" requires manual content. Genre: ${genre}.`,
    source: "manual",
    requires_review: true,
  };
}
```

Подтверждено в `07_gdd.json` всех 10 test_projects: `narrative` секция содержит
идентичный JSON:
```json
{
  "result": "Гармония",
  "description": "Механики и нарратив согласованно выражают эстетику \"challenge\".",
  "mechanic_narrative_pairs": [
    {"mechanic": "combat", "narrative": "main_conflict", "consistency": 0.85},
    {"mechanic": "progression", "narrative": "character_growth", "consistency": 0.78},
    {"mechanic": "exploration", "narrative": "world_discovery", "consistency": 0.72}
  ],
  "correction": "Усилить нарративные отсылки в боевых эпизодах для закрепления эстетики"
}
```

Это **один и тот же JSON для всех 10 жанров** (rpg/tower_defense/rhythm/puzzle/
metroidvania/strategy/horror/shooter/action/racing) — потому что Block 3
hardcoded ludonarrativeCheck (см. REFACTOR_PLAN_block_3.md). Но Block 6
дополнительно игнорирует semantic diff между секциями: "characters" должно
описывать персонажей, "world_overview" — мир, "plot_arcs" — сюжетные арки.

**Решение**:

Разделить switch case на 8 отдельных handlers, каждый со своим semantic
extraction:

```ts
case "narrative": {
  // Aggregate narrative summary from MDA ludonarrativeCheck + concept validationReport
  const ludonarrative = safeJsonParse<Record<string, unknown>>(
    mda?.ludonarrativeCheck || "{}", {}
  );
  const validationReport = safeJsonParse<Record<string, unknown>>(
    concept?.validationReport || "{}", {}
  );
  const usp = concept?.usp || "";
  const result = ludonarrative.result || "—";
  const description = ludonarrative.description || "";
  return {
    content: `## Narrative Summary\n\n**Ludonarrative verdict:** ${result}\n\n${description}\n\n**USP:** ${usp}`,
    source: ludonarrative.result ? "auto_fill" : "manual",
    requires_review: !ludonarrative.result,
  };
}

case "world_overview": {
  // Extract world setting from concept.onePagerData.story_synopsis + concept.subgenre
  const onePager = safeJsonParse<Record<string, unknown>>(
    concept?.onePagerData || "{}", {}
  );
  const storySynopsis = onePager.story_synopsis as string || "";
  const subgenre = concept?.subgenre || "";
  if (storySynopsis) {
    return {
      content: `## World Overview\n\n**Setting:** ${subgenre || genre}\n\n${storySynopsis}`,
      source: "auto_fill",
      requires_review: false,
    };
  }
  return {
    content: isRu
      ? `Описание мира «${name}» требует ручного заполнения. Жанр: ${genre}.`
      : `World overview of "${name}" requires manual content. Genre: ${genre}.`,
    source: "manual",
    requires_review: true,
  };
}

case "characters": {
  // Extract character info from mda.bondValidation (Bond matrix) + concept.validationReport
  const bondValidation = safeJsonParse<Record<string, unknown>>(
    mda?.bondValidation || "{}", {}
  );
  const characters = (bondValidation.characters as Array<Record<string, unknown>>) || [];
  if (characters.length > 0) {
    const charList = characters
      .map((c, i) => `${i + 1}. **${c.name || `Character ${i + 1}`}** — ${c.role || "—"} (motivation: ${c.motivation || "—"})`)
      .join("\n");
    return {
      content: `## Characters\n\n${charList}`,
      source: "auto_fill",
      requires_review: false,
    };
  }
  // Fallback: extract from concept USP
  return {
    content: isRu
      ? `Персонажи «${name}» требуют описания. USP: ${usp || "—"}.`
      : `Characters of "${name}" require description. USP: ${usp || "—"}.`,
    source: "manual",
    requires_review: true,
  };
}

case "plot_arcs": {
  // Extract plot structure from mda.ludonarrativeCheck.mechanic_narrative_pairs
  const ludonarrative = safeJsonParse<Record<string, unknown>>(
    mda?.ludonarrativeCheck || "{}", {}
  );
  const pairs = (ludonarrative.mechanic_narrative_pairs as Array<Record<string, unknown>>) || [];
  if (pairs.length > 0) {
    const arcList = pairs
      .map((p, i) => `### Arc ${i + 1}: ${p.narrative || "—"}\n- Linked mechanic: ${p.mechanic || "—"}\n- Consistency: ${p.consistency || "—"}`)
      .join("\n\n");
    return {
      content: `## Plot Arcs\n\n${arcList}`,
      source: "auto_fill",
      requires_review: false,
    };
  }
  return {
    content: isRu ? `Сюжетные арки «${name}» требуют ручного описания.` : `Plot arcs of "${name}" require manual content.`,
    source: "manual",
    requires_review: true,
  };
}

case "themes": {
  // Extract themes from concept.aestheticProfile (primary/secondary/tertiary aesthetics)
  const aestheticProfile = safeJsonParse<Record<string, unknown>>(
    concept?.aestheticProfile || "{}", {}
  );
  const primary = aestheticProfile.primary as string;
  const secondary = aestheticProfile.secondary as string;
  const tertiary = aestheticProfile.tertiary as string;
  if (primary) {
    return {
      content: `## Themes\n\n- **Primary theme:** ${primary}\n- **Secondary theme:** ${secondary || "—"}\n- **Tertiary theme:** ${tertiary || "—"}`,
      source: "auto_fill",
      requires_review: false,
    };
  }
  return {
    content: isRu ? `Темы «${name}» требуют определения.` : `Themes of "${name}" require definition.`,
    source: "manual",
    requires_review: true,
  };
}

case "tone_voice": {
  // Derive from genre + subgenre + primary aesthetic
  const primary = mda?.primaryAesthetic || concept?.primaryAesthetic || "—";
  const toneMap: Record<string, string> = {
    challenge: "серьёзный, требующий концентрации",
    discovery: "любопытный, исследовательский",
    fantasy: "атмосферный, погружающий",
    narrative: "эмоциональный, сюжетный",
    fellowship: "дружелюбный, кооперативный",
    sensation: "чувственный, эстетический",
    submission: "медитативный, релаксационный",
    expression: "творческий, самовыражение",
  };
  const tone = toneMap[primary] || "нейтральный";
  return {
    content: `## Tone & Voice\n\n**Primary aesthetic:** ${primary}\n**Tone:** ${tone}\n**Genre:** ${genre}${concept?.subgenre ? `, ${concept.subgenre}` : ""}`,
    source: "auto_fill",
    requires_review: false,
  };
}

case "story_mechanics": {
  // Extract narrative mechanics from mda.ludonarrativeCheck + core loop steps
  const ludonarrative = safeJsonParse<Record<string, unknown>>(
    mda?.ludonarrativeCheck || "{}", {}
  );
  const coreSteps = safeJsonParse<unknown[]>(
    coreLoop?.stepsData || "[]", []
  );
  const steps = Array.isArray(coreSteps)
    ? coreSteps.map((s, i) => `${i + 1}. ${typeof s === "object" ? JSON.stringify(s) : String(s)}`).join("\n")
    : String(coreSteps);
  const correction = ludonarrative.correction as string;
  return {
    content: `## Story Mechanics\n\n**Core loop steps:**\n${steps}\n\n${correction ? `**Ludonarrative correction:** ${correction}` : ""}`,
    source: "auto_fill",
    requires_review: false,
  };
}

case "branching_structure": {
  // Placeholder with explicit guidance
  return {
    content: isRu
      ? `## Branching Structure\n\nСтруктура ветвления сюжета требует ручного проектирования.\n\n**Жанр:** ${genre}\n**Тип нарратива:** [Embedded / Emergent / Гибрид]\n**Структура:** [Линейная / Ветвящаяся / Хабовая / Открытый мир / Симуляция]`
      : `## Branching Structure\n\nStory branching structure requires manual design.\n\n**Genre:** ${genre}\n**Narrative type:** [Embedded / Emergent / Hybrid]\n**Structure:** [Linear / Branching / Hub-based / Open world / Simulation]`,
    source: "manual",
    requires_review: true,
  };
}
```

**Тест-кейсы**:
- `deriveSectionContent("narrative", project01, "ru")` возвращает content с заголовком "## Narrative Summary", а не "## narrative" с JSON dump.
- `deriveSectionContent("characters", project01, "ru")` возвращает content с разделом "## Characters" (не дубликат narrative).
- `deriveSectionContent("world_overview", project01, "ru")` возвращает content с разделом "## World Overview".
- Сравнение 10 test_projects: 10 РАЗНЫХ narrative sections (по крайней мере,
  tone и USP должны отличаться).
- `07_gdd.json.assembled_document.sections.narrative.content` ≠
  `07_gdd.json.assembled_document.sections.characters.content` (если
  format=narrative_bible, обе секции присутствуют).

**Риски**:
- Block 3 (MDA) должен предоставлять `bondValidation.characters` — это поле
  может не существовать (Block 3 bug). Митигация: graceful fallback к
  placeholder, пометить как dependency от REFACTOR_PLAN_block_3.md.
- `concept.onePagerData.story_synopsis` может отсутствовать в текущей
  реализации Block 1. Митигация: fallback к `project.description`.

**Dependencies**: TASK-6.1 (canonical имена), REFACTOR_PLAN_block_3.md (bond
validation characters).

---

### TASK-6.4: Реализовать `deriveSectionContent` для 17 missing Bible секций (controls, camera, game_modes, etc.)

**Сложность**: XL
**Приоритет**: 🔴 (после TASK-6.1)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts`

**Описание проблемы**:

После TASK-6.1 в `FORMAT_SECTIONS["full_gdd"]` появятся 30 новых секций.
Все они попадут в default case (route.ts:574-580), возвращающий placeholder
"Section «X» is under construction" → coverage_score упадёт с 0.571 до ~0.25.

Нужно реализовать meaningful derive cases для всех 30 missing секций.
Логика derivation по upstream data:

| Section ID | Source data | Default content |
|---|---|---|
| `overview` | `project.description` + `concept.onePagerData.story_synopsis` | "## Overview\n\n{description}" |
| `genre_and_platform` | `project.genre` + `concept.onePagerData.platforms` | "## Genre & Platform\n\n- Genre: {genre}\n- Platforms: {platforms}" |
| `license_ip` | hardcoded "Оригинальная IP, без лицензий" | placeholder если нет поля в concept |
| `controls` | genre-specific defaults (из `GENRE_CONTROL_PRESETS`) | "## Controls\n\n{genre}-specific controls" |
| `camera_perspective` | genre-specific (2D side-scroller / 3D third-person / etc.) | genre-based default |
| `difficulty` | `progression.curves` (если есть) | "## Difficulty\n\nCurve: {curveType}" |
| `game_modes` | hardcoded "Single-player" если нет multiplayer | placeholder |
| `dialogues` | genre-based (narrative-heavy → required, action → optional) | placeholder |
| `quests` | `mda.ludonarrativeCheck.mechanic_narrative_pairs` → quest types | placeholder если нет |
| `lore_and_world` | `concept.onePagerData.story_synopsis` | placeholder |
| `world_structure` | genre-based (open-world / linear / hub) | placeholder |
| `level_design` | hardcoded "Linear with branching paths" | placeholder |
| `navigation` | genre-based (mini-map / waypoint / diegetic) | placeholder |
| `combat_spaces` | `balanceResult.elements` (если есть combat objects) | placeholder |
| `resources` | `economy.resourceModel` | auto-fill |
| `tech_tree` | `progression.tierModel` | auto-fill |
| `difficulty_curve` | `progression.curves` | auto-fill |
| `hud_ui` | genre-based HUD elements | placeholder |
| `menus_navigation` | genre-based menu structure | placeholder |
| `visual_style` | `concept.aestheticProfile` + `mda.primaryAesthetic` | auto-fill |
| `sound_and_music` | `mda.primaryAesthetic` → mood mapping | placeholder |
| `modes` | hardcoded "Single-player" если нет multiplayer | placeholder |
| `social_features` | `coreLoop.metaLoop` (если есть) | auto-fill |
| `meta_game` | `coreLoop.metaLoop` | auto-fill |
| `tech_requirements` | genre-based (2D/3D, web/desktop/console) | placeholder |
| `platform_and_ports` | `concept.onePagerData.platforms` | auto-fill |
| `milestones_and_budget` | `project_stage` → milestone template | placeholder |

**Решение**:

1. **Создать `GENRE_DERIVE_PRESETS` в `src/constants/gdd.ts`**:
   ```ts
   export const GENRE_CAMERA_PRESETS: Record<string, string> = {
     rpg: "3D third-person isometric or first-person",
     platformer: "2D side-scroller",
     shooter: "First-person or third-person over-the-shoulder",
     racing: "Third-person chase or first-person cockpit",
     fighting: "2D side-view, fixed camera",
     puzzle: "2D top-down or isometric",
     strategy: "Isometric or top-down",
     tower_defense: "Top-down or isometric",
     rhythm: "Fixed camera, scripted angles",
     metroidvania: "2D side-scroller",
     horror: "Over-the-shoulder or first-person",
     sandbox: "3D third-person or first-person",
     simulation: "Top-down or first-person",
   };

   export const GENRE_CONTROL_PRESETS: Record<string, string[]> = {
     rpg: ["Movement: WASD/Left stick", "Action: Space/A button", "Inventory: I/Menu button", "Map: M/View button"],
     shooter: ["Movement: WASD", "Aim: Mouse/Right stick", "Shoot: Left click/RT", "Reload: R/X button"],
     platformer: ["Move: Arrow keys/Left stick", "Jump: Space/A button", "Dash: Shift/B button"],
     // ... и т.д. для всех жанров
   };

   export const GENRE_HUD_PRESETS: Record<string, string[]> = {
     rpg: ["Health bar", "Mana bar", "Minimap", "Quest tracker", "Experience bar", "Action bar"],
     shooter: ["Health", "Ammo counter", "Crosshair", "Minimap", "Kill feed"],
     // ...
   };
   ```

2. **Реализовать derive cases** (по аналогии с существующими):
   ```ts
   case "controls": {
     const controls = GENRE_CONTROL_PRESETS[genre.toLowerCase()] || GENRE_CONTROL_PRESETS.default;
     return {
       content: `## Controls\n\n${controls.map((c, i) => `${i + 1}. ${c}`).join("\n")}`,
       source: "auto_fill",
       requires_review: false,
     };
   }

   case "camera_perspective": {
     const camera = GENRE_CAMERA_PRESETS[genre.toLowerCase()] || "To be determined";
     return {
       content: `## Camera & Perspective\n\n**Camera type:** ${camera}\n**Genre:** ${genre}`,
       source: "auto_fill",
       requires_review: false,
     };
   }

   case "resources": {
     if (economy?.resourceModel) {
       const resources = safeJsonParse<unknown[]>(economy.resourceModel, []);
       const resourceList = Array.isArray(resources)
         ? resources.map((r: any, i) => `${i + 1}. **${r.name || `Resource ${i + 1}`}** (${r.class || "—"}) — faucet: ${r.faucet || "—"}, drain: ${r.drain || "—"}`).join("\n")
         : String(resources);
       return {
         content: `## Resources\n\n${resourceList}`,
         source: "auto_fill",
         requires_review: false,
       };
     }
     return { content: placeholder, source: "manual", requires_review: true };
   }

   case "tech_tree": {
     if (progression?.tierModel) {
       const tiers = safeJsonParse<unknown[]>(progression.tierModel, []);
       const tierList = Array.isArray(tiers)
         ? tiers.map((t: any, i) => `### Tier ${i + 1}: ${t.name || "—"}\n- Unlocks: ${(t.unlocks || []).join(", ") || "—"}\n- Cost: ${t.cost || "—"}`).join("\n\n")
         : String(tiers);
       return {
         content: `## Tech Tree\n\n${tierList}`,
         source: "auto_fill",
         requires_review: false,
       };
     }
     return { content: placeholder, source: "manual", requires_review: true };
   }

   case "difficulty_curve": {
     if (progression?.curves) {
       const curves = safeJsonParse<Record<string, unknown>>(progression.curves, {});
       const curveType = progression.curveType || "—";
       const totalLevels = progression.totalLevels || "—";
       return {
         content: `## Difficulty Curve\n\n**Curve type:** ${curveType}\n**Total levels:** ${totalLevels}\n\n\`\`\`json\n${JSON.stringify(curves, null, 2)}\n\`\`\``,
         source: "auto_fill",
         requires_review: false,
       };
     }
     return { content: placeholder, source: "manual", requires_review: true };
   }

   case "hud_ui": {
     const hud = GENRE_HUD_PRESETS[genre.toLowerCase()] || ["Health bar", "Score"];
     return {
       content: `## HUD & UI\n\n**HUD elements:**\n${hud.map((h, i) => `${i + 1}. ${h}`).join("\n")}`,
       source: "auto_fill",
       requires_review: false,
     };
   }

   case "social_features": {
     const metaLoop = coreLoop?.metaLoop
       ? safeJsonParse<Record<string, unknown>>(coreLoop.metaLoop, {})
       : {};
     if (Object.keys(metaLoop).length > 0) {
       return {
         content: `## Social Features\n\nDerived from meta-loop:\n\n\`\`\`json\n${JSON.stringify(metaLoop, null, 2)}\n\`\`\``,
         source: "auto_fill",
         requires_review: false,
       };
     }
     return { content: placeholder, source: "manual", requires_review: true };
   }
   ```

3. **Аналогично для других секций**: `overview`, `genre_and_platform`,
   `license_ip`, `game_modes`, `dialogues`, `quests`, `lore_and_world`,
   `world_structure`, `level_design`, `navigation`, `combat_spaces`,
   `menus_navigation`, `visual_style`, `sound_and_music`, `modes`,
   `meta_game`, `tech_requirements`, `platform_and_ports`,
   `milestones_and_budget`.

**Тест-кейсы**:
- `deriveSectionContent("controls", project01, "ru")` для genre="rpg" возвращает content с "Movement: WASD/Left stick".
- `deriveSectionContent("camera_perspective", project01, "ru")` для genre="rpg" возвращает content с "3D third-person isometric or first-person".
- `deriveSectionContent("resources", project01, "ru")` возвращает content с конкретными ресурсами из economy.resourceModel (если есть).
- `deriveSectionContent("tech_tree", project01, "ru")` возвращает content с уровнями из progression.tierModel.
- `deriveSectionContent("hud_ui", project01, "ru")` для genre="rpg" возвращает HUD elements (Health bar, Mana bar, Minimap, etc.).
- Для 10 test_projects: 10 РАЗНЫХ `controls` секций (genre-specific).
- Coverage_score для 38 секций full_gdd: ≥ 0.65 (25+ auto_fill из 38).

**Риски**:
- `GENRE_CONTROL_PRESETS` должен покрывать все 15+ жанров. Митигация:
  использовать `default` fallback.
- `economy.resourceModel` и `progression.tierModel` могут быть пустыми
  (если Blocks 5a/5b не запускались). Митигация: graceful fallback к
  placeholder.

**Dependencies**: TASK-6.1.

---

### TASK-6.5: Починить pipeline runner: `format` → `target_format`

**Сложность**: S
**Приоритет**: 🔴 (блокирует корректное тестирование TASK-6.1, TASK-6.3, TASK-6.4)
**Файлы**: `src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts` (строки 154-162), `scripts/run_pipeline_test.sh` (строка 138), `src/app/api/v1/gdd/generate/route.ts` (строка 689)

**Описание проблемы**:

Pipeline runner (run-full-pipeline/route.ts:158-161):
```ts
{
  stage: "gdd",
  block_id: 6,
  endpoint: "/api/v1/gdd/generate",
  buildBody: (i) => ({
    format: i.format,        // ← WRONG: route reads `target_format`
    use_ai: i.useAi,
  }),
},
```

Test script (run_pipeline_test.sh:138):
```bash
-d "{\"project_id\":\"$PID\",\"format\":\"one_sheet\",\"use_ai\":true}" \
```

Route (generate/route.ts:689):
```ts
const targetFormat = body?.target_format?.toString().trim() || "full_gdd";
```

Подтверждено: `07_gdd.json.format_spec.format === "full_gdd"` для всех 10
test_projects, несмотря на то что в pipeline runner передаётся
`format: "one_sheet"`. Pipeline runner игнорируется.

**Решение**:

Вариант A (рекомендуемый) — обновить route.ts для чтения обоих полей:
```ts
const targetFormat = (body?.target_format || body?.format)?.toString().trim() || "full_gdd";
```

Вариант B — обновить pipeline runner и test script для использования
`target_format`:
```ts
// run-full-pipeline/route.ts
buildBody: (i) => ({
  target_format: i.format,
  use_ai: i.useAi,
}),
```

```bash
# run_pipeline_test.sh:138
-d "{\"project_id\":\"$PID\",\"target_format\":\"one_sheet\",\"use_ai\":true}" \
```

Рекомендую Вариант A — менее разрушительный, backward-compatible.

**Дополнительно**: валидировать что `i.format` входит в `VALID_FORMATS` в
pipeline runner (чтобы не передавать невалидные форматы):
```ts
// run-full-pipeline/route.ts
const VALID_GDD_FORMATS = ["one_sheet", "ten_pager", "treatment", "sketch_design", "full_gdd", "concept_doc", "narrative_bible", "modular"];
// ... в buildBody:
buildBody: (i) => ({
  target_format: VALID_GDD_FORMATS.includes(i.format) ? i.format : "full_gdd",
  use_ai: i.useAi,
}),
```

**Тест-кейсы**:
- Pipeline runner с `format: "one_sheet"` → `07_gdd.json.format_spec.format === "one_sheet"`.
- Pipeline runner с `format: "narrative_bible"` → `07_gdd.json.format_spec.format === "narrative_bible"`.
- Pipeline runner с `format: undefined` → `07_gdd.json.format_spec.format === "full_gdd"` (default).
- Pipeline runner с `format: "invalid"` → fallback к `"full_gdd"`.
- POST /gdd/generate с `{target_format: "one_sheet"}` → `format === "one_sheet"` (backward compat).
- POST /gdd/generate с `{format: "one_sheet"}` → `format === "one_sheet"` (new).

**Риски**:
- Если frontend отправляет `format` (а не `target_format`), текущий код уже
  silently fallback к `full_gdd`. После fix frontend получит другой формат —
  может сломать UI. Митигация: проверить frontend `GDDFormatSelector.tsx`
  (отправляет `target_format` или `format`? — нужно проверить).

**Dependencies**: нет.

---

### TASK-6.6: Заменить STUB `/gdd/checklist` на вызов `lib/checklist-logic.ts`

**Сложность**: M
**Приоритет**: 🔴 (блокирует TASK-6.8)
**Файлы**: `src/app/api/v1/gdd/checklist/route.ts` (121 строка → полная переработка)

**Описание проблемы**:

`/gdd/checklist/route.ts` (121 строка) — STUB:
```ts
checks.mda_check.score = project.mdaProfile ? 80 : 0
checks.balance_check.score = project.balanceResult?.overallBalanceScore || 0
checks.economy_check.score = hasPathology ? 40 : 80
checks.narrative_check.score = project.concept ? 70 : 0
checks.lens_check.score = project.mdaProfile ? 75 : 0
```

Просто проверяет существование полей в DB. Никакой реальной валидации.

Подтверждено в `08_checklist.json` всех 10 test_projects:
- Все 10 имеют ИДЕНТИЧНЫЙ `overall_score=53`, `readiness_level="review"`.
- Все scores целые 80/0/40/70/75.

При этом `lib/checklist-logic.ts` (743 строки) содержит реальную валидацию:
- `runMdaCheck` (3 правила): mechanicSet keys, overallMatch < 0.5, lensVal.overall_score < 0.6.
- `runBalanceCheck` (4 правила): overallBalanceScore, imbalanceCount > 3, pathologies > 0.
- `runNarrativeCheck` (3 правила): ludonarrative issues, USP exists, narrative_bible genre needs GDD.
- `runEconomyCheck` (3 правила): hasPathology, simResults.quality.overall_pass, stability_index < 0.5.
- `runLensCheck` (1 правило): iterate lensValidation.results, flag scores < 0.5.

**Решение**:

Полностью переписать `gdd/checklist/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server-auth";
import { db } from "@/lib/db";
import { UNAUTH, SERVER_ERROR, VALIDATION_ERROR, getOwnedProject } from "@/lib/api-helpers";
import { runChecklistValidation } from "@/lib/checklist-logic";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) return UNAUTH();
  try {
    const body = await request.json().catch(() => ({}));
    const projectId = body?.project_id?.toString().trim();
    const action = body?.action?.toString().trim() || "validate";
    if (!projectId) return VALIDATION_ERROR("project_id обязателен");

    const owned = await getOwnedProject(user, projectId);
    if (owned instanceof NextResponse) return owned;
    const project = owned.project;

    // Call the rich checklist implementation
    const result = await runChecklistValidation(project, action, {
      depth: body?.depth || "standard",
      checklistTypes: Array.isArray(body?.checklist_types) ? body.checklist_types : undefined,
    });

    // Persist to ProjectChecklist
    await db.projectChecklist.upsert({
      where: { projectId },
      create: {
        projectId,
        overallScore: result.summary?.overall_score ?? 0,
        readinessLevel: result.summary?.readiness ?? "not_ready",
        criticalIssueCount: result.issues?.filter((i: any) => i.severity === "error").length || 0,
        totalIssueCount: result.issues?.length || 0,
        mdaCheck: JSON.stringify(result.mda_check || {}),
        balanceCheck: JSON.stringify(result.balance_check || {}),
        narrativeCheck: JSON.stringify(result.narrative_check || {}),
        economyCheck: JSON.stringify(result.economy_check || {}),
        lensCheck: JSON.stringify(result.lens_check || {}),
        issues: JSON.stringify(result.issues || []),
        remediationPlan: JSON.stringify(result.remediation_plan || []),
        fullResults: JSON.stringify(result),
      },
      update: { /* same fields */ },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[gdd/checklist] error:", error);
    return SERVER_ERROR();
  }
}
```

**Тест-кейсы**:
- `08_checklist.json.overall_score` для 10 test_projects: 10 РАЗНЫХ значений
  (не все 53).
- `08_checklist.json.checks.mda_check.issues` содержит массив issues (не
  просто `passed` boolean + integer score).
- `08_checklist.json.summary.top_5_issues` содержит конкретные issues с
  description + suggestion.
- `08_checklist.json.remediation_plan` содержит actionable items.
- POST с `action: "mda-check"` возвращает профиль с только `mda_check`
  non-skipped.
- POST без `action` (default "validate") возвращает все 5 checks non-skipped.

**Риски**:
- `checklist-logic.ts:511-513` имеет hardcoded weights `0.3/0.3/0.3/0.1` —
  Bible 11.6.2 требует adaptive prioritization по жанру. Это отдельная задача
  (TASK-6.8). На данном этапе просто вызываем существующую логику.
- `runChecklistValidation` может быть медленной (5 checks × ~3 rules each).
  Митигация: timeout 30s, параллельное выполнение checks.
- Type mismatch: `checklist-logic.ts` возвращает `ChecklistResult`, а старый
  STUB возвращал другую структуру. Frontend `ChecklistPanel.tsx` должен
  адаптироваться. Митигация: проверить и обновить frontend.

**Dependencies**: нет (можно делать параллельно с TASK-6.1).

---

### TASK-6.7: Удалить dead code `enrichGddSection` или вызвать её per-section

**Сложность**: M
**Приоритет**: 🔴 (системная проблема S3)
**Файлы**: `src/lib/ai-service.ts` (строки 304-357), `src/app/api/v1/gdd/generate/route.ts`

**Описание проблемы**:

`enrichGddSection` (ai-service.ts:318-357) объявлена и экспортирована, но
НИКОГДА не импортируется и не вызывается. Подтверждено grep:
```
$ grep -rn "enrichGddSection" src/
src/lib/ai-service.ts:318:export async function enrichGddSection(
src/lib/ai-service.ts:352:      "[ai-service] enrichGddSection failed:",
```

Только объявление и её собственный console.error — нигде больше.

Дополнительно содержит китайский символ `扩充` (строка 333):
```ts
const prompt = `Ты — технический писатель GDD. Обогати и улучши секцию дизайн-документа.

Проект: ${ctx.projectName}
Жанр: ${ctx.genre}
Секция: ${ctx.sectionName}
Текущее содержание:
${ctx.existingContent}

Задача: перепиши и扩充 эту секцию, сделай её более подробной и профессиональной (150-250 слов, на русском). Сохрани суть, добавь конкретики.`;
```

`enrich` (рус. "обогати") + `扩充` (кит. "расширь") = bilingual артефакт
перевода.

При этом текущий route.ts:1047-1058 вызывает только `enrichGdd()` (без
"Section") — generic LLM advice про структуру GDD, не per-section
enrichment:
```ts
if (useAi) {
  const aiInsights = await enrichGdd({
    projectName: proj.name || "Untitled",
    genre: proj.genre || "game",
    format: targetFormat,
    sectionCount: sectionsList.length,
  });
  if (aiInsights) {
    profile.ai_insights = aiInsights;
    (profile.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
```

**Решение**:

Вариант A (рекомендуемый) — реализовать per-section AI enrichment через
`enrichGddSection`:

1. **Исправить китайский символ** в ai-service.ts:333:
   ```ts
   Задача: перепиши и расширь эту секцию, сделай её более подробной и профессиональной (150-250 слов, на русском). Сохрани суть, добавь конкретики.
   ```

2. **Расширить интерфейс `GddEnrichmentInput`** (ai-service.ts:308-313):
   ```ts
   export interface GddEnrichmentInput {
     sectionName: string;
     projectName: string;
     genre: string;
     existingContent: string;
     detailLevel?: "overview" | "standard" | "detailed" | "exhaustive";
     targetWordCount?: number;  // default 150-250
   }
   ```

3. **Вызывать `enrichGddSection` per-section в route.ts** (если `use_ai=true`):
   ```ts
   // После первого deriveSectionContent loop, но ДО persist:
   if (useAi) {
     for (const sectionName of sectionsList) {
       const filled = sectionsContent[sectionName];
       // Только для секций, помеченных как ai_generatable или manual
       if (filled.source === "ai_generate" || filled.source === "manual") {
         try {
           const enriched = await enrichGddSection({
             sectionName,
             projectName: proj.name || "Untitled",
             genre: proj.genre || "game",
             existingContent: filled.content,
             detailLevel: detailLevel,
           });
           if (enriched) {
             sectionsContent[sectionName] = {
               ...filled,
               content: enriched,
               source: "ai_enrich",
               requires_review: false,
             };
             enrichedSections[sectionName] = sectionsContent[sectionName];
           }
         } catch (e) {
           console.error(`[gdd/generate] enrichGddSection failed for ${sectionName}:`, e);
           failedSections.push(sectionName);
         }
       }
     }
   }
   ```

4. **Также вызвать `enrichGdd()` для overall advice** (как сейчас).

Вариант B (минимальный) — просто удалить `enrichGddSection` как dead code:
```ts
// Удалить строки 304-357 из ai-service.ts
```

Рекомендую Вариант A — это реализует заявленную функциональность per-section
AI enrichment (Bible 11.8.2: "AI формулирует текст, алгоритмы валидируют").

**Тест-кейсы**:
- После Вариант A: `07_gdd.json.ai_enriched_sections.enriched_count > 0` для
  full_gdd (должно быть 5+ секций с `source: "ai_enrich"`).
- `07_gdd.json.ai_enriched_sections.enriched_sections[0].content` содержит
  LLM-generated текст (150-250 слов), не placeholder.
- `07_gdd.json.ai_enriched_sections.failed_sections` — список секций, для
  которых AI не смог сгенерировать контент (может быть пустым).
- Никаких китайских символов в `src/lib/ai-service.ts` (grep `[\u4e00-\u9fff]` возвращает 0).

**Риски**:
- Per-section LLM calls — медленно (38 секций × ~2s/call = 76s для full_gdd).
  Митигация: параллельные вызовы `Promise.all`, или batch prompt (один LLM
  call для нескольких секций), или enrichment только для секций с
  `requires_review=true`.
- Cost: 38 LLM calls per GDD generation. Митигация: rate limiting, кэш по
  content hash.
- LLM может возвращать некачественный контент. Митигация: validate output
  length, fallback к original content если enriched короче 100 символов.

**Dependencies**: TASK-6.10 (cache `deriveSectionContent`).

---

### TASK-6.8: Реализовать Universal Design Validator (Bible 11.6, 10 уровней)

**Сложность**: XL
**Приоритет**: 🔴 (после TASK-6.6)
**Файлы**: новый `src/lib/universal-design-validator.ts`, `src/app/api/v1/gdd/checklist/route.ts`, `src/lib/checklist-logic.ts`

**Описание проблемы**:

Bible 11.6 описывает Universal Design Validator — 10 уровней валидации с
адаптивной приоритизацией по жанру (Bible 11.6.2). Полная структура (см.
диаграмму в Bible 11.6.1):

```
УРОВЕНЬ 1: ВАЛИДАЦИЯ КОНЦЕПЦИИ — 8 фильтров Шелла + логлайн + эстетика + аудитория + уникальность + реализуемость
УРОВЕНЬ 2: ВАЛИДАЦИЯ МЕХАНИК — 6 эвристик Аптона + многоуровневая тетрада + MechanicsDB compat + язык + пространство состояний
УРОВЕНЬ 3: ВАЛИДАЦИЯ CORE LOOP — 5 вопросов Гэри + 30s fun + концентрические схемы + 4 главные петли + микро→мезо→макро→мета
УРОВЕНЬ 4: ВАЛИДАЦИЯ БАЛАНСА — 3 типа + Q-фактор + SPS + золотое правило + cost-power + масштабируемость (Bible 11.5.3)
УРОВЕНЬ 5: ВАЛИДАЦИЯ ЭКОНОМИКИ И ПРОГРЕССИИ — faucets/drains + конверсии + патологии + кривая + эмерджентная прогрессия
УРОВЕНЬ 6: ВАЛИДАЦИЯ НАРРАТИВА — диссонанс + гармония/ирония + агентивность + драм. арка + Triangle of Weirdness
УРОВЕНЬ 7: ВАЛИДАЦИЯ LEVEL DESIGN — читаемость + 7 методов Бонд + Combat Fronts + темп 3×3 + Beat Chart
УРОВЕНЬ 8: ВАЛИДАЦИЯ ОПЫТА — поток + кривая интереса + 5 убийц Фуллертон + 4+3 цели Бонд + мотивация
УРОВЕНЬ 9: ВАЛИДАЦИЯ ИНТЕРФЕЙСА — 6 принципов + сочность + время отклика + доступность + типы решений
УРОВЕНЬ 10: ВАЛИДАЦИЯ ДОКУМЕНТАЦИИ — полнота 38 секций + актуальность + обоснование + трассировка + аудитория
```

Адаптивная приоритизация (Bible 11.6.2):

| Жанр | Критичные | Важные | Второстепенные |
|---|---|---|---|
| PvP-экшн | 3, 4, 9 | 2, 7, 8 | 6, 5 |
| Single-player RPG | 6, 5, 8 | 2, 3, 7 | 4 (PvP), 9 |
| Стратегия | 4, 5, 2 | 3, 8 | 6, 7 |
| Нарративная игра | 6, 8, 1 | 7, 2 | 4, 5 |
| Мобильная F2P | 5, 3, 8 | 1, 9 | 6, 7 |

Текущая реализация `checklist-logic.ts` имеет только 15 правил вместо ~220
из Bible. Levels 7, 9, 10 полностью отсутствуют.

**Решение**:

1. **Создать новый модуль `src/lib/universal-design-validator.ts`** (~1500
   строк) с 10 level-functions:

   ```ts
   export interface ValidatorLevel {
     level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
     name: string;
     critical_for_genres: string[];
     important_for_genres: string[];
     checks: ValidatorCheck[];
   }

   export interface ValidatorCheck {
     id: string;          // e.g., "L1-SHELL-FILTER-1"
     description: string;
     severity: "error" | "warning" | "info";
     evaluate: (project: ProjectData) => {
       passed: boolean;
       score: number;     // 0..1
       details?: string;
       suggestion?: string;
     };
   }

   // УРОВЕНЬ 1: ВАЛИДАЦИЯ КОНЦЕПЦИИ
   export const LEVEL_1_CONCEPT: ValidatorLevel = {
     level: 1,
     name: "Concept Validation",
     critical_for_genres: ["narrative_bible", "concept_doc"],
     important_for_genres: ["rpg", "adventure"],
     checks: [
       // 8 Shell filters
       { id: "L1-FILTER-1-ARTISTIC", description: "Художественное чутьё: нравится ли мне эта игра?", severity: "warning",
         evaluate: (p) => ({ passed: !!p.concept?.usp, score: p.concept?.usp ? 0.8 : 0.3, suggestion: "USP должен вызывать эмоциональную связь" }) },
       { id: "L1-FILTER-2-AUDIENCE", description: "Аудитория: подойдёт ли ЦА?", severity: "warning",
         evaluate: (p) => ({ passed: !!p.concept?.primaryAesthetic, score: 0.7, suggestion: "Сопоставьте эстетику с мотивацией аудитории" }) },
       // ... ещё 6 фильтров
       // Логлайн
       { id: "L1-LOGLINE-WHO", description: "Логлайн: кто + где + что + почему?", severity: "error",
         evaluate: (p) => {
           const usp = p.concept?.usp || "";
           const hasWho = /кто|who/i.test(usp);
           const hasWhy = /почему|why|для/i.test(usp);
           return { passed: hasWho && hasWhy, score: (hasWho ? 0.5 : 0) + (hasWhy ? 0.5 : 0) };
         } },
       // Целевая эстетика
       { id: "L1-AESTHETIC-MDA", description: "Целевая эстетика: какие из 8 MDA?", severity: "warning",
         evaluate: (p) => ({ passed: !!p.mdaProfile?.primaryAesthetic, score: 0.8 }) },
       // Профиль аудитории (Йи)
       // Уникальность
       // Реализуемость
     ],
   };

   // УРОВЕНЬ 2: ВАЛИДАЦИЯ МЕХАНИК (6 эвристик Аптона)
   export const LEVEL_2_MECHANICS: ValidatorLevel = {
     level: 2,
     name: "Mechanics Validation",
     critical_for_genres: ["strategy", "puzzle"],
     important_for_genres: ["rpg", "shooter"],
     checks: [
       { id: "L2-UPTON-CHOICE", description: "Выбор: осознанный выбор из нескольких вариантов?", severity: "warning",
         evaluate: (p) => {
           const mechSet = safeJsonParse(p.concept?.mechanicSet || "{}", {});
           const count = (mechSet.base as unknown[])?.length || 0;
           return { passed: count >= 3, score: Math.min(1, count / 5) };
         } },
       // ... ещё 5 эвристик Аптона
       // Многоуровневая тетрада
       // MechanicsDB совместимость
       // Языковая метафора
       // Пространство состояний
     ],
   };

   // УРОВЕНЬ 3: ВАЛИДАЦИЯ CORE LOOP (5 вопросов Гэри)
   export const LEVEL_3_CORE_LOOP: ValidatorLevel = {
     level: 3,
     name: "Core Loop Validation",
     critical_for_genres: ["shooter", "racing", "rhythm"],
     important_for_genres: ["rpg", "platformer"],
     checks: [
       { id: "L3-GARY-VERB", description: "What is the core verb?", severity: "error",
         evaluate: (p) => {
           const steps = safeJsonParse(p.coreLoop?.stepsData || "[]", []);
           return { passed: steps.length > 0, score: steps.length > 0 ? 0.8 : 0 };
         } },
       // ... ещё 4 вопроса Гэри
       // 30 секунд веселья
       // Концентрические схемы
       // 4 главные петли
       // микро→мезо→макро→мета
     ],
   };

   // УРОВЕНЬ 4: ВАЛИДАЦИЯ БАЛАНСА (7-point Rolling/Morris, Bible 11.5.3)
   export const LEVEL_4_BALANCE: ValidatorLevel = {
     level: 4,
     name: "Balance Validation",
     critical_for_genres: ["shooter", "fighting", "strategy"],
     important_for_genres: ["rpg", "tower_defense"],
     checks: [
       { id: "L4-PVP-FAIR", description: "Баланс PvP: нет изначальных преимуществ?", severity: "error",
         evaluate: (p) => {
           const bal = p.balanceResult;
           return { passed: !!bal && (bal.overallBalanceScore || 0) >= 60, score: (bal?.overallBalanceScore || 0) / 100 };
         } },
       { id: "L4-Q-FACTOR", description: "Q-фактор: нет мёртвых компонентов?", severity: "warning",
         evaluate: (p) => {
           const bal = p.balanceResult;
           return { passed: (bal?.imbalanceCount || 0) <= 3, score: 1 - Math.min(1, (bal?.imbalanceCount || 0) / 10) };
         } },
       // ... ещё 5 checks (SPS, golden rule, cost-power, scaling, PvP равновероятность)
     ],
   };

   // УРОВЕНЬ 5: ВАЛИДАЦИЯ ЭКОНОМИКИ И ПРОГРЕССИИ
   export const LEVEL_5_ECONOMY: ValidatorLevel = {
     level: 5,
     name: "Economy & Progression Validation",
     critical_for_genres: ["mmorpg", "mobile_f2p", "strategy"],
     important_for_genres: ["rpg", "simulation"],
     checks: [
       { id: "L5-FAUCET-DRAIN", description: "Faucets/Drains: равновесие?", severity: "error",
         evaluate: (p) => ({ passed: !p.economy?.hasPathology, score: p.economy?.hasPathology ? 0.3 : 0.8 }) },
       { id: "L5-PATHOLOGIES", description: "Патологии: нет инфляции, стагнации, арбитража?", severity: "error",
         evaluate: (p) => ({ passed: !p.economy?.hasPathology, score: p.economy?.hasPathology ? 0.4 : 0.9 }) },
       // ... conversion chains, progression curve, emergent progression
     ],
   };

   // УРОВЕНЬ 6: ВАЛИДАЦИЯ НАРРАТИВА
   export const LEVEL_6_NARRATIVE: ValidatorLevel = {
     level: 6,
     name: "Narrative Validation",
     critical_for_genres: ["narrative_bible", "rpg", "horror"],
     important_for_genres: ["adventure", "metroidvania"],
     checks: [
       { id: "L6-DISSONANCE", description: "Лудонарративный диссонанс: механики ↔ история?", severity: "error",
         evaluate: (p) => {
           const lud = safeJsonParse(p.mdaProfile?.ludonarrativeCheck || "{}", {});
           const isHarmony = lud.result === "Гармония";
           return { passed: isHarmony, score: isHarmony ? 0.9 : 0.4, suggestion: lud.correction };
         } },
       // ... гармония/ирония, агентивность, драм. арка, Triangle of Weirdness
     ],
   };

   // УРОВЕНЬ 7: ВАЛИДАЦИЯ LEVEL DESIGN (7 методов Бонд)
   export const LEVEL_7_LEVEL_DESIGN: ValidatorLevel = {
     level: 7,
     name: "Level Design Validation",
     critical_for_genres: ["platformer", "metroidvania", "shooter"],
     important_for_genres: ["rpg", "puzzle"],
     checks: [
       { id: "L7-READABILITY", description: "Читаемость: игрок понимает пространство?", severity: "warning",
         evaluate: (p) => ({ passed: false, score: 0.5, suggestion: "Требуется manual level design review" }) },
       { id: "L7-BOND-LINES", description: "Указывающие линии: элементы среды направляют взгляд?", severity: "info",
         evaluate: (p) => ({ passed: false, score: 0.5 }) },
       // ... ещё 5 методов Бонд (camera, contrast, sound, imitation, branding)
       // Combat Fronts
       // Темп 3×3
       // Beat Chart
     ],
   };

   // УРОВЕНЬ 8: ВАЛИДАЦИЯ ОПЫТА (5 убийц Фуллертон)
   export const LEVEL_8_EXPERIENCE: ValidatorLevel = {
     level: 8,
     name: "Experience Validation",
     critical_for_genres: ["narrative_bible", "horror", "rpg"],
     important_for_genres: ["all"],
     checks: [
       { id: "L8-FLOW", description: "Поток: баланс вызова и навыка?", severity: "warning",
         evaluate: (p) => ({ passed: true, score: 0.7, suggestion: "Проверьте progression.difficulty_curve" }) },
       { id: "L8-FULLERTON-MICROMANAGEMENT", description: "Микроменеджмент: слишком много мелких решений?", severity: "warning",
         evaluate: (p) => ({ passed: true, score: 0.7 }) },
       // ... ещё 4 убийцы (застой, препятствия, произвольные события, предсказуемые пути)
       // 4+3 цели Бонд
       // Мотивация
     ],
   };

   // УРОВЕНЬ 9: ВАЛИДАЦИЯ ИНТЕРФЕЙСА (6 принципов Фуллертон)
   export const LEVEL_9_INTERFACE: ValidatorLevel = {
     level: 9,
     name: "Interface Validation",
     critical_for_genres: ["mobile", "shooter", "rhythm"],
     important_for_genres: ["all"],
     checks: [
       { id: "L9-FEEDBACK", description: "Сочность: фидбэк на каждое действие?", severity: "warning",
         evaluate: (p) => ({ passed: false, score: 0.5, suggestion: "Требуется UI/UX spec" }) },
       { id: "L9-RESPONSE-TIME", description: "Время отклика < 1/10 секунды?", severity: "error",
         evaluate: (p) => ({ passed: true, score: 0.9 }) },
       { id: "L9-ACCESSIBILITY", description: "Доступность: цветовая слепота, слух, моторика?", severity: "info",
         evaluate: (p) => ({ passed: false, score: 0.4, suggestion: "Добавить accessibility checklist" }) },
       // ... ещё 3 checks
     ],
   };

   // УРОВЕНЬ 10: ВАЛИДАЦИЯ ДОКУМЕНТАЦИИ
   export const LEVEL_10_DOCUMENTATION: ValidatorLevel = {
     level: 10,
     name: "Documentation Validation",
     critical_for_genres: ["all"],
     important_for_genres: ["all"],
     checks: [
       { id: "L10-COMPLETENESS", description: "Полнота: все 38 секций GDD?", severity: "error",
         evaluate: (p) => {
           const gdd = safeJsonParse(p.gdd?.fullProfile || "{}", {});
           const total = gdd.assembled_document?.total_sections || 0;
           return { passed: total >= 38, score: Math.min(1, total / 38) };
         } },
       { id: "L10-FRESHNESS", description: "Актуальность: обновлена после последнего плейтеста?", severity: "warning",
         evaluate: (p) => {
           const updatedAt = p.gdd?.updatedAt;
           if (!updatedAt) return { passed: false, score: 0, suggestion: "GDD не сгенерирован" };
           const ageDays = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
           return { passed: ageDays <= 7, score: Math.max(0, 1 - ageDays / 30) };
         } },
       // ... обоснование, трассировка, аудитория
     ],
   };

   export const ALL_LEVELS = [
     LEVEL_1_CONCEPT, LEVEL_2_MECHANICS, LEVEL_3_CORE_LOOP, LEVEL_4_BALANCE,
     LEVEL_5_ECONOMY, LEVEL_6_NARRATIVE, LEVEL_7_LEVEL_DESIGN, LEVEL_8_EXPERIENCE,
     LEVEL_9_INTERFACE, LEVEL_10_DOCUMENTATION,
   ];

   // Адаптивная приоритизация по жанру (Bible 11.6.2)
   export const GENRE_LEVEL_PRIORITY: Record<string, {
     critical: number[];
     important: number[];
     secondary: number[];
   }> = {
     "shooter|fighting|moba": {
       critical: [3, 4, 9], important: [2, 7, 8], secondary: [6, 5],
     },
     "rpg": {
       critical: [6, 5, 8], important: [2, 3, 7], secondary: [4, 9],
     },
     "strategy": {
       critical: [4, 5, 2], important: [3, 8], secondary: [6, 7],
     },
     "narrative_bible|adventure": {
       critical: [6, 8, 1], important: [7, 2], secondary: [4, 5],
     },
     "mobile_f2p|mmorpg": {
       critical: [5, 3, 8], important: [1, 9], secondary: [6, 7],
     },
   };

   export function runUniversalDesignValidator(
     project: ProjectData,
     genre: string,
     options: { depth?: "standard" | "deep"; skipLevels?: number[] } = {}
   ) {
     const priorityKey = Object.keys(GENRE_LEVEL_PRIORITY).find(k =>
       new RegExp(k, "i").test(genre)
     ) || "rpg";
     const priority = GENRE_LEVEL_PRIORITY[priorityKey];

     const results = ALL_LEVELS
       .filter(l => !options.skipLevels?.includes(l.level))
       .map(level => {
         const priority_tier = priority.critical.includes(level.level) ? "critical"
           : priority.important.includes(level.level) ? "important"
           : "secondary";
         const checkResults = level.checks.map(c => ({
           ...c,
           result: c.evaluate(project),
         }));
         const passedCount = checkResults.filter(r => r.result.passed).length;
         const score = checkResults.reduce((sum, r) => sum + r.result.score, 0) / checkResults.length;
         return {
           level: level.level,
           name: level.name,
           priority: priority_tier,
           checks: checkResults,
           passed_count: passedCount,
           total_count: checkResults.length,
           score: Number(score.toFixed(3)),
         };
       });

     const overallScore = results.reduce((sum, r) => {
       const weight = r.priority === "critical" ? 0.25 : r.priority === "important" ? 0.10 : 0.05;
       return sum + r.score * weight;
     }, 0);

     return {
       levels: results,
       overall_score: Number(overallScore.toFixed(3)),
       readiness: overallScore >= 0.8 ? "ready" : overallScore >= 0.5 ? "almost" : "not_ready",
       critical_issues: results.flatMap(l => l.checks.filter(c => !c.result.passed && c.severity === "error").map(c => ({ level: l.level, ...c }))),
       warnings: results.flatMap(l => l.checks.filter(c => !c.result.passed && c.severity === "warning").map(c => ({ level: l.level, ...c }))),
       infos: results.flatMap(l => l.checks.filter(c => !c.result.passed && c.severity === "info").map(c => ({ level: l.level, ...c }))),
     };
   }
   ```

2. **Интегрировать в `/gdd/checklist/route.ts`** (после TASK-6.6):
   ```ts
   import { runUniversalDesignValidator } from "@/lib/universal-design-validator";

   // В POST handler, после runChecklistValidation:
   const validatorResult = runUniversalDesignValidator(project, project.genre || "rpg", {
     depth: body?.depth || "standard",
   });
   result.universal_design_validator = validatorResult;
   ```

3. **Расширить Prisma `ProjectChecklist`** новыми полями (см. TASK-6.17):
   - `universalValidatorResult: String?` (JSON)

**Тест-кейсы**:
- `08_checklist.json.universal_design_validator.levels` содержит 10 элементов.
- `08_checklist.json.universal_design_validator.levels[0].name === "Concept Validation"`.
- `08_checklist.json.universal_design_validator.overall_score` в диапазоне [0, 1] (не integer).
- Для genre="rpg": critical levels = [6, 5, 8] (narrative, economy, experience).
- Для genre="shooter": critical levels = [3, 4, 9] (core loop, balance, interface).
- `08_checklist.json.universal_design_validator.critical_issues` содержит concrete issues с description + suggestion.
- 10 test_projects: 10 РАЗНЫХ validator results (разные genre → разные critical levels).

**Риски**:
- Огромный объём кода (~1500+ строк). Митигация: phased implementation —
  сначала stub checks (return placeholder), затем逐步 наполнять logic.
- Адаптивная приоритизация может давать разные overall_score для одной и
  той же игры с разными жанрами. Митигация: документировать rationale.
- Многие checks требуют manual review (level design, UI). Митигация:
  возвращать `passed: false, score: 0.5` с suggestion "Manual review required".

**Dependencies**: TASK-6.6 (использовать `lib/checklist-logic.ts` как foundation).

---

### TASK-6.9: Перенести `enrichGdd()` ДО persist + расширить Prisma `ProjectGDD`

**Сложность**: M
**Приоритет**: 🔴 (системная проблема S1)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 990-1058), `prisma/schema.prisma` (модель `ProjectGDD`, строки 285-304)

**Описание проблемы**:

Route persist на строках 991-1042:
```ts
await db.projectGDD.upsert({
  where: { projectId: proj.id },
  create: {
    // ...
    fullProfile: JSON.stringify(profile),  // ← profile БЕЗ ai_insights
  },
  update: {
    // ...
    fullProfile: JSON.stringify(profile),  // ← profile БЕЗ ai_insights
  },
});

await updateProjectStage(proj.id, "gdd");

// --- Optional AI enrichment ---
if (useAi) {
  const aiInsights = await enrichGdd({...});
  if (aiInsights) {
    profile.ai_insights = aiInsights;  // ← добавлено ПОСЛЕ persist
    (profile.models_used as string[]).push("glm-4.6 (ai-enrichment)");
  }
}
```

`profile` передаётся в `JSON.stringify(profile)` ДО того, как `ai_insights`
добавляется. В БД сохраняется `fullProfile` БЕЗ `ai_insights`. POST response
возвращает `profile` С `ai_insights` (если `useAi=true`), но повторный
запрос из БД (через `/gdd/export` или будущий `/gdd/[id]`) вернёт БЕЗ
`ai_insights`.

Подтверждено: `07_gdd.json.ai_insights` (вывод route POST) содержит LLM
advice (2299 символов), но это поле НЕ в БД (поле `aiInsights` отсутствует
в `ProjectGDD` schema).

**Решение**:

1. **Расширить Prisma `ProjectGDD`** (prisma/schema.prisma:285-304):
   ```prisma
   model ProjectGDD {
     id                 String   @id @default(cuid())
     projectId          String   @unique
     format             String?
     sectionCount       Int?
     completenessPercent Float?
     inputData          String?
     sections           String?
     visualElements     String?
     consistencyIssues  String?
     completenessReport String?
     fullProfile        String?
     aiInsights         String?   // NEW: JSON string с ai_insights
     modelsUsed         String?   // NEW: JSON array с models_used
     targetStage        String?   // NEW: project_stage (concept/prototype/preproduction/production/live_ops)
     lastUpdated        DateTime? @updatedAt  // NEW: для living documentation (Bible 11.9)
     sectionAges        String?   // NEW: JSON { section_name: ISO date string } для tracking возраста секций
     createdAt          DateTime  @default(now())
     updatedAt          DateTime  @updatedAt

     project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

     @@index([format])
     @@map("project_gdds")
   }
   ```

2. **Запустить migration**:
   ```bash
   npx prisma migrate dev --name add_gdd_ai_insights_and_ages
   ```

3. **Перенести `enrichGdd()` ДО persist** в route.ts:
   ```ts
   // --- Optional AI enrichment (ПЕРЕНЕСЕНО ДО persist) ---
   if (useAi) {
     const aiInsights = await enrichGdd({
       projectName: proj.name || "Untitled",
       genre: proj.genre || "game",
       format: targetFormat,
       sectionCount: sectionsList.length,
     });
     if (aiInsights) {
       profile.ai_insights = aiInsights;
       (profile.models_used as string[]).push("glm-4.6 (ai-enrichment)");
     }
   }

   // --- Persist ---
   await db.projectGDD.upsert({
     where: { projectId: proj.id },
     create: {
       projectId: proj.id,
       format: targetFormat,
       sectionCount: sectionsList.length,
       completenessPercent: coverageScore,
       inputData: JSON.stringify({...}),
       sections: JSON.stringify(assembledSections),
       visualElements: JSON.stringify({}),  // TODO: TASK-6.18 fill this
       consistencyIssues: JSON.stringify(consistencyReport.issues),
       completenessReport: JSON.stringify({...}),
       fullProfile: JSON.stringify(profile),
       aiInsights: profile.ai_insights ? JSON.stringify(profile.ai_insights) : null,  // NEW
       modelsUsed: JSON.stringify(profile.models_used),  // NEW
       targetStage: projectStage,  // NEW
       sectionAges: JSON.stringify(
         Object.fromEntries(sectionsList.map(s => [s, new Date().toISOString()]))
       ),  // NEW: living documentation
     },
     update: {
       // ... same fields
       aiInsights: profile.ai_insights ? JSON.stringify(profile.ai_insights) : null,
       modelsUsed: JSON.stringify(profile.models_used),
       targetStage: projectStage,
       sectionAges: JSON.stringify(
         Object.fromEntries(sectionsList.map(s => [s, new Date().toISOString()]))
       ),
     },
   });
   ```

4. **Обновить GET `/gdd/[projectId]`** (если будет создан) для возврата
   `aiInsights` из БД.

**Тест-кейсы**:
- После POST /gdd/generate: `db.projectGDD.findFirst().aiInsights` содержит
  JSON-строку с ai_insights (не null).
- После POST /gdd/generate: `db.projectGDD.findFirst().modelsUsed` содержит
  `["deterministic-gdd-v1", ..., "glm-4.6 (ai-enrichment)"]`.
- После POST без `use_ai`: `aiInsights` = null, `modelsUsed` без "glm-4.6".
- `db.projectGDD.findFirst().sectionAges` содержит JSON с ISO timestamps для
  каждой секции.
- `db.projectGDD.findFirst().lastUpdated` обновляется при повторном POST.
- GET /gdd/[id] (после реализации) возвращает `ai_insights` (не undefined).

**Риски**:
- Migration может потребовать backfill для существующих записей (aiInsights
  = null для всех старых GDD). Митигация: `@default` не нужен, все новые
  поля nullable.
- Если `enrichGdd()` медленный (LLM call), persist задерживается. Митигация:
  paralelble batch enrichment, или async persist (не блокировать response).

**Dependencies**: TASK-6.7 (per-section enrichment тоже должен быть до persist).

---

### TASK-6.10: Cache `deriveSectionContent` — вызвать один раз per section

**Сложность**: S
**Приоритет**: 🟡 (после TASK-6.3, TASK-6.4)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 746, 800)

**Описание проблемы**:

`deriveSectionContent` вызывается ДВАЖДЫ для каждой секции:
- Строки 746-776: первый loop для `data_mapping` (activeMappings, sectionReadiness).
- Стоки 800-819: второй loop для `sectionsContent` (с adjust по DETAIL_FACTOR).

Для full_gdd из 21 секции = 42 вызова. После TASK-6.1 (38 секций) = 76 вызовов.
`deriveSectionContent` выполняет `safeJsonParse` (для concept.onePagerData,
mda.ludonarrativeCheck и т.д.) — это costly operation.

**Решение**:

Объединить два loop в один с кэшем:

```ts
// --- Single pass: derive + cache + assemble data_mapping + sectionsContent ---
const derivedCache = new Map<string, { content: string; source: string; requires_review: boolean }>();

const activeMappings: Record<string, unknown> = {};
const sectionReadiness: Record<string, unknown> = {};
const autoFillable: string[] = [];
const manualSections: string[] = [];
const aiGeneratable: string[] = [];
const sectionsContent: Record<string, {...}> = {};

for (const sectionName of sectionsList) {
  // Get from cache or derive
  let filled = derivedCache.get(sectionName);
  if (!filled) {
    filled = deriveSectionContent(sectionName, proj, language);
    derivedCache.set(sectionName, filled);
  }

  // Build data_mapping
  activeMappings[sectionName] = {
    source: filled.source,
    auto_fill: filled.source === "auto_fill",
    ai_enrich: filled.source === "ai_enrich",
    ai_generate: filled.source === "ai_generate",
    ai_suggest: false,
    manual: filled.source === "manual",
    diagram: false,
    tables: false,
    formulas: false,
  };

  let readiness: string;
  if (filled.source === "auto_fill") {
    readiness = "ready";
    autoFillable.push(sectionName);
  } else if (filled.source === "ai_generate" || filled.source === "ai_enrich") {
    readiness = "ai_generatable";
    aiGeneratable.push(sectionName);
  } else {
    readiness = "manual_required";
    manualSections.push(sectionName);
  }
  sectionReadiness[sectionName] = {
    status: readiness,
    coverage: filled.source === "auto_fill" ? 1.0 : filled.source === "manual" ? 0.0 : 0.5,
    auto_fillable: filled.source === "auto_fill",
  };

  // Build sectionsContent (with DETAIL_FACTOR adjustment)
  let content = filled.content;
  if (detailFactor > 1.5 && filled.source === "ai_generate") {
    content = content + (language === "ru"
      ? "\n\n_Расширенное описание для детального уровня:_ смежные аспекты..."
      : "\n\n_Extended description for detailed level:_ related aspects...");
  } else if (detailFactor < 0.7 && filled.source === "ai_generate") {
    content = content.split("\n")[0];
  }
  sectionsContent[sectionName] = {
    content,
    source: filled.source,
    auto_filled: filled.source === "auto_fill",
    requires_review: filled.requires_review,
  };
}
```

Удалить второй loop (строки 800-819).

**Тест-кейсы**:
- Latency: `07_gdd.json.latency_ms` снижается на ~30-50% (один derive вместо двух).
- Все поля `data_mapping` и `sectionsContent` идентичны до/после рефакторинга.
- Логи: `deriveSectionContent` вызывается ровно `sectionsList.length` раз
  (не `2 × sectionsList.length`).

**Риски**:
- DETAIL_FACTOR adjustment применялся только ко второму вызову (для
  `sectionsContent`). После объединения нужно применить adjustment в том же
  loop. Митигация: сохранить logic adjustment (строки 803-812).

**Dependencies**: TASK-6.3, TASK-6.4 (derive cases должны быть готовы).

---

### TASK-6.11: Починить `has_formulas` regex

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строка 897)

**Описание проблемы**:

```ts
const hasFormulas = /=|∑|∫|≤|≥/.test(v.content) && v.content.length > 0;
```

Regex матчит любой `=` в content. False positives:
- Base64 padding (`aGVsbG8=`)
- Code snippets (`const x = ...`)
- RPG stats (`HP=100`)
- Color comparisons (`red = danger`)
- Even JSON с `"key": "value"` не матчит (там `:`, не `=`), но `\n` в JSON
  часто содержит `=` в base64 или URL-encoded данных.

**Решение**:

Требовать math context — `=` должен быть частью математического выражения:

```ts
// Mathematical formula patterns:
// - x = y + z (assignment with operators)
// - f(x) = ... (function definition)
// - a >= b, a <= b (comparison)
// - ∑, ∫, ≤, ≥ (math symbols)
// - P(A|B) = ... (probability)
const FORMULA_PATTERNS = [
  /\b\w+\s*=\s*\w+\s*[+\-*/^]/,         // x = y + z
  /\b\w+\s*=\s*\d+(\.\d+)?\s*[+\-*/^]/,  // x = 5 +
  /\bf\([^)]*\)\s*=/,                     // f(x) = ...
  /[a-z]\s*>=\s*\w/i,                     // a >= b
  /[a-z]\s*<=\s*\w/i,                     // a <= b
  /∑|∫|≤|≥|≈|≠/,                          // math symbols
  /\bP\([^)]*\)\s*=/,                     // P(A|B) = ...
  /\bev\s*=/i,                            // EV = ... (expected value)
  /\bcost\s*=\s*/i,                       // cost = ...
  /\bdamage\s*=\s*/i,                     // damage = ...
];

const hasFormulas = FORMULA_PATTERNS.some(p => p.test(v.content));
```

Альтернатива (минимальная): просто исключить base64 padding и code snippets:
```ts
// Exclude base64 padding (= at end of alphanumeric string)
// Exclude assignment in code (const/let/var = ...)
const FORMULA_REGEX = /(?<!const\s|let\s|var\s|base64,)(?<![\w+/])=(?![\w+/=])/;
const hasFormulas = (FORMULA_REGEX.test(v.content) || /[∑∫≤≥≈≠]/.test(v.content));
```

Рекомендую первый вариант (более явный).

**Тест-кейсы**:
- `"A simple sentence."` → `has_formulas: false`.
- `"Base64 padding: aGVsbG8="` → `has_formulas: false` (не формула).
- `"const x = () => 1"` → `has_formulas: false` (code snippet).
- `"HP=100 MP=50"` → `has_formulas: false` (RPG stats, не математика).
- `"x = 5 + 3"` → `has_formulas: true`.
- `"f(x) = ax² + bx + c"` → `has_formulas: true`.
- `"P(A|B) = P(A∩B) / P(B)"` → `has_formulas: true`.
- `"cost = 100 * (1 + level * 0.1)"` → `has_formulas: true`.
- `"damage = weapon.power * (1 - armor.defense / 100)"` → `has_formulas: true`.
- `"∑ damage / count = average_dps"` → `has_formulas: true`.

**Риски**:
- Пропуск некоторых реальных формул (false negatives). Митигация: расширить
  patterns по мере обнаружения.
- Сложность regex может замедлить парсинг для больших GDD. Митигация:
  pre-compile patterns один раз.

**Dependencies**: нет.

---

### TASK-6.12: Починить `mdToPdfLike` fallback — убрать обрезку до 4000 символов

**Сложность**: M
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/gdd/export/route.ts` (строки 82-108)

**Описание проблемы**:

`mdToPdfLike` (export/route.ts:82-108) обрезает контент до 4000 символов:
```ts
const contentStream = `BT /F1 10 Tf 50 800 Td (${escapedText.slice(0, 4000)}) Tj ET`;
```

Для GDD на 50 страниц (~150 000 символов) обрезает 97% контента. Real PDF
через `generateRealPdf` (Playwright) обычно срабатывает, но fallback ломает
длинные GDD если Playwright недоступен.

Дополнительно: single-page PDF (`/Type /Page /Parent 2 0 R /MediaBox [0 0 595 842]`)
не подходит для многостраничных документов.

**Решение**:

Вариант A (рекомендуемый) — реализовать pagination:

```ts
function mdToPdfLike(md: string, title: string): string {
  const text = `${title}\n\n${md}`;

  // Split text into pages (approximately 60 lines per A4 page at 10pt)
  const lines = text.split("\n");
  const linesPerPage = 60;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  if (pages.length === 0) pages.push([text]);

  const header = "%PDF-1.4\n";
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Pages tree
  const pageObjectIds: number[] = [];
  const firstPageObjId = 3; // objects 3..(3+pages*2-1) for pages+contents
  for (let i = 0; i < pages.length; i++) {
    pageObjectIds.push(firstPageObjId + i * 2);
  }
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjectIds.join(" ")}] /Count ${pages.length} >>\nendobj\n`);

  // Each page + content stream
  for (let i = 0; i < pages.length; i++) {
    const pageLines = pages[i];
    const escapedText = pageLines
      .map(l => l.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)"))
      .join("\\n");

    // Build content stream with text wrapping
    const yStart = 800;
    const lineHeight = 12;
    const contentStream = `BT /F1 10 Tf 50 ${yStart} Td (${escapedText}) Tj ET`;

    const pageObjId = firstPageObjId + i * 2;
    const contentObjId = pageObjId + 1;

    objects.push(`${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents ${contentObjId} 0 R >>\nendobj\n`);
    objects.push(`${contentObjId} 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);
  }

  // Font (object 5 must be font — let's recalc)
  // Actually we need to renumber objects to ensure font object is at the end
  // For simplicity, let's put font at fixed position:
  // objects[0] = catalog (1)
  // objects[1] = pages (2)
  // objects[2..2+pages*2-1] = pages + contents (3, 4, 5, 6, ...)
  // objects[2+pages*2] = font (last)

  const fontObjId = 3 + pages.length * 2;
  objects.push(`${fontObjId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);

  // Update pages Kids references (already done above)
  // Update each page's /Resources to reference fontObjId
  // (for simplicity, all pages share the same font resource)

  const xrefStart = header.length + objects.join("").length;
  let pdf = header + objects.join("");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  let offset = header.length;
  for (let i = 0; i < objects.length; i++) {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
    offset += objects[i].length;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return pdf;
}
```

Вариант B (минимальный) — просто убрать slice и увеличить buffer:

```ts
// Remove the slice(0, 4000) — emit the full text
const contentStream = `BT /F1 10 Tf 50 800 Td (${escapedText}) Tj ET`;
```

Но это сломает PDF для длинных текстов (PDF content stream имеет лимиты).

Вариант C (fallback на markdown-to-text без PDF wrapper):

```ts
function mdToTextPlain(md: string, title: string): string {
  // Просто вернуть plain text — клиент сохранит как .txt
  return `${title}\n\n${md}`;
}
```

И в route.ts fallback возвращать `.txt` mime type вместо `application/pdf`.

Рекомендую Вариант A (pagination) — даёт реальный multi-page PDF.

**Тест-кейсы**:
- Export GDD на 50 страниц в PDF: `size_bytes > 100000` (не обрезанный).
- PDF содержит все секции (grep по `## Title` в extracted PDF text).
- PDF имеет несколько страниц (PDF /Pages /Count > 1).
- Если Playwright недоступен: fallback PDF работает для длинных GDD.
- Если Playwright доступен: `generateRealPdf` используется (как сейчас).

**Риски**:
- PDF pagination сложен (text wrapping, line height, page breaks). Митигация:
  использовать готовую библиотеку `pdfkit` или `puppeteer-core` для fallback.
- Existing test для `mdToPdfLike` может зависеть от single-page формата.
  Митигация: обновить тест.

**Dependencies**: нет.

---

### TASK-6.13: Реальное `coverage_score` — учитывать `auto_fill` + `ai_enrich`

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 779, 824, 840, 927, 981)

**Описание проблемы**:

```ts
const coverageScore = autoFillable.length / Math.max(1, sectionsList.length);
```

Считает только `auto_fill` секции как "covered". Но `ai_enrich` секции
(которые содержат реальный контент из `mda.ludonarrativeCheck`) тоже
"covered" — просто требуют review.

Подтверждено: `07_gdd.json.coverage_score = 0.571` для всех 10 test_projects
(12/21 = 0.571). Если бы `ai_enrich` (1 секция `narrative`) считалась,
coverage было бы 13/21 = 0.619.

**Решение**:

```ts
// Sections with real content (not placeholder)
const coveredSections = sectionsList.filter(s => {
  const src = sectionsContent[s]?.source;
  return src === "auto_fill" || src === "ai_enrich";
});
const coverageScore = coveredSections.length / Math.max(1, sectionsList.length);
```

Дополнительно ввести `manual_required_score` (proportion requiring manual
filling):
```ts
const manualRequiredScore = manualSections.length / Math.max(1, sectionsList.length);
```

И обновить `completenessReport` в persist:
```ts
completenessReport: JSON.stringify({
  total_sections: sectionsList.length,
  auto_filled: autoFillable.length,
  ai_enriched: Object.keys(enrichedSections).length,
  ai_generated: aiGeneratable.length,
  manual_filled: 0,
  manual_pending: manualSections.length,
  completeness_percent: Number((coverageScore * 100).toFixed(1)),
  manual_required_percent: Number((manualRequiredScore * 100).toFixed(1)),
}),
```

**Тест-кейсы**:
- `07_gdd.json.coverage_score` для full_gdd из 21 секции с 12 auto_fill + 1 ai_enrich
  = 13/21 = 0.619 (не 0.571).
- `07_gdd.json.completeness_report.ai_enriched` = 1 (не 0).
- Для full_gdd из 38 секций (после TASK-6.1) с 25 auto_fill + 3 ai_enrich
  = 28/38 = 0.737.

**Риски**:
- Изменение semantics `coverage_score` может сломать downstream consumers
  (frontend `GDDPreview.tsx` может показывать progress bar). Митигация:
  проверить и обновить frontend; добавить комментарий о semantics.

**Dependencies**: TASK-6.7 (per-section ai_enrich может значительно увеличить coverage).

---

### TASK-6.14: Динамический `stages_completed` и `models_used`

**Сложность**: S
**Приоритет**: 🟡
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 958, 983-987)

**Описание проблемы**:

```ts
const stagesCompleted = [1, 2, 3, 4, 5, 6];  // hardcoded 6 stages
// ...
models_used: [
  "deterministic-gdd-v1",
  "section-assembler-v1",
  "consistency-checker-v1",
],  // hardcoded 3 model names
```

`stages_completed` не отражает actual pipeline state. `models_used` — три
идентификатора, не соответствующие actual code modules (нет
`deterministic-gdd-v1` module, `section-assembler-v1` — это inline loop в
route.ts, `consistency-checker-v1` — `buildConsistencyReport` function).

**Решение**:

```ts
// Dynamic stages_completed based on actual data sources used
const stagesCompleted: number[] = [];
if (concept) stagesCompleted.push(1);          // Block 1 (concept)
if (coreLoop) stagesCompleted.push(2);         // Block 2 (core loop)
if (mda) stagesCompleted.push(3);              // Block 3 (MDA)
if (balance) stagesCompleted.push(4);          // Block 4 (balance)
if (progression) stagesCompleted.push(5);      // Block 5a (progression)
if (economy) stagesCompleted.push(5);          // Block 5b (economy) — same stage as progression?
stagesCompleted.push(6);                        // Block 6 (this GDD)

// Dynamic models_used based on actual modules invoked
const modelsUsed: string[] = [
  "derive-section-content-v2",       // deriveSectionContent function
  "consistency-checker-v1",          // buildConsistencyReport function
  "markdown-assembler-v1",           // markdown assembly loop
];
if (useAi) {
  modelsUsed.push("glm-4.6 (gdd-advice)");  // enrichGdd
  // Если TASK-6.7 реализован:
  // modelsUsed.push("glm-4.6 (section-enrichment)");
}
if (targetFormat === "full_gdd") {
  modelsUsed.push("format-full-gdd-v2");
} else if (targetFormat === "modular") {
  modelsUsed.push("format-modular-v2");
}
// etc.
```

**Тест-кейсы**:
- Для проекта с только concept (без core loop, mda, etc.): `stages_completed = [1, 6]`.
- Для проекта со всеми блоками: `stages_completed = [1, 2, 3, 4, 5, 6]`.
- `models_used` содержит `"derive-section-content-v2"` (не `"deterministic-gdd-v1"`).
- Если `use_ai=false`: `models_used` НЕ содержит `"glm-4.6 (gdd-advice)"`.

**Риски**:
- Frontend может ожидать конкретные model names. Митигация: проверить и
  обновить frontend; добавить migration note.

**Dependencies**: нет.

---

### TASK-6.15: Удалить или объединить dead endpoints (`auto-fill`, `map`, `format`, `generate-full`)

**Сложность**: M
**Приоритет**: 🟡
**Файлы**:
- `src/app/api/v1/gdd/auto-fill/route.ts` (65 строк) — DELETE
- `src/app/api/v1/gdd/map/route.ts` (59 строк) — DELETE
- `src/app/api/v1/gdd/format/route.ts` (60 строк) — DELETE
- `src/app/api/v1/gdd/generate-full/route.ts` (61 строка) — DELETE или переписать

**Описание проблемы**:

Подтверждено grep: ни один из этих 4 endpoints не вызывается из:
- frontend (`src/components/gidede/gdd/*.tsx`)
- pipeline runner (`run-full-pipeline/route.ts`)
- test script (`run_pipeline_test.sh`)
- других route.ts

Все 4 возвращают упрощённые/несогласованные данные:

**`/gdd/auto-fill`** возвращает `{title, genre, synopsis, gameplay, features, ...}` —
НЕ совпадает с именами секций в `FORMAT_SECTIONS` (`title`, `concept`, `usp`,
`core_loop_summary`). Endpoint бесполезен для `/gdd/generate`.

**`/gdd/map`** возвращает hardcoded mapping 13 секций:
```ts
const mapping: Record<string, string | null> = {
  title: "concept",
  genre: "concept",
  synopsis: "concept",
  gameplay_overview: "core_loop",
  // ...
};
```
Не инспектирует actual available data (всегда возвращает одно и то же).

**`/gdd/format`** возвращает incompatible список 38 секций:
```ts
return [
  "title", "genre", "synopsis", "gameplay_overview", "core_mechanics",
  "progression", "economy", "balance", "art_style", "sound_design",
  // ... 33 имени, не 38
  "appendix_a", "appendix_b", "appendix_c",
  "glossary", "references", "change_log", "version_history",
  "team", "budget", "timeline",
];
```
НЕ соответствует Bible 11.3.3 (38 секций в 8 блоках) и
`FORMAT_SECTIONS["full_gdd"]` (21 секция в route.ts).

**`/gdd/generate-full`** — STUB, не вызывает реальный generate:
```ts
return NextResponse.json({
  format,
  section_count: sectionCount,
  available_sources: availableSources,
  coverage: Math.round((availableSources.length / 6) * 100),
  filled_sections: filled,  // только title, genre, synopsis
  filled_count: Object.keys(filled).length,
  stages_completed: ["format", "map", "auto-fill", "generate"],
  message: `GDD generated: ${format} format, ${Object.keys(filled).length}/${sectionCount} sections filled`,
});
```

**Решение**:

Вариант A (рекомендуемый) — удалить все 4 dead endpoints:

```bash
rm src/app/api/v1/gdd/auto-fill/route.ts
rm src/app/api/v1/gdd/map/route.ts
rm src/app/api/v1/gdd/format/route.ts
rm src/app/api/v1/gdd/generate-full/route.ts
```

Логика auto-fill / map / format уже встроена в `generate/route.ts`:
- auto-fill → `deriveSectionContent` function
- map → `data_mapping.active_mappings` field в response
- format → `FORMAT_SECTIONS` constant + `format_spec.sections` field в response

Вариант B (минимальный) — переписать как тонкие wrapper'ы:

`/gdd/format` → возвращает `FORMAT_SECTIONS_CANONICAL` из `src/constants/gdd.ts`:
```ts
import { FORMAT_SECTIONS_CANONICAL, GDD_FORMATS } from "@/constants/gdd";

export async function POST(request: NextRequest) {
  // ... auth + body parsing
  const format = body?.format;
  if (!FORMAT_SECTIONS_CANONICAL[format]) {
    return VALIDATION_ERROR(`Invalid format: ${format}`);
  }
  return NextResponse.json({
    format,
    section_count: FORMAT_SECTIONS_CANONICAL[format].length,
    sections: FORMAT_SECTIONS_CANONICAL[format],
    available_formats: GDD_FORMATS.map(f => f.value),
  });
}
```

`/gdd/map` → возвращает actual mapping из inspect available data:
```ts
import { FORMAT_SECTIONS_CANONICAL } from "@/constants/gdd";

export async function POST(request: NextRequest) {
  // ... load project with relations
  const availableSources: string[] = [];
  if (project.concept) availableSources.push("concept");
  // ... etc.
  const mapping = Object.fromEntries(
    FORMAT_SECTIONS_CANONICAL[format].map(s => [s, deriveSourceForSection(s, project)])
  );
  return NextResponse.json({ mapping, available_sources: availableSources });
}
```

`/gdd/auto-fill` → вызывает `deriveSectionContent` для каждой секции:
```ts
import { deriveSectionContent } from "@/lib/gdd-derive";  // extract function

export async function POST(request: NextRequest) {
  // ... load project
  const filled = Object.fromEntries(
    FORMAT_SECTIONS_CANONICAL[format].map(s => [s, deriveSectionContent(s, project, "ru").content])
  );
  return NextResponse.json({ filled_sections: filled, filled_count: Object.keys(filled).length });
}
```

`/gdd/generate-full` → либо удалить (вся логика уже в `/gdd/generate`), либо
сделать orchestration endpoint, который вызывает `/gdd/format` → `/gdd/map`
→ `/gdd/auto-fill` → `/gdd/generate` последовательно.

Рекомендую Вариант A (удалить) — самый чистый.

**Тест-кейсы**:
- После удаления: `curl -X POST /api/v1/gdd/auto-fill` → 404.
- Pipeline runner работает без изменений (не использует эти endpoints).
- Frontend `GDDFormatSelector.tsx` не падает (если использовал `/gdd/format`).
- Если выбран Вариант B: `/gdd/format` возвращает 38 секций для full (совпадает с Bible 11.3.3).

**Риски**:
- Frontend может использовать эти endpoints. Митигация: проверить все
  `src/components/gidede/gdd/*.tsx` файлы; если используются — обновить
  frontend или сохранить endpoints.

**Dependencies**: TASK-6.1 (если Вариант B — нужны canonical lists).

---

### TASK-6.16: Расширить `buildConsistencyReport` до real checks

**Сложность**: M
**Приоритет**: 🟡 (после TASK-6.4)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 583-678)

**Описание проблемы**:

`buildConsistencyReport` (route.ts:583-678) имеет только 3 типа checks:
1. `requires_review` → warning
2. `content.length < 20` → info
3. Hardcoded pair checks (`core_loop`+`mechanics`, `aesthetics`+`narrative`)

Никаких реальных consistency checks:
- USP exists in logline?
- Balance score коррелирует с mechanics complexity?
- Progression curve соответствует target duration?
- Economy pathologies отражены в narrative?
- Aesthetics consistent between sections?
- USP cited in multiple sections?
- Word count per section соответствует DETAIL_FACTOR?

**Решение**:

Расширить `buildConsistencyReport` с real consistency checks:

```ts
function buildConsistencyReport(
  sections: Record<string, { content: string; source: string; requires_review: boolean }>,
  sectionOrder: string[],
  project: ProjectData,
  detailLevel: string
): ConsistencyReport {
  const issues: ConsistencyIssue[] = [];

  // === Check 1: requires_review sections ===
  for (const key of sectionOrder) {
    const sec = sections[key];
    if (!sec) continue;
    if (sec.requires_review) {
      issues.push({
        severity: "warning",
        section_a: key,
        section_b: "review",
        issue_type: "incomplete_section",
        description: `Section "${key}" requires manual review (source: ${sec.source}).`,
        suggestion: "Заполните секцию вручную или уточните источник данных.",
      });
    }
    if (!sec.content || sec.content.trim().length < 20) {
      issues.push({
        severity: "info",
        section_a: key,
        section_b: "content_length",
        issue_type: "short_content",
        description: `Section "${key}" has very short content (${sec.content?.length || 0} chars).`,
        suggestion: "Расширьте описание секции.",
      });
    }
  }

  // === Check 2: USP consistency ===
  const usp = sections["usp"]?.content || "";
  const logline = sections["logline"]?.content || "";
  if (usp && logline && !logline.includes(usp.slice(0, 30))) {
    issues.push({
      severity: "info",
      section_a: "usp",
      section_b: "logline",
      issue_type: "usp_not_in_logline",
      description: "USP не цитируется в logline — рассмотрите возможность включить ключевую фразу USP в logline.",
      suggestion: "Добавьте ключевые слова USP в logline для согласованности.",
    });
  }

  // === Check 3: Balance score vs mechanics complexity ===
  const balance = project.balanceResult;
  const mechanicSet = project.concept?.mechanicSet
    ? safeJsonParse<Record<string, unknown>>(project.concept.mechanicSet, {})
    : {};
  const mechCount = Object.values(mechanicSet).reduce(
    (sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0
  );
  if (balance && mechCount > 0) {
    const balanceScore = balance.overallBalanceScore || 0;
    if (mechCount > 10 && balanceScore < 50) {
      issues.push({
        severity: "warning",
        section_a: "mechanics",
        section_b: "balance",
        issue_type: "complexity_balance_mismatch",
        description: `Mechanics count (${mechCount}) high but balance score low (${balanceScore}). Сложные игры требуют более тщательного баланса.`,
        suggestion: "Упростите mechanics или углубите balance analysis.",
      });
    }
  }

  // === Check 4: Progression curve vs target duration ===
  const progression = project.progression;
  if (progression) {
    const totalLevels = progression.totalLevels || 0;
    const targetHours = progression.targetDurationHours || 0;
    if (totalLevels > 0 && targetHours > 0) {
      const minutesPerLevel = (targetHours * 60) / totalLevels;
      if (minutesPerLevel < 5) {
        issues.push({
          severity: "info",
          section_a: "progression",
          section_b: "balance",
          issue_type: "fast_progression",
          description: `Progression too fast: ${minutesPerLevel.toFixed(1)} min/level. Игроки могут пропустить контент.`,
          suggestion: "Увеличьте target_duration_hours или уменьшите total_levels.",
        });
      } else if (minutesPerLevel > 60) {
        issues.push({
          severity: "info",
          section_a: "progression",
          section_b: "balance",
          issue_type: "slow_progression",
          description: `Progression too slow: ${minutesPerLevel.toFixed(1)} min/level. Игроки могут заскучать.`,
          suggestion: "Уменьшите target_duration_hours или добавьте больше уровней.",
        });
      }
    }
  }

  // === Check 5: Economy pathologies reflected in narrative ===
  const economy = project.economy;
  if (economy?.hasPathology && sections["narrative"]) {
    const narrContent = sections["narrative"].content || "";
    if (!/патолог|инфляц|стагнац|диссонанс/i.test(narrContent)) {
      issues.push({
        severity: "warning",
        section_a: "economy",
        section_b: "narrative",
        issue_type: "pathology_not_in_narrative",
        description: "Economy имеет патологии, но narrative не упоминает их — рассмотрите возможность отразить экономические проблемы в нарративе (или исправить экономику).",
        suggestion: "Добавьте в narrative упоминание экономических патологий, или исправьте economy для устранения патологий.",
      });
    }
  }

  // === Check 6: Aesthetics consistency between sections ===
  const aesthetics = sections["aesthetics"]?.content || sections["visual_style"]?.content || "";
  const narrative = sections["narrative"]?.content || "";
  if (aesthetics && narrative) {
    const primaryAesthetic = project.mdaProfile?.primaryAesthetic || project.concept?.primaryAesthetic;
    if (primaryAesthetic && !narrative.toLowerCase().includes(primaryAesthetic.toLowerCase())) {
      issues.push({
        severity: "info",
        section_a: "aesthetics",
        section_b: "narrative",
        issue_type: "aesthetic_not_in_narrative",
        description: `Primary aesthetic "${primaryAesthetic}" не упоминается в narrative.`,
        suggestion: "Добавьте упоминание primary aesthetic в narrative для согласованности.",
      });
    }
  }

  // === Check 7: Word count vs detail level ===
  const detailMinWords: Record<string, number> = {
    overview: 30, standard: 60, detailed: 120, exhaustive: 200,
  };
  const minWords = detailMinWords[detailLevel] || 60;
  for (const key of sectionOrder) {
    const sec = sections[key];
    if (!sec || sec.source === "manual") continue;
    const wordCount = (sec.content || "").split(/\s+/).filter(Boolean).length;
    if (wordCount < minWords) {
      issues.push({
        severity: "info",
        section_a: key,
        section_b: "detail_level",
        issue_type: "below_detail_min",
        description: `Section "${key}" has ${wordCount} words, but detail level "${detailLevel}" requires ≥${minWords}.`,
        suggestion: `Расширьте секцию до ≥${minWords} слов, или снизьте detail_level.`,
      });
    }
  }

  // === Check 8: Genre-section coverage ===
  const genreCriticalSections: Record<string, string[]> = {
    rpg: ["characters", "progression", "narrative", "quests"],
    shooter: ["mechanics", "balance", "game_modes"],
    narrative_bible: ["characters", "plot", "themes", "tone_voice"],
    strategy: ["mechanics", "balance", "economy", "tech_tree"],
    // ... etc.
  };
  const critical = genreCriticalSections[project.genre?.toLowerCase() || ""] || [];
  for (const sec of critical) {
    if (!sectionOrder.includes(sec)) {
      issues.push({
        severity: "warning",
        section_a: sec,
        section_b: "format",
        issue_type: "missing_critical_section",
        description: `Section "${sec}" is critical for genre "${project.genre}" but missing from format.`,
        suggestion: `Добавьте секцию "${sec}" через custom_sections параметр, или выберите формат, включающий её.`,
      });
    }
  }

  // ... остальные existing checks (pair mismatches)

  const errors = issues.filter(i => i.severity === "error").length;
  const warnings = issues.filter(i => i.severity === "warning").length;
  const infos = issues.filter(i => i.severity === "info").length;

  return { issues, error_count: errors, warning_count: warnings, info_count: infos, is_valid: errors === 0 };
}
```

**Тест-кейсы**:
- `07_gdd.json.assembled_document.consistency_report.issues` содержит
  конкретные issues (не только `requires_review` warnings).
- Для 10 test_projects: 10 РАЗНЫХ consistency reports (разные mechanics
  count, balance score, etc.).
- Если economy имеет pathology: issue `pathology_not_in_narrative`.
- Если balance_score < 50 и mechanics > 10: issue `complexity_balance_mismatch`.
- Если genre="rpg" и format="one_sheet" (нет characters): issue
  `missing_critical_section` для "characters".

**Риски**:
- Слишком много false-positive warnings может загрязнить отчёт. Митигация:
  настраивать thresholds, использовать severity "info" для soft checks.

**Dependencies**: TASK-6.4 (нужны meaningful derive cases для всех секций,
иначе "short_content" info будет спамом).

---

### TASK-6.17: Расширить Prisma `ProjectGDD` и type `GDDProfile`

**Сложность**: M
**Приоритет**: 🟡 (после TASK-6.9)
**Файлы**: `prisma/schema.prisma` (модель `ProjectGDD`, строки 285-304), `src/types/gdd.ts` (87-128)

**Описание проблемы**:

Prisma `ProjectGDD` (prisma/schema.prisma:285-304) не имеет полей:
- `aiInsights` — для persist AI advice (см. TASK-6.9)
- `modelsUsed` — для tracking использованных модулей
- `targetStage` — для фильтра по project_stage
- `lastUpdated` — для living documentation (Bible 11.9)
- `sectionAges` — для tracking возраста каждой секции
- `universalValidatorResult` — для persist Universal Design Validator output
- `consistencyReport` (отдельное поле) — сейчас embedded в `fullProfile`

`visualElements: String?` объявлено, но route.ts сохраняет туда `JSON.stringify({})`
(пустой объект).

TypeScript type `GDDProfile` (src/types/gdd.ts:87-128) не описывает:
- `ai_insights?: string` (добавляется post-persist)
- `models_used: string[]` (возвращается, но не в type)
- `latency_ms: number` (возвращается, но не в type)

**Решение**:

1. **Расширить Prisma schema** (см. TASK-6.9 для деталей):
   ```prisma
   model ProjectGDD {
     // ... existing fields
     aiInsights         String?   // NEW
     modelsUsed         String?   // NEW
     targetStage        String?   // NEW
     sectionAges        String?   // NEW (JSON { section_name: ISO date })
     lastUpdated        DateTime? @updatedAt  // NEW
     universalValidatorResult String?  // NEW (JSON с Universal Design Validator output)
   }
   ```

2. **Запустить migration**:
   ```bash
   npx prisma migrate dev --name extend_project_gdd
   ```

3. **Расширить TypeScript type `GDDProfile`** (src/types/gdd.ts):
   ```ts
   export interface GDDProfile {
     format_spec: GDDFormatSpec;
     data_mapping?: {...};
     auto_filled_sections?: {...};
     ai_enriched_sections?: {...};
     manual_skeletons?: {...};
     assembled_document?: GDDAssembledDocument;
     formatted_document?: GDDFormattedDocument;
     stages_completed: number[];
     coverage_score: number;
     latency_ms: number;
     // NEW fields:
     ai_insights?: string;          // LLM advice (если useAi=true)
     models_used?: string[];        // Список использованных modules/models
     target_stage?: string;         // project_stage param
     universal_design_validator?: { // После TASK-6.8
       levels: Array<{
         level: number;
         name: string;
         priority: "critical" | "important" | "secondary";
         checks: Array<{
           id: string;
           description: string;
           severity: "error" | "warning" | "info";
           result: { passed: boolean; score: number; details?: string; suggestion?: string };
         }>;
         passed_count: number;
         total_count: number;
         score: number;
       }>;
       overall_score: number;
       readiness: "ready" | "almost" | "not_ready";
       critical_issues: Array<{ level: number; id: string; description: string; suggestion?: string }>;
       warnings: Array<{ level: number; id: string; description: string; suggestion?: string }>;
       infos: Array<{ level: number; id: string; description: string; suggestion?: string }>;
     };
     section_ages?: Record<string, string>;  // ISO timestamps per section
   }
   ```

4. **Заполнить `visualElements`** реальными данными (см. TASK-6.18).

**Тест-кейсы**:
- `npx prisma migrate dev` успешно применяет migration.
- `db.projectGDD.findFirst().aiInsights` возвращает JSON-строку после POST с use_ai.
- TypeScript: `const p: GDDProfile = {...}` с `ai_insights` не вызывает type error.
- `GDDProfile` type включает `universal_design_validator` field.

**Риски**:
- Migration на production может потребовать downtime. Митигация: все новые
  поля nullable, migration безопасный.

**Dependencies**: TASK-6.8, TASK-6.9.

---

### TASK-6.18: Заполнить `visualElements` реальными данными + living documentation

**Сложность**: M
**Приоритет**: 🟢 (после TASK-6.17)
**Файлы**: `src/app/api/v1/gdd/generate/route.ts` (строки 1006, 1030), `src/types/gdd.ts`

**Описание проблемы**:

Route.ts сохраняет `visualElements: JSON.stringify({})` (пустой объект) в
БД. Поле бесполезно.

Bible 11.9 требует "living documentation" — каждая секция должна
отслеживать:
- Время последнего обновления
- Источник (auto_fill / ai_enrich / manual)
- Возраст (days since last update)
- Предупреждение если секция устарела (> 7 дней без обновления после
  последнего плейтеста)

**Решение**:

1. **Заполнить `visualElements`** реальными данными о visual hooks:
   ```ts
   const visualElements = {
     primary_hook: onePager.visual_hook || "—",
     key_art_prompt: `Game key art for ${proj.name}, genre: ${genre}, aesthetic: ${primaryAesthetic}`,
     color_palette: GENRE_COLOR_PALETTES[genre.toLowerCase()] || ["#000000", "#FFFFFF"],
     typography: GENRE_TYPOGRAPHY[genre.toLowerCase()] || "System sans-serif",
     icon_set: GENRE_ICON_SETS[genre.toLowerCase()] || [],
   };
   ```

2. **Реализовать living documentation tracking**:
   ```ts
   // Build section_ages from current timestamps + existing DB record
   const existingGdd = await db.projectGDD.findUnique({
     where: { projectId: proj.id },
     select: { sectionAges: true, updatedAt: true },
   });
   const existingAges = existingGdd?.sectionAges
     ? safeJsonParse<Record<string, string>>(existingGdd.sectionAges, {})
     : {};
   const sectionAges: Record<string, string> = {};
   for (const sectionName of sectionsList) {
     // Update timestamp only if content changed
     const newContent = sectionsContent[sectionName]?.content || "";
     const oldContent = /* from existingGdd.sections */ "";
     if (newContent !== oldContent) {
       sectionAges[sectionName] = new Date().toISOString();
     } else {
       sectionAges[sectionName] = existingAges[sectionName] || new Date().toISOString();
     }
   }
   profile.section_ages = sectionAges;
   ```

3. **Добавить warnings для устаревших секций** в consistency_report:
   ```ts
   const lastPlaytestAt = project.lastPlaytestAt;  // NEW field on Project
   if (lastPlaytestAt) {
     for (const [section, ageStr] of Object.entries(sectionAges)) {
       const age = new Date(ageStr);
       if (age < lastPlaytestAt) {
         issues.push({
           severity: "warning",
           section_a: section,
           section_b: "last_playtest",
           issue_type: "stale_section",
           description: `Section "${section}" last updated ${ageStr}, but playtest was on ${lastPlaytestAt}. Section is stale.`,
           suggestion: "Обновите секцию на основе результатов последнего плейтеста.",
         });
       }
     }
   }
   ```

4. **Расширить `Project` model** в Prisma с полем `lastPlaytestAt`:
   ```prisma
   model Project {
     // ... existing fields
     lastPlaytestAt DateTime?  // NEW: для living documentation
   }
   ```

**Тест-кейсы**:
- `db.projectGDD.findFirst().visualElements` содержит JSON с `primary_hook`,
  `key_art_prompt`, `color_palette` (не `{}`).
- `db.projectGDD.findFirst().sectionAges` содержит JSON с ISO timestamps для
  каждой секции.
- Если секция не обновлена после последнего плейтеста: consistency_report
  имеет issue `stale_section`.
- Если `lastPlaytestAt` = null: нет stale_section warnings.

**Риски**:
- `Project.lastPlaytestAt` — новое поле, требует UI для обновления.
  Митигация: пока nullable, обновляется через отдельный endpoint или
  manually.

**Dependencies**: TASK-6.17.

---

### TASK-6.19: Унифицировать `GDDFormatSpec` между route.ts и types/gdd.ts

**Сложность**: S
**Приоритет**: 🟢
**Файлы**: `src/types/gdd.ts`, `src/app/api/v1/gdd/generate/route.ts`, `src/constants/gdd.ts`

**Описание проблемы**:

`GDDFormatSpec` (types/gdd.ts:5-12):
```ts
export interface GDDFormatSpec {
  format: string;
  detail_level: string;
  sections: string[];
  estimated_pages: number;
  audience?: string;
  export_formats: string[];
}
```

Route.ts (строки 963-970) возвращает:
```ts
const formatSpec = {
  format: targetFormat,
  detail_level: detailLevel,
  sections: sectionsList,
  estimated_pages: estimatedPages,
  audience,
  export_formats: exportFormats,
};
```

Type соответствует, но `audience` помечен как optional в type, хотя route
всегда его возвращает (default "team_sync").

Дополнительно: `VALID_FORMATS` (route.ts:34-43), `FORMAT_PAGE_ESTIMATES`
(route.ts:157-166), `DETAIL_FACTOR` (route.ts:168-173) определены локально
в route.ts, но должны быть в `src/constants/gdd.ts` для переиспользования
(например, в frontend, в `/gdd/format` endpoint если он останется, в
pipeline runner для валидации).

**Решение**:

1. **Перенести константы в `src/constants/gdd.ts`**:
   ```ts
   export const GDD_FORMATS = [/* already exists */];

   export const VALID_FORMATS = GDD_FORMATS.map(f => f.value);

   export const FORMAT_PAGE_ESTIMATES: Record<string, number> = {
     one_sheet: 1,
     ten_pager: 10,
     treatment: 3,
     sketch_design: 15,
     full_gdd: 50,
     concept_doc: 8,
     narrative_bible: 30,
     modular: 40,
   };

   export const DETAIL_LEVELS = [/* already exists */];

   export const VALID_DETAIL_LEVELS = DETAIL_LEVELS.map(d => d.value);

   export const DETAIL_FACTOR: Record<string, number> = {
     overview: 0.5,
     standard: 1.0,
     detailed: 1.6,
     exhaustive: 2.3,
   };

   export const DOC_AUDIENCES = [/* already exists */];
   export const VALID_AUDIENCES = DOC_AUDIENCES.map(a => a.value);

   export const PROJECT_STAGES = [/* already exists */];
   export const VALID_STAGES = PROJECT_STAGES.map(s => s.value);
   ```

2. **Импортировать в route.ts**:
   ```ts
   import {
     VALID_FORMATS, FORMAT_PAGE_ESTIMATES, DETAIL_FACTOR,
     VALID_DETAIL_LEVELS, VALID_AUDIENCES, VALID_STAGES,
   } from "@/constants/gdd";
   ```

3. **Удалить локальные декларации** из route.ts (строки 34-58, 157-173).

4. **Сделать `audience` required в `GDDFormatSpec`** (если всегда возвращается):
   ```ts
   export interface GDDFormatSpec {
     format: string;
     detail_level: string;
     sections: string[];
     estimated_pages: number;
     audience: string;  // ← required (не optional)
     export_formats: string[];
   }
   ```

**Тест-кейсы**:
- `import { VALID_FORMATS } from "@/constants/gdd"` работает.
- Route.ts не имеет дублирующих деклараций.
- TypeScript: `const spec: GDDFormatSpec = { audience: undefined, ... }` → type error.

**Риски**:
- Frontend может импортировать из старых мест. Митигация: проверить и
  обновить frontend imports.

**Dependencies**: нет.

---

### TASK-6.20: Unit + integration тесты для Block 6

**Сложность**: L
**Приоритет**: 🟢 (после всех остальных задач)
**Файлы**: новый `test/gdd/generate.test.ts`, `test/gdd/checklist.test.ts`, `test/gdd/export.test.ts`, `test/lib/universal-design-validator.test.ts`

**Описание проблемы**:

В репозитории нет unit-тестов для Block 6. Все 10 test_projects — это
end-to-end pipeline runs, которые:
- Не покрывают edge cases (empty upstream, very short GDD, very long GDD).
- Не проверяют individual functions (`deriveSectionContent`, `buildConsistencyReport`).
- Не покрывают 8 форматов (все 10 test_projects используют full_gdd).
- Не покрывают Universal Design Validator.

**Решение**:

1. **Unit-тесты для `deriveSectionContent`** (`test/gdd/derive-section-content.test.ts`):
   ```ts
   import { describe, it, expect } from "vitest";
   import { deriveSectionContent } from "@/app/api/v1/gdd/generate/route";

   describe("deriveSectionContent", () => {
     it("returns title from project name", () => {
       const result = deriveSectionContent("title", mockProject, "ru");
       expect(result.content).toContain("# Test Project");
       expect(result.source).toBe("auto_fill");
     });

     it("returns narrative summary from mda.ludonarrativeCheck", () => {
       const result = deriveSectionContent("narrative", mockProjectWithMda, "ru");
       expect(result.content).toContain("## Narrative Summary");
       expect(result.content).toContain("Ludonarrative verdict");
     });

     it("returns characters from bondValidation", () => {
       const result = deriveSectionContent("characters", mockProjectWithBond, "ru");
       expect(result.content).toContain("## Characters");
       expect(result.content).toContain("Character 1");
     });

     it("returns controls from GENRE_CONTROL_PRESETS", () => {
       const result = deriveSectionContent("controls", mockProjectRpg, "ru");
       expect(result.content).toContain("WASD");
     });

     it("returns camera_perspective from GENRE_CAMERA_PRESETS", () => {
       const result = deriveSectionContent("camera_perspective", mockProjectShooter, "ru");
       expect(result.content).toContain("First-person");
     });

     it("returns placeholder for missing data", () => {
       const result = deriveSectionContent("resources", mockProjectNoEconomy, "ru");
       expect(result.source).toBe("manual");
       expect(result.requires_review).toBe(true);
     });

     it("handles 8 narrative sections separately (no duplication)", () => {
       const narrative = deriveSectionContent("narrative", mockProject, "ru");
       const characters = deriveSectionContent("characters", mockProject, "ru");
       const world = deriveSectionContent("world_overview", mockProject, "ru");
       expect(narrative.content).not.toEqual(characters.content);
       expect(narrative.content).not.toEqual(world.content);
       expect(characters.content).not.toEqual(world.content);
     });
   });
   ```

2. **Unit-тесты для `buildConsistencyReport`** (`test/gdd/consistency-report.test.ts`):
   ```ts
   describe("buildConsistencyReport", () => {
     it("flags requires_review sections as warnings", () => {...});
     it("flags short content as info", () => {...});
     it("flags USP not in logline as info", () => {...});
     it("flags complexity/balance mismatch as warning", () => {...});
     it("flags fast/slow progression as info", () => {...});
     it("flags economy pathology not in narrative as warning", () => {...});
     it("flags missing critical section for genre as warning", () => {...});
   });
   ```

3. **Unit-тесты для `runUniversalDesignValidator`** (`test/lib/universal-design-validator.test.ts`):
   ```ts
   describe("runUniversalDesignValidator", () => {
     it("returns 10 levels", () => {
       const result = runUniversalDesignValidator(mockProject, "rpg");
       expect(result.levels).toHaveLength(10);
     });

     it("assigns critical priority based on genre", () => {
       const rpgResult = runUniversalDesignValidator(mockProject, "rpg");
       const criticalLevels = rpgResult.levels.filter(l => l.priority === "critical").map(l => l.level);
       expect(criticalLevels).toEqual([6, 5, 8]);  // narrative, economy, experience

       const shooterResult = runUniversalDesignValidator(mockProject, "shooter");
       const shooterCritical = shooterResult.levels.filter(l => l.priority === "critical").map(l => l.level);
       expect(shooterCritical).toEqual([3, 4, 9]);  // core_loop, balance, interface
     });

     it("returns overall_score in [0, 1]", () => {...});
     it("returns readiness level based on score", () => {...});
   });
   ```

4. **Integration-тесты для `/gdd/generate`** (`test/gdd/generate-route.test.ts`):
   ```ts
   describe("POST /api/v1/gdd/generate", () => {
     it("returns 422 for invalid format", async () => {...});
     it("returns 422 for invalid detail_level", async () => {...});
     it("returns full GDD with 38 sections for format=full_gdd", async () => {...});
     it("returns modular with 13 sections for format=modular", async () => {...});
     it("returns narrative_bible with 8 sections", async () => {...});
     it("returns ai_insights when use_ai=true", async () => {...});
     it("does not return ai_insights when use_ai=false", async () => {...});
     it("persists ai_insights to DB", async () => {...});
     it("reads format from body.format (backward compat)", async () => {...});
     it("reads format from body.target_format", async () => {...});
     it("handles empty upstream (no concept, no coreLoop)", async () => {...});
   });
   ```

5. **Integration-тесты для `/gdd/checklist`** (`test/gdd/checklist-route.test.ts`):
   ```ts
   describe("POST /api/v1/gdd/checklist", () => {
     it("returns rich profile (not STUB)", async () => {...});
     it("returns different scores for different projects", async () => {...});
     it("returns universal_design_validator field", async () => {...});
     it("persists to ProjectChecklist", async () => {...});
   });
   ```

6. **Integration-тесты для `/gdd/export`** (`test/gdd/export-route.test.ts`):
   ```ts
   describe("POST /api/v1/gdd/export", () => {
     it("returns markdown for format=md", async () => {...});
     it("returns HTML for format=html", async () => {...});
     it("returns DOCX for format=docx", async () => {...});
     it("returns PDF for format=pdf", async () => {...});
     it("PDF is not truncated to 4000 chars", async () => {...});
     it("falls back gracefully when GDD not generated", async () => {...});
   });
   ```

7. **Edge case тесты**:
   - Empty project (no concept, no coreLoop, no mda)
   - Very short GDD (format=one_sheet, detail=overview)
   - Very long GDD (format=full_gdd, detail=exhaustive, 50+ pages)
   - All 8 formats tested
   - All 4 detail levels tested
   - All 5 audiences tested
   - All 5 project_stages tested
   - custom_sections + excluded_sections params
   - Language ru vs en

8. **Regression тесты** (по находкам аудита):
   - 10 test_projects: 10 РАЗНЫХ narrative contents (regression test для #6.2).
   - Pipeline runner с `format: "one_sheet"` → `format === "one_sheet"` (regression для #6.4).
   - `enrichGddSection` не имеет китайских символов (regression для #6.5).
   - `ai_insights` сохраняется в БД (regression для #6.6).
   - `has_formulas` не матчит base64 padding (regression для #6.11).
   - PDF export не обрезает контент (regression для #6.12).
   - Coverage_score учитывает ai_enrich (regression для #6.13).

**Тест-кейсы**:
- `npm test` запускает все тесты, 0 failures.
- `npm run test:coverage` показывает ≥ 80% coverage для `src/app/api/v1/gdd/`
  и `src/lib/universal-design-validator.ts`.
- 10 test_projects перегенерированы с фикстурами, все regression тесты проходят.

**Риски**:
- Большие тесты могут быть медленными (LLM calls). Митигация: mock LLM
  responses в unit-тестах, real LLM только в integration с标记 `@slow`.
- Test fixtures требуют DB setup. Митигация: использовать in-memory SQLite
  для unit-тестов, real PostgreSQL для integration.

**Dependencies**: TASK-6.1..6.19 (все остальные задачи должны быть готовы).

---

## Фазы рефакторинга

### Phase 1: Foundation (1-2 недели)
- TASK-6.5 (S) — починить field name mismatch в pipeline runner
- TASK-6.6 (M) — заменить STUB /gdd/checklist на checklist-logic.ts
- TASK-6.10 (S) — cache deriveSectionContent
- TASK-6.11 (S) — починить has_formulas regex
- TASK-6.13 (S) — реальное coverage_score
- TASK-6.14 (S) — динамический stages_completed + models_used

### Phase 2: Bible compliance (2-3 недели)
- TASK-6.1 (XL) — расширить FORMAT_SECTIONS["full_gdd"] до 38 секций
- TASK-6.2 (M) — расширить FORMAT_SECTIONS["modular"] до 13 модулей
- TASK-6.3 (L) — derive для 8 narrative секций отдельно
- TASK-6.4 (XL) — derive для 17 missing Bible секций
- TASK-6.16 (M) — расширить buildConsistencyReport

### Phase 3: AI integration + DB (1-2 недели)
- TASK-6.7 (M) — удалить dead code enrichGddSection + per-section enrichment
- TASK-6.9 (M) — перенести enrichGdd до persist + Prisma расширение
- TASK-6.17 (M) — расширить Prisma + types
- TASK-6.18 (M) — заполнить visualElements + living documentation

### Phase 4: Universal Design Validator (2-3 недели)
- TASK-6.8 (XL) — реализовать 10 уровней Universal Design Validator

### Phase 5: Polish + cleanup (1 неделя)
- TASK-6.12 (M) — починить mdToPdfLike pagination
- TASK-6.15 (M) — удалить dead endpoints
- TASK-6.19 (S) — унифицировать GDDFormatSpec
- TASK-6.20 (L) — unit + integration тесты

---

## Оценка трудозатрат

| Phase | Задачи | Часов (без тестов) | Часов (с тестами) |
|-------|--------|:------------------:|:-----------------:|
| 1 | 6.5, 6.6, 6.10, 6.11, 6.13, 6.14 | 20-30 | 30-45 |
| 2 | 6.1, 6.2, 6.3, 6.4, 6.16 | 60-90 | 80-120 |
| 3 | 6.7, 6.9, 6.17, 6.18 | 25-40 | 35-55 |
| 4 | 6.8 | 50-80 | 60-100 |
| 5 | 6.12, 6.15, 6.19, 6.20 | 20-35 | 50-80 |
| **Итого** | **20 задач** | **175-275** | **255-400** |

---

## Сводная карта задач

| # | Задача | Сложность | Приоритет | Phase |
|---|--------|:---------:|:---------:|:-----:|
| TASK-6.1 | Расширить FORMAT_SECTIONS["full_gdd"] до 38 секций | XL | 🔴 | 2 |
| TASK-6.2 | Расширить FORMAT_SECTIONS["modular"] до 13 модулей | M | 🔴 | 2 |
| TASK-6.3 | derive для 8 narrative секций отдельно | L | 🔴 | 2 |
| TASK-6.4 | derive для 17 missing Bible секций | XL | 🔴 | 2 |
| TASK-6.5 | Починить field name mismatch (format → target_format) | S | 🔴 | 1 |
| TASK-6.6 | Заменить STUB /gdd/checklist на checklist-logic.ts | M | 🔴 | 1 |
| TASK-6.7 | Удалить dead code enrichGddSection + per-section enrichment | M | 🔴 | 3 |
| TASK-6.8 | Реализовать Universal Design Validator (10 уровней) | XL | 🔴 | 4 |
| TASK-6.9 | Перенести enrichGdd до persist + Prisma | M | 🔴 | 3 |
| TASK-6.10 | Cache deriveSectionContent | S | 🟡 | 1 |
| TASK-6.11 | Починить has_formulas regex | S | 🟡 | 1 |
| TASK-6.12 | Починить mdToPdfLike pagination | M | 🟡 | 5 |
| TASK-6.13 | Реальное coverage_score | S | 🟡 | 1 |
| TASK-6.14 | Динамический stages_completed + models_used | S | 🟡 | 1 |
| TASK-6.15 | Удалить dead endpoints | M | 🟡 | 5 |
| TASK-6.16 | Расширить buildConsistencyReport | M | 🟡 | 2 |
| TASK-6.17 | Расширить Prisma + types | M | 🟡 | 3 |
| TASK-6.18 | Заполнить visualElements + living documentation | M | 🟢 | 3 |
| TASK-6.19 | Унифицировать GDDFormatSpec | S | 🟢 | 5 |
| TASK-6.20 | Unit + integration тесты | L | 🟢 | 5 |

**Итого**: 20 задач
- 🔴 Критичных: 9
- 🟡 Средних: 8
- 🟢 Низких: 3

---

## Приложения

### A. Подтверждённые находки на test_projects

| # | Находка | Подтверждение |
|---|---------|---------------|
| 1 | Все 10 test_projects имеют format=full_gdd (несмотря на script sending one_sheet) | `python3 -c "import json; [print(p, json.load(open(f'/home/z/my-project/repos/Gidede/test_projects/{p}/07_gdd.json'))['format_spec']['format']) for p in ['01_Shadow_Depths','02_Sky_Fortress','03_Rhythm_of_War','04_Crystal_Cascade','05_Void_Runner','06_Card_Lords','07_Frostbite','08_Star_Blazers','09_Harvest_Moonlight','10_Nitro_Rush']]"` → all 10 = "full_gdd" |
| 2 | Все 10 narrative секций идентичны | `python3 -c "...narratives = [json.load(open(...))['assembled_document']['sections']['narrative']['content'] for p in projects]; print(len(set(narratives)))"` → `1` (unique) |
| 3 | Все 10 test_projects имеют coverage_score=0.571 | Confirmed via JSON inspection |
| 4 | Все 10 test_projects имеют 21 секцию (не 38) | Confirmed: `len(assembled_document.sections) === 21` |
| 5 | Все 10 08_checklist.json имеют overall_score=53 | Confirmed via JSON inspection |
| 6 | Все 10 08_checklist.json scores целые 80/0/40/70/75 | Confirmed |
| 7 | ai_insights сохраняется в 07_gdd.json (POST response), но не в БД | Code inspection: route.ts:991-1042 persist before 1047-1058 enrichment |
| 8 | enrichGddSection — dead code | `grep -rn "enrichGddSection" src/` → only declaration + self-reference |
| 9 | has_formulas regex матчит любой "=" | `python3 -c "import re; print(bool(re.search(r'=|∑|∫|≤|≥', 'Color: red = danger')))"` → `True` |
| 10 | mdToPdfLike обрезает до 4000 символов | Code inspection: `escapedText.slice(0, 4000)` |
| 11 | FORMAT_SECTIONS["full_gdd"] имеет 21 секцию вместо 38 | Code inspection: route.ts:101-123 |
| 12 | FORMAT_SECTIONS["modular"] имеет 10 секций вместо 13 | Code inspection: route.ts:143-154 |
| 13 | 4 dead endpoints (auto-fill, map, format, generate-full) | `grep -rn "/gdd/auto-fill\|/gdd/map\|/gdd/format\|/gdd/generate-full" src/` → only in their own route.ts files |
| 14 | Pipeline runner отправляет `format` вместо `target_format` | Code inspection: run-full-pipeline/route.ts:158-161 vs generate/route.ts:689 |
| 15 | `/gdd/checklist` STUB, не вызывает checklist-logic.ts | `grep -n "checklist-logic" src/app/api/v1/gdd/checklist/route.ts` → empty |

### B. Bible 11.3.3 — 38 секций GDD (canonical)

См. TASK-6.1 для полного списка с IDs и labels.

### C. Bible 11.3.4 — 13 модулей (canonical)

См. TASK-6.2 для полного списка с module IDs и source blocks.

### D. Bible 11.6 — Universal Design Validator (10 уровней)

См. TASK-6.8 для структуры каждого уровня и adaptive prioritization.

### E. Существующие сильные стороны (сохранить)

1. **8 форматов** — шире Bible 11.3 (4 формата: One-Sheet / Ten-Pager /
   Full GDD / Modular). Дополнительные форматы (treatment, sketch_design,
   concept_doc, narrative_bible) — полезны для разных audiences.
2. **`DETAIL_FACTOR` multipliers** (0.5/1.0/1.6/2.3) — влияет на длину
   AI-секций, соответствует Bible 11.7 (treatment 3 страницы vs full_gdd 50+).
3. **`/gdd/export` real DOCX** через `docx` npm package с heading levels,
   bullets, bold/italic parsing — production-ready.
4. **`/gdd/export` real PDF** через Playwright (`generateRealPdf`) с
   graceful fallback — production-ready.
5. **`safeJsonParse`** для всех JSON-полей из БД — graceful handling
   malformed JSON.
6. **`getOwnedProject`** для auth + ownership checks — security-correct.
7. **`updateProjectStage(proj.id, "gdd")`** — корректное обновление stage
   после GDD generation.
8. **Markdown assembly** — корректный TOC + section assembly + word count.

---

*Конец плана рефакторинга Блока 6.*
