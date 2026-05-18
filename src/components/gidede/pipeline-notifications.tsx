"use client";

import { AlertTriangle, X, ArrowRight } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import type { PipelineNotification } from "@/hooks/use-pipeline";

// ============================================================
// КОМПОНЕНТ: Одиночное уведомление
// ============================================================

interface StaleNotificationProps {
  notification: PipelineNotification;
  onDismiss: (blockId: number) => void;
}

function StaleNotification({ notification, onDismiss }: StaleNotificationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const blockHref = `/blocks/${notification.block_id}`;

  return (
    <Alert
      variant="default"
      className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 relative"
    >
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-300 text-sm font-medium">
        {notification.block_name} — данные устарели
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-400 text-xs">
        <p>{notification.message}</p>
        {notification.stale_since && (
          <p className="mt-1 text-[10px] text-amber-600 dark:text-amber-500">
            Устарело с:{" "}
            {new Date(notification.stale_since).toLocaleString("ru-RU")}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs border-amber-500/50 text-amber-700 hover:text-amber-800 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/30"
            asChild
          >
            <Link href={blockHref}>
              Перейти к блоку
              <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-amber-600 hover:text-amber-800"
            onClick={() => {
              setDismissed(true);
              onDismiss(notification.block_id);
            }}
          >
            Скрыть
          </Button>
        </div>
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-5 w-5 text-amber-600 hover:text-amber-800"
        onClick={() => {
          setDismissed(true);
          onDismiss(notification.block_id);
        }}
      >
        <X className="h-3 w-3" />
      </Button>
    </Alert>
  );
}

// ============================================================
// КОМПОНЕНТ: Лента уведомлений
// ============================================================

interface PipelineNotificationsProps {
  notifications: PipelineNotification[];
  onDismiss?: (blockId: number) => void;
  maxVisible?: number;
}

export function PipelineNotifications({
  notifications,
  onDismiss,
  maxVisible = 3,
}: PipelineNotificationsProps) {
  if (!notifications.length) return null;

  const visible = notifications.slice(0, maxVisible);
  const remaining = notifications.length - maxVisible;

  const handleDismiss = (blockId: number) => {
    onDismiss?.(blockId);
  };

  return (
    <div className="space-y-2">
      {visible.map((n) => (
        <StaleNotification
          key={`stale-${n.block_id}`}
          notification={n}
          onDismiss={handleDismiss}
        />
      ))}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Ещё {remaining} уведомлени{remaining === 1 ? "е" : remaining < 5 ? "я" : "й"}
        </p>
      )}
    </div>
  );
}
