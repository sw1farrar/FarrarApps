import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, monthToDateRange, titleCase } from "@/lib/format";
import type { ActivityLog, Project } from "@/lib/types/database";
import { DashboardChart } from "@/components/dashboard/dashboard-chart";
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Account, Category, Customer } from "@/lib/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { start, end } = monthToDateRange();

  const [
    { data: mtdTx },
    { data: pendingInvoices },
    { data: activeProjects },
    { data: chartTx },
    { data: activity },
    { data: accounts },
    { data: categories },
    { data: customers },
    { data: projects },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("type, amount")
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("invoices")
      .select("id, total, status")
      .in("status", ["sent", "overdue"]),
    supabase
      .from("projects")
      .select("id")
      .in("status", ["planning", "in_progress"]),
    supabase
      .from("transactions")
      .select("date, type, amount")
      .gte("date", start)
      .lte("date", end)
      .order("date"),
    supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("accounts").select("*").eq("is_active", true).order("name"),
    supabase.from("categories").select("*").order("name"),
    supabase.from("customers").select("*").order("name"),
    supabase.from("projects").select("*").order("name"),
  ]);

  const income = (mtdTx ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const expenses = (mtdTx ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const pendingTotal = (pendingInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv.total),
    0
  );

  const kpis = [
    { label: "MTD Income", value: formatCurrency(income) },
    { label: "Expenses", value: formatCurrency(expenses) },
    { label: "Profit", value: formatCurrency(income - expenses) },
    {
      label: "Pending Invoices",
      value: `${(pendingInvoices ?? []).length} · ${formatCurrency(pendingTotal)}`,
    },
    {
      label: "Active Projects",
      value: String((activeProjects ?? []).length),
    },
  ];

  const byDay = new Map<string, { income: number; expense: number }>();
  for (const row of chartTx ?? []) {
    const key = row.date as string;
    const current = byDay.get(key) ?? { income: 0, expense: 0 };
    if (row.type === "income") current.income += Number(row.amount);
    else current.expense += Number(row.amount);
    byDay.set(key, current);
  }
  const chartData = Array.from(byDay.entries()).map(([date, values]) => ({
    date,
    ...values,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Month-to-date workspace overview.
          </p>
        </div>
        <TransactionFormDialog
          accounts={(accounts ?? []) as Account[]}
          categories={(categories ?? []) as Category[]}
          customers={(customers ?? []) as Customer[]}
          projects={(projects ?? []) as Project[]}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-none">
            <CardHeader className="gap-1 p-3 pb-1">
              <CardDescription className="text-xs">{kpi.label}</CardDescription>
              <CardTitle className="text-xl tabular-nums">{kpi.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Income vs expenses</CardTitle>
            <CardDescription className="text-xs">MTD daily totals</CardDescription>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <DashboardChart data={chartData} />
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardHeader className="p-3 pb-2">
            <CardTitle className="text-sm">Recent activity</CardTitle>
            <CardDescription className="text-xs">
              Latest workspace events
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3 pt-0">
            {(activity as ActivityLog[] | null)?.length ? (
              (activity as ActivityLog[]).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {titleCase(item.action)} {item.entity_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeof item.meta?.name === "string"
                        ? item.meta.name
                        : typeof item.meta?.invoice_number === "string"
                          ? item.meta.invoice_number
                          : item.entity_id?.slice(0, 8) || ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(item.created_at)}
                  </span>
                </div>
              ))
            ) : (
              <p className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                No activity yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
