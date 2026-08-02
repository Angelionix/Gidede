"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { GidedeSidebar } from "@/components/gidede/sidebar";
import { PipelineNotifications } from "@/components/gidede/pipeline-notifications";
import { usePipeline } from "@/hooks/use-pipeline";
import { useAuth } from "@/lib/auth";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { Loader2 } from "lucide-react";

const AUTH_ROUTES = ["/login", "/register"];

// Routes that don't require authentication (public pages)
const PUBLIC_ROUTES = ["/", "/login", "/register"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Client-side auth guard: redirect to /login if not authenticated
  // (replaces middleware redirect which doesn't work in preview iframe)
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !isAuthRoute && !isPublicRoute) {
      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      router.push(loginUrl.pathname + loginUrl.search);
    }
  }, [isLoading, isAuthenticated, isAuthRoute, isPublicRoute, pathname, router]);

  // Pipeline-уведомления для активного проекта
  const projectId = typeof window !== "undefined"
    ? localStorage.getItem("gidede_active_project") || null
    : null;
  const { notifications, clearStale } = usePipeline(projectId);

  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Show loading spinner while auth state is being determined (for protected routes only)
  if (!isPublicRoute && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
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
