# Фаза 4.A: Результаты задач 4.A.8–4.A.9

> **Дата**: 2026-05-19  
> **Субфаза**: 4.A — Инфраструктура и фундамент  
> **Статус**: 4.A.8 ✅ | 4.A.9 ✅

---

## 4.A.8 — Реализация реестра промптов (PROMPT_REGISTRY)

**Статус**: ✅ Завершена

### Архитектура реестра

Реализован полный реестр всех 31 AI-промптов на основе каталога из спецификации 3.9.2. Каждый промпт формализован как `PromptSpec` — Pydantic-модель с типизированными входами, выходами, JSON-Schema валидацией, требованиями к модели и гарантиями. Реестр интегрирован в `PromptExecutor`, заменяя временную заглушку из 4.A.7.

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROMPT REGISTRY (31 PromptSpec)               │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Блок 1 (4)      │  │  Блок 2 (4)      │  │  Блок 3 (5)   │ │
│  │  CLASSIFY_GENRE  │  │  DECOMPOSE_STEP   │  │ SUGGEST_DYN.  │ │
│  │  EXTRACT_AESTH.  │  │  GEN_OUTER_LOOPS  │  │ SUGGEST_MECH. │ │
│  │  GEN_CORE_LOOPS  │  │  GEN_META_LOOP    │  │ SIMULATE_GPL. │ │
│  │  GENERATE_USP    │  │  GEN_RECOMMEND.   │  │ APPLY_LENS_MDA│ │
│  └──────────────────┘  └──────────────────┘  │ CHECK_LUDO_MD │ │
│                                               └───────────────┘ │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Блок 4 (5)      │  │  Блок 5 (6)      │  │  Блок 6 (7)   │ │
│  │  ESTIMATE_WEIGHT │  │  PLAN_TIERS       │  │ ENRICH_SECT.  │ │
│  │  EVAL_SITUAT.    │  │  SUGGEST_UNLOCKS  │  │ GEN_CHARACT.  │ │
│  │  SUGG_INTRANS.   │  │  CHECK_PROG_AESTH │  │ GEN_VISUAL    │ │
│  │  ANALYZE_DISCR.  │  │  SUGG_SUBSIDIARY  │  │ CHECK_LUDO_VAL│ │
│  │  SELECT_CORRECT. │  │  SUGG_LATE_SINKS  │  │ APPLY_LENS_V  │ │
│  └──────────────────┘  │  GEN_ECON_DESCR   │  │ CHECK_AGENCY  │ │
│                         └──────────────────┘  │ GEN_REMEDIAT. │ │
│                                               └───────────────┘ │
│                                                                  │
│  PromptSpec для каждого:                                         │
│  ├── id, module, algorithm, version                              │
│  ├── taskType → маршрутизация по модели                         │
│  ├── inputs[] → типизированные параметры                        │
│  ├── outputSchema → JSON-Schema для валидации                   │
│  ├── systemPrompt + userPromptTemplate                          │
│  ├── modelRequirements (primary + fallback)                     │
│  └── guarantees (cacheable, TTL, maxRetries)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Pydantic-модели (schemas.py)

| Модель | Описание |
|--------|----------|
| `PromptSpec` | Полная спецификация промпта (31 шт.) |
| `PromptInput` | Типизированный входной параметр |
| `ModelSpec` | Спецификация AI-модели (provider + model + max_cost) |
| `ModelRequirements` | Требования к модели (primary + fallback + temperature + max_tokens) |
| `PromptGuarantees` | Гарантии (deterministic, cacheable, TTL, maxRetries, fallback) |
| `EstimatedMetrics` | Оценка токенов, стоимости и латентности |
| `ModuleType` | Enum: concept, core_loop, mda, balance, progression, economy, gdd, validation |
| `PromptTaskType` | Enum: classification, generation, analysis, evaluation, recommendation |
| `OutputFormat` | Enum: json, markdown, text |
| `AIProviderType` | Enum: zai, ollama, openai, anthropic, local |

### Статистика реестра

| Метрика | Значение |
|---------|----------|
| Всего промптов | 31 |
| Кэшируемых | 13 (42%) |
| Некэшируемых (креативных) | 18 (58%) |
| JSON-выход | 29 (94%) |
| Markdown-выход | 2 (6%) |
| Быстрая модель (primary) | 13 (classification/evaluation/recommendation) |
| Мощная модель (primary) | 18 (generation/analysis) |

