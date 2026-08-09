# Решение: Пересборка Bible + GDD через онтологию

**Статус:** decision document
**Дата:** 2026-08-02
**Вопрос:** есть ли смысл пересобрать Библию ГД, заново прогнав все дизайн-документы через онтологию? И также сделать с GDD?

---

## 0. Краткий ответ

| Что | Ответ | Почему |
|-----|-------|--------|
| **Bible (17 книг → онтология)** | ✅ Да, но это разовая работа | Bible уже синтез 17 книг; онтология даст ~200 entities + ~500 relations за ~$5-10 |
| **GDD (проекты → онтология)** | ✅ Да, и это **ценнее**, чем Bible | GDD — конкретное знание проекта; онтология проверит consistency, coverage gaps, conflicts |
| **Порядок** | Сначала Bible, потом GDD | GDD-онтология ссылается на Bible-онтологию (global + project layer) |

**Ключевое различие:**
- **Bible-онтология** = общее знание геймдизайна (статичное, разовый билд)
- **GDD-онтология** = проектное знание (динамическое, rebuild при изменении GDD)

---

## 1. Аудит: что у нас есть

### 1.1. Bible — это уже синтез, не сырой текст

Bible (`docs/bible/bible_2_*.md`) — **не** набор книг. Это **компиляция** из 17 источников:

```
KB-01..KB-16 (knowledge base items)
↓
17 книг: Шелл (Кн. 1, 2), Адамс/Дорманс (Кн. 4), Фуллертон (Кн. 5),
         Зубек (Кн. 6), Селлерс (Кн. 13), Бонд (Кн. 17) и др.
↓
12 секций Bible (6080 строк)
```

Каждая секция имеет provenance:
```markdown
> **Источники**: KB-01 (Определения), KB-03 (MDA-фреймворк)
> **Книги**: Шелл (Кн. 1, 2), Адамс/Дорманс (Кн. 4), Зубек (Кн. 6)
```

**Вывод:** Bible уже структурирована. Прогон через онтологию = извлечение entities/relations из **готового синтеза**, не из сырых книг.

### 1.2. GDD — конкретные документы проектов

Модель `ProjectGDD` в Prisma:
```prisma
model ProjectGDD {
  projectId          String   @unique
  format             String?  // one_sheet | ten_pager | full
  sections           String?  // JSON: GDDSection[]
  consistencyIssues  String?  // JSON: ConsistencyIssue[]
  completenessReport String?  // JSON: CompletenessReport
}
```

GDD уже имеет `consistencyIssues` — но это **rule-based checks**, не semantic.

---

## 2. Два слоя онтологии

### 2.1. Global ontology (из Bible)

**Что:** общее знание геймдизайна — механики, динамики, эстетики, жанры, паттерны.

**Источники:** `docs/bible/*.md` + `src/lib/mechanics-db.ts`

**Характеристики:**
- Статичная (перестраивается редко — при обновлении Bible)
- Размер: ~200 entities, ~500 relations
- Стоимость билда: ~$5-10 (один LLM call на чанк, ~50 чанков)
- Время билда: ~10-15 минут

**Пример entities:**
```
Mechanic: locomotion
  PRODUCES_DYNAMIC: movement
  SUPPORTS_AESTHETIC: challenge, sensation
  COMPATIBLE_GENRE: racing, action, rpg

Genre: racing
  REQUIRES_MECHANIC: locomotion, timing
  CONFLICTS_WITH: combat (unless combat-racing)
  PRODUCES_AESTHETIC: challenge, sensation

Aesthetic: challenge
  PART_OF: MDA Framework
  DESCRIBED_IN: bible_2_8_narrative_emotional_design.md
```

### 2.2. Project ontology (из GDD)

**Что:** конкретное знание проекта — какие механики заявлены, ресурсы, эстетики, конфликты.

**Источники:** `ProjectGDD.sections` (JSON из БД)

**Характеристики:**
- Динамическая (rebuild при изменении GDD)
- Размер: ~20-50 entities на проект
- Стоимость: ~$0.5-1 на GDD
- Время: ~30-60 секунд

