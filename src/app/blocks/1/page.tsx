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
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Lightbulb,
  Loader2,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  AestheticProfile,
  DynamicsProfile,
  ValidationReport,
} from "../../../../shared/types/typescript/interfaces";

// ============================================================
// Константы (из таксономии Роджерса, модели Йи, MechanicsDB)
// ============================================================

const GENRES = [
  { value: "action", label: "Action" },
  { value: "platformer", label: "Платформер" },
  { value: "shooter", label: "Шутер" },
  { value: "fighting", label: "Fighting" },
  { value: "stealth", label: "Stealth" },
  { value: "survival_horror", label: "Survival Horror" },
  { value: "rhythm", label: "Rhythm" },
  { value: "adventure", label: "Adventure" },
  { value: "rpg", label: "RPG" },
  { value: "action_rpg", label: "Action RPG" },
  { value: "jrpg", label: "JRPG" },
  { value: "tactical_rpg", label: "Tactical RPG" },
  { value: "mmorpg", label: "MMORPG" },
  { value: "roguelike", label: "Roguelike" },
  { value: "simulation", label: "Симулятор" },
  { value: "strategy", label: "Стратегия" },
  { value: "rts", label: "RTS" },
  { value: "tbs", label: "TBS" },
  { value: "tower_defense", label: "Tower Defense" },
  { value: "puzzle", label: "Квест/Пазл" },
  { value: "party", label: "Party" },
  { value: "educational", label: "Educational" },
  { value: "racing", label: "Гонки" },
  { value: "sports", label: "Спорт" },
  { value: "sandbox", label: "Sandbox" },
  { value: "horror", label: "Хоррор" },
  { value: "metroidvania", label: "Metroidvania" },
  { value: "idle", label: "Idle" },
  { value: "visual_novel", label: "Visual Novel" },
];

/** Мотивации по модели Йи (3 кластера, 12 мотиваций) */
const YEE_MOTIVATIONS = [
  {
    cluster: "Действие-Социальность",
    items: [
      { value: "destruction", label: "Разрушение" },
      { value: "excitement", label: "Возбуждение" },
      { value: "competition", label: "Соревнование" },
      { value: "community", label: "Сообщество" },
    ],
  },
  {
    cluster: "Мастерство-Достижение",
    items: [
      { value: "challenge", label: "Вызов" },
      { value: "strategy", label: "Стратегия" },
      { value: "completion", label: "Завершение" },
      { value: "power", label: "Мощь" },
    ],
  },
  {
    cluster: "Погружение-Творчество",
    items: [
      { value: "fantasy_yee", label: "Фантазия" },
      { value: "story", label: "Сюжет" },
      { value: "design", label: "Дизайн" },
      { value: "discovery_yee", label: "Открытие" },
    ],
  },
];

const PLATFORMS = [
  { value: "pc", label: "PC" },
  { value: "mobile", label: "Mobile" },
  { value: "console", label: "Console" },
  { value: "vr", label: "VR" },
  { value: "web", label: "Web" },
];

const BUDGET_OPTIONS = [
  { value: "solo", label: "Solo-разработчик" },
  { value: "small", label: "Малая команда (2-5)" },
  { value: "medium", label: "Средняя команда (6-15)" },
  { value: "large", label: "Большая команда (16+)" },
];

const EXPERIENCE_LEVELS = [
  { value: "casual", label: "Казуальный" },
  { value: "midcore", label: "Мидкор" },
  { value: "hardcore", label: "Хардкор" },
];

// ============================================================
// Типы
// ============================================================

interface ConceptFormState {
  idea: string;
  genreMode: "auto" | "explicit";
  genre: string;
  targetMotivations: string[];
  experienceLevel: string;
  platforms: string[];
  referenceGames: string;
  budget: string;
  forbiddenMechanics: string[];
  forbiddenInput: string;
}

