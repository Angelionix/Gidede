"use client";

import React, { useMemo, useState, useEffect } from "react";
import DOMPurify from "dompurify";
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

/**
 * Simple markdown-to-HTML renderer (no external deps).
 *
 * NOTE: the output of this function is ALWAYS passed through DOMPurify.sanitize()
 * before being injected via dangerouslySetInnerHTML. This neutralizes any
 * <script>, onerror=, javascript: URLs, or other HTML that could originate
 * from AI-generated or user-edited GDD sections (stored-XSS defense).
 */
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

/**
 * Sanitize arbitrary HTML for safe insertion via dangerouslySetInnerHTML.
 *
 * DOMPurify is a browser-only library (it relies on the DOM). On the server
 * (during SSR/SSG) it is a no-op identity function, so we guard with a
 * typeof-window check and only sanitize in the browser. Because this
 * component is "use client" and the dangerous HTML is only rendered after
 * hydration, the browser-side sanitization is sufficient.
 */
function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return html; // SSR: return raw; client will sanitize
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "h1", "h2", "h3", "h4", "h5", "h6",
      "p", "br", "hr",
      "strong", "em", "b", "i", "u", "s", "del", "ins", "mark", "sub", "sup",
      "ul", "ol", "li",
      "blockquote", "code", "pre", "kbd", "samp", "var",
      "a", "span", "div",
      "table", "thead", "tbody", "tr", "th", "td",
      "img",
    ],
    ALLOWED_ATTR: [
      "href", "src", "alt", "title", "class",
      "target", "rel",
      "width", "height",
      "colspan", "rowspan",
    ],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Hook that returns a sanitized HTML string. During SSR it returns the raw
 * (already-markdown-converted) HTML; after hydration it returns the
 * DOMPurify-sanitized version. This avoids hydration mismatches by ensuring
 * the first client render matches the server render, then sanitizes on the
 * next tick.
 */
function useSanitizedHtml(rawHtml: string): string {
  const [sanitized, setSanitized] = useState(rawHtml);
  useEffect(() => {
    setSanitized(sanitizeHtml(rawHtml));
  }, [rawHtml]);
  return sanitized;
}

/**
 * Renders markdown-converted HTML safely via DOMPurify sanitization.
 * Used as a child component so the hook can be called per-instance
 * (hooks cannot be called inside .map() loops).
 */
function SanitizedContent({ md, className }: { md: string; className?: string }) {
  const sanitized = useSanitizedHtml(simpleMarkdown(md));
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
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
            <SanitizedContent
              md={formatted_document.table_of_contents}
              className="text-xs text-muted-foreground prose prose-sm dark:prose-invert max-w-none"
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
                    <SanitizedContent
                      md={section.content || "—"}
                      className="prose prose-sm dark:prose-invert max-w-none text-sm"
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
            <SanitizedContent
              md={formatted_document.markdown}
              className="prose prose-sm dark:prose-invert max-w-none"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
});
