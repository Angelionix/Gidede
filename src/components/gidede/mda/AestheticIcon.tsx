"use client";

import { AESTHETICS } from "@/config/aesthetics";

/**
 * Иконка эстетики с цветокодированием.
 * Используется в форме Блока 3 (MDA Lab) для выбора целевых эстетик.
 */
export function AestheticIcon({
  value,
  selected,
  onClick,
}: {
  value: string;
  selected: boolean;
  onClick: () => void;
}) {
  const aesthetic = AESTHETICS.find((a) => a.value === value);
  if (!aesthetic) return null;
  const Icon = aesthetic.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
        selected
          ? `${aesthetic.color} border-current shadow-sm`
          : "border-transparent bg-muted/30 hover:bg-muted/60"
      }`}
    >
      <Icon className="h-6 w-6" />
      <span className="text-[11px] font-medium">{aesthetic.label}</span>
    </button>
  );
}
