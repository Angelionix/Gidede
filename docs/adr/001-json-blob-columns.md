# ADR-001: JSON-blob колонки для структурированных данных блоков

**Дата**: 2026-07-25 · **Статус**: Accepted · **Фаза**: исходный Python-порт → сохранено в Next.js

## Контекст

Каждый из 8 функциональных блоков Gidede производит структурированный результат с глубокой вложенностью: например, `ProjectCoreLoop` хранит `stepsData`, `innerLoops`, `outerLoops`, `metaLoop`, `loopHierarchy`, `pathologies`, `recommendations` — каждый из которых это массив/объект с 10–15 полями. Аналогично `ProjectMDAProfile` имеет `matchScores` (`Record<AestheticType, number>`), `lensValidation`, `bondValidation`, `machinationsModel`. Всего по 8 блокам набегает ~80+ JSON-полей, причём схема активно эволюционирует в MVP (блоки 1–8 переписывались при порте с Python FastAPI на Next.js).

Хранилище — SQLite через Prisma. Варианты: (а) отдельная колонка под каждое поле; (б) нормализованные подчинённые таблицы; (в) JSON-строка в `String?`-колонке.

## Решение

Хранить каждый структурированный результат как **JSON-строку в `String?`-колонке** в соответствующей Prisma-модели (например, `ProjectConcept.onePagerData`, `ProjectCoreLoop.pathologies`, `ProjectGDD.sections`). Парсинг через `JSON.parse` с защитными guard'ами (`safeJsonParse`-паттерн в вызывающем коде). Скалярные поля с высокой кардинальностью и по которым нужен поиск/индекс (`genre`, `structuralType`, `balanceType`, `format`, `readinessLevel`, `systemType`, `curveType`, `primaryAesthetic`) — вынесены в отдельные типизированные колонки с `@@index`.

Схема в `prisma/schema.prisma` явно комментирует JSON-колонки (например, `// JSON: OnePager`, `// JSON: CoreLoopStep[]`). Сохранение через `db.projectCoreLoop.update({ data: { pathologies: JSON.stringify(report) } })`.

## Последствия

**Положительные:**
- Схема БД стабильна при изменении структуры блоков — не нужны миграции ради добавления поля в JSON.
- Простота персистенции: один `JSON.stringify` / `JSON.parse` на блок.
- Совместимость с оригинальным SQLAlchemy-бэкендом (тот же паттерн JSON-колонок в SQLite).
- Меньше JOIN'ов при загрузке проекта — все данные блока в одной строке.

**Отрицательные:**
- JSON-поля **незапрашиваемы** и неиндексируемы — нельзя написать `WHERE pathologies.severity = 'critical'` на уровне БД. Фильтрация/агрегация делается в прикладном коде после парсинга.
- Нет типобезопасности на уровне БД; инвалидный JSON теоретически возможен (защищаемся guard'ами и `try/catch`).
- Размер строки растёт с ростом вложенности (для SQLite лимит 1 ГБ на BLOB — неактуально).

## Будущая миграция

Когда структура блоков стабилизируется и появятся реальные запросы по внутренним полям — мигрировать на типизированные `Json`-колонки Prisma (PostgreSQL) с `zod`-схемами валидации и частичной индексацией (например, GIN-индекс по `pathologies`). Карта миграции: каждый `String?` → `Json?` + zod-парсер; отдельные часто-фильтруемые поля → выделить в колонки с индексами (частично уже сделано — см. скалярные поля выше).

## Связанные файлы

- `prisma/schema.prisma` — все 8 block-моделей.
- `src/lib/pipeline-helpers.ts` — `loadProjectPipelineSnapshot` (парсит JSON-колонки).
- `src/app/api/v1/{concept,coreloop,mda,balance,progression,economy,gdd,checklist}/*` — сериализация результатов в JSON.
