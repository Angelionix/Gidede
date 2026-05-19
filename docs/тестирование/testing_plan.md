# Gidede — Документ тестирования

> **Фаза**: 4.D.4 (Checklist-валидация GDD)
> **Дата**: 2026-05-19
> **Версия**: 0.33.0
> **Статус**: Активный
> **Подход**: Локальное тестирование + CI/CD (GitHub Actions)

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика и через CI/CD пайплайн (GitHub Actions: `.github/workflows/ci.yml`). Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.5), Core Loop Designer (4.B.6–4.B.8), MDA Lab (4.B.9–4.B.11), сквозной пайплайн (4.B.12), баланс и симуляцию (4.C.1–4.C.4), прогрессию (4.C.5), экономику (4.C.6–4.C.7), UI экономики и прогрессии (4.C.8), сквозной пайплайн Блоков 1–5 (4.C.9), интеграционные тесты полного пайплайна (4.C.10), а также GDD-генерацию: Этапы 1–5 (4.D.1–4.D.2), сшивка/валидация/форматирование/экспорт (4.D.3), Checklist-валидация GDD (4.D.4).

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

### 2.1 Backend — pytest (470+ тестов в 14 файлах)

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
│                                   #   Stage 8=7, Pipeline 1-8=4) *(NEW in 4.D.3)*
├── test_pipeline_service.py       # Pipeline Service — сквозной пайплайн 1→5,
│                                   #   зависимости блоков, stale-каскад (29 тестов)
├── test_checklist_service.py      # Checklist Service (4.D.4) — define_scope,
│                                   #   MDA/balance/narrative/economy/lens checks,
│                                   #   aggregation, full pipeline, edge cases
│                                   #   (95 тестов) *(NEW in 4.D.4)*
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

**Stage 2–7 и Full Pipeline — 68 тестов** (ECO-16 — ECO-83, см. предыдущую версию)

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

**Stage 4: AI-генерация и обогащение (3.7.6) — 18 тестов** *(NEW in 4.D.2)*

| Категория | Количество | Описание |
|-----------|------------|----------|
| AI-enrichment | 6 | ENRICH_SECTION для автозаполненных секций, проверка enriched_sections, обработка ошибок, coverage |
| AI-генерация с нуля | 6 | GENERATE_CHARACTERS_SECTION, GENERATE_VISUAL_STYLE, GENERATE_STORY_SECTION, GENERATE_CONTROLS_SECTION, GENERATE_WORLD_STRUCTURE, source marking |
| Обработка ошибок | 4 | Частичные и полные ошибки AI, failed_sections, graceful degradation |
| Edge cases | 2 | Нет автозаполненных секций, комбинированный enrich+generate |

**Stage 5: Ручные секции с подсказками (3.7.7) — 12 тестов** *(NEW in 4.D.2)*

| Категория | Количество | Описание |
|-----------|------------|----------|
| Скелеты секций | 5 | Генерация шаблонов, приоритизация critical/important/optional |
| AI-подсказки | 4 | AI_GENERATE_SECTION_HINTS, fallback при ошибке, estimated_effort, классификация |
| Edge cases | 3 | Нет ручных секций, только critical, все optional |

**Полный пайплайн 1-5 + Edge Cases — 27 тестов**

#### 2.1.10 GDD Service Stages 6-8 (4.D.3) — 32 теста *(NEW in 4.D.3)*

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

| Категория | Количество | Описание |
|-----------|------------|----------|
| Pipeline 1-3 | 4 | stages_completed, coverage, one_sheet pipeline, no-data pipeline |
| Pipeline 1-5 | 6 | Все 5 этапов, GDDProfile, full data, coverage increase, latency, graceful no-data |
| Метрики | 2 | latency_ms, coverage_score |
| Оценка страниц | 2 | full_gdd+detailed=75, mmorpg+exhaustive=125 |
| Edge Cases | 13 | Composite sources, missing subpath, custom sections, export_formats, detail override, unknown genre fallback |

#### 2.1.10 Pipeline Service (4.C.9) — 29 тестов

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

#### 2.1.11 Integration Tests (4.C.10) — 22 теста

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

#### 2.1.12 Checklist Service (4.D.4) — 95 тестов *(NEW in 4.D.4)*

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

### 2.2 Frontend — vitest (9 тестов в 3 файлах)

```
src/__tests__/
├── setup.ts                    # Глобальные моки
├── components.test.tsx         # Базовый рендеринг UI-компонентов (3 теста)
├── auth.test.tsx               # Формы логина/регистрации (2 теста)
└── api-client.test.ts          # HTTP-запросы, обработка ошибок (4 теста)
```

