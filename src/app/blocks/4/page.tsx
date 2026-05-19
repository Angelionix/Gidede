"use client";

import React, { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Scale,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Play,
  Target,
  Swords,
  BarChart3,
  GitBranch,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { usePipeline } from "@/hooks/use-pipeline";
import { API_BASE_URL, apiRoutes } from "@/config/api";
import { GENRES } from "@/config/genres";

// Types & Constants
import type { BalanceObject, FullBalanceRequest, FullBalanceResponse } from "@/types/balance";
import { GAME_MODES, BALANCE_TYPES, DEFAULT_OBJECTS } from "@/constants/balance";

// Extracted sub-components
import { ObjectForm } from "@/components/gidede/balance/ObjectForm";
import { TransitiveAnalysisTab } from "@/components/gidede/balance/TransitiveAnalysisTab";
import { PayoffMatrixTab } from "@/components/gidede/balance/PayoffMatrixTab";
import { SimulationChartsTab } from "@/components/gidede/balance/SimulationChartsTab";
import { MachinationsVisualizationTab } from "@/components/gidede/balance/MachinationsVisualizationTab";
import { CorrectionsPanelTab } from "@/components/gidede/balance/CorrectionsPanelTab";

// ============================================================
// Main Component
// ============================================================

export default function Block4Page() {
  const { apiFetch } = useAuth();
  const { toast } = useToast();

  // --- Pipeline ---
  const projectId =
    typeof window !== "undefined"
      ? localStorage.getItem("gidede_active_project")
      : null;
  const pipeline = usePipeline(projectId);

  // --- Form State ---
  const [objects, setObjects] = useState<BalanceObject[]>(DEFAULT_OBJECTS);
  const [gameMode, setGameMode] = useState<"PvP" | "PvE" | "PvPvE">("PvP");
  const [genre, setGenre] = useState("rpg");
  const [balanceType, setBalanceType] = useState<
    "transitive" | "intransitive" | "situational" | "mixed"
  >("mixed");
  const [runIntransitive, setRunIntransitive] = useState(true);
  const [runSituational, setRunSituational] = useState(false);
  const [runQFactor, setRunQFactor] = useState(false);
  const [runMonteCarlo, setRunMonteCarlo] = useState(true);
  const [runMachinations, setRunMachinations] = useState(true);
  const [activeTab, setActiveTab] = useState("transitive");

  // --- Result State ---
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<FullBalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Validation ---
  const isValid = objects.every((o) => o.name.trim() !== "") && objects.length >= 2;

  // --- Run Analysis ---
  const handleRunAnalysis = useCallback(async () => {
    if (!isValid) {
      toast({
        title: "Validation error",
        description: "All objects must have names and at least 2 objects are required",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const payload: FullBalanceRequest = {
        objects: objects.map((o) => ({
          id: o.id,
          name: o.name.trim(),
          type: o.type,
          attributes: o.attributes,
          cost: o.cost,
          tier: o.tier,
          tags: o.tags,
        })),
        game_mode: gameMode,
        genre,
        balance_type: balanceType,
        run_intransitive: runIntransitive,
        run_situational: runSituational,
        run_q_factor: runQFactor,
        run_monte_carlo: runMonteCarlo,
        run_machinations: runMachinations,
      };

      const data = await apiFetch<FullBalanceResponse>("/balance/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setResult(data);

      // Notify pipeline
      if (projectId) {
        pipeline.notifyUpdated(4, {
          balance_id: data.id,
          balance_type: balanceType,
          verdict: data.monte_carlo_result?.balance_verdict,
        });
      }

      toast({
        title: "Analysis complete",
        description: `Balance analysis finished in ${data.latency_ms || 0} ms`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast({
        title: "Analysis failed",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [
    isValid,
    objects,
    gameMode,
    genre,
    balanceType,
    runIntransitive,
    runSituational,
    runQFactor,
    runMonteCarlo,
    runMachinations,
    apiFetch,
    projectId,
    pipeline,
    toast,
  ]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Scale className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Balance and Simulation</h1>
          <p className="text-sm text-muted-foreground">Block 4 - Algorithm 3.4</p>
        </div>
        {result && (
          <Badge variant="outline" className="ml-auto text-xs border-green-300 text-green-700 dark:text-green-400">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Analysis loaded
          </Badge>
        )}
      </div>

      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Configuration
          </CardTitle>
          <CardDescription>
            Define balance objects and analysis parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Game settings row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Game Mode</Label>
              <Select value={gameMode} onValueChange={(v) => setGameMode(v as "PvP" | "PvE" | "PvPvE")}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GAME_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Balance Type</Label>
              <Select value={balanceType} onValueChange={(v) => setBalanceType(v as typeof balanceType)}>
                <SelectTrigger className="h-9 text-sm mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BALANCE_TYPES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Analysis flags */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Analysis Modules</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id="run-intransitive" checked={runIntransitive} onCheckedChange={(v) => setRunIntransitive(!!v)} />
                <Label htmlFor="run-intransitive" className="text-xs cursor-pointer">Intransitive</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-situational" checked={runSituational} onCheckedChange={(v) => setRunSituational(!!v)} />
                <Label htmlFor="run-situational" className="text-xs cursor-pointer">Situational</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-qfactor" checked={runQFactor} onCheckedChange={(v) => setRunQFactor(!!v)} />
                <Label htmlFor="run-qfactor" className="text-xs cursor-pointer">Q-Factor</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-montecarlo" checked={runMonteCarlo} onCheckedChange={(v) => setRunMonteCarlo(!!v)} />
                <Label htmlFor="run-montecarlo" className="text-xs cursor-pointer">Monte Carlo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="run-machinations" checked={runMachinations} onCheckedChange={(v) => setRunMachinations(!!v)} />
                <Label htmlFor="run-machinations" className="text-xs cursor-pointer">Machinations</Label>
              </div>
            </div>
          </div>

          <Separator />

          {/* Objects form */}
          <ObjectForm objects={objects} onObjectsChange={setObjects} />

          {/* Run button */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !isValid}
              className="min-w-[180px]"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Analysis
                </>
              )}
            </Button>
            {!isValid && (
              <p className="text-xs text-destructive">
                All objects must have names, at least 2 required
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Analysis Error</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Tabs */}
      {result && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transitive" className="text-xs sm:text-sm">
              <Target className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Transitive
            </TabsTrigger>
            <TabsTrigger value="payoff" className="text-xs sm:text-sm">
              <Swords className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Payoff
            </TabsTrigger>
            <TabsTrigger value="simulation" className="text-xs sm:text-sm">
              <BarChart3 className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Simulation
            </TabsTrigger>
            <TabsTrigger value="machinations" className="text-xs sm:text-sm">
              <GitBranch className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Machinations
            </TabsTrigger>
            <TabsTrigger value="corrections" className="text-xs sm:text-sm">
              <Wrench className="h-3.5 w-3.5 mr-1 hidden sm:inline" />
              Corrections
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="transitive">
              <TransitiveAnalysisTab result={result} />
            </TabsContent>

            <TabsContent value="payoff">
              <PayoffMatrixTab result={result} />
            </TabsContent>

            <TabsContent value="simulation">
              <SimulationChartsTab result={result} />
            </TabsContent>

            <TabsContent value="machinations">
              <MachinationsVisualizationTab result={result} />
            </TabsContent>

            <TabsContent value="corrections">
              <CorrectionsPanelTab result={result} />
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
