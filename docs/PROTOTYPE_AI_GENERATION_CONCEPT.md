# Концепция v2: ИИ-генерация прототипов через нод-редактор + библиотеку механик

**Статус:** concept proposal v2 (углублённая редакция)
**Дата:** 2026-08-02
**Предпосылка:** v1 была слишком общей. v2 добавляет конкретные схемы, разбор кейсов (гонки vs шутер), точные контракты между компонентами и anti-patterns.

---

## 0. Краткое резюме для проверяющих агентов

**Проблема:** прототип для гонок (Nitro_Rush) содержит стрельбу. Причина — renderer хардкодит одну игру на все типы, а ИИ не участвует в выборе механик.

**Решение:** 3-компонентная архитектура:
1. **MechanicLibrary** — хранит NodeGraph-фрагменты (не code snippets), тегированные по capability/genre/topology
2. **AI Planner** — анализирует данные проекта + библиотеку → формирует план (какие механики покрыть)
3. **Graph Composer** — детерминированно компонует фрагменты в валидный NodeGraph → compileGraph() → HTML

**Ключевой принцип:** ИИ генерирует **JSON (NodeGraph)**, не JavaScript. Всё валидируется. Каждая механика трассируется до Core Loop step.

**Что НЕ делаем:** не генерируем HTML напрямую из описания, не хардкодим типы игр, не используем code snippets.

---

## 1. Постановка проблемы (с разбором кейса)

### 1.1. Кейс "гонки со стрельбой" — почему это произошло

**Проект:** Nitro_Rush (жанр: Racing)

**Текущий поток данных:**
```
Nitro_Rush → genre="Racing"
  → resolvePrototypeType("racing") → "ecology" (type mapping)
  → buildPrototypeConfig(structuralType="ecology")
  → goals2d["ecology"] = "Выживите 30 секунд, уклоняясь от угроз"
  → generate2dHtml(config)
  → HTML: player + enemies + hazards (шутер/survival, НЕ гонка)
```

**Корневые причины:**

| # | Причина | Где в коде |
|---|---------|-----------|
| 1 | `racing → ecology` — неверный маппинг жанра к типу | `prototype-params.ts:340` |
| 2 | `ecology` → hardcoded "уклоняйся от угроз" — не знает про гонки | `prototype-generator.ts:201` |
| 3 | Renderer читает только `hasCombat/hasSurvival` флаги, не Core Loop steps | `renderer-2d.ts` |
| 4 | ИИ (`generateGraphFromText`) не вызывается при генерации прототипа | `ai-service.ts:797` |
| 5 | Библиотека механик (`SavedMechanic`) хранит code snippets, не NodeGraph | `prisma/schema.prisma` |

### 1.2. Что нужно: proof-of-Concept-Loop

Прототип должен **доказывать**, что Core Loop проекта играбелен. Для гонок:

```
Core Loop Nitro_Rush:
  Step 1: "Разогнаться" → mechanic: locomotion-dash
  Step 2: "Пройти чекпоинт" → mechanic: timing-checkpoint
  Step 3: "Собрать нитро" → mechanic: collect-boost
  Step 4: "Финишировать" → mechanic: interact-finishline
```

Каждый step → конкретная механика → конкретный NodeGraph-фрагмент → конкретные ноды в графе. **Никакой стрельбы.**

### 1.3. Что НЕ нужно

- ❌ Один renderer на все проекты (current approach)
- ❌ ИИ генерирует HTML напрямую (unsafe, unverifiable)
- ❌ Хардкод маппинга жанр→тип→цель (current `prototype-params.ts`)
- ❌ Библиотека как кладбище code snippets (current `SavedMechanic`)

---

## 2. Архитектура v2

### 2.1. Компоненты и их контракты

