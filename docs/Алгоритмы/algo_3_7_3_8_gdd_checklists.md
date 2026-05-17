# Фаза 3: Алгоритмы — Спецификация 3.7 и 3.8

> **Проект**: Gidede — Game Design AI System  
> **Дата**: 2026-05-18  
> **Настоящая фаза**: Формализация алгоритмов  
> **Данный документ**: Спецификации алгоритмов 3.7 (Генерация структуры GDD) и 3.8 (Чек-листы и валидация геймдизайна)  
> **Источники**: Кн. 1 (Шелл — 113 линз, 8 фильтров), Кн. 3 (Андрианова/Яковлева — 11 типов нарративной документации), Кн. 5 (Фуллертон — Playcentric Design, 26 правил плейтеста), Кн. 6 (Зубек — живая документация), Кн. 8 (Роджерс — 38 секций GDD, One-Sheet, Ten-Pager), Кн. 10 (Гэри — 6 этапов цикла, 5 качеств), Кн. 12 (Роллингс/Моррис — 3 уровня документации, Q-фактор, SPS), Кн. 13 (Селлерс — концепт-документ, 4 атрибута веселья), Кн. 17 (Бонд — матрица 4×3, Reverse MDA); Библия геймдизайна (разд. 2.10, 2.11); Концепция программы (разд. 2.5.2, Блок 6); Алгоритмы 3.1–3.6

---

## 3.7 Алгоритм генерации структуры GDD

### 3.7.1 Обзор алгоритма

Алгоритм генерации структуры GDD реализует **Блок 6.1–6.2** (Шаблоны GDD + AI-заполнение) архитектуры Gidede и принимает на вход данные из всех предшествующих алгоритмов: концепцию (3.1), Core Loop (3.2), MDA-профиль механик (3.3), результаты балансировки (3.4), систему прогрессии (3.5) и экономическую модель (3.6). Его задача — превратить проектное состояние в **структурированную, адаптивную документацию**, которая генерируется автоматически, но допускает ручную доработку и всегда остаётся синхронизированной с моделью проекта.

Ключевой принцип: **документация — это проекция модели, а не отдельный артефакт**. Шелл (Кн. 1) формулирует это как «GDD — это теория о том, что сделает игру хорошей», а Роллингс/Моррис (Кн. 12) — как «ось производственного процесса». Gidede реализует этот принцип технически: GDD не хранится как статический текст, а **рендерится** из Project State при каждом запросе, подобно тому, как React-компонент рендерится из состояния. Изменение модели автоматически обновляет все зависимые разделы GDD — это решает фундаментальную проблему «рассинхронизации документации», с которой сталкивается каждая команда.

Алгоритм состоит из 8 этапов. Этапы 1-2 — аналитические (определение формата и структуры). Этапы 3-5 — генеративные (сборка содержания по секциям). Этапы 6-7 — интегративные (сшивка модулей, проверка согласованности). Этап 8 — форматирование и экспорт.

### 3.7.2 Входные данные

```typescript
interface GDDGenerationInput {
  // Обязательные поля (из предшествующих алгоритмов)
  concept: OnePager;                       // Из алгоритма 3.1
  coreLoop: CoreLoopProfile;               // Из алгоритма 3.2
  mdaProfile: MDAProfile;                  // Из алгоритма 3.3
  balanceResult: BalanceResult;            // Из алгоритма 3.4
  progressionProfile: ProgressionProfile;   // Из алгоритма 3.5
  economyProfile: EconomyProfile;           // Из алгоритма 3.6
  
  // Параметры генерации (опционально — AI заполняет, если не указаны)
  targetFormat?: GDDFormat;                 // Целевой формат документации
  targetAudienceDoc?: DocAudience;          // Для кого документ
  detailLevel?: DetailLevel;                // Уровень детализации
  customSections?: string[];                // Дополнительные секции
  excludedSections?: string[];              // Исключённые секции
  language?: string;                        // Язык документации
  
  // Ограничения
  constraints?: GDDConstraints;
}

type GDDFormat = 
  | 'one_sheet'             // One-Sheet: 1 страница (Роджерс)
  | 'ten_pager'             // Ten-Pager: 5-10 страниц (Роджерс)
  | 'treatment'             // Техническое предложение: 5-6 страниц (Роллингс/Моррис)
  | 'sketch_design'         // Эскизный проект: 15-30 страниц (Роллингс/Моррис)
  | 'full_gdd'              // Полный GDD: 50-200+ страниц (Роджерс, 38 секций)
  | 'concept_doc'           // Концепт-документ Селлерса
  | 'narrative_bible'       // Нарративная библия (Андрианова/Яковлева)
  | 'modular';              // Модульная документация Gidede (13 модулей)

type DocAudience = 
  | 'investor'              // Инвестор / издатель
  | 'team_sync'             // Синхронизация команды
  | 'production'            // Производственная спецификация
  | 'personal'              // Личный референс (инди)
  | 'educational';          // Учебный проект

type DetailLevel = 
  | 'overview'              // Обзор: ключевые идеи без деталей
  | 'standard'              // Стандартный: основные разделы с обоснованиями
  | 'detailed'              // Детальный: формулы, таблицы, диаграммы
  | 'exhaustive';           // Исчерпывающий: полные спецификации всех систем

interface GDDConstraints {
  maxPages?: number;                       // Максимум страниц
  includeDiagrams?: boolean;               // Включать ли диаграммы
  includeFormulas?: boolean;               // Включать ли формулы
  includeTables?: boolean;                 // Включать ли таблицы баланса
  citationStyle?: 'footnote' | 'inline' | 'none';  // Стиль цитирования источников
  exportFormats?: ('pdf' | 'docx' | 'md' | 'html')[];  // Форматы экспорта
}
```

### 3.7.3 Этап 1: Определение формата документации

**Цель**: На основе жанра, стадии проекта, целевой аудитории документа и контекста использования определить оптимальный формат документации. Используется трёхуровневая модель Роллингса/Морриса (Кн. 12), дополненная форматами Роджерса (Кн. 8) и Селлерса (Кн. 13).

**Алгоритм**:

```
ВХОД: GDDGenerationInput

// ===== ШАГ 1.1: Определение формата (если не указан явно) =====
IF input.targetFormat IS PROVIDED:
    format = input.targetFormat
ELSE:
    // Эвристика: формат зависит от аудитории и стадии проекта
    audience_format_map = {
        "investor":     "treatment",         // Инвестору — краткое предложение
        "team_sync":    "sketch_design",      // Команде — эскизный проект
        "production":   "full_gdd",           // Производство — полная документация
        "personal":     "modular",            // Индивидуальный — модульная (по мере надобности)
        "educational":  "ten_pager"           // Учебный — обзор + детали ключевых систем
    }
    format = audience_format_map[input.targetAudienceDoc] ?? "modular"

// ===== ШАГ 1.2: Уточнение формата по стадии проекта =====
// Роллингс/Моррис: на разных стадиях нужна разная документация
stage_format_map = {
    "concept":       "one_sheet",            // Есть только идея → 1 страница
    "prototype":     "ten_pager",            // Есть прототип → 5-10 страниц
    "preproduction": "sketch_design",         // Препродакшен → эскизный проект
    "production":    "full_gdd",             // Продакшен → полный GDD
    "live_ops":      "modular"               // Живой сервис → модульная (обновляемая)
}

IF input.concept.projectStage IS PROVIDED:
    stage_format = stage_format_map[projectStage]
    // Если формат по аудитории и по стадии расходятся — предложить оба
    IF stage_format != format:
        ADD_INFO(f"Формат по аудитории: {format}. Формат по стадии: {stage_format}.")
        ADD_INFO("Рекомендация: начните с краткого формата, затем нарастите детализацию.")

// ===== ШАГ 1.3: Определение уровня детализации =====
IF input.detailLevel IS PROVIDED:
    detail = input.detailLevel
ELSE:
    // Жанровая эвристика уровня детализации
    genre_detail_map = {
        "казуальная":    "overview",          // Казуальные: минимум формул
        "инди-пазл":     "standard",          // Инди: базовая детализация
        "RPG":           "detailed",          // RPG: формулы, таблицы, деревья
        "стратегия":     "detailed",          // Стратегия: экономические модели
        "MMO":           "exhaustive",        // MMO: исчерпывающие спецификации
        "F2P mobile":    "detailed",          // F2P: экономика, метрики, монетизация
        "action":        "standard",          // Action: механики + баланс
        "survival":      "detailed"           // Survival: крафт, ресурсы, циклы
    }
    detail = genre_detail_map[genre] ?? "standard"

// ===== ШАГ 1.4: Определение набора секций =====
// Каждый формат имеет свой набор секций
section_templates = {
    "one_sheet": [
        "title", "logline", "genre", "target_audience",
        "uniqueness", "visual_hook"
    ],
    "ten_pager": [
        "title_logline", "concept", "core_loop_diagram",
        "unique_mechanics", "setting_world", "target_market",
        "monetization", "milestones", "risks", "team"
    ],
    "treatment": [
        "game_type", "originality", "feasibility"
    ],
    "sketch_design": [
        "mechanics_detail", "level_structure", "progression_system",
        "user_interface", "content_overview"
    ],
    "full_gdd": FULL_GDD_38_SECTIONS,  // Все 38 секций Роджерса (см. Библию 2.11)
    "concept_doc": [
        "player_experience_goal", "core_mechanic", "core_loop",
        "system_map", "feedback_patterns", "success_metrics"
    ],
    "narrative_bible": [
        "logline", "synopsis", "setting_bible", "character_bible",
        "storyline_map", "cutscene_scripts", "dialogue_db",
        "quest_matrix", "lore_db", "dissension_validator", "pitch_deck"
    ],
    "modular": MODULAR_13_MODULES  // M-01..M-13 (см. Библию 2.11)
}

sections = section_templates[format]

// Исключить/добавить пользовательские секции
IF input.excludedSections:
    sections = sections.filter(s => s NOT IN excludedSections)
IF input.customSections:
    sections = sections + input.customSections

ВЫХОД: GDDFormatSpec = {
    format: format,
    detail_level: detail,
    sections: sections,
    estimated_pages: ESTIMATE_PAGES(format, detail),
    audience: input.targetAudienceDoc,
    export_formats: input.constraints?.exportFormats ?? ['pdf', 'md']
}
```

**Таблица: Форматы документации — сравнительный анализ**

| Формат | Объём | Аудитория | Содержание | Когда использовать |
|--------|-------|-----------|-----------|-------------------|
| One-Sheet | 1 стр. | Все | Суть игры в 6 полях | Концепция, питчинг |
| Ten-Pager | 5-10 стр. | Продюсер, издатель | Концепция + Core Loop + рынок | Решение о финансировании |
| Treatment | 5-6 стр. | Издатель, инвестор | Тип + оригинальность + реализуемость | Препродакшен |
| Sketch Design | 15-30 стр. | Команда | Механики + уровни + прогрессия + UI | Прототипирование |
| Full GDD | 50-200+ стр. | Вся команда | 38 секций, формулы, таблицы | Продакшен |
| Concept Doc | 5-10 стр. | Команда, издатель | Целевой опыт + система + метрики | Препродакшен (системный подход) |
| Narrative Bible | 20-50 стр. | Сценаристы, художники | 11 типов нарративной документации | Нарративные игры |
| Modular | По требованию | По требованию | 13 независимых модулей | Любая стадия |

### 3.7.4 Этап 2: Маппинг Project State → секции GDD

**Цель**: Определить, какие данные из Project State (результаты алгоритмов 3.1–3.6) поставляют содержание для каждой секции GDD. Это ключевой этап, обеспечивающий автоматическую генерацию и синхронизацию: каждая секция GDD получает данные из конкретных полей модели, и при изменении модели секция обновляется автоматически.

**Алгоритм**:

```
ВХОД: GDDFormatSpec, GDDGenerationInput

// ===== Маппинг: секция → источник данных =====
section_data_map = {
    // БЛОК 1: ОБЗОР ИГРЫ (секции 1-6 Роджерса)
    "title":                    { source: "concept.title", auto_fill: true },
    "overview":                 { source: "concept.storySynopsis + concept.gameplayDescription", auto_fill: true, ai_enrich: true },
    "genre_platform":           { source: "concept.genre + concept.platform", auto_fill: true },
    "target_audience":          { source: "concept.targetAudience + mdaProfile.aestheticProfile", auto_fill: true, ai_enrich: true },
    "uniqueness":               { source: "concept.usp + concept.uniqueFeatures", auto_fill: true, ai_enrich: true },
    "license":                  { source: "concept.license", auto_fill: false, manual: true },
    
    // БЛОК 2: ГЕЙМПЛЕЙ (секции 7-14)
    "core_loop":                { source: "coreLoop", auto_fill: true, diagram: true },
    "controls":                 { source: "coreLoop.input_mapping", auto_fill: false, ai_suggest: true },
    "mechanics":                { source: "mdaProfile.mechanicSet", auto_fill: true, ai_enrich: true },
    "camera_perspective":       { source: "concept.camera", auto_fill: false, ai_suggest: true },
    "progression":              { source: "progressionProfile", auto_fill: true, diagram: true },
    "balance":                  { source: "balanceResult", auto_fill: true, tables: true, formulas: true },
    "difficulty":               { source: "progressionProfile.curves.difficulty", auto_fill: true, diagram: true },
    "game_modes":               { source: "concept.game_modes", auto_fill: false, ai_suggest: true },
    
    // БЛОК 3: ПЕРСОНАЖИ И НАРРАТИВ (секции 15-19)
    "characters":               { source: "concept.narrative?.characters", auto_fill: false, ai_generate: true },
    "story":                    { source: "concept.narrative?.story", auto_fill: false, ai_generate: true },
    "dialogues":                { source: "concept.narrative?.dialogues", auto_fill: false, manual: true },
    "quests":                   { source: "concept.narrative?.quests", auto_fill: false, ai_generate: true },
    "lore":                     { source: "concept.narrative?.lore", auto_fill: false, ai_generate: true },
    
    // БЛОК 4: УРОВНИ И МИР (секции 20-23)
    "world_structure":          { source: "progressionProfile.contentPlan", auto_fill: true, diagram: true },
    "level_design":             { source: "progressionProfile.contentPlan.tier_plans", auto_fill: true, ai_enrich: true },
    "navigation":               { source: "concept.ld?.navigation", auto_fill: false, ai_suggest: true },
    "combat_spaces":            { source: "concept.ld?.combat", auto_fill: false, ai_suggest: true },
    
    // БЛОК 5: ЭКОНОМИКА И ПРОГРЕССИЯ (секции 24-27)
    "resources":                { source: "economyProfile.resourceModel", auto_fill: true, tables: true },
    "economy":                  { source: "economyProfile", auto_fill: true, diagram: true, formulas: true },
    "tech_tree":                { source: "progressionProfile.unlock_tree", auto_fill: true, diagram: true },
    "difficulty_curve":         { source: "progressionProfile.curves.difficulty", auto_fill: true, diagram: true },
    
    // БЛОК 6: ИНТЕРФЕЙС И ВИЗУАЛ (секции 28-31)
    "hud_ui":                   { source: "concept.ui", auto_fill: false, ai_suggest: true },
    "menus":                    { source: "concept.ui?.menus", auto_fill: false, manual: true },
    "visual_style":             { source: "concept.art", auto_fill: false, ai_generate: true },
    "sound_music":              { source: "concept.audio", auto_fill: false, ai_generate: true },
    
    // БЛОК 7: МУЛЬТИПЛЕЕР И СОЦИАЛЬ (секции 32-34)
    "multiplayer_modes":        { source: "concept.multiplayer", auto_fill: false, ai_suggest: true },
    "social_features":          { source: "concept.social", auto_fill: false, ai_suggest: true },
    "meta_game":                { source: "progressionProfile.metalLoop", auto_fill: true, ai_enrich: true },
    
    // БЛОК 8: ТЕХНИЧЕСКИЕ И БИЗНЕС (секции 35-38)
    "tech_requirements":        { source: "concept.tech", auto_fill: false, manual: true },
    "platform_ports":           { source: "concept.platform", auto_fill: true, ai_enrich: true },
    "monetization":             { source: "economyProfile.monetizationModel", auto_fill: true, formulas: true },
    "milestones_budget":        { source: "concept.production", auto_fill: false, manual: true }
}

// ===== Фильтрация маппинга по выбранным секциям =====
active_mappings = {}
FOR EACH section IN GDDFormatSpec.sections:
    IF section IN section_data_map:
        active_mappings[section] = section_data_map[section]
    ELSE:
        // Кастомная секция — требуется ручное заполнение или AI-генерация
        active_mappings[section] = {
            source: "none",
            auto_fill: false,
            ai_generate: true,
            manual: true,
            prompt_context: EXTRACT_CONTEXT(section, concept)
        }

// ===== Определение готовности данных =====
section_readiness = {}
FOR EACH section, mapping IN active_mappings:
    source_data = RESOLVE_SOURCE(mapping.source, input)
    IF source_data IS NOT NULL:
        section_readiness[section] = {
            status: "ready",              // Данные доступны
            coverage: CALC_COVERAGE(source_data, section),
            auto_fillable: mapping.auto_fill
        }
    ELIF mapping.ai_generate OR mapping.ai_enrich:
        section_readiness[section] = {
            status: "ai_generatable",     // Можно сгенерировать AI
            coverage: 0,
            auto_fillable: true
        }
    ELIF mapping.ai_suggest:
        section_readiness[section] = {
            status: "ai_suggestable",     // AI может предложить черновик
            coverage: 0,
            auto_fillable: false
        }
    ELSE:
        section_readiness[section] = {
            status: "manual_required",    // Требуется ручной ввод
            coverage: 0,
            auto_fillable: false
        }

ВЫХОД: GDDDataMapping = {
    format_spec: GDDFormatSpec,
    active_mappings: active_mappings,
    section_readiness: section_readiness,
    auto_fillable_sections: FILTER(section_readiness, r => r.auto_fillable),
    manual_sections: FILTER(section_readiness, r => r.status == "manual_required"),
    ai_generatable_sections: FILTER(section_readiness, r => r.status == "ai_generatable"),
    coverage_score: LEN(auto_fillable_sections) / LEN(all_sections)
}
```

**Таблица: Покрытие секций GDD данными из предшествующих алгоритмов**

| Блок GDD | Секций всего | Автозаполняемых | AI-генерируемых | Ручных |
|----------|-------------|----------------|----------------|--------|
| Обзор игры | 6 | 5 | 1 | 0 |
| Геймплей | 8 | 5 | 2 | 1 |
| Персонажи и нарратив | 5 | 0 | 4 | 1 |
| Уровни и мир | 4 | 2 | 2 | 0 |
| Экономика и прогрессия | 4 | 4 | 0 | 0 |
| Интерфейс и визуал | 4 | 0 | 2 | 2 |
| Мультиплеер и социаль | 3 | 1 | 1 | 1 |
| Технические и бизнес | 4 | 2 | 1 | 1 |
| **Итого** | **38** | **19 (50%)** | **13 (34%)** | **6 (16%)** |

### 3.7.5 Этап 3: Генерация содержания автозаполняемых секций

**Цель**: Заполнить секции GDD, для которых данные доступны напрямую из Project State. Это полностью автоматический этап, не требующий AI-генерации: данные извлекаются из модели и форматируются в человекочитаемый текст.

**Алгоритм**:

```
ВХОД: GDDDataMapping, GDDGenerationInput

filled_sections = {}

FOR EACH section, mapping IN GDDDataMapping.active_mappings:
    IF mapping.auto_fill AND section_readiness[section].status == "ready":
        
        source_data = RESOLVE_SOURCE(mapping.source, input)
        
        // ===== Форматирование в зависимости от типа секции =====
        
        IF mapping.diagram:
            // Визуальная секция: генерация диаграммы
            diagram = GENERATE_DIAGRAM(section, source_data)
            // Типы диаграмм:
            // "core_loop"     → Круговая диаграмма Core Loop (шаги → ресурсы)
            // "progression"   → Графики кривых (XP, мощность, сложность)
            // "economy"       → Machinations-диаграмма (узлы → связи)
            // "tech_tree"     → Дерево разблокировок
            // "world"         → Карта мира / зон
            
            text = FORMAT_DIAGRAM_SECTION(section, source_data, diagram)
            filled_sections[section] = {
                content: text,
                diagram: diagram,
                source: mapping.source,
                auto_filled: true
            }
        
        ELIF mapping.tables:
            // Табличная секция: генерация таблиц баланса
            tables = GENERATE_TABLES(section, source_data)
            // Типы таблиц:
            // "balance"       → Стоимость × Мощность для каждого элемента
            // "resources"     → Ресурсы × Характеристики × Источники
            // "progression"   → Уровень → XP → Мощность → Стоимость
            // "monetization"  → LTV / CAC / ROAS формулы
            
            text = FORMAT_TABLE_SECTION(section, source_data, tables)
            filled_sections[section] = {
                content: text,
                tables: tables,
                source: mapping.source,
                auto_filled: true
            }
        
        ELIF mapping.formulas:
            // Секция с формулами: математические модели
            formulas = EXTRACT_FORMULAS(section, source_data)
            text = FORMAT_FORMULA_SECTION(section, source_data, formulas)
            filled_sections[section] = {
                content: text,
                formulas: formulas,
                source: mapping.source,
                auto_filled: true
            }
        
        ELSE:
            // Текстовая секция: прямое форматирование
            text = FORMAT_TEXT_SECTION(section, source_data)
            filled_sections[section] = {
                content: text,
                source: mapping.source,
                auto_filled: true
            }

ВЫХОД: AutoFilledSections = {
    sections: filled_sections,
    count: LEN(filled_sections),
    total_coverage: LEN(filled_sections) / LEN(GDDDataMapping.active_mappings)
}
```

**Форматирование текстовых секций — шаблоны**:

```
// Шаблон: Секция "Core Loop" (Блок 2)
CORE_LOOP_TEMPLATE = """
## Core Loop

### Основной игровой цикл

{coreLoop.description}

**Структурный тип**: {coreLoop.structural_type}
**Тип петель**: {coreLoop.loop_type}

#### Шаги Core Loop

| # | Действие | Механики | Ресурсы | Длительность |
|---|----------|----------|---------|-------------|
{FOR EACH step IN coreLoop.steps}
| {step.index} | {step.action} | {step.mechanics} | {step.resources} | {step.duration} |
{END FOR}

#### Иерархия петель

{coreLoop.hierarchy_diagram}

#### Диагностика

- Усиливающие петли: {coreLoop.reinforcing_loops}
- Балансирующие петли: {coreLoop.balancing_loops}
- Тормозящие механизмы: {coreLoop.braking_mechanisms}
- Риск runaway: {coreLoop.runaway_risk}
"""
```

### 3.7.6 Этап 4: AI-генерация содержания для секций, требующих обогащения

**Цель**: Заполнить секции GDD, для которых данных из Project State недостаточно и требуется AI-генерация. Это секции двух типов: (1) секции, где есть данные, но их нужно обогатить контекстом, обоснованием и описанием (ai_enrich); (2) секции, где данных нет вообще, и AI создаёт содержание с нуля (ai_generate).

**Алгоритм**:

