"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle,
  Rocket,
  BookOpen,
  Lightbulb,
  FlaskConical,
  RefreshCw,
  Scale,
  TrendingUp,
  FileText,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  Info,
  Sparkles,
  Target,
  Triangle,
  Layers,
  CircleDot,
  Workflow,
  Gamepad2,
  ArrowLeftRight,
  AlertTriangle,
  Bot,
  Puzzle,
} from "lucide-react";

// ============================================================
// Quick Start — 8 шагов
// ============================================================

interface QuickStep {
  num: number;
  title: string;
  description: string;
  screenshot: string;
  screenshotAlt: string;
  href: string;
  hrefLabel: string;
  bullets: string[];
}

const QUICK_STEPS: QuickStep[] = [
  {
    num: 1,
    title: "Создайте проект",
    description:
      "Перейдите на страницу «Мои проекты», нажмите «Новый проект» и заполните название, описание идеи и (опционально) жанр. Можно выбрать готовый шаблон из 12 пресетов или нажать «Случайно» для генерации идею-стартера.",
    screenshot: "/help/projects.png",
    screenshotAlt: "Страница Мои проекты со списком проектов и кнопкой Новый проект",
    href: "/projects",
    hrefLabel: "Открыть «Мои проекты»",
    bullets: [
      "Название проекта — обязательное поле",
      "Описание идеи — 1–5 предложений, что за игра",
      "Жанр можно определить автоматически в Блоке 1",
      "Новый проект сразу становится «активным» — его увидят все блоки",
    ],
  },
  {
    num: 2,
    title: "Откройте карточку проекта",
    description:
      "Кликните на карточку проекта в списке — откроется страница проекта с прогрессом по 8 блокам, статусами заполнения и быстрым доступом к каждому блоку. Здесь видно, какие блоки уже заполнены, а какие ждут своей очереди.",
    screenshot: "/help/home.png",
    screenshotAlt: "Главная страница Gidede с 8 блоками",
    href: "/projects",
    hrefLabel: "Перейти к списку проектов",
    bullets: [
      "Прогресс по блокам считается автоматически",
      "Карточки блоков кликабельны — сразу переходите в нужный блок",
      "Активный проект хранится в localStorage — все блоки используют именно его",
    ],
  },
  {
    num: 3,
    title: "Сгенерируйте концепцию",
    description:
      "В Блоке 1 (Генератор концепции) введите идею игры (1–5 предложений), выберите жанр или оставьте автоопределение, и нажмите «Сгенерировать». Алгоритм за 7 стадий выдаст: жанр, эстетический профиль (MDA), набор механик из MechanicsDB (128 механик), 3 кандидата Core Loop и 3 USP-кандидата с проверкой Triangle of Weirdness.",
    screenshot: "/help/block1-concept.png",
    screenshotAlt: "Блок 1 — Генератор концепции",
    href: "/blocks/1",
    hrefLabel: "Открыть Блок 1",
    bullets: [
      "Идея — что угодно: «Тёмный фэнтези-рогалик про сбор душ»",
      "7 стадий: жанр → эстетика → механики → Core Loop → USP → валидация → отчёт",
      "Чек-бокс «AI-обогащение» добавит креативные подсказки от LLM (50 запросов/день бесплатно)",
      "Результат сохраняется в БД и автоматически подхватывается остальными блоками",
    ],
  },
  {
    num: 4,
    title: "Спроектируйте Core Loop",
    description:
      "В Блоке 2 (Core Loop Designer) данные из концепции подтянутся автоматически: механики, жанр, тип цикла. Нажмите «Сгенерировать» — получите 5-шаговый Core Loop с ресурсами, типом структуры (Engine / Economy / Ecology), иерархией петель (micro → meta), детекцией патологий (Stall, Oscillation, Brittleness) и рекомендациями. Затем отредактируйте шаги в редакторе — переименуйте, добавьте, удалите, поменяйте feedback-тип.",
    screenshot: "/help/block2-coreloop.png",
    screenshotAlt: "Блок 2 — Core Loop Designer с диаграммой цикла",
    href: "/blocks/2",
    hrefLabel: "Открыть Блок 2",
    bullets: [
      "Тип структуры определяется автоматически по механикам: Engine (один ресурс-двигатель), Economy (источник + сток), Ecology (баланс нескольких пулов)",
      "Валидация: замкнутость цикла, sufficiency ресурсов, 30-second fun test",
      "Редактор шагов сохраняет изменения в БД без полной перегенерации",
      "Core Loop обязателен для генерации прототипа — без него прототип будет пустым",
    ],
  },
  {
    num: 5,
    title: "MDA-анализ",
    description:
      "В Блоке 3 (MDA Lab) эстетики подтянутся из концепции. Нажмите «Анализ» — получите Reverse MDA (от механик к эстетикам), Classic MDA (от эстетик к механикам), Bond Matrix (механика ↔ динамика ↔ эстетика), и аудит 8 линз Шелла. Это связывает ваши механики с эмоциональным опытом игрока.",
    screenshot: "/help/block3-mda.png",
    screenshotAlt: "Блок 3 — MDA Lab",
    href: "/blocks/3",
    hrefLabel: "Открыть Блок 3",
    bullets: [
      "8 эстетик Hunicke-LeBlanc-Zubek: Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission",
      "Bond Matrix показывает, какие механики порождают какие динамики и эстетики",
      "8 линз Шелла: Элемент, Эмоция, Феномен, Процесс, Игрок, Характер, Элегантность, Гармония",
    ],
  },
  {
    num: 6,
    title: "Баланс и Прогрессия",
    description:
      "В Блоке 4 (Баланс) добавьте игровые объекты (оружие, броня, предметы) с их cost и power — система рассчитает transitive и intransitive баланс, payoff-матрицу, проведёт Monte Carlo симуляцию и визуализирует Machinations-граф. В Блоке 5 (Прогрессия) настройте макро-параметры, кривые опыта и контент-план по уровням.",
    screenshot: "/help/block1-concept.png",
    screenshotAlt: "Блок 4 — Баланс и симуляция",
    href: "/blocks/4",
    hrefLabel: "Открыть Блок 4",
    bullets: [
      "Transitive баланс: объекты сравнимы по power/cost ratio",
      "Intransitive (rock-paper-scissors): каждый объект сильнее другого, но слабее третьего",
      "Блок 5: 30+ уровней прогрессии, exponential / linear / logistic кривые",
      "Механики для баланса подгружаются автоматически из Core Loop (Блок 2)",
    ],
  },
  {
    num: 7,
    title: "GDD",
    description:
      "В Блоке 6 (GDD Generator) выберите формат документa (one_sheet, pitch, mini_gdd, full_gdd, mega_gdd) и нажмите «Сгенерировать GDD». Получите структурированный документ по 38 секциям Роджерса с чек-листом валидации. Редактируйте секции в GDD Section Editor и экспортируйте в DOCX.",
    screenshot: "/help/knowledge.png",
    screenshotAlt: "Блок 6 — GDD Generator",
    href: "/blocks/6",
    hrefLabel: "Открыть Блок 6",
    bullets: [
      "5 форматов: от one-pager до mega-GDD (38 секций)",
      "5 типов чек-листов валидации: полный, UX, технический, маркетинговый, бюджетный",
      "GDD Section Editor — редактирование каждой секции вручную с авто-сохранением",
      "Экспорт в DOCX с сохранением форматирования",
    ],
  },
  {
    num: 8,
    title: "Запустите полный пайплайн",
    description:
      "На странице «Пайплайн» нажмите «Запустить пайплайн» — система прогонит все блоки по цепочке: Концепция → Core Loop → MDA → Баланс → Прогрессия → GDD. Это удобно, когда у вас уже есть идея и вы хотите быстро получить первый GDD. После пайплайна все блоки автоматически обновятся.",
    screenshot: "/help/pipeline.png",
    screenshotAlt: "Страница Пайплайн с прогрессом по блокам",
    href: "/pipeline",
    hrefLabel: "Открыть Пайплайн",
    bullets: [
      "Пайплайн прогоняет все 6 блоков за один запуск",
      "Можно запускать отдельные блоки или всю цепочку",
      "После пайплайна блоки помечаются «stale», если исходные данные изменились",
      "Уведомления о stale-данных показываются вверху каждой страницы",
    ],
  },
];