```
┌──────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                     │
│  POST /api/v1/prototypes/generate-ai                                 │
│  Body: { project_id, mode, difficulty }                              │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    STEP 1: CONTEXT LOADER                            │
│  Загружает из БД: Concept, CoreLoop, MDA, Economy                    │
│  Вход: project_id                                                    │
│  Выход: ProjectContext (JSON)                                        │
│  Контракт: { genre, coreLoopSteps[], mechanics[], resources[] }      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│              STEP 2: AI PLANNER (LLM via z-ai-web-dev-sdk)           │
│  Вход: ProjectContext + доступные фрагменты из MechanicLibrary       │
│  LLM prompt: "Выбери механики для каждого Core Loop step"            │
│  Выход: MechanicSelectionPlan (Zod-validated)                        │
│  Контракт: { stepToMechanic[], missingMechanics[], resourceFlow[] } │
│  Fallback: если LLM недоступен → deterministic mapping               │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│         STEP 3: FRAGMENT RESOLVER                                    │
│  Для каждой механики в плане:                                        │
│    1. Искать в MechanicLibrary (по capability + tags)                │
│    2. Если нет → вызвать AI Fragment Generator (LLM)                 │
│    3. Валидировать фрагмент через validateFragment()                 │
│  Выход: ResolvedFragment[] (готовые NodeGraph-фрагменты)             │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│         STEP 4: GRAPH COMPOSER (детерминированный, без ИИ)           │
│  Вход: ResolvedFragment[] + resourceFlow[]                           │
│  Действия:                                                           │
│    1. Разместить фрагменты в графе (детерминированные позиции)       │
│    2. Связать через resourceFlow (pin-to-pin)                        │
│    3. Добавить мета-ноды: onGameStart, win, lose, hud                │
│    4. Проверить pin type compatibility                               │
│  Выход: NodeGraph (JSON)                                             │
│  Контракт: проходит validateGraph()                                  │
└───────────────────────────┬──────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│         STEP 5: COMPILER (существующий, не трогаем)                  │
│  Вход: NodeGraph                                                     │
│  Выход: HTML (через compileGraph())                                  │
│  + Coverage report: какие Core Loop steps покрыты                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2. Разделение ответственности

| Компонент | ИИ или детерминированный? | Почему |
|-----------|--------------------------|--------|
| Context Loader | Детерминированный | Чтение из БД — нет неопределённости |
| AI Planner | **ИИ** | Выбор механик требует понимания контекста |
| Fragment Resolver | Гибрид | Поиск в library — детерминированный; генерация недостающих — ИИ |
| Graph Composer | Детерминированный | Композиция графов — структурная операция, ИИ тут только навредит |
| Compiler | Детерминированный | `compileGraph()` уже работает, не трогаем |

**Принцип:** ИИ используется только там, где нужна **семантическая интерпретация** (выбор механик, генерация описаний). Структурные операции (композиция, валидация, компиляция) — детерминированные.

---

## 3. MechanicLibrary — структура и контракты

### 3.1. MechanicFragment — тип

```typescript
interface MechanicFragment {
  // Идентификация
  fragmentId: string;           // "locomotion-dash" (уникальный)
  name: string;                 // "Движение + рывок (WASD + Space)"
  description: string;          // "Игрок двигается по WASD, рывок по Space"
  capability: Capability;       // "locomotion" | "collect" | "combat" | ...
  version: string;              // "1.0.0"

  // Структура (NodeGraph-подсхема)
  nodes: GraphNode[];           // Массив нод (из существующего graph/types.ts)
  edges: GraphEdge[];           // Связи между нодами
  inputPins: FragmentPin[];     // Внешние входы (что фрагмент принимает)
  outputPins: FragmentPin[];    // Внешние выходы (что фрагмент отдаёт)

  // Метаданные для поиска
  tags: string[];               // ["movement", "topdown", "arcade"]
  compatibleTopologies: SceneTopology[];  // ["arena", "lanes"]
  compatibleGenres: string[];   // ["racing", "action", "platformer"]

  // Provenance
  source: "seed" | "ai_generated" | "user_created";
  authorId: string | null;      // user ID если user_created

  // Качество (обновляется после playtests)
  usageCount: number;
  successRate: number | null;   // 0-1, null = нет playtest evidence
  lastUsedAt: string | null;

  // Версионирование
  createdAt: string;
  updatedAt: string;
}

