"""
Gidede — Prompt Registry (PROMPT_REGISTRY)
Фаза 4.A.8: Реестр всех 35 AI-промптов

Спецификация 3.9.2: Полный каталог промптов из алгоритмов 3.1–3.8.
Спецификация 3.9.3: Формализация интерфейсов каждого промпта.

Для каждого промпта определён PromptSpec с:
- id, module, algorithm, version — идентификация
- taskType — тип задачи (определяет маршрутизацию)
- inputs — типизированные параметры
- outputSchema — JSON-Schema для валидации
- systemPrompt, userPromptTemplate — шаблоны промптов
- modelRequirements — требования к модели
- guarantees — гарантии (кэширование, retry, fallback)
- estimated — оценка стоимости и латентности

Статистика:
- Всего промптов: 35
- Креативные (Sonnet/GPT-4): 18 (58%)
- Рутинные (Haiku/GPT-3.5): 13 (42%)
- Блок 1 (Концепция): 7
- Блок 2 (Core Loop): 4
- Блок 3 (MDA): 5
- Блок 4 (Баланс): 6
- Блок 5 (Экономика/Прогрессия): 6
- Блок 6 (GDD/Валидация): 7
"""

from app.prompts.schemas import (
    PromptSpec,
    PromptInput,
    ModelSpec,
    ModelRequirements,
    PromptGuarantees,
    EstimatedMetrics,
    ModuleType,
    PromptTaskType,
    OutputFormat,
    AIProviderType,
)


# ============================================================
# ОБЩИЕ КОНСТАНТЫ
# ============================================================

# Быстрая модель (для classification, evaluation, recommendation)
_FAST_MODEL = ModelSpec(provider=AIProviderType.ANTHROPIC, model="claude-3-haiku", max_cost_per_call=0.01)
_FAST_FALLBACK = ModelSpec(provider=AIProviderType.OPENAI, model="gpt-3.5-turbo", max_cost_per_call=0.005)

# Мощная модель (для generation, analysis)
_POWERFUL_MODEL = ModelSpec(provider=AIProviderType.ANTHROPIC, model="claude-3-sonnet", max_cost_per_call=0.05)
_POWERFUL_FALLBACK = ModelSpec(provider=AIProviderType.OPENAI, model="gpt-4o", max_cost_per_call=0.03)


# ============================================================
# БЛОК 1: КОНЦЕПЦИЯ (алгоритм 3.1) — 7 промптов
# ============================================================

CLASSIFY_GENRE = PromptSpec(
    id="CLASSIFY_GENRE",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.CLASSIFICATION,
    inputs=[
        PromptInput(name="idea", type="string", required=True,
                    description="Текстовое описание идеи игры (1-5 предложений)"),
        PromptInput(name="genre", type="string", required=False,
                    description="Указанный жанр (если пользователь выбрал)", default=None),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "genre": {"type": "string"},
                "subgenre": {"type": "string"},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "reasoning": {"type": "string"},
            },
            "required": ["genre", "subgenre", "confidence", "reasoning"],
        },
        "maxItems": 3,
    },
    outputExamples=[
        '[{"genre":"RPG","subgenre":"roguelike","confidence":0.85,"reasoning":"Упоминание алхимии и варки зелий указывает на систему крафта, характерную для roguelike RPG"}]',
    ],
    system_prompt="""Ты — эксперт по жанровой классификации игр. Определи жанр на основе описания идеи пользователя.

Используй таксономию Роджерса:
- Action (platformer, shooter, fighting, stealth, survival horror, rhythm)
- Adventure
- RPG (action, JRPG, tactical, MMORPG, roguelike)
- Simulation
- Strategy
- Puzzle
- Party
- Educational
- Racing
- Sports

Правила:
1. Верни топ-3 жанра с оценкой уверенности (0-1)
2. Каждый жанр должен содержать subgenre
3. Обоснование — краткое, 1-2 предложения
4. Формат: строго JSON массив""",
    user_prompt_template="Идея игры: {idea}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False,
        json_output=True,
        max_retries=2,
        fallback_on_failure=True,
        cacheable=True,
        cache_ttl=3600,
    ),
    estimated=EstimatedMetrics(input_tokens=200, output_tokens=300, cost_min=0.002, cost_max=0.01, latency_min_ms=500, latency_max_ms=3000),
)

EXTRACT_AESTHETICS = PromptSpec(
    id="EXTRACT_AESTHETICS",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.ANALYSIS,
    inputs=[
        PromptInput(name="idea", type="string", required=True,
                    description="Описание идеи игры"),
        PromptInput(name="genre", type="string", required=True,
                    description="Определённый жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "aesthetic": {"type": "string"},
                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                "reasoning": {"type": "string"},
            },
            "required": ["aesthetic", "confidence", "reasoning"],
        },
        "maxItems": 3,
    },
    outputExamples=[
        '[{"aesthetic":"Fantasy","confidence":0.9,"reasoning":"Фэнтезийный сеттинг с магией"},{"aesthetic":"Challenge","confidence":0.7,"reasoning":"Упоминание сложных боёв"}]',
    ],
    system_prompt="""Ты — эксперт по эстетическому анализу игр. На основе идеи и жанра определи целевые эстетические ценности по MDA Framework ЛеБланка.

8 эстетических ценностей:
1. Чувственное (Sensation) — удовольствие от ощущений, графики, звука
2. Фантазия (Fantasy) — погружение в вымышленный мир
3. Нарратив (Narrative) — удовольствие от истории
4. Вызов (Challenge) — преодоление трудностей
5. Товарищество (Fellowship) — социальное взаимодействие
6. Открытие (Discovery) — исследование неизвестного
7. Выражение (Expression) — самовыражение, творчество
8. Подчинение (Submission) — привычка, рутинное удовольствие

Верни топ-3 эстетики с обоснованием. Формат: строго JSON массив.""",
    user_prompt_template="Идея: {idea}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=600,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False,
        json_output=True,
        max_retries=2,
        fallback_on_failure=True,
        cacheable=True,
        cache_ttl=1800,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=400, cost_min=0.005, cost_max=0.03, latency_min_ms=1000, latency_max_ms=6000),
)

GENERATE_CORE_LOOPS = PromptSpec(
    id="GENERATE_CORE_LOOPS",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="mechanics", type="array", required=True,
                    description="Список выбранных механик из MechanicsDB"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетические ценности"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "steps": {"type": "array", "items": {"type": "object"}},
                "loop_type": {"type": "string"},
                "fun_check": {"type": "string"},
            },
            "required": ["name", "steps", "loop_type", "fun_check"],
        },
        "maxItems": 3,
    },
    outputExamples=[
        '[{"name":"Alchemist Loop","steps":[{"action":"Gather ingredients","resource":"herbs"}],"loop_type":"Engine","fun_check":"30 секунд веселья: сбор → варка → применение"}]',
    ],
    system_prompt="""Ты — эксперт по проектированию Core Loop игр. На основе выбранных механик и целевых эстетик предложи 3 варианта Core Loop.

Правила:
1. Каждый Core Loop — замкнутый цикл действий (3-7 шагов)
2. Каждый шаг привязан к механике и ресурсу
3. Определи тип петли: Engine (накопление), Economy (обмен), Ecology (баланс)
4. Проверь: "30 секунд веселья" — замкнут ли цикл за короткое время?
5. Обеспечь синергию между механиками в рамках одного цикла

Формат: строго JSON массив из 3 вариантов.""",
    user_prompt_template="Механики: {mechanics}\nЭстетики: {aesthetics}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.7,
        max_tokens=2048,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False,
        json_output=True,
        max_retries=2,
        fallback_on_failure=True,
        cacheable=False,
        cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=800, output_tokens=1500, cost_min=0.01, cost_max=0.08, latency_min_ms=3000, latency_max_ms=15000),
)

