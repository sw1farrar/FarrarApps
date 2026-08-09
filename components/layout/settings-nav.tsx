"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/layout/nav-link";

const tabs: { href: string; label: string; exact?: boolean }[] = [
  { href: "/settings", label: "Company", exact: true },
  { href: "/settings/users", label: "Users" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/workspace", label: "Workspace" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      className="relative flex items-center border-b border-border"
      aria-label="Settings sections"
    >
      <div className="mx-auto grid min-w-0 w-full flex-1 grid-cols-2 gap-x-1 sm:grid-cols-4 sm:gap-x-2">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <NavLink
              key={tab.href}
              href={tab.href}
              active={active}
              exact={tab.exact}
              className={cn(
                "inline-flex h-9 w-full items-center justify-center border-b-2 px-1 text-center text-sm font-medium transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
