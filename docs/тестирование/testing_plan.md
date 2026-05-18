# Gidede — Документ тестирования

> **Фаза**: 4.C.5 (прогрессия)
> **Дата**: 2026-05-19  
> **Версия**: 0.21.0  
> **Статус**: Активный  
> **Подход**: Локальное тестирование + CI/CD (GitHub Actions)

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика и через CI/CD пайплайн (GitHub Actions: `.github/workflows/ci.yml`). Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.5), Core Loop Designer (4.B.6–4.B.8), MDA Lab (4.B.9–4.B.11), сквозной пайплайн (4.B.12), баланс и симуляцию (4.C.1–4.C.4), прогрессию (4.C.5), а также скелетные эндпоинты будущих блоков.

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

## 2. Программные тесты (автоматизированные)

### 2.1 Backend — pytest

#### Структура тестов

```
mini-services/api-service/tests/
├── conftest.py                    # Общие фикстуры
├── test_health.py                 # Health check API
├── test_auth.py                   # Авторизация (регистрация, логин, JWT, refresh)
├── test_projects.py               # CRUD проектов
├── test_rag_service.py            # RAG-сервис (векторный поиск, чанкинг)
├── test_prompt_registry.py        # Реестр промптов (34 PromptSpec)
├── test_text_chunker.py           # Разбиение текста на чанки
├── test_concept_service.py        # Генератор концепции (Этапы 1–7)
├── test_validation.py             # Валидация концепции (Triangle, 5Q, 8F)
├── test_one_pager.py              # Сборка One-Pager
├── test_coreloop_service.py       # Core Loop Designer (Этапы 1–5)
├── test_coreloop_api.py           # API Core Loop Designer
├── test_coreloop_validation.py    # Валидация Core Loop (Этапы 4–5)
├── test_mda_service_stages_1_3.py  # MDA Lab Этапы 1–3 (4.B.9)
├── test_mda_service_stage_4.py    # ★ НОВОЕ: MDA Classic MDA проход (4.B.10)
├── test_mda_service_stage_5.py    # ★ НОВОЕ: MDA Линзы Шелла (4.B.10)
├── test_mda_service_stage_6.py    # ★ НОВОЕ: MDA Матрица Бонда (4.B.10)
├── test_mda_service_full.py       # ★ НОВОЕ: MDA полный пайплайн 1–6 (4.B.10)
├── test_mda_api_full.py           # API MDA полный анализ (4.B.10)
├── test_jwt_secret.py             # JWT secret property (TD-017)
├── test_pipeline_service.py       # ★ НОВОЕ: Pipeline Service — сквозной пайплайн (4.B.12)
├── test_pipeline_api.py           # ★ НОВОЕ: API Pipeline endpoints (4.B.12)
├── test_balance_service.py        # ★ НОВОЕ: Balance Service — транзитивный, нетранзитивный, ситуационный, Q-фактор, Monte Carlo, Machinations (4.C.1–4.C.3)
└── test_progression_service.py    # ★ НОВОЕ: Progression Service — макро-параметры, tiers, кривые, контент-план, полный пайплайн (4.C.5)
```

#### Фикстуры (conftest.py)

| Фикстура | Описание |
|----------|----------|
| `test_db` | In-memory SQLite для изоляции тестов |
| `test_client` | Async HTTP-клиент (httpx) |
| `authenticated_client` | Клиент с авторизованным пользователем |
| `mock_ai_provider` | Мок AI-провайдера (без реальных вызовов) |
| `sample_project_state` | Тестовый Project State |
| `sample_concept_input` | Тестовый ConceptInput |
| `sample_aesthetic_profile` | Тестовый AestheticProfile |
| `sample_dynamics_profile` | Тестовый DynamicsProfile |
| `sample_mechanic_set` | Тестовый MechanicSet |
| `sample_core_loop_candidates` | Тестовые 3 варианта CoreLoop |
| `sample_usp_candidates` | Тестовые 3 варианта USP |
| `sample_validation_report` | Тестовый ValidationReport |
| `sample_one_pager` | Тестовый OnePager |
| `sample_structural_type` | ★ Тестовый StructuralType |
| `sample_core_loop_profile` | ★ Тестовый CoreLoopProfile |
| `sample_loop_hierarchy` | ★ Тестовый LoopHierarchy |
| `sample_pathology_report` | ★ Тестовый PathologyReport |
| `sample_core_loop_validation` | ★ Тестовый CoreLoopValidationResult |
| `sample_recommendations` | Тестовый список рекомендаций |
| `sample_coreloop_design_result` | ★ Тестовый результат POST /coreloop/design |
| `sample_balance_input` | ★ Тестовый BalanceInput (объекты, ресурсы, жанр) |
| `sample_balance_objects` | ★ Список из 5 тестовых BalanceObject (персонажи/оружие) |
| `sample_transitive_result` | ★ Тестовый TransitiveResult |
| `sample_intransitive_result` | ★ Тестовый IntransitiveResult |
| `sample_situational_result` | ★ Тестовый SituationalResult |
| `sample_q_factor_result` | ★ Тестовый QFactorResult |
| `sample_monte_carlo_result` | ★ Тестовый MonteCarloResult |
| `sample_machinations_result` | ★ Тестовый MachinationsSimResult |
| `sample_stability_analysis` | ★ Тестовый StabilityAnalysis |
| `sample_balance_result` | ★ Тестовый BalanceResult (полный пайплайн) |
| `sample_progression_input` | ★ Тестовый ProgressionInput (genre=rpg, duration=40h, 30 levels) |
| `sample_progression_macro_model` | ★ Тестовый ProgressionMacroModel |
| `sample_tier_model` | ★ Тестовый TierModel (3 tiers) |
| `sample_progression_curves` | ★ Тестовый ProgressionCurves (4 curves) |
| `sample_content_plan` | ★ Тестовый ContentPlan |
| `sample_progression_profile` | ★ Тестовый ProgressionProfile (полный пайплайн) |

#### Тест-кейсы Backend

##### Инфраструктура (4.A)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-01 | `test_health_endpoint` | API отвечает на health check |
| B-02 | `test_health_version` | Health check возвращает версию из VERSION файла |

##### Авторизация (4.A.5)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-03 | `test_register_user` | Регистрация нового пользователя |
| B-04 | `test_register_duplicate_email` | Отклонение дублирующего email |
| B-05 | `test_login_success` | Успешный логин с верными данными |
| B-06 | `test_login_wrong_password` | Отклонение неверного пароля |
| B-07 | `test_login_nonexistent_user` | Отклонение несуществующего пользователя |
| B-08 | `test_protected_endpoint_without_token` | Блокировка доступа без авторизации |
| B-09 | `test_refresh_token` | Обновление access token через refresh token |
| B-10 | `test_expired_token` | Отклонение просроченного токена |

##### Проекты (4.A.6)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-11 | `test_create_project` | Создание проекта |
| B-12 | `test_list_projects` | Список проектов пользователя |
| B-13 | `test_project_isolation` | Изоляция проектов между пользователями |
| B-14 | `test_update_project` | Обновление данных проекта |
| B-15 | `test_delete_project` | Удаление проекта |

##### Реестр промптов (4.A.8)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-16 | `test_all_35_prompts_registered` | Все 35 промптов в реестре |
| B-17 | `test_prompt_spec_has_required_fields` | Структура PromptSpec (id, module, inputs, outputSchema) |
| B-18 | `test_classify_genre_prompt` | Промпт CLASSIFY_GENRE корректен |
| B-19 | `test_extract_aesthetics_prompt` | Промпт EXTRACT_AESTHETICS корректен |
| B-20 | `test_validate_triangle_prompt` | ★ Промпт VALIDATE_TRIANGLE корректен |
| B-21 | `test_validate_idea_filters_prompt` | ★ Промпт VALIDATE_IDEA_FILTERS корректен |
| B-22 | `test_assemble_one_pager_prompt` | ★ Промпт ASSEMBLE_ONE_PAGER корректен |

##### RAG-сервис (4.A.10)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-23 | `test_text_chunker_short_text` | Разбиение короткого текста |
| B-24 | `test_text_chunker_long_text` | Разбиение длинного текста |
| B-25 | `test_text_chunker_headers` | Разбиение по заголовкам |
| B-26 | `test_rag_search_disabled` | RAG с RAG_ENABLED=false |
| B-27 | `test_rag_stats` | Статистика RAG-сервиса |

##### Concept Service — Этапы 1–3 (4.B.2)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-28 | `test_classify_genre_explicit` | Жанр указан явно — используется напрямую |
| B-29 | `test_classify_genre_auto` | Жанр определяется AI из описания |
| B-30 | `test_classify_genre_fallback` | Fallback при недоступности AI |
| B-31 | `test_extract_aesthetics_from_motivations` | Эстетики из мотиваций Йи |
| B-32 | `test_extract_aesthetics_from_idea` | Эстетики из AI-анализа идеи |
| B-33 | `test_extract_aesthetics_fallback` | Fallback из жанрового профиля |
| B-34 | `test_derive_dynamics` | Динамики из эстетического профиля |
| B-35 | `test_derive_dynamics_emergence_strong` | Оценка эмерджентности «strong» |
| B-36 | `test_derive_dynamics_emergence_weak` | Оценка эмерджентности «weak» |
| B-37 | `test_generate_stages_1_3` | Полный пайплайн Этапов 1–3 |

##### Concept Service — Этапы 4–5 (4.B.3)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-38 | `test_select_mechanics_base` | Выбор базовых механик (Группа 1) |
| B-39 | `test_select_mechanics_combat` | Выбор боевых механик при наличии «Враги» |
| B-40 | `test_select_mechanics_no_combat` | Пустые боевые механики без «Враги» |
| B-41 | `test_select_mechanics_progression` | Выбор прогрессионных механик |
| B-42 | `test_select_mechanics_spatial` | Выбор пространственных механик |
| B-43 | `test_select_mechanics_social` | Выбор социальных механик |
| B-44 | `test_select_mechanics_forbidden` | Удаление запрещённых механик |
| B-45 | `test_select_mechanics_conflicts` | Разрешение конфликтов между механиками |
| B-46 | `test_select_mechanics_synergies` | Обнаружение синергий |
| B-47 | `test_select_mechanics_compatibility_score` | Расчёт score совместимости |
| B-48 | `test_generate_core_loops` | Генерация 3 вариантов Core Loop |
| B-49 | `test_generate_core_loops_fallback` | Fallback-генерация Core Loop |
| B-50 | `test_determine_loop_type_engine` | Определение типа «engine» |
| B-51 | `test_determine_loop_type_economy` | Определение типа «economy» |
| B-52 | `test_determine_loop_type_ecology` | Определение типа «ecology» |
| B-53 | `test_determine_loop_type_hybrid` | Определение типа «hybrid» |
| B-54 | `test_generate_usp` | Генерация 3 вариантов USP |
| B-55 | `test_generate_usp_fallback` | Fallback-генерация USP |
| B-56 | `test_generate_stages_4_5` | Полный пайплайн Этапов 4–5 |

##### Concept Service — Валидация (4.B.4, Этап 6) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-57 | `test_validate_concept_full` | Полная валидация через 3 валидатора |
| B-58 | `test_validate_triangle_ai` | AI-валидация Triangle of Weirdness |
| B-59 | `test_validate_triangle_fallback` | Fallback-оценка Triangle без AI |
| B-60 | `test_validate_triangle_weird_corners_warning` | Предупреждение при >1 «странном» угле |
| B-61 | `test_validate_core_questions_all_pass` | 5/5 вопросов пройдены — score=1.0 |
| B-62 | `test_validate_core_questions_no_core_loop` | Отсутствие Core Loop — score<0.6 |
| B-63 | `test_validate_core_questions_no_conflict` | Отсутствие конфликта — warning |
| B-64 | `test_validate_core_questions_no_resources` | Отсутствие ресурсных механик — warning |
| B-65 | `test_validate_core_questions_no_goal` | Отсутствие цели — warning |
| B-66 | `test_validate_idea_filters_ai` | AI-валидация 8 фильтров идеи |
| B-67 | `test_validate_idea_filters_fallback` | Fallback-оценка 8 фильтров без AI |
| B-68 | `test_validate_idea_filters_low_score_warning` | Warning при score<0.6 по фильтру |
| B-69 | `test_validate_concept_overall_score` | Агрегация overall_score из 3 валидаторов |
| B-70 | `test_validate_concept_passed_threshold` | overall_passed=true при score>=0.6 |

##### Concept Service — Сборка One-Pager (4.B.4, Этап 7) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-71 | `test_assemble_one_pager_full` | Полная сборка OnePager из результатов Этапов 1–6 |
| B-72 | `test_assemble_one_pager_story_synopsis` | AI-генерация story_synopsis |
| B-73 | `test_assemble_one_pager_story_synopsis_fallback` | Fallback story_synopsis без AI |
| B-74 | `test_assemble_one_pager_gameplay_description` | AI-генерация gameplay_description |
| B-75 | `test_assemble_one_pager_gameplay_description_fallback` | Fallback gameplay_description без AI |
| B-76 | `test_assemble_one_pager_rating_mature` | Рейтинг «M» для horror/shooter |
| B-77 | `test_assemble_one_pager_rating_teen` | Рейтинг «T» для RPG/adventure |
| B-78 | `test_assemble_one_pager_rating_everyone` | Рейтинг «E» для puzzle/party |
| B-79 | `test_assemble_one_pager_uniqueness_score` | Расчёт score уникальности |
| B-80 | `test_assemble_one_pager_unique_features` | Выбор 3 уникальных фич из механик |
| B-81 | `test_assemble_one_pager_stages_completed` | stages_completed = [1,2,3,4,5,6,7] |

##### Полный пайплайн (4.B.1–4.B.4)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-82 | `test_generate_full_pipeline` | Полный пайплайн Этапов 1–7 |
| B-83 | `test_generate_full_latency_ms` | Запись latency_ms в OnePager |
| B-84 | `test_generate_full_models_used` | Запись models_used в OnePager |
| B-85 | `test_generate_full_validation_included` | ValidationReport включён в OnePager |

##### API-эндпоинты концепции (4.B.1–4.B.4)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-86 | `test_api_concept_generate` | POST /api/v1/concept/generate — полный OnePager |
| B-87 | `test_api_concept_generate_unauthorized` | 401 без авторизации |
| B-88 | `test_api_concept_generate_invalid_input` | 400 при невалидных данных |
| B-89 | `test_api_concept_get` | GET /api/v1/concept/{id} — получение концепции |
| B-90 | `test_api_concept_get_not_found` | 404 при несуществующем ID |
| B-91 | `test_api_concept_validate` | ★ POST /api/v1/concept/{id}/validate — валидация |
| B-92 | `test_api_concept_validate_not_found` | ★ 404 при валидации несуществующей концепции |