| Модуль | Количество промптов |
|--------|-------------------|
| Блок 1 (Концепция) | 4 |
| Блок 2 (Core Loop) | 4 |
| Блок 3 (MDA) | 5 |
| Блок 4 (Баланс) | 5 |
| Блок 5 (Прогрессия) | 3 |
| Блок 5 (Экономика) | 3 |
| Блок 6 (GDD) | 3 |
| Блок 6 (Валидация) | 4 |

### Оценка стоимости (все 31 промпт за одну сессию)

| Метрика | Значение |
|---------|----------|
| Минимальная стоимость | $0.20 |
| Максимальная стоимость | $1.10 |
| Общие входные токены | ~15,000 |
| Общие выходные токены | ~28,000 |

### A/B-тестирование (ab_testing.py)

| Компонент | Описание |
|-----------|----------|
| `ABTestManager` | Запуск A/B тестов: вариант A (из реестра) vs B (экспериментальный) |
| `ABTestVariant` | Данные варианта: результат, латентность, токены, стоимость |
| `ABTestResult` | Результат теста: сравнение, winner, метрики |
| `PromptVersionManager` | Управление версиями промптов: регистрация, переключение, откат |

**Алгоритм сравнения A/B**:
1. Оба варианта вызываются с одинаковыми входами (skip_cache=True)
2. Сравнение по: латентность, стоимость, валидация
3. Winner определяется по взвешенному score (валидация: 2, скорость: 1, стоимость: 1)
4. Результаты сохраняются в prompt_logs для агрегации

### Backend артефакты

| Файл | Описание |
|------|----------|
| `app/prompts/schemas.py` | Pydantic-модели (PromptSpec, PromptInput, ModelRequirements, и т.д.) |
| `app/prompts/registry.py` | PROMPT_REGISTRY со всеми 31 PromptSpec + утилиты |
| `app/prompts/ab_testing.py` | ABTestManager, PromptVersionManager |
| `app/prompts/__init__.py` | Экспорт всего модуля |
| `app/ai/executor.py` | Обновлён: использует PROMPT_REGISTRY вместо заглушки |

---

## 4.A.9 — Настройка Redis: кэш, сессии, Pub/Sub

**Статус**: ✅ Завершена

### Архитектура Redis

Реализован унифицированный клиент Redis с тремя функциями: кэш промптов, сессии пользователей, Event Bus (Pub/Sub). Клиент включает connection pooling, автоматическое переподключение, health check и fallback на in-memory при недоступности Redis.