interface FragmentPin {
  id: string;                   // "playerRef"
  type: PinType;                // "entity" | "number" | "vec2" | ...
  label: string;                // "Player entity"
  nodeId: string;               // ID ноды внутри фрагмента, к которой привязан pin
  nodePinId: string;            // ID pin на ноде
}
```

### 3.2. Prisma model

```prisma
model MechanicFragment {
  id              String   @id @default(cuid())
  fragmentId      String   @unique
  name            String
  description     String
  capability      String
  version         String   @default("1.0.0")

  graphJson       String   // JSON: { nodes, edges, inputPins, outputPins }
  tags            String   // JSON: string[]
  compatibleTopologies String // JSON: SceneTopology[]
  compatibleGenres String   // JSON: string[]

  source          String   @default("seed") // seed | ai_generated | user_created
  authorId        String?

  usageCount      Int      @default(0)
  successRate     Float?
  lastUsedAt      DateTime?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([capability])
  @@index([source])
  @@index([isPublic])
  @@map("mechanic_fragments")
}
```

### 3.3. Seed: начальный набор из существующих адаптеров

Из 12 адаптеров prototype-compiler генерируем по 1-2 фрагмента. **Пример для locomotion:**

```json
{
  "fragmentId": "locomotion-basic",
  "name": "Базовое движение (WASD)",
  "description": "Игрок двигается по WASD/стрелкам. Скорость 200.",
  "capability": "locomotion",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "loc-onkey-w",
      "type": "onKey",
      "label": "KeyW pressed",
      "position": { "x": 50, "y": 50 },
      "properties": { "key": "KeyW", "event": "keydown" }
    },
    {
      "id": "loc-player",
      "type": "player",
      "label": "Player",
      "position": { "x": 300, "y": 150 },
      "properties": { "speed": 200, "size": 14 }
    },
    {
      "id": "loc-math-y",
      "type": "math",
      "label": "Move Y",
      "position": { "x": 175, "y": 100 },
      "properties": { "op": "multiply", "value": -200 }
    }
  ],
  "edges": [
    { "source": "loc-onkey-w", "sourceHandle": "exec", "target": "loc-math-y", "targetHandle": "exec" },
    { "source": "loc-math-y", "sourceHandle": "result", "target": "loc-player", "targetHandle": "velocityY" }
  ],
  "inputPins": [],
  "outputPins": [
    {
      "id": "playerRef",
      "type": "entity",
      "label": "Player entity",
      "nodeId": "loc-player",
      "nodePinId": "self"
    }
  ],
  "tags": ["movement", "topdown", "wasd"],
  "compatibleTopologies": ["arena", "lanes", "rooms", "node_field"],
  "compatibleGenres": ["racing", "action", "rpg", "puzzle"],
  "source": "seed",
  "usageCount": 0,
  "successRate": null
}
```

### 3.4. API контракты

```
GET  /api/v1/mechanics/fragments?capability=locomotion&genre=racing
  → 200: { fragments: MechanicFragment[] }

POST /api/v1/mechanics/fragments
  Body: { fragmentId, name, description, capability, graphJson, tags }
  → 201: { fragment: MechanicFragment }
  → 422: если fragmentId не уникален или graphJson невалиден

GET  /api/v1/mechanics/fragments/:fragmentId
  → 200: { fragment: MechanicFragment }
  → 404: если не найден

POST /api/v1/mechanics/fragments/:fragmentId/use
  → 200: { usageCount: N+1 } (инкремент usageCount)
```

---

## 4. AI Planner — контракт и prompt engineering

### 4.1. MechanicSelectionPlan — тип (Zod schema)

```typescript
const mechanicSelectionPlanSchema = z.object({
  analysis: z.object({
    coreLoopSummary: z.string(),
    recommendedCapabilities: z.array(z.string()),
    riskFactors: z.array(z.string()),
  }),

  stepToMechanic: z.array(z.object({
    stepId: z.string(),
    stepAction: z.string(),
    selectedFragmentId: z.string().nullable(),  // null = need to generate
    capability: z.string(),
    rationale: z.string(),  // почему эта механика для этого step
  })).min(1),

  missingMechanics: z.array(z.object({
    capability: z.string(),
    description: z.string(),
    forStepId: z.string(),
    suggestedNodeTypes: z.array(z.string()),
  })),

  resourceFlow: z.array(z.object({
    fromFragmentId: z.string(),
    fromPinId: z.string(),
    toFragmentId: z.string(),
    toPinId: z.string(),
    resourceType: z.string(),  // "entity" | "number" | "vec2"
  })),

  topology: z.enum(["arena", "lanes", "rooms", "grid", "node_field"]),
  topologyRationale: z.string(),
});
```

### 4.2. LLM prompt (точный текст)

```
Системный промпт:
"Ты — game design AI. Анализируешь проект и выбираешь механики для прототипа.
Отвечаешь ТОЛЬКО валидным JSON по схеме. Не выдумывай fragmentId — используй
только из списка доступных. Если подходящего фрагмента нет — укажи в missingMechanics."