##### Core Loop Service — Этап 1: Классификация (4.B.6) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-93 | `test_classify_core_loop_engine` | Определение типа «engine» (усиливающие + один ресурс) |
| B-94 | `test_classify_core_loop_economy` | Определение типа «economy» (усиливающие + конвертация) |
| B-95 | `test_classify_core_loop_ecology` | Определение типа «ecology» (балансирующие + конвертация) |
| B-96 | `test_classify_core_loop_hybrid` | Определение типа «hybrid» (смешанные петли) |
| B-97 | `test_classify_core_loop_braked_engine` | Определение подтипа «braked_engine» (с тормозящим механизмом) |
| B-98 | `test_classify_core_loop_multi_currency` | Определение подтипа «multi_currency_economy» (2+ валюты) |
| B-99 | `test_extract_resources_from_mechanics` | Извлечение ресурсов из MechanicsDB |
| B-100 | `test_determine_loop_type_reinforcing` | Определение усиливающих петель |
| B-101 | `test_determine_loop_type_balancing` | Определение балансирующих петель |
| B-102 | `test_risk_assessment_high` | Оценка риска «high» для Engine без торможения |
| B-103 | `test_risk_assessment_low` | Оценка риска «low» для Ecology с торможением |

##### Core Loop Service — Этап 2: Иерархия петель (4.B.6) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-104 | `test_build_loop_hierarchy_6_levels` | Построение иерархии из 6 уровней |
| B-105 | `test_build_loop_hierarchy_micro` | Уровень «micro» — мс-секунды |
| B-106 | `test_build_loop_hierarchy_meta` | Уровень «meta» — недели-месяцы |
| B-107 | `test_build_inner_loops` | Генерация внутренних петель (DECOMPOSE_STEP) |
| B-108 | `test_build_inner_loops_fallback` | Fallback внутренних петель без AI |
| B-109 | `test_build_outer_loops` | Генерация внешних петель (GENERATE_OUTER_LOOPS) |
| B-110 | `test_build_outer_loops_fallback` | Fallback внешних петель без AI |
| B-111 | `test_build_meta_loop` | Генерация мета-петли (GENERATE_META_LOOP) |
| B-112 | `test_build_meta_loop_fallback` | Fallback мета-петли без AI |
| B-113 | `test_loop_hierarchy_parent_child` | Связь parent_step в иерархии |

##### Core Loop Service — Этап 3: Диагностика патологий (4.B.6) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-114 | `test_diagnose_runaway` | Обнаружение патологии «runaway» |
| B-115 | `test_diagnose_deadlock` | Обнаружение патологии «deadlock» |
| B-116 | `test_diagnose_stall` | Обнаружение патологии «stall» |
| B-117 | `test_diagnose_brittleness` | Обнаружение патологии «brittleness» |
| B-118 | `test_diagnose_oscillation` | Обнаружение патологии «oscillation» |
| B-119 | `test_diagnose_stagnation` | Обнаружение патологии «stagnation» |
| B-120 | `test_diagnose_triviality` | Обнаружение патологии «triviality» |
| B-121 | `test_pathology_severity_critical` | Критичность патологии «runaway» → critical |
| B-122 | `test_pathology_severity_warning` | Критичность патологии «stagnation» → warning |
| B-123 | `test_pathology_correction_suggestion` | Наличие предложения по исправлению |
| B-124 | `test_diagnose_multiple_pathologies` | Обнаружение нескольких патологий одновременно |
| B-125 | `test_pathology_report_metrics` | Корректность total_count и critical_count |

##### Core Loop Service — Этап 4: Валидация Core Loop (4.B.7) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-126 | `test_validate_core_loop_all_pass` | Все 5 критериев пройдены — overall_passed=true |
| B-127 | `test_validate_fun_check_pass` | Тест «30 секунд веселья» пройден при наличии обратной связи и награды |
| B-128 | `test_validate_fun_check_fail_no_feedback` | Тест «30 секунд веселья» не пройден без обратной связи |
| B-129 | `test_validate_fun_check_score_calculation` | Корректный расчёт score (0.25 за каждый критерий) |
| B-130 | `test_validate_loop_closedness_resource_overlap` | Замкнутость через пересечение ресурсов (последний → первый) |
| B-131 | `test_validate_loop_closedness_preparation_keyword` | Замкнутость через ключевое слово «подготов» в последнем шаге |
| B-132 | `test_validate_loop_closedness_shared_mechanics` | Замкнутость через общие механики первого и последнего шагов |
| B-133 | `test_validate_loop_closedness_not_closed` | Петля не замкнута — is_closed=false, предупреждение |
| B-134 | `test_validate_loop_closedness_single_step` | Один шаг — замкнутость невозможна |
| B-135 | `test_validate_resource_sufficiency_no_dead` | Нет мёртвых ресурсов — has_dead_resources=false |
| B-136 | `test_validate_resource_sufficiency_dead_resources` | Обнаружены мёртвые ресурсы — produced but not consumed |
| B-137 | `test_validate_resource_sufficiency_unsourced` | Обнаружены потребляемые без источника пополнения |
| B-138 | `test_validate_checklist_critical_pathology` | Критическая патология — checklist_passed не увеличивается |
| B-139 | `test_validate_checklist_step_count_ok` | 3–7 шагов — критерий пройден |
| B-140 | `test_validate_checklist_step_count_too_few` | <3 шагов — критерий не пройден |
| B-141 | `test_validate_checklist_step_count_too_many` | >7 шагов — критерий не пройден |
| B-142 | `test_validate_overall_passed_threshold` | overall_passed=true при >=3 из 5 критериев |
| B-143 | `test_validate_overall_failed_threshold` | overall_passed=false при <3 из 5 критериев |
| B-144 | `test_validate_warnings_generated` | Предупреждения формируются для непройденных критериев |

##### Core Loop Service — Этап 5: Рекомендации (4.B.7) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-145 | `test_recommendations_from_fun_check_failure` | Рекомендация при непройденном тесте «30 секунд веселья» |
| B-146 | `test_recommendations_from_loop_not_closed` | Рекомендация при незамкнутой петле |
| B-147 | `test_recommendations_from_dead_resources` | Рекомендация при мёртвых ресурсах |
| B-148 | `test_recommendations_from_unsourced_consumables` | Рекомендация при потребляемых без источника |
| B-149 | `test_recommendations_from_critical_pathology` | Рекомендация при критических патологиях (priority=high) |
| B-150 | `test_recommendations_from_warning_pathology` | Рекомендация при warning-патологиях (priority=medium) |
| B-151 | `test_recommendations_engine_without_braking` | Структурная рекомендация для Engine без торможения |
| B-152 | `test_recommendations_ai_enrichment` | AI-рекомендации через GENERATE_RECOMMENDATIONS |
| B-153 | `test_recommendations_ai_fallback` | Fallback: только формализованные рекомендации без AI |
| B-154 | `test_recommendations_priority_levels` | Корректные приоритеты: high для critical, medium для warning |
| B-155 | `test_recommendations_category_and_source` | Категория (fun/closedness/resource/pathology/structure) и источник (formal/ai) |

##### Core Loop — Полный пайплайн (4.B.7) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-156 | `test_design_full_pipeline` | Полный пайплайн Этапов 1–5 |
| B-157 | `test_design_full_structural_type` | StructuralType заполнен в результате |
| B-158 | `test_design_full_loop_hierarchy` | LoopHierarchy заполнен в результате |
| B-159 | `test_design_full_pathologies` | PathologyReport заполнен в результате |
| B-160 | `test_design_full_validation` | ★ CoreLoopValidationResult заполнен в результате |
| B-161 | `test_design_full_recommendations` | ★ Рекомендации содержат формализованные записи |
| B-162 | `test_design_full_stages_completed` | ★ stages_completed = [1,2,3,4,5] |

##### API-эндпоинты Core Loop (4.B.7) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-163 | `test_api_coreloop_design` | POST /api/v1/coreloop/design — полный CoreLoopProfile |
| B-164 | `test_api_coreloop_design_unauthorized` | 401 без авторизации |
| B-165 | `test_api_coreloop_design_invalid_input` | 400 при невалидных данных |
| B-166 | `test_api_coreloop_design_with_concept` | Проектирование с данными из существующей концепции |
| B-167 | `test_api_coreloop_design_validation` | ★ Ответ содержит validation с результатом валидации |
| B-168 | `test_api_coreloop_design_stages_completed` | ★ stages_completed = [1,2,3,4,5] |

##### JWT Secret Property (TD-017) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-169 | `test_jwt_secret_from_env` | jwt_secret возвращает значение из JWT_SECRET_KEY env |
| B-170 | `test_jwt_secret_dev_auto_generated` | jwt_secret auto-generated при DEBUG=true и пустом env |
| B-171 | `test_jwt_secret_production_error` | RuntimeError при DEBUG=false и пустом JWT_SECRET_KEY |

##### MDA Service — Этап 1: Целевые динамики (4.B.9) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-172 | `test_determine_target_dynamics` | Определение целевых динамик из эстетического профиля |
| B-173 | `test_aesthetic_dynamics_map_sensation` | Маппинг «Чувственное → динамики» содержит 4 динамики |
| B-174 | `test_aesthetic_dynamics_map_all_8` | Все 8 эстетик имеют маппинг в AESTHETIC_DYNAMICS_MAP |
| B-175 | `test_genre_filtering_warning` | Предупреждение при нетипичной динамике для жанра |
| B-176 | `test_genre_filtering_puzzle` | Жанр «puzzle» получает предупреждения о кооперации |
| B-177 | `test_ai_enrichment_suggest_dynamics` | AI-обогащение через SUGGEST_DYNAMICS |
| B-178 | `test_ai_enrichment_fallback` | Fallback при недоступности AI — только формализованные динамики |
| B-179 | `test_prioritization_multi_aesthetic_first` | Динамики, обслуживающие несколько эстетик, приоритетнее |
| B-180 | `test_emergence_level_strong` | Уровень эмерджентности «strong» для sandbox с 8+ динамиками |
| B-181 | `test_emergence_level_nominal` | Уровень эмерджентности «nominal» для <3 динамик |
| B-182 | `test_emergence_level_multiple` | Уровень эмерджентности «multiple» для 6+ динамик |

##### MDA Service — Этап 2: Маппинг «Динамика → Механики» (4.B.9) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-183 | `test_map_dynamics_to_mechanics` | Маппинг динамик в механики — основной метод |
| B-184 | `test_formal_mechanics_from_db` | Формализованный отбор механик из MechanicsDB |
| B-185 | `test_formal_mechanics_from_dynamics_map` | Механики из формализованного маппинга DYNAMICS_MECHANICS_MAP |
| B-186 | `test_adams_pattern_mechanics` | Механики из паттернов Adams/Dormans |
| B-187 | `test_ai_enrichment_suggest_mechanics` | AI-расширение пула через SUGGEST_MECHANICS |
| B-188 | `test_ai_enrichment_fallback_mechanics` | Fallback при недоступности AI |
| B-189 | `test_set_cover_optimization` | Жадная аппроксимация Set Cover покрывает все динамики |
| B-190 | `test_set_cover_uncovered_dynamics` | Непокрытые динамики отмечены в результате |
| B-191 | `test_synergy_mechanics_added` | Синергетические механики добавлены до max_mechanics |
| B-192 | `test_conflict_detection` | Конфликты между выбранными механиками обнаружены |
| B-193 | `test_forbidden_mechanics_excluded` | Запрещённые механики исключены из пула |
| B-194 | `test_aesthetic_coverage_calculation` | Покрытие эстетик рассчитано корректно |

##### MDA Service — Этап 3: Сборка набора механик (4.B.9) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-195 | `test_assemble_mechanic_set` | Сборка и оптимизация набора механик |
| B-196 | `test_conflict_resolution_required_wins` | Обязательная механика побеждает в конфликте |
| B-197 | `test_conflict_resolution_coverage_wins` | Механика с большим покрытием побеждает в конфликте |
| B-198 | `test_required_mechanics_added` | Обязательные механики добавлены даже если не в пуле |
| B-199 | `test_forbidden_mechanics_removed` | Запрещённые механики удалены из набора |
| B-200 | `test_aesthetic_coverage_sufficient` | Проверка покрытия эстетик (>= 2 механики) |
| B-201 | `test_aesthetic_coverage_insufficient_warning` | Предупреждение при недостаточном покрытии |
| B-202 | `test_adams_patterns_engine_detected` | Паттерн «Static Engine» обнаружен при наличии XP/ресурсов |
| B-203 | `test_adams_patterns_friction_detected` | Паттерн «Static Friction» обнаружен при наличии маны/патронов |
| B-204 | `test_adams_patterns_escalation_detected` | Паттерн «Escalating Challenge» обнаружен |
| B-205 | `test_adams_patterns_missing_suggestion` | Рекомендация при отсутствии паттерна |
| B-206 | `test_mechanic_grouping_base` | Группировка базовых механик (Группа 1) |
| B-207 | `test_mechanic_grouping_combat` | Группировка боевых механик (Группы 4, 8) |
| B-208 | `test_mechanic_grouping_progression` | Группировка прогрессионных (Группы 2, 9) |
| B-209 | `test_mechanic_grouping_spatial` | Группировка пространственных (Группы 3, 5, 11) |
| B-210 | `test_mechanic_grouping_social` | Группировка социальных (Группы 7, 14) |
| B-211 | `test_compatibility_score_calculation` | Расчёт score совместимости (0-100) |
| B-212 | `test_synergy_score_calculation` | Расчёт score синергии (0-100) |

##### MDA Service — Полный пайплайн (4.B.9) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-213 | `test_analyze_stages_1_3` | Полный пайплайн Этапов 1–3 |
| B-214 | `test_analyze_iterations_convergence` | Сходимость при достаточном покрытии эстетик |
| B-215 | `test_analyze_iterations_max` | Остановка при достижении maxIterations=3 |
| B-216 | `test_analyze_dynamics_target_filled` | DynamicsTarget заполнен в результате |
| B-217 | `test_analyze_mechanic_set_filled` | StructuredMechanicSet заполнен в результате |
| B-218 | `test_analyze_stages_completed` | stages_completed = [1,2,3] |

##### API-эндпоинты MDA Lab (4.B.9) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-219 | `test_api_mda_analyze` | POST /api/v1/mda/analyze — полный MDAProfile |
| B-220 | `test_api_mda_analyze_invalid_input` | 400 при невалидных данных |
| B-221 | `test_api_mda_analyze_custom_aesthetics` | Произвольные эстетики в запросе |
| B-222 | `test_api_mda_analyze_forbidden_mechanics` | Запрещённые механики исключены из результата |
| B-223 | `test_api_mda_analyze_iterations` | maxIterations параметр работает |

