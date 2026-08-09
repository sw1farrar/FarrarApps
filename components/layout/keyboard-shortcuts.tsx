"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function KeyboardShortcuts() {
  const router = useRouter();

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;

      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "g") {
        const handler = (next: KeyboardEvent) => {
          window.removeEventListener("keydown", handler);
          if (next.metaKey || next.ctrlKey || next.altKey) return;
          const map: Record<string, string> = {
            d: "/dashboard",
            p: "/projects",
            c: "/customers",
            f: "/finance",
            i: "/finance/invoices",
            t: "/finance/transactions",
            r: "/finance/reports",
            a: "/activity",
            s: "/settings",
          };
          const href = map[next.key.toLowerCase()];
          if (href) {
            next.preventDefault();
            router.push(href);
          }
        };
        window.addEventListener("keydown", handler, { once: true });
        window.setTimeout(() => window.removeEventListener("keydown", handler), 1000);
      }

      if (e.key === "n") {
        const handler = (next: KeyboardEvent) => {
          window.removeEventListener("keydown", handler);
          const map: Record<string, string> = {
            c: "/customers",
            p: "/projects/new",
            i: "/finance/invoices/new",
            t: "/finance/transactions",
          };
          const href = map[next.key.toLowerCase()];
          if (href) {
            next.preventDefault();
            router.push(href);
          }
        };
        window.addEventListener("keydown", handler, { once: true });
        window.setTimeout(() => window.removeEventListener("keydown", handler), 1000);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
