# Gidede — Game Design AI System

**Версия**: v0.51.0 (Next.js port, Phases 1-6 completed)

> [!IMPORTANT]
> Идёт устранение алгоритмических замечаний по [новому roadmap](docs/audit/FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md).
> Текущая задача, завершённые работы, проверки и инструкции для продолжения фиксируются в
> [Algorithm Roadmap Worklog](docs/audit/ALGORITHM_ROADMAP_WORKLOG.md). Старый `REFACTOR_TRACKER.md`
> сохранён только как исторический документ и не отражает актуальную готовность алгоритмов.

AI-powered система для проектирования игр. 8 функциональных блоков покрывают полный пайплайн геймдизайна — от идеи до GDD. Включает node-based редактор прототипов с компиляцией в LittleJS (2D) и Three.js (3D).

## Технологии

| Слой | Технология |
|------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind CSS 4 + shadcn/ui |
| Backend | Next.js API Routes (TypeScript) |
| БД | SQLite (Prisma ORM) |
| AI | z-ai-web-dev-sdk (glm-4.6) |
| Прототипы | LittleJS (2D) + Three.js (3D) |

## Быстрый старт

### Локально (Development)

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede
bun install
cp .env.example .env
bun run db:push
bun run dev
# → http://localhost:3000
```

### Docker (Production)

```bash
git clone https://github.com/Angelionix/Gidede.git
cd Gidede
docker compose up -d --build
# → http://localhost:3000
```

## 8 функциональных блоков

1. **Генератор концепции** — Reverse MDA + MechanicsDB (128 механик из SW.BAND)
2. **Core Loop Designer** — SVG-диаграмма, 7 типов, патологии, рекомендации
3. **MDA Lab** — Reverse/Classic MDA, линзы Шелла, матрица Бонда
4. **Баланс** — Transitive/Intransitive, Monte Carlo, Machinations
5. **Экономика и прогрессия** — Machinations, кривые, контент-план
6. **GDD Generator** — 3 формата, экспорт PDF/DOCX, чек-листы валидации
7. **AI-ассистент** — SSE streaming, контекст проекта, RAG по 12 разделам Библии
8. **GBE Bridge** — Mock API для интеграции с GDCombine

### Node-based редактор прототипов

Визуальный редактор игровой логики (как Blueprints в Unreal Engine): дизайнер собираёт механику из 20 типов нод, система компилирует граф в играбельный HTML-прототип.
- **20 нод**: 5 events + 5 entities + 4 flow + 4 data + 2 output
- **2D/3D**: LittleJS (2D) + Three.js (3D) с edge-traversal компилятором
- **5 шаблонов**: Collector, Survival, Tower Defense, Rhythm, Puzzle
- **AI**: генерация графа из текста, валидация, подсказки
- **UX**: undo/redo (Ctrl+Z), snap-to-grid (16px), экспорт HTML, save/load в БД

## Дополнительно

- **Прототипы**: 6 типов (engine/economy/ecology/tower_defense/rhythm/puzzle), 2D+3D, mobile touch, auto-save
- **База знаний**: Bible RAG (12 секций, 494 чанка, TF-IDF), 128 механик SW.BAND
- **Тёмная тема**, PDF/DOCX экспорт, случайная генерация проектов, шаблоны жанров

## Документация

- [Актуальный алгоритмический roadmap](docs/audit/FINAL_ALGORITHM_AUDIT_AND_REMEDIATION_ROADMAP.md) — план исправления результатов аудита
- [Worklog нового roadmap](docs/audit/ALGORITHM_ROADMAP_WORKLOG.md) — текущий статус и точка продолжения
- [Обзор проекта](docs/PROJECT_OVERVIEW.md) — архитектура, стек, 8 блоков, поток данных
- [Node-редактор](docs/NODE_EDITOR.md) — руководство пользователя
- [Справочник нод](docs/NODE_TYPES.md) — все 20 типов нод
- [Деплой](docs/DEPLOYMENT.md) — Docker, bare server, Nginx, PM2
- [Тестирование](docs/TESTING.md) — test cases, E2E, performance, security
- [Библия геймдизайна](docs/bible/) — 12 разделов
- [Architecture Decision Records](docs/adr/) — JSON-blob, scrypt, SSE, SQLite

## API

64 эндпоинта под `/api/v1/*`:
- Auth (register, login, refresh, me, logout, change-password)
- Projects (CRUD с soft-delete, pipeline state)
- 8 Blocks (concept, coreloop, mda, balance, progression, economy, gdd, checklist)
- AI Assistant (chat, SSE streaming, suggestions, alerts, history, status)
- Prototypes (generate 2D/3D, 6 типов)
- Prototype Graph (save, list, load, compile, ai-generate, ai-suggest)
- Playtests (save, history, export CSV/JSON, import)
- Mechanics (MechanicsDB stats, save, list)
- RAG (search, stats)
- GBE (sync-to, sync-from, webhook, status, history)
- Pipeline (state, prepare-input, run-full-pipeline — **реальный серверный пайплайн**, run-pipeline partial)

## License

MIT
