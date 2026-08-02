# Концепция: ИИ-генерация прототипов через нод-редактор + библиотеку механик

**Статус:** concept proposal (не implementation)
**Дата:** 2026-08-02
**Автор:** analysis session
**Предпосылка:** текущий renderer генерирует "один шаблон на все проекты" — не использует реальные механики Core Loop. Нужно связать нод-редактор + ИИ + библиотеку механик так, чтобы прототип **доказывал** конкретный Core Loop, а не был generic-аркадой.

---

## 1. Постановка проблемы

### Что сейчас не так

| Компонент | Что делает | Что НЕ делает |
|-----------|-----------|---------------|
| Node-редактор (`src/lib/graph/`) | Ручная сборка графа из 35+ типов нод → compileGraph() → HTML | Не связан с данными проекта (Concept, Core Loop) |
| Prototype compiler (`src/lib/prototype-compiler/`) | Компилирует PrototypeIR из mechanic IDs → 12 адаптеров → HTML | Не принимает NodeGraph как вход; mechanic IDs берёт из type-mapping, не из графа |
| AI service (`src/lib/ai-service.ts`) | generateGraphFromText(), validateGraphWithAI() | Не использует данные проекта; текст → граф без контекста |
| Библиотека механик (`SavedMechanic` model) | Сохраняет code snippets | Не переиспользуется при генерации новых прототипов |

**Симптом:** для гонок (Nitro_Rush) генерируется "собери звёзды, уклоняйся от врагов" — потому что renderer хардкодит одну игру на все типы. ИИ не участвует в выборе механик.

### Что нужно

> Прототип должен **доказывать конкретный Core Loop проекта**, а не быть шаблонной аркадой.
> ИИ должен **генерировать граф нод** из данных проекта (Concept + Core Loop + MDA), а не из пустого шаблона.
> Библиотека механик должна **переиспользовать проверенные фрагменты** графа, а не быть кладбем code snippets.

---

## 2. Архитектурное решение

### 2.1. Три источника истины

```
┌─────────────────────────────────────────────────────────────┐
│  ИСТОЧНИК 1: Данные проекта (Concept + Core Loop + MDA)     │
│  - жанр, эстетика, USP                                       │
│  - steps, mechanics, resources, resource graph               │
│  - target aesthetics, match scores                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ИСТОЧНИК 2: Библиотека механик (MechanicLibrary)            │
│  - сохранённые NodeGraph-фрагменты (не code snippets!)       │
│  - каждый фрагмент = реализация одной механики               │
│  - тегирован: capability, genre, topology                    │
│  - рейтинг: сколько раз использован, success rate            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  ИСТОЧНИК 3: ИИ (LLM через z-ai-web-dev-sdk)                 │
│  - анализирует данные проекта + библиотеку                   │
│  - выбирает подходящие механики из библиотеки                │
│  - генерирует недостающие механики как NodeGraph             │
│  - связывает механики в coherent graph                       │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   NodeGraph (JSON)
                         │
                         ▼
                compileGraph() → HTML
```

### 2.2. Ключевая идея: механика = NodeGraph-фрагмент

**Сейчас:** `SavedMechanic` хранит `codeSnippet` (JS строку) — нельзя переиспользовать, нельзя валидировать, нельзя комбинировать.

**Предлагается:** `MechanicLibrary` хранит **NodeGraph-фрагменты** — структурированные подсхемы, которые можно:
- вставить в любой граф
- валидировать через существующий `validateGraph()`
- скомпилировать через `compileGraph()`
- комбинировать с другими фрагментами

**Пример фрагмента "locomotion":**
```json
{
  "fragmentId": "locomotion-basic",
  "name": "Базовое движение (WASD)",
  "capability": "locomotion",
  "nodes": [
    { "id": "n1", "type": "onKey", "data": { "key": "KeyW" } },
    { "id": "n2", "type": "player", "data": {} },
    { "id": "n3", "type": "math", "data": { "op": "add", "value": -5 } }
  ],
  "edges": [
    { "from": "n1.outputs.exec", "to": "n3.inputs.exec" },
    { "from": "n3.outputs.result", "to": "n2.inputs.y" }
  ],
  "inputPins": [],
  "outputPins": [{ "id": "playerRef", "type": "entity" }],
  "tags": ["movement", "topdown", "arcade"],
  "usageCount": 0,
  "successRate": null
}
```

