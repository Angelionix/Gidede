# Gidede — Game Design AI System

**Версия**: v0.51.0

AI-powered система для проектирования игр. Помогает геймдизайнерам пройти путь от идеи до полноценного GDD (Game Design Document) с использованием искусственного интеллекта и формализованных алгоритмов, основанных на 17 книгах по геймдизайну.

## Что умеет Gidede

Gidede реализует 8 функциональных блоков, покрывающих полный пайплайн геймдизайна:

1. **Генератор концепции** (`/blocks/1`) — превращает абстрактную идею в структурированную концепцию: жанр, эстетика, механики, Core Loop, USP (алгоритм 3.1, 7 этапов)
2. **Core Loop Designer** (`/blocks/2`) — визуальный конструктор игрового цикла: классификация структурного типа, иерархия петель, диагностика 7 патологий, валидация (алгоритм 3.2, 5 этапов)
3. **MDA Lab** (`/blocks/3`) — интерактивная среда для MDA-фреймворка: Reverse MDA (эстетика → динамики → механики), Adams/Dormans паттерны, Set Cover оптимизация, Линзы Шелла, Матрица Бонда (алгоритм 3.3, 6 этапов)
4. **Баланс и симуляция** (`/blocks/4`) — transitive/intransitive анализ, ситуационный баланс, Q-фактор, Monte Carlo-симуляция, Machinations (алгоритм 3.4)
5. **Экономика и прогрессия** (`/blocks/5`) — конструктор экономики на основе Machinations, кривые прогрессии, диагностика патологий, балансировка faucets/drains (алгоритмы 3.5–3.6)
6. **GDD Generator** (`/blocks/6`) — генерация дизайн-документов 8 форматов, автозаполнение из Project State, AI-обогащение, чек-листы валидации (алгоритмы 3.7–3.8)
7. **AI-ассистент** (`/blocks/7`) — контекстно-осведомлённый чат-бот с SSE streaming, проактивные уведомления, контекстные подсказки, RAG-поиск по 17 книгам (спецификация 3.9)
8. **Интеграция GBE** (`/blocks/8`) — API Bridge для GDCombine, двусторонняя синхронизация, вебхуки (mock-режим для разработки)

## Технологический стек

| Слой | Технология | Обоснование |
|------|-----------|-------------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui | Быстрая разработка, SSR, компонентная модель |
| Backend | Python 3.12+ / FastAPI | Асинхронность, типизация, OpenAPI |
| БД основная | PostgreSQL 16 + pgvector | Реляционная модель + векторный поиск для RAG |
| Кэш / Pub-Sub | Redis 7 | Кэширование промптов, сессии, события |
| AI | OpenAI API + Anthropic API + z.ai + Ollama | 34 промпта с маршрутизацией по задачам |
| Экспорт | WeasyPrint (PDF) + python-docx (DOCX) | Генерация документации |
| Мониторинг | Prometheus + Grafana | 11 метрик, 10 панелей, 8 алертов |
| Нагрузочное | Locust | 3 сценария нагрузочного тестирования |
| Контейнеризация | Docker + Docker Compose | Унификация окружения |
| CI/CD | GitHub Actions | Автоматизация тестирования и деплоя |

## Версионирование

Проект использует семантическое версионирование **v.X.Y.Z**:

- **X** (major) — мажорная версия; до релиза равна 0
- **Y** (minor) — минорная версия; увеличивается при добавлении нового функционала
- **Z** (patch) — патч-версия; увеличивается при доработке существующего функционала

Текущая версия указана в файле [`VERSION`](./VERSION). Управление версиями — через [`scripts/version.sh`](./scripts/version.sh).

## Структура проекта

