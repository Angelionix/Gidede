"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Avoid hydration mismatch: use static title until mounted
  const title = mounted
    ? theme === "dark"
      ? "Светлая тема"
      : "Тёмная тема"
    : "Переключить тему";

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Переключить тему"
      title={title}
      suppressHydrationWarning
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Переключить тему</span>
    </Button>
  );
}
