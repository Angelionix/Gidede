import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { GidedeSidebar } from "@/components/gidede/sidebar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AuthProvider } from "@/lib/auth";
import { LayoutShell } from "@/components/gidede/layout-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gidede — Game Design AI System",
  description: "AI-powered Game Design Assistant. От идеи до GDD за 60 минут.",
  keywords: ["gamedesign", "AI", "GDD", "MDA", "Core Loop", "balance"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthProvider>
          <LayoutShell>{children}</LayoutShell>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
