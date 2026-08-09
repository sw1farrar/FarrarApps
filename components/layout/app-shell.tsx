"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createClient } from "@/lib/supabase/client";
import {
  getCachedProfile,
  loadProfileOnce,
  subscribeProfileCache,
} from "@/lib/auth/profile-cache";
import type { Profile } from "@/lib/types/database";

function pageTitleFromPath(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return "Dashboard";
  }
  if (pathname.startsWith("/finance")) return "Finance";
  if (pathname.startsWith("/customers")) return "Customers";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/activity")) return "Activity";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/transactions")) return "Transactions";
  if (pathname.startsWith("/reports")) return "Reports";
  return "Farrar Apps";
}

const CommandPalette = dynamic(
  () =>
    import("@/components/layout/command-palette").then(
      (mod) => mod.CommandPalette
    ),
  { ssr: false }
);

const NotificationsBell = dynamic(
  () =>
    import("@/components/layout/notifications-bell").then(
      (mod) => mod.NotificationsBell
    ),
  { ssr: false }
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageTitle = pageTitleFromPath(pathname);
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
  const [profile, setProfile] = React.useState<Profile | null>(getCachedProfile());

  React.useEffect(() => {
    let cancelled = false;
    void loadProfileOnce(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("profiles")
        .select(
          "id, email, full_name, role, theme_preference, avatar_url, created_at, updated_at"
        )
        .eq("id", user.id)
        .single();

      return (data as Profile | null) ?? null;
    }).then((next) => {
      if (!cancelled) setProfile(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    return subscribeProfileCache((next) => {
      if (next) setProfile(next);
    });
  }, []);

  return (
    <ConfirmProvider>
    <div className="flex h-svh overflow-hidden bg-background">
      <KeyboardShortcuts />

      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          profile={profile}
        />
      </div>

      {/* Mobile nav drawer */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(18rem,88vw)] p-0 md:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <AppSidebar
            collapsed={false}
            onToggle={() => setMobileNavOpen(false)}
            profile={profile}
            onNavigate={() => setMobileNavOpen(false)}
            className="h-full w-full border-0"
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-3 sm:h-14 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
              {pageTitle}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <CommandPalette />
            <NotificationsBell />
            <ThemeToggle userId={profile?.id} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4 [&>*]:min-h-0">
          {children}
        </main>
      </div>
    </div>
    </ConfirmProvider>
  );
}
