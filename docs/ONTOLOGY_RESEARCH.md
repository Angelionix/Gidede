# Исследование: Онтологии и Knowledge Graph для Gidede

**Статус:** research document (не implementation)
**Дата:** 2026-08-02
**Вопрос:** можно ли применить онтологии для улучшения работы LLM с базой знаний Gidede, и стоит ли прогонять через онтологию книги/курсы по геймдизайну и GDD.

---

## 0. Краткий ответ

**Да, можно и стоит.** Онтологии решают главную проблему текущего Bible RAG: TF-IDF находит **похожие слова**, но не **понимает связи** между концепциями. Онтология добавляет слой "причина → следствие", который критичен для геймдизайна.

**Но** не нужно строить онтологию с нуля вручную. Лучший подход — **LLM-extracted knowledge graph**: LLM автоматически извлекает сущности и отношения из текста, строит граф, и поиск идёт по графу, а не по bag-of-words.

**Конкретная выгода для Gidede:** AI Planner (из концепции прототипов) сможет отвечать на вопросы вида "если я добавлю механику X в жанр Y, какие dynamics это создаст и какие aesthetics затронет?" — это невозможно с текущим TF-IDF.

---

## 1. Что такое онтология в контексте LLM

### 1.1. Определение

**Онтология** — формальная модель знаний, описывающая:
- **Сущности** (entities): классы объектов (Mechanic, Aesthetic, Genre, Resource)
- **Отношения** (relations): связи между сущностями (Mechanic *produces* Dynamic, Dynamic *creates* Aesthetic)
- **Аксиомы** (axioms): правила (если Genre=Racing, то NOT(hasMechanic=Combat) — если только не combat-racing)

### 1.2. Чем отличается от RAG (который уже есть в Gidede)

| Аспект | Bible RAG (сейчас) | Онтология / Knowledge Graph |
|--------|-------------------|----------------------------|
| **Что хранит** | Чанки текста ~500 токенов | Сущности + отношения (граф) |
| **Как ищет** | TF-IDF (слово встречается → релевантно) | Графовый обход (связанные сущности) |
| **Что находит** | "Похожие куски текста" | "Причинно-следственные цепочки" |
| **Пример запроса** | "MDA framework" → найдёт чанк с MDA | "что будет если добавить combat в racing?" → найдет, что combat создаёт challenge dynamic, который конфликтует with pacing dynamic of racing |
| **Обновление** | Перечанковка текста | Добавить node/edge в граф |
| **Стоимость** | Дёшево (TF-IDF offline) | Дороже (LLM extraction для построения) |

### 1.3. Аналогия

- **RAG** = библиотекарь, который ищет книги по ключевым словам в оглавлении
- **Онтология** = библиотекарь, который знает, что "книга A ссылается на книгу B, а книга B опровергает книгу C"

---

## 2. Технические подходы (state of the art 2024-2025)

### 2.1. GraphRAG (Microsoft Research, 2024)

**Что:** open-source фреймворк от Microsoft. LLM читает тексты, извлекает сущности и отношения, строит knowledge graph, иерархически кластеризует, и при запросе обходит граф.

**Архитектура:**
```
Текст → LLM extraction → Entities + Relations → Knowledge Graph
                                                         ↓
Запрос → LLM generates subgraph query → Graph traversal → Context → LLM answer
```

**Преимущества:**
- Автоматическое построение (не нужно вручную онтологию)
- Иерархическая кластеризация (community detection)
- Handles "global" queries ("какие общие темы в всех книгах?")

**Недостатки:**
- Дорогая индексация (LLM вызовы на каждый чанк)
- ~$100-500 на индексацию большой базы знаний
- Complex deployment

**Репозиторий:** https://github.com/microsoft/graphrag

### 2.2. LightRAG (академический, 2024)

**Что:** более лёгкая альтернатива GraphRAG. Тот же принцип (LLM extraction + graph), но проще в развёртывании и дешевле.

**Преимущества:**
- Дешевле GraphRAG в 5-10 раз
- Проще интеграция
- Поддерживает incremental updates

