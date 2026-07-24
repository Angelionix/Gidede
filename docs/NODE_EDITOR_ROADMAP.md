# Node-Based Prototype Editor — Roadmap

## Обзор

Визуальный редактор игровой логики для прототипов, где геймдизайнер собираёт механику из нод (как Blueprints в Unreal Engine), а система компилирует граф в исполняемый HTML-прототип (LittleJS/Three.js).

**Целевая аудитория:** геймдизайнеры без навыков программирования, которые хотят быстро протестировать игровую идею.

**Ключевая ценность:** от идеи до играбельного прототипа — за 5 минут, без кода.

---

## Фаза 1: Foundation (MVP) — Неделя 1-2

### Этап 1.1: React Flow Setup + Custom Nodes
**Цель:** Работающий canvas с drag&drop нод

| Задача | Время | Артефакт |
|--------|-------|----------|
| Установить `@xyflow/react`, настроить страницу `/prototype-editor` | 30 мин | Рабочий пустой canvas |
| Создать базовый `CustomNode` компонент (header + pins + properties) | 1 ч | `nodes/BaseNode.tsx` |
| Реализовать 20 кастомных нод (5 events + 5 entities + 4 flow + 4 data + 2 output) | 3 ч | `nodes/*.tsx` (20 файлов) |
| Палитра нод (sidebar слева): категории, drag в canvas | 1 ч | `NodePalette.tsx` |
| Inspector panel (sidebar справа): свойства выбранной ноды | 1 ч | `NodeInspector.tsx` |
| Цветовое кодирование: events=синий, entities=оранжевый, flow=фиолетовый, data=зелёный, output=красный | 30 мин | CSS в нодах |
| **Контрольная точка:** пользователь может перетаскивать ноды, соединять их, редактировать свойства | | |

### Этап 1.2: Graph Data Model + Persistence
**Цель:** Граф сохраняется и загружается

| Задача | Время | Артефакт |
|--------|-------|----------|
| Спроектировать `NodeGraph` интерфейс (nodes, edges, settings) | 30 мин | `types/graph.ts` |
| Реализовать экспорт графа в JSON (React Flow → NodeGraph) | 30 мин | `lib/graph-export.ts` |
| Реализовать импорт графа из JSON (NodeGraph → React Flow) | 30 мин | `lib/graph-import.ts` |
| Prisma модель `PrototypeGraph` + `db:push` | 30 мин | `prisma/schema.prisma` |
| API: `POST /api/v1/prototype-graph/save` | 30 мин | `prototype-graph/save/route.ts` |
| API: `GET /api/v1/prototype-graph/list` | 30 мин | `prototype-graph/list/route.ts` |
| API: `GET /api/v1/prototype-graph/[id]` (загрузить один) | 30 мин | `prototype-graph/[id]/route.ts` |
| API: `DELETE /api/v1/prototype-graph/[id]` | 30 мин | |
| UI: кнопки Save/Load в редакторе | 1 ч | `GraphToolbar.tsx` |
| **Контрольная точка:** граф сохраняется в БД и загружается | | |

### Этап 1.3: Graph Templates
**Цель:** 5 готовых графов для быстрого старта

| Задача | Время | Артефакт |
|--------|-------|----------|
| Шаблон "Collector" (Player + 5 Collectibles + Counter + Win) | 30 мин | `templates/collector.json` |
| Шаблон "Survival" (Player + Enemy spawner + HP + Lose + Timer) | 30 мин | `templates/survival.json` |
| Шаблон "Tower Defense" (Base + Enemy waves + Counter + Win/Lose) | 30 мин | `templates/tower_defense.json` |
| Шаблон "Rhythm" (Timer + Keyboard + Counter + Win) | 30 мин | `templates/rhythm.json` |
| Шаблон "Puzzle" (Grid + Place + Line check + Win) | 30 мин | `templates/puzzle.json` |
| UI: панель "Templates" — выбор и загрузка | 1 ч | `TemplatePanel.tsx` |
| **Контрольная точка:** 5 шаблонов загружаются одним кликом | | |

---

## Фаза 2: Compiler — Неделя 2-3

### Этап 2.1: Graph Validator
**Цель:** Проверка графа перед компиляцией