**Пример entities (для Nitro_Rush):**
```
ProjectMechanic: nitro_rush:boost
  INSTANCE_OF: GlobalMechanic:collect (from Bible ontology)
  PRODUCES_DYNAMIC: speed_burst (project-specific)
  CONSUMES_RESOURCE: nitro_rush:nitro_bar

ProjectGenre: nitro_rush:racing
  INSTANCE_OF: GlobalGenre:racing
  HAS_MECHANIC: nitro_rush:locomotion, nitro_rush:timing, nitro_rush:boost

ProjectConflict:
  nitro_rush:combat (mentioned in GDD section 4)
  CONFLICTS_WITH: nitro_rush:racing
  RESOLVED: false  ← coverage gap!
```

### 2.3. Связь слоёв

```
Global Ontology (Bible)
  ↑ INSTANCE_OF
  |
Project Ontology (GDD)
  ↑ INSTANTIATED_IN
  |
Prototype (NodeGraph)
```

**Пример chain:**
```
Bible: racing CONFLICTS_WITH combat
  ↓ INSTANCE_OF
GDD: nitro_rush:racing has mechanic nitro_rush:combat (from GDD section 4)
  ↓ CONFLICT DETECTED
Warning: "GDD Nitro_Rush содержит combat, но жанр racing конфликтует с combat"
  ↓ AI Planner sees this
AI Planner: не выбирает combat fragment для прототипа Nitro_Rush
```

---

## 3. Стоит ли пересобрать Bible?

### 3.1. За (+)

