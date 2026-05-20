# Gidede — Комплексный план тестирования

> **Фаза**: 4.E (Интеграция и полировка — Блок 8)
> **Дата**: 2026-05-20
> **Версия**: 0.50.0
> **Статус**: Активный
> **Подход**: Локальное тестирование + CI/CD (GitHub Actions) + Docker-тестирование

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика и через CI/CD пайплайн (GitHub Actions: `.github/workflows/ci.yml`). Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.5), Core Loop Designer (4.B.6–4.B.8), MDA Lab (4.B.9–4.B.11), сквозной пайплайн (4.B.12), баланс и симуляцию (4.C.1–4.C.4), прогрессию (4.C.5), экономику (4.C.6–4.C.7), UI экономики и прогрессии (4.C.8), сквозной пайплайн Блоков 1–5 (4.C.9), интеграционные тесты полного пайплайна (4.C.10), GDD-генерацию (4.D.1–4.D.3), Checklist-валидацию GDD (4.D.4), UI GDD Generator (4.D.5), AI-ассистент backend (4.D.6–4.D.7), UI AI-ассистент (4.D.8), интеграцию GBCombine — Блок 8, оптимизацию производительности (4.E.3), обработку ошибок (4.E.4).

### 1.1 Уровни тестирования

| Уровень | Инструмент | Покрытие | Автоматизация |
|---------|-----------|----------|---------------|
| Unit-тесты (backend) | pytest | Сервисы, утилиты, модели, валидаторы | Полная |
| Unit-тесты (frontend) | vitest + React Testing Library | Компоненты, хуки, утилиты | Полная |
| API-тесты (backend) | pytest + httpx | Все REST-эндпоинты | Полная |
| Интеграционные тесты | pytest | AI-сервис, RAG, Redis, полный пайплайн | Частичная (с моками) |
| E2E-тесты (автоматизированные) | Playwright | 5 пользовательских сценариев | Полная |
| UI-тесты (ручные) | Браузер | Страницы, формы, навигация, валидация | Ручная |

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
cd /home/z/my-project/Gidede
npx vitest run
npx vitest run --coverage
npx vitest --ui   # Интерактивный UI

# E2E: Playwright
cd /home/z/my-project/Gidede
npx playwright test              # Запуск всех E2E тестов
npx playwright test --list       # Листинг тестов без запуска
npx playwright test --ui         # Интерактивный UI
npx playwright test e2e/auth.spec.ts  # Только авторизация

# Линтеры
ruff check app/ tests/     # Python
npx eslint src/            # TypeScript
```

### 1.3 Docker-тестирование (One-Click)

Все тесты можно запустить внутри Docker-контейнера одной командой. Контейнер автоматически поднимает PostgreSQL, Redis, запускает Alembic миграции и прогоняет тесты.

```bash
# Все тесты (backend + frontend + lint)
docker compose -f docker-compose.single.yml run --rm gidede test

# Только backend (pytest)
docker compose -f docker-compose.single.yml run --rm gidede test backend

# Только frontend (vitest)
docker compose -f docker-compose.single.yml run --rm gidede test frontend

# Только линтеры (Ruff + ESLint)
docker compose -f docker-compose.single.yml run --rm gidede test lint

