import { cn } from "@/lib/utils";

export type PageSkeletonVariant =
  | "default"
  | "dashboard"
  | "table"
  | "detail"
  | "finance";

export function PageSkeleton({
  cards = 4,
  variant = "default",
  className,
}: {
  cards?: number;
  variant?: PageSkeletonVariant;
  className?: string;
}) {
  if (variant === "dashboard") {
    return (
      <div className={cn("space-y-5 animate-pulse", className)} aria-hidden>
        <div className="flex items-end justify-between gap-3">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded bg-muted" />
            <div className="h-3 w-72 max-w-full rounded bg-muted/70" />
          </div>
          <div className="hidden gap-2 sm:flex">
            <div className="h-7 w-20 rounded-md bg-muted/60" />
            <div className="h-7 w-24 rounded-md bg-muted/60" />
            <div className="h-7 w-28 rounded-md bg-muted" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-[4.5rem] rounded-xl border border-border bg-muted/40"
            />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <div className="space-y-4">
            <div className="h-64 rounded-xl border border-border bg-muted/30" />
            <div className="h-56 rounded-xl border border-border bg-muted/30" />
          </div>
          <div className="space-y-4">
            <div className="h-48 rounded-xl border border-border bg-muted/30" />
            <div className="h-48 rounded-xl border border-border bg-muted/30" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "table" || variant === "finance") {
    return (
      <div className={cn("space-y-4 animate-pulse", className)} aria-hidden>
        {variant === "finance" ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[4.5rem] rounded-xl border border-border bg-muted/40"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="h-8 w-48 rounded-md bg-muted/50" />
            <div className="h-8 w-28 rounded-md bg-muted" />
          </div>
        )}
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="h-10 border-b border-border bg-muted/40" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-11 border-b border-border last:border-0 bg-muted/20"
            />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div className={cn("space-y-4 animate-pulse", className)} aria-hidden>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted/60" />
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="h-3 w-64 max-w-full rounded bg-muted/70" />
          </div>
          <div className="flex gap-2">
            <div className="h-8 w-16 rounded-md bg-muted/50" />
            <div className="h-8 w-20 rounded-md bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="h-80 rounded-xl border border-border bg-muted/30" />
          <div className="h-64 rounded-xl border border-border bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 animate-pulse", className)} aria-hidden>
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
