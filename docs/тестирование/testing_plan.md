# Gidede — Комплексный план тестирования

> **Фаза**: 4.E (Интеграция и полировка — Блок 8)
> **Дата**: 2026-05-20
> **Версия**: 0.41.0
> **Статус**: Активный
> **Подход**: Локальное тестирование + CI/CD (GitHub Actions)

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика и через CI/CD пайплайн (GitHub Actions: `.github/workflows/ci.yml`). Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.5), Core Loop Designer (4.B.6–4.B.8), MDA Lab (4.B.9–4.B.11), сквозной пайплайн (4.B.12), баланс и симуляцию (4.C.1–4.C.4), прогрессию (4.C.5), экономику (4.C.6–4.C.7), UI экономики и прогрессии (4.C.8), сквозной пайплайн Блоков 1–5 (4.C.9), интеграционные тесты полного пайплайна (4.C.10), GDD-генерацию (4.D.1–4.D.3), Checklist-валидацию GDD (4.D.4), UI GDD Generator (4.D.5), AI-ассистент backend (4.D.6–4.D.7), UI AI-ассистент (4.D.8), интеграцию GBCombine — Блок 8.

### 1.1 Уровни тестирования

| Уровень | Инструмент | Покрытие | Автоматизация |
|---------|-----------|----------|---------------|
| Unit-тесты (backend) | pytest | Сервисы, утилиты, модели, валидаторы | Полная |
| Unit-тесты (frontend) | vitest + React Testing Library | Компоненты, хуки, утилиты | Полная |
| API-тесты (backend) | pytest + httpx | Все REST-эндпоинты | Полная |
| Интеграционные тесты | pytest | AI-сервис, RAG, Redis, полный пайплайн | Частичная (с моками) |
| UI-тесты (ручные) | Браузер | Страницы, формы, навигация, валидация | Ручная |
| E2E-тесты | Браузер | Полные пользовательские сценарии | Ручная |

### 1.2 Команды запуска

```bash
# Все тесты
./scripts/run_tests.sh

# Только backend
./scripts/run_tests.sh backend

# Только frontend
./scripts/run_tests.sh frontend

# Только линтеры
./scripts/run_tests.sh lint

# С покрытием кода
./scripts/run_tests.sh coverage

# Backend: pytest напрямую
cd mini-services/api-service
python -m pytest tests/ -v
python -m pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend: vitest напрямую
npx vitest run
npx vitest run --coverage
npx vitest --ui   # Интерактивный UI

# Линтеры
ruff check app/ tests/     # Python
npx eslint src/            # TypeScript
```

---

## 2. Автоматизированные программные тесты (Backend — pytest)

### 2.0 Сводная таблица

**Итого: 684 теста в 21 файле**

```
mini-services/api-service/tests/
├── conftest.py                    # Общие фикстуры
├── test_health.py                 # Health check API (2 теста)
├── test_auth.py                   # Авторизация (6 тестов)
├── test_projects.py               # CRUD проектов (4 теста)
├── test_rag_service.py            # RAG-сервис (12 тестов)
├── test_prompt_registry.py        # Реестр промптов (8 тестов)
├── test_text_chunker.py           # Разбиение текста на чанки (6 тестов)
├── test_balance_service.py        # Balance Service (77 тестов)
├── test_economy_service.py        # Economy Service (83 теста)
├── test_gdd_service.py            # GDD Service Stages 1-5 (108 тестов)
├── test_gdd_stages_6_8.py         # GDD Service Stages 6-8 (32 теста)
├── test_pipeline_service.py       # Pipeline Service (31 тест)
├── test_checklist_service.py      # Checklist Service (95 тестов)
├── test_ai_assistant_service.py   # AI Assistant Service (60 тестов)
├── test_ai_assistant_api.py       # AI Assistant API (20 тестов)
├── test_pipeline_4d9_integration.py  # Pipeline Integration Blocks 6-7 (60 тестов)
├── test_blocks_6_7_integration.py # Blocks 6-7 Testing & Debugging (42 теста)
├── test_gbe_bridge_service.py     # GBE Bridge Service — Block 8 (70 тестов)
└── integration/
    └── test_full_pipeline.py      # Интеграционные тесты (28 тестов)
```

---

### 2.1 Инфраструктура (4.A)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-01 | `test_health_endpoint` | API отвечает на health check | test_health.py |
| B-02 | `test_health_detailed` | Health check возвращает версию и детали | test_health.py |

---

### 2.2 Авторизация (4.A.5)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-03 | `test_register_user` | Регистрация нового пользователя | test_auth.py |
| B-04 | `test_register_duplicate_email` | Отклонение дублирующего email | test_auth.py |
| B-05 | `test_login_success` | Успешный логин с верными данными | test_auth.py |
| B-06 | `test_login_wrong_password` | Отклонение неверного пароля | test_auth.py |
| B-07 | `test_protected_endpoint_without_token` | Блокировка доступа без авторизации | test_auth.py |
| B-08 | `test_protected_endpoint_with_invalid_token` | Отклонение невалидного JWT-токена | test_auth.py |

---

### 2.3 Проекты (4.A.6)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-09 | `test_create_project` | Создание проекта | test_projects.py |
| B-10 | `test_list_projects` | Список проектов пользователя | test_projects.py |
| B-11 | `test_create_project_without_auth` | Создание проекта без авторизации отклоняется | test_projects.py |
| B-12 | `test_project_isolation` | Изоляция проектов между пользователями | test_projects.py |

---

### 2.4 Реестр промптов (4.A.8)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-13 | `test_registry_not_empty` | Реестр не пустой | test_prompt_registry.py |
| B-14 | `test_all_31_prompts_registered` | Все 31 промпт в реестре | test_prompt_registry.py |
| B-15 | `test_get_prompt_spec_existing` | Получение существующего PromptSpec | test_prompt_registry.py |
| B-16 | `test_get_prompt_spec_nonexistent` | 404 при запросе несуществующего промпта | test_prompt_registry.py |
| B-17 | `test_prompt_spec_has_required_fields` | Структура PromptSpec: id, module, inputs, outputSchema | test_prompt_registry.py |
| B-18 | `test_get_prompts_by_module` | Фильтрация промптов по модулю | test_prompt_registry.py |
| B-19 | `test_registry_stats` | Статистика реестра | test_prompt_registry.py |
| B-20 | `test_known_prompt_ids` | Проверка известных ID промптов | test_prompt_registry.py |

---

### 2.5 RAG-сервис (4.A.10)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-21 | `test_short_text_single_chunk` | Короткий текст → 1 чанк | test_rag_service.py |
| B-22 | `test_long_text_multiple_chunks` | Длинный текст → несколько чанков | test_rag_service.py |
| B-23 | `test_header_splitting` | Разбиение по заголовкам | test_rag_service.py |
| B-24 | `test_chunk_metadata` | Метаданные чанков | test_rag_service.py |
| B-25 | `test_empty_text` | Пустой текст → graceful | test_rag_service.py |
| B-26 | `test_whitespace_only_text` | Текст из пробелов → graceful | test_rag_service.py |
| B-27 | `test_chunk_indices_sequential` | Последовательные индексы чанков | test_rag_service.py |
| B-28 | `test_empty_result` | Пустой RAG-результат | test_rag_service.py |
| B-29 | `test_result_with_chunks` | RAG-результат с чанками | test_rag_service.py |
| B-30 | `test_max_tokens_limit` | Лимит токенов в RAG-результате | test_rag_service.py |
| B-31 | `test_search_with_rag_disabled` | Поиск при отключённом RAG | test_rag_service.py |
| B-32 | `test_rag_stats` | Статистика RAG-сервиса | test_rag_service.py |

---

### 2.6 TextChunker (4.A.10)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-33 | `test_very_long_paragraph` | Очень длинный абзац | test_text_chunker.py |
| B-34 | `test_russian_text` | Текст на русском | test_text_chunker.py |
| B-35 | `test_mixed_headers` | Смешанные заголовки | test_text_chunker.py |
| B-36 | `test_code_blocks` | Блоки кода в тексте | test_text_chunker.py |
| B-37 | `test_token_estimation` | Оценка количества токенов | test_text_chunker.py |
| B-38 | `test_source_type_preserved` | Сохранение типа источника | test_text_chunker.py |

---

### 2.7 Balance Service (4.C.1–4.C.3) — 77 тестов

| Категория | Количество тестов | Описание |
|-----------|-------------------|----------|
| Классификация задачи (PvP/PvE/PvPvE) | 3 | test_classify_balance_task_pvp/pve/pvpve |
| Transitive-анализ | 8 | Cost/power кривые, anchor-объект, веса атрибутов, overpowered/underpowered, ideal_imbalance, cost_curve_identity |
| Анализ стабильности | 3 | stable, runaway, deadlock |
| Intransitive-анализ | 7 | Payoff-матрица, Nash Equilibrium, RPS-детекция, доминантная стратегия, warnings/suggestions |
| Ситуационный баланс | 7 | Контекстная ценность, situation probabilities, versatility, EV calculation, switching cost, dead zones |
| Q-фактор | 6 | Базовый, dominant_attributes, redundant_objects, attribute_dominance, Q_matrix_normalization, warnings |
| Полный пайплайн балансировки | 7 | Full pipeline, stages_completed, with_intransitive, with_situational, with_qfactor, all_stages, with_mda |
| API-эндпоинты баланса | 5 | transitive, intransitive, situational, qfactor, analyze |
| Вспомогательные функции | 6 | least_squares_weights, solve_linear_system, calculate_power, calculate_effective_cost, get_threshold, generate_warnings/suggestions |
| Monte Carlo-симуляция | 8 | basic, imbalanced, config, spearman_correlation, verdict_good/poor, matchup_matrix, number_format |
| Machinations-симуляция | 8 | build_graph_basic/with_resources/economic_type/patterns/feedback_loops, simulate_basic/stability/quality_assessment |

---

### 2.8 Economy Service (4.C.6) — 83 теста