```
┌─────────────────────────────────────────────────────────────────┐
│                     REDIS CLIENT (RedisClient)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  1. КЭШ ПРОМПТОВ                                           │ │
│  │  Ключ: gidede:prompt_cache:{prompt_id}:{hash}              │ │
│  │  TTL: из PROMPT_REGISTRY (900-3600 сек)                    │ │
│  │  Методы: get_cache(), set_cache(), delete_cache()          │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  2. СЕССИИ ПОЛЬЗОВАТЕЛЕЙ                                    │ │
│  │  Ключ: gidede:session:{user_id}                            │ │
│  │  TTL: 24 часа (86400 сек)                                   │ │
│  │  Методы: get_session(), set_session(), update_session()    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  3. EVENT BUS (Pub/Sub)                                     │ │
│  │  Канал: gidede:events:{project_id}                         │ │
│  │  Методы: publish_event(), subscribe(), unsubscribe()       │ │
│  │  События: concept_updated, core_loop_updated, и т.д.       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  4. RATE LIMITING (дополнительно)                           │ │
│  │  Ключ: gidede:rate_limit:{action}:{user_id}                │ │
│  │  Методы: check_rate_limit()                                │ │
│  │  Стратегия: sliding window counter                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  Фичи:                                                          │
│  - Connection pooling (20 connections)                          │
│  - Автопереподключение (каждые 30 сек health check)            │
│  - Fallback на in-memory при недоступности                     │
│  - Singleton через get_redis_client()                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Кэш промптов

Интегрирован с `PROMPT_REGISTRY` — TTL и `cacheable` флаг берутся из `PromptSpec.guarantees`:

| Промпт | TTL | Причина |
|--------|-----|---------|
| CLASSIFY_GENRE | 3600s (1ч) | Жанр не меняется |
| EXTRACT_AESTHETICS | 1800s (30м) | Эстетика стабильна |
| ESTIMATE_WEIGHTS | 1800s (30м) | Веса стабильны |
| EVALUATE_SITUATIONAL_VALUE | 1800s (30м) | Ситуационная оценка стабильна |
| APPLY_LENS_MDA | 900s (15м) | Оценка стабильна |
| APPLY_LENS_VAL | 900s (15м) | Оценка стабильна |
| CHECK_PROGRESSION_AESTHETICS | 900s (15м) | Проверка стабильна |
| GENERATE_RECOMMENDATIONS | 900s (15м) | Рекомендации стабильны |
| SELECT_BEST_CORRECTION | 900s (15м) | Выбор стабилен |
| GENERATE_ECONOMY_DESCRIPTION | 1800s (30м) | Описание стабильно |
| DECOMPOSE_STEP | 1800s (30м) | Декомпозиция стабильна |

Некэшируемые (18 промптов): все generation и analysis задачи.

### 2. Сессии пользователей

Структура сессии:
```json
{
    "project_id": "proj_abc123",
    "current_block": 1,
    "last_activity": 1716123456.789,
    "preferences": {
        "theme": "dark",
        "language": "ru"
    }
}
```

Методы:
- `get_session(user_id)` — получить сессию
- `set_session(user_id, data, ttl=86400)` — создать/обновить
- `update_session(user_id, updates)` — обновить отдельные поля
- `delete_session(user_id)` — удалить (logout)

### 3. Event Bus (Pub/Sub)

События Project State:

| Событие | Описание | Кто публикует | Кто подписан |
|---------|----------|--------------|-------------|
| concept_updated | Блок 1 обновлён | concept_service | coreloop_service, mda_service |
| core_loop_updated | Блок 2 обновлён | coreloop_service | mda_service, balance_service |
| mda_updated | Блок 3 обновлён | mda_service | balance_service |
| balance_updated | Блок 4 обновлён | balance_service | progression_service |
| progression_updated | Блок 5 обновлён | progression_service | economy_service |
| economy_updated | Блок 5 обновлён | economy_service | gdd_service |
| gdd_updated | Блок 6 обновлён | gdd_service | validation_service |
| validation_completed | Валидация завершена | validation_service | UI (WebSocket) |
| cache_invalidated | Кэш инвалидирован | PromptCache | Подписчики кэша |

Методы:
- `publish_event(project_id, event_data)` — опубликовать событие
- `subscribe(project_id, callback)` — подписаться на события проекта
- `unsubscribe(project_id, callback)` — отписаться

### 4. Rate Limiting

Sliding window counter для ограничения AI-вызовов:

| План | Лимит AI-вызовов | Окно |
|------|-------------------|------|
| Free | 50 | 24 часа |
| Pro | 500 | 24 часа |

### Обновление PromptCache

`app/ai/cache.py` обновлён для использования `RedisClient` вместо прямого `redis.asyncio`:
- Инициализация через `get_redis_client()` singleton
- TTL и cacheable флаги берутся из `PROMPT_REGISTRY`
- Добавлен метод `invalidate_project()` для инвалидации кэша при изменении Project State

### Backend артефакты

| Файл | Описание |
|------|----------|
| `app/core/redis_client.py` | RedisClient: кэш, сессии, Pub/Sub, rate limiting |
| `app/ai/cache.py` | Обновлён: интеграция с RedisClient и PROMPT_REGISTRY |
| `app/core/config.py` | Без изменений (REDIS_URL уже был) |
| `main.py` | Обновлён: инициализация Redis при старте, логирование реестра |

### Переменные окружения

| Переменная | По умолчанию | Описание |
|-----------|-------------|----------|
| `REDIS_URL` | `redis://localhost:6379` | URL Redis сервера |

---

## Итоги субфазы 4.A

| Задача | Статус | Описание |
|--------|--------|----------|
| 4.A.1 | ✅ | Инициализация монорепозитория и настройка окружения |
| 4.A.2 | ✅ | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| 4.A.3 | ✅ | FastAPI + структура backend-проекта |
| 4.A.4 | ✅ | Схема PostgreSQL (Project State) |
| 4.A.5 | ✅ | Авторизация и управление пользователями |
| 4.A.6 | ✅ | CRUD для проектов |
| 4.A.7 | ✅ | AI-сервис (PromptExecutor) |
| 4.A.8 | ✅ | Реестр промптов (31 PromptSpec) |
| 4.A.9 | ✅ | Redis: кэш, сессии, Pub/Sub |
| 4.A.10 | ⬜ | pgvector + RAG |
| 4.A.11 | ⬜ | CI/CD + линтеры |
| 4.A.12 | ⬜ | Shared-модели |
