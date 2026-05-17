# Gidede — Результаты Фазы 4.A.10–4.A.11

> **Задачи**: 4.A.10 (pgvector + RAG), 4.A.11 (CI/CD + линтеры → локальное тестирование)  
> **Дата**: 2026-05-18  
> **Версия API**: 0.5.0

---

## 4.A.10 — Настройка pgvector и загрузка базы знаний (RAG)

### Реализованные компоненты

#### 1. Docker: pgvector/pgvector:pg16

**Файл**: `docker-compose.yml`

Образ PostgreSQL заменён на `pgvector/pgvector:pg16` — официальный образ с предустановленным расширением pgvector. Расширение `vector` включается автоматически при инициализации БД.

```yaml
postgres:
  image: pgvector/pgvector:pg16  # было: postgres:16-alpine
```

#### 2. Database: включение pgvector

**Файл**: `mini-services/api-service/app/core/database.py`

Функция `init_db()` теперь автоматически выполняет `CREATE EXTENSION IF NOT EXISTS vector` при подключении к PostgreSQL. Для SQLite — pgvector недоступен (ожидаемо).

#### 3. ORM-модель: KnowledgeChunk

**Файл**: `mini-services/api-service/app/models/db.py`

Новая таблица `knowledge_chunks`:

| Колонка | Тип | Описание |
|---------|-----|----------|
| id | String (PK) | UUID чанка |
| source_type | String(30) | Тип: bible/book/algorithm |
| source_name | String(255) | Имя источника |
| chunk_index | Integer | Порядковый номер |
| title | String(500) | Заголовок/тема |
| content | Text | Текст чанка (~500 токенов) |
| token_count | Integer | Количество токенов |
| metadata_json | JSON | Дополнительные метаданные |
| embedding | vector(1536) | Эмбеддинг (pgvector) |
| created_at | DateTime | Дата создания |

Индексы: `ix_knowledge_source` (source_type, source_name), `ix_knowledge_chunk_idx` (source_name, chunk_index), `ix_knowledge_embedding` (IVFFlat, cosine).

#### 4. RAG-сервис: app/core/rag_service.py

Полнофункциональный сервис RAG (~500 строк):