**Stage 1: Идентификация ресурсов (3.6.3) — 15 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-01 | `test_identify_resources_rpg` | RPG: HP, XP, Золото как core-ресурсы |
| ECO-02 | `test_identify_resources_strategy` | Strategy: Минералы, Территория, Технологии |
| ECO-03 | `test_identify_resources_survival` | Survival: Голод, Здоровье, Материалы |
| ECO-04 | `test_identify_resources_from_core_loop` | Извлечение ресурсов из CoreLoop шагов |
| ECO-05 | `test_identify_resources_anchor` | Anchor resource по жанру |
| ECO-06 | `test_identify_resources_classification` | Классификация по Schreiber |
| ECO-07 | `test_identify_resources_consumable_flags` | is_consumable флаги |
| ECO-08 | `test_identify_resources_catalytic_flags` | is_catalytic флаги |
| ECO-09 | `test_identify_resources_core_count` | core_count по жанру |
| ECO-10 | `test_identify_resources_class_distribution` | class_distribution |
| ECO-11 | `test_identify_resources_custom` | AI-ресурсы объединяются с эвристическими |
| ECO-12 | `test_identify_resources_no_genre` | Fallback при неизвестном жанре |
| ECO-13 | `test_identify_resources_ai_fallback` | Fallback при ошибке AI |
| ECO-14 | `test_identify_resources_max_resources` | Ограничение количества ресурсов |
| ECO-15 | `test_identify_resources_initial_values` | Начальные значения по классу |

**Stage 2: Классификация экономики — 16 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-16 | `test_classify_rpg_engine` | RPG → Engine |
| ECO-17 | `test_classify_strategy_economy` | Strategy → Economy |
| ECO-18 | `test_classify_survival_ecology` | Survival → Ecology |
| ECO-19 | `test_classify_sub_type_braked_engine` | Braked Engine подтип |
| ECO-20 | `test_classify_sub_type_pure_engine` | Pure Engine подтип |
| ECO-21 | `test_classify_sub_type_multi_currency` | Multi-currency подтип |
| ECO-22 | `test_classify_sub_type_single_currency` | Single-currency подтип |
| ECO-23 | `test_classify_dominant_loop_reinforcing` | Reinforcing доминантная петля |
| ECO-24 | `test_classify_dominant_loop_balancing` | Balancing доминантная петля |
| ECO-25 | `test_classify_interaction_type_conversion` | Conversion тип взаимодействия |
| ECO-26 | `test_classify_interaction_type_single` | Single тип взаимодействия |
| ECO-27 | `test_classify_interaction_type_exchange` | Exchange тип взаимодействия |
| ECO-28 | `test_classify_openness` | Уровень открытости экономики |
| ECO-29 | `test_classify_pricing_type` | Pricing type (premium) |
| ECO-30 | `test_classify_pricing_type_f2p` | Pricing type (free-to-play) |
| ECO-31 | `test_classify_risk_level` | Вычисление risk_level |

**Stage 3: Machinations-модель — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-32 | `test_build_machinations_has_pools` | Machinations: наличие Pool-узлов |
| ECO-33 | `test_build_machinations_has_sources` | Наличие Source-узлов |
| ECO-34 | `test_build_machinations_has_drains` | Наличие Drain-узлов |
| ECO-35 | `test_build_machinations_has_converters` | Наличие Converter-узлов |
| ECO-36 | `test_build_machinations_has_flows` | Наличие resource flows |
| ECO-37 | `test_build_machinations_has_state_connections` | Наличие state connections |
| ECO-38 | `test_build_machinations_has_feedback_loops` | Обнаружение feedback loops |
| ECO-39 | `test_build_machinations_node_count` | Корректное количество узлов |
| ECO-40 | `test_build_machinations_trader` | Trader-узлы |
| ECO-41 | `test_build_machinations_gate` | Gate-узлы |

**Stage 4: Граф конверсий — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-42 | `test_build_conversion_graph_basic` | Базовый граф конверсий |
| ECO-43 | `test_build_conversion_graph_profitability` | Прибыльность конверсий |
| ECO-44 | `test_build_conversion_graph_grind_risk` | Grind-риск |
| ECO-45 | `test_build_conversion_graph_frustration_risk` | Frustration-риск |
| ECO-46 | `test_build_conversion_graph_tier_coverage` | Покрытие по tier |
| ECO-47 | `test_build_conversion_graph_default` | Дефолтный граф |
| ECO-48 | `test_build_conversion_graph_avg_profitability` | Средняя прибыльность |
| ECO-49 | `test_build_conversion_graph_suggestions` | Рекомендации по конверсиям |

**Stage 5: Диагностика экономики — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-50 | `test_diagnose_runaway` | Обнаружение runaway |
| ECO-51 | `test_diagnose_stall` | Обнаружение stall |
| ECO-52 | `test_diagnose_inflation` | Обнаружение инфляции |
| ECO-53 | `test_diagnose_stagnation` | Обнаружение стагнации |
| ECO-54 | `test_diagnose_arbitrage` | Обнаружение арбитража |
| ECO-55 | `test_diagnose_healthy` | Здоровая экономика → нет патологий |
| ECO-56 | `test_diagnose_severity_critical` | Critical severity |
| ECO-57 | `test_diagnose_severity_warning` | Warning severity |
| ECO-58 | `test_diagnose_faucet_drain_ratios` | Faucet/drain ratios |
| ECO-59 | `test_diagnose_recommendations` | Рекомендации по исправлению |

**Stage 6: Балансировка faucets/drains — 6+ тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-60 | `test_balance_deficit` | Балансировка при дефиците |
| ECO-61 | `test_balance_surplus` | Балансировка при избытке |
| ECO-62 | `test_balance_balanced` | Сбалансированная экономика без изменений |
| ECO-63 | `test_balance_economy_phase_startup` | Startup фаза экономики |
| ECO-64 | + доп. тесты балансировки | Балансировка по фазам, итерации |

**Полный Economy Pipeline — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-80 | `test_full_economy_pipeline` | Все 7 этапов последовательно, EconomyProfile заполнен |
| ECO-81 | `test_economy_pipeline_with_balance_issues` | Pipeline с обнаружением и исправлением патологий |
| ECO-82 | `test_economy_pipeline_partial_data` | Pipeline с частичными данными, warnings |
| ECO-83 | `test_economy_pipeline_latency` | Полный pipeline < 10000ms для mock AI |

---

### 2.9 GDD Service (4.D.1–4.D.3) — 108 + 32 = 140 тестов

**Stage 1: Определение формата GDD (3.7.3) — 22 теста**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Явный формат | 6 | one_sheet, full_gdd, treatment, sketch_design, concept_doc, narrative_bible |
| Audience→format | 5 | investor→treatment, production→full_gdd, personal→modular, team_sync→sketch_design, educational→ten_pager |
| Stage→format | 4 | concept→one_sheet, prototype→ten_pager, production→full_gdd, live_ops→modular |
| Detail level по жанру | 3 | rpg→detailed, mmorpg→exhaustive, puzzle→overview |
| Приоритеты и дефолты | 4 | explicit > audience > stage, default=full_gdd, default detail=standard |

**Stage 2: Маппинг Project State → секции GDD (3.7.4) — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Секции по формату | 4 | full_gdd=38, one_sheet=6, ten_pager, modular |
| Готовность с данными | 2 | concept present → title ready, no data → manual_required |
| Покрытие | 2 | all blocks → high coverage, no data → 0 coverage |
| Классификация секций | 4 | auto_fillable, manual, ai_generatable, source fields |

**Stage 3: Автозаполнение секций (3.7.5) — 16 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Автозаполнение из блоков | 8 | title←concept, core_loop, mechanics, progression, economy, balance, resources, logline |
| Пустые данные | 1 | no data → no auto-filled sections |
| Флаги и доп. данные | 4 | requires_review, diagram, tables, formulas |
| Modular-секции | 3 | concept_overview, mda_analysis, balance_tables |

**Stages 1-3 Pipeline + Edge Cases — 27 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Pipeline 1-3 | 4 | stages_completed, coverage, one_sheet pipeline, no-data pipeline |
| Pipeline 1-5+ | 6 | Все 5+ этапов, GDDProfile, full data, coverage increase, latency, graceful |
| Метрики | 2 | latency_ms, coverage_score |
| Оценка страниц | 2 | full_gdd+detailed=75, mmorpg+exhaustive=125 |
| Edge Cases | 13 | Composite sources, missing subpath, custom sections, export_formats, detail override, unknown genre fallback |

**Stages 6-8: Сшивка, форматирование, экспорт — 32 теста**

| Категория | Количество | Описание |
|-----------|------------|----------|
| assemble_gdd: слияние секций | 3 | Слияние из auto_filled, ai_enriched, manual; приоритет ai_enrich > auto_fill > manual |
| assemble_gdd: флаги и метрики | 4 | source labels, has_diagram/has_tables/has_formulas, coverage_score, section_order |
| assemble_gdd: пустой профиль | 1 | 0 filled sections, coverage 0.0 |
| validate_consistency: отчёт | 1 | Возвращает ConsistencyReport с issues |
| validate_consistency: core_loop ↔ mechanics | 1 | Обнаружение ошибки при отсутствии core_loop с mechanics |
| validate_consistency: data gaps | 1 | Info-замечания при отсутствии парных секций |
| validate_consistency: narrative ↔ mechanics | 1 | Warning при конфликте нарратива и механик |
| validate_consistency: is_valid | 2 | True без errors, False с errors |
| validate_consistency: checks_all_pairs | 1 | Проверка всех пар |
| Markdown-генерация | 3 | Title из concept, оглавление, нумерация секций |
| Метрики документа | 2 | word_count, estimated_pages (250 слов/страница) |
| Edge cases форматирования | 2 | Пустой документ, section_count совпадает |
| MD-экспорт | 1 | text/markdown content, .md file_name |
| HTML-экспорт | 1 | HTML с CSS-стилями |
| PDF-экспорт | 1 | WeasyPrint или fallback на HTML |
| DOCX-экспорт | 1 | python-docx или graceful failure |
| content_type / file_name | 2 | Корректные MIME-типы и имена файлов |
| Пустой документ экспорт | 1 | Обработка пустого содержимого |
| Полный пайплайн 1-8 | 4 | stages_completed 1-7, high coverage, assembled_document, formatted_document |

---

### 2.10 Pipeline Service (4.C.9) — 31 тест

**Подготовка входных данных для Блока 4 — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-01 | `test_balance_input_with_all_blocks` | Все блоки заполнены — полные данные |
| PIPE-02 | `test_balance_input_missing_concept` | Нет концепции — предупреждение |
| PIPE-03 | `test_balance_input_missing_core_loop` | Нет Core Loop — предупреждение о циклах |
| PIPE-04 | `test_balance_input_missing_mda` | Нет MDA — предупреждение о механиках |

**Подготовка входных данных для Блока 5 — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-05 | `test_full_input_with_all_blocks` | Все 4 блока заполнены |
| PIPE-06 | `test_progression_input_extracts_resources` | Ресурсы извлекаются из CoreLoop шагов |
| PIPE-07 | `test_progression_input_with_existing_progression` | Связь прогрессии с экономикой |
| PIPE-08 | `test_missing_all_previous_blocks` | 4 предупреждения при пустых блоках |

