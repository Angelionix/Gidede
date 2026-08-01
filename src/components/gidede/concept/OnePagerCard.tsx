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
import { Separator } from "@/components/ui/separator";
import { Sparkles, Star } from "lucide-react";
import type { ConceptGenerationResult } from "@/types/concept";

const GENRE_SOURCE_LABELS = {
  keyword_match: "авто: совпадения",
  explicit: "выбран вручную",
  fallback_default: "fallback без сигналов",
} as const;

export const OnePagerCard = React.memo(function OnePagerCard({ result }: { result: ConceptGenerationResult }) {
  const genreEvidence = result.genre_classification;

  return (
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
      <CardContent className="space-y-5">
        {/* Строка 1: Жанр, Аудитория, Рейтинг */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Жанр</p>
            <Badge variant="secondary" className="text-sm">{result.genre || "—"}</Badge>
            {genreEvidence && (
              <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                <p>{GENRE_SOURCE_LABELS[genreEvidence.selection_source]}</p>
                {genreEvidence.candidates[0]?.matched_keywords.length > 0 && (
                  <p>
                    Evidence {genreEvidence.candidates[0].genre}: {genreEvidence.candidates[0].matched_keywords.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Целевая аудитория</p>
            <p className="text-sm">{result.target_audience || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Возрастной рейтинг</p>
            <Badge variant="outline">{result.rating || "TBD"}</Badge>
          </div>
        </div>

        <Separator />

        {/* Синопсис */}
        {result.story_synopsis && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Синопсис сюжета</p>
            <p className="text-sm leading-relaxed">{result.story_synopsis}</p>
          </div>
        )}

        {/* Описание геймплея */}
        {result.gameplay_description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Описание геймплея</p>
            <p className="text-sm leading-relaxed">{result.gameplay_description}</p>
          </div>
        )}

        <Separator />

        {/* Уникальные фичи */}
        {result.unique_features && result.unique_features.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Уникальные фичи</p>
            <ul className="space-y-1.5">
              {result.unique_features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Star className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Конкуренты */}
        {result.competitors && result.competitors.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Конкуренты</p>
            <div className="flex flex-wrap gap-2">
              {result.competitors.map((c, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