GENERATE_USP = PromptSpec(
    id="GENERATE_USP",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="mechanics", type="array", required=True,
                    description="Список выбранных механик"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="references", type="string", required=False,
                    description="Референтные игры", default=""),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "usp": {"type": "string"},
                "triangle_check": {"type": "object"},
                "differentiation": {"type": "string"},
            },
            "required": ["usp", "triangle_check", "differentiation"],
        },
        "maxItems": 3,
    },
    outputExamples=[
        '[{"usp":"Алхимическая варка зелий как основа боевой системы","triangle_check":{"weird":true,"appealing":true,"credible":true},"differentiation":"В отличие от Potion Craft, зелья используются в бою, не только в крафте"}]',
    ],
    system_prompt="""Ты — эксперт по позиционированию игр. На основе механик, жанра и референтных игр сформулируй 3 варианта USP (Unique Selling Proposition).

Проверяй каждый USP через Triangle of Weirdness (Schell):
1. Weird — достаточно ли необычно?
2. Appealing — привлекает ли целевую аудиторию?
3. Credible — правдоподобно ли в рамках жанра?

USP должен:
- Отличать игру от референтов
- Быть конкретным (не "уникальный геймплей", а конкретная фича)
- Поддерживаться выбранными механиками

Формат: строго JSON массив из 3 вариантов.""",
    user_prompt_template="Механики: {mechanics}\nЖанр: {genre}\nРеференты: {references}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False,
        json_output=True,
        max_retries=2,
        fallback_on_failure=True,
        cacheable=False,
        cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=1200, cost_min=0.01, cost_max=0.06, latency_min_ms=2000, latency_max_ms=12000),
)

# ============================================================
# БЛОК 1: КОНЦЕПЦИЯ — Промпты 4.B.4 (Этапы 6–7)
# ============================================================

VALIDATE_TRIANGLE = PromptSpec(
    id="VALIDATE_TRIANGLE",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="idea", type="string", required=True,
                    description="Описание идеи игры"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
        PromptInput(name="mechanics", type="array", required=True,
                    description="Выбранные механики"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "score": {"type": "number", "minimum": 0, "maximum": 1},
            "characters": {"type": "object"},
            "world": {"type": "object"},
            "activities": {"type": "object"},
            "weird_corners_count": {"type": "integer"},
            "warnings": {"type": "array"},
            "suggestions": {"type": "array"},
        },
        "required": ["score", "characters", "world", "activities", "weird_corners_count"],
    },
    system_prompt="""Ты — эксперт по валидации концепций игр через Triangle of Weirdness (Level Up! — Скотт Роджерс).

Triangle of Weirdness оценивает концепцию по 3 осям:
1. Персонажи (Characters) — насколько необычны герои/враги/NPC?
2. Мир (World) — насколько уникален сеттинг/мир?
3. Активности (Activities) — насколько оригинальны действия игрока?

Правила:
- Если 0 или 1 угол "странный" — концепция продаваема
- Если 2 угла "странные" — нужна осторожность, нишевый продукт
- Если 3 угла "странные" — концепция труднопродаваема, нужна доработка
- Оцени score (0-1): насколько концепция жизнеспособна
- Укажи weird_corners_count: сколько углов "странные" (0-3)
- Для каждого проблемного угла предложи конкретные улучшения

Формат: строго JSON.""",
    user_prompt_template="Идея: {idea}\nЖанр: {genre}\nЭстетики: {aesthetics}\nМеханики: {mechanics}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1200,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=800, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

VALIDATE_IDEA_FILTERS = PromptSpec(
    id="VALIDATE_IDEA_FILTERS",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="idea", type="string", required=True,
                    description="Описание идеи игры"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
        PromptInput(name="mechanics", type="array", required=True,
                    description="Выбранные механики"),
        PromptInput(name="usp", type="string", required=False,
                    description="Сформулированный USP", default=""),
        PromptInput(name="core_loop_steps", type="array", required=False,
                    description="Шаги Core Loop", default=[]),
        PromptInput(name="constraints", type="object", required=False,
                    description="Ограничения (бюджет, команда)", default={}),
        PromptInput(name="references", type="array", required=False,
                    description="Референтные игры", default=[]),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "score": {"type": "number", "minimum": 0, "maximum": 1},
            "filters": {
                "type": "object",
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "score": {"type": "number"},
                        "reason": {"type": "string"},
                        "improvement": {"type": "string"},
                    },
                },
            },
        },
        "required": ["score", "filters"],
    },
    system_prompt="""Ты — эксперт по оценке жизнеспособности концепций игр. Примени 8 фильтров идеи (The Art of Game Design — Джесси Шелл):

1. f1_experience — Создаёт ли концепция чёткий опыт? (MDA-профиль определён?)
2. f2_audience — Понятна ли целевая аудитория? (мотивации, платформа)
3. f3_motivation — Почему игрок будет играть? (внутренняя мотивация)
4. f4_uniqueness — Отличается ли от конкурентов? (USP проверяем)
5. f5_feasibility — Реализуема ли концепция? (масштаб, бюджет, команда)
6. f6_scope — Адекватен ли масштаб? (не слишком маленький/амбициозный)
7. f7_fun — Есть ли веселье в Core Loop? (30 секунд веселья)
8. f8_prototype — Можно ли прототипировать за неделю? (MVP)

Для каждого фильтра:
- Оцени score (0-1)
- Укажи причину если score < 0.6
- Предложи improvement если score < 0.6

Общий score — среднее по 8 фильтрам.

Формат: строго JSON.""",
    user_prompt_template="Идея: {idea}\nЖанр: {genre}\nЭстетики: {aesthetics}\nМеханики: {mechanics}\nUSP: {usp}\nCore Loop: {core_loop_steps}\nОграничения: {constraints}\nРеференты: {references}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.5,
        max_tokens=2048,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=800, output_tokens=1500, cost_min=0.01, cost_max=0.08, latency_min_ms=3000, latency_max_ms=15000),
)

ASSEMBLE_ONE_PAGER = PromptSpec(
    id="ASSEMBLE_ONE_PAGER",
    module=ModuleType.CONCEPT,
    algorithm="3.1",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="idea", type="string", required=True,
                    description="Описание идеи игры"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
        PromptInput(name="mechanics", type="array", required=True,
                    description="Выбранные механики"),
        PromptInput(name="core_loop", type="object", required=False,
                    description="Core Loop данные", default={}),
        PromptInput(name="usp", type="string", required=False,
                    description="USP формулировка", default=""),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "story_synopsis": {"type": "string"},
            "gameplay_description": {"type": "string"},
        },
        "required": ["story_synopsis", "gameplay_description"],
    },
    system_prompt="""Ты — креативный геймдизайнер. На основе данных о концепции сгенерируй два текстовых описания для One-Pager:

1. story_synopsis — Краткий синопсис сюжета/сеттинга (2-3 предложения). Опиши мир, главного героя и центральный конфликт. Текст должен быть увлекательным и передавать атмосферу игры.

2. gameplay_description — Описание геймплея (3-5 предложений). Опиши основные механики, Core Loop и ключевые игровые ситуации. Используй глаголы действий игрока. Упомяни уникальные фичи и USP.

Правила:
- Пиши на русском языке
- Текст должен быть конкретным, не общим
- Учитывай жанр и целевые эстетики
- Не придумывай новые механики, используй только указанные

Формат: строго JSON.""",
    user_prompt_template="Идея: {idea}\nЖанр: {genre}\nЭстетики: {aesthetics}\nМеханики: {mechanics}\nCore Loop: {core_loop}\nUSP: {usp}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=800, output_tokens=1000, cost_min=0.01, cost_max=0.06, latency_min_ms=2000, latency_max_ms=12000),
)