---

## 3. Поток данных (data flow)

### 3.1. Шаг 1: ИИ анализирует проект

**Вход:** `ProjectConcept` + `ProjectCoreLoop` + `ProjectMDAProfile` (из БД)

**LLM prompt (структурированный):**
```
Ты — game design AI. Проанализируй проект и предложи набор механик для прототипа.

Проект: {project.name}
Жанр: {concept.genre}
Эстетика: {concept.primaryAesthetic}
Core Loop steps: {coreLoop.steps.map(s => s.action)}
Mechanics: {concept.mechanicSet.base + combat + progression}
Resources: {coreLoop.resources}
Target aesthetics: {mda.targetDynamics}

Доступные механики из библиотеки:
{library.fragments.map(f => `${f.fragmentId}: ${f.name} (capability: ${f.capability})`)}

Задача:
1. Выбери 3-5 механик из библиотеки, которые покрывают Core Loop steps
2. Для каждого Core Loop step укажи, какая механика его реализует
3. Если нужной механики нет в библиотеке — опиши её (ИИ сгенерирует NodeGraph)
4. Укажи связи между механиками (resource flow)

Верни JSON по схеме MechanicSelectionPlan.
```

**Выход:** `MechanicSelectionPlan`
```json
{
  "projectId": "...",
  "selectedFragments": [
    { "fragmentId": "locomotion-basic", "stepId": "step-move" },
    { "fragmentId": "collect-pickup", "stepId": "step-collect" }
  ],
  "missingMechanics": [
    {
      "capability": "convert",
      "description": "Конвертация собранных ресурсов в улучшения",
      "stepId": "step-upgrade",
      "suggestedNodes": ["onKey:KeyE", "counter", "math:multiply", "player:setVar"]
    }
  ],
  "resourceFlow": [
    { "from": "collect-pickup.output.wallet", "to": "convert.input.resource" }
  ]
}
```

### 3.2. Шаг 2: ИИ генерирует недостающие механики

Для каждой механики из `missingMechanics` LLM генерирует NodeGraph-фрагмент:

**LLM prompt:**
```
Сгенерируй NodeGraph-фрагмент для механики:
- capability: {missing.capability}
- description: {missing.description}
- доступные типы нод: {NODE_DEFINITIONS.map(n => n.type)}

Верни JSON по схеме MechanicFragment (nodes + edges + inputPins + outputPins).
Фрагмент должен быть self-contained (не ссылаться на внешние ноды).
```

**Выход:** `MechanicFragment` (NodeGraph-подсхема)

### 3.3. Шаг 3: Композиция графа

Система (не ИИ) компонует финальный NodeGraph:
1. Берёт выбранные фрагменты из библиотеки
2. Берёт сгенерированные ИИ фрагменты
3. Связывает их через `resourceFlow` (pin-to-pin соединения)
4. Добавляет мета-ноды: `onGameStart`, `win`, `lose`, `hud`
5. Валидирует через `validateGraph()`

### 3.4. Шаг 4: Компиляция

`compileGraph(composedGraph)` → HTML (через существующий компилятор)

---

## 4. Библиотека механик (MechanicLibrary)

### 4.1. Структура хранения

**Вариант A: Prisma model (рекомендуется)**
```prisma
model MechanicFragment {
  id              String   @id @default(cuid())
  fragmentId      String   @unique  // "locomotion-basic"
  name            String             // "Базовое движение (WASD)"
  description     String?
  capability      String             // "locomotion" | "collect" | ...
  graphJson       String             // JSON: { nodes, edges, inputPins, outputPins }
  tags            String?            // JSON: ["movement", "topdown"]
  compatibleTopologies String?       // JSON: ["arena", "lanes"]
  isPublic        Boolean  @default(false)
  authorId        String?
  usageCount      Int      @default(0)
  successRate     Float?              // 0-1, обновляется после playtests
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([capability])
  @@index([isPublic])
  @@index([usageCount])
}
```