**Репозиторий:** https://github.com/HKUDS/LightRAG

### 2.3. Neo4j + LLM (knowledge graph classic)

**Что:** вручную или через LLM строим граф в Neo4j, запросы через Cypher.

**Преимущества:**
- Полный контроль над схемой
- Production-grade
- Visualisation

**Недостатки:**
- Нужно поднимать Neo4j (extra dependency)
- Ручная поддержка схемы

### 2.4. Simple LLM-extracted JSON graph (минимальный подход)

**Что:** LLM извлекает сущности и отношения в JSON, храним в SQLite, поиск — простые graph queries.

**Преимущества:**
- Нет external dependencies
- Полный контроль
- Дёшево

**Недостатки:**
- Меньше фич (нет community detection)
- Нужно самим писать queries

---

## 3. Аудит текущей базы знаний Gidede

### 3.1. Что есть сейчас

| Компонент | Объём | Метод | Сильные стороны | Слабые стороны |
|-----------|-------|-------|-----------------|----------------|
| **Bible RAG** | 12 секций, ~494 чанка, 6080 строк | TF-IDF (offline) | Быстро, бесплатно, работает | Не понимает связи, только слово-в-слово |
| **MechanicsDB** | 176 механик, 15 групп | Статичный массив | Структурированный, быстрый lookup | Нет отношений между механиками |
| **AestheticsDB** | 8 эстетик (MDA) | Константы | Простота | Нет связей mechanic↔aesthetic |
| **GenresDB** | ~20 жанров | Константы | Простота | Нет связей genre↔mechanic↔aesthetic |

### 3.2. Чего не хватает (для концепции AI-генерации прототипов)

Из концепции `PROTOTYPE_AI_GENERATION_CONCEPT.md`, AI Planner должен:
- Выбирать механики для Core Loop steps
- Учитывать жанр (racing → НЕ combat)
- Понимать, какие dynamics создаёт механика
- Знать, какие aesthetics затрагивает

**Текущий TF-IDF этого не может.** Пример:

```
Запрос: "какие механики подходят для racing?"
TF-IDF найдёт: чанки, где встречается слово "racing"
Онтология найдёт:
  racing REQUIRES locomotion
  racing REQUIRES timing
  racing CONFLICTS_WITH combat (unless combat-racing)
  racing PRODUCES aesthetics: challenge, sensation
  locomotion PRODUCES dynamics: movement, positioning
  timing PRODUCES dynamics: precision, rhythm
```

### 3.3. Какие книги/материалы есть в проекте

Из `docs/bible/`:
1. bible_2_1_fundament.md — основы геймдизайна
2. bible_2_2_elements.md — элементы игры (MDA, формальные элементы)
3. bible_2_3_mda_framework.md — MDA Framework (Hunicke/LeBlanc/Zubek)
4. bible_2_4_core_loop.md — Core Loop (engaged/fixated)
5. bible_2_5_balance.md — транситивный/интранзитивный баланс, Nash
6. bible_2_6_economy_progression.md — Machinations, кривые прогрессии
7. bible_2_7_level_design.md — level design принципы
8. bible_2_8_narrative_emotional_design.md — нарратив, 8 эстетик
9. bible_2_9_monetization_retention.md — монетизация, retention
10. bible_2_10_playtesting_iteration.md — playtesting, итерация
11. bible_2_11_gdd_templates_checklists.md — GDD шаблоны
12. bible_2_12_compilation.md — компиляция всего

**Плюс MechanicsDB** — 176 механик с описаниями, aesthetics, genres.

Это **готовый материал** для построения онтологии.

---

## 4. Предлагаемая онтология для Gidede

### 4.1. Схема (T-box — терминология)

