"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Gamepad2,
  Sparkles,
  GitBranch,
  Layers,
  Scale,
  TrendingUp,
  Coins,
  FileText,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Play,
  Download,
  RefreshCw,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface ProjectDetail {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  status: string;
  completion_percent: number;
  project_stage: string | null;
  version: number;
  last_algorithm_run: string | null;
  created_at: string;
  updated_at: string;
  has_concept: boolean;
  has_core_loop: boolean;
  has_mda: boolean;
  has_balance: boolean;
  has_progression: boolean;
  has_economy: boolean;
  has_gdd: boolean;
  has_checklist: boolean;
}

interface BlockSummary {
  block_id: number;
  name: string;
  href: string;
  icon: typeof Sparkles;
  filled: boolean;
  description: string;
  summary: string | null;
}

// ============================================================
// Block definitions (mirrors config/blocks.ts but with summaries)
// ============================================================

const BLOCKS: Array<Omit<BlockSummary, "filled" | "summary">> = [
  {
    block_id: 1,
    name: "Концепция",
    href: "/blocks/1",
    icon: Sparkles,
    description: "Жанр, эстетика, USP, набор механик",
  },
  {
    block_id: 2,
    name: "Core Loop",
    href: "/blocks/2",
    icon: GitBranch,
    description: "Иерархия циклов, патологии, рекомендации",
  },
  {
    block_id: 3,
    name: "MDA Lab",
    href: "/blocks/3",
    icon: Layers,
    description: "Mechanics → Dynamics → Aesthetics, линзы Шелла",
  },
  {
    block_id: 4,
    name: "Баланс",
    href: "/blocks/4",
    icon: Scale,
    description: "Transitive/Intransitive, Monte Carlo, Machinations",
  },
  {
    block_id: 5,
    name: "Прогрессия и Экономика",
    href: "/blocks/5",
    icon: TrendingUp,
    description: "Кривые XP, контент-план, ресурсы, монетизация",
  },
  {
    block_id: 6,
    name: "GDD Generator",
    href: "/blocks/6",
    icon: FileText,
    description: "3 формата, экспорт PDF/DOCX, чек-листы",
  },
];

