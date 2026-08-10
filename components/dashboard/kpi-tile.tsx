import Link from "next/link";
import { cn } from "@/lib/utils";

export function KpiTile({
  label,
  value,
  hint,
  href,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  tone?: "default" | "warning" | "positive" | "muted";
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3 transition-colors",
        href && "hover:bg-muted/40",
        tone === "warning" && "border-orange-500/30 bg-orange-500/5",
        tone === "positive" && "border-emerald-500/25 bg-emerald-500/5"
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div>
        <p
          className={cn(
            "text-xl font-semibold tracking-tight tabular-nums sm:text-2xl",
            tone === "warning" &&
              "text-orange-700 dark:text-orange-400",
            tone === "positive" &&
              "text-emerald-700 dark:text-emerald-400",
            tone === "muted" && "text-muted-foreground"
          )}
        >
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-xl"
      >
        {body}
      </Link>
    );
  }
  return body;
}