##### MDA Service — Этап 4: Classic MDA аналитический проход (4.B.10) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-224 | `test_classic_mda_pass` | Classic MDA проход — основной метод |
| B-225 | `test_classic_mda_simulate_gameplay` | AI-моделирование геймплея через SIMULATE_GAMEPLAY |
| B-226 | `test_classic_mda_simulate_gameplay_fallback` | Fallback при недоступности AI — формализованная модель |
| B-227 | `test_classic_mda_extract_observed_dynamics` | Извлечение наблюдаемых динамик из симуляции |
| B-228 | `test_classic_mda_predict_aesthetics` | Предсказание эстетики из наблюдаемых динамик |
| B-229 | `test_classic_mda_match_scores` | Сравнение предсказанной и целевой эстетики (match_scores) |
| B-230 | `test_classic_mda_overall_match` | Расчёт overall_match как среднего по match_scores |
| B-231 | `test_classic_mda_convergence` | Проверка сходимости при overall_match >= threshold |
| B-232 | `test_classic_mda_no_convergence` | Отсутствие сходимости при низких match_scores |
| B-233 | `test_classic_mda_weak_aesthetic_suggestion` | Рекомендации для слабых эстетик (score < 0.6) |
| B-234 | `test_classic_mda_stability_check_stable` | Проверка устойчивости при стабильных feedback loops |
| B-235 | `test_classic_mda_stability_runaway` | Обнаружение runaway-патологии |
| B-236 | `test_classic_mda_stability_oscillating` | Обнаружение осциллирующей петли |
| B-237 | `test_classic_mda_stability_stall` | Обнаружение stall при отсутствии негативных петель |
| B-238 | `test_classic_mda_iterations` | Итеративная коррекция до maxIterations |
| B-239 | `test_classic_mda_gameplay_script` | Текстовое описание геймплея заполнено |

##### MDA Service — Этап 5: Валидация через Линзы Шелла (4.B.10) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-240 | `test_validate_lenses` | Валидация через 9 линз Шелла — основной метод |
| B-241 | `test_validate_lenses_9_priority` | Все 9 приоритетных линз применены |
| B-242 | `test_validate_lens_tetrad` | Линза #9 «Тетрада» — согласованность 4 элементов |
| B-243 | `test_validate_lens_unity` | Линза #11 «Единство» — общий замысел |
| B-244 | `test_validate_lens_resonance` | Линза #12 «Резонанс» — усиление элементов |
| B-245 | `test_validate_lens_emergence` | Линза #30 «Эмерджентность» — глаголы и действия |
| B-246 | `test_validate_lens_action_space` | Линза #31 «Пространство действий» — perceived vs real |
| B-247 | `test_validate_lens_triangularity` | Линза #40 «Треугольность» — выбор риска |
| B-248 | `test_validate_lens_dominant_strategy` | Линза #41 «Доминантная стратегия» — лучший путь |
| B-249 | `test_validate_lens_interest_curve` | Линза #69 «Кривая интереса» — пики и спады |
| B-250 | `test_validate_lens_freedom_vs_control` | Линза #74 «Свобода vs управляемость» — агентивность |
| B-251 | `test_validate_lens_ai_evaluation` | AI-оценка через APPLY_LENS_MDA промпт |
| B-252 | `test_validate_lens_formal_fallback` | Формализованная fallback-оценка при недоступности AI |
| B-253 | `test_validate_lens_aggregation_critical` | Агрегация: critical_issues при score < 0.4 |
| B-254 | `test_validate_lens_aggregation_warnings` | Агрегация: warnings при score 0.4–0.7 |
| B-255 | `test_validate_lens_aggregation_passed` | Агрегация: passed при score >= 0.7 |
| B-256 | `test_validate_lens_overall_score` | Общий score как среднее по 9 линзам |

##### MDA Service — Этап 6: Матрица 4×3 Бонда + лудонарративный анализ (4.B.10) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-257 | `test_validate_bond_matrix` | Валидация через матрицу Бонда — основной метод |
| B-258 | `test_bond_matrix_12_cells` | Матрица содержит 12 ячеек (4 элемента × 3 уровня) |
| B-259 | `test_bond_matrix_mechanic_fixed` | Ячейка «Механика/Фиксированный» содержит определённые правила |
| B-260 | `test_bond_matrix_narrative_fixed` | Ячейка «История/Фиксированный» содержит заданный нарратив |
| B-261 | `test_bond_matrix_aesthetic_fixed` | Ячейка «Эстетика/Фиксированный» содержит целевые эстетики |
| B-262 | `test_bond_matrix_technology_fixed` | Ячейка «Технология/Фиксированный» содержит жанровую платформу |
| B-263 | `test_bond_matrix_dynamic_level` | Динамический уровень содержит эмергентные данные |
| B-264 | `test_bond_matrix_cultural_level` | Культурный уровень содержит культурные аспекты |
| B-265 | `test_bond_row_consistency` | Горизонтальная согласованность по строкам |
| B-266 | `test_bond_row_dissonance_detection` | Обнаружение рассогласований в строках |
| B-267 | `test_bond_col_consistency` | Вертикальная согласованность по столбцам |
| B-268 | `test_bond_col_logical_sequence` | Логическая последовательность Фиксированный → Динамический → Культурный |
| B-269 | `test_bond_overall_consistency` | Общая согласованность как среднее row + col scores |
| B-270 | `test_ludonarrative_check_harmony` | Лудонарративная гармония при наличии нарративных механик |
| B-271 | `test_ludonarrative_check_irony` | Лудонарративная ирония при отсутствии нарративных механик |
| B-272 | `test_ludonarrative_check_disonance` | Лудонарративный диссонанс через CHECK_LUDONARRATIVE_MDA |
| B-273 | `test_ludonarrative_ai_evaluation` | AI-оценка через CHECK_LUDONARRATIVE_MDA промпт |
| B-274 | `test_ludonarrative_formal_fallback` | Формализованный fallback при недоступности AI |
| B-275 | `test_ludonarrative_correction_suggestion` | Рекомендация коррекции при иронии/диссонансе |

##### MDA Service — Полный пайплайн 1–6 (4.B.10) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-276 | `test_analyze_full` | Полный пайплайн Этапов 1–6 |
| B-277 | `test_analyze_full_classic_mda` | classic_mda_result заполнен в результате |
| B-278 | `test_analyze_full_lens_validation` | lens_validation заполнен в результате |
| B-279 | `test_analyze_full_bond_validation` | bond_validation заполнен в результате |
| B-280 | `test_analyze_full_stages_completed` | stages_completed = [1,2,3,4,5,6] |
| B-281 | `test_analyze_full_models_used` | models_used содержит SIMULATE_GAMEPLAY, APPLY_LENS_MDA, CHECK_LUDONARRATIVE_MDA |
| B-282 | `test_analyze_full_short_mode` | full_analysis=False — только Этапы 1–3 |
| B-283 | `test_analyze_full_stage_4_failure_graceful` | Отказоустойчивость при падении Этапа 4 |
| B-284 | `test_analyze_full_stage_5_failure_graceful` | Отказоустойчивость при падении Этапа 5 |
| B-285 | `test_analyze_full_stage_6_failure_graceful` | Отказоустойчивость при падении Этапа 6 |

##### API-эндпоинты MDA Lab — полный анализ (4.B.10) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-286 | `test_api_mda_analyze_full` | POST /api/v1/mda/analyze?full_analysis=true — MDAProfile с 6 этапами |
| B-287 | `test_api_mda_analyze_short` | POST /api/v1/mda/analyze?full_analysis=false — MDAProfile с 3 этапами |
| B-288 | `test_api_mda_analyze_classic_mda_result` | classic_mda_result заполнен при full_analysis=true |
| B-289 | `test_api_mda_analyze_lens_validation` | lens_validation заполнен при full_analysis=true |
| B-290 | `test_api_mda_analyze_bond_validation` | bond_validation заполнен при full_analysis=true |

### 2.2 Frontend — vitest

#### Структура тестов

```
src/__tests__/
├── setup.ts                      # Глобальная настройка
├── components.test.tsx            # Базовые UI-компоненты
├── auth.test.tsx                  # Страницы авторизации
├── api-client.test.ts             # API-клиент
├── concept-form.test.tsx          # Форма ввода концепции (Блок 1)
├── concept-result.test.tsx        # Компоненты отображения результата (Блок 1)
├── coreloop-designer.test.tsx     # ★ НОВОЕ: Core Loop Designer (Блок 2)
├── mda-lab-ui.test.tsx            # MDA Lab UI — вкладки и панели (Блок 3, 4.B.11)
├── pipeline.test.tsx              # ★ НОВОЕ: Pipeline hook + ProgressSidebar (4.B.12)
└── sidebar.test.tsx               # Навигация и прогресс
```

#### Тест-кейсы

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-01 | Базовый рендеринг компонентов | Компоненты рендерятся без ошибок |
| F-02 | Форма логина | Наличие полей Email и Пароль |
| F-03 | Форма регистрации | Наличие полей Имя, Email, Пароль |
| F-04 | API Client: базовый URL | Корректный URL API |
| F-05 | API Client: авторизация | JWT-токен в заголовках |
| F-06 | API Client: обработка 401 | Обработка ошибки авторизации |
| F-07 | Sidebar: навигация по блокам | 8 блоков в sidebar |
| F-08 | Sidebar: статус блоков | Блок 1, 2, 3 — «Активен» |
| F-09 | Sidebar: версия | Отображение «v0.11.0» |
| F-10 | Главная страница: блоки | Карточки 8 блоков |
| F-11 | Форма концепции: поля | Поля идея, жанр, платформа |
| F-12 | ★ OnePagerCard: рендер | Карточка с 8 полями отображается |
| F-13 | ★ AestheticProfileView: бейджи | 3 цветных бейджа эстетик + rationale |
| F-14 | ★ MechanicSetView: группы | 5 групп механик + compatibility_score |
| F-15 | ★ CoreLoopCandidates: выбор | Клик по варианту выделяет его |
| F-16 | ★ USPCandidates: выбор | Клик по USP выделяет его |
| F-17 | ★ ValidationReportView: цвета | Зелёный/жёлтый/красный по score |
| F-18 | ★ Кнопка «Сохранить выбор» | Сохранение выбранных Core Loop и USP |
| F-19 | ★ Core Loop Designer: рендер | Страница /blocks/2 отображается |
| F-20 | ★ Core Loop Designer: форма | Поля conceptId, mechanics, genre, loopType, customSteps |
| F-21 | ★ Core Loop Designer: кнопка | Кнопка «Проектировать Core Loop» активна при заполненных полях |
| F-22 | ★ StructuralTypeCard: тип | Badge типа (Engine/Economy/Ecology/Hybrid) |
| F-23 | ★ StructuralTypeCard: ресурсы | Список ресурсов с классификацией |
| F-24 | ★ StructuralTypeCard: риск | Оценка рисков с mitigation_suggestions |
| F-25 | ★ CoreLoopDiagram: шаги | Круговая диаграмма с N шагами |
| F-26 | ★ CoreLoopDiagram: ресурсы | Потребляемые/производимые ресурсы в шагах |
| F-27 | ★ LoopHierarchyTree: уровни | 6 раскрываемых уровней (micro → meta) |
| F-28 | ★ LoopHierarchyTree: раскрытие | Клик раскрывает/сворачивает уровень |
| F-29 | ★ PathologyPanel: список | Список патологий с severity |
| F-30 | ★ PathologyPanel: критические | Количество критических патологий |
| F-31 | ★ ValidationPanel: критерии | 5 критериев валидации |
| F-32 | ★ ValidationPanel: overall | Пройдено/Не пройдено + прогресс-бар |
| F-33 | ★ RecommendationsPanel: список | Рекомендации с приоритетами |
| F-34 | ★ RecommendationsPanel: категории | Категория (fun/closedness/resource/pathology/structure) |
| F-35 | ★ JWT secret: property | settings.jwt_secret возвращает env или auto-generated dev-ключ |
| F-36 | ★ MDA Lab: рендер | Страница /blocks/3 отображается |
| F-37 | ★ MDA Lab: форма | Поля conceptId, genre, primaryAesthetic, secondaryAesthetic, tertiaryAesthetic |
| F-38 | ★ MDA Lab: кнопка | Кнопка «Анализ MDA» активна при заполненных полях |
| F-39 | ★ DynamicsTarget: динамики | Список core и supporting динамик |
| F-40 | ★ DynamicsTarget: emergence | Уровень эмерджентности с описанием |
| F-41 | ★ MechanicCandidateSet: покрытие | Карта покрытия динамик механиками |
| F-42 | ★ StructuredMechanicSet: группы | 5 групп механик (base/combat/progression/spatial/social) |
| F-43 | ★ StructuredMechanicSet: эстетики | Покрытие эстетик (sufficient/insufficient) |
| F-44 | ★ StructuredMechanicSet: паттерны | Обнаруженные паттерны Adams/Dormans |

##### MDA Lab — Этапы 4–6: Classic MDA и валидация (4.B.10) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-45 | ★ ClassicMDAResult: геймплей | Последовательность шагов моделированного геймплея |
| F-46 | ★ ClassicMDAResult: ресурсы | Потоки ресурсов между действиями |
| F-47 | ★ ClassicMDAResult: feedback | Петли обратной связи (positive/negative) |
| F-48 | ★ ClassicMDAResult: сходимость | overall_match и converged индикатор |
| F-49 | ★ ClassicMDAResult: stability | Статус устойчивости (stable/pathology) |
| F-50 | ★ LensValidation: линзы | Список 9 линз с оценками |
| F-51 | ★ LensValidation: критические | Красная индикация при score < 0.4 |
| F-52 | ★ LensValidation: предупреждения | Жёлтая индикация при score 0.4–0.7 |
| F-53 | ★ LensValidation: пройденные | Зелёная индикация при score >= 0.7 |
| F-54 | ★ LensValidation: overall | Общий score по всем линзам |
| F-55 | ★ BondValidation: матрица | 12 ячеек матрицы 4×3 |
| F-56 | ★ BondValidation: row consistency | Согласованность по строкам с цветовой индикацией |
| F-57 | ★ BondValidation: col consistency | Согласованность по столбцам |
| F-58 | ★ BondValidation: ludonarrative | Результат: Гармония/Ирония/Диссонанс с иконкой |
| F-59 | ★ BondValidation: overall consistency | Общая согласованность (0-1) |

