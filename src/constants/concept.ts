/**
 * Gidede — Concept Constants (Block 1)
 * SRP: извлечены из src/app/blocks/1/page.tsx
 */

export const PLATFORMS = [
  { value: "pc", label: "PC" },
  { value: "mobile", label: "Mobile" },
  { value: "console", label: "Console" },
  { value: "vr", label: "VR" },
  { value: "web", label: "Web" },
];

export const BUDGET_OPTIONS = [
  { value: "solo", label: "Solo-разработчик" },
  { value: "small", label: "Малая команда (2-5)" },
  { value: "medium", label: "Средняя команда (6-15)" },
  { value: "large", label: "Большая команда (16+)" },
];

export const EXPERIENCE_LEVELS = [
  { value: "casual", label: "Казуальный" },
  { value: "midcore", label: "Мидкор" },
  { value: "hardcore", label: "Хардкор" },
];

export const MECHANIC_GROUPS: { key: string; label: string }[] = [
  { key: "base", label: "Базовые механики" },
  { key: "combat", label: "Боевые механики" },
  { key: "progression", label: "Прогрессионные механики" },
  { key: "spatial", label: "Пространственные механики" },
  { key: "social", label: "Социальные / информационные механики" },
];

export const LOOP_TYPE_LABELS: Record<string, string> = {
  engine: "Двигатель",
  economy: "Экономика",
  ecology: "Экология",
  hybrid: "Гибрид",
};
