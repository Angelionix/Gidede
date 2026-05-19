# Gidede — Документ тестирования

> **Фаза**: 4.D.8 (UI AI-ассистент — Блок 7)
> **Дата**: 2026-03-05
> **Версия**: 0.36.1
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
| Интеграционные тесты | pytest | AI-сервис, RAG, Redis, полный пайплайн концепции | Частичная (с моками) |
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

## 2. Реальные автоматизированные тесты (текущее состояние)

### 2.1 Backend — pytest (650+ тестов в 18 файлах)

```
mini-services/api-service/tests/
├── conftest.py                    # Общие фикстуры
├── test_health.py                 # Health check API (2 теста)
├── test_auth.py                   # Авторизация (6 тестов)
├── test_projects.py               # CRUD проектов (4 теста)
├── test_rag_service.py            # RAG-сервис (12 тестов)
├── test_prompt_registry.py        # Реестр промптов (8 тестов)
├── test_text_chunker.py           # Разбиение текста на чанки (6 тестов)
├── test_balance_service.py        # Balance Service — транзитивный, интранзитивный,
│                                   #   ситуационный, Q-фактор, Monte Carlo,
│                                   #   Machinations (77 тестов)
├── test_economy_service.py        # Economy Service — все 8 этапов
│                                   #   алгоритма 3.6 (83 теста)
├── test_gdd_service.py            # GDD Service — Этапы 1-5 алгоритма 3.7
│                                   #   (107 тестов: Stage 1=22, Stage 2=12,
│                                   #   Stage 3=16, Stage 4=18, Stage 5=12,
│                                   #   Pipeline=27, Edge Cases included)
├── test_gdd_stages_6_8.py         # GDD Service — Этапы 6-8 алгоритма 3.7
│                                   #   (32 теста: Stage 6=14, Stage 7=7,
│                                   #   Stage 8=7, Pipeline 1-8=4)
├── test_pipeline_service.py       # Pipeline Service — сквозной пайплайн 1→5,
│                                   #   зависимости блоков, stale-каскад (29 тестов)
├── test_checklist_service.py      # Checklist Service (4.D.4) — define_scope,
│                                   #   MDA/balance/narrative/economy/lens checks,
│                                   #   aggregation, full pipeline, edge cases
│                                   #   (95 тестов)
├── test_ai_assistant_service.py   # AI Assistant Service (4.D.7) —
│                                   #   context building (8), session management (6),
│                                   #   message history (6), RAG search (6),
│                                   #   proactive alerts (12), suggestions (8),
│                                   #   chat pipeline (8), SSE streaming (6)
│                                   #   (60 тестов)
├── test_ai_assistant_api.py       # AI Assistant API (4.D.7) —
│                                   #   POST /chat (3), POST /chat/stream (3),
│                                   #   GET /suggestions (3), GET /alerts (2),
│                                   #   GET /history (3), POST /history/clear (2),
│                                   #   GET /status (2), POST /test (2)
│                                   #   (20 тестов)
└── integration/
    └── test_full_pipeline.py      # 4.C.10: Интеграционные тесты полного
                                     #   пайплайна Блоки 1–5 (22 теста)
```

#### 2.1.1 Инфраструктура (4.A)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-01 | `test_health_endpoint` | API отвечает на health check | test_health.py |
| B-02 | `test_health_version` | Health check возвращает версию из VERSION файла | test_health.py |

#### 2.1.2 Авторизация (4.A.5)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-03 | `test_register_user` | Регистрация нового пользователя | test_auth.py |
| B-04 | `test_register_duplicate_email` | Отклонение дублирующего email | test_auth.py |
| B-05 | `test_login_success` | Успешный логин с верными данными | test_auth.py |
| B-06 | `test_login_wrong_password` | Отклонение неверного пароля | test_auth.py |
| B-07 | `test_login_nonexistent_user` | Отклонение несуществующего пользователя | test_auth.py |
| B-08 | `test_protected_endpoint_without_token` | Блокировка доступа без авторизации | test_auth.py |

#### 2.1.3 Проекты (4.A.6)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-09 | `test_create_project` | Создание проекта | test_projects.py |
| B-10 | `test_list_projects` | Список проектов пользователя | test_projects.py |
| B-11 | `test_project_isolation` | Изоляция проектов между пользователями | test_projects.py |
| B-12 | `test_update_project` | Обновление данных проекта | test_projects.py |

#### 2.1.4 Реестр промптов (4.A.8)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-13 | `test_all_prompts_registered` | Все промпты в реестре | test_prompt_registry.py |
| B-14 | `test_prompt_spec_has_required_fields` | Структура PromptSpec | test_prompt_registry.py |
| B-15–B-20 | 6 тестов | Валидация конкретных промптов | test_prompt_registry.py |

#### 2.1.5 RAG-сервис (4.A.10)

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-21–B-32 | 12 тестов | Чанкинг текста, RAG-поиск, статистика | test_rag_service.py |

#### 2.1.6 TextChunker

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| B-33–B-38 | 6 тестов | Разбиение короткого и длинного текста, заголовки | test_text_chunker.py |

#### 2.1.7 Balance Service (4.C.1–4.C.3) — 77 тестов

| Категория | Количество тестов | Описание |
|-----------|-------------------|----------|
| Transitive-анализ | ~12 | Cost/power кривые, anchor-объект, веса атрибутов, situational value |
| Intransitive-анализ | ~10 | Payoff-матрица, доминантные стратегии, Nash Equilibrium |
| Ситуационный баланс | ~8 | Контекстная ценность, матрица «Объект x Ситуация» |
| Q-фактор | ~6 | Выявление избыточных компонентов |
| Monte Carlo-симуляция | ~12 | Моделирование N боёв, агрегация, discrepancy |
| Machinations-симуляция | ~15 | 8 типов узлов, граф потоков, паттерны Adams/Dormans |
| Quality Assessment | ~8 | 6 проверок качества, обнаружение патологий |
| Полный пайплайн | ~6 | Интеграция всех этапов балансировки |

#### 2.1.8 Economy Service (4.C.6) — 83 теста

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

**Stage 2: Классификация ресурсов (3.6.4) — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-16 | `test_classify_resources_by_type` | Классификация ресурсов по типу (tangible/abstract) |
| ECO-17 | `test_classify_resources_by_economy_role` | Роль в экономике (primary/secondary/tertiary) |
| ECO-18 | `test_classify_resources_by_scarcity` | Уровень дефицитности (abundant/limited/rare) |
| ECO-19 | `test_classify_rpg_economy_type` | RPG → командная экономика |
| ECO-20 | `test_classify_strategy_economy_type` | Strategy → рыночная экономика |
| ECO-21 | `test_classify_survival_economy_type` | Survival → смешанная экономика |
| ECO-22 | `test_sub_type_by_genre` | Sub-type определяется по жанру |
| ECO-23 | `test_openness_by_monetization` | openness_level зависит от модели монетизации |
| ECO-24 | `test_risk_level_computation` | risk_level вычисляется на основе volatility |
| ECO-25 | `test_classify_empty_resources` | Пустой список ресурсов → graceful degradation |

**Stage 3: Проектирование ресурсных потоков (3.6.5) — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-26 | `test_design_resource_flows` | Создание faucet→pool→drain потоков |
| ECO-27 | `test_flow_directions` | Направления: positive (faucet), negative (drain), bidirectional |
| ECO-28 | `test_feedback_loops` | Обнаружение положительных и отрицательных feedback loops |
| ECO-29 | `test_exchange_rates` | Курс обмена между ресурсами |
| ECO-30 | `test_flow_balancing` | Балансировка faucet/drain по жанру |
| ECO-31 | `test_circular_dependencies` | Обнаружение циклических зависимостей |
| ECO-32 | `test_resource_converters` | Конвертеры ресурсов (рецепты, крафт) |
| ECO-33 | `test_flow_from_core_loop` | Потоки извлекаются из шагов CoreLoop |
| ECO-34 | `test_dynamic_flows` | Условные потоки (ситуационные) |
| ECO-35 | `test_empty_flows_fallback` | Нет данных → минимальные дефолтные потоки |

**Stage 4: Machinations-моделирование (3.6.6) — 12 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-36 | `test_machinations_node_types` | 8 типов узлов Machinations |
| ECO-37 | `test_pool_node` | Pool-узел: накопление ресурса |
| ECO-38 | `test_source_node` | Source-узел: генерация ресурса |
| ECO-39 | `test_drain_node` | Drain-узел: расход ресурса |
| ECO-40 | `test_converter_node` | Converter-узел: трансформация ресурса |
| ECO-41 | `test_trader_node` | Trader-узел: обмен ресурсами |
| ECO-42 | `test_gate_node` | Gate-узел: условный проход |
| ECO-43 | `test_delay_node` | Delay-узел: задержка ресурса |
| ECO-44 | `test_resource_connections` | Связи между узлами с весами |
| ECO-45 | `test_adams_dormans_patterns` | Паттерны Adams/Dormans (4 паттерна) |
| ECO-46 | `test_machinations_graph` | Полный граф Machinations |
| ECO-47 | `test_machinations_simulation` | Симуляция 10 тиков графа Machinations |