**Зависимости и STALE_DOWNSTREAM — 6 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-09 | `test_block_1_stale_downstream` | Блок 1 → stale Блоки 2-8 |
| PIPE-10 | `test_block_4_stale_downstream` | Блок 4 → stale Блоки 5, 6, 8 |
| PIPE-11 | `test_block_5_stale_downstream` | Блок 5 → stale Блоки 6, 8 |
| PIPE-12 | `test_block_dependencies_chain` | Цепочка 1→2→3→4→5 |
| PIPE-13 | `test_all_blocks_have_events` | Блоки 1-6 генерируют события |
| PIPE-14 | `test_block_5_event_is_progression` | Событие Блока 5 — progression |

**Уведомления и stale-механика — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-15 | `test_notify_block_4_marks_5_6_8_stale` | Обновление Блока 4 → stale 5, 6, 8 |
| PIPE-16 | `test_notify_block_1_marks_many_stale` | Обновление Блока 1 → 7 stale-блоков |
| PIPE-17 | `test_notify_unknown_block_ignored` | Неизвестный блок не генерирует событий |
| PIPE-18 | `test_clear_stale_no_redis` | Без Redis clear_stale всегда успешен |

**Модели данных — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-19 | `test_block_progress_to_dict` | Сериализация BlockProgress |
| PIPE-20 | `test_pipeline_state_to_dict` | Сериализация PipelineState |
| PIPE-21 | `test_block_status_values` | Все 4 статуса корректны |
| PIPE-22 | `test_pipeline_event_values` | Все события пайплайна |

**Flag Key Mapping — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-23 | `test_all_blocks_mapped` | Маппинг block_id → флаг для всех 8 блоков |
| PIPE-24 | `test_block_5_flag_is_progression` | Флаг Блока 5 — progression |
| PIPE-25 | `test_block_4_flag_is_balance` | Флаг Блока 4 — balance |

**Уведомления — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-26 | `test_stale_block_5_notification` | Stale Блок 5 → уведомление |
| PIPE-27 | `test_no_notifications_for_completed` | Завершённые блоки не генерируют уведомлений |
| PIPE-28 | `test_multiple_stale_blocks` | Несколько stale → несколько уведомлений |

**Определение следующего блока — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-29 | `test_first_empty_block` | Первый пустой блок — следующий |
| PIPE-30 | `test_stale_block_when_all_filled` | Все заполнены, но stale → первый stale |
| PIPE-31 | `test_all_good_returns_none` | Все OK → None |

---

### 2.11 Checklist Service (4.D.4) — 95 тестов

**TestDefineScope — 11 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Выбор чеклиста по этапу | 5 | concept, prototype, preproduction, production, live_ops |
| Явные переопределения | 3 | explicit_checklist > stage, genre_specific_checks, depth_by_stage |
| Оценка и дефолты | 3 | estimated_checks, focus_areas, unknown_stage_default |

**TestMDACheck — 11 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip при отсутствии данных | 1 | Нет MDA-профиля → skip |
| Aesthetic orphan | 1 | Эстетика без динамики → warning |
| Dynamic orphan | 1 | Динамика без механики → warning |
| MDA-пробелы | 2 | aesthetics < 3 → gap, mechanics < 3 → gap |
| Bond dissonance | 1 | Конфликт Bond-матрицы → error |
| Полный профиль — скоринг | 2 | Full profile → score > 0.7, high_score |
| Проверки покрытия | 2 | aesthetic_coverage, completeness_calculation |
| Граничные случаи | 1 | empty_aesthetics_graceful |

**TestBalanceCheck — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip при отсутствии данных | 1 | Нет balance_result → skip |
| Overpowered/Underpowered | 2 | >20% overpowered → error, underpowered → info |
| Доминантная стратегия | 1 | dominant_strategy → critical |
| Grind | 1 | grind_pattern → warning |
| Difficulty wall | 1 | difficulty_wall → error |
| Empty levels | 1 | empty_levels → warning |
| Scores | 1 | scores_calculation |
| Depth-фильтрация | 2 | surface, exhaustive |
| Economy from economy pathologies | 1 | economy_pathologies |
| Overall score | 1 | overall_score_calculation |

**TestNarrativeCheck — 10 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip для не-нарративных | 2 | puzzle → skip, rpg → run |
| Ludonarrative dissonance | 1 | narrative↔mechanics конфликт → error |
| Ludonarrative irony | 1 | intentional irony → info |
| Ludonarrative harmony | 1 | harmony → pass |
| AI failure | 1 | graceful_fallback |
| Agency gaps | 1 | agency_gap → warning |
| Структура нарратива | 1 | missing_components → warning |
| Quest variety | 1 | too_few → warning |
| Full data | 1 | higher_score |

**TestEconomyCheck — 10 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip при отсутствии данных | 1 | Нет economy_profile → skip |
| Runaway | 2 | runaway_from_pathologies, runaway_risk_field |
| Deadlock | 1 | deadlock_detection |
| Q-factor | 3 | inflation → warning, scarcity → warning, balanced → pass |
| Profitability | 2 | excessive, unprofitable |
| No pathologies | 1 | high_score |

**TestLensCheck — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Base lenses | 1 | Минимум 4 линзы |
| Genre-specific | 1 | rpg→narrative_lens, strategy→balance_lens |
| Score severity | 3 | critical, warning, passed |
| Problem-driven | 1 | issues→подбор линз по проблемам |
| AI fallback | 1 | AI-ошибка → fallback |
| Max 20 lenses | 1 | >20 проблем → ограничение до 20 |

**TestAggregation — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Слияние issues | 2 | Объединение, нет потерь |
| Дедупликация | 2 | Одинаковые → одна, похожие → группировка |
| Повышение severity | 2 | duplicate → error, triplicate → critical |
| Приоритетная сортировка | 2 | critical первые |
| Top-5 / Quick wins | 2 | top-5 критических, quick_wins |
| Score 0-100 / Readiness | 2 | score computation, readiness levels |

**TestFullPipeline — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Все блоки | 1 | Все checks запущены |
| Нет данных | 1 | score=100 |
| Concept-only | 1 | Частичные checks |
| Конкретные типы | 1 | only_check_types |
| Отслеживание этапов | 1 | stages_completed |
| Latency | 1 | latency_ms < 5000ms |

**TestEdgeCases — 14 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| max_issues | 2 | >100 → обрезка до 100 |
| Пустая концепция | 2 | empty → warning, None → error |
| None values | 2 | mda=None, balance=None → skip |
| Q-factor edge cases | 4 | Q=0.0, Q=1.0, Q<0, Q>1 |
| Remediation plan | 4 | critical, warning, info, empty |

---

### 2.12 AI Assistant Service (4.D.6–4.D.7) — 60 тестов

**build_assistant_context() — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Контекст из Project State | 4 | full_project_state, empty_project_state, partial_concept_only, blocks_1_through_5 |
| Токен-лимит | 2 | token_limit_truncation, preserves_genre |
| RAG | 2 | rag_included_when_genre, rag_disabled |

**manage_session() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Создание сессии | 3 | create_new_session, get_or_create_existing, duplicate_create |
| Управление сессией | 3 | clear_session, session_ttl, session_key_format |

**add_message_and_get_history() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Добавление сообщений | 2 | add_user_message, add_assistant_message |
| История | 2 | chronological, history_limit |
| Граничные случаи | 2 | empty_history, message_truncation |

**search_knowledge() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| RAG-поиск | 4 | success, empty_result, failure_graceful, calls_rag_service |
| Параметры | 2 | max_tokens_parameter, import_error_graceful |

**check_proactive_alerts() — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Нет алертов | 2 | empty_state, stable_economy |
| Economy alerts | 3 | runaway, deadlock, all_blocks_filled |
| Balance alerts | 2 | overpowered, dominant_strategy |
| MDA/Core Loop alerts | 3 | ludonarrative_dissonance, core_loop_pathology, data_gap |
| Сортировка и комбинации | 2 | sorted_by_severity, multiple_combined |

**generate_suggestions() — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Подсказки по блокам | 3 | block_1, block_4, block_5 |
| С контекстом и без | 2 | with_project_state, without_project_state |
| Валидация | 2 | invalid_block, all_blocks_have_templates |
| Контекстная | 1 | dominant_strategy_suggestion |

**chat() — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Успешный чат | 4 | success, saves_user_message, saves_assistant_message, returns_latency |
| Обработка ошибок | 2 | ai_error_fallback, empty_message_handled |
| RAG и формат | 2 | includes_rag_context, result_format |

**chat_stream() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Streaming | 3 | yields_events, done_marker, content_in_message |
| Технические | 3 | calls_chat, sse_format, latency_in_done |

---

### 2.13 AI Assistant API (4.D.7) — 20 тестов

**POST /chat — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-01 | `test_chat_success` | Успешная отправка сообщения |
| AAPI-02 | `test_chat_unauthorized` | 401 без авторизации |
| AAPI-03 | `test_chat_empty_message` | Валидация пустого сообщения |

**POST /chat/stream — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-04 | `test_chat_stream_success` | Успешный streaming |
| AAPI-05 | `test_chat_stream_unauthorized` | 401 без авторизации |
| AAPI-06 | `test_chat_stream_content_type` | Content-Type: text/event-stream |

**GET /suggestions — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-07 | `test_suggestions_success` | Получение подсказок |
| AAPI-08 | `test_suggestions_unauthorized` | 401 без авторизации |
| AAPI-09 | `test_suggestions_invalid_block` | Валидация номера блока |

**GET /alerts — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-10 | `test_alerts_success` | Получение алертов |
| AAPI-11 | `test_alerts_unauthorized` | 401 без авторизации |

**GET /history — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-12 | `test_history_success` | Получение истории чата |
| AAPI-13 | `test_history_empty` | Пустая история |
| AAPI-14 | `test_history_unauthorized` | 401 без авторизации |

**POST /history/clear — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-15 | `test_history_clear_success` | Очистка истории |
| AAPI-16 | `test_history_clear_unauthorized` | 401 без авторизации |

**GET /status — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-17 | `test_status_success` | Статус AI-ассистента |
| AAPI-18 | `test_status_has_providers` | Наличие провайдеров |

**POST /test — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AAPI-19 | `test_test_endpoint_exists` | Тестовый эндпоинт доступен |
| AAPI-20 | `test_test_endpoint_unauthorized` | 401 без авторизации |

