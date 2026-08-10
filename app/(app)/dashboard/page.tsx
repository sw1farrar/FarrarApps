import Link from "next/link";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  FolderKanban,
  Plus,
  Users,
} from "lucide-react";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { getDashboardData } from "@/lib/data/dashboard";
import { formatCurrency, formatDate, titleCase } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DashboardChart = dynamic(
  () =>
    import("@/components/dashboard/dashboard-chart").then(
      (mod) => mod.DashboardChart
    ),
  {
    loading: () => (
      <div className="h-48 animate-pulse rounded-md bg-muted/40 sm:h-56" />
    ),
  }
);

function money(n: number) {
  return formatCurrency(n);
}

function moneyCompact(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  const {
    kpis,
    cash,
    arByCustomer,
    attention,
    projects,
    nextMilestoneByProject,
    recentActivity,
    range,
    draftInvoiceCount,
  } = data;

  const inProgress = projects.filter((p) => p.status === "in_progress");
  const planning = projects.filter((p) => p.status === "planning");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Cash &amp; collections
          </h2>
          <p className="text-sm text-muted-foreground">
            What you&apos;re owed, what&apos;s moving, and where work sits ·{" "}
            {range.label.toLowerCase()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/finance/invoices"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            <FileText className="size-3.5" />
            Invoices
          </Link>
          <Link
            href="/projects/new"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            <FolderKanban className="size-3.5" />
            New project
          </Link>
          <Link
            href="/finance/invoices/new"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-3.5" />
            New invoice
          </Link>
        </div>
      </div>

      {/* KPI strip */}
      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          <KpiTile
            label="Open AR"
            value={moneyCompact(kpis.openAr)}
            hint={`${kpis.openArCount} open invoice${kpis.openArCount === 1 ? "" : "s"}`}
            href="/finance/ar"
          />
          <KpiTile
            label="Overdue"
            value={moneyCompact(kpis.overdueAr)}
            hint={
              kpis.overdueCount
                ? `${kpis.overdueCount} past due`
                : "All current"
            }
            href="/finance/invoices?status=overdue"
            tone={kpis.overdueAr > 0 ? "warning" : "default"}
          />
          <KpiTile
            label="Cash in"
            value={moneyCompact(kpis.incomeMtd)}
            hint={range.label}
            href="/finance/reports"
            tone="positive"
          />
          <KpiTile
            label="Cash out"
            value={moneyCompact(kpis.expenseMtd)}
            hint={range.label}
            href="/finance/reports"
          />
          <KpiTile
            label="Net cash"
            value={moneyCompact(kpis.profitMtd)}
            hint={range.label}
            href="/finance/reports"
            tone={
              kpis.profitMtd > 0
                ? "positive"
                : kpis.profitMtd < 0
                  ? "warning"
                  : "muted"
            }
          />
        </div>
      </section>

      {/* Main: cash + attention | customers + projects */}
      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-4">
          {/* Cash flow */}
          <Card className="shadow-none" size="sm">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Cash flow</CardTitle>
                  <CardDescription>
                    Money in vs out · {range.label.toLowerCase()}
                  </CardDescription>
                </div>
                <Link
                  href="/finance/reports"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  Full reports
                </Link>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="size-2 rounded-full bg-[var(--chart-1)]" />
                  In {money(cash.income)}
                </span>
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <span className="size-2 rounded-full bg-[var(--chart-5)]" />
                  Out {money(cash.expenses)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 font-medium tabular-nums",
                    cash.profit >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-orange-700 dark:text-orange-400"
                  )}
                >
                  {cash.profit >= 0 ? (
                    <ArrowUpRight className="size-3.5" />
                  ) : (
                    <ArrowDownRight className="size-3.5" />
                  )}
                  Net {money(cash.profit)}
                </span>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <DashboardChart data={cash.byDay} />
            </CardContent>
          </Card>

          {/* Action queue */}
          <Card className="shadow-none" size="sm">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <AlertCircle className="size-3.5 text-orange-600 dark:text-orange-400" />
                    Needs attention
                  </CardTitle>
                  <CardDescription>
                    Past-due invoices, drafts, and delivery risks
                  </CardDescription>
                </div>
                {draftInvoiceCount > 0 ? (
                  <Link
                    href="/finance/invoices?status=draft"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                  >
                    {draftInvoiceCount} draft
                    {draftInvoiceCount === 1 ? "" : "s"}
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {attention.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  You&apos;re clear — no overdue invoices or urgent milestones.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {attention.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                item.urgency === "high" &&
                                  "bg-orange-500",
                                item.urgency === "medium" &&
                                  "bg-amber-400",
                                item.urgency === "low" && "bg-muted-foreground/40"
                              )}
                              aria-hidden
                            />
                            <p className="truncate font-medium">{item.title}</p>
                            <Badge
                              variant="secondary"
                              className="h-5 shrink-0 px-1.5 text-[10px] font-normal"
                            >
                              {item.kind === "overdue_invoice"
                                ? "Invoice"
                                : item.kind === "draft_invoice"
                                  ? "Draft"
                                  : item.kind === "milestone"
                                    ? "Milestone"
                                    : "Project"}
                            </Badge>
                          </div>
                          <p className="truncate pl-3 text-xs text-muted-foreground">
                            {item.subtitle}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-xs tabular-nums",
                            item.urgency === "high"
                              ? "font-medium text-orange-700 dark:text-orange-400"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.meta}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Customers / AR */}
          <Card className="shadow-none" size="sm">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    Customers owed
                  </CardTitle>
                  <CardDescription>
                    Open balances by customer
                  </CardDescription>
                </div>
                <Link
                  href="/finance/ar"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  All AR
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {arByCustomer.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No open receivables. Nice.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {arByCustomer.map((c) => (
                    <li key={c.customerId}>
                      <Link
                        href={`/finance/ar/${c.customerId}`}
                        className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">
                            {c.customerName}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {c.openCount} open
                            {c.overdueTotal > 0
                              ? ` · ${moneyCompact(c.overdueTotal)} overdue`
                              : ""}
                          </p>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">
                          {moneyCompact(c.openTotal)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Projects */}
          <Card className="shadow-none" size="sm">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-1.5">
                    <FolderKanban className="size-3.5" />
                    Active work
                  </CardTitle>
                  <CardDescription>
                    {kpis.activeProjects} in progress
                    {kpis.planningProjects
                      ? ` · ${kpis.planningProjects} planning`
                      : ""}
                  </CardDescription>
                </div>
                <Link
                  href="/projects"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  All projects
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {projects.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    No active projects.
                  </p>
                  <Link
                    href="/projects/new"
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                      "mt-3"
                    )}
                  >
                    Start a project
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {[...inProgress, ...planning].map((project) => {
                    const next = nextMilestoneByProject[project.id];
                    return (
                      <li key={project.id}>
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {project.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {project.customers?.name || "No customer"}
                              {next
                                ? ` · Next: ${next.title}${
                                    next.due_date
                                      ? ` (${formatDate(next.due_date)})`
                                      : ""
                                  }`
                                : ""}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {titleCase(project.status)}
                          </Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Activity — de-emphasized */}
          <Card className="shadow-none" size="sm">
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle>Recent activity</CardTitle>
                  <CardDescription>Latest workspace events</CardDescription>
                </div>
                <Link
                  href="/activity"
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5 p-3 pt-3">
              {recentActivity.length ? (
                recentActivity.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {titleCase(item.action)} {item.entity_type}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {typeof item.meta?.name === "string"
                          ? item.meta.name
                          : typeof item.meta?.invoice_number === "string"
                            ? item.meta.invoice_number
                            : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No activity yet
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
