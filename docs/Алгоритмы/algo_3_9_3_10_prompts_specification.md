# Фаза 3: Алгоритмы — Спецификация 3.9 и 3.10

> **Проект**: Gidede — Game Design AI System  
> **Дата**: 2026-05-18  
> **Настоящая фаза**: Формализация алгоритмов  
> **Данный документ**: Спецификации алгоритмов 3.9 (Спецификация AI-prompts для каждого модуля) и 3.10 (Итоговая спецификация для разработки)  
> **Источники**: Алгоритмы 3.1–3.8; Концепция программы (разд. 2.5.3, 2.5.4); Библия геймдизайна (все разделы); Синтез 1.3

---

## 3.9 Алгоритм спецификации AI-prompts для каждого модуля

### 3.9.1 Обзор алгоритма

Алгоритм спецификации AI-prompts собирает, систематизирует и формализует все AI-промпты, используемые в алгоритмах 3.1–3.8, в единую спецификацию, готовую для программной реализации. Промпт — это не просто текстовый запрос к языковой модели: это **программный интерфейс** с чётко определёнными входами, выходами, ограничениями и стратегиями обработки ошибок. Без формальной спецификации каждый промпт существует в изоляции, что приводит к дублированию, несогласованности и невозможности тестирования.

Ключевой принцип: **промпт — это функция с типизированными входами и выходами**. Как и любая функция в программной системе, промпт имеет контракты: что он принимает, что возвращает, какие гарантии предоставляет, и как обрабатывает ошибочные ситуации. Этот подход позволяет относиться к AI-операциям как к обычным компонентам системы — тестировать, профилировать, кэшировать и оптимизировать их.

Алгоритм состоит из 5 этапов: (1) инвентаризация всех промптов из алгоритмов 3.1–3.8, (2) формализация интерфейсов каждого промпта, (3) проектирование промпт-архитектуры (слои, кэширование, маршрутизация по моделям), (4) спецификация стратегий обработки ошибок и fallback-цепочек, (5) генерация программных интерфейсов (API) для каждого промпта.

### 3.9.2 Этап 1: Инвентаризация промптов

**Цель**: Собрать полный каталог всех AI-промптов из алгоритмов 3.1–3.8, классифицировать их по модулям, типам и требованиям к модели.

**Полный каталог промптов**:

| # | ID промпта | Модуль | Алгоритм | Тип задачи | Рекоменд. модель | Вход | Выход |
|---|-----------|--------|----------|-----------|-----------------|------|-------|
| 1 | CLASSIFY_GENRE | Блок 1 | 3.1 | Классификация | Haiku/GPT-3.5 | idea text | JSON [{genre, subgenre, confidence}] |
| 2 | EXTRACT_AESTHETICS | Блок 1 | 3.1 | Анализ | Sonnet/GPT-4 | idea, genre | JSON [{aesthetic, confidence, reasoning}] |
| 3 | GENERATE_CORE_LOOPS | Блок 1+2 | 3.1+3.2 | Генерация | Sonnet/GPT-4 | mechanics, aesthetics | JSON [{name, steps, loop_type, fun_check}] |
| 4 | GENERATE_USP | Блок 1 | 3.1 | Генерация | Sonnet/GPT-4 | mechanics, genre, references | JSON [{usp, triangle_check, differentiation}] |
| 5 | DECOMPOSE_STEP | Блок 2 | 3.2 | Декомпозиция | Haiku/GPT-3.5 | step, core_loop | JSON [{actions, fun_check}] |
| 6 | GENERATE_OUTER_LOOPS | Блок 2 | 3.2 | Генерация | Sonnet/GPT-4 | core_loop, mechanics | JSON [{outer_loop, motivation_link}] |
| 7 | GENERATE_META_LOOP | Блок 2 | 3.2 | Генерация | Sonnet/GPT-4 | outer_loops, genre | JSON [{meta_loop, retention_mechanism}] |
| 8 | GENERATE_RECOMMENDATIONS | Блок 2 | 3.2 | Рекомендация | Haiku/GPT-3.5 | pathology, core_loop | JSON [{recommendation, priority}] |
| 9 | SUGGEST_DYNAMICS | Блок 3 | 3.3 | Генерация | Sonnet/GPT-4 | aesthetic, genre | JSON [{dynamic, aesthetics_served, genre_fit}] |
| 10 | SUGGEST_MECHANICS | Блок 3 | 3.3 | Генерация | Sonnet/GPT-4 | dynamic, genre, existing | JSON [{mechanic, group, dynamics, genre_affinity}] |
| 11 | SIMULATE_GAMEPLAY | Блок 3 | 3.3 | Симуляция | Sonnet/GPT-4 | mechanics, genre | JSON [{gameplay_sequence, resource_flows, feedback_loops}] |
| 12 | APPLY_LENS_MDA | Блок 3 | 3.3 | Оценка | Haiku/GPT-3.5 | lens, mechanic_set, mda_result | JSON [{lens_id, score, issues, suggestions}] |
| 13 | CHECK_LUDONARRATIVE_MDA | Блок 3 | 3.3 | Анализ | Sonnet/GPT-4 | mechanics, narrative | JSON [{result, dissonances, harmonies}] |
| 14 | ESTIMATE_WEIGHTS | Блок 4 | 3.4 | Оценка | Haiku/GPT-3.5 | objects, anchor, genre | JSON {attribute: weight} |
| 15 | EVALUATE_SITUATIONAL_VALUE | Блок 4 | 3.4 | Оценка | Haiku/GPT-3.5 | object, situation, genre | JSON {value, reasoning, dominant_attrs} |
| 16 | SUGGEST_INTRANSITIVE_CORRECTIONS | Блок 4 | 3.4 | Генерация | Sonnet/GPT-4 | payoff_matrix, dominant | JSON [{changes, expected_share}] |
| 17 | ANALYZE_DISCREPANCY | Блок 4 | 3.4 | Анализ | Sonnet/GPT-4 | formal_ranking, sim_ranking | JSON {likely_cause, recommended_action} |
| 18 | SELECT_BEST_CORRECTION | Блок 4 | 3.4 | Выбор | Haiku/GPT-3.5 | pathology, corrections, genre | JSON {selected, reasoning, side_effects} |
| 19 | PLAN_TIERS | Блок 5 | 3.5 | Генерация | Sonnet/GPT-4 | genre, levels, loop_type | JSON [{tier_index, level_range, scale, dominant}] |
| 20 | SUGGEST_UNLOCKS | Блок 5 | 3.5 | Генерация | Sonnet/GPT-4 | tier, mechanics, aesthetics | JSON [{level, unlock_name, synergies}] |
| 21 | CHECK_PROGRESSION_AESTHETICS | Блок 5 | 3.5 | Валидация | Haiku/GPT-3.5 | aesthetics, curves, unlocks | JSON [{aesthetic, supporting, contradicting, score}] |
| 22 | SUGGEST_SUBSIDIARY_RESOURCES | Блок 5 | 3.6 | Генерация | Sonnet/GPT-4 | core_resources, genre | JSON [{name, class, relationship, bounds}] |
| 23 | SUGGEST_LATE_GAME_SINKS | Блок 5 | 3.6 | Генерация | Sonnet/GPT-4 | resource, genre, aesthetics | JSON [{sink_name, description, player_value}] |
| 24 | GENERATE_ECONOMY_DESCRIPTION | Блок 5 | 3.6 | Генерация | Haiku/GPT-3.5 | machinations, type, genre | Markdown text |
| 25 | ENRICH_SECTION | Блок 6 | 3.7 | Обогащение | Sonnet/GPT-4 | section, existing, context | Markdown text |
| 26 | GENERATE_CHARACTERS_SECTION | Блок 6 | 3.7 | Генерация | Sonnet/GPT-4 | genre, setting, core_loop | JSON [{name, role, motivation, arc, voice}] |
| 27 | GENERATE_VISUAL_STYLE | Блок 6 | 3.7 | Генерация | Sonnet/GPT-4 | genre, aesthetics, mood | JSON {palette, style, references, image_prompts} |
| 28 | CHECK_LUDONARRATIVE_VAL | Блок 6 | 3.8 | Анализ | Sonnet/GPT-4 | themes, actions, rewards | JSON {result, dissonances, harmonies} |
| 29 | APPLY_LENS_VAL | Блок 6 | 3.8 | Оценка | Haiku/GPT-3.5 | lens, context, previous_issues | JSON {lens_id, score, issues, suggestions} |
| 30 | CHECK_PLAYER_AGENCY | Блок 6 | 3.8 | Анализ | Sonnet/GPT-4 | choices, consequences, branching | JSON {score, gaps, strengths, false_choices} |
| 31 | GENERATE_REMEDIATION | Блок 6 | 3.8 | Генерация | Haiku/GPT-3.5 | issues, design_summary | JSON [{issue_id, action, effort, order}] |

