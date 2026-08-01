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
  Activity,
  Loader2,
  RefreshCw,
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
    usage: {
      input_tokens_path: "usage.input_tokens",
      output_tokens_path: "usage.output_tokens",
      total_tokens_path: "usage.total_tokens",
    },
  },
  capabilities: {
    json_mode: false,
    tools: false,
  },
  health: null,
  models: null,
  stream: null,
}, null, 2);

interface LlmIntrospectionResult {
  provider: string;
  configured_model: string | null;
  capabilities: {
    streaming: boolean;
    jsonMode: boolean;
    tools: boolean;
    modelDiscovery: boolean;
  };
  health: {
    status: "healthy" | "unavailable" | "unknown";
    latencyMs: number;
    checkedAt: string;
    reason?: string;
  };
  models: Array<{ id: string; label: string; ownedBy?: string | null }>;
  models_error: string | null;
}

interface LlmConfigResponse {
  id: string;
  adapter: string;
  label: string;
  base_url: string;
  model: string;
  secret_ref: string | null;
  secret_source: "none" | "environment" | "encrypted";
  config_json: unknown;
  secret_available: boolean;
  enabled: boolean;
}

interface LlmRouteForm {
  primaryId: string;
  primaryModel: string;
  fallbackId: string;
  fallbackModel: string;
  extraChain: Array<{ config_id: string; model: string | null }>;
  temperature: number | null;
  maxOutputTokens: number | null;
}

interface LlmTelemetryCall {
  id: string;
  stage: string;
  provider: string;
  model: string | null;
  status: "success" | "error";
  stream: boolean;
  latency_ms: number;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  usage_source: "provider" | "unavailable";
  error_class: string | null;
  created_at: string;
}

interface LlmTelemetryResponse {
  calls: LlmTelemetryCall[];
  summary: {
    window_size: number;
    successful: number;
    failed: number;
    average_latency_ms: number;
    known_token_calls: number;
    total_tokens: number;
  };
}

const LLM_ROUTE_STAGES = [
  ["default", "По умолчанию"],
  ["assistant", "AI-ассистент"],
  ["concept", "Concept"],
  ["core_loop", "Core Loop"],
  ["mda", "MDA"],
  ["balance", "Balance"],
  ["progression", "Progression"],
  ["economy", "Economy"],
  ["gdd", "GDD"],
  ["validation", "Validation"],
  ["prototype", "Prototype"],
] as const;

function emptyLlmConfig() {
  return {
    id: "",
    adapter: "openai-compatible",
    label: "OpenAI-compatible router",
    baseUrl: "",
    model: "",
    secretRef: "",
    apiKey: "",
    secretSource: "none" as "none" | "environment" | "encrypted",
    clearSecret: false,
    mapping: DEFAULT_GENERIC_MAPPING,
    enabled: true,
  };
}

function routeForm(primaryId = "builtin"): LlmRouteForm {
  return {
    primaryId,
    primaryModel: "",
    fallbackId: "none",
    fallbackModel: "",
    extraChain: [],
    temperature: null,
    maxOutputTokens: null,
  };
}