# Тесты с покрытием кода
docker compose -f docker-compose.single.yml run --rm gidede test coverage
```

> **Примечание**: Docker-тестирование использует тот же `Dockerfile.all-in-one`, что и production-деплой. Это гарантирует идентичность окружения. Внутри контейнера PostgreSQL запускается с pgvector, Redis — с AOF persistence, а Alembic применяет все миграции перед запуском тестов.

---

## 2. Автоматизированные программные тесты (Backend — pytest)

### 2.0 Сводная таблица

**Итого: 978 тестов в 24 файлах (backend) + 283 теста в 8 файлах (frontend) + 17 E2E тестов в 5 файлах + 12 load-задач = 1290 всего**

| # | Файл | Количество | Что тестирует |
|---|------|------------|---------------|
| 1 | test_gdd_service.py | 108 | GDD Stages 1-5: формат, маппинг, автозаполнение, pipeline |
| 2 | test_checklist_service.py | 95 | Checklist: define_scope, MDA, Balance, Narrative, Economy, Lens, Aggregation, FullPipeline, EdgeCases |
| 3 | test_economy_service.py | 83 | Economy: ресурсы, классификация, Machinations, конверсии, диагностика, балансировка, pipeline |
| 4 | test_balance_service.py | 77 | Balance: Transitive, Intransitive, Situational, Q-factor, Monte Carlo, Machinations, pipeline |
| 5 | test_gbe_bridge_service.py | 69 | GBE Bridge: mapping to/from, sync, webhooks, edge cases, Pydantic-модели |
| 6 | test_ai_assistant_service.py | 60 | AI Assistant: context, session, history, knowledge, alerts, suggestions, chat, stream |
| 7 | test_pipeline_4d9_integration.py | 60 | Pipeline Blocks 6-7-8 integration: GDD+Checklist+AI+GBE |
| 8 | test_metrics.py | 50 | Prometheus metrics, logging, health endpoint, structured logs |
| 9 | test_mda_service.py | 45 | MDA: target dynamics, mechanics mapping, set assembly, classic MDA, lenses, Bond matrix |
| 10 | test_progression_service.py | 45 | Progression: macro params, tiers, curves, content plan, validation, pipeline |
| 11 | test_blocks_6_7_integration.py | 42 | GDD+Checklist+AI cross-module: форматы, чеклисты, контекст, API |
| 12 | test_coreloop_service.py | 41 | CoreLoop: classify, hierarchy, pathologies, validation, recommendations, design_full |
| 13 | test_concept_service.py | 40 | Concept: classify_genre, extract_aesthetics, derive_dynamics, select_mechanics, pipeline |
| 14 | test_gdd_stages_6_8.py | 32 | GDD assemble, format, export: сшивка, Markdown, HTML, PDF, DOCX |
| 15 | test_pipeline_service.py | 31 | Pipeline Blocks 1-5: prepare_input, stale, зависимости, модели, уведомления |
| 16 | test_project_service.py | 14 | Project: CRUD, block flags, edge cases |
| 17 | test_ai_assistant_api.py | 20 | AI API endpoints: chat, stream, suggestions, alerts, history, status |
| 18 | test_rag_service.py | 12 | RAG: чанкирование, метаданные, поиск, статистика |
| 19 | test_prompt_registry.py | 8 | Prompt Registry: 31+ промптов, PromptSpec, фильтрация, статистика |
| 20 | test_auth.py | 6 | Auth: register, login, JWT, protected endpoints |
| 21 | test_text_chunker.py | 6 | TextChunker: длинные абзацы, русский, код, токены |
| 22 | test_projects.py | 4 | Projects: CRUD, изоляция |
| 23 | test_health.py | 2 | Health check API |
| 24 | integration/test_full_pipeline.py | 28 | Full pipeline idea→economy, data flow, stale, graceful degradation |

```
mini-services/api-service/tests/
├── conftest.py                    # Общие фикстуры
├── test_health.py                 # Health check API (2 теста)
├── test_auth.py                   # Авторизация (6 тестов)
├── test_projects.py               # CRUD проектов (4 теста)
├── test_rag_service.py            # RAG-сервис (12 тестов)
├── test_prompt_registry.py        # Реестр промптов (8 тестов)
├── test_text_chunker.py           # Разбиение текста на чанки (6 тестов)
├── test_concept_service.py        # Concept Service — Блок 1 (41 тест)
├── test_coreloop_service.py       # CoreLoop Service — Блок 2 (40 тестов)
├── test_mda_service.py            # MDA Service — Блок 3 (45 тестов)
├── test_balance_service.py        # Balance Service — Блок 4 (77 тестов)
├── test_progression_service.py    # Progression Service — Блок 5 (45 тестов)
├── test_economy_service.py        # Economy Service — Блок 5 (83 теста)
├── test_gdd_service.py            # GDD Service Stages 1-5 (108 тестов)
├── test_gdd_stages_6_8.py         # GDD Service Stages 6-8 (32 теста)
├── test_pipeline_service.py       # Pipeline Service (31 тест)
├── test_checklist_service.py      # Checklist Service (95 тестов)
├── test_ai_assistant_service.py   # AI Assistant Service (60 тестов)
├── test_ai_assistant_api.py       # AI Assistant API (20 тестов)
├── test_pipeline_4d9_integration.py  # Pipeline Integration Blocks 6-7 (60 тестов)
├── test_blocks_6_7_integration.py # Blocks 6-7 Testing & Debugging (42 теста)
├── test_gbe_bridge_service.py     # GBE Bridge Service — Block 8 (69 тестов)
├── test_project_service.py        # Project Service (14 тестов)
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
| GDD-интеграция | 2 | balance_warnings_in_gdd, balance_corrections_in_gdd |
| Pipeline Service (4.C.9) | 7 | stale cascade для Блока 4, prepare_input, next_block |

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

### 2.16 GBE Bridge Service (4.E.1) — 69 тестов

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

**TestEdgeCases — 7 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| GBE-63 | `test_service_with_empty_api_key` | Пустой API-ключ |
| GBE-64 | `test_service_with_custom_url` | Кастомный URL |
| GBE-65 | `test_sync_to_gbe_concept_with_extra_fields` | Незапланированные поля → не ломается |
| GBE-66 | `test_sync_from_gbe_with_extra_gbe_fields` | Лишние поля GBE → не ломается |
| GBE-67 | `test_webhook_with_data` | Вебхук с data → обработан |
| GBE-68 | `test_map_economy_with_empty_machinations` | Пустой machinations_model → нет диаграммы |
| GBE-69 | `test_map_economy_with_nonempty_machinations` | Непустой → диаграмма создана |

---

## 3. Недостающие backend тесты (план для 5 сервисов)

5 сервисов не имеют выделенных файлов тестов. Они тестируются косвенно через pipeline и integration-тесты, но требуют прямого unit-покрытия.

### 3.1 Concept Service (Блок 1) — ~50 плановых тестов

**Файл**: `tests/test_concept_service.py`

| Функция | Количество | Детализация |
|---------|------------|-------------|
| test_classify_genre | 5 | RPG, Strategy, Puzzle, FPS, unknown genre fallback |
| test_extract_aesthetics | 6 | 3 эстетики, genre mapping, Yi model, AI fallback |
| test_derive_dynamics | 5 | aesthetics→dynamics mapping, AI enrichment, empty state |
| test_select_mechanics | 8 | basic/combat/progression/spatial/social, compatibility, synergy, MechanicsDB |
| test_generate_core_loops | 5 | 3 variants, structural type, AI prompt |
| test_generate_usp | 5 | 3 variants, genre-aware, AI fallback |
| test_validate_concept | 8 | Triangle of Weirdness, 5 core gameplay questions, 8 idea filters, scores |
| test_assemble_one_pager | 4 | all data, partial, empty, validation integration |
| test_concept_pipeline | 4 | full pipeline, stages_completed, latency, graceful degradation |
| **Итого** | **~50** | |

---

### 3.2 CoreLoop Service (Блок 2) — ~40 плановых тестов

**Файл**: `tests/test_coreloop_service.py`

| Функция | Количество | Детализация |
|---------|------------|-------------|
| test_classify_core_loop | 5 | Engine, Economy, Ecology, subtypes |
| test_build_loop_hierarchy | 6 | 6 levels, mechanic binding, resource flow |
| test_diagnose_pathologies | 7 | runaway, deadlock, stall, brittleness, oscillation, stagnation, triviality |
| test_validate_core_loop | 8 | 30 seconds test, loop closed, resource sufficiency, dead resources |
| test_generate_recommendations | 6 | AI prompt, fallback, context-aware |
| test_coreloop_pipeline | 8 | full pipeline, with/without MDA, graceful degradation |
| **Итого** | **~40** | |