**Статистика промптов**:

| Метрика | Значение |
|---------|----------|
| Всего промптов | 31 |
| Креативные (Sonnet/GPT-4) | 18 (58%) |
| Рутинные (Haiku/GPT-3.5) | 13 (42%) |
| Блок 1 (Концепция) | 4 |
| Блок 2 (Core Loop) | 4 |
| Блок 3 (MDA) | 5 |
| Блок 4 (Баланс) | 5 |
| Блок 5 (Экономика/Прогрессия) | 6 |
| Блок 6 (GDD/Валидация) | 7 |

### 3.9.3 Этап 2: Формализация интерфейсов промптов

**Цель**: Для каждого промпта определить формальный интерфейс — типизированные входы, выходы, гарантии и ограничения. Это позволяет обрабатывать промпты как программные компоненты.

**Универсальный интерфейс промпта**:

```typescript
interface PromptSpec {
    // Идентификация
    id: string;                          // Уникальный ID (CLASSIFY_GENRE)
    module: ModuleType;                  // Принадлежность к модулю
    algorithm: string;                   // Алгоритм-источник (3.1, 3.2, ...)
    version: string;                     // Версия промпта (semver)
    
    // Тип задачи
    taskType: PromptTaskType;            // Классификация/Генерация/Анализ/Оценка/Рекомендация
    
    // Входы
    inputs: PromptInput[];               // Типизированные параметры
    
    // Выходы
    outputFormat: OutputFormat;          // JSON/Markdown/Text
    outputSchema: JSONSchema;            // JSON-Schema для валидации выхода
    outputExamples: string[];            // Примеры корректного выхода
    
    // Промпт-шаблон
    systemPrompt: string;                // SYSTEM-часть (с плейсхолдерами)
    userPromptTemplate: string;          // USER-часть (с плейсхолдерами)
    
    // Модель и параметры
    modelRequirements: ModelRequirements;
    
    // Гарантии
    guarantees: PromptGuarantees;
    
    // Метрики
    estimatedTokens: { input: number; output: number };
    estimatedCost: { min: number; max: number };  // USD
    estimatedLatency: { min: number; max: number };  // ms
}

type PromptTaskType = 
    | 'classification'     // Классификация входа по категориям
    | 'generation'         // Генерация нового контента
    | 'analysis'           // Анализ существующего контента
    | 'evaluation'         // Оценка по критериям
    | 'recommendation';    // Рекомендация по исправлению

interface PromptInput {
    name: string;                         // Имя параметра
    type: 'string' | 'number' | 'object' | 'array';
    required: boolean;
    description: string;
    default?: any;
    validation?: (value: any) => boolean;
}

interface ModelRequirements {
    primary: ModelSpec;                   // Основная модель
    fallback: ModelSpec;                  // Fallback-модель
    minContextWindow: number;             // Минимальное контекстное окно (токены)
    temperature: number;                  // 0.0-1.0
    maxTokens: number;                    // Максимум выходных токенов
    responseFormat: 'json' | 'text';     // Формат ответа
}

interface ModelSpec {
    provider: 'openai' | 'anthropic' | 'google' | 'local';
    model: string;                        // gpt-4, claude-3-sonnet, и т.д.
    maxCostPerCall: number;               // USD
}

interface PromptGuarantees {
    deterministic: boolean;               // Одинаковый вход → одинаковый выход (temp=0)?
    jsonOutput: boolean;                  // Гарантированный JSON на выходе?
    maxRetries: number;                   // Максимум попыток при ошибке
    fallbackOnFailure: boolean;           // Fallback на более слабую модель?
    cacheable: boolean;                   // Можно ли кэшировать результат?
    cacheTTL?: number;                    // Время жизни кэша (секунды)
}
```

**Пример формализованного промпта**:

```typescript
const CLASSIFY_GENRE: PromptSpec = {
    id: "CLASSIFY_GENRE",
    module: "concept",
    algorithm: "3.1",
    version: "1.0.0",
    taskType: "classification",
    
    inputs: [
        { name: "idea", type: "string", required: true, description: "Текстовое описание идеи игры (1-5 предложений)" },
        { name: "genre", type: "string", required: false, description: "Указанный жанр (если пользователь выбрал)", default: null }
    ],
    
    outputFormat: "json",
    outputSchema: {
        type: "array",
        items: {
            type: "object",
            properties: {
                genre: { type: "string" },
                subgenre: { type: "string" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reasoning: { type: "string" }
            },
            required: ["genre", "subgenre", "confidence", "reasoning"]
        },
        maxItems: 3
    },
    outputExamples: [
        '[{"genre":"RPG","subgenre":"roguelike","confidence":0.85,"reasoning":"Упоминание алхимии и варки зелий..."}]'
    ],
    
    systemPrompt: `Ты — эксперт по жанровой классификации игр. Определи жанр на основе 
описания идеи пользователя. Используй таксономию Роджерса: Action (platformer, 
shooter, fighting, stealth, survival horror, rhythm), Adventure, RPG (action, 
JRPG, tactical, MMORPG, roguelike), Simulation, Strategy, Puzzle, Party, 
Educational, Racing, Sports. Верни топ-3 жанра с оценкой уверенности (0-1).`,
    
    userPromptTemplate: `{idea}`,
    
    modelRequirements: {
        primary: { provider: "anthropic", model: "claude-3-haiku", maxCostPerCall: 0.01 },
        fallback: { provider: "openai", model: "gpt-3.5-turbo", maxCostPerCall: 0.005 },
        minContextWindow: 4096,
        temperature: 0.3,
        maxTokens: 500,
        responseFormat: "json"
    },
    
    guarantees: {
        deterministic: false,
        jsonOutput: true,
        maxRetries: 2,
        fallbackOnFailure: true,
        cacheable: true,
        cacheTTL: 3600  // 1 час — жанр не меняется
    },
    
    estimatedTokens: { input: 200, output: 300 },
    estimatedCost: { min: 0.002, max: 0.01 },
    estimatedLatency: { min: 500, max: 3000 }
};
```

### 3.9.4 Этап 3: Промпт-архитектура — слои, маршрутизация, кэширование