```
ВХОД: GDDDataMapping, AutoFilledSections, GDDGenerationInput

ai_sections = {}

FOR EACH section, mapping IN GDDDataMapping.active_mappings:
    IF mapping.ai_enrich AND section IN AutoFilledSections.sections:
        // ===== Обогащение существующего содержания =====
        existing_content = AutoFilledSections.sections[section].content
        
        enriched = AI_ENRICH_SECTION(
            section=section,
            existing_content=existing_content,
            context={
                genre: input.concept.genre,
                aesthetics: input.mdaProfile.aestheticProfile,
                mechanics: input.mdaProfile.mechanicSet,
                core_loop: input.coreLoop,
                balance: input.balanceResult,
                progression: input.progressionProfile,
                economy: input.economyProfile
            },
            instructions=[
                "Добавь обоснования: почему приняты именно такие решения",
                "Укажи связь с теорией: какие фреймворки поддерживают решение",
                "Обеспечь связность с другими секциями GDD",
                "Используй профессиональную терминологию геймдизайна",
                "Цитируй источники: [Шелл, Линза #N], [Роджерс, стр. N]"
            ],
            detail_level=input.detailLevel
        )
        
        ai_sections[section] = {
            content: enriched,
            source: "auto_fill + ai_enrichment",
            auto_filled: true
        }
    
    ELIF mapping.ai_generate AND section_readiness[section].status == "ai_generatable":
        // ===== Генерация содержания с нуля =====
        generated = AI_GENERATE_SECTION(
            section=section,
            context={
                concept: input.concept,
                genre: input.concept.genre,
                aesthetics: input.mdaProfile.aestheticProfile,
                mechanics: input.mdaProfile.mechanicSet,
                core_loop: input.coreLoop,
                // Все доступные данные для контекста
            },
            instructions=GET_SECTION_INSTRUCTIONS(section),
            // Специфичные инструкции для каждой секции:
            // "characters" → "Создай 3-5 персонажей с мотивациями, арками, голосами"
            // "story" → "Создай 3-актную структуру с ключевыми поворотами"
            // "visual_style" → "Опиши визуальный стиль с промптами для генерации"
            // "sound_music" → "Опиши звуковой дизайн и музыкальные темы"
            detail_level=input.detailLevel
        )
        
        ai_sections[section] = {
            content: generated,
            source: "ai_generated",
            auto_filled: true,
            requires_review: true  // AI-генерированное содержание требует проверки
        }

ВЫХОД: AIGeneratedSections = {
    sections: ai_sections,
    enriched_count: COUNT(ai_sections WHERE source CONTAINS "enrichment"),
    generated_count: COUNT(ai_sections WHERE source == "ai_generated"),
    requires_review: ai_sections.filter(s => s.requires_review)
}
```

**AI-промпт-спецификации для генерации секций GDD**:

```
// Промпт: ENRICH_SECTION
SYSTEM: Ты — профессиональный геймдизайн-документалист. Обогати содержание 
секции GDD, добавив обоснования, связи с теорией геймдизайна и профессиональный 
контекст. Ссылайся на конкретные фреймворки: MDA (ЛеБланк), Линзы Шелла, 
Core Loop (Селлерс), Machinations (Адамс/Дорманс). Формат: Markdown. 
Уровень детализации: {detail_level}.

USER: Секция: {section_name}. Существующее содержание: {existing_content}. 
Контекст проекта: жанр={genre}, эстетика={aesthetics}, механики={mechanics}.

OUTPUT FORMAT: Markdown-текст секции с обоснованиями и ссылками

// Промпт: GENERATE_CHARACTERS_SECTION
SYSTEM: Ты — нарративный дизайнер. Создай описание персонажей для GDD. 
Для каждого персонажа укажи: имя, роль, мотивацию (внутренняя + внешняя), 
арку развития (3 акта), голос (стиль речи), ключевое противоречие, 
связь с механиками (какие механики отражают характер персонажа). 
Жанр: {genre}. Сеттинг: {setting}. Core Loop: {core_loop}.

OUTPUT FORMAT: JSON [{name, role, motivation, arc, voice, contradiction, mechanics_link}]

// Промпт: GENERATE_VISUAL_STYLE
SYSTEM: Ты — арт-директор. Создай описание визуального стиля игры для GDD. 
Включи: цветовую палитру (5 основных цветов с hex-кодами), стилистику 
(реализм/стилизация/пиксель-арт и т.д.), ключевые визуальные метафоры, 
референсы (3-5 игр/фильмов), промпты для AI-генерации концепт-артов.
Жанр: {genre}. Эстетика: {aesthetics}. Настроение: {mood}.

OUTPUT FORMAT: JSON {palette, style, metaphors, references, image_prompts[]}
```

### 3.7.7 Этап 5: Обработка секций с ручным вводом

**Цель**: Для секций, которые не могут быть заполнены автоматически (status == "manual_required"), сгенерировать структуру-скелет с подсказками, помогающими дизайнеру заполнить секцию качественно. Это не пустой шаблон, а интеллектуальная заготовка, которая направляет мысль дизайнера.

**Алгоритм**:

```
ВХОД: GDDDataMapping, GDDGenerationInput

manual_sections = {}

FOR EACH section, mapping IN GDDDataMapping.active_mappings:
    IF section_readiness[section].status == "manual_required" OR mapping.manual:
        
        // ===== Генерация скелета секции с подсказками =====
        skeleton = GENERATE_SECTION_SKELETON(
            section=section,
            context={
                genre: input.concept.genre,
                // Данные из уже заполненных секций для обеспечения связности
                filled_sections: MERGE(AutoFilledSections, AIGeneratedSections),
            },
            instructions=[
                "Создай структуру секции с заголовками и подзаголовками",
                "Для каждого подраздела добавь подсказку: что здесь описывать",
                "Добавь примеры из аналогичных жанров",
                "Укажи типичные ошибки при заполнении этой секции",
                "Добавь чек-лист: что должно быть обязательно"
            ]
        )
        
        // ===== Генерация AI-подсказок (Фуллертон, Кн. 5) =====
        // «Для этого раздела обычно описывают...»
        hints = AI_GENERATE_SECTION_HINTS(
            section=section,
            genre=input.concept.genre,
            best_practices=GET_BEST_PRACTICES(section)
        )
        
        manual_sections[section] = {
            skeleton: skeleton,
            hints: hints,
            status: "awaiting_manual_input",
            priority: DETERMINE_PRIORITY(section, GDDFormatSpec)
            // "critical" — секция необходима для понимания проекта
            // "important" — секция важна для производства
            // "optional" — секция желательна, но не обязательна
        }

ВЫХОД: ManualSections = {
    sections: manual_sections,
    critical_count: COUNT(manual_sections, s => s.priority == "critical"),
    important_count: COUNT(manual_sections, s => s.priority == "important"),
    optional_count: COUNT(manual_sections, s => s.priority == "optional")
}
```

**Таблица: Приоритеты секций, требующих ручного ввода**

| Секция | Приоритет | Обоснование | Что описывать |
|--------|----------|-------------|---------------|
| Лицензия / IP | Optional | Не для оригинальных проектов | IP-права, лицензионные обязательства |
| Управление | Important | Критично для прототипа | Схема управления, маппинг клавиш |
| Диалоги | Optional | Только для нарративных игр | Стиль диалогов, примеры |
| Меню и навигация | Important | Влияет на UX | Структура меню, навигационные потоки |
| Технические требования | Critical | Определяет реализуемость | Платформа, движок, производительность |
| Milestones и бюджет | Critical | Определяет жизнеспособность | Этапы, сроки, бюджет, команда |

### 3.7.8 Этап 6: Сшивка модулей и проверка согласованности

**Цель**: Объединить все заполненные секции в единый документ и проверить его на внутреннюю согласованность. Главная проблема GDD — не отсутствие информации, а её противоречивость: секция «Баланс» утверждает одно, секция «Прогрессия» — другое, а секция «Экономика» — третье. Алгоритм проверяет и устраняет такие расхождения.

**Алгоритм**:

```
ВХОД: AutoFilledSections, AIGeneratedSections, ManualSections, GDDGenerationInput

// ===== ШАГ 6.1: Сборка полного документа =====
all_sections = MERGE(
    AutoFilledSections.sections,
    AIGeneratedSections.sections,
    ManualSections.sections
)

// Порядок секций по формату
ordered_sections = ORDER_BY_FORMAT(all_sections, GDDFormatSpec.format)

// ===== ШАГ 6.2: Проверка согласованности между секциями =====
consistency_issues = []

// ПРОВЕРКА 2.1: Core Loop ↔ Механики
// Все механики из Core Loop должны присутствовать в секции «Механики»
core_loop_mechanics = EXTRACT_MECHANICS(all_sections["core_loop"])
section_mechanics = EXTRACT_MECHANICS(all_sections["mechanics"])
missing_in_mechanics = core_loop_mechanics - section_mechanics
IF missing_in_mechanics:
    consistency_issues.append({
        type: "mechanic_gap",
        severity: "warning",
        description: f"Механики из Core Loop не описаны в секции «Механики»: {missing_in_mechanics}",
        correction: "Добавить описания или удалить из Core Loop"
    })

// ПРОВЕРКА 2.2: Прогрессия ↔ Баланс
// Кривые прогрессии должны соответствовать заявленному балансу
progression_levels = all_sections["progression"].total_levels
balance_entries = all_sections["balance"].table_rows
IF progression_levels != LEN(balance_entries):
    consistency_issues.append({
        type: "level_mismatch",
        severity: "warning",
        description: f"Прогрессия: {progression_levels} уровней, Баланс: {LEN(balance_entries)} строк",
        correction: "Синхронизировать количество уровней"
    })

// ПРОВЕРКА 2.3: Экономика ↔ Монетизация
// Экономическая модель должна соответствовать модели монетизации
economy_model = all_sections["economy"].faucet_drain_ratio
monetization = all_sections["monetization"].model
IF monetization == "F2P" AND economy_model < 0.8:
    // F2P: faucet < drain (создание давления доната)
    ADD_INFO("F2P-модель: экономика создаёт давление покупки — корректно")
ELIF monetization == "Premium" AND economy_model < 0.9:
    consistency_issues.append({
        type: "economy_monetization_mismatch",
        severity: "warning",
        description: "Premium-игра с дефицитной экономикой — риск фрустрации",
        correction: "Увеличить faucet/drain ratio до ≥ 0.95"
    })

// ПРОВЕРКА 2.4: Нарратив ↔ Механики (лудонарративный диссонанс)
ludonarrative = CHECK_LUDONARRATIVE_CONSISTENCY(
    narrative=all_sections.get("story"),
    mechanics=all_sections["mechanics"],
    characters=all_sections.get("characters")
)
IF ludonarrative.dissonance_score > 0.5:
    consistency_issues.append({
        type: "ludonarrative_dissonance",
        severity: "critical",
        description: f"Лудонарративный диссонанс: {ludonarrative.description}",
        correction: ludonarrative.correction
    })

// ПРОВЕРКА 2.5: Целевая аудитория ↔ Контент
// Контент должен соответствовать возрастному рейтингу и аудитории
audience_content_check = CHECK_AUDIENCE_CONTENT_FIT(
    audience=all_sections["target_audience"],
    content=all_sections,
    genre=input.concept.genre
)
FOR EACH mismatch IN audience_content_check.mismatches:
    consistency_issues.append(mismatch)

// ===== ШАГ 6.3: Генерация перекрёстных ссылок =====
// Каждая секция должна ссылаться на связанные секции
cross_references = {}
FOR EACH section IN ordered_sections:
    related = FIND_RELATED_SECTIONS(section, all_sections)
    cross_references[section] = related
    // Добавить ссылки в конец секции:
    // "Связанные разделы: → Механики (разд. 9), → Баланс (разд. 12)"

// ===== ШАГ 6.4: Сводка полноты =====
completeness = {
    auto_filled: AutoFilledSections.count,
    ai_generated: AIGeneratedSections.generated_count,
    ai_enriched: AIGeneratedSections.enriched_count,
    manual_filled: COUNT(ManualSections.sections, s => s.status != "awaiting_manual_input"),
    manual_pending: COUNT(ManualSections.sections, s => s.status == "awaiting_manual_input"),
    total_sections: LEN(ordered_sections),
    completeness_percent: (auto_filled + ai_generated + ai_enriched + manual_filled) / LEN(ordered_sections) * 100
}

ВЫХОД: GDDAssembly = {
    sections: ordered_sections,
    consistency_issues: consistency_issues,
    cross_references: cross_references,
    completeness: completeness,
    structure_valid: LEN(FILTER(consistency_issues, i => i.severity == "critical")) == 0
}
```