##### MDA Lab UI — вкладки и панели (4.B.11) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-60 | ★ MDALabPage: рендер страницы | Страница /blocks/3 рендерится с формой и 4 вкладками |
| F-61 | ★ MDALabPage: переключение вкладок | Клик по вкладке отображает соответствующую панель |
| F-62 | ★ MDALabPage: валидация формы | Кнопка «Анализ MDA» неактивна при пустых обязательных полях |
| F-63 | ★ MDALabPage: переключение full_analysis | Чекбокс full_analysis включает/отключает вкладки 2–4 |
| F-64 | ★ ReverseMDAPanel: целевые динамики | Отображение core_dynamics и supporting_dynamics |
| F-65 | ★ ReverseMDAPanel: кандидатные механики | Карта покрытия динамик механиками с визуализацией |
| F-66 | ★ ReverseMDAPanel: структурированный набор | 5 групп механик + эстетики + паттерны Adams/Dormans |
| F-67 | ★ ClassicMDAPanel: сходимость | overall_match и converged индикатор |
| F-68 | ★ ClassicMDAPanel: моделирование геймплея | Шаги геймплея с потоками ресурсов и feedback loops |
| F-69 | ★ ClassicMDAPanel: проверка устойчивости | Статус устойчивости (stable/runaway/oscillating/stall) |
| F-70 | ★ LensAuditPanel: 9 линз | Список 9 линз Шелла с оценками и colour-coding |
| F-71 | ★ LensAuditPanel: проблемы | Критические проблемы и предупреждения по линзам |
| F-72 | ★ LensAuditPanel: предложения | Рекомендации по улучшению для каждой линзы |
| F-73 | ★ BondMatrixPanel: матрица 4×3 | Таблица 4 элемента × 3 уровня с содержимым ячеек |
| F-74 | ★ BondMatrixPanel: согласованность | Row consistency и col consistency с цветовой индикацией |
| F-75 | ★ BondMatrixPanel: лудонарративная проверка | Результат: Гармония/Ирония/Диссонанс с иконкой и описанием |

##### Pipeline-компоненты (4.B.12) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-76 | ★ ProgressSidebar: рендер | Компонент рендерится с прогресс-баром и статусами блоков |
| F-77 | ★ ProgressSidebar: статусы | Статус каждого блока с цветокодированием (empty/in_progress/completed/stale) |
| F-78 | ★ ProgressSidebar: рекомендация | Индикатор «Рекомендуется заполнить следующим» |
| F-79 | ★ PipelineNotifications: рендер | Компонент рендерит уведомления об устаревших данных |
| F-80 | ★ PipelineNotifications: предупреждения | Предупреждение вида «Концепция обновлена. Рекомендуется пересчитать Core Loop» |
| F-81 | ★ usePipeline: fetchState | Хук возвращает состояние пайплайна |
| F-82 | ★ usePipeline: prepareInput | Хук возвращает подготовленные входные данные для блока |
| F-83 | ★ usePipeline: notifyUpdated | Хук отправляет уведомление об обновлении блока |
| F-84 | ★ Pipeline Data Flow Indicator: Блок 1 | Индикатор «Блок 1 ← → Блок 2 → Блок 3» с кнопкой запуска пайплайна |
| F-85 | ★ Pipeline Data Flow Indicator: Блок 2/3 | Индикатор с кнопкой «Загрузить из пайплайна» |

##### Баланс и симуляция — UI (4.C.4) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| F-86 | ★ BalancePage: рендер | Страница /blocks/4 рендерится с формой и 5 вкладками |
| F-87 | ★ BalancePage: форма | Поля: объекты, game_mode, genre, balance_type, параметры симуляции |
| F-88 | ★ BalancePage: предзаполнение | 5 тестовых объектов (Warrior, Mage, Rogue, Tank, Healer) |
| F-89 | ★ BalancePage: валидация | Кнопка «Запустить анализ» неактивна без объектов |
| F-90 | ★ TransitiveTable: таблица | Колонки: Элемент, Cost, Power, C/P Ratio, Distance, Статус |
| F-91 | ★ TransitiveTable: цветовая индикация | overpowered=red, underpowered=amber, balanced=green, ideal_imbalance=blue |
| F-92 | ★ TransitiveTable: веса | Отображение attribute_weights и cost_curve_model |
| F-93 | ★ PayoffMatrix: тепловая карта | Интерактивная N×N таблица с green=positive, red=negative |
| F-94 | ★ PayoffMatrix: Нэш | Прогресс-бары вероятностей равновесия Нэша |
| F-95 | ★ PayoffMatrix: RPS-циклы | Обнаруженные нетранзитивные циклы с показателем силы |
| F-96 | ★ PayoffMatrix: метрики | entropy, max_share, gini strategy balance metrics |
| F-97 | ★ SimulationCharts: win rate | Win rate bar chart по объектам (Recharts BarChart) |
| F-98 | ★ SimulationCharts: вердикт | Вердикт GOOD/MODERATE/POOR (цветокодированный бейдж) |
| F-99 | ★ SimulationCharts: duration | Average duration bar chart по объектам |
| F-100 | ★ SimulationCharts: correlation | Корреляция Спирмена с формальным ранжированием |
| F-101 | ★ MachinationsView: узлы | Список узлов с типоспецифичными иконками (pool/source/drain/converter/trader/gate) |
| F-102 | ★ MachinationsView: потоки | Диаграмма потоков ресурсов (from → to с rate) |
| F-103 | ★ MachinationsView: feedback | Петли обратной связи (reinforcing/balancing) |
| F-104 | ★ MachinationsView: quality | Quality Assessment: 6 проверок с pass/fail |
| F-105 | ★ MachinationsView: curves | Line chart кривых ресурсов (Recharts LineChart) |
| F-106 | ★ MachinationsView: stability | Индекс стабильности и разрыв билдов |
| F-107 | ★ CorrectionsPanel: severity | Группировка по severity (critical/warning/info) |
| F-108 | ★ CorrectionsPanel: metadata | stages_completed, latency_ms, models_used |
| F-109 | ★ CorrectionsPanel: balance_map | Сводка balance_map и stability assessment |

---

## 3. Ручные UI-тесты

### 3.1 Подготовка к UI-тестированию

1. Запустить Docker Compose: `docker compose up -d`
2. Запустить backend: `cd mini-services/api-service && python main.py`
3. Запустить frontend: `npm run dev`
4. Открыть http://localhost:3000

### 3.2 Тест-кейсы UI

#### UI-01: Регистрация пользователя

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /register | Страница регистрации с формой |
| 2 | Ввести email | Поле принимает ввод |
| 3 | Ввести пароль | Поле маскирует ввод |
| 4 | Нажать «Зарегистрироваться» | Редирект на / или сообщение об ошибке |
| 5 | Ввести существующий email | Сообщение «Пользователь уже существует» |
| 6 | Оставить поля пустыми | Валидация: «Обязательное поле» |

#### UI-02: Логин

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /login | Страница логина |
| 2 | Ввести верные данные | Редирект на главную, аватар в хедере |
| 3 | Ввести неверный пароль | Сообщение «Неверный email или пароль» |
| 4 | Нажать «Забыли пароль?» | Переход к восстановлению (если реализовано) |

#### UI-03: Создание проекта

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Нажать «Новый проект» | Модальное окно создания |
| 2 | Ввести название | Поле принимает ввод |
| 3 | Выбрать жанр | Dropdown с 20+ жанрами |
| 4 | Ввести идею | Textarea с placeholder |
| 5 | Нажать «Создать» | Проект появляется в списке |
| 6 | Открыть проект | Страница проекта с 8 блоками |

#### UI-04: Навигация по блокам

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Кликнуть «Блок 1» в sidebar | Открылась страница /blocks/1 |
| 2 | Кликнуть «Блок 2» | Открылась страница /blocks/2 |
| 3 | Кликнуть каждый блок 1–8 | Каждая страница открывается |
| 4 | Проверить активное состояние | Текущий блок выделен в sidebar |
| 5 | Проверить версию в footer | Отображается «Фаза 4.B • v0.11.0» |

#### UI-05: Генератор концепции — ввод (Блок 1, Этапы 1–5)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/1 | Форма ввода концепции |
| 2 | Ввести идею игры | Textarea валидируется (мин. 10 символов) |
| 3 | Выбрать «Определить автоматически» | Жанр определяется AI |
| 4 | Выбрать целевую аудиторию | Мультивыбор до 3 мотиваций |
| 5 | Выбрать платформы | Чекбоксы PC/Mobile/Console |
| 6 | Нажать «Сгенерировать» | Индикатор загрузки → результат |
| 7 | Проверить ответ API | Заполнены: genre, aesthetic_profile, dynamics_profile, mechanic_set, core_loop_candidates, usp_candidates |

#### UI-06: Валидация концепции (Блок 1, Этап 6) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После генерации концепции | Отображается ValidationReport |
| 2 | Проверить Triangle of Weirdness | score 0–1, число weird_corners, warnings |
| 3 | Проверить 5 вопросов | Каждый вопрос да/нет, предложения |
| 4 | Проверить 8 фильтров | Score по каждому фильтру, improvement |
| 5 | Проверить overall_score | Среднее по 3 валидаторам, passed=true/false |
| 6 | Нажать «Валидировать повторно» | POST /validate — обновлённый отчёт |
| 7 | Проверить цветовую индикацию | Зелёный (>=0.8), жёлтый (0.6–0.8), красный (<0.6) |

#### UI-07: One-Pager (Блок 1, Этап 7) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После генерации концепции | Отображается OnePager карточка |
| 2 | Проверить поле «Название» | Заполнено из идеи |
| 3 | Проверить «Синопсис» | AI-сгенерированный текст 2–3 предложения |
| 4 | Проверить «Описание геймплея» | AI-сгенерированный текст 3–5 предложений |
| 5 | Проверить «Уникальные фичи» | 3 фичи из разных категорий механик |
| 6 | Проверить «Возрастной рейтинг» | E / T / M на основе жанра и эстетики |
| 7 | Проверить вложенные профили | AestheticProfile, DynamicsProfile, MechanicSet |
| 8 | Проверить кандидаты Core Loop | 3 варианта с выбором |
| 9 | Проверить кандидаты USP | 3 варианта с Triangle of Weirdness |
| 10 | Проверить ValidationReport | Полный отчёт встроен в OnePager |
| 11 | Проверить meta-поля | compatibility_score, uniqueness_score, loop_type |

#### UI-08: Результат концепции — OnePagerCard (Блок 1, 4.B.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После генерации концепции | OnePagerCard с 8 полями отображается |
| 2 | Проверить карточку One-Pager | title, genre badge, target_audience, rating badge |
| 3 | Проверить story_synopsis | AI-сгенерированный текст 2-3 предложения |
| 4 | Проверить gameplay_description | AI-сгенерированный текст 3-5 предложений |
| 5 | Проверить unique_features | 3 фичи со звёздочками |
| 6 | Проверить competitors | Бейджи-список конкурентов |

#### UI-09: Результат концепции — AestheticProfileView (Блок 1, 4.B.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Проверить отображение 3 эстетик | Primary (крупный), Secondary, Tertiary (мельче) |
| 2 | Проверить цветокодирование | 8 цветов для 8 эстетик ЛеБланка |
| 3 | Проверить rationale | Текст обоснования под бейджами |

#### UI-10: Результат концепции — MechanicSetView (Блок 1, 4.B.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Проверить 5 групп механик | Аккордеон: base, combat, progression, spatial, social |
| 2 | Раскрыть группу | Список механик с названием и описанием |
| 3 | Проверить compatibility_score | Прогресс-бар 0-100% |
| 4 | Проверить conflicts_resolved | Жёлтые бейджи-предупреждения |
| 5 | Проверить synergies_detected | Зелёные бейджи-синергии |

#### UI-11: Результат концепции — CoreLoopCandidates (Блок 1, 4.B.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Проверить 3 варианта | 3 карточки Core Loop |
| 2 | Проверить содержимое | name, steps (нумерованный список), loop_type badge, fun_check, estimated_duration |
| 3 | Кликнуть на вариант | Выделяется (primary border + «Выбрано» badge) |
| 4 | Кликнуть на другой вариант | Предыдущий снимается, новый выделяется |

#### UI-12: Результат концепции — USPCandidates (Блок 1, 4.B.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Проверить 3 варианта | 3 карточки USP |
| 2 | Проверить triangle_check | 3 индикатора: weird, appealing, credible |
| 3 | Кликнуть на вариант | Выделяется |
| 4 | Нажать «Сохранить выбор» | Toast «Выбор сохранён» |

#### UI-13: Результат концепции — ValidationReportView (Блок 1, 4.B.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Проверить 3 валидатора | Triangle of Weirdness, 5 вопросов, 8 фильтров |
| 2 | Проверить цветовую индикацию | Зелёный (>=0.8), жёлтый (0.6-0.8), красный (<0.6) |
| 3 | Проверить overall_score | Среднее по 3 валидаторам |
| 4 | Проверить warnings | Жёлтые алерты |
| 5 | Проверить suggestions | Синие алерты с предложениями |

#### UI-14: Core Loop Designer — Backend (Блок 2, 4.B.7) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/coreloop/design с concept_id | CoreLoopProfile с structural_type |
| 2 | Проверить structural_type | type: engine/economy/ecology/hybrid |
| 3 | Проверить loop_hierarchy | 6 уровней: micro → meta |
| 4 | Проверить pathologies | PathologyReport с total_count |
| 5 | Проверить validation | CoreLoopValidationResult с fun_check, closedness, resource_sufficiency |
| 6 | Проверить recommendations | Список рекомендаций с приоритетами |
| 7 | Проверить stages_completed | [1,2,3,4,5] |
| 8 | Проверить статус в sidebar | «Активен» |

#### UI-24: Core Loop Designer — UI (Блок 2, 4.B.8) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/2 | Страница Core Loop Designer с формой |
| 2 | Проверить Badge | «Активен» в заголовке |
| 3 | Ввести механики | Поле «Механики» с предзаполненным значением |
| 4 | Выбрать жанр | Dropdown с жанрами |
| 5 | Выбрать тип петли | Dropdown: Engine/Economy/Ecology/Hybrid/Auto |
| 6 | Ввести custom steps | Textarea, каждый шаг на новой строке |
| 7 | Нажать «Проектировать Core Loop» | Индикатор загрузки → результат |
| 8 | Проверить StructuralTypeCard | Тип, подтип, ресурсы, торможение, валюты, оценка рисков |
| 9 | Проверить CoreLoopDiagram | Круговая диаграмма с шагами и SVG-стрелками |
| 10 | Проверить LoopHierarchyTree | 6 раскрываемых уровней (micro → meta) |
| 11 | Раскрыть уровень «Малая» | Список действий петли |
| 12 | Проверить PathologyPanel | Список патологий с severity (critical/warning/info) |
| 13 | Проверить ValidationPanel | 5 критериев, overall_passed, прогресс-бар |
| 14 | Проверить RecommendationsPanel | Список рекомендаций с приоритетами и категориями |
| 15 | Проверить мета-информацию | stages_completed, latency_ms, models_used |

#### UI-25: MDA Lab — Backend (Блок 3, 4.B.9) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/mda/analyze с concept_id | MDAProfile с dynamics_target |
| 2 | Проверить dynamics_target | core_dynamics (6), supporting_dynamics (6), emergence_level |
| 3 | Проверить mechanic_candidate_set | mechanics (8-18), dynamics_coverage, synergy_pairs, conflict_pairs |
| 4 | Проверить mechanic_set | base/combat/progression/spatial/social группы |
| 5 | Проверить aesthetic_coverage | 3 эстетики с sufficient=true |
| 6 | Проверить patterns_detected | Список паттернов Adams/Dormans |
| 7 | Проверить stages_completed | [1,2,3] |
| 8 | Проверить iterations_done | >= 1 |
| 9 | Проверить статус в sidebar | «Активен» |