Пользовательский промпт:
"""
Проект: {project.name}
Жанр: {concept.genre}
Эстетика: {concept.primaryAesthetic}
USP: {concept.usp}

Core Loop:
{coreLoop.steps.map((s, i) => `${i+1}. ${s.action} (механики: ${s.mechanicIds.join(", ")})`).join("\n")}

Ресурсы:
{coreLoop.resources.map(r => `- ${r.name}: ${r.role}`).join("\n")}

Доступные фрагменты из библиотеки:
{libraryFragments.map(f => `- ${f.fragmentId}: ${f.name} (capability: ${f.capability}, genres: ${f.compatibleGenres.join(",")})`).join("\n")}

Задача:
1. Для каждого Core Loop step выбери подходящий фрагмент из библиотеки
   ИЛИ укажи в missingMechanics (если нет подходящего)
2. Укажи resource flow (какие пины связать)
3. Выбери topology (arena/lanes/rooms/grid/node_field)
4. Обоснуй выбор

ВАЖНО:
- Не выбирай фрагменты с combat для гонок (если в Core Loop нет боя)
- Учитывай жанр: racing → locomotion + timing, НЕ combat
- Каждый step должен быть покрыт механикой
"""
```

### 4.3. Fallback (если LLM недоступен)

Детерминированный fallback на основе genre→capability mapping:

```typescript
const GENRE_CAPABILITY_FALLBACK: Record<string, Capability[]> = {
  racing: ["locomotion", "timing", "collect"],     // НЕ combat!
  shooter: ["locomotion", "combat", "survival"],
  rpg: ["locomotion", "collect", "upgrade", "combat"],
  puzzle: ["puzzle", "transform", "interact"],
  strategy: ["build", "defend", "upgrade"],
  rhythm: ["timing", "interact"],
  platformer: ["locomotion", "collect"],
  stealth: ["locomotion", "survival", "interact"],
  survival: ["locomotion", "collect", "survival", "upgrade"],
};
```

### 4.4. Anti-patterns (что AI Planner НЕ должен делать)

| Anti-pattern | Пример | Защита |
|--------------|--------|--------|
| Combat в гонках | `racing → combat` | Genre filter в prompt + post-validation |
| Дублирование механик | 2 фрагмента locomotion в одном графе | Uniqueness check в composer |
| Несовместимые topology | фрагмент для grid + topology arena | `compatibleTopologies` проверка |
| Hallucinated fragmentId | `fragmentId: "flying-mechanic"` (не существует) | Zod validation + library lookup |
| Непокрытый step | Step "Upgrade" без механики | Coverage gate в composer |

---

## 5. Graph Composer — детерминированная композиция

### 5.1. Алгоритм

```
composeGraph(plan: MechanicSelectionPlan, fragments: ResolvedFragment[]): NodeGraph
  1. Создать пустой NodeGraph
  2. Добавить мета-ноду onGameStart (позиция 0,0)
  3. Для каждого step в plan.stepToMechanic:
     a. Найти ResolvedFragment по selectedFragmentId
     b. Скопировать nodes из фрагмента (с переименованием ID для уникальности)
     c. Скопировать edges из фрагмента
     d. Разместить ноды в детерминированной позиции (grid layout)
  4. Для каждого flow в plan.resourceFlow:
     a. Найти outputPin в исходном фрагменте
     b. Найти inputPin в целевом фрагменте
     c. Проверить pin type compatibility
     d. Создать edge между ними
  5. Добавить мета-ноды: win, lose, hud
  6. Связать onGameStart → первый step
  7. Validate через validateGraph()
  8. Вернуть NodeGraph
