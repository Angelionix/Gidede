"""
MechanicsDB — База данных игровых механик для системы Gidede.

Источник: SW.BAND, «Карты геймдизайнера» (Книга 15) — таксономия игровых механик.
Структура адаптирована под MDA-фреймворк (Hunicke, LeBlanc, Zubek 2004):
  - dynamics_served: какие динамики (динамические паттерны взаимодействия) порождает механика
  - aesthetics_served: какие из 8 эстетических ценностей LeBlanc обслуживает

Переменная MECHANICS_DB_DATA содержит 128 механик в 15 группах.
Каждая механика — dict со следующими полями:
  - group_id (int): идентификатор группы 1–15
  - group_name (str): название группы на русском
  - mechanic_name (str): название механики на русском
  - description (str): описание механики на русском
  - dynamics_served (list[str]): список динамик на русском
  - aesthetics_served (list[str]): список эстетик LeBlanc на английском
      (sensation, fantasy, narrative, challenge, fellowship, discovery, expression, submission)
  - genre_affinity (dict[str, int]): жанр → аффинность 0–3 (включены только жанры с баллом ≥ 1)
      Ключи — идентификаторы жанров на английском (см. Genre enum):
      action, platformer, shooter, fighting, stealth, survival_horror, rhythm,
      adventure, rpg, action_rpg, jrpg, tactical_rpg, mmorpg, roguelike,
      simulation, strategy, rts, tbs, tower_defense, puzzle, party,
      educational, racing, sports, sandbox, horror, metroidvania, idle, visual_novel
  - conflicts_with (list[str]): названия механик на русском, с которыми конфликтует
  - synergies_with (list[str]): названия механик на русском, с которыми синергизирует
"""

