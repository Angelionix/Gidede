"use client";

import React, { useState, useCallback, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Puzzle,
  ArrowUpFromLine,
  ArrowDownToLine,
  Wifi,
  History,
  Settings,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  ArrowRightLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";

// ============================================================
// Types
// ============================================================

interface GBEConnectionStatus {
  connected: boolean;
  base_url: string;
  is_mock: boolean;
  gbe_version: string | null;
  latency_ms: number;
  message: string;
}

interface GBESyncResult {
  sync_id: string;
  direction: "to_gbe" | "from_gbe";
  status: "synced" | "synced_with_warnings" | "failed";
  components_synced: string[];
  components_skipped: string[];
  warnings: string[];
  conflicts: Record<string, unknown>[];
  timestamp: string;
  latency_ms: number;
}

interface GBEWebhookResult {
  acknowledged: boolean;
  event_type: string;
  action_taken: string;
  message: string;
  timestamp: string;
}

interface SyncHistoryEntry {
  sync_id: string;
  direction: string;
  components_synced: string[];
  timestamp: string;
}

type SyncDirection = "bidirectional" | "to_gbe" | "from_gbe";

const ENTITY_OPTIONS = [
  { id: "concept", label: "Концепция (Concept)" },
  { id: "core_loop", label: "Core Loop" },
  { id: "mda_profile", label: "MDA-профиль" },
  { id: "balance_result", label: "Балансировка" },
  { id: "progression_profile", label: "Прогрессия" },
  { id: "economy_profile", label: "Экономика" },
] as const;

const WEBHOOK_EVENT_TYPES = [
  { value: "blueprint.updated", label: "Blueprint Updated" },
  { value: "diagram.changed", label: "Diagram Changed" },
  { value: "sync.requested", label: "Sync Requested" },
  { value: "lint.completed", label: "Lint Completed" },
] as const;

// ============================================================
// Status color helper
// ============================================================

function statusBadge(status: string) {
  switch (status) {
    case "synced":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "synced_with_warnings":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "failed":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function directionLabel(dir: string): string {
  switch (dir) {
    case "to_gbe":
      return "Gidede → GBE";
    case "from_gbe":
      return "GBE → Gidede";
    default:
      return dir;
  }
}

// ============================================================
// Main Block 8 Page — GBE (GDCombine) Integration
// ============================================================

export default function Block8Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Connection state ---
  const [baseUrl, setBaseUrl] = useState("https://gbe.example.com/api/v1");
  const [apiKey, setApiKey] = useState("");
  const [connectionStatus, setConnectionStatus] =
    useState<GBEConnectionStatus | null>(null);
  const [isTestingConnection, setIsTestingConnection] = useState(false);

  // --- Sync state ---
  const [syncResult, setSyncResult] = useState<GBESyncResult | null>(null);
  const [isSyncingTo, setIsSyncingTo] = useState(false);
  const [isSyncingFrom, setIsSyncingFrom] = useState(false);

  // --- History state ---
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // --- Settings state ---
  const [syncDirection, setSyncDirection] =
    useState<SyncDirection>("bidirectional");
  const [enabledEntities, setEnabledEntities] = useState<string[]>([
    "concept",
    "core_loop",
    "mda_profile",
    "balance_result",
    "progression_profile",
    "economy_profile",
  ]);
  const [webhookEventType, setWebhookEventType] = useState(
    "blueprint.updated"
  );
  const [webhookProjectId, setWebhookProjectId] = useState("");
  const [webhookComponent, setWebhookComponent] = useState("blueprint");
  const [webhookResult, setWebhookResult] = useState<GBEWebhookResult | null>(
    null
  );
  const [isWebhookSending, setIsWebhookSending] = useState(false);

  // --- Load sync history on mount ---
  useEffect(() => {
    loadSyncHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================
  // API calls
  // ============================================================

  const handleTestConnection = useCallback(async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const body: Record<string, string> = {};
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;

      const data = await apiFetch<GBEConnectionStatus>(
        "/gbe/test-connection",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      setConnectionStatus(data);
      toast({
        title: data.connected
          ? "Подключение установлено"
          : "Не удалось подключиться",
        description: data.message,
        variant: data.connected ? "default" : "destructive",
      });
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : "Неизвестная ошибка";
      setConnectionStatus({
        connected: false,
        base_url: baseUrl,
        is_mock: true,
        gbe_version: null,
        latency_ms: 0,
        message: `Ошибка: ${errorMsg}`,
      });
      toast({
        title: "Ошибка подключения",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsTestingConnection(false);
    }
  }, [baseUrl, apiKey, apiFetch, toast]);

  const handleSyncTo = useCallback(async () => {
    setIsSyncingTo(true);
    setSyncResult(null);
    try {
      // Build project state from localStorage or mock
      const projectState = buildProjectState();
      const body: Record<string, unknown> = { project_state: projectState };
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;

      const data = await apiFetch<GBESyncResult>("/gbe/sync-to", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSyncResult(data);
      toast({
        title: "Экспорт завершён",
        description: `Синхронизировано компонентов: ${data.components_synced.length}`,
      });
      // Refresh history
      loadSyncHistory();
    } catch (err) {
      toast({
        title: "Ошибка экспорта",
        description:
          err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsSyncingTo(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, apiKey, apiFetch, toast]);

  const handleSyncFrom = useCallback(async () => {
    setIsSyncingFrom(true);
    setSyncResult(null);
    try {
      // Build sample GBE data for import
      const gbeData = buildGBEData();
      const body: Record<string, unknown> = { gbe_data: gbeData };
      if (baseUrl) body.base_url = baseUrl;
      if (apiKey) body.api_key = apiKey;

      const data = await apiFetch<GBESyncResult>("/gbe/sync-from", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSyncResult(data);
      toast({
        title: "Импорт завершён",
        description: `Синхронизировано компонентов: ${data.components_synced.length}`,
      });
      // Refresh history
      loadSyncHistory();
    } catch (err) {
      toast({
        title: "Ошибка импорта",
        description:
          err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsSyncingFrom(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl, apiKey, apiFetch, toast]);

  const loadSyncHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const data = await apiFetch<{
        history: SyncHistoryEntry[];
        total: number;
        limit: number;
      }>("/gbe/sync-history?limit=20");
      setSyncHistory(data.history || []);
    } catch {
      // Silently ignore — history is optional
    } finally {
      setIsHistoryLoading(false);
    }
  }, [apiFetch]);

  const handleSendWebhook = useCallback(async () => {
    setIsWebhookSending(true);
    setWebhookResult(null);
    try {
      const data = await apiFetch<GBEWebhookResult>("/gbe/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type: webhookEventType,
          project_id: webhookProjectId || "demo-project",
          component: webhookComponent,
          changed_fields: [],
          data: null,
        }),
      });
      setWebhookResult(data);
      toast({
        title: data.acknowledged
          ? "Вебхук обработан"
          : "Вебхук не обработан",
        description: data.message,
      });
    } catch (err) {
      toast({
        title: "Ошибка вебхука",
        description:
          err instanceof Error ? err.message : "Неизвестная ошибка",
        variant: "destructive",
      });
    } finally {
      setIsWebhookSending(false);
    }
  }, [webhookEventType, webhookProjectId, webhookComponent, apiFetch, toast]);

  // ============================================================
  // Helpers: build sample data
  // ============================================================

  function buildProjectState(): Record<string, unknown> {
    // Try to get real project data from localStorage
    const state: Record<string, unknown> = {};

    if (enabledEntities.includes("concept")) {
      try {
        const concept = localStorage.getItem("gidede_block_1_data");
        state.concept = concept ? JSON.parse(concept) : {
          title: "Мой игровой проект",
          genre: "RPG",
          logline: "Эпическое приключение в открытом мире",
          target_audience: ["core_gamers", "rpg_fans"],
          platforms: ["pc", "console"],
        };
      } catch {
        state.concept = {
          title: "Мой игровой проект",
          genre: "RPG",
          logline: "Эпическое приключение в открытом мире",
        };
      }
    }

    if (enabledEntities.includes("core_loop")) {
      state.core_loop = {
        structural_type: "RPG Loop",
        phases: ["exploration", "combat", "loot", "upgrade"],
      };
    }

    if (enabledEntities.includes("mda_profile")) {
      state.mda_profile = {
        mechanics: ["crafting", "leveling", "quest_system"],
        dynamics: ["emergent_gameplay", "player_choice"],
        aesthetics: ["achievement", "narrative", "challenge"],
      };
    }

    if (enabledEntities.includes("balance_result")) {
      state.balance_result = {
        balance_type: "transitive",
        elements: [
          { name: "sword_wooden", cost: 10, power: 5 },
          { name: "sword_iron", cost: 50, power: 25 },
        ],
      };
    }

    if (enabledEntities.includes("progression_profile")) {
      state.progression_profile = {
        total_levels: 50,
        curve_type: "exponential",
        tiers: [{ name: "beginner", levels: 10 }],
      };
    }

    if (enabledEntities.includes("economy_profile")) {
      state.economy_profile = {
        economy_type: "engine",
        resources: [{ name: "gold", type: "currency" }],
        faucet_drain_ratios: { gold: 1.2 },
      };
    }

    return state;
  }

  function buildGBEData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (enabledEntities.includes("concept")) {
      data.blueprint = {
        name: "GBE Imported Project",
        genre: "Strategy",
        description: "Проект, импортированный из GDCombine",
        target_audience: ["strategy_fans"],
        platforms: ["pc"],
        team_size: "medium",
      };
    }

    if (enabledEntities.includes("mda_profile")) {
      data.mda_model = {
        mechanics: ["resource_management", "unit_control"],
        dynamics: ["strategic_depth", "timing"],
        aesthetics: ["challenge", "submission"],
      };
    }

    if (enabledEntities.includes("balance_result")) {
      data.balance_report = {
        balance_type: "intransitive",
        elements: [
          { name: "unit_scout", cost: 50, power: 15, ratio: 0.3 },
          { name: "unit_tank", cost: 200, power: 80, ratio: 0.4 },
        ],
      };
    }

    if (enabledEntities.includes("progression_profile")) {
      data.progression_model = {
        total_levels: 30,
        curve_type: "step",
        tiers: [{ name: "bronze", levels: 10 }],
      };
    }

    if (enabledEntities.includes("economy_profile")) {
      data.economy_model = {
        economy_type: "economy",
        resources: [{ name: "minerals", type: "resource" }],
      };
    }

    return data;
  }

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Puzzle className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Интеграция GBE</h1>
          <p className="text-sm text-muted-foreground">
            Блок 8 • GDCombine API Bridge
          </p>
        </div>
        <Badge
          className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800"
          variant="outline"
        >
          MOCK-режим
        </Badge>
        {pipeline.pipelineState && (
          <Badge variant="outline" className="text-xs">
            Пайплайн: блок {pipeline.pipelineState.current_block || "—"}
          </Badge>
        )}
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="connection">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="connection" className="flex items-center gap-1.5">
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Подключение</span>
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Синхронизация</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">История</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Настройки</span>
          </TabsTrigger>
        </TabsList>

        {/* ====================== CONNECTION TAB ====================== */}
        <TabsContent value="connection" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="h-5 w-5 text-primary" />
                Подключение к GBE (GDCombine)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mock mode warning */}
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Mock-режим:</span> Реальное
                    подключение к GDCombine API будет доступно после
                    стабилизации GBE API (Фаза 4.E). Все операции выполняются
                    с моковыми данными.
                  </div>
                </div>
              </div>

              {/* Connection fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">GBE Base URL</label>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://gbe.example.com/api/v1"
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Базовый URL GDCombine API инстанса
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">API Key</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="gbe_api_key_xxx..."
                    className="text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Ключ авторизации (необязательно для mock-режима)
                  </p>
                </div>
              </div>

              {/* Test button */}
              <Button
                onClick={handleTestConnection}
                disabled={isTestingConnection}
                className="w-full sm:w-auto"
              >
                {isTestingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Wifi className="h-4 w-4 mr-2" />
                )}
                Проверить подключение
              </Button>

              {/* Connection result */}
              {connectionStatus && (
                <>
                  <Separator />
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex items-center gap-3">
                      {/* Status indicator */}
                      <div
                        className={`h-3 w-3 rounded-full shrink-0 ${
                          connectionStatus.connected
                            ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]"
                            : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {connectionStatus.connected
                          ? "Подключено"
                          : "Не подключено"}
                      </span>
                      {connectionStatus.is_mock && (
                        <Badge
                          variant="outline"
                          className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]"
                        >
                          MOCK
                        </Badge>
                      )}
                    </div>

                    {/* Details grid */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Card className="py-2">
                        <CardContent className="px-3 py-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Base URL
                          </p>
                          <p className="text-xs font-mono mt-0.5 break-all">
                            {connectionStatus.base_url}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="py-2">
                        <CardContent className="px-3 py-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Версия GBE
                          </p>
                          <p className="text-xs font-mono mt-0.5">
                            {connectionStatus.gbe_version || "—"}
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="py-2">
                        <CardContent className="px-3 py-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Задержка
                          </p>
                          <p className="text-xs font-mono mt-0.5">
                            {connectionStatus.latency_ms} мс
                          </p>
                        </CardContent>
                      </Card>
                      <Card className="py-2">
                        <CardContent className="px-3 py-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                            Режим
                          </p>
                          <p className="text-xs mt-0.5">
                            {connectionStatus.is_mock
                              ? "Mock (заглушка)"
                              : "Production"}
                          </p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Message */}
                    {connectionStatus.message && (
                      <p className="text-xs text-muted-foreground italic">
                        {connectionStatus.message}
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== SYNC TAB ====================== */}
        <TabsContent value="sync" className="mt-4 space-y-4">
          {/* Sync direction indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">Gidede</span>
            <ArrowRightLeft className="h-4 w-4" />
            <span className="font-medium">GBE (GDCombine)</span>
            <Badge
              variant="outline"
              className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px] ml-2"
            >
              MOCK
            </Badge>
          </div>

          {/* Two action cards */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Export card */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
              <CardHeader className="pb-2 pl-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowUpFromLine className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Экспорт в GBE
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pl-4">
                <p className="text-xs text-muted-foreground">
                  Передать текущее состояние проекта в GDCombine. Маппинг:
                  OnePager → Blueprint, MDA → MDAModel, Balance →
                  BalanceReport, Progression → ProgressionModel, Economy →
                  EconomyModel.
                </p>
                <Button
                  onClick={handleSyncTo}
                  disabled={isSyncingTo}
                  className="w-full"
                  variant="outline"
                >
                  {isSyncingTo ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowUpFromLine className="h-4 w-4 mr-2" />
                  )}
                  Синхронизировать
                </Button>
              </CardContent>
            </Card>

            {/* Import card */}
            <Card className="relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
              <CardHeader className="pb-2 pl-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowDownToLine className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Импорт из GBE
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pl-4">
                <p className="text-xs text-muted-foreground">
                  Получить данные из GDCombine и обновить проект. Обратный
                  маппинг: Blueprint → Concept, MDAModel → MDA Profile,
                  BalanceReport → Balance Result.
                </p>
                <Button
                  onClick={handleSyncFrom}
                  disabled={isSyncingFrom}
                  className="w-full"
                  variant="outline"
                >
                  {isSyncingFrom ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowDownToLine className="h-4 w-4 mr-2" />
                  )}
                  Импортировать
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sync result */}
          {syncResult && (
            <Card className="animate-fade-in">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {syncResult.status === "synced" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : syncResult.status === "synced_with_warnings" ? (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                  )}
                  Результат синхронизации
                  <Badge
                    variant="outline"
                    className={`text-[10px] ml-2 ${statusBadge(syncResult.status)}`}
                  >
                    {syncResult.status === "synced"
                      ? "Успешно"
                      : syncResult.status === "synced_with_warnings"
                        ? "С предупреждениями"
                        : "Ошибка"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] ml-1">
                    {directionLabel(syncResult.direction)}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Meta info */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Sync ID
                    </p>
                    <p className="text-xs font-mono mt-0.5">
                      {syncResult.sync_id}
                    </p>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Направление
                    </p>
                    <p className="text-xs mt-0.5">
                      {directionLabel(syncResult.direction)}
                    </p>
                  </div>
                  <div className="rounded-md border p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Задержка
                    </p>
                    <p className="text-xs font-mono mt-0.5">
                      {syncResult.latency_ms} мс
                    </p>
                  </div>
                </div>

                {/* Components synced */}
                {syncResult.components_synced.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      Синхронизировано ({syncResult.components_synced.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {syncResult.components_synced.map((comp) => (
                        <Badge
                          key={comp}
                          variant="outline"
                          className="text-[10px] bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                        >
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Components skipped */}
                {syncResult.components_skipped.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                      Пропущено ({syncResult.components_skipped.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {syncResult.components_skipped.map((comp) => (
                        <Badge
                          key={comp}
                          variant="outline"
                          className="text-[10px] bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800"
                        >
                          <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                          {comp}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {syncResult.warnings.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                      Предупреждения ({syncResult.warnings.length})
                    </p>
                    <ul className="space-y-1">
                      {syncResult.warnings.map((w, i) => (
                        <li
                          key={i}
                          className="text-[11px] text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 rounded px-2 py-1"
                        >
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ====================== HISTORY TAB ====================== */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  История синхронизаций
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadSyncHistory}
                  disabled={isHistoryLoading}
                  className="h-7 text-xs"
                  aria-label="Обновить историю синхронизаций"
                >
                  {isHistoryLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1" />
                  )}
                  Обновить
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {syncHistory.length === 0 && !isHistoryLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Нет записей синхронизации</p>
                  <p className="text-[10px] mt-1">
                    Выполните синхронизацию, чтобы увидеть историю
                  </p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[11px]">Sync ID</TableHead>
                        <TableHead className="text-[11px]">
                          Направление
                        </TableHead>
                        <TableHead className="text-[11px]">
                          Компоненты
                        </TableHead>
                        <TableHead className="text-[11px]">Время</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syncHistory.map((entry, i) => (
                        <TableRow key={entry.sync_id || i}>
                          <TableCell className="font-mono text-[11px]">
                            {entry.sync_id}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                entry.direction === "to_gbe"
                                  ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
                                  : "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                              }`}
                            >
                              {entry.direction === "to_gbe" ? (
                                <ArrowUpFromLine className="h-2.5 w-2.5 mr-1" />
                              ) : (
                                <ArrowDownToLine className="h-2.5 w-2.5 mr-1" />
                              )}
                              {directionLabel(entry.direction)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[11px]">
                            {entry.components_synced?.length ?? 0} шт.
                          </TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {entry.timestamp
                              ? new Date(entry.timestamp).toLocaleString(
                                  "ru-RU",
                                  {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  }
                                )
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====================== SETTINGS TAB ====================== */}
        <TabsContent value="settings" className="mt-4 space-y-4">
          {/* Sync direction */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                Направление синхронизации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Выберите направление обмена данными между Gidede и GBE.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      value: "bidirectional",
                      label: "Двусторонняя",
                      desc: "Gidede ↔ GBE",
                      icon: <ArrowRightLeft className="h-4 w-4" />,
                    },
                    {
                      value: "to_gbe",
                      label: "Только экспорт",
                      desc: "Gidede → GBE",
                      icon: <ArrowUpFromLine className="h-4 w-4" />,
                    },
                    {
                      value: "from_gbe",
                      label: "Только импорт",
                      desc: "GBE → Gidede",
                      icon: <ArrowDownToLine className="h-4 w-4" />,
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSyncDirection(opt.value as SyncDirection)}
                    className={`flex items-center gap-2 rounded-md border p-3 text-left transition-colors ${
                      syncDirection === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className={`shrink-0 ${
                        syncDirection === opt.value
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {opt.icon}
                    </div>
                    <div>
                      <p className="text-xs font-medium">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Entities to sync */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Puzzle className="h-5 w-5 text-primary" />
                Сущности для синхронизации
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Выберите компоненты проекта, которые будут участвовать в
                синхронизации.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {ENTITY_OPTIONS.map((entity) => (
                  <label
                    key={entity.id}
                    className="flex items-center gap-2 rounded-md border p-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={enabledEntities.includes(entity.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEnabledEntities((prev) => [...prev, entity.id]);
                        } else {
                          setEnabledEntities((prev) =>
                            prev.filter((e) => e !== entity.id)
                          );
                        }
                      }}
                    />
                    <span className="text-xs font-medium">{entity.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Webhook simulation */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" />
                Симуляция вебхука
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Отправьте тестовый вебхук для проверки обработки событий от
                GBE. В production вебхуки вызываются GDCombine автоматически.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Тип события</label>
                  <Select
                    value={webhookEventType}
                    onValueChange={setWebhookEventType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEBHOOK_EVENT_TYPES.map((et) => (
                        <SelectItem key={et.value} value={et.value}>
                          {et.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Project ID</label>
                  <Input
                    value={webhookProjectId}
                    onChange={(e) => setWebhookProjectId(e.target.value)}
                    placeholder="demo-project"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Компонент</label>
                  <Select
                    value={webhookComponent}
                    onValueChange={setWebhookComponent}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blueprint">Blueprint</SelectItem>
                      <SelectItem value="mda">MDA</SelectItem>
                      <SelectItem value="diagram">Diagram</SelectItem>
                      <SelectItem value="balance">Balance</SelectItem>
                      <SelectItem value="progression">Progression</SelectItem>
                      <SelectItem value="economy">Economy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleSendWebhook}
                disabled={isWebhookSending}
                className="w-full sm:w-auto"
              >
                {isWebhookSending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Отправить вебхук
              </Button>

              {/* Webhook result */}
              {webhookResult && (
                <div className="rounded-md border p-3 space-y-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    {webhookResult.acknowledged ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs font-medium">
                      {webhookResult.acknowledged
                        ? "Вебхук обработан"
                        : "Вебхук отклонён"}
                    </span>
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {webhookResult.action_taken}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {webhookResult.event_type}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {webhookResult.message}
                  </p>
                  {webhookResult.timestamp && (
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(webhookResult.timestamp).toLocaleString(
                        "ru-RU"
                      )}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
