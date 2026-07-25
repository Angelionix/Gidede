# Node Types — Референс

**Источник**: `src/lib/graph/types.ts` (`NODE_DEFINITIONS`) · **Компилятор**: `src/lib/graph/compiler.ts` (`emitNodeBody`, `declareNodeVariable`, `emitRenderCode`, `emitEventEntry`) · **Документ**: NODE_TYPES.md

Всего **20 функциональных типов нод** + 1 утилитная (Comment), сгруппированных в 5 категорий. Цвета пинов (`PIN_COLORS`): exec `#ef4444`, number `#3b82f6`, string `#ec4899`, boolean `#f59e0b`, vec2 `#10b981`, entity `#8b5cf6`, array `#06b6d4`.

Компилятор работает в 5 фаз: **A** — объявление переменных (`declareNodeVariable`), **B** — render-код сущностей (`emitRenderCode`), **C** — обход Event-нод с эмиссией в `gameInit()` / `gameUpdate()` (`emitEventEntry` + DFS `emitFollowers`), **D** — HUD, **E** — обёртка в HTML (2D LittleJS или 3D Three.js). Data-входы разрешаются через `resolveDataInput()` — следует по data-ребру к source output pin и возвращает JS-выражение; если ребра нет, берётся `defaultProperties`.

---

## Events (5) — точки входа

Цвет категории `#3b82f6`. Каждая Event-нода определяет, в какой lifecycle-функцию выполнятся её последователи по exec-рёбрам.

### 🎮 onGameStart — «Game Start»

| Поле | Значение |
|------|----------|
| Category | event, `#3b82f6` |
| Inputs | — |
| Outputs | `exec` → (exec) |
| Default properties | `{}` |
| Компиляция | Последователи эмитятся в `gameInit()` (один раз при старте). `emitEventEntry` → `emitFollowers(evt, ctx, ctx.initLines, "    ")`. |

### ⏱ onTick — «Every Frame»

| Поле | Значение |
|------|----------|
| Category | event, `#3b82f6` |
| Inputs | — |
| Outputs | `exec` → (exec); `deltaTime` dt (number) |
| Default properties | `{}` |
| Компиляция | Последователи эмитятся в `gameUpdate()` каждый кадр. Output `deltaTime` → выражение `timeDelta`. |

### 💥 onCollision — «On Collision»

| Поле | Значение |
|------|----------|
| Category | event, `#3b82f6` |
| Inputs | `entityA` A (entity); `entityB` B (entity) |
| Outputs | `exec` → (exec) |
| Default properties | `{ entityA: "player", entityB: "enemy" }` |
| Компиляция | В `gameUpdate()` генерируется вложенный цикл `for (_iA) for (_iB)` с проверкой `arrA[_iA].pos.subtract(arrB[_iB].pos).length() < 20`. Имена массивов резолвятся через `entityArrayExpr()` (`player`→`[player]`, `enemy`→`enemies`, `collectible`→`<id>_crystals`). |

### ⌨️ onKey — «On Key»

| Поле | Значение |
|------|----------|
| Category | event, `#3b82f6` |
| Inputs | — |
| Outputs | `exec` → (exec) |
| Default properties | `{ keyCode: "Space" }` |
| Компиляция | В `gameUpdate()`: `if (keyWasPressed('<keyCode>')) { ...followers... }`. |

### 🎯 onTimerEnd — «Timer End»

| Поле | Значение |
|------|----------|
| Category | event, `#3b82f6` |
| Inputs | — |
| Outputs | `exec` → (exec) |
| Default properties | `{ duration: 30 }` |
| Компиляция | Объявляется `let <v>_timeLeft = duration`. В `gameUpdate()`: `${v}_timeLeft -= timeDelta; if (<=0) { ...followers... }`. HUD показывает `Math.ceil(<v>_timeLeft) + 's'`. |

---

## Entities (5) — игровые сущности

Цвет категории `#f59e0b`. Каждая entity эмитит render-код в `gameRender()` (Phase B) и (если достигнута по exec-ребру) — логику в update.

### 👤 player — «Player»

| Поле | Значение |
|------|----------|
| Category | entity, `#f59e0b` |
| Inputs | — |
| Outputs | `position` pos (vec2); `onMove` move (exec) |
| Default properties | `{ speed: 150, controlScheme: "wasd" }` |
| Компиляция | Phase A: `let player = { pos: vec2(200,150), speed, hp: 100 }`. Phase B (render): `drawCircle(player.pos, 14, green)`. При exec-входе: движение WASD/стрелками через `keyIsDown`, `clamp` по границам canvas, эмитит `onMove`. Output `position` → `player.pos`, `hp` → `player.hp`. |

### 👾 enemy — «Enemy»

