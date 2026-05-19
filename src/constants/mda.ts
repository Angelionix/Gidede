/**
 * Gidede — MDA Constants (Block 3)
 * SRP: извлечены из src/app/blocks/3/page.tsx
 *
 * NOTE: SEVERITY_COLORS lives in @/constants/economy — import from there instead.
 */

export const PRIORITY_LENSES = [
  { id: 9, name: "Тетрада", focus: "Согласованность Механика/История/Эстетика/Технология", category: "целостность" },
  { id: 11, name: "Единство", focus: "Работают ли все элементы на общий замысел?", category: "целостность" },
  { id: 12, name: "Резонанс", focus: "Усиливают ли элементы друг друга?", category: "целостность" },
  { id: 30, name: "Эмерджентность", focus: "Сколько глаголов? Сколько результирующих действий?", category: "эмерджентность" },
  { id: 31, name: "Пространство действий", focus: "Совпадает ли воспринимаемое с реальным?", category: "эмерджентность" },
  { id: 40, name: "Треугольность", focus: "Осмысленный выбор риска vs безопасности", category: "баланс" },
  { id: 41, name: "Доминантная стратегия", focus: "Есть ли один очевидно лучший путь?", category: "баланс" },
  { id: 69, name: "Кривая интереса", focus: "Пики и спады интереса на протяжении игры", category: "интерес" },
  { id: 74, name: "Свобода vs управляемость", focus: "Баланс агентивности и замысла", category: "интерес" },
];

export const BOND_ELEMENTS = ["Механика", "История", "Эстетика", "Технология"];
export const BOND_LEVELS = ["Фиксированный", "Динамический", "Культурный"];

export const SCORE_COLORS = {
  high: "text-green-600 dark:text-green-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-red-600 dark:text-red-400",
};

export const CATEGORY_COLORS: Record<string, string> = {
  целостность: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  эмерджентность: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  баланс: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  интерес: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300",
};

export const EMERGENCE_BADGES: Record<string, { label: string; color: string }> = {
  nominal: { label: "Номинальная", color: "bg-gray-100 text-gray-800 dark:bg-gray-950/40 dark:text-gray-300" },
  weak: { label: "Слабая", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300" },
  multiple: { label: "Множественная", color: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  strong: { label: "Сильная", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300" },
};
