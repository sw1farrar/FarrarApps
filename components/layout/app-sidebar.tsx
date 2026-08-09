"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Wallet,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NavLink } from "@/components/layout/nav-link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/finance", label: "Finance", icon: Wallet },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppSidebar({
  collapsed,
  onToggle,
  profile,
  onNavigate,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  profile: Profile | null;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const { clearProfileCache } = await import("@/lib/auth/profile-cache");
    clearProfileCache();
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/auth/signout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-150",
          collapsed ? "w-14" : "w-56",
          className
        )}
      >
        <div
          className={cn(
            "flex shrink-0 items-center",
            collapsed ? "h-12 justify-center px-2" : "w-full px-3 py-3"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/farrar_apps_logo.png?v=3"
            alt="Farrar Apps"
            className={cn(
              "bg-transparent object-contain object-center",
              collapsed ? "h-8 w-auto" : "h-auto w-full"
            )}
          />
        </div>

        <Separator />

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            const content = (
              <span
                className={cn(
                  "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-sm transition-colors duration-150",
                  active
                    ? "border-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "border-transparent text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="flex-1 text-left">{item.label}</span>
                )}
              </span>
            );

            const link = (
              <NavLink
                href={item.href}
                active={active}
                className="block"
                onClick={onNavigate}
              >
                {content}
              </NavLink>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger render={<div className="block w-full" />}>
                    {link}
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{link}</div>;
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-border p-2">
          {!collapsed && (
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium">
                {profile?.full_name || profile?.email || "Loading…"}
              </p>
              <p className="truncate text-[11px] capitalize text-muted-foreground">
                {profile?.role || " "}
              </p>
            </div>
          )}
          <div
            className={cn("flex gap-1", collapsed && "flex-col items-center")}
          >
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onToggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <PanelLeft className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={handleSignOut}
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