# ============================================================
# БЛОК 2: CORE LOOP (алгоритм 3.2) — 4 промпта
# ============================================================

DECOMPOSE_STEP = PromptSpec(
    id="DECOMPOSE_STEP",
    module=ModuleType.CORE_LOOP,
    algorithm="3.2",
    version="1.0.0",
    taskType=PromptTaskType.CLASSIFICATION,
    inputs=[
        PromptInput(name="step", type="object", required=True,
                    description="Шаг Core Loop для декомпозиции"),
        PromptInput(name="core_loop", type="object", required=True,
                    description="Полный Core Loop"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "actions": {"type": "array", "items": {"type": "object"}},
            "fun_check": {"type": "string"},
        },
        "required": ["actions", "fun_check"],
    },
    system_prompt="""Ты — эксперт по декомпозиции игровых действий. Разложи шаг Core Loop на атомарные действия игрока.

Для каждого действия укажи:
- Название действия
- Входной ресурс
- Выходной ресурс
- Механика, которая активируется

Проверь: приносит ли декомпозиция удовольствие (fun_check)?

Формат: строго JSON.""",
    user_prompt_template="Шаг: {step}\nCore Loop: {core_loop}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=800,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=1800,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=500, cost_min=0.003, cost_max=0.015, latency_min_ms=800, latency_max_ms=5000),
)

GENERATE_OUTER_LOOPS = PromptSpec(
    id="GENERATE_OUTER_LOOPS",
    module=ModuleType.CORE_LOOP,
    algorithm="3.2",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="core_loop", type="object", required=True,
                    description="Внутренний Core Loop"),
        PromptInput(name="mechanics", type="array", required=True,
                    description="Механики проекта"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "outer_loop": {"type": "object"},
                "motivation_link": {"type": "string"},
            },
            "required": ["outer_loop", "motivation_link"],
        },
    },
    system_prompt="""Ты — эксперт по проектированию иерархии петель в играх. На основе внутреннего Core Loop создай outer loops.

Правила:
1. Каждая outer loop охватывает несколько внутренних итераций
2. Укажи мотивационную связь: почему игрок продолжает выполнять inner loop?
3. Outer loop должен вводить новые ресурсы или трансформировать существующие
4. Минимум 2 outer loops: прогрессия и социальная

Формат: строго JSON массив.""",
    user_prompt_template="Core Loop: {core_loop}\nМеханики: {mechanics}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.7,
        max_tokens=2048,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=1500, cost_min=0.01, cost_max=0.08, latency_min_ms=3000, latency_max_ms=12000),
)

GENERATE_META_LOOP = PromptSpec(
    id="GENERATE_META_LOOP",
    module=ModuleType.CORE_LOOP,
    algorithm="3.2",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="outer_loops", type="array", required=True,
                    description="Список outer loops"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "meta_loop": {"type": "object"},
            "retention_mechanism": {"type": "string"},
        },
        "required": ["meta_loop", "retention_mechanism"],
    },
    system_prompt="""Ты — эксперт по долгосрочной мотивации в играх. На основе outer loops спроектируй meta loop.

Meta loop — это самый верхний уровень петли, обеспечивающий удержание (retention):
- Сезонный контент, эндгейм, социальные цели
- Связь всех outer loops в единую экосистему
- Ретеншн-механизм: почему игрок возвращается через неделю? Месяц?

Формат: строго JSON.""",
    user_prompt_template="Outer Loops: {outer_loops}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

GENERATE_RECOMMENDATIONS = PromptSpec(
    id="GENERATE_RECOMMENDATIONS",
    module=ModuleType.CORE_LOOP,
    algorithm="3.2",
    version="1.0.0",
    taskType=PromptTaskType.RECOMMENDATION,
    inputs=[
        PromptInput(name="pathology", type="string", required=True,
                    description="Обнаруженная патология Core Loop"),
        PromptInput(name="core_loop", type="object", required=True,
                    description="Данные Core Loop"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "recommendation": {"type": "string"},
                "priority": {"type": "string"},
            },
            "required": ["recommendation", "priority"],
        },
    },
    system_prompt="""Ты — эксперт по диагностике проблем в Core Loop. На основе обнаруженной патологии предложи рекомендации.

7 патологий Core Loop:
1. Runaway — бесконечный рост ресурса
2. Deadlock — замкнутый тупик
3. Stall — петля останавливается
4. Brittleness — хрупкость (одно изменение ломает всё)
5. Oscillation — колебание между состояниями
6. Stagnation — отсутствие прогресса
7. Triviality — тривиальность решений

Каждая рекомендация должна иметь приоритет: critical/high/medium/low.
Формат: строго JSON массив.""",
    user_prompt_template="Патология: {pathology}\nCore Loop: {core_loop}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1000,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=900,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=600, cost_min=0.003, cost_max=0.02, latency_min_ms=800, latency_max_ms=5000),
)


# ============================================================
# БЛОК 3: MDA (алгоритм 3.3) — 5 промптов
# ============================================================

SUGGEST_DYNAMICS = PromptSpec(
    id="SUGGEST_DYNAMICS",
    module=ModuleType.MDA,
    algorithm="3.3",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="aesthetic", type="string", required=True,
                    description="Целевая эстетическая ценность"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "dynamic": {"type": "string"},
                "aesthetics_served": {"type": "array"},
                "genre_fit": {"type": "number"},
            },
            "required": ["dynamic", "aesthetics_served", "genre_fit"],
        },
    },
    system_prompt="""Ты — эксперт по динамикам игр в рамках MDA Framework. Для заданной эстетики предложи динамики, которые её создают.

Правила:
1. Каждая динамика должна быть наблюдаемой в геймплее
2. Укажи все эстетики, которые обслуживает динамика
3. Оцени genre_fit (0-1) — насколько динамика типична для жанра
4. Предложи 5-8 динамик

Формат: строго JSON массив.""",
    user_prompt_template="Эстетика: {aesthetic}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=300, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

SUGGEST_MECHANICS = PromptSpec(
    id="SUGGEST_MECHANICS",
    module=ModuleType.MDA,
    algorithm="3.3",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="dynamic", type="string", required=True,
                    description="Целевая динамика"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="existing", type="array", required=False,
                    description="Уже существующие механики", default=[]),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "mechanic": {"type": "string"},
                "group": {"type": "string"},
                "dynamics": {"type": "array"},
                "genre_affinity": {"type": "number"},
            },
            "required": ["mechanic", "group", "dynamics", "genre_affinity"],
        },
    },
    system_prompt="""Ты — эксперт по механикам игр. Для заданной динамики предложи механики, которые её создают.

Используй MechanicsDB (127 механик в 15 группах):
- Базовые: движение, время, поворот, пространство
- Боевые: атака, защита, уклонение, combos
- Прогрессионные: уровни, навыки, апгрейды, разблокировки
- Пространственные: карты, территории, пути, размещение
- Социальные: торговля, кооперация, соревнование, репутация

Правила:
1. Каждая механика привязана к группе MechanicsDB
2. Укажи все динамики, которые она создаёт
3. Оцени genre_affinity (0-1)
4. Проверь совместимость с существующими механиками
5. Предложи 5-10 механик

Формат: строго JSON массив.""",
    user_prompt_template="Динамика: {dynamic}\nЖанр: {genre}\nСуществующие механики: {existing}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.7,
        max_tokens=2048,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=1500, cost_min=0.01, cost_max=0.08, latency_min_ms=3000, latency_max_ms=12000),
)