| Задача | Время | Артефакт |
|--------|-------|----------|
| Проверка обязательных нод (должен быть хотя бы 1 Event + Win или Lose) | 30 мин | `lib/graph-validator.ts` |
| Проверка связности (нет висячих пинов) | 30 мин | |
| Проверка типов пинов (Event→Event, Number→Number, не Event→Number) | 1 ч | |
| UI: подсветка ошибок (красные ноды/рёбра) + список ошибок | 1 ч | `ValidationPanel.tsx` |
| **Контрольная точка:** некорректный граф не компилируется, показывает ошибки | | |

### Этап 2.2: Code Compiler (JSON → LittleJS)
**Цель:** Граф превращается в играбельный HTML

| Задача | Время | Артефакт |
|--------|-------|----------|
| Архитектура компилятора: `compileGraph(graph) → html` | 1 ч | `lib/graph-compiler.ts` |
| Компиляция Event нод → `gameInit()` / `gameUpdate()` / `gameRender()` | 2 ч | |
| Компиляция Entity нод → переменные + спавн + рендер | 2 ч | |
| Компиляция Flow Control нод → if/for/while в `gameUpdate()` | 1 ч | |
| Компиляция Data нод → переменные + математика | 1 ч | |
| Компиляция Output нод → win()/lose() + postMessage | 30 мин | |
| Edge resolution: связь `onCollect→increment` превращается в код | 2 ч | |
| SFX integration: вызовы sfxCollect/sfxHit/sfxWin в нужных местах | 30 мин | |
| Touch controls: авто-добавление swipe handlers для mobile | 30 мин | |
| HTML template: wrapper с `<script src="/littlejs.min.js">` + SFX_SNIPPET | 30 мин | |
| **Контрольная точка:** граф компилируется в играбельный прототип | | |

### Этап 2.3: Preview + Test
**Цель:** Прототип запускается в iframe

| Задача | Время | Артефакт |
|--------|-------|----------|
| API: `POST /api/v1/prototype-graph/compile` — принимает граф, возвращает HTML | 30 мин | `prototype-graph/compile/route.ts` |
| UI: split-view — canvas слева, iframe preview справа | 1 ч | `PrototypeEditor.tsx` |
| Кнопка "Generate" — компилирует граф + показывает iframe | 30 мин | |
| Auto-save результата: postMessage из iframe → сохранение в PlaytestResult | 30 мин | |
| Кнопка "Restart" — перезагрузка iframe | 15 мин | |
| **Контрольная точка:** полный цикл: drag→connect→generate→play→save | | |

---

## Фаза 3: AI Integration — Неделя 3-4

### Этап 3.1: AI Graph Generation
**Цель:** LLM создаёт граф из текстового описания

| Задача | Время | Артефакт |
|--------|-------|----------|
| Функция `generateGraphFromText(description)` в ai-service.ts | 1 ч | `ai-service.ts` |
| Prompt engineering: описание → JSON NodeGraph (20 типов нод) | 1 ч | |
| Robust JSON parsing (как в enrichConcept) | 30 мин | |
| API: `POST /api/v1/prototype-graph/ai-generate` | 30 мин | `prototype-graph/ai-generate/route.ts` |
| UI: текстовое поле "Опиши игру" + кнопка "AI Generate Graph" | 1 ч | `AIGeneratePanel.tsx` |
| Загрузка сгенерированного графа в canvas | 30 мин | |
| **Контрольная точка:** пользователь описывает игру текстом → граф загружается | | |

### Этап 3.2: AI Graph Validation & Suggestions
**Цель:** AI проверяет граф и предлагает улучшения

| Задача | Время | Артефакт |
|--------|-------|----------|
| Функция `validateGraphWithAI(graph)` — LLM анализирует граф | 1 ч | `ai-service.ts` |
| Проверка: есть ли Win/Lose, нет ли бесконечных циклов, достаточно ли нод | 30 мин | |
| Функция `suggestNodesForGraph(graph)` — LLM предлагает добавить ноды | 1 ч | |
| UI: панель "AI Suggestions" — карточки с предложениями (клик = добавить ноду) | 1 ч | `AISuggestionsPanel.tsx` |
| **Контрольная точка:** AI находит ошибки и предлагает ноды | | |