**Вариант B: статические файлы (для MVP)**
```
src/lib/mechanic-library/fragments/
├── locomotion-basic.json
├── locomotion-dash.json
├── collect-pickup.json
├── collect-magnet.json
├── combat-shoot.json
├── combat-melee.json
├── survival-hazard.json
└── ...
```

### 4.2. Начальный набор (seed)

Из существующих 12 адаптеров prototype-compiler генерируем по 1-2 фрагмента на каждый:

| Адаптер | Фрагмент | Описание |
|---------|----------|----------|
| locomotion | locomotion-basic | WASD движение, скорость 200 |
| locomotion | locomotion-dash | Движение + рывок (Space) |
| collect | collect-pickup | Подбор при касании, +1 к кошельку |
| collect | collect-magnet | Притяжение collectibles в радиусе |
| combat | combat-shoot | Стрельба по клику, снаряд |
| combat | combat-melee | Ближний бой, hitbox |
| survival | survival-hazard | Статичные hazards, урон при касании |
| interact | interact-deliver | Зона взаимодействия + доставка |
| convert | convert-recipe | Конвертация 2 ресурсов в 1 |
| build | build-place | Размещение сущности по клику |
| defend | defend-base | База с HP, волны врагов |
| upgrade | upgrade-spend | Трата ресурсов на улучшение |
| transform | transform-rotate | Поворот объекта |
| puzzle | puzzle-match | Сопоставление плиток |
| timing | timing-beat | Окно ввода по биту |

---

## 5. Роль ИИ (LLM)

### 5.1. Что ИИ делает

| Задача | Вход | Выход | Когда |
|--------|------|-------|-------|
| **Анализ проекта** | Concept + Core Loop + MDA | MechanicSelectionPlan | При генерации прототипа |
| **Генерация механики** | capability + description + NODE_DEFINITIONS | MechanicFragment (NodeGraph) | Если в библиотеке нет нужной механики |
| **Связывание механик** | selectedFragments + resourceFlow | edge list (pin-to-pin) | При композиции графа |
| **Объяснение** | composed graph | human-readable explanation | Для UI (почему выбраны эти механики) |

### 5.2. Что ИИ НЕ делает

- **Не генерирует исполняемый JavaScript** — только NodeGraph JSON (структурированный, валидируемый)
- **Не выбирает topology** — это делает детерминированный scene-grammar (уже есть)
- **Не рендерит HTML** — это делает compileGraph() (уже есть)
- **Не валидирует граф** — это делает validateGraph() (уже есть)

### 5.3. LLM-политика (из design spec)

- Все выходы ИИ проходят Zod schema validation
- `llm_generated: true` provenance в метаданных
- Если ИИ не может сгенерировать валидный фрагмент → fallback на ближайший из библиотеки
- Пользователь может отредактировать граф вручную после ИИ-генерации

---

## 6. UI поток (user flow)

### 6.1. Сценарий: пользователь генерирует прототип

```
1. Пользователь открывает /prototypes, выбирает проект
2. Нажимает "Сгенерировать прототип (ИИ)"
3. Backend:
   a. Загружает Concept + Core Loop + MDA из БД
   b. Загружает доступные фрагменты из MechanicLibrary
   c. Вызывает LLM → MechanicSelectionPlan
   d. Для missing mechanics вызывает LLM → MechanicFragment
   e. Компонует NodeGraph
   f. Валидирует
   g. Компилирует → HTML
4. Frontend показывает:
   - Прототип (iframe)
   - NodeGraph (визуализация в React Flow)
   - Список использованных механик (с источником: library/llm)
   - Объяснение ИИ (почему эти механики)
5. Пользователь может:
   - Сыграть в прототип
   - Редактировать NodeGraph вручную
   - "Сохранить механику в библиотеку" (если создал новую)
   - Перезапустить генерацию с другими параметрами
```