SIMULATE_GAMEPLAY = PromptSpec(
    id="SIMULATE_GAMEPLAY",
    module=ModuleType.MDA,
    algorithm="3.3",
    version="1.0.0",
    taskType=PromptTaskType.ANALYSIS,
    inputs=[
        PromptInput(name="mechanics", type="array", required=True,
                    description="Набор механик для симуляции"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "gameplay_sequence": {"type": "array"},
            "resource_flows": {"type": "array"},
            "feedback_loops": {"type": "array"},
        },
        "required": ["gameplay_sequence", "resource_flows", "feedback_loops"],
    },
    system_prompt="""Ты — эксперт по симуляции геймплея. Смоделируй типичную сессию игры с заданными механиками.

Симуляция:
1. Опиши типичную последовательность действий игрока (5-10 шагов)
2. Покажи потоки ресурсов между действиями
3. Выяви петли обратной связи (positive/negative)
4. Оцени: возникает ли целевая динамика? Какая эстетика возникает?

Формат: строго JSON.""",
    user_prompt_template="Механики: {mechanics}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.5,
        max_tokens=2048,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=800, output_tokens=1500, cost_min=0.01, cost_max=0.08, latency_min_ms=3000, latency_max_ms=15000),
)

APPLY_LENS_MDA = PromptSpec(
    id="APPLY_LENS_MDA",
    module=ModuleType.MDA,
    algorithm="3.3",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="lens", type="string", required=True,
                    description="ID линзы Шелла (1-113)"),
        PromptInput(name="mechanic_set", type="array", required=True,
                    description="Набор механик"),
        PromptInput(name="mda_result", type="object", required=True,
                    description="Результат MDA-анализа"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "lens_id": {"type": "string"},
            "score": {"type": "number"},
            "issues": {"type": "array"},
            "suggestions": {"type": "array"},
        },
        "required": ["lens_id", "score", "issues", "suggestions"],
    },
    system_prompt="""Ты — эксперт по валидации игр через Линзы Шелла (The Art of Game Design, Jesse Schell).

Примени указанную линзу к набору механик и MDA-результату:
1. Ответь на ключевой вопрос линзы
2. Оцени score (0-1): насколько механики соответствуют линзе
3. Перечисли выявленные проблемы
4. Предложи предложения по улучшению

9 приоритетных линз:
#1 Линза Эмоций, #2 Линза Существования, #16 Линза Игрока,
#25 Линза Цели, #32 Линза Выбора, #44 Линза Баланса,
#51 Линза Доступности, #73 Линза Простоты/Сложности, #113 Линза Команды

Формат: строго JSON.""",
    user_prompt_template="Линза: {lens}\nМеханики: {mechanic_set}\nMDA результат: {mda_result}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=800,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=900,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=500, cost_min=0.003, cost_max=0.02, latency_min_ms=800, latency_max_ms=5000),
)

CHECK_LUDONARRATIVE_MDA = PromptSpec(
    id="CHECK_LUDONARRATIVE_MDA",
    module=ModuleType.MDA,
    algorithm="3.3",
    version="1.0.0",
    taskType=PromptTaskType.ANALYSIS,
    inputs=[
        PromptInput(name="mechanics", type="array", required=True,
                    description="Набор механик"),
        PromptInput(name="narrative", type="string", required=True,
                    description="Описание нарратива/сеттинга"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "result": {"type": "string"},
            "dissonances": {"type": "array"},
            "harmonies": {"type": "array"},
        },
        "required": ["result", "dissonances", "harmonies"],
    },
    system_prompt="""Ты — эксперт по лудонарративному анализу игр (Clint Hocking). Проверь согласованность между механиками (лудо) и нарративом (нарратив).

Лудонарративный диссонанс возникает когда:
- Механики противоречат сюжету (герой-миротворец убивает сотни врагов)
- Нарратив обещает одно, геймплей — другое
- Тон механик не совпадает с тоном истории

Лудонарративная гармония — когда механики и нарратив усиливают друг друга.

Результат: consonance / partial_dissonance / strong_dissonance
Формат: строго JSON.""",
    user_prompt_template="Механики: {mechanics}\nНарратив: {narrative}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)


# ============================================================
# БЛОК 4: БАЛАНС (алгоритм 3.4) — 6 промптов
# ============================================================

ESTIMATE_WEIGHTS = PromptSpec(
    id="ESTIMATE_WEIGHTS",
    module=ModuleType.BALANCE,
    algorithm="3.4",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="objects", type="array", required=True,
                    description="Список объектов с атрибутами"),
        PromptInput(name="anchor", type="string", required=True,
                    description="Anchor-объект (базовый для сравнения)"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "additionalProperties": {"type": "number"},
    },
    system_prompt="""Ты — эксперт по балансировке игр. Оцени веса атрибутов для transitive-анализа баланса.

Правила:
1. Веса определяют относительную важность каждого атрибута
2. Сумма весов = 1.0
3. Учитывай жанровую специфику (в RPG урон важнее скорости, в стратегии — наоборот)
4. Anchor-объект — эталон, относительно которого измеряются остальные

Формат: строго JSON {атрибут: вес}.""",
    user_prompt_template="Объекты: {objects}\nAnchor: {anchor}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=1800,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=300, cost_min=0.003, cost_max=0.015, latency_min_ms=500, latency_max_ms=3000),
)

EVALUATE_SITUATIONAL_VALUE = PromptSpec(
    id="EVALUATE_SITUATIONAL_VALUE",
    module=ModuleType.BALANCE,
    algorithm="3.4",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="object", type="object", required=True,
                    description="Объект для оценки"),
        PromptInput(name="situation", type="string", required=True,
                    description="Ситуация в игре"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "value": {"type": "number"},
            "reasoning": {"type": "string"},
            "dominant_attrs": {"type": "array"},
        },
        "required": ["value", "reasoning", "dominant_attrs"],
    },
    system_prompt="""Ты — эксперт по ситуационному балансу в играх. Оцени ценность объекта в конкретной игровой ситуации.

Ситуационная ценность — насколько объект полезен в данных условиях:
- Учитывай контекст (тип врага, окружение, фаза игры)
- Доминантные атрибуты — какие атрибуты наиболее важны в данной ситуации
- Сравни с базовой ценностью (transitive-оценка)

Формат: строго JSON.""",
    user_prompt_template="Объект: {object}\nСитуация: {situation}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=600,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=1800,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=400, cost_min=0.003, cost_max=0.015, latency_min_ms=500, latency_max_ms=4000),
)

