"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  User,
  Zap,
  Shield,
  Bell,
  Mail,
  CheckCircle2,
  Cpu,
  Loader2,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const THEME_OPTIONS = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Системная", icon: Monitor },
] as const;

const DEFAULT_GENERIC_MAPPING = JSON.stringify({
  auth_header: "Authorization",
  auth_scheme: "Bearer",
  static_headers: {},
  static_body: {},
  request: {
    model_path: "model",
    messages_path: "messages",
    messages_format: "messages",
    stream_path: "stream",
    temperature_path: "temperature",
    max_tokens_path: "max_tokens",
  },
  response: {
    content_path: "result.text",
    model_path: "result.model",
  },
  stream: null,
}, null, 2);

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    pipeline: true,
    aiAlerts: true,
    email: false,
  });
  const [llmConfig, setLlmConfig] = useState({
    adapter: "openai-compatible",
    label: "OpenAI-compatible router",
    baseUrl: "",
    model: "",
    secretRef: "",
    mapping: DEFAULT_GENERIC_MAPPING,
    enabled: true,
  });
  const [llmAdapters, setLlmAdapters] = useState<Array<{ id: string; label: string }>>([
    { id: "openai-compatible", label: "OpenAI-compatible" },
    { id: "generic-http", label: "Generic HTTP mapping" },
  ]);
  const [llmSecretAvailable, setLlmSecretAvailable] = useState<boolean | null>(null);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmSaving, setLlmSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<{
      adapters: Array<{ id: string; label: string }>;
      config: null | {
        adapter: string;
        label: string;
        base_url: string;
        model: string;
        secret_ref: string | null;
        config_json: unknown;
        secret_available: boolean;
        enabled: boolean;
      };
    }>("/settings/llm")
      .then(({ adapters, config }) => {
        if (cancelled) return;
        if (adapters.length > 0) setLlmAdapters(adapters);
        if (!config) return;
        setLlmConfig({
          adapter: config.adapter,
          label: config.label,
          baseUrl: config.base_url,
          model: config.model,
          secretRef: config.secret_ref || "",
          mapping: config.config_json
            ? JSON.stringify(config.config_json, null, 2)
            : DEFAULT_GENERIC_MAPPING,
          enabled: config.enabled,
        });
        setLlmSecretAvailable(config.secret_available);
      })
      .catch((error) => {
        if (!cancelled) {
          toast({
            title: "Не удалось загрузить LLM-настройки",
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLlmLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, toast, user]);

  async function saveLlmConfig() {
    setLlmSaving(true);
    try {
      const mapping = llmConfig.adapter !== "openai-compatible"
        ? JSON.parse(llmConfig.mapping)
        : null;
      const { config } = await apiFetch<{
        config: { secret_available: boolean };
      }>("/settings/llm", {
        method: "PUT",
        body: JSON.stringify({
          adapter: llmConfig.adapter,
          label: llmConfig.label,
          base_url: llmConfig.baseUrl,
          model: llmConfig.model,
          secret_ref: llmConfig.secretRef || null,
          config_json: mapping,
          enabled: llmConfig.enabled,
        }),
      });
      setLlmSecretAvailable(config.secret_available);
      toast({ title: "LLM-router сохранён" });
    } catch (error) {
      toast({
        title: "Не удалось сохранить LLM-router",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLlmSaving(false);
    }
  }

  async function removeLlmConfig() {
    setLlmSaving(true);
    try {
      await apiFetch("/settings/llm", { method: "DELETE" });
      setLlmConfig({
        adapter: "openai-compatible",
        label: "OpenAI-compatible router",
        baseUrl: "",
        model: "",
        secretRef: "",
        mapping: DEFAULT_GENERIC_MAPPING,
        enabled: true,
      });
      setLlmSecretAvailable(null);
      toast({ title: "Пользовательский LLM-router отключён" });
    } catch (error) {
      toast({
        title: "Не удалось удалить LLM-router",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLlmSaving(false);
    }
  }

  const aiUsagePercent = user
    ? Math.min(100, Math.round((user.ai_calls_count / user.ai_calls_limit) * 100))
    : 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Настройки</h1>
          <p className="text-sm text-muted-foreground">
            Управление темой, уведомлениями и аккаунтом
          </p>
        </div>
      </div>

      {/* Theme settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            Внешний вид
          </CardTitle>
          <CardDescription>Выберите цветовую тему интерфейса</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map((opt) => {
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <opt.icon
                    className={`h-6 w-6 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </span>
                  {isActive && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Аккаунт
          </CardTitle>
          <CardDescription>Информация о пользователе</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {(user.name || user.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{user.name || "Пользователь"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={user.plan === "pro" ? "default" : "secondary"}
                  className="uppercase"
                >
                  {user.plan}
                </Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Дата регистрации</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Статус</p>
                  <p className="font-medium flex items-center gap-1">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    {user.is_active ? "Активен" : "Заблокирован"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Войдите в аккаунт для просмотра информации.
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI usage */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Использование AI
            </CardTitle>
            <CardDescription>
              Лимит AI-запросов для вашего тарифа
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Использовано</span>
              <span className="font-medium">
                {user.ai_calls_count} / {user.ai_calls_limit} запросов
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                style={{ width: `${aiUsagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {user.ai_calls_limit - user.ai_calls_count} запросов осталось до
              сброса (ежедневно)
            </p>
            {user.plan === "free" && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Хотите больше запросов?
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Обновитесь до тарифа Pro для 500 запросов в день.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              LLM-router
            </CardTitle>
            <CardDescription>
              Подключите OpenAI-compatible, декларативный HTTP или специализированный adapter
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {llmLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Загрузка конфигурации…
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="llm-adapter">Тип адаптера</Label>
                    <select
                      id="llm-adapter"
                      value={llmConfig.adapter}
                      onChange={(event) => setLlmConfig((value) => ({ ...value, adapter: event.target.value }))}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      {llmAdapters.map((adapter) => (
                        <option key={adapter.id} value={adapter.id}>{adapter.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="llm-label">Название</Label>
                    <Input
                      id="llm-label"
                      value={llmConfig.label}
                      onChange={(event) => setLlmConfig((value) => ({ ...value, label: event.target.value }))}
                      placeholder="OpenRouter"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="llm-model">Модель</Label>
                    <Input
                      id="llm-model"
                      value={llmConfig.model}
                      onChange={(event) => setLlmConfig((value) => ({ ...value, model: event.target.value }))}
                      placeholder="openai/gpt-4.1-mini"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm-base-url">Base URL</Label>
                  <Input
                    id="llm-base-url"
                    value={llmConfig.baseUrl}
                    onChange={(event) => setLlmConfig((value) => ({ ...value, baseUrl: event.target.value }))}
                    placeholder={llmConfig.adapter === "generic-http"
                      ? "https://router.example/generate"
                      : "https://openrouter.ai/api/v1"}
                  />
                  {llmConfig.adapter === "generic-http" && (
                    <p className="text-xs text-muted-foreground">
                      Для Generic HTTP укажите полный URL вызываемого endpoint.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm-secret-ref">Ссылка на серверный секрет</Label>
                  <Input
                    id="llm-secret-ref"
                    value={llmConfig.secretRef}
                    onChange={(event) => setLlmConfig((value) => ({ ...value, secretRef: event.target.value }))}
                    placeholder="env:OPENROUTER_API_KEY"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Укажите имя переменной окружения. Сам API-ключ не отправляется в браузер и не хранится в базе.
                  </p>
                  {llmSecretAvailable !== null && (
                    <Badge variant={llmSecretAvailable ? "secondary" : "destructive"}>
                      {llmSecretAvailable ? "Секрет доступен серверу" : "Переменная окружения не найдена"}
                    </Badge>
                  )}
                </div>
                {llmConfig.adapter !== "openai-compatible" && (
                  <div className="space-y-2">
                    <Label htmlFor="llm-mapping">Конфигурация адаптера (JSON)</Label>
                    <Textarea
                      id="llm-mapping"
                      value={llmConfig.mapping}
                      onChange={(event) => setLlmConfig((value) => ({ ...value, mapping: event.target.value }))}
                      className="min-h-80 font-mono text-xs"
                      spellCheck={false}
                    />
                    {llmConfig.adapter === "generic-http" && (
                      <p className="text-xs text-muted-foreground">
                        Dot paths задают поля request/response. Для потоков поддерживаются SSE и NDJSON;
                        без секции <code>stream</code> ответ возвращается одним chunk.
                      </p>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="llm-enabled">Использовать этот router</Label>
                    <p className="text-xs text-muted-foreground">
                      При отключении приложение вернётся к встроенному provider/fallback.
                    </p>
                  </div>
                  <Switch
                    id="llm-enabled"
                    checked={llmConfig.enabled}
                    onCheckedChange={(enabled) => setLlmConfig((value) => ({ ...value, enabled }))}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={saveLlmConfig}
                    disabled={llmSaving || !llmConfig.label.trim() || !llmConfig.baseUrl.trim() || !llmConfig.model.trim()}
                  >
                    {llmSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить router
                  </Button>
                  <Button variant="outline" onClick={removeLlmConfig} disabled={llmSaving || !llmConfig.baseUrl}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Уведомления
          </CardTitle>
          <CardDescription>
            Управление уведомлениями системы
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notif-pipeline" className="text-sm font-medium">
                Stale-данные пайплайна
              </Label>
              <p className="text-xs text-muted-foreground">
                Уведомлять об устаревших данных в блоках
              </p>
            </div>
            <Switch
              id="notif-pipeline"
              checked={notifications.pipeline}
              onCheckedChange={(v) =>
                setNotifications((n) => ({ ...n, pipeline: v }))
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notif-ai" className="text-sm font-medium">
                AI-предупреждения
              </Label>
              <p className="text-xs text-muted-foreground">
                Проактивные подсказки от AI-ассистента
              </p>
            </div>
            <Switch
              id="notif-ai"
              checked={notifications.aiAlerts}
              onCheckedChange={(v) =>
                setNotifications((n) => ({ ...n, aiAlerts: v }))
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notif-email" className="text-sm font-medium">
                Email-уведомления
              </Label>
              <p className="text-xs text-muted-foreground">
                Отчёты и новости на почту
              </p>
            </div>
            <Switch
              id="notif-email"
              checked={notifications.email}
              onCheckedChange={(v) =>
                setNotifications((n) => ({ ...n, email: v }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">О приложении</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex justify-between">
            <span>Версия</span>
            <span className="font-mono font-medium text-foreground">v0.51.0</span>
          </div>
          <div className="flex justify-between">
            <span>Фреймворк</span>
            <span className="font-medium text-foreground">Next.js 16</span>
          </div>
          <div className="flex justify-between">
            <span>Backend</span>
            <span className="font-medium text-foreground">Next.js API Routes</span>
          </div>
          <div className="flex justify-between">
            <span>База данных</span>
            <span className="font-medium text-foreground">SQLite (Prisma)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
