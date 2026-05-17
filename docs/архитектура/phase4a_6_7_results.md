# Фаза 4.A: Результаты задач 4.A.6–4.A.7

> **Дата**: 2026-05-18  
> **Субфаза**: 4.A — Инфраструктура и фундамент  
> **Статус**: 4.A.6 ✅ | 4.A.7 ✅

---

## 4.A.6 — Реализация CRUD для проектов

**Статус**: ✅ Завершена

### Архитектура CRUD

Реализован полный CRUD для управления проектами Game Design. Каждый проект — это Project State (единый источник истины), который автоматически создаётся со всеми пустыми блоками данных при инициализации проекта. Пользователь имеет доступ только к своим проектам (изоляция через `user_id`).

### API-эндпоинты

| Метод | Путь | Описание | Авторизация |
|-------|------|----------|-------------|
| POST | `/api/v1/projects/` | Создание проекта с пустым Project State | Bearer |
| GET | `/api/v1/projects/` | Список проектов (пагинация, поиск, фильтры) | Bearer |
| GET | `/api/v1/projects/:id` | Детали проекта с данными блоков | Bearer |
| PUT | `/api/v1/projects/:id` | Обновление данных проекта | Bearer |
| DELETE | `/api/v1/projects/:id` | Удаление проекта (каскадное) | Bearer |

### Параметры GET /projects/

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| `page` | int | 1 | Номер страницы |
| `per_page` | int | 20 | Количество на странице (max 100) |
| `search` | string | — | Поиск по названию и описанию |
| `status` | string | — | Фильтр: draft/active/completed/archived |
| `genre` | string | — | Фильтр по жанру |

### Автоматическое создание Project State

При создании проекта (`POST /projects/`) автоматически создаются пустые записи для всех 8 блоков:

1. `project_concepts` — Блок 1 (Концепция)
2. `project_core_loops` — Блок 2 (Core Loop)
3. `project_mda_profiles` — Блок 3 (MDA)
4. `project_balance_results` — Блок 4 (Баланс)
5. `project_progressions` — Блок 5 (Прогрессия)
6. `project_economies` — Блок 5 (Экономика)
7. `project_gdds` — Блок 6 (GDD)
8. `project_checklists` — Блок 6 (Валидация)

### Флаги заполненности

Каждый проект в ответе содержит флаги `has_concept`, `has_core_loop`, и т.д., которые автоматически вычисляются на основе наличия данных в JSON-полях блоков. Также автоматически вычисляется `completion_percent` (0–100%).

### Frontend

| Файл | Описание |
|------|----------|
| `src/app/projects/page.tsx` | Страница «Мои проекты» — карточки, поиск, создание, удаление |
| `src/components/gidede/sidebar.tsx` | Обновлён: добавлена ссылка «Мои проекты» |

### Backend артефакты

| Файл | Описание |
|------|----------|
| `app/api/v1/projects.py` | 5 API-эндпоинтов CRUD |
| `app/services/project_service.py` | Бизнес-логика CRUD + вычисление флагов |
| `app/schemas/project.py` | Pydantic-схемы (ProjectCreate, ProjectUpdate, ProjectResponse, ProjectDetailResponse) |
| `main.py` | Подключён роутер `/api/v1/projects` |

---

## 4.A.7 — Реализация AI-сервиса (PromptExecutor)

**Статус**: ✅ Завершена

### Архитектура AI-сервиса

Реализовано ядро AI-интеграции с поддержкой **4 провайдеров** и автоматической маршрутизацией. Система следует трёхслойной архитектуре промптов из спецификации 3.9.4.1 и поддерживает fallback-цепочки при недоступности провайдеров.

```
┌────────────────────────────────────────────────────────────────┐
│                    PROMPT EXECUTOR                              │
│                                                                │
│  execute(prompt_id, inputs, project_state, user_plan, opts)    │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Проверка кэша (Redis / in-memory)                     │  │
│  │ 2. Сборка промпта (3 слоя: System + Context + Task)      │  │
│  │ 3. Маршрутизация (PromptRouter → выбор провайдера)       │  │
│  │ 4. Вызов AI с fallback-цепочкой                          │  │
│  │ 5. Валидация выхода (синтаксис + схема + семантика)      │  │
│  │ 6. Кэширование результата                                │  │
│  │ 7. Логирование (PromptLog → БД)                          │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Провайдеры AI

| # | Провайдер | Приоритет | API | Модели | Цена |
|---|-----------|-----------|-----|--------|------|
| 1 | **z.ai** | 0 (основной) | z-ai-web-dev-sdk / HTTP API | GLM-4, GLM-4-Plus, GLM-4-Flash | По тарифам z.ai |
| 2 | **Ollama** | 1 | HTTP API (localhost:11434) | llama3, mistral, qwen2, phi3, и др. | Бесплатно (локально) |
| 3 | **OpenAI** | 2 (fallback) | OpenAI API | GPT-4o, GPT-4o-mini, GPT-3.5-turbo | По тарифам OpenAI |
| 4 | **Anthropic** | 3 (fallback) | Anthropic API | Claude 3.5 Sonnet, Haiku, Opus | По тарифам Anthropic |

### Ollama: локальный и облачный режимы

```
Ollama Local (по умолчанию):
  OLLAMA_BASE_URL=http://localhost:11434
  → Использует модели, установленные на машине разработчика
  → Бесплатно, приватно, без лимитов
  → Поддержка JSON-режима через format="json"

Ollama Cloud:
  OLLAMA_CLOUD_MODE=true
  OLLAMA_BASE_URL=https://cloud.ollama.ai/api
  → Облачные модели Ollama
  → Быстрее для мощных моделей (70B+)
  → Таймаут 60с вместо 120с