#### UI-26: MDA Lab — UI (Блок 3, 4.B.9) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Страница MDA Lab с формой |
| 2 | Проверить Badge | «Активен» в заголовке |
| 3 | Ввести concept_id | Поле принимает ввод |
| 4 | Выбрать жанр | Dropdown с жанрами |
| 5 | Выбрать primary эстетику | Dropdown: 8 эстетик ЛеБланка |
| 6 | Выбрать secondary эстетику | Dropdown |
| 7 | Выбрать tertiary эстетику | Dropdown |
| 8 | Нажать «Анализ MDA» | Индикатор загрузки → результат |
| 9 | Проверить DynamicsTarget | core_dynamics, supporting_dynamics, emergence_level |
| 10 | Проверить MechanicSet | 5 групп механик + compatibility_score + synergy_score |
| 11 | Проверить AestheticCoverage | 3 эстетики с индикаторами sufficient/insufficient |
| 12 | Проверить AdamsDormansPatterns | Список паттернов (engine/friction/escalation) |
| 13 | Проверить warnings | Предупреждения о конфликтах и недостаточном покрытии |
| 14 | Проверить мета-информацию | stages_completed, iterations_done, latency_ms |

#### UI-27: MDA Lab — Classic MDA и валидация (Блок 3, Этапы 4–6) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После генерации MDA (Этапы 1–3) | Отображается Classic MDA результат |
| 2 | Проверить gameplay sequence | Список шагов с действиями и ресурсами |
| 3 | Проверить feedback loops | Визуализация петель ОС (positive/negative) |
| 4 | Проверить match scores | Сравнение целевой и предсказанной эстетики |
| 5 | Проверить converged | Индикатор сходимости (Да/Нет) |
| 6 | Проверить stability | Статус устойчивости с описанием патологии |
| 7 | Проверить Линзы Шелла | 9 линз с оценками и colour-coding |
| 8 | Проверить критические линзы | Красная индикация и предложения |
| 9 | Проверить Матрицу Бонда | Таблица 4×3 с содержимым |
| 10 | Проверить ludonarrative | Результат: Гармония/Ирония/Диссонанс |
| 11 | Проверить overall consistency | Общая согласованность (0-1) |

#### UI-28: MDALabPage — рендер и навигация по вкладкам (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Страница MDA Lab с формой ввода |
| 2 | Проверить наличие 4 вкладок | «Обратный MDA», «Классический MDA», «Аудит линз», «Матрица Бонда» |
| 3 | Кликнуть вкладку «Обратный MDA» | Отображается ReverseMDAPanel |
| 4 | Кликнуть вкладку «Классический MDA» | Отображается ClassicMDAPanel |
| 5 | Кликнуть вкладку «Аудит линз» | Отображается LensAuditPanel |
| 6 | Кликнуть вкладку «Матрица Бонда» | Отображается BondMatrixPanel |
| 7 | Вернуться на вкладку «Обратный MDA» | Предыдущая вкладка снята, новая активна |

#### UI-29: MDALabPage — форма ввода и валидация (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Форма с полями ввода |
| 2 | Оставить поля пустыми | Кнопка «Анализ MDA» неактивна |
| 3 | Ввести concept_id | Поле принимает числовой ввод |
| 4 | Выбрать жанр | Dropdown с жанрами |
| 5 | Выбрать primary эстетику | Dropdown: 8 эстетик ЛеБланка |
| 6 | Выбрать secondary эстетику | Dropdown |
| 7 | Выбрать tertiary эстетику | Dropdown |
| 8 | Нажать «Анализ MDA» | Индикатор загрузки → результат во вкладках |

#### UI-30: MDALabPage — переключение режима full_analysis (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Форма с чекбоксом full_analysis |
| 2 | Снять чекбокс full_analysis | Вкладки 2–4 скрыты или заблокированы |
| 3 | Установить чекбокс full_analysis | Вкладки 2–4 доступны |
| 4 | Запустить анализ с full_analysis=false | Результат только во вкладке 1 |
| 5 | Запустить анализ с full_analysis=true | Результаты во всех 4 вкладках |

#### UI-31: ReverseMDAPanel — Вкладка 1: Обратный MDA (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Перейти на вкладку «Обратный MDA» | ReverseMDAPanel отображается |
| 2 | Проверить секцию целевых динамик | core_dynamics (список), supporting_dynamics (список), emergence_level |
| 3 | Проверить кандидатные механики | Карта покрытия: механики ↔ динамики, synergy_pairs, conflict_pairs |
| 4 | Проверить структурированный набор | 5 групп (base/combat/progression/spatial/social) с механиками |
| 5 | Проверить покрытие эстетик | 3 эстетики с индикаторами sufficient/insufficient |
| 6 | Проверить паттерны Adams/Dormans | Список обнаруженных паттернов (engine/friction/escalation) |

#### UI-32: ClassicMDAPanel — Вкладка 2: Классический MDA (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Перейти на вкладку «Классический MDA» | ClassicMDAPanel отображается |
| 2 | Проверить секцию сходимости | overall_match (0–1), converged: Да/Нет, match_scores по эстетикам |
| 3 | Проверить моделирование геймплея | gameplay_script, шаги с действиями и ресурсами |
| 4 | Проверить feedback loops | Визуализация петель ОС (positive/negative) |
| 5 | Проверить стабильность | Статус (stable/runaway/oscillating/stall), описание патологии |
| 6 | Проверить рекомендации | Предложения для слабых эстетик и неустойчивых петель |

#### UI-33: LensAuditPanel — Вкладка 3: Аудит линз Шелла (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Перейти на вкладку «Аудит линз» | LensAuditPanel отображается |
| 2 | Проверить список 9 линз | Каждая линза с названием, номером и score |
| 3 | Проверить colour-coding | Красный (<0.4), жёлтый (0.4–0.7), зелёный (>=0.7) |
| 4 | Раскрыть линзу | Детализация: issues (критические/предупреждения), suggestions |
| 5 | Проверить критические проблемы | Красные алерты с описанием проблемы |
| 6 | Проверить предложения | Синие/зелёные алерты с рекомендациями |
| 7 | Проверить overall score | Общий score как среднее по 9 линзам |

#### UI-34: BondMatrixPanel — Вкладка 4: Матрица Бонда (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Перейти на вкладку «Матрица Бонда» | BondMatrixPanel отображается |
| 2 | Проверить матрицу 4×3 | 4 строки (Механика/История/Эстетика/Технология) × 3 столбца (Фиксированный/Динамический/Культурный) |
| 3 | Проверить содержимое ячеек | Каждая ячейка содержит текстовое описание |
| 4 | Проверить row consistency | Индикатор согласованности по строкам (0–1) |
| 5 | Проверить col consistency | Индикатор согласованности по столбцам (0–1) |
| 6 | Проверить ludonarrative | Результат: Гармония/Ирония/Диссонанс с иконкой и описанием |
| 7 | Проверить overall consistency | Общая согласованность (0–1) с прогресс-баром |

#### UI-35: MDALabPage — интеграция с API (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Заполнить форму и нажать «Анализ MDA» | POST /api/v1/mda/analyze отправляется |
| 2 | Проверить параметры запроса | concept_id, genre, aesthetics, full_analysis=true |
| 3 | Дождаться ответа | Данные распределяются по вкладкам |
| 4 | Проверить вкладку 1 | Данные Этапов 1–3 отображаются в ReverseMDAPanel |
| 5 | Проверить вкладку 2 | ClassicMDAResult из Этапа 4 |
| 6 | Проверить вкладку 3 | LensValidation из Этапа 5 |
| 7 | Проверить вкладку 4 | BondValidation из Этапа 6 |

#### UI-36: MDALabPage — обработка ошибок (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Ввести несуществующий concept_id | Сообщение об ошибке «Концепция не найдена» |
| 2 | Отправить запрос при недоступном API | Сообщение «Сервис недоступен» |
| 3 | Проверить обработку 401 | Редирект на /login при отсутствии авторизации |
| 4 | Проверить обработку таймаута | Сообщение «Превышено время ожидания» |

#### UI-37: MDALabPage — отображение предупреждений (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После анализа с предупреждениями | Жёлтые баннеры warnings в ReverseMDAPanel |
| 2 | Проверить конфликты механик | Красные бейджи conflict_pairs |
| 3 | Проверить недостаточное покрытие | Предупреждение «Недостаточное покрытие эстетики» |
| 4 | Проверить рекомендации по линзам | Жёлтые алерты для score 0.4–0.7 в LensAuditPanel |

#### UI-38: MDALabPage — мета-информация (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После анализа | Отображается stages_completed в нижней части страницы |
| 2 | Проверить stages_completed | full_analysis=true: [1,2,3,4,5,6]; false: [1,2,3] |
| 3 | Проверить iterations_done | Количество итераций >= 1 |
| 4 | Проверить latency_ms | Время выполнения анализа в мс |
| 5 | Проверить models_used | Список AI-моделей, использованных при анализе |

#### UI-39: MDALabPage — полный E2E сценарий (4.B.11) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Авторизоваться и создать проект | Проект в списке |
| 2 | Сгенерировать концепцию (Блок 1) | OnePager получен |
| 3 | Открыть /blocks/3 | Страница MDA Lab |
| 4 | Ввести concept_id из Блока 1 | Поле заполнено |
| 5 | Выбрать эстетики | 3 эстетики из концепции предзаполнены |
| 6 | Включить full_analysis | Чекбокс установлен |
| 7 | Нажать «Анализ MDA» | Загрузка → результат |
| 8 | Просмотреть вкладку «Обратный MDA» | Динамики, механики, покрытие |
| 9 | Просмотреть вкладку «Классический MDA» | Сходимость, геймплей, устойчивость |
| 10 | Просмотреть вкладку «Аудит линз» | 9 линз с оценками и предложениями |
| 11 | Просмотреть вкладку «Матрица Бонда» | Матрица 4×3, согласованность, лудонарратив |
| 12 | Проверить мета-информацию | stages_completed = [1,2,3,4,5,6] |

#### UI-40: Балансировка — Транзитивный анализ (Блок 4, 4.C.1) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/transitive с объектами | TransitiveResult с reports, warnings, suggestions |
| 2 | Проверить cost-power кривые | Модель кривой (identity/shifted_identity/progression) определена |
| 3 | Проверить объекты | Каждый объект имеет power, effective_cost, cp_ratio, distance_from_curve, status |
| 4 | Проверить цветовую индикацию | Зелёный (balanced), жёлтый (ideal imbalance), красный (over/underpowered) |
| 5 | Проверить warnings | Предупреждения для пере-/недооценённых объектов |
| 6 | Проверить suggestions | Конкретные предложения коррекции |

#### UI-41: Балансировка — Нетранзитивный анализ (Блок 4, 4.C.2) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/intransitive с объектами | IntransitiveResult с payoff_matrix, nash_equilibrium |
| 2 | Проверить payoff-матрицу | Антисимметричная матрица N×N с цветовой тепловой картой |
| 3 | Проверить равновесие Нэша | Сумма вероятностей ≈ 1.0, все ≥ 0 |
| 4 | Проверить RPS-циклы | Обнаруженные нетранзитивные циклы A > B > C > A |
| 5 | Проверить доминантную стратегию | Доля доминанта, AI-коррекции при max_share > 50% |
| 6 | Проверить метрики баланса | entropy, max_share, gini |

#### UI-42: Балансировка — Ситуационный анализ (Блок 4, 4.C.2) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/situational с объектами | SituationalResult с situations, situational_values |
| 2 | Проверить жанровые ситуации | RPG (5), Action (5), Strategy (4), или default |
| 3 | Проверить матрицу ценности | Объекты × Ситуации, цветовая индикация EV |
| 4 | Проверить универсальность | universal/specialized классификация по spread |
| 5 | Проверить мёртвые зоны | Объекты, не доминирующие ни в одной ситуации |
| 6 | Проверить стоимость переключения | low/medium/high по жанру |

#### UI-43: Балансировка — Q-фактор (Блок 4, 4.C.2) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/qfactor с объектами | QFactorResult с redundant_objects, attribute_dominance |
| 2 | Проверить доминантные атрибуты | Каждый объект имеет dominant_attributes |
| 3 | Проверить избыточные объекты | Объекты с is_redundant=true и redundancy_score |
| 4 | Проверить маппинг атрибутов | attribute_dominance: атрибут → доминирующий объект |

#### UI-44: Monte Carlo-симуляция (Блок 4, 4.C.3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/monte-carlo с объектами | MonteCarloResult с win_rates, spread, verdict |
| 2 | Проверить win_rates | Процент побед по каждому объекту |
| 3 | Проверить вердикт | GOOD/MODERATE/POOR на основе win rate spread |
| 4 | Проверить matchup_matrix | Попарные результаты всех пар объектов |
| 5 | Проверить корреляцию | Корреляция Спирмена с формальным ранжированием |
| 6 | Проверить расхождение | ANALYZE_DISCREPANCY промпт при низкой корреляции |

#### UI-45: Machinations-симуляция (Блок 4, 4.C.3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/machinations с ресурсами | MachinationsSimResult с graph, aggregated, quality, pathologies |
| 2 | Проверить граф | 8 типов узлов (Pool, Source, Drain, Converter, Trader, Gate, Delay, Queue) |
| 3 | Проверить потоки | Сплошные стрелки ресурсов и пунктирные связи состояния |
| 4 | Проверить петли ОС | Reinforcing и balancing loops |
| 5 | Проверить симуляцию | Архетипы игроков, resource_curves по тикам |
| 6 | Проверить качество | Quality Assessment: 6 проверок, stability_index, build_gap |
| 7 | Проверить патологии | Обнаружение 6 патологий экономики |

#### UI-46: Полный анализ балансировки (Блок 4, 4.C.1–4.C.3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | POST /api/v1/balance/analyze с run_monte_carlo=True, run_machinations=True | BalanceResult с 7 этапами |
| 2 | Проверить stages_completed | [1,2,3,4,5,6,7] — все этапы пройдены |
| 3 | Проверить transitive_result | Cost-power кривые, warnings, suggestions |
| 4 | Проверить intransitive_result | Payoff-матрица, Нэш, RPS-циклы |
| 5 | Проверить situational_result | EV, универсальность, мёртвые зоны |
| 6 | Проверить q_factor_result | Избыточные объекты, доминантные атрибуты |
| 7 | Проверить monte_carlo_result | Win rates, вердикт, корреляция |
| 8 | Проверить machinations_result | Граф, качество, патологии |
| 9 | Проверить stability | StabilityAnalysis: overall_stability, pathology_risks |

#### UI-47: Анализ устойчивости (Блок 4, 4.C.3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После MC + Machinations симуляции | StabilityAnalysis с overall_stability |
| 2 | Проверить overall_stability | stable / conditionally_stable / unstable |
| 3 | Проверить pathology_risks | Риски по каждой патологии (0–1) |
| 4 | Проверить recommendations | Рекомендации по устранению нестабильности |