| ID | Тест | Что проверяет | Файл |
|----|------|---------------|------|
| F-01 | Рендеринг Sidebar | Sidebar отображает навигацию | components.test.tsx |
| F-02 | Рендеринг страницы логина | Форма логина рендерится | components.test.tsx |
| F-03 | Рендеринг ConceptForm | Форма ввода Блока 1 | components.test.tsx |
| F-04 | Успешный логин | Отправка формы логина | auth.test.tsx |
| F-05 | Успешная регистрация | Отправка формы регистрации | auth.test.tsx |
| F-06 | GET-запрос | Корректный GET через api-client | api-client.test.ts |
| F-07 | POST-запрос | Корректный POST через api-client | api-client.test.ts |
| F-08 | Обработка 401 | Редирект на логин при 401 | api-client.test.ts |
| F-09 | Обработка network error | Обработка сетевых ошибок | api-client.test.ts |

---

## 3. Плановые программные тесты (не реализованы)

### 3.1 Backend — запланированные тесты

| Модуль | Файл | Этап | Ожидаемое кол-во тестов |
|--------|------|------|------------------------|
| Concept Service (1–7) | test_concept_service.py | 4.B.2–4.B.4 | ~60 |
| Core Loop Service (1–5) | test_coreloop_service.py | 4.B.6–4.B.7 | ~70 |
| MDA Service (1–6) | test_mda_service.py | 4.B.9–4.B.11 | ~90 |
| AI Assistant | test_ai_assistant_service.py | 4.D | ~20 |
| Итого | | | ~240 |

### 3.2 Frontend — запланированные тесты

| Модуль | Файл | Этап | Ожидаемое кол-во тестов |
|--------|------|------|------------------------|
| Concept Form/Result | concept-form.test.tsx | 4.B.1 | ~8 |
| Core Loop Designer | coreloop-designer.test.tsx | 4.B.8 | ~15 |
| MDA Lab UI | mda-lab.test.tsx | 4.B.11 | ~20 |
| Pipeline Components | pipeline.test.tsx | 4.B.12 | ~10 |
| Balance Page | balance-page.test.tsx | 4.C.4 | ~24 |
| Progression Page | progression-page.test.tsx | 4.C.5 | ~15 |
| Economy Page | economy-page.test.tsx | 4.C.6 | ~15 |
| Settings Page | settings.test.tsx | 4.A.5 | ~5 |
| Итого | | | ~112 |

---

## 4. UI-тесты (ручные)

### 4.1 Авторизация и навигация

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-01 | Логин | 1. Открыть /login 2. Ввести email/password 3. Нажать Login | Редирект на главную страницу |
| UI-02 | Регистрация | 1. Открыть /register 2. Заполнить форму 3. Нажать Register | Успешная регистрация, редирект на логин |
| UI-03 | Навигация по блокам | 1. Кликнуть на каждый блок 1–8 в sidebar | Открывается соответствующая страница |
| UI-04 | Отображение версии | 1. Проверить sidebar | Отображается текущая версия (0.32.0) |

### 4.2 Блок 1: Генератор концепции

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-05 | Ввод идеи | 1. Ввести текст идеи 2. Выбрать жанр | Форма валидна |
| UI-06 | Автоопределение жанра | 1. Выбрать «Определить автоматически» | Жанр определяется AI |
| UI-07 | Выбор целевой аудитории | 1. Выбрать до 3 мотиваций | Чекбоксы работают |
| UI-08 | Генерация концепции | 1. Нажать «Сгенерировать» | Отображается One-Pager |
| UI-09 | Просмотр эстетик | 1. Проверить AestheticProfileView | 3 эстетики с иконками |
| UI-10 | Выбор Core Loop | 1. Выбрать один из 3 вариантов | Выбор сохраняется |
| UI-11 | Валидация | 1. Нажать «Сгенерировать» без заполнения | Ошибка валидации |
| UI-12 | Отчёт валидации | 1. Проверить ValidationReport | Цветовая индикация |

### 4.3 Блок 2: Core Loop Designer

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-13 | Проектирование | 1. Нажать «Проектировать Core Loop» | Отображается CoreLoopProfile |
| UI-14 | Визуализация петли | 1. Проверить CoreLoopDiagram | Круговая диаграмма с шагами |
| UI-15 | Выбор типа | 1. Выбрать Engine/Economy/Ecology | Тип обновляется |
| UI-16 | Иерархия петель | 1. Проверить LoopHierarchy | Сворачиваемое дерево |
| UI-17 | Панель диагностики | 1. Проверить PathologyPanel | Список патологий |
| UI-18 | Рекомендации | 1. Проверить рекомендации | AI-рекомендации с приоритетами |
| UI-19 | Drag-and-drop | 1. Перетащить шаг в петле | Порядок шагов меняется |
| UI-20 | Автозаполнение из Блока 1 | 1. Перейти из Блока 1 | Данные предзаполнены |

