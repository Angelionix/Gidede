"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2, Loader2, Circle, AlertTriangle } from "lucide-react";
import { usePipeline, type BlockStatus } from "@/hooks/use-pipeline";
import { BLOCKS } from "@/config/blocks";

interface PipelineFlowIndicatorProps {
  currentBlock: number;
  /** Максимальный отображаемый блок (по умолчанию 5, было 3) */
  maxBlock?: number;
}

function StatusIcon({ status }: { status: BlockStatus | undefined }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "in_progress":
      return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    case "stale":
      return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    case "empty":
    default:
      return <Circle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function PipelineFlowIndicator({ currentBlock, maxBlock = 5 }: PipelineFlowIndicatorProps) {
  const projectId = typeof window !== "undefined" ? localStorage.getItem("gidede_active_project") : null;
  const { state } = usePipeline(projectId);

  const getBlockStatus = (blockId: number): BlockStatus | undefined => {
    return state?.blocks?.find((b) => b.block_id === blockId)?.status;
  };

  const visibleBlocks = BLOCK_LABELS.filter((b) => b.id <= maxBlock);

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/30 flex-wrap">
      {visibleBlocks.map((block, idx) => {
        const status = getBlockStatus(block.id);
        const isCurrent = block.id === currentBlock;

        return (
          <React.Fragment key={block.id}>
            <div className="flex items-center gap-1.5">
              <StatusIcon status={status} />
              <span
                className={`text-xs font-medium ${
                  isCurrent
                    ? "text-primary"
                    : status === "completed"
                      ? "text-green-600 dark:text-green-400"
                      : "text-muted-foreground"
                }`}
              >
                {block.name}
              </span>
              {isCurrent && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  текущий
                </Badge>
              )}
            </div>
            {idx < visibleBlocks.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
