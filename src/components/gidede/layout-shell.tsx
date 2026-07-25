"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { GidedeSidebar } from "@/components/gidede/sidebar";
import { PipelineNotifications } from "@/components/gidede/pipeline-notifications";
import { usePipeline } from "@/hooks/use-pipeline";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { Loader2 } from "lucide-react";

/** Routes that don't require authentication. */
const PUBLIC_ROUTES = ["/", "/login", "/register"];

/** Route prefixes that require authentication. */
const PROTECTED_PREFIXES = [
  "/blocks",
  "/projects",
  "/prototypes",
  "/settings",
  "/knowledge",
  "/pipeline",
  "/prototype-editor",
];

function isProtectedRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return false;
  }
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const isProtected = isProtectedRoute(pathname);

  // Client-side auth guard: redirect to /login if unauthenticated on a
  // protected route. This replaces the old middleware redirect which was
  // "split-brained" with the localStorage-based auth (cookies expired
  // after 30 min but localStorage tokens lived much longer, causing an
  // infinite /login → / → /login → / redirect loop).
  useEffect(() => {
    if (isLoading) return; // Wait for auth state to initialize
    if (isProtected && !isAuthenticated) {
      const loginUrl = `/login?callbackUrl=${encodeURIComponent(pathname)}`;
      router.replace(loginUrl);
    }
  }, [isProtected, isAuthenticated, isLoading, pathname, router]);

  // Pipeline-уведомления для активного проекта
  const projectId = typeof window !== "undefined"
    ? localStorage.getItem("gidede_active_project") || null
    : null;
  const { notifications, clearStale } = usePipeline(projectId);

  // Auth pages (login/register) get a bare layout — no sidebar.
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // While checking auth on a protected route, show a spinner instead of
  // flashing the sidebar + page content before the redirect fires.
  if (isProtected && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // If on a protected route and not authenticated, show spinner while
  // the useEffect redirect fires (prevents flash of protected content).
  if (isProtected && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
