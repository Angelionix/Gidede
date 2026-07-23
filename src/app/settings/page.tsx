"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Settings,
  Moon,
  Sun,
  Monitor,
  User,
  Zap,
  Shield,
  Bell,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

const THEME_OPTIONS = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Системная", icon: Monitor },
] as const;

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState({
    pipeline: true,
    aiAlerts: true,
    email: false,
  });

  const aiUsagePercent = user
    ? Math.min(100, Math.round((user.ai_calls_count / user.ai_calls_limit) * 100))
    : 0;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Настройки</h1>
          <p className="text-sm text-muted-foreground">
            Управление темой, уведомлениями и аккаунтом
          </p>
        </div>
      </div>

      {/* Theme settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            Внешний вид
          </CardTitle>
          <CardDescription>Выберите цветовую тему интерфейса</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {THEME_OPTIONS.map((opt) => {
              const isActive = theme === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <opt.icon
                    className={`h-6 w-6 ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`text-sm font-medium ${
                      isActive ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {opt.label}
                  </span>
                  {isActive && (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Аккаунт
          </CardTitle>
          <CardDescription>Информация о пользователе</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold">
                    {(user.name || user.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{user.name || "Пользователь"}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {user.email}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={user.plan === "pro" ? "default" : "secondary"}
                  className="uppercase"
                >
                  {user.plan}
                </Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Дата регистрации</p>
                  <p className="font-medium">
                    {new Date(user.created_at).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Статус</p>
                  <p className="font-medium flex items-center gap-1">
                    <Shield className="h-3 w-3 text-emerald-500" />
                    {user.is_active ? "Активен" : "Заблокирован"}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Войдите в аккаунт для просмотра информации.
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI usage */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Использование AI
            </CardTitle>
            <CardDescription>
              Лимит AI-запросов для вашего тарифа
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Использовано</span>
              <span className="font-medium">
                {user.ai_calls_count} / {user.ai_calls_limit} запросов
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all"
                style={{ width: `${aiUsagePercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {user.ai_calls_limit - user.ai_calls_count} запросов осталось до
              сброса (ежедневно)
            </p>
            {user.plan === "free" && (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Хотите больше запросов?
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Обновитесь до тарифа Pro для 500 запросов в день.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Уведомления
          </CardTitle>
          <CardDescription>
            Управление уведомлениями системы
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notif-pipeline" className="text-sm font-medium">
                Stale-данные пайплайна
              </Label>
              <p className="text-xs text-muted-foreground">
                Уведомлять об устаревших данных в блоках
              </p>
            </div>
            <Switch
              id="notif-pipeline"
              checked={notifications.pipeline}
              onCheckedChange={(v) =>
                setNotifications((n) => ({ ...n, pipeline: v }))
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notif-ai" className="text-sm font-medium">
                AI-предупреждения
              </Label>
              <p className="text-xs text-muted-foreground">
                Проактивные подсказки от AI-ассистента
              </p>
            </div>
            <Switch
              id="notif-ai"
              checked={notifications.aiAlerts}
              onCheckedChange={(v) =>
                setNotifications((n) => ({ ...n, aiAlerts: v }))
              }
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notif-email" className="text-sm font-medium">
                Email-уведомления
              </Label>
              <p className="text-xs text-muted-foreground">
                Отчёты и новости на почту
              </p>
            </div>
            <Switch
              id="notif-email"
              checked={notifications.email}
              onCheckedChange={(v) =>
                setNotifications((n) => ({ ...n, email: v }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">О приложении</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div className="flex justify-between">
            <span>Версия</span>
            <span className="font-mono font-medium text-foreground">v0.51.0</span>
          </div>
          <div className="flex justify-between">
            <span>Фреймворк</span>
            <span className="font-medium text-foreground">Next.js 16</span>
          </div>
          <div className="flex justify-between">
            <span>Backend</span>
            <span className="font-medium text-foreground">Next.js API Routes</span>
          </div>
          <div className="flex justify-between">
            <span>База данных</span>
            <span className="font-medium text-foreground">SQLite (Prisma)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
