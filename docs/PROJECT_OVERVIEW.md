# Gidede — Обзор проекта

**Версия**: v0.51.0 · **Ветка**: `nextjs-port` · **Документ**: PROJECT_OVERVIEW.md

## Что такое Gidede

Gidede — это AI-powered система для проектирования игр на базе Next.js. Она проводит геймдизайнера через полный пайплайн: от свободной идеи до готового Game Design Document (GDD). Система состоит из **8 функциональных блоков** (концепция → core loop → MDA → баланс → прогрессия → экономика → GDD → чек-лист валидации), AI-ассистента со streaming-ответами и RAG по 12 разделам Библии геймдизайна, библиотеки из 128 механик SW.BAND, генератора играбельных прототипов (6 типов, 2D/3D) и визуального node-редактора на React Flow с компиляцией графов в исполняемый HTML (LittleJS / Three.js). Все данные персистятся в SQLite через Prisma, доступ защищён scrypt+JWT-аутентификацией.

## Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 16.1 + React 19 + TypeScript 5 + Tailwind CSS 4 + shadcn/ui (Radix) |
| Backend | Next.js API Routes (TypeScript), 64 эндпоинта под `/api/v1/*` |
| БД | SQLite (Prisma ORM 6.11) |
| AI | z-ai-web-dev-sdk 0.0.18 (`zai.chat.completions.create`, модель glm-4.6) |
| Прототипы | LittleJS (2D, `public/littlejs.min.js`) + Three.js (3D, `public/three.min.js`) |
| Node-редактор | @xyflow/react 12.11 (React Flow) |
| Безопасность | scrypt (Node.js `crypto`) + HMAC-SHA256 JWT, httpOnly cookies, DOMPurify |
| Менеджер пакетов | Bun |

## Архитектура

```
┌──────────────────────────────────────────────────────────────────┐
│  Клиент (Next.js 16 — RSC + клиентские компоненты)                │
│  • 8 block-страниц (src/app/blocks/1..8)                          │
│  • Node-редактор (src/app/prototype-editor)                       │
│  • /pipeline — запуск пайплайна одним запросом                    │
└───────────────┬───────────────────────────────────┬───────────────┘
                │ fetch (SSE для assistant)          │ postMessage (playtest)
                ▼                                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  API Routes (src/app/api/v1/* — 64 route.ts)                      │
│  auth · projects · 8 blocks · assistant · prototypes ·            │
│  playtests · mechanics · rag · gbe · pipeline · prototype-graph   │
│  run-full-pipeline: 8 стадий через внутренние HTTP-вызовы         │
└───────────┬──────────────────────────────┬────────────────────────┘
            │                              │
            ▼                              ▼
┌───────────────────────┐      ┌────────────────────────────────────┐
│ Prisma ORM (db.ts)    │      │ z-ai-web-dev-sdk (ai-service.ts)    │
│ global singleton      │      │ сервер-only, graceful null-fallback │
└───────────┬───────────┘      │ streamAiResponse → SSE               │
            │                  │ 6 enrich* функций · RAG · генерация  │
            ▼                  └─────────────────────────────────────┘
┌───────────────────────┐
│ SQLite (file-based)   │
│ 16 Prisma-моделей     │
│ soft-delete · FK      │
│ cascades · индексы    │
└───────────────────────┘
```

## 8 функциональных блоков

| # | Блок | Алгоритм | Что делает | Ключевой вывод |
|---|------|----------|------------|----------------|
| 1 | Концепция | Reverse MDA + MechanicsDB | Из идеи генерирует жанр, эстетику, USP, набор механик, one-pager | `ProjectConcept` (OnePager, AestheticProfile, DynamicsProfile, MechanicSet, ValidationReport) |
| 2 | Core Loop | Engine/Economy/Ecology + 7 патологий | Проектирует иерархию циклов (inner/outer/meta), ищет патологии | `ProjectCoreLoop` (LoopHierarchy, PathologyReport, Recommendations) |
| 3 | MDA Lab | Classic/Reverse MDA + линзы Шелла + матрица Бонда | Подбирает механики под таргет-эстетики, валидирует линзами | `ProjectMDAProfile` (matchScores, LensValidation, BondValidation) |
| 4 | Баланс | Transitive/Intransitive + Monte Carlo + Machinations | Балансирует объекты по cost/power, ищет Nash equilibrium | `ProjectBalanceResult` (CostPowerCurves, PayoffMatrix, MonteCarloResults) |
| 5 | Прогрессия | 7 типов кривых + tier-модель | Строит кривые XP/уровней, контент-план | `ProjectProgression` (ProgressionCurves, ContentPlan) |
| 5 | Экономика | Machinations + диагностика патологий | Моделирует ресурсы, конверсии, монетизацию | `ProjectEconomy` (ResourceModel, ConversionChains, MonetizationSpec) |
| 6 | GDD | 3 формата (one_sheet/ten_pager/full) | Собирает GDD из предыдущих блоков, экспорт PDF/DOCX | `ProjectGDD` (GDDSection[], ConsistencyIssue[]) |
| 7 | AI-ассистент | z-ai-web-dev-sdk + SSE + RAG | Контекстный чат по геймдизайну, подсказки, алерты | `ChatMessage` (сохраняемая история) |
| 8 | GBE Bridge | Mock API + sync history | Интеграционный мост с GDCombine (to/from/webhook) | `GbeSyncHistory` |

