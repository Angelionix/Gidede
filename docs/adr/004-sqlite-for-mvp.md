# ADR-004: SQLite (не PostgreSQL) для MVP

**Дата**: 2026-07-25 · **Статус**: Accepted · **Фаза**: исходное решение (Python-бэкенд), подтверждено при Next.js-порте

## Контекст

Gidede — система для геймдизайнеров: каждый пользователь работает со своими проектами, данные блочные (8 блоков × проект), AI-вызовы небыстрые (сотни мс — секунды на LLM-ответ), запись в БД происходит при сохранении блока или прогоне пайплайна (раз в минуту, не раз в миллисекунду). Типичный деплой: один Docker-контейнер на VPS, 1–50 одновременных пользователей. Варианты БД:

1. **PostgreSQL** — промышленная RDBMS, concurrent-writes, JSONB-индексы, полные типы, но требует отдельного процесса/контейнера, конфигурации пользователя/пароля, бэкап-strategy.
2. **SQLite** — встраиваемая БД, файл на диске, zero-config, один писатель (но много читателей через WAL), бэкап = копия файла.
3. **MongoDB** — документная БД, хорошо ложится на JSON-данные блоков, но другая парадигма + Prisma-поддержка слабее для сложных запросов.

## Решение

Использовать **SQLite через Prisma ORM** (`provider = "sqlite"` в `prisma/schema.prisma`). Файл БД — `db/custom.db` (путь из `DATABASE_URL=file:/path/to/custom.db`). Все 16 Prisma-моделей синхронизируются через `prisma db push` в dev и `prisma migrate deploy` в production (`package.json` scripts `db:push`, `db:migrate:deploy`).

Особенности имплементации после Фазы 4:
- `@@index([userId])` на таблицах, фильтруемых по пользователю (Project, ChatMessage, GbeSyncHistory, PlaytestResult, SavedMechanic, PrototypeGraph) — раньше был full-scan.
- FK-каскады `onDelete: Cascade` для подчинённых таблиц → Project.
- `Project.deletedAt DateTime?` + `@@index([deletedAt])` — soft-delete.
- `db.ts` singleton + environment-aware query logging (dev: `query,error,warn`; prod: `error,warn`).

## Последствия

**Положительные:**
- **Zero-config dev-setup**: `bun install && bun run db:push && bun run dev` — БД создаётся автоматически, ничего не настраивать.
- **Бэкап = `cp custom.db backup-$(date).db`** — тривиально, нет pg_dump-стратегии.
- **Один Docker-контейнер** — БД «внутри» приложения, проще оркестрация (нет `depends_on: postgres`, нет volume для PG-data).
- **Совместимость с Python-бэкендом**: оригинал тоже использовал SQLite (SQLAlchemy), миграция данных тривиальна.
- **Prisma-абстракция**: при необходимости миграции на PostgreSQL меняется только `datasource.provider` и типы (`String?` JSON-колонки → `Json?`); код приложения не трогается.

**Отрицательные:**
- **Один писатель** — при высокой конкурентной записи возникает `SQLITE_BUSY`. Для Gidede (редкие записи, AI-латентность доминирует) неактуально, но при росте станет узким местом.
- **Нет типов** `Json`, `Decimal`, `Enum` — JSON-поля хранятся как `String?` (см. [ADR-001](./001-json-blob-columns.md)), enum'ы как `String`.
- **Нет встроенной репликации** — для horizontal-scale нужен переход на PostgreSQL.
- **Нет row-level security** — многопользовательская изоляция обеспечивается на уровне приложения (`where: { userId, deletedAt: null }`), а не БД.
- WAL-режим рекомендован для конкурентного чтения при записи (`PRAGMA journal_mode=WAL`) — пока не включён явно.

## Критерий миграции на PostgreSQL

Перейти на PostgreSQL, когда выполнится хотя бы одно из:
- >100 одновременных активных пользователей с частыми записями (видим `SQLITE_BUSY` в логах).
- Появятся аналитические запросы по внутренним полям JSON-блоков (нужен GIN/JSONB).
- Нужна multi-instance деплойка (load balancer + 2+ app-серверов) — SQLite-файл нельзя шарить между инстансами.
- Появятся фоновые job-workers (очереди, cron), пишущие в ту же БД.

Карта миграции: сменить `provider = "postgresql"`, пройтись по `String?` JSON-колонкам → `Json?` + zod-схемы, включить `PRAGMA`-эквиваленты через `@map`/`@default`, прогнать `prisma migrate`. Прикладной код остаётся без изменений (Prisma-compatible).

## Связанные файлы

- `prisma/schema.prisma` — `datasource db { provider = "sqlite" }`.
- `src/lib/db.ts` — Prisma singleton + environment-aware logging.
- `package.json` — `db:push`, `db:migrate`, `db:migrate:deploy`.
- `.env.example` — `DATABASE_URL=file:./db/custom.db`.
- `docker-compose.yml` — single-container деплой (нет postgres-сервиса).