**Stage 5: Диагностика патологий (3.6.7) — 12 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-48 | `test_detect_runaway` | Обнаружение runaway-инфляции |
| ECO-49 | `test_detect_deadlock` | Обнаружение ресурсного deadlock |
| ECO-50 | `test_detect_starvation` | Обнаружение starvation-дефицита |
| ECO-51 | `test_detect_trivial_decisions` | Обнаружение тривиальных решений |
| ECO-52 | `test_detect_grind` | Обнаружение grind-паттерна |
| ECO-53 | `test_detect_snowball` | Обнаружение snowball-эффекта |
| ECO-54 | `test_severity_levels` | Уровни severity: low/medium/high/critical |
| ECO-55 | `test_pathology_remediation` | Рекомендации по исправлению для каждой патологии |
| ECO-56 | `test_faucet_drain_ratio` | Вычисление faucet/drain ratio |
| ECO-57 | `test_combined_pathologies` | Несколько патологий одновременно |
| ECO-58 | `test_no_pathologies` | Здоровая экономика → пустой список |
| ECO-59 | `test_pathology_edge_cases` | Граничные случаи (0 ресурсов, 1 ресурс) |

**Stage 6: Балансировка экономики (3.6.8) — 12 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-60 | `test_balance_resources_by_genre` | Балансировка ресурсов с учётом жанра |
| ECO-61 | `test_adjust_exchange_rates` | Корректировка курсов обмена |
| ECO-62 | `test_balance_faucet_drain` | Балансировка faucet/drain |
| ECO-63 | `test_elimininate_deadlock` | Устранение deadlock через корректировки |
| ECO-64 | `test_eliminate_runaway` | Устранение runaway через ограничения |
| ECO-65 | `test_balance_feedback_loops` | Балансировка feedback loops |
| ECO-66 | `test_q_factor_computation` | Вычисление Q-фактора для экономики |
| ECO-67 | `test_balance_iterations` | Итеративная балансировка (до 5 итераций) |
| ECO-68 | `test_balance_convergence` | Сходимость балансировки |
| ECO-69 | `test_balance_with_ai_suggestions` | AI-рекомендации по балансировке |
| ECO-70 | `test_balance_no_issues` | Нет проблем → экономика без изменений |
| ECO-71 | `test_balance_preserves_core_mechanics` | Балансировка не ломает core-механики |

**Stage 7: Симуляция экономики (3.6.9) — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-72 | `test_simulate_economy_n_ticks` | Симуляция N тиков экономики |
| ECO-73 | `test_resource_curves` | Кривые ресурсов во времени |
| ECO-74 | `test_quality_assessment` | Оценка качества экономики (score 0-100) |
| ECO-75 | `test_simulate_with_random_events` | Симуляция со случайными событиями |
| ECO-76 | `test_discrepancy_computation` | Вычисление расхождения между ожиданием и результатом |
| ECO-77 | `test_simulate_empty_economy` | Пустая экономика → graceful degradation |
| ECO-78 | `test_simulation_latency` | Latency < 3000ms для mock AI |
| ECO-79 | `test_simulation_deterministic` | Одинаковые входные данные → одинаковый результат |

**Full Economy Pipeline — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-80 | `test_full_economy_pipeline` | Все 7 этапов последовательно, EconomyProfile заполнен |
| ECO-81 | `test_economy_pipeline_with_balance_issues` | Pipeline с обнаружением и исправлением патологий |
| ECO-82 | `test_economy_pipeline_partial_data` | Pipeline с частичными данными, warnings |
| ECO-83 | `test_economy_pipeline_latency` | Полный pipeline < 10000ms для mock AI |

#### 2.1.9 GDD Service (4.D.1–4.D.3) — 139 тестов

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
| Секции по формату | 4 | full_gdd=38, one_sheet=6, ten_pager=10, modular=13 |
| Готовность с данными | 2 | concept present → title ready, no data → manual_required |
| Покрытие | 2 | all blocks → high coverage, no data → 0 coverage |
| Классификация | 4 | auto_fillable, manual, ai_generatable, source fields |

**Stage 3: Автозаполнение секций (3.7.5) — 16 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Автозаполнение из блоков | 8 | title←concept, core_loop←coreLoop, mechanics←mdaProfile, progression, economy, balance, resources, logline |
| Пустые данные | 1 | no data → no auto-filled sections |
| Флаги и доп. данные | 4 | requires_review, diagram, tables, formulas |
| Modular-секции | 3 | concept_overview, mda_analysis, balance_tables |

**Stage 4: AI-генерация и обогащение (3.7.6) — 18 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| AI-enrichment | 6 | ENRICH_SECTION для автозаполненных секций, проверка enriched_sections, обработка ошибок, coverage |
| AI-генерация с нуля | 6 | GENERATE_CHARACTERS_SECTION, GENERATE_VISUAL_STYLE, GENERATE_STORY_SECTION, GENERATE_CONTROLS_SECTION, GENERATE_WORLD_STRUCTURE, source marking |
| Обработка ошибок | 4 | Частичные и полные ошибки AI, failed_sections, graceful degradation |
| Edge cases | 2 | Нет автозаполненных секций, комбинированный enrich+generate |

**Stage 5: Ручные секции с подсказками (3.7.7) — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Скелеты секций | 5 | Генерация шаблонов, приоритизация critical/important/optional |
| AI-подсказки | 4 | AI_GENERATE_SECTION_HINTS, fallback при ошибке, estimated_effort, классификация |
| Edge cases | 3 | Нет ручных секций, только critical, все optional |

**Полный пайплайн 1-5 + Edge Cases — 27 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Pipeline 1-3 | 4 | stages_completed, coverage, one_sheet pipeline, no-data pipeline |
| Pipeline 1-5 | 6 | Все 5 этапов, GDDProfile, full data, coverage increase, latency, graceful no-data |
| Метрики | 2 | latency_ms, coverage_score |
| Оценка страниц | 2 | full_gdd+detailed=75, mmorpg+exhaustive=125 |
| Edge Cases | 13 | Composite sources, missing subpath, custom sections, export_formats, detail override, unknown genre fallback |

#### 2.1.10 GDD Service Stages 6-8 (4.D.3) — 32 теста

**Stage 6: Сшивка и валидация (3.7.8) — 14 тестов**

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

**Stage 7: Форматирование документа (3.7.9) — 7 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Markdown-генерация | 3 | Title из concept, оглавление, нумерация секций |
| Метрики | 2 | word_count, estimated_pages (250 слов/страница) |
| Edge cases | 2 | Пустой документ, section_count совпадает |

**Stage 8: Экспорт (PDF/DOCX/HTML/MD) — 7 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| MD-экспорт | 1 | text/markdown content, .md file_name |
| HTML-экспорт | 1 | HTML с CSS-стилями |
| PDF-экспорт | 1 | WeasyPrint или fallback на HTML |
| DOCX-экспорт | 1 | python-docx или graceful failure |
| content_type / file_name | 2 | Корректные MIME-типы и имена файлов |
| Пустой документ | 1 | Обработка пустого содержимого |

**Полный пайплайн 1-8 — 4 теста**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Завершение этапов | 1 | stages_completed содержит 1-7 |
| Покрытие с полными данными | 1 | High coverage с 6 блоками данных |
| assembled_document | 1 | Популирован с ConsistencyReport |
| formatted_document | 1 | Markdown + word_count заполнены |

#### 2.1.11 Pipeline Service (4.C.9) — 29 тестов

**Подготовка входных данных для Блока 4 (_prepare_balance_input) — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-01 | `test_balance_input_with_all_blocks` | Все блоки заполнены — полные данные с genre, concept_data, core_loop_data, mda_data |
| PIPE-02 | `test_balance_input_missing_concept` | Нет концепции — предупреждение |
| PIPE-03 | `test_balance_input_missing_core_loop` | Нет Core Loop — предупреждение о циклах |
| PIPE-04 | `test_balance_input_missing_mda` | Нет MDA — предупреждение о механиках |

**Подготовка входных данных для Блока 5 (_prepare_progression_and_economy_input) — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-05 | `test_full_input_with_all_blocks` | Все 4 блока заполнены — progression_input + economy_input |
| PIPE-06 | `test_progression_input_extracts_resources` | Ресурсы извлекаются из CoreLoop шагов |
| PIPE-07 | `test_progression_input_with_existing_progression` | Связь прогрессии с экономикой |
| PIPE-08 | `test_missing_all_previous_blocks` | 4 предупреждения при пустых блоках |

**Зависимости и STALE_DOWNSTREAM — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-09 | `test_block_1_stale_downstream` | Блок 1 → stale Блоки 2-8 |
| PIPE-10 | `test_block_4_stale_downstream` | Блок 4 → stale Блоки 5, 6, 8 |
| PIPE-11 | `test_block_5_stale_downstream` | Блок 5 → stale Блоки 6, 8 |
| PIPE-12 | `test_block_dependencies_chain` | Цепочка 1→2→3→4→5 |
| PIPE-13 | `test_all_blocks_have_events` | Блоки 1-6 генерируют события |