### 6.2. Сценарий: пользователь создаёт механику вручную

```
1. Пользователь открывает /prototype-editor
2. Собирает граф из нод (как сейчас)
3. Выделяет подсхему → "Сохранить как механику"
4. Указывает: name, capability, tags
5. Backend сохраняет как MechanicFragment в БД
6. В будущем ИИ может использовать эту механику для других проектов
```

---

## 7. Интеграция с существующим кодом

### 7.1. Что переиспользуется

| Компонент | Файл | Роль |
|-----------|------|------|
| NodeGraph types | `src/lib/graph/types.ts` | Структура графа |
| compileGraph() | `src/lib/graph/compiler.ts` | NodeGraph → HTML |
| validateGraph() | `src/lib/graph/validator.ts` | Валидация графа |
| NODE_DEFINITIONS | `src/lib/graph/types.ts` | 35+ типов нод |
| PrototypeIR | `src/lib/prototype-compiler/ir/` | Опционально: IR как промежуточный слой |
| Adapters (12) | `src/lib/prototype-compiler/adapters/` | Источник для seed-фрагментов |
| AI service | `src/lib/ai-service.ts` | LLM вызовы (z-ai-web-dev-sdk) |

### 7.2. Что новое

| Компонент | Файл (предлагаемый) | Описание |
|-----------|---------------------|----------|
| MechanicLibrary | `src/lib/mechanic-library/library.ts` | Загрузка/поиск фрагментов |
| MechanicFragment types | `src/lib/mechanic-library/types.ts` | Тип фрагмента |
| AI planner | `src/lib/ai-service.ts` (extend) | generateMechanicSelectionPlan() |
| AI fragment generator | `src/lib/ai-service.ts` (extend) | generateMechanicFragment() |
| Graph composer | `src/lib/prototype-compiler/composer.ts` | Композиция NodeGraph из фрагментов |
| API route | `src/app/api/v1/prototypes/generate-ai/route.ts` | Новый endpoint |
| Prisma model | `prisma/schema.prisma` (extend) | MechanicFragment table |

### 7.3. Что НЕ меняется

- Нод-редактор UI (`/prototype-editor`) — остаётся как есть
- Существующий `/api/v1/prototypes/generate` — остаётся для legacy
- Существующие 12 адаптеров — используются как seed для библиотеки
- compileGraph / validateGraph — не трогаем

---

## 8. Сравнение с предыдущим подходом

| Аспект | Было (template prototype) | Стало (AI + library) |
|--------|--------------------------|----------------------|
| Источник механик | Хардкод типа (engine→collect) | Библиотека + ИИ-генерация |
| Связь с Core Loop | Только goal text | Каждый step → конкретная механика |
| Traceability | Нет | fragmentId → stepId → mechanicId |
| Переиспользование | Нет (каждый прототип с нуля) | Фрагменты переиспользуются |
| Качество | Один шаблон на все | Разные графы для разных проектов |
| ИИ-участие | Только ai_insights (текст) | Генерация графа |

---

## 9. Риски и mitigation

| Риск | Mitigation |
|------|------------|
| ИИ генерирует невалидный NodeGraph | Zod validation + validateGraph() + fallback на library |
| ИИ галлюцинирует несуществующие типы нод | Передаём NODE_DEFINITIONS в prompt; post-validation |
| Фрагменты не стыкуются (pin types mismatch) | Composer проверяет pin types; если mismatch → ИИ генерирует adapter node |
| LLM latency (2-3 вызова = 10-30 сек) | Streaming UI: показываем прогресс шагов |
| Cost (много токенов) | Кеширование MechanicSelectionPlan по inputHash |
| Пользователь не понимает граф | UI показывает explanation + возможность ручной правки |

---

## 10. План реализации (предлагаемый)