```
Сущности (Classes):
  - Game
  - Genre
  - Mechanic
  - Dynamic
  - Aesthetic
  - Resource
  - CoreLoopStep
  - PlaytestHypothesis
  - DesignPattern
  - AntiPattern

Отношения (Relations):
  - Genre HAS_MECHANIC (Genre → Mechanic)
  - Genre REQUIRES_MECHANIC (Genre → Mechanic) — обязательная
  - Genre CONFLICTS_WITH_MECHANIC (Genre → Mechanic) — нежелательная
  - Mechanic PRODUCES_DYNAMIC (Mechanic → Dynamic)
  - Dynamic CREATES_AESTHETIC (Dynamic → Aesthetic)
  - Mechanic CONSUMES_RESOURCE (Mechanic → Resource)
  - Mechanic PRODUCES_RESOURCE (Mechanic → Resource)
  - CoreLoopStep IMPLEMENTED_BY (CoreLoopStep → Mechanic)
  - DesignPattern SOLVES (DesignPattern → Problem)
  - AntiPattern LEADS_TO (AntiPattern → Problem)
  - PlaytestHypothesis TESTS (PlaytestHypothesis → Dynamic)

Аксиомы (Rules):
  - IF Genre = Racing THEN NOT(REQUIRES_MECHANIC(Combat)) UNLESS SubGenre = CombatRacing
  - IF Mechanic PRODUCES_DYNAMIC D AND D CREATES_AESTHETIC A THEN Mechanic SUPPORTS_AESTHETIC A
  - IF CoreLoop HAS_STEP S AND S IMPLEMENTED_BY M THEN Game USES_MECHANIC M
  - IF Genre REQUIRES_MECHANIC M AND Game NOT(USES_MECHANIC M) THEN Game HAS_COVERAGE_GAP
```

### 4.2. Пример данных (A-box — утверждения)

```
Genre: Racing
  REQUIRES_MECHANIC: locomotion
  REQUIRES_MECHANIC: timing
  CONFLICTS_WITH_MECHANIC: combat (default)
  PRODUCES_AESTHETIC: challenge
  PRODUCES_AESTHETIC: sensation

Mechanic: locomotion
  PRODUCES_DYNAMIC: movement
  PRODUCES_DYNAMIC: positioning
  SUPPORTS_AESTHETIC: challenge
  SUPPORTS_AESTHETIC: sensation

Mechanic: combat
  PRODUCES_DYNAMIC: conflict
  PRODUCES_DYNAMIC: resource_destruction
  SUPPORTS_AESTHETIC: challenge
  SUPPORTS_AESTHETIC: competition
  CONFLICTS_WITH_GENRE: racing (unless combat-racing)

Mechanic: timing
  PRODUCES_DYNAMIC: precision
  PRODUCES_DYNAMIC: rhythm
  SUPPORTS_AESTHETIC: challenge
  SUPPORTS_AESTHETIC: submission

Dynamic: movement
  CREATES_AESTHETIC: sensation
  CREATES_AESTHETIC: discovery

Aesthetic: challenge
  PART_OF: MDA Framework
  DESCRIBED_IN: bible_2_8_narrative_emotional_design.md
```

### 4.3. Запросы, которые онтология решает (а TF-IDF не может)

| Запрос | TF-IDF | Онтология |
|--------|--------|-----------|
| "Какие механики подходят для racing?" | Найдёт чанки со словом "racing" | Вернёт: locomotion, timing, collect, interact (через REQUIRES_MECHANIC) |
| "Что будет если добавить combat в racing?" | Найдёт чанки про combat и racing | Вернёт: CONFLICTS_WITH → warning, PRODUCES conflict dynamic, может конфликтовать с pacing |
| "Почему MDA важен для Core Loop?" | Найдёт чанки со словом "MDA" | Вернёт: MDA → mechanics → dynamics → aesthetics → Core Loop validates dynamics |
| "Какие механики создают aesthetic challenge?" | Найдёт чанки со словом "challenge" | Вернёт: combat, timing, survival, upgrade (через PRODUCES_DYNAMIC → CREATES_AESTHETIC) |
| "Покрывает ли этот Core Loop все steps?" | Не может | Вернёт: coverage report через IMPLEMENTED_BY relations |

---

## 5. Архитектура: как встроить онтологию в Gidede

### 5.1. Минимальный подход (рекомендуется для MVP)