**Уведомления и stale-механика — 4 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-14 | `test_notify_block_4_marks_5_6_8_stale` | Обновление Блока 4 → stale 5, 6, 8 |
| PIPE-15 | `test_notify_block_1_marks_many_stale` | Обновление Блока 1 → 7 stale-блоков |
| PIPE-16 | `test_notify_unknown_block_ignored` | Неизвестный блок не генерирует событий |
| PIPE-17 | `test_clear_stale_no_redis` | Без Redis clear_stale всегда успешен |

**Модели данных — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-18 | `test_block_progress_to_dict` | Сериализация BlockProgress |
| PIPE-19 | `test_pipeline_state_to_dict` | Сериализация PipelineState |
| PIPE-20 | `test_block_status_values` | Все 4 статуса корректны |
| PIPE-21 | `test_pipeline_event_values` | Все события пайплайна |
| PIPE-22 | `test_flag_key_mapping` | Маппинг block_id → флаг для всех 8 блоков |

**Уведомления — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-23 | `test_stale_block_5_notification` | Stale Блок 5 → уведомление |
| PIPE-24 | `test_no_notifications_for_completed` | Завершённые блоки не генерируют уведомлений |
| PIPE-25 | `test_multiple_stale_blocks` | Несколько stale → несколько уведомлений |

**Определение следующего блока — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-26 | `test_first_empty_block` | Первый пустой блок — следующий |
| PIPE-27 | `test_stale_block_when_all_filled` | Все заполнены, но stale → первый stale |
| PIPE-28 | `test_all_good_returns_none` | Все OK → None |

**API endpoint для полного пайплайна — 1 тест**

| ID | Тест | Что проверяет |
|----|------|---------------|
| PIPE-29 | `test_run_full_pipeline_endpoint_exists` | POST /run-full-pipeline/{project_id} доступен |

#### 2.1.12 Integration Tests (4.C.10) — 22 теста

**INT-01: Полный пайплайн «идея → экономика» с mock AI — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-01 | `test_full_pipeline_produces_all_blocks` | Все 5 блоков заполнены после полного пайплайна, нет null-ошибок |
| INT-02 | `test_pipeline_state_reflects_all_blocks` | PipelineState отражает заполненность всех 5 блоков |

**INT-02: Целостность передачи данных между блоками — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-03 | `test_block2_receives_concept_data` | Блок 2 получает genre, mechanics, aesthetic_profile из Блока 1 |
| INT-04 | `test_block3_receives_concept_and_coreloop_data` | Блок 3 получает idea, mechanics, core_loop_data из Блоков 1+2 |
| INT-05 | `test_block4_receives_all_previous_data` | Блок 4 получает concept_data, core_loop_data, mda_data из Блоков 1-3 |
| INT-06 | `test_block5_receives_progression_and_economy_inputs` | Блок 5 получает progression_input + economy_input из Блоков 1-4 |
| INT-07 | `test_resources_extracted_from_core_loop_steps` | Ресурсы (ingredients, potions, gold) извлекаются из шагов Core Loop |

**INT-03: Graceful degradation при частичном заполнении — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-08 | `test_block4_with_only_concept` | Блок 4 работает только с данными Блока 1, warnings о Core Loop и MDA |
| INT-09 | `test_block5_with_missing_balance` | Блок 5 без Блока 4 — progression_input + economy_input формируются |
| INT-10 | `test_block5_with_only_concept` | Блок 5 с минимальными данными (только концепция) — 3 warnings |

**INT-04: Cascade stale-обновления — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-11 | `test_concept_change_cascades_to_all` | Изменение Блока 1 → все Блоки 2-8 stale |
| INT-12 | `test_coreloop_change_cascades_correctly` | Изменение Блока 2 → Блоки 3-8 stale (1 не stale) |
| INT-13 | `test_mda_change_does_not_affect_earlier_blocks` | Изменение Блока 3 → Блоки 4-8 stale (1,2 не stale) |
| INT-14 | `test_balance_change_affects_progression_and_gdd` | Изменение Блока 4 → Блоки 5, 6, 8 stale |
| INT-15 | `test_progression_change_affects_gdd_only` | Изменение Блока 5 → Блоки 6, 8 stale |

**INT-05: Pipeline prepare_input для каждого блока — 5 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-16 | `test_prepare_block2_input` | CoreLoopInput: genre, mechanics, aesthetic_profile, core_loop_candidates |
| INT-17 | `test_prepare_block3_input` | MDAInput: idea, genre, primary_aesthetic, existing_mechanics, core_loop_data |
| INT-18 | `test_prepare_block4_input` | BalanceInput: genre, concept_data, core_loop_data, mda_data |
| INT-19 | `test_prepare_block5_input` | ProgressionInput + EconomyInput: разделение данных для прогрессии и экономики |
| INT-20 | `test_missing_concept_returns_error_for_block2` | Без концепции Блок 2 → статус missing_concept |

**INT-06: Валидация формата выходных данных — 7 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| INT-21 | `test_concept_output_has_required_fields` | OnePager: genre, aesthetic_profile, mechanic_set, one_pager_data |
| INT-22 | `test_coreloop_output_has_required_fields` | CoreLoopProfile: structural_type, steps_data, mechanics в шагах |
| INT-23 | `test_mda_output_has_required_fields` | MDAProfile: primary_aesthetic, overall_match, mechanic_set, match_scores |
| INT-24 | `test_balance_output_has_required_fields` | BalanceResult: balance_type, elements с name/cost/power/cp_ratio/status |
| INT-25 | `test_progression_output_has_required_fields` | ProgressionProfile: total_levels, curves (4 кривые), tier_count |
| INT-26 | `test_economy_output_has_required_fields` | EconomyProfile: system_type, resource_model (core + subsidiary) |
| INT-27 | `test_balance_elements_status_values` | Статусы элементов в допустимом наборе: balanced/overpowered/underpowered/ideal_imbalance |

#### 2.1.13 Checklist Service (4.D.4) — 95 тестов

**TestDefineScope — 11 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Выбор чеклиста по этапу | 3 | concept→concept_checklist, prototype→prototype_checklist, production→production_checklist |
| Явные переопределения | 3 | explicit_checklist > stage, custom_checks добавляются, override заменяет дефолт |
| Проверки по жанру | 3 | rpg→narrative_check, strategy→balance_check, puzzle→economy_skip |
| Маппинг глубины | 1 | depth=quick → subset checks, depth=full → all checks |
| Оценка estimated checks | 1 | Возвращает корректное количество проверок |

**TestMDACheck — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip при отсутствии данных | 2 | Нет MDA-профиля → skip, Нет aesthetic_profile → skip |
| Aesthetic orphan | 2 | Эстетика без механики → warning, Несколько orphan → несколько warnings |
| Dynamic orphan | 2 | Динамика без механики → warning, Связанная динамика → pass |
| MDA-пробелы | 2 | aesthetics < 3 → gap warning, mechanics < 3 → gap warning |
| Bond dissonance | 2 | Конфликт Bond-матрицы → error, Согласованная Bond → pass |
| Полный профиль — скоринг | 2 | Full profile → score > 0.7, Empty profile → score 0.0 |

**TestBalanceCheck — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip при отсутствии данных | 2 | Нет balance_result → skip, Нет элементов → skip |
| Overpowered/Underpowered | 2 | >20% overpowered → error, >20% underpowered → error |
| Доминантная стратегия | 2 | dominant_strategy detected → critical, no dominant → pass |
| Grind | 2 | grind_pattern detected → warning, no grind → pass |
| Difficulty wall | 2 | difficulty_wall detected → error, smooth curve → pass |
| Depth-фильтрация | 2 | depth=quick → только critical checks, depth=full → все проверки |

**TestNarrativeCheck — 10 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip для не-нарративных | 2 | puzzle → skip narrative, rpg → run narrative |
| Ludonarrative dissonance | 2 | narrative↔mechanics конфликт → error, согласие → pass |
| Ludonarrative irony | 2 | intentional irony → info, unintentional irony → warning |
| Ludonarrative harmony | 1 | harmony → pass с positive remark |
| Agency gaps | 1 | agency_gap detected → warning |
| Структура нарратива | 1 | Нет arc → warning, Есть arc → pass |
| Quest variety | 1 | <3 quest types → warning, >=3 → pass |

**TestEconomyCheck — 10 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Skip при отсутствии данных | 2 | Нет economy_profile → skip, Нет resource_model → skip |
| Runaway | 2 | runaway detected → critical, stable → pass |
| Deadlock | 2 | deadlock detected → error, fluid → pass |
| Q-factor inflation/scarcity/balanced | 3 | inflation → warning, scarcity → warning, balanced → pass |
| Profitability | 1 | negative_profit → error, positive → pass |

