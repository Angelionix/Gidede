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
  Lightbulb,
  RefreshCw,
  FlaskConical,
  Scale,
  TrendingUp,
  FileText,
  Bot,
  Puzzle,
  Home,
  Settings,
  Gamepad2,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const blocks = [
  {
    id: 1,
    name: "Генератор концепции",
    icon: Lightbulb,
    href: "/blocks/1",
    status: "skeleton" as const,
    algorithm: "3.1",
  },
  {
    id: 2,
    name: "Core Loop Designer",
    icon: RefreshCw,
    href: "/blocks/2",
    status: "skeleton" as const,
    algorithm: "3.2",
  },
  {
    id: 3,
    name: "MDA Lab",
    icon: FlaskConical,
    href: "/blocks/3",
    status: "skeleton" as const,
    algorithm: "3.3",
  },
  {
    id: 4,
    name: "Баланс и симуляция",
    icon: Scale,
    href: "/blocks/4",
    status: "skeleton" as const,
    algorithm: "3.4",
  },
  {
    id: 5,
    name: "Экономика и прогрессия",
    icon: TrendingUp,
    href: "/blocks/5",
    status: "skeleton" as const,
    algorithm: "3.5–3.6",
  },
  {
    id: 6,
    name: "GDD Generator",
    icon: FileText,
    href: "/blocks/6",
    status: "skeleton" as const,
    algorithm: "3.7–3.8",
  },
  {
    id: 7,
    name: "AI-ассистент",
    icon: Bot,
    href: "/blocks/7",
    status: "skeleton" as const,
    algorithm: "3.9",
  },
  {
    id: 8,
    name: "Интеграция GBE",
    icon: Puzzle,
    href: "/blocks/8",
    status: "planned" as const,
    algorithm: "—",
  },
];

const statusColors: Record<string, string> = {
  skeleton: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  planned: "bg-gray-500/20 text-gray-500",
  active: "bg-green-500/20 text-green-700 dark:text-green-400",
  complete: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};

const statusLabels: Record<string, string> = {
  skeleton: "Скелет",
  planned: "План",
  active: "Активен",
  complete: "Готов",
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

export function GidedeSidebar() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout } = useAuth();

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Блоки */}
        <SidebarGroup>
          <SidebarGroupLabel>Функциональные блоки</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {blocks.map((block) => (
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
                        className={`text-[10px] px-1 py-0 ${statusColors[block.status]}`}
                      >
                        {statusLabels[block.status]}
                      </Badge>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
                  className="text-destructive hover:text-destructive"
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
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
                Войти
              </Link>
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground px-2 pt-1">
          Фаза 4.A • v0.1.0
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
