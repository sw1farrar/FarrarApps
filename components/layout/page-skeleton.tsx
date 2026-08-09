import { cn } from "@/lib/utils";

export function PageSkeleton({
  cards = 4,
  className,
}: {
  cards?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4 animate-pulse", className)}>
      <div className="space-y-2">
        <div className="h-5 w-40 rounded bg-muted" />
        <div className="h-3 w-64 rounded bg-muted/70" />
      </div>
      <div
        className={cn(
          "grid gap-3",
          cards <= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4"
        )}
      >
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="h-20 rounded-lg border border-border bg-muted/40"
          />
        ))}
      </div>
      <div className="h-64 rounded-lg border border-border bg-muted/30" />
    </div>
  );
}