**TestLensCheck — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Base lenses | 2 | Минимум 4 линзы, каждая с вопросами и оценкой |
| Genre-specific | 2 | rpg→narrative_lens, strategy→balance_lens |
| Problem-driven | 1 | issues→подбор линз по проблемам |
| Score severity | 1 | low score → high severity lens |
| AI fallback | 1 | AI-ошибка → fallback на дефолтные линзы |
| Max 20 lenses | 1 | >20 проблем → ограничение до 20 линз |

**TestAggregation — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Слияние issues | 2 | issues из всех checks объединяются, нет потерь |
| Дедупликация | 2 | Одинаковые issues → одна запись, похожие → группировка |
| Повышение severity | 2 | duplicate warning → error, triplicate → critical |
| Приоритетная сортировка | 2 | critical первые, info последние |
| Top-5 | 1 | Возвращает top-5 критических проблем |
| Quick wins | 1 | Возвращает quick_wins с low effort |
| Score 0-100 | 1 | 0 issues → 100, все critical → 0, промежуточный → 40-80 |
| Readiness levels | 1 | score>=80 → ready, 50-79 → almost, <50 → not_ready |

**TestFullPipeline — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Все блоки | 1 | Полные данные → все checks запущены, все issues собраны |
| Нет данных | 1 | Все checks → skip, score=100 (нет проблем) |
| Concept-only | 1 | Только концепция → MDA/Balance/Economy skip, Narrative partial |
| Конкретные типы | 1 | Указаны only_check_types → запускаются только они |
| Отслеживание этапов | 1 | stages_completed содержит define_scope, checks, aggregation |
| Latency | 1 | latency_ms заполнен, <5000ms для mock AI |

**TestEdgeCases — 14 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| max_issues | 2 | >100 issues → обрезка до 100, top-5 актуален |
| Пустая концепция | 2 | empty concept → warning, None concept → error |
| None values | 2 | mda_profile=None → skip, balance_result=None → skip |
| Q-factor edge cases | 4 | Q=0.0, Q=1.0, Q<0, Q>1 → корректная обработка |
| Remediation plan | 4 | critical issue → remediation suggestion, warning → suggestion, info → no remediation, empty issues → empty plan |

#### 2.1.14 AI Assistant Service (4.D.6-4.D.7) — 60 тестов

**build_assistant_context() — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Контекст из Project State | 3 | Извлечение данных из всех 8 блоков, приоритизация блоков по заполненности, форматирование в структурированный контекст |
| Пустой проект | 1 | Нет данных → минимальный контекст с приглашением |
| Частичные данные | 2 | Только концепция → сокращённый контекст, заполнены Блоки 1-5 → полный контекст |
| Токен-лимит | 2 | Превышение лимита → обрезка менее важных блоков, preserve system prompt при обрезке |

**manage_session() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Создание сессии | 2 | Новый project_id → новая сессия с system prompt, дублирующий create → get_or_create |
| Получение существующей | 1 | Тот же project_id → существующая сессия |
| Очистка сессии | 1 | clear → история обнуляется, сессия остаётся |
| TTL / истечение | 1 | Просроченная сессия → auto-create новой |
| Конкурентный доступ | 1 | Два запроса одновременно → одна сессия |

**add_message() / get_chat_history() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Добавление user-сообщения | 2 | Корректная сериализация, timestamp проставляется |
| Добавление assistant-сообщения | 1 | Сохранение ответа AI |
| Получение истории | 1 | Возвращаются все сообщения в хронологическом порядке |
| Ограничение истории | 1 | >50 сообщений → обрезка старых, preserve system prompt |
| Пустая история | 1 | Новая сессия → пустой список |

**search_knowledge() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| RAG-поиск по проекту | 2 | Запрос → релевантные чанки, scoring и ранжирование |
| Пустой результат | 1 | Нет релевантных данных → пустой список |
| Fallback без RAG | 1 | RAG-сервис недоступен → graceful degradation |
| Мульти-запрос | 1 | Несколько запросов → объединённые результаты |
| Кэширование | 1 | Повторный запрос → закэшированный результат |

**check_proactive_alerts() — 12 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Runaway | 2 | Экономический runaway detected → critical alert, стабильная экономика → no alert |
| Deadlock | 2 | Ресурсный deadlock detected → error alert, fluid economy → no alert |
| Dissonance | 2 | Ludonarrative dissonance → warning alert, harmony → no alert |
| Gaps | 2 | Данные отсутствуют в критичных блоках → info alert, все блоки заполнены → no alert |
| Imbalance | 2 | Значительный дисбаланс >30% → error alert, acceptable → no alert |
| Комбинированные | 2 | Несколько alert одновременно → приоритизированный список, все alerts clean → empty list |

**generate_suggestions() — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Block-specific suggestions | 3 | Concept block → genre/mechanics suggestions, Balance block → tuning suggestions, Economy block → resource suggestions |
| Context-aware | 2 | С учётом текущих проблем проекта, С учётом этапа проектирования |
| AI fallback | 1 | AI-ошибка → эвристические suggestions |
| Пустой контекст | 1 | Нет данных → общие onboarding suggestions |
| Ранжирование | 1 | Suggestions сортируются по релевантности |

**chat() — 8 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| Полный пайплайн chat | 2 | User message → context + RAG + AI → response, корректный формат ответа |
| Сохранение в историю | 1 | User + assistant сообщения сохраняются в сессию |
| Обработка ошибок AI | 2 | AI timeout → fallback response, AI error → graceful degradation |
| Контекстное обогащение | 1 | RAG-результаты включаются в контекст |
| Проактивные alerts | 1 | Alerts прикрепляются к ответу при наличии |
| Пустой запрос | 1 | Пустое сообщение → ошибка валидации |

**chat_stream() — 6 тестов**

| Категория | Количество | Описание |
|-----------|------------|----------|
| SSE streaming | 2 | Генератор возвращает chunk-и, корректный SSE-формат (data: ...\n\n) |
| Завершение стрима | 1 | Последний chunk содержит [DONE] маркер |
| Ошибка при стриминге | 1 | AI-ошибка → error event в стриме |
| Отмена стрима | 1 | Client disconnect → корректная остановка генерации |
| Контекст в стриме | 1 | Контекст проекта обогащает стрим |

#### 2.1.15 AI Assistant API (4.D.7) — 20 тестов

**POST /chat — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-01 | `test_chat_success` | Успешный чат-запрос → 200 + ChatResponse |
| AI-API-02 | `test_chat_unauthorized` | Без авторизации → 401 |
| AI-API-03 | `test_chat_empty_message` | Пустое сообщение → 422 validation error |

**POST /chat/stream — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-04 | `test_chat_stream_success` | Успешный стриминг → 200 + SSE chunks |
| AI-API-05 | `test_chat_stream_unauthorized` | Без авторизации → 401 |
| AI-API-06 | `test_chat_stream_done_marker` | Последний event содержит [DONE] |

**GET /suggestions — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-07 | `test_suggestions_success` | Возвращает список suggestions |
| AI-API-08 | `test_suggestions_unauthorized` | Без авторизации → 401 |
| AI-API-09 | `test_suggestions_no_project_data` | Нет данных → onboarding suggestions |

**GET /alerts — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-10 | `test_alerts_success` | Возвращает proactive alerts |
| AI-API-11 | `test_alerts_no_alerts` | Нет проблем → пустой список |

**GET /history — 3 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-12 | `test_history_success` | Возвращает историю чата |
| AI-API-13 | `test_history_empty` | Новая сессия → пустая история |
| AI-API-14 | `test_history_unauthorized` | Без авторизации → 401 |

**POST /history/clear — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-15 | `test_history_clear_success` | Очистка истории → 200 |
| AI-API-16 | `test_history_clear_unauthorized` | Без авторизации → 401 |

**GET /status — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-17 | `test_status_success` | Статус AI-ассистента (available/unavailable) |
| AI-API-18 | `test_status_unauthorized` | Без авторизации → 401 |

**POST /test — 2 теста**

| ID | Тест | Что проверяет |
|----|------|---------------|
| AI-API-19 | `test_ai_test_success` | Тестовый запрос к AI → 200 + тестовый ответ |
| AI-API-20 | `test_ai_test_unauthorized` | Без авторизации → 401 |

### 2.2 Frontend — vitest (9 тестов в 3 файлах)

```
src/__tests__/
├── setup.ts                    # Глобальные моки
├── components.test.tsx         # Shared-компоненты + базовый рендеринг (7 тестов)
├── auth.test.tsx               # Формы логина/регистрации (2 теста)
└── api-client.test.ts          # HTTP-запросы, обработка ошибок (4 теста)
```

**components.test.tsx — 7 тестов**

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| F-01 | Рендеринг базовых элементов | div, button, input рендерятся корректно | components.test.tsx |
| F-02 | WarningsList — пустой | Пустой warnings → пустой вывод | components.test.tsx |
| F-03 | WarningsList — с данными | warnings=["Test warning"] → отображается | components.test.tsx |
| F-04 | SuggestionsList — пустой | Пустой suggestions → пустой вывод | components.test.tsx |
| F-05 | SuggestionsList — с данными | suggestions=["Test suggestion"] → отображается | components.test.tsx |
| F-06 | EmptyStateCard | Иконка, заголовок, описание рендерятся | components.test.tsx |
| F-07 | NodeTypeIcon | Pool и unknown типы рендерят SVG | components.test.tsx |