#### UI-48: Эмоциональное восприятие чисел (Блок 4, 4.C.3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После MC-симуляции | NumberFormatReport в monte_carlo_result |
| 2 | Проверить лёгкие числа | Кратные 5/10 числа помечены как «лёгкие» |
| 3 | Проверить тяжёлые числа | Некруглые числа помечены как «тяжёлые» |
| 4 | Проверить assessment | Общая оценка восприятия чисел в игре |

#### UI-49: Pipeline — состояние пайплайна (4.B.12) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | GET /api/v1/pipeline/state/{project_id} | Статусы блоков, stale-уведомления, прогресс |
| 2 | Проверить статусы блоков | empty/in_progress/completed/stale для каждого блока |
| 3 | Проверить completion_percent | Процент заполненности проекта |
| 4 | Проверить recommended_next | Рекомендация следующего блока |

#### UI-50: Pipeline — автозаполнение (4.B.12) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Нажать «Загрузить из пайплайна» на Блоке 2 | Поля заполняются данными из Блока 1 |
| 2 | Нажать «Загрузить из пайплайна» на Блоке 3 | Поля заполняются данными из Блоков 1-2 |
| 3 | Проверить зелёный бейдж «Данные из пайплайна» | Индикатор успешной загрузки |
| 4 | Попробовать загрузить без заполненного Блока 1 | Предупреждение «Блок 1 не заполнен» |

#### UI-51: Pipeline — запуск полного пайплайна (4.B.12) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Нажать «Запустить пайплайн 1→2→3» | Индикатор загрузки |
| 2 | Дождаться завершения | Результат концепции + обновлённое состояние пайплайна |
| 3 | Проверить sidebar | Блоки 1-3 обновлены до «completed» |
| 4 | Проверить toast-уведомление | «Пайплайн завершён» |

#### UI-52: Pipeline — stale-уведомления (4.B.12) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Обновить данные Блока 1 | Блоки 2-8 помечаются как stale |
| 2 | Проверить PipelineNotifications | Предупреждение «Концепция обновлена. Рекомендуется пересчитать Core Loop» |
| 3 | Нажать «Перейти к блоку» | Переход на страницу Блока 2 |
| 4 | Снять stale-статус | DELETE /pipeline/stale, статус снимается |

#### UI-53: Страница /blocks/5 — отображение (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/5 | Страница «Экономика и прогрессия» загружается |

#### UI-54: Форма ввода — все поля (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Проверить наличие полей | Поля: genre, duration, levels, type, pacing, monetization |

#### UI-55: Кнопка «Запустить» → POST /progression/design (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Заполнить форму и нажать «Запустить» | Запрос POST /progression/design отправляется, результат отображается |

#### UI-56: Результат — макро-параметры (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После получения результата | Отображение duration, levels, progressionType, contentRequirements |

#### UI-57: Результат — tiers (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После получения результата | Таблица tiers с level_range, scale, mechanic, balance_type |

#### UI-58: Результат — кривые (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После получения результата | Графики 4 кривых (XP, Power, Cost, Difficulty) |

#### UI-59: Результат — контент-план (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После получения результата | Таблица контента по tier-ам |

#### UI-60: Результат — разблокировки (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После получения результата | Дерево разблокировок по уровням |

#### UI-61: Результат — валидация (Блок 5, 4.C.5) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | После получения результата | Список issues с severity (critical/warning/info) |

#### UI-15: MDA Lab (Блок 3, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Страница с плейсхолдером |
| 2 | Проверить статус в sidebar | «Скелет» |

#### UI-16: Баланс и симуляция — UI (Блок 4, 4.C.4) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/4 | Страница «Баланс и симуляция» с формой и 5 вкладками |
| 2 | Проверить Badge | «Активен» в заголовке |
| 3 | Проверить предзаполнение | 5 тестовых объектов (Warrior, Mage, Rogue, Tank, Healer) |
| 4 | Выбрать game_mode | Dropdown: PvP/PvE/PvPvE |
| 5 | Выбрать жанр | Dropdown с жанрами |
| 6 | Выбрать balance_type | Dropdown: transitive/intransitive/situational/mixed |
| 7 | Нажать «Запустить анализ баланса» | Индикатор загрузки → результат |
| 8 | Перейти на вкладку «Transitive-анализ» | Таблица с колонками: Элемент, Cost, Power, C/P Ratio, Distance, Статус |
| 9 | Проверить цветовую индикацию | overpowered=red, underpowered=amber, balanced=green, ideal_imbalance=blue |
| 10 | Проверить attribute_weights | Отображение весов атрибутов и cost_curve_model |
| 11 | Перейти на вкладку «Payoff-матрица» | Интерактивная N×N таблица с тепловой картой |
| 12 | Проверить равновесие Нэша | Прогресс-бары вероятностей для каждого объекта |
| 13 | Проверить RPS-циклы | Обнаруженные нетранзитивные циклы с показателем силы |
| 14 | Проверить метрики баланса | entropy, max_share, gini |
| 15 | Перейти на вкладку «Симуляция (MC)» | Win rate bar chart + duration bar chart |
| 16 | Проверить вердикт баланса | Бейдж GOOD/MODERATE/POOR |
| 17 | Проверить корреляцию Спирмена | Индикатор ranking_correlation |
| 18 | Перейти на вкладку «Machinations» | Список узлов с иконками + диаграмма потоков |
| 19 | Проверить Quality Assessment | 6 проверок с pass/fail индикаторами |
| 20 | Проверить кривые ресурсов | Line chart кривых ресурсов по тикам |
| 21 | Проверить stability_index и build_gap | Индексы стабильности и разрыва билдов |
| 22 | Перейти на вкладку «Коррекции» | Список warnings/suggestions по severity |
| 23 | Проверить метаданные | stages_completed, latency_ms, models_used |
| 24 | Проверить мета-информацию | stages_completed = [1,2,3,4,5,6,7] при полном анализе |

#### UI-17: Экономика и прогрессия (Блок 5, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/5 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-18: GDD Generator (Блок 6, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/6 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-19: AI-ассистент (Блок 7, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/7 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-20: GBE Integration (Блок 8, запланирован)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/8 | Страница с плейсхолдером |
| 2 | Проверить статус в sidebar | «План» |

#### UI-21: Responsive-дизайн

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть на Desktop (1920px) | Полный layout с sidebar |
| 2 | Открыть на Tablet (768px) | Sidebar сворачивается |
| 3 | Открыть на Mobile (375px) | Мобильный layout |
| 4 | Переключить тему | Тёмная/светлая тема работает |

#### UI-22: Обработка ошибок

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Отключить backend | Сообщение «Сервер недоступен» |
| 2 | Ввести невалидные данные | Красная подсветка + текст ошибки |
| 3 | AI таймаут | Индикатор + fallback |
| 4 | Сессия истекла | Редирект на /login |

#### UI-23: Главная страница ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть / | Карточки 8 блоков |
| 2 | Проверить прогресс | 4 фазы, Фаза 4 — «В разработке» |
| 3 | Проверить статус Блока 1 | «В разработке» |
| 4 | Кликнуть «Открыть» на Блоке 1 | Переход на /blocks/1 |

---

## 4. RAG-тестирование

### 4.1 Загрузка базы знаний

```bash
# Загрузить Библию геймдизайна
cd mini-services/api-service
python scripts/load_knowledge.py --bible

# Проверить статистику
python scripts/load_knowledge.py --stats

# Загрузить конкретный файл
python scripts/load_knowledge.py --file ../../docs/bible/bible_2_3_mda_framework.md --type bible --name bible_2_3_mda_framework
```

### 4.2 Тест-кейсы RAG

| ID | Тест | Ожидаемый результат |
|----|------|-------------------|
| RAG-01 | Загрузка Библии | >0 чанков, source_type=bible |
| RAG-02 | Поиск «MDA Framework» | Чанки из bible_2_3 с similarity>0.7 |
| RAG-03 | Поиск «баланс» | Чанки из bible_2_5 |
| RAG-04 | Пустой запрос | Пустой результат |
| RAG-05 | Несвязанный запрос | similarity < 0.7 |
| RAG-06 | API /api/v1/rag/stats | Корректная статистика |
| RAG-07 | API /api/v1/rag/search | Результаты с similarity |
| RAG-08 | RAG в PromptExecutor | Контекст добавлен в промпт |
| RAG-09 | RAG_ENABLED=false | Поиск возвращает пустой результат |
| RAG-10 | IVFFlat-индекс | Быстрый поиск (< 100ms) |

---

## 5. Сквозные сценарии (E2E)

### E2E-01: Полный пайплайн генерации концепции ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Зарегистрироваться | Аккаунт создан |
| 2 | Залогиниться | Редирект на главную |
| 3 | Открыть /blocks/1 | Форма ввода |
| 4 | Ввести идею «Roguelike об алхимике, который варит зелья для боя с монстрами» | Поле заполнено |
| 5 | Выбрать жанр «roguelike» | Жанр выбран |
| 6 | Выбрать мотивации «challenge, discovery» | 2 мотивации |
| 7 | Нажать «Сгенерировать» | Загрузка 15–30 сек |
| 8 | Проверить Этап 1 (жанр) | genre=roguelike, confidence>0.5 |
| 9 | Проверить Этап 2 (эстетика) | primary в [challenge, discovery, fantasy] |
| 10 | Проверить Этап 3 (динамики) | core_dynamics.length >= 3 |
| 11 | Проверить Этап 4 (механики) | total_count 10–18, compatibility_score > 0 |
| 12 | Проверить Этап 5 (Core Loop) | 3 кандидата, каждый с 3–5 шагами |
| 13 | Проверить Этап 5 (USP) | 3 кандидата, каждый с triangle_check |
| 14 | Проверить Этап 6 (валидация) ★ | overall_score >= 0, 3 валидатора |
| 15 | Проверить Этап 7 (OnePager) ★ | title, story_synopsis, gameplay_description заполнены |
| 16 | Проверить validation_report ★ | warnings + suggestions, overall_passed |
| 17 | Проверить meta-данные ★ | stages_completed=[1,2,3,4,5,6,7], latency_ms, models_used |

### E2E-02: Повторная валидация ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть существующую концепцию | GET /concept/{id} — данные загружены |
| 2 | Нажать «Валидировать» | POST /concept/{id}/validate |
| 3 | Проверить обновлённый отчёт | validation_report обновлён |
| 4 | Проверить warnings | Корректные предупреждения |
| 5 | Проверить suggestions | Конкретные предложения по улучшению |

### E2E-03: Core Loop Designer (Блок 2) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Зарегистрироваться и залогиниться | Аккаунт создан, редирект на главную |
| 2 | Сгенерировать концепцию на /blocks/1 | OnePager с данными |
| 3 | Выбрать Core Loop и USP | Выделены в UI |
| 4 | Нажать «Сохранить выбор» | Toast подтверждения |
| 5 | POST /api/v1/coreloop/design с concept_id | CoreLoopProfile с structural_type |
| 6 | Проверить structural_type | type в [engine, economy, ecology, hybrid] |
| 7 | Проверить sub_type | Определён (braked_engine и т.д.) |
| 8 | Проверить resources | Список ресурсов из концепции |
| 9 | Проверить loop_hierarchy | 6 уровней (micro → meta) |
| 10 | Проверить pathologies | PathologyReport, total_count >= 0 |
| 11 | Проверить validation | ★ CoreLoopValidationResult: fun_check, closedness, resource_sufficiency |
| 12 | Проверить recommendations | ★ Формализованные + AI-рекомендации |
| 13 | Проверить stages_completed | ★ [1,2,3,4,5] |

### E2E-04: Балансировка и симуляция (Блок 4, 4.C.1–4.C.3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Зарегистрироваться и залогиниться | Аккаунт создан |
| 2 | Сгенерировать концепцию (Блок 1) | OnePager с данными |
| 3 | Проектировать Core Loop (Блок 2) | CoreLoopProfile |
| 4 | Запустить MDA-анализ (Блок 3) | MDAProfile |
| 5 | Открыть /blocks/4 | Страница балансировки |
| 6 | Ввести игровые объекты с атрибутами и стоимостью | Форма заполнена |
| 7 | Запустить транзитивный анализ | Cost-power кривые, пере-/недооценённые объекты |
| 8 | Запустить нетранзитивный анализ | Payoff-матрица, Нэш, RPS-циклы |
| 9 | Запустить ситуационный анализ | EV, универсальность, мёртвые зоны |
| 10 | Запустить Q-фактор | Избыточные объекты, доминантные атрибуты |
| 11 | Запустить Monte Carlo-симуляцию | Win rates, вердикт, корреляция |
| 12 | Запустить Machinations-симуляцию | Граф, качество, патологии |
| 13 | Проверить анализ устойчивости | overall_stability, pathology_risks |
| 14 | Проверить stages_completed | [1,2,3,4,5,6,7] |

### E2E-05: Сквозной пайплайн (Блоки 1–3) ★

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Зарегистрироваться и залогиниться | Аккаунт создан |
| 2 | Создать проект | Проект в списке |
| 3 | Нажать «Запустить пайплайн 1→2→3» | Загрузка |
| 4 | Проверить результат концепции | OnePager с genre, эстетиками, механиками |
| 5 | Проверить sidebar | Блоки 1-3 «completed» |
| 6 | Открыть Блок 2 | Данные из пайплайна предзаполнены |
| 7 | Открыть Блок 3 | Данные из пайплайна предзаполнены |
| 8 | Обновить данные Блока 1 | Блоки 2-3 stale |
| 9 | Проверить уведомление | «Концепция обновлена. Рекомендуется пересчитать Core Loop» |

---

## 6. Сводка покрытия тестами

### 6.1 Backend — покрытие по модулям

