"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Primary app navigation link.
 * Uses Next's default `auto` prefetch so soft navigations can show the nearest
 * `loading.tsx` skeleton quickly.
 *
 * Pending affordance is local state (not `useLinkStatus`) so SSR/client trees
 * stay identical and Base UI `useId` values hydrate cleanly.
 */
export function NavLink({
  href,
  active,
  className,
  children,
  exact,
  onClick,
}: {
  href: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
  exact?: boolean;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  const pathname = usePathname();
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    setPending(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      prefetch="auto"
      className={cn(
        "relative outline-none transition-[color,background-color,opacity,border-color] duration-[var(--motion-fast)]",
        "focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "active:opacity-80",
        pending && "opacity-70",
        className
      )}
      aria-current={active ? "page" : undefined}
      data-nav-exact={exact ? "" : undefined}
      data-pending={pending ? "" : undefined}
      onClick={(e) => {
        // Soft-nav pending cue until pathname updates
        if (
          !e.defaultPrevented &&
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          const targetPath = href.split("?")[0] ?? href;
          if (targetPath !== pathname) setPending(true);
        }
        onClick?.(e);
      }}
    >
      <span
        className={cn(
          "pointer-events-none absolute inset-0 rounded-md bg-sidebar-accent/40 transition-opacity duration-[var(--motion-instant)]",
          pending ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      />
      {children}
    </Link>
  );
}