SUGGEST_INTRANSITIVE_CORRECTIONS = PromptSpec(
    id="SUGGEST_INTRANSITIVE_CORRECTIONS",
    module=ModuleType.BALANCE,
    algorithm="3.4",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="payoff_matrix", type="object", required=True,
                    description="Payoff-матрица (A × B)"),
        PromptInput(name="dominant", type="string", required=True,
                    description="Доминантная стратегия (если есть)"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "changes": {"type": "object"},
                "expected_share": {"type": "number"},
            },
            "required": ["changes", "expected_share"],
        },
    },
    system_prompt="""Ты — эксперт по intransitive-балансировке (rock-paper-scissors). На основе payoff-матрицы предложи коррекции для устранения доминантных стратегий.

Правила:
1. В сбалансированной intransitive-системе нет доминантных стратегий
2. Каждая стратегия должна контриться хотя бы одной другой
3. Целевое распределение использования: близкое к равномерному
4. Коррекции: изменение значений в payoff-матрице

Формат: строго JSON массив коррекций.""",
    user_prompt_template="Payoff матрица: {payoff_matrix}\nДоминантная стратегия: {dominant}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

ANALYZE_DISCREPANCY = PromptSpec(
    id="ANALYZE_DISCREPANCY",
    module=ModuleType.BALANCE,
    algorithm="3.4",
    version="1.0.0",
    taskType=PromptTaskType.ANALYSIS,
    inputs=[
        PromptInput(name="formal_ranking", type="array", required=True,
                    description="Формальный ранг объектов (по cost-power анализу)"),
        PromptInput(name="simulation_ranking", type="array", required=True,
                    description="Ранг объектов по Monte Carlo-симуляции"),
        PromptInput(name="win_rates", type="object", required=True,
                    description="Win rates из симуляции"),
        PromptInput(name="correlation", type="number", required=True,
                    description="Корреляция Спирмена между ранжированиями"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "discrepancy_type": {"type": "string"},
            "affected_objects": {"type": "array"},
            "analysis": {"type": "string"},
            "recommendations": {"type": "array"},
        },
        "required": ["discrepancy_type", "affected_objects", "analysis", "recommendations"],
    },
    system_prompt="""Ты — эксперт по анализу расхождений между формальными моделями балансировки и стохастическими симуляциями.

Когда формальный анализ (cost-power кривые) расходится с результатами Monte Carlo-симуляции, это указывает на:
1. Нелинейные взаимодействия между атрибутами (синергии/анти-синергии)
2. Скрытые механические преимущества (скорость атаки, дальность, AoE)
3. Ситуационную ценность, не учтённую в формальной модели
4. Эффект «стоимости Шрайбера»: усиление может снизить частоту использования

Для каждого расхождения:
- Определи тип: nonlinear/situational/hidden_advantage/schreiber_cost
- Укажи затронутые объекты
- Объясни причину расхождения
- Предложи коррекцию формальной модели или объектных параметров

Формат: строго JSON.""",
    user_prompt_template="Формальный ранг: {formal_ranking}\nРанг симуляции: {simulation_ranking}\nWin rates: {win_rates}\nКорреляция Спирмена: {correlation}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=1800,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=800, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

SELECT_BEST_CORRECTION = PromptSpec(
    id="SELECT_BEST_CORRECTION",
    module=ModuleType.BALANCE,
    algorithm="3.4",
    version="1.0.0",
    taskType=PromptTaskType.RECOMMENDATION,
    inputs=[
        PromptInput(name="pathology", type="string", required=True,
                    description="Обнаруженная патология баланса"),
        PromptInput(name="corrections", type="array", required=True,
                    description="Список предложенных коррекций"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "selected": {"type": "object"},
            "reasoning": {"type": "string"},
            "side_effects": {"type": "array"},
        },
        "required": ["selected", "reasoning", "side_effects"],
    },
    system_prompt="""Ты — эксперт по выбору оптимальных коррекций баланса. Из предложенных коррекций выбери лучшую.

Критерии выбора:
1. Минимальные побочные эффекты
2. Жанровая уместность (в RPG добавление нового типа урона ок, в шутере — нет)
3. Простота реализации
4. Предсказуемость результата

Обязательно укажи возможные побочные эффекты выбранной коррекции.
Формат: строго JSON.""",
    user_prompt_template="Патология: {pathology}\nКоррекции: {corrections}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=800,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=900,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=500, cost_min=0.003, cost_max=0.02, latency_min_ms=800, latency_max_ms=5000),
)


# ============================================================
# БЛОК 5: ПРОГРЕССИЯ (алгоритм 3.5) — 3 промпта
# ============================================================

PLAN_TIERS = PromptSpec(
    id="PLAN_TIERS",
    module=ModuleType.PROGRESSION,
    algorithm="3.5",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="levels", type="number", required=True,
                    description="Общее количество уровней"),
        PromptInput(name="loop_type", type="string", required=True,
                    description="Тип Core Loop (Engine/Economy/Ecology)"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "tier_index": {"type": "number"},
                "level_range": {"type": "string"},
                "scale": {"type": "string"},
                "dominant": {"type": "string"},
            },
            "required": ["tier_index", "level_range", "scale", "dominant"],
        },
    },
    system_prompt="""Ты — эксперт по прогрессии в играх. Разбей уровни на этапы (tiers).

Правила:
1. 2-5 этапов, каждый с уникальной характеристикой
2. Каждый tier имеет: масштаб (локальный/региональный/глобальный), доминантную механику, тип баланса
3. Переход между tiers — ключевой момент ("moment of triumph")
4. Учитывай тип Core Loop: Engine → нарастающая сложность, Economy → ресурсные прорывы, Ecology → адаптация

Формат: строго JSON массив.""",
    user_prompt_template="Жанр: {genre}\nУровни: {levels}\nТип петли: {loop_type}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=300, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

SUGGEST_UNLOCKS = PromptSpec(
    id="SUGGEST_UNLOCKS",
    module=ModuleType.PROGRESSION,
    algorithm="3.5",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="tier", type="object", required=True,
                    description="Этап прогрессии"),
        PromptInput(name="mechanics", type="array", required=True,
                    description="Механики проекта"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "level": {"type": "number"},
                "unlock_name": {"type": "string"},
                "synergies": {"type": "array"},
            },
            "required": ["level", "unlock_name", "synergies"],
        },
    },
    system_prompt="""Ты — эксперт по деревьям разблокировок в играх. Для данного этапа предложи разблокировки.

Правила:
1. Каждая разблокировка привязана к уровню
2. Укажи синергии с существующими механиками
3. Разблокировки должны поддерживать целевые эстетики
4. Чередуй крупные и мелкие разблокировки (pacing)
5. Проверь: нет ли "пустых уровней" без новых возможностей

Формат: строго JSON массив.""",
    user_prompt_template="Этап: {tier}\nМеханики: {mechanics}\nЭстетики: {aesthetics}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

