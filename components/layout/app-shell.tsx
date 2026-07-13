"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import type { Profile } from "@/lib/types/database";

export function AppShell({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(false);

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <KeyboardShortcuts />
      <AppSidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        profile={profile}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium tracking-tight">
              Farrar Apps
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <CommandPalette />
            <NotificationsBell />
            <ThemeToggle userId={profile.id} />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
      </div>
    </div>
  );
}