**Цель**: Спроектировать архитектуру промпт-системы, которая обеспечивает эффективность (кэширование), отказоустойчивость (fallback-цепочки), экономичность (маршрутизация по моделям) и согласованность (общие слои контекста).

#### 3.9.4.1 Трёхслойная архитектура промптов

Каждый вызов AI в Gidede строится из трёх слоёв, как определено в Концепции программы (разд. 2.5.3):

```
┌──────────────────────────────────────────────────────┐
│  СЛОЙ 3: TASK PROMPT (специфичный для промпта)       │
│  Конкретная задача + формат выхода                    │
│  Уникален для каждого из 31 промптов                  │
│  ┌──────────────────────────────────────────────────┐│
│  │  СЛОЙ 2: CONTEXT PROMPT (динамический)           ││
│  │  Текущее состояние проекта из Project State       ││
│  │  Обновляется при каждом изменении модели          ││
│  │  ┌──────────────────────────────────────────────┐││
│  │  │  СЛОЙ 1: SYSTEM PROMPT (статичный)           │││
│  │  │  Базовая роль: Gidede AI-ассистент            │││
│  │  │  Библия геймдизайна (структурированные знания)│││
│  │  │  Фреймворки: MDA, MechanicsDB, типологии      │││
│  │  └──────────────────────────────────────────────┘││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

**Слой 1: System Prompt (статичный, ~2000 токенов)**

```
Ты — AI-ассистент Gidede, интеллектуальной системы для геймдизайна. Твои знания 
основаны на 17 книгах по геймдизайну и формализованных фреймворках.

Твои основные фреймворки:
- MDA Framework (ЛеБланк): 8 эстетических ценностей (Чувственное, Фантазия, 
  Нарратив, Вызов, Товарищество, Открытие, Выражение, Подчинение)
- MechanicsDB: 127 механик в 15 группах (SW.BAND)
- Типология Селлерса: Engines / Economies / Ecologies
- Core Loop Model: иерархия петель (микро → мета)
- Баланс-модели: transitive, intransitive, cost-power curves
- Machinations (Адамс/Дорманс): визуальный язык экономики игр

Твои принципы:
1. Ты предлагаешь, а не диктуешь. Окончательные решения принимает дизайнер.
2. Каждое рекомендация обоснована теорией. Цитируй: [Автор, Концепция].
3. Проверяй совместимость: новые элементы должны работать с существующими.
4. Учитывай жанровые конвенции, но не бойся их нарушать с обоснованием.
5. При конфликте между теорией и интуицией дизайнера — покажи оба варианта.
```

**Слой 2: Context Prompt (динамический, ~1500 токенов)**

Генерируется из Project State при каждом вызове:

```typescript
function generateContextPrompt(state: ProjectState): string {
    return `
Текущий проект: ${state.name}
Жанр: ${state.concept.genre}
Целевая эстетика: ${state.mdaProfile.aestheticProfile.primary}, ${state.mdaProfile.aestheticProfile.secondary}
Core Loop: ${state.coreLoop.steps.map(s => s.action).join(' → ')}
Механики: ${state.mdaProfile.mechanicSet.mechanics.map(m => m.name).join(', ')}
Структурный тип: ${state.coreLoop.structural_type}
Уровни прогрессии: ${state.progressionProfile.totalLevels}
Ресурсы экономики: ${state.economyProfile.resources.map(r => r.name).join(', ')}
Монетизация: ${state.economyProfile.monetizationType}
`.trim();
}
```

**Слой 3: Task Prompt (специфичный, переменная длина)**

Индивидуален для каждого промпта — см. каталог в 3.9.2.

#### 3.9.4.2 Маршрутизация по моделям

```
┌─────────────────────────────────────────────────────────────┐
│                    PROMPT ROUTER                             │
│                                                              │
│  ВХОД: PromptSpec + inputs                                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Правила маршрутизации:                                  ││
│  │                                                          ││
│  │  taskType == "classification"  →  Haiku / GPT-3.5       ││
│  │  taskType == "evaluation"       →  Haiku / GPT-3.5       ││
│  │  taskType == "recommendation"   →  Haiku / GPT-3.5       ││
│  │  taskType == "generation"       →  Sonnet / GPT-4        ││
│  │  taskType == "analysis"         →  Sonnet / GPT-4        ││
│  │                                                          ││
│  │  input.length > 4000 tokens    →  Sonnet / GPT-4         ││
│  │  outputSchema.complex          →  Sonnet / GPT-4         ││
│  │                                                          ││
│  │  OVERRIDE: user_premium = true  →  Sonnet / GPT-4 always ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ВЫХОД: { provider, model, temperature, maxTokens }          │
└─────────────────────────────────────────────────────────────┘
```

#### 3.9.4.3 Кэширование промптов

```typescript
interface PromptCache {
    // Стратегия: одинаковый вход → тот же выход (без повторного вызова AI)
    // Ключ кэша = hash(systemPrompt + contextPrompt + taskPrompt + inputs)
    
    rules: {
        // Кэшируемые промпты (результат детерминирован или почти)
        CLASSIFY_GENRE:               { cacheable: true, ttl: 3600 },    // Жанр не меняется
        EXTRACT_AESTHETICS:           { cacheable: true, ttl: 1800 },    // Эстетика стабильна
        ESTIMATE_WEIGHTS:             { cacheable: true, ttl: 1800 },    // Веса стабильны
        CHECK_PROGRESSION_AESTHETICS: { cacheable: true, ttl: 900 },     // Проверка стабильна
        APPLY_LENS_*:                 { cacheable: true, ttl: 900 },     // Оценка стабильна
        
        // Некэшируемые промпты (каждый вызов должен быть уникальным)
        GENERATE_CORE_LOOPS:          { cacheable: false },              // Креативная генерация
        GENERATE_USP:                 { cacheable: false },              // Креативная генерация
        GENERATE_CHARACTERS_SECTION:  { cacheable: false },              // Креативная генерация
        SUGGEST_INTRANSITIVE_CORRECTIONS: { cacheable: false },          // Вариативные решения
    };
    
    // Хранилище: Redis с TTL
    backend: "redis";
    keyPrefix: "gidede:prompt_cache:";
}
```

#### 3.9.4.4 Fallback-цепочки

```
┌──────────────────────────────────────────────────────────────┐
│                    FALLBACK CHAIN                             │
│                                                              │
│  Для каждого промпта определена цепочка fallback:             │
│                                                              │
│  Попытка 1: primary model (Sonnet/GPT-4)                     │
│    ↓ Ошибка: timeout, rate_limit, invalid_json               │
│  Попытка 2: fallback model (Haiku/GPT-3.5)                   │
│    ↓ Ошибка: timeout, rate_limit                             │
│  Попытка 3: cached result (если есть в кэше)                 │
│    ↓ Ошибка: нет в кэше                                      │
│  Попытка 4: degraded response (заглушка из алгоритма)         │
│    ↓ Ошибка: нет заглушки                                    │
│  Результат: Error с информативным сообщением для пользователя │
│                                                              │
│  Таймауты:                                                    │
│  - Sonnet/GPT-4: 30 секунд                                   │
│  - Haiku/GPT-3.5: 15 секунд                                  │
│  - Кэш: 1 секунда                                            │
│  - Заглушка: мгновенно                                       │
└──────────────────────────────────────────────────────────────┘
```

### 3.9.5 Этап 4: Стратегии обработки ошибок и валидации выхода

**Цель**: Определить, как система обрабатывает некорректные выходы AI (невалидный JSON, несоответствие схеме, галлюцинации) и обеспечивает надёжность при масштабном использовании.

**Алгоритм валидации выхода**:

```
ВХОД: AI-ответ, PromptSpec

