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
  UserRound,
  ChevronUp,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  // Defer Base UI menus until after hydration so auto-generated useId values
  // match between server HTML and the client tree.
  const [menusReady, setMenusReady] = React.useState(false);
  React.useEffect(() => setMenusReady(true), []);

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
          "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-[var(--motion-fast)] ease-[var(--motion-ease-exit)]",
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
                  "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-sm transition-colors duration-[var(--motion-fast)]",
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
          {menusReady ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      collapsed && "justify-center px-0"
                    )}
                    aria-label="Account menu"
                  />
                }
              >
                {collapsed ? (
                  <UserRound className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {profile?.full_name || profile?.email || "Loading…"}
                      </p>
                      <p className="truncate text-[11px] capitalize text-muted-foreground">
                        {profile?.role || " "}
                      </p>
                    </div>
                    <ChevronUp className="size-3.5 shrink-0 text-muted-foreground" />
                  </>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={collapsed ? "right" : "top"}
                align={collapsed ? "start" : "start"}
                className="min-w-48"
              >
                <DropdownMenuItem
                  onClick={() => {
                    onNavigate?.();
                    router.push("/settings/account");
                  }}
                >
                  <UserRound className="size-4" />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={handleSignOut}
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-muted-foreground",
                collapsed && "justify-center px-0"
              )}
              aria-label="Account menu"
              disabled
            >
              {collapsed ? (
                <UserRound className="size-4 shrink-0" />
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {profile?.full_name || profile?.email || "Loading…"}
                    </p>
                    <p className="truncate text-[11px] capitalize">
                      {profile?.role || " "}
                    </p>
                  </div>
                  <ChevronUp className="size-3.5 shrink-0" />
                </>
              )}
            </button>
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
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}
