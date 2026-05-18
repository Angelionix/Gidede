# Gidede — Подготовка тестовой инфраструктуры

> **Фаза**: 4.B.4 (полное покрытие)  
> **Дата**: 2026-05-18  
> **Версия**: 0.5.0  
> **Статус**: Активный

---

## 1. Обзор тестовой инфраструктуры

Тестовая инфраструктура Gidede построена на двух независимых стеках — для backend (Python/pytest) и frontend (TypeScript/vitest). Оба стека работают локально, без CI/CD-серверов. Результаты тестирования формируют отчёт, который разработчик может передать для анализа.

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
│  │ test_rag       │  │  │ concept-form   │ ★            │
│  │ test_registry  │  │  │ sidebar        │ ★            │
│  │ test_chunker   │  │  └────────────────┘              │
│  │ test_concept   │ ★  │                                  │
│  │ test_validate  │ ★  │                                  │
│  │ test_one_pager │ ★  │                                  │
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
└─────────────────────────────────────────────────────────┘

★ — добавлено в v0.5.0 (4.B.4)
```

---

## 2. Компоненты тестовой инфраструктуры

### 2.1 Backend: pytest

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| Фикстуры | `tests/conftest.py` | Общие тестовые данные, моки, БД |
| Health Check | `tests/test_health.py` | API health-эндпоинт |
| Авторизация | `tests/test_auth.py` | Регистрация, логин, JWT, refresh |
| Проекты | `tests/test_projects.py` | CRUD проектов |
| RAG-сервис | `tests/test_rag_service.py` | Векторный поиск, чанкинг |
| Реестр промптов | `tests/test_prompt_registry.py` | 34 PromptSpec |
| TextChunker | `tests/test_text_chunker.py` | Разбиение текста |
| ★ Concept Service | `tests/test_concept_service.py` | Этапы 1–7 генерации концепции |
| ★ Валидация | `tests/test_validation.py` | Triangle, 5Q, 8F валидаторы |
| ★ One-Pager | `tests/test_one_pager.py` | Сборка OnePager |

**Ключевые фикстуры:**

| Фикстура | Что предоставляет |
|----------|-------------------|
| `test_db` | In-memory SQLite для изоляции тестов |
| `test_client` | Async HTTP-клиент (httpx) |
| `authenticated_client` | Клиент с JWT-авторизацией |
| `mock_ai_provider` | Мок AI-провайдера (без реальных вызовов) |
| `sample_project_state` | Тестовый Project State |
| `sample_concept_input` | Тестовый ConceptInput |
| `sample_aesthetic_profile` | Тестовый AestheticProfile |
| `sample_dynamics_profile` | Тестовый DynamicsProfile |
| `sample_mechanic_set` | Тестовый MechanicSet (10–15 механик) |
| `sample_core_loop_candidates` | Тестовые 3 варианта CoreLoopCandidate |
| `sample_usp_candidates` | Тестовые 3 варианта USPCandidate |
| `sample_validation_report` | Тестовый ValidationReport |
| `sample_one_pager` | Тестовый OnePager |

### 2.2 Frontend: vitest

| Компонент | Файл | Назначение |
|-----------|------|-----------|
| Setup | `src/__tests__/setup.ts` | Глобальные моки |
| UI-компоненты | `src/__tests__/components.test.tsx` | Базовый рендеринг |
| Авторизация | `src/__tests__/auth.test.tsx` | Формы логина/регистрации |
| API-клиент | `src/__tests__/api-client.test.ts` | HTTP-запросы, обработка ошибок |
| ★ Форма концепции | `src/__tests__/concept-form.test.tsx` | Поля ввода Блока 1 |
| ★ Sidebar | `src/__tests__/sidebar.test.tsx` | Навигация, статусы, версия |

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
| Auth API | 1 | 8 | — |
| Projects API | 1 | 5 | — |
| RAG Service | 1 | 10 | — |
| Prompt Registry | 1 | 7 | — |
| TextChunker | 1 | 5 | — |
| Concept Service (1–3) | 1 | 10 | — |
| Concept Service (4–5) | 1 | 19 | — |
| ★ Validation (6) | 1 | 14 | — |
| ★ One-Pager (7) | 1 | 11 | — |
| ★ Full Pipeline | 1 | 4 | — |
| ★ Concept API | 1 | 7 | — |
| **Итого** | **12** | **102** | **baseline** |

### 3.2 Frontend — текущее покрытие

| Модуль | Файлов | Тестов | Покрытие |
|--------|--------|--------|----------|
| UI Components | 1 | 3 | — |
| Auth Pages | 1 | 2 | — |
| API Client | 1 | 3 | — |
| ★ Concept Form | 1 | 2 | — |
| ★ Sidebar | 1 | 3 | — |
| ★ Main Page | 1 | 2 | — |
| **Итого** | **6** | **15** | **baseline** |

### 3.3 Целевое покрытие (критерий C8 из ROADMAP)

- **Backend**: ≥ 60% coverage
- **Frontend**: ≥ 50% coverage

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