interface ConceptGenerationResult {
  id: string;
  title: string;
  genre: string;
  target_audience: string;
  story_synopsis: string;
  gameplay_description: string;
  unique_features: string[];
  competitors: string[];
  aesthetic_profile: AestheticProfile | null;
  dynamics_profile: DynamicsProfile | null;
  mechanic_set: Record<string, unknown> | null;
  core_loop_candidates: Record<string, unknown>[];
  usp_candidates: Record<string, unknown>[];
  validation_report: ValidationReport | null;
  status: string;
  generation_metadata?: {
    stages_completed: number[];
    latency_ms: number;
    models_used: string[];
  };
}

// ============================================================
// Компонент
// ============================================================

export default function Block1Page() {
  const { apiFetch } = useAuth();

  // --- Состояние формы ---
  const [form, setForm] = useState<ConceptFormState>({
    idea: "",
    genreMode: "auto",
    genre: "",
    targetMotivations: [],
    experienceLevel: "midcore",
    platforms: ["pc"],
    referenceGames: "",
    budget: "small",
    forbiddenMechanics: [],
    forbiddenInput: "",
  });

  // --- Состояние генерации ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<ConceptGenerationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // --- Валидация ---
  const ideaLength = form.idea.trim().length;
  const isIdeaValid = ideaLength >= 10 && ideaLength <= 1000;
  const isMotivationsValid = form.targetMotivations.length >= 1;
  const isFormValid = isIdeaValid && isMotivationsValid;

  // --- Обработчики формы ---
  const updateField = useCallback(
    <K extends keyof ConceptFormState>(field: K, value: ConceptFormState[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const toggleMotivation = useCallback((motivation: string) => {
    setForm((prev) => {
      const current = prev.targetMotivations;
      if (current.includes(motivation)) {
        return {
          ...prev,
          targetMotivations: current.filter((m) => m !== motivation),
        };
      }
      if (current.length >= 3) return prev; // Максимум 3 мотивации
      return {
        ...prev,
        targetMotivations: [...current, motivation],
      };
    });
  }, []);

  const togglePlatform = useCallback((platform: string) => {
    setForm((prev) => {
      const current = prev.platforms;
      if (current.includes(platform)) {
        return {
          ...prev,
          platforms: current.filter((p) => p !== platform),
        };
      }
      return { ...prev, platforms: [...current, platform] };
    });
  }, []);

  const addForbiddenMechanic = useCallback(() => {
    const val = form.forbiddenInput.trim();
    if (val && !form.forbiddenMechanics.includes(val)) {
      setForm((prev) => ({
        ...prev,
        forbiddenMechanics: [...prev.forbiddenMechanics, val],
        forbiddenInput: "",
      }));
    }
  }, [form.forbiddenInput, form.forbiddenMechanics]);

  const removeForbiddenMechanic = useCallback((mechanic: string) => {
    setForm((prev) => ({
      ...prev,
      forbiddenMechanics: prev.forbiddenMechanics.filter((m) => m !== mechanic),
    }));
  }, []);

  // --- Генерация концепции ---
  const handleGenerate = useCallback(async () => {
    if (!isFormValid) return;

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setCurrentStage("Этап 1: Анализ и определение жанра...");

    try {
      // Формируем payload для API
      const payload = {
        idea: form.idea.trim(),
        genre:
          form.genreMode === "auto"
            ? null
            : form.genre,
        target_audience:
          form.targetMotivations.length > 0
            ? {
                primary: form.targetMotivations,
                experience: form.experienceLevel,
              }
            : null,
        platform: form.platforms.length > 0 ? form.platforms : null,
        constraints: {
          team_size:
            form.budget === "solo"
              ? 1
              : form.budget === "small"
                ? 3
                : form.budget === "medium"
                  ? 10
                  : 20,
          budget:
            form.budget === "solo"
              ? "low"
              : form.budget === "small"
                ? "low"
                : form.budget === "medium"
                  ? "medium"
                  : "high",
        },
        reference_games: form.referenceGames
          ? form.referenceGames
              .split(",")
              .map((g) => g.trim())
              .filter(Boolean)
          : null,
        forbidden_mechanics:
          form.forbiddenMechanics.length > 0
            ? form.forbiddenMechanics
            : null,
      };

      setCurrentStage("Этап 1: Анализ и определение жанра...");

      const response = await apiFetch<ConceptGenerationResult>(
        "/concept/generate",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      setCurrentStage(null);
      setResult(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка при генерации концепции"
      );
      setCurrentStage(null);
    } finally {
      setIsGenerating(false);
    }
  }, [form, isFormValid, apiFetch]);

  // ============================================================
  // Рендер
  // ============================================================

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Заголовок */}
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Генератор концепции</h1>
          <p className="text-sm text-muted-foreground">
            Блок 1 &bull; Алгоритм 3.1 &bull; 7 этапов
          </p>
        </div>
        <Badge
          variant="outline"
          className={result ? "text-green-600 ml-auto" : "text-yellow-600 ml-auto"}
        >
          {result ? "Реализация 4.B.1–4.B.2" : "Реализация 4.B.1"}
        </Badge>
      </div>

      {/* === ФОРМА ВВОДА === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ввод идеи</CardTitle>
          <CardDescription>
            Опишите идею игры и задайте параметры. Минимум — текст идеи и
            мотивации аудитории. Остальное — опционально.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Идея */}
          <div>
            <Label htmlFor="idea">
              Опишите идею игры (1–5 предложений){" "}
              <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="idea"
              value={form.idea}
              onChange={(e) => updateField("idea", e.target.value)}
              placeholder="Например: Roguelike про алхимика, который варит зелья и сражается с монстрами в процедурно генерируемых подземельях..."
              className="mt-1.5 min-h-[120px]"
            />
            <div className="flex justify-between mt-1">
              <p className="text-xs text-muted-foreground">
                Минимум 10 символов. Чем подробнее — тем точнее результат.
              </p>
              <p
                className={`text-xs ${ideaLength < 10 ? "text-red-500" : "text-muted-foreground"}`}
              >
                {ideaLength}/1000
              </p>
            </div>
          </div>

          {/* Жанр */}
          <div>
            <Label>Жанр</Label>
            <div className="flex items-center gap-4 mt-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="genreMode"
                  checked={form.genreMode === "auto"}
                  onChange={() => updateField("genreMode", "auto")}
                  className="accent-primary"
                />
                <span className="text-sm">Определить автоматически</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="genreMode"
                  checked={form.genreMode === "explicit"}
                  onChange={() => updateField("genreMode", "explicit")}
                  className="accent-primary"
                />
                <span className="text-sm">Указать вручную</span>
              </label>
            </div>
            {form.genreMode === "explicit" && (
              <Select
                value={form.genre}
                onValueChange={(v) => updateField("genre", v)}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Выберите жанр" />
                </SelectTrigger>
                <SelectContent>
                  {GENRES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Целевая аудитория — мотивации по модели Йи */}
          <div>
            <Label>
              Целевая аудитория — мотивации (модель Йи){" "}
              <span className="text-red-500">*</span>
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Выберите 1–3 мотивации. Они определят эстетические ценности игры.
            </p>
            <div className="mt-3 space-y-4">
              {YEE_MOTIVATIONS.map((cluster) => (
                <div key={cluster.cluster}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {cluster.cluster}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cluster.items.map((motivation) => {
                      const isSelected =
                        form.targetMotivations.includes(motivation.value);
                      const isDisabled =
                        !isSelected && form.targetMotivations.length >= 3;
                      return (
                        <Badge
                          key={motivation.value}
                          variant={isSelected ? "default" : "outline"}
                          className={`cursor-pointer transition-colors ${
                            isDisabled
                              ? "opacity-40 cursor-not-allowed"
                              : "hover:bg-primary/10"
                          }`}
                          onClick={() => {
                            if (!isDisabled) toggleMotivation(motivation.value);
                          }}
                        >
                          {motivation.label}
                          {isSelected && (
                            <X className="h-3 w-3 ml-1" />
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {form.targetMotivations.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Выберите хотя бы одну мотивацию
              </p>
            )}
          </div>

          {/* Уровень опыта */}
          <div>
            <Label>Уровень опыта аудитории</Label>
            <Select
              value={form.experienceLevel}
              onValueChange={(v) => updateField("experienceLevel", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE_LEVELS.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Платформа */}
          <div>
            <Label>Платформа</Label>
            <div className="flex flex-wrap gap-3 mt-2">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform.value}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Checkbox
                    checked={form.platforms.includes(platform.value)}
                    onCheckedChange={() => togglePlatform(platform.value)}
                  />
                  <span className="text-sm">{platform.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Референтные игры */}
          <div>
            <Label htmlFor="references">Референтные игры (через запятую)</Label>
            <Input
              id="references"
              value={form.referenceGames}
              onChange={(e) => updateField("referenceGames", e.target.value)}
              placeholder="Hades, Binding of Isaac, Slay the Spire"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Игры, на которые вы ориентируетесь. Помогает определить USP и
              конкурентное позиционирование.
            </p>
          </div>

          {/* Расширенные настройки */}
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-muted-foreground"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 mr-1" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-1" />
              )}
              Расширенные настройки
            </Button>

            {showAdvanced && (
              <div className="space-y-4 mt-3 pl-2 border-l-2 border-muted">
                {/* Бюджет / Команда */}
                <div>
                  <Label>Бюджет / Размер команды</Label>
                  <Select
                    value={form.budget}
                    onValueChange={(v) => updateField("budget", v)}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Запрещённые механики */}
                <div>
                  <Label>Запрещённые механики (теги)</Label>
                  <div className="flex gap-2 mt-1.5">
                    <Input
                      value={form.forbiddenInput}
                      onChange={(e) =>
                        updateField("forbiddenInput", e.target.value)
                      }
                      placeholder="Например: PvP, микротранзакции"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addForbiddenMechanic();
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addForbiddenMechanic}
                    >
                      Добавить
                    </Button>
                  </div>
                  {form.forbiddenMechanics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.forbiddenMechanics.map((mechanic) => (
                        <Badge
                          key={mechanic}
                          variant="secondary"
                          className="cursor-pointer"
                          onClick={() => removeForbiddenMechanic(mechanic)}
                        >
                          {mechanic}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Механики, которые AI не должен предлагать. Нажмите Enter
                    или кнопку для добавления.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Кнопка генерации */}
          <Button
            className="w-full"
            size="lg"
            disabled={!isFormValid || isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Генерация концепции...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Сгенерировать концепцию
              </>
            )}
          </Button>

          {/* Индикатор текущего этапа */}
          {currentStage && (
            <div className="text-center text-sm text-muted-foreground animate-pulse">
              {currentStage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === ОШИБКА === */}
      {error && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-400">
                  Ошибка генерации
                </p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                  {error}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* === РЕЗУЛЬТАТ ГЕНЕРАЦИИ === */}
      {result && (
        <div className="space-y-4">
          {/* Основная информация */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {result.title || "Концепция сгенерирована"}
              </CardTitle>
              {result.generation_metadata && (
                <CardDescription>
                  Этапы:{" "}
                  {result.generation_metadata.stages_completed
                    .map((s) => `${s}`)
                    .join(", ")}{" "}
                  &bull; {result.generation_metadata.latency_ms} мс &bull;{" "}
                  {result.generation_metadata.models_used.join(", ")}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Жанр и аудитория */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Жанр
                  </p>
                  <p className="text-sm">{result.genre || "—"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Целевая аудитория
                  </p>
                  <p className="text-sm">{result.target_audience || "—"}</p>
                </div>
              </div>

              {/* Синопсис */}
              {result.story_synopsis && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Синопсис
                  </p>
                  <p className="text-sm mt-1">{result.story_synopsis}</p>
                </div>
              )}

              {/* Описание геймплея */}
              {result.gameplay_description && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Описание геймплея
                  </p>
                  <p className="text-sm mt-1">
                    {result.gameplay_description}
                  </p>
                </div>
              )}

              {/* Уникальные фичи */}
              {result.unique_features &&
                result.unique_features.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Уникальные фичи
                    </p>
                    <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                      {result.unique_features.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Конкуренты */}
              {result.competitors && result.competitors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Конкуренты
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.competitors.map((c, i) => (
                      <Badge key={i} variant="outline">
                        {c}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Эстетический профиль (Этап 2) */}
          {result.aesthetic_profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Эстетический профиль (Reverse MDA)
                </CardTitle>
                <CardDescription>
                  Алгоритм 3.1 Этап 2 — определение целевых эстетических
                  ценностей
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  {(
                    [
                      ["primary", "Основная"],
                      ["secondary", "Вторичная"],
                      ["tertiary", "Третичная"],
                    ] as const
                  ).map(([key, label]) => {
                    const value =
                      result.aesthetic_profile?.[
                        key as keyof AestheticProfile
                      ];
                    return (
                      <div key={key} className="text-center">
                        <p className="text-xs font-medium text-muted-foreground">
                          {label}
                        </p>
                        <p className="text-sm font-semibold mt-1 capitalize">
                          {typeof value === "string" ? value : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {result.aesthetic_profile?.rationale && (
                  <p className="text-sm text-muted-foreground mt-3">
                    {result.aesthetic_profile.rationale}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Профиль динамик (Этап 3) */}
          {result.dynamics_profile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Профиль динамик</CardTitle>
                <CardDescription>
                  Алгоритм 3.1 Этап 3 — вывод динамик из эстетик
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Основные динамики
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.dynamics_profile.core_dynamics?.map((d, i) => (
                      <Badge key={i} variant="default">
                        {d}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Поддерживающие динамики
                  </p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {result.dynamics_profile.supporting_dynamics?.map(
                      (d, i) => (
                        <Badge key={i} variant="outline">
                          {d}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
                {result.dynamics_profile.rationale && (
                  <p className="text-sm text-muted-foreground">
                    {result.dynamics_profile.rationale}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Механики (Этап 4 — заглушка для 4.B.3) */}
          {result.mechanic_set && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Набор механик (MechanicsDB)
                </CardTitle>
                <CardDescription>
                  Алгоритм 3.1 Этап 4 — выбор механик (реализация в 4.B.3)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(result.mechanic_set, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Core Loop кандидаты (Этап 5 — заглушка для 4.B.3) */}
          {result.core_loop_candidates &&
            result.core_loop_candidates.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Кандидаты Core Loop
                  </CardTitle>
                  <CardDescription>
                    Алгоритм 3.1 Этап 5 (реализация в 4.B.3)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                    {JSON.stringify(result.core_loop_candidates, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

          {/* USP кандидаты (Этап 5 — заглушка для 4.B.3) */}
          {result.usp_candidates && result.usp_candidates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Кандидаты USP
                </CardTitle>
                <CardDescription>
                  Алгоритм 3.1 Этап 5 (реализация в 4.B.3)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(result.usp_candidates, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Валидация (Этап 6 — заглушка для 4.B.4) */}
          {result.validation_report && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Отчёт валидации
                </CardTitle>
                <CardDescription>
                  Алгоритм 3.1 Этап 6 (реализация в 4.B.4)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify(result.validation_report, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Пустое состояние */}
      {!result && !isGenerating && !error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Результат генерации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>
                Заполните форму и нажмите «Сгенерировать концепцию»
              </p>
              <p className="text-xs mt-1">
                Backend-реализация: Этапы 1–3 (4.B.2) &bull; Этапы 4–5
                (4.B.3) &bull; Этапы 6–7 (4.B.4)
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
