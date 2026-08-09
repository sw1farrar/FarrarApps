import { Badge } from "@/components/ui/badge";
import type { PortalAccessStatus } from "@/lib/data/portal-status";
import { cn } from "@/lib/utils";

const LABELS: Record<PortalAccessStatus, string> = {
  active: "Portal",
  pending: "Invite pending",
  none: "No portal",
};

export function PortalStatusBadge({
  status,
  className,
}: {
  status: PortalAccessStatus;
  className?: string;
}) {
  return (
    <Badge
      variant={status === "active" ? "secondary" : "outline"}
      className={cn(
        status === "pending" && "border-amber-500/40 text-amber-700 dark:text-amber-400",
        status === "none" && "text-muted-foreground",
        className
      )}
    >
      {LABELS[status]}
    </Badge>
  );
}
