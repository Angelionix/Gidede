"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Shield } from "lucide-react";
import type { ConceptGenerationResult } from "@/types/concept";
import { LOOP_TYPE_LABELS } from "@/constants/concept";

interface SelectionSummaryProps {
  result: ConceptGenerationResult;
  selectedCoreLoopIndex: number | null;
  selectedUSPIndex: number | null;
  onSave: () => void;
}

export function SelectionSummary({
  result,
  selectedCoreLoopIndex,
  selectedUSPIndex,
  onSave,
}: SelectionSummaryProps) {
  if (selectedCoreLoopIndex === null && selectedUSPIndex === null) return null;

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Итоговый выбор
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {selectedCoreLoopIndex !== null && result.core_loop_candidates[selectedCoreLoopIndex] && (
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Core Loop</p>
              <p className="text-sm font-semibold">
                {result.core_loop_candidates[selectedCoreLoopIndex].name as string || `Вариант ${selectedCoreLoopIndex + 1}`}
              </p>
              <Badge variant="outline" className="text-xs">
                {LOOP_TYPE_LABELS[(result.core_loop_candidates[selectedCoreLoopIndex].loop_type as string) || "hybrid"] || "Гибрид"}
              </Badge>
            </div>
          )}
          {selectedUSPIndex !== null && result.usp_candidates[selectedUSPIndex] && (
            <div className="rounded-md border p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">USP</p>
              <p className="text-sm font-semibold">
                {(result.usp_candidates[selectedUSPIndex].usp as string) || `Вариант ${selectedUSPIndex + 1}`}
              </p>
            </div>
          )}
        </div>
        <Button onClick={onSave} className="w-full sm:w-auto">
          <Check className="h-4 w-4 mr-2" />
          Сохранить выбор
        </Button>
      </CardContent>
    </Card>
  );
}
