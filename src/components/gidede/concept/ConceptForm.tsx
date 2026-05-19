"use client";

import React from "react";
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
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { GENRES } from "@/config/genres";
import { YEE_MOTIVATIONS } from "@/config/aesthetics";
import type { ConceptFormState } from "@/types/concept";
import {
  PLATFORMS,
  BUDGET_OPTIONS,
  EXPERIENCE_LEVELS,
} from "@/constants/concept";

interface ConceptFormProps {
  form: ConceptFormState;
  setForm: React.Dispatch<React.SetStateAction<ConceptFormState>>;
  isGenerating: boolean;
  isFormValid: boolean;
  currentStage: string | null;
  onGenerate: () => void;
}

export function ConceptForm({
  form,
  setForm,
  isGenerating,
  isFormValid,
  currentStage,
  onGenerate,
}: ConceptFormProps) {
  const ideaLength = form.idea.trim().length;

  const updateField = <K extends keyof ConceptFormState>(field: K, value: ConceptFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleMotivation = (motivation: string) => {
    setForm((prev) => {
      const current = prev.targetMotivations;
      if (current.includes(motivation)) {
        return { ...prev, targetMotivations: current.filter((m) => m !== motivation) };
      }
      if (current.length >= 3) return prev;
      return { ...prev, targetMotivations: [...current, motivation] };
    });
  };

  const togglePlatform = (platform: string) => {
    setForm((prev) => {
      const current = prev.platforms;
      if (current.includes(platform)) {
        return { ...prev, platforms: current.filter((p) => p !== platform) };
      }
      return { ...prev, platforms: [...current, platform] };
    });
  };

  const addForbiddenMechanic = () => {
    const val = form.forbiddenInput.trim();
    if (val && !form.forbiddenMechanics.includes(val)) {
      setForm((prev) => ({
        ...prev,
        forbiddenMechanics: [...prev.forbiddenMechanics, val],
        forbiddenInput: "",
      }));
    }
  };

  const removeForbiddenMechanic = (mechanic: string) => {
    setForm((prev) => ({
      ...prev,
      forbiddenMechanics: prev.forbiddenMechanics.filter((m) => m !== mechanic),
    }));
  };

  const [showAdvanced, setShowAdvanced] = React.useState(false);

  return (
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
            <p className={`text-xs ${ideaLength < 10 ? "text-red-500" : "text-muted-foreground"}`}>
              {ideaLength}/1000
            </p>
          </div>
        </div>

        {/* Жанр */}
        <div>
          <Label>Жанр</Label>
          <div className="flex items-center gap-4 mt-1.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="genreMode" checked={form.genreMode === "auto"} onChange={() => updateField("genreMode", "auto")} className="accent-primary" />
              <span className="text-sm">Определить автоматически</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="genreMode" checked={form.genreMode === "explicit"} onChange={() => updateField("genreMode", "explicit")} className="accent-primary" />
              <span className="text-sm">Указать вручную</span>
            </label>
          </div>
          {form.genreMode === "explicit" && (
            <Select value={form.genre} onValueChange={(v) => updateField("genre", v)}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Выберите жанр" />
              </SelectTrigger>
              <SelectContent>
                {GENRES.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
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
                <p className="text-sm font-medium text-muted-foreground mb-2">{cluster.cluster}</p>
                <div className="flex flex-wrap gap-2">
                  {cluster.items.map((motivation) => {
                    const isSelected = form.targetMotivations.includes(motivation.value);
                    const isDisabled = !isSelected && form.targetMotivations.length >= 3;
                    return (
                      <Badge
                        key={motivation.value}
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-colors ${isDisabled ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/10"}`}
                        onClick={() => { if (!isDisabled) toggleMotivation(motivation.value); }}
                      >
                        {motivation.label}
                        {isSelected && <X className="h-3 w-3 ml-1" />}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {form.targetMotivations.length === 0 && (
            <p className="text-xs text-red-500 mt-1">Выберите хотя бы одну мотивацию</p>
          )}
        </div>

        {/* Уровень опыта */}
        <div>
          <Label>Уровень опыта аудитории</Label>
          <Select value={form.experienceLevel} onValueChange={(v) => updateField("experienceLevel", v)}>
            <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              {EXPERIENCE_LEVELS.map((level) => (
                <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Платформа */}
        <div>
          <Label>Платформа</Label>
          <div className="flex flex-wrap gap-3 mt-2">
            {PLATFORMS.map((platform) => (
              <label key={platform.value} className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.platforms.includes(platform.value)} onCheckedChange={() => togglePlatform(platform.value)} />
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
            Игры, на которые вы ориентируетесь. Помогает определить USP и конкурентное позиционирование.
          </p>
        </div>

        {/* Расширенные настройки */}
        <div>
          <Button variant="ghost" size="sm" className="px-0 text-muted-foreground" onClick={() => setShowAdvanced(!showAdvanced)}>
            {showAdvanced ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
            Расширенные настройки
          </Button>
          {showAdvanced && (
            <div className="space-y-4 mt-3 pl-2 border-l-2 border-muted">
              <div>
                <Label>Бюджет / Размер команды</Label>
                <Select value={form.budget} onValueChange={(v) => updateField("budget", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUDGET_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Запрещённые механики (теги)</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input
                    value={form.forbiddenInput}
                    onChange={(e) => updateField("forbiddenInput", e.target.value)}
                    placeholder="Например: PvP, микротранзакции"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addForbiddenMechanic(); } }}
                  />
                  <Button variant="outline" size="sm" onClick={addForbiddenMechanic}>Добавить</Button>
                </div>
                {form.forbiddenMechanics.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {form.forbiddenMechanics.map((mechanic) => (
                      <Badge key={mechanic} variant="secondary" className="cursor-pointer" onClick={() => removeForbiddenMechanic(mechanic)}>
                        {mechanic}
                        <X className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Механики, которые AI не должен предлагать. Нажмите Enter или кнопку для добавления.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Кнопка генерации */}
        <Button className="w-full" size="lg" disabled={!isFormValid || isGenerating} onClick={onGenerate}>
          {isGenerating ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Генерация концепции...</>
          ) : (
            <><Sparkles className="h-4 w-4 mr-2" />Сгенерировать концепцию</>
          )}
        </Button>

        {currentStage && (
          <div className="text-center text-sm text-muted-foreground animate-pulse">{currentStage}</div>
        )}
      </CardContent>
    </Card>
  );
}
