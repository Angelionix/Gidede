# Node-редактор прототипов — Руководство пользователя

**Маршрут**: `/prototype-editor` (требует логина) · **Компонент**: `src/components/prototype-editor/PrototypeEditor.tsx` · **Документ**: NODE_EDITOR.md

## Что это

Node-редактор — визуальный инструмент, в котором геймдизайнер собирает игровую логику из нод (как Unreal Blueprints). Граф компилируется в играбельный HTML-прототип (LittleJS для 2D, Three.js для 3D) и запускается прямо в iframe. Никакого кода писать не нужно — вы соединяете ноды связями (pins) и задаёте свойства в инспекторе.

Исходный код: `src/lib/graph/types.ts` (определения нод), `src/lib/graph/compiler.ts` (компилятор), `src/lib/graph/validator.ts` (валидация), `src/lib/graph/templates.ts` (шаблоны).

## Доступ

Откройте `/prototype-editor` в браузере. Маршрут защищён middleware (`src/middleware.ts`): неаутентифицированных пользователей редиректит на `/login`. В сайдбаре — пункт «Node-редактор NEW».

## Раскладка UI

```
┌────────────┬─────────────────────────────────────────┬──────────────┐
│  Палитра   │  Тулбар: ↶ ↷ | Экспорт Импорт HTML |2D 3D│  Инспектор   │
│  (слева,   │           нод/связей | Сгенерировать     │  + Шаблоны   │
│  192px)    ├─────────────────────────────────────────┤  + Save/Load │
│            │                                         │  + AI        │
│  5 катего- │         Canvas (React Flow)              │  (справа,    │
│  рий, 20   │   • Background (dots, 16px grid)         │   224px)     │
│  нод       │   • MiniMap · Controls · fitView         │              │
│            │   • drag&drop из палитры                  │              │
│            │   • snap-to-grid 16px                    │              │
└────────────┴─────────────────────────────────────────┴──────────────┘
```

- **Левая палитра** (`NodePalette.tsx`, 192px): 5 категорий — Events, Entities, Flow Control, Data, Output. Каждый элемент `draggable`; переносите ноду на canvas.
- **Центральный canvas** (`GraphCanvas.tsx`): React Flow с `Background` (dots), `Controls` (зум/фит), `MiniMap` (цвета по типу ноды). Поддерживает drag&drop, мультивыделение (Meta/Ctrl), удаление клавишами Delete/Backspace.
- **Правая панель** (224px): Инспектор свойств выбранной ноды → Шаблоны → Сохранить/загрузить из БД → AI-генерация.

## Рабочий процесс

1. **Перетащите ноду** из левой палитры на canvas — она «прилипнет» к сетке 16px (`snapToGrid`).
2. **Соедините pins** перетаскиванием от output-pin к input-pin. Exec-pins (красные, `→`) задают поток выполнения; data-pins (цветные по типу) передают значения. Связи анимированы.
3. **Выберите ноду кликом** — справа в Инспекторе появятся её свойства (number/string/boolean) и координаты. Меняйте значения — они применяются немедленно.
4. **Нажмите «Сгенерировать»** (или `Ctrl+S`-подобный поток) — граф отправляется на `POST /api/v1/prototype-graph/compile`, валидируется и компилируется в HTML.
5. **Играйте в iframe**: появятся кнопки Restart / «← Back to graph». Окно win/lose показывает результат.
6. **Экспортируйте** готовый HTML кнопкой `HTML` в тулбаре (видна после компиляции) — скачается `prototype-2d-<timestamp>.html`.

> Минимальный валидный граф требует хотя бы одну Event-ноду (точка входа) и одну Win/Lose-ноду (условие завершения). Player-нода рекомендуется (иначе игрок не управляет прототипом).

## 5 шаблонов

Кнопки в правой панели «Шаблоны» загружают готовый граф из `GRAPH_TEMPLATES`:

| Шаблон | Описание | Ноды |
|--------|----------|------|
| **Collector** | Собери 5 кристаллов | onGameStart → player; collectible→counter→win |
| **Survival** | Выживи 30 секунд | player + spawner + enemy + base + onTimerEnd → win/lose |
| **Tower Defense** | Защити базу от 3 волн | spawner + enemy + base + counter → win/lose |
| **Rhythm** | Поймай 10 бит | onKey(Space) + counter → win; onTimerEnd → lose |
| **Puzzle** | Собери 3 линии | onKey(Enter) + collectible + counter → win |