---

### 2.14 Integration Tests (4.C.10) — 28 тестов

**Полный пайплайн «идея → экономика» — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-01 | `test_full_pipeline_produces_all_blocks` | Все 5 блоков заполнены, нет null-ошибок |
| INT-02 | `test_pipeline_state_reflects_all_blocks` | PipelineState отражает заполненность |

**Целостность передачи данных — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-03 | `test_block2_receives_concept_data` | Блок 2 получает genre, mechanics из Блока 1 |
| INT-04 | `test_block3_receives_concept_and_coreloop_data` | Блок 3 получает данные из Блоков 1+2 |
| INT-05 | `test_block4_receives_all_previous_data` | Блок 4 получает данные из Блоков 1-3 |
| INT-06 | `test_block5_receives_progression_and_economy_inputs` | Блок 5 получает данные из Блоков 1-4 |
| INT-07 | `test_resources_extracted_from_core_loop_steps` | Ресурсы извлекаются из Core Loop |

**Graceful degradation — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-08 | `test_block4_with_only_concept` | Блок 4 только с данными Блока 1 |
| INT-09 | `test_block5_with_missing_balance` | Блок 5 без Блока 4 |
| INT-10 | `test_block5_with_only_concept` | Блок 5 с минимальными данными |

**Cascade stale-обновления — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-11 | `test_concept_change_cascades_to_all` | Блок 1 → все 2-8 stale |
| INT-12 | `test_coreloop_change_cascades_correctly` | Блок 2 → 3-8 stale |
| INT-13 | `test_mda_change_does_not_affect_earlier_blocks` | Блок 3 → 4-8 stale (1,2 не stale) |
| INT-14 | `test_balance_change_affects_progression_and_gdd` | Блок 4 → 5, 6, 8 stale |
| INT-15 | `test_progression_change_affects_gdd_only` | Блок 5 → 6, 8 stale |

**Pipeline prepare_input — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-16 | `test_prepare_block2_input` | CoreLoopInput |
| INT-17 | `test_prepare_block3_input` | MDAInput |
| INT-18 | `test_prepare_block4_input` | BalanceInput |
| INT-19 | `test_prepare_block5_input` | ProgressionInput + EconomyInput |
| INT-20 | `test_missing_concept_returns_error_for_block2` | Без концепции → missing_concept |

**Валидация формата выходных данных — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-21 | `test_concept_output_has_required_fields` | OnePager |
| INT-22 | `test_coreloop_output_has_required_fields` | CoreLoopProfile |
| INT-23 | `test_mda_output_has_required_fields` | MDAProfile |
| INT-24 | `test_balance_output_has_required_fields` | BalanceResult |
| INT-25 | `test_progression_output_has_required_fields` | ProgressionProfile |
| INT-26 | `test_economy_output_has_required_fields` | EconomyProfile |
| INT-27 | `test_alchemy_roguelike_concept_is_rpg_roguelike` | Жанр RPG/Roguelike |
| INT-28 | `test_balance_elements_status_values` | Статусы: balanced/overpowered/underpowered/ideal_imbalance |

---

### 2.15 Blocks 6-7 Testing & Debugging (4.D.10) — 42 теста

**TestGDDGenerationFormats — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| B6T-01 | `test_one_sheet_format_produces_minimal_sections` | one_sheet → минимальные секции |
| B6T-02 | `test_full_gdd_format_produces_all_38_sections` | full_gdd → все 38 секций |
| B6T-03 | `test_treatment_format_produces_investor_sections` | treatment → investor-секции |
| B6T-04 | `test_sketch_design_format_produces_design_sections` | sketch_design → design-секции |
| B6T-05 | `test_modular_format_produces_modular_sections` | modular → модульные секции |
| B6T-06 | `test_detail_level_overview_produces_fewer_pages` | overview → меньше страниц |
| B6T-07 | `test_detail_level_exhaustive_produces_more_pages` | exhaustive → больше страниц |
| B6T-08 | `test_format_auto_detection_from_audience` | audience → формат автоматически |
| B6T-09 | `test_format_auto_detection_from_project_stage` | project_stage → формат автоматически |
| B6T-10 | `test_detail_level_auto_detection_from_genre` | genre → detail level автоматически |

**TestGDDChecklistIntegration — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| B6T-11 | `test_checklist_on_full_gdd_profile` | Checklist на полном GDD |
| B6T-12 | `test_checklist_on_partial_gdd_missing_blocks` | Checklist на частичном GDD |
| B6T-13 | `test_mda_check_results_feed_into_gdd_consistency` | MDA-чек → GDD consistency |
| B6T-14 | `test_balance_issues_correlate_with_gdd_balance_section` | Баланс-проблемы → GDD |
| B6T-15 | `test_economy_issues_flagged_in_gdd_economy_section` | Экономика-проблемы → GDD |
| B6T-16 | `test_lens_check_produces_remediation_items` | Линзы → remediation items |
| B6T-17 | `test_full_validation_pipeline_produces_readiness_level` | Pipeline → readiness level |
| B6T-18 | `test_checklist_score_improvement_after_fixing_issues` | Score улучшается после исправлений |

**TestAIAssistantGDDContext — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| B6T-19 | `test_ai_assistant_receives_gdd_profile_as_context` | AI получает GDD-контекст |
| B6T-20 | `test_ai_suggestions_relevant_to_gdd_format` | Подсказки по формату GDD |
| B6T-21 | `test_ai_proactive_alerts_when_gdd_consistency_issues` | Алерты при проблемах GDD |
| B6T-22 | `test_ai_suggests_section_enrichment_based_on_coverage_gaps` | Enrichment по coverage gaps |
| B6T-23 | `test_ai_chat_includes_gdd_structure_in_system_context` | GDD структура в system context |
| B6T-24 | `test_ai_streaming_chat_works_with_gdd_context` | Streaming с GDD контекстом |
| B6T-25 | `test_ai_assistant_history_includes_gdd_messages` | История включает GDD сообщения |
| B6T-26 | `test_ai_block_flags_report_gdd_and_checklist_status` | block_flags корректны для GDD |

**TestFullPipelineIntegration — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| B6T-27 | `test_full_pipeline_concept_to_gdd` | Полный pipeline idea→GDD |
| B6T-28 | `test_pipeline_with_partial_data_still_produces_gdd` | Graceful degradation |
| B6T-29 | `test_gdd_export_to_markdown_format` | Экспорт MD |
| B6T-30 | `test_gdd_export_to_html_format` | Экспорт HTML |
| B6T-31 | `test_gdd_export_to_pdf_format` | Экспорт PDF (WeasyPrint) |
| B6T-32 | `test_gdd_export_to_docx_format` | Экспорт DOCX (python-docx) |
| B6T-33 | `test_gdd_consistency_report_detects_cross_block_issues` | Cross-block consistency |
| B6T-34 | `test_pipeline_stale_cascade_block5_affects_block6` | Stale: Block5→Block6 |
| B6T-35 | `test_pipeline_stale_cascade_block1_affects_block6` | Stale: Block1→Block6 |
| B6T-36 | `test_gdd_generation_latency_with_mock_ai` | Latency с mock AI |

**TestGDDAPIEndpointsIntegration — 6 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| B6T-37 | `test_post_generate_full_with_full_project_data` | POST generate-full |
| B6T-38 | `test_post_export_with_format_specification` | POST export |
| B6T-39 | `test_post_checklists_run_with_gdd_data` | POST checklists/run |
| B6T-40 | `test_get_project_state_includes_gdd_and_checklist_blocks` | Project State + GDD |
| B6T-41 | `test_error_handling_missing_project_for_gdd_generation` | Error: missing project |
| B6T-42 | `test_error_handling_export_with_invalid_format` | Error: invalid format |

---

## 3. Автоматизированные программные тесты (Frontend — vitest)

### 3.1 Текущие тесты (9 тестов в 3 файлах)

```
src/__tests__/
├── setup.ts                # Глобальные моки (next/navigation, next-auth, fetch)
├── components.test.tsx     # UI-компоненты (8 тестов)
├── auth.test.tsx           # Авторизация (2 теста)
└── api-client.test.ts      # API-клиент (4 теста)
```

**components.test.tsx — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-01 | `page renders without crashing` | Базовый рендеринг |
| F-02 | `button element renders correctly` | Рендеринг кнопки |
| F-03 | `input element renders correctly` | Рендеринг инпута |
| F-04 | `WarningsList renders nothing when warnings is empty` | Пустой WarningsList |
| F-05 | `WarningsList renders warnings when provided` | WarningsList с данными |
| F-06 | `SuggestionsList renders nothing when suggestions is empty` | Пустой SuggestionsList |
| F-07 | `SuggestionsList renders suggestions when provided` | SuggestionsList с данными |
| F-08 | `EmptyStateCard renders with icon, title and description` | EmptyStateCard |

**auth.test.tsx — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-09 | `рендерит форму логина` | Форма логина |
| F-10 | `рендерит форму регистрации` | Форма регистрации |

**api-client.test.ts — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-11 | `базовый URL API корректен` | API URL содержит /api/v1 |
| F-12 | `заголовки авторизации добавляются` | Bearer token в заголовках |
| F-13 | `обработка 401 ошибки` | Обработка Unauthorized |
| F-14 | `обработка 500 ошибки` | Обработка Server Error |

### 3.2 Чего не хватает во frontend-тестах

| Категория | Что нужно добавить | Приоритет |
|-----------|-------------------|-----------|
| Компоненты Блока 1 | ConceptGeneratorPage, OnePagerCard, AestheticProfileView, MechanicSetView, CoreLoopCandidates, USPCandidates, ValidationReport | Высокий |
| Компоненты Блока 2 | CoreLoopDesignerPage, CoreLoopDiagram, LoopHierarchy, PathologyPanel | Высокий |
| Компоненты Блока 3 | MDALabPage, ReverseMDAPanel, ClassicMDAPanel, LensAuditPanel, BondMatrixPanel | Высокий |
| Компоненты Блока 4 | BalancePage, TransitiveTable, PayoffMatrix, SimulationCharts, MachinationsView | Высокий |
| Компоненты Блока 5 | EconomyProgressionPage, ProgressionCurvesChart, TierTable, UnlockTree, MachinationsEditor, EconomySimulationView | Высокий |
| Компоненты Блока 6 | GDDGeneratorPage, GDDFormatSelector, GDDPreview, GDDSectionEditor, ConsistencyPanel, ExportPanel, ChecklistPanel | Высокий |
| Компоненты Блока 7 | AIAssistantPanel, ChatMessage, ContextualSuggestionCard, AIHintButton, ChatHistoryList, SuggestionsPanel, AlertsPanel | Высокий |
| Компоненты Блока 8 | IntegrationPage, GBEConnectionForm, SyncPanel, SyncHistory, DiffView | Средний |
| Общие компоненты | ProgressSidebar, PipelineDataFlowIndicator, NotificationSystem, ThemeToggle, Layout | Средний |
| Хуки | useAuth, useProject, usePipeline, useAIAssistant | Средний |
| Утилиты | formatters, validators, api helpers | Низкий |
| NodeTypeIcon | Дополнительные типы узлов | Низкий |

