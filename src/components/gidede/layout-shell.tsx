"use client";

import { usePathname } from "next/navigation";
import { GidedeSidebar } from "@/components/gidede/sidebar";
import { PipelineNotifications } from "@/components/gidede/pipeline-notifications";
import { usePipeline } from "@/hooks/use-pipeline";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

const AUTH_ROUTES = ["/login", "/register"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  // Pipeline-уведомления для активного проекта
  const projectId = typeof window !== "undefined"
    ? localStorage.getItem("gidede_active_project") || null
    : null;
  const { notifications, clearStale } = usePipeline(projectId);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <GidedeSidebar />
      <SidebarInset>
        <main className="flex-1 overflow-auto">
          {/* Pipeline-уведомления о stale-данных */}
          {notifications.length > 0 && (
            <div className="px-4 pt-4">
              <PipelineNotifications
                notifications={notifications}
                onDismiss={(blockId) => clearStale(blockId)}
              />
            </div>
          )}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