### 4.4 Блок 3: MDA Lab

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-21 | Reverse MDA | 1. Выбрать эстетику 2. Запустить | Рекомендованные механики |
| UI-22 | Classic MDA | 1. Ввести механики 2. Запустить | Карта эстетических ценностей |
| UI-23 | Линзы Шелла | 1. Переключиться на вкладку линз | 9 линз с вопросами |
| UI-24 | Матрица Бонда | 1. Переключиться на вкладку матрицы | Таблица 4x3 |
| UI-25 | Переключение режимов | 1. Переключаться между Tabs | Корректное отображение |
| UI-26 | Обнаружение диссонанса | 1. Запустить анализ с конфликтами | Предупреждение о диссонансе |
| UI-27 | Лудонарративный анализ | 1. Проверить результат анализа | Гармония/Ирония/Диссонанс |

### 4.5 Блок 4: Баланс и симуляция

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-28 | Transitive-таблица | 1. Открыть /blocks/4 | Таблица с цветовой индикацией |
| UI-29 | Payoff-матрица | 1. Переключиться на вкладку | Тепловая карта NxN |
| UI-30 | Графики Monte Carlo | 1. Запустить симуляцию | Графики win rate |
| UI-31 | Machinations-визуализация | 1. Переключиться на вкладку | Граф ресурсов |
| UI-32 | AI-коррекции | 1. Проверить панель коррекций | Рекомендации с кнопками |
| UI-33 | Запуск симуляции | 1. Нажать «Запустить симуляцию» | Прогресс-бар, затем результаты |

### 4.6 Блок 5: Прогрессия и экономика

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-34 | Открытие страницы | 1. Открыть /blocks/5 | Страница с двумя вкладками «Прогрессия» и «Экономика» |
| UI-35 | Форма прогрессии | 1. Выбрать жанр 2. Ввести длительность 3. Выбрать тип | Форма валидна |
| UI-36 | Запуск проектирования | 1. Нажать «Спроектировать прогрессию» | Загрузка, затем результаты |
| UI-37 | Макро-параметры | 1. Переключиться на вкладку | totalLevels, progressionType, emergenceRatio |
| UI-38 | Таблица tiers | 1. Переключиться на вкладку «Этапы» | Таблица с 8 колонками |
| UI-39 | Кривые прогрессии | 1. Переключиться на вкладку «Кривые» | 4 графика Recharts |
| UI-40 | Контент-план | 1. Переключиться на вкладку | Таблица unlock_tree + график сложности |
| UI-41 | Валидация прогрессии | 1. Переключиться на вкладку «Валидация» | Pass/fail проверки + overall score |
| UI-42 | Форма экономики | 1. Переключиться на вкладку «Экономика» | Форма с жанром, монетизацией, openness |
| UI-43 | Запуск экономики | 1. Нажать «Спроектировать экономику» | Загрузка, затем результаты |
| UI-44 | Таблица ресурсов | 1. Переключиться на вкладку «Ресурсы» | Таблицы core/subsidiary ресурсов |
| UI-45 | Классификация | 1. Переключиться на вкладку | Economic type, sub_type, risk_level badges |
| UI-46 | Machinations | 1. Переключиться на вкладку | Узлы, flows, feedback loops, patterns |
| UI-47 | Диагностика патологий | 1. Переключиться на вкладку «Диагностика» | Pathologies с severity + faucet/drain ratios |
| UI-48 | Симуляция экономики | 1. Переключиться на вкладку «Симуляция» | Resource curves chart + quality assessment |
| UI-49 | Переключение прогрессия/экономика | 1. Переключаться между вкладками | Корректное отображение |
| UI-50 | Пустое состояние | 1. Открыть /blocks/5 без запуска | Placeholder с иконками |