### Фаза A: MechanicLibrary + seed (1 неделя)
1. Создать Prisma model `MechanicFragment`
2. Создать `src/lib/mechanic-library/library.ts` (CRUD + search)
3. Сгенерировать seed-фрагменты из 12 адаптеров
4. API: `GET /api/v1/mechanics/fragments`, `POST /api/v1/mechanics/fragments`

### Фаза B: AI planner (1 неделя)
1. Расширить `ai-service.ts`: `generateMechanicSelectionPlan(project, library)`
2. Zod schema для MechanicSelectionPlan
3. Тесты: мок LLM → валидный план
4. API: `POST /api/v1/prototypes/plan` → возвращает план без компиляции

### Фаза C: AI fragment generator (1 неделя)
1. Расширить `ai-service.ts`: `generateMechanicFragment(capability, description)`
2. Zod schema для MechanicFragment
3. validateGraph() на выходе
4. Fallback: если ИИ не сгенерировал → ближайший из library

### Фаза D: Graph composer (1 неделя)
1. Создать `src/lib/prototype-compiler/composer.ts`
2. Композиция: fragments → edges (по resourceFlow) → полный NodeGraph
3. Pin type checking
4. Тесты: композиция 2-3 фрагментов → валидный граф

### Фаза E: UI integration (1 неделя)
1. Кнопка "Сгенерировать прототип (ИИ)" на /prototypes
2. Progress UI (шаги 1-4)
3. Показ NodeGraph (React Flow) рядом с iframe
4. "Сохранить механику" button в нод-редакторе

### Фаза F: Validation gates (3 дня)
1. Coverage check: каждый Core Loop step имеет механику
2. Pin type check: все соединения валидны
3. Playability: bot может завершить цикл

**Итого: ~5 недель**

---

## 11. Ключевые отличия от предыдущего подхода

### Было (что не сработало):
- Renderer генерировал **один HTML** с хардкод-геймплеем
- ИИ только **описывал** прототип (ai_insights текстом)
- Нод-редактор **не связан** с генератором прототипов
- Библиотека механик = **code snippets** (не переиспользуемых)

### Стало (предлагается):
- ИИ **генерирует NodeGraph** (структурированный, валидируемый)
- NodeGraph **компилируется** через существующий compileGraph()
- Библиотека механик = **NodeGraph-фрагменты** (переиспользуемые, тегированные)
- Каждый прототип **доказывает конкретный Core Loop** (step → mechanic mapping)
- Пользователь может **редактировать граф** вручную после ИИ-генерации

---

## 12. Вопросы для обсуждения

1. **Хранить фрагменты в БД или в файлах?**
   - БД: лучше для пользовательских механик, рейтинг, поиск
   - Файлы: проще для seed, version control
   - Предложение: БД + seed-скрипт

2. **Нужен ли PrototypeIR как промежуточный слой?**
   - Сейчас: NodeGraph → compileGraph() → HTML
   - С IR: NodeGraph → PrototypeIR → renderer
   - Предложение: оставить NodeGraph → HTML (IR опционален для future)

3. **Как измерять successRate механик?**
   - После playtest: если пользователь выиграл → success
   - Предложение: playtest evidence уже есть в БД

4. **Должен ли ИИ видеть весь граф целиком или только фрагменты?**
   - Целиком: лучше coherence, но дорого
   - Фрагменты: дешевле, но может быть несогласованность
   - Предложение: фрагменты + отдельный pass для связей

---

## 13. Заключение

Предлагаемая концепция решает корневую проблему: **прототип перестаёт быть шаблоном и становится доказательством Core Loop**.

Ключевые принципы:
1. **Механика = NodeGraph-фрагмент** (структурированный, переиспользуемый)
2. **ИИ генерирует граф, не код** (валидируемо, безопасно)
3. **Библиотека накапливает знания** (каждая удачная механика переиспользуется)
4. **Пользователь контролирует** (может редактировать граф вручную)

Это позволяет:
- Для гонок → ИИ выберет locomotion + timing + collect (не combat!)
- Для шутеров → locomotion + combat + survival
- Для паззлов → puzzle + transform
- Каждый прототип **уникален** и **трассируется** до Core Loop
