# Gidede — Документ тестирования

> **Фаза**: 4.C.6 (экономика)
> **Дата**: 2026-05-19
> **Версия**: 0.23.0
> **Статус**: Активный
> **Подход**: Локальное тестирование + CI/CD (GitHub Actions)

---

## 1. Общая стратегия тестирования

Тестирование Gidede проводится локально на ПК разработчика и через CI/CD пайплайн (GitHub Actions: `.github/workflows/ci.yml`). Автоматизированные программные тесты запускаются через скрипты, отчёты предоставляются вручную. Ручное тестирование UI проводится через браузер. Полное покрытие включает все реализованные модули: инфраструктуру (4.A), концепцию (4.B.1–4.B.5), Core Loop Designer (4.B.6–4.B.8), MDA Lab (4.B.9–4.B.11), сквозной пайплайн (4.B.12), баланс и симуляцию (4.C.1–4.C.4), прогрессию (4.C.5), экономику (4.C.6), а также скелетные эндпоинты будущих блоков.

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

### 2.1 Backend — pytest (198 тестов в 8 файлах)

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
└── test_economy_service.py        # Economy Service — все 8 этапов
                                    #   алгоритма 3.6 (83 теста)
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

**Stage 2: Классификация экономики (3.6.4) — 15 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-16 | `test_classify_rpg_engine` | RPG → engine |
| ECO-17 | `test_classify_strategy_economy` | Strategy → economy |
| ECO-18 | `test_classify_survival_ecology` | Survival → ecology |
| ECO-19 | `test_classify_sub_type_braked_engine` | Engine с braking → braked_engine |
| ECO-20 | `test_classify_sub_type_pure_engine` | Engine без braking → pure_engine |
| ECO-21 | `test_classify_sub_type_multi_currency` | Economy с 2+ валютами → multi_currency |
| ECO-22 | `test_classify_sub_type_single_currency` | Economy с 1 валютой → single_currency |
| ECO-23 | `test_classify_dominant_loop_reinforcing` | Больше усиливающих петель |
| ECO-24 | `test_classify_dominant_loop_balancing` | Больше балансирующих петель |
| ECO-25 | `test_classify_interaction_type_conversion` | 2+ валюты → conversion |
| ECO-26 | `test_classify_interaction_type_single` | 1 валюта → single_resource |
| ECO-27 | `test_classify_interaction_type_exchange` | Торговая механика → exchange |
| ECO-28 | `test_classify_openness` | Openness по жанру |
| ECO-29 | `test_classify_pricing_type` | Pricing type по жанру |
| ECO-30 | `test_classify_pricing_type_f2p` | Freemium → f2p pricing |
| ECO-31 | `test_classify_risk_level` | Risk level по экономическому типу |

**Stage 3: Machinations-модель (3.6.5) — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-32 | `test_build_machinations_has_pools` | Pool-узлы для каждого ресурса |
| ECO-33 | `test_build_machinations_has_sources` | Source-узлы (faucets) |
| ECO-34 | `test_build_machinations_has_drains` | Drain-узлы для потребляемых |
| ECO-35 | `test_build_machinations_has_converters` | Converter-узлы |
| ECO-36 | `test_build_machinations_has_flows` | Потоки Source → Pool → Drain |
| ECO-37 | `test_build_machinations_has_state_connections` | State connections (обратная связь) |
| ECO-38 | `test_build_machinations_has_feedback_loops` | Feedback loops |
| ECO-39 | `test_build_machinations_node_count` | Количество узлов |
| ECO-40 | `test_build_machinations_trader` | Trader-узел при торговле |
| ECO-41 | `test_build_machinations_gate` | Gate-узел для anchor |

**Stage 4: Граф конверсий (3.6.6) — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-42 | `test_build_conversion_graph_basic` | Цепочки конверсий из progression |
| ECO-43 | `test_build_conversion_graph_profitability` | Profitability корректна |
| ECO-44 | `test_build_conversion_graph_grind_risk` | Предупреждение при profitability > 1.5 |
| ECO-45 | `test_build_conversion_graph_frustration_risk` | Предупреждение при profitability < 0.7 |
| ECO-46 | `test_build_conversion_graph_tier_coverage` | Tier coverage |
| ECO-47 | `test_build_conversion_graph_default` | Default конверсии при отсутствии progression |
| ECO-48 | `test_build_conversion_graph_avg_profitability` | Средняя profitability |
| ECO-49 | `test_build_conversion_graph_suggestions` | Рекомендации для экстремальной profitability |

**Stage 5: Диагностика патологий (3.6.7) — 10 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-50 | `test_diagnose_runaway` | Runaway detection |
| ECO-51 | `test_diagnose_runaway_with_braking` | Runaway с торможением → info |
| ECO-52 | `test_diagnose_stall` | Stall detection |
| ECO-53 | `test_diagnose_inflation` | Inflation при faucet >> drain |
| ECO-54 | `test_diagnose_inflation_no_drain` | Потребляемый без drain |
| ECO-55 | `test_diagnose_stagnation` | Stagnation при faucet = 0 |
| ECO-56 | `test_diagnose_arbitrage` | Arbitrage при profitability > 1.0 |
| ECO-57 | `test_diagnose_arbitrage_cycle` | Замкнутый цикл арбитража |
| ECO-58 | `test_diagnose_faucet_drain_ratios` | Faucet/drain ratios |
| ECO-59 | `test_diagnose_overall_severity` | Агрегация severity |