**auth.test.tsx — 2 теста**

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| F-08 | Форма логина | Email, Password, кнопка «Войти» рендерятся | auth.test.tsx |
| F-09 | Форма регистрации | Имя, Email, Password, кнопка «Зарегистрироваться» рендерятся | auth.test.tsx |

**api-client.test.ts — 4 теста**

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| F-10 | Базовый URL API | NEXT_PUBLIC_API_URL содержит /api/v1 | api-client.test.ts |
| F-11 | Заголовки авторизации | Authorization: Bearer token формируется корректно | api-client.test.ts |
| F-12 | Обработка 401 ошибки | 401 ответ → response.status === 401 | api-client.test.ts |
| F-13 | Обработка 500 ошибки | 500 ответ → response.status === 500 | api-client.test.ts |

---

## 3. Плановые программные тесты (не реализованы)

### 3.1 Backend — запланированные тесты

| Модуль | Файл | Этап | Ожидаемое кол-во тестов |
|--------|------|------|------------------------|
| Concept Service | test_concept_service.py | 4.B.2–4.B.4 | ~60 |
| Core Loop Service | test_coreloop_service.py | 4.B.6–4.B.7 | ~70 |
| MDA Service | test_mda_service.py | 4.B.9–4.B.11 | ~90 |
| Progression Service | test_progression_service.py | 4.C.5 | ~50 |
| GBE Bridge Service (mock) | test_gbe_bridge_service.py | 4.D.3 / Блок 8 | ~25 |
| Concept API endpoints | test_concept_api.py | 4.B | ~10 |
| Core Loop API endpoints | test_coreloop_api.py | 4.B | ~10 |
| MDA API endpoints | test_mda_api.py | 4.B | ~10 |
| Balance API endpoints | test_balance_api.py | 4.C | ~12 |
| Progression API endpoints | test_progression_api.py | 4.C | ~10 |
| Economy API endpoints | test_economy_api.py | 4.C | ~10 |
| GDD API endpoints | test_gdd_api.py | 4.D | ~15 |
| Checklist API endpoints | test_checklist_api.py | 4.D | ~10 |
| Pipeline API endpoints | test_pipeline_api.py | 4.C | ~8 |
| **Итого** | | | **~390** |

### 3.2 Frontend — запланированные тесты

| Модуль | Файл | Этап | Ожидаемое кол-во тестов |
|--------|------|------|------------------------|
| Concept Form | concept-form.test.tsx | 4.B.1 | ~8 |
| Concept OnePager / AestheticProfile | concept-result.test.tsx | 4.B.3 | ~10 |
| Concept ValidationReport | concept-validation.test.tsx | 4.B.4 | ~6 |
| Core Loop Designer | coreloop-designer.test.tsx | 4.B.8 | ~15 |
| Core Loop Diagram | coreloop-diagram.test.tsx | 4.B.8 | ~8 |
| MDA Lab UI | mda-lab.test.tsx | 4.B.11 | ~20 |
| MDA Input Form | mda-input-form.test.tsx | 4.B.9 | ~8 |
| Pipeline Components | pipeline.test.tsx | 4.B.12 | ~10 |
| Balance Page (5 вкладок) | balance-page.test.tsx | 4.C.4 | ~24 |
| Progression Page (5 вкладок) | progression-page.test.tsx | 4.C.5 | ~20 |
| Economy Page (5 вкладок) | economy-page.test.tsx | 4.C.6 | ~20 |
| Settings Page | settings.test.tsx | 4.A.5 | ~5 |
| GDD Format Selector | gdd-format-selector.test.tsx | 4.D.5 | ~6 |
| GDD Preview | gdd-preview.test.tsx | 4.D.5 | ~8 |
| GDD Section Editor | gdd-section-editor.test.tsx | 4.D.5 | ~6 |
| Consistency Panel | consistency-panel.test.tsx | 4.D.5 | ~5 |
| Export Panel | export-panel.test.tsx | 4.D.5 | ~6 |
| Checklist Panel | checklist-panel.test.tsx | 4.D.4 | ~6 |
| GDD Generator Page | gdd-generator-page.test.tsx | 4.D.5 | ~10 |
| AI Assistant Chat (Block 7 Page) | ai-chat-page.test.tsx | 4.D.8 | ~15 |
| AI ChatMessage Component | ai-chat-message.test.tsx | 4.D.8 | ~6 |
| AI SuggestionsPanel | ai-suggestions-panel.test.tsx | 4.D.8 | ~8 |
| AI AlertsPanel | ai-alerts-panel.test.tsx | 4.D.8 | ~6 |
| AI ChatHistoryList | ai-chat-history.test.tsx | 4.D.8 | ~6 |
| AIHintButton | ai-hint-button.test.tsx | 4.D.8 | ~8 |
| ContextualSuggestionCard | contextual-suggestion-card.test.tsx | 4.D.8 | ~6 |
| Progress Sidebar | progress-sidebar.test.tsx | 4.C.8 | ~6 |
| Pipeline Notifications | pipeline-notifications.test.tsx | 4.C.9 | ~5 |
| Layout Shell | layout-shell.test.tsx | 4.A | ~4 |
| Sidebar Navigation | sidebar.test.tsx | 4.A | ~6 |
| **Итого** | | | **~261** |

---

## 4. UI-тесты (ручные)

### 4.1 Авторизация и навигация

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-01 | Логин | 1. Открыть /login 2. Ввести email/password 3. Нажать Login | Редирект на главную страницу |
| UI-02 | Регистрация | 1. Открыть /register 2. Заполнить форму 3. Нажать Register | Успешная регистрация, редирект на логин |
| UI-03 | Навигация по блокам | 1. Кликнуть на каждый блок 1–8 в sidebar | Открывается соответствующая страница |
| UI-04 | Отображение версии | 1. Проверить sidebar | Отображается текущая версия (0.36.1) |
| UI-05 | Защищённые маршруты | 1. Открыть /blocks/1 без авторизации | Редирект на /login |
| UI-06 | Logout | 1. Нажать Logout в sidebar | Редирект на /login, токен удалён |
| UI-07 | Страница проектов | 1. Открыть /projects | Список проектов пользователя |
| UI-08 | Создание проекта | 1. Нажать «Новый проект» | Модальное окно, проект создаётся |
| UI-09 | Переключение проекта | 1. Выбрать другой проект из списка | Данные обновляются, блоки перезагружаются |
| UI-10 | Страница настроек | 1. Открыть /settings | Страница настроек профиля |

### 4.2 Блок 1: Генератор концепции (ConceptGeneratorPage + 9 subcomponents)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-11 | Ввод идеи | 1. Ввести текст идеи 2. Выбрать жанр | Форма валидна |
| UI-12 | Автоопределение жанра | 1. Выбрать «Определить автоматически» | Жанр определяется AI |
| UI-13 | Выбор целевой аудитории | 1. Выбрать до 3 мотиваций | Чекбоксы работают |
| UI-14 | Генерация концепции | 1. Нажать «Сгенерировать» | Отображается OnePagerCard |
| UI-15 | Просмотр OnePagerCard | 1. Проверить OnePager | Жанр, эстетики, механики, USP |
| UI-16 | Просмотр AestheticProfileView | 1. Проверить эстетики | 3 эстетики с AestheticBadge и иконками |
| UI-17 | Выбор Core Loop | 1. Проверить CoreLoopCandidates | 3 варианта, выбор сохраняется |
| UI-18 | MechanicSetView | 1. Проверить набор механик | Таблица механик с ролями |
| UI-19 | USPCandidates | 1. Проверить USP | Уникальные торговые предложения |
| UI-20 | DynamicsProfileCard | 1. Проверить динамику | Список динамики с типами |
| UI-21 | SelectionSummary | 1. Проверить итоговый выбор | Сводка выбранных элементов |
| UI-22 | Валидация пустого ввода | 1. Нажать «Сгенерировать» без заполнения | Ошибка валидации |
| UI-23 | ValidationReportView | 1. Проверить отчёт валидации | Цветовая индикация pass/fail/warning |

### 4.3 Блок 2: Core Loop Designer (6 subcomponents)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-24 | Проектирование | 1. Нажать «Проектировать Core Loop» | Отображается CoreLoopProfile |
| UI-25 | Визуализация петли | 1. Проверить CoreLoopDiagram | Круговая диаграмма с шагами |
| UI-26 | Выбор типа | 1. Выбрать Engine/Economy/Ecology в StructuralTypeCard | Тип обновляется |
| UI-27 | Иерархия петель | 1. Проверить LoopHierarchyTree | Сворачиваемое дерево петель |
| UI-28 | Панель диагностики | 1. Проверить PathologyPanel | Список патологий с severity |
| UI-29 | Рекомендации | 1. Проверить RecommendationsPanel | AI-рекомендации с приоритетами |
| UI-30 | Валидация Core Loop | 1. Проверить ValidationPanel | Pass/fail проверки |
| UI-31 | Автозаполнение из Блока 1 | 1. Перейти из Блока 1 | Данные предзаполнены |