MECHANICS_DB_DATA: list[dict] = [
    # ================================================================
    # ГРУППА 1: Базовые (9 механик)
    # ================================================================
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Изучение мира",
        "description": "Игрок исследует игровое пространство, открывая новые локации и объекты. Фундаментальная механика, определяющая паттерны перемещения и обнаружения.",
        "dynamics_served": ["Исследование", "Ориентация", "Ощущение новизны"],
        "aesthetics_served": ["discovery", "fantasy", "sensation"],
        "genre_affinity": {"adventure": 3, "metroidvania": 3, "sandbox": 3, "rpg": 2, "action_rpg": 2, "survival_horror": 2, "horror": 2, "jrpg": 1, "roguelike": 2, "mmorpg": 2},
        "conflicts_with": ["Таймер", "Линейный сюжет"],
        "synergies_with": ["Карта мира", "Секретные уровни", "Тайники", "Миникарта", "Маркеры"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Достижения и очки",
        "description": "Система начисления очков и мета-целей, мотивирующая игрока к повторным действиям и совершенствованию результатов.",
        "dynamics_served": ["Мотивация", "Соревнование", "Самоутверждение"],
        "aesthetics_served": ["challenge", "submission", "expression"],
        "genre_affinity": {"action": 2, "platformer": 2, "shooter": 2, "puzzle": 2, "racing": 2, "sports": 2, "roguelike": 2, "party": 1, "rpg": 1, "idle": 3},
        "conflicts_with": ["Нарратив", "Стелс и прятки"],
        "synergies_with": ["Рейтинги", "Достижения", "Достижения платформы", "Статистика"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Враги",
        "description": "Наличие противников, создающих препятствия и угрозы. Основа конфликтного взаимодействия и баланса вызова.",
        "dynamics_served": ["Угроза", "Конфликт", "Напряжённость"],
        "aesthetics_served": ["challenge", "fantasy", "narrative"],
        "genre_affinity": {"action": 3, "shooter": 3, "fighting": 3, "survival_horror": 3, "horror": 3, "stealth": 2, "rpg": 2, "action_rpg": 2, "metroidvania": 2, "roguelike": 2, "tower_defense": 2, "strategy": 1},
        "conflicts_with": ["Без убийств", "Пазл"],
        "synergies_with": ["Броня", "Запас патронов", "Укрытия", "Спецатаки", "Здоровье"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Инвентарь",
        "description": "Система хранения и управления предметами. Управление ограниченным пространством создаёт стратегические решения о приоритетах.",
        "dynamics_served": ["Управление ресурсами", "Принятие решений", "Сбор"],
        "aesthetics_served": ["submission", "expression", "discovery"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "mmorpg": 3, "survival_horror": 2, "roguelike": 2, "adventure": 2, "sandbox": 2, "horror": 1},
        "conflicts_with": ["Бесконечный инвентарь"],
        "synergies_with": ["Крафт", "Обмундирование", "Ресурсы", "Лутбоксы", "Зелья"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Квесты",
        "description": "Структурированные задания с целями и наградами. Направляют игрока и создают микро-нарративные арки в рамках игровой сессии.",
        "dynamics_served": ["Целеполагание", "Направление", "Награда"],
        "aesthetics_served": ["narrative", "challenge", "submission"],
        "genre_affinity": {"rpg": 3, "mmorpg": 3, "action_rpg": 3, "jrpg": 2, "adventure": 3, "tactical_rpg": 2, "roguelike": 1, "visual_novel": 2},
        "conflicts_with": ["Сезонный пропуск", "Песочница без целей"],
        "synergies_with": ["Выбор сюжета", "Фракции", "Репутация", "Дневник"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Головоломки",
        "description": "Интеллектуальные задачи, требующие логики, наблюдательности или пространственного мышления для решения.",
        "dynamics_served": ["Решение проблем", "Инсайт", "Познавательная нагрузка"],
        "aesthetics_served": ["challenge", "discovery", "submission"],
        "genre_affinity": {"puzzle": 3, "adventure": 3, "metroidvania": 2, "educational": 3, "visual_novel": 1, "roguelike": 1, "rpg": 1, "tactical_rpg": 1, "idle": 1},
        "conflicts_with": ["Рывок", "Бесшумное оружие"],
        "synergies_with": ["Взлом", "Секретные уровни", "Подсказки", "Сканирование"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Колода карт",
        "description": "Механика построения и использования колоды карт как основы игровой системы. Каждая карта — действие, ресурс или сущность.",
        "dynamics_served": ["Стратегическое планирование", "Вариативность", "Синергия элементов"],
        "aesthetics_served": ["challenge", "expression", "discovery"],
        "genre_affinity": {"roguelike": 3, "strategy": 2, "tbs": 2, "rpg": 1, "puzzle": 1, "party": 2, "simulation": 1},
        "conflicts_with": ["Реалтайм-бой", "Рывок"],
        "synergies_with": ["Дерево навыков", "Крафт", "Ресурсы", "Перки"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Здоровье",
        "description": "Система очков жизни персонажа. Определяет порог выживания и создаёт базовую петлю риска — избегание урона против получения преимущества.",
        "dynamics_served": ["Выживание", "Управление риском", "Обратная связь"],
        "aesthetics_served": ["challenge", "fantasy", "narrative"],
        "genre_affinity": {"action": 3, "shooter": 3, "fighting": 3, "rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "metroidvania": 3, "roguelike": 3, "survival_horror": 3, "mmorpg": 2, "stealth": 2, "platformer": 2, "horror": 3},
        "conflicts_with": ["Пермасмерть", "Бессмертие"],
        "synergies_with": ["Аптечки", "Броня", "Зелья", "Голод", "Ремонт"]
    },
    {
        "group_id": 1,
        "group_name": "Базовые",
        "mechanic_name": "Древо технологий",
        "description": "Ветвящаяся структура разблокируемых технологий или улучшений. Создаёт долгосрочные стратегии развития и решения о специализации.",
        "dynamics_served": ["Стратегическое планирование", "Специализация", "Долгосрочная мотивация"],
        "aesthetics_served": ["submission", "expression", "discovery"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "rpg": 2, "mmorpg": 2, "simulation": 2, "action_rpg": 2, "tower_defense": 2, "sandbox": 1, "roguelike": 1},
        "conflicts_with": ["Случайные улучшения", "Лутбоксы"],
        "synergies_with": ["Ресурсы", "Дерево навыков", "Уровни", "Прокачка оружия", "Крафт"]
    },

    # ================================================================
    # ГРУППА 2: Прогрессия (9 механик)
    # ================================================================
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Очки опыта",
        "description": "Количественная мера прогресса персонажа, накапливаемая через действия. Управляет темпом роста и создаёт петлю «действие → награда → рост».",
        "dynamics_served": ["Накопление", "Рост", "Мотивация к действию"],
        "aesthetics_served": ["submission", "challenge", "fantasy"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "mmorpg": 3, "roguelike": 2, "action": 1, "shooter": 1},
        "conflicts_with": ["Пермасмерть", "Отсутствие уровней"],
        "synergies_with": ["Уровни", "Перки", "Характеристики", "Дерево навыков"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Перки",
        "description": "Пассивные или активные бонусы, получаемые при определённых условиях. Добавляют вариативность билда и персонализацию персонажа.",
        "dynamics_served": ["Специализация", "Вариативность билда", "Адаптация"],
        "aesthetics_served": ["expression", "fantasy", "challenge"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "tactical_rpg": 3, "mmorpg": 3, "shooter": 2, "jrpg": 2, "roguelike": 2, "stealth": 1, "sandbox": 1},
        "conflicts_with": ["Фиксированный класс без выбора"],
        "synergies_with": ["Очки опыта", "Уровни", "Классы", "Дерево навыков", "Характеристики"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Характеристики",
        "description": "Числовые параметры персонажа (сила, ловкость, интеллект и пр.), определяющие его возможности. Фундамент ролевой системы.",
        "dynamics_served": ["Специализация", "Сравнение", "Мин-максинг"],
        "aesthetics_served": ["expression", "submission", "fantasy"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "mmorpg": 3, "roguelike": 2, "strategy": 1, "sports": 1},
        "conflicts_with": ["Действие без статов"],
        "synergies_with": ["Очки опыта", "Уровни", "Обмундирование", "Перки", "Классы"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Обмундирование",
        "description": "Система экипировки персонажа — оружие, броня, аксессуары. Управляет силой персонажа и визуальной идентичностью.",
        "dynamics_served": ["Прогресс силы", "Визуальная идентичность", "Охота за предметами"],
        "aesthetics_served": ["fantasy", "expression", "submission"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "jrpg": 2, "tactical_rpg": 2, "roguelike": 2, "shooter": 2, "survival_horror": 1, "adventure": 1},
        "conflicts_with": ["Без предметов"],
        "synergies_with": ["Инвентарь", "Прокачка оружия", "Крафт", "Зачарование", "Ремонт"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Прокачка оружия",
        "description": "Улучшение оружия через модификации, апгрейды или опыт использования. Связывает прогресс игрока с конкретным инструментом.",
        "dynamics_served": ["Привязанность к предмету", "Постепенный рост", "Специализация оружия"],
        "aesthetics_served": ["submission", "expression", "fantasy"],
        "genre_affinity": {"shooter": 3, "action_rpg": 3, "rpg": 2, "mmorpg": 2, "action": 2, "roguelike": 2, "metroidvania": 1},
        "conflicts_with": ["Случайное оружие", "Износ"],
        "synergies_with": ["Обмундирование", "Крафт", "Зачарование", "Древо технологий", "Ресурсы"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Достижения",
        "description": "Мета-цели, фиксирующие промежуточные успехи игрока. Создают дополнительные мотивации и направления игры вне основного прогресса.",
        "dynamics_served": ["Мотивация коллекционирования", "Подтверждение мастерства", "Вектор направления"],
        "aesthetics_served": ["submission", "challenge", "expression"],
        "genre_affinity": {"mmorpg": 3, "rpg": 2, "action": 2, "shooter": 2, "platformer": 2, "roguelike": 2, "adventure": 2, "sandbox": 2, "idle": 2, "puzzle": 1},
        "conflicts_with": ["Чистый нарратив"],
        "synergies_with": ["Достижения платформы", "Рейтинги", "Коллекции", "Статистика", "Бестиарий"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Ресурсы",
        "description": "Собираемые материалы и валюты, используемые для крафта, торговли и строительства. Основа экономических петель игры.",
        "dynamics_served": ["Сбор", "Управление дефицитом", "Обмен"],
        "aesthetics_served": ["submission", "discovery", "challenge"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "mmorpg": 3, "rpg": 2, "action_rpg": 2, "simulation": 3, "sandbox": 3, "survival_horror": 2, "tower_defense": 2, "roguelike": 1},
        "conflicts_with": ["Бесконечные ресурсы"],
        "synergies_with": ["Крафт", "Экономика", "Фермерство", "Строительство", "Древо технологий"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Уровни",
        "description": "Дискретные ступени прогресса персонажа или игрока. Разбивают непрерывный рост на значимые этапы с пороговыми наградами.",
        "dynamics_served": ["Этапность", "Момент вознаграждения", "Ожидание"],
        "aesthetics_served": ["submission", "fantasy", "challenge"],
        "genre_affinity": {"rpg": 3, "mmorpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "roguelike": 2, "shooter": 1, "action": 1, "idle": 3},
        "conflicts_with": ["Бесуровневая система"],
        "synergies_with": ["Очки опыта", "Перки", "Характеристики", "Сложность", "Древо технологий"]
    },
    {
        "group_id": 2,
        "group_name": "Прогрессия",
        "mechanic_name": "Сложность",
        "description": "Система управления уровнем вызова, адаптирующая опыт под игрока. Включает статическую, динамическую и выбираемую сложность.",
        "dynamics_served": ["Баланс вызова и навыка", "Поток", "Фрустрация/скука"],
        "aesthetics_served": ["challenge", "submission", "narrative"],
        "genre_affinity": {"action": 3, "shooter": 2, "rpg": 2, "action_rpg": 2, "fighting": 3, "platformer": 2, "roguelike": 3, "survival_horror": 3, "horror": 3, "stealth": 2, "puzzle": 2, "metroidvania": 2},
        "conflicts_with": ["Лёгкий режим без последствий"],
        "synergies_with": ["Уровни", "Враги", "Пермасмерть", "Здоровье", "Таймер"]
    },

    # ================================================================
    # ГРУППА 3: Пространство (9 механик)
    # ================================================================
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Карта мира",
        "description": "Обзорная карта игрового мира для навигации и планирования маршрутов. Создаёт ощущение масштаба и связности мира.",
        "dynamics_served": ["Навигация", "Планирование маршрута", "Ощущение масштаба"],
        "aesthetics_served": ["discovery", "fantasy", "submission"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "adventure": 3, "sandbox": 3, "strategy": 3, "rts": 2, "tbs": 2, "metroidvania": 2, "jrpg": 2, "roguelike": 1},
        "conflicts_with": ["Линейные уровни без выбора"],
        "synergies_with": ["Миникарта", "Маркеры", "Телепортация", "Путешествия", "Туман войны"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Зона игры",
        "description": "Ограниченное игровое пространство с определёнными правилами. Создаёт арену для взаимодействия и фокусирует игровой опыт.",
        "dynamics_served": ["Фокусировка", "Изоляция", "Плотность взаимодействия"],
        "aesthetics_served": ["challenge", "fellowship", "sensation"],
        "genre_affinity": {"fighting": 3, "shooter": 3, "rts": 3, "tower_defense": 3, "party": 3, "sports": 3, "racing": 3, "action": 2, "roguelike": 2},
        "conflicts_with": ["Открытый мир"],
        "synergies_with": ["Контроль точек", "Осада", "Захват территории", "Оборона базы"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Альтернативы",
        "description": "Наличие нескольких путей достижения цели. Поддерживает игроковую автономию и реиграбельность через вариативность подходов.",
        "dynamics_served": ["Автономия", "Реиграбельность", "Выбор стратегии"],
        "aesthetics_served": ["expression", "discovery", "challenge"],
        "genre_affinity": {"adventure": 3, "rpg": 3, "action_rpg": 2, "stealth": 3, "metroidvania": 2, "sandbox": 3, "puzzle": 2, "mmorpg": 1},
        "conflicts_with": ["Линейный коридор"],
        "synergies_with": ["Выбор сюжета", "Классы", "Стелс и прятки", "Головоломки"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Мультицели",
        "description": "Несколько одновременных целей в одном пространстве. Создаёт приоритизацию и стратегический выбор распределения внимания.",
        "dynamics_served": ["Распределение внимания", "Приоритизация", "Многозадачность"],
        "aesthetics_served": ["challenge", "submission", "expression"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "mmorpg": 2, "tower_defense": 2, "action": 2, "shooter": 2, "simulation": 2, "sandbox": 2},
        "conflicts_with": ["Фокус на одной цели"],
        "synergies_with": ["Контроль точек", "Захват территории", "Мультиплеер", "Патрулирование"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Тайники",
        "description": "Скрытые хранилища предметов в игровом мире. Мотивируют тщательное исследование и вознаграждают наблюдательность.",
        "dynamics_served": ["Исследование", "Ощущение награды", "Любопытство"],
        "aesthetics_served": ["discovery", "fantasy", "submission"],
        "genre_affinity": {"adventure": 3, "rpg": 3, "action_rpg": 3, "shooter": 2, "metroidvania": 3, "sandbox": 2, "roguelike": 2, "stealth": 2, "survival_horror": 2, "action": 2},
        "conflicts_with": ["Маркеры на всё"],
        "synergies_with": ["Изучение мира", "Секретные уровни", "Инвентарь", "Ресурсы", "Сканирование"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Секретные уровни",
        "description": "Скрытые локации, доступные только при выполнении особых условий. Создают ощущение эксклюзивности и награждают мастерство.",
        "dynamics_served": ["Исследование", "Ощущение эксклюзивности", "Награда за мастерство"],
        "aesthetics_served": ["discovery", "challenge", "fantasy"],
        "genre_affinity": {"platformer": 3, "metroidvania": 3, "adventure": 2, "action": 2, "shooter": 2, "rpg": 1, "roguelike": 1},
        "conflicts_with": ["Линейный прогресс"],
        "synergies_with": ["Изучение мира", "Тайники", "Головоломки", "Телепортация"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Строительство",
        "description": "Создание игроком структур и объектов в игровом мире. Трансформирует пространство и создаёт ощущение созидания.",
        "dynamics_served": ["Созидание", "Территориальность", "Персонализация"],
        "aesthetics_served": ["expression", "fantasy", "submission"],
        "genre_affinity": {"sandbox": 3, "simulation": 3, "strategy": 2, "rts": 2, "mmorpg": 2, "tower_defense": 3, "survival_horror": 1, "roguelike": 1},
        "conflicts_with": ["Линейные уровни", "Фиксированный мир"],
        "synergies_with": ["Ресурсы", "Оборона базы", "Захват территории", "Фермерство", "Крафт"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Телепортация",
        "description": "Мгновенное перемещение между точками мира. Снижает摩擦 навигации и управляет темпом игры.",
        "dynamics_served": ["Управление темпом", "Снижение摩擦", "Доступность контента"],
        "aesthetics_served": ["submission", "fantasy", "discovery"],
        "genre_affinity": {"mmorpg": 3, "rpg": 3, "action_rpg": 2, "jrpg": 3, "sandbox": 2, "adventure": 1, "roguelike": 1},
        "conflicts_with": ["Исследование пешком", "Реалистичное перемещение"],
        "synergies_with": ["Карта мира", "Путешествия", "Быстрое перемещение"]
    },
    {
        "group_id": 3,
        "group_name": "Пространство",
        "mechanic_name": "Дискретное время",
        "description": "Пошаговое или раундовое время, где действия совершаются в раздельные моменты. Управляет темпом и создаёт пространство для обдумывания.",
        "dynamics_served": ["Обдумывание", "Стратегическое планирование", "Контроль темпа"],
        "aesthetics_served": ["challenge", "submission", "expression"],
        "genre_affinity": {"tbs": 3, "tactical_rpg": 3, "strategy": 3, "puzzle": 2, "roguelike": 2, "rpg": 1},
        "conflicts_with": ["Реалтайм", "Рывок"],
        "synergies_with": ["Характеристики", "Перки", "Контроль точек", "Замедление времени"]
    },

    # ================================================================
    # ГРУППА 4: Боевые (9 механик)
    # ================================================================
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Броня",
        "description": "Защитный слой, снижающий получаемый урон. Создаёт тактический ресурс управления выживаемостью и визуальную прогрессию.",
        "dynamics_served": ["Управление выживаемостью", "Тактический выбор", "Визуальная прогрессия"],
        "aesthetics_served": ["challenge", "fantasy", "submission"],
        "genre_affinity": {"shooter": 3, "rpg": 3, "action_rpg": 3, "mmorpg": 3, "action": 2, "fighting": 2, "tactical_rpg": 3, "metroidvania": 2, "roguelike": 2, "jrpg": 2},
        "conflicts_with": ["Стелс и прятки", "Без убийств"],
        "synergies_with": ["Здоровье", "Обмундирование", "Укрытия", "Ремонт", "Прокачка оружия"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Запас патронов",
        "description": "Ограниченный боезапас, создающий ресурсный дефицит в бою. Заставляет принимать решения о расходе и поиске пополнения.",
        "dynamics_served": ["Дефицит ресурсов", "Тактическое планирование", "Напряжённость"],
        "aesthetics_served": ["challenge", "submission", "sensation"],
        "genre_affinity": {"shooter": 3, "survival_horror": 3, "horror": 2, "action": 2, "stealth": 2, "roguelike": 1},
        "conflicts_with": ["Бесконечные патроны", "Мана"],
        "synergies_with": ["Укрытия", "Бесшумное оружие", "Крафт", "Ресурсы"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Укрытия",
        "description": "Элементы окружения для защиты от атак. Создают пространственную тактику перемещения между точками безопасности.",
        "dynamics_served": ["Пространственная тактика", "Чередование безопасности и риска", "Позиционирование"],
        "aesthetics_served": ["challenge", "sensation", "submission"],
        "genre_affinity": {"shooter": 3, "action": 2, "stealth": 3, "survival_horror": 2, "tactical_rpg": 1, "rts": 1},
        "conflicts_with": ["Арена-бой без укрытий", "Двойной прыжок"],
        "synergies_with": ["Броня", "Запас патронов", "Уклонение", "Парирование"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Бесшумное оружие",
        "description": "Оружие, не привлекающее внимание врагов. Ключевой инструмент стелс-подхода к боевым ситуациям.",
        "dynamics_served": ["Скрытность", "Тактический выбор", "Управление агро"],
        "aesthetics_served": ["challenge", "fantasy", "narrative"],
        "genre_affinity": {"stealth": 3, "shooter": 2, "action": 1, "survival_horror": 2, "rpg": 1},
        "conflicts_with": ["Шум", "Комбо", "Спецатаки"],
        "synergies_with": ["Стелс и прятки", "Отвлечение", "Маскировка", "Тени"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Комбо",
        "description": "Последовательные атаки, усиливающие эффект при правильном тайминге. Создаёт петлю мастерства и зрелищности.",
        "dynamics_served": ["Мастерство тайминга", "Зрелищность", "Поток боя"],
        "aesthetics_served": ["sensation", "challenge", "expression"],
        "genre_affinity": {"fighting": 3, "action": 3, "action_rpg": 2, "platformer": 2, "rhythm": 2, "shooter": 1, "metroidvania": 2},
        "conflicts_with": ["Пошаговый бой", "Бесшумное оружие", "Стелс и прятки"],
        "synergies_with": ["Парирование", "Уклонение", "Спецатаки", "Рывок"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Парирование",
        "description": "Отражение атаки противника в правильный момент. Высокоуровневый навык с высокой наградой за мастерство.",
        "dynamics_served": ["Мастерство тайминга", "Риск-награда", "Чтение противника"],
        "aesthetics_served": ["challenge", "sensation", "fantasy"],
        "genre_affinity": {"fighting": 3, "action": 3, "action_rpg": 2, "metroidvania": 2, "jrpg": 1},
        "conflicts_with": ["Авто-блок", "Дистанционный бой"],
        "synergies_with": ["Комбо", "Уклонение", "Спецатаки"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Уклонение",
        "description": "Активное избегание атак через перемещение. Базовый элемент боевой петли «атака-защита-перемещение».",
        "dynamics_served": ["Позиционирование", "Чередование защиты и атаки", "Мобильность"],
        "aesthetics_served": ["challenge", "sensation", "fantasy"],
        "genre_affinity": {"action": 3, "fighting": 3, "shooter": 2, "action_rpg": 2, "metroidvania": 2, "platformer": 2, "roguelike": 1},
        "conflicts_with": ["Статичная оборона", "Авто-защита"],
        "synergies_with": ["Парирование", "Комбо", "Рывок", "Укрытия"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Спецатаки",
        "description": "Мощные атаки с особыми условиями активации или стоимостью. Создают пики мощности и моментальную смену ситуации.",
        "dynamics_served": ["Пиковая мощность", "Управление ресурсом", "Момент перелома"],
        "aesthetics_served": ["sensation", "fantasy", "challenge"],
        "genre_affinity": {"action": 3, "fighting": 3, "action_rpg": 3, "jrpg": 2, "tactical_rpg": 2, "shooter": 2, "mmorpg": 2, "metroidvania": 2, "rpg": 2},
        "conflicts_with": ["Бесшумное оружие", "Без убийств"],
        "synergies_with": ["Мана", "Комбо", "Парирование", "Дерево навыков", "Очки опыта"]
    },
    {
        "group_id": 4,
        "group_name": "Боевые",
        "mechanic_name": "Мана",
        "description": "Ресурс для использования магических способностей. Управляет частотой применения спецатак и создаёт петлю восстановления.",
        "dynamics_served": ["Управление ресурсом", "Цикличность", "Планирование применения"],
        "aesthetics_served": ["fantasy", "challenge", "submission"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "mmorpg": 3, "roguelike": 2, "metroidvania": 1, "strategy": 1},
        "conflicts_with": ["Запас патронов", "Кулдауны без ресурса"],
        "synergies_with": ["Спецатаки", "Магия", "Зелья", "Зачарование", "Дерево навыков"]
    },

    # ================================================================
    # ГРУППА 5: Движение (9 механик)
    # ================================================================
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Прыжки",
        "description": "Базовая механика вертикального перемещения. Создаёт платформенные задачи и расширяет пространство взаимодействия.",
        "dynamics_served": ["Навигация по высоте", "Тайминг", "Платформенные задачи"],
        "aesthetics_served": ["sensation", "challenge", "fantasy"],
        "genre_affinity": {"platformer": 3, "metroidvania": 3, "action": 2, "shooter": 1, "adventure": 1, "fighting": 1, "roguelike": 1},
        "conflicts_with": ["Пошаговое движение", "Дискретное время"],
        "synergies_with": ["Двойной прыжок", "Стены", "Гравитация", "Рывок"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Двойной прыжок",
        "description": "Второй прыжок в воздухе, расширяющий пространство манёвра. Открывает новые маршруты и увеличивает свободу перемещения.",
        "dynamics_served": ["Расширенная навигация", "Стильность", "Доступ к секретам"],
        "aesthetics_served": ["sensation", "fantasy", "expression"],
        "genre_affinity": {"platformer": 3, "metroidvania": 3, "action": 2, "shooter": 1, "roguelike": 1},
        "conflicts_with": ["Реалистичная физика"],
        "synergies_with": ["Прыжки", "Стены", "Полёт", "Гравитация"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Полёт",
        "description": "Свободное перемещение в трёхмерном пространстве. Максимальная свобода навигации, кардинально меняющая восприятие мира.",
        "dynamics_served": ["Свобода перемещения", "Трёхмерная навигация", "Ощущение мощи"],
        "aesthetics_served": ["fantasy", "sensation", "expression"],
        "genre_affinity": {"sandbox": 3, "mmorpg": 2, "action": 2, "adventure": 2, "simulation": 2, "shooter": 1, "rpg": 1},
        "conflicts_with": ["Укрытия", "Стелс и прятки", "Гравитация"],
        "synergies_with": ["Карта мира", "Телепортация", "Двойной прыжок", "Изучение мира"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Стены",
        "description": "Взаимодействие с вертикальными поверхностями — цепляние, прыжки от стены, бег по стене. Расширяет платформенный словарь.",
        "dynamics_served": ["Вертикальная навигация", "Паркур", "Комплексное перемещение"],
        "aesthetics_served": ["sensation", "challenge", "fantasy"],
        "genre_affinity": {"platformer": 3, "metroidvania": 3, "action": 2, "stealth": 1, "roguelike": 1},
        "conflicts_with": ["Реалистичное трение"],
        "synergies_with": ["Прыжки", "Двойной прыжок", "Рывок", "Уклонение"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Рывок",
        "description": "Быстрое перемещение на короткое расстояние. Инструмент для уклонения и агрессивного сближения с противником.",
        "dynamics_served": ["Мобильность", "Уклонение", "Агрессивное позиционирование"],
        "aesthetics_served": ["sensation", "challenge", "fantasy"],
        "genre_affinity": {"action": 3, "shooter": 2, "fighting": 2, "action_rpg": 2, "metroidvania": 2, "roguelike": 1, "platformer": 1},
        "conflicts_with": ["Дискретное время", "Пошаговое движение"],
        "synergies_with": ["Уклонение", "Комбо", "Укрытия", "Прыжки"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Верховая езда",
        "description": "Перемещение на ездовом животном или транспорте. Изменяет скорость, вместимость и иногда боевые возможности.",
        "dynamics_served": ["Ускоренное перемещение", "Дополнительные возможности", "Связь с существом"],
        "aesthetics_served": ["fantasy", "sensation", "narrative"],
        "genre_affinity": {"rpg": 3, "action_rpg": 2, "mmorpg": 2, "sandbox": 2, "adventure": 2, "jrpg": 1, "strategy": 1, "simulation": 1},
        "conflicts_with": ["Закрытые пространства", "Пещеры"],
        "synergies_with": ["Карта мира", "Путешествия", "Боевая машина", "Плавание"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Плавание",
        "description": "Перемещение в водной среде с изменённой физикой. Открывает подводный контент и создаёт уникальные навигационные задачи.",
        "dynamics_served": ["Подводная навигация", "Управление кислородом", "Разнообразие среды"],
        "aesthetics_served": ["discovery", "sensation", "fantasy"],
        "genre_affinity": {"adventure": 3, "sandbox": 2, "mmorpg": 2, "rpg": 2, "action_rpg": 2, "metroidvania": 2, "simulation": 2, "platformer": 1},
        "conflicts_with": ["Жажда в пустыне"],
        "synergies_with": ["Изучение мира", "Карта мира", "Верховая езда", "Гравитация"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Боевая машина",
        "description": "Управляемая боевая техника с уникальными характеристиками. Существенно расширяет боевые и навигационные возможности.",
        "dynamics_served": ["Изменение масштаба конфликта", "Дополнительный слой прогрессии", "Тактическое преимущество"],
        "aesthetics_served": ["fantasy", "sensation", "challenge"],
        "genre_affinity": {"shooter": 3, "action": 2, "rts": 2, "simulation": 2, "sandbox": 2, "mmorpg": 1, "racing": 1},
        "conflicts_with": ["Стелс и прятки", "Пешее исследование"],
        "synergies_with": ["Запас патронов", "Броня", "Верховая езда", "Ремонт"]
    },
    {
        "group_id": 5,
        "group_name": "Движение",
        "mechanic_name": "Гравитация",
        "description": "Механика управления или изменения гравитации. Кардинально трансформирует навигацию и создаёт уникальные головоломки.",
        "dynamics_served": ["Инверсия навигации", "Головоломная физика", "Дезориентация"],
        "aesthetics_served": ["sensation", "challenge", "fantasy"],
        "genre_affinity": {"platformer": 3, "puzzle": 3, "metroidvania": 2, "action": 1, "sandbox": 1, "adventure": 1},
        "conflicts_with": ["Реалистичная физика", "Полёт"],
        "synergies_with": ["Прыжки", "Двойной прыжок", "Стены", "Замедление времени"]
    },

    # ================================================================
    # ГРУППА 6: Экономика (9 механик)
    # ================================================================
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Экономика",
        "description": "Система производства, распределения и потребления ресурсов в игре. Определяет цикл ценности и обмена между игроком и миром.",
        "dynamics_served": ["Обмен ценностями", "Инфляция/дефляция", "Рыночные циклы"],
        "aesthetics_served": ["submission", "expression", "challenge"],
        "genre_affinity": {"mmorpg": 3, "strategy": 3, "simulation": 3, "sandbox": 3, "rts": 2, "tbs": 2, "rpg": 2, "action_rpg": 1, "idle": 3},
        "conflicts_with": ["Бартер без валюты", "Коммунизм ресурсов"],
        "synergies_with": ["Торг", "Аукцион", "Ресурсы", "Крафт", "Фермерство"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Торг",
        "description": "Обмен предметами или валютой с NPC или игроками. Создаёт социальное взаимодействие и систему оценки ценности.",
        "dynamics_served": ["Социальный обмен", "Оценка ценности", "Дипломатия"],
        "aesthetics_served": ["fellowship", "expression", "submission"],
        "genre_affinity": {"mmorpg": 3, "rpg": 3, "action_rpg": 2, "simulation": 2, "sandbox": 2, "strategy": 2, "adventure": 1, "jrpg": 1},
        "conflicts_with": ["Фиксированные цены без торга"],
        "synergies_with": ["Экономика", "Аукцион", "Репутация", "Красноречие"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Крафт",
        "description": "Создание новых предметов из имеющихся ресурсов. Петля «собери → создай → используй» — фундамент прогрессии через созидание.",
        "dynamics_served": ["Созидание", "Преобразование ресурсов", "Целенаправленный сбор"],
        "aesthetics_served": ["expression", "submission", "discovery"],
        "genre_affinity": {"sandbox": 3, "mmorpg": 3, "rpg": 3, "action_rpg": 3, "survival_horror": 2, "simulation": 2, "roguelike": 2, "strategy": 1, "jrpg": 1},
        "conflicts_with": ["Только готовые предметы"],
        "synergies_with": ["Ресурсы", "Инвентарь", "Обмундирование", "Кузнечное дело", "Алхимия", "Зачарование"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Фермерство",
        "description": "Систематическое воспроизводство ресурсов через выращивание, разведение или добычу. Создаёт долгосрочные инвестиции времени.",
        "dynamics_served": ["Долгосрочная инвестиция", "Цикличность", "Планирование урожая"],
        "aesthetics_served": ["submission", "expression", "narrative"],
        "genre_affinity": {"simulation": 3, "sandbox": 3, "mmorpg": 2, "strategy": 2, "idle": 3, "rpg": 1, "survival_horror": 1},
        "conflicts_with": ["Быстрый прогресс", "Таймер"],
        "synergies_with": ["Ресурсы", "Крафт", "Экономика", "Сезоны", "Строительство"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Аукцион",
        "description": "Рыночная система торгов между игроками за предметы. Формирует рыночную стоимость и создаёт конкурентную экономику.",
        "dynamics_served": ["Конкуренция за ресурсы", "Рыночное ценообразование", "Социальная экономика"],
        "aesthetics_served": ["fellowship", "challenge", "expression"],
        "genre_affinity": {"mmorpg": 3, "sandbox": 2, "simulation": 2, "strategy": 1, "idle": 1},
        "conflicts_with": ["Фиксированные цены"],
        "synergies_with": ["Экономика", "Торг", "Торговая площадка", "Лутбоксы"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Зелья",
        "description": "Расходуемые предметы с временными эффектами. Создают ресурсную петлю подготовки и потребления в критические моменты.",
        "dynamics_served": ["Подготовка к бою", "Временное усиление", "Управление запасом"],
        "aesthetics_served": ["fantasy", "submission", "challenge"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "mmorpg": 3, "roguelike": 2, "survival_horror": 2, "adventure": 1},
        "conflicts_with": ["Авто-регенерация", "Без расходуемых"],
        "synergies_with": ["Алхимия", "Крафт", "Инвентарь", "Мана", "Здоровье"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Аптечки",
        "description": "Расходуемые предметы для восстановления здоровья. Управляют риском через ресурс исцеления и создают напряжённость дефицита.",
        "dynamics_served": ["Управление исцелением", "Дефицит выживания", "Момент восстановления"],
        "aesthetics_served": ["challenge", "submission", "sensation"],
        "genre_affinity": {"shooter": 3, "action": 3, "survival_horror": 3, "horror": 3, "action_rpg": 2, "rpg": 2, "roguelike": 2, "metroidvania": 1},
        "conflicts_with": ["Авто-регенерация", "Бессмертие"],
        "synergies_with": ["Здоровье", "Инвентарь", "Крафт", "Ресурсы"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Лутбоксы",
        "description": "Контейнеры со случайным набором предметов. Создают элемент случайности и ожидания награды, управляемый вероятностями.",
        "dynamics_served": ["Ожидание награды", "Рандомизация", "Монетизация"],
        "aesthetics_served": ["submission", "sensation", "discovery"],
        "genre_affinity": {"mmorpg": 3, "shooter": 2, "action": 2, "idle": 3, "strategy": 1, "party": 1, "racing": 1, "sports": 1},
        "conflicts_with": ["Честная награда", "Древо технологий"],
        "synergies_with": ["Инвентарь", "Экономика", "Микротранзакции", "Сезонный пропуск"]
    },
    {
        "group_id": 6,
        "group_name": "Экономика",
        "mechanic_name": "Ремонт",
        "description": "Восстановление характеристик повреждённых предметов. Создаёт цикл обслуживания экипировки и ресурсные затраты на поддержание.",
        "dynamics_served": ["Цикл обслуживания", "Амортизация", "Планирование расходов"],
        "aesthetics_served": ["submission", "challenge", "fantasy"],
        "genre_affinity": {"rpg": 3, "action_rpg": 2, "mmorpg": 3, "survival_horror": 2, "simulation": 2, "sandbox": 2, "shooter": 1},
        "conflicts_with": ["Неразрушимые предметы"],
        "synergies_with": ["Износ", "Обмундирование", "Броня", "Кузнечное дело", "Ресурсы"]
    },

    # ================================================================
    # ГРУППА 7: Социальные (8 механик)
    # ================================================================
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Кооперация",
        "description": "Совместная игра нескольких игроков для достижения общей цели. Создаёт взаимозависимость и коллективный опыт.",
        "dynamics_served": ["Взаимозависимость", "Коллективная стратегия", "Социальная сплочённость"],
        "aesthetics_served": ["fellowship", "challenge", "expression"],
        "genre_affinity": {"mmorpg": 3, "party": 3, "shooter": 2, "action": 2, "rpg": 1, "strategy": 2, "sandbox": 2, "survival_horror": 1, "roguelike": 1},
        "conflicts_with": ["Одиночный опыт", "Пермасмерть"],
        "synergies_with": ["Роли", "Гильдии", "Чат", "Компаньоны"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Соревнование",
        "description": "Прямое или косвенное противостояние игроков. Создаёт динамику доминирования и мотивацию к совершенствованию.",
        "dynamics_served": ["Доминирование", "Самоутверждение", "Мета-игра"],
        "aesthetics_served": ["challenge", "fellowship", "expression"],
        "genre_affinity": {"fighting": 3, "sports": 3, "racing": 3, "shooter": 3, "party": 3, "strategy": 3, "rts": 3, "mmorpg": 2, "action": 2, "puzzle": 1},
        "conflicts_with": ["Кооперация", "Без убийств"],
        "synergies_with": ["Рейтинги", "Роли", "Чат"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Гильдии",
        "description": "Постоянные объединения игроков с общей идентичностью и целями. Создают долгосрочные социальные связи и структуру сообщества.",
        "dynamics_served": ["Социальная идентичность", "Коллективные цели", "Иерархия"],
        "aesthetics_served": ["fellowship", "expression", "submission"],
        "genre_affinity": {"mmorpg": 3, "strategy": 2, "sandbox": 2, "shooter": 1, "party": 1, "action_rpg": 1},
        "conflicts_with": ["Одиночная игра"],
        "synergies_with": ["Кооперация", "Чат", "Репутация", "Захват территории", "Рейтинги"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Роли",
        "description": "Специализация игроков на определённых функциях в группе. Создаёт взаимозависимость и тактическую глубину через асимметрию.",
        "dynamics_served": ["Асимметрия возможностей", "Взаимодополняемость", "Тактическая координация"],
        "aesthetics_served": ["fellowship", "expression", "challenge"],
        "genre_affinity": {"mmorpg": 3, "strategy": 3, "rts": 2, "tactical_rpg": 3, "shooter": 2, "party": 2, "action_rpg": 1, "rpg": 2},
        "conflicts_with": ["Универсальный персонаж"],
        "synergies_with": ["Классы", "Кооперация", "Гильдии", "Дерево навыков"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Чат",
        "description": "Система текстовой или голосовой коммуникации между игроками. Инфраструктура социального взаимодействия и координации.",
        "dynamics_served": ["Координация", "Социальная связь", "Обмен информацией"],
        "aesthetics_served": ["fellowship", "expression", "submission"],
        "genre_affinity": {"mmorpg": 3, "shooter": 2, "party": 2, "sandbox": 2, "strategy": 2, "action": 1},
        "conflicts_with": ["Без общения"],
        "synergies_with": ["Кооперация", "Гильдии", "Торг", "Репутация"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Рейтинги",
        "description": "Ранжирование игроков по результатам. Создаёт социальное сравнение и долгосрочную соревновательную мотивацию.",
        "dynamics_served": ["Социальное сравнение", "Мотивация к улучшению", "Мета-игра"],
        "aesthetics_served": ["challenge", "fellowship", "expression"],
        "genre_affinity": {"fighting": 3, "sports": 3, "racing": 3, "shooter": 3, "strategy": 3, "rts": 3, "mmorpg": 2, "party": 2, "puzzle": 2, "action": 2},
        "conflicts_with": ["Казуальный опыт без рейтинга"],
        "synergies_with": ["Соревнование", "Достижения", "Статистика", "Достижения платформы"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Репутация",
        "description": "Система оценки отношения мира и игроков к персонажу. Создаёт последствия социального поведения и долгосрочный след действий.",
        "dynamics_served": ["Последствия действий", "Социальный статус", "Фракционные предпочтения"],
        "aesthetics_served": ["narrative", "expression", "fellowship"],
        "genre_affinity": {"rpg": 3, "mmorpg": 3, "action_rpg": 2, "adventure": 2, "simulation": 2, "sandbox": 1, "strategy": 1},
        "conflicts_with": ["Линейный сюжет без выбора"],
        "synergies_with": ["Фракции", "Торг", "Квесты", "Выбор сюжета", "Нарратив"]
    },
    {
        "group_id": 7,
        "group_name": "Социальные",
        "mechanic_name": "Нарратив",
        "description": "Система совместного создания истории несколькими игроками. Возникающие нарративы через социальное взаимодействие и игровые события.",
        "dynamics_served": ["Совместное творчество", "Возникающие истории", "Социальная память"],
        "aesthetics_served": ["narrative", "fellowship", "expression"],
        "genre_affinity": {"mmorpg": 3, "rpg": 3, "visual_novel": 2, "adventure": 2, "sandbox": 2, "party": 1, "strategy": 1},
        "conflicts_with": ["Линейный скрипт"],
        "synergies_with": ["Выбор сюжета", "Фракции", "Репутация", "Компаньоны", "Кат-сцены"]
    },

    # ================================================================
    # ГРУППА 8: Стелс (7 механик)
    # ================================================================
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Стелс и прятки",
        "description": "Избегание обнаружения противниками как основная игровая петля. Подменяет прямое столкновение на навигацию по полю видимости.",
        "dynamics_served": ["Избегание", "Наблюдение", "Терпение"],
        "aesthetics_served": ["challenge", "fantasy", "sensation"],
        "genre_affinity": {"stealth": 3, "survival_horror": 3, "horror": 3, "action": 1, "adventure": 2, "shooter": 1},
        "conflicts_with": ["Комбо", "Спецатаки", "Боевая машина"],
        "synergies_with": ["Бесшумное оружие", "Маскировка", "Тени", "Отвлечение", "Шум"]
    },
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Ночное видение",
        "description": "Способность видеть в темноте, расширяющая возможности навигации в ночных условиях. Инструмент для управления информационным преимуществом.",
        "dynamics_served": ["Информационное преимущество", "Ночная навигация", "Асимметрия восприятия"],
        "aesthetics_served": ["fantasy", "discovery", "sensation"],
        "genre_affinity": {"stealth": 3, "survival_horror": 2, "shooter": 2, "horror": 2, "action": 1},
        "conflicts_with": ["Дневной свет", "Фонарик"],
        "synergies_with": ["Стелс и прятки", "Цикл день/ночь", "Тени"]
    },
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Без убийств",
        "description": "Прохождение без устранения противников. Радикально меняет подход к конфликту и создаёт уникальную динамику ограничения.",
        "dynamics_served": ["Ограничение средств", "Мирное решение", "Альтернативный путь"],
        "aesthetics_served": ["expression", "narrative", "challenge"],
        "genre_affinity": {"stealth": 3, "adventure": 2, "puzzle": 2, "visual_novel": 1, "rpg": 1},
        "conflicts_with": ["Враги", "Комбо", "Спецатаки", "Запас патронов"],
        "synergies_with": ["Стелс и прятки", "Маскировка", "Отвлечение", "Красноречие", "Альтернативы"]
    },
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Тени",
        "description": "Использование теней и темноты для сокрытия. Привязывает стелс к пространственным условиям освещения.",
        "dynamics_served": ["Пространственная навигация по свету", "Динамика обнаружения", "Использование окружения"],
        "aesthetics_served": ["sensation", "challenge", "fantasy"],
        "genre_affinity": {"stealth": 3, "survival_horror": 2, "horror": 2, "action": 1},
        "conflicts_with": ["Ярко освещённые арены"],
        "synergies_with": ["Стелс и прятки", "Цикл день/ночь", "Маскировка", "Ночное видение"]
    },
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Маскировка",
        "description": "Изменение внешнего вида для избегания обнаружения или проникновения. Создаёт динамику перевоплощения и социальной инженерии.",
        "dynamics_served": ["Перевоплощение", "Проникновение", "Социальная инженерия"],
        "aesthetics_served": ["fantasy", "narrative", "expression"],
        "genre_affinity": {"stealth": 3, "adventure": 2, "rpg": 1, "action": 1, "mmorpg": 1},
        "conflicts_with": ["Открытый бой", "Уникальная идентичность"],
        "synergies_with": ["Стелс и прятки", "Без убийств", "Отвлечение", "Репутация"]
    },
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Отвлечение",
        "description": "Создание шума или события для отвода внимания врагов. Инструмент управления патрульными маршрутами и вниманием AI.",
        "dynamics_served": ["Управление вниманием AI", "Манипуляция маршрутом", "Создание окна возможностей"],
        "aesthetics_served": ["challenge", "fantasy", "expression"],
        "genre_affinity": {"stealth": 3, "action": 1, "adventure": 2, "puzzle": 1, "shooter": 1},
        "conflicts_with": ["Прямая конфронтация"],
        "synergies_with": ["Стелс и прятки", "Шум", "Маскировка", "Бесшумное оружие"]
    },
    {
        "group_id": 8,
        "group_name": "Стелс",
        "mechanic_name": "Шум",
        "description": "Система звука как механизма обнаружения. Действия игрока создают шум, привлекающий врагов, создавая петлю осторожности.",
        "dynamics_served": ["Петля осторожности", "Управление звуковым следом", "Обнаружение через звук"],
        "aesthetics_served": ["challenge", "sensation", "submission"],
        "genre_affinity": {"stealth": 3, "survival_horror": 3, "horror": 3, "action": 1, "shooter": 1},
        "conflicts_with": ["Бесшумное оружие", "Бесшумное движение"],
        "synergies_with": ["Стелс и прятки", "Отвлечение", "Тени", "Бесшумное оружие"]
    },

    # ================================================================
    # ГРУППА 9: Навыки (9 механик)
    # ================================================================
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Классы",
        "description": "Предопределённые архетипы персонажей с уникальным набором способностей. Создают идентичность и специализацию с самого начала.",
        "dynamics_served": ["Идентичность персонажа", "Специализация", "Асимметрия"],
        "aesthetics_served": ["fantasy", "expression", "challenge"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "tactical_rpg": 3, "jrpg": 3, "mmorpg": 3, "roguelike": 2, "fighting": 1, "strategy": 1},
        "conflicts_with": ["Бесклассовая система", "Универсальный персонаж"],
        "synergies_with": ["Роли", "Дерево навыков", "Перки", "Характеристики", "Обмундирование"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Дерево навыков",
        "description": "Ветвящаяся система разблокируемых способностей. Создаёт долгосрочное планирование развития и визуализацию прогресса.",
        "dynamics_served": ["Планирование развития", "Специализация", "Постепенное раскрытие"],
        "aesthetics_served": ["expression", "submission", "discovery"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "tactical_rpg": 3, "jrpg": 2, "roguelike": 2, "shooter": 2, "strategy": 1},
        "conflicts_with": ["Случайные навыки", "Фиксированный набор без выбора"],
        "synergies_with": ["Очки опыта", "Уровни", "Перки", "Классы", "Магия"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Магия",
        "description": "Система сверхъестественных способностей с уникальными правилами и ресурсами. Расширяет спектр взаимодействия с миром.",
        "dynamics_served": ["Расширенное взаимодействие", "Управление стихиями", "Фантастическое решение проблем"],
        "aesthetics_served": ["fantasy", "sensation", "expression"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "mmorpg": 3, "roguelike": 2, "adventure": 1, "metroidvania": 1},
        "conflicts_with": ["Реализм", "Стелс и прятки"],
        "synergies_with": ["Мана", "Зачарование", "Алхимия", "Дерево навыков", "Спецатаки"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Взлом",
        "description": "Навык открытия замков и преодоления электронных систем защиты. Создаёт альтернативные пути и доступ к закрытому контенту.",
        "dynamics_served": ["Доступ к скрытому", "Альтернативный путь", "Мини-игра"],
        "aesthetics_served": ["challenge", "discovery", "fantasy"],
        "genre_affinity": {"stealth": 3, "rpg": 3, "action_rpg": 2, "adventure": 2, "mmorpg": 2, "shooter": 1, "simulation": 1},
        "conflicts_with": ["Открытые двери", "Только силой"],
        "synergies_with": ["Стелс и прятки", "Тайники", "Альтернативы", "Головоломки"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Карманная кража",
        "description": "Незаметное похищение предметов у NPC. Создаёт динамику риска и скрытного обогащения.",
        "dynamics_served": ["Скрытное обогащение", "Риск обнаружения", "Альтернативная экономика"],
        "aesthetics_served": ["challenge", "fantasy", "expression"],
        "genre_affinity": {"rpg": 3, "stealth": 3, "action_rpg": 2, "adventure": 1, "mmorpg": 1},
        "conflicts_with": ["Честная торговля", "Открытый бой"],
        "synergies_with": ["Стелс и прятки", "Маскировка", "Шум", "Красноречие"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Красноречие",
        "description": "Навык убеждения и дипломатии в диалогах. Открывает мирные решения конфликтов и доступ к уникальным веткам сюжета.",
        "dynamics_served": ["Мирное разрешение", "Дипломатия", "Альтернативный путь"],
        "aesthetics_served": ["narrative", "expression", "fantasy"],
        "genre_affinity": {"rpg": 3, "visual_novel": 3, "adventure": 2, "tactical_rpg": 2, "jrpg": 1, "mmorpg": 1},
        "conflicts_with": ["Только бой", "Без диалогов"],
        "synergies_with": ["Без убийств", "Выбор сюжета", "Репутация", "Торг", "Фракции"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Кузнечное дело",
        "description": "Навык создания и улучшения оружия и брони. Связывает экономику с боевым прогрессом через созидание.",
        "dynamics_served": ["Созидание оружия", "Прогресс через ремесло", "Экономическая специализация"],
        "aesthetics_served": ["expression", "submission", "fantasy"],
        "genre_affinity": {"rpg": 3, "mmorpg": 3, "action_rpg": 3, "sandbox": 2, "simulation": 2, "jrpg": 1},
        "conflicts_with": ["Только готовое оружие"],
        "synergies_with": ["Крафт", "Обмундирование", "Прокачка оружия", "Ресурсы", "Ремонт"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Алхимия",
        "description": "Навык создания зелий и химических составов. Петля сбора ингредиентов и экспериментирования с рецептами.",
        "dynamics_served": ["Экспериментирование", "Создание расходуемых", "Исследование свойств"],
        "aesthetics_served": ["discovery", "expression", "fantasy"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "sandbox": 2, "jrpg": 2, "tactical_rpg": 2, "roguelike": 1, "adventure": 1},
        "conflicts_with": ["Только готовые зелья"],
        "synergies_with": ["Зелья", "Крафт", "Ресурсы", "Магия", "Яды"]
    },
    {
        "group_id": 9,
        "group_name": "Навыки",
        "mechanic_name": "Зачарование",
        "description": "Наложение магических свойств на предметы. Создаёт слой кастомизации экипировки и синергии магии с крафтом.",
        "dynamics_served": ["Кастомизация предметов", "Магический крафт", "Синергия систем"],
        "aesthetics_served": ["expression", "fantasy", "submission"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "jrpg": 2, "sandbox": 1, "tactical_rpg": 2},
        "conflicts_with": ["Фиксированные свойства предметов"],
        "synergies_with": ["Магия", "Обмундирование", "Крафт", "Прокачка оружия", "Кузнечное дело"]
    },

    # ================================================================
    # ГРУППА 10: Время (8 механик)
    # ================================================================
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Цикл день/ночь",
        "description": "Периодическая смена времени суток, влияющая на игровой мир. Создаёт ритм доступности контента и изменяет условия игры.",
        "dynamics_served": ["Ритм доступности", "Изменение условий", "Планирование по времени"],
        "aesthetics_served": ["sensation", "fantasy", "narrative"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "sandbox": 3, "adventure": 2, "stealth": 3, "survival_horror": 2, "simulation": 2, "jrpg": 1},
        "conflicts_with": ["Статичное освещение"],
        "synergies_with": ["Тени", "Ночное видение", "Погода", "Сезоны", "Враги"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Погода",
        "description": "Динамические погодные условия, влияющие на геймплей. Создаёт вариативность условий и визуальную атмосферу.",
        "dynamics_served": ["Вариативность условий", "Атмосферное влияние", "Ограничение видимости"],
        "aesthetics_served": ["sensation", "fantasy", "challenge"],
        "genre_affinity": {"simulation": 3, "sandbox": 3, "survival_horror": 2, "racing": 3, "rpg": 2, "action_rpg": 2, "mmorpg": 2, "adventure": 1, "strategy": 1},
        "conflicts_with": ["Статичная среда"],
        "synergies_with": ["Цикл день/ночь", "Температура", "Сезоны", "Стелс и прятки", "Туман войны"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Таймер",
        "description": "Ограничение времени на выполнение действий. Создаёт давление и приоритизацию, повышая интенсивность опыта.",
        "dynamics_served": ["Давление времени", "Приоритизация", "Интенсификация"],
        "aesthetics_served": ["challenge", "sensation", "submission"],
        "genre_affinity": {"puzzle": 3, "action": 2, "shooter": 2, "racing": 3, "rts": 3, "strategy": 2, "roguelike": 2, "party": 2, "platformer": 2},
        "conflicts_with": ["Расслабленный темп", "Исследование"],
        "synergies_with": ["Сложность", "Мультицели", "Осада", "Оборона базы"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Перематывание времени",
        "description": "Возможность вернуть игровое состояние назад. Инструмент для исправления ошибок и экспериментирования с решениями.",
        "dynamics_served": ["Исправление ошибок", "Экспериментирование", "Снижение фрустрации"],
        "aesthetics_served": ["challenge", "expression", "discovery"],
        "genre_affinity": {"puzzle": 3, "platformer": 3, "strategy": 2, "action": 1, "adventure": 1, "roguelike": 1},
        "conflicts_with": ["Пермасмерть", "Сохранения"],
        "synergies_with": ["Головоломки", "Сложность", "Замедление времени"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Замедление времени",
        "description": "Временное снижение скорости игры для повышения точности действий. Создаёт моменты гиперфокуса и зрелищности.",
        "dynamics_served": ["Гиперфокус", "Точность действий", "Зрелищность"],
        "aesthetics_served": ["sensation", "challenge", "fantasy"],
        "genre_affinity": {"action": 3, "shooter": 3, "fighting": 2, "action_rpg": 2, "puzzle": 1, "stealth": 1},
        "conflicts_with": ["Дискретное время", "Пошаговый режим"],
        "synergies_with": ["Комбо", "Парирование", "Уклонение", "Спецатаки"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Сезоны",
        "description": "Долгосрочные циклы изменения мира, влияющие на доступность ресурсов и условия. Создают годовой ритм и долгосрочное планирование.",
        "dynamics_served": ["Долгосрочное планирование", "Циклические изменения", "Сезонная вариативность"],
        "aesthetics_served": ["submission", "narrative", "discovery"],
        "genre_affinity": {"simulation": 3, "sandbox": 3, "strategy": 2, "tbs": 2, "survival_horror": 1, "rpg": 1, "idle": 2},
        "conflicts_with": ["Статичный мир"],
        "synergies_with": ["Фермерство", "Погода", "Цикл день/ночь", "Ресурсы", "Температура"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Старение",
        "description": "Персонаж или мир изменяется с течением времени. Создаёт уникальную динамику ограниченного ресурса — времени жизни.",
        "dynamics_served": ["Ограниченность времени жизни", "Смена поколений", "Необратимость"],
        "aesthetics_served": ["narrative", "challenge", "submission"],
        "genre_affinity": {"rpg": 2, "simulation": 3, "strategy": 2, "tbs": 2, "visual_novel": 1, "sandbox": 1},
        "conflicts_with": ["Бессмертие персонажа"],
        "synergies_with": ["Пермасмерть", "Сезоны", "Характеристики", "Износ"]
    },
    {
        "group_id": 10,
        "group_name": "Время",
        "mechanic_name": "Поворот",
        "description": "Карточная или раундовая система, где каждый «ход» — дискретная единица времени. Управляет темпом и создаёт стратегическую глубину.",
        "dynamics_served": ["Пошаговое планирование", "Чередование действий", "Предсказуемость"],
        "aesthetics_served": ["challenge", "submission", "expression"],
        "genre_affinity": {"tbs": 3, "tactical_rpg": 3, "strategy": 3, "puzzle": 2, "roguelike": 2},
        "conflicts_with": ["Реалтайм"],
        "synergies_with": ["Дискретное время", "Характеристики", "Контроль точек", "Перки"]
    },

    # ================================================================
    # ГРУППА 11: Территория (9 механик)
    # ================================================================
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Захват территории",
        "description": "Расширение контроля над областями игрового мира. Создаёт динамику экспансии и конфликт за пространство.",
        "dynamics_served": ["Экспансия", "Конфликт за пространство", "Визуализация контроля"],
        "aesthetics_served": ["challenge", "fellowship", "expression"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "mmorpg": 2, "shooter": 2, "sandbox": 2, "tower_defense": 1},
        "conflicts_with": ["Нейтральная территория"],
        "synergies_with": ["Оборона базы", "Контроль точек", "Прибыль", "Туман войны", "Патрулирование"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Оборона базы",
        "description": "Защита своей территории от нападения. Создаёт динамику подготовки и реакции на угрозы.",
        "dynamics_served": ["Подготовка и реакция", "Защита ценностей", "Осадное напряжение"],
        "aesthetics_served": ["challenge", "fellowship", "submission"],
        "genre_affinity": {"tower_defense": 3, "strategy": 3, "rts": 3, "shooter": 2, "sandbox": 2, "mmorpg": 1, "survival_horror": 1},
        "conflicts_with": ["Кочевой стиль"],
        "synergies_with": ["Строительство", "Захват территории", "Осада", "Ремонт", "Ресурсы"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Осада",
        "description": "Штурм укреплённой позиции противника. Создаёт асимметрию атака/защита и динамику прорыва.",
        "dynamics_served": ["Асимметрия атаки/защиты", "Прорыв", "Истощение"],
        "aesthetics_served": ["challenge", "sensation", "fellowship"],
        "genre_affinity": {"strategy": 3, "rts": 3, "shooter": 3, "action": 2, "mmorpg": 2, "tbs": 2, "tower_defense": 2},
        "conflicts_with": ["Стелс и прятки", "Мирное прохождение"],
        "synergies_with": ["Оборона базы", "Захват территории", "Боевая машина", "Укрытия", "Таймер"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Контроль точек",
        "description": "Удержание ключевых точек на карте для получения преимущества. Создаёт динамику распределения сил и приоритизации.",
        "dynamics_served": ["Распределение сил", "Приоритизация точек", "Чередование контроля"],
        "aesthetics_served": ["challenge", "fellowship", "submission"],
        "genre_affinity": {"shooter": 3, "strategy": 3, "rts": 3, "mmorpg": 2, "action": 2, "fighting": 1, "party": 1},
        "conflicts_with": ["Свободное перемещение"],
        "synergies_with": ["Захват территории", "Патрулирование", "Мультицели", "Роли"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Патрулирование",
        "description": "Регулярное обход территории для обнаружения угроз. Создаёт ритм безопасности и бдительности.",
        "dynamics_served": ["Бдительность", "Ритм безопасности", "Обнаружение нарушителей"],
        "aesthetics_served": ["submission", "challenge", "narrative"],
        "genre_affinity": {"strategy": 3, "rts": 2, "stealth": 2, "simulation": 2, "shooter": 1, "tbs": 2, "survival_horror": 1},
        "conflicts_with": ["Статичная оборона"],
        "synergies_with": ["Оборона базы", "Контроль точек", "Туман войны", "Разведка"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Разведка",
        "description": "Сбор информации о территории и противнике перед действием. Создаёт информационное преимущество и динамику подготовки.",
        "dynamics_served": ["Информационное преимущество", "Подготовка", "Раскрытие неизвестного"],
        "aesthetics_served": ["discovery", "challenge", "submission"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "stealth": 3, "shooter": 2, "tactical_rpg": 2, "mmorpg": 1},
        "conflicts_with": ["Полная информация"],
        "synergies_with": ["Туман войны", "Патрулирование", "Стелс и прятки", "Интеллект", "Сканирование"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Туман войны",
        "description": "Сокрытие неисследованных областей карты. Создаёт динамику неизвестности и мотивацию к исследованию.",
        "dynamics_served": ["Неизвестность", "Мотивация к исследованию", "Информационная асимметрия"],
        "aesthetics_served": ["discovery", "challenge", "narrative"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "tactical_rpg": 2, "mmorpg": 1, "roguelike": 2},
        "conflicts_with": ["Полная видимость", "Миникарта"],
        "synergies_with": ["Разведка", "Карта мира", "Патрулирование", "Погода"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Путешествия",
        "description": "Механика дальних перемещений между регионами мира. Создаёт ощущение масштаба и соединяет изолированные зоны.",
        "dynamics_served": ["Ощущение масштаба", "Связность мира", "Переход между контентом"],
        "aesthetics_served": ["discovery", "fantasy", "submission"],
        "genre_affinity": {"rpg": 3, "mmorpg": 3, "adventure": 3, "sandbox": 3, "action_rpg": 2, "jrpg": 3, "simulation": 1},
        "conflicts_with": ["Зона игры", "Арена"],
        "synergies_with": ["Карта мира", "Телепортация", "Верховая езда", "Изучение мира"]
    },
    {
        "group_id": 11,
        "group_name": "Территория",
        "mechanic_name": "Прибыль",
        "description": "Получение дохода с контролируемой территории. Связывает территориальный контроль с экономическим преимуществом.",
        "dynamics_served": ["Экономический стимул контроля", "Инвестиция и доход", "Рост через территорию"],
        "aesthetics_served": ["submission", "challenge", "expression"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "simulation": 3, "mmorpg": 2, "sandbox": 2, "idle": 2},
        "conflicts_with": ["Бесконтрольная экономика"],
        "synergies_with": ["Захват территории", "Экономика", "Ресурсы", "Фермерство"]
    },

    # ================================================================
    # ГРУППА 12: Сюжет (8 механик)
    # ================================================================
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Выбор сюжета",
        "description": "Ветвление нарратива на основе решений игрока. Ключевая механика агентности в повествовании и реиграбельности.",
        "dynamics_served": ["Агентность", "Последствия", "Реиграбельность"],
        "aesthetics_served": ["narrative", "expression", "discovery"],
        "genre_affinity": {"rpg": 3, "visual_novel": 3, "adventure": 3, "action_rpg": 2, "tactical_rpg": 2, "jrpg": 1, "mmorpg": 1},
        "conflicts_with": ["Линейный сценарий", "Кат-сцены без выбора"],
        "synergies_with": ["Репутация", "Фракции", "Красноречие", "Компаньоны", "Воспоминания"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Кат-сцены",
        "description": "Неконтролируемые видеовставки, продвигающие повествование. Моменты чистого сторителлинга между интерактивными сегментами.",
        "dynamics_served": ["Нарративный ритм", "Отдых от геймплея", "Эмоциональный пик"],
        "aesthetics_served": ["narrative", "sensation", "fantasy"],
        "genre_affinity": {"action": 3, "rpg": 3, "action_rpg": 3, "jrpg": 3, "adventure": 3, "shooter": 2, "visual_novel": 2, "tactical_rpg": 2, "mmorpg": 1},
        "conflicts_with": ["Интерактивность", "Без нарратива"],
        "synergies_with": ["Выбор сюжета", "Воспоминания", "Фракции", "Нарратив"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Дневник",
        "description": "Внутриигровой журнал для записи квестов, заметок и лора. Инструмент управления информацией и ориентации в сюжете.",
        "dynamics_served": ["Ориентация в сюжете", "Управление задачами", "Сохранение лора"],
        "aesthetics_served": ["narrative", "submission", "discovery"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "adventure": 3, "jrpg": 2, "tactical_rpg": 2, "visual_novel": 2, "survival_horror": 2},
        "conflicts_with": ["Отсутствие записей"],
        "synergies_with": ["Квесты", "Лог событий", "Бестиарий", "Воспоминания"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Коллекции",
        "description": "Собирание комплектов предметов или достижений. Создаёт петлю коллекционирования и визуализацию полноты опыта.",
        "dynamics_served": ["Коллекционирование", "Полнота опыта", "Охота за предметами"],
        "aesthetics_served": ["submission", "discovery", "expression"],
        "genre_affinity": {"adventure": 3, "platformer": 3, "rpg": 2, "action_rpg": 2, "metroidvania": 2, "sandbox": 2, "mmorpg": 2, "shooter": 1, "roguelike": 1},
        "conflicts_with": ["Минимализм контента"],
        "synergies_with": ["Тайники", "Достижения", "Бестиарий", "Изучение мира"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Бестиарий",
        "description": "Каталог врагов и существ с подробной информацией. Визуализация знаний о мире и мотивация к столкновению с разнообразными врагами.",
        "dynamics_served": ["Систематизация знаний", "Мотивация к разнообразию", "Тактическая информация"],
        "aesthetics_served": ["discovery", "submission", "narrative"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "mmorpg": 3, "jrpg": 2, "tactical_rpg": 2, "metroidvania": 2, "roguelike": 1, "adventure": 1},
        "conflicts_with": ["Без информации о врагах"],
        "synergies_with": ["Враги", "Сканирование", "Дневник", "Достижения", "Коллекции"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Воспоминания",
        "description": "Фрагменты прошлого, раскрываемые по мере продвижения. Создают нарративную глубину и мотивацию к поиску лора.",
        "dynamics_served": ["Раскрытие прошлого", "Нарративная глубина", "Мотивация к поиску"],
        "aesthetics_served": ["narrative", "discovery", "fantasy"],
        "genre_affinity": {"adventure": 3, "rpg": 2, "visual_novel": 3, "action_rpg": 2, "horror": 2, "jrpg": 2, "metroidvania": 1},
        "conflicts_with": ["Экспозиция upfront"],
        "synergies_with": ["Выбор сюжета", "Кат-сцены", "Дневник", "Фракции"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Фракции",
        "description": "Организованные группы NPC с собственными целями и отношениями. Создают систему союзов и конфликтов в мире игры.",
        "dynamics_served": ["Система союзов", "Политические конфликты", "Выбор стороны"],
        "aesthetics_served": ["narrative", "fellowship", "expression"],
        "genre_affinity": {"rpg": 3, "mmorpg": 3, "action_rpg": 2, "tactical_rpg": 3, "strategy": 2, "adventure": 2, "sandbox": 1, "jrpg": 1},
        "conflicts_with": ["Единая сторона"],
        "synergies_with": ["Репутация", "Выбор сюжета", "Квесты", "Нарратив", "Захват территории"]
    },
    {
        "group_id": 12,
        "group_name": "Сюжет",
        "mechanic_name": "Компаньоны",
        "description": "NPC-союзники, сопровождающие игрока. Создают эмоциональную привязанность и расширяют возможности через асимметрию навыков.",
        "dynamics_served": ["Эмоциональная привязанность", "Асимметрия навыков", "Социальная динамика"],
        "aesthetics_served": ["narrative", "fellowship", "fantasy"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "jrpg": 3, "tactical_rpg": 3, "adventure": 2, "mmorpg": 2, "visual_novel": 2},
        "conflicts_with": ["Полное одиночество"],
        "synergies_with": ["Выбор сюжета", "Фракции", "Роли", "Классы", "Кат-сцены"]
    },

    # ================================================================
    # ГРУППА 13: Выживание (8 механик)
    # ================================================================
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Голод",
        "description": "Необходимость регулярного приёма пищи для поддержания жизнедеятельности. Создаёт базовую петлю выживания и мотивацию к поиску ресурсов.",
        "dynamics_served": ["Базовая петля выживания", "Мотивация к собирательству", "Давление дефицита"],
        "aesthetics_served": ["challenge", "submission", "narrative"],
        "genre_affinity": {"survival_horror": 3, "sandbox": 3, "simulation": 3, "horror": 2, "adventure": 1, "strategy": 1},
        "conflicts_with": ["Бесконечные ресурсы", "Лёгкий режим"],
        "synergies_with": ["Жажда", "Ресурсы", "Фермерство", "Крафт", "Температура"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Жажда",
        "description": "Необходимость потребления воды, более критичная и частая, чем голод. Ускоряет цикл выживания и создаёт приоритет поиска воды.",
        "dynamics_served": ["Ускоренный цикл выживания", "Приоритет воды", "Давление дефицита"],
        "aesthetics_served": ["challenge", "submission", "sensation"],
        "genre_affinity": {"survival_horror": 3, "sandbox": 3, "simulation": 2, "horror": 2, "strategy": 1},
        "conflicts_with": ["Бесконечная вода"],
        "synergies_with": ["Голод", "Ресурсы", "Плавание", "Температура"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Сон",
        "description": "Необходимость отдыха для восстановления характеристик. Создаёт цикл активности и отдыха, управляя темпом игры.",
        "dynamics_served": ["Цикл активности/отдыха", "Восстановление", "Управление темпом"],
        "aesthetics_served": ["submission", "narrative", "challenge"],
        "genre_affinity": {"survival_horror": 3, "sandbox": 3, "simulation": 3, "rpg": 1, "strategy": 1},
        "conflicts_with": ["Бессонница персонажа"],
        "synergies_with": ["Цикл день/ночь", "Голод", "Здоровье", "Старение"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Температура",
        "description": "Влияние температуры среды на персонажа. Создаёт экологическое давление и необходимость адаптации через экипировку и укрытия.",
        "dynamics_served": ["Экологическое давление", "Адаптация", "Сезонная вариативность"],
        "aesthetics_served": ["challenge", "sensation", "submission"],
        "genre_affinity": {"survival_horror": 3, "sandbox": 3, "simulation": 3, "horror": 1, "strategy": 1},
        "conflicts_with": ["Климат-контроль"],
        "synergies_with": ["Погода", "Сезоны", "Обмундирование", "Голод", "Строительство"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Болезни",
        "description": "Система заболеваний, ослабляющих персонажа. Создаёт долгосрочные последствия и мотивацию к поиску лечения.",
        "dynamics_served": ["Долгосрочная слабость", "Необходимость лечения", "Предотвращение"],
        "aesthetics_served": ["challenge", "narrative", "submission"],
        "genre_affinity": {"survival_horror": 3, "sandbox": 2, "simulation": 2, "horror": 2, "rpg": 1},
        "conflicts_with": ["Бессмертие", "Отсутствие дебаффов"],
        "synergies_with": ["Зелья", "Алхимия", "Голод", "Температура", "Аптечки"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Износ",
        "description": "Постепенная деградация предметов при использовании. Создаёт цикл обслуживания и давление на экономику расходных материалов.",
        "dynamics_served": ["Амортизация", "Цикл обслуживания", "Планирование замены"],
        "aesthetics_served": ["challenge", "submission", "narrative"],
        "genre_affinity": {"survival_horror": 3, "sandbox": 3, "simulation": 3, "mmorpg": 2, "rpg": 2, "action_rpg": 2, "shooter": 1},
        "conflicts_with": ["Неразрушимые предметы", "Прокачка оружия"],
        "synergies_with": ["Ремонт", "Кузнечное дело", "Обмундирование", "Ресурсы", "Старение"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Пермасмерть",
        "description": "Безвозвратная потеря персонажа при смерти. Максимальная ставка риска, кардинально меняющая отношение к каждому решению.",
        "dynamics_served": ["Максимальный риск", "Осторожность", "Эмоциональная привязанность"],
        "aesthetics_served": ["challenge", "narrative", "sensation"],
        "genre_affinity": {"roguelike": 3, "horror": 3, "survival_horror": 3, "strategy": 1, "tactical_rpg": 1},
        "conflicts_with": ["Сохранения", "Перематывание времени", "Кооперация"],
        "synergies_with": ["Сложность", "Здоровье", "Голод", "Жажда"]
    },
    {
        "group_id": 13,
        "group_name": "Выживание",
        "mechanic_name": "Сохранения",
        "description": "Система фиксации прогресса для восстановления после неудачи. Баланс между доступностью и ставкой риска.",
        "dynamics_served": ["Снижение ставки риска", "Управление прогрессом", "Точки возврата"],
        "aesthetics_served": ["submission", "challenge", "narrative"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "adventure": 3, "shooter": 2, "metroidvania": 3, "strategy": 2, "mmorpg": 1, "jrpg": 3, "tactical_rpg": 2},
        "conflicts_with": ["Пермасмерть", "Перематывание времени"],
        "synergies_with": ["Сложность", "Здоровье", "Квесты"]
    },

    # ================================================================
    # ГРУППА 14: Информация (9 механик)
    # ================================================================
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Миникарта",
        "description": "Упрощённая карта ближайшего окружения. Снижает когнитивную нагрузку навигации и поддерживает ориентацию.",
        "dynamics_served": ["Ориентация", "Снижение когнитивной нагрузки", "Быстрая навигация"],
        "aesthetics_served": ["submission", "discovery", "sensation"],
        "genre_affinity": {"mmorpg": 3, "shooter": 3, "action": 3, "rpg": 3, "action_rpg": 3, "sandbox": 2, "adventure": 2, "strategy": 2, "rts": 2, "metroidvania": 1},
        "conflicts_with": ["Туман войны", "Хардкор без карты"],
        "synergies_with": ["Карта мира", "Маркеры", "Обнаружение"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Маркеры",
        "description": "Визуальные указатели целей и интересных объектов на карте и в мире. Направляют внимание и снижают фрустрацию поиска.",
        "dynamics_served": ["Направление внимания", "Снижение фрустрации", "Целеуказание"],
        "aesthetics_served": ["submission", "discovery", "challenge"],
        "genre_affinity": {"mmorpg": 3, "rpg": 3, "action_rpg": 3, "adventure": 3, "shooter": 2, "sandbox": 2, "action": 2, "jrpg": 2},
        "conflicts_with": ["Чистое исследование без подсказок", "Тайники"],
        "synergies_with": ["Миникарта", "Квесты", "Изучение мира"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Подсказки",
        "description": "Система контекстных советов и направлений для игрока. Снижает порог входа и помогает в моменты застревания.",
        "dynamics_served": ["Снижение порога входа", "Помощь при застревании", "Обучение"],
        "aesthetics_served": ["submission", "challenge", "discovery"],
        "genre_affinity": {"puzzle": 3, "adventure": 3, "educational": 3, "rpg": 2, "platformer": 2, "metroidvania": 2, "action": 1},
        "conflicts_with": ["Хардкор без подсказок", "Чистое открытие"],
        "synergies_with": ["Учебник", "Головоломки", "Маркеры", "Сканирование"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Сканирование",
        "description": "Активное выявление свойств объектов и врагов. Создаёт информационную петлю «сканируй → анализируй → действуй».",
        "dynamics_served": ["Информационная петля", "Анализ перед действием", "Тактическое преимущество"],
        "aesthetics_served": ["discovery", "challenge", "submission"],
        "genre_affinity": {"metroidvania": 3, "action_rpg": 2, "shooter": 2, "adventure": 2, "rpg": 2, "tactical_rpg": 2, "survival_horror": 1},
        "conflicts_with": ["Полная информация"],
        "synergies_with": ["Бестиарий", "Разведка", "Подсказки", "Интеллект"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Интеллект",
        "description": "Система сбора и анализа стратегической информации о противнике. Создаёт слой разведки перед принятием решений.",
        "dynamics_served": ["Стратегическая разведка", "Информационное превосходство", "Планирование"],
        "aesthetics_served": ["challenge", "discovery", "submission"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "tactical_rpg": 3, "stealth": 2, "shooter": 1, "mmorpg": 1},
        "conflicts_with": ["Случайность без информации"],
        "synergies_with": ["Разведка", "Туман войны", "Сканирование", "Бестиарий"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Учебник",
        "description": "Внутриигровое руководство по механикам и системам. Снижает барьер обучения и служит справочником.",
        "dynamics_served": ["Обучение", "Справка", "Снижение барьера"],
        "aesthetics_served": ["submission", "challenge", "discovery"],
        "genre_affinity": {"strategy": 3, "rts": 3, "tbs": 3, "tactical_rpg": 2, "rpg": 2, "simulation": 2, "puzzle": 2, "educational": 3},
        "conflicts_with": ["Обучение только через практику"],
        "synergies_with": ["Подсказки", "Статистика", "Древо технологий"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Статистика",
        "description": "Детальная числовая информация о прогрессе и результатах. Создаёт основу для анализа и оптимизации игрового процесса.",
        "dynamics_served": ["Анализ результатов", "Оптимизация", "Самооценка"],
        "aesthetics_served": ["submission", "challenge", "expression"],
        "genre_affinity": {"mmorpg": 3, "rpg": 2, "strategy": 3, "rts": 2, "sports": 3, "shooter": 2, "simulation": 2, "racing": 2, "roguelike": 1},
        "conflicts_with": ["Скрытая механика"],
        "synergies_with": ["Достижения", "Рейтинги", "Учебник", "Лог событий"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Лог событий",
        "description": "Хронологическая запись игровых событий. Инструмент анализа и восстановления контекста после перерыва.",
        "dynamics_served": ["Восстановление контекста", "Анализ прошлого", "Прозрачность"],
        "aesthetics_served": ["submission", "narrative", "discovery"],
        "genre_affinity": {"strategy": 3, "mmorpg": 2, "rpg": 2, "tbs": 2, "simulation": 2, "visual_novel": 1},
        "conflicts_with": ["Только настоящее"],
        "synergies_with": ["Дневник", "Статистика", "Воспоминания", "Учебник"]
    },
    {
        "group_id": 14,
        "group_name": "Информация",
        "mechanic_name": "Обнаружение",
        "description": "Система визуального и аудиального выявления объектов и врагов. Создаёт динамику заметности и скрытности.",
        "dynamics_served": ["Заметность", "Скрытность", "Информационный обмен"],
        "aesthetics_served": ["discovery", "challenge", "sensation"],
        "genre_affinity": {"stealth": 3, "shooter": 3, "survival_horror": 3, "horror": 3, "action": 2, "tactical_rpg": 2, "metroidvania": 1},
        "conflicts_with": ["Полная видимость"],
        "synergies_with": ["Стелс и прятки", "Шум", "Миникарта", "Ночное видение"]
    },

    # ================================================================
    # ГРУППА 15: Мета (8 механик)
    # ================================================================
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Достижения платформы",
        "description": "Мета-достижения, привязанные к платформе (Steam, PlayStation и т.д.). Создают внешний слой мотивации и социальную видимость.",
        "dynamics_served": ["Внешняя мотивация", "Социальная видимость", "Мета-цели"],
        "aesthetics_served": ["submission", "expression", "challenge"],
        "genre_affinity": {"action": 2, "shooter": 2, "platformer": 2, "rpg": 2, "adventure": 2, "puzzle": 1, "roguelike": 1},
        "conflicts_with": ["Только внутриигровые достижения"],
        "synergies_with": ["Достижения", "Рейтинги", "Статистика"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Торговая площадка",
        "description": "Платформенная система торговли предметами между игроками за реальные деньги. Создаёт реальную экономику вокруг виртуальных предметов.",
        "dynamics_served": ["Реальная экономика", "Спекуляция", "Монетизация"],
        "aesthetics_served": ["submission", "expression", "fellowship"],
        "genre_affinity": {"mmorpg": 3, "shooter": 2, "sandbox": 2, "strategy": 1, "idle": 2, "simulation": 1},
        "conflicts_with": ["Закрытая экономика"],
        "synergies_with": ["Аукцион", "Лутбоксы", "Микротранзакции", "Экономика"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "DLC",
        "description": "Загружаемый дополнительный контент, расширяющий игру. Управляет жизненным циклом продукта и доступностью контента.",
        "dynamics_served": ["Расширение контента", "Жизненный цикл продукта", "Фрагментация аудитории"],
        "aesthetics_served": ["discovery", "submission", "narrative"],
        "genre_affinity": {"rpg": 3, "action_rpg": 3, "shooter": 2, "action": 2, "adventure": 2, "mmorpg": 2, "strategy": 2, "racing": 2, "jrpg": 1},
        "conflicts_with": ["Полная игра при покупке"],
        "synergies_with": ["Сезонный пропуск", "Модификации", "Фракции"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Модификации",
        "description": "Пользовательские изменения игры. Расширяют вариативность и жизненный цикл через вклад сообщества.",
        "dynamics_served": ["Пользовательский контент", "Расширенная вариативность", "Продление жизни продукта"],
        "aesthetics_served": ["expression", "discovery", "submission"],
        "genre_affinity": {"sandbox": 3, "strategy": 3, "rts": 3, "rpg": 2, "shooter": 2, "simulation": 3, "action": 1, "adventure": 1},
        "conflicts_with": ["Закрытая платформа", "Контроль качества"],
        "synergies_with": ["Строительство", "Крафт", "Сезонный пропуск"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Стриминг",
        "description": "Интеграция с платформами трансляций и системами зрителей. Создаёт слой социального опыта вокруг игры.",
        "dynamics_served": ["Социальный опыт", "Зрительское взаимодействие", "Виральность"],
        "aesthetics_served": ["fellowship", "expression", "sensation"],
        "genre_affinity": {"party": 3, "action": 2, "shooter": 2, "fighting": 2, "horror": 2, "strategy": 1, "mmorpg": 1, "roguelike": 1},
        "conflicts_with": ["Одиночный опыт"],
        "synergies_with": ["Кооперация", "Соревнование", "Чат", "Модификации"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Кроссплатформа",
        "description": "Совместная игра и перенос прогресса между платформами. Расширяет аудиторию и снижает барьеры доступа.",
        "dynamics_served": ["Расширение аудитории", "Перенос прогресса", "Снижение барьеров"],
        "aesthetics_served": ["fellowship", "submission", "expression"],
        "genre_affinity": {"shooter": 3, "action": 2, "fighting": 2, "mmorpg": 2, "sports": 3, "racing": 2, "strategy": 1, "sandbox": 1, "party": 2},
        "conflicts_with": ["Эксклюзивный контент"],
        "synergies_with": ["Кооперация", "Соревнование", "Сохранения"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Микротранзакции",
        "description": "Маленькие внутриигровые покупки за реальные деньги. Монетизируют бесплатный или условно-бесплатный опыт.",
        "dynamics_served": ["Монетизация", "Ускорение прогресса", "Кастомизация за деньги"],
        "aesthetics_served": ["submission", "expression"],
        "genre_affinity": {"mmorpg": 3, "shooter": 2, "idle": 3, "sports": 2, "racing": 2, "sandbox": 1, "action": 1},
        "conflicts_with": ["Честная игра без покупок", "Пермасмерть"],
        "synergies_with": ["Лутбоксы", "Сезонный пропуск", "Торговая площадка", "Экономика"]
    },
    {
        "group_id": 15,
        "group_name": "Мета",
        "mechanic_name": "Сезонный пропуск",
        "description": "Временная система прогрессии с уникальными наградами. Создаёт цикл удержания и срочность вовлечения.",
        "dynamics_served": ["Удержание игроков", "Срочность", "Регулярный контент"],
        "aesthetics_served": ["submission", "expression", "challenge"],
        "genre_affinity": {"shooter": 3, "mmorpg": 3, "action": 2, "sports": 3, "racing": 2, "fighting": 2, "strategy": 1, "sandbox": 1, "idle": 2},
        "conflicts_with": ["Полная игра при покупке", "Пермасмерть"],
        "synergies_with": ["Микротранзакции", "Достижения", "DLC", "Уровни", "Рейтинги"]
    },
]
