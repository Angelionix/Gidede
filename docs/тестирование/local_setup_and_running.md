# Gidede — Подготовка локальной инфраструктуры и запуск тестов

> **Фаза**: 4.A.11–4.A.12  
> **Дата**: 2026-05-18  
> **Статус**: Активный

---

## 1. Требования к окружению

### 1.1 Обязательное ПО

| Компонент | Версия | Установка |
|-----------|--------|-----------|
| Python | 3.12+ | [python.org](https://python.org) |
| Node.js | 20+ | [nodejs.org](https://nodejs.org) |
| Docker Desktop | 4.25+ | [docker.com](https://docker.com) |
| Git | 2.40+ | [git-scm.com](https://git-scm.com) |

### 1.2 Рекомендуемое ПО

| Компонент | Назначение |
|-----------|-----------|
| VS Code | Редактор кода |
| Docker Compose | Локальные сервисы (PostgreSQL, Redis) |
| pgAdmin | Управление PostgreSQL |

---

## 2. Пошаговая подготовка окружения

### Шаг 1: Клонирование репозитория

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede
```

### Шаг 2: Запуск Docker-сервисов

```bash
# Запустить PostgreSQL + Redis
docker compose up -d

# Проверить статус
docker compose ps

# Ожидаемый вывод:
# gidede-postgres  running  0.0.0.0:5432->5432/tcp
# gidede-redis     running  0.0.0.0:6379->6379/tcp
```

### Шаг 3: Настройка переменных окружения

```bash
# Скопировать пример .env
cp docs/архитектура/.env.example .env

# Заполнить ключи:
# OPENAI_API_KEY=sk-your-key
# ANTHROPIC_API_KEY=sk-ant-your-key
# ZAI_API_KEY=your-zai-key
# JWT_SECRET_KEY=your-secret-key
```

### Шаг 4: Установка Python-зависимостей

```bash
cd mini-services/api-service

# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Установить зависимости
pip install fastapi uvicorn pydantic sqlalchemy asyncpg aiosqlite \
             alembic redis httpx bcrypt python-jose[cryptography] \
             pytest pytest-asyncio pytest-cov httpx ruff mypy pre-commit \
             pdfplumber

# Вернуться в корень
cd ../..
```

### Шаг 5: Установка Frontend-зависимостей

```bash
# Установить зависимости (включая vitest)
npm install

# Или если используете bun:
bun install
```

### Шаг 6: Инициализация базы данных

```bash
cd mini-services/api-service

# Применить миграции
alembic upgrade head

# Или создать таблицы без миграций (dev)
python -c "import asyncio; from app.core.database import init_db; asyncio.run(init_db())"

cd ../..
```

### Шаг 7: Установка pre-commit хуков

```bash
pip install pre-commit
pre-commit install
pre-commit run --all-files  # Проверить
```

---

## 3. Запуск тестов

### 3.1 Единый скрипт (рекомендуется)

```bash
# Все тесты (backend + frontend + линтеры)
./scripts/run_tests.sh

# Только backend
./scripts/run_tests.sh backend

# Только frontend
./scripts/run_tests.sh frontend

# Только линтеры
./scripts/run_tests.sh lint

# С покрытием кода
./scripts/run_tests.sh coverage
```

### 3.2 Backend: pytest напрямую

```bash
cd mini-services/api-service

# Активировать venv
source venv/bin/activate

# Все тесты
python -m pytest tests/ -v

# Конкретный файл
python -m pytest tests/test_auth.py -v

# Конкретный тест
python -m pytest tests/test_auth.py::test_register_user -v

# С покрытием
python -m pytest tests/ -v --cov=app --cov-report=term-missing

# HTML-отчёт покрытия
python -m pytest tests/ --cov=app --cov-report=html
# Откройте coverage_html/index.html в браузере
```

### 3.3 Frontend: vitest напрямую

```bash
# Один запуск
npx vitest run

# Watch-режим (автоматический перезапуск)
npx vitest

# С покрытием
npx vitest run --coverage

# Интерактивный UI
npx vitest --ui

# Конкретный файл
npx vitest run src/__tests__/auth.test.tsx
```

### 3.4 Синхронизация типов (4.A.12)

```bash
# Проверить синхронизацию TypeScript ↔ Python
python shared/types/sync_types.py --check

# Показать отчёт
python shared/types/sync_types.py --report
```

### 3.5 Линтеры

```bash
# Python: Ruff
cd mini-services/api-service
ruff check app/ tests/
ruff format app/ tests/ --check

# TypeScript: ESLint
npx eslint src/

# Pre-commit (все хуки)
pre-commit run --all-files
```

---

## 4. Запуск приложения для UI-тестирования

### 4.1 Запуск всех сервисов

```bash
# Терминал 1: Docker (PostgreSQL + Redis)
docker compose up -d

# Терминал 2: Backend (FastAPI)
cd mini-services/api-service
source venv/bin/activate
python main.py
# → http://localhost:3030
# → Swagger: http://localhost:3030/api/v1/docs

# Терминал 3: Frontend (Next.js)
npm run dev
# → http://localhost:3000
```

### 4.2 Проверка работоспособности

```bash
# Backend health check
curl http://localhost:3030/api/v1/health

# Frontend
open http://localhost:3000
```

### 4.3 RAG: загрузка базы знаний

```bash
cd mini-services/api-service
source venv/bin/activate

# Загрузить Библию геймдизайна (12 разделов)
python scripts/load_knowledge.py --bible

# Проверить статистику
python scripts/load_knowledge.py --stats

# Загрузить всё (библия + книги)
python scripts/load_knowledge.py --all
```

---

## 5. Типичные проблемы и решения

### 5.1 PostgreSQL не запускается

```bash
# Проверить логи
docker compose logs postgres

# Перезапустить
docker compose down
docker compose up -d

# Если порт занят
lsof -i :5432
kill -9 <PID>
```

### 5.2 Redis недоступен

```bash
# Проверить соединение
redis-cli ping
# Ожидаемый ответ: PONG

# Перезапустить
docker compose restart redis
```

### 5.3 Миграции не применяются

```bash
cd mini-services/api-service

# Проверить текущую версию
alembic current

# Откатить и применить заново
alembic downgrade base
alembic upgrade head
```

### 5.4 pytest не находит тесты

```bash
# Убедиться, что venv активирован
which python  # Должен указывать на venv

# Установить pytest-asyncio
pip install pytest-asyncio

# Проверить конфигурацию
cat pyproject.toml | grep -A5 pytest
```

### 5.5 vitest не устанавливается

```bash
# Очистить кэш
rm -rf node_modules/.cache

# Переустановить
npm install --save-dev vitest @vitejs/plugin-react jsdom \
  @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
```

---

## 6. Быстрая шпаргалка

```bash
# === Полный цикл ===
docker compose up -d              # Запустить сервисы
./scripts/run_tests.sh            # Запустить все тесты
npm run dev                       # Запустить frontend
cd mini-services/api-service && python main.py  # Запустить backend

# === Только тесты ===
python -m pytest tests/ -v        # Backend
npx vitest run                    # Frontend
pre-commit run --all-files        # Линтеры

# === С покрытием ===
python -m pytest tests/ --cov=app --cov-report=term-missing
npx vitest run --coverage

# === RAG ===
python scripts/load_knowledge.py --bible
python scripts/load_knowledge.py --stats

# === Типы ===
python shared/types/sync_types.py --check

# === Остановить всё ===
docker compose down
```