| Поле | Значение |
|------|----------|
| Category | entity, `#f59e0b` |
| Inputs | `target` target (vec2) |
| Outputs | `position` pos (vec2); `onCollide` collide (exec) |
| Default properties | `{ speed: 80, damage: 10, spawnRate: 1.5 }` |
| Компиляция | Phase A: `let enemies = []; let enemySpawnTimer = spawnRate` (один раз на граф). При exec-входе: спавн по таймеру, движение, фильтр вышедших за границы, коллизия с player (`player.hp -= damage*timeDelta`, `sfxHit()`, `spawnParticles`) → эмитит `onCollide`. Render: `enemies.forEach(e => drawCircle(e.pos, 12, red))`. Output `position` → `enemies[0]?.pos`. |

### 💎 collectible — «Collectible»

| Поле | Значение |
|------|----------|
| Category | entity, `#f59e0b` |
| Inputs | — |
| Outputs | `onCollect` collect (exec); `position` pos (vec2) |
| Default properties | `{ value: 1, count: 5, respawn: true }` |
| Компиляция | Phase A: `let <v>_crystals = []`; в `gameInit()` — цикл спавна `count` кристаллов со случайными позициями. При exec-входе: цикл проверки `c.pos.subtract(player.pos).length() < 20` → `c.collected=true; sfxCollect(); spawnParticles` → эмитит `onCollect`. Render: `drawPolygon(c.pos, 6, 10, yellow)` для несобранных. |

### 🏰 base — «Base/Goal»

| Поле | Значение |
|------|----------|
| Category | entity, `#f59e0b` |
| Inputs | — |
| Outputs | `hp` hp (number); `onDestroyed` destroyed (exec) |
| Default properties | `{ maxHp: 100, isWinCondition: true }` |
| Компиляция | Phase A: `let <v>_hp = maxHp`. При exec-входе: `if (<v>_hp <= 0) { ...onDestroyed followers... }`. Render: `drawRect` (синяя база у правого края). Output `hp` → `<v>_hp`. |

### ✨ spawner — «Spawner»

| Поле | Значение |
|------|----------|
| Category | entity, `#f59e0b` |
| Inputs | `trigger` → (exec) |
| Outputs | `spawned` entity (entity) |
| Default properties | `{ entityType: "enemy", interval: 2.0 }` |
| Компиляция | Phase A: `let <v>_timer = interval`. При exec-входе: `${v}_timer -= timeDelta; if (<=0) { ${v}_timer = interval; enemies.push({pos, vel}) ...spawned followers... }`. Для `entityType==="enemy"` пушит в массив `enemies`; для других — комментарий. |

---

## Flow Control (4) — управление потоком

Цвет категории `#8b5cf6`. Управляют порядком выполнения exec-потока.

### 🔀 branch — «Branch (If)»

| Поле | Значение |
|------|----------|
| Category | flow, `#8b5cf6` |
| Inputs | `exec` → (exec); `condition` cond (boolean) |
| Outputs | `true` (exec); `false` (exec) |
| Default properties | `{}` |
| Компиляция | `cond = resolveDataInput("condition")` (по data-ребру или свойство/`true`). Эмитит `if (cond) { ...true followers... } else { ...false followers... }` через `emitFollowersByHandle(node, "true"/"false")`. |

### 🔁 forEach — «For Each»

| Поле | Значение |
|------|----------|
| Category | flow, `#8b5cf6` |
| Inputs | `exec` → (exec); `array` array (array) |
| Outputs | `loop` → (exec); `item` item (entity) |
| Default properties | `{}` |
| Компиляция | `arr = resolveDataInput("array")`. `for (let _item=0; _item < (arr||[]).length; _item++) { const <v>_item = arr[_item]; ...loop followers... }`. Кэширует `${node.id}:item` → `<v>_item` для разрешений downstream. |

### ⏳ delay — «Delay»

| Поле | Значение |
|------|----------|
| Category | flow, `#8b5cf6` |
| Inputs | `exec` → (exec) |
| Outputs | `exec` → (exec) |
| Default properties | `{ seconds: 2.0 }` |
| Компиляция | Phase A: `let <v>_timer = 0; let <v>_started = false`. При exec-входе: запускает таймер, считает вниз, по достижении 0 — эмитит followers. Gate-логика предотвращает повторный запуск. |

### 🔢 sequence — «Sequence»

| Поле | Значение |
|------|----------|
| Category | flow, `#8b5cf6` |
| Inputs | `exec` → (exec) |
| Outputs | `out0` 1 (exec); `out1` 2 (exec); `out2` 3 (exec) |
| Default properties | `{}` |
| Компиляция | Последовательно вызывает `emitFollowersByHandle(node, "out0")`, затем `"out1"`, затем `"out2"` в одном блоке (без задержки — это упорядочивание, не тайминг). |

---

## Data (4) — данные

Цвет категории `#10b981`. Производят значения, потребляемые через data-рёбра.

### 🧮 counter — «Counter»

