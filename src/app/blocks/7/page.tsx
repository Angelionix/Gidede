"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Send,
  Loader2,
  AlertTriangle,
  Lightbulb,
  MessageSquare,
  Trash2,
  CheckCircle2,
  Info,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";

// ============================================================
// Types
// ============================================================

interface ChatMsg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface Suggestion {
  title: string;
  description: string;
  action: string;
  priority: string;
  data?: Record<string, unknown>;
}

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  block_id: number;
  title: string;
  description: string;
  suggestion: string;
  timestamp: number;
}

// ============================================================
// Chat Message Component
// ============================================================

function ChatMessage({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  const isSystem = msg.role === "system";

  return (
    <div
      className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mt-1">
          {isSystem ? (
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Bot className="h-3.5 w-3.5 text-primary" />
          )}
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-primary text-primary-foreground"
            : isSystem
            ? "bg-muted/50 text-muted-foreground italic"
            : "bg-muted"
        }`}
      >
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        {msg.metadata?.model_used && !isUser && (
          <div className="mt-1 text-[10px] opacity-60">
            {(msg.metadata.model_used as string) || ""} • {(msg.metadata.provider as string) || ""} • {((msg.metadata.latency_ms as number) || 0)}ms
          </div>
        )}
      </div>
      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center mt-1">
          <MessageSquare className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Suggestions Panel
// ============================================================

function SuggestionsPanel({
  suggestions,
  isLoading,
  onRefresh,
}: {
  suggestions: Suggestion[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const priorityColors: Record<string, string> = {
    high: "text-red-600 dark:text-red-400",
    medium: "text-yellow-600 dark:text-yellow-400",
    low: "text-blue-600 dark:text-blue-400",
  };

  const actionIcons: Record<string, React.ReactNode> = {
    generate: <Sparkles className="h-3.5 w-3.5" />,
    validate: <CheckCircle2 className="h-3.5 w-3.5" />,
    fix: <AlertTriangle className="h-3.5 w-3.5" />,
    review: <Lightbulb className="h-3.5 w-3.5" />,
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Контекстные подсказки</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <Lightbulb className="h-3 w-3 mr-1" />
          )}
          Обновить
        </Button>
      </div>

      {suggestions.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Выберите блок для получения подсказок
        </p>
      )}

      {suggestions.map((s, i) => (
        <Card key={i} className="py-2">
          <CardContent className="px-3 py-1">
            <div className="flex items-start gap-2">
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
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {s.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Alerts Panel
// ============================================================

function AlertsPanel({
  alerts,
  isLoading,
  onRefresh,
}: {
  alerts: Alert[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  const severityConfig: Record<string, { bg: string; icon: React.ReactNode; color: string }> = {
    critical: {
      bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      color: "text-red-700 dark:text-red-300",
    },
    warning: {
      bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
      icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
      color: "text-yellow-700 dark:text-yellow-300",
    },
    info: {
      bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
      icon: <Info className="h-4 w-4 text-blue-500" />,
      color: "text-blue-700 dark:text-blue-300",
    },
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Проактивные уведомления
          {alerts.length > 0 && (
            <Badge variant="destructive" className="ml-2 text-[10px] h-4 px-1.5">
              {alerts.length}
            </Badge>
          )}
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isLoading}
          className="h-7 text-xs"
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <AlertTriangle className="h-3 w-3 mr-1" />
          )}
          Проверить
        </Button>
      </div>

      {alerts.length === 0 && !isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">Проблем не обнаружено</p>
        </div>
      )}

      {alerts.map((alert) => {
        const config = severityConfig[alert.severity] || severityConfig.info;
        return (
          <div
            key={alert.id}
            className={`rounded-md border p-3 ${config.bg}`}
          >
            <div className="flex items-start gap-2">
              <div className="shrink-0 mt-0.5">{config.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-medium ${config.color}`}>
                    {alert.title}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    Блок {alert.block_id}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {alert.description}
                </p>
                <p className="text-[11px] mt-1 font-medium">
                  💡 {alert.suggestion}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Main Block 7 Page
// ============================================================

export default function Block7Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Chat state ---
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- Suggestions state ---
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsBlock, setSuggestionsBlock] = useState(1);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  // --- Alerts state ---
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);

  // --- Tab state ---
  const [mainTab, setMainTab] = useState("chat");

  // --- Auto-scroll ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Send message ---
  const handleSend = useCallback(async () => {
    const msg = inputValue.trim();
    if (!msg || isSending) return;

    setIsSending(true);
    setInputValue("");

    // Add user message
    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const data = await apiFetch<{
        reply: string;
        model_used: string;
        provider: string;
        sources: { title: string; content: string }[];
        suggestions: string[];
        latency_ms: number;
        from_cache: boolean;
      }>("/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          project_id: projectId || undefined,
          context: undefined, // Could pass project state here
        }),
      });

      const assistantMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply,
        timestamp: Date.now(),
        metadata: {
          model_used: data.model_used,
          provider: data.provider,
          latency_ms: data.latency_ms,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        role: "system",
        content: `Ошибка: ${err instanceof Error ? err.message : "Не удалось отправить сообщение"}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, projectId, apiFetch]);

  // --- Load suggestions ---
  const handleLoadSuggestions = useCallback(async () => {
    setIsSuggestionsLoading(true);
    try {
      const data = await apiFetch<{
        block_id: number;
        suggestions: Suggestion[];
      }>(
        `/assistant/suggestions?block_id=${suggestionsBlock}${projectId ? `&project_id=${projectId}` : ""}`
      );
      setSuggestions(data.suggestions);
    } catch (err) {
      toast({
        title: "Ошибка загрузки подсказок",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsSuggestionsLoading(false);
    }
  }, [suggestionsBlock, projectId, apiFetch, toast]);

  // --- Load alerts ---
  const handleLoadAlerts = useCallback(async () => {
    setIsAlertsLoading(true);
    try {
      const data = await apiFetch<{ alerts: Alert[]; total: number }>(
        `/assistant/alerts${projectId ? `?project_id=${projectId}` : ""}`
      );
      setAlerts(data.alerts);
    } catch (err) {
      toast({
        title: "Ошибка проверки",
        description: err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsAlertsLoading(false);
    }
  }, [projectId, apiFetch, toast]);

  // --- Clear history ---
  const handleClearHistory = useCallback(async () => {
    try {
      await apiFetch("/assistant/history/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId || undefined,
        }),
      });
      setMessages([]);
      toast({ title: "История очищена" });
    } catch {
      // Silently clear local state
      setMessages([]);
    }
  }, [projectId, apiFetch, toast]);

  // --- Handle Enter key ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI-ассистент</h1>
          <p className="text-sm text-muted-foreground">
            Блок 7 • Спецификация 3.9
          </p>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chat" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Чат</span>
          </TabsTrigger>
          <TabsTrigger value="suggestions" className="flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Подсказки</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Уведомления</span>
          </TabsTrigger>
        </TabsList>

        {/* ====================== CHAT TAB ====================== */}
        <TabsContent value="chat" className="mt-4">
          <Card className="flex flex-col" style={{ height: "calc(100vh - 240px)", minHeight: "400px" }}>
            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Bot className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-medium">AI-ассистент Gidede</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto">
                    Задайте вопрос о геймдизайне, получите рекомендации по проекту
                    или попросите проверить дизайн на проблемы.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-4">
                    {[
                      "Какие механики подходят для RPG?",
                      "Проверь мой Core Loop на патологии",
                      "Как сбалансировать экономику?",
                      "Что такое лудонарративный диссонанс?",
                    ].map((q) => (
                      <Button
                        key={q}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => {
                          setInputValue(q);
                        }}
                      >
                        {q}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <ChatMessage key={msg.id} msg={msg} />
              ))}

              {isSending && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground">
                  <Bot className="h-5 w-5 text-primary animate-pulse" />
                  <span>AI-ассистент думает...</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t p-3 flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Задайте вопрос о геймдизайне..."
                disabled={isSending}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={isSending || !inputValue.trim()}
                size="icon"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearHistory}
                title="Очистить историю"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* ====================== SUGGESTIONS TAB ====================== */}
        <TabsContent value="suggestions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-primary" />
                Контекстные подсказки
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Block selector */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Блок:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((blockId) => (
                    <Button
                      key={blockId}
                      variant={suggestionsBlock === blockId ? "default" : "outline"}
                      size="sm"
                      className="h-7 w-7 p-0 text-xs"
                      onClick={() => setSuggestionsBlock(blockId)}
                    >
                      {blockId}
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={handleLoadSuggestions}
                  disabled={isSuggestionsLoading}
                  size="sm"
                  className="ml-auto"
                >
                  {isSuggestionsLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Sparkles className="h-3 w-3 mr-1" />
                  )}
                  Загрузить
                </Button>
              </div>

              <SuggestionsPanel
                suggestions={suggestions}
                isLoading={isSuggestionsLoading}
                onRefresh={handleLoadSuggestions}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== ALERTS TAB ====================== */}
        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Проактивные уведомления
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AlertsPanel
                alerts={alerts}
                isLoading={isAlertsLoading}
                onRefresh={handleLoadAlerts}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