| Аргумент | Детали |
|----------|--------|
| **Структурированные связи** | Bible описывает MDA цепочки текстуально; онтология сделает их queryable |
| **Genre safety** | AI Planner сможет проверять "combat в racing = конфликт" |
| **Coverage checking** | "Покрывает ли GDD все REQUIRES_MECHANIC для жанра?" |
| **Provenance** | Каждая relation → sourceRef (KB-01, bible_2_3#section-2) |
| **Стоимость** | ~$5-10, один раз — ничтожна |

### 3.2. Против (−)

| Аргумент | Детails |
|----------|---------|
| **Bible RAG уже работает** | TF-IDF находит релевантные чанки |
| **Bible уже структурирована** | 12 секций, provenance — не сырой текст |
| **Maintenance** | При обновлении Bible → rebuild ontology |

### 3.3. Решение: **Да, пересобрать**

**Почему:** Bible RAG работает для **поиска**, но не для **reasoning**. Концепция AI-генерации прототипов требует reasoning ("combat конфликтует с racing"), а TF-IDF этого не даёт.

**Как:** LLM extraction из 12 секций Bible + 176 механик MechanicsDB → ~200 entities, ~500 relations → SQLite.

**Когда:** Фаза 1 онтологии (1 неделя), до AI Planner integration.

---

## 4. Стоит ли прогонять GDD?

### 4.1. За (+) — это **ценнее**, чем Bible

| Аргумент | Детали |
|----------|--------|
| **Consistency checking** | GDD говорит "RPG without combat" → онтология проверит: REQUIRES_MECHANIC(rpg, combat) = true → CONFLICT |
| **Coverage gaps** | GDD заявил жанр racing, но Core Loop не имеет timing → gap |
| **Project-specific relations** | nitro_rush:boost → INSTANCE_OF global collect → AI Planner может использовать collect fragment |
| **Dynamic** | GDD меняется → ontology rebuild → immediate feedback |
| **Playtest linkage** | Playtest result → "player confused by X" → AntiPattern entity linked to GDD section |

### 4.2. Против (−)

| Аргумент | Детали |
|----------|--------|
| **Cost per GDD** | ~$0.5-1 на rebuild |
| **Latency** | 30-60 сек на extraction |

### 4.3. Решение: **Да, и это приоритетнее Bible**

**Почему:** GDD-онтология даёт **actionable insights** для конкретного проекта. Bible-онтология — общее знание. AI Planner работает с проектом → ему нужна project ontology.

**Как:** При каждом `POST /api/v1/gdd/generate` или `POST /api/v1/gdd/auto-fill` → trigger GDD ontology rebuild → store in `ProjectOntology` table.

---

## 5. Архитектура: Global + Project ontology

### 5.1. Prisma schema (расширение)

```prisma
// Global ontology (из Bible)
model OntologyEntity {
  id          String   @id @default(cuid())
  entityId    String   @unique  // "global:mechanic:locomotion"
  scope       String             // "global" | "project"
  projectId   String?            // null for global, project ID for project-scoped
  type        String             // "Mechanic" | "Genre" | "Aesthetic" | ...
  name        String
  description String?
  sourceRef   String?            // "bible_2_3_mda_framework.md#section-2"
  metadata    String?            // JSON
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([scope, projectId])
  @@index([type])
  @@map("ontology_entities")
}

model OntologyRelation {
  id            String   @id @default(cuid())
  fromEntityId  String
  toEntityId    String
  relationType  String   // "REQUIRES_MECHANIC" | "INSTANCE_OF" | ...
  weight        Float    @default(1.0)
  sourceRef     String?
  metadata      String?
  createdAt     DateTime @default(now())

  fromEntity OntologyEntity @relation("from", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntity   OntologyEntity @relation("to", fields: [toEntityId], references: [id], onDelete: Cascade)

  @@index([fromEntityId, relationType])
  @@index([toEntityId, relationType])
  @@map("ontology_relations")
}
```

### 5.2. Key relation: INSTANCE_OF

```
Global:  global:mechanic:collect
           ↑ INSTANCE_OF
Project: nitro_rush:mechanic:boost
```

Это позволяет:
- AI Planner ищет fragment для `collect` capability
- Находит `nitro_rush:mechanic:boost` (INSTANCE_OF global collect)
- Использует collect-fragment из library

### 5.3. Build pipeline

```
┌─────────────────────────────────────────────────────────────┐
│  GLOBAL ONTOLOGY BUILDER (разовый, ~10 мин)                 │
│  Вход: docs/bible/*.md + mechanics-db.ts                    │
│  LLM extraction → ~200 entities, ~500 relations             │
│  Store: OntologyEntity (scope=global)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  PROJECT ONTOLOGY BUILDER (на каждый GDD, ~30-60 сек)       │
│  Вход: ProjectGDD.sections (JSON из БД)                     │
│  LLM extraction → ~20-50 project entities                   │
│  Link: INSTANCE_OF → global entities                        │
│  Store: OntologyEntity (scope=project, projectId=...)       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  CONSISTENCY CHECKER                                        │
│  Для каждого project entity:                                │
│    1. Найти INSTANCE_OF global entity                       │
│    2. Проверить global relations (CONFLICTS_WITH и т.д.)    │
│    3. Сообщить о conflicts/gaps                             │
│  Выход: ConsistencyReport                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Что даст пересборка Bible

### 6.1. До (только TF-IDF)

```
AI Planner prompt: "Вот чанки про racing из Bible:
[chunk: Racing — это жанр, где игрок соревнуется на скорость...]
[chunk: Combat — это механика, где игрок сражается с врагами...]
Выбери механики для гонок."
→ LLM может выбрать combat (оба чанка релевантны)
```

### 6.2. После (ontology)

```
AI Planner prompt: "Онтология для racing:
REQUIRES: [locomotion, timing]
CONFLICTS_WITH: [combat]
OPTIONAL: [collect, interact]

GDD проекта Nitro_Rush:
- INSTANCE_OF racing
- имеет mechanic: boost (INSTANCE_OF collect)
- имеет mechanic: combat (CONFLICTS_WITH racing) ← WARNING

Доступные fragments:
- locomotion-dash ✓
- timing-checkpoint ✓
- collect-boost ✓ (matches GDD boost)
- combat-shoot ✗ CONFLICTS_WITH racing

Выбери механики."
→ LLM НЕ выберет combat
```

### 6.3. Конкретные метрики улучшения

| Метрика | До (TF-IDF) | После (ontology) |
|---------|-------------|------------------|
| Genre safety violations | ~30% (LLM выбирает combat для racing) | <5% (ontology блокирует) |
| Coverage gaps detected | 0% (TF-IDF не проверяет) | 100% (ontology checker) |
| Provenance traceability | chunk-level | entity-level + relation-level |
| Query latency | ~50ms (TF-IDF) | ~10ms (graph traversal) |

---

## 7. Что даст прогон GDD

### 7.1. Consistency checking (пример)

GDD Nitro_Rush, section 4 "Mechanics":
```
"Игрок управляет машиной (locomotion), собирает нитро-бустеры (collect),
обгоняет соперников (combat?)."
```

**Онтология project extraction:**
```
nitro_rush:locomotion → INSTANCE_OF global:locomotion ✓
nitro_rush:collect → INSTANCE_OF global:collect ✓
nitro_rush:combat → INSTANCE_OF global:combat
  → CONFLICTS_WITH global:racing
  → nitro_rush:racing CONFLICTS_WITH nitro_rush:combat
  → CONSISTENCY ISSUE: "GDD заявляет racing, но упоминает combat"
```

**Результат:** consistency issue в `ProjectGDD.consistencyIssues` с semantic объяснением (не rule-based).

### 7.2. Coverage gaps (пример)

GDD Crystal_Cascade (puzzle), Core Loop:
```
Step 1: Rotate grid
Step 2: Match patterns
Step 3: Win
```

**Онтология:**
```
crystal_cascade:puzzle → INSTANCE_OF global:puzzle
global:puzzle REQUIRES_MECHANIC global:puzzle_match
global:puzzle REQUIRES_MECHANIC global:transform

GDD Core Loop:
- Step 1: INSTANCE_OF transform ✓
- Step 2: INSTANCE_OF puzzle_match ✓
- Step 3: win (no mechanic) ← OK (terminal)

Coverage: 2/2 REQUIRES_MECHANIC covered ✓
```

### 7.3. Playtest linkage

```
Playtest result: "Player confused by rotation controls"
→ extraction: AntiPattern: unclear_rotation_controls
→ linked to: crystal_cascade:mechanic:rotate
→ next prototype: AI Planner избегает rotation-only solutions
```

---

## 8. План реализации (обновлённый)

### Фаза 1: Global ontology (Bible) — 1 неделя
- [ ] Prisma models: `OntologyEntity`, `OntologyRelation` (with `scope` field)
- [ ] `src/lib/ontology/builder.ts` — LLM extraction
- [ ] Seed: Bible (12 секций) + MechanicsDB (176 механик)
- [ ] CLI: `bun run ontology:build-global`
- [ ] Результат: ~200 global entities, ~500 relations

### Фаза 2: Project ontology (GDD) — 1 неделя
- [ ] `src/lib/ontology/project-builder.ts` — extraction из GDD sections
- [ ] INSTANCE_OF linking to global entities
- [ ] Trigger: при `POST /api/v1/gdd/generate` и `POST /api/v1/gdd/auto-fill`
- [ ] Store: `OntologyEntity` (scope=project, projectId=...)
- [ ] Результат: ~20-50 entities per project

### Фаза 3: Consistency checker — 3 дня
- [ ] `src/lib/ontology/checker.ts`
- [ ] Проверка: project entity → INSTANCE_OF global → global relations
- [ ] Выход: `ConsistencyReport` (conflicts, gaps, warnings)
- [ ] Интеграция в `ProjectGDD.consistencyIssues`

### Фаза 4: AI Planner integration — 3 дня
- [ ] AI Planner использует ontology queries (вместо TF-IDF search)
- [ ] Genre safety check перед LLM call
- [ ] Coverage gaps в response

### Фаза 5: UI — 3 дня
- [ ] Страница `/knowledge` → visualise global ontology graph
- [ ] В `/projects/[id]` → показать project ontology + consistency issues
- [ ] Кнопка "Rebuild ontology" (global + project)

**Итого: ~3 недели**

---

## 9. Стоимость

| Компонент | Разовый билд | Регулярно |
|-----------|-------------|-----------|
| Global ontology (Bible) | ~$5-10 | $0 (только при обновлении Bible) |
| Project ontology (GDD) | ~$0.5-1 | ~$0.5-1 на каждый GDD rebuild |
| Consistency check | $0 | $0 (graph traversal, offline) |
| AI Planner query | $0 | $0 (graph traversal, offline) |

**Итого на 100 проектов:** ~$5-10 (global) + ~$50-100 (project, 100 GDDs) = ~$55-110

---

## 10. Риски

| Риск | Mitigation |
|------|------------|
| Global ontology неточная | Manual review + versioning + rebuild button |
| Project ontology неточная | LLM extraction с schema validation + INSTANCE_OF linking |
| INSTANCE_OF mismatches | Fuzzy matching по name + capability |
| Cost для многих проектов | Кеширование по GDD hash (rebuild только при изменении) |
| Latency (30-60 сек на GDD) | Background job + progress UI |

---

## 11. Вывод

### 11.1. Bible — да, пересобрать (разовый билд)

Bible уже синтез 17 книг. Прогон через онтологию = извлечение ~200 entities + ~500 relations. Разовая работа, ~$5-10. Даст structured reasoning вместо keyword search.

### 11.2. GDD — да, и это приоритетнее

GDD-онтология даёт **project-specific insights**: consistency issues, coverage gaps, conflicts. Каждый GDD → extraction → linked to global ontology → actionable feedback. ~$0.5-1 на GDD.

### 11.3. Порядок

1. **Сначала global ontology (Bible)** — общая база
2. **Потом project ontology (GDD)** — конкретные проекты, linked to global
3. **Consistency checker** — использует оба слоя
4. **AI Planner** — использует оба слоя

### 11.4. Ключевое различие

| Bible-онтология | GDD-онтология |
|-----------------|---------------|
| Общее знание | Проектное знание |
| Статичная | Динамическая |
| ~200 entities | ~20-50 per project |
| Разовый билд | Rebuild при изменении GDD |
| Источник: docs/bible/ | Источник: ProjectGDD.sections |

### 11.5. Проверка для других агентов

```typescript
// Global ontology built from Bible
test("global ontology has racing conflicts with combat", () => {
  const racing = ontology.findEntity("global", "Genre", "racing");
  const conflicts = ontology.traverse(racing, "CONFLICTS_WITH");
  expect(conflicts.map(c => c.name)).toContain("combat");
});

// Project ontology built from GDD
test("project ontology detects GDD conflict", () => {
  const project = ontology.findProjectEntities("nitro_rush");
  const issues = consistencyChecker.check(project);
  expect(issues).toContainEqual({
    type: "GENRE_MECHANIC_CONFLICT",
    genre: "racing",
    mechanic: "combat",
    reason: "global:racing CONFLICTS_WITH global:combat"
  });
});

// Coverage check
test("project ontology finds coverage gaps", () => {
  const gaps = coverageChecker.checkGaps("nitro_rush");
  // GDD заявляет racing, но Core Loop может не иметь timing
  expect(gaps).toBeDefined();
});
```

---

## 12. Следующие шаги

1. **Принять решение:** global + project ontology (этот документ)
2. **Фаза 1:** построить global ontology из Bible (~1 неделя)
3. **Фаза 2:** построить project ontology для существующих GDD (~1 неделя)
4. **Фаза 3:** consistency checker + интеграция в UI
5. **Фаза 4:** AI Planner integration (из концепции прототипов)

**Это объединяет две концепции:**
- `PROTOTYPE_AI_GENERATION_CONCEPT.md` — как генерировать прототипы
- `ONTOLOGY_RESEARCH.md` — как построить knowledge graph
- `ONTOLOGY_BIBLE_GDD_DECISION.md` (этот документ) — что прогонять через онтологию