| Модуль | Тестов | Покрытие | Статус |
|--------|--------|----------|--------|
| Health API | 2 | — | ✅ |
| Auth API | 8 | — | ✅ |
| Projects API | 5 | — | ✅ |
| Prompt Registry | 7 | — | ✅ |
| RAG Service | 10 | — | ✅ |
| TextChunker | 5 | — | ✅ |
| Concept Service (Этапы 1–3) | 10 | — | ✅ |
| Concept Service (Этапы 4–5) | 19 | — | ✅ |
| Concept Service (Этап 6) | 14 | — | ✅ |
| Concept Service (Этап 7) | 11 | — | ✅ |
| Полный пайплайн концепции (1–7) | 4 | — | ✅ |
| API концепции | 7 | — | ✅ |
| CoreLoop Service (Этап 1) | 11 | — | ✅ |
| CoreLoop Service (Этап 2) | 10 | — | ✅ |
| CoreLoop Service (Этап 3) | 12 | — | ✅ |
| CoreLoop Service (Этап 4: Валидация) | 19 | — | ✅ |
| CoreLoop Service (Этап 5: Рекомендации) | 11 | — | ✅ |
| CoreLoop полный пайплайн | 7 | — | ✅ |
| API CoreLoop | 6 | — | ✅ |
| JWT Secret Property | 3 | — | ✅ |
| MDA Service (Этап 1) | 11 | — | ✅ |
| MDA Service (Этап 2) | 12 | — | ✅ |
| MDA Service (Этап 3) | 18 | — | ✅ |
| MDA Service (Полный 1–3) | 6 | — | ✅ |
| API MDA Lab | 5 | — | ✅ |
| MDA Service (Этап 4) | 16 | — | ✅ |
| MDA Service (Этап 5) | 17 | — | ✅ |
| MDA Service (Этап 6) | 19 | — | ✅ |
| MDA Service (Полный 1–6) | 10 | — | ✅ |
| API MDA Lab (Полный) | 5 | — | ✅ |
| Pipeline Service | 17 | — | ✅ |
| Pipeline API | 6 | — | ✅ |
| Balance Service (Классификация) | 3 | — | ✅ |
| Balance Service (Транзитивный) | 8 | — | ✅ |
| Balance Service (Стабильность) | 3 | — | ✅ |
| Balance Service (Полный пайплайн 4.C.1) | 3 | — | ✅ |
| Balance Service (API 4.C.1) | 2 | — | ✅ |
| Balance Service (Вспомогательные) | 7 | — | ✅ |
| Balance Service (Нетранзитивный 4.C.2) | 7 | — | ✅ |
| Balance Service (Ситуационный 4.C.2) | 7 | — | ✅ |
| Balance Service (Q-фактор 4.C.2) | 6 | — | ✅ |
| Balance Service (Полный пайплайн 4.C.2) | 4 | — | ✅ |
| Balance Service (API 4.C.2) | 3 | — | ✅ |
| ★ Balance Service (Monte Carlo 4.C.3) | 8 | — | ★ Новое |
| ★ Balance Service (Machinations 4.C.3) | 10 | — | ★ Новое |
| ★ Balance Service (Устойчивость 4.C.3) | 6 | — | ★ Новое |
| ★ Balance Service (API MC+Mach 4.C.3) | 6 | — | ★ Новое |
| ★ Progression Service (Макро-параметры 4.C.5) | 16 | — | ★ Новое |
| ★ Progression Service (Tiers 4.C.5) | 11 | — | ★ Новое |
| ★ Progression Service (Кривые 4.C.5) | 15 | — | ★ Новое |
| ★ Progression Service (Контент-план 4.C.5) | 13 | — | ★ Новое |
| ★ Progression Service (Полный пайплайн 4.C.5) | 13 | — | ★ Новое |
| ★ Progression Service (API 4.C.5) | 7 | — | ★ Новое |
| **Итого** | **471+** | **baseline** | |

### 6.2 Frontend — покрытие по модулям

| Модуль | Тестов | Покрытие | Статус |
|--------|--------|----------|--------|
| UI Components | 3 | — | ✅ |
| Auth Pages | 2 | — | ✅ |
| API Client | 3 | — | ✅ |
| Sidebar | 3 | — | ✅ |
| Главная страница | 2 | — | ✅ |
| Форма концепции | 2 | — | ✅ |
| Компоненты результата (4.B.5) | 7 | — | ✅ |
| Core Loop Designer (4.B.8) | 16 | — | ✅ |
| MDA Lab (4.B.11) | 20 | — | ✅ |
| ★ Pipeline-компоненты (4.B.12) | 10 | — | ★ Новое |
| ★ Баланс и симуляция (4.C.3–4.C.4) | 5 | — | ★ Новое |
| **Итого** | **85+** | **baseline** | |

### 6.3 Ручные UI-тесты

| Категория | Тестов | Статус |
|-----------|--------|--------|
| Авторизация | 10 | ✅ |
| Проекты | 6 | ✅ |
| Навигация | 5 | ✅ |
| Генератор концепции (ввод) | 7 | ✅ |
| Валидация концепции | 7 | ✅ |
| One-Pager | 11 | ✅ |
| Результат — OnePagerCard | 6 | ✅ |
| Результат — AestheticProfileView | 3 | ✅ |
| Результат — MechanicSetView | 5 | ✅ |
| Результат — CoreLoopCandidates | 4 | ✅ |
| Результат — USPCandidates | 4 | ✅ |
| Результат — ValidationReportView | 5 | ✅ |
| Core Loop Designer (API) | 5 | ✅ |
| Core Loop Designer (UI) | 15 | ✅ |
| MDA Lab (Backend) | 9 | ✅ |
| MDA Lab (UI) | 9 | ✅ |
| MDA Lab (Classic MDA + валидация) | 11 | ✅ |
| MDALabPage (рендер и навигация) | 7 | ✅ |
| MDALabPage (форма) | 8 | ✅ |
| MDALabPage (full_analysis) | 5 | ✅ |
| ReverseMDAPanel | 6 | ✅ |
| ClassicMDAPanel | 6 | ✅ |
| LensAuditPanel | 7 | ✅ |
| BondMatrixPanel | 7 | ✅ |
| MDALabPage (API интеграция) | 7 | ✅ |
| MDALabPage (обработка ошибок) | 4 | ✅ |
| MDALabPage (предупреждения) | 4 | ✅ |
| MDALabPage (мета-информация) | 5 | ✅ |
| MDALabPage (E2E) | 12 | ✅ |
| Скелетные блоки (4–7) | 8 | ✅ |
| Запланированные (8) | 2 | ✅ |
| Responsive | 4 | ✅ |
| Обработка ошибок | 4 | ✅ |
| Главная страница | 4 | ✅ |
| ★ Балансировка — Транзитивный анализ | 6 | ★ Новое |
| ★ Балансировка — Нетранзитивный анализ | 6 | ★ Новое |
| ★ Балансировка — Ситуационный анализ | 6 | ★ Новое |
| ★ Балансировка — Q-фактор | 4 | ★ Новое |
| ★ Monte Carlo-симуляция | 6 | ★ Новое |
| ★ Machinations-симуляция | 7 | ★ Новое |
| ★ Полный анализ балансировки | 9 | ★ Новое |
| ★ Анализ устойчивости | 4 | ★ Новое |
| ★ Эмоциональное восприятие чисел | 4 | ★ Новое |
| ★ Pipeline — состояние | 4 | ★ Новое |
| ★ Pipeline — автозаполнение | 4 | ★ Новое |
| ★ Pipeline — запуск пайплайна | 4 | ★ Новое |
| ★ Pipeline — stale-уведомления | 4 | ★ Новое |
| ★ Прогрессия — Страница /blocks/5 | 1 | ★ Новое |
| ★ Прогрессия — Форма ввода | 1 | ★ Новое |
| ★ Прогрессия — Кнопка запуска | 1 | ★ Новое |
| ★ Прогрессия — Макро-параметры | 1 | ★ Новое |
| ★ Прогрессия — Tiers | 1 | ★ Новое |
| ★ Прогрессия — Кривые | 1 | ★ Новое |
| ★ Прогрессия — Контент-план | 1 | ★ Новое |
| ★ Прогрессия — Разблокировки | 1 | ★ Новое |
| ★ Прогрессия — Валидация | 1 | ★ Новое |
| **Итого** | **161+** | |

### 6.4 E2E-сценарии

| Сценарий | Шагов | Статус |
|----------|-------|--------|
| Полный пайплайн генерации | 17 | ✅ |
| Повторная валидация | 5 | ✅ |
| Core Loop Designer | 13 | ✅ |
| ★ Балансировка и симуляция | 14 | ★ Новое |
| ★ Сквозной пайплайн 1→2→3 | 9 | ★ Новое |
| **Итого** | **45+** | |

### 6.5 Целевое покрытие (критерий C8 из ROADMAP)

- **Backend**: ≥ 60% coverage
- **Frontend**: ≥ 50% coverage

---

## 7. Отчётность

### 7.1 Формат отчёта о тестировании

После проведения тестов, сохраняйте отчёт в файл:

```markdown
# Отчёт о тестировании Gidede
Дата: YYYY-MM-DD
Версия: X.Y.Z
Тестировщик: Имя

## Автоматизированные тесты
- Backend: X/Y пройдено (Z% coverage)
- Frontend: X/Y пройдено (Z% coverage)
- Линтеры: PASS/FAIL

## UI-тесты
| ID | Результат | Комментарий |
|----|-----------|-------------|
| UI-01 | PASS | |
| UI-02 | FAIL | Описание ошибки |

## Найденные баги
1. [Критичность] Описание
2. [Критичность] Описание

## Замечания
- Заметки и предложения
```

### 7.2 Критичность багов

| Уровень | Описание | Пример |
|---------|----------|--------|
| **Blocker** | Блокирует работу | Не загружается приложение |
| **Critical** | Ключевая функция не работает | AI не отвечает |
| **Major** | Значительная проблема | Результаты не сохраняются |
| **Minor** | Незначительная проблема | Опечатка в UI |
| **Trivial** | Косметическая проблема | Неверный отступ |

---


##### Pipeline Service (4.B.12)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-291 | test_pipeline_get_state | GET /pipeline/state - состояние пайплайна |
| B-292 | test_pipeline_get_state_empty | Все блоки empty для нового проекта |
| B-293 | test_pipeline_prepare_input_block_2 | prepare-input для Блока 2 из Блока 1 |
| B-294 | test_pipeline_prepare_input_block_2_missing | missing_concept если Блок 1 не заполнен |
| B-295 | test_pipeline_prepare_input_block_3 | prepare-input для Блока 3 из Блоков 1-2 |
| B-296 | test_pipeline_prepare_input_block_3_missing | missing_concept если Блок 1 не заполнен |
| B-297 | test_pipeline_prepare_input_block_3_warning | Предупреждение если Блок 2 не заполнен |
| B-298 | test_pipeline_notify_updated_1 | notify-updated block 1 помечает 2-8 stale |
| B-299 | test_pipeline_notify_updated_2 | notify-updated block 2 помечает 3-8 stale |
| B-300 | test_pipeline_notify_updated_3 | notify-updated block 3 помечает 4-8 stale |
| B-301 | test_pipeline_clear_stale | DELETE stale - снятие stale-статуса |
| B-302 | test_pipeline_run_full | POST run-pipeline - полный пайплайн 1-2-3 |
| B-303 | test_pipeline_run_full_result | concept_result в результате пайплайна |
| B-304 | test_pipeline_stale_downstream | STALE_DOWNSTREAM корректно |
| B-305 | test_pipeline_block_deps | BLOCK_DEPENDENCIES корректно |
| B-306 | test_pipeline_redis_event | Событие в Redis Event Bus |
| B-307 | test_pipeline_completion | Корректный completion_percent |

##### Pipeline API (4.B.12)

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-308 | test_api_pipeline_state | GET /api/v1/pipeline/state |
| B-309 | test_api_pipeline_state_404 | 404 для несуществующего проекта |
| B-310 | test_api_pipeline_prepare_input | GET /api/v1/pipeline/prepare-input |
| B-311 | test_api_pipeline_notify_updated | POST /api/v1/pipeline/notify-updated |
| B-312 | test_api_pipeline_run_pipeline | POST /api/v1/pipeline/run-pipeline |
| B-313 | test_api_pipeline_clear_stale | DELETE /api/v1/pipeline/stale |

##### Balance Service — Классификация (4.C.1) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-314 | test_classify_balance_task_pvp | PvP → primary=transitive, secondary=intransitive |
| B-315 | test_classify_balance_task_pve | PvE → primary=transitive, secondary=situational |
| B-316 | test_classify_balance_task_pvpve | PvPvE → primary=mixed, secondary=mixed |

##### Balance Service — Транзитивный анализ (4.C.1) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-317 | test_transitive_balance_basic | Базовый транзитивный анализ с объектами |
| B-318 | test_transitive_balance_with_costs | Анализ с явно заданными стоимостями объектов |
| B-319 | test_transitive_balance_overpowered | Обнаружение переоценённых объектов (distance < -threshold) |
| B-320 | test_transitive_balance_underpowered | Обнаружение недооценённых объектов (distance > threshold) |
| B-321 | test_transitive_balance_ideal_imbalance | Обнаружение «идеального дисбаланса» (5-15% отклонение) |
| B-322 | test_transitive_balance_attribute_weights | Расчёт весов атрибутов через least squares |
| B-323 | test_transitive_balance_cost_curve_identity | Модель кривой тождества для PvP |
| B-324 | test_transitive_balance_cost_curve_progression | Модель прогрессии ценности для PvE |

##### Balance Service — Стабильность (4.C.1) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-325 | test_analyze_stability_stable | Стабильные петли ОС — без патологий |
| B-326 | test_analyze_stability_runaway | Обнаружение runaway-патологии |
| B-327 | test_analyze_stability_deadlock | Обнаружение deadlock-патологии |

##### Balance Service — Полный пайплайн (4.C.1) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-328 | test_balance_full_pipeline | Полный пайплайн: classify → transitive → stability |
| B-329 | test_balance_full_stages_completed | stages_completed = [1, 2, 3] |
| B-330 | test_balance_full_with_mda | Полный пайплайн с MDA-профилем |

##### Balance Service — API (4.C.1) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-331 | test_api_balance_transitive | POST /api/v1/balance/transitive — транзитивный анализ |
| B-332 | test_api_balance_analyze | POST /api/v1/balance/analyze — полный анализ балансировки |

##### Balance Service — Вспомогательные методы (4.C.1) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-333 | test_least_squares_weights | Метод наименьших квадратов для расчёта весов |
| B-334 | test_solve_linear_system | Решение системы линейных уравнений |
| B-335 | test_calculate_power | Расчёт мощности объекта |
| B-336 | test_calculate_effective_cost | Расчёт эффективной стоимости объекта |
| B-337 | test_get_threshold | Пороговые значения для PvP/PvE/casual |
| B-338 | test_generate_warnings | Генерация предупреждений для несбалансированных объектов |
| B-339 | test_generate_suggestions | Генерация предложений коррекции |

##### Balance Service — Нетранзитивный анализ (4.C.2) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-340 | test_intransitive_balance_basic | Базовый нетранзитивный анализ с 3 объектами |
| B-341 | test_intransitive_balance_payoff_matrix | Антисимметричность payoff-матрицы: M[i][j] = -M[j][i] |
| B-342 | test_intransitive_balance_nash_equilibrium | Равновесие Нэша: сумма вероятностей ≈ 1.0, все ≥ 0 |
| B-343 | test_intransitive_balance_strategy_balance | Метрики баланса стратегий (entropy, max_share, gini) |
| B-344 | test_intransitive_balance_rps_detection | Обнаружение RPS-циклов в структуре объектов |
| B-345 | test_intransitive_balance_dominant_strategy | Обнаружение доминантной стратегии (max_share > 50%) |
| B-346 | test_intransitive_balance_warnings_suggestions | Генерация warnings и suggestions |