**Stage 6: Балансировка faucet/drain (3.6.8) — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-60 | `test_balance_deficit_increase_faucet` | Дефицит → increase faucet |
| ECO-61 | `test_balance_deficit_decrease_drain` | Дефицит → decrease drain |
| ECO-62 | `test_balance_surplus_increase_drain` | Профицит → increase drain |
| ECO-63 | `test_balance_surplus_decrease_faucet` | Профицит → decrease faucet |
| ECO-64 | `test_balance_add_faucet` | Добавить faucet |
| ECO-65 | `test_balance_add_drain` | Добавить drain |
| ECO-66 | `test_balance_phase_targets` | Целевые ratio по фазам |
| ECO-67 | `test_balance_updates_graph` | Обновление графа после корректировок |

**Stage 7: Симуляция экономики (3.6.9) — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-68 | `test_simulate_economy_basic` | Базовая симуляция |
| ECO-69 | `test_simulate_economy_archetypes` | 4 архетипа игроков |
| ECO-70 | `test_simulate_economy_runaway_frequency` | Частота runaway |
| ECO-71 | `test_simulate_economy_stall_frequency` | Частота stall |
| ECO-72 | `test_simulate_economy_build_gap` | Build gap между optimal и casual |
| ECO-73 | `test_simulate_economy_stability_index` | Индекс стабильности |
| ECO-74 | `test_simulate_economy_quality` | Quality assessment |
| ECO-75 | `test_simulate_economy_snapshots` | Снапшоты для визуализации |

**Full Pipeline (3.6.10) — 8 тестов**

| ID | Тест | Что проверяет |
|----|------|---------------|
| ECO-76 | `test_economy_design_full_pipeline` | Полный пайплайн Этапов 1–8 |
| ECO-77 | `test_economy_design_full_stages_completed` | stages_completed = [1,2,3,4,5,6,7,8] |
| ECO-78 | `test_economy_design_full_inventory` | Inventory заполнен |
| ECO-79 | `test_economy_design_full_classification` | Classification заполнена |
| ECO-80 | `test_economy_design_full_diagnostics` | Diagnostics заполнена |
| ECO-81 | `test_economy_design_full_balance` | Balance заполнена |
| ECO-82 | `test_economy_design_full_sim_result` | SimResult заполнен |
| ECO-83 | `test_economy_design_full_latency_ms` | Время выполнения записано |

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
| Pipeline Service | test_pipeline_service.py | 4.B.12 | ~20 |
| Progression Service (1–4) | test_progression_service.py | 4.C.5 | ~50 |
| GDD Generator | test_gdd_service.py | 4.D | ~30 |
| AI Assistant | test_ai_assistant_service.py | 4.D | ~20 |
| Итого | | | ~340 |

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
| UI-04 | Отображение версии | 1. Проверить sidebar | Отображается текущая версия (0.23.0) |

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
| UI-34 | Кривые прогрессии | 1. Открыть /blocks/5, вкладка «Прогрессия» | Графики XP, мощности, стоимости |
| UI-35 | Таблица tiers | 1. Проверить таблицу | Характеристики каждого tier |
| UI-36 | Дерево разблокировок | 1. Проверить UnlockTree | Визуальное дерево |
| UI-37 | Валидация прогрессии | 1. Проверить панель валидации | Проверки на гринд/стены/пустые уровни |
| UI-38 | Machinations-редактор | 1. Вкладка «Экономика» | Drag-and-drop узлы |
| UI-39 | Симуляция экономики | 1. Запустить симуляцию | Графики ресурсов по тикам |
| UI-40 | Диагностика патологий | 1. Проверить панель диагностики | Список патологий с severity |
| UI-41 | Балансировка faucet/drain | 1. Проверить корректировки | Рекомендуемые adjustments |

### 4.7 Сквозной пайплайн

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-42 | Progress Sidebar | 1. Проверить индикатор прогресса | Статус по блокам |
| UI-43 | Автозаполнение | 1. Заполнить Блок 1 → перейти в Блок 2 | Данные предзаполнены |
| UI-44 | Уведомления | 1. Обновить данные в Блоке 1 | Уведомление о пересчёте |
| UI-45 | Pipeline Flow Indicator | 1. Проверить индикатор потока данных | Визуализация потока 1→2→3 |

### 4.8 Общие UI-тесты

| ID | Сценарий | Шаги | Ожидаемый результат |
|----|----------|------|---------------------|
| UI-46 | Responsive дизайн | 1. Изменить размер окна | Адаптивная верстка |
| UI-47 | Тёмная/светлая тема | 1. Переключить тему | Корректная смена стилей |
| UI-48 | Страница проектов | 1. Открыть /projects | Список проектов |
| UI-49 | Создание проекта | 1. Нажать «Новый проект» | Модальное окно |
| UI-50 | Настройки | 1. Открыть /settings | Страница настроек |

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

---

## 6. Сводная статистика

### 6.1 Реализованные автоматизированные тесты

| Категория | Файлов | Тестов |
|-----------|--------|--------|
| Backend (pytest) | 8 | 198 |
| Frontend (vitest) | 3 | 9 |
| **Итого** | **11** | **207** |

### 6.2 Плановые автоматизированные тесты

| Категория | Тестов |
|-----------|--------|
| Backend (новые модули) | ~340 |
| Frontend (новые компоненты) | ~112 |
| **Итого плановых** | **~452** |

### 6.3 Ручные UI/E2E тесты

| Категория | Кейс |
|-----------|------|
| UI-тесты | 50 |
| E2E-сценарии | 6 |
| **Итого** | **56** |

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
