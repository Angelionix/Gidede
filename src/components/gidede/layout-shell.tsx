"use client";

import { usePathname } from "next/navigation";
import { GidedeSidebar } from "@/components/gidede/sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";

const AUTH_ROUTES = ["/login", "/register"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider>
      <GidedeSidebar />
      <SidebarInset>
        <main className="flex-1 overflow-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