---

### 3.3 MDA Service (Блок 3) — ~45 плановых тестов

**Файл**: `tests/test_mda_service.py`

| Функция | Количество | Детализация |
|---------|------------|-------------|
| test_reverse_mda_dynamics | 5 | aesthetics→dynamics, genre filter, AI enrichment |
| test_reverse_mda_mechanics | 6 | mechanics pool, Adams/Dormans patterns, Set Cover, synergy |
| test_assemble_mechanic_set | 5 | conflicts, mandatory/forbidden, coverage, patterns |
| test_classic_mda_pass | 6 | gameplay simulation, dynamics derivation, aesthetics inference, convergence |
| test_validate_lenses | 6 | 9 lenses, AI assessment, aggregation, genre-specific |
| test_validate_bond_matrix | 7 | 4×3 matrix, horizontal/vertical consistency, dissonance detection |
| test_mda_pipeline | 10 | full pipeline, iterations, convergence, latency |
| **Итого** | **~45** | |

---

### 3.4 Progression Service (Блок 5) — ~40 плановых тестов

**Файл**: `tests/test_progression_service.py`

| Функция | Количество | Детализация |
|---------|------------|-------------|
| test_calculate_macro_params | 6 | duration, levels, curve type, content requirements |
| test_plan_tiers | 5 | 2-5 tiers, characteristics, balance type |
| test_build_curves | 8 | 4 curves, 7 types, logistic, parameters |
| test_generate_content_plan | 6 | tier plans, unlock tree, perceived difficulty |
| test_validate_progression | 8 | grind, walls, empty levels, runaway, build gaps |
| test_progression_pipeline | 7 | full pipeline, validation, latency |
| **Итого** | **~40** | |

---

### 3.5 Project Service — ~15 плановых тестов

**Файл**: `tests/test_project_service.py`

| Функция | Количество | Детализация |
|---------|------------|-------------|
| test_crud_operations | 5 | create, read, update, delete, list |
| test_project_state_management | 4 | get_state, update_state, block flags, stale status |
| test_project_isolation | 3 | user isolation, cross-user access denied, shared projects |
| test_project_validation | 3 | name validation, duplicate handling, constraints |
| **Итого** | **~15** | |

---

### 3.6 Сводная таблица недостающих backend тестов

| # | Сервис | Плановых тестов | Файл | Приоритет |
|---|--------|-----------------|------|-----------|
| 1 | Concept Service (Блок 1) | ~50 | test_concept_service.py | Критический |
| 2 | CoreLoop Service (Блок 2) | ~40 | test_coreloop_service.py | Критический |
| 3 | MDA Service (Блок 3) | ~45 | test_mda_service.py | Критический |
| 4 | Progression Service (Блок 5) | ~40 | test_progression_service.py | Критический |
| 5 | Project Service | ~15 | test_project_service.py | Средний |
| | **Итого** | **~190** | | |

---

## 4. Автоматизированные программные тесты (Frontend — vitest)

### 4.1 Текущие тесты (30 тестов в 3 файлах)

```
src/__tests__/
├── setup.ts                # Глобальные моки (next/navigation, next-auth, fetch)
├── api-client.test.ts      # API-клиент (4 теста)
├── auth.test.tsx           # Авторизация (2 теста)
└── components.test.tsx     # UI-компоненты + Error Handling (24 теста)
```

**components.test.tsx — 24 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-01 | `page renders without crashing` | Базовый рендеринг |
| F-02 | `button element renders correctly` | Рендеринг кнопки |
| F-03 | `input element renders correctly` | Рендеринг инпута |
| F-04 | `WarningsList renders nothing when warnings is empty` | Пустой WarningsList |
| F-05 | `WarningsList renders warnings when provided` | WarningsList с данными |
| F-06 | `WarningsList renders multiple warnings` | Множественные warnings |
| F-07 | `WarningsList respects maxRows limit` | Ограничение maxRows |
| F-08 | `SuggestionsList renders nothing when suggestions is empty` | Пустой SuggestionsList |
| F-09 | `SuggestionsList renders suggestions in card variant` | SuggestionsList (card) |
| F-10 | `SuggestionsList renders suggestions in inline variant` | SuggestionsList (inline) |
| F-11 | `EmptyStateCard renders with icon, title and description` | EmptyStateCard полный |
| F-12 | `EmptyStateCard renders without description` | EmptyStateCard без description |
| F-13 | `NodeTypeIcon renders pool node type` | NodeTypeIcon: pool |
| F-14 | `NodeTypeIcon renders source node type` | NodeTypeIcon: source |
| F-15 | `NodeTypeIcon renders drain node type` | NodeTypeIcon: drain |
| F-16 | `NodeTypeIcon renders converter node type` | NodeTypeIcon: converter |
| F-17 | `NodeTypeIcon renders gate node type` | NodeTypeIcon: gate |
| F-18 | `NodeTypeIcon renders unknown node type with default icon` | NodeTypeIcon: fallback |
| F-19 | `classifyError identifies timeout errors` | classifyError: timeout (4.E.4) |
| F-20 | `classifyError identifies network errors` | classifyError: network (4.E.4) |
| F-21 | `classifyError identifies auth errors` | classifyError: auth (4.E.4) |
| F-22 | `classifyError identifies validation errors` | classifyError: validation (4.E.4) |
| F-23 | `classifyError identifies server errors` | classifyError: server (4.E.4) |
| F-24 | `getErrorMessage returns human-readable messages` | getErrorMessage: русский текст (4.E.4) |

**auth.test.tsx — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-25 | `рендерит форму логина` | Форма логина |
| F-26 | `рендерит форму регистрации` | Форма регистрации |

> ⚠️ **Проблема**: auth.test.tsx использует mock HTML вместо реальных React-компонентов.

