"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BlockProgress, BlockStatus } from "@/hooks/use-pipeline";
import { BLOCKS } from "@/config/blocks";

// ============================================================
// СТАТУС ИНДИКАТОРЫ
// ============================================================

const statusConfig: Record<
  BlockStatus,
  {
    color: string;
    bgColor: string;
    label: string;
    icon: typeof CheckCircle2;
  }
> = {
  empty: {
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    label: "Пусто",
    icon: Circle,
  },
  in_progress: {
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-500/20",
    label: "В процессе",
    icon: Loader2,
  },
  completed: {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-500/20",
    label: "Готов",
    icon: CheckCircle2,
  },
  stale: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-500/20",
    label: "Устарел",
    icon: AlertTriangle,
  },
};

// ============================================================
// КОМПОНЕНТ
// ============================================================

interface ProgressSidebarProps {
  blocks: BlockProgress[];
  completionPercent: number;
  nextBlock: number | null;
}

export function ProgressSidebar({
  blocks,
  completionPercent,
  nextBlock,
}: ProgressSidebarProps) {
  const pathname = usePathname();

  // Создаём маппинг block_id → BlockProgress
  const blockMap = new Map<number, BlockProgress>();
  for (const b of blocks) {
    blockMap.set(b.block_id, b);
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-1">
        {/* Прогресс-бар */}
        <div className="px-2 pb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              Прогресс проекта
            </span>
            <span className="text-xs font-bold text-foreground">
              {completionPercent}%
            </span>
          </div>
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${completionPercent}%` }}
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Прогресс проекта: ${completionPercent}%`}
            />
          </div>
        </div>

        {/* Список блоков */}
        {BLOCKS.map((block) => {
          const progress = blockMap.get(block.id);
          const status: BlockStatus = progress?.status || "empty";
          const config = statusConfig[status];
          const isNext = nextBlock === block.id;
          const isActive = pathname === block.href;

          const StatusIcon = config.icon;

          return (
            <Tooltip key={block.id}>
              <TooltipTrigger asChild>
                <Link
                  href={block.href}
                  className={`
                    flex items-center gap-2 px-2 py-1.5 rounded-md text-sm
                    transition-colors group relative
                    ${
                      isActive
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }
                    ${isNext && !isActive ? "ring-1 ring-primary/30" : ""}
                  `}
                >
                  {/* Индикатор статуса */}
                  <span className="relative flex items-center">
                    <block.icon className="h-4 w-4 shrink-0" />
                    {status !== "empty" && (
                      <StatusIcon
                        className={`
                          h-2.5 w-2.5 absolute -bottom-0.5 -right-0.5
                          ${config.color}
                          ${status === "in_progress" ? "animate-spin" : ""}
                        `}
                      />
                    )}
                  </span>

                  {/* Название */}
                  <span className="flex-1 truncate text-xs">{block.name}</span>

                  {/* Бейдж статуса */}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1 py-0 leading-tight ${config.bgColor} ${config.color}`}
                  >
                    {config.label}
                  </Badge>

                  {/* Индикатор "Следующий" */}
                  {isNext && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="space-y-1">
                  <p className="font-medium">
                    Блок {block.id}: {block.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Алгоритм {block.algorithm}
                  </p>
                  <p className="text-xs">
                    Статус:{" "}
                    <span className={config.color}>{config.label}</span>
                  </p>
                  {progress?.stale_reason && (
                    <p className="text-xs text-amber-600">
                      Причина: {progress.stale_reason}
                    </p>
                  )}
                  {progress?.updated_at && (
                    <p className="text-xs text-muted-foreground">
                      Обновлён:{" "}
                      {new Date(progress.updated_at).toLocaleString("ru-RU")}
                    </p>
                  )}
                  {isNext && (
                    <p className="text-xs text-primary font-medium">
                      Рекомендуется заполнить следующим
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