### 4.4 Блок 3: MDA Lab (5 subcomponents + MDAInputForm)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-32 | Форма ввода MDA | 1. Заполнить MDAInputForm | Выбор эстетики, механик, динамики |
| UI-33 | Reverse MDA | 1. Выбрать эстетику 2. Запустить ReverseMDAPanel | Рекомендованные механики |
| UI-34 | Classic MDA | 1. Ввести механики 2. Запустить ClassicMDAPanel | Карта эстетических ценностей |
| UI-35 | Матрица Бонда | 1. Переключиться на BondMatrixPanel | Таблица 4x3 |
| UI-36 | Линзы Шелла | 1. Переключиться на LensAuditPanel | Линзы с вопросами и оценками |
| UI-37 | Иконка эстетики | 1. Проверить AestheticIcon | Иконка соответствует эстетике |
| UI-38 | Переключение режимов | 1. Переключаться между Tabs | Корректное отображение |
| UI-39 | Обнаружение диссонанса | 1. Запустить анализ с конфликтами | Предупреждение о диссонансе |
| UI-40 | Лудонарративный анализ | 1. Проверить результат анализа | Гармония/Ирония/Диссонанс |

### 4.5 Блок 4: Баланс и симуляция (6 subcomponents)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-41 | Transitive-таблица | 1. Открыть TransitiveAnalysisTab | Таблица с цветовой индикацией статусов |
| UI-42 | Payoff-матрица | 1. Переключиться на PayoffMatrixTab | Тепловая карта NxN |
| UI-43 | Графики Monte Carlo | 1. Переключиться на SimulationChartsTab | Графики win rate по итерациям |
| UI-44 | Machinations-визуализация | 1. Переключиться на MachinationsVisualizationTab | Граф ресурсов с узлами и связями |
| UI-45 | AI-коррекции | 1. Переключиться на CorrectionsPanelTab | Рекомендации с кнопками «Применить» |
| UI-46 | Форма объекта | 1. Открыть ObjectForm | Ввод данных для балансируемого объекта |
| UI-47 | Запуск балансировки | 1. Нажать «Запустить балансировку» | Прогресс-бар, затем результаты во всех вкладках |
| UI-48 | Цветовая индикация статусов | 1. Проверить статусы элементов | balanced (зелёный), overpowered (красный), underpowered (синий), ideal_imbalance (жёлтый) |

### 4.6 Блок 5: Прогрессия и экономика (10 subcomponents)

**Вкладка «Прогрессия»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-49 | Открытие страницы | 1. Открыть /blocks/5 | Страница с двумя основными вкладками «Прогрессия» и «Экономика» |
| UI-50 | Макро-параметры | 1. Переключиться на MacroParamsTab | totalLevels, progressionType, emergenceRatio |
| UI-51 | Таблица tiers | 1. Переключиться на TiersTab | Таблица с 8 колонками |
| UI-52 | Кривые прогрессии | 1. Переключиться на CurvesTab | 4 графика Recharts |
| UI-53 | Контент-план | 1. Переключиться на ContentPlanTab | Таблица unlock_tree + график сложности |
| UI-54 | Валидация прогрессии | 1. Переключиться на ValidationTab | Pass/fail проверки + overall score |
| UI-55 | Запуск проектирования | 1. Нажать «Спроектировать прогрессию» | Загрузка, затем результаты |

**Вкладка «Экономика»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-56 | Форма экономики | 1. Переключиться на вкладку «Экономика» | Форма с жанром, монетизацией, openness |
| UI-57 | Таблица ресурсов | 1. Переключиться на ResourcesTab | Таблицы core/subsidiary ресурсов |
| UI-58 | Классификация | 1. Переключиться на ClassificationTab | Economic type, sub_type, risk_level badges |
| UI-59 | Machinations | 1. Переключиться на MachinationsEconomyTab | Узлы, flows, feedback loops, patterns |
| UI-60 | Диагностика патологий | 1. Переключиться на DiagnosticsTab | Pathologies с severity + faucet/drain ratios |
| UI-61 | Симуляция экономики | 1. Переключиться на SimulationEconomyTab | Resource curves chart + quality assessment |
| UI-62 | Запуск экономики | 1. Нажать «Спроектировать экономику» | Загрузка, затем результаты |
| UI-63 | Переключение прогрессия/экономика | 1. Переключаться между вкладками | Корректное отображение |
| UI-64 | Пустое состояние | 1. Открыть /blocks/5 без запуска | EmptyStateCard с иконками |

### 4.7 Блок 6: GDD Generator (6 subcomponents + types/constants)

**Вкладка «Формат»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-65 | Открытие страницы | 1. Открыть /blocks/6 | Страница «GDD Generator» с 6 вкладками |
| UI-66 | Выбор формата | 1. Кликнуть карточку формата в GDDFormatSelector | Карточка выделяется, формат выбирается |
| UI-67 | 8 форматов | 1. Поочерёдно выбрать каждый из 8 форматов | Каждый формат корректно отображается с описанием |
| UI-68 | Выбор детализации | 1. Выбрать detail level | overview/standard/detailed/exhaustive |
| UI-69 | Выбор аудитории | 1. Выбрать target audience | investor/team_sync/production/personal/educational |
| UI-70 | Выбор стадии | 1. Выбрать project stage | concept/prototype/preproduction/production/live_ops |
| UI-71 | Генерация GDD | 1. Нажать «Сгенерировать GDD» | Загрузка, переход на вкладку «Предпросмотр» |

**Вкладка «Предпросмотр»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-72 | Предпросмотр Markdown | 1. Переключиться на GDDPreview | Рендеринг Markdown с оглавлением и сворачиваемыми секциями |
| UI-73 | Индикаторы источника | 1. Проверить бейджи источников | auto (зелёный), AI (синий), manual (жёлтый) |
| UI-74 | Статистика документа | 1. Проверить блок статистики | section_count, word_count, estimated_pages, coverage_score |
| UI-75 | Секция Core Loop | 1. Проверить Core Loop в GDD | Диаграмма + таблица шагов |
| UI-76 | Секция Баланс | 1. Проверить Баланс | Таблица + формулы |
| UI-77 | Секция Прогрессия | 1. Проверить Прогрессию | Кривые + tiers |
| UI-78 | Секция Экономика | 1. Проверить Экономику | Machinations + ресурсы |

**Вкладка «Редактор»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-79 | Редактор секций | 1. Переключиться на GDDSectionEditor | Список секций с textarea для редактирования |
| UI-80 | Подсказки для ручных секций | 1. Открыть пустую секцию в редакторе | AI-подсказки и шаблон-скелет |
| UI-81 | Приоритеты секций | 1. Проверить бейджи приоритетов | critical (красный), important (жёлтый), optional (серый) |

**Вкладка «Согласованность»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-82 | Панель согласованности | 1. Переключиться на ConsistencyPanel | Список проблем с severity badges |
| UI-83 | Severity badges | 1. Проверить цветовую индикацию | error (красный), warning (жёлтый), info (синий) |
| UI-84 | Кнопка «Исправить» | 1. Нажать «Исправить» у проблемы | Визуальная обратная связь |

**Вкладка «Экспорт»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-85 | Экспорт PDF | 1. Нажать «PDF» в ExportPanel | Прогресс-бар, затем скачивание файла |
| UI-86 | Экспорт DOCX | 1. Нажать «DOCX» | Скачивание DOCX-файла |
| UI-87 | Экспорт HTML | 1. Нажать «HTML» | Скачивание HTML-файла с CSS |
| UI-88 | Экспорт MD | 1. Нажать «MD» | Скачивание Markdown-файла |
| UI-89 | Ошибка экспорта | 1. Попробовать экспорт без генерации GDD | Сообщение об ошибке |

**Вкладка «Чек-листы»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-90 | Запуск валидации | 1. Нажать «Запустить валидацию» в ChecklistPanel | Загрузка, затем результаты |
| UI-91 | Результаты MDA-проверки | 1. Проверить блок MDA | orphan эстетики/динамики, Bond dissonance, скоринг |
| UI-92 | Результаты проверки баланса | 1. Проверить блок Баланс | Overpowered/underpowered, доминантная стратегия, grind, difficulty wall |
| UI-93 | Результаты проверки нарратива | 1. Проверить блок Нарратив | Ludonarrative dissonance/irony/harmony, agency gaps, quest variety |
| UI-94 | Результаты проверки экономики | 1. Проверить блок Экономика | Runaway, deadlock, Q-factor, profitability |
| UI-95 | Результаты линз | 1. Проверить блок Линзы | Список линз с вопросами и оценками |
| UI-96 | Общий score и readiness | 1. Проверить панель скоринга | Score 0-100, readiness level (ready/almost/not_ready) |
| UI-97 | Remediation plan | 1. Нажать «Показать рекомендации» | Список рекомендаций с приоритетами |
| UI-98 | Quick wins | 1. Проверить блок Quick Wins | Проблемы с low effort |
| UI-99 | Фильтр по severity | 1. Выбрать фильтр «Только critical» | Отображаются только critical issues |
| UI-100 | Пустое состояние | 1. Открыть Checklist без данных | Placeholder «Заполните блоки для валидации» |
| UI-101 | Pipeline уведомление | 1. Сгенерировать GDD | Блок 6 отмечен как заполненный в Progress Sidebar |