---

## 4. UI-тесты (ручные) — полный список

### 4.0 Общая нумерация

Всего: **165 тест-кейсов** UI-01 — UI-165

---

### 4.1 Авторизация и навигация (UI-01 — UI-15)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-01 | Страница логина: рендеринг формы | Отображаются поля email, пароль, кнопка «Войти», ссылка на регистрацию |
| UI-02 | Логин: валидный ввод | Ввод email + пароль → переход на страницу проектов |
| UI-03 | Логин: невалидный пароль | Ввод неверного пароля → сообщение об ошибке |
| UI-04 | Логин: пустые поля | Пустой email или пароль → валидация на клиенте |
| UI-05 | Страница регистрации: рендеринг | Отображаются поля имя, email, пароль, кнопка «Зарегистрироваться» |
| UI-06 | Регистрация: валидный ввод | Ввод данных → создание аккаунта → редирект на логин |
| UI-07 | Регистрация: дублирующий email | Ввод существующего email → сообщение об ошибке |
| UI-08 | Регистрация: слабый пароль | Пароль < 8 символов → предупреждение |
| UI-09 | Выход из системы | Кнопка Logout → редирект на страницу логина |
| UI-10 | Защищённые маршруты: неавторизованный | Доступ к /blocks/1 без логина → редирект на /login |
| UI-11 | Навигация: сайдбар | Все 8 блоков отображаются в сайдбаре, кликабельны |
| UI-12 | Навигация: верхняя панель | Информация о проекте и пользователе |
| UI-13 | Переключение темы | Кнопка theme toggle → смена тёмной/светлой темы |
| UI-14 | Responsive: мобильный | Сайдбар → hamburger, таблицы → карточки |
| UI-15 | Сессия: автоматический refresh | Истечение access token → auto refresh → продолжение работы |

---

### 4.2 Блок 1: Генератор концепции (UI-16 — UI-32)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-16 | Страница /blocks/1: рендеринг | Форма ввода идеи, выбор жанра, аудитории, платформы |
| UI-17 | Форма: поле идеи | Textarea, 1-5 предложений, обязательное |
| UI-18 | Форма: выбор жанра | Select из 20+ жанров или «Определить автоматически» |
| UI-19 | Форма: целевая аудитория | Мультивыбор до 3 мотиваций из 12 |
| UI-20 | Форма: платформа | Чекбоксы: PC, Mobile, Console |
| UI-21 | Форма: референтные игры | Текстовый ввод с автодополнением |
| UI-22 | Форма: бюджет/команда | Select: solo, small, medium, large |
| UI-23 | Форма: запрещённые механики | Теговый ввод |
| UI-24 | Форма: валидация пустого ввода | Пустая идея → кнопка заблокирована/предупреждение |
| UI-25 | Кнопка «Сгенерировать концепцию» | Отправка POST → Loading spinner → результат |
| UI-26 | Результат: OnePagerCard | Карточка с 8 полями One-Pager |
| UI-27 | Результат: AestheticProfileView | 3 эстетики с иконками и обоснованием |
| UI-28 | Результат: MechanicSetView | Механики по группам, индикаторы совместимости |
| UI-29 | Результат: CoreLoopCandidates | 3 варианта Core Loop для выбора |
| UI-30 | Результат: USPCandidates | 3 варианта USP для выбора |
| UI-31 | Результат: ValidationReport | Цветовая индикация: красный/жёлтый/зелёный |
| UI-32 | Выбор Core Loop и USP | Клик → сохранение в Project State → stale уведомление |

---

### 4.3 Блок 2: Core Loop Designer (UI-33 — UI-46)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-33 | Страница /blocks/2: рендеринг | Визуальный редактор Core Loop |
| UI-34 | Автозаполнение из Блока 1 | Данные концепции предзаполняют вход Core Loop |
| UI-35 | Выбор структурного типа | Engine/Economy/Ecology с визуальным объяснением |
| UI-36 | Круговая диаграмма шагов | Drag-and-drop для перестановки шагов |
| UI-37 | Клик на шаг для редактирования | Модальное окно редактирования шага |
| UI-38 | Иерархия петель | Сворачиваемое дерево: микро → мета |
| UI-39 | Визуализация ресурсных потоков | Стрелки между шагами с подписями ресурсов |
| UI-40 | Панель диагностики патологий | Список патологий: runaway, deadlock, stall и т.д. |
| UI-41 | Кнопка «Проектировать Core Loop» | Запуск алгоритма → результат |
| UI-42 | Тест «30 секунд веселья» | Отображение результата валидации |
| UI-43 | Проверка замкнутости петли | Последний шаг → первый |
| UI-44 | AI-рекомендации | Панель с рекомендациями, кнопка «Применить» |
| UI-45 | Stale-уведомление | Изменение Блока 1 → уведомление «Пересчитать Core Loop» |
| UI-46 | Пустой Core Loop | EmptyStateCard с призывом к действию |

---

### 4.4 Блок 3: MDA Lab (UI-47 — UI-61)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-47 | Страница /blocks/3: рендеринг | 4 режима через Tabs |
| UI-48 | Автозаполнение из Блоков 1+2 | Данные концепции и Core Loop предзаполняют вход |
| UI-49 | Reverse MDA: выбор эстетики | 8 иконок эстетик для выбора |
| UI-50 | Reverse MDA: запуск генерации | Кнопка → результат: рекомендованные механики |
| UI-51 | Reverse MDA: отображение механик | Список механик с приоритетом и обоснованием |
| UI-52 | Classic MDA: ввод механик | Текстовое поле / теговый ввод существующих механик |
| UI-53 | Classic MDA: запуск анализа | Кнопка → карта эстетических ценностей |
| UI-54 | Линзы Шелла: список | 9 приоритетных линз с вопросами |
| UI-55 | Линзы Шелла: заполнение | Поля для ответов, оценка по каждой линзе |
| UI-56 | Матрица Бонда: интерактивная таблица | 4×3, заполнение, авто-проверка согласованности |
| UI-57 | Матрица Бонда: диссонанс | Обнаружение диссонанса → предупреждение |
| UI-58 | Переключение между режимами | Tabs: Reverse/Classic/Линзы/Бонда |
| UI-59 | Stale-уведомление | Изменение Блока 2 → уведомление о MDA |
| UI-60 | Пустой MDA профиль | EmptyStateCard |
| UI-61 | Итеративный цикл | maxIterations=3 → отображение прогресса |

---

### 4.5 Блок 4: Баланс и симуляция (UI-62 — UI-76)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-62 | Страница /blocks/4: рендеринг | Таблица transitive-анализа, payoff-матрица, графики |
| UI-63 | Автозаполнение из Блоков 1-3 | Данные из предыдущих блоков |
| UI-64 | Transitive-таблица | Колонки: Элемент, Cost, Power, C/P Ratio, Статус, цветовая индикация |
| UI-65 | Transitive: цветовая индикация | Переоценён → красный, недооценён → синий, balanced → зелёный |
| UI-66 | Payoff-матрица | Интерактивная N×N таблица с тепловой картой |
| UI-67 | Payoff: наведение на ячейку | Тултип с детальной информацией |
| UI-68 | Кнопка «Запустить балансировку» | Запуск → Loading → результат |
| UI-69 | Monte Carlo графики | Win rate по элементам, распределение длительности |
| UI-70 | Machinations-визуализация | Граф ресурсов с анимацией потока |
| UI-71 | Панель коррекций | AI-рекомендации, кнопки «Применить» |
| UI-72 | Q-фактор панель | Индикатор избыточных компонентов |
| UI-73 | Выбор типа балансировки | Transitive/Intransitive/Ситуационная/Q-factor/Все |
| UI-74 | Stale-уведомление | Изменение Блока 3 → уведомление о балансировке |
| UI-75 | Пустой результат баланса | EmptyStateCard |
| UI-76 | Долгая симуляция | Progress indicator для Monte Carlo > 1 сек |

---

### 4.6 Блок 5: Прогрессия и экономика (UI-77 — UI-95)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-77 | Страница /blocks/5: рендеринг | Две вкладки: Прогрессия и Экономика |
| UI-78 | Вкладка «Прогрессия»: графики кривых | XP→Уровень, Уровень→Мощность, Уровень→Стоимость, Сложность |
| UI-79 | Вкладка «Прогрессия»: таблица tiers | 2-5 этапов с характеристиками |
| UI-80 | Вкладка «Прогрессия»: дерево разблокировок | Визуализация дерева контента |
| UI-81 | Вкладка «Прогрессия»: таблица воспринимаемой сложности | Столбцы: уровень, ожидание, реальность, Δ |
| UI-82 | Вкладка «Прогрессия»: панель валидации | Гринд, стены, пустые уровни, runaway |
| UI-83 | Вкладка «Прогрессия»: выбор типа кривой | 7 типов кривых Шрайбера + логистическая |
| UI-84 | Вкладка «Экономика»: Machinations-редактор | Drag-and-drop узлы: Source, Pool, Drain, Converter, Trader, Gate |
| UI-85 | Вкладка «Экономика»: граф ресурсов | Связи между узлами, веса потоков |
| UI-86 | Вкладка «Экономика»: результаты симуляции | Графики ресурсов по тикам |
| UI-87 | Вкладка «Экономика»: панель диагностики | Runaway, deadlock, stall, inflation, stagnation, arbitrage |
| UI-88 | Вкладка «Экономика»: faucet/drain ratio | Визуализация баланса источников и стоков |
| UI-89 | Кнопка «Рассчитать прогрессию» | Запуск → Loading → результат |
| UI-90 | Кнопка «Рассчитать экономику» | Запуск → Loading → результат |
| UI-91 | Связь прогрессии с экономикой | Tier → экономическая фаза, цепочки конверсии |
| UI-92 | Stale-уведомление | Изменение Блока 4 → уведомление о прогрессии/экономике |
| UI-93 | Пустые результаты | EmptyStateCard на обеих вкладках |
| UI-94 | Переключение вкладок | Прогрессия ↔ Экономика |
| UI-95 | Выбор жанра для экономики | RPG/Strategy/Survival → разные модели |