// ===== ШАГ 1: Синтаксическая валидация =====
IF PromptSpec.outputFormat == "json":
    TRY:
        parsed = JSON.parse(ai_response)
    CATCH:
        // Попытка извлечь JSON из текста (AI иногда добавляет пояснения)
        json_match = REGEX_FIND(ai_response, pattern=/```json\n?([\s\S]*?)\n?```/)
        IF json_match:
            parsed = JSON.parse(json_match)
        ELSE:
            // Retry с уточнением: "Ответь только валидным JSON"
            RETRY_WITH_HINT(prompt_spec, hint="Верни только валидный JSON без пояснений")
            IF retry_failed:
                RETURN Error("AI вернул невалидный JSON после 2 попыток")

// ===== ШАГ 2: Схемная валидация =====
IF PromptSpec.outputSchema:
    validation = VALIDATE_JSON_SCHEMA(parsed, PromptSpec.outputSchema)
    IF NOT validation.valid:
        // Пытаемся исправить общие проблемы
        IF validation.missing_required_fields:
            // Заполнить значениями по умолчанию
            parsed = FILL_DEFAULTS(parsed, PromptSpec.outputSchema)
        IF validation.type_mismatches:
            // Преобразовать типы (строка → число и т.д.)
            parsed = COERCE_TYPES(parsed, PromptSpec.outputSchema)
        
        // Повторная валидация
        revalidation = VALIDATE_JSON_SCHEMA(parsed, PromptSpec.outputSchema)
        IF NOT revalidation.valid:
            LOG_WARNING(f"Схемная валидация неуспешна: {revalidation.errors}")
            // Использовать частичный результат (лучше, чем ничего)

// ===== ШАГ 3: Семантическая валидация =====
// Проверка на галлюцинации и нереалистичные значения
IF PromptSpec.taskType == "classification":
    // Все жанры должны быть из таксономии
    FOR EACH result IN parsed:
        IF result.genre NOT IN GENRE_TAXONOMY:
            result.genre = FUZZY_MATCH(result.genre, GENRE_TAXONOMY)
            result.confidence *= 0.7  // Штраф за неуверенность

IF PromptSpec.taskType == "evaluation":
    // Все оценки должны быть 0-1
    FOR EACH result IN parsed:
        result.score = CLAMP(result.score, 0, 1)

// ===== ШАГ 4: Детерминированная заглушка =====
// Для критичных промптов — алгоритмический fallback
IF ai_call_failed AND PromptSpec.id IN DETERMINISTIC_FALLBACKS:
    fallback_result = DETERMINISTIC_FALLBACKS[PromptSpec.id](inputs)
    // Примеры:
    // CLASSIFY_GENRE → KEYWORD_MATCH_GENRE(idea)
    // ESTIMATE_WEIGHTS → UNIFORM_WEIGHTS(attributes)
    // CHECK_PROGRESSION_AESTHETICS → RULE_BASED_CHECK(curves, aesthetics)
    RETURN fallback_result

ВЫХОД: validated_result + metadata (attempts, model_used, cached)
```

**Таблица: Детерминированные заглушки для критичных промптов**

| Промпт ID | Заглушка | Точность | Когда используется |
|-----------|---------|----------|-------------------|
| CLASSIFY_GENRE | KEYWORD_MATCH_GENRE | ~60% | AI недоступен |
| EXTRACT_AESTHETICS | GENRE_AESTHETIC_MAP[genre] | ~70% | AI недоступен |
| ESTIMATE_WEIGHTS | UNIFORM_WEIGHTS | ~50% | AI недоступен |
| APPLY_LENS_* | RULE_BASED_SCORING | ~40% | AI недоступен |
| CHECK_PROGRESSION_AESTHETICS | AESTHETIC_RULE_TABLE | ~60% | AI недоступен |
| EVALUATE_SITUATIONAL_VALUE | POWER_COST_RATIO | ~70% | AI недоступен |

### 3.9.6 Этап 5: Программные интерфейсы (API) для промпт-системы

**Цель**: Определить API, через который серверные модули Gidede вызывают AI-промпты. Это унифицированный интерфейс, который скрывает детали маршрутизации, кэширования и fallback.

```typescript
// ===== Единый интерфейс вызова промптов =====

class PromptExecutor {
    /**
     * Выполнить AI-промпт с автоматической маршрутизацией, кэшированием и fallback.
     * 
     * @param promptId - ID промпта из каталога (CLASSIFY_GENRE, и т.д.)
     * @param inputs - Типизированные входные параметры
     * @param options - Опциональные настройки (override модели, skip cache, и т.д.)
     * @returns Promise<PromptResult> - Валидированный результат + метаданные
     */
    async execute<T>(
        promptId: string,
        inputs: Record<string, any>,
        options?: PromptExecutionOptions
    ): Promise<PromptResult<T>> {
        // 1. Получить спецификацию промпта
        const spec = PROMPT_REGISTRY[promptId];
        
        // 2. Проверить кэш
        if (!options?.skipCache && spec.guarantees.cacheable) {
            const cached = await this.cache.get(spec.id, inputs);
            if (cached) return cached;
        }
        
        // 3. Собрать промпт из 3 слоёв
        const systemPrompt = this.buildSystemPrompt();
        const contextPrompt = this.buildContextPrompt(this.projectState);
        const taskPrompt = this.buildTaskPrompt(spec, inputs);
        
        // 4. Маршрутизация по модели
        const modelConfig = this.router.route(spec, options);
        
        // 5. Вызов AI с retry + fallback
        const result = await this.callWithFallback(
            modelConfig,
            systemPrompt + "\n" + contextPrompt,
            taskPrompt,
            spec
        );
        
        // 6. Валидация выхода
        const validated = this.validateOutput(result, spec);
        
        // 7. Кэширование
        if (spec.guarantees.cacheable) {
            await this.cache.set(spec.id, inputs, validated, spec.guarantees.cacheTTL);
        }
        
        return validated;
    }
}

interface PromptExecutionOptions {
    skipCache?: boolean;              // Пропустить кэш (форсировать новый вызов)
    overrideModel?: ModelSpec;        // Переопределить модель
    maxRetries?: number;              // Максимум попыток (переопределить default)
    temperature?: number;             // Переопределить температуру
    timeout?: number;                 // Таймаут в ms
}