### 4.8 Блок 7: AI-ассистент (SSE streaming, AIHintButton, ContextualSuggestionCard, ChatHistoryList) *(NEW in v0.36.1)*

**Главная страница /blocks/7 — 4 вкладки**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-102 | Открытие AI-ассистента | 1. Открыть /blocks/7 | Страница с 4 вкладками: Чат, Подсказки, Уведомления, История |
| UI-103 | Заголовок страницы | 1. Проверить заголовок | «AI-ассистент», подзаголовок «Блок 7 • Спецификация 3.9 • SSE Streaming» |
| UI-104 | Индикатор пайплайна | 1. Проверить Badge в заголовке | Текущий блок или «Пайплайн готов» |

**Вкладка «Чат»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-105 | Пустой чат | 1. Открыть вкладку «Чат» | Иконка Bot, приветственное сообщение, 4 кнопки-подсказки |
| UI-106 | Кнопки-подсказки | 1. Нажать «Какие механики подходят для RPG?» | Текст подставляется в поле ввода |
| UI-107 | Отправка сообщения | 1. Ввести вопрос 2. Нажать Enter или кнопку Send | Сообщение user отображается, затем ответ assistant |
| UI-108 | SSE-стриминг ответа | 1. Отправить сообщение | Ответ появляется по частям с пульсирующим курсором |
| UI-109 | Метаданные ответа | 1. Дождаться полного ответа | model_used, provider, latency_ms отображаются мелким шрифтом |
| UI-110 | Fallback при ошибке стриминга | 1. Отправить при недоступности SSE | Fallback на POST /chat (не-стриминг) |
| UI-111 | Кнопка остановки стрима | 1. Нажать красную кнопку ■ во время стриминга | Стрим останавливается, частичный ответ сохраняется |
| UI-112 | Кнопка очистки истории | 1. Нажать иконку корзины | История чата очищается локально и на сервере |
| UI-113 | Авто-скролл | 1. Отправить несколько сообщений | Чат автоматически прокручивается вниз |
| UI-114 | Пустое сообщение | 1. Нажать Send без ввода текста | Кнопка Send отключена, сообщение не отправляется |
| UI-115 | Отправка по Enter | 1. Нажать Enter в поле ввода | Сообщение отправляется |
| UI-116 | Shift+Enter — новая строка | 1. Нажать Shift+Enter | Переход на новую строку в поле ввода |
| UI-117 | Системное сообщение об ошибке | 1. Отправить при ошибке сервера | Сообщение с role=system, серый фон, italic |
| UI-118 | Иконки ролей | 1. Проверить сообщения | User: MessageSquare, Assistant: Bot, System: Info |

**Вкладка «Подсказки»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-119 | Открытие вкладки | 1. Переключиться на вкладку «Подсказки» | SuggestionsPanel, селектор блока 1-8 |
| UI-120 | Селектор блока | 1. Нажать кнопку «3» | suggestionsBlock = 3, подсветка кнопки |
| UI-121 | Загрузка подсказок | 1. Нажать «Загрузить» | Loading spinner, затем список подсказок |
| UI-122 | Карточки подсказок | 1. Проверить структуру карточки | Иконка действия, заголовок, priority Badge, описание |
| UI-123 | Иконки действий | 1. Проверить иконки | generate=Sparkles, validate=CheckCircle2, fix=AlertTriangle, review=Lightbulb |
| UI-124 | Цвета приоритетов | 1. Проверить цвета | high=red, medium=yellow, low=blue |
| UI-125 | Кнопка «Обновить» | 1. Нажать «Обновить» | Повторный запрос к API |
| UI-126 | Пустое состояние | 1. Открыть вкладку без выбора блока | «Выберите блок для получения подсказок» |

**Вкладка «Уведомления»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-127 | Открытие вкладки | 1. Переключиться на вкладку «Уведомления» | AlertsPanel, кнопка «Проверить» |
| UI-128 | Счётчик уведомлений | 1. Загрузить alerts с проблемами | Badge с количеством alerts рядом с заголовком |
| UI-129 | Карточки уведомлений | 1. Проверить структуру alert | Иконка severity, заголовок, Badge блока, описание, suggestion |
| UI-130 | Цвета severity | 1. Проверить стили | critical=red, warning=yellow, info=blue |
| UI-131 | Пустое состояние | 1. Загрузить alerts без проблем | CheckCircle2 иконка, «Проблем не обнаружено» |
| UI-132 | Кнопка «Проверить» | 1. Нажать «Проверить» | Повторный запрос к API |

**Вкладка «История»**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-133 | Открытие вкладки | 1. Переключиться на вкладку «История» | ChatHistoryList с группировкой по датам |
| UI-134 | Группировка по дате | 1. Проверить историю с несколькими датами | Заголовки дат на русском (5 марта, 6 марта) |
| UI-135 | Иконки ролей в истории | 1. Проверить сообщения | User: MessageSquare, Assistant: Bot |
| UI-136 | Время сообщений | 1. Проверить timestamp | Время в формате HH:MM (русская локаль) |
| UI-137 | Содержимое сообщения | 1. Проверить текст | line-clamp-2 (обрезка длинных сообщений) |
| UI-138 | Hover-эффект | 1. Навести курсор на сообщение | Подсветка фона (hover:bg-muted/50) |
| UI-139 | Кнопка «Загрузить ещё» | 1. Прокрутить историю до конца | Кнопка «Загрузить ещё» при hasMore=true |
| UI-140 | Очистка истории | 1. Нажать «Очистить» | История обнуляется |
| UI-141 | Пустое состояние | 1. Открыть историю без сообщений | «Нет сохранённых сообщений» |

**AIHintButton (компонент для вставки на страницы Блоков 1-8)**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-142 | Рендеринг кнопки | 1. Найти AIHintButton на странице блока | Кнопка «AI-подсказка» с иконкой Sparkles |
| UI-143 | Открытие Popover | 1. Нажать AIHintButton | Popover открывается с заголовком «Подсказки для Блока N» |
| UI-144 | Загрузка подсказок | 1. Открыть Popover впервые | Loading spinner, затем список подсказок |
| UI-145 | Карточки подсказок | 1. Проверить структуру | Иконка действия, заголовок, priority Badge, описание (line-clamp-2) |
| UI-146 | Кнопка «Обновить» | 1. Нажать «Обновить» в Popover | Повторный запрос, загрузка новых подсказок |
| UI-147 | Закрытие Popover | 1. Нажать вне Popover | Popover закрывается |
| UI-148 | Повторное открытие | 1. Открыть Popover повторно | Подсказки загружены из кэша (без повторного API-запроса) |
| UI-149 | Пустое состояние | 1. Открыть Popover для блока без данных | «Нет подсказок для этого блока» |
| UI-150 | Ошибка загрузки | 1. Открыть при недоступности API | Toast с ошибкой, пустой список |
| UI-151 | Размер и вариант | 1. Проверить настраиваемые props | size (default/sm/lg/icon), variant (default/outline/ghost/secondary) |
| UI-152 | Встраивание в разные блоки | 1. Проверить AIHintButton на Блоках 1-8 | Каждый блок корректно передаёт blockId |

**ContextualSuggestionCard (плавающая карточка с AI-подсказками)**

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-153 | Рендеринг карточки | 1. Активировать ContextualSuggestionCard | Карточка w-64 с тенью и border-primary/20 |
| UI-154 | Заголовок | 1. Проверить заголовок | «AI-подсказки» с иконкой Sparkles |
| UI-155 | Кнопка закрытия | 1. Нажать X | Карточка скрывается, isDismissed=true |
| UI-156 | Загрузка | 1. Проверить начальное состояние | Loader2 spinner |
| UI-157 | Список подсказок | 1. Дождаться загрузки | До maxSuggestions (по умолчанию 3) подсказок |
| UI-158 | Приоритет Badge | 1. Проверить бейджи | high=destructive, medium=outline, low=secondary |
| UI-159 | Callback onClose | 1. Закрыть карточку | Вызывается onClose callback |
| UI-160 | Проп visible=false | 1. Установить visible=false | Карточка не рендерится |
| UI-161 | Проп maxSuggestions | 1. Установить maxSuggestions=2 | Отображаются только 2 подсказки |
| UI-162 | Нет подсказок | 1. Активировать для блока без данных | Карточка скрывается (suggestions.length === 0) |

### 4.9 Блок 8: Интеграция GBCombine (mock API bridge)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-163 | Открытие страницы | 1. Открыть /blocks/8 | Страница «Интеграция GBE» с Badge «Запланирован» |
| UI-164 | Placeholder | 1. Проверить содержимое | «Интеграция с GDCombine будет реализована в Фазе 4.E» |
| UI-165 | Навигация | 1. Кликнуть Блок 8 в sidebar | Открывается страница Блока 8 |