**api-client.test.ts — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-27 | `базовый URL API корректен` | API URL содержит /api/v1 |
| F-28 | `заголовки авторизации добавляются` | Bearer token в заголовках |
| F-29 | `обработка 401 ошибки` | Обработка Unauthorized |
| F-30 | `обработка 500 ошибки` | Обработка Server Error |

> ⚠️ **Проблема**: api-client.test.ts использует inline-логику вместо реальных импортов из lib/api-client.ts.

### 4.2 Frontend Coverage Gaps

| Категория | Всего | Протестировано | Покрытие |
|-----------|-------|----------------|----------|
| Страницы (pages) | 16 | 0 | 0% |
| Компоненты (components) | 46 | 4 (shared/) + api-client error handling | 10.9% |
| Хуки (hooks) | 4 | 0 | 0% |
| Утилиты (lib) | 3 | 1 (api-client error handling) | 33.3% |

**Критические проблемы**:
- Auth-тесты используют mock HTML вместо реальных компонентов из `app/login/page.tsx` и `app/register/page.tsx`
- API client-тесты используют inline-логику вместо реальных импортов из `lib/api-client.ts`
- Ни одна из 16 страниц не протестирована
- Ни один из 4 кастомных хуков не протестирован
- Только 4 из 46 компонентов протестированы (только из `shared/` директории)

### 4.3 План frontend-тестов

**Приоритет 1 — Core Infrastructure (~28 тестов)**

| Компонент | Тестов | Детализация |
|-----------|--------|-------------|
| lib/api-client.ts | 12 | ApiClientError hierarchy, classifyError(), fetchWithRetry(), timeout handling, baseURL, auth headers, error classification |
| lib/auth.tsx AuthProvider | 10 | login/register/logout, token refresh, apiFetch retry, unauthorized redirect, token expiry |
| hooks/useActiveProject.ts | 6 | localStorage, SSR safety, StorageEvent cross-tab, default project, project switch |

**Приоритет 2 — Block Components (~35 тестов)**

| Компонент | Тестов | Детализация |
|-----------|--------|-------------|
| concept/ConceptForm.tsx | 5 | render fields, validation, submit, genre select, budget select |
| concept/OnePagerCard.tsx | 2 | render with data, empty state |
| concept/SelectionSummary.tsx | 3 | render selections, save to project state, on change callback |
| coreloop/StructuralTypeCard | 1 | render type selection |
| coreloop/CoreLoopDiagram | 2 | render steps, step click handler |
| coreloop/PathologyPanel | 2 | render pathologies, empty state |
| mda/MDAInputForm | 4 | render tabs, input mechanics, select aesthetics, submit |
| mda/ReverseMDAPanel | 1 | render with aesthetics |
| balance/ObjectForm | 4 | add/remove objects, validation, submit |
| balance/TransitiveAnalysisTab | 1 | render table |
| progression/MacroParamsTab | 1 | render params |
| economy/ResourcesTab | 1 | render resources |
| gdd/GDDFormatSelector | 2 | render formats, select format |
| gdd/ChecklistPanel | 3 | render check types, run check, display results |
| ai-assistant/AIHintButton | 1 | render hint popover |
| ai-assistant/ContextualSuggestionCard | 2 | render suggestion, click handler |

**Приоритет 3 — Layout & Navigation (~12 тестов)**

| Компонент | Тестов | Детализация |
|-----------|--------|-------------|
| sidebar.tsx | 4 | render blocks, active state, collapse, block navigation |
| progress-sidebar.tsx | 3 | render progress indicators, stale badges, tooltip |
| layout-shell.tsx | 2 | render with/without auth, responsive breakpoint |
| pipeline-flow-indicator.tsx | 1 | render flow arrows |
| pipeline-notifications.tsx | 2 | render notifications, dismiss |

**Приоритет 4 — Page-Level Integration (~31 тест)**

| Компонент | Тестов | Детализация |
|-----------|--------|-------------|
| login/page.tsx | 4 | render form, validation, submit, error display |
| register/page.tsx | 5 | render form, validation, submit, error display, success redirect |
| projects/page.tsx | 6 | render list, create project, delete project, switch project, empty state, pagination |
| error.tsx | 5 | render error, retry button, different error types, reset, custom message |
| hooks/use-toast.ts | 6 | toast types, auto-dismiss, manual dismiss, queue, position, duplicate handling |
| hooks/use-mobile.ts | 2 | desktop breakpoint, mobile breakpoint |
| lib/utils.ts | 3 | cn() merge, formatNumber(), formatDate() |

### 4.4 Сводная таблица frontend-плана

| Приоритет | Категория | Тестов | Срок |
|-----------|-----------|--------|------|
| P1 | Core Infrastructure | ~28 | 1 неделя |
| P2 | Block Components | ~35 | 2 недели |
| P3 | Layout & Navigation | ~12 | 1 неделя |
| P4 | Page-Level Integration | ~31 | 1 неделя |
| | **Итого** | **~106** | **5 недель** |

---

## 5. UI-тесты (ручные) — все 70 тест-кейсов

### 5.1 Блок 1: Концепция (UI-01 — UI-12)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-01 | Страница /blocks/1 загружается без ошибок | Отображается заголовок, форма, нет JS-ошибок |
| UI-02 | Форма ввода идеи: textarea, жанр, ЦА, платформа, бюджет | Все поля присутствуют и интерактивны |
| UI-03 | Валидация формы: пустое поле идеи, превышение лимита символов | Кнопка заблокирована / предупреждение |
| UI-04 | Кнопка «Сгенерировать концепцию» отправляет POST | Loading spinner → результат |
| UI-05 | Отображение OnePagerCard с результатами | 8 полей One-Pager заполнены |
| UI-06 | AestheticProfileView показывает 3 эстетики | Иконки, названия, обоснования |
| UI-07 | MechanicSetView с индикаторами совместимости | Группы механик, цветные индикаторы |
| UI-08 | CoreLoopCandidates: выбор из 3 вариантов | Радио-кнопки / карточки для выбора |
| UI-09 | USPCandidates: выбор из 3 вариантов | Радио-кнопки / карточки для выбора |
| UI-10 | ValidationReport с цветовой индикацией | Красный/жёлтый/зелёный по категориям |
| UI-11 | SelectionSummary сохраняет выбор в Project State | Core Loop + USP сохранены |
| UI-12 | Sidebar индикатор прогресса обновляется | Блок 1 → зелёный после заполнения |

