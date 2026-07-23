// ============================================================
// GDD Generator — Constants
// ============================================================

export const GDD_FORMATS = [
  { value: "one_sheet", label: "One-Sheet", description: "1 страница — суть игры на одном листе", recommendation: "Стадия концепции, питчинг идеи", icon: "📄" },
  { value: "ten_pager", label: "Ten-Pager", description: "10 страниц — расширенный обзор", recommendation: "Прототип, привлечение команды", icon: "📝" },
  { value: "treatment", label: "Treatment", description: "3 страницы — краткое описание для инвесторов", recommendation: "Питчинг инвесторам, publisher", icon: "💼" },
  { value: "sketch_design", label: "Sketch Design", description: "15 страниц — фокус на механиках", recommendation: "Синхронизация команды, дизайн-обзор", icon: "✏️" },
  { value: "full_gdd", label: "Full GDD", description: "50+ страниц — полный документ", recommendation: "Production, рабочий документ команды", icon: "📚" },
  { value: "concept_doc", label: "Concept Doc", description: "8 страниц — фокус на опыте игрока", recommendation: "Уточнение концепции, тест идеи", icon: "💡" },
  { value: "narrative_bible", label: "Narrative Bible", description: "30 страниц — нарративный документ", recommendation: "Сюжетно-ориентированные игры", icon: "📖" },
  { value: "modular", label: "Modular", description: "40 страниц — модульный формат по разделам", recommendation: "Live Ops, постоянные обновления", icon: "🧩" },
];

export const DETAIL_LEVELS = [
  { value: "overview", label: "Обзорный", description: "Краткое описание, минимум деталей" },
  { value: "standard", label: "Стандартный", description: "Базовый уровень детализации" },
  { value: "detailed", label: "Детальный", description: "Подробное описание с примерами" },
  { value: "exhaustive", label: "Исчерпывающий", description: "Максимальная детализация с таблицами и формулами" },
];

export const DOC_AUDIENCES = [
  { value: "investor", label: "Инвестор" },
  { value: "team_sync", label: "Синхронизация команды" },
  { value: "production", label: "Production" },
  { value: "personal", label: "Личный документ" },
  { value: "educational", label: "Обучающий" },
];

export const PROJECT_STAGES = [
  { value: "concept", label: "Концепция" },
  { value: "prototype", label: "Прототип" },
  { value: "preproduction", label: "Пре-продакшн" },
  { value: "production", label: "Продакшн" },
  { value: "live_ops", label: "Live Ops" },
];