```

### 5.2. Pin type compatibility matrix

| Output \ Input | entity | number | vec2 | boolean | exec |
|----------------|--------|--------|------|---------|------|
| entity | ✅ | ❌ | ❌ | ❌ | ❌ |
| number | ❌ | ✅ | ❌ | ✅ (≠0) | ❌ |
| vec2 | ❌ | ❌ | ✅ | ❌ | ❌ |
| boolean | ❌ | ❌ | ❌ | ✅ | ❌ |
| exec | ❌ | ❌ | ❌ | ❌ | ✅ |

Если типы несовместимы → composer добавляет adapter node (math:convert, branch).

### 5.3. Coverage gate (обязательный)

```typescript
function checkCoverage(graph: NodeGraph, plan: MechanicSelectionPlan): CoverageReport {
  const coveredSteps: string[] = [];
  const missingSteps: string[] = [];

  for (const step of plan.stepToMechanic) {
    // Проверяем: есть ли в графе ноды, относящиеся к этому step?
    const stepNodes = graph.nodes.filter(n => n.properties?.stepId === step.stepId);
    if (stepNodes.length > 0) {
      coveredSteps.push(step.stepId);
    } else {
      missingSteps.push(step.stepId);
    }
  }

  return {
    coveredSteps,
    missingSteps,
    totalSteps: plan.stepToMechanic.length,
    coveragePercent: coveredSteps.length / plan.stepToMechanic.length,
  };
}
```

**Правило:** если `coveragePercent < 1.0` → статус `needs_mapping`, HTML не генерируется.

---

## 6. Разбор кейсов

### 6.1. Кейс: Nitro_Rush (гонки)

**Контекст:**
```
genre: "Racing"
coreLoop.steps:
  1. "Разогнаться" (mechanics: ["locomotion"])
  2. "Пройти чекпоинт" (mechanics: ["timing"])
  3. "Собрать нитро" (mechanics: ["collect"])
  4. "Финишировать" (mechanics: ["interact"])
```

**AI Planner выход:**
```json
{
  "stepToMechanic": [
    { "stepId": "s1", "selectedFragmentId": "locomotion-dash", "capability": "locomotion" },
    { "stepId": "s2", "selectedFragmentId": "timing-checkpoint", "capability": "timing" },
    { "stepId": "s3", "selectedFragmentId": "collect-boost", "capability": "collect" },
    { "stepId": "s4", "selectedFragmentId": "interact-finishline", "capability": "interact" }
  ],
  "topology": "lanes",
  "topologyRationale": "Гонки — линейный маршрут с чекпоинтами"
}
```

**Результат:** граф с 4 механиками, НЕТ combat, НЕТ enemies. Цель — доехать до финиша.

### 6.2. Кейс: Shadow_Depths (рогалик)

**Контекст:**
```
genre: "RPG"
coreLoop.steps:
  1. "Исследовать" (mechanics: ["locomotion"])
  2. "Сражаться" (mechanics: ["combat"])
  3. "Собрать награду" (mechanics: ["collect"])
  4. "Улучшить" (mechanics: ["upgrade"])
```

**AI Planner выход:**
```json
{
  "stepToMechanic": [
    { "stepId": "s1", "selectedFragmentId": "locomotion-basic", "capability": "locomotion" },
    { "stepId": "s2", "selectedFragmentId": "combat-shoot", "capability": "combat" },
    { "stepId": "s3", "selectedFragmentId": "collect-loot", "capability": "collect" },
    { "stepId": "s4", "selectedFragmentId": "upgrade-spend", "capability": "upgrade" }
  ],
  "topology": "rooms",
  "topologyRationale": "Рогалик — исследование комнат"
}
```

**Результат:** граф с 4 механиками, есть combat (потому что Core Loop требует), но нет timing/puzzle.

### 6.3. Anti-pattern: что было бы НЕправильно

```
Nitro_Rush (гонки) → старый подход:
  type = "ecology" (неправильный маппинг)
  → hasCombat = true (ecology включает combat)
  → HTML: player + enemies + hazards
  → "Соберите звёзды, уклоняйтесь от врагов"
  → В гонках НЕТ врагов! ❌