---

### 4.7 Блок 6: GDD Generator (UI-96 — UI-114)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-96 | Страница /blocks/6: рендеринг | Формат, предпросмотр, редактор, согласованность, экспорт, чек-листы |
| UI-97 | Выбор формата GDD | 8 карточек форматов с описанием и рекомендацией |
| UI-98 | Формат: one_sheet | Выбор → предпросмотр одной страницы |
| UI-99 | Формат: full_gdd | Выбор → предпросмотр полного документа |
| UI-100 | Предпросмотр GDD | Markdown-renderer, оглавление, сворачиваемые секции |
| UI-101 | Индикаторы источника секции | auto/ai/manual бейджи |
| UI-102 | Редактор секций | Inline-редактирование Markdown с подсказками |
| UI-103 | AI-подсказки для секций | Кнопка «AI-подсказка» → генерация подсказки |
| UI-104 | Панель согласованности | Список несоответствий с кнопками «Исправить» |
| UI-105 | Экспорт: PDF | Кнопка → прогресс-бар → скачивание файла |
| UI-106 | Экспорт: DOCX | Кнопка → прогресс-бар → скачивание файла |
| UI-107 | Экспорт: HTML | Кнопка → скачивание файла |
| UI-108 | Экспорт: MD | Кнопка → скачивание файла |
| UI-109 | Чек-листы: вкладка | 5 типов чек-листов в табах |
| UI-110 | Чек-листы: результаты | Цветовая индикация (красный/жёлтый/зелёный) |
| UI-111 | Чек-листы: приоритизированный список | Критические проблемы первые, quick wins выделены |
| UI-112 | Чек-листы: remediation | Кнопка «Рекомендация» → AI-предложение исправления |
| UI-113 | Stale-уведомление | Изменение блоков 1-5 → уведомление о GDD |
| UI-114 | Пустой GDD | EmptyStateCard, приглашение заполнить блоки |

---

### 4.8 Блок 7: AI-ассистент (UI-115 — UI-130)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-115 | Чат-панель: рендеринг | Список сообщений, поле ввода, кнопка отправки |
| UI-116 | Отправка сообщения | Ввод текста → отправка → streaming ответ AI |
| UI-117 | Streaming ответ | Token-by-token отображение, курсор |
| UI-118 | Отмена streaming | Кнопка Stop → прерывание генерации |
| UI-119 | Пустое сообщение | Отправка пустого → валидация |
| UI-120 | Контекстные подсказки: ContextualSuggestionCard | Плавающая карточка с подсказкой |
| UI-121 | Контекстные подсказки: AIHintButton | Popover с подсказкой в любом блоке |
| UI-122 | Подсказки по блокам | Блок 1: жанровые механики, Блок 4: дисбалансы |
| UI-123 | Проактивные алерты | Runaway/deadlock/диссонанс → автоматическое уведомление |
| UI-124 | История чата: вкладка | Загружаемая из сервера, группировка по датам |
| UI-125 | История чата: пагинация | Прокрутка → подгрузка старых сообщений |
| UI-126 | Очистка истории | Кнопка → подтверждение → очистка |
| UI-127 | RAG-цитирование | Ответ AI содержит ссылки на источники |
| UI-128 | Статус AI-ассистента | Индикатор: онлайн/офлайн/загрузка |
| UI-129 | Fallback при ошибке AI | Таймаут/ошибка → сообщение «Попробуйте позже» |
| UI-130 | Чат в контексте проекта | Ответы AI учитывают текущий Project State |

---

### 4.9 Блок 8: Интеграция GBCombine (UI-131 — UI-140)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-131 | Страница /blocks/8: рендеринг | Подключение GBE, синхронизация, история, настройки |
| UI-132 | Подключение GBE: форма API-ключа | Ввод API-ключа и URL |
| UI-133 | Подключение GBE: проверка | Кнопка «Проверить подключение» → статус |
| UI-134 | Экспорт в GBE | Кнопка «Экспорт» → прогресс → результат |
| UI-135 | Импорт из GBE | Кнопка «Импорт» → прогресс → результат |
| UI-136 | Diff между Gidede и GBE | Визуализация различий |
| UI-137 | История синхронизаций | Таблица с временными метками и статусами |
| UI-138 | Настройки направления | Bidirectional / Gidede→GBE / GBE→Gidede |
| UI-139 | Выбор сущностей для синхронизации | Чекбоксы: OnePager, MDAProfile, Machinations |
| UI-140 | Ошибка подключения | Неверный API-ключ → сообщение об ошибке |

---

### 4.10 Сквозной пайплайн (UI-141 — UI-150)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-141 | Sidebar-индикатор прогресса | Заполненные — зелёные, частичные — жёлтые, пустые — серые |
| UI-142 | Pipeline Data Flow Indicator | Визуализация связей между блоками |
| UI-143 | Автозаполнение из пайплайна | Результат Блока 1 → вход Блока 2 |
| UI-144 | Кнопка «Запустить пайплайн 1→5» | Полный автоматический пайплайн |
| UI-145 | Cascade stale-обновление | Изменение Блока 1 → stale Блоки 2-8 |
| UI-146 | Уведомление о stale | Toast: «Концепция обновлена. Рекомендуется пересчитать Core Loop» |
| UI-147 | Кнопка «Пересчитать всё» | Полный пересчёт всех зависимых блоков |
| UI-148 | API: GET /projects/{id}/state | Полный Project State |
| UI-149 | API: POST /run-full-pipeline/{project_id} | Запуск полного пайплайна |
| UI-150 | Определение следующего блока | Подсказка: «Следующий шаг: заполните Блок N» |

---

### 4.11 Общие UI-элементы (UI-151 — UI-165)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-151 | Проекты: создание | Модальное окно: название, жанр, описание |
| UI-152 | Проекты: список | Карточки проектов, пагинация |
| UI-153 | Проекты: переключение | Выбор проекта → обновление всех блоков |
| UI-154 | Проекты: удаление | Кнопка → подтверждение → удаление |
| UI-155 | Error boundaries | Ошибка в компоненте → fallback UI |
| UI-156 | Skeleton loading | Загрузка данных → skeleton → контент |
| UI-157 | Toast-уведомления | Появление, авто-скрытие, типы (success/error/warning/info) |
| UI-158 | Empty states | Красивые заглушки с призывом к действию |
| UI-159 | Accessibility: aria-метки | Все интерактивные элементы имеют aria-label |
| UI-160 | Accessibility: keyboard navigation | Tab/Enter/Escape для всех форм |
| UI-161 | Accessibility: контрастность | Текст читаем в обеих темах |
| UI-162 | Настройки: профиль | Страница настроек пользователя |
| UI-163 | Настройки: API-ключи | Управление AI-провайдерами |
| UI-164 | 404 страница | Несуществующий маршрут → страница 404 |
| UI-165 | Версия приложения | Номер версии в footer/sidebar |

---

## 5. E2E сценарии

### 5.1 E2E-01: Полный пайплайн «Идея → GDD»

**Шаги**:
1. Регистрация нового пользователя
2. Создание проекта «Roguelike про алхимика»
3. Блок 1: Ввод идеи → генерация концепции → выбор Core Loop и USP
4. Блок 2: Проектирование Core Loop → проверка патологий → утверждение
5. Блок 3: MDA-анализ → Reverse MDA → Линзы Шелла → утверждение
6. Блок 4: Запуск балансировки → просмотр результатов → применение коррекций
7. Блок 5: Расчёт прогрессии и экономики → проверка кривых → утверждение
8. Блок 6: Генерация GDD → просмотр → редактирование секций → экспорт PDF
9. Проверка: все 6 блоков зелёные в sidebar

**Ожидаемый результат**: Полный GDD-документ в PDF за ≤ 60 минут

---

### 5.2 E2E-02: Проверка баланса

**Шаги**:
1. Логин существующего пользователя
2. Открытие проекта с заполненными Блоками 1-3
3. Блок 4: Запуск transitive-анализа → просмотр таблицы
4. Блок 4: Запуск intransitive-анализа → просмотр payoff-матрицы
5. Блок 4: Monte Carlo → просмотр графиков win rate
6. Блок 4: Применение AI-коррекций → повторный анализ
7. Проверка: статус элементов изменился

**Ожидаемый результат**: Сбалансированные элементы, коррекции применены

---

### 5.3 E2E-03: AI-ассистент

**Шаги**:
1. Логин → открытие проекта
2. Блок 1: Нажатие AIHintButton → просмотр подсказки
3. Чат: Отправка вопроса «Какие механики подходят для RPG?»
4. Чат: Проверка, что ответ учитывает жанр проекта
5. Проверка проактивных алертов (если есть проблемы)
6. Очистка истории чата
7. Повторный вопрос → проверка контекстности

**Ожидаемый результат**: Контекстные ответы с учётом Project State

---

### 5.4 E2E-04: Экспорт GDD

**Шаги**:
1. Логин → проект с заполненными блоками
2. Блок 6: Выбор формата full_gdd
3. Запуск генерации → ожидание
4. Просмотр предпросмотра GDD
5. Экспорт в PDF → скачивание
6. Экспорт в DOCX → скачивание
7. Проверка: файлы не пустые, содержат все секции

**Ожидаемый результат**: PDF и DOCX файлы с корректным содержимым

---

### 5.5 E2E-05: Авторизация и изоляция данных

**Шаги**:
1. Регистрация User A → создание проекта
2. Заполнение Блока 1
3. Выход → регистрация User B
4. Попытка доступа к проекту User A → 403/404
5. Создание проекта User B → заполнение
6. Логин User A → проверка: данные на месте
7. Проверка: User A не видит проекты User B

**Ожидаемый результат**: Полная изоляция данных между пользователями

---

### 5.6 E2E-06: Cascade stale-обновление

**Шаги**:
1. Заполнить все Блоки 1-5
2. Изменить жанр в Блоке 1
3. Проверить: Блоки 2-8 помечены как stale
4. Пересчитать Блок 2
5. Проверить: Блоки 3-8 stale, Блок 2 актуален
6. Нажать «Пересчитать всё»
7. Проверить: все блоки актуальны

**Ожидаемый результат**: Корректная cascade-механика stale-обновлений

---

### 5.7 E2E-07: Чек-листы валидации