// ============================================================
// Worked Example — Shadow Depths
// ============================================================

interface ExampleStep {
  block: string;
  blockHref: string;
  icon: typeof Lightbulb;
  action: string;
  input: string;
  result: string;
  resultBullets: string[];
}

const EXAMPLE_STEPS: ExampleStep[] = [
  {
    block: "Блок 1 • Концепция",
    blockHref: "/blocks/1",
    icon: Lightbulb,
    action: "Вводим идею",
    input: "«Тёмный фэнтези-рогалик, где вы собираете души павших врагов, чтобы прокачивать персонажа и спускаться глубже в подземелья»",
    result:
      "Алгоритм определяет жанр Roguelike, эстетики Challenge + Discovery + Sensation, 12 механик из MechanicsDB (Броня, Очки опыта, Перки, Изучение мира, map_exploration, ...), 3 кандидата Core Loop и 3 USP.",
    resultBullets: [
      "Жанр: roguelike",
      "Эстетики: challenge (primary), discovery (secondary), sensation (tertiary)",
      "Mechanic Set: 12 механик в 6 группах (base / combat / progression / spatial / social)",
      "USP-кандидат: «A roguelike where every decision reshapes the world — combining dark roguelike with emergent narrative consequences»",
      "Triangle of Weirdness: pass (weird ✓, appealing ✓, credible ✗)",
    ],
  },
  {
    block: "Блок 2 • Core Loop",
    blockHref: "/blocks/2",
    icon: RefreshCw,
    action: "Генерируем Core Loop",
    input: "Механики подтянулись автоматически из концепции (explore, combat, reward, progress, return). Тип цикла — Ecology.",
    result:
      "5-шаговый цикл типа ecology (balanced_ecology с торможением). 9 ресурсов, inner loop 16s, outer loop 300s. Обнаружены 3 патологии (Stall, Brittleness, Oscillation), все уровня warning/info — корректируемы.",
    resultBullets: [
      "Шаг 1: Find target (explore) → produces signal, 6s",
      "Шаг 2: Engage (combat) → consumes energy+ammo, 10s, negative feedback",
      "Шаг 3: Collect rewards → produces xp+gold, 4s, positive feedback",
      "Шаг 4: Upgrade → consumes gold, produces power+ability, 8s, positive",
      "Шаг 5: Return to base → produces rest+save, 5s",
      "Иерархия петель: micro (16s) → small → medium → large → macro → meta (7 дней)",
    ],
  },
  {
    block: "Блок 3 • MDA",
    blockHref: "/blocks/3",
    icon: FlaskConical,
    action: "Анализируем MDA",
    input: "Эстетики (challenge + discovery + sensation) и механики (explore, combat, reward, progress) подтянулись из концепции.",
    result:
      "Reverse MDA: механики (explore + combat) → динамики (skill_scaling + difficulty_curves + exploration_loops) → эстетики (challenge + discovery). Bond Matrix связывает 12 механик с 8 эстетиками через 4 динамики.",
    resultBullets: [
      "Core dynamics: skill_scaling, difficulty_curves, mastery_growth (из challenge)",
      "Supporting dynamics: exploration_loops, secret_finding, world_unfolding (из discovery)",
      "Emergence potential: strong — игрок будет придумывать собственные билды",
      "8 линз Шелла: пройдены 6/8, нужны доработки по линзам «Игрок» и «Элегантность»",
    ],
  },
  {
    block: "Блок 4 • Баланс",
    blockHref: "/blocks/4",
    icon: Scale,
    action: "Балансируем предметы",
    input: "Добавляем 4 объекта: Меч (cost 10, power 25, tier 1), Лук (cost 12, power 22, tier 1), Броня (cost 15, power 18 defensive, tier 1), Зелье (cost 5, power 12 single-use, tier 0).",
    result:
      "Transitive анализ: Лук немного дороже Меча, но слабее в ближнем бою — imbalance 0.85 (нормально для ranged-преимущества). Intransitive: Меч > Лук (ближний бой), Лук > Броня (дальний пробивает), Броня > Меч (танк). Monte Carlo 1000 боёв: 38% wins with sword, 34% bow, 28% armor.",
    resultBullets: [
      "Transitive score: 0.78 — приемлемо (>0.7)",
      "Payoff matrix 3×3: rock-paper-scissors между мечом, луком, бронёй",
      "Зелье — расходник, в симуляции используется в 22% боёв",
      "Корректировка: увеличить cost брони до 18 (power 18 → ratio 1.0 vs меч 2.5)",
    ],
  },
  {
    block: "Блок 5 • Прогрессия",
    blockHref: "/blocks/5",
    icon: TrendingUp,
    action: "Проектируем прогрессию",
    input: "30 уровней, exponential кривая (factor 1.15), контент-план: 5 биомов × 6 уровней, боссы каждые 6 уровней.",
    result:
      "Кривая XP: уровень 1 → 100 XP, уровень 30 → ~6 600 XP. Контент-план: биомы (Catacombs → Crypts → Caverns → Abyss → Throne), по 3 типа врагов на биом, 5 боссов. Тир-гейтинг: оружие T0 (старт) → T1 (биом 1) → T2 (биом 3) → T3 (биом 5).",
    resultBullets: [
      "Кривая: exponential, factor 1.15 — типично для roguelike",
      "Время до уровня: 5 мин (L1) → 25 мин (L30) — retention-friendly",
      "Контент-план: 15 типов врагов, 5 боссов, 30 уникальных комнат",
      "Валидация: пиковая нагрузка на L15 (биом 3) — нужен контент-усилитель",
    ],
  },
  {
    block: "Блок 6 • GDD",
    blockHref: "/blocks/6",
    icon: FileText,
    action: "Генерируем GDD",
    input: "Формат one_sheet (1-страничный концепт-документ). Все блоки уже заполнены — генерируем.",
    result:
      "One-sheet GDD на 1 страницу: название, жанр, целевая аудитория, краткий синопсис, 4 unique features, 3 конкурента (Hades, Dead Cells, Slay the Spire), Core Loop диаграмма, USP-заявление. Экспорт в DOCX — готовый документ для publisher pitch.",
    resultBullets: [
      "Формат one_sheet — 1 страница, для publisher pitch",
      "Содержит: название, жанр, аудитория, синопсис, USP, Core Loop, конкуренты",
      "Чек-лист валидации: 5 вопросов Schell, 8 фильтров, triangle of weirdness — все пройдены",
      "Экспорт в DOCX: 1 файл, готов к отправке",
    ],
  },
  {
    block: "Шаг 7 • Прототип",
    blockHref: "/prototypes",
    icon: Gamepad2,
    action: "Создаём играбельный прототип",
    input:
      "Заходим на страницу «Прототипы» (/prototypes), выбираем проект «Shadow Depths», тип прототипа — tower_defense (ближе всего к рогалик-боям с защитой), режим — 2D. Нажимаем «Сгенерировать прототип».",
    result:
      "В iframe загружается играбельный HTML-прототип на LittleJS (2D, ~50 КБ). Шаги Core Loop (explore → combat → reward → progress → return) реализованы как игровые механики: спавн врагов, стрельба, подбор душ (ресурс), улучшения между волнами. Можно играть прямо в браузере — WASD + мышь.",
    resultBullets: [
      "Тип: tower_defense с элементами roguelike-боя",
      "Режим: 2D (LittleJS-движок, ~50 КБ)",
      "Ресурс: души павших врагов → прокачка между волнами",
      "Цель: выжить N волн, набрать максимум очков",
      "AI-инсайты: рекомендации по балансу волн и темпу",
      "Также можно собрать кастомный прототип через Node-редактор /prototype-editor",
    ],
  },
];