interface PromptResult<T> {
    data: T;                          // Валидированный результат
    metadata: {
        promptId: string;
        model: string;                // Какая модель реально использовалась
        attempts: number;             // Количество попыток
        fromCache: boolean;           // Из кэша?
        latencyMs: number;            // Время выполнения
        tokensUsed: { input: number; output: number };
        cost: number;                 // Стоимость в USD
        validationPassed: boolean;
    };
}
```

**Реестр промптов**:

```typescript
const PROMPT_REGISTRY: Record<string, PromptSpec> = {
    CLASSIFY_GENRE,
    EXTRACT_AESTHETICS,
    GENERATE_CORE_LOOPS,
    GENERATE_USP,
    DECOMPOSE_STEP,
    GENERATE_OUTER_LOOPS,
    GENERATE_META_LOOP,
    GENERATE_RECOMMENDATIONS,
    SUGGEST_DYNAMICS,
    SUGGEST_MECHANICS,
    SIMULATE_GAMEPLAY,
    APPLY_LENS_MDA,
    CHECK_LUDONARRATIVE_MDA,
    ESTIMATE_WEIGHTS,
    EVALUATE_SITUATIONAL_VALUE,
    SUGGEST_INTRANSITIVE_CORRECTIONS,
    ANALYZE_DISCREPANCY,
    SELECT_BEST_CORRECTION,
    PLAN_TIERS,
    SUGGEST_UNLOCKS,
    CHECK_PROGRESSION_AESTHETICS,
    SUGGEST_SUBSIDIARY_RESOURCES,
    SUGGEST_LATE_GAME_SINKS,
    GENERATE_ECONOMY_DESCRIPTION,
    ENRICH_SECTION,
    GENERATE_CHARACTERS_SECTION,
    GENERATE_VISUAL_STYLE,
    CHECK_LUDONARRATIVE_VAL,
    APPLY_LENS_VAL,
    CHECK_PLAYER_AGENCY,
    GENERATE_REMEDIATION
};
```

### 3.9.7 Итоговая сборка: Prompt Specification Profile

```typescript
interface PromptSpecificationProfile {
    // Каталог
    totalPrompts: 31;
    byModule: Record<string, number>;
    byTaskType: Record<PromptTaskType, number>;
    byModel: { creative: number; routine: number };
    
    // Архитектура
    layers: {
        system: string;              // Статичный System Prompt
        context: string;             // Шаблон Context Prompt
        task: Record<string, string>; // Все Task Prompt-ы
    };
    
    // Инфраструктура
    routing: PromptRouter;
    caching: PromptCache;
    fallback: FallbackChain;
    validation: OutputValidator;
    
    // API
    executor: PromptExecutor;
    registry: Record<string, PromptSpec>;
    
    // Оценка стоимости
    estimatedCostPerSession: {
        min: 0.10,   // USD (только рутинные операции)
        max: 1.50    // USD (все креативные + итерации)
    };
    estimatedCostPerProject: {
        min: 0.50,   // USD (базовый сценарий)
        max: 5.00    // USD (глубокая проработка)
    };
}
```

---

## 3.10 Алгоритм итоговой спецификации для разработки

### 3.10.1 Обзор алгоритма

Алгоритм итоговой спецификации объединяет результаты всех 9 предшествующих алгоритмов (3.1–3.9) в **единый документ, готовый к передаче в Фазу 4 (Разработка)**. Это не просто компиляция — это структурированная техническая спецификация, которая даёт команде разработчиков всю необходимую информацию для реализации системы: архитектуру, потоки данных, интерфейсы модулей, модели данных, AI-интеграцию и план разработки.

Ключевой принцип: **спецификация — это контракт между дизайном и разработкой**. Фазы 1–3 создали теоретический фундамент (база знаний, библия, концепция, алгоритмы). Фаза 4 — это инженерная реализация. Итоговая спецификация — мост между ними: она переводит теоретические модели в конкретные программные компоненты с определёнными интерфейсами, зависимостями и метриками качества.

Алгоритм состоит из 6 этапов: (1) обзор архитектуры системы, (2) спецификация модулей и их интерфейсов, (3) модель данных Project State, (4) AI-интеграция, (5) план разработки и зависимости, (6) критерии приёмки и тестирования.

### 3.10.2 Этап 1: Обзор архитектуры системы

**Архитектура Gidede** следует принципам модульности, событийно-ориентированного взаимодействия и единого источника истины (SSOT).

```
┌─────────────────────────────────────────────────────────────────┐
│                        КЛИЕНТ (Next.js 16)                      │
│                                                                  │
│  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ │
│  │Концеп-│ │Core   │ │MDA    │ │Баланс │ │Эконо-│ │GDD    │ │
│  │ция    │ │Loop   │ │Lab    │ │       │ │мика  │ │Генер. │ │
│  └───┬───┘ └───┬───┘ └───┬───┘ └───┬───┘ └──┬───┘ └───┬───┘ │
│      │         │         │         │         │         │      │
│      ▼         ▼         ▼         ▼         ▼         ▼      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Gateway (REST)                     │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                       │
│  ┌──────────────────────▼───────────────────────────────────┐  │
│  │                  Event Bus (Redis Pub/Sub)                │  │
│  └──┬──────┬──────┬──────┬──────┬──────┬──────┬─────────────┘  │
└─────┼──────┼──────┼──────┼──────┼──────┼──────┼─────────────────┘
      │      │      │      │      │      │      │
┌─────▼──────▼──────▼──────▼──────▼──────▼──────▼─────────────────┐
│                      СЕРВЕР (Python/FastAPI)                     │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Concept  │ │ CoreLoop │ │ MDALab   │ │ Balance  │          │
│  │ Service  │ │ Service  │ │ Service  │ │ Service  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       │            │            │            │                  │
│  ┌────▼────────────▼────────────▼────────────▼──────────┐     │
│  │              Project State (PostgreSQL)                │     │
│  └────┬────────────┬────────────┬────────────┬──────────┘     │
│       │            │            │            │                  │
│  ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐ ┌────▼─────┐        │
│  │ Economy  │ │ GDD      │ │ AI       │ │ GBE      │        │
│  │ Service  │ │ Service  │ │ Service  │ │ Bridge   │        │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘        │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
│  │Knowledge │ │Machinati-│ │Simulati- │                        │
│  │Base (RAG)│ │ons Engine│ │on Engine │                        │
│  └──────────┘ └──────────┘ └──────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

**Технологический стек**:

| Компонент | Технология | Обоснование |
|-----------|-----------|-------------|
| Клиент | Next.js 16 + React 19 + TypeScript | SSR, быстрый UI, экосистема |
| UI-фреймворк | Tailwind CSS 4 + shadcn/ui | Кастомизируемые компоненты |
| Сервер | Python 3.12 + FastAPI | Асинхронность, типизация, скорость |
| БД основная | PostgreSQL 16 | Надёжность, JSON-поддержка, SSR |
| Кэш | Redis 7 | Сессии, кэш промптов, Event Bus |
| Векторная БД | pgvector / Qdrant | RAG: embeddings 17 книг |
| AI-провайдеры | OpenAI + Anthropic | Мультипровайдерная архитектура |
| Симуляция | NumPy + SciPy | Monte Carlo, Machinations |
| Диаграммы | D3.js + Mermaid | Machinations, Core Loop, деревья |
| Экспорт | WeasyPrint (PDF), python-docx | GDD в PDF/DOCX |
| Деплой | Docker + Vercel | Клиент: Vercel, Сервер: Docker |

### 3.10.3 Этап 2: Спецификация модулей и интерфейсов

**Цель**: Для каждого из 8 функциональных блоков определить программный интерфейс (API), зависимости от других модулей и ключевые компоненты.

#### Блок 1: Concept Service

```
POST /api/v1/projects/{id}/concept/generate
  → Вход: ConceptInput
  → Выход: OnePager + AestheticProfile + MechanicSet + USP
  → AI-промпты: CLASSIFY_GENRE, EXTRACT_AESTHETICS, GENERATE_CORE_LOOPS, GENERATE_USP
  → Зависимости: MechanicsDB (статичная БД)

POST /api/v1/projects/{id}/concept/validate
  → Вход: OnePager
  → Выход: ValidationReport (Triangle + 8 Filters + 5 Questions)
  → AI-промпты: none (алгоритмическая валидация)
```

#### Блок 2: Core Loop Service

