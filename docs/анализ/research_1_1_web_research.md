# 🔬 Фаза 1.1: Результаты веб-исследования

> **Дата**: 2026-05-16  
> **Статус**: ✅ Завершено  
> **Кол-во поисковых запросов**: 10  
> **Кол-во проанализированных источников**: ~80

---

## 1.1.1 Методологии геймдизайна

### MDA Framework (Mechanics — Dynamics — Aesthetics)

**Описание**: MDA — формальный подход к анализу и проектированию игр, разработанный Hunicke, LeBlanc и Zubek (2004). Разлагает игру на три уровня:

| Уровень | Описание | Перспектива |
|---------|----------|-------------|
| **Mechanics** (Механики) | Базовые правила, компоненты и алгоритмы игры | Дизайнер |
| **Dynamics** (Динамика) | Поведение механик во время игры при взаимодействии с игроком | Система |
| **Aesthetics** (Эстетика) | Эмоциональный отклик игрока, желаемый опыт | Игрок |

**8 типов эстетики (по MDA)**:
1. **Sensation** — сенсорное удовольствие (графика, звук)
2. **Fantasy** — погружение в воображаемый мир
3. **Narrative** — драматический сюжет
4. **Challenge** — преодоление трудностей
5. **Fellowship** — социальное взаимодействие
6. **Discovery** — исследование неизведанного
7. **Expression** — самовыражение
8. **Submission** — уход от реальности, медитативность

**Значение для Gidede**: MDA — ядерный фреймворк. Программа должна позволять:
- Задавать целевую эстетику → генерировать подходящие динамики → предлагать механики
- Валидировать: соответствуют ли механики желаемой эстетике?
- Строить MDA-диаграммы визуально

