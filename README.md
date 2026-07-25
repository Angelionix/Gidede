# Gidede — Game Design AI System

**Версия**: v0.51.0 (Next.js port)

AI-powered система для проектирования игр. 8 функциональных блоков покрывают полный пайплайн геймдизайна — от идеи до GDD.

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

## Дополнительно

- **Прототипы**: 6 типов (engine/economy/ecology/tower_defense/rhythm/puzzle), 2D+3D, mobile touch, auto-save
- **База знаний**: Bible RAG (12 секций, 494 чанка, TF-IDF), 128 механик SW.BAND
- **Тёмная тема**, PDF/DOCX экспорт, случайная генерация проектов, шаблоны жанров

## Документация

- [Деплой](docs/DEPLOYMENT.md) — Docker, bare server, Nginx, PM2
- [Тестирование](docs/TESTING.md) — test cases, E2E, performance, security
- [Библия геймдизайна](docs/bible/) — 12 разделов

## API

59 эндпоинтов под `/api/v1/*`:
- Auth (register, login, refresh, me, logout, change-password)
- Projects (CRUD, pipeline state)
- 8 Blocks (concept, coreloop, mda, balance, progression, economy, gdd, checklist)
- AI Assistant (chat, streaming, suggestions, alerts, history, status)
- Prototypes (generate 2D/3D, 6 types)
- Playtests (save, history, export CSV/JSON, import)
- Mechanics (MechanicsDB stats, save, list)
- RAG (search, stats)
- GBE (sync-to, sync-from, webhook, status, history)
- Pipeline (state, prepare-input, run-full-pipeline)

## License

MIT
