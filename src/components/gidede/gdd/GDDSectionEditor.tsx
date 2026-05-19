"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Save, FileEdit, Lightbulb, Loader2 } from "lucide-react";
import type { GDDProfile } from "@/types/gdd";

interface GDDSectionEditorProps {
  profile: GDDProfile;
  onSectionUpdate: (_sectionName: string, _content: string) => void;
}

function priorityBadge(priority: "critical" | "important" | "optional") {
  const map = {
    critical: { label: "Критичный", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
    important: { label: "Важный", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
    optional: { label: "Опциональный", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400" },
  };
  const info = map[priority];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-0 ${info.className}`}>
      {info.label}
    </Badge>
  );
}

export function GDDSectionEditor({ profile, onSectionUpdate }: GDDSectionEditorProps) {
  const { assembled_document, manual_skeletons } = profile;
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  if (!assembled_document) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileEdit className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Сгенерируйте GDD для редактирования секций</p>
        </CardContent>
      </Card>
    );
  }

  const sections = assembled_document.section_order.map((key) => ({
    key,
    ...assembled_document.sections[key],
  }));

  const handleStartEdit = (key: string, content: string) => {
    setEditingSection(key);
    setEditContent(content);
  };

  const handleSave = async (key: string) => {
    setSaving(key);
    try {
      await onSectionUpdate(key, editContent);
      setEditingSection(null);
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingSection(null);
    setEditContent("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileEdit className="h-5 w-5 text-primary" />
            Редактор секций
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {assembled_document.filled_sections} из {assembled_document.total_sections} секций заполнено • Покрытие: {Math.round(assembled_document.coverage_score * 100)}%
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Accordion type="multiple" defaultValue={sections.filter((s) => !s.content || s.requires_review).slice(0, 5).map((s) => s.key)}>
            {sections.map((section) => {
              const skeleton = manual_skeletons?.skeletons?.[section.key];
              const isEditing = editingSection === section.key;
              const isSaving = saving === section.key;

              return (
                <AccordionItem key={section.key} value={section.key}>
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm font-medium">{section.section_name}</span>
                      {skeleton && priorityBadge(skeleton.priority)}
                      {section.requires_review && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-orange-300 text-orange-700 dark:text-orange-400">
                          Требует проверки
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 space-y-3">
                    {/* Hints from manual skeletons */}
                    {skeleton && skeleton.hints.length > 0 && (
                      <div className="bg-muted/50 rounded-md p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Lightbulb className="h-3.5 w-3.5" />
                          Подсказки
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-0.5">
                          {skeleton.hints.map((hint, i) => (
                            <li key={i} className="ml-4 list-disc">{hint}</li>
                          ))}
                        </ul>
                        {skeleton.estimated_effort && (
                          <p className="text-xs text-muted-foreground">
                            Оценка усилий: {skeleton.estimated_effort}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Template */}
                    {skeleton?.template && !section.content && (
                      <div className="bg-muted/30 rounded-md p-3 text-xs text-muted-foreground border border-dashed">
                        <p className="font-medium mb-1">Шаблон:</p>
                        <pre className="whitespace-pre-wrap">{skeleton.template}</pre>
                      </div>
                    )}

                    {/* Content / Editor */}
                    {isEditing ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={10}
                          className="font-mono text-sm"
                          placeholder="Введите содержимое секции в Markdown..."
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSave(section.key)}
                            disabled={isSaving}
                            className="gap-1"
                          >
                            {isSaving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            Сохранить
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCancel}>
                            Отмена
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {section.content ? (
                          <div className="bg-muted/30 rounded-md p-3 text-sm whitespace-pre-wrap">
                            {section.content.length > 500
                              ? section.content.slice(0, 500) + "…"
                              : section.content}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Секция пуста</p>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleStartEdit(section.key, section.content || skeleton?.template || "")}
                          className="gap-1"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          Редактировать
                        </Button>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