### 4.7 Блок 6: GDD Generator

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-66 | Открытие страницы GDD | 1. Открыть /blocks/6 | Страница GDD Generator |
| UI-67 | Выбор формата | 1. Выбрать формат из 8 карточек | Формат подсвечен, показаны секции |
| UI-68 | One-Sheet формат | 1. Выбрать one_sheet | 6 секций, 1 страница |
| UI-69 | Full GDD формат | 1. Выбрать full_gdd | 38 секций, оценка 50+ страниц |
| UI-70 | Предпросмотр GDD | 1. Нажать «Сгенерировать GDD» | Markdown-renderer с оглавлением |
| UI-71 | Индикаторы источников | 1. Проверить значки секций | auto/ai/manual значки |
| UI-72 | Coverage score | 1. Проверить панель покрытия | Процент автозаполнения |
| UI-73 | Секция Core Loop | 1. Проверить Core Loop в GDD | Диаграмма + таблица шагов |
| UI-74 | Секция Баланс | 1. Проверить Баланс в GDD | Таблица + формулы |
| UI-75 | Секция Прогрессия | 1. Проверить Прогрессию в GDD | Кривые + tiers |
| UI-76 | Секция Экономика | 1. Проверить Экономику в GDD | Machinations-диаграмма + ресурсы |
| UI-77 | Ручные секции | 1. Проверить секцию Лицензия | Скелет с подсказками |
| UI-78 | Экспорт PDF | 1. Нажать «Экспорт PDF» | Загрузка PDF-файла (WeasyPrint) |
| UI-79 | Экспорт DOCX | 1. Нажать «Экспорт DOCX» | Загрузка DOCX-файла (python-docx) |
| UI-78a | Экспорт MD | 1. Нажать «Экспорт MD» | Markdown-файл скачивается |
| UI-78b | Экспорт HTML | 1. Нажать «Экспорт HTML» | HTML-файл с CSS скачивается |
| UI-80 | Пустое состояние | 1. Открыть GDD без данных проекта | Placeholder с подсказками |
| UI-81 | Согласованность GDD | 1. Нажать «Проверить согласованность» | ConsistencyPanel с error/warning/info |
| UI-82 | Панель несоответствий | 1. Проверить ConsistencyPanel | Список проблем с кнопками «Исправить» |
| UI-83 | Полный пайплайн 1→7 | 1. Нажать «Запустить полный пайплайн» | GDD с assembled + formatted документом |
| UI-84 | Предпросмотр formatted GDD | 1. Переключиться на вкладку «Документ» | Markdown с оглавлением, нумерацией, стилями |

### 4.7b Checklist-валидация (панель на странице GDD) *(NEW in 4.D.4)*

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-85 | Открытие вкладки Checklist | 1. Открыть /blocks/6 2. Переключиться на вкладку «Checklist» | Отображается панель Checklist с кнопкой «Запустить валидацию» |
| UI-86 | Запуск валидации | 1. Нажать «Запустить валидацию» | Прогресс-бар, затем результаты проверок |
| UI-87 | Результаты MDA-проверки | 1. Проверить блок MDA в результатах | Список issues: orphan эстетики/динамики, Bond dissonance, скоринг |
| UI-88 | Результаты проверки баланса | 1. Проверить блок Баланс в результатах | Overpowered/underpowered, доминантная стратегия, grind, difficulty wall |
| UI-89 | Результаты проверки нарратива | 1. Проверить блок Нарратив в результатах | Ludonarrative dissonance/irony/harmony, agency gaps, quest variety |
| UI-90 | Результаты проверки экономики | 1. Проверить блок Экономика в результатах | Runaway, deadlock, Q-factor, profitability |
| UI-91 | Результаты линз | 1. Проверить блок Линзы | Список линз с вопросами и оценками, genre-specific линзы |
| UI-92 | Общий score и readiness | 1. Проверить панель общего скоринга | Score 0-100, readiness level (ready/almost/not_ready), цветовая индикация |
| UI-93 | Remediation plan | 1. Нажать «Показать рекомендации» | Список рекомендаций с приоритетами и estimated effort |
| UI-94 | Quick wins | 1. Проверить блок Quick Wins | Список проблем с low effort, кнопки «Исправить» |
| UI-95 | Фильтр по severity | 1. Выбрать фильтр «Только critical» | Отображаются только critical issues |
| UI-96 | Пустое состояние | 1. Открыть Checklist без данных проекта | Placeholder с сообщением «Заполните блоки для валидации» |

