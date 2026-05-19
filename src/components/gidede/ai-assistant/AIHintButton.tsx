"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Lightbulb, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

// ============================================================
// Types
// ============================================================

interface Suggestion {
  title: string;
  description: string;
  action: string;
  priority: string;
  data?: Record<string, unknown>;
}

interface AIHintButtonProps {
  /** ID блока (1-8), для которого генерируются подсказки */
  blockId: number;
  /** ID проекта (опционально) */
  projectId?: string | null;
  /** Дополнительный CSS класс */
  className?: string;
  /** Размер кнопки */
  size?: "default" | "sm" | "lg" | "icon";
  /** Вариант стиля кнопки */
  variant?: "default" | "outline" | "ghost" | "secondary";
}

// ============================================================
// Action icon mapping
// ============================================================

const actionIcons: Record<string, React.ReactNode> = {
  generate: <Sparkles className="h-3.5 w-3.5" />,
  validate: <CheckCircle2 className="h-3.5 w-3.5" />,
  fix: <AlertTriangle className="h-3.5 w-3.5" />,
  review: <Lightbulb className="h-3.5 w-3.5" />,
};

const priorityColors: Record<string, string> = {
  high: "text-red-600 dark:text-red-400",
  medium: "text-yellow-600 dark:text-yellow-400",
  low: "text-blue-600 dark:text-blue-400",
};

// ============================================================
// AIHintButton Component
// ============================================================

export function AIHintButton({
  blockId,
  projectId,
  className,
  size = "sm",
  variant = "outline",
}: AIHintButtonProps) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleLoadSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        block_id: number;
        suggestions: Suggestion[];
      }>(
        `/assistant/suggestions?block_id=${blockId}${projectId ? `&project_id=${projectId}` : ""}`
      );
      setSuggestions(data.suggestions || []);
    } catch (err) {
      toast({
        title: "Ошибка загрузки подсказок",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [blockId, projectId, apiFetch, toast]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open && suggestions.length === 0) {
        handleLoadSuggestions();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [suggestions.length, handleLoadSuggestions]
  );

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={`gap-1.5 ${className || ""}`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">AI-подсказка</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Подсказки для Блока {blockId}</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadSuggestions}
              disabled={isLoading}
              className="h-6 text-xs"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Обновить"
              )}
            </Button>
          </div>
        </div>
        <div className="p-2 max-h-72 overflow-y-auto">
          {isLoading && suggestions.length === 0 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Загрузка...
              </span>
            </div>
          )}
          {!isLoading && suggestions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">
              Нет подсказок для этого блока
            </p>
          )}
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
            >
              <div className={priorityColors[s.priority] || ""}>
                {actionIcons[s.action] || <Lightbulb className="h-3.5 w-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium">{s.title}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    {s.priority}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default AIHintButton;
