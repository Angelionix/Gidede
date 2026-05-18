# Gidede — Game Design AI System

**Версия**: v.0.1.0

AI-powered система для проектирования игр. Помогает геймдизайнерам пройти путь от идеи до полноценного GDD (Game Design Document) с использованием искусственного интеллекта.

## Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| Backend | Python 3.12+ / FastAPI |
| БД основная | PostgreSQL 16 |
| Кэш / Pub-Sub | Redis 7 |
| Векторная БД | pgvector (расширение PostgreSQL) |
| AI | OpenAI API + Anthropic API + z.ai + Ollama |
| Контейнеризация | Docker + Docker Compose |

## Версионирование

Проект использует семантическое версионирование **v.X.Y.Z**:

- **X** (major) — мажорная версия; до релиза равна 0
- **Y** (minor) — минорная версия; увеличивается при добавлении нового функционала
- **Z** (patch) — патч-версия; увеличивается при доработке существующего функционала

Текущая версия указана в файле [`VERSION`](./VERSION).

## Структура проекта

```
Gidede/
├── src/                    # Frontend (Next.js 16)
├── mini-services/
│   └── api-service/        # Backend (FastAPI)
├── shared/                 # Общие типы (TypeScript + Python)
├── docs/                   # Документация
│   ├── анализ/             # Анализ книг по геймдизайну
│   ├── концепт/            # Концепция программы
│   ├── Алгоритмы/          # Алгоритмические спецификации
│   ├── архитектура/        # Архитектурные документы
│   ├── тестирование/       # Тестовая документация
│   └── bible/              # Библия геймдизайна
├── scripts/                # Скрипты (тестирование, утилиты)
├── prisma/                 # Prisma schema
├── VERSION                 # Единый источник версии
└── CHANGELOG.md            # История изменений
```

## Быстрый старт

```bash
# Клонирование
git clone https://github.com/Angelionix/Gidede.git
cd Gidede

# Запуск через Docker Compose
docker compose up -d

# Или вручную
# Backend
cd mini-services/api-service
pip install -r requirements.txt
uvicorn main:app --port 3030 --reload

# Frontend
npm install
npm run dev
```

## Документация

- [Дорожная карта Фазы 4](./docs/ROADMAP_PHASE4.md)
- [Технический долг](./docs/TECH_DEBT.md)
- [Развёртывание](./docs/DEPLOYMENT.md)
- [CHANGELOG](./CHANGELOG.md)