CHECK_PROGRESSION_AESTHETICS = PromptSpec(
    id="CHECK_PROGRESSION_AESTHETICS",
    module=ModuleType.PROGRESSION,
    algorithm="3.5",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
        PromptInput(name="curves", type="object", required=True,
                    description="Кривые прогрессии"),
        PromptInput(name="unlocks", type="array", required=True,
                    description="Дерево разблокировок"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "aesthetic": {"type": "string"},
                "supporting": {"type": "array"},
                "contradicting": {"type": "array"},
                "score": {"type": "number"},
            },
            "required": ["aesthetic", "supporting", "contradicting", "score"],
        },
    },
    system_prompt="""Ты — эксперт по эстетической согласованности прогрессии. Проверь, поддерживают ли кривые прогрессии и разблокировки целевые эстетики.

Для каждой эстетики оцени:
1. Какие элементы прогрессии её поддерживают (score +)
2. Какие противоречат (score -)
3. Итоговый score (0-1)

Проблемы:
- Гринд-прогрессия противоречит эстетике Фантазии
- Слишком быстрая прогрессия противоречит эстетике Вызова
- Отсутствие социального контента противоречит Товариществу

Формат: строго JSON массив.""",
    user_prompt_template="Эстетики: {aesthetics}\nКривые: {curves}\nРазблокировки: {unlocks}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=800,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=900,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=500, cost_min=0.003, cost_max=0.02, latency_min_ms=800, latency_max_ms=5000),
)


# ============================================================
# БЛОК 5: ЭКОНОМИКА (алгоритм 3.6) — 3 промпта
# ============================================================

SUGGEST_SUBSIDIARY_RESOURCES = PromptSpec(
    id="SUGGEST_SUBSIDIARY_RESOURCES",
    module=ModuleType.ECONOMY,
    algorithm="3.6",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="core_resources", type="array", required=True,
                    description="Основные ресурсы из Core Loop"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "class": {"type": "string"},
                "relationship": {"type": "string"},
                "bounds": {"type": "object"},
            },
            "required": ["name", "class", "relationship", "bounds"],
        },
    },
    system_prompt="""Ты — эксперт по экономике игр. На основе основных ресурсов предложи вспомогательные (subsidiary).

Классификация ресурсов (Adams):
- Valued: основной ресурс, который игрок стремится максимизировать
- Commodity: промежуточный ресурс для конверсии
- Subsidiary: вспомогательный, ограничивающий или обогащающий

Для каждого ресурса укажи:
1. Класс (Valued/Commodity/Subsidiary)
2. Отношение к основному ресурсу (конверсия, ограничение, обогащение)
3. Границы (min/max, скорость генерации)

Формат: строго JSON массив.""",
    user_prompt_template="Основные ресурсы: {core_resources}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

SUGGEST_LATE_GAME_SINKS = PromptSpec(
    id="SUGGEST_LATE_GAME_SINKS",
    module=ModuleType.ECONOMY,
    algorithm="3.6",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="resource", type="string", required=True,
                    description="Ресурс, для которого нужны стоки"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "sink_name": {"type": "string"},
                "description": {"type": "string"},
                "player_value": {"type": "string"},
            },
            "required": ["sink_name", "description", "player_value"],
        },
    },
    system_prompt="""Ты — эксперт по эндгейму в играх. Предложи стоки (sinks) для ресурса в поздней игре.

Проблема: без стоков ресурсы накапливаются бесконечно → экономика ломается.

Типы стоков:
1. Косметические (скины, анимации) — не влияют на баланс
2. Прогрессионные (новые деревья навыков, престиж) — открывают новый контент
3. Социальные (гильдии, подарки) — создают взаимодействие
4. Ротационные (сезонные предметы) — регулярное обновление

Каждый сток должен создавать ценность для игрока (player_value).
Формат: строго JSON массив.""",
    user_prompt_template="Ресурс: {resource}\nЖанр: {genre}\nЭстетики: {aesthetics}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1000,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=800, cost_min=0.006, cost_max=0.04, latency_min_ms=1500, latency_max_ms=8000),
)

GENERATE_ECONOMY_DESCRIPTION = PromptSpec(
    id="GENERATE_ECONOMY_DESCRIPTION",
    module=ModuleType.ECONOMY,
    algorithm="3.6",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="machinations", type="object", required=True,
                    description="Machinations-модель экономики"),
        PromptInput(name="type", type="string", required=True,
                    description="Тип экономической системы"),
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
    ],
    outputFormat=OutputFormat.MARKDOWN,
    outputSchema=None,
    system_prompt="""Ты — эксперт по описанию игровых экономик. На основе Machinations-модели создай человекочитаемое описание экономики игры.

Описание должно включать:
1. Обзор экономической системы (2-3 абзаца)
2. Основные ресурсы и их роль
3. Петли генерации и потребления
4. Стоки и краны (faucets/drains)
5. Потенциальные проблемы и решения

Пиши понятно, для игрового дизайнера, не для экономиста.
Формат: Markdown.""",
    user_prompt_template="Machinations модель: {machinations}\nТип: {type}\nЖанр: {genre}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1500,
        response_format=OutputFormat.MARKDOWN,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=False, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=1800,
    ),
    estimated=EstimatedMetrics(input_tokens=600, output_tokens=1000, cost_min=0.005, cost_max=0.03, latency_min_ms=1500, latency_max_ms=8000),
)


# ============================================================
# БЛОК 6: GDD (алгоритм 3.7) — 3 промпта
# ============================================================

ENRICH_SECTION = PromptSpec(
    id="ENRICH_SECTION",
    module=ModuleType.GDD,
    algorithm="3.7",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="section", type="string", required=True,
                    description="Название секции GDD"),
        PromptInput(name="existing", type="string", required=True,
                    description="Существующий текст секции"),
        PromptInput(name="context", type="object", required=True,
                    description="Контекст проекта (Project State)"),
    ],
    outputFormat=OutputFormat.MARKDOWN,
    outputSchema=None,
    system_prompt="""Ты — эксперт по написанию Game Design Documents. Обогати указанную секцию GDD на основе существующего текста и контекста проекта.

Секции GDD:
1. Обзор игры (Game Overview)
2. Механики (Mechanics)
3. Core Loop
4. Прогрессия (Progression)
5. Экономика (Economy)
6. Персонажи (Characters)
7. Уровни (Levels)
8. Интерфейс (UI/UX)
9. Арт-стиль (Art Style)
10. Звук (Audio)
11. Монетизация (Monetization)
12. Технические требования

Правила:
1. Дополняй, а не переписывай
2. Используй данные из Project State
3. Добавляй конкретику (числа, формулы, примеры)
4. Формат: Markdown с заголовками и списками""",
    user_prompt_template="Секция: {section}\nСуществующий текст: {existing}\nКонтекст: {context}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=8192,
        temperature=0.7,
        max_tokens=2048,
        response_format=OutputFormat.MARKDOWN,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=False, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=1000, output_tokens=1500, cost_min=0.01, cost_max=0.08, latency_min_ms=3000, latency_max_ms=15000),
)

GENERATE_CHARACTERS_SECTION = PromptSpec(
    id="GENERATE_CHARACTERS_SECTION",
    module=ModuleType.GDD,
    algorithm="3.7",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="setting", type="string", required=True,
                    description="Сеттинг/мир игры"),
        PromptInput(name="core_loop", type="object", required=True,
                    description="Core Loop игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "role": {"type": "string"},
                "motivation": {"type": "string"},
                "arc": {"type": "string"},
                "voice": {"type": "string"},
            },
            "required": ["name", "role", "motivation", "arc", "voice"],
        },
    },
    system_prompt="""Ты — эксперт по созданию персонажей для игр. На основе жанра, сеттинга и Core Loop создай 3-5 персонажей.

Для каждого персонажа:
1. Имя
2. Роль (протагонист, антагонист, NPC, компаньон)
3. Мотивация (что движет персонажем в мире игры)
4. Арка развития (как персонаж меняется по ходу прогрессии)
5. Голос (манера речи, характерные фразы)

Персонажи должны:
- Вписываться в Core Loop (их действия имеют игровой смысл)
- Поддерживать целевую эстетику
- Иметь потенциал для нарративного конфликта

Формат: строго JSON массив.""",
    user_prompt_template="Жанр: {genre}\nСеттинг: {setting}\nCore Loop: {core_loop}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=2048,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=1500, cost_min=0.01, cost_max=0.06, latency_min_ms=3000, latency_max_ms=12000),
)