**Не поднимаем Neo4j.** Используем SQLite (уже есть) + JSON graph.

```
┌─────────────────────────────────────────────────────────────┐
│  ONTOLOGY BUILDER (offline, один раз)                       │
│  1. Читает docs/bible/*.md + mechanics-db.ts                │
│  2. LLM извлекает сущности и отношения                       │
│  3. Валидирует против схемы (Zod)                            │
│  4. Сохраняет в SQLite (таблицы: entities, relations)       │
│  5. Строит in-memory graph (adjacency list)                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ONTOLOGY QUERY LAYER                                       │
│  - getMechanicsForGenre(genre) → Mechanic[]                 │
│  - getDynamicsForMechanic(mechanic) → Dynamic[]             │
│  - getAestheticsForMechanic(mechanic) → Aesthetic[]         │
│  - checkGenreSafety(genre, mechanics) → conflicts[]         │
│  - getCoverageGaps(coreLoop, selectedMechanics) → gaps[]    │
│  - findRelatedMechanics(mechanic, depth) → Mechanic[]       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  AI PLANNER (из концепции прототипов)                       │
│  Использует ontology queries вместо TF-IDF search           │
│  Prompt: "Вот граф механик для racing..."                   │
│  вместо: "Вот чанки текста про racing..."                   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2. Prisma schema (дополнение)

```prisma
model OntologyEntity {
  id          String   @id @default(cuid())
  entityId    String   @unique  // "mechanic:locomotion"
  type        String             // "Mechanic" | "Genre" | "Aesthetic" | ...
  name        String             // "Locomotion"
  description String?
  sourceRef   String?            // "bible_2_4_core_loop.md#section-3"
  metadata    String?            // JSON: { group, tags, ... }
  createdAt   DateTime @default(now())

  relationsFrom OntologyRelation[] @relation("fromEntity")
  relationsTo   OntologyRelation[] @relation("toEntity")

  @@index([type])
  @@index([entityId])
  @@map("ontology_entities")
}

