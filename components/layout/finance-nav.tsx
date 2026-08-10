"use client";

import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/layout/nav-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const mainTabs: {
  href: string;
  label: string;
  shortLabel?: string;
  exact?: boolean;
}[] = [
  { href: "/finance", label: "Overview", shortLabel: "Home", exact: true },
  { href: "/finance/accounts", label: "Bank accounts", shortLabel: "Banks" },
  { href: "/finance/transactions", label: "Transactions", shortLabel: "Txns" },
  { href: "/finance/invoices", label: "Invoices" },
  { href: "/finance/ar", label: "AR" },
  { href: "/finance/reports", label: "Reports" },
];

const moreTabs: { href: string; label: string }[] = [
  { href: "/finance/reconcile", label: "Reconcile" },
  { href: "/finance/categories", label: "Categories" },
];

export function FinanceNav() {
  const pathname = usePathname();
  const router = useRouter();
  const moreActive = moreTabs.some(
    (tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  );

  return (
    <nav
      className="relative flex items-center border-b border-border"
      aria-label="Finance sections"
    >
      {/* Spacer balances the More control so main tabs stay centered */}
      <div className="hidden w-16 shrink-0 sm:block" aria-hidden />

      <div className="mx-auto grid min-w-0 flex-1 grid-cols-3 gap-x-1 sm:grid-cols-6 sm:gap-x-2">
        {mainTabs.map((tab) => {
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
                "inline-flex h-9 w-full items-center justify-center border-b-2 px-1 text-center text-sm font-medium transition-colors duration-[var(--motion-instant)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="hidden lg:inline">{tab.label}</span>
              <span className="lg:hidden">{tab.shortLabel ?? tab.label}</span>
            </NavLink>
          );
        })}
      </div>

      <div className="flex w-16 shrink-0 justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 gap-1.5 border-b-2 px-2",
                  moreActive
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground"
                )}
              >
                <MoreHorizontal className="size-4" />
                <span className="sr-only sm:not-sr-only sm:inline">More</span>
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-44">
            {moreTabs.map((tab) => (
              <DropdownMenuItem
                key={tab.href}
                onClick={() => router.push(tab.href)}
              >
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
