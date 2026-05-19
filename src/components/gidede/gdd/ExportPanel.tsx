"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Download,
  FileText,
  FileType2,
  Code2,
  FileJson,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import type { GDDProfile, GDDExportResponse } from "@/types/gdd";

interface ExportPanelProps {
  profile: GDDProfile;
  projectId: string | null;
}

type ExportFormat = "pdf" | "docx" | "html" | "md";

const EXPORT_OPTIONS: {
  format: ExportFormat;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    format: "pdf",
    label: "PDF",
    icon: <FileText className="h-5 w-5" />,
    description: "Портативный формат документа",
  },
  {
    format: "docx",
    label: "DOCX",
    icon: <FileType2 className="h-5 w-5" />,
    description: "Редактируемый документ Word",
  },
  {
    format: "html",
    label: "HTML",
    icon: <Code2 className="h-5 w-5" />,
    description: "Веб-страница с форматированием",
  },
  {
    format: "md",
    label: "Markdown",
    icon: <FileJson className="h-5 w-5" />,
    description: "Исходный Markdown-файл",
  },
];

export function ExportPanel({ profile, projectId }: ExportPanelProps) {
  const { apiFetch } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<{
    format: ExportFormat;
    url: string;
    filename: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasDocument = !!(
    profile.assembled_document ||
    profile.formatted_document
  );

  const handleExport = async (format: ExportFormat) => {
    if (!hasDocument) return;

    setExporting(format);
    setProgress(10);
    setError(null);
    setDownloadUrl(null);

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 85));
    }, 500);

    try {
      const data = await apiFetch<GDDExportResponse>("/gdd/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format,
          project_id: projectId || undefined,
        }),
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (data.content) {
        const byteChars = atob(data.content);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], {
          type: data.mime_type || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        setDownloadUrl({
          format,
          url,
          filename: data.filename || `gdd.${format}`,
        });
      }

      toast({
        title: "Экспорт завершён",
        description: `${format.toUpperCase()} документ готов к скачиванию`,
      });
    } catch (err) {
      clearInterval(progressInterval);
      const msg = err instanceof Error ? err.message : "Ошибка экспорта";
      setError(msg);
      toast({
        title: "Ошибка экспорта",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setExporting(null);
      setProgress(0);
    }
  };

  if (!hasDocument) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Download className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Сгенерируйте GDD для экспорта</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Экспорт документа
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {EXPORT_OPTIONS.map((opt) => {
              const isExporting = exporting === opt.format;
              const isDownload = downloadUrl?.format === opt.format;

              return (
                <div key={opt.format} className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex flex-col items-center gap-2"
                    onClick={() => handleExport(opt.format)}
                    disabled={!!exporting}
                  >
                    {isExporting ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : isDownload ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      opt.icon
                    )}
                    <span className="text-sm font-medium">{opt.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {opt.description}
                    </span>
                  </Button>

                  {isExporting && <Progress value={progress} className="h-1.5" />}

                  {isDownload && downloadUrl && (
                    <a
                      href={downloadUrl.url}
                      download={downloadUrl.filename}
                      className="flex items-center justify-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      Скачать {opt.label}
                    </a>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div className="flex items-start gap-2 text-xs rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-3 mt-4">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          )}

          {profile.format_spec.export_formats.length > 0 && (
            <div className="mt-4 text-xs text-muted-foreground">
              Доступные форматы: {profile.format_spec.export_formats.join(", ")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