### Этап 3.3: AI Graph from GDD
**Цель:** Граф генерируется из данных проекта (GDD)

| Задача | Время | Артефакт |
|--------|-------|----------|
| Извлечение механик из GDD проекта (core loop steps, mechanics) | 1 ч | `lib/gdd-to-graph.ts` |
| Маппинг: GDD mechanic → node type (explore→Player, combat→Enemy, etc.) | 1 ч | |
| Авто-соединение нод на основе core loop steps | 1 ч | |
| UI: кнопка "Generate from Project" — использует данные текущего проекта | 30 мин | |
| **Контрольная точка:** из проекта генерируется готовый граф прототипа | | |

---

## Фаза 4: Advanced Features — Неделя 4-5

### Этап 4.1: Subgraphs (Макросы)
**Цель:** Переиспользуемые блоки графа

| Задача | Время | Артефакт |
|--------|-------|----------|
| `SubgraphNode` — нода, содержащая вложенный граф | 2 ч | `nodes/SubgraphNode.tsx` |
| API: сохранение/загрузка subgraphs в SavedMechanic | 1 ч | |
| UI: двойной клик по SubgraphNode → открывает вложенный граф | 1 ч | |
| Компиляция subgraph: разворачивание inline при компиляции | 1 ч | `graph-compiler.ts` |
| **Контрольная точка:** пользователь создаёт "Patrol Pattern" subgraph и переиспользует | | |

### Этап 4.2: Comment Nodes + Reroute
**Цель:** Аккуратный и читаемый граф

| Задача | Время | Артефакт |
|--------|-------|----------|
| Comment node — текстовый блок вокруг группы нод | 1 ч | `nodes/CommentNode.tsx` |
| Reroute node — точка для разводки проводов | 30 мин | `nodes/RerouteNode.tsx` |
| Auto-layout — автоматическое расположение нод (dagre/elk) | 2 ч | `lib/graph-layout.ts` |
| **Контрольная точка:** граф выглядит чисто, провода не пересекаются хаотично | | |

### Этап 4.3: 3D Mode
**Цель:** Компиляция графа в Three.js (3D)

| Задача | Время | Артефакт |
|--------|-------|----------|
| 3D-специфичные ноды: Camera, Light, Mesh3D, Raycaster3D | 2 ч | `nodes/3d/*.tsx` |
| 3D compiler: `compileGraph3D(graph) → three.js html` | 3 ч | `lib/graph-compiler-3d.ts` |
| Toggle 2D/3D в UI | 30 мин | |
| **Контрольная точка:** граф компилируется в 3D-прототип | | |

---

## Фаза 5: Polish & Integration — Неделя 5-6

### Этап 5.1: Sidebar Integration
**Цель:** Редактор доступен из основного навигационного меню

| Задача | Время | Артефакт |
|--------|-------|----------|
| Добавить пункт "Редактор прототипов" в сайдбар (wand icon) | 30 мин | `sidebar.tsx` |
| Middleware: `/prototype-editor` в PROTECTED_PREFIXES | 5 мин | `middleware.ts` |
| Связь с проектом: выбор проекта → загрузка его GDD → генерация графа | 1 ч | |
| **Контрольная точка:** редактор доступен из меню, связан с проектами | | |

### Этап 5.2: Mechanic Library Integration
**Цель:** Графы сохраняются в библиотеку механик

| Задача | Время | Артефакт |
|--------|-------|----------|
| Кнопка "Save to Library" → сохраняет граф в SavedMechanic | 30 мин | |
| Загрузка графа из библиотеки в редактор | 30 мин | |
| Галерея публичных графов | 1 ч | `GraphGallery.tsx` |
| **Контрольная точка:** удачные графы переиспользуются между проектами | | |

### Этап 5.3: Export & Share
**Цель:** Графы можно экспортировать и делиться

| Задача | Время | Артефакт |
|--------|-------|----------|
| Export graph JSON (скачать .json файл) | 30 мин | |
| Import graph JSON (загрузить .json файл) | 30 мин | |
| Export compiled HTML (скачать играбельный .html файл) | 30 мин | |
| **Контрольная точка:** пользователь может скачать и поделиться прототипом | | |

### Этап 5.4: UX Polish
**Цель:** Профессиональный UX