---

### 5.2 Блок 2: Core Loop (UI-13 — UI-20)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-13 | Страница /blocks/2 загружается | Отображается визуальный редактор |
| UI-14 | StructuralTypeCard: Engine/Economy/Ecology | Выбор типа с визуальным объяснением |
| UI-15 | CoreLoopDiagram: круговая визуализация шагов | Drag-and-drop, модальное окно редактирования |
| UI-16 | LoopHierarchyTree: сворачиваемое дерево | 6 уровней: микро → мета |
| UI-17 | PathologyPanel: список патологий | runaway, deadlock, stall, brittleness |
| UI-18 | ValidationPanel: чек-лист валидации | «30 секунд веселья», замкнутость петли |
| UI-19 | RecommendationsPanel: AI-рекомендации | Кнопка «Применить» для каждой |
| UI-20 | Автозаполнение из данных Блока 1 | Жанр, механики предзаполняют вход |

---

### 5.3 Блок 3: MDA (UI-21 — UI-27)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-21 | Страница /blocks/3 загружается | 4 режима через Tabs |
| UI-22 | MDAInputForm: ввод механик | Текстовое поле / теговый ввод |
| UI-23 | ReverseMDAPanel: целевая эстетика, результат | Выбор эстетики → рекомендованные механики |
| UI-24 | ClassicMDAPanel: анализ геймплея | Ввод механик → карта эстетических ценностей |
| UI-25 | LensAuditPanel: 9 линз Шелла | Вопросы, оценка по каждой линзе |
| UI-26 | BondMatrixPanel: таблица 4×3 | Интерактивная таблица, авто-проверка согласованности |
| UI-27 | Автозаполнение из данных Блоков 1-2 | Концепция + Core Loop предзаполняют вход |

---

### 5.4 Блок 4: Баланс (UI-28 — UI-34)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-28 | Страница /blocks/4 загружается | Таблица, payoff-матрица, графики |
| UI-29 | ObjectForm: добавление/удаление объектов | + / — кнопки, валидация |
| UI-30 | TransitiveAnalysisTab: таблица с цветовой индикацией | Элемент, Cost, Power, C/P Ratio, Статус |
| UI-31 | PayoffMatrixTab: тепловая карта N×N | Интерактивная таблица, тултипы |
| UI-32 | SimulationChartsTab: графики Monte Carlo | Win rate, распределение длительности |
| UI-33 | MachinationsVisualizationTab: граф ресурсов | Узлы, связи, анимация потока |
| UI-34 | CorrectionsPanelTab: AI-рекомендации | Список коррекций, кнопки «Применить» |

---

### 5.5 Блок 5: Прогрессия/Экономика (UI-35 — UI-42)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-35 | Страница /blocks/5 загружается | Две вкладки: Прогрессия и Экономика |
| UI-36 | Вкладка «Прогрессия»: MacroParamsTab, TiersTab, CurvesTab, ContentPlanTab, ValidationTab | 5 подтабов рендерятся |
| UI-37 | Вкладка «Экономика»: ResourcesTab, ClassificationTab, MachinationsEconomyTab, DiagnosticsTab, SimulationEconomyTab | 5 подтабов рендерятся |
| UI-38 | Кривые прогрессии: 4 графика (XP, Power, Cost, Difficulty) | Визуализация 4 кривых |
| UI-39 | Machinations-визуализация с узлами | Drag-and-drop Source, Pool, Drain, Converter |
| UI-40 | Диагностика патологий с severity badges | Critical/Warning/Info бейджи |
| UI-41 | Faucet/drain ratios таблица | Визуализация баланса источников и стоков |
| UI-42 | Quality assessment панели | Оценка качества экономики |

---

### 5.6 Блок 6: GDD (UI-43 — UI-49)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-43 | Страница /blocks/6 загружается | Формат, предпросмотр, редактор, согласованность, экспорт, чек-листы |
| UI-44 | GDDFormatSelector: 8 форматов GDD | one_sheet, full_gdd, treatment и т.д. |
| UI-45 | GDDPreview: Markdown-рендерер, оглавление | Сворачиваемые секции, бейджи источников |
| UI-46 | GDDSectionEditor: inline-редактирование | Markdown-редактор, AI-подсказки |
| UI-47 | ConsistencyPanel: несоответствия с severity | Список issues, кнопки «Исправить» |
| UI-48 | ExportPanel: PDF/DOCX/HTML/MD экспорт | Прогресс-бар → скачивание файла |
| UI-49 | ChecklistPanel: 5 типов чек-листов | MDA, Balance, Narrative, Economy, Lens |

---

### 5.7 Блок 7: AI-ассистент (UI-50 — UI-56)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-50 | Страница /blocks/7 загружается | Чат-панель, поле ввода, подсказки |
| UI-51 | Чат: отправка сообщения, получение ответа | Ввод → отправка → ответ AI |
| UI-52 | SSE streaming: token-by-token отображение | Курсор, пошаговое появление текста |
| UI-53 | Кнопка остановки генерации | Stop → прерывание streaming |
| UI-54 | Подсказки: блок-селектор (1-8), контекстные рекомендации | Выбор блока → релевантные подсказки |
| UI-55 | Уведомления: проактивные алерты с severity | Runaway/deadlock/диссонанс → автоматическое уведомление |
| UI-56 | История чата: группировка по датам, пагинация | Список сессий, подгрузка старых сообщений |