```
POST /api/v1/projects/{id}/coreloop/design
  → Вход: CoreLoopInput
  → Выход: CoreLoopProfile (иерархия петель, диагностика, рекомендации)
  → AI-промпты: DECOMPOSE_STEP, GENERATE_OUTER_LOOPS, GENERATE_META_LOOP, GENERATE_RECOMMENDATIONS
  → Зависимости: Concept Service (OnePager, MechanicSet)

POST /api/v1/projects/{id}/coreloop/diagnose
  → Вход: CoreLoopProfile
  → Выход: PathologyReport (runaway, deadlock, stall, feedback_strength)
  → AI-промпты: none (алгоритмическая диагностика через Machinations)
```

#### Блок 3: MDA Lab Service

```
POST /api/v1/projects/{id}/mda/generate
  → Вход: MDAGenerationInput
  → Выход: MDAProfile (mechanicSet, observedDynamics, matchScores)
  → AI-промпты: SUGGEST_DYNAMICS, SUGGEST_MECHANICS, SIMULATE_GAMEPLAY
  → Зависимости: Concept + CoreLoop

POST /api/v1/projects/{id}/mda/validate
  → Вход: MDAProfile
  → Выход: LensValidation + BondValidation
  → AI-промпты: APPLY_LENS_MDA, CHECK_LUDONARRATIVE_MDA
  → Зависимости: MDA Profile
```

#### Блок 4: Balance Service

```
POST /api/v1/projects/{id}/balance/analyze
  → Вход: BalanceInput
  → Выход: BalanceResult (cost-power curves, RPS matrix, Monte Carlo results)
  → AI-промпты: ESTIMATE_WEIGHTS, EVALUATE_SITUATIONAL_VALUE
  → Зависимости: MDA Profile

POST /api/v1/projects/{id}/balance/correct
  → Вход: BalanceResult + PathologyDescription
  → Выход: CorrectionProposal (3 варианта с обоснованием)
  → AI-промпты: SUGGEST_INTRANSITIVE_CORRECTIONS, ANALYZE_DISCREPANCY, SELECT_BEST_CORRECTION
  → Зависимости: Balance Result
```

#### Блок 5: Economy & Progression Service

```
POST /api/v1/projects/{id}/progression/design
  → Вход: ProgressionInput
  → Выход: ProgressionProfile (curves, tiers, content plan)
  → AI-промпты: PLAN_TIERS, SUGGEST_UNLOCKS, CHECK_PROGRESSION_AESTHETICS
  → Зависимости: CoreLoop + MDA + Balance

POST /api/v1/projects/{id}/economy/design
  → Вход: EconomyInput
  → Выход: EconomyProfile (Machinations model, conversion chains, simulation)
  → AI-промпты: SUGGEST_SUBSIDIARY_RESOURCES, SUGGEST_LATE_GAME_SINKS, GENERATE_ECONOMY_DESCRIPTION
  → Зависимости: Progression Profile
```

#### Блок 6: GDD & Validation Service

```
POST /api/v1/projects/{id}/gdd/generate
  → Вход: GDDGenerationInput
  → Выход: GDDProfile (sections, visuals, consistency)
  → AI-промпты: ENRICH_SECTION, GENERATE_CHARACTERS_SECTION, GENERATE_VISUAL_STYLE
  → Зависимости: Все профили (Concept → Economy)

POST /api/v1/projects/{id}/gdd/export
  → Вход: GDDProfile + exportFormat
  → Выход: File (PDF/DOCX/MD/HTML)
  → AI-промпты: none (алгоритмическое форматирование)

POST /api/v1/projects/{id}/gdd/checklist
  → Вход: ChecklistInput
  → Выход: ValidationProfile (issues, remediation plan)
  → AI-промпты: CHECK_LUDONARRATIVE_VAL, APPLY_LENS_VAL, CHECK_PLAYER_AGENCY, GENERATE_REMEDIATION
  → Зависимости: Все профили + GDD
```

#### Блок 7: AI Assistant Service

```
POST /api/v1/projects/{id}/chat
  → Вход: { message: string, context?: string }
  → Выход: { response: string, sources: Citation[] }
  → AI-промпты: none (свободный чат с RAG)
  → Контекст: Project State + Библия геймдизайна (RAG)

GET /api/v1/projects/{id}/suggestions
  → Выход: ContextualSuggestion[] (проактивные подсказки)
  → AI-промпты: none (rule-based + RAG)
```

### 3.10.4 Этап 3: Модель данных Project State

**Цель**: Определить полную схему данных Project State — единого источника истины для всех модулей. Каждый модуль читает из Project State и пишет в него через API.

```typescript
interface ProjectState {
    // ===== МЕТА-ДАННЫЕ =====
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    version: number;
    
    // ===== БЛОК 1: КОНЦЕПЦИЯ (из алгоритма 3.1) =====
    concept: {
        genre: GenreProfile;
        targetAudience: AudienceProfile;
        platform: Platform[];
        constraints: ProjectConstraints;
        onePager: OnePager;
        usp: string;
        referenceGames: string[];
        aestheticProfile: AestheticProfile;
        dynamicsProfile: DynamicsProfile;
        mechanicSet: MechanicSet;
    };
    
    // ===== БЛОК 2: CORE LOOP (из алгоритма 3.2) =====
    coreLoop: {
        structuralType: StructuralType;
        steps: CoreLoopStep[];
        innerLoops: InnerLoop[];
        outerLoops: OuterLoop[];
        metaLoop: MetaLoop;
        pathologies: PathologyReport;
        recommendations: Recommendation[];
        loopHierarchy: LoopHierarchy;
    };
    
    // ===== БЛОК 3: MDA (из алгоритма 3.3) =====
    mdaProfile: {
        targetAesthetics: AestheticProfile;
        targetDynamics: DynamicsTarget;
        mechanicSet: StructuredMechanicSet;
        observedDynamics: string[];
        predictedAesthetics: Record<AestheticType, number>;
        matchScores: Record<AestheticType, number>;
        overallMatch: number;
        lensValidation: LensValidation;
        bondValidation: BondValidation;
        machinationsModel: MachinationsGraph;
    };
    
    // ===== БЛОК 4: БАЛАНС (из алгоритма 3.4) =====
    balance: {
        elements: BalancedElement[];
        costPowerCurves: CostPowerCurve[];
        intransitiveMatrix: PayoffMatrix;
        nashEquilibrium: NashEquilibrium;
        monteCarloResults: MonteCarloResult[];
        pathologies: BalancePathology[];
        corrections: CorrectionProposal[];
        overallBalanceScore: number;
    };
    
    // ===== БЛОК 5: ПРОГРЕССИЯ (из алгоритма 3.5) =====
    progression: {
        macroModel: ProgressionMacroModel;
        tierModel: TierModel;
        curves: ProgressionCurves;
        contentPlan: ContentPlan;
        economyLink: ProgressionEconomyLink;
        validation: ProgressionValidation;
    };
    
    // ===== БЛОК 5: ЭКОНОМИКА (из алгоритма 3.6) =====
    economy: {
        resourceModel: ResourceModel;
        systemType: EconomicSystemType;
        machinationsModel: MachinationsGraph;
        conversionChains: ConversionChain[];
        pathologies: EconomyPathology[];
        corrections: EconomyCorrection[];
        simulationResults: SimulationResult;
        monetizationModel: MonetizationSpec;
    };
    
    // ===== БЛОК 6: GDD (из алгоритма 3.7) =====
    gdd: {
        format: GDDFormat;
        sections: GDDSection[];
        visualElements: Record<string, VisualElement>;
        consistencyIssues: ConsistencyIssue[];
        completeness: CompletenessReport;
    };
    
    // ===== БЛОК 6: ВАЛИДАЦИЯ (из алгоритма 3.8) =====
    validation: {
        overallScore: number;
        readinessLevel: string;
        issues: ValidationIssue[];
        remediationPlan: RemediationItem[];
        mdaCheck: MDACheckResult;
        balanceCheck: BalanceCheckResult;
        narrativeCheck: NarrativeCheckResult;
        economyCheck: EconomyCheckResult;
        lensCheck: LensCheckResult;
    };
    
    // ===== СТАТУС ПРОЕКТА =====
    projectStage: ProjectStage;
    completionPercent: number;  // 0-100 по всем заполненным полям
    lastAlgorithmRun: string;   // Какой алгоритм выполнялся последним
}
```