GENERATE_VISUAL_STYLE = PromptSpec(
    id="GENERATE_VISUAL_STYLE",
    module=ModuleType.GDD,
    algorithm="3.7",
    version="1.0.0",
    taskType=PromptTaskType.GENERATION,
    inputs=[
        PromptInput(name="genre", type="string", required=True,
                    description="Жанр игры"),
        PromptInput(name="aesthetics", type="array", required=True,
                    description="Целевые эстетики"),
        PromptInput(name="mood", type="string", required=True,
                    description="Настроение игры"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "palette": {"type": "object"},
            "style": {"type": "string"},
            "references": {"type": "array"},
            "image_prompts": {"type": "array"},
        },
        "required": ["palette", "style", "references", "image_prompts"],
    },
    system_prompt="""Ты — эксперт по визуальному стилю игр. На основе жанра, эстетик и настроения предложи визуальную концепцию.

Включи:
1. Палитра (основные, дополнительные, акцентные цвета — hex-коды)
2. Стиль (realistic, stylized, pixel art, low-poly, hand-drawn, и т.д.)
3. Референсы (3-5 существующих игр/проектов)
4. Промпты для генерации изображений (2-3 промпта для AI image generation)

Эстетика → визуальное решение:
- Чувственное → детализированные текстуры, эффекты частиц
- Фантазия → необычные формы, светящиеся элементы
- Нарратив → кинематографичные композиции
- Вызов → чёткие силуэты, контрастные цвета
- Товарищество → тёплые тона, пространства для взаимодействия
- Открытие → загадочные текстуры, скрытые детали
- Выражение → настраиваемые элементы, яркие акценты
- Подчинение → уютные, привычные визуальные паттерны

Формат: строго JSON.""",
    user_prompt_template="Жанр: {genre}\nЭстетики: {aesthetics}\nНастроение: {mood}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.7,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)


# ============================================================
# БЛОК 6: ВАЛИДАЦИЯ (алгоритм 3.8) — 4 промпта
# ============================================================

CHECK_LUDONARRATIVE_VAL = PromptSpec(
    id="CHECK_LUDONARRATIVE_VAL",
    module=ModuleType.VALIDATION,
    algorithm="3.8",
    version="1.0.0",
    taskType=PromptTaskType.ANALYSIS,
    inputs=[
        PromptInput(name="themes", type="array", required=True,
                    description="Темы и ценности игры"),
        PromptInput(name="actions", type="array", required=True,
                    description="Действия игрока в геймплее"),
        PromptInput(name="rewards", type="array", required=True,
                    description="Система вознаграждений"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "result": {"type": "string"},
            "dissonances": {"type": "array"},
            "harmonies": {"type": "array"},
        },
        "required": ["result", "dissonances", "harmonies"],
    },
    system_prompt="""Ты — эксперт по лудонарративной валидации. Проверь согласованность между темами, действиями и вознаграждениями.

Диссонанс возникает когда:
- Тема "защита природы" + действие "уничтожение всего живого" + награда за убийства
- Тема "одиночество" + мультиплеер с принудительной кооперацией
- Награды поощряют поведение, противоречащее теме

Гармония когда:
- Действия воплощают тему
- Награды подкрепляют тематическое поведение
- Все слои дизайна говорят об одном

Результат: consonance / partial_dissonance / strong_dissonance
Формат: строго JSON.""",
    user_prompt_template="Темы: {themes}\nДействия: {actions}\nВознаграждения: {rewards}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

APPLY_LENS_VAL = PromptSpec(
    id="APPLY_LENS_VAL",
    module=ModuleType.VALIDATION,
    algorithm="3.8",
    version="1.0.0",
    taskType=PromptTaskType.EVALUATION,
    inputs=[
        PromptInput(name="lens", type="string", required=True,
                    description="ID линзы Шелла"),
        PromptInput(name="context", type="object", required=True,
                    description="Контекст проекта"),
        PromptInput(name="previous_issues", type="array", required=False,
                    description="Ранее обнаруженные проблемы", default=[]),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "lens_id": {"type": "string"},
            "score": {"type": "number"},
            "issues": {"type": "array"},
            "suggestions": {"type": "array"},
        },
        "required": ["lens_id", "score", "issues", "suggestions"],
    },
    system_prompt="""Ты — эксперт по валидации игр через Линзы Шелла. Примени линзу к контексту проекта.

Правила:
1. Ответь на ключевой вопрос линзы
2. Оцени score (0-1)
3. Учитывай ранее обнаруженные проблемы
4. Предложи конкретные исправления

Формат: строго JSON.""",
    user_prompt_template="Линза: {lens}\nКонтекст: {context}\nПрошлые проблемы: {previous_issues}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.3,
        max_tokens=800,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=900,
    ),
    estimated=EstimatedMetrics(input_tokens=400, output_tokens=500, cost_min=0.003, cost_max=0.015, latency_min_ms=500, latency_max_ms=4000),
)

CHECK_PLAYER_AGENCY = PromptSpec(
    id="CHECK_PLAYER_AGENCY",
    module=ModuleType.VALIDATION,
    algorithm="3.8",
    version="1.0.0",
    taskType=PromptTaskType.ANALYSIS,
    inputs=[
        PromptInput(name="choices", type="array", required=True,
                    description="Выборы, доступные игроку"),
        PromptInput(name="consequences", type="array", required=True,
                    description="Последствия выборов"),
        PromptInput(name="branching", type="object", required=True,
                    description="Структура ветвления"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "object",
        "properties": {
            "score": {"type": "number"},
            "gaps": {"type": "array"},
            "strengths": {"type": "array"},
            "false_choices": {"type": "array"},
        },
        "required": ["score", "gaps", "strengths", "false_choices"],
    },
    system_prompt="""Ты — эксперт по агентности игрока (player agency). Проанализируй систему выборов.

Проверь:
1. Иллюзия выбора (false choices) — все пути ведут к одному результату
2. Значимые выборы — разные пути ведут к разным результатам
3. Обратная связь — игрок видит последствия своих решений
4. Пробелы — моменты, где выбор ожидался, но не был дан

Оцени score (0-1): насколько игрок чувствует контроль над историей/геймплеем.

Формат: строго JSON.""",
    user_prompt_template="Выборы: {choices}\nПоследствия: {consequences}\nВетвление: {branching}",
    modelRequirements=ModelRequirements(
        primary=_POWERFUL_MODEL,
        fallback=_POWERFUL_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1500,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=False, cache_ttl=None,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=1000, cost_min=0.008, cost_max=0.05, latency_min_ms=2000, latency_max_ms=10000),
)

GENERATE_REMEDIATION = PromptSpec(
    id="GENERATE_REMEDIATION",
    module=ModuleType.VALIDATION,
    algorithm="3.8",
    version="1.0.0",
    taskType=PromptTaskType.RECOMMENDATION,
    inputs=[
        PromptInput(name="issues", type="array", required=True,
                    description="Список обнаруженных проблем"),
        PromptInput(name="design_summary", type="object", required=True,
                    description="Краткое описание дизайна"),
    ],
    outputFormat=OutputFormat.JSON,
    outputSchema={
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "issue_id": {"type": "string"},
                "action": {"type": "string"},
                "effort": {"type": "string"},
                "order": {"type": "number"},
            },
            "required": ["issue_id", "action", "effort", "order"],
        },
    },
    system_prompt="""Ты — эксперт по устранению проблем в геймдизайне. На основе списка проблем создай план мероприятий (remediation plan).

Для каждой проблемы укажи:
1. issue_id — ссылка на проблему
2. action — конкретное действие по исправлению
3. effort — трудоёмкость (low/medium/high)
4. order — приоритет выполнения (1 = самое срочное)

Правила приоритизации:
1. Критические проблемы (баланс, диссонанс) → порядок 1-3
2. Важные проблемы (эстетика, агентность) → порядок 4-6
3. Улучшения (полировка, оптимизация) → порядок 7+

Формат: строго JSON массив.""",
    user_prompt_template="Проблемы: {issues}\nОписание дизайна: {design_summary}",
    modelRequirements=ModelRequirements(
        primary=_FAST_MODEL,
        fallback=_FAST_FALLBACK,
        min_context_window=4096,
        temperature=0.5,
        max_tokens=1000,
        response_format=OutputFormat.JSON,
    ),
    guarantees=PromptGuarantees(
        deterministic=False, json_output=True, max_retries=2,
        fallback_on_failure=True, cacheable=True, cache_ttl=900,
    ),
    estimated=EstimatedMetrics(input_tokens=500, output_tokens=700, cost_min=0.003, cost_max=0.02, latency_min_ms=800, latency_max_ms=5000),
)