### 4.8 Сквозной пайплайн (1→5)

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-51 | Progress Sidebar | 1. Проверить индикатор прогресса | Статус по 8 блокам, цветовая индикация |
| UI-52 | Автозаполнение Блок 2 из Блока 1 | 1. Заполнить Блок 1 → перейти в Блок 2 | Данные предзаполнены из OnePager |
| UI-53 | Автозаполнение Блок 3 из 1+2 | 1. Заполнить Блок 2 → перейти в Блок 3 | mechanics + core_loop_data заполнены |
| UI-54 | Автозаполнение Блок 4 из 1+2+3 | 1. Заполнить Блок 3 → перейти в Блок 4 | concept_data, core_loop_data, mda_data |
| UI-55 | Автозаполнение Блок 5 из 1+2+3+4 | 1. Заполнить Блок 4 → перейти в Блок 5 | progression_input + economy_input |
| UI-56 | Уведомления stale | 1. Обновить данные в Блоке 1 | Уведомление о пересчёте Блоков 2-8 |
| UI-57 | Pipeline Flow Indicator 1→5 | 1. Проверить индикатор потока | Визуализация потока 1→2→3→4→5 |
| UI-58 | Кнопка «Пересчитать всё» | 1. Нажать «Запустить пайплайн 1→5» | Последовательный запуск всех 5 блоков |
| UI-59 | Cascade-обновление | 1. Изменить жанр в Блоке 1 | Блоки 2-5 помечены stale (жёлтый/оранжевый) |
| UI-60 | Stale-уведомления для Блока 5 | 1. Обновить Блок 4 | Уведомление «Рекомендуется пересчитать прогрессию и экономику» |

### 4.8 Общие UI-тесты

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-61 | Responsive дизайн | 1. Изменить размер окна | Адаптивная верстка |
| UI-62 | Тёмная/светлая тема | 1. Переключить тему | Корректная смена стилей |
| UI-63 | Страница проектов | 1. Открыть /projects | Список проектов |
| UI-64 | Создание проекта | 1. Нажать «Новый проект» | Модальное окно |
| UI-65 | Настройки | 1. Открыть /settings | Страница настроек |

---

## 5. E2E-сценарии (ручные)

| ID | Сценарий | Описание |
|----|----------|----------|
| E2E-01 | Полный пайплайн «идея → GDD» | Пользователь проходит все блоки последовательно |
| E2E-02 | Редактирование концепции | Изменение данных в Блоке 1 → каскадное обновление |
| E2E-03 | Балансировка экономики | Запуск диагностики → применение коррекций → пересчёт |
| E2E-04 | Monte Carlo + Machinations | Запуск обеих симуляций, анализ расхождения |
| E2E-05 | Проектирование прогрессии | Настройка кривых, проверка валидации, просмотр контент-плана |
| E2E-06 | Экономическое моделирование | Идентификация ресурсов → классификация → Machinations → диагностика → балансировка → симуляция |
| E2E-07 | Сквозной пайплайн 1→5 | Ввод идеи → Концепция → Core Loop → MDA → Баланс → Прогрессия → Экономика за одну операцию (run-full-pipeline) |
| E2E-08 | Интеграционный тест «Roguelike про алхимика» | Тест-кейс из 4.C.10: идея → все 5 блоков, проверка целостности данных, cascade stale |
| E2E-09 | GDD Generator: One-Sheet | Ввод идеи → Заполнить Блоки 1-5 → Выбрать формат one_sheet → Сгенерировать GDD → Проверить 6 секций, 1 страницу |
| E2E-10 | GDD Generator: Full GDD | Ввод идеи → Заполнить все блоки → Сгенерировать full_gdd → Проверить 38 секций, автозаполненные + AI + ручные |
| E2E-11 | GDD Export: PDF | Заполнить все блоки → Сгенерировать GDD → Экспорт PDF → Файл скачивается, корректный формат |
| E2E-12 | GDD Export: DOCX | Заполнить все блоки → Сгенерировать GDD → Экспорт DOCX → Файл скачивается, открывается в Word |
| E2E-13 | GDD Consistency Check | Заполнить блоки с противоречиями → Проверить согласованность → Error/warning/info проблемы отображаются |
| E2E-14 | GDD Full Pipeline 1→7 | Ввод идеи → Полный пайплайн → Assembled + Formatted документ → Экспорт в 4 форматах |
| E2E-15 | Checklist-валидация полного пайплайна | Ввод идеи → Заполнить все блоки → Запустить Checklist-валидацию → Проверить score, readiness level, top-5 issues, quick wins, remediation plan |

---

## 6. Сводная статистика

### 6.1 Реализованные автоматизированные тесты

| Категория | Файлов | Тестов |
|-----------|--------|--------|
| Backend (pytest) | 14 | 470+ |
| Frontend (vitest) | 3 | 9 |
| **Итого** | **17** | **480+** |

### 6.2 Плановые автоматизированные тесты

| Категория | Тестов |
|-----------|--------|
| Backend (новые модули) | ~240 |
| Frontend (новые компоненты) | ~112 |
| **Итого плановых** | **~352** |

### 6.3 Ручные UI/E2E тесты

| Категория | Кейс |
|-----------|------|
| UI-тесты | 97 |
| E2E-сценарии | 15 |
| **Итого** | **112** |

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

## Найденные баги
1. [Критичность] Описание

## Замечания
- Заметки
```