// ============================================================
// Block Functions — детальный справочник по 8 блокам
// ============================================================

interface BlockFunction {
  id: number;
  name: string;
  href: string;
  icon: typeof Lightbulb;
  status: string;
  description: string;
  inputs: string[];
  outputs: string[];
  howToUse: string[];
}

const BLOCK_FUNCTIONS: BlockFunction[] = [
  {
    id: 1,
    name: "Генератор концепции",
    href: "/blocks/1",
    icon: Lightbulb,
    status: "active",
    description:
      "Превращает идею в структурированную концепцию: жанр, эстетики, механики, Core Loop, USP.",
    inputs: [
      "Идея игры (1–5 предложений)",
      "Жанр (авто или ручной выбор)",
      "Мотивации аудитории (1–3 из 12 по модели Йи)",
      "Базовые механики (опционально, иначе AI подберёт)",
      "Уровень опыта, платформы, бюджет",
      "Референтные игры, запрещённые механики",
    ],
    outputs: [
      "OnePager — название, жанр, синопсис",
      "AestheticProfile — 8 эстетик Hunicke с ранжированием",
      "DynamicsProfile — игровые динамики",
      "MechanicSet — 8–12 механик из MechanicsDB (128)",
      "3 кандидата Core Loop",
      "3 USP-кандидата + Triangle of Weirdness",
      "ValidationReport — отчёт о корректности концепции",
    ],
    howToUse: [
      "Введите идею → выберите мотивации → (опционально) механики",
      "Нажмите «Сгенерировать концепцию» (7 стадий, ~5 сек)",
      "Результат сохраняется в БД и подхватывается Блоками 2–6 автоматически",
      "Чек-бокс «AI-обогащение» добавит креативные подсказки от LLM",
    ],
  },
  {
    id: 2,
    name: "Core Loop Designer",
    href: "/blocks/2",
    icon: RefreshCw,
    status: "active",
    description:
      "Визуальный конструктор основного игрового цикла. Иерархия петель, диагностика патологий, валидация.",
    inputs: [
      "Механики (автоматически из Блока 1)",
      "Жанр (из концепции)",
      "Тип цикла: auto / engine / economy / ecology / hybrid",
    ],
    outputs: [
      "LoopHierarchy — 5-step core loop с длительностями",
      "PathologyReport — Stall / Oscillation / Brittleness",
      "Recommendations — рекомендации по улучшению",
      "Steps — редактируемые шаги с feedback-типом",
      "Структурный тип: Engine / Economy / Ecology / Hybrid",
    ],
    howToUse: [
      "Данные подтягиваются из концепции автоматически",
      "Нажмите «Сгенерировать» — получите 5-шаговый цикл",
      "Редактируйте шаги в редакторе (переименовать, добавить, удалить)",
      "Нажмите «Сохранить» — изменения запишутся без перегенерации",
    ],
  },
  {
    id: 3,
    name: "MDA Lab",
    href: "/blocks/3",
    icon: FlaskConical,
    status: "active",
    description:
      "Reverse MDA, Classic MDA, Bond Matrix и аудит 8 линз Шелла. Связывает механики с эмоциями игрока.",
    inputs: [
      "Эстетики (автоматически из Блока 1)",
      "Механики (из концепции или Core Loop)",
    ],
    outputs: [
      "MatchScores — насколько механики создают нужные эстетики",
      "LensValidation — аудит 8 линз Шелла (pass/fail)",
      "BondValidation — связи механика ↔ динамика ↔ эстетика",
      "Reverse MDA — от механик к эстетикам",
      "Classic MDA — от эстетик к механикам",
    ],
    howToUse: [
      "Эстетики подтягиваются из концепции автоматически",
      "Нажмите «Анализ» — получите отчёт по MDA",
      "Видите, насколько ваши механики создают нужные эстетики",
      "Bond Matrix показывает, какие механики порождают какие эмоции",
    ],
  },
  {
    id: 4,
    name: "Баланс и симуляция",
    href: "/blocks/4",
    icon: Scale,
    status: "active",
    description:
      "Transitive/intransitive анализ, Monte Carlo симуляция, Machinations-визуализация экономики.",
    inputs: [
      "Объекты (оружие, броня, предметы) — вручную или из пайплайна",
      "Cost и Power каждого объекта",
      "Tier (0–3) для transitive-анализа",
      "Тип баланса: transitive / intransitive",
    ],
    outputs: [
      "CostPowerCurves — кривые power/cost ratio",
      "PayoffMatrix — матрица rock-paper-scissors",
      "MonteCarloResults — win-rate после 1000+ боёв",
      "Machinations-граф — визуализация экономики",
      "BalanceScore + рекомендации по корректировке",
    ],
    howToUse: [
      "Добавьте объекты вручную через ObjectForm или загрузите из пайплайна",
      "Укажите cost, power, tier для каждого",
      "Нажмите «Анализ» — получите balance-score и рекомендации",
      "Monte Carlo прогоняет 1000 симуляций боёв автоматически",
    ],
  },
  {
    id: 5,
    name: "Экономика и прогрессия",
    href: "/blocks/5",
    icon: TrendingUp,
    status: "active",
    description:
      "Конструктор внутренней экономики (Machinations). Кривые прогрессии, контент-план по уровням.",
    inputs: [
      "Total levels — количество уровней (5–100)",
      "Тип кривой: linear / exponential / logistic",
      "Factor (множитель роста для exponential)",
      "Макро-параметры (источники, стоки, темп)",
    ],
    outputs: [
      "ProgressionCurves — кривые XP и времени по уровням",
      "ContentPlan — распределение контента (биомы, враги, боссы)",
      "ResourceModel — экономическая модель (Machinations)",
      "Tiers — tier-gating предметов по уровням",
      "Validation — проверка пиков нагрузки и контент-дефицита",
    ],
    howToUse: [
      "Укажите количество уровней и тип кривой",
      "Нажмите «Сгенерировать» — получите кривые XP, контент-план, экономику",
      "Проверьте Validation на пиковые нагрузки",
      "Механики для экономики подгружаются из Core Loop (Блок 2)",
    ],
  },
  {
    id: 6,
    name: "GDD Generator",
    href: "/blocks/6",
    icon: FileText,
    status: "active",
    description:
      "Генерация дизайн-документов по шаблонам (38 секций Роджерса). 5 типов чек-листов валидации.",
    inputs: [
      "Формат: one_sheet / pitch / mini_gdd / full_gdd / mega_gdd",
      "Все данные из Блоков 1–5 (подтягиваются автоматически)",
      "Тип чек-листа: полный / UX / технический / маркетинговый / бюджетный",
    ],
    outputs: [
      "GDDSection[] — массив секций с заголовком и содержимым",
      "ConsistencyIssue[] — найденные несоответствия",
      "Checklist — валидационный чек-лист (5 вопросов Schell, 8 фильтров, triangle of weirdness)",
      "DOCX-экспорт — готовый документ для отправки",
    ],
    howToUse: [
      "Выберите формат документа (от one_sheet до mega_gdd)",
      "Нажмите «Сгенерировать GDD» — система соберёт секции из всех блоков",
      "Редактируйте секции в GDD Section Editor (авто-сохранение)",
      "Нажмите «Экспорт в DOCX» — скачаете готовый файл",
    ],
  },
  {
    id: 7,
    name: "AI-ассистент",
    href: "/blocks/7",
    icon: Bot,
    status: "active",
    description:
      "Контекстно-осведомлённый чат-бот. Знает ваш проект, цитирует книги, предлагает рекомендации.",
    inputs: [
      "Контекст активного проекта (Concept / Core Loop / MDA / ...)",
      "История чата (для многошаговых диалогов)",
      "Вопрос пользователя на естественном языке",
    ],
    outputs: [
      "Ответ с учётом вашего проекта (RAG по 17 книгам Библии геймдизайна)",
      "Рекомендации по следующему шагу",
      "Алёрты — если найдены проблемы в текущих данных",
      "Streaming-ответ через SSE",
    ],
    howToUse: [
      "Откройте Блок 7 — увидите чат с историей",
      "Задавайте вопросы: «Как улучшить баланс?», «Какой жанр лучше?»",
      "AI отвечает с учётом вашего активного проекта",
      "Бесплатный лимит: 50 запросов/день (виден в сайдбаре)",
    ],
  },
  {
    id: 8,
    name: "Интеграция GBE",
    href: "/blocks/8",
    icon: Puzzle,
    status: "active",
    description:
      "API Bridge для GDCombine. Blueprint-синхронизация, Linter-правила, шаблоны документов.",
    inputs: [
      "Project ID — активный проект",
      "Компоненты для синхронизации (concept, core_loop, mda, ...)",
      "Blueprint-правила (validation rules)",
    ],
    outputs: [
      "Синхронизированные компоненты во внешнем GDCombine (mock)",
      "Linter-отчёт — найденные нарушения правил",
      "Sync history — история синхронизаций",
      "Webhook-уведомления об изменениях",
    ],
    howToUse: [
      "Выберите проект → нажмите «Sync to GBE»",
      "Bridge передаёт компоненты во внешний GDCombine (mock-режим)",
      "«Sync from GBE» — получить обратные правки из GDCombine",
      "Вебхук принимает уведомления об изменениях автоматически",
    ],
  },
];

