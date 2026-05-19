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
  Clock,
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
  isStreaming?: boolean;
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
// API base URL helper
// ============================================================

function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
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
        <div className="whitespace-pre-wrap break-words">
          {msg.content}
          {msg.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
        {msg.metadata?.model_used && !isUser && !msg.isStreaming && (
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
                  {alert.suggestion}
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
// Chat History Component
// ============================================================

function ChatHistoryList({
  messages,
  onLoadMore,
  hasMore,
}: {
  messages: ChatMsg[];
  onLoadMore: () => void;
  hasMore: boolean;
}) {
  // Group messages by date
  const grouped = messages.reduce<Record<string, ChatMsg[]>>((acc, msg) => {
    const date = new Date(msg.timestamp).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([date, msgs]) => (
        <div key={date}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
            {date}
          </div>
          <div className="space-y-2">
            {msgs.map((msg) => (
              <div
                key={msg.id}
                className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
              >
                <div className="shrink-0 mt-0.5">
                  {msg.role === "user" ? (
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Bot className="h-3 w-3 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs line-clamp-2">{msg.content}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(msg.timestamp).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {hasMore && (
        <Button variant="ghost" size="sm" onClick={onLoadMore} className="w-full text-xs">
          Загрузить ещё
        </Button>
      )}
    </div>
  );
}

// ============================================================
// Main Block 7 Page — AI Assistant with SSE Streaming
// ============================================================

export default function Block7Page() {
  const { apiFetch, token } = useAuth();
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
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Suggestions state ---
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsBlock, setSuggestionsBlock] = useState(1);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);

  // --- Alerts state ---
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isAlertsLoading, setIsAlertsLoading] = useState(false);

  // --- Chat history state ---
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(50);

  // --- Tab state ---
  const [mainTab, setMainTab] = useState("chat");

  // --- Auto-scroll ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Load chat history on mount ---
  useEffect(() => {
    if (projectId && mainTab === "chat") {
      loadChatHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, mainTab]);

  // --- Load chat history from server ---
  const loadChatHistory = useCallback(async () => {
    try {
      const data = await apiFetch<{
        messages: { id: string; role: string; content: string; timestamp: number; metadata?: Record<string, unknown> }[];
        total: number;
      }>(
        `/assistant/history${projectId ? `?project_id=${projectId}` : ""}&limit=${historyLimit}`
      );
      const historyMsgs: ChatMsg[] = (data.messages || []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
        timestamp: m.timestamp,
        metadata: m.metadata,
      }));
      setChatHistory(historyMsgs);
      setHasMoreHistory(data.total > historyLimit);
      // If local messages empty, populate from history
      if (messages.length === 0 && historyMsgs.length > 0) {
        setMessages(historyMsgs);
      }
    } catch {
      // Silently ignore — history is optional
    }
  }, [projectId, historyLimit, apiFetch, messages.length]);

  // --- SSE Streaming send ---
  const handleSendStream = useCallback(async () => {
    const msg = inputValue.trim();
    if (!msg || isSending) return;

    setIsSending(true);
    setIsStreaming(true);
    setInputValue("");

    // Add user message
    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      role: "user",
      content: msg,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Create streaming assistant message
    const streamMsgId = (Date.now() + 1).toString();
    const streamMsg: ChatMsg = {
      id: streamMsgId,
      role: "assistant",
      content: "",
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamMsg]);

    try {
      const baseUrl = getApiBaseUrl();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const response = await fetch(`${baseUrl}/assistant/chat/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: msg,
          project_id: projectId || undefined,
          context: undefined,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body for streaming");
      }

      const decoder = new TextDecoder();
      let accumulatedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE events
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const jsonStr = line.slice(6).trim();
            if (!jsonStr || jsonStr === "[DONE]") continue;

            try {
              const event = JSON.parse(jsonStr);

              if (event.type === "message") {
                accumulatedContent = event.content || accumulatedContent;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamMsgId
                      ? { ...m, content: accumulatedContent, isStreaming: true }
                      : m
                  )
                );
              } else if (event.type === "done") {
                // Finalize the message with metadata
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === streamMsgId
                      ? {
                          ...m,
                          content: accumulatedContent,
                          isStreaming: false,
                          metadata: {
                            model_used: event.model_used || "",
                            provider: event.provider || "",
                            latency_ms: event.latency_ms || 0,
                          },
                        }
                      : m
                  )
                );
              }
            } catch {
              // Not JSON, accumulate as raw text
              accumulatedContent += jsonStr;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamMsgId
                    ? { ...m, content: accumulatedContent, isStreaming: true }
                    : m
                )
              );
            }
          }
        }
      }

      // Ensure message is finalized
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamMsgId ? { ...m, isStreaming: false } : m
        )
      );
    } catch (err) {
      // If abort, just mark as stopped
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamMsgId ? { ...m, isStreaming: false } : m
          )
        );
      } else {
        // Fallback: try non-streaming endpoint
        try {
          const data = await apiFetch<{
            reply: string;
            model_used: string;
            provider: string;
            latency_ms: number;
          }>("/assistant/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: msg,
              project_id: projectId || undefined,
              context: undefined,
            }),
          });

          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamMsgId
                ? {
                    ...m,
                    content: data.reply,
                    isStreaming: false,
                    metadata: {
                      model_used: data.model_used,
                      provider: data.provider,
                      latency_ms: data.latency_ms,
                    },
                  }
                : m
            )
          );
        } catch (fallbackErr) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === streamMsgId
                ? {
                    ...m,
                    content: `Ошибка: ${fallbackErr instanceof Error ? fallbackErr.message : "Не удалось отправить сообщение"}`,
                    isStreaming: false,
                    role: "system",
                  }
                : m
            )
          );
        }
      }
    } finally {
      setIsSending(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [inputValue, isSending, projectId, apiFetch, token]);

  // --- Stop streaming ---
  const handleStopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

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
      setChatHistory([]);
      toast({ title: "История очищена" });
    } catch {
      // Silently clear local state
      setMessages([]);
      setChatHistory([]);
    }
  }, [projectId, apiFetch, toast]);

  // --- Handle Enter key ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendStream();
      }
    },
    [handleSendStream]
  );

  // --- Load more history ---
  const handleLoadMoreHistory = useCallback(() => {
    setHistoryLimit((prev) => prev + 50);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">AI-ассистент</h1>
          <p className="text-sm text-muted-foreground">
            Блок 7 • Спецификация 3.9 • SSE Streaming
          </p>
        </div>
        {pipeline.pipelineState && (
          <Badge variant="outline" className="ml-auto text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {pipeline.pipelineState.current_block
              ? `Блок ${pipeline.pipelineState.current_block}`
              : "Пайплайн готов"}
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs value={mainTab} onValueChange={setMainTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
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
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">История</span>
          </TabsTrigger>
        </TabsList>

        {/* ====================== CHAT TAB ====================== */}
        <TabsContent value="chat" className="mt-4">
          <Card className="flex flex-col animate-fade-in" style={{ height: "calc(100vh - 240px)", minHeight: "400px" }}>
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

              {isSending && !isStreaming && (
                <div className="flex gap-2 items-center text-sm text-muted-foreground" role="status" aria-busy="true">
                  <Bot className="h-5 w-5 text-primary animate-pulse-subtle" />
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
              {isStreaming ? (
                <Button
                  onClick={handleStopStream}
                  variant="destructive"
                  size="icon"
                  title="Остановить генерацию"
                  aria-label="Остановить генерацию"
                >
                  <span className="text-xs font-bold">&#9632;</span>
                </Button>
              ) : (
                <Button
                  onClick={handleSendStream}
                  disabled={isSending || !inputValue.trim()}
                  size="icon"
                  aria-label="Отправить сообщение"
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearHistory}
                title="Очистить историю"
                aria-label="Очистить историю чата"
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

        {/* ====================== HISTORY TAB ====================== */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  История чата
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  className="h-7 text-xs text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Очистить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {chatHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Нет сохранённых сообщений
                </p>
              ) : (
                <ChatHistoryList
                  messages={chatHistory}
                  onLoadMore={handleLoadMoreHistory}
                  hasMore={hasMoreHistory}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