Nitro_Rush (гонки) → новый подход:
  AI Planner видит жанр "Racing"
  → выбирает locomotion + timing + collect + interact
  → НЕТ combat (не в Core Loop)
  → HTML: player + checkpoints + boost + finishline
  → "Достигни финиша за минимальное время" ✅
```

---

## 7. Интеграция с существующим кодом

### 7.1. Что переиспользуется (не трогаем)

| Компонент | Файл | Статус |
|-----------|------|--------|
| NodeGraph types | `src/lib/graph/types.ts` | ✅ Не меняем (35+ типов нод) |
| compileGraph() | `src/lib/graph/compiler.ts` | ✅ Не меняем (NodeGraph → HTML) |
| validateGraph() | `src/lib/graph/validator.ts` | ✅ Не меняем (валидация) |
| NODE_DEFINITIONS | `src/lib/graph/types.ts` | ✅ Не меняем (спецификация нод) |
| React Flow editor | `src/components/prototype-editor/` | ✅ Не меняем (UI) |
| z-ai-web-dev-sdk | `src/lib/ai-service.ts` | ✅ Расширяем (новая функция) |

### 7.2. Что новое (добавляем)

| Компонент | Файл | Описание |
|-----------|------|----------|
| MechanicFragment types | `src/lib/mechanic-library/types.ts` | Тип фрагмента |
| MechanicLibrary | `src/lib/mechanic-library/library.ts` | CRUD + search |
| Seed fragments | `src/lib/mechanic-library/seed/*.json` | 15 начальных фрагментов |
| AI Planner | `src/lib/ai-service.ts` (extend) | `generateMechanicSelectionPlan()` |
| AI Fragment Generator | `src/lib/ai-service.ts` (extend) | `generateMechanicFragment()` |
| Graph Composer | `src/lib/prototype-compiler/composer.ts` | Композиция NodeGraph |
| API route | `src/app/api/v1/prototypes/generate-ai/route.ts` | Новый endpoint |
| Prisma model | `prisma/schema.prisma` (extend) | `MechanicFragment` table |

### 7.3. Что удаляем/deprecated

| Компонент | Действие |
|-----------|----------|
| `prototype-params.ts` `resolvePrototypeType()` | Deprecate (genre→type маппинг больше не нужен) |
| `prototype-generator.ts` `buildPrototypeConfig()` | Deprecate (цель выводится из плана, не из типа) |
| `renderer-2d.ts` хардкод `hasCombat/hasSurvival` | Заменить на чтение из NodeGraph |
| `SavedMechanic` model (code snippets) | Оставить для legacy, не использовать в новом flow |

---

## 8. Поток данных (end-to-end)

### 8.1. Сценарий: пользователь генерирует прототип

```
1. POST /api/v1/prototypes/generate-ai
   Body: { project_id: "nitro-rush", mode: "2d", difficulty: "baseline" }

2. Backend:
   a. Context Loader:
      - Загружает Concept (genre=Racing, aesthetics=challenge)
      - Загружает CoreLoop (steps: Разогнаться, Пройти чекпоинт, ...)
      - Загружает MDA (target dynamics: skill_scaling)

   b. AI Planner (LLM call, ~5 сек):
      - Вход: ProjectContext + 15 фрагментов из library
      - Выход: MechanicSelectionPlan
      - Если LLM недоступен → GENRE_CAPABILITY_FALLBACK

   c. Fragment Resolver:
      - locomotion-dash → найден в library ✅
      - timing-checkpoint → найден в library ✅
      - collect-boost → НЕ найден → AI Fragment Generator (~10 сек)
      - interact-finishline → найден в library ✅

   d. Graph Composer (детерминированный, <100мс):
      - 4 фрагмента → 1 NodeGraph
      - Связи по resourceFlow
      - validateGraph() → ✅ passed
      - checkCoverage() → 4/4 steps covered

   e. Compiler:
      - compileGraph(nodeGraph) → HTML
      - HTML содержит: player, checkpoints, boost, finishline
      - НЕТ enemies, НЕТ combat

3. Response:
   {
     "html": "...",
     "nodeGraph": { nodes: [...], edges: [...] },
     "plan": { stepToMechanic: [...], coverage: 1.0 },
     "coverage": { coveredSteps: ["s1","s2","s3","s4"], missingSteps: [] },
     "fragmentsUsed": [
       { fragmentId: "locomotion-dash", source: "library" },
       { fragmentId: "timing-checkpoint", source: "library" },
       { fragmentId: "collect-boost", source: "ai_generated" },
       { fragmentId: "interact-finishline", source: "library" }
     ],
     "explanation": "Для гонок выбраны: движение, тайминг чекпоинтов, сбор нитро, финиш. Combat не выбран — не в Core Loop."
   }
```

### 8.2. UI поток

```
Пользователь видит:
┌─────────────────────────────────────────┐
│  Прототип Nitro_Rush (гонки)            │
│                                          │
│  [iframe: играется в прототип]          │
│                                          │
│  Использованные механики:               │
│  ✅ Движение + рывок (library)          │
│  ✅ Тайминг чекпоинтов (library)        │
│  ✅ Сбор нитро (ИИ-сгенерировано)       │
│  ✅ Финишная линия (library)            │
│                                          │
│  Покрытие Core Loop: 4/4 (100%)         │
│                                          │
│  [Показать NodeGraph] [Скачать HTML]    │
└─────────────────────────────────────────┘
```

---

## 9. Риски и mitigation

| Риск | Вероятность | Impact | Mitigation |
|------|-------------|--------|------------|
| LLM недоступен | Средняя | Высокий | Fallback на GENRE_CAPABILITY_FALLBACK |
| LLM генерирует невалидный план | Средняя | Средний | Zod validation + retry (maxRepairAttempts: 2) |
| LLM выбирает combat для гонок | Низкая | Высокий | Genre filter в prompt + post-validation |
| Фрагмент не стыкуется (pin mismatch) | Средняя | Средний | Composer добавляет adapter nodes |
| LLM latency (15-30 сек) | Высокая | Низкий | Streaming UI + progress steps |
| Cost (много токенов) | Средняя | Средний | Кеширование по inputHash + library first |
| Hallucinated node types | Низкая | Высокий | Передаём NODE_DEFINITIONS + validateGraph() |
| Пользователь не понимает граф | Средняя | Низкий | Explanation text + React Flow visualization |

---

## 10. План реализации

### Фаза A: MechanicLibrary + seed (1 неделя)
- [ ] Prisma model `MechanicFragment`
- [ ] `src/lib/mechanic-library/types.ts`
- [ ] `src/lib/mechanic-library/library.ts` (CRUD + search by capability/genre)
- [ ] 15 seed-фрагментов (из 12 адаптеров + 3 дополнительных)
- [ ] API: `GET/POST /api/v1/mechanics/fragments`

### Фаза B: AI Planner (1 неделя)
- [ ] Zod schema `mechanicSelectionPlanSchema`
- [ ] `generateMechanicSelectionPlan()` в ai-service.ts
- [ ] Fallback: `GENRE_CAPABILITY_FALLBACK`
- [ ] Тесты: мок LLM → валидный план
- [ ] API: `POST /api/v1/prototypes/plan` (возвращает план без компиляции)

### Фаза C: AI Fragment Generator (1 неделя)
- [ ] Zod schema `mechanicFragmentSchema`
- [ ] `generateMechanicFragment()` в ai-service.ts
- [ ] validateFragment() (переиспользует validateGraph)
- [ ] Fallback: ближайший фрагмент из library по capability
- [ ] Тесты: capability + description → валидный фрагмент

### Фаза D: Graph Composer (1 неделя)
- [ ] `src/lib/prototype-compiler/composer.ts`
- [ ] Алгоритм: fragments → NodeGraph (раздел 5.1)
- [ ] Pin type compatibility matrix
- [ ] Coverage gate (checkCoverage)
- [ ] Тесты: 4 фрагмента → валидный граф, 100% coverage

### Фаза E: API + UI integration (1 неделя)
- [ ] `POST /api/v1/prototypes/generate-ai` (end-to-end)
- [ ] UI: кнопка "Сгенерировать прототип (ИИ)"
- [ ] Progress UI (шаги 1-5)
- [ ] Показ NodeGraph рядом с iframe
- [ ] Показ explanation + coverage
- [ ] "Сохранить механику в библиотеку" в нод-редакторе

### Фаза F: Acceptance tests (3 дня)
- [ ] Тест: Nitro_Rush (гонки) → НЕТ combat в графе
- [ ] Тест: Shadow_Depths (рогалик) → ЕСТЬ combat
- [ ] Тест: Crystal_Cascade (паззл) → НЕТ combat, ЕСТЬ puzzle
- [ ] Тест: LLM недоступен → fallback работает
- [ ] Тест: coverage < 100% → статус needs_mapping

**Итого: ~5 недель**

---

## 11. Контракты для проверяющих агентов

### 11.1. Инварианты (должны выполняться всегда)

1. **Genre safety:** для жанра "racing" граф НЕ содержит нод типа `enemy`, `combat`, `projectile`
2. **Core Loop coverage:** каждый step в Core Loop имеет хотя бы одну ноду в графе
3. **No hallucinated types:** все node.type ∈ NODE_DEFINITIONS
4. **Pin compatibility:** все edges связывают совместимые pin types
5. **No raw JS:** ИИ генерирует только JSON, не JavaScript
6. **Deterministic composition:** при одинаковых входах composer даёт одинаковый граф
7. **Fallback availability:** если LLM недоступен, прототип всё равно генерируется (через fallback)

### 11.2. Проверочные тесты для агентов

```typescript
// Тест 1: гонки без боя
test("racing prototype has no combat nodes", () => {
  const result = generatePrototypeAI(racingProject);
  const combatNodes = result.nodeGraph.nodes.filter(
    n => n.type === "enemy" || n.type === "projectile"
  );
  expect(combatNodes).toHaveLength(0);
});

// Тест 2: покрытие Core Loop
test("all core loop steps are covered", () => {
  const result = generatePrototypeAI(anyProject);
  expect(result.coverage.coveredSteps).toHaveLength(result.plan.stepToMechanic.length);
  expect(result.coverage.missingSteps).toHaveLength(0);
});

// Тест 3: fallback работает
test("fallback when LLM unavailable", async () => {
  mockLlmUnavailable();
  const result = await generatePrototypeAI(racingProject);
  expect(result.plan).toBeDefined();
  expect(result.html).toBeDefined();
});

// Тест 4: нет hallucinated node types
test("all node types are valid", () => {
  const result = generatePrototypeAI(anyProject);
  const validTypes = NODE_DEFINITIONS.map(d => d.type);
  for (const node of result.nodeGraph.nodes) {
    expect(validTypes).toContain(node.type);
  }
});

// Тест 5: детерминированная композиция
test("composer is deterministic", () => {
  const plan = makeTestPlan();
  const fragments = makeTestFragments();
  const g1 = composeGraph(plan, fragments);
  const g2 = composeGraph(plan, fragments);
  expect(g1).toEqual(g2);
});
```

---

## 12. Отличия от v1

| Аспект | v1 (было) | v2 (стало) |
|--------|-----------|------------|
| Конкретика | Общие принципы | Точные схемы + кейсы |
| Кейс "гонки" | Не разобран | Разбор в разделе 6.1 |
| AI Planner prompt | Не приведён | Точный текст в разделе 4.2 |
| Pin compatibility | Не описана | Матрица в разделе 5.2 |
| Coverage gate | Упомянут | Точный код в разделе 5.3 |
| Anti-patterns | Не описаны | Раздел 4.4 |
| Контракты для проверки | Не были | Раздел 11 (инварианты + тесты) |
| Fallback | Упомянут | Точный mapping в разделе 4.3 |

---

## 13. Заключение

Концепция v2 решает корневую проблему: **прототип доказывает конкретный Core Loop, а не является шаблонной аркадой**.

Ключевые принципы:
1. **Механика = NodeGraph-фрагмент** (структурированный, валидируемый, переиспользуемый)
2. **ИИ генерирует JSON, не код** (safe, verifiable)
3. **Genre-aware selection** (гонки → locomotion+timing, НЕ combat)
4. **Coverage gate** (каждый Core Loop step должен быть покрыт)
5. **Deterministic composition** (composer без ИИ — только структура)
6. **Fallback на каждый LLM call** (система работает даже без ИИ)

Для проверяющих агентов: раздел 11 содержит проверочные инварианты и тесты.