// ============================================================
// Game Design Basics — справка
// ============================================================

interface ConceptCard {
  title: string;
  icon: typeof Target;
  summary: string;
  details: string[];
}

const BASICS_CONCEPTS: ConceptCard[] = [
  {
    title: "MDA Framework",
    icon: Layers,
    summary:
      "Фреймворк Hunicke-LeBlanc-Zubek (2004). Связывает правила игры с опытом игрока через 3 уровня.",
    details: [
      "Mechanics — правила, данные, алгоритмы игры («как устроено»)",
      "Dynamics — поведение механик во время игры («что происходит»)",
      "Aesthetics — эмоциональный отклик игрока («что чувствует»)",
      "8 эстетик: Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission",
      "Пример: механика «ограниченные патроны» → динамика «экономия выстрелов» → эстетика Challenge",
    ],
  },
  {
    title: "Core Loop — типы структур",
    icon: RefreshCw,
    summary:
      "Базовый цикл действий игрока. Тип структуры определяет, какие ресурсы участвуют и как они движутся.",
    details: [
      "Engine — один ресурс-двигатель крутит цикл (clicker, idle). Пример: Cookie Clicker",
      "Economy — есть источник и сток ресурса, балансируется faucet/drain. Пример: StarCraft",
      "Ecology — несколько пулов ресурсов балансируют друг друга с торможением. Пример: Spore",
      "Hybrid — смесь типов, обычно Engine + Economy. Пример: Diablo (combat = engine, gold = economy)",
      "Gidede определяет тип автоматически по набору механик из концепции",
    ],
  },
  {
    title: "Triangle of Weirdness (Rogers)",
    icon: Triangle,
    summary:
      "Scott Rogers: каждая игра балансирует между Familiarity, Novelty и Usability. Идеальная игра — в центре треугольника.",
    details: [
      "Familiarity — игрок сразу понимает, что делать (жанровые конвенции)",
      "Novelty — есть что-то новое, что цепляет (USP)",
      "Usability — механики интуитивны и хорошо описаны",
      "Triangle check: weird (новое есть) + appealing (привлекает) + credible (достоверно)",
      "Если «weird» = false → игра скучная. Если «appealing» = false → никто не купит. Если «credible» = false → не поверят",
    ],
  },
  {
    title: "8 линз Шелла",
    icon: CircleDot,
    summary:
      "Jesse Schell, The Art of Game Design. 8 базовых линз для анализа игры с разных сторон.",
    details: [
      "Линза Элемента — из чего состоит игра (механики, эстетика, история, технология)",
      "Линза Эмоции — какие эмоции вызывает игра у игрока",
      "Линза Феномена — где происходит игра (мир, окружение)",
      "Линза Процесса — что игрок делает момент-к-моменту",
      "Линза Игрока — кто играет и зачем",
      "Линза Характера — какова личность игры",
      "Линза Элегантности — насколько механики просты и понятны",
      "Линза Гармонии — сочетаются ли все элементы друг с другом",
    ],
  },
  {
    title: "MechanicsDB (SW.BAND)",
    icon: Workflow,
    summary:
      "Кураторная база из 128 механик в 15 группах, лежит в основе алгоритма концепции Gidede.",
    details: [
      "Группы: Базовые, Боевые, Прогрессия, Spatial, Social, Narrative, Economic, Puzzle, Survival, Stealth, Race, Building, Crafting, Custom, Meta",
      "Каждая механика: name, group, description, тип ресурса (consumed/produced)",
      "Алгоритм подбирает механики под жанр + эстетику автоматически",
      "Synergy detection: какие механики хорошо работают вместе (score 0–1)",
      "Конфликты: какие механики противоречат друг другу — система их разруливает",
    ],
  },
  {
    title: "Balance: Transitive vs Intransitive",
    icon: Scale,
    summary:
      "Два базовых подхода к балансу игровых объектов. Gidede умеет оба.",
    details: [
      "Transitive — все объекты сравнимы по формуле power = f(cost). Пример: оружие T1 слабее T2, но и дешевле",
      "Intransitive — rock-paper-scissors: A сильнее B, B сильнее C, C сильнее A. Пример: Pokémon",
      "Payoff matrix 3×3 — основной инструмент для анализа intransitive",
      "Monte Carlo симуляция — прогон 1000+ боёв для оценки win-rate",
      "Machinations — визуализация экономики в виде графа pools/faucets/drains",
    ],
  },
];

