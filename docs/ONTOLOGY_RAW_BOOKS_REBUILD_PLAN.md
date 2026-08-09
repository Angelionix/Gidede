# План: Пересборка Библии из сырых книг через онтологию

**Статус:** execution plan
**Дата:** 2026-08-02
**Вопрос:** пересобрать Библию из сырых книг (17 PDF) через онтологию, сравнить с существующей.

---

## 0. Что нашли

В ветке `python-original` обнаружено:

### 17 сырых книг (`docs/books/`, ~845 МБ)

| # | Книга | Автор | Размер |
|---|-------|-------|--------|
| 1 | Schell_Geymdizayn.pdf | Джесси Шелл | 4.7 МБ |
| 2 | Iskusstvo_Geymdizayna.pdf | Искусство Геймдизайна | 5.1 МБ |
| 3 | Game_Mechanics_Advanced_Game_Design.pdf | Адамс/Дорманс | 15 МБ |
| 4 | Bri_Destins_Dumai_kak_geym_dizainer_2024.pdf | Бри Дэстинс | 3.1 МБ |
| 5 | Michael_Sellers_Advanced_Game_Design.pdf | Michael Sellers | 9.3 МБ |
| 6 | Schreiber_Rogers_Game_Balance.pdf | Schreiber, Rogers | 8.1 МБ |
| 7 | SW_BAND.pdf | SW.BAND | 36 МБ |
| 8 | Zubek_Elementy_geymdizayna_2022.pdf | Роберт Зубек | 11 МБ |
| 9 | Gazendasek_Vseadnye_dizainery_igr_2023.pdf | Газендасек | 25 МБ |
| 10 | Kadikov_Proektirovanie_virtualnyh_mirov_2019.pdf | Кадиков | 18 МБ |
| 11 | Kniga_Igroka_2024.pdf | Книга Игрока | 21 МБ |
| 12 | Igrovoy_balans_nauka.pdf | Игровой баланс | 96 МБ |
| 13 | LD_In_pursuit_of_better_levels.pdf | Level Design | 130 МБ |
| 14 | Rollingz_Morris_Proektirovanie_i_arkhitektura_igr.pdf | Rollingz, Morris | 163 МБ |
| 15 | Scott_Rogers_Level_Up.pdf | Scott Rogers | 11 МБ |
| 16 | Tracy_Fullerton_Game_Design_Workshop_2024.pdf | Tracy Fullerton | 203 МБ |
| 17 | Bond_Unity_i_Cs_2019.pdf | Jeremy Bond | 100 МБ |

### 51 GDD example (`docs/gdd_examples/`, ~350 МБ)

BioShock, Doom Bible, Halo, Far Cry, Saints Row, Prince of Persia 2, Red Dead Redemption 2, Grim Fandango, Metal Gear Solid 2, и др.

---

## 1. Зачем пересобирать из сырых книг

### 1.1. Проблема текущей Библии

Текущая Bible (`docs/bible/bible_2_*.md`) — **синтез 17 книг**, сделанный ранее. Но:

| Проблема | Симптом |
|----------|---------|
| **Потеря детализации** | Синтез сжимает 845 МБ → 6080 строк; теряются нюансы |
| **Субъективность синтеза** | Выбор, что включить — мнение автора синтеза |
| **Нет прямого provenance** | Bible ссылается на "Кн. 1, 2", но не на конкретные страницы/главы |
| **Пробелы** | Какие темы есть в книгах, но не попали в синтез? |

### 1.2. Что даст пересборка из сырых книг

| Выгода | Как |
|--------|-----|
| **Полнота** | LLM extraction извлекает ВСЕ entities/relations из каждой книги |
| **Объективность** | Не фильтр автора синтеза — все книги равноправны |
| **Точный provenance** | Каждая relation → конкретная книга + глава + страница |
| **Сравнение** | Новая онтология vs существующая Bible → пробелы |
| **Cross-book links** | "Шелл говорит X, Зубек опровергает Y" — связи между книгами |

### 1.3. Почему это станет "более правильной"

1. **Более полная:** 17 книг целиком vs синтез 6080 строк
2. **Более логичная:** онтология = граф причинно-следственных связей
3. **Более структурированная:** entities + relations вместо prose
4. **Сравнимая:** можно сравнить с существующей Bible и найти пробелы

