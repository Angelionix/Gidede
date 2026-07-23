"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// ============================================================
// Types
// ============================================================

interface Suggestion {
  title: string;
  description: string;
  action: string;
  priority: string;
}

interface ContextualSuggestionCardProps {
  /** ID блока (1-8) */
  blockId: number;
  /** ID проекта */
  projectId?: string | null;
  /** Максимум подсказок для показа */
  maxSuggestions?: number;
  /** Показать ли карточку */
  visible?: boolean;
  /** Callback при закрытии */
  onClose?: () => void;
}

// ============================================================
// Action icon mapping
// ============================================================

const actionIcons: Record<string, React.ReactNode> = {
  generate: <Sparkles className="h-3 w-3" />,
  validate: <CheckCircle2 className="h-3 w-3" />,
  fix: <AlertTriangle className="h-3 w-3" />,
  review: <Lightbulb className="h-3 w-3" />,
};

const priorityVariant: Record<string, "destructive" | "outline" | "secondary"> = {
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

// ============================================================
// ContextualSuggestionCard Component
// ============================================================

export function ContextualSuggestionCard({
  blockId,
  projectId,
  maxSuggestions = 3,
  visible = true,
  onClose,
}: ContextualSuggestionCardProps) {
  const { apiFetch } = useAuth();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{
        block_id: number;
        suggestions: Suggestion[];
      }>(
        `/assistant/suggestions?block_id=${blockId}${projectId ? `&project_id=${projectId}` : ""}`
      );
      setSuggestions((data.suggestions || []).slice(0, maxSuggestions));
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, [blockId, projectId, maxSuggestions, apiFetch]);

  useEffect(() => {
    if (visible && !isDismissed) {
      loadSuggestions();
    }
  }, [visible, isDismissed, loadSuggestions]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    onClose?.();
  }, [onClose]);

  if (!visible || isDismissed || (suggestions.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <Card className="w-64 shadow-lg border-primary/20 bg-background/95 backdrop-blur-sm">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium">AI-подсказки</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={handleDismiss}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="mt-0.5 shrink-0">
                  {actionIcons[s.action] || <Lightbulb className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium leading-tight">
                      {s.title}
                    </span>
                    <Badge
                      variant={priorityVariant[s.priority] || "outline"}
                      className="text-[9px] px-1 py-0 h-3"
                    >
                      {s.priority}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                    {s.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ContextualSuggestionCard;