// ============================================================
// FAQ
// ============================================================

interface FAQItem {
  question: string;
  answer: string;
  highlight?: boolean;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Можно ли начать с Core Loop?",
    answer:
      "Да! Gidede поддерживает нелинейный workflow. Вы можете начать с любого блока. Данные будут подтягиваться из уже заполненных блоков автоматически. Например: начните с Core Loop (Блок 2) → затем Концепция (Блок 1) подхватит механики из цикла. Или начните с MDA (Блок 3) и двигайтесь в любую сторону. Пайплайн (Блок 8) прогонит все блоки в правильном порядке, даже если вы начали с конца.",
    highlight: true,
  },
  {
    question: "Как редактировать сгенерированное?",
    answer:
      "В Блоке 2 (Core Loop) есть редактор шагов — можно переименовать, добавить, удалить шаги и поменять feedback-тип без перегенерации. В Блоке 6 (GDD) есть GDD Section Editor — редактирование каждой секции вручную с авто-сохранением. В Блоке 4 (Баланс) редактируются входные объекты (оружие, броня) через ObjectForm. Другие блоки (1, 3, 5) показывают read-only результаты — для изменений перегенерируйте с другими параметрами или воспользуйтесь AI-обогащением.",
  },
  {
    question: "Почему прототип пустой?",
    answer:
      "Прототипы строятся из Core Loop. Сначала создайте Core Loop в Блоке 2 — тогда при генерации прототипа шаги цикла станут механиками игры (исследование, бой, сбор, прокачка). Если Core Loop пустой, система использует стандартные русские глаголы «Собрать → Преобразовать → Использовать» как fallback — это значит, что прототип-generic и не отражает вашу игру. Также убедитесь, что выбран активный проект (на странице «Мои проекты» кликните на проект).",
  },
  {
    question: "Как переносить данные между блоками?",
    answer:
      "Автоматически. Когда вы открываете блок, система подтягивает данные из предыдущих блоков через pipeline API. Например, Блок 2 (Core Loop) автоматически получает механики и жанр из Блока 1 (Концепция). Блок 3 (MDA) получает эстетики из концепции и механики из Core Loop. Убедитесь, что выбран активный проект — кликните на проект в списке «Мои проекты», и он запомнится в localStorage. После изменений в одном блоке другие блоки покажут «stale»-уведомление вверху страницы.",
  },
  {
    question: "Что такое AI-обогащение?",
    answer:
      "Это опция в каждом блоке для генерации более креативных результатов через LLM (GLM-4.6). Без неё алгоритм работает детерминированно (одинаковый вход → одинаковый выход). С AI-обогащением вы получаете дополнительные креативные подсказки, альтернативные варианты, и более «человечные» формулировки. Бесплатный лимит: 50 запросов в день. Лимит показан в сайдбаре под вашим email. AI-обогащение не обязательно — все базовые алгоритмы работают без него.",
  },
  {
    question: "Какие форматы GDD поддерживаются?",
    answer:
      "5 форматов: (1) one_sheet — 1 страница, для publisher pitch; (2) pitch — 2–3 страницы, для инвесторов; (3) mini_gdd — 5–10 страниц, для команды; (4) full_gdd — 20+ страниц, 38 секций Роджерса, для производства; (5) mega_gdd — полный документ со всеми чек-листами. Формат выбирается в Блоке 6 перед генерацией. Все форматы можно экспортировать в DOCX.",
  },
  {
    question: "Что такое Node-редактор (prototype-editor)?",
    answer:
      "Отдельная страница /prototype-editor — визуальный граф-редактор для проектирования игровой логики в виде нод (как в Unreal Blueprints). Поддерживает типы нод: GameStart, GameLoop, Event, Condition, Action, Spawn, Destroy, Variable. Можно загрузить готовый шаблон, скомпилировать граф в HTML-прототип и запустить прямо в браузере. Это продвинутый инструмент — для большинства задач достаточно Блоков 1–6 и страницы /prototypes.",
  },
];