### 4.10 Сквозной пайплайн (1→8)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-166 | Progress Sidebar | 1. Проверить индикатор прогресса | Статус по 8 блокам, цветовая индикация |
| UI-167 | Автозаполнение Блок 2 из Блока 1 | 1. Заполнить Блок 1 → перейти в Блок 2 | Данные предзаполнены из OnePager |
| UI-168 | Автозаполнение Блок 3 из 1+2 | 1. Заполнить Блок 2 → перейти в Блок 3 | mechanics + core_loop_data заполнены |
| UI-169 | Автозаполнение Блок 4 из 1+2+3 | 1. Заполнить Блок 3 → перейти в Блок 4 | concept_data, core_loop_data, mda_data |
| UI-170 | Автозаполнение Блок 5 из 1+2+3+4 | 1. Заполнить Блок 4 → перейти в Блок 5 | progression_input + economy_input |
| UI-171 | Уведомления stale | 1. Обновить данные в Блоке 1 | Уведомление о пересчёте Блоков 2-8 |
| UI-172 | Pipeline Flow Indicator 1→8 | 1. Проверить индикатор потока | Визуализация потока 1→2→3→4→5→6→7→8 |
| UI-173 | Кнопка «Пересчитать всё» | 1. Нажать «Запустить пайплайн 1→5» | Последовательный запуск всех 5 блоков |
| UI-174 | Cascade-обновление | 1. Изменить жанр в Блоке 1 | Блоки 2-8 помечены stale |
| UI-175 | Stale-уведомления для Блока 5 | 1. Обновить Блок 4 | Уведомление «Рекомендуется пересчитать прогрессию и экономику» |
| UI-176 | AIHintButton на каждом блоке | 1. Проверить наличие AIHintButton на Блоках 1-8 | Кнопка «AI-подсказка» присутствует и работает |

### 4.11 Общие UI-тесты

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-177 | Responsive дизайн | 1. Изменить размер окна | Адаптивная верстка (mobile/tablet/desktop) |
| UI-178 | Тёмная/светлая тема | 1. Переключить тему | Корректная смена стилей |
| UI-179 | Страница ошибки | 1. Открыть несуществующий URL | Страница error.tsx |
| UI-180 | Loading страница | 1. Перейти на страницу при загрузке | Skeleton/loading.tsx |
| UI-181 | Middleware защита | 1. Открыть /blocks/* без авторизации | Редирект на /login |

---

## 5. E2E-сценарии (ручные)

| ID | Сценарий | Описание |
|----|----------|----------|
| E2E-01 | Полный пайплайн «идея → GDD» | Пользователь проходит все блоки последовательно: ввод идеи → Концепция → Core Loop → MDA → Баланс → Прогрессия → Экономика → GDD |
| E2E-02 | Редактирование концепции | Изменение данных в Блоке 1 → каскадное обновление Блоков 2-8, stale-уведомления |
| E2E-03 | Балансировка экономики | Запуск диагностики → применение коррекций → пересчёт → проверка улучшения |
| E2E-04 | Monte Carlo + Machinations | Запуск обеих симуляций в Блоке 4, анализ расхождения, проверка quality assessment |
| E2E-05 | Проектирование прогрессии | Настройка макро-параметров → кривые → tiers → контент-план → валидация |
| E2E-06 | Экономическое моделирование | Идентификация ресурсов → классификация → Machinations → диагностика → балансировка → симуляция |
| E2E-07 | Сквозной пайплайн 1→5 | Ввод идеи → Концепция → Core Loop → MDA → Баланс → Прогрессия → Экономика за одну операцию (run-full-pipeline) |
| E2E-08 | Интеграционный тест «Roguelike про алхимика» | Тест-кейс из 4.C.10: идея → все 5 блоков, проверка целостности данных, cascade stale |
| E2E-09 | GDD Generator: One-Sheet | Ввод идеи → Заполнить Блоки 1-5 → Выбрать формат one_sheet → Сгенерировать GDD → Проверить 6 секций, 1 страницу |
| E2E-10 | GDD Generator: Full GDD | Ввод идеи → Заполнить все блоки → Сгенерировать full_gdd → Проверить 38 секций, автозаполненные + AI + ручные |
| E2E-11 | GDD Export: PDF | Заполнить все блоки → Сгенерировать GDD → Экспорт PDF → Файл скачивается, корректный формат |
| E2E-12 | GDD Export: DOCX | Заполнить все блоки → Сгенерировать GDD → Экспорт DOCX → Файл скачивается, открывается в Word |
| E2E-13 | GDD Consistency Check | Заполнить блоки с противоречиями → Проверить согласованность → Error/warning/info проблемы отображаются |
| E2E-14 | GDD Full Pipeline 1→8 | Ввод идеи → Полный пайплайн → Assembled + Formatted документ → Экспорт в 4 форматах → Проверить Block 8 placeholder |
| E2E-15 | Checklist-валидация полного пайплайна | Ввод идеи → Заполнить все блоки → Запустить Checklist-валидацию → Проверить score, readiness level, top-5 issues, quick wins, remediation plan |
| E2E-16 | AI-ассистент: чат с контекстом | Ввод идеи → Заполнить Блоки 1-3 → Открыть AI-ассистент → Задать вопрос о механиках → Ответ AI учитывает данные проекта |
| E2E-17 | AI-ассистент: проактивные alerts | Заполнить все блоки с дисбалансом → Открыть AI-ассистент → Проверить alerts (runaway, deadlock, dissonance) → Нажать alert → Переход к проблемному блоку |
| E2E-18 | AI-ассистент: suggestions и применение | Заполнить Блок 1 → Открыть suggestions → Выбрать suggestion → Данные предзаполняются в целевом блоке |
| E2E-19 | AI-ассистент: SSE-стриминг чата | Открыть AI-ассистент → Отправить длинный вопрос → Проверить SSE-стриминг → Ответ появляется по частям, кнопка остановки работает |
| E2E-20 | AI-ассистент: полный цикл | Ввод идеи → Заполнить все блоки с проблемами → AI-ассистент обнаруживает alerts → Предлагает suggestions → Пользователь применяет suggestions → Перепроверка через чат → Проблемы устранены |
| E2E-21 | AIHintButton на каждом блоке | Перейти на Блок 1 → Нажать AIHintButton → Получить подсказки → Повторить для Блоков 2-8 → Подсказки контекстно зависят от данных блока |
| E2E-22 | ContextualSuggestionCard: контекстные подсказки | Заполнить Блок 4 с дисбалансом → ContextualSuggestionCard появляется → Проверить подсказки → Закрыть карточку → Открыть снова |
| E2E-23 | ChatHistoryList: история чата | Провести 3 диалога с AI → Переключиться на вкладку «История» → Проверить группировку по датам → Нажать «Загрузить ещё» → Очистить историю |
| E2E-24 | Регистрация → Первый проект → AI-ассистент | Зарегистрироваться → Создать первый проект → Открыть AI-ассистент → Onboarding suggestions → Задать вопрос |
| E2E-25 | Stale-cascade + AI-ассистент | Заполнить все блоки → Изменить жанр в Блоке 1 → AI-ассистент показывает alerts о stale-блоках → Пересчитать → Alerts очищаются |

---

## 6. Сводная статистика

### 6.1 Реализованные автоматизированные тесты

| Категория | Файлов | Тестов |
|-----------|--------|--------|
| Backend (pytest) | 16+1 integration | 650+ |
| Frontend (vitest) | 3 | 9 |
| **Итого** | **20** | **659+** |

### 6.2 Плановые автоматизированные тесты

| Категория | Тестов |
|-----------|--------|
| Backend (новые модули + API endpoints) | ~390 |
| Frontend (новые компоненты + страницы) | ~261 |
| **Итого плановых** | **~651** |

### 6.3 Ручные UI/E2E тесты

| Категория | Кейсов |
|-----------|--------|
| UI-тесты (авторизация и навигация) | 10 |
| UI-тесты (Блок 1) | 13 |
| UI-тесты (Блок 2) | 8 |
| UI-тесты (Блок 3) | 9 |
| UI-тесты (Блок 4) | 8 |
| UI-тесты (Блок 5) | 16 |
| UI-тесты (Блок 6) | 37 |
| UI-тесты (Блок 7 AI-ассистент) | 61 |
| UI-тесты (Блок 8) | 3 |
| UI-тесты (сквозной пайплайн) | 11 |
| UI-тесты (общие) | 5 |
| E2E-сценарии | 25 |
| **Итого** | **206** |

### 6.4 Целевое покрытие (критерий C8 из ROADMAP)

- **Backend**: >= 60% coverage (текущий baseline)
- **Frontend**: >= 50% coverage (текущий baseline)

---

## 7. Формат отчёта о тестировании

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

## E2E-сценарии (ручные)
| ID | Результат | Комментарий |
|----|-----------|-------------|
| E2E-01 | PASS/FAIL | |

## Найденные баги
1. [Критичность] Описание

## Замечания
- Заметки
```