### 3.10.5 Этап 4: План разработки и зависимости между модулями

**Цель**: Определить порядок разработки модулей с учётом зависимостей между ними, приоритетов для MVP и оценки трудозатрат.

#### 4.1 Зависимости между модулями

```
Блок 1 (Концепция) ←── не зависит от других
     │
     ▼
Блок 2 (Core Loop) ←── зависит от Блока 1
     │
     ▼
Блок 3 (MDA Lab)  ←── зависит от Блоков 1+2
     │
     ▼
Блок 4 (Баланс)   ←── зависит от Блока 3
     │
     ▼
Блок 5 (Экономика+Прогрессия) ←── зависит от Блоков 2+3+4
     │
     ▼
Блок 6 (GDD+Валидация) ←── зависит от всех Блоков 1-5
     │
     ▼
Блок 7 (AI-ассистент) ←── зависит от всех Блоков 1-6 (контекст)
```

#### 4.2 План разработки: MVP vs Full Version

**MVP (Минимально жизнеспособный продукт) — 8-10 недель**:

| Спринт | Недели | Что разрабатывается | Результат |
|--------|--------|---------------------|-----------|
| 1 | 1-2 | Настройка проекта (4.1) + Блок 1 (4.2) | Next.js проект + генерация концепции |
| 2 | 3-4 | Блок 2 (4.3) + Блок 3 (4.4) | Core Loop Designer + MDA Lab |
| 3 | 5-6 | Блок 4 (4.5) + Блок 5 базовый (4.6) | Балансировка + базовая прогрессия |
| 4 | 7-8 | Блок 6 GDD (4.7) + Экспорт (4.9) | GDD Generator + PDF экспорт |
| 5 | 9-10 | AI-ассистент базовый (4.8) + Тестирование (4.10) | Чат-ассистент + полировка |

**Full Version — 16-20 недель**:

| Спринт | Недели | Что разрабатывается | Дополнительно к MVP |
|--------|--------|---------------------|---------------------|
| 6 | 11-12 | Machinations-визуализация + Monte Carlo | Продвинутая экономика |
| 7 | 13-14 | 113 линз Шелла + полная валидация | Все чек-листы |
| 8 | 15-16 | GDCombine интеграция + RAG | Векторная БД + GBE Bridge |
| 9 | 17-18 | Мультиплеерные/социальные механики | Расширенный MechanicsDB |
| 10 | 19-20 | Оптимизация AI-стоимости + A/B тесты | Кэширование, маршрутизация |

#### 4.3 Оценка трудозатрат по модулям

| Модуль | Frontend (часы) | Backend (часы) | AI (часы) | Итого |
|--------|----------------|---------------|-----------|-------|
| Блок 1: Концепция | 40 | 30 | 20 | 90 |
| Блок 2: Core Loop | 50 | 35 | 20 | 105 |
| Блок 3: MDA Lab | 60 | 45 | 30 | 135 |
| Блок 4: Баланс | 40 | 50 | 15 | 105 |
| Блок 5: Экономика | 50 | 60 | 20 | 130 |
| Блок 6: GDD+Валидация | 60 | 50 | 25 | 135 |
| Блок 7: AI-ассистент | 30 | 40 | 30 | 100 |
| Инфраструктура | 30 | 50 | 10 | 90 |
| **Итого MVP** | **300** | **310** | **140** | **750** |
| **Итого Full** | **440** | **470** | **220** | **1130** |

### 3.10.6 Этап 5: Критерии приёмки и тестирование

**Цель**: Определить, что означает «модуль готов» — конкретные, измеримые критерии приёмки для каждого блока.

#### Критерии приёмки по модулям

**Блок 1 (Концепция)**:
- Пользователь вводит текстовую идею → система определяет жанр (совпадение с ручной оценкой ≥80%)
- Генерируется One-Pager со всеми 8 полями
- USP проходит Triangle of Weirdness
- Время генерации < 15 секунд
- Стоимость AI < $0.15 за вызов

**Блок 2 (Core Loop)**:
- Генерируется Core Loop из 3-5 шагов
- Диагностика выявляет ≥1 патологию в намеренно сломанном Core Loop
- Иерархия петель имеет ≥3 уровня
- Время генерации < 20 секунд

**Блок 3 (MDA Lab)**:
- Reverse MDA порождает механики, покрывающие все 3 целевые эстетики
- Classic MDA показывает сходимость ≥0.7 за ≤3 итерации
- Линзы Шелла оценивают ≥8 релевантных линз
- Лудонарративный диссонанс обнаруживается в тестовом кейсе

**Блок 4 (Баланс)**:
- Transitive-анализ: все элементы в пределах 30% от cost-power кривой
- Intransitive-анализ: равновесие Нэша с максимальной долей стратегии < 40%
- Monte Carlo: 10 000 симуляций завершаются за < 5 секунд
- Коррекции снижают дисбаланс на ≥50%

**Блок 5 (Экономика/Прогрессия)**:
- Machinations-модель генерируется и визуализируется
- Симуляция 5000 тиков завершается за < 10 секунд
- Runaway обнаруживается в намеренно сломанной модели
- Кривые прогрессии визуализируются как графики

**Блок 6 (GDD/Валидация)**:
- GDD генерируется в 3 форматах (One-Sheet, Ten-Pager, Full)
- ≥50% секций автозаполняются из Project State
- Валидация выявляет ≥1 критическую проблему в намеренно сломанном проекте
- PDF экспорт корректно отображает все диаграммы
- Общий score валидации воспроизводим (±5% при том же входе)

**Блок 7 (AI-ассистент)**:
- Контекст проекта доступен ассистенту
- Ассистент ссылается на конкретные фреймворки (MDA, Линзы Шелла, и т.д.)
- Проактивные подсказки появляются при обнаружении проблем
- RAG-цитаты корректны (источник указан, содержание релевантно)

#### Интеграционные тесты

| Тест | Описание | Критерий успеха |
|------|----------|----------------|
| E2E: Идея → GDD | Полный pipeline от текстовой идеи до PDF | GDD генерируется < 3 минуты |
| E2E: Валидация → Исправление | Обнаружение проблемы → коррекция → ревалидация | Score улучшается на ≥10% |
| Стресс: 10 проектов одновременно | 10 параллельных проектов | Все завершаются без ошибок |
| AI: Fallback-цепочка | Отключение primary модели | Fallback срабатывает за < 15 секунд |
| AI: Кэш-валидация | Повторный вызов с тем же входом | Результат из кэша за < 100ms |
| Экспорт: GDD PDF | 50-страничный GDD | PDF корректно открывается, все графики на месте |

### 3.10.7 Итоговая сборка: Development Specification Profile