model OntologyRelation {
  id          String   @id @default(cuid())
  fromEntityId String
  toEntityId   String
  relationType String   // "REQUIRES_MECHANIC" | "PRODUCES_DYNAMIC" | ...
  weight      Float    @default(1.0)  // confidence 0-1
  sourceRef   String?  // where this relation was extracted from
  metadata    String?  // JSON
  createdAt   DateTime @default(now())

  fromEntity OntologyEntity @relation("fromEntity", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntity   OntologyEntity @relation("toEntity", fields: [toEntityId], references: [id], onDelete: Cascade)

  @@index([fromEntityId, relationType])
  @@index([toEntityId, relationType])
  @@index([relationType])
  @@map("ontology_relations")
}
```

### 5.3. Ontology Builder (LLM extraction)

```typescript
// src/lib/ontology/builder.ts

interface ExtractionResult {
  entities: Array<{
    type: "Mechanic" | "Genre" | "Aesthetic" | "Dynamic" | "Resource";
    name: string;
    description: string;
    sourceRef: string;
  }>;
  relations: Array<{
    from: string;  // entity name
    to: string;    // entity name
    type: string;  // "PRODUCES_DYNAMIC" | "REQUIRES_MECHANIC" | ...
    weight: number;
    sourceRef: string;
  }>;
}

const EXTRACTION_PROMPT = `
Извлеки сущности и отношения из текста по геймдизайну.

Текст (из ${sourceRef}):
${chunkText}

Сущности для извлечения:
- Mechanic (игровая механика)
- Genre (жанр игры)
- Aesthetic (эстетика из MDA: challenge, sensation, narrative, etc.)
- Dynamic (динамика: emergent behavior)
- Resource (игровой ресурс)

Отношения для извлечения:
- REQUIRES_MECHANIC: жанр требует механику
- CONFLICTS_WITH: жанр/механика конфликтует с другой
- PRODUCES_DYNAMIC: механика создаёт динамику
- CREATES_AESTHETIC: динамика создаёт эстетику
- CONSUMES_RESOURCE: механика потребляет ресурс
- PRODUCES_RESOURCE: механика производит ресурс

Верни JSON по схеме ExtractionResult.
`;
```

### 5.4. Query layer

```typescript
// src/lib/ontology/queries.ts

export class OntologyQueryLayer {
  constructor(private graph: Map<string, EntityNode>) {}

  /** Какие механики подходят для жанра? */
  getMechanicsForGenre(genre: string): Mechanic[] {
    const genreNode = this.findEntity("Genre", genre);
    if (!genreNode) return [];
    return this.traverse(genreNode, "REQUIRES_MECHANIC")
      .map(n => this.toMechanic(n));
  }

  /** Какие dynamics создаёт механика? */
  getDynamicsForMechanic(mechanic: string): Dynamic[] {
    const mechNode = this.findEntity("Mechanic", mechanic);
    if (!mechNode) return [];
    return this.traverse(mechNode, "PRODUCES_DYNAMIC")
      .map(n => this.toDynamic(n));
  }

  /** Проверка безопасности: конфликтует ли механика с жанром? */
  checkGenreSafety(genre: string, mechanics: string[]): Conflict[] {
    const genreNode = this.findEntity("Genre", genre);
    if (!genreNode) return [];
    const conflicts = this.traverse(genreNode, "CONFLICTS_WITH_MECHANIC");
    return mechanics.filter(m => conflicts.some(c => c.name === m))
      .map(m => ({ mechanic: m, genre, reason: "CONFLICTS_WITH" }));
  }

  /** Покрытие Core Loop: какие steps не имеют механик? */
  getCoverageGaps(
    coreLoopSteps: Array<{ id: string; mechanicIds: string[] }>,
    selectedMechanics: string[]
  ): string[] {
    return coreLoopSteps
      .filter(step => !step.mechanicIds.some(m => selectedMechanics.includes(m)))
      .map(step => step.id);
  }

  /** Граф механик для AI Planner prompt */
  buildMechanicGraphForPrompt(genre: string): string {
    const mechanics = this.getMechanicsForGenre(genre);
    const lines = mechanics.map(m => {
      const dynamics = this.getDynamicsForMechanic(m.name);
      const aesthetics = dynamics.flatMap(d =>
        this.traverse(d, "CREATES_AESTHETIC").map(a => a.name)
      );
      return `- ${m.name}: produces [${dynamics.map(d=>d.name).join(", ")}] → aesthetics [${[...new Set(aesthetics)].join(", ")}]`;
    });
    return lines.join("\n");
  }

  private traverse(node: EntityNode, relationType: string): EntityNode[] {
    return node.relations
      .filter(r => r.type === relationType)
      .map(r => this.graph.get(r.toEntityId))
      .filter((n): n is EntityNode => n !== undefined);
  }
}
```

---

## 6. Интеграция с AI Planner (из концепции прототипов)

### 6.1. До онтологии (текущий концепт)

```
AI Planner prompt:
  "Доступные фрагменты из библиотеки:
   - locomotion-basic: Базовое движение (capability: locomotion)
   - combat-shoot: Стрельба (capability: combat)
   ...
   Выбери механики для гонок."
```

LLM видит **плоский список** фрагментов. Может выбрать combat, потому что не знает про конфликт с racing.

### 6.2. После онтологии

```
AI Planner prompt:
  "Жанр: Racing

  Онтология механик для Racing:
  - REQUIRES: locomotion (produces [movement, positioning] → aesthetics [challenge, sensation])
  - REQUIRES: timing (produces [precision, rhythm] → aesthetics [challenge, submission])
  - OPTIONAL: collect (produces [acquisition] → aesthetics [discovery, fantasy])
  - CONFLICTS: combat (conflict with pacing dynamic of racing)

  Доступные фрагменты:
  - locomotion-basic ✓ compatible
  - timing-checkpoint ✓ compatible
  - combat-shoot ✗ CONFLICTS_WITH racing
  - collect-boost ✓ compatible

  Выбери механики для каждого Core Loop step."
```

LLM видит **структурированный граф** с конфликтами. Не выберет combat для racing.

### 6.3. Проверочные запросы (для verifying agents)

```typescript
test("ontology prevents combat in racing", () => {
  const ontology = new OntologyQueryLayer(graph);
  const conflicts = ontology.checkGenreSafety("racing", ["locomotion", "combat"]);
  expect(conflicts).toContainEqual({
    mechanic: "combat",
    genre: "racing",
    reason: "CONFLICTS_WITH"
  });
});

test("ontology finds dynamics for mechanic", () => {
  const ontology = new OntologyQueryLayer(graph);
  const dynamics = ontology.getDynamicsForMechanic("locomotion");
  expect(dynamics.map(d => d.name)).toContain("movement");
});

test("ontology traces mechanic to aesthetics", () => {
  const ontology = new OntologyQueryLayer(graph);
  const mechanics = ontology.getMechanicsForGenre("racing");
  for (const m of mechanics) {
    const dynamics = ontology.getDynamicsForMechanic(m.name);
    const aesthetics = dynamics.flatMap(d =>
      ontology.traverse(d, "CREATES_AESTHETIC").map(a => a.name)
    );
    expect(aesthetics.length).toBeGreaterThan(0);
  }
});
```

---

## 7. Сравнение подходов для Gidede

| Подход | Сложность | Стоимость | Точность | Рекомендация |
|--------|-----------|-----------|----------|--------------|
| **Оставить TF-IDF** | Низкая | $0 | Низкая (keyword match) | ❌ Не решает проблему |
| **Embeddings (OpenAI)** | Средняя | $5-20 | Средняя (semantic) | ⚠️ Лучше, но нет reasoning |
| **GraphRAG (Microsoft)** | Высокая | $100-500 | Высокая | ⚠️ Overkill для MVP |
| **LightRAG** | Средняя | $20-50 | Высокая | ✅ Хорошо, но external dependency |
| **Custom ontology (SQLite + LLM)** | Средняя | $5-10 | Высокая | ✅ Рекомендуется — full control |

### Рекомендация: Custom ontology (SQLite + LLM extraction)

**Почему:**
- Полный контроль над схемой (геймдизайн-специфичная)
- Нет external dependencies (Neo4j, GraphRAG)
- Дёшево (~$5-10 на индексацию Bible)
- Интегрируется с существующим Prisma/SQLite

---

## 8. Что прогонять через онтологию

### 8.1. Приоритет 1: Bible (уже есть)

12 секций, 6080 строк — **готовый материал**.

**Что извлечём:**
- MDA Framework → relations: PRODUCES_DYNAMIC, CREATES_AESTHETIC
- Core Loop → relations: IMPLEMENTED_BY, FOLLOWS_STEP
- Balance → relations: COUNTERS, SYNERGIZES_WITH
- MechanicsDB → relations: REQUIRES_MECHANIC, CONFLICTS_WITH

**Ожидаемый результат:** ~200 entities, ~500 relations

### 8.2. Приоритет 2: GDD пользователя (динамически)

Когда пользователь создаёт GDD через Gidede, **его собственный GDD** прогоняется через ontology builder.

**Что извлечём:**
- Конкретные механики проекта
- Resource flow
- Aesthetic goals
- Конфликты (если игрок говорит "RPG with no combat" → CONFLICTS_WITH check)

### 8.3. Приоритет 3: Внешние книги/курсы

Если есть дополнительные книги по геймдизайну (Schell, Adams/Dormans, Sellers, Rogers, Fullerton, Zubek и др.), их можно прогнать через ontology builder.

**Зависит от:**
- Доступны ли тексты книг (авторские права)
- Объём (одна книга ~50000 слов = ~$2-5 на LLM extraction)

### 8.4. Приоритет 4: Playtest results

Результаты playtests (есть в БД) можно прогнать через extraction:
- "Player confused by X" → AntiPattern
- "Player enjoyed Y" → Aesthetic confirmed
- "Player spent too long on Z" → Balance issue

---

## 9. План реализации

### Фаза 1: Schema + Builder (1 неделя)
- [ ] Prisma models: `OntologyEntity`, `OntologyRelation`
- [ ] Zod schema для ExtractionResult
- [ ] `src/lib/ontology/builder.ts` — LLM extraction
- [ ] Seed: прогнать Bible + MechanicsDB через builder
- [ ] CLI: `bun run ontology:build` (rebuild from sources)

### Фаза 2: Query Layer (3 дня)
- [ ] `src/lib/ontology/queries.ts` — OntologyQueryLayer class
- [ ] In-memory graph (adjacency list)
- [ ] Методы: getMechanicsForGenre, checkGenreSafety, getCoverageGaps
- [ ] Тесты (раздел 6.3)

### Фаза 3: AI Planner integration (3 дня)
- [ ] Обновить AI Planner prompt (раздел 6.2)
- [ ] Использовать ontology queries вместо TF-IDF search
- [ ] Genre safety check перед LLM call
- [ ] Coverage gaps в response

### Фаза 4: UI (3 дня)
- [ ] Страница `/knowledge` → показать ontology graph (vis.js или d3)
- [ ] Кнопка "Rebuild ontology" в settings
- [ ] Показ conflicts в UI прототипа

### Фаза 5: External sources (опционально, 1 неделя)
- [ ] Импорт внешних книг (если есть права)
- [ ] Incremental updates (новые GDD → новые entities)
- [ ] Playtest result extraction

**Итого: ~2-3 недели для MVP (фазы 1-4)**

---

## 10. Риски и mitigation

| Риск | Вероятность | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM extraction неточный | Средняя | Средний | Валидация против схемы + manual review |
| Стоимость индексации | Низкая | Низкий | $5-10, один раз |
| Граф слишком большой | Низкая | Низкий | ~200 entities — SQLite handles easily |
| Hallucinated relations | Средняя | Средний | Weight < 0.7 → не использовать |
| Устаревание онтологии | Средняя | Средний | Rebuild button + versioning |
| LLM недоступен для extraction | Низкая | Высокий | Fallback: manual seed из MechanicsDB |

---

## 11. Сравнение с конкурентами

| Инструмент | Есть ли ontology/graph? | Как реализовано |
|------------|------------------------|-----------------|
| ChatGPT (RAG) | Нет (bag-of-words) | Embeddings + cosine similarity |
| Claude (projects) | Нет | Context window |
| Microsoft GraphRAG | Да | LLM extraction + graph |
| LlamaIndex | Опционально | KnowledgeGraphIndex |
| LangChain | Опционально | GraphCypherQAChain |

**Gidede с ontology будет уникальным** — геймдизайн-специфичная онтология с причинно-следственными связями между механиками, динамиками и эстетиками.

---

## 12. Выводы

### 12.1. Стоит ли делать?

**Да.** Онтология решает корневую проблему текущего Bible RAG: TF-IDF не понимает связи. Для AI Planner (концепция прототипов) это критично — без онтологии LLM может выбрать combat для racing.

### 12.2. Какой подход?

**Custom ontology (SQLite + LLM extraction).** Не GraphRAG (overkill), не Neo4j (extra dependency). Полный контроль, дёшево, интегрируется с существующим стеком.

### 12.3. Что прогонять?

1. **Bible (12 секций)** — обязательно, уже есть, готовый материал
2. **MechanicsDB (176 механик)** — обязательно, структурированный источник
3. **GDD пользователя** — динамически, при создании
4. **Внешние книги** — опционально, если есть права и бюджет

### 12.4. Когда?

После реализации концепции AI-генерации прототипов (Фаза A-D). Онтология — это **усилитель** для AI Planner, не самостоятельная фича.

### 12.5. Как проверять?

Раздел 6.3 содержит проверочные тесты. Другие агенты могут запустить:
- `test("ontology prevents combat in racing")` — genre safety
- `test("ontology finds dynamics for mechanic")` — graph traversal
- `test("ontology traces mechanic to aesthetics")` — MDA chain

---

## 13. Следующие шаги

1. **Обсудить** концепцию с командой
2. **Решить**: custom ontology vs LightRAG vs GraphRAG
3. Если custom → реализовать Фазы 1-2 (schema + builder + queries)
4. Интегрировать с AI Planner (Фаза 3 из концепции прототипов)
5. Добавить UI для визуализации графа (Фаза 4)

---

## Приложение A: Пример extraction prompt (полный)

```
Системный промпт:
"Ты — game design knowledge engineer. Извлекаешь сущности и отношения
из текста по геймдизайну. Отвечаешь ТОЛЬКО валидным JSON."

Пользовательский промпт:
"""
Извлеки сущности и отношения из следующего текста.

Источник: bible_2_3_mda_framework.md

Текст:
[chunk text here]

Сущности для извлечения (с type):
- Mechanic: конкретные игровые механики (движение, сбор, бой, и т.д.)
- Genre: жанры игр (RPG, racing, puzzle, и т.д.)
- Aesthetic: эстетики MDA (challenge, sensation, narrative, fantasy,
  discovery, submission, expression, fellowship)
- Dynamic: динамики (emergent behaviors: movement, conflict, acquisition,
  positioning, timing, etc.)
- Resource: игровые ресурсы (gold, HP, score, time, etc.)

Отношения (с type):
- REQUIRES_MECHANIC: жанр требует механику (Racing REQUIRES_MECHANIC locomotion)
- CONFLICTS_WITH: конфликт (Racing CONFLICTS_WITH Combat)
- PRODUCES_DYNAMIC: механика создаёт динамику (Combat PRODUCES_DYNAMIC conflict)
- CREATES_AESTHETIC: динамика создаёт эстетику (conflict CREATES_AESTHETIC challenge)
- CONSUMES_RESOURCE: механика потребляет ресурс (Crafting CONSUMES_RESOURCE wood)
- PRODUCES_RESOURCE: механика производит ресурс (Mining PRODUCES_RESOURCE ore)
- SYNERGIZES_WITH: синергия (Combat SYNERGIZES_WITH Upgrade)
- COUNTERS: контрит (Stealth COUNTERS Combat)

Верни JSON:
{
  "entities": [
    { "type": "Mechanic", "name": "Locomotion", "description": "...", "sourceRef": "bible_2_3#section-2" },
    ...
  ],
  "relations": [
    { "from": "Locomotion", "to": "Movement", "type": "PRODUCES_DYNAMIC", "weight": 0.9, "sourceRef": "bible_2_3#section-2" },
    ...
  ]
}

Правила:
- Извлекай только явные связи из текста
- Weight: 0.5-1.0 (1.0 = явно утверждается, 0.5 = подразумевается)
- Не выдумывай отношения, которых нет в тексте
- Имена сущностей: normalize (lowercase, singular)
"""
```

## Приложение B: Пример графа (визуализация)

```
Racing (Genre)
  ├── REQUIRES_MECHANIC → Locomotion (Mechanic)
  │     ├── PRODUCES_DYNAMIC → Movement (Dynamic)
  │     │     └── CREATES_AESTHETIC → Sensation (Aesthetic)
  │     └── PRODUCES_DYNAMIC → Positioning (Dynamic)
  │           └── CREATES_AESTHETIC → Challenge (Aesthetic)
  ├── REQUIRES_MECHANIC → Timing (Mechanic)
  │     └── PRODUCES_DYNAMIC → Precision (Dynamic)
  │           └── CREATES_AESTHETIC → Challenge (Aesthetic)
  ├── CONFLICTS_WITH → Combat (Mechanic)
  │     └── PRODUCES_DYNAMIC → Conflict (Dynamic)
  │           └── CREATES_AESTHETIC → Competition (Aesthetic)
  └── PRODUCES_AESTHETIC → Challenge (Aesthetic)
```

Этот граф позволяет ответить: "Combat в Racing — конфликт, потому что Combat создаёт Competition aesthetic, а Racing требует Challenge через Timing, не через Conflict."