---

### 5.8 Блок 8: GBE Integration (UI-57 — UI-62)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-57 | Страница /blocks/8 загружается | Вкладки: Подключение, Синхронизация, История, Настройки |
| UI-58 | Вкладка «Подключение»: форма URL/API-ключ, тест | Ввод → кнопка «Проверить» → статус |
| UI-59 | Вкладка «Синхронизация»: экспорт/импорт | Кнопки → прогресс → результат |
| UI-60 | Вкладка «История»: таблица записей | sync_id, timestamp, direction, status |
| UI-61 | Вкладка «Настройки»: направление, сущности, вебхук | Bidirectional/单向, чекбоксы, вебхук-симуляция |
| UI-62 | MOCK-бейдж отображается | Жёлтый/янтарный бейдж «MOCK» |

---

### 5.9 Общий UI (UI-63 — UI-70)

| ID | Тест-кейс | Что проверяет |
|----|-----------|---------------|
| UI-63 | Авторизация: логин/регистрация/защищённые маршруты | Формы, редиректы, JWT |
| UI-64 | Навигация: sidebar, переключение блоков | 8 блоков кликабельны, active state |
| UI-65 | Error boundary: отображение ошибки, retry | Fallback UI, кнопка повтора |
| UI-66 | Responsive: мобильная адаптация | Сайдбар → hamburger, таблицы → карточки |
| UI-67 | Тёмная/светлая тема | Переключение, корректные цвета |
| UI-68 | Pipeline-уведомления: stale-блоки | Toast: «Рекомендуется пересчитать» |
| UI-69 | Skeleton loading при загрузке | Placeholder → контент |
| UI-70 | Toast-уведомления | Появление, авто-скрытие, типы (success/error/warning/info) |

---

## 6. E2E-тесты — 10 сценариев (7 ручных + 3 автоматизированных Playwright)

### 6.1 Автоматизированные E2E-тесты (Playwright) — 17 тестов в 5 файлах

> **4.E.6**: Комплексное E2E-тестирование реализовано с Playwright. Все API-вызовы замоканы через `page.route()` — не требуют реального backend/AI.

```
e2e/
├── auth.spec.ts          # Сценарий 5: Авторизация (5 тестов)
├── pipeline.spec.ts      # Сценарий 1: Pipeline (4 теста)
├── balance.spec.ts       # Сценарий 2: Баланс (3 теста)
├── ai-assistant.spec.ts  # Сценарий 3: AI-ассистент (3 теста)
└── export.spec.ts        # Сценарий 4: Экспорт (2 теста)
```

**auth.spec.ts — 5 тестов (Сценарий 5: Авторизация)**

| ID | Тест | Что проверяет |
|----|------|---------------|
| E2E-A1 | Регистрация нового пользователя | Форма регистрации → success redirect |
| E2E-A2 | Регистрация с существующим email | Error message display |
| E2E-A3 | Логин с верными данными | Login → redirect to /projects |
| E2E-A4 | Логин с неверным паролем | Error message display |
| E2E-A5 | Защищённый маршрут редиректит на /login | Unauthenticated → /login |

**pipeline.spec.ts — 4 теста (Сценарий 1: От идеи до GDD)**

| ID | Тест | Что проверяет |
|----|------|---------------|
| E2E-P1 | Полный пайплайн: проект → Блок 1 → Блок 2 | Создание проекта, ввод идеи, навигация |
| E2E-P2 | Индикатор прогресса обновляется | Блок заполняется → sidebar update |
| E2E-P3 | Уведомление пайплайна при изменении upstream | Блок 1 обновлён → toast notification |
| E2E-P4 | Устаревшие блоки показывают предупреждение | Stale badge отображается |

**balance.spec.ts — 3 теста (Сценарий 2: Проверка баланса)**

| ID | Тест | Что проверяет |
|----|------|---------------|
| E2E-B1 | Транзитивный анализ | Ввод данных → таблица cost/power |
| E2E-B2 | Интранзитивный анализ | Payoff-матрица → результаты |
| E2E-B3 | Monte Carlo симуляция | Запуск → графики win rate |

**ai-assistant.spec.ts — 3 теста (Сценарий 3: AI-ассистент)**

| ID | Тест | Что проверяет |
|----|------|---------------|
| E2E-AI1 | Отправка сообщения AI-ассистенту | SSE streaming mock → ответ |
| E2E-AI2 | Контекстные подсказки | Suggestions для текущего блока |
| E2E-AI3 | Проактивные алерты | Economy pathology alerts |

**export.spec.ts — 2 теста (Сценарий 4: Экспорт)**

| ID | Тест | Что проверяет |
|----|------|---------------|
| E2E-E1 | Генерация GDD документа | Все секции заполнены |
| E2E-E2 | Экспорт GDD в PDF | PDF download |

---

### 6.2 Ручные E2E-сценарии (7 сценариев)

### E2E-01: Полный пайплайн «идея → GDD» за ≤ 60 минут

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

### E2E-02: Проверка баланса: ввод данных → анализ → коррекция

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

### E2E-03: AI-ассистент: вопрос → ответ → контекстные подсказки

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

### E2E-04: Экспорт GDD: генерация → PDF

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

### E2E-05: Авторизация: регистрация → логин → доступ к проектам

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

### E2E-06: GBE интеграция: подключение → экспорт → история

**Шаги**:
1. Проект с заполненными данными
2. Блок 8: Ввод API-ключа GBE
3. Проверка подключения → успех
4. Экспорт в GBE → маппинг данных
5. Импорт из GBE → обновление данных
6. Просмотр истории синхронизаций

**Ожидаемый результат**: Двусторонняя синхронизация с GBE

---

### E2E-07: Stale-каскад: изменение Блока 1 → уведомления

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

### E2E-08: Error recovery: network error → retry → success