## 2D / 3D переключатель

Тумблер `2D` / `3D` в тулбаре меняет `mode` в `settings` графа. При компиляции:

- **2D** → `generateHtml()` — LittleJS-рендеринг (`drawCircle`, `drawPolygon`, `drawRect`, `drawText`), `engineInit(gameInit, gameUpdate, …)`.
- **3D** → `generate3DHtml()` — Three.js-сцена с шимами LittleJS API (`vec2`, `Color`, `keyIsDown`/`keyWasPressed`, `drawCircle→SphereGeometry`, `drawPolygon→OctahedronGeometry`). Тот же скомпилированный код графа работает в обоих режимах.

## Undo / Redo

Реализовано в Фазе 5 (`PrototypeEditor.tsx`):

- Стек `undoStack` / `redoStack` (`useRef`), дебаунс снимков 400 мс (чтобы драг ноды не зафлудил историю), лимит 50 записей.
- `pushHistory()` вызывается перед мутациями; любое новое действие очищает redo.
- Кнопки `↶` / `↷` в тулбаре с tooltips. Тосты показывают остаток истории.

## Snap-to-grid

`GraphCanvas.tsx`: `snapToGrid` + `snapGrid={[16, 16]}` на ReactFlow. Брошенная нода округляется до ближайших 16px (`GRID_SIZE`). Фон `Background variant={Dots} gap={16}` визуально выровнен с сеткой.

## Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Delete` / `Backspace` | Удалить выбранные ноды/связи (`deleteKeyCode`) |
| `Ctrl+Z` | Отменить (`undo`) |
| `Ctrl+Shift+Z` или `Ctrl+Y` | Повторить (`redo`) |
| `Ctrl+S` | Быстрое сохранение в БД (требует заполненного «Название графа») |
| `Meta` / `Ctrl` (удержание) | Мультивыделение (`multiSelectionKeyCode`) |

Горячие клавиши игнорируются, когда фокус в `input`/`textarea`/`contentEditable`.

## Сохранение / загрузка / экспорт

- **Save to DB**: введите «Название графа» → «Сохранить» → `POST /api/v1/prototype-graph/save` (граф сериализуется в JSON, сохраняется в `PrototypeGraph.graph`).
- **Мои графы**: список сохранённых (`GET /prototype-graph/list?scope=mine`), клик загружает (`GET /prototype-graph/[id]`).
- **Экспорт JSON**: кнопка «Экспорт» — скачивает `prototype-graph.json` (полный граф).
- **Импорт JSON**: кнопка «Импорт» — выбор `.json`-файла, ноды/связи загружаются на canvas.
- **Экспорт HTML**: кнопка «HTML» (после компиляции) — скачивает играбельный `prototype-2d-<timestamp>.html` (или `-3d-`).

## AI-функции

Правая панель, блок «AI генерация» (textarea + 2 кнопки):

- **«AI: граф из текста»** — `POST /api/v1/prototype-graph/ai-generate` → `generateGraphFromText()` в `ai-service.ts`. Опишите игру («собери 5 кристаллов, уклоняйся от врагов») — AI вернёт массив нод и связей, которые загрузятся на canvas.
- **«AI: проверить граф»** — `POST /api/v1/prototype-graph/ai-suggest` → `validateGraphWithAI()`. Анализирует текущий граф и выдаёт suggestions (error/warning/info) с подсказками, какие ноды добавить.

Обе функции graceful-degrade: при недоступности SDK показывают тост «AI недоступен».

## Автосохранение результатов плейтеста

iframe с прототипом после `win()` / `lose()` вызывает `window.parent.postMessage({ type: 'gidede-playtest', outcome, score, duration, prototypeType, mode }, '*')`. `PrototypeEditor.tsx` слушает `message`-события и показывает тост «🎉 Победа!» / «💀 Поражение» с подписью «Результат автосохранён». Результаты плейтестов сохраняются через `/api/v1/playtests/save` в модель `PlaytestResult`.

## Смотрите также

- [`NODE_TYPES.md`](./NODE_TYPES.md) — полный референс всех 20 типов нод (pins, свойства, как компилируются).
- [`PROJECT_OVERVIEW.md`](./PROJECT_OVERVIEW.md) — обзор системы.
- [`NODE_EDITOR_ROADMAP.md`](./NODE_EDITOR_ROADMAP.md) — роадмап развития редактора.
