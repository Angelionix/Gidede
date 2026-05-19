# Gidede — Подготовка тестовой инфраструктуры

> **Фаза**: 4.D.10 (Тесты Блоков 6-7)
> **Дата**: 2026-05-19
> **Версия**: 0.39.0
> **Статус**: Активный

---

## 1. Обзор тестовой инфраструктуры

Тестовая инфраструктура Gidede построена на двух независимых стеках — для backend (Python/pytest) и frontend (TypeScript/vitest). Оба стека работают локально и через CI/CD пайплайн (GitHub Actions: `.github/workflows/ci.yml`). Результаты тестирования формируют отчёт, который разработчик может передать для анализа.

### 1.1 Архитектура тестовой инфраструктуры

```
┌─────────────────────────────────────────────────────────┐
│                     Gidede Test Suite                    │
├──────────────────────┬──────────────────────────────────┤
│   Backend (pytest)   │   Frontend (vitest)              │
│                      │                                  │
│  ┌────────────────┐  │  ┌────────────────┐              │
│  │ conftest.py    │  │  │ setup.ts       │              │
│  │ (фикстуры)     │  │  │ (моки)         │              │
│  └───────┬────────┘  │  └───────┬────────┘              │
│          │           │          │                       │
│  ┌───────▼────────┐  │  ┌───────▼────────┐              │
│  │ test_health    │  │  │ components     │              │
│  │ test_auth      │  │  │ auth           │              │
│  │ test_projects  │  │  │ api-client     │              │
│  │ test_rag       │  │  └────────────────┘              │
│  │ test_registry  │  │                                  │
│  │ test_chunker   │  │                                  │
│  │ test_balance   │  │                                  │
│  │ test_economy   │  │                                  │
│  └────────────────┘  │                                  │
├──────────────────────┴──────────────────────────────────┤
│               Shared Types (4.A.12)                      │
│  ┌─────────────────┬───────────────────┐                │
│  │ TypeScript      │ Python            │                │
│  │ interfaces.ts   │ models.py         │                │
│  │ enums.ts        │ enums.py          │                │
│  └─────────────────┴───────────────────┘                │
│  sync_types.py — проверка синхронизации                 │
├─────────────────────────────────────────────────────────┤
│  run_tests.sh — единый запуск                            │
│  .pre-commit-config.yaml — хуки                          │
│  .github/workflows/ci.yml — CI/CD пайплайн (GitHub Actions) │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Компоненты тестовой инфраструктуры

### 2.1 Backend: pytest (20 файлов, 614 тестов)

| Компонент | Файл | Назначение | Тестов |
|-----------|------|-----------|--------|
| Фикстуры | `tests/conftest.py` | Общие тестовые данные, моки, БД | — |
| Health Check | `tests/test_health.py` | API health-эндпоинт | 2 |
| Авторизация | `tests/test_auth.py` | Регистрация, логин, JWT | 6 |
| Проекты | `tests/test_projects.py` | CRUD проектов | 4 |
| RAG-сервис | `tests/test_rag_service.py` | Векторный поиск, чанкинг | 1* |
| Реестр промптов | `tests/test_prompt_registry.py` | 34+ PromptSpec | 8 |
| TextChunker | `tests/test_text_chunker.py` | Разбиение текста | 1* |
| Balance Service | `tests/test_balance_service.py` | Транзитивный, интранзитивный, ситуационный, Q-фактор, Monte Carlo, Machinations | 77 |
| Economy Service | `tests/test_economy_service.py` | Все 8 этапов алгоритма 3.6 | 83 |
| Pipeline Service | `tests/test_pipeline_service.py` | Сквозной пайплайн 1→5, зависимости блоков, stale-каскад, подготовка входных данных | 29 |

*\* RAG и TextChunker имеют ошибки импорта, требуют исправления зависимостей*

**Ключевые фикстуры:**

| Фикстура | Что предоставляет |
|----------|-------------------|
| `test_db` | In-memory SQLite для изоляции тестов |
| `test_client` | Async HTTP-клиент (httpx) |
| `authenticated_client` | Клиент с JWT-авторизацией |
| `mock_ai_provider` | Мок AI-провайдера (без реальных вызовов) |
| `mock_executor` | Мок PromptExecutor |
| `sample_project_state` | Тестовый Project State |
| `sample_concept_input` | Тестовый ConceptInput |
| `sample_core_loop` | Тестовый Core Loop с шагами и петлями |
| `sample_mda_profile` | Тестовый MDA-профиль |
| `sample_progression_profile` | Тестовый профиль прогрессии |
| `rpg_inventory` | Инвентарь ресурсов для RPG |
| `rpg_classification` | Классификация для RPG |
| `economy_service` | EconomyService с мокнутым PromptExecutor |

### 2.2 Frontend: vitest (3 файла, 9 тестов)

| Компонент | Файл | Назначение | Тестов |
|-----------|------|-----------|--------|
| Setup | `src/__tests__/setup.ts` | Глобальные моки | — |
| UI-компоненты | `src/__tests__/components.test.tsx` | Базовый рендеринг | 3 |
| Авторизация | `src/__tests__/auth.test.tsx` | Формы логина/регистрации | 2 |
| API-клиент | `src/__tests__/api-client.test.ts` | HTTP-запросы, обработка ошибок | 4 |

**Моки в setup.ts:**
- `next/navigation` — useRouter, usePathname, useSearchParams
- `next-auth/react` — useSession, signIn, signOut, SessionProvider
- `global.fetch` — глобальный мок fetch

### 2.3 Shared Types (4.A.12)

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| TypeScript Enums | `shared/types/typescript/enums.ts` | 25+ enum-типов |
| TypeScript Interfaces | `shared/types/typescript/interfaces.ts` | 27+ интерфейсов |
| Python Enums | `shared/types/python/enums.py` | 25+ enum-классов |
| Python Models | `shared/types/python/models.py` | 27+ Pydantic-моделей |
| Скрипт синхронизации | `shared/types/sync_types.py` | Проверка TS↔PY синхронизации |

### 2.4 Линтеры и Pre-commit

| Хук | Инструмент | Когда срабатывает |
|-----|-----------|-------------------|
| ruff lint | ruff | Каждый commit |
| ruff format | ruff | Каждый commit |
| mypy | mypy | Каждый commit |
| eslint | eslint | Каждый commit |
| trailing-whitespace | pre-commit | Каждый commit |
| check-yaml | pre-commit | Каждый commit |
| check-merge-conflict | pre-commit | Каждый commit |
| detect-private-key | pre-commit | Каждый commit |

---

## 3. Покрытие тестами

### 3.1 Backend — текущее покрытие

| Модуль | Файлов | Тестов | Покрытие |
|--------|--------|--------|----------|
| Health API | 1 | 2 | — |
| Auth API | 1 | 6 | — |
| Projects API | 1 | 4 | — |
| RAG Service | 1 | 1* | — |
| Prompt Registry | 1 | 8 | — |
| TextChunker | 1 | 1* | — |
| Balance Service (4.C.1–4.C.3) | 1 | 77 | — |
| Economy Service (4.C.6) | 1 | 83 | — |
| Pipeline Service (4.C.9) | 1 | 29 | — |
| **Итого** | **9** | **209** | **baseline** |

*\* RAG и TextChunker имеют ошибки импорта*

### 3.2 Frontend — текущее покрытие

| Модуль | Файлов | Тестов | Покрытие |
|--------|--------|--------|----------|
| UI Components | 1 | 3 | — |
| Auth Pages | 1 | 2 | — |
| API Client | 1 | 4 | — |
| **Итого** | **3** | **9** | **baseline** |

### 3.3 UI-тесты (ручные)

| Категория | Тест-кейсов |
|-----------|-------------|
| Авторизация и навигация | UI-01–UI-04 |
| Блок 1: Концепция | UI-05–UI-12 |
| Блок 2: Core Loop | UI-13–UI-20 |
| Блок 3: MDA Lab | UI-21–UI-27 |
| Блок 4: Баланс | UI-28–UI-33 |
| Блок 5: Прогрессия и экономика | UI-34–UI-50 |
| Сквозной пайплайн (1→5) | UI-51–UI-60 |
| Общие UI | UI-61–UI-65 |
| E2E сценарии | E2E-01–E2E-06 |
| **Итого** | **71** |

### 3.4 Целевое покрытие (критерий C8 из ROADMAP)

- **Backend**: >= 60% coverage
- **Frontend**: >= 50% coverage

---

## 4. Формат отчёта о тестировании

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

## 5. Pre-commit установка

```bash
# Установка pre-commit
pip install pre-commit

# Установка хуков в репозиторий
cd /path/to/Gidede
pre-commit install

# Запуск вручную
pre-commit run --all-files

# Запуск конкретного хука
pre-commit run ruff --all-files
```
