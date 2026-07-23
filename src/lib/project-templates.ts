/**
 * Gidede — Project templates (пресеты для популярных жанров).
 *
 * Готовые шаблоны проектов с предзаполненными name, description, genre
 * и suggested core loop type. Пользователь выбирает шаблон в диалоге
 * создания проекта — поля заполняются автоматически.
 */

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  genre: string;
  coreLoopType: string;
  icon: string;
  category: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: "roguelike-dungeon",
    name: "Подземелье Теней",
    description:
      "Roguelike-данжен-краулер: спуск на этажи подземелья, сбор лута, бой с боссами. Перманентная смерть, процедурная генерация, перманентные апгрейды между забегами.",
    genre: "Roguelike",
    coreLoopType: "ecology",
    icon: "🗡️",
    category: "Action",
  },
  {
    id: "tower-defense",
    name: "Осада Крепости",
    description:
      "Tower defense: строительство башен, защита базы от волн врагов, апгрейд между волнами. Экономика: золото за убийства → новые башни.",
    genre: "Tower Defense",
    coreLoopType: "tower_defense",
    icon: "🏰",
    category: "Strategy",
  },
  {
    id: "rhythm-game",
    name: "Небесный Ритм",
    description:
      "Rhythm game: ловля нот в ритме музыки, combo-система, разблокировка новых треков. 3 уровня сложности, визуальные эффекты на битах.",
    genre: "Rhythm",
    coreLoopType: "rhythm",
    icon: "🎵",
    category: "Music",
  },
  {
    id: "puzzle-match",
    name: "Кристальный Пазл",
    description:
      "Match-3 puzzle: перестановка кристаллов на сетке, собирай линии из 3+, комбо-цепочки, специальные кристаллы. 100+ уровней с возрастающей сложностью.",
    genre: "Квест/Пазл",
    coreLoopType: "puzzle",
    icon: "🧩",
    category: "Puzzle",
  },
  {
    id: "metroidvania",
    name: "Забытые Земли",
    description:
      "Metroidvania: исследование interconnected мира, поиск способностей (двойной прыжок, скольжение), боссы блокируют прогрессию. Backtracking с новыми способностями.",
    genre: "Metroidvania",
    coreLoopType: "engine",
    icon: "🗺️",
    category: "Adventure",
  },
  {
    id: "card-battler",
    name: "Сказка Карт",
    description:
      "Deck-building card battler: сбор колоды из 30 карт, бой с противниками, покупка новых карт после победы. Roguelike-прогрессия: каждая игра уникальна.",
    genre: "Strategy",
    coreLoopType: "economy",
    icon: "🃏",
    category: "Strategy",
  },
  {
    id: "survival-craft",
    name: "Последний Огонёк",
    description:
      "Survival craft: сбор ресурсов днём, оборона от монстров ночью, крафт инструментов и построек. Голод, жажда, температура — три шкалы выживания.",
    genre: "Sandbox",
    coreLoopType: "ecology",
    icon: "🔥",
    category: "Survival",
  },
  {
    id: "space-shooter",
    name: "Звёздный Клинок",
    description:
      "Arcade space shooter: волны врагов, апгрейды оружия (спред, лазер, ракеты), боссы каждые 5 уровней. Score-attack с онлайн-таблицей лидеров.",
    genre: "Шутер",
    coreLoopType: "engine",
    icon: "🚀",
    category: "Action",
  },
  {
    id: "farming-sim",
    name: "Тихая Долина",
    description:
      "Farming simulator: посадка и сбор урожая, разведение животных, отношения с NPC, сезонные фестивали. Кооператив на 4 игрока.",
    genre: "Симулятор",
    coreLoopType: "economy",
    icon: "🌾",
    category: "Simulation",
  },
  {
    id: "racing-arcade",
    name: "Нитро-Гран-При",
    description:
      "Arcade racing: drift-механика, нитро-ускорение, сбор монет на трассе, апгрейды машины. 12 трасс, 8 машин, split-screen на 2 игрока.",
    genre: "Гонки",
    coreLoopType: "engine",
    icon: "🏎️",
    category: "Racing",
  },
];

export const TEMPLATE_CATEGORIES = [
  "All",
  "Action",
  "Strategy",
  "Puzzle",
  "Adventure",
  "Survival",
  "Music",
  "Simulation",
  "Racing",
];