function initialRouteForms(): Record<string, LlmRouteForm> {
  return Object.fromEntries(LLM_ROUTE_STAGES.map(([stage]) => [stage, routeForm()])) as Record<string, LlmRouteForm>;
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user, apiFetch } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState({
    pipeline: true,
    aiAlerts: true,
    email: false,
  });
  const [llmConfig, setLlmConfig] = useState(emptyLlmConfig);
  const [llmConfigs, setLlmConfigs] = useState<LlmConfigResponse[]>([]);
  const [llmRoutes, setLlmRoutes] = useState<Record<string, LlmRouteForm>>(initialRouteForms);
  const [llmRoutesSaving, setLlmRoutesSaving] = useState(false);
  const [llmAdapters, setLlmAdapters] = useState<Array<{ id: string; label: string }>>([
    { id: "openai-compatible", label: "OpenAI-compatible" },
    { id: "generic-http", label: "Generic HTTP mapping" },
  ]);
  const [llmSecretAvailable, setLlmSecretAvailable] = useState<boolean | null>(null);
  const [llmEncryptionAvailable, setLlmEncryptionAvailable] = useState(false);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmInspecting, setLlmInspecting] = useState(false);
  const [llmIntrospection, setLlmIntrospection] = useState<LlmIntrospectionResult | null>(null);
  const [llmTelemetry, setLlmTelemetry] = useState<LlmTelemetryResponse | null>(null);
  const [llmTelemetryLoading, setLlmTelemetryLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    apiFetch<{
      adapters: Array<{ id: string; label: string }>;
      secret_encryption_available: boolean;
      configs?: LlmConfigResponse[];
      config: LlmConfigResponse | null;
      routes?: Array<{
        stage: string;
        chain: Array<{ config_id: string; model?: string | null }>;
        temperature: number | null;
        max_output_tokens: number | null;
      }>;
    }>("/settings/llm")
      .then(({ adapters, configs, config, routes, secret_encryption_available }) => {
        if (cancelled) return;
        if (adapters.length > 0) setLlmAdapters(adapters);
        setLlmEncryptionAvailable(secret_encryption_available);
        const loadedConfigs = configs ?? (config ? [config] : []);
        setLlmConfigs(loadedConfigs);
        const firstConfig = loadedConfigs[0] ?? null;
        const defaultPrimary = firstConfig?.id || "builtin";
        const forms = Object.fromEntries(LLM_ROUTE_STAGES.map(([stage]) => [
          stage,
          {
            ...routeForm(defaultPrimary),
            fallbackId: defaultPrimary === "builtin" ? "none" : "builtin",
          },
        ])) as Record<string, LlmRouteForm>;
        for (const route of routes ?? []) {
          const primary = route.chain[0];
          const fallback = route.chain[1];
          if (!primary || !forms[route.stage]) continue;
          forms[route.stage] = {
            primaryId: primary.config_id,
            primaryModel: primary.model || "",
            fallbackId: fallback?.config_id || "none",
            fallbackModel: fallback?.model || "",
            extraChain: route.chain.slice(2).map((entry) => ({
              config_id: entry.config_id,
              model: entry.model || null,
            })),
            temperature: route.temperature,
            maxOutputTokens: route.max_output_tokens,
          };
        }
        setLlmRoutes(forms);
        if (!firstConfig) return;
        const selected = firstConfig;
        setLlmConfig({
          id: selected.id,
          adapter: selected.adapter,
          label: selected.label,
          baseUrl: selected.base_url,
          model: selected.model,
          secretRef: selected.secret_ref || "",
          apiKey: "",
          secretSource: selected.secret_source,
          clearSecret: false,
          mapping: selected.config_json
            ? JSON.stringify(selected.config_json, null, 2)
            : DEFAULT_GENERIC_MAPPING,
          enabled: selected.enabled,
        });
        setLlmSecretAvailable(selected.secret_available);
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
    apiFetch<LlmTelemetryResponse>("/settings/llm/telemetry?limit=20")
      .then((result) => {
        if (!cancelled) setLlmTelemetry(result);
      })
      .catch(() => {
        if (!cancelled) setLlmTelemetry(null);
      })
      .finally(() => {
        if (!cancelled) setLlmTelemetryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch, toast, user]);

  async function refreshLlmTelemetry() {
    setLlmTelemetryLoading(true);
    try {
      setLlmTelemetry(await apiFetch<LlmTelemetryResponse>("/settings/llm/telemetry?limit=20"));
    } catch (error) {
      toast({
        title: "Не удалось загрузить телеметрию LLM",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLlmTelemetryLoading(false);
    }
  }

  function selectLlmConfig(configId: string) {
    const config = llmConfigs.find((item) => item.id === configId);
    if (!config) {
      setLlmConfig(emptyLlmConfig());
      setLlmSecretAvailable(null);
      setLlmIntrospection(null);
      return;
    }
    setLlmConfig({
      id: config.id,
      adapter: config.adapter,
      label: config.label,
      baseUrl: config.base_url,
      model: config.model,
      secretRef: config.secret_ref || "",
      apiKey: "",
      secretSource: config.secret_source,
      clearSecret: false,
      mapping: config.config_json ? JSON.stringify(config.config_json, null, 2) : DEFAULT_GENERIC_MAPPING,
      enabled: config.enabled,
    });
    setLlmSecretAvailable(config.secret_available);
    setLlmIntrospection(null);
  }

  async function saveLlmConfig() {
    setLlmSaving(true);
    try {
      const mapping = llmConfig.adapter !== "openai-compatible"
        ? JSON.parse(llmConfig.mapping)
        : null;
      const { config } = await apiFetch<{
        config: LlmConfigResponse;
      }>("/settings/llm", {
        method: "PUT",
        body: JSON.stringify({
          id: llmConfig.id || undefined,
          adapter: llmConfig.adapter,
          label: llmConfig.label,
          base_url: llmConfig.baseUrl,
          model: llmConfig.model,
          secret_ref: llmConfig.secretRef || null,
          api_key: llmConfig.apiKey || undefined,
          clear_secret: llmConfig.clearSecret,
          config_json: mapping,
          enabled: llmConfig.enabled,
        }),
      });
      setLlmConfigs((values) => {
        const existingIndex = values.findIndex((item) => item.id === config.id);
        if (existingIndex < 0) return [...values, config];
        return values.map((item) => item.id === config.id ? config : item);
      });
      setLlmSecretAvailable(config.secret_available);
      setLlmConfig((value) => ({
        ...value,
        id: config.id,
        apiKey: "",
        secretSource: config.secret_source,
        clearSecret: false,
      }));
      setLlmIntrospection(null);
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
    if (!llmConfig.id) return;
    setLlmSaving(true);
    try {
      const removedId = llmConfig.id;
      await apiFetch(`/settings/llm?id=${encodeURIComponent(removedId)}`, { method: "DELETE" });
      const remaining = llmConfigs.filter((config) => config.id !== removedId);
      setLlmConfigs(remaining);
      setLlmRoutes((routes) => Object.fromEntries(Object.entries(routes).map(([stage, route]) => [
        stage,
        {
          ...route,
          primaryId: route.primaryId === removedId ? "builtin" : route.primaryId,
          primaryModel: route.primaryId === removedId ? "" : route.primaryModel,
          fallbackId: route.fallbackId === removedId ? "none" : route.fallbackId,
          fallbackModel: route.fallbackId === removedId ? "" : route.fallbackModel,
          extraChain: route.extraChain.filter((entry) => entry.config_id !== removedId),
        },
      ])) as Record<string, LlmRouteForm>);
      if (remaining[0]) selectLlmConfig(remaining[0].id);
      else {
        setLlmConfig(emptyLlmConfig());
        setLlmSecretAvailable(null);
      }
      setLlmIntrospection(null);
      toast({ title: "LLM-router удалён" });
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

  async function inspectLlmConfig() {
    setLlmInspecting(true);
    try {
      const result = await apiFetch<LlmIntrospectionResult>("/settings/llm/introspect", {
        method: "POST",
        body: JSON.stringify({ config_id: llmConfig.id || undefined }),
      });
      setLlmIntrospection(result);
      if (result.health.status === "unavailable") {
        toast({
          title: "LLM-router недоступен",
          description: `Проверка завершилась со статусом ${result.health.reason || "request_failed"}`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Проверка LLM-router завершена" });
      }
    } catch (error) {
      setLlmIntrospection(null);
      toast({
        title: "Не удалось проверить LLM-router",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLlmInspecting(false);
    }
  }

  async function saveLlmRoutes() {
    setLlmRoutesSaving(true);
    try {
      const routes = LLM_ROUTE_STAGES.map(([stage]) => {
        const route = llmRoutes[stage];
        const chain = [{ config_id: route.primaryId, model: route.primaryModel || null }];
        if (route.fallbackId !== "none") {
          chain.push({ config_id: route.fallbackId, model: route.fallbackModel || null });
        }
        chain.push(...route.extraChain);
        return {
          stage,
          chain,
          temperature: route.temperature,
          max_output_tokens: route.maxOutputTokens,
        };
      });
      await apiFetch("/settings/llm/routes", {
        method: "PUT",
        body: JSON.stringify({ routes }),
      });
      toast({ title: "Маршруты LLM сохранены" });
    } catch (error) {
      toast({
        title: "Не удалось сохранить маршруты LLM",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLlmRoutesSaving(false);
    }
  }

  function updateLlmRoute(stage: string, patch: Partial<LlmRouteForm>) {
    setLlmRoutes((routes) => ({
      ...routes,
      [stage]: { ...routes[stage], ...patch },
    }));
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
                <div className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                  <div className="min-w-64 flex-1 space-y-2">
                    <Label htmlFor="llm-connection">Подключение</Label>
                    <select
                      id="llm-connection"
                      value={llmConfig.id || "new"}
                      onChange={(event) => selectLlmConfig(event.target.value)}
                      className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      {!llmConfig.id && <option value="new">Новое подключение</option>}
                      {llmConfigs.map((config) => (
                        <option key={config.id} value={config.id}>{config.label} · {config.model}</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" variant="outline" onClick={() => selectLlmConfig("new")}>
                    Новое подключение
                  </Button>
                </div>
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
                      list="llm-discovered-models"
                      value={llmConfig.model}
                      onChange={(event) => setLlmConfig((value) => ({ ...value, model: event.target.value }))}
                      placeholder="openai/gpt-4.1-mini"
                    />
                    <datalist id="llm-discovered-models">
                      {llmIntrospection?.models.map((model) => (
                        <option key={model.id} value={model.id}>{model.label}</option>
                      ))}
                    </datalist>
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
                    onChange={(event) => setLlmConfig((value) => ({
                      ...value,
                      secretRef: event.target.value,
                      apiKey: "",
                      clearSecret: false,
                    }))}
                    placeholder="env:OPENROUTER_API_KEY"
                    autoComplete="off"
                  />
                  <p className="text-xs text-muted-foreground">
                    Вариант для deployment: укажите имя переменной окружения, не значение ключа.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="llm-api-key">API-ключ для шифрованного хранения</Label>
                  <Input
                    id="llm-api-key"
                    type="password"
                    value={llmConfig.apiKey}
                    onChange={(event) => setLlmConfig((value) => ({
                      ...value,
                      apiKey: event.target.value,
                      secretRef: "",
                      clearSecret: false,
                    }))}
                    placeholder={llmConfig.secretSource === "encrypted"
                      ? "Оставьте пустым, чтобы сохранить текущий ключ"
                      : "Вставьте API-ключ"}
                    autoComplete="new-password"
                    disabled={!llmEncryptionAvailable}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ключ шифруется AES-256-GCM на сервере; обратно в интерфейс он не возвращается.
                  </p>
                  {!llmEncryptionAvailable && (
                    <p className="text-xs text-destructive">
                      Задайте серверную переменную <code>GIDEDE_LLM_SECRETS_KEY</code>, чтобы включить хранение ключей.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {llmConfig.clearSecret ? (
                      <Badge variant="destructive">Секрет будет удалён после сохранения</Badge>
                    ) : llmConfig.secretSource !== "none" && (
                      <Badge variant={llmSecretAvailable ? "secondary" : "destructive"}>
                        {llmConfig.secretSource === "encrypted"
                          ? "Зашифрованный ключ сохранён"
                          : "Используется environment reference"}
                        {!llmSecretAvailable && " — недоступен"}
                      </Badge>
                    )}
                    {(llmConfig.secretSource !== "none" || llmConfig.secretRef || llmConfig.apiKey) && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setLlmConfig((value) => ({
                          ...value,
                          secretRef: "",
                          apiKey: "",
                          clearSecret: true,
                        }))}
                      >
                        Очистить секрет
                      </Button>
                    )}
                  </div>
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
                {llmIntrospection && (
                  <div className="space-y-3 rounded-lg border p-3" aria-live="polite">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{llmIntrospection.provider}</span>
                      </div>
                      <Badge variant={llmIntrospection.health.status === "healthy"
                        ? "default"
                        : llmIntrospection.health.status === "unavailable"
                          ? "destructive"
                          : "secondary"}
                      >
                        {llmIntrospection.health.status} · {llmIntrospection.health.latencyMs} ms
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {([
                        ["Streaming", llmIntrospection.capabilities.streaming],
                        ["JSON mode", llmIntrospection.capabilities.jsonMode],
                        ["Tools", llmIntrospection.capabilities.tools],
                        ["Model discovery", llmIntrospection.capabilities.modelDiscovery],
                      ] as const).map(([label, supported]) => (
                        <Badge key={label} variant={supported ? "secondary" : "outline"}>
                          {supported ? "✓" : "—"} {label}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {llmIntrospection.models.length > 0
                        ? `Доступно моделей: ${llmIntrospection.models.length}. Список подключён к полю «Модель».`
                        : llmIntrospection.models_error
                          ? "Provider заявил discovery, но список моделей получить не удалось."
                          : "Adapter не предоставил отдельный список моделей."}
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={saveLlmConfig}
                    disabled={llmSaving || !llmConfig.label.trim() || !llmConfig.baseUrl.trim() || !llmConfig.model.trim()}
                  >
                    {llmSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить router
                  </Button>
                  <Button
                    variant="outline"
                    onClick={inspectLlmConfig}
                    disabled={llmSaving || llmInspecting || !llmConfig.id}
                  >
                    {llmInspecting
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <RefreshCw className="mr-2 h-4 w-4" />}
                    Проверить сохранённый router
                  </Button>
                  <Button variant="outline" onClick={removeLlmConfig} disabled={llmSaving || !llmConfig.id}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </Button>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold">Маршрутизация по стадиям</h3>
                    <p className="text-xs text-muted-foreground">
                      Fallback используется только для временных network/timeout/429/5xx ошибок и только до первого stream chunk.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {LLM_ROUTE_STAGES.map(([stage, label]) => {
                      const route = llmRoutes[stage];
                      return (
                        <div key={stage} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[9rem_1fr_1fr]">
                          <div className="self-center text-sm font-medium">{label}</div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select
                              aria-label={`${label}: primary provider`}
                              value={route.primaryId}
                              onChange={(event) => updateLlmRoute(stage, {
                                primaryId: event.target.value,
                                primaryModel: "",
                              })}
                              className="border-input bg-background h-9 rounded-md border px-2 text-xs"
                            >
                              <option value="builtin">Built-in ZAI</option>
                              {llmConfigs.map((config) => (
                                <option key={config.id} value={config.id}>
                                  {config.label}{config.enabled ? "" : " (отключён)"}
                                </option>
                              ))}
                            </select>
                            <Input
                              aria-label={`${label}: primary model`}
                              value={route.primaryModel}
                              onChange={(event) => updateLlmRoute(stage, { primaryModel: event.target.value })}
                              placeholder={route.primaryId === "builtin"
                                ? "glm-4.6"
                                : llmConfigs.find((config) => config.id === route.primaryId)?.model || "model"}
                              className="text-xs"
                            />
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <select
                              aria-label={`${label}: fallback provider`}
                              value={route.fallbackId}
                              onChange={(event) => updateLlmRoute(stage, {
                                fallbackId: event.target.value,
                                fallbackModel: "",
                              })}
                              className="border-input bg-background h-9 rounded-md border px-2 text-xs"
                            >
                              <option value="none">Без fallback</option>
                              <option value="builtin">Built-in ZAI</option>
                              {llmConfigs.map((config) => (
                                <option key={config.id} value={config.id}>
                                  {config.label}{config.enabled ? "" : " (отключён)"}
                                </option>
                              ))}
                            </select>
                            <Input
                              aria-label={`${label}: fallback model`}
                              value={route.fallbackModel}
                              onChange={(event) => updateLlmRoute(stage, { fallbackModel: event.target.value })}
                              placeholder={route.fallbackId === "none"
                                ? "—"
                                : route.fallbackId === "builtin"
                                  ? "glm-4.6"
                                  : llmConfigs.find((config) => config.id === route.fallbackId)?.model || "model"}
                              disabled={route.fallbackId === "none"}
                              className="text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <Button onClick={saveLlmRoutes} disabled={llmRoutesSaving}>
                    {llmRoutesSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Сохранить маршруты
                  </Button>
                </div>
                <Separator />
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold">Телеметрия LLM-вызовов</h3>
                      <p className="text-xs text-muted-foreground">
                        Только технические metadata; prompts, ответы и секреты не сохраняются.
                      </p>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={refreshLlmTelemetry} disabled={llmTelemetryLoading}>
                      {llmTelemetryLoading
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : <RefreshCw className="mr-2 h-4 w-4" />}
                      Обновить
                    </Button>
                  </div>
                  {llmTelemetry && (
                    <>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="secondary">Вызовов: {llmTelemetry.summary.window_size}</Badge>
                        <Badge variant="secondary">Успешно: {llmTelemetry.summary.successful}</Badge>
                        <Badge variant={llmTelemetry.summary.failed > 0 ? "destructive" : "secondary"}>
                          Ошибок: {llmTelemetry.summary.failed}
                        </Badge>
                        <Badge variant="outline">Средняя latency: {llmTelemetry.summary.average_latency_ms} ms</Badge>
                        <Badge variant="outline">Tokens: {llmTelemetry.summary.total_tokens}</Badge>
                      </div>
                      <div className="space-y-2">
                        {llmTelemetry.calls.length === 0 ? (
                          <p className="text-xs text-muted-foreground">LLM-вызовов пока нет.</p>
                        ) : llmTelemetry.calls.map((call) => (
                          <div key={call.id} className="grid gap-1 rounded-lg border p-3 text-xs md:grid-cols-[7rem_1fr_1fr_auto]">
                            <div>
                              <Badge variant={call.status === "success" ? "secondary" : "destructive"}>
                                {call.stage} · {call.status}
                              </Badge>
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium">{call.provider}</div>
                              <div className="truncate text-muted-foreground">{call.model || "model unknown"}</div>
                            </div>
                            <div className="text-muted-foreground">
                              <div>{call.latency_ms} ms · {call.stream ? "stream" : "completion"}</div>
                              <div>
                                tokens: {call.total_tokens ?? "—"}
                                {call.usage_source === "unavailable" ? " (provider не сообщил)" : ""}
                              </div>
                            </div>
                            <div className="text-right text-muted-foreground">
                              <div>{call.error_class || "ok"}</div>
                              <div>{new Date(call.created_at).toLocaleString("ru-RU")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
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
