"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home,
  Settings,
  Gamepad2,
  LogIn,
  LogOut,
  FolderOpen,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ProgressSidebar } from "@/components/gidede/progress-sidebar";
import { usePipeline } from "@/hooks/use-pipeline";
import type { BlockStatus } from "@/hooks/use-pipeline";
import { BLOCKS } from "@/config/blocks";

// ============================================================
// СТАТУСЫ РЕАЛИЗАЦИИ (dev-статус) vs RUNTIME-СТАТУС (pipeline)
// ============================================================

const devStatusColors: Record<string, string> = {
  skeleton: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  planned: "bg-gray-500/20 text-gray-500",
  active: "bg-green-500/20 text-green-700 dark:text-green-400",
  complete: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};

const devStatusLabels: Record<string, string> = {
  skeleton: "Скелет",
  planned: "План",
  active: "Активен",
  complete: "Готов",
};

// Runtime-статусы из pipeline (когда проект активен)
const runtimeStatusIcons: Record<BlockStatus, typeof CheckCircle2> = {
  empty: Circle,
  in_progress: Loader2,
  completed: CheckCircle2,
  stale: AlertTriangle,
};

const runtimeStatusColors: Record<BlockStatus, string> = {
  empty: "text-muted-foreground",
  in_progress: "text-blue-600 dark:text-blue-400",
  completed: "text-emerald-600 dark:text-emerald-400",
  stale: "text-amber-600 dark:text-amber-400",
};

const runtimeStatusLabels: Record<BlockStatus, string> = {
  empty: "Пусто",
  in_progress: "В процессе",
  completed: "Готов",
  stale: "Устарел",
};

const planLabels: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

const planColors: Record<string, string> = {
  free: "bg-secondary text-secondary-foreground",
  pro: "bg-primary text-primary-foreground",
  enterprise: "bg-amber-500 text-white",
};

// ============================================================
// ОСНОВНОЙ КОМПОНЕНТ
// ============================================================

export function GidedeSidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  // Pipeline-состояние — используем projectId из URL или localStorage
  // Для простоты берём последний активный проект из localStorage
  const projectId = typeof window !== "undefined"
    ? localStorage.getItem("gidede_active_project") || null
    : null;

  const { state: pipelineState } = usePipeline(projectId);

  // Маппинг block_id → runtime-статус
  const pipelineBlockMap = new Map<number, { status: BlockStatus; is_filled: boolean }>();
  if (pipelineState?.blocks) {
    for (const b of pipelineState.blocks) {
      pipelineBlockMap.set(b.block_id, { status: b.status, is_filled: b.is_filled });
    }
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email
        ?.slice(0, 2)
        .toUpperCase() ?? "?";

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Gamepad2 className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-lg font-bold leading-none">Gidede</h1>
            <p className="text-xs text-muted-foreground">Game Design AI</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {/* Навигация */}
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/"}>
                  <Link href="/">
                    <Home className="h-4 w-4" />
                    <span>Главная</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/projects"}>
                  <Link href="/projects">
                    <FolderOpen className="h-4 w-4" />
                    <span>Мои проекты</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Pipeline Progress — показываем, если есть активный проект */}
        {pipelineState && (
          <SidebarGroup>
            <SidebarGroupLabel>Прогресс пайплайна</SidebarGroupLabel>
            <SidebarGroupContent>
              <ProgressSidebar
                blocks={pipelineState.blocks}
                completionPercent={pipelineState.completion_percent}
                nextBlock={pipelineState.next_block}
              />
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Функциональные блоки */}
        <SidebarGroup>
          <SidebarGroupLabel>Функциональные блоки</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {BLOCKS.map((block) => {
                // Определяем, какой статус показывать
                const runtimeInfo = pipelineBlockMap.get(block.id);
                const useRuntime = runtimeInfo && pipelineState;

                // Runtime-статус (если есть проект)
                if (useRuntime && runtimeInfo) {
                  const RuntimeIcon = runtimeStatusIcons[runtimeInfo.status];
                  const rtColor = runtimeStatusColors[runtimeInfo.status];
                  const rtLabel = runtimeStatusLabels[runtimeInfo.status];
                  const isStale = runtimeInfo.status === "stale";

                  return (
                    <SidebarMenuItem key={block.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === block.href}
                      >
                        <Link href={block.href} className={isStale ? "animate-pulse" : ""}>
                          <span className="relative">
                            <block.icon className="h-4 w-4" />
                            <RuntimeIcon
                              className={`h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5 ${rtColor} ${runtimeInfo.status === "in_progress" ? "animate-spin" : ""}`}
                            />
                          </span>
                          <span className="flex-1 truncate">{block.name}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1 py-0 ${rtColor}`}
                          >
                            {rtLabel}
                          </Badge>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Dev-статус (статический, без активного проекта)
                return (
                  <SidebarMenuItem key={block.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === block.href}
                    >
                      <Link href={block.href}>
                        <block.icon className="h-4 w-4" />
                        <span className="flex-1 truncate">{block.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1 py-0 ${devStatusColors[block.status]}`}
                        >
                          {devStatusLabels[block.status]}
                        </Badge>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-3">
        {/* User info / Auth */}
        {isAuthenticated && user ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.name || user.email}
                </p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </p>
                </div>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 shrink-0 ${
                  planColors[user.plan] || planColors.free
                }`}
              >
                {planLabels[user.plan] || "Free"}
              </Badge>
            </div>
            {user.ai_calls_limit > 0 && (
              <p className="text-[11px] text-muted-foreground px-2">
                AI-запросы: {user.ai_calls_count}/{user.ai_calls_limit}
              </p>
            )}
            <SidebarSeparator />
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Настройки</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => logout()}
                  className="text-destructive hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Выйти из аккаунта"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Выйти</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        ) : (
          <div className="space-y-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/settings">
                    <Settings className="h-4 w-4" />
                    <span>Настройки</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
            <SidebarSeparator />
            <Button asChild variant="outline" className="w-full focus-visible:ring-2 focus-visible:ring-ring" size="sm">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                Войти
              </Link>
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground px-2 pt-1">
          Фаза 4.B • v0.14.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