**Ключевые источники**:
- [MDA: A Formal Approach to Game Design and Game Research](http://www.cs.northwestern.edu/~hunicke/MDA.pdf) — оригинальная статья
- [MDA Framework – Game Design Toolkit](https://tkdev.dss.cloud/gamedesign/toolkit/mda-framework)
- [MDA Game Design Framework: Meaning, Model, Examples](https://gamedesignskills.com/game-design/mda)
- [MDA Framework - Deliberate Game Design](https://deliberategamedesign.com/mda-framework)

---

### Линзы Джесси Шелла (The Art of Game Design: A Book of Lenses)

**Описание**: Джесси Шелл proposes 100+ «линз» — наборов вопросов для анализа разных аспектов игры. Каждая линза — это视角 для оценки дизайна.

**Ключевые категории линз**:

| Категория | Примеры линз | Значение для программы |
|-----------|--------------|----------------------|
| **Игрок** | Линза Эмпатии, Линза Мотивации | Портрет игрока, мотивации |
| **Опыт** | Линза Эмоций, Линзы Чувств | Эмоциональная кривая |
| **Механики** | Линза Элементов, Линза Динамики | Структура механик |
| **История** | Линза Героя, Линза Конфликта | Нарративный каркас |
| **Процесс** | Линза Итерации, Линза Тестирования | Workflow дизайна |
| **Рынок** | Линза Аудитории, Линза Конкуренции | Позиционирование |

**Правило цикла Шелла**: «Чем больше раз вы тестируете и улучшаете дизайн, тем лучше ваша игра» (Rule of the Loop).

**Значение для Gidede**: Каждая линза → чек-лист вопросов в программе. AI может:
- Задавать вопросы из линз в интерактивном режиме
- Анализировать ответы и давать рекомендации
- Определять, какие линзы релевантны для конкретного жанра

**Ключевые источники**:
- [The Art Of Game Design - Schell Games](https://schellgames.com/art-of-game-design)
- [The Lenses of Game Design | Jesse Schell - YouTube](https://www.youtube.com/watch?v=Cc2YjcyRoMc)
- [The Art of Game Design — Jesse Schell | Medium](https://medium.com/@sherrichan/the-art-of-game-design-jesse-schell-11927c64827d)
- [Game Studies Wiki — The Art of Game Design](https://game-studies.fandom.com/wiki/The_Art_of_Game_Design:_A_Book_of_Lenses)

---

### Core Loop (Основной игровой цикл)

**Описание**: Core Loop — повторяющийся цикл действий игрока, образующий основу игрового опыта. Это «мотор» игры, удерживающий игрока.

**Структура Core Loop**:
```
Действие → Обратная связь → Награда → Мотивация → Действие → ...
```

**Типы Core Loop**:

| Тип | Описание | Пример |
|-----|----------|--------|
| **Линейный** | Последовательность уровней/миссий | Half-Life, Portal |
| **Циклический** | Повторяющийся цикл фарм→крафт→бой | Minecraft, Monster Hunter |
| **Расширяющийся** | Цикл с растущим набором действий | Civilization, Factorio |
| **Вложенный** | Микро-циклы внутри макро-цикла | RPG (бой → лут → прокачка → бой+) |

**Пять столпов Player-Centric Game Design Framework** (по gamedesignskills.com):
1. Мотивация
2. Действие
3. Обратная связь
4. Награда
5. Расширение

**Значение для Gidede**: Визуальный конструктор Core Loop — ключевой модуль:
- Drag-and-drop создание диаграммы цикла
- AI-генерация Core Loop на основе жанра и целевой эстетики
- Анализ: является ли цикл самоподдерживающимся?
- Метрики: прогноз удержания на основе структуры цикла

**Ключевые источники**:
- [How To Perfect Your Game's Core Loop - GameAnalytics](https://www.gameanalytics.com/blog/how-to-perfect-your-games-core-loop)
- [Designing The Core Gameplay Loop - Game Design Skills](https://gamedesignskills.com/game-design/core-loops-in-gameplay)
- [Core Loop - Deliberate Game Design](https://deliberategamedesign.com/core-loop)
- [Types of gameplay loops you should know - Medium](https://medium.com/@josselin.querne/types-of-gameplay-loops-you-should-know-ec10c73aed62)

---

### Game Design Patterns (Паттерны геймдизайна)

**Описание**: Повторяющиеся архитектурные решения в дизайне игр, аналогичные паттернам проектирования в программировании.

**6 ключевых паттернов геймдизайна**:

| Паттерн | Описание | Пример |
|---------|----------|--------|
| **Core Loop** | Повторяющийся цикл действий | Все игры |
| **Feedback Loop** (Позитивный/Негативный) | Усиление или компенсация действий игрока | Mario Kart (синие ракушки) |
| **Progression** | Система раскрытия контента и роста | Skill trees, уровни |
| **Emergence** | Непредсказуемое поведение из простых правил | Dwarf Fortress |
| **Economy** | Циклы создания/потребления ресурсов | MMO, F2P |
| **Metagame** | Прогрессия вне основного цикла | Достижения, рейтинг |

**Петли обратной связи**:
- **Позитивная**: Успех → Больше возможностей → Ещё больший успех (снежный ком)
- **Негативная**: Успех → Усиление вызова → Возврат к норме (балансировка)

**Значение для Gidede**: Библиотека паттернов с AI-рекомендациями:
- Выбор паттерна под жанр
- Комбинирование паттернов
- Валидация совместимости

**Ключевые источники**:
- [6 Game Design Patterns Every Designer Should Know](https://gamedevessentials.com/6-game-design-patterns-every-designer-should-know)
- [Game systems: Feedback loops - Machinations.io](https://machinations.io/articles/game-systems-feedback-loops-and-how-they-help-craft-player-experiences)
- [Game Design Theory Part 3: Systems and Gameplay - Robert Zubek](https://robert.zubek.net/docs/games-studio-2024/4-game-design-theory-gameplay.pdf)

---

## 1.1.2 Алгоритмические подходы к геймдизайну

### Процедурная генерация контента (PCG)

**Описание**: Алгоритмическое создание игрового контента (уровни, текстуры, миры) вместо ручного дизайна.

**Основные подходы**:

| Подход | Описание | Применение |
|--------|----------|-----------|
| **Генеративные грамматики** | Правила порождения структуры | Уровни, квесты |
| **Клеточные автоматы** | Простые правила → сложные паттерны | Пещеры, миры |
| **Шум Перлина / Simplex** | Гладкое случайное поле высот | Ландшафт, текстуры |
| **Wave Function Collapse** | Генерация с ограничениями | Уровни, тайлы |
| **Эволюционные алгоритмы** | Отбор лучших генераций | Контент, баланс |

**GEEvo** (arxiv, 2024): Инструмент генерации и балансировки игровой экономики с помощью эволюционных алгоритмов. Двухшаговый подход: генерация экономики → балансировка по спецификации.

**Значение для Gidede**: Алгоритмы PCG могут быть встроены для:
- Генерации черновиков уровней
- Процедурной генерации квестовых структур
- Балансировки экономики через эволюционные алгоритмы

**Ключевые источники**:
- [GEEvo: Game Economy Generation and Balancing - arXiv](https://arxiv.org/pdf/2404.18574)
- [Game Balancing via Procedural Content Generation - AAAI](https://ojs.aaai.org/index.php/AIIDE/article/view/36856/38994)
- [Procedural Content Generation for Games - MADOC](https://madoc.bib.uni-mannheim.de/59000/1/Procedural%20Content%20Generation%20for%20Games.pdf)
- [PCG Workshop Database](https://www.pcgworkshop.com/database.php)

---

### Математические модели баланса

**Три типа балансовых механик**:

#### 1. Transitive Mechanics (Транзитивные)
Все элементы выражены через единую стоимость (cost). Если A стоит 2, а B стоит 3, то B лучше A.
- **Cost Curves** — кривые стоимости: линейная, логарифмическая, экспоненциальная
- Формула: `Value = Cost^1.5` (пример для возрастающей стоимости)
- Применение: RPG-снаряжение, юниты в стратегиях

#### 2. Intransitive Mechanics (Нетранзитивные)
Циклическое преимущество: A бьёт B, B бьёт C, C бьёт A (камень-ножницы-бумага).
- Решение через теорию игр: равновесие Нэша
- Матрица выигрышей → смешанные стратегии
- Применение: RTS, карточные игры, PvP

#### 3. Probability & Randomness
- Кости, карты, RNG с контролем дисперсии
- Закон больших чисел, распределения
- Pseudo-random distribution (PRD) — снижение дисперсии

**Компьютерная балансировка**:
- **Градиентный спуск** (JUCS 2024): оптимизация параметров юнитов с минимальными изменениями
- **Эволюционные алгоритмы** (GEEvo): генерация + балансировка экономики
- **Симуляция**: автоматическое проигрывание тысяч матчей для выявления дисбаланса

**Значение для Gidede**: Модуль балансировки — один из ключевых:
- Встроенные cost curves для транзитивных систем
- Генератор нетранзитивных матриц
- Симулятор баланса с AI-оптимизацией

**Ключевые источники**:
- [Game Balance Concepts - Transitive Mechanics & Cost Curves](https://gamebalanceconcepts.wordpress.com/2010/09/01/level-9-intransitive-mechanics)
- [The Mathematics of Game Balance - UserWise](https://blog.userwise.io/blog/the-mathematics-of-game-balance)
- [Computational Game Unit Balancing - JUCS](https://lib.jucs.org/article/121185/download/pdf)
- [Applied Game Balancing Techniques - AAU](https://projekter.aau.dk/projekter/files/534400349/Game_Balance_Ceponis_Bragi.pdf)

---

### Экономическое моделирование игр

**Описание**: Проектирование виртуальных экономик — систем валют, ресурсов, источников (sources) и стоков (sinks), обеспечивающих долгосрочную устойчивость.

**Ключевые концепции**:

| Концепция | Описание |
|-----------|----------|
| **Sources** (Источники) | Способы получения ресурсов игроком (фарм, награды, покупки) |
| **Sinks** (Стоки) | Способы расходования ресурсов (апгрейды, крафт, налоги) |
| **Тап экономики** | Объём вливания/извлечения ресурсов в единицу времени |
| **Инфляция** | Избыточный рост денежной массы → обесценивание |
| **Дефляция** | Недостаток валюты → стагнация прогрессии |

**Типы валют**:
1. **Hard Currency** — покупается за реальные деньги (гемы, монеты)
2. **Soft Currency** — зарабатывается в игре (золото, опыт)
3. **Social Currency** — обмен между игроками
4. **Tertiary Currency** — специфические ресурсы (энергоэлементы и т.д.)

**Архитектура экономики**:
```
Фарм (Source) → Накопление → Выбор траты (Sink) → Прогрессия → Новые потребности → Фарм+
```

**Machinations.io**: Платформа визуального моделирования игровых экономик с симуляцией в реальном времени.

**Значение для Gidede**: Модуль экономического моделирования:
- Визуальный редактор потоков ресурсов (как Machinations)
- AI-генерация экономики на основе жанра и метрик
- Симуляция инфляции/дефляции
- Автобалансировка источников и стоков

**Ключевые источники**:
- [Game Economy Design - Metavert](https://www.metavert.io/game-economy-design)
- [What is game economy design - Machinations.io](https://machinations.io/articles/what-is-game-economy-design)
- [Designing Game Economies: Inflation, Resource Management - Medium](https://medium.com/@msahinn21/designing-game-economies-inflation-resource-management-and-balance-fa1e6c894670)
- [Building A Lasting Free To Play Economy](https://mobilefreetoplay.com/bible/building-lasting-free-play-economy)
- [Book Excerpt: Game Economy Design - Game Developer](https://www.gamedeveloper.com/design/book-excerpt-game-economy-design-metagame-monetization-and-live-operations)

---

## 1.1.3 Существующие AI-инструменты для геймдизайна

### Обзор рынка AI-инструментов (2025-2026)

| Инструмент | Назначение | Категория |
|------------|-----------|-----------|
| **Promethean AI** | Автоматизация создания 3D-сред | Environment Art |
| **Gaia Pro** | Процедурная генерация ландшафтов для Unity | Level Design |
| **Meshy AI** | Генерация 3D-моделей из текста | Asset Creation |
| **Machinations.io** | Визуальное моделирование игровых экономик | Economy Design |
| **Scenario** | Генерация 2D-ассетов в едином стиле | Art Style |
| **Inworld AI** | AI-driven NPC с диалогами | Narrative |
| **Ludo.ai** | AI-генерация концепций игр | Game Ideation |
| **Rosebud AI** | Генерация игровых ассетов и спрайтов | Asset Creation |

### Ключевой инсайт: НИКТО не делает то, что планируем мы

**Пробел на рынке**: Все существующие AI-инструменты для игр фокусируются на:
- ✅ Генерации арта и ассетов
- ✅ Кодинг-ассистентах
- ✅ Процедурной генерации уровней
- ❌ **Структурном геймдизайне** (механики, баланс, GDD)
- ❌ **AI-ассистенте для принятия дизайнерских решений**
- ❌ **Генерации и валидации игровых систем**

**Gidede займёт уникальную нишу**: AI-first инструмент для структурного геймдизайна, а не для генерации контента.

**Исследование**: «Generative AI in Game Design: Enhancing Creativity or Constraining It?» (PMC, 2025) — ключевой вопрос: усиливает ли AI креативность или ограничивает? Наш подход: AI как усилитель, не заменитель.

**Ключевые источники**:
- [Best AI Tools for Game Development - Fgfactory](https://fgfactory.com/best-ai-tools-for-game-development)
- [Best AI Tools for Game Designers in 2026 - Strate.in](https://strate.in/best-ai-tools-for-game-designers-2026)
- [Generative AI in Game Design - PMC/NIH](https://pmc.ncbi.nlm.nih.gov/articles/PMC12193870)
- [7 AI Tools for Game Level Design](https://gamedesignskills.com/game-design/level-design-ai-tools)

---

## 1.1.4 Системы документирования геймдизайна

### Game Design Document (GDD)

**Типы документов**:

| Тип | Объём | Назначение |
|-----|-------|-----------|
| **One-Pager** | 1 страница | Быстрый питч концепции |
| **Pitch Deck** | 5-10 страниц | Презентация для инвесторов/издателей |
| **GDD (полный)** | 20-100+ страниц | Полная документация для команды |
| **Living GDD** | Wiki/Confluence | Постоянно обновляемый документ |
| **Macro GDD** | 5-15 страниц | Высокоуровневый документ (современный тренд) |

### Структура One-Pager:
- Название игры
- Жанр и платформа
- Целевая аудитория
- Elevator Pitch (1-2 предложения)
- Core Loop
- Уникальное торговое предложение (USP)
- Визуальный стиль

### Структура полного GDD:
1. Обзор и концепция
2. Целевая аудитория и рынок
3. Геймплей и Core Loop
4. Механики и правила
5. Прогрессия и экономика
6. Уровни и мир
7. Персонажи и нарратив
8. UI/UX
9. Арт-стиль и аудио
10. Технические требования
11. Монетизация
12. LiveOps план

### Современный тренд: «Macro GDD»
Современные студии уходят от 100-страничных GDD в сторону коротких Macro GDD (5-15 страниц) с живой документацией в wiki. Причина: длинные GDD устаревают ещё до завершения разработки.

**Значение для Gidede**: Модуль генерации GDD:
- Генерация One-Pager → Pitch Deck → Macro GDD
- Шаблоны под разные жанры
- Автозаполнение на основе введённых данных
- Экспорт в PDF/DOCX

**Ключевые источники**:
- [Game Design Document: Definition, Template, Example](https://gamedesignskills.com/game-design/document)
- [How to write a Game Design Document in 2024 - Game Developer](https://www.gamedeveloper.com/design/how-to-write-a-game-design-document)
- [An Actionable Game Design Document Template - David Mullich](https://davidmullich.com/2018/06/25/an-actionable-game-design-document-template)
- [From One Sheet to Pitch Deck - Press Start Leadership](https://pressstartleadership.com/from-one-sheet-to-pitch-deck-and-beyond-building-game-pitches-that-land-deals)

---

## 1.1.5 Кейсы профессиональных студий

### Workflow геймдизайна (обобщение)

**AAA-студии** (3-5 лет разработки):
1. **Pre-production** (6-12 мес.) — Концепт, прототип, вертикальный срез
2. **Production** (18-36 мес.) — Контент, механики, итерации
3. **Alpha** — Функциональная完整性
4. **Beta** — Контент-завершённость
5. **Gold / Live** — Релиз + оперирование

**Indie-студии** (6-24 мес.):
1. **Прототип** — Быстрая проверка концепции
2. **Pivot** — Смена направления на основе тестирования
3. **Вертикальный срез** — Демонстрация финального качества
4. **Производство** — Наполнение контентом
5. **Полировка** — Фиксы, баланс, UX

### Ключевые принципы профессионального процесса:

| Принцип | Описание |
|---------|----------|
| **Rule of the Loop** (Шелл) | Итерируй как можно чаще — тест → улучшение → тест |
| **Fail Fast** | Быстрое прототипирование для отсева неудачных идей |
| **Vertical Slice** | Маленький, но законченный фрагмент финального качества |
| **Pivot** | Готовность радикально изменить направление |
| **Playtest Early** | Плейтесты с первого прототипа |
| **Data-Driven Design** | Решения на основе метрик, не только интуиции |

**Значение для Gidede**: Программа должна поддерживать итеративный процесс:
- Быстрый старт → One-Pager → Расширение → Детализация
- На каждом этапе — AI-ассистент с вопросами и рекомендациями
- Экспорт на любой стадии для обсуждения с командой

**Ключевые источники**:
- [Game Development Process - Perforce](https://www.perforce.com/resources/game-development-process)
- [From Concept to Reality: The Game Design Workflow Explained](https://arenaparkstreet.com/from-concept-to-reality-the-game-design-workflow-explained)
- [AAA Game Development & Studio Strategies - Juego Studio](https://www.juegostudio.com/blog/guide-to-aaa-game-development-and-studio-strategies)
- [Game Development Process - GDKeys](https://gdkeys.com/game-development-process)

---

## Сводная карта методологий

```
┌─────────────────────────────────────────────────┐
│                GIDEDE: ЯДЕРНАЯ МОДЕЛЬ            │
├─────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐   │
│  │   MDA    │    │  Линзы   │    │  Core    │   │
│  │ Framework│    │  Шелла   │    │  Loop    │   │
│  │(М-Д-Э)  │    │ (100+)   │    │ (Циклы)  │   │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘   │
│       │               │               │          │
│       └───────────────┼───────────────┘          │
│                       ▼                          │
│              ┌────────────────┐                  │
│              │   ПАТТЕРНЫ     │                  │
│              │ Геймдизайна    │                  │
│              └────────┬───────┘                  │
│                       ▼                          │
│       ┌───────────────┼───────────────┐          │
│       ▼               ▼               ▼          │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐     │
│  │ Баланс  │   │Экономика │   │Прогрессия│     │
│  │(Trans/  │   │(Sources/ │   │(Системы  │     │
│  │Intrans) │   │Sinks)    │   │роста)    │     │
│  └─────────┘   └──────────┘   └──────────┘     │
│                       │                          │
│                       ▼                          │
│              ┌────────────────┐                  │
│              │   AI-АССИСТЕНТ │                  │
│              │  + АЛГОРИТМЫ   │                  │
│              └────────┬───────┘                  │
│                       ▼                          │
│              ┌────────────────┐                  │
│              │ GDD / One-Pager│                  │
│              │ Pitch Deck     │                  │
│              └────────────────┘                  │
└─────────────────────────────────────────────────┘
```

---

## Выводы и рекомендации для следующих фаз

### Ключевые выводы:

1. **MDA Framework** — лучший фундамент для формализации геймдизайна. Должен стать ядром модели данных программы.

2. **Линзы Шелла** — готовый набор из 100+ чек-листов. Идеально для интерактивного AI-ассистента.

3. **Core Loop** — визуальный конструктор циклов должен быть центральным UI-элементом программы.

4. **Баланс**: Транзитивные/нетранзитивные модели + cost curves — математически формализуемы и алгоритмизируемы.

5. **Экономика**: Machinations.io — ближайший аналог для визуального моделирования. Но без AI.

6. **Ниша Gidede уникальна**: Никто не делает AI-first инструмент для СТРУКТУРНОГО геймдизайна.

7. **GDD-генерация**: Современный тренд — короткие Macro GDD + живая документация. Не нужно генерить 100-страничные талмуды.

8. **Итеративность**: Программа должна поддерживать быстрый цикл «идея → прототип → тест → улучшение».

### Приоритеты для Фазы 2 (Библия геймдизайна):

1. MDA как центральный фреймворк
2. Core Loop как структурный элемент
3. Математика баланса (transitive/intransitive)
4. Экономические модели (sources/sinks)
5. Паттерны геймдизайна
6. Линзы Шелла как система валидации
7. GDD-структуры и шаблоны