### 3.7.9 Этап 7: Визуальное обогащение — диаграммы, графики, таблицы

**Цель**: Добавить визуальные элементы, которые делают GDD не просто текстом, а **инструментом коммуникации**. Роллингс/Моррис (Кн. 12): «Форма документации может быть любой — письменное изложение, эскизы, музыка, схемы, диаграммы — всё, что способствует донесению концепции». Gidede генерирует 5 типов визуальных элементов автоматически.

**Алгоритм**:

```
ВХОД: GDDAssembly, GDDGenerationInput

visual_elements = {}

// ===== ТИП 1: Core Loop Diagram =====
// Круговая диаграмма основного игрового цикла
core_loop_diagram = {
    type: "circular_flow",
    nodes: input.coreLoop.steps.map(step => ({
        id: step.index,
        label: step.action,
        mechanics: step.mechanics,
        resources: step.resources_consumed + " → " + step.resources_produced
    })),
    edges: input.coreLoop.steps.map((step, i) => ({
        from: step.index,
        to: input.coreLoop.steps[(i + 1) % LEN(input.coreLoop.steps)].index,
        label: step.resources_produced
    })),
    // Визуальные атрибуты
    color_scheme: DETERMINE_COLOR_SCHEME(input.mdaProfile.aestheticProfile),
    layout: "circular"
}
visual_elements["core_loop_diagram"] = core_loop_diagram

// ===== ТИП 2: Progression Curves =====
// Графики кривых прогрессии (XP, мощность, сложность, стоимость)
progression_chart = {
    type: "multi_line_chart",
    series: [
        { name: "XP к уровню", data: CALC_XP_CURVE(input.progressionProfile) },
        { name: "Мощность", data: CALC_POWER_CURVE(input.progressionProfile) },
        { name: "Стоимость", data: CALC_COST_CURVE(input.progressionProfile) },
        { name: "Воспринимаемая сложность", data: CALC_DIFFICULTY_CURVE(input.progressionProfile) }
    ],
    x_axis: { label: "Уровень", range: [1, input.progressionProfile.totalLevels] },
    y_axis: { label: "Значение", scale: "normalized" },
    tiers: input.progressionProfile.tierModel.tiers  // Визуальные границы этапов
}
visual_elements["progression_curves"] = progression_chart

// ===== ТИП 3: Economy Machinations =====
// Диаграмма Machinations (Кн. 4, Адамс/Дорманс)
machinations_diagram = BUILD_MACHINATIONS_VISUALIZATION(
    economyProfile=input.economyProfile,
    coreLoop=input.coreLoop,
    // Узлы: пулы (ресурсы), конвертеры (действия), источники (faucet), стоки (drain)
    // Связи: ресурсные потоки (активные/пассивные), триггеры, условия
)
visual_elements["economy_diagram"] = machinations_diagram

// ===== ТИП 4: Balance Table =====
// Таблица баланса: элементы × характеристики
IF input.detailLevel IN ["detailed", "exhaustive"]:
    balance_table = GENERATE_BALANCE_TABLE(
        balanceResult=input.balanceResult,
        format="comparison_matrix"
        // Строки: каждый игровой элемент (класс, оружие, враг)
        // Столбцы: характеристики (стоимость, мощность, скорость, дальность)
        // Цветовое кодирование: зелёный (сбалансировано), жёлтый (отклонение), красный (дисбаланс)
    )
    visual_elements["balance_table"] = balance_table

// ===== ТИП 5: Content Plan Timeline =====
// Визуализация контент-плана по уровням/этапам
content_timeline = {
    type: "gantt_chart",
    tasks: input.progressionProfile.contentPlan.tier_plans.map(tier => ({
        name: f"Этап {tier.tier_index}",
        start: tier.level_range[0],
        end: tier.level_range[1],
        milestones: tier.milestones,
        unlocks: tier.rewards.new_unlocks
    }))
}
visual_elements["content_timeline"] = content_timeline

ВЫХОД: GDDVisuals = {
    elements: visual_elements,
    count: LEN(visual_elements),
    formats: ["svg", "png", "embeddable_html"]
}
```

### 3.7.10 Этап 8: Форматирование и экспорт

**Цель**: Собрать финальный документ из всех компонентов (текст, визуалы, перекрёстные ссылки) и отформатировать для выбранного формата экспорта.

**Алгоритм**:

```
ВХОД: GDDAssembly, GDDVisuals, GDDFormatSpec

// ===== ШАГ 8.1: Сборка финального документа =====
document = {
    // Мета-данные
    meta: {
        title: f"GDD: {input.concept.title}",
        version: "1.0",
        generated_at: NOW(),
        format: GDDFormatSpec.format,
        detail_level: GDDFormatSpec.detail_level,
        completeness: GDDAssembly.completeness.completeness_percent,
        generator: "Gidede v1.0"
    },
    
    // Содержание (оглавление)
    table_of_contents: GENERATE_TOC(GDDAssembly.sections),
    
    // Секции
    sections: GDDAssembly.sections.map(section => ({
        heading: section.heading,
        content: section.content,
        visual: GDDVisuals.elements[section.name] ?? null,
        cross_refs: GDDAssembly.cross_references[section.name],
        status: section.status ?? "complete"
    })),
    
    // Приложения
    appendices: [
        { title: "Сводка валидации", content: GDDAssembly.consistency_issues },
        { title: "Источники", content: GENERATE_BIBLIOGRAPHY(GDDAssembly) },
        { title: "Глоссарий", content: GENERATE_GLOSSARY(GDDAssembly) }
    ]
}

// ===== ШАГ 8.2: Форматирование для конкретного формата =====
FOR EACH export_format IN GDDFormatSpec.export_formats:
    
    IF export_format == "pdf":
        // PDF: профессиональное форматирование с титульной страницей
        pdf_doc = FORMAT_AS_PDF(document, style={
            font: "Noto Serif SC",
            heading_font: "Noto Sans SC",
            page_size: "A4",
            margins: { top: 25, right: 20, bottom: 25, left: 20 },
            header: f"{input.concept.title} — GDD",
            footer: "Стр. {page} из {total}",
            table_of_contents: true,
            diagrams_as_full_page: true
        })
        EXPORT(pdf_doc, TO=f"/downloads/{input.concept.title}_GDD.pdf")
    
    ELIF export_format == "docx":
        // DOCX: редактируемый формат с комментариями
        docx_doc = FORMAT_AS_DOCX(document, style={
            track_changes: true,      // Отслеживать изменения
            comments: true,           // AI-комментарии к секциям
            sections_editable: true   // Все секции редактируемы
        })
        EXPORT(docx_doc, TO=f"/downloads/{input.concept.title}_GDD.docx")
    
    ELIF export_format == "md":
        // Markdown: для интеграции с GDCombine / Git
        md_doc = FORMAT_AS_MARKDOWN(document)
        EXPORT(md_doc, TO=f"/downloads/{input.concept.title}_GDD.md")
    
    ELIF export_format == "html":
        // HTML: интерактивный просмотр с навигацией
        html_doc = FORMAT_AS_HTML(document, interactive=true)
        EXPORT(html_doc, TO=f"/downloads/{input.concept.title}_GDD.html")

ВЫХОД: GDDOutput = {
    document: document,
    exports: GDDFormatSpec.export_formats,
    completeness: GDDAssembly.completeness,
    consistency_issues: GDDAssembly.consistency_issues,
    consistency_score: 1.0 - (LEN(critical_issues) * 0.2 + LEN(warnings) * 0.05),
    next_steps: [
        "Заполнить секции со статусом 'awaiting_manual_input'",
        "Проверить AI-сгенерированные секции",
        "Устранить критические проблемы согласованности",
        "Запустить чек-листы валидации (алгоритм 3.8)"
    ]
}
```

### 3.7.11 Итоговая сборка: GDD Profile

```typescript
interface GDDProfile {
    // Мета-данные
    format: GDDFormat;
    detailLevel: DetailLevel;
    targetAudience: DocAudience;
    generatedAt: Date;
    version: string;
    
    // Содержание
    sections: GDDSection[];
    visualElements: Record<string, VisualElement>;
    crossReferences: Record<string, string[]>;
    consistencyIssues: ConsistencyIssue[];
    
    // Метрики качества
    completeness: {
        totalSections: number;
        autoFilled: number;
        aiGenerated: number;
        manualFilled: number;
        manualPending: number;
        completenessPercent: number;
    };
    
    consistencyScore: number;           // 0-1
    coverageScore: number;              // 0-1 (покрытие данными из Project State)
    
    // Экспорт
    availableFormats: string[];
    exportedFiles: string[];
    
    // Связь с другими алгоритмами
    checklistInput: ChecklistInput;     // Данные для алгоритма 3.8
    projectStateUpdate: Partial<ProjectState>;  // Обратная связь в модель
    
    // Живая документация
    isLive: boolean;                    // True = автоматически обновляется при изменении модели
    lastSyncAt: Date;
    syncStatus: 'synced' | 'outdated' | 'conflict';
}
```

---

## 3.8 Алгоритм чек-листов и валидации геймдизайна

### 3.8.1 Обзор алгоритма

Алгоритм чек-листов и валидации реализует **Блок 6.3** (Чек-листы валидации) архитектуры Gidede и принимает на вход данные из всех предшествующих алгоритмов и сгенерированный GDD (3.7). Его задача — провести **систематическую, всестороннюю проверку** геймдизайна через набор формализованных чек-листов, каждый из которых сфокусирован на определённом аспекте качества. Валидация — не формальность, а инструмент выявления слепых зон: дизайнер без чек-листа проверяет то, что помнит, и пропускает то, что не помнит.

Ключевой принцип: **валидация — многоуровневый процесс, а не разовая проверка**. Шелл (Кн. 1) формулирует это через 113 линз — каждую игру нужно рассмотреть с 113 перспектив. Фуллертон (Кн. 5) добавляет итеративность: валидация встроена в каждый цикл Playcentric Design Process. Гэри (Кн. 10) подчёркивает: «Игры — не тест, а цикл. Каждая итерация должна валидироваться». Gidede реализует 6 типов чек-листов, каждый из которых можно применять на любой стадии проекта, с адаптивным выбором релевантных проверок.

Алгоритм состоит из 7 этапов. Этап 1 — подготовительный (определение области проверки). Этапы 2-5 — выполнение 4 основных чек-листов (MDA-чек, баланс-чек, нарратив-чек, экономика-чек). Этап 6 — агрегация результатов и приоритизация проблем. Этап 7 — генерация рекомендаций и план исправлений.

### 3.8.2 Входные данные