**Шаги**:
1. Открыть проект → запустить генерацию
2. Отключить сеть → ошибка → error boundary
3. Восстановить сеть → нажать Retry
4. Проверка: операция выполнена успешно
5. Проверка: toast-уведомление об успехе

**Ожидаемый результат**: Graceful error recovery, нет краша приложения

---

### E2E-09: Responsive: мобильный вид → навигация → заполнение формы

**Шаги**:
1. Открыть приложение на мобильном viewport (375px)
2. Сайдбар скрыт → hamburger виден
3. Открыть сайдбар → выбрать Блок 1
4. Заполнить форму идеи
5. Отправить → просмотр результата
6. Проверка: таблицы адаптированы в карточки

**Ожидаемый результат**: Полная функциональность на мобильном устройстве

---

### E2E-10: Multi-project: создание 2 проектов → переключение → данные изолированы

**Шаги**:
1. Создать проект A «RPG» → заполнить Блок 1
2. Создать проект B «Strategy» → заполнить Блок 1
3. Переключиться на проект A → данные RPG на месте
4. Переключиться на проект B → данные Strategy на месте
5. Изменить данные в проекте B
6. Вернуться в проект A → данные не изменились

**Ожидаемый результат**: Полная изоляция данных между проектами

---

## 7. Покрытие тестами — сводная таблица по всем модулям

### 7.1 По фазам разработки

| Фаза | Модуль | Backend тесты | Frontend тесты | UI ручные | Статус |
|------|--------|---------------|----------------|-----------|--------|
| **4.A** | 4.A.1: Monorepo setup | — | — | — | ✅ Не нужны |
| **4.A** | 4.A.2: Next.js setup | — | 16 (мин.) | — | ⚠️ Минимально |
| **4.A** | 4.A.3: FastAPI setup | 2 | — | — | ✅ |
| **4.A** | 4.A.4: PostgreSQL schema | — (via models) | — | — | ✅ Через модели |
| **4.A** | 4.A.5: Auth | 6 | — | — | ✅ |
| **4.A** | 4.A.6: Projects CRUD | 4 | — | — | ✅ |
| **4.A** | 4.A.7: AI Service (PromptExecutor) | 8 (registry) | — | — | ✅ Registry |
| **4.A** | 4.A.8: Prompt Registry | 8 | — | — | ✅ |
| **4.A** | 4.A.9: Redis | — (partial) | — | — | ⚠️ Через pipeline |
| **4.A** | 4.A.10: RAG | 12 + 6 = 18 | — | — | ✅ |
| **4.A** | 4.A.11: CI/CD | — | — | — | ✅ Инфраструктура |
| **4.A** | 4.A.12: Shared types | — (via sync) | — | — | ✅ Через sync_types |
| **4.B** | 4.B.1-4.B.5: Concept | 41 | 0 | UI-01–UI-12 | ✅ Backend |
| **4.B** | 4.B.6-4.B.8: Core Loop | 40 | 0 | UI-13–UI-20 | ✅ Backend |
| **4.B** | 4.B.9-4.B.11: MDA | 45 | 0 | UI-21–UI-27 | ✅ Backend |
| **4.B** | 4.B.12: Pipeline 1→2→3 | 31 | — | — | ✅ |
| **4.C** | 4.C.1-4.C.3: Balance | 77 | 0 | UI-28–UI-34 | ✅ Backend |
| **4.C** | 4.C.4: Balance UI | — | 0 | UI-28–UI-34 | ❌ Нет frontend |
| **4.C** | 4.C.5-4.C.7: Progression | 45 | 0 | UI-35–UI-42 | ✅ Backend |
| **4.C** | 4.C.6: Economy | 83 | 0 | UI-35–UI-42 | ✅ Backend |
| **4.C** | 4.C.8: Economy UI | — | 0 | UI-35–UI-42 | ❌ Нет frontend |
| **4.C** | 4.C.9-4.C.10: Pipeline 1-5 | 28 + 31 = 59 | — | — | ✅ |
| **4.D** | 4.D.1-4.D.3: GDD | 108 + 32 = 140 | 0 | UI-43–UI-49 | ✅ Backend |
| **4.D** | 4.D.4: Checklists | 95 | 0 | UI-49 | ✅ Backend |
| **4.D** | 4.D.5: GDD UI | — | 0 | UI-43–UI-49 | ❌ Нет frontend |
| **4.D** | 4.D.6-4.D.7: AI Assistant | 60 + 20 = 80 | 0 | UI-50–UI-56 | ✅ Backend |
| **4.D** | 4.D.8: AI Assistant UI | — | 0 | UI-50–UI-56 | ❌ Нет frontend |
| **4.D** | 4.D.9-4.D.10: Integration 6-7 | 60 + 42 = 102 | — | — | ✅ |
| **4.E** | 4.E.1: GBE Bridge | 69 | 0 | UI-57–UI-62 | ✅ Backend |
| **4.E** | 4.E.2: Block 8 UI | — | 0 | UI-57–UI-62 | ❌ Нет frontend |
| **4.E** | 4.E.3: Performance | — | — | — | ✅ Инфраструктура |
| **4.E** | 4.E.4: Error handling | — | 6 (classifyError) | UI-65 | ✅ Frontend error handling |
| **4.E** | 4.E.5: UI Polish | — | — | — | ✅ Завершено |
| **4.E** | 4.E.6: E2E Testing | — | — | 17 Playwright | ✅ 17 E2E тестов |
| **4.E** | 4.E.7-4.E.8 | — | — | — | 🔲 Не реализовано |

### 7.2 По типам тестов

| Категория | Текущее | Плановое | % выполнения |
|-----------|---------|----------|-------------|
| Backend pytest тестов | 928 | 928 | 100% |
| Frontend vitest тестов | 30 | 30 + 92 = ~122 | 24.6% |
| UI ручных тестов | 70 | 70 | 100% |
| E2E автоматизированных (Playwright) | 17 | 17 | 100% |
| E2E ручных сценариев | 7 | 7 | 100% |
| **Итого тест-кейсов** | **1052** | **~1144** | **92.0%** |