| Поле | Значение |
|------|----------|
| Category | data, `#10b981` |
| Inputs | `increment` +1 (exec); `reset` reset (exec) |
| Outputs | `value` value (number); `onThreshold` ≥ max (exec) |
| Default properties | `{ startValue: 0, threshold: 5 }` |
| Компиляция | Phase A: `let <v> = startValue; const <v>_MAX = threshold`. При входе на `increment` → `<v>++`; на `reset` → `<v> = startValue`. Затем `if (<v> >= <v>_MAX) { ...onThreshold followers... }`. Кэш `value` → `<v>`. HUD: `Score: <v>/<v>_MAX`. |

### 🎲 random — «Random»

| Поле | Значение |
|------|----------|
| Category | data, `#10b981` |
| Inputs | `trigger` → (exec) |
| Outputs | `value` value (number) |
| Default properties | `{ min: 0, max: 100 }` |
| Компиляция | Phase A: `let <v>_value = 0`. При exec-входе: `<v>_value = min + Math.random()*(max-min)`; кэш `value` → `<v>_value`; эмитит followers. |

### ➗ math — «Math»

| Поле | Значение |
|------|----------|
| Category | data, `#10b981` |
| Inputs | `a` a (number); `b` b (number) |
| Outputs | `result` result (number) |
| Default properties | `{ operation: "+" }` |
| Компиляция | Phase A: `let <v>_result = 0`. При exec-входе резолвит `a`, `b` через data-рёбра, вычисляет по `operation`: `+ - * / % min max` (для `/` и `%` — guard от деления на ноль). `<v>_result = expr`; кэш `result`. Output pin также резолвится inline в `resolveOutputExpr` для use-as-value без exec. |

### 📋 array — «Array»

| Поле | Значение |
|------|----------|
| Category | data, `#10b981` |
| Inputs | `add` add (entity) |
| Outputs | `array` array (array); `count` count (number) |
| Default properties | `{ initialSize: 0 }` |
| Компиляция | Phase A: `let <v> = []`. При exec-входе: `item = resolveDataInput("add")`; `<v>.push(item)`; кэш `array` → `<v>`, `count` → `<v>.length`; эмитит followers. |

---

## Output (2) — завершение игры

Цвет категории `#ef4444`. Минимум одна такая нода требуется валидатором.

### 🏆 win — «Win!»

| Поле | Значение |
|------|----------|
| Category | output, `#ef4444` |
| Inputs | `trigger` → (exec) |
| Outputs | — |
| Default properties | `{ message: "Победа!" }` |
| Компиляция | При exec-входе: `sfxWin(); win();` — останавливает игру (`running=false`), показывает overlay «🎉 Победа!», вызывает `notifyParent('win', score, 0)` (postMessage в родительский iframe). |

### 💀 lose — «Lose»

| Поле | Значение |
|------|----------|
| Category | output, `#ef4444` |
| Inputs | `trigger` → (exec) |
| Outputs | — |
| Default properties | `{ message: "Поражение" }` |
| Компиляция | При exec-входе: `sfxLose(); lose();` — overlay «💀 Поражение», `notifyParent('lose', 0, 0)`. |

---

## Utility (1) — аннотация

### 📝 comment — «Comment»

| Поле | Значение |
|------|----------|
| Category | data (утилита), `#64748b` |
| Inputs | — |
| Outputs | — |
| Default properties | `{ text: "Comment..." }` |
| Компиляция | Phase A: переменная не объявляется. При exec-входе эмитит в исходник строку `// <text>` (JS-комментарий). Не влияет на выполнение. Валидатор игнорирует comment при проверке отключённых нод. |

> **Примечание о счёте**: 5 Events + 5 Entities + 4 Flow + 4 Data + 2 Output = **20 функциональных типов**; Comment — 21-я нода-аннотация (в коде отнесена к категории `data`, но не производит игровой логики).

---

## Шаблоны графов

`src/lib/graph/templates.ts` (`GRAPH_TEMPLATES`) — 5 готовых графов для быстрого старта (загружаются из правой панели редактора):

| Ключ | Название | Состав | Win-условие |
|------|----------|--------|-------------|
| `collector` | Collector | onGameStart→player; collectible→counter→win | 5 кристаллов |
| `survival` | Survival | player + spawner + enemy + base + onTimerEnd→win; base.onDestroyed→lose | выжить 30 сек |
| `tower_defense` | Tower Defense | spawner→enemy→base; counter→win; base.onDestroyed→lose | 15 волн отбито |
| `rhythm` | Rhythm | onKey(Space)→counter→win; onTimerEnd→lose | 10 бит |
| `puzzle` | Puzzle | onKey(Enter); collectible→counter→win | 3 линии |

Все шаблоны используют `settings.mode: "2d"`, canvas 400×300, 60 FPS, фон `#0f172a`.

## Валидация (кратко)

`validateGraph()` из `src/lib/graph/validator.ts` проверяет: (1) хотя бы одна Event-нода, (2) хотя бы одна Win/Lose-нода, (3) предупреждение если нет Player, (4) совместимость типов пинов на рёбрах (exec↔exec; number→boolean и entity→vec2 разрешены), (5) предупреждение об отключённых нодах (кроме comment), (6) DFS-детекция циклов. Ошибки блокируют компиляцию; предупреждения — нет.