##### Balance Service — Ситуационный анализ (4.C.2) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-347 | test_situational_balance_basic | Базовый ситуационный анализ с ситуациями |
| B-348 | test_situational_balance_situation_probabilities | Сумма вероятностей ситуаций ≈ 1.0 |
| B-349 | test_situational_balance_situational_values | Матрица ценности: objects × situations, все ≥ 0 |
| B-350 | test_situational_balance_versatility | Классификация universal/specialized по spread |
| B-351 | test_situational_balance_ev_calculation | Расчёт EV = Σ P(situation) × value |
| B-352 | test_situational_balance_switching_cost | Стоимость переключения low/medium/high |
| B-353 | test_situational_balance_dead_zones | Обнаружение мёртвых зон и доминантных универсалов |

##### Balance Service — Q-фактор анализ (4.C.2) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-354 | test_calculate_q_factor_basic | Базовый Q-фактор анализ с 4 объектами |
| B-355 | test_calculate_q_factor_dominant_attributes | Определение доминантных атрибутов для каждого объекта |
| B-356 | test_calculate_q_factor_redundant_objects | Обнаружение избыточных объектов (не доминируют ни по одному атрибуту) |
| B-357 | test_calculate_q_factor_attribute_dominance | Маппинг «атрибут → доминирующий объект» |
| B-358 | test_calculate_q_factor_q_matrix_normalization | Нормализация Q-матрицы (0–1) |
| B-359 | test_calculate_q_factor_warnings_suggestions | Генерация warnings и suggestions для избыточных объектов |

##### Balance Service — Полный пайплайн 4.C.2 (обновлён) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-360 | test_balance_full_with_intransitive | Полный пайплайн с нетранзитивным анализом (stage 4) |
| B-361 | test_balance_full_with_situational | Полный пайплайн с ситуационным анализом (stage 5) |
| B-362 | test_balance_full_with_qfactor | Полный пайплайн с Q-фактор анализом (stage 6) |
| B-363 | test_balance_full_all_stages | Полный пайплайн stages_completed = [1,2,3,4,5,6] |

##### Balance Service — API 4.C.2 (новые эндпоинты) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-364 | test_api_balance_intransitive | POST /api/v1/balance/intransitive — payoff-матрица, Нэш, RPS |
| B-365 | test_api_balance_situational | POST /api/v1/balance/situational — EV, универсальность |
| B-366 | test_api_balance_qfactor | POST /api/v1/balance/qfactor — избыточные объекты |

##### Balance Service — Monte Carlo-симуляция (4.C.3) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-367 | test_monte_carlo_simulate_basic | Базовая Monte Carlo-симуляция с 3+ объектами (N ≥ 1000 итераций) |
| B-368 | test_monte_carlo_win_rates | Расчёт win_rates для каждого объекта (сумма ≈ 1.0 для 1v1) |
| B-369 | test_monte_carlo_spread_verdict | Win rate spread → вердикт GOOD (<0.15), MODERATE (<0.30), POOR (>=0.30) |
| B-370 | test_monte_carlo_matchup_matrix | Попарные результаты (wins_a, wins_b, draws, avg_duration) |
| B-371 | test_monte_carlo_cross_validation | Кросс-валидация с формальным ранжированием (корреляция Спирмена) |
| B-372 | test_monte_carlo_discrepancy_analysis | Анализ расхождения через ANALYZE_DISCREPANCY при корреляции < 0.5 |
| B-373 | test_monte_carlo_number_format_report | Оценка эмоционального восприятия чисел (лёгкие/тяжёлые) |
| B-374 | test_monte_carlo_random_seed | Воспроизводимость результатов при фиксированном random_seed |

##### Balance Service — Machinations-симуляция (4.C.3) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-375 | test_machinations_graph_build | Построение Machinations-графа из ресурсов (8 типов узлов) |
| B-376 | test_machinations_resource_flows | Потоки ресурсов (сплошные стрелки) и связи состояния (пунктирные) |
| B-377 | test_machinations_feedback_loops | Обнаружение петель обратной связи (reinforcing/balancing) |
| B-378 | test_machinations_economy_type | Определение типа экономики (engine/economy/ecology/hybrid) |
| B-379 | test_machinations_adams_patterns | Обнаружение 16 структурных паттернов Adams/Dormans |
| B-380 | test_machinations_simulate_ticks | Симуляция N тиков с 4 архетипами игроков |
| B-381 | test_machinations_stability_index | Индекс стабильности (stability_index > 0.7 = стабильно) |
| B-382 | test_machinations_build_gap | Разрыв билдов (build_gap < 3.0× = приемлемо) |
| B-383 | test_machinations_quality_assessment | Quality Assessment: 6 проверок + critical_issues |
| B-384 | test_machinations_pathology_detection | Обнаружение 6 патологий: runaway, deadlock, stall, oscillation, inflation, stagnation |

##### Balance Service — Комбинированный анализ устойчивости (4.C.3) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-385 | test_combined_stability_stable | Комбинация MC + Machinations → overall_stability=stable |
| B-386 | test_combined_stability_conditionally_stable | Условная стабильность при смешанных результатах |
| B-387 | test_combined_stability_unstable | Нестабильность при критических патологиях в обоих анализах |
| B-388 | test_stability_analysis_type | StabilityAnalysis — Pydantic-модель вместо raw dict |
| B-389 | test_balance_full_with_monte_carlo | Полный пайплайн с run_monte_carlo=True |
| B-390 | test_balance_full_with_machinations | Полный пайплайн с run_machinations=True |

##### Balance Service — API Monte Carlo и Machinations (4.C.3) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-391 | test_api_balance_monte_carlo | POST /api/v1/balance/monte-carlo — win_rates, вердикт, корреляция |
| B-392 | test_api_balance_monte_carlo_unauthorized | 401 без авторизации |
| B-393 | test_api_balance_monte_carlo_invalid_input | 400 при невалидных данных |
| B-394 | test_api_balance_machinations | POST /api/v1/balance/machinations — граф, качество, патологии |
| B-395 | test_api_balance_machinations_unauthorized | 401 без авторизации |
| B-396 | test_api_balance_analyze_full | POST /api/v1/balance/analyze — полный пайплайн Этапов 1–7 с MC + Machinations |

##### Progression Service — Этап 1: Макро-параметры (4.C.5) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-397 | `test_calculate_macro_params_default` | Макро-параметры по умолчанию (genre=rpg → 50h, 25 levels) |
| B-398 | `test_calculate_macro_params_custom_duration` | Пользовательская targetDuration |
| B-399 | `test_calculate_macro_params_custom_levels` | Пользовательское targetLevels |
| B-400 | `test_genre_duration_map_all_22_genres` | Все 22 жанра имеют маппинг длительности |
| B-401 | `test_pacing_map_relaxed` | Pacing=relaxed → 0.3 переходов/час |
| B-402 | `test_pacing_map_intense` | Pacing=intense → 1.0 переходов/час |
| B-403 | `test_genre_progression_type_rpg` | RPG → s_curve |
| B-404 | `test_genre_progression_type_action` | Action → linear |
| B-405 | `test_genre_progression_type_roguelike` | Roguelike → intermittent |
| B-406 | `test_emergence_ratio_engine` | Engine core loop → высокий emergence_ratio |
| B-407 | `test_emergence_ratio_ecology` | Ecology core loop → низкий emergence_ratio |
| B-408 | `test_lock_key_model_rpg` | RPG → metroidvania |
| B-409 | `test_lock_key_model_strategy` | Strategy → emergent |
| B-410 | `test_content_requirements_calculation` | Контент-требования рассчитаны корректно |
| B-411 | `test_calculate_macro_params_ai_enrichment` | AI-обогащение через PLAN_PROGRESSION_MACROS |
| B-412 | `test_calculate_macro_params_ai_fallback` | Fallback на эвристики при недоступности AI |

##### Progression Service — Этап 2: Планирование tiers (4.C.5) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-413 | `test_plan_tiers_3_tiers` | 25 уровней → 3 tiers |
| B-414 | `test_plan_tiers_2_tiers` | 10 уровней → 2 tiers |
| B-415 | `test_plan_tiers_5_tiers` | 100 уровней → 5 tiers |
| B-416 | `test_plan_tiers_distribution_3` | 3 tiers → распределение [0.2, 0.3, 0.5] |
| B-417 | `test_plan_tiers_early_shorter` | Ранние tiers короче поздних |
| B-418 | `test_plan_tiers_dd_scales` | D&D масштабы: Локальный → Региональный → Мировой |
| B-419 | `test_plan_tiers_balance_type_early_transitive` | Ранние tiers → transitive баланс |
| B-420 | `test_plan_tiers_balance_type_late_intransitive` | Поздние tiers → intransitive баланс |
| B-421 | `test_plan_tiers_resource_state_engine` | Engine → scarcity/growth/abundance/escalation |
| B-422 | `test_plan_tiers_resource_state_economy` | Economy → scarcity/unfolding/complexity/endgame |
| B-423 | `test_plan_tiers_transition_map` | Карта переходов между этапами |

##### Progression Service — Этап 3: Кривые прогрессии (4.C.5) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-424 | `test_build_curves_xp_exponential` | XP-кривая exponential: y = C × b^x |
| B-425 | `test_build_curves_xp_triangular` | XP-кривая triangular: y = (x²-x)/2 |
| B-426 | `test_build_curves_xp_linear` | XP-кривая linear |
| B-427 | `test_build_curves_power_linear` | Power-кривая linear: Power = Base + Rate × n |
| B-428 | `test_build_curves_power_polynomial` | Power-кривая polynomial: Power = Base + Rate × n^exp |
| B-429 | `test_build_curves_power_logistic` | Power-кривая logistic (S-кривая) |
| B-430 | `test_build_curves_cost_proportional` | Cost = Power × Multiplier |
| B-431 | `test_build_curves_cost_multiplier_f2p` | F2P multiplier > 1 (давление донат) |
| B-432 | `test_build_curves_cost_multiplier_pve` | PvE multiplier < 1 (профицит → рост) |
| B-433 | `test_build_curves_difficulty_schreiber` | Формула воспринимаемой сложности Шрайбера |
| B-434 | `test_build_curves_consistency_check` | Проверка согласованности доход/затраты |
| B-435 | `test_build_curves_consistency_warning_frustration` | Warning при затратах >> доходе |
| B-436 | `test_build_curves_consistency_warning_boredom` | Warning при доходе >> затратах |
| B-437 | `test_build_curves_ai_enrichment` | AI-обогащение через GENERATE_PROGRESSION_CURVES |
| B-438 | `test_build_curves_ai_fallback` | Fallback на формализованные кривые |

##### Progression Service — Этап 4: Контент-план (4.C.5) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-439 | `test_generate_content_plan_tier_plans` | Контент-план для каждого tier |
| B-440 | `test_generate_content_plan_enemies` | Враги по tier (count, power_range) |
| B-441 | `test_generate_content_plan_rewards` | Награды по tier (items, rarity_distribution) |
| B-442 | `test_generate_content_plan_abilities` | Способности: ранние 1-2 за уровень, поздние 0-1 |
| B-443 | `test_generate_content_plan_milestones` | Ключевые события (босс, новая область, механика) |
| B-444 | `test_generate_content_plan_pacing` | Pacing: нарастание → пик → награда → передышка |
| B-445 | `test_generate_content_plan_unlock_tree` | Дерево разблокировок: 1-2 за уровень |
| B-446 | `test_generate_content_plan_no_empty_levels` | Нет пустых уровней без разблокировок |
| B-447 | `test_generate_content_plan_core_mechanics_level_1` | Ключевые механики Core Loop доступны с уровня 1 |
| B-448 | `test_generate_content_plan_perceived_difficulty` | Таблица воспринимаемой сложности |
| B-449 | `test_generate_content_plan_tier_boundary_spike` | Скачок сложности на границах tiers |
| B-450 | `test_generate_content_plan_ai_enrichment` | AI-обогащение через GENERATE_CONTENT_PLAN |
| B-451 | `test_generate_content_plan_ai_fallback` | Fallback на формализованный контент |

##### Progression Service — Полный пайплайн (4.C.5) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-452 | `test_progression_design_full` | Полный пайплайн Этапов 1–4 |
| B-453 | `test_progression_design_full_macro_model` | ProgressionMacroModel заполнен |
| B-454 | `test_progression_design_full_tier_model` | TierModel заполнен |
| B-455 | `test_progression_design_full_curves` | ProgressionCurves содержит 4 кривые |
| B-456 | `test_progression_design_full_content_plan` | ContentPlan заполнен |
| B-457 | `test_progression_design_full_validation` | ProgressionValidation заполнен |
| B-458 | `test_progression_design_full_stages_completed` | stages_completed = [1,2,3,4] |
| B-459 | `test_progression_design_full_summary` | Summary содержит формулы XP, Power, Cost |
| B-460 | `test_progression_design_validation_grind` | Обнаружение гринда (циклы > maxGrindTolerance) |
| B-461 | `test_progression_design_validation_wall` | Обнаружение стен (скачок сложности > 0.3) |
| B-462 | `test_progression_design_validation_empty_levels` | Обнаружение пустых уровней |
| B-463 | `test_progression_design_full_latency_ms` | latency_ms записан |
| B-464 | `test_progression_design_full_models_used` | models_used содержит промпты |

##### API-эндпоинты Progression (4.C.5) ★

| ID | Тест | Что проверяет |
|----|------|---------------|
| B-465 | `test_api_progression_design` | POST /api/v1/progression/design — полный ProgressionProfile |
| B-466 | `test_api_progression_design_unauthorized` | 401 без авторизации |
| B-467 | `test_api_progression_macro_params` | POST /api/v1/progression/macro-params — Этап 1 |
| B-468 | `test_api_progression_plan_tiers` | POST /api/v1/progression/plan-tiers — Этап 2 |
| B-469 | `test_api_progression_build_curves` | POST /api/v1/progression/build-curves — Этап 3 |
| B-470 | `test_api_progression_content_plan` | POST /api/v1/progression/content-plan — Этап 4 |
| B-471 | `test_api_progression_get_project` | GET /api/v1/progression/{project_id} — stub |

---
## 8. Pre-commit хуки

### 8.1 Установка

```bash
pip install pre-commit
pre-commit install
```

### 8.2 Состав хуков

| Хук | Что делает | Автоисправление |
|-----|-----------|-----------------|
| ruff (lint) | Линтинг Python | Да (--fix) |
| ruff (format) | Форматирование Python | Да |
| mypy | Проверка типов Python | Нет |
| eslint | Линтинг TypeScript | Да (--fix) |
| trailing-whitespace | Удаление пробелов | Да |
| end-of-file-fixer | Добавление \n в конец | Да |
| check-yaml | Проверка YAML | Нет |
| check-json | Проверка JSON | Нет |
| check-merge-conflict | Поиск маркеров конфликтов | Нет |
| check-added-large-files | Проверка размера файлов | Нет |
| detect-private-key | Поиск приватных ключей | Нет |