```

### Маршрутизация по типу задачи

| Тип задачи | Модель | Температура | Max токенов | Промпты |
|-----------|--------|-------------|-------------|---------|
| classification | Быстрая (Haiku/Flash/GLM-4-Flash) | 0.3 | 500 | CLASSIFY_GENRE |
| evaluation | Быстрая | 0.3 | 800 | APPLY_LENS_*, ESTIMATE_WEIGHTS |
| recommendation | Быстрая | 0.5 | 1000 | GENERATE_RECOMMENDATIONS |
| generation | Мощная (Sonnet/GPT-4/GLM-4) | 0.7 | 2048 | GENERATE_CORE_LOOPS, GENERATE_USP |
| analysis | Мощная | 0.5 | 2048 | SIMULATE_GAMEPLAY, ANALYZE_DISCREPANCY |

**Правило**: Pro-пользователи всегда получают мощную модель. Длинный вход (>4000 токенов) → мощная модель.

### Fallback-цепочка

```
Попытка 1: primary provider (z.ai)
  ↓ Ошибка: timeout, rate_limit, invalid_json
Попытка 2: fallback provider (Ollama)
  ↓ Ошибка: сервер недоступен
Попытка 3: next fallback (OpenAI)
  ↓ Ошибка: нет API key
Попытка 4: next fallback (Anthropic)
  ↓ Ошибка: все провайдеры недоступны
Попытка 5: cached result (если есть в кэше)
  ↓ Ошибка: нет в кэше
Попытка 6: degraded response (детерминированная заглушка)
  ↓ Ошибка: нет заглушки
Результат: Error с информативным сообщением
```

### Кэширование промптов

| Промпт | TTL | Причина |
|--------|-----|---------|
| CLASSIFY_GENRE | 3600s (1ч) | Жанр не меняется |
| EXTRACT_AESTHETICS | 1800s (30м) | Эстетика стабильна |
| ESTIMATE_WEIGHTS | 1800s (30м) | Веса стабильны |
| APPLY_LENS_* | 900s (15м) | Оценка стабильна |
| GENERATE_CORE_LOOPS | Нет | Креативная генерация |
| GENERATE_USP | Нет | Креативная генерация |

Хранилище: Redis (основное) → in-memory dict (fallback)

### Валидация выхода (3 уровня)

1. **Синтаксическая**: JSON-парсинг с извлечением из markdown-обёрток
2. **Схемная**: Проверка required-полей и типов
3. **Семантическая**: Проверка confidence 0-1, score 0-1, и т.д.

### Детерминированные заглушки

| Промпт | Заглушка | Точность |
|--------|---------|----------|
| CLASSIFY_GENRE | KEYWORD_MATCH_GENRE | ~60% |
| EXTRACT_AESTHETICS | GENRE_AESTHETIC_MAP | ~70% |
| ESTIMATE_WEIGHTS | UNIFORM_WEIGHTS | ~50% |

### Backend артефакты

| Файл | Описание |
|------|----------|
| `app/ai/__init__.py` | Модуль AI-сервиса |
| `app/ai/executor.py` | PromptExecutor — ядро AI-интеграции |
| `app/ai/router.py` | PromptRouter — маршрутизация по провайдерам |
| `app/ai/cache.py` | PromptCache — кэширование (Redis + in-memory) |
| `app/ai/validator.py` | PromptValidator — валидация выхода + заглушки |
| `app/ai/providers/base.py` | AIProvider — базовый класс провайдера |
| `app/ai/providers/zai_provider.py` | ZAIProvider — z.ai |
| `app/ai/providers/ollama_provider.py` | OllamaProvider — локальные/облачные модели |
| `app/ai/providers/openai_provider.py` | OpenAIProvider — OpenAI fallback |
| `app/ai/providers/anthropic_provider.py` | AnthropicProvider — Anthropic fallback |
| `app/api/v1/ai_assistant.py` | Обновлён: /ai/chat, /ai/status, /ai/test |
| `app/api/v1/health.py` | Обновлён: статус AI-провайдеров |
| `app/core/config.py` | Обновлён: переменные для z.ai, Ollama |
| `.env.example` | Обновлён: все AI-переменные |

### Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `ZAI_API_KEY` | — | API-ключ z.ai |
| `ZAI_BASE_URL` | `https://api.z.ai/v1` | URL z.ai API |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | URL Ollama сервера |
| `OLLAMA_API_KEY` | — | API-ключ (для облачного Ollama) |
| `OLLAMA_DEFAULT_MODEL` | `llama3` | Модель Ollama по умолчанию |
| `OLLAMA_CLOUD_MODE` | `false` | Облачный режим Ollama |
| `OLLAMA_TIMEOUT` | `120` | Таймаут Ollama (секунды) |
| `OPENAI_API_KEY` | — | API-ключ OpenAI |
| `ANTHROPIC_API_KEY` | — | API-ключ Anthropic |
| `AI_DEFAULT_PROVIDER` | `auto` | Провайдер по умолчанию (auto/zai/ollama/openai/anthropic) |
| `AI_CACHE_ENABLED` | `true` | Включить кэширование |
| `AI_CACHE_DEFAULT_TTL` | `600` | TTL кэша по умолчанию (секунды) |

---

## Следующие задачи (4.A.8–4.A.12)

| Задача | Описание | Зависимости | Сложность |
|--------|----------|-------------|-----------|
| 4.A.8 | Реестр промптов (31 PromptSpec) | 4.A.7 | L |
| 4.A.9 | Redis: кэш, сессии, Pub/Sub | 4.A.3 | M |
| 4.A.10 | pgvector + RAG | 4.A.4, 4.A.7 | L |
| 4.A.11 | CI/CD + линтеры | 4.A.1–4.A.3 | S |
| 4.A.12 | Shared-модели | 4.A.2, 4.A.3 | M |
