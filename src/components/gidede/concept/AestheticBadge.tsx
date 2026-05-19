"use client";

import { AESTHETIC_MAP } from "@/config/aesthetics";

export function AestheticBadge({ value, level }: { value: string; level: "primary" | "secondary" | "tertiary" }) {
  const key = (value || "").toLowerCase();
  const mapping = AESTHETIC_MAP[key];
  const sizeClass =
    level === "primary"
      ? "text-base px-4 py-2"
      : level === "secondary"
        ? "text-sm px-3 py-1.5"
        : "text-xs px-2.5 py-1";
  const boldClass = level === "primary" ? "font-bold" : level === "secondary" ? "font-semibold" : "font-medium";

  if (!mapping) {
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full border ${sizeClass} ${boldClass} bg-muted text-muted-foreground`}>
        {value}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${mapping.color} ${sizeClass} ${boldClass}`}>
      <span>{mapping.emoji}</span>
      {mapping.label}
    </span>
  );
}