```typescript
interface DevelopmentSpecificationProfile {
    // Архитектура
    architecture: {
        client: "Next.js 16 + React 19 + TypeScript";
        server: "Python 3.12 + FastAPI";
        database: "PostgreSQL 16 + Redis 7";
        ai: "OpenAI + Anthropic (multi-provider)";
        deploy: "Vercel (client) + Docker (server)";
    };
    
    // Модули
    modules: {
        block1_concept: ModuleSpec;
        block2_coreloop: ModuleSpec;
        block3_mda: ModuleSpec;
        block4_balance: ModuleSpec;
        block5_economy: ModuleSpec;
        block6_gdd: ModuleSpec;
        block7_assistant: ModuleSpec;
    };
    
    // Данные
    projectStateSchema: ProjectState;
    
    // AI
    promptRegistry: Record<string, PromptSpec>;
    promptArchitecture: PromptArchitectureSpec;
    
    // План
    mvpTimeline: "8-10 недель";
    fullTimeline: "16-20 недель";
    totalEffort: { mvp: 750, full: 1130 };  // часы
    
    // Качество
    acceptanceCriteria: Record<string, AcceptanceCriterion[]>;
    integrationTests: IntegrationTest[];
    
    // Фазы → задачи Фазы 4
    phase4Tasks: Phase4Task[];
    
    // Метрики готовности
    readinessMetrics: {
        algorithmsFormalized: "10/10 ✅";
        promptsSpecified: "31 ✅";
        modulesSpecified: "7 ✅";
        dataModelDefined: true;
        apiEndpointsDefined: 14;
        testCriteriaDefined: true;
        costEstimatesDefined: true;
    };
}

interface Phase4Task {
    id: string;             // 4.1, 4.2, ...
    name: string;
    module: string;
    dependencies: string[];
    estimatedHours: number;
    mvp: boolean;           // Входит ли в MVP
    priority: "critical" | "high" | "medium" | "low";
    acceptanceCriteria: string[];
}
```

---

## Итоговая карта Фазы 3

### Все 10 алгоритмов — статус

| # | Алгоритм | Документ | Этапов | AI-промптов | Статус |
|---|----------|----------|--------|-------------|--------|
| 3.1 | Генерация концепции | algo_3_1_3_2 | 7 | 4 | ✅ |
| 3.2 | Core Loop | algo_3_1_3_2 | 7 | 4 | ✅ |
| 3.3 | MDA генерация | algo_3_3_3_4 | 6 | 5 | ✅ |
| 3.4 | Балансировка | algo_3_3_3_4 | 9 | 5 | ✅ |
| 3.5 | Прогрессия | algo_3_5_3_6 | 7 | 3 | ✅ |
| 3.6 | Экономика | algo_3_5_3_6 | 8 | 3 | ✅ |
| 3.7 | GDD Generator | algo_3_7_3_8 | 8 | 4+ | ✅ |
| 3.8 | Валидация | algo_3_7_3_8 | 7 | 4 | ✅ |
| 3.9 | AI-prompts | algo_3_9_3_10 | 5 | 31 (каталог) | ✅ |
| 3.10 | Итоговая спецификация | algo_3_9_3_10 | 6 | — | ✅ |

### Поток данных — полная карта

```
ВХОД: Идея пользователя (текст)
  │
  ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.1 Концепция                                                    │
│ idea → genre → aesthetics → dynamics → mechanics → USP → OnePager│
│ AI: CLASSIFY_GENRE, EXTRACT_AESTHETICS, GENERATE_CORE_LOOPS,    │
│     GENERATE_USP                                                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │ OnePager + MechanicSet + AestheticProfile
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.2 Core Loop                                                    │
│ OnePager → structural type → loop hierarchy → diagnosis → recs  │
│ AI: DECOMPOSE_STEP, GENERATE_OUTER_LOOPS, GENERATE_META_LOOP,  │
│     GENERATE_RECOMMENDATIONS                                     │
└──────────────────────┬───────────────────────────────────────────┘
                       │ CoreLoopProfile
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.3 MDA                                                          │
│ aesthetics → target dynamics → mechanic candidates → validation  │
│ AI: SUGGEST_DYNAMICS, SUGGEST_MECHANICS, SIMULATE_GAMEPLAY,     │
│     APPLY_LENS, CHECK_LUDONARRATIVE                              │
│ Цикл: Reverse MDA → Classic MDA (до сходимости)                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │ MDAProfile + MachinationsGraph
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.4 Балансировка                                                 │
│ elements → cost-power curves → RPS matrix → Monte Carlo          │
│ AI: ESTIMATE_WEIGHTS, EVALUATE_SITUATIONAL_VALUE,               │
│     SUGGEST_INTRANSITIVE_CORRECTIONS, ANALYZE_DISCREPANCY,      │
│     SELECT_BEST_CORRECTION                                       │
└──────────────────────┬───────────────────────────────────────────┘
                       │ BalanceResult
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.5 Прогрессия                                                   │
│ macro model → tiers → curves → content plan → economy link      │
│ AI: PLAN_TIERS, SUGGEST_UNLOCKS, CHECK_PROGRESSION_AESTHETICS   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ ProgressionProfile
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.6 Экономика                                                    │
│ resources → Machinations → conversion chains → diagnosis → sim  │
│ AI: SUGGEST_SUBSIDIARY_RESOURCES, SUGGEST_LATE_GAME_SINKS,     │
│     GENERATE_ECONOMY_DESCRIPTION                                 │
└──────────────────────┬───────────────────────────────────────────┘
                       │ EconomyProfile
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.7 GDD Generator                                                │
│ format selection → data mapping → auto-fill → AI-gen → assembly │
│ AI: ENRICH_SECTION, GENERATE_CHARACTERS, GENERATE_VISUAL_STYLE  │
│ Выход: GDD в PDF/DOCX/MD/HTML                                   │
└──────────────────────┬───────────────────────────────────────────┘
                       │ GDDProfile
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.8 Валидация                                                    │
│ MDA-check → Balance-check → Narrative-check → Economy-check     │
│ → Lens-check → Aggregation → Remediation plan                   │
│ AI: CHECK_LUDONARRATIVE, APPLY_LENS, CHECK_AGENCY,              │
│     GENERATE_REMEDIATION                                         │
│ Выход: ValidationProfile (score 0-100)                           │
└──────────────────────┬───────────────────────────────────────────┘
                       │ ValidationProfile
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.9 AI-prompts спецификация                                      │
│ 31 промпт → формальные интерфейсы → архитектура → кэш → API     │
│ Выход: PromptSpecificationProfile                                │
└──────────────────────┬───────────────────────────────────────────┘
                       │ PromptSpec[]
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│ 3.10 Итоговая спецификация                                       │
│ Архитектура + модули + данные + AI + план + критерии             │
│ Выход: DevelopmentSpecificationProfile → Фаза 4                  │
└──────────────────────────────────────────────────────────────────┘
```

### Переход к Фазе 4

Фаза 3 завершена. Все 10 алгоритмов формализованы. Итоговая спецификация содержит:

- **7 функциональных модулей** с определёнными API (14 эндпоинтов)
- **31 AI-промпт** с формальными интерфейсами, маршрутизацией и fallback
- **Модель данных Project State** с полной типизацией
- **План разработки**: MVP за 8-10 недель, Full за 16-20 недель
- **Критерии приёмки** для каждого модуля и интеграционные тесты
- **Оценка стоимости**: $0.50-5.00 за проект, $0.10-1.50 за сессию

Фаза 4 (Разработка веб-приложения) может быть начата с задачи 4.1 (Настройка проекта).