// ============================================================
// Quick Step Card component
// ============================================================

function QuickStepCard({ step }: { step: QuickStep }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
            {step.num}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg leading-tight">{step.title}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed">
              {step.description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Screenshot */}
        <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
          <img
            src={step.screenshot}
            alt={step.screenshotAlt}
            className="w-full h-auto object-cover"
            loading="lazy"
          />
        </div>

        {/* Bullets */}
        <ul className="space-y-1.5">
          {step.bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" size="sm">
          <Link href={step.href}>
            {step.hrefLabel}
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

// ============================================================
// Example step card component
// ============================================================

function ExampleStepCard({ step }: { step: ExampleStep }) {
  const Icon = step.icon;
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{step.block}</CardTitle>
            <CardDescription className="text-sm font-medium text-foreground/80">
              {step.action}
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href={step.blockHref}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Открыть
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Что делать */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Что делаем
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed pl-5">
            {step.input}
          </p>
        </div>
        {/* Что получилось */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Что получилось
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed pl-5 mb-2">
            {step.result}
          </p>
          <ul className="space-y-1 pl-5">
            {step.resultBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-emerald-500 mt-0.5">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Block Function Card component
// ============================================================

function BlockFunctionCard({ block }: { block: BlockFunction }) {
  const Icon = block.icon;
  return (
    <Card>
      <CardHeader className="border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">
                Блок {block.id} • {block.name}
              </CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase">
                {block.status}
              </Badge>
            </div>
            <CardDescription className="text-sm">
              {block.description}
            </CardDescription>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <Link href={block.href}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Открыть
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Входные данные */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <ArrowRight className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wide text-primary">
              Входные данные
            </span>
          </div>
          <ul className="space-y-1">
            {block.inputs.map((input, i) => (
              <li key={i} className="text-xs text-foreground/85 flex items-start gap-1.5">
                <span className="text-primary mt-0.5 shrink-0">→</span>
                <span>{input}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Результат */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              Результат
            </span>
          </div>
          <ul className="space-y-1">
            {block.outputs.map((output, i) => (
              <li key={i} className="text-xs text-foreground/85 flex items-start gap-1.5">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span>{output}</span>
              </li>
            ))}
          </ul>
        </div>
        {/* Как пользоваться */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
              Как пользоваться
            </span>
          </div>
          <ol className="space-y-1">
            {block.howToUse.map((step, i) => (
              <li key={i} className="text-xs text-foreground/85 flex items-start gap-1.5">
                <span className="text-amber-500 mt-0.5 shrink-0 font-medium">
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Concept card component
// ============================================================

function ConceptInfoCard({ concept }: { concept: ConceptCard }) {
  const Icon = concept.icon;
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle className="text-base">{concept.title}</CardTitle>
        </div>
        <CardDescription className="text-sm leading-relaxed pt-1">
          {concept.summary}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {concept.details.map((d, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-foreground/85">
              <span className="text-primary mt-0.5 shrink-0">→</span>
              <span className="leading-relaxed">{d}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState("quickstart");

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto py-6 md:py-10 px-4">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shrink-0">
            <HelpCircle className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Помощь и обучение
            </h1>
            <p className="text-muted-foreground mt-1 max-w-2xl">
              Пошаговый гайд по работе с Gidede, подробный пример разработки
              проекта «Shadow Depths», основы геймдизайна и ответы на частые
              вопросы.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="quickstart" className="flex flex-col gap-1 py-2 h-auto">
              <Rocket className="h-4 w-4" />
              <span className="text-xs">Быстрый старт</span>
            </TabsTrigger>
            <TabsTrigger value="example" className="flex flex-col gap-1 py-2 h-auto">
              <Gamepad2 className="h-4 w-4" />
              <span className="text-xs">Пример проекта</span>
            </TabsTrigger>
            <TabsTrigger value="functions" className="flex flex-col gap-1 py-2 h-auto">
              <Layers className="h-4 w-4" />
              <span className="text-xs">Функции блоков</span>
            </TabsTrigger>
            <TabsTrigger value="basics" className="flex flex-col gap-1 py-2 h-auto">
              <BookOpen className="h-4 w-4" />
              <span className="text-xs">Основы геймдизайна</span>
            </TabsTrigger>
            <TabsTrigger value="faq" className="flex flex-col gap-1 py-2 h-auto">
              <HelpCircle className="h-4 w-4" />
              <span className="text-xs">FAQ</span>
            </TabsTrigger>
          </TabsList>

          {/* ============================================================ */}
          {/* TAB: QUICK START */}
          {/* ============================================================ */}
          <TabsContent value="quickstart" className="mt-6">
            <Alert className="mb-6 border-primary/30 bg-primary/5">
              <Info className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary">8 шагов от идеи до GDD</AlertTitle>
              <AlertDescription>
                Пройдите эти 8 шагов последовательно — и за 60 минут вы получите
                полный GDD-документ. На каждом шаге есть скриншот интерфейса и
                кнопка перехода в соответствующий раздел.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {QUICK_STEPS.map((step) => (
                <QuickStepCard key={step.num} step={step} />
              ))}
            </div>

            {/* Tip card */}
            <Card className="mt-6 border-emerald-500/30 bg-emerald-500/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm mb-1">
                      Совет: можно запустить весь пайплайн одним кликом
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Если у вас уже есть готовая идея и вы хотите быстро
                      получить первый GDD — перейдите на страницу{" "}
                      <Link
                        href="/pipeline"
                        className="text-primary underline underline-offset-2 hover:opacity-80"
                      >
                        Пайплайн
                      </Link>{" "}
                      и нажмите «Запустить пайплайн». Система прогонит все 6
                      блоков автоматически. После этого вы сможете доработать
                      отдельные блоки вручную.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB: WORKED EXAMPLE */}
          {/* ============================================================ */}
          <TabsContent value="example" className="mt-6">
            {/* Intro */}
            <Card className="mb-6 overflow-hidden">
              <CardHeader className="border-b border-border bg-gradient-to-br from-primary/5 to-transparent">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shrink-0">
                    <Gamepad2 className="h-7 w-7" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-2xl">Shadow Depths</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      Тёмный фэнтези-рогалик • Жанр: Roguelike • Эстетики:
                      Challenge + Discovery
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900 shrink-0">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Worked Example
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-semibold mb-1">Идея:</p>
                    <p className="text-muted-foreground leading-relaxed">
                      «Тёмный фэнтези-рогалик, где вы собираете души павших
                      врагов, чтобы прокачивать персонажа и спускаться глубже в
                      подземелья».
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Цель:</p>
                    <p className="text-muted-foreground leading-relaxed">
                      Пройти все 6 блоков Gidede от идеи до готового one-sheet
                      GDD и показать, что именно генерирует каждый блок.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Steps */}
            <div className="space-y-5">
              {EXAMPLE_STEPS.map((step, i) => (
                <div key={i} className="relative">
                  {/* Connector line */}
                  {i < EXAMPLE_STEPS.length - 1 && (
                    <div
                      aria-hidden
                      className="hidden md:block absolute left-[2.4rem] top-full h-5 w-px bg-border z-0"
                    />
                  )}
                  <ExampleStepCard step={step} />
                </div>
              ))}
            </div>

            {/* Outcome */}
            <Card className="mt-6 border-emerald-500/30 bg-emerald-500/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Итог: что мы получили
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">6</div>
                    <div className="text-xs text-muted-foreground">блоков пройдено</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">12</div>
                    <div className="text-xs text-muted-foreground">механик подобрано</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">5</div>
                    <div className="text-xs text-muted-foreground">шагов Core Loop</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">1</div>
                    <div className="text-xs text-muted-foreground">GDD в DOCX</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">1</div>
                    <div className="text-xs text-muted-foreground">играбельный прототип</div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4 leading-relaxed">
                  Тот же самый проект «Shadow Depths» есть в папке{" "}
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                    test_projects/01_Shadow_Depths/
                  </code>{" "}
                  — это реальный вывод алгоритмов Gidede. Вы можете сравнить
                  свои результаты с эталонными.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB: BLOCK FUNCTIONS */}
          {/* ============================================================ */}
          <TabsContent value="functions" className="mt-6">
            <Alert className="mb-6">
              <Layers className="h-4 w-4" />
              <AlertTitle>8 блоков Gidede — детальный справочник</AlertTitle>
              <AlertDescription>
                Для каждого блока: входные данные, результат, как пользоваться.
                Блоки связаны между собой — данные автоматически подтягиваются
                из предыдущих шагов через pipeline API.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              {BLOCK_FUNCTIONS.map((block) => (
                <BlockFunctionCard key={block.id} block={block} />
              ))}
            </div>

            {/* Node Editor section */}
            <Card className="mt-6 border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Workflow className="h-5 w-5 text-primary" />
                  Node-редактор прототипов (/prototype-editor)
                </CardTitle>
                <CardDescription>
                  Продвинутый визуальный граф-редактор игровой логики —
                  альтернатива автоматической генерации прототипа на странице
                  /prototypes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">
                      Возможности
                    </p>
                    <ul className="space-y-1 text-sm text-foreground/85">
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0">→</span>
                        <span>20 типов нод: GameStart, GameLoop, Event, Condition, Action, Spawn, Destroy, Variable, ...</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0">→</span>
                        <span>5 готовых шаблонов (platformer, shooter, puzzle, ...)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0">→</span>
                        <span>Компиляция в LittleJS (2D) или Three.js (3D)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0">→</span>
                        <span>AI-генерация графа из текстового описания</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0">→</span>
                        <span>Undo/Redo (история до 50 шагов)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0">→</span>
                        <span>Auto-layout нод (Dagre-алгоритм)</span>
                      </li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-1.5">
                      Как использовать
                    </p>
                    <ol className="space-y-1 text-sm text-foreground/85">
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0 font-medium">1.</span>
                        <span>Перетащите ноды из палитры на холст</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0 font-medium">2.</span>
                        <span>Соедините ноды связями (drag from port to port)</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0 font-medium">3.</span>
                        <span>Настройте параметры каждой ноды</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0 font-medium">4.</span>
                        <span>Нажмите «Compile» — получите HTML-прототип</span>
                      </li>
                      <li className="flex items-start gap-1.5">
                        <span className="text-primary mt-0.5 shrink-0 font-medium">5.</span>
                        <span>Запустите в браузере, итерируйте</span>
                      </li>
                    </ol>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="mt-2">
                  <Link href="/prototype-editor">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Открыть Node-редактор
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB: GAME DESIGN BASICS */}
          {/* ============================================================ */}
          <TabsContent value="basics" className="mt-6">
            <Alert className="mb-6">
              <BookOpen className="h-4 w-4" />
              <AlertTitle>Краткий справочник по геймдизайну</AlertTitle>
              <AlertDescription>
                Концепции, на которых построены алгоритмы Gidede. Для глубокого
                изучения — поищите эти термины в{" "}
                <Link
                  href="/knowledge"
                  className="text-primary underline underline-offset-2"
                >
                  Базе знаний
                </Link>{" "}
                (12 разделов Библии геймдизайна).
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BASICS_CONCEPTS.map((c) => (
                <ConceptInfoCard key={c.title} concept={c} />
              ))}
            </div>

            {/* Books reference */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Источники — 17 книг по геймдизайну
                </CardTitle>
                <CardDescription>
                  Алгоритмы Gidede основаны на этих книгах. Все они
                  индексированы в Базе знаний.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {[
                    "Schell — The Art of Game Design (линзы)",
                    "Hunicke, LeBlanc, Zubek — MDA Framework",
                    "Rogers — Level Up! (Triangle of Weirdness)",
                    "Sellers — Game Mechanics (типологии Core Loop)",
                    "Adams & Dormans — Game Mechanics (Machinations)",
                    "Koster — Theory of Fun",
                    "Salen & Zimmerman — Rules of Play",
                    "Crawford — The Art of Computer Game Design",
                    "Fullerton — Game Design Workshop",
                    "Brathwaite & Schreiber — Challenges for Game Designers",
                    "Sicart — Against Procedurality",
                    "Bartle — Designing Virtual Worlds",
                    "Dille & Platzner — The Ultimate Guide to Video Game Writing",
                    "Tynan Sylvester — Designing Games",
                    "Anna Anthropy — Rise of the Videogame Zinesters",
                    "McGuire — Game Mechanics: Advanced Game Design",
                    "Lopes — Programming Game AI by Example",
                  ].map((book, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-primary text-xs mt-0.5 shrink-0">
                        {String(i + 1).padStart(2, "0")}.
                      </span>
                      <span className="text-foreground/85">{book}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================ */}
          {/* TAB: FAQ */}
          {/* ============================================================ */}
          <TabsContent value="faq" className="mt-6">
            {/* Highlighted question — Core Loop */}
            <Alert className="mb-6 border-emerald-500/40 bg-emerald-500/5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <AlertTitle className="text-emerald-700 dark:text-emerald-400 text-base">
                    {FAQ_ITEMS[0].question}
                  </AlertTitle>
                  <AlertDescription className="text-sm text-foreground/90 leading-relaxed pt-1">
                    {FAQ_ITEMS[0].answer}
                  </AlertDescription>
                </div>
              </div>
            </Alert>

            {/* Other FAQs as cards */}
            <div className="space-y-3">
              {FAQ_ITEMS.slice(1).map((item, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{item.question}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground/85 leading-relaxed pl-6">
                      {item.answer}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Help footer */}
            <Card className="mt-6 border-primary/30 bg-primary/5">
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
                  <ArrowLeftRight className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-0.5">
                      Не нашли ответ?
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Загляните в Базу знаний (12 разделов Библии геймдизайна)
                      или спросите AI-ассистента (Блок 7) — он знает контекст
                      вашего проекта.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/knowledge">
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        База знаний
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/blocks/7">
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        AI-ассистент
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