Блок 8 (валидация/чек-лист) реализован как `ProjectChecklist` и вызывается финальной стадией пайплайна (`gdd/checklist`): MDA/Balance/Narrative/Economy/Lens-проверки + план ремедиации.

## Поток данных

```
idea ──► [1 Концепция] ──► [2 Core Loop] ──► [3 MDA] ──► [4 Баланс]
                                                              │
                                                              ▼
[8 Чек-лист] ◄── [7 AI] ◄── [6 GDD] ◄── [5b Экономика] ◄── [5a Прогрессия]
```

Серверный пайплайн `POST /api/v1/pipeline/run-full-pipeline/[projectId]` (`src/app/api/v1/pipeline/run-full-pipeline/[projectId]/route.ts`) последовательно вызывает 8 block-эндпоинтов через внутренние HTTP-запросы с подписанным внутренним access-токеном (`signAccessToken`). Каждая стадия персистит данные в БД; неудача Блока 1 — фатальна, остальные ошибки не прерывают пайплайн. После прогона инкрементируется `project.version` и вычисляется `completionPercent`.

## Node-редактор прототипов

Визуальный редактор на React Flow (`src/app/prototype-editor`, `src/lib/graph/`) позволяет собирать игровую логику из нод (по аналогии с Unreal Blueprints):

- **20 функциональных типов нод** (+1 Comment) в 5 категориях: Events (5), Entities (5), Flow Control (4), Data (4), Output (2) — определения в `src/lib/graph/types.ts` (`NODE_DEFINITIONS`).
- **Edge-traversal компилятор** (`src/lib/graph/compiler.ts`): строит карты смежности (exec/data edges), DFS-обход от Event-нод, эмитит LittleJS-код (2D) или Three.js-код с шимами (3D). Все 20 типов нод имеют реальную эмиссию.
- **Валидатор** (`src/lib/graph/validator.ts`): обязательность Event/Win-Lose нод, проверка типов пинов, поиск отключённых нод, DFS-детекция циклов.
- **5 шаблонов** (`src/lib/graph/templates.ts`): Collector, Survival, Tower Defense, Rhythm, Puzzle.
- Undo/Redo (стек 50, дебаунс 400 мс), snap-to-grid (16px), экспорт скомпилированного HTML.
- AI: «граф из текста» (`generateGraphFromText`) и «проверить граф» (`validateGraphWithAI`).

См. подробные руководства: [`NODE_EDITOR.md`](./NODE_EDITOR.md) (пользовательское) и [`NODE_TYPES.md`](./NODE_TYPES.md) (референс нод).

## AI-интеграция

- **z-ai-web-dev-sdk** импортирован только серверно в `src/lib/ai-service.ts` (`import ZAI from "z-ai-web-dev-sdk"`); клиентских утечек нет.
- Модель: glm-4.6 через `zai.chat.completions.create({ messages, stream, thinking: { type: "disabled" } })`.
- **Graceful fallback**: все AI-функции возвращают `null` при недоступности SDK — вызывающий код использует детерминированную логику.
- **SSE-стриминг**: `POST /api/v1/assistant/chat/stream` (`src/app/api/v1/assistant/chat/stream/route.ts`) — `ReadableStream` + `text/event-stream` + заголовок `X-Accel-Buffering: no`; события `start` / `message` / `done`.
- **6 enrich-функций** для блоков: `enrichConcept`, `enrichCoreLoop`, `enrichMda`, `enrichBalance`, `enrichProgression`, `enrichGdd` — вызываются при `use_ai: true`.
- **RAG**: `src/lib/bible-rag.ts` — TF-IDF поиск по 12 разделам Библии (494 чанка, 10 945 уникальных терминов); `src/lib/mechanics-db.ts` — 128 механик SW.BAND.

## Аутентификация и авторизация

`src/lib/server-auth.ts`:

- **Пароли**: `scryptSync(password, salt, 64)` с 16-байтным salt, формат `scrypt$salt$hash`, сравнение через `timingSafeEqual`. Plaintext-fallback удалён в Фазе 1.
- **Токены**: JWT-подобные `base64url(header).base64url(payload).base64url(signature)`, подпись HMAC-SHA256. Access TTL 30 мин, Refresh TTL 30 дней, `jti` для уникальности.
- **Cookies**: `access_token` / `refresh_token`, `httpOnly`, `sameSite: lax`, `secure` в production.
- **Секрет**: `resolveJwtSecret()` требует `JWT_SECRET_KEY` (≥32 символа) в production; в dev — детерминированный fallback с предупреждением.
- **Лимиты AI**: поля `aiCallsCount` / `aiCallsLimit` (free: 50, pro: 500) на модели `User`.

## База данных

