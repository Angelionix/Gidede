"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { useActiveProject } from "@/hooks/useActiveProject";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Plus,
  Search,
  MoreVertical,
  Trash2,
  FolderOpen,
  Gamepad2,
  Shuffle,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import { generateRandomProject } from "@/lib/project-generator";
import { PROJECT_TEMPLATES, TEMPLATE_CATEGORIES, type ProjectTemplate } from "@/lib/project-templates";
import { GENRES } from "@/config/genres";

// ============================================================
// Types
// ============================================================

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  status: string;
  completion_percent: number;
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

interface ProjectsListData {
  projects: ProjectData[];
  total: number;
  page: number;
  per_page: number;
}

// ============================================================
// Status badge helper
// ============================================================

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    draft: { label: "Черновик", variant: "secondary" },
    active: { label: "Активный", variant: "default" },
    completed: { label: "Завершён", variant: "outline" },
    archived: { label: "Архив", variant: "destructive" },
  };
  const { label, variant } = variants[status] || { label: status, variant: "secondary" };
  return <Badge variant={variant}>{label}</Badge>;
}

// ============================================================
// Project card
// ============================================================

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectData;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const filledBlocks = [
    project.has_concept && "Концепция",
    project.has_core_loop && "Core Loop",
    project.has_mda && "MDA",
    project.has_balance && "Баланс",
    project.has_progression && "Прогрессия",
    project.has_economy && "Экономика",
    project.has_gdd && "GDD",
    project.has_checklist && "Валидация",
  ].filter(Boolean) as string[];

  return (
    <Card className="hover:shadow-md transition-all duration-200 cursor-pointer" onClick={() => onOpen(project.id)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{project.name}</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge status={project.status} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Действия с проектом">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onOpen(project.id)}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Открыть
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(project.id);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {project.genre && (
          <CardDescription className="text-sm text-muted-foreground">
            {project.genre}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pb-3">
        {project.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
            {project.description}
          </p>
        )}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Прогресс</span>
            <span className="font-medium">{project.completion_percent}%</span>
          </div>
          <Progress value={project.completion_percent} className="h-2" />
        </div>
        {filledBlocks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {filledBlocks.map((block) => (
              <Badge key={block} variant="outline" className="text-xs">
                {block}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        Обновлён: {new Date(project.updated_at).toLocaleDateString("ru-RU")}
      </CardFooter>
    </Card>
  );
}

// ============================================================
// Create project dialog
// ============================================================

function CreateProjectDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, description: string, genre: string, subgenres: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateCategory, setTemplateCategory] = useState("All");

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreate(name.trim(), description.trim(), genre.trim(), subgenres);
      setName("");
      setDescription("");
      setGenre("");
      setSubgenres([]);
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleRandomize = () => {
    const idea = generateRandomProject();
    setName(idea.name);
    setDescription(idea.description);
    setGenre(idea.genre);
  };

  const applyTemplate = (t: ProjectTemplate) => {
    setName(t.name);
    setDescription(t.description);
    setGenre(t.genre);
    setShowTemplates(false);
  };

  const toggleSubgenre = (g: string) => {
    setSubgenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const filteredTemplates = templateCategory === "All"
    ? PROJECT_TEMPLATES
    : PROJECT_TEMPLATES.filter((t) => t.category === templateCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый проект</DialogTitle>
          <DialogDescription>
            Создайте новый игровой проект. Вы сможете заполнить данные позже.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* Action buttons row */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowTemplates(!showTemplates)}
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/5"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Шаблоны
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRandomize}
              className="gap-1.5"
            >
              <Shuffle className="h-5 w-5" />
              Случайно
            </Button>
          </div>

          {/* Templates grid */}
          {showTemplates && (
            <div className="space-y-2">
              {/* Category filter */}
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setTemplateCategory(cat)}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      templateCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {/* Template cards */}
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredTemplates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="flex items-start gap-2 rounded-lg border border-border p-2 text-left hover:border-primary/40 hover:bg-primary/5 transition-all"
                  >
                    <span className="text-xl shrink-0">{t.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.genre} • {t.coreLoopType}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <label htmlFor="name" className="text-sm font-medium">
              Название *
            </label>
            <Input
              id="name"
              placeholder="Мой игровой проект"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="description" className="text-sm font-medium">
              Описание идеи
            </label>
            <Input
              id="description"
              placeholder="Краткое описание вашей игры (1-5 предложений)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="genre" className="text-sm font-medium">
              Основной жанр
            </label>
            <Input
              id="genre"
              placeholder="RPG, Shooter, Strategy... (можно определить автоматически)"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Уточняющие под-жанры (опционально)
            </label>
            <p className="text-xs text-muted-foreground">
              Выберите один или несколько под-жанров. Например: основной — RPG,
              под-жанры — Roguelike, Dark Fantasy. Это поможет AI точнее подобрать механики.
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto rounded-md border border-border p-2">
              {GENRES.map((g) => {
                const selected = subgenres.includes(g.value);
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => toggleSubgenre(g.value)}
                    className={`rounded-full px-2.5 py-0.5 text-xs transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
            {subgenres.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Выбрано: {subgenres.length}
              </p>
            )}
          </div>
          {(name || description || genre) && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
              <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div className="text-muted-foreground">
                {description ? (
                  <span>
                    Концепт: <strong className="text-foreground">{name || "—"}</strong>
                    {genre && <span> • {genre}</span>}
                    {subgenres.length > 0 && <span> • {subgenres.join(", ")}</span>}. Нажмите «Создать проект»
                    или «Создать случайно» ещё раз для другого варианта.
                  </span>
                ) : (
                  <span>Заполните поля вручную или нажмите «Создать случайно».</span>
                )}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating ? "Создание..." : "Создать проект"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main page
// ============================================================

export default function ProjectsPage() {
  const { apiFetch, isAuthenticated, isLoading: authLoading } = useAuth();
  const { setActiveProject } = useActiveProject();
  const router = useRouter();

  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const perPage = 20;

  // Fetch projects
  const fetchProjects = async (p: number = 1, s: string = "") => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        per_page: String(perPage),
      });
      if (s) params.set("search", s);

      const data: ProjectsListData = await apiFetch(`/projects/?${params}`);
      setProjects(data.projects);
      setTotal(data.total);
      setPage(data.page);
    } catch {
      // Auth errors handled by apiFetch
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchProjects(1, search);
    }
  }, [authLoading, isAuthenticated]);

  // Create project
  const handleCreate = async (name: string, description: string, genre: string, subgenres: string[]) => {
    const body: Record<string, unknown> = { name };
    if (description) body.description = description;
    if (genre) body.genre = genre;
    if (subgenres.length > 0) body.subgenres = subgenres;

    const created = await apiFetch<{ id: string }>("/projects", {
      method: "POST",
      body: JSON.stringify(body),
    });
    // Set the newly-created project as active so block pages pick it up
    if (created?.id) {
      setActiveProject(created.id);
    }
    fetchProjects(1, search);
  };

  // Delete project
  const handleDelete = async (projectId: string) => {
    if (!confirm("Удалить проект? Это действие нельзя отменить.")) return;
    try {
      await apiFetch(`/projects/${projectId}`, { method: "DELETE" });
      fetchProjects(page, search);
    } catch {
      // Error handling
    }
  };

  // Open project — set as active and navigate to the project detail card
  const handleOpen = (projectId: string) => {
    setActiveProject(projectId);
    router.push(`/projects/${projectId}`);
  };

  // Search handler
  const handleSearch = (value: string) => {
    setSearch(value);
    fetchProjects(1, value);
  };

  // Auth guard
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    router.push("/login");
    return null;
  }

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="container max-w-6xl mx-auto py-6 md:py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Мои проекты</h1>
          <p className="text-muted-foreground mt-1">
            Управление игровыми проектами. От идеи до GDD.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Новый проект
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию или описанию..."
          className="pl-10"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Projects grid */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="text-muted-foreground">Загрузка проектов...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[30vh] text-center">
          <Gamepad2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Нет проектов</h2>
          <p className="text-muted-foreground mb-4">
            {search
              ? "Ничего не найдено по вашему запросу."
              : "Создайте свой первый игровой проект и начните путь от идеи до GDD."}
          </p>
          {!search && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Создать проект
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => fetchProjects(page - 1, search)}
              >
                Назад
              </Button>
              <span className="text-sm text-muted-foreground">
                Страница {page} из {totalPages} ({total} проектов)
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => fetchProjects(page + 1, search)}
              >
                Вперёд
              </Button>
            </div>
          )}
        </>
      )}

      {/* Create dialog */}
      <CreateProjectDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreate={handleCreate}
      />
    </div>
  );
}
