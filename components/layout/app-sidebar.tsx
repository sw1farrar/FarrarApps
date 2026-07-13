"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  ArrowLeftRight,
  BarChart3,
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
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ready: true },
  { href: "/customers", label: "Customers", icon: Users, ready: true },
  { href: "/projects", label: "Projects", icon: FolderKanban, ready: true },
  { href: "/invoices", label: "Invoices", icon: FileText, ready: true },
  {
    href: "/transactions",
    label: "Transactions",
    icon: ArrowLeftRight,
    ready: true,
  },
  { href: "/reports", label: "Reports", icon: BarChart3, ready: true },
  { href: "/settings", label: "Settings", icon: Settings, ready: true },
] as const;

export function AppSidebar({
  collapsed,
  onToggle,
  profile,
}: {
  collapsed: boolean;
  onToggle: () => void;
  profile: Profile;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <TooltipProvider delay={0}>
      <aside
        className={cn(
          "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
          collapsed ? "w-14" : "w-56"
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

        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            const content = (
              <span
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  !item.ready && "opacity-50",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="size-4 shrink-0" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {!item.ready && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Soon
                      </span>
                    )}
                  </>
                )}
              </span>
            );

            const linkOrSpan = item.ready ? (
              <Link href={item.href} className="block">
                {content}
              </Link>
            ) : (
              <div className="cursor-not-allowed">{content}</div>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger
                    render={<div className="block w-full" />}
                  >
                    {linkOrSpan}
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.label}
                    {!item.ready ? " (soon)" : ""}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return <div key={item.href}>{linkOrSpan}</div>;
          })}
        </nav>

        <div className="mt-auto space-y-1 border-t border-border p-2">
          {!collapsed && (
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium">
                {profile.full_name || profile.email}
              </p>
              <p className="truncate text-[11px] capitalize text-muted-foreground">
                {profile.role}
              </p>
            </div>
          )}
          <div className={cn("flex gap-1", collapsed && "flex-col items-center")}>
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