```
Gidede/
├── src/                    # Frontend (Next.js 16)
│   ├── app/                # App Router страницы
│   │   ├── blocks/1-8/     # 8 функциональных блоков
│   │   ├── projects/       # Управление проектами
│   │   └── login/register/ # Авторизация
│   ├── components/         # React-компоненты (shadcn/ui + gidede)
│   │   ├── ui/             # shadcn/ui базовые компоненты
│   │   └── gidede/         # Доменные компоненты (concept, coreloop, mda, ...)
│   ├── hooks/              # React-хуки (usePipeline, useActiveProject, ...)
│   ├── lib/                # Утилиты (api-client, auth, db, utils)
│   ├── config/             # Конфигурация (genres, aesthetics, blocks, api)
│   ├── types/              # TypeScript-интерфейсы для 8 блоков
│   ├── constants/          # Константы для 8 блоков
│   ├── styles/             # CSS-анимации
│   └── __tests__/          # Frontend тесты (vitest)
├── e2e/                    # E2E тесты (Playwright)
├── mini-services/
│   └── api-service/        # Backend (FastAPI)
│       ├── app/
│       │   ├── ai/         # AI-сервис (PromptExecutor, Router, Cache, Providers)
│       │   ├── api/v1/     # REST API эндпоинты (14 роутеров)
│       │   ├── core/       # Конфигурация, БД, Redis, RAG, Security, Metrics
│       │   ├── data/       # MechanicsDB (128 механик)
│       │   ├── models/     # SQLAlchemy модели
│       │   ├── prompts/    # Реестр 34 промптов
│       │   ├── schemas/    # Pydantic-модели (9 модулей)
│       │   └── services/   # Бизнес-логика (9 сервисов)
│       ├── tests/          # Backend тесты (pytest, 975+ тестов)
│       ├── load_tests/     # Locust нагрузочные тесты
│       └── alembic/        # Миграции БД
├── shared/                 # Общие типы (TypeScript + Python)
│   └── types/
│       ├── typescript/     # TS интерфейсы и перечисления
│       └── python/         # Python модели и перечисления
├── docs/                   # Документация
│   ├── анализ/             # Анализ 17 книг по геймдизайну
│   ├── концепт/            # Концепция программы (2.5)
│   ├── Алгоритмы/          # 10 алгоритмических спецификаций (3.1–3.10)
│   ├── архитектура/        # Архитектурные документы по субфазам 4.A
│   ├── тестирование/       # Тестовая документация
│   ├── bible/              # Библия геймдизайна (12 разделов + PDF)
│   ├── gdd_examples/       # 51 пример GDD из 12+ жанров
│   └── books/              # Исходные PDF (17 книг)
├── monitoring/             # Prometheus + Grafana конфигурация
│   ├── prometheus/         # prometheus.yml + alerts.yml
│   └── grafana/            # Dashboard JSON
├── nginx/                  # Nginx конфигурация для production
├── scripts/                # Скрипты (версионирование, тестирование)
├── prisma/                 # Prisma schema (генерация типов для Next.js)
├── .github/workflows/      # CI/CD (GitHub Actions)
├── docker-compose.yml      # Dev-окружение (PostgreSQL + Redis)
├── docker-compose.quick.yml # One-Click Quick Start (4 контейнера)
├── docker-compose.single.yml # Single Container (всё в одном)
├── docker-compose.prod.yml # Production (nginx + frontend + backend + DB)
├── docker-compose.monitoring.yml # Prometheus + Grafana
├── VERSION                 # Единый источник версии
└── CHANGELOG.md            # История изменений
```

## Быстрый старт

### Вариант 1: One-Click (рекомендуется для демо/оценки)

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede

# Один клик — всё поднимается автоматически (4 контейнера)
docker compose -f docker-compose.quick.yml up

# С AI-ключами (опционально — UI работает и без них)
OPENAI_API_KEY=sk-... docker compose -f docker-compose.quick.yml up
```

Доступно сразу: http://localhost:3000 (Frontend) | http://localhost:3030/docs (API Docs)

### Вариант 2: Single Container (всё в одном контейнере)

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede

# Сборка и запуск (1 контейнер — PostgreSQL + Redis + Backend + Frontend)
docker compose -f docker-compose.single.yml up
```

### Вариант 3: Локальная разработка (ручная настройка)

```bash
# Настройка окружения
cp .env.example .env
# Отредактируйте .env: укажите API-ключи для AI-провайдеров

# Запуск инфраструктуры (PostgreSQL + Redis)
docker compose up -d

# Backend
cd mini-services/api-service
pip install -e ".[dev]"
uvicorn main:app --port 3030 --reload

# Frontend (в отдельном терминале)
npm install    # или: bun install
npm run dev    # или: bun run dev
```

### Production-деплой

```bash
# Настройка окружения
cp .env.example .env
# Заполните все обязательные переменные (особенно JWT_SECRET_KEY и AI API-ключи)

# SSL-сертификаты
mkdir -p nginx/ssl
# Скопируйте fullchain.pem и privkey.pem в nginx/ssl/

# Запуск
docker compose -f docker-compose.prod.yml up -d

# Проверка
curl http://localhost/api/v1/health
```

### Мониторинг (опционально)

```bash
docker compose -f docker-compose.monitoring.yml up -d
# Grafana: http://localhost:3001
# Prometheus: http://localhost:9090
```

## Тестирование

