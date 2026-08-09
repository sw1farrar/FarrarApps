"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Primary app navigation link.
 * Uses Next's default `auto` prefetch: for dynamic routes, warm the nearest
 * `loading.tsx` boundary so a click can show the skeleton immediately while
 * the page RSC streams in. Prefer this over `prefetch={true}` (full route).
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
  return (
    <Link
      href={href}
      prefetch="auto"
      className={cn(className)}
      aria-current={active ? "page" : undefined}
      data-nav-exact={exact ? "" : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