**Шаги**:
1. Проект с заполненными Блоками 1-5
2. Блок 6: Запуск всех чек-листов
3. Проверка: MDA-чек → выявление разрывов
4. Проверка: Баланс-чек → выявление дисбалансов
5. Проверка: Нарратив-чек → диссонанс
6. Проверка: Экономика-чек → патологии
7. Проверка: Линзы Шелла → рекомендации
8. Просмотр приоритизированного списка проблем
9. Применение remediation

**Ожидаемый результат**: Все 5 чек-листов находят реальные проблемы

---

### 5.8 E2E-08: Экономика и прогрессия

**Шаги**:
1. Проект с заполненными Блоками 1-4
2. Блок 5: Запуск расчёта прогрессии
3. Просмотр 4 кривых (XP, мощность, стоимость, сложность)
4. Проверка валидации: нет гринда, нет стен
5. Запуск расчёта экономики
6. Просмотр Machinations-диаграммы
7. Запуск симуляции → графики ресурсов по тикам
8. Проверка диагностики: нет runaway, нет deadlock

**Ожидаемый результат**: Корректные профили прогрессии и экономики

---

### 5.9 E2E-09: Частичное заполнение (graceful degradation)

**Шаги**:
1. Новый проект → заполнить только Блок 1
2. Попытка запустить Блок 4 → предупреждение
3. Запуск Блока 4 с частичными данными → результат с warnings
4. Запуск Блока 5 с только концепцией → 3 warnings
5. Генерация GDD → минимальное покрытие
6. Проверка: нет крашей, warnings отображаются

**Ожидаемый результат**: Graceful degradation при неполных данных

---

### 5.10 E2E-10: Интеграция GBCombine

**Шаги**:
1. Проект с заполненными данными
2. Блок 8: Ввод API-ключа GBE
3. Проверка подключения → успех
4. Экспорт в GBE → маппинг данных
5. Импорт из GBE → обновление данных
6. Просмотр diff → сравнение
7. Проверка истории синхронизаций

**Ожидаемый результат**: Двусторонняя синхронизация с GBE

---

## 6. Разрывы в тестовом покрытии (Gaps)

### 6.1 Backend — критические разрывы

| # | Разрыв | Описание | Приоритет |
|---|--------|----------|-----------|
| G-B01 | Concept Service (4.B.2–4.B.4) | Нет unit-тестов для concept_service.py: classify_genre(), extract_aesthetics(), derive_dynamics(), select_mechanics(), generate_core_loops(), generate_usp(), validate_concept(), assemble_one_pager() | 🔴 Критический |
| G-B02 | CoreLoop Service (4.B.6–4.B.7) | Нет unit-тестов для coreloop_service.py: classify_core_loop(), build_loop_hierarchy(), diagnose_pathologies(), validate_core_loop(), generate_recommendations() | 🔴 Критический |
| G-B03 | MDA Service (4.B.9–4.B.10) | Нет unit-тестов для mda_service.py: reverse_mda(), classic_mda_pass(), validate_lenses(), validate_bond_matrix() | 🔴 Критический |
| G-B04 | Progression Service (4.C.5, 4.C.7) | Нет unit-тестов для progression_service.py: calculate_macro_params(), plan_tiers(), build_curves(), generate_content_plan(), validate_progression() | 🔴 Критический |
| G-B05 | GBE Bridge Service (4.E.1) | Нет тестов для gbe_bridge_service.py: syncProjectToGBE(), syncProjectFromGBE(), webhook | 🟡 Средний |
| G-B06 | AI Service (PromptExecutor) (4.A.7) | Нет тестов для ai_service/: PromptExecutor, PromptRouter, PromptCache, PromptValidator | 🟡 Средний |
| G-B07 | Redis Client (4.A.9) | Нет тестов для redis_client.py: get_cache(), set_cache(), publish_event(), subscribe() | 🟡 Средний |
| G-B08 | API-эндпоинты концепции | Нет API-тестов для POST /api/v1/concept/generate | 🔴 Критический |
| G-B09 | API-эндпоинты Core Loop | Нет API-тестов для POST /api/v1/coreloop/design | 🔴 Критический |
| G-B10 | API-эндпоинты MDA | Нет API-тестов для POST /api/v1/mda/analyze | 🔴 Критический |
| G-B11 | API-эндпоинты прогрессии | Нет API-тестов для POST /api/v1/progression/design | 🟡 Средний |
| G-B12 | API-эндпоинты экономики | Нет API-тестов для POST /api/v1/economy/design | 🟡 Средний |
| G-B13 | API-эндпоинты GDD | Нет API-тестов для POST /api/v1/gdd/generate, GET /api/v1/gdd/{id}/export | 🟡 Средний |
| G-B14 | API-эндпоинты чек-листов | Нет API-тестов для POST /api/v1/checklists/run | 🟡 Средний |
| G-B15 | GDD AI-генерация (Stage 4-5) | Тесты GDD покрывают формат и маппинг, но AI-генерация и AI-enrichment протестированы слабо | 🟡 Средний |

### 6.2 Frontend — критические разрывы

| # | Разрыв | Описание | Приоритет |
|---|--------|----------|-----------|
| G-F01 | Все страницы Блоков 1-8 | Нет тестов для реальных React-компонентов страниц | 🔴 Критический |
| G-F02 | Хуки: useAuth, useProject, usePipeline, useAIAssistant | Нет тестов для кастомных хуков | 🔴 Критический |
| G-F03 | Формы и валидация | Нет тестов клиентской валидации форм | 🔴 Критический |
| G-F04 | API-интеграция | Нет тестов реальных API-вызовов из компонентов | 🟡 Средний |
| G-F05 | Состояние загрузки/ошибки | Нет тестов для loading/error states | 🟡 Средний |
| G-F06 | Streaming чат AI | Нет тестов для SSE streaming UI | 🟡 Средний |
| G-F07 | Machinations-визуализация | Нет тестов для графа ресурсов | 🟡 Средний |
| G-F08 | Drag-and-drop редакторы | Нет тестов для DnD в Core Loop и Machinations | 🟡 Средний |

### 6.3 UI-тесты — разрывы

| # | Разрыв | Описание | Приоритет |
|---|--------|----------|-----------|
| G-U01 | Нет Playwright E2E | E2E-тесты описаны, но не автоматизированы | 🟡 Средний |
| G-U02 | Нет визуальной регрессии | Нет скриншот-тестов | 🟢 Низкий |
| G-U03 | Нет тестов accessibility | Нет автоматизированных a11y-тестов | 🟢 Низкий |

### 6.4 Интеграционные тесты — разрывы

| # | Разрыв | Описание | Приоритет |
|---|--------|----------|-----------|
| G-I01 | Блоки 6-8 в пайплайне | Интеграционные тесты покрывают только Блоки 1-5 | 🔴 Критический |
| G-I02 | GDD + Экспорт | Нет интеграционных тестов генерации GDD + экспорт PDF/DOCX | 🟡 Средний |
| G-I03 | Чек-листы + GDD | Нет интеграционных тестов чек-листов на реальном Project State | 🟡 Средний |
| G-I04 | AI-ассистент + пайплайн | Нет интеграционных тестов AI-ассистента с реальным контекстом | 🟡 Средний |
| G-I05 | GBE синхронизация | Нет интеграционных тестов синхронизации с GBE | 🟡 Средний |

---

## 7. План закрытия разрывов

### Приоритет 1 (🔴 Критический) — Срок: 2 недели

| # | Задача | Оценка тестов | Файл |
|---|--------|---------------|------|
| P1-1 | Unit-тесты Concept Service | ~40 тестов | tests/test_concept_service.py |
| P1-2 | Unit-тесты CoreLoop Service | ~35 тестов | tests/test_coreloop_service.py |
| P1-3 | Unit-тесты MDA Service | ~35 тестов | tests/test_mda_service.py |
| P1-4 | Unit-тесты Progression Service | ~30 тестов | tests/test_progression_service.py |
| P1-5 | API-тесты концепции | ~8 тестов | tests/test_concept_api.py |
| P1-6 | API-тесты Core Loop | ~6 тестов | tests/test_coreloop_api.py |
| P1-7 | API-тесты MDA | ~6 тестов | tests/test_mda_api.py |
| P1-8 | Frontend: тесты страниц Блоков 1-3 | ~20 тестов | src/__tests__/blocks/ |
| P1-9 | Frontend: тесты хуков | ~15 тестов | src/__tests__/hooks/ |
| P1-10 | Интеграция: Блоки 6-8 в пайплайне | ~15 тестов | tests/integration/test_full_pipeline_6_8.py |

### Приоритет 2 (🟡 Средний) — Срок: 2 недели

| # | Задача | Оценка тестов | Файл |
|---|--------|---------------|------|
| P2-1 | Unit-тесты GBE Bridge Service | ~15 тестов | tests/test_gbe_bridge_service.py |
| P2-2 | Unit-тесты AI Service (PromptExecutor) | ~20 тестов | tests/test_ai_service.py |
| P2-3 | Unit-тесты Redis Client | ~10 тестов | tests/test_redis_client.py |
| P2-4 | API-тесты GDD | ~8 тестов | tests/test_gdd_api.py |
| P2-5 | API-тесты чек-листов | ~6 тестов | tests/test_checklist_api.py |
| P2-6 | API-тесты прогрессии/экономики | ~8 тестов | tests/test_progression_api.py, test_economy_api.py |
| P2-7 | Frontend: тесты страниц Блоков 4-8 | ~25 тестов | src/__tests__/blocks/ |
| P2-8 | Frontend: формы и валидация | ~15 тестов | src/__tests__/forms/ |
| P2-9 | Frontend: streaming чат AI | ~8 тестов | src/__tests__/ai-assistant/ |
| P2-10 | Интеграция: GDD + Экспорт | ~10 тестов | tests/integration/test_gdd_export.py |
| P2-11 | Интеграция: Чек-листы + GDD | ~8 тестов | tests/integration/test_checklist_gdd.py |
| P2-12 | Интеграция: AI-ассистент + пайплайн | ~8 тестов | tests/integration/test_ai_pipeline.py |

### Приоритет 3 (🟢 Низкий) — Срок: 1 неделя