```bash
# Все тесты
./scripts/run_tests.sh

# Backend (pytest, 946+ тестов)
cd mini-services/api-service
python -m pytest tests/ -v
python -m pytest tests/ -v --cov=app --cov-report=term-missing

# Frontend (vitest)
npx vitest run
npx vitest run --coverage

# E2E (Playwright, 17 тестов в 5 сценариях)
npx playwright test

# Нагрузочное тестирование (Locust)
cd mini-services/api-service
locust -f load_tests/locustfile_api.py --host=http://localhost:3030

# Линтеры
ruff check app/ tests/     # Python
npx eslint src/            # TypeScript
```

## API документация

После запуска backend доступна интерактивная API-документация:

- **Swagger UI**: http://localhost:3030/api/v1/docs
- **ReDoc**: http://localhost:3030/api/v1/redoc
- **OpenAPI JSON**: http://localhost:3030/api/v1/openapi.json

### Основные эндпоинты

| Группа | Префикс | Описание |
|--------|---------|----------|
| Auth | `/api/v1/auth` | Регистрация, логин, refresh, профиль |
| Projects | `/api/v1/projects` | CRUD проектов, изоляция по пользователям |
| Concept | `/api/v1/concept` | Генератор концепции (Блок 1) |
| CoreLoop | `/api/v1/coreloop` | Core Loop Designer (Блок 2) |
| MDA | `/api/v1/mda` | MDA Lab (Блок 3) |
| Balance | `/api/v1/balance` | Анализ баланса (Блок 4) |
| Progression | `/api/v1/progression` | Прогрессия (Блок 5) |
| Economy | `/api/v1/economy` | Экономика (Блок 5) |
| GDD | `/api/v1/gdd` | GDD Generator (Блок 6) |
| AI Assistant | `/api/v1/ai` | AI-ассистент (Блок 7) |
| Checklists | `/api/v1/checklists` | Чек-листы валидации |
| Pipeline | `/api/v1/pipeline` | Сквозной пайплайн |
| GBE | `/api/v1/gbe` | GBE Bridge (Блок 8, mock) |
| RAG | `/api/v1/rag` | База знаний |
| Health | `/api/v1/health` | Health check + метрики |
| Metrics | `/api/v1/metrics` | Prometheus metrics |

## Документация

- [Дорожная карта Фазы 4](./docs/ROADMAP_PHASE4.md) — детальный план с 52 задачами
- [Технический долг](./docs/TECH_DEBT.md) — отслеживание компромиссов и отложенных задач
- [Развёртывание](./docs/DEPLOYMENT.md) — инструкции по деплою
- [CHANGELOG](./CHANGELOG.md) — история изменений по версиям
- [Контрибуция](./CONTRIBUTING.md) — правила контрибуции
- [Реестр книг](./docs/BOOKS_REGISTRY.md) — 17 книг по геймдизайну
- [Тестирование](./docs/тестирование/testing_plan.md) — полный план тестирования
- [Руководство пользователя](./docs/USER_GUIDE.md) — гайд по каждому блоку

## Текущий статус

**Фаза 4.E — Интеграция и полировка (завершение)**

| Блок | Статус | Реализовано | Тестов |
|------|--------|-------------|--------|
| Блок 1: Генератор концепции | ✅ Активен | 4.B.1–4.B.5 (алгоритм 3.1, 7 этапов) | 41 |
| Блок 2: Core Loop Designer | ✅ Активен | 4.B.6–4.B.8 (алгоритм 3.2, 5 этапов) | 40 |
| Блок 3: MDA Lab | ✅ Активен | 4.B.9–4.B.11 (алгоритм 3.3, 6 этапов) | 45 |
| Блок 4: Баланс | ✅ Активен | 4.C.1–4.C.4 (алгоритм 3.4, все виды анализа) | 77 |
| Блок 5: Экономика/Прогрессия | ✅ Активен | 4.C.5–4.C.8 (алгоритмы 3.5–3.6) | 128 |
| Блок 6: GDD Generator | ✅ Активен | 4.D.1–4.D.5 (алгоритмы 3.7–3.8, 8 этапов) | 227 |
| Блок 7: AI-ассистент | ✅ Активен | 4.D.6–4.D.8 (SSE streaming, RAG, alerts) | 80 |
| Блок 8: GBE Bridge | ✅ Активен (mock) | 4.E.1–4.E.2 (API Bridge для GDCombine) | 69 |

**Инфраструктура**: ✅ Авторизация, PostgreSQL + pgvector, Redis, AI-сервис (34 промпта), RAG, Pipeline, CI/CD

**Оптимизация**: ✅ React.memo (34 компонента), lazy loading, AI timeout/retry, error boundaries, skeleton loading

**Мониторинг**: ✅ Prometheus (11 метрик), Grafana (10 панелей), Locust (3 сценария), структурированные логи

**Тесты**: 1437 (946 backend + 283 frontend + 17 E2E + 64 API endpoint + 83 инфраструктурные + 12 load)
