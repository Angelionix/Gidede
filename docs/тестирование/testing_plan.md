# Gidede — Документ тестирования

> **Фаза**: 4.B.4 (полное покрытие)  
> **Дата**: 2026-05-18  
> **Версия**: 0.5.0  
> **Статус**: Активный  
> **Подход**: Локальное тестирование (без GitHub Actions)

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика. Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.4), а также скелетные эндпоинты будущих блоков.

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
├── test_concept_service.py        # ★ НОВОЕ: Генератор концепции (Этапы 1–7)
├── test_validation.py             # ★ НОВОЕ: Валидация концепции (Triangle, 5Q, 8F)
└── test_one_pager.py              # ★ НОВОЕ: Сборка One-Pager
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

### 2.2 Frontend — vitest

#### Структура тестов

```
src/__tests__/
├── setup.ts                      # Глобальная настройка
├── components.test.tsx            # Базовые UI-компоненты
├── auth.test.tsx                  # Страницы авторизации
├── api-client.test.ts             # API-клиент
├── concept-form.test.tsx          # ★ Форма ввода концепции (Блок 1)
└── sidebar.test.tsx               # ★ Навигация и прогресс
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
| F-07 | ★ Sidebar: навигация по блокам | 8 блоков в sidebar |
| F-08 | ★ Sidebar: статус блоков | Блок 1 — «Активен» |
| F-09 | ★ Sidebar: версия | Отображение «v0.5.0» |
| F-10 | ★ Главная страница: блоки | Карточки 8 блоков |
| F-11 | ★ Форма концепции: поля | Поля идея, жанр, платформа |

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
| 5 | Проверить версию в footer | Отображается «Фаза 4.B • v0.5.0» |

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

#### UI-08: Core Loop Designer (Блок 2, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/2 | Страница с плейсхолдером |
| 2 | Проверить статус в sidebar | «Скелет» |

#### UI-09: MDA Lab (Блок 3, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/3 | Страница с плейсхолдером |
| 2 | Проверить статус в sidebar | «Скелет» |

#### UI-10: Баланс (Блок 4, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/4 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-11: Экономика и прогрессия (Блок 5, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/5 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-12: GDD Generator (Блок 6, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/6 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-13: AI-ассистент (Блок 7, скелет)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/7 | Страница с плейсхолдером |
| 2 | Проверить статус | «Скелет» |

#### UI-14: GBE Integration (Блок 8, запланирован)

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть /blocks/8 | Страница с плейсхолдером |
| 2 | Проверить статус в sidebar | «План» |

#### UI-15: Responsive-дизайн

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Открыть на Desktop (1920px) | Полный layout с sidebar |
| 2 | Открыть на Tablet (768px) | Sidebar сворачивается |
| 3 | Открыть на Mobile (375px) | Мобильный layout |
| 4 | Переключить тему | Тёмная/светлая тема работает |

#### UI-16: Обработка ошибок

| Шаг | Действие | Ожидаемый результат |
|------|----------|-------------------|
| 1 | Отключить backend | Сообщение «Сервер недоступен» |
| 2 | Ввести невалидные данные | Красная подсветка + текст ошибки |
| 3 | AI таймаут | Индикатор + fallback |
| 4 | Сессия истекла | Редирект на /login |

#### UI-17: Главная страница ★

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
| ★ Concept Service (Этап 6) | 14 | — | ★ Новое |
| ★ Concept Service (Этап 7) | 11 | — | ★ Новое |
| ★ Полный пайплайн (1–7) | 4 | — | ★ Новое |
| ★ API концепции | 7 | — | ★ Новое |
| **Итого** | **102** | **baseline** | |

### 6.2 Frontend — покрытие по модулям

| Модуль | Тестов | Покрытие | Статус |
|--------|--------|----------|--------|
| UI Components | 3 | — | ✅ |
| Auth Pages | 2 | — | ✅ |
| API Client | 3 | — | ✅ |
| ★ Sidebar | 3 | — | ★ Новое |
| ★ Главная страница | 2 | — | ★ Новое |
| ★ Форма концепции | 2 | — | ★ Новое |
| **Итого** | **15** | **baseline** | |

### 6.3 Ручные UI-тесты

| Категория | Тестов | Статус |
|-----------|--------|--------|
| Авторизация | 10 | ✅ |
| Проекты | 6 | ✅ |
| Навигация | 5 | ✅ |
| Генератор концепции (ввод) | 7 | ✅ |
| ★ Валидация концепции | 7 | ★ Новое |
| ★ One-Pager | 11 | ★ Новое |
| Скелетные блоки (2–7) | 12 | ✅ |
| Запланированные (8) | 2 | ✅ |
| Responsive | 4 | ✅ |
| Обработка ошибок | 4 | ✅ |
| ★ Главная страница | 4 | ★ Новое |
| **Итого** | **72** | |

### 6.4 E2E-сценарии

| Сценарий | Шагов | Статус |
|----------|-------|--------|
| Полный пайплайн генерации | 17 | ★ Новое |
| Повторная валидация | 5 | ★ Новое |
| **Итого** | **22** | |

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