`prisma/schema.prisma` — 16 Prisma-моделей (8 block-таблиц + Project + User + RefreshToken + ChatMessage + GbeSyncHistory + PlaytestResult + SavedMechanic + PrototypeGraph). Данные блоков хранятся как JSON-строки в `String?`-колонках (см. [ADR-001](./adr/001-json-blob-columns.md)). После Фазы 4:

- `@@index([userId])` на Project, ChatMessage, GbeSyncHistory, PlaytestResult, SavedMechanic, PrototypeGraph.
- FK-каскады `onDelete: Cascade` для PlaytestResult/SavedMechanic/PrototypeGraph → Project.
- **Soft-delete**: `Project.deletedAt DateTime?` + `@@index([deletedAt])`; `DELETE /projects/[id]` ставит `deletedAt` + `status='archived'`, все чтения фильтруют `deletedAt: null`.
- Логирование запросов зависит от окружения (`db.ts`): dev — `query,error,warn`; test — `error`; prod — `error,warn`.

## Статус по фазам

**Версия v0.51.0, ветка `nextjs-port`.**

- **Фаза 1 (commit 1db9d70)** — security hardening + реальный серверный пайплайн: `.env.example`, обязательный JWT-секрет, DOMPurify в GDDPreview, Dockerfile healthcheck на `node http.get`, убран `ignoreBuildErrors`, удалён plaintext-fallback, переработан `run-full-pipeline` (8/8 стадий, 100% completion).
- **Фаза 2 (commit bb98a2a)** — завершение node-редактора: edge-traversal компилятор (244→975 строк), все 20 типов нод, функциональный 3D-режим (Three.js с шимами LittleJS API).
- **Фаза 3 (тестирование)** — пропущена; автотестов нет (`*.test.ts`/`*.spec.ts` = 0, конфигов vitest/jest нет), `docs/TESTING.md` описывает только методологию.
- **Фаза 4 (commit c612500)** — data-model hygiene: индексы, FK-каскады, soft-delete, environment-aware query logging, production-миграции в `package.json`.
- **Фаза 5 (commit 3029c21)** — UX node-редактора: undo/redo (стек 50, дебаунс 400 мс), keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+S), snap-to-grid (16px), экспорт скомпилированного HTML, cookie-synced активный проект.

**Patch-фиксы (поверх Фазы 5):**

- **PATCH-1**: `gdd/checklist` endpoint теперь вызывает `updateProjectStage(projectId, "validation")` — ранее `completionPercent` зависал на 90 % вместо 100 %, а `projectStage`/`lastAlgorithmRun` оставались `"gdd"` вместо `"validation"`.
- **PATCH-2**: `pipeline/run-pipeline` (partial) теперь читает реальные данные проекта (name, description, genre, сохранённый concept.inputData.idea) вместо литеральной строки `"Pipeline partial run — concept from project data"`. Концепции больше не «мусорные» при partial-запуске Блока 1.
- **PATCH-3**: `deriveMechanicsFromIdea` (в обоих пайплайнах) теперь поддерживает русскоязычные идеи — добавлены RU-ключевые слова для 9 категорий механик (бой, исследование, сбор, постройка, головоломка, гонка, выживание, торговля, прокачка). Раньше RU-идеи всегда падали в фолбэк `["explore","combat","reward"]`.
- **PATCH-4**: Почищены `eslint-disable` директивы — убрана 1 неиспользуемая в `pipeline/page.tsx:76` и 1 неиспользуемая в `useActiveProject.ts:61`; оставшаяся директива в `useActiveProject.ts:53` снабжена поясняющим комментарием (она нужна — правило реально срабатывает на hydration из localStorage). `bun run lint` теперь 0 errors / 0 warnings.
- **PATCH-5**: `compiler.ts` — обновлена устаревшая статистика в `PROJECT_OVERVIEW.md` (244→975 строк вместо заявленных 244→848).
- **PATCH-6**: Создан отсутствующий `.env.example` (Phase 1.1 роадмапа) — ранее `.gitignore` паттерн `.env*` без `!.env.example` negation silently его скрывал.

**Что осталось:**

- Phase 3 — внедрить автотесты (unit/E2E); сейчас покрытие = 0.
- Phase 5 (по роадмапу `docs/роадмап_2026-07-25.md`) — subgraphs, авто-layout, нативная отрисовка Comment-нод, реальная интеграция mechanic-library в node-редактор, расширенные keyboard shortcuts.

## Ссылки

- [README.md](../README.md) — краткое описание и быстрый старт.
- [docs/NODE_EDITOR.md](./NODE_EDITOR.md) — пользовательское руководство node-редактора.
- [docs/NODE_TYPES.md](./NODE_TYPES.md) — референс всех типов нод.
- [docs/DEPLOYMENT.md](./DEPLOYMENT.md) — Docker / bare server / Nginx / PM2.
- [docs/TESTING.md](./TESTING.md) — методология тестирования.
- [docs/роадмап_2026-07-25.md](./роадмап_2026-07-25.md) — роадмап проекта.
- [docs/bible/](./bible/) — 12 разделов Библии геймдизайна.
- [docs/adr/](./adr/) — Architecture Decision Records (001–004).