| Задача | Время | Артефакт |
|--------|-------|----------|
| Keyboard shortcuts: Delete (удалить ноду), Ctrl+S (сохранить), Ctrl+Z (undo) | 1 ч | |
| Undo/Redo history (React Flow built-in) | 1 ч | |
| Minimap (React Flow built-in) | 15 мин | |
| Background grid (dots/lines) | 15 мин | |
| Snap to grid | 15 мин | |
| Dark mode support (theme-aware) | 30 мин | |
| Responsive layout (mobile: stacked, desktop: 3-panel) | 1 ч | |
| **Контрольная точка:** редактор выглядит как профессиональный инструмент | | |

---

## Фаза 6: Testing & Documentation — Неделя 6

### Этап 6.1: Testing
| Задача | Время |
|--------|-------|
| Unit tests: graph-validator (20 test cases) | 2 ч |
| Unit tests: graph-compiler (10 графов → HTML, проверка содержимого) | 2 ч |
| E2E: создать граф → сгенерировать → играть → сохранить результат | 1 ч |
| E2E: загрузить шаблон → изменить → сохранить в библиотеку | 1 ч |
| E2E: AI generate graph → validate → compile → play | 1 ч |

### Этап 6.2: Documentation
| Задача | Время |
|--------|-------|
| `docs/NODE_EDITOR.md` — руководство пользователя | 1 ч |
| `docs/NODE_TYPES.md` — справочник всех 20 нод | 1 ч |
| Обновление README.md | 30 мин |
| Обновление TESTING.md (новые test cases) | 30 мин |

---

## Библиотека нод (20 типов для MVP)

### Events (5):
1. 🎮 **OnGameStart** — старт игры
2. ⏱ **OnTick** — каждый кадр
3. 💥 **OnCollision(A, B)** — столкновение
4. ⌨️ **OnKey(code)** — нажатие клавиши
5. 🎯 **OnTimerEnd** — таймер истёк

### Entities (5):
6. 👤 **Player** — спрайт + управление + позиция
7. 👾 **Enemy** — спавн + движение + урон
8. 💎 **Collectible** — спавн + сбор + очки
9. 🏰 **Base** — HP + цель защиты
10. ✨ **Spawner** — генератор объектов

### Flow Control (4):
11. 🔀 **Branch** — if/else
12. 🔁 **ForEach** — перебор массива
13. ⏳ **Delay** — отложенное выполнение
14. 🔢 **Sequence** — последовательность шагов

### Data (4):
15. 🧮 **Counter** — счётчик с порогом
16. 🎲 **Random** — случайное число
17. 📊 **Math** — арифметика
18. 📋 **Array** — массив объектов

### Output (2):
19. 🏆 **Win** — победа
20. 💀 **Lose** — поражение

---

## Сводка

| Фаза | Длительность | Результат |
|------|-------------|-----------|
| **1. Foundation** | 1.5 недели | Drag&drop граф с сохранением |
| **2. Compiler** | 1 неделя | Играбельный прототип из графа |
| **3. AI** | 1 неделя | Текст → граф → игра |
| **4. Advanced** | 1 неделя | Профессиональный редактор |
| **5. Polish** | 1 неделя | Интегрированный продукт |
| **6. Testing** | 0.5 недели | Production-ready |
| **ИТОГО** | **6 недель** | Полноценный node-based editor |

## Milestones

| Milestone | Что работает | Когда |
|-----------|-------------|-------|
| **M1: Canvas** | Drag нод, соединение, свойства | Конец недели 1 |
| **M2: Compile** | Граф → играбельный HTML | Конец недели 3 |
| **M3: AI** | Текст → граф → игра | Конец недели 4 |
| **M4: 3D** | 3D прототипы из графа | Конец недели 5 |
| **M5: Release** | Интегрировано, протестировано, документация | Конец недели 6 |

## Приоритеты

**Must-have (MVP за 2 недели):**
1. React Flow + 20 нод (drag + connect)
2. Graph → LittleJS compiler
3. Preview iframe + auto-save
4. 5 шаблонов
5. Save/Load

**Should-have (фаза 3):**
6. AI generate graph
7. AI validate + suggest

**Nice-to-have (фазы 4-5):**
8. Subgraphs
9. 3D mode
10. Mechanic library integration