// ============================================================
// Main component
// ============================================================

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { apiFetch, isAuthenticated, isLoading: authLoading } = useAuth();
  const { setActiveProjectId } = useActiveProject();
  const router = useRouter();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  // Set this project as active whenever the page loads
  useEffect(() => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
  }, [projectId, setActiveProjectId]);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    setIsLoadingProject(true);
    try {
      const data = await apiFetch<ProjectDetail>(`/projects/${projectId}`);
      setProject(data);
    } catch {
      setProject(null);
    } finally {
      setIsLoadingProject(false);
    }
  }, [apiFetch, projectId]);

  useEffect(() => {
    if (!authLoading && isAuthenticated && projectId) {
      fetchProject();
    }
  }, [authLoading, isAuthenticated, projectId, fetchProject]);

  const handleRunPipeline = async () => {
    if (!projectId || !project) return;
    setIsRunningPipeline(true);
    try {
      await apiFetch(`/pipeline/run-full-pipeline/${projectId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea:
            project.description ||
            `${project.name} — игра в жанре ${project.genre || "RPG"}`,
          format: "one_sheet",
          total_levels: 30,
        }),
      });
      await fetchProject(); // Refresh
    } catch {
      // Error toast handled by apiFetch
    } finally {
      setIsRunningPipeline(false);
    }
  };

  // Auth guard
  if (authLoading || isLoadingProject) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  if (!project) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 text-center">
        <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-bold mb-2">Проект не найден</h1>
        <p className="text-muted-foreground mb-4">
          Возможно, проект был удалён или у вас нет к нему доступа.
        </p>
        <Button asChild>
          <Link href="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" /> К списку проектов
          </Link>
        </Button>
      </div>
    );
  }

  const blocks: BlockSummary[] = BLOCKS.map((b) => {
    const filledMap: Record<number, boolean> = {
      1: project.has_concept,
      2: project.has_core_loop,
      3: project.has_mda,
      4: project.has_balance,
      5: project.has_progression || project.has_economy,
      6: project.has_gdd || project.has_checklist,
    };
    return {
      ...b,
      filled: filledMap[b.block_id] || false,
      summary: null,
    };
  });

  const filledCount = blocks.filter((b) => b.filled).length;

  return (
    <div className="container max-w-6xl mx-auto py-6 md:py-8 px-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/projects")}
            className="mt-1"
            aria-label="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gamepad2 className="h-6 w-6 text-primary" />
              <h1 className="text-2xl md:text-3xl font-bold">{project.name}</h1>
              <Badge variant="secondary">{project.status}</Badge>
              {project.version > 1 && (
                <Badge variant="outline">v{project.version}</Badge>
              )}
            </div>
            {project.description && (
              <p className="text-muted-foreground max-w-2xl">
                {project.description}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {project.genre && <span>Жанр: {project.genre}</span>}
              <span>
                Создан:{" "}
                {new Date(project.created_at).toLocaleDateString("ru-RU")}
              </span>
              <span>
                Обновлён:{" "}
                {new Date(project.updated_at).toLocaleDateString("ru-RU")}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRunPipeline}
            disabled={isRunningPipeline}
            className="gap-2"
          >
            {isRunningPipeline ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Запуск...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Запустить пайплайн
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Progress overview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium">Прогресс проекта</h2>
            <span className="text-2xl font-bold">
              {project.completion_percent}%
            </span>
          </div>
          <Progress value={project.completion_percent} className="h-3 mb-3" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Заполнено {filledCount} из {blocks.length} блоков
            </span>
            {project.project_stage && (
              <span>Текущая стадия: {project.project_stage}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data flow notice */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 mb-6">
        <RefreshCw className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-medium mb-1">Данные переносятся между блоками автоматически</p>
          <p className="text-muted-foreground">
            При открытии любого блока система подтягивает данные из предыдущих
            блоков. Этот проект выбран как активный — все изменения сохраняются
            сюда. Нажмите на блок ниже, чтобы продолжить работу.
          </p>
        </div>
      </div>

      {/* Block cards grid */}
      <h2 className="text-lg font-semibold mb-3">Функциональные блоки</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {blocks.map((block) => {
          const Icon = block.icon;
          return (
            <Card
              key={block.block_id}
              className="hover:shadow-md transition-all cursor-pointer"
              onClick={() => router.push(block.href)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {block.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Блок {block.block_id}
                      </CardDescription>
                    </div>
                  </div>
                  {block.filled ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  {block.description}
                </p>
                <div className="flex items-center justify-between">
                  <Badge
                    variant={block.filled ? "default" : "outline"}
                    className="text-xs"
                  >
                    {block.filled ? "Заполнен" : "Пусто"}
                  </Badge>
                  <span className="text-xs text-primary font-medium">
                    Открыть →
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional tools */}
      <h2 className="text-lg font-semibold mb-3">Дополнительно</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card
          className="hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push("/prototypes")}
        >
          <CardContent className="pt-5 text-center">
            <Play className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">Прототипы</p>
            <p className="text-xs text-muted-foreground mt-1">
              2D/3D играбельные демо
            </p>
          </CardContent>
        </Card>
        <Card
          className="hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push("/prototype-editor")}
        >
          <CardContent className="pt-5 text-center">
            <GitBranch className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">Node-редактор</p>
            <p className="text-xs text-muted-foreground mt-1">
              Визуальная логика игры
            </p>
          </CardContent>
        </Card>
        <Card
          className="hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push("/pipeline")}
        >
          <CardContent className="pt-5 text-center">
            <RefreshCw className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">Пайплайн</p>
            <p className="text-xs text-muted-foreground mt-1">
              Запуск всех 8 блоков
            </p>
          </CardContent>
        </Card>
        <Card
          className="hover:shadow-md transition-all cursor-pointer"
          onClick={() => router.push("/knowledge")}
        >
          <CardContent className="pt-5 text-center">
            <Download className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">База знаний</p>
            <p className="text-xs text-muted-foreground mt-1">
              12 разделов Библии
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
