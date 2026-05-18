# Gidede — Документ тестирования

> **Фаза**: 4.B.5–4.B.9 (полное покрытие)  
> **Дата**: 2026-05-18  
> **Версия**: 0.9.0  
> **Статус**: Активный  
> **Подход**: Локальное тестирование (без GitHub Actions)

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика. Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.5), Core Loop Designer (4.B.6–4.B.8), а также скелетные эндпоинты будущих блоков.

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
└── test_jwt_secret.py             # ★ НОВОЕ: JWT secret property (TD-017)
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
| B-16 | `test_all_34_prompts_registered` | Все 34 промпта в реестре |
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
| F-09 | Sidebar: версия | Отображение «v0.9.0» |
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
| 5 | Проверить версию в footer | Отображается «Фаза 4.B • v0.9.0» |

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

#### UI-15: MDA Lab (Блок 3, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Страница с плейсхолдером |
| 2 | Проверить статус в sidebar | «Скелет» |

#### UI-16: Баланс (Блок 4, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/4 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

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
| ★ CoreLoop Service (Этап 4: Валидация) | 19 | — | ★ Новое |
| ★ CoreLoop Service (Этап 5: Рекомендации) | 11 | — | ★ Новое |
| ★ CoreLoop полный пайплайн | 7 | — | ★ Новое |
| ★ API CoreLoop | 6 | — | ★ Новое |
| **Итого** | **168** | **baseline** | |

### 6.2 Frontend — покрытие по модулям

| Модуль | Тестов | Покрытие | Статус |
|--------|--------|----------|--------|
| UI Components | 3 | — | ✅ |
| Auth Pages | 2 | — | ✅ |
| API Client | 3 | — | ✅ |
| Sidebar | 3 | — | ✅ |
| Главная страница | 2 | — | ✅ |
| Форма концепции | 2 | — | ✅ |
| ★ Компоненты результата (4.B.5) | 7 | — | ★ Новое |
| **Итого** | **22** | **baseline** | |

### 6.3 Ручные UI-тесты

| Категория | Тестов | Статус |
|-----------|--------|--------|
| Авторизация | 10 | ✅ |
| Проекты | 6 | ✅ |
| Навигация | 5 | ✅ |
| Генератор концепции (ввод) | 7 | ✅ |
| Валидация концепции | 7 | ✅ |
| One-Pager | 11 | ✅ |
| ★ Результат — OnePagerCard | 6 | ★ Новое |
| ★ Результат — AestheticProfileView | 3 | ★ Новое |
| ★ Результат — MechanicSetView | 5 | ★ Новое |
| ★ Результат — CoreLoopCandidates | 4 | ★ Новое |
| ★ Результат — USPCandidates | 4 | ★ Новое |
| ★ Результат — ValidationReportView | 5 | ★ Новое |
| ★ Core Loop Designer (API) | 5 | ★ Новое |
| Скелетные блоки (3–7) | 10 | ✅ |
| Запланированные (8) | 2 | ✅ |
| Responsive | 4 | ✅ |
| Обработка ошибок | 4 | ✅ |
| Главная страница | 4 | ✅ |
| **Итого** | **102** | |

### 6.4 E2E-сценарии

| Сценарий | Шагов | Статус |
|----------|-------|--------|
| Полный пайплайн генерации | 17 | ✅ |
| Повторная валидация | 5 | ✅ |
| ★ Core Loop Designer (Этапы 1–3) | 10 | ★ Новое |
| **Итого** | **32** | |

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
