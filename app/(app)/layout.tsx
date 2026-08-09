import { AppShell } from "@/components/layout/app-shell";

/**
 * Intentionally synchronous. Awaiting auth/profile here blocked every soft
 * navigation (loading.tsx cannot show until the layout finishes). Middleware
 * already gates protected routes; the shell loads profile on the client once.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
