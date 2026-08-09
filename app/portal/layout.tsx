import { PortalShell } from "@/components/layout/portal-shell";

/**
 * Keep this layout sync (no await) so soft navigations can paint
 * `loading.tsx` while page data resolves. Auth is gated in middleware;
 * pages that need customer context call `requirePortalContext()`.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PortalShell>{children}</PortalShell>;
}