# ============================================================
# PROMPT REGISTRY — все 35 промптов
# ============================================================

PROMPT_REGISTRY: dict[str, PromptSpec] = {
    # Блок 1: Концепция (7)
    "CLASSIFY_GENRE": CLASSIFY_GENRE,
    "EXTRACT_AESTHETICS": EXTRACT_AESTHETICS,
    "GENERATE_CORE_LOOPS": GENERATE_CORE_LOOPS,
    "GENERATE_USP": GENERATE_USP,
    "VALIDATE_TRIANGLE": VALIDATE_TRIANGLE,
    "VALIDATE_IDEA_FILTERS": VALIDATE_IDEA_FILTERS,
    "ASSEMBLE_ONE_PAGER": ASSEMBLE_ONE_PAGER,

    # Блок 2: Core Loop (4)
    "DECOMPOSE_STEP": DECOMPOSE_STEP,
    "GENERATE_OUTER_LOOPS": GENERATE_OUTER_LOOPS,
    "GENERATE_META_LOOP": GENERATE_META_LOOP,
    "GENERATE_RECOMMENDATIONS": GENERATE_RECOMMENDATIONS,

    # Блок 3: MDA (5)
    "SUGGEST_DYNAMICS": SUGGEST_DYNAMICS,
    "SUGGEST_MECHANICS": SUGGEST_MECHANICS,
    "SIMULATE_GAMEPLAY": SIMULATE_GAMEPLAY,
    "APPLY_LENS_MDA": APPLY_LENS_MDA,
    "CHECK_LUDONARRATIVE_MDA": CHECK_LUDONARRATIVE_MDA,

    # Блок 4: Баланс (6)
    "ESTIMATE_WEIGHTS": ESTIMATE_WEIGHTS,
    "EVALUATE_SITUATIONAL_VALUE": EVALUATE_SITUATIONAL_VALUE,
    "SUGGEST_INTRANSITIVE_CORRECTIONS": SUGGEST_INTRANSITIVE_CORRECTIONS,
    "ANALYZE_DISCREPANCY": ANALYZE_DISCREPANCY,
    "SELECT_BEST_CORRECTION": SELECT_BEST_CORRECTION,

    # Блок 5: Прогрессия (3)
    "PLAN_TIERS": PLAN_TIERS,
    "SUGGEST_UNLOCKS": SUGGEST_UNLOCKS,
    "CHECK_PROGRESSION_AESTHETICS": CHECK_PROGRESSION_AESTHETICS,

    # Блок 5: Экономика (3)
    "SUGGEST_SUBSIDIARY_RESOURCES": SUGGEST_SUBSIDIARY_RESOURCES,
    "SUGGEST_LATE_GAME_SINKS": SUGGEST_LATE_GAME_SINKS,
    "GENERATE_ECONOMY_DESCRIPTION": GENERATE_ECONOMY_DESCRIPTION,

    # Блок 6: GDD (3)
    "ENRICH_SECTION": ENRICH_SECTION,
    "GENERATE_CHARACTERS_SECTION": GENERATE_CHARACTERS_SECTION,
    "GENERATE_VISUAL_STYLE": GENERATE_VISUAL_STYLE,

    # Блок 6: Валидация (4)
    "CHECK_LUDONARRATIVE_VAL": CHECK_LUDONARRATIVE_VAL,
    "APPLY_LENS_VAL": APPLY_LENS_VAL,
    "CHECK_PLAYER_AGENCY": CHECK_PLAYER_AGENCY,
    "GENERATE_REMEDIATION": GENERATE_REMEDIATION,
}


def get_prompt_spec(prompt_id: str) -> PromptSpec | None:
    """Получить спецификацию промпта по ID."""
    return PROMPT_REGISTRY.get(prompt_id)


def get_prompts_by_module(module: ModuleType) -> list[PromptSpec]:
    """Получить все промпты модуля."""
    return [spec for spec in PROMPT_REGISTRY.values() if spec.module == module]


def get_prompts_by_task_type(task_type: PromptTaskType) -> list[PromptSpec]:
    """Получить все промпты по типу задачи."""
    return [spec for spec in PROMPT_REGISTRY.values() if spec.task_type == task_type]


def get_cacheable_prompts() -> list[PromptSpec]:
    """Получить все кэшируемые промпты."""
    return [spec for spec in PROMPT_REGISTRY.values() if spec.guarantees.cacheable]


def get_registry_stats() -> dict:
    """Статистика реестра промптов."""
    from collections import Counter

    module_counts = Counter(spec.module.value for spec in PROMPT_REGISTRY.values())
    task_type_counts = Counter(spec.task_type.value for spec in PROMPT_REGISTRY.values())
    cacheable_count = sum(1 for s in PROMPT_REGISTRY.values() if s.guarantees.cacheable)
    json_output_count = sum(1 for s in PROMPT_REGISTRY.values() if s.guarantees.json_output)

    total_input_tokens = sum(s.estimated.input_tokens for s in PROMPT_REGISTRY.values())
    total_output_tokens = sum(s.estimated.output_tokens for s in PROMPT_REGISTRY.values())
    total_cost_min = sum(s.estimated.cost_min for s in PROMPT_REGISTRY.values())
    total_cost_max = sum(s.estimated.cost_max for s in PROMPT_REGISTRY.values())

    return {
        "total_prompts": len(PROMPT_REGISTRY),
        "by_module": dict(module_counts),
        "by_task_type": dict(task_type_counts),
        "cacheable": cacheable_count,
        "json_output": json_output_count,
        "estimated_total_input_tokens": total_input_tokens,
        "estimated_total_output_tokens": total_output_tokens,
        "estimated_total_cost_per_session": {
            "min_usd": round(total_cost_min, 3),
            "max_usd": round(total_cost_max, 3),
        },
    }