### 7.3 По сервисам (backend)

| Сервис | Текущее | Плановое | Статус |
|--------|---------|----------|--------|
| GDD Service | 140 | 140 | ✅ Полное покрытие |
| Checklist Service | 95 | 95 | ✅ Полное покрытие |
| Economy Service | 83 | 83 | ✅ Полное покрытие |
| Balance Service | 77 | 77 | ✅ Полное покрытие |
| GBE Bridge Service | 69 | 69 | ✅ Полное покрытие |
| AI Assistant Service | 60 | 60 | ✅ Полное покрытие |
| Pipeline Integration 6-7-8 | 60 | 60 | ✅ Полное покрытие |
| Blocks 6-7 Integration | 42 | 42 | ✅ Полное покрытие |
| Pipeline Service | 31 | 31 | ✅ Полное покрытие |
| AI Assistant API | 20 | 20 | ✅ Полное покрытие |
| RAG Service | 12 | 12 | ✅ Полное покрытие |
| Prompt Registry | 8 | 8 | ✅ Полное покрытие |
| Auth | 6 | 6 | ✅ Полное покрытие |
| TextChunker | 6 | 6 | ✅ Полное покрытие |
| Projects | 4 | 4 + 15 = ~19 | ⚠️ Расширение |
| Health | 2 | 2 | ✅ Полное покрытие |
| Full Pipeline (integration) | 28 | 28 | ✅ Полное покрытие |
| Concept Service | 41 | 41 | ✅ Полное покрытие |
| CoreLoop Service | 40 | 40 | ✅ Полное покрытие |
| MDA Service | 45 | 45 | ✅ Полное покрытие |
| Progression Service | 45 | 45 | ✅ Полное покрытие |
| Project Service | 14 | 14 | ✅ Полное покрытие |

---

## 8. Целевое покрытие

### 8.1 Текущее покрытие (версия 0.46.0)

| Метрика | Backend | Frontend | E2E |
|---------|---------|----------|-----|
| Тестов | 928 | 30 | 17 |
| Файлов тестов | 23 | 3 | 5 |
| Покрытие кода (оценка) | ~65% | ~10% | 5/5 сценариев |
| Сервисов с тестами | 20/20 | 2/20 | — |

### 8.2 Целевое покрытие после закрытия разрывов

| Метрика | Backend | Frontend | E2E |
|---------|---------|----------|-----|
| Тестов | 928 | ~122 | 17+ |
| Файлов тестов | 23 | ~15 | 5+ |
| Покрытие кода (цель) | ≥ 70% | ≥ 50% | — |
| Сервисов с тестами | 20/20 | ~15/20 | — |

### 8.3 Целевое покрытие по критерию C8 из ROADMAP

- **Backend**: ≥ 60% coverage (цель после P1+P2: ~70%)
- **Frontend**: ≥ 50% coverage (цель после P1+P2+P3: ~55%)
- **Каждый сервис**: ≥ 30 тестов
- **Каждый API endpoint**: ≥ 2 теста (success + error)
- **Каждый критический путь pipeline**: покрыт интеграционным тестом

### 8.4 Приоритеты закрытия разрывов

**Приоритет 1 (Критический) — 3 недели**:

| # | Задача | Тестов | Файл |
|---|--------|--------|------|
| P1-1 | Concept Service unit-тесты | ~50 | tests/test_concept_service.py |
| P1-2 | CoreLoop Service unit-тесты | ~40 | tests/test_coreloop_service.py |
| P1-3 | MDA Service unit-тесты | ~45 | tests/test_mda_service.py |
| P1-4 | Progression Service unit-тесты | ~40 | tests/test_progression_service.py |
| P1-5 | Frontend: Core Infrastructure | ~28 | src/__tests__/lib/, src/__tests__/hooks/ |
| P1-6 | Frontend: Block Components (Блоки 1-4) | ~20 | src/__tests__/blocks/ |
| | **Итого P1** | **~223** | |

**Приоритет 2 (Средний) — 2 недели**:

| # | Задача | Тестов | Файл |
|---|--------|--------|------|
| P2-1 | Project Service unit-тесты | ~15 | tests/test_project_service.py |
| P2-2 | Frontend: Block Components (Блоки 5-8) | ~15 | src/__tests__/blocks/ |
| P2-3 | Frontend: Layout & Navigation | ~12 | src/__tests__/layout/ |
| P2-4 | Frontend: Page-Level Integration | ~31 | src/__tests__/pages/ |
| | **Итого P2** | **~73** | |

**Приоритет 3 (Низкий) — 1 неделя**:

| # | Задача | Тестов | Файл |
|---|--------|--------|------|
| P3-1 | Playwright E2E: автоматизация | ~10 | e2e/ |
| P3-2 | Визуальная регрессия | ~8 | tests/visual/ |
| P3-3 | Accessibility-тесты | ~6 | tests/a11y/ |
| | **Итого P3** | **~24** | |

### 8.5 Итоговый план

| Приоритет | Backend | Frontend | E2E/Other | Срок |
|-----------|---------|----------|-----------|------|
| P1 Критический | ~175 | ~48 | — | 3 недели |
| P2 Средний | ~15 | ~58 | — | 2 недели |
| P3 Низкий | — | — | ~24 | 1 неделя |
| **Итого** | **~190** | **~106** | **~24** | **6 недель** |

**После закрытия всех разрывов**:
- Backend: 743 + 190 = **~933 тестов** (≥ 70% coverage)
- Frontend: 16 + 106 = **~122 тестов** (≥ 50% coverage)
- Общее количество тест-кейсов: **~1135**

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

## E2E-сценарии
| ID | Результат | Комментарий |
|----|-----------|-------------|
| E2E-01 | PASS/FAIL | |

## Найденные баги
1. [Критичность] Описание

## Замечания
- Заметки
```
