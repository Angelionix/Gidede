/**
 * MechanicsDB — 128 игровых механик из 15 групп.
 * Источник: SW.BAND «Карты геймдизайнера» (Книга 15).
 */

export interface Mechanic {
  group: string;
  name: string;
  desc: string;
  aesthetics: string[];
  genres: string[];
}

export const MECHANICS_DB: Mechanic[] = [
  {
    'group': 'Базовые',
    'name': 'Изучение мира',
    'desc': 'Игрок исследует игровое пространство, открывая новые локации и объекты. Фундаментальная механика, определяющая паттерны перемещения и обнаружения.',
    'aesthetics': [
      'discovery',
      'fantasy',
      'sensation'
    ],
    'genres': ['adventure', 'horror', 'jrpg', 'metroidvania', 'mmorpg', 'puzzle', 'rpg', 'sandbox']
  },
  {
    'group': 'Базовые',
    'name': 'Достижения и очки',
    'desc': 'Система начисления очков и мета-целей, мотивирующая игрока к повторным действиям и совершенствованию результатов.',
    'aesthetics': [
      'challenge',
      'submission',
      'expression'
    ],
    'genres': ['action', 'adventure', 'mmorpg', 'platformer', 'rpg', 'shooter']
  },
  {
    'group': 'Базовые',
    'name': 'Враги',
    'desc': 'Наличие противников, создающих препятствия и угрозы. Основа конфликтного взаимодействия и баланса вызова.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'narrative'
    ],
    'genres': ['action', 'horror', 'metroidvania', 'platformer', 'roguelike', 'rpg', 'shooter']
  },
  {
    'group': 'Базовые',
    'name': 'Инвентарь',
    'desc': 'Система хранения и управления предметами. Управление ограниченным пространством создаёт стратегические решения о приоритетах.',
    'aesthetics': [
      'submission',
      'expression',
      'discovery'
    ],
    'genres': ['adventure', 'horror', 'mmorpg', 'roguelike', 'rpg', 'survival_horror']
  },
  {
    'group': 'Базовые',
    'name': 'Квесты',
    'desc': 'Структурированные задания с целями и наградами. Направляют игрока и создают микро-нарративные арки в рамках игровой сессии.',
    'aesthetics': [
      'narrative',
      'challenge',
      'submission'
    ],
    'genres': ['action_rpg', 'adventure', 'jrpg', 'mmorpg', 'rpg', 'visual_novel']
  },
  {
    'group': 'Базовые',
    'name': 'Головоломки',
    'desc': 'Интеллектуальные задачи, требующие логики, наблюдательности или пространственного мышления для решения.',
    'aesthetics': [
      'challenge',
      'discovery',
      'submission'
    ],
    'genres': ['adventure', 'educational', 'metroidvania', 'puzzle', 'rts', 'strategy', 'tactical_rpg', 'tbs']
  },
  {
    'group': 'Базовые',
    'name': 'Колода карт',
    'desc': 'Механика построения и использования колоды карт как основы игровой системы. Каждая карта — действие, ресурс или сущность.',
    'aesthetics': [
      'challenge',
      'expression',
      'discovery'
    ],
    'genres': ['mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'strategy', 'survival_horror', 'tbs']
  },
  {
    'group': 'Базовые',
    'name': 'Здоровье',
    'desc': 'Система очков жизни персонажа. Определяет порог выживания и создаёт базовую петлю риска — избегание урона против получения преимущества.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'narrative'
    ],
    'genres': ['action', 'fighting', 'horror', 'metroidvania', 'platformer', 'roguelike', 'rpg', 'sandbox']
  },
  {
    'group': 'Базовые',
    'name': 'Древо технологий',
    'desc': 'Ветвящаяся структура разблокируемых технологий или улучшений. Создаёт долгосрочные стратегии развития и решения о специализации.',
    'aesthetics': [
      'submission',
      'expression',
      'discovery'
    ],
    'genres': ['rpg', 'rts', 'strategy', 'tactical_rpg', 'tbs']
  },
  {
    'group': 'Прогрессия',
    'name': 'Очки опыта',
    'desc': 'Количественная мера прогресса персонажа, накапливаемая через действия. Управляет темпом роста и создаёт петлю «действие → награда → рост».',
    'aesthetics': [
      'submission',
      'challenge',
      'fantasy'
    ],
    'genres': ['action_rpg', 'horror', 'jrpg', 'mmorpg', 'rpg', 'sandbox', 'simulation', 'survival_horror']
  },
  {
    'group': 'Прогрессия',
    'name': 'Перки',
    'desc': 'Пассивные или активные бонусы, получаемые при определённых условиях. Добавляют вариативность билда и персонализацию персонажа.',
    'aesthetics': [
      'expression',
      'fantasy',
      'challenge'
    ],
    'genres': ['action_rpg', 'horror', 'mmorpg', 'roguelike', 'rpg', 'sandbox', 'shooter', 'simulation']
  },
  {
    'group': 'Прогрессия',
    'name': 'Характеристики',
    'desc': 'Числовые параметры персонажа (сила, ловкость, интеллект и пр.), определяющие его возможности. Фундамент ролевой системы.',
    'aesthetics': [
      'expression',
      'submission',
      'fantasy'
    ],
    'genres': ['action_rpg', 'horror', 'jrpg', 'mmorpg', 'puzzle', 'roguelike', 'rpg', 'rts']
  },
  {
    'group': 'Прогрессия',
    'name': 'Обмундирование',
    'desc': 'Система экипировки персонажа — оружие, броня, аксессуары. Управляет силой персонажа и визуальной идентичностью.',
    'aesthetics': [
      'fantasy',
      'expression',
      'submission'
    ],
    'genres': ['action_rpg', 'horror', 'mmorpg', 'roguelike', 'rpg', 'sandbox', 'simulation', 'survival_horror']
  },
  {
    'group': 'Прогрессия',
    'name': 'Прокачка оружия',
    'desc': 'Улучшение оружия через модификации, апгрейды или опыт использования. Связывает прогресс игрока с конкретным инструментом.',
    'aesthetics': [
      'submission',
      'expression',
      'fantasy'
    ],
    'genres': ['rpg', 'sandbox', 'shooter', 'simulation', 'strategy']
  },
  {
    'group': 'Прогрессия',
    'name': 'Достижения',
    'desc': 'Мета-цели, фиксирующие промежуточные успехи игрока. Создают дополнительные мотивации и направления игры вне основного прогресса.',
    'aesthetics': [
      'submission',
      'challenge',
      'expression'
    ],
    'genres': ['action', 'adventure', 'mmorpg', 'platformer', 'rpg', 'shooter']
  },
  {
    'group': 'Прогрессия',
    'name': 'Ресурсы',
    'desc': 'Собираемые материалы и валюты, используемые для крафта, торговли и строительства. Основа экономических петель игры.',
    'aesthetics': [
      'submission',
      'discovery',
      'challenge'
    ],
    'genres': ['mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'simulation', 'strategy', 'survival_horror']
  },
  {
    'group': 'Прогрессия',
    'name': 'Уровни',
    'desc': 'Дискретные ступени прогресса персонажа или игрока. Разбивают непрерывный рост на значимые этапы с пороговыми наградами.',
    'aesthetics': [
      'submission',
      'fantasy',
      'challenge'
    ],
    'genres': ['action_rpg', 'horror', 'jrpg', 'mmorpg', 'platformer', 'puzzle', 'rpg', 'sandbox']
  },
  {
    'group': 'Прогрессия',
    'name': 'Сложность',
    'desc': 'Система управления уровнем вызова, адаптирующая опыт под игрока. Включает статическую, динамическую и выбираемую сложность.',
    'aesthetics': [
      'challenge',
      'submission',
      'narrative'
    ],
    'genres': ['action', 'action_rpg', 'jrpg', 'mmorpg', 'platformer', 'puzzle', 'roguelike', 'rpg']
  },
  {
    'group': 'Пространство',
    'name': 'Карта мира',
    'desc': 'Обзорная карта игрового мира для навигации и планирования маршрутов. Создаёт ощущение масштаба и связности мира.',
    'aesthetics': [
      'discovery',
      'fantasy',
      'submission'
    ],
    'genres': ['adventure', 'jrpg', 'mmorpg', 'rpg', 'sandbox', 'strategy']
  },
  {
    'group': 'Пространство',
    'name': 'Зона игры',
    'desc': 'Ограниченное игровое пространство с определёнными правилами. Создаёт арену для взаимодействия и фокусирует игровой опыт.',
    'aesthetics': [
      'challenge',
      'fellowship',
      'sensation'
    ],
    'genres': ['action', 'fighting', 'metroidvania', 'platformer', 'shooter']
  },
  {
    'group': 'Пространство',
    'name': 'Альтернативы',
    'desc': 'Наличие нескольких путей достижения цели. Поддерживает игроковую автономию и реиграбельность через вариативность подходов.',
    'aesthetics': [
      'expression',
      'discovery',
      'challenge'
    ],
    'genres': ['action', 'adventure', 'mmorpg', 'platformer', 'puzzle', 'rpg', 'shooter', 'visual_novel']
  },
  {
    'group': 'Пространство',
    'name': 'Мультицели',
    'desc': 'Несколько одновременных целей в одном пространстве. Создаёт приоритизацию и стратегический выбор распределения внимания.',
    'aesthetics': [
      'challenge',
      'submission',
      'expression'
    ],
    'genres': ['puzzle', 'rts', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Пространство',
    'name': 'Тайники',
    'desc': 'Скрытые хранилища предметов в игровом мире. Мотивируют тщательное исследование и вознаграждают наблюдательность.',
    'aesthetics': [
      'discovery',
      'fantasy',
      'submission'
    ],
    'genres': ['adventure', 'horror', 'metroidvania', 'platformer', 'rpg']
  },
  {
    'group': 'Пространство',
    'name': 'Секретные уровни',
    'desc': 'Скрытые локации, доступные только при выполнении особых условий. Создают ощущение эксклюзивности и награждают мастерство.',
    'aesthetics': [
      'discovery',
      'challenge',
      'fantasy'
    ],
    'genres': ['action_rpg', 'adventure', 'jrpg', 'metroidvania', 'mmorpg', 'platformer', 'puzzle', 'rpg']
  },
  {
    'group': 'Пространство',
    'name': 'Строительство',
    'desc': 'Создание игроком структур и объектов в игровом мире. Трансформирует пространство и создаёт ощущение созидания.',
    'aesthetics': [
      'expression',
      'fantasy',
      'submission'
    ],
    'genres': ['rts', 'sandbox', 'simulation', 'strategy', 'tbs']
  },
  {
    'group': 'Пространство',
    'name': 'Телепортация',
    'desc': 'Мгновенное перемещение между точками мира. Снижает трение навигации и управляет темпом игры.',
    'aesthetics': [
      'submission',
      'fantasy',
      'discovery'
    ],
    'genres': ['adventure', 'metroidvania', 'mmorpg', 'rpg', 'sandbox']
  },
  {
    'group': 'Пространство',
    'name': 'Дискретное время',
    'desc': 'Пошаговое или раундовое время, где действия совершаются в раздельные моменты. Управляет темпом и создаёт пространство для обдумывания.',
    'aesthetics': [
      'challenge',
      'submission',
      'expression'
    ],
    'genres': ['adventure', 'platformer', 'rpg']
  },
  {
    'group': 'Боевые',
    'name': 'Броня',
    'desc': 'Защитный слой, снижающий получаемый урон. Создаёт тактический ресурс управления выживаемостью и визуальную прогрессию.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'submission'
    ],
    'genres': ['action_rpg', 'mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'strategy', 'survival_horror']
  },
  {
    'group': 'Боевые',
    'name': 'Запас патронов',
    'desc': 'Ограниченный боезапас, создающий ресурсный дефицит в бою. Заставляет принимать решения о расходе и поиске пополнения.',
    'aesthetics': [
      'challenge',
      'submission',
      'sensation'
    ],
    'genres': ['action', 'horror', 'mmorpg', 'rts', 'sandbox', 'shooter', 'strategy', 'survival_horror']
  },
  {
    'group': 'Боевые',
    'name': 'Укрытия',
    'desc': 'Элементы окружения для защиты от атак. Создают пространственную тактику перемещения между точками безопасности.',
    'aesthetics': [
      'challenge',
      'sensation',
      'submission'
    ],
    'genres': ['action', 'horror', 'shooter', 'tactical_rpg']
  },
  {
    'group': 'Боевые',
    'name': 'Бесшумное оружие',
    'desc': 'Оружие, не привлекающее внимание врагов. Ключевой инструмент стелс-подхода к боевым ситуациям.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'narrative'
    ],
    'genres': ['action', 'horror', 'metroidvania', 'platformer', 'roguelike', 'rpg', 'shooter', 'stealth']
  },
  {
    'group': 'Боевые',
    'name': 'Комбо',
    'desc': 'Последовательные атаки, усиливающие эффект при правильном тайминге. Создаёт петлю мастерства и зрелищности.',
    'aesthetics': [
      'sensation',
      'challenge',
      'expression'
    ],
    'genres': ['action', 'fighting', 'platformer', 'rhythm']
  },
  {
    'group': 'Боевые',
    'name': 'Парирование',
    'desc': 'Отражение атаки противника в правильный момент. Высокоуровневый навык с высокой наградой за мастерство.',
    'aesthetics': [
      'challenge',
      'sensation',
      'fantasy'
    ],
    'genres': ['action', 'action_rpg', 'fighting', 'jrpg', 'mmorpg', 'platformer', 'puzzle', 'rpg']
  },
  {
    'group': 'Боевые',
    'name': 'Уклонение',
    'desc': 'Активное избегание атак через перемещение. Базовый элемент боевой петли «атака-защита-перемещение».',
    'aesthetics': [
      'challenge',
      'sensation',
      'fantasy'
    ],
    'genres': ['action', 'fighting', 'roguelike', 'rpg', 'soulslike']
  },
  {
    'group': 'Боевые',
    'name': 'Спецатаки',
    'desc': 'Мощные атаки с особыми условиями активации или стоимостью. Создают пики мощности и моментальную смену ситуации.',
    'aesthetics': [
      'sensation',
      'fantasy',
      'challenge'
    ],
    'genres': ['action', 'fighting', 'mmorpg', 'rpg']
  },
  {
    'group': 'Боевые',
    'name': 'Мана',
    'desc': 'Ресурс для использования магических способностей. Управляет частотой применения спецатак и создаёт петлю восстановления.',
    'aesthetics': [
      'fantasy',
      'challenge',
      'submission'
    ],
    'genres': ['action', 'action_rpg', 'fighting', 'jrpg', 'mmorpg', 'roguelike', 'rpg', 'rts']
  },
  {
    'group': 'Движение',
    'name': 'Прыжки',
    'desc': 'Базовая механика вертикального перемещения. Создаёт платформенные задачи и расширяет пространство взаимодействия.',
    'aesthetics': [
      'sensation',
      'challenge',
      'fantasy'
    ],
    'genres': ['action', 'adventure', 'platformer']
  },
  {
    'group': 'Движение',
    'name': 'Двойной прыжок',
    'desc': 'Второй прыжок в воздухе, расширяющий пространство манёвра. Открывает новые маршруты и увеличивает свободу перемещения.',
    'aesthetics': [
      'sensation',
      'fantasy',
      'expression'
    ],
    'genres': ['action', 'metroidvania', 'platformer']
  },
  {
    'group': 'Движение',
    'name': 'Полёт',
    'desc': 'Свободное перемещение в трёхмерном пространстве. Максимальная свобода навигации, кардинально меняющая восприятие мира.',
    'aesthetics': [
      'fantasy',
      'sensation',
      'expression'
    ],
    'genres': ['action', 'platformer', 'sandbox', 'shooter']
  },
  {
    'group': 'Движение',
    'name': 'Стены',
    'desc': 'Взаимодействие с вертикальными поверхностями — цепляние, прыжки от стены, бег по стене. Расширяет платформенный словарь.',
    'aesthetics': [
      'sensation',
      'challenge',
      'fantasy'
    ],
    'genres': ['action', 'horror', 'metroidvania', 'platformer', 'stealth']
  },
  {
    'group': 'Движение',
    'name': 'Рывок',
    'desc': 'Быстрое перемещение на короткое расстояние. Инструмент для уклонения и агрессивного сближения с противником.',
    'aesthetics': [
      'sensation',
      'challenge',
      'fantasy'
    ],
    'genres': ['action', 'fighting', 'metroidvania', 'platformer', 'roguelike', 'rpg', 'shooter', 'soulslike']
  },
  {
    'group': 'Движение',
    'name': 'Верховая езда',
    'desc': 'Перемещение на ездовом животном или транспорте. Изменяет скорость, вместимость и иногда боевые возможности.',
    'aesthetics': [
      'fantasy',
      'sensation',
      'narrative'
    ],
    'genres': ['adventure', 'mmorpg', 'rpg', 'sandbox', 'simulation']
  },
  {
    'group': 'Движение',
    'name': 'Плавание',
    'desc': 'Перемещение в водной среде с изменённой физикой. Открывает подводный контент и создаёт уникальные навигационные задачи.',
    'aesthetics': [
      'discovery',
      'sensation',
      'fantasy'
    ],
    'genres': ['adventure', 'horror', 'platformer', 'sandbox', 'stealth', 'survival_horror']
  },
  {
    'group': 'Движение',
    'name': 'Боевая машина',
    'desc': 'Управляемая боевая техника с уникальными характеристиками. Существенно расширяет боевые и навигационные возможности.',
    'aesthetics': [
      'fantasy',
      'sensation',
      'challenge'
    ],
    'genres': ['action', 'action_rpg', 'jrpg', 'mmorpg', 'racing', 'roguelike', 'rpg', 'sandbox']
  },
  {
    'group': 'Движение',
    'name': 'Гравитация',
    'desc': 'Механика управления или изменения гравитации. Кардинально трансформирует навигацию и создаёт уникальные головоломки.',
    'aesthetics': [
      'sensation',
      'challenge',
      'fantasy'
    ],
    'genres': ['adventure', 'educational', 'metroidvania', 'platformer', 'puzzle', 'sandbox', 'simulation']
  },
  {
    'group': 'Экономика',
    'name': 'Экономика',
    'desc': 'Система производства, распределения и потребления ресурсов в игре. Определяет цикл ценности и обмена между игроком и миром.',
    'aesthetics': [
      'submission',
      'expression',
      'challenge'
    ],
    'genres': ['mmorpg', 'rts', 'sandbox', 'simulation', 'strategy', 'survival_horror', 'tbs', 'tycoon']
  },
  {
    'group': 'Экономика',
    'name': 'Торг',
    'desc': 'Обмен предметами или валютой с NPC или игроками. Создаёт социальное взаимодействие и систему оценки ценности.',
    'aesthetics': [
      'fellowship',
      'expression',
      'submission'
    ],
    'genres': ['mmorpg', 'rpg', 'sandbox', 'simulation', 'strategy']
  },
  {
    'group': 'Экономика',
    'name': 'Крафт',
    'desc': 'Создание новых предметов из имеющихся ресурсов. Петля «собери → создай → используй» — фундамент прогрессии через созидание.',
    'aesthetics': [
      'expression',
      'submission',
      'discovery'
    ],
    'genres': ['mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'strategy', 'survival_horror', 'tbs']
  },
  {
    'group': 'Экономика',
    'name': 'Фермерство',
    'desc': 'Систематическое воспроизводство ресурсов через выращивание, разведение или добычу. Создаёт долгосрочные инвестиции времени.',
    'aesthetics': [
      'submission',
      'expression',
      'narrative'
    ],
    'genres': ['farming', 'mmorpg', 'rpg', 'rts', 'sandbox', 'simulation', 'strategy', 'survival_horror']
  },
  {
    'group': 'Экономика',
    'name': 'Аукцион',
    'desc': 'Рыночная система торгов между игроками за предметы. Формирует рыночную стоимость и создаёт конкурентную экономику.',
    'aesthetics': [
      'fellowship',
      'challenge',
      'expression'
    ],
    'genres': ['horror', 'mmorpg', 'rpg', 'sandbox', 'simulation', 'stealth', 'strategy', 'survival_horror']
  },
  {
    'group': 'Экономика',
    'name': 'Зелья',
    'desc': 'Расходуемые предметы с временными эффектами. Создают ресурсную петлю подготовки и потребления в критические моменты.',
    'aesthetics': [
      'fantasy',
      'submission',
      'challenge'
    ],
    'genres': ['action_rpg', 'jrpg', 'mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'strategy']
  },
  {
    'group': 'Экономика',
    'name': 'Аптечки',
    'desc': 'Расходуемые предметы для восстановления здоровья. Управляют риском через ресурс исцеления и создают напряжённость дефицита.',
    'aesthetics': [
      'challenge',
      'submission',
      'sensation'
    ],
    'genres': ['action', 'fighting', 'horror', 'metroidvania', 'mmorpg', 'platformer', 'roguelike', 'rpg']
  },
  {
    'group': 'Экономика',
    'name': 'Лутбоксы',
    'desc': 'Контейнеры со случайным набором предметов. Создают элемент случайности и ожидания награды, управляемый вероятностями.',
    'aesthetics': [
      'submission',
      'sensation',
      'discovery'
    ],
    'genres': ['idle', 'mmorpg', 'roguelike', 'rpg']
  },
  {
    'group': 'Экономика',
    'name': 'Ремонт',
    'desc': 'Восстановление характеристик повреждённых предметов. Создаёт цикл обслуживания экипировки и ресурсные затраты на поддержание.',
    'aesthetics': [
      'submission',
      'challenge',
      'fantasy'
    ],
    'genres': ['action_rpg', 'jrpg', 'mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'simulation']
  },
  {
    'group': 'Социальные',
    'name': 'Кооперация',
    'desc': 'Совместная игра нескольких игроков для достижения общей цели. Создаёт взаимозависимость и коллективный опыт.',
    'aesthetics': [
      'fellowship',
      'challenge',
      'expression'
    ],
    'genres': ['action', 'adventure', 'horror', 'mmorpg', 'platformer', 'rpg', 'shooter', 'survival_horror']
  },
  {
    'group': 'Социальные',
    'name': 'Соревнование',
    'desc': 'Прямое или косвенное противостояние игроков. Создаёт динамику доминирования и мотивацию к совершенствованию.',
    'aesthetics': [
      'challenge',
      'fellowship',
      'expression'
    ],
    'genres': ['fighting', 'party', 'racing', 'shooter', 'sports', 'strategy']
  },
  {
    'group': 'Социальные',
    'name': 'Гильдии',
    'desc': 'Постоянные объединения игроков с общей идентичностью и целями. Создают долгосрочные социальные связи и структуру сообщества.',
    'aesthetics': [
      'fellowship',
      'expression',
      'submission'
    ],
    'genres': ['mmorpg', 'rpg']
  },
  {
    'group': 'Социальные',
    'name': 'Роли',
    'desc': 'Специализация игроков на определённых функциях в группе. Создаёт взаимозависимость и тактическую глубину через асимметрию.',
    'aesthetics': [
      'fellowship',
      'expression',
      'challenge'
    ],
    'genres': ['mmorpg', 'rpg', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Социальные',
    'name': 'Чат',
    'desc': 'Система текстовой или голосовой коммуникации между игроками. Инфраструктура социального взаимодействия и координации.',
    'aesthetics': [
      'fellowship',
      'expression',
      'submission'
    ],
    'genres': ['mmorpg', 'party', 'shooter']
  },
  {
    'group': 'Социальные',
    'name': 'Рейтинги',
    'desc': 'Ранжирование игроков по результатам. Создаёт социальное сравнение и долгосрочную соревновательную мотивацию.',
    'aesthetics': [
      'challenge',
      'fellowship',
      'expression'
    ],
    'genres': ['fighting', 'party', 'racing', 'shooter', 'sports', 'strategy']
  },
  {
    'group': 'Социальные',
    'name': 'Репутация',
    'desc': 'Система оценки отношения мира и игроков к персонажу. Создаёт последствия социального поведения и долгосрочный след действий.',
    'aesthetics': [
      'narrative',
      'expression',
      'fellowship'
    ],
    'genres': ['adventure', 'horror', 'mmorpg', 'rpg', 'sandbox', 'simulation', 'survival_horror', 'tactical_rpg']
  },
  {
    'group': 'Социальные',
    'name': 'Нарратив',
    'desc': 'Система совместного создания истории несколькими игроками. Возникающие нарративы через социальное взаимодействие и игровые события.',
    'aesthetics': [
      'narrative',
      'fellowship',
      'expression'
    ],
    'genres': ['adventure', 'jrpg', 'rpg', 'visual_novel']
  },
  {
    'group': 'Стелс',
    'name': 'Стелс и прятки',
    'desc': 'Избегание обнаружения противниками как основная игровая петля. Подменяет прямое столкновение на навигацию по полю видимости.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'sensation'
    ],
    'genres': ['action', 'adventure', 'horror', 'metroidvania', 'puzzle', 'stealth', 'survival_horror']
  },
  {
    'group': 'Стелс',
    'name': 'Ночное видение',
    'desc': 'Способность видеть в темноте, расширяющая возможности навигации в ночных условиях. Инструмент для управления информационным преимуществом.',
    'aesthetics': [
      'fantasy',
      'discovery',
      'sensation'
    ],
    'genres': ['horror', 'stealth', 'survival_horror']
  },
  {
    'group': 'Стелс',
    'name': 'Без убийств',
    'desc': 'Прохождение без устранения противников. Радикально меняет подход к конфликту и создаёт уникальную динамику ограничения.',
    'aesthetics': [
      'expression',
      'narrative',
      'challenge'
    ],
    'genres': ['action', 'horror', 'stealth']
  },
  {
    'group': 'Стелс',
    'name': 'Тени',
    'desc': 'Использование теней и темноты для сокрытия. Привязывает стелс к пространственным условиям освещения.',
    'aesthetics': [
      'sensation',
      'challenge',
      'fantasy'
    ],
    'genres': ['action', 'horror', 'platformer', 'stealth', 'survival_horror']
  },
  {
    'group': 'Стелс',
    'name': 'Маскировка',
    'desc': 'Изменение внешнего вида для избегания обнаружения или проникновения. Создаёт динамику перевоплощения и социальной инженерии.',
    'aesthetics': [
      'fantasy',
      'narrative',
      'expression'
    ],
    'genres': ['action', 'adventure', 'horror', 'metroidvania', 'puzzle', 'stealth']
  },
  {
    'group': 'Стелс',
    'name': 'Отвлечение',
    'desc': 'Создание шума или события для отвода внимания врагов. Инструмент управления патрульными маршрутами и вниманием AI.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'expression'
    ],
    'genres': ['action', 'horror', 'metroidvania', 'platformer', 'roguelike', 'rpg', 'shooter', 'stealth']
  },
  {
    'group': 'Стелс',
    'name': 'Шум',
    'desc': 'Система звука как механизма обнаружения. Действия игрока создают шум, привлекающий врагов, создавая петлю осторожности.',
    'aesthetics': [
      'challenge',
      'sensation',
      'submission'
    ],
    'genres': ['action', 'adventure', 'horror', 'metroidvania', 'platformer', 'puzzle', 'roguelike', 'rpg']
  },
  {
    'group': 'Навыки',
    'name': 'Классы',
    'desc': 'Предопределённые архетипы персонажей с уникальным набором способностей. Создают идентичность и специализацию с самого начала.',
    'aesthetics': [
      'fantasy',
      'expression',
      'challenge'
    ],
    'genres': ['action_rpg', 'horror', 'mmorpg', 'roguelike', 'rpg', 'sandbox', 'simulation', 'survival_horror']
  },
  {
    'group': 'Навыки',
    'name': 'Дерево навыков',
    'desc': 'Ветвящаяся система разблокируемых способностей. Создаёт долгосрочное планирование развития и визуализацию прогресса.',
    'aesthetics': [
      'expression',
      'submission',
      'discovery'
    ],
    'genres': ['action_rpg', 'mmorpg', 'roguelike', 'rpg', 'tactical_rpg']
  },
  {
    'group': 'Навыки',
    'name': 'Магия',
    'desc': 'Система сверхъестественных способностей с уникальными правилами и ресурсами. Расширяет спектр взаимодействия с миром.',
    'aesthetics': [
      'fantasy',
      'sensation',
      'expression'
    ],
    'genres': ['action_rpg', 'jrpg', 'mmorpg', 'roguelike', 'rpg', 'rts', 'sandbox', 'strategy']
  },
  {
    'group': 'Навыки',
    'name': 'Взлом',
    'desc': 'Навык открытия замков и преодоления электронных систем защиты. Создаёт альтернативные пути и доступ к закрытому контенту.',
    'aesthetics': [
      'challenge',
      'discovery',
      'fantasy'
    ],
    'genres': ['adventure', 'cyberpunk', 'horror', 'platformer', 'puzzle', 'rpg', 'stealth', 'visual_novel']
  },
  {
    'group': 'Навыки',
    'name': 'Карманная кража',
    'desc': 'Незаметное похищение предметов у NPC. Создаёт динамику риска и скрытного обогащения.',
    'aesthetics': [
      'challenge',
      'fantasy',
      'expression'
    ],
    'genres': ['adventure', 'rpg', 'stealth']
  },
  {
    'group': 'Навыки',
    'name': 'Красноречие',
    'desc': 'Навык убеждения и дипломатии в диалогах. Открывает мирные решения конфликтов и доступ к уникальным веткам сюжета.',
    'aesthetics': [
      'narrative',
      'expression',
      'fantasy'
    ],
    'genres': ['adventure', 'jrpg', 'rpg', 'visual_novel']
  },
  {
    'group': 'Навыки',
    'name': 'Кузнечное дело',
    'desc': 'Навык создания и улучшения оружия и брони. Связывает экономику с боевым прогрессом через созидание.',
    'aesthetics': [
      'expression',
      'submission',
      'fantasy'
    ],
    'genres': ['action_rpg', 'mmorpg', 'rpg']
  },
  {
    'group': 'Навыки',
    'name': 'Алхимия',
    'desc': 'Навык создания зелий и химических составов. Петля сбора ингредиентов и экспериментирования с рецептами.',
    'aesthetics': [
      'discovery',
      'expression',
      'fantasy'
    ],
    'genres': ['action_rpg', 'jrpg', 'mmorpg', 'roguelike', 'rpg']
  },
  {
    'group': 'Навыки',
    'name': 'Зачарование',
    'desc': 'Наложение магических свойств на предметы. Создаёт слой кастомизации экипировки и синергии магии с крафтом.',
    'aesthetics': [
      'expression',
      'fantasy',
      'submission'
    ],
    'genres': ['action_rpg', 'jrpg', 'mmorpg', 'roguelike', 'rpg', 'sandbox', 'survival_horror', 'tactical_rpg']
  },
  {
    'group': 'Время',
    'name': 'Цикл день/ночь',
    'desc': 'Периодическая смена времени суток, влияющая на игровой мир. Создаёт ритм доступности контента и изменяет условия игры.',
    'aesthetics': [
      'sensation',
      'fantasy',
      'narrative'
    ],
    'genres': ['adventure', 'horror', 'mmorpg', 'platformer', 'rpg', 'simulation', 'stealth', 'survival_horror']
  },
  {
    'group': 'Время',
    'name': 'Погода',
    'desc': 'Динамические погодные условия, влияющие на геймплей. Создаёт вариативность условий и визуальную атмосферу.',
    'aesthetics': [
      'sensation',
      'fantasy',
      'challenge'
    ],
    'genres': ['adventure', 'racing', 'sandbox', 'simulation', 'survival_horror']
  },
  {
    'group': 'Время',
    'name': 'Таймер',
    'desc': 'Ограничение времени на выполнение действий. Создаёт давление и приоритизацию, повышая интенсивность опыта.',
    'aesthetics': [
      'challenge',
      'sensation',
      'submission'
    ],
    'genres': ['action', 'horror', 'platformer', 'puzzle', 'rhythm', 'stealth', 'strategy', 'tower_defense']
  },
  {
    'group': 'Время',
    'name': 'Перематывание времени',
    'desc': 'Возможность вернуть игровое состояние назад. Инструмент для исправления ошибок и экспериментирования с решениями.',
    'aesthetics': [
      'challenge',
      'expression',
      'discovery'
    ],
    'genres': ['action', 'platformer', 'puzzle', 'strategy']
  },
  {
    'group': 'Время',
    'name': 'Замедление времени',
    'desc': 'Временное снижение скорости игры для повышения точности действий. Создаёт моменты гиперфокуса и зрелищности.',
    'aesthetics': [
      'sensation',
      'challenge',
      'fantasy'
    ],
    'genres': ['action', 'fighting', 'puzzle', 'shooter']
  },
  {
    'group': 'Время',
    'name': 'Сезоны',
    'desc': 'Долгосрочные циклы изменения мира, влияющие на доступность ресурсов и условия. Создают годовой ритм и долгосрочное планирование.',
    'aesthetics': [
      'submission',
      'narrative',
      'discovery'
    ],
    'genres': ['farming', 'mmorpg', 'rts', 'sandbox', 'simulation', 'sports', 'strategy', 'survival_horror']
  },
  {
    'group': 'Время',
    'name': 'Старение',
    'desc': 'Персонаж или мир изменяется с течением времени. Создаёт уникальную динамику ограниченного ресурса — времени жизни.',
    'aesthetics': [
      'narrative',
      'challenge',
      'submission'
    ],
    'genres': ['adventure', 'horror', 'mmorpg', 'rpg', 'rts', 'sandbox', 'simulation', 'strategy']
  },
  {
    'group': 'Время',
    'name': 'Поворот',
    'desc': 'Карточная или раундовая система, где каждый «ход» — дискретная единица времени. Управляет темпом и создаёт стратегическую глубину.',
    'aesthetics': [
      'challenge',
      'submission',
      'expression'
    ],
    'genres': ['puzzle', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Территория',
    'name': 'Захват территории',
    'desc': 'Расширение контроля над областями игрового мира. Создаёт динамику экспансии и конфликт за пространство.',
    'aesthetics': [
      'challenge',
      'fellowship',
      'expression'
    ],
    'genres': ['mmorpg', 'rts', 'shooter', 'strategy', 'tbs']
  },
  {
    'group': 'Территория',
    'name': 'Оборона базы',
    'desc': 'Защита своей территории от нападения. Создаёт динамику подготовки и реакции на угрозы.',
    'aesthetics': [
      'challenge',
      'fellowship',
      'submission'
    ],
    'genres': ['rts', 'shooter', 'strategy', 'tower_defense']
  },
  {
    'group': 'Территория',
    'name': 'Осада',
    'desc': 'Штурм укреплённой позиции противника. Создаёт асимметрию атака/защита и динамику прорыва.',
    'aesthetics': [
      'challenge',
      'sensation',
      'fellowship'
    ],
    'genres': ['mmorpg', 'rts', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Территория',
    'name': 'Контроль точек',
    'desc': 'Удержание ключевых точек на карте для получения преимущества. Создаёт динамику распределения сил и приоритизации.',
    'aesthetics': [
      'challenge',
      'fellowship',
      'submission'
    ],
    'genres': ['fighting', 'mmorpg', 'rts', 'shooter', 'strategy']
  },
  {
    'group': 'Территория',
    'name': 'Патрулирование',
    'desc': 'Регулярное обход территории для обнаружения угроз. Создаёт ритм безопасности и бдительности.',
    'aesthetics': [
      'submission',
      'challenge',
      'narrative'
    ],
    'genres': ['adventure', 'horror', 'metroidvania', 'puzzle', 'rts', 'stealth', 'strategy', 'tower_defense']
  },
  {
    'group': 'Территория',
    'name': 'Разведка',
    'desc': 'Сбор информации о территории и противнике перед действием. Создаёт информационное преимущество и динамику подготовки.',
    'aesthetics': [
      'discovery',
      'challenge',
      'submission'
    ],
    'genres': ['mmorpg', 'rts', 'stealth', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Территория',
    'name': 'Туман войны',
    'desc': 'Сокрытие неисследованных областей карты. Создаёт динамику неизвестности и мотивацию к исследованию.',
    'aesthetics': [
      'discovery',
      'challenge',
      'narrative'
    ],
    'genres': ['rts', 'strategy', 'tactical_rpg', 'tbs']
  },
  {
    'group': 'Территория',
    'name': 'Путешествия',
    'desc': 'Механика дальних перемещений между регионами мира. Создаёт ощущение масштаба и соединяет изолированные зоны.',
    'aesthetics': [
      'discovery',
      'fantasy',
      'submission'
    ],
    'genres': ['adventure', 'jrpg', 'mmorpg', 'rpg', 'sandbox']
  },
  {
    'group': 'Территория',
    'name': 'Прибыль',
    'desc': 'Получение дохода с контролируемой территории. Связывает территориальный контроль с экономическим преимуществом.',
    'aesthetics': [
      'submission',
      'challenge',
      'expression'
    ],
    'genres': ['mmorpg', 'rpg', 'simulation', 'strategy', 'tactical_rpg', 'tycoon']
  },
  {
    'group': 'Сюжет',
    'name': 'Выбор сюжета',
    'desc': 'Ветвление нарратива на основе решений игрока. Ключевая механика агентности в повествовании и реиграбельности.',
    'aesthetics': [
      'narrative',
      'expression',
      'discovery'
    ],
    'genres': ['action_rpg', 'adventure', 'jrpg', 'rpg', 'visual_novel']
  },
  {
    'group': 'Сюжет',
    'name': 'Кат-сцены',
    'desc': 'Неконтролируемые видеовставки, продвигающие повествование. Моменты чистого сторителлинга между интерактивными сегментами.',
    'aesthetics': [
      'narrative',
      'sensation',
      'fantasy'
    ],
    'genres': ['action', 'adventure', 'jrpg', 'mmorpg', 'rpg', 'strategy', 'tactical_rpg', 'visual_novel']
  },
  {
    'group': 'Сюжет',
    'name': 'Дневник',
    'desc': 'Внутриигровой журнал для записи квестов, заметок и лора. Инструмент управления информацией и ориентации в сюжете.',
    'aesthetics': [
      'narrative',
      'submission',
      'discovery'
    ],
    'genres': ['action_rpg', 'adventure', 'jrpg', 'mmorpg', 'rpg', 'survival_horror', 'visual_novel']
  },
  {
    'group': 'Сюжет',
    'name': 'Коллекции',
    'desc': 'Собирание комплектов предметов или достижений. Создаёт петлю коллекционирования и визуализацию полноты опыта.',
    'aesthetics': [
      'submission',
      'discovery',
      'expression'
    ],
    'genres': ['action', 'adventure', 'metroidvania', 'mmorpg', 'platformer', 'rpg', 'shooter']
  },
  {
    'group': 'Сюжет',
    'name': 'Бестиарий',
    'desc': 'Каталог врагов и существ с подробной информацией. Визуализация знаний о мире и мотивация к столкновению с разнообразными врагами.',
    'aesthetics': [
      'discovery',
      'submission',
      'narrative'
    ],
    'genres': ['action', 'adventure', 'horror', 'jrpg', 'metroidvania', 'mmorpg', 'platformer', 'roguelike']
  },
  {
    'group': 'Сюжет',
    'name': 'Воспоминания',
    'desc': 'Фрагменты прошлого, раскрываемые по мере продвижения. Создают нарративную глубину и мотивацию к поиску лора.',
    'aesthetics': [
      'narrative',
      'discovery',
      'fantasy'
    ],
    'genres': ['adventure', 'jrpg', 'rpg', 'visual_novel']
  },
  {
    'group': 'Сюжет',
    'name': 'Фракции',
    'desc': 'Организованные группы NPC с собственными целями и отношениями. Создают систему союзов и конфликтов в мире игры.',
    'aesthetics': [
      'narrative',
      'fellowship',
      'expression'
    ],
    'genres': ['mmorpg', 'rpg', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Сюжет',
    'name': 'Компаньоны',
    'desc': 'NPC-союзники, сопровождающие игрока. Создают эмоциональную привязанность и расширяют возможности через асимметрию навыков.',
    'aesthetics': [
      'narrative',
      'fellowship',
      'fantasy'
    ],
    'genres': ['action_rpg', 'adventure', 'jrpg', 'mmorpg', 'rpg']
  },
  {
    'group': 'Выживание',
    'name': 'Голод',
    'desc': 'Необходимость регулярного приёма пищи для поддержания жизнедеятельности. Создаёт базовую петлю выживания и мотивацию к поиску ресурсов.',
    'aesthetics': [
      'challenge',
      'submission',
      'narrative'
    ],
    'genres': ['horror', 'mmorpg', 'rts', 'sandbox', 'simulation', 'strategy', 'survival_horror', 'tbs']
  },
  {
    'group': 'Выживание',
    'name': 'Жажда',
    'desc': 'Необходимость потребления воды, более критичная и частая, чем голод. Ускоряет цикл выживания и создаёт приоритет поиска воды.',
    'aesthetics': [
      'challenge',
      'submission',
      'sensation'
    ],
    'genres': ['horror', 'sandbox', 'simulation', 'survival_horror']
  },
  {
    'group': 'Выживание',
    'name': 'Сон',
    'desc': 'Необходимость отдыха для восстановления характеристик. Создаёт цикл активности и отдыха, управляя темпом игры.',
    'aesthetics': [
      'submission',
      'narrative',
      'challenge'
    ],
    'genres': ['action_rpg', 'horror', 'jrpg', 'mmorpg', 'roguelike', 'rpg', 'sandbox', 'simulation']
  },
  {
    'group': 'Выживание',
    'name': 'Температура',
    'desc': 'Влияние температуры среды на персонажа. Создаёт экологическое давление и необходимость адаптации через экипировку и укрытия.',
    'aesthetics': [
      'challenge',
      'sensation',
      'submission'
    ],
    'genres': ['action', 'horror', 'sandbox', 'shooter', 'simulation', 'survival_horror', 'tactical_rpg']
  },
  {
    'group': 'Выживание',
    'name': 'Болезни',
    'desc': 'Система заболеваний, ослабляющих персонажа. Создаёт долгосрочные последствия и мотивацию к поиску лечения.',
    'aesthetics': [
      'challenge',
      'narrative',
      'submission'
    ],
    'genres': ['horror', 'rpg', 'sandbox', 'simulation', 'survival_horror']
  },
  {
    'group': 'Выживание',
    'name': 'Износ',
    'desc': 'Постепенная деградация предметов при использовании. Создаёт цикл обслуживания и давление на экономику расходных материалов.',
    'aesthetics': [
      'challenge',
      'submission',
      'narrative'
    ],
    'genres': ['rpg', 'sandbox', 'shooter', 'simulation', 'survival_horror']
  },
  {
    'group': 'Выживание',
    'name': 'Пермасмерть',
    'desc': 'Безвозвратная потеря персонажа при смерти. Максимальная ставка риска, кардинально меняющая отношение к каждому решению.',
    'aesthetics': [
      'challenge',
      'narrative',
      'sensation'
    ],
    'genres': ['horror', 'roguelike', 'sandbox', 'simulation', 'strategy', 'survival_horror', 'tactical_rpg']
  },
  {
    'group': 'Выживание',
    'name': 'Сохранения',
    'desc': 'Система фиксации прогресса для восстановления после неудачи. Баланс между доступностью и ставкой риска.',
    'aesthetics': [
      'submission',
      'challenge',
      'narrative'
    ],
    'genres': ['adventure', 'horror', 'rpg', 'strategy', 'survival_horror']
  },
  {
    'group': 'Информация',
    'name': 'Миникарта',
    'desc': 'Упрощённая карта ближайшего окружения. Снижает когнитивную нагрузку навигации и поддерживает ориентацию.',
    'aesthetics': [
      'submission',
      'discovery',
      'sensation'
    ],
    'genres': ['mmorpg', 'moba', 'rts', 'shooter', 'strategy']
  },
  {
    'group': 'Информация',
    'name': 'Маркеры',
    'desc': 'Визуальные указатели целей и интересных объектов на карте и в мире. Направляют внимание и снижают фрустрацию поиска.',
    'aesthetics': [
      'submission',
      'discovery',
      'challenge'
    ],
    'genres': ['adventure', 'mmorpg', 'rpg', 'sandbox', 'shooter']
  },
  {
    'group': 'Информация',
    'name': 'Подсказки',
    'desc': 'Система контекстных советов и направлений для игрока. Снижает порог входа и помогает в моменты застревания.',
    'aesthetics': [
      'submission',
      'challenge',
      'discovery'
    ],
    'genres': ['adventure', 'educational', 'puzzle', 'rpg']
  },
  {
    'group': 'Информация',
    'name': 'Сканирование',
    'desc': 'Активное выявление свойств объектов и врагов. Создаёт информационную петлю «сканируй → анализируй → действуй».',
    'aesthetics': [
      'discovery',
      'challenge',
      'submission'
    ],
    'genres': ['action', 'adventure', 'horror', 'metroidvania', 'platformer', 'puzzle', 'roguelike', 'rpg']
  },
  {
    'group': 'Информация',
    'name': 'Интеллект',
    'desc': 'Система сбора и анализа стратегической информации о противнике. Создаёт слой разведки перед принятием решений.',
    'aesthetics': [
      'challenge',
      'discovery',
      'submission'
    ],
    'genres': ['mmorpg', 'puzzle', 'rts', 'stealth', 'strategy', 'tactical_rpg', 'tbs']
  },
  {
    'group': 'Информация',
    'name': 'Учебник',
    'desc': 'Внутриигровое руководство по механикам и системам. Снижает барьер обучения и служит справочником.',
    'aesthetics': [
      'submission',
      'challenge',
      'discovery'
    ],
    'genres': ['action', 'educational', 'puzzle', 'rpg']
  },
  {
    'group': 'Информация',
    'name': 'Статистика',
    'desc': 'Детальная числовая информация о прогрессе и результатах. Создаёт основу для анализа и оптимизации игрового процесса.',
    'aesthetics': [
      'submission',
      'challenge',
      'expression'
    ],
    'genres': ['mmorpg', 'rpg', 'simulation', 'sports', 'strategy']
  },
  {
    'group': 'Информация',
    'name': 'Лог событий',
    'desc': 'Хронологическая запись игровых событий. Инструмент анализа и восстановления контекста после перерыва.',
    'aesthetics': [
      'submission',
      'narrative',
      'discovery'
    ],
    'genres': ['mmorpg', 'simulation', 'strategy', 'tactical_rpg']
  },
  {
    'group': 'Информация',
    'name': 'Обнаружение',
    'desc': 'Система визуального и аудиального выявления объектов и врагов. Создаёт динамику заметности и скрытности.',
    'aesthetics': [
      'discovery',
      'challenge',
      'sensation'
    ],
    'genres': ['action', 'adventure', 'horror', 'metroidvania', 'platformer', 'puzzle', 'roguelike', 'rpg']
  },
  {
    'group': 'Мета',
    'name': 'Достижения платформы',
    'desc': 'Мета-достижения, привязанные к платформе (Steam, PlayStation и т.д.). Создают внешний слой мотивации и социальную видимость.',
    'aesthetics': [
      'submission',
      'expression',
      'challenge'
    ],
    'genres': ['action', 'adventure', 'mmorpg', 'platformer', 'rpg', 'shooter']
  },
  {
    'group': 'Мета',
    'name': 'Торговая площадка',
    'desc': 'Платформенная система торговли предметами между игроками за реальные деньги. Создаёт реальную экономику вокруг виртуальных предметов.',
    'aesthetics': [
      'submission',
      'expression',
      'fellowship'
    ],
    'genres': ['mmorpg', 'rpg', 'sandbox', 'simulation', 'strategy']
  },
  {
    'group': 'Мета',
    'name': 'DLC',
    'desc': 'Загружаемый дополнительный контент, расширяющий игру. Управляет жизненным циклом продукта и доступностью контента.',
    'aesthetics': [
      'discovery',
      'submission',
      'narrative'
    ],
    'genres': ['action', 'adventure', 'horror', 'platformer', 'rpg', 'shooter', 'stealth', 'strategy']
  },
  {
    'group': 'Мета',
    'name': 'Модификации',
    'desc': 'Пользовательские изменения игры. Расширяют вариативность и жизненный цикл через вклад сообщества.',
    'aesthetics': [
      'expression',
      'discovery',
      'submission'
    ],
    'genres': ['rpg', 'sandbox', 'shooter', 'simulation', 'strategy']
  },
  {
    'group': 'Мета',
    'name': 'Стриминг',
    'desc': 'Интеграция с платформами трансляций и системами зрителей. Создаёт слой социального опыта вокруг игры.',
    'aesthetics': [
      'fellowship',
      'expression',
      'sensation'
    ],
    'genres': ['action', 'fighting', 'party', 'shooter']
  },
  {
    'group': 'Мета',
    'name': 'Кроссплатформа',
    'desc': 'Совместная игра и перенос прогресса между платформами. Расширяет аудиторию и снижает барьеры доступа.',
    'aesthetics': [
      'fellowship',
      'submission',
      'expression'
    ],
    'genres': ['fighting', 'mmorpg', 'racing', 'shooter', 'sports']
  },
  {
    'group': 'Мета',
    'name': 'Микротранзакции',
    'desc': 'Маленькие внутриигровые покупки за реальные деньги. Монетизируют бесплатный или условно-бесплатный опыт.',
    'aesthetics': [
      'submission',
      'expression'
    ],
    'genres': ['idle', 'mmorpg', 'mobile', 'rpg', 'strategy']
  },
  {
    'group': 'Мета',
    'name': 'Сезонный пропуск',
    'desc': 'Временная система прогрессии с уникальными наградами. Создаёт цикл удержания и срочность вовлечения.',
    'aesthetics': [
      'submission',
      'expression',
      'challenge'
    ],
    'genres': ['farming', 'fighting', 'mmorpg', 'racing', 'shooter', 'simulation', 'sports']
  }
];

// ============================================================
// API: поиск и фильтрация механик
// ============================================================

/** Получить все уникальные группы механик. */
export function getMechanicGroups(): string[] {
  const groups = new Set<string>();
  for (const m of MECHANICS_DB) {
    groups.add(m.group);
  }
  return Array.from(groups);
}

/**
 * Найти механики по жанру (genre_affinity ≥ 2).
 * Возвращает массив механик, отсортированный по релевантности.
 */
export function findMechanicsByGenre(genre: string): Mechanic[] {
  // TASK-1.15: trim + normalize whitespace to underscore.
  const genreLower = genre.toLowerCase().trim().replace(/\s+/g, "_");
  return MECHANICS_DB
    .filter((m) => m.genres.includes(genreLower))
    .sort((a, b) => {
      // Mechanics with more genre matches first
      return b.genres.length - a.genres.length;
    });
}

/**
 * Найти механики по эстетике LeBlanc (8 aesthetic types).
 * aesthetics: discovery, fantasy, sensation, narrative, challenge, fellowship, expression, submission
 */
export function findMechanicsByAesthetic(aesthetic: string): Mechanic[] {
  return MECHANICS_DB.filter((m) => m.aesthetics.includes(aesthetic));
}

/**
 * Подобрать набор механик для жанра.
 *
 * TASK-1.8 FIXED: оригинальная реализация имела `if (count >= 5) break;` после
 * которого 2/5 категорий оставались пустыми и fallback на английские имена из
 * GENRE_MECHANICS.default. Новая реализация:
 *   1. Берёт ВСЕ 15 групп в порядке приоритета, по 1-2 механики из каждой.
 *   2. Ограничивает итоговое количество mechanicals (targetTotalCount, по умолч. 10).
 *   3. Гарантирует минимум 1 механику в каждой из 5 концептуальных категорий
 *      (базовые/боевые/прогрессия/пространство/экономика), если такие группы есть в БД.
 *   4. Compatibility score теперь реалистично отражает совпадение по жанру
 *      (после TASK-1.1 genres[] заполнены, score будет 0-100 осмысленно).
 *
 * TASK-1.17/1.18: для поддержки primary + subgenres и cross-genre mechanics
 * используйте новую функцию `buildMechanicSetForGenres()` ниже. Эта функция
 * оставлена для backward compatibility (делегирует в новую с одним жанром).
 */
export function buildMechanicSetForGenre(
  genre: string,
  forbiddenMechanics: string[] = []
): {
  groups: Record<string, Mechanic[]>;
  total_count: number;
  compatibility_score: number;
  source: string;
  cross_genre_mechanics?: Mechanic[];
} {
  return buildMechanicSetForGenres([genre], forbiddenMechanics, {});
}

/**
 * Подобрать набор механик для нескольких жанров (primary + subgenres).
 *
 * TASK-1.17: поддержка primary genre + subgenres.
 *   - "Action RPG" → primary="action", subgenres=["rpg"]
 *   - "Roguelike deckbuilder" → primary="roguelike", subgenres=["strategy"]
 *   - Механики, релевантные ЛЮБОМУ из жанров, попадают в основной pool.
 *   - Приоритет отдаётся механикам, релевантным нескольким жанрам одновременно
 *     (например, "Здоровье" релевантно и action, и rpg → high priority).
 *
 * TASK-1.18: cross-genre mechanics — добавление механик из ДРУГИХ жанров
 *   для создания интересных разножанровых сочетаний.
 *   - Cross-genre candidates: механики, чьи `aesthetics` пересекаются с
 *     aesthetics основного набора, но `genres` НЕ пересекаются с переданными.
 *   - Это позволяет находить неочевидные гибриды:
 *     * "Прыжки" (platformer) + "Головоломки" (puzzle) → puzzle platformer
 *     * "Ритм" (rhythm) + "Боевые" (fighting) → rhythm combat
 *   - Количество cross-genre механик: ~15-20% от основного набора (настраивается).
 *   - Каждая cross-genre механика помечается в результате для UI.
 *
 * @param genres — массив жанров: [primary, ...subgenres]
 * @param forbiddenMechanics — механики для исключения
 * @param options.crossGenreRatio — доля cross-genre механик (0.0-0.5, default 0.18)
 * @param options.targetTotal — целевое количество механик (default 12)
 * @param options.perGroup — макс. механик из одной группы (default 2)
 */
export function buildMechanicSetForGenres(
  genres: string[],
  forbiddenMechanics: string[] = [],
  options: {
    crossGenreRatio?: number;
    targetTotal?: number;
    perGroup?: number;
  } = {}
): {
  groups: Record<string, Mechanic[]>;
  total_count: number;
  compatibility_score: number;
  source: string;
  cross_genre_mechanics: Mechanic[];
} {
  const genreLowers = genres
    .map((g) => g.toLowerCase().replace(/\s+/g, "_"))
    .filter((g) => g.length > 0);

  if (genreLowers.length === 0) {
    genreLowers.push("action");
  }

  const primaryGenre = genreLowers[0];
  const crossGenreRatio = options.crossGenreRatio ?? 0.18;
  const TARGET_TOTAL = options.targetTotal ?? 12;
  const PER_GROUP = options.perGroup ?? 2;

  // Forbidden filter (применяется ко всем pool'ам).
  const isForbidden = (m: Mechanic) =>
    forbiddenMechanics.some((f) => m.name.toLowerCase().includes(f.toLowerCase()));

  // --- 1. Найти механики, релевантные любому из жанров ---
  const matching = MECHANICS_DB
    .filter((m) => !isForbidden(m))
    .filter((m) => m.genres.some((g) => genreLowers.includes(g)));

  // Если нет совпадений — fallback ко всей БД.
  const fallback = MECHANICS_DB.filter((m) => !isForbidden(m));
  const pool = matching.length >= 5 ? matching : fallback;

  // --- 2. Сортировка pool по количеству совпадающих жанров (multi-genre priority) ---
  // Механики, релевантные нескольким жанрам, получают приоритет.
  const poolWithScores = pool.map((m) => {
    const genreMatchCount = m.genres.filter((g) => genreLowers.includes(g)).length;
    return { mechanic: m, genreMatchCount };
  });
  poolWithScores.sort((a, b) => b.genreMatchCount - a.genreMatchCount);

  // --- 3. Группировка по group ---
  const byGroup: Record<string, Mechanic[]> = {};
  for (const { mechanic } of poolWithScores) {
    if (!byGroup[mechanic.group]) byGroup[mechanic.group] = [];
    byGroup[mechanic.group].push(mechanic);
  }

  // --- 4. Выбор механик из каждой группы ---
  const PRIORITY_GROUPS = [
    "Базовые", "Боевые", "Прогрессия", "Пространство", "Экономика",
    "Движение", "Социальные", "Выживание", "Стелс", "Навыки",
    "Время", "Территория", "Сюжет", "Информация", "Мета",
  ];

  const selected: Record<string, Mechanic[]> = {};
  let count = 0;

  // Первый проход: 5 основных групп, минимум 1 механика каждая.
  for (const g of PRIORITY_GROUPS.slice(0, 5)) {
    if (!byGroup[g] || byGroup[g].length === 0) continue;
    const picks = byGroup[g].slice(0, PER_GROUP);
    selected[g] = picks;
    count += picks.length;
  }

  // Второй проход: остальные группы, пока не достигнем TARGET_TOTAL.
  for (const g of PRIORITY_GROUPS.slice(5)) {
    if (count >= TARGET_TOTAL) break;
    if (!byGroup[g] || byGroup[g].length === 0) continue;
    const remaining = TARGET_TOTAL - count;
    const picks = byGroup[g].slice(0, Math.min(PER_GROUP, remaining));
    selected[g] = picks;
    count += picks.length;
  }

  const allSelected = Object.values(selected).flat();
  const selectedNames = new Set(allSelected.map((m) => m.name));

  // --- 5. TASK-1.18: Cross-genre mechanics ---
  // Найти механики, чьи aesthetics пересекаются с aesthetics основного набора,
  // но genres НЕ пересекаются с переданными жанрами.
  const primaryAesthetics = new Set<string>();
  for (const m of allSelected) {
    for (const a of m.aesthetics) primaryAesthetics.add(a);
  }

  const crossGenreCandidates = MECHANICS_DB
    .filter((m) => !isForbidden(m))
    .filter((m) => !selectedNames.has(m.name))
    .filter((m) => {
      // Не должно быть совпадения по жанру
      const genreMatch = m.genres.some((g) => genreLowers.includes(g));
      if (genreMatch) return false;
      // Должно быть совпадение по aesthetic
      return m.aesthetics.some((a) => primaryAesthetics.has(a));
    })
    // Сортировка: больше пересечений по aesthetics = выше приоритет.
    .map((m) => ({
      mechanic: m,
      aestheticOverlap: m.aesthetics.filter((a) => primaryAesthetics.has(a)).length,
    }))
    .sort((a, b) => b.aestheticOverlap - a.aestheticOverlap);

  // Целевое количество cross-genre механик.
  const crossGenreTarget = Math.max(
    1,
    Math.round(allSelected.length * crossGenreRatio)
  );
  const crossGenrePicks = crossGenreCandidates
    .slice(0, crossGenreTarget)
    .map((x) => x.mechanic);

  // Добавляем cross-genre механики в существующие группы (по их group).
  // Не увеличиваем count — они "bonus" механики.
  for (const m of crossGenrePicks) {
    if (!selected[m.group]) selected[m.group] = [];
    if (!selected[m.group].some((x) => x.name === m.name)) {
      selected[m.group].push(m);
    }
  }

  // --- 6. Compatibility score ---
  // Считаем по primary жанру (как в оригинальной реализации).
  // Cross-genre механики НЕ считаются "matching" по жанру (по определению).
  const finalSelected = Object.values(selected).flat();
  const genreMatches = finalSelected.filter((m) =>
    m.genres.includes(primaryGenre)
  ).length;
  const compatibilityScore = finalSelected.length > 0
    ? Math.round((genreMatches / finalSelected.length) * 100)
    : 50;

  return {
    groups: selected,
    total_count: finalSelected.length,
    compatibility_score: compatibilityScore,
    source: "MechanicsDB (SW.BAND, 128 механик)",
    cross_genre_mechanics: crossGenrePicks,
  };
}

/** Получить механики по группе. */
export function getMechanicsByGroup(group: string): Mechanic[] {
  return MECHANICS_DB.filter((m) => m.group === group);
}

/** Статистика MechanicsDB. */
export function getMechanicsDBStats(): {
  total: number;
  groups: number;
  mechanicsPerGroup: Record<string, number>;
} {
  const groups: Record<string, number> = {};
  for (const m of MECHANICS_DB) {
    groups[m.group] = (groups[m.group] || 0) + 1;
  }
  return {
    total: MECHANICS_DB.length,
    groups: Object.keys(groups).length,
    mechanicsPerGroup: groups,
  };
}
