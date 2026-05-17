# Gidede — Инструкция по развёртыванию (Deployment Guide)

> **Проект**: Gidede — Game Design AI System  
> **Версия документа**: 1.0.0  
> **Дата**: 2026-03-05  
> **Статус**: Актуально для Фазы 4 (Разработка)

---

## Содержание

1. [Обзор деплоя](#1-обзор-деплоя)
2. [Системные требования](#2-системные-требования)
3. [Переменные окружения](#3-переменные-окружения)
4. [Локальная разработка](#4-локальная-разработка)
5. [Docker-деплой (production)](#5-docker-деплой-production)
6. [CI/CD Pipeline](#6-cicd-pipeline)
7. [Мониторинг и логирование](#7-мониторинг-и-логирование)
8. [Масштабирование](#8-масштабирование)
9. [Резервное копирование](#9-резервное-копирование)
10. [Устранение неполадок](#10-устранение-неполадок)

---

## 1. Обзор деплоя

### Что разворачивается

Gidede — веб-приложение для AI-ассистированного геймдизайна, состоящее из следующих компонентов:

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| **Frontend** | Next.js 16 (React, TypeScript, Tailwind CSS 4) | Клиентское приложение с 8 функциональными модулями |
| **Backend** | Python FastAPI | REST API, бизнес-логика, AI-маршрутизация, симуляции |
| **База данных** | PostgreSQL 16+ | Хранение Project State, пользователей, сессий |
| **Кэш / Pub-Sub** | Redis 7+ | Кэширование AI-промптов, Event Bus, сессии |
| **Reverse Proxy** | Nginx | TLS-терминация, маршрутизация, статики |
| **Мониторинг** | Prometheus + Grafana | Метрики, алерты, дашборды (рекомендация) |

### Архитектура в общих чертах

```
                    ┌──────────────┐
                    │   Пользователь │
                    └──────┬───────┘
                           │ HTTPS
                    ┌──────▼───────┐
                    │    Nginx      │  :80/:443
                    │  (Reverse     │
                    │   Proxy)      │
                    └──┬───────┬───┘
                       │       │
              ┌────────▼┐   ┌──▼────────┐
              │ Frontend │   │  Backend   │
              │ Next.js  │   │  FastAPI   │
              │  :3000   │   │  :8000     │
              └────┬─────┘   └──┬────┬───┘
                   │            │    │
                   │     ┌──────▼┐ ┌─▼───────┐
                   │     │ Redis │ │PostgreSQL│
                   │     │ :6379 │ │  :5432   │
                   │     └───────┘ └──────────┘
                   │
              ┌────▼─────┐
              │  CDN      │  (статика в production)
              └──────────┘
```

**Поток данных**:

1. Пользователь обращается к Nginx (HTTPS)
2. Nginx маршрутизирует: `/api/*` → Backend, остальное → Frontend (SSR/SSG)
3. Backend обрабатывает запросы, обращается к PostgreSQL (данные) и Redis (кэш/pub-sub)
4. AI-запросы маршрутизируются через PromptExecutor к OpenAI / Anthropic API
5. Frontend рендерит страницы через SSR и взаимодействует с Backend через REST API

### 8 функциональных модулей

| # | Модуль | Описание |
|---|--------|----------|
| 1 | Concept Generator | Генерация концепции игры из абстрактной идеи |
| 2 | Core Loop Designer | Визуальный конструктор основного цикла игры |
| 3 | MDA Lab | Интерактивная работа с MDA-фреймворком |
| 4 | Balance & Simulation | Математический анализ баланса, Monte Carlo |
| 5 | Economy & Progression | Конструктор экономики на основе Machinations |
| 6 | GDD Generator | Генерация дизайн-документов и чек-листы |
| 7 | AI Assistant | Контекстно-осведомлённый чат-ассистент |
| 8 | GDCombine Integration | API Bridge для интеграции с GDCombine (GBE) |

---

## 2. Системные требования

### Минимальные требования (разработка / staging)

| Параметр | Значение |
|----------|---------|
| CPU | 2 ядра |
| RAM | 4 ГБ |
| Диск | 20 ГБ SSD |
| Сеть | 10 Мбит/с (для AI API-вызовов) |

### Рекомендуемые требования (production)

| Параметр | Значение |
|----------|---------|
| CPU | 4+ ядра |
| RAM | 8+ ГБ |
| Диск | 50+ ГБ SSD |
| Сеть | 100 Мбит/с |

> **Примечание**: AI-вызовы выполняются к внешним API (OpenAI, Anthropic), поэтому GPU на сервере не требуется. При высокой нагрузке основной потребитель памяти — PostgreSQL (кэши запросов) и Redis (кэш AI-промптов).

### Программное обеспечение

| Компонент | Минимальная версия | Рекомендуемая версия | Примечание |
|-----------|-------------------|---------------------|------------|
| Node.js | 20.0+ | 20 LTS | Для Frontend и сборки |
| Python | 3.11+ | 3.12 | Для Backend |
| Docker | 24.0+ | 27.x | Контейнеризация |
| Docker Compose | v2.0+ | v2.32+ | Оркестрация контейнеров |
| PostgreSQL | 16+ | 16.x | Основная БД |
| Redis | 7.0+ | 7.4+ | Кэш и Pub/Sub |
| Nginx | 1.24+ | 1.27+ | Reverse proxy |
| Git | 2.40+ | 2.47+ | Версионирование |

### Внешние зависимости

| Сервис | Назначение | Обязательность |
|--------|-----------|----------------|
| OpenAI API | GPT-4 / GPT-3.5 для AI-генерации | Обязательно |
| Anthropic API | Claude 3.5 Sonnet / Haiku для AI-генерации | Обязательно |
| z-ai-web-dev-sdk | Дополнительные AI-функции | Опционально |
| SMTP-сервер | Отправка email (восстановление пароля и т.д.) | Опционально |
| S3-совместимое хранилище | Бэкапы БД, загруженные файлы | Рекомендуется |

---

## 3. Переменные окружения

### Обзор

Все переменные окружения хранятся в файле `.env` в корне проекта. Файл `.env.example` содержит шаблон с описаниями и значениями по умолчанию. **Никогда не коммитьте `.env` в репозиторий.**

### Database (PostgreSQL)

| Переменная | Описание | Пример значения | Обязательная |
|-----------|----------|----------------|-------------|
| `DATABASE_URL` | Строка подключения к PostgreSQL | `postgresql://gidede:secret@localhost:5432/gidede` | Да |
| `DB_HOST` | Хост PostgreSQL | `localhost` | Нет (используется из DATABASE_URL) |
| `DB_PORT` | Порт PostgreSQL | `5432` | Нет |
| `DB_NAME` | Имя базы данных | `gidede` | Нет |
| `DB_USER` | Пользователь БД | `gidede` | Нет |
| `DB_PASSWORD` | Пароль БД | `changeme_secure_password` | Да |
| `DB_POOL_SIZE` | Размер пула соединений | `20` | Нет (default: 20) |
| `DB_MAX_OVERFLOW` | Максимальное переполнение пула | `10` | Нет (default: 10) |
| `DB_SSL_MODE` | Режим SSL для подключения | `prefer` | Нет (default: prefer) |

### Redis

| Переменная | Описание | Пример значения | Обязательная |
|-----------|----------|----------------|-------------|
| `REDIS_URL` | Строка подключения к Redis | `redis://localhost:6379/0` | Да |
| `REDIS_HOST` | Хост Redis | `localhost` | Нет |
| `REDIS_PORT` | Порт Redis | `6379` | Нет |
| `REDIS_PASSWORD` | Пароль Redis | `` (пусто для разработки) | Рекомендуется в prod |
| `REDIS_DB` | Номер БД Redis | `0` | Нет (default: 0) |
| `REDIS_CACHE_TTL` | TTL кэша AI-промптов (секунды) | `3600` | Нет (default: 3600) |

### AI APIs

| Переменная | Описание | Пример значения | Обязательная |
|-----------|----------|----------------|-------------|
| `OPENAI_API_KEY` | Ключ API OpenAI | `sk-...` | Да |
| `OPENAI_ORG_ID` | ID организации OpenAI | `org-...` | Нет |
| `OPENAI_MODEL_PRIMARY` | Основная модель OpenAI | `gpt-4` | Нет (default: gpt-4) |
| `OPENAI_MODEL_FALLBACK` | Fallback-модель OpenAI | `gpt-3.5-turbo` | Нет (default: gpt-3.5-turbo) |
| `ANTHROPIC_API_KEY` | Ключ API Anthropic | `sk-ant-...` | Да |
| `ANTHROPIC_MODEL_PRIMARY` | Основная модель Anthropic | `claude-3-5-sonnet-20241022` | Нет |
| `ANTHROPIC_MODEL_FALLBACK` | Fallback-модель Anthropic | `claude-3-haiku-20240307` | Нет |
| `AI_TIMEOUT_SECONDS` | Таймаут AI-запросов (секунды) | `30` | Нет (default: 30) |
| `AI_MAX_RETRIES` | Максимум попыток при ошибке AI | `2` | Нет (default: 2) |
| `AI_CACHE_ENABLED` | Включить кэширование AI-промптов | `true` | Нет (default: true) |
| `Z_AI_SDK_KEY` | Ключ z-ai-web-dev-sdk | `` | Нет (опционально) |

### Auth (NextAuth.js)

| Переменная | Описание | Пример значения | Обязательная |
|-----------|----------|----------------|-------------|
| `NEXTAUTH_SECRET` | Секретный ключ для подписи JWT | `openssl rand -base64 32` | Да |
| `NEXTAUTH_URL` | URL приложения для NextAuth | `http://localhost:3000` | Да |
| `GOOGLE_CLIENT_ID` | ID клиента Google OAuth | `...apps.googleusercontent.com` | Нет |
| `GOOGLE_CLIENT_SECRET` | Секрет клиента Google OAuth | `GOCSPX-...` | Нет |
| `GITHUB_CLIENT_ID` | ID клиента GitHub OAuth | `Iv1...` | Нет |
| `GITHUB_CLIENT_SECRET` | Секрет клиента GitHub OAuth | `...` | Нет |

### App

| Переменная | Описание | Пример значения | Обязательная |
|-----------|----------|----------------|-------------|
| `NODE_ENV` | Режим окружения | `development` / `production` | Да |
| `APP_URL` | Базовый URL приложения | `http://localhost:3000` | Да |
| `API_URL` | Базовый URL Backend API | `http://localhost:8000` | Да |
| `APP_NAME` | Название приложения | `Gidede` | Нет |
| `APP_VERSION` | Версия приложения | `1.0.0` | Нет |
| `LOG_LEVEL` | Уровень логирования | `info` / `debug` / `warning` | Нет (default: info) |
| `CORS_ORIGINS` | Разрешённые CORS-источники | `http://localhost:3000` | Да |
| `UPLOAD_MAX_SIZE_MB` | Макс. размер загружаемого файла | `10` | Нет (default: 10) |
| `SENTRY_DSN` | DSN Sentry для отслеживания ошибок | `https://...@sentry.io/...` | Нет |

### Пример `.env` файла

```bash
# ===== Database =====
DATABASE_URL=postgresql://gidede:changeme@localhost:5432/gidede
DB_PASSWORD=changeme

# ===== Redis =====
REDIS_URL=redis://localhost:6379/0

# ===== AI APIs =====
OPENAI_API_KEY=sk-your-openai-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
AI_CACHE_ENABLED=true

# ===== Auth =====
NEXTAUTH_SECRET=your-nextauth-secret-min-32-chars
NEXTAUTH_URL=http://localhost:3000

# ===== App =====
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
LOG_LEVEL=debug
CORS_ORIGINS=http://localhost:3000
```

---

## 4. Локальная разработка

### 4.1 Клонирование репозитория

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede
```

### 4.2 Установка зависимостей

#### Frontend (Next.js)

```bash
cd frontend
npm install
```

#### Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Linux/macOS
# venv\Scripts\activate    # Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt   # dev-зависимости (pytest, ruff, mypy)
```

### 4.3 Настройка `.env` файла

```bash
cp .env.example .env
```

Отредактируйте `.env`, указав актуальные значения (см. раздел [Переменные окружения](#3-переменные-окружения)).

Минимально обязательные переменные для локальной разработки:

```bash
DATABASE_URL=postgresql://gidede:changeme@localhost:5432/gidede
REDIS_URL=redis://localhost:6379/0
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NEXTAUTH_SECRET=dev-secret-change-in-production
NEXTAUTH_URL=http://localhost:3000
NODE_ENV=development
APP_URL=http://localhost:3000
API_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:3000
```

### 4.4 Запуск PostgreSQL и Redis через Docker Compose

Для локальной разработки используйте упрощённый `docker-compose.dev.yml`, который поднимает только инфраструктурные сервисы:

```bash
docker compose -f docker-compose.dev.yml up -d
```

**docker-compose.dev.yml**:

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: gidede-postgres-dev
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: gidede
      POSTGRES_USER: gidede
      POSTGRES_PASSWORD: changeme
    volumes:
      - postgres_data_dev:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gidede"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: gidede-redis-dev
    ports:
      - "6379:6379"
    volumes:
      - redis_data_dev:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data_dev:
  redis_data_dev:
```

Проверка доступности сервисов:

```bash
# PostgreSQL
docker exec gidede-postgres-dev pg_isready -U gidede

# Redis
docker exec gidede-redis-dev redis-cli ping
# Ожидаемый ответ: PONG
```

### 4.5 Миграции БД

Backend использует Alembic для управления миграциями:

```bash
cd backend
source venv/bin/activate

# Применить все миграции
alembic upgrade head

# Создать новую миграцию (после изменения моделей)
alembic revision --autogenerate -m "описание_изменения"

# Откатить последнюю миграцию
alembic downgrade -1

# Посмотреть текущую версию
alembic current
```

### 4.6 Запуск Backend (uvicorn)

```bash
cd backend
source venv/bin/activate

# Режим разработки (автоперезагрузка)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# С указанием .env файла
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --env-file ../.env
```

Проверка:

```bash
curl http://localhost:8000/health
# Ожидаемый ответ: {"status": "ok", "version": "1.0.0"}
```

Документация API доступна по адресам:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4.7 Запуск Frontend (npm run dev)

```bash
cd frontend

# Режим разработки
npm run dev

# С указанием порта
npm run dev -- -p 3000
```

Приложение будет доступно по адресу: `http://localhost:3000`

### 4.8 Полная команда запуска (одним скриптом)

Для удобства можно использовать скрипт `dev.sh`:

```bash
#!/bin/bash
# dev.sh — Запуск локальной среды разработки Gidede

set -e

echo "=== Gidede Dev Startup ==="

# 1. Запуск инфраструктуры
echo "[1/4] Starting PostgreSQL and Redis..."
docker compose -f docker-compose.dev.yml up -d

# 2. Ожидание готовности
echo "[2/4] Waiting for services..."
sleep 3

# 3. Миграции
echo "[3/4] Running migrations..."
cd backend
source venv/bin/activate
alembic upgrade head
cd ..

# 4. Запуск сервисов (в фоне)
echo "[4/4] Starting backend and frontend..."
(cd backend && source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "=== Gidede is running ==="
echo "Frontend: http://localhost:3000"
echo "Backend:  http://localhost:8000"
echo "API Docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
```

---

## 5. Docker-деплой (production)

### 5.1 Dockerfile для Frontend

```dockerfile
# ===== Stage 1: Dependencies =====
FROM node:20-alpine AS deps
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --only=production

# ===== Stage 2: Build =====
FROM node:20-alpine AS builder
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ===== Stage 3: Runtime =====
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
```

> **Примечание**: Для `standalone`-режима в `next.config.js` необходимо указать `output: 'standalone'`.

### 5.2 Dockerfile для Backend

```dockerfile
# ===== Stage 1: Dependencies =====
FROM python:3.12-slim AS deps
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ===== Stage 2: Runtime =====
FROM python:3.12-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r gidede && useradd -r -g gidede gidede

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin/uvicorn /usr/local/bin/uvicorn
COPY backend/ .

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

USER gidede

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### 5.3 docker-compose.yml (production — полный стек)

```yaml
version: "3.9"

services:
  # ===== Frontend =====
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    container_name: gidede-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${APP_URL}
      - NEXT_PUBLIC_API_URL=${API_URL}
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - gidede-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s

  # ===== Backend =====
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    container_name: gidede-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - AI_CACHE_ENABLED=${AI_CACHE_ENABLED:-true}
      - AI_TIMEOUT_SECONDS=${AI_TIMEOUT_SECONDS:-30}
      - AI_MAX_RETRIES=${AI_MAX_RETRIES:-2}
      - NODE_ENV=${NODE_ENV:-production}
      - LOG_LEVEL=${LOG_LEVEL:-info}
      - CORS_ORIGINS=${CORS_ORIGINS}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - backend_uploads:/app/uploads
    networks:
      - gidede-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 15s

  # ===== PostgreSQL =====
  postgres:
    image: postgres:16-alpine
    container_name: gidede-postgres
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${DB_NAME:-gidede}
      POSTGRES_USER: ${DB_USER:-gidede}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - gidede-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-gidede}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  # ===== Redis =====
  redis:
    image: redis:7-alpine
    container_name: gidede-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    command: >
      redis-server
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      ${REDIS_PASSWORD:+--requirepass ${REDIS_PASSWORD}}
    volumes:
      - redis_data:/data
    networks:
      - gidede-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ===== Nginx (Reverse Proxy) =====
  nginx:
    image: nginx:1.27-alpine
    container_name: gidede-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - nginx_logs:/var/log/nginx
    depends_on:
      frontend:
        condition: service_healthy
      backend:
        condition: service_healthy
    networks:
      - gidede-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  backend_uploads:
    driver: local
  nginx_logs:
    driver: local

networks:
  gidede-network:
    driver: bridge
```

### 5.4 Настройка volumes

По умолчанию Docker Compose создаёт named volumes. Для production рекомендуется использовать bind mounts или внешние хранилища:

```yaml
volumes:
  postgres_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/gidede/postgres
  redis_data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/gidede/redis
```

Убедитесь, что директории существуют и имеют правильные права:

```bash
sudo mkdir -p /data/gidede/{postgres,redis}
sudo chown -R 999:999 /data/gidede/postgres   # UID postgres в контейнере
sudo chown -R 999:999 /data/gidede/redis       # UID redis в контейнере
```

### 5.5 Настройка networks

Все сервисы находятся в единой bridge-сети `gidede-network`. Для изоляции в production можно разделить на подсети:

```yaml
networks:
  gidede-frontend:    # Nginx ↔ Frontend
    driver: bridge
  gidede-backend:     # Frontend ↔ Backend ↔ PostgreSQL/Redis
    driver: bridge
    internal: true     # Без доступа к внешней сети
```

### 5.6 Конфигурация Nginx

```nginx
# nginx/nginx.conf

upstream frontend {
    server frontend:3000;
}

upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name _;

    # Редирект HTTP → HTTPS (раскомментировать в production)
    # return 301 https://$host$request_uri;

    # Для разработки без SSL
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Таймауты для AI-эндпоинтов (могут быть долгими)
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    location /docs {
        proxy_pass http://backend;
    }

    location /redoc {
        proxy_pass http://backend;
    }

    location /health {
        proxy_pass http://backend;
        access_log off;
    }
}

# ===== HTTPS (production) =====
# server {
#     listen 443 ssl http2;
#     server_name gidede.example.com;
#
#     ssl_certificate /etc/nginx/ssl/fullchain.pem;
#     ssl_certificate_key /etc/nginx/ssl/privkey.pem;
#     ssl_protocols TLSv1.2 TLSv1.3;
#     ssl_ciphers HIGH:!aNULL:!MD5;
#     ssl_prefer_server_ciphers on;
#     ssl_session_cache shared:SSL:10m;
#     ssl_session_timeout 10m;
#
#     # Security headers
#     add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
#     add_header X-Frame-Options "SAMEORIGIN" always;
#     add_header X-Content-Type-Options "nosniff" always;
#     add_header X-XSS-Protection "1; mode=block" always;
#     add_header Referrer-Policy "strict-origin-when-cross-origin" always;
#
#     # Gzip
#     gzip on;
#     gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
#     gzip_min_length 256;
#
#     # Статика Next.js (с кэшированием)
#     location /_next/static/ {
#         proxy_pass http://frontend;
#         expires 365d;
#         add_header Cache-Control "public, immutable";
#     }
#
#     location / {
#         proxy_pass http://frontend;
#         proxy_http_version 1.1;
#         proxy_set_header Upgrade $http_upgrade;
#         proxy_set_header Connection "upgrade";
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#     }
#
#     location /api/ {
#         proxy_pass http://backend;
#         proxy_http_version 1.1;
#         proxy_set_header Host $host;
#         proxy_set_header X-Real-IP $remote_addr;
#         proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
#         proxy_set_header X-Forwarded-Proto $scheme;
#         proxy_read_timeout 60s;
#         proxy_connect_timeout 10s;
#
#         # Rate limiting для AI-эндпоинтов
#         limit_req zone=ai_api burst=10 nodelay;
#     }
# }
```

### 5.7 Запуск production-деплоя

```bash
# Сборка образов
docker compose build

# Запуск всех сервисов
docker compose up -d

# Проверка статуса
docker compose ps

# Просмотр логов
docker compose logs -f

# Остановка
docker compose down

# Остановка с удалением данных (ВНИМАНИЕ!)
docker compose down -v
```

### 5.8 Миграции при деплое

Миграции запускаются перед стартом backend. Добавьте init-контейнер или выполните вручную:

```bash
# Вручную перед первым запуском
docker compose run --rm backend alembic upgrade head

# Или через команду exec на запущенном контейнере
docker compose exec backend alembic upgrade head
```

Для автоматизации можно добавить entrypoint-скрипт в Backend:

```bash
#!/bin/bash
# backend/entrypoint.sh
set -e

echo "Running migrations..."
alembic upgrade head

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 6. CI/CD Pipeline

### 6.1 Рекомендуемый workflow — GitHub Actions

Создайте файл `.github/workflows/ci.yml`:

```yaml
name: Gidede CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

env:
  DOCKER_REGISTRY: ghcr.io
  IMAGE_PREFIX: ${{ github.repository }}

jobs:
  # ===== Этап 1: Lint =====
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - name: Install frontend deps
        run: cd frontend && npm ci

      - name: Install backend deps
        run: cd backend && pip install -r requirements.txt -r requirements-dev.txt

      - name: Lint frontend (ESLint + TypeScript)
        run: cd frontend && npm run lint

      - name: Lint backend (Ruff)
        run: cd backend && ruff check .

      - name: Type check backend (mypy)
        run: cd backend && mypy app/

  # ===== Этап 2: Test =====
  test:
    name: Test
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: gidede_test
          POSTGRES_USER: gidede
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip
          cache-dependency-path: backend/requirements.txt

      - name: Install deps
        run: |
          cd frontend && npm ci
          cd ../backend && pip install -r requirements.txt -r requirements-dev.txt

      - name: Test backend
        env:
          DATABASE_URL: postgresql://gidede:test_password@localhost:5432/gidede_test
          REDIS_URL: redis://localhost:6379/0
          NODE_ENV: test
        run: cd backend && pytest --cov=app --cov-report=xml -v

      - name: Test frontend
        run: cd frontend && npm run test -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: backend/coverage.xml,frontend/coverage/lcov.info

  # ===== Этап 3: Build =====
  build:
    name: Build & Push Docker Images
    runs-on: ubuntu-latest
    needs: test
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.DOCKER_REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build & push frontend
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.frontend
          push: true
          tags: |
            ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_PREFIX }}/frontend:${{ github.sha }}
            ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_PREFIX }}/frontend:latest

      - name: Build & push backend
        uses: docker/build-push-action@v6
        with:
          context: .
          file: Dockerfile.backend
          push: true
          tags: |
            ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_PREFIX }}/backend:${{ github.sha }}
            ${{ env.DOCKER_REGISTRY }}/${{ env.IMAGE_PREFIX }}/backend:latest

  # ===== Этап 4: Deploy =====
  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to staging server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: ${{ secrets.STAGING_USER }}
          key: ${{ secrets.STAGING_SSH_KEY }}
          script: |
            cd /opt/gidede
            docker compose pull
            docker compose up -d
            docker compose exec -T backend alembic upgrade head

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to production server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: ${{ secrets.PRODUCTION_USER }}
          key: ${{ secrets.PRODUCTION_SSH_KEY }}
          script: |
            cd /opt/gidede
            docker compose pull
            docker compose up -d
            docker compose exec -T backend alembic upgrade head
            echo "Deployment complete at $(date)"
```

### 6.2 Структура окружений

| Окружение | Ветка | URL | Назначение |
|-----------|-------|-----|------------|
| Development | `feature/*` | `http://localhost:3000` | Локальная разработка |
| Staging | `develop` | `https://staging.gidede.app` | Тестирование перед продом |
| Production | `main` | `https://gidede.app` | Рабочая среда |

### 6.3 GitHub Secrets (обязательные)

| Секрет | Описание |
|--------|----------|
| `STAGING_HOST` | IP/hostname staging-сервера |
| `STAGING_USER` | SSH-пользователь для staging |
| `STAGING_SSH_KEY` | SSH-ключ для staging |
| `PRODUCTION_HOST` | IP/hostname production-сервера |
| `PRODUCTION_USER` | SSH-пользователь для production |
| `PRODUCTION_SSH_KEY` | SSH-ключ для production |

---

## 7. Мониторинг и логирование

### 7.1 Health Check эндпоинты

Каждый сервис предоставляет эндпоинт для проверки здоровья:

| Сервис | Эндпоинт | Метод | Формат ответа |
|--------|---------|-------|---------------|
| Frontend | `/api/health` | GET | `{"status": "ok"}` |
| Backend | `/health` | GET | `{"status": "ok", "version": "1.0.0", "db": "ok", "redis": "ok"}` |
| Backend (детально) | `/health/detailed` | GET | Статус всех зависимостей + время отклика |
| Nginx | `/health` | GET | Проксируется на Backend |

**Пример ответа `/health/detailed`**:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime_seconds": 86400,
  "checks": {
    "database": {
      "status": "ok",
      "latency_ms": 3
    },
    "redis": {
      "status": "ok",
      "latency_ms": 1
    },
    "openai_api": {
      "status": "ok",
      "latency_ms": 520
    },
    "anthropic_api": {
      "status": "ok",
      "latency_ms": 680
    }
  }
}
```

### 7.2 Структура логов

Все логи выводятся в stdout/stderr в JSON-формате для удобной обработки:

**Backend (FastAPI + structlog)**:

```json
{
  "timestamp": "2026-03-05T12:00:00.000Z",
  "level": "info",
  "logger": "app.services.concept",
  "message": "Concept generated successfully",
  "request_id": "a1b2c3d4",
  "user_id": "user_123",
  "project_id": "proj_456",
  "module": "concept_generator",
  "prompt_id": "CLASSIFY_GENRE",
  "model_used": "claude-3-haiku",
  "latency_ms": 1250,
  "tokens_used": {"input": 200, "output": 300},
  "cost_usd": 0.003
}
```

**Frontend (Next.js)**:

```json
{
  "timestamp": "2026-03-05T12:00:00.000Z",
  "level": "info",
  "service": "frontend",
  "message": "Page rendered",
  "path": "/concept-generator",
  "method": "GET",
  "status_code": 200,
  "duration_ms": 85
}
```

### 7.3 Метрики (Prometheus + Grafana)

#### Рекомендуемая конфигурация Prometheus

Добавьте сервис в `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:v2.54.0
    container_name: gidede-prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - gidede-network

  grafana:
    image: grafana/grafana:11.3.0
    container_name: gidede-grafana
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD:-admin}
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources:ro
    networks:
      - gidede-network
```

#### Prometheus config (`monitoring/prometheus.yml`)

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: "gidede-backend"
    metrics_path: "/metrics"
    static_configs:
      - targets: ["backend:8000"]

  - job_name: "gidede-postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "gidede-redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: "gidede-nginx"
    static_configs:
      - targets: ["nginx-exporter:9113"]
```

#### Ключевые метрики для отслеживания

| Метрика | Тип | Описание |
|---------|-----|----------|
| `http_requests_total` | Counter | Общее количество HTTP-запросов |
| `http_request_duration_seconds` | Histogram | Время обработки запросов |
| `ai_prompt_requests_total` | Counter | Количество AI-вызовов (по prompt_id, model) |
| `ai_prompt_duration_seconds` | Histogram | Время AI-вызовов |
| `ai_prompt_cost_usd` | Counter | Стоимость AI-вызовов в USD |
| `ai_prompt_cache_hits_total` | Counter | Попадания в кэш AI-промптов |
| `ai_prompt_cache_misses_total` | Counter | Промахи кэша AI-промптов |
| `db_query_duration_seconds` | Histogram | Время запросов к БД |
| `redis_command_duration_seconds` | Histogram | Время операций Redis |
| `project_state_updates_total` | Counter | Обновления Project State |
| `active_users_gauge` | Gauge | Количество активных пользователей |

#### Рекомендуемые алерты

| Альт | Условие | Действие |
|------|---------|----------|
| BackendDown | `up{job="gidede-backend"} == 0` в течение 2 мин | PagerDuty / Telegram |
| HighErrorRate | `rate(http_requests_total{status=~"5.."}[5m]) > 0.05` | Email |
| AILatencyHigh | `histogram_quantile(0.95, ai_prompt_duration_seconds) > 30` | Email |
| AICostAnomaly | `rate(ai_prompt_cost_usd[1h]) > $5/hour` | Email |
| DBConnectionsExhausted | `pg_stat_activity_count > 90` (при pool=100) | PagerDuty |
| RedisMemoryHigh | `redis_memory_used_bytes / redis_memory_max_bytes > 0.9` | Email |
| DiskSpaceLow | `node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1` | PagerDuty |

---

## 8. Масштабирование

### 8.1 Горизонтальное масштабирование

#### Frontend (Next.js)

Frontend является stateless и масштабируется простым увеличением количества реплик:

```yaml
  frontend:
    # ... (другие настройки)
    deploy:
      replicas: 2
      resources:
        limits:
          cpus: "1.0"
          memory: 512M
        reservations:
          cpus: "0.25"
          memory: 256M
```

#### Backend (FastAPI)

Backend также stateless (состояние хранится в PostgreSQL и Redis). Масштабирование через реплики:

```yaml
  backend:
    # ... (другие настройки)
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: "2.0"
          memory: 1G
        reservations:
          cpus: "0.5"
          memory: 512M
```

#### Load Balancer

При нескольких репликах Nginx балансирует нагрузку:

```nginx
upstream frontend {
    least_conn;
    server frontend_1:3000;
    server frontend_2:3000;
}

upstream backend {
    least_conn;
    server backend_1:8000;
    server backend_2:8000;
    server backend_3:8000;
}
```

Для более крупных деплоев рекомендуется использовать внешний load balancer (AWS ALB, Cloudflare, HAProxy).

#### PostgreSQL

Вертикальное масштабирование (увеличение ресурсов) — основной подход. Для read-heavy нагрузок:

- **Read Replicas**: Настроить реплику только для чтения
- **Connection Pooler**: PgBouncer перед PostgreSQL

```yaml
  pgbouncer:
    image: edoburu/pgbouncer:v1.23.0
    container_name: gidede-pgbouncer
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - POOL_MODE=transaction
      - MAX_CLIENT_CONN=200
      - DEFAULT_POOL_SIZE=25
    depends_on:
      - postgres
    networks:
      - gidede-network
```

### 8.2 Кэширование

#### Redis для AI-промптов

Кэширование AI-промптов — ключевая оптимизация, снижающая стоимость и задержку:

```
┌──────────────────────────────────────────────────┐
│               ПРОМПТ-КЭШ (Redis)                  │
│                                                    │
│  Ключ: gidede:prompt_cache:{hash(inputs)}         │
│  Значение: JSON-результат AI-вызова                │
│  TTL: зависит от типа промпта (900—3600 сек)       │
│                                                    │
│  Кэшируемые (TTL):                                 │
│  - CLASSIFY_GENRE          → 3600 сек (1 час)     │
│  - EXTRACT_AESTHETICS      → 1800 сек (30 мин)    │
│  - ESTIMATE_WEIGHTS        → 1800 сек              │
│  - APPLY_LENS_*            → 900 сек (15 мин)      │
│  - CHECK_PROGRESSION_*     → 900 сек               │
│                                                    │
│  Некэшируемые:                                     │
│  - GENERATE_CORE_LOOPS    → каждый вызов уникален  │
│  - GENERATE_USP           → каждый вызов уникален  │
│  - GENERATE_CHARACTERS_*  → каждый вызов уникален  │
└──────────────────────────────────────────────────┘
```

Ожидаемое попадание в кэш: 30-50% (при типичной сессии с итерациями).

#### Кэширование на уровне HTTP

Nginx кэширует статику и SSR-страницы:

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=gidede_cache:10m 
                max_size=100m inactive=60m use_temp_path=off;

location /_next/static/ {
    proxy_pass http://frontend;
    proxy_cache gidede_cache;
    expires 365d;
    add_header Cache-Control "public, immutable";
}

location /api/concept/ {
    proxy_pass http://backend;
    proxy_cache gidede_cache;
    proxy_cache_valid 200 10m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    add_header X-Cache-Status $upstream_cache_status;
}
```

### 8.3 CDN для статики

Для production рекомендуется использовать CDN (Cloudflare, AWS CloudFront, или Vercel) для раздачи статики Next.js:

1. **`/_next/static/`** — JS/CSS-бандлы (immutable, cache: 1 год)
2. **`/public/`** — Изображения, шрифты, иконки
3. **Media-файлы** — Загруженные пользователями файлы

Конфигурация Cloudflare (пример):

```
Cache Rule: /_next/static/*
  - Edge Cache TTL: 1 year
  - Browser Cache TTL: 1 year
  
Cache Rule: /api/*
  - Edge Cache TTL: bypass
  - Browser Cache TTL: no-cache
```

---

## 9. Резервное копирование

### 9.1 База данных: pg_dump + S3

#### Скрипт бэкапа PostgreSQL

```bash
#!/bin/bash
# scripts/backup-postgres.sh

set -euo pipefail

# Настройки
DB_NAME="${DB_NAME:-gidede}"
DB_USER="${DB_USER:-gidede}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="/tmp/gidede-backups"
S3_BUCKET="${S3_BUCKET:-s3://gidede-backups}"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
FILENAME="gidede_${DATE}.sql.gz"

echo "=== PostgreSQL Backup: ${DATE} ==="

# Создание директории
mkdir -p "${BACKUP_DIR}"

# Дамп БД
echo "[1/3] Creating dump..."
docker exec gidede-postgres pg_dump \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  --format=custom \
  --compress=9 \
  > "${BACKUP_DIR}/${FILENAME}"

# Размер файла
SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "Backup size: ${SIZE}"

# Загрузка в S3
echo "[2/3] Uploading to S3..."
if command -v aws &> /dev/null; then
    aws s3 cp "${BACKUP_DIR}/${FILENAME}" "${S3_BUCKET}/postgres/${FILENAME}"
    echo "Uploaded to ${S3_BUCKET}/postgres/${FILENAME}"
else
    echo "WARNING: aws CLI not found. Skipping S3 upload."
    echo "Backup saved locally: ${BACKUP_DIR}/${FILENAME}"
fi

# Очистка старых бэкапов (хранить 30 дней)
echo "[3/3] Cleaning old backups..."
find "${BACKUP_DIR}" -name "gidede_*.sql.gz" -mtime +30 -delete

# Очистка старых бэкапов в S3 (хранить 90 дней)
if command -v aws &> /dev/null; then
    aws s3 ls "${S3_BUCKET}/postgres/" | while read -r line; do
        FILE_DATE=$(echo "${line}" | awk '{print $1}' | tr -d '-')
        CUTOFF_DATE=$(date -d "90 days ago" +%Y%m%d)
        if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
            OLD_FILE=$(echo "${line}" | awk '{print $4}')
            aws s3 rm "${S3_BUCKET}/postgres/${OLD_FILE}"
            echo "Deleted old S3 backup: ${OLD_FILE}"
        fi
    done
fi

echo "=== Backup complete ==="
```

#### Восстановление из бэкапа

```bash
# Скачивание из S3
aws s3 cp s3://gidede-backups/postgres/gidede_2026-03-05_03-00-00.sql.gz /tmp/

# Восстановление
docker exec -i gidede-postgres pg_restore \
  -U gidede \
  -d gidede \
  --clean \
  --if-exists \
  < /tmp/gidede_2026-03-05_03-00-00.sql.gz
```

### 9.2 Redis: RDB Snapshots

Redis настроен на автоматические RDB-снимки. Конфигурация:

```
# redis.conf (добавить через volume mount)
save 900 1       # Сохранить через 15 мин, если есть хотя бы 1 изменение
save 300 10      # Сохранить через 5 мин, если есть 10 изменений
save 60 10000    # Сохранить через 1 мин, если есть 10000 изменений
appendonly yes   # Включить AOF для долговечности
appendfsync everysec
```

Ручной снимок:

```bash
docker exec gidede-redis redis-cli BGSAVE
```

Бэкап RDB-файла:

```bash
#!/bin/bash
# scripts/backup-redis.sh

DATE=$(date +%Y-%m-%d_%H-%M-%Z)
S3_BUCKET="${S3_BUCKET:-s3://gidede-backups}"

# Инициировать BGSAVE
docker exec gidede-redis redis-cli BGSAVE

# Подождать завершения
sleep 5

# Копировать RDB-файл
docker cp gidede-redis:/data/dump.rdb "/tmp/redis_dump_${DATE}.rdb"

# Загрузить в S3
if command -v aws &> /dev/null; then
    aws s3 cp "/tmp/redis_dump_${DATE}.rdb" "${S3_BUCKET}/redis/redis_dump_${DATE}.rdb"
fi
```

### 9.3 Расписание бэкапов (cron)

```cron
# /etc/cron.d/gidede-backups

# Ежедневный бэкап PostgreSQL в 03:00
0 3 * * * gidede /opt/gidede/scripts/backup-postgres.sh >> /var/log/gidede/backup.log 2>&1

# Ежедневный бэкап Redis в 03:30
30 3 * * * gidede /opt/gidede/scripts/backup-redis.sh >> /var/log/gidede/backup.log 2>&1

# Еженедельный полный бэкап (воскресенье 02:00)
0 2 * * 0 gidede /opt/gidede/scripts/backup-full.sh >> /var/log/gidede/backup.log 2>&1
```

### 9.4 Сводная таблица бэкапов

| Данные | Метод | Частота | Хранение | Место |
|--------|-------|---------|----------|-------|
| PostgreSQL | `pg_dump --format=custom` | Ежедневно (03:00) | 30 дней локально / 90 дней S3 | S3 + локально |
| Redis RDB | `BGSAVE` + копирование файла | Ежедневно (03:30) | 7 дней | S3 |
| Docker volumes | `tar` архив | Еженедельно | 14 дней | S3 |
| Конфигурация | Git-репозиторий | При каждом изменении | Бесконечно | GitHub |

---

## 10. Устранение неполадок

### 10.1 Частые проблемы и решения

#### Проблема: Backend не может подключиться к PostgreSQL

**Симптомы**: Ошибка `psycopg.OperationalError: connection refused` в логах backend.

**Решение**:
```bash
# 1. Проверить, что PostgreSQL запущен
docker compose ps postgres

# 2. Проверить health check
docker exec gidede-postgres pg_isready -U gidede

# 3. Проверить DATABASE_URL
docker compose exec backend env | grep DATABASE_URL

# 4. Проверить сетевую связность
docker compose exec backend ping postgres

# 5. Если используется Docker Compose, убедитесь, что
#    DATABASE_URL указывает на имя сервиса (postgres),
#    а не на localhost:
#    ПРАВИЛЬНО: postgresql://gidede:pass@postgres:5432/gidede
#    НЕПРАВИЛЬНО: postgresql://gidede:pass@localhost:5432/gidede
```

---

#### Проблема: Redis Connection Refused

**Симптомы**: Ошибка `redis.exceptions.ConnectionError` в логах backend.

**Решение**:
```bash
# 1. Проверить статус Redis
docker compose ps redis

# 2. Проверить подключение
docker exec gidede-redis redis-cli ping

# 3. Проверить REDIS_URL (внутри Docker сети используйте имя сервиса)
#    ПРАВИЛЬНО: redis://redis:6379/0
#    НЕПРАВИЛЬНО: redis://localhost:6379/0

# 4. Если Redis с паролем:
docker exec gidede-redis redis-cli -a YOUR_PASSWORD ping
```

---

#### Проблема: AI API возвращает ошибки 429 (Rate Limit)

**Симптомы**: `openai.RateLimitError` или `anthropic.RateLimitError` в логах.

**Решение**:
```bash
# 1. Проверить текущее использование API
#    OpenAI: https://platform.openai.com/usage
#    Anthropic: https://console.anthropic.com/settings/usage

# 2. Включить кэширование AI-промптов (если выключено)
AI_CACHE_ENABLED=true

# 3. Увеличить задержку между запросами (если необходимо)
#    Добавить в backend/app/core/ai_client.py:
#    rate_limit_delay = 1.0  # секунда между запросами

# 4. Рассмотреть переход на более высокий тарифный план API

# 5. Использовать fallback-модели для снижения нагрузки
#    Классификация/оценка → Haiku/GPT-3.5
#    Генерация/анализ → Sonnet/GPT-4
```

---

#### Проблема: Frontend не может достучаться до Backend API

**Симптомы**: Ошибка `Network Error` или CORS-ошибка в консоли браузера.

**Решение**:
```bash
# 1. Проверить CORS_ORIGINS в .env
#    Должен включать URL фронтенда:
#    CORS_ORIGINS=http://localhost:3000,https://gidede.app

# 2. Проверить NEXT_PUBLIC_API_URL
#    Должен указывать на доступный URL backend:
#    Для разработки: http://localhost:8000
#    Для production: https://gidede.app/api

# 3. Проверить Nginx-конфигурацию:
#    /api/ должен проксироваться на backend

# 4. Проверить, что Backend запущен:
curl http://localhost:8000/health
```

---

#### Проблема: Миграции не применяются / Ошибка Alembic

**Симптомы**: `alembic.util.exc.CommandError` или `sqlalchemy.exc.ProgrammingError`.

**Решение**:
```bash
# 1. Проверить текущую версию
docker compose exec backend alembic current

# 2. Проверить историю миграций
docker compose exec backend alembic history

# 3. Если миграция «застряла»:
#    Пометить текущую версию как применённую (ВНИМАНИЕ: только если уверены)
docker compose exec backend alembic stamp head

# 4. Если нужна чистая установка:
docker compose exec backend alembic downgrade base
docker compose exec backend alembic upgrade head

# 5. Пересоздать БД с нуля (УДАЛЯЕТ ВСЕ ДАННЫЕ):
docker compose down -v  # Удаляет volumes
docker compose up -d postgres
docker compose exec backend alembic upgrade head
```

---

#### Проблема: Высокое потребление памяти Redis

**Симптомы**: `OOM command not allowed when used memory > 'maxmemory'` в логах Redis.

**Решение**:
```bash
# 1. Проверить использование памяти
docker exec gidede-redis redis-cli info memory

# 2. Увеличить maxmemory в конфигурации Redis:
#    --maxmemory 512mb

# 3. Проверить политику удаления (должна быть allkeys-lru):
docker exec gidede-redis redis-cli config get maxmemory-policy

# 4. Очистить кэш AI-промптов (если необходимо):
docker exec gidede-redis redis-cli --scan --pattern "gidede:prompt_cache:*" | \
  xargs -L 1000 docker exec -i gidede-redis redis-cli del

# 5. Полная очистка Redis (ОСТОРОЖНО!):
docker exec gidede-redis redis-cli FLUSHALL
```

---

#### Проблема: Nginx возвращает 502 Bad Gateway

**Симптомы**: Все запросы возвращают 502.

**Решение**:
```bash
# 1. Проверить, что backend и frontend запущены
docker compose ps

# 2. Проверить логи Nginx
docker compose logs nginx --tail 50

# 3. Проверить логи backend
docker compose logs backend --tail 50

# 4. Проверить конфигурацию upstream в nginx.conf
#    Имена сервисов должны совпадать с docker-compose.yml

# 5. Перезапустить сервисы
docker compose restart nginx backend frontend
```

---

#### Проблема: Docker Compose не стартует — «port already in use»

**Симптомы**: `Error: bind: address already in use` при `docker compose up`.

**Решение**:
```bash
# Найти процесс, занимающий порт
sudo lsof -i :5432   # PostgreSQL
sudo lsof -i :6379   # Redis
sudo lsof -i :3000   # Frontend
sudo lsof -i :8000   # Backend

# Остановить конфликтующий процесс
sudo kill -9 <PID>

# Или изменить порт в docker-compose.yml:
# ports:
#   - "5433:5432"  # Использовать 5433 вместо 5432
```

---

### 10.2 Полезные команды для диагностики

```bash
# Общий статус всех сервисов
docker compose ps

# Логи конкретного сервиса (последние 100 строк)
docker compose logs --tail 100 backend

# Логи в реальном времени
docker compose logs -f backend

# Перезапуск отдельного сервиса
docker compose restart backend

# Вход в контейнер для отладки
docker compose exec backend /bin/bash
docker compose exec postgres psql -U gidede -d gidede

# Использование ресурсов контейнерами
docker stats --no-stream

# Проверка размера Docker volumes
docker volume ls
docker system df

# Очистка неиспользуемых ресурсов Docker
docker system prune -a --volumes
```

---

### 10.3 Экстренное восстановление

В случае полной потери сервера:

1. **Развернуть инфраструктуру** на новом сервере:
   ```bash
   git clone https://github.com/Angelionix/Gidede.git /opt/gidede
   cd /opt/gidede
   ```

2. **Восстановить `.env`** из безопасного хранилища (1Password, Vault и т.д.)

3. **Запустить сервисы**:
   ```bash
   docker compose up -d
   ```

4. **Восстановить БД из бэкапа**:
   ```bash
   aws s3 cp s3://gidede-backups/postgres/gidede_YYYY-MM-DD_HH-MM-SS.sql.gz /tmp/
   docker exec -i gidede-postgres pg_restore -U gidede -d gidede --clean --if-exists < /tmp/gidede_YYYY-MM-DD_HH-MM-SS.sql.gz
   ```

5. **Выполнить миграции** (на случай, если схема изменилась):
   ```bash
   docker compose exec backend alembic upgrade head
   ```

6. **Проверить работоспособность**:
   ```bash
   curl https://gidede.app/health
   ```

---

## Приложение А. Чеклист перед деплоем в production

- [ ] Все переменные окружения заданы (см. раздел 3)
- [ ] `NEXTAUTH_SECRET` сгенерирован случайно (не dev-значение)
- [ ] `NODE_ENV=production`
- [ ] SSL-сертификаты установлены и валидны
- [ ] `CORS_ORIGINS` не содержит `*`
- [ ] Пароли БД и Redis изменены со значений по умолчанию
- [ ] Бэкапы настроены и протестированы
- [ ] Health checks работают для всех сервисов
- [ ] Мониторинг и алерты настроены
- [ ] Rate limiting настроен для AI-эндпоинтов
- [ ] Security headers добавлены в Nginx
- [ ] `docker compose down -v` + восстановление из бэкапа протестировано
- [ ] Логи настроены в JSON-формате
- [ ] CDN настроен для статики (опционально)

---

## Приложение Б. Структура проекта (ожидаемая)

```
Gidede/
├── frontend/                  # Next.js 16 приложение
│   ├── src/
│   │   ├── app/               # App Router (страницы)
│   │   ├── components/        # React-компоненты
│   │   ├── lib/               # Утилиты, API-клиент
│   │   └── styles/            # Tailwind CSS
│   ├── public/                # Статические файлы
│   ├── package.json
│   └── next.config.js
├── backend/                   # Python FastAPI приложение
│   ├── app/
│   │   ├── main.py            # Точка входа FastAPI
│   │   ├── core/              # Конфигурация, безопасность, AI-клиент
│   │   ├── models/            # SQLAlchemy-модели
│   │   ├── schemas/           # Pydantic-схемы
│   │   ├── services/          # Бизнес-логика (8 модулей)
│   │   ├── api/               # REST-эндпоинты
│   │   └── prompts/           # AI-промпт-спецификации
│   ├── alembic/               # Миграции БД
│   ├── tests/                 # Тесты
│   ├── requirements.txt
│   └── requirements-dev.txt
├── nginx/                     # Конфигурация Nginx
│   ├── nginx.conf
│   └── ssl/
├── monitoring/                # Мониторинг
│   ├── prometheus.yml
│   └── grafana/
├── scripts/                   # Скрипты бэкапов и утилиты
│   ├── backup-postgres.sh
│   ├── backup-redis.sh
│   └── dev.sh
├── docker-compose.yml         # Production
├── docker-compose.dev.yml     # Development
├── Dockerfile.frontend
├── Dockerfile.backend
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
└── docs/                      # Документация
    ├── DEPLOYMENT.md           # Этот документ
    ├── ROADMAP.md
    ├── TECH_DEBT.md
    └── ...
```

---

> **Поддержка документа**: При внесении изменений в архитектуру, инфраструктуру или конфигурацию — обновите данный документ. Ответственный: команда DevOps / Lead Developer.