```typescript
interface ChecklistInput {
  // Обязательные поля
  concept: OnePager;                       // Из алгоритма 3.1
  coreLoop: CoreLoopProfile;               // Из алгоритма 3.2
  mdaProfile: MDAProfile;                  // Из алгоритма 3.3
  balanceResult: BalanceResult;            // Из алгоритма 3.4
  progressionProfile: ProgressionProfile;   // Из алгоритма 3.5
  economyProfile: EconomyProfile;           // Из алгоритма 3.6
  gddProfile?: GDDProfile;                 // Из алгоритма 3.7 (если GDD уже сгенерирован)
  
  // Параметры валидации
  checklistTypes?: ChecklistType[];         // Какие чек-листы запустить
  focusAreas?: FocusArea[];                // Области фокуса (если не всё)
  severityThreshold?: 'critical' | 'warning' | 'info';  // Порог серьёзности
  maxIssues?: number;                      // Максимум проблем в отчёте
  
  // Контекст
  projectStage?: ProjectStage;             // Стадия проекта
  previousValidation?: ValidationResult;   // Результаты предыдущей валидации
}

type ChecklistType = 
  | 'mda'                  // MDA-чек: полнота механика→динамика→эстетика
  | 'balance'              // Баланс-чек: 12 типов баланса
  | 'narrative'            // Нарратив-чек: диссонанс, агентивность, структура
  | 'economy'              // Экономика-чек: патологии, faucet/drain
  | 'lenses'               // 113 линз Шелла: адаптивный выбор
  | 'playtest';            // Плейтест-чек: 26 правил Фуллертон + RITE

type FocusArea = 
  | 'core_loop'            // Фокус на Core Loop
  | 'mechanics'            // Фокус на механиках
  | 'balance'              // Фокус на балансе
  | 'progression'          // Фокус на прогрессии
  | 'economy'              // Фокус на экономике
  | 'narrative'            // Фокус на нарративе
  | 'overall';             // Общая валидация

type ProjectStage = 
  | 'concept'              // Концепция (только 3.1)
  | 'prototype'            // Прототип (3.1-3.2)
  | 'preproduction'        // Препродакшен (3.1-3.4)
  | 'production'           // Продакшен (3.1-3.8)
  | 'live_ops';            // Живой сервис
```

### 3.8.3 Этап 1: Определение области валидации

**Цель**: На основе стадии проекта и фокуса определить, какие чек-листы запустить, какие проверки релевантны, а какие можно пропустить. Адаптивный подход (Шелл): не все 113 линз одинаково важны для каждой игры, и не все 12 типов баланса применимы к каждому жанру.

**Алгоритм**:

```
ВХОД: ChecklistInput

// ===== ШАГ 1.1: Определение релевантных чек-листов =====
IF input.checklistTypes IS PROVIDED:
    active_checklists = input.checklistTypes
ELSE:
    // Чек-листы, релевантные для данной стадии проекта
    stage_checklist_map = {
        "concept":       ["mda", "lenses"],                       // Концепция: MDA + Линзы
        "prototype":     ["mda", "balance", "lenses"],            // Прототип: + Баланс
        "preproduction": ["mda", "balance", "narrative", "economy", "lenses"],  // Препрод: + Нарратив + Экономика
        "production":    ["mda", "balance", "narrative", "economy", "lenses", "playtest"],  // Прод: все
        "live_ops":      ["balance", "economy", "playtest"]       // Live: баланс, экономика, плейтест
    }
    active_checklists = stage_checklist_map[input.projectStage] ?? ["mda", "balance", "lenses"]

// ===== ШАГ 1.2: Адаптивная фильтрация проверок =====
// Даже внутри чек-листа не все проверки релевантны
relevant_checks = {}

// Фильтрация по жанру
genre_filter = {
    "шутер": {
        "balance": ["transitive", "intransitive", "difficulty"],  // PvP-баланс критичен
        "narrative": [],                                          // Нарратив не приоритетен
        "lenses": [9, 11, 40, 41, 69, 96]                        // Релевантные линзы
    },
    "RPG": {
        "balance": ["transitive", "progression", "difficulty"],
        "narrative": ["dissension", "agency", "structure"],
        "lenses": [9, 11, 68, 83, 84, 85, 86]                    // Линзы мира и персонажей
    },
    "стратегия": {
        "balance": ["intransitive", "economy", "asymmetry"],
        "narrative": [],
        "lenses": [9, 30, 31, 40, 41, 102]                       // Линзы системности
    },
    "казуальная": {
        "balance": ["difficulty", "pacing"],
        "narrative": [],
        "lenses": [1, 4, 59, 60, 69]                              // Линзы опыта и интерфейса
    }
}

genre_checks = genre_filter[input.concept.genre] ?? DEFAULT_CHECKS

// ===== ШАГ 1.3: Определение глубины проверки =====
depth_map = {
    "concept":       "surface",          // Концепция: поверхностная проверка
    "prototype":     "standard",         // Прототип: стандартная
    "preproduction": "deep",             // Препрод: глубокая
    "production":    "exhaustive",       // Продакшен: исчерпывающая
    "live_ops":      "targeted"          // Live: целевая (только изменившиеся системы)
}

check_depth = depth_map[input.projectStage] ?? "standard"

ВЫХОД: ValidationScope = {
    active_checklists: active_checklists,
    genre_checks: genre_checks,
    depth: check_depth,
    focus_areas: input.focusAreas ?? ["overall"],
    estimated_checks: ESTIMATE_CHECK_COUNT(active_checklists, genre_checks, check_depth)
}
```

### 3.8.4 Этап 2: MDA-чек — проверка полноты механика→динамика→эстетика

**Цель**: Проверить, что набор механик полностью покрывает целевую эстетику, что каждая эстетика порождается достаточным числом динамик, и что каждая динамика обеспечена конкретными механиками. Это системная проверка MDA-цепочки, которая выявляет «слабые звенья» — эстетики без динамик, динамики без механик, механики без назначения.

**Алгоритм**:

```
ВХОД: MDAProfile, ValidationScope

issues = []
suggestions = []

// ===== ПРОВЕРКА 1: Покрытие эстетики =====
// Каждая целевая эстетика должна порождаться ≥2 динамиками
FOR EACH aesthetic IN [primary, secondary, tertiary]:
    serving_dynamics = mdaProfile.dynamicsTarget.filter(d => 
        d.aesthetics_served.contains(aesthetic)
    )
    serving_mechanics = mdaProfile.mechanicSet.filter(m =>
        m.aesthetics_served.contains(aesthetic)
    )
    
    IF LEN(serving_dynamics) == 0:
        issues.append({
            type: "aesthetic_orphan",
            severity: "critical",
            category: "mda",
            description: f"Эстетика '{aesthetic}' не имеет порождающих динамик",
            correction: f"Добавить динамики, порождающие '{aesthetic}' (см. таблицу Эстетика→Динамика)",
            affected_area: "concept"
        })
    ELIF LEN(serving_dynamics) == 1:
        issues.append({
            type: "aesthetic_fragile",
            severity: "warning",
            category: "mda",
            description: f"Эстетика '{aesthetic}' порождается только 1 динамикой — хрупкая связь",
            correction: f"Добавить ещё 1-2 динамики для устойчивости '{aesthetic}'",
            affected_area: "concept"
        })
    
    IF LEN(serving_mechanics) < 2:
        issues.append({
            type: "mechanic_insufficient",
            severity: "warning",
            category: "mda",
            description: f"Эстетика '{aesthetic}' обеспечена только {LEN(serving_mechanics)} механикой (рекомендуется ≥2)",
            correction: "Добавить механику, порождающую эту эстетику",
            affected_area: "mechanics"
        })

// ===== ПРОВЕРКА 2: Покрытие динамик =====
// Каждая целевая динамика должна поддерживаться ≥1 механикой
FOR EACH dynamic IN mdaProfile.dynamicsTarget.core_dynamics:
    supporting_mechanics = mdaProfile.mechanicSet.filter(m =>
        m.dynamics_coverage.contains(dynamic)
    )
    
    IF LEN(supporting_mechanics) == 0:
        issues.append({
            type: "dynamic_orphan",
            severity: "critical",
            category: "mda",
            description: f"Динамика '{dynamic}' не обеспечена ни одной механикой",
            correction: f"Добавить механику, поддерживающую динамику '{dynamic}'",
            affected_area: "mechanics"
        })

// ===== ПРОВЕРКА 3: Обратная MDA-валидация (Classic MDA) =====
// Сравнение целевой и предсказанной эстетики
FOR EACH target_aesthetic IN [primary, secondary, tertiary]:
    predicted_score = mdaProfile.predictedAesthetics[target_aesthetic] ?? 0
    IF predicted_score < 0.5:
        issues.append({
            type: "aesthetic_mismatch",
            severity: "warning",
            category: "mda",
            description: f"Целевая эстетика '{target_aesthetic}' предсказана с уверенностью {predicted_score:.2f} (порог 0.5)",
            correction: "Усилить механики, порождающие эту эстетику, или пересмотреть целевую",
            affected_area: "mechanics"
        })

// ===== ПРОВЕРКА 4: MDA-полнота по модели Зубека =====
// Каждый элемент уровня «механика» должен иметь выход на уровень «геймплей»
// Каждый элемент «геймплей» — на «опыт»
completeness_check = CHECK_MDA_COMPLETENESS(mdaProfile)
FOR EACH gap IN completeness_check.gaps:
    issues.append({
        type: "mda_gap",
        severity: "warning",
        category: "mda",
        description: f"Разрыв в MDA-цепочке: {gap.description}",
        correction: gap.correction,
        affected_area: gap.level  // "mechanics" | "dynamics" | "aesthetics"
    })

// ===== ПРОВЕРКА 5: Матрица 4×3 Бонда (Кн. 17) =====
// Горизонтальная согласованность: Механика ↔ История ↔ Эстетика ↔ Технология
bond_check = CHECK_BOND_CONSISTENCY(
    mechanics=mdaProfile.mechanicSet,
    narrative=concept.narrative,
    aesthetics=mdaProfile.aestheticProfile,
    tech=concept.tech
)
FOR EACH dissonance IN bond_check.dissonances:
    issues.append({
        type: "bond_dissonance",
        severity: dissonance.severity,
        category: "mda",
        description: f"Рассогласование: {dissonance.element_a} ↔ {dissonance.element_b}: {dissonance.reason}",
        correction: dissonance.correction,
        affected_area: "overall"
    })

ВЫХОД: MDACheckResult = {
    issues: issues,
    suggestions: suggestions,
    aesthetic_coverage: {
        primary: mdaProfile.predictedAesthetics[primary],
        secondary: mdaProfile.predictedAesthetics[secondary],
        tertiary: mdaProfile.predictedAesthetics[tertiary]
    },
    completeness_score: completeness_check.score,
    bond_consistency_score: bond_check.overall_score,
    overall_mda_score: CALC_MDA_SCORE(issues)
}
```

**Таблица: Типичные проблемы MDA-проверки и их решение**

| Проблема | Симптом | Решение | Пример |
|----------|---------|---------|--------|
| Эстетика-сирота | Эстетика заявлена, но не порождается | Добавить динамики и механики | «Фантазия» без ролевых механик |
| Хрупкая связь | 1 динамика → 1 эстетика | Дублировать路径 | «Вызов» только через сложность |
| MDA-разрыв | Механика не ведёт к опыту | Добавить промежуточную динамику | Крафт без ощущения прогрессии |
| Лудонарративный диссонанс | Механика противоречит нарративу | Согласовать или изменить | «Герой-миротворец» убивает 1000 врагов |

### 3.8.5 Этап 3: Баланс-чек — проверка 12 типов баланса

**Цель**: Провести систематическую проверку баланса игры по 12 типам, определённым в Библии геймдизайна (разд. 2.5). Баланс — не только «равенство сил», но и 12 различных аспектов, от транзитивного баланса до баланса времени и эмоционального баланса. Каждый тип имеет свои критерии и методы проверки.

**Алгоритм**:

```
ВХОД: BalanceResult, ValidationScope

issues = []
suggestions = []

// ===== ТИП 1: Транзитивный баланс (A > B > C) =====
// Шрайбер (Кн. 7): стоимость должна быть пропорциональна мощности
transitive_check = CHECK_TRANSITIVE_BALANCE(balanceResult)
FOR EACH element IN transitive_check.elements:
    cost_power_ratio = element.cost / element.power
    IF cost_power_ratio < 0.7:
        issues.append({
            type: "overpowered",
            severity: "warning",
            category: "balance",
            description: f"'{element.name}': соотношение стоимость/мощность = {cost_power_ratio:.2f} (среднее 1.0)",
            correction: "Увеличить стоимость или снизить мощность",
            affected_area: "balance"
        })
    ELIF cost_power_ratio > 1.5:
        issues.append({
            type: "underpowered",
            severity: "info",
            category: "balance",
            description: f"'{element.name}': соотношение стоимость/мощность = {cost_power_ratio:.2f} — слабый выбор",
            correction: "Снизить стоимость или увеличить мощность",
            affected_area: "balance"
        })

// ===== ТИП 2: Интранзитивный баланс (камень-ножницы-бумага) =====
// Проверка: каждый элемент должен иметь контр-элемент
IF balanceResult.has_intransitive:
    intransitive_check = CHECK_INTRANSITIVE_BALANCE(balanceResult)
    FOR EACH element IN intransitive_check.elements_without_counter:
        issues.append({
            type: "no_counter",
            severity: "critical",
            category: "balance",
            description: f"'{element.name}' не имеет контр-элемента — доминантная стратегия",
            correction: "Добавить элемент, контрящий '" + element.name + "'",
            affected_area: "balance"
        })

// ===== ТИП 3: Баланс сложности =====
// Кривая сложности должна создавать зону потока (Шрайбер)
difficulty_check = CHECK_DIFFICULTY_BALANCE(progressionProfile)
FOR EACH level, perceived_diff IN difficulty_check.perceived_difficulty:
    IF perceived_diff > 0.5:
        issues.append({
            type: "frustration_risk",
            severity: "warning" IF perceived_diff < 0.7 ELSE "critical",
            category: "balance",
            description: f"Уровень {level}: воспринимаемая сложность {perceived_diff:.2f} — риск фрустрации",
            correction: "Снизить сложность или усилить игрока",
            affected_area: "progression"
        })
    ELIF perceived_diff < -0.2:
        issues.append({
            type: "boredom_risk",
            severity: "info",
            category: "balance",
            description: f"Уровень {level}: воспринимаемая сложность {perceived_diff:.2f} — риск скуки",
            correction: "Увеличить вызов или ввести новую механику",
            affected_area: "progression"
        })

// ===== ТИП 4: Баланс прогрессии =====
// XP-кривая не должна создавать гринд (Шрайбер: >maxGrindTolerance повторений)
progression_check = CHECK_PROGRESSION_BALANCE(progressionProfile)
FOR EACH level, cycles_needed IN progression_check.cycles_per_level:
    max_grind = input.constraints?.maxGrindTolerance ?? 5
    IF cycles_needed > max_grind:
        issues.append({
            type: "grind",
            severity: "critical" IF cycles_needed > 10 ELSE "warning",
            category: "balance",
            description: f"Уровень {level}: {cycles_needed} циклов для перехода (макс. {max_grind})",
            correction: "Снизить XP-требование или увеличить XP-награду",
            affected_area: "progression"
        })

// ===== ТИП 5: Баланс экономики =====
// Faucet/drain ratio (Роллингс/Моррис: Q-фактор)
economy_check = CHECK_ECONOMY_BALANCE(economyProfile)
IF economy_check.runaway_risk:
    issues.append({
        type: "economic_runaway",
        severity: "critical",
        category: "balance",
        description: "Экономика имеет runaway-риск: усиливающие петли без торможения",
        correction: "Добавить Dynamic Friction, Stopping Mechanism или Attrition",
        affected_area: "economy"
    })
IF economy_check.deadlock_risk:
    issues.append({
        type: "economic_deadlock",
        severity: "critical",
        category: "balance",
        description: "Экономика имеет deadlock-риск: возможна ситуация нехватки ресурсов",
        correction: "Добавить альтернативные источники ресурсов или аварийные краны",
        affected_area: "economy"
    })

// ===== ТИПЫ 6-12: Дополнительные типы баланса =====
// (Выполняются только если check_depth == "exhaustive")
IF check_depth IN ["deep", "exhaustive"]:
    // ТИП 6: Баланс времени (продолжительность сессии)
    time_balance = CHECK_TIME_BALANCE(coreLoop, genre)
    // ТИП 7: Эмоциональный баланс (pacing — напряжение/расслабление)
    emotional_balance = CHECK_EMOTIONAL_BALANCE(progressionProfile.contentPlan)
    // ТИП 8: Баланс информации (асимметрия знаний)
    info_balance = CHECK_INFORMATION_BALANCE(mdaProfile.mechanicSet)
    // ТИП 9: Баланс риска/награды (треугольность)
    risk_balance = CHECK_RISK_REWARD_BALANCE(coreLoop, mdaProfile)
    // ТИП 10: Баланс билдов (разрыв между оптимальным и субоптимальным)
    build_balance = CHECK_BUILD_BALANCE(balanceResult, progressionProfile)
    // ТИП 11: Баланс фракций (для асимметричных игр)
    faction_balance = CHECK_FACTION_BALANCE(balanceResult)
    // ТИП 12: Баланс мета-игры (долгосрочная стратегическая глубина)
    meta_balance = CHECK_META_BALANCE(economyProfile, progressionProfile)

ВЫХОД: BalanceCheckResult = {
    issues: issues,
    suggestions: suggestions,
    balance_scores: {
        transitive: transitive_check.score,
        intransitive: intransitive_check?.score ?? "N/A",
        difficulty: difficulty_check.score,
        progression: progression_check.score,
        economy: economy_check.score,
        // Дополнительные — если deep/exhaustive
    },
    overall_balance_score: CALC_BALANCE_SCORE(issues, balance_scores)
}
```

### 3.8.6 Этап 4: Нарратив-чек — лудонарративный диссонанс, агентивность, структура

**Цель**: Проверить нарративный дизайн игры на три ключевых аспекта: (1) отсутствие лудонарративного диссонанса (механики и история сообщают одно и то же), (2) достаточную агентивность игрока в сюжете (выбор имеет последствия), (3) правильную структуру нарратива (драматическая арка работает). Проверка основана на 11 типах нарративной документации Андриановой/Яковлевой (Кн. 3) и валидаторе лудонарративного диссонанса.

**Алгоритм**:

```
ВХОД: ConceptInput, MDAProfile, ValidationScope

// Пропустить, если нарратив не приоритетен для жанра
IF genre NOT IN ["RPG", "adventure", "survival", "horror", "visual_novel"]:
    // Для не-нарративных жанров — сокращённая проверка
    IF NOT concept.narrative:
        OUTPUT NarrativeCheckResult = { issues: [], skipped: true, reason: "Не нарративный жанр" }

issues = []

// ===== ПРОВЕРКА 1: Лудонарративный диссонанс =====
// Андрианова/Яковлева (Кн. 3): 3 уровня согласованности
ludonarrative = AI_CHECK_LUDONARRATIVE(
    narrative_themes=concept.narrative?.themes,
    player_actions=coreLoop.steps.map(s => s.action),
    reward_system=economyProfile.reward_structure,
    punishment_system=economyProfile.punishment_structure,
    criteria=[
        "Действия игрока (механика) согласуются с характером персонажа (нарратив)?",
        "Награды и наказания поддерживают заявленную тему?",
        "Эмергентные стратегии соответствуют миру?",
        "Тон механики совпадает с тоном истории?",
        "Цели игры (механика) совпадают с целями протагониста (нарратив)?"
    ]
)

IF ludonarrative.result == "Диссонанс":
    FOR EACH dissonance IN ludonarrative.dissonances:
        issues.append({
            type: "ludonarrative_dissonance",
            severity: "critical",
            category: "narrative",
            description: f"Диссонанс: {dissonance.mechanic} противоречит {dissonance.narrative_element}",
            correction: dissonance.correction,
            affected_area: "narrative"
        })
ELIF ludonarrative.result == "Ирония":
    issues.append({
        type: "ludonarrative_irony",
        severity: "info",
        category: "narrative",
        description: f"Ирония: {ludonarrative.description} (может быть намеренной)",
        correction: "Убедитесь, что ирония — осознанный дизайнерский выбор",
        affected_area: "narrative"
    })

// ===== ПРОВЕРКА 2: Агентивность игрока =====
// Выбор игрока должен иметь последствия
agency_check = CHECK_PLAYER_AGENCY(
    choices=concept.narrative?.choices,
    consequences=concept.narrative?.consequences,
    branching=concept.narrative?.branching,
    criteria=[
        "Каждый значимый выбор имеет ≥2 исхода",
        "Последствия видны игроку (не только внутренний флаг)",
        "Нет 'фальшивых выборов' (один исход под разными словами)",
        "Выбор отражает ценности/характер персонажа, а не только оптимизацию",
        "Нарративные ветви не все ведут к одному结局 (если не заявлено как фича)"
    ]
)

FOR EACH agency_gap IN agency_check.gaps:
    issues.append({
        type: "agency_gap",
        severity: "warning",
        category: "narrative",
        description: agency_gap.description,
        correction: agency_gap.correction,
        affected_area: "narrative"
    })

// ===== ПРОВЕРКА 3: Структура нарратива =====
// 3-актная структура + драматическая арка
structure_check = CHECK_NARRATIVE_STRUCTURE(
    story=concept.narrative?.story,
    arcs=concept.narrative?.character_arcs,
    criteria=[
        "Есть экспозиция (мир, персонажи, ставки)",
        "Есть конфликт (противостояние, препятствия)",
        "Есть кульминация (максимальное напряжение)",
        "Есть разрешение (развязка, последствия)",
        "Драматическая арка нарастает (не плато)",
        "Повороты сюжета обоснованы (не deus ex machina)"
    ]
)

FOR EACH structure_issue IN structure_check.issues:
    issues.append({
        type: "narrative_structure",
        severity: "warning",
        category: "narrative",
        description: structure_issue,
        correction: structure_issue.correction,
        affected_area: "narrative"
    })

// ===== ПРОВЕРКА 4: Квестовая матрица =====
// Андрианова/Яковлева: 8 типов × 4 паттерна = 32 комбинации
// Проверяем: используются ли разнообразные типы квестов
quest_variety = CHECK_QUEST_VARIETY(concept.narrative?.quests)
IF quest_variety.unique_types < 3:
    issues.append({
        type: "quest_monotony",
        severity: "info",
        category: "narrative",
        description: f"Только {quest_variety.unique_types} типов квестов из 8 возможных",
        correction: "Разнообразить типы квестов (исследование, эскорт, защита, загадка...)",
        affected_area: "narrative"
    })

ВЫХОД: NarrativeCheckResult = {
    issues: issues,
    ludonarrative_result: ludonarrative.result,  // Гармония / Ирония / Диссонанс
    agency_score: agency_check.score,
    structure_score: structure_check.score,
    quest_variety_score: quest_variety.score,
    overall_narrative_score: CALC_NARRATIVE_SCORE(issues)
}
```

### 3.8.7 Этап 5: Экономика-чек — патологии, faucet/drain, стабильность

**Цель**: Провести глубокую проверку экономической модели на типичные патологии, выявленные в Кн. 4 (Адамс/Дорманс — Machinations), Кн. 7 (Шрайбер — runaway), Кн. 12 (Роллингс/Моррис — Q-фактор, SPS) и Кн. 13 (Селлерс — Engines/Economies/Ecologies). Экономика — самая сложная система в игре, и её патологии часто неочевидны до поздних стадий разработки.

**Алгоритм**:

```
ВХОД: EconomyProfile, CoreLoopProfile, ValidationScope

issues = []

// ===== ПРОВЕРКА 1: Runaway (неограниченный рост) =====
// Адамс/Дорманс: чистый двигатель без торможения → exponential runaway
IF coreLoop.structural_type == "engine" AND NOT coreLoop.has_braking:
    issues.append({
        type: "runaway_risk",
        severity: "critical",
        category: "economy",
        description: "Core Loop — чистый двигатель без тормозящего механизма. " +
                     "Усиливающая петля приведёт к неограниченному росту",
        correction: "Добавить: Dynamic Friction (убывающая отдача), " +
                    "Stopping Mechanism (потолки), или Attrition (нарастающие расходы)",
        affected_area: "economy"
    })

// Проверка через симуляцию Machinations
machinations_sim = SIMULATE_MACHINATIONS(economyProfile.machinations_model, ticks=5000)
IF machinations_sim.runaway_detected:
    issues.append({
        type: "runaway_confirmed",
        severity: "critical",
        category: "economy",
        description: f"Симуляция: runaway обнаружен на тике {machinations_sim.runaway_tick}. " +
                     f"Ресурс '{machinations_sim.runaway_resource}' растёт экспоненциально",
        correction: machinations_sim.runaway_correction,
        affected_area: "economy"
    })

// ===== ПРОВЕРКА 2: Deadlock (тупик) =====
// Роллингс/Моррис: SPS (Static Performance Summary) — невозможность продолжить
IF machinations_sim.deadlock_detected:
    issues.append({
        type: "deadlock_confirmed",
        severity: "critical",
        category: "economy",
        description: f"Симуляция: deadlock на тике {machinations_sim.deadlock_tick}. " +
                     f"Ресурс '{machinations_sim.deadlock_resource}' исчерпан",
        correction: "Добавить альтернативный источник ресурса или аварийный кран",
        affected_area: "economy"
    })

// ===== ПРОВЕРКА 3: Faucet/Drain баланс =====
// Роллингс/Моррис: Q-фактор = faucet / drain
FOR EACH resource IN economyProfile.resources:
    q_factor = resource.faucet_rate / resource.drain_rate
    
    IF q_factor > 1.5:
        // Ресурс накапливается — инфляция
        issues.append({
            type: "resource_inflation",
            severity: "warning",
            category: "economy",
            description: f"Ресурс '{resource.name}': Q-фактор = {q_factor:.2f} (накопление). " +
                         f"Игрок будет тонуть в избытке",
            correction: "Увеличить drain (расходы) или уменьшить faucet (доходы)",
            affected_area: "economy"
        })
    ELIF q_factor < 0.7:
        // Ресурс истощается — дефицит
        issues.append({
            type: "resource_scarcity",
            severity: "warning",
            category: "economy",
            description: f"Ресурс '{resource.name}': Q-фактор = {q_factor:.2f} (дефицит). " +
                         f"Игрок будет испытывать хроническую нехватку",
            correction: "Увеличить faucet (доходы) или уменьшить drain (расходы)",
            affected_area: "economy"
        })

// ===== ПРОВЕРКА 4: Статическая vs динамическая стабильность =====
// Селлерс: стабильная ли экономика при разных стратегиях игрока?
stability_test = TEST_ECONOMIC_STABILITY(
    economyProfile,
    strategies=["optimal", "greedy", "conservative", "random"],
    ticks=10000
)
FOR EACH strategy, result IN stability_test:
    IF NOT result.stable:
        issues.append({
            type: "economic_instability",
            severity: "warning",
            category: "economy",
            description: f"Экономика нестабильна при стратегии '{strategy}': {result.pathology}",
            correction: result.correction,
            affected_area: "economy"
        })

// ===== ПРОВЕРКА 5: Прибыльность циклов (Зубек) =====
// Каждый цикл конверсии должен быть прибыльным, но не чрезмерно
FOR EACH chain IN economyProfile.conversion_chains:
    profitability = chain.output_value / chain.input_value
    IF profitability > 2.0:
        issues.append({
            type: "excessive_profitability",
            severity: "warning",
            category: "economy",
            description: f"Цикл конверсии '{chain.name}': прибыльность {profitability:.2f}x — доминантная стратегия",
            correction: "Добавить трение: расход на поддержку, убывающая отдача, кулдауны",
            affected_area: "economy"
        })
    ELIF profitability < 0.8:
        issues.append({
            type: "unprofitable_cycle",
            severity: "warning",
            category: "economy",
            description: f"Цикл конверсии '{chain.name}': прибыльность {profitability:.2f}x — не стоит использовать",
            correction: "Увеличить выход или снизить входные затраты",
            affected_area: "economy"
        })

ВЫХОД: EconomyCheckResult = {
    issues: issues,
    machinations_simulation: machinations_sim,
    q_factors: economyProfile.resources.map(r => ({ name: r.name, q: r.faucet_rate / r.drain_rate })),
    stability_test: stability_test,
    overall_economy_score: CALC_ECONOMY_SCORE(issues)
}
```

**Таблица: Типичные экономические патологии и их решения**

| Патология | Симптом | Причина | Решение | Источник |
|-----------|---------|---------|---------|----------|
| Runaway | Ресурс растёт экспоненциально | Усиливающая петля без торможения | Dynamic Friction / Stopping Mechanism | Кн. 4, 7, 13 |
| Deadlock | Невозможно продолжить | Исчерпание критического ресурса | Альтернативные источники / аварийные краны | Кн. 12 |
| Инфляция | Избыток ресурсов, всё дешёвое | Q-фактор > 1.5 | Увеличить drain | Кн. 12 |
| Дефицит | Хроническая нехватка | Q-фактор < 0.7 | Увеличить faucet | Кн. 12 |
| Доминантная стратегия | Один цикл выгоднее всех | Прибыльность > 2.0 | Трение / убывающая отдача | Кн. 6 |
| Мёртвый цикл | Никто не использует | Прибыльность < 0.8 | Усилить выход | Кн. 6 |

### 3.8.8 Этап 6: Линзы Шелла — адаптивный мега-чек-лист

**Цель**: Применить релевантные линзы из 113 линз Шелла (Кн. 1) для выявления проблем, которые не покрывают специализированные чек-листы. Линзы Шелла — самый универсальный инструмент валидации, потому что каждая линза — это перспектива, через которую дизайнер рассматривает свою игру. AI выбирает релевантные линзы на основе жанра, эстетики и проблем, обнаруженных на предыдущих этапах.

**Алгоритм**:

```
ВХОД: MDAProfile, ConceptInput, ValidationScope, все предыдущие CheckResults

// ===== ШАГ 6.1: Выбор релевантных линз =====
// Не все 113 линз нужны для каждой игры
relevant_lenses = []

// Базовые линзы (всегда применяются)
base_lenses = [1, 9, 11, 12]  // Опыт, Тетрада, Единство, Резонанс
relevant_lenses = relevant_lenses + base_lenses

// Жанровые линзы
genre_lenses_map = {
    "шутер":       [40, 41, 69, 96, 97],             // Треугольность, Доминантная стратегия, Кривая интереса, Социальные
    "RPG":         [68, 83, 84, 85, 86, 87],         // Интерес, Персонажи, Мир
    "стратегия":   [30, 31, 40, 41, 102],            // Эмерджентность, Пространство действий, Системность
    "казуальная":  [1, 4, 59, 60, 69],               // Опыт, Сюрприз, Интерфейс, Кривая интереса
    "survival":    [30, 31, 68, 83, 92, 93],         // Эмерджентность, Интерес, Среда
    "MMO":         [96, 97, 98, 99, 100, 101],       // Социальные, Команда
    "horror":      [68, 74, 75, 76],                  // Интерес, Свобода, Простота
    "roguelike":   [30, 31, 40, 54, 55]              // Эмерджентность, Головоломки, Баланс
}
relevant_lenses = relevant_lenses + (genre_lenses_map[genre] ?? [])

// Линзы, продиктованные обнаруженными проблемами
IF "runaway_risk" IN previous_issues:
    relevant_lenses += [37, 38, 39]  // Справедливость, Баланс,challenge
IF "ludonarrative_dissonance" IN previous_issues:
    relevant_lenses += [68, 69, 75]  // Интерес, Кривая, Простота
IF "grind" IN previous_issues:
    relevant_lenses += [69, 74]      // Кривая интереса, Свобода

// Устранение дубликатов
relevant_lenses = DEDUPLICATE(relevant_lenses)

// ===== ШАГ 6.2: Применение каждой линзы =====
lens_results = []
FOR EACH lens_id IN relevant_lenses:
    lens = LENSES_DB[lens_id]  // 113 линз из Кн. 1
    
    result = AI_APPLY_LENS(
        lens=lens,
        context={
            concept: concept,
            coreLoop: coreLoop,
            mdaProfile: mdaProfile,
            balanceResult: balanceResult,
            progressionProfile: progressionProfile,
            economyProfile: economyProfile,
            previous_issues: issues_from_previous_checks
        },
        output_format={
            "lens_id": lens_id,
            "lens_name": lens.name,
            "key_question": lens.question,
            "answer": "string",
            "score": "0.0-1.0",
            "issues": ["string"],
            "suggestions": ["string"]
        }
    )
    lens_results.append(result)

// ===== ШАГ 6.3: Агрегация =====
critical_lenses = lens_results.filter(r => r.score < 0.4)
warning_lenses = lens_results.filter(r => r.score >= 0.4 AND r.score < 0.7)
passed_lenses = lens_results.filter(r => r.score >= 0.7)

FOR EACH result IN critical_lenses:
    issues.append({
        type: "lens_critical",
        severity: "critical",
        category: "lenses",
        description: f"Линза #{result.lens_id} '{result.lens_name}': {result.key_question}",
        answer: result.answer,
        correction: result.suggestions.join("; "),
        affected_area: LENS_AREA_MAP[result.lens_id]
    })

ВЫХОД: LensCheckResult = {
    applied_lenses: relevant_lenses,
    results: lens_results,
    critical_count: LEN(critical_lenses),
    warning_count: LEN(warning_lenses),
    passed_count: LEN(passed_lenses),
    overall_lens_score: AVERAGE(lens_results.map(r => r.score))
}
```

**Таблица: Приоритетные линзы по типам проблем**

| Обнаруженная проблема | Релевантные линзы | Фокус |
|-----------------------|-------------------|-------|
| Runaway-риск | #37 Справедливость, #38 Вызов, #39 Выбор | Баланс усиливающих петель |
| Лудонарративный диссонанс | #68 Интерес, #69 Кривая интереса, #75 Простота | Согласованность механики и истории |
| Гринд | #69 Кривая интереса, #74 Свобода vs Управляемость | Pacing и агентивность |
| Пустые уровни | #4 Сюрприз, #69 Кривая интереса | Контент-наполненность |
| Слабые синергии | #9 Тетрада, #11 Единство, #12 Резонанс | Целостность системы |
| Доминантная стратегия | #40 Треугольность, #41 Доминантная стратегия | Осмысленность выбора |

### 3.8.9 Этап 7: Агрегация результатов, приоритизация и план исправлений

**Цель**: Объединить результаты всех чек-листов в единый валидационный отчёт, приоритизировать проблемы по серьёзности и влиянию, и сгенерировать конкретный план исправлений с оценкой трудозатрат.

**Алгоритм**:

```
ВХОД: MDACheckResult, BalanceCheckResult, NarrativeCheckResult, EconomyCheckResult, LensCheckResult

// ===== ШАГ 7.1: Объединение всех проблем =====
all_issues = MERGE(
    MDACheckResult.issues,
    BalanceCheckResult.issues,
    NarrativeCheckResult.issues,
    EconomyCheckResult.issues,
    LensCheckResult.issues
)

// ===== ШАГ 7.2: Дедупликация =====
// Одна и та же проблема может быть обнаружена разными чек-листами
deduplicated = []
FOR EACH issue IN all_issues:
    is_duplicate = false
    FOR EACH existing IN deduplicated:
        IF SIMILARITY(issue.description, existing.description) > 0.8:
            // Объединить: повысить серьёзность, если разные чек-листы согласны
            existing.detected_by.append(issue.category)
            IF issue.severity == "critical" AND existing.severity != "critical":
                existing.severity = "critical"
            is_duplicate = true
            BREAK
    IF NOT is_duplicate:
        issue.detected_by = [issue.category]
        deduplicated.append(issue)

all_issues = deduplicated

// ===== ШАГ 7.3: Приоритизация =====
// Критерии: серьёзность × количество обнаруживших чек-листов × влияние на опыт
FOR EACH issue IN all_issues:
    severity_weight = { "critical": 3, "warning": 2, "info": 1 }[issue.severity]
    detection_bonus = LEN(issue.detected_by)  // Обнаружено несколькими чек-листами — достовернее
    experience_impact = ESTIMATE_EXPERIENCE_IMPACT(issue, mdaProfile.aestheticProfile)
    
    issue.priority_score = severity_weight * detection_bonus * experience_impact

sorted_issues = SORT(all_issues, BY=priority_score, DESC)

// ===== ШАГ 7.4: Группировка по областям =====
grouped_issues = GROUP_BY(sorted_issues, key=affected_area)
// Группы: "concept", "mechanics", "balance", "progression", "economy", "narrative", "overall"

// ===== ШАГ 7.5: Генерация плана исправлений =====
remediation_plan = []
FOR EACH issue IN sorted_issues:
    remediation = {
        issue: issue,
        correction: issue.correction,
        estimated_effort: ESTIMATE_EFFORT(issue),
        // "low"    — изменение параметра (5-30 мин)
        // "medium" — добавление механики/системы (1-4 часа)
        // "high"   — переработка системы (4-40 часов)
        affected_algorithms: DETERMINE_AFFECTED_ALGORITHMS(issue),
        // Какие алгоритмы нужно перезапустить после исправления
        dependencies: FIND_DEPENDENT_ISSUES(issue, sorted_issues),
        // Какие другие проблемы зависят от этой
        suggested_order: DETERMINE_ORDER(issue, sorted_issues)
    }
    remediation_plan.append(remediation)

// ===== ШАГ 7.6: Сводные метрики =====
summary = {
    total_issues: LEN(sorted_issues),
    critical: LEN(sorted_issues.filter(i => i.severity == "critical")),
    warning: LEN(sorted_issues.filter(i => i.severity == "warning")),
    info: LEN(sorted_issues.filter(i => i.severity == "info")),
    
    by_category: {
        mda: LEN(sorted_issues.filter(i => i.category == "mda")),
        balance: LEN(sorted_issues.filter(i => i.category == "balance")),
        narrative: LEN(sorted_issues.filter(i => i.category == "narrative")),
        economy: LEN(sorted_issues.filter(i => i.category == "economy")),
        lenses: LEN(sorted_issues.filter(i => i.category == "lenses"))
    },
    
    by_area: COUNT_BY(sorted_issues, i => i.affected_area),
    
    overall_score: CALC_OVERALL_VALIDATION_SCORE(sorted_issues),
    // 0-100: 90+ = отличный дизайн, 70-89 = хороший, 50-69 = приемлемый, <50 = требует доработки
    
    readiness_for_production: ASSESS_PRODUCTION_READINESS(sorted_issues),
    // "ready" / "nearly_ready" / "needs_work" / "not_ready"
    
    estimated_remediation_effort: SUM(remediation_plan.map(r => r.estimated_effort))
}

ВЫХОД: ValidationResult = {
    summary: summary,
    issues: sorted_issues,
    grouped_issues: grouped_issues,
    remediation_plan: remediation_plan,
    
    // Детальные результаты по чек-листам
    mda_check: MDACheckResult,
    balance_check: BalanceCheckResult,
    narrative_check: NarrativeCheckResult,
    economy_check: EconomyCheckResult,
    lens_check: LensCheckResult,
    
    // Рекомендации
    top_priority_issues: sorted_issues[:5],
    quick_wins: sorted_issues.filter(i => i.severity != "critical" AND ESTIMATE_EFFORT(i) == "low"),
    critical_path: BUILD_CRITICAL_PATH(sorted_issues, remediation_plan),
    
    // Связь с другими алгоритмами
    gdd_update_needed: LEN(sorted_issues.filter(i => i.severity IN ["critical", "warning"])) > 0,
    revalidation_recommended: LEN(sorted_issues.filter(i => i.severity == "critical")) > 0
}
```

**Таблица: Шкала оценки валидации**

| Балл | Статус | Описание | Действие |
|------|--------|----------|----------|
| 90-100 | Отлично | Минимальные проблемы, дизайн целостен | Можно переходить к разработке |
| 70-89 | Хорошо | Есть предупреждения, но не критичные | Исправить warnings перед производством |
| 50-69 | Приемлемо | Есть критичные проблемы в неключевых системах | Обязательные исправления перед прототипом |
| 30-49 | Требует доработки | Критичные проблемы в ключевых системах | Существенная переработка дизайна |
| 0-29 | Не готов | Фундаментальные проблемы | Вернуться к пересмотру концепции |

### 3.8.10 Итоговая сборка: Validation Profile

```typescript
interface ValidationProfile {
    // Мета-данные
    validatedAt: Date;
    projectStage: ProjectStage;
    checklistsRun: ChecklistType[];
    depth: string;
    
    // Сводные метрики
    overallScore: number;                  // 0-100
    readinessLevel: string;                // ready / nearly_ready / needs_work / not_ready
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
    
    // Детальные результаты
    mdaCheck: MDACheckResult;
    balanceCheck: BalanceCheckResult;
    narrativeCheck: NarrativeCheckResult;
    economyCheck: EconomyCheckResult;
    lensCheck: LensCheckResult;
    
    // План исправлений
    remediationPlan: RemediationItem[];
    topPriorityIssues: Issue[];
    quickWins: Issue[];
    criticalPath: CriticalPathStep[];
    
    // Связь с другими алгоритмами
    gddUpdateRequired: boolean;
    revalidationRequired: boolean;
    affectedAlgorithms: string[];           // Какие алгоритмы нужно перезапустить
    
    // Тренды (если есть предыдущие валидации)
    previousScore?: number;
    scoreDelta?: number;                    // Изменение относительно прошлой валидации
    improvementAreas: string[];             // Области, где улучшилось
    regressionAreas: string[];              // Области, где ухудшилось
}
```

### 3.8.11 AI-промпт-спецификации для алгоритма 3.8

#### Промпт CHECK_LUDONARRATIVE

```
SYSTEM: Ты — эксперт по нарративному дизайну игр. Проверь согласованность 
механик и нарратива на предмет лудонарративного диссонанса. Лудонарративный 
диссонанс возникает, когда механика игры (правила, действия, награды) 
противоречит заявленному нарративу (история, тема, характер персонажа). 
Три уровня: Гармония (механика и нарратив усиливают друг друга), Ирония 
(противоречие намеренное, создаёт эффект), Диссонанс (противоречие 
ненамеренное, разрушает погружение). Учитывай жанр: {genre}.

USER: Темы нарратива: {narrative_themes}. Действия игрока: {player_actions}. 
Награды: {reward_system}. Наказания: {punishment_system}.

OUTPUT FORMAT: JSON {
    "result": "Гармония|Ирония|Диссонанс",
    "dissonances": [{"mechanic": "...", "narrative_element": "...", "reason": "...", "correction": "..."}],
    "harmonies": [{"mechanic": "...", "narrative_element": "...", "reason": "..."}]
}
```

#### Промпт APPLY_LENS

```
SYSTEM: Ты — геймдизайн-ревьюер, применяющий Линзу #{lens_id} «{lens_name}» 
из книги Джесси Шелла «Геймдизайн. Как создать игры, которые нельзя оторвать». 
Ключевой вопрос этой линзы: {lens_question}. Рассмотри проект игры через эту 
линзу и оцени, насколько хорошо дизайн отвечает на вопрос линзы. Будь конкретен: 
укажи, что именно работает, что — нет, и предложи конкретные улучшения.

USER: Концепция: {concept}. Core Loop: {core_loop}. Механики: {mechanics}. 
Баланс: {balance_summary}. Экономика: {economy_summary}. 
Обнаруженные проблемы: {previous_issues}.

OUTPUT FORMAT: JSON {
    "lens_id": number,
    "lens_name": "string",
    "key_question": "string",
    "answer": "string (2-5 предложений)",
    "score": 0.0-1.0,
    "issues": ["string"],
    "suggestions": ["string"]
}
```

#### Промпт CHECK_PLAYER_AGENCY

```
SYSTEM: Ты — эксперт по интерактивному нарративу. Оцени уровень агентивности 
(agency) игрока в нарративном дизайне. Агентивность — ощущение игрока, что 
его выбор значим и имеет последствия. Проверь: (1) Каждый ли выбор имеет 
видимые последствия? (2) Есть ли «фальшивые выборы» (разные слова, один 
исход)? (3) Отражает ли выбор ценности персонажа, а не только оптимизацию? 
(4) Есть ли нарративные ветви, а не одна линия? (5) Есть ли долгосрочные 
последствия ранних выборов?

USER: Выборы: {choices}. Последствия: {consequences}. Ветвление: {branching}. 
Жанр: {genre}.

OUTPUT FORMAT: JSON {
    "score": 0.0-1.0,
    "gaps": [{"description": "...", "correction": "..."}],
    "strengths": ["..."],
    "false_choices": ["..."]
}
```

#### Промпт GENERATE_REMEDIATION

```
SYSTEM: Ты — опытный геймдизайн-продюсер. На основе списка выявленных проблем 
создай конкретный план исправлений. Для каждой проблемы укажи: что именно 
нужно сделать, сколько времени это займёт, какие ещё системы затронет, и в 
каком порядке лучше исправлять. Приоритизируй: критичные проблемы первыми, 
затем те, которые блокируют другие исправления.

USER: Проблемы: {sorted_issues}. Текущий дизайн: {design_summary}. 
Ограничения: {constraints}.

OUTPUT FORMAT: JSON [{
    "issue_id": "string",
    "action": "string",
    "effort": "low|medium|high",
    "hours_estimate": number,
    "affected_systems": ["string"],
    "blocking_issues": ["issue_ids"],
    "order": number
}]
```

---

## Связь алгоритмов 3.7 и 3.8 с общей архитектурой

### Поток данных

```
Алгоритм 3.1 (Концепция) ──┐
Алгоритм 3.2 (Core Loop) ──┤
Алгоритм 3.3 (MDA) ────────┤
Алгоритм 3.4 (Баланс) ─────┼──→ Project State ──┬──→ 3.7 (GDD Generator) ──→ GDD Profile
Алгоритм 3.5 (Прогрессия) ─┤                   │
Алгоритм 3.6 (Экономика) ──┘                   └──→ 3.8 (Валидация) ──→ Validation Profile
                                                        │
                                                        ▼
                                                   GDD Update (если валидация нашла проблемы)
                                                        │
                                                        ▼
                                                   Re-validation (цикл до готовности)
```

### Обратная связь

Валидация (3.8) может выявить проблемы, требующие возврата к предшествующим алгоритмам. Типичные циклы обратной связи:

| Проблема валидации | Возврат к | Типичное исправление |
|-------------------|-----------|---------------------|
| Эстетика-сирота | 3.3 (MDA) | Добавить механику, порождающую эстетику |
| Runaway-риск | 3.2 (Core Loop) | Добавить тормозящий механизм |
| Гринд | 3.5 (Прогрессия) | Скорректировать XP-кривую |
| Экономический дисбаланс | 3.6 (Экономика) | Отрегулировать faucet/drain |
| Лудонарративный диссонанс | 3.1 (Концепция) | Согласовать нарратив и механику |
| Доминантная стратегия | 3.4 (Баланс) | Ввести интранзитивные контры |

### Следующие шаги (алгоритмы 3.9 и 3.10)

Алгоритм 3.9 (Спецификация AI-prompts) соберёт все AI-промпты из алгоритмов 3.1–3.8 в единую спецификацию для реализации. Алгоритм 3.10 (Итоговая спецификация) объединит все 8 алгоритмов в финальный документ, готовый к передаче в Фазу 4 (Разработка).
