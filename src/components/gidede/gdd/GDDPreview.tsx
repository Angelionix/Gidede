"use client";

import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BookOpen, AlertTriangle } from "lucide-react";
import type { GDDProfile } from "@/types/gdd";

interface GDDPreviewProps {
  profile: GDDProfile;
}

/** Simple markdown-to-HTML renderer (no external deps). */
function simpleMarkdown(md: string): string {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    // Line breaks
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  // Wrap in paragraph if not starting with a block element
  if (!html.startsWith("<h") && !html.startsWith("<li")) {
    html = `<p>${html}</p>`;
  }
  return html;
}

function sourceBadge(source: string) {
  const map: Record<string, { label: string; className: string }> = {
    auto_fill: { label: "Авто", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
    ai_generate: { label: "AI", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    ai_enrich: { label: "AI+", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
    manual: { label: "Ручной", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    merged: { label: "Объединён", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  };
  const info = map[source] || { label: source, className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${info.className}`}>
      {info.label}
    </Badge>
  );
}

export const GDDPreview = React.memo(function GDDPreview({ profile }: GDDPreviewProps) {
  const { assembled_document, formatted_document } = profile;

  const sections = useMemo(() => {
    if (!assembled_document) return [];
    return assembled_document.section_order.map((key) => ({
      key,
      ...assembled_document.sections[key],
    }));
  }, [assembled_document]);

  if (!assembled_document && !formatted_document) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Сгенерируйте GDD для предпросмотра</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document stats */}
      {formatted_document && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              {formatted_document.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Секций: {formatted_document.section_count}</span>
              <span>Слов: {formatted_document.word_count}</span>
              <span>~{formatted_document.estimated_pages} стр.</span>
            </div>
            {assembled_document && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span>Заполнено: {assembled_document.filled_sections}/{assembled_document.total_sections}</span>
                <span>Покрытие: {Math.round(assembled_document.coverage_score * 100)}%</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Table of Contents */}
      {formatted_document?.table_of_contents && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Содержание</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="text-xs text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: simpleMarkdown(formatted_document.table_of_contents) }}
            />
          </CardContent>
        </Card>
      )}

      {/* Sections */}
      {sections.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <Accordion type="multiple" defaultValue={sections.slice(0, 3).map((s) => s.key)}>
              {sections.map((section) => (
                <AccordionItem key={section.key} value={section.key}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium">{section.section_name}</span>
                      {sourceBadge(section.source)}
                      {section.requires_review && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700 dark:text-orange-400">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />Проверка
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: simpleMarkdown(section.content || "—") }}
                    />
                    {section.has_diagram && (
                      <p className="text-xs text-muted-foreground mt-2 italic">📊 Содержит диаграмму</p>
                    )}
                    {section.has_tables && (
                      <p className="text-xs text-muted-foreground italic">📋 Содержит таблицы</p>
                    )}
                    {section.has_formulas && (
                      <p className="text-xs text-muted-foreground italic">📐 Содержит формулы</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Full markdown fallback */}
      {formatted_document?.markdown && sections.length === 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Полный документ</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: simpleMarkdown(formatted_document.markdown) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
});