- **TextChunker**: разбиение текста на чанки (~500 токенов)
  - Разбивает по Markdown-заголовкам (## и ###)
  - Длинные секции — по абзацам
  - Очень длинные абзацы — по предложениям
  - Поддержка overlap между чанками

- **EmbeddingGenerator**: генерация эмбеддингов
  - OpenAI `text-embedding-3-small` (1536d) — по умолчанию
  - z.ai (OpenAI-совместимый API)
  - Ollama `nomic-embed-text` (локальный)
  - Пакетная генерация (batch_size=20)

- **RAGService**: поиск и интеграция
  - `search_knowledge(query, top_k=5)` → векторный поиск с косинусным сходством
  - `enrich_prompt(query, project_context)` → обогащение промпта контекстом
  - `load_document(content, source_type, source_name)` → загрузка документа
  - `load_bible(bible_dir)` → загрузка всех 12 разделов Библии
  - `get_stats()` → статистика базы знаний
  - Автоматическое создание IVFFlat-индекса

#### 5. Интеграция в PromptExecutor

**Файл**: `mini-services/api-service/app/ai/executor.py`

Новый метод `_enrich_with_rag()` автоматически обогащает промпты контекстом из базы знаний для 25 из 31 промптов (все генеративные и аналитические, кроме чистой классификации).

Поток данных:
1. PromptExecutor.execute() → шаг 3.5: `_enrich_with_rag()`
2. Определяется, нужен ли RAG для данного prompt_id
3. Формируется поисковый запрос (тема + контекст проекта)
4. RAG-сервис возвращает релевантные чанки
5. Контекст добавляется в Context Prompt (Слой 2)

#### 6. API-эндпоинты RAG

**Файл**: `mini-services/api-service/app/api/v1/rag.py`

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | /api/v1/rag/stats | Статистика базы знаний |
| POST | /api/v1/rag/search | Векторный поиск |
| POST | /api/v1/rag/load | Загрузка документа |
| POST | /api/v1/rag/load-bible | Загрузка Библии геймдизайна |

#### 7. Скрипт загрузки знаний

**Файл**: `mini-services/api-service/scripts/load_knowledge.py`

Поддерживает загрузку:
- `--all` — всё (Библия + книги)
- `--bible` — только Библия геймдизайна (12 разделов)
- `--books` — только книги (17 PDF, через pdfplumber)
- `--file` — конкретный файл
- `--stats` — статистика

#### 8. Конфигурация RAG

**Файл**: `mini-services/api-service/app/core/config.py`

Новые настройки:
- `EMBEDDING_PROVIDER` (openai/zai/local)
- `EMBEDDING_MODEL` (text-embedding-3-small)
- `EMBEDDING_DIMENSIONS` (1536)
- `RAG_CHUNK_SIZE_TOKENS` (500)
- `RAG_TOP_K` (5)
- `RAG_SIMILARITY_THRESHOLD` (0.7)
- `RAG_ENABLED` (true/false)

#### 9. Alembic-миграция

**Файл**: `mini-services/api-service/alembic/versions/a3f10b7c8d21_add_knowledge_chunks_pgvector.py`

- Включает pgvector (`CREATE EXTENSION IF NOT EXISTS vector`)
- Создаёт таблицу `knowledge_chunks`
- Добавляет колонку `embedding vector(1536)`
- Создаёт IVFFlat-индекс

---

## 4.A.11 — Настройка CI/CD и линтеров → Локальная тестовая инфраструктура

### Адаптация: без GitHub Actions

Вместо GitHub Actions реализована полная локальная тестовая инфраструктура. Тестирование проводится на локальном ПК разработчика, отчёты предоставляются вручную.

### Реализованные компоненты

#### 1. Backend: pytest + fixtures

**Директория**: `mini-services/api-service/tests/`

```
tests/
├── conftest.py                    # Общие фикстуры
├── test_health.py                 # Health check API
├── test_auth.py                   # Авторизация (6 тестов)
├── test_projects.py               # CRUD проектов (4 теста)
├── test_rag_service.py            # RAG-сервис (8 тестов)
├── test_prompt_registry.py        # Реестр промптов (7 тестов)
└── test_text_chunker.py           # TextChunker (5 тестов)
```

Фикстуры в `conftest.py`:
- `test_db` — in-memory SQLite для изоляции
- `test_client` — async HTTP-клиент (httpx)
- `authenticated_client` — клиент с авторизацией
- `mock_ai_provider` — мок AI-провайдера
- `sample_project_state` — тестовый Project State

**pyproject.toml** обновлён:
- `asyncio_mode = "auto"`
- `addopts = "-v --tb=short"`
- Настройки coverage: `source = ["app"]`, `fail_under = 0`

#### 2. Frontend: vitest + React Testing Library

**Директория**: `src/__tests__/`

```
src/__tests__/
├── setup.ts                       # Глобальная настройка (моки)
├── components.test.tsx            # UI-компоненты (3 теста)
├── auth.test.tsx                  # Авторизация (2 теста)
└── api-client.test.ts             # API-клиент (3 теста)
```

**vitest.config.ts** — конфигурация с jsdom, coverage-v8, алиасами.

**package.json** обновлён:
- Скрипты: `test`, `test:watch`, `test:coverage`, `test:ui`
- Dev-зависимости: vitest, @vitejs/plugin-react, jsdom, @testing-library/react, @testing-library/jest-dom, @vitest/coverage-v8, @vitest/ui

#### 3. Pre-commit хуки

**Файл**: `.pre-commit-config.yaml`

| Хук | Что делает |
|-----|-----------|
| ruff (lint) | Линтинг Python (--fix) |
| ruff (format) | Форматирование Python |
| mypy | Проверка типов Python |
| eslint | Линтинг TypeScript |
| trailing-whitespace | Удаление пробелов |
| end-of-file-fixer | \n в конце файлов |
| check-yaml | Валидация YAML |
| check-json | Валидация JSON |
| check-merge-conflict | Маркеры конфликтов |
| check-added-large-files | Размер файлов ≤ 500KB |
| detect-private-key | Приватные ключи |

#### 4. Скрипт запуска тестов

**Файл**: `scripts/run_tests.sh`

Поддерживает:
- `./scripts/run_tests.sh` — все тесты
- `./scripts/run_tests.sh backend` — только pytest
- `./scripts/run_tests.sh frontend` — только vitest
- `./scripts/run_tests.sh lint` — линтеры
- `./scripts/run_tests.sh coverage` — с покрытием

Автоматически генерирует отчёт `test_report_YYYYMMDD_HHMMSS.txt`.

#### 5. Документ тестирования

**Файл**: `docs/тестирование/testing_plan.md`

Полный план тестирования:
- Стратегия тестирования (5 уровней)
- Программные тесты (backend: 15 тест-кейсов, frontend: 6 тест-кейсов)
- Ручные UI-тесты (12 сценариев, ~60 шагов)
- RAG-тестирование (10 тест-кейсов)
- Формат отчётности
- Pre-commit хуки

---

## Изменённые файлы

### Новые файлы (10)

| Файл | Описание |
|------|----------|
| `mini-services/api-service/app/core/rag_service.py` | RAG-сервис (~500 строк) |
| `mini-services/api-service/app/api/v1/rag.py` | API-эндпоинты RAG |
| `mini-services/api-service/alembic/versions/a3f10b7c8d21_...py` | Миграция pgvector |
| `mini-services/api-service/scripts/load_knowledge.py` | Скрипт загрузки знаний |
| `mini-services/api-service/tests/conftest.py` | pytest фикстуры |
| `mini-services/api-service/tests/test_health.py` | Тесты health check |
| `mini-services/api-service/tests/test_auth.py` | Тесты авторизации |
| `mini-services/api-service/tests/test_projects.py` | Тесты CRUD |
| `mini-services/api-service/tests/test_rag_service.py` | Тесты RAG |
| `mini-services/api-service/tests/test_prompt_registry.py` | Тесты реестра |
| `mini-services/api-service/tests/test_text_chunker.py` | Тесты чанкинга |
| `src/__tests__/setup.ts` | Vitest setup |
| `src/__tests__/components.test.tsx` | UI-тесты |
| `src/__tests__/auth.test.tsx` | Тесты авторизации UI |
| `src/__tests__/api-client.test.ts` | Тесты API-клиента |
| `vitest.config.ts` | Конфигурация vitest |
| `.pre-commit-config.yaml` | Pre-commit хуки |
| `scripts/run_tests.sh` | Скрипт запуска тестов |
| `docs/тестирование/testing_plan.md` | Документ тестирования |

### Изменённые файлы (8)

| Файл | Изменение |
|------|-----------|
| `docker-compose.yml` | pgvector/pgvector:pg16 |
| `mini-services/api-service/app/core/database.py` | pgvector extension + logging |
| `mini-services/api-service/app/models/db.py` | + KnowledgeChunk модель |
| `mini-services/api-service/app/core/config.py` | + RAG/Embedding настройки |
| `mini-services/api-service/app/ai/executor.py` | + RAG-интеграция |
| `mini-services/api-service/main.py` | + RAG router + инициализация, v0.5.0 |
| `mini-services/api-service/pyproject.toml` | + coverage + pytest config |
| `package.json` | + vitest scripts + devDeps |
| `docs/архитектура/.env.example` | + RAG/Embedding/Ollama переменные |