---

## 2. Архитектура пересборки

```
┌──────────────────────────────────────────────────────────────────┐
│  ЭТАП 1: TEXT EXTRACTION (offline, ~2 часа)                      │
│  17 PDF → pdftotext → 17 .txt файлов                             │
│  + OCR для сканов (если есть)                                    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  ЭТАП 2: CHUNKING (offline, ~10 мин)                             │
│  17 .txt → ~500 чанков по ~2000 токенов каждый                   │
│  Каждый чанк: { book, chapter, page, text }                      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  ЭТАП 3: LLM EXTRACTION (~3-4 часа, ~$35-85)                     │
│  Для каждого чанка: LLM извлекает entities + relations            │
│  Вход: text chunk + schema                                       │
│  Выход: { entities: [...], relations: [...] }                     │
│  ~500 LLM calls × ~$0.07-0.17/call                              │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  ЭТАП 4: MERGE & DEDUP (offline, ~30 мин)                        │
│  500 extraction results → 1 unified ontology graph                │
│  - Deduplicate entities по name + type                            │
│  - Merge relations (если 2 книги утверждают одно — weight↑)       │
│  - Resolve conflicts (книга A vs книга B)                         │
│  Результат: ~1000-2000 entities, ~3000-5000 relations             │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│  ЭТАП 5: COMPARISON (offline, ~30 мин)                           │
│  Новая онтология (из сырых книг) vs существующая Bible:           │
│  - Что есть в новой, но нет в старой? (пробелы Bible)            │
│  - Что есть в старой, но нет в новой? (возможные ошибки синтеза) │
│  - Где конфликт? (книга говорит X, Bible говорит Y)              │
│  Результат: comparison_report.md                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Этапы детально

### 3.1. Этап 1: Text Extraction

**Инструмент:** `pdftotext` (poppler-utils) или `pdfplumber` (Python)

**Команда:**
```bash
for pdf in docs/books/*.pdf; do
  txt="docs/books/$(basename "$pdf" .pdf).txt"
  pdftotext -layout "$pdf" "$txt"
done
```

**Ожидаемый результат:**
- 17 .txt файлов
- ~580 000 слов (по аналогии с GDD collection)
- ~8000-10000 страниц текста

**Проблема:** большие PDF (130 МБ, 163 МБ, 203 МБ) — медленное извлечение.
**Решение:** параллельная обработка + кеширование.

### 3.2. Этап 2: Chunking

**Стратегия:** чанки по ~2000 токенов с перекрытием 200 токенов.

**Структура чанка:**
```typescript
interface BookChunk {
  id: string;              // "schell:chunk-042"
  book: string;            // "Schell_Geymdizayn"
  bookId: string;          // "kb-01" (из BOOKS_REGISTRY)
  chapter: string;         // "Chapter 3: MDA Framework"
  page: number;            // 47
  text: string;            // ~2000 токенов
  tokens: string[];        // pre-tokenized
}
```

**Ожидаемый результат:** ~500 чанков (по ~30 чанков на книгу)

### 3.3. Этап 3: LLM Extraction

**Prompt (точный текст):**

```
Системный промпт:
"Ты — game design knowledge engineer. Извлекаешь сущности и отношения
из текста по геймдизайну. Отвечаешь ТОЛЬКО валидным JSON."

Пользовательский промпт:
"""
Книга: {book.name} (Кн. {book.id})
Глава: {chunk.chapter}, стр. {chunk.page}

Текст:
{chunk.text}

Извлеки сущности и отношения.

Сущности (type):
- Mechanic: конкретные игровые механики
- Genre: жанры игр
- Aesthetic: эстетики MDA (challenge, sensation, narrative, fantasy,
  discovery, submission, expression, fellowship)
- Dynamic: динамики (emergent behaviors)
- Resource: игровые ресурсы
- Pattern: паттерны геймдизайна
- AntiPattern: антипаттерны
- Principle: принципы геймдизайна
- Tool: инструменты (Machinations, TF-IDF, и т.д.)

Отношения (type):
- REQUIRES_MECHANIC: жанр требует механику
- CONFLICTS_WITH: конфликт
- PRODUCES_DYNAMIC: механика создаёт динамику
- CREATES_AESTHETIC: динамика создаёт эстетику
- CONSUMES_RESOURCE: потребляет ресурс
- PRODUCES_RESOURCE: производит ресурс
- SYNERGIZES_WITH: синергия
- COUNTERS: контрит
- SOLVES: паттерн решает проблему
- LEADS_TO: антипаттерн ведёт к проблеме
- DESCRIBED_IN: сущность описана в (book + chapter + page)
- CONTRADICTS: книга A противоречит книге B

Верни JSON:
{
  "entities": [
    { "type": "Mechanic", "name": "locomotion", "description": "...",
      "sourceRef": "schell:ch3:p47" },
    ...
  ],
  "relations": [
    { "from": "locomotion", "to": "movement", "type": "PRODUCES_DYNAMIC",
      "weight": 0.9, "sourceRef": "schell:ch3:p47" },
    ...
  ]
}

Правила:
- Извлекай только явные связи из текста
- Weight: 0.5-1.0 (1.0 = явно утверждается, 0.5 = подразумевается)
- Не выдумывай отношения, которых нет в тексте
- Имена: lowercase, singular
- sourceRef: {bookId}:{chapter}:{page}
"""
```

**LLM:** z-ai-web-dev-sdk (glm-4.6)
**Стоимость:** ~$0.07-0.17 за чанк × 500 чанков = ~$35-85
**Время:** ~3-4 часа (с retry и rate limiting)

### 3.4. Этап 4: Merge & Dedup

**Алгоритм:**

```python
def merge_ontologies(extractions: List[ExtractionResult]) -> Ontology:
    entity_map = {}  # normalized_name → Entity
    relations = []

    for ext in extractions:
        for entity in ext.entities:
            key = normalize(entity.name, entity.type)
            if key in entity_map:
                # Merge: add sourceRef, keep description if better
                entity_map[key].sourceRefs.append(entity.sourceRef)
            else:
                entity_map[key] = Entity(
                    **entity,
                    sourceRefs=[entity.sourceRef],
                    bookCount=1
                )

        for rel in ext.relations:
            # Normalize from/to to entity IDs
            from_id = normalize(rel.from, ...)
            to_id = normalize(rel.to, ...)
            relations.append(Relation(
                fromId=from_id,
                toId=to_id,
                type=rel.type,
                weight=rel.weight,
                sourceRefs=[rel.sourceRef],
                bookCount=1
            ))

    # Deduplicate relations: same (from, to, type) → merge
    merged_relations = dedup_relations(relations)
    # If multiple books assert same relation → increase weight
    for rel in merged_relations:
        rel.weight = min(1.0, rel.weight * (1 + 0.1 * (rel.bookCount - 1)))

    return Ontology(
        entities=list(entity_map.values()),
        relations=merged_relations
    )
```

**Ожидаемый результат:**
- ~1000-2000 entities (после дедупликации)
- ~3000-5000 relations
- Cross-book links: "Schell говорит X, Zubek опровергает"

### 3.5. Этап 5: Comparison с существующей Bible

**Алгоритм:**

```python
def compare_ontologies(
    new: Ontology,  # из сырых книг
    old: Ontology   # из существующей Bible
) -> ComparisonReport:
    # 1. Что есть в новой, но нет в старой
    new_entities = set(new.entities) - set(old.entities)
    new_relations = set(new.relations) - set(old.relations)

    # 2. Что есть в старой, но нет в новой
    missing_entities = set(old.entities) - set(new.entities)
    missing_relations = set(old.relations) - set(new.relations)

    # 3. Конфликты
    conflicts = []
    for rel_new in new.relations:
        for rel_old in old.relations:
            if (rel_new.from == rel_old.from and
                rel_new.to == rel_old.to and
                rel_new.type == "CONTRADICTS"):
                conflicts.append(Conflict(rel_new, rel_old))

    return ComparisonReport(
        newEntities=new_entities,        # пробелы Bible
        newRelations=new_relations,      # пробелы Bible
        missingEntities=missing_entities,  # возможные ошибки синтеза
        missingRelations=missing_relations,
        conflicts=conflicts
    )
```

**Выход:** `comparison_report.md`

---

## 4. Оценка стоимости и времени

| Этап | Время | Стоимость |
|------|-------|-----------|
| 1. Text extraction | ~2 часа | $0 (offline) |
| 2. Chunking | ~10 мин | $0 |
| 3. LLM extraction | ~3-4 часа | ~$35-85 |
| 4. Merge & dedup | ~30 мин | $0 |
| 5. Comparison | ~30 мин | $0 |
| **Итого** | **~6-7 часов** | **~$35-85** |

### Оптимизация стоимости

| Подход | Стоимость | Точность |
|--------|-----------|----------|
| Все 17 книг | ~$35-85 | Максимальная |
| 5 ключевых книг (Schell, Adams, Zubek, Fullerton, Sellers) | ~$10-25 | Высокая |
| Только MechanicsDB + 3 книги | ~$5-10 | Средняя |

---

## 5. Что делать с GDD examples

### 5.1. Отдельная онтология "GDD Patterns"

51 GDD (BioShock, Doom, Halo и др.) → extraction → **ontology of real-world patterns**

**Что извлечём:**
- `Pattern: bioShock:emergent_gameplay` → `INSTANCE_OF: global:emergent_dynamic`
- `Pattern: doom:weapon_progression` → `SOLVES: progression_pacing`
- `Pattern: halo:shields_and_health` → `IMPLEMENTS: dual_resource_system`

**Ценность:** AI Planner сможет предлагать паттерны из реальных успешных игр.

### 5.2. Стоимость

51 GDD × ~$0.5-1 = ~$25-50

---

## 6. План реализации

### Фаза 1: Infrastructure (3 дня)
- [ ] Перенести `docs/books/` и `docs/gdd_examples/` из `python-original` в `nextjs-port`
- [ ] `src/lib/ontology/extractor.ts` — PDF → text
- [ ] `src/lib/ontology/chunker.ts` — text → chunks
- [ ] `src/lib/ontology/llm-extractor.ts` — LLM extraction (Zod schema)
- [ ] CLI: `bun run ontology:extract-books`

### Фаза 2: Books extraction (1 день, ~$35-85)
- [ ] Запустить extraction для 17 книг
- [ ] Merge в unified ontology
- [ ] Store в SQLite (`OntologyEntity`, `OntologyRelation`)
- [ ] Результат: ~1000-2000 entities, ~3000-5000 relations

### Фаза 3: Comparison (1 день)
- [ ] `src/lib/ontology/comparator.ts` — новая vs существующая Bible
- [ ] `comparison_report.md` — пробелы, конфликты, missing
- [ ] UI: страница сравнения

### Фаза 4: GDD patterns (опционально, 2 дня, ~$25-50)
- [ ] Extraction из 51 GDD
- [ ] Pattern ontology (отдельная от books)
- [ ] Cross-link: `Pattern INSTANCE_OF global:Mechanic`

### Фаза 5: New Bible generation (опционально, 1 день)
- [ ] LLM генерирует новую Bible из heontology (структурированный синтез)
- [ ] Сравнение со старой Bible

**Итого: ~1-2 недели**

---

## 7. Ожидаемые результаты

### 7.1. Количественные

| Метрика | Существующая Bible | Новая (из сырых книг) |
|---------|-------------------|----------------------|
| Источник | 17 книг (синтез) | 17 книг (целиком) |
| Объём | 6080 строк | ~1000-2000 entities + ~3000-5000 relations |
| Provenance | "Кн. 1, 2" | "schell:ch3:p47" |
| Покрытие тем | Субъективное | Полное |

### 7.2. Качественные

- **Пробелы Bible:** "Зубек описывает X, но в Bible этого нет"
- **Конфликты:** "Шелл говорит A, Adams говорит B" — Bible выбрала A
- **Cross-book links:** "Это принцип описан у 5 авторов" (высокий weight)
- **GDD patterns:** "BioShock использует паттерн X" (реальный пример)

### 7.3. Comparison report (пример)

```markdown
# Сравнение онтологий

## Пробелы существующей Bible (есть в сырых книгах, нет в Bible)

### Новые entities (47)
- Mechanic: "procedural_rhetoric" (Bogost, Kniga_Igroka_2024)
  Описание: "Когда механика сама выражает аргумент"
  → ADD to Bible

### Новые relations (123)
- racing REQUIRES_MECHANIC positioning (Sellers, ch5:p89)
  → ADD to Bible

## Возможные ошибки синтеза (есть в Bible, нет в книгах)

### Missing entities (12)
- Mechanic: "energy_accumulation" (Bible 2.4, но не в Schell/Adams)
  → POSSIBLE SYNTHESIS ERROR

## Конфликты (3)
- combat CREATES_AESTHETIC:
  - Bible: "challenge" (Schell ch3)
  - Зубек: "competition" (Zubek ch7)
  → RESOLVE: both (multi-aesthetic)
```

---

## 8. Риски

| Риск | Вероятность | Mitigation |
|------|-------------|------------|
| PDF extraction неточный (сканы) | Средняя | OCR fallback (tesseract) |
| LLM extraction дорогой | Низкая | Начать с 5 ключевых книг |
| LLM hallucinations | Средняя | Zod validation + weight < 0.7 filter |
| Merge conflicts | Средняя | Manual review топ-50 conflicts |
| Big PDF медленные | Высокая | Параллельная обработка |

---

## 9. Решение

### 9.1. Делать? **Да**

Сырые книги дадут более полную онтологию. Сравнение с существующей Bible покажет пробелы. Это улучшит AI Planner.

### 9.2. Порядок

1. **Сначала 5 ключевых книг** (Schell, Adams, Zubek, Fullerton, Sellers) — ~$10-25
2. **Сравнить с существующей Bible** — найти пробелы
3. **Если пробелы значительные** — прогнать остальные 12 книг
4. **GDD examples** — опционально, после книг

### 9.3. Что перенести из python-original

```
docs/books/          → 17 PDF (845 МБ)
docs/gdd_examples/   → 51 GDD (350 МБ)
docs/BOOKS_REGISTRY.md
docs/gdd_examples/INDEX.md
docs/gdd_examples/GDD_ANALYSIS.md
```

### 9.4. Проверка для других агентов

```typescript
test("raw books ontology is more complete than Bible", () => {
  const rawOntology = loadOntology("from-raw-books");
  const bibleOntology = loadOntology("from-bible");

  // Raw books should have more entities
  expect(rawOntology.entities.length).toBeGreaterThan(bibleOntology.entities.length);

  // Find gaps in Bible
  const gaps = findGaps(bibleOntology, rawOntology);
  expect(gaps.newEntities.length).toBeGreaterThan(0);
});

test("provenance is precise", () => {
  const entity = ontology.findEntity("Mechanic", "locomotion");
  for (const ref of entity.sourceRefs) {
    expect(ref).toMatch(/^[a-z]+:ch\d+:p\d+$/); // book:chapter:page
  }
});

test("cross-book relations have higher weight", () => {
  const racingReqLocomotion = ontology.findRelation(
    "racing", "locomotion", "REQUIRES_MECHANIC"
  );
  // Described in multiple books → higher weight
  expect(racingReqLocomotion.bookCount).toBeGreaterThan(1);
  expect(racingReqLocomotion.weight).toBeGreaterThan(0.9);
});
```

---

## 10. Следующие шаги

1. **Перенести** `docs/books/` и `docs/gdd_examples/` из `python-original` в `nextjs-port`
2. **Реализовать** `src/lib/ontology/extractor.ts` (PDF → text)
3. **Реализовать** `src/lib/ontology/llm-extractor.ts` (LLM extraction)
4. **Запустить** extraction для 5 ключевых книг (~$10-25)
5. **Сравнить** с существующей Bible
6. **Решить** — прогонять остальные 12 книг или нет

---

## Приложение: Структура файлов

```
docs/
├── books/                          # 17 PDF (из python-original)
│   ├── Schell_Geymdizayn.pdf
│   ├── ...
│   └── BOOKS_REGISTRY.md
├── gdd_examples/                   # 51 GDD (из python-original)
│   ├── bioshock_pitch.pdf
│   ├── doom_bible.pdf
│   └── ...
├── bible/                          # Существующая Bible (12 секций)
│   ├── bible_2_1_fundament.md
│   └── ...
└── ontology/                       # NEW: результаты extraction
    ├── raw-books-ontology.json     # ~1000-2000 entities
    ├── gdd-patterns-ontology.json  # ~500 patterns
    └── comparison-report.md        # пробелы, конфликты
```
