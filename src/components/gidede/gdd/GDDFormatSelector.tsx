"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GDD_FORMATS } from "@/constants/gdd";

interface GDDFormatSelectorProps {
  selectedFormat: string;
  onFormatChange: (_format: string) => void;
}

export function GDDFormatSelector({ selectedFormat, onFormatChange }: GDDFormatSelectorProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {GDD_FORMATS.map((fmt) => {
        const isSelected = selectedFormat === fmt.value;
        return (
          <Card
            key={fmt.value}
            className={`cursor-pointer transition-all hover:shadow-md ${
              isSelected
                ? "border-primary ring-2 ring-primary/20 shadow-md"
                : "border-border hover:border-primary/40"
            }`}
            onClick={() => onFormatChange(fmt.value)}
          >
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl" role="img" aria-label={fmt.label}>
                  {fmt.icon}
                </span>
                <span className="font-semibold text-sm leading-tight">
                  {fmt.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">
                {fmt.description}
              </p>
              <Badge
                variant={isSelected ? "default" : "secondary"}
                className="text-[10px] px-1.5 py-0"
              >
                {fmt.recommendation}
              </Badge>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