| # | Задача | Оценка тестов | Файл |
|---|--------|---------------|------|
| P3-1 | Frontend: Machinations-визуализация | ~6 тестов | src/__tests__/machinations/ |
| P3-2 | Frontend: Drag-and-drop | ~4 тестов | src/__tests__/dnd/ |
| P3-3 | Frontend: состояние загрузки/ошибки | ~10 тестов | src/__tests__/states/ |
| P3-4 | GBE синхронизация: интеграция | ~6 тестов | tests/integration/test_gbe_sync.py |
| P3-5 | Playwright E2E: автоматизация | ~15 тестов | tests/e2e/ |
| P3-6 | Визуальная регрессия | ~10 тестов | tests/visual/ |
| P3-7 | Accessibility-тесты | ~8 тестов | tests/a11y/ |

### Итого план закрытия разрывов

| Приоритет | Тестов | Срок |
|-----------|--------|------|
| 🔴 Критический | ~210 | 2 недели |
| 🟡 Средний | ~141 | 2 недели |
| 🟢 Низкий | ~59 | 1 неделя |
| **Итого** | **~410** | **5 недель** |

---

## 8. Сводная статистика

### 8.1 Текущее состояние

| Категория | Количество |
|-----------|------------|
| Backend pytest тестов | 572 |
| Frontend vitest тестов | 14 |
| UI ручных тестов | 165 |
| E2E сценариев | 10 |
| **Итого тест-кейсов** | **761** |

### 8.2 Целевое состояние (после закрытия разрывов)

| Категория | Количество |
|-----------|------------|
| Backend pytest тестов | 572 + ~210 = ~782 |
| Frontend vitest тестов | 14 + ~103 = ~117 |
| UI ручных тестов | 165 |
| E2E сценариев | 10 |
| **Итого тест-кейсов** | **~1074** |

### 8.3 Целевое покрытие (критерий C8 из ROADMAP)

- **Backend**: >= 60% coverage (цель после P1+P2: ~70%)
- **Frontend**: >= 50% coverage (цель после P1+P2+P3: ~55%)

---

## 9. Формат отчёта о тестировании

После каждого сеанса тестирования, создавайте отчёт:

```markdown
# Отчёт о тестировании Gidede
Дата: YYYY-MM-DD
Версия: X.Y.Z
Тестировщик: Имя

## Автоматизированные тесты
- Backend: X/Y пройдено (Z% coverage)
- Frontend: X/Y пройдено (Z% coverage)
- Линтеры: PASS/FAIL

## UI-тесты (ручные)
| ID | Результат | Комментарий |
|----|-----------|-------------|
| UI-01 | PASS/FAIL | |

## Найденные баги
1. [Критичность] Описание

## Замечания
- Заметки
```

---

### 2.16 GBE Bridge Service (4.E.1) — 70 тестов

**TestMappingToGBE — 12 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-01 | `test_map_concept_to_blueprint_full` | OnePager → Blueprint с полными данными |
| GBE-02 | `test_map_concept_to_blueprint_missing_fields` | OnePager с отсутствующими полями → дефолты |
| GBE-03 | `test_map_concept_to_blueprint_name_fallback` | 'name' вместо 'title' → корректный fallback |
| GBE-04 | `test_map_concept_to_blueprint_idea_fallback` | 'idea' вместо 'logline' → корректный fallback |
| GBE-05 | `test_map_mda_to_gbe_model` | MDAProfile → GBEMDAModel |
| GBE-06 | `test_map_mda_to_gbe_model_empty` | Пустой MDA → дефолты |
| GBE-07 | `test_map_machinations_to_gbe_diagram` | Machinations → GBEDiagram |
| GBE-08 | `test_map_machinations_to_gbe_diagram_flows_fallback` | 'flows' вместо 'connections' |
| GBE-09 | `test_map_balance_to_gbe_report` | BalanceResult → GBEBalanceReport |
| GBE-10 | `test_map_progression_to_gbe_model` | ProgressionProfile → GBEProgressionModel |
| GBE-11 | `test_map_economy_to_gbe_model` | EconomyProfile → GBEEconomyModel с вложенным Machinations |
| GBE-12 | `test_map_economy_without_machinations` | Economy без Machinations → нет диаграммы |

**TestMappingFromGBE — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-13 | `test_map_blueprint_to_concept` | GBE Blueprint → Gidede concept |
| GBE-14 | `test_map_blueprint_to_concept_empty` | Пустой Blueprint → дефолты |
| GBE-15 | `test_map_gbe_mda_to_profile` | GBE MDAModel → Gidede mda_profile |
| GBE-16 | `test_map_gbe_balance_to_result` | GBE BalanceReport → Gidede balance_result |

**TestSyncToGBE — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-17 | `test_sync_to_gbe_full` | Полный Project State → все 6 компонентов |
| GBE-18 | `test_sync_to_gbe_partial` | Частичный → synced + skipped |
| GBE-19 | `test_sync_to_gbe_empty` | Пустой → все пропущены, warnings |
| GBE-20 | `test_sync_to_gbe_null_values` | null-значения → компоненты пропущены |
| GBE-21 | `test_sync_to_gbe_saves_to_history` | Запись в историю |
| GBE-22 | `test_sync_to_gbe_concept_missing_economy_warning` | Warning о Machinations |
| GBE-23 | `test_sync_to_gbe_sync_id_unique` | Уникальный sync_id |
| GBE-24 | `test_sync_to_gbe_status_with_warnings` | synced_with_warnings при warnings |

**TestSyncFromGBE — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-25 | `test_sync_from_gbe_full` | Полные GBE данные → все компоненты |
| GBE-26 | `test_sync_from_gbe_partial` | Только blueprint → 1 синхронизирован |
| GBE-27 | `test_sync_from_gbe_empty` | Пустые данные → все пропущены |
| GBE-28 | `test_sync_from_gbe_saves_to_history` | Запись в историю |

**TestHandleWebhook — 7 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-29 | `test_webhook_blueprint_updated` | blueprint.updated → queued |
| GBE-30 | `test_webhook_diagram_changed` | diagram.changed → queued |
| GBE-31 | `test_webhook_sync_requested` | sync.requested → queued |
| GBE-32 | `test_webhook_lint_completed` | lint.completed → processed |
| GBE-33 | `test_webhook_unknown_event` | Неизвестный тип → ignored |
| GBE-34 | `test_webhook_has_timestamp` | Корректный timestamp |
| GBE-35 | `test_webhook_empty_component` | Пустой component → обрабатывается |

**TestGetProjectStatus — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-36 | `test_get_project_status_returns_dict` | Возвращает dict |
| GBE-37 | `test_get_project_status_has_components` | Все 7 компонентов |
| GBE-38 | `test_get_project_status_is_mock` | Mock-режим показан |
| GBE-39 | `test_get_project_status_has_gbe_version` | Версия GBE |
| GBE-40 | `test_get_project_status_has_sync_history_count` | Счётчик истории |

**TestConnection — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-41 | `test_test_connection_mock_mode` | Mock → подключение успешно |
| GBE-42 | `test_test_connection_has_base_url` | base_url в результате |
| GBE-43 | `test_test_connection_has_latency` | latency_ms в результате |

**TestSyncHistory — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-44 | `test_sync_history_empty` | Изначально пуста |
| GBE-45 | `test_sync_history_after_sync` | Запись после sync |
| GBE-46 | `test_sync_history_multiple` | Несколько записей |
| GBE-47 | `test_sync_history_limit` | Ограничение количества |

**TestLegacyMethods — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-48 | `test_import_gdd_returns_dict` | import_gdd → dict |
| GBE-49 | `test_export_to_gbe_returns_dict` | export_to_gbe → dict с legacy-полями |
| GBE-50 | `test_export_to_gbe_validation` | validation.valid зависит от warnings |
| GBE-51 | `test_sync_changes_returns_dict` | sync_changes → dict |

**TestPydanticModels — 11 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-52 | `test_gbe_blueprint_defaults` | Дефолты GBEBlueprint |
| GBE-53 | `test_gbe_mda_model_defaults` | Дефолты GBEMDAModel |
| GBE-54 | `test_gbe_diagram_defaults` | Дефолты GBEDiagram |
| GBE-55 | `test_gbe_balance_report_defaults` | Дефолты GBEBalanceReport |
| GBE-56 | `test_gbe_progression_model_defaults` | Дефолты GBEProgressionModel |
| GBE-57 | `test_gbe_economy_model_defaults` | Дефолты GBEEconomyModel |
| GBE-58 | `test_gbe_sync_result_defaults` | Дефолты GBESyncResult |
| GBE-59 | `test_gbe_webhook_result_defaults` | Дефолты GBEWebhookResult |
| GBE-60 | `test_gbe_connection_status_defaults` | Дефолты GBEConnectionStatus |
| GBE-61 | `test_gbe_blueprint_serialization` | Сериализация в dict |
| GBE-62 | `test_gbe_sync_result_serialization` | Сериализация в dict |

**TestEdgeCases — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-63 | `test_service_with_empty_api_key` | Пустой API-ключ |
| GBE-64 | `test_service_with_custom_url` | Кастомный URL |
| GBE-65 | `test_sync_to_gbe_concept_with_extra_fields` | Незапланированные поля → не ломается |
| GBE-66 | `test_sync_from_gbe_with_extra_gbe_fields` | Лишние поля GBE → не ломается |
| GBE-67 | `test_webhook_with_data` | Вебхук с data → обработан |
| GBE-68 | `test_map_economy_with_empty_machinations` | Пустой machinations_model → нет диаграммы |
| GBE-69 | `test_map_economy_with_nonempty_machinations` | Непустой → диаграмма создана |
| GBE-70 | `test_multiple_syncs_independent` | Независимость множественных синхронизаций |

---

### UI-тесты Блока 8: Интеграция GBE (ручные)

| ID | Тест | Что проверяет |
|----|------|---------------|
| UI-66 | Страница /blocks/8 загружается | Отображается заголовок «Интеграция GBE» |
| UI-67 | Вкладка «Подключение» | Форма с URL и API Key, кнопка «Проверить подключение» |
| UI-68 | Проверка подключения (mock) | Нажатие кнопки → результат: connected=True, is_mock=True |
| UI-69 | MOCK-бейдж виден | Жёлтый/янтарный бейдж «MOCK» отображается |
| UI-70 | Вкладка «Синхронизация» | Две карточки: Экспорт и Импорт |
| UI-71 | Экспорт в GBE | Нажатие кнопки → результат с sync_id, components_synced |
| UI-72 | Импорт из GBE | Нажатие кнопки → результат с компонентами |
| UI-73 | Вкладка «История» | Таблица с записями синхронизаций |
| UI-74 | Вкладка «Настройки» | Выбор направления, чекбоксы сущностей, вебхук-симуляция |
| UI-75 | Отправка вебхука | Выбор event_type → отправка → результат отображается |
```
