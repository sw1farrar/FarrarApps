"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Receipt,
  Settings,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  FilePlus2,
  Users,
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
import type { CustomerMemberRole, Profile } from "@/lib/types/database";

const baseNavItems = [
  { href: "/portal", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/billing", label: "Billing", icon: Receipt },
  { href: "/portal/settings", label: "Settings", icon: Settings },
] as const;

export function PortalSidebar({
  collapsed,
  onToggle,
  profile,
  customerName,
  memberRole,
  onNavigate,
  className,
}: {
  collapsed: boolean;
  onToggle: () => void;
  profile: Profile | null;
  customerName?: string | null;
  memberRole?: CustomerMemberRole | null;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = React.useMemo(() => {
    const items: Array<{
      href: string;
      label: string;
      icon: typeof LayoutDashboard;
      exact?: boolean;
    }> = [...baseNavItems];
    if (memberRole === "company_admin") {
      items.splice(3, 0, {
        href: "/portal/settings/team",
        label: "Team",
        icon: Users,
      });
    }
    return items;
  }, [memberRole]);

  async function handleSignOut() {
    const { clearProfileCache } = await import("@/lib/auth/profile-cache");
    clearProfileCache();
    const supabase = createClient();
    await supabase.auth.signOut();
    await fetch("/auth/signout", { method: "POST" }).catch(() => undefined);
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
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
            collapsed ? "h-14 justify-center px-2" : "w-full px-3 py-3"
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

        {!collapsed ? (
          <div className="px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Client portal
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {customerName || "Your workspace"}
            </p>
          </div>
        ) : null}

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, "exact" in item && item.exact);
            const content = (
              <span
                className={cn(
                  "flex w-full items-center gap-2 border-l-2 px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "border-transparent text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </span>
            );

            const link = (
              <NavLink
                href={item.href}
                active={active}
                className="block w-full"
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

          {!collapsed ? (
            <Link
              href="/portal/projects?new=1"
              onClick={onNavigate}
              className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <FilePlus2 className="size-4 shrink-0" />
              New brief
            </Link>
          ) : (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/portal/projects?new=1"
                    onClick={onNavigate}
                    className="mt-2 flex items-center justify-center rounded-md border border-dashed border-border py-1.5 text-muted-foreground hover:bg-sidebar-accent/60"
                    aria-label="New brief"
                  />
                }
              >
                <FilePlus2 className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="right">New brief</TooltipContent>
            </Tooltip>
          )}
        </nav>

        <div className="mt-auto space-y-1 border-t border-border p-2">
          {!collapsed && (
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium">
                {profile?.full_name || profile?.email || "Loading…"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                Client
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
